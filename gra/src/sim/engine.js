// Task 027 (K1, K2): the fight without drawing. One engine for the game against the bot (in the page) and for PvP (on
// the server, in Node): the physics, the navigation, both fighters, the bots, SCRIBE, the items and the rounds of the
// match. No window, no page, no input and no camera here: a fighter is driven by actions (fighter/actions.js), given
// by the caller (the player's pad, a remote player, a recording) or made by a bot inside. The pictures and the sounds
// only listen: `effects` and `audio` are the page's (or a recorder, or nothing). step(dt) is one fixed step (1/60 s:
// sim/clock.js); the page draws between the steps.
import { PLAYER, MATCH_SPAWN } from '../data/arena.js';
import { createPhysics } from '../player/physics.js';
import { createNav } from '../bot/nav.js';
import { createBallistics } from '../combat/ballistics.js';
import { createFighter } from '../fighter/fighter.js';
import { createRound } from '../fighter/round.js';
import { createBot } from '../bot/bot.js';
import { createMachine } from '../scribe/machine.js';
import { createItemWorld } from '../items/world.js';
import { idleAction } from '../fighter/actions.js';
import { createRandom } from './random.js';
import { stateHash } from './hash.js';
import { recorder } from './mirror.js';
import { combatLog } from '../combat/log.js';

// a recording's fingerprint every TRAIL steps (1 s): a replay that differs says from when
export const TRAIL = 60;
// (task 028: the moving panel's state before the arena's first step)
const PANEL_IDLE = { key: 'panelIdle', tension: 0, flash: 0, drop: 0 };

// a stand-in that takes any call and does nothing (no pictures, no sound: the server, the replays)
export const nothing = new Proxy({}, { get: (_, k) => (k === 'then' ? undefined : () => nothing) });

// scene: the meshes' world (the page's scene, or one never drawn); arena: sim/arena.js; assets: the heroine's model
// and clips (player/hero.js); rifleModel: the match's weapon (combat/weapon.js loadRifle); match: fighter/match.js (its
// seed and weapon); effects, audio: the pictures and the sounds (or `nothing`); opt: { level (the bot's), levelA (the
// second bot's: two bots, ?botvbot), bots: false (nobody inside drives: PvP, a replay), auto, autoAgain, frozen, scribe:
// true | false | null (the page's choice), names: [a, b], round: { prepare, ready, onReset } (fighter/round.js),
// onHurtA(h) (the player was hit: the HUD's arc), onShot(shot, side): every shot (its start: shot.from) }
export async function createEngine({ scene, arena, assets, rifleModel, match, effects = nothing, audio = nothing, opt = {} }) {
  const { wall, turntable, elements, boundary, motion, standing } = arena;
  // opt.capture (the PvP server): what the pictures and the sounds would be told is kept as the step's events for the
  // windows (sim/mirror.js), with the round's events, the hits, SCRIBE's signals and the combat log
  const events = [];
  // task 029: on the server each match has a combat log of its own (combat/log.js), its step runs with it
  const log = opt.capture ? combatLog.scope() : null, inLog = fn => (log ? combatLog.within(log, fn) : fn());
  if (opt.capture) { effects = recorder('fx', events); audio = recorder('audio', events); inLog(() => combatLog.listen(e => events.push(['log', null, [e]]))); }
  const frozen = !!opt.frozen;
  const physics = arena.physics = await createPhysics({ panels: wall.panels.map(p => p.g), movingPanel: wall.panels.find(p => p.moving).g, elements, boundary });
  const nav = await createNav({ wall, elements, boundary });
  const ballistics = createBallistics(physics);
  const rng = createRandom(match.seed);   // K4: every chance from the match's seed (a new match: reseed)

  // the fighters: A (the player, or a second bot) and B (the Double); each one's shots are heard by the other's bot,
  // each hit tells the one hit where it came from
  let botA = null, botB = null, machine = null;
  const [nameA, nameB] = opt.names ?? ['player', 'bot'];
  const common = { scene, physics, assets, rifleTemplate: rifleModel, effects, ballistics, wall, elements, nav };
  // task 028: on the PvP server each fighter's pictures are told apart (a window shows its own shots itself)
  const fxOf = side => (opt.capture ? recorder('fx', events, side) : effects);
  const A = createFighter({ ...common, effects: fxOf('a'), name: nameA, spawn: PLAYER.spawn, rand: rng.stream('weapon:a'),
    onShot: s => { botB?.hear(s.from); opt.onShot?.(s, 0); }, onHurt: h => { botA?.hurt(h.dir); opt.onHurtA?.(h); hurt('a', h); } });
  const B = createFighter({ ...common, effects: fxOf('b'), name: nameB, spawn: MATCH_SPAWN.foe, rand: rng.stream('weapon:b'),
    onShot: s => { botA?.hear(s.from); opt.onShot?.(s, 1); }, onHurt: h => { botB?.hurt(h.dir); hurt('b', h); } });
  const camp = k => () => machine?.campLeft(k) ?? null;
  function hurt(side, h) { if (opt.capture) events.push(['hurt', side, [{ v3: [h.dir.x, h.dir.y, h.dir.z] }]]); }
  if (opt.bots !== false) {
    botB = createBot({ me: B, other: A, ballistics, nav, level: opt.level ?? 'normal', camp: camp(1), rand: rng.stream('bot:b') });
    if (opt.levelA) botA = createBot({ me: A, other: B, ballistics, nav, level: opt.levelA, camp: camp(0), rand: rng.stream('bot:a') });
  }
  standing.push(A, B);
  // SCRIBE (task 012): the elements' mechanisms and the machine's rules
  machine = createMachine({ groups: elements, physics, nav, ballistics, motion, audio, fighters: standing, frozen, turntable,
    rand: rng.stream('scribe'), on: opt.scribe ?? null });
  const items = await createItemWorld({ scene, physics, ballistics, fighters: [A, B], machine, audio });
  A.setItemWorld(items); B.setItemWorld(items);

  const hooks = opt.round ?? {};
  const round = inLog(() => createRound({ player: A, foe: B, bot: botB ?? { setLevel() {}, reset() {} }, level: opt.level, auto: !!opt.auto, autoAgain: !!opt.autoAgain,
    prepare: hooks.prepare ?? (() => null), ready: hooks.ready ?? (() => null),
    onReset: yaw => { hooks.onReset?.(yaw); botA?.reset(); machine.reset(); items.reset(); effects.clearMarks(); } }));
  if (opt.capture) {
    machine.listen((kind, at) => events.push(['sig', kind, [at && { v3: [at.x, at.y, at.z] }]]));
    round.on((kind, data) => events.push(['round', kind, [data]]));
  }
  // a new match (or the training level's round): every stream of chance from its seed (fighter/match.js)
  round.on(kind => { if (kind === 'matchStart' || kind === 'range') rng.reseed(match.seed); });

  let time = 0, lastAngle = 0, steps = 0, rec = null, lastM = null, recoils = [null, null];
  // K8: a recording of a match (from its start: the arena's clock then, every step's actions of both sides and the
  // triggers' answers, the state's fingerprint after every round); scripts/replay.mjs plays it again
  const pack = a => JSON.parse(JSON.stringify(a));
  round.on(kind => {
    if (rec && kind === 'roundEnd') rec.hashes.push(stateHash({ fighters: [A, B], round, machine }));
    if (rec && kind === 'matchEnd') { rec.result = { wins: { ...round.wins }, final: null }; rec.ending = true; }
  });
  // opt.record: the first match is recorded from the first step (the welcome screen may move the arena before it);
  // opt.recordMeta(): what the replay needs besides (the looks worn, the level, the names)
  let armed = !!opt.record, recorded = null;
  // one step. o: { a: side A's action (null: its bot drives, or it rests), input({ turnDelta }): side A's action made
  // inside the step, once the disc has turned (the player's pad), b: side B's (null: its bot), driveA: a bot
  // for side A from outside (the performance test), ta, tb: the triggers' last word at the moment of a shot (a replay;
  // else the bots' eyes), active (the controls are on), round (another clock of rounds: the performance test), acts
  // (the fighters act: in a round), pose, rollPose (?freeze screenshots), moved(r), aim() (after the physics: the
  // player's aim point into o.a), recoil(r) (the player's view),
  // task 028 (the PvP server): skip: { a, b } (true: that side's action has not come yet: its fighter stands this step
  // and rides the disc's turn later), seen: { a, b } (the lag compensation while that side's shots are judged:
  // combat/ballistics.js setSeen) }
  const owed = { a: 0, b: 0 };   // the disc's turn a fighter that stood out of steps has yet to ride
  function step(dt, o = {}) {
    if (armed) { armed = false; startRecording(opt.recordMeta?.() ?? {}); }
    const fdt = frozen ? 0 : dt, rounds = o.round ?? round;
    // every object's world matrix from its true place first: the fight reads them (the muzzle, the moving panel, the
    // elements), and the page's drawing leaves them as drawn (between two steps, or not at all for several steps), so
    // without this a step would depend on how the page drew
    scene.updateMatrixWorld();
    if (!frozen) time += dt;
    const m = motion.update(fdt);
    wall.update(m.panel, frozen ? 0 : time); turntable.update(m.turn, frozen ? 0 : time);
    physics.syncMovingPanel();
    const turnDelta = m.turn.angle - lastAngle; lastAngle = m.turn.angle;
    physics.setTurnAngle(m.turn.angle);
    nav.update(dt, m);
    machine.update(fdt, rounds);

    const driveA = o.driveA ?? botA, acts = o.acts ?? (rounds.fighting);
    const active = !!o.active || !!driveA;
    const ctx = { active, frozen, turnDelta, panel: m.panel, turnAngle: m.turn.angle - turnDelta };
    const a = o.a ?? o.input?.({ turnDelta }) ?? (driveA ? (acts ? driveA.think(dt) : driveA.rest()) : idleAction(A.spawn.yaw));
    const b = o.b ?? (botB ? (active && acts ? botB.think(dt) : botB.rest()) : idleAction(B.spawn.yaw));
    const skip = o.skip ?? {}, ctxOf = k => {
      if (skip[k]) { owed[k] += turnDelta; return null; }
      const d = turnDelta + owed[k]; owed[k] = 0;
      return d === turnDelta ? ctx : { ...ctx, turnDelta: d, turnAngle: m.turn.angle - d };
    };
    const ca = ctxOf('a'), cb = ctxOf('b');
    if (ca) { const r0 = A.move(dt, a, ca); o.moved?.(r0); }
    if (cb) B.move(dt, b, cb);
    physics.step(dt);
    o.aim?.();
    const trig = { a: o.ta ?? driveA?.trigger, b: o.tb ?? botB?.trigger };
    const said = { a: null, b: null };   // the triggers' answers (a recording keeps them)
    const ask = k => trig[k] && (() => (said[k] = trig[k]()));
    const still = { pitch: 0, yaw: 0 };
    ballistics.setSeen(o.seen?.a ?? null);
    const r = ca ? A.act(dt, a, { ...ca, pose: o.pose, rollPose: o.rollPose, trigger: ask('a') }) : still;
    if (o.recoil) o.recoil(r); else driveA?.recoil(r);
    ballistics.setSeen(o.seen?.b ?? null);
    const rb = cb ? B.act(dt, b, { ...cb, trigger: ask('b') }) : still;
    ballistics.setSeen(null);
    botB?.recoil(rb);
    recoils = [r, rb];
    items.update(fdt);
    if (!o.round) round.update(fdt);
    steps++; lastM = m;
    if (rec) {
      rec.steps.push([pack(a), pack(b), said.a, said.b]);
      const n = rec.steps.length, w = opt.recordDetail;   // w: [from, to] steps recorded in detail (every step)
      if (w && n >= w[0] && n <= w[1]) { const d = []; stateHash({ fighters: [A, B], round, machine }, d); (rec.window ??= {})[n] = d; }
      if (rec.steps.length % TRAIL === 0) { const d = null; rec.trail.push(stateHash({ fighters: [A, B], round, machine }, d)); }
      if (rec.steps.length === 1) stateHash({ fighters: [A, B], round, machine }, rec.detail = []);   // (after its first step)
      if (rec.ending) { rec.result.final = stateHash({ fighters: [A, B], round, machine }); delete rec.ending; recorded = rec; rec = null; }
    }
    return { m, a, b, said };
  }

  function startRecording(meta) {
    rec = { seed: match.seed, weapon: match.weapon, ...meta, start: { motion: motion.save(), lastAngle }, steps: [], hashes: [], trail: [], before: [] };
    stateHash({ fighters: [A, B], round, machine }, rec.before);   // (the state it starts from)
  }

  // the PvP server: this step's state and events (task 028: scripts/pvp-room.mjs puts them in the room's state; a
  // window shows them: net/other.js)
  const sideOf = f => (f === A ? 'a' : 'b');
  // (SCRIBE's elements only when they changed: most steps they stand; null: as in the last view)
  let lastSc = '';
  function view() {
    const sc = machine.view(), key = JSON.stringify(sc), changed = key !== lastSc; lastSc = key;
    return { s: steps, m: lastM, sc: changed ? sc : null, f: [A.view(sideOf), B.view(sideOf)], r: round.view(), k: recoils, ev: events.splice(0) };
  }
  // a PvP window: the arena's moves and SCRIBE's elements as the server's step had them
  function showArena(dt, m, sc) {
    scene.updateMatrixWorld();
    time += dt; lastM = m; lastAngle = m.turn.angle;
    wall.update(m.panel, time); turntable.update(m.turn, time);
    physics.syncMovingPanel(); physics.setTurnAngle(m.turn.angle);
    if (sc) machine.show(sc);
    steps++;
  }

  // task 028: one more step of one fighter alone, the arena and the other standing as they are: a PvP window's own
  // fighter predicted (K3: quiet, a replayed step: nothing seen or heard; turn: the disc's turn since its last step),
  // and the PvP server catching up with a player whose actions came in a bunch (seen: the lag compensation, K5)
  function stepOne(f, dt, a, { quiet = false, turn = 0, seen = null, active = true } = {}) {
    scene.updateMatrixWorld();
    const ctx = { active, frozen: false, turnDelta: turn, panel: lastM ? lastM.panel : PANEL_IDLE, turnAngle: lastAngle - turn };
    const moved = f.move(dt, a, ctx);
    physics.step(dt);
    ballistics.setSeen(seen);
    const recoil = f.act(dt, a, { ...ctx, quiet });
    ballistics.setSeen(null);
    return { recoil, moved };
  }

  return {
    // task 029: the PvP server's room ended: the physics' and the navigation's WebAssembly memory given back
    dispose() { nav.dispose(); physics.dispose(); },
    scene, arena, view, showArena, stepOne: (...x) => inLog(() => stepOne(...x)),
    get lastM() { return lastM; }, physics, nav, ballistics, machine, items, round, rng, match, motion,
    fighters: [A, B], player: A, foe: B,
    get botA() { return botA; }, get botB() { return botB; },
    step: (...x) => inLog(() => step(...x)),
    // K8: the arena's clock and the disc's turn (a replay starts from them)
    snapshot: () => ({ motion: motion.save(), lastAngle }),
    // (no extra step of the physics here: the recording's run took none; the next step sets the disc as usual)
    restore(st) { motion.load(st.motion); lastAngle = st.lastAngle; },
    get recording() { return recorded; },   // the finished recording (opt.record), or null
    get recordingNow() { return rec; },     // (the one under way)
    // the arena's own clock (the panels' tremor: pictures only); setTime: it goes on from the welcome screen's
    get time() { return time; },
    setTime(t) { time = t; },
    get steps() { return steps; },
    get turnAngle() { return lastAngle; },
    // K8: the state's fingerprint (the fighters, the round, the arena's moving parts): the same steps give the same
    hash: detail => stateHash({ fighters: [A, B], round, machine }, detail),
  };
}
