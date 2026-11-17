import * as THREE from 'three';
import { M } from './materials.js';
import { rand } from './rng.js';

// Fire in the east fireplace: logs, glowing coals, animated flames and a
// flickering point light that escapes through the firebox opening.
export function createFire(scene) {
  const g = new THREE.Group();

  const logGeo = new THREE.CylinderGeometry(0.05, 0.055, 0.52, 8);
  const specs = [
    [2.84, 0.15, 0.0, 0.06],
    [2.86, 0.26, 0.02, -0.5],
    [2.83, 0.21, -0.12, 0.9],
  ];
  for (const [x, y, z, ry] of specs) {
    const log = new THREE.Mesh(logGeo, M.log);
    log.rotation.z = Math.PI / 2 - 0.12;
    log.rotation.y = ry;
    log.position.set(x, y, z);
    g.add(log);
  }

  const coalMat = new THREE.MeshStandardMaterial({
    color: '#3a120a', emissive: '#ff5a1a', emissiveIntensity: 1.2, roughness: 1,
  });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.025, 0.045), 0), coalMat);
    c.position.set(2.86 + rand(-0.04, 0.04), 0.05 + rand(0, 0.03), rand(-0.3, 0.3));
    g.add(c);
  }

  const flameSpecs = [
    [2.84, 0.31, -0.08, 0.09, 0.42, '#ff6a00'],
    [2.86, 0.28, 0.1, 0.07, 0.34, '#ff9a20'],
    [2.82, 0.25, 0.0, 0.05, 0.3, '#ffc860'],
    [2.88, 0.24, -0.18, 0.06, 0.28, '#ff7a10'],
  ];
  const flames = flameSpecs.map(([x, y, z, r, h, col]) => {
    const m = new THREE.Mesh(
      new THREE.ConeGeometry(r, h, 7),
      new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.75,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })
    );
    m.position.set(x, y, z);
    m.castShadow = false;
    g.add(m);
    return { m, base: y, h, ph: rand(0, 6) };
  });

  const glow = new THREE.PointLight('#ff8a3c', 4, 5, 2);
  glow.position.set(2.82, 0.5, 0);
  g.add(glow);

  // Flickering firelight thrown out through the opening into the room.
  const beam = new THREE.SpotLight('#ff8a3c', 8, 14, 0.9, 0.6, 2);
  beam.position.set(2.68, 0.45, 0);
  beam.target.position.set(0.3, 0.5, 0);
  beam.castShadow = true;
  beam.shadow.mapSize.set(1024, 1024);
  beam.shadow.bias = -0.001;
  beam.shadow.normalBias = 0.04;
  beam.shadow.camera.near = 0.1;
  beam.shadow.camera.far = 14;
  g.add(beam, beam.target);

  scene.add(g);

  function update(t) {
    const f = 0.72 + 0.28 * (0.6 * Math.sin(t * 9.1) + 0.4 * Math.sin(t * 23.7 + 1.4) * Math.sin(t * 4.3));
    glow.intensity = 2.5 + 3 * f;
    beam.intensity = 4.5 + 7 * f;
    coalMat.emissiveIntensity = 0.6 + 1.1 * f;
    for (const fl of flames) {
      const s = 0.8 + 0.35 * Math.sin(t * 7.3 + fl.ph) * Math.sin(t * 3.1 + fl.ph * 2);
      fl.m.scale.set(1, Math.max(0.4, s), 1);
      fl.m.position.y = fl.base + fl.h * 0.35 * (s - 0.8);
      fl.m.material.opacity = 0.55 + 0.25 * s;
    }
  }

  return { update };
}