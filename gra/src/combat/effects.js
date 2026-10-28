// What a shot looks like (task 006): a muzzle flash (a bright burst), a tracer every
// few shots (a thin line in the arena's script light) and a short spray of sparks where a shot hits the arena.
// Everything is created once and reused: nothing is added to the scene while shooting (no shader recompiles).
import * as THREE from 'three';
import { EFFECTS as E } from '../data/combat.js';
import { hdr } from '../look/materials.js';

// a soft round spot for the flash and the sparks
function spotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.35, 'rgba(255,255,255,0.6)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// marks: task 020, the bullet marks (look/marks.js) or null
export function createEffects(scene, marks = null) {
  const tex = spotTexture();

  // muzzle flash: a burst only, whose brightness feeds the bloom. No point light: even at zero intensity it is
  // computed for every pixel of every lit surface, about 15% of the frame on an integrated GPU (U25)
  const F = E.flash;
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(F.color).multiplyScalar(F.glow),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  // warm-up: the burst and the tracers are drawn once, out of sight under the floor, so their shaders are compiled
  // at the start and not at the first shot (a 17 ms frame otherwise)
  burst.position.y = -100;
  scene.add(burst);
  let flashLeft = 0;

  // tracers: a unit box stretched between two points; its tail runs from the muzzle to the hit
  const T = E.tracer, tracerMat = hdr(T.glow), unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0, 0.5);
  const tracers = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(unit, tracerMat); m.position.y = -100; m.frustumCulled = false; scene.add(m);
    return { m, from: new THREE.Vector3(), to: new THREE.Vector3(), age: Infinity };
  });
  let nextTracer = 0;

  // sparks: one pool of points
  const S = E.sparks;
  const pos = new Float32Array(S.pool * 3), vel = new Float32Array(S.pool * 3), age = new Float32Array(S.pool).fill(Infinity);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size: S.size,
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  points.material.color = hdr(S.glow).color;   // shared: follows the script light's colour like the tracer
  points.frustumCulled = false; scene.add(points);
  let nextSpark = 0, warm = true;
  const tangent = new THREE.Vector3(), bitangent = new THREE.Vector3();

  return {
    // at: muzzle position (Vector3)
    flash(at) {
      burst.position.copy(at); burst.scale.setScalar(F.size * (0.8 + 0.4 * Math.random()));
      burst.material.rotation = Math.random() * Math.PI * 2; burst.visible = true;
      flashLeft = F.time;
    },
    tracer(from, to) {
      const t = tracers[nextTracer]; nextTracer = (nextTracer + 1) % tracers.length;
      t.from.copy(from); t.to.copy(to); t.age = 0; t.m.visible = true;
    },
    // task 020: a bullet mark where a shot hit the arena (dir: the shot's direction)
    mark(at, normal, dir) { marks?.add(at, normal, dir); },
    clearMarks() { marks?.clear(); },
    // at: hit point; normal: the surface's normal there
    sparks(at, normal) {
      // any direction across the normal, then a second one across both
      tangent.set(Math.abs(normal.y) < 0.9 ? 0 : 1, Math.abs(normal.y) < 0.9 ? 1 : 0, 0).cross(normal).normalize();
      bitangent.crossVectors(normal, tangent);
      for (let i = 0; i < S.count; i++) {
        const k = nextSpark; nextSpark = (nextSpark + 1) % S.pool;
        const a = Math.random() * Math.PI * 2, s = S.spread * Math.random(), v = S.speed * (0.4 + 0.6 * Math.random());
        pos.set([at.x, at.y, at.z], k * 3);
        vel[k * 3] = (normal.x + (tangent.x * Math.cos(a) + bitangent.x * Math.sin(a)) * s) * v;
        vel[k * 3 + 1] = (normal.y + (tangent.y * Math.cos(a) + bitangent.y * Math.sin(a)) * s) * v;
        vel[k * 3 + 2] = (normal.z + (tangent.z * Math.cos(a) + bitangent.z * Math.sin(a)) * s) * v;
        age[k] = 0;
      }
    },
    update(dt) {
      if (warm) { warm = false; burst.visible = false; tracers.forEach(t => { t.m.visible = false; }); return; }
      flashLeft -= dt;
      if (flashLeft <= 0) burst.visible = false;
      tracers.forEach(t => {
        if (!t.m.visible) return;
        t.age += dt;
        if (t.age >= T.life) { t.m.visible = false; return; }
        const tail = t.from.clone().lerp(t.to, t.age / T.life), len = tail.distanceTo(t.to);
        t.m.position.copy(tail); t.m.lookAt(t.to); t.m.scale.set(T.width, T.width, Math.max(len, 1e-3));
      });
      for (let k = 0; k < S.pool; k++) {
        if (age[k] >= S.life) { pos[k * 3 + 1] = -100; continue; }   // spent: out of sight under the floor
        age[k] += dt; vel[k * 3 + 1] -= S.gravity * dt;
        pos[k * 3] += vel[k * 3] * dt; pos[k * 3 + 1] += vel[k * 3 + 1] * dt; pos[k * 3 + 2] += vel[k * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
