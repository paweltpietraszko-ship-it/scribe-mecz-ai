// Pause (task 008, reference/hud_gracza.html): Menu on the pad or Esc opens it and the game stands still. Items: Resume,
// Opponent (task 009: its level, left / right on the d-pad, the stick or the arrows; A / Enter takes the next one),
// Volume (task 010: 0–100 %, left / right; remembered by the sound engine), Controls (shows the controls hint), Settings (greyed out: later), Test panel (the old side panel; the game runs
// behind it), Leave match (for now: back to the spawn point with full health). Pad: up/down (d-pad or left stick)
// chooses, A confirms, B goes back; keyboard: arrows, Enter, Esc; the mouse works too.
import { INPUT } from '../data/arena.js';
import { LEVEL_ORDER } from '../data/bot.js';
import { MIX, MUSIC } from '../data/sound.js';
import { SCREEN } from '../data/screen.js';
import { RENDER, MATERIALS, GLOW, STONE } from '../data/arena.js';
import { FRESCO } from '../data/fresco.js';
import { WEAPONS, WEAPON_POOL } from '../data/combat.js';
import { num, t } from '../i18n/index.js';
import { inApp, quitApp } from './install.js';
import { myPad } from '../player/pad.js';

const PAD = { up: 12, down: 13, left: 14, right: 15, a: 0, b: 1, menu: 9 };
const STICK = 0.6;   // left stick past this = up/down, once per push

// onPanel(): open the test panel; onQuit(): back to the spawn point; onClose(): after it closes;
// level: { get(): the level chosen (key of LEVELS), choose(key) }; volume: { volume (0..1), setVolume(v) } (task 010);
// onSound(): a move or a choice in the menu (its sound)
// scribe: { get(), set(v) }: SCRIBE on or off (task 012); screen: { set(key) }: the LED screen's brightness (task 013),
// one of SCREEN.brightness, remembered here in the browser; weapon (task 016): { get() (the chosen key), choose(key),
// locked() (a match with the bot: one weapon, no choice) }: taken when the pause closes
// Items with a value chosen round a list and remembered in the browser (stored key, its values, the default, the
// label's prefix in the texts, what it sets): the screen's brightness (task 013), the frame rate's cap (task 020: frames
// { set(cap) }), the fresco's colour and quality (task 021: screen.color(key), screen.quality(key))
// Task 022: music { on, setOn(v), volume, setVolume(v) } (audio/music.js: Music on / off and its own volume, remembered
// there); fullscreen { get(), set(v) }: the full screen on / off (the browser allows it after a click or a key only);
// task 024 (K6): resolution { set(share) }: the share of the screen's pixels drawn; (K5) bench { again() }: the performance
// test forgotten, it runs again before the next match
function stored(c) {
  try {
    const raw = localStorage.getItem(c.key), v = c.number ? Number(raw) : raw;
    if (raw !== null && c.values.includes(v)) return v;
  } catch { /* storage blocked */ }
  return c.def;
}
// task 029: pvp(): net/pvp.js (made after the pause): Search an opponent on / off while the bot's match is the wait
// (K4), and the ping to the server (K6)
// Task 030: test: the address has ?test (the test panel, the weapon and SCRIBE's switch only then, K5); look: the
// arena's look { get(), set(v), allowed() (PvP: the host before the match), forced (fields the address sets) }, chosen
// in Settings and remembered (K3, Paweł 06.10); language { get(), set(key) }; copyLog(): the combat log copied (K5)
// task 031: account: net/account.js (sign-in, the nick, sign out, delete); ranking: ui/ranking.js (the nick's form, the
// privacy text); inPvpMatch(): a PvP match is on (no deleting then, K4)
export function createPause({ test = false, look, language, copyLog, account = null, ranking = null, inPvpMatch = () => false, pvp = () => null, onPanel, onQuit, onClose = () => {}, level, volume, scribe, screen, weapon, frames, resolution, music, fullscreen, bench, install, onSound = () => {} }) {
  const CHOICES = {
    screen: { key: 'theone.screen', values: Object.keys(SCREEN.brightness), def: SCREEN.defaultBrightness, label: 'screen.', set: screen.set },
    frames: { key: 'theone.frames', values: RENDER.frameCap.choices, def: RENDER.frameCap.default, label: 'frames.', set: frames.set, number: true },
    // task 024 (K6): the image's resolution (the test panel's slider writes the same key; a value off this list is not shown)
    resolution: { key: 'theone.scale', values: RENDER.resolution.choices, def: RENDER.resolution.default, label: 'resolution.', set: resolution.set, number: true },
    frescoColor: { key: 'theone.frescoColor', values: FRESCO.colors, def: FRESCO.colorDefault, label: 'fresco.color.', set: screen.color },
    frescoQuality: { key: 'theone.frescoQuality', values: FRESCO.qualities, def: FRESCO.qualityDefault, label: 'fresco.quality.', set: screen.quality },
  };
  const chosen = {};
  for (const [k, c] of Object.entries(CHOICES)) { chosen[k] = stored(c); c.set(chosen[k]); }
  // task 030 (K3): the arena's look in Settings, remembered like the rest (the address's floor wins over the stored one)
  const LOOK = {
    arenaMaterial: { key: 'theone.material', field: 'material', values: Object.keys(MATERIALS), label: 'mat.' },
    arenaLight: { key: 'theone.light', field: 'light', values: Object.keys(GLOW.colors), label: 'glow.' },
    arenaFloor: { key: 'theone.floor', field: 'floor', values: STONE.choices.filter(k => k !== 'dzis'), label: 'floor.' },
  };
  const now = look.get(), start = {};
  for (const c of Object.values(LOOK)) if (!look.forced?.includes(c.field)) start[c.field] = stored({ ...c, def: now[c.field] });
  look.set(start);
  const LANGS = ['en', 'pl'], TEST_ONLY = ['panel', 'weapon', 'scribe'];
  let copied = 0, deleteAsked = false;
  // task 031: the account's items by its state (none while the server has no accounts)
  const ACCOUNT_ITEMS = { account: () => true, signGoogle: s => s === 'guest' && account.canSignIn, signDiscord: s => s === 'guest' && account.canSignIn,   // (task 033: not in itch.io's frame)
    nick: s => s === 'signed', signOut: s => s === 'signed', deleteAccount: s => s === 'signed', privacy: () => true, credits: () => true };
  const accountShows = k => !(k in ACCOUNT_ITEMS) || (!!account && ACCOUNT_ITEMS[k](account.state));
  const root = document.getElementById('pause'), hint = document.getElementById('hint');
  // task 024 (Paweł 02.10.2026: "menu pauzy jest nieczytelne, bo jest za długie"): two pages, the pause (data-page
  // absent) and its Settings (data-page="settings"); `items`: the items of the page shown
  const all = [...root.querySelectorAll('[data-item]')], title = root.querySelector('h2'), levelName = document.getElementById('levelName');
  let items = [], page = 'main';
  function openPage(p, at = null) {
    page = p;
    // (task 026: Install only while the browser offers it)
    all.forEach(it => { it.hidden = (it.dataset.page ?? 'main') !== page || (it.dataset.item === 'install' && !install?.available) || (it.dataset.item === 'exit' && !inApp)
      || (it.dataset.item === 'search' && !pvp()?.canSearch) || (it.dataset.item === 'ping' && pvp()?.ping == null) || (!test && TEST_ONLY.includes(it.dataset.item))
      || !accountShows(it.dataset.item); });
    // (task 030: the Settings' section heading and the arena's note: by page, the note only while the look is locked)
    root.querySelectorAll('[data-page]:not([data-item])').forEach(el => { el.hidden = el.dataset.page !== page || (el.id === 'arenaLocked' && look.allowed()); });
    items = all.filter(it => !it.hidden);
    title.textContent = t(page === 'settings' ? 'pause.settings' : 'pause.title');
    root.querySelector('.menu').classList.toggle('settings', page === 'settings');   // (task 030: closer rows)
    sel = Math.max(0, at ? items.findIndex(it => it.dataset.item === at) : 0);
    if (open) show();
  }
  const volumeValue = document.getElementById('volumeValue'), scribeValue = document.getElementById('scribeValue');
  const weaponValue = document.getElementById('weaponValue'), weaponItem = root.querySelector('[data-item="weapon"]');
  const musicValue = document.getElementById('musicValue'), musicVolumeValue = document.getElementById('musicVolumeValue');
  const fullscreenValue = document.getElementById('fullscreenValue'), benchValue = document.getElementById('benchValue');
  const installValue = document.getElementById('installValue'), copyLogValue = document.getElementById('copyLogValue');
  const searchValue = document.getElementById('searchValue'), pingValue = document.getElementById('pingValue');
  let benchAsked = false;   // task 024 (K5): the test asked for again (it runs at the next match)
  let open = false, sel = 0, controls = false, prev = [], stickHeld = false, stickSide = false;

  const show = () => {
    all.forEach(it => it.classList.toggle('on', it === items[sel]));
    levelName.textContent = t('level.' + level.get());
    volumeValue.textContent = t('pause.volumeValue', { v: Math.round(volume.volume * 100) });
    scribeValue.textContent = t(scribe.get() ? 'scribe.on' : 'scribe.off');
    musicValue.textContent = t(music.on ? 'music.on' : 'music.off');   // (task 030, Paweł 06.10: "Wyłączona")
    musicVolumeValue.textContent = t('pause.volumeValue', { v: Math.round(music.volume * 100) });
    fullscreenValue.textContent = t(fullscreen.get() ? 'scribe.on' : 'scribe.off');
    searchValue.textContent = t(pvp()?.searching ? 'scribe.on' : 'scribe.off');
    pingValue.textContent = pvp()?.ping == null ? '' : t('pause.pingValue', { ms: pvp().ping });
    installValue.textContent = install?.needsKey ? t('install.key') : '';
    // task 026: the last result on this device (also when it passed), so a tester can tell it
    const last = !benchAsked && bench.last?.();
    benchValue.textContent = (last && Number.isFinite(last.median) ? t('bench.last', { median: num(last.median), worst: num(last.worst) }) + ' · ' : '')
      + t(benchAsked ? 'bench.next' : 'bench.again');
    for (const [k, c] of Object.entries(CHOICES)) document.getElementById(k + 'Value').textContent = t(c.label + chosen[k]);
    const l = look.get(), free = look.allowed();
    for (const [k, c] of Object.entries(LOOK)) { document.getElementById(k + 'Value').textContent = t(c.label + l[c.field]); root.querySelector(`[data-item="${k}"]`).classList.toggle('lock', !free); }
    document.getElementById('arenaLocked').hidden = page !== 'settings' || free;
    document.getElementById('languageValue').textContent = t('lang.' + language.get());
    copyLogValue.textContent = performance.now() - copied < 1500 ? t('pause.copied') : '';
    // task 031: the account's name (a guest, or the server without accounts), the deleting's second press or its lock
    const st = account?.state;
    document.getElementById('accountValue').textContent = st === 'signed' ? account.me?.nick || '—' : t(st === 'guest' ? 'pause.guest' : 'pause.accountOff');
    document.getElementById('deleteValue').textContent = inPvpMatch() ? t('pause.deleteMatch') : deleteAsked ? t('pause.deleteSure') : '';
    root.querySelector('[data-item="deleteAccount"]').classList.toggle('lock', inPvpMatch());
    items[sel]?.scrollIntoView?.({ block: 'nearest' });
    weaponValue.textContent = t(WEAPONS[weapon.get()].name);
    weaponItem.classList.toggle('lock', weapon.locked());
  };
  // the chosen item's value: the opponent's level (d = +1 the next one, −1 the one before) or the volume (d steps)
  function step(d) {
    if (items[sel].dataset.item === 'scribe') { scribe.set(!scribe.get()); show(); onSound(); return; }   // task 012: on / off
    if (items[sel].dataset.item === 'music') { music.setOn(!music.on); show(); onSound(); return; }       // task 022
    if (items[sel].dataset.item === 'musicVolume') { music.setVolume(music.volume + d * MUSIC.volumeStep); show(); onSound(); return; }
    if (items[sel].dataset.item === 'fullscreen') { fullscreen.set(!fullscreen.get()); onSound(); return; }
    if (items[sel].dataset.item === 'search') { const p = pvp(); p?.search(!p.searching, document.getElementById('mNick')?.value.trim() ?? ''); show(); onSound(); return; }
    const k = items[sel].dataset.item, c = CHOICES[k];
    if (LOOK[k]) {   // task 030 (K3): the arena's look, remembered; in PvP only the host before the match
      if (!look.allowed()) return;
      const L = LOOK[k], v = L.values[(L.values.indexOf(look.get()[L.field]) + d + L.values.length) % L.values.length];
      look.set({ [L.field]: v });
      try { localStorage.setItem(L.key, v); } catch { /* storage blocked */ }
      show(); onSound(); return;
    }
    if (k === 'language') { language.set(LANGS[(LANGS.indexOf(language.get()) + d + LANGS.length) % LANGS.length]); show(); onSound(); return; }
    if (c) {   // round the list, remembered
      chosen[k] = c.values[(c.values.indexOf(chosen[k]) + d + c.values.length) % c.values.length];
      c.set(chosen[k]);
      try { localStorage.setItem(c.key, String(chosen[k])); } catch { /* storage blocked */ }
      show(); onSound(); return;
    }
    if (items[sel].dataset.item === 'weapon') {   // task 016: only on the training level (the match has one weapon)
      if (weapon.locked()) return;
      weapon.choose(WEAPON_POOL[(WEAPON_POOL.indexOf(weapon.get()) + d + WEAPON_POOL.length) % WEAPON_POOL.length]);
      show(); onSound(); return;
    }
    if (items[sel].dataset.item === 'volume') {
      volume.setVolume(volume.volume + d * MIX.volumeStep); show(); onSound();
      return;
    }
    const i = LEVEL_ORDER.indexOf(level.get());
    level.choose(LEVEL_ORDER[(i + d + LEVEL_ORDER.length) % LEVEL_ORDER.length]); show(); onSound();
  }
  const onValue = () => (['level', 'volume', 'scribe', 'weapon', 'music', 'musicVolume', 'fullscreen', 'search', 'language'].includes(items[sel].dataset.item) || !!CHOICES[items[sel].dataset.item] || !!LOOK[items[sel].dataset.item]);
  function move(d) {
    do { sel = (sel + d + items.length) % items.length; } while (items[sel].classList.contains('off'));
    show(); onSound();
  }
  function setOpen(v) {
    open = v; root.hidden = !v; document.body.classList.toggle('paused', v);
    controls = false; hint.hidden = true;
    if (v) {
      openPage('main'); show(); if (document.pointerLockElement) document.exitPointerLock();
      // buttons and stick as they are now: held ones act only after they are let go (e.g. the stick still pushed)
      const pad = connectedPad();
      prev = pad ? pad.buttons.map(b => b.pressed) : []; stickHeld = !!pad && Math.abs(pad.axes[INPUT.pad.move[1]] ?? 0) > STICK / 2;
      stickSide = !!pad && Math.abs(pad.axes[INPUT.pad.move[0]] ?? 0) > STICK / 2;
    }
    else onClose();
  }
  function choose() {
    const k = items[sel].dataset.item;
    if (k === 'resume') setOpen(false);
    else if (k === 'level') step(1);
    else if (k === 'volume' || k === 'musicVolume') return;   // left / right only
    else if (k === 'scribe' || k === 'weapon' || k === 'music' || k === 'fullscreen' || k === 'search' || k === 'language' || CHOICES[k] || LOOK[k]) step(1);
    else if (k === 'signGoogle' || k === 'signDiscord') { account.signIn(k === 'signGoogle' ? 'google' : 'discord').then(() => { if (account.me && !account.me.nick) ranking.openNick(); refresh(); }); }
    else if (k === 'nick') ranking.openNick();         // (the pause stays open under it: the game stands)
    else if (k === 'privacy') ranking.openPrivacy();
    else if (k === 'credits') ranking.openCredits();   // (task 032, D4)
    else if (k === 'signOut') { account.signOut(); refresh(); onSound(); }
    else if (k === 'deleteAccount') {   // (K2: two presses; never in a PvP match, K4)
      if (inPvpMatch()) return;
      if (!deleteAsked) { deleteAsked = true; show(); onSound(); return; }
      deleteAsked = false; account.remove().then(() => refresh()); onSound();
    }
    else if (k === 'copyLog') { copyLog(); copied = performance.now(); show(); onSound(); setTimeout(() => { if (open) show(); }, 1600); }
    else if (k === 'controls') { controls = true; hint.hidden = false; }
    else if (k === 'settings') { account?.need(); openPage('settings'); onSound(); }
    else if (k === 'install') { install.ask(); onSound(); }
    else if (k === 'exit') quitApp();
    else if (k === 'bench') { bench.again(); benchAsked = true; show(); onSound(); }
    else if (k === 'panel') { setOpen(false); onPanel(); }
    else if (k === 'quit') { setOpen(false); onQuit(); }
  }
  function back() {
    if (controls) { controls = false; hint.hidden = true; } else if (page === 'settings') { openPage('main', 'settings'); onSound(); } else setOpen(false);
  }

  all.forEach(it => {
    it.addEventListener('mouseenter', () => { if (!it.classList.contains('off')) { sel = items.indexOf(it); show(); } });
    it.addEventListener('click', e => {
      if (it.classList.contains('off')) return;
      sel = items.indexOf(it); show();
      if (e.target.dataset.d) step(+e.target.dataset.d); else choose();   // the volume's arrows (task 010)
    });
  });
  addEventListener('keydown', e => {
    if (!open || ranking?.open) return;   // (task 031: the account's window over the pause takes the keys)
    if (e.code === 'ArrowUp') move(-1);
    else if (e.code === 'ArrowDown') move(1);
    else if (e.code === 'ArrowLeft' && onValue()) step(-1);
    else if (e.code === 'ArrowRight' && onValue()) step(1);
    else if (e.code === 'Enter' || e.code === 'Space') choose();
    else if (e.code === INPUT.keys.menu) back();
    else return;
    e.preventDefault();
  });

  const connectedPad = () => myPad();
  // every frame while open: the pad's buttons and stick
  function poll() {
    if (!open) return;
    if (ranking?.open) {   // (task 031: B closes the account's window over the pause)
      const pad = connectedPad(), down = pad ? pad.buttons.map(b => b.pressed) : [];
      if (down[PAD.b] && !prev[PAD.b]) ranking.close();
      prev = down; return;
    }
    const pad = connectedPad();
    if (!pad) return;
    const down = pad.buttons.map(b => b.pressed), was = prev, edge = i => down[i] && !was[i];
    prev = down;
    const y = pad.axes[INPUT.pad.move[1]] ?? 0, x = pad.axes[INPUT.pad.move[0]] ?? 0;
    if (Math.abs(x) > STICK && !stickSide) { stickSide = true; if (!controls && onValue()) step(x > 0 ? 1 : -1); }
    else if (Math.abs(x) < STICK / 2) stickSide = false;
    if (edge(PAD.left) && !controls && onValue()) step(-1);
    if (edge(PAD.right) && !controls && onValue()) step(1);
    if (Math.abs(y) > STICK && !stickHeld) { stickHeld = true; if (!controls) move(y > 0 ? 1 : -1); }
    else if (Math.abs(y) < STICK / 2) stickHeld = false;
    if (edge(PAD.up) && !controls) move(-1);
    if (edge(PAD.down) && !controls) move(1);
    if (edge(PAD.a)) { if (controls) back(); else choose(); }
    else if (edge(PAD.b) || edge(PAD.menu)) back();
  }

  // ?freeze&pose=pause_level: this item chosen
  const select = key => { const it = all.find(i => i.dataset.item === key); openPage(it?.dataset.page ?? 'main', key); show(); };
  // the start screen's Settings: the pause opened on its Settings page
  const settings = () => { account?.need(); setOpen(true); openPage('settings'); };
  // task 026: the browser's offer to install came or went: the page's items again (the one chosen kept)
  const refresh = () => { if (open) openPage(page, items[sel]?.dataset.item); };
  return { poll, setOpen, select, settings, refresh, get open() { return open; } };
}
