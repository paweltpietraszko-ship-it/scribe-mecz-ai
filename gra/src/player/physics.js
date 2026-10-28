// Rapier world: static colliders of the arena and the turntable as a kinematic body.
// Colliders are built from the meshes already in the scene, so they match what the player sees:
// panels as boxes around each panel, elements as convex hulls of their solid parts.
import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import { BACK_WALL, TURNTABLE, ARENA_SECTION } from '../data/arena.js';

const FLOOR_DEPTH = 0.5;   // thickness of the floor and wall slabs below/behind the visible surface

// World-space vertices of the solid (shadow-casting) meshes of an object
function solidVertices(obj) {
  obj.updateWorldMatrix(true, true);
  const pts = []; const v = new THREE.Vector3();
  obj.traverse(m => {
    if (!m.isMesh || !m.castShadow) return;
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); pts.push(v.x, v.y, v.z); }
  });
  return new Float32Array(pts);
}

// Turntable parts in the disc's own frame (it turns around its centre). The disc itself has no
// collider: it is level with the floor (the floor carries the character), and a cylinder's rim,
// however low, stops Rapier's character controller like a wall. Who stands on the disc is decided
// by distance from its centre (onDisc).
function turntableColliders() {
  const T = TURNTABLE, A = T.arms, HB = T.hub, FG = T.figure;
  const list = [
    RAPIER.ColliderDesc.cylinder(HB.height / 2, HB.rBottom).setTranslation(0, HB.height / 2, 0),
    // the silhouette for scale is solid (Paweł, 27.09.2026)
    RAPIER.ColliderDesc.capsule(FG.body / 2, FG.radius).setTranslation(FG.pos[0], FG.radius + FG.body / 2 + FG.lift, FG.pos[1]),
  ];
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + A.angle0, r = A.innerRadius + A.length / 2;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    // arm group rotated by a; the arm lies along its local X
    list.push(RAPIER.ColliderDesc.cuboid(A.length / 2, A.height / 2, A.thickness / 2)
      .setTranslation(Math.cos(a) * r, A.height / 2, -Math.sin(a) * r).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  }
  return list;
}

// arena: { panels: [Object3D], movingPanel: Object3D (one of panels), elements: [Object3D], boundary: the section's
// boundary pieces (arena/section.js, task 011) }
// task 028: Rapier's WebAssembly started once a process: a second init() puts a new module under the worlds made
// before (in one process with several engines: the tests' PvP windows, the server's next room) and they share its memory
let started = null;
export async function createPhysics(arena) {
  await (started ??= RAPIER.init());
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });   // no dynamic bodies: gravity is applied by the character

  // the floor under the whole section (a square around the floor's disc) and the chamber wall along its length
  const half = ARENA_SECTION.floor.radius, [wx0, wx1] = BACK_WALL.x;
  const fixed = desc => world.createCollider(desc);
  fixed(RAPIER.ColliderDesc.cuboid(half, FLOOR_DEPTH / 2, half).setTranslation(TURNTABLE.center[0], -FLOOR_DEPTH / 2, TURNTABLE.center[1]));
  fixed(RAPIER.ColliderDesc.cuboid((wx1 - wx0) / 2, BACK_WALL.height / 2, FLOOR_DEPTH / 2)
    .setTranslation((wx0 + wx1) / 2, BACK_WALL.height / 2, BACK_WALL.z - FLOOR_DEPTH / 2));
  // the boundary: one box per straight piece
  arena.boundary.forEach(b => {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), b.rotY);
    fixed(RAPIER.ColliderDesc.cuboid(b.length / 2, b.height / 2, b.thickness / 2).setTranslation(b.x, b.height / 2, b.z)
      .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  });

  const box = new THREE.Box3(), size = new THREE.Vector3(), c = new THREE.Vector3();
  // each panel is a box around it; the one that lowers into the floor takes its collider with it
  // (DECISIONS.md 27.09.2026: no invisible obstacle where a lowered panel was)
  let moving = null;
  arena.panels.forEach(p => {
    box.setFromObject(p); box.getSize(size); box.getCenter(c);
    const col = fixed(RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2).setTranslation(c.x, c.y, c.z));
    if (p === arena.movingPanel) moving = { col, panel: p, y0: p.position.y, c: c.clone(), half: size.clone().multiplyScalar(0.5) };
  });
  // task 012: each element's collider by its id, for SCRIBE's mechanisms (they move it with the element)
  const elementColliders = new Map();
  arena.elements.forEach(e => {
    const hull = RAPIER.ColliderDesc.convexHull(solidVertices(e));
    if (hull) elementColliders.set(e.userData.id, fixed(hull));
  });

  // Turntable parts are free colliders placed by hand whenever the disc's angle changes. (Attached to
  // a kinematic body, the character controller could not slide along the arms: it stopped dead.)
  const [TX, TZ] = TURNTABLE.center;
  const turnParts = turntableColliders().map(d => {
    const local = { t: new THREE.Vector3().copy(d.translation), q: new THREE.Quaternion().copy(d.rotation) };
    d.setTranslation(TX + local.t.x, local.t.y, TZ + local.t.z);
    return { c: world.createCollider(d), local };
  });

  // Would an arm (or the silhouette on the disc) enter a character standing at feet if the
  // turntable were at this angle? Plan view: distance from the capsule axis to each arm's rectangle.
  function turntableBlocks(angle, feet, radius) {
    const A = TURNTABLE.arms, FG = TURNTABLE.figure, px = feet.x - TX, pz = feet.z - TZ;
    if (Math.hypot(px, pz) > TURNTABLE.radius + radius + 0.1) return false;
    const r = A.innerRadius + A.length / 2;
    for (let k = 0; k < 3; k++) {
      if (armDrop[k] > A.height - 0.3) continue;   // an arm sunk into the disc does not stop the turn (task 012)
      const a = angle + k * Math.PI * 2 / 3 + A.angle0, ux = Math.cos(a), uz = -Math.sin(a);
      const dx = px - ux * r, dz = pz - uz * r;
      const along = Math.abs(dx * ux + dz * uz) - A.length / 2, across = Math.abs(-dx * uz + dz * ux) - A.thickness / 2;
      if (Math.hypot(Math.max(along, 0), Math.max(across, 0)) < radius) return true;
    }
    const c = Math.cos(angle), s = Math.sin(angle), [fx, fz] = FG.pos;
    return Math.hypot(px - (c * fx + s * fz), pz - (-s * fx + c * fz)) < radius + FG.radius;
  }

  // Moving panel: follow the panel's height; would the panel at full height enter a character at feet?
  function syncMovingPanel() {
    if (!moving) return;
    const y = moving.c.y + moving.panel.position.y - moving.y0;
    moving.col.setTranslation({ x: moving.c.x, y, z: moving.c.z });
  }
  function panelBlocks(feet, radius) {
    if (!moving) return false;
    const dx = Math.max(Math.abs(feet.x - moving.c.x) - moving.half.x, 0), dz = Math.max(Math.abs(feet.z - moving.c.z) - moving.half.z, 0);
    return Math.hypot(dx, dz) < radius;
  }

  const onDisc = feet => Math.hypot(feet.x - TX, feet.z - TZ) <= TURNTABLE.radius && feet.y < 0.5;

  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  let lastAngle = 0;
  // task 012: how far SCRIBE has sunk each arm (m); the arms are turnParts 2..4
  const armDrop = [0, 0, 0];
  function placeTurnParts(angle) {
    q.setFromAxisAngle(up, angle);
    turnParts.forEach(({ c, local }, i) => {
      const t = local.t.clone().applyQuaternion(q), r = q.clone().multiply(local.q), drop = i >= 2 ? armDrop[i - 2] : 0;
      c.setTranslation({ x: TX + t.x, y: t.y - drop, z: TZ + t.z }); c.setRotation({ x: r.x, y: r.y, z: r.z, w: r.w });
    });
  }
  return {
    // task 029: Rapier's world given back (a PvP room's engine at the room's end)
    dispose() { world.free(); },
    RAPIER, world, turnParts, turntableBlocks, onDisc, syncMovingPanel, panelBlocks,
    elementCollider: id => elementColliders.get(id) ?? null,
    setTurnAngle(angle) {
      if (angle === lastAngle) return;
      lastAngle = angle; placeTurnParts(angle);
    },
    setArmDrop(k, drop) { armDrop[k] = drop; placeTurnParts(lastAngle); },
    armDrop,
    get turnAngle() { return lastAngle; },
    armSolid: [],   // task 012: per arm, () => it stands and is not about to move (set by SCRIBE's mechanisms)
    step(dt) { world.timestep = Math.max(dt, 1e-4); world.step(); },
    // task 012: the queries (the characters' movement, rays) see colliders moved since the last step only after a step:
    // a very short one, when the turntable or an element moved this frame, before the characters move
    refresh() { world.timestep = 1e-5; world.step(); },
  };
}
