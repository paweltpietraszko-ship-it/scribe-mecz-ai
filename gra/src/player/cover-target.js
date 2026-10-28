// The cover the view points at (task 005, moved out of cover.js and widened in task 015): the face the view's ray hits;
// else the face with a point closest to the crosshair within COVER.targetCone (Paweł 29.09.2026: "przyklejanie jest
// loteryjne"; one ray missed narrow faces and edges), the nearest such face the camera sees; else the nearest cover just
// in front of the character.
// A cover SCRIBE has just announced (task 012: it does not take the character, as a lift's closing doors) is still found,
// marked `blocked`, so the marker can show why A does nothing.
import * as THREE from 'three';
import { COVER as C } from '../data/cover.js';

const V2 = THREE.Vector2;
const clamp = THREE.MathUtils.clamp;
const SAMPLES = 9;   // points along each face tried for the cone

// lines: the cover lines; world, RAPIER: the physics; candidate(l): may be a target at all (not low, not the line the
// character is at); valid(l): takes the character now
export function createTargeting({ lines, world, RAPIER, candidate, valid }) {
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  const cosCone = Math.cos(THREE.MathUtils.degToRad(C.targetCone));
  const p3 = new THREE.Vector3();

  // the distance to the first solid thing along the ray from o towards p (unit d, up to max), or Infinity
  function firstHit(o, d, max, exclude) {
    ray.origin = { x: o.x, y: o.y, z: o.z }; ray.dir = { x: d.x, y: d.y, z: d.z };
    const hit = world.castRay(ray, max, true, undefined, undefined, exclude);
    return hit ? hit.timeOfImpact : Infinity;
  }
  // the face of l at distance t along the ray is really there (a sunk or lowered element is not)
  const there = (o, d, t, exclude) => Math.abs(firstHit(o, d, t + 0.3, exclude) - t) < 0.15;

  // o3, d3: the view's origin and unit direction (Vector3); feet: the character's feet; exclude: its collider.
  // Returns { line, along, blocked } or null
  function find(o3, d3, feet, exclude) {
    const past = new THREE.Vector3(feet.x, feet.y, feet.z).sub(o3).dot(d3);   // the character's depth along the ray
    let best = null;
    // 1) the face the ray hits
    for (const l of lines) {
      if (!candidate(l)) continue;
      const denom = d3.x * l.n.x + d3.z * l.n.y;
      if (denom >= -1e-4) continue;   // only the face turned towards the camera
      const t = ((l.a.x - o3.x) * l.n.x + (l.a.y - o3.z) * l.n.y) / denom;
      if (t <= Math.max(past, 0) || t > C.reach || (best && t >= best.t)) continue;
      const hx = o3.x + d3.x * t, hy = o3.y + d3.y * t, hz = o3.z + d3.z * t;
      const along = (hx - l.a.x) * l.dir.x + (hz - l.a.y) * l.dir.y;
      if (along < 0 || along > l.len || hy < 0 || hy > l.height) continue;
      best = { line: l, along, t };
    }
    // nothing solid in front of that face, and the face itself is there
    if (best && !there(o3, d3, best.t, exclude)) best = null;
    // 2) the cone round the crosshair: the face point with the smallest angle to the view, seen from the camera
    if (!best) {
      const found = [];
      for (const l of lines) {
        if (!candidate(l)) continue;
        if (d3.x * l.n.x + d3.z * l.n.y >= -1e-4) continue;
        if ((o3.x - l.a.x) * l.n.x + (o3.z - l.a.y) * l.n.y <= 0) continue;   // the camera is on the face's side
        let top = -2, at = 0, dist = 0;
        for (let k = 0; k < SAMPLES; k++) {
          const along = l.len * (k + 0.5) / SAMPLES;
          const px = l.a.x + l.dir.x * along, pz = l.a.y + l.dir.y * along;
          const hz = Math.hypot(px - o3.x, pz - o3.z);
          // the height the view's ray has at that distance, within the face
          const py = clamp(o3.y + d3.y / Math.max(Math.hypot(d3.x, d3.z), 1e-3) * hz, 0.3, l.height - 0.1);
          p3.set(px - o3.x, py - o3.y, pz - o3.z);
          const L = p3.length(), c = p3.dot(d3) / L;
          if (c > top) { top = c; at = along; dist = L; }
        }
        if (top >= cosCone && dist <= C.reach && dist > past) found.push({ line: l, along: at, c: top, dist });
      }
      // the nearest one in the cone that the camera sees (audit 015: the contract's "najbliższa w tym stożku")
      found.sort((x, y) => x.dist - y.dist);
      for (const f of found) {   // until the first one seen (audit 015 r2: no limit)
        const l = f.line, px = l.a.x + l.dir.x * f.along, pz = l.a.y + l.dir.y * f.along;
        const hz = Math.hypot(px - o3.x, pz - o3.z);
        const py = clamp(o3.y + d3.y / Math.max(Math.hypot(d3.x, d3.z), 1e-3) * hz, 0.3, l.height - 0.1);
        const d = new THREE.Vector3(px - o3.x, py - o3.y, pz - o3.z), L = d.length();
        // seen: the first thing on the way is this face (a little in front of it: the ray hits the face's plane)
        if (Math.abs(firstHit(o3, d.divideScalar(L), L + 0.3, exclude) - L) < 0.2) { best = f; break; }
      }
    }
    // 3) the nearest cover just in front of the character
    if (!best) {
      const fwd = new V2(d3.x, d3.z).normalize(), me = new V2(feet.x, feet.z), cos = Math.cos(THREE.MathUtils.degToRad(C.snapAngle));
      let dist = C.snap;
      for (const l of lines) {
        if (!candidate(l) || !valid(l)) continue;
        const along = clamp(me.clone().sub(l.a).dot(l.dir), 0, l.len), q = l.a.clone().addScaledVector(l.dir, along), to = q.clone().sub(me), dd = to.length();
        if (dd > dist || me.clone().sub(q).dot(l.n) <= 0 || (dd > 1e-3 && to.dot(fwd) / dd < cos)) continue;
        dist = dd; best = { line: l, along };
      }
    }
    if (!best) return null;
    return { line: best.line, along: best.along, blocked: !valid(best.line) };
  }
  return { find };
}
