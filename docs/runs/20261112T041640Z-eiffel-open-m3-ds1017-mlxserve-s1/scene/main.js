import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* --------------------------------------------------------------------------
   La Tour Eiffel — a cel-shaded cartoon Paris
   Everything is procedural: canvas textures, lathed balloons, a merged iron
   lattice, and an inverted-hull ink pass.
   -------------------------------------------------------------------------- */

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xE1FFE1);
const range = (a, b) => a + (b - a) * rand();
const randInt = (a, b) => Math.floor(range(a, b + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/* ------------------------------- renderer -------------------------------- */

const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance',
  alpha: false,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#c9eaff', 0.00052);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  1,
  8000
);
camera.position.set(340, 180, 450);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 95, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.9;
controls.minDistance = 90;
controls.maxDistance = 1000;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = 1.60;

/* ------------------------------- palettes -------------------------------- */

const dir = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

const MODE_INFO = {
  day: {
    ink: '#272238',
    fog: '#c9eaff',
    fogDensity: 0.00052,
    ambient: '#8ab9ea',
    ambientIntensity: 0.72,
    lightDir: dir(-0.74, 0.66, 0.17),
    lightColor: '#ffeac1',
    lightIntensity: 2.5,
    fillDir: dir(0.55, 0.28, 0.60),
    fillColor: '#d7eaff',
    fillIntensity: 0.45,
    skyTop: '#2f83d8',
    skyHorizon: '#c9ecff',
    sunDir: dir(-0.74, 0.66, 0.17),
    sunColor: '#fff2c2',
    sunSize: 0.055,
    sunStrength: 1.0,
    sunGlow: 0.35,
    moonDir: dir(-0.42, 0.55, -0.72),
    moonColor: '#e9f3ff',
    moonSize: 0.055,
    moonStrength: 0.0,
    stars: 0,
    sparkle: 0,
    lampLight: 0,
    towerLight: 0,
    beacon: 0.14,
  },
  dusk: {
    ink: '#2a1739',
    fog: '#f4a389',
    fogDensity: 0.00055,
    ambient: '#b384c8',
    ambientIntensity: 0.95,
    lightDir: dir(-0.42, 0.14, -0.90),
    lightColor: '#ffb178',
    lightIntensity: 2.15,
    fillDir: dir(0.60, 0.28, 0.73),
    fillColor: '#ff9c8c',
    fillIntensity: 1.0,
    skyTop: '#3b2b78',
    skyHorizon: '#ffa964',
    sunDir: dir(-0.42, 0.14, -0.90),
    sunColor: '#ffd58b',
    sunSize: 0.075,
    sunStrength: 1.0,
    sunGlow: 1.5,
    moonDir: dir(-0.42, 0.55, -0.72),
    moonColor: '#ffe8cf',
    moonSize: 0.05,
    moonStrength: 0.0,
    stars: 0.15,
    sparkle: 0.22,
    lampLight: 3.0,
    towerLight: 0.18,
    beacon: 0.7,
  },
  night: {
    ink: '#080b20',
    fog: '#20345f',
    fogDensity: 0.0006,
    ambient: '#6179c5',
    ambientIntensity: 1.18,
    lightDir: dir(-0.45, 0.20, -0.87),
    lightColor: '#9fc4ff',
    lightIntensity: 1.05,
    fillDir: dir(0.62, 0.32, 0.71),
    fillColor: '#8098de',
    fillIntensity: 0.72,
    skyTop: '#071029',
    skyHorizon: '#20345f',
    sunDir: dir(-0.42, 0.55, -0.72),
    sunColor: '#ffe4af',
    sunSize: 0.055,
    sunStrength: 0.0,
    sunGlow: 0.0,
    moonDir: dir(-0.45, 0.20, -0.87),
    moonColor: '#eef7ff',
    moonSize: 0.058,
    moonStrength: 1.0,
    stars: 1.0,
    sparkle: 1.0,
    lampLight: 90.0,
    towerLight: 1.55,
    beacon: 1.7,
  },
};

let currentMode = 'day';

/* ------------------------------ ink outlines ----------------------------- */

const outlinePxScale = { value: 1 };
const outlineInk = { value: new THREE.Color('#272238') };
const outlineFogColor = { value: new THREE.Color('#c9eaff') };
const outlineFogDensity = { value: 0.00052 };
const outlineCache = new Map();

const outlineVertex = `
  uniform float uWidth;
  uniform float uPxScale;
  varying float vFogDepth;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normal);
    float expand = uWidth * (-mvPosition.z) / uPxScale;
    mvPosition.xyz += viewNormal * expand;
    vFogDepth = -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const outlineFragment = `
  uniform vec3 uInk;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying float vFogDepth;

  void main() {
    float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
    vec3 col = mix(uInk, uFogColor, fogFactor);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

function outlineMaterial(widthPx) {
  const key = widthPx.toFixed(2);
  if (outlineCache.has(key)) return outlineCache.get(key);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uWidth: { value: widthPx },
      uPxScale: outlinePxScale,
      uInk: outlineInk,
      uFogColor: outlineFogColor,
      uFogDensity: outlineFogDensity,
    },
    vertexShader: outlineVertex,
    fragmentShader: outlineFragment,
    side: THREE.BackSide,
    depthWrite: true,
    depthTest: true,
  });
  outlineCache.set(key, mat);
  return mat;
}

// Adds a mesh and (optionally) its inverted-hull ink twin to a parent.
function addMesh(parent, geometry, material, opts = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  mesh.renderOrder = opts.renderOrder ?? 0;
  parent.add(mesh);
  if (opts.outline && opts.outline > 0) {
    const hull = new THREE.Mesh(geometry, outlineMaterial(opts.outline));
    hull.castShadow = false;
    hull.receiveShadow = false;
    hull.renderOrder = mesh.renderOrder;
    hull.position.copy(mesh.position);
    hull.quaternion.copy(mesh.quaternion);
    hull.scale.copy(mesh.scale);
    parent.add(hull);
  }
  return mesh;
}

/* -------------------------------- textures ------------------------------- */

function makeCanvas(size, draw) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  draw(ctx, size);
  return c;
}

function canvasTexture(size, draw, { repeat = false, colorSpace = true } = {}) {
  const tex = new THREE.CanvasTexture(makeCanvas(size, draw));
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  tex.colorSpace = colorSpace ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  tex.needsUpdate = true;
  return tex;
}

function gradientTexture(steps) {
  const data = new Uint8Array(steps.length * 4);
  for (let i = 0; i < steps.length; i++) {
    const v = Math.round(clamp(steps[i], 0, 1) * 255);
    data[i * 4 + 0] = v;
    data[i * 4 + 1] = v;
    data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

const grad4 = gradientTexture([0.27, 0.52, 0.76, 1.0]);
const grad5 = gradientTexture([0.20, 0.40, 0.60, 0.80, 1.0]);
const gradSoft = gradientTexture([0.40, 0.63, 0.84, 1.0]);

const grassTexture = canvasTexture(256, (ctx, S) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#eeeeee';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(0, i * 32, S, 16);
  }
  ctx.strokeStyle = '#cccccc';
  ctx.lineWidth = 2;
  for (let i = 0; i < 180; i++) {
    const x = range(0, S);
    const y = range(0, S);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + range(-3, 3), y - range(3, 8));
    ctx.stroke();
  }
}, { repeat: true });

const plazaTexture = canvasTexture(512, (ctx, S) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#dcdcdc';
  ctx.lineWidth = 4;
  for (let r = 28; r < S * 0.72; r += 28) {
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e7e7e7';
  ctx.lineWidth = 3;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
    ctx.beginPath();
    ctx.moveTo(S / 2, S / 2);
    ctx.lineTo(S / 2 + Math.cos(a) * S * 0.5, S / 2 + Math.sin(a) * S * 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#f2f2f2';
  for (let i = 0; i < 140; i++) {
    const a = range(0, Math.PI * 2);
    const r = range(20, S * 0.48);
    ctx.fillRect(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, 3, 3);
  }
});

const pathTexture = canvasTexture(256, (ctx, S) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#ebebeb';
  for (let i = 0; i < 45; i++) {
    ctx.fillRect(range(0, S), range(0, S), range(2, 6), range(2, 5));
  }
  ctx.fillStyle = '#d7d7d7';
  for (let i = 0; i < 120; i++) {
    ctx.fillRect(range(0, S), range(0, S), range(1, 3), range(1, 3));
  }
  ctx.fillStyle = '#f7f7f7';
  for (let i = 0; i < 10; i++) {
    ctx.fillRect(0, i * 26, S, 2);
  }
}, { repeat: true });

const waterTexture = canvasTexture(256, (ctx, S) => {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#dbdbdb';
  ctx.lineWidth = 3;
  for (let r = 22; r < S * 0.7; r += 24) {
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = '#f7f7f7';
  ctx.lineWidth = 4;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
    ctx.beginPath();
    ctx.arc(S / 2 + Math.cos(a) * 32, S / 2 + Math.sin(a) * 32, 16, 0, Math.PI * 2);
    ctx.stroke();
  }
});

const awningTexture = canvasTexture(256, (ctx, S) => {
  ctx.fillStyle = '#fff3dc';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#e6554d';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(i * 32, 0, 18, S);
  }
}, { repeat: true });

const balloonTexture = canvasTexture(256, (ctx, S) => {
  const cols = ['#e9655e', '#ffd05b', '#51c3bd', '#f28cae', '#8e82dd', '#fff2d2'];
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(i * (S / 12), 0, S / 12 + 1, S);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(0, 0, S, S * 0.16);
});

const signTexture = canvasTexture(512, (ctx, S) => {
  ctx.fillStyle = '#fff1d0';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#2d5146';
  ctx.lineWidth = 12;
  ctx.strokeRect(14, 18, S - 28, S - 36);
  ctx.fillStyle = '#272238';
  ctx.font = 'bold 70px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GLACES', S / 2, S / 2 - 28);
  ctx.font = 'bold 46px Georgia, serif';
  ctx.fillStyle = '#7d5632';
  ctx.fillText('& CRÊPES', S / 2, S / 2 + 48);
});

function facadeTexture(variant) {
  const map = canvasTexture(512, (ctx, S) => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, S, S);

    // subtle plaster patches
    ctx.fillStyle = '#f1f1f1';
    for (let i = 0; i < 18; i++) {
      ctx.fillRect(range(0, S), range(0, S), range(10, 40), range(3, 10));
    }

    // floor bands
    ctx.fillStyle = '#e7e7e7';
    for (let y = 0; y < S; y += 171) {
      ctx.fillRect(0, y, S, 6);
    }

    const cols = [128, 384];
    const rows = [86, 256, 426];
    for (let ci = 0; ci < cols.length; ci++) {
      for (let ri = 0; ri < rows.length; ri++) {
        const cx = cols[ci];
        const cy = rows[ri];
        const w = 110;
        const h = 112;
        const x = cx - w / 2;
        const y = cy - h / 2;

        ctx.fillStyle = '#f7f7f7';
        ctx.fillRect(x - 9, y - 9, w + 18, h + 18);
        ctx.fillStyle = '#313b4e';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#59647a';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, y + 4);
        ctx.lineTo(cx, y + h - 4);
        ctx.moveTo(x + 4, cy);
        ctx.lineTo(x + w - 4, cy);
        ctx.stroke();
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(x - 15, y + h + 10, w + 30, 7);

        if (variant === 0 && ci === 0) {
          ctx.fillStyle = '#44655b';
          ctx.fillRect(x - 27, y + 8, 15, h - 16);
          ctx.fillRect(x + w + 12, y + 8, 15, h - 16);
        }
        if (variant === 1 && ri === 1) {
          ctx.fillStyle = '#3e4c59';
          ctx.fillRect(x - 14, y + h + 22, w + 28, 6);
          ctx.fillRect(x - 14, y + h + 30, 5, 18);
          ctx.fillRect(x + w + 9, y + h + 30, 5, 18);
        }
      }
    }
  }, { repeat: true });

  const emissive = canvasTexture(512, (ctx, S) => {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, S, S);
    const cols = [128, 384];
    const rows = [86, 256, 426];
    const lit = variant === 0
      ? [[0, 1], [1, 0], [1, 2]]
      : [[0, 0], [1, 1], [0, 2]];
    for (const [ci, ri] of lit) {
      const cx = cols[ci];
      const cy = rows[ri];
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 45, cy - 46, 90, 92);
    }
  }, { repeat: true, colorSpace: false });

  return { map, emissive };
}

const facadeA = facadeTexture(0);
const facadeB = facadeTexture(1);

/* ------------------------------- materials ------------------------------- */

const bindings = [];

function bind(mat, colors, emissive) {
  const rec = {
    mat,
    day: new THREE.Color(colors.day),
    dusk: new THREE.Color(colors.dusk),
    night: new THREE.Color(colors.night),
    emissive: emissive
      ? {
          day: new THREE.Color(emissive.day || '#000000'),
          dusk: new THREE.Color(emissive.dusk || '#000000'),
          night: new THREE.Color(emissive.night || '#000000'),
        }
      : null,
    emissiveIntensity: emissive
      ? {
          day: emissive.intensity?.day ?? 0,
          dusk: emissive.intensity?.dusk ?? 0,
          night: emissive.intensity?.night ?? 0,
        }
      : null,
  };
  bindings.push(rec);
  return mat;
}

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: opts.gradient || grad4,
    map: opts.map || null,
    emissiveMap: opts.emissiveMap || null,
    emissive: opts.emissive || '#000000',
    emissiveIntensity: opts.emissiveIntensity || 0,
  });
}

// ground
const grassBaseMat = bind(toon('#4f9d45'), {
  day: '#4f9d45', dusk: '#39704a', night: '#21453f',
});
const lawnMat = bind(toon('#ffffff', { map: grassTexture }), {
  day: '#6fc554', dusk: '#649349', night: '#2c5f52',
});
const plazaMat = bind(toon('#ffffff', { map: plazaTexture }), {
  day: '#e7d8bd', dusk: '#dca083', night: '#8b8ba8',
});
const pathMat = bind(toon('#ffffff', { map: pathTexture }), {
  day: '#dbcbb0', dusk: '#c79580', night: '#737894',
});
const stoneMat = bind(toon('#cdbfa8'), {
  day: '#cdbfa8', dusk: '#c49a8d', night: '#8990b1',
});
const hillMat = bind(toon('#688f4e', { gradient: grad4 }), {
  day: '#688f4e', dusk: '#6f5763', night: '#27374e',
});
const waterMat = bind(toon('#ffffff', { map: waterTexture }), {
  day: '#42c6d7', dusk: '#58c8dc', night: '#3fa6dc',
}, {
  day: '#000000', dusk: '#000000', night: '#258ec8',
  intensity: { day: 0, dusk: 0, night: 0.35 },
});

// iron tower
const towerMat = bind(toon('#be7441', { gradient: grad5 }), {
  day: '#be7441', dusk: '#e6a050', night: '#f8c274',
}, {
  day: '#000000', dusk: '#ffab55', night: '#ffb85f',
  intensity: { day: 0, dusk: 0.10, night: 0.52 },
});
const towerTrimMat = bind(toon('#d6995e', { gradient: grad5 }), {
  day: '#d6995e', dusk: '#f0b06c', night: '#ffd27c',
}, {
  day: '#000000', dusk: '#ffb15d', night: '#ffca70',
  intensity: { day: 0, dusk: 0.10, night: 0.42 },
});
const deckMat = bind(toon('#d2ac78', { gradient: grad4 }), {
  day: '#d2ac78', dusk: '#dfa16b', night: '#d2ad80',
}, {
  day: '#000000', dusk: '#000000', night: '#b58b53',
  intensity: { day: 0, dusk: 0, night: 0.12 },
});

// city
const wallMats = [];
for (let i = 0; i < 4; i++) {
  const f = i % 2 === 0 ? facadeA : facadeB;
  const mat = new THREE.MeshToonMaterial({
    color: '#ffffff',
    gradientMap: grad4,
    map: f.map,
    emissiveMap: f.emissive,
    emissive: '#ffcb6b',
    emissiveIntensity: 0,
  });
  wallMats.push(bind(mat, {
    day: ['#f5d8ad', '#e7b58a', '#d3e1c7', '#eac9d8'][i],
    dusk: ['#f3b189', '#e59d78', '#b0b59b', '#d3a6c1'][i],
    night: ['#6e7aa5', '#606a92', '#5f7a85', '#70648e'][i],
  }, {
    day: '#000000', dusk: '#ffbd67', night: '#ffcf7a',
    intensity: { day: 0, dusk: 0.5, night: 1.45 },
  }));
}

const roofMatA = bind(toon('#4e627c', { gradient: grad4 }), {
  day: '#4e627c', dusk: '#6f4b6c', night: '#2b3557',
});
const roofMatB = bind(toon('#b4634f', { gradient: grad4 }), {
  day: '#b4634f', dusk: '#a3565a', night: '#54394f',
});
const cityTrimMat = bind(toon('#fff0d3'), {
  day: '#fff0d3', dusk: '#ffd6b9', night: '#97a3d3',
});
const cityDoorMat = bind(toon('#5a4033'), {
  day: '#5a4033', dusk: '#633e3b', night: '#373347',
});
const awningSolidMat = bind(toon('#df5a50'), {
  day: '#df5a50', dusk: '#c8745d', night: '#5a4f72',
});

// vegetation
const leafMats = [];
const leafColors = [
  { day: '#60b950', dusk: '#8d9e49', night: '#2d6a61' },
  { day: '#469c40', dusk: '#ad7045', night: '#245850' },
  { day: '#8bd066', dusk: '#cb8f57', night: '#3e7b68' },
];
for (const c of leafColors) {
  leafMats.push(bind(toon(c.day, { gradient: grad4 }), c));
}
const trunkMat = bind(toon('#80563b'), {
  day: '#80563b', dusk: '#7a4a40', night: '#4c4658',
});
const bedMat = bind(toon('#4c8b43'), {
  day: '#4c8b43', dusk: '#557445', night: '#2f5750',
});
const flowerMats = [];
const flowerColors = [
  { day: '#e8494b', dusk: '#e05d4e', night: '#9e4a5f' },
  { day: '#ffd24e', dusk: '#f6c05b', night: '#a88844' },
  { day: '#f28fb1', dusk: '#d08bb5', night: '#966c97' },
  { day: '#fff4e6', dusk: '#ffe7df', night: '#b0b8d4' },
];
for (const c of flowerColors) {
  flowerMats.push(bind(toon(c.day), c));
}

// man-made props
const kioskBodyMat = bind(toon('#fff1d0'), {
  day: '#fff1d0', dusk: '#ffd9bd', night: '#8b97bd',
}, {
  day: '#000000', dusk: '#ffbc74', night: '#ffca74',
  intensity: { day: 0, dusk: 0.08, night: 0.22 },
});
const kioskTrimMat = bind(toon('#2f5b4d'), {
  day: '#2f5b4d', dusk: '#42505a', night: '#233645',
});
const awningMat = bind(toon('#ffffff', { map: awningTexture }), {
  day: '#ffffff', dusk: '#ffe3cf', night: '#9aa1bf',
});
const signMat = bind(toon('#ffffff', { map: signTexture }), {
  day: '#ffffff', dusk: '#ffe8d2', night: '#b3b2ca',
}, {
  day: '#000000', dusk: '#ffbf72', night: '#ffd178',
  intensity: { day: 0, dusk: 0.15, night: 0.8 },
});
const benchWoodMat = bind(toon('#7a5540'), {
  day: '#7a5540', dusk: '#6c4340', night: '#3d3a50',
});
const lampPostMat = bind(toon('#2f4b45'), {
  day: '#2f4b45', dusk: '#455060', night: '#1a2b3d',
});
const lampFrameMat = bind(toon('#3c5b52'), {
  day: '#3c5b52', dusk: '#4f5868', night: '#26394c',
});
const lampGlowMat = bind(toon('#fff8d8'), {
  day: '#fff8d8', dusk: '#ffe0a5', night: '#ffdf86',
}, {
  day: '#000000', dusk: '#ffd06b', night: '#ffd872',
  intensity: { day: 0, dusk: 0.55, night: 1.4 },
});
const beaconMat = bind(toon('#ff453c'), {
  day: '#ff453c', dusk: '#ff453c', night: '#ff5140',
}, {
  day: '#ff3b2d', dusk: '#ff3b2d', night: '#ff3826',
  intensity: { day: 0.15, dusk: 0.7, night: 1.7 },
});
const balloonMats = [];
const balloonColors = [
  { day: '#e9655e', dusk: '#e0655d', night: '#8c5571' },
  { day: '#ffd05b', dusk: '#efbd63', night: '#8d7c58' },
  { day: '#51c3bd', dusk: '#56aaa8', night: '#3e6d78' },
  { day: '#f28cae', dusk: '#dd88aa', night: '#7e5e8a' },
  { day: '#8e82dd', dusk: '#8273c6', night: '#57528e' },
];
for (const c of balloonColors) {
  balloonMats.push(bind(toon(c.day), c));
}
const hotAirMat = bind(new THREE.MeshBasicMaterial({ map: balloonTexture }), {
  day: '#ffffff', dusk: '#ffe6da', night: '#8490bb',
});
const basketMat = bind(toon('#8a623f'), {
  day: '#8a623f', dusk: '#7e5443', night: '#4a4156',
});

// clouds
const cloudMat = bind(toon('#fff7ec', { gradient: gradSoft }), {
  day: '#fff7ec', dusk: '#ffc8aa', night: '#394a7b',
}, {
  day: '#000000', dusk: '#ffb089', night: '#6a77b4',
  intensity: { day: 0, dusk: 0.08, night: 0.20 },
});

const dropletMat = bind(new THREE.MeshBasicMaterial({ color: '#bff6ff' }), {
  day: '#bff6ff', dusk: '#ffd7d3', night: '#a9ecff',
});
const birdMat = new THREE.MeshBasicMaterial({ color: '#272238' });

/* -------------------------------- lighting -------------------------------- */

const ambientLight = new THREE.AmbientLight('#8ab9ea', 0.72);
scene.add(ambientLight);

const sunTarget = new THREE.Object3D();
sunTarget.position.set(0, 120, 0);
scene.add(sunTarget);

const sunLight = new THREE.DirectionalLight('#ffeac1', 2.3);
sunLight.position.copy(sunTarget.position).addScaledVector(MODE_INFO.day.lightDir, 700);
sunLight.target = sunTarget;
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -530;
sunLight.shadow.camera.right = 530;
sunLight.shadow.camera.top = 530;
sunLight.shadow.camera.bottom = -530;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 1800;
sunLight.shadow.bias = -0.0004;
sunLight.shadow.normalBias = 0.55;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight('#d7eaff', 0.35);
fillLight.position.copy(sunTarget.position).addScaledVector(MODE_INFO.day.fillDir, 500);
fillLight.target = sunTarget;
fillLight.castShadow = false;
scene.add(fillLight);

const towerPointPositions = [
  new THREE.Vector3(0, 52, 92),
  new THREE.Vector3(0, 188, -76),
];
const towerPointLights = towerPointPositions.map((p) => {
  const l = new THREE.PointLight('#ffc46b', 0, 460, 0);
  l.position.copy(p);
  l.decay = 0;
  scene.add(l);
  return l;
});

const lampPositions = [];
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + 0.25;
  lampPositions.push(new THREE.Vector3(Math.cos(a) * 98, 0, Math.sin(a) * 98));
}
// two extra lamps near the fountain and the kiosk
lampPositions.push(new THREE.Vector3(200, 0, 80));
lampPositions.push(new THREE.Vector3(-145, 0, 195));
const lampPointLights = [2, 4, 8, 9].map((idx) => {
  const p = lampPositions[idx];
  const l = new THREE.PointLight('#ffd089', 0, 90, 1);
  l.position.set(p.x, 10.5, p.z);
  scene.add(l);
  return l;
});

/* --------------------------------- sky ------------------------------------ */

const skyUniforms = {
  uTop: { value: new THREE.Color('#2f83d8') },
  uHorizon: { value: new THREE.Color('#c9ecff') },
  uSunColor: { value: new THREE.Color('#fff2c2') },
  uSunDir: { value: new THREE.Vector3(-0.74, 0.66, 0.17).normalize() },
  uSunCos: { value: Math.cos(0.055) },
  uSunEdge: { value: Math.cos(0.055 * 0.94) },
  uSunStrength: { value: 1 },
  uSunGlow: { value: 0.35 },
  uMoonColor: { value: new THREE.Color('#e9f3ff') },
  uMoonDir: { value: new THREE.Vector3(-0.42, 0.55, -0.72).normalize() },
  uMoonCutDir: { value: new THREE.Vector3(-0.36, 0.58, -0.73).normalize() },
  uMoonCos: { value: Math.cos(0.055) },
  uMoonEdge: { value: Math.cos(0.055 * 0.94) },
  uMoonStrength: { value: 0 },
};

const skyMaterial = new THREE.ShaderMaterial({
  uniforms: skyUniforms,
  vertexShader: `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uSunColor;
    uniform vec3 uSunDir;
    uniform float uSunCos;
    uniform float uSunEdge;
    uniform float uSunStrength;
    uniform float uSunGlow;
    uniform vec3 uMoonColor;
    uniform vec3 uMoonDir;
    uniform vec3 uMoonCutDir;
    uniform float uMoonCos;
    uniform float uMoonEdge;
    uniform float uMoonStrength;
    varying vec3 vDir;

    void main() {
      vec3 d = normalize(vDir);
      float h = clamp(d.y, 0.0, 1.0);
      float grad = smoothstep(0.0, 0.88, pow(h, 0.62));
      vec3 col = mix(uHorizon, uTop, grad);

      float sunDot = max(dot(d, uSunDir), 0.0);
      col += uSunColor * pow(sunDot, 26.0) * uSunGlow;
      float sunDisc = smoothstep(uSunCos, uSunEdge, sunDot);
      col += uSunColor * sunDisc * uSunStrength;

      float moonDot = max(dot(d, uMoonDir), 0.0);
      float moonDisc = smoothstep(uMoonCos, uMoonEdge, moonDot);
      float cutDisc = smoothstep(uMoonCos, uMoonEdge, dot(d, uMoonCutDir));
      float crescent = max(0.0, moonDisc - cutDisc);
      col = mix(col, uMoonColor, crescent * uMoonStrength);
      col += uMoonColor * pow(moonDot, 90.0) * 0.22 * uMoonStrength;

      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
  side: THREE.BackSide,
  depthWrite: false,
  depthTest: false,
  fog: false,
});

const skySphere = new THREE.Mesh(new THREE.SphereGeometry(4500, 48, 24), skyMaterial);
skySphere.renderOrder = -1000;
skySphere.castShadow = false;
skySphere.receiveShadow = false;
scene.add(skySphere);

/* -------------------------------- stars ----------------------------------- */

const starPositions = [];
const starSizes = [];
const starPhases = [];
for (let i = 0; i < 320; i++) {
  const az = range(0, Math.PI * 2);
  const el = range(0.08, 1.45);
  const r = 4000;
  starPositions.push(
    Math.cos(el) * Math.cos(az) * r,
    Math.sin(el) * r,
    Math.cos(el) * Math.sin(az) * r
  );
  starSizes.push(range(1.2, 3.0));
  starPhases.push(range(0, Math.PI * 2));
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
starGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(starSizes, 1));
starGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(starPhases, 1));

const starUniforms = {
  uTime: { value: 0 },
  uOpacity: { value: 0 },
  uPixelRatio: { value: renderer.getPixelRatio() },
};

const starMat = new THREE.ShaderMaterial({
  uniforms: starUniforms,
  vertexShader: `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime;
    uniform float uPixelRatio;
    varying float vTwinkle;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vTwinkle = 0.55 + 0.45 * sin(uTime * 1.8 + aPhase);
      gl_PointSize = aSize * uPixelRatio * (0.7 + 0.6 * vTwinkle);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    varying float vTwinkle;
    void main() {
      vec2 p = gl_PointCoord - vec2(0.5);
      float d = length(p);
      float alpha = smoothstep(0.5, 0.18, d) * uOpacity * (0.35 + 0.65 * vTwinkle);
      if (alpha < 0.015) discard;
      vec3 col = mix(vec3(1.0, 0.95, 0.75), vec3(1.0), 0.6);
      gl_FragColor = vec4(col, alpha);
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthTest: true,
  depthWrite: false,
  fog: false,
});
const starPoints = new THREE.Points(starGeo, starMat);
starPoints.renderOrder = -900;
starPoints.visible = false;
scene.add(starPoints);

/* ------------------------------ tower geometry --------------------------- */

const H1 = 57;
const H2 = 115;
const H3 = 276;
const TOP = 300;
const ANT = 330;

function towerWidth(y) {
  if (y <= H1) {
    const t = clamp(y / H1, 0, 1);
    return 25.5 + 37.0 * Math.pow(1 - t, 1.35);
  }
  if (y <= H2) {
    const t = (y - H1) / (H2 - H1);
    return 25.5 + (19.5 - 25.5) * Math.pow(t, 0.7);
  }
  if (y <= H3) {
    const t = (y - H2) / (H3 - H2);
    return 19.5 + (8.8 - 19.5) * Math.pow(t, 0.65);
  }
  const t = clamp((y - H3) / (TOP - H3), 0, 1);
  return 8.8 + (3.4 - 8.8) * t;
}

const towerBeamGeos = [];
const towerTrimGeos = [];
const towerDeckGeos = [];
const towerStoneGeos = [];

function boxGeometry(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);
function beamGeometry(a, b, thickness) {
  const dirv = b.clone().sub(a);
  const len = dirv.length();
  if (len < 0.05) return null;
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, dirv.normalize());
  const g = new THREE.BoxGeometry(thickness, len, thickness);
  const m = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(m);
  return g;
}

function pushBeam(arr, a, b, thickness) {
  const g = beamGeometry(a, b, thickness);
  if (g) arr.push(g);
}

function cornerPoint(y, sx, sz) {
  const w = towerWidth(y);
  return new THREE.Vector3(sx * w, y, sz * w);
}

function faceCorners(y, face) {
  const w = towerWidth(y);
  if (face === 0) return [new THREE.Vector3(-w, y, -w), new THREE.Vector3(w, y, -w)];
  if (face === 1) return [new THREE.Vector3(w, y, -w), new THREE.Vector3(w, y, w)];
  if (face === 2) return [new THREE.Vector3(w, y, w), new THREE.Vector3(-w, y, w)];
  return [new THREE.Vector3(-w, y, w), new THREE.Vector3(-w, y, -w)];
}

function buildTowerLattice() {
  const levels = [];
  for (let y = 0; y < H1 - 0.01; y += 7) levels.push(y);
  levels.push(H1);

  for (let i = 0; i < levels.length - 1; i++) {
    const y0 = levels[i];
    const y1 = levels[i + 1];
    const w0 = towerWidth(y0);
    const w1 = towerWidth(y1);

    // corner posts
    const sx = [-1, 1, 1, -1];
    const sz = [-1, -1, 1, 1];
    for (let k = 0; k < 4; k++) {
      const t = (2.55 - 1.10 * (y0 / H1));
      pushBeam(towerBeamGeos,
        new THREE.Vector3(sx[k] * w0, y0, sz[k] * w0),
        new THREE.Vector3(sx[k] * w1, y1, sz[k] * w1),
        t);
    }

    for (let face = 0; face < 4; face++) {
      const b = faceCorners(y0, face);
      const t = faceCorners(y1, face);

      pushBeam(towerBeamGeos, b[0], t[1], 0.43); // X brace
      pushBeam(towerBeamGeos, b[1], t[0], 0.43);

      const bm = b[0].clone().add(b[1]).multiplyScalar(0.5);
      const tm = t[0].clone().add(t[1]).multiplyScalar(0.5);
      pushBeam(towerBeamGeos, bm, tm, 0.25);

      pushBeam(towerBeamGeos, t[0], t[1], 0.42);

      if (y0 < H1) {
        const bm0 = b[0].clone().lerp(b[1], 0.33);
        const bm1 = b[0].clone().lerp(b[1], 0.67);
        const tm0 = t[0].clone().lerp(t[1], 0.33);
        const tm1 = t[0].clone().lerp(t[1], 0.67);
        pushBeam(towerBeamGeos, bm0, tm1, 0.22);
        pushBeam(towerBeamGeos, bm1, tm0, 0.22);
      }
    }
  }

  // upper shaft
  const upperLevels = [];
  for (let y = H1; y < H3 - 0.01; y += 6) upperLevels.push(y);
  upperLevels.push(H3);

  for (let i = 0; i < upperLevels.length - 1; i++) {
    const y0 = upperLevels[i];
    const y1 = upperLevels[i + 1];
    const w0 = towerWidth(y0);
    const w1 = towerWidth(y1);
    const sx = [-1, 1, 1, -1];
    const sz = [-1, -1, 1, 1];

    for (let k = 0; k < 4; k++) {
      const t = 0.82 - 0.36 * ((y0 - H1) / (TOP - H1));
      pushBeam(towerBeamGeos,
        new THREE.Vector3(sx[k] * w0, y0, sz[k] * w0),
        new THREE.Vector3(sx[k] * w1, y1, sz[k] * w1),
        t);
    }

    for (let face = 0; face < 4; face++) {
      const b = faceCorners(y0, face);
      const t = faceCorners(y1, face);
      pushBeam(towerBeamGeos, b[0], t[1], 0.30);
      pushBeam(towerBeamGeos, b[1], t[0], 0.30);
      const bm = b[0].clone().add(b[1]).multiplyScalar(0.5);
      const tm = t[0].clone().add(t[1]).multiplyScalar(0.5);
      pushBeam(towerBeamGeos, bm, tm, 0.18);
      pushBeam(towerBeamGeos, t[0], t[1], 0.32);
    }
  }

  // final short shaft to the summit deck
  const wStart = towerWidth(H3);
  const wEnd = towerWidth(TOP);
  for (let k = 0; k < 4; k++) {
    const sx = [-1, 1, 1, -1][k];
    const sz = [-1, -1, 1, 1][k];
    pushBeam(towerBeamGeos,
      new THREE.Vector3(sx * wStart, H3, sz * wStart),
      new THREE.Vector3(sx * wEnd, TOP, sz * wEnd), 0.36);
  }
  for (let face = 0; face < 4; face++) {
    const b = faceCorners(H3, face);
    const t = faceCorners(TOP, face);
    pushBeam(towerBeamGeos, b[0], t[1], 0.25);
    pushBeam(towerBeamGeos, b[1], t[0], 0.25);
    pushBeam(towerBeamGeos, b[0], b[1], 0.30);
    pushBeam(towerBeamGeos, t[0], t[1], 0.30);
  }
}

function buildArch(face) {
  const y0 = 12;
  const apex = 44;
  const w0 = towerWidth(y0);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    const u = s * 2 - 1;
    let x, z;
    if (face === 0) { x = u * w0 * 0.97; z = -towerWidth(y0 + (apex - y0) * (1 - u * u)); }
    else if (face === 1) { x = towerWidth(y0 + (apex - y0) * (1 - u * u)); z = u * w0 * 0.97; }
    else if (face === 2) { x = u * w0 * 0.97; z = towerWidth(y0 + (apex - y0) * (1 - u * u)); }
    else { x = -towerWidth(y0 + (apex - y0) * (1 - u * u)); z = u * w0 * 0.97; }
    pts.push(new THREE.Vector3(x, y0 + (apex - y0) * (1 - u * u), z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const tube = new THREE.TubeGeometry(curve, 28, 0.78, 6, false);
  towerBeamGeos.push(tube);

  // little spandrel braces above the arch
  for (let i = 2; i <= 10; i += 2) {
    const p = pts[i];
    const up = new THREE.Vector3(
      face === 1 || face === 3 ? towerWidth(H1) : p.x,
      H1,
      face === 0 || face === 2 ? towerWidth(H1) : p.z
    );
    pushBeam(towerBeamGeos, p, up, 0.18);
  }
}

function buildDeck(y, halfSide, thickness, railSpacing) {
  towerDeckGeos.push(boxGeometry(halfSide * 2, thickness, halfSide * 2, 0, y, 0));
  const railY = y + thickness * 0.5;

  // decorative fascia
  for (const s of [-1, 1]) {
    towerTrimGeos.push(boxGeometry(halfSide * 2 + 0.6, 0.7, 0.5, 0, y, s * halfSide));
    towerTrimGeos.push(boxGeometry(0.5, 0.7, halfSide * 2 + 0.6, s * halfSide, y, 0));
  }

  // rail posts + rails on all four sides
  const postH = 2.6;
  for (let side = 0; side < 4; side++) {
    const alongX = side < 2;
    const sign = side === 0 ? 1 : side === 1 ? -1 : side === 2 ? 1 : -1;
    const count = Math.max(2, Math.floor((halfSide * 2) / railSpacing));
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      const pos = -halfSide + t * halfSide * 2;
      const x = alongX ? pos : sign * halfSide;
      const z = alongX ? sign * halfSide : pos;
      towerTrimGeos.push(boxGeometry(0.16, postH, 0.16, x, railY + postH / 2, z));
    }
    const railLen = halfSide * 2;
    for (const ry of [railY + postH * 0.55, railY + postH]) {
      if (alongX) {
        towerTrimGeos.push(boxGeometry(railLen, 0.12, 0.12, 0, ry, sign * halfSide));
      } else {
        towerTrimGeos.push(boxGeometry(0.12, 0.12, railLen, sign * halfSide, ry, 0));
      }
    }
  }

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      towerTrimGeos.push(new THREE.SphereGeometry(0.38, 8, 6).translate(sx * halfSide, railY + 2.8, sz * halfSide));
    }
  }
}

buildTowerLattice();
for (let face = 0; face < 4; face++) buildArch(face);
buildDeck(H1, 34, 2.2, 2.6);
buildDeck(H2, 23, 1.8, 2.2);
buildDeck(H3, 14, 1.5, 1.8);
buildDeck(TOP, 7.5, 1.2, 1.5);

// summit cabin and antenna
towerTrimGeos.push(boxGeometry(10.5, 5.2, 10.5, 0, TOP + 2.6, 0));
towerTrimGeos.push(boxGeometry(12.0, 0.5, 12.0, 0, TOP + 5.3, 0));
const dome = new THREE.SphereGeometry(4.2, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
dome.translate(0, TOP + 5.4, 0);
towerTrimGeos.push(dome);
towerTrimGeos.push(new THREE.CylinderGeometry(0.25, 0.7, 24, 8).translate(0, TOP + 18, 0));
for (let i = 0; i < 4; i++) {
  const y = TOP + 8 + i * 5.2;
  const len = 4.4 - i * 0.85;
  towerTrimGeos.push(boxGeometry(len * 2, 0.16, 0.16, 0, y, 0));
  towerTrimGeos.push(boxGeometry(0.16, 0.16, len * 2, 0, y, 0));
}
towerTrimGeos.push(new THREE.SphereGeometry(0.85, 10, 8).translate(0, ANT + 0.4, 0));

// stone feet
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    towerStoneGeos.push(boxGeometry(11.5, 3.2, 11.5, sx * 62.5, 1.6, sz * 62.5));
    towerStoneGeos.push(boxGeometry(9.0, 1.6, 9.0, sx * 62.5, 3.4, sz * 62.5));
  }
}

function mergeAll(arr) {
  if (!arr.length) return null;
  const merged = mergeGeometries(arr, false);
  arr.forEach((g) => g.dispose());
  return merged;
}

const towerBeamGeo = mergeAll(towerBeamGeos);
const towerTrimGeo = mergeAll(towerTrimGeos);
const towerDeckGeo = mergeAll(towerDeckGeos);
const towerStoneGeo = mergeAll(towerStoneGeos);

addMesh(scene, towerBeamGeo, towerMat, { outline: 1.45, castShadow: true, receiveShadow: true });
addMesh(scene, towerTrimGeo, towerTrimMat, { outline: 1.6, castShadow: true, receiveShadow: true });
addMesh(scene, towerDeckGeo, deckMat, { outline: 1.7, castShadow: true, receiveShadow: true });
addMesh(scene, towerStoneGeo, stoneMat, { outline: 2.0, castShadow: true, receiveShadow: true });
const beaconMesh = addMesh(scene, new THREE.SphereGeometry(0.85, 10, 8).translate(0, ANT + 0.6, 0), beaconMat, {
  outline: 1.2, castShadow: false, receiveShadow: false,
});

/* ------------------------------- the ground ------------------------------- */

const groundGeo = new THREE.PlaneGeometry(5200, 5200);
groundGeo.rotateX(-Math.PI / 2);
addMesh(scene, groundGeo, grassBaseMat, { outline: 0, castShadow: false, receiveShadow: true });

const plazaGeo = new THREE.CircleGeometry(93, 72);
plazaGeo.rotateX(-Math.PI / 2);
plazaGeo.translate(0, 0.04, 0);
addMesh(scene, plazaGeo, plazaMat, { outline: 0, castShadow: false, receiveShadow: true });

const plazaRimGeo = new THREE.TorusGeometry(93.2, 0.9, 8, 72);
plazaRimGeo.rotateX(-Math.PI / 2);
plazaRimGeo.translate(0, 0.15, 0);
addMesh(scene, plazaRimGeo, stoneMat, { outline: 1.1, castShadow: true, receiveShadow: true });

function flatPlane(w, d, cx, cz, y, mat, outline = 0) {
  const g = new THREE.PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, y, cz);
  return addMesh(scene, g, mat, { outline, castShadow: false, receiveShadow: true });
}

flatPlane(232, 515, -146, -352, 0.03, lawnMat);
flatPlane(232, 515, 146, -352, 0.03, lawnMat);
flatPlane(36, 520, 0, -352, 0.06, pathMat);
flatPlane(40, 270, 0, 225, 0.06, pathMat);
flatPlane(28, 220, -80, 150, 0.055, lawnMat);
flatPlane(28, 220, 80, 150, 0.055, lawnMat);
// little walkways out to the fountain and the kiosk
flatPlane(100, 17, 70, 120, 0.064, pathMat);
flatPlane(60, 16, -50, 170, 0.064, pathMat);

/* -------------------------------- fountain -------------------------------- */

// A paved apron keeps the foreground fountain sitting in the scene,
// rather than floating on an empty green field.
const fountainPad = new THREE.CircleGeometry(36.5, 56).rotateX(-Math.PI / 2).translate(150, 0.062, 120);
addMesh(scene, fountainPad, plazaMat, { outline: 0, castShadow: false, receiveShadow: true });
const fountainPadRim = new THREE.TorusGeometry(36.5, 0.75, 8, 56).rotateX(-Math.PI / 2).translate(150, 0.12, 120);
addMesh(scene, fountainPadRim, stoneMat, { outline: 1.1, castShadow: true, receiveShadow: true });

const fountainGroup = new THREE.Group();
fountainGroup.position.set(150, 0, 120);
fountainGroup.scale.setScalar(1.7);
scene.add(fountainGroup);

const fountainStoneGeos = [];
fountainStoneGeos.push(new THREE.CylinderGeometry(18.5, 19.2, 1.2, 36).translate(0, 0.6, 0));
fountainStoneGeos.push(new THREE.TorusGeometry(17.4, 0.9, 8, 36).rotateX(-Math.PI / 2).translate(0, 1.25, 0));
fountainStoneGeos.push(new THREE.CylinderGeometry(2.7, 3.0, 4.0, 20).translate(0, 3.2, 0));
fountainStoneGeos.push(new THREE.CylinderGeometry(5.7, 3.7, 0.9, 24).translate(0, 5.55, 0));
fountainStoneGeos.push(new THREE.CylinderGeometry(1.05, 1.25, 2.5, 16).translate(0, 7.3, 0));
fountainStoneGeos.push(new THREE.CylinderGeometry(3.6, 2.1, 0.7, 20).translate(0, 8.9, 0));
const fountainStoneGeo = mergeAll(fountainStoneGeos);
addMesh(fountainGroup, fountainStoneGeo, stoneMat, { outline: 1.9, castShadow: true, receiveShadow: true });

const fountainWaterGeos = [];
const basinWater = new THREE.CircleGeometry(16.0, 40).rotateX(-Math.PI / 2).translate(0, 1.45, 0);
const bowlWater = new THREE.CircleGeometry(4.9, 24).rotateX(-Math.PI / 2).translate(0, 6.05, 0);
const topWater = new THREE.CircleGeometry(2.9, 20).rotateX(-Math.PI / 2).translate(0, 9.28, 0);
fountainWaterGeos.push(basinWater, bowlWater, topWater);
const fountainWaterGeo = mergeAll(fountainWaterGeos);
const fountainWaterMesh = addMesh(fountainGroup, fountainWaterGeo, waterMat, {
  outline: 0, castShadow: false, receiveShadow: false,
});

const dropletGeo = new THREE.SphereGeometry(0.24, 6, 4);
const dropletCount = 22;
const dropletMesh = new THREE.InstancedMesh(dropletGeo, dropletMat, dropletCount);
dropletMesh.castShadow = false;
dropletMesh.receiveShadow = false;
fountainGroup.add(dropletMesh);

const dropletData = [];
for (let i = 0; i < dropletCount; i++) {
  dropletData.push({
    angle: (i / dropletCount) * Math.PI * 2 + range(-0.2, 0.2),
    phase: rand(),
    speed: range(0.25, 0.42),
    radius: range(1.2, 4.4),
  });
}
const dropletMatrix = new THREE.Matrix4();
const dropletPos = new THREE.Vector3();
const dropletScale = new THREE.Vector3(1, 1, 1);

/* -------------------------------- kiosk ----------------------------------- */

flatPlane(32, 23, -90, 170, 0.063, pathMat);
const kioskGroup = new THREE.Group();
kioskGroup.position.set(-90, 0, 170);
kioskGroup.scale.setScalar(2.0);
scene.add(kioskGroup);

const kioskBodyGeo = boxGeometry(13, 4.5, 8, 0, 2.25, 0);
addMesh(kioskGroup, kioskBodyGeo, kioskBodyMat, { outline: 1.9, castShadow: true, receiveShadow: true });

const kioskTrimGeos = [];
kioskTrimGeos.push(boxGeometry(13.6, 0.45, 8.4, 0, 4.45, 0));
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    kioskTrimGeos.push(new THREE.CylinderGeometry(0.16, 0.18, 5.5, 6).translate(sx * 6.1, 2.75, sz * 3.7));
  }
}
kioskTrimGeos.push(boxGeometry(13.2, 0.5, 8.2, 0, 4.6, 0));
kioskTrimGeos.push(boxGeometry(13.8, 0.5, 0.7, 0, 4.75, 4.2));
// balloon strings
const balloonCluster = new THREE.Group();
balloonCluster.position.set(5.2, 6.0, 1.0);
kioskGroup.add(balloonCluster);
for (let i = 0; i < 6; i++) {
  const bx = range(-2.6, 2.6);
  const bz = range(-1.8, 1.8);
  const by = range(0.3, 3.3);
  kioskTrimGeos.push(beamGeometry(
    new THREE.Vector3(5.2, 4.2, 1.0),
    new THREE.Vector3(5.2 + bx, 6.0 + by, 1.0 + bz),
    0.035
  ));
}
const kioskTrimGeo = mergeAll(kioskTrimGeos);
addMesh(kioskGroup, kioskTrimGeo, kioskTrimMat, { outline: 0, castShadow: true, receiveShadow: true });

const awningGeo = boxGeometry(14.5, 0.55, 9.4, 0, 4.85, 0);
addMesh(kioskGroup, awningGeo, awningMat, { outline: 1.3, castShadow: true, receiveShadow: true });

const signGeo = new THREE.PlaneGeometry(10, 3.2).translate(0, 2.9, 4.25);
addMesh(kioskGroup, signGeo, signMat, { outline: 0, castShadow: false, receiveShadow: false });

const balloonGeos = [[], [], [], [], []];
const balloonCollision = [];
for (let i = 0; i < 6; i++) {
  let bx, by, bz;
  do {
    bx = range(-3.0, 3.0);
    by = range(0.2, 4.0);
    bz = range(-2.2, 2.2);
  } while (balloonCollision.some((p) => Math.hypot(p.x - bx, p.y - by, p.z - bz) < 1.8));
  balloonCollision.push({ x: bx, y: by, z: bz });
  const r = range(0.9, 1.35);
  const g = new THREE.SphereGeometry(r, 10, 8);
  g.scale(1, 1.18, 1);
  g.translate(bx, by, bz);
  balloonGeos[i % 5].push(g);
}
for (let i = 0; i < 5; i++) {
  const merged = mergeAll(balloonGeos[i]);
  if (merged) addMesh(balloonCluster, merged, balloonMats[i], { outline: 1.2, castShadow: false, receiveShadow: false });
}

/* --------------------------------- lamps ---------------------------------- */

const lampPostGeos = [];
const lampGlowGeos = [];
const lampFrameGeos = [];

for (const p of lampPositions) {
  lampPostGeos.push(new THREE.CylinderGeometry(0.28, 0.42, 9.6, 8).translate(p.x, 4.8, p.z));
  lampPostGeos.push(new THREE.CylinderGeometry(0.52, 0.62, 0.8, 8).translate(p.x, 0.4, p.z));
  lampPostGeos.push(new THREE.CylinderGeometry(0.2, 0.25, 0.9, 8).translate(p.x, 9.85, p.z));
  lampGlowGeos.push(new THREE.SphereGeometry(0.82, 10, 8).translate(p.x, 10.7, p.z));
  const cap = new THREE.ConeGeometry(1.0, 1.05, 8).translate(p.x, 11.65, p.z);
  lampFrameGeos.push(cap);
  const ring = new THREE.TorusGeometry(0.88, 0.07, 5, 12).rotateX(Math.PI / 2).translate(p.x, 10.7, p.z);
  lampFrameGeos.push(ring);
}
const lampPostGeo = mergeAll(lampPostGeos);
const lampGlowGeo = mergeAll(lampGlowGeos);
const lampFrameGeo = mergeAll(lampFrameGeos);
addMesh(scene, lampPostGeo, lampPostMat, { outline: 1.3, castShadow: true, receiveShadow: true });
addMesh(scene, lampGlowGeo, lampGlowMat, { outline: 1.1, castShadow: false, receiveShadow: false });
addMesh(scene, lampFrameGeo, lampFrameMat, { outline: 0, castShadow: true, receiveShadow: false });

/* --------------------------------- trees ---------------------------------- */

const leafGeos = [[], [], []];
const trunkGeos = [];
const bedGeos = [];
const flowerGeos = [[], [], [], []];
const stemGeos = [];

function addTree(x, z, radius, trunkHeight, leafIdx) {
  const trunk = new THREE.CylinderGeometry(radius * 0.16, radius * 0.25, trunkHeight, 6);
  trunk.translate(x, trunkHeight / 2, z);
  trunkGeos.push(trunk);

  const crownY = trunkHeight + radius * 0.86;
  const spheres = [
    [0, crownY, 0, radius, 1.06],
    [radius * 0.55, crownY - radius * 0.36, radius * 0.22, radius * 0.68, 0.95],
    [-radius * 0.48, crownY - radius * 0.24, -radius * 0.28, radius * 0.62, 0.92],
  ];
  for (const [ox, oy, oz, r, sy] of spheres) {
    const g = new THREE.SphereGeometry(r, 9, 7);
    g.scale(1, sy, 1);
    g.translate(x + ox, oy, z + oz);
    leafGeos[leafIdx].push(g);
  }
}

const treePositions = [];
// foreground frame trees
treePositions.push([-215, 160, 9.6, 6.8, 0]);
treePositions.push([230, 95, 8.2, 6.0, 2]);
treePositions.push([-252, -48, 7.8, 5.8, 1]);
treePositions.push([258, -105, 8.8, 6.2, 0]);
treePositions.push([-200, 210, 13.0, 8.5, 1]);
treePositions.push([295, 45, 12.2, 8.0, 0]);
// round the plaza
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2 + 0.4;
  const r = 128 + range(-8, 8);
  if (Math.abs(Math.cos(a) * r) < 100 && Math.sin(a) * r > 90) continue;
  treePositions.push([Math.cos(a) * r, Math.sin(a) * r, range(5.5, 7.6), range(4.4, 6.2), i % 3]);
}
// rows along the Champ de Mars
for (let i = 0; i < 12; i++) {
  const z = -120 - i * 42;
  treePositions.push([-33 + range(-2, 2), z, range(5.0, 6.6), range(4.2, 5.8), i % 3]);
  treePositions.push([33 + range(-2, 2), z, range(5.0, 6.6), range(4.2, 5.8), (i + 1) % 3]);
}
for (let i = 0; i < 9; i++) {
  const z = -135 - i * 55;
  treePositions.push([-236 + range(-10, 10), z, range(5.6, 7.8), range(4.6, 6.4), (i + 2) % 3]);
  treePositions.push([236 + range(-10, 10), z, range(5.6, 7.8), range(4.6, 6.4), i % 3]);
}
for (const [x, z, r, h, idx] of treePositions) addTree(x, z, r, h, idx);

// flower beds around the fountain and plaza
function addFlower(x, z, colorIdx, stemHeight = range(0.5, 0.9)) {
  const stem = boxGeometry(0.07, stemHeight, 0.07, x, stemHeight / 2, z);
  stemGeos.push(stem);
  const petal = new THREE.SphereGeometry(range(0.24, 0.42), 6, 4);
  petal.scale(1.1, 0.7, 1.1);
  petal.translate(x, stemHeight + 0.12, z);
  flowerGeos[colorIdx].push(petal);
}

for (let i = 0; i < 80; i++) {
  const a = (i / 80) * Math.PI * 2;
  const r = 39.4 + range(-0.8, 0.8);
  addFlower(150 + Math.cos(a) * r, 120 + Math.sin(a) * r, i % 4);
}
// beds beside the approach path
for (let b = 0; b < 4; b++) {
  const x = (b < 2 ? -24 : 24);
  const z = 155 + (b % 2) * 88;
  bedGeos.push(boxGeometry(7, 0.35, 18, x, 0.2, z));
  for (let i = 0; i < 18; i++) {
    addFlower(x + range(-2.6, 2.6), z + range(-7.5, 7.5), randInt(0, 3));
  }
}
// small beds at the kiosk
bedGeos.push(boxGeometry(10, 0.35, 7, -125, 0.2, 195));
for (let i = 0; i < 26; i++) {
  addFlower(-125 + range(-4.2, 4.2), 195 + range(-2.8, 2.8), randInt(0, 3));
}

const trunkGeo = mergeAll(trunkGeos);
addMesh(scene, trunkGeo, trunkMat, { outline: 1.35, castShadow: true, receiveShadow: true });
for (let i = 0; i < 3; i++) {
  const merged = mergeAll(leafGeos[i]);
  if (merged) addMesh(scene, merged, leafMats[i], { outline: 1.55, castShadow: true, receiveShadow: true });
}
const bedGeo = mergeAll(bedGeos);
if (bedGeo) addMesh(scene, bedGeo, bedMat, { outline: 0, castShadow: true, receiveShadow: true });
const stemGeo = mergeAll(stemGeos);
if (stemGeo) addMesh(scene, stemGeo, bedMat, { outline: 0, castShadow: false, receiveShadow: true });
for (let i = 0; i < 4; i++) {
  const merged = mergeAll(flowerGeos[i]);
  if (merged) addMesh(scene, merged, flowerMats[i], { outline: 0, castShadow: false, receiveShadow: false });
}

/* --------------------------------- benches -------------------------------- */

function benchGeometry(x, z, angle) {
  const geos = [];
  const seat = boxGeometry(2.8, 0.22, 0.8, 0, 0.62, 0);
  const back = boxGeometry(2.8, 0.85, 0.16, 0, 1.08, -0.34);
  const legs = [];
  for (const lx of [-1.1, 1.1]) {
    legs.push(boxGeometry(0.16, 0.62, 0.16, lx, 0.31, -0.28));
    legs.push(boxGeometry(0.16, 0.62, 0.16, lx, 0.31, 0.28));
  }
  for (const g of [seat, back, ...legs]) {
    g.rotateY(angle);
    g.translate(x, 0, z);
    geos.push(g);
  }
  return mergeAll(geos);
}

const benchGeos = [];
const benchSpots = [
  [-68, 105, 0.55], [72, 102, -0.6], [-106, -72, 2.4],
  [112, -82, -2.1], [-136, 36, 1.0], [140, 22, -1.1],
  [94, 78, -0.35], [-155, 188, 0.75],
];
for (const [x, z, a] of benchSpots) benchGeos.push(benchGeometry(x, z, a));
const benchGeo = mergeAll(benchGeos);
if (benchGeo) addMesh(scene, benchGeo, benchWoodMat, { outline: 1.2, castShadow: true, receiveShadow: true });

/* --------------------------------- city ----------------------------------- */

const wallGeos = [[], [], [], []];
const roofAGeos = [];
const roofBGeos = [];
const cityTrimGeos = [];
const doorGeos = [];
const shopAwningGeos = [];
const roofTile = 9;

function facadeBox(w, h, d, cx, cy, cz) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const uScale = [d / roofTile, d / roofTile, w / roofTile, w / roofTile, w / roofTile, w / roofTile];
  const vScale = [h / roofTile, h / roofTile, d / roofTile, d / roofTile, h / roofTile, h / roofTile];
  for (let face = 0; face < 6; face++) {
    for (let k = 0; k < 4; k++) {
      const idx = face * 8 + k * 2;
      uv.array[idx] *= uScale[face];
      uv.array[idx + 1] *= vScale[face];
    }
  }
  uv.needsUpdate = true;
  g.translate(cx, cy, cz);
  return g;
}

function roofGeometry(w, d, h, cx, cz, inset) {
  const botR = d / Math.sqrt(2);
  const topR = botR * inset;
  const g = new THREE.CylinderGeometry(topR, botR, h, 4, 1, false);
  g.rotateY(Math.PI / 4);
  g.scale(w / d, 1, 1);
  g.translate(cx, h / 2, cz);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}

function flatBox(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g.toNonIndexed();
}

function addBuilding(cx, cz, w, d, h, variant, roofVariant) {
  wallGeos[variant].push(facadeBox(w, h, d, cx, h / 2, cz));
  const roofH = clamp(d * 0.22, 4.5, 8.5);
  const roof = roofGeometry(w + 0.8, d + 0.8, roofH, cx, cz, 0.70);
  roof.translate(0, h, 0);
  (roofVariant === 0 ? roofAGeos : roofBGeos).push(roof);

  cityTrimGeos.push(boxGeometry(w + 1.4, 0.7, d + 1.4, cx, h - 0.35, cz));
  cityTrimGeos.push(boxGeometry(w + 0.8, 1.2, d + 0.8, cx, 0.6, cz));

  const chimneys = randInt(1, 2);
  for (let i = 0; i < chimneys; i++) {
    const chx = cx + range(-w * 0.32, w * 0.32);
    const chz = cz + range(-d * 0.28, d * 0.28);
    const ch = flatBox(1.1, range(2.0, 3.2), 1.1, chx, h + roofH + 1.2, chz);
    (roofVariant === 0 ? roofAGeos : roofBGeos).push(ch);
  }

  doorGeos.push(boxGeometry(2.3, 3.4, 0.25, cx + range(-w * 0.2, w * 0.2), 1.7, cz + d / 2 + 0.04));
  const awn = boxGeometry(range(5, 9), 0.28, 1.1, cx + range(-w * 0.2, w * 0.2), 3.35, cz + d / 2 + 0.45);
  shopAwningGeos.push(awn);
}

const sideZ = [-115, -208, -301, -394, -487, -580, -673];
for (let i = 0; i < sideZ.length; i++) {
  const leftX = -320 - range(0, 58);
  const rightX = 320 + range(0, 58);
  addBuilding(leftX, sideZ[i], range(38, 58), range(34, 48), range(34, 64), i % 4, i % 2);
  addBuilding(rightX, sideZ[i] + range(-12, 12), range(38, 58), range(34, 48), range(34, 64), (i + 1) % 4, (i + 1) % 2);
}

for (let i = 0; i < 7; i++) {
  const x = -520 + i * 170 + range(-10, 10);
  addBuilding(x, -790 + range(-35, 20), range(58, 88), range(38, 58), range(40, 76), i % 4, (i + 2) % 2);
}

for (let i = 0; i < 4; i++) {
  const x = -430 + i * 290;
  addBuilding(x, 700 + range(-30, 30), range(55, 80), range(40, 55), range(36, 66), i % 4, i % 2);
}
for (let i = 0; i < 3; i++) {
  addBuilding(-390 + i * 390, 560 + range(-20, 20), range(35, 55), range(32, 46), range(30, 56), (i + 2) % 4, i % 2);
}

const wallMeshRefs = [];
for (let i = 0; i < 4; i++) {
  const merged = mergeAll(wallGeos[i]);
  if (merged) wallMeshRefs.push(addMesh(scene, merged, wallMats[i], { outline: 2.0, castShadow: true, receiveShadow: true }));
}
const roofA = mergeAll(roofAGeos);
const roofB = mergeAll(roofBGeos);
if (roofA) addMesh(scene, roofA, roofMatA, { outline: 1.9, castShadow: true, receiveShadow: true });
if (roofB) addMesh(scene, roofB, roofMatB, { outline: 1.9, castShadow: true, receiveShadow: true });
const cityTrimGeo = mergeAll(cityTrimGeos);
if (cityTrimGeo) addMesh(scene, cityTrimGeo, cityTrimMat, { outline: 0, castShadow: true, receiveShadow: true });
const doorGeo = mergeAll(doorGeos);
if (doorGeo) addMesh(scene, doorGeo, cityDoorMat, { outline: 0, castShadow: false, receiveShadow: true });
const shopAwningGeo = mergeAll(shopAwningGeos);
if (shopAwningGeo) addMesh(scene, shopAwningGeo, awningSolidMat, { outline: 0, castShadow: true, receiveShadow: true });

/* ----------------------------- distant hills ------------------------------- */

const hillGeos = [];
for (let i = 0; i < 16; i++) {
  const a = (i / 16) * Math.PI * 2 + range(-0.1, 0.1);
  const r = 1800 + range(0, 500);
  const w = range(260, 500);
  const d = range(230, 450);
  const h = range(45, 115);
  const g = new THREE.SphereGeometry(1, 11, 6);
  g.scale(w, h, d);
  g.translate(Math.cos(a) * r, -6, Math.sin(a) * r);
  hillGeos.push(g);
}
const hillGeo = mergeAll(hillGeos);
if (hillGeo) addMesh(scene, hillGeo, hillMat, { outline: 0, castShadow: false, receiveShadow: false });

/* --------------------------------- clouds --------------------------------- */

function cloudGeometry(size) {
  const geos = [];
  const parts = [
    [0, 0, 0, size * 0.52, 0.74],
    [-size * 0.38, -size * 0.05, size * 0.05, size * 0.38, 0.68],
    [size * 0.40, -size * 0.02, -size * 0.06, size * 0.42, 0.70],
    [size * 0.15, size * 0.22, 0.02, size * 0.34, 0.80],
    [-size * 0.16, size * 0.20, -0.03, size * 0.30, 0.78],
    [size * 0.62, -size * 0.10, size * 0.02, size * 0.24, 0.68],
  ];
  for (const [x, y, z, r, sy] of parts) {
    const g = new THREE.SphereGeometry(r, 10, 7);
    g.scale(1, sy, 1);
    g.translate(x, y, z);
    geos.push(g);
  }
  return mergeAll(geos);
}

const cloudGroups = [];
const cloudSpecs = [
  [-360, 286, -430, 72, 1.8],
  [290, 252, -390, 56, 1.2],
  [-150, 322, -660, 86, 2.1],
  [470, 302, -530, 64, 1.5],
  [-520, 230, -235, 58, 1.0],
  [90, 360, -760, 48, 1.7],
];
for (const [bx, by, bz, size, speed] of cloudSpecs) {
  const group = new THREE.Group();
  group.position.set(bx, by, bz);
  const geo = cloudGeometry(size);
  addMesh(group, geo, cloudMat, { outline: 1.35, castShadow: false, receiveShadow: false });
  scene.add(group);
  cloudGroups.push({ group, baseX: bx, baseY: by, baseZ: bz, speed, span: 1600 });
}

/* ------------------------------ hot-air balloon --------------------------- */

const hotAir = new THREE.Group();
hotAir.position.set(200, 220, -230);
hotAir.scale.setScalar(1.25);
scene.add(hotAir);

const envelopePoints = [];
const envR = 15;
const envH = 33;
for (let i = 0; i <= 16; i++) {
  const t = i / 16;
  // Lathe points run bottom-to-top so the envelope normals face outwards.
  const y = -envH * 0.5 + envH * t;
  const r = envR * Math.pow(Math.sin(Math.PI * t), 0.62);
  envelopePoints.push(new THREE.Vector2(Math.max(0.4, r), y));
}
const envelopeGeo = new THREE.LatheGeometry(envelopePoints, 24);
addMesh(hotAir, envelopeGeo, hotAirMat, { outline: 1.8, castShadow: false, receiveShadow: false });

const basketGeo = boxGeometry(4.2, 2.8, 4.2, 0, -18.4, 0);
addMesh(hotAir, basketGeo, basketMat, { outline: 1.2, castShadow: false, receiveShadow: false });
const ropeGeos = [];
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    ropeGeos.push(beamGeometry(
      new THREE.Vector3(sx * 1.8, -17.2, sz * 1.8),
      new THREE.Vector3(sx * 5.1, -envH * 0.5 + 0.5, sz * 5.1),
      0.07
    ));
  }
}
const ropeGeo = mergeAll(ropeGeos);
addMesh(hotAir, ropeGeo, basketMat, { outline: 0, castShadow: false, receiveShadow: false });

/* --------------------------------- birds ---------------------------------- */

const birds = [];
const birdGeo = new THREE.BoxGeometry(3.4, 0.22, 0.7);
birdGeo.translate(-1.7, 0, 0);
const birdGeoR = new THREE.BoxGeometry(3.4, 0.22, 0.7);
birdGeoR.translate(1.7, 0, 0);

function addBird(cx, cy, cz, radius, speed, phase, sizeScale) {
  const group = new THREE.Group();
  const left = new THREE.Mesh(birdGeo, birdMat);
  const right = new THREE.Mesh(birdGeoR, birdMat);
  left.scale.setScalar(sizeScale);
  right.scale.setScalar(sizeScale);
  left.position.set(0, 0, 0);
  right.position.set(0, 0, 0);
  group.add(left, right);
  scene.add(group);
  birds.push({ group, left, right, cx, cy, cz, radius, speed, phase });
}

for (let i = 0; i < 7; i++) {
  addBird(range(-80, 130), range(250, 325), range(-460, -220), range(60, 160), range(0.9, 1.4), rand() * Math.PI * 2, range(0.7, 1.1));
}

/* --------------------------------- flag ----------------------------------- */

const flagUniforms = {
  uTime: { value: 0 },
  uBlue: { value: new THREE.Color('#2e59b5') },
  uWhite: { value: new THREE.Color('#fff4e4') },
  uRed: { value: new THREE.Color('#e45358') },
};

const flagGeo = new THREE.PlaneGeometry(11, 4, 18, 4);
const flagMat = new THREE.ShaderMaterial({
  uniforms: flagUniforms,
  vertexShader: `
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec3 p = position;
      float wave = sin(p.x * 0.9 + uTime * 4.2) * 0.42 * smoothstep(0.0, 0.9, uv.x);
      p.z += wave;
      p.y += sin(p.x * 1.2 + uTime * 3.5) * 0.12 * smoothstep(0.0, 0.9, uv.x);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uBlue;
    uniform vec3 uWhite;
    uniform vec3 uRed;
    varying vec2 vUv;
    void main() {
      vec3 col;
      if (vUv.x < 0.333) col = uBlue;
      else if (vUv.x < 0.666) col = uWhite;
      else col = uRed;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
  side: THREE.DoubleSide,
});
const flagMesh = new THREE.Mesh(flagGeo, flagMat);
flagMesh.position.set(12, TOP + 9.2, 0);
flagMesh.castShadow = false;
flagMesh.receiveShadow = false;
scene.add(flagMesh);

const flagPoleGeo = new THREE.CylinderGeometry(0.16, 0.2, 11.5, 6).translate(6.2, TOP + 6.0, 0);
addMesh(scene, flagPoleGeo, towerTrimMat, { outline: 0.8, castShadow: true, receiveShadow: false });

/* -------------------------------- sparkles -------------------------------- */

const sparkPositions = [];
const sparkSizes = [];
const sparkPhases = [];
for (let i = 0; i < 240; i++) {
  const y = range(45, ANT - 4);
  const w = towerWidth(Math.min(y, TOP));
  const onCorner = rand() < 0.45;
  let x, z;
  if (onCorner) {
    const sx = rand() < 0.5 ? -1 : 1;
    const sz = rand() < 0.5 ? -1 : 1;
    x = sx * w;
    z = sz * w;
  } else {
    const face = randInt(0, 3);
    const u = range(-1, 1);
    if (face === 0) { x = u * w; z = -w; }
    else if (face === 1) { x = w; z = u * w; }
    else if (face === 2) { x = u * w; z = w; }
    else { x = -w; z = u * w; }
  }
  const outward = new THREE.Vector3(x, 0, z).normalize().multiplyScalar(0.9);
  sparkPositions.push(x + outward.x, y, z + outward.z);
  sparkSizes.push(range(1.6, 4.2));
  sparkPhases.push(range(0, Math.PI * 2));
}

const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(sparkPositions, 3));
sparkGeo.setAttribute('aSize', new THREE.Float32BufferAttribute(sparkSizes, 1));
sparkGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(sparkPhases, 1));

const sparkUniforms = {
  uTime: { value: 0 },
  uOpacity: { value: 0 },
  uPixelRatio: { value: renderer.getPixelRatio() },
};
const sparkMat = new THREE.ShaderMaterial({
  uniforms: sparkUniforms,
  vertexShader: `
    attribute float aSize;
    attribute float aPhase;
    uniform float uTime;
    uniform float uPixelRatio;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float twinkle = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 3.4 + aPhase), 2.0);
      gl_PointSize = aSize * uPixelRatio * twinkle;
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform float uOpacity;
    void main() {
      vec2 p = gl_PointCoord - vec2(0.5);
      float d = length(p);
      float alpha = smoothstep(0.5, 0.16, d) * uOpacity;
      if (alpha < 0.015) discard;
      vec3 col = vec3(1.0, 0.88, 0.54);
      gl_FragColor = vec4(col, alpha);
      #include <colorspace_fragment>
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthTest: true,
  depthWrite: false,
  fog: false,
});
const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
sparkPoints.visible = false;
scene.add(sparkPoints);

/* ------------------------------ camera / UI ------------------------------- */

const modeButtons = [...document.querySelectorAll('.mode')];

function applyMode(mode) {
  currentMode = mode;
  const info = MODE_INFO[mode];

  for (const b of bindings) {
    b.mat.color.copy(b[mode]);
    if (b.emissive) {
      b.mat.emissive.copy(b.emissive[mode]);
      b.mat.emissiveIntensity = b.emissiveIntensity[mode];
    }
  }

  ambientLight.color.set(info.ambient);
  ambientLight.intensity = info.ambientIntensity;

  sunTarget.position.set(0, 120, 0);
  sunLight.position.copy(sunTarget.position).addScaledVector(info.lightDir, 700);
  sunLight.color.set(info.lightColor);
  sunLight.intensity = info.lightIntensity;

  fillLight.position.copy(sunTarget.position).addScaledVector(info.fillDir, 500);
  fillLight.color.set(info.fillColor);
  fillLight.intensity = info.fillIntensity;

  towerPointLights.forEach((l) => {
    l.color.set('#ffc46b');
    l.intensity = info.towerLight;
  });
  lampPointLights.forEach((l) => {
    l.color.set('#ffd089');
    l.intensity = info.lampLight;
  });

  scene.fog.color.set(info.fog);
  scene.fog.density = info.fogDensity;
  outlineInk.value.set(info.ink);
  outlineFogColor.value.copy(scene.fog.color);
  outlineFogDensity.value = info.fogDensity;

  skyUniforms.uTop.value.set(info.skyTop);
  skyUniforms.uHorizon.value.set(info.skyHorizon);
  skyUniforms.uSunColor.value.set(info.sunColor);
  skyUniforms.uSunDir.value.copy(info.sunDir);
  skyUniforms.uSunCos.value = Math.cos(info.sunSize);
  skyUniforms.uSunEdge.value = Math.cos(info.sunSize * 0.98);
  skyUniforms.uSunStrength.value = info.sunStrength;
  skyUniforms.uSunGlow.value = info.sunGlow;
  skyUniforms.uMoonColor.value.set(info.moonColor);
  skyUniforms.uMoonDir.value.copy(info.moonDir);
  skyUniforms.uMoonCos.value = Math.cos(info.moonSize);
  skyUniforms.uMoonEdge.value = Math.cos(info.moonSize * 0.98);
  skyUniforms.uMoonStrength.value = info.moonStrength;
  const moonAxis = new THREE.Vector3().crossVectors(info.moonDir, UP);
  if (moonAxis.lengthSq() < 1e-4) moonAxis.set(1, 0, 0);
  moonAxis.normalize();
  skyUniforms.uMoonCutDir.value.copy(info.moonDir).applyAxisAngle(moonAxis, info.moonSize * 0.62);

  starUniforms.uOpacity.value = info.stars;
  starPoints.visible = info.stars > 0.01;
  sparkUniforms.uOpacity.value = info.sparkle;
  sparkPoints.visible = info.sparkle > 0.01;
  beaconMat.emissiveIntensity = info.beacon;

  document.body.dataset.mode = mode;
  modeButtons.forEach((btn) => {
    const active = btn.dataset.mode === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  const url = new URL(window.location.href);
  url.searchParams.set('tod', mode);
  history.replaceState(null, '', url);

  renderer.shadowMap.needsUpdate = true;
}

modeButtons.forEach((btn) => {
  btn.addEventListener('click', () => applyMode(btn.dataset.mode));
});

const requested = new URLSearchParams(window.location.search).get('tod');
applyMode(['day', 'dusk', 'night'].includes(requested) ? requested : 'day');

/* ------------------------------- animation -------------------------------- */

const timer = new THREE.Timer();
timer.connect(document);
const dropletMatrixArr = [];
const birdTmp = new THREE.Vector3();
const cloudWrap = 1700;

function animateDroplets(t) {
  for (let i = 0; i < dropletCount; i++) {
    const d = dropletData[i];
    const tt = (t * d.speed + d.phase) % 1;
    const y = 9.4 + 3.1 * tt - 10.5 * tt * tt;
    const radial = d.radius * tt;
    dropletPos.set(Math.cos(d.angle) * radial, Math.max(0.6, y), Math.sin(d.angle) * radial);
    dropletMatrix.compose(dropletPos, new THREE.Quaternion(), dropletScale);
    dropletMesh.setMatrixAt(i, dropletMatrix);
  }
  dropletMesh.instanceMatrix.needsUpdate = true;
}

function animate() {
  timer.update();
  const t = timer.getElapsed();
  controls.update();

  // clouds drift gently
  for (const c of cloudGroups) {
    let x = c.baseX + t * c.speed;
    x = ((x + cloudWrap * 0.5) % cloudWrap) - cloudWrap * 0.5;
    c.group.position.x = x;
    c.group.position.y = c.baseY + Math.sin(t * 0.08 + c.baseZ * 0.01) * 1.3;
  }

  // hot-air balloon floats along
  hotAir.position.x = 200 + Math.sin(t * 0.07) * 38 + t * 0.6;
  hotAir.position.y = 220 + Math.sin(t * 0.38) * 2.8;
  hotAir.position.z = -230 + Math.cos(t * 0.05) * 14;

  // balloons over the kiosk bob
  balloonCluster.position.y = 6.0 + Math.sin(t * 0.9) * 0.35;
  balloonCluster.rotation.y = Math.sin(t * 0.22) * 0.08;

  // birds
  for (const b of birds) {
    const a = b.phase + t * b.speed;
    b.group.position.set(
      b.cx + Math.cos(a) * b.radius,
      b.cy + Math.sin(a * 1.7) * 6.5,
      b.cz + Math.sin(a) * b.radius * 0.55
    );
    b.group.rotation.y = -a + Math.PI / 2;
    const flap = Math.sin(t * 5.0 + b.phase) * 0.55;
    b.left.rotation.z = 0.33 + flap;
    b.right.rotation.z = -0.33 - flap;
  }

  animateDroplets(t);
  waterMat.map.rotation = t * 0.035;
  waterMat.map.center.set(0.5, 0.5);

  flagUniforms.uTime.value = t;
  starUniforms.uTime.value = t;
  sparkUniforms.uTime.value = t;

  beaconMat.emissiveIntensity = MODE_INFO[currentMode].beacon * (0.78 + 0.22 * Math.sin(t * 2.2));

  renderer.render(scene, camera);
}

/* --------------------------------- resize --------------------------------- */

function updateOutlineScale() {
  const h = renderer.domElement.clientHeight || window.innerHeight;
  outlinePxScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  starUniforms.uPixelRatio.value = renderer.getPixelRatio();
  sparkUniforms.uPixelRatio.value = renderer.getPixelRatio();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateOutlineScale();
}
window.addEventListener('resize', onResize);
updateOutlineScale();

renderer.setAnimationLoop(animate);
