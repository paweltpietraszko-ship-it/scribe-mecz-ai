// What the game sounds like (task 010): the fighters' shots and steps and their other moments, and the arena's moves.
// Read from the game's state after each step (the weapon's log of shots, the step phase of the animation, the edges of
// reload, roll, medkit, cover and the arena's phases), so the game's code does not call the sound. Both fighters sound
// the same; the player's own sounds are not spatial (close), the other's come from its place (filar 2: the player hears
// the Double as the bot hears the player: data/sound.js STEP).
import * as THREE from 'three';
import { SOUNDS, STEP, MIX, WEAPON_SOUND } from '../data/sound.js';
import { HERO } from '../data/hero.js';
import { TURNTABLE } from '../data/arena.js';

const RUN = (HERO.walkRun.from + HERO.walkRun.to) / 2;   // m/s: faster is a run (the animation's walk/run mix)

// the gait of this step: its volume and range
function gait(f) {
  const mode = f.coverState.mode, c = f.character;
  if (mode === 'cover') return STEP.gait.cover;
  if (c.crouched) return STEP.gait.crouch;
  if (c.sprinting || mode === 'dash') return STEP.gait.sprint;
  return c.speed.length() > RUN ? STEP.gait.run : STEP.gait.walk;
}

// audio: engine.js; player, foe: the fighters; own: the player's sounds are its own (false in ?botvbot, where the
// camera only watches); wall: for the moving panel's place
export function createGameSounds({ audio, player, foe, own = true, wall }) {
  const at = new THREE.Vector3(), head = new THREE.Vector3(), near = new THREE.Vector3();

  // one fighter's sounds; mine: the player's own (not spatial)
  function track(f, mine) {
    let phase = f.animator.phase, fired = f.weapon.fired, reload = false, dodge = false, healing = false, mode = 'free', pulled = false;
    // o.own: which of MIX.own applies when it is mine; the other's sounds are spatial, at their place
    const sound = (name, where, o = {}) => audio.play(name, mine ? { ...o, own: o.own ?? 'other' } : { ...o, own: null, at: where });

    function shot(s) {
      // task 018: a shotgun's pellets are one shot: its sound once (pellet 0); the hits sound for each
      if (!s.pellet) sound(s.sound ?? WEAPON_SOUND, s.from, { own: 'shot' });   // task 016: each weapon its shot
      const point = at.copy(s.from).addScaledVector(s.dir, s.t);
      if (s.target) audio.play('trafienie_cialo', { at: point });
      else if (s.t < s.range && !(s.pellet > 0) && !s.pending) {   // (task 028: pending: the body's sound when the server confirms)   // task 018: one pellet's ricochet sound is enough
        audio.play('trafienie_kamien', { at: point });
        if (Math.random() < SOUNDS.rykoszet.chance) audio.play('rykoszet', { at: point });
      }
      // the other's shot passing close to the player's head (not the one that hit it)
      if (f !== player && player.alive && s.target !== player) {
        player.eyes(head);
        const u = THREE.MathUtils.clamp(head.clone().sub(s.from).dot(s.dir), 0, s.t);
        near.copy(s.from).addScaledVector(s.dir, u);
        if (near.distanceTo(head) < MIX.whizz) audio.play('swist_kuli', { at: near });
      }
    }

    // task 028 (K3): a PvP window's own shots hit the other only when the server says so: the body's sound then
    let confirmed = null;
    // a: this step's actions of this fighter
    return function update(a) {
      const last = f.weapon.lastHit;
      if (f.predicted && last && last !== confirmed && last.age === 0) audio.play('trafienie_cialo', { at: (f === player ? foe : player).top });
      confirmed = last;
      // steps: a foot lands when the step phase passes 0 or ½, while the walk/run clips lead the pose
      const p = f.animator.phase;
      if (f.alive && f.animator.moveWeight >= STEP.minWeight && Math.floor(p * 2) !== Math.floor(phase * 2)) {
        const g = gait(f);
        sound('krok', f.feet, { own: 'step', gain: g.volume, maxDistance: g.maxDistance });
      }
      phase = p;
      // shots: the new ones in the weapon's log
      const log = f.weapon.log, n = Math.min(f.weapon.fired - fired, log.length);
      fired = f.weapon.fired;
      for (let i = log.length - n; i < log.length; i++) shot(log[i]);
      // the other moments, at their start
      const w = f.weapon, now = { reload: !!w.reload, dodge: !!f.character.dodge, healing: f.health.healing, mode: f.coverState.mode };
      if (now.reload && !reload) sound(w.spec.reloadSound ?? 'przeladowanie', f.feet);   // task 018: the weapon's own reload
      if (a?.shoot && !pulled && f.alive && (w.reload || w.mag === 0)) sound('pusty_magazynek', f.feet);
      if (now.dodge && !dodge) sound('przewrot', f.feet);
      if (now.healing && !healing) sound('apteczka', f.feet);
      if (now.mode === 'cover' && mode === 'enter') sound('wejscie_w_oslone', f.feet);
      ({ reload, dodge, healing, mode } = now);
      pulled = !!a?.shoot;
    };
  }

  const tracks = [track(player, own), track(foe, false)];
  const movingPanel = wall.panels.find(p => p.moving).g, panelAt = new THREE.Vector3();
  const discAt = new THREE.Vector3(TURNTABLE.center[0], 1, TURNTABLE.center[1]);
  let panelKey = 'panelIdle', turnKey = 'turnIdle';
  // the distant sounds of the machine (U31): one now and then, from a random place around the player
  const D = MIX.distant, between = ([lo, hi]) => lo + Math.random() * (hi - lo), far = new THREE.Vector3();
  let nextDistant = between(D.every);

  // after each step of the game: dt; m: the arena's moves (motion.js); a, b: the player's and the foe's actions
  return function update(dt, m, a, b) {
    audio.update();
    if ((nextDistant -= dt) <= 0) {
      nextDistant = between(D.every);
      const ang = Math.random() * Math.PI * 2, r = between(D.distance);
      far.set(player.feet.x + r * Math.cos(ang), between(D.height), player.feet.z + r * Math.sin(ang));
      audio.play('odglos_z_daleka', { at: far });
    }
    tracks[0](a); tracks[1](b);
    const pk = m.panel.key, tk = m.turn.key;
    if (pk !== panelKey) {
      movingPanel.getWorldPosition(panelAt);
      if (pk === 'warning') audio.play('zapowiedz_ruchu', { at: panelAt });
      if (pk === 'panelLowering') audio.play('panel_w_dol', { at: panelAt });
      if (pk === 'panelRising') audio.play('panel_w_gore', { at: panelAt });
    }
    if (tk !== turnKey) {
      if (tk === 'warning') audio.play('zapowiedz_ruchu', { at: discAt });
      if (tk === 'turning') audio.play('obrotnica', { at: discAt });
    }
    panelKey = pk; turnKey = tk;
  };
}
