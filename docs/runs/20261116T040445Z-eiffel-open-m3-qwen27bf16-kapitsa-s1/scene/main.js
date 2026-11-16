import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeGradientMap, createInkSystem } from './materials.js';
import { makeSky } from './sky.js';
import { buildTower } from './tower.js';
import { buildEnvironment } from './environment.js';
import { MODES, DayState } from './modes.js';

// ---------------- renderer ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#cfeaff', 500, 1750);

const camera = new THREE.PerspectiveCamera(
  50, window.innerWidth / window.innerHeight, 1, 4000
);
camera.position.set(330, 130, 330);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 140, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 60;
controls.maxDistance = 1000;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;

// ---------------- lights ----------------
const sunLight = new THREE.DirectionalLight('#fff2d0', 2.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
const sc = sunLight.shadow.camera;
sc.left = -520;
sc.right = 520;
sc.top = 520;
sc.bottom = -520;
sc.near = 50;
sc.far = 2400;
sunLight.shadow.bias = -0.0003;
sunLight.shadow.normalBias = 0.4;
scene.add(sunLight, sunLight.target);

const hemi = new THREE.HemisphereLight('#cfeaff', '#8fbf72', 0.9);
scene.add(hemi);

// ---------------- shared resources ----------------
const gradientMap = makeGradientMap();
const ink = createInkSystem('#33221a');

// ---------------- sky / tower / environment ----------------
const sky = makeSky();
scene.add(sky.mesh);

const tower = buildTower(ink, gradientMap);
scene.add(tower.group);

const env = buildEnvironment(ink, gradientMap);
scene.add(env.group);

// ---------------- time of day ----------------
const params = new URLSearchParams(window.location.search);
const req = (params.get('tod') || 'day').toLowerCase().trim();
const state = new DayState(MODES[req] ? req : 'day');

// ---------------- UI ----------------
const buttons = [...document.querySelectorAll('.mode')];
const ACCENTS = { day: '#ffd94d', dusk: '#ff9a5e', night: '#31407c' };
function setMode(name) {
  state.setMode(name);
  for (const b of buttons) {
    const on = b.dataset.mode === name;
    b.classList.toggle('on', on);
    b.style.background = on ? ACCENTS[name] : '';
    b.style.color = on && name === 'night' ? '#fff' : '';
  }
}
for (const b of buttons) {
  b.addEventListener('click', () => setMode(b.dataset.mode));
}
setMode(state.name);

const hint = document.getElementById('hint');
let hintHidden = false;
function hideHint() {
  if (!hintHidden) {
    hintHidden = true;
    hint.classList.add('hidden');
  }
}
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  hideHint();
});
setTimeout(hideHint, 7000);

// ---------------- resize ----------------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------------- frame loop ----------------
let lastNow = performance.now();
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const dt = Math.min((now - lastNow) / 1000, 0.05);
  lastNow = now;
  const t = now / 1000;

  state.update(dt);
  const s = state.cur;

  sky.set(s);
  sunLight.color.copy(s.lightColor);
  sunLight.intensity = s.lightIntensity;
  sunLight.position.copy(s.sunDir).multiplyScalar(900);
  hemi.color.copy(s.hemiSky);
  hemi.groundColor.copy(s.hemiGround);
  hemi.intensity = s.hemiIntensity;
  scene.fog.color.copy(s.fogColor);
  scene.fog.near = s.fogNear;
  scene.fog.far = s.fogFar;
  ink.setInk(s.ink);

  // Dusk sun is low, so its long shadows need a much wider shadow box.
  sc.left = -s.shadowSize;
  sc.right = s.shadowSize;
  sc.top = s.shadowSize;
  sc.bottom = -s.shadowSize;
  sc.updateProjectionMatrix();

  tower.towerMat.color.copy(s.towerColor);
  tower.towerMat.emissive.copy(s.towerEmissive);
  tower.towerMat.emissiveIntensity = s.towerEmissiveIntensity;

  tower.update(t, s);
  env.update(t, dt, s);

  controls.update();
  renderer.render(scene, camera);
}
tick();
