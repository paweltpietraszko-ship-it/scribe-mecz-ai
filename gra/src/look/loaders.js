// Task 024 (K1, K2): the loaders of the game's processed files (scripts/assets.mjs): models with KTX2 textures and
// meshopt geometry, and standalone KTX2 pictures. Made once, for the renderer's card (KTX2Loader picks the compressed
// format it can keep: BC7 on a PC, ASTC/ETC2 on a phone); the Basis transcoder from the game's own files
// (public/basis-r<three's version>/). Task 024 (K3): every file asked for with its version (src/asset.js).
import * as THREE from 'three';
import { REVISION } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { asset } from '../asset.js';

let ktx2 = null, gltf = null;
export function initLoaders(renderer) {
  ktx2 = new KTX2Loader().setTranscoderPath(`basis-r${REVISION}/`).detectSupport(renderer);
  gltf = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
}
// Task 027 (the fight without drawing, in Node too): the models without their pictures. The server needs the bones,
// the shapes and the clips, never a texture: a KTX2 picture becomes an empty texture (no transcoder, no card)
class NoPictures extends THREE.Loader {
  load(url, onLoad) { const t = new THREE.Texture(); queueMicrotask(() => onLoad(t)); return t; }
}
export function initLoadersHeadless() {
  gltf = new GLTFLoader().setKTX2Loader(new NoPictures()).setMeshoptDecoder(MeshoptDecoder);
}
// a model (.glb): { scene, animations, … }. Task 026: with an AbortSignal the download can be stopped (a character
// chosen and left at once in the menu): fetched here, then parsed
export async function loadModel(url, signal) {
  if (!signal) return gltf.loadAsync(asset(url));
  const address = new URL(asset(url), location.href).href;
  // the service worker fetches it for the page: told to stop too (sw.src.js)
  signal.addEventListener('abort', () => navigator.serviceWorker?.controller?.postMessage({ type: 'stop', url: address }), { once: true });
  const res = await fetch(address, { signal });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return gltf.parseAsync(await res.arrayBuffer(), url.slice(0, url.lastIndexOf('/') + 1));
}
// a KTX2 picture: a compressed texture with its mipmaps
export const loadPicture = url => ktx2.loadAsync(asset(url));
