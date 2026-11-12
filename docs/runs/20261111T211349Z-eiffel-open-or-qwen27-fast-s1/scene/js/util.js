import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Seeded PRNG so the scene looks identical on every load. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small gradient map for MeshToonMaterial -> hard light bands, no smooth ramps. */
export function makeGradientMap(steps = [0.42, 0.64, 0.85, 1.0]) {
  const data = new Uint8Array(steps.length * 4);
  for (let i = 0; i < steps.length; i++) {
    const v = Math.round(steps[i] * 255);
    data.set([v, v, v, 255], i * 4);
  }
  const tex = new THREE.DataTexture(data, steps.length, 1);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function toonMat(gradientMap, color, extra = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...extra });
}

const _zAxis = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();

/** A box "beam" running from point a to point b with square cross-section t. */
export function beamGeo(a, b, t) {
  const vA = new THREE.Vector3(a[0], a[1], a[2]);
  const vB = new THREE.Vector3(b[0], b[1], b[2]);
  const dir = new THREE.Vector3().subVectors(vB, vA);
  const len = dir.length() || 1e-4;
  _q.setFromUnitVectors(_zAxis, dir.multiplyScalar(1 / len));
  const geo = new THREE.BoxGeometry(t, t, 1);
  geo.translate(0, 0, 0.5);
  geo.applyMatrix4(
    new THREE.Matrix4().compose(vA, _q, new THREE.Vector3(1, 1, len))
  );
  return geo;
}

export function boxGeo(x, y, z, sx, sy, sz) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  geo.translate(x, y, z);
  return geo;
}

export function cylGeo(x, y, z, rTop, rBot, h, seg = 10) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  geo.translate(x, y, z);
  return geo;
}

export function coneGeo(x, y, z, r, h, seg = 10, rotY = 0) {
  const geo = new THREE.ConeGeometry(r, h, seg);
  if (rotY) geo.rotateY(rotY);
  geo.translate(x, y, z);
  return geo;
}

export function icoGeo(x, y, z, r, detail = 0, squash = 1) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  geo.scale(1, squash, 1);
  geo.translate(x, y, z);
  return geo;
}

export function sphereGeo(x, y, z, r, ws = 12, hs = 10) {
  const geo = new THREE.SphereGeometry(r, ws, hs);
  geo.translate(x, y, z);
  return geo;
}

/**
 * A torus arc standing vertically. rotY = 0 keeps it in a z = const plane
 * (spanning x), rotY = +/- PI/2 puts it in an x = const plane (spanning z).
 */
export function archGeo(x, y, z, radius, tube, arc, rotY = 0) {
  const geo = new THREE.TorusGeometry(radius, tube, 10, 26, arc);
  if (rotY) geo.rotateY(rotY);
  geo.translate(x, y, z);
  return geo;
}

/** Merge a list of geometries into one (normalizes indexing first). */
export function merge(list) {
  return mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)), false);
}

/** Classic cartoon ink outline: back faces pushed out along the normal. */
export function outlineMat(inkUniform, thickness) {
  return new THREE.ShaderMaterial({
    uniforms: { uInk: inkUniform, uThick: { value: thickness } },
    side: THREE.BackSide,
    vertexShader: /* glsl */ `
      uniform float uThick;
      void main() {
        vec3 p = position + normal * uThick;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      void main() {
        gl_FragColor = vec4(uInk, 1.0);
      }`,
  });
}

/** Soft radial glow texture for lamps, the sun and the moon. */
export function makeRadialTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
