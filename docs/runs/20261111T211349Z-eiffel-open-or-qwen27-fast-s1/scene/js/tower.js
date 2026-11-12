import * as THREE from 'three';
import {
  toonMat, beamGeo, boxGeo, coneGeo, archGeo, merge, outlineMat,
} from './util.js';

/**
 * Builds the Eiffel Tower as four material buckets (dark iron, light iron,
 * gold trim, stone decks) plus ink outlines and sparkle sample points.
 * Everything is merged into one geometry per material for a single draw
 * call each (plus its outline clone).
 *
 * Conventional Y-up: the tower is 100 units tall; the antenna tip sits
 * near 109.
 */
export function buildTower({ gradientMap, inkUniform, rng }) {
  const dark = [];
  const light = [];
  const gold = [];
  const stone = [];
  const sparklePts = [];

  // ---- silhouette: half-width of the square plan vs. height fraction -----
  const CTRL = [
    [0.0, 20.8], [0.08, 14.6], [0.19, 6.8], [0.383, 3.35],
    [0.6, 2.15], [0.8, 1.7], [0.92, 1.4], [1.0, 0.85],
  ];
  const wAt = (hf) => {
    hf = THREE.MathUtils.clamp(hf, 0, 1);
    for (let i = 0; i < CTRL.length - 1; i++) {
      if (hf <= CTRL[i + 1][0]) {
        const t = (hf - CTRL[i][0]) / (CTRL[i + 1][0] - CTRL[i][0]);
        const s = 0.5 - 0.5 * Math.cos(Math.PI * t);
        return CTRL[i][1] + (CTRL[i + 1][1] - CTRL[i][1]) * s;
      }
    }
    return CTRL[CTRL.length - 1][1];
  };

  // ---- the four splaying base legs ---------------------------------------
  const LEG_H = 19;
  const legC = (hf) => {
    const t = THREE.MathUtils.clamp(hf, 0, 1);
    // plan-view centreline: from corner (20.8, 20.8) to (6.8, 6.8), bulging out
    return (1 - t) * (1 - t) * 20.8 + 2 * (1 - t) * t * 19.0 + t * t * 6.8;
  };
  const legS = (hf) => THREE.MathUtils.lerp(6.4, 1.6, hf);
  const legLevels = [0, 3.4, 6.8, 10.2, 13.6, 17.0, LEG_H + 0.2];
  const off4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      dark.push(boxGeo(sx * 20.8, 0.45, sy * 20.8, 15, 0.9, 15)); // base plinth
      dark.push(boxGeo(sx * 20.8, 1.7, sy * 20.8, 11, 2.6, 11)); // pedestal
      for (let i = 0; i < legLevels.length - 1; i++) {
        const h0 = legLevels[i];
        const h1 = legLevels[i + 1];
        const c0 = legC(h0 / LEG_H);
        const c1 = legC(h1 / LEG_H);
        const s0 = legS(h0 / LEG_H);
        const s1 = legS(h1 / LEG_H);
        const P = (h, c, s, o) => [sx * c + (o[0] * s) / 2, h, sy * c + (o[1] * s) / 2];
        const t = THREE.MathUtils.lerp(1.5, 0.75, i / 5);
        for (const o of off4) dark.push(beamGeo(P(h0, c0, s0, o), P(h1, c1, s1, o), t));
        for (let k = 0; k < 4; k++) { // gusset ring
          dark.push(beamGeo(P(h0, c0, s0, off4[k]), P(h0, c0, s0, off4[(k + 1) % 4]), 0.55));
        }
        for (let k = 0; k < 4; k++) { // X bracing on each face of the leg
          const o0 = off4[k];
          const o1 = off4[(k + 1) % 4];
          dark.push(beamGeo(P(h0, c0, s0, o0), P(h1, c1, s1, o1), 0.42));
          dark.push(beamGeo(P(h0, c0, s0, o1), P(h1, c1, s1, o0), 0.42));
        }
      }
    }
  }

  // ---- the big arches under the first platform ---------------------------
  const ARC = 16.2;
  for (const s of [-1, 1]) {
    dark.push(archGeo(s * ARC, 3.0, 0, ARC, 0.85, Math.PI, -Math.PI / 2));
    dark.push(archGeo(0, 3.0, s * ARC, ARC, 0.85, Math.PI, 0));
  }

  // ---- open webbing between the legs (below the first platform) ----------
  const webH = [4.5, 9.0, 13.5, 17.5];
  for (const s of [-1, 1]) {
    for (let i = 0; i < webH.length; i++) {
      const h = webH[i];
      const cf = legC(h / LEG_H) * 0.99;
      dark.push(beamGeo([s * cf, h, -cf], [s * cf, h, cf], 0.5));
      dark.push(beamGeo([-cf, h, s * cf], [cf, h, s * cf], 0.5));
      if (i < webH.length - 1) {
        const h0 = webH[i];
        const h1 = webH[i + 1];
        const c0 = legC(h0 / LEG_H) * 0.99;
        const c1 = legC(h1 / LEG_H) * 0.99;
        dark.push(beamGeo([s * c0, h0, -c0], [s * c1, h1, c1], 0.42));
        dark.push(beamGeo([s * c0, h0, c0], [s * c1, h1, -c1], 0.42));
        dark.push(beamGeo([-c0, h0, s * c0], [c1, h1, s * c1], 0.42));
        dark.push(beamGeo([c0, h0, s * c0], [-c1, h1, s * c1], 0.42));
      }
    }
  }

  // ---- first platform (57 m in reality) ----------------------------------
  stone.push(boxGeo(0, 20.1, 0, 22, 2.2, 22));
  const trim = (w, y, t) => {
    gold.push(beamGeo([-w, y, -w], [w, y, -w], t));
    gold.push(beamGeo([-w, y, w], [w, y, w], t));
    gold.push(beamGeo([-w, y, -w], [-w, y, w], t));
    gold.push(beamGeo([w, y, -w], [w, y, w], t));
  };
  trim(11, 21.34, 0.45);
  for (const side of [0, 1, 2, 3]) { // railing bars
    for (let k = 0; k <= 13; k++) {
      const u = -10.5 + (21 * k) / 13;
      if (side === 0) gold.push(boxGeo(u, 21.85, -10.5, 0.16, 1.25, 0.16));
      else if (side === 1) gold.push(boxGeo(u, 21.85, 10.5, 0.16, 1.25, 0.16));
      else if (side === 2) gold.push(boxGeo(-10.5, 21.85, u, 0.16, 1.25, 0.16));
      else gold.push(boxGeo(10.5, 21.85, u, 0.16, 1.25, 0.16));
    }
  }
  trim(10.5, 22.45, 0.32);

  // ---- the tapering body, first to third platform ------------------------
  const L1 = [21.0, 24.3, 27.4, 30.5, 33.6, 36.0, 38.7];
  const L2 = [40.0, 44.0, 48.0, 52.2, 56.6, 61.2, 66.0, 71.0, 76.2, 81.6, 87.0, 92.0];
  const L3 = [93.2, 95.4, 97.8];

  const bodySection = (levels, mid) => {
    for (let i = 0; i < levels.length - 1; i++) {
      const h0 = levels[i];
      const h1 = levels[i + 1];
      const w0 = wAt(h0 / 100);
      const w1 = wAt(h1 / 100);
      const f = ((h0 + h1) / 2) / 100;
      const tc = THREE.MathUtils.lerp(1.9, 0.85, f);
      const tx = THREE.MathUtils.lerp(0.95, 0.45, f);
      const tf = THREE.MathUtils.lerp(0.85, 0.4, f);
      const tm = THREE.MathUtils.lerp(0.6, 0.3, f);
      for (const o of off4) light.push(beamGeo([o[0] * w0, h0, o[1] * w0], [o[0] * w1, h1, o[1] * w1], tc));
      const X = [
        [[-w0, -w0], [w1, -w1]], [[w0, -w0], [-w1, -w1]],
        [[-w0, w0], [w1, w1]], [[w0, w0], [-w1, w1]],
        [[-w0, -w0], [-w1, w1]], [[-w0, w0], [-w1, -w1]],
        [[w0, -w0], [w1, w1]], [[w0, w0], [w1, -w1]],
      ];
      for (const [p, q] of X) light.push(beamGeo([p[0], h0, p[1]], [q[0], h1, q[1]], tx));
      light.push(beamGeo([-w0, h0, -w0], [w0, h0, -w0], tf));
      light.push(beamGeo([-w0, h0, w0], [w0, h0, w0], tf));
      light.push(beamGeo([-w0, h0, -w0], [-w0, h0, w0], tf));
      light.push(beamGeo([w0, h0, -w0], [w0, h0, w0], tf));
      if (mid) {
        light.push(beamGeo([0, h0, -w0], [0, h1, -w1], tm));
        light.push(beamGeo([0, h0, w0], [0, h1, w1], tm));
        light.push(beamGeo([-w0, h0, 0], [-w1, h1, 0], tm));
        light.push(beamGeo([w0, h0, 0], [w1, h1, 0], tm));
      }
      // sparkle sample points for the famous night show (just outside the
      // lattice faces so the ink outline never eats them)
      for (const o of off4) sparklePts.push([o[0] * (w0 + 0.15) + (rng() - 0.5) * 0.4, h0 + 0.3, o[1] * (w0 + 0.15) + (rng() - 0.5) * 0.4]);
      sparklePts.push([0, h0, -(w0 + 0.28)], [0, h0, w0 + 0.28], [-(w0 + 0.28), h0, 0], [w0 + 0.28, h0, 0]);
      for (let k = 0; k < 2; k++) {
        const face = Math.floor(rng() * 4);
        const u = (rng() - 0.5) * w0 * 1.7;
        const hh = h0 + rng() * (h1 - h0);
        sparklePts.push(
          face === 0 ? [u, hh, -(w0 + 0.28)] :
          face === 1 ? [u, hh, w0 + 0.28] :
          face === 2 ? [-(w0 + 0.28), hh, u] : [w0 + 0.28, hh, u]
        );
      }
    }
  };
  bodySection(L1, true);
  bodySection(L2, true);
  bodySection(L3, false);

  // ---- second platform (115 m) -------------------------------------------
  stone.push(boxGeo(0, 39.35, 0, 12, 1.7, 12));
  trim(6, 40.34, 0.42);
  for (const side of [0, 1, 2, 3]) {
    for (let k = 0; k <= 8; k++) {
      const u = -5.6 + (11.2 * k) / 8;
      if (side === 0) gold.push(boxGeo(u, 40.72, -5.6, 0.14, 1.15, 0.14));
      else if (side === 1) gold.push(boxGeo(u, 40.72, 5.6, 0.14, 1.15, 0.14));
      else if (side === 2) gold.push(boxGeo(-5.6, 40.72, u, 0.14, 1.15, 0.14));
      else gold.push(boxGeo(5.6, 40.72, u, 0.14, 1.15, 0.14));
    }
  }
  trim(5.6, 41.35, 0.28);
  gold.push(boxGeo(-3.6, 40.9, 2.2, 1.7, 1.6, 1.7)); // little kiosks
  gold.push(boxGeo(3.1, 40.85, -2.8, 1.4, 1.5, 1.4));
  gold.push(boxGeo(0.4, 40.8, 3.9, 1.2, 1.4, 1.2));

  // ---- third platform (276 m) + cabin + antenna ---------------------------
  stone.push(boxGeo(0, 92.4, 0, 5.8, 1.2, 5.8));
  trim(2.9, 93.14, 0.32);
  for (const side of [0, 1, 2, 3]) {
    for (let k = 0; k <= 4; k++) {
      const u = -2.6 + (5.2 * k) / 4;
      if (side === 0) gold.push(boxGeo(u, 93.42, -2.6, 0.12, 0.9, 0.12));
      else if (side === 1) gold.push(boxGeo(u, 93.42, 2.6, 0.12, 0.9, 0.12));
      else if (side === 2) gold.push(boxGeo(-2.6, 93.42, u, 0.12, 0.9, 0.12));
      else gold.push(boxGeo(2.6, 93.42, u, 0.12, 0.9, 0.12));
    }
  }
  trim(2.6, 93.95, 0.24);

  stone.push(boxGeo(0, 98.05, 0, 2.8, 0.9, 2.8)); // top platform
  light.push(boxGeo(0, 99.175, 0, 2.0, 1.55, 2.0)); // cabin
  dark.push(coneGeo(0, 100.35, 0, 1.62, 1.05, 4, Math.PI / 4)); // pyramid roof
  for (const o of off4) { // antenna mast
    light.push(beamGeo([o[0] * 0.5, 100.6, o[1] * 0.5], [o[0] * 0.14, 108.3, o[1] * 0.14], 0.16));
  }
  light.push(beamGeo([-0.38, 103.6, -0.38], [0.38, 103.6, 0.38], 0.1));
  light.push(beamGeo([0.38, 103.6, -0.38], [-0.38, 103.6, 0.38], 0.1));
  light.push(beamGeo([-0.26, 106.2, -0.26], [0.26, 106.2, 0.26], 0.09));
  light.push(beamGeo([0.26, 106.2, -0.26], [-0.26, 106.2, 0.26], 0.09));

  // ---- assemble meshes -----------------------------------------------------
  const mats = {
    ironDark: toonMat(gradientMap, 0x4f4436),
    ironLight: toonMat(gradientMap, 0x75654e),
    gold: toonMat(gradientMap, 0xd9a441),
    stone: toonMat(gradientMap, 0xd6c39a),
  };
  const group = new THREE.Group();
  const buckets = [
    [dark, mats.ironDark, 0.16],
    [light, mats.ironLight, 0.14],
    [gold, mats.gold, 0.09],
    [stone, mats.stone, 0.12],
  ];
  for (const [list, mat, th] of buckets) {
    const geo = merge(list);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    const o = new THREE.Mesh(geo, outlineMat(inkUniform, th));
    o.castShadow = false;
    o.receiveShadow = false;
    group.add(m, o);
  }

  // ---- the "sparkle" points (night light show) -----------------------------
  const sp = new THREE.BufferGeometry();
  const pos = new Float32Array(sparklePts.length * 3);
  const seed = new Float32Array(sparklePts.length);
  sparklePts.forEach((p, i) => {
    pos.set(p, i * 3);
    seed[i] = rng();
  });
  sp.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sp.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x2a1d18 });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), beaconMat);
  beacon.position.set(0, 108.7, 0);
  group.add(beacon);

  return { group, mats, sparkle: sp, beacon, beaconMat };
}
