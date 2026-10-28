// Fixed hit zones (task 006, DECISIONS.md 27.09.2026): a sphere for the head and capsules for the torso and the
// legs, placed on the character's physics capsule, never on the model's bones, so every character is equally
// easy to hit. Crouched, the heights scale like the capsule (radii stay). Also health and medkits.
import * as THREE from 'three';
import { HITZONES as Z, COMBAT } from '../data/combat.js';
import { PLAYER } from '../data/arena.js';

export const ZONES = ['head', 'torso', 'legs'];

// ray (origin o, unit direction d) against a sphere (centre c, radius r): distance to the first hit or null
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  if (cc <= 0) return 0;   // starts inside
  const disc = b * b - cc;
  if (disc < 0 || b > 0) return null;
  return -b - Math.sqrt(disc);
}

// ray against an upright capsule: axis from y0 to y1 at (x, z), radius r (the caps are spheres at the ends)
const tmp = new THREE.Vector3();
function rayCapsule(o, d, x, z, y0, y1, r) {
  let best = null;
  // side: infinite cylinder, then the hit must lie between the ends
  const ox = o.x - x, oz = o.z - z, a = d.x * d.x + d.z * d.z;
  if (a > 1e-12) {
    const b = ox * d.x + oz * d.z, c = ox * ox + oz * oz - r * r, disc = b * b - a * c;
    if (disc >= 0) {
      const t = c <= 0 ? 0 : (-b - Math.sqrt(disc)) / a, y = o.y + d.y * t;
      if (t >= 0 && y >= y0 && y <= y1) best = t;
    }
  }
  for (const y of [y0, y1]) {
    const t = raySphere(o, d, tmp.set(x, y, z), r);
    if (t !== null && (best === null || t < best)) best = t;
  }
  return best;
}

// Zones of a character standing on feet (Vector3) with the capsule's current height (standing PLAYER.height).
// A capsule shorter than its own diameter (the torso when crouched) becomes a sphere at its middle.
export function zonesAt(feet, height) {
  const k = height / PLAYER.height, capsule = z => {
    const lo = feet.y + z.from * k + z.radius, hi = feet.y + z.to * k - z.radius;
    return lo <= hi ? [lo, hi] : [(lo + hi) / 2, (lo + hi) / 2];
  };
  return { feet, head: feet.y + Z.head.center * k, torso: capsule(Z.torso), legs: capsule(Z.legs) };
}

// the first zone the ray (origin o, unit direction d) meets within maxT: { t, zone } or null
export function rayZones(o, d, maxT, zones) {
  const { feet } = zones;
  let best = null;
  const take = (t, zone) => { if (t !== null && t <= maxT && (!best || t < best.t)) best = { t, zone }; };
  const tHead = raySphere(o, d, tmp.set(feet.x, zones.head, feet.z), Z.head.radius);
  take(tHead, 'head');
  take(rayCapsule(o, d, feet.x, feet.z, ...zones.torso, Z.torso.radius), 'torso');
  take(rayCapsule(o, d, feet.x, feet.z, ...zones.legs, Z.legs.radius), 'legs');
  // where zones overlap (the torso and the head when crouched), the head wins: a ray that enters the head inside
  // the zone it met first is a head shot (Paweł, 28.09.2026: OWNER_CORRECTED in audit 006, „Strzał w głowę nie
  // może być liczony jak w tułów”)
  if (best && best.zone !== 'head' && tHead !== null && tHead <= maxT) {
    const [y0, y1] = zones[best.zone], y = o.y + d.y * tHead, cy = Math.min(Math.max(y, y0), y1);
    const dx = o.x + d.x * tHead - feet.x, dz = o.z + d.z * tHead - feet.z;
    if (dx * dx + (y - cy) * (y - cy) + dz * dz <= Z[best.zone].radius ** 2) best = { t: tHead, zone: 'head' };
  }
  return best;
}

export const multiplier = zone => Z[zone].multiplier;

// Health without regeneration, and the medkits: one use heals medkitHeal over medkitTime, up to full health.
// A dodge roll interrupts the healing: the medkit is used up, only what has already come back stays.
export function createHealth() {
  let hp = COMBAT.hp, medkits = COMBAT.medkits, healing = null;

  // medkit: the Y button this frame; dodge: a roll is in progress; serverHp (task 028, a PvP window's own fighter): the
  // medkit's time runs here (its animation, the slower walk), the health it gives comes only with the server's word
  function update(dt, { medkit, dodge, serverHp = false }) {
    if (healing && dodge) healing = null;
    if (medkit && !healing && !dodge && medkits > 0 && hp < COMBAT.hp) { medkits--; healing = { t: 0, gained: 0 }; }
    if (!healing) return;
    const t = Math.min(COMBAT.medkitTime, healing.t + dt);
    const due = COMBAT.medkitHeal * t / COMBAT.medkitTime - healing.gained;
    if (!serverHp) hp = Math.min(COMBAT.hp, hp + due);
    healing.gained += due; healing.t = t;
    if (t >= COMBAT.medkitTime || hp >= COMBAT.hp) healing = null;
  }

  return {
    update,
    damage(n) { hp = Math.max(0, hp - n); },
    reset() { hp = COMBAT.hp; medkits = COMBAT.medkits; healing = null; },
    get hp() { return hp; },
    // task 028 (K3): the whole state, kept and put back (the PvP window's prediction)
    save: () => ({ hp, medkits, healing: healing && { ...healing } }),
    load(s) { hp = s.hp; medkits = s.medkits; healing = s.healing && { ...s.healing }; },
    get medkits() { return medkits; },
    get healing() { return !!healing; },
    // for the HUD (task 008): share of the medkit's time done and the HP it will reach, or null
    get heal() { return healing && { u: healing.t / COMBAT.medkitTime, to: Math.min(COMBAT.hp, hp + COMBAT.medkitHeal - healing.gained) }; },
    // ?freeze&pose=hud_heal: halfway through a medkit
    freezeHeal(share) { if (medkits > 0) medkits--; healing = { t: COMBAT.medkitTime * share, gained: 0 }; },
    freezeKits(n) { medkits = n; },
    // task 027 (K1): as the PvP server sends it, and as a window shows it
    view: () => ({ hp, medkits, healing: healing && { ...healing } }),
    show(v) { hp = v.hp; medkits = v.medkits; healing = v.healing && { ...v.healing }; },
  };
}
