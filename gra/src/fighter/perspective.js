// Task 027 (K7): the match as side B sees it. The PvP server's round counts from side A (the host: "me" is A); the
// window of side B shows the same match from its own side: its own wins as "me", the cards' facts its own (the server
// makes both: fighter/round.js result.b, statsB), every winner turned round. Side A's window takes them as they are.
const turn = w => (w === 'me' ? 'foe' : w === 'foe' ? 'me' : w);
const wins = w => ({ me: w.foe, foe: w.me });
const result = r => r && { ...r, ...r.b, winner: turn(r.winner) };

export function roundFor(side, v) {
  if (side === 'a') return v;
  return { ...v, wins: wins(v.wins), results: v.results.map(result), card: result(v.card), winner: turn(v.winner),
    score: { me: v.score.foe, foe: v.score.me, draws: v.score.draws } };
}

export function eventFor(side, kind, data) {
  if (side === 'a') return data;
  if (kind === 'roundEnd') return result(data);
  if (kind === 'matchEnd') return { winner: turn(data.winner), wins: wins(data.wins), results: data.results.map(result), stats: data.statsB };
  return data;
}
