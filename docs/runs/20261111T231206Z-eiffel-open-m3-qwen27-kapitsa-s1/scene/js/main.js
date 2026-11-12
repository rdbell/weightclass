import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeRng } from './rng.js';
import { PALETTES, clonePalette, lerpPalette, MOON_DIR } from './palettes.js';
import { makeOutlineMaterial, glowTexture } from './toon.js';
import { buildTower } from './tower.js';
import { buildEnvironment } from './env.js';
import { buildSky } from './sky.js';

// ---------------------------------------------------------------- renderer / scene
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xd9efff, 0.00034);

const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 1, 10000);
camera.position.set(235, 165, 645);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 112, 20);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 80;
controls.maxDistance = 1900;
controls.maxPolarAngle = 1.53;
controls.minPolarAngle = 0.05;
controls.autoRotate = false;

// ---------------------------------------------------------------- lights
const sun = new THREE.DirectionalLight(0xfff2d9, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -320, right: 320, top: 400, bottom: -260, near: 80, far: 2400 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 1.4;
sun.target.position.set(0, 60, 60);
scene.add(sun, sun.target);

const moon = new THREE.DirectionalLight(0xa8c6ff, 0);
moon.castShadow = true;
moon.shadow.mapSize.set(512, 512);
Object.assign(moon.shadow.camera, { left: -850, right: 850, top: 700, bottom: -500, near: 80, far: 2800 });
moon.shadow.bias = -0.0004;
moon.shadow.normalBias = 1.4;
moon.position.copy(MOON_DIR).multiplyScalar(900);
moon.target.position.set(0, 60, 60);
scene.add(moon, moon.target);

const hemi = new THREE.HemisphereLight(0xcfe9ff, 0x9cc98a, 0.9);
scene.add(hemi);

// ---------------------------------------------------------------- build world
const rng = makeRng(0xe1ff);
const outlineMat = makeOutlineMaterial();
const warmGlow = glowTexture([255, 200, 120]);

const tower = buildTower({ rng, outlineMat, glow: warmGlow });
const env = buildEnvironment({ rng, outlineMat, glow: warmGlow });
const sky = buildSky({ rng, outlineMat, glow: warmGlow });
scene.add(tower.group, env.group, sky.group);

// ---------------------------------------------------------------- time of day
const MODES = ['day', 'dusk', 'night'];
const urlMode = (new URLSearchParams(location.search).get('tod') || '').toLowerCase();
const initialMode = MODES.includes(urlMode) ? urlMode : 'day';

let cur = clonePalette(PALETTES[initialMode]);
let target = PALETTES[initialMode];

function applyPalette(p) {
  tower.apply(p);
  env.apply(p);
  sky.apply(p);
  sun.color.copy(p.sunColor);
  sun.intensity = p.sunIntensity;
  sun.position.copy(p.sunDir).multiplyScalar(900);
  const s = p.shadowSize;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s * 1.25;
  sun.shadow.camera.bottom = -s * 0.85;
  sun.shadow.camera.updateProjectionMatrix();
  sun.castShadow = p.sunIntensity > 0.02;
  moon.castShadow = p.moonIntensity > 0.02;
  moon.intensity = p.moonIntensity;
  hemi.color.copy(p.hemiSky);
  hemi.groundColor.copy(p.hemiGround);
  hemi.intensity = p.hemiIntensity;
  scene.fog.color.copy(p.fogColor);
  scene.fog.density = p.fogDensity;
  outlineMat.uniforms.uColor.value.copy(p.outlineColor);
}

function setMode(mode) {
  if (!PALETTES[mode]) return;
  target = PALETTES[mode];
  document.querySelectorAll('.mode-btn').forEach((b) =>
    b.classList.toggle('active', b.dataset.mode === mode)
  );
}

applyPalette(cur);

// UI
document.querySelectorAll('.mode-btn').forEach((b) => {
  b.addEventListener('click', () => setMode(b.dataset.mode));
});
window.addEventListener('keydown', (e) => {
  if (e.key === '1') setMode('day');
  if (e.key === '2') setMode('dusk');
  if (e.key === '3') setMode('night');
});
setMode(initialMode);

// ---------------------------------------------------------------- loop
let lastNow = performance.now();
let t = 0;

function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const dt = Math.min((now - lastNow) / 1000, 0.05);
  lastNow = now;
  t += dt;

  const k = 1 - Math.exp(-2.4 * dt);
  lerpPalette(cur, target, k, cur);
  applyPalette(cur);

  tower.anim(t, dt, cur);
  env.anim(t, dt, cur);
  sky.anim(t, dt, cur);

  controls.update();
  renderer.render(scene, camera);
}
tick();

// ---------------------------------------------------------------- resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// fade the hint
setTimeout(() => {
  const h = document.getElementById('hint');
  if (h) h.classList.add('faded');
}, 7000);
