// The bot's senses (task 009, plan/01 §6): the only place that looks at the other fighter. What the bot knows about it
// comes from here and nowhere else, and only when the senses caught it:
//   sight: a cone of BOT.fov from the eyes (the head bone) along the view, up to BOT.sight; the target is seen when a
//          line from the eyes reaches its head, torso or hips with no part of the arena in between;
//   near:  within BOT.near all round (steps), also behind the back, but not through a wall;
//   sound: every shot of the other gives its place with an error of up to BOT.hearError;
//   a hit: the direction the shot came from (as the player's HUD arc shows it).
// Checked BOT.senseHz times a second, not every frame.
import * as THREE from 'three';
import { BOT } from '../data/bot.js';

const rad = THREE.MathUtils.degToRad;

// me: the bot's fighter; other: the fighter it plays against (kept here, never handed on); ballistics: line of sight
export function createSenses({ me, other, ballistics, rand }) {
  const eyes = new THREE.Vector3(), point = new THREE.Vector3(), seenAt = new THREE.Vector3();
  let clock = 0, next = 0;
  // what the bot knows: sees (now), where (x, z: last seen, felt or heard place), aim (the point it sees now, for its
  // aim), when (the clock of that knowledge), how ('sight' | 'near' | 'sound' | 'hit'), hurt (the clock of the last hit)
  const know = { sees: false, where: null, vel: { x: 0, z: 0 }, aim: null, when: -Infinity, how: null, hurt: -Infinity, hitFrom: null, heard: -Infinity };
  const heard = [];   // shots of the other since the last check

  // the parts of the other's body the eyes try: the torso's middle (where a person aims first), the head, the hips
  // (its fixed hit zones)
  function bodyPoints() {
    const z = other.zones(), f = z.feet;
    return [[f.x, (z.torso[0] + z.torso[1]) / 2, f.z], [f.x, z.head, f.z], [f.x, z.legs[1], f.z]];
  }
  // yaw: where the bot looks (the view's yaw); true when some part is seen, and then aim holds that point
  function look(yaw) {
    const fwd = new THREE.Vector2(-Math.sin(yaw), -Math.cos(yaw)), cos = Math.cos(rad(BOT.fov / 2));
    for (const [x, y, z] of bodyPoints()) {
      point.set(x, y, z);
      const dx = x - eyes.x, dz = z - eyes.z, d = Math.hypot(dx, dz);
      if (point.distanceTo(eyes) > BOT.sight) continue;
      const inCone = d < 1e-3 || (dx * fwd.x + dz * fwd.y) / d >= cos;
      if (!inCone && d > BOT.near) continue;
      if (ballistics.clear(eyes, point)) { seenAt.copy(point); return inCone ? 'sight' : 'near'; }
    }
    return null;
  }

  // dt: frame time; yaw: the bot's view. Returns the knowledge (the same object, updated)
  function update(dt, yaw) {
    clock += dt;
    if (!me.alive) return know;
    if (clock >= next) {
      next = clock + 1 / BOT.senseHz;
      me.eyes(eyes);
      const how = other.alive ? look(yaw) : null;
      know.sees = how === 'sight' || how === 'near';
      if (know.sees) {
        // how fast the seen point moves (from two sightings in a row): the aim leads a running target a little
        const w = { x: other.feet.x, z: other.feet.z }, gap = clock - know.when;
        know.vel = know.where && know.how !== 'sound' && gap < 0.3 ? { x: (w.x - know.where.x) / gap, z: (w.z - know.where.z) / gap } : { x: 0, z: 0 };
        know.where = w; know.aim = seenAt.clone(); know.when = clock; know.how = how;
      } else know.aim = null;
      for (const s of heard) {
        if (know.sees) break;
        const r = BOT.hearError * Math.sqrt(rand()), ang = rand() * Math.PI * 2;
        know.where = { x: s.x + r * Math.cos(ang), z: s.z + r * Math.sin(ang) }; know.when = clock; know.how = 'sound'; know.heard = clock;
      }
      heard.length = 0;
    }
    return know;
  }

  return {
    update, know,
    get clock() { return clock; },
    // the trigger's check, every frame while it wants to fire: do the eyes see the other now? (yes or no, no place: a
    // person fires only at what they see, and the 10 checks a second above could be late by a moment)
    seesNow(yaw) { if (!me.alive || !other.alive) return false; me.eyes(eyes); return look(yaw) !== null; },
    // the other fired (the game passes every shot of the other fighter here)
    hear(from) { heard.push({ x: from.x, z: from.z }); },
    // the bot was hit by a shot flying along dir: it knows from where it came, not how far
    hit(dir) { know.hurt = clock; know.hitFrom = { x: -dir.x, z: -dir.z }; },
    reset() { Object.assign(know, { sees: false, where: null, vel: { x: 0, z: 0 }, aim: null, when: -Infinity, how: null, hurt: -Infinity, hitFrom: null, heard: -Infinity }); heard.length = 0; next = 0; },
  };
}
