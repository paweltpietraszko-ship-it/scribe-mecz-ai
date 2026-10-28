// Task 027 (K1), task 028: what the PvP server's engine would tell the pictures and the sounds, kept as the step's
// events (sim/engine.js opt.capture): the shots' pictures (each fighter's own: a window shows its own shots itself),
// the machine's sounds and signals. The server sends them to the windows (scripts/pvp-room.mjs); a window plays them
// (net/other.js).

// three's vectors in the events become arrays on the way (net/other.js makes them vectors again)
const out = a => (a?.isVector3 ? { v3: [a.x, a.y, a.z] } : a);

// on the server: what the pictures and the sounds would have been told, kept as events (kind, name, arguments)
// (tag, task 028: whose they are, 'a' | 'b': a window shows its own fighter's shots itself, at once)
export function recorder(kind, events, tag = null) {
  return new Proxy({}, {
    get: (_, name) => (name === 'then' ? undefined : (...args) => {
      const e = [kind, name, args.map(a => (a && typeof a === 'object' && !a.isVector3 ? Object.fromEntries(Object.entries(a).map(([k, v]) => [k, out(v)])) : out(a)))];
      if (tag) e.push(tag);
      events.push(e);
      return undefined;
    }),
  });
}
