import * as THREE from 'three';

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

export function shadows(g) {
  g.traverse((o) => {
    if (o.isMesh) { o.castShadow = o.receiveShadow = true; }
  });
  return g;
}

export const deg = THREE.MathUtils.degToRad;