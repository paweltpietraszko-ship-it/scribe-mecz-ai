// Task 028 (K3): the PvP window's own fighter, predicted. Each step the window sends its action (Colyseus input, one a
// step, numbered) and at once plays that step on its own fighter (engine.stepOne: the move, the cover, the dodge, the
// view's turn, the recoil, the shot's flash, tracer and sound): nothing waits for the server. The server stays the
// judge: its state says where the fighter really is after the last action it took (its acknowledgement). Colyseus's
// rollback (predict.sim: @colyseus/sdk) keeps the actions not acknowledged yet, and on each acknowledgement:
//   adopt: the window's own record of that step (fighter.save(), kept for every step) compared with the server's; the
//          same: the prediction stands (the latest step's record back, the replay skipped); different: that step's
//          record with the server's facts over it (where, health, magazine, cover, death), and the actions since
//          then played again (quiet: not seen or heard again)
//   pose:  the feet's place: a correction is not a jump on the screen, it fades (PVP.smoothMs); above PVP.snap metres it
//          is a jump (a new round's start)
// Hits, damage, health, death and the round are the server's (combat/weapon.js: me.predicted): the hit marker and the
// body's sound come with its word (confirm()).
import * as THREE from 'three';
import { Predict } from '@colyseus/sdk';
import { PVP } from '../data/match.js';
import { actToWire, wireToAct } from './wire.js';

// how close the window's step must be to the server's to stand (m; the server sends float32)
const EPS = 0.01;

// engine: sim/engine.js (the window's); room: the Colyseus room; mine: 0 | 1, this window's fighter in the room's state;
// turn(): the disc's turn since the own fighter's last step (the arena as this window shows it); lag(): ms the other
// is drawn back from the server's now (net/other.js)
export function createOwn({ engine, room, mine, turn, lag }) {
  const f = engine.player;
  const input = room.input({ mode: 'reliable' });
  const predict = Predict.get(room);
  const records = new Map();   // seq → fighter.save() after that step
  let before = null, resets = -1, shot = null, skip = false, skipped = 0, replayed = 0, corrections = [];
  let last = { recoil: { pitch: 0, yaw: 0 }, moved: { firing: false } };

  // the server's facts on the own fighter over the window's record (wire.js FIGHTER + STATUS)
  const truth = () => { const fs = room.state.fighters[mine]; return fs && { ...fs.toJSON(), ...fs.st.toJSON() }; };
  // the first fact of the server's that the window's record of the same step does not have (null: none)
  function differs(rec, t) {
    const ch = rec.character, f0 = rec.f;
    if (Math.abs(ch.feet.x - t.x) > EPS || Math.abs(ch.feet.y - t.y) > EPS || Math.abs(ch.feet.z - t.z) > EPS) return 'place';
    if (ch.crouched !== t.cr) return 'crouch';
    if (!!ch.dodge !== t.dgT >= 0) return 'dodge';
    if (rec.cover.state.mode !== t.cvMode) return 'cover';
    if (Math.abs(rec.health.hp - t.hp) > 1e-3 || rec.health.medkits !== t.med) return 'health';
    if (rec.weapon.mag !== t.mag) return 'magazine';
    if (!!f0.dead !== !!t.deadClip || !!f0.stun !== t.stunT >= 0 || !!f0.flinch !== t.flinchT >= 0) return 'reaction';
    return null;
  }
  const why = {};   // (K3's report: what the server's word changed, how often)
  function overlay(t) {
    // where and how it moves
    const ch = f.character.save();
    ch.feet.set(t.x, t.y, t.z); ch.vel.set(t.ix, t.iz); ch.vy = t.vy; ch.crouched = t.cr; ch.sprinting = t.sp; ch.aiming = t.ai;
    ch.riding = t.rd; ch.solid = t.solid; ch.cooldown = t.dgCool;
    ch.dodge = t.dgT < 0 ? null : { t: t.dgT, dir: new THREE.Vector2(t.dgX, t.dgY) };
    f.character.load(ch);
    // the cover's whole state as the server has it (only this window gets it: Status.cov)
    if (t.cov) f.cover.fromWire(t.cov);
    const h = f.health.save(); h.hp = t.hp; h.medkits = t.med; h.healing = t.healT < 0 ? null : { t: t.healT, gained: t.healG }; f.health.load(h);
    const w = f.weapon.save(); w.mag = t.mag; w.reload = t.rl < 0 ? null : { t: t.rl }; w.bloom = t.bloom; w.raise = t.wRaise; f.weapon.load(w);
    const s = f.save();
    s.f.dead = t.deadClip ? { clip: t.deadClip, t: t.deadT } : null;
    s.f.stun = t.stunT < 0 ? null : { t: t.stunT, time: t.stunTime };
    s.f.flinch = t.flinchT < 0 ? null : { t: t.flinchT };
    f.load(s);
  }

  const me = predict.sim({
    input,
    world: { f },
    smoothMs: PVP.smoothMs,
    snap: PVP.snap,
    // the action as the server gets it (the wire's float32), live and replayed alike
    step(ctx, w, cmd) {
      if (ctx.isReplay && skip) return;
      const r = engine.stepOne(f, ctx.dt, wireToAct(cmd, THREE.Vector3), { quiet: ctx.isReplay, turn: ctx.memo('turn', turn) ?? 0 });
      records.set(ctx.tick, f.save());
      if (ctx.isReplay) replayed++; else last = r;
    },
    adopt() {
      const acked = input.lastProcessed, rec = records.get(acked), t = truth();
      for (const k of records.keys()) if (k < acked) records.delete(k);
      skip = false;
      if (!t) return;
      // a new round's start (the server put both at their spawns): the window's fighter there too
      if (t.resets !== resets) {
        resets = t.resets;
        f.reset({ x: t.spX, z: t.spZ, yaw: t.spYaw }); overlay(t); records.clear();
        engine.physics.refresh();
        return;
      }
      // the prediction stands: the fighter stays at its latest step, nothing played again
      before = f.feet.clone();
      const d = rec ? differs(rec, t) : 'unknown';
      if (!d) { skip = true; skipped++; return; }
      why[d] = (why[d] ?? 0) + 1;
      if (rec) f.load(rec);
      overlay(t);
      engine.physics.refresh();   // (the capsule where the fighter is now: Rapier moves it at a step)
    },
    pose: () => ({ x: f.feet.x, y: f.feet.y, z: f.feet.z }),
    // K3's report: how far the server's word moved the fighter's latest step (the replay's end against the step before)
    onReconcile() { if (before && !skip) corrections.push(before.distanceTo(f.feet)); before = null; },
  });
  // K5: each action carries the moment this window showed the other at (Colyseus: renderTime = the action's time −
  // renderDelay − ping/2): the server judges the shot there. The smoothing buffer and the rewind are one number: the
  // other's lag as drawn now (net/other.js), not a constant beside it
  input.bindRenderDelay(() => Math.max(0, lag() - (room.clock.smoothedRtt?.() ?? 0) / 2));

  return {
    // one step: the action sent and played at once (K3); returns { recoil, moved } of the step
    send(a) {
      actToWire(a, input.data);
      input.send();
      return last;
    },
    // every drawn frame: the server's acknowledgements (adopt, replay) and the corrections' fading
    tick(now) { predict.tick(now); },
    // the hit marker: the server's word on the own shots (wire.js STATUS hitN)
    confirmHits() {
      const fs = room.state.fighters[mine];
      if (!fs) return;
      if (shot === null) { shot = fs.st.hitN; return; }
      if (fs.st.hitN !== shot) { shot = fs.st.hitN; f.weapon.confirm({ zone: fs.st.hitZone, killed: fs.st.hitKilled }); }
    },
    // where to draw the feet: the prediction between its last two steps, with the correction fading
    drawAt: v => v.set(me.value('x'), me.value('y'), me.value('z')),
    // K3's report: corrections (m) and how the acknowledgements went
    get stats() { return { corrections, skipped, replayed, why, pending: input.sentCount - input.lastProcessed, rtt: room.clock.smoothedRtt?.() ?? 0 }; },
    dispose() { me.dispose?.(); records.clear(); },
  };
}
