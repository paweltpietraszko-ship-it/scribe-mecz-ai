// Materials of the machine: engraved face with the writing head, glowing lines, dark metal.
// Shader patch identical to reference/fragment_areny.html.
import * as THREE from 'three';
import { GLOW, MATERIALS, DEFAULT_MATERIAL, DARK } from '../data/arena.js';

// Shared state of the script light
export const glowCol = new THREE.Color(GLOW.colors[GLOW.default]);
export const U = {
  uWave: { value: 0 }, uBase: { value: GLOW.base }, uHead: { value: GLOW.head },
  uSeal: { value: GLOW.seal }, uGlow: { value: new THREE.Vector3() },
};
const syncGlow = () => U.uGlow.value.set(glowCol.r, glowCol.g, glowCol.b);
syncGlow();

// number -> GLSL float literal
const glsl = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));

// task 029: the lists the look's changes go through hold their surfaces and lights weakly: an arena keeps its own, and
// one gone (a PvP match's engine on the server, many in one process) is not kept by them
function weakList() {
  let refs = [];
  return {
    push(x) { refs.push(new WeakRef(x)); if (refs.length % 256 === 0) refs = refs.filter(r => r.deref()); },
    forEach(fn) { for (const r of refs) { const x = r.deref(); if (x) fn(x); } },
  };
}
const faceMats = weakList();
let matKey = DEFAULT_MATERIAL;

// tx: a surface from faceTex/discTex (task 024: cr colour + roughness, n normal x/y, o order of writing, ms mask + seal;
// look/engrave.js); off: where on the writing cycle this surface starts;
// flash: shared {value} uniform lit during a warning; speed: writing speed factor; baseGain: how much brighter than
// GLOW.base the script glows between the writing head's passes (task 011: the arena elements, which have no light)
export function faceMaterial(tx, off, flash, speed, ns, baseGain = 1) {
  // the roughness map reads G: the same texture as the colour (cr)
  const m = new THREE.MeshPhysicalMaterial({ map: tx.cr, normalMap: tx.n, normalScale: new THREE.Vector2(ns, ns), roughnessMap: tx.cr, ...MATERIALS[matKey] });
  m.defines = { USE_UV: '' };
  m.userData.baseGain = { value: baseGain };   // task 012: SCRIBE makes it pulse (the camp warning)
  m.userData.surface = tx;                     // task 024: baked when the scene asks (look/textures.js bakeAll)
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, U, { tOrder: { value: tx.o }, tMask: { value: tx.ms }, uMaskUv: { value: tx.msUv }, uOff: { value: off }, uFlash: flash, uSpeed: { value: speed }, uBaseGain: m.userData.baseGain });
    // task 024: the colour is one channel (R, already linear); the normal map holds x and y, z is made again (a unit
    // vector facing out of the surface)
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tOrder,tMask;uniform vec4 uMaskUv;uniform float uWave,uBase,uBaseGain,uHead,uFlash,uSeal,uOff,uSpeed;uniform vec3 uGlow;`)
      .replace('#include <map_fragment>', `diffuseColor.rgb*=texture2D(map,vMapUv).r;`)
      .replace('#include <normal_fragment_maps>', `vec3 mapN;mapN.xy=texture2D(normalMap,vNormalMapUv).xy*2.0-1.0;
mapN.z=sqrt(max(0.0,1.0-dot(mapN.xy,mapN.xy)));mapN.xy*=normalScale;normal=normalize(tbn*mapN);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{float ord=texture2D(tOrder,vUv).r;vec2 ms=texture2D(tMask,vUv*uMaskUv.xy+uMaskUv.zw).rg;float mask=ms.r;float d=fract(uWave*uSpeed+uOff-ord);
 float head=smoothstep(0.0,${glsl(GLOW.headEdge)},d)*exp(-d*${glsl(GLOW.headFalloff)});
 totalEmissiveRadiance+=uGlow*(mask*(uBase*uBaseGain+uHead*head+uFlash)+ms.g*uSeal);}`);
  };
  faceMats.push(m);
  return m;
}

// task 020: others that follow the panels' material (the stone of the floor)
const materialListeners = [];
export function onMaterial(fn) { materialListeners.push(fn); }

export function setMaterial(key) {
  matKey = key; const p = MATERIALS[key];
  faceMats.forEach(m => { m.color.setHex(p.color); m.metalness = p.metalness; m.roughness = p.roughness; m.clearcoat = p.clearcoat; m.clearcoatRoughness = p.clearcoatRoughness; });
  materialListeners.forEach(fn => fn(key));
}

// Unlit glowing line in the script colour; k = brightness (above 1 feeds the bloom)
const glowMats = weakList();
export function hdr(k) {
  const m = new THREE.MeshBasicMaterial({ color: glowCol.clone().multiplyScalar(k) });
  m.userData.k = k; glowMats.push(m);
  return m;
}

// Lights that take the script colour
const glowLights = weakList();
export function glowLight(light) { glowLights.push(light); return light; }

// task 012 (U23): the arena's flash. The script light of every surface moves towards `color` by share k (0: off) and
// its resting glow grows `boost` times at the flash's height (the script is dark most of the time: a change of colour
// alone was not seen, Paweł 29.09.2026)
const flashCol = new THREE.Color();
export function flashGlow(k, color, boost = 0) {
  flashCol.copy(glowCol).lerp(color, Math.min(1, k));
  U.uGlow.value.set(flashCol.r, flashCol.g, flashCol.b);
  U.uBase.value = GLOW.base * (1 + k * boost);
}

export function setGlowColor(key) {
  glowCol.setHex(GLOW.colors[key]); syncGlow();
  glowMats.forEach(m => m.color.copy(glowCol).multiplyScalar(m.userData.k));
  glowLights.forEach(l => l.color.copy(glowCol));
}

export const darkMat = new THREE.MeshStandardMaterial(DARK);
