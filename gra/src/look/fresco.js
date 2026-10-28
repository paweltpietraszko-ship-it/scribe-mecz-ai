// The fresco of the Progenitors (task 021): Astra's package (public/fresco/, FRESCO) drawn on the screen's ring as in
// her reference (reference/ekran/fresk/preview_v1.html). Four segments of 90° left to right as seen from the arena; the
// picture's tone runs from the palette's shadow to its light; the mineral veil slowly comes over the dark detail and
// goes (each segment in its own phase), so a presence grows clearer while another fades; the richer quality adds a
// slow drift of the mineral field (an apparent depth of the stone) and a second veil. The segments meet at the same seam
// colour (the textures alone are not seamless). The picture never shows the fight: the only input from the game is
// the public alarm (look/screen.js) and the arena's script light.
import * as THREE from 'three';
import { loadPicture } from './loaders.js';
import { FRESCO as F } from '../data/fresco.js';
import { SCREEN } from '../data/screen.js';

// the livelier motion (FRESCO.life): ?ruch=… over the data
const askedLife = new URLSearchParams(globalThis.location?.search ?? '').get('ruch');
const LIFE = ['chmury', 'woda', 'astra'].includes(askedLife) ? askedLife : F.life.mode;

const glsl = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
// a palette's sRGB hex as raw numbers (the reference mixes colours in sRGB; the result is made linear at the end)
export const rawRGB = hex => new THREE.Vector3(...hex.match(/[0-9a-f]{2}/gi).map(v => parseInt(v, 16) / 255));

// the package's eight images, once; null if any of them fails (the screen then keeps the machine's script)
export async function loadFresco() {
  const files = [...F.segments, ...F.masks];
  try {
    // task 024: KTX2 files (scripts/assets.mjs), compressed on the card
    const tex = await Promise.all(files.map(f => loadPicture(F.dir + f)));
    tex.forEach(t => { t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; });
    return { segments: tex.slice(0, 4), masks: tex.slice(4) };
  } catch (e) {
    console.error('fresco: the package did not load, the screen keeps the machine\'s script', e);
    return null;
  }
}

// uniforms: the screen's own (uTime, uCol, uBright, uMode, uAlarm…) to which the fresco's are added
export function frescoMaterial(fresco, uniforms, alarmGLSL) {
  const U = Object.assign(uniforms, {
    uRich: { value: 1 }, uShadow: { value: new THREE.Vector3() }, uLight: { value: new THREE.Vector3() }, uVeil: { value: new THREE.Vector3() },
  });
  fresco.segments.forEach((t, i) => { U['tS' + i] = { value: t }; });
  fresco.masks.forEach((t, i) => { U['tM' + i] = { value: t }; });
  const R = F.rich, TAU = 6.2831853;
  return new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, fog: false, defines: { LIFE: { astra: 0, chmury: 1, woda: 2 }[LIFE], GLINTS: F.life.glints.on ? 1 : 0 },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform sampler2D tS0,tS1,tS2,tS3,tM0,tM1,tM2,tM3;
uniform float uTime,uRich,uBright,uMode,uAlarm,uAlarmN;uniform vec3 uCol,uAlarmAt,uShadow,uLight,uVeil;varying vec2 vUv;
${alarmGLSL}
// noise on the ring itself (a cylinder in metres): no seam where u wraps round
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float s=0.,a=.5;int o=uRich>.5?${F.life.octaves}:${F.life.leanOctaves};
  for(int i=0;i<${F.life.octaves};i++){if(i>=o)break;s+=a*n3(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s/(1.-pow(.5,float(o)));}
// a segment's picture and masks (explicit gradients: the segment is picked per pixel)
void seg(int s,vec2 a,vec2 dx,vec2 dy,out vec3 src,out vec3 m){
  if(s==0){src=textureGrad(tS0,a,dx,dy).rgb;m=textureGrad(tM0,a,dx,dy).rgb;}
  else if(s==1){src=textureGrad(tS1,a,dx,dy).rgb;m=textureGrad(tM1,a,dx,dy).rgb;}
  else if(s==2){src=textureGrad(tS2,a,dx,dy).rgb;m=textureGrad(tM2,a,dx,dy).rgb;}
  else{src=textureGrad(tS3,a,dx,dy).rgb;m=textureGrad(tM3,a,dx,dy).rgb;}
}
float maskG(int s,vec2 a,vec2 dx,vec2 dy){
  if(s==0)return textureGrad(tM0,a,dx,dy).g;if(s==1)return textureGrad(tM1,a,dx,dy).g;
  if(s==2)return textureGrad(tM2,a,dx,dy).g;return textureGrad(tM3,a,dx,dy).g;
}
void main(){
  // the ring's u runs right to left as seen from inside: the picture is read left to right
  float u=1.-vUv.x,v=vUv.y,q=u*4.;int s=int(min(floor(q),3.));float local=fract(q);
  vec2 a=vec2(local,v),dx=dFdx(vec2(q,v)),dy=dFdy(vec2(q,v));
  float ang=u*6.2831853;vec3 ring=vec3(sin(ang)*${glsl(SCREEN.radius)},v*${glsl(SCREEN.height)},cos(ang)*${glsl(SCREEN.radius)});
#if LIFE == 2
  // water: the picture wavers (its sampling point moves with a slow noise)
  vec3 wp=ring/${glsl(F.life.woda.size)};float wt=uTime*${glsl(F.life.woda.speed)};
  vec2 sh=vec2(fbm(wp+vec3(0,wt,0))-.5,fbm(wp+vec3(4.1,-wt,2.3))-.5)*${glsl(F.life.woda.shift * 2)};
  a=clamp(a+sh*vec2(1.,4.),vec2(.001),vec2(.999));
#endif
  vec3 src,m;seg(s,a,dx,dy,src,m);
  float lum=dot(src,vec3(.2126,.7152,.0722));
  vec3 c=mix(uShadow,uLight,pow(lum,${glsl(F.lumPower)}));
  float cyc[4]=float[](${F.cycles.map(glsl).join(',')}),ph[4]=float[](${F.phases.map(glsl).join(',')});
  float pulse=.5+.5*sin(uTime*${glsl(TAU / F.period)}*cyc[s]+ph[s]);
  float reveal=m.r*(${glsl(F.reveal[0])}+${glsl(F.reveal[1] - F.reveal[0])}*pulse)*(.35+.65*m.g);
  c=mix(c,uVeil,reveal);
  if(uRich>.5){
    float w=uTime*${glsl(TAU / R.driftPeriod)};
    vec2 b=clamp(a+vec2(${glsl(R.drift)}*sin(w),${glsl(R.drift * 0.24)}*cos(w)),vec2(.001),vec2(.999));
    c+=(maskG(s,b,dx,dy)-m.g)*${glsl(R.depth)};
    c=mix(c,uVeil,${glsl(R.veil)}*m.g*(.5+.5*sin(uTime*.13+local*8.+v*4.)));
  }
#if LIFE == 1
  // clouds: a mineral smoke curling through the stone (a noise bent by another noise), dark in its body, lit at its rim
  { vec3 p=ring/${glsl(F.life.chmury.size)};float t=uTime*${glsl(F.life.chmury.speed)};
    vec3 w=vec3(fbm(p+vec3(0,t,0)),fbm(p+vec3(5.2,1.3-t,2.8)),fbm(p+vec3(2.1,7.7,t)));
    float f=fbm(p+${glsl(F.life.chmury.warp)}*w+vec3(t*.7,-t*.4,t*.3));
    float cl=smoothstep(${glsl(F.life.chmury.edge[0])},${glsl(F.life.chmury.edge[1])},f);
    c=mix(c,mix(uShadow,uVeil,.35+.5*w.x),cl*${glsl(F.life.chmury.strength)});
    c+=uLight*${glsl(F.life.chmury.rim)}*cl*(1.-cl)*4.*w.y; }
#endif
#if LIFE == 2
  { vec3 p=ring/${glsl(F.life.woda.size * 0.5)};float t=uTime*${glsl(F.life.woda.speed * 1.7)};
    float g=fbm(p+vec3(t,-t*.6,t*.4));c*=1.+${glsl(F.life.woda.glint)}*(smoothstep(.55,.8,g)-.25); }
#endif
  // every segment meets the same seam colour at its edges
  c=mix(mix(uShadow,uLight,${glsl(F.seamMix)}),c,smoothstep(0.,${glsl(F.edge)},min(local,1.-local)));
  c=pow(max(c,0.),vec3(2.2))*${glsl(F.gain)};
#if LIFE == 2 && GLINTS
  // glints: a noise moving through time, only its highest peaks show, briefly and brightly
  { vec3 p=vec3(ring.x,ring.y,ring.z)/${glsl(F.life.glints.size)};
    float g=n3(p+vec3(0.,0.,uTime/${glsl(F.life.glints.life)}))*n3(p*.37+vec3(uTime*.11,3.7,1.3));
    float k=smoothstep(${glsl(F.life.glints.share * F.life.glints.share)},${glsl(Math.min(1, F.life.glints.share * F.life.glints.share + 0.12))},g);
    c+=pow(uLight,vec3(2.2))*${glsl(F.life.glints.bright)}*k*k; }
#endif
  c+=alarm(vUv.x);
  if(uMode>2.5)c=vec3(0.);
  c*=uBright;
  float edge=smoothstep(0.,.015,v)*smoothstep(1.,.985,v);
  gl_FragColor=vec4(c*edge,1.);
}`,
  });
}
