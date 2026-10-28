// The sound engine (task 010): Web Audio through THREE.AudioListener on the camera. A sound is played by its name in
// data/sound.js: spatial from a place in the world (a PannerNode, HRTF), or "own" (the player's: not spatial, close).
// The browser allows sound only after the player's first input (a key, a click, a pad button), so the audio context is
// made then, not before: before it, sounds are skipped without an error. The files are fetched at the start and
// decoded once the context exists.
//   bus: game sounds → game (muted in the pause) → limiter → the listener's volume (Volume in the pause) → speakers;
//        menu sounds → ui → limiter (heard in the pause).
import { asset } from '../asset.js';
import * as THREE from 'three';
import { SOUNDS, MIX } from '../data/sound.js';
import { myPad } from '../player/pad.js';

const KEY = 'theone.volume';
const LOOPS = Object.keys(SOUNDS).filter(k => SOUNDS[k].loop && SOUNDS[k].files.length);   // empty loops: nothing to do

function storedVolume() {
  try { const v = parseFloat(localStorage.getItem(KEY)); if (v >= 0 && v <= 1) return v; } catch { /* storage blocked */ }
  return MIX.volume;
}

// camera: the listener hangs on it (its place and direction are the ears)
export function createAudio({ camera }) {
  let ctx = null, listener = null, game = null, ui = null;
  let volume = storedVolume(), paused = false;
  const raw = {}, buffers = {}, trims = {};   // trims: file → [start, end] s of a loop without the encoder's silence
  const voices = [];            // playing one-shot sounds, oldest first
  // for test scripts (window.__theone.sound): calls per name (also silent and before the first input), sounds that
  // really started, calls of empty entries, voices cut by the limit, the most voices at once
  const stats = { requested: {}, played: {}, silent: 0, cut: 0, peak: 0, file: {},   // file: name → the last file picked
    get voices() { return voices.length; }, get state() { return ctx ? ctx.state : 'none'; } };

  // fetched at once (no audio context needed yet), decoded later
  for (const e of Object.values(SOUNDS)) for (const f of e.files) {
    raw[f] ??= fetch(asset(f)).then(r => { if (!r.ok) throw new Error(`${f}: ${r.status}`); return r.arrayBuffer(); });
  }
  // task 024 (K3): every file fetched (or failed): the first match waits for it
  const loaded = Promise.allSettled(Object.values(raw));

  // the first input: make the context (or wake it), then decode the files
  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    // without the user's activation the browser would make it suspended and warn in the console
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    listener = new THREE.AudioListener();
    camera.add(listener);
    ctx = listener.context;
    if (ctx.state === 'suspended') ctx.resume();
    const L = MIX.limiter, limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = L.threshold; limiter.knee.value = L.knee; limiter.ratio.value = L.ratio;
    limiter.attack.value = L.attack; limiter.release.value = L.release;
    limiter.connect(listener.getInput());
    game = ctx.createGain(); game.gain.value = paused ? 0 : 1; game.connect(limiter);
    ui = ctx.createGain(); ui.connect(limiter);
    listener.setMasterVolume(volume);
    for (const [f, p] of Object.entries(raw)) {
      p.then(b => ctx.decodeAudioData(b)).then(b => { buffers[f] = b; }).catch(err => console.error('sound', f, err));
    }
    removeEventListener('keydown', unlock, true); removeEventListener('pointerdown', unlock, true);
  }
  addEventListener('keydown', unlock, true);
  addEventListener('pointerdown', unlock, true);

  // a loop's start and end without the silence the mp3 encoder adds at both ends (else a gap at every seam)
  function trim(b) {
    const d = b.getChannelData(0), q = MIX.loopSilence;
    let s = 0, e = d.length - 1;
    while (s < e && Math.abs(d[s]) < q) s++;
    while (e > s && Math.abs(d[e]) < q) e--;
    return [s / b.sampleRate, (e + 1) / b.sampleRate];
  }

  function stop(v) {
    const now = ctx.currentTime;
    v.gain.gain.setTargetAtTime(0, now, 0.01);
    v.src.stop(now + 0.05);
    const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1);
  }

  // one of the entry's files: never one of the last MIX.noRepeat played (as far as the number of files allows), so a
  // sound does not grow tiresome (Paweł, 28.09.2026: "w The Division wkurzało, że było kilka odzywek")
  const recent = {};
  function pick(name, files) {
    const last = recent[name] ??= [], keep = Math.min(MIX.noRepeat, files.length - 1);
    let i;
    do i = Math.floor(Math.random() * files.length); while (keep > 0 && last.slice(-keep).includes(i));
    last.push(i); if (last.length > MIX.noRepeat) last.shift();
    return (stats.file[name] = files[i]);
  }
  // a small random change of pitch and volume at every play (the entry's, else MIX's)
  const jitter = x => 1 + (Math.random() * 2 - 1) * x;

  // the nodes of one sound: source → gain (level) → panner (o.at) → bus. Returns { src, gain, out }
  function build(e, buffer, o, level) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = jitter(e.pitchJitter ?? MIX.pitchJitter);
    const gain = ctx.createGain();
    gain.gain.value = level;
    src.connect(gain);
    let out = gain;
    if (o.at) {
      const p = ctx.createPanner();
      p.panningModel = MIX.panning; p.distanceModel = e.model ?? 'inverse';
      p.refDistance = e.refDistance; p.maxDistance = o.maxDistance ?? e.maxDistance; p.rolloffFactor = e.rolloff;
      p.positionX.value = o.at.x; p.positionY.value = o.at.y; p.positionZ.value = o.at.z;
      gain.connect(p); out = p;
    }
    out.connect(o.ui ? ui : game);
    return { src, gain, out };
  }
  const levelOf = (e, o) => e.volume * jitter(e.volumeJitter ?? MIX.volumeJitter) * (o.gain ?? 1)
    * (o.own ? MIX.own[o.own] : 1) * (e.group ? MIX.group[e.group] : 1);

  // name: a key of SOUNDS (not a loop). o: { at: a world point (spatial; none: not spatial), own: 'shot' | 'step' |
  // 'other' (the player's own sound: MIX.own), gain: times the entry's volume, maxDistance: instead of the entry's,
  // ui: a menu sound (heard in the pause) }. Returns the voice or null.
  function play(name, o = {}) {
    const e = SOUNDS[name];
    stats.requested[name] = (stats.requested[name] ?? 0) + 1;
    if (!e.files.length) { stats.silent++; return null; }
    if (!ctx || ctx.state !== 'running' || (paused && !o.ui)) return null;
    const buffer = buffers[pick(name, e.files)];
    if (!buffer) return null;
    if (voices.length >= MIX.voices) { stop(voices[0]); stats.cut++; }
    const v = { ...build(e, buffer, o, levelOf(e, o)), name };
    voices.push(v); stats.peak = Math.max(stats.peak, voices.length);
    v.src.onended = () => { const i = voices.indexOf(v); if (i >= 0) voices.splice(i, 1); v.out.disconnect(); };
    v.src.start();
    stats.played[name] = (stats.played[name] ?? 0) + 1;
    return v;
  }

  // The loops (the hall's background): one of the entry's files after another (not the one just played), each
  // without the encoder's silence at its ends, the next one fading in over MIX.loopFade while the one before fades
  // out. Scheduled a little ahead on the audio clock, so a slow frame does not leave a gap.
  const beds = {};   // name → { until: audio time the current file ends, cur: its nodes }
  function bed(name) {
    const e = SOUNDS[name], b = beds[name] ??= { until: 0, cur: null }, X = MIX.loopFade, now = ctx.currentTime;
    if (b.cur && now < b.until - X - MIX.loopAhead) return;
    const file = pick(name, e.files), buffer = buffers[file];
    if (!buffer) return;
    const [from, to] = trims[file] ??= trim(buffer);
    const at = Math.max(now + 0.02, b.until - X), level = levelOf(e, {});
    const v = build(e, buffer, {}, level);
    v.src.playbackRate.value = 1;   // a loop keeps its pitch (a change would shift its length)
    v.gain.gain.setValueAtTime(0, at); v.gain.gain.linearRampToValueAtTime(level, at + X);
    v.src.start(at, from, to - from);
    v.src.onended = () => v.out.disconnect();
    if (b.cur) { b.cur.gain.gain.setValueAtTime(b.cur.level, at); b.cur.gain.gain.linearRampToValueAtTime(0, at + X); }
    b.cur = { ...v, level }; b.until = at + (to - from);
    stats.played[name] = (stats.played[name] ?? 0) + 1;
  }

  // every frame: a pad button also counts as the first input; the loops go on
  function update() {
    if (!ctx || ctx.state === 'suspended') {
      const pad = myPad();
      if (pad && pad.buttons.some(b => b.pressed)) unlock();
    }
    if (!ctx || ctx.state !== 'running') return;
    for (const k of LOOPS) bed(k);
  }

  return {
    play, update, stats, trims, loaded,
    // the pause: the game's sounds fade out, and back in after it
    setPaused(v) {
      if (v === paused) return;
      paused = v;
      if (game) game.gain.setTargetAtTime(v ? 0 : 1, ctx.currentTime, MIX.pauseFade / 3);
    },
    get volume() { return volume; },
    // 0..1, in steps of MIX.volumeStep, remembered in the browser
    setVolume(v) {
      volume = Math.round(THREE.MathUtils.clamp(v, 0, 1) / MIX.volumeStep) * MIX.volumeStep;
      volume = Math.round(volume * 100) / 100;
      listener?.setMasterVolume(volume);
      try { localStorage.setItem(KEY, String(volume)); } catch { /* storage blocked */ }
    },
  };
}
