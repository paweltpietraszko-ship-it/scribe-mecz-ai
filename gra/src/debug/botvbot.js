// ?botvbot (task 009, point 14): two bots play each other, nobody at the pad; the game runs `speed` simulation steps per
// drawn frame. The test counts the rounds and their times, how long a bot pushed without moving, the wins, and checks
// every hit: the shooter's eyes must have seen the target (a line free of the arena to its head, torso or hips) at the
// moment of the shot.
import * as THREE from 'three';

// Task 012 (SCRIBE): the openings and the hits in their windows, the camping penalties, and any element inside a
// fighter (a shape query of the physics with a capsule a little thinner than the fighter's, every step).
const OPEN_AFTER = 2.7, OPEN_HOLD = 3;   // an opening's line is open from its announcement + the move, for its hold
// fighters: [a, b]; bots: [bot of a, bot of b]; round: fighter/round.js; ballistics: for the line of sight;
// machine: scribe/machine.js; physics: player/physics.js
export function createBotStats({ fighters, bots, round, ballistics, machine, physics }) {
  // hitsBlind: hits when the eyes saw none of the target's body points (head, torso, hips); pointBlind (stricter, for
  // information): hits whose exact point the eyes did not see (e.g. the hips behind a sill while the head shows).
  // Task 015: blind fire (from behind cover, at a place known a moment ago) counted apart: blindShots, blindHits
  const s = { rounds: [], roundTime: 0, stuck: [0, 0], stuckMax: [0, 0], hits: 0, hitsBlind: 0, pointBlind: 0, blind: [], shots: 0, blindShots: 0, blindHits: 0, clock: 0 };
  const seen = fighters.map(f => f.weapon.fired), eyes = new THREE.Vector3(), at = new THREE.Vector3(), p = new THREE.Vector3();
  let wasOver = false, lastScore = { me: 0, foe: 0, draws: 0 };
  Object.assign(s, { openings: 0, hitsInOpen: 0, camps: 0, overlap: 0, overlapMax: 0, overlapAt: [] });
  const seenEvents = new Set(), windows = [];
  // task 022: the matches (each one's weapon, both sides' the same, its rounds and the score)
  s.matches = [];
  round.on((kind, d) => {
    if (kind === 'matchEnd') s.matches.push({ wins: d.wins, weapons: fighters.map(f => f.weapon.spec.key), rounds: d.results.map(r => ({ w: r.winner, how: r.how, t: +r.time.toFixed(1), ot: r.overtime })) });
  });
  const R = physics.RAPIER, probe = new R.Capsule(0.6, 0.25), rot = { x: 0, y: 0, z: 0, w: 1 };
  const elementHandles = new Map(machine.mech.els.filter(e => e.collider).map(e => [e.collider.handle, e]));
  // the turntable's arms (turnParts 2..4) are SCRIBE's elements too
  physics.turnParts.slice(2, 5).forEach((p, k) => elementHandles.set(p.c.handle, machine.mech.byId.get('arm' + k)));
  function overlaps(f) {
    let hit = null;
    physics.world.intersectionsWithShape({ x: f.feet.x, y: f.feet.y + 0.9, z: f.feet.z }, rot, probe, c => {
      const e = elementHandles.get(c.handle);
      if (e) { hit = e; return false; }
      return true;
    });
    return hit;
  }

  function update(dt) {
    s.clock += dt;
    if (round.over === null) s.roundTime += dt;
    fighters.forEach((f, i) => {
      // pushing the stick without moving (in the open: in cover the stick rests)
      const pushing = !!bots[i].action.move && Math.hypot(bots[i].action.move.x, bots[i].action.move.y) > 0.1 && f.alive;
      s.stuck[i] = pushing && f.character.speed.length() < 0.3 ? s.stuck[i] + dt : 0;
      s.stuckMax[i] = Math.max(s.stuckMax[i], s.stuck[i]);
      // task 012: where and why, once per stuck spell longer than 3 s (the nearest elements and their state)
      if (s.stuck[i] > 3 && !f.__stuckLogged && (s.stuckAt ??= []).length < 12) {
        f.__stuckLogged = true;
        const near = machine.mech.els.map(e => ({ e, d: Math.hypot(e.spec.x - f.feet.x, e.spec.z - f.feet.z) })).sort((a, b) => a.d - b.d).slice(0, 3)
          .map(({ e, d }) => `${e.id}${e.spec.type}:${e.phase}:h${e.pose.h.toFixed(1)}:r${e.pose.rot.toFixed(0)}@${d.toFixed(1)}`);
        s.stuckAt.push({ who: i, t: +round.time.toFixed(1), at: [+f.feet.x.toFixed(1), +f.feet.z.toFixed(1)], plan: bots[i].plan?.kind, cover: f.coverState.mode,
          move: bots[i].action.move, near });
      }
      if (s.stuck[i] === 0) f.__stuckLogged = false;
      // new shots of this fighter (the log keeps the last ones): hits must have had a line of sight from the eyes
      const log = f.weapon.log, fresh = f.weapon.fired - seen[i];
      seen[i] = f.weapon.fired;
      for (const e of log.slice(log.length - Math.min(fresh, log.length))) {
        s.shots++;
        if (e.blind) { s.blindShots++; if (e.target) s.blindHits++; continue; }
        if (!e.target) continue;
        s.hits++;
        if (windows.some(([a, b]) => round.time >= a && round.time <= b)) s.hitsInOpen++;
        f.eyes(eyes); at.copy(e.from).addScaledVector(e.dir, e.t);
        const z = e.target.zones(), pts = [z.head, (z.torso[0] + z.torso[1]) / 2, z.legs[1]];
        if (!pts.some(y => ballistics.clear(eyes, p.set(z.feet.x, y, z.feet.z)))) { s.hitsBlind++; s.blind.push({ round: s.rounds.length, who: i, t: +round.time.toFixed(2), cover: f.coverState.mode, act: f.cover.act?.kind ?? null, item: f.itemState?.holding ?? null, busy: !!f.itemState?.busy, dist: +e.from.distanceTo(eyes).toFixed(2), eyes: eyes.toArray().map(v => +v.toFixed(2)), from: e.from.toArray().map(v => +v.toFixed(2)), at: at.toArray().map(v => +v.toFixed(2)) }); }
        if (!ballistics.clear(eyes, at)) s.pointBlind++;
      }
    });
    for (const e of machine.scribe.events) {
      if (seenEvents.has(e)) continue;
      seenEvents.add(e);
      if (e.kind === 'open') { s.openings++; windows.push([e.t + OPEN_AFTER, e.t + OPEN_AFTER + OPEN_HOLD]); }
      if (e.kind === 'camp') s.camps++;
    }
    fighters.forEach(f => {
      if (!f.alive) return;
      const e = overlaps(f);
      if (e) { s.overlap++; if (s.overlapAt.length < 10) s.overlapAt.push({ id: e.id, phase: e.phase, h: +e.pose.h.toFixed(2), t: +round.time.toFixed(1),
        riding: f.character.riding, cover: f.coverState.mode, dodge: !!f.character.dodge, turn: +(physics.turnAngle * 180 / Math.PI).toFixed(1), at: [+f.feet.x.toFixed(2), +f.feet.z.toFixed(2), +f.feet.y.toFixed(2)] }); }
    });
    const over = round.over !== null;
    if (over && !wasOver) {
      const winner = round.score.me > lastScore.me ? 'a' : round.score.foe > lastScore.foe ? 'b' : round.score.draws > lastScore.draws ? 'draw' : null;
      s.rounds.push({ time: +s.roundTime.toFixed(1), winner, hp: fighters.map(f => +f.hp.toFixed(1)) });
      lastScore = { ...round.score };
    }
    if (!over && wasOver) { s.roundTime = 0; windows.length = 0; }
    wasOver = over;
  }
  return { update, s };
}
