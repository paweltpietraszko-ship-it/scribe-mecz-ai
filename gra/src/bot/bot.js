// The bot (task 009): drives a fighter with the same actions as the player's pad (fighter/actions.js, U29). Every frame:
// the senses (what it knows about the other), the decisions (where to go, what to press), the aim (where it looks, when
// it fires). The Dummy level does nothing but stand facing the player's spawn point.
import * as THREE from 'three';
import { LEVELS, BOT } from '../data/bot.js';
import { idleAction } from '../fighter/actions.js';
import { createSenses } from './senses.js';
import { createAim } from './aim.js';
import { createBrain } from './brain.js';
import { createItemBrain } from './items-brain.js';

const BLIND_AT = 1.25;   // blind fire's aim: chest high over the known place (task 015)

// me: the bot's fighter; other: the fighter it plays against (only its senses see it); nav: bot/nav.js
// camp: SCRIBE's camp warning for this fighter (task 012; brain.js)
// rand: the bot's stream of chance from the match's seed (task 027, sim/random.js)
export function createBot({ me, other, ballistics, nav, level: key, camp, rand }) {
  let level = LEVELS[key];
  const senses = createSenses({ me, other, ballistics, rand });
  const aim = createAim(level, me.spawn.yaw, rand);
  const brain = createBrain({ me, nav, ballistics, level, camp, rand });
  const itemBrain = createItemBrain({ me, nav, ballistics, rand });   // task 017
  const eyes = new THREE.Vector3(), target = new THREE.Vector3(), look = new THREE.Vector3();
  let a = idleAction(me.spawn.yaw);

  let held = null;   // ?freeze&pose=foe_*: a fixed action for the screenshot
  let semiT = 0;     // task 016: a 'semi' weapon is pressed once per shot, as the player does (the next press after this)
  function think(dt) {
    if (held) { a = Object.assign(idleAction(), held); return a; }
    if (level.passive || !me.alive) {
      a = idleAction(level.passive ? me.spawn.yaw : aim.view.yaw, level.passive ? 0 : aim.view.pitch);
      return a;
    }
    const know = senses.update(dt, aim.view.yaw);
    const intent = itemBrain.update(dt, know, senses.clock, level, brain.update(dt, know, senses.clock));
    me.eyes(eyes);
    // the point it saw, carried on by the speed it saw it move since then
    const seen = intent.fight && know.aim;
    // task 014 (Paweł's combat log 01.10.2026: up close the bot hit with nearly every shot while a person could not keep
    // up with a target running past): it aims where the other was `lag` s ago, as a person's hand follows the eye
    if (seen) { const late = senses.clock - know.when - (level.lag ?? 0); target.copy(know.aim); target.x += know.vel.x * late; target.z += know.vel.z * late; }
    const v = aim.update(dt, { eyes, target: seen ? target : null, look: intent.look });
    a = idleAction(v.yaw, v.pitch);
    if (intent.move) {
      // the world direction relative to the view (as the pad's stick relative to the camera)
      const f = { x: -Math.sin(v.yaw), z: -Math.cos(v.yaw) }, r = { x: Math.cos(v.yaw), z: -Math.sin(v.yaw) };
      a.move = { x: intent.move.x * r.x + intent.move.z * r.z, y: intent.move.x * f.x + intent.move.z * f.z };
    }
    // a 'semi' weapon: RT down for one frame, then up until the weapon may fire again (and a little reaction)
    let pull = v.fire || !!intent.blind;
    // task 018: a short-range weapon is not fired from afar (it comes closer instead)
    const reach = BOT.fireRange[me.weapon.spec.key];
    if (reach && know.where && Math.hypot(know.where.x - me.feet.x, know.where.z - me.feet.z) > reach) pull = false;
    if (me.weapon.spec.mode === 'semi') {
      semiT -= dt;
      if (pull && semiT <= 0) semiT = 60 / me.weapon.spec.rpm + BOT.semiGap; else pull = false;
    }
    Object.assign(a, { aim: intent.aim, shoot: pull, blind: !!intent.blind, sprint: intent.sprint, sprintClick: intent.sprintClick,
      cover: intent.cover, coverTarget: intent.coverTarget, medkit: intent.medkit, dodge: intent.dodge,
      rise: !!intent.aim && me.cover.mode === 'cover' && !!me.cover.line?.crouch,
      grenade: !!intent.grenade, key: !!intent.key, itemAt: intent.itemAt ?? null });
    // the aim point: along its view from its eyes, as the player's crosshair along the camera; blind fire (task 015): the
    // place it knows the other was at, chest high
    look.set(-Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), -Math.cos(v.yaw) * Math.cos(v.pitch));
    a.aimAt = intent.blind ? new THREE.Vector3(intent.blindAt.x, BLIND_AT, intent.blindAt.z) : ballistics.trace(eyes, look, me.weapon.spec.range, me).point;
    return a;
  }

  return {
    think,
    get action() { return a; },
    // outside the Play view: the fighter rests (the view stays where it was)
    rest() { if (held) return think(0); a = idleAction(level.passive ? me.spawn.yaw : aim.view.yaw, level.passive ? 0 : aim.view.pitch); return a; },
    recoil: r => aim.recoil(r),
    // RT at the moment of the shot: only while the eyes see the target (fighter.act asks, after the moves and the pose)
    trigger: () => senses.seesNow(a.yaw),
    hear: from => senses.hear(from),       // a shot of the other
    hurt: dir => senses.hit(dir),          // it was hit
    reset() { semiT = 0; senses.reset(); brain.reset(); itemBrain.reset(); aim.reset(me.spawn.yaw); },
    setLevel(k) { level = LEVELS[k]; aim.setLevel(level); brain.setLevel(level); },
    get level() { return level; },
    hold(patch) { held = patch; },
    get plan() { return brain.plan; },
    get know() { return senses.know; },
  };
}
