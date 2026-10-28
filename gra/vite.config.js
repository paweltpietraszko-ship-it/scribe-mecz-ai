import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import license from 'rollup-plugin-license';

// Task 024 (K3): every file of public/ is asked for with the hash of its content (src/asset.js: 'hero/x.glb?v=…'), so
// a browser's or the service worker's cache never mixes two versions of the game. The map comes from this module:
// virtual:asset-versions = { 'hero/x.glb': '<10 hex>', … } (dotfiles left out).
// every file under dir (dotfiles left out)
function publicFiles(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (f.startsWith('.')) continue;
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) publicFiles(p, out); else out.push(p);
  }
  return out;
}
const versions = pub => Object.fromEntries(publicFiles(pub).map(p => [path.relative(pub, p).split(path.sep).join('/'),
  createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 10)]));

function assetVersions(itch = false) {
  const id = 'virtual:asset-versions', resolved = '\0' + id;
  let map = null, pub = path.resolve('public');
  return {
    name: 'asset-versions',
    configResolved(c) { pub = c.publicDir || pub; },   // (scripts/check-update.mjs builds with another public folder)
    resolveId: i => (i === id ? resolved : null),
    // BUILD: the game's version, the hash of its code (src/) and of its files (task 024 K5: the test runs again when it
    // changes)
    load(i) {
      if (i !== resolved) return null;
      map = versions(pub);
      const h = createHash('sha256').update(JSON.stringify(map));
      for (const f of publicFiles(path.resolve('src')).sort()) h.update(readFileSync(f));
      const build = h.digest('hex').slice(0, 10);
      return `export default ${JSON.stringify(map)};
export const BUILD = '${build}';`;
    },
    // the service worker (sw.src.js): this build's version and the files it may keep (every versioned file)
    generateBundle(_, bundle) {
      if (itch) return;   // (task 033: itch.io's frame has no service worker)
      map ??= versions(pub);
      // (three's Basis transcoder is asked for by its loader without an address of ours: its folder carries three's
      // version, basis-r169/)
      const files = [...Object.entries(map).map(([f, v]) => (f.startsWith('basis-r') ? f : `${f}?v=${v}`)), ...Object.keys(bundle).filter(f => f.startsWith('assets/'))];
      const version = createHash('sha256').update(files.sort().join('\n')).digest('hex').slice(0, 12);
      const source = readFileSync(path.resolve('sw.src.js'), 'utf8').replaceAll('__VERSION__', version).replaceAll('__FILES__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// task 026: the build's number on the start screen (the commit, "+" when the folder had changes not committed, the date of
// the build), so a tester can say what they played
function buildLabel() {
  let sha = 'local';
  try {
    sha = execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim();
    if (execSync('git status --porcelain --untracked-files=no -- .', { encoding: 'utf8' }).trim()) sha += '+';
  } catch { /* no git: a copy of the folder */ }
  return `${sha} · ${new Date().toISOString().slice(0, 10)}`;
}

// task 032 (D3): the licences of the libraries a build carries, written with it (rollup-plugin-license): the game's in
// dist/licenses.txt (the Credits screen links to it), the PvP server's next to its one file (scripts/deploy.mjs)
// The plugin sees the code only: the game's fonts (its CSS) and three's Basis transcoder (copied into public/ by npm run
// assets) are added by hand
const EXTRA = ['@fontsource/ibm-plex-sans', '@fontsource/saira-condensed'];
const NL = String.fromCharCode(10);
const BASIS = ['Name: Basis Universal transcoder (basis-r169/, from three/examples/jsm/libs/basis)',
  'License: Apache-2.0 (Binomial LLC, https://github.com/BinomialLLC/basis_universal; the licence text: see @dimforge/rapier3d-compat above)'].join(NL);
const entry = d => [`Name: ${d.name}`, `Version: ${d.version}`, `License: ${d.license}`,
  d.repository?.url ?? d.repository ? `Repository: ${d.repository?.url ?? d.repository}` : null, '', d.licenseText ?? ''].filter(x => x !== null).join(NL);
const extra = () => EXTRA.map(n => {
  const dir = path.resolve('node_modules', n), pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  return entry({ name: n, version: pkg.version, license: pkg.license, repository: pkg.repository, licenseText: readFileSync(path.join(dir, 'LICENSE'), 'utf8') });
});
const licences = (server, outDir = 'dist') => license({ thirdParty: { includePrivate: false, output: {
  file: path.resolve(server ? 'node_modules/.pvp-build/licenses-server.txt' : `${outDir}/licenses.txt`),
  template: deps => ['SCRIBE: THE ONE: third-party licences', ...deps.map(entry), ...(server ? [] : [...extra(), BASIS])].join(NL + NL + '---' + NL + NL) + NL } } });

// task 033 (B1): `vite build --mode itch` (npm run build:itch): the build for itch.io's frame, in dist-itch/: no service
// worker, no web app manifest (no offer to install), the server at NET.server (src/net/where.js)
const noManifest = () => ({ name: 'itch-no-manifest', transformIndexHtml: html => html.replace(/\s*<link rel="manifest"[^>]*>/, '') });
// (audit r4 B1) the SDK's browser storage (its sign-in token) swapped for one that touches nothing: the guest-only build
// never reads the shared key. Also in the dev server's prebundling of the SDK (optimizeDeps)
const SDK_STORAGE = /[\\/]@colyseus[\\/]sdk[\\/]/;
const noSdkStorage = () => ({ name: 'itch-no-sdk-storage', enforce: 'pre',
  resolveId: (source, importer) => (source === './Storage.mjs' && importer && SDK_STORAGE.test(importer) ? path.resolve('src/net/sdk-no-storage.js') : null) });

export default defineConfig(({ isSsrBuild, mode }) => ({
  base: './',
  define: { __THEONE_BUILD__: JSON.stringify(buildLabel()) },
  plugins: [assetVersions(mode === 'itch'), licences(!!isSsrBuild, mode === 'itch' ? 'dist-itch' : 'dist'), ...(mode === 'itch' ? [noManifest(), noSdkStorage()] : [])],
  ...(mode === 'itch' ? { cacheDir: 'node_modules/.vite-itch', optimizeDeps: { rolldownOptions: { plugins: [noSdkStorage()] } } } : {}),
  // task 027: PvP through the dev server: /pvp goes to the local PvP server (scripts/pvp-server.mjs), so a window reaches
  // the game and the fight at one address (a phone over a temporary https tunnel: THEONE_TUNNEL=1, no reload by HMR)
  server: { host: '127.0.0.1', port: 5173, open: !process.env.THEONE_NO_OPEN,
    proxy: { '/pvp': { target: 'http://127.0.0.1:2567', ws: true, rewrite: p => p.replace(/^\/pvp/, '') } },
    ...(process.env.THEONE_TUNNEL ? { allowedHosts: ['.trycloudflare.com'], hmr: false } : {}) },
  preview: { host: '127.0.0.1', port: 4173 },
  // Rapier (rapier3d-compat) carries its physics engine as WASM inside the JS bundle, about 4 MB
  build: { target: 'es2022', chunkSizeWarningLimit: 6000 },
}));
