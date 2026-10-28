// Bullet marks (task 020): where a shot hits a solid of the arena (an element, the wall of panels, an arm of the
// turntable) a small dark hole with a chipped lighter ring stays on its surface (MARKS). A mark is a child of the mesh
// it is on, so it goes with the element when SCRIBE sinks, turns or slides it. Only a picture: it is made from the
// hit the weapon already worked out (ballistics.trace) and nothing in the fight reads it; every client can draw the
// same marks from the same hits. All gone at the start of every round.
import * as THREE from 'three';
import { MARKS as M } from '../data/arena.js';

// the hole: black in the middle, a ring of light chips round it, transparent outside
function markTexture() {
  const n = 64, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), mid = n / 2, chip = Math.round(255 * M.chip);
  for (let k = 0; k < 14; k++) {
    const a = k / 14 * Math.PI * 2 + (k % 3) * 0.2, r = mid * (0.55 + (k * 37 % 10) / 30);
    g.fillStyle = `rgba(${chip},${chip},${chip},${0.55 + (k % 4) * 0.1})`;
    g.beginPath(); g.moveTo(mid, mid);
    g.arc(mid, mid, r, a, a + Math.PI * 2 / 14 * 0.9); g.closePath(); g.fill();
  }
  const hole = g.createRadialGradient(mid, mid, 0, mid, mid, mid * 0.42);
  hole.addColorStop(0, 'rgba(0,0,0,1)'); hole.addColorStop(0.7, 'rgba(8,8,8,1)'); hole.addColorStop(1, 'rgba(20,20,20,0)');
  g.fillStyle = hole; g.fillRect(0, 0, n, n);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// roots: the objects whose solid (shadow-casting) meshes take marks
export function createMarks(roots) {
  const solids = [];
  roots.forEach(r => r.traverse(o => { if (o.isMesh && o.castShadow) solids.push(o); }));
  const tex = markTexture();
  const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: new THREE.Color(M.glow, M.glow, M.glow), transparent: true, depthWrite: false, roughness: 0.9,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const geo = new THREE.PlaneGeometry(1, 1);
  const ray = new THREE.Raycaster(), from = new THREE.Vector3(), n = new THREE.Vector3(), at = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  ray.far = M.reach * 2;
  const marks = [];

  return {
    // point, normal: where the shot hit and the surface's normal (ballistics.trace); dir: the shot's direction
    add(point, normal, dir) {
      if (!M.on) return;
      // from `reach` m before the collider's face: the drawn surface (plates, bevels) may stand in front of it
      ray.set(from.copy(point).addScaledVector(dir, -M.reach), dir);
      const hit = ray.intersectObjects(solids, false)[0];
      if (!hit) return;   // the floor, the boundary, the back wall: no marks
      n.copy(hit.face ? hit.face.normal : normal).applyMatrix3(nm.getNormalMatrix(hit.object.matrixWorld)).normalize();
      const m = new THREE.Mesh(geo, mat);
      // the turn round the normal and the size from the place (the same on every client)
      const h = Math.abs(Math.sin(point.x * 12.9898 + point.y * 78.233 + point.z * 37.719) * 43758.5453) % 1;
      m.position.copy(hit.point).addScaledVector(n, M.lift);
      m.lookAt(at.copy(m.position).add(n)); m.rotateZ(h * Math.PI * 2);
      m.scale.setScalar(M.size * (0.8 + 0.4 * h));
      hit.object.attach(m);
      marks.push(m);
      if (marks.length > M.limit) marks.shift().removeFromParent();
    },
    clear() { marks.forEach(m => m.removeFromParent()); marks.length = 0; },
    // task 024 (K4): a mark not on anything, for compiling its shader before the first hit
    sample: () => new THREE.Mesh(geo, mat),
    get count() { return marks.length; },
  };
}
