// The Double's look (task 009): the heroine's model with the machine's script written on the suit, glowing faintly in
// the opponent's colour of the HUD (the pair of the script light chosen in the game: data/hud.js). The script is laid
// on the body's rest pose from three sides (so it moves with the body and has no seams of the texture's layout) and
// shows only where the suit's texture is dark (not on the hands) and not on the face. A writing head runs up the body
// now and then, as on the arena's panels. (The rim of light of task 019 is in look/rim.js since task 023.)
import * as THREE from 'three';
import { DOUBLE as D, HERO } from '../data/hero.js';
import { HUD } from '../data/hud.js';
import { GLOW } from '../data/arena.js';
import { ALPHA, WORDS, RNG, drawGlyph } from './script.js';

const GLYPH_SHARE = 0.62;   // a sign's height as a share of the row

// rows of the machine's words, white on black, tiling on both sides
function scriptTexture() {
  const n = D.tex, c = document.createElement('canvas'); c.width = c.height = n;
  const g = c.getContext('2d'), r = RNG(D.seed), row = n / D.rows, size = row * GLYPH_SHARE;
  g.fillStyle = '#000'; g.fillRect(0, 0, n, n);
  g.strokeStyle = g.fillStyle = '#fff';
  for (let y = 0; y < D.rows; y++) {
    let x = r() * size;
    while (x < n - size) {
      const word = WORDS[Math.floor(r() * WORDS.length)];
      for (const i of word) { drawGlyph(g, ALPHA[i], x, y * row + (row - size) / 2, size, size * D.stroke); x += size * 0.62; }
      x += size * (0.8 + r() * 1.6);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

const uColor = { value: new THREE.Color() }, uTime = { value: 0 };
// the writing head's clock (s); the game loop moves it, ?freeze keeps it
export function tickDouble(dt) { uTime.value += dt; }
// the script light chosen (GLOW.colors key): the Double's script takes the opponent's colour paired with it
export function setDoubleLight(key) {
  const [r, g, b] = (HUD.colors[key] || HUD.colors.ice).foe;
  uColor.value.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace).multiplyScalar(D.glow);
}
setDoubleLight(GLOW.default);

// body: the Double's body (hero.js createHeroBody): its meshes get their own copy of the material with the script
// (the script's canvas is made once: a new look of the Double reuses it, task 023)
let tex = null;
export function dressDouble(body) {
  tex ??= scriptTexture();
  body.model.traverse(o => {
    if (!o.isMesh) return;
    // the rest pose's units -> metres: the model is HERO.height tall
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox, toMetres = HERO.height / (bb.max.y - bb.min.y);
    const tile = D.rows * D.glyph / GLYPH_SHARE;   // metres the texture covers
    // the middle of the head in the rest pose, metres from the model's feet (under the top of the bounds)
    const head = new THREE.Vector3((bb.min.x + bb.max.x) / 2 * toMetres, HERO.height - D.face.below, (bb.min.z + bb.max.z) / 2 * toMetres);
    const f = v => v.toFixed(3);
    o.material = o.material.clone(); o.material.userData.own = true;   // this body's own copy (look/rim.js adds to it)
    o.material.onBeforeCompile = s => {
      Object.assign(s.uniforms, { tScript: { value: tex }, uScriptColor: uColor, uScriptTime: uTime, uToMetres: { value: toMetres }, uFloor: { value: bb.min.y } });
      s.vertexShader = s.vertexShader.replace('#include <common>', `#include <common>
uniform float uToMetres, uFloor; varying vec3 vScriptP; varying vec3 vScriptN;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
vScriptP = vec3(position.x, position.y - uFloor, position.z) * uToMetres; vScriptN = normal;`);
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
uniform sampler2D tScript; uniform vec3 uScriptColor; uniform float uScriptTime; varying vec3 vScriptP; varying vec3 vScriptN;`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{vec3 w=pow(abs(normalize(vScriptN)),vec3(4.0)); w/=(w.x+w.y+w.z); vec3 p=vScriptP/${f(tile)};
 float g=texture2D(tScript,p.zy).r*w.x+texture2D(tScript,p.xz).r*w.y+texture2D(tScript,p.xy).r*w.z;
 float suit=smoothstep(${f(D.suit[0])},${f(D.suit[1])},dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722)));
 suit*=smoothstep(${f(D.face.radius)},${f(D.face.radius + 0.05)},distance(vScriptP,vec3(${f(head.x)},${f(head.y)},${f(head.z)})));
 float band=fract(uScriptTime/${f(D.head.every)})*${f(HERO.height + 2 * D.head.width)}-${f(D.head.width)};
 float writing=1.0+${f(D.head.glow / D.glow)}*exp(-pow((vScriptP.y-band)/${f(D.head.width / 2)},2.0));
 totalEmissiveRadiance+=uScriptColor*g*suit*writing;}`);
    };
    o.material.customProgramCacheKey = () => 'double-script';
  });
}
