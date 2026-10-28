// The bot's decisions (task 009, point 7; the pattern is the Bot class of tools/sim/sim.py): which behaviour, which
// place, and what to press on the way. It knows the arena (its covers, the navigation mesh) and only what the senses
// (senses.js) tell it about the other fighter.
//   search:  no knowledge: walks the fragment, the least visited cells first;
//   attack:  from cover to cover towards the known place, shoots out of cover's corners;
//   ambush:  a cover with a view of where the other probably comes from; waits, peeks and looks round;
//   flank:   the other stays long behind one cover: goes round to its side, then attacks from there;
//   retreat: under BOT.medkitBelow HP under fire: a cover the other cannot see into, then the medkit.
// A new choice every BOT.decideEvery s or after an event (saw, lost, heard, hit). A goal it cannot reach for BOT.stuck s
// is dropped for another (no circling).
import * as THREE from 'three';
import { BOT, NAV } from '../data/bot.js';
import { COVER as C } from '../data/cover.js';
import { ARENA_SECTION, TURNTABLE } from '../data/arena.js';
import { SCRIBE } from '../data/scribe.js';

const [TX, TZ] = TURNTABLE.center;   // the section's centre (task 011)

const EYE = 1.6, CHEST = 1.25, MUZZLE = 1.35, CROUCH_EYE = 1.0;
const RIFLE = { ahead: 0.6, right: 0.2 };   // the muzzle from the eyes while aiming, m
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// me: the bot's fighter; nav: bot/nav.js; ballistics: for the arena's lines of sight; level: LEVELS[…]
// camp(): the seconds left before SCRIBE's camping limit for this fighter, or null (task 012): the bot sees the same
// warning as the player, the pulsing script round it, and moves on
export function createBrain({ me, nav, ballistics, level, camp = () => null, rand }) {
  const cover = me.cover;
  let plan = { kind: 'search' }, nextDecide = 0, clock = 0, last = { sees: false, when: -Infinity, hurt: -Infinity, heard: -Infinity };
  let path = [], pathFor = null, pathVersion = -1, pathAge = 0;
  let stall = 0, lastPos = { x: 0, z: 0 }, best = Infinity, progressT = 0;
  let unstick = null;   // task 012: { to, t }: wedged off the mesh (between two leaning slabs): back to it first
  let blindT = 0;   // task 015: > 0 while a burst of blind fire lasts, < 0 until the next may start
  let peek = { on: false, t: 0 }, healPressed = false, dodgeT = 0, coverTries = 0, looked = 0, logSeen = 0, wallShots = 0;
  const banned = new Map();                     // spots given up: key -> until (clock)
  const cells = new Map();                      // search: visits per cell
  const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();

  // ---- places ----
  // cover spots: every cover line, where it stands to lean out of each of its corners (task 015: cover.js; a narrow
  // cover has one place and leans out of either side, the one the view looks towards); low cover (task 015): one place
  // in its middle, rising over it
  function spots() {
    const out = [];
    for (const l of cover.lines) {
      if (!cover.valid(l)) continue;
      const add = (along, side, lean) => {
        const p = cover.standAt(l, along);
        if (p.x < NAV.bounds.x[0] || p.x > NAV.bounds.x[1] || p.y < NAV.bounds.z[0] || p.y > NAV.bounds.z[1]) return;
        // the eyes out of the corner: as far as the lean goes, and a little short of it (the rifle is in front of them)
        const q = p.clone().addScaledVector(l.dir, side * lean), q0 = p.clone().addScaledVector(l.dir, side * lean * 0.7);
        out.push({ l, along, low: l.crouch, p: { x: p.x, z: p.y }, q: { x: q.x, z: q.y }, q0: { x: q0.x, z: q0.y }, key: l.id + ':' + side });
      };
      if (l.crouch) { add(l.len / 2, 0, 0); continue; }
      // the shorter lean (to the view's right) is the one sure to be there
      for (const side of [-1, 1]) if (cover.openEnd(l, side)) add(cover.cornerAt(l, side), side, cover.leanFor(l, side, C.peekOut.right));
    }
    return out;
  }
  const sees = (from, to, h1 = EYE, h2 = CHEST) => ballistics.clear(a3.set(from.x, h1, from.z), b3.set(to.x, h2, to.z));
  // out of the corner at q the eyes see e, and so does the rifle: in the right hands, in front of the eyes and to their
  // right, lower (a tooth is wider there); checked from the eyes to the muzzle and from the muzzle to e
  function canShoot(s, e) {
    if (!sees(s.q, e) || !sees(s.q0, e)) return false;
    const dx = e.x - s.q.x, dz = e.z - s.q.z, L = Math.hypot(dx, dz) || 1, fx = dx / L, fz = dz / L;
    const m = { x: s.q.x + fx * RIFLE.ahead - fz * RIFLE.right, z: s.q.z + fz * RIFLE.ahead + fx * RIFLE.right };
    return sees(s.q, m, EYE, MUZZLE) && sees(m, e, MUZZLE);
  }
  // e: where the other is believed to be. cond: 'fight' (hidden at the spot, seen out of its corner), 'hide' (hidden
  // at the spot and out of the corner). range: [min, max] distance from e. Returns the best spot or null
  function pickSpot(e, cond, range, prefer) {
    let bestS = null, bestV = -Infinity;
    const here = me.feet;
    for (const s of spots()) {
      if ((banned.get(s.key) ?? -1) > clock) continue;
      const d = dist(s.p, e);
      if (d < range[0] || d > range[1]) continue;
      if ((e.x - s.p.x) * s.l.n.x + (e.z - s.p.z) * s.l.n.y > -0.3) continue;   // the wall is not between
      if (sees(s.p, e, s.low ? CROUCH_EYE : EYE)) continue;                     // seen where it stands (crouched at low cover)
      if (cond === 'fight' && !canShoot(s, e)) continue;                        // cannot shoot out of the corner
      if (cond === 'hide' && sees(s.q, e, EYE, EYE)) continue;
      const v = prefer(s, d, dist(s.p, here));
      if (v > bestV) { bestV = v; bestS = s; }
    }
    return bestS;
  }

  // ---- choosing ----
  const fresh = know => know.where && clock - know.when < level.memory;
  function decide(know) {
    nextDecide = clock + BOT.decideEvery;
    const e = fresh(know) ? know.where : null;
    const underFire = clock - know.hurt < BOT.hurtMemory || know.sees;
    // the medkit: fall back first when under fire, else at once
    if (me.hp < level.medkitBelow && me.health.medkits > 0 && !me.health.healing) {
      if (!e || !underFire) return setPlan({ kind: 'heal' });
      const s = pickSpot(e, 'hide', [4, 30], (s, d, fromMe) => -fromMe);
      if (s) return setPlan({ kind: 'retreat', spot: s, goal: s.p });
    }
    if (plan.kind === 'retreat' || plan.kind === 'heal') { if (me.health.healing) return; }
    if (!e) {
      if (level.ways.includes('ambush') && plan.kind !== 'ambush' && rand() < 0.25) return ambush(guess(know));
      if (plan.kind === 'search' && plan.goal && dist(me.feet, plan.goal) > BOT.arrive) return;
      return setPlan({ kind: 'search', goal: searchPoint() });
    }
    // the other stays in one place: go round it
    if (level.ways.includes('flank') && plan.kind !== 'flank' && !know.sees && plan.stillSince !== undefined && clock - plan.stillSince > BOT.flankAfter) {
      const side = rand() < 0.5 ? 1 : -1, dx = e.x - me.feet.x, dz = e.z - me.feet.z, L = Math.hypot(dx, dz) || 1;
      const g = nav.closest({ x: e.x - dx / L * 3 - dz / L * BOT.flankSide * side, z: e.z - dz / L * 3 + dx / L * BOT.flankSide * side });
      if (g) return setPlan({ kind: 'flank', goal: g, e });
    }
    // keep a fight that works: in cover with the other in sight, or waiting in an ambush
    if (plan.kind === 'attack' && plan.spot && inSpot() && (know.sees || clock - know.when < 4)) return;
    if (plan.kind === 'ambush' && plan.spot && clock - plan.since < BOT.ambushWait && !know.sees) return;
    if (level.ways.includes('ambush') && !know.sees && know.how === 'sound' && rand() < 0.4) return ambush(e);
    attack(e);
  }
  function attack(e) {
    // task 016: the distance it likes depends on the match's weapon (BOT.prefer)
    const want = BOT.prefer[me.weapon.spec.key] ?? 11;
    const s = pickSpot(e, 'fight', BOT.engage, (s, d, fromMe) => -Math.abs(d - want) - 0.6 * fromMe + (d < dist(me.feet, e) ? 3 : 0));
    setPlan({ kind: 'attack', spot: s, goal: s ? s.p : nav.closest(e), e });
  }
  function ambush(x) {
    const s = pickSpot(x, 'fight', BOT.ambushRange, (s, d, fromMe) => -0.4 * fromMe + rand() * 2);
    if (!s) return attack(x);
    setPlan({ kind: 'ambush', spot: s, goal: s.p, e: x });
  }
  // where the other probably comes from without knowledge: the last place known long ago, else the fragment's middle
  const guess = know => know.where ?? { x: (NAV.bounds.x[0] + NAV.bounds.x[1]) / 2, z: (NAV.bounds.z[0] + NAV.bounds.z[1]) / 2 };
  function setPlan(p) {
    const keepStill = plan.e && p.e && dist(plan.e, p.e) < 2 ? plan.stillSince : clock;
    plan = { ...p, since: clock, stillSince: p.e ? keepStill : undefined };
    best = Infinity; progressT = 0; coverTries = 0; healPressed = false; pathFor = null;
    logSeen = me.weapon.log.length; wallShots = 0;
  }
  // search: the least visited cell of the fragment (a little at random), a walkable point in it
  function searchPoint() {
    const S = BOT.searchCell, [x0, x1] = NAV.bounds.x, [z0, z1] = NAV.bounds.z;
    let pick = null, low = Infinity;
    for (let x = x0 + S / 2; x < x1; x += S) for (let z = z0 + S / 2; z < z1; z += S) {
      if (Math.hypot(x - TX, z - TZ) > ARENA_SECTION.boundary.radius) continue;   // outside the section (task 011)
      const v = (cells.get(Math.floor(x / S) + ',' + Math.floor(z / S)) ?? 0) + rand() * 2 + dist(me.feet, { x, z }) / 15;
      if (v < low) { low = v; pick = { x, z }; }
    }
    return nav.closest(pick) ?? nav.randomAround(me.feet, 8);
  }
  const inSpot = () => !!plan.spot && me.coverState.mode === 'cover' && cover.line === plan.spot.l;

  // ---- moving ----
  // the world direction to walk this frame towards goal (path corners of the navigation mesh), or null when there
  function steer(dt, goal) {
    if (!goal) return null;
    const here = me.feet;
    if (dist(here, goal) < BOT.arrive) return null;
    pathAge += dt;
    if (pathFor !== goal || pathVersion !== nav.version || pathAge > 1) {
      path = nav.path(here, goal); pathFor = goal; pathVersion = nav.version; pathAge = 0;
      if (!path.length) { fail(); return null; }
    }
    while (path.length > 1 && dist(here, path[0]) < 0.35) path.shift();
    const c = path[0], dx = c.x - here.x, dz = c.z - here.z, L = Math.hypot(dx, dz);
    return L < 1e-3 ? null : { x: dx / L, z: dz / L, left: path.reduce((s, p, i) => s + (i ? dist(p, path[i - 1]) : dist(here, p)), 0) };
  }
  // the goal cannot be reached: another goal, and this spot is not tried again for a while
  function fail() {
    if (plan.spot) banned.set(plan.spot.key, clock + 15);
    plan = { kind: plan.kind === 'search' ? 'search' : 'stuck', since: clock };
    nextDecide = clock;
    if (plan.kind === 'search') plan.goal = searchPoint();
  }
  // no progress to the goal for BOT.stuck s, or pushing without moving for BOT.stall s: the path again, then fail
  function watch(dt, wantMove) {
    const here = me.feet, moved = dist(here, lastPos);
    lastPos = { x: here.x, z: here.z };
    stall = wantMove && moved < 0.3 * dt ? stall + dt : 0;
    if (stall > BOT.stall) {
      stall = 0; pathFor = null;
      const to = nav.closest(here);
      if (to && dist(to, here) > 0.1) unstick = { to, t: BOT.unstick };
      else if (rand() < 0.5) fail();
    }
    if (!wantMove || !plan.goal) { progressT = 0; best = Infinity; return; }
    const d = dist(here, plan.goal);
    if (d < best - 0.3) { best = d; progressT = 0; } else if ((progressT += dt) > BOT.stuck) fail();
  }

  // ---- per frame ----
  // know: the senses' knowledge; clockNow: the senses' clock. Returns the intent for bot.js:
  // { move: {x, z} world direction or null, sprint, sprintClick, cover, coverTarget, aim, fight, look, medkit, dodge }
  function update(dt, know, clockNow) {
    clock = clockNow;
    const out = { move: null, sprint: false, sprintClick: false, cover: false, coverTarget: null, aim: false, fight: false, look: null, medkit: false, dodge: false };
    if (!me.alive) return out;
    const cell = Math.floor(me.feet.x / BOT.searchCell) + ',' + Math.floor(me.feet.z / BOT.searchCell);
    cells.set(cell, (cells.get(cell) ?? 0) + dt);
    // events: saw, lost, heard, hit
    if (know.sees !== last.sees || know.hurt !== last.hurt || know.heard !== last.heard) nextDecide = Math.min(nextDecide, clock);
    last = { sees: know.sees, hurt: know.hurt, heard: know.heard };
    if (fresh(know) && plan.e && dist(plan.e, know.where) > 2) { plan.e = know.where; plan.stillSince = clock; }
    if (clock >= nextDecide && !me.health.healing) decide(know);
    // SCRIBE's camp warning (the pulsing script, as the player sees it): out of the circle, unless healing
    const left = camp();
    if (left !== null && left <= SCRIBE.camp.warnLast && !me.health.healing && !plan.moveOn) {
      const at = nav.randomAround(me.feet, SCRIBE.camp.radius * 1.8);
      if (at && dist(at, me.feet) > SCRIBE.camp.radius) setPlan({ kind: 'search', goal: at, moveOn: true });
    }

    const mode = me.coverState.mode, e = fresh(know) ? know.where : null;
    out.fight = know.sees;
    out.look = e ? Math.atan2(-(e.x - me.feet.x), -(e.z - me.feet.z)) : null;

    // the medkit: once, where the plan says it is safe
    if (plan.kind === 'heal' || (plan.kind === 'retreat' && (inSpot() || !plan.goal))) {
      const safe = !know.sees && clock - know.hurt > BOT.healSafe;
      if (safe && !healPressed && !me.health.healing && me.health.medkits > 0) { out.medkit = true; healPressed = true; }
      if (healPressed && !me.health.healing) { nextDecide = clock; }
      if (plan.kind === 'heal' || inSpot()) { watch(dt, false); return aimOut(out, know, mode, dt); }
    }

    // in the chosen cover: stay (the stick at rest), peek out of the corner. Shots that hit the cover itself: the corner
    // does not work from here, another place (as a person would move)
    if (inSpot()) {
      watch(dt, false);
      const log = me.weapon.log;
      for (; logSeen < log.length; logSeen++) if (!log[logSeen].target && !log[logSeen].blind && log[logSeen].t < 0.6) wallShots++;
      if (wallShots >= 3) { wallShots = 0; fail(); return out; }
      if (plan.kind === 'attack' && !know.sees && clock - Math.max(know.when, plan.since) > 5) nextDecide = clock;
      return aimOut(out, know, mode, dt);
    }
    // on the way: to the cover with A when close, else along the path
    if (plan.spot && mode === 'free' && dist(me.feet, plan.spot.p) < 2.5 && cover.usable(plan.spot.l)) {
      if ((coverTries += dt) > 1.5) { fail(); return out; }   // 1.5 s of trying
      out.cover = true; out.coverTarget = { line: plan.spot.l.id, along: plan.spot.along };
      watch(dt, false);
      return aimOut(out, know, mode, dt);
    }
    if (mode === 'cover') { out.sprintClick = true; return out; }   // another place: out of this cover
    let dir = mode === 'free' ? steer(dt, plan.goal) : null;
    if (unstick && mode === 'free') {
      const dx = unstick.to.x - me.feet.x, dz = unstick.to.z - me.feet.z, L = Math.hypot(dx, dz);
      if ((unstick.t -= dt) <= 0 || L < 0.05) unstick = null;
      else dir = { x: dx / L, z: dz / L, left: L };
    }
    watch(dt, !!dir);
    if (!dir && plan.goal && dist(me.feet, plan.goal) < BOT.arrive) {
      if (plan.kind === 'flank') { plan.stillSince = clock; attack(plan.e ?? plan.goal); }
      else if (plan.kind === 'search' || plan.kind === 'stuck') nextDecide = clock;
    }
    if (dir) {
      out.move = dir;
      out.sprint = !know.sees && dir.left > 6 && plan.kind !== 'ambush';
      if (!out.look) out.look = Math.atan2(-dir.x, -dir.z);
      if (level.moves) vaultOrDodge(dt, out, know, dir);
    } else if (!out.look) out.look = lookAround(dt);
    return aimOut(out, know, mode, dt);
  }

  // LT: while the other is seen (at a distance), or peeking out of cover in series while it is expected.
  // Task 015: in cover, not seeing the other but knowing where it was a moment ago (seen or heard), blind fire at that
  // place in short bursts (never at a place it does not know)
  function aimOut(out, know, mode, dt) {
    const d = know.where ? dist(me.feet, know.where) : Infinity;
    const B = BOT.blind;
    blindT = blindT > 0 ? Math.max(0, blindT - dt) || -B.every : Math.min(0, blindT + dt);
    if (mode === 'cover' && level.blind && !know.sees && know.where && clock - know.when < B.window) {
      if (blindT === 0) blindT = B.burst;
      if (blindT > 0) { out.blind = true; out.blindAt = know.where; out.aim = false; if (!out.look) out.look = Math.atan2(-(know.where.x - me.feet.x), -(know.where.z - me.feet.z)); return out; }
    }
    if (mode === 'cover') {
      peek.t -= dt;
      if (know.sees) peek = { on: true, t: 1.2 };
      else if (peek.t <= 0) peek = peek.on ? { on: false, t: fresh(know) ? 1.0 : 2.5 } : { on: true, t: 1.2 };
      out.aim = peek.on;
      if (!out.look) out.look = lookAround(dt);
    } else out.aim = know.sees && d > BOT.aimFrom;
    return out;
  }
  // waiting: the view swings round its middle
  function lookAround(dt) {
    looked += dt;
    const base = plan.spot ? Math.atan2(-plan.spot.l.n.x, -plan.spot.l.n.y) + Math.PI : me.animator.bodyYaw + Math.PI;
    return base + THREE.MathUtils.degToRad(BOT.look.swing) * Math.sin(looked * Math.PI * 2 / BOT.look.period);
  }
  // the Machine: vaults a sill on its way and rolls aside when hit in the open
  function vaultOrDodge(dt, out, know, dir) {
    dodgeT -= dt;
    if (clock - know.hurt < 0.1 && dodgeT <= 0 && rand() < BOT.dodgeChance) {
      out.dodge = true; dodgeT = BOT.dodgeEvery;
      const s = rand() < 0.5 ? 1 : -1; out.move = { x: -dir.z * s, z: dir.x * s, left: dir.left };
      return;
    }
    for (const l of cover.sills) {
      const d = (me.feet.x - l.a.x) * l.n.x + (me.feet.z - l.a.y) * l.n.y;
      const along = (me.feet.x - l.a.x) * l.dir.x + (me.feet.z - l.a.y) * l.dir.y;
      if (d <= 0 || d > C.vaultReach || along < 0 || along > l.len || dir.x * l.n.x + dir.z * l.n.y > -0.5) continue;
      if (plan.goal && (plan.goal.x - l.a.x) * l.n.x + (plan.goal.z - l.a.y) * l.n.y > 0) continue;   // the goal is on this side
      out.cover = true; out.move = { x: -l.n.x, z: -l.n.y, left: dir.left }; return;
    }
  }

  return {
    update,
    reset() {
      plan = { kind: 'search' }; nextDecide = 0; path = []; pathFor = null; stall = 0; best = Infinity; progressT = 0; unstick = null;
      peek = { on: false, t: 0 }; blindT = 0; healPressed = false; banned.clear(); last = { sees: false, hurt: -Infinity, heard: -Infinity };
      lastPos = { x: me.feet.x, z: me.feet.z };
    },
    setLevel(l) { level = l; },
    get plan() { return plan; },
  };
}
