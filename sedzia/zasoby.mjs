// Modele postaci, animacje i broń gry (public/hero, public/weapon) NIE leżą w tym repozytorium: animacje są z Adobe
// Mixamo, a ich licencja nie pozwala rozpowszechniać plików animacji osobno. Ten skrypt pobiera je z opublikowanej gry
// (tak jak robi to przeglądarka każdego gracza) do gra/public/ i sprawdza SHA-256 każdego pliku z listą zasoby.json;
// plik o innym skrócie jest odrzucany.
//   node sedzia/zasoby.mjs [--z <adres gry>]                 pobranie (domyślnie adres z zasoby.json)
//   node sedzia/zasoby.mjs --lista <folder public gry>       nowa lista skrótów (autor gry, przy zmianie zasobów)
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url)), LIST = path.join(HERE, 'zasoby.json');
const PUB = path.join(HERE, '..', 'gra', 'public');
const DIRS = ['hero', 'weapon'];
const sha = b => createHash('sha256').update(b).digest('hex');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

const from = arg('lista', null);
if (from) {
  const files = Object.fromEntries(DIRS.flatMap(d => readdirSync(path.join(from, d)).sort().map(f => [`${d}/${f}`, sha(readFileSync(path.join(from, d, f)))])));
  const old = existsSync(LIST) ? JSON.parse(readFileSync(LIST, 'utf8')) : {};
  writeFileSync(LIST, JSON.stringify({ base: old.base ?? 'https://game-production-5354.up.railway.app/', files }, null, 1) + '\n');
  console.log(`lista: ${Object.keys(files).length} plików -> ${LIST}`);
} else {
  const { base, files } = JSON.parse(readFileSync(LIST, 'utf8'));
  const url = arg('z', base);
  let bad = 0;
  for (const [f, want] of Object.entries(files)) {
    const to = path.join(PUB, f);
    if (existsSync(to) && sha(readFileSync(to)) === want) { console.log(`ok (już jest)  ${f}`); continue; }
    const res = await fetch(new URL(f, url));
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok || sha(buf) !== want) { bad++; console.log(`ZŁY SKRÓT albo błąd ${res.status}  ${f}`); continue; }
    mkdirSync(path.dirname(to), { recursive: true });
    writeFileSync(to, buf);
    console.log(`pobrany  ${f} (${(buf.length / 1e6).toFixed(1)} MB)`);
  }
  console.log(bad ? `BŁĄD: ${bad} plików nie zgadza się z zasoby.json` : 'wszystkie zasoby zgodne z zasoby.json');
  process.exitCode = bad ? 1 : 0;
}
