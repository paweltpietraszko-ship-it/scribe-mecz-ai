// A character's capsule (task 009: the heroine's and the Double's): Rapier kinematic character controller.
// Walk, sprint, crouch, dodge, and riding the turntable (position and view turn with the disc).
// What is seen is the body (hero.js, animator.js); this file only moves the capsule.
import * as THREE from 'three';
import { PLAYER, TURNTABLE } from '../data/arena.js';

const P = PLAYER;
const halfHeight = h => h / 2 - P.radius;   // capsule: 2·halfHeight + 2·radius = total height

// rollShape(u): share of the dodge distance covered at share u of the dodge time (from the roll animation)
// spawn: { x, z } where it starts and comes back to; onReset: called when the character goes back to the spawn point
// (task 006: health and medkits come back)
export function createCharacter(physics, rollShape, { spawn = P.spawn, onReset = () => {} } = {}) {
  const { RAPIER, world } = physics;
  const ctrl = world.createCharacterController(P.skin);
  ctrl.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(P.maxSlope));
  ctrl.enableAutostep(P.step, P.radius, false);
  ctrl.enableSnapToGround(P.snapToGround);
  ctrl.setSlideEnabled(true);

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
  let collider = null, crouched = false, shapeH = 0;
  const feet = new THREE.Vector3(spawn.x, 0, spawn.z);

  function setShape(h) {
    if (collider) world.removeCollider(collider, false);
    collider = world.createCollider(RAPIER.ColliderDesc.capsule(halfHeight(h), P.radius).setTranslation(0, h / 2, 0), body);
    shapeH = h;
  }
  body.setTranslation(feet, true); setShape(P.height);

  // can the standing capsule fit where the character is now?
  function roomToStand() {
    let blocked = false;
    const shape = new RAPIER.Capsule(halfHeight(P.height), P.radius - P.skin);
    world.intersectionsWithShape({ x: feet.x, y: feet.y + P.height / 2 + P.skin, z: feet.z }, { x: 0, y: 0, z: 0, w: 1 }, shape,
      () => { blocked = true; return false; }, undefined, undefined, collider);
    return !blocked;
  }

  const vel = new THREE.Vector2();     // horizontal velocity (x, z)
  const speed = new THREE.Vector2();   // how fast the character really moved over the floor (m/s), for the animations
  let vy = 0, riding = false, grounded = true, sprinting = false, aiming = false;
  let dodge = null, cooldown = 0;
  const [TX, TZ] = TURNTABLE.center;

  // stand up only where the standing capsule fits
  function setCrouch(v) { if (v) crouched = true; else if (crouched && roomToStand()) crouched = false; }

  // a: the fighter's actions (fighter/actions.js); yaw: the view's yaw (0 = facing −Z); turnDelta: turntable rotation this frame;
  // drive (cover.js, task 005): { move (Vector2, metres this frame), crouch, ignore (collider passed through) } or null
  function update(dt, a, yaw, turnDelta, drive = null) {
    // direction helpers relative to the camera
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const wish = new THREE.Vector2(rx * a.move.x + fx * a.move.y, rz * a.move.x + fz * a.move.y);
    const wishLen = Math.min(1, wish.length());

    // crouch: toggle; sprint stands up (as in The Division). In cover the cover decides.
    if (drive) setCrouch(drive.crouch);
    else if (a.crouch && !dodge) setCrouch(!crouched);
    // aiming stops the sprint; so does a medkit (a.slow, task 006), which walks at the aiming pace
    sprinting = a.sprint && !a.aim && !a.slow && wishLen > 0 && !dodge && !drive;
    aiming = !!a.aim;
    if (sprinting && crouched && roomToStand()) crouched = false;
    const wantShape = crouched ? P.crouchHeight : P.height;
    if (shapeH !== wantShape) setShape(wantShape);

    // dodge: fixed distance and time, no steering; direction from the stick, else backwards
    cooldown = Math.max(0, cooldown - dt);
    if (a.dodge && !dodge && !drive && cooldown === 0 && grounded) {
      const d = wishLen > 0 ? wish.clone().normalize() : new THREE.Vector2(-fx, -fz);
      dodge = { t: 0, dir: d };
    }

    const move = new THREE.Vector3();
    if (drive) {
      // cover: the cover says where to go this frame; the body turns towards that movement
      move.set(drive.move.x, 0, drive.move.y);
      if (dt > 0) vel.set(drive.move.x / dt, drive.move.y / dt);
    } else if (dodge) {
      // the distance follows the shape of the roll animation, so hands and feet meet the floor
      const u0 = dodge.t / P.dodge.time, u1 = Math.min(1, (dodge.t + dt) / P.dodge.time);
      const d = P.dodge.distance * (rollShape(u1) - rollShape(u0));
      move.set(dodge.dir.x * d, 0, dodge.dir.y * d);
      dodge.t += dt;
      vel.set(0, 0);
      if (dodge.t >= P.dodge.time) { dodge = null; cooldown = P.dodge.cooldown; }
    } else {
      // aiming walks slower, as in The Division (task 004); crouched it stays at crouch speed
      const top = crouched ? P.crouchSpeed : sprinting ? P.sprintSpeed : aiming || a.slow ? P.aimSpeed : P.speed;
      const target = wish.clone().multiplyScalar(top * wishLen / (wish.length() || 1));
      // accelerate to full speed in accelTime, brake to a stop in brakeTime
      const rate = (target.lengthSq() >= vel.lengthSq() ? top / P.accelTime : Math.max(top, vel.length()) / P.brakeTime) * dt;
      const diff = target.clone().sub(vel);
      if (diff.length() <= rate) vel.copy(target); else vel.add(diff.multiplyScalar(rate / diff.length()));
      move.set(vel.x * dt, 0, vel.y * dt);
    }

    const own = { x: move.x, z: move.z };   // the character's own move, without the disc
    // riding: the disc carries the character around its centre
    if (riding && turnDelta) {
      const c = Math.cos(turnDelta), s = Math.sin(turnDelta), x = feet.x - TX, z = feet.z - TZ;
      move.x += TX + c * x + s * z - feet.x; move.z += TZ - s * x + c * z - feet.z;
    }

    vy = grounded ? -P.gravity * dt : vy - P.gravity * dt;
    move.y = vy * dt;

    // a vault passes over the cover it vaults (its collider is left out this frame)
    const skip = drive?.ignore;
    if (skip) ctrl.computeColliderMovement(collider, move, undefined, undefined, c => c.handle !== skip.handle);
    else ctrl.computeColliderMovement(collider, move);
    const m = ctrl.computedMovement();
    grounded = ctrl.computedGrounded();
    feet.set(feet.x + m.x, feet.y + m.y, feet.z + m.z);
    // real speed over the floor: the computed move without the disc's share (a wall cuts it down)
    const ride = { x: move.x - own.x, z: move.z - own.z };
    if (dt > 0) speed.set((m.x - ride.x) / dt, (m.z - ride.z) / dt);
    if (feet.y < -1) { feet.set(spawn.x, 0, spawn.z); onReset(); }   // safety net, should never happen
    body.setNextKinematicTranslation(feet);

    // standing on the disc? (the capsule's axis is over it)
    riding = physics.onDisc(feet);
  }

  return {
    update,
    get feet() { return feet; },
    get speed() { return speed; },
    get intent() { return vel; },   // the velocity the stick asks for (zero once stopped): where the body turns
    get sprinting() { return sprinting; },
    get aiming() { return aiming; },
    // the dodge in progress: share of its time done (0..1) and direction (x, z), or null
    get dodge() { return dodge && { u: Math.min(1, dodge.t / P.dodge.time), dir: dodge.dir }; },
    get riding() { return riding; },
    get crouched() { return crouched; },
    get collider() { return collider; },
    get height() { return crouched ? P.crouchHeight : P.height; },
    setCrouch,
    setSpawn(s) { spawn = s; },
    // ?freeze&pose=crouch: crouched from the start, for screenshots
    crouch() { crouched = true; setShape(P.crouchHeight); },
    // ?freeze&pose=cover_*: put the character at (x, z) on the floor
    place(x, z) { feet.set(x, 0, z); vel.set(0, 0); vy = 0; body.setTranslation(feet, true); },
    reset() {
      feet.set(spawn.x, 0, spawn.z); vel.set(0, 0); speed.set(0, 0); vy = 0; dodge = null; cooldown = 0; sprinting = aiming = false;
      if (crouched) { crouched = false; setShape(P.height); }
      body.setTranslation(feet, true); onReset();
    },
    // dead (task 009): the capsule is off, nothing stops on the body or hides behind it
    setSolid(v) { collider.setEnabled(v); },
    // task 027 (K1): the capsule as the PvP server sends it, and as a window shows it (no movement of its own there)
    view: () => ({ f: [feet.x, feet.y, feet.z], cr: crouched, sp: sprinting, ai: aiming, spd: [speed.x, speed.y], v: [vel.x, vel.y],
      dg: dodge && { t: dodge.t, dir: [dodge.dir.x, dodge.dir.y] }, rd: riding, solid: collider.isEnabled(), vy, cool: cooldown }),
    // task 028 (K3): the whole state, kept and put back (the PvP window's prediction goes back to a step it took)
    save: () => ({ feet: feet.clone(), vel: vel.clone(), speed: speed.clone(), vy, riding, grounded, sprinting, aiming, crouched,
      dodge: dodge && { t: dodge.t, dir: dodge.dir.clone() }, cooldown, solid: collider.isEnabled() }),
    load(s) {
      feet.copy(s.feet); vel.copy(s.vel); speed.copy(s.speed);
      ({ vy, riding, grounded, sprinting, aiming, crouched, cooldown } = s);
      dodge = s.dodge && { t: s.dodge.t, dir: s.dodge.dir.clone() };
      const want = crouched ? P.crouchHeight : P.height;
      if (shapeH !== want) setShape(want);
      if (collider.isEnabled() !== s.solid) collider.setEnabled(s.solid);
      // (the body's next place too: the last step's would pull it back at the physics' next step; the capsule's own
      // place follows only at a physics step: physics.refresh() after loading, net/own.js)
      body.setTranslation(feet, true); body.setNextKinematicTranslation(feet);
    },
    show(v) {
      feet.set(...v.f); body.setTranslation(feet, true);
      crouched = v.cr; const want = crouched ? P.crouchHeight : P.height; if (shapeH !== want) setShape(want);
      sprinting = v.sp; aiming = v.ai; speed.set(...v.spd); vel.set(...v.v); riding = v.rd;
      dodge = v.dg && { t: v.dg.t, dir: new THREE.Vector2(...v.dg.dir) };
      if (v.vy !== undefined) vy = v.vy;
      if (v.cool !== undefined) cooldown = v.cool;
      if (collider.isEnabled() !== v.solid) collider.setEnabled(v.solid);
    },
  };
}
