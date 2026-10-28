// Mecz modeli (28.10.2026): sędzia meczu do 2 wygranych rund ze zmianą stron. Silnik gry bez rysowania (src/sim),
// dwie postacie prowadzone przez modele (cialo.js). Czas gry stoi, gdy model myśli: przy każdym ważnym zdarzeniu sędzia
// zatrzymuje grę, pokazuje modelowi to, co wie jego postać, i bierze rozkaz.
//   mecz:      node sedzia/sedzia.mjs --mecz <katalog z ZOBOWIAZANIE.json i ziarno.txt>   (zobowiaz.mjs)
//   próba:     node sedzia/sedzia.mjs --p0 stub --p1 stub [--seed 21] [--n 8]        (bez zobowiązania)
//   sprawdź:   node sedzia/sedzia.mjs --sprawdz <katalog meczu>
// Każde polecenie przyjmuje --gra <folder game gry SCRIBE: THE ONE> (domyślnie ../ONE/game, gra.mjs).
// Sprawdzenie rozgrywa mecz od nowa bez modeli: odpowiedzi czyta z surowego wyjścia CLI (raw/), wymaga, żeby każde
// polecenie dla modelu, każdy rozkaz i każdy krok gry były takie same jak w zapisie.
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPO, loadGame } from './gra.mjs';
import { modelPlayer, parseAnswer, readers, cliVersions, freshCodexHome, snapshotCli, DEFAULT_MODELS, FAILURES } from './gracze.mjs';
import { fingerprint, runtime, drandAt, drandTime, matchSeed, DRAND } from './zobowiaz.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const TIMEOUT = 300000, DT = 1 / 60, NEAR = 15, MAXEL = 20, HIT_QUIET = 1.0, CAMP_WAKE = [5, 2];
const sha = s => createHash('sha256').update(s).digest('hex');

// ---- ustawienia: mecz (z zobowiązania), sprawdzenie (z zapisu meczu) albo próba ----
const checkDir = arg('sprawdz', null), matchDir = arg('mecz', null);
// sprawdzenie: pierwsza niezgodność przerywa powtórkę (dalej przebieg i tak się rozchodzi)
const failNow = err => { console.log('SPRAWDZENIE: FAIL\n' + err.message); process.exit(1); };
if (checkDir) { process.on('uncaughtException', failNow); process.on('unhandledRejection', failNow); }
let set, out;
// ziarno meczu z zobowiązania: tajne ziarno (skrót w zobowiązaniu) i liczba latarni drand z rundy zapisanej w zobowiązaniu
async function committedSeed(dir) {
  const z = JSON.parse(readFileSync(path.join(dir, 'ZOBOWIAZANIE.json'), 'utf8'));
  const [secret, salt] = readFileSync(path.join(dir, 'ziarno.txt'), 'utf8').trim().split(/\s+/);
  if (sha(`${secret}:${salt}`) !== z.seedHash) throw new Error('ziarno.txt nie zgadza się ze skrótem w zobowiązaniu');
  if (z.drand.chain !== DRAND.chain) throw new Error('zobowiązanie wskazuje inną sieć drand: ' + z.drand.chain);
  const randomness = await drandAt(z.drand.round);
  if (!randomness) throw new Error(`runda drand ${z.drand.round} jeszcze nie nadeszła (${drandTime(z.drand.round)}) albo latarnia nie odpowiada`);
  return { z, salt, seed: matchSeed(secret, salt, randomness), drand: { round: z.drand.round, randomness } };
}
if (checkDir) {
  set = JSON.parse(readFileSync(path.join(checkDir, 'ustawienia.json'), 'utf8'));
  out = path.join(REPO, 'wyniki', '_sprawdzenie');
  // zgodność z zobowiązaniem: osobno od zgodności przebiegu (audyt r3 pkt 8). Ustawienia i ziarno muszą się zgadzać;
  // pliki i środowisko weryfikatora to informacja (na innym komputerze środowisko jest inne)
  if (existsSync(path.join(checkDir, 'ZOBOWIAZANIE.json'))) {
    const z = JSON.parse(readFileSync(path.join(checkDir, 'ZOBOWIAZANIE.json'), 'utf8'));
    for (const f of ['players', 'models', 'effort', 'hands', 'cap']) if (JSON.stringify(z.settings[f]) !== JSON.stringify(set[f])) throw new Error(`zobowiązanie: ${f} ${JSON.stringify(z.settings[f])}, w meczu ${JSON.stringify(set[f])}`);
    if (JSON.stringify(z.runtime) !== JSON.stringify(set.runtime) || JSON.stringify(z.cli) !== JSON.stringify(set.cli)) throw new Error('zobowiązanie: środowisko albo wersje CLI meczu inne niż w zobowiązaniu');
    console.log('ZOBOWIĄZANIE: ustawienia, modele, środowisko i wersje CLI meczu zgodne z zobowiązaniem');
    if (existsSync(path.join(checkDir, 'ziarno.txt'))) {
      const c = await committedSeed(checkDir);
      if (c.seed !== set.seed) throw new Error(`ziarno meczu ${set.seed}, z zobowiązania i drand ${c.seed}`);
      console.log(`ZIARNO: zgodne z zobowiązaniem i latarnią drand (runda ${c.drand.round}, ${drandTime(c.drand.round)}); czas publikacji zobowiązania sprawdź w historii repozytorium`);
    } else console.log('ZIARNO: NIESPRAWDZONE (brak ziarno.txt)');
    console.log(`PLIKI WERYFIKATORA: ${fingerprint().files === z.fingerprint.files ? 'te same co w zobowiązaniu' : 'INNE niż w zobowiązaniu'}`);
  } else console.log('ZOBOWIĄZANIE: brak (próba, nie mecz)');
  const rt = runtime(), was = set.runtime;
  if (was) console.log(`ŚRODOWISKO WERYFIKATORA: ${JSON.stringify(rt) === JSON.stringify(was) ? 'to samo co w meczu' : `inne niż w meczu (mecz: Node ${was.node}, V8 ${was.v8}, ${was.platform}; tu: Node ${rt.node}, V8 ${rt.v8}, ${rt.platform}); inna wersja może inaczej liczyć funkcje matematyczne`}`);
} else if (matchDir) {
  if (existsSync(path.join(matchDir, 'decyzje.jsonl'))) throw new Error('w tym katalogu mecz już był rozgrywany (decyzje.jsonl): zapis meczu nie może się mieszać');
  const c = await committedSeed(matchDir);
  const now = fingerprint();
  if (now.files !== c.z.fingerprint.files) throw new Error('pliki gry albo sędziego zmieniły się od zobowiązania');
  // (mecz gra na kopiach programów graczy, sprawdzonych skrótami z zobowiązaniem)
  snapshotCli(path.basename(matchDir));
  const rt = runtime(), cli = await cliVersions();
  if (JSON.stringify(rt) !== JSON.stringify(c.z.runtime)) throw new Error(`środowisko zmieniło się od zobowiązania: ${JSON.stringify(c.z.runtime)} -> ${JSON.stringify(rt)}`);
  if (JSON.stringify(cli) !== JSON.stringify(c.z.cli)) throw new Error(`wersje CLI zmieniły się od zobowiązania: ${JSON.stringify(c.z.cli)} -> ${JSON.stringify(cli)}`);
  if (!c.z.settings.models) throw new Error('zobowiązanie bez modeli graczy');
  set = { ...c.z.settings, seed: c.seed, salt: c.salt, drand: c.drand, runtime: rt, cli, committed: true };
  out = matchDir;
} else {
  const players = [arg('p0', 'stub'), arg('p1', 'stub')];
  set = { players, models: [arg('m0', DEFAULT_MODELS[players[0]]), arg('m1', DEFAULT_MODELS[players[1]])], seed: +arg('seed', 21), effort: arg('effort', 'medium'),
    hands: arg('hands', 'normal'), cap: +arg('n', 400), committed: false };
  out = path.join(REPO, 'wyniki', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + `_${set.players.join('-')}`);
}
mkdirSync(path.join(out, 'raw'), { recursive: true });
if (checkDir) for (const f of ['decyzje.jsonl', 'rundy.jsonl']) if (existsSync(path.join(out, f))) writeFileSync(path.join(out, f), '');
const P = set.players;   // P[0] gra stroną A w rundzie 1, stroną B w rundzie 2

const { sim, THREE, body: B } = await loadGame();
const { WEAPONS, COMBAT } = await sim.load('/src/data/combat.js');
const { MATCH } = await sim.load('/src/data/match.js');
// wygrane meczu liczy sędzia, po graczach (strony się zmieniają); gra rozgrywa kolejne rundy i sama meczu nie kończy
const WINS = MATCH.winsToWin;
MATCH.winsToWin = Infinity;
const { BOT } = await sim.load('/src/data/bot.js');
const { combatLog } = await sim.load('/src/combat/log.js');
const shots = [[], []];
let bodies = [null, null];
const e = await sim.engine({ seed: set.seed, opt: { bots: false, auto: true, level: 'normal', scribe: true, record: true, names: ['A', 'B'],
  onShot: (s, side) => { shots[side].push(s); bodies[1 - side]?.hear(s.from); } } });
const W = WEAPONS[e.match.weapon];
// strona w rundzie 3 (przy 1:1): z ziarna meczu, ustalona przed meczem
const thirdSwap = e.rng.stream('mecz-ai:strony')() < 0.5;
// kto (indeks w P) prowadzi stronę k (0 = A, 1 = B) w rundzie r
const playerOf = (r, k) => ((r === 2 || (r >= 3 && thirdSwap)) ? 1 - k : k);

// ---- zasady dla graczy, z liczbami z danych gry ----
const weaponName = { karabin: 'assault rifle', smg: 'submachine gun', dmr: "marksman's rifle", strzelba: 'shotgun' }[e.match.weapon];
const weaponText = `- Weapon this match: **${weaponName}**, ${W.mode === 'auto' ? 'automatic' : 'semi-automatic'}, ${W.rpm} shots/min, magazine ${W.magazine}, ` +
  `effective range ${W.falloff ? W.falloff.full + ' m (weak beyond ' + W.falloff.zero + ' m)' : W.range + ' m'}. ` +
  `About ${Math.ceil(COMBAT.hp / (W.damage * (W.pellets?.count ?? 1)))} body hits kill. Moving does not make you less accurate, crouching does not make you more accurate.`;
const rules = readFileSync(path.join(HERE, 'ZASADY_GRACZA.md'), 'utf8').replace('{{WEAPON}}', weaponText).replace('{{HP}}', COMBAT.hp)
  .replace('{{MEDKITS}}', COMBAT.medkits).replace('{{HEAL}}', COMBAT.medkitHeal).replace('{{HEAL_TIME}}', COMBAT.medkitTime)
  .replace('{{RELOAD}}', W.reloadTime).replaceAll('{{ROUND}}', MATCH.roundTime).replaceAll('{{OVERTIME}}', MATCH.overtime).replaceAll('{{WINS}}', WINS);
writeFileSync(path.join(out, 'zasady.md'), rules);

// ---- bryły areny: E<id> (elementy SCRIBE), A0–A2 (ramiona obrotnicy) ----
const els = e.machine.mech.els, owners = new Map(), label = el => (el.arm !== undefined ? 'A' + el.arm : 'E' + el.id);
for (const el of els) owners.set(label(el), el.arm !== undefined ? el.id : el.g);
const eye3 = new THREE.Vector3(), dir3 = new THREE.Vector3();
// czy oczy widzą bryłę (promień do jej środka zatrzymuje się na niej, a nie przed nią): stan bryły (zapowiedź, ruch,
// zapadnięcie) widać tylko wtedy (audyt r1 pkt 6); bryły w 15 m zna z pamięci areny, bez ich stanu
function inSight(el, me) {
  const p = { x: el.spec.x, z: el.spec.z }, half = el.E ? Math.hypot(...el.E.outline) / 2 : 1.6;
  me.eyes(eye3);
  const y = Math.max(0.3, Math.min(el.pose.h - 0.1, 1.2));
  dir3.set(p.x - eye3.x, y - eye3.y, p.z - eye3.z);
  const d = dir3.length(); dir3.normalize();
  const hit = e.ballistics.trace(eye3, dir3, d, me).point;
  return Math.hypot(hit.x - eye3.x, hit.z - eye3.z) >= Math.hypot(p.x - eye3.x, p.z - eye3.z) - half - 0.3;
}
function describe(el, me) {
  const p = { x: el.spec.x, z: el.spec.z }, d = Math.hypot(p.x - me.feet.x, p.z - me.feet.z);
  let shape;
  if (el.arm !== undefined) shape = 'turntable arm 3.0 m x 0.4 m (turns with the disc)';
  else {
    const [w, dd] = el.E.outline, r = el.spec.rotY ?? 0, along = B.bearing(Math.cos(r), -Math.sin(r)) % 180;
    shape = `block ${w.toFixed(1)} m x ${dd.toFixed(1)} m` + (Math.abs(w - dd) > 0.3 ? `, long side along bearing ${w >= dd ? along : (along + 90) % 180}` : '');
  }
  const seen = inSight(el, me), h = seen ? el.pose.h : el.H;
  const state = !seen ? ' — not in sight now (its current state unknown)' : el.phase === 'warn' ? ' — ANNOUNCED: about to move'
    : el.phase === 'move' ? ' — MOVING' : h < el.H - 0.1 ? ` — sunk to ${h.toFixed(1)} m` : '';
  return { d, text: `${label(el)}: ${shape}, height ${h.toFixed(1)} m (${h >= 1.5 ? 'tall' : h >= 0.8 ? 'low' : 'no cover'}), centre (${B.toXY(p).join(', ')}), ${d.toFixed(1)} m at bearing ${B.bearing(p.x - me.feet.x, p.z - me.feet.z)}${state}` };
}

// ---- widok jednej strony: tylko to, co wie jej postać ----
let memo, st, roundNo = 0, wins = [0, 0];
function view(k, why) {
  const b = bodies[k], me = b.me, other = b.other, know = b.know, m = memo[k], now = b.clock, pi = playerOf(roundNo, k);
  const cs = me.coverState.mode, line = me.cover.line, inCover = cs === 'cover' && line ? [...owners].find(([, o]) => o === line.owner)?.[0] : null;
  const L = [];
  L.push(`MATCH: round ${roundNo}, rounds won: you ${wins[pi]}, enemy ${wins[1 - pi]} (first to ${WINS}). This round you started on the ${k ? 'west' : 'east'} side.`);
  L.push(`ROUND TIME: ${e.round.time.toFixed(1)} s of ${MATCH.roundTime} s${e.round.overtime ? ' (OVERTIME)' : ''}.`);
  L.push(`YOU: at (${B.toXY(me.feet).join(', ')}), facing bearing ${B.bearingOfYaw(b.view.yaw)}. HP ${Math.round(me.hp)}/${COMBAT.hp}. Medkits ${me.health.medkits}. ` +
    `Magazine ${me.weapon.mag}/${W.magazine}${me.weapon.reload ? ' (reloading)' : ''}. ` +
    `State: ${me.health.healing ? 'healing' : inCover ? `in cover at ${inCover}${line.crouch ? ' (crouched)' : ''}` : me.character.speed.length() > 0.5 ? 'moving' : 'standing in the open'}.`);
  L.push(`YOUR LAST ORDER: ${m.last ? JSON.stringify(m.last) : '(none yet: the round has just started)'}. Status: ${m.last ? b.status : '-'}.`);
  if (m.error) L.push(`YOUR PREVIOUS ANSWER WAS REJECTED (${m.error}), so your previous order continued.`);
  L.push(`WHY YOU ARE ASKED NOW: ${why.join('; ')}.`);
  if (know.sees) L.push(`ENEMY: SEEN NOW at (${B.toXY(other.feet).join(', ')}), ${Math.hypot(other.feet.x - me.feet.x, other.feet.z - me.feet.z).toFixed(1)} m at bearing ${B.bearing(other.feet.x - me.feet.x, other.feet.z - me.feet.z)}, ` +
    `${other.coverState.mode === 'cover' ? 'in cover' : other.character.speed.length() > 0.5 ? 'moving' : 'standing'}, its HP bar shows about ${Math.round(other.hp / 5) * 5} HP.`);
  else if (know.where) L.push(`ENEMY: not seen now. Last known at (${B.toXY(know.where).join(', ')}) ${(now - know.when).toFixed(1)} s ago, ${know.how === 'sound' ? `from the sound of its shots (about ${BOT.hearError} m accurate)` : 'seen'}.`);
  else L.push('ENEMY: not seen yet, no idea where it is.');
  const ev = [];
  const hits = b.log.hits.splice(0), lost = Math.round(m.hpAt - me.hp);
  if (hits.length) ev.push(`you were hit ${hits.length} time(s), your HP changed by ${-lost}, shots came from bearing(s) ${[...new Set(hits.map(h => Math.round(h.from / 10) * 10 % 360))].join(', ')}`);
  const heard = b.log.heard.splice(0);
  if (heard.length) ev.push(`you heard ${heard.length} enemy shot(s), the last one from around (${B.toXY(heard.at(-1)).join(', ')})`);
  const fired = shots[k].length - m.shotsAt, markers = b.log.markers;
  b.log.markers = 0;
  if (fired) ev.push(`you fired ${fired} shot(s), ${markers ? `${markers} hit marker(s)` : 'no hit markers'}`);
  L.push(`SINCE YOUR LAST DECISION: ${ev.length ? ev.join('; ') : 'nothing new'}.`);
  m.hpAt = me.hp; m.shotsAt = shots[k].length;
  const camp = e.machine.campLeft(k);
  L.push(`SCRIBE: ${camp !== null && camp <= CAMP_WAKE[0] ? `CAMPING WARNING: walls within 12 m of you sink in ${camp.toFixed(1)} s unless you move more than 6 m away` : 'no warning for you'}.`);
  const near = els.filter(el => Math.hypot(el.spec.x - me.feet.x, el.spec.z - me.feet.z) <= NEAR).map(el => describe(el, me)).sort((a, c) => a.d - c.d).slice(0, MAXEL);
  L.push(`ELEMENTS WITHIN ${NEAR} m, nearest first:`, ...near.map(x => '- ' + x.text));
  L.push(`YOUR NOTE: ${m.note || '(empty)'}`);
  return L.join('\n');
}

// ---- rozkaz: sprawdzenie (zły rozkaz = poprzedni zostaje, model dostaje błąd w następnym widoku) ----
const num = v => typeof v === 'number' && Number.isFinite(v);
function check(o) {
  if (!o || typeof o !== 'object') return { err: 'not an object' };
  const r = {};
  if (o.move === 'stay' || o.move === 'leave_cover') r.move = o.move;
  else if (Array.isArray(o.move?.to) && num(o.move.to[0]) && num(o.move.to[1])) r.move = { to: [o.move.to[0], o.move.to[1]] };
  else if (typeof o.move?.cover === 'string' && owners.has(o.move.cover)) r.move = { cover: o.move.cover };
  else return { err: 'bad move ' + JSON.stringify(o.move) };
  if (o.against !== undefined) {
    if (!(Array.isArray(o.against) && num(o.against[0]) && num(o.against[1]))) return { err: 'bad against ' + JSON.stringify(o.against) };
    r.against = [o.against[0], o.against[1]];
  }
  if (o.fire === undefined) r.fire = 'at_enemy';
  else if (['at_enemy', 'hold', 'blind'].includes(o.fire)) r.fire = o.fire;
  else return { err: 'bad fire ' + JSON.stringify(o.fire) };   // (audyt r1 pkt 9: nie zamieniać na strzelanie)
  if (num(o.look)) r.look = ((Math.round(o.look) % 360) + 360) % 360;
  for (const f of ['sprint', 'medkit', 'reload']) if (o[f] === true) r[f] = true;
  if (o.dodge === 'left' || o.dodge === 'right') r.dodge = o.dodge;
  r.for = num(o.for) ? Math.min(5, Math.max(1, o.for)) : 3;
  return { order: r, comment: String(o.comment ?? '').slice(0, 300), note: String(o.note ?? '').slice(0, 300) };
}

// ---- gracze ----
const decided = checkDir ? readFileSync(path.join(checkDir, 'decyzje.jsonl'), 'utf8').trim().split('\n').map(l => JSON.parse(l)) : null;
let replayAt = 0;
// (--awaria <gracz>:<decyzja>: zastępczy gracz udaje awarię wywołania w swojej n-tej decyzji meczu; tylko próby na sucho)
const [failP, failN] = (arg('awaria', '') || '-1:0').split(':').map(Number);
function stub(i) {   // bez modelu: idź ku środkowi, chowaj się przy najbliższej bryle, gdy widzisz przeciwnika
  let calls = 0;
  return { kind: 'stub', async decide(prompt) {
    if (i === failP && ++calls === failN) return { outcome: 'cli_error', error: 'udawana awaria (próba na sucho)', model: 'stub', raw: { stdout: '', stderr: 'udawana awaria', code: 1, timedOut: false, stubFail: true } };
    const sees = /ENEMY: SEEN NOW/.test(prompt), near = /- (E\d+): [^\n]*\(tall\)/.exec(prompt.split('ELEMENTS')[1] ?? '');
    const east = /started on the east/.test(prompt);
    const o = sees && near ? { move: { cover: near[1] }, comment: 'stub ' + i + ': cover' } : { move: { to: [east ? 4 : -4, -5] }, comment: 'stub ' + i + ': forward' };
    const text = JSON.stringify(o);
    return { outcome: 'ok', output: o, text, model: 'stub', raw: { stdout: text, stderr: '', code: 0, timedOut: false } };
  } };
}
// sprawdzenie: odpowiedź modelu z zapisanego surowego wyjścia CLI, przeczytana tym samym kodem co w meczu
function replayer(i) {
  return { kind: 'replay', async decide(prompt, _t, ctx) {
    const d = decided[replayAt++];
    if (!d || d.player !== i || d.play !== ctx.play || d.round !== ctx.round || d.side !== ctx.side || d.n !== ctx.n) throw new Error(`sprawdzenie: inna kolejność decyzji (${JSON.stringify(ctx)} zamiast ${d && JSON.stringify({ player: d.player, play: d.play, round: d.round, side: d.side, n: d.n })})`);
    if (sha(prompt) !== d.promptHash) throw new Error(`sprawdzenie: inny widok dla modelu w decyzji ${d.round}/${d.side}#${d.n}`);
    const raw = JSON.parse(readFileSync(path.join(checkDir, 'raw', d.raw), 'utf8'));
    const kind = set.players[i];
    const r = kind !== 'stub' ? readers[kind](raw) : raw.stubFail ? { outcome: 'cli_error', error: 'udawana awaria (próba na sucho)', model: 'stub' }
      : { outcome: 'ok', output: parseAnswer(raw.stdout), text: raw.stdout, model: 'stub' };
    return { ...r, raw, expect: d };
  } };
}
// Codex gra na nowym katalogu CODEX_HOME tego meczu (audyt r3 pkt 4)
const codexHome = !checkDir && P.includes('codex') ? freshCodexHome(path.basename(out)) : null;
const players = P.map((kd, i) => (checkDir ? replayer(i) : kd === 'stub' ? stub(i) : modelPlayer(kd, { effort: set.effort, model: set.models[i], home: codexHome })));

// ---- budzenie ----
function fresh() { return { used: 0, sees: false, lostAt: null, hurt: 0, heardAt: -99, status: 'new', until: 0, last: -99, hitWakeAt: -99, camp: 0 }; }
function reasons(k) {
  const b = bodies[k], s = st[k], t = b.clock, r = [];
  if (s.used >= set.cap) return r;
  if (s.used === 0) return ['the round has started'];
  const know = b.know;
  if (know.sees && !s.sees) r.push('you see the enemy');
  if (!know.sees && s.sees) { s.lostAt ??= t; if (t - s.lostAt > 0.5) r.push('you lost sight of the enemy'); }
  else s.lostAt = null;
  // trafienie budzi raz; kolejne z tej samej serii (do HIT_QUIET s) czekają na następny widok jako zdarzenia
  if (b.log.hits.length > s.hurt && t - s.hitWakeAt >= HIT_QUIET) r.push('you were hit');
  const h = b.log.heard.at(-1);
  if (h && !know.sees && h.t > s.heardAt + 3) r.push('you heard a shot');
  if (b.status !== s.status && b.status !== 'in_progress') r.push(b.status.startsWith('failed') ? 'your order failed (' + b.status.slice(8) + ')' : 'your order is done: ' + b.status);
  const camp = e.machine.campLeft(k);
  if (camp !== null && s.camp < CAMP_WAKE.length && camp <= CAMP_WAKE[s.camp]) r.push('SCRIBE camping warning');
  if (t >= s.until) r.push('your order\'s time is up');
  if (r.length && t - s.last < 0.3 && !r.includes('you were hit')) return [];
  return r;
}

// ---- pętla meczu ----
const log = (f, o) => appendFileSync(path.join(out, f), JSON.stringify(o) + '\n');
const fails = [];
// play: numer rozegrania rundy, rośnie także po remisie (powtórka ma ten sam numer rundy; audyt r3 pkt 1: nazwy plików
// surowych odpowiedzi powtórki nadpisywały pliki rundy z remisem). voided: mecz unieważniony przez awarię wywołania
let wasFight = false, step = 0, play = 0, voided = null;
// każde trafienie z dziennika walki gry (także śrut podczas leczenia, audyt r1 pkt 10): trafiony wie skąd, strzelec widzi wskaźnik
combatLog.listen(x => {
  if (x.kind !== 'hit' || e.round.phase !== 'fight' || !bodies[0]) return;
  const k = x.whom === 'A' ? 0 : 1;
  bodies[k].hurt(); bodies[1 - k].marker();
});
e.round.on((kind, d) => {
  if (kind !== 'roundEnd') return;
  const w = d.winner === 'me' ? 0 : d.winner === 'foe' ? 1 : null;
  if (w !== null) wins[playerOf(roundNo, w)]++;
  log('rundy.jsonl', { round: roundNo, winnerSide: w === null ? null : w ? 'B' : 'A', winner: w === null ? null : P[playerOf(roundNo, w)], how: d.how, time: +d.time.toFixed(2), hp: e.fighters.map(f => Math.round(f.hp)) });
  console.log(`RUNDA ${roundNo}: ${w === null ? 'remis (powtórka)' : 'wygrał ' + P[playerOf(roundNo, w)] + ' (strona ' + (w ? 'B' : 'A') + ')'}, ${d.how}, ${d.time.toFixed(1)} s; wynik ${P[0]} ${wins[0]} : ${wins[1]} ${P[1]}`);
});
writeFileSync(path.join(out, 'ustawienia.json'), JSON.stringify({ ...set, salt: undefined, weapon: e.match.weapon, thirdSwap }, null, 1));
console.log(`ziarno ${set.seed}, broń ${e.match.weapon}, ręce ${set.hands}, ${P[0]} (A w rundzie 1) vs ${P[1]}, wyniki: ${out}`);
// mecz: upadek sędziego po starcie gry też unieważnia mecz i zostaje zapisany (decyzje do tej chwili zostają w katalogu);
// odmowa przed startem (np. przed rundą drand) nie jest meczem
const refereeDown = err => {
  writeFileSync(path.join(out, 'koniec.json'), JSON.stringify({ void: { reason: 'referee_error', error: String(err?.stack ?? err).slice(0, 2000) }, winner: null }, null, 1));
  console.log('MECZ UNIEWAŻNIONY: błąd sędziego: ' + (err?.stack ?? err)); process.exit(1);
};
if (matchDir) { process.on('uncaughtException', refereeDown); process.on('unhandledRejection', refereeDown); }
while (Math.max(...wins) < WINS) {
  const fight = e.round.phase === 'fight';
  if (fight && !wasFight) {   // nowa runda (albo powtórka po remisie): nowe ciała, czysta pamięć
    roundNo = e.round.view().round; play++;
    bodies = [0, 1].map(k => B.createBody({ THREE, e, side: k, hands: set.hands, rand: e.rng.stream(`cialo:${roundNo}:${k}:${step}`), hearRand: e.rng.stream(`sluch:${roundNo}:${k}:${step}`) }));
    memo = [0, 1].map(() => ({ note: '', last: null, hpAt: COMBAT.hp, shotsAt: 0 }));
    shots[0].length = shots[1].length = 0; st = [fresh(), fresh()];
  }
  wasFight = fight;
  if (fight) {
    const ask = [0, 1].map(reasons);
    if (ask.some(r => r.length)) {
      const at = e.round.time;
      const res = await Promise.all([0, 1].map(async k => {
        if (!ask[k].length) return null;
        const i = playerOf(roundNo, k), ctx = { play, round: roundNo, side: k ? 'B' : 'A', n: st[k].used + 1 };
        const prompt = `${rules}\n\n---\nYou are fighter ${ctx.side}. Decision ${ctx.n} of this round.\n\n${view(k, ask[k])}\n\nAnswer with one JSON object (your order).`;
        const t0 = Date.now();
        const r = await players[i].decide(prompt, TIMEOUT, { ...ctx, player: i });
        return { k, i, ctx, prompt, r, ms: Date.now() - t0 };
      }));
      for (const x of res) {
        if (!x) continue;
        const { k, i, ctx, r } = x, b = bodies[k], s = st[k];
        // awaria wywołania albo inny model niż w zobowiązaniu: unieważnienie meczu (gra staje po zapisaniu obu decyzji)
        if (!FAILURES.includes(r.outcome) && r.model !== set.models[i]) Object.assign(r, { outcome: 'wrong_model', error: `model ${r.model}, w zobowiązaniu ${set.models[i]}` });
        if (FAILURES.includes(r.outcome) || r.outcome === 'wrong_model') voided ??= { reason: r.outcome, error: r.error ?? null, player: P[i], play, round: roundNo, side: ctx.side, n: ctx.n,
          roundTime: +at.toFixed(2), score: { [P[0]]: wins[0], [P[1]]: wins[1] }, hp: e.fighters.map(f => Math.round(f.hp)) };
        const c = r.outcome === 'ok' ? check(r.output) : { err: r.outcome };
        if (c.order) { b.setOrder(c.order, owners); memo[k].last = c.order; memo[k].note = c.note; }
        memo[k].error = c.err ?? null;   // (zły rozkaz: poprzedni zostaje, model dowie się o błędzie)
        if (ask[k].includes('you were hit')) s.hitWakeAt = b.clock;
        if (ask[k].includes('SCRIBE camping warning')) s.camp++;
        const camp = e.machine.campLeft(k); if (camp === null) s.camp = 0;
        s.used++; s.sees = b.know.sees; s.hurt = b.log.hits.length; s.heardAt = b.clock;
        // (audyt r1 pkt 5: rozkaz nieudany od razu musi obudzić model, więc status porównujemy od „w toku”)
        s.status = c.order ? 'in_progress' : b.status;
        s.until = b.clock + (c.order?.for ?? 3); s.last = b.clock;
        const rawName = `${ctx.play}-${ctx.round}${ctx.side}${String(ctx.n).padStart(3, '0')}.json`;
        const rec = { player: i, name: P[i], play: ctx.play, round: ctx.round, side: ctx.side, n: ctx.n, roundTime: +at.toFixed(2), why: ask[k], ms: x.ms, model: r.model,
          outcome: r.outcome, error: c.err ?? r.error ?? null, order: c.order ?? null, comment: c.comment ?? null, note: c.note ?? null, text: r.text ?? null,
          promptHash: sha(x.prompt), raw: rawName, proof: r.proof ?? null, usage: r.usage ?? null };
        if (checkDir) {
          const d = r.expect, same = JSON.stringify(d.order) === JSON.stringify(rec.order) && d.outcome === rec.outcome && d.text === rec.text && d.model === rec.model;
          if (!same) fails.push(`decyzja ${ctx.round}/${ctx.side}#${ctx.n}: rozkaz z surowej odpowiedzi inny niż w zapisie`);
        } else {
          if (existsSync(path.join(out, 'raw', rawName))) throw new Error('surowa odpowiedź już zapisana: ' + rawName);
          writeFileSync(path.join(out, 'raw', rawName), JSON.stringify({ code: r.raw.code, stdout: r.raw.stdout, stderr: r.raw.stderr, timedOut: r.raw.timedOut, ms: r.raw.ms, session: r.raw.session, stubFail: r.raw.stubFail }));
          writeFileSync(path.join(out, 'raw', rawName.replace('.json', '.prompt.txt')), x.prompt);
        }
        log('decyzje.jsonl', rec);
        console.log(`[r${ctx.round} ${at.toFixed(1)} s] ${ctx.side}=${P[i]}#${ctx.n} (${(x.ms / 1000).toFixed(0)} s, ${ask[k].join(', ')}): ${c.order ? JSON.stringify(c.order) : 'ODRZUCONY ' + c.err} — ${c.comment ?? ''}`);
      }
      if (voided) break;   // ani jednego kroku gry więcej
    }
  }
  const a = fight ? bodies[0].think(DT) : undefined, b = fight ? bodies[1].think(DT) : undefined;
  e.step(DT, { a, b, ta: () => !!bodies[0]?.trigger(), tb: () => !!bodies[1]?.trigger(), active: true });
  const k2 = e.view().k;   // odrzut broni obu stron (silnik oddaje go tylko botom wbudowanym)
  if (fight) { bodies[0].recoil(k2[0]); bodies[1].recoil(k2[1]); }

  if (++step % 1800 === 0) console.log(`  … runda ${roundNo}, czas ${e.round.time.toFixed(1)} s, HP A ${Math.round(e.fighters[0].hp)} B ${Math.round(e.fighters[1].hp)}`);
}
const rec = e.recordingNow;
const end = { void: voided, winner: voided ? null : P[wins[0] > wins[1] ? 0 : 1], wins: { [P[0]]: wins[0], [P[1]]: wins[1] }, rounds: e.round.results.map(r => ({ winner: r.winner, how: r.how, time: +r.time.toFixed(2) })),
  steps: rec.steps.length, stepsHash: sha(JSON.stringify(rec.steps)), finalState: e.hash(), seed: set.seed, weapon: e.match.weapon, players: P, effort: set.effort, hands: set.hands };
if (checkDir) {
  const want = JSON.parse(readFileSync(path.join(checkDir, 'koniec.json'), 'utf8'));
  if (replayAt !== decided.length) fails.push(`decyzji w zapisie ${decided.length}, w powtórce ${replayAt}`);
  for (const f of ['stepsHash', 'finalState', 'winner', 'steps', 'void']) if (JSON.stringify(want[f]) !== JSON.stringify(end[f])) fails.push(`${f}: zapis ${JSON.stringify(want[f])}, powtórka ${JSON.stringify(end[f])}`);
  console.log(fails.length ? 'SPRAWDZENIE: FAIL\n' + fails.join('\n') : `SPRAWDZENIE: PASS (${replayAt} decyzji, ${end.steps} kroków, ten sam wynik: ${end.void ? 'mecz unieważniony, ' + end.void.reason : end.winner})`);
} else {
  writeFileSync(path.join(out, 'koniec.json'), JSON.stringify(end, null, 1));
  writeFileSync(path.join(out, 'zapis.json'), JSON.stringify(rec));
  if (voided) console.log(`MECZ UNIEWAŻNIONY: ${voided.reason} u ${voided.player} (runda ${voided.round}, ${voided.roundTime} s, decyzja ${voided.side}#${voided.n}); stan: ${P[0]} ${wins[0]} : ${wins[1]} ${P[1]}, nikt nie wygrał`);
  console.log('KONIEC', JSON.stringify(end));
}
await sim.close();
process.exit(fails.length ? 1 : 0);
