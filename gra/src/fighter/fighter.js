// A fighter (task 009): one person's body, capsule, animations, arms IK, cover, rifle, health and medkits, driven only
// by actions (fighter/actions.js). The same code makes the heroine and the Double; it reads neither the input nor the
// camera. A frame has two steps, because the player's camera follows the body between them:
//   move(): the rifle's intent, cover and the capsule (then the world's physics steps once for everybody);
//   act():  the animation, the rifle in the hands and the IK, the medkit, the shots.
// A fighter can die (the same three deaths as the training dummy of task 006); dead, it lies still until reset().
import * as THREE from 'three';
import { HERO, HERO_FILES } from '../data/hero.js';
import { DUMMY } from '../data/bot.js';
import { createHeroBody } from '../player/hero.js';
import { createCharacter } from '../player/character.js';
import { createAnimator } from '../player/animator.js';
import { createArmsIK } from '../player/ik.js';
import { createCover } from '../player/cover.js';
import { holdRifle, createWeapon } from '../combat/weapon.js';
import { createHealth, zonesAt } from '../combat/hits.js';
import { combatLog } from '../combat/log.js';
import { createItems } from '../items/items.js';
import { packPose, unpackPose } from './view.js';
import { copyState } from '../sim/copy.js';

const R = HERO_FILES.reactions;

// spawn: { x, z, yaw }; ballistics: combat/ballistics.js (the fighter adds itself); onShot: every shot it fires;
// onHurt({ dir, zone, damage }): it was hit (dir: the shot's direction)
// rand: this fighter's stream of chance from the match's seed (task 027, sim/random.js: its weapon's spread and recoil)
export function createFighter({ scene, physics, assets, rifleTemplate, effects, ballistics, wall, elements, nav = null, spawn, onShot, onHurt = () => {}, name = '?', rand }) {
  const body = createHeroBody(scene, assets);
  const health = createHealth();
  let weapon = null, spawnAt = spawn;
  const character = createCharacter(physics, body.rollShape, { spawn: spawnAt, onReset: () => { health.reset(); weapon?.reset(); } });
  const animator = createAnimator(body, spawn.yaw);
  const arms = createArmsIK(body.model, body.root);   // task 007: both hands on the rifle
  const cover = createCover({ physics, hero: body, wall, elements, nav });
  let rifle = holdRifle(scene, rifleTemplate, body.model);

  let dead = null;           // { clip, t } while dead
  let flinch = null;         // { t }: the hit reaction of the Dummy level (it stands still for it)
  let stun = null;           // task 017: { t, time }: the shock grenade: nothing works, the body jerks (the hit clip, looped)
  let flinchCool = 0, hitAge = Infinity, coverFire = null, passive = false, aimingNow = false;
  let c = { mode: 'free', drive: null, anim: null, aiming: false, shoulder: 0, target: null };
  let shot = { firing: false, raised: false };
  // task 017: the items (items/items.js); world set by setItemWorld once the models are loaded
  const NO_ITEM = { holding: null, preview: null, lean: false, blocks: [], busy: false, throwU: null, inHand: false };
  // the action fields an item's data blocks turned off (audit 017)
  const blocked = (act, blocks) => (blocks.length ? { ...act, ...Object.fromEntries(blocks.map(k => [k, false])) } : act);
  let items = null, itemState = NO_ITEM, itemWorld = null, handNade = null;
  const leftHand = body.model.getObjectByName('mixamorigLeftHand'), handAt = new THREE.Vector3();
  const top = new THREE.Vector3(), head = body.model.getObjectByName('mixamorigHead');

  const me = {
    name,   // task 014: in the combat log (a key of log.name.* in the texts)
    // task 028 (K3): the PvP window's own fighter, predicted: its shots hurt nobody and log nothing here (the server
    // decides; its answer comes back), the rest runs as in the fight
    predicted: false,
    get feet() { return character.feet; },
    get collider() { return character.collider; },
    get alive() { return !dead; },
    zones: () => zonesAt(character.feet, character.height),
    // zone: 'head' | 'torso' | 'legs'; dir: the shot's direction. Returns true when this hit killed it.
    hit(zone, damage, dir) {
      if (dead) return false;
      health.damage(damage); hitAge = 0;
      onHurt({ dir, zone, damage });
      if (health.hp === 0) { die(zone, dir); return true; }
      if (passive && flinchCool <= 0) { flinch = { t: 0 }; flinchCool = DUMMY.hitCooldown; }
      return false;
    },
    // task 017: stunned for `time` s (a new shock does not shorten one going on); out of cover at once
    stun(time) {
      if (dead) return;
      stun = { t: 0, time: Math.max(time, stun ? stun.time - stun.t : 0) };
      cover.reset();
    },
    get stunned() { return !!stun; },
  };
  weapon = createWeapon({ rifle, effects, ballistics, me, onShot, rand });
  ballistics.add(me);

  // Paweł 29.09.2026 (task 016): a dead body fell into a sill. The death clips carry the hips up to about a metre and
  // the body lies on beyond them (HERO.deathRoom); what stands in that way pulls the body back by what does not fit.
  // travel(file): the hips' travel over the floor in the clip (model frame, m) and the share of it done at time t
  const hipsBone = body.model.getObjectByName('mixamorigHips'), pt = new THREE.Vector3();
  const travels = {};
  function travel(file) {
    if (travels[file]) return travels[file];
    const tr = body.extraClips[file].tracks.find(t => t.name === 'mixamorigHips.position'), v = tr.values, n = v.length / 3;
    const s = hipsBone.parent.getWorldScale(new THREE.Vector3()).y, at = tr.createInterpolant();
    const x = (v[3 * (n - 1)] - v[0]) * s, z = (v[3 * (n - 1) + 2] - v[2]) * s, L2 = x * x + z * z || 1;
    const start = new THREE.Vector3(v[0], 0, v[2]);
    return (travels[file] = { x, z, share: t => { pt.fromArray(at.evaluate(t)); return THREE.MathUtils.clamp(((pt.x - start.x) * s * x + (pt.z - start.z) * s * z) / L2, 0, 1); } });
  }
  const ray = new physics.RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  // a shot travelling against the body's front came from the front
  function die(zone, dir) {
    combatLog.add({ kind: 'death', who: me.name, zone });
    const f = animator.bodyYaw, front = dir.x * Math.sin(f) + dir.z * Math.cos(f) < 0;
    dead = { clip: zone === 'head' ? R.deathHead : front ? R.deathFront : R.deathBack, t: 0 };
    flinch = null; stun = null; character.setSolid(false); cover.reset();
    // the fall's way in the world (the model faces +Z in a root turned by the body's yaw), checked low over the floor
    const T = travel(dead.clip), wx = T.x * Math.cos(f) + T.z * Math.sin(f), wz = -T.x * Math.sin(f) + T.z * Math.cos(f);
    const L = Math.hypot(wx, wz), need = L + HERO.deathRoom;
    if (L < 0.05) return;
    let free = need;
    for (const y of HERO.deathRays) {
      ray.origin = { x: character.feet.x, y, z: character.feet.z }; ray.dir = { x: wx / L, y: 0, z: wz / L };
      const hit = physics.world.castRay(ray, need, true, undefined, undefined, character.collider);
      if (hit) free = Math.min(free, hit.timeOfImpact);
    }
    if (free < need) dead.pull = { from: character.feet.clone(), x: -wx / L * (need - free), z: -wz / L * (need - free), share: T.share };
  }

  // ctx: { active (the controls are on), frozen, turnDelta, panel, turnAngle } from the game loop
  function move(dt, a, ctx) {
    if (dead) { c = { mode: 'free', drive: null, anim: null, aiming: false, shoulder: 0, target: null }; return { firing: false }; }
    let act = flinch || stun ? { ...a, move: { x: 0, y: 0 }, aim: false, shoot: false, blind: false, rise: false, sprint: false,
      sprintClick: false, cover: false, dodge: false, crouch: false, medkit: false, grenade: false, key: false } : a;
    // task 017 (last frame's items, their data): held, an item may lean out of cover as for aiming; held or in use it
    // turns off the action fields it blocks
    if (itemState.lean) act = { ...act, aim: true, rise: !!cover.line?.crouch };
    act = blocked(act, itemState.blocks);
    // RT (task 006), decided on last frame's state: a shot ends a sprint, hip fire raises the rifle (the body turns
    // to the view and walks at the aiming pace), a medkit walks at the aiming pace too
    shot = weapon.intent(act, { play: ctx.active, cover: cover.mode, coverFire, dodge: !!character.dodge, healing: health.healing });
    const moves = { ...act, aim: act.aim || shot.raised, sprint: act.sprint && !shot.firing, slow: health.healing };
    c = cover.update(dt, act, { feet: character.feet, yaw: a.yaw, character, panel: ctx.panel, frozen: ctx.frozen, turnAngle: ctx.turnAngle });
    character.update(dt, moves, a.yaw, ctx.turnDelta, c.drive);
    return { firing: shot.firing };
  }

  // the view's direction (the raised rifle follows it: task 007)
  const aimView = new THREE.PerspectiveCamera();
  let lastPose = null;   // task 027: this step's pose record (act(), or the server's in a PvP window: show())
  // the body posed from a pose record: the animation, the rifle in the hands (pulled back from a wall), both arms
  function poseBody(dt, P) {
    const A = P.anim, frozen = A.frozen;
    animator.update(dt, A);
    aimView.rotation.set(A.pitch, A.yaw, 0, 'YXZ'); aimView.updateMatrixWorld();
    rifle.place(frozen ? null : dt, P.raise, aimView);
    weapon.guard();   // task 014 (U33): pulled back from a wall in front of it
    const grips = rifle.ik(P.ik);
    // the grenade in the left hand until it leaves it (the flight is items/world.js)
    if (handNade) {
      handNade.visible = !!P.hand;
      if (handNade.visible) { leftHand.getWorldPosition(handAt); handNade.position.copy(handAt); }
    }
    arms.update(frozen ? null : dt, grips.left, grips.right);
    top.set(character.feet.x, character.feet.y + character.height, character.feet.z);
  }
  // ctx: as move(), plus pose (?freeze&pose=roll|vault: the heroine's screenshots), rollPose, and trigger: the
  // controller's last word on RT at the moment of the shot, after both fighters moved and this body is posed (the bot:
  // do the eyes see the target now?). Returns the recoil.
  function act(dt, a, ctx) {
    const frozen = ctx.frozen, fdt = frozen ? 0 : dt, pose = ctx.pose;
    hitAge += fdt; flinchCool -= fdt;
    if (dead) dead.t += fdt;
    if (flinch && (flinch.t += fdt) >= body.clips[R.hit].duration) flinch = null;
    if (stun && (stun.t += fdt) >= stun.time) stun = null;
    // the dead body pulled back from what stands in its fall, along with the clip's travel
    if (dead?.pull) { const P = dead.pull, u = P.share(Math.min(dead.t, body.clips[dead.clip].duration)); character.place(P.from.x + P.x * u, P.from.z + P.z * u); }
    // stunned: the start of the hit reaction over and over (the body jerks)
    const react = dead ? { clip: dead.clip, t: dead.t } : flinch ? { clip: R.hit, t: flinch.t }
      : stun ? { clip: R.hit, t: (stun.t * HERO.stunJerk) % (body.clips[R.hit].duration * 0.35) } : null;
    // task 017: the items, with this frame's aim point (after the view moved)
    itemState = items && !react && !frozen ? items.update(dt, a, !!ctx.active && !character.dodge) : NO_ITEM;
    const throwing = itemState.throwU !== null, T = throwing && itemWorld ? itemState : null;
    const aiming = aimingNow = !react && (c.mode === 'free' ? character.aiming : c.aiming);
    const dodge = pose === 'roll' ? ctx.rollPose : character.dodge;
    // weapon (task 006): the rifle follows the hands; medkit, reload and shots. Task 007: aiming raises the rifle to the
    // eye and both hands follow it by IK; the left hand leaves the front grip for the roll, the vault and the reload
    const dodging = !!(character.dodge || pose === 'roll'), reloading = !!weapon.reload;
    // task 027: the body's pose from this record alone (the server sends it: a PvP window poses the body the same way)
    lastPose = {
      anim: {
        // (copies: the round may put the body back at its spawn after this step; the record keeps this step's)
        feet: character.feet.clone(), speed: character.speed.clone(), intent: character.intent.clone(), crouched: character.crouched,
        aiming, dash: c.mode === 'dash', sprinting: character.sprinting, dodge: react ? null : dodge,
        yaw: a.yaw, pitch: a.pitch, turnDelta: character.riding && !dead ? ctx.turnDelta : 0, frozen, cover: react ? null : c.anim,
        reload: weapon.reload, react,
        throwOver: T && { u: T.throwU, w: Math.max(0, Math.min(1, T.throwU / 0.15, (1 - T.throwU) / 0.15)) },
      },
      raise: aiming && !dodging && !reloading,
      ik: !react && !dodging && c.mode !== 'vault' && pose !== 'vault' && !reloading && !throwing,
      hand: throwing && itemState.inHand,
    };
    if (!ctx.quiet) poseBody(dt, lastPose);   // (task 028: a replayed step of the prediction is not drawn)
    if (dead || flinch || stun) { coverFire = null; return { pitch: 0, yaw: 0 }; }
    const wasHealing = health.healing;
    health.update(fdt, { medkit: ctx.active && a.medkit, dodge: dodging, serverHp: me.predicted });   // (task 028 audit F1)
    if (health.healing !== wasHealing && !me.predicted) combatLog.add({ kind: 'heal', who: me.name, start: health.healing, hp: health.hp, left: health.medkits });
    // blind fire (task 015) does not need the eyes on the target: the bot fires it at a place it knows
    let pull = a.shoot && ctx.trigger && !c.fire?.blind ? { ...a, shoot: ctx.trigger() } : a;
    pull = blocked(pull, itemState.blocks);
    const recoil = weapon.update(dt, pull, { play: ctx.active, frozen, cover: c.mode, coverFire: c.fire, dodge: dodging, healing: health.healing, quiet: ctx.quiet });
    coverFire = c.fire;
    return recoil;
  }

  // back to the spawn point (spawn: a new one, else the last), alive, full health, magazine and medkits
  let resets = 0;   // task 027: the PvP window resets the body's animation when the server did
  function reset(to = spawnAt) {
    spawnAt = to; resets++;
    dead = null; flinch = null; stun = null; hitAge = Infinity; coverFire = null;
    cover.reset(); character.setSpawn(to); character.reset(); character.setSolid(true);
    animator.reset(to.yaw);
    items?.reset(); itemState = NO_ITEM;
  }

  // Task 027 (K1): the fighter as the server sends it to the PvP windows (sides: fighter → 'a' | 'b', for the shots'
  // targets), and as a window shows it: the state its readers use (the HUD, the sounds, the camera, the marker), then
  // the body posed from the server's pose record (the same animation, rifle and arms as on the server)
  function view(sideOf) {
    return {
      ch: character.view(), hl: health.view(), w: weapon.view(sideOf), cv: cover.view(),
      c: { mode: c.mode, anim: c.anim, aiming: c.aiming, shoulder: c.shoulder, fire: !!c.fire,
        target: c.target && { i: c.target.line.id, along: c.target.along, blocked: c.target.blocked } },   // (the cover line by its number)
      shot, aiming: aimingNow, hitAge, passive, stun: stun && { t: stun.t, time: stun.time }, flinch: flinch && flinch.t,
      dead: dead && { clip: dead.clip, t: dead.t }, pose: lastPose && packPose(lastPose), resets, spawn: spawnAt,
    };
  }
  let shownResets = -1;   // (-1: the first view always sets the body as the server has it)
  function show(dt, v, fighterOf) {
    const again = () => { shownResets = v.resets; spawnAt = v.spawn; animator.reset(spawnAt.yaw); items?.reset(); };
    if (shownResets === -1) again();   // the first view: the server set the body before its first step
    character.show(v.ch); health.show(v.hl); weapon.show(v.w, fighterOf); cover.show(v.cv);
    c = { ...v.c, drive: null, fire: v.c.fire ? {} : null, target: v.c.target && { line: cover.lineAt(v.c.target.i), along: v.c.target.along, blocked: v.c.target.blocked } };
    shot = v.shot; aimingNow = v.aiming; hitAge = v.hitAge; passive = v.passive;
    stun = v.stun; flinch = v.flinch === null ? null : { t: v.flinch }; dead = v.dead;
    if (v.pose) { lastPose = unpackPose(v.pose); poseBody(dt, lastPose); }
    // the server put it back at its spawn at the end of this step (the round), after posing it: so here too
    if (v.resets !== shownResets) again();
  }

  // task 028 (K3): the whole fighter, kept and put back (the PvP window's own fighter: its prediction goes back to a
  // step it took and plays its actions again). Not kept: the body's animation (pictures only) and the items (frozen,
  // data/items.js)
  const keep = cover.keep;
  function save() {
    return { character: character.save(), cover: cover.save(), weapon: weapon.save(), health: health.save(),
      f: copyState({ dead, flinch, stun, flinchCool, hitAge, coverFire, c, shot, aimingNow, spawnAt }, keep) };
  }
  function load(s) {
    character.load(s.character); cover.load(s.cover); weapon.load(s.weapon); health.load(s.health);
    ({ dead, flinch, stun, flinchCool, hitAge, coverFire, c, shot, aimingNow, spawnAt } = copyState(s.f, keep));
  }

  // getters must stay getters (Object.assign would copy their values once)
  return Object.defineProperties(me, Object.getOwnPropertyDescriptors({
    move, act, reset, view, show, save, load,
    // task 017: the item world (items/world.js), once its models are loaded: this fighter's items start
    setItemWorld(w) {
      itemWorld = w;
      items = createItems({ me, ballistics });
      items.setWorld(w);
      const m = Object.values(w.models)[0];
      if (m) { handNade = m.clone(); handNade.visible = false; scene.add(handNade); }
    },
    get items() { return items; },
    get itemWorld() { return itemWorld; },
    get itemState() { return itemState; },   // this frame's: holding, preview, busy, throwU
    body, character, animator, cover, health,
    get rifle() { return rifle; },
    get weapon() { return weapon; },
    // task 022: a new match's weapon (its model from loadRifle) without reloading the page (the full screen stays)
    setWeapon(template) {
      scene.remove(rifle.root);
      rifle = holdRifle(scene, template, body.model);
      weapon = createWeapon({ rifle, effects, ballistics, me, onShot, rand });
    },
    get coverState() { return c; },   // this frame's cover result: mode, target, shoulder, aiming
    get aiming() { return aimingNow; },   // the rifle is up (LT, or out of cover's corner)
    get shot() { return shot; },          // this frame's RT: { firing, raised (by hip fire) }
    get hp() { return health.hp; },
    get hitAge() { return hitAge; },   // s since the last hit (the HP bar over it shows for a while)
    get dead() { return dead; },
    get spawn() { return spawnAt; },
    top,                                 // over the head, for the HP bar
    // the eyes: the head bone's world position (the bot's sight starts there)
    eyes: v => head.getWorldPosition(v),
    set passive(v) { passive = v; },
    get passive() { return passive; },   // the Dummy level: it stands and flinches when hit
    get clip() {   // the reaction playing, else the strongest clip (for test scripts)
      if (dead) return dead.clip; if (flinch) return R.hit;
      let best = null, w = -1;
      Object.entries(body.clips).forEach(([k, cl]) => { const e = cl.action.getEffectiveWeight(); if (e > w) { w = e; best = k; } });
      return best;
    },
    // ?freeze&pose=dummy_hit|dummy_dead: the hit reaction at its strongest, or lying dead (shot from the front)
    freezeReact(kind) {
      if (kind === 'dummy_dead') { health.damage(health.hp); dead = { clip: R.deathFront, t: body.clips[R.deathFront].duration }; character.setSolid(false); }
      else { health.damage(40); hitAge = 0; flinch = { t: 0.8 }; flinchCool = Infinity; }
    },
    // ?freeze&pose=hud_*: health as the HUD state needs it, just hit
    freezeHp(v) { health.damage(health.hp - v); hitAge = 0; },
  }));
}
