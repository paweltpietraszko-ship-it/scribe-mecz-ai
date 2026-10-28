// Mecz modeli: zobowiązanie przed meczem (wzór: dowod.mjs sędziego Statków). Uruchamia je Paweł, nie zawodnik:
//   node sedzia/zobowiaz.mjs <katalog meczu> --p0 claude --p1 codex [--effort medium] [--hands normal]
// Losuje ziarno (crypto) i sól, zapisuje je w <katalog>/ziarno.txt (TAJNE do końca meczu) i tworzy ZOBOWIAZANIE.json:
// ustawienia, SHA-256 ziarna z solą, odcisk kodu (commit tego repozytorium, skróty gra/src, skryptów silnika, modeli
// i animacji z gra/public, plików sędziego i zasad),
// wersje CLI, wersję Node i zainstalowane biblioteki) oraz numer PRZYSZŁEJ rundy publicznej latarni losowości drand
// (League of Entropy: co 3 s nowa liczba, której nikt nie zna wcześniej). Ziarno meczu = skrót tajnego ziarna, soli
// i liczby drand z tej rundy: organizator nie może losować zobowiązań do skutku, bo liczbę drand pozna dopiero po
// publikacji zobowiązania (audyt r2, pkt 2). ZOBOWIAZANIE.json publikujemy PRZED czasem rundy drand; ziarno.txt po
// meczu. sedzia.mjs --mecz odmawia gry, gdy ziarno, pliki albo środowisko nie zgadzają się z zobowiązaniem.
import { createHash, randomBytes, randomInt } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GAME } from './gra.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const SELF = ['sedzia.mjs', 'cialo.js', 'gracze.mjs', 'gra.mjs', 'zobowiaz.mjs', 'zasoby.mjs', 'zasoby.json', 'ZASADY_GRACZA.md'].map(f => path.join(HERE, f));
const ENGINE = ['scripts/sim-node.mjs', 'scripts/node-shims.mjs', 'vite.config.js', 'package.json', 'package-lock.json'].map(f => path.join(GAME, f));
const DRAND = { url: 'https://api.drand.sh', chain: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971', genesis: 1692803367, period: 3 };
const DRAND_WAIT = 30 * 60;   // s od zobowiązania do rundy drand: czas na publikację zobowiązania (--czekaj: tylko próby na sucho)
const tree = dir => readdirSync(dir, { recursive: true }).map(String).filter(f => /\.(js|mjs|json)$/.test(f)).sort().map(f => path.join(dir, f));

// odcisk wszystkiego, co decyduje o przebiegu meczu: każdy plik z osobna i skrót całości
export function fingerprint() {
  // (public/hero i public/weapon: modele postaci, animacje i broń; od nich zależy np. położenie oczu i lufy)
  const assets = ['hero', 'weapon'].flatMap(d => readdirSync(path.join(GAME, 'public', d)).sort().map(f => path.join(GAME, 'public', d, f)));
  const files = [...SELF, ...ENGINE, ...tree(path.join(GAME, 'src')), ...assets];
  const name = f => (f.startsWith(HERE) ? 'sedzia/' + path.relative(HERE, f) : 'gra/' + path.relative(GAME, f)).split(path.sep).join('/');
  const each = Object.fromEntries(files.map(f => [name(f), sha(readFileSync(f))]));
  // (commit i niezacommitowane zmiany repozytorium, w którym leżą sędzia i silnik; gra/public jest poza gitem)
  const git = (...a) => execFileSync('git', a, { cwd: HERE, encoding: 'utf8' }).trim();
  return { commit: git('rev-parse', 'HEAD'), dirty: git('status', '--porcelain', '--untracked-files=no', '--', path.relative(HERE, GAME), '.'),
    files: sha(JSON.stringify(each)), each };
}

// środowisko uruchomienia: Node i silnik JS (obliczenia zmiennoprzecinkowe), system, zainstalowane biblioteki
// (node_modules/.package-lock.json: dokładne wersje drzewa, three.module.js: matematyka i kolizje silnika)
export function runtime() {
  const nm = path.join(GAME, 'node_modules');
  return { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch,
    installed: sha(readFileSync(path.join(nm, '.package-lock.json'))), three: sha(readFileSync(path.join(nm, 'three', 'build', 'three.module.js'))) };
}

// liczba latarni drand z danej rundy (null, gdy runda jeszcze nie nadeszła)
export async function drandAt(round) {
  const res = await fetch(`${DRAND.url}/${DRAND.chain}/public/${round}`);
  if (!res.ok) return null;
  const r = await res.json();
  return r.round === round ? r.randomness : null;
}
export const drandTime = round => new Date((DRAND.genesis + (round - 1) * DRAND.period) * 1000).toISOString();
export const matchSeed = (secret, salt, randomness) => 1 + (parseInt(sha(`${secret}:${salt}:${randomness}`).slice(0, 8), 16) % (2 ** 31 - 2));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] ?? '');
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  if (!process.argv[2] || existsSync(path.join(dir, 'ZOBOWIAZANIE.json'))) throw new Error('podaj nowy katalog meczu (bez ZOBOWIAZANIE.json)');
  const settings = { players: [arg('p0', 'claude'), arg('p1', 'codex')], effort: arg('effort', 'medium'), hands: arg('hands', 'normal'), cap: +arg('cap', 400) };
  const fp = fingerprint();
  if (fp.dirty) throw new Error('kod gry ma niezacommitowane zmiany:\n' + fp.dirty);
  const { cliVersions } = await import('./gracze.mjs');
  const seed = randomInt(1, 2 ** 31), salt = randomBytes(16).toString('hex');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'ziarno.txt'), `${seed} ${salt}\n`);
  const round = Math.ceil((Date.now() / 1000 + +arg('czekaj', DRAND_WAIT) - DRAND.genesis) / DRAND.period) + 1;
  const z = { created: new Date().toISOString(), settings, seedHash: sha(`${seed}:${salt}`), seedRule: 'sha256("<seed>:<salt>")',
    drand: { chain: DRAND.chain, round, time: drandTime(round), url: `${DRAND.url}/${DRAND.chain}/public/${round}` },
    matchSeedRule: '1 + (first 8 hex digits of sha256("<seed>:<salt>:<drand randomness>") as a number) mod (2^31 - 2)',
    fingerprint: fp, runtime: runtime(), cli: await cliVersions(), format: 'first to 2 round wins; round 1: players[0] = side A (east), round 2: sides swapped, round 3: side from the seed' };
  writeFileSync(path.join(dir, 'ZOBOWIAZANIE.json'), JSON.stringify(z, null, 1));
  console.log(`zobowiązanie: ${path.join(dir, 'ZOBOWIAZANIE.json')}\nskrót ziarna: ${z.seedHash}\nodcisk plików: ${fp.files} (commit ${fp.commit})\n` +
    `runda drand ${round}: ${z.drand.time}\n` +
    `ziarno.txt jest TAJNE do końca meczu. Opublikuj ZOBOWIAZANIE.json PRZED ${z.drand.time}, po tym czasie: node sedzia/sedzia.mjs --mecz ${dir}`);
}
