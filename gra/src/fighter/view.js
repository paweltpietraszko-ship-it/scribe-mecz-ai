// Task 027 (K1): a fighter's pose record (fighter.js: the animation's input, the rifle raised or not, the arms' grip)
// in plain numbers for the network, and back: the vectors the animation reads (the feet, the speed and the intent over
// the floor, the dodge's direction) become three.js vectors again in the PvP window.
import * as THREE from 'three';

const v2 = v => [v.x, v.y], v3 = v => [v.x, v.y, v.z];

export function packPose(P) {
  const A = P.anim;
  return { ...P, anim: { ...A, feet: v3(A.feet), speed: v2(A.speed), intent: v2(A.intent), dodge: A.dodge && { u: A.dodge.u, dir: v2(A.dodge.dir) } } };
}

export function unpackPose(P) {
  const A = P.anim;
  return { ...P, anim: { ...A, feet: new THREE.Vector3(...A.feet), speed: new THREE.Vector2(...A.speed), intent: new THREE.Vector2(...A.intent),
    dodge: A.dodge && { u: A.dodge.u, dir: new THREE.Vector2(...A.dodge.dir) } } };
}
