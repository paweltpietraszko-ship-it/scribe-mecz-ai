// Shadow maps on demand (task 020, Paweł 01.10.2026: "mój laptop chodzi obciążony jak przy The Division 2"). Drawing
// the nine spotlights' shadow maps every frame took most of the frame (RTX 5050, 1920 × 1080: 75 frames/s with them,
// 419 with the maps kept). Most of the arena stands still, so a light's map is drawn again only when something moves
// inside its cone: a fighter (always: the animation moves the body even on the spot), or a solid mesh whose place has
// changed since the last frame (an element moved by SCRIBE, the turntable, the lowering panel, an item), and once more
// the frame after, so a shadow that left the cone goes too. The picture is the same as with maps drawn every frame.
// SHADOWS.onDemand false: every frame, as up to task 019.
import * as THREE from 'three';
import { SHADOWS } from '../data/arena.js';

// scene: the arena; fighters(): the moving bodies, each { feet: Vector3 } (refreshed every frame)
export function createShadowUpdates(scene, fighters = () => []) {
  // last: each solid's last matrix (task 024 K4: a WeakMap, so a mesh thrown away, e.g. a weapon no longer held, is not kept)
  const lights = [], solids = [], last = new WeakMap();
  const sphere = new THREE.Sphere(), was = new THREE.Matrix4(), v = new THREE.Vector3(), dir = new THREE.Vector3();
  let collected = -Infinity, clock = 0;
  const wasDirty = new Set(), known = new Set();

  function collect() {
    lights.length = 0; solids.length = 0;
    scene.traverse(o => {
      if (o.isSpotLight && o.castShadow) lights.push(o);
      else if (o.isMesh && o.castShadow && !o.isSkinnedMesh) solids.push(o);
    });
    lights.forEach(l => {
      if (!known.has(l)) { known.add(l); l.shadow.needsUpdate = true; }
      l.shadow.autoUpdate = !SHADOWS.onDemand;
    });
  }

  // is a sphere (centre c, radius r) inside the light's cone?
  function inCone(l, c, r) {
    v.subVectors(c, l.position); const d = v.length();
    if (d - r > l.distance) return false;
    dir.subVectors(l.target.position, l.position).normalize();
    return Math.acos(THREE.MathUtils.clamp(v.dot(dir) / d, -1, 1)) < l.angle + Math.asin(Math.min(1, r / d));
  }

  return {
    // before drawing a frame (dt: s)
    update(dt) {
      if (!SHADOWS.onDemand) return;
      clock += dt;
      scene.updateMatrixWorld();   // this frame's places (the drawing would do it after this check)
      if (clock - collected > SHADOWS.recollect) { collect(); collected = clock; }
      const movers = [];
      for (const f of fighters()) movers.push([v.set(f.feet.x, f.feet.y + 1, f.feet.z).clone(), SHADOWS.fighterRadius]);
      for (const m of solids) {
        const e = m.matrixWorld.elements, prev = last.get(m);
        let moved = !prev;
        if (prev) for (let i = 12; i < 15 && !moved; i++) moved = Math.abs(prev[i] - e[i]) > 1e-5;
        if (prev && !moved) for (let i = 0; i < 11 && !moved; i++) moved = Math.abs(prev[i] - e[i]) > 1e-6;
        if (!moved) continue;
        last.set(m, e.slice());
        if (!prev) continue;   // first seen: drawn by the first update of every map anyway
        if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
        // where it is now and where it was: a jump (the round's reset) may take it out of a cone whose map still
        // holds its old shadow (audit 020, F1)
        sphere.copy(m.geometry.boundingSphere).applyMatrix4(m.matrixWorld);
        movers.push([sphere.center.clone(), sphere.radius]);
        sphere.copy(m.geometry.boundingSphere).applyMatrix4(was.fromArray(prev));
        movers.push([sphere.center.clone(), sphere.radius]);
      }
      for (const l of lights) {
        const dirty = movers.some(([c, r]) => inCone(l, c, r));
        if (dirty || wasDirty.has(l)) l.shadow.needsUpdate = true;
        if (dirty) wasDirty.add(l); else wasDirty.delete(l);
      }
    },
    get lights() { return lights.length; },
  };
}
