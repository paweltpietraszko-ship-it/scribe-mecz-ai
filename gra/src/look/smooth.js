// Task 027 (K2): drawing between two steps of the fight. The fight moves things only in whole steps (1/60 s); a frame
// drawn between two steps shows them between their places before and after the last step (alpha of sim/clock.js), so
// the picture is smooth at 120 frames a second. Only for the drawing: apply() before it, restore() right after, the
// fight always finds the true places. list(): the objects moved by the fight (the bodies' roots, the rifles, the
// moving panel, the turntable, SCRIBE's elements).
import * as THREE from 'three';

// (the turn kept as the fight set it, an angle: put back through the quaternion it would come back changed in its
// last bit, and the next step would differ from one drawn otherwise: task 027, K8)
const save = (o, s = {}) => {
  (s.p ??= new THREE.Vector3()).copy(o.position); (s.q ??= new THREE.Quaternion()).copy(o.quaternion); (s.s ??= new THREE.Vector3()).copy(o.scale);
  (s.r ??= new THREE.Euler()).copy(o.rotation);
  return s;
};
const put = (o, s) => { o.position.copy(s.p); o.rotation.copy(s.r); o.scale.copy(s.s); };

export function createSmoothing(list) {
  const before = new Map(), now = new Map();
  return {
    // before a step: where everything is (after the step it may be elsewhere)
    capture() { for (const o of list()) before.set(o, save(o, before.get(o))); },
    // for the drawing: each object between its place before the last step and its place now
    apply(alpha) {
      for (const o of list()) {
        const b = before.get(o);
        if (!b) continue;
        const n = save(o, now.get(o)); now.set(o, n);
        o.position.lerpVectors(b.p, n.p, alpha); o.quaternion.slerpQuaternions(b.q, n.q, alpha); o.scale.lerpVectors(b.s, n.s, alpha);
      }
    },
    restore() { for (const [o, n] of now) put(o, n); now.clear(); },
    forget() { before.clear(); now.clear(); },   // (a jump: a reset, a new round: no smoothing across it)
  };
}
