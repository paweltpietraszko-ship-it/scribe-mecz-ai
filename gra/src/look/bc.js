// Task 024 (K1): the engraved surfaces' textures kept compressed on the graphics card. Two channels per texture in BC5
// (RGTC2: 4×4 texels in 16 bytes, one byte per texel instead of four); every channel coded on its own like BC4: two
// end values and eight steps between them.
// Mipmaps are made here (a 2×2 box, as the card would), so the chain is the same compressed or not.

// one channel of a 4×4 block (16 values 0..255) into 8 bytes at out[o]: the ends are the block's lowest and highest
// value (no value is clipped; the error is at most a fourteenth of the block's range)
const idx = new Uint8Array(16);
function encodeChannel(v, out, o) {
  let lo = 255, hi = 0;
  for (let i = 0; i < 16; i++) { const x = v[i]; if (x < lo) lo = x; if (x > hi) hi = x; }
  out[o] = hi; out[o + 1] = lo;
  if (hi === lo) { for (let i = 2; i < 8; i++) out[o + i] = 0; return; }   // one value: every texel takes the first end
  // hi > lo: the eight-step mode. Step k (lo → hi) is index 1 for k = 0, index 0 for k = 7, else 8 − k
  const scale = 7 / (hi - lo);
  for (let i = 0; i < 16; i++) {
    const k = ((v[i] - lo) * scale + 0.5) | 0;
    idx[i] = k === 7 ? 0 : k === 0 ? 1 : 8 - k;
  }
  for (let h = 0; h < 2; h++) {
    const j = h * 8;
    const bits = idx[j] | idx[j + 1] << 3 | idx[j + 2] << 6 | idx[j + 3] << 9 | idx[j + 4] << 12 | idx[j + 5] << 15 | idx[j + 6] << 18 | idx[j + 7] << 21;
    out[o + 2 + h * 3] = bits & 255; out[o + 3 + h * 3] = (bits >> 8) & 255; out[o + 4 + h * 3] = (bits >> 16) & 255;
  }
}

// a two-channel image (RG, w × h, rows from the first uploaded) → BC5 blocks; texels past the edge repeat the edge
const blockR = new Uint8Array(16), blockG = new Uint8Array(16);
export function encodeBC5(rg, w, h) {
  const bw = Math.ceil(w / 4), bh = Math.ceil(h / 4), out = new Uint8Array(bw * bh * 16);
  let o = 0;
  for (let by = 0; by < bh; by++) {
    for (let bx = 0; bx < bw; bx++) {
      for (let y = 0; y < 4; y++) {
        const sy = Math.min(h - 1, by * 4 + y);
        for (let x = 0; x < 4; x++) {
          const sx = Math.min(w - 1, bx * 4 + x), i = (sy * w + sx) * 2;
          blockR[y * 4 + x] = rg[i]; blockG[y * 4 + x] = rg[i + 1];
        }
      }
      encodeChannel(blockR, out, o); encodeChannel(blockG, out, o + 8);
      o += 16;
    }
  }
  return out;
}

// the next mipmap level of an image of `c` channels (Uint8): the mean of 2×2 texels (one row or column at the edge of
// an odd size is left out, as the card does it)
export function halve(src, w, h, c) {
  const W = Math.max(1, w >> 1), H = Math.max(1, h >> 1), out = new Uint8Array(W * H * c);
  for (let y = 0; y < H; y++) {
    const y0 = Math.min(h - 1, y * 2), y1 = Math.min(h - 1, y * 2 + 1);
    for (let x = 0; x < W; x++) {
      const x0 = Math.min(w - 1, x * 2), x1 = Math.min(w - 1, x * 2 + 1);
      for (let k = 0; k < c; k++) {
        const s = src[(y0 * w + x0) * c + k] + src[(y0 * w + x1) * c + k] + src[(y1 * w + x0) * c + k] + src[(y1 * w + x1) * c + k];
        out[(y * W + x) * c + k] = (s + 2) >> 2;
      }
    }
  }
  return { data: out, w: W, h: H };
}

// every mipmap level down to 1 × 1 of an image of `c` channels: [{ data, w, h }, …]
export function mipChain(data, w, h, c) {
  const levels = [{ data, w, h }];
  while (w > 1 || h > 1) { const n = halve(data, w, h, c); levels.push(n); ({ data, w, h } = n); }
  return levels;
}
