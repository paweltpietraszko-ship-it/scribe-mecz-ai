// Task 028 (K2): what goes over the network, in flat fields of fixed types: the PvP server's room state (Colyseus
// schema: binary, only what changed since the last patch, scripts/pvp-state.mjs) and a player's action (Colyseus
// input: one per step, numbered). This file is shared by the server and the window: the fields' list and types (the
// server makes its schema from them), a fighter's view (fighter.view(), as in 027) made flat and back again, the same
// for the action, the arena's moves and SCRIBE's elements. What is not here goes as events (scripts/pvp-room.mjs).
//   f32: float32, f64: float64, bool, str, u8, u16, i16, u32
// A number that may be missing is sent as −1 (none).
import { PLAYER } from '../data/arena.js';

// a fighter: the body's pose (its animation, from 027's pose record); h: the capsule's height (the hit zones: the
// server's lag compensation). Its health, weapon, cover and counters (the HUD, the sounds) in STATUS, a part of its own
// (Colyseus allows 63 fields to one schema). fighterToWire gives both in one flat object.
export const FIGHTER = {
  x: 'f32', y: 'f32', z: 'f32', h: 'f32', sx: 'f32', sz: 'f32', ix: 'f32', iz: 'f32', vy: 'f32',
  yaw: 'f32', pitch: 'f32', turn: 'f32',
  cr: 'bool', sp: 'bool', ai: 'bool', aim: 'bool', dash: 'bool', rd: 'bool', solid: 'bool', raise: 'bool', ik: 'bool',
  dgT: 'f32', dgX: 'f32', dgY: 'f32', dgCool: 'f32',
  aK: 'str', aYaw: 'f32', aSlide: 'f32', aLow: 'bool', aClip: 'str', aU: 'f32',
  pru: 'f32', prw: 'f32', rClip: 'str', rT: 'f32',
};
export const STATUS = {
  cMode: 'str', cAiming: 'bool', cShoulder: 'i16', cFire: 'bool', cvMode: 'str', cvCrouch: 'bool',
  firing: 'bool', raised: 'bool',
  hp: 'f32', med: 'u8', healT: 'f32', healG: 'f32',
  mag: 'u16', rl: 'f32', bloom: 'f32', wRaise: 'f32', blocked: 'bool', fromButt: 'bool',
  hitN: 'u16', hitZone: 'str', hitKilled: 'bool', hurtN: 'u16',
  passive: 'bool', stunT: 'f32', stunTime: 'f32', flinchT: 'f32', deadClip: 'str', deadT: 'f32',
  resets: 'u16', spX: 'f32', spZ: 'f32', spYaw: 'f32',
};

// the arena's moves (motion.js) and SCRIBE's camping clocks
export const ARENA = {
  pKey: 'str', pTension: 'f32', pFlash: 'f32', pDrop: 'f32',
  tKey: 'str', tTension: 'f32', tFlash: 'f32', tTurning: 'bool', tAngle: 'f64',
  campA: 'f32', campB: 'f32',
};

// one of SCRIBE's elements (scribe/mechanisms.js view(): its pose, phase, sink and pulse)
export const ELEMENT = { h: 'f32', rot: 'f32', slide: 'f32', ph: 'u8', drop: 'f32', k: 'u16' };

// the round (fighter/round.js view()); results, card, score: rare, as text
export const ROUND = {
  phase: 'str', left: 'f32', time: 'f32', round: 'u16', matches: 'u16', winsMe: 'u8', winsFoe: 'u8',
  winner: 'str', current: 'str', pending: 'str', results: 'str', card: 'str', score: 'str', walkover: 'bool',
};

// a player's action (fighter/actions.js) for one step. The items (frozen, data/items.js) are not sent.
export const ACT = {
  mx: 'f32', my: 'f32', yaw: 'f32', pitch: 'f32', ax: 'f32', ay: 'f32', az: 'f32', hasAim: 'bool', zone: 'str',
  cLine: 'i16', cAlong: 'f32',
  aim: 'bool', shoot: 'bool', blind: 'bool', rise: 'bool', sprint: 'bool', sprintClick: 'bool',
  crouch: 'bool', dodge: 'bool', cover: 'bool', medkit: 'bool', reload: 'bool',
};

const opt = (v, f) => (v === null || v === undefined ? -1 : f(v));
const none = v => (v < 0 ? null : v);

// ---- a fighter ----
export function fighterToWire(v, out = {}) {
  const P = v.pose, A = P?.anim, ch = v.ch, cov = A?.cover;
  out.x = ch.f[0]; out.y = ch.f[1]; out.z = ch.f[2]; out.h = ch.cr ? PLAYER.crouchHeight : PLAYER.height;
  out.sx = ch.spd[0]; out.sz = ch.spd[1]; out.ix = ch.v[0]; out.iz = ch.v[1]; out.vy = ch.vy ?? 0;
  out.yaw = A?.yaw ?? 0; out.pitch = A?.pitch ?? 0; out.turn = A?.turnDelta ?? 0;
  out.cr = ch.cr; out.sp = ch.sp; out.ai = ch.ai; out.aim = !!v.aiming; out.dash = !!A?.dash; out.rd = ch.rd; out.solid = ch.solid;
  out.raise = !!P?.raise; out.ik = !!P?.ik;
  out.dgT = opt(ch.dg, d => d.t); out.dgX = ch.dg?.dir[0] ?? 0; out.dgY = ch.dg?.dir[1] ?? 0; out.dgCool = ch.cool ?? 0;
  out.aK = cov?.kind ?? ''; out.aYaw = cov?.yaw ?? 0; out.aSlide = cov?.slide ?? 0; out.aLow = !!cov?.low; out.aClip = cov?.clip ?? ''; out.aU = cov?.u ?? 0;
  out.pru = opt(A?.reload, r => r.u); out.prw = A?.reload?.w ?? 0;
  out.rClip = A?.react?.clip ?? ''; out.rT = A?.react?.t ?? 0;
  out.cMode = v.c.mode; out.cAiming = !!v.c.aiming; out.cShoulder = v.c.shoulder ?? 0; out.cFire = !!v.c.fire;
  out.cvMode = v.cv.mode; out.cvCrouch = !!v.cv.crouch;
  out.firing = !!v.shot?.firing; out.raised = !!v.shot?.raised;
  out.hp = v.hl.hp; out.med = v.hl.medkits; out.healT = opt(v.hl.healing, h => h.t); out.healG = v.hl.healing?.gained ?? 0;
  const w = v.w;
  out.mag = w.mag; out.rl = opt(w.reload, r => r); out.bloom = w.bloom; out.wRaise = w.raise; out.blocked = !!w.blocked; out.fromButt = !!w.fromButt;
  out.passive = !!v.passive;
  out.stunT = opt(v.stun, s => s.t); out.stunTime = v.stun?.time ?? 0; out.flinchT = opt(v.flinch, f => f);
  out.deadClip = v.dead?.clip ?? ''; out.deadT = v.dead?.t ?? 0;
  out.resets = v.resets; out.spX = v.spawn.x; out.spZ = v.spawn.z; out.spYaw = v.spawn.yaw;
  return out;
}

// back to fighter.view()'s form (fighter.show() takes it). hit: { n, zone, killed } of this weapon's last confirmed hit
// (lastHit's age is the window's: it counts from when the hit came); the shots' log comes with the events
export function wireToView(o, lastHit = null) {
  const feet = [o.x, o.y, o.z], dg = o.dgT < 0 ? null : { t: o.dgT, dir: [o.dgX, o.dgY] };
  const cover = o.aK ? { kind: o.aK, yaw: o.aYaw, slide: o.aSlide, low: o.aLow, clip: o.aClip || undefined, u: o.aU } : null;
  const dead = o.deadClip ? { clip: o.deadClip, t: o.deadT } : null;
  return {
    ch: { f: feet, cr: o.cr, sp: o.sp, ai: o.ai, spd: [o.sx, o.sz], v: [o.ix, o.iz], vy: o.vy, dg, cool: o.dgCool, rd: o.rd, solid: o.solid },
    hl: { hp: o.hp, medkits: o.med, healing: o.healT < 0 ? null : { t: o.healT, gained: o.healG } },
    w: { mag: o.mag, reload: none(o.rl), bloom: o.bloom, raise: o.wRaise, blocked: o.blocked, fromButt: o.fromButt, lastHit },
    cv: { mode: o.cvMode, crouch: o.cvCrouch },
    c: { mode: o.cMode, anim: cover, aiming: o.cAiming, shoulder: o.cShoulder, fire: o.cFire, target: null },
    shot: { firing: o.firing, raised: o.raised }, aiming: o.aim, passive: o.passive,
    stun: o.stunT < 0 ? null : { t: o.stunT, time: o.stunTime }, flinch: none(o.flinchT), dead,
    pose: {
      anim: { feet, speed: [o.sx, o.sz], intent: [o.ix, o.iz], crouched: o.cr, aiming: o.aim, dash: o.dash, sprinting: o.sp,
        dodge: dg && { u: Math.min(1, dg.t / PLAYER.dodge.time), dir: dg.dir }, yaw: o.yaw, pitch: o.pitch, turnDelta: o.turn,
        frozen: false, cover, reload: o.pru < 0 ? null : { u: o.pru, w: o.prw }, react: o.rClip ? { clip: o.rClip, t: o.rT } : null, throwOver: null },
      raise: o.raise, ik: o.ik, hand: false,
    },
    resets: o.resets, spawn: { x: o.spX, z: o.spZ, yaw: o.spYaw },
  };
}

// ---- an action ----
export function actToWire(a, out = {}) {
  out.mx = a.move.x; out.my = a.move.y; out.yaw = a.yaw; out.pitch = a.pitch;
  out.hasAim = !!a.aimAt; out.ax = a.aimAt?.x ?? 0; out.ay = a.aimAt?.y ?? 0; out.az = a.aimAt?.z ?? 0; out.zone = a.aimZone ?? '';
  out.cLine = a.coverTarget ? a.coverTarget.line : -1; out.cAlong = a.coverTarget?.along ?? 0;
  for (const k of ['aim', 'shoot', 'blind', 'rise', 'sprint', 'sprintClick', 'crouch', 'dodge', 'cover', 'medkit', 'reload']) out[k] = !!a[k];
  return out;
}

// (vector: three's Vector3 class, so the aim point is one, as the fighter's code expects)
export function wireToAct(o, Vector3) {
  return {
    move: { x: o.mx, y: o.my }, yaw: o.yaw, pitch: o.pitch, aimAt: o.hasAim ? new Vector3(o.ax, o.ay, o.az) : null, aimZone: o.zone || null,
    coverTarget: o.cLine < 0 ? null : { line: o.cLine, along: o.cAlong },
    aim: o.aim, shoot: o.shoot, blind: o.blind, rise: o.rise, sprint: o.sprint, sprintClick: o.sprintClick,
    crouch: o.crouch, dodge: o.dodge, cover: o.cover, medkit: o.medkit, reload: o.reload,
    grenade: false, key: false, cancel: false, itemAt: null,
  };
}

// ---- the arena ----
export function arenaToWire(m, camp, out = {}) {
  out.pKey = m.panel.key; out.pTension = m.panel.tension; out.pFlash = m.panel.flash; out.pDrop = m.panel.drop;
  out.tKey = m.turn.key; out.tTension = m.turn.tension; out.tFlash = m.turn.flash; out.tTurning = !!m.turn.turning; out.tAngle = m.turn.angle;
  out.campA = camp[0] ?? -1; out.campB = camp[1] ?? -1;
  return out;
}
export function wireToArena(o) {
  return {
    m: { panel: { key: o.pKey, tension: o.pTension, flash: o.pFlash, drop: o.pDrop },
      turn: { key: o.tKey, tension: o.tTension, flash: o.tFlash, turning: o.tTurning, angle: o.tAngle } },
    camp: [none(o.campA), none(o.campB)],
  };
}

// ---- the round ----
export function roundToWire(r, out = {}) {
  out.phase = r.phase; out.left = r.left ?? 0; out.time = r.time; out.round = r.round; out.matches = r.matches;
  out.winsMe = r.wins.me; out.winsFoe = r.wins.foe; out.winner = r.winner ?? ''; out.current = r.current ?? ''; out.pending = r.pending ?? '';
  out.results = JSON.stringify(r.results); out.card = JSON.stringify(r.card); out.score = JSON.stringify(r.score); out.walkover = !!r.walkover;
  return out;
}
export function wireToRound(o) {
  return { phase: o.phase, left: o.left, time: o.time, round: o.round, matches: o.matches, wins: { me: o.winsMe, foe: o.winsFoe },
    results: JSON.parse(o.results || '[]'), card: JSON.parse(o.card || 'null'), winner: o.winner || null, current: o.current, pending: o.pending,
    score: JSON.parse(o.score || '{"me":0,"foe":0,"draws":0}'), walkover: !!o.walkover };
}
