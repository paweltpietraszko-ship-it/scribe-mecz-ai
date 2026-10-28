// Turntable Ø 9 m with three arms and a figure for scale. Everything on the disc turns with it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TURNTABLE, MOTION, RESPONSE, ACCENTS } from '../data/arena.js';
import { RNG } from '../look/script.js';
import { faceTex, discTex, planarUV } from '../look/textures.js';
import { faceMaterial, hdr, darkMat, glowCol, glowLight } from '../look/materials.js';
import { buildFigure } from './figure.js';

export function buildTurntable(scene) {
  const TR = TURNTABLE.radius, [TX, TZ] = TURNTABLE.center;
  const flash = { value: 0 };
  const turn = new THREE.Group(); turn.position.set(TX, 0, TZ); scene.add(turn);

  const dtx = discTex(TURNTABLE.seed, TR, TURNTABLE.texPxPerM);
  const discMat = faceMaterial(dtx, TURNTABLE.waveOffset, flash, TURNTABLE.waveSpeed, TURNTABLE.normalScale);
  const D = TURNTABLE.disc, RM = TURNTABLE.rim, HB = TURNTABLE.hub;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(TR, TR, D.thickness, 160), [darkMat, discMat, darkMat]); disc.position.y = D.y; disc.receiveShadow = true; turn.add(disc);
  // rim stays with the floor, the disc turns inside it
  const rim = new THREE.Mesh(new THREE.RingGeometry(TR + RM.inner, TR + RM.outer, 200), hdr(RM.glow * ACCENTS.turntable)); rim.rotation.x = -Math.PI / 2; rim.position.set(TX, RM.y, TZ); scene.add(rim);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(HB.rTop, HB.rBottom, HB.height, 96), darkMat); hub.position.y = HB.height / 2; hub.castShadow = true; turn.add(hub);
  const hubRing = new THREE.Mesh(new THREE.TorusGeometry(HB.ring.R, HB.ring.tube, 8, 128), hdr(HB.ring.glow * ACCENTS.turntable)); hubRing.rotation.x = Math.PI / 2; hubRing.position.y = HB.height; turn.add(hubRing);

  const A = TURNTABLE.arms, AL = A.length, AH = A.height, AT = A.thickness, A0 = A.innerRadius;
  const armTx = faceTex(A.seed, AL, AH, A.texPxPerM, null, A.glyphSize); const armMat = faceMaterial(armTx, A.waveOffset, flash, 1, A.normalScale);
  const armPlates = [], armGroups = [], armFeet = [];
  [0, 1, 2].forEach(k => {
    const a = new THREE.Group(); a.rotation.y = k * Math.PI * 2 / 3 + A.angle0; turn.add(a); armGroups.push(a);
    const rr = RNG(300 + k); const cut = A.cutMin + rr() * A.cutRange; const gap = A.gap;
    [[0, cut], [cut + gap, AL]].forEach(([u0, u1]) => {
      const L = u1 - u0; const geo = new RoundedBoxGeometry(L, AH, AT, 2, A.radius); geo.translate(u0 + L / 2 - AL / 2, AH / 2, 0); planarUV(geo, -AL / 2, AL, AH);
      const m = new THREE.Mesh(geo, armMat); m.position.x = A0 + AL / 2; m.castShadow = m.receiveShadow = true; m.userData = { x0: m.position.x, k: A.tremorMin + rr() * A.tremorRange }; a.add(m); armPlates.push(m);
    });
    const seam = new THREE.Mesh(new THREE.BoxGeometry(gap * A.seam.width, AH - A.seam.inset, AT * A.seam.depth), hdr(A.seam.glow * ACCENTS.turntable)); seam.position.set(A0 + cut + gap / 2, AH / 2, 0); a.add(seam);
    const ft = A.foot;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(AL + ft.extraLength, ft.height, AT + ft.extraWidth), hdr(ft.glow * ACCENTS.turntable)); foot.position.set(A0 + AL / 2, ft.height / 2, 0); a.add(foot); armFeet.push(foot);
  });

  // a figure for scale, standing on the disc: it turns with it
  const fig = buildFigure(); fig.position.set(TURNTABLE.figure.pos[0], 0, TURNTABLE.figure.pos[1]); turn.add(fig);

  const L = TURNTABLE.light, FX = RESPONSE.turn;
  const light = glowLight(new THREE.PointLight(glowCol, L.intensity, L.distance, L.decay)); light.position.set(TX, L.y, TZ); scene.add(light);

  // s: turntable cycle state from motion.js; t: time in seconds
  function update(s, t) {
    turn.rotation.y = s.angle; flash.value = s.flash * MOTION.flashGain;
    rim.material.color.copy(glowCol).multiplyScalar(RM.glow + s.tension * FX.rim.tension + (s.turning ? FX.rim.turning : 0));
    hubRing.material.color.copy(glowCol).multiplyScalar(HB.ring.glow + s.tension * FX.hubRing.tension);
    armPlates.forEach(m => { m.position.y = s.tension * FX.tremor.amount * Math.sin(t * FX.tremor.hz + m.userData.k * FX.tremor.phase) * m.userData.k; });
    light.intensity = L.intensity + s.flash * FX.light.flash + s.tension * FX.light.tension;
  }
  // task 012: SCRIBE sinks an arm by `drop` m into the disc (the glowing line at its foot stays on the floor)
  function setArmDrop(k, drop) { armGroups[k].position.y = -drop; armFeet[k].position.y = drop + ft0; }
  const ft0 = A.foot.height / 2;
  return { group: turn, update, setArmDrop, armFeet, arms: armGroups };
}
