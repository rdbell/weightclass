import * as THREE from 'three';
import { BeamSet, hullMaterial } from './materials.js';

// ---------------------------------------------------------------------------
// The Eiffel Tower, built procedurally: four curved corner columns, face
// lattice with X-bracing, the great arches, three platforms, summit + antenna.
// All iron members are straight boxes fed into two BeamSets (one outlined).
// ---------------------------------------------------------------------------

const UP = new THREE.Vector3(0, 1, 0);
const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Width profile: [height, half-width] samples, interpolated with Catmull-Rom
// so the legs get that signature outward bow.
const PROF = [
  [0, 12], [5, 11], [10, 9.9], [15, 8.8], [22, 7.5], [28, 6.4],
  [34, 5.4], [42, 4.2], [48, 3.4], [54, 2.8], [60, 2.2], [66, 1.6],
];

function W(h) {
  let i = 0;
  while (i < PROF.length - 2 && PROF[i + 1][0] < h) i++;
  const h0 = PROF[i][0], w0 = PROF[i][1];
  const h1 = PROF[i + 1][0], w1 = PROF[i + 1][1];
  const u = (h - h0) / (h1 - h0);
  const wm0 = PROF[Math.max(i - 1, 0)][1];
  const w3 = PROF[Math.min(i + 2, PROF.length - 1)][1];
  const u2 = u * u, u3 = u2 * u;
  return 0.5 * ((2 * w0) + (-wm0 + w1) * u + (2 * wm0 - 5 * w0 + 4 * w1 - w3) * u2 + (-wm0 + 3 * w0 - 3 * w1 + w3) * u3);
}

const HS = [0, 5, 10, 15, 22, 28, 34, 42, 48, 54, 60, 66];
const CORNERS = [[1, 1], [1, -1], [-1, -1], [-1, 1]]; // (sx, sz)

const colT = (h) => 1.25 - (h / 66) * 0.85;   // column thickness
const braceT = (h) => 0.5 - (h / 66) * 0.28;  // lattice thickness

export function buildTower(scene, mats) {
  const g = new THREE.Group();
  const hullIron = hullMaterial(0.12);

  const iron = new BeamSet(mats.iron, 0.11);   // major members, inked
  const minor = new BeamSet(mats.iron, 0);     // railings etc, no outline

  const cpt = (sx, sz, h) => v(sx * W(h), h, sz * W(h));

  // ---- Corner columns -------------------------------------------------------
  for (const [sx, sz] of CORNERS) {
    let prev = cpt(sx, sz, 0);
    for (let k = 0; k < HS.length - 1; k++) {
      for (const f of [0.5, 1]) {
        const h = HS[k] + (HS[k + 1] - HS[k]) * f;
        const p = cpt(sx, sz, h);
        iron.addV(prev, p, (colT(prev.y) + colT(p.y)) / 2);
        prev = p;
      }
    }
  }

  // ---- Face lattice: node struts, X braces, mid struts ----------------------
  for (let f = 0; f < 4; f++) {
    const [s1a, s1b] = CORNERS[f];
    const [s2a, s2b] = CORNERS[(f + 1) % 4];
    for (let k = 0; k < HS.length - 1; k++) {
      const h0 = HS[k], h1 = HS[k + 1], hm = (h0 + h1) / 2;
      const A0 = cpt(s1a, s1b, h0), B0 = cpt(s2a, s2b, h0);
      const A1 = cpt(s1a, s1b, h1), B1 = cpt(s2a, s2b, h1);
      const Am = cpt(s1a, s1b, hm), Bm = cpt(s2a, s2b, hm);
      iron.addV(A0, B0, braceT(h0) * 1.25);          // node strut
      iron.addV(A0, B1, braceT(h0));                 // X brace \
      iron.addV(B0, A1, braceT(h0));                 // X brace /
      iron.addV(Am, Bm, braceT(hm) * 1.05);          // mid strut
    }
    const top = 66;
    iron.addV(cpt(s1a, s1b, top), cpt(s2a, s2b, top), braceT(top) * 1.25);
  }

  iron.build(g);
  minor.build(g);

  // ---- The four great arches ------------------------------------------------
  const fa = W(15.2) - 0.5;
  const archGeo = new THREE.TorusGeometry(6.9, 0.55, 10, 26, Math.PI);
  const archHullGeo = new THREE.TorusGeometry(6.9, 0.55, 10, 26, Math.PI);
  for (let f = 0; f < 4; f++) {
    const [s1a, s1b] = CORNERS[f];
    const [s2a] = CORNERS[(f + 1) % 4];
    const sharedX = s1a === s2a; // face plane x = s1a*fa (leaning slightly)
    const arch = new THREE.Mesh(archGeo, mats.iron);
    const outline = new THREE.Mesh(archHullGeo, hullIron);
    for (const m of [arch, outline]) {
      if (sharedX) {
        m.position.set(s1a * fa, 15.2, 0);
        m.rotation.y = Math.PI / 2;
      } else {
        m.position.set(0, 15.2, s1b * fa);
      }
      m.castShadow = m === arch;
      m.receiveShadow = m === arch;
      g.add(m);
    }
  }

  // ---- Platforms -------------------------------------------------------------
  const railSide = (s, a, half) =>
    s === 0 ? [a, half] : s === 1 ? [half, a] : s === 2 ? [a, -half] : [-half, a];

  function railing(minor, half, y0) {
    const steps = 10;
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i <= steps; i++) {
        const a = -half + (i * half * 2) / steps;
        const [x, z] = railSide(s, a, half);
        minor.add(x, y0, z, x, y0 + 1.0, z, 0.09);
      }
      const [x1, z1] = railSide(s, -half, half);
      const [x2, z2] = railSide(s, half, half);
      minor.add(x1, y0 + 1.02, z1, x2, y0 + 1.02, z2, 0.13);
      minor.add(x1, y0 + 0.55, z1, x2, y0 + 0.55, z2, 0.08);
    }
  }

  function slab(half, y, thick, mat) {
    const geo = new THREE.BoxGeometry(half * 2, thick, half * 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    const o = new THREE.Mesh(geo, hullIron);
    o.position.y = y;
    g.add(o);
    return m;
  }

  function pavilion(x, z, y0, w, h, d, wallMat, roofMat) {
    const grp = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    box.position.y = h / 2;
    box.castShadow = box.receiveShadow = true;
    grp.add(box);
    const hull = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hullIron);
    hull.position.y = h / 2;
    grp.add(hull);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.74, h * 0.6, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = h + h * 0.3;
    roof.castShadow = true;
    grp.add(roof);
    const rhull = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.74, h * 0.6, 4), hullIron);
    rhull.rotation.y = Math.PI / 4;
    rhull.position.y = h + h * 0.3;
    grp.add(rhull);
    grp.position.set(x, y0, z);
    g.add(grp);
    return grp;
  }

  // First platform
  slab(8.6, 22.2, 1.3, mats.deck);
  slab(9.0, 21.5, 0.45, mats.deckTrim);
  railing(minor, 8.3, 22.85);
  pavilion(-4.6, 2.8, 22.85, 4.4, 2.6, 3.2, mats.wall, mats.roof);
  pavilion(4.6, -2.8, 22.85, 4.4, 2.6, 3.2, mats.wall2, mats.roof2);

  // Second platform
  slab(5.0, 42.2, 1.1, mats.deck);
  slab(5.35, 41.65, 0.4, mats.deckTrim);
  railing(minor, 4.75, 42.75);
  pavilion(-1.5, 1.5, 42.75, 2.8, 2.0, 2.8, mats.wall3, mats.roof3);

  // Summit platform + cabin + antenna
  slab(2.2, 66.4, 0.9, mats.deck);
  railing(minor, 1.95, 66.85);

  const cabin = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 1.5, 10), mats.wall);
  cabin.position.y = 67.6; cabin.castShadow = true; g.add(cabin);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.9, 10), mats.roof);
  cap.position.y = 68.8; cap.castShadow = true; g.add(cap);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 7.2, 6), mats.iron);
  ant.position.y = 72.9; ant.castShadow = true; g.add(ant);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mats.beacon);
  beacon.position.y = 76.85; g.add(beacon);

  // ---- Flags on the first platform -------------------------------------------
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.09, 3.4, 6);
  for (const [px, pz, rot] of [[-7.4, 7.4, Math.PI * 0.25], [7.4, -7.4, Math.PI * 1.25]]) {
    const pole = new THREE.Mesh(poleGeo, mats.iron);
    pole.position.set(px, 24.55, pz);
    pole.castShadow = true;
    g.add(pole);
    const ph = new THREE.Mesh(poleGeo, hullIron);
    ph.position.copy(pole.position);
    g.add(ph);
    const flagGeo = new THREE.PlaneGeometry(3.2, 2.0, 16, 4);
    flagGeo.translate(1.6, 0, 0);
    const flag = new THREE.Mesh(flagGeo, mats.flag);
    flag.position.set(px, 25.7, pz);
    flag.rotation.y = rot;
    flag.castShadow = true;
    g.add(flag);
  }

  scene.add(g);
  return { group: g, beacon };
}