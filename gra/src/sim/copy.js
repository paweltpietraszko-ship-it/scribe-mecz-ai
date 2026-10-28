// Task 028 (K3): a copy of a part of the fight's state, to put it back later (the PvP window's own fighter, at each
// step it predicted: when the server's answer differs, the window goes back to that step and plays its actions again).
// Plain objects and arrays are copied all the way down, three's vectors and quaternions are cloned; anything else
// (a collider, a function, a class's object) is the same thing in the copy: it is the arena's, not the state's.
// keep: plain objects that are the arena's too (a cover's lines: compared by who they are), kept as they are.
export function copyState(v, keep = null) {
  if (v === null || typeof v !== 'object') return v;
  if (keep?.has(v)) return v;
  if (Array.isArray(v)) return v.map(x => copyState(x, keep));
  if (v.isVector2 || v.isVector3 || v.isQuaternion) return v.clone();
  if (Object.getPrototypeOf(v) !== Object.prototype) return v;
  const out = {};
  for (const k in v) out[k] = copyState(v[k], keep);
  return out;
}
