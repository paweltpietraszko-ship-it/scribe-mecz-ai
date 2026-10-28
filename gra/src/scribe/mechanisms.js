// The mechanisms of the arena's elements (task 012, part A): every element of the section can move as its kind does in
// plan/01_PLAN_GRY.md §3.1. A move is always announced (SCRIBE.warn s: the moving part drops a little, the element's line
// on the floor lights up, a knock), then it runs smoothly (SCRIBE.moveTime, the blade at SCRIBE.bladeSpeed) with the
// mechanism's sound. "Lift doors": a move that would enter a fighter waits and tries again; nothing ever goes through
// a fighter. The element's collider (physics, lines of sight, hits) and its obstacle for the bot's navigation go with it.
// An element's pose: h (its height: lower = sunk into the floor; a wedge folds), rot (a blade's turn, degrees), slide
// (a buttress foot back into the chamber wall, m).
import * as THREE from 'three';
import { ARENA_SECTION, ELEMENTS, PLAYER, TURNTABLE, elementSpec } from '../data/arena.js';
import { SCRIBE as S } from '../data/scribe.js';
import { footprint, boxFootprint, distance } from './footprint.js';
import { hdr } from '../look/materials.js';

const specOf = new Map(ARENA_SECTION.elements.map(e => [e.id, e]));
const smooth = u => u * u * (3 - 2 * u);

// the part of an element that moves: the wedge's fold, the blade's turn, the foot's slide; the others sink whole
// (all but the line on the floor, which stays where it is)
function movingPart(g, type) {
  if (type === 'klin') return g.userData.fold;
  if (type === 'lopata') return g.userData.turn;
  if (type === 'stopa') return g.userData.slide;
  const body = new THREE.Group();
  [...g.children].filter(c => c !== g.userData.o).forEach(c => body.add(c));
  g.add(body);
  return body;
}

// the box of an element's solid (shadow-casting) parts in its own frame, on the floor plan: { ox, oz, hx, hz }
function solidBox(g) {
  g.updateWorldMatrix(true, true);
  const inv = g.matrixWorld.clone().invert(), m = new THREE.Matrix4(), v = new THREE.Vector3(), b = new THREE.Box3();
  g.traverse(o => {
    if (!o.isMesh || !o.castShadow) return;
    m.multiplyMatrices(inv, o.matrixWorld);
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) b.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(m));
  });
  return { ox: (b.min.x + b.max.x) / 2, oz: (b.min.z + b.max.z) / 2, hx: (b.max.x - b.min.x) / 2, hz: (b.max.z - b.min.z) / 2 };
}

// groups: the arena's element groups (userData.id); physics: player/physics.js (elementCollider); nav: bot/nav.js
// (setObstacle); sound(name, at): plays a sound at a world point; turntable: arena/turntable.js (its arms, task 012)
export function createMechanisms({ groups, physics, nav, sound = () => {}, turntable = null }) {
  const warnMat = hdr(S.warnGlow);
  const els = groups.map(g => {
    const spec = specOf.get(g.userData.id), E = elementSpec(spec.type, spec.variant), part = movingPart(g, spec.type);
    const mats = [];
    g.traverse(o => { if (o.material?.userData?.baseGain) mats.push(o.material.userData.baseGain); });
    const H = S.heights[spec.type], box = solidBox(g);
    return { id: spec.id, box, spec, E, g, part, H, mats, gain: mats.map(m => m.value), line: g.userData.o ?? null,
      lineMat: g.userData.o?.material, base: { y: part.position.y, z: part.position.z },
      pose: { h: H, rot: 0, slide: 0 }, from: null, to: null, phase: 'idle', left: 0, t: 0, dur: 0, drop: 0, pivot: g.position.clone(),
      collider: physics.elementCollider(spec.id) };
  });
  // the turntable's three arms: elements too (Paweł, 29.09.2026), their footprint turns with the disc; drawn, collided
  // and navigated by the turntable's own code (setArmDrop, setArmHeight)
  const A = TURNTABLE.arms, [TX, TZ] = TURNTABLE.center;
  const armFoot = k => {
    const a = physics.turnAngle + k * Math.PI * 2 / 3 + A.angle0, r = A.innerRadius + A.length / 2;
    return { x: TX + Math.cos(a) * r, z: TZ - Math.sin(a) * r, hx: A.length / 2, hz: A.thickness / 2, angle: a };
  };
  if (turntable) for (let k = 0; k < 3; k++) {
    const H = S.heights.ramie;
    els.push({ id: 'arm' + k, arm: k, spec: { id: 'arm' + k, type: 'ramie', final: S.armFinal, rotY: 0, get x() { return armFoot(k).x; }, get z() { return armFoot(k).z; } },
      E: null, g: null, part: null, H, mats: [], gain: [], line: turntable.armFeet[k], lineMat: turntable.armFeet[k].material, base: {},
      pose: { h: H, rot: 0, slide: 0 }, from: null, to: null, phase: 'idle', left: 0, t: 0, dur: 0, drop: 0, collider: null });
  }
  const byId = new Map(els.map(e => [e.id, e]));
  let fighters = [];

  const at = e => new THREE.Vector3(e.spec.x, 1, e.spec.z);
  const fp = (e, p = e.pose) => (e.arm !== undefined ? armFoot(e.arm) : footprint(e.spec, e.E, p.rot, p.slide));
  const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), t3 = new THREE.Vector3();

  // the pose on the screen and in the physics
  function apply(e) {
    if (e.arm !== undefined) { turntable.setArmDrop(e.arm, e.H - e.pose.h + e.drop); physics.setArmDrop(e.arm, e.H - e.pose.h); return; }
    const { h, rot, slide } = e.pose, down = e.H - h, part = e.part;
    if (e.spec.type === 'klin') part.scale.y = h / e.H;
    else part.position.y = e.base.y - down - e.drop;
    if (e.spec.type === 'klin') part.position.y = e.base.y - e.drop;
    if (e.spec.type === 'lopata') part.rotation.y = rot * Math.PI / 180;
    if (e.spec.type === 'stopa') part.position.z = e.base.z - slide;
    if (!e.collider) return;
    // the collider was made in world coordinates: turn it about the element's axis, move it down and back
    q.setFromAxisAngle(up, rot * Math.PI / 180);
    t3.copy(e.pivot).sub(v.copy(e.pivot).applyQuaternion(q));
    t3.y -= down;
    if (slide) { const a = e.spec.rotY; t3.x -= Math.sin(a) * slide; t3.z -= Math.cos(a) * slide; }
    e.collider.setTranslation({ x: t3.x, y: t3.y, z: t3.z });
    e.collider.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
  }
  // the navigation's obstacle: present while the element stands higher than a step
  const obstacle = (e, p) => e.arm !== undefined ? nav?.setArmHeight(e.arm, p.h) : nav?.setObstacle(e.id, p.h > 0.3 ? boxFootprint(e.spec, e.box, p.rot, p.slide) : null, p.h);

  // would the element in pose p (and on the way there, for a blade) enter a fighter?
  function blocked(e, p) {
    const poses = [p];
    if (p.rot !== e.pose.rot) for (let k = 1; k < 10; k++) poses.push({ ...p, rot: e.pose.rot + (p.rot - e.pose.rot) * k / 10 });
    return fighters.some(f => f.alive && poses.some(o => distance(fp(e, o), f.feet.x, f.feet.z) < PLAYER.radius + S.liftMargin));
  }
  // is the element's collider (in its pose now) inside a fighter's capsule?
  const enters = e => !!e.collider && fighters.some(f => f.alive && f.collider
    && e.collider.intersectsShape(f.collider.shape, f.collider.translation(), f.collider.rotation()));
  // held by a fighter this step: true while it waits; after SCRIBE.liftGiveUp s the move turns back (from where it is
  // now to where it came from), so an element and a fighter pushing at it never wait for each other for ever
  function held(e, dt) {
    if ((e.held = (e.held ?? 0) + dt) < S.liftGiveUp) return true;
    e.held = 0; e.to = e.from; e.from = { ...e.pose }; e.t = 0;
    e.dur = Math.max(0.3, (S.moveTime[e.spec.type] ?? 1.5) * 0.5);
    return true;
  }
  // does going from a to b make the element take more room (then a fighter in the way stops it)?
  const grows = (a, b) => b.h > a.h + 1e-3 || b.rot !== a.rot || b.slide < a.slide - 1e-3;

  // announce and then move element id towards target ({ h, rot, slide }: any of them); false if it is busy or there
  // already. o.warn: the announcement's length (SCRIBE.warn)
  function move(id, target, o = {}) {
    const e = byId.get(id);
    if (!e || e.phase !== 'idle') return false;
    const to = { ...e.pose, ...target };
    if (to.h === e.pose.h && to.rot === e.pose.rot && to.slide === e.pose.slide) return false;
    e.to = to; e.phase = 'warn'; e.left = o.warn ?? S.warn;
    if (e.line) e.line.material = warnMat;
    sound(S.sounds.warn, at(e));
    return true;
  }

  function start(e) {
    e.from = { ...e.pose }; e.t = 0; e.phase = 'move';
    const turn = Math.abs(e.to.rot - e.from.rot);
    e.dur = Math.max(turn ? turn / S.bladeSpeed : 0, e.to.h !== e.from.h || e.to.slide !== e.from.slide ? (S.moveTime[e.spec.type] ?? 1.5) : 0);
    sound(turn ? S.sounds.turn : e.to.h < e.from.h || e.to.slide > e.from.slide ? S.sounds.down : S.sounds.up, at(e));
    if (grows(e.from, e.to)) obstacle(e, e.to);   // taking room: the bots keep off it from the start
  }

  // dt: this step; list: the fighters (feet, alive)
  function update(dt, list) {
    fighters = list;
    for (const e of els) {
      if (e.phase === 'idle') continue;
      if (e.phase === 'warn') {
        e.drop = S.warnDrop;
        if ((e.left -= dt) > 0) { apply(e); continue; }
        if (grows(e.pose, e.to) && blocked(e, e.to)) { e.left = S.liftWait; apply(e); continue; }   // lift door: wait
        e.drop = 0; start(e);
      }
      // moving: a fighter stepping into the way of a growing move stops it where it is
      if (grows(e.from, e.to) && blocked(e, e.to)) { if (held(e, dt)) continue; }
      const t = e.t + dt, u = smooth(Math.min(1, t / e.dur)), before = e.pose;
      e.pose = { h: e.from.h + (e.to.h - e.from.h) * u, rot: e.from.rot + (e.to.rot - e.from.rot) * u, slide: e.from.slide + (e.to.slide - e.from.slide) * u };
      apply(e);
      // and the real shapes: a step that would put the collider into a fighter (a leaning slab's face comes forward as it
      // sinks) is taken back; the element waits there until the fighter has gone
      if (enters(e)) { e.pose = before; apply(e); held(e, dt); continue; }
      e.t = t; e.held = 0;
      if (u >= 1) {
        e.pose = { ...e.to }; e.phase = 'idle';
        if (e.line) e.line.material = e.lineMat;
        obstacle(e, e.pose);
      }
    }
  }

  // everything back where it stands, at once (a new round, SCRIBE switched off)
  function reset() {
    for (const e of els) {
      const moved = e.pose.h !== e.H || e.pose.rot || e.pose.slide || e.phase !== 'idle';
      e.pose = { h: e.H, rot: 0, slide: 0 }; e.phase = 'idle'; e.drop = 0;
      if (e.line) e.line.material = e.lineMat;
      if (moved) { apply(e); obstacle(e, e.pose); }
    }
  }

  // the camp warning: the script of these elements pulses with share k (0: as usual)
  function pulse(e, k) { e.k = k; e.mats.forEach((m, i) => { m.value = e.gain[i] * (1 + k); }); }

  // standing where it stands and not about to move: only then is it cover (player/cover.js asks the group)
  const solid = e => e.phase === 'idle' && e.pose.h >= e.H - 1e-3 && !e.pose.rot && !e.pose.slide;
  // the elements' start: all obstacles of the navigation
  els.forEach(e => {
    if (e.arm !== undefined) { physics.armSolid[e.arm] = () => solid(e); return; }
    obstacle(e, e.pose); e.g.userData.solid = () => solid(e);
  });

  // task 027 (K1): the elements as the PvP server sends them, and as a window shows them (the pose on the screen and in
  // the physics, the warning's line, the camp's pulse; no navigation in a window)
  const PHASES = ['idle', 'warn', 'move'];
  const view = () => els.map(e => [e.pose.h, e.pose.rot, e.pose.slide, PHASES.indexOf(e.phase), e.drop, e.k ?? 0]);
  function show(list) {
    list.forEach(([h, rot, slide, ph, drop, k], i) => {
      const e = els[i], phase = PHASES[ph];
      // (task 028: the navigation's obstacle too: the PvP window's own fighter runs to cover along its ways)
      if (e.pose.h !== h || e.pose.rot !== rot || e.pose.slide !== slide || e.drop !== drop) { e.pose = { h, rot, slide }; e.drop = drop; apply(e); obstacle(e, e.pose); }
      if (phase !== e.phase && e.line) e.line.material = phase === 'warn' ? warnMat : phase === 'idle' ? e.lineMat : e.line.material;
      e.phase = phase;
      if ((e.k ?? 0) !== k) pulse(e, k);
    });
  }

  return {
    els, byId, move, update, reset, pulse, footprint: fp, solid, view, show,
    busy: e => e.phase !== 'idle',
    get moving() { return els.filter(e => e.phase !== 'idle').length; },
  };
}
