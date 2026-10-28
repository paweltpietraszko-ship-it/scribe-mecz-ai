// The items in the arena (task 017): grenades in flight, their warning circles and explosions, and the machine's key.
// The simulation (flight, bounces, fuse, damage, the key's elements) needs no drawing (START_HERE.md §5): the flight is
// integrated here with Rapier's ray queries against the arena (a ball of ITEMS.*.body.radius bouncing off the floor and
// the elements; the fighters' capsules do not stop it), with no random numbers, so it is the same for both sides.
// The pictures (the grenade's model, the circle, the burst) follow it.
import * as THREE from 'three';
import { loadModel } from '../look/loaders.js';
import { ITEMS } from '../data/items.js';
import { hdr, glowCol } from '../look/materials.js';
import { createShockFx } from './shock.js';

const G = 9.81;

// the grenade's model scaled to its length in the game, its ice stripe glowing in the script's light
async function loadGrenade(spec) {
  const g = (await loadModel(spec.model.file)).scene;
  const size = new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
  g.scale.setScalar(spec.model.length / Math.max(size.x, size.y, size.z));
  const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3());
  g.position.sub(c);
  g.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true;
    const m = o.material = o.material.clone();
    // dark metal (Paweł 30.09.2026: the pale body looked "jak jogurt"); only the ice stripe glows: an emissive mask of the
    // texture's bluish pixels, in the script's colour
    m.color.multiplyScalar(spec.model.dark);
    if (m.map?.image) {
      const img = m.map.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), px = d.data;
      for (let i = 0; i < px.length; i += 4) { const on = px[i + 2] > px[i] + 25 && px[i + 2] > 110; px[i] = px[i + 1] = px[i + 2] = on ? 255 : 0; }
      x.putImageData(d, 0, 0);
      const mask = new THREE.CanvasTexture(c); mask.flipY = m.map.flipY; mask.colorSpace = THREE.SRGBColorSpace;
      m.emissiveMap = mask; m.emissive = glowCol.clone(); m.emissiveIntensity = spec.model.glow;
    }
  });
  return new THREE.Group().add(g);
}

// scene; physics (world, RAPIER); ballistics (clear: the arena between two points); fighters: [player, foe];
// machine: SCRIBE (the key); audio: the sound engine; onSignal(kind, at): public events (the LED screen)
export async function createItemWorld({ scene, physics, ballistics, fighters, machine, audio, onSignal = () => {} }) {
  const { RAPIER, world } = physics;
  const throwSpecs = Object.values(ITEMS).filter(s => s.enabled && s.kind === 'throw');
  const models = {};
  for (const s of throwSpecs) if (!models[s.model.file]) models[s.model.file] = await loadGrenade(s);
  const flying = [], bursts = [];
  const log = [];   // the last explosions and keys, for test scripts
  let clock = 0;
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  const skip = new Set();
  const filter = c => !skip.has(c.handle);

  // the circles on the floor and the bursts: made once and kept in the scene (drawn tiny out of sight while unused), so
  // the first explosion does not stop the game to prepare their shaders (Intel UHD: 9.6 fps for a moment, task 017)
  const HIDE = 1e-4;
  const park = m => { m.scale.setScalar(HIDE); m.position.set(0, -5, 0); };
  const pool = (make, n) => Array.from({ length: n }, () => { const m = make(); park(m); scene.add(m); m.userData.free = true; return m; });
  const take = list => { const m = list.find(x => x.userData.free) ?? list[0]; m.userData.free = false; return m; };
  const give = m => { park(m); m.userData.free = true; };
  const spec0 = throwSpecs[0];
  const rings = spec0 ? pool(() => new THREE.Mesh(new THREE.RingGeometry(1 - spec0.warn.line / spec0.radius, 1, 96).rotateX(-Math.PI / 2), hdr(spec0.warn.glow)), 2) : [];
  const burstGeo = new THREE.SphereGeometry(1, 16, 12);
  const burstPool = spec0 ? pool(() => new THREE.Mesh(burstGeo, hdr(spec0.flash.glow)), 2) : [];
  const ring = () => take(rings);
  const shock = spec0?.shock ? createShockFx(scene, spec0.shock) : null;   // the shock grenade's picture
  // the grenade's model too (its materials), drawn tiny out of sight
  Object.values(models).forEach(m => { const w = m.clone(); park(w); scene.add(w); });

  // a throw: from (Vector3) to the aim point `to` along an arc whose time of flight grows with the distance
  function velocityTo(spec, from, to) {
    const d = Math.hypot(to.x - from.x, to.z - from.z), F = spec.flight;
    const T = THREE.MathUtils.clamp(d * F.perMetre, F.min, F.max);
    return new THREE.Vector3((to.x - from.x) / T, (to.y - from.y + 0.5 * G * T * T) / T, (to.z - from.z) / T);
  }
  // the arc's points for the thrower's preview (the landing without bounces)
  function arc(spec, from, to, n = 24) {
    const v = velocityTo(spec, from, to), d = Math.hypot(to.x - from.x, to.z - from.z), F = spec.flight;
    const T = THREE.MathUtils.clamp(d * F.perMetre, F.min, F.max), pts = [];
    for (let i = 0; i <= n; i++) { const t = T * i / n; pts.push(new THREE.Vector3(from.x + v.x * t, from.y + v.y * t - 0.5 * G * t * t, from.z + v.z * t)); }
    return pts;
  }

  function throwIt(spec, from, to, owner) {
    const v = velocityTo(spec, from, to);
    const mesh = models[spec.model.file].clone(); mesh.position.copy(from); scene.add(mesh);
    flying.push({ spec, p: from.clone(), v, t: 0, owner, mesh, ring: ring(), landed: false, rest: false, spin: new THREE.Vector3(v.z, 0, -v.x).normalize() });
  }

  // one step of a grenade's flight: gravity, then a ray along the move; a hit bounces it (restitution along the normal,
  // friction along the surface); slow on a floor it rests
  function fly(g, dt) {
    const B = g.spec.body;
    if (g.rest) return;
    // rolling on the floor slows it down
    if (g.ground && g.p.y < B.radius + 0.05) {
      const h = Math.hypot(g.v.x, g.v.z), k = h > 1e-6 ? Math.max(0, h - B.roll * dt) / h : 0;
      g.v.x *= k; g.v.z *= k;
    }
    const next = g.p.clone().addScaledVector(g.v, dt); next.y -= 0.5 * G * dt * dt;
    g.v.y -= G * dt;
    const move = next.clone().sub(g.p), len = move.length();
    if (len < 1e-6) return;
    const dir = move.divideScalar(len);
    ray.origin = { x: g.p.x, y: g.p.y, z: g.p.z }; ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = world.castRayAndGetNormal(ray, len + B.radius, true, undefined, undefined, undefined, undefined, filter);
    if (!hit) { g.p.copy(next); return; }
    const n = new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z);
    g.p.addScaledVector(dir, Math.max(0, hit.timeOfImpact - B.radius));
    const vn = g.v.dot(n);
    if (vn < 0) {
      const normal = n.clone().multiplyScalar(vn), tangent = g.v.clone().sub(normal);
      g.v.copy(tangent.multiplyScalar(1 - B.friction * 0.5)).addScaledVector(normal, -B.restitution);
    }
    if (n.y > 0.7) g.ground = true;
    if (n.y > 0.7 && g.v.length() < 0.4) { g.rest = true; g.v.set(0, 0, 0); }
  }

  // the explosion: every fighter within reach loses its share for each of three body points (head, torso, hips) the
  // arena does not hide from the blast; a covered point takes nothing (Paweł 29.09.2026: "osłona chroni, gdy zasłania")
  const pt = new THREE.Vector3();
  function explode(g) {
    const S = g.spec, at = g.p.clone(), hits = [];
    const from = at.clone(); from.y += 0.15;   // the blast a little above the floor, so the floor itself does not hide it
    for (const f of fighters) {
      if (!f.alive) continue;
      const z = f.zones(), points = [z.head, (z.torso[0] + z.torso[1]) / 2, z.legs[1]];
      let dmg = 0, any = false;
      const seen = points.map(y => {
        pt.set(z.feet.x, y, z.feet.z);
        const d = Math.hypot(z.feet.x - at.x, z.feet.z - at.z);   // the fall-off over the floor (70 at the middle)
        if (d >= S.radius || !ballistics.clear(from, pt)) return false;
        dmg += S.damage / 3 * (1 - d / S.radius);
        any = true;
        return true;
      });
      // the shock (Paweł 30.09.2026): any body point the blast reaches stuns for S.stun s; a covered body is safe
      if (any && S.stun) f.stun(S.stun);
      if (dmg <= 0) { hits.push({ who: fighters.indexOf(f), dmg: 0, seen, stun: any && S.stun ? S.stun : 0 }); continue; }
      const dir = pt.set(z.feet.x, 1, z.feet.z).sub(at).normalize();
      const killed = f.hit('torso', dmg, dir.clone());
      hits.push({ who: fighters.indexOf(f), dmg: +dmg.toFixed(1), seen, killed, dist: +Math.hypot(z.feet.x - at.x, z.feet.z - at.z).toFixed(2) });
    }
    log.push({ t: +clock.toFixed(2), kind: 'grenade', owner: fighters.indexOf(g.owner), at: at.toArray().map(v => +v.toFixed(2)), hits });
    if (log.length > 500) log.shift();
    audio?.play(S.sound, { at });
    if (S.shock && shock) shock.blast(at, S.radius);
    else { const b = take(burstPool); b.position.copy(at); b.position.y += 0.3; bursts.push({ m: b, age: 0, spec: S }); }
    onSignal('grenade', at);
  }

  function update(dt) {
    clock += dt;
    skip.clear(); fighters.forEach(f => skip.add(f.collider.handle));
    for (let i = flying.length - 1; i >= 0; i--) {
      const g = flying[i];
      g.t += dt;
      const steps = Math.ceil(dt / (1 / 120));
      for (let k = 0; k < steps; k++) fly(g, dt / steps);
      // landed: slow near the floor; from then until the explosion the circle shows where it lies (both see it)
      if (!g.landed && g.t > 0.1 && g.p.y < 0.5 && g.v.length() < g.spec.warn.settle) g.landed = true;
      g.mesh.position.copy(g.p);
      if (!g.rest) g.mesh.rotateOnWorldAxis(g.spin, dt * 8);
      if (g.landed) { g.ring.scale.setScalar(g.spec.radius); g.ring.position.set(g.p.x, 0.02, g.p.z); }
      if (g.t >= g.spec.fuse) {
        explode(g);
        scene.remove(g.mesh); give(g.ring);
        flying.splice(i, 1);
      }
    }
    shock?.update(dt, fighters.filter(f => f.stunned).map(f => ({ zones: f.zones() })));
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i], F = b.spec.flash; b.age += dt;
      const u = b.age / F.time;
      if (u >= 1) { give(b.m); bursts.splice(i, 1); continue; }
      b.m.scale.setScalar(F.size * (0.4 + 0.6 * u));
      b.m.material.color.copy(glowCol).lerp(new THREE.Color(0xffffff), 0.6).multiplyScalar(F.glow * (1 - u) * (1 - u));
    }
  }

  // the key: the tall elements round the point go away for a while, by SCRIBE's rules (machine.key); false when SCRIBE
  // is off (the key does nothing then)
  function key(spec, at, owner) {
    const ids = machine.key(at, spec);
    if (ids === null) return false;
    log.push({ t: +clock.toFixed(2), kind: 'key', owner: fighters.indexOf(owner), at: [+at.x.toFixed(2), +at.z.toFixed(2)], ids });
    return true;
  }

  // a new round: nothing in the air
  function reset() {
    flying.forEach(g => { scene.remove(g.mesh); give(g.ring); });
    bursts.forEach(b => give(b.m));
    flying.length = 0; bursts.length = 0;
  }

  return {
    update, reset, throwIt, key, arc, velocityTo,
    get flying() { return flying; },   // { spec, p, v, t, owner, landed }: the bot's senses see the circles
    log, models, specs: ITEMS,
    get keyReady() { return !!machine?.keyReady; },
  };
}
