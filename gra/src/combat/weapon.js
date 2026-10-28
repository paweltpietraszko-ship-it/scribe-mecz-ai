// The rifle (task 006; raised to the eye in task 007): the model in the right hand, the shot, spread, recoil, magazine and reload.
// Aiming works in two steps, as in The Division: a ray from the camera through the crosshair finds the aim
// point (task 009: the player's controller finds it, the bot's aim looks from its eyes; it comes with the actions);
// the shot flies from the muzzle towards that point and hits the first thing on its way (arena colliders or a
// character's hit zones), so cover really stops shots. No bullet flight.
import * as THREE from 'three';
import { loadModel } from '../look/loaders.js';
import { WEAPONS, WALL } from '../data/combat.js';
import { COVER } from '../data/cover.js';
import { TPP } from '../data/arena.js';
import { IK } from '../data/hero.js';
import { multiplier } from './hits.js';
import { combatLog } from './log.js';

const rad = THREE.MathUtils.degToRad;
const ONE = new THREE.Vector3(1, 1, 1);
// task 028: the pictures of a replayed step (a PvP window's prediction): any call, nothing done
const silent = new Proxy({}, { get: () => () => {} });

// the model's turn into the held frame (barrel +X, up +Y): a flipped file (barrel −X) turns round Y; task 018: a file
// lying askew is straightened by W.orient (the rows: the file's directions of the held X, Y, Z)
const orientQ = W => (W.orient ? new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().set(...W.orient[0], 0, ...W.orient[1], 0, ...W.orient[2], 0, 0, 0, 0, 1))
  : W.flip ? new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI) : new THREE.Quaternion());
// a point in the held weapon's frame: points are given in the file's frame, or (orient) in the straightened one
const turned = (W, at) => (W.orient ? new THREE.Vector3(...at) : new THREE.Vector3(...at).applyQuaternion(orientQ(W)));
// the same point in the file's frame (a child of the model)
const inFile = (W, at) => (W.orient ? new THREE.Vector3(...at).applyQuaternion(orientQ(W).invert()) : new THREE.Vector3(...at));

// key: a weapon of WEAPONS (task 016: only the match's weapon is loaded). The model scaled to W.length, loaded once;
// every character holds its own copy (holdRifle). The copy turns about the palm's place on the pistol grip
// (W.gripPoint), so the hand stays on the grip at any length.
export async function loadRifle(key = 'karabin') {
  const W = WEAPONS[key];
  const model = (await loadModel(W.file)).scene;
  model.quaternion.copy(orientQ(W)); model.updateMatrixWorld(true);
  const length = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).x;
  const scale = W.length / length;
  model.scale.setScalar(scale);
  model.position.copy(turned(W, W.gripPoint)).multiplyScalar(-scale);
  model.traverse(o => { if (o.isMesh) o.castShadow = o.receiveShadow = true; });
  const group = new THREE.Group().add(model);
  group.userData.spec = { ...W, key };
  return group;
}

// A copy of the rifle held by a character's model. place() (after the animation, every frame) puts it at the right
// hand: the RightHand bone's world position and rotation, without the model's scale, times W.grip. Aiming (task 007)
// it is raised to the shoulder instead: the butt in the shoulder's pocket (IK.aimAnchor: between the collarbone and the
// shoulder joint, in the body's frame; Paweł after playing 007: the stock belongs at the shoulder, not by the ear or
// the breastbone), the barrel along the camera's view,
// in TPP.aimTime; the hands then follow it by IK (player/ik.js), for which ik() gives the targets.
export function holdRifle(scene, template, model) {
  const W = template.userData.spec;
  const root = new THREE.Group(); root.matrixAutoUpdate = false;
  const inner = template.clone(); root.add(inner); scene.add(root);
  const bone = n => model.getObjectByName('mixamorig' + n);
  const hand = bone('RightHand'), shoulder = bone('RightArm'), collar = bone('RightShoulder'), spine = bone('Spine2');
  const point = at => { const o = new THREE.Object3D(); o.position.copy(inFile(W, at)); inner.children[0].add(o); return o; };
  const muzzle = point(W.muzzle), foregrip = point(W.foregripPoint), buttEnd = point(W.buttPoint);
  const butt = turned(W, W.buttPoint).sub(turned(W, W.gripPoint)).multiplyScalar(inner.children[0].scale.x);
  const sight = point(W.sightPoint);   // for test scripts: where the sight line is
  const grip = new THREE.Matrix4(), gripInv = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const setGrip = g => { grip.compose(new THREE.Vector3(...g.pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...g.rot.map(rad))), ONE); gripInv.copy(grip).invert(); };
  setGrip(W.grip);
  let aimW = 0;
  const f = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3(), anchor = new THREE.Vector3();
  const joint = new THREE.Vector3(), front = new THREE.Vector3(), qBody = new THREE.Quaternion();
  const qAim = new THREE.Quaternion(), qCam = new THREE.Quaternion(), basis = new THREE.Matrix4(), m = new THREE.Matrix4();
  const target = { right: { w: 0, palmAt: new THREE.Vector3(), handQuat: new THREE.Quaternion(), wrist: true },
    left: { on: false, palmAt: new THREE.Vector3() } };
  return {
    root, spec: W,
    // dt: frame time, null = at once (?freeze); aim: the rifle is raised to the eye; camera: whose view it follows
    place(dt = null, aim = false, camera = null) {
      const step = dt === null ? 1 : dt / TPP.aimTime;
      aimW = THREE.MathUtils.clamp(aimW + (aim && camera ? step : -step), 0, 1);
      hand.updateWorldMatrix(true, false); hand.matrixWorld.decompose(p, q, s);
      m.compose(p, q, ONE).multiply(grip).decompose(p, q, s);
      if (aimW > 0) {
        camera.getWorldDirection(f); camera.getWorldQuaternion(qCam);
        up.set(0, 1, 0).applyQuaternion(qCam); right.crossVectors(f, up);
        qAim.setFromRotationMatrix(basis.makeBasis(f, up, right));   // the rifle's +X barrel, +Y up, +Z right
        // the pocket: part of the way from the collarbone's root to the shoulder joint, then down and to the front of the
        // chest (the aiming clip turns the chest sideways, so this is the body's frame, not the camera's)
        const A = IK.aimAnchor;
        collar.getWorldPosition(anchor); shoulder.getWorldPosition(joint); anchor.lerp(joint, A.along);
        spine.getWorldQuaternion(qBody); front.set(0, 0, 1).applyQuaternion(qBody); front.y = 0; front.normalize();
        anchor.addScaledVector(front, A.forward); anchor.y -= A.down;
        anchor.sub(s.copy(butt).applyQuaternion(qAim));
        const e = aimW * aimW * (3 - 2 * aimW);
        p.lerp(anchor, e); q.slerp(qAim, e);
      }
      root.matrix.compose(p, q, ONE); root.updateMatrixWorld(true);
    },
    // IK targets after place(): the right wrist on the pistol grip (while raised), the left palm on the front grip
    ik(leftOn) {
      m.multiplyMatrices(root.matrix, gripInv).decompose(target.right.palmAt, target.right.handQuat, s);
      target.right.w = aimW;
      foregrip.getWorldPosition(target.left.palmAt); target.left.on = leftOn;
      return target;
    },
    get aim() { return aimW; },
    muzzleAt: v => muzzle.getWorldPosition(v),
    buttAt: v => buttEnd.getWorldPosition(v),   // task 014 (U33): the stock's end, at the shoulder
    // task 014 (U33): the rifle pulled back by d m along its barrel (after place(), before ik())
    retract(d) {
      if (d <= 0) return;
      buttEnd.getWorldPosition(joint); muzzle.getWorldPosition(front);
      front.sub(joint).normalize().multiplyScalar(-d);
      root.matrix.premultiply(m.makeTranslation(front.x, front.y, front.z)); root.updateMatrixWorld(true);
    },
    sightAt: v => sight.getWorldPosition(v),
    setGrip,   // for tuning the grip from the console
  };
}

// a direction within a cone of half-angle `half` (radians) around d: uniform over the cone's disc
const u = new THREE.Vector3(), v = new THREE.Vector3();
function inCone(d, half, out, rand) {
  u.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0).cross(d).normalize(); v.crossVectors(d, u);
  const a = half * Math.sqrt(rand()), phi = rand() * Math.PI * 2;
  return out.copy(d).multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a) * Math.cos(phi)).addScaledVector(v, Math.sin(a) * Math.sin(phi));
}

// rifle: holdRifle() of this fighter; effects: effects.js; ballistics: ballistics.js; me: the fighter holding it (its own
// zones are not hit); onShot({ from, shooter }): every shot, where it was fired (the bot hears it: task 009); rand: the
// fighter's stream of chance from the match's seed (task 027: the spread and the recoil's side)
export function createWeapon({ rifle, effects, ballistics, me, onShot = () => {}, rand }) {
  const W = rifle.spec;   // task 016: the match's weapon
  const interval = 60 / W.rpm;
  let held = false;       // RT was down last frame ('semi': one shot per press)
  let queued = 0;         // 'semi': a press not yet fired (it waits for the interval up to W.semiBuffer s)
  let mag = W.magazine, reload = null, cool = 0, bloom = W.spread.start, raise = 0, shots = 0;
  let rise = 0, back = null, wasFiring = false;
  let lastHit = null;        // { zone, killed, age } for the hit marker
  // task 014 (U33): the rifle against a wall: the shot flies from the butt; a solid between the shot's start and the aim
  let fromButt = false, blocked = false;
  const butt = new THREE.Vector3(), tip = new THREE.Vector3(), start = new THREE.Vector3();
  // after rifle.place(), every frame: pull the rifle back from a wall in front of it (the same for every fighter)
  function guard() {
    fromButt = false;
    if (!WALL.on) return;
    rifle.buttAt(butt); rifle.muzzleAt(tip);
    const t = ballistics.firstArena(butt, tip);
    if (t === null) return;
    const need = butt.distanceTo(tip) - t + WALL.margin;
    rifle.retract(Math.min(need, WALL.maxRetract));
    fromButt = need > WALL.maxRetract;
  }
  // where a shot starts now: the muzzle, or the butt when the muzzle is still in a solid
  const shotStart = v => (fromButt ? rifle.buttAt(v) : rifle.muzzleAt(v));
  const log = [];            // the last shots, for test scripts
  let sentShots = 0;         // task 027: shots already in a view sent to the PvP windows
  const busy = mode => mode === 'dash' || mode === 'enter' || mode === 'vault' || mode === 'round';

  // May the fighter fire now? st: { play, cover (mode), coverFire, dodge, healing }
  // In cover only when the cover says so (st.coverFire, cover.js): leaned out of its corner or risen over it (task
  // 005), or blind fire (task 015)
  const ready = st => st.play && !st.dodge && !busy(st.cover) && !reload && !st.healing && mag > 0
    && (st.cover !== 'cover' || !!st.coverFire);

  // before the movement (with last frame's state): does RT fire this frame? A shot ends a sprint, and hip fire
  // raises the rifle (the body aims, the camera does not zoom)
  function intent(a, st) {
    const firing = !!a.shoot && ready(st);
    if (firing && !a.aim) raise = W.hipRaise;
    return { firing, raised: raise > 0 && !a.aim && st.cover === 'free' };
  }

  const muzzle = new THREE.Vector3(), want = new THREE.Vector3(), dir = new THREE.Vector3();
  // one shot from the muzzle towards the aim point a.aimAt (a world point: the player's crosshair, the bot's eyes);
  // a.aim: LT (accurate). fire: from cover (cover.js): blind fire starts at fire.from (out of the cover's solid, task
  // 015) with COVER.blindSpread
  // task 018: a pellet's direction in the fixed pattern round d: pellet 0 in the middle, the rest evenly on a ring of
  // half-angle `ring` (radians). No random draw: the same pattern every shot (START_HERE §5)
  const pu = new THREE.Vector3(), pv = new THREE.Vector3();
  function pelletDir(d, k, n, ring, out) {
    if (k === 0) return out.copy(d);
    pu.set(Math.abs(d.y) < 0.9 ? 0 : 1, Math.abs(d.y) < 0.9 ? 1 : 0, 0).cross(d).normalize(); pv.crossVectors(d, pu);
    const phi = (k - 1) / (n - 1) * Math.PI * 2;
    return out.copy(d).multiplyScalar(Math.cos(ring)).addScaledVector(pu, Math.sin(ring) * Math.cos(phi)).addScaledVector(pv, Math.sin(ring) * Math.sin(phi));
  }
  // task 018: the share of the damage at distance t (full to falloff.full, down to falloff.min at falloff.zero)
  const falloff = t => { const F = W.falloff; if (!F) return 1; return t <= F.full ? 1 : t >= F.zero ? F.min : 1 - (1 - F.min) * (t - F.full) / (F.zero - F.full); };

  // quiet (task 028): a replayed step of a PvP window's prediction: nothing seen or heard. me.predicted: that window's own
  // fighter: the shot's picture and sound at once, but no damage, no hit marker and no log (the server's answer)
  function shoot(a, recoil, fire, quiet) {
    const aiming = !!a.aim, blind = !!fire?.blind, fx = quiet ? silent : effects, judge = !me.predicted;
    if (fire?.from) muzzle.copy(fire.from); else shotStart(muzzle);
    want.copy(a.aimAt).sub(muzzle).normalize();
    const half = rad(blind ? COVER.blindSpread : (aiming ? W.spread.aim : W.spread.hip) + bloom);
    const P = W.pellets, n = P ? P.count : 1;
    const ring = P ? rad(P.ring * (aiming ? 1 : P.hip)) + (blind ? rad(COVER.blindSpread) * 0.5 : 0) : 0;
    let tracerHit = null;
    for (let k = 0; k < n; k++) {
      if (P) pelletDir(want, k, n, ring, dir); else inCone(want, half, dir, rand);
      // blind fire over a cover: never back into it (the view may look at the cover itself)
      if (fire?.away) {
        const q = dir.dot(fire.away) + COVER.blindAway;
        if (q > 0) dir.addScaledVector(fire.away, -q).normalize();
      }
      const hit = ballistics.trace(muzzle, dir, W.range, me);
      let killed = false;
      if (hit.target && judge) {
        const dmg = W.damage * falloff(hit.t) * multiplier(hit.zone);
        killed = hit.target.hit(hit.zone, dmg, dir.clone(), me);
        lastHit = { zone: hit.zone, killed, age: 0 };
        // through: the shot's start is behind a solid as the shooter's eyes see it (a shot through a wall or a corner)
        const through = combatLog.on && ballistics.firstArena(me.eyes(butt), muzzle) !== null;
        combatLog.add({ kind: 'hit', who: me.name, whom: hit.target.name, zone: hit.zone, dmg, hp: hit.target.hp, killed, dist: hit.t, through, pellet: P ? k : null });
      } else if (judge) {
        // task 014: a miss, or the arena in the way of a shot that would have hit (the log tells them apart)
        const would = combatLog.on && ballistics.zonesOnly(muzzle, dir, W.range, me);
        if (would && hit.normal) combatLog.add({ kind: 'blocked', who: me.name, whom: would.target.name, at: hit.t, dist: would.t, pellet: P ? k : null });
        else combatLog.add({ kind: 'miss', who: me.name, aimed: a.aimZone ?? null, pellet: P ? k : null });
      }
      if (!hit.target && hit.normal) { fx.sparks(hit.point, hit.normal); fx.mark(hit.point, hit.normal, dir); }
      if (++shots % W.tracerEvery === 0 || (P && k === 0)) tracerHit = hit.point;
      // aimed: the zone under the crosshair (null: the arena; given by the player's controller); zone: the zone the shot
      // hit (null: the arena); pellet: its number in the pattern (task 018: the sound goes with pellet 0 only)
      log.push({ angle: THREE.MathUtils.radToDeg(want.angleTo(dir)), half: THREE.MathUtils.radToDeg(P ? ring : half), aiming,
        aimed: a.aimZone ?? null, zone: hit.zone ?? null, killed, t: hit.t, target: judge ? hit.target ?? null : null, from: muzzle.clone(), dir: dir.clone(), blind,
        pending: !judge && !!hit.target,   // (task 028: a predicted shot met the other: the server's word on it comes later)
        sound: W.sound, range: W.range, pellet: P ? k : null });
      if (log.length > 400) log.shift();
    }
    fx.flash(muzzle);
    if (tracerHit) fx.tracer(muzzle, tracerHit);
    if (!quiet) onShot({ from: muzzle.clone(), shooter: me });
    mag--;
    bloom = THREE.MathUtils.clamp(bloom + W.spread.perShot, 0, W.spread.maxBloom);
    const up = rad(W.recoil.up), side = rad(W.recoil.side) * (rand() * 2 - 1);
    rise += up; recoil.pitch += up; recoil.yaw += side;
  }

  // after the animation (the rifle is in the hand): reload, fire, recoil. a: this frame's actions;
  // st: { play, frozen, cover, coverFire, dodge, healing }.
  // Returns the recoil for the view: { pitch, yaw } in radians.
  function update(dt, a, st) {
    const recoil = { pitch: 0, yaw: 0 };
    if (st.frozen) return recoil;
    raise = Math.max(0, raise - dt);
    // task 014 (U33): a solid between the shot's start and the aim point: the crosshair shows it (the HUD)
    if (a.aimAt) { shotStart(start); const t = ballistics.firstArena(start, a.aimAt); blocked = t !== null && t < start.distanceTo(a.aimAt) - WALL.aimEps; } else blocked = false;
    if (lastHit) lastHit.age += dt;

    // reload: X, or by itself when the magazine is empty; a dodge roll interrupts it (the magazine stays as it was)
    if (reload && st.dodge) reload = null;
    if (!reload && !st.dodge && mag < W.magazine && (a.reload || mag === 0)) reload = { t: 0 };
    if (reload) {
      reload.t += dt;
      if (reload.t >= W.reloadTime) { mag = W.magazine; reload = null; }
    }

    // 'semi' (task 016): one shot per press of RT, at most one per interval; a press a little too early waits for it
    if (W.mode === 'semi' && a.shoot && !held) queued = W.semiBuffer;
    const semiShot = W.mode === 'semi' && queued > 0 && cool <= 0 && !!a.aimAt && ready(st);
    const firing = (!!a.shoot || semiShot) && !!a.aimAt && ready(st);
    queued = Math.max(0, queued - dt);
    if (firing) {
      back = null;
      const fire = st.cover === 'cover' ? st.coverFire : null;
      if (W.mode === 'semi') {
        if (semiShot) { shoot(a, recoil, fire, st.quiet); cool = interval; queued = 0; }
        cool = Math.max(0, cool - dt);
      } else {
        while (cool <= 0 && mag > 0) { shoot(a, recoil, fire, st.quiet); cool += interval; }
        cool -= dt;
      }
    } else {
      cool = Math.max(0, cool - dt);
      // the series' spread goes back to its starting value only between series (while firing it would undo the
      // change per shot: 10 shots/s change it by 1.2–1.5°/s against a recovery of 4°/s)
      const step = W.spread.recover * dt;
      bloom += THREE.MathUtils.clamp(W.spread.start - bloom, -step, step);
    }
    // RT let go: the view comes back by a share of the rise
    if (wasFiring && !firing && rise > 0) { back = { left: rise * W.recoil.back, rate: rise * W.recoil.back / W.recoil.backTime }; rise = 0; }
    wasFiring = firing; held = !!a.shoot;
    if (back) {
      const step = Math.min(back.left, back.rate * dt);
      recoil.pitch -= step; back.left -= step;
      if (back.left <= 0) back = null;
    }
    return recoil;
  }

  return {
    intent, update,
    guard,   // task 014 (U33): after rifle.place(), every frame
    get blocked() { return blocked; },   // task 014 (U33): the crosshair's "blocked"
    spec: W,
    reset() { held = false; queued = 0; mag = W.magazine; reload = null; cool = 0; bloom = W.spread.start; raise = 0; rise = 0; back = null; wasFiring = false; lastHit = null; },
    get mag() { return mag; },
    // task 028 (K3): the whole state, kept and put back (the PvP window's prediction)
    save: () => ({ held, queued, mag, reload: reload && { ...reload }, cool, bloom, raise, shots, rise, back: back && { ...back }, wasFiring,
      lastHit: lastHit && { ...lastHit }, fromButt, blocked, sentShots }),
    load(s) {
      ({ held, queued, mag, cool, bloom, raise, shots, rise, wasFiring, fromButt, blocked, sentShots } = s);
      reload = s.reload && { ...s.reload }; back = s.back && { ...s.back }; lastHit = s.lastHit && { ...s.lastHit };
    },
    // the reload in progress for the animator: share done and weight (fading in and out), or null
    get reload() {
      if (!reload) return null;
      const w = Math.min(1, reload.t / W.reloadBlend, (W.reloadTime - reload.t) / W.reloadBlend);
      return { u: reload.t / W.reloadTime, w: Math.max(0, w) };
    },
    // current half-angle of the spread cone (degrees) with and without aiming, for the crosshair
    spread: aiming => (aiming ? W.spread.aim : W.spread.hip) + bloom,
    get lastHit() { return lastHit; },
    get fired() { return shots; },   // shots so far (the HUD: something happened)
    log,
    // task 027 (K1): as the PvP server sends it (with the shots fired since the last view: the window's sounds and
    // marks), and as a window shows it. sideOf(fighter) / fighterOf(side): a shot's target over the network
    view(sideOf) {
      const fresh = log.slice(log.length - Math.min(log.length, shots - sentShots)); sentShots = shots;
      return { mag, reload: reload && reload.t, bloom, raise, shots, blocked, fromButt, lastHit: lastHit && { ...lastHit },
        log: fresh.map(e => ({ ...e, from: [e.from.x, e.from.y, e.from.z], dir: [e.dir.x, e.dir.y, e.dir.z], target: e.target ? sideOf(e.target) : null })) };
    },
    show(v, fighterOf) {
      mag = v.mag; reload = v.reload === null ? null : { t: v.reload }; bloom = v.bloom; raise = v.raise;
      blocked = v.blocked; fromButt = v.fromButt; lastHit = v.lastHit;
      // (task 028: the shots and their log come with the events: heard())
      if (v.shots !== undefined) shots = v.shots;
      for (const e of v.log ?? []) {
        log.push({ ...e, from: new THREE.Vector3(...e.from), dir: new THREE.Vector3(...e.dir), target: e.target ? fighterOf(e.target) : null });
        if (log.length > 400) log.shift();
      }
    },
    // task 028 (K2): the other's shots in a PvP window, as the server's events bring them (the log, the count: the
    // sounds take the new ones). fighterOf(side): a shot's target
    heard(entries, fighterOf) {
      for (const e of entries) {
        log.push({ ...e, from: new THREE.Vector3(...e.from), dir: new THREE.Vector3(...e.dir), target: e.target ? fighterOf(e.target) : null });
        if (log.length > 400) log.shift();
      }
      shots += entries.length;
    },
    // task 028 (K3): the server's word on this window's own hits (the hit marker): lastHit from it
    confirm(hit) { lastHit = hit && { zone: hit.zone, killed: hit.killed, age: 0 }; },
    // ?freeze&pose=hud_*: the magazine and the last hit as the HUD state needs them
    freezeState({ mag: m = mag, hit = null } = {}) { mag = m; if (hit) lastHit = { zone: hit, killed: false, age: 0 }; },
    // ?freeze&pose=reload: halfway through a reload
    freezeReload() { reload = { t: W.reloadTime / 2 }; },
  };
}
