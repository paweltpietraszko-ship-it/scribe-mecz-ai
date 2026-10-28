// Task 031 (K1, K2): the window's account. Sign-in with Google or Discord through the server (@colyseus/auth: a small
// window of the provider's, then a signed token the SDK keeps in this browser and sends with every join); the
// account's own calls (scripts/pvp-accounts.mjs, /api/account/…): the account, the ranking's table, the nick, delete.
// No account is needed to play: without one (or without the server's accounts) everything stays as before 031.
import { Client } from '@colyseus/sdk';
import { ITCH, serverAddress as base, fullGame } from './where.js';

// Task 032 (C5): the SDK's sign-in (@colyseus/sdk 0.18.4 and 0.18.5, Auth.mjs: "TODO: it is a good idea to check if
// event.origin can be trusted") takes a token from any window's message. Only our server's return page may hand one
// over: a message with a token or a user from another origin is stopped before the SDK's listener hears it (a listener
// for the capture, on the window, runs before the SDK's own)
if (typeof window !== 'undefined') {
  addEventListener('message', e => {
    const d = e.data;
    if (d && typeof d === 'object' && ('token' in d || 'user' in d) && e.origin !== new URL(base()).origin) e.stopImmediatePropagation();
  }, true);
}

// onChange(): the account or the table changed (the screens draw them again)
export function createAccount({ onChange = () => {} } = {}) {
  if (ITCH) return createGuest({ onChange });
  const client = new Client(base());
  let me = null, board = null, state = 'unknown';   // state: 'unknown' | 'guest' | 'signed' | 'off' (no accounts on the server)
  let ended = false;   // task 032 (C2): the server stopped taking this window's token (it ran out, or "Sign out" elsewhere)
  const call = async (path, body) => {
    const r = await fetch(`${base()}/api/account/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { ...(client.auth.token ? { authorization: `Bearer ${client.auth.token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  };
  async function refresh() {
    try {
      const b = await call('board');
      if (!b.ok || b.data?.off) { state = 'off'; me = null; board = null; onChange(); return; }   // (a server without accounts)
      board = b.ok ? b.data : null;
      if (client.auth.token) {
        const m = await call('me');
        if (m.ok) { me = m.data; state = 'signed'; ended = false; } else { me = null; state = 'guest'; if (m.status === 401) { client.auth.signOut(); ended = true; } }
      } else { me = null; state = 'guest'; }
    } catch { state = 'off'; }
    onChange();
  }
  // the token left by the provider's return page (Google's sign-in cuts the window's link to it): taken from storage
  addEventListener('storage', e => { if (e.key === 'colyseus-auth-token' && e.newValue && e.newValue !== client.auth.token) { client.auth.token = e.newValue; refresh(); } });
  // (asked for only when needed: PVP chosen or Settings opened; the bot's game never asks the server, 031 K8)
  let asked = false;
  return {
    // the first time a screen needs it
    need() { if (!asked) { asked = true; refresh(); } },
    get state() { return state; },
    get me() { return me; },
    get board() { return board; },
    // the token now (null: a guest); net/pvp.js tells the room when it changes (audit r4 B1)
    get token() { return client.auth.token ?? null; },
    canSignIn: true,
    // the provider's window (a click: browsers open it only then); resolves when it closed
    async signIn(provider) {
      try { await client.auth.signInWithProvider(provider); } catch { /* closed or refused */ }
      // (the return page may have left the token in storage without reaching this window)
      try { const kept = localStorage.getItem('colyseus-auth-token'); if (kept && kept !== client.auth.token) client.auth.token = kept; } catch { /* storage blocked */ }
      ended = false;
      await refresh();
    },
    // task 032 (C2): signs the account out everywhere (the server ends all its tokens), then this window
    async signOut() { await call('signout', {}).catch(() => {}); client.auth.signOut(); me = null; state = 'guest'; ended = false; refresh(); },
    // the room said this window's token no longer counts (net/pvp.js): a guest, shown as signed out
    dropped() { client.auth.signOut(); me = null; state = 'guest'; ended = true; refresh(); },
    get ended() { return ended; },
    // the nick (K2): null when taken, else the error's key ('form', 'taken')
    async setNick(nick) { const r = await call('nick', { nick }); if (r.ok) { me = r.data; await refresh(); return null; } return r.data?.error ?? 'form'; },
    // delete the account and everything kept of it (K2): null when done, 'match' while in a PvP match
    async remove() {
      const r = await call('delete', {});
      if (!r.ok) return r.data?.error ?? 'error';
      client.auth.signOut(); me = null; state = 'guest'; await refresh(); return null;
    },
    refresh,
  };
}

// Task 033 (A0, B3): the itch.io build: a guest only. No SDK client (it reads the stored token as it is made), no token
// read, written or sent; the ranking's table read without one; "sign in" opens the full game on Railway in a new tab
function createGuest({ onChange }) {
  let board = null, state = 'unknown', asked = false;
  async function refresh() {
    try {
      const r = await fetch(`${base()}/api/account/board`, { credentials: 'omit' });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.off) { state = 'off'; board = null; } else { state = 'guest'; board = data; }
    } catch { state = 'off'; }
    onChange();
  }
  return {
    canSignIn: false,
    need() { if (!asked) { asked = true; refresh(); } },
    get state() { return state; },
    get me() { return null; },
    get board() { return board; },
    get token() { return null; },
    get ended() { return false; },
    async signIn() { open(fullGame(), '_blank', 'noopener'); },
    async signOut() {}, dropped() {}, async setNick() { return 'form'; }, async remove() { return 'error'; },
    refresh,
  };
}
