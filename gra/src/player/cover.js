// Cover as in The Division (task 005): cover lines taken from the arena, the target under the camera,
// and the cover states. A runs to the target ("dash"), the entry animation turns the back to the wall ("enter"),
// then the character slides along it and aims out of its corner ("cover"); A with the stick towards a low obstacle close by vaults it ("vault"). The turntable's arms are cover too and carry
// the character with the disc. Every move goes through the physics of task 003.
// update() returns what the character and the animator do this frame; null = normal movement.
// Task 009: one cover system per fighter; it does not see the camera. The target comes with the actions
// (a.coverTarget: { line (index in lines), along }); the player's controller finds it with targetFrom() along the
// camera's ray, the bot picks it itself.
// Task 015 (Paweł 29.09.2026: "jak przykleję się w środku to nie strzelam, przesuwam wzdłuż panelu ale bardzo opornie,
// a jak już mogę strzelać, to jestem za osłoną"): LT anywhere within COVER.autoPeekReach of a corner walks to it and
// leans out, back again when let go; blind fire (a.blind: RT without LT) from behind the cover; the stick slides as the
// cover is seen on the screen, whatever the camera's angle; low cover (the wedge) crouched, LT rises over it; the target
// in a cone round the crosshair (cover-target.js). The lines: cover-lines.js.
import * as THREE from 'three';
import { COVER as C } from '../data/cover.js';
import { PLAYER as P, TPP, TURNTABLE } from '../data/arena.js';
import { HERO_FILES } from '../data/hero.js';
import { buildLines } from './cover-lines.js';
import { createTargeting } from './cover-target.js';
import { copyState } from '../sim/copy.js';

const F = HERO_FILES.clips;
const V2 = THREE.Vector2;
const yawOf = v => Math.atan2(v.x, v.y);   // plan direction (x, z) -> yaw of the model (+Z = 0)
const clamp = THREE.MathUtils.clamp;
const toward = (v, to, step) => (Math.abs(to - v) <= step ? to : v + Math.sign(to - v) * step);

// ---- the cover system ----
// physics: player/physics.js; hero: the fighter's body (hero.js); wall: buildPanelWall(); elements: arena groups;
// nav: bot/nav.js (task 015: the run to cover goes round what stands in its way), or null (a straight run)
export function createCover({ physics, hero, wall, elements, nav = null }) {
  const { RAPIER, world } = physics;
  const all = buildLines({ elements, wall });
  const lines = all.filter(l => !l.low);   // cover (low obstacles are only vaulted: task 005, code gone in 007)
  lines.forEach((l, i) => { l.id = i; });
  const sills = all.filter(l => l.low);                    // low obstacles to vault
  const arenaLines = new Set(all);   // (task 028: a saved state keeps them as they are)
  const discLines = all.filter(l => l.disc);
  const [TX, TZ] = TURNTABLE.center;
  // put the arms' lines where the disc is at angle (same turn as the turntable group and its colliders)
  function turnLines(angle) {
    const c = Math.cos(angle), s = Math.sin(angle), rot = v => new V2(c * v.x + s * v.y, -s * v.x + c * v.y);
    discLines.forEach(l => {
      l.a.copy(rot(l.disc.a)).add({ x: TX, y: TZ }); l.b.copy(rot(l.disc.b)).add({ x: TX, y: TZ });
      l.n.copy(rot(l.disc.n)); l.dir.copy(l.b).sub(l.a).normalize();
    });
  }
  turnLines(0);
  const standOff = C.gap + P.radius;   // distance of the character's axis from the cover's face
  let panelState = { key: 'panelIdle', drop: 0 };
  // task 012: an element SCRIBE moves (announced, moving, sunk, turned) is no cover
  const valid = l => (!l.panel || !l.panel.moving || (panelState.drop === 0 && panelState.key !== 'panelLowering'))
    && (!l.owner?.userData?.solid || l.owner.userData.solid())
    && !(l.disc && physics.armSolid[+String(l.owner).slice(3)] && !physics.armSolid[+String(l.owner).slice(3)]());

  // spot on a line: along = distance from its end a; returns the plan point where the character stands
  const standAt = (l, along) => l.a.clone().addScaledVector(l.dir, along).addScaledVector(l.n, standOff);
  const clampAlong = (l, along) => clamp(along, Math.min(P.radius, l.len / 2), Math.max(l.len - P.radius, l.len / 2));
  const alongOf = (l, p) => p.clone().sub(l.a).dot(l.dir);
  // task 015: an end is a corner when no standing cover continues the face past it (cover-lines.js: next)
  const openEnd = (l, side) => !(side < 0 ? l.next.a : l.next.b).some(valid);
  const endAlong = (l, side) => (side < 0 ? 0 : l.len);
  // where the character stands to lean out of the corner on `side` (−1: end a, +1: end b)
  const cornerAt = (l, side) => clampAlong(l, endAlong(l, side));
  // the lean from there: the body's axis goes `out` m past the edge (negative: stays behind it)
  const leanFor = (l, side, out) => Math.max(0, side * (endAlong(l, side) + side * out - cornerAt(l, side)));

  let state = { mode: 'free' };
  let target = null;           // { line, along, blocked } under the camera (the marker shows it)
  let crouchBefore = false;    // the crouch to restore when the character leaves cover

  // in cover, the target is another cover: neither the line the character is at (audit 005) nor the other sides of the
  // same element (going round its corner: not in task 005)
  const usable = l => valid(l) && !(state.mode === 'cover' && l.owner === state.line.owner);
  const candidate = l => !l.low && !(state.mode === 'cover' && l.owner === state.line.owner);
  const targeting = createTargeting({ lines, world, RAPIER, candidate, valid });
  const me2 = feet => new V2(feet.x, feet.z);

  // ---- transitions ----
  function startDash(t, feet) {
    if (state.mode === 'free') crouchBefore = null;
    state = { mode: 'dash', line: t.line, along: t.along, stall: 0, from: me2(feet), path: wayTo(me2(feet), standAt(t.line, t.along)) };
  }
  // task 015 (Paweł 29.09.2026: "przyklejanie jest loteryjne": a straight run stopped at anything on its way): the corners
  // of the navigation mesh's way to the cover (the last one: the spot itself), or just the spot
  function wayTo(from, stand) {
    if (!nav) return [stand];
    const end = nav.closest({ x: stand.x, y: 0, z: stand.y });
    const path = end ? nav.path({ x: from.x, y: 0, z: from.y }, end) : [];
    return [...path.slice(1, -1).map(p => new V2(p.x, p.z)), stand];
  }
  // standing: the panel went down under the character (it stays where it is, standing)
  function leave(character, standing = false) {
    const was = state; state = { mode: 'free' };
    if (standing) character.setCrouch(false);
    else if ((was.mode === 'cover' || was.mode === 'enter' || was.mode === 'round') && crouchBefore !== null) character.setCrouch(crouchBefore);
  }

  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  // the collider of the low cover right behind the character (the one to vault), or null
  function coverCollider(feet, l, d, exclude) {
    ray.origin = { x: feet.x, y: Math.min(l.height, 0.9) * 0.5, z: feet.z }; ray.dir = { x: -l.n.x, y: 0, z: -l.n.y };
    const hit = world.castRay(ray, d + 0.3, true, undefined, undefined, exclude);
    return hit ? hit.collider : null;
  }
  // is there room for the standing capsule at the plan point p?
  function roomAt(p, exclude) {
    let blocked = false;
    const shape = new RAPIER.Capsule(P.height / 2 - P.radius, P.radius - P.skin);
    world.intersectionsWithShape({ x: p.x, y: P.height / 2 + P.skin, z: p.y }, { x: 0, y: 0, z: 0, w: 1 }, shape,
      () => { blocked = true; return false; }, undefined, undefined, exclude);
    return !blocked;
  }
  // vault the low obstacle l from where the character is: it lands vaultLand beyond the far face
  function tryVault(feet, l, exclude) {
    if (!l.low || l.panel || l.depth > C.vaultDepth) return false;
    const from = me2(feet), d = from.clone().sub(l.a).dot(l.n);   // distance of the axis from the near face
    const col = coverCollider(feet, l, d, exclude); if (!col) return false;
    const to = from.clone().addScaledVector(l.n, -(d + l.depth + C.vaultLand));
    if (!roomAt(to, exclude)) return false;
    state = { mode: 'vault', u: 0, from, to, col, line: l };
    return true;
  }
  // the nearest low obstacle within vaultReach that the stick points at (component towards it > stickAway)
  function vaultable(me, stick) {
    let best = null, bestD = C.vaultReach;
    for (const l of sills) {
      const d = me.clone().sub(l.a).dot(l.n), along = alongOf(l, me);
      if (d <= 0 || d > bestD || along < 0 || along > l.len || -stick.dot(l.n) <= C.stickAway) continue;
      bestD = d; best = l;
    }
    return best;
  }

  // ---- per frame ----
  // a: actions; feet: character feet; yaw: the view's yaw; character: character.js (collider, speed, setCrouch)
  // Returns { drive: { move (V2, metres this frame), crouch, ignore } | null, anim, aiming, shoulder, target,
  //           fire: null (no shot from cover now) | { from: null (the muzzle) | Vector3 (blind fire: where the shots
  //           start, out of the cover's solid), blind, away: null | a direction (Vector3) the shots over the cover
//           never go along: back into the cover } }
  // turnAngle: the disc's angle the character's position belongs to (before this frame's turn, which the
  // character's ride adds)
  function update(dt, a, { feet, yaw, character, panel, frozen, turnAngle }) {
    panelState = panel;
    turnLines(turnAngle);
    const exclude = character.collider;
    const stick = new V2(Math.cos(yaw) * a.move.x - Math.sin(yaw) * a.move.y, -Math.sin(yaw) * a.move.x - Math.cos(yaw) * a.move.y);
    const me = me2(feet);
    let out = { drive: null, anim: null, aiming: a.aim, shoulder: 0, fire: null };

    if (state.mode !== 'free' && state.line && !valid(state.line)) leave(character, true);   // the panel went down: out of cover
    // dodge leaves cover and the run to it; a sprint click (LS / Shift) leaves cover
    // (U46, 01.10.2026: also while going round a corner)
    if (state.mode !== 'free' && state.mode !== 'vault' && (a.dodge || (a.sprintClick && (state.mode === 'cover' || state.mode === 'round')))) leave(character);

    const want = a.coverTarget && lines[a.coverTarget.line];
    target = null;
    if ((state.mode === 'free' || state.mode === 'cover') && want && candidate(want)) {
      target = { line: want, along: clampAlong(want, a.coverTarget.along), blocked: !valid(want) };
    }
    const go = target && !target.blocked;

    if (state.mode === 'free' && a.cover && !frozen) {
      // A with the stick at a low obstacle close by vaults it; otherwise A runs to the target
      const sill = vaultable(me, stick);
      if (!(sill && tryVault(feet, sill, exclude)) && go) startDash(target, feet);
    }

    if (state.mode === 'cover') {
      if (a.cover && go) startDash(target, feet);
      else {
        out = coverFrame(dt, a, state.line, me, yaw, out);
        if (out.round) {   // round the corner: out to its outer point, then in along the next side
          const r = out.round;
          state = { mode: 'round', line: r.line, along: r.along, legs: [...r.via, standAt(r.line, r.along)], from: state.line, fromAlong: state.base };
          out = { drive: null, anim: null, aiming: false, shoulder: 0, fire: null };
        } else if (out.left) { leave(character); out.drive = null; out.anim = null; out.aiming = a.aim; out.fire = null; }
        return finish(out);
      }
    }

    if (state.mode === 'dash') {
      // round what stands in the way: to the next corner of the way, the last stretch straight to the spot
      const way = state.path;
      while (way.length > 1 && me.distanceTo(way[0]) < C.wayCorner) way.shift();
      if (way.length > 1) {
        const to = way[0].clone().sub(me), dist = to.length(), dir = to.normalize();
        state.stall = character.speed.length() * dt < 0.1 * C.dashSpeed * dt ? state.stall + dt : 0;
        if (stick.dot(dir) < -C.stickAway || state.stall >= C.stallTime) { leave(character); return finish(out); }
        out.drive = { move: dir.multiplyScalar(Math.min(C.dashSpeed * dt, dist)), crouch: false, ignore: null };
        out.aiming = false; out.dash = true;
        return finish(out);
      }
      const l = state.line, stand = standAt(l, state.along), to = stand.clone().sub(me), dist = to.length();
      const enterLen = Math.min(hero.slices[F.coverEnter].length, dist);
      const dir = to.clone().normalize();
      const moved = character.speed.length() * dt;
      state.stall = moved < 0.1 * C.dashSpeed * dt ? state.stall + dt : 0;
      if (stick.dot(dir) < -C.stickAway || state.stall >= C.stallTime) { leave(character); return finish(out); }
      if (dist <= enterLen + 1e-3) {
        if (crouchBefore === null) crouchBefore = character.crouched;
        state = { mode: 'enter', line: l, along: state.along, u: 0, from: me.clone(), to: stand, inward: yawOf(l.n.clone().negate()) };
      } else {
        const step = Math.min(C.dashSpeed * dt, dist - enterLen);
        out.drive = { move: dir.multiplyScalar(step), crouch: false, ignore: null };
        out.aiming = false; out.dash = true;
        return finish(out);
      }
    }

    if (state.mode === 'round') {
      // along the two legs at roundSpeed; the body turns to the new side's outward (the animator turns it smoothly)
      const legs = state.legs;
      while (legs.length > 1 && me.distanceTo(legs[0]) < 0.02) legs.shift();
      // U46 (Paweł 01.10.2026: "trudno postać odkleić od przeszkody"): the stick away from the cover leaves it here too,
      // by the cover's rule (away past stickAway for leaveHold), away from the wall it stood at (the stick held towards
      // the corner points away from the next side, so that side's normal does not count)
      const away = stick.dot(state.from.n);
      state.away = away > C.stickAway ? (state.away || 0) + dt : 0;
      if (state.away >= C.leaveHold) { leave(character); return finish(out); }
      const to = legs[0].clone().sub(me), dist = to.length(), step = Math.min(C.roundSpeed * dt, dist);
      const move = dist > 1e-6 ? to.multiplyScalar(step / dist) : new V2();
      out.drive = { move, crouch: state.line.crouch, ignore: null };
      // U46 (the feet slid round the corner): the sneak clip at the real pace and side of the move (m/s towards the
      // model's left, as in coverFrame), not standing still
      const outward = yawOf(state.line.n), leftV = new V2(Math.cos(outward), -Math.sin(outward));
      out.anim = { kind: 'cover', yaw: outward, slide: dt > 0 ? move.dot(leftV) / dt : 0, low: state.line.crouch };
      out.aiming = false;
      // held up on the way (another element stands round the corner): back into the cover it came from
      state.stall = character.speed.length() * dt < 0.1 * C.roundSpeed * dt ? (state.stall || 0) + dt : 0;
      if (state.stall >= C.stallTime) {
        state = { mode: 'cover', line: state.from, away: 0, base: state.fromAlong, act: null, peek: 0, lean: 0, round: -C.roundBack };
        return finish(out);
      }
      if (legs.length === 1 && dist < 0.02) state = { mode: 'cover', line: state.line, away: 0, base: state.along, act: null, peek: 0, lean: 0 };
      return finish(out);
    }

    if (state.mode === 'enter') {
      const l = state.line, shape = hero.slices[F.coverEnter].shape;
      const u0 = state.u, u1 = Math.min(1, u0 + dt / C.enterTime);
      out.drive = { move: state.to.clone().sub(state.from).multiplyScalar(shape(u1) - shape(u0)), crouch: false, ignore: null };
      out.anim = { kind: 'enter', clip: F.coverEnter, u: u1, yaw: state.inward };
      out.aiming = false;
      state.u = u1;
      if (u1 >= 1) state = { mode: 'cover', line: l, away: 0, base: state.along, act: null, peek: 0, lean: 0 };
      return finish(out);
    }

    if (state.mode === 'vault') {
      const shape = hero.slices[F.vault].shape, u0 = state.u, u1 = state.hold ? u0 : Math.min(1, u0 + dt / C.vaultTime);
      out.drive = { move: state.to.clone().sub(state.from).multiplyScalar(shape(u1) - shape(u0)), crouch: false, ignore: state.col };
      out.anim = { kind: 'vault', clip: F.vault, u: u1, yaw: yawOf(state.to.clone().sub(state.from)) };
      out.aiming = false;
      state.u = u1;
      if (u1 >= 1) { state = { mode: 'free' }; crouchBefore = null; out.landed = true; }
      return finish(out);
    }
    return finish(out);
  }

  // the corner LT (reach: autoPeekReach) or blind fire (reach: cornerZone) goes to: an open end within reach of base;
  // both: the one the view looks towards along the wall (a narrow cover: a tooth, an arm; Paweł 28.09.2026:
  // OWNER_ACCEPTED in task 009, "celuje się w osłonę"), unless the view is square to the wall: the nearer one
  function pickCorner(l, base, yaw, reach) {
    const ends = [-1, 1].filter(s => openEnd(l, s) && Math.abs(endAlong(l, s) - base) <= reach);
    if (ends.length < 2) return ends[0] ?? 0;
    const looks = -Math.sin(yaw) * l.dir.x - Math.cos(yaw) * l.dir.y;
    if (Math.abs(looks) > 0.2) return looks > 0 ? 1 : -1;
    return base > l.len / 2 ? 1 : -1;
  }

  // in cover: slide along the wall, go to its corner and lean out of it, rise over low cover, blind fire. The back to
  // the wall. state.base: the place along the wall without the lean; state.act: what LT or blind fire does now:
  // { kind: 'corner', side, at (where to stand), home (where it stood), blind } | { kind: 'rise', blind } |
  // { kind: 'top' } (blind fire over a high cover, no corner near) | { kind: 'none' } (the view aims, no shot).
  // Low cover: a.rise (task 015, audit: an action field) stands up over it; a.aim does not act there
  function coverFrame(dt, a, l, me, yaw, out) {
    const outward = yawOf(l.n);
    const right = new V2(Math.cos(yaw), -Math.sin(yaw)), fwd = new V2(-Math.sin(yaw), -Math.cos(yaw));
    // the stick as the cover is seen on the screen: left/right slides along it whatever the camera's angle; when the
    // view looks along the wall, forward/back does. The other axis: away from the wall (leave) or towards it
    const rd = right.dot(l.dir), across = Math.abs(rd) >= C.slideAcross;
    const slideIn = across ? a.move.x * Math.sign(rd) : a.move.y * Math.sign(fwd.dot(l.dir));
    const away = across ? a.move.y * fwd.dot(l.n) : a.move.x * right.dot(l.n);
    state.away = away > C.stickAway ? (state.away || 0) + dt : 0;
    if (state.away >= C.leaveHold) return { ...out, left: true };

    const up = l.crouch ? !!a.rise : !!a.aim;
    const blind = !!a.blind && !a.aim && !a.rise, wants = up || blind;
    // a new press: what it does here
    if (wants && !state.act) {
      if (l.crouch) state.act = { kind: 'rise' };
      else {
        const side = pickCorner(l, state.base, yaw, blind ? C.cornerZone : C.autoPeekReach);
        state.act = side ? { kind: 'corner', side, at: cornerAt(l, side), home: state.base } : { kind: blind ? 'top' : 'none' };
      }
    }
    const act = state.act;
    if (act) act.blind = blind;
    // travel to the corner, lean out; let go: lean in, then back home (the stick sliding forgets home)
    let slide = 0;
    if (act?.kind === 'corner') {
      const at = act.at, there = Math.abs(state.base - at) < 1e-3;
      if (wants) {
        if (!there) { state.peek = toward(state.peek, 0, dt / TPP.aimTime); if (state.peek === 0) state.base = toward(state.base, at, C.cornerSpeed * dt); }
        else state.peek = toward(state.peek, 1, dt / TPP.aimTime);
        // towards the view's left (its right is (cos yaw, −sin yaw))? The rifle is in the right hands: further
        const left = act.side * rd < 0;
        const lean = leanFor(l, act.side, blind ? C.blindOut : left ? C.peekOut.left : C.peekOut.right);
        state.lean = toward(state.lean, lean, C.cornerSpeed * dt);
      } else {
        state.peek = toward(state.peek, 0, dt / TPP.aimTime);
        if (state.peek === 0) {
          if (Math.abs(slideIn) >= C.slideMin) state.act = null;
          else { state.base = toward(state.base, act.home, C.cornerSpeed * dt); if (Math.abs(state.base - act.home) < 1e-3) state.act = null; }
        }
      }
    } else if (act) {
      state.peek = toward(state.peek, wants ? 1 : 0, dt / TPP.aimTime);
      if (!wants && state.peek === 0) state.act = null;
    }
    if (!state.act) {
      state.peek = 0; state.lean = 0;
      if (Math.abs(slideIn) >= C.slideMin) slide = clamp(slideIn, -1, 1) * C.slideSpeed;
      const was = state.base;
      state.base = clampAlong(l, state.base + slide * dt);   // the ends stop the character
      // Paweł 29.09.2026 (task 016: "okrągłych paneli nie można obejść"): the stick still pushing at an end that is a
      // corner of the element goes round it onto its next side
      const side = Math.sign(slide), next = side && Math.abs(state.base - was) < 1e-6 ? roundCorner(l, side) : null;
      state.round = next ? (state.round || 0) + dt : 0;
      if (next && state.round >= C.roundHold) return { ...out, round: next };
    }

    const cur = state.act, side = cur?.kind === 'corner' ? cur.side : 0;
    // wanted place at the stand-off from the face; the physics stops a lean that does not fit
    const wantAt = standAt(l, state.base + state.peek * side * state.lean);
    const risen = cur?.kind === 'rise' && !cur.blind && state.peek > 0;   // over low cover: standing
    out.drive = { move: wantAt.sub(me), crouch: l.crouch && !risen, ignore: null };

    const full = state.peek >= 1;
    out.aiming = !!cur && state.peek > 0 && cur.kind !== 'none' && cur.kind !== 'top';
    if (full && cur) {
      if (cur.kind === 'corner' && !cur.blind) out.fire = { from: null, blind: false };
      else if (cur.kind === 'rise' && !cur.blind) out.fire = { from: null, blind: false };
      else if (cur.blind && cur.kind !== 'none') out.fire = { from: blindFrom(l, cur), blind: true, away: cur.kind === 'corner' ? null : awayOf(l) };
    }
    // the camera to the shoulder on the side it slides or leans to (1 right, −1 left of the camera)
    if (slide) out.shoulder = Math.sign(slide * rd);
    else if (side && state.peek > 0) out.shoulder = Math.sign(side * rd);
    // the model's left (+X of the sneak clips) in the plan
    const leftV = new V2(Math.cos(outward), -Math.sin(outward));
    if (!out.aiming) out.anim = { kind: 'cover', yaw: outward, slide: slide * l.dir.dot(leftV), low: l.crouch };
    return out;
  }

  // the element's next side round the corner at l's end on `side` (−1: end a, +1: end b): a side of the same element
  // facing the way the character slides, one of its ends at that corner; null when there is none (the arms, a corner
  // another cover continues). Returns { line, along (where to stand on it), via (the plan points out round the corner:
// one, or two round a thin slab's end onto its back) }
  function roundCorner(l, side) {
    if (l.disc || !openEnd(l, side)) return null;
    const corner = side < 0 ? l.a : l.b, out = l.dir.clone().multiplyScalar(side);
    const via = corner.clone().addScaledVector(l.n, standOff).addScaledVector(out, standOff);
    for (const m of lines) {
      if (m === l || m.owner !== l.owner || !valid(m) || m.n.dot(out) < 0.9) continue;
      const atA = m.a.distanceTo(corner) < C.roundGap, atB = m.b.distanceTo(corner) < C.roundGap;
      if (!atA && !atB) continue;
      return { line: m, along: clampAlong(m, atA ? 0 : m.len), via: [via] };
    }
    // a thin slab (its end is no cover: shorter than minLength): round both corners of that end onto its back face
    for (const m of lines) {
      if (m === l || m.owner !== l.owner || !valid(m) || m.n.dot(l.n) > -0.9) continue;
      const far = [m.a, m.b].find(e => e.distanceTo(corner) < Math.min(l.depth, C.minLength) + C.roundGap);
      if (!far) continue;
      const via2 = far.clone().addScaledVector(m.n, standOff).addScaledVector(out, standOff);
      return { line: m, along: clampAlong(m, far === m.a ? 0 : m.len), via: [via, via2] };
    }
    return null;
  }

  // blind fire: the shots start out of the cover's solid: round the corner at shoulder height, or over the cover's far
  // edge (low cover, the top of a high one); over it they fly away from the cover (fire.away: weapon.js). The wall
  // panels (depth Infinity: the chamber wall right behind them; audit 015: RT fires there too): over the top of the
  // front face, towards the arena
  const awayOf = l => (Number.isFinite(l.depth) ? new THREE.Vector3(l.n.x, 0, l.n.y) : new THREE.Vector3(-l.n.x, 0, -l.n.y));
  function blindFrom(l, act) {
    const B = C.blind;
    if (act.kind === 'corner') {
      const e = l.a.clone().addScaledVector(l.dir, endAlong(l, act.side) + act.side * B.past).addScaledVector(l.n, B.off);
      return new THREE.Vector3(e.x, B.height, e.y);
    }
    const f = standAt(l, state.base).addScaledVector(l.n, -(standOff + (Number.isFinite(l.depth) ? l.depth + B.over : 0)));
    return new THREE.Vector3(f.x, l.height + B.over, f.y);
  }

  function finish(out) { out.target = target; out.mode = state.mode; return out; }

  // ?freeze&pose=cover_high|cover_peek|cover_arm|vault: the character straight in cover (or halfway through a
  // vault) at the nearest suitable line from p (plan). Returns the camera yaw: looking at the wall, over the character.
  function place(kind, p, character) {
    const fits = { cover_high: l => !l.low && !l.crouch && !l.panel && !l.disc, cover_peek: l => !l.low && !l.crouch && !l.panel && !l.disc,
      cover_arm: l => !!l.disc, vault: l => l.low }[kind];
    let best = null, bestD = Infinity;
    for (const l of kind === 'vault' ? sills : lines) {
      if (!fits(l) || !valid(l)) continue;
      const along = clampAlong(l, kind === 'cover_peek' ? 0 : alongOf(l, p)), d = standAt(l, along).distanceTo(p);
      if (d < bestD) { bestD = d; best = { l, along }; }
    }
    const spot = standAt(best.l, best.along);
    character.place(spot.x, spot.y);
    crouchBefore = false;
    if (kind === 'vault') {
      // halfway: where the vault's travel is at half its time, passing through the sill's collider
      const to = spot.clone().addScaledVector(best.l.n, -(standOff + best.l.depth + C.vaultLand));
      const col = coverCollider({ x: spot.x, z: spot.y }, best.l, standOff, character.collider);
      const mid = spot.clone().lerp(to, hero.slices[F.vault].shape(0.5));
      character.place(mid.x, mid.y);
      state = { mode: 'vault', u: 0.5, hold: true, from: spot, to, col, line: best.l };
    } else state = { mode: 'cover', line: best.l, away: 0, base: best.along, act: null, peek: 0, lean: 0 };
    return { yaw: Math.atan2(best.l.n.x, best.l.n.y) };
  }

  // task 028: the state's text form (toWire, fromWire)
  const lineNo = new Map(all.map((l, i) => [l, i])), r6 = v => Math.round(v * 1e6) / 1e6;
  function enc(v) {
    if (v === null || typeof v !== 'object') return typeof v === 'number' ? r6(v) : v;
    if (lineNo.has(v)) return { L: lineNo.get(v) };
    if (v.isVector2) return { V2: [r6(v.x), r6(v.y)] };
    if (v.isVector3) return { V3: [r6(v.x), r6(v.y), r6(v.z)] };
    if (typeof v.handle === 'number' && v.shape) return { C: v.handle };
    if (Array.isArray(v)) return v.map(enc);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]));
  }
  function dec(v) {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(dec);
    if ('L' in v) return all[v.L];
    if ('V2' in v) return new V2(...v.V2);
    if ('V3' in v) return new THREE.Vector3(...v.V3);
    if ('C' in v) return world.getCollider(v.C);
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]));
  }
  let shown = null;   // task 027: the server's cover state in a PvP window (null: this cover's own)
  return {
    update, place, lines, sills,
    // the cover the view ray (origin o, unit direction d: Vector3) points at from the character standing at feet,
    // as the actions carry it: { line, along, blocked } or null
    targetFrom(o, d, feet, exclude) { const t = targeting.find(o, d, feet, exclude); return t && { line: t.line.id, along: t.along, blocked: t.blocked }; },
    valid, usable, openEnd,
    reset() { state = { mode: 'free' }; crouchBefore = null; },
    get mode() { return shown ? shown.mode : state.mode; },
    get line() { return shown ? shown.line : state.line ?? null; },   // the cover line the character is at (or runs to, enters)
    // task 027 (K1): what a PvP window needs of it (the controls: blind fire, rising over low cover), from the server
    view: () => ({ mode: state.mode, crouch: !!state.line?.crouch }),
    // task 028 (K3): the whole state, kept and put back (sim/copy.js: the lines and colliders stay the arena's)
    save: () => copyState({ state, target, crouchBefore, panelState }, arenaLines),
    load(s) { ({ state, target, crouchBefore, panelState } = copyState(s, arenaLines)); shown = null; },
    // the whole state as text (the PvP server tells a window its own fighter's cover, net/own.js): lines by their
    // number among all, vectors as numbers, a collider by its handle (the arena is built in the same order everywhere)
    toWire: () => JSON.stringify(enc({ state, target, crouchBefore, panelState })),
    fromWire(text) { ({ state, target, crouchBefore, panelState } = dec(JSON.parse(text))); shown = null; },
    lineAt: i => lines[i],
    keep: arenaLines,   // (task 028: what a copy of a state keeps as it is)
    show(v) { shown = { mode: v.mode, line: v.crouch ? { crouch: true } : null }; },
    get target() { return target; },
    get act() { return state.act ?? null; },     // task 015: what LT or blind fire does in cover now (tests)
    standAt, standOff, clampAlong, cornerAt, leanFor,
  };
}
