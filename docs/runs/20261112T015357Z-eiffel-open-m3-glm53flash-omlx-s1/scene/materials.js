import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Cel-shading toolkit: banded toon materials, ink outlines (inverted hull for
// meshes, grown shells for instanced beams) and small canvas textures.
// ---------------------------------------------------------------------------

export const uTime = { value: 0 };

function makeGradientMap() {
  // Three hard light bands: shadow, mid, lit.
  const data = new Uint8Array([105, 175, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
const GRAD = makeGradientMap();

export function toon(params = {}) {
  return new THREE.MeshToonMaterial(Object.assign({ gradientMap: GRAD }, params));
}

// ---- Ink outlines ----------------------------------------------------------

export const hullMaterials = [];
export function hullMaterial(thickness = 0.13) {
  const m = new THREE.ShaderMaterial({
    name: 'inkHull',
    uniforms: {
      uThickness: { value: thickness },
      uColor: { value: new THREE.Color(0x241a10) },
    },
    vertexShader: /* glsl */`
      uniform float uThickness;
      void main() {
        vec3 p = position + normal * uThickness;
        #ifdef USE_INSTANCING
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(p, 1.0);
        #else
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        #endif
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      void main() { gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  });
  hullMaterials.push(m);
  return m;
}

export const outlineBasicMaterials = [];

// A set of straight beams rendered as one InstancedMesh of unit boxes, plus an
// optional matching outline pass (box grown by a fixed ink margin).
export class BeamSet {
  constructor(material, outline = 0) {
    this.material = material;
    this.outline = outline;
    this.items = [];
  }
  add(ax, ay, az, bx, by, bz, t) {
    this.items.push([ax, ay, az, bx, by, bz, t]);
  }
  addV(a, b, t) { this.add(a.x, a.y, a.z, b.x, b.y, b.z, t); }
  _matrices(expand) {
    const list = [];
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    const P = new THREE.Vector3(), S = new THREE.Vector3(), D = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const [ax, ay, az, bx, by, bz, t] of this.items) {
      P.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      D.set(bx - ax, by - ay, bz - az);
      const len = D.length();
      if (len < 1e-5) D.copy(up); else D.divideScalar(len);
      Q.setFromUnitVectors(up, D);
      const o = expand * this.outline;
      S.set(t + o, len + o, t + o);
      M.compose(P, Q, S);
      list.push(M.clone());
    }
    return list;
  }
  build(parent) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const n = this.items.length;
    const mesh = new THREE.InstancedMesh(geo, this.material, n);
    this._matrices(0).forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    parent.add(mesh);
    if (this.outline > 0) {
      const om = new THREE.MeshBasicMaterial({ color: 0x241a10, side: THREE.BackSide });
      outlineBasicMaterials.push(om);
      const omesh = new THREE.InstancedMesh(geo, om, n);
      this._matrices(2).forEach((m, i) => omesh.setMatrixAt(i, m));
      omesh.instanceMatrix.needsUpdate = true;
      omesh.frustumCulled = false;
      parent.add(omesh);
    }
    return mesh;
  }
}

// ---- Palette-tinted materials ----------------------------------------------

export const tinted = []; // { mat, key }  -> mat.color = base * palette[key]
function tintable(mat, key) {
  mat.userData.base = mat.color.clone();
  tinted.push({ mat, key });
  return mat;
}

// ---- Canvas textures --------------------------------------------------------

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grassTexture() {
  const t = canvasTex(128, 128, (x, w, h) => {
    const n = 12, bw = w / n;
    for (let i = 0; i < n; i++) {
      x.fillStyle = i % 2 ? '#d2d2d2' : '#ffffff';
      x.fillRect(Math.floor(i * bw), 0, Math.ceil(bw) + 1, h);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2.4, 1);
  return t;
}

function waterTexture() {
  const t = canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, w, h);
    x.strokeStyle = '#cfe6ee';
    x.lineWidth = 5;
    x.lineCap = 'round';
    for (let r = 0; r < 7; r++) {
      const y = 10 + r * 18 + (r % 3) * 4;
      x.beginPath();
      x.moveTo(-10, y);
      for (let px = 0; px <= w + 10; px += 32) {
        x.quadraticCurveTo(px + 8, y - 7, px + 16, y);
        x.quadraticCurveTo(px + 24, y + 7, px + 32, y);
      }
      x.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(14, 2);
  return t;
}

function flagTexture() {
  return canvasTex(96, 64, (x, w, h) => {
    x.fillStyle = '#21449c'; x.fillRect(0, 0, w / 3, h);
    x.fillStyle = '#ffffff'; x.fillRect(w / 3, 0, w / 3, h);
    x.fillStyle = '#e03a3e'; x.fillRect(2 * w / 3, 0, w / 3, h);
  });
}

function discSprite(core, ring, craters) {
  const tex = canvasTex(128, 128, (x) => {
    x.clearRect(0, 0, 128, 128);
    x.fillStyle = core;
    x.beginPath(); x.arc(64, 64, 42, 0, Math.PI * 2); x.fill();
    if (ring) {
      x.strokeStyle = ring; x.lineWidth = 6;
      x.beginPath(); x.arc(64, 64, 48, 0, Math.PI * 2); x.stroke();
    }
    if (craters) {
      x.fillStyle = craters;
      for (const [cx, cy, r] of [[52, 50, 8], [76, 72, 6], [58, 80, 4], [80, 44, 4]]) {
        x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      }
    }
  });
  return tex;
}

// ---- The shared material bag ------------------------------------------------

export const mats = {
  iron: toon({ color: 0xa06a38, emissive: 0xff9a4a, emissiveIntensity: 0 }),
  deck: toon({ color: 0xc79c60 }),
  deckTrim: tintable(toon({ color: 0x8a6a40 }), 'roofTint'),
  wall: tintable(toon({ color: 0xf2e4c4 }), 'wallTint'),
  wall2: tintable(toon({ color: 0xe8cfae }), 'wallTint'),
  wall3: tintable(toon({ color: 0xf5d9b8 }), 'wallTint'),
  wall4: tintable(toon({ color: 0xdfc3bd }), 'wallTint'),
  roof: tintable(toon({ color: 0xb0533a }), 'roofTint'),
  roof2: tintable(toon({ color: 0x8f5a4a }), 'roofTint'),
  roof3: tintable(toon({ color: 0x5a6274 }), 'roofTint'),
  stone: toon({ color: 0xe7d7a4 }),
  stoneDark: toon({ color: 0xc9b78c }),
  grass: toon({ map: grassTexture(), color: 0x7cc952 }),
  baseGrass: toon({ color: 0x6dbb4a }),
  water: toon({ map: waterTexture(), color: 0x58c0dd }),
  trunk: tintable(toon({ color: 0x7c4a2a }), 'trunkTint'),
  foliage: [
    tintable(toon({ color: 0x3f9b3f, flatShading: true }), 'foliageTint'),
    tintable(toon({ color: 0x57b449, flatShading: true }), 'foliageTint'),
    tintable(toon({ color: 0x2f8440, flatShading: true }), 'foliageTint'),
  ],
  cloud: toon({ color: 0xffffff }),
  window: toon({ color: 0x3c4a5e, emissive: 0xffc86e, emissiveIntensity: 0 }),
  lampGlass: toon({ color: 0xfff2cc, emissive: 0xffc86e, emissiveIntensity: 0 }),
  beacon: toon({ color: 0x883030, emissive: 0xff4040, emissiveIntensity: 1 }),
  pool: new THREE.MeshBasicMaterial({ color: 0xffcf8a, transparent: true, opacity: 0, depthWrite: false }),
  firefly: new THREE.PointsMaterial({
    color: 0xffe28a, size: 0.5, sizeAttenuation: true, transparent: true,
    opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
  }),
  star: new THREE.PointsMaterial({
    color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true,
    opacity: 0, depthWrite: false, fog: false,
  }),
  bird: new THREE.MeshBasicMaterial({ color: 0x2a2a33, side: THREE.DoubleSide }),
  boat: toon({ color: 0x8a5a3c }),
  flag: (() => {
    const m = toon({ map: flagTexture(), side: THREE.DoubleSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float fx = clamp(position.x / 3.2, 0.0, 1.0);
        transformed.z += (sin(position.x * 2.2 - uTime * 7.0) * 0.28 + sin(position.x * 4.5 - uTime * 11.0) * 0.1) * fx;
        transformed.y += sin(position.x * 1.8 - uTime * 5.0) * 0.12 * fx;`
      );
    };
    return m;
  })(),
};