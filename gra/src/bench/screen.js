// Task 024 (K5): the performance test's screens (in the style of the match's screens, task 022): "checking…" while it
// runs, and "your computer is too weak" with the requirements, the test's result and "Play anyway" (A, Enter, a click).
import { BENCH } from '../data/bench.js';
import { num, t } from '../i18n/index.js';
import { myPad } from '../player/pad.js';

export function createBenchScreen() {
  const root = document.getElementById('bench'), result = document.getElementById('benchResult'), anyway = document.getElementById('benchAnyway');
  let chosen = null, held = true;
  const choose = () => { if (chosen) { const c = chosen; chosen = null; root.hidden = true; c(); } };
  anyway.onclick = choose;
  addEventListener('keydown', e => { if (chosen && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); choose(); } });
  const connectedPad = () => myPad();
  return {
    checking() { root.dataset.s = 'check'; root.hidden = false; },
    hide() { root.hidden = true; },
    // the "too weak" screen until the player chooses Play anyway
    weak(r) {
      if (!Number.isFinite(r.median)) return Promise.resolve();   // (audit 024 F1: no numbers, no warning)
      root.dataset.s = 'weak'; root.hidden = false;
      const L = r.method === 2 ? BENCH.limits2 : BENCH.limits;
      result.textContent = t('bench.result', { median: num(r.median), worst: num(r.worst), lm: L.median, lw: L.worst });
      held = true;
      return new Promise(res => { chosen = res; });
    },
    // every frame: the pad's A (one held when the screen came waits until it is let go)
    update() {
      if (!chosen) return;
      const a = !!connectedPad()?.buttons[0]?.pressed;
      if (a && !held) choose();
      held = a;
    },
  };
}
