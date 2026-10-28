// Silhouette of a person for scale (capsule body and a head). Dimensions in TURNTABLE.figure.
import * as THREE from 'three';
import { TURNTABLE } from '../data/arena.js';

const FG = TURNTABLE.figure;
const figMat = new THREE.MeshStandardMaterial({ color: FG.color, roughness: FG.roughness, metalness: FG.metalness });

export function buildFigure() {
  const fig = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(FG.radius, FG.body, 8, 16), figMat); body.position.y = FG.radius + FG.body / 2 + FG.lift;
  const head = new THREE.Mesh(new THREE.SphereGeometry(FG.head, 24, 16), figMat); head.position.y = FG.headY;
  [body, head].forEach(m => { m.castShadow = true; fig.add(m); });
  return fig;
}
