// Task 031 (K2, K5, K7): the ranking on the screens, as reference/ekrany_meczu.html draws it. The start screen in
// "PVP": the table on the right (the first three, the player's own place; a guest: sign in with Google / Discord; a
// new account: its nick first). The PvP result: the new points, the change and why. The account's window (#acct): the
// nick's form and the privacy text. Everything shown comes from the server (net/account.js, net/pvp.js: the room's
// state): the window reckons no points.
import { RANK } from '../data/rank.js';
import { t } from '../i18n/index.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');   // (1 284, as the reference)
const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(Math.round(n));

// account: net/account.js; pvp: net/pvp.js; nickDefault(): the nick typed on the start screen (the form's first guess)
export function createRanking({ account, pvp, nickDefault = () => '' }) {
  const board = $('mBoard'), bar = $('mRank'), win = $('acct');
  let shown = '', mode = null, last = '';   // mode: the account window's: 'nick' | 'privacy' | 'credits' (task 032) | null

  // the table: drawn again when the account, the table or the language changed
  function drawBoard() {
    const st = account.state, me = account.me, b = account.board;
    if (st === 'off' || st === 'unknown') return `<h3>${t('rank.title')}</h3><div class="note">${t(st === 'off' ? 'rank.off' : 'w.wait')}</div>`;
    const row = (r, mine = false) => `<div class="b${mine ? ' mine' : ''}"><span>${r.place}</span><span>${esc(r.nick)}</span><span>${r.wins}–${r.losses}</span><span>${num(r.points)}</span></div>`;
    const head = `<div class="b head"><span>#</span><span>${t('rank.player')}</span><span>${t('rank.wl')}</span><span>${t('rank.points')}</span></div>`;
    const top = b?.top?.length ? b.top.map(r => row(r, me && r.nick === me.nick)).join('') : `<div class="note">${t('rank.empty')}</div>`;
    let own = '';
    // (task 033 B3: in itch.io's frame no sign-in: one button opens the full game on Railway in a new tab)
    if (st === 'guest' && !account.canSignIn) own = `<div class="note">${t('rank.signIn')}</div><div class="sign"><button data-full>${t('rank.full')}</button></div>`;
    else if (st === 'guest') own = `<div class="note">${t(account.ended ? 'rank.signedOut' : 'rank.signIn')}</div><div class="sign"><button data-sign="google">${t('rank.google')}</button><button data-sign="discord">${t('rank.discord')}</button></div>`;
    else if (me && !me.nick) own = `<div class="note">${t('rank.pickNick')}</div><div class="sign"><button data-nick>${t('pause.nick')}</button></div>`;
    else if (me && me.placement > 0) own = `<div class="b mine"><span>–</span><span>${esc(me.nick)}</span><span>${me.wins}–${me.losses}</span><span>${num(me.points)}</span></div><div class="note">${t('rank.placement', { n: me.matches, of: RANK.placement })}</div>`;
    else if (b?.mine && !b.top.some(r => r.nick === me?.nick)) own = `<div class="gap">⋮</div>${row(b.mine, true)}`;
    return `<h3>${t('rank.title')}</h3>${head}${top}${own}`;
  }
  board.addEventListener('click', e => {
    const p = e.target.closest('[data-sign]')?.dataset.sign;
    if (p) account.signIn(p).then(() => { if (account.me && !account.me.nick) openNick(); });
    else if (e.target.closest('[data-nick]')) openNick();
    else if (e.target.closest('[data-full]')) account.signIn();
  });

  // the account's window: the nick (K2) or the privacy text (K7)
  function open(m) {
    mode = m; win.hidden = false; $('acctErr').textContent = '';
    $('acctTitle').textContent = t(m === 'nick' ? 'rank.pickNick' : m + '.title');
    $('acctText').textContent = m === 'nick' ? t('rank.nickRules') : t(m + '.text');
    $('acctLinks').hidden = m !== 'credits'; $('acctLicences').textContent = t('credits.licences');
    $('acctForm').hidden = m !== 'nick';
    $('acctOk').textContent = t(m === 'nick' ? 'rank.save' : 'rank.close');
    $('acctCancel').hidden = m !== 'nick'; $('acctCancel').textContent = t('rank.cancel');
    if (m === 'nick') { const i = $('acctNick'); i.value = account.me?.nick || nickDefault().replace(/[^A-Za-z0-9_-]/g, '').slice(0, RANK.nick.max); i.focus(); i.select(); }
  }
  const close = () => { mode = null; win.hidden = true; };
  const openNick = () => open('nick');
  async function save() {
    if (mode !== 'nick') { close(); return; }
    const e = await account.setNick($('acctNick').value.trim());
    if (e) $('acctErr').textContent = t(e === 'taken' ? 'rank.nickTaken' : 'rank.nickForm'); else close();
  }
  $('acctOk').addEventListener('click', save);
  $('acctCancel').addEventListener('click', close);
  win.addEventListener('keydown', e => { if (e.code === 'Enter') { e.preventDefault(); save(); } else if (e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } });

  return {
    openNick, openPrivacy: () => open('privacy'), openCredits: () => open('credits'), close,
    get open() { return !!mode; },
    // every frame: s: the match screen's state (ui/screens.js), pvpMode: "PVP" chosen
    update(s, pvpMode) {
      if (pvpMode) { account.need(); if (s === 'start' && last !== 'start') account.refresh(); }   // (back on the start screen: the table as it is now)
      last = s;
      const on = s === 'start' && pvpMode;
      if (board.hidden === on) board.hidden = !on;
      if (on) {
        const key = JSON.stringify([account.state, account.ended, account.me, account.board, t('rank.title')]);
        if (key !== shown) { shown = key; board.innerHTML = drawBoard(); }
      }
      // the result of a ranked match: the points, the change and why (K5); the server's numbers only
      const r = (s === 'mwin' || s === 'mlose') ? pvp?.rank : null, show = !!(r && r.why);
      if (bar.hidden === show) bar.hidden = !show;
      if (show) {
        $('mRankPts').textContent = num(r.points);
        $('mRankDelta').textContent = signed(r.delta);
        const why = t('rank.why.' + r.why, { nick: r.whyNick, pts: num(r.whyPoints), eq: signed(r.equal) }) + (r.placement > 0 ? t('rank.why.placement', { n: r.placement }) : '');
        $('mRankWhy').textContent = why;
      }
    },
  };
}
