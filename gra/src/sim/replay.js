// Task 027 (K8): a recorded match (sim/engine.js record()) played again on a fresh engine, the same in Node and in the
// page: the same seed, weapon, looks and level, the arena's clock as it was at the match's start, then every step's
// recorded actions of both sides and the triggers' answers; nobody inside drives (no bots). Returns the state's
// fingerprint after every round, at the end, and the match's result: the same as the recording's when the engine is
// repeatable.
import { headlessEngine } from './headless.js';
import { TRAIL } from './engine.js';

export async function playRecording(rec, step = 1 / 60) {
  // shots: every shot's step, side, start and the shooter's feet (task 027, K3: the muzzle here and elsewhere)
  const shots = [];
  let n = 0;
  const onShot = (s, side) => shots.push([n + 1, side, s.from.x, s.from.y, s.from.z, s.shooter.feet.x, s.shooter.feet.z]);
  const e = await headlessEngine({ seed: rec.seed, weapon: rec.weapon, looks: rec.looks, opt: { level: rec.level, bots: false, auto: true, names: rec.names, onShot } });
  e.restore(rec.start);
  const b0 = []; e.hash(b0);
  const k0 = rec.before ? b0.findIndex((v, k) => v !== rec.before[k]) : -1;
  const before = k0 < 0 ? null : { i: k0, rec: rec.before[k0], got: b0[k0], all: b0.map((v, k) => (v !== rec.before[k] ? [k, rec.before[k], v] : null)).filter(Boolean).slice(0, 12) };
  const hashes = [];
  e.round.on(kind => { if (kind === 'roundEnd') hashes.push(e.hash()); });
  let apart = null, first = null, diff = null;   // first: the first number that differs after the first step   // apart: the first step (counted by TRAIL) where the state differs from the recording's
  for (const [a, b, ta, tb] of rec.steps) {
    e.step(step, { a, b, ta: () => ta, tb: () => tb, active: true });
    if (++n % TRAIL === 0 && apart === null && rec.trail?.[n / TRAIL - 1] !== e.hash()) apart = n;
    const want = rec.window?.[n];
    if (want && !diff) { const d = []; e.hash(d); const k = d.map((v, i) => (v !== want[i] ? [i, want[i], v] : null)).filter(Boolean); if (k.length) diff = { step: n, k: k.slice(0, 12) }; }
    if (n === 1 && rec.detail) { const d = []; e.hash(d); const i = d.findIndex((v, k) => v !== rec.detail[k]); first = i < 0 ? null : { i, rec: rec.detail[i], got: d[i] }; }
  }
  return { apart, first, before, diff, shots, hashes, final: e.hash(), wins: { ...e.round.wins }, results: e.round.results.map(r => ({ winner: r.winner, how: r.how, time: r.time })) };
}
