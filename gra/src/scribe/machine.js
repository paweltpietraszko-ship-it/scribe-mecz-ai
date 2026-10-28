// SCRIBE put together for the game (task 012): the elements' mechanisms, the machine's rules and its switch (part C).
// The switch: SCRIBE.enabled, remembered in the browser from the pause, and ?scribe=off / ?scribe=on in the address
// (it wins). SCRIBE runs in the rounds against the Double (not on the Dummy level, the shooting range, and not in
// ?freeze screenshots); the elements finish a move they started in any case.
import { SCRIBE as S } from '../data/scribe.js';
import { LEVELS } from '../data/bot.js';
import { createMechanisms } from './mechanisms.js';
import { createScribe } from './scribe.js';

const KEY = 'theone.scribe';
function initial() {
  if (typeof location === 'undefined') return S.enabled;   // (task 027: no page: the server, the replays)
  const q = new URLSearchParams(location.search).get('scribe');
  if (q === 'off' || q === 'on') return q === 'on';
  try { const v = localStorage.getItem(KEY); if (v === 'off' || v === 'on') return v === 'on'; } catch { /* storage blocked */ }
  return S.enabled;
}

// groups: the arena's elements; physics, nav, ballistics, motion: as in main.js; audio: the sound engine;
// fighters: [player, foe]; frozen: ?freeze. Task 027: rand: SCRIBE's stream of chance from the match's seed; on: the
// switch given by the match (PvP: the server's), instead of the page's choice
export function createMachine({ groups, physics, nav, ballistics, motion, audio, fighters, frozen, turntable, rand, on: given = null }) {
  const mech = createMechanisms({ groups, physics, nav, turntable, sound: (name, at) => audio.play(name, { at }) });
  nav.settle();
  const listeners = [];   // task 013: SCRIBE's public events (the LED screen's alarm)
  const scribe = createScribe({ mech, fighters, ballistics, motion, rand, signal: (kind, at) => listeners.forEach(fn => fn(kind, at)) });
  let on = (given ?? initial()) && !frozen, lastTurn = physics.turnAngle;
  let shownCamp = null;   // task 027: the camp warnings from the PvP server (null: this machine's own)
  scribe.setEnabled(on);
  if (frozen) motion.setAuto(false);

  return {
    mech, scribe,
    // one step; round: fighter/round.js (its clock and level)
    update(dt, round) {
      if (frozen) return;
      mech.update(dt, fighters);
      // colliders moved this frame (the disc turned, an element moves): the physics' queries up to date first
      if (physics.turnAngle !== lastTurn || mech.moving) { lastTurn = physics.turnAngle; physics.refresh(); }
      // switched on or off (the pause, the level): the arena back in place at once; between rounds nothing new starts
      const running = on && !LEVELS[round.level].passive;
      if (running !== scribe.enabled) scribe.setEnabled(running);
      if (running && round.over === null) scribe.update(dt, round.time);
    },
    reset: () => scribe.reset(),
    get on() { return on; },
    // the pause's switch: remembered in the browser
    setOn(v) {
      on = v;
      try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch { /* storage blocked */ }
    },
    campLeft: k => (shownCamp ? shownCamp[k] : scribe.campLeft(k)),
    // task 017: the machine's key; null while SCRIBE does not run (the key does nothing then)
    key: (at, K) => (scribe.enabled ? scribe.key(at, K) : null),
    get keyReady() { return scribe.enabled; },
    listen: fn => listeners.push(fn),
    // task 027 (K1): as the PvP server sends it (the elements, the camp warnings of both sides) and a window shows it;
    // signal: the server's public event (the LED screen's alarm) to this page's listeners
    view: () => ({ els: mech.view(), camp: [scribe.campLeft(0), scribe.campLeft(1)] }),
    show(v) { mech.show(v.els); shownCamp = v.camp; },
    signal: (kind, at) => listeners.forEach(fn => fn(kind, at)),
  };
}
