// Preview gallery "Elements": the variants of the arena elements in a row with their own lights, for comparison with
// reference/oslony_areny.html (view "Elements") and, task 011, reference/bryly_areny.html (view "Shapes"). Task 011 (U3):
// a preview scene of its own, not in the arena: the same sky, fog, light from the environment, floor and wall as the
// arena, drawn instead of it while a gallery view is on (stage.show).
import * as THREE from 'three';
import { GALLERY as G, RENDER, FLOOR, BACK_WALL, LIGHTS } from '../data/arena.js';
import { buildElement } from './elements.js';
import { buildFigure } from './figure.js';
import { glowCol, glowLight } from '../look/materials.js';

// arena: the arena's scene (its sky, fog and environment are shared)
export function buildGallery(arena) {
  const scene = new THREE.Scene();
  scene.background = arena.background; scene.fog = arena.fog;
  scene.environment = arena.environment; scene.environmentIntensity = arena.environmentIntensity;
  const h = LIGHTS.hemi; scene.add(new THREE.HemisphereLight(h.sky, h.ground, h.intensity));
  const first = G.order.indexOf(G.newFrom), end = G.x + G.order.length * G.typeSpacing + G.newGap;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(end + 10, 40), new THREE.MeshPhysicalMaterial({ color: FLOOR.color, roughness: FLOOR.roughness,
    metalness: FLOOR.metalness, clearcoat: FLOOR.clearcoat, clearcoatRoughness: FLOOR.clearcoatRoughness }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(end / 2, 0, 10); floor.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(end + 10, BACK_WALL.height), new THREE.MeshStandardMaterial({ color: BACK_WALL.color, roughness: BACK_WALL.roughness }));
  wall.position.set(end / 2, BACK_WALL.height / 2, BACK_WALL.z); wall.receiveShadow = true;
  scene.add(floor, wall);

  G.order.forEach((type, i) => {
    const cx = G.x + i * G.typeSpacing + (i >= first ? G.newGap : 0), off = G.wideOffset[type] ?? G.variantOffset;
    ['A', 'B'].forEach((v, j) => {
      const e = buildElement(type, v, G.seed(i, j));
      e.position.set(cx + (j ? off : -off) + (G.shift[type] ?? 0), 0, G.z + (G.wallZ[type] ?? 0)); scene.add(e);
    });
    const T = G.spotTall, tall = type === T.type, S = tall ? { ...G.spot, ...T } : G.spot;
    const s = new THREE.SpotLight(S.color, S.intensity, S.distance, S.angle, S.penumbra, S.decay);
    s.position.set(cx + (tall ? T.side : 0), S.height, G.z + S.forward); s.target.position.set(cx, S.targetY, G.z);
    s.castShadow = true; s.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize); s.shadow.bias = RENDER.shadowBias;
    scene.add(s, s.target);
    const P = G.glowLight;
    const pl = glowLight(new THREE.PointLight(glowCol, P.intensity, P.distance, P.decay)); pl.position.set(cx, P.y, G.z + P.forward);
    scene.add(pl);
  });
  const fig = buildFigure(); fig.position.set(G.x + G.figure[0], 0, G.z + G.figure[1]); scene.add(fig);
  return { scene };
}
