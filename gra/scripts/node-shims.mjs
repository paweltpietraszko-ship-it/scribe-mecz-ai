// Task 027 (moved here in task 029): what three's loaders expect of a page, for the fight's engine in Node: `self`
// (GLTFLoader's object URLs), ProgressEvent (FileLoader), and their relative addresses read from a folder on the disk
// (the game's public/ on the laptop; on Railway the built game's dist/: the PvP server is one file, scripts/pvp-main.mjs).
// THREE: the three.js the engine uses (its loading manager takes the addresses).
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const LOCAL = 'http://local/';

export function installShims(THREE, folder) {
  globalThis.self ??= globalThis;
  globalThis.ProgressEvent ??= class extends Event { constructor(t, o = {}) { super(t); Object.assign(this, o); } };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => {
    const url = typeof u === 'string' ? u : u.url;
    if (!url.startsWith(LOCAL)) return realFetch(u, o);
    return new Response(await readFile(path.join(folder, decodeURIComponent(new URL(url).pathname))));
  };
  THREE.DefaultLoadingManager.setURLModifier(u => (/^(blob:|data:|https?:)/.test(u) ? u : LOCAL + u));
}
