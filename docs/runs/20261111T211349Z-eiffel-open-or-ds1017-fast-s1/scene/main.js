import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SkyDome } from './sky.js';
import { buildTower } from './tower.js';
import { buildWorld, groundTextures } from './world.js';
import { InkOutline } from './outline.js';

/* ================================================================== *
 *  Toon ramp — four hard bands
 * ================================================================== */
const rampData = new Uint8Array([108, 166, 214, 255]);
const ramp = new THREE.DataTexture(rampData, rampData.length, 1, THREE.RedFormat);
ramp.minFilter = THREE.NearestFilter;
ramp.magFilter = THREE.NearestFilter;
ramp.generateMipmaps = false;
ramp.needsUpdate = true;

/* ================================================================== *
 *  Base material palette
 * ================================================================== */
const BASE = {
  iron: 0xc99063,
  ironDark: 0xa9744c,
  gold: 0xe9b64d,
  stone: 0xe8d4ae,
  stoneDark: 0xc5ad8a,
  cream: 0xf5e7c4,
  platform: 0xc29464,
  wood: 0x8f5c38,
  metalDark: 0x413b3b,
  roofBlue: 0x53657f,
  roofRed: 0xb95248,
  windowFrame: 0xf3e7c8,
  windowDark: 0x3e5877,
  windowLit: 0xdcc58e,
  lampGlass: 0xffe2a3,
  bulb: 0xffcf78,
  beacon: 0xff5b4c,
  foliageA: 0x5f9f4b,
  foliageB: 0x7cb958,
  foliageC: 0x3e8046,
  hedge: 0x4e8a49,
  trunk: 0x6c4a32,
  flowerA: 0xe65c68,
  flowerB: 0xf3c04a,
  flowerC: 0xd47fc4,
  flowerD: 0xf2eee0,
  cloud: 0xffffff,
  bird: 0x3a3640,
  skin: 0xf0c6a0,
  hair: 0x5b3d30,
  pants: 0x516177,
  cloth1: 0xe0554f,
  cloth2: 0x3f7fb5,
  cloth3: 0xf0b64f,
  cloth4: 0x69a45c,
  cloth5: 0xc26f9f,
  cloth6: 0xf1e1c2,
  facadeA: 0xf0ddb4,
  facadeB: 0xe9c9a4,
  facadeC: 0xf1cdbd,
  facadeD: 0xdbe0c2,
  facadeE: 0xe7d6e5,
  grass: 0xffffff,
  plaza: 0xffffff,
  path: 0xffffff,
  water: 0x52bcd8,
  waterLine: 0xe2fbff,
};

const MAT_TEXTURE = {
  grass: 'grass',
  plaza: 'plaza',
  path: 'path',
};

/* ================================================================== *
 *  Time-of-day definitions
 * ================================================================== */
const MODES = {
  day: {
    label: 'Day',
    sky: {
      top: 0x2f8ed6, mid: 0x7bd2f6, horizon: 0xe3f8ff,
      sunColor: 0xfff2bd, moonColor: 0xeef5ff, glow: 0xffe0a0,
      sunAmt: 1, moonAmt: 0, stars: 0, groundGlow: 0.10, sunSize: 0.035,
    },
    sun: { color: 0xfff2cf, intensity: 2.95, pos: [160, 145, -50] },
    hemi: { sky: 0xbfe9ff, ground: 0x8aad68, intensity: 1.0 },
    ambient: { color: 0xe6f6ff, intensity: 0.07 },
    fog: { color: 0xd7f0ff, near: 230, far: 540 },
    outline: { color: 0x684936, opacity: 0.62 },
    uplight: 0,
    glow: 0,
    beam: 0,
    fill: { color: 0xd8efff, intensity: 0.40 },
    materials: {},
    emissive: {
      iron: [0x4a2410, 0.10],
    },
  },

  dusk: {
    label: 'Dusk',
    sky: {
      top: 0x2a2a6b, mid: 0x9b5f9e, horizon: 0xffb173,
      sunColor: 0xffb96e, moonColor: 0xffe7d6, glow: 0xff9a62,
      sunAmt: 1, moonAmt: 0.22, stars: 0.16, groundGlow: 0.30, sunSize: 0.052,
    },
    sun: { color: 0xffa866, intensity: 2.45, pos: [-330, 55, -220] },
    hemi: { sky: 0xffb39c, ground: 0x6b5878, intensity: 1.2 },
    ambient: { color: 0x9b6b8c, intensity: 0.20 },
    fog: { color: 0xeda38c, near: 210, far: 500 },
    outline: { color: 0x5f3a40, opacity: 0.60 },
    uplight: 1.0,
    glow: 0.55,
    beam: 0.0,
    fill: { color: 0xffc3a6, intensity: 0.55 },
    materials: {
      iron: 0xdc9760,
      ironDark: 0xb87b4f,
      gold: 0xf0bd54,
      stone: 0xf1c9a1,
      stoneDark: 0xd0ac89,
      cream: 0xf6d5b4,
      platform: 0xc38d5b,
      roofBlue: 0x4d5478,
      roofRed: 0xc25a4a,
      grass: 0xffe6c8,
      plaza: 0xffddba,
      path: 0xffe2c2,
      water: 0xd9847c,
      waterLine: 0xffe7d3,
      foliageA: 0x769f54,
      foliageB: 0x8cb85c,
      foliageC: 0x4e814b,
      hedge: 0x5c8f4e,
      cloud: 0xffd8cb,
      bird: 0x46353d,
      windowLit: 0xe6b77c,
      facadeA: 0xf5d3ae,
      facadeB: 0xeac09e,
      facadeC: 0xf2c5b0,
      facadeD: 0xdfd2ae,
      facadeE: 0xefccd5,
    },
    emissive: {
      iron: [0xff7a30, 0.10],
      windowLit: [0xff9945, 0.55],
      lampGlass: [0xffaa50, 0.9],
      bulb: [0xffa850, 0.85],
      gold: [0xff9a42, 0.08],
      beacon: [0xff3a2c, 1.0],
    },
  },

  night: {
    label: 'Night',
    sky: {
      top: 0x04081e, mid: 0x0f2247, horizon: 0x2b4a74,
      sunColor: 0x000000, moonColor: 0xdde8ff, glow: 0x5a3b52,
      sunAmt: 0, moonAmt: 1, stars: 1, groundGlow: 0.34, sunSize: 0.035,
    },
    sun: { color: 0xa8c8ff, intensity: 1.7, pos: [-110, 70, -250] },
    hemi: { sky: 0x7693dd, ground: 0x2a3050, intensity: 1.18 },
    ambient: { color: 0x465784, intensity: 0.26 },
    fog: { color: 0x1c3055, near: 200, far: 500 },
    outline: { color: 0x152343, opacity: 0.64 },
    uplight: 3.4,
    glow: 1.0,
    beam: 0.55,
    fill: { color: 0x8faeff, intensity: 0.5 },
    materials: {
      iron: 0xd0b2ac,
      ironDark: 0xa7929b,
      gold: 0xe4b968,
      stone: 0xaba2c3,
      stoneDark: 0x837b9f,
      cream: 0xb8aecd,
      platform: 0xb295a0,
      wood: 0x6f5c72,
      metalDark: 0x2c2d46,
      roofBlue: 0x424a6c,
      roofRed: 0x865068,
      windowFrame: 0xa9a4c2,
      windowDark: 0x17203a,
      windowLit: 0xc0a077,
      foliageA: 0x466468,
      foliageB: 0x55786a,
      foliageC: 0x354f5c,
      hedge: 0x3a565c,
      trunk: 0x4a4055,
      flowerA: 0xb45d77,
      flowerB: 0xc2a35c,
      flowerC: 0x9c70a8,
      flowerD: 0xbdbdd6,
      cloud: 0x9aa6cf,
      bird: 0x20263a,
      skin: 0xc9a9bb,
      hair: 0x463b50,
      pants: 0x39405a,
      grass: 0xa6b4d6,
      plaza: 0xaaaecf,
      path: 0xb4b6d2,
      water: 0x2a4b87,
      waterLine: 0xa8cdff,
      facadeA: 0xb0a9c8,
      facadeB: 0xaaa0bd,
      facadeC: 0xb6a6c2,
      facadeD: 0xa4aec2,
      facadeE: 0xa9a3c0,
      cloth1: 0xc65f6c,
      cloth2: 0x5a7fa8,
      cloth3: 0xd5a75e,
      cloth4: 0x698b74,
      cloth5: 0xa87f9d,
      cloth6: 0xcac3c4,
    },
    emissive: {
      iron: [0x6b3418, 0.20],
      water: [0x0c2348, 0.22],
      windowLit: [0xffb45c, 2.2],
      lampGlass: [0xffb45e, 2.7],
      bulb: [0xffae55, 2.9],
      gold: [0xffa74e, 0.24],
      beacon: [0xff382c, 3.6],
    },
  },
};

/* ================================================================== *
 *  Renderer, scene, camera
 * ================================================================== */
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
const maxPixelRatio = () => (window.matchMedia('(max-width: 700px)').matches ? 1.5 : 2);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio()));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.domElement.id = 'scene';
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd7f0ff, 230, 540);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 1400);
const startPos = new THREE.Vector3(88, 58, 138);
const startTarget = new THREE.Vector3(0, 52, 0);
camera.position.copy(startPos);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(startTarget);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.minDistance = 46;
controls.maxDistance = 205;
controls.minPolarAngle = 0.45;
controls.maxPolarAngle = Math.PI * 0.487;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.22;
controls.zoomSpeed = 0.85;
controls.update();

/* ================================================================== *
 *  Materials
 * ================================================================== */
const textures = groundTextures();

const materials = { __gradient: ramp };
for (const [role, hex] of Object.entries(BASE)) {
  const opts = {
    color: hex,
    gradientMap: ramp,
  };
  if (MAT_TEXTURE[role]) opts.map = textures[MAT_TEXTURE[role]];
  materials[role] = new THREE.MeshToonMaterial(opts);
}
// the plaza and path textures carry their own colour; keep them bright
materials.grass.color.set(0xffffff);
materials.plaza.color.set(0xffffff);
materials.path.color.set(0xffffff);

/* ================================================================== *
 *  Lighting
 * ================================================================== */
const sun = new THREE.DirectionalLight(0xfff2cf, 2.75);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -125;
sun.shadow.camera.right = 125;
sun.shadow.camera.top = 125;
sun.shadow.camera.bottom = -125;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 620;
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.075;
sun.target.position.set(0, 0, 0);
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight(0xbfe9ff, 0x8aad68, 1.1);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0xe6f6ff, 0.1);
scene.add(ambient);

// camera-relative fill keeps the trellis readable from every orbit angle
const fill = new THREE.DirectionalLight(0xd8efff, 0.4);
fill.target.position.set(0, 45, 0);
scene.add(fill);
scene.add(fill.target);

// warm uplights for the night scene
const uplights = [];
for (let i = 0; i < 4; i++) {
  const a = Math.PI / 4 + (i * Math.PI) / 2;
  const spot = new THREE.SpotLight(0xffb45e, 0, 0, 0.52, 0.55, 0);
  spot.position.set(Math.cos(a) * 34, 1.5, Math.sin(a) * 34);
  spot.target.position.set(0, 54, 0);
  spot.castShadow = false;
  scene.add(spot);
  scene.add(spot.target);
  uplights.push(spot);
}

/* ================================================================== *
 *  Sky, tower and world
 * ================================================================== */
const sky = new SkyDome();
scene.add(sky.mesh);

const tower = buildTower(materials);
scene.add(tower.group);

const world = buildWorld(materials);
scene.add(world.group);

/* ================================================================== *
 *  Rotating beacon beams
 * ================================================================== */
const beamUniforms = {
  uOpacity: { value: 0 },
  uColor: { value: new THREE.Color(0xffc46a) },
};
// soft, billboard-free light shafts: two crossed tapered planes per direction
function beamPlaneGeometry(horizontal = true) {
  const L = 120;
  const W = 13;
  const pos = horizontal
    ? [0, 0, -0.35, 0, 0, 0.35, L, 0, -W / 2, L, 0, W / 2]
    : [0, -0.35, 0, 0, 0.35, 0, L, -W / 2, 0, L, W / 2, 0];
  const uv = [0, 0, 0, 1, 1, 0, 1, 1];
  const idx = [0, 2, 3, 0, 3, 1];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const beamMat = new THREE.ShaderMaterial({
  uniforms: beamUniforms,
  transparent: true,
  depthWrite: false,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    varying vec2 vUv2;
    void main() {
      vUv2 = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uOpacity;
    uniform vec3 uColor;
    varying vec2 vUv2;
    void main() {
      float t = vUv2.x;
      float across = vUv2.y;
      float a = pow(1.0 - t, 2.0) * smoothstep(0.0, 0.03, t);
      a *= smoothstep(0.0, 0.32, across) * (1.0 - smoothstep(0.68, 1.0, across));
      a *= 0.50;
      gl_FragColor = vec4(uColor, a * uOpacity);
      #include <colorspace_fragment>
    }
  `,
});
const beamGeoH = beamPlaneGeometry(true);
const beamGeoV = beamPlaneGeometry(false);
const beamGroup = new THREE.Group();
beamGroup.position.y = 120.1;
const beams = [];
for (const dir of [0, Math.PI]) {
  for (const geo of [beamGeoH, beamGeoV]) {
    const m = new THREE.Mesh(geo, beamMat);
    m.rotation.y = dir;
    m.userData.noOutline = true;
    beamGroup.add(m);
    beams.push(m);
  }
}
const beam1 = beams[0];
const beam2 = beams[1];
beamGroup.userData.noOutline = true;
scene.add(beamGroup);

/* ================================================================== *
 *  Ink outlines
 * ================================================================== */
const outline = new InkOutline(renderer, scene, camera);
outline.collectExcluded(scene);
const onResize = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const maxPixelRatio = () => (window.matchMedia('(max-width: 700px)').matches ? 1.5 : 2);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio()));
  renderer.setSize(w, h);
  outline.setSize(w, h, renderer.getPixelRatio());
};
window.addEventListener('resize', onResize);
onResize();

/* ================================================================== *
 *  Palette / light state interpolation
 * ================================================================== */
function makeLightState(mode) {
  const p = MODES[mode];
  const sunPos = new THREE.Vector3(...p.sun.pos).normalize().multiplyScalar(280);
  return {
    sunPos,
    sunColor: new THREE.Color(p.sun.color),
    sunIntensity: p.sun.intensity,
    hemiSky: new THREE.Color(p.hemi.sky),
    hemiGround: new THREE.Color(p.hemi.ground),
    hemiIntensity: p.hemi.intensity,
    ambColor: new THREE.Color(p.ambient.color),
    ambIntensity: p.ambient.intensity,
    fillColor: new THREE.Color(p.fill.color),
    fillIntensity: p.fill.intensity,
    fogColor: new THREE.Color(p.fog.color),
    fogNear: p.fog.near,
    fogFar: p.fog.far,
    outlineColor: new THREE.Color(p.outline.color),
    outlineOpacity: p.outline.opacity,
    skyTop: new THREE.Color(p.sky.top),
    skyMid: new THREE.Color(p.sky.mid),
    skyHorizon: new THREE.Color(p.sky.horizon),
    skySunColor: new THREE.Color(p.sky.sunColor),
    skyMoonColor: new THREE.Color(p.sky.moonColor),
    skyGlow: new THREE.Color(p.sky.glow),
    skySunAmt: p.sky.sunAmt,
    skyMoonAmt: p.sky.moonAmt,
    skyStars: p.sky.stars,
    skyGroundGlow: p.sky.groundGlow,
    skySunSize: p.sky.sunSize,
    sunDir: sunPos.clone().normalize(),
    moonDir: new THREE.Vector3(...MODES.night.sun.pos).normalize(),
    uplight: p.uplight,
    glow: p.glow,
    beam: p.beam,
  };
}

function makeMaterialState(mode) {
  const p = MODES[mode];
  const arr = [];
  for (const role of Object.keys(BASE)) {
    const mat = materials[role];
    const color = new THREE.Color(p.materials[role] ?? BASE[role]);
    const em = (p.emissive && p.emissive[role]) || [0x000000, 0];
    arr.push({
      role,
      mat,
      color,
      emColor: new THREE.Color(em[0]),
      emIntensity: em[1],
    });
  }
  return arr;
}

const LIGHT_STATES = {};
const MAT_STATES = {};
for (const mode of Object.keys(MODES)) {
  LIGHT_STATES[mode] = makeLightState(mode);
  MAT_STATES[mode] = makeMaterialState(mode);
}

const currentLight = (() => {
  const src = LIGHT_STATES.day;
  const s = {};
  for (const [k, v] of Object.entries(src)) {
    s[k] = v && v.isColor ? v.clone() : v && v.isVector3 ? v.clone() : v;
  }
  return s;
})();

const currentMats = MAT_STATES.day.map((e) => ({
  role: e.role,
  mat: e.mat,
  color: e.mat.color.clone(),
  emColor: e.mat.emissive.clone(),
  emIntensity: e.mat.emissiveIntensity,
}));

let lightTarget = LIGHT_STATES.day;
let matTarget = MAT_STATES.day;
let activeMode = 'day';

function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function applyLighting(dt, instant = false) {
  const k = instant ? 1 : 1 - Math.exp(-dt * 3.1);
  const L = currentLight;
  const T = lightTarget;

  L.sunPos.lerp(T.sunPos, k);
  L.sunColor.lerp(T.sunColor, k);
  L.hemiSky.lerp(T.hemiSky, k);
  L.hemiGround.lerp(T.hemiGround, k);
  L.ambColor.lerp(T.ambColor, k);
  L.fillColor.lerp(T.fillColor, k);
  L.fogColor.lerp(T.fogColor, k);
  L.outlineColor.lerp(T.outlineColor, k);
  L.skyTop.lerp(T.skyTop, k);
  L.skyMid.lerp(T.skyMid, k);
  L.skyHorizon.lerp(T.skyHorizon, k);
  L.skySunColor.lerp(T.skySunColor, k);
  L.skyMoonColor.lerp(T.skyMoonColor, k);
  L.skyGlow.lerp(T.skyGlow, k);
  L.sunDir.lerp(T.sunDir, k).normalize();
  L.moonDir.lerp(T.moonDir, k).normalize();

  for (const key of [
    'sunIntensity', 'hemiIntensity', 'ambIntensity', 'fillIntensity', 'fogNear', 'fogFar',
    'outlineOpacity', 'skySunAmt', 'skyMoonAmt', 'skyStars', 'skyGroundGlow',
    'skySunSize', 'uplight', 'glow', 'beam',
  ]) {
    L[key] = instant ? T[key] : damp(L[key], T[key], 3.1, dt);
  }

  sun.position.copy(L.sunPos);
  sun.color.copy(L.sunColor);
  sun.intensity = L.sunIntensity;
  hemi.color.copy(L.hemiSky);
  hemi.groundColor.copy(L.hemiGround);
  hemi.intensity = L.hemiIntensity;
  ambient.color.copy(L.ambColor);
  ambient.intensity = L.ambIntensity;
  fill.color.copy(L.fillColor);
  fill.intensity = L.fillIntensity;
  for (const s of uplights) s.intensity = L.uplight;

  scene.fog.color.copy(L.fogColor);
  scene.fog.near = L.fogNear;
  scene.fog.far = L.fogFar;

  const u = sky.uniforms;
  u.uTop.value.copy(L.skyTop);
  u.uMid.value.copy(L.skyMid);
  u.uHorizon.value.copy(L.skyHorizon);
  u.uSunColor.value.copy(L.skySunColor);
  u.uMoonColor.value.copy(L.skyMoonColor);
  u.uGlow.value.copy(L.skyGlow);
  u.uSunDir.value.copy(L.sunDir);
  u.uMoonDir.value.copy(L.moonDir);
  u.uSunAmt.value = L.skySunAmt;
  u.uMoonAmt.value = L.skyMoonAmt;
  u.uStars.value = L.skyStars;
  u.uGroundGlow.value = L.skyGroundGlow;
  u.uSunSize.value = L.skySunSize;

  outline.uniforms.uColor.value.copy(L.outlineColor);
  outline.uniforms.uOpacity.value = L.outlineOpacity;
  beamUniforms.uOpacity.value = L.beam;

  // materials
  for (let i = 0; i < currentMats.length; i++) {
    const c = currentMats[i];
    const t = matTarget[i];
    c.color.lerp(t.color, k);
    c.emColor.lerp(t.emColor, k);
    c.emIntensity = instant ? t.emIntensity : damp(c.emIntensity, t.emIntensity, 3.1, dt);
    c.mat.color.copy(c.color);
    c.mat.emissive.copy(c.emColor);
    c.mat.emissiveIntensity = c.emIntensity;
  }
}

/* ================================================================== *
 *  Mode switching / URL
 * ================================================================== */
const params = new URLSearchParams(window.location.search);
const urlMode = (params.get('tod') || '').toLowerCase();
activeMode = ['day', 'dusk', 'night'].includes(urlMode) ? urlMode : 'day';
lightTarget = LIGHT_STATES[activeMode];
matTarget = MAT_STATES[activeMode];
applyLighting(0, true);

const modeButtons = Array.from(document.querySelectorAll('[data-tod]'));
function setMode(mode, fromUser = true) {
  if (!MODES[mode]) return;
  activeMode = mode;
  lightTarget = LIGHT_STATES[mode];
  matTarget = MAT_STATES[mode];
  for (const b of modeButtons) {
    const on = b.dataset.tod === mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  document.documentElement.dataset.mode = mode;
  if (fromUser) {
    const url = new URL(window.location.href);
    url.searchParams.set('tod', mode);
    history.replaceState(null, '', url);
  }
}
for (const b of modeButtons) {
  b.addEventListener('click', () => setMode(b.dataset.tod));
}
window.addEventListener('keydown', (e) => {
  if (e.key === '1') setMode('day');
  else if (e.key === '2') setMode('dusk');
  else if (e.key === '3') setMode('night');
});
setMode(activeMode, false);
applyLighting(0, true);

/* ================================================================== *
 *  Interaction / auto-orbit
 * ================================================================== */
let lastInteraction = performance.now();
controls.addEventListener('start', () => {
  lastInteraction = performance.now();
  controls.autoRotate = false;
  document.body.classList.add('dragging');
});
controls.addEventListener('end', () => {
  lastInteraction = performance.now();
  document.body.classList.remove('dragging');
});

/* ================================================================== *
 *  Animation loop
 * ================================================================== */
let elapsed = 0;
let lastFrame = performance.now();
let firstFrame = true;

function animate() {
  const now = performance.now();
  const dt = Math.min((now - lastFrame) / 1000, 0.06);
  lastFrame = now;
  elapsed += dt;

  // resume a lazy orbit after idling
  if (!document.hidden && performance.now() - lastInteraction > 9000) {
    controls.autoRotate = true;
  }
  controls.update();

  applyLighting(dt);

  sky.update(camera, elapsed);

  const glowAmount = currentLight.glow;
  world.update(elapsed, dt, glowAmount);

  // camera-relative fill light
  fill.position.copy(camera.position).add(new THREE.Vector3(0, 20, 0));

  // flag & beacon
  tower.flagTime.value = elapsed;
  if (currentLight.glow > 0.02) {
    const tw = 0.9 + 0.08 * Math.sin(elapsed * 2.4) + 0.04 * Math.sin(elapsed * 7.1);
    materials.bulb.emissiveIntensity *= tw;
    materials.windowLit.emissiveIntensity *= 0.97 + 0.03 * Math.sin(elapsed * 1.7 + 1.0);
  }
  const blink = 0.5 + 0.5 * Math.sin(elapsed * 3.1);
  tower.beaconSprite.material.opacity = glowAmount * (0.35 + 0.65 * blink) * 0.9;
  tower.beaconSprite.scale.setScalar(4 + blink * 1.4);

  if (currentLight.beam > 0.001) {
    beamGroup.rotation.y = elapsed * 0.28;
    beamGroup.rotation.z = -0.08;
    for (const b of beams) b.visible = true;
  } else {
    for (const b of beams) b.visible = false;
  }

  // render
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  outline.render();

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('veil').classList.add('hidden');
    document.body.classList.add('ready');
  }
}

window.__eiffel = { scene, camera, controls, renderer, materials, outline, setMode, sky, tower, world, sun, hemi, ambient, fill, uplights, MODES, currentLight };
renderer.setAnimationLoop(animate);
