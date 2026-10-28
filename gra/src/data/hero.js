// The heroine: model from reference/bohaterka/ (Tripo), animations from Adobe Mixamo (task 004).
// Values are provisional, to be tuned after Paweł plays.

import { ITEMS } from './items.js';

export const HERO = {
  height: 1.75,          // model height in the game; every character in the game is this tall (equal chances)
  fade: 0.15,            // cross-fade between animations, s
  turnRate: 720,         // body turn towards the movement (towards the camera when aiming), degrees per second
  followMoved: 0.8,      // m/s: moving faster than this, the body faces the real movement, not the stick (U46: a wall in the way)
  aimSpine: 0.5,         // share of the camera's vertical angle that goes into the spine while aiming
  roll: { start: 0.45, end: 1.95 },   // slice of the dive roll clip, s
  speedClamp: [0.6, 1.4],             // allowed speed-up or slow-down of walk and run animations
  // task 015: sliding along cover at COVER.slideSpeed (2.5 m/s) plays the sneak clips up to this much faster, so the
  // feet keep to the floor (the clips walk ~1.1 m/s)
  coverTempo: 2.6,
  // light stick push: walk animation below `from`, run above `to`, blended between (m/s).
  // As in The Division (Paweł, 27.09.2026: OWNER_ACCEPTED in task 004).
  walkRun: { from: 2.0, to: 3.0 },
  // one weak light carried by the camera, only in the Play view, so the heroine stands out from the dark
  // (task 004, point 11; Paweł judges it). The arena's own lights are unchanged.
  fill: { color: 0xdfe8ff, intensity: 1.2, distance: 5, decay: 2 },
  fbxUnit: 0.01,         // Mixamo FBX hip positions are in hundredths of the model's units
  // task 007: the hips stand this much higher in the crouching poses (a knee went 1.8 cm into the floor in 004)
  crouchLift: 0.02,
  // task 016 (Paweł 29.09.2026: a dead body fell into a sill): the body lies this far beyond the death clip's hips
  // travel (the head and shoulders); rays at these heights over the floor check the fall's way
  deathRoom: 0.9,
  deathRays: [0.25, 0.6],
  // task 017: a stunned body replays the start of the hit reaction this many times faster (the jerks of the shock)
  stunJerk: 2.5,
};

// The Double (task 009, DECISIONS.md 27.09.2026: "the heroine's double written in the machine's script"): the heroine's
// model with the machine's script glowing faintly on the suit, in the opponent's colour of the HUD (the pair of the
// script light, data/hud.js). glyph: the height of one sign on the body, m; glow: its brightness (below the bloom's
// threshold: it reads in the dark but does not shine); head: the writing head, a brighter band running up the body every
// `every` s (as on the arena's panels), `width` m wide, `glow` added; suit: the script shows only where the texture is
// this dark (linear luminance, from .. to: fading in), so not on the hands; face: none within this radius (m) of the
// middle of the head, `below` m under the top of the head; tex: the script's canvas, px; rows: lines of script on it
export const DOUBLE = {
  glyph: 0.045, stroke: 0.075, glow: 0.22, head: { every: 4.5, width: 0.25, glow: 0.9 },
  suit: [0.05, 0.02], face: { radius: 0.2, below: 0.13 }, tex: 1024, seed: 20260928, rows: 16,
};

// Task 019 (DECISIONS 30.09.2026, "widoczność postaci równa dla wszystkich"): a thin rim of light on the opponent's
// silhouette, only where its surface turns away from the camera (fresnel, as the enemy highlight in Valorant), in the
// opponent's colour of the HUD (HUD.colors.*.foe). Only on the opponent, never on one's own character; always on and the
// same at every quality: an emission below the bloom's threshold, not a light (shadows, the bloom and the resolution do
// not change it, it lights nothing round it); walls and elements hide it as any surface. strength: its brightness at the
// very edge; power: how thin (higher: thinner)
export const RIM = { strength: 0.5, power: 4 };

// Two-bone IK of the arms (task 007): both hands on the rifle. Values are provisional.
export const IK = {
  blend: 0.12,           // the IK comes in and goes out in this time, s
  // the elbow bends towards a point this far down and out (to the body's side) from the elbow, m
  elbowHint: { down: 0.3, out: 0.2 },
  // aiming: the rifle's butt (WEAPON.buttPoint) goes into the shoulder's pocket, below the collarbone: `along` of the
  // way from the RightShoulder bone (the collarbone's root) to the RightArm bone (the shoulder joint), then `down` and
  // `forward` (to the front of the chest), m (Paweł after playing 007: „kolba broni nie jest przy ciele/barku tylko koło
  // ucha”, then „oparta o mostek”; rifle manuals: the pocket just under the collarbone, against the chest muscle)
  aimAnchor: { along: 0.7, down: 0.04, forward: 0.07 },
};

// Task 019 (DECISIONS 30.09.2026, BOARD U24): the characters' suit, the same for both. 'kobalt': the cobalt softshell
// (reference/bohaterka/stroje/stroj_kobalt.glb, the sleeve's emblem painted out); 'dzis': the heroine's black suit as up to
// task 018, only by the address (?suit=dzis), not in the menu.
// Task 023 (DECISIONS 01.10.2026, "Cztery postacie graczy do PvP przyjęte"): the characters the player chooses on the
// start screen (in this order), each one only a look: the same skeleton (Mixamo, 65 bones), animations, height
// (HERO.height), capsule and hit zones (pillar 2). file: in public/hero/; name: its key in the texts. The Double wears
// the player's character (one file for both). Chosen: remembered in the browser (theone.character); ?suit=<key> forces
// one (tests, screenshots)
// Task 024 (OWNER_CORRECTED, Paweł 02.10.2026: "zniknęła nam moja bohaterka, z którą zaczynałem grę, ona powinna być
// domyślną postacią gry"): the heroine in her black suit (bohaterka.glb, before only ?suit=dzis) first in the menu and
// the default; how well she is seen in the dark is for later (BOARD: a garment, as Paweł offered)
export const CHARACTERS = {
  bohaterka: { file: 'bohaterka.glb', name: 'char.bohaterka' },
  kobalt: { file: 'stroj_kobalt.glb', name: 'char.kobalt' },
  sliwka: { file: 'gracz_sliwka.glb', name: 'char.sliwka' },
  morska: { file: 'gracz_morska.glb', name: 'char.morska' },
  szmaragd: { file: 'gracz_szmaragd.glb', name: 'char.szmaragd' },
  rdza: { file: 'gracz_rdza.glb', name: 'char.rdza' },
};
export const CHARACTER_ORDER = Object.keys(CHARACTERS);
// task 026: a character chosen in the menu starts its download after `delay` s still chosen (one only scrolled past is
// never fetched; a stop sent at once could overtake the download it stops, on its way to the service worker)
export const CHARACTER_FETCH = { delay: 0.4 };
// the bot's character (OWNER_CORRECTED, Paweł 01.10.2026, "b)": the opponent is always the same character, not the
// player's double): `key`, or `instead` when the player chose that one; it still wears the machine's script
export const OPPONENT = { key: 'rdza', instead: 'kobalt' };
// the start screen shows the character chosen: the camera `ahead` m in front of the player's figure, `height` m up,
// looking at a point `height - drop` m up and `side` m to the figure's side (so the figure stands right of the menu)
export const CHARACTER_VIEW = { ahead: 2.7, height: 1.35, drop: 0.35, side: 0.85 };
export const SUITS = Object.fromEntries(CHARACTER_ORDER.map(k => [k, CHARACTERS[k].file]));
// (?suit=dzis: the old address of the heroine)
const suitAsked = { dzis: 'bohaterka' }[new URLSearchParams(globalThis.location?.search ?? '').get('suit')] ?? new URLSearchParams(globalThis.location?.search ?? '').get('suit');
function storedCharacter() {
  try { const k = globalThis.localStorage?.getItem('theone.character'); if (k in CHARACTERS) return k; } catch { /* storage blocked */ }
  return 'bohaterka';
}
// the look at the start: forced by the address, else the one chosen last time
export const SUIT = suitAsked in SUITS ? suitAsked : storedCharacter();

// Files in public/hero/ (names as in the Mixamo pack)
const DIRS = ['forward', 'forward right', 'right', 'backward right', 'backward', 'backward left', 'left', 'forward left'];
export const HERO_FILES = {
  dir: 'hero/', model: SUITS[SUIT],
  pack: 'anims.bin',   // task 032 (D1): the Mixamo clips in the game's own file (npm run anims), not the .fbx files
  clips: {
    idle: 'idle', idleAim: 'idle aiming', idleCrouch: 'idle crouching', idleCrouchAim: 'idle crouching aiming',
    // task 007: the run is a jog with the rifle held low (the old run's steps were too long at 3.5 m/s)
    walk: 'walk forward', run: 'rifle_run', sprint: 'sprint forward', walkCrouch: 'walk crouching forward',
    roll: 'dive_roll',
    // cover (task 005, back again in task 007 after Paweł played: „poprzednia wersja była lepsza”): the back to the
    // wall (−Z of the clip); the entry approaches towards +Z and turns the back to the wall
    coverIdle: 'taking_cover_idle', coverEnter: 'taking_cover',
    sneakLeft: 'left_cover_sneak_w_rifle', sneakRight: 'right_cover_sneak_w_rifle',
    // vault (task 007): a jump over with a hand on the obstacle, landing forwards (towards +Z of the clip)
    vault: 'jumping',
  },
  // task 006: reloads, played over the upper body (standing and crouched; slices in WEAPON)
  reload: { stand: 'reloading', crouch: 'reload' },
  // task 017: the grenade's throw (Mixamo "Toss Grenade", mirrored: the left hand throws), played over the upper body.
  // Task 023 (C1): only fetched while the grenade is enabled (data/items.js); frozen, null
  throwClip: ITEMS.grenade.enabled ? 'toss_grenade' : null,
  // task 006: reactions with their own travel: the hit (only the Dummy level stands still for it) and the three deaths
  // (task 009: every character)
  reactions: { hit: 'hit_reaction', deathFront: 'death_from_the_front', deathBack: 'death_from_the_back', deathHead: 'death_from_front_headshot' },
  // eight directions clockwise from forward, 45° apart: index k is at k·45° to the right of the body's front
  aimWalk: DIRS.map(d => 'walk ' + d),
  aimWalkCrouch: DIRS.map(d => 'walk crouching ' + d),
};
