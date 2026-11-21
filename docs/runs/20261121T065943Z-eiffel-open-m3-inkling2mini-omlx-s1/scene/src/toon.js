import * as THREE from 'three';

/* ---------- seeded random ---------- */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- gradient map for toon shading (hard bands) ---------- */
let _gradientMap = null;
export function getGradientMap() {
  if (_gradientMap) return _gradientMap;
  const steps = new Uint8Array([70, 132, 178, 222, 255]);
  const tex = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _gradientMap = tex;
  return tex;
}

export function toonMaterial(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: getGradientMap(),
    ...opts,
  });
}

/* ---------- ink outline geometry (normal-offset backshell) ---------- */
export const INK = 0x2b2130;
const _inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
export function getInkMaterial() { return _inkMat; }

export function inkGeometry(geometry, thickness = 0.45) {
  const pos = geometry.attributes.position;
  let norm = geometry.attributes.normal;
  if (!norm) {
    geometry.computeVertexNormals();
    norm = geometry.attributes.normal;
  }
  const count = pos.count;
  const p = new Float32Array(count * 3);
  const n = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const nx = norm.getX(i), ny = norm.getY(i), nz = norm.getZ(i);
    p[i * 3] = pos.getX(i) + nx * thickness;
    p[i * 3 + 1] = pos.getY(i) + ny * thickness;
    p[i * 3 + 2] = pos.getZ(i) + nz * thickness;
    n[i * 3] = nx; n[i * 3 + 1] = ny; n[i * 3 + 2] = nz;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  if (geometry.index) g.setIndex(geometry.index.clone());
  return g;
}

export function inkify(geometry, thickness = 0.45) {
  const mesh = new THREE.Mesh(inkGeometry(geometry, thickness), getInkMaterial());
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

/* Add an ink outline as a child of a mesh (keeps the mesh transform). */
export function addOutline(mesh, thickness = 0.45) {
  mesh.add(inkify(mesh.geometry, thickness));
  return mesh;
}

/* ---------- radial-gradient glow texture (drawn once per hue) ---------- */
const _glowTex = new Map();
export function glowTexture(color = '#ffffff', inner = 0.12) {
  const key = color + ':' + inner;
  if (_glowTex.has(key)) return _glowTex.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, color);
  g.addColorStop(inner + 0.18, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _glowTex.set(key, tex);
  return tex;
}

/* soft disc texture for sun/moon — flat face + rim ---------------------------- */
export function discTexture(core, rim, craters = null) {
  const key = 'disc:' + core + rim + (craters || '');
  if (_glowTex.has(key)) return _glowTex.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.arc(128, 128, 108, 0, Math.PI * 2);
  ctx.fillStyle = core;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = rim;
  ctx.stroke();
  if (craters) {
    ctx.fillStyle = rim;
    for (const [cx, cy, r] of craters) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _glowTex.set(key, tex);
  return tex;
}

/* tapered tube along a vertical-ish curve */
export function taperedTube(points, r0, r1, radialSegs = 8, segs = 40, radialStart = 0) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
  const positions = [], normals = [], uvs = [], indices = [];
  const tan = new THREE.Vector3(), normal = new THREE.Vector3(), binormal = new THREE.Vector3(), up = new THREE.Vector3(), dir = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const p = curve.getPoint(t);
    curve.getTangent(t, tan);
    tan.normalize();
    up.set(0, 1, 0);
    if (Math.abs(tan.y) > 0.93) up.set(1, 0, 0);
    binormal.crossVectors(tan, up).normalize();
    normal.crossVectors(binormal, tan).normalize();
    const r = r0 + (r1 - r0) * t;
    for (let j = 0; j < radialSegs; j++) {
      const a = (j / radialSegs) * Math.PI * 2 + radialStart;
      dir.copy(normal).multiplyScalar(Math.cos(a)).addScaledVector(binormal, Math.sin(a));
      positions.push(p.x + dir.x * r, p.y + dir.y * r, p.z + dir.z * r);
      normals.push(dir.x, dir.y, dir.z);
      uvs.push(t * 2, j / radialSegs);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * radialSegs + j;
      const b = i * radialSegs + (j + 1) % radialSegs;
      const c = (i + 1) * radialSegs + j;
      const d = (i + 1) * radialSegs + (j + 1) % radialSegs;
      indices.push(a, c, b, b, c, d);
    }
  }
  // end caps
  const capCount = positions.length / 3;
  for (const tEnd of [0, 1]) {
    const p = curve.getPoint(tEnd);
    const tanEnd = curve.getTangent(tEnd, new THREE.Vector3()).normalize();
    const dirSign = tEnd === 0 ? -1 : 1;
    const centerIdx = capCount + (tEnd === 0 ? 0 : 1);
    positions.push(p.x, p.y, p.z);
    normals.push(tanEnd.x * dirSign, tanEnd.y * dirSign, tanEnd.z * dirSign);
    uvs.push(0.5, 0.5);
    const ringOffset = tEnd === 0 ? 0 : segs * radialSegs;
    for (let j = 0; j < radialSegs; j++) {
      const a = ringOffset + j;
      const b = ringOffset + (j + 1) % radialSegs;
      if (tEnd === 0) indices.push(centerIdx, a, b);
      else indices.push(centerIdx, b, a);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  return g;
}

/* Box beam spanning (ax,ay,az) -> (bx,by,bz) with thickness w,h */
export function beamBetween(ax, ay, az, bx, by, bz, thickness = 0.7, width = 0.7) {
  const a = new THREE.Vector3(ax, ay, az);
  const b = new THREE.Vector3(bx, by, bz);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const geo = new THREE.BoxGeometry(width, thickness, len);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  geo.applyQuaternion(quat);
  geo.translate(mid.x, mid.y, mid.z);
  return geo;
}
