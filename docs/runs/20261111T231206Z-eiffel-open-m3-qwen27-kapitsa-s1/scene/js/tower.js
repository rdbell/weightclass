import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonMat, setRim, addThickness, paintGeo, GRADIENTS, glowTexture } from './toon.js';

// ---------------------------------------------------------------- profile
// Half-width of the tower "square" at height y (metres). Curved, tapering.
function halfWidth(y) {
  if (y <= 60) { const t = 1 - y / 60; return 29 + 28 * Math.pow(t, 1.55); }
  if (y <= 115) { const t = 1 - (y - 60) / 55; return 17 + 12 * Math.pow(t, 1.3); }
  if (y <= 276) { const t = 1 - (y - 115) / 161; return 6.5 + 10.5 * Math.pow(t, 1.15); }
  if (y <= 320) { const t = 1 - (y - 276) / 44; return 2.6 + 3.9 * Math.pow(t, 1.2); }
  return 2.2;
}

function colRadius(y) {
  if (y < 60) return 1.7 - 0.6 * (y / 60);
  if (y < 115) return 1.1 - 0.35 * ((y - 60) / 55);
  if (y < 276) return 0.75 - 0.3 * ((y - 115) / 161);
  if (y < 320) return 0.45 - 0.15 * ((y - 276) / 44);
  return 0.3;
}

// ---------------------------------------------------------------- member helpers
const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _s = new THREE.Vector3(1, 1, 1);

function orient(geo, a, b) {
  _dir.subVectors(b, a);
  const len = _dir.length();
  if (len < 0.05) return null;
  _dir.normalize();
  _q.setFromUnitVectors(UP, _dir);
  _mid.addVectors(a, b).multiplyScalar(0.5);
  _m.compose(_mid, _q, _s);
  geo.applyMatrix4(_m);
  return geo;
}

// Round rod between two points (tapered cylinder, open ended).
function member(geos, a, b, rA, rB, radial = 4, thickness = 0.32) {
  const len = a.distanceTo(b);
  if (len < 0.05) return;
  const g = new THREE.CylinderGeometry(rB, rA, len, radial, 1, true);
  orient(g, a, b);
  addThickness(g, thickness);
  geos.push(g);
}

// Square iron beam between two points.
function beam(geos, a, b, size, thickness = 0.28) {
  const len = a.distanceTo(b);
  if (len < 0.05) return;
  const g = new THREE.BoxGeometry(size, len, size);
  orient(g, a, b);
  addThickness(g, thickness);
  geos.push(g);
}

// ---------------------------------------------------------------- lattice
const CORNERS = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
const _A = new THREE.Vector3();
const _B = new THREE.Vector3();
const _A2 = new THREE.Vector3();
const _B2 = new THREE.Vector3();

function cornerAt(signs, y, out) {
  const h = halfWidth(y);
  out.set(signs[0] * h, y, signs[1] * h);
  return out;
}

function braceSection(geos, cA, cB, y0, y1, railYs, nXOf, railSize, midVerticals) {
  const levels = [y0, ...railYs, y1];
  for (const y of railYs) {
    cornerAt(cA, y, _A);
    cornerAt(cB, y, _B);
    const w = _A.distanceTo(_B);
    beam(geos, _A, _B, Math.min(1.1, 0.45 + w * 0.012), 0.26);
  }
  for (let i = 0; i < levels.length - 1; i++) {
    const by0 = levels[i];
    const by1 = levels[i + 1];
    cornerAt(cA, by0, _A);
    cornerAt(cB, by0, _B);
    cornerAt(cA, by1, _A2);
    cornerAt(cB, by1, _B2);
    const w = _A.distanceTo(_B);
    const nX = nXOf(w, by0);
    for (let k = 0; k < nX; k++) {
      const t0 = k / nX;
      const t1 = (k + 1) / nX;
      const a0 = _A.clone().lerp(_B, t0);
      const a1 = _A.clone().lerp(_B, t1);
      const b0 = _A2.clone().lerp(_B2, t0);
      const b1 = _A2.clone().lerp(_B2, t1);
      const r0 = THREE.MathUtils.lerp(0.55, 0.2, by0 / 320);
      const r1 = THREE.MathUtils.lerp(0.55, 0.2, by1 / 320);
      member(geos, a0, b1, r0, r1, 4, 0.3);
      member(geos, b0, a1, r0, r1, 4, 0.3);
    }
    if (midVerticals) {
      const vm0 = _A.clone().lerp(_B, 0.5);
      const vm1 = _A2.clone().lerp(_B2, 0.5);
      member(geos, vm0, vm1, railSize * 0.7, railSize * 0.7, 4, 0.26);
    }
  }
}

function buildLattice(geos) {
  // Corner columns (the four curved legs continuing into the body).
  for (const c of CORNERS) {
    const pts = [];
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const y = (i / N) * 320;
      pts.push(new THREE.Vector3(c[0] * halfWidth(y), y, c[1] * halfWidth(y)));
    }
    for (let i = 0; i < N; i++) {
      member(geos, pts[i], pts[i + 1], colRadius(pts[i].y), colRadius(pts[i + 1].y), 6, 0.5);
    }
    // Stone foot at the base.
    const foot = new THREE.BoxGeometry(8, 3.2, 8);
    foot.translate(c[0] * halfWidth(0.5), 1.6, c[1] * halfWidth(0.5));
    addThickness(foot, 0.4);
    geos.push(foot);
  }

  const faces = [[0, 1], [1, 2], [2, 3], [3, 0]];
  for (const [iA, iB] of faces) {
    const cA = CORNERS[iA];
    const cB = CORNERS[iB];
    // Lower section: big shallow X's between the legs.
    braceSection(geos, cA, cB, 0, 60, [10, 21, 32, 43, 54], () => 1, 0.9, false);
    // Second section.
    braceSection(geos, cA, cB, 60, 115, [68.5, 77, 85.5, 94, 102.5, 111], (w) => (w > 40 ? 2 : 1), 0.65, false);
    // Long middle section: fine lattice.
    const rails3 = [];
    for (let y = 125; y < 276; y += 10) rails3.push(y);
    braceSection(geos, cA, cB, 115, 276, rails3, () => 1, 0.5, true);
    // Spire.
    braceSection(geos, cA, cB, 276, 320, [283, 290, 297, 304, 311, 317], () => 1, 0.38, true);
  }
}

// ---------------------------------------------------------------- platforms
function balustrade(geos, half, y, step) {
  const h = 1.35;
  const n = Math.max(2, Math.round((half * 2) / step));
  const posts = [];
  for (let side = 0; side < 4; side++) {
    for (let i = 0; i < n; i++) {
      const s = ((i + 0.5) / n - 0.5) * (half * 2 - 0.7);
      let px, pz;
      if (side === 0) { px = s; pz = half; }
      else if (side === 1) { px = half; pz = s; }
      else if (side === 2) { px = -s; pz = -half; }
      else { px = -half; pz = -s; }
      const g = new THREE.BoxGeometry(0.3, h, 0.3);
      g.translate(px, y + h / 2, pz);
      addThickness(g, 0.22);
      posts.push(g);
    }
  }
  geos.push(...posts);
  // Top + mid rails.
  for (const [ry, rs] of [[y + h, 0.3], [y + h * 0.55, 0.18]]) {
    for (let side = 0; side < 4; side++) {
      const g = side < 2
        ? new THREE.BoxGeometry(half * 2 + 0.7, rs, 0.36)
        : new THREE.BoxGeometry(0.36, rs, half * 2 + 0.7);
      if (side === 0) g.translate(0, ry, half);
      else if (side === 1) g.translate(half, ry, 0);
      else if (side === 2) g.translate(0, ry, -half);
      else g.translate(-half, ry, 0);
      addThickness(g, 0.22);
      geos.push(g);
    }
  }
}

function slab(geos, half, y, th, thickness = 0.45) {
  const g = new THREE.BoxGeometry(half * 2, th, half * 2);
  g.translate(0, y, 0);
  addThickness(g, thickness);
  geos.push(g);
}

function pyramid(geos, half, y, h, thickness = 0.35) {
  const g = new THREE.ConeGeometry(half * Math.SQRT2, h, 4, 1, false);
  g.rotateY(Math.PI / 4);
  g.translate(0, y + h / 2, 0);
  addThickness(g, thickness);
  geos.push(g);
}

function windowRow(geos, half, cy, th) {
  const qw = 1.35;
  const qh = 1.05;
  const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [nx, nz] of faces) {
    const count = Math.max(1, Math.floor((half * 2 - 2.5) / 2.3));
    for (let i = 0; i < count; i++) {
      const off = ((i + 0.5) / count - 0.5) * (half * 2 - 2.2);
      const g = new THREE.PlaneGeometry(qw, qh);
      if (nx > 0) { g.rotateY(Math.PI / 2); g.translate(half + 0.08, cy, off); }
      else if (nx < 0) { g.rotateY(-Math.PI / 2); g.translate(-half - 0.08, cy, off); }
      else if (nz > 0) { g.translate(off, cy, half + 0.08); }
      else { g.rotateY(Math.PI); g.translate(off, cy, -half - 0.8); }
      geos.push(g);
    }
  }
}

// ---------------------------------------------------------------- build
export function buildTower(ctx) {
  const { rng, outlineMat, glow } = ctx;

  const ironGeos = [];
  buildLattice(ironGeos);

  // Antenna
  {
    const a0 = new THREE.Vector3(0, 329.5, 0);
    const a1 = new THREE.Vector3(0, 338, 0);
    member(ironGeos, a0, a1, 0.55, 0.12, 6, 0.25);
    for (const y of [331.5, 333.5, 335.5]) {
      const g = new THREE.CylinderGeometry(0.9, 0.9, 0.3, 8, 1, true);
      g.translate(0, y, 0);
      addThickness(g, 0.2);
      ironGeos.push(g);
    }
  }

  // Platforms (iron parts: balustrades)
  balustrade(ironGeos, 32, 59.2, 4);   // 1st floor
  balustrade(ironGeos, 25, 114.4, 4);  // 2nd floor
  balustrade(ironGeos, 10.5, 275.6, 2.6); // 3rd floor
  balustrade(ironGeos, 5.5, 322.2, 2.4); // top

  // Platform solids
  const platGeos = [];
  slab(platGeos, 32, 57.5, 3.5);
  slab(platGeos, 35, 55.2, 1.6, 0.35);
  slab(platGeos, 25, 113.6, 1.6, 0.35);
  slab(platGeos, 21, 115.5, 3);
  slab(platGeos, 10.5, 274.9, 1.4, 0.3);
  slab(platGeos, 8, 276.5, 3.5, 0.3);
  slab(platGeos, 5.5, 321, 2.5, 0.3);
  // Central structures + roofs
  {
    const g = new THREE.BoxGeometry(20, 5, 20); g.translate(0, 119, 0); addThickness(g, 0.4); platGeos.push(g);
    pyramid(platGeos, 15, 121.5, 6);
    const g2 = new THREE.BoxGeometry(13, 5, 13); g2.translate(0, 281, 0); addThickness(g2, 0.35); platGeos.push(g2);
    pyramid(platGeos, 8, 283.5, 6, 0.3);
    const g3 = new THREE.BoxGeometry(8, 5, 8); g3.translate(0, 325.5, 0); addThickness(g3, 0.3); platGeos.push(g3);
    pyramid(platGeos, 5, 328, 5, 0.28);
  }

  // Windows + garland
  const windowGeos = [];
  windowRow(windowGeos, 10, 119, 5);
  windowRow(windowGeos, 6.5, 281, 5);
  windowRow(windowGeos, 4, 325.5, 5);
  const garlandGeos = [];
  {
    const half = 34.5;
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < 10; i++) {
        const s = ((i + 0.5) / 10 - 0.5) * (half * 2 - 1.5);
        let px, pz;
        if (side === 0) { px = s; pz = half; }
        else if (side === 1) { px = half; pz = s; }
        else if (side === 2) { px = -s; pz = -half; }
        else { px = -half; pz = -s; }
        const g = new THREE.IcosahedronGeometry(0.55, 0);
        g.translate(px, 55.6, pz);
        garlandGeos.push(g);
      }
    }
  }

  // Merge
  const ironGeo = mergeGeometries(ironGeos, false);
  const platGeo = mergeGeometries(platGeos, false);
  const windowGeo = mergeGeometries(windowGeos, false);
  const garlandGeo = mergeGeometries(garlandGeos, false);

  // Materials
  const iron = toonMat({ color: 0x9a5f36, gradient: GRADIENTS.g4, rimColor: 0xffe2b0, rimStrength: 0.2, rimPower: 2.2 });
  const plat = toonMat({ color: 0xa86e42, gradient: GRADIENTS.g3, rimColor: 0xffe2b0, rimStrength: 0.16, rimPower: 2.4 });
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x28303e, toneMapped: false });
  const garlandMat = new THREE.MeshBasicMaterial({ color: 0x28303e, toneMapped: false });
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff5a4a, toneMapped: false });

  // Meshes
  const ironMesh = new THREE.Mesh(ironGeo, iron);
  ironMesh.castShadow = true;
  ironMesh.receiveShadow = true;
  const ironOutline = new THREE.Mesh(ironGeo, outlineMat);
  ironOutline.castShadow = false;

  const platMesh = new THREE.Mesh(platGeo, plat);
  platMesh.castShadow = true;
  platMesh.receiveShadow = true;
  const platOutline = new THREE.Mesh(platGeo, outlineMat);

  const windowMesh = new THREE.Mesh(windowGeo, windowMat);
  const garlandMesh = new THREE.Mesh(garlandGeo, garlandMat);

  const beaconMesh = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), beaconMat);
  beaconMesh.position.set(0, 338.6, 0);

  const beaconSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glow ? glow : glowTexture([255, 90, 70]),
    color: 0xff5a4a,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    opacity: 0,
    fog: false,
  }));
  beaconSprite.position.copy(beaconMesh.position);
  beaconSprite.scale.setScalar(26);

  const beaconLight = new THREE.PointLight(0xff5a4a, 0, 260, 2);
  beaconLight.position.copy(beaconMesh.position);

  const baseLight = new THREE.PointLight(0xff9a3d, 0, 320, 2);
  baseLight.position.set(0, 10, 0);

  const group = new THREE.Group();
  group.add(ironMesh, ironOutline, platMesh, platOutline, windowMesh, garlandMesh, beaconMesh, beaconSprite, beaconLight, baseLight);

  let beaconBase = 0.15;

  function apply(p) {
    iron.color.copy(p.ironColor);
    iron.emissive.copy(p.ironEmissive);
    iron.emissiveIntensity = p.ironEmissiveI;
    setRim(iron, p.ironRim, p.ironRimI);
    plat.color.copy(p.platColor);
    plat.emissive.copy(p.ironEmissive);
    plat.emissiveIntensity = p.ironEmissiveI * 0.7;
    setRim(plat, p.platRim, p.platRimI);
    windowMat.color.copy(p.windowColor);
    garlandMat.color.copy(p.windowColor);
    baseLight.intensity = p.baseLightI * 2600;
    beaconBase = p.beaconI;
  }

  function anim(t, dt, p) {
    const blink = Math.pow(Math.max(0, Math.sin(t * 2.4)), 3);
    const b = beaconBase * (0.2 + 0.8 * blink);
    beaconMat.color.setRGB(1, 0.32, 0.26).multiplyScalar(0.25 + 0.9 * b);
    beaconSprite.material.opacity = beaconBase * (0.15 + 0.85 * blink);
    beaconSprite.scale.setScalar(18 + 14 * blink);
    beaconLight.intensity = beaconBase * 5000 * blink;
    const tw = 0.85 + 0.15 * Math.sin(t * 3.1);
    garlandMat.color.copy(p.windowColor).multiplyScalar(tw);
  }

  return { group, apply, anim };
}
