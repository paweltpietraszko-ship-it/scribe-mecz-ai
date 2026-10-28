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
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GAME } from './gra.mjs';
import { DEFAULT_MODELS, cliVersions } from './gracze.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha = b => createHash('sha256').update(b).digest('hex');
const SELF = ['sedzia.mjs', 'cialo.js', 'gracze.mjs', 'gra.mjs', 'zobowiaz.mjs', 'zasoby.mjs', 'zasoby.json', 'ZASADY_GRACZA.md'].map(f => path.join(HERE, f));
const ENGINE = ['scripts/sim-node.mjs', 'scripts/node-shims.mjs', 'vite.config.js', 'package.json', 'package-lock.json'].map(f => path.join(GAME, f));
// (trzy niezależne serwery tej samej sieci quicknet; liczba musi być ta sama u wszystkich, które odpowiedzą, i co najmniej dwóch)
export const DRAND = { url: 'https://api.drand.sh', relays: ['https://api.drand.sh', 'https://drand.cloudflare.com', 'https://api3.drand.sh'],
  chain: '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971', genesis: 1692803367, period: 3 };
const DRAND_WAIT = 5 * 60;    // s od zobowiązania do rundy drand: czas na publikację zobowiązania (--czekaj: tylko próby na sucho)
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

// treść wszystkich plików bibliotek, których kod wykonuje się w meczu (audyt r3 pkt 5): silnik (three, recast-navigation),
// ładowarka Vite z wtyczką z vite.config.js i wszystkie ich zależności według node_modules/.package-lock.json
const USED = ['three', 'recast-navigation', 'vite', 'rollup-plugin-license'];
function depsHash(nm) {
  const lock = JSON.parse(readFileSync(path.join(nm, '.package-lock.json'), 'utf8')).packages, seen = new Set();
  const find = (from, d) => {   // jak Node: najpierw node_modules najgłębiej, potem poziom wyżej
    for (let base = from; ; base = base.slice(0, base.lastIndexOf('/node_modules/'))) {
      if (lock[`${base}/node_modules/${d}`]) return `${base}/node_modules/${d}`;
      if (base.lastIndexOf('/node_modules/') < 0) return lock[`node_modules/${d}`] ? `node_modules/${d}` : null;
    }
  };
  const todo = USED.map(n => `node_modules/${n}`);
  while (todo.length) {
    const k = todo.pop();
    if (seen.has(k) || !lock[k]) continue;
    seen.add(k);
    for (const d of Object.keys({ ...lock[k].dependencies, ...lock[k].optionalDependencies })) { const f = find(k, d); if (f) todo.push(f); }
  }
  const each = [...seen].sort().filter(k => existsSync(path.join(GAME, k))).flatMap(k => readdirSync(path.join(GAME, k), { recursive: true }).map(String).sort()
    .filter(f => statSync(path.join(GAME, k, f)).isFile()).map(f => `${k}/${f.split(path.sep).join('/')} ${sha(readFileSync(path.join(GAME, k, f)))}`));
  return { packages: seen.size, files: each.length, hash: sha(each.join('\n')) };
}

// środowisko uruchomienia: Node i silnik JS (obliczenia zmiennoprzecinkowe), system, zainstalowane biblioteki
export function runtime() {
  const nm = path.join(GAME, 'node_modules');
  return { node: process.version, v8: process.versions.v8, platform: process.platform, arch: process.arch,
    installed: sha(readFileSync(path.join(nm, '.package-lock.json'))), deps: depsHash(nm) };
}

// liczba latarni drand z danej rundy (null, gdy runda jeszcze nie nadeszła). Podpisu BLS nie sprawdzamy; sprawdzamy, że
// randomness = SHA-256(podpis) i że niezależne serwery podają to samo (audyt r3 pkt 6)
export async function drandAt(round) {
  const got = (await Promise.all(DRAND.relays.map(async u => {
    try {
      const res = await fetch(`${u}/${DRAND.chain}/public/${round}`, { signal: AbortSignal.timeout(15000) });
      const r = res.ok ? await res.json() : null;
      return r?.round === round && r.randomness === sha(Buffer.from(r.signature, 'hex')) ? r.randomness : null;
    } catch { return null; }
  }))).filter(Boolean);
  if (new Set(got).size > 1) throw new Error(`drand: serwery podają różne liczby dla rundy ${round}`);
  return got.length >= 2 ? got[0] : null;
}
export const drandTime = round => new Date((DRAND.genesis + (round - 1) * DRAND.period) * 1000).toISOString();
export const matchSeed = (secret, salt, randomness) => 1 + (parseInt(sha(`${secret}:${salt}:${randomness}`).slice(0, 8), 16) % (2 ** 31 - 2));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = path.resolve(process.argv[2] ?? '');
  const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  if (!process.argv[2] || existsSync(path.join(dir, 'ZOBOWIAZANIE.json'))) throw new Error('podaj nowy katalog meczu (bez ZOBOWIAZANIE.json)');
  const players = [arg('p0', 'claude'), arg('p1', 'codex')];
  const settings = { players, models: [arg('m0', DEFAULT_MODELS[players[0]]), arg('m1', DEFAULT_MODELS[players[1]])],
    effort: arg('effort', 'medium'), hands: arg('hands', 'normal'), cap: +arg('cap', 400) };
  const fp = fingerprint();
  if (fp.dirty) throw new Error('kod gry ma niezacommitowane zmiany:\n' + fp.dirty);
  const seed = randomInt(1, 2 ** 31), salt = randomBytes(16).toString('hex');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'ziarno.txt'), `${seed} ${salt}\n`);
  const round = Math.ceil((Date.now() / 1000 + +arg('czekaj', DRAND_WAIT) - DRAND.genesis) / DRAND.period) + 1;
  const z = { created: new Date().toISOString(), settings, seedHash: sha(`${seed}:${salt}`), seedRule: 'sha256("<seed>:<salt>")',
    drand: { chain: DRAND.chain, round, time: drandTime(round), url: `${DRAND.url}/${DRAND.chain}/public/${round}` },
    matchSeedRule: 'H = SHA-256 of the UTF-8 text "<seed>:<salt>:<randomness>" (seed in decimal and salt in hex as in ziarno.txt, randomness as the lowercase hex of the beacon round); match seed = 1 + (first 8 hex digits of H as an integer) mod 2147483646',
    fingerprint: fp, runtime: runtime(), cli: await cliVersions(), format: 'first to 2 round wins; round 1: players[0] = side A (east), round 2: sides swapped, round 3: side from the seed',
    void: 'a model call with no answer (timeout 45 s, CLI error) is asked again with the same prompt up to 10 more times while game time stays stopped; a provider limit, an 11th call in a row with no answer, no proof of model and isolation, or another model stops the game at once and voids the whole match; the score so far is published but nobody wins; a new match needs a new commitment' };
  writeFileSync(path.join(dir, 'ZOBOWIAZANIE.json'), JSON.stringify(z, null, 1));
  console.log(`zobowiązanie: ${path.join(dir, 'ZOBOWIAZANIE.json')}\nskrót ziarna: ${z.seedHash}\nodcisk plików: ${fp.files} (commit ${fp.commit})\n` +
    `runda drand ${round}: ${z.drand.time}\n` +
    `ziarno.txt jest TAJNE do końca meczu. Opublikuj ZOBOWIAZANIE.json PRZED ${z.drand.time}, po tym czasie: node sedzia/sedzia.mjs --mecz ${dir}`);
}
