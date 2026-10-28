// The LED screen round the arena (task 013), recreated from reference/ekran_areny.html ("LED ring"): a ring seen from
// the inside, one shape with one shader program. Round LED pixels up close, blended far away (no shimmer); columns of
// the machine's script scroll at their own pace, some go dark and write again; a writing head runs round the ring; six
// walls (landmarks) when SCREEN.sectors is on; an alarm is a wave of light running round from one or more places. Not
// in the fog. The glyph atlas is baked once at the start. Colour: the script light the player chose (glowCol).
// The screen never shows the opponent or anything of the fight (filar 2): its only input from the game is an alarm's
// place, and only for SCRIBE's public events (the camping penalty, the final phase).
// Task 021: the ring shows the fresco of the Progenitors (look/fresco.js) instead of the script; FRESCO.use 'dzis' or
// ?screen=dzis, or a package that did not load: the script as before. The alarm and the spill stay as they were.
import * as THREE from 'three';
import { SCREEN as S } from '../data/screen.js';
import { RNG, ALPHA, WORDS, pick, drawGlyph } from './script.js';
import { glowCol, glowLight } from './materials.js';
import { FRESCO } from '../data/fresco.js';
import { GLOW } from '../data/arena.js';
import { frescoMaterial, rawRGB } from './fresco.js';

const asked = new URLSearchParams(globalThis.location?.search ?? '').get('screen');
// the fresco is wanted (main.js loads its package only then)
export const useFresco = (asked === 'dzis' || asked === 'fresk' ? asked : FRESCO.use) === 'fresk';

// 16 strips of machine script, white on black, seamless vertically
function bakeAtlas() {
  const A = S.atlas, c = document.createElement('canvas'); c.width = A.width; c.height = A.height;
  const x = c.getContext('2d'), r = RNG(A.seed), G = A.glyph, stripW = A.width / A.strips;
  x.fillStyle = '#000'; x.fillRect(0, 0, A.width, A.height); x.strokeStyle = x.fillStyle = '#fff';
  for (let s = 0; s < A.strips; s++) {
    let y = 0;
    while (y < A.height - G) {
      const word = r() < 0.55 ? WORDS[Math.floor(r() * WORDS.length)] : Array.from({ length: 1 + Math.floor(r() * 4) }, () => pick(r));
      for (const gi of word) { if (y > A.height - G) break; drawGlyph(x, ALPHA[gi], s * stripW + 12, y, G * 0.9, A.line); y += G * 1.1; }
      y += G * (0.4 + r() * 2.2);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
  return t;
}

const glsl = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));

// task 024 (K4): the screen's light from the sky, in the scene before anything is compiled (a light added later is
// another number of lights: every shader again); null when the data has none
export function screenSkyLight(scene) {
  if (!(S.spill.sky > 0)) return null;
  const sky = glowLight(new THREE.HemisphereLight(glowCol, 0x000000, 0)); scene.add(sky);
  return sky;
}

// scene: the arena's scene; frozen: ?freeze (the screen stands still); fresco: the loaded package (look/fresco.js) or null;
// sky: its light from the sky made already (screenSkyLight)
export function createScreen(scene, { frozen = false, fresco = null, sky: skyLight = null } = {}) {
  const [cx, cz] = S.center, A = S.alarm, L = S.look;
  const U = { tGlyph: { value: null }, uTime: { value: 0 }, uMode: { value: S.sectors ? 1 : 0 }, uCol: { value: new THREE.Vector3() },
    uBright: { value: 1 }, uAlarm: { value: -1 }, uAlarmAt: { value: new THREE.Vector3() }, uAlarmN: { value: 0 }, uGlitch: { value: new THREE.Vector3() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, fog: false,
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tGlyph;uniform float uTime,uMode,uBright,uAlarm,uAlarmN;uniform vec3 uCol,uAlarmAt,uGlitch;varying vec2 vUv;
  float h1(float n){return fract(sin(n*127.1)*43758.5453);}
  float wave(float at,float x){float d=abs(fract(x-at+.5)-.5);return exp(-pow((d-uAlarm*.5)*14.,2.))*(1.-uAlarm);}
  void main(){
    vec2 res=vec2(${glsl(S.pixels[0])},${glsl(S.pixels[1])});vec2 g=vUv*res;vec2 cell=floor(g);vec2 lc=fract(g)-.5;
    float dotm=smoothstep(.5,.28,length(lc));float aa=clamp(max(fwidth(g.x),fwidth(g.y))*1.2-.3,0.,1.);dotm=mix(dotm,.55,aa);
    vec2 c=(cell+.5)/res;
    float COLS=${glsl(S.columns)};float col=floor(c.x*COLS);float within=fract(c.x*COLS);
    float sp=.012+.03*h1(col);float dir=h1(col+7.)<.5?-1.:1.;
    float sector=floor(c.x*6.);float seam=smoothstep(.006,0.,abs(fract(c.x*6.)-.0))+smoothstep(.994,1.,fract(c.x*6.));
    float scale=1.;float dens=1.;
    if(uMode>.5&&uMode<1.5){scale=1.+sector*.35;dens=.55+.09*sector;}
    vec2 au=vec2((mod(col,16.)+within)/16.,c.y*.35/scale+uTime*sp*dir+h1(col+3.));
    // a glitch now and then (drawn once a frame in update): a thin band of the screen slides sideways and flickers
    float tg=uGlitch.z,gon=uGlitch.x*step(abs(c.y-uGlitch.y),${glsl(L.glitchHeight)});
    if(gon>0.)au.x+=${glsl(L.glitchShift)}*(h1(floor(c.y*80.)+tg)-.5);
    // single glyphs flare up and change: a glyph cell (column, row in the atlas) picked at random, for a while
    float cellId=col*13.1+floor(au.y*33.),flare=step(${glsl(1 - L.flare)},h1(cellId+floor(uTime*${glsl(L.flareRate)})*7.));
    au.y+=flare*h1(col+floor(uTime*${glsl(L.flareRate)}))*.5;
    float glyph=texture2D(tGlyph,au).r;
    glyph*=step(h1(col+floor(uTime*.05+h1(col)*9.)),dens);
    // the writing head runs round the ring (+u) and leaves a bright trail behind it
    float s=fract(c.x-uTime*.018)-.5;
    float head=s<0.?exp(s*${glsl(L.trail)}):exp(-pow(s*${glsl(L.headWidth)},2.));
    float band=${glsl(L.glyph)}+${glsl(L.head)}*head;
    vec3 col3=uCol*glyph*band*(1.+flare*${glsl(L.flareGain)})+vec3(1.)*glyph*flare*${glsl(L.flareWhite)};
    col3+=uCol*${glsl(L.base)};
    if(gon>0.)col3+=uCol*${glsl(L.glitchGain)}*h1(floor(c.x*400.)+tg);
    if(uMode>.5&&uMode<1.5){
      float big=smoothstep(.02,.0,abs(length((vec2(fract(c.x*6.),c.y)-.5)*vec2(8.,1.))-.33-.02*sector));
      col3+=uCol*big*.55;col3+=uCol*seam*1.4;
      col3*=.75+.5*h1(sector+1.);
    }
    if(uAlarm>=0.){
      float w=wave(uAlarmAt.x,c.x);
      if(uAlarmN>1.5)w=max(w,wave(uAlarmAt.y,c.x));
      if(uAlarmN>2.5)w=max(w,wave(uAlarmAt.z,c.x));
      col3+=vec3(${A.color.map(glsl).join(',')})*w*2.2+uCol*w;
    }
    if(uMode>2.5)col3=vec3(0.);
    col3*=dotm*uBright;
    float edge=smoothstep(0.,.015,vUv.y)*smoothstep(1.,.985,vUv.y);
    gl_FragColor=vec4(col3*edge,1.);
  }`,
  });

  // task 021: the fresco's material on the same ring, with the same alarm (its wave and colour as in the script above)
  const ALARM = `float wave(float at,float x){float d=abs(fract(x-at+.5)-.5);return exp(-pow((d-uAlarm*.5)*14.,2.))*(1.-uAlarm);}
vec3 alarm(float x){if(uAlarm<0.)return vec3(0.);float w=wave(uAlarmAt.x,x);
  if(uAlarmN>1.5)w=max(w,wave(uAlarmAt.y,x));if(uAlarmN>2.5)w=max(w,wave(uAlarmAt.z,x));
  return vec3(${A.color.map(glsl).join(',')})*w*2.2+uCol*w;}`;
  const fresk = useFresco && fresco ? frescoMaterial(fresco, U, ALARM) : null;
  if (!fresk) U.tGlyph.value = bakeAtlas();   // the script's atlas only when the script is shown
  let frescoColor = FRESCO.colorDefault, light = GLOW.default;
  function applyPalette() {
    if (!fresk) return;
    const p = FRESCO.palettes[frescoColor === 'auto' ? FRESCO.auto[light] : frescoColor];
    U.uShadow.value.copy(rawRGB(p.shadow)); U.uLight.value.copy(rawRGB(p.light)); U.uVeil.value.copy(rawRGB(p.veil));
  }
  applyPalette();

  const ring = new THREE.Group(); ring.position.set(cx, 0, cz); scene.add(ring);
  const screen = new THREE.Mesh(new THREE.CylinderGeometry(S.radius, S.radius, S.height, S.segments, 1, true), fresk ?? mat);
  screen.position.y = S.y0 + S.height / 2; ring.add(screen);
  // the frames, pillars and wall are almost black and far away: unlit colour (the lit material cost ~3 fps on the Intel UHD,
  // task 013 report), the lights of the arena do not reach them anyway
  const B = S.bezel, bezelMat = new THREE.MeshBasicMaterial({ color: B.color, side: THREE.DoubleSide });
  const bezelGeo = new THREE.CylinderGeometry(S.radius + B.out, S.radius + B.out, B.height, S.segments, 1, true);
  [S.y0 - B.height / 2, S.y0 + S.height + B.height / 2].forEach(y => { const b = new THREE.Mesh(bezelGeo, bezelMat); b.position.y = y; ring.add(b); });
  const W = S.wall, wall = new THREE.Mesh(new THREE.CylinderGeometry(S.radius + W.out, S.radius + W.out, W.height, 128, 1, true),
    new THREE.MeshBasicMaterial({ color: W.color, side: THREE.BackSide, fog: false }));
  wall.position.y = W.y; ring.add(wall);
  // the pillars as one mesh (one draw call)
  const P = S.pillars, ph = S.y0 + S.height + P.above;
  const pillars = new THREE.InstancedMesh(new THREE.BoxGeometry(P.width, ph, P.depth), bezelMat, P.count), m = new THREE.Matrix4(), q = new THREE.Quaternion();
  for (let k = 0; k < P.count; k++) {
    const a = k / P.count * Math.PI * 2;
    m.compose(new THREE.Vector3(Math.cos(a) * (S.radius + P.out), ph / 2, Math.sin(a) * (S.radius + P.out)), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a), new THREE.Vector3(1, 1, 1));
    pillars.setMatrixAt(k, m);
  }
  ring.add(pillars);

  // the spill: a soft light in the screen's colour from the sky and round the arena
  // (each light costs in every lit pixel of the arena on the Intel UHD: only as many as the data asks for, task 013 report)
  // (task 024 K4: `skyLight` made before the welcome screen's shaders: screenSkyLight, so the lights' number stays)
  const SP = S.spill, sky = SP.sky > 0 ? skyLight ?? screenSkyLight(scene) : null;
  const points = Array.from({ length: SP.points }, (_, k) => {
    const a = k * Math.PI * 2 / SP.points + SP.pointAngle, l = glowLight(new THREE.PointLight(glowCol, 0, SP.pointDistance, SP.pointDecay));
    l.position.set(cx + Math.cos(a) * SP.pointRadius, SP.pointY, cz + Math.sin(a) * SP.pointRadius); scene.add(l);
    return l;
  });

  let bright = 1, alarmT = -1, time = 0;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the ring's u of a world point: CylinderGeometry has u = θ / 2π with x = r sin θ, z = r cos θ
  const uOf = (x, z) => { const u = Math.atan2(x - cx, z - cz) / (Math.PI * 2); return u < 0 ? u + 1 : u; };

  return {
    // dt: this frame's time (0 when paused or frozen)
    update(dt) {
      time += frozen || reduce ? 0 : dt;
      // the glitch: on for a whole tick of glitchRate with glitchChance, at a height drawn from the tick
      const tg = Math.floor(time * L.glitchRate), h1 = n => { const v = Math.sin(n * 127.1) * 43758.5453; return v - Math.floor(v); };
      U.uGlitch.value.set(h1(tg * 3.3) >= 1 - L.glitchChance ? 1 : 0, h1(tg * 5.7), tg);
      U.uTime.value = time; U.uCol.value.set(glowCol.r, glowCol.g, glowCol.b); U.uBright.value = bright;
      if (alarmT >= 0) { alarmT += dt / A.time; U.uAlarm.value = alarmT; if (alarmT >= 1) { alarmT = -1; U.uAlarm.value = -1; } }
      const aw = alarmT >= 0 ? 1 - alarmT : 0, on = bright > 0;
      if (sky) sky.intensity = on ? (SP.sky + SP.skyAlarm * aw) * bright : 0;
      points.forEach(l => { l.intensity = on ? (SP.point + SP.pointAlarm * aw) * bright : 0; });
    },
    // SCRIBE's public events (scribe.js): 'camp' from where the penalty is (at: {x, z}), 'key' (task 017) from the key's
    // place, 'final' from several places
    alarm(kind, at) {
      alarmT = 0;
      if ((kind === 'camp' || kind === 'key') && at) { U.uAlarmAt.value.set(uOf(at.x, at.z), 0, 0); U.uAlarmN.value = 1; }
      // the final phase: from fixed places (no random draw in the picture: both players of a PvP match see the same)
      else { U.uAlarmAt.value.set(0, 1 / 3, 2 / 3); U.uAlarmN.value = A.finalFrom; }
    },
    // the pause's brightness: a key of SCREEN.brightness ('off': dark and no spill)
    setBrightness(key) { bright = S.brightness[key] ?? 1; U.uMode.value = bright > 0 ? (S.sectors ? 1 : 0) : 3; },
    // task 021: the fresco's colour (FRESCO.colors; 'auto' follows the script light) and quality (FRESCO.qualities),
    // and the script light chosen (GLOW.colors key) for 'auto'. The spill above follows the arena's light only
    setFrescoColor(k) { frescoColor = k; applyPalette(); },
    setFrescoQuality(k) { U.uRich && (U.uRich.value = k === 'rich' ? 1 : 0); },
    setLight(k) { light = k; applyPalette(); },
    // tests and screenshots: the screen's clock at t s (also under ?freeze)
    setTime(t) { time = t; },
    get fresco() { return !!fresk; },
    ring, uniforms: U,
  };
}
