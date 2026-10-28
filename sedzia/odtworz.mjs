// Mecz modeli (próba 28.10): odtworzenie rundy z zapisu kroków (zapis.json) na świeżym silniku, bez modeli.
// Sprawdza, czy stan gry co sekundę (odcisk silnika) i końcowe HP są takie same jak w meczu.
//   node sedzia/odtworz.mjs <katalog próby albo meczu> [--gra <folder game>]
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { loadGame } from './gra.mjs';

const dir = process.argv[2];
const rec = JSON.parse(readFileSync(path.join(dir, 'zapis.json'), 'utf8'));
const end = JSON.parse(readFileSync(path.join(dir, 'koniec.json'), 'utf8'));
const { sim } = await loadGame();
const r = await sim.playRecording(rec);
console.log(`kroki ${rec.steps.length}, odciski co sekundę ${rec.trail.length}`);
console.log(`stan przed startem: ${r.before ? 'RÓŻNY ' + JSON.stringify(r.before) : 'zgodny'}; po pierwszym kroku: ${r.first ? 'RÓŻNY ' + JSON.stringify(r.first) : 'zgodny'}`);
console.log(`pierwszy krok z innym odciskiem: ${r.apart ?? 'brak (wszystkie zgodne)'}`);
console.log('rundy w odtworzeniu:', JSON.stringify(r.results), 'w meczu HP na końcu:', JSON.stringify(end.hp));
await sim.close();
process.exit(r.apart || r.before || r.first ? 1 : 0);
