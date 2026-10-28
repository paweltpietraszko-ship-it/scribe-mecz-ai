// window.__theone.matchScreen(<state>) (task 022, B9): the match's screens with a sample state, the numbers of the reference's own
// sample (reference/ekrany_meczu.html), for the screenshots side by side with it. The reference's weapon is the
// marksman's rifle and its opponent's level Normal.
const R = (round, winner, how, time, zone, dist) => ({ round, winner, how, time, zone, dist });
const base = { phase: 'fight', results: [], overtime: false, card: null, winner: null, left: 0, clock: 134, round: 2,
  wins: { me: 1, foe: 0 }, pending: 'normal', level: 'normal', weapon: 'dmr' };
export const SCREEN_SAMPLES = {
  start: { phase: 'menu', nick: 'Paweł' },
  weapon: { phase: 'countdown', round: 1, left: 3, wins: { me: 0, foe: 0 } },
  fight: {},
  ot: { overtime: true, clock: 24 },
  rwin: { phase: 'card', round: 2, left: 2, card: { ...R(1, 'me', 'kill', 72, 'head', 18), hp: 44, foeHp: 0, took: [] } },
  rlose: { phase: 'card', round: 2, left: 2, wins: { me: 0, foe: 1 },
    card: { ...R(1, 'foe', 'kill', 72, 'head', 22), hp: 0, foeHp: 61, took: [{ zone: 'legs', dmg: 34, dist: 25 }, { zone: 'torso', dmg: 42, dist: 22 }, { zone: 'head', dmg: 63, dist: 22 }] } },
  hpcall: { phase: 'card', left: 2, card: { ...R(2, 'me', 'time', 210, null, null), hp: 64, foeHp: 31, took: [] } },
  replay: { phase: 'card', left: 2, card: { ...R(2, null, 'equal', 210, null, null), hp: 50, foeHp: 50, took: [] } },
  mwin: { phase: 'end', winner: 'me', wins: { me: 2, foe: 1 }, stats: { accuracy: 38, heads: 7, medkits: 3 },
    results: [R(1, 'me', 'kill', 72, 'head', 18), R(2, 'foe', 'kill', 160, 'torso', 31), R(3, 'me', 'time', 201, null, null)] },
  mlose: { phase: 'end', winner: 'foe', wins: { me: 1, foe: 2 }, stats: { accuracy: 24, heads: 3, medkits: 3 },
    results: [R(1, 'foe', 'kill', 100, 'head', 12), R(2, 'me', 'kill', 132, 'torso', 24), R(3, 'foe', 'kill', 58, 'torso', 9)] },
};
export const screenSample = key => (SCREEN_SAMPLES[key] ? { ...base, ...SCREEN_SAMPLES[key] } : null);
