// Mecz modeli: zobowiązanie przed meczem (wzór: dowod.mjs sędziego Statków). Uruchamia je Paweł, nie zawodnik:
//   node sedzia/zobowiaz.mjs <katalog meczu> --p0 claude --p1 codex [--effort medium] [--hands normal]
// Losuje ziarno (crypto) i sól, zapisuje je w <katalog>/ziarno.txt (TAJNE do końca meczu) i tworzy ZOBOWIAZANIE.json:
// ustawienia, SHA-256 ziarna z solą, odcisk kodu (commit tego repozytorium, skróty gra/src, skryptów silnika, modeli
// i animacji z gra/public, plików sędziego i zasad),
// wersje CLI. ZOBOWIAZANIE.json publikujemy PRZED meczem; ziarno.txt po meczu. sedzia.mjs --mecz odmawia gry, gdy
// ziarno albo pliki nie zgadzają się z zobowiązaniem.
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
  const z = { created: new Date().toISOString(), settings, seedHash: sha(`${seed}:${salt}`), seedRule: 'sha256("<seed>:<salt>")', fingerprint: fp,
    cli: await cliVersions(), format: 'first to 2 round wins; round 1: players[0] = side A (east), round 2: sides swapped, round 3: side from the seed' };
  writeFileSync(path.join(dir, 'ZOBOWIAZANIE.json'), JSON.stringify(z, null, 1));
  console.log(`zobowiązanie: ${path.join(dir, 'ZOBOWIAZANIE.json')}\nskrót ziarna: ${z.seedHash}\nodcisk plików: ${fp.files} (commit ${fp.commit})\n` +
    `ziarno.txt jest TAJNE do końca meczu. Najpierw opublikuj ZOBOWIAZANIE.json, potem: node sedzia/sedzia.mjs --mecz ${dir}`);
}
