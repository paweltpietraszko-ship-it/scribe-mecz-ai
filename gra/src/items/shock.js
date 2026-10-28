// The shock grenade's picture (task 017, Paweł 30.09.2026: "granat porażający przeciwnika na 2, 3 sekundy, jak w
// The Division, i to powinno być widowiskowe"): at the blast, electric arcs run out over the floor to the circle's edge
// with a ring of light going out; on a stunned fighter, short arcs jump over the body for as long as the stun lasts.
// Picture only (random shapes are fine here: the stun itself is simulation, items/world.js). All lines come from a
// pool made at the start (no shader prepared in the middle of a fight).
import * as THREE from 'three';
import { hdr } from '../look/materials.js';

const SEG = 7;   // points per arc

export function createShockFx(scene, F) {
  const lineMat = hdr(F.glow), bodyMat = hdr(F.bodyGlow);
  const makeLine = mat => {
    const g = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3));
    const l = new THREE.Line(g, mat); l.frustumCulled = false; l.visible = false; scene.add(l); return l;
  };
  const burstLines = Array.from({ length: F.arcs }, () => makeLine(lineMat));
  const bodyLines = Array.from({ length: F.bodyArcs * 2 }, () => makeLine(bodyMat));
  const ringMat = hdr(F.ringGlow);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96).rotateX(-Math.PI / 2), ringMat);
  ring.scale.setScalar(1e-4); ring.position.y = -5; scene.add(ring);
  // the lines drawn once out of sight so their shader is ready
  [...burstLines, ...bodyLines].forEach(l => { l.visible = true; l.position.y = -5; });
  let burst = null;   // { at, radius, age, ends }
  const a = new THREE.Vector3(), b = new THREE.Vector3();

  // a jagged line from a to b, jitter m sideways
  function jag(line, from, to, jitter) {
    const p = line.geometry.attributes.position;
    for (let i = 0; i < SEG; i++) {
      const u = i / (SEG - 1), j = i === 0 || i === SEG - 1 ? 0 : jitter;
      p.setXYZ(i, from.x + (to.x - from.x) * u + (Math.random() - 0.5) * j, from.y + (to.y - from.y) * u + (Math.random() - 0.5) * j,
        from.z + (to.z - from.z) * u + (Math.random() - 0.5) * j);
    }
    p.needsUpdate = true; line.position.y = 0; line.visible = true;
  }

  // the blast at `at` (Vector3), reaching radius m
  function blast(at, radius) {
    const ends = burstLines.map((_, i) => { const ang = (i / burstLines.length + Math.random() * 0.05) * Math.PI * 2, r = radius * (0.6 + 0.4 * Math.random());
      return new THREE.Vector3(at.x + Math.cos(ang) * r, 0.05 + Math.random() * 0.6, at.z + Math.sin(ang) * r); });
    burst = { at: at.clone(), radius, age: 0, ends };
  }

  // dt; stunned: [{ zones (the fighter's hit zones: feet, head, torso, legs) }] of the fighters stunned now
  function update(dt, stunned) {
    if (burst) {
      burst.age += dt;
      const u = burst.age / F.time;
      if (u >= 1) { burst = null; burstLines.forEach(l => { l.visible = false; }); ring.scale.setScalar(1e-4); ring.position.y = -5; }
      else {
        // the arcs grow out from the middle, flickering; the ring goes out to the circle's edge and fades
        const reach = Math.min(1, u * 2.5);
        burstLines.forEach((l, i) => {
          if (Math.random() < 0.25) { l.visible = false; return; }
          a.copy(burst.at).setY(0.1); b.copy(burst.at).lerp(burst.ends[i], reach);
          jag(l, a, b, 0.35 * reach);
        });
        ring.position.set(burst.at.x, 0.03, burst.at.z); ring.scale.setScalar(Math.max(0.2, burst.radius * Math.min(1, u * 1.6)));
      }
    }
    bodyLines.forEach(l => { l.visible = false; });
    let k = 0;
    for (const s of stunned) {
      const z = s.zones;
      for (let i = 0; i < F.bodyArcs && k < bodyLines.length; i++, k++) {
        // short sharp sparks close to the body, each shown only now and then (a crackle, not a glow)
        if (Math.random() > F.bodyShow) continue;
        const y1 = z.legs[0] + 0.2 + Math.random() * (z.head - z.legs[0] - 0.2), y2 = y1 + (Math.random() - 0.5) * 0.25;
        const ang = Math.random() * Math.PI * 2, r = 0.2;
        a.set(z.feet.x + Math.cos(ang) * r, y1, z.feet.z + Math.sin(ang) * r);
        b.set(z.feet.x + Math.cos(ang + 0.7) * r, y2, z.feet.z + Math.sin(ang + 0.7) * r);
        jag(bodyLines[k], a, b, 0.05);
      }
    }
  }
  return { blast, update };
}
