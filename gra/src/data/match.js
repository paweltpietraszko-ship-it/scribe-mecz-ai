// The match (task 022, DECISIONS.md 29.09.2026 "Zasady meczu i ekrany meczu"; Paweł 01.10.2026: "3 minuty to będzie czas
// naprawdę dla topowych graczy PvP": 3:00 is the upper bound, not a usual round). All in s.
// winsToWin: rounds a fighter must win; roundTime: the round's clock, then the overtime (SCRIBE's final phase starts
// with it, data/scribe.js `final`); after the overtime more health wins, equal health: the round does not count and is
// played again. countdown: before a round (the first one shows the weapon: firstCountdown); card: the card after a round
// (then the next round's countdown, or the match's result, which waits for "Again" or "Leave")
export const MATCH = {
  winsToWin: 2,
  roundTime: 180,
  overtime: 30,
  countdown: 3,
  firstCountdown: 5,
  card: 5,
  // ?botvbot (tests): the next match starts by itself after the result is shown this long
  autoAgain: 3,
  // s the hint "F11 or click for full screen" shows after a start with the pad (the browser allows the full screen
  // only after a click or a key)
  fullscreenHint: 6,
};

// Task 027 (K7): PvP on the laptop (etap 1). port: the local server's (npm run pvp:server); url: where a window finds
// it (the page's host on that port); level: the rules' level the server's round runs on (SCRIBE runs, nobody is a
// Dummy; no bot); queue: views the window keeps before showing them (1: the newest whole step behind; more: smoother
// over a jittery link); catchUp: above this many views waiting, the window shows the extra ones at once; wordTime: s a
// passing word shows (the match is on, the opponent left, the connection is lost)
// idleStop (task 033): s with no pad, key or mouse after which a window searching for a match stops searching
export const PVP = { port: 2567, level: 'normal', queue: 1, catchUp: 3, wordTime: 4, idleStop: 600,
  // Task 028 (zadania/028_pvp_etap2.md; ping = there and back, ms). sendRate: the room's state patches a second (the
  // fight steps 60 times a second); buffer: ms the window shows the other "back in time" to smooth it, and the same ms
  // the server rewinds a shot by (one number: what you see is what you hit); fullRewind: the ping fully compensated
  // (DECISIONS.md 03.10.2026: 100 ms; the rewind limit is fullRewind + buffer + one step); inputBacklog: above this
  // many actions waiting, the server takes two a step (a bunch after a jittery link); inputMax: actions kept waiting at
  // most; smoothMs: the time constant a correction of the own fighter fades over; snap: m, a correction above it is a
  // jump (a new round's start), not an error to glide over; warmSteps: the server's first steps left out of its cost
  // (K7); lag.retransmit: ms a "lost" message comes later (net-lag.mjs, K1)
  // followMs: the time constant the other's drawn moment follows its aim with (a break in the patches: caught up
  // softly); jumpMs: further than this from its aim, the moment jumps there (the start, a long break)
  sendRate: 30, buffer: 100, fullRewind: 100, inputBacklog: 1, inputMax: 600, smoothMs: 80, snap: 2, warmSteps: 300,
  // jumpSpeed: m/s; the other drawn moving faster in a step is a jump on the screen (K4's count: the sprint is 6.8)
  followMs: 250, jumpMs: 1000, jumpSpeed: 9,
  // Task 029 (zadania/029_pvp_railway.md), s: inviteTime: a link to a friend works this long while its maker waits;
  // acceptTime: two players paired by Play have this long to both take the match (K4; a link: no limit);
  // reconnectTime: a player whose link dropped mid-match may come back this long, the match standing (K5)
  inviteTime: 900, acceptTime: 20, reconnectTime: 20,
  // matches at once on one server (Paweł 03.10.2026, after K9: "tylko 3 bo to pewne"; zadania/029_raport.md): a pair
  // is a match's engine, so a join that would make one more pair is refused (the window: the server is full); one
  // waiting alone costs the server nothing and may always wait
  maxMatches: 3,
  // ...and fewer when the server is busy (Paweł 03.10: "3 to maks ale nie obiecujemy, że tak będzie zawsze"): the
  // process's beat (all rooms' work in the same 1/60 s, as K9 measures it) over the last `beats` beats has its 99 %
  // above `p99` ms: a new pair is refused the same way, the matches on go on
  busy: { beats: 600, p99: 12 },
  // task 031 (Paweł 06.10): a player refused (full or busy) is told to Paweł's Discord channel: the first at once, the
  // next ones of the same `every` s as one summary (scripts/pvp-alerts.mjs; DISCORD_WEBHOOK_URL in Railway's variables)
  alerts: { every: 3600 },
  lag: { retransmit: 200 },
};
