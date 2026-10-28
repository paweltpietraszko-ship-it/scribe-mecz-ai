// The opponent (task 009): the Double, driven by the bot. Values are starting points, to be tuned after Paweł plays.
// Distances in metres, times in seconds, angles in degrees.
// No level changes health, damage, the rifle, speeds or the senses: only the "human" traits (U28, filar 2).

// the five levels, in the order of the pause menu; `ways`: the behaviours it may choose (search and the retreat
// with a medkit belong to every level that moves). Reaction: from seeing the target to the first shot; aimError: the
// aim's error when the target has just been seen (it shrinks while the bot keeps it); turn: how fast the view turns;
// items (task 017): the chances of the grenade and the key when their moment comes (BOT.items); flee: s it takes to
// react to a warning circle it sees (Paweł 30.09.2026: the Double ran at once);
// memory: how long a last known position is trusted; medkitBelow: HP under which it falls back to heal; pull: how fast
// it pulls the recoil back down, °/s (a burst lifts the rifle 2.5°/s: the rest lifts its aim, as the player's)
// blind: blind fire from cover (task 015, BOT.blind)
// task 014 (point 3): sway: { grow, max }: the aim trembles more the longer a series lasts, as a person's hand on the
// stick: + grow ° per second of fire, at most max °; it settles at twice that pace while not firing (BOT.aim.swayEvery:
// how often the trembling turns). turn: °/s, never above the player's pad at full stick (TPP.padYaw, task 014). lag: s the aim follows behind a moving target (a person's hand after the eye; it shows
// up close, where a target running past moves fast across the view)
export const LEVELS = {
  dummy: { passive: true },   // stands and does not shoot (the shooting range; the training dummy of task 006)
  // task 032 (U52; Paweł 07.10: "łatwy to 100%, normalny 125%, trudny 150%, Ekspert 200%"): the levels sit on one line
  // of skill from Easy to Expert (zadania/032_raport.md, B): Normal a quarter of the way, Hard half way. reaction,
  // aimError and lag move along it in proportion, the rest straight. settle, hold (task 032): how far and how fast its
  // aim's error shrinks while it keeps the target (default BOT.aim). Easy (as the easiest bots of Counter-Strike 2 and
  // Halo Infinite): slow to fire and slow to settle, no blind fire; the higher levels follow a target running sideways
  easy: { items: { grenade: 0.15, key: 0.05, flee: 1.2 }, blind: false, reaction: 1.1, aimError: 6.0, settle: 0.55, hold: 3.0, turn: 100, pull: 0.8, lag: 0.3, sway: { grow: 2.0, max: 3.0 }, memory: 3, ways: ['attack'], medkitBelow: 30 },
  normal: { items: { grenade: 0.3, key: 0.1, flee: 0.96 }, blind: true, reaction: 0.75, aimError: 3.73, settle: 0.5, hold: 2.63, turn: 115, pull: 1.1, lag: 0.17, sway: { grow: 1.65, max: 2.45 }, memory: 5, ways: ['attack', 'ambush'], medkitBelow: 45 },
  hard: { items: { grenade: 0.45, key: 0.15, flee: 0.73 }, blind: true, reaction: 0.51, aimError: 2.32, settle: 0.45, hold: 2.25, turn: 130, pull: 1.4, lag: 0.09, sway: { grow: 1.3, max: 1.9 }, memory: 6, ways: ['attack', 'ambush', 'flank'], medkitBelow: 45 },
  machine: { items: { grenade: 0.6, key: 0.2, flee: 0.25 }, blind: true, reaction: 0.24, aimError: 0.9, settle: 0.35, hold: 1.5, turn: 160, pull: 2.0, lag: 0.03, sway: { grow: 0.6, max: 0.8 }, memory: 9, ways: ['attack', 'ambush', 'flank'], moves: false, medkitBelow: 50 },
};
export const LEVEL_ORDER = ['dummy', 'easy', 'normal', 'hard', 'machine'];

export const BOT = {
  level: 'normal',          // default (the choice is kept in the browser)
  roundReset: 5,            // after a death both come back to their spawn points
  // senses (plan/01 §6), checked senseHz times a second, not every frame
  senseHz: 10,
  sight: 40,                // how far the eyes see
  fov: 120,                 // horizontal cone of sight, from the eyes
  near: 3,                  // all round (steps), but not through a wall
  hearError: 3,             // a shot's position is heard with this error at most
  // behaviour
  decideEvery: 3,           // a new choice this often, or after an event (saw, lost, heard, was hit)
  stuck: 3,                 // no way to the goal for this long: another goal (no circling)
  unstick: 1.0,             // task 012: wedged off the navigation mesh: this long back towards it
  stall: 1.5,               // pushing without moving for this long: the path is found again
  arrive: 0.6,              // the goal is reached this close
  ambushWait: 14,           // waits in an ambush at most this long without news
  ambushRange: [7, 18],     // an ambush covers the expected place from this far
  flankAfter: 6,            // the target stays in one place this long: go round it (Obejście)
  flankSide: 7,             // to the side of the line to it
  engage: [5, 22],          // attack: a cover this far from the target
  // task 017, the items: a decision every `every` s; a button held `holdTime` s then let go. Grenade: the other kept
  // within grenadeStill m of one place for grenadeAfter s, grenadeRange m away. A warning circle it sees with itself
  // inside (fleeMargin m to spare): it runs out for up to fleeFor s. Key: the way round longer than keyDetour × the
  // straight line. The chances per level: LEVELS[…].items
  items: { every: 0.5, holdTime: 0.35, grenadeAfter: 3, grenadeStill: 1.5, grenadeRange: [8, 20], fleeMargin: 0.5, fleeFor: 2.5, keyDetour: 1.8 },
  // task 016: the distance from the target it likes for its attack cover, per weapon (the submachine gun closer, the
  // marksman's rifle further); semiGap: with a 'semi' weapon the next press comes this long after the weapon may fire
  prefer: { karabin: 11, smg: 7, dmr: 18, strzelba: 5 },
  // task 018: beyond this distance the bot does not fire the weapon at all (the shotgun: it comes closer through cover)
  fireRange: { strzelba: 14 },
  semiGap: 0.06,
  look: { swing: 55, period: 5 },   // waiting: looks around ± swing° every period s
  // aim ("human"): the error shrinks to this share of aimError after holding the target for hold s; a new error is
  // drawn every errorEvery s; series of shots with pauses
  aim: { settle: 0.35, hold: 1.5, errorEvery: 0.6, fireWithin: 4, burst: [0.35, 0.9], pause: [0.25, 0.6], lift: 0.0, swayEvery: 0.12 },
  // task 015: blind fire from cover at the place it knew the other at (seen or heard) within `window` s: bursts of
  // `burst` s, one every `every` s; never at a place it does not know
  blind: { window: 3, burst: 0.6, every: 2.5 },
  aimFrom: 7,               // beyond this distance it aims with LT; closer it fires from the hip
  hurtMemory: 2,            // s: "under fire" after a hit
  healSafe: 1.0,            // s unseen and unhit before it uses a medkit in its hiding place
  dodgeChance: 0.35,        // the Machine: a dodge roll when hit in the open, at most every dodgeEvery s
  dodgeEvery: 3,
  searchCell: 6,            // search: the fragment is split into cells this big; the least visited is next
};

// the Dummy level: where it stands (the training dummy's place of task 006: 11.9 m from the player's spawn point,
// in view of it, in front of the wall of panels) and how it reacts
export const DUMMY = {
  spawn: { x: -1.5, z: 2.0 },
  hitCooldown: 0.4,
  respawn: 5,
};

// The navigation mesh (recast-navigation-js): the arena section of task 011 (the box around its floor; the boundary
// and the chamber wall close it).
// cell: the grid's size across and up; tile: cells per tile (the tiles under a moving part are built again);
// radius: kept from walls (the capsule's radius and a little); rebuild: the turntable's arms move the mesh this often
export const NAV = {
  bounds: { x: [-23.8, 25.0], z: [0.0, 31.6] },
  cell: 0.1, cellHeight: 0.1, tile: 32,
  radius: 0.35, height: 1.8, climb: 0.3, slope: 35,
  rebuild: 0.25,
  maxObstacles: 400,
  elementPad: 0.05,
  piece: 1.6,          // m: long elements are cut into obstacles this long (one obstacle touches at most 8 tiles)    // m more round an element's obstacle than round the still parts (a box is coarser than the triangles)   // task 012: every element of the section is an obstacle (78), the arms, the panel, room to spare
};
