// Sounds (task 010). A sound is an entry here plus its files in public/sfx/: a new sound needs no code, only a file
// and its line. Several files (versions): one of them at random, never one of the last two played (MIX.noRepeat), and
// every play changes pitch and volume a little (Paweł, 28.09.2026: "w The Division wkurzało, że było kilka odzywek i po
// czasie stawały się wkurzające"). An entry without files plays silence (no error). All values are temporary, to be
// tuned after Paweł listens.
//   files: paths under public/;  volume: 0..1;  pitchJitter, volumeJitter: ± share of change per play (else MIX's);
//   refDistance, maxDistance (m), rolloff: the spatial fade (Web Audio PannerNode); model: 'inverse' (default: a
//   hall's natural fade, never quite silent) or 'linear' (silent at maxDistance: a clear range, used for the steps);
//   loop: plays all the time, one version after another with a cross-fade (the hall's background); group: a key of
//   MIX.group, whose volume multiplies the entry's (the background and the distant sounds, U31: easy to correct).
// Task 014: the files levelled within each group in 010's review (reference/dzwieki/wybrane/, to its quietest version)
// are in public/sfx/ now; the entries marked 014 are raised by their group's mean loss (RMS, probe in the 014 report).
// The files are ElevenLabs Sound Effects generated for THE ONE (CREDITS.md); mono, 44.1 kHz, peak −1 dBFS, with the
// hall's reverb in them (no reverb is added in the code). The volumes below follow the files' measured loudness
// (task 010 report): a louder file gets a lower volume.

import { ITEMS } from './items.js';

// name_1 … name_n in public/sfx/
const versions = (name, n) => Array.from({ length: n }, (_, i) => `sfx/${name}_${i + 1}.mp3`);
// a shot heard across the whole arena (80 × 52 m); the files carry the hall's reverb
const SHOT = { volume: 0.75, pitchJitter: 0.04, refDistance: 4, maxDistance: 90, rolloff: 1 };
// the fighters' other sounds: heard around their place
const NEAR = { volume: 0.8, refDistance: 2, maxDistance: 40, rolloff: 1 };
// the arena's moves: heard across the hall
const ARENA = { volume: 0.7, refDistance: 5, maxDistance: 80, rolloff: 1 };

export const SOUNDS = {
  // the weapons: the assault rifle now; the others for the weapon pool, the grenade for its task (U30)
  strzal_karabin: { files: ['sfx/strzal_karabin.mp3'], ...SHOT },
  strzal_smg: { files: versions('strzal_smg', 2), ...SHOT, volume: 1.18 },   // 014: +4.0 dB
  strzal_dmr: { files: ['sfx/strzal_dmr.mp3'], ...SHOT },
  strzal_pistolet: { files: ['sfx/strzal_pistolet.mp3'], ...SHOT },
  // task 018: the shotgun (the file is about 6 dB louder than the marksman's rifle: set by ear next to the others)
  strzal_strzelba: { files: versions('strzal_strzelba', 3), ...SHOT, volume: 0.6 },
  // task 023 (C1): the blast only fetched while a thrown item using it is enabled (data/items.js); else silence
  wybuch_granatu: { files: Object.values(ITEMS).some(s => s.enabled && s.sound === 'wybuch_granatu') ? ['sfx/wybuch_granatu.mp3'] : [], volume: 1, pitchJitter: 0.03, refDistance: 5, maxDistance: 90, rolloff: 1 },
  // a step; its volume and range are the gait's (STEP below)
  // volume 1 → 0.7 (−30 %): Paweł, 28.09.2026: „kroki są za głośne”
  krok: { files: versions('krok', 5), volume: 0.79, pitchJitter: 0.06, refDistance: 1, maxDistance: 15, rolloff: 1, model: 'linear' },   // 014: +1.1 dB

  // the fighters' moments (for the player: not spatial, MIX.own.other)
  przeladowanie: { ...NEAR, files: versions('przeladowanie', 1), volume: 0.9 },     // a reload starts
  przeladowanie_strzelba: { ...NEAR, files: versions('przeladowanie_strzelba', 2), volume: 0.9 },   // task 018
  pusty_magazynek: { ...NEAR, files: versions('pusty_magazynek', 2), volume: 1.18 }, // RT pulled while reloading   // 014: +3.4 dB
  apteczka: { ...NEAR, files: versions('apteczka', 1), volume: 0.9 },               // a medkit starts
  wejscie_w_oslone: { ...NEAR, files: versions('wejscie_w_oslone', 2), volume: 0.67 },   // back to the wall   // 014: +1.0 dB
  przewrot: { ...NEAR, files: versions('przewrot', 1), volume: 0.6 },               // a dodge roll starts
  // the shots' ends
  trafienie_kamien: { ...NEAR, files: versions('trafienie_kamien', 2), volume: 0.93 },   // a shot hits the arena   // 014: +2.4 dB
  rykoszet: { ...NEAR, files: versions('rykoszet', 3), volume: 0.59, chance: 0.3 },  // chance: share of arena hits   // 014: +1.4 dB
  swist_kuli: { ...NEAR, files: versions('swist_kuli', 2), volume: 0.8, refDistance: 1, maxDistance: 6 },   // passes the head   // 014: +1.1 dB
  trafienie_cialo: { ...NEAR, files: versions('trafienie_cialo', 2), volume: 0.67 },    // a shot hits a fighter   // 014: +0.9 dB
  // the arena's moves
  panel_w_dol: { ...ARENA, volume: 0.85, files: versions('panel_w_dol', 4) },     // the moving panel starts down   // 014: +1.7 dB
  panel_w_gore: { ...ARENA, volume: 0.81, files: versions('panel_w_gore', 4) },   // ... and back up   // 014: +1.3 dB
  obrotnica: { ...ARENA, files: versions('obrotnica', 4), volume: 0.8 },   // the turntable starts turning   // 014: +4.1 dB
  zapowiedz_ruchu: { ...ARENA, files: versions('zapowiedz_ruchu', 4), volume: 0.64 },   // the 1.2 s warning   // 014: +0.6 dB
  // the hall's background (U31, Paweł 28.09.2026: "jest głucho oprócz kroków i strzałów"): all the time, not
  // spatial; it must not cover the steps. The files are loud (about −11 dB and −6…−8 dB over 300 ms) and mostly low
  // (60–150 Hz; tlo_maszyna_1 below 60 Hz): the volume makes them quiet
  tlo_hala: { files: versions('tlo_hala', 2), volume: 0.3, volumeJitter: 0, loop: true, group: 'background' },
  szum_maszyny: { files: versions('tlo_maszyna', 2), volume: 0.2, volumeJitter: 0, loop: true, group: 'background' },
  // rare single sounds of the machine from far away (MIX.distant: how often, how far); their versions differ by up to
  // 12 dB in loudness (task 010 report)
  odglos_z_daleka: { files: versions('odglos_z_daleka', 11), volume: 1.8, pitchJitter: 0.05,   // 014: +7.0 dB
    refDistance: 10, maxDistance: 120, rolloff: 1, group: 'distant' },
  menu: { files: versions('menu', 1), volume: 0.3 },   // the pause: a move or a choice (not spatial)
};

// the sound of the rifle each fighter holds (the weapon pool will choose per match)
export const WEAPON_SOUND = 'strzal_karabin';

// Steps: a foot lands at the step phase's 0 and ½ (animator.js: at phase 0 the left foot is furthest ahead). The
// gait gives the volume and the range where it goes silent (the 'linear' model). Paweł, 28.09.2026 (task 010):
// the Double's run heard from about 15 m, its walk from 8 m, crouching about 3 m (as far as the bot hears: data/bot.js
// BOT.near; the player's range must not be smaller). cover: sliding along the wall.
export const STEP = {
  minWeight: 0.5,   // the walk/run clips must have at least this share of the pose (not a slow blend from idle)
  gait: {
    crouch: { volume: 0.3, maxDistance: 3.5 },
    cover: { volume: 0.3, maxDistance: 3.5 },
    walk: { volume: 0.55, maxDistance: 8 },
    run: { volume: 0.8, maxDistance: 15 },
    sprint: { volume: 1.0, maxDistance: 18 },
  },
};

export const MIX = {
  volume: 0.8,          // the default of Volume in the pause (0..1), remembered in the browser
  volumeStep: 0.1,      // one press left or right in the pause
  voices: 12,           // sounds at once; the oldest gives way (a series must not choke the sound)
  // the player's own sounds are not spatial ("close", no panning): times the entry's volume. Paweł, 28.09.2026: his
  // shot strong but not deafening; his steps quiet
  own: { shot: 1.25, step: 0.35, other: 1 },
  panning: 'HRTF',      // 'HRTF' or 'equalpower' (cheaper); the Intel UHD decides (task 010 report)
  pauseFade: 0.15,      // s: the game's sounds fade out in the pause and back in after it
  // a limiter on everything: a series of overlapping shots must not clip
  limiter: { threshold: -6, knee: 6, ratio: 12, attack: 0.003, release: 0.15 },
  whizz: 1.5,           // m: the other's shot passing this close to the player's head is heard (swist_kuli)
  // the groups' volumes (times the entry's): the hall's background and the distant sounds (U31)
  group: { background: 1, distant: 1 },
  // odglos_z_daleka: one every every[0]..every[1] s, from a random direction at distance[0]..distance[1] m from the
  // player, height[0]..height[1] m above the floor (the machine is above the arena, in the dark)
  distant: { every: [20, 60], distance: [20, 45], height: [4, 12] },
  loopSilence: 1e-4,    // the loops' ends quieter than this (about −80 dB) are cut
  loopFade: 2,          // s: a loop's next version fades in while the one before fades out
  loopAhead: 0.5,       // s: the next version is scheduled this early on the audio clock
  noRepeat: 2,          // a version is not played again until this many others were (as far as there are versions)
  pitchJitter: 0.04,    // ± share, when the entry does not say
  volumeJitter: 0.1,    // ± share (about ±0.9 dB), when the entry does not say
};

// Task 022 (U43): the music outside the fight, in public/music/ (copies of reference/muzyka/wybrane/; ElevenLabs Music
// on Paweł's Starter plan, personal use only: CREDITS.md). Paweł: no music in the fight ("do walki nie pasowała").
//   menu: the start screen, and the match's result after `end` has played; before: only before a match's first round
//   (the weapon); win / lose: the card after a round, faded out in the next round's countdown; end: the match's end
//   (the same for both sides, Paweł: "dobry i dla zwycięzcy i pokonanego"). An equal-health round: no music.
// on, volume: the defaults of the pause's Music and Music volume (remembered in the browser); off, no file is fetched.
// fadeIn, fadeOut: s of a change of track (the new track starts after the old one is silent); beforeOut: the music before the first round is silent this many s before
// the round starts; the card's music fades out over the countdown (MATCH.countdown). volume x the pause's Volume.
export const MUSIC = {
  on: true,
  volume: 0.6,
  volumeStep: 0.1,
  fadeIn: 1,
  fadeOut: 0.8,       // Paweł 01.10.2026: the tracks overlapped; now one after another, the old one out in this time
  beforeOut: 1.5,
  tracks: {
    menu: { file: 'music/muzyka_menu.mp3', loop: true, volume: 1 },
    before: { file: 'music/muzyka_przed_runda.mp3', volume: 1 },
    win: { file: 'music/muzyka_wygrana_rundy.mp3', volume: 1 },
    lose: { file: 'music/muzyka_przegrana_rundy.mp3', volume: 1 },
    end: { file: 'music/muzyka_koniec_meczu.mp3', volume: 1 },
  },
};
