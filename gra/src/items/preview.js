// The preview of the item held (task 017), only the thrower's own (its intent, not knowledge of the other): the
// grenade's arc and where it lands; the key's marker on the floor (dim where it cannot be used). Picture only.
import * as THREE from 'three';
import { ITEMS } from '../data/items.js';
import { hdr } from '../look/materials.js';

const N = 24;

export function createPreview(scene) {
  const arcGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array((N + 1) * 3), 3));
  const arc = new THREE.Line(arcGeo, hdr(1.4)); arc.visible = false; arc.frustumCulled = false; scene.add(arc);
  const spot = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40).rotateX(-Math.PI / 2), hdr(2)); spot.visible = false; scene.add(spot);
  const K = ITEMS.key.marker;
  const keyOk = hdr(K.glow), keyBad = hdr(K.glow * 0.25);
  const keyMark = new THREE.Mesh(new THREE.RingGeometry(K.radius - K.line, K.radius, 48).rotateX(-Math.PI / 2), keyOk);
  keyMark.visible = false; scene.add(keyMark);
  const reach = new THREE.Mesh(new THREE.RingGeometry(ITEMS.key.radius - 0.03, ITEMS.key.radius, 96).rotateX(-Math.PI / 2), hdr(K.glow * 0.4));
  reach.visible = false; scene.add(reach);

  // p: the fighter's itemState.preview ({ spec, from, to, ok }) or null; world: items/world.js (the arc's points)
  function update(p, world) {
    const throwing = !!p && p.spec.kind === 'throw', keying = !!p && p.spec.kind === 'key';
    arc.visible = spot.visible = throwing;
    keyMark.visible = reach.visible = keying;
    if (throwing) {
      const pts = world.arc(p.spec, p.from, p.to, N), a = arcGeo.attributes.position;
      pts.forEach((v, i) => a.setXYZ(i, v.x, v.y, v.z)); a.needsUpdate = true;
      spot.position.set(p.to.x, Math.max(0.02, p.to.y + 0.02), p.to.z);
    }
    if (keying) {
      keyMark.material = p.ok ? keyOk : keyBad;
      keyMark.position.set(p.to.x, 0.02, p.to.z);
      reach.position.copy(keyMark.position); reach.visible = p.ok;
    }
  }
  return { update };
}
