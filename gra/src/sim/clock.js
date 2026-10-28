// Task 027 (K2): the fixed step ("fix your timestep"): the drawn frames' time goes into an accumulator, the fight takes
// whole steps of SIM.step from it (at most SIM.maxSteps a frame), and alpha (0..1) says how far the frame is between
// the last two steps (look/smooth.js draws there).
import { SIM } from '../data/arena.js';

export function createClock({ step = SIM.step, maxSteps = SIM.maxSteps } = {}) {
  let acc = 0;
  return {
    step,
    // a drawn frame's dt (s): the number of steps to take now
    advance(dt) {
      acc += dt;
      const n = Math.min(maxSteps, Math.floor(acc / step));
      acc = n === maxSteps ? Math.min(acc - n * step, step) : acc - n * step;   // (a slow frame: the rest let go)
      return n;
    },
    get alpha() { return Math.min(1, acc / step); },
    reset() { acc = 0; },
  };
}
