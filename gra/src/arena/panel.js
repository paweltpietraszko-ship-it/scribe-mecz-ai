// Wall of three script panels. The middle one lowers into the floor (panel cycle in motion.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PANEL, MOTION, RESPONSE } from '../data/arena.js';
import { RNG } from '../look/script.js';
import { faceTex, planarUV } from '../look/textures.js';
import { faceMaterial, hdr, darkMat, glowCol, glowLight } from '../look/materials.js';

const { width: W, height: H, seal: SEAL, plates: PL } = PANEL;

// task 016: also the panels standing in the feet's places (arena/elements.js: wallPanel)
export function buildPanel(seed, off, flash) {
  const r = RNG(seed * 7 + 1); const tx = faceTex(seed, W, H, PANEL.texPxPerM, SEAL, PANEL.glyphSize); const mat = faceMaterial(tx, off, flash, 1, PANEL.normalScale);
  const g = new THREE.Group(); const plates = []; const gap = PL.gap;
  // three columns of plates of random height
  const [s0, s1] = PL.splits;
  [[-W / 2, s0], [s0 + gap, s1], [s1 + gap, W / 2]].forEach(([x0, x1]) => {
    let y = 0;
    while (y < H - PL.topTolerance) {
      let hh = PL.heightMin + r() * PL.heightRange; if (H - (y + hh) < PL.minLast) hh = H - y;
      const pw = x1 - x0, ph = hh - gap; const geo = new RoundedBoxGeometry(pw, ph, PL.depth, 2, PL.radius); geo.translate(x0 + pw / 2, y + ph / 2, 0); planarUV(geo, -W / 2, W, H);
      const mesh = new THREE.Mesh(geo, mat); const z = PL.zMin + r() * PL.zRange; mesh.position.z = z; mesh.castShadow = mesh.receiveShadow = true; mesh.userData = { z0: z, k: PL.tremorMin + r() * PL.tremorRange }; g.add(mesh); plates.push(mesh); y += hh;
    }
  });
  // seal disk with a glowing ring
  const disk = new THREE.CylinderGeometry(SEAL.R, SEAL.R, SEAL.depth, 96); disk.rotateX(Math.PI / 2); disk.translate(SEAL.x, SEAL.y, 0); planarUV(disk, -W / 2, W, H);
  const dm = new THREE.Mesh(disk, mat); dm.position.z = SEAL.z; dm.castShadow = true; dm.userData = { z0: SEAL.z, k: SEAL.tremor }; g.add(dm); plates.push(dm);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(SEAL.R + SEAL.ring.offset, SEAL.ring.tube, 8, 128), hdr(SEAL.ring.glow)); ring.position.set(SEAL.x, SEAL.y, SEAL.z); g.add(ring);
  // light behind the plates, seen through the seams
  const B = PANEL.back;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W - B.inset, H - B.inset), hdr(B.glow)); back.position.set(0, H / 2, B.z); g.add(back);
  // frame
  const F = PANEL.frame, fb = F.bar;
  [[W + 2 * fb, fb, 0, H + fb / 2], [W + 2 * fb, fb, 0, -fb / 2], [fb, H + 2 * fb, -W / 2 - fb / 2, H / 2], [fb, H + 2 * fb, W / 2 + fb / 2, H / 2]].forEach(([fw, fh, fx, fy]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, F.depth), darkMat); b.position.set(fx, fy, F.z); b.receiveShadow = true; g.add(b);
  });
  return { g, plates, back };
}

export function buildPanelWall(scene) {
  const flash = { value: 0 }, zero = { value: 0 };
  const L = PANEL.light, S = PANEL.slot, FX = RESPONSE.panel;
  const panels = PANEL.xs.map((x, i) => {
    const moving = i === PANEL.moving;
    const p = buildPanel(PANEL.seeds[i], i * PANEL.waveOffsetStep, moving ? flash : zero); p.g.position.x = x; scene.add(p.g);
    // floor slot the panel sinks into
    const slot = new THREE.Mesh(new THREE.BoxGeometry(W + S.extraWidth, S.height, S.depth), hdr(0)); slot.position.set(x, S.height / 2, S.z); scene.add(slot); p.slot = slot;
    const pl = glowLight(new THREE.PointLight(glowCol, L.intensity, L.distance, L.decay)); pl.position.set(x, L.y, L.z); scene.add(pl); p.light = pl;
    p.dim = !moving; p.moving = moving;
    return p;
  });

  // s: panel cycle state from motion.js; t: time in seconds
  function update(s, t) {
    flash.value = s.flash * MOTION.flashGain;
    panels.forEach(q => {
      const tens = q.moving ? s.tension : 0, dr = q.moving ? s.drop : 0;
      q.plates.forEach(pl => { pl.position.z = pl.userData.z0 + tens * pl.userData.k * FX.tremor.amount * (FX.tremor.mix + (1 - FX.tremor.mix) * Math.sin(t * FX.tremor.hz + pl.userData.k * FX.tremor.phase)); });
      q.g.position.y = -dr * (H + MOTION.panel.depthExtra);
      q.back.material.color.copy(glowCol).multiplyScalar((FX.back.base + (q.moving ? tens * FX.back.tension + s.flash * FX.back.flash : 0)) * (q.dim ? PANEL.dimBack : 1));
      q.slot.material.color.copy(glowCol).multiplyScalar(q.moving ? (tens * FX.slot.tension + (dr > 0 && dr < 1 ? FX.slot.moving : 0)) : 0);
      q.light.intensity = (q.dim ? L.dimIntensity : L.intensity) + (q.moving ? s.flash * FX.light.flash + tens * FX.light.tension : 0);
    });
  }
  return { panels, update };
}
