// Mecz modeli (próba 28.10): „ciało” postaci, którą prowadzi model. Model jest mózgiem (wydaje rozkazy), ciało ma te
// same oczy (bot/senses.js), ręce (bot/aim.js, poziom rąk z LEVELS) i nogi (siatka nawigacji) co bot gry. Ciało nie
// podejmuje decyzji taktycznych: idzie tam, gdzie kazano, chowa się za wskazaną bryłą, strzela tylko wtedy, gdy rozkaz
// na to pozwala i oczy widzą cel. Ładowane przez Vite jak moduły gry (gra.mjs), więc importy są względem folderu gry.
import { LEVELS, BOT } from '/src/data/bot.js';
import { COVER as C } from '/src/data/cover.js';
import { TURNTABLE } from '/src/data/arena.js';
import { idleAction } from '/src/fighter/actions.js';
import { createSenses } from '/src/bot/senses.js';
import { createAim } from '/src/bot/aim.js';

const [TX, TZ] = TURNTABLE.center;
const EYE = 1.6, CHEST = 1.25, CROUCH_EYE = 1.0;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
// współrzędne dla modelu: (X, Y) w metrach od środka obrotnicy, Y na północ (ku ścianie paneli, −Z gry)
export const toXY = p => [+(p.x - TX).toFixed(1), +(TZ - p.z).toFixed(1)];
export const fromXY = ([X, Y]) => ({ x: X + TX, z: TZ - Y });
// kierunek kompasowy (0 = północ, 90 = wschód) z przesunięcia w świecie gry; i z kąta yaw postaci
const DEG = 180 / Math.PI;
export const bearing = (dx, dz) => Math.round((Math.atan2(dx, -dz) * DEG + 360) % 360);
export const bearingOfYaw = yaw => Math.round((360 - (yaw * DEG) % 360 + 360) % 360);
const yawOfBearing = b => -b * (Math.PI / 180);   // (jak THREE.MathUtils.degToRad)

// e: silnik (sim/engine.js), side: 0 (A) | 1 (B), hands: poziom rąk z LEVELS (ten sam dla obu)
// THREE: biblioteka three.js gry (ta sama kopia co silnik: gra.mjs), bo ten plik leży poza folderem gry
export function createBody({ THREE, e, side, hands = 'normal', rand, hearRand }) {
  const me = e.fighters[side], other = e.fighters[1 - side], { ballistics, nav } = e;
  const level = LEVELS[hands];
  const senses = createSenses({ me, other, ballistics, rand });
  const aim = createAim(level, me.spawn.yaw, rand);
  const cover = me.cover, eyes = new THREE.Vector3(), target = new THREE.Vector3(), look3 = new THREE.Vector3();
  const a3 = new THREE.Vector3(), b3 = new THREE.Vector3();
  let order = { move: 'stay', fire: 'at_enemy' }, status = 'new', a = idleAction(me.spawn.yaw);
  let goal = null, spot = null, path = [], pathFor = null, pathAge = 0, best = Infinity, progressT = 0, coverTries = 0;
  let peek = { on: false, t: 0 }, blindT = 0, semiT = 0, medkitPressed = false, dodgePressed = false;
  // to, co ciało zbiera dla następnego widoku modelu (zdarzenia od ostatniej decyzji)
  const log = { hits: [], heard: [], markers: 0 };

  const sees = (from, to, h1 = EYE, h2 = CHEST) => ballistics.clear(a3.set(from.x, h1, from.z), b3.set(to.x, h2, to.z));
  // miejsca przy bryle `owner` (jak brain.js spots(): rogi osłony, środek niskiej), z których nie widać punktu `from`
  function spotsOf(owner) {
    const out = [];
    for (const l of cover.lines) {
      if (l.owner !== owner || !cover.valid(l)) continue;
      const add = (along, sideK, lean) => {
        const p = cover.standAt(l, along), q = p.clone().addScaledVector(l.dir, sideK * lean);
        out.push({ l, along, low: l.crouch, p: { x: p.x, z: p.y }, q: { x: q.x, z: q.y } });
      };
      if (l.crouch) { add(l.len / 2, 0, 0); continue; }
      for (const s of [-1, 1]) if (cover.openEnd(l, s)) add(cover.cornerAt(l, s), s, cover.leanFor(l, s, C.peekOut.right));
      if (!out.some(o => o.l === l)) add(l.len / 2, 0, 0);
    }
    return out;
  }
  // najbliższe miejsce przy bryle, zasłonięte od `from` (null: dowolne najbliższe)
  function pickSpot(owner, from) {
    let bestS = null, bestV = -Infinity;
    for (const s of spotsOf(owner)) {
      if (from) {
        if ((from.x - s.p.x) * s.l.n.x + (from.z - s.p.z) * s.l.n.y > -0.3) continue;   // bryła nie stoi między
        if (sees(s.p, from, s.low ? CROUCH_EYE : EYE)) continue;
      }
      const v = -dist(s.p, me.feet);
      if (v > bestV) { bestV = v; bestS = s; }
    }
    return bestS;
  }

  // nowy rozkaz modelu (już sprawdzony przez sędziego: sedzia.mjs check())
  function setOrder(o, owners) {
    order = o; status = 'in_progress'; goal = null; spot = null; pathFor = null; best = Infinity; progressT = 0; coverTries = 0;
    medkitPressed = false; dodgePressed = false;
    const threat = o.against ? fromXY(o.against) : (senses.know.where ?? null);
    if (o.move?.to) goal = nav.closest(fromXY(o.move.to));
    if (o.move?.cover) {
      spot = pickSpot(owners.get(o.move.cover), threat);
      if (!spot) { status = 'failed: no side of ' + o.move.cover + ' hides you from ' + (threat ? 'that point' : 'anywhere'); return; }
      goal = spot.p;
    }
    if ((o.move?.to || o.move?.cover) && !goal) status = 'failed: unreachable';
  }

  function steer(dt) {
    if (!goal) return null;
    if (dist(me.feet, goal) < BOT.arrive) return null;
    pathAge += dt;
    if (pathFor !== goal || pathAge > 1) {
      path = nav.path(me.feet, goal); pathFor = goal; pathAge = 0;
      if (!path.length) { status = 'failed: no path'; goal = null; return null; }
    }
    while (path.length > 1 && dist(me.feet, path[0]) < 0.35) path.shift();
    const c = path[0], dx = c.x - me.feet.x, dz = c.z - me.feet.z, L = Math.hypot(dx, dz);
    return L < 1e-3 ? null : { x: dx / L, z: dz / L, left: path.reduce((s, p, i) => s + (i ? dist(p, path[i - 1]) : dist(me.feet, p)), 0) };
  }
  // brak postępu przez BOT.stuck s: rozkaz nie do wykonania
  function watch(dt) {
    const d = dist(me.feet, goal);
    if (d < best - 0.3) { best = d; progressT = 0; } else if ((progressT += dt) > BOT.stuck) { status = 'failed: stuck'; goal = null; }
  }
  const inSpot = () => !!spot && me.coverState.mode === 'cover' && cover.line === spot.l;

  // jedna klatka (1/60 s): akcje postaci
  function think(dt) {
    if (!me.alive) { a = idleAction(aim.view.yaw, aim.view.pitch); return a; }
    const know = senses.update(dt, aim.view.yaw);
    me.eyes(eyes);
    const mode = me.coverState.mode, fresh = know.where && senses.clock - know.when < 6;
    const intent = { move: null, sprint: false, sprintClick: false, cover: false, coverTarget: null, aim: false, look: null, blind: false };
    // ruch
    if (goal && status === 'in_progress') {
      if (spot && mode === 'free' && dist(me.feet, spot.p) < 2.5 && cover.usable(spot.l)) {
        if ((coverTries += dt) > 1.5) { status = 'failed: could not take cover'; goal = null; }
        else { intent.cover = true; intent.coverTarget = { line: spot.l.id, along: spot.along }; }
      } else if (mode === 'cover' && !inSpot()) intent.sprintClick = true;   // inna osłona: najpierw wyjście z tej
      else if (!inSpot()) {
        const dir = steer(dt);
        if (dir) { intent.move = dir; intent.sprint = !!order.sprint && !know.sees; intent.look = Math.atan2(-dir.x, -dir.z); watch(dt); }
        else if (goal && dist(me.feet, goal) < BOT.arrive) { status = spot ? 'in_progress' : 'arrived'; if (!spot) goal = null; }
      }
      if (inSpot()) { status = 'in_cover'; goal = null; }
    }
    if (order.move === 'leave_cover' && mode === 'cover') intent.sprintClick = true;
    // wzrok bez celu: kierunek z rozkazu, inaczej ostatnie znane miejsce przeciwnika
    if (typeof order.look === 'number') intent.look = yawOfBearing(order.look);
    else if (!intent.move && fresh) intent.look = Math.atan2(-(know.where.x - me.feet.x), -(know.where.z - me.feet.z));
    // ogień
    const fire = order.fire ?? 'at_enemy', seen = know.sees && fire === 'at_enemy';
    if (seen) { const late = senses.clock - know.when - (level.lag ?? 0); target.copy(know.aim); target.x += know.vel.x * late; target.z += know.vel.z * late; }
    if (mode === 'cover') {
      if (fire === 'blind' && know.where) {
        blindT = blindT > 0 ? Math.max(0, blindT - dt) || -BOT.blind.every : Math.min(0, blindT + dt);
        if (blindT === 0) blindT = BOT.blind.burst;
        intent.blind = blindT > 0;
        intent.look = Math.atan2(-(know.where.x - me.feet.x), -(know.where.z - me.feet.z));
      } else if (fire === 'at_enemy') {
        peek.t -= dt;   // wychylanie się zza rogu seriami, jak bot, dopóki przeciwnik ma tam być
        if (know.sees) peek = { on: true, t: 1.2 };
        else if (peek.t <= 0) peek = peek.on ? { on: false, t: fresh ? 1.0 : 2.5 } : { on: true, t: 1.2 };
        intent.aim = peek.on;
      }
    } else intent.aim = seen && dist(me.feet, know.where) > BOT.aimFrom;
    const v = aim.update(dt, { eyes, target: seen ? target : null, look: intent.look });
    a = idleAction(v.yaw, v.pitch);
    if (intent.move) {
      const f = { x: -Math.sin(v.yaw), z: -Math.cos(v.yaw) }, r = { x: Math.cos(v.yaw), z: -Math.sin(v.yaw) };
      a.move = { x: intent.move.x * r.x + intent.move.z * r.z, y: intent.move.x * f.x + intent.move.z * f.z };
    }
    let pull = v.fire || intent.blind;
    const reach = BOT.fireRange[me.weapon.spec.key];
    if (reach && know.where && dist(me.feet, know.where) > reach) pull = false;
    if (me.weapon.spec.mode === 'semi') { semiT -= dt; if (pull && semiT <= 0) semiT = 60 / me.weapon.spec.rpm + BOT.semiGap; else pull = false; }
    const heal = !!order.medkit && !medkitPressed && me.health.medkits > 0 && !me.health.healing;
    if (heal) medkitPressed = true;
    const dodge = !!order.dodge && !dodgePressed && mode === 'free';
    if (dodge) {
      dodgePressed = true;
      a.move = { x: order.dodge === 'left' ? -1 : 1, y: 0 };   // w bok względem widoku
    }
    Object.assign(a, { aim: intent.aim, shoot: pull, blind: intent.blind, sprint: intent.sprint, sprintClick: intent.sprintClick,
      cover: intent.cover, coverTarget: intent.coverTarget, medkit: heal, dodge, reload: !!order.reload && me.weapon.mag < me.weapon.spec.magazine && !know.sees,
      rise: intent.aim && mode === 'cover' && !!me.cover.line?.crouch });
    look3.set(-Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), -Math.cos(v.yaw) * Math.cos(v.pitch));
    a.aimAt = intent.blind && know.where ? new THREE.Vector3(know.where.x, 1.25, know.where.z) : ballistics.trace(eyes, look3, me.weapon.spec.range, me).point;
    return a;
  }

  return {
    think,
    get action() { return a; },
    // spust w chwili strzału: tylko gdy oczy widzą cel (jak bot) albo ślepy ogień zza osłony
    trigger: () => (a.blind ? true : senses.seesNow(a.yaw)),
    recoil: r => aim.recoil(r),
    // strzał przeciwnika: model dostaje miejsce z tym samym błędem słuchu co bot (BOT.hearError, audyt r1 pkt 3)
    hear: from => {
      senses.hear(from);
      const r = BOT.hearError * Math.sqrt(hearRand()), ang = hearRand() * Math.PI * 2;
      log.heard.push({ x: from.x + r * Math.cos(ang), z: from.z + r * Math.sin(ang), t: senses.clock });
    },
    marker: () => { log.markers++; },   // jego strzał trafił (wskaźnik trafienia na celowniku)
    hurt: () => { senses.hit({ x: me.feet.x - other.feet.x, z: me.feet.z - other.feet.z }); log.hits.push({ from: bearing(other.feet.x - me.feet.x, other.feet.z - me.feet.z), t: senses.clock }); },
    get know() { return senses.know; },
    get clock() { return senses.clock; },
    get status() { return status; },
    get order() { return order; },
    get view() { return aim.view; },
    setOrder, log, me, other, eyes: v => me.eyes(v),
  };
}
