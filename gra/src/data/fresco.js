// The fresco of the Progenitors on the screen round the arena (task 021, Astra's package v1, accepted by Paweł
// 01.10.2026: "dobrze to zaprojektował, także pod różne komputery"). Numbers from reference/zasoby_gry/fresco/manifest.json (the
// package itself is copied there unchanged); the motion and the colours as in reference/ekran/fresk/preview_v1.html.
//
// use: 'fresk' or 'dzis' (the machine's script of task 013); the address may override it: ?screen=dzis
// dir, segments, masks: the package's files (4 segments of 90° round the ring, left to right as seen from the arena;
// masks: R dark detail, G mineral field, B edge cover; linear data)
// period: s of the slow change; cycles, phases: per segment, the change's cycles in a period and its phase (rad);
// reveal: [min, max] of the mineral veil laid over the dark detail; edge: the seam's share of a segment on each side
// (B), where every segment meets the same seam colour (`seamMix` between shadow and light)
// rich (the richer quality): an extra veil and a slow drift of the mineral field (depth), `drift` in a segment's UV,
// `driftPeriod` s; lean: the same picture and motion without them
// palettes: shadow / light / veil (sRGB hex); the picture's tone (`lumPower`) runs from shadow to light
// colors: the pause's "Screen colour" ('auto' follows the arena's script light through `auto`); qualities: "Screen
// quality"; both remembered in the browser, personal (the screen's light on the arena stays with the arena: SCREEN.spill)
// gain: the fresco's brightness in the game's light (its tone mapping), before the pause's brightness (SCREEN.brightness)
export const FRESCO = {
  use: 'fresk',
  dir: 'fresco/', segments: ['segment_1.ktx2', 'segment_2.ktx2', 'segment_3.ktx2', 'segment_4.ktx2'],
  masks: ['mask_1.ktx2', 'mask_2.ktx2', 'mask_3.ktx2', 'mask_4.ktx2'],
  period: 36, cycles: [1, 1, 2, 1], phases: [0, 1.7, 3.2, 4.8],
  reveal: [0.08, 0.24], edge: 0.045, seamMix: 0.48, lumPower: 0.85,
  rich: { veil: 0.045, drift: 0.0025, driftPeriod: 48, depth: 0.1 },
  palettes: {
    amber: { shadow: '#302821', light: '#b88a4b', veil: '#99794e' },
    ice: { shadow: '#242c31', light: '#8fadb4', veil: '#819ca2' },
    copper: { shadow: '#302329', light: '#ad7965', veil: '#996d60' },
  },
  auto: { amber: 'amber', ice: 'ice', blood: 'copper' },   // the script light (GLOW.colors key) -> palette (OWNER_ACCEPTED 01.10)
  colors: ['auto', 'amber', 'ice', 'copper'], colorDefault: 'auto',
  qualities: ['rich', 'lean'], qualityDefault: 'rich',
  gain: 1,
  // life (Paweł after playing 021, 01.10.2026: "freski są jak namalowane, bez życia… jak buzująca lekko gotująca się woda
  // lub kłębiące się chmury"): a livelier motion over Astra's. mode: 'chmury' (a mineral smoke curling through the stone,
  // now hiding, now showing the presences), 'woda' (the picture wavers as under simmering water, with small glints) or
  // 'astra' (her motion only); the address may override it: ?ruch=chmury|woda|astra. Sizes in m on the ring, speeds per s;
  // the lean quality uses `leanOctaves` of the noise instead of `octaves`
  life: {
    mode: 'woda', octaves: 4, leanOctaves: 2,
    chmury: { size: 3.2, speed: 0.06, warp: 1.6, strength: 0.55, edge: [0.38, 0.78], rim: 0.25 },
    woda: { size: 1.4, speed: 0.35, shift: 0.012, glint: 0.36 },   // Paweł: "woda jest dobra… zwiększyłbym dwa razy"
    // glints (Paweł: "przebłysków nie ma… Astra robił je bardzo jasne przez chwilę"): small spots flaring up in the light
    // colour of the palette here and there; size m, life s (how fast the field changes), share (higher: rarer, 0..1 of the
    // noise), bright: their light at the peak (above 1 the bloom gives them a halo)
    glints: { on: true, size: 0.35, life: 0.6, share: 0.8, bright: 3 },
  },
};
