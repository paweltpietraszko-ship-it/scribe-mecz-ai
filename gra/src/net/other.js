// Task 028 (K4, K2): what a PvP window shows of the server's state besides its own fighter.
//   the other fighter: from the room's patches (30 a second) kept with their server times, shown PVP.buffer ms back:
//     its moment goes towards serverNow − buffer − ping/2 (Colyseus's rule, as its Predict "lerp" draws it), between
//     the two patches round that moment (the numbers in between, the rest as the older one has them; Predict smooths
//     numbers only, the pose's other fields must come from the same patch, so the buffer is kept here). The moment
//     runs on as time does and follows that aim softly (PVP.followMs): when the patches stop for a while (a late
//     message holds up the ones behind it, K1) the other slows down at the newest one and then catches up, instead of
//     standing and jumping. The server judges this window's shots at the moment shown (K5: lag, net/own.js)
//   the arena (the moving panel, the turntable, SCRIBE's elements): as fresh as it can be drawn smoothly, one patch
//     back from the newest one (its moves are slow and announced 1.2 s ahead: the own fighter rides it as shown)
//   the events (sent right after each patch, each with its server time): the other's shots and pictures when its body
//     shown gets there; the arena's signals and sounds with the arena; the round, the hits on the own fighter and the
//     combat log at once
import { wireToView, wireToArena, wireToRound } from './wire.js';
import { roundFor, eventFor } from '../fighter/perspective.js';
import { combatLog } from '../combat/log.js';
import { PVP } from '../data/match.js';
import * as THREE from 'three';

const KEEP = 64;   // patches kept (2 s at 30 a second)
// the body's numbers drawn in between two patches (the rest: the older patch's)
const LERP = ['x', 'y', 'z', 'sx', 'sz', 'ix', 'iz', 'vy', 'pitch', 'turn', 'aYaw', 'aSlide', 'aU', 'pru', 'prw', 'rT', 'dgT'];
const ANGLES = ['yaw'];
const lerpAngle = (a, b, u) => a + (Math.atan2(Math.sin(b - a), Math.cos(b - a))) * u;
const back = a => (a?.v3 ? new THREE.Vector3(...a.v3) : a);

// engine: the window's; room; side: 'a' | 'b'; to: { effects, audio, onHurt } of the page
export function createOther({ engine, room, side, to }) {
  const mine = side === 'a' ? 0 : 1, theirs = 1 - mine;
  const [A, B] = engine.fighters;   // the window's: A its own, B the other (fighter/perspective.js)
  const fighterOf = s => (s === side ? A : B);
  const clock = room.clock;
  const patches = [];   // { t, f (the other's fields), arena, els }
  const forOther = [], forArena = [];   // the events kept: { t, ev, shots } (the other's), { t, ev } (the arena's), in order
  let lastArena = null, lastRound = '';

  // a patch came: the other, the arena and the round kept with its server time
  function patch() {
    const st = room.state, fs = st.fighters?.[theirs];
    if (!fs || !st.arena) return;
    const t = clock.lastServerTime();
    if (patches.length && patches[patches.length - 1].t === t) patches.pop();
    patches.push({ t, f: { ...fs.toJSON(), ...fs.st.toJSON() }, arena: st.arena.toJSON(), els: st.els.map(e => [e.h, e.rot, e.slide, e.ph, e.drop, e.k]) });
    if (patches.length > KEEP) patches.shift();
    // (the round as the server has it once the match is on: before it the room's round is still empty)
    const r = JSON.stringify(st.round.toJSON());
    if ((st.phase === 'match' || st.phase === 'end') && st.round.current && r !== lastRound) { lastRound = r; engine.round.show(roundFor(side, wireToRound(st.round))); }
  }
  // the events of the steps since the last patch: the round's and the own fighter's at once, the rest kept
  function heard(batch) {
    for (const [t, ev, shotsA, shotsB] of batch) {
      const later = [], arena = [];
      for (const e of ev) {
        const [kind, name, args] = e;
        if (kind === 'round') engine.round.replay(name, eventFor(side, name, args[0]));
        else if (kind === 'hurt') { if (name === side) to.onHurt?.({ dir: back(args[0]) }); }
        else if (kind === 'log') { if (to.log !== false) combatLog.add(args[0]); }
        else if (kind === 'fx' && e[3] === side) continue;   // (the own shots' pictures: the window made them itself)
        else if (kind === 'fx' && e[3]) later.push(e);       // (the other's)
        else arena.push(e);                                   // (SCRIBE's signals and sounds, the items' pictures)
      }
      const shots = side === 'a' ? shotsB : shotsA;
      if (later.length || shots.length) forOther.push({ t, ev: later, shots });
      if (arena.length) forArena.push({ t, ev: arena });
    }
  }

  // the two patches round time t and the share u between them (or the one nearest)
  function at(t) {
    let i = patches.length - 1;
    while (i > 0 && patches[i - 1].t > t) i--;
    const b = patches[i], a = patches[Math.max(0, i - 1)];
    if (!b) return null;
    if (a === b || t >= b.t) return { a: b, b, u: 0 };
    if (t <= a.t) return { a, b: a, u: 0 };
    return { a, b, u: (t - a.t) / (b.t - a.t) };
  }
  const aimBack = () => PVP.buffer + (clock.smoothedRtt?.() ?? 0) / 2;
  let shown = null;   // the other's moment drawn (server ms)
  let drawn = null, jumps = 0;   // (K4: the other's place drawn last step; the steps it jumped)
  const otherTime = () => shown ?? clock.serverNow() - aimBack();
  const otherBack = () => clock.serverNow() - otherTime();
  // one step: the moment on by dt, towards its aim, never past the newest patch
  function follow(dt) {
    const aim = clock.serverNow() - aimBack(), newest = patches.length ? patches[patches.length - 1].t : aim;
    if (shown === null || Math.abs(aim - shown) > PVP.jumpMs) shown = aim;   // (the start, a long break: no slow catching up)
    else shown += dt * 1000 + (aim - shown) * Math.min(1, dt * 1000 / PVP.followMs);
    if (shown > newest) shown = newest;
  }
  const arenaTime = () => clock.serverNow() - (clock.smoothedRtt?.() ?? 0) / 2 - (clock.patchInterval?.() || 33);

  // one step of the window's clock: the arena, the other and the events due put in place. dt: the step
  function step(dt) {
    const ar = at(arenaTime());
    if (ar) {
      const { a, b, u } = ar, m = { ...a.arena };
      for (const k of ['pTension', 'pFlash', 'pDrop', 'tTension', 'tFlash', 'tAngle']) m[k] = a.arena[k] + (b.arena[k] - a.arena[k]) * u;
      const els = a.els.map((x, i) => { const y = b.els[i] ?? x; return [x[0] + (y[0] - x[0]) * u, lerpAngle(x[1], y[1], u), x[2] + (y[2] - x[2]) * u, x[3], x[4] + (y[4] - x[4]) * u, x[5]]; });
      const w = wireToArena(m);
      const camp = side === 'a' ? w.camp : [w.camp[1], w.camp[0]];
      engine.showArena(dt, w.m, { els, camp });
      engine.nav.update(dt, w.m);   // (the navigation follows the panel and the disc, as the server's: the own fighter's run to cover)
      lastArena = w.m;
    }
    follow(dt);
    const tOther = otherTime(), op = at(tOther);
    if (op) {
      const { a, b, u } = op, f = { ...a.f };
      for (const k of LERP) f[k] = a.f[k] + (b.f[k] - a.f[k]) * u;
      for (const k of ANGLES) f[k] = lerpAngle(a.f[k], b.f[k], u);
      if (a.f.dgT < 0 || b.f.dgT < 0) f.dgT = a.f.dgT;   // (a dodge starts or ends: no share of "none")
      if (a.f.resets !== b.f.resets) Object.assign(f, b.f);   // (a new round: no gliding from the old place)
      B.show(dt, wireToView(f), fighterOf);
      // K4's report: a step the other's drawn place moved faster than anyone runs (a jump on the screen)
      // (faster than both the jump speed and half again the other's own speed between the two patches: a dodge is fast)
      const own = a === b ? 0 : Math.hypot(b.f.x - a.f.x, b.f.z - a.f.z) / ((b.t - a.t) / 1000);
      if (drawn && Math.hypot(f.x - drawn.x, f.z - drawn.z) / dt > Math.max(PVP.jumpSpeed, 1.5 * own) && a.f.resets === b.f.resets) jumps++;
      drawn = { x: f.x, z: f.z };
    }
    // the events whose moment has come: the other's at the other's moment, the arena's with the arena
    while (forOther.length && forOther[0].t <= tOther) {
      const { ev, shots } = forOther.shift();
      if (shots.length) B.weapon.heard(shots, fighterOf);
      play(ev);
    }
    const tArena = arenaTime();
    while (forArena.length && forArena[0].t <= tArena) play(forArena.shift().ev);
    engine.physics.refresh();   // (the moved colliders seen by the own fighter's step and the camera)
    return lastArena;
  }
  function play(ev) {
    for (const [kind, name, args] of ev) {
      if (kind === 'fx') to.effects[name]?.(...args.map(back));
      else if (kind === 'audio') to.audio[name]?.(...args.map(x => (x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, back(v)])) : x)));
      else if (kind === 'sig') engine.machine.signal(name, back(args[0]));
    }
  }

  room.onStateChange(patch);
  return {
    step,
    heard,   // (the room's 'e' messages: net/pvp.js passes them on)
    get m() { return lastArena; },
    // ms the other is drawn back from the server's now (K5: the window tells the server, net/own.js)
    get lag() { return otherBack(); },
    // K4's report: how far back the other is drawn, and whether it waits at the newest patch (the patches ran out)
    get behind() { return otherBack(); },
    get jumps() { return jumps; },
    get starved() { return patches.length > 0 && patches[patches.length - 1].t <= otherTime() && clock.serverNow() - aimBack() > otherTime() + 1; },
  };
}
