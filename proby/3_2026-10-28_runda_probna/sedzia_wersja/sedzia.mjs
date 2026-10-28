// Mecz modeli (próba 28.10.2026): sędzia jednej rundy. Silnik gry bez rysowania (src/sim), dwie postacie prowadzone
// przez modele (cialo.js). Czas gry stoi, gdy model myśli: przy każdym ważnym zdarzeniu sędzia zatrzymuje grę, pokazuje
// modelowi to, co wie jego postać, i bierze rozkaz. Próba kończy się po N decyzjach jednej strony albo z końcem rundy.
//   node probe/mecz_ai/sedzia.mjs --p0 claude --p1 codex [--n 12] [--seed 21] [--effort medium] [--hands normal]
//   (--p0 stub --p1 stub: bez modeli, sprawdzenie samej pętli)
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadSim } from '../../scripts/sim-node.mjs';
import { modelPlayer } from './gracze.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const kinds = [arg('p0', 'stub'), arg('p1', 'stub')], N = +arg('n', 12), SEED = +arg('seed', 21), EFFORT = arg('effort', 'medium');
const HANDS = arg('hands', 'normal'), TIMEOUT = 300000, DT = 1 / 60, NEAR = 15, MAXEL = 20;
const out = path.join(HERE, 'wyniki', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + `_${kinds[0]}-${kinds[1]}`);
mkdirSync(out, { recursive: true });

const sim = await loadSim();
const B = await sim.load('/probe/mecz_ai/cialo.js');
const { WEAPONS, COMBAT } = await sim.load('/src/data/combat.js');
const { MATCH } = await sim.load('/src/data/match.js');
const shots = [[], []];
const e = await sim.engine({ seed: SEED, opt: { bots: false, auto: true, level: 'normal', scribe: true, record: true, names: kinds,
  onShot: (s, side) => { shots[side].push(s); bodies[1 - side]?.hear(s.from); } } });
const bodies = [0, 1].map(k => B.createBody({ e, side: k, hands: HANDS, rand: e.rng.stream('cialo:' + k) }));
const W = WEAPONS[e.match.weapon];

// ---- zasady dla graczy, z liczbami z danych gry ----
const weaponText = `- Weapon this match: **${e.match.weapon === 'karabin' ? 'assault rifle' : e.match.weapon === 'smg' ? 'submachine gun' : e.match.weapon === 'dmr' ? "marksman's rifle" : 'shotgun'}**, ` +
  `${W.mode === 'auto' ? 'automatic' : 'semi-automatic'}, ${W.rpm} shots/min, magazine ${W.magazine}, effective range ${W.falloff ? W.falloff.full + ' m (weak beyond ' + W.falloff.zero + ' m)' : W.range + ' m'}. ` +
  `About ${Math.ceil(COMBAT.hp / (W.damage * (W.pellets?.count ?? 1)))} body hits kill. Moving does not make you less accurate, crouching does not make you more accurate.`;
const rules = readFileSync(path.join(HERE, 'ZASADY_GRACZA.md'), 'utf8').replace('{{WEAPON}}', weaponText).replace('{{HP}}', COMBAT.hp)
  .replace('{{MEDKITS}}', COMBAT.medkits).replace('{{HEAL}}', COMBAT.medkitHeal).replace('{{HEAL_TIME}}', COMBAT.medkitTime)
  .replace('{{RELOAD}}', W.reloadTime).replace('{{ROUND}}', MATCH.roundTime).replace('{{OVERTIME}}', MATCH.overtime);
writeFileSync(path.join(out, 'zasady.md'), rules);

// ---- bryły areny dla modelu: E<id> (elementy SCRIBE), A0–A2 (ramiona obrotnicy) ----
const els = e.machine.mech.els, owners = new Map(), label = el => (el.arm !== undefined ? 'A' + el.arm : 'E' + el.id);
for (const el of els) owners.set(label(el), el.arm !== undefined ? el.id : el.g);
function describe(el, me) {
  const p = { x: el.spec.x, z: el.spec.z }, d = Math.hypot(p.x - me.feet.x, p.z - me.feet.z);
  let shape;
  if (el.arm !== undefined) shape = `turntable arm 3.0 m x 0.4 m (turns with the disc)`;
  else {
    const [w, dd] = el.E.outline, r = el.spec.rotY ?? 0, along = B.bearing(Math.cos(r), -Math.sin(r)) % 180;
    shape = `block ${w.toFixed(1)} m x ${dd.toFixed(1)} m` + (Math.abs(w - dd) > 0.3 ? `, long side along bearing ${w >= dd ? along : (along + 90) % 180}` : '');
  }
  const h = el.pose.h, state = el.phase === 'warn' ? ' — ANNOUNCED: about to move' : el.phase === 'move' ? ' — MOVING' : h < el.H - 0.1 ? ` — sunk to ${h.toFixed(1)} m` : '';
  return { d, text: `${label(el)}: ${shape}, height ${h.toFixed(1)} m (${h >= 1.5 ? 'tall' : h >= 0.8 ? 'low' : 'no cover'}), centre (${B.toXY(p).join(', ')}), ${d.toFixed(1)} m at bearing ${B.bearing(p.x - me.feet.x, p.z - me.feet.z)}${state}` };
}

// ---- widok jednej strony: tylko to, co wie jej postać ----
const memo = [{ note: '', last: null, hpAt: 100, otherHpAt: 100, shotsAt: 0 }, { note: '', last: null, hpAt: 100, otherHpAt: 100, shotsAt: 0 }];
function view(k, why) {
  const b = bodies[k], me = b.me, other = b.other, know = b.know, m = memo[k], now = b.clock;
  const cs = me.coverState.mode, line = me.cover.line, inCover = cs === 'cover' && line ? [...owners].find(([, o]) => o === line.owner)?.[0] : null;
  const L = [];
  L.push(`ROUND TIME: ${e.round.time.toFixed(1)} s of ${MATCH.roundTime} s.`);
  L.push(`YOU: at (${B.toXY(me.feet).join(', ')}), facing bearing ${B.bearingOfYaw(b.view.yaw)}. HP ${Math.round(me.hp)}/${COMBAT.hp}. Medkits ${me.health.medkits}. ` +
    `Magazine ${me.weapon.mag}/${W.magazine}${me.weapon.reload ? ' (reloading)' : ''}. ` +
    `State: ${me.health.healing ? 'healing' : inCover ? `in cover at ${inCover}${line.crouch ? ' (crouched)' : ''}` : me.character.speed.length() > 0.5 ? 'moving' : 'standing in the open'}.`);
  L.push(`YOUR LAST ORDER: ${m.last ? JSON.stringify(m.last) : '(none yet: the round has just started)'}. Status: ${m.last ? b.status : '-'}.`);
  L.push(`WHY YOU ARE ASKED NOW: ${why.join('; ')}.`);
  if (know.sees) L.push(`ENEMY: SEEN NOW at (${B.toXY(other.feet).join(', ')}), ${Math.hypot(other.feet.x - me.feet.x, other.feet.z - me.feet.z).toFixed(1)} m at bearing ${B.bearing(other.feet.x - me.feet.x, other.feet.z - me.feet.z)}, ` +
    `${other.coverState.mode === 'cover' ? 'in cover' : other.character.speed.length() > 0.5 ? 'moving' : 'standing'}, its HP bar shows about ${Math.round(other.hp / 5) * 5} HP.`);
  else if (know.where) L.push(`ENEMY: not seen now. Last known at (${B.toXY(know.where).join(', ')}) ${(now - know.when).toFixed(1)} s ago, ${know.how === 'sound' ? 'from the sound of its shots (about 3 m accurate)' : 'seen'}.`);
  else L.push('ENEMY: not seen yet, no idea where it is.');
  const ev = [];
  const hits = b.log.hits.splice(0), lost = Math.round(m.hpAt - me.hp);
  if (hits.length) ev.push(`you were hit ${hits.length} time(s), lost ${lost} HP, shots came from bearing(s) ${[...new Set(hits.map(h => Math.round(h.from / 10) * 10))].join(', ')}`);
  const heard = b.log.heard.splice(0);
  if (heard.length) ev.push(`you heard ${heard.length} enemy shot(s), last near (${B.toXY(heard.at(-1)).join(', ')})`);
  const fired = shots[k].length - m.shotsAt, dealt = Math.round(m.otherHpAt - other.hp);
  if (fired) ev.push(`you fired ${fired} shot(s)${dealt > 0 ? `, hit markers: the enemy lost about ${dealt} HP` : ', no hit markers'}`);
  L.push(`SINCE YOUR LAST DECISION: ${ev.length ? ev.join('; ') : 'nothing new'}.`);
  m.hpAt = me.hp; m.otherHpAt = other.hp; m.shotsAt = shots[k].length;
  const camp = e.machine.campLeft(k);
  const sc = [];
  if (camp !== null && camp <= 5) sc.push(`CAMPING WARNING: walls within 12 m of you sink in ${camp.toFixed(1)} s unless you move more than 6 m away`);
  L.push(`SCRIBE: ${sc.length ? sc.join('; ') : 'no warning for you'}.`);
  const near = els.map(el => describe(el, me)).filter(x => x.d <= NEAR).sort((a, c) => a.d - c.d).slice(0, MAXEL);
  L.push(`ELEMENTS WITHIN ${NEAR} m, nearest first:`, ...near.map(x => '- ' + x.text));
  L.push(`YOUR NOTE: ${m.note || '(empty)'}`);
  return L.join('\n');
}

// ---- rozkaz: sprawdzenie (zły rozkaz = poprzedni zostaje) ----
const num = v => typeof v === 'number' && Number.isFinite(v);
function check(o) {
  if (!o || typeof o !== 'object') return { err: 'not an object' };
  const r = {};
  if (o.move === 'stay' || o.move === 'leave_cover') r.move = o.move;
  else if (Array.isArray(o.move?.to) && num(o.move.to[0]) && num(o.move.to[1])) r.move = { to: [o.move.to[0], o.move.to[1]] };
  else if (typeof o.move?.cover === 'string' && owners.has(o.move.cover)) r.move = { cover: o.move.cover };
  else return { err: 'bad move ' + JSON.stringify(o.move) };
  if (Array.isArray(o.against) && num(o.against[0]) && num(o.against[1])) r.against = [o.against[0], o.against[1]];
  r.fire = ['at_enemy', 'hold', 'blind'].includes(o.fire) ? o.fire : 'at_enemy';
  if (num(o.look)) r.look = ((Math.round(o.look) % 360) + 360) % 360;
  for (const f of ['sprint', 'medkit', 'reload']) if (o[f] === true) r[f] = true;
  if (o.dodge === 'left' || o.dodge === 'right') r.dodge = o.dodge;
  r.for = num(o.for) ? Math.min(5, Math.max(1, o.for)) : 3;
  return { order: r, comment: String(o.comment ?? '').slice(0, 300), note: String(o.note ?? '').slice(0, 300) };
}

// ---- gracze ----
function stub(k) {   // bez modelu: idź ku środkowi, chowaj się przy najbliższej bryle, gdy widzisz przeciwnika
  return { kind: 'stub', async decide(prompt) {
    const sees = /ENEMY: SEEN NOW/.test(prompt), near = /- (E\d+): [^\n]*\(tall\)/.exec(prompt.split('ELEMENTS')[1] ?? '');
    const o = sees && near ? { move: { cover: near[1] }, fire: 'at_enemy', comment: 'stub: cover' } : { move: { to: [k ? -4 : 4, -5] }, fire: 'at_enemy', comment: 'stub: forward' };
    return { outcome: 'ok', output: o, text: JSON.stringify(o), model: 'stub' };
  } };
}
const players = kinds.map((kd, k) => (kd === 'stub' ? stub(k) : modelPlayer(kd, { effort: EFFORT })));

// ---- pętla ----
const HIT_QUIET = 1.0;
const st = [0, 1].map(() => ({ used: 0, sees: false, lostAt: null, hurt: 0, heardAt: -99, status: 'new', until: 0, last: -99, hitWakeAt: -99 }));
function reasons(k) {
  const b = bodies[k], s = st[k], t = b.clock, r = [];
  if (s.used >= N) return r;
  if (s.used === 0) return ['the round has started'];
  const know = b.know;
  if (know.sees && !s.sees) r.push('you see the enemy');
  if (!know.sees && s.sees) { s.lostAt ??= t; if (t - s.lostAt > 0.5) r.push('you lost sight of the enemy'); }
  else s.lostAt = null;
  // trafienie budzi raz; kolejne z tej samej serii (do HIT_QUIET s) czekają na następny widok jako zdarzenia
  if (b.log.hits.length > s.hurt && t - s.hitWakeAt >= HIT_QUIET) r.push('you were hit');
  const h = b.log.heard.at(-1);
  if (h && !know.sees && h.t > s.heardAt + 3) r.push('you heard a shot');
  if (b.status !== s.status && b.status !== 'in_progress') r.push(b.status.startsWith('failed') ? 'your order failed' : 'your order is done: ' + b.status);
  const camp = e.machine.campLeft(k);
  if (camp !== null && camp <= 5 && !s.campWarned) r.push('SCRIBE camping warning');
  if (t >= s.until) r.push('your order\'s time is up');
  if (r.length && t - s.last < 0.3 && !r.includes('you were hit')) return [];
  return r;
}
const log = (f, o) => appendFileSync(path.join(out, f), JSON.stringify(o) + '\n');
let started = false, done = false, step = 0;
console.log(`seed ${SEED}, broń ${e.match.weapon}, ręce ${HANDS}, gracze ${kinds.join(' vs ')}, N=${N}, wyniki: ${out}`);
let hpSeen = [100, 100];
while (!done) {
  const fight = e.round.phase === 'fight';
  if (fight) {
    started = true;
    const ask = [0, 1].map(reasons);
    if (ask.some(r => r.length)) {
      const at = e.round.time;
      const res = await Promise.all([0, 1].map(async k => {
        if (!ask[k].length) return null;
        const prompt = `${rules}\n\n---\nYou are fighter ${k ? 'B' : 'A'}. Decision ${st[k].used + 1}.\n\n${view(k, ask[k])}\n\nAnswer with one JSON object (your order).`;
        const t0 = Date.now();
        const r = await players[k].decide(prompt, TIMEOUT);
        return { k, prompt, r, ms: Date.now() - t0 };
      }));
      for (const x of res) {
        if (!x) continue;
        const { k, r } = x, b = bodies[k], s = st[k], c = r.outcome === 'ok' ? check(r.output) : { err: r.outcome };
        if (c.order) { b.setOrder(c.order, owners); memo[k].last = c.order; memo[k].note = c.note; }
        if (ask[k].includes('you were hit')) s.hitWakeAt = b.clock;
        s.used++; s.sees = b.know.sees; s.hurt = b.log.hits.length; s.heardAt = b.clock; s.status = b.status;
        s.until = b.clock + (c.order?.for ?? 3); s.last = b.clock; s.campWarned = (e.machine.campLeft(k) ?? 99) <= 5;
        log('decyzje.jsonl', { side: k ? 'B' : 'A', n: s.used, roundTime: +at.toFixed(2), why: ask[k], ms: x.ms, model: r.model, outcome: r.outcome, error: c.err ?? r.error ?? null,
          order: c.order ?? null, comment: c.comment ?? null, note: c.note ?? null, text: r.text ?? null, prompt: x.prompt, proof: r.proof ?? null, usage: r.usage ?? null });
        console.log(`[${at.toFixed(1)} s] ${k ? 'B' : 'A'}#${s.used} (${(x.ms / 1000).toFixed(0)} s, ${ask[k].join(', ')}): ${c.order ? JSON.stringify(c.order) : 'ODRZUCONY ' + c.err} — ${c.comment ?? ''}`);
      }
    }
    // koniec próby: obie strony wyczerpały decyzje
    if (st.every(s => s.used >= N)) done = true;
  } else if (started) done = true;   // runda skończona
  const a = fight ? bodies[0].think(DT) : null, b = fight ? bodies[1].think(DT) : null;
  const r = e.step(DT, { a: a ?? undefined, b: b ?? undefined, ta: () => bodies[0].trigger(), tb: () => bodies[1].trigger(), active: true });
  const k2 = e.view().k;   // odrzut broni obu stron (silnik oddaje go tylko botom wbudowanym)
  if (fight) { bodies[0].recoil(k2[0]); bodies[1].recoil(k2[1]); }
  [0, 1].forEach(k => { const hp = e.fighters[k].hp; if (hp < hpSeen[k] - 1e-6 && fight) bodies[k].hurt(); hpSeen[k] = hp; });
  void r;
  if (++step % 600 === 0) console.log(`  … czas rundy ${e.round.time.toFixed(1)} s, HP A ${Math.round(e.fighters[0].hp)} B ${Math.round(e.fighters[1].hp)}`);
}
const end = { roundTime: +e.round.time.toFixed(2), phase: e.round.phase, hp: e.fighters.map(f => Math.round(f.hp)), decisions: st.map(s => s.used), seed: SEED, weapon: e.match.weapon, hands: HANDS, players: kinds, effort: EFFORT };
writeFileSync(path.join(out, 'koniec.json'), JSON.stringify(end, null, 1));
writeFileSync(path.join(out, 'zapis.json'), JSON.stringify(e.recordingNow ?? e.recording));
console.log('KONIEC', JSON.stringify(end));
await sim.close();
process.exit(0);
