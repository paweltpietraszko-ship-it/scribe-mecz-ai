// Renderer, hall (floor, back wall, darkness instead of a ceiling), fog, lights and bloom.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RENDER, CAMERA, BACK_WALL, LIT } from './data/arena.js';
import { buildFloor } from './arena/floor.js';
import { onMaterial } from './look/materials.js';
import { initLoaders } from './look/loaders.js';

function spotLight(d) {
  const s = new THREE.SpotLight(d.color, d.intensity, d.distance, d.angle, d.penumbra, d.decay);
  s.position.set(...d.pos); s.target.position.set(...d.target);
  s.castShadow = true; s.shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize); s.shadow.bias = RENDER.shadowBias;
  return s;
}

// Throws if WebGL is not available.
export function createStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  let scale = RENDER.resolutionScale.default;
  const pixelRatio = () => Math.min(devicePixelRatio, RENDER.pixelRatioMax) * scale;
  renderer.setPixelRatio(pixelRatio()); renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = RENDER.exposure;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  initLoaders(renderer);   // task 024: KTX2 and meshopt files (the floor's pictures are among them)

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(RENDER.background);
  scene.fog = new THREE.FogExp2(RENDER.fog.color, RENDER.fog.density);
  // the environment's light, drawn once on the card (task 024 K4: again after a lost context, its picture is gone)
  const environment = () => {
    const pmr = new THREE.PMREMGenerator(renderer);
    scene.environment = pmr.fromScene(new RoomEnvironment(), RENDER.environment.blur).texture;
    pmr.dispose();
  };
  environment();
  scene.environmentIntensity = LIT.environment;

  const camera = new THREE.PerspectiveCamera(CAMERA.fov, innerWidth / innerHeight, CAMERA.near, CAMERA.far);

  // hall: polished dark floor and the wall behind the panels; above them only darkness. Task 011: the floor is a disc
  // under the arena section (to the boundary's outer face), the wall runs along the hexagon's whole side
  // task 020: the floor is polished stone paired with the panels' material (arena/floor.js)
  const floor = buildFloor(scene);
  onMaterial(floor.setMaterial);
  const [wx0, wx1] = BACK_WALL.x;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(wx1 - wx0, BACK_WALL.height), new THREE.MeshStandardMaterial({ color: BACK_WALL.color, roughness: BACK_WALL.roughness }));
  wall.position.set((wx0 + wx1) / 2, BACK_WALL.height / 2, BACK_WALL.z); wall.receiveShadow = true; scene.add(wall);

  // white work lights on the wall and on the disc; the rest of the light comes from the script
  const wallSpot = spotLight(LIT.wallSpot), discSpot = spotLight(LIT.discSpot), h = LIT.hemi;
  scene.add(wallSpot, wallSpot.target, discSpot, discSpot.target, new THREE.HemisphereLight(h.sky, h.ground, h.intensity));

  const composer = new EffectComposer(renderer), pass = new RenderPass(scene, camera); composer.addPass(pass);
  const B = RENDER.bloom;
  if (B.on) {
    const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), B.strength, B.radius, B.threshold);
    // task 024 (K1): its blur targets draw flat quads only: no depth buffer for them (the same picture, less memory)
    [...bloom.renderTargetsHorizontal, ...bloom.renderTargetsVertical, bloom.renderTargetBright].forEach(t => { t.depthBuffer = false; });
    composer.addPass(bloom);
  }
  // task 024 (K1): the last pass draws to the screen, nothing reads after it: no swap of the two targets, so the second
  // one (1920 × 1080 with its depth) is never made (every pass before it draws in place)
  const output = new OutputPass(); output.needsSwap = false;
  composer.addPass(output);

  // task 024 (K5): `fixed` [w, h]: the picture drawn at that size whatever the window (the canvas keeps its place on the
  // page, only its drawing buffer changes): the performance test
  let fixed = null;
  function resize() {
    const [w, h] = fixed ?? [innerWidth, innerHeight], ratio = fixed ? 1 : pixelRatio();
    camera.aspect = w / h; camera.updateProjectionMatrix();
    renderer.setPixelRatio(ratio); composer.setPixelRatio(ratio);
    renderer.setSize(w, h, !fixed); composer.setSize(w, h);
  }
  addEventListener('resize', resize);

  return {
    renderer, scene, camera, composer, floor,
    get scale() { return scale; },
    setScale(v) { scale = v; resize(); },
    setFixedSize(size) { fixed = size; resize(); },
    render: () => composer.render(),
    redrawEnvironment: environment,
    // task 011 (U3): the Elements views draw the preview scene instead of the arena (null: the arena)
    show(other) { pass.scene = other ?? scene; },
  };
}
