// Task 024 (K5): the test of the computer at the first Play on a device (again when its card's name or the game's
// version changes, or when the player asks: the pause's "Performance test"). Data in data/bench.js.
//   - drawn at the size the game draws at on this device (the canvas's drawing buffer: the window, its pixel ratio, the
//     pause's resolution), at most BENCH.width × BENCH.height pixels (task 026, OWNER_CORRECTED: Paweł's phone plays
//     well, the test at a forced 1920 × 1080 called it too weak); the whole game's work: two bots fight (physics, bots, SCRIBE, animations, spatial sound: main.js
//     benchStep);
//   - every frame's cost: the CPU's time of the frame (performance.now() from its start to the end of its drawing calls)
//     and the card's: method 1, EXT_disjoint_timer_query_webgl2: the card's time from a query, the cost is the larger of
//     the two (they work side by side); method 2 (no such query, e.g. a phone, or ?bench=2): the time from one frame to
//     the next, as the player gets them (task 026: until then one pixel was read back after drawing, which on a phone's
//     card costs far more than the drawing itself: 72 ms a frame on a phone that plays smoothly);
//   - a disrupted test is not a weak result: invalid only when the tab is hidden, the window loses focus or changes
//     size, the context is lost (and frames flagged GPU_DISJOINT in method 1 are left out); run again once; a disruption
//     after BENCH.minValid s of valid frames that already break the limits counts as "too weak"; two invalid tests
//     without that: no verdict (the game starts, the test runs again at the next launch).
import { BENCH } from '../data/bench.js';
import { BUILD } from 'virtual:asset-versions';

const read = key => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const write = (key, v) => { try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ } };

export function cardName(gl) {
  const e = gl.getExtension('WEBGL_debug_renderer_info');
  return String(gl.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
}

// stats of a list of frame costs (ms)
export function verdictOf(costs, method = 1) {
  const L = method === 2 ? BENCH.limits2 : BENCH.limits;
  const s = [...costs].sort((a, b) => a - b), at = q => s[Math.min(s.length - 1, Math.floor(s.length * q))];
  const median = at(0.5), worst = at(0.99);
  return { frames: s.length, median, worst, pass: median <= L.median && worst <= L.worst };
}

// stage: scene.js's; method: 1 | 2 | null (the best the browser has)
export function createBench({ stage, method = null }) {
  const gl = stage.renderer.getContext(), card = cardName(gl);
  const timer = method === 2 ? null : gl.getExtension('EXT_disjoint_timer_query_webgl2');
  let run = null;   // the test running: { t, frames: [], pending: [], invalidAt, resolve }

  // a disruption: the test is invalid from now (the time of valid frames so far is kept)
  const disrupt = () => { if (run && run.invalidAt === null) run.invalidAt = run.t; };
  addEventListener('blur', disrupt); addEventListener('resize', disrupt);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState !== 'visible') disrupt(); });
  stage.renderer.domElement.addEventListener('webglcontextlost', disrupt);

  // the card's times that have come back (method 1): each query's frame gets its cost
  function collect() {
    if (!timer || !run) return;
    const disjoint = gl.getParameter(timer.GPU_DISJOINT_EXT);
    while (run.pending.length) {
      const p = run.pending[0];
      if (!gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE)) break;
      run.pending.shift();
      const gpu = gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6;
      gl.deleteQuery(p.q);
      if (disjoint) { p.frame.dropped = true; continue; }
      p.frame.gpu = gpu; p.frame.cost = Math.max(p.frame.cpu, gpu);
    }
  }

  // one test: { pass, median, worst, frames, method, valid, card }
  function once(step) {
    return new Promise(resolve => {
      run = { t: 0, frames: [], pending: [], invalidAt: null, resolve, step, last: performance.now() };
    });
  }
  function finish() {
    const r = run; run = null;
    while (r.pending.length) gl.deleteQuery(r.pending.shift().q);
    const counted = r.frames.filter(f => f.t >= BENCH.warmup && f.cost !== undefined && !f.dropped && (r.invalidAt === null || f.t < r.invalidAt));
    const v = verdictOf(counted.map(f => f.cost), timer ? 1 : 2);
    // audit 024 F1: when the card's times were thrown away (GPU_DISJOINT) and the few frames left are within the
    // limits, there is no measurement: the test is invalid (run again, then no verdict). Re-checks R2-F1: valid frames
    // that already break the limits are a result, however few and whatever was thrown away (a slow computer draws few
    // frames); so are few frames when nothing was thrown away
    const dropped = r.frames.filter(f => f.t >= BENCH.warmup && f.dropped).length;
    const enough = counted.length > 0 && (counted.length >= BENCH.minFrames || dropped === 0 || !v.pass);
    const validFor = enough ? (r.invalidAt ?? BENCH.warmup + BENCH.measure) - BENCH.warmup : 0;
    r.resolve({ ...v, method: timer ? 1 : 2, valid: r.invalidAt === null && enough, validFor, card });
  }

  return {
    card,
    get running() { return !!run; },
    // every frame of the game's loop while a test runs (instead of the game's own step): one step of the fight drawn
    frame(now) {
      const real = (now - run.last) / 1000, dt = Math.min(real, 0.05); run.last = now;
      collect();
      const t0 = performance.now(), q = timer ? gl.createQuery() : null;
      if (q) gl.beginQuery(timer.TIME_ELAPSED_EXT, q);
      run.step(dt);
      if (q) gl.endQuery(timer.TIME_ELAPSED_EXT);
      const cpu = performance.now() - t0;
      const frame = { t: run.t, cpu };
      if (q) run.pending.push({ q, frame });
      else frame.cost = real * 1000;   // method 2: the time since the frame before
      run.frames.push(frame);
      run.t += real;   // the test's own time is the clock's (a slow frame is not shortened)
      if (run.t >= BENCH.warmup + BENCH.measure + (timer ? 0.25 : 0)) finish();   // (a moment for the last queries)
    },
    // the whole test with its retry; step(dt): one frame of the fight, drawn. Returns { verdict: 'pass' | 'weak' | null, … }
    async test(step) {
      let r = null;
      for (let i = 0; i <= BENCH.retries; i++) {
        r = await once(step);
        if (r.valid) return { verdict: r.pass ? 'pass' : 'weak', ...r };
        if (r.validFor >= BENCH.minValid && !r.pass) return { verdict: 'weak', ...r };
      }
      return { verdict: null, ...r };
    },
    // the remembered result for this card and this version of the game (null: none, test again)
    get stored() { const s = read(BENCH.store); return s && s.card === card && s.build === BUILD ? s : null; },
    remember(r) { if (r.verdict) write(BENCH.store, { card, build: BUILD, verdict: r.verdict, median: r.median, worst: r.worst, method: r.method, size: r.size }); },
    forget() { write(BENCH.store, null); },
    // "Play anyway" (remembered for this card)
    get anyway() { return read(BENCH.anyway)?.card === card; },
    playAnyway() { write(BENCH.anyway, { card }); },
  };
}
