// Two-bone IK of the arms (task 007): upper arm, forearm and hand, solved analytically after the animation (and the
// spine lean of task 004) every frame. The left hand goes to the rifle's front grip; the right hand follows the rifle
// when it is raised to the eye (while it hangs from the right hand, the right arm keeps its animation). The elbow bends
// towards a hint point below and to the side of it (IK.elbowHint). Each arm's IK fades in and out over IK.blend.
import * as THREE from 'three';
import { IK } from '../data/hero.js';

const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), dir = new THREE.Vector3();
const side = new THREE.Vector3(), elbow = new THREE.Vector3(), from = new THREE.Vector3(), to = new THREE.Vector3();
const q = new THREE.Quaternion(), qParent = new THREE.Quaternion(), qBone = new THREE.Quaternion();

// turn a bone in world space so that its direction `f` becomes `t` (both from the bone's own position)
function turnWorld(bone, f, t) {
  q.setFromUnitVectors(f.normalize(), t.normalize());
  bone.getWorldQuaternion(qBone); bone.parent.getWorldQuaternion(qParent);
  bone.quaternion.copy(qParent.invert().multiply(q).multiply(qBone));
  bone.updateMatrixWorld(true);
}

// Put `end` (the hand bone) at `target` by turning `upper` and `lower`; the elbow bends towards `hint`.
// Out of reach, the arm stretches towards the target.
function solve(upper, lower, end, target, hint) {
  upper.getWorldPosition(a); lower.getWorldPosition(b); end.getWorldPosition(c);
  const l1 = a.distanceTo(b), l2 = b.distanceTo(c);
  const d = THREE.MathUtils.clamp(a.distanceTo(target), Math.abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4);
  dir.copy(target).sub(a).normalize();
  // the elbow lies in the plane of the shoulder, the target and the hint
  side.copy(hint).sub(a).addScaledVector(dir, -hint.clone().sub(a).dot(dir));
  if (side.lengthSq() < 1e-8) side.copy(b).sub(a).addScaledVector(dir, -b.clone().sub(a).dot(dir));
  side.normalize();
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), sin = Math.sqrt(Math.max(0, 1 - cos * cos));
  elbow.copy(a).addScaledVector(dir, l1 * cos).addScaledVector(side, l1 * sin);
  turnWorld(upper, from.copy(b).sub(a), to.copy(elbow).sub(a));
  lower.getWorldPosition(b); end.getWorldPosition(c);
  turnWorld(lower, from.copy(c).sub(b), to.copy(a).addScaledVector(dir, d).sub(b));
}

// model: a character's model (the heroine or the dummy); root: the group that turns with its body
export function createArmsIK(model, root) {
  const bone = n => model.getObjectByName('mixamorig' + n);
  const arm = s => ({
    upper: bone(s + 'Arm'), lower: bone(s + 'ForeArm'), hand: bone(s + 'Hand'), middle: bone(s + 'HandMiddle1'),
    out: s === 'Left' ? 1 : -1,   // the body's left is +X of the model (it faces +Z)
    w: 0, saved: [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()],
  });
  const L = arm('Left'), R = arm('Right');
  const hint = new THREE.Vector3(), outDir = new THREE.Vector3(), palm = new THREE.Vector3(), wrist = new THREE.Vector3();
  const target = new THREE.Vector3(), qHand = new THREE.Quaternion(), qRoot = new THREE.Quaternion();

  // one arm to the wanted weight, then solved and blended with its animated pose by that weight.
  // at: where the palm (between the wrist and the middle finger's base) goes, or the wrist itself when `atWrist`;
  // handQuat: the hand's world rotation to take (the right hand on the pistol grip), or null to keep the animated one
  function reach(s, want, dt, at, handQuat, atWrist = false) {
    const step = dt === null ? 1 : dt / IK.blend;
    s.w += THREE.MathUtils.clamp(want - s.w, -step, step);
    if (s.w <= 0) return;
    const bones = [s.upper, s.lower, s.hand], isWrist = atWrist;
    bones.forEach((bn, i) => s.saved[i].copy(bn.quaternion));
    root.getWorldQuaternion(qRoot);
    s.lower.getWorldPosition(hint);
    hint.y -= IK.elbowHint.down;
    hint.addScaledVector(outDir.set(s.out, 0, 0).applyQuaternion(qRoot), IK.elbowHint.out);
    // two rounds: the wrist target depends on the hand's turn, which the solve changes a little
    for (let round = 0; round < 2; round++) {
      if (handQuat) setWorldQuat(s.hand, handQuat);
      s.hand.getWorldPosition(wrist); s.middle.getWorldPosition(palm);
      palm.add(wrist).multiplyScalar(0.5);
      target.copy(at); if (!isWrist) target.sub(palm).add(wrist);
      solve(s.upper, s.lower, s.hand, target, hint);
    }
    if (handQuat) setWorldQuat(s.hand, handQuat);
    if (s.w < 1) {
      bones.forEach((bn, i) => bn.quaternion.copy(s.saved[i].slerp(bn.quaternion, s.w)));
      s.upper.updateMatrixWorld(true);
    }
  }
  function setWorldQuat(bn, wq) {
    bn.parent.getWorldQuaternion(qParent);
    bn.quaternion.copy(qParent.invert().multiply(qHand.copy(wq)));
    bn.updateMatrixWorld(true);
  }

  // left: { on, palmAt } for the front grip; right: { w (aim weight 0..1), palmAt (the wrist), handQuat } for the
  // pistol grip (holdRifle().ik() gives both).
  // dt null: jump straight to the wanted weights (?freeze)
  function update(dt, left, right) {
    model.updateMatrixWorld(true);
    // the right arm takes the aim weight as it is (it already moves in TPP.aimTime)
    R.w = right.w; reach(R, right.w, null, right.palmAt, right.handQuat, true);
    reach(L, left.on ? 1 : 0, dt, left.palmAt, null);
  }

  return { update, get left() { return L.w; } };
}
