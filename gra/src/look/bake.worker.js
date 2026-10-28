// Task 024 (K1, K3): one engraved surface drawn and baked off the page's thread (look/engrave.js), so the arena's
// textures are made by several workers at once and the page stays free. In: { id, kind: 'face' | 'disc', args,
// compressed }; out: { id, out } (look/engrave.js bakeSurface), its arrays handed over without a copy.
import { drawFace, drawDisc, bakeSurface } from './engrave.js';

const mk = (w, h) => new OffscreenCanvas(w, h);

self.onmessage = ({ data: { id, kind, args, compressed } }) => {
  try {
    const drawing = kind === 'disc' ? drawDisc(mk, ...args) : drawFace(mk, ...args);
    const out = bakeSurface(mk, drawing, compressed);
    const buffers = ['cr', 'n', 'o', 'ms'].flatMap(k => out[k].levels.map(l => l.data.buffer));
    self.postMessage({ id, out }, buffers);
  } catch (e) {
    self.postMessage({ id, error: String(e?.message ?? e) });
  }
};
