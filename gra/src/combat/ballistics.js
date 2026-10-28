// Where a ray lands (task 006, shared by every fighter in task 009): first the arena's colliders, then the fighters'
// fixed hit zones (their capsules do not count, so a shot hits the zones and not the capsule around them).
// Used for the shots, for the player's crosshair and for the bot's eyes (line of sight).
import * as THREE from 'three';
import { rayZones } from './hits.js';

export function createBallistics(physics) {
  const { RAPIER, world } = physics;
  const fighters = [];   // { collider, alive, zones() }
  const skip = new Set();
  const filter = c => !skip.has(c.handle);
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  const skipFighters = () => { skip.clear(); fighters.forEach(f => skip.add(f.collider.handle)); };
  // task 028 (K5): the PvP server's lag compensation: while one fighter's step is judged, the other's zones where the
  // shooter's window showed them (seen(fighter): zones, or null: where it is now). The arena stays as it is now.
  let seen = null;
  const zonesOf = f => seen?.(f) ?? f.zones();

  // the first thing on a ray from o along unit d within maxT: { t, point, normal, target, zone }. shooter: the fighter
  // whose own zones are left out (null: none)
  function trace(o, d, maxT, shooter = null) {
    skipFighters();
    ray.origin = { x: o.x, y: o.y, z: o.z }; ray.dir = { x: d.x, y: d.y, z: d.z };
    const h = world.castRayAndGetNormal(ray, maxT, true, undefined, undefined, undefined, undefined, filter);
    let best = h ? { t: h.timeOfImpact, normal: new THREE.Vector3(h.normal.x, h.normal.y, h.normal.z), target: null } : { t: maxT, normal: null, target: null };
    fighters.forEach(f => {
      if (f === shooter || !f.alive) return;
      const z = rayZones(o, d, best.t, zonesOf(f));
      if (z && z.t < best.t) best = { t: z.t, normal: null, target: f, zone: z.zone };
    });
    best.point = o.clone().addScaledVector(d, best.t);
    return best;
  }

  // is the straight line from a to b free of the arena (the fighters do not block it)?
  const dir = new THREE.Vector3();
  function clear(a, b) {
    dir.subVectors(b, a); const len = dir.length();
    if (len < 1e-6) return true;
    dir.divideScalar(len); skipFighters();
    ray.origin = { x: a.x, y: a.y, z: a.z }; ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    return !world.castRay(ray, len, true, undefined, undefined, undefined, undefined, filter);
  }

  // task 014 (the combat log): the first fighter's zone on a ray, the arena left out: { t, target, zone } or null
  function zonesOnly(o, d, maxT, shooter = null) {
    let best = null;
    fighters.forEach(f => {
      if (f === shooter || !f.alive) return;
      const z = rayZones(o, d, best ? best.t : maxT, zonesOf(f));
      if (z) best = { t: z.t, target: f, zone: z.zone };
    });
    return best;
  }

  // task 014 (U33): the distance from a to the first arena solid on the line to b, or null (the fighters left out)
  function firstArena(a, b) {
    dir.subVectors(b, a); const len = dir.length();
    if (len < 1e-6) return null;
    dir.divideScalar(len); skipFighters();
    ray.origin = { x: a.x, y: a.y, z: a.z }; ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    const h = world.castRay(ray, len, true, undefined, undefined, undefined, undefined, filter);
    return h ? h.timeOfImpact : null;
  }

  return { add: f => fighters.push(f), trace, clear, zonesOnly, firstArena, fighters,
    // (task 028, K5) fn(fighter) → zones | null, or null: every fighter where it is
    setSeen(fn) { seen = fn; } };
}
