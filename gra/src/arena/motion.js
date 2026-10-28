// Movements of the machine: every move starts with a 1.2 s warning.
// For now they run by themselves on a timer, as in the reference (Puppet Monster logic is task 005).
import * as THREE from 'three';
import { MOTION } from '../data/arena.js';

export const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// A cycle is a list of [phaseKey, duration]; phase 0 is always the warning.
function cycle(firstAfter, every, phases) {
  return { active: null, next: firstAfter, every, phases };
}

// hold(i, x): true = stay where you are this frame (the move waits)
function step(o, dt, auto, hold) {
  let key = null, x = 0, i = -1;
  if (auto && !o.active) { o.next -= dt; if (o.next <= 0) { o.start(); o.next = o.every; } }
  if (o.active) {
    const [k, dur] = o.phases[o.active.i];
    if (hold && hold(o.active.i, Math.min(1, (o.active.t + dt) / dur))) { o.active.held = true; return { key: o.waitKey, x: o.active.t / dur, i: o.active.i, held: true }; }
    o.active.held = false;
    o.active.t += dt; x = Math.min(1, o.active.t / dur); key = k; i = o.active.i;
    if (o.active.t >= dur) { o.active.i++; o.active.t = 0; if (o.active.i >= o.phases.length) o.active = null; }
  }
  return { key, x, i };
}

// warning flicker: builds up and pulses three times
const WF = MOTION.warnFlash;
const warnFlash = x => WF.ramp * x + WF.pulse * Math.max(0, Math.sin(x * Math.PI * 2 * WF.pulses));

// "Lift doors": canTurnTo(angle) is false when an arm at that angle would enter the character;
// canRaisePanel() is false while the character stands where the lowered panel comes back up
export function createMotion({ canTurnTo, canRaisePanel } = {}) {
  const M = MOTION, PM = M.panel, TM = M.turn;
  let auto = M.auto;

  const panel = cycle(PM.firstAfter, PM.every, [['warning', M.warning], ['panelLowering', PM.lower], ['panelDown', PM.down], ['panelRising', PM.raise]]);
  panel.start = () => { if (!panel.active) panel.active = { i: 0, t: 0 }; };
  panel.waitKey = 'panelWaiting';

  let angle = 0, from = 0, dir = 1;
  const turn = cycle(TM.firstAfter, TM.every, [['warning', M.warning], ['turning', TM.duration]]);
  // the automatic turn: TM.degrees, back and forth; SCRIBE's (task 012): `degrees` either way, at TM.speed °/s
  let span = 0;
  turn.start = degrees => {
    if (turn.active) return;
    turn.active = { i: 0, t: 0 }; from = angle;
    span = THREE.MathUtils.degToRad(degrees ?? dir * TM.degrees);
    turn.phases[1][1] = degrees === undefined ? TM.duration : Math.abs(degrees) / TM.speed;
  };
  turn.waitKey = 'turnWaiting';

  let lastDrop = 0;   // the panel's drop at the last update (settle() goes up from there)
  function update(dt) {
    const p = step(panel, dt, auto, i => i === 3 && canRaisePanel && !canRaisePanel());
    const ps = { key: p.key || 'panelIdle', tension: 0, flash: 0, drop: 0 };
    if (p.i === 0) { ps.tension = p.x; ps.flash = warnFlash(p.x); }
    else if (p.i === 1) { ps.drop = ease(p.x); ps.flash = M.moveFlash.panel * (1 - p.x); }
    else if (p.i === 2) { ps.drop = 1; }
    else if (p.i === 3) { ps.drop = 1 - ease(p.x); }
    lastDrop = ps.drop;

    const turnAt = x => from + span * ease(x);
    const s = step(turn, dt, auto, (i, x) => i === 1 && canTurnTo && !canTurnTo(turnAt(x)));
    const ts = { key: s.key || 'turnIdle', tension: 0, flash: 0, turning: s.i === 1, angle };
    if (s.i === 0) { ts.tension = s.x; ts.flash = warnFlash(s.x); }
    else if (s.i === 1 && !s.held) {
      angle = turnAt(s.x); ts.flash = M.moveFlash.turn * (1 - s.x);
      if (s.x >= 1) dir *= -1;
    }
    ts.angle = angle;
    return { panel: ps, turn: ts };
  }

  return {
    update,
    lowerPanel: () => panel.start(),
    turnNow: degrees => turn.start(degrees),
    get auto() { return auto; },
    // task 027 (K8): the clock's whole state (a recorded match starts from it: the arena moved behind the welcome screen)
    save: () => JSON.parse(JSON.stringify({ auto, angle, from, dir, span, lastDrop, panel: { active: panel.active, next: panel.next },
      turn: { active: turn.active, next: turn.next, dur: turn.phases[1][1] } })),
    load(st) {
      ({ auto, angle, from, dir, span, lastDrop } = st);
      panel.active = st.panel.active && { ...st.panel.active }; panel.next = st.panel.next;
      turn.active = st.turn.active && { ...st.turn.active }; turn.next = st.turn.next; turn.phases[1][1] = st.turn.dur;
    },
    setAuto(v) { auto = v; panel.next = panel.every; turn.next = turn.every; },
    // task 012 (audit): quiet now. The disc stops where it is (it may rest at any angle) and an announced turn is called
    // off; an announced panel move is called off, a lowered or lowering panel comes back up by its own rising move from
    // where it is (smoothly, and still waiting for a character standing where it rises)
    settle() {
      turn.active = null;
      if (!panel.active) return;
      if (panel.active.i === 0 || lastDrop <= 0) { panel.active = null; return; }
      if (panel.active.i === 3) return;   // already rising
      let lo = 0, hi = 1;                 // the rising phase's x at which 1 - ease(x) = lastDrop
      for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (1 - ease(mid) > lastDrop) lo = mid; else hi = mid; }
      panel.active = { i: 3, t: lo * PM.raise };
    },
  };
}
