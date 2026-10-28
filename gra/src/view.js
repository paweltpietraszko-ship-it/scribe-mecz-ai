// Views. "play": the over-the-shoulder camera drives the camera (player/camera.js) and the orbit is off.
// Preset views (CAMERA.views): free orbit camera (drag to orbit, wheel to zoom) with smooth moves.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CAMERA } from './data/arena.js';
import { ease } from './arena/motion.js';

export const PLAY = 'play', WELCOME = 'welcome';

export function createView(camera, dom) {
  const controls = new OrbitControls(camera, dom);
  controls.enableDamping = true;
  Object.assign(controls, CAMERA.orbit);

  let move = null, current = null;
  const listeners = [];

  // key: 'play' or one of CAMERA.views; listeners hear which view was chosen
  function go(key, instant) {
    const leavingPlay = current === PLAY && key !== PLAY;
    current = key;
    controls.enabled = key !== PLAY && key !== WELCOME;   // task 022: the welcome screen's camera stands
    if (key === PLAY) move = null;
    else {
      if (leavingPlay) {
        // continue orbiting around what the player was looking at, with the preset field of view
        controls.target.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(5));
        camera.fov = CAMERA.fov; camera.updateProjectionMatrix();
      }
      look(...CAMERA.views[key], instant);
    }
    listeners.forEach(f => f(key));
  }

  // move to any [x,y,z] position looking at [x,y,z]
  function look(pos, target, instant) {
    const p = new THREE.Vector3(...pos), t = new THREE.Vector3(...target);
    if (instant) { camera.position.copy(p); controls.target.copy(t); controls.update(); move = null; return; }
    move = { t: 0, p0: camera.position.clone(), t0: controls.target.clone(), p1: p, t1: t };
  }

  function update(dt) {
    if (current === PLAY) return;
    if (move) {
      move.t = Math.min(1, move.t + dt / CAMERA.moveTime); const e = ease(move.t);
      camera.position.lerpVectors(move.p0, move.p1, e); controls.target.lerpVectors(move.t0, move.t1, e);
      if (move.t >= 1) move = null;
    }
    controls.update();
  }

  const onChange = f => { listeners.push(f); f(current); };
  go(CAMERA.start, true);
  return { go, look, update, onChange, get current() { return current; }, views: [PLAY, ...Object.keys(CAMERA.views).filter(k => k !== WELCOME)] };
}
