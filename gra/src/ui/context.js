// Task 024 (K4): the graphics card's context lost by the browser (a driver reset, too many tabs with WebGL): the game
// stands still (as in the pause: the round's clock does not run), a line says the picture is coming back, and when the
// browser gives the context back everything of the card is made again (main.js onRestored: the baked textures, the
// environment's light, the shaders) and a match in progress ends without a result (back to the start screen). If it
// does not come back within RENDER.contextWait s: "refresh the page" with a button.
import { RENDER } from '../data/arena.js';
import { t } from '../i18n/index.js';

export function watchContext({ canvas, onLost, onRestored }) {
  const box = document.getElementById('gpuLost'), text = document.getElementById('gpuLostText'), again = document.getElementById('gpuReload');
  let lost = false, timer = 0;
  again.onclick = () => location.reload();
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();   // the browser may give it back
    lost = true; onLost();
    text.textContent = t('gpu.lost'); again.hidden = true; box.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => { if (lost) { text.textContent = t('gpu.gone'); again.hidden = false; } }, RENDER.contextWait * 1000);
  });
  canvas.addEventListener('webglcontextrestored', async () => {
    clearTimeout(timer);
    await onRestored();
    lost = false; box.hidden = true;
  });
  return { get lost() { return lost; } };
}
