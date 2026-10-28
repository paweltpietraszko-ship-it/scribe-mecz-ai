// For the screenshot and test scripts (moved out of main.js in task 009): the ?freeze&pose=… states and window.__theone.
// ?freeze: writing head, seal, arena moves and animations stand still (screenshots); pose=crouch|aim|roll puts the
// heroine in that state (task 005: cover_high|cover_peek|cover_arm|vault; task 006: rifle_aim|reload|dummy_hit|dummy_dead;
// task 007: rifle_aim_side; task 008: hud_calm|hud_fight|hud_aim|hud_head|hud_reload|hud_heal|hud_low|hud_arena|hud_pause;
// task 009: foe_aim (the Double at the Dummy's place aims at the heroine, who aims back), foe_cover (the Double in cover,
// leaning out of its corner), pause_level (the pause with the opponent's level chosen))
import * as THREE from 'three';
import { combatLog } from '../combat/log.js';
import { PLAYER, TURNTABLE } from '../data/arena.js';
import { screenSample } from './screens.js';

// poses in which the heroine aims
export const AIM_POSES = ['aim', 'cover_peek', 'rifle_aim', 'rifle_aim_side', 'hud_aim', 'hud_head', 'hud_reload', 'foe_aim'];
// ?freeze&pose=roll: half of the roll slice, rolling backwards from the camera (the dodge with the stick at rest)
export const ROLL_POSE = { u: 0.5, dir: new THREE.Vector2(Math.sin(PLAYER.spawn.yaw), Math.cos(PLAYER.spawn.yaw)) };

// player, foe: the fighters (the foe is on the Dummy level in ?freeze); bot: the foe's; tpp: the camera; motion, pause:
// for hud_arena, hud_pause
export function applyPose(pose, { player, foe, bot, tpp, hud, motion, pause }) {
  if (!pose) return;
  if (pose.startsWith('foe_')) {
    // the Double, not the Dummy (its name over the bar), looking and aiming at the heroine's chest at the spawn point
    foe.passive = false; foe.freezeHp(64);   // just hit: its bar with its name shows
    const at = pose === 'foe_cover' ? foe.cover.place('cover_peek', new THREE.Vector2(foe.feet.x, foe.feet.z), foe.character) && foe.feet : foe.feet;
    const dx = PLAYER.spawn.x - at.x, dz = PLAYER.spawn.z - at.z;
    bot.hold({ yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(1.25 - 1.5, Math.hypot(dx, dz)), aim: true });
    // the heroine aims back from the spawn point
    tpp.setYaw(Math.atan2(-(at.x - PLAYER.spawn.x), -(at.z - PLAYER.spawn.z)));
  }
  if (pose === 'pause_level') setTimeout(() => { pause.setOpen(true); pause.select('level'); });
  if (pose === 'crouch') player.character.crouch();
  // in cover at the nearest suitable element (or halfway over a sill)
  if (pose.startsWith('cover_') || pose === 'vault') tpp.setYaw(player.cover.place(pose, new THREE.Vector2(PLAYER.spawn.x, PLAYER.spawn.z), player.character).yaw);
  if (pose === 'reload') player.weapon.freezeReload();
  if (pose.startsWith('dummy_')) foe.freezeReact(pose);
  // the HUD states of reference/hud_gracza.html (numbers as in its state script)
  if (pose.startsWith('hud_')) {
    const k = pose.slice(4);
    const hp = { low: 18, heal: 44 }[k] ?? 62, foeHp = { head: 38, low: 71 }[k] ?? 64;
    player.health.damage(100 - hp);
    if (k === 'heal') player.health.freezeHeal(0.7);
    if (k === 'low') player.health.freezeKits(0);
    player.weapon.freezeState({ mag: { reload: 0, low: 11 }[k] ?? 24, hit: { aim: 'torso', head: 'head' }[k] ?? null });
    if (k === 'reload') player.weapon.freezeReload();
    if (['fight', 'aim', 'head', 'low'].includes(k)) foe.freezeHp(foeHp);
    hud.freezeChip({ aim: 9, head: 14 }[k] ?? 0);
    if (k === 'low') hud.hurtFrom(-90);
    if (k === 'arena') {   // the turntable announces a turn while it is out of the picture, to the right
      setTimeout(() => motion.turnNow());
      tpp.setYaw(Math.atan2(-(TURNTABLE.center[0] - PLAYER.spawn.x), -(TURNTABLE.center[1] - PLAYER.spawn.z)) + 1.7);
    }
    if (k === 'pause') setTimeout(() => pause.setOpen(true));
  }
}

// read-only state and test helpers (the same names as in tasks 003–008; task 009: foe, bot, round, nav)
// task 011: the arena from straight above, orthographic, without fog, brightened, as a PNG data URL: `width` × `depth` m
// around (cx, cz), `px` pixels across; screen right = the plan's +x, up = the plan's +y (for comparison with the plan)
function topView(stage, { cx, cz, width, depth, px }) {
  const r = stage.renderer, scene = stage.scene, h = Math.round(px * depth / width);
  const cam = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 0.1, 200);
  cam.position.set(cx, 100, cz); cam.up.set(0, 0, 1); cam.lookAt(cx, 0, cz);
  const fog = scene.fog, light = new THREE.AmbientLight(0xffffff, 4); scene.fog = null; scene.add(light);
  const rt = new THREE.WebGLRenderTarget(px, h, { colorSpace: THREE.SRGBColorSpace });
  r.setRenderTarget(rt); r.render(scene, cam); r.setRenderTarget(null);
  scene.fog = fog; scene.remove(light);
  const buf = new Uint8Array(px * h * 4); r.readRenderTargetPixels(rt, 0, 0, px, h, buf); rt.dispose();
  const c = document.createElement('canvas'); c.width = px; c.height = h;
  const img = c.getContext('2d').createImageData(px, h);
  for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * px * 4, (h - y) * px * 4), y * px * 4);
  c.getContext('2d').putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

export function exposeHooks({ engine, pvp, view, frozen, player, foe, bot, round, nav, tpp, camera, fill, motion, turnAngle, hud, pause, physics, control, stats, audio, stage, gallery, machine, screen, match, itemWorld, marks, ballistics, flow, characters, useWeapon }) {
  const fighterState = f => ({ hp: f.hp, alive: f.alive, x: f.feet.x, z: f.feet.z, clip: f.clip, cover: f.coverState.mode, medkits: f.health.medkits });
  window.__theone = {
    engine, pvp,   // task 027: the fight's engine (sim/engine.js: hash(), recording), PvP (net/pvp.js)
    ready: true, welcomeReady: true, views: view.views, look: view.look, frozen,
    player: () => {
      const c = player.cover;
      return { x: player.feet.x, y: player.feet.y, z: player.feet.z, riding: player.character.riding, crouched: player.character.crouched,
        yaw: tpp.yaw, pitch: tpp.pitch, turn: turnAngle(), cam: camera.position.toArray(),
        body: player.animator.bodyYaw, speed: player.character.speed.length(), dodge: player.character.dodge?.u ?? null,
        cover: c.mode, target: c.target && { along: c.target.along, low: c.target.line.low, panel: !!c.target.line.panel,
          movingPanel: !!c.target.line.panel?.moving, arm: !!c.target.line.disc },
        shoulder: tpp.shoulder, alive: player.alive };
    },
    cover: player.cover, hero: player.body, fill,
    // back to the spawn point, camera turned by yaw
    reset: (yaw = 0) => { player.reset(PLAYER.spawn); tpp.reset(); tpp.addYaw(yaw); },
    lowerPanel: () => motion.lowerPanel(),
    place: (x, z, yaw) => { player.cover.reset(); player.character.place(x, z); tpp.reset(); tpp.setYaw(yaw); },
    setYaw: y => tpp.setYaw(y),
    setPitch: p => tpp.addPitch(p - tpp.pitch),
    combat: () => ({ hp: player.hp, medkits: player.health.medkits, healing: player.health.healing, mag: player.weapon.mag,
      reload: player.weapon.reload, dummy: fighterState(foe), foe: fighterState(foe) }),
    shots: player.weapon.log,
    damage: n => player.health.damage(n),
    setGrip: g => player.rifle.setGrip(g),
    hurtFrom: angle => hud.hurtFrom(angle),
    pause, dummy: foe, rifle: player.rifle, physics,
    // task 009
    fighters: { player, foe }, bot, round, nav, control, stats, flow,   // task 022: flow (screens, music)
    // task 022 (B9): the match's screens with a sample state (debug/screens.js), for the screenshots
    matchScreen: k => flow.screens.preview(screenSample(k)),
    placeFoe: (x, z) => { foe.cover.reset(); foe.character.place(x, z); },
    foeShots: foe.weapon.log,
    // task 010: the sound engine and its counters (requested, played, silent, cut, voices, state)
    audio, sound: audio.stats,
    // task 011
    topView: o => topView(stage, o), previewScene: gallery.scene,
    stage, characters,   // task 023: the renderer and the scene (scripts/measure.mjs: renderer.info, textures)
    useWeapon,           // task 024 (K4): another weapon for both, as a new match does (scripts/check-memory.mjs)
    // task 012: SCRIBE (machine.scribe: stats, events; machine.mech: the elements' mechanisms)
    machine, motion, elements: stage.scene.children.filter(o => o.userData.id !== undefined).map(o => o.userData.id),
    // task 013: the LED screen (alarm, setBrightness, uniforms)
    screen,
    match,   // task 016: { seed, weapon }
    itemWorld,   // task 017: flying, log (explosions and keys), throwIt, key
    marks,       // task 020: the bullet marks (count, clear)
    combatLog,   // task 014: the combat log (entries, lines(n), text(), clear(), on)
    ballistics,  // task 014: rays against the arena and the fighters' zones (firstArena, zonesOnly, trace)
  };
}
