// All tunable numbers of the arena fragment: sizes (metres), times (seconds), colours.
// Values are copied from reference/fragment_areny.html; changing them changes the look.
// Scene axes: X along the wall, Y up, +Z away from the wall towards the camera. 1 unit = 1 m.

// Task 027 (K2): the fight's fixed step (s), in the game against the bot and in PvP alike; drawing smooths between the
// steps. A slow frame takes at most maxSteps steps (below 20 frames a second the game slows down instead of jumping)
export const SIM = { step: 1 / 60, maxSteps: 3 };

export const RENDER = {
  pixelRatioMax: 1.5,        // cap on devicePixelRatio (before the resolution slider)
  exposure: 1.05,
  background: 0x030405,
  fog: { color: 0x05070a, density: 0.045 },
  environment: { blur: 0.04, intensity: 0.12 },
  // on: the bloom pass (task 019: a switch for the future "Jakość grafiki")
  bloom: { on: true, strength: 0.6, radius: 0.5, threshold: 0.9 },
  // task 020 (Paweł 01.10.2026): the frame rate's cap, chosen in the pause and remembered in the browser (0: none; the
  // screen's refresh is the limit then). Less work for the laptop when the game would draw more than needed
  frameCap: { choices: [60, 120, 0], default: 120 },
  shadowMapSize: 1024,
  shadowBias: -0.0004,
  resolutionScale: { min: 0.5, max: 1, step: 0.05, default: 1 },
  // task 024 (K6, Paweł 01.10.2026: "6 a)"): the pause's "Image resolution": the share of the screen's pixels drawn (the
  // HUD and the texts stay sharp: they are not drawn by WebGL); only sharpness changes, not what is seen (PvP)
  resolution: { choices: [1, 0.85, 0.7], default: 1 },
  // task 024 (K4): s to wait for the browser to give back a lost graphics context before "refresh the page"
  contextWait: 10,
  // task 024 (K3): the welcome screen's frames per second at most while the game loads behind it
  welcomeFps: 60,
};

export const CAMERA = {
  fov: 42, near: 0.05, far: 90,
  orbit: { maxPolarAngle: Math.PI * 0.5, minDistance: 0.8, maxDistance: 22 },
  moveTime: 1.4,
  // [position, target]
  views: {
    all: [[6.4, 2.9, 14.2], [-1.9, 1.2, 4.6]],
    disc: [[4.6, 2.3, 11.6], [0.6, 0.4, 7.2]],
    panel: [[0.55, 1.85, 2.3], [-0.05, 2.0, 0]],
    elements: [[19.2, 3.4, 19.7], [19.2, 1.0, 3.2]],   // gallery of arena elements (GALLERY)
    shapes: [[44.9, 6.5, 24.5], [44.9, 1.4, 3.2]],     // task 011: the new elements, further along the gallery
    // task 022: the welcome screen (ui/welcome.js): the middle panel's seal close up, a little from the side so its
    // light and the writing head's sparks shine on it (Paweł's screenshot 643); not a button in the test panel
    welcome: [[0.45, 2.3, 1.9], [-0.05, 2.3, 0.13]],
  },
  start: 'play',   // the Play view (task 003); the others are preview views
};

// Light of the machine's script
export const GLOW = {
  colors: { ice: 0x9fe6ff, amber: 0xffb35a, blood: 0xff4a3a },
  default: 'ice',
  base: 0.014,        // engraved script, always faintly lit
  head: 4.0,          // the writing head
  headEdge: 0.002, headFalloff: 110,   // sharp front, tail fading behind the head
  seal: 0.6,
  sealPulse: { mid: 0.5, amp: 0.25, speed: 0.9 },
  waveSpeed: 0.02,    // writing head sweeps per second
  waveSpeedReduced: 0.004, // prefers-reduced-motion
};

export const MATERIALS = {
  ceramic: { color: 0x16171a, metalness: 0, roughness: 1, clearcoat: 0.85, clearcoatRoughness: 0.12 },
  bronze: { color: 0x4a3522, metalness: 0.9, roughness: 1, clearcoat: 0, clearcoatRoughness: 0.3 },
  bone: { color: 0xb3a78f, metalness: 0, roughness: 1.25, clearcoat: 0.15, clearcoatRoughness: 0.5 },
};
export const DEFAULT_MATERIAL = 'ceramic';

export const DARK = { color: 0x0b0c0e, roughness: 0.6, metalness: 0.3 };
export const FLOOR = { color: 0x0a0b0d, roughness: 0.28, metalness: 0.1, clearcoat: 0.4, clearcoatRoughness: 0.3 };
// the chamber wall: the hexagon's side y = 0 of the plan, from its corner x = 66 to x = 14 (task 011)
export const BACK_WALL = { x: [-28.395, 23.605], height: 4.25, z: -0.22, color: 0x08090b, roughness: 0.8 };

export const LIGHTS = {
  hemi: { sky: 0x223040, ground: 0x050505, intensity: 0.08 },
  wallSpot: { color: 0xc9d3de, intensity: 70, distance: 11, angle: 0.5, penumbra: 0.7, decay: 1.6, pos: [0.3, 3.95, 1.5], target: [0, 1.6, 0] },
  discSpot: { color: 0xc9d3de, intensity: 55, distance: 16, angle: 0.62, penumbra: 0.8, decay: 1.5, pos: [-3.2, 4.6, 11.7], target: [0.6, 0, 7.2] },
};

// Wall of three panels. The middle one is the one that lowers into the floor.
export const PANEL = {
  width: 2.2, height: 3.6,
  texPxPerM: 400, glyphSize: 0.105, normalScale: 1.1,
  xs: [-2.75, 0, 2.75],
  seeds: [11, 42, 73],
  waveOffsetStep: 0.37,
  moving: 1,           // index of the panel that moves
  // plates: three columns split at these x; random height min + r·range, last plate at least minLast
  plates: { splits: [-0.6, 0.5], gap: 0.013, depth: 0.12, radius: 0.014, heightMin: 0.35, heightRange: 0.75, minLast: 0.3, topTolerance: 0.05,
    zMin: 0.02, zRange: 0.05, tremorMin: 0.4, tremorRange: 0.8 },
  seal: { x: -0.05, y: 2.35, R: 0.40, depth: 0.06, z: 0.13, tremor: 1.4, ring: { offset: 0.012, tube: 0.006, glow: 1.4 } },
  back: { inset: 0.02, z: -0.045, glow: 0.5 },     // light behind the plates, seen through the seams
  frame: { bar: 0.15, depth: 0.3, z: -0.02 },
  slot: { extraWidth: 0.2, height: 0.012, depth: 0.34, z: 0.05 },   // floor slot the panel sinks into
  light: { y: 1.9, z: 1.1, distance: 9, decay: 2, intensity: 1.2, dimIntensity: 0.6 },
  dimBack: 0.6,        // glow behind the side panels, relative to the moving one
};

// Turntable Ø 9 m with three arms 3.0 × 2.2 × 0.4 m
export const TURNTABLE = {
  radius: 4.5, center: [0.6, 7.2],
  seed: 77, texPxPerM: 170, waveOffset: 0.1, waveSpeed: 0.8, normalScale: 1.0,
  disc: { thickness: 0.08, y: -0.035 },
  rim: { inner: 0.005, outer: 0.04, y: 0.004, glow: 0.35 },   // stays with the floor
  hub: { rTop: 0.62, rBottom: 0.7, height: 0.1, ring: { R: 0.64, tube: 0.008, glow: 1.2 } },
  arms: { length: 3.0, height: 2.2, thickness: 0.4, innerRadius: 0.95, seed: 91, texPxPerM: 300, glyphSize: 0.1, normalScale: 1.1, waveOffset: 0.55, angle0: 0.3,
    cutMin: 1.2, cutRange: 0.9, gap: 0.013, radius: 0.016, tremorMin: 0.5, tremorRange: 1,
    seam: { glow: 0.5, width: 0.9, inset: 0.04, depth: 0.8 }, foot: { glow: 0.25, extraLength: 0.1, extraWidth: 0.08, height: 0.012 } },
  light: { y: 1.2, distance: 12, decay: 2, intensity: 1.0 },
  // silhouette for scale, local to the disc: it turns with it
  figure: { pos: [0.57, -2.54], radius: 0.24, body: 1.05, lift: 0.05, head: 0.13, headY: 1.66, color: 0x121417, roughness: 0.7, metalness: 0.2 },
};

// Movements of the machine. Warning phase is always 1.2 s (rules: every move is announced).
export const MOTION = {
  warning: 1.2,
  auto: true,
  panel: { firstAfter: 7, every: 14, lower: 1.6, down: 1.3, raise: 1.6, depthExtra: 0.2 },
  turn: { firstAfter: 3.5, every: 19, duration: 5.0, degrees: 30, speed: 6 },   // speed °/s: SCRIBE's turns of any size (task 012)
  // warning flash: ramp·x + pulse·max(0, sin(x·π·2·pulses)); then it fades during the move
  warnFlash: { ramp: 0.35, pulse: 0.25, pulses: 3 },
  moveFlash: { panel: 0.3, turn: 0.12 },
  flashGain: 1.4,          // flash -> script brightness
};

// How the machine's light and plates react to a warning (tension 0..1) and flash
export const RESPONSE = {
  panel: {
    tremor: { amount: 0.035, hz: 38, mix: 0.6, phase: 9 },
    back: { base: 0.5, tension: 6, flash: 3 },
    slot: { tension: 4, moving: 2.5 },
    light: { flash: 9, tension: 4 },
  },
  turn: {
    tremor: { amount: 0.025, hz: 40, phase: 7 },
    rim: { tension: 3, turning: 1.2 },
    hubRing: { tension: 3 },
    light: { flash: 8, tension: 3 },
  },
};

// Arena elements from the catalogue, two shape languages each (task 002).
// Shapes and numbers from reference/oslony_areny.html (object BUILD). Local frame: base centre at the origin,
// length along X, height along Y. tex: engraved face [width, height, glyph size] at ELEMENTS.texPxPerM;
// wave: where the writing head starts, per unit of seed.
export const ELEMENTS = {
  texPxPerM: 400,   // task 016: as the panels (was 300; the script was coarser than on the panels)
  // task 011 (U1): not every element gets its own textures. Each engraved part of the same size takes one of texPool
  // textures (by its seed); the elements differ by where the writing head is on them (seed · wave) and how they stand
  texPool: 4,
  // task 011 (Paweł after playing, 29.09.2026: "strzelanie się wśród nagrobków"): the elements have no light of their own
  // like the panels and the turntable, so their script glows this many times GLOW.base between the writing head's passes
  // task 016 (Paweł 30.09.2026: "nadal nie przeniosłeś dyskretnej szlachetności z tych pionowych paneli"): as the panels
  // now that the elements have the panels' light behind their plates (was 6, task 011)
  scriptGlow: 1,
  // task 016 (Paweł 30.09.2026): columns (A), blades and the stepped feet (B) built as the wall's panels
  // (arena/plated.js): plates `plate` m on their flat faces, the light behind their gaps (back); no seal (only on the
  // slabs A, away from the turntable). null: the elements as before
  // plates as thick as the panels' (0.12: through a deep gap the light shows only head-on; thin plates glowed like neon,
  // Paweł 30.09.2026), the light behind them dimmer than the panels' own
  plated: { plate: 0.12, back: { inset: 0.02, z: 0.006, glow: 0.3 } },
  normalScale: 1.1,
  outline: { line: 0.014, height: 0.01, glow: 0.3 },   // glowing footprint on the floor
  zab: {
    // A · Kieł: four-sided tapering spike
    A: { tex: [2.4, 2.6, 0.09], wave: 0.013, rTop: 0.24, rBottom: 0.42, height: 2.6, outline: [0.62, 0.62] },
    // B · Obelisk: two blocks with a glowing core between them and a dark pyramid cap
    B: { size: 0.6, radius: 0.02, low: 1.45, high: 0.82, highBase: 1.57, texLow: [0.6, 1.45, 0.08], texHigh: [0.6, 0.82, 0.08], highSeedOffset: 5,
      waveLow: 0.017, waveHigh: 0.019, core: { size: 0.5, height: 0.13, y: 1.51, glow: 1.1 }, cap: { r: 0.42, height: 0.21, base: 2.39 }, outline: [0.62, 0.62] },
  },
  tafla: {
    // A · Płyta: slab of two plates split by a glowing seam at a random place
    A: { tex: [2.6, 2.2, 0.1], wave: 0.011, length: 2.6, height: 2.2, depth: 0.3, radius: 0.016, cutMin: -0.4, cutRange: 0.8, gap: 0.013,
      seam: { width: 0.9, height: 2.16, depth: 0.24, glow: 0.5 }, outline: [2.62, 0.32],
      // task 016 (Paweł 30.09.2026): built as the wall's panels (arena/plated.js) on both faces: a core `core` m thick,
      // plates `plate` m on each face, the light behind their gaps (back), the seal on the front face (x, y, R)
      plated: { core: 0.06, plate: 0.12, back: { inset: 0.02, z: 0.006, glow: 0.3 }, seal: { x: -0.35, y: 1.35, R: 0.34 }, sealAway: 9 } },
    // B · Łuska: slanted-top scale, leaning back, with a glowing edge along the slant
    B: { tex: [2.6, 2.2, 0.1], wave: 0.013, outlinePts: [[-1.3, 0], [1.3, 0], [1.3, 1.5], [0.3, 2.2], [-1.3, 1.88]], depth: 0.26, bevel: 0.018, lean: 0.17,
      edge: { dir: [1.0, -0.7], pos: [0.8, 1.87, 0.14], size: 0.012, glow: 0.7 }, outline: [2.62, 0.4], outlineZ: 0.05 },
  },
  prog: {
    // A · Belka: rounded beam with a glowing lip on the front face
    A: { tex: [2.6, 0.9, 0.09], wave: 0.011, length: 2.6, height: 0.9, depth: 0.6, radius: 0.13,
      lip: { length: 2.4, size: 0.012, y: 0.66, z: 0.305, glow: 0.6 }, outline: [2.62, 0.62] },
    // B · Grzbiet: triangular ridge with a glowing line along the top
    B: { tex: [2.6, 0.9, 0.09], wave: 0.013, length: 2.6, profile: [[-0.3, 0], [0.3, 0], [0.08, 0.9]], bevel: 0.012,
      ridge: { size: 0.012, y: 0.9, z: -0.08, glow: 0.7 }, outline: [2.62, 0.62] },
  },
  // Task 011: the four new catalogue elements (reference/bryly_areny.html, BUILD; plan/01_PLAN_GRY.md §3.1), both
  // variants of each in the game (DECISIONS.md 28.09.2026: even id = A, odd = B). The parts Puppet Monster will move
  // (later) are groups of their own: the blade's turn about its axis, the wedge's fold, the foot's slide into the wall.
  kolumna: {
    // A · Monolit: a square column of two blocks split by a glowing seam, a glowing top (1.1 × 1.1 × 2.6, sinks)
    A: { tex: [1.1, 2.6, 0.09], wave: 0.011, size: 1.1, height: 2.6, radius: 0.03, cutMin: -0.2, cutRange: 0.4, gap: 0.013,
      seam: { width: 0.9, height: 2.56, depth: 0.02, glow: 0.55 }, cap: { size: 1.0, height: 0.012, glow: 0.45 }, outline: [1.12, 1.12] },
    // B · Pierścienie: three octagonal drums with glowing rings between them and a dark cap
    B: { tiers: [0.95, 0.8, 0.6], radius: 0.6, narrow: 0.05, taper: 0.97, texWidth: 3.6, glyph: 0.08, wave: 0.013, waveStep: 0.2,
      ring: { scale: 0.9, height: 0.09, glow: 1.0 }, cap: { rTop: 0.18, rBottom: 0.48, height: 0.2 }, outline: [1.12, 1.12] },
  },
  lopata: {
    // A · Ostrze: a blade with a slanted end on a dark axis at local x = 0 (3.2 × 0.35 × 2.2, turns about the axis)
    A: { tex: [3.2, 2.2, 0.1], wave: 0.011, profile: [[0.25, 0], [3.2, 0], [3.2, 1.45], [2.2, 2.2], [0.25, 2.2]], depth: 0.3, bevel: 0.016,
      edge: { from: [2.2, 2.2], to: [3.2, 1.45], z: 0.16, size: 0.012, glow: 0.8 },
      axis: { rTop: 0.2, rBottom: 0.24, height: 2.35, segments: 32 }, ring: { R: 0.26, tube: 0.008, y: 0.02, glow: 1.2 },
      arc: { inner: 3.18, outer: 3.22, glow: 0.35 }, outline: [3.2, 0.35], outlineX: 1.6 },
    // B · Skrzydło: two plates of different height split by a glowing seam, a glowing tip, a hexagonal axis with a band
    B: { tex: [3.2, 2.2, 0.1], wave: 0.013, start: 0.25, split: 1.6, end: 3.2, heights: [2.2, 1.9], depth: 0.32, radius: 0.02, gap: 0.013,
      seam: { width: 0.9, height: 1.86, depth: 0.26, y: 0.95, glow: 0.6 }, tip: { width: 0.02, height: 1.86, depth: 0.2, x: 3.21, y: 0.95, glow: 0.5 },
      axis: { r: 0.22, height: 2.4, segments: 6 }, band: { r: 0.225, height: 0.08, y: 1.7, glow: 1.1 },
      arc: { inner: 3.18, outer: 3.22, glow: 0.35 }, outline: [3.2, 0.35], outlineX: 1.6 },
  },
  klin: {
    // A · Rampa: a wall at the front (+z, 1.3 m), a ramp at the back, a glowing lip and hinge (3.0 × 2.0, folds down)
    A: { tex: [3.0, 2.4, 0.1], wave: 0.011, profile: [[-1.0, 0], [1.0, 0], [1.0, 1.3], [0.75, 1.3]], width: 3.0, bevel: 0.016,
      lip: { length: 2.9, size: 0.012, glow: 0.8 }, hinge: { size: 0.014, glow: 0.5 }, outline: [3.02, 2.02] },
    // B · Stopnie: four steps down from the front wall, a glowing line on each edge
    B: { tex: [3.0, 1.3, 0.09], wave: 0.013, waveStep: 0.17, width: 3.0, front: 1.0, steps: [[0.4, 1.3], [0.9, 0.95], [1.4, 0.62], [2.0, 0.3]],
      gap: 0.013, radius: 0.02, line: { length: 2.9, size: 0.012, glowTop: 0.8, glow: 0.45 }, hinge: { size: 0.014, glow: 0.5 }, outline: [3.02, 2.02] },
  },
  stopa: {
    // task 016 (Paweł 30.09.2026): both feet replaced by a panel as the wall's three (arena/elements.js: wallPanel), no
    // light of its own (variant 1); outline: its footprint against the chamber wall (wall at local z = 0). null: the
    // feet as before
    // light: the panel's own light as on the wall (Paweł wants the look copied; its cost on the Intel UHD: report)
    panel: { light: true, outline: [2.52, 0.34], outlineZ: 0.17, wallSide: true },
    // A · Przypora: a buttress out of the chamber wall (wall at local z = 0, the foot towards +z; 2.2 × 1.7 × 4.0),
    // a glowing edge along its slope, a glowing joint with the wall
    A: { tex: [2.2, 4.4, 0.11], wave: 0.011, profile: [[0, 0], [1.7, 0], [1.7, 0.9], [0.35, 4.0], [0, 4.0]], width: 2.2, bevel: 0.02, uvDepth: 0.6,
      edge: { size: 0.012, glow: 0.7 }, joint: { width: 2.3, height: 0.02, depth: 0.05, glow: 0.6 }, outline: [2.22, 1.72], outlineZ: 0.85, wallSide: true },
    // B · Tarasy: three tiers stepping back to the wall, a glowing line on each, glowing rails on the wall
    B: { tex: [2.2, 4.0, 0.1], wave: 0.013, waveStep: 0.21, tiers: [[1.7, 1.3], [1.15, 2.6], [0.6, 4.0]], width: 2.2, narrow: 0.18, gap: 0.013, radius: 0.025,
      // lines and rails dimmed (task 016, Paweł 30.09.2026: they glowed like neon next to the panels; were 0.7 and 0.5)
      line: { size: 0.012, glow: 0.2, inset: 0.1 }, rail: { x: 1.12, width: 0.02, height: 4.0, depth: 0.05, glow: 0.15 }, outline: [2.22, 1.72], outlineZ: 0.85, wallSide: true },
  },
};

// Preview gallery "Elements": the six variants in a row, as in the reference gallery; task 011: the new elements further
// along the row (view "Shapes", as in reference/bryly_areny.html), in a preview scene of its own (U3), not in the arena
export const GALLERY = {
  x: 13, z: 3.2, typeSpacing: 6.2, variantOffset: 1.55,
  order: ['zab', 'tafla', 'prog', 'kolumna', 'lopata', 'klin', 'stopa'],
  // per type: the variants' offset (the blade's axis at one end: shifted back by half its length), the foot at a wall
  // the new elements start this far further on, out of the Elements view (it stays as in the reference)
  newFrom: 'kolumna', newGap: 4,
  shift: { lopata: -1.6 }, wideOffset: { kolumna: 1.9, lopata: 1.9, klin: 1.9, stopa: 1.9 }, wallZ: { stopa: -0.8 },
  seed: (typeIndex, variantIndex) => 40 + typeIndex * 10 + variantIndex,
  spot: { color: 0xc9d3de, intensity: 55, distance: 11, angle: 0.55, penumbra: 0.75, decay: 1.6, height: 4.1, forward: 2.4, targetY: 0.9 },
  // the tall buttress foot's own light, as in reference/bryly_areny.html
  spotTall: { type: 'stopa', intensity: 30, distance: 15, side: 3.5, height: 5.6, forward: 3.5 },
  glowLight: { intensity: 0.8, distance: 6, decay: 2, y: 1.4, forward: 1.2 },
  figure: [3.1, 0.9],   // offset from the gallery start, for scale
};

// The arena section (task 011): every element of tools/sim/arena.json whose base centre is within `radius` of turntable
// 0's centre (plan 37.005, 7.565) and inside the hexagon: 83 in the plan, of them built here 78; left out: the
// turntable's three arms (20–22, turntable.js builds them) and its axis (tooth 23), and buttress foot 4 (it stands where
// the wall of panels is: Paweł, 28.09.2026, OWNER_ACCEPTED in task 011; it may come back when the whole arena is built).
// Plan (x, y) -> scene X = 37.605 - x, Z = y - 0.365 (DECISIONS.md 27.09.2026). Base centre at (x, 0, z) (the blade:
// its axis; a buttress foot: at the chamber wall), rotation.y = rotY, length along local X. rotY: the plan's longest
// edge (tooth, slab, sill; the 20 elements of task 002 keep their table values), the plan's angle `ang` (column,
// wedge, blade: local +X along it, the wedge's front wall on the right of it), 0 (foot: out of the wall, towards +Z).
// Variant: DECISIONS.md 27.09.2026 (tooth, slab, sill) and 28.09.2026 (even id = A, odd = B). Texture seed = id (a pool
// of textures: ELEMENTS.texPool). move: the plan's kind of move; final: the height after SCRIBE's final phase (plan Hf,
// plan/01_PLAN_GRY.md §3.1); rot: a blade's turning range in degrees (plan), task 012.
export const ARENA_SECTION = {
  plan: { center: [37.005, 7.565], radius: 23 },
  // the temporary boundary where the section does not reach the chamber wall (U12; Paweł, 28.09.2026: chest high):
  // a low wall along an arc around the turntable's centre, its inner face at `radius`, from the chamber wall to the
  // chamber wall; a glowing line at its foot. No invisible obstacle: it is what stops the character.
  boundary: { radius: 24, height: 1.3, thickness: 0.3, segments: 64, line: { height: 0.012, depth: 0.03, glow: 0.6 } },
  // white work lights over the groups of elements, as LIGHTS.wallSpot over the panels (Paweł after playing, 29.09.2026:
  // "musisz powielić efekt albo mamy cmentarz": the ceramic's gloss is the reflection of a light). No shadows (the
  // Intel UHD). light: the common values; spots: [x, z] of the point lit, the light stands `back` m from it towards the
  // turntable's centre, `height` m up
  lights: {
    light: { color: 0xc9d3de, intensity: 220, distance: 26, angle: 1.05, penumbra: 0.9, decay: 1.5, height: 11, back: 3, targetY: 0.8 },
    // two rings round the turntable (10 m: 2 lights, 18 m: 5 lights), even over the whole section
    spots: [[8.8, 12.9], [-7.6, 12.9], [18.3, 10.3], [12.2, 21.0], [0.6, 25.2], [-11.0, 21.0], [-17.1, 10.3]],
  },
  // the floor: a disc under the section, as far as the boundary's outer face
  floor: { radius: 24.4, segments: 96 },
  elements: [
    { id: 24, type: 'zab', variant: 'A', x: -5.24, z: 9.52, rotY: -1.945, move: 'sink', final: 2.6 },
    { id: 25, type: 'zab', variant: 'A', x: 6.36, z: 3.99, rotY: 2.804, move: 'sink', final: 0 },
    { id: 26, type: 'zab', variant: 'A', x: 0.75, z: 14.2, rotY: -1.736, move: 'sink', final: 0 },
    { id: 27, type: 'zab', variant: 'A', x: 6.93, z: 8.01, rotY: -2.508, move: 'sink', final: 2.6 },
    { id: 54, type: 'zab', variant: 'A', x: 20.21, z: 6.21, rotY: -0.68, move: 'sink', final: 2.6 },
    { id: 55, type: 'zab', variant: 'A', x: 17.85, z: 10.92, rotY: 0.353, move: 'sink', final: 0 },
    { id: 56, type: 'zab', variant: 'A', x: 9.87, z: 7.82, rotY: 2.274, move: 'sink', final: 0 },
    { id: 57, type: 'zab', variant: 'A', x: 14.6, z: 13.19, rotY: -0.515, move: 'sink', final: 2.6 },
    { id: 74, type: 'zab', variant: 'A', x: -0.12, z: 29.3, rotY: 1.908, move: 'sink', final: 0 },
    { id: 76, type: 'zab', variant: 'A', x: 3.83, z: 28.65, rotY: 1.455, move: 'sink', final: 0 },
    { id: 97, type: 'zab', variant: 'A', x: 14.96, z: 19.64, rotY: -1.521, move: 'sink', final: 0 },
    { id: 98, type: 'zab', variant: 'A', x: 2.68, z: 19.66, rotY: -1.771, move: 'sink', final: 0 },
    { id: 99, type: 'zab', variant: 'A', x: 7.87, z: 18.69, rotY: -1.354, move: 'sink', final: 2.6 },
    { id: 178, type: 'zab', variant: 'A', x: -21.38, z: 6.2, rotY: 1.196, move: 'sink', final: 0 },
    { id: 182, type: 'zab', variant: 'A', x: -18.04, z: 2.57, rotY: 0.62, move: 'sink', final: 0 },
    { id: 183, type: 'zab', variant: 'A', x: -13.33, z: 1.13, rotY: 1.72, move: 'sink', final: 2.6 },
    { id: 184, type: 'zab', variant: 'A', x: -15.59, z: 1.54, rotY: -1.736, move: 'sink', final: 0 },
    { id: 185, type: 'zab', variant: 'A', x: -12.22, z: 3.83, rotY: 0.359, move: 'sink', final: 0 },
    { id: 186, type: 'zab', variant: 'A', x: -7.33, z: 1.2, rotY: 2.693, move: 'sink', final: 2.6 },
    { id: 187, type: 'zab', variant: 'A', x: -17.08, z: 9.48, rotY: -0.434, move: 'sink', final: 0 },
    { id: 190, type: 'zab', variant: 'B', x: -6.1, z: 13.38, rotY: -3.012, move: 'sink', final: 0 },
    { id: 191, type: 'zab', variant: 'B', x: -7.36, z: 11.51, rotY: 1.964, move: 'sink', final: 0 },
    { id: 194, type: 'zab', variant: 'B', x: 16.96, z: 20.01, rotY: 0.684, move: 'sink', final: 0 },
    { id: 197, type: 'zab', variant: 'B', x: 7.32, z: 28.7, rotY: -1.729, move: 'sink', final: 0 },
    { id: 199, type: 'zab', variant: 'B', x: -18.84, z: 10.42, rotY: 0.431, move: 'sink', final: 0 },
    { id: 201, type: 'zab', variant: 'A', x: -3.43, z: 11.13, rotY: 1.621, move: 'sink', final: 2.6 },
    { id: 202, type: 'zab', variant: 'A', x: -1.61, z: 13.88, rotY: -2.604, move: 'sink', final: 0 },
    { id: 212, type: 'zab', variant: 'A', x: 1.04, z: 26.68, rotY: -1.604, move: 'sink', final: 0 },
    { id: 215, type: 'zab', variant: 'A', x: -4.55, z: 3.13, rotY: -3.092, move: 'sink', final: 0 },
    { id: 216, type: 'zab', variant: 'A', x: -11.49, z: 26.11, rotY: -1.604, move: 'sink', final: 2.6 },
    { id: 218, type: 'zab', variant: 'A', x: 5.89, z: 27.25, rotY: 2.251, move: 'sink', final: 0 },
    { id: 219, type: 'zab', variant: 'A', x: 0.93, z: 20.71, rotY: -0.56, move: 'sink', final: 2.6 },
    { id: 220, type: 'zab', variant: 'A', x: 15.95, z: 17.32, rotY: 1.056, move: 'sink', final: 0 },
    { id: 222, type: 'zab', variant: 'A', x: 12.09, z: 2.31, rotY: 1.945, move: 'sink', final: 2.6 },
    { id: 224, type: 'zab', variant: 'A', x: 7.29, z: 11.29, rotY: 2.508, move: 'sink', final: 0 },
    { id: 229, type: 'zab', variant: 'A', x: 12.06, z: 25.92, rotY: 1.01, move: 'sink', final: 0 },
    { id: 100, type: 'tafla', variant: 'B', x: -5.13, z: 15.97, rotY: -2.06, move: 'sink', final: 0 },
    { id: 101, type: 'tafla', variant: 'B', x: -4.84, z: 19.1, rotY: 1.097, move: 'sink', final: 0 },
    { id: 102, type: 'tafla', variant: 'A', x: -1.71, z: 19.89, rotY: 1.086, move: 'sink', final: 0 },
    { id: 103, type: 'tafla', variant: 'B', x: -7.24, z: 21.29, rotY: -1.947, move: 'sink', final: 0 },
    { id: 104, type: 'tafla', variant: 'B', x: -0.88, z: 23.1, rotY: 1.133, move: 'sink', final: 0 },
    { id: 105, type: 'tafla', variant: 'A', x: -10.36, z: 23.68, rotY: -2.074, move: 'sink', final: 0 },
    { id: 106, type: 'tafla', variant: 'B', x: -6.97, z: 24.22, rotY: 1.212, move: 'sink', final: 0 },
    { id: 107, type: 'tafla', variant: 'B', x: -3.85, z: 25.56, rotY: 1.068, move: 'sink', final: 0 },
    { id: 108, type: 'tafla', variant: 'A', x: -7.12, z: 27.22, rotY: 1.196, move: 'sink', final: 0 },
    { id: 115, type: 'tafla', variant: 'B', x: 18.56, z: 16.25, rotY: 0.012, move: 'sink', final: 0 },
    { id: 117, type: 'tafla', variant: 'A', x: -18.25, z: 16.12, rotY: 2.147, move: 'sink', final: 0 },
    { id: 118, type: 'tafla', variant: 'B', x: -15.22, z: 13.48, rotY: 2.263, move: 'sink', final: 0 },
    { id: 119, type: 'tafla', variant: 'B', x: -17.86, z: 19.72, rotY: 2.154, move: 'sink', final: 0 },
    { id: 120, type: 'tafla', variant: 'A', x: -14.94, z: 17.43, rotY: 2.174, move: 'sink', final: 0 },
    { id: 121, type: 'tafla', variant: 'B', x: -11.79, z: 14.97, rotY: -0.86, move: 'sink', final: 0 },
    { id: 122, type: 'tafla', variant: 'B', x: -14.13, z: 20.59, rotY: 2.171, move: 'sink', final: 0 },
    { id: 123, type: 'tafla', variant: 'A', x: -11.34, z: 18.55, rotY: 2.258, move: 'sink', final: 0 },
    { id: 51, type: 'prog', variant: 'A', x: 9.76, z: 4.68, rotY: 1.283, move: 'sink', final: 0.9 },
    { id: 52, type: 'prog', variant: 'A', x: 21.86, z: 7.28, rotY: 0.873, move: 'sink', final: 0.9 },
    { id: 53, type: 'prog', variant: 'A', x: 21.57, z: 3.79, rotY: -0.174, move: 'sink', final: 0.9 },
    { id: 96, type: 'prog', variant: 'A', x: 13.89, z: 16.52, rotY: 0.96, move: 'sink', final: 0.9 },
    { id: 116, type: 'prog', variant: 'B', x: 19.91, z: 12.84, rotY: 0.927, move: 'sink', final: 0.9 },
    { id: 124, type: 'prog', variant: 'B', x: -14.64, z: 24.34, rotY: 2.975, move: 'sink', final: 0.9 },
    { id: 125, type: 'prog', variant: 'B', x: -9.46, z: 14.3, rotY: -1.061, move: 'sink', final: 0.9 },
    { id: 140, type: 'prog', variant: 'B', x: -1.28, z: 16.88, rotY: -0.182, move: 'sink', final: 0.9 },
    { id: 156, type: 'prog', variant: 'A', x: -10.6, z: 9.7, rotY: 3.126, move: 'sink', final: 0.9 },
    { id: 157, type: 'prog', variant: 'A', x: -17.46, z: 6.22, rotY: 2.244, move: 'sink', final: 0.9 },
    { id: 174, type: 'kolumna', variant: 'A', x: -21.11, z: 8.57, rotY: -1.131, move: 'sink', final: 0.9 },
    { id: 179, type: 'kolumna', variant: 'B', x: -14.79, z: 9.06, rotY: 3.074, move: 'sink', final: 0.9 },
    { id: 180, type: 'kolumna', variant: 'A', x: -11.37, z: 5.97, rotY: -2.205, move: 'sink', final: 0.9 },
    { id: 181, type: 'kolumna', variant: 'B', x: -8.22, z: 7.6, rotY: -0.887, move: 'sink', final: 0.9 },
    { id: 91, type: 'lopata', variant: 'B', x: 10.69, z: 22.57, rotY: 0.954, move: 'rotate', final: 1, rot: [-65, 90] },
    { id: 92, type: 'lopata', variant: 'A', x: 5.87, z: 15.73, rotY: -3.094, move: 'rotate', final: 1, rot: [-90, 90] },
    { id: 93, type: 'lopata', variant: 'B', x: 11.28, z: 14.33, rotY: 3.136, move: 'rotate', final: 1, rot: [-55, 90] },
    { id: 94, type: 'lopata', variant: 'A', x: 10.45, z: 24.11, rotY: -3.134, move: 'rotate', final: 1, rot: [-35, 70] },
    { id: 95, type: 'lopata', variant: 'B', x: 2.69, z: 22.14, rotY: 0.059, move: 'rotate', final: 1, rot: [-90, 40] },
    { id: 154, type: 'klin', variant: 'A', x: -14.98, z: 4.74, rotY: -1.161, move: 'fold', final: 0.7 },
    { id: 155, type: 'klin', variant: 'B', x: -8.87, z: 4.16, rotY: -1.129, move: 'fold', final: 0.7 },
    { id: 2, type: 'stopa', variant: 'A', x: 18.26, z: -0.22, rotY: 0.0, move: 'static', final: 4 },
    { id: 3, type: 'stopa', variant: 'B', x: 9.56, z: -0.22, rotY: 0.0, move: 'static', final: 4 },
    { id: 5, type: 'stopa', variant: 'B', x: -10.6, z: -0.22, rotY: 0.0, move: 'static', final: 4 },
    { id: 6, type: 'stopa', variant: 'A', x: -20.39, z: -0.22, rotY: 0.0, move: 'static', final: 4 },
  ],
};

// ---- Player (task 003). All values are temporary, to be tuned after Paweł plays. ----

// Controls. Pad: standard Gamepad API mapping of an Xbox pad (buttons 0 A, 1 B, 2 X, 3 Y, 6 LT, 7 RT, 9 Menu, 10 LS;
// axes 0/1 left stick, 2/3 right stick). Keys: KeyboardEvent.code; mouse: MouseEvent.button.
export const INPUT = {
  pad: {
    move: [0, 1], look: [2, 3], deadzone: 0.15,   // radial dead zone of both sticks
    aim: 6, shoot: 7, dodgeCrouch: 1, menu: 9,
    reload: 2, medkit: 3,   // X reload, Y medkit, as in The Division (DECISIONS.md 28.09.2026)
    cover: 0, shoulder: 11,   // A: cover / vault; right stick click: switch shoulder (task 005)
    // task 014 (Paweł 01.10.2026: "kamera mi ucieka na lewe ramię, ale może z emocji wduszam drążek"): the click switches
    // the shoulder only while the right stick is pushed less than this (a hard push while aiming does not count)
    shoulderStill: 0.35,
    grenade: 5, key: 4,       // task 017: RB grenade, LB the machine's key (held: preview; let go: use; B: cancel)
    // sprint as in The Division (Paweł, 27.09.2026): a click of the left stick starts it; it lasts while
    // the stick is pushed and ends when the stick is released, on aim or on crouch
    sprintToggle: 10,
    triggerThreshold: 0.5,
    dodgeDoubleTap: 0.30,   // two presses of B within this time = dodge
    crouchHold: 0.35,       // B held this long = crouch on/off
  },
  keys: {
    forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
    sprint: ['ShiftLeft', 'ShiftRight'], crouch: 'KeyC', dodge: 'Space', menu: 'Escape', cover: 'KeyE', shoulder: 'KeyQ',
    reload: 'KeyR', medkit: 'KeyF',
    grenade: 'KeyG', key: 'KeyV', cancel: 'KeyX',   // task 017 (cancel: B on the pad)
    mouseAim: 2, mouseShoot: 0,
  },
  hintSeconds: 8,           // controls hint after entering the Play view
};

export const PLAYER = {
  radius: 0.30, height: 1.80, crouchHeight: 1.20,
  speed: 3.5, sprintSpeed: 6.8, crouchSpeed: 1.8,   // sprint 5.5 -> 7.5 (003), 7.5 -> 6.8 (004, the sprint animation's own pace): Paweł, 27.09.2026
  aimSpeed: 1.8,      // walking while aiming, as in The Division (task 004); crouched: crouchSpeed
  accelTime: 0.15, brakeTime: 0.10,   // time to full speed / to a stop
  // dodge: fixed distance and time along the left stick (no stick: backwards from the camera);
  // no steering during it; cooldown counts from the end of the previous dodge. Time 0.55 -> 0.9 in task 004:
  // the roll animation would otherwise play more than twice as fast as recorded
  dodge: { distance: 3.0, time: 0.9, cooldown: 0.8 },
  maxSlope: 35, step: 0.30,
  gravity: 9.81, skin: 0.02, snapToGround: 0.3,
  spawn: { x: 3.0, z: 13.0, yaw: 0 },   // yaw 0 = facing −Z (the turntable and the wall)
};

// The match's spawn points (task 011; levels with rounds; the Dummy level and ?freeze keep PLAYER.spawn and the Dummy's
// place): far apart and out of sight of each other (eyes, torso and hips; also from 1 m around them) with the turntable
// at both its angles, 0° and 30° (zadania/011_raport.md); yaw: the view's (0 faces −Z), towards the section's middle
export const MATCH_SPAWN = {
  // 36 m apart, mirrored across the turntable's axis X = 0.6 (the same start for both sides)
  player: { x: 18.6, z: 14.0, yaw: 1.648 },
  foe: { x: -17.4, z: 14.0, yaw: -1.648 },
};

// Over-the-shoulder camera; aim values while LT / right mouse button is held.
// Pitch: positive looks up.
export const TPP = {
  side: 0.55, height: 1.65, distance: 2.6, fov: 60,
  aim: { side: 0.45, height: 1.60, distance: 1.3, fov: 45, crouchHeight: 1.10 },
  crouchHeight: 1.15,   // the camera lowers when crouching (task 004), in the same time as aiming
  aimTime: 0.15,
  padYaw: 160, padPitch: 110,          // degrees per second at full stick
  pitchMin: -35, pitchMax: 50,
  mouseDegPerPixel: 0.12,
  collisionRadius: 0.2,
};

// ?freeze in the address: writing head, seal and arena moves stop here (for screenshots)
export const FREEZE = { wave: 0.3, seal: 0.5 };

// an element's data as its footprint and its build read it: the feet replaced by panels (task 016) take the panel's
// footprint (outline, outlineZ, wallSide)
export function elementSpec(type, variant) {
  const e = ELEMENTS[type][variant];
  return type === 'stopa' && ELEMENTS.stopa.panel ? { ...e, ...ELEMENTS.stopa.panel } : e;
}

// task 016 (Paweł 30.09.2026: "te świecące neonowo linie… dominują scenę… nie osiągniemy klimatu, a tylko mamy klub
// techno"): one knob per group for the glowing accent lines (their brightness × this): the elements' edges, lips,
// seams, caps and their outlines on the floor; the section's boundary line; the turntable's rim, hub ring, arm seams
// and feet. 1: as before. The panels' seals and the light behind the plates are not accents
// outlines: the elements' footprints on the floor (Paweł 30.09.2026: "przygaś jeszcze obrysy na podłodze"); the rest to
// the calibration ("za dużo jest światła ogólnego… dyskoteka, na której ktoś zapalił górne światło")
export const ACCENTS = { elements: 0.25, outlines: 0.08, boundary: 0.3, turntable: 0.35 };

// Task 019 (Paweł 30.09.2026: "klimat dyskoteki, w której włączono jarzeniówki; zniknęły cienie dające poczucie
// zagrożenia"): the arena's light. 'plamy': pools of warm light over the groups of elements with shadow between them
// (sketch B, reference/klimat_szkice/B_plamy_swiatla.jpg), less light from the sky and from the environment; 'dzis': the
// light as up to task 018. A mood's values replace those of RENDER.environment (intensity), LIGHTS.hemi (intensity),
// LIGHTS.wallSpot / discSpot and ARENA_SECTION.lights.light (spot). shadows: the section's spots cast shadows (a switch
// for the future "Jakość grafiki"; off: the same pools, no shadows; wallSpot and discSpot cast them since task 001),
// mapSize px, bias / normalBias against shadow acne
export const MOOD = {
  use: 'plamy',
  plamy: {
    environment: 0.05, hemi: 0.03,
    spot: { color: 0xffd2a0, intensity: 260, angle: 0.7, penumbra: 0.45 },
    wallSpot: { color: 0xffd2a0, intensity: 110, angle: 0.8 }, discSpot: { color: 0xffd2a0 },
    shadows: { on: true, mapSize: 1024, bias: -0.0004, normalBias: 0.03 },
  },
  dzis: { shadows: { on: false } },
};

// the address may override the switches for a side-by-side look: ?mood=dzis|plamy, ?shadows=off, ?bloom=off
const ASK = new URLSearchParams(globalThis.location?.search ?? '');
if (ASK.get('bloom') === 'off') RENDER.bloom.on = false;

// the light in use: the chosen mood over the values of the data above
// task 020: the spotlights' shadow maps drawn again only when something moves in their cone (look/shadows.js);
// fighterRadius: a fighter as a sphere this big (m), round its chest; recollect: s between looks for new lights and solids
export const SHADOWS = { onDemand: true, fighterRadius: 1.2, recollect: 2 };

export const LIT = (() => {
  const m = MOOD[ASK.get('mood') in MOOD ? ASK.get('mood') : MOOD.use];
  return {
    environment: m.environment ?? RENDER.environment.intensity,
    hemi: { ...LIGHTS.hemi, intensity: m.hemi ?? LIGHTS.hemi.intensity },
    wallSpot: { ...LIGHTS.wallSpot, ...m.wallSpot }, discSpot: { ...LIGHTS.discSpot, ...m.discSpot },
    spot: { ...ARENA_SECTION.lights.light, ...m.spot },
    shadows: { mapSize: RENDER.shadowMapSize, bias: RENDER.shadowBias, normalBias: 0, ...m.shadows, ...(ASK.get('shadows') === 'off' && { on: false }) },
  };
})();

// Task 020 (DECISIONS 01.10.2026): the floor of polished stone under the arena section, paired with the panels'
// material (ceramic -> light grey stone as in reference/klimat_szkice/posadzka/astra_plyty.png, Paweł 01.10.2026: "piaskowiec
// nie jest dobry… wolę jego wzór"; bronze and bone -> dark slate). Large irregular plates (cells round seeded
// points, `plate` m apart on average, `jitter` 0..1 how irregular), thin dark joints `joint` m wide (`jointDark`: their
// brightness × this), arcs let into the stone round the turntable (`arcs.radii` m from its centre, each cut into
// `segments` pieces of which `gap` are left out), a calm grain (`grain`: its size in m and how much it changes the
// tone), the plates' worn darker edges (`wear`: how far in, m, and how dark), thin dark veins (`veins`: their size in m, how dark, how thin), each plate a little lighter or darker (`tone`). opal: this share of the plates has an oil-like sheen that
// changes colour with the angle you look from (only in the reflection of a light; `on` false: none). use: 'kamien' or
// 'dzis' (the dark floor of FLOOR as up to task 019); the address may override it: ?floor=dzis. choices (Paweł
// 01.10.2026: "gracze uwielbiają dostosowywać elementy gry pod swój gust"): the floor picked in the settings like the
// panels' material, `choice` at the start: 'pair' (paired with the panels), a kind of stone, or 'dzis'. In PvP the
// arena's look is the match's setting, picked by the host and the same for both (BOARD U42)
export const STONE = {
  use: 'kamien', choices: ['pair', 'stone', 'slate', 'dzis'], choice: 'pair',
  seed: 20261001, plate: 1.7, jitter: 0.85, joint: 0.009, jointDark: 0.35, tone: 0.18,
  grain: { size: 0.9, amount: 0.28 }, wear: { width: 0.04, dark: 0.3 }, veins: { size: 2.2, dark: 0.35, thin: 0.008 },
  // the stone's surface inside the plates (Paweł 01.10.2026: "astry ma fakturę, twoja to czysta, płaska tekstura"): a
  // CC0 photo texture from Poly Haven (public/floor/<name>_detail.jpg: R its tone, G its roughness, both 0.5 on average;
  // <name>_nor.jpg: its relief), `size` m per repeat, turned and moved differently on every plate; tone/rough/bump: how
  // strongly it changes the tone, the roughness and the relief. name null: no photo texture (the computed grain only)
  texture: { name: 'concrete_floor_02', size: 2.4, tone: 0.8, rough: 0.6, bump: 1 },
  arcs: { radii: [6.2, 9.4, 13.8, 18.6], width: 0.014, segments: 7, gap: 0.3 },
  // (tint: how much the plate's own colour runs through the rainbow with the angle you look from, bands: how fast; it
  // shows where light falls on it, the thin-film sheen of strength/ior/thickness in the light's reflection)
  opal: { on: true, share: 0.06, strength: 1, ior: 1.5, thickness: [180, 520], tint: 0.25, bands: 3 },
  kinds: {
    stone: { color: 0x6e6a63, roughness: 0.26, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.25 },
    slate: { color: 0x2a2c2f, roughness: 0.28, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.25 },
  },
  pair: { ceramic: 'stone', bronze: 'slate', bone: 'slate' },
};

// Task 020: bullet marks on the arena's solids (the elements, the wall of panels, the turntable's arms): a small dark
// hole with a chipped ring lighter than the surface; `size` m across, `chip` the ring's brightness, at most `limit`
// at a time (the oldest goes first), all gone at the start of every round. on: false = no marks
// reach: the drawn surface is looked for this far (m) before and behind the point the shot hit the collider; glow: the
// chips' own faint light (so they read in shadow too; far below the bloom: no shine)
export const MARKS = { on: true, size: 0.06, chip: 0.85, glow: 0.06, limit: 200, lift: 0.002, reach: 0.5 };
