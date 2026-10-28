// The match (task 016): its seed and what is drawn from it for both fighters (START_HERE.md §5, point 3: one seed, the
// same for both sides; a PvP server will give the seed, today the page draws it once). The weapon of the match: drawn
// from WEAPON_POOL, the same for both (DECISIONS.md 25.09.2026), once a match (task 022: not once a round).
// params: the page's URL parameters. ?seed=N fixes the seed; ?weapon=karabin|smg|dmr fixes the weapon (tests, and the
// pause's choice on the training level); ?freeze (screenshots) keeps the rifle, so the pictures compare.
// next() (task 022, "Again"): a new match, its seed drawn from the one before (so ?seed=N gives the same series of
// matches), and its weapon drawn from it unless ?weapon fixes it.
import { RNG } from '../look/script.js';
import { WEAPONS, WEAPON_POOL } from '../data/combat.js';

export function createMatch(params) {
  const asked = params.get('weapon');
  const m = { seed: 0, weapon: null, rng: null };
  function draw(seed) {
    m.seed = seed; m.rng = RNG(seed);
    const drawn = WEAPON_POOL[Math.floor(m.rng() * WEAPON_POOL.length)];
    m.weapon = WEAPONS[asked] ? asked : params.has('freeze') ? 'karabin' : drawn;
  }
  draw(params.has('seed') ? (+params.get('seed') >>> 0) : crypto.getRandomValues(new Uint32Array(1))[0]);
  m.next = () => { draw(Math.floor(m.rng() * 2 ** 32) >>> 0); return m; };
  // the training level's choice in the pause (no match: the weapon is the player's)
  m.use = key => { m.weapon = key; };
  return m;
}
