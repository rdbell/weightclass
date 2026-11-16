import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Toon gradient map: a handful of discrete steps sampled with NearestFilter.
// MeshToonMaterial looks this up with dot(N, L), which is what produces the
// hard light bands instead of smooth gradients.
// ---------------------------------------------------------------------------
export function makeGradientMap(stops = [100, 152, 202, 255]) {
  const data = new Uint8Array(stops);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function toonMaterial(color, gradientMap, opts = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap, ...opts });
}

// ---------------------------------------------------------------------------
// Ink outlines: inverted hull. We render a BackSide copy of each mesh whose
// vertices are pushed outward along the normal *in view space*, so the line
// width stays constant in world units no matter how the object is scaled
// (crucial for the anisotropically scaled lattice bars).
// ---------------------------------------------------------------------------
const OUTLINE_VERT = /* glsl */ `
  uniform float uOffset;
  void main() {
    vec3 n = normal;
    vec4 p = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      n = mat3(instanceMatrix) * n;
    #endif
    vec4 mvPosition = modelViewMatrix * p;
    mvPosition.xyz += normalize(normalMatrix * n) * uOffset;
    gl_Position = projectionMatrix * mvPosition;
  }
`;
const OUTLINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`;

// One shared ink colour, a small pool of materials keyed by line width.
export function createInkSystem(initialInk) {
  const materials = new Map();
  function get(offset) {
    let m = materials.get(offset);
    if (!m) {
      m = new THREE.ShaderMaterial({
        uniforms: {
          uOffset: { value: offset },
          uColor: { value: new THREE.Color(initialInk) },
        },
        vertexShader: OUTLINE_VERT,
        fragmentShader: OUTLINE_FRAG,
        side: THREE.BackSide,
      });
      materials.set(offset, m);
    }
    return m;
  }
  return {
    get,
    setInk(c) {
      for (const m of materials.values()) m.uniforms.uColor.value.copy(c);
    },
  };
}

// Attach an outline hull as a child of `mesh`. Works for Mesh and
// InstancedMesh (the instance matrix buffer is shared, not copied).
export function addOutline(mesh, offset, ink) {
  let o;
  if (mesh.isInstancedMesh) {
    o = new THREE.InstancedMesh(mesh.geometry, ink.get(offset), mesh.count);
    o.instanceMatrix = mesh.instanceMatrix;
  } else {
    o = new THREE.Mesh(mesh.geometry, ink.get(offset));
  }
  o.castShadow = false;
  o.receiveShadow = false;
  o.frustumCulled = mesh.frustumCulled;
  mesh.add(o);
  return o;
}

// ---------------------------------------------------------------------------
// Procedural canvas textures (no network assets allowed).
// ---------------------------------------------------------------------------

// Soft radial glow, used by additive sprites (lamps, beacon, sun halo).
export function makeGlowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Tileable grass: base green with wrapped soft blobs + speckles.
export function makeGrassTexture(rng) {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#79c25b';
  g.fillRect(0, 0, s, s);
  const greens = ['#6fbb52', '#84cb66', '#71bf55', '#68b54d', '#8ad06c', '#5aa843', '#96da74'];
  for (let i = 0; i < 90; i++) {
    const x = rng.range(0, s);
    const y = rng.range(0, s);
    const r = rng.range(14, 52);
    const rot = rng.range(0, Math.PI * 2);
    const squash = rng.range(0.5, 1);
    g.globalAlpha = 0.5;
    g.fillStyle = greens[rng.int(0, greens.length - 1)];
    for (const ox of [-s, 0, s]) {
      for (const oy of [-s, 0, s]) {
        g.beginPath();
        g.ellipse(x + ox, y + oy, r, r * squash, rot, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.globalAlpha = 0.3;
  for (let i = 0; i < 500; i++) {
    g.fillStyle = rng.next() < 0.5 ? '#5da845' : '#93d678';
    const x = rng.range(0, s);
    const y = rng.range(0, s);
    const w = rng.range(2, 4);
    for (const ox of [-s, 0, s]) {
      for (const oy of [-s, 0, s]) {
        g.fillRect(x + ox, y + oy, w, w);
      }
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Tileable stone plaza: warm light tiles with grout + per-tile variation.
export function makePlazaTexture(rng) {
  const s = 512;
  const n = 8;
  const tile = s / n;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#9c8d75';
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = Math.round(rng.range(-22, 22));
      g.fillStyle = `rgb(${217 + v},${208 + v},${194 + v})`;
      g.fillRect(i * tile + 2, j * tile + 2, tile - 4, tile - 4);
      g.fillStyle = 'rgba(255,255,255,0.16)';
      g.fillRect(i * tile + 2, j * tile + 2, tile - 4, 3);
      g.fillStyle = 'rgba(90,70,50,0.14)';
      g.fillRect(i * tile + 2, j * tile + tile - 5, tile - 4, 3);
    }
  }
  for (let k = 0; k < 6; k++) {
    const i = rng.int(0, n - 1);
    const j = rng.int(0, n - 1);
    g.fillStyle = 'rgba(120,100,80,0.16)';
    g.fillRect(i * tile + 2, j * tile + 2, tile - 4, tile - 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// French tricolour (vertical bands).
export function makeFlagTexture() {
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2b4fa0';
  g.fillRect(0, 0, 32, 64);
  g.fillStyle = '#f4f4f2';
  g.fillRect(32, 0, 32, 64);
  g.fillStyle = '#d0342c';
  g.fillRect(64, 0, 32, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Warm white disc with a soft edge; tinted by the sprite material colour.
export function makeSunTexture() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,250,1)');
  grad.addColorStop(0.5, 'rgba(255,250,235,1)');
  grad.addColorStop(0.62, 'rgba(255,240,200,0.85)');
  grad.addColorStop(0.8, 'rgba(255,225,160,0.25)');
  grad.addColorStop(1, 'rgba(255,210,140,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Toon moon: pale disc, a few craters, thin halo.
export function makeMoonTexture(rng) {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  const halo = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  halo.addColorStop(0, 'rgba(210,222,255,0.5)');
  halo.addColorStop(0.3, 'rgba(210,222,255,0.28)');
  halo.addColorStop(0.55, 'rgba(210,222,255,0.08)');
  halo.addColorStop(1, 'rgba(210,222,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, s, s);
  g.fillStyle = '#e9eefb';
  g.beginPath();
  g.arc(s / 2, s / 2, 68, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(168,182,214,0.55)';
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0, 44);
    g.beginPath();
    g.arc(s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, rng.range(5, 14), 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
