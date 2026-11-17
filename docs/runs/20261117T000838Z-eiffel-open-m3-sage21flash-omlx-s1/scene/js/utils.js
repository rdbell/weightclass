import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export const UP = new THREE.Vector3(0, 1, 0);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _dir = new THREE.Vector3();

/** A thin box stretched between two points (the workhorse for lattice trusses). */
export function barGeo(p1, p2, w, d) {
  _dir.subVectors(p2, p1);
  const len = Math.max(_dir.length(), 1e-4);
  const g = new THREE.BoxGeometry(w, len, d);
  _dir.normalize();
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, _dir));
  g.translate((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, (p1.z + p2.z) / 2);
  return g;
}

export function boxGeo(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

/** Merge a pile of geometries (normalizing indexed / non-indexed). */
export function merge(geos) {
  const list = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const out = BufferGeometryUtils.mergeGeometries(list, false);
  list.forEach((g) => g.dispose());
  geos.forEach((g) => g.dispose());
  return out;
}

/**
 * Inverted-hull outline geometry: weld the source (so hard box corners get
 * smooth normals), then push every vertex outward along its normal.
 * Baked once on the CPU so every shell can share a single material.
 */
export function shellGeometry(geo, thickness) {
  let g = geo.clone();
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  g = BufferGeometryUtils.mergeVertices(g, 1e-2);
  g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i,
      pos.getX(i) + nor.getX(i) * thickness,
      pos.getY(i) + nor.getY(i) * thickness,
      pos.getZ(i) + nor.getZ(i) * thickness);
  }
  return g;
}

/** Monotone cubic interpolation through [x, y] control points. */
export function makeMonotone(pts) {
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const dxs = [], ms = [];
  for (let i = 0; i < n - 1; i++) {
    dxs.push(xs[i + 1] - xs[i]);
    ms.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  }
  const c1 = [ms[0]];
  for (let i = 0; i < n - 2; i++) {
    const m0 = ms[i], m1 = ms[i + 1];
    if (m0 * m1 <= 0) c1.push(0);
    else {
      const dx0 = dxs[i], dx1 = dxs[i + 1], common = dx0 + dx1;
      c1.push(3 * common / ((common + dx1) / m0 + (common + dx0) / m1));
    }
  }
  c1.push(ms[n - 2]);
  const c2 = [], c3 = [];
  for (let i = 0; i < n - 1; i++) {
    const inv = 1 / dxs[i];
    const common = c1[i] + c1[i + 1] - 2 * ms[i];
    c2.push((ms[i] - c1[i] - common) * inv);
    c3.push(common * inv * inv);
  }
  return function (x) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= x) lo = mid; else hi = mid;
    }
    const d = x - xs[lo];
    return ys[lo] + d * (c1[lo] + d * (c2[lo] + d * c3[lo]));
  };
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}