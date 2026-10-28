// Chooses the heroine's animations from the character's state (task 004, as in The Division):
// cross-fades, blending of the eight aimed walk directions, body turn, spine lean while aiming.
// Walk and run clips are driven by one shared step phase, so blended clips keep their steps in time,
// and their tempo follows the speed from the physics (within HERO.speedClamp): the feet do not slide.
import * as THREE from 'three';
import { HERO, HERO_FILES } from '../data/hero.js';
import { WEAPON_HOLD as WEAPON } from '../data/combat.js';
import { ITEMS } from '../data/items.js';

const F = HERO_FILES.clips;
const SECTOR = Math.PI / 4;   // the eight directions are 45° apart
const SPINE = ['mixamorigSpine', 'mixamorigSpine1', 'mixamorigSpine2'];
const LOWER = /^mixamorig(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase|Toe_End))$/;   // the legs keep walking during a reload

// shortest signed angle from a to b
const angleTo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const clamp01 = x => Math.min(1, Math.max(0, x));

// yaw: the view's yaw at the start (task 009: the fighter's, not only the camera's); the body starts facing the same way
export function createAnimator(hero, yaw) {
  const { root, model, mixer, clips } = hero;
  const [slowest, fastest] = HERO.speedClamp;
  const all = Object.keys(clips);
  const weight = Object.fromEntries(all.map(k => [k, 0]));
  const spine = SPINE.map(n => model.getObjectByName(n));
  const target = {};
  let bodyYaw = yaw + Math.PI, phase = 0, aimLean = 0, moveWeight = 0, first = true;

  // reload (task 006) over the running animation: each bone's rotation is sampled from the reload clip and the
  // bone is blended from the running pose towards it (sampled directly: a second AnimationMixer skips writing a
  // value it wrote the frame before, which the main mixer has overwritten since). Upper body fully; the legs only
  // while standing still (moving, the legs keep walking, as in The Division: Paweł, 28.09.2026)
  const reloadPose = (file, slice) => ({
    slice,
    tracks: hero.extraClips[file].tracks.map(t => ({ bone: model.getObjectByName(t.name.split('.')[0]), at: t.createInterpolant() }))
      .filter(t => t.bone).map(t => ({ ...t, lower: LOWER.test(t.bone.name) })),
  });
  const reloads = { stand: reloadPose(HERO_FILES.reload.stand, WEAPON.reloadClip), crouch: reloadPose(HERO_FILES.reload.crouch, WEAPON.reloadClipCrouch) };
  const qReload = new THREE.Quaternion();
  // task 017: the grenade's throw over the upper body, the same way (ITEMS.grenade.clip.slice)
  const throwPose = HERO_FILES.throwClip ? reloadPose(HERO_FILES.throwClip, ITEMS.grenade.clip.slice) : null;   // task 023: frozen grenade, no clip
  function reloadOver(r, crouched, pose = null) {
    const { slice, tracks } = pose ?? (crouched ? reloads.crouch : reloads.stand);
    const time = slice[0] + r.u * (slice[1] - slice[0]);
    tracks.forEach(t => {
      qReload.fromArray(t.at.evaluate(time));
      t.bone.quaternion.slerp(qReload, t.lower ? r.w * (1 - moveWeight) : r.w);
    });
  }

  // crouching poses stand HERO.crouchLift higher (task 007): the hips' offset in their parent's units
  const hips = model.getObjectByName('mixamorigHips');
  const liftUnits = HERO.crouchLift / hips.parent.getWorldScale(new THREE.Vector3()).y;
  // each clip once: walkCrouch is also the first aimed crouching direction (audit 007)
  const CROUCHED = [...new Set([F.idleCrouch, F.idleCrouchAim, F.walkCrouch, ...HERO_FILES.aimWalkCrouch])];

  // add weight w to a clip in this frame's target
  const want = (file, w) => { if (w > 0) target[file] = (target[file] || 0) + w; };

  // the eight aimed directions: two neighbours of the angle, mixed in proportion to it
  function directions(files, angle, w) {
    const x = ((angle / SECTOR) % 8 + 8) % 8, k = Math.floor(x), f = x - k;
    want(files[k], w * (1 - f)); want(files[(k + 1) % 8], w * f);
  }

  // idle and walk/run clips mixed by speed: below the mix's slowest tempo the idle takes over part of the weight;
  // one step phase for all walk and run clips, each clip's tempo keeps the feet on the floor
  function locomotion(idle, move, speed, dt, frozen, top = fastest) {
    let natural = 0;
    for (const k in move) natural += move[k] * clips[k].speed;
    moveWeight = clamp01(speed / (slowest * natural));
    want(idle, 1 - moveWeight);
    for (const k in move) want(k, move[k] * moveWeight);
    if (frozen) return;
    let rate = 0;
    for (const k in move) rate += move[k] * THREE.MathUtils.clamp(speed / clips[k].speed, slowest, top) / clips[k].duration;
    phase = (phase + rate * dt) % 1;
  }
  // a clip played as a slice (roll, cover entry, vault) at share u of it
  function slice(k, u) {
    const [a, b] = clips[k].slice;
    want(k, 1); clips[k].action.time = a + u * (b - a);
  }
  const turnTo = (facing, dt) => {
    const turn = THREE.MathUtils.degToRad(HERO.turnRate) * dt, left = angleTo(bodyYaw, facing);
    bodyYaw += Math.abs(left) <= turn ? left : Math.sign(left) * turn;
  };

  // s: { feet, speed (Vector2, m/s over the floor), intent (Vector2, velocity asked by the stick; zero once stopped),
  //      crouched, aiming, sprinting, dash (the run to cover, task 007), dodge: { u, dir } | null,
  //      yaw, pitch (camera), turnDelta (turntable turn carrying the character this frame), frozen,
  //      cover: from cover.js: { kind: 'enter' | 'vault', clip, u, yaw } | { kind: 'cover', yaw, slide } | null,
  //      reload (task 006): { u (share of the reload done), w (its weight, fading in and out) } | null,
  //      react (task 009): { clip (a reaction's file: the hit or a death), t (s into it) } | null: the whole body plays it,
//      throwOver (task 017): { u, w } | null: the grenade's throw over the upper body }
  function update(dt, s) {
    for (const k in target) delete target[k];
    const speed = s.speed.length();
    const cameraFront = s.yaw + Math.PI;   // the model faces +Z; camera yaw 0 faces −Z
    bodyYaw += s.turnDelta;

    moveWeight = 0;   // share of walk/run clips in this frame
    const cov = s.cover;
    if (s.react) {
      // a reaction (the hit of the Dummy level, a death) takes the whole body; its time is the fighter's
      want(s.react.clip, 1); clips[s.react.clip].action.time = Math.min(s.react.t, clips[s.react.clip].duration);
    } else if (s.dodge) {
      // the roll turns straight into its direction and plays its slice in exactly the dodge time
      bodyYaw = Math.atan2(s.dodge.dir.x, s.dodge.dir.y);
      slice(F.roll, s.dodge.u);
    } else if (cov && cov.kind !== 'cover') {
      // cover entry and vault: straight into their direction, the slice in exactly their time; the vault lands
      // facing forwards (task 007)
      bodyYaw = cov.yaw;
      slice(cov.clip, cov.u);
    } else if (cov) {
      // in cover, the back to the wall: idle, or the sneak clip of the side the character slides to
      // (slide: m/s towards the model's left, +X of the sneak clips). Task 015: low cover crouched (the crouched walk
      // to the side: index 2 of the eight directions is right, 6 left)
      turnTo(cov.yaw, dt);
      const W = HERO_FILES.aimWalkCrouch;
      if (cov.low) locomotion(F.idleCrouch, { [cov.slide > 0 ? W[6] : W[2]]: 1 }, Math.abs(cov.slide), dt, s.frozen, HERO.coverTempo);
      else locomotion(F.coverIdle, { [cov.slide > 0 ? F.sneakLeft : F.sneakRight]: 1 }, Math.abs(cov.slide), dt, s.frozen, HERO.coverTempo);
    } else {
      // body: towards the camera while aiming, towards the movement asked by the stick otherwise (not the measured one,
      // which trembles slightly while standing); standing, it stays put. U46 (Paweł 01.10.2026: the feet slid along the
      // panels): once it really moves faster than HERO.followMoved, towards the real movement (a wall in the way turns
      // the stick's walk into a slide along it: the steps go where the body goes)
      const moving = s.intent.lengthSq() > 0, real = s.speed.length() > HERO.followMoved;
      const facing = real ? Math.atan2(s.speed.x, s.speed.y) : Math.atan2(s.intent.x, s.intent.y);
      turnTo(s.aiming ? cameraFront : moving ? facing : bodyYaw, dt);

      const idle = s.crouched ? (s.aiming ? F.idleCrouchAim : F.idleCrouch) : (s.aiming ? F.idleAim : F.idle);
      const move = {};
      if (s.aiming) {
        // direction of the movement relative to the body's front, clockwise (to the right) positive
        const rel = angleTo(Math.atan2(s.speed.x, s.speed.y), bodyYaw);
        directions(s.crouched ? HERO_FILES.aimWalkCrouch : HERO_FILES.aimWalk, rel, 1);
      } else if (s.crouched) want(F.walkCrouch, 1);
      else if (s.sprinting || s.dash) want(F.sprint, 1);   // the run to cover is a sprint, as in The Division
      else {
        // light stick push: walk; faster: run (as in The Division)
        const r = clamp01((speed - HERO.walkRun.from) / (HERO.walkRun.to - HERO.walkRun.from));
        want(F.walk, 1 - r); want(F.run, r);
      }
      Object.assign(move, target);
      for (const k in target) delete target[k];
      locomotion(idle, move, speed, dt, s.frozen);
    }

    // cross-fade: every weight moves towards its target in HERO.fade (at once in ?freeze and on the first frame)
    const step = s.frozen || first ? 1 : dt / HERO.fade;
    let total = 0;
    all.forEach(k => {
      const d = (target[k] || 0) - weight[k];
      weight[k] += Math.abs(d) <= step ? d : Math.sign(d) * step;
      total += weight[k];
    });
    all.forEach(k => {
      const c = clips[k], a = c.action;
      a.setEffectiveWeight(total > 0 ? weight[k] / total : 0);
      if (c.moving) { a.timeScale = 0; a.time = ((phase + c.lead) % 1) * c.duration; }
      else if (c.slice || c.manual) a.timeScale = 0;
      else if (s.frozen) { a.timeScale = 0; a.time = 0; }
      else a.timeScale = 1;
    });
    first = false;

    root.position.copy(s.feet);
    root.rotation.y = bodyYaw;
    mixer.update(s.frozen ? 0 : dt);
    const crouchW = Math.min(1, CROUCHED.reduce((w, k) => w + (total > 0 ? weight[k] / total : 0), 0));
    if (crouchW > 0) hips.position.y += liftUnits * crouchW;
    const reloadW = s.reload && !s.dodge && !s.react ? s.reload.w : 0;
    if (reloadW > 0) reloadOver({ u: s.reload.u, w: reloadW }, s.crouched);
    // task 017: throwOver { u (share of the throw), w (its weight, fading in and out) }
    if (s.throwOver && throwPose && !s.dodge && !s.react) reloadOver(s.throwOver, s.crouched, throwPose);

    // spine lean while aiming, after the animation: arms follow the crosshair up and down (less while reloading)
    const aimStep = s.frozen ? 1 : dt / HERO.fade;
    aimLean += THREE.MathUtils.clamp((s.aiming && !s.dodge && !cov && !s.react ? 1 : 0) - aimLean, -aimStep, aimStep);
    if (aimLean > 0) lean(aimLean * (1 - reloadW) * HERO.aimSpine * s.pitch, cameraFront);
  }

  // turn the three spine bones in the vertical plane of the camera, equal parts; positive looks up
  const axis = new THREE.Vector3(), qAdd = new THREE.Quaternion(), qParent = new THREE.Quaternion();
  function lean(angle, front) {
    axis.set(-Math.cos(front), 0, Math.sin(front));   // the camera's right: rotation about it tilts the front up
    root.updateMatrixWorld(true);
    spine.forEach(bone => {
      bone.parent.getWorldQuaternion(qParent);
      qAdd.setFromAxisAngle(axis, angle / spine.length);
      // local = parentWorld⁻¹ · add · parentWorld · local
      bone.quaternion.premultiply(qParent.clone().invert().multiply(qAdd).multiply(qParent));
      bone.updateMatrixWorld(true);
    });
  }

  return {
    update,
    // back at a spawn point (task 009: a new round): the body faces the view's yaw, the next frame without cross-fades
    reset(y) { bodyYaw = y + Math.PI; first = true; },
    get bodyYaw() { return bodyYaw; },
    get moveWeight() { return moveWeight; },
    get phase() { return phase; },   // the step phase (task 010: a foot lands at 0 and ½, the steps' sounds)
  };
}
