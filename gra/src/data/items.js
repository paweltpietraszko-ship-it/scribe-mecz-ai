// Items to use (task 017; Paweł 28.09.2026, BOARD U30: one grenade per match for each, "tak, by łatwo było dopisać
// następne, jeśli zwiększa to wrażenia z gry"). Every item is data: on or off, how many per match, which action holds
// it (fighter/actions.js: `grenade`, `key`; a held button shows the preview, letting go uses it, B cancels), how long its
// use takes and what it blocks (audit 017: in the data, not in the fighter): `held` while the button is held (lean: the
// fighter leans out of cover as for aiming; blocks: action fields turned off), `using` while it is used (blocks), and
// its effect (`kind`: 'throw' flies and explodes,
// 'key' opens the arena through SCRIBE). A new item of a known kind = a new entry here; the first enabled entry per
// action is the one that button uses. Values are starting ones, for the calibration (014).
// The medkit stays in combat/health.js (task 017 report: it is tied to the reload-like animation and the HUD's ring).

export const ITEMS = {
  // the shock grenade (Paweł 30.09.2026: "Wybuchający granat nie pasuje do gry, to powinien być granat porażający
  // przeciwnika na 2, 3 sekundy, też jak w Division, i to powinno być widowiskowe"): no damage, a stun
  // frozen (Paweł 30.09.2026: "mrozimy granat" after the shock version): off in the data, the code stays asleep
  grenade: {
    enabled: false, count: 1, action: 'grenade', kind: 'throw', icon: 'grenade',
    time: 0.8,             // the throw
    held: { lean: true, blocks: ['shoot', 'blind'] },               // holding it: out of cover's corner, no shot
    using: { blocks: ['shoot', 'aim', 'rise', 'blind'] },           // throwing: no shot, no aim
    range: 20,             // m: the aim point is pulled back to this far
    // the throw's arc: time of flight from the hand to the aim point grows with the distance (s per m), within limits
    flight: { perMetre: 0.09, min: 0.5, max: 1.6 },
    from: { up: 1.55, forward: 0.35, left: 0.2 },   // where it leaves the hand (the body's frame, m from the feet)
    fuse: 2.0,             // s from the throw to the explosion
    radius: 5,             // m: the stun's reach (and `damage` from the middle down to 0 at the edge)
    damage: 0,             // the shock grenade does no damage
    stun: 2.5,             // s: a fighter the blast reaches (any body point not hidden by the arena) can do nothing
    // the blast's picture (items/shock.js): arcs over the floor out to the edge, a ring going out, arcs on a stunned body
    // shake: the camera's shake (radians) while the player is stunned
    shock: { arcs: 16, time: 0.5, glow: 5, ringGlow: 3, bodyArcs: 3, bodyGlow: 1.6, bodyShow: 0.4, shake: 0.004 },
    // Rapier: a small ball that bounces off the floor and the elements
    // friction: share of the speed along a surface lost at a bounce; roll: m/s² it slows down rolling on the floor
    body: { radius: 0.05, restitution: 0.3, friction: 0.7, roll: 9 },
    model: { file: 'weapon/granat.glb', length: 0.1, glow: 3, dark: 0.35 },   // dark metal; the ice stripe glows in the script's light
    // the throw clip over the upper body (hero.js: HERO_FILES.throwClip): the slice with the throw and its release
    clip: { slice: [1.25, 2.15], release: 0.64, blend: 0.12 },
    // the warning circle on the floor from the landing to the explosion, both see it
    warn: { line: 0.06, glow: 2.2, settle: 1.5 },   // settle: m/s below which it counts as landed
    flash: { size: 1.0, glow: 3.5, time: 0.3 },     // a burst for a throw item without `shock` (a glowing ball in the bloom, no light: U25)
    sound: 'wybuch_granatu',
  },
  // the machine's key: out of the game (Paweł 30.09.2026: "klucz w tej wersji jest niezrozumiały i nie widać od razu
  // działania, jest do usunięcia"); the code stays asleep
  key: {
    enabled: false, count: 1, action: 'key', kind: 'key', icon: 'key',
    time: 0.4,             // pointing at the floor and letting go
    held: { lean: false, blocks: [] },
    using: { blocks: ['shoot', 'aim', 'rise', 'blind'] },
    range: 25,             // m: the floor point under the crosshair, seen from the eyes
    radius: 4,             // m: the tall elements within this of the marker go away
    hold: 5,               // s they stay away (then back)
    warn: 1.2,             // the announcement before they move (SCRIBE's rules: the lift's doors, reserved elements)
    minHeight: 1.75,       // tall = as high as SCRIBE's blocks (a line of fire); the arms and the feet stay
    skip: ['ramie', 'stopa'],
    // the floor marker; back: aimed at an element, the marker goes to the floor at its foot, this far towards the eyes
    marker: { radius: 0.35, line: 0.05, glow: 2.2, back: 0.6 },
  },
};
