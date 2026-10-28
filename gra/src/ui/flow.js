// The way through a match (task 022): the screens (ui/screens.js), the music (audio/music.js), the full screen and
// the mouse's capture, wired to the match's state (fighter/round.js), so main.js only connects them.
// D1: Play with a click or Enter turns on the full screen and captures the mouse (the browser allows both only after a
// click or a key, not after a pad's button): started with the pad, a short hint says how (MATCH.fullscreenHint s).
// D2: the pause's Full screen on / off; leaving the full screen (Esc) leaves the pause and the match as they are.
// The mouse is free on the start screen and on the match's result (their buttons), captured in the rest of the match.
import { MATCH } from '../data/match.js';
import { createScreens } from './screens.js';
import { createMusic } from '../audio/music.js';

// round: the match's state; match: its seed and weapon (fighter/match.js); dom: the canvas; pause; audio: the sound
// engine (its Volume scales the music); input: the player's (held buttons do not act when a round starts); quiet: no
// music (?botvbot, ?freeze); showHint(): the controls hint (the start screen's Controls; task 030: only that);
// characters: look/characters.js (task 023: chosen on the start screen)
// pvp: net/pvp.js (task 027: in PvP, Play is "ready", Again a vote, Leave leaves the room)
export function createFlow({ round, match, dom, pause, audio, input, quiet, showHint, characters, pvp = null }) {
  const fsHint = document.getElementById('fsHint'), wait = document.getElementById('wait');
  let hintLeft = 0;
  // (task 026: the installed app on full screen from its start counts as the full screen)
  const full = () => !!document.fullscreenElement || matchMedia('(display-mode: fullscreen)').matches;
  const capture = () => { try { dom.requestPointerLock?.()?.catch?.(() => {}); } catch { /* not allowed now */ } };
  const goFull = () => document.documentElement.requestFullscreen?.().catch(() => {});

  function play(byPad, invite = false) {
    if (byPad) { if (!full()) hintLeft = MATCH.fullscreenHint; }
    // audit 022 F2: the mouse first; asking for the full screen uses up the click's permission
    else { capture(); goFull(); }
    // task 029: in "Vs player" the bot's match starts and the window looks for an opponent (or makes a friend's link)
    if (pvp?.active) { if (invite) pvp.invite(round.me.nick); else pvp.play(round.me.nick); } else round.startMatch();
  }
  const screens = createScreens({
    round, weapon: () => match.weapon,
    onPlay: play,
    onInvite: byPad => play(byPad, true),
    // (the full screen stays on; task 029: the server's match ended votes for another, the bot's match while looking for
    // an opponent starts again)
    onAgain: () => { if (round.phase === 'end') { capture(); if (pvp?.connected && pvp.status === 'end') pvp.again(); else round.startMatch(); } },
    onLeave: () => { if (round.phase === 'end') { if (pvp?.active) pvp.leave(); else round.leave(); } },
    onControls: showHint, onSettings: () => pause.settings(), characters, pvp,
  });
  const music = quiet ? null : createMusic({ round, master: () => audio.volume });

  // the result and the start screen: the mouse is let go for their buttons (task 030, K2: the controls only when asked
  // for, the start screen's and the pause's Controls; Paweł 06.10: before it was closed the bot was shooting)
  round.on(kind => {
    if ((kind === 'matchEnd' || kind === 'menu') && document.pointerLockElement) document.exitPointerLock();
    if (kind === 'roundStart') input.swallow();
  });
  document.addEventListener('fullscreenchange', () => { if (full()) hintLeft = 0; if (pause.open) pause.refresh(); });

  return {
    screens, music,
    // the match wants the mouse captured now (a click into the game captures it; losing it opens the pause)
    get wantsLock() { return !['menu', 'end', 'loading'].includes(round.phase); },
    // a click into the game while the full screen hint shows: the full screen (D1)
    click() { if (hintLeft > 0 && !full()) goFull(); },
    fullscreen: { get: full, set: v => (v ? goFull() : document.exitFullscreen?.().catch(() => {})) },
    // every frame; visible: the Play view with the test panel closed
    update(dt, visible) {
      screens.update(visible);
      music?.update(dt);
      if (hintLeft > 0) hintLeft -= dt;
      const show = visible && hintLeft > 0;
      if (fsHint.hidden === show) fsHint.hidden = !show;
      // task 024: the loading sign while the first match waits for its files
      const waiting = round.phase === 'loading' && !round.winner;
      if (wait.hidden === waiting) wait.hidden = !waiting;
    },
  };
}
