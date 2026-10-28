// Task 026 (point 6, U44): the game installed as an app (public/manifest.webmanifest: full screen, the seal "4" as its
// icon). Chrome and Edge offer it with the event beforeinstallprompt; the game keeps it (no window of the browser's own
// at the start) and shows "Install the game" in the pause's Settings only while the browser offers it. The browser's
// question needs a click or a key (a pad's button does not count, as for the full screen, task 022): from the pad the
// item says so instead.
// the game runs as the installed app (its own window, no browser's bar to close it): checked once at the start, before
// the welcome screen's full screen (a browser's tab on full screen would count as "fullscreen" too)
// (?app: as in the app, for the tests: Chrome cannot pretend the display mode)
export const inApp = ['standalone', 'fullscreen', 'minimal-ui'].some(m => matchMedia(`(display-mode: ${m})`).matches)
  || new URLSearchParams(location.search).has('app');
// Paweł 02.10.2026: "zapomnieliśmy o przycisku wyjdź z gry": the app's window closed by the game (a page may close a
// window whose history has only itself, which is the app's)
export const quitApp = () => window.close();

export function createInstall({ onChange = () => {} } = {}) {
  let offer = null, needsKey = false;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); offer = e; onChange(); });
  addEventListener('appinstalled', () => { offer = null; needsKey = false; onChange(); });
  return {
    get available() { return !!offer; },
    get needsKey() { return needsKey; },
    // the browser's own question (its answer comes back by itself: appinstalled, or the offer stays)
    async ask() {
      if (!offer) return;
      if (!navigator.userActivation?.isActive) { needsKey = true; onChange(); return; }
      needsKey = false;
      const o = offer;
      offer = null;   // (one offer, one question: the browser offers again by itself when it may)
      try { await o.prompt(); await o.userChoice; } catch { offer = o; needsKey = true; }
      onChange();
    },
  };
}
