// Start: build the stage, the arena section (task 011) and the two fighters (the heroine and the Double, task 009), wire the
// panel, run the loop.
import './style.css';
import * as THREE from 'three';
import { GLOW, MOTION, TURNTABLE, INPUT, FREEZE, DEFAULT_MATERIAL } from './data/arena.js';
import { applyTexts, getLang, setLang, t } from './i18n/index.js';
import { combatLog } from './combat/log.js';
import { createStage } from './scene.js';
import { U } from './look/materials.js';
import { buildArena } from './sim/arena.js';
import { createEngine } from './sim/engine.js';
import { createClock } from './sim/clock.js';
import { createSmoothing } from './look/smooth.js';
import { createPvp } from './net/pvp.js';
import { createAccount } from './net/account.js';
import { createRanking } from './ui/ranking.js';
import { createView, PLAY, WELCOME } from './view.js';
import { createControls } from './ui/controls.js';
import { createPerf } from './ui/perf.js';
import { createTppCamera } from './player/camera.js';
import { createInput } from './player/input.js';
import { loadHeroAssets, disposeLook } from './player/hero.js';
import { HERO } from './data/hero.js';
import { createMarker } from './player/marker.js';
import { loadRifle } from './combat/weapon.js';
import { createMatch } from './fighter/match.js';
import { createPreview } from './items/preview.js';
import { itemFor } from './items/items.js';
import { ITEMS } from './data/items.js';
import { WEAPONS } from './data/combat.js';
import { createEffects } from './combat/effects.js';
import { createMarks } from './look/marks.js';
import { createShadowUpdates } from './look/shadows.js';
import { createHud } from './ui/hud.js';
import { createPause } from './ui/pause.js';
import { createInstall } from './ui/install.js';
import { createPlayerControl } from './fighter/player.js';
import { createBot } from './bot/bot.js';
import { dressDouble, setDoubleLight, tickDouble } from './look/double.js';
import { rimOpponents, opponentsOf, setRimLight } from './look/rim.js';
import { createCharacters } from './look/characters.js';
import { AIM_POSES, ROLL_POSE, applyPose, exposeHooks } from './debug/hooks.js';
import { createBotStats } from './debug/botvbot.js';
import { createAudio } from './audio/engine.js';
import { createGameSounds } from './audio/game.js';
import { createFlow } from './ui/flow.js';
import { createWelcome } from './ui/welcome.js';
import { startEarly, compileFor, warmUp } from './ui/early.js';
import { idleAction } from './fighter/actions.js';
import { createScreen, useFresco, screenSkyLight } from './look/screen.js';
import { loadFresco } from './look/fresco.js';
import { useCompression, bakeAll, rebakeAll } from './look/textures.js';
import { watchContext } from './ui/context.js';
import { createBench } from './bench/bench.js';
import { createBenchScreen } from './bench/screen.js';
import { BENCH } from './data/bench.js';
import { registerWorker } from './sw-register.js';
import { ITCH } from './net/where.js';

// ?freeze (screenshots, debug/hooks.js): the opponent is on the Dummy level unless &level= says otherwise.
// ?botvbot (task 009): two bots play each other, &speed= simulation steps per drawn frame
// task 024: the game's files kept for the next launch (task 033 B3: not in itch.io's frame: no service worker, and no
// manifest there, so no offer to install)
if (!ITCH) registerWorker();
// task 026 (U44): the browser's offer to install the game, listened to from the start (it may come while the game loads)
let onInstallChange = () => {};
const install = createInstall({ onChange: () => onInstallChange() });
const params = new URLSearchParams(location.search);
// task 030 (K5, audit B2): the test tools (the test panel, the pause's weapon and SCRIBE switch) only with ?test
const testTools = params.has('test');
const frozen = params.has('freeze'), botvbot = params.has('botvbot');
const pose = frozen ? params.get('pose') : null;
const level = params.get('level') ?? (frozen ? 'dummy' : botvbot ? 'normal' : undefined);
const speed = botvbot ? Math.max(1, +(params.get('speed') ?? 1)) : 1;
// task 016: the match's seed and weapon (only its model is loaded). Task 022: the tests start the match at once
const match = createMatch(params), auto = frozen || botvbot || params.has('level') || params.has('auto');
let weaponPending = match.weapon;

// numbers quoted in the on-screen description come from the data file
const texts = { diameter: TURNTABLE.radius * 2, every: MOTION.turn.every, warning: MOTION.warning, degrees: MOTION.turn.degrees };
applyTexts(document, texts);

let stage;
try { stage = createStage(document.getElementById('stage')); }
catch (e) { document.getElementById('err').hidden = false; throw e; }
const dom = stage.renderer.domElement;
useCompression(stage.renderer);   // task 024: the engraved surfaces compressed where the card can

// the arena section, the same as the server's (task 027, sim/arena.js); the gallery: the preview of the elements (U3)
const arena = buildArena(stage.scene, { gallery: true });
const { wall, turntable, gallery, elements: arenaElements, motion } = arena;
if (frozen) { motion.setAuto(false); U.uWave.value = FREEZE.wave; U.uSeal.value = FREEZE.seal; }
const view = createView(stage.camera, dom);
// fill light on the camera (HERO.fill): on only in the Play view, so the preview views keep the arena's look. Task 024
// (K4): off is intensity 0, not hidden (a light hidden or shown is another number of lights: every shader again)
const fill = new THREE.PointLight(HERO.fill.color, 0, HERO.fill.distance, HERO.fill.decay);
stage.camera.add(fill); stage.scene.add(stage.camera);
const screenSky = screenSkyLight(stage.scene);   // task 024 (K4): the LED screen's light in before the shaders
// task 022: before the start screen (not in the tests; ?welcome shows it). Task 024 (K3): it shows as soon as the
// middle panel's textures are baked, the floor's pictures loaded and the arena's shaders compiled; the rest loads behind
const welcome = createWelcome({ view, motion });
window.__theone = { welcomeReady: false };
const early = startEarly({ stage, wall, turntable, motion, view, welcome, frozen });
const panelSurfaces = { traverse: f => wall.panels.forEach(p => p.g.traverse(f)) };
const welcomeReady = Promise.all([bakeAll(panelSurfaces), stage.floor.pictures]).then(() => compileFor(stage)).then(() => {
  if (!auto || params.has('welcome')) welcome.show();
  early.draw(); window.__theone.welcomeReady = true;
});

const [assets, rifleModel, fresco] = await Promise.all([loadHeroAssets(), loadRifle(match.weapon), useFresco ? loadFresco() : null, bakeAll(stage.scene)]);
// task 020: bullet marks on the elements, the wall of panels and the turntable's arms
const marks = createMarks([...arenaElements, ...wall.panels.map(p => p.g), ...turntable.arms]);
const effects = createEffects(stage.scene, marks);
// sound (task 010): the ears on the camera; both fighters' shots and steps, the arena's moves
const audio = createAudio({ camera: stage.camera });
// task 027 (K2): the fight without drawing (sim/engine.js), the same as the PvP server's: the physics, the heroine (the
// player's, or a second bot in ?botvbot) and the Double, the bots, SCRIBE, the items and the match's rounds
// (tpp, smooth: made after the engine; the tests' round may start inside it, before them)
let hud = null, tpp = null, smooth = null;
const engine = await createEngine({ scene: stage.scene, arena, assets, rifleModel, match, effects, audio, opt: {
  level, levelA: botvbot ? params.get('levelA') ?? level : null, names: botvbot ? ['botA', 'botB'] : ['player', 'bot'], auto, autoAgain: botvbot, frozen,
  onHurtA: h => hurtPlayer(h),
  // task 027 (K8): ?record: the first match recorded for scripts/replay.mjs (__theone.engine.recording)
  record: params.has('record'), recordDetail: params.get('record')?.includes('-') ? params.get('record').split('-').map(Number) : null, recordMeta: () => ({ looks: [characters.key, characters.opponent], level: level ?? round.level, names: botvbot ? ['botA', 'botB'] : ['player', 'bot'] }),
  round: { prepare: () => { drawAhead(); return Promise.all([useWeapon(match.weapon), characters.settled()]).then(() => performanceGate()); },
    ready: () => matchReady(),   // task 024 (K3): the first match waits for its files and shaders
    onReset: yaw => { tpp?.reset(yaw); smooth?.forget(); } } } });
const { physics, ballistics, nav, machine, round, player, foe } = engine, itemWorld = engine.items;
const bot = engine.botB, other = engine.botA;
dressDouble(foe.body); rimOpponents(player, [player, foe]);   // task 023 (U40): the rim on the viewer's opponents

tpp = createTppCamera(stage.camera, physics);
tpp.reset(player.spawn.yaw);   // (where a round started already put the player)
const input = createInput(dom);
const control = createPlayerControl({ input, tpp, camera: stage.camera, fighter: player, ballistics });
const marker = createMarker(stage.scene);
const sounds = createGameSounds({ audio, player, foe, own: !botvbot, wall });
hud = createHud(WEAPONS[match.weapon]);
hud.setLight(GLOW.default); hud.setMaterial(DEFAULT_MATERIAL);
// task 022: another weapon (a new match, the training level's choice) without reloading the page
let weaponShown = match.weapon, weaponModel = rifleModel;
// task 026: the weapons' models fetched ahead (key → promise), each one once
const weaponsAhead = new Map();
const fetchWeapon = key => { if (!weaponsAhead.has(key)) weaponsAhead.set(key, loadRifle(key)); return weaponsAhead.get(key); };
async function useWeapon(key) {
  if (key === weaponShown) return;
  const model = await fetchWeapon(key);
  if (key === weaponShown) return;   // (asked twice meanwhile)
  weaponsAhead.delete(key);
  weaponShown = key; player.setWeapon(model); foe.setWeapon(model); hud.setWeapon(WEAPONS[key]);
  disposeLook(weaponModel); weaponModel = model;   // task 024 (K4): the weapon no longer held leaves the card
  // a model fetched ahead for a match that will not come (the training level's choice instead)
  for (const [k, p] of weaponsAhead) if (k !== match.weapon) { weaponsAhead.delete(k); p.then(disposeLook, () => {}); }
}
// task 026: the next match (its seed and weapon, the same for both) is drawn as soon as the last one ends or is left,
// not at Play, and its weapon fetched while the player is on the result or the start screen. drawnFor: the number of
// the match the seed is drawn for (the first: at the page's start); round.matches counts the matches begun
let drawnFor = 1;
function drawAhead() {
  if (drawnFor > round.matches) return;
  match.next(); weaponPending = match.weapon; drawnFor = round.matches + 1;
  // its shaders compiled too (else the first Play with a new weapon waited about 2 s for them)
  fetchWeapon(match.weapon).then(m => compileFor(stage, m)).catch(e => console.warn('weapon ahead:', e));
}
round.on(kind => { if (kind === 'matchEnd' || kind === 'menu') drawAhead(); });
const posedAim = AIM_POSES.includes(pose);
// task 024 (K3): what the first match needs before its countdown: both characters' looks, the sounds' files, and the
// shaders of everything the fight draws compiled (K4)
const matchReady = () => Promise.all([characters.settled(), audio.loaded]).then(() => performanceGate());

// a hit on the player: the HUD's arc shows where the shot came from (degrees clockwise from the view's front)
function hurtPlayer(h) {
  const y = tpp.yaw, fx = -Math.sin(y), fz = -Math.cos(y), from = { x: -h.dir.x, z: -h.dir.z };
  hud?.hurtFrom(THREE.MathUtils.radToDeg(Math.atan2(from.x * -fz + from.z * fx, from.x * fx + from.z * fz)));
}

// the LED screen round the arena (task 013): it writes by itself; SCRIBE's public events set off its alarm
const screen = createScreen(stage.scene, { frozen, fresco, sky: screenSky }); machine.listen((kind, at) => screen.alarm(kind, at));
// task 017: the thrower's preview (the items themselves are the engine's)
const preview = createPreview(stage.scene);

const panel = createControls({ view, motion, texts, onLight: k => { hud.setLight(k); setDoubleLight(k); setRimLight(k); screen.setLight(k); }, onMaterial: hud.setMaterial,
  floor: stage.floor.choice, onFloor: k => stage.floor.setChoice(k) });
// pause (task 008): Menu / Esc; the test panel (the old side panel) opens from it and the game runs behind it.
// Task 009: the opponent's level; "Leave match" starts a new round
let frameCap = 0, lastFrame = 0;   // task 020: the frame rate's cap (set by the pause), the last frame drawn
// task 031: the PvP account (sign-in, the nick, the ranking's table); its screens (ui/ranking.js) made after PvP
const account = createAccount();
let ranking = null, foundWas = false;
const pause = createPause({
  test: testTools,
  account, ranking: { get open() { return !!ranking?.open; }, openNick: () => ranking.openNick(), openPrivacy: () => ranking.openPrivacy(),
    openCredits: () => ranking.openCredits(), close: () => ranking.close() },
  inPvpMatch: () => !!pvp?.inMatch,
  // task 030 (K3): the arena's look in Settings (in PvP only the host before the match, 027 K5); the address's floor wins
  look: { get: () => panel.look, set: v => panel.setLook(v), allowed: () => pvp?.mayLook ?? true, forced: params.has('floor') ? ['floor'] : [] },
  language: { get: getLang, set: k => { setLang(k); applyTexts(document, texts); } },
  copyLog: () => navigator.clipboard?.writeText(combatLog.text()).catch(() => {}),
  pvp: () => pvp,   // (task 029: the pause's Search and ping; PvP is made below)
  install,
  onPanel: () => panel.showPanel(true),
  onQuit: () => (pvp?.active ? pvp.leave() : round.leave()),   // (audit 027 F2: in PvP the room too)
  onClose: () => {
    input.swallow(); round.resume();   // the button that closed it must not act in the game too (audit 008)
    // task 016: another weapon chosen on the training level (task 022: loaded now, the page stays)
    if (weaponPending !== match.weapon) { match.use(weaponPending); useWeapon(weaponPending); }
  },
  weapon: { get: () => weaponPending, choose: k => { weaponPending = k; }, locked: () => round.level !== 'dummy' },
  frames: { set: v => { frameCap = v; } },
  resolution: { set: v => stage.setScale(v) },   // task 024 (K6)
  bench: { last: () => bench.stored, again: () => { bench.forget(); try { localStorage.removeItem(BENCH.anyway); } catch { /* storage blocked */ } } },   // (K5)
  level: { get: () => round.pending, choose: k => round.choose(k) },
  scribe: { get: () => machine.on, set: v => machine.setOn(v) },   // task 012
  screen: { set: k => screen.setBrightness(k), color: k => screen.setFrescoColor(k), quality: k => screen.setFrescoQuality(k) },   // tasks 013, 021
  volume: audio, onSound: () => audio.play('menu', { ui: true }),   // task 010
  music: { get on() { return flow.music?.on ?? false; }, setOn: v => flow.music?.setOn(v), get volume() { return flow.music?.volume ?? 0; }, setVolume: v => flow.music?.setVolume(v) },
  fullscreen: { get: () => flow.fullscreen.get(), set: v => flow.fullscreen.set(v) },   // task 022
});
onInstallChange = () => pause.refresh();
// task 022: the match's screens, its music, the full screen (ui/flow.js)
const showHint = () => { hint.hidden = false; hintUntil = performance.now() + INPUT.hintSeconds * 1000; };
// task 023: the character chosen on the start screen, worn by both (only its file is fetched)
const characters = createCharacters({ player, foe, look: assets.model, me: round.me, rimmed: () => opponentsOf(player, [player, foe]) });
// task 027 (K7): PvP on the laptop (net/pvp.js); its clock and drawing are the game's (made below, used when it runs)
const steps = createClock();
const pvp = createPvp({ engine, round, control, tpp, characters, useWeapon, match, looks: panel, clock: steps, effects, audio, sounds,
  smooth: { capture: () => smooth.capture() }, onHurt: h => hurtPlayer(h), token: () => account.token,
  onSignedOut: () => account.dropped() });
ranking = createRanking({ account, pvp, nickDefault: () => round.me.nick });
const flow = createFlow({ round, match, dom, pause, audio, input, quiet: botvbot || frozen, showHint, characters, pvp });
panel.lockLook(() => pvp.mayLook);   // (K5, audit F3)
applyPose(pose, { player, foe, bot, tpp, hud, motion, pause });
const perf = createPerf(stage);
// task 024 (K4): the graphics card's context lost: the game stands; given back: the card's things made again (the
// baked textures, the environment's light, the shadow maps, the shaders), a match in progress ends without a result
const gpu = watchContext({ canvas: dom,
  onLost: () => audio.setPaused(true),
  onRestored: async () => {
    stage.redrawEnvironment(); gallery.scene.environment = stage.scene.environment;
    stage.scene.traverse(o => { if (o.isLight && o.castShadow) o.shadow.needsUpdate = true; });   // the shadow maps (drawn on demand)
    await rebakeAll(); await compileFor(stage);
    if (round.phase !== 'menu') round.leave();
  } });
// task 024 (K5): the performance test before the first match on this device (bench/bench.js); not in the tests'
// pages (?freeze, ?botvbot, ?level, ?auto) unless ?bench asks for it (?bench=2: method 2, the pixel read back)
const bench = createBench({ stage, method: params.get('bench') === '2' ? 2 : null }), benchScreen = createBenchScreen();
const benchRound = { level: 'normal', over: null, time: 0 };
let benching = false, benchBot = null;
async function runBench() {
  benchScreen.checking();
  benchBot ??= createBot({ me: player, other: foe, ballistics, nav, level: 'normal', camp: () => null, rand: engine.rng.stream('bot:bench') });
  const [a, b] = BENCH.spots;
  player.reset({ x: a[0], z: a[1], yaw: 0 }); foe.reset({ x: b[0], z: b[1], yaw: Math.PI });
  bot.setLevel('normal'); bot.reset(); benchBot.reset(); foe.passive = false; benchRound.time = 0;
  // task 026: drawn at the size the game draws at here (its drawing buffer), at most BENCH.width × BENCH.height pixels
  const own = stage.renderer.getDrawingBufferSize(new THREE.Vector2()), k = Math.min(1, Math.sqrt(BENCH.width * BENCH.height / (own.x * own.y)));
  const size = [Math.round(own.x * k), Math.round(own.y * k)];
  view.go(BENCH.view, true); audio.setPaused(true); stage.setFixedSize(size);
  benching = true;
  const r = { ...await bench.test(dt => { advance(dt); smooth.apply(steps.alpha); draw(dt); smooth.restore(); }), size };
  benching = false;
  stage.setFixedSize(null); audio.setPaused(false); machine.reset(); itemWorld.reset(); effects.clearMarks();
  view.go(PLAY, true); benchScreen.hide();
  return r;
}
// (task 026: ?bench=off skips it, for the measurements of the start: scripts/check-start.mjs)
const benchAsked = params.has('bench') && params.get('bench') !== 'off';
async function performanceGate() {
  if ((auto && !benchAsked) || bench.anyway || params.get('bench') === 'off') return;
  let r = bench.stored;
  if (!r || benchAsked) { r = await runBench(); bench.remember(r); window.__theone.benchResult = r; }
  if (r.verdict === 'weak') { await benchScreen.weak(r); bench.playAnyway(); }
}
const status = document.getElementById('status'), hint = document.getElementById('hint');
const scoreEl = document.getElementById('score'), foeName = document.getElementById('foeName');
// the controls hint: until this moment (the clock of the page, so a pause at the start does not keep it; Paweł
// 30.09.2026: it stayed until the pause was opened and closed), or until the player does something
let hintUntil = 0;

view.onChange(key => {
  // the Elements and Shapes views draw the gallery's own scene instead of the arena (task 011, U3)
  const galleryView = key === 'elements' || key === 'shapes';
  if (galleryView) bakeAll(gallery.scene);   // task 024: its own surfaces only when it is first shown
  stage.show(galleryView ? gallery.scene : null);
  // Play: controls on, side panel and status hidden (task 022: the welcome screen hides them too)
  const play = key === PLAY, bare = play || key === WELCOME;
  fill.intensity = play ? HERO.fill.intensity : 0;
  input.setEnabled(play);
  panel.setQuiet(bare || !testTools);   // (task 030: no "show panel" button for players)
  status.hidden = bare;
  if (key === WELCOME) panel.showPanel(false);
  // (task 030, K2: no controls hint by itself on entering the game: only the start screen's and the pause's Controls)
  if (play) panel.showPanel(false); else if (document.pointerLockElement) document.exitPointerLock();
  hintUntil = 0; hint.hidden = true;
});
if (botvbot) view.go('all');

// mouse look: click into the game to capture the cursor; Esc releases it and opens the pause (task 008)
// (task 022: only while the match wants it: the start screen and the result keep the mouse for their buttons)
dom.addEventListener('click', () => { flow.click(); if (view.current === PLAY && !panel.panelVisible && !pause.open && flow.wantsLock) dom.requestPointerLock?.(); });
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && view.current === PLAY && !panel.panelVisible && flow.wantsLock && !pvp.canTake) pause.setOpen(true);
});

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stP = document.getElementById('stP'), stT = document.getElementById('stT');
const clock = new THREE.Clock();
// task 020: the shadow maps drawn only when something moves in a light's cone; the frame rate's cap (pause)
const shadowUpdates = createShadowUpdates(stage.scene, () => [player, foe]);
function draw(dt) { shadowUpdates.update(dt); stage.render(); }
let time = 0, last = null;   // the pictures' clock (the script's wave, the seal's pulse); the last step's result
const stats = botvbot ? createBotStats({ fighters: [player, foe], bots: [other, bot], round, ballistics, machine, physics }) : null;
// task 027 (K2): the fight in fixed steps of 1/60 s (sim/clock.js), also against the bot; the picture drawn between
// the last two steps (look/smooth.js): the bodies, the moving panel, the turntable, SCRIBE's elements (a rifle follows its
// hand: its matrix is made from it)
smooth = createSmoothing(() => [player.body.root, foe.body.root, wall.panels.find(p => p.moving).g, turntable.group,
  ...turntable.arms, ...machine.mech.els.map(e => e.part)].filter(Boolean));

// one step of the fight (sim/engine.js), with the player's pad and view round it (or the second bot's: ?botvbot, the
// performance test); then the sounds and the test's statistics
function simulate(h) {
  const driver = botvbot ? other : benching ? benchBot : null, human = !driver;
  const play = view.current === PLAY;
  // task 022: outside the round (the screens, the countdown) both stand; the player may look round in the countdown
  const acts = round.fighting || benching;
  // task 024 (K5): in the performance test SCRIBE runs as in a match on the Normal level (no round runs then)
  if (benching) benchRound.time += h;
  smooth.capture();
  const s = engine.step(h, {
    input: human ? ({ turnDelta }) => { const a = control.poll({ play, pose, turnDelta }); return acts ? a : idleAction(tpp.yaw, tpp.pitch); } : null,
    driveA: benching ? benchBot : null, active: play, acts, round: benching ? benchRound : null, pose, rollPose: ROLL_POSE,
    moved: human ? r => control.moved(r) : null, aim: human ? () => control.aim() : null, recoil: human && play ? r => control.recoil(r) : null,
  });
  // task 017: the player stunned by a shock grenade: the view shakes a little (the picture's, not the fight's chance)
  if (play && player.stunned && !frozen) { const k = ITEMS.grenade.shock.shake; control.recoil({ pitch: (Math.random() - 0.5) * k, yaw: (Math.random() - 0.5) * k }); }
  stats?.update(h);
  sounds(h, s.m, s.a, s.b);
  return (last = { m: s.m, play, a: s.a });
}
// a drawn frame's time: the fight's whole steps (?botvbot: `speed` steps a frame, the tests' pace)
function advance(dt) {
  const n = botvbot ? speed : Math.max(steps.advance(dt), last ? 0 : 1);
  for (let i = 0; i < n; i++) simulate(steps.step);
}

function tick(now = performance.now()) {
  // above the cap: this refresh of the screen is skipped (a little early is fine: the screen's own rhythm)
  if (frameCap && now - lastFrame < 1000 / frameCap - 2) { requestAnimationFrame(tick); return; }
  lastFrame = now;
  if (gpu.lost) { clock.getDelta(); requestAnimationFrame(tick); return; }   // task 024 (K4): nothing runs, nothing drawn
  if (bench.running) { bench.frame(now); clock.getDelta(); requestAnimationFrame(tick); return; }   // (K5)
  benchScreen.update();
  const raw = clock.getDelta(); const dt = Math.min(raw, .05);
  screen.update(pause.open ? 0 : dt);
  audio.setPaused(pause.open);
  // paused: the game stands still (arena, physics, animations, the fighters); only the menu and the picture
  // task 031 (Paweł 06.10): a match found closes the pause, so its note shows and can be taken (the player asked for it)
  if (pvp.canTake && !foundWas && pause.open) pause.setOpen(false);
  // (audit r4 B2: and frees the captured cursor, so a click reaches the note; a click into the arena captures it again)
  if (pvp.canTake && !foundWas && document.pointerLockElement) document.exitPointerLock();
  foundWas = pvp.canTake;
  if (pause.open) {
    // (task 027: a PvP match goes on behind the pause: the server's; the player stands)
    if (!pvp.frame(raw, { play: false, paused: true })) steps.reset();
    pause.poll(); audio.update(); flow.music?.update(raw);   // audit 022 F1: the pause's Music settings act at once
    hud.update({ visible: false });
    draw(raw); perf.frame(raw); requestAnimationFrame(tick);
    return;
  }
  // the pictures' clock; the input and the view's turn every drawn frame (task 027: the fight's steps take them)
  if (!frozen) {
    time += dt;
    U.uWave.value = (U.uWave.value + dt * (reduce ? GLOW.waveSpeedReduced : GLOW.waveSpeed)) % 1;
    U.uSeal.value = GLOW.sealPulse.mid + GLOW.sealPulse.amp * Math.sin(time * GLOW.sealPulse.speed);
  }
  const playing = view.current === PLAY;
  if (!botvbot) {
    const k = control.sample(clock.elapsedTime, { aimPose: posedAim });
    if (playing && k.menu && !pvp.holdsBack && !pvp.justCancelled) { panel.showPanel(false); pause.setOpen(true); }   // (task 027: Esc takes back PvP's waiting)
    control.turn(dt, { play: playing, hold: ['menu', 'end', 'loading'].includes(round.phase) });
  }
  // task 027: in a PvP match the steps are the server's views (net/pvp.js); else the fight's own
  const shown = pvp.frame(dt, { play: playing }) && pvp.last.m;
  if (!shown) advance(dt);
  const { m, play, a } = shown ? { ...pvp.last, play: playing } : last, hudPose = frozen && pose?.startsWith('hud_');
  // drawn between the last two steps; the camera at the body as drawn
  smooth.apply(botvbot ? 1 : steps.alpha);
  if (shown) pvp.place(player.body.root);   // (task 028: the own fighter where its prediction draws it)
  if (!botvbot && play) control.place(player.body.root.position);
  if (play && round.phase === 'menu') characters.showcase(stage.camera, tpp.yaw);   // task 023: the character chosen, from the front
  stP.textContent = t('phase.' + m.panel.key); stT.textContent = t('phase.' + m.turn.key);
  preview.update(play ? player.itemState.preview : null, itemWorld);
  marker.update(play ? player.coverState.target : null);
  effects.update(frozen ? 0 : dt);
  tickDouble(frozen ? 0 : dt);
  flow.update(dt, play && !panel.panelVisible); welcome.update();
  ranking.update(flow.screens.state, !!pvp.mode);   // (task 031: the ranking's table and the ranked result)
  hud.update({ visible: play && !panel.panelVisible && ['fight', 'ot', 'range'].includes(flow.screens.state), dt, frozen, aiming: !!a.aim,
    ready: player.aiming || player.shot.raised || player.shot.firing || hudPose, spread: player.weapon.spread(!!a.aim), camera: stage.camera, blocked: player.weapon.blocked,
    hp: player.hp, medkits: player.health.medkits, mag: player.weapon.mag, reload: player.weapon.reload, heal: player.health.heal,
    shots: player.weapon.fired, lastHit: player.weapon.lastHit, calm: hudPose ? pose === 'hud_calm' : undefined,
    foe: { alive: foe.alive, hp: foe.hp, top: foe.top, hitAge: foe.hitAge, dist: player.feet.distanceTo(foe.feet),
      aimed: play && !!a.aim && control.aimed === foe },
    arena: announced(m), camp: machine.campLeft(0), stunned: player.stunned,
    items: player.items && Object.fromEntries(['grenade', 'key'].map(k => [k, itemFor(k)]).filter(([, id]) => id)
      .map(([k, id]) => [k, { left: player.items.left[id], ready: player.items.ready(id), held: player.items.holding === id }])) });
  // the opponent's name over its bar, and the wins in the test panel
  // (task 030 K6: in PvP the other player's nick)
  const name = foe.passive ? 'hud.foe.dummy' : 'hud.foe.double', nick = pvp.inMatch ? pvp.otherNick : null;
  if (nick) { if (foeName.textContent !== nick) { delete foeName.dataset.i18n; foeName.textContent = nick; } }
  else if (foeName.dataset.i18n !== name) { foeName.dataset.i18n = name; foeName.textContent = t(name); }
  scoreEl.textContent = t('round.score', round.score) + (round.pending !== round.level ? ' · ' + t('round.next', { level: t('level.' + round.pending) }) : '');

  if (hintUntil) {
    const r = control.input, acted = r && (Math.hypot(r.move.x, r.move.y) > 0 || Math.hypot(r.look.x, r.look.y) > 0 || r.aim || r.shoot || r.cover);
    if (performance.now() >= hintUntil || acted) { hintUntil = 0; hint.hidden = true; }
  }
  view.update(dt);
  draw(dt);
  smooth.restore();   // (the fight finds the true places again)
  perf.frame(raw);
  requestAnimationFrame(tick);
}
// arena moves announced now, for the HUD's warning at the screen's edge (task 008): the moving panel and the turntable
const movingPanel = wall.panels.find(p => p.moving).g, panelAt = new THREE.Vector3(), discAt = new THREE.Vector3(TURNTABLE.center[0], 1, TURNTABLE.center[1]);
function announced(m) {
  const out = [];
  if (m.panel.key === 'warning') { movingPanel.getWorldPosition(panelAt); panelAt.y += 1.8; out.push({ tension: m.panel.tension, at: panelAt }); }
  if (m.turn.key === 'warning') out.push({ tension: m.turn.tension, at: discAt });
  return out;
}
// task 024 (K4): every shader compiled before the game's first frame (and a bullet mark's), the opponent's look on first
// (one after the other: a look put on meanwhile would free materials whose shaders are being compiled)
await characters.ready;
await warmUp(stage, { extra: [marks.sample()] });
// task 024 (K3): the game's loop takes over from the welcome screen's; a press that waited for it goes on
time = await welcomeReady.then(() => early.stop());
engine.setTime(time);   // (the panels' tremor goes on from the welcome screen's)
welcome.ready();
// task 026: the test panel and the status may show from now (the views have set them; on a phone the welcome screen
// stood for seconds with them over it)
document.body.classList.remove('loading');
tick();

exposeHooks({ engine, pvp, view, frozen, player, foe, bot: botvbot ? [other, bot] : bot, round, nav, tpp, camera: stage.camera, fill, motion,
  turnAngle: () => engine.turnAngle, hud, pause, physics, control, stats, audio, stage, gallery, machine, screen, match, itemWorld, marks, ballistics, flow, characters,
  useWeapon: k => { match.use(k); weaponPending = k; return useWeapon(k); } });
