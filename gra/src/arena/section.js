// The arena section (task 011): the elements of ARENA_SECTION (plan of the arena) and the temporary boundary where the
// section does not reach the chamber wall (U12). The boundary is one mesh (a low wall along an arc and the glowing line
// at its foot); its straight pieces are given to the physics and the navigation as boxes, so it stops the character
// exactly where it stands.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENA_SECTION as S, TURNTABLE, BACK_WALL, ACCENTS, LIT } from '../data/arena.js';
import { buildElement } from './elements.js';
import { hdr } from '../look/materials.js';

// the elements and the work lights over them (task 019: the mood's pools of light, their shadows by LIT.shadows)
export function buildSectionElements(scene) {
  const L = LIT.spot, SH = LIT.shadows, [cx, cz] = TURNTABLE.center;
  for (const [x, z] of S.lights.spots) {
    const d = Math.hypot(x - cx, z - cz), s = new THREE.SpotLight(L.color, L.intensity, L.distance, L.angle, L.penumbra, L.decay);
    s.position.set(x + (cx - x) / d * L.back, L.height, z + (cz - z) / d * L.back); s.target.position.set(x, L.targetY, z);
    if (SH.on) { s.castShadow = true; s.shadow.mapSize.set(SH.mapSize, SH.mapSize); s.shadow.bias = SH.bias; s.shadow.normalBias = SH.normalBias; }
    scene.add(s, s.target);
  }
  return S.elements.map(({ id, type, variant, x, z, rotY }) => {
    const g = buildElement(type, variant, id, { x, z });
    g.position.set(x, 0, z); g.rotation.y = rotY; g.userData.id = id;
    scene.add(g);
    return g;
  });
}

// The boundary: from the chamber wall around the far side of the turntable back to the chamber wall, its inner face at
// B.radius from the turntable's centre. Returns { group, pieces: [{ x, z, rotY, length, height, thickness }] }
// (rotY: as an object's rotation.y, the piece's length along its local X).
export function buildBoundary(scene) {
  const B = S.boundary, [cx, cz] = TURNTABLE.center, mid = B.radius + B.thickness / 2;
  // where the arc of the wall's middle meets the chamber wall (the plane z = BACK_WALL.z), on its far side
  const start = Math.asin((BACK_WALL.z - cz) / mid), end = Math.PI - start;
  const walls = [], lines = [], pieces = [];
  for (let i = 0; i < B.segments; i++) {
    const a0 = start + (end - start) * i / B.segments, a1 = start + (end - start) * (i + 1) / B.segments, a = (a0 + a1) / 2;
    // the chord at the inner face plus a little overlap, so the pieces meet without gaps
    const length = 2 * mid * Math.sin((a1 - a0) / 2) + B.thickness * Math.tan((a1 - a0) / 2) + 0.02;
    const rotY = -a - Math.PI / 2, x = cx + mid * Math.cos(a), z = cz + mid * Math.sin(a);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, B.height / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
    walls.push(new THREE.BoxGeometry(length, B.height, B.thickness).applyMatrix4(m));
    const L = B.line, inner = B.radius - L.depth / 2 - 0.002;
    const lm = new THREE.Matrix4().compose(new THREE.Vector3(cx + inner * Math.cos(a), L.height / 2, cz + inner * Math.sin(a)),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rotY, 0)), new THREE.Vector3(1, 1, 1));
    lines.push(new THREE.BoxGeometry(2 * B.radius * Math.sin((a1 - a0) / 2) + 0.01, L.height, L.depth).applyMatrix4(lm));
    pieces.push({ x, z, rotY, length, height: B.height, thickness: B.thickness });
  }
  const group = new THREE.Group();
  const wallMat = new THREE.MeshStandardMaterial({ color: BACK_WALL.color, roughness: BACK_WALL.roughness });
  const wall = new THREE.Mesh(mergeGeometries(walls), wallMat); wall.receiveShadow = true;
  group.add(wall, new THREE.Mesh(mergeGeometries(lines), hdr(B.line.glow * ACCENTS.boundary)));
  scene.add(group);
  return { group, pieces };
}
