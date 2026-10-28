// SCRIBE (task 012; formerly Puppet Monster): the machine that moves the arena's elements. All numbers from
// plan/01_PLAN_GRY.md §3.1 and §4 and from the simulator's v4 rules (tools/sim/sim.py), temporary, to be tuned after
// Paweł plays. SCRIBE knows where both fighters are and counts lines of fire; it never reads anyone's health.
// Times in seconds, distances in metres, angles in degrees.

export const SCRIBE = {
  enabled: true,        // the default (Paweł, 29.09.2026: on); the pause and ?scribe=off switch it, remembered in the browser

  // ---- the mechanisms (part A) ----
  heights: { zab: 2.6, tafla: 2.2, prog: 0.9, kolumna: 2.6, lopata: 2.2, klin: 1.3, stopa: 4.0, ramie: 2.2 },   // §3.1
  // the turntable's three arms go down like the walls (Paweł, 29.09.2026: "jeżeli panele na obrotnicy nie będą się chować
  // to nawet boty tam kampią"; the simulator's v4 sinks them too); final height §3.1
  armFinal: 1.0,
  warn: 1.2,            // every move is announced this long before (§4.2): the element drops a little and its line lights
  warnDrop: 0.03,       // m the element drops during the announcement
  warnGlow: 2.2,        // brightness of the lit line (footprint, axis ring) during the announcement and the move
  // how long a move takes, by the kind of element (§3.1: 1.5 s, the column 2 s, the wedge 2 s; the blade 60°/s)
  moveTime: { zab: 1.5, tafla: 1.5, prog: 1.5, kolumna: 2, klin: 2, stopa: 2, ramie: 1.5 },
  bladeSpeed: 60,       // °/s
  foldTo: 0.7,          // m: a folded wedge (§3.1)
  slideBack: 1.7,       // m: a buttress foot slides back into the chamber wall this far
  // "lift doors": a move that would enter a fighter waits this long and tries again
  liftWait: 0.5,
  liftGiveUp: 2,        // s: a move held that long by a fighter goes back where it came from (as lift doors reopen)
  liftMargin: 0.1,      // m added to the capsule's radius
  // sounds by the kind of move (data/sound.js)
  sounds: { warn: 'zapowiedz_ruchu', down: 'panel_w_dol', up: 'panel_w_gore', turn: 'obrotnica' },

  // ---- the events (part B, §4.1) ----
  blocks: 1.75,         // m: an element this high or higher blocks a line of fire (the simulator's threshold)
  corridor: 0.35,       // m: half width of the line an opening clears
  eyes: 1.6,            // m: the height of the lines SCRIBE checks between the fighters
  // line opening: checked every `every` s; the gap between openings, the distance and the number of elements grow
  // with the silence (no contact)
  opening: { every: 1, gap: 15, gapQuiet: 8, quiet: 30, dist: [10, 30], distQuiet: 38, max: 4, maxQuiet: 6, maxLong: 9, long: 50,
    hold: 3, holdLong: 4 },
  bluff: { every: [20, 30], count: [1, 3], hold: 3 },
  random: { every: [8, 14], length: 25, max: 5, hold: 3, tries: 20 },
  ambient: { every: [4, 8], hold: 4 },
  // the turntable: a big turn now and then, either way (Paweł, 29.09.2026: instead of ±30° back and forth), at
  // MOTION.turn.speed °/s
  turntable: { every: [15, 25], degrees: [90, 180] },
  panel: { every: [12, 20] },           // the middle panel of the wall goes down now and then, as before
  // camping (Paweł's rule, public): staying within `radius` of the place for the limits in turn → every wall within
  // `reach` goes down (blades turn, wedges fold, feet slide back); they come back when the fighter leaves
  camp: { radius: 6, reach: 12, limits: [10, 7, 5], minHeight: 1.0, warnLast: 3, backAfter: 1 },
  // push: a long silence and a fighter standing still → the cover around it goes for `hold` s
  push: { quiet: 40, still: 6, stillSpeed: 0.3, reach: 7, hold: 8, cooldown: 20, warn: 1.5 },
  // cover drain: after a long silence the cover goes from the edge inwards, the radius shrinking to `min`
  drain: { quiet: 45, from: 24, rate: 1.1, min: 10, back: 2 },
  contactEvery: 0.25,   // s: how often SCRIBE checks whether the fighters see each other ("contact")
  // final phase: from `from` s the high cover goes to its final height (element data `final`), by kind at these times.
  // Task 022 (A2): it starts with the overtime (data/match.js: roundTime 180), 30 s later than before (150; the times
  // of the kinds moved by the same 30 s); Paweł confirms it when he plays
  final: { from: 180, at: { tafla: 181.75, lopata: 184, ramie: 184, zab: 185, kolumna: 185.75, klin: 186.5, stopa: 182 }, stopa: 0.9 },

  // the arena's flash (U23, Paweł's idea): at big events the script light of the whole arena briefly changes colour
  // (Paweł, 29.09.2026: "nie zauważyłem tego błysku": 0.6 s, colour only → 0.9 s, the script's glow ×(1 + boost))
  flash: { enabled: true, color: 0xfff2e0, time: 0.9, strength: 1, boost: 14, events: ['camp', 'final'] },
  // the camp warning on the fighter's elements in its last seconds: the script pulses
  pulse: { speed: 4, amount: 2.5 },
};
