// The match (task 022; rounds since task 009): one state object, worked out without drawing (A5), which the screens,
// the music and the HUD only read (E1: in PvP a server will send the same state and events). Phases:
//   menu       the start screen; the fighters stand at their spawn points
//   countdown  before a round (the first one of a match shows the weapon); the fighters stand
//   fight      the round: MATCH.roundTime, then the overtime (MATCH.overtime; SCRIBE's final phase starts with it)
//   card       after a round, MATCH.card s; then the next countdown, or the match's result
//   end        the match's result; again() starts a new match (a new seed and weapon), leave() the start screen
//   range      the Dummy level: no match, a shooting range as before (the Dummy comes back after DUMMY.respawn)
// A round ends with a death, or after the overtime with more health; equal health: the round does not count and is
// played again. A match ends when a side has MATCH.winsToWin rounds. The card's facts come from the combat log (014).
// Events (on(fn), fn(kind, data)): matchStart, countdown, roundStart, roundEnd, matchEnd, menu, range.
import { PLAYER, MATCH_SPAWN } from '../data/arena.js';
import { combatLog } from '../combat/log.js';
import { BOT, DUMMY, LEVELS, LEVEL_ORDER } from '../data/bot.js';
import { MATCH } from '../data/match.js';

const KEY = 'theone.botLevel';
function stored() {
  try { const k = localStorage.getItem(KEY); if (LEVEL_ORDER.includes(k)) return k; } catch { /* storage blocked */ }
  return BOT.level;
}

// where the player starts: PLAYER.spawn on the Dummy level (the shooting range, the screenshots), the match's spawn
// point otherwise (task 011)
const playerSpawn = key => (LEVELS[key].passive ? PLAYER.spawn : MATCH_SPAWN.player);
// where the opponent stands: the Dummy's place, facing the player's spawn point, or its own spawn point
function foeSpawn(key) {
  if (!LEVELS[key].passive) return MATCH_SPAWN.foe;
  const { x, z } = DUMMY.spawn;
  return { x, z, yaw: Math.atan2(PLAYER.spawn.x - x, PLAYER.spawn.z - z) - Math.PI };
}

// player, foe: the fighters; bot: the foe's bot; onReset(yaw): the player's camera and controls back to the start;
// level: forced level (?botvbot and tests), else the stored one; auto: the match starts at once (no start screen: the
// tests, ?freeze, ?botvbot); autoAgain: after the result the next match starts by itself (?botvbot);
// prepare(): before every match but the first, a new seed and weapon (may return a promise: the weapon's model loads);
// ready(): task 024, before the first match: everything the match needs (a promise while something still loads)
export function createRound({ player, foe, bot, onReset = () => {}, level = stored(), auto = false, autoAgain = false, prepare = () => {}, ready = () => null }) {
  let current = level, pending = level;
  let phase = 'menu', left = 0, time = 0, round = 1, matches = 0, deadFor = 0;
  let wins = { me: 0, foe: 0 }, results = [], card = null, winner = null, walkover = false;
  let roundLog = [], matchLog = [];   // the combat log's entries of this round and of this match
  // cumulative over the matches (the test panel, ?botvbot): rounds won by each side, rounds played again
  const score = { me: 0, foe: 0, draws: 0 };
  // the player's data in the match (E1, task 023 A3): what PvP will send to the other side (nothing is sent today)
  const me = { nick: '', character: null };
  const listeners = [];
  const emit = (kind, data = {}) => listeners.forEach(fn => fn(kind, data));
  combatLog.setClock(() => time);   // task 014: the combat log's times
  combatLog.listen(e => { if (phase === 'fight') { roundLog.push(e); matchLog.push(e); } });
  const passive = () => !!LEVELS[current].passive;

  // both back to their spawn points with full health, magazine and medkits
  function place() {
    bot.setLevel(current); foe.passive = passive();
    player.reset(playerSpawn(current)); foe.reset(foeSpawn(current)); bot.reset();
    onReset(playerSpawn(current).yaw);
  }
  function countdown() {
    const first = !results.length;
    phase = 'countdown'; time = 0; card = null;
    left = first ? MATCH.firstCountdown : MATCH.countdown;
    place(); emit('countdown', { round, first });
  }
  function begin() {
    current = pending; wins = { me: 0, foe: 0 }; results = []; matchLog = []; round = 1; winner = null; card = null; walkover = false;
    if (passive()) { phase = 'range'; time = 0; place(); combatLog.add({ kind: 'round', level: current }); emit('range'); return; }
    matches++;
    emit('matchStart', { level: current });
    countdown();
  }
  // a new match: from the second one on, a new seed and weapon first (phase 'loading' while its model loads); task 024:
  // the first one waits until the match's files and shaders are ready (K3: the round never starts without them)
  // (task 033: gives a promise kept when the match has begun: PvP's search waits for it, net/pvp.js)
  function startMatch() {
    if (phase === 'loading') return;
    const wait = matches ? prepare() : ready();
    if (!wait) { begin(); return; }
    phase = 'loading';
    return Promise.resolve(wait).then(begin, err => { console.error(err); begin(); });
  }
  function fight() {
    phase = 'fight'; time = 0; roundLog = [];
    combatLog.add({ kind: 'round', level: current });
    emit('roundStart', { round });
  }

  // the card's facts, from the combat log of this round: only what both sides may know (pillar 2: no way or place of
  // the other). zone, dist: the winner's last hit; took: the three last hits the player took (zone, damage, distance)
  // (task 027: mine, theirs: the fighters as one side sees them; the PvP server makes them for both sides)
  function facts(who, mine = player, theirs = foe) {
    const me = mine.name, other = theirs.name, hitsOn = name => roundLog.filter(e => e.kind === 'hit' && e.whom === name);
    const last = who ? hitsOn(who === 'me' ? other : me).at(-1) : null;
    return {
      zone: last?.zone ?? null, dist: last ? Math.round(last.dist) : null,
      hp: Math.round(mine.hp), foeHp: Math.round(theirs.hp),
      took: hitsOn(me).slice(-3).map(e => ({ zone: e.zone, dmg: Math.round(e.dmg), dist: Math.round(e.dist) })),
    };
  }
  const other = who => (who === 'me' ? 'foe' : who === 'foe' ? 'me' : who);
  // how: 'kill' | 'time' (more health after the overtime) | 'equal' (the round is played again)
  function end(who, how) {
    const result = { round, winner: who, how, time, overtime: time > MATCH.roundTime, ...facts(who) };
    // task 027: the same facts as the other side sees them (the PvP window of side B: fighter/perspective.js)
    Object.defineProperty(result, 'b', { value: facts(other(who), foe, player), enumerable: true });
    results.push(result);
    if (who) { wins[who]++; score[who]++; round++; } else score.draws++;
    card = result; phase = 'card'; left = MATCH.card;
    emit('roundEnd', result);
  }

  // the player's numbers over the match (the result's statistics)
  function stats(f = player) {
    const mine = matchLog.filter(e => e.who === f.name);
    const shots = mine.filter(e => e.kind === 'hit' || e.kind === 'miss' || e.kind === 'blocked').length;
    const hits = mine.filter(e => e.kind === 'hit').length;
    return { shots, hits, accuracy: shots ? Math.round(100 * hits / shots) : 0,
      heads: mine.filter(e => e.kind === 'hit' && e.zone === 'head').length,
      medkits: mine.filter(e => e.kind === 'heal' && e.start).length };
  }

  function update(dt) {
    if (phase === 'range') {
      time += dt;
      if (!player.alive) { if ((deadFor += dt) >= BOT.roundReset) { deadFor = 0; begin(); } return; }
      if (foe.alive) { deadFor = 0; return; }
      const free = Math.hypot(player.feet.x - foe.spawn.x, player.feet.z - foe.spawn.z) > 2 * PLAYER.radius + PLAYER.skin;
      if ((deadFor += dt) >= DUMMY.respawn && free) { deadFor = 0; foe.reset(); bot.reset(); }
      return;
    }
    if (phase === 'countdown') { if ((left -= dt) <= 0) fight(); return; }
    if (phase === 'fight') {
      time += dt;
      // both dead in the same step: no winner, the round is played again (shown as equal health)
      if (!player.alive || !foe.alive) { end(player.alive ? 'me' : foe.alive ? 'foe' : null, player.alive || foe.alive ? 'kill' : 'equal'); return; }
      if (time >= MATCH.roundTime + MATCH.overtime) {
        const a = Math.round(player.hp), b = Math.round(foe.hp);
        end(a > b ? 'me' : b > a ? 'foe' : null, a === b ? 'equal' : 'time');
      }
      return;
    }
    if (phase === 'card') {
      if ((left -= dt) > 0) return;
      if (Math.max(wins.me, wins.foe) >= MATCH.winsToWin) {
        winner = wins.me > wins.foe ? 'me' : 'foe'; phase = 'end'; left = MATCH.autoAgain;
        emit('matchEnd', { winner, wins: { ...wins }, results, stats: stats(), statsB: stats(foe) });
      } else countdown();
      return;
    }
    if (phase === 'end' && autoAgain && (left -= dt) <= 0) startMatch();
  }

  if (auto) begin(); else place();

  return {
    update, score, stats, me,
    // the state the screens read (E1)
    get phase() { return phase; },
    get round() { return round; },
    get time() { return time; },
    get left() { return left; },                       // s left of the countdown or the card
    get overtime() { return phase === 'fight' && time >= MATCH.roundTime; },
    // the clock shown: the round's time left, then the overtime's
    get clock() { return Math.max(0, (time < MATCH.roundTime ? MATCH.roundTime : MATCH.roundTime + MATCH.overtime) - time); },
    get wins() { return wins; },
    get results() { return results; },
    get card() { return card; },
    get winner() { return winner; },
    get matches() { return matches; },
    // the fighters act (the countdown, the card and the screens: they stand)
    get fighting() { return phase === 'fight' || phase === 'range'; },
    // SCRIBE and the tests (debug/botvbot.js): null while a round is fought
    get over() { return phase === 'fight' || phase === 'range' ? null : 0; },
    get level() { return current; },
    get pending() { return pending; },
    on(fn) { listeners.push(fn); },
    startMatch,
    // the result's "Leave", the pause's "Leave match": the start screen (from the Dummy level too)
    leave() { phase = 'menu'; card = null; current = pending; place(); emit('menu'); },
    // the pause's choice: kept in the browser; on the Dummy level it starts when the pause closes, else with the next match
    choose(key) {
      pending = key;
      try { localStorage.setItem(KEY, key); } catch { /* storage blocked */ }
    },
    resume() { if (pending !== current && phase === 'range') begin(); },
    skip(s) { time += s; },   // test scripts (task 012): the round's clock forward
    // task 029 (the PvP server, K5): the other player left or did not come back: `who` wins the match at once (the
    // rounds won so far stay as they were; the result says it was a walkover)
    forfeit(who) {
      if (phase === 'end' || phase === 'menu') return;
      winner = who; walkover = true; phase = 'end'; card = null; left = MATCH.autoAgain;
      emit('matchEnd', { winner, wins: { ...wins }, results, stats: stats(), statsB: stats(foe), walkover: true });
    },
    get walkover() { return walkover; },
    // task 027 (K1): the match's state as the PvP server sends it, and as a window shows it (fighter/perspective.js
    // turns it for side B); replay(kind, data): the server's events, to this page's listeners (the screens, the music)
    view: () => ({ phase, left, time, round, matches, wins: { ...wins }, results, card, winner, current, pending, score: { ...score }, walkover }),
    show(v) {
      ({ phase, left, time, round, matches, card, winner, current, pending } = v);
      walkover = !!v.walkover;
      wins = { ...v.wins }; results = v.results; Object.assign(score, v.score);
    },
    replay: (kind, data) => emit(kind, data),
  };
}
