// Gdzie jest gra SCRIBE: THE ONE (jej folder `game`) i jak sędzia ładuje jej silnik bez rysowania.
// Folder gry: --gra <folder> albo zmienna THEONE_GAME; domyślnie ../ONE/game obok tego repozytorium.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..');
const i = process.argv.indexOf('--gra');
export const GAME = path.resolve(i > 0 ? process.argv[i + 1] : process.env.THEONE_GAME ?? path.join(REPO, '..', 'ONE', 'game'));
if (!existsSync(path.join(GAME, 'src', 'sim', 'engine.js'))) throw new Error(`nie ma gry w ${GAME} (podaj --gra <folder game>)`);

// silnik gry (scripts/sim-node.mjs: moduły gry przez Vite, pliki z public/) i ciało postaci (cialo.js, ładowane tak
// samo, bo używa modułów gry)
export async function loadGame() {
  const { loadSim } = await import(pathToFileURL(path.join(GAME, 'scripts', 'sim-node.mjs')).href);
  const THREE = await import(pathToFileURL(path.join(GAME, 'node_modules', 'three', 'build', 'three.module.js')).href);
  // (konfiguracja Vite gry czyta pliki względem bieżącego folderu: silnik ładowany z folderu gry, potem powrót)
  const back = process.cwd();
  process.chdir(GAME);
  const sim = await loadSim().finally(() => process.chdir(back));
  const body = await sim.load('/@fs/' + path.join(HERE, 'cialo.js').split(path.sep).join('/'));
  return { sim, THREE, body };
}
