// The wall panels' plates on an element's face (task 016; Paweł 30.09.2026: the panels "wyglądają szlachetnie, a reszta
// to przy nich gruz i nagrobki… jaki jest problem by skopiować to co tam działało"). The same construction as
// buildPanel (arena/panel.js), with PANEL's numbers: three columns of plates of random height, each a little in front
// of or behind the others, thin gaps between them, a glowing plane behind them seen through the gaps, and on a large
// face the seal (a disk with the sigil in the texture and a glowing ring). The plates of one face are one mesh (one
// draw call); they cast shadows, so they are part of the element's solid (collider, cover height).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PANEL } from '../data/arena.js';
import { RNG } from '../look/script.js';
import { planarUV } from '../look/textures.js';
import { hdr } from '../look/materials.js';

const PL = PANEL.plates, W0 = PANEL.width;

// seed; w, h: the face (m); mat: the element's engraved material (its texture spans the face: planarUV); depth: of the
// plates; seal: { x, y, R } in the face's frame (x from its middle, y from its foot) or null; glows: the element
// glow materials (by brightness). Returns a group facing +Z, its back at z = 0.
export function platedFace({ seed, w, h, mat, depth, seal = null, back, glow }) {
  const r = RNG(seed * 7 + 1), g = new THREE.Group(), geos = [], gap = PL.gap;
  // the plates stay within `depth` (the element keeps its outline: cover lines, collider): each plate's front between
  // depth − zRange and depth, its back in front of the light plane
  const d = depth - PL.zRange - 0.02;
  // the panel's three columns (its splits as shares of its width); a narrower face two columns, a narrow one one
  const cols = w >= 1.8 ? (() => { const [s0, s1] = PL.splits.map(x => (x / W0) * w); return [[-w / 2, s0], [s0 + gap, s1], [s1 + gap, w / 2]]; })()
    : w >= 0.9 ? (() => { const s = w * (r() - 0.5) * 0.2; return [[-w / 2, s], [s + gap, w / 2]]; })() : [[-w / 2, w / 2]];
  cols.forEach(([x0, x1]) => {
    let y = 0;
    while (y < h - PL.topTolerance) {
      let hh = PL.heightMin + r() * PL.heightRange; if (h - (y + hh) < PL.minLast) hh = h - y;
      const pw = x1 - x0, ph = hh - gap;
      const geo = new RoundedBoxGeometry(pw, ph, d, 2, PL.radius);
      geo.translate(x0 + pw / 2, y + ph / 2, 0.02 + r() * PL.zRange + d / 2);
      planarUV(geo, -w / 2, w, h);
      geos.push(geo); y += hh;
    }
  });
  const plates = new THREE.Mesh(mergeGeometries(geos), mat); plates.castShadow = plates.receiveShadow = true; g.add(plates);
  // light behind the plates, seen through the gaps
  const light = new THREE.Mesh(new THREE.PlaneGeometry(w - back.inset, h - back.inset), glow(back.glow)); light.position.set(0, h / 2, back.z); g.add(light);
  if (seal) {
    const S = PANEL.seal, disk = new THREE.CylinderGeometry(seal.R, seal.R, S.depth, 64);
    disk.rotateX(Math.PI / 2); disk.translate(seal.x, seal.y, depth - S.depth / 2 + 0.01); planarUV(disk, -w / 2, w, h);
    const dm = new THREE.Mesh(disk, mat); dm.castShadow = true; g.add(dm);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(seal.R + S.ring.offset, S.ring.tube, 8, 96), glow(S.ring.glow));
    ring.position.set(seal.x, seal.y, depth + 0.01); g.add(ring);
  }
  return g;
}
