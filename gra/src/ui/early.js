// Task 024 (K3): the arena drawn while the rest of the game loads (the fighters, their animations, the weapon, the
// physics, the navigation, the sounds): the welcome screen shows the real middle panel as soon as its own textures are
// baked and its shaders compiled. The same arena step as the game's (main.js simulate: the script's writing head and
// seal, the wall and the turntable); nothing of the fight runs yet. stop() hands over to the game's loop: its clock.
import { U } from '../look/materials.js';
import { GLOW, RENDER } from '../data/arena.js';

const WELCOME_FPS = RENDER.welcomeFps;

export function startEarly({ stage, wall, turntable, motion, view, welcome, frozen }) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let time = 0, last = performance.now(), running = true, drawing = false;
  // only what the welcome screen was made of: what the game adds meanwhile (the fighters, the LED screen, …) is drawn
  // only when its shaders are ready (warmUp), not compiled in the middle of the welcome screen
  const base = new Set(stage.scene.children), hidden = [];
  function frame(now) {
    if (!running) return;
    // at most WELCOME_FPS: the page's thread is wanted by the loading behind it (a fast screen would take it all)
    if (now - last < 1000 / WELCOME_FPS - 1) { requestAnimationFrame(frame); return; }
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!frozen) {
      time += dt;
      U.uWave.value = (U.uWave.value + dt * (reduce ? GLOW.waveSpeedReduced : GLOW.waveSpeed)) % 1;
      U.uSeal.value = GLOW.sealPulse.mid + GLOW.sealPulse.amp * Math.sin(time * GLOW.sealPulse.speed);
    }
    const m = motion.update(frozen ? 0 : dt);
    wall.update(m.panel, frozen ? 0 : time); turntable.update(m.turn, frozen ? 0 : time);
    view.update(dt); welcome.update();
    if (drawing) {   // nothing until the welcome screen is ready (no half-baked arena)
      for (const c of stage.scene.children) if (!base.has(c) && c.visible) { c.visible = false; hidden.push(c); }
      stage.render();
      while (hidden.length) hidden.pop().visible = true;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return { draw() { drawing = true; }, stop() { running = false; return time; } };
}

// the shaders of what `root` shows compiled before it is first drawn (in parallel where the browser can:
// KHR_parallel_shader_compile), so the first frame does not stall. The scene is drawn into the post-processing's
// target, not to the screen (no tone mapping there): compiled for that target, or the shaders would be other ones
export async function compileFor(stage, root = stage.scene) {
  const r = stage.renderer, before = r.getRenderTarget();
  r.setRenderTarget(stage.composer.readBuffer);
  const done = r.compileAsync(root, stage.camera, stage.scene);
  r.setRenderTarget(before);
  await done;
}

// Task 024 (K4): before the game's first frame, every shader it will ever need, so that nothing is compiled in the
// fight (the first shot, hit, mark, the rim, a death, SCRIBE's move): what is hidden now (effects, markers) is shown
// for a moment (lights are left as they are: a light hidden or shown is another number of lights, another shader; the
// game keeps every light in and dims it instead); `extra`: objects that appear only later (a bullet mark), added then.
// Then one drawing of everything (no culling) into the post-processing's target with every shadow map drawn: the
// shadows' own shaders and every texture's upload. All put back as it was; the shadow maps are drawn again after.
export async function warmUp(stage, { extra = [] } = {}) {
  const scene = stage.scene, r = stage.renderer, shown = [], culled = [], lights = [];
  extra.forEach(o => scene.add(o));
  scene.traverse(o => {
    if (o.isLight) { if (o.castShadow) lights.push(o); return; }
    if (!o.visible) { shown.push(o); o.visible = true; }
    if (o.isMesh && o.frustumCulled) { culled.push(o); o.frustumCulled = false; }
  });
  await compileFor(stage);
  const before = r.getRenderTarget();
  lights.forEach(l => { l.shadow.needsUpdate = true; });
  r.setRenderTarget(stage.composer.readBuffer); r.render(scene, stage.camera); r.setRenderTarget(before);
  shown.forEach(o => { o.visible = false; });
  culled.forEach(o => { o.frustumCulled = true; });
  extra.forEach(o => o.removeFromParent());
  lights.forEach(l => { l.shadow.needsUpdate = true; });
}
