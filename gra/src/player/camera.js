// Over-the-shoulder camera (right shoulder). Aim (LT / right mouse button) moves it closer
// and narrows the view. A small sphere is swept from the character to the camera, so the
// camera moves in towards the character instead of entering a solid.
import * as THREE from 'three';
import { TPP, PLAYER } from '../data/arena.js';

const rad = THREE.MathUtils.degToRad;
const lerp = THREE.MathUtils.lerp;

export function createTppCamera(camera, physics) {
  const { RAPIER, world } = physics;
  let yaw = PLAYER.spawn.yaw, pitch = 0, aim = 0, crouch = 0;
  let shoulder = 1, shoulderAt = 1;   // 1 = right shoulder, −1 = left (task 005); shoulderAt moves towards it
  const ball = new RAPIER.Ball(TPP.collisionRadius);
  const pivot = new THREE.Vector3(), dir = new THREE.Vector3(), right = new THREE.Vector3(), want = new THREE.Vector3();

  // Task 027 (the fixed step): turn() every drawn frame (the view's turn and its blends), place() for the drawn camera
  // (the body between two steps) and for the aim inside a step (a camera of its own, at the body of that step).
  // a: actions (look stick, mouse pixels, aim); crouched: the camera lowers while the character crouches; coverSide: in
  // cover, the side the character last slid to (1 right, −1 left, 0 none): the camera goes to that shoulder
  function turn(dt, a, crouched, coverSide = 0) {
    if (a.shoulder) shoulder = -shoulder;   // right stick click / Q, at any time
    else if (coverSide) shoulder = coverSide;
    shoulderAt = THREE.MathUtils.clamp(shoulderAt + Math.sign(shoulder - shoulderAt) * 2 * dt / TPP.aimTime, -1, 1);
    if (Math.abs(shoulderAt - shoulder) < 2 * dt / TPP.aimTime) shoulderAt = shoulder;
    yaw -= rad(a.look.x * TPP.padYaw * dt + a.mouse.x * TPP.mouseDegPerPixel);
    pitch -= rad(a.look.y * TPP.padPitch * dt + a.mouse.y * TPP.mouseDegPerPixel);
    pitch = THREE.MathUtils.clamp(pitch, rad(TPP.pitchMin), rad(TPP.pitchMax));
    aim = THREE.MathUtils.clamp(aim + (a.aim ? 1 : -1) * dt / TPP.aimTime, 0, 1);
    crouch = THREE.MathUtils.clamp(crouch + (crouched ? 1 : -1) * dt / TPP.aimTime, 0, 1);
  }

  // cam: the camera to place (the drawn one, or one for the aim); feet: the character's feet; exclude: its collider
  function place(cam, feet, exclude) {
    const side = lerp(TPP.side, TPP.aim.side, aim) * shoulderAt;
    const height = lerp(lerp(TPP.height, TPP.aim.height, aim), lerp(TPP.crouchHeight, TPP.aim.crouchHeight, aim), crouch);
    const dist = lerp(TPP.distance, TPP.aim.distance, aim), fov = lerp(TPP.fov, TPP.aim.fov, aim);
    dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    pivot.set(feet.x, feet.y + height, feet.z);
    want.copy(pivot).addScaledVector(right, side).addScaledVector(dir, -dist);

    // sweep from the pivot to the wanted place; stop short of the first solid
    const vel = want.clone().sub(pivot);
    const hit = world.castShape(pivot, { x: 0, y: 0, z: 0, w: 1 }, vel, ball, 0, 1, true, undefined, undefined, exclude);
    const t = hit ? Math.max(0, hit.time_of_impact) : 1;
    cam.position.copy(pivot).addScaledVector(vel, t);
    cam.lookAt(cam.position.clone().add(dir));
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }
  // both at once (as before task 027)
  function update(dt, a, feet, exclude, crouched, coverSide = 0) { turn(dt, a, crouched, coverSide); place(camera, feet, exclude); }

  return {
    update, turn, place,
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    addYaw(d) { yaw += d; },
    // recoil (task 006): positive looks up, within the camera's limits
    addPitch(d) { pitch = THREE.MathUtils.clamp(pitch + d, rad(TPP.pitchMin), rad(TPP.pitchMax)); },
    reset(y = PLAYER.spawn.yaw) { yaw = y; pitch = 0; aim = 0; crouch = 0; },   // y: the spawn point's (task 011)
    setYaw(v) { yaw = v; },
    get shoulder() { return shoulder; },
  };
}
