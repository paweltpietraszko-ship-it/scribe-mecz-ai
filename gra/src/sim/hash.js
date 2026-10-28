// Task 027 (K8): a fingerprint of the fight's state, exact to the last bit of every number (FNV-1a over the numbers'
// 64-bit form): two runs that took the same steps from the same seed give the same fingerprint, in the page and in
// Node. It covers what the match's result and its pictures come from: both fighters (feet, health, medkits, magazine,
// shots fired, alive, the body's turn), the round (its phase, time, wins) and the arena's moving parts (SCRIBE's
// elements, the turntable).
const f64 = new Float64Array(1), bytes = new Uint8Array(f64.buffer);

// detail: an array that gets every number and text hashed, in order (to see where two runs part)
export function stateHash({ fighters, round, machine }, detail = null) {
  let h = 0x811c9dc5;
  const num = v => { detail?.push(+v || 0); f64[0] = +v || 0; for (let i = 0; i < 8; i++) h = Math.imul(h ^ bytes[i], 16777619) >>> 0; };
  const str = s => { detail?.push(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; };
  for (const f of fighters) {
    num(f.feet.x); num(f.feet.y); num(f.feet.z); num(f.hp); num(f.health.medkits); num(f.weapon.mag); num(f.weapon.fired);
    num(f.alive ? 1 : 0); num(f.animator.bodyYaw);
    const r = f.rifle.root.position; num(r.x); num(r.y); num(r.z); num(f.weapon.spread(false)); str(f.coverState.mode); num(f.character.height);
  }
  str(round.phase); num(round.time); num(round.wins.me); num(round.wins.foe); num(round.results.length);
  for (const e of machine.mech.els) { num(e.pose.h); num(e.pose.rot); num(e.pose.slide); }
  return h.toString(16).padStart(8, '0');
}
