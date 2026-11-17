import * as THREE from 'three';
import { UP, barGeo, boxGeo, merge, makeMonotone } from './utils.js';
import { toon, bind, addShell } from './materials.js';

// Leg centerline radius over height (metres). The signature Eiffel curve.
const r = makeMonotone([
  [0, 55], [28, 42], [57.6, 31], [85, 24], [115.7, 17.5],
  [150, 13.6], [200, 10.3], [250, 8.1], [276.1, 7.3],
]);

// Thickness multiplier used to build the shadow-proxy lattice (see below).
let barScale = 1;
function bar(p1, p2, w, d) {
  return barGeo(p1, p2, w * barScale, d * barScale);
}

/** Square-section lattice truss following a list of stations. */
function truss(stations, out, o) {
  const rail = o.rail ?? 0.55, ring = o.ring ?? 0.4, brace = o.brace ?? 0.38;
  const corners = (st) => {
    const h = st.s / 2;
    return [
      st.p.clone().addScaledVector(st.u, h).addScaledVector(st.v, h),
      st.p.clone().addScaledVector(st.u, -h).addScaledVector(st.v, h),
      st.p.clone().addScaledVector(st.u, -h).addScaledVector(st.v, -h),
      st.p.clone().addScaledVector(st.u, h).addScaledVector(st.v, -h),
    ];
  };
  for (let j = 0; j < stations.length; j++) {
    const c = corners(stations[j]);
    for (let i = 0; i < 4; i++) out.push(bar(c[i], c[(i + 1) % 4], ring, ring));
    if (j === stations.length - 1) break;
    const c2 = corners(stations[j + 1]);
    for (let i = 0; i < 4; i++) {
      out.push(bar(c[i], c2[i], rail, rail));
      if (o.braces !== false) {
        out.push(bar(c[i], c2[(i + 1) % 4], brace, brace));
        out.push(bar(c[(i + 1) % 4], c2[i], brace, brace));
      }
    }
  }
}

function legStations(y0, y1, n, sx, sz) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const y = y0 + (y1 - y0) * (i / n);
    const rad = r(y);
    const u = new THREE.Vector3(sx, 0, sz).normalize();
    out.push({
      p: new THREE.Vector3(sx * rad, y, sz * rad),
      u,
      v: new THREE.Vector3(u.z, 0, -u.x),
      s: 8 - (y / 114) * 2.4,
    });
  }
  return out;
}

function shaftStations(y0, y1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const y = y0 + (y1 - y0) * (i / n);
    out.push({
      p: new THREE.Vector3(0, y, 0),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 0, 1),
      s: 2 * r(y) * 0.88,
    });
  }
  return out;
}

/** Big X-bracing spanning between two legs on one face (two bays + mid ring). */
function addFaceX(y1, y2, n, t, out) {
  const off = (y) => r(y) - 4.5;
  const ym = (y1 + y2) / 2;
  const mA = new THREE.Vector3().copy(t).multiplyScalar(-off(ym))
    .addScaledVector(n, off(ym)).setY(ym);
  const mB = mA.clone().negate().setY(ym);
  out.push(bar(mA, mB, 0.9, 0.9));
  for (const [ya, yb] of [[y1, ym], [ym, y2]]) {
    const a = new THREE.Vector3().copy(t).multiplyScalar(-off(ya))
      .addScaledVector(n, off(ya)).setY(ya);
    const b = new THREE.Vector3().copy(t).multiplyScalar(off(yb))
      .addScaledVector(n, off(yb)).setY(yb);
    out.push(bar(a, b, 0.9, 0.9));
    out.push(bar(a.clone().negate().setY(ya), b.clone().negate().setY(yb), 0.9, 0.9));
  }
}

/** The decorative arch under the first platform, on one face. */
function addArch(n, t, out) {
  const ys = 22, yTop = 55.4;
  const xs = r(ys) - 4;
  const yc = (yTop * yTop - xs * xs - ys * ys) / (2 * (yTop - ys));
  const R = yTop - yc;
  const a0 = Math.atan2(ys - yc, xs);
  const SEG = 16;
  const pts = [], pts2 = [];
  for (let i = 0; i <= SEG; i++) {
    const th = a0 + (Math.PI - 2 * a0) * (i / SEG);
    const x = R * Math.cos(th);
    const y = yc + R * Math.sin(th);
    const zoff = r(y) - 4.5;
    pts.push(new THREE.Vector3().copy(t).multiplyScalar(x).addScaledVector(n, zoff).setY(y));
    const x2 = (R - 5) * Math.cos(th);
    const y2 = yc + (R - 5) * Math.sin(th);
    pts2.push(new THREE.Vector3().copy(t).multiplyScalar(x2).addScaledVector(n, zoff).setY(y2));
  }
  for (let i = 0; i < SEG; i++) {
    out.push(bar(pts[i], pts[i + 1], 1.5, 2.4));
    out.push(bar(pts2[i], pts2[i + 1], 1.3, 2.2));
    if (i % 3 === 2) out.push(bar(pts[i], pts2[i], 0.8, 1.6));
  }
}

/** Railing: posts + two rails around a square platform edge. */
function railing(half, y, out) {
  const postH = 3.4;
  const sides = [
    [new THREE.Vector3(-half, y, half), new THREE.Vector3(half, y, half)],
    [new THREE.Vector3(half, y, half), new THREE.Vector3(half, y, -half)],
    [new THREE.Vector3(half, y, -half), new THREE.Vector3(-half, y, -half)],
    [new THREE.Vector3(-half, y, -half), new THREE.Vector3(-half, y, half)],
  ];
  for (const [a, b] of sides) {
    const len = a.distanceTo(b);
    const nPosts = Math.max(2, Math.round(len / 4.2));
    for (let i = 0; i <= nPosts; i++) {
      const p = a.clone().lerp(b, i / nPosts);
      const top = p.clone().setY(y + postH);
      out.push(bar(p, top, 0.16, 0.16));
    }
    const ra = a.clone().setY(y + postH - 0.1);
    const rb = b.clone().setY(y + postH - 0.1);
    out.push(bar(ra, rb, 0.3, 0.3));
    const ma = a.clone().setY(y + 1.8);
    const mb = b.clone().setY(y + 1.8);
    out.push(bar(ma, mb, 0.18, 0.18));
  }
}

/** Build all tower geometry into the given lists. */
function buildInto(L) {
  // four curved lattice legs, lower section (dark) + upper section (mid)
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    truss(legStations(0, 57.6, 8, sx, sz), L.darkBars, { rail: 0.6, ring: 0.42, brace: 0.4 });
    truss(legStations(57.6, 114, 7, sx, sz), L.midBars, { rail: 0.55, ring: 0.4, brace: 0.38 });
    // anchor block at the foot
    L.darkSolid.push(boxGeo(11, 2.6, 11, sx * 55, 1.0, sz * 55, Math.PI / 4));
  }

  // central shaft
  truss(shaftStations(112, 230, 10), L.midBars, { rail: 0.5, ring: 0.38, brace: 0.34 });
  truss(shaftStations(230, 277, 5), L.lightBars, { rail: 0.45, ring: 0.34, brace: 0.3 });

  // face bracing: big X-braces + decorative arches
  for (const n of [new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0)]) {
    const t = new THREE.Vector3().crossVectors(UP, n);
    addFaceX(14, 52, n, t, L.darkBars);
    addFaceX(66, 106, n, t, L.darkBars);
    addArch(n, t, L.darkBars);
  }

  // first platform (57.6 m)
  L.darkSolid.push(boxGeo(74, 3.4, 74, 0, 56.1, 0));
  L.creamSolid.push(boxGeo(76, 3, 76, 0, 53.2, 0));
  L.goldBars.push(boxGeo(76.8, 0.9, 76.8, 0, 51.6, 0));
  railing(35.5, 57.8, L.goldBars);

  // second platform (115.7 m)
  L.darkSolid.push(boxGeo(43, 3, 43, 0, 116, 0));
  L.creamSolid.push(boxGeo(44.5, 2.6, 44.5, 0, 113.6, 0));
  railing(21.5, 117.5, L.goldBars);

  // third platform + summit cab (276 m)
  L.darkSolid.push(boxGeo(19, 2.4, 19, 0, 276.5, 0));
  railing(9.4, 277.7, L.goldBars);
  L.creamSolid.push(boxGeo(13, 5, 13, 0, 280.8, 0));
  L.goldBars.push(boxGeo(13.6, 0.8, 13.6, 0, 283.5, 0));

  // campanile above the summit
  const camSt = [];
  for (let i = 0; i <= 4; i++) {
    const y = 283.5 + (307 - 283.5) * (i / 4);
    camSt.push({
      p: new THREE.Vector3(0, y, 0),
      u: new THREE.Vector3(1, 0, 0),
      v: new THREE.Vector3(0, 0, 1),
      s: 9 - ((y - 283.5) / (307 - 283.5)) * 4.5,
    });
  }
  truss(camSt, L.lightBars, { rail: 0.4, ring: 0.3, brace: 0.28 });

  // antenna
  const ant = new THREE.CylinderGeometry(0.45, 0.85, 23, 6);
  ant.translate(0, 318.5, 0);
  L.lightBars.push(ant);
}

export function buildTower() {
  const mats = {
    dark: toon('#6d3f2b', { rimStrength: 0.25 }),
    mid: toon('#8a4f33', { rimStrength: 0.25 }),
    light: toon('#a8623c', { rimStrength: 0.3 }),
    gold: toon('#e8b04b', { rimStrength: 0.3 }),
    cream: toon('#f2e3c0', { rimStrength: 0.15 }),
  };
  bind(mats.dark, 'towerDark');
  bind(mats.mid, 'towerMid');
  bind(mats.light, 'towerLight');
  bind(mats.gold, 'gold');
  bind(mats.cream, 'cream');

  const L = { darkBars: [], darkSolid: [], midBars: [], lightBars: [], goldBars: [], creamSolid: [] };
  barScale = 1;
  buildInto(L);

  const group = new THREE.Group();
  const parts = [
    [L.darkBars, mats.dark, 0.16],
    [L.darkSolid, mats.dark, 0.45],
    [L.midBars, mats.mid, 0.16],
    [L.lightBars, mats.light, 0.15],
    [L.goldBars, mats.gold, 0.18],
    [L.creamSolid, mats.cream, 0.35],
  ];
  for (const [list, mat, t] of parts) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(merge(list), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    addShell(mesh, t);
    group.add(mesh);
  }

  // Shadow-proxy lattice: the visual bars are thin, so their hard shadows
  // alias into speckle. These fatter twins render no colour but cast clean,
  // slightly chunkier lattice shadows that read as lace.
  const P = { darkBars: [], darkSolid: [], midBars: [], lightBars: [], goldBars: [], creamSolid: [] };
  barScale = 1.9;
  buildInto(P);
  barScale = 1;
  const shadowMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  for (const list of [P.darkBars, P.midBars, P.lightBars, P.goldBars]) {
    if (!list.length) continue;
    const mesh = new THREE.Mesh(merge(list), shadowMat);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    group.add(mesh);
  }

  // beacon on the tip
  const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff4136' });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 12, 8), beaconMat);
  beacon.position.set(0, 331, 0);
  group.add(beacon);

  return { group, beaconMat };
}