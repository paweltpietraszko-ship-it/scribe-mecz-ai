// The welcome screen (task 022, Paweł 01.10.2026: "ekran powitalny ... z pieczęcią z któregoś panelu jako logo gry",
// with the game's name "SCRIBE: THE ONE"): the real middle panel of the arena close up (its seal, its script, its light
// and the writing head's sparks), the name and "press any button". The first press is also what the browser needs to
// play sound and to go full screen: a click or a key turns the full screen on (D1), a pad's button cannot.
// Then the Play view and the start screen. The arena's moves wait while it shows (the middle panel would go down).
import { PLAY, WELCOME } from '../view.js';
import { myPad } from '../player/pad.js';

// view: the views (view.js); motion: the arena's moves (after it the start screen shows by itself).
// Task 024 (K3): it shows while the rest of the game loads; a press before the game is ready waits (the loading sign,
// #wait) and the start screen comes when it is (ready())
export function createWelcome({ view, motion }) {
  const root = document.getElementById('welcome'), wait = document.getElementById('wait');
  let open = false, held = true, ready = false, asked = false;

  function leave() {
    open = false; root.hidden = true; wait.hidden = true;
    motion.setAuto(true);
    view.go(PLAY, true);
  }
  function close(full) {
    if (!open || asked) return;
    if (full) document.documentElement.requestFullscreen?.().catch(() => {});   // now: only a click or a key may ask
    if (ready) leave(); else { asked = true; wait.hidden = false; }
  }
  // the browser's own keys do not count (Paweł 01.10.2026: "F11 od razu otwiera grę, więc nie powiększa okna
  // powitalnego"): F11 makes the browser full screen and the welcome screen stays
  const browserKey = e => /^F\d+$/.test(e.key) || ['Alt', 'Control', 'Shift', 'Meta', 'Tab', 'CapsLock', 'ContextMenu'].includes(e.key) || e.altKey || e.ctrlKey || e.metaKey;
  addEventListener('keydown', e => { if (open && !e.repeat && !browserKey(e)) { e.preventDefault(); close(true); } });
  root.addEventListener('click', () => close(true));
  const connectedPad = () => myPad();

  return {
    get open() { return open; },
    // the game is ready: a press that waited goes on now
    ready() { ready = true; if (asked && open) leave(); },
    show() { open = true; root.hidden = false; motion.setAuto(false); view.go(WELCOME, true); },
    // every frame while it shows: any pad button (one held when the page opened waits until it is let go)
    update() {
      if (!open) return;
      const pad = connectedPad(), any = !!pad && pad.buttons.some(b => b.pressed);
      if (any && !held) close(false);
      held = any;
    },
  };
}
