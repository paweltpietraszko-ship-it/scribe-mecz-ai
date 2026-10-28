// The characters (task 023, A): the look the player chose on the start screen, and the opponent's (Paweł 01.10.2026:
// always the same character, OPPONENT in data/hero.js, with the machine's script on it: look/double.js). Only the files
// worn are fetched (task 026: a download no longer needed after a new choice is stopped); a new choice fetches what is missing, puts the looks on the bodies (player/hero.js wearLook: the
// same skeleton, only the look changes) and frees the ones no longer worn. The choice is the player's data in the match
// (its key, like the nick: a PvP server could send it to the other side; nothing is sent today), remembered.
import { CHARACTERS, CHARACTER_ORDER, CHARACTER_VIEW as V, OPPONENT, SUIT, CHARACTER_FETCH } from '../data/hero.js';
import { loadLook, wearLook, disposeLook } from '../player/hero.js';
import { dressDouble } from './double.js';
import { addRim } from './rim.js';

const KEY = 'theone.character';
// the opponent's character for the player's
const opponentFor = k => (k === OPPONENT.key ? OPPONENT.instead : OPPONENT.key);

// player, foe: the fighters; look: the model the game started with (assets.model, of SUIT, worn by both bodies); rimmed():
// the fighters whose bodies have the rim (look/rim.js); me: the player's data in the match (round.me: character, nick)
export function createCharacters({ player, foe, look, rimmed = () => [foe], me = {} }) {
  let key = SUIT, ask = 0;
  let theirs = null;   // task 027: PvP: the other player's character (null: the bot's, OPPONENT)
  const foeKey = () => theirs ?? opponentFor(key);
  // key → { look: its promise, stop: the download's AbortController while it loads }
  const looks = new Map([[SUIT, { look: Promise.resolve(look), stop: null }]]);
  // wait: a choice in the menu (CHARACTER_FETCH.delay before the download starts)
  function get(k, wait = false) {
    if (!looks.has(k)) {
      const e = { stop: new AbortController() }, signal = e.stop.signal;
      const after = wait ? new Promise(r => setTimeout(r, CHARACTER_FETCH.delay * 1000)) : Promise.resolve();
      e.look = after.then(() => { signal.throwIfAborted(); return loadLook(CHARACTERS[k]?.file ?? 'bohaterka.glb', signal); });
      e.look.then(() => { e.stop = null; }, () => {});
      looks.set(k, e);
    }
    return looks.get(k).look;
  }
  // task 026: the looks still loading that the choice k does not need: stopped and forgotten (a loaded look waits: a
  // body may wear it until the new ones are on)
  function stopUnneeded(k) {
    for (const [key, e] of looks) if (e.stop && key !== k && key !== (theirs ?? opponentFor(k))) { e.stop.abort(); looks.delete(key); }
  }
  // the Double's own materials (its script) go with the look they were made for
  const dropOwn = body => body.model.traverse(o => { if (o.isMesh && o.material.userData.own) o.material.dispose(); });
  me.character = key;

  // both bodies in their looks; the looks nobody wears freed
  async function apply(wait = false) {
    const mine = ++ask, pk = key, fk = foeKey();
    let pl, fl;
    try { [pl, fl] = await Promise.all([get(pk, wait), get(fk, wait)]); }
    catch (e) { if (mine !== ask) return; throw e; }   // (a download stopped by a newer choice)
    if (mine !== ask) return;   // another choice came meanwhile
    dropOwn(foe.body); dropOwn(player.body);
    wearLook(player.body, pl); wearLook(foe.body, fl);
    if (!theirs) dressDouble(foe.body);   // (the machine's script marks the bot; a person in PvP wears its own look)
    rimmed().forEach(f => addRim(f.body));
    for (const [k, e] of looks) if (k !== pk && k !== fk) { looks.delete(k); e.stop?.abort(); e.look.then(disposeLook, () => {}); }
  }
  async function choose(k) {
    if (!CHARACTERS[k] || k === key) return;
    try { localStorage.setItem(KEY, k); } catch { /* storage blocked */ }
    key = k; me.character = k;
    stopUnneeded(k);
    current = apply(true);
    return current;
  }
  let current = apply();   // the latest choice put on (the first: the opponent's look at the start)
  const ready = current;
  // audit 024 F3: resolves when the looks of the character chosen last (and its opponent) are on, whatever was chosen
  // meanwhile
  async function settled() { let p; do { p = current; await p; } while (p !== current); }

  return {
    get key() { return key; },
    get opponent() { return foeKey(); },
    // task 027 (K7): PvP: the other player's character on the opponent's body (null: back to the bot's); a promise
    setOpponent(k) {
      const want = CHARACTERS[k] ? k : null;
      if (want === theirs) return current;
      theirs = want; current = apply();
      return current;
    },
    ready, choose, settled,
    // the start screen: the camera in front of the player's figure (yaw: where the figure faces), after the TPP camera
    showcase(camera, yaw) {
      const f = player.feet, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      camera.position.set(f.x + fx * V.ahead, f.y + V.height, f.z + fz * V.ahead);
      camera.lookAt(f.x - fz * V.side, f.y + V.height - V.drop, f.z + fx * V.side);
    },
    // d: +1 the next one on the start screen's list, -1 the one before
    step(d) { const i = CHARACTER_ORDER.indexOf(key); return choose(CHARACTER_ORDER[(i + d + CHARACTER_ORDER.length) % CHARACTER_ORDER.length]); },
  };
}
