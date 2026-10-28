// Task 033 (audit r4 B1): the itch.io build's stand-in for @colyseus/sdk's Storage.mjs (vite.config.js swaps it in for
// that build only). Every itch.io game shares the frame's address and its browser storage, so the guest-only build
// must not even read the SDK's sign-in key: nothing is read, written or removed; the SDK's token stays empty.
export function getItem(key, callback) { callback(null); }
export function setItem() {}
export function removeItem() {}
