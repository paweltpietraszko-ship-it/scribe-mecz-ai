// The LED screen round the arena (task 013, U32; Paweł after seeing reference/ekran_areny.html: "Ekran dodał życia, nie
// jest nachalny, nie doświetla areny, uzupełnia, nie przeszkadza"). Numbers from the reference; the ring stands round
// turntable 0 on the far chamber wall; when the whole arena is built it moves to the chamber's walls (centre, radius).

export const SCREEN = {
  center: [0.6, 7.2],      // turntable 0's centre (scene X, Z)
  radius: 34, y0: 5.5, height: 12,
  segments: 256,
  // the screen's pixels and content (the shader): LED grid, script columns, scroll speeds, the writing head
  pixels: [2400, 110], columns: 150,
  sectors: false,          // six walls with their own rhythm, scale and sign (landmarks): on in the data, Paweł judges
  // the look (Paweł after playing 013, 29.09.2026: "ekran jest wyblakły, te symbole nie mają efektu AI/Obcy" → "obca
  // maszyna, coś pomiędzy"): deep black (base: the panel's own glow; the reference had 0.035), the script glows (above 1
  // the bloom gives it a halo), the writing head leaves a bright trail (trail: how fast it fades behind, per ring),
  // single glyphs flare up and change (flare: share of the glyphs at a time, flareRate per second), now and then a
  // glitch runs across the screen (glitchChance per glitchRate tick)
  look: { base: 0.008, glyph: 0.5, head: 2.8, headWidth: 40, trail: 14, flare: 0.012, flareRate: 3, flareGain: 3, flareWhite: 0.6,
    glitchRate: 0.7, glitchChance: 0.25, glitchHeight: 0.04, glitchShift: 0.03, glitchGain: 0.9 },
  bezel: { height: 0.5, out: 0.3, color: 0x07080a },
  pillars: { count: 24, width: 0.9, depth: 1.2, out: 0.6, above: 2 },
  wall: { out: 1.2, height: 40, y: 16, color: 0x050607 },
  atlas: { width: 1024, height: 2048, strips: 16, glyph: 56, line: 5, seed: 909 },
  // the alarm: a wave of light runs round the ring from one place (camping: where the penalty is; final phase: from
  // `finalFrom` places); it lasts `time` s
  alarm: { time: 3, color: [1, 0.45, 0.35], finalFrom: 3 },
  // the screen lights the arena a little in its colour: a light from the sky and a few weak lights round, more during
  // an alarm (the reference: 0.10 + 0.25 · alarm, 3.5 + 14 · alarm)
  spill: { sky: 0.10, skyAlarm: 0.25, points: 0, point: 3.5, pointAlarm: 14, pointDistance: 60, pointDecay: 1.2, pointRadius: 26, pointY: 11, pointAngle: 0.4 },
  // the brightness from the pause ("Ekran"), remembered in the browser
  brightness: { low: 0.55, mid: 1, high: 1.6, off: 0 },
  defaultBrightness: 'mid',
};
