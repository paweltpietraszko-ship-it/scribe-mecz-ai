// Weapon, hit zones, health and medkits (task 006; the training dummy became the Dummy level in task 009: data/bot.js). All values are temporary,
// to be tuned after Paweł plays. Distances in metres, times in seconds, angles in degrees.

// Task 016: the weapons of the pool (DECISIONS.md 25.09.2026: one weapon drawn for the match, the same for both). Every
// one is held with the rifle's animations: the right hand's grip, the reload clips and the hip fire's raise are shared
// (WEAPON_HOLD); the rest is per weapon. Adding a weapon = one entry here (and its model, sound and HUD name).
export const WEAPON_HOLD = {
  // the rifle in the right hand: position (m) of the grip point and rotation (degrees, XYZ order) of the rifle's
  // frame relative to the RightHand bone; chosen on the idle aiming pose (task 006 report)
  grip: { pos: [0.001, 0.042, -0.001], rot: [-176.2, 25.9, -109.6] },
  // slices of the reload clips with the magazine change alone (measured from the left hand, task 006 report)
  reloadClip: [0.2, 2.6],
  reloadClipCrouch: [0.25, 3.6],
  reloadBlend: 0.2,    // the reload animation fades in and out over this time
  tracerEvery: 3,
  // hip fire raises the rifle as when aiming (Paweł, 28.09.2026: OWNER_ACCEPTED in task 006); it stays raised
  // this long after the last shot
  hipRaise: 0.6,
};

// Per weapon. Model: file, length in the game (m), flip (the file's barrel points to −X: turned round, task 016),
// and points in the file's frame (units of the .glb, 0.98 long, underside at 0): gripPoint (the palm on the pistol
// grip: the model turns and scales about it), foregripPoint (the left palm), sightPoint (the sight line), buttPoint
// (the middle of the butt plate: it goes to the shoulder when aiming), muzzle (the shots start there).
// Shot: mode 'auto' (held RT) or 'semi' (one shot per press, at most rpm/min; a press up to semiBuffer s early waits for
// the next allowed shot), rpm, range (m), damage per hit (times the
// zone's multiplier), magazine (spare ammunition without end), reloadTime (s), spread (half-angle of the cone, degrees:
// aim, hip; start: the series' extra spread at its first shot, perShot changes it with every shot within 0..maxBloom,
// between series it returns to start at recover °/s), recoil (degrees: up per shot with a random side kick; after RT
// the view comes back by `back` of the rise in backTime s). sound: data/sound.js; name: the HUD's (i18n key).
// Task 016's values are starting ones, for the calibration (014): each kills in about 6 s of steady fire at the torso.
export const WEAPONS = {
  karabin: {
    ...WEAPON_HOLD, name: 'weapon.karabin', sound: 'strzal_karabin',
    file: 'weapon/karabin.glb', flip: false,
    length: 0.70,        // (0.80 -> 0.70: trial, Paweł 28.09.2026 "optycznie za duża")
    gripPoint: [-0.232, 0.214, 0.035],
    // task 007: the left palm on the vertical front grip, the sight line above the rear sight, the butt plate
    foregripPoint: [0.236, 0.228, -0.03],
    sightPoint: [-0.007, 0.497, 0],
    buttPoint: [-0.48, 0.325, 0],
    muzzle: [0.489, 0.378, 0],   // the flash hider's end, on the bore's axis
    mode: 'auto', rpm: 600, range: 60,
    // task 014 (Paweł 30.09.2026: "można przeżyć jeden magazynek w AR i SMG, ale następny powinien być śmiertelny"):
    // 24 torso hits to kill, about 2.3 s of accurate fire (was 1.7: about 6 s)
    damage: 4.2,
    magazine: 30, reloadTime: 2.2,
    // No penalty for moving and no bonus for crouching (DECISIONS.md 25.09.2026; Paweł, 28.09.2026: OWNER_CORRECTED in
    // task 006). As in The Division the series starts wide and tightens (trial, Paweł 28.09.2026)
    spread: { aim: 0.3, hip: 2.5, start: 1.5, perShot: -0.15, maxBloom: 1.5, recover: 4.0 },
    recoil: { up: 0.25, side: 0.10, back: 0.6, backTime: 0.3 },
  },
  // the submachine gun (Tripo, reference/bron/): faster, weaker, wider, shorter reach; measured on the side view with a
  // 5 cm grid (task 016 report). Its barrel points to −X in the file
  smg: {
    ...WEAPON_HOLD, name: 'weapon.smg', sound: 'strzal_smg',
    file: 'weapon/pistolet_maszynowy.glb', flip: true,
    length: 0.58,
    gripPoint: [0.17, 0.19, 0],
    foregripPoint: [-0.20, 0.25, 0.03],   // under the handguard, behind the hand stop (no vertical grip)
    sightPoint: [0.10, 0.385, 0],         // the red dot's window
    buttPoint: [0.48, 0.255, 0],
    muzzle: [-0.49, 0.305, 0],
    crosshair: 'ring',   // the screen's crosshair: a ring (Paweł 29.09.2026); the others: the four lines
    mode: 'auto', rpm: 900, range: 35, damage: 3.4, magazine: 32, reloadTime: 2.0,   // 014: was 1.1 (30 torso hits)
    spread: { aim: 0.6, hip: 3.2, start: 1.8, perShot: -0.12, maxBloom: 1.8, recover: 5.0 },
    recoil: { up: 0.18, side: 0.14, back: 0.6, backTime: 0.3 },
  },
  // the marksman's rifle: semi, strong, narrow, a big kick up, long reach. Its barrel points to −X in the file
  dmr: {
    ...WEAPON_HOLD, name: 'weapon.dmr', sound: 'strzal_dmr',
    file: 'weapon/karabin_wyborowy.glb', flip: true,
    length: 0.92,
    gripPoint: [0.225, 0.08, 0],          // the thumbhole stock's grip
    foregripPoint: [-0.10, 0.10, 0.03],   // the small grip under the handguard
    sightPoint: [0.15, 0.225, 0],         // the scope's axis
    buttPoint: [0.48, 0.09, 0],
    muzzle: [-0.49, 0.158, 0],
    mode: 'semi', rpm: 240, semiBuffer: 0.2, range: 90, damage: 10, magazine: 12, reloadTime: 2.6,   // 014: was 4.2 (10 torso hits)
    spread: { aim: 0.15, hip: 2.5, start: 0.3, perShot: 0.3, maxBloom: 1.2, recover: 3.0 },
    recoil: { up: 1.1, side: 0.25, back: 0.7, backTime: 0.25 },
  },
  // task 018 (Paweł 30.09.2026: "Musimy dołożyć do arsenału shotgun"): a semi-automatic shotgun, deadly close and
  // predictable: 8 pellets in a fixed pattern (no random draw: START_HERE §5), full damage to `falloff.full` m, down to
  // `falloff.min` of it at `falloff.zero` m and beyond; no knock-back. The file lies askew: orient straightens it (the
  // model's principal axis, then 6° so the barrel is level; task 018 report); the points are in the straightened frame
  strzelba: {
    ...WEAPON_HOLD, name: 'weapon.strzelba', sound: 'strzal_strzelba', reloadSound: 'przeladowanie_strzelba',
    file: 'weapon/strzelba.glb', flip: false,
    orient: [[0.7433, 0.2176, 0.6327], [-0.153, 0.9759, -0.1559], [-0.6513, 0.0191, 0.7586]],
    length: 0.82,
    gripPoint: [-0.14, 0.20, 0],
    foregripPoint: [0.35, 0.27, -0.03],   // under the fore-end
    sightPoint: [0.05, 0.38, 0],          // over the receiver
    buttPoint: [-0.55, 0.25, 0],
    muzzle: [0.71, 0.333, 0],
    mode: 'semi', rpm: 180, semiBuffer: 0.2, range: 30,
    // pellets: `count`: one in the middle, the rest on a ring of `ring` degrees round the aim (hip fire: the ring × hip)
    pellets: { count: 8, ring: 1.2, hip: 1.5 },   // 1.2°: at 7 m the ring (0.15 m) is within the torso (0.22 m)
    damage: 1.85,  // per pellet: 8 × 1.85 = 14.8 a shot close to the torso (Paweł 30.09.2026: "ogranicz strzał = 15 % HP, resztę zrobimy na 014"; was 4.2)
    falloff: { full: 7, zero: 15, min: 0.1 },
    magazine: 8, reloadTime: 2.4,
    spread: { aim: 0, hip: 0, start: 0, perShot: 0, maxBloom: 0, recover: 4.0 },
    recoil: { up: 2.2, side: 0.4, back: 0.75, backTime: 0.3 },
    crosshair: 'ring',
  },
};
// the pool the match draws from (the pistol later: it needs its own animations, Paweł 29.09.2026)
export const WEAPON_POOL = ['karabin', 'smg', 'dmr', 'strzelba'];

// Fixed hit zones, the same for every character (DECISIONS.md 27.09.2026). They follow the physics capsule, not
// the model. Heights from the feet of a standing character (PLAYER.height); crouched, the heights scale like the
// capsule. `from`/`to` are the outer ends of a capsule (its rounded caps included).
export const HITZONES = {
  head: { center: 1.62, radius: 0.13, multiplier: 1.5 },
  torso: { from: 0.95, to: 1.48, radius: 0.22, multiplier: 1.0 },
  legs: { from: 0.05, to: 0.95, radius: 0.20, multiplier: 0.8 },
};

export const COMBAT = {
  hp: 100,             // no regeneration
  // task 014: ?medkits=0 (tests: the round's time without healing)
  medkits: +(new URLSearchParams(globalThis.location?.search ?? '').get('medkits') ?? 2),
  medkitHeal: 50,
  medkitTime: 1.0,
};

// Task 014 (U33, Paweł 29.09.2026: "jak stoję przed panelem to karabin wchodzi do środka… celownik wskazuje na mobka,
// ale strzały idą w przeszkodę"): the rifle against a wall, the same rule for the player and the bot, as in The
// Division. Every frame the line from the butt (the shoulder) to the muzzle is checked: an arena solid on it pulls the
// rifle back along its barrel (the muzzle `margin` m before the wall, at most `maxRetract` m); when that is not enough
// the shot flies from the butt (never from inside a solid). The crosshair shows "blocked" when a solid stands between
// the shot's start and the aim point (`aimEps` m before the aim point does not count)
// on: false (or ?wall=off) = as up to task 021: the shot from the muzzle wherever it is
export const WALL = { on: new URLSearchParams(globalThis.location?.search ?? '').get('wall') !== 'off', margin: 0.04, maxRetract: 0.35, aimEps: 0.08 };

// Task 014: the combat log (combat/log.js): on: it records, also while the test panel is closed (Paweł 01.10.2026,
// OWNER_CORRECTED of the contract's point 6: "Zapisuj zawsze": a round that felt unfair is copied after it); limit:
// entries kept (the oldest goes); panelLines: the last lines the test panel shows while it is open
export const LOG = { on: true, limit: 4000, panelLines: 30 };

// Muzzle flash, tracer and sparks; in the arena's script light where it is the machine's light
export const EFFECTS = {
  flash: { color: 0xffe2b8, time: 0.05, size: 0.22, glow: 6 },
  tracer: { width: 0.012, glow: 3, life: 0.08 },
  sparks: { count: 10, speed: 3.2, spread: 0.8, life: 0.3, size: 0.03, glow: 4, gravity: 9.81, pool: 240 },
};
