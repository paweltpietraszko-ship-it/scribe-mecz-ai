// The combat log (task 014): every shot (each pellet), hit (who, whom, zone, damage, HP after), shot stopped by the
// arena on its way to a fighter, medkit, death and round start, with the time since the round started. It records all
// the time (a few small entries a second: the round that felt unfair can be copied afterwards); the test panel shows
// its last lines only while it is open, and copies it whole (the "Copy the log" button). Hook: __theone.combatLog.
import { LOG } from '../data/combat.js';
import { num, t } from '../i18n/index.js';

// task 029: a log's own entries, clock and listeners (task 022: the match, fighter/round.js, keeps a round's and a
// match's entries for its screens). The page has one; on the PvP server each match's engine has its own (sim/engine.js:
// many matches in one process, none sees another's entries, and a match's log goes with its engine)
const scope = () => ({ entries: [], clock: () => 0, listeners: [] });
let cur = scope(), on = LOG.on;

// numbers as text (t() would format them for the language: one decimal is kept here)
const f1 = v => num(Math.round(v * 10) / 10);
// one line for a person to read, in the game's language (i18n/strings.js, log.*); `who`/`whom` are the fighters' keys
// (task 029 K6: in PvP the fighters' keys are the players' nicks: combatLog.names)
let names = null;
function line(e) {
  const name = k => names?.[k] || t('log.name.' + k), zone = z => t('log.zone.' + z);
  const v = { who: name(e.who), whom: e.whom && name(e.whom) };
  const text = {
    round: () => t('log.round', { level: t('level.' + e.level) }),
    hit: () => t('log.hit', { ...v, zone: zone(e.zone), dmg: f1(e.dmg), hp: f1(e.hp), dist: f1(e.dist), killed: e.killed ? t('log.killed') : '' }),
    blocked: () => t('log.blocked', { ...v, at: f1(e.at), dist: f1(e.dist) }),
    miss: () => (e.aimed ? t('log.missAimed', { ...v, zone: zone(e.aimed) }) : t('log.miss', v)),
    heal: () => t(e.start ? 'log.healStart' : 'log.healEnd', { ...v, hp: f1(e.hp), left: String(e.left) }),
    death: () => t('log.death', { ...v, zone: zone(e.zone) }),
  }[e.kind];
  return `${num(e.t, 2).padStart(6)} s  ${text ? text() : e.kind}`;
}

export const combatLog = {
  get on() { return on; },
  set on(v) { on = v; },
  // task 029 (K6): { player, bot } → the nicks shown for those keys (null: the game's names)
  set names(v) { names = v; },
  // fn(): s since the round started
  setClock(fn) { cur.clock = fn; },
  add(e) {
    if (!on) return;
    const x = { t: cur.clock(), ...e };
    cur.entries.push(x);
    if (cur.entries.length > LOG.limit) cur.entries.shift();
    cur.listeners.forEach(fn => fn(x));
  },
  listen(fn) { cur.listeners.push(fn); },
  get entries() { return cur.entries; },
  clear() { cur.entries.length = 0; },
  lines: (n = Infinity) => cur.entries.slice(-n).map(line),
  text: () => cur.entries.map(line).join('\n'),
  // task 029: a new log of its own (scope()), and fn() run with it as the log (then the one before it again)
  scope,
  within(s, fn) { const prev = cur; cur = s; try { return fn(); } finally { cur = prev; } },
};
