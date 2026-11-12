import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ------------------------------------------------------------------ *
 *  Seeded randomness
 * ------------------------------------------------------------------ */
export function makeRng(seed = 1337) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (rng, a, b) => a + (b - a) * rng();
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

/* ------------------------------------------------------------------ *
 *  Geometry collection: build thousands of small pieces, merge by role
 * ------------------------------------------------------------------ */
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class GeoBucket {
  constructor() {
    this.map = new Map();
  }
  add(role, geo, matrix) {
    if (matrix) geo.applyMatrix4(matrix);
    let arr = this.map.get(role);
    if (!arr) this.map.set(role, (arr = []));
    arr.push(geo);
    return geo;
  }
  /** unit box */
  box(role, w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    _m4.compose(
      _v.set(x, y, z),
      _q.setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1)
    );
    return this.add(role, g, _m4);
  }
  cyl(role, rt, rb, h, seg, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1);
    _m4.compose(
      _v.set(x, y, z),
      _q.setFromEuler(new THREE.Euler(rx, ry, rz)),
      new THREE.Vector3(1, 1, 1)
    );
    return this.add(role, g, _m4);
  }
  sphere(role, r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 10) {
    const g = new THREE.SphereGeometry(r, seg, Math.max(5, seg >> 1));
    _m4.compose(
      _v.set(x, y, z),
      _q.identity(),
      new THREE.Vector3(sx, sy, sz)
    );
    return this.add(role, g, _m4);
  }
  ico(role, r, x, y, z, sx = 1, sy = 1, sz = 1) {
    const g = new THREE.IcosahedronGeometry(r, 0);
    _m4.compose(
      _v.set(x, y, z),
      _q.identity(),
      new THREE.Vector3(sx, sy, sz)
    );
    return this.add(role, g, _m4);
  }
  /** box beam between two points */
  beam(role, a, b, thick, depth = thick) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-5) return;
    const g = new THREE.BoxGeometry(thick, len, depth);
    _q.setFromUnitVectors(_up, dir.normalize());
    _m4.compose(_v.addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
    return this.add(role, g, _m4);
  }
  /** tube beam between two points (round, for cables etc.) */
  tube(role, a, b, radius, seg = 5) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len < 1e-5) return;
    const g = new THREE.CylinderGeometry(radius, radius, len, seg, 1);
    _q.setFromUnitVectors(_up, dir.normalize());
    _m4.compose(_v.addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
    return this.add(role, g, _m4);
  }
  merge() {
    const out = new Map();
    for (const [role, arr] of this.map) {
      if (!arr.length) continue;
      // Mixing indexed and non-indexed geometry is not allowed by the merger.
      // Normalising everything to non-indexed also guarantees flat faceting.
      const prepared = arr.map((g) => (g.index ? g.toNonIndexed() : g));
      const attrNames = ['position', 'normal', 'uv'];
      for (const g of prepared) {
        if (!g.getAttribute('uv')) {
          g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
        }
        for (const n of attrNames) {
          if (!g.getAttribute(n)) g.deleteAttribute(n);
        }
      }
      const merged = mergeGeometries(prepared, false);
      if (merged) {
        merged.computeBoundingSphere();
        out.set(role, merged);
      } else {
        console.warn('merge failed for role', role, prepared.length);
      }
      arr.forEach((g) => g.dispose());
      prepared.forEach((g) => { if (!arr.includes(g)) g.dispose(); });
    }
    this.map.clear();
    return out;
  }
}

/** Merge geometries that all share attributes, returning one geometry. */
export function mergeAll(arr) {
  if (!arr.length) return null;
  const prepared = arr.map((g) => (g.index ? g.toNonIndexed() : g));
  const attrNames = ['position', 'normal', 'uv'];
  for (const g of prepared) {
    if (!g.getAttribute('uv')) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count * 2), 2));
    }
    for (const n of attrNames) if (!g.getAttribute(n)) g.deleteAttribute(n);
  }
  const merged = mergeGeometries(prepared, false);
  arr.forEach((g) => g.dispose());
  prepared.forEach((g) => { if (!arr.includes(g)) g.dispose(); });
  return merged;
}

/* ------------------------------------------------------------------ *
 *  Canvas textures
 * ------------------------------------------------------------------ */
export function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = opts.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.wrapS = opts.wrapS ?? THREE.ClampToEdgeWrapping;
  tex.wrapT = opts.wrapT ?? THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  tex.needsUpdate = true;
  return tex;
}

/** Soft radial glow sprite texture (white core) */
export function glowTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,240,190,0.9)');
    g.addColorStop(0.45, 'rgba(255,190,100,0.28)');
    g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

/** draw a slightly hand-inked rounded rect */
export function inkRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
