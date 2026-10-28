// Task 027: the fight's engine (src/sim/engine.js) in Node, without a page: the game's own modules loaded through Vite
// (its SSR loader resolves the same imports as the page, the files' versions included), the files read from public/,
// the models without their pictures (look/loaders.js initLoadersHeadless). Used by the replays (scripts/replay.mjs) and
// the PvP server (scripts/pvp-server.mjs).
//   const sim = await loadSim();  const e = await sim.engine({ seed, weapon, looks: ['bohaterka', 'rdza'], opt });
//   (src/sim/headless.js; sim.playRecording(rec): src/sim/replay.js)
import { createServer } from 'vite';
import * as THREE from 'three';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installShims } from './node-shims.mjs';

const gameDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
installShims(THREE, path.join(gameDir, 'public'));   // (the files read from public/)

export async function loadSim() {
  const vite = await createServer({ root: gameDir, configFile: path.join(gameDir, 'vite.config.js'), logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
  const load = p => vite.ssrLoadModule(p);
  const [headless, replay] = await Promise.all([load('/src/sim/headless.js'), load('/src/sim/replay.js')]);
  return { engine: headless.headlessEngine, setWeapon: headless.setWeapon, weaponOf: headless.weaponOf, playRecording: replay.playRecording, load, close: () => vite.close() };
}
