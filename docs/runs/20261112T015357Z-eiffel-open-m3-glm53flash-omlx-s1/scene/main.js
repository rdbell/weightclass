import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mats, uTime, hullMaterials, outlineBasicMaterials, tinted } from './materials.js';
import { PALETTES, clonePalette, blendPalette } from './palettes.js';
import { buildTower } from './tower.js';
import { buildWorld, buildSky } from './world.js';

// ---------------------------------------------------------------------------
// Renderer / camera / controls
// ---------------------------------------------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc6e6f2, 140, 470);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 1500);
camera.position.set(75, 44, 108);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 26, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 26;
controls.maxDistance = 230;
controls.maxPolarAngle = Math.PI * 0.505;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
const stopAuto = () => { controls.autoRotate = false; };
renderer.domElement.addEventListener('pointerdown', stopAuto);
renderer.domElement.addEventListener('wheel', stopAuto, { passive: true });

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = -130; sc.right = 130; sc.top = 140; sc.bottom = -70;
sc.near = 5; sc.far = 420;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.9;
scene.add(sun, sun.target);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8cba68, 0.9);
scene.add(hemi);

// Golden floodlights (only at night) so the tower never becomes a silhouette.
const spots = [];
for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
  const sp = new THREE.SpotLight(0xffbf6e, 0, 220, 0.38, 0.3, 1);
  sp.position.set(sx * 13, 1.2, sz * 13);
  sp.target.position.set(sx * 2, 40, sz * 2);
  sp.castShadow = false;
  scene.add(sp, sp.target);
  spots.push(sp);
}

// ---------------------------------------------------------------------------
// Build the scene
// ---------------------------------------------------------------------------

const sky = buildSky(scene, mats);
buildTower(scene, mats);
const world = buildWorld(scene, mats);

// ---------------------------------------------------------------------------
// Palette engine
// ---------------------------------------------------------------------------

let cur = clonePalette(PALETTES.day);
let from = clonePalette(PALETTES.day);
let to = PALETTES.day;
let transT = 1;

function applyPalette(P) {
  sun.color.copy(P.sunColor);
  sun.intensity = P.sunIntensity;
  sun.position.copy(P.sunPos);

  hemi.color.copy(P.hemiSky);
  hemi.groundColor.copy(P.hemiGnd);
  hemi.intensity = P.hemiInt;

  scene.fog.color.copy(P.fog);

  const u = sky.u;
  u.uTop.value.copy(P.skyTop);
  u.uMid.value.copy(P.skyMid);
  u.uHor.value.copy(P.skyHor);
  u.uSunDir.value.copy(P.sunPos).normalize();
  u.uSunColor.value.copy(P.glowColor);
  u.uGlow.value = P.glowI;

  sky.sun.position.copy(P.sunPos).normalize().multiplyScalar(395);
  sky.sun.material.opacity = P.sunOp;
  sky.sun.visible = P.sunOp > 0.02;
  sky.moon.material.opacity = P.moonOp;
  sky.moon.visible = P.moonOp > 0.02;
  mats.star.opacity = P.star;
  sky.stars.visible = P.star > 0.02;

  mats.iron.color.copy(P.iron);
  mats.iron.emissiveIntensity = P.ironEI;
  mats.deck.color.copy(P.deck);
  mats.grass.color.copy(P.grass);
  mats.baseGrass.color.copy(P.baseGrass);
  mats.stone.color.copy(P.stone);
  mats.stoneDark.color.copy(P.stone).multiplyScalar(0.85);
  mats.water.color.copy(P.water);
  mats.cloud.color.copy(P.cloud);

  for (const { mat, key } of tinted) mat.color.copy(mat.userData.base).multiply(P[key]);

  mats.window.emissiveIntensity = P.windowGlow * 1.4;
  mats.pool.opacity = P.poolOp * 0.32;
  mats.firefly.opacity = P.lampGlow * 0.7;

  for (const sp of spots) sp.intensity = P.spotI * 75;

  for (const m of outlineBasicMaterials) m.color.copy(P.hull);
  for (const m of hullMaterials) m.uniforms.uColor.value.copy(P.hull);
}

const smooth = (t) => t * t * (3 - 2 * t);

function setMode(mode, instant = false) {
  to = PALETTES[mode];
  if (instant) {
    cur = clonePalette(to);
    applyPalette(cur);
    transT = 1;
  } else {
    from = clonePalette(cur);
    transT = 0;
  }
  document.querySelectorAll('#modes button').forEach((b) =>
    b.classList.toggle('active', b.dataset.tod === mode));
}

const params = new URLSearchParams(location.search);
const initial = ['day', 'dusk', 'night'].includes(params.get('tod')) ? params.get('tod') : 'day';
setMode(initial, true);

document.querySelectorAll('#modes button').forEach((b) => {
  b.addEventListener('click', () => {
    setMode(b.dataset.tod);
    history.replaceState(null, '', `?tod=${b.dataset.tod}`);
  });
});

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  uTime.value = t;

  if (transT < 1) {
    transT = Math.min(1, transT + dt / 1.5);
    blendPalette(from, to, smooth(transT), cur);
    applyPalette(cur);
  }

  world.update(t);

  // Living light details
  const lg = cur.lampGlow;
  mats.lampGlass.emissiveIntensity = lg * (2.3 + 0.18 * Math.sin(t * 7.3) + 0.12 * Math.sin(t * 13.7));
  mats.beacon.emissiveIntensity = 0.35 + lg * 1.6 * (0.5 + 0.5 * Math.sin(t * 3.4)) + 0.3 * Math.max(0, Math.sin(t * 3.4 - 0.4)) * (1 - lg);

  controls.update();
  renderer.render(scene, camera);
}
animate();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});