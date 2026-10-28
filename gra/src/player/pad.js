// Task 027 (PvP on one laptop: two windows, two pads): the pad this window listens to. ?pad=N: the N-th pad connected
// (1, 2, …); without it the first one, as before. Every reader of the pad asks here (the controls, the screens, the
// pause, the welcome screen, the performance test's screen, the sound's start).
const asked = Math.max(1, +(new URLSearchParams(globalThis.location?.search ?? '').get('pad') ?? 1) || 1);

export function myPad() {
  const pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(p => p && p.connected);
  return pads[asked - 1] ?? null;
}
