// The music outside the fight (task 022, U43): which track plays follows the match's state (fighter/round.js), never
// the fight itself. Plain <audio> elements, apart from the game's Web Audio (the sounds' limiter and the pause's fade do
// not touch it). A track's file is fetched only when it is first wanted and the music is on (Railway: whoever turns it
// off downloads nothing). Tracks never overlap: a change fades the old one out (MUSIC.fadeOut), then the new one starts
// and fades in (MUSIC.fadeIn). The browser plays only after the player's
// first input, so a track that could not start yet is tried again every frame.
import { asset } from '../asset.js';
import { MUSIC } from '../data/sound.js';
import { MATCH } from '../data/match.js';

const KEY = 'theone.music', VKEY = 'theone.musicVolume';
function stored() {
  let on = MUSIC.on, volume = MUSIC.volume;
  try {
    const o = localStorage.getItem(KEY); if (o === 'on' || o === 'off') on = o === 'on';
    const v = parseFloat(localStorage.getItem(VKEY)); if (v >= 0 && v <= 1) volume = v;
  } catch { /* storage blocked */ }
  return { on, volume };
}

// round: the match's state; master(): the pause's Volume (0..1)
export function createMusic({ round, master = () => 1 }) {
  let { on, volume } = stored();
  const tracks = {};        // name → { el, level, want, out (s of its fade out), playing }
  let afterEnd = false;     // the match's end has played: the menu's loop under the result
  const stats = { fetched: [], played: [] };   // for test scripts (window.__theone.music)
  round.on(kind => { if (kind === 'matchEnd' || kind === 'menu' || kind === 'matchStart') afterEnd = false; });

  function track(name) {
    if (tracks[name]) return tracks[name];
    const T = MUSIC.tracks[name], el = new Audio();
    el.preload = 'auto'; el.loop = !!T.loop; el.src = asset(T.file); stats.fetched.push(name);
    el.addEventListener('ended', () => { if (name === 'end') afterEnd = true; });
    return (tracks[name] = { el, level: 0, playing: false, started: false });
  }

  // the track the state wants now, and how fast the others fade out
  function wanted() {
    const m = round;
    switch (m.phase) {
      case 'menu': return ['menu', MUSIC.fadeOut];
      case 'countdown':
        if (!m.results.length) return [m.left > MUSIC.beforeOut ? 'before' : null, MUSIC.beforeOut];
        return [null, MATCH.countdown];
      case 'card': return [m.card.how === 'equal' ? null : m.card.winner === 'me' ? 'win' : 'lose', MUSIC.fadeOut];
      case 'end': case 'loading': return [afterEnd ? 'menu' : 'end', MUSIC.fadeOut];
      default: return [null, MUSIC.fadeOut];
    }
  }

  // every frame
  function update(dt) {
    const [want, out] = on ? wanted() : [null, MUSIC.fadeOut];
    // Paweł 01.10.2026 ("muzyka nachodzi na siebie"): one track at a time; the next starts once the one before is silent
    const quiet = Object.entries(tracks).every(([n, tr]) => n === want || tr.level === 0);
    if (want && quiet && !tracks[want]?.playing) {
      const tr = track(want);
      if (!tr.started) { if (!MUSIC.tracks[want].loop) tr.el.currentTime = 0; tr.started = true; }
      tr.playing = true;   // the promise settles later; until then play() is not called again
      tr.el.play().then(() => stats.played.push(want), () => { tr.playing = false; });   // before the first input: later
    }
    for (const [name, tr] of Object.entries(tracks)) {
      const goal = name === want && tr.playing ? 1 : 0, rate = goal ? 1 / MUSIC.fadeIn : 1 / Math.max(0.05, out);
      tr.level = goal > tr.level ? Math.min(goal, tr.level + dt * rate) : Math.max(goal, tr.level - dt * rate);
      tr.el.volume = Math.min(1, tr.level * MUSIC.tracks[name].volume * volume * master());
      if (tr.level === 0 && tr.playing && name !== want) { tr.el.pause(); tr.playing = false; tr.started = false; }
    }
  }

  return {
    update, stats,
    // test scripts: the tracks sounding now and their element's volume
    playingNow: () => Object.entries(tracks).filter(([, t]) => !t.el.paused).map(([n, t]) => `${n} ${t.el.volume.toFixed(3)}`),
    get on() { return on; },
    get volume() { return volume; },
    setOn(v) { on = v; try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch { /* storage blocked */ } },
    setVolume(v) {
      volume = Math.round(Math.min(1, Math.max(0, v)) / MUSIC.volumeStep) * MUSIC.volumeStep;
      volume = Math.round(volume * 100) / 100;
      try { localStorage.setItem(VKEY, String(volume)); } catch { /* storage blocked */ }
    },
  };
}
