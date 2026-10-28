// Task 027 (K4, U36): everything random in the fight comes from the match's one seed (START_HERE.md §5, point 3; a
// server gives it in PvP, the page draws it against the bot: fighter/match.js). Each user of chance (each fighter's
// weapon, SCRIBE, each bot) has a stream of its own, made from the seed and the user's name: a new draw in one place
// does not shift the numbers of another. reseed(seed): a new match, every stream from its start.
import { RNG } from '../look/script.js';

// the seed and the name mixed into a stream's own seed (FNV-1a over the name, from the seed)
function mix(seed, name) {
  let h = (seed ^ 0x811c9dc5) >>> 0;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619) >>> 0;
  return h || 1;
}

export function createRandom(seed) {
  const gens = new Map();   // name → the stream's generator for the current seed
  let current = seed >>> 0;
  return {
    get seed() { return current; },
    // a stream: a function giving numbers in [0, 1), always from the current seed
    stream(name) {
      if (!gens.has(name)) gens.set(name, RNG(mix(current, name)));
      return () => gens.get(name)();
    },
    reseed(s) {
      current = s >>> 0;
      for (const name of gens.keys()) gens.set(name, RNG(mix(current, name)));
    },
  };
}
