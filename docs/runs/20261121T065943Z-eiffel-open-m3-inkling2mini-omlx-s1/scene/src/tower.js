import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { taperedTube, beamBetween, toonMaterial } from './toon.js';

/* Eiffel-ish profile: half-width at height y */
export const BASE_W = 36;
export const H_PLAT1 = 36;
export const H_PLAT2 = 63;
export const H_PLAT3 = 97;
export const H_TOP = 110;

export function profileW(y) {
  if (y <= H_PLAT1) {
    const t = y / H_PLAT1;
    return 36 + (17 - 36) * Math.pow(t, 0.72);   // legs: 36 → 17
  } else if (y <= H_PLAT2) {
    const t = (y - H_PLAT1) / (H_PLAT2 - H_PLAT1);
    return 17 + (12 - 17) * (t * t * (3 - 2 * t)); // smoothstep-ish 17 → 12
  } else if (y <= H_PLAT3) {
    const t = (y - H_PLAT2) / (H_PLAT3 - H_PLAT2);
    return 12 + (8 - 12) * t;                      // 12 → 8
  } else {
    const t = (y - H_PLAT3) / (H_TOP - H_PLAT3);
    return 8 + (3.1 - 8) * t;                      // 8 → 3.1
  }
}

function ringStrut(w, y, t) {
  // 4 boxes making a square frame at half-width w, thickness t
  const boxes = [];
  const len = 2 * w + t;
  const g1 = new THREE.BoxGeometry(len, t, t); g1.translate(0, y, w);
  const g2 = new THREE.BoxGeometry(len, t, t); g2.translate(0, y, -w);
  const g3 = new THREE.BoxGeometry(t, t, len); g3.translate(w, y, 0);
  const g4 = new THREE.BoxGeometry(t, t, len); g4.translate(-w, y, 0);
  return [g1, g2, g3, g4];
}

/* build all the ironwork into one geometry (merged) */
function buildLattice(ironGeos) {
  const sections = [
    { a: 3.5, b: 33.2, w: profileW },
    { a: 38.5, b: 60.5, w: profileW },
    { a: 65.5, b: 93.5, w: profileW },
    { a: 99.5, b: 107.5, w: profileW },
  ];
  for (const sec of sections) {
    const span = sec.b - sec.a;
    const nSteps = Math.max(2, Math.round(span / 5.4));
    const step = span / nSteps;
    // horizontal rings
    for (let i = 0; i <= nSteps; i++) {
      const y = sec.a + i * step;
      const w = sec.w(y);
      ironGeos.push(...ringStrut(w, y, 0.85));
    }
    // face diagonals (zig-zag per face, alternating direction)
    for (let i = 0; i < nSteps; i++) {
      const yA = sec.a + i * step;
      const yB = yA + step;
      const wA = sec.w(yA), wB = sec.w(yB);
      const dirA = i % 2 === 0 ? 1 : -1;   // alternate diagonal direction
      // front face (z = +w)
      ironGeos.push(beamBetween(-wA * dirA, yA, wA, wB * dirA, yB, wB, 0.62, 0.78));
      // back face (z = -w)
      ironGeos.push(beamBetween(wA * dirA, yA, -wA, -wB * dirA, yB, -wB, 0.62, 0.78));
      // right face (x = +w)
      ironGeos.push(beamBetween(wA, yA, -wA * dirA, wB, yB, wB * dirA, 0.62, 0.78));
      // left face (x = -w)
      ironGeos.push(beamBetween(-wA, yA, wA * dirA, -wB, yB, -wB * dirA, 0.62, 0.78));
    }
  }
  // base frame ring (thicker)
  const wb = profileW(2.0);
  ironGeos.push(...ringStrut(wb, 2.0, 1.5));

  // the four signature arches (sagging between the legs on each face)
  for (let f = 0; f < 4; f++) {
    const angle = f * Math.PI / 2;
    const c = Math.cos(angle), s = Math.sin(angle);
    // arch local: x from -wA to +wA on the face, sag in the middle
    const wA = profileW(12.5);
    const yEnds = 14.5, sag = 6.5;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = -wA + 2 * wA * t;
      const y = yEnds - sag * 4 * t * (1 - t);
      const w = profileW(y);
      // place on the face surface: local (x, y, w) then rotate by f
      const lx = x, ly = y, lz = w;
      const rx = lx * c - lz * s;
      const rz = lx * s + lz * c;
      pts.push(new THREE.Vector3(rx, ly, rz));
    }
    const archGeo = taperedTube(pts, 1.15, 1.15, 6, 14, 0);
    ironGeos.push(archGeo);
  }
}

/* slim square railing around a platform slab */
function railingGeo(w, y) {
  const t = 0.32;
  const geos = [];
  const half = w + 0.9;   // rail sits on outer lip of the slab
  // top rail
  const len = 2 * half + t;
  const g1 = new THREE.BoxGeometry(len, t, t); g1.translate(0, y + 1.9, half);
  const g2 = new THREE.BoxGeometry(len, t, t); g2.translate(0, y + 1.9, -half);
  const g3 = new THREE.BoxGeometry(t, t, len); g3.translate(half, y + 1.9, 0);
  const g4 = new THREE.BoxGeometry(t, t, len); g4.translate(-half, y + 1.9, 0);
  geos.push(g1, g2, g3, g4);
  // posts
  const corners = [[half, half], [half, -half], [-half, half], [-half, -half]];
  for (const [cx, cz] of corners) {
    const p = new THREE.BoxGeometry(t * 1.2, 1.9, t * 1.2);
    p.translate(cx, y + 0.95, cz);
    geos.push(p);
  }
  // mid-side posts
  const mids = [[0, half], [0, -half], [half, 0], [-half, 0]];
  for (const [cx, cz] of mids) {
    const p = new THREE.BoxGeometry(t * 1.1, 1.9, t * 1.1);
    p.translate(cx, y + 0.95, cz);
    geos.push(p);
  }
  return geos;
}

function windowsGeo(half, slabY, n, geos) {
  const len = 2 * half - 2.4;
  for (let i = 0; i < n; i++) {
    const off = -len / 2 + (len * i) / (n - 1);
    for (const side of [0, 1, 2, 3]) {
      const g = new THREE.BoxGeometry(1.15, 1.5, 0.5);
      if (side === 0) { g.translate(off, slabY, half); }
      else if (side === 1) { g.translate(off, slabY, -half); g.rotateY(Math.PI); }
      else if (side === 2) { g.rotateY(Math.PI / 2); g.translate(half, slabY, off); }
      else { g.rotateY(-Math.PI / 2); g.translate(-half, slabY, off); }
      geos.push(g);
    }
  }
}

export function buildTower(materials) {
  const group = new THREE.Group();

  /* corner legs: 4 tapered tubes from base to top */
  const cornerGeos = [];
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const pts = [];
      const N = 22;
      for (let i = 0; i <= N; i++) {
        const y = (H_TOP * i) / N;
        const w = profileW(y);
        pts.push(new THREE.Vector3(sx * w, y, sz * w));
      }
      const leg = taperedTube(pts, 2.55, 0.72, 10, 44, Math.PI / 4);
      cornerGeos.push(leg);
    }
  }
  const cornerGeo = mergeGeometries(cornerGeos, false);
  const corners = new THREE.Mesh(cornerGeo, materials.iron);
  corners.castShadow = true;
  corners.receiveShadow = true;
  group.add(corners);

  /* lattice: rings + diagonals + arches (one merged mesh) */
  const ironGeos = [];
  buildLattice(ironGeos);
  const latticeGeo = mergeGeometries(ironGeos, false);
  const lattice = new THREE.Mesh(latticeGeo, materials.iron);
  lattice.castShadow = true;
  lattice.receiveShadow = true;
  group.add(lattice);

  /* platforms */
  const slabGeos = [];
  const trussGeos = [];
  const railsGeos = [];
  const windowGeos = [];
  const hutWindowGeos = [];
  const platforms = [
    { y: H_PLAT1, half: 17, slab: 19.6, nWin: 7 },
    { y: H_PLAT2, half: 12, slab: 14.2, nWin: 5 },
    { y: H_PLAT3, half: 8, slab: 10.2, nWin: 4 },
  ];
  for (const p of platforms) {
    const slab = new RoundedBoxGeometry(p.slab * 2, 2.5, p.slab * 2, 2, 0.9);
    slab.translate(0, p.y, 0);
    slabGeos.push(slab);
    const truss = new THREE.BoxGeometry(p.slab * 2 - 1.6, 1.1, p.slab * 2 - 1.6);
    truss.translate(0, p.y - 1.75, 0);
    trussGeos.push(truss);
    railsGeos.push(...railingGeo(p.half, p.y + 1.25));
    windowsGeo(p.slab, p.y, p.nWin, windowGeos);
  }
  const slabs = new THREE.Mesh(mergeGeometries(slabGeos, false), materials.platform);
  slabs.castShadow = true; slabs.receiveShadow = true;
  group.add(slabs);
  const tr = new THREE.Mesh(mergeGeometries(trussGeos, false), materials.iron);
  tr.castShadow = true; tr.receiveShadow = true;
  group.add(tr);
  const rails = new THREE.Mesh(mergeGeometries(railsGeos, false), materials.rail);
  rails.castShadow = true;
  group.add(rails);
  /* crow's nest hut on platform 3 */
  const hutHalf = 2.9;
  const hut = new RoundedBoxGeometry(hutHalf * 2, 3.0, hutHalf * 2, 2, 0.55);
  hut.translate(0, H_PLAT3 + 1.25 + 1.5, 0);
  // hut windows (one per side)
  for (const side of [0, 1, 2, 3]) {
    const g = new THREE.BoxGeometry(1.0, 1.4, 0.4);
    if (side === 0) g.translate(0, H_PLAT3 + 1.25 + 1.5, hutHalf);
    else if (side === 1) { g.rotateY(Math.PI); g.translate(0, H_PLAT3 + 1.25 + 1.5, -hutHalf); }
    else if (side === 2) { g.rotateY(Math.PI / 2); g.translate(hutHalf, H_PLAT3 + 1.25 + 1.5, 0); }
    else { g.rotateY(-Math.PI / 2); g.translate(-hutHalf, H_PLAT3 + 1.25 + 1.5, 0); }
    hutWindowGeos.push(g);
  }
  const windows = new THREE.Mesh(mergeGeometries([...windowGeos, ...hutWindowGeos], false), materials.windows);
  group.add(windows);

  const hutMesh = new THREE.Mesh(hut, materials.hut);
  hutMesh.castShadow = true;
  group.add(hutMesh);
  const roof = new THREE.ConeGeometry(4.3, 2.3, 4);
  roof.rotateY(Math.PI / 4);
  roof.translate(0, H_PLAT3 + 1.25 + 3.0 + 1.15, 0);
  const roofMesh = new THREE.Mesh(roof, materials.roof);
  roofMesh.castShadow = true;
  group.add(roofMesh);

  /* antenna + beacon */
  const antennaPts = [new THREE.Vector3(0, H_TOP - 0.5, 0), new THREE.Vector3(0, H_TOP + 9, 0), new THREE.Vector3(0, H_TOP + 19, 0)];
  const antenna = new THREE.Mesh(taperedTube(antennaPts, 0.95, 0.28, 8, 24, Math.PI / 4), materials.iron);
  antenna.castShadow = true;
  group.add(antenna);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), materials.iron);
  tip.position.set(0, H_TOP + 19.05, 0);
  group.add(tip);

  /* beacon (blinking red) — animated in main.js */
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), materials.beacon);
  beacon.position.set(0, H_TOP + 19.6, 0);
  group.add(beacon);

  /* flag: a small arm jutting from the antenna, flag streaming off it */
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 6.2, 6), materials.rail);
  flagPole.rotation.z = Math.PI / 2;
  flagPole.position.set(3.1, H_TOP + 9.5, 0);
  group.add(flagPole);
  const flagGeo = new THREE.PlaneGeometry(4.3, 2.3, 9, 4);
  flagGeo.translate(2.2, -1.2, 0);
  const flag = new THREE.Mesh(flagGeo, materials.flag);
  flag.position.set(1.45, H_TOP + 9.55, 0);
  group.add(flag);

  group.userData = {
    flag, flagGeo, beacon,
    slabs, railings: rails, windows, hutMesh, roofMesh, corners, lattice, antenna,
  };
  return group;
}
