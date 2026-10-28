// Task 024 (K5, Paweł 01.10.2026: "5 TAK"): the start's test of the computer. The criterion is how the game really runs,
// not the kind of card (a strong integrated chip may pass, Intel UHD does not): the cost of a whole frame (the CPU's work
// and the card's) while two bots fight in the arena, always drawn at width × height whatever the window or the screen.
export const BENCH = {
  width: 1920, height: 1080,             // the most pixels drawn (task 026: else the game's own size on the device)
  warmup: 2, measure: 4,                 // s: not counted (shaders and files are ready already), then measured
  // ms per frame: the median and the 99th percentile (1 % worst). method 2 (task 026: the time from frame to frame, as
  // the player gets them; it holds the screen's refresh too, 16.7 ms at 60 Hz): its own limits (Paweł 02.10.2026:
  // "progi 24 i 40 ok", set for the pixel read back of 024)
  limits: { median: 12, worst: 20 }, limits2: { median: 24, worst: 40 },
  minValid: 2,                           // s of valid frames before a disruption that already make the verdict "too weak"
  minFrames: 30,                         // fewer valid frames than this, the rest thrown away (GPU_DISJOINT): no measurement
  retries: 1,                            // an invalid test is run again this many times at once
  // where the two bots start (scene x, z): 12 m apart across the middle, so they meet within the test; the camera: view
  view: 'all', spots: [[3.0, 13.0], [-1.5, 2.0]],
  store: 'theone.bench', anyway: 'theone.benchAnyway',   // the remembered result, "Play anyway"
};
