// The heroine: loads the model (GLB) and the Mixamo animations (task 032: the game's own pack, hero/anims.bin, made by
// npm run anims from the Mixamo files, which stay out of the build), scales the model to HERO.height and
// prepares the clips once; every character (task 009: the heroine and the Double) plays them through its own mixer.
// Clip preparation: hip positions are converted from FBX units, the hips' travel across the floor is
// taken out (the character is moved by the physics of task 003) and measured first as the clip's
// natural speed. The dive roll keeps the shape of its travel for the dodge (character.js), the cover entry and the
// vault for cover.js.
import * as THREE from 'three';
import { loadModel } from '../look/loaders.js';
import { asset } from '../asset.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { HERO, HERO_FILES } from '../data/hero.js';
import { COVER } from '../data/cover.js';

const HIPS = 'mixamorigHips';

// Only bone rotations and the hips' position drive the model; anything else in a clip is dropped.
function keepTracks(clip) {
  clip.tracks = clip.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === HIPS + '.position');
  return clip.tracks.find(t => t.name === HIPS + '.position');
}

// hips: the Hips.position track (values already in model units); scale: model units -> metres.
// Returns the natural speed (m/s) and the travel direction, and removes the steady travel on X and Z. What stays on X and Z is the
// sway around the travel line, so the feet keep their places relative to the body; height Y is untouched.
function takeOutTravel(hips, duration, scale) {
  const v = hips.values, n = v.length / 3;
  const dx = v[3 * n - 3] - v[0], dz = v[3 * n - 1] - v[2];
  for (let i = 0; i < n; i++) {
    const k = hips.times[i] / duration;
    v[3 * i] -= dx * k; v[3 * i + 2] -= dz * k;
  }
  return { speed: Math.hypot(dx, dz) * scale / duration, dir: new THREE.Vector3(dx, 0, dz).normalize() };
}

// Walk and run clips do not all start at the same moment of the step. The moment when the left foot
// is furthest ahead of the right one along the travel ("lead", share of the cycle) lets the animator
// keep the steps of blended clips in time.
const LEAD_SAMPLES = 30;
function footLead(hero, action, dir) {
  const { mixer, model } = hero;
  const left = model.getObjectByName('mixamorigLeftFoot'), right = model.getObjectByName('mixamorigRightFoot');
  const l = new THREE.Vector3(), r = new THREE.Vector3();
  let best = -Infinity, lead = 0;
  action.setEffectiveWeight(1);
  for (let i = 0; i < LEAD_SAMPLES; i++) {
    action.time = action.getClip().duration * i / LEAD_SAMPLES;
    mixer.update(0); model.updateMatrixWorld(true);
    const ahead = left.getWorldPosition(l).sub(right.getWorldPosition(r)).dot(dir);
    if (ahead > best) { best = ahead; lead = i / LEAD_SAMPLES; }
  }
  action.setEffectiveWeight(0);
  return lead;
}

// Clips played as a slice [start, end] in a set time, whose travel the physics carries (dive roll, cover
// entries, vault): shape(u) is the share of the slice's travel covered at share u of it (0 at its start,
// 1 at its end), sampled from the hips on Z (these clips move towards +Z, the model's front); length is
// that travel in metres. Afterwards the hips stay above the character on X and Z.
function takeOutSlice(hips, duration, [start, end], scale) {
  const v = hips.values, n = v.length / 3, times = hips.times;
  const z = new THREE.LinearInterpolant(times, v.filter((_, i) => i % 3 === 2), 1, new Float32Array(1));
  const zAt = t => z.evaluate(t)[0];
  const z0 = zAt(start), z1 = zAt(end);
  const shape = u => (zAt(start + u * (end - start)) - z0) / (z1 - z0);
  const dx = v[3 * n - 3] - v[0];
  for (let i = 0; i < n; i++) { v[3 * i] -= dx * times[i] / duration; v[3 * i + 2] = v[2]; }
  return { shape, length: (z1 - z0) * scale, slice: [start, end] };
}

// task 032 (D1): the pack (scripts/pack-anims.mjs: 'ANM1', the header's length, the header, the numbers), read once;
// a clip comes out as the FBX loader gave it (the same tracks and numbers), new each time it is asked for
let pack = null;
async function readPack() {
  // (three's FileLoader, as the other files: in Node too, scripts/node-shims.mjs)
  const buf = await new THREE.FileLoader().setResponseType('arraybuffer').loadAsync(asset(HERO_FILES.dir + HERO_FILES.pack));
  const len = new DataView(buf).getUint32(4, true);
  return { header: JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, len))), nums: new Float32Array(buf, 8 + len) };
}
async function loadClip(name) {
  const { header, nums } = await (pack ??= readPack());
  const c = header.clips[name], part = ([at, n]) => nums.slice(at, at + n);
  const Track = { q: THREE.QuaternionKeyframeTrack, v: THREE.VectorKeyframeTrack };
  return new THREE.AnimationClip(name, c.duration, c.tracks.map(t => new Track[t.k](t.n, part(t.t), part(t.v))));
}

// Loaded once for every character (task 009): the model scaled to HERO.height (a template, not in the scene) and the
// prepared clips, which every character's own mixer plays.
export async function loadHeroAssets() {
  const model = await loadLook(HERO_FILES.model), scale = model.scale.x;   // the clips' travel in metres

  // every file once, even when a clip is listed twice (walk forward is also the first aimed direction)
  const F = HERO_FILES.clips;
  const names = [...new Set([...Object.values(F), ...HERO_FILES.aimWalk, ...HERO_FILES.aimWalkCrouch])];
  const loaded = await Promise.all(names.map(n => loadClip(n)));

  // task 006: reload clips (bone rotations only: they are played over the running animation) and the
  // reactions (hit, deaths: their hips travel is kept, the body falls where the clip falls)
  const reloadFiles = [...Object.values(HERO_FILES.reload), HERO_FILES.throwClip].filter(Boolean), reactionFiles = Object.values(HERO_FILES.reactions);
  const extra = await Promise.all([...reloadFiles, ...reactionFiles].map(n => loadClip(n)));
  const extraClips = {};
  [...reloadFiles, ...reactionFiles].forEach((file, i) => {
    const clip = extra[i]; clip.name = file;
    const hips = keepTracks(clip);
    if (reloadFiles.includes(file)) clip.tracks = clip.tracks.filter(t => t !== hips);
    else for (let j = 0; j < hips.values.length; j++) hips.values[j] *= HERO.fbxUnit;
    extraClips[file] = clip;
  });

  // walk and run clips (the shared step phase); the idles are not, even though their hips drift a hair
  // (up to 1e-5 m/s: audit 004), so this is decided by the list of files, not by the measured speed
  const moving = new Set([F.walk, F.run, F.sprint, F.walkCrouch, ...HERO_FILES.aimWalk, ...HERO_FILES.aimWalkCrouch,
    F.sneakLeft, F.sneakRight]);
  const sliced = { [F.roll]: [HERO.roll.start, HERO.roll.end], [F.coverEnter]: COVER.enterClip, [F.vault]: COVER.vaultClip };
  const clips = {};
  const slices = {};
  names.forEach((file, i) => {
    const clip = loaded[i]; clip.name = file;
    const hips = keepTracks(clip);
    for (let j = 0; j < hips.values.length; j++) hips.values[j] *= HERO.fbxUnit;
    let travel = { speed: 0 };
    if (sliced[file]) slices[file] = takeOutSlice(hips, clip.duration, sliced[file], scale);
    else travel = takeOutTravel(hips, clip.duration, scale);
    const move = moving.has(file);
    clips[file] = { clip, moving: move, speed: move ? travel.speed : 0, dir: travel.dir, duration: clip.duration, lead: 0,
      slice: slices[file]?.slice ?? null };
  });
  const assets = { model, clips, slices, extraClips };

  // the step phase of each walk and run clip, measured once on a body that is not in the scene
  const probe = createHeroBody(null, assets);
  Object.entries(probe.clips).forEach(([file, c]) => { if (c.moving) clips[file].lead = footLead(probe, c.action, c.dir); });
  probe.mixer.stopAllAction();
  return assets;
}

// Task 023: a character's look (data/hero.js CHARACTERS: its file in public/hero/): the model scaled to HERO.height,
// not in the scene. Every look has the same skeleton (Mixamo, the same 65 bones), so it can be worn by a body made
// from another one (wearLook). Task 026: signal stops the download
export async function loadLook(file, signal) {
  const model = (await loadModel(HERO_FILES.dir + file, signal)).scene;
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  model.scale.setScalar(HERO.height / size.y);
  model.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    o.frustumCulled = false;   // the bind-pose bounds do not follow crouching or the roll
  });
  model.updateMatrixWorld(true);
  return model;
}

// Task 023: a body takes another look without being made again (its mixer, IK, rifle and cover keep their bones): its
// bones take the look's proportions (their rest place, turn and size), its skinned meshes are replaced by the look's,
// bound to the body's own bones. The look's geometry and textures are shared (one file for both fighters).
export function wearLook(body, look) {
  const bones = new Map();
  body.model.traverse(o => { if (!o.isMesh) bones.set(o.name, o); });
  body.model.scale.copy(look.scale);
  look.traverse(n => {
    const b = n !== look && !n.isMesh && bones.get(n.name);
    if (b) { b.position.copy(n.position); b.quaternion.copy(n.quaternion); b.scale.copy(n.scale); }
  });
  const old = [];
  body.model.traverse(o => { if (o.isSkinnedMesh) old.push(o); });
  old.forEach(o => { o.parent.remove(o); o.skeleton.dispose(); });   // its bones' texture on the GPU goes with it
  look.traverse(m => {
    if (!m.isSkinnedMesh) return;
    const mesh = new THREE.SkinnedMesh(m.geometry, m.material);
    mesh.name = m.name; mesh.position.copy(m.position); mesh.quaternion.copy(m.quaternion); mesh.scale.copy(m.scale);
    Object.assign(mesh, { castShadow: m.castShadow, receiveShadow: m.receiveShadow, frustumCulled: m.frustumCulled });
    (bones.get(m.parent.name) ?? body.model).add(mesh);
    mesh.bind(new THREE.Skeleton(m.skeleton.bones.map(b => bones.get(b.name)), m.skeleton.boneInverses), m.bindMatrix);
  });
  body.mixer.update(0);   // the bones the clips move go back to the pose
  body.model.updateMatrixWorld(true);
}

// Task 023: a look no longer worn by anyone: its geometry, materials and textures freed on the GPU
export function disposeLook(look) {
  look.traverse(o => {
    if (!o.isMesh) return;
    o.geometry.dispose();
    for (const m of [o.material].flat()) {
      for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
      m.dispose();
    }
  });
}

// One character's body (the heroine, the Double): its own copy of the model and its own mixer playing the shared
// clips. The reactions (hit, deaths) are clips too, their time set by the animator (`manual`).
// scene: where the body stands (null: not in the scene)
export function createHeroBody(scene, assets) {
  const model = cloneSkinned(assets.model);
  // root: stands at the character's feet and turns with the body; the model faces +Z inside it
  const root = new THREE.Group(); root.add(model); scene?.add(root);
  const mixer = new THREE.AnimationMixer(model);
  const clips = {};
  Object.entries(assets.clips).forEach(([file, c]) => {
    const action = mixer.clipAction(c.clip);
    action.setEffectiveWeight(0).play();
    clips[file] = { action, moving: c.moving, speed: c.speed, dir: c.dir, duration: c.duration, lead: c.lead, slice: c.slice };
  });
  Object.values(HERO_FILES.reactions).forEach(file => {
    const clip = assets.extraClips[file], action = mixer.clipAction(clip);
    action.setEffectiveWeight(0).play();
    clips[file] = { action, moving: false, speed: 0, duration: clip.duration, lead: 0, slice: null, manual: true };
  });
  // slices: { file: { shape, length, slice } }; rollShape kept for the dodge (character.js)
  const F = HERO_FILES.clips;
  return { root, model, mixer, clips, slices: assets.slices, rollShape: assets.slices[F.roll].shape, extraClips: assets.extraClips };
}
