// The bot's items (task 017): the same actions as the player (grenade, key, itemAt), the same rules; nothing beyond
// its senses (filar 2).
//   grenade: the other has kept to one place it knows (seen or heard) for BOT.items.grenadeAfter s, BOT.items.grenadeRange
//            away: thrown there (the level's chance, after its reaction);
//   flee:    a warning circle it sees (a landed grenade whose circle it can see from its eyes) with itself inside:
//            it runs out of it, as a player does;
//   key:     the way round to the other is much longer than the straight line and a tall element stands on it: the key
//            on the floor by that element.
import * as THREE from 'three';
import { BOT } from '../data/bot.js';
import { ITEMS } from '../data/items.js';
import { itemFor } from '../items/items.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// me: the bot's fighter (items, itemWorld, feet, eyes); nav; ballistics; level: LEVELS[…]
export function createItemBrain({ me, nav, ballistics, rand }) {
  const I = BOT.items;
  let press = null;        // { action, t (s held so far), at } while a button is held for a use
  let flee = null;         // { to, until }
  let decideAt = 0, stillFrom = null, stillAt = null, seenCircle = null;   // seenCircle: when it first saw the circle
  const eyes = new THREE.Vector3(), p3 = new THREE.Vector3();
  const has = action => { const k = itemFor(action); return !!k && !!me.items && me.items.left[k] > 0 && me.items.ready(k); };

  // the other's place kept for a while: since when it is within grenadeStill m of where it was first known there
  function watch(know, clock) {
    if (!know.where || clock - know.when > 2) { stillFrom = null; return; }
    if (!stillAt || dist(stillAt, know.where) > I.grenadeStill) { stillAt = { x: know.where.x, z: know.where.z }; stillFrom = clock; }
  }

  // a landed grenade's circle it sees, with itself inside: the way out (away from the grenade)
  function danger() {
    const w = me.itemWorld; if (!w) return null;
    me.eyes(eyes);
    for (const g of w.flying) {
      if (!g.landed) continue;
      const d = dist(me.feet, g.p);
      if (d > g.spec.radius + I.fleeMargin) continue;
      if (!ballistics.clear(eyes, p3.set(g.p.x, 0.1, g.p.z))) continue;
      const dx = me.feet.x - g.p.x, dz = me.feet.z - g.p.z, L = Math.hypot(dx, dz) || 1, far = g.spec.radius + I.fleeMargin + 0.5;
      return nav.closest({ x: g.p.x + dx / L * far, z: g.p.z + dz / L * far }) ?? null;
    }
    return null;
  }

  // a floor point by a tall element on the straight line to e, seen from the eyes and within the key's reach
  function keyPoint(e) {
    me.eyes(eyes);
    const d = dist(me.feet, e), K = ITEMS[itemFor('key')];
    for (let s = 3; s < Math.min(d, K.range); s += 1) {
      const x = me.feet.x + (e.x - me.feet.x) * s / d, z = me.feet.z + (e.z - me.feet.z) * s / d;
      if (!ballistics.clear(eyes, p3.set(x, 0.1, z))) continue;
      const beyond = { x: me.feet.x + (e.x - me.feet.x) * (s + 1.5) / d, z: me.feet.z + (e.z - me.feet.z) * (s + 1.5) / d };
      if (!ballistics.clear(p3.set(x, 1.2, z), new THREE.Vector3(beyond.x, 1.2, beyond.z))) return { x, y: 0.02, z };
    }
    return null;
  }

  // know: the senses; clock; level: its chances. out: the brain's intent (move, cover, aim…), completed here:
  // out.grenade / out.key (held), out.itemAt, and out.move / out.sprintClick while it runs from a circle
  function update(dt, know, clock, level, out) {
    watch(know, clock);
    // running from a circle
    // a person needs a moment to notice the circle and react (Paweł 30.09.2026: "sobowtór jest sprytny i ucieka")
    const way = danger();
    if (!way) seenCircle = null; else if (seenCircle === null) seenCircle = clock;
    if (way && clock - seenCircle >= (level.items?.flee ?? 0)) flee = { to: way, until: clock + I.fleeFor };
    if (flee && clock < flee.until && dist(me.feet, flee.to) > 0.4) {
      // along the navigation mesh's way out (a straight run would push into walls)
      const path = nav.path(me.feet, flee.to), c = path.length > 1 ? path[1] : flee.to;
      const dx = c.x - me.feet.x, dz = c.z - me.feet.z, L = Math.hypot(dx, dz) || 1;
      out.move = { x: dx / L, z: dz / L, left: L }; out.sprint = true;
      if (me.coverState.mode === 'cover') out.sprintClick = true;
      out.cover = false; press = null;
      return out;
    }
    flee = null;
    // a button held for a use: let go after holdTime
    if (press) {
      press.t += dt;
      out[press.action] = press.t < I.holdTime; out.itemAt = press.at;
      if (press.t >= I.holdTime + 0.1) press = null;
      return out;
    }
    if (clock < decideAt || !level.items) return out;
    decideAt = clock + I.every;
    const e = know.where, fresh = e && clock - know.when < 2;
    if (!fresh) return out;
    const d = dist(me.feet, e);
    // grenade: the other keeps to one place, within the range
    if (has('grenade') && stillFrom !== null && clock - stillFrom >= I.grenadeAfter && d >= I.grenadeRange[0] && d <= I.grenadeRange[1]
      && rand() < level.items.grenade) {
      press = { action: 'grenade', t: 0, at: { x: e.x, y: 0.05, z: e.z } };
      out.grenade = true; out.itemAt = press.at;
      return out;
    }
    // key: the way round is much longer than the straight line
    if (has('key') && rand() < level.items.key) {
      const path = nav.path(me.feet, e);
      const len = path.reduce((s, q, i) => s + (i ? dist(q, path[i - 1]) : 0), 0);
      if (path.length && len > d * I.keyDetour) {
        const at = keyPoint(e);
        if (at) { press = { action: 'key', t: 0, at }; out.key = true; out.itemAt = at; }
      }
    }
    return out;
  }

  return { update, reset() { press = null; flee = null; decideAt = 0; stillFrom = null; stillAt = null; seenCircle = null; }, get fleeing() { return !!flee; } };
}
