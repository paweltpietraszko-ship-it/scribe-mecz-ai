// Cover lines (task 005, moved out of cover.js in task 015): the sides of the arena's elements, the front faces of the
// wall panels and the long sides of the turntable's arms. Task 015: which ends are corners (nothing continues the
// cover there) and which lines are low cover (crouched behind them).
// line: { a, b (plan ends, x/z), dir (a→b), n (outward normal: the side the character stands on), len, height,
//         low (a sill: vaulted, not cover), crouch (low cover), depth (thickness across), panel (for the wall panels),
//         owner (its element or panel), disc (the arms: the ends in the disc's frame), next: { a: [], b: [] } (lines
//         that continue this one past its end a / b) }
import * as THREE from 'three';
import { COVER as C } from '../data/cover.js';
import { ARENA_SECTION, TURNTABLE, elementSpec } from '../data/arena.js';

const V2 = THREE.Vector2;

// World vertices of the solid (shadow-casting) meshes of an element, in the element's own frame
function localVertices(g) {
  g.updateWorldMatrix(true, true);
  const inv = g.matrixWorld.clone().invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), pts = [];
  g.traverse(o => {
    if (!o.isMesh || !o.castShadow) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) pts.push(v.fromBufferAttribute(p, i).applyMatrix4(m).clone());
  });
  return pts;
}

function elementLines(g) {
  const spec = ARENA_SECTION.elements.find(e => e.id === g.userData.id);
  // the footprint: E.outline, shifted by outlineX (the blade: from its axis) and outlineZ (the foot: out of the wall)
  const E = elementSpec(spec.type, spec.variant), [w, d] = E.outline, oz = E.outlineZ || 0, ox = E.outlineX || 0;
  // the cover's height: the element's highest solid point (a ridge's peak shelters its back side too)
  const height = localVertices(g).reduce((h, p) => Math.max(h, p.y), 0);
  // four sides of the footprint in the element's frame: [end a, end b, outward normal, length, depth]
  const sides = [
    [[ox - w / 2, oz + d / 2], [ox + w / 2, oz + d / 2], [0, 1], w, d],
    [[ox + w / 2, oz - d / 2], [ox - w / 2, oz - d / 2], [0, -1], w, d],
    [[ox + w / 2, oz + d / 2], [ox + w / 2, oz - d / 2], [1, 0], d, w],
    [[ox - w / 2, oz - d / 2], [ox - w / 2, oz + d / 2], [-1, 0], d, w],
  ];
  const toWorld = ([x, z]) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(g.matrixWorld); return new V2(v.x, v.z); };
  // a buttress foot's back is in the chamber wall: no cover there (wallSide, task 011)
  return sides.filter(s => s[3] >= C.minLength && !(E.wallSide && s[2][1] === -1)).map(([a, b, nl, len, depth]) => {
    const A = toWorld(a), B = toWorld(b), O = toWorld([ox, oz]), N = toWorld([ox + nl[0], oz + nl[1]]).sub(O).normalize();
    return { a: A, b: B, dir: B.clone().sub(A).normalize(), n: N, len, height, depth, panel: null, owner: g };
  });
}

// the front face of a wall panel (only while the panel is fully up)
function panelLine(p) {
  const box = new THREE.Box3().setFromObject(p.g);
  const a = new V2(box.min.x, box.max.z), b = new V2(box.max.x, box.max.z);
  return { a, b, dir: new V2(1, 0), n: new V2(0, 1), len: b.x - a.x, height: box.max.y, depth: Infinity, panel: p, owner: p };
}

// the long sides of the turntable's three arms (Paweł, 27.09.2026: OWNER_CORRECTED in task 005), kept in the
// disc's frame (relative to its centre) and turned with it every frame (cover.js: turnLines)
function armLines() {
  const A = TURNTABLE.arms, out = [];
  for (let k = 0; k < 3; k++) {
    const ang = k * Math.PI * 2 / 3 + A.angle0, u = new V2(Math.cos(ang), -Math.sin(ang)), w = new V2(-u.y, u.x);
    const near = u.clone().multiplyScalar(A.innerRadius), far = u.clone().multiplyScalar(A.innerRadius + A.length);
    [[near, far, w], [far, near, w.clone().negate()]].forEach(([a, b, n]) => {
      const local = { a: a.clone().addScaledVector(n, A.thickness / 2), b: b.clone().addScaledVector(n, A.thickness / 2), n };
      out.push({ a: local.a.clone(), b: local.b.clone(), dir: new V2(), n: n.clone(), len: A.length, height: A.height,
        depth: A.thickness, panel: null, owner: 'arm' + k, disc: local });
    });
  }
  return out;
}

// another line m continues l past its end (at along `end` of l, going `side` = −1 before a, +1 past b): the same face
// (same normal, in one plane) and m reaches within C.cornerGap beyond that end. The arms turn: never linked.
function continues(l, m, end, side) {
  if (m.owner === l.owner || l.disc || m.disc || l.n.dot(m.n) < 0.99) return false;
  if (Math.abs(m.a.clone().sub(l.a).dot(l.n)) > 0.1) return false;
  const ua = m.a.clone().sub(l.a).dot(l.dir), ub = m.b.clone().sub(l.a).dot(l.dir);
  const lo = Math.min(ua, ub), hi = Math.max(ua, ub);
  return side > 0 ? lo <= end + C.cornerGap && hi > end : hi >= end - C.cornerGap && lo < end;
}

// elements: the arena's groups; wall: buildPanelWall(). Returns every line (cover, low cover and sills)
export function buildLines({ elements, wall }) {
  const all = [...elements.flatMap(elementLines), ...wall.panels.map(panelLine), ...armLines()];
  all.forEach(l => { l.low = l.height <= C.lowMax; l.crouch = !l.low && l.height <= C.lowCoverMax; });
  all.forEach(l => {
    l.next = { a: all.filter(m => !m.low && continues(l, m, 0, -1)), b: all.filter(m => !m.low && continues(l, m, l.len, 1)) };
  });
  return all;
}
