// Cover target marker (task 005): a thin glowing line on the floor at the cover, along its face, in the
// arena's script light like the element outlines. Nothing else appears on the screen. Task 015: dimmed on a cover SCRIBE
// has just announced (A does not take it: the lift's closing doors), so the player sees why.
import * as THREE from 'three';
import { COVER } from '../data/cover.js';
import { hdr } from '../look/materials.js';

export function createMarker(scene) {
  const M = COVER.marker;
  const bright = hdr(M.glow), dim = hdr(M.dim);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(M.length, M.height, M.line), bright);
  mesh.visible = false; scene.add(mesh);

  // target: { line, along, blocked } from cover.js, or null
  function update(target) {
    mesh.visible = !!target;
    if (!target) return;
    mesh.material = target.blocked ? dim : bright;
    const { line: l, along } = target;
    const p = l.a.clone().addScaledVector(l.dir, along).addScaledVector(l.n, M.offset);
    mesh.position.set(p.x, M.height / 2, p.y);
    mesh.rotation.y = -Math.atan2(l.dir.y, l.dir.x);   // the box's length (X) along the cover
  }
  return { update, mesh };
}
