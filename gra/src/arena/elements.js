// Arena elements from the catalogue, each in two variants: tooth (zab), slab (tafla), sill (prog) (task 002, shapes
// identical to reference/oslony_areny.html) and, task 011, column (kolumna), blade (lopata), wedge (klin), buttress foot
// (stopa) (reference/bryly_areny.html). Numbers in ELEMENTS (data/arena.js).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ELEMENTS as E, TURNTABLE, PANEL, ACCENTS } from '../data/arena.js';
import { RNG } from '../look/script.js';
import { faceTex, wrapUV } from '../look/textures.js';
import { faceMaterial, hdr, darkMat } from '../look/materials.js';
import { platedFace } from './plated.js';
import { buildPanel } from './panel.js';
import { glowCol, glowLight } from '../look/materials.js';

const still = { value: 0 };   // elements do not announce moves yet

// The textures of an engraved part (U1, task 011): one of E.texPool per size of part, chosen by the part's seed and made
// the first time it is needed (from that seed). Before: every element had its own, too many for the whole arena.
const pool = new Map();
export const texStats = { made: 0 };
function tex(seed, [w, h, glyph], seal = null) {
  const key = `${w}x${h}x${glyph}${seal ? 's' : ''}#${((seed % E.texPool) + E.texPool) % E.texPool}`;
  if (!pool.has(key)) { pool.set(key, faceTex(seed, w, h, E.texPxPerM, seal, glyph)); texStats.made++; }
  return pool.get(key);
}
// the script glows E.scriptGlow times brighter than on the panels (no light of their own: task 011, Paweł after playing)
const mat = (tx, off) => faceMaterial(tx, off, still, 1, E.normalScale, E.scriptGlow);
const shadowy = m => { m.castShadow = m.receiveShadow = true; return m; };
// one glowing material per brightness for all elements (they change colour together: materials.js)
const glows = new Map();
const glow = k => { if (!glows.has(k)) glows.set(k, hdr(k)); return glows.get(k); };
// the accent lines (edges, lips, seams, caps, floor outlines) dimmed by ACCENTS.elements (task 016)
const accent = k => glow(k * ACCENTS.elements);
const line = (sx, sy, sz, k) => new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), accent(k));

// Glowing footprint w × d on the floor: four thin boxes merged into one mesh (task 011: fewer draw calls)
function outline(w, d, k = E.outline.glow) {
  const t = E.outline.line, h = E.outline.height;
  const parts = [[w + 2 * t, t, 0, -d / 2 - t / 2], [w + 2 * t, t, 0, d / 2 + t / 2], [t, d, -w / 2 - t / 2, 0], [t, d, w / 2 + t / 2, 0]]
    .map(([a, b, x, z]) => new THREE.BoxGeometry(a, h, b).translate(x, h / 2, z));
  return new THREE.Mesh(mergeGeometries(parts), glow(k * ACCENTS.outlines));
}

// task 016 (Paweł 30.09.2026): a slab built as the wall's panels on both faces (arena/plated.js): a thin core and on
// each face plates with light behind their gaps; the seal on the front face
function platedSlab(seed, P, at) {
  // the seal only away from the turntable (Paweł 30.09.2026: "na obrotnicy… będzie ich w tym rejonie wizualnie za dużo")
  const far = !at || Math.hypot(at.x - TURNTABLE.center[0], at.z - TURNTABLE.center[1]) > P.plated.sealAway;
  const Q = P.plated, g = new THREE.Group(), seal = Q.seal && far ? { x: Q.seal.x, y: Q.seal.y, R: Q.seal.R } : null;
  const face = (s, withSeal) => mat(tex(seed + s, P.tex, withSeal ? seal : null), (seed + s) * P.wave);
  const core = new RoundedBoxGeometry(P.length - 0.02, P.height - 0.02, Q.core, 2, P.radius); core.translate(0, (P.height - 0.02) / 2, 0);
  g.add(shadowy(new THREE.Mesh(core, darkMat)));
  [[1, true], [-1, false]].forEach(([side, withSeal], k) => {
    const f = platedFace({ seed: seed + k * 101, w: P.length, h: P.height, mat: face(k * 13, withSeal), depth: Q.plate,
      seal: withSeal ? seal : null, back: Q.back, glow });
    f.position.z = side * Q.core / 2; if (side < 0) f.rotation.y = Math.PI;
    g.add(f);
  });
  return withOutline(g, P.outline);
}

// a rectangular part x0..x1 × y0..y1 of a flat element `depth` thick (its middle at z = 0) built as the panels on both
// faces: a thin core and plates with light behind their gaps (task 016)
function plateBoth(parent, seed, { x0, x1, y0, y1, depth, texOf, Q }) {
  const w = x1 - x0, h = y1 - y0, core = depth - 2 * Q.plate;
  const c = new RoundedBoxGeometry(w - 0.02, h - 0.02, core, 2, 0.01); c.translate(x0 + w / 2, y0 + h / 2, 0);
  parent.add(shadowy(new THREE.Mesh(c, darkMat)));
  [1, -1].forEach((side, k) => {
    const f = platedFace({ seed: seed + k * 101, w, h, mat: texOf(k * 13), depth: Q.plate, back: Q.back, glow });
    f.position.set(x0 + w / 2, y0, side * core / 2); if (side < 0) f.rotation.y = Math.PI;
    parent.add(f);
  });
}

// task 016 (Paweł 30.09.2026: the buttress feet "ciężkie, brzydkie, nieefektowne… czy gdyby zamiast tych kolubryniastych
// elementów wstawić takie panele jak te nasze trzy wzorcowe", variant 1: without their own light): a panel as the
// wall's (PANEL: its size, plates, seal and frame) standing against the chamber wall, still a foot for SCRIBE (it slides
// back into the wall: userData.slide)
function wallPanel(seed, P) {
  // the wall's own construction (Paweł 30.09.2026: "cały czas piszesz na nowo zamiast skopiować"): buildPanel as it
  // is (plates 0.12 m at different depths, the seal, the frame, the light behind), dim as the wall's side panels, and
  // its own light 1.1 m in front raking over the plates (their shadows change with the angle you look from)
  const g = new THREE.Group(), slide = new THREE.Group(); g.add(slide); g.userData.slide = slide;
  const p = buildPanel(seed, seed * E.stopa.A.wave, still), F = PANEL.frame, L = PANEL.light, shift = F.depth / 2 - F.z;
  p.back.material = hdr(PANEL.back.glow * PANEL.dimBack);
  p.g.position.z = shift; slide.add(p.g);
  if (P.light) { const l = glowLight(new THREE.PointLight(glowCol, L.dimIntensity, L.distance, L.decay)); l.position.set(0, L.y, shift + L.z); slide.add(l); }
  return withOutline(g, P.outline, P.outlineZ);
}

function withOutline(g, [w, d], z = 0, x = 0) {
  const o = outline(w, d); o.position.set(x, 0, z); g.add(o); g.userData.o = o;
  return g;
}
// an extruded outline in the XY plane, depth along +Z from 0
function extrude(pts, depth, bevel) {
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2 });
}
// the blade's sweep on the floor: a glowing arc at the reach of its tip
function blade(g, P) {
  const A = P.arc, arc = new THREE.Mesh(new THREE.RingGeometry(A.inner, A.outer, 64, 1, -Math.PI / 4, Math.PI / 2), accent(A.glow));
  arc.rotation.x = -Math.PI / 2; arc.position.y = 0.005; g.add(arc);
  g.userData.o = arc;   // the line that lights when the blade is announced (task 012)
}

const BUILD = {
  zab: {
    A(seed) {
      const P = E.zab.A, g = new THREE.Group();
      const geo = new THREE.CylinderGeometry(P.rTop, P.rBottom, P.height, 4, 1); geo.rotateY(Math.PI / 4); geo.translate(0, P.height / 2, 0);
      g.add(shadowy(new THREE.Mesh(geo, mat(tex(seed, P.tex), seed * P.wave))));
      return withOutline(g, P.outline);
    },
    B(seed) {
      const P = E.zab.B, g = new THREE.Group();
      const lo = new RoundedBoxGeometry(P.size, P.low, P.size, 2, P.radius); lo.translate(0, P.low / 2, 0);
      const hi = new RoundedBoxGeometry(P.size, P.high, P.size, 2, P.radius); hi.translate(0, P.highBase + P.high / 2, 0);
      g.add(shadowy(new THREE.Mesh(lo, mat(tex(seed, P.texLow), seed * P.waveLow))));
      g.add(shadowy(new THREE.Mesh(hi, mat(tex(seed + P.highSeedOffset, P.texHigh), seed * P.waveHigh))));
      const core = new THREE.Mesh(new THREE.BoxGeometry(P.core.size, P.core.height, P.core.size), accent(P.core.glow)); core.position.y = P.core.y; g.add(core);
      const cap = new THREE.CylinderGeometry(0, P.cap.r, P.cap.height, 4, 1); cap.rotateY(Math.PI / 4); cap.translate(0, P.cap.base + P.cap.height / 2, 0);
      g.add(shadowy(new THREE.Mesh(cap, darkMat)));
      return withOutline(g, P.outline);
    },
  },
  tafla: {
    A(seed, at) {
      const P = E.tafla.A;
      if (P.plated) return platedSlab(seed, P, at);
      const g = new THREE.Group(); const m = mat(tex(seed, P.tex), seed * P.wave);
      const half = P.length / 2; const r = RNG(seed); const cut = P.cutMin + r() * P.cutRange, gap = P.gap;
      [[-half, cut], [cut + gap, half]].forEach(([a, b]) => {
        const L = b - a; const geo = new RoundedBoxGeometry(L, P.height, P.depth, 2, P.radius); geo.translate(a + L / 2, P.height / 2, 0); wrapUV(geo, -half, P.length, P.height);
        g.add(shadowy(new THREE.Mesh(geo, m)));
      });
      const S = P.seam;
      const seam = new THREE.Mesh(new THREE.BoxGeometry(gap * S.width, S.height, S.depth), accent(S.glow)); seam.position.set(cut + gap / 2, P.height / 2, 0); g.add(seam);
      return withOutline(g, P.outline);
    },
    B(seed) {
      const P = E.tafla.B, g = new THREE.Group(); const m = mat(tex(seed, P.tex), seed * P.wave);
      const [tw, th] = P.tex;
      const sh = new THREE.Shape(P.outlinePts.map(([x, y]) => new THREE.Vector2(x, y)));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: P.depth, bevelEnabled: true, bevelThickness: P.bevel, bevelSize: P.bevel, bevelSegments: 2 });
      geo.translate(0, 0, -P.depth / 2); wrapUV(geo, -tw / 2, tw, th);
      const body = shadowy(new THREE.Mesh(geo, m)); const lean = new THREE.Group(); lean.rotation.x = -P.lean; lean.add(body);
      const D = P.edge, d = new THREE.Vector2(...D.dir);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(d.length(), D.size, D.size), accent(D.glow)); edge.position.set(...D.pos); edge.rotation.z = Math.atan2(D.dir[1], D.dir[0]); lean.add(edge);
      g.add(lean);
      return withOutline(g, P.outline, P.outlineZ);
    },
  },
  prog: {
    A(seed) {
      const P = E.prog.A, g = new THREE.Group(); const m = mat(tex(seed, P.tex), seed * P.wave);
      const geo = new RoundedBoxGeometry(P.length, P.height, P.depth, 3, P.radius); geo.translate(0, P.height / 2, 0); wrapUV(geo, -P.length / 2, P.length, P.height);
      g.add(shadowy(new THREE.Mesh(geo, m)));
      const L = P.lip;
      const lip = new THREE.Mesh(new THREE.BoxGeometry(L.length, L.size, L.size), accent(L.glow)); lip.position.set(0, L.y, L.z); g.add(lip);
      return withOutline(g, P.outline);
    },
    B(seed) {
      const P = E.prog.B, g = new THREE.Group(); const m = mat(tex(seed, P.tex), seed * P.wave);
      const [tw, th] = P.tex;
      const sh = new THREE.Shape(P.profile.map(([x, y]) => new THREE.Vector2(x, y)));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: P.length, bevelEnabled: true, bevelThickness: P.bevel, bevelSize: P.bevel, bevelSegments: 1 });
      geo.rotateY(Math.PI / 2); geo.translate(-P.length / 2, 0, 0); wrapUV(geo, -tw / 2, tw, th);
      g.add(shadowy(new THREE.Mesh(geo, m)));
      const R = P.ridge;
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(P.length, R.size, R.size), accent(R.glow)); ridge.position.set(0, R.y, R.z); g.add(ridge);
      return withOutline(g, P.outline);
    },
  },
  kolumna: {
    A(seed) {
      const P = E.kolumna.A;
      if (E.plated) {
        // task 016: a core and the panels' plates on its four faces (no seal: Paweł 30.09.2026)
        const Q = E.plated, g = new THREE.Group(), c = P.size - 2 * Q.plate;
        const core = new RoundedBoxGeometry(c, P.height - 0.02, c, 2, P.radius); core.translate(0, (P.height - 0.02) / 2, 0);
        g.add(shadowy(new THREE.Mesh(core, darkMat)));
        for (let k = 0; k < 4; k++) {
          const f = platedFace({ seed: seed + k * 37, w: P.size, h: P.height, mat: mat(tex(seed + k, P.tex), (seed + k) * P.wave), depth: Q.plate, back: Q.back, glow });
          const face = new THREE.Group(); face.rotation.y = k * Math.PI / 2; f.position.z = c / 2; face.add(f); g.add(face);
        }
        const cap = line(P.cap.size, P.cap.height, P.cap.size, P.cap.glow); cap.position.y = P.height + P.cap.height / 2 + 0.001; g.add(cap);
        return withOutline(g, P.outline);
      }
      const g = new THREE.Group(), m = mat(tex(seed, P.tex), seed * P.wave);
      const half = P.size / 2, r = RNG(seed), cut = P.cutMin + r() * P.cutRange, gap = P.gap;
      [[-half, cut], [cut + gap, half]].forEach(([a, b]) => {
        const L = b - a, geo = new RoundedBoxGeometry(L, P.height, P.size, 3, P.radius);
        geo.translate(a + L / 2, P.height / 2, 0); wrapUV(geo, -half, P.size, P.height);
        g.add(shadowy(new THREE.Mesh(geo, m)));
      });
      const S = P.seam;
      [-half - 1e-4, half + 1e-4].forEach(z => { const s = line(gap * S.width, S.height, S.depth, S.glow); s.position.set(cut + gap / 2, P.height / 2, z); g.add(s); });
      const cap = line(P.cap.size, P.cap.height, P.cap.size, P.cap.glow); cap.position.y = P.height + P.cap.height / 2 + 0.001; g.add(cap);
      return withOutline(g, P.outline);
    },
    B(seed) {
      const P = E.kolumna.B, g = new THREE.Group();
      let y = 0;
      P.tiers.forEach((h, i) => {
        const rad = P.radius - i * P.narrow, geo = new THREE.CylinderGeometry(rad * P.taper, rad, h, 8, 1);
        geo.rotateY(Math.PI / 8); geo.translate(0, y + h / 2, 0);
        g.add(shadowy(new THREE.Mesh(geo, mat(tex(seed + i, [P.texWidth, h, P.glyph]), seed * P.wave + i * P.waveStep))));
        y += h;
        if (i < P.tiers.length - 1) {
          const R = P.ring, ring = new THREE.Mesh(new THREE.CylinderGeometry(rad * R.scale, rad * R.scale, R.height, 8, 1), accent(R.glow));
          ring.rotation.y = Math.PI / 8; ring.position.y = y + R.height / 2; g.add(ring); y += R.height;
        }
      });
      const C = P.cap, cap = new THREE.CylinderGeometry(C.rTop, C.rBottom, C.height, 8, 1);
      cap.rotateY(Math.PI / 8); cap.translate(0, y + C.height / 2, 0); g.add(shadowy(new THREE.Mesh(cap, darkMat)));
      return withOutline(g, P.outline);
    },
  },
  // the blade turns about its axis at local x = 0: userData.turn (for Puppet Monster, later)
  lopata: {
    A(seed) {
      const P = E.lopata.A, g = new THREE.Group(), turn = new THREE.Group(); g.add(turn); g.userData.turn = turn;
      if (E.plated) {
        // task 016: the rectangular part as the panels (plates on both faces round a core), the slanted end solid
        const Q = E.plated, x0 = P.profile[0][0], x1 = P.profile[3][0], H = P.profile[3][1];
        plateBoth(turn, seed, { x0, x1, y0: 0, y1: H, depth: P.depth, texOf: s => mat(tex(seed + s, P.tex), (seed + s) * P.wave), Q, u0: 0, tw: P.tex[0], th: P.tex[1] });
        const tail = extrude([[x1, 0], ...P.profile.slice(1, 4)], P.depth, P.bevel); tail.translate(0, 0, -P.depth / 2); wrapUV(tail, 0, P.tex[0], P.tex[1]);
        turn.add(shadowy(new THREE.Mesh(tail, mat(tex(seed, P.tex), seed * P.wave))));
      } else {
        const geo = extrude(P.profile, P.depth, P.bevel); geo.translate(0, 0, -P.depth / 2); wrapUV(geo, 0, P.tex[0], P.tex[1]);
        turn.add(shadowy(new THREE.Mesh(geo, mat(tex(seed, P.tex), seed * P.wave))));
      }
      const D = P.edge, dx = D.to[0] - D.from[0], dy = D.to[1] - D.from[1];
      const edge = line(Math.hypot(dx, dy), D.size, D.size, D.glow);
      edge.position.set((D.from[0] + D.to[0]) / 2, (D.from[1] + D.to[1]) / 2, D.z); edge.rotation.z = Math.atan2(dy, dx); turn.add(edge);
      blade(g, P);
      const A = P.axis, axis = new THREE.Mesh(new THREE.CylinderGeometry(A.rTop, A.rBottom, A.height, A.segments), darkMat);
      axis.position.y = A.height / 2; g.add(shadowy(axis));
      const R = P.ring, ring = new THREE.Mesh(new THREE.TorusGeometry(R.R, R.tube, 8, 64), accent(R.glow));
      ring.rotation.x = Math.PI / 2; ring.position.y = R.y; g.add(ring);
      return g;
    },
    B(seed) {
      const P = E.lopata.B, g = new THREE.Group(), turn = new THREE.Group(); g.add(turn); g.userData.turn = turn;
      const m = mat(tex(seed, P.tex), seed * P.wave);
      [[P.start, P.split], [P.split + P.gap, P.end]].forEach(([a, b], i) => {
        const L = b - a, top = P.heights[i];
        // task 016: each part as the panels (plates on both faces round a core)
        if (E.plated) { plateBoth(turn, seed + i * 7, { x0: a, x1: b, y0: 0, y1: top, depth: P.depth, texOf: s => mat(tex(seed + s, P.tex), (seed + s) * P.wave), Q: E.plated }); return; }
        const geo = new RoundedBoxGeometry(L, top, P.depth, 2, P.radius);
        geo.translate(a + L / 2, top / 2, 0); wrapUV(geo, 0, P.tex[0], P.tex[1]); turn.add(shadowy(new THREE.Mesh(geo, m)));
      });
      // the old glowing seam and tip only without the panels' plates (task 016: they looked like thick seams)
      if (!E.plated) {
        const S = P.seam, seam = line(P.gap * S.width, S.height, S.depth, S.glow); seam.position.set(P.split + P.gap / 2, S.y, 0); turn.add(seam);
        const T = P.tip, tip = line(T.width, T.height, T.depth, T.glow); tip.position.set(T.x, T.y, 0); turn.add(tip);
      }
      blade(g, P);
      const A = P.axis, axis = new THREE.Mesh(new THREE.CylinderGeometry(A.r, A.r, A.height, A.segments), darkMat);
      axis.position.y = A.height / 2; g.add(shadowy(axis));
      const B = P.band, band = new THREE.Mesh(new THREE.CylinderGeometry(B.r, B.r, B.height, P.axis.segments), accent(B.glow));
      band.position.y = B.y; g.add(band);
      return g;
    },
  },
  // the wedge folds down about its hinge at the back: userData.fold
  klin: {
    A(seed) {
      const P = E.klin.A, g = new THREE.Group(), fold = new THREE.Group(); g.add(fold); g.userData.fold = fold;
      const [tw, th] = P.tex, half = P.width / 2, back = P.profile[0][0], front = P.profile[1][0], top = P.profile[2][1];
      const geo = extrude(P.profile, P.width, P.bevel); geo.rotateY(-Math.PI / 2); geo.translate(half, 0, 0);
      // the texture runs over the front wall and up the ramp: v from the height and the depth
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + half) / tw, (p.getY(i) + p.getZ(i) - back) / th);
      uv.needsUpdate = true;
      fold.add(shadowy(new THREE.Mesh(geo, mat(tex(seed, P.tex), seed * P.wave))));
      const L = P.lip, lip = line(L.length, L.size, L.size, L.glow); lip.position.set(0, top, front); fold.add(lip);
      const H = P.hinge, hinge = line(P.width, H.size, H.size, H.glow); hinge.position.set(0, H.size / 2 + 0.003, back); g.add(hinge);
      return withOutline(g, P.outline);
    },
    B(seed) {
      const P = E.klin.B, g = new THREE.Group(), fold = new THREE.Group(); g.add(fold); g.userData.fold = fold;
      let z0 = P.front;
      P.steps.forEach(([d, h], i) => {
        const depth = (i ? d - P.steps[i - 1][0] : d) - P.gap, geo = new RoundedBoxGeometry(P.width, h, depth, 2, P.radius);
        geo.translate(0, h / 2, z0 - depth / 2); wrapUV(geo, -P.width / 2, P.tex[0], P.tex[1]);
        fold.add(shadowy(new THREE.Mesh(geo, mat(tex(seed + i, P.tex), seed * P.wave + i * P.waveStep))));
        const L = P.line, l = line(L.length, L.size, L.size, i ? L.glow : L.glowTop); l.position.set(0, h, z0); fold.add(l);
        z0 -= depth + P.gap;
      });
      const H = P.hinge, hinge = line(P.width, H.size, H.size, H.glow); hinge.position.set(0, H.size / 2 + 0.003, P.front - P.steps.at(-1)[0]); g.add(hinge);
      return withOutline(g, P.outline);
    },
  },
  // the buttress foot slides back into the chamber wall: userData.slide
  stopa: {
    A(seed) {
      if (E.stopa.panel) return wallPanel(seed, E.stopa.panel);
      const P = E.stopa.A, g = new THREE.Group(), slide = new THREE.Group(); g.add(slide); g.userData.slide = slide;
      const [tw, th] = P.tex, half = P.width / 2;
      const geo = extrude(P.profile, P.width, P.bevel); geo.rotateY(-Math.PI / 2); geo.translate(half, 0, 0);
      const p = geo.attributes.position, uv = geo.attributes.uv;
      for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + half) / tw, (p.getY(i) + p.getZ(i) * P.uvDepth) / th);
      uv.needsUpdate = true;
      slide.add(shadowy(new THREE.Mesh(geo, mat(tex(seed, P.tex), seed * P.wave))));
      // the glowing edge along the slope (between the profile's third and fourth points)
      const [, , [z1, y1], [z2, y2]] = P.profile, edge = line(P.edge.size, Math.hypot(z1 - z2, y2 - y1), P.edge.size, P.edge.glow);
      edge.position.set(0, (y1 + y2) / 2, (z1 + z2) / 2); edge.rotation.x = Math.atan2(z1 - z2, y2 - y1); slide.add(edge);
      const J = P.joint, joint = line(J.width, J.height, J.depth, J.glow); joint.position.set(0, P.profile.at(-1)[1], 0); g.add(joint);
      return withOutline(g, P.outline, P.outlineZ);
    },
    B(seed) {
      if (E.stopa.panel) return wallPanel(seed, E.stopa.panel);
      const P = E.stopa.B, g = new THREE.Group(), slide = new THREE.Group(); g.add(slide); g.userData.slide = slide;
      let y = 0;
      P.tiers.forEach(([d, top], i) => {
        const h = top - y - P.gap, w = P.width - i * P.narrow, Q = E.plated, dd = Q ? d - Q.plate : d;
        const geo = new RoundedBoxGeometry(w, h, dd, 2, P.radius);
        geo.translate(0, y + h / 2, dd / 2); wrapUV(geo, -P.width / 2, P.tex[0], P.tex[1]);
        slide.add(shadowy(new THREE.Mesh(geo, mat(tex(seed + i, P.tex), seed * P.wave + i * P.waveStep))));
        // task 016: the tier's front as the panels (plates with light behind their gaps)
        if (Q) {
          const f = platedFace({ seed: seed + i * 17, w, h, mat: mat(tex(seed + i + 5, [w, h, P.tex[2]]), seed * P.wave + i * P.waveStep), depth: Q.plate, back: Q.back, glow });
          f.position.set(0, y, dd); slide.add(f);
        }
        const L = P.line, l = line(w - L.inset, L.size, L.size, L.glow); l.position.set(0, top - P.gap, d + 0.005); slide.add(l);
        y = top;
      });
      const R = P.rail;
      [-R.x, R.x].forEach(x => { const m = line(R.width, R.height, R.depth, R.glow); m.position.set(x, R.height / 2, 0); g.add(m); });
      return withOutline(g, P.outline, P.outlineZ);
    },
  },
};

// type: 'zab' | 'tafla' | 'prog' | 'kolumna' | 'lopata' | 'klin' | 'stopa'; variant: 'A' | 'B'; seed: texture and writing offset
// at: { x, z } where it stands (task 016: no seal near the turntable), or undefined (the gallery)
export function buildElement(type, variant, seed, at) {
  const b = BUILD[type]?.[variant];
  if (!b) throw new Error(`Unknown element ${type}/${variant}`);
  const g = b(seed, at); g.userData.type = type; g.userData.variant = variant;
  return g;
}
