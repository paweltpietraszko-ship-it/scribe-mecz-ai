// The engraved surfaces' textures (moved from look/textures.js in task 024): a surface is drawn twice, a height canvas
// (the engraving) and a phase canvas that tells the shader where the writing head is (R: order of writing, G: script
// mask, B: seal). Algorithm and constants identical to reference/fragment_areny.html. Drawn on canvases made by mk(w, h)
// (OffscreenCanvas in a worker, look/bake.worker.js; a page's canvas where workers cannot draw).
// Task 024 (K1): bakeSurface turns the drawing into the four textures the card keeps (look/textures.js), with their
// mipmaps, compressed (BC5) where it can:
//   cr: R the colour (in linear light: the card used to turn the sRGB canvas into it), G the roughness;
//   n: the normal's x and y (z is made again in the shader: the normal is a unit vector facing out);
//   o: the order of writing (R8, never compressed: the writing head's timing needs every step of it);
//   ms: the script mask and the seal.
// The numbers are the ones the canvases held (the same rounding), rows from the bottom (as the card takes them).
import { RNG, ALPHA, WORDS, pick, drawGlyph } from './script.js';
import { encodeBC5, mipChain } from './bc.js';

function sigil(Hx, Px, r, cx, cy, R, PXM) {
  Hx.lineWidth = .012 * PXM; Hx.beginPath(); Hx.arc(cx, cy, R, 0, Math.PI * 2); Hx.stroke();
  Hx.lineWidth = .006 * PXM; Hx.beginPath(); Hx.arc(cx, cy, R * .84, 0, Math.PI * 2); Hx.stroke();
  Px.strokeStyle = 'rgb(0,0,255)'; Px.lineWidth = Math.max(1.5, .006 * PXM); Px.beginPath(); Px.arc(cx, cy, R * .84, 0, Math.PI * 2); Px.stroke();
  for (let k = 0; k < 72; k++) {
    if (r() < .3) continue; const a = k / 72 * Math.PI * 2; const l = (r() < .2 ? .06 : .025) * PXM;
    Hx.lineWidth = .006 * PXM; Hx.beginPath(); Hx.moveTo(cx + Math.cos(a) * R * .9, cy + Math.sin(a) * R * .9); Hx.lineTo(cx + Math.cos(a) * (R * .9 - l), cy + Math.sin(a) * (R * .9 - l)); Hx.stroke();
  }
  const gs = R * 1.1;
  [0, 1, 2].forEach(k => {
    const g = ALPHA[Math.floor(r() * ALPHA.length)];
    Hx.save(); Hx.translate(cx, cy); Hx.rotate([0, Math.PI / 2, Math.PI / 4][k]); drawGlyph(Hx, g, -gs * .21, -gs / 2, gs, (.03 - k * .008) * PXM); Hx.restore();
    if (k === 0) { Px.save(); Px.translate(cx, cy); Px.strokeStyle = Px.fillStyle = 'rgb(0,0,255)'; drawGlyph(Px, g, -gs * .21, -gs / 2, gs, Math.max(1.5, .012 * PXM)); Px.restore(); }
  });
}

function canvases(mk, w, h) {
  const hc = mk(w, h), pc = mk(w, h);
  const Hx = hc.getContext('2d'), Px = pc.getContext('2d'); Hx.fillStyle = '#fff'; Hx.fillRect(0, 0, w, h); Px.fillStyle = '#000'; Px.fillRect(0, 0, w, h); Hx.strokeStyle = Hx.fillStyle = '#000';
  return { hc, pc, Hx, Px };
}

// Flat face: columns of script; optional seal. Local coords: x in [-w/2,w/2], y in [0,h]
export function drawFace(mk, seed, w_m, h_m, PXM, seal, G_m) {
  const r = RNG(seed); const w = Math.round(w_m * PXM), h = Math.round(h_m * PXM); const { hc, pc, Hx, Px } = canvases(mk, w, h);
  const X = x => (x + w_m / 2) * PXM, Y = y => (h_m - y) * PXM; let sx = -1e9, sy = -1e9, R = 0;
  if (seal) { sx = X(seal.x); sy = Y(seal.y); R = seal.R * PXM * .86; sigil(Hx, Px, r, sx, sy, R, PXM); }
  const G = G_m * PXM, LW = G_m * .124 * PXM, colW = G * .62, m = .07 * PXM; const places = []; let cx = m;
  while (cx + colW < w - m) {
    let y = m + (r() < .3 ? r() * h * .25 : 0); const yEnd = h - m - (r() < .35 ? r() * h * .3 : 0);
    while (y + G < yEnd) {
      const word = r() < .55 ? WORDS[Math.floor(r() * WORDS.length)] : Array.from({ length: 1 + Math.floor(r() * 4) }, () => pick(r));
      for (const gi of word) { if (y + G > yEnd) break; const gx = cx + colW * .5, gy = y + G * .5; if (Math.hypot(gx - sx, gy - sy) > R + .06 * PXM) places.push([gi, cx + colW * .12, y]); y += G * 1.12; }
      y += G * .55;
    }
    cx += colW * (1 + (r() < .18 ? .9 : .08));
    if (r() < .14 && cx < w - m) { Hx.lineWidth = LW * .55; Hx.beginPath(); Hx.moveTo(cx - colW * .1, m); Hx.lineTo(cx - colW * .1, h - m); Hx.stroke(); cx += colW * .25; }
  }
  places.forEach(([gi, x, y], i) => {
    Hx.strokeStyle = Hx.fillStyle = '#000'; drawGlyph(Hx, ALPHA[gi], x, y, G * .9, LW);
    const ph = Math.round(i / places.length * 255); Px.strokeStyle = Px.fillStyle = `rgb(${ph},255,0)`; drawGlyph(Px, ALPHA[gi], x, y, G * .9, Math.max(1.5, LW * .5));
  });
  return { hc, pc, blur: Math.max(1, LW * .2), r };
}

// Turntable face: a dial. Bands of script running around the centre, carved rings, irregular spokes, sealed hub
export function drawDisc(mk, seed, Rm, PXM) {
  const r = RNG(seed); const S = Math.round(2 * Rm * PXM); const { hc, pc, Hx, Px } = canvases(mk, S, S); const c = S / 2;
  sigil(Hx, Px, r, c, c, .75 * PXM, PXM);
  const bands = []; for (let rr = 1.0; rr < Rm - .35; rr += .52) bands.push(rr);
  Hx.lineWidth = .014 * PXM; [.95, ...bands.map(b => b + .5), Rm - .12].forEach(rr => { Hx.beginPath(); Hx.arc(c, c, rr * PXM, 0, Math.PI * 2); Hx.stroke(); });
  for (let k = 0; k < 11; k++) {
    const a = r() * Math.PI * 2, r0 = .95 + r() * 1.5, r1 = Math.min(Rm - .12, r0 + .6 + r() * 2);
    Hx.lineWidth = .01 * PXM; Hx.beginPath(); Hx.moveTo(c + Math.cos(a) * r0 * PXM, c + Math.sin(a) * r0 * PXM); Hx.lineTo(c + Math.cos(a) * r1 * PXM, c + Math.sin(a) * r1 * PXM); Hx.stroke();
  }
  const G = .24 * PXM, LW = .03 * PXM; const places = [];
  bands.forEach((b, bi) => {
    const rm = (b + .25) * PXM; const step = G * .72 / rm; let a = r() * Math.PI * 2; const end = a + Math.PI * 2 - step * 2;
    while (a < end) {
      const word = r() < .55 ? WORDS[Math.floor(r() * WORDS.length)] : Array.from({ length: 1 + Math.floor(r() * 4) }, () => pick(r));
      for (const gi of word) { if (a >= end) break; places.push([gi, rm, a, bi]); a += step; } a += step * (.8 + r() * 1.6);
    }
  });
  places.forEach(([gi, rm, a], i) => {
    const draw = (ctx, lw) => { ctx.save(); ctx.translate(c + Math.cos(a) * rm, c + Math.sin(a) * rm); ctx.rotate(a + Math.PI / 2); drawGlyph(ctx, ALPHA[gi], -G * .19, -G * .45, G * .9, lw); ctx.restore(); };
    Hx.strokeStyle = Hx.fillStyle = '#000'; draw(Hx, LW); const ph = Math.round(i / places.length * 255); Px.strokeStyle = Px.fillStyle = `rgb(${ph},255,0)`; draw(Px, Math.max(1.5, LW * .5));
  });
  return { hc, pc, blur: Math.max(1, LW * .2), r };
}

// sRGB (0..255) → linear light (0..1), as the card decodes an sRGB texture
const LINEAR = Float32Array.from({ length: 256 }, (_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

// the normals' mipmaps: every level from the sum of the full-size normals under its texel (the card averaged the
// stored normals and the shader normalized the mean: the same direction), stored as x, y of the unit vector
function normalChain(nf, w, h) {
  const q = new Uint8ClampedArray(2), levels = [];
  let sum = nf, lw = w, lh = h;
  for (;;) {
    const rg = new Uint8Array(lw * lh * 2);
    for (let i = 0; i < lw * lh; i++) {
      const x = sum[i * 3], y = sum[i * 3 + 1], z = sum[i * 3 + 2], l = Math.sqrt(x * x + y * y + z * z) || 1;
      q[0] = (x / l * 0.5 + 0.5) * 255; q[1] = (y / l * 0.5 + 0.5) * 255; rg[i * 2] = q[0]; rg[i * 2 + 1] = q[1];
    }
    levels.push({ data: rg, w: lw, h: lh });
    if (lw === 1 && lh === 1) return levels;
    const W = Math.max(1, lw >> 1), H = Math.max(1, lh >> 1), next = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const x0 = Math.min(lw - 1, 2 * x), x1 = Math.min(lw - 1, 2 * x + 1), y0 = Math.min(lh - 1, 2 * y), y1 = Math.min(lh - 1, 2 * y + 1);
      for (let k = 0; k < 3; k++) next[(y * W + x) * 3 + k] = sum[(y0 * lw + x0) * 3 + k] + sum[(y0 * lw + x1) * 3 + k] + sum[(y1 * lw + x0) * 3 + k] + sum[(y1 * lw + x1) * 3 + k];
    }
    sum = next; lw = W; lh = H;
  }
}

// drawing ({ hc, pc, blur, r }: drawFace, drawDisc) → { w, h, cr, n, o, ms }, each { kind: 'bc5' | 'rg8' | 'r8', levels }.
// compressed: BC5 for the two-channel textures (else RG8); W, H: their size (a margin added: padded)
export function bakeSurface(mk, { hc, pc, blur, r }, compressed) {
  const w = hc.width, h = hc.height;
  const bc = mk(w, h), B = bc.getContext('2d', { willReadFrequently: true });
  B.filter = `blur(${blur}px)`; B.drawImage(hc, 0, 0);
  const hd = B.getImageData(0, 0, w, h).data, pd = pc.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const nf = new Float32Array(w * h * 3), cr = new Uint8Array(w * h * 2), o = new Uint8Array(w * h), ms = new Uint8Array(w * h * 2);
  const q = new Uint8ClampedArray(3), S = 3.2;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(h - 1, y + 1), row = (h - 1 - y) * w;
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - 1), x1 = Math.min(w - 1, x + 1);
      const dx = (hd[(y * w + x1) * 4] - hd[(y * w + x0) * 4]) / 255 * S, dy = (hd[(y1 * w + x) * 4] - hd[(y0 * w + x) * 4]) / 255 * S;
      const l = Math.sqrt(dx * dx + dy * dy + 1), i = (y * w + x) * 4, j = row + x;
      q[0] = (-dx / l * 0.5 + 0.5) * 255; q[1] = (dy / l * 0.5 + 0.5) * 255; q[2] = (1 / l * 0.5 + 0.5) * 255;
      nf[j * 3] = q[0] / 255 * 2 - 1; nf[j * 3 + 1] = q[1] / 255 * 2 - 1; nf[j * 3 + 2] = q[2] / 255 * 2 - 1;
      const v = hd[i] / 255, n = (r() - 0.5) * 0.08;
      q[0] = Math.max(0, Math.min(1, 0.12 + (1 - v) * 0.6 + n + Math.sin(y * 0.013 + x * 0.004) * 0.03)) * 255;
      q[1] = (0.55 + 0.45 * v + n * 0.3) * 255;
      q[2] = LINEAR[q[1]] * 255;
      cr[j * 2] = q[2]; cr[j * 2 + 1] = q[0];
      o[j] = pd[i]; ms[j * 2] = pd[i + 1]; ms[j * 2 + 1] = pd[i + 2];
    }
  }
  if (!compressed) {
    return { w, h, W: w, H: h, cr: { kind: 'rg8', levels: mipChain(cr, w, h, 2) }, n: { kind: 'rg8', levels: normalChain(nf, w, h) },
      o: { kind: 'r8', levels: mipChain(o, w, h, 1) }, ms: { kind: 'rg8', levels: mipChain(ms, w, h, 2) } };
  }
  // BC5 takes whole 4×4 blocks: a size that is not one (the turntable's dial, 1530) gets a margin repeating its edge, the
  // picture in the middle (look/textures.js shifts the texture coordinates to it: the same texels as before)
  const [W, H] = padded(w, h), pad = (src, c) => padTo(src, w, h, W, H, c);
  const toBC5 = levels => ({ kind: 'bc5', levels: levels.map(L => ({ data: encodeBC5(L.data, L.w, L.h), w: L.w, h: L.h })) });
  return { w, h, W, H, cr: toBC5(mipChain(pad(cr, 2), W, H, 2)), n: toBC5(normalChain(pad(nf, 3), W, H)), o: { kind: 'r8', levels: mipChain(o, w, h, 1) },
    ms: toBC5(mipChain(pad(ms, 2), W, H, 2)) };
}

// the size in whole 4×4 blocks (the margin split between both sides) and an image put in its middle, edges repeated
export const padded = (w, h) => [Math.ceil(w / 4) * 4, Math.ceil(h / 4) * 4];
function padTo(src, w, h, W, H, c) {
  if (W === w && H === h) return src;
  const out = new src.constructor(W * H * c), ox = (W - w) >> 1, oy = (H - h) >> 1;
  for (let y = 0; y < H; y++) {
    const sy = Math.min(h - 1, Math.max(0, y - oy));
    for (let x = 0; x < W; x++) {
      const sx = Math.min(w - 1, Math.max(0, x - ox)), i = (y * W + x) * c, j = (sy * w + sx) * c;
      for (let k = 0; k < c; k++) out[i + k] = src[j + k];
    }
  }
  return out;
}
