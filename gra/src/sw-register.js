// Task 024 (K3): the service worker (sw.src.js, made at the build) keeps the game's files for the next launch. Only in
// the built game (the dev server changes files under the same names). The first time it takes the page, it is told
// what the page fetched before (it keeps those from the browser's cache).
// ms after the start the browser is asked for a new version of the game (it does not always look by itself;
// scripts/check-update.mjs)
const UPDATE_AFTER = 5000;

export function registerWorker() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const sw = navigator.serviceWorker;
  const tell = () => sw.controller?.postMessage({ type: 'fetched', urls: performance.getEntriesByType('resource').map(e => e.name) });
  sw.addEventListener('controllerchange', tell);
  // a version installed during an earlier launch and still waiting takes over now, at this page's start (before any
  // match): this page is of that version already (index.html never comes from a cache)
  sw.register('sw.js').then(reg => { if (reg.waiting) reg.waiting.postMessage({ type: 'activate' }); })
    .catch(e => console.warn('service worker:', e));
  // a new version found now waits for the next launch
  setTimeout(() => sw.getRegistration().then(r => r?.update()).catch(e => console.warn('service worker update:', e)), UPDATE_AFTER);
}
