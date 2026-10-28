// The rim of light (task 019, moved out of look/double.js in task 023, U40): a thin line of light on the silhouette of
// the one who is the opponent of whoever looks, in the opponent's colour of the HUD (the pair of the script light,
// data/hud.js). Never on one's own figure (DECISIONS: the rim only on the opponent). Who the opponent is for this view
// is decided in one place, opponentsOf(): today the player looks (in ?botvbot the first bot's side), so the rim is on
// the other fighter; in PvP each side's screen marks the other one.
import * as THREE from 'three';
import { RIM } from '../data/hero.js';
import { HUD } from '../data/hud.js';
import { GLOW } from '../data/arena.js';

const uRim = { value: new THREE.Color() };
// the script light chosen (GLOW.colors key): the rim takes the opponent's colour paired with it
export function setRimLight(key) {
  const [r, g, b] = (HUD.colors[key] || HUD.colors.ice).foe;
  uRim.value.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).multiplyScalar(RIM.strength);
}
setRimLight(GLOW.default);

// viewer: the fighter whose eyes the screen shows; fighters: all of them. The others are its opponents.
export const opponentsOf = (viewer, fighters) => fighters.filter(f => f !== viewer);

// body: a fighter's body (player/hero.js createHeroBody): its meshes get the rim in their own copy of the material (a
// copy made earlier for this body, e.g. the Double's script, is kept and the rim added to it)
export function addRim(body) {
  body.model.traverse(o => {
    if (!o.isMesh || o.material.userData.rim) return;
    if (!o.material.userData.own) { o.material = o.material.clone(); o.material.userData.own = true; }
    const m = o.material, before = m.onBeforeCompile, key = m.customProgramCacheKey;
    m.userData.rim = true;
    m.onBeforeCompile = (s, r) => {
      before?.call(m, s, r);
      s.uniforms.uRimColor = uRim;
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uRimColor;`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance+=uRimColor*pow(1.0-clamp(dot(nonPerturbedNormal,normalize(vViewPosition)),0.0,1.0),${RIM.power.toFixed(3)});`);
    };
    const base = key.call(m);
    m.customProgramCacheKey = () => base + '-rim';
  });
}

// marks the opponents of the viewer (each body once)
export function rimOpponents(viewer, fighters) { opponentsOf(viewer, fighters).forEach(f => addRim(f.body)); }
