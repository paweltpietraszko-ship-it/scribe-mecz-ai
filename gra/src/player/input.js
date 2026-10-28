// Pad (Gamepad API, standard Xbox mapping) and keyboard + mouse, turned into actions
// according to INPUT in the data file. Read once per frame with poll().
import { INPUT } from '../data/arena.js';
import { myPad } from './pad.js';

const P = INPUT.pad, K = INPUT.keys;

// Radial dead zone, rescaled so that movement starts smoothly at its edge
function stick(x, y) {
  const m = Math.hypot(x, y);
  if (m < P.deadzone) return { x: 0, y: 0 };
  const k = Math.min(1, (m - P.deadzone) / (1 - P.deadzone)) / m;
  return { x: x * k, y: y * k };
}

export function createInput(dom) {
  const keys = new Set();
  const pressed = new Set();         // key codes pressed since the last poll
  let mouseDX = 0, mouseDY = 0;
  const mouse = new Set();
  let enabled = false;

  addEventListener('keydown', e => {
    if (!enabled) return;
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
    if (e.code === K.dodge || e.code.startsWith('Arrow')) e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); mouse.clear(); });
  dom.addEventListener('mousedown', e => { if (enabled) mouse.add(e.button); });
  addEventListener('mouseup', e => mouse.delete(e.button));
  dom.addEventListener('contextmenu', e => { if (enabled) e.preventDefault(); });
  addEventListener('mousemove', e => {
    if (enabled && document.pointerLockElement === dom) { mouseDX += e.movementX; mouseDY += e.movementY; }
  });

  // pad state kept between frames: button edges and the B double-tap / hold logic
  let prevButtons = [];
  let lastBPress = -Infinity, bDownAt = null, bHoldUsed = false;
  let sprintOn = false;

  function padState(now) {
    const pad = myPad();   // (task 027: ?pad=N, player/pad.js)
    if (!pad) { prevButtons = []; bDownAt = null; sprintOn = false; return null; }
    const val = i => pad.buttons[i]?.value ?? 0;
    const down = i => (pad.buttons[i]?.pressed ?? false) || val(i) > P.triggerThreshold;
    const edge = i => down(i) && !prevButtons[i];
    const out = {
      id: pad.id,
      move: stick(pad.axes[P.move[0]] ?? 0, pad.axes[P.move[1]] ?? 0),
      look: stick(pad.axes[P.look[0]] ?? 0, pad.axes[P.look[1]] ?? 0),
      aim: down(P.aim), shoot: down(P.shoot), sprint: false,
      medkit: edge(P.medkit), reload: edge(P.reload), menu: edge(P.menu), dodge: false, crouch: false,
      cover: edge(P.cover), sprintClick: edge(P.sprintToggle),
      shoulder: edge(P.shoulder) && Math.hypot(pad.axes[P.look[0]] ?? 0, pad.axes[P.look[1]] ?? 0) < P.shoulderStill,
      grenade: down(P.grenade), key: down(P.key), cancel: edge(P.dodgeCrouch),   // task 017
    };
    // B: two presses within dodgeDoubleTap = dodge; held for crouchHold = crouch on/off
    if (edge(P.dodgeCrouch)) {
      if (now - lastBPress <= P.dodgeDoubleTap) { out.dodge = true; lastBPress = -Infinity; bHoldUsed = true; }
      else { lastBPress = now; bHoldUsed = false; }
      bDownAt = now;
    }
    if (down(P.dodgeCrouch)) {
      if (!bHoldUsed && bDownAt !== null && now - bDownAt >= P.crouchHold) { out.crouch = true; bHoldUsed = true; lastBPress = -Infinity; }
    } else bDownAt = null;
    // sprint: switched on by a click of the left stick, off when the stick is let go, on aim or crouch
    if (edge(P.sprintToggle)) sprintOn = true;
    if (Math.hypot(out.move.x, out.move.y) === 0 || out.aim || out.crouch) sprintOn = false;
    out.sprint = sprintOn;
    prevButtons = pad.buttons.map((_, i) => down(i));
    return out;
  }

  // now: time in seconds. Returns this frame's actions.
  function poll(now) {
    const has = c => (Array.isArray(c) ? c.some(k => keys.has(k)) : keys.has(c));
    const hit = c => pressed.has(c);
    const kx = (has(K.right) ? 1 : 0) - (has(K.left) ? 1 : 0), ky = (has(K.forward) ? 1 : 0) - (has(K.back) ? 1 : 0);
    const kl = Math.hypot(kx, ky) || 1;
    const pad = enabled ? padState(now) : null;
    const a = {
      // move: x to the right, y forward, length ≤ 1
      move: { x: kx / kl, y: ky / kl },
      look: { x: 0, y: 0 },              // pad right stick, −1..1
      mouse: { x: mouseDX, y: mouseDY }, // pixels since the last poll
      aim: mouse.has(K.mouseAim), shoot: mouse.has(K.mouseShoot), sprint: has(K.sprint),
      dodge: hit(K.dodge), crouch: hit(K.crouch), menu: hit(K.menu), medkit: hit(K.medkit), reload: hit(K.reload),
      cover: hit(K.cover), shoulder: hit(K.shoulder), sprintClick: K.sprint.some(hit),
      grenade: has(K.grenade), key: has(K.key), cancel: hit(K.cancel),
      padId: pad?.id ?? null,
    };
    if (pad) {
      if (Math.hypot(pad.move.x, pad.move.y) > 0) a.move = { x: pad.move.x, y: -pad.move.y };
      a.look = { x: pad.look.x, y: pad.look.y };
      a.aim ||= pad.aim; a.shoot ||= pad.shoot; a.sprint ||= pad.sprint;
      a.dodge ||= pad.dodge; a.crouch ||= pad.crouch; a.menu ||= pad.menu; a.medkit ||= pad.medkit; a.reload ||= pad.reload;
      a.cover ||= pad.cover; a.shoulder ||= pad.shoulder; a.sprintClick ||= pad.sprintClick;
      a.grenade ||= pad.grenade; a.key ||= pad.key; a.cancel ||= pad.cancel;
    }
    pressed.clear(); mouseDX = 0; mouseDY = 0;
    return a;
  }

  return {
    poll,
    // a shot ends the pad's sprint (task 006); it starts again with the next click of the left stick
    cancelSprint() { sprintOn = false; },
    // after the pause closes (task 008, audit): whatever is held now does nothing until it is let go, and the B
    // gestures start afresh (no crouch from holding it, no dodge from the next press); keys pressed so far are dropped
    swallow() {
      const pad = myPad();
      prevButtons = pad ? pad.buttons.map((b, i) => b.pressed || (b.value ?? 0) > P.triggerThreshold) : [];
      lastBPress = -Infinity; bDownAt = null; bHoldUsed = true;
      pressed.clear(); mouseDX = 0; mouseDY = 0;
    },
    setEnabled(v) { enabled = v; if (!v) { keys.clear(); mouse.clear(); pressed.clear(); } },
  };
}
