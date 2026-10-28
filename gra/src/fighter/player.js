// The player's controller (task 009): the pad, the mouse and the keyboard (player/input.js) and the over-the-shoulder
// camera (player/camera.js) turned into the fighter's actions (fighter/actions.js). The fighter never sees the camera:
// the view's yaw and pitch, the aim point under the crosshair and the cover under it come to it as world values.
// Task 027 (the fixed step, sim/clock.js): every drawn frame sample() reads the input and turn() turns the view; every
// step of the fight poll() makes the action (one-frame commands pressed since the last step are kept for it, so none
// is lost at 120 frames a second nor done twice at 30), aim() after the physics puts the point under the crosshair in
// it (from a camera of its own at the body of this step), recoil() after the fighter acted; place() puts the drawn
// camera at the body as drawn (between two steps).
import * as THREE from 'three';
import { idleAction } from './actions.js';

// the input's one-frame commands that a step takes (the shoulder and the menu act at once, in the drawn frame)
const ONCE = ['dodge', 'crouch', 'medkit', 'reload', 'cover', 'sprintClick', 'cancel'];

// input: createInput(); tpp: createTppCamera(); camera: the three.js camera; fighter: the heroine; ballistics
export function createPlayerControl({ input, tpp, camera, fighter, ballistics }) {
  let a = idleAction(tpp.yaw, tpp.pitch), raw = null, aimed = null;
  const kept = Object.fromEntries(ONCE.map(k => [k, false]));
  const cam = new THREE.Vector3(), look = new THREE.Vector3(), chest = new THREE.Vector3();
  const aimCam = new THREE.PerspectiveCamera();   // the camera as it is at the body of this step (the aim)

  // every drawn frame. now: the clock (s); aimPose: a ?freeze pose that aims. Returns { menu }.
  function sample(now, { aimPose = false } = {}) {
    raw = input.poll(now);
    if (aimPose) raw.aim = true;
    for (const k of ONCE) kept[k] ||= raw[k];
    return { menu: raw.menu };
  }

  // every drawn frame: the view turns (the stick, the mouse, the aim's and crouch's blends, the shoulder)
  // hold (task 022): the start screen and the match's result: the camera does not turn (the stick chooses there)
  function turn(dt, { play, hold = false }) {
    if (!play || !raw) return;
    const f = fighter, still = f.alive && !hold ? raw : { ...raw, look: { x: 0, y: 0 }, mouse: { x: 0, y: 0 }, aim: false, shoulder: false };
    tpp.turn(dt, still, f.character.crouched, f.coverState.shoulder);
  }

  // one step: the action. play: the Play view; pose: a ?freeze pose keeps its input state in the preview views too
  // (task 007); turnDelta: the disc turned the view with it
  function poll({ play, pose, turnDelta }) {
    const on = (play || pose) && fighter.alive && raw;
    if (play && fighter.character.riding && turnDelta) tpp.addYaw(turnDelta);
    a = idleAction(tpp.yaw, tpp.pitch);
    if (on) {
      Object.assign(a, { move: raw.move, aim: raw.aim, shoot: raw.shoot, sprint: raw.sprint, grenade: raw.grenade, key: raw.key });
      for (const k of ONCE) { a[k] = kept[k]; kept[k] = false; }
      // task 017: B while an item is held drops it, and does nothing else
      if (fighter.items?.holding && a.cancel) { a.dodge = false; a.crouch = false; }
      // the cover under the camera (the camera is where the last frame left it, as in task 005)
      camera.getWorldPosition(cam); camera.getWorldDirection(look);
      a.coverTarget = fighter.cover.targetFrom(cam, look, fighter.feet, fighter.collider);
      a.blind = raw.shoot && !raw.aim && fighter.cover.mode === 'cover';   // task 015: RT without LT in cover
      a.rise = raw.aim && fighter.cover.mode === 'cover' && !!fighter.cover.line?.crouch;   // LT at low cover
    }
    return a;
  }

  // after the fighter moved: a shot ends the pad's sprint (task 006)
  function moved(r) { if (r.firing) input.cancelSprint(); }

  // after the physics of a step: the view's yaw and pitch and the point under the crosshair (a ray from the camera
  // placed at this step's body; it starts counting at the chest, so nothing between the camera and the character is
  // aimed at)
  function aim() {
    const f = fighter;
    tpp.place(aimCam, f.feet, f.collider);
    a.yaw = tpp.yaw; a.pitch = tpp.pitch;
    chest.set(f.feet.x, f.feet.y + f.character.height * 0.7, f.feet.z);
    aimCam.getWorldPosition(cam); aimCam.getWorldDirection(look);
    const start = Math.max(0, chest.clone().sub(cam).dot(look));
    const seen = ballistics.trace(cam.clone().addScaledVector(look, start), look, f.weapon.spec.range, f);
    a.aimAt = seen.point; a.aimZone = seen.zone ?? null;
    a.itemAt = seen.point;   // task 017: the item held aims where the crosshair is
    aimed = seen.target;
  }

  // the drawn camera at the body as drawn (feet: between the last two steps)
  function place(feet) { tpp.place(camera, feet, fighter.collider); }

  // the rifle's recoil moves the camera, and so the view
  function recoil(r) { tpp.addPitch(r.pitch); tpp.addYaw(r.yaw); }

  return {
    sample, turn, poll, moved, aim, place, recoil,
    get action() { return a; },
    get input() { return raw; },
    get aimed() { return aimed; },   // the fighter under the crosshair now (the HUD's bar over it), or null
  };
}
