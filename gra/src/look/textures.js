// Baked textures of the engraved surfaces: panel faces, turntable dial, arms and arena elements (drawn as in
// reference/fragment_areny.html: look/engrave.js).
// Task 024 (K1, K3): a surface's four textures (look/engrave.js: cr colour + roughness, n normal, o order of writing,
// ms mask + seal) are made at once as empty textures for the materials, and baked later by workers
// (look/bake.worker.js) when bake()/bakeAll() asks for them: the welcome screen's panels first, the gallery's only when
// it is shown. Two-channel textures are BC5 on the card where it can (EXT_texture_compression_rgtc; a size not in whole
// 4×4 blocks gets a margin), else RG8; the order of writing is R8. After the upload the arrays are let go (the card keeps the
// texture); after a lost graphics context, rebakeAll() makes them again.
import * as THREE from 'three';
import { drawFace, drawDisc, bakeSurface, padded } from './engrave.js';

let compress = false;
// the renderer's card: can it keep BC5? (called before the first surface is made)
export function useCompression(renderer) { compress = renderer.extensions.has('EXT_texture_compression_rgtc'); }

function texture(kind, w, h) {
  const t = kind === 'bc5' ? new THREE.CompressedTexture([], w, h, THREE.RED_GREEN_RGTC2_Format)
    : new THREE.DataTexture(null, w, h, kind === 'r8' ? THREE.RedFormat : THREE.RGFormat);
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
  t.anisotropy = 8; t.unpackAlignment = 1; t.flipY = false;
  return t;
}

const surfaces = [];
// msUv: where the picture is in the mask's texture (scale x, y, offset x, y: a margin round it, look/engrave.js padTo);
// the colour's and the normal's textures carry the same as their own offset and repeat
function surface(kind, args, w, h) {
  const [W, H] = compress ? padded(w, h) : [w, h], two = compress ? 'bc5' : 'rg8';
  const s = { kind, args, w, h, cr: texture(two, W, H), n: texture(two, W, H), o: texture('r8', w, h), ms: texture(two, W, H), ready: null,
    msUv: new THREE.Vector4(w / W, h / H, ((W - w) >> 1) / W, ((H - h) >> 1) / H) };
  for (const t of [s.cr, s.n]) { t.repeat.set(s.msUv.x, s.msUv.y); t.offset.set(s.msUv.z, s.msUv.w); }
  surfaces.push(s);
  return s;
}

// Flat face: columns of script; optional seal. Local coords: x in [-w/2,w/2], y in [0,h]
export function faceTex(seed, w_m, h_m, PXM, seal, G_m) {
  return surface('face', [seed, w_m, h_m, PXM, seal, G_m], Math.round(w_m * PXM), Math.round(h_m * PXM));
}
// Turntable face: a dial
export function discTex(seed, Rm, PXM) {
  const S = Math.round(2 * Rm * PXM);
  return surface('disc', [seed, Rm, PXM], S, S);
}

// ---- the workers: as many as the processor has threads but one (at most 8); none where a worker cannot draw
const pool = { workers: [], idle: [], queue: [], jobs: new Map(), next: 1, off: typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' };
function startWorkers() {
  const n = Math.max(1, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('./bake.worker.js', import.meta.url), { type: 'module' });
    w.onmessage = ({ data }) => {
      const job = pool.jobs.get(data.id); pool.jobs.delete(data.id);
      pool.idle.push(w); pump();
      if (data.error) job.reject(new Error(data.error)); else job.resolve(data.out);
    };
    w.onerror = e => { e.preventDefault?.(); pool.off = true; for (const [id, job] of pool.jobs) { pool.jobs.delete(id); onPage(job); } };
    pool.workers.push(w); pool.idle.push(w);
  }
}
// on the page's thread (no workers): one surface at a time, the page breathing between them
const pageCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function onPage(job) {
  setTimeout(() => {
    try {
      const s = job.s, d = s.kind === 'disc' ? drawDisc(pageCanvas, ...s.args) : drawFace(pageCanvas, ...s.args);
      job.resolve(bakeSurface(pageCanvas, d, compress));
    } catch (e) { job.reject(e); }
  });
}
function pump() {
  while (pool.queue.length && (pool.off || pool.idle.length)) {
    const job = pool.queue.shift();
    if (pool.off) { onPage(job); continue; }
    const w = pool.idle.pop(), id = pool.next++;
    pool.jobs.set(id, job);
    w.postMessage({ id, kind: job.s.kind, args: job.s.args, compressed: compress });
  }
}
const run = s => new Promise((resolve, reject) => {
  if (!pool.off && !pool.workers.length) startWorkers();
  pool.queue.push({ s, resolve, reject }); pump();
});

// a baked texture's levels into its texture; the arrays are let go once the card has them
function fill(t, r) {
  const mips = r.levels.map(l => ({ data: l.data, width: l.w, height: l.h }));
  t.mipmaps = mips;
  t.image = t.isCompressedTexture ? { width: r.levels[0].w, height: r.levels[0].h } : { data: mips[0].data, width: mips[0].width, height: mips[0].height };
  t.onUpdate = () => { t.mipmaps = []; if (!t.isCompressedTexture) t.image = { data: null, width: t.image.width, height: t.image.height }; };
  t.needsUpdate = true;
}

// one surface baked (once); resolves when its textures are filled
export function bake(s) {
  s.ready ??= run(s).then(out => { for (const k of ['cr', 'n', 'o', 'ms']) fill(s[k], out[k]); });
  return s.ready;
}
// the surfaces of the materials under `root`, in its order
export function surfacesIn(root) {
  const found = new Set();
  root.traverse(o => { for (const m of [o.material ?? []].flat()) if (m.userData?.surface) found.add(m.userData.surface); });
  return [...found];
}
export const bakeAll = root => Promise.all(surfacesIn(root).map(bake));
// after a lost graphics context: every surface baked before is baked again (its arrays were let go)
export function rebakeAll() {
  return Promise.all(surfaces.filter(s => s.ready).map(s => { s.ready = null; return bake(s); }));
}
export const bakeStats = () => ({ surfaces: surfaces.length, baked: surfaces.filter(s => s.ready).length, workers: pool.workers.length, onPage: pool.off });

// Task 011: as planarUV, but faces turned sideways (their normal mostly along X) take u from z, in the same metres per
// texture width: the script runs round the ends and sides too (planarUV left them one texel column wide, i.e. blank)
export function wrapUV(geo, x0, w, h) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  let z0 = Infinity; for (let i = 0; i < p.count; i++) z0 = Math.min(z0, p.getZ(i));
  for (let i = 0; i < p.count; i++) {
    const side = Math.abs(n.getX(i)) > Math.max(Math.abs(n.getY(i)), Math.abs(n.getZ(i)));
    uv.setXY(i, side ? (p.getZ(i) - z0) / w : (p.getX(i) - x0) / w, p.getY(i) / h);
  }
  uv.needsUpdate = true;
}

// Map a box's x/y to UV over a face of width w (starting at x0) and height h
export function planarUV(geo, x0, w, h) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) - x0) / w, p.getY(i) / h);
  uv.needsUpdate = true;
}
