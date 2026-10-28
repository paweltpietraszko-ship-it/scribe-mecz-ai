// The match's screens (task 022), 1:1 from reference/ekrany_meczu.html: the start, the weapon and the countdown, the
// round's clock with the match's score, the overtime, the card after a round, time up, equal health and the match's
// result. They only read the match's state (fighter/round.js) and its events (E1: in PvP a server sends the same);
// they never ask the bot or the physics. The opponent is "the opponent" with its name (for the bot: its level).
// The page is written only when a value changes; hidden (another view, the pause's test panel), nothing is done.
// Pad: up / down (d-pad or stick) choose, left / right change, A confirms, B leaves the result; keyboard: arrows,
// Enter, Backspace leaves the result; the mouse works too.
import './screens.css';
import { INPUT } from '../data/arena.js';
import { LEVEL_ORDER } from '../data/bot.js';
import { COMBAT, WEAPONS } from '../data/combat.js';
import { CHARACTERS } from '../data/hero.js';
import { MATCH } from '../data/match.js';
import { t, getLang } from '../i18n/index.js';
import { inApp, quitApp } from './install.js';
import { myPad } from '../player/pad.js';
import { STORY } from '../data/story.js';
import { asset } from '../asset.js';

const PAD = { up: 12, down: 13, left: 14, right: 15, a: 0, b: 1 };
const STICK = 0.6;
const NICK = 'theone.nick';
const $ = id => document.getElementById(id);
const mmss = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const clock = s => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const plural = (key, n) => t(`${key}.${new Intl.PluralRules(getLang()).select(n)}`, { n });
const pips = (el, won) => { el.innerHTML = Array.from({ length: MATCH.winsToWin }, (_, i) => `<i${i < won ? ' class="on"' : ''}></i>`).join(''); };

// round: the match's state; weapon(): the match's weapon key; onPlay(byPad), onAgain(), onLeave(), onControls(),
// onSettings(): the screens' buttons; characters: look/characters.js (task 023: the start screen's character)
// pvp: net/pvp.js (task 027: the mode "Vs player", its word under the screen, B / Esc taking back the waiting)
// task 029: onInvite(byPad): "Play a friend" (a private room's link, K3); the PvP note over the game (#pvpNote, the HUD's
// style: Paweł 03.10.2026)
export function createScreens({ round, weapon, onPlay, onInvite = () => {}, onAgain, onLeave, onControls, onSettings, characters, pvp = null }) {
  const root = $('match'), nick = $('mNick'), levels = $('mLevels');
  // task 026: Leave the game only in the installed app
  root.querySelector('[data-row="exit"]').hidden = !inApp;
  // (task 029: "Play a friend" shows in the mode "Vs player" only: the rows are taken again when the mode changes)
  const allRows = [...root.querySelectorAll('.st [data-row]')].filter(r => !r.hidden || r.dataset.row === 'invite');
  let rows = allRows.filter(r => r.dataset.row !== 'invite');
  let sel = rows.findIndex(r => r.dataset.row === 'play'), state = null, last = {}, stats = null, prev = [], stickY = true, stickX = true;
  let preview = null;   // a sample state instead of the match's (the screenshots: debug/screens.js)

  $('mVer').textContent = typeof __THEONE_BUILD__ === 'string' ? __THEONE_BUILD__ : '';   // task 026: the build's number
  try { nick.value = localStorage.getItem(NICK) ?? ''; } catch { /* storage blocked */ }
  round.me.nick = nick.value.trim();
  nick.addEventListener('input', () => { round.me.nick = nick.value.trim(); try { localStorage.setItem(NICK, round.me.nick); } catch { /* storage blocked */ } });
  // task 023: the character, left / right (its arrows with the mouse)
  // (task 027: in PvP the character is the one taken into the room: fixed while this window is in one, audit 029 F3)
  const stepCharacter = d => { if (pvp?.connected) return; characters?.step(d); last.char = null; };
  const toggleMode = () => {
    pvp?.toggle(); last.mode = null;
    const on = !!pvp?.mode, inv = root.querySelector('[data-row="invite"]');
    if (inv) inv.hidden = !on;
    const at = rows[sel]; rows = allRows.filter(r => r.dataset.row !== 'invite' || on); sel = Math.max(0, rows.indexOf(at)); select(sel);
  };
  root.querySelector('.chips.mode').addEventListener('click', toggleMode);
  $('pvpNote').addEventListener('click', () => pvp?.take());
  root.querySelectorAll('.chooser i').forEach(i => i.addEventListener('click', () => stepCharacter(+i.dataset.d)));
  if (pvp?.mode) { root.querySelector('[data-row="invite"]').hidden = false; rows = allRows; }
  levels.innerHTML = LEVEL_ORDER.map(k => `<span data-level="${k}" data-i18n="level.${k}">${t('level.' + k)}</span>`).join('');
  levels.addEventListener('click', e => { const k = e.target.dataset.level; if (k) { round.choose(k); last.level = null; } });
  round.on((kind, data) => { if (kind === 'matchEnd') stats = data.stats; });

  const put = (key, v, f) => { if (last[key] !== v) { last[key] = v; f(v); } };
  const text = (id, v) => put(id, v, x => { $(id).textContent = x; });
  const now = () => preview ?? round;
  // (task 029 K6: the other player's nick; task 030 K6: against the bot "Bot", not the level's name)
  const foeName = () => pvp?.otherNick ?? t('hud.foe.double');
  const wpn = m => WEAPONS[m.weapon ?? weapon()];

  function select(i) { sel = (i + rows.length) % rows.length; rows.forEach((r, k) => r.classList.toggle('sel', k === sel)); }
  function act(row, byPad) {
    if (row === 'play') onPlay(byPad);
    else if (row === 'invite') onInvite(byPad);
    else if (row === 'controls') onControls();
    else if (row === 'settings') onSettings();
    else if (row === 'mode') toggleMode();
    else if (row === 'exit') quitApp();
    else if (row === 'story') openStory(byPad);
    else if (row === 'nick' && !byPad) nick.focus();
  }
  // task 033 (D2): the story's PDF in the game's language, a new tab. A pad's press is not a click for the browser,
  // which may then refuse the new tab: the row says to click it
  function openStory(byPad) {
    const w = open(asset(STORY[getLang()] ?? STORY.en), '_blank');
    if (w) { w.opener = null; return; }
    const label = root.querySelector('[data-row="story"]');
    label.textContent = t('m.storyClick'); setTimeout(() => { label.textContent = t('m.story'); }, 4000);
  }
  function stepLevel(d) {
    const i = LEVEL_ORDER.indexOf(round.pending);
    round.choose(LEVEL_ORDER[(i + d + LEVEL_ORDER.length) % LEVEL_ORDER.length]); last.level = null;
  }
  // (every row, "Play a friend" too, hidden at first; the row's place among those shown is found when the mouse comes)
  allRows.forEach(r => {
    r.addEventListener('mouseenter', () => { const i = rows.indexOf(r); if (i >= 0) select(i); });
    if (['play', 'invite', 'controls', 'settings', 'story', 'exit'].includes(r.dataset.row)) r.addEventListener('click', () => act(r.dataset.row, false));
  });
  root.querySelector('[data-act="again"]').addEventListener('click', () => onAgain());
  root.querySelector('[data-act="leave"]').addEventListener('click', () => onLeave());

  addEventListener('keydown', e => {
    if (document.body.classList.contains('paused')) return;
    const s = state, typing = document.activeElement === nick;
    if (s === 'start') {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') { if (typing) nick.blur(); select(sel + (e.code === 'ArrowUp' ? -1 : 1)); }
      else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !typing && rows[sel].dataset.row === 'level') stepLevel(e.code === 'ArrowLeft' ? -1 : 1);
      else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !typing && rows[sel].dataset.row === 'character') stepCharacter(e.code === 'ArrowLeft' ? -1 : 1);
      else if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && !typing && rows[sel].dataset.row === 'mode') toggleMode();
      else if ((e.code === 'Escape' || e.code === 'Backspace') && !typing && pvp?.holdsBack) pvp.cancel();
      else if (e.code === 'Enter') { if (typing) nick.blur(); act(typing ? 'play' : rows[sel].dataset.row, false); }
      else return;
      e.preventDefault();
    } else if (s === 'mwin' || s === 'mlose') {
      if (e.code === 'Enter' || e.code === 'Space') onAgain();
      else if (e.code === 'Backspace') onLeave();
      else return;
      e.preventDefault();
    }
  });

  // the pad, every frame while a screen with choices shows (its buttons as they were when it appeared act only
  // after they are let go)
  const connectedPad = () => myPad();
  function poll(fresh) {
    const pad = connectedPad();
    if (!pad) return;
    const down = pad.buttons.map(b => b.pressed), was = fresh ? down : prev, edge = i => down[i] && !was[i];
    prev = down;
    const x = pad.axes[INPUT.pad.move[0]] ?? 0, y = pad.axes[INPUT.pad.move[1]] ?? 0;
    if (fresh) { stickX = Math.abs(x) > STICK / 2; stickY = Math.abs(y) > STICK / 2; return; }
    let dy = edge(PAD.up) ? -1 : edge(PAD.down) ? 1 : 0, dx = edge(PAD.left) ? -1 : edge(PAD.right) ? 1 : 0;
    if (Math.abs(y) > STICK && !stickY) { stickY = true; dy = y > 0 ? 1 : -1; } else if (Math.abs(y) < STICK / 2) stickY = false;
    if (Math.abs(x) > STICK && !stickX) { stickX = true; dx = x > 0 ? 1 : -1; } else if (Math.abs(x) < STICK / 2) stickX = false;
    if (state === 'start') {
      if (dy) select(sel + dy);
      if (dx && rows[sel].dataset.row === 'level') stepLevel(dx);
      if (dx && rows[sel].dataset.row === 'character') stepCharacter(dx);
      if (dx && rows[sel].dataset.row === 'mode') toggleMode();
      if (edge(PAD.b) && pvp?.holdsBack) pvp.cancel();
      if (edge(PAD.a)) act(rows[sel].dataset.row, true);
    } else if (edge(PAD.a)) onAgain();
    else if (edge(PAD.b)) onLeave();
  }

  // the state shown, from the match's phase (the reference's frame[data-s])
  function stateOf(m) {
    switch (m.phase) {
      case 'menu': return 'start';
      case 'countdown': return m.results.length ? 'count' : 'weapon';
      case 'fight': return m.overtime ? 'ot' : 'fight';
      case 'card': return m.card.how === 'equal' ? 'replay' : m.card.how === 'time' ? 'hpcall' : m.card.winner === 'me' ? 'rwin' : 'rlose';
      case 'end': return m.winner === 'me' ? 'mwin' : 'mlose';
      case 'loading': return m.winner ? (m.winner === 'me' ? 'mwin' : 'mlose') : 'start';   // task 024: the first match waits on the start screen
      default: return 'range';
    }
  }

  const modes = [...root.querySelectorAll('.chips.mode span')];
  function start() {
    // (task 030 K6: in PVP the level is the bot's while looking for an opponent, 029 K4)
    put('mode', !!pvp?.active + getLang(), () => {
      const on = !!pvp?.active;
      modes[0].className = on ? 'off' : 'on'; modes[1].className = on ? 'on' : 'off';
      const lbl = $('mLevelLbl'), key = on ? 'm.levelPvp' : 'm.levelLabel';
      lbl.dataset.i18n = key; lbl.textContent = t(key);
    });
    // (audit 023 F1: ?suit=dzis is off the list: its own text, char.dzis)
    if (characters) put('char', characters.key + getLang(), () => { $('mChar').textContent = t(CHARACTERS[characters.key]?.name ?? 'char.' + characters.key); });
    put('level', now().pending, k => levels.querySelectorAll('span').forEach(s => s.classList.toggle('on', s.dataset.level === k)));
    put('rules', getLang(), () => {
      $('mR1').textContent = t('m.r1', { wins: MATCH.winsToWin, best: 2 * MATCH.winsToWin - 1 });
      $('mR2').textContent = t('m.r2', { round: mmss(MATCH.roundTime), ot: mmss(MATCH.overtime) });
      nick.placeholder = t('m.nickDefault');
      levels.querySelectorAll('span').forEach(s => { s.textContent = t('level.' + s.dataset.level); });
    });
  }
  function countdown(m) {
    text('wRound', t('m.round', { n: m.round }));
    text('wName', t(wpn(m).name));
    text('wKit', plural('m.kit', COMBAT.medkits));
    text('wCount', String(Math.max(1, Math.ceil(m.left))));
  }
  function fight(m) {
    text('mClock', clock(m.clock));
    text('mRound', t('m.round', { n: m.round }));
    put('pips', `${m.wins.me}:${m.wins.foe}`, () => { pips($('mPipsMe'), m.wins.me); pips($('mPipsFoe'), m.wins.foe); });
  }
  // the next round starts after the card and the countdown; the last card leads to the result
  const until = m => Math.max(wonMatch(m) ? 0 : MATCH.countdown, 0) + m.left;
  const wonMatch = m => Math.max(m.wins.me, m.wins.foe) >= MATCH.winsToWin;
  function card(m, s) {
    const c = m.card, lose = s === 'rlose';
    put('card', c, () => {
      root.querySelectorAll('.foename').forEach(n => { n.textContent = foeName(); });
      if (s === 'rwin' || s === 'rlose') {
        $('rPanel').classList.toggle('foe', lose);
        $('rTitle').textContent = t(lose ? 'm.rlose' : 'm.rwin');
        $('rMe').textContent = m.wins.me; $('rFoe').textContent = m.wins.foe;
        pips($('rPipsMe'), m.wins.me); pips($('rPipsFoe'), m.wins.foe);
        $('rFacts').hidden = lose; $('rHits').hidden = !lose;
        $('rZone').textContent = c.zone ? t('m.zone.' + c.zone) : t('m.none');
        $('rZone').classList.toggle('head', c.zone === 'head');
        $('rDist').textContent = c.dist != null ? t('m.metres', { m: c.dist }) : t('m.none');
        $('rHp').textContent = c.hp; $('rTime').textContent = mmss(c.time);
        $('rHitBy').textContent = t('m.hitby', { weapon: t(wpn(m).name) });
        $('rHitList').innerHTML = c.took.slice().reverse().map(h => `<div class="h"><i class="z${h.zone === 'head' ? ' head' : ''}"></i><span>${t('m.zone.' + h.zone)}</span><b>−${h.dmg}</b><small>${t('m.metres', { m: h.dist })}</small></div>`).join('');
        $('rNextLbl').textContent = t(wonMatch(m) ? 'm.result' : 'm.nextround');
      } else {
        $('hTitle').textContent = t(s === 'replay' ? 'm.equal' : 'm.timeup');
        $('hMe').textContent = c.hp; $('hFoe').textContent = c.foeHp;
        $('hBarMe').style.setProperty('--v', c.hp + '%'); $('hBarFoe').style.setProperty('--v', c.foeHp + '%');
        $('hVerdict').textContent = t(s === 'replay' ? 'm.again2' : c.winner === 'me' ? 'm.rwin' : 'm.rlose');
      }
    });
    text(s === 'replay' ? 'hNext' : 'rNext', String(Math.max(1, Math.ceil(until(m)))));
  }
  function result(m, s) {
    // (task 030: after the server's match its Rematch, after the bot's Play again)
    put('againLbl', (pvp?.inMatch ? 'm.rematch' : 'm.again') + getLang(), () => { const k = pvp?.inMatch ? 'm.rematch' : 'm.again', a = $('mAgain'); a.dataset.i18n = k; a.textContent = t(k); });
    put('result', m.results, () => {
      const lose = s === 'mlose', st = stats ?? round.stats();
      $('mPanel').classList.toggle('foe', lose);
      $('mTitle').textContent = t(lose ? 'm.mlose' : 'm.mwin');
      $('mMe').textContent = m.wins.me; $('mFoe').textContent = m.wins.foe;
      $('mRounds').innerHTML = m.results.map(r => {
        const w = r.winner === 'me', how = r.how === 'equal' ? t('m.replayed') : w ? t('m.won') : t('m.lost');
        const detail = r.how === 'time' || r.how === 'equal' ? t('m.byot') : r.zone === 'head' ? t('m.byhead') : r.dist != null ? t('m.metres', { m: r.dist }) : t('m.none');
        return `<div class="r${r.winner ? (w ? ' w' : ' l') : ''}"><span>${t('m.round', { n: r.round })}</span><span class="${w ? '' : 'l2'}">${how}</span><span>${detail}</span><small>${mmss(r.time)}</small><b>${w ? '◆' : '◇'}</b></div>`;
      }).join('');
      $('mAcc').textContent = t('m.percent', { v: st.accuracy }); $('mHeads').textContent = st.heads; $('mKits').textContent = st.medkits;
    });
  }

  // every frame; visible: the screens may show (the Play view, the test panel closed)
  function update(visible) {
    const m = preview ?? round, s = visible ? stateOf(m) : 'none';
    if (s !== state) {
      const was = state; state = s; root.dataset.s = s;
      if (s === 'start' && was !== 'start') select(sel);
      if (s.startsWith('m') || s === 'start') poll(true);   // a screen with choices appears: the held buttons wait
      if (s === 'start' || s.startsWith('m')) last.card = last.result = undefined;
    }
    // task 027: PvP's word under the start screen and the result
    const w = (s === 'start' || s === 'mwin' || s === 'mlose') ? pvp?.word() ?? '' : '';
    put('pvpWord', w, x => { $('mPvp').textContent = x; $('mPvp').hidden = !x; });
    // task 029: the note over the bot's match and the server's (searching, found, the link, a dropped link)
    const note = visible && s !== 'start' ? pvp?.note() ?? '' : '';
    put('pvpNote', note, x => { $('pvpNote').textContent = x; $('pvpNote').hidden = !x; });
    put('pvpTake', !!pvp?.canTake, on => $('pvpNote').classList.toggle('take', on));   // (task 031: a click or a tap takes it)
    if (s === 'none' || s === 'range') return;
    if (s === 'start') start();
    else if (s === 'weapon' || s === 'count') countdown(m);
    else if (s === 'fight' || s === 'ot') fight(m);
    else if (s === 'mwin' || s === 'mlose') result(m, s);
    else card(m, s);
    if ((s === 'start' || s === 'mwin' || s === 'mlose') && !document.body.classList.contains('paused')) poll(false);
  }

  return {
    update,
    get state() { return state; },
    // the language changed: everything is written again
    refresh() { last = {}; },
    // a sample match state (debug/screens.js: the numbers of the reference's own sample)
    preview(m) { preview = m; stats = m.stats ?? null; last = {}; if (m.nick) nick.value = m.nick; },
  };
}
