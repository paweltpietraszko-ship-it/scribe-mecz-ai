// Task 031 (zadania/031_ranking.md): the PvP ranking's numbers. The server rates every ranked match with OpenSkill
// (Plackett-Luce, its defaults: mu 25, sigma 25/3) and shows a player points made from the rating's ordinal
// (mu − 3·sigma, the "surely at least this good" figure): points = base + scale × ordinal, rounded. A new account's
// ordinal is 0, so it starts at `base`.
export const RANK = {
  base: 1000,
  scale: 20,      // (zadania/031_raport.md: about +12 for a win against an equal once the rating has settled)
  placement: 5,   // the first matches: no place in the table yet ("placement · 3/5"); points count from the start
  history: 20,    // the recent ranked matches kept per account (opponent's nick then, result, change, date)
  top: 3,         // the table on the start screen: the first three, then the player's own place
  nick: { min: 3, max: 16, pattern: /^[A-Za-z0-9_-]+$/ },
};

// Task 032 (C1, DECISIONS 07.10): a sign-in's token is good for tokenDays, then the player is a guest again and signs in
// with one click; "Sign out" ends every token of the account on every device
export const ACCOUNT = {
  tokenDays: 30,
  // task 033 (E; Paweł 07.10: „powinniśmy chyba szybciej usuwać dane niż po 2 latach”): an account with no sign-in,
  // match or nick change for this many days is deleted (zadania/033_raport.md: why 12 months)
  inactiveDays: 365,
};
