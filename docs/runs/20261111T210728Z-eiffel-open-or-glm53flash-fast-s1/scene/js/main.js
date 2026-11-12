import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildTower } from './tower.js';
import { buildEnvironment } from './env.js';
import {
  MODES, colorTween, numTween, vecTween, startMode, updateTweens,
} from './palette.js';

// ---------------- renderer / scene / camera ----------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#e2f4fb', 1100, 3400);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 2, 9000);
camera.position.set(250, 170, 330);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 135, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 110;
controls.maxDistance = 950;
controls.maxPolarAngle = Math.PI * 0.495;
controls.enablePan = false;

// ---------------- lights ----------------
const hemi = new THREE.HemisphereLight('#bfe0ff', '#93c06c', 0.45);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#fff1cf', 1.45);
sun.position.set(260, 320, 180);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
const sc = sun.shadow.camera;
sc.left = -560; sc.right = 560; sc.top = 560; sc.bottom = -560;
sc.near = 20; sc.far = 1600;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 1.2;
scene.add(sun, sun.target);

// ---------------- build ----------------
const tower = buildTower();
scene.add(tower.group);
const env = buildEnvironment();
scene.add(env.group);

// ---------------- mode tween wiring ----------------
colorTween(scene.fog.color, 'fog');
colorTween(env.skyUniforms.uTop.value, 'skyTop');
colorTween(env.skyUniforms.uMid.value, 'skyMid');
colorTween(env.skyUniforms.uHor.value, 'skyHor');
colorTween(sun.color, 'sunColor');
numTween(() => sun.intensity, (v) => { sun.intensity = v; }, 'sunI');
vecTween(sun.position, 'sunPos');
colorTween(hemi.color, 'hemiSky');
colorTween(hemi.groundColor, 'hemiGround');
numTween(() => hemi.intensity, (v) => { hemi.intensity = v; }, 'hemiI');
vecTween(env.sunDisc.position, 'sunDiscPos');
colorTween(env.sunMat.color, 'sunDiscColor');
numTween(() => env.sunMat.opacity, (v) => { env.sunMat.opacity = v; }, 'sunOpacity');
numTween(() => env.sunHalo.material.opacity, (v) => { env.sunHalo.material.opacity = v; }, 'sunHalo');
numTween(() => env.moonMat.opacity, (v) => { env.moonMat.opacity = v; }, 'moonOpacity');
numTween(() => env.moonHalo.material.opacity, (v) => { env.moonHalo.material.opacity = v; }, 'moonHalo');
numTween(() => env.starMat.opacity, (v) => { env.starMat.opacity = v; }, 'stars');
numTween(() => tower.sparkleMat.uniforms.uOpacity.value,
  (v) => { tower.sparkleMat.uniforms.uOpacity.value = v; }, 'sparkle');
numTween(tower.getGlowFactor, tower.setGlowFactor, 'glowLight');
colorTween(tower.ironMat.emissive, 'glowColor');
numTween(() => tower.ironMat.emissiveIntensity, (v) => { tower.ironMat.emissiveIntensity = v; }, 'glowI');
colorTween(tower.ironDarkMat.emissive, 'glowColor');
numTween(() => tower.ironDarkMat.emissiveIntensity, (v) => { tower.ironDarkMat.emissiveIntensity = v; }, 'glowI');
colorTween(tower.ironMat.color, 'iron');
colorTween(tower.ironDarkMat.color, 'ironDark');
colorTween(tower.platMat.color, 'plat');
colorTween(tower.railMat.color, 'rail');
colorTween(env.groundMat.color, 'groundTint');
colorTween(env.trunkMat.color, 'trunk');
colorTween(env.leafA.color, 'leafA');
colorTween(env.leafB.color, 'leafB');
colorTween(env.cloudMat.color, 'cloud');
colorTween(env.birdMat.color, 'bird');
numTween(() => env.lampHeadMat.emissiveIntensity, (v) => { env.lampHeadMat.emissiveIntensity = v; }, 'lampHeadI');
numTween(() => env.haloMat.opacity, (v) => { env.haloMat.opacity = v; }, 'halo');
numTween(env.getLampFactor, env.setLampFactor, 'lampLight');

// ---------------- mode switching ----------------
const buttons = [...document.querySelectorAll('#hud button')];
let mode = 'day';
function setMode(m, instant = false) {
  if (!MODES.includes(m)) m = 'day';
  mode = m;
  startMode(m, instant);
  buttons.forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  try { history.replaceState(null, '', `?tod=${m}`); } catch (e) { /* file:// */ }
}
buttons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
addEventListener('keydown', (e) => {
  if (e.key === '1') setMode('day');
  if (e.key === '2') setMode('dusk');
  if (e.key === '3') setMode('night');
});
const urlTod = new URLSearchParams(location.search).get('tod');
setMode(MODES.includes(urlTod) ? urlTod : 'day', true);

// ---------------- loop ----------------
const clock = new THREE.Clock();
function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  updateTweens(t);
  controls.update();
  tower.update(t, mode);
  env.update(t, dt, camera);
  renderer.render(scene, camera);
}
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
