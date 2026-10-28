// The machine's script: alphabet, word list, glyph drawing.
// Rules from tools/art/glyphs.js; identical to reference/fragment_areny.html (seed 20260925).

export const SCRIPT_SEED = 20260925;

export function RNG(seed) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

const AR = RNG(SCRIPT_SEED);

function makeGlyph() {
  const st = []; const sx = Math.floor(AR() * 3); const y0 = Math.floor(AR() * 2), y1 = 3 + Math.floor(AR() * 2);
  st.push([[sx, y0], [sx, y1]]); const n = 1 + Math.floor(AR() * 3);
  for (let i = 0; i < n; i++) {
    const y = Math.floor(AR() * 5), k = AR();
    if (k < .45) { const x2 = sx === 0 ? 2 : sx === 2 ? 0 : (AR() < .5 ? 0 : 2); st.push([[sx, y], [x2, y]]); }
    else if (k < .75) { const x2 = sx === 0 ? 2 : 0; const y2 = Math.max(0, Math.min(4, y + (AR() < .5 ? -1 : 1))); st.push([[sx, y], [x2, y2]]); }
    else { const x2 = sx === 1 ? 0 : 1; st.push([[x2, y], [x2, Math.min(4, y + 1 + Math.floor(AR() * 2))]]); }
  }
  const mark = AR() < .35 ? { t: AR() < .6 ? 'dot' : 'ring', p: [Math.floor(AR() * 3), Math.floor(AR() * 5)] } : null;
  return { strokes: st, mark };
}

// Order matters: ALPHA and WORDS consume the same generator.
export const ALPHA = Array.from({ length: 34 }, makeGlyph);
const FREQ = ALPHA.map((_, i) => 1 / Math.pow(i + 1, .9)); const FSUM = FREQ.reduce((a, b) => a + b, 0);

// Zipf-like pick of a glyph index
export function pick(r) { let v = r() * FSUM; for (let i = 0; i < FREQ.length; i++) { v -= FREQ[i]; if (v <= 0) return i; } return 0; }

export const WORDS = Array.from({ length: 9 }, () => Array.from({ length: 2 + Math.floor(AR() * 4) }, () => pick(AR)));

export function drawGlyph(ctx, g, x, y, size, lw) {
  const cw = size * .42, ch = size / 4; const P = ([gx, gy]) => [x + gx * cw / 2, y + gy * ch];
  ctx.lineWidth = lw; ctx.lineCap = 'square'; ctx.lineJoin = 'miter'; ctx.beginPath();
  for (const [a, b] of g.strokes) { const [ax, ay] = P(a), [bx, by] = P(b); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); } ctx.stroke();
  if (g.mark) {
    const [mx, my] = P(g.mark.p); ctx.beginPath();
    if (g.mark.t === 'dot') { ctx.arc(mx, my, lw * 1.1, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.arc(mx, my, lw * 1.9, 0, Math.PI * 2); ctx.stroke(); }
  }
}
