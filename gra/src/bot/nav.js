// Navigation mesh of the arena section (task 009; the section of task 011, recast-navigation-js, MIT): where a bot can walk and the way there.
// The still parts (floor, arena elements, the two side panels) are built once. The parts that move are obstacles of a
// tile cache, and only the tiles under them are built again (choice explained in zadania/009_raport.md):
//   the middle panel: an obstacle while it stands (it lowers into the floor, then the way through is open);
//   the turntable's three arms and the silhouette: obstacles turned with the disc, moved every NAV.rebuild s while it
//   turns. The capsules of the characters stop each other in the physics; the way does not avoid them.
import * as THREE from 'three';
import { init, NavMeshQuery } from 'recast-navigation';
import { generateTileCache } from 'recast-navigation/generators';
import { NAV } from '../data/bot.js';
import { TURNTABLE } from '../data/arena.js';

// world triangles of the solid (shadow-casting) meshes of an object, appended to positions / indices
function addSolid(obj, positions, indices) {
  obj.updateWorldMatrix(true, true);
  const v = new THREE.Vector3();
  obj.traverse(m => {
    if (!m.isMesh || !m.castShadow) return;
    const g = m.geometry, p = g.attributes.position, base = positions.length / 3;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); positions.push(v.x, v.y, v.z); }
    if (g.index) for (let i = 0; i < g.index.count; i++) indices.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) indices.push(base + i);
  });
}
// a box (Box3) as twelve triangles
function addBox(b, positions, indices) {
  const base = positions.length / 3;
  for (let i = 0; i < 8; i++) positions.push(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z);
  [0, 2, 3, 0, 3, 1, 4, 5, 7, 4, 7, 6, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5].forEach(i => indices.push(base + i));
}

// a box turned about Y (a boundary piece of arena/section.js: x, z, rotY, length, height, thickness) as twelve triangles
function addPiece(b, positions, indices) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(b.x, b.height / 2, b.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, b.rotY, 0)), new THREE.Vector3(1, 1, 1));
  const g = new THREE.BoxGeometry(b.length, b.height, b.thickness).applyMatrix4(m), p = g.attributes.position, base = positions.length / 3;
  for (let i = 0; i < p.count; i++) positions.push(p.getX(i), p.getY(i), p.getZ(i));
  for (let i = 0; i < g.index.count; i++) indices.push(base + g.index.getX(i));
}

// wall: buildPanelWall(); elements: the arena groups; boundary: the section's boundary pieces (task 011)
// task 028: recast's WebAssembly started once a process (a second init() under the navigation made before breaks it)
let started = null;
export async function createNav({ wall, elements, boundary = [] }) {
  await (started ??= init());   // (task 028: once a process, as Rapier: player/physics.js)
  const positions = [], indices = [];
  const [x0, x1] = NAV.bounds.x, [z0, z1] = NAV.bounds.z;
  // the floor as one quad (both windings would be walkable; this one faces up)
  positions.push(x0, 0, z0, x1, 0, z0, x1, 0, z1, x0, 0, z1); indices.push(0, 2, 1, 0, 3, 2);
  // task 012: the arena's elements move (SCRIBE), so they are obstacles of the tile cache (setObstacle), not a part of
  // the still mesh
  boundary.forEach(b => addPiece(b, positions, indices));
  const box = new THREE.Box3();
  wall.panels.filter(p => !p.moving).forEach(p => addBox(box.setFromObject(p.g), positions, indices));

  const cs = NAV.cell, ch = NAV.cellHeight;
  const { success, tileCache, navMesh, error } = generateTileCache(positions, indices, {
    cs, ch, tileSize: NAV.tile, borderSize: Math.ceil(NAV.radius / cs) + 3,
    walkableRadius: Math.ceil(NAV.radius / cs), walkableHeight: Math.ceil(NAV.height / ch), walkableClimb: Math.floor(NAV.climb / ch),
    walkableSlopeAngle: NAV.slope, expectedLayersPerTile: 4, maxObstacles: NAV.maxObstacles,
    bounds: [[x0, -0.5, z0], [x1, 3, z1]],
  });
  if (!success) throw new Error('navigation mesh: ' + error);
  const query = new NavMeshQuery(navMesh);
  const ext = { x: 2, y: 2, z: 2 };

  // ---- moving parts ----
  const moving = wall.panels.find(p => p.moving);
  const panelBox = new THREE.Box3().setFromObject(moving.g), panelC = panelBox.getCenter(new THREE.Vector3()), panelH = panelBox.getSize(new THREE.Vector3()).multiplyScalar(0.5).addScalar(NAV.radius);
  let panelObstacle = null, armObstacles = [], armAngle = null, since = Infinity, version = 0;
  const armHeights = [0, 1, 2].map(() => TURNTABLE.arms.height);
  const [TX, TZ] = TURNTABLE.center, A = TURNTABLE.arms, FG = TURNTABLE.figure;
  function placeArms(angle) {
    armObstacles.forEach(o => tileCache.removeObstacle(o));
    armObstacles = [];
    const r = A.innerRadius + A.length / 2;
    for (let k = 0; k < 3; k++) {
      if (armHeights[k] <= 0.3) continue;   // sunk by SCRIBE (task 012)
      const a = angle + k * Math.PI * 2 / 3 + A.angle0;
      const at = { x: TX + Math.cos(a) * r, y: 0, z: TZ - Math.sin(a) * r };
      // the box turns about Y by a, as the arm's group (checked on the mesh: zadania/009_raport.md); the obstacles of a
      // tile cache are not widened by the walker's radius as the still parts are, so it is added here
      armObstacles.push(tileCache.addBoxObstacle(at, { x: A.length / 2 + NAV.radius, y: A.height / 2, z: A.thickness / 2 + NAV.radius }, a).obstacle);
    }
    const c = Math.cos(angle), s = Math.sin(angle), [fx, fz] = FG.pos;
    armObstacles.push(tileCache.addCylinderObstacle({ x: TX + c * fx + s * fz, y: 0, z: TZ - s * fx + c * fz }, FG.radius + NAV.radius, 1.8).obstacle);
    armAngle = angle; since = 0; version++;
  }
  // m: motion.update() this frame (panel: drop 0 up .. 1 down; turn: angle, turning)
  function update(dt, m) {
    const up = m.panel.drop < 0.5 || m.panel.key === 'warning';
    if (up && !panelObstacle) { panelObstacle = tileCache.addBoxObstacle({ x: panelC.x, y: 0, z: panelC.z }, { x: panelH.x, y: panelH.y, z: panelH.z }, 0).obstacle; version++; }
    else if (!up && panelObstacle) { tileCache.removeObstacle(panelObstacle); panelObstacle = null; version++; }
    since += dt;
    if (armAngle === null || (m.turn.angle !== armAngle && (since >= NAV.rebuild || !m.turn.turning))) placeArms(m.turn.angle);
    for (let i = 0; i < 8; i++) if (tileCache.update(navMesh).upToDate) break;
  }

  // an element's obstacle (task 012): f = its footprint (scribe/footprint.js) or null (sunk: the way is open); h: its
  // height. Widened by the walker's radius, as the still parts are
  const elementObstacles = new Map();
  function setObstacle(id, f, h) {
    // the tile cache takes a limited number of requests (64) between its updates: when it is full, process them first
    // (78 elements are added at the start; without this the ones over the limit were lost silently)
    const request = fn => { let r = fn(); for (let i = 0; !r.success && i < 50; i++) { tileCache.update(navMesh); r = fn(); } return r; };
    (elementObstacles.get(id) ?? []).forEach(o => request(() => tileCache.removeObstacle(o)));
    elementObstacles.delete(id);
    if (f) {
      // one obstacle touches at most 8 tiles of the cache (recast's limit): a long element is cut into pieces of
      // NAV.piece m along its length, each a box of its own
      const hx = f.hx + NAV.radius + NAV.elementPad, hz = f.hz + NAV.radius + NAV.elementPad, n = Math.ceil(2 * hx / NAV.piece);
      const c = Math.cos(f.angle), s = Math.sin(f.angle), list = [];
      for (let k = 0; k < n; k++) {
        const lx = -hx + (2 * k + 1) * hx / n;   // the piece's centre along the element, in its own frame
        const r = request(() => tileCache.addBoxObstacle({ x: f.x + c * lx, y: 0, z: f.z - s * lx }, { x: hx / n, y: Math.max(h, 0.5) / 2, z: hz }, f.angle));
        if (r.success) list.push(r.obstacle); else console.warn('navigation: obstacle of element', id, 'not added');
      }
      elementObstacles.set(id, list);
    }
    // and the tiles now: the cache queues at most 64 tiles to build; what does not fit is never built (found in task
    // 012: whole elements had no obstacle after the 78 were added at the start)
    for (let i = 0; i < 200; i++) if (tileCache.update(navMesh).upToDate) break;
    version++;
  }

  const v3 = p => ({ x: p.x, y: 0, z: p.z });
  return {
    update, setObstacle,
    // task 029: recast's memory given back (a PvP room's engine at the room's end: WebAssembly's memory is not collected)
    dispose() { query.destroy(); tileCache.destroy(); navMesh.destroy(); },
    // task 012: an arm's height (SCRIBE sinks it): the arms' obstacles again
    setArmHeight(k, h) { const was = armHeights[k] > 0.3; armHeights[k] = h; if (was !== h > 0.3 && armAngle !== null) placeArms(armAngle); },
    // after the elements were added: build the tiles now (at the start there is no frame to spread it over)
    settle() { for (let i = 0; i < 400; i++) if (tileCache.update(navMesh).upToDate) break; },
    // the path from a to b ({ x, z }) as a list of { x, z } corners (the first is a itself); [] when there is none
    path(a, b) {
      const r = query.computePath(v3(a), v3(b), { halfExtents: ext });
      return r.success ? r.path.map(p => ({ x: p.x, z: p.z })) : [];
    },
    // the nearest walkable point to p, or null
    closest(p) {
      const r = query.findClosestPoint(v3(p), { halfExtents: ext });
      return r.success ? { x: r.point.x, z: r.point.z } : null;
    },
    // a random walkable point within radius of p, or null
    randomAround(p, radius) {
      const r = query.findRandomPointAroundCircle(v3(p), radius, { halfExtents: ext });
      return r.success ? { x: r.randomPoint.x, z: r.randomPoint.z } : null;
    },
    get version() { return version; },   // changes whenever a moving part changed the mesh
    navMesh,
  };
}
