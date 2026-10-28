// One fighter's items (task 017): how many are left, the one held (its preview), its use. Driven only by the actions
// (fighter/actions.js: grenade and key held, cancel, itemAt), the same for the player and the bot. The button held
// shows the preview, letting go uses the item, cancel (B) drops the preview until the button is let go.
// A throw: the fighter leans out of cover as for aiming while it holds the grenade, then throws (ITEMS.*.time: no
// shooting or aiming); the grenade leaves the hand at the clip's release (world.throwIt). The key: at once.
import * as THREE from 'three';
import { ITEMS } from '../data/items.js';

const ACTIONS = ['grenade', 'key'];

// the item a button uses: the first enabled entry for that action (data/items.js)
export const itemFor = action => Object.entries(ITEMS).find(([, s]) => s.enabled && s.action === action)?.[0] ?? null;

// me: the fighter (feet, eyes, alive); ballistics: the arena's lines of sight; the world (items/world.js) comes with
// setWorld once it is loaded
export function createItems({ me, ballistics }) {
  let world = null;
  const left = {};
  const prev = { grenade: false, key: false }, dropped = { grenade: false, key: false };
  let held = null, use = null;   // held: an item's key; use: { key, spec, t, to, thrown }
  const eyes = new THREE.Vector3();

  function reset() {
    Object.entries(ITEMS).forEach(([k, s]) => { left[k] = s.enabled ? s.count : 0; });
    held = null; use = null;
  }
  reset();

  // where a throw leaves the hand: the body's frame along the view's yaw
  function throwFrom(spec, yaw, out = new THREE.Vector3()) {
    const F = spec.from, fx = -Math.sin(yaw), fz = -Math.cos(yaw), lx = -Math.cos(yaw), lz = Math.sin(yaw);   // forward, left
    return out.set(me.feet.x + fx * F.forward + lx * F.left, me.feet.y + F.up, me.feet.z + fz * F.forward + lz * F.left);
  }
  // the target of the item held: the aim point pulled back to its range; the key's point must be floor seen from the eyes
  function targetOf(spec, a) {
    if (!a.itemAt) return null;
    const p = new THREE.Vector3(a.itemAt.x, a.itemAt.y, a.itemAt.z);
    if (spec.kind === 'throw') {
      const from = throwFrom(spec, a.yaw), d = Math.hypot(p.x - from.x, p.z - from.z);
      if (d > spec.range) { p.x = from.x + (p.x - from.x) * spec.range / d; p.z = from.z + (p.z - from.z) * spec.range / d; p.y = 0; }
      return { to: p, from, ok: true };
    }
    me.eyes(eyes);
    // the crosshair on an element (not the floor): the floor at its foot, a little towards the eyes
    if (p.y >= 0.15) {
      const dx = p.x - eyes.x, dz = p.z - eyes.z, L = Math.hypot(dx, dz) || 1;
      p.set(p.x - dx / L * spec.marker.back, 0.02, p.z - dz / L * spec.marker.back);
    }
    const d = p.distanceTo(eyes);
    return { to: p, ok: d <= spec.range && ballistics.clear(eyes, new THREE.Vector3(p.x, p.y + 0.1, p.z)) };
  }

  // a: this frame's actions; canUse: alive, in play, not rolling. Returns { holding (spec key | null), preview
  // ({ spec, from, to, ok } | null), lean (the item's held.lean: lean out as for aiming), blocks (the action fields its
// data turns off now: held.blocks or using.blocks), busy (in use),
  // throwU (share of the throw clip's slice, or null), inHand (the grenade is still in the hand) }
  function update(dt, a, canUse) {
    let preview = null;
    for (const action of ACTIONS) {
      const k = itemFor(action), down = !!a[action];
      if (!down) dropped[action] = false;
      if (k && down && !prev[action] && !held && !use && canUse && left[k] > 0 && ready(k)) held = k;
      if (k && held === k && !ready(k)) held = null;
      if (k && held === k && a.cancel) { held = null; dropped[action] = true; }
      if (k && held === k && !down && prev[action]) {
        held = null;
        const spec = ITEMS[k], tg = targetOf(spec, a);
        if (tg?.ok && canUse && world) {
          use = { key: k, spec, t: 0, to: tg.to, thrown: false, yaw: a.yaw };
          if (spec.kind === 'key') { if (world.key(spec, tg.to, me)) left[k]--; }
        }
      }
      prev[action] = down;
    }
    if (held && !canUse) held = null;
    if (held) { const spec = ITEMS[held], tg = targetOf(spec, a); preview = tg && { spec, from: tg.from, to: tg.to, ok: tg.ok }; }
    let throwU = null, inHand = false;
    if (use) {
      use.t += dt;
      if (use.spec.kind === 'throw') {
        const C = use.spec.clip, u = Math.min(1, use.t / use.spec.time);
        throwU = u; inHand = !use.thrown;
        if (!use.thrown && u >= C.release) {
          use.thrown = true; left[use.key]--;
          world.throwIt(use.spec, throwFrom(use.spec, use.yaw), use.to, me);
        }
      }
      if (use.t >= use.spec.time || !canUse) use = null;
    }
    // what the item blocks, from its data (audit 017): while held, while used
    const H = held ? ITEMS[held].held : null;
    const lean = !!H?.lean, blocks = use ? use.spec.using?.blocks ?? [] : H?.blocks ?? [];
    return { holding: held, preview, lean, blocks, busy: !!use, throwU, inHand };
  }

  // usable now: the world is loaded, and the key only while SCRIBE runs
  const ready = k => !!world && (ITEMS[k].kind !== 'key' || world.keyReady);

  return {
    update, reset, ready,
    setWorld(w) { world = w; },
    get left() { return left; },
    get holding() { return held; },
  };
}
