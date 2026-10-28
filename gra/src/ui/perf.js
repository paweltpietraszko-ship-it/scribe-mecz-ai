// Frame counter (F3) and the resolution slider.
import { Vector2 } from 'three';
import { RENDER } from '../data/arena.js';
import { num, t } from '../i18n/index.js';

const KEY = 'theone.scale';

export function createPerf(stage) {
  const box = document.getElementById('fps');
  const slider = document.getElementById('scale'), out = document.getElementById('scaleOut');
  const R = RENDER.resolutionScale;
  Object.assign(slider, { min: R.min, max: R.max, step: R.step });

  let saved = NaN;
  try { saved = parseFloat(localStorage.getItem(KEY)); } catch { /* storage blocked */ }
  const apply = v => {
    v = Math.min(R.max, Math.max(R.min, v));
    slider.value = v; out.value = t('perf.value', { value: Math.round(v * 100) });
    if (v !== stage.scale) stage.setScale(v);
    try { localStorage.setItem(KEY, String(v)); } catch { /* storage blocked */ }
  };
  apply(Number.isFinite(saved) ? saved : R.default);
  slider.addEventListener('input', () => apply(parseFloat(slider.value)));

  addEventListener('keydown', e => {
    if (e.code === 'F3') { e.preventDefault(); box.hidden = !box.hidden; }
  });

  // averaged over half a second; also shows the slowest frame
  let frames = 0, acc = 0, worst = 0;
  function frame(dtReal) {
    if (box.hidden) return;
    frames++; acc += dtReal; worst = Math.max(worst, dtReal);
    if (acc >= .5) {
      const px = stage.renderer.getDrawingBufferSize(v2);
      box.textContent = t('fps.line', { fps: Math.round(frames / acc), ms: num(acc / frames * 1000), max: Math.round(worst * 1000) })
        + '\n' + t('fps.size', { w: String(px.x), h: String(px.y) });
      frames = 0; acc = 0; worst = 0;
    }
  }
  return { frame };
}

const v2 = new Vector2();
