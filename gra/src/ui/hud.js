// The HUD of task 008, recreated from reference/hud_gracza.html: the player's block next to the character (the machine's
// script, HP in four parts, rounds, the medkit vial), the crosshair and the hit markers, the target's bar over its head,
// the arc of incoming fire, the arena move warning at the screen's edge, low HP and dimming when calm. Colours follow
// the script light (data/hud.js). The page is written only when a value changes; things pinned to the world move by
// `transform`.
import * as THREE from 'three';
import { HUD as H } from '../data/hud.js';
import { COMBAT } from '../data/combat.js';
import { MOTION } from '../data/arena.js';
import { SCRIBE } from '../data/scribe.js';
import { t, getLang } from '../i18n/index.js';

const $ = sel => document.querySelector(sel);
const rad = THREE.MathUtils.degToRad;
const clamp01 = x => Math.min(1, Math.max(0, x));

// the machine's script as small seeded glyphs, as in the reference (and the writing on the arena panels)
function rnd(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
function glyph(seed) {
  const r = rnd(seed); let d = '';
  const n = 2 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x1 = Math.round(r() * 4), y1 = Math.round(r() * 6), hor = r() < .5, len = 1 + Math.round(r() * 3);
    const x2 = hor ? Math.min(4, x1 + len) : x1, y2 = hor ? y1 : Math.min(6, y1 + len);
    d += `M${x1 + 1} ${y1 + 1}L${x2 + 1} ${y2 + 1}`;
    if (r() < .3) d += `M${x2 + 1} ${y2 + 1}l${r() < .5 ? 1 : -1} 1`;
  }
  return `<svg viewBox="0 0 6 8" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width=".8" stroke-linecap="square"/></svg>`;
}

// weapon: the match's weapon (WEAPONS entry, task 016): its magazine and its name by the ammunition
export function createHud(weapon) {
  const hud = $('#hud'), pause = $('#pause'), screens = $('#match');   // task 022: the match's screens take the colours too
  const G = H.glyphs;
  hud.querySelector('.glyphs').innerHTML = Array.from({ length: G.count }, (_, i) => glyph(G.seed + i * G.step)).join('');
  const el = {
    xh: hud.querySelector('.xh'), hit: hud.querySelector('.hit'), me: hud.querySelector('.me'),
    segs: [...hud.querySelectorAll('.seg')], ammo: $('#ammo'), ammoMax: $('#ammoMax'), weaponName: $('#weaponName'), kits: $('#kits'),
    itemGrenade: $('#itemGrenade'), itemKey: $('#itemKey'), grenades: $('#grenades'), keys: $('#keys'),
    ring: hud.querySelector('.ring .p'), rel: hud.querySelector('.rel .bar i'),
    foe: hud.querySelector('.foe'), foeBar: hud.querySelector('.foe .bar'), foeD: hud.querySelector('.foe .d'),
    campT: $('#campLeft'),
    dmg: hud.querySelector('.dmg'), warn: hud.querySelector('.warn'), warnT: hud.querySelector('.warn .t'), edge: hud.querySelector('.edge'),
  };
  el.xh.style.setProperty('--xh-hit', H.crosshair.hitColor); el.xh.style.setProperty('--xh-blocked', H.crosshair.blockedColor);
  // the match's weapon: its magazine, crosshair (task 016) and name; task 022: a new match may bring another one
  function setWeapon(w) {
    el.ammoMax.textContent = `/ ${w.magazine}`;
    el.xh.classList.toggle('ring', w.crosshair === 'ring');
    el.weaponName.dataset.i18n = w.name; el.weaponName.textContent = t(w.name);
  }
  setWeapon(weapon);
  let last = {};
  // write into the page only when the value changes
  const put = (key, v, f) => { if (last[key] !== v) { last[key] = v; f(v); } };
  const cls = (node, name, on, key) => put(key, on, v => node.classList.toggle(name, v));
  const prop = (node, name, v, key) => put(key, v, x => node.style.setProperty(name, x));

  // colours of the script light chosen by the player, and the stronger text shadow on the bone material
  function setLight(key) {
    const c = H.colors[key] || H.colors.ice;
    [hud, pause, screens].forEach(n => { n.style.setProperty('--me-rgb', c.me.join(',')); n.style.setProperty('--foe-rgb', c.foe.join(',')); });
  }
  function setMaterial(key) { [hud, pause, screens].forEach(n => n.style.setProperty('--shadow', key === 'bone' ? H.boneShadow : 1)); }

  let calmFor = 0, lastHp = COMBAT.hp, lastShots = 0, hurt = null, foeHp = null, chip = 0, chipAge = Infinity;
  const p = new THREE.Vector3(), camRight = new THREE.Vector3();

  // s: { visible, dt, frozen, aiming (LT), ready (aiming or the rifle raised by hip fire: the crosshair shows),
  //      spread (half-angle, degrees), camera, hp, medkits, mag,
  //      reload: { u } | null, heal: { u, to } | null, shots (count so far), lastHit: { zone, age } | null,
  //      foe: { alive, hp, top (Vector3), dist, aimed, hitAge }, arena: [{ tension, at (Vector3) } …] (moves announced now),
  //      calm: force the calm look (?freeze),
  //      camp: s left before SCRIBE's camping limit, or null }
  function update(s) {
    put('visible', s.visible, v => { hud.hidden = !v; });
    const low = s.visible && s.hp < H.lowHp;
    put('bodyLow', low, v => document.body.classList.toggle('hud-low', v));
    // task 017: the player stunned by a shock grenade: the picture flickers in the script's light
    put('stunned', !!s.stunned, v => hud.classList.toggle('stunned', v));
    if (!s.visible) return;
    const dt = s.frozen ? 0 : s.dt;

    // task 012: the camp warning in its last seconds (task 022: the round's clock is on the match's screens, ui/screens.js)
    const camp = s.camp != null && s.camp <= SCRIBE.camp.warnLast;
    cls(hud, 'camp', camp, 'camp');
    if (camp) put('campT', Math.ceil(s.camp), v => { el.campT.textContent = String(v); });

    // calm: nothing happened for calmAfter s (a shot, a hit either way, aiming, healing)
    const active = s.aiming || !!s.heal || s.shots !== lastShots || s.hp < lastHp || (s.lastHit && s.lastHit.age < dt + 1e-6) || hurt?.age === 0;
    lastShots = s.shots; lastHp = s.hp;
    calmFor = active ? 0 : calmFor + dt;
    cls(hud, 'calm', s.calm ?? calmFor >= H.calmAfter, 'calm');
    // the crosshair only while aiming or shooting, as in The Division (Paweł after playing 008: shown while running)
    cls(el.xh, 'off', !(s.ready ?? true), 'xhOff');

    // crosshair: the ticks stand where the edge of the spread cone is on the screen
    const px = Math.tan(rad(s.spread)) / Math.tan(rad(s.camera.fov / 2)) * innerHeight / 2;
    prop(el.xh, '--g', Math.round(Math.max(H.crosshair.minGap * innerWidth / 100, px)) + 'px', 'gap');
    const hit = s.lastHit, head = hit?.zone === 'head';
    const on = !!hit && hit.age < (head ? H.hitMarker.headTime : H.hitMarker.time);
    cls(el.hit, 'on', on && !head, 'hitOn'); cls(el.hit, 'head', on && head, 'hitHead');
    cls(el.xh, 'struck', on, 'xhHit');   // task 016: a hit turns the crosshair red, as in The Division
    cls(el.xh, 'blocked', !!s.blocked, 'xhBlocked');   // task 014 (U33): a solid between the rifle and the aim point

    // HP in four parts of 25; while healing, the light piece up to where the medkit will bring it
    const seg = 100 / H.hpSegments, to = s.heal ? s.heal.to : s.hp;
    el.segs.forEach((g, i) => {
      const f = clamp01((s.hp - i * seg) / seg), h = Math.max(0, clamp01((to - i * seg) / seg) - f);
      prop(g, '--f', (f * 100).toFixed(1) + '%', 'f' + i); prop(g, '--h', (h * 100).toFixed(1) + '%', 'h' + i);
    });
    cls(hud, 'low', low, 'low');
    put('ammo', s.mag, v => { el.ammo.textContent = v; });
    put('kits', s.medkits, v => { el.kits.textContent = v; });
    // task 017: items: { grenade: { left, ready, held }, key: { … } } (greyed when none is left or it cannot be used)
    if (s.items) {
      const G = s.items.grenade, K = s.items.key;
      if (G) { put('grenades', G.left, v => { el.grenades.textContent = v; }); cls(el.itemGrenade, 'off', !G.left || !G.ready, 'gOff'); cls(el.itemGrenade, 'held', G.held, 'gHeld'); }
      if (K) { put('keys', K.left, v => { el.keys.textContent = v; }); cls(el.itemKey, 'off', !K.left || !K.ready, 'kOff'); cls(el.itemKey, 'held', K.held, 'kHeld'); }
      put('keyShown', !!K, v => { el.itemKey.hidden = !v; }); put('grenadeShown', !!G, v => { el.itemGrenade.hidden = !v; });
    }
    cls(hud, 'reload', !!s.reload, 'reload');
    if (s.reload) prop(el.rel, '--r', s.reload.u.toFixed(3), 'rel');
    cls(hud, 'heal', !!s.heal, 'heal');
    if (s.heal) put('ring', (100 * (1 - s.heal.u)).toFixed(1), v => el.ring.setAttribute('stroke-dashoffset', v));

    foeBar(s, dt);
    hurtArc(dt);
    arenaWarn(s);
  }

  // the target's bar: over its head while the crosshair is on it with LT, and for a while after a hit; the white piece
  // is the damage of the last series
  function foeBar(s, dt) {
    const f = s.foe;
    if (foeHp !== null && f.hp < foeHp) { chip += foeHp - f.hp; chipAge = 0; }
    if (!f.alive || f.hp > (foeHp ?? f.hp)) chip = 0;
    foeHp = f.hp; chipAge += dt;
    if (dt === 0) chipAge = 0;   // ?freeze: the chip stays
    if (chipAge > H.foe.chipHold) chip = Math.max(0, chip - dt * COMBAT.hp / H.foe.chipFade);
    p.copy(f.top); p.y += H.foe.above; p.project(s.camera);
    const show = f.alive && p.z < 1 && ((s.aiming && f.aimed) || f.hitAge < H.foe.time);
    cls(el.foe, 'show', show, 'foe');
    if (!show) return;
    put('foePos', `${((p.x + 1) / 2 * innerWidth).toFixed(1)},${((1 - p.y) / 2 * innerHeight).toFixed(1)}`, v => {
      const [x, y] = v.split(','); el.foe.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    });
    prop(el.foeBar, '--fe', (100 * f.hp / COMBAT.hp).toFixed(1) + '%', 'fe');
    prop(el.foeBar, '--chip', (100 * chip / COMBAT.hp).toFixed(1) + '%', 'chip');
    put('foeD', Math.round(f.dist), v => { el.foeD.textContent = t('hud.metres', { m: v }); });
  }

  // incoming fire: angle of the shooter in degrees clockwise from the view's front
  function hurtArc(dt) {
    if (hurt) hurt.age += dt;
    const on = !!hurt && hurt.age < H.hurt.time;
    cls(el.dmg, 'on', on, 'dmg');
    if (on) put('dmgA', Math.round(hurt.angle), v => { el.dmg.style.transform = `rotate(${v + 90}deg)`; });
  }

  // a move announced now whose element is out of the picture: an arrow at that side's edge and the time left
  function arenaWarn(s) {
    let side = 0, left = 0;
    for (const m of s.arena) {
      p.copy(m.at).project(s.camera);
      const behind = p.z > 1, edge = 1 - 2 * H.arena.margin;
      if (!behind && Math.abs(p.x) <= edge && Math.abs(p.y) <= edge) continue;   // in the picture: its own light warns
      camRight.set(1, 0, 0).applyQuaternion(s.camera.quaternion);
      const x = behind ? m.at.clone().sub(s.camera.position).dot(camRight) : p.x;
      side = x >= 0 ? 1 : -1; left = Math.max(left, MOTION.warning * (1 - m.tension));
    }
    const on = side !== 0;
    cls(el.warn, 'on', on, 'warn'); cls(el.edge, 'on', on, 'edge');
    cls(el.warn, 'left', side < 0, 'warnL'); cls(el.edge, 'left', side < 0, 'edgeL');
    if (on) put('warnT', `${left.toLocaleString(getLang(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`, v => { el.warnT.textContent = v; });
  }

  return {
    update, setLight, setMaterial, setWeapon,
    // a hit on the player from this direction (degrees clockwise from the view's front); nobody shoots yet (test hook)
    hurtFrom(angle) { hurt = { angle, age: 0 }; },
    // ?freeze&pose=hud_*: the white piece of the last damage on the target's bar (HP points)
    freezeChip(v) { chip = v; chipAge = 0; },
    refresh() { last = {}; },
  };
}
