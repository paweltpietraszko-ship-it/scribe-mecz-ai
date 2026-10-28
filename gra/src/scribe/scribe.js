// SCRIBE (task 012, part B): what moves and when, by the v4 rules of the simulator (plan/01_PLAN_GRY.md §4.1,
// tools/sim/sim.py pm_v2, radius_rule, random_openings, clear). SCRIBE knows where both fighters stand and whether they
// see each other ("contact"); it is never given their health and never reads it (filar 1). It treats both the same.
// Openings, bluffs, random openings and the background moves look and sound the same (§4.2).
import * as THREE from 'three';
import { SCRIBE as S } from '../data/scribe.js';
import { ARENA_SECTION, TURNTABLE } from '../data/arena.js';
import { nearSegment, distance } from './footprint.js';
import { flashGlow } from '../look/materials.js';

const [TX, TZ] = TURNTABLE.center;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// mech: scribe/mechanisms.js; fighters: [a, b] (feet, alive, eyes(v), character.speed); ballistics: combat/ballistics.js
// (clear: lines of sight); motion: arena/motion.js (the turntable and the wall's panel); signal(kind, at): SCRIBE's
// public events for the LED screen (task 013): 'camp' with the place of the penalty, 'final'
export function createScribe({ mech, fighters, ballistics, motion, signal = () => {}, rand }) {
  // task 027 (K4): chance from the match's seed (sim/random.js)
  const rnd = ([a, b]) => a + rand() * (b - a);
  const pick = (list, n) => { const a = [...list], out = []; while (a.length && out.length < n) out.push(a.splice(Math.floor(rand() * a.length), 1)[0]); return out; };
  let enabled = S.enabled, clock = 0, lastContact = 0, nextContact = 0, flash = null;
  const next = {}, later = [], reserved = new Map(), drained = new Set(), finalDone = new Set();
  const camp = fighters.map(() => null), push = fighters.map(() => ({ still: 0, cooldown: 0 }));
  const stats = { openings: 0, bluffs: 0, random: 0, ambient: 0, camp: 0, push: 0, drain: 0, final: 0, turntable: 0, panel: 0 };
  const events = [];   // the last events, for test scripts: { t, kind, ids }

  const final = () => clock >= S.final.from;
  // where an element stands when nothing moves it: full height, or its final height in the final phase
  function basePose(e) {
    if (!final()) return { h: e.H, rot: 0, slide: 0 };
    return { h: e.spec.type === 'stopa' ? S.final.stopa : e.spec.final, rot: 0, slide: 0 };
  }
  // the pose that takes an element out of the way: sunk, a wedge folded, a foot back in the wall, a blade turned
  // (clear of the corridor a–b when one is given, else at random within its range)
  function awayPose(e, corridor) {
    const t = e.spec.type;
    if (t === 'klin') return { h: S.foldTo };
    if (t === 'stopa') return { slide: S.slideBack };
    if (t !== 'lopata') return { h: 0 };
    const [lo, hi] = e.spec.rot;
    if (!corridor) return { rot: Math.round(rnd([lo, hi])) };
    const angles = [];
    for (let d = Math.ceil(lo / 5) * 5; d <= hi; d += 5) angles.push(d);
    angles.sort((a, b) => Math.abs(a) - Math.abs(b));
    for (const d of angles) if (!nearSegment(mech.footprint(e, { rot: d, slide: 0 }), corridor[0], corridor[1], S.corridor)) return { rot: d };
    return null;
  }
  const free = e => mech.solid(e) && !reserved.has(e.id) && !drained.has(e.id);
  const tall = e => e.pose.h >= S.blocks;

  // take elements out of the way for `hold` s, then back; `until`: keep them reserved until released (camp, drain)
  function clear(list, { hold, corridor = null, warn = S.warn, keep = false, kind }) {
    const used = [];
    for (const e of list) {
      const away = awayPose(e, corridor);
      if (!away || !mech.move(e.id, away, { warn })) continue;
      used.push(e.id);
      reserved.set(e.id, kind);
      if (!keep) later.push({ t: clock + warn + (S.moveTime[e.spec.type] ?? 1.5) + hold, fn: () => restore(e) });
    }
    if (used.length) events.push({ t: +clock.toFixed(2), kind, ids: used });
    if (events.length > 200) events.shift();
    return used;
  }
  // back to where it stands (its final height in the final phase); an element still moving tries again shortly
  function restore(e) {
    if (mech.busy(e)) { later.push({ t: clock + 0.5, fn: () => restore(e) }); return; }
    mech.move(e.id, basePose(e));
    reserved.delete(e.id);
  }

  // the elements that stand in the line a–b and block it (as high as the eyes); null if any of them cannot move now
  function blockers(a, b) {
    const out = [];
    for (const e of mech.els) {
      if (!tall(e) || !nearSegment(mech.footprint(e), a, b, S.corridor)) continue;
      if (!free(e)) return null;
      out.push(e);
    }
    return out;
  }

  const eyesA = new THREE.Vector3(), eyesB = new THREE.Vector3();
  const sees = () => { fighters[0].eyes(eyesA); fighters[1].eyes(eyesB); return ballistics.clear(eyesA, eyesB); };

  // 1) line opening: every second, when the fighters are at the right distance and do not see each other
  function opening(quiet) {
    const O = S.opening, [a, b] = fighters.map(f => f.feet);
    const gap = quiet < O.quiet ? O.gap : O.gapQuiet;
    if (clock - (next.lastOpen ?? -Infinity) < gap) return;
    const d = dist(a, b), dmax = quiet < O.quiet ? O.dist[1] : O.distQuiet;
    const nmax = quiet < O.quiet ? O.max : quiet < O.long ? O.maxQuiet : O.maxLong;
    if (d < O.dist[0] || d > dmax || sees()) return;
    const bl = blockers(a, b);
    if (!bl || bl.length < 1 || bl.length > nmax) return;
    if (clear(bl, { hold: quiet < O.long ? O.hold : O.holdLong, corridor: [a, b], kind: 'open' }).length) {
      next.lastOpen = clock; stats.openings++;
    }
  }
  // 3) random opening: a random long line somewhere in the section opens for a while (looks like an opening)
  function randomOpening() {
    const R = S.random, r = ARENA_SECTION.boundary.radius - 2;
    for (let k = 0; k < R.tries; k++) {
      const ang = rand() * Math.PI, rr = Math.sqrt(rand()) * r, th = rand() * Math.PI;
      const a = { x: TX + rr * Math.cos(th), z: TZ + rr * Math.sin(th) }, b = { x: a.x + Math.cos(ang) * R.length, z: a.z + Math.sin(ang) * R.length };
      if (Math.hypot(b.x - TX, b.z - TZ) > r || b.z < 1) continue;
      const bl = blockers(a, b);
      if (!bl || bl.length < 1 || bl.length > R.max) continue;
      if (clear(bl, { hold: R.hold, corridor: [a, b], kind: 'random' }).length) { stats.random++; return; }
    }
  }

  // 7) camping (public): per fighter, the place it keeps to; limits in turn; the walls around come back when it leaves
  function camping(f, k) {
    const C = S.camp;
    let st = camp[k];
    if (!st) st = camp[k] = { anchor: f.feet.clone(), since: clock, level: 0, down: [] };
    if (dist(f.feet, st.anchor) > C.radius) {
      st.down.forEach(e => { reserved.delete(e.id); later.push({ t: clock + C.backAfter, fn: () => restore(e) }); });
      Object.assign(st, { anchor: f.feet.clone(), since: clock, down: [] });
      return;
    }
    if (st.down.length || clock - st.since < C.limits[Math.min(st.level, C.limits.length - 1)]) return;
    const near = mech.els.filter(e => free(e) && e.pose.h >= C.minHeight && distance(mech.footprint(e), f.feet.x, f.feet.z) < C.reach);
    const used = clear(near, { hold: 0, keep: true, kind: 'camp' });
    st.down = near.filter(e => used.includes(e.id));
    st.level++; stats.camp++;
    startFlash('camp', { x: f.feet.x, z: f.feet.z });
  }
  // seconds left before this fighter's camping limit, or null (moving on, or the walls are already down)
  function campLeft(k) {
    const st = camp[k];
    if (!enabled || !st || st.down.length) return null;
    return Math.max(0, S.camp.limits[Math.min(st.level, S.camp.limits.length - 1)] - (clock - st.since));
  }

  // 8) push: a long silence and a fighter standing still → the cover around it goes for a while
  function pushing(f, k, dt, quiet) {
    const P = S.push, p = push[k];
    p.still = f.character.speed.length() < P.stillSpeed ? p.still + dt : 0;
    if (quiet < P.quiet || p.still < P.still || clock < p.cooldown) return;
    const ids = mech.els.filter(e => free(e) && e.pose.h > 0 && distance(mech.footprint(e), f.feet.x, f.feet.z) < P.reach);
    if (clear(ids, { hold: P.hold, warn: P.warn, kind: 'push' }).length) stats.push++;
    p.cooldown = clock + P.cooldown; p.still = 0;
    if (camp[k]) Object.assign(camp[k], { anchor: f.feet.clone(), since: clock });
  }

  // 6) cover drain: after a long silence the cover goes from the section's edge inwards; back after contact
  function draining(quiet) {
    const D = S.drain;
    if (quiet >= D.quiet) {
      const R = Math.max(D.min, D.from - (quiet - D.quiet) * D.rate);
      for (const e of mech.els) {
        if (!free(e) || e.pose.h <= 0 || Math.hypot(e.spec.x - TX, e.spec.z - TZ) <= R) continue;
        if (fighters.some(f => f.alive && distance(mech.footprint(e), f.feet.x, f.feet.z) < 2)) continue;
        if (clear([e], { hold: 0, keep: true, kind: 'drain' }).length) { drained.add(e.id); stats.drain++; }
      }
    } else if (quiet < D.back && drained.size) {
      for (const id of drained) restore(mech.byId.get(id));
      drained.clear();
    }
  }

  // 9) final phase: the high cover goes to its final height, kind by kind (§3.1)
  function finalPhase() {
    for (const e of mech.els) {
      const at = S.final.at[e.spec.type];
      if (finalDone.has(e.id) || at === undefined || clock < at || mech.busy(e)) continue;
      finalDone.add(e.id); reserved.delete(e.id); drained.delete(e.id);
      if (mech.move(e.id, basePose(e))) stats.final++;
    }
    if (!next.finalFlash) { next.finalFlash = true; startFlash('final'); }
  }

  // the arena's flash (U23)
  function startFlash(kind, at = null) {
    if (S.flash.enabled && S.flash.events.includes(kind)) flash = { t: 0 };
    signal(kind, at);   // the screen's alarm at the same moment (task 013)
  }
  const flashColor = new THREE.Color(S.flash.color);

  function schedule() {
    Object.assign(next, { bluff: rnd(S.bluff.every), random: rnd(S.random.every), ambient: rnd(S.ambient.every),
      turntable: rnd(S.turntable.every), panel: rnd(S.panel.every), check: 0, lastOpen: -Infinity, finalFlash: false });
  }
  schedule();

  // one step: dt; time: the round's clock (s since it started), from fighter/round.js
  function update(dt, time) {
    if (flash) {
      flash.t += dt;
      const u = flash.t / S.flash.time;
      flashGlow(u >= 1 ? 0 : S.flash.strength * Math.sin(Math.PI * u), flashColor, S.flash.boost);
      if (u >= 1) flash = null;
    }
    clock = time;
    for (let i = later.length - 1; i >= 0; i--) if (later[i].t <= clock) later.splice(i, 1)[0].fn();
    // the camp warning: the script of the walls that will go down pulses in the last seconds, for both to see
    mech.els.forEach(e => { e.warned = false; });
    fighters.forEach((f, k) => {
      const left = campLeft(k);
      if (left === null || left > S.camp.warnLast || !f.alive) return;
      for (const e of mech.els) if (free(e) && e.pose.h >= S.camp.minHeight && distance(mech.footprint(e), f.feet.x, f.feet.z) < S.camp.reach) e.warned = true;
    });
    const beat = S.pulse.amount * (0.5 + 0.5 * Math.sin(clock * S.pulse.speed * Math.PI * 2));
    mech.els.forEach(e => { if (e.warned || e.pulsed) mech.pulse(e, e.warned ? beat : 0); e.pulsed = e.warned; });

    if (!enabled || !fighters.every(f => f.alive)) return;
    if (clock >= (nextContact ?? 0)) { nextContact = clock + S.contactEvery; if (sees()) lastContact = clock; }
    const quiet = clock - lastContact;
    if (final()) return finalPhase();
    if (clock >= next.check) { next.check = clock + S.opening.every; opening(quiet); }
    if (clock >= next.bluff) {
      next.bluff = clock + rnd(S.bluff.every);
      const list = pick(mech.els.filter(e => free(e) && tall(e)), Math.round(rnd(S.bluff.count)));
      if (clear(list, { hold: S.bluff.hold, kind: 'bluff' }).length) stats.bluffs++;
    }
    if (clock >= next.random) { next.random = clock + rnd(S.random.every); randomOpening(); }
    if (clock >= next.ambient) {
      next.ambient = clock + rnd(S.ambient.every);
      const list = pick(mech.els.filter(e => free(e) && e.pose.h > 0), 1);
      if (clear(list, { hold: S.ambient.hold, kind: 'ambient' }).length) stats.ambient++;
    }
    if (clock >= next.turntable) {
      next.turntable = clock + rnd(S.turntable.every);
      motion.turnNow(Math.round(rnd(S.turntable.degrees)) * (rand() < 0.5 ? -1 : 1)); stats.turntable++;
    }
    if (clock >= next.panel) { next.panel = clock + rnd(S.panel.every); motion.lowerPanel(); stats.panel++; }
    draining(quiet);
    fighters.forEach((f, k) => { camping(f, k); pushing(f, k, dt, quiet); });
  }

  // a new round: the arena back where it stands, the clocks from zero
  function reset() {
    mech.reset();
    later.length = 0; reserved.clear(); drained.clear(); finalDone.clear();
    camp.fill(null); push.forEach(p => { p.still = 0; p.cooldown = 0; });
    lastContact = 0; nextContact = 0; clock = 0; schedule();
    mech.els.forEach(e => { if (e.pulsed) mech.pulse(e, 0); e.pulsed = false; });
  }

  // task 017, the machine's key (ITEMS.key): the tall elements within K.radius of `at` ({ x, z }) go away for K.hold s,
  // announced K.warn s before, by SCRIBE's own rules (an element moving, reserved or drained stays; the lift's doors
  // stop it on a character); the arms and the feet are left (K.skip). Public: announced on the elements and signalled to
  // the LED screen from the key's place. Returns the ids taken
  function key(at, K) {
    const near = mech.els.filter(e => free(e) && e.pose.h >= K.minHeight && !K.skip.includes(e.spec.type)
      && distance(mech.footprint(e), at.x, at.z) < K.radius);
    const used = clear(near, { hold: K.hold, warn: K.warn, kind: 'key' });
    signal('key', { x: at.x, z: at.z });
    return used;
  }

  return {
    update, reset, campLeft, stats, events, key,
    get enabled() { return enabled; },
    // switched off: the arena back in its quiet layout at once, nothing moves (the turntable and the panel as before)
    setEnabled(v) { enabled = v; reset(); if (!v) motion.settle(); motion.setAuto(!v); },
    get quiet() { return clock - lastContact; },
    forceQuiet(s) { lastContact = clock - s; },   // test scripts: as if nobody had seen anybody for s
  };
}
