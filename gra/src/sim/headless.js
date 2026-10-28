// Task 027: the fight's engine made without a picture: in Node (scripts/sim-node.mjs: the server, the replays) and in a
// page that draws nothing (replay.html: the replays in the browser). The models come without their textures
// (look/loaders.js initLoadersHeadless); the arena's meshes stand in a scene never drawn.
import * as THREE from 'three';
import { initLoadersHeadless } from '../look/loaders.js';
import { loadHeroAssets, loadLook, wearLook } from '../player/hero.js';
import { loadRifle } from '../combat/weapon.js';
import { CHARACTERS, OPPONENT } from '../data/hero.js';
import { createMatch } from '../fighter/match.js';
import { buildArena } from './arena.js';
import { createEngine } from './engine.js';

let assets = null;
const looks = new Map(), rifles = new Map();
const look = key => { if (!looks.has(key)) looks.set(key, loadLook(CHARACTERS[key]?.file ?? 'bohaterka.glb')); return looks.get(key); };

// an engine for one match: seed; weapon (null: the seed's); looks: [A's, B's] (data/hero.js CHARACTERS keys: the bodies
// take their proportions, as in the page, so the muzzle is where the page has it); opt: as createEngine's
export async function headlessEngine({ seed, weapon = null, looks: [la, lb] = ['bohaterka', OPPONENT.key], opt = {} }) {
  if (!assets) { initLoadersHeadless(); assets = loadHeroAssets(); }
  const match = createMatch(new URLSearchParams(weapon ? { seed: String(seed), weapon } : { seed: String(seed) }));
  if (!rifles.has(match.weapon)) rifles.set(match.weapon, loadRifle(match.weapon));
  const scene = new THREE.Scene();
  const arena = buildArena(scene);
  const [hero, rifleModel, ma, mb] = await Promise.all([assets, rifles.get(match.weapon), look(la), look(lb)]);
  const e = await createEngine({ scene, arena, assets: hero, rifleModel, match, opt });
  wearLook(e.player.body, ma); wearLook(e.foe.body, mb);
  return e;
}

// another weapon for both fighters of an engine (a new PvP match: the server)
export async function setWeapon(e, key) {
  if (!rifles.has(key)) rifles.set(key, loadRifle(key));
  const model = await rifles.get(key);
  e.player.setWeapon(model); e.foe.setWeapon(model);
  e.match.use(key);
}
// the weapon a seed gives (fighter/match.js: the same draw as the engine's)
export const weaponOf = seed => createMatch(new URLSearchParams({ seed: String(seed) })).weapon;
