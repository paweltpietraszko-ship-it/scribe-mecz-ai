// The hall's floor (task 020): one flat disc under the arena section (collisions as before: the physics has its own
// floor), drawn as polished stone of large irregular plates with arcs let into it round the turntable (STONE). The
// plates are cells round points from STONE.seed, the joints and the arcs are worked out in the material's shader, so
// nothing is downloaded. The stone follows the panels' material (STONE.pair). STONE.use 'dzis' (or ?floor=dzis): the
// dark floor of FLOOR, as up to task 019.
// (light grey stone with the dark ceramic, dark slate with the bronze and the bone)
import * as THREE from 'three';
import { loadPicture } from '../look/loaders.js';
import { FLOOR, STONE as S, ARENA_SECTION, TURNTABLE, DEFAULT_MATERIAL } from '../data/arena.js';

// the floor at the start: ?floor=<choice> (or ?floor=kamien), else STONE.use 'dzis' or STONE.choice
const asked = new URLSearchParams(globalThis.location?.search ?? '').get('floor');
const start = S.choices.includes(asked) ? asked : asked === 'kamien' ? S.choice : S.use === 'dzis' ? 'dzis' : S.choice;
const f = v => v.toFixed(4);
const T = S.texture;

// GLSL: the plate under a point (the distance to its edge in metres and two hashes of its cell), the arcs' distance
const STONE_GLSL = `
uniform vec2 uStoneCenter; varying vec3 vStoneW;
float stoneJoint, stoneTone, stoneOpal, stoneRough = 1.0; vec3 stoneNw = vec3(0, 1, 0);
#ifdef STONE_TEX
uniform sampler2D tStoneDetail, tStoneNor;
#endif
vec2 stoneHash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p + ${f(S.seed % 997)}) * 43758.5453);
}
float stoneNoise(vec2 p) {
  vec2 i = floor(p), u = fract(p); u = u * u * (3.0 - 2.0 * u);
  return mix(mix(stoneHash(i).x, stoneHash(i + vec2(1, 0)).x, u.x), mix(stoneHash(i + vec2(0, 1)).x, stoneHash(i + 1.0).x, u.x), u.y);
}
// x: the distance to the cell's edge (cell units), yz: the cell's hashes
vec3 stoneCell(vec2 x) {
  vec2 n = floor(x), q = fract(x), mg = vec2(0), mr = vec2(0); float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(i, j), r = g + 0.5 + (stoneHash(n + g) - 0.5) * ${f(S.jitter)} - q; float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(i, j), r = g + 0.5 + (stoneHash(n + g) - 0.5) * ${f(S.jitter)} - q;
    if (dot(mr - r, mr - r) > 1e-5) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return vec3(md, stoneHash(n + mg + 17.0));
}
void stoneSample() {
  vec2 p = vStoneW.xz, c = p - uStoneCenter;
  float r = length(c), a = atan(c.y, c.x) + 3.14159265;
  vec3 cell = stoneCell(p / ${f(S.plate)});
  float edge = cell.x * ${f(S.plate)}, ring = 0.0;
  // the arcs: grooves along circles, some pieces left out; a plate cut by an arc is two plates
  float radii[${S.arcs.radii.length}] = float[](${S.arcs.radii.map(f).join(', ')});
  for (int k = 0; k < ${S.arcs.radii.length}; k++) {
    if (r > radii[k]) ring += 1.0;
    float seg = floor(a / 6.2831853 * ${f(S.arcs.segments)});
    if (stoneHash(vec2(seg, float(k) * 7.0)).x < ${f(S.arcs.gap)}) continue;
    edge = min(edge, abs(r - radii[k]) - ${f((S.arcs.width - S.joint) / 2)});
  }
  vec2 id = cell.yz + ring * 0.37;
  // the joint, kept at least a pixel wide (no shimmer far off) and fainter as much as it was widened
  float w = ${f(S.joint / 2)}, aa = fwidth(edge), wide = max(w, aa);
  stoneJoint = (1.0 - smoothstep(wide - aa * 0.5, wide + aa * 0.5, edge)) * (w / wide);
  float grain = stoneNoise(p / ${f(S.grain.size)}) * 0.6 + stoneNoise(p / ${f(S.grain.size * 0.27)}) * 0.4;
  stoneTone = 1.0 + (fract(id.x * 13.7) - 0.5) * 2.0 * ${f(S.tone)} + (grain - 0.5) * 2.0 * ${f(S.grain.amount)};
  // the plates' edges worn darker (dirt in the joints)
  stoneTone *= 1.0 - ${f(S.wear.dark)} * (1.0 - smoothstep(0.0, ${f(S.wear.width)}, edge));
  // thin veins: where a slow noise crosses its middle (a fine line wandering over the plates)
  float v = abs(stoneNoise(p / ${f(S.veins.size)} + id * 9.0) - 0.5), vw = max(${f(S.veins.thin)}, fwidth(v));
  stoneTone *= 1.0 - ${f(S.veins.dark)} * (1.0 - smoothstep(0.0, vw, v)) * (${f(S.veins.thin)} / vw);
  stoneOpal = step(fract(id.y * 31.3), ${f(S.opal.on ? S.opal.share : 0)});
#ifdef STONE_TEX
  // the photo texture, turned and moved by the plate (its seams fall under the joints)
  float th = fract(id.x * 7.31) * 6.2831853; mat2 R = mat2(cos(th), sin(th), -sin(th), cos(th));
  vec2 q = vec2(p.x, -p.y) / ${f(T.size)}, uv = R * q + id * 11.0;
  vec2 gx = R * dFdx(q), gy = R * dFdy(q);
  vec3 dt = textureGrad(tStoneDetail, uv, gx, gy).rgb;
  stoneTone *= 1.0 + (dt.r - 0.5) * 2.0 * ${f(T.tone)};
  stoneRough = 1.0 + (dt.g - 0.5) * 2.0 * ${f(T.rough)};
  // the relief: the texture's tangent frame (u along +X, v along -Z of the world) turned back by the plate's turn
  vec3 nt = textureGrad(tStoneNor, uv, gx, gy).xyz * 2.0 - 1.0;
  nt.xy = transpose(R) * nt.xy * ${f(T.bump)};
  stoneNw = normalize(vec3(nt.x, nt.z, -nt.y));
#endif
}`;

export function buildFloor(scene) {
  const F = ARENA_SECTION.floor;
  const geo = new THREE.CircleGeometry(F.radius, F.segments);
  // both made once; the old one is compiled the first time it is picked
  const old = new THREE.MeshPhysicalMaterial({ color: FLOOR.color, roughness: FLOOR.roughness, metalness: FLOOR.metalness, clearcoat: FLOOR.clearcoat, clearcoatRoughness: FLOOR.clearcoatRoughness });
  let mat, pictures = Promise.resolve();
  {
    const O = S.opal;
    // the photo texture's two files (data in them, not colours: no sRGB decoding). Task 024: KTX2 files (compressed on
    // the card), each in its uniform when it has come (pictures.ready: both in)
    const pending = [];
    const load = file => {
      const u = { value: null };
      pending.push(loadPicture(file).then(t => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
        u.value = t;
      }));
      return u;
    };
    const detail = T.name && load(`floor/${T.name}_detail.ktx2`), relief = T.name && load(`floor/${T.name}_nor.ktx2`);
    pictures = Promise.all(pending);
    mat = new THREE.MeshPhysicalMaterial({ iridescence: O.on ? O.strength : 0, iridescenceIOR: O.ior, iridescenceThicknessRange: O.thickness });
    mat.onBeforeCompile = s => {
      s.uniforms.uStoneCenter = { value: new THREE.Vector2(...TURNTABLE.center) };
      if (T.name) Object.assign(s.uniforms, { tStoneDetail: detail, tStoneNor: relief });
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vStoneW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStoneW = (modelMatrix * vec4(position, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + STONE_GLSL)
        .replace('#include <color_fragment>', `#include <color_fragment>
stoneSample(); diffuseColor.rgb *= stoneTone * mix(1.0, ${f(S.jointDark)}, stoneJoint);
{ // an opal plate: its colour runs through the rainbow with the angle the floor is seen at (only seen where it is lit)
  float ndv = dot(normalize(vViewPosition), normalize((viewMatrix * vec4(0, 1, 0, 0)).xyz));
  vec3 rainbow = 0.5 + 0.5 * cos(6.2831853 * (vec3(0.0, 0.33, 0.67) + ndv * ${f(S.opal.bands)} + stoneTone));
  diffuseColor.rgb *= mix(vec3(1.0), rainbow * 1.6, ${f(S.opal.tint)} * stoneOpal * (1.0 - stoneJoint));
}`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(clamp(roughnessFactor * stoneRough, 0.04, 1.0), 1.0, stoneJoint);`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
normal = normalize((viewMatrix * vec4(stoneNw, 0.0)).xyz);`)
        .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_IRIDESCENCE
material.iridescence *= stoneOpal * (1.0 - stoneJoint);
#endif`);
    };
    if (T.name) mat.defines = { STONE_TEX: '' };
    mat.customProgramCacheKey = () => 'stone-floor';
  }
  const floor = new THREE.Mesh(geo, start === 'dzis' ? old : mat);
  floor.rotation.x = -Math.PI / 2; floor.position.set(TURNTABLE.center[0], 0, TURNTABLE.center[1]); floor.receiveShadow = true;
  scene.add(floor);

  // choice: STONE.choices ('pair': the stone paired with the panels' material); panels: the MATERIALS key in use
  let choice = start, panels = DEFAULT_MATERIAL;
  function apply() {
    floor.material = choice === 'dzis' ? old : mat;
    if (choice === 'dzis') return;
    const k = S.kinds[choice === 'pair' ? S.pair[panels] : choice];
    mat.color.setHex(k.color); mat.roughness = k.roughness; mat.metalness = k.metalness;
    mat.clearcoat = k.clearcoat; mat.clearcoatRoughness = k.clearcoatRoughness;
  }
  apply();
  return {
    mesh: floor,
    pictures,   // task 024: the photo texture's files loaded
    get choice() { return choice; },
    setChoice(k) { choice = k; apply(); },
    setMaterial(key) { panels = key; apply(); },
  };
}
