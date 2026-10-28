// Task 027 (K7), task 028, task 029: PvP, the window's side.
// 029 (zadania/029_pvp_railway.md): the start screen's mode "Vs player" (mode) changes what Play does:
//   Play         the bot's match starts at once (K4: the wait is a fight) and the window takes a place in the server's
//                queue (Colyseus joinOrCreate: a room where someone waits, or a new one, K2); "searching" shows over it
//   Play a friend   a private room and its link (…/?join=<room>), copied and offered to the system's Share (K3); the
//                bot's match meanwhile. A page opened with ?join=<room> joins that room on Play (the link was taken by
//                opening it)
//   found        Play's pair: the window says so with PVP.acceptTime s on the clock; d-pad up / Enter takes it (Paweł
//                03.10.2026: A is cover in the fight). Not taken in time: out of the queue, the bot's match goes on
//                (the pause's Search turns it on again). A friend's link: the maker takes it with no time limit
//   lobby        both took it: the other's character and the match's weapon loaded, "loaded" and "ready" said at once;
//                the bot's match goes on till the server's match starts, then the window shows the server's (028)
//   match        the fight is the server's (027 K1): the own fighter predicted (net/own.js), the other and the arena
//                from the room (net/other.js). A dropped link: Colyseus comes back by itself; meanwhile the match stands
//                for both (the server's pause, PVP.reconnectTime s), the window says so with the time left (K5)
//   end          the result (a walkover: said on it); Again is a vote, Leave leaves (027)
// The arena's look is the host's for both (027 K5, 029 K7: the first one waiting, or the link's maker); the guest is
// told. A closed tab leaves the room (the browser's "going away": a leave, the other wins).
import { Client } from '@colyseus/sdk';
import { ITCH, serverAddress, fullGame } from './where.js';
import { PVP } from '../data/match.js';
import { WEAPONS } from '../data/combat.js';
import { CHARACTERS } from '../data/hero.js';
import { idleAction } from '../fighter/actions.js';
import { myPad } from '../player/pad.js';
import { createOwn } from './own.js';
import { createOther } from './other.js';
import { t } from '../i18n/index.js';
import { combatLog } from '../combat/log.js';

// the server's close codes (scripts/pvp-room.mjs CODE)
const DECLINED = 4101, EXPIRED = 4102, FULL = 4104;
const UP = 12;   // the d-pad's up: takes the match found (K4)

// engine: sim/engine.js; round: its match (fighter/round.js); control, tpp: the player's controller and camera;
// characters: look/characters.js; useWeapon(key): the match's weapon loaded and held (main.js); match: fighter/match.js;
// looks: the side panel (ui/controls.js: look, setLook); smooth, clock: the drawing between steps; effects, audio,
// onHurt, sounds: the window's pictures, sounds and HUD
// token(): the window's sign-in token now (net/account.js; task 031)
export function createPvp({ engine, round, control, tpp, characters, useWeapon, match, looks, smooth, clock, effects, audio, onHurt, sounds, token = () => null, onSignedOut = () => {} }) {
  let joinId = new URLSearchParams(location.search).get('join');
  let mode = !!joinId;     // the start screen's "Vs player"
  let room = null, how = null, status = 'off', st = null, side = null, other = null, link = null, guest = false;
  let loadedFor = null, ownLook = null, sentLook = '', dropped = false;
  let inMatch = false, lastM = null, lastAngle = 0, ownAngle = null, lastAction = idleAction(), word = null, wordLeft = 0;
  let own = null, rest = null, mine = 0, events = null, cancelledAt = -Infinity, upWas = false, walkover = false;
  let sentToken = null;   // (the token the room knows: the join's, then each change sent, audit r4 B1)
  const say = key => { word = key; wordLeft = PVP.wordTime; };
  // task 033 (Paweł 07.10): a player who left the game searching (no pad, key or mouse for PVP.idleStop s, the tab
  // hidden included) stops searching, so another player is not paired with an empty window; "Find match" resumes it
  let lastInput = performance.now();
  const moved = () => { lastInput = performance.now(); };
  for (const k of ['keydown', 'pointerdown', 'pointermove', 'wheel']) addEventListener(k, moved, { passive: true });
  setInterval(() => {
    if (room && status === 'waiting' && how === 'quick' && performance.now() - lastInput > PVP.idleStop * 1000) { leaveRoom(); status = 'idle'; }
  }, 5000);

  // the server: net/where.js (the laptop: the dev server's /pvp; built: the game's own address; itch.io: NET.server)
  const address = serverAddress;

  // a room: 'quick' (Play), 'invite' (a friend's link made), 'join' (a link opened)
  async function connect(kind, nick) {
    if (room || status === 'connecting') return;
    how = kind; status = 'connecting'; ownLook = looks.look; walkover = false;
    const opts = { nick, character: characters.key, look: ownLook };
    // (audit F2: a link is used once: the next Play is the queue's, the old link out of the address)
    const id = joinId;
    if (kind === 'join') { joinId = null; history.replaceState(null, '', location.pathname); }
    try {
      const client = new Client(address());
      // task 033 (A0): the itch.io build joins as a guest: whatever another itch.io game left under the SDK's key in the
      // shared storage is dropped before any request (never sent)
      if (ITCH) client.auth.token = null;
      sentToken = client.auth.token ?? null;
      room = kind === 'join' ? await client.joinById(id, opts) : kind === 'invite' ? await client.create('duel', { ...opts, private: true }) : await client.joinOrCreate('duel', opts);
    } catch (e) {
      room = null; status = 'off';
      // the server full (Paweł 03.10): the bot's match goes on, searching off (the pause's Find match tries again); a
      // friend's link stays for the next Play
      if (e?.code === FULL) { status = 'full'; if (kind === 'join') joinId = id; return; }
      // an invitation gone: back to the start screen, saying so (K3, audit F2); no server: the bot's match goes on
      if (kind === 'join') end('pvp.expired'); else say('pvp.noServer');
      return;
    }
    // (task 033 B3: from itch.io's frame the link opens the game on Railway: the frame's address works only on itch.io)
    if (kind === 'invite') shareLink(ITCH ? `${fullGame()}?join=${room.roomId}` : `${location.origin}${location.pathname}?join=${room.roomId}`);
    status = 'waiting';
    room.onDrop(() => { dropped = true; });            // (Colyseus comes back by itself, K5)
    room.onReconnect(() => { dropped = false; });
    room.onStateChange(s => changed(s));
    room.onMessage('e', b => events?.(b));
    // task 032 (C2): this window's token no longer counts (it ran out, or the account signed out elsewhere): a guest
    // from this match on; the match itself goes on
    room.onMessage('signedOut', () => { sentToken = null; say('rank.signedOut'); onSignedOut(); });
    room.onMessage('gone', m => { if (m?.walkover) walkover = true; else end('pvp.gone'); });
    room.onLeave(code => {
      if (!room) return;
      if (code === DECLINED) { leaveRoom(); status = 'declined'; return; }      // the bot's match goes on (K4)
      // the invitation over: its maker plays the bot on; the one who came by the link goes back to the start (K3, audit F1)
      if (code === EXPIRED) { if (how === 'join') end('pvp.expired'); else { leaveRoom(); say('pvp.expired'); } return; }
      end(inMatch ? 'pvp.lost' : null);
    });
  }
  // the friend's link: copied, and offered to the system's Share where there is one (a phone)
  function shareLink(url) {
    link = url;
    navigator.clipboard?.writeText(url).catch(() => {});
    if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ url }).catch(() => {});
  }

  function changed(s) {
    st = s;
    const me = s.players.get(room.sessionId);
    if (!me) return;
    side = me.side; mine = side === 'a' ? 0 : 1;
    if (!rest) { rest = createOther({ engine, room, side, to: { effects, audio, onHurt } }); events = rest.heard; }
    const o = [...s.players.values()].find(p => p !== me);
    other = o ? { nick: o.nick, character: o.character } : null;
    // K6: the nicks in the combat log (the server's keys: side A 'player', side B 'bot')
    const nickOf = s => [...st.players.values()].find(p => p.side === s)?.nick || t('pvp.nick');
    combatLog.names = { player: nickOf('a'), bot: nickOf('b') };
    guest = s.host !== room.sessionId;
    status = s.phase === 'found' ? (me.accepted ? 'accepted' : 'found') : s.phase === 'end' ? (me.again ? 'again' : 'end') : s.phase;
    if (s.phase === 'lobby' || s.phase === 'match' || s.phase === 'end') looks.setLook({ material: s.look.material, light: s.look.light, floor: s.look.floor });   // the host's (K7)
    if (s.phase === 'match' && !own) {
      // the match begins: the own fighter predicted from now on (the server's facts put it at its spawn)
      own = createOwn({ engine, room, mine, lag: () => rest.lag, turn: () => { const d = lastAngle - (ownAngle ?? lastAngle); ownAngle = lastAngle; return d; } });
      engine.player.predicted = true;
    }
    if (s.phase === 'lobby' && other && loadedFor !== s.seed) prepare(s.seed, s.weapon, other.character);
    if (s.phase === 'waiting' && own) back();   // (the other left before a new match: waiting again, the bot's match)
  }

  // the other's character on the opponent's body and the match's weapon in both hands, then "loaded" and "ready"
  async function prepare(seed, weapon, character) {
    loadedFor = seed;
    match.use(weapon);
    await Promise.all([useWeapon(weapon), characters.setOpponent(character)]);
    await characters.settled();
    if (room && st?.seed === seed) { room.send('loaded', { seed }); room.send('ready', true); }
  }

  // the server's match is over for this window: the bot's world again
  function back() {
    own?.dispose(); own = null; ownAngle = null; inMatch = false; engine.player.predicted = false; loadedFor = null;
    characters.setOpponent(null);
    if (ownLook) looks.setLook(ownLook);
  }
  function leaveRoom() {
    const r = room; room = null;
    r?.leave(true).catch?.(() => {});
    rest = null; events = null; st = null; side = null; other = null; link = null; dropped = false;
    combatLog.names = null;
    back();
    status = 'off';
  }
  // back to the start screen (word: what is said)
  function end(key) {
    leaveRoom();
    engine.round.leave();
    if (key) say(key);
  }
  addEventListener('pagehide', () => room?.leave(true));   // (a closed tab: a leave, K5)

  // one step of the window's clock in a match: the arena and the other as the room's state has them (net/other.js),
  // then this step's action made, sent and played on the own fighter at once (net/own.js); while the match stands (a
  // dropped link, K5) nothing is sent
  function step(h, play, paused) {
    smooth.capture();
    const m = rest.step(h);
    if (!m) return;
    lastM = m;
    const turnDelta = m.turn.angle - lastAngle; lastAngle = m.turn.angle;
    if (st.pause || dropped) { sounds(h, lastM, idleAction(tpp.yaw, tpp.pitch), null); return; }
    let a = paused ? idleAction(tpp.yaw, tpp.pitch) : control.poll({ play, pose: null, turnDelta });
    if (!engine.round.fighting || paused) a = idleAction(tpp.yaw, tpp.pitch);
    else control.aim();
    const r = own.send(a);
    if (play && !paused) control.recoil(r.recoil);
    control.moved(r.moved);
    lastAction = a;
    sounds(h, lastM, a, null);
  }

  // the match found taken: d-pad up or Enter (K4)
  function take() { if (status === 'found') room?.send('accept'); }
  addEventListener('keydown', e => { if (e.code === 'Enter' && status === 'found' && !document.body.classList.contains('paused')) { take(); e.preventDefault(); } });
  const left = until => Math.max(0, Math.ceil((until - room.clock.serverNow()) / 1000));

  return {
    get mode() { return mode; },
    get active() { return mode; },                     // (the start screen: "Vs player" chosen)
    get connected() { return !!room; },
    get roomPhase() { return st?.phase ?? null; },
    get status() { return status; },   // (tests: the room's phase as this window has it)
    get inMatch() { return inMatch; },
    // B / Esc on the start screen takes something back here (connecting)
    get holdsBack() { return status === 'connecting'; },
    get last() { return { m: lastM, a: lastAction }; },
    // may this window change the arena's look now: not in a room, or the host before the match (027 K5, audit F3)
    get mayLook() { return !room || (!!st && st.host === room.sessionId && (st.phase === 'waiting' || st.phase === 'found')); },
    get invitedBy() { return joinId; },
    // task 031 (K5): this window's ranked outcome, the server's (null: no ranked match, or not settled yet)
    get rank() { const me = st?.ranked && room ? st.players.get(room.sessionId) : null; return me?.why ? { points: me.points, delta: me.delta, equal: me.equal, why: me.why, whyNick: me.whyNick, whyPoints: me.whyPoints, placement: me.placement } : null; },
    // task 031 (Paweł 06.10): the match found taken by a click or a tap on its note too (a phone without a pad)
    take() { take(); },
    get canTake() { return status === 'found'; },
    get otherNick() { return inMatch ? other?.nick || t('pvp.nick') : null; },   // (the screens: the opponent's name, K6)
    toggle() { if (room) end(null); mode = !mode; },
    // Play in "Vs player": the bot's match and a place in the queue, or the link opened (K2, K3, K4)
    // (task 033, Paweł 07.10: the search starts when the bot's match has begun: the performance test before the first
    // match takes about 18 s, and a pair found meanwhile was lost for want of "Accept")
    play(nick) { Promise.resolve(round.startMatch()).then(() => connect(joinId ? 'join' : 'quick', nick)); },
    // Play a friend: the bot's match and a private room's link (K3)
    invite(nick) { Promise.resolve(round.startMatch()).then(() => connect('invite', nick)); },
    // the pause's Search: on (a place in the queue again) or off (the bot's match only)
    get searching() { return !!room && !inMatch; },
    get canSearch() { return mode && !inMatch && engine.round.phase !== 'menu'; },
    search(on, nick) { if (on && !room) connect('quick', nick); else if (!on && room && !inMatch) leaveRoom(); },
    // the window's ping to the server (the pause, K6)
    get ping() { return room ? Math.round(room.clock.smoothedRtt?.() ?? 0) : null; },
    ready() {},
    cancel() { cancelledAt = performance.now(); if (status === 'connecting' || (room && !inMatch)) leaveRoom(); },
    get justCancelled() { return performance.now() - cancelledAt < 300; },
    again() { if (status === 'end') { room?.send('again'); status = 'again'; } },
    leave() { end(null); },
    // every drawn frame: the host's look to the server when it changed (K7), the d-pad's up (K4); in a match, the views
    // and the actions (true: the frame's steps were the match's)
    frame(dt, { play, paused = false }) {
      // task 031 (audit r4 B1): signed in or out while in the room: the room told (the next match ranked by it)
      if (room && token() !== sentToken) { sentToken = token(); room.send('token', sentToken ?? ''); }
      if (wordLeft > 0 && (wordLeft -= dt) <= 0) word = null;
      const pad = myPad(), up = !!pad?.buttons[UP]?.pressed;
      if (pad && (pad.buttons.some(b => b.pressed) || pad.axes.some(a => Math.abs(a) > 0.3))) moved();
      if (up && !upWas && !paused) take();
      upWas = up;
      if (room && st && st.host === room.sessionId && (st.phase === 'waiting' || st.phase === 'found')) {
        const l = JSON.stringify(looks.look);
        if (l !== sentLook) { sentLook = l; room.send('look', looks.look); }
      }
      if (!room || !own || !st || (st.phase !== 'match' && st.phase !== 'end')) return false;
      inMatch = true;
      own.tick(performance.now());   // the server's acknowledgements: the own fighter corrected (028 K3)
      const n = clock.advance(dt);
      for (let i = 0; i < n; i++) step(clock.step, play, paused);
      own.confirmHits();
      return !!lastM;
    },
    // 028 K3: after the drawing's smoothing: the own body where the prediction draws it (the correction fading)
    place(root) { if (own && inMatch) own.drawAt(root.position); },
    get net() { return own && rest && { own: own.stats, behind: rest.behind, starved: rest.starved }; },
    // the word under the start screen and the result
    word() {
      if (word) return t(word);
      if (status === 'connecting') return t('pvp.connecting');
      if (status === 'again') return t('pvp.again');
      if (walkover && (status === 'end' || status === 'again')) return t('pvp.walkover');
      if (mode && !room && joinId) return t('pvp.invited');
      return '';
    },
    // the note over the bot's match and the server's match (the HUD's style: ui/screens.js #pvpNote), or ''
    note() {
      if (dropped) return t('pvp.reconnecting');
      if (!room) return ['declined', 'full', 'idle'].includes(status) && mode && engine.round.phase !== 'menu' ? t({ full: 'pvp.serverFull', idle: 'pvp.idle' }[status] ?? 'pvp.declined') : '';
      const nick = other?.nick || t('pvp.nick'), them = other && t('pvp.vs', { nick, character: t(CHARACTERS[other.character]?.name ?? 'char.' + other.character), weapon: t(WEAPONS[st?.weapon]?.name ?? st?.weapon ?? '') });
      if (st?.pause) return t(st.pause === side ? 'pvp.reconnecting' : 'pvp.otherLost', { s: left(st.pauseUntil) });
      if (status === 'waiting') return how === 'invite' ? t('pvp.inviting', { link }) : t('pvp.searching');
      if (status === 'found') return how === 'invite' ? t('pvp.friend', { nick }) : t('pvp.found', { nick, s: left(st.foundUntil) });
      if (status === 'accepted') return t('pvp.accepted', { nick });
      if (status === 'lobby') return (guest ? t('pvp.hostLook') + '  ·  ' : '') + (them ?? t('pvp.loading'));
      // task 031 (K4): ranked or not, as the server decided at the match's start, until the fight begins
      if (status === 'match' && engine.round.phase === 'countdown') return st.ranked ? t('rank.ranked') : t('rank.unranked.' + (st.unranked || 'guest'));
      return '';
    },
  };
}
