// The bot's aim, "human" (task 009, point 8): the view turns at most `turn` °/s; the first shot comes `reaction` s after
// the target was seen; the aim is off by an error that shrinks while the bot keeps the target (to BOT.aim.settle of
// aimError after BOT.aim.hold s) and is drawn again every BOT.aim.errorEvery s; it fires in series with pauses. The
// rifle's spread and recoil work on the bot as on the player (the recoil lifts its view; it turns back at its pace).
// Task 014: the aim also trembles more the longer a series lasts (LEVELS[…].sway), as a person's hand.
import * as THREE from 'three';
import { BOT } from '../data/bot.js';
import { TPP } from '../data/arena.js';

const rad = THREE.MathUtils.degToRad;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// level: LEVELS[…]; yaw: the view's yaw at the start
export function createAim(level, yaw = 0, rand) {
  const between = ([lo, hi]) => lo + rand() * (hi - lo);   // (task 027: from the match's seed)
  const A = BOT.aim;
  let view = { yaw, pitch: 0 };
  let held = 0, lost = Infinity, errT = 0, err = { yaw: 0, pitch: 0 }, errTo = { yaw: 0, pitch: 0 };
  let burst = 0, pause = 0, kick = { yaw: 0, pitch: 0 };   // kick: the recoil not yet pulled back down
  // task 014 (point 3): the trembling of a long series (LEVELS[…].sway): s of fire so far, the current wobble
  let firing = 0, swayT = 0, sway = { yaw: 0, pitch: 0 }, swayTo = { yaw: 0, pitch: 0 };
  const dir = new THREE.Vector3();

  // towards the angles (yaw, pitch) at the level's turning speed, both together. Task 014 (filar 2): never faster than
  // the player's pad at full stick (TPP.padYaw, TPP.padPitch), each axis on its own: the bot cannot follow a target a
  // person could not follow
  function turnTo(want, dt) {
    const dy = wrap(want.yaw - view.yaw), dp = want.pitch - view.pitch, d = Math.hypot(dy, dp), step = rad(level.turn) * dt;
    const k = d <= step ? 1 : step / d;
    const maxY = rad(TPP.padYaw) * dt, maxP = rad(TPP.padPitch) * dt;
    view.yaw = wrap(view.yaw + THREE.MathUtils.clamp(dy * k, -maxY, maxY));
    view.pitch = THREE.MathUtils.clamp(view.pitch + THREE.MathUtils.clamp(dp * k, -maxP, maxP), rad(TPP.pitchMin), rad(TPP.pitchMax));
  }
  const anglesTo = (from, to) => {
    dir.subVectors(to, from);
    return { yaw: Math.atan2(-dir.x, -dir.z), pitch: Math.atan2(dir.y, Math.hypot(dir.x, dir.z)) };
  };

  // eyes: where the bot looks from; target: the point to hit (Vector3), or null; look: the yaw to look along without a
  // target. Returns { yaw, pitch, fire }: fire = the trigger is pulled this frame
  function update(dt, r) {
    // the recoil comes back down only at the level's pace, as a person's thumb on the stick
    const k = Math.hypot(kick.yaw, kick.pitch), step = rad(level.pull ?? 0) * dt;
    if (k > 0) { const f = Math.max(0, k - step) / k; kick.yaw *= f; kick.pitch *= f; }
    const v = aimAt(dt, r);
    return { ...v, yaw: wrap(v.yaw + kick.yaw), pitch: THREE.MathUtils.clamp(v.pitch + kick.pitch, rad(TPP.pitchMin), rad(TPP.pitchMax)) };
  }
  function aimAt(dt, { eyes, target, look }) {
    if (!target) {
      held = 0; lost += dt; burst = pause = 0;
      turnTo({ yaw: look ?? view.yaw, pitch: 0 }, dt);
      return { yaw: view.yaw, pitch: view.pitch, fire: false };
    }
    if (lost > 0.5) held = 0;   // seen again after a while: the reaction starts afresh
    lost = 0; held += dt;
    const want = anglesTo(eyes, target);
    // the error: drawn again every errorEvery s, followed smoothly; it shrinks while the target is kept
    errT -= dt;
    if (errT <= 0) {
      errT = A.errorEvery;
      // task 032: a level may shrink its error slower or faster than the default (LEVELS[…].settle, hold)
      const settle = level.settle ?? A.settle, hold = level.hold ?? A.hold;
      const size = rad(level.aimError) * (settle + (1 - settle) * Math.max(0, 1 - held / hold)), ang = rand() * Math.PI * 2;
      errTo = { yaw: size * Math.cos(ang), pitch: size * Math.sin(ang) };
    }
    const k = Math.min(1, dt / A.errorEvery);
    err.yaw += (errTo.yaw - err.yaw) * k; err.pitch += (errTo.pitch - err.pitch) * k;
    // the series' trembling: grows with the time of fire, a new direction every swayEvery s, followed smoothly
    const S = level.sway;
    if (S) {
      swayT -= dt;
      if (swayT <= 0) {
        swayT = A.swayEvery;
        const size = rad(Math.min(S.max, S.grow * firing)), ang = rand() * Math.PI * 2;
        swayTo = { yaw: size * Math.cos(ang), pitch: size * Math.sin(ang) };
      }
      const ks = Math.min(1, dt / A.swayEvery);
      sway.yaw += (swayTo.yaw - sway.yaw) * ks; sway.pitch += (swayTo.pitch - sway.pitch) * ks;
    }
    turnTo({ yaw: want.yaw + err.yaw + sway.yaw, pitch: want.pitch + err.pitch + sway.pitch }, dt);
    // fire when the reaction time is over and the view is close to where the bot means to aim; in series
    const off = Math.hypot(wrap(want.yaw - view.yaw - kick.yaw), want.pitch - view.pitch - kick.pitch);
    let fire = false;
    if (held >= level.reaction && off <= rad(A.fireWithin)) {
      if (burst > 0) { burst -= dt; fire = true; if (burst <= 0) pause = between(A.pause); }
      else if (pause > 0) pause -= dt;
      else { burst = between(A.burst); fire = true; }
    }
    firing = fire ? firing + dt : Math.max(0, firing - 2 * dt);
    return { yaw: view.yaw, pitch: view.pitch, fire };
  }

  return {
    update,
    // the rifle's recoil lifts the view (radians)
    recoil(r) { kick.yaw += r.yaw; kick.pitch += r.pitch; },
    reset(y) {
      view = { yaw: y, pitch: 0 }; kick = { yaw: 0, pitch: 0 }; held = 0; lost = Infinity; burst = pause = 0; err = { yaw: 0, pitch: 0 }; errT = 0;
      firing = 0; swayT = 0; sway = { yaw: 0, pitch: 0 }; swayTo = { yaw: 0, pitch: 0 };
    },
    setLevel(l) { level = l; },
    get view() { return { yaw: wrap(view.yaw + kick.yaw), pitch: view.pitch + kick.pitch }; },
    get held() { return held; },
  };
}
