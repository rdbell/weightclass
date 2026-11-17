import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createSky } from './sky.js';
import { THEMES, snapshot, lerpTheme } from './themes.js';
import { buildTower } from './tower.js';
import { buildScenery } from './scenery.js';
import { inkMaterial, inkFlatMaterial, birdMat, shared, applyBoundColors } from './materials.js';

// ---------- mode from the URL ----------
const params = new URLSearchParams(location.search);
let mode = params.get('tod');
if (!THEMES[mode]) mode = 'day';

// ---------- renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // hard, ink-block shadows
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#cfe9f5', 550, 1900);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 4000);
camera.position.set(300, 190, 430);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 140, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 90;
controls.maxDistance = 1300;
controls.maxPolarAngle = 1.5;
controls.minPolarAngle = 0.12;
controls.enablePan = false;

// ---------- lights ----------
const sun = new THREE.DirectionalLight('#fff1d0', 3.1);
sun.castShadow = true;
sun.shadow.mapSize.set(8192, 8192);
const sc = sun.shadow.camera;
sc.left = -520; sc.right = 520; sc.top = 520; sc.bottom = -520;
sc.near = 100; sc.far = 2200;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 2.2;
scene.add(sun);
scene.add(sun.target);

const hemi = new THREE.HemisphereLight('#bfe0f5', '#8fbf7a', 1.75);
scene.add(hemi);

// warm floodlights that bring the tower to life at night
const floods = [];
for (const [x, z] of [[130, 0], [-130, 0], [0, 130], [0, -130]]) {
  const s = new THREE.SpotLight('#ffb545', 0, 520, 0.6, 0.35, 1.6);
  s.position.set(x, 5, z);
  s.target.position.set(0, 150, 0);
  scene.add(s);
  scene.add(s.target);
  floods.push(s);
}

// ---------- sky ----------
const sky = createSky();
scene.add(sky.sky);

// ---------- world ----------
const tower = buildTower();
scene.add(tower.group);
const scenery = buildScenery();
scene.add(scenery.group);

// ---------- theming ----------
const cur = snapshot(THEMES[mode]);
let target = THEMES[mode];
const beaconColor = new THREE.Color('#ff2d2d');
let beaconBase = 0.3;

function applyTheme(t) {
  const u = sky.uniforms;
  u.uTop.value.copy(t.skyTop);
  u.uHorizon.value.copy(t.skyHorizon);
  u.uBottom.value.copy(t.skyBottom);
  u.uSunColor.value.copy(t.sunColor);
  u.uHaloColor.value.copy(t.haloColor);
  u.uSunDir.value.copy(t.sunDir);
  u.uSunDisc.value = t.sunDisc;
  u.uHalo.value = t.halo;
  u.uStars.value = t.stars;

  sun.color.copy(t.sunLightColor);
  sun.intensity = t.sunLightIntensity;
  sun.position.copy(t.sunDir).multiplyScalar(1000);

  hemi.color.copy(t.hemiSky);
  hemi.groundColor.copy(t.hemiGround);
  hemi.intensity = t.hemiIntensity;

  scene.fog.color.copy(t.fogColor);
  scene.fog.near = t.fogNear;
  scene.fog.far = t.fogFar;

  inkMaterial.color.copy(t.ink);
  inkFlatMaterial.color.copy(t.ink);
  birdMat.color.copy(t.ink);
  shared.rimColor.copy(t.rim);

  applyBoundColors(t);

  for (const f of floods) {
    f.intensity = t.flood * 55000;
    f.color.copy(t.floodColor);
  }
  beaconBase = t.beacon;
}
applyTheme(cur);

// ---------- UI ----------
const buttons = document.querySelectorAll('#modes button');
function setMode(m, push = true) {
  if (!THEMES[m]) return;
  mode = m;
  target = THEMES[m];
  buttons.forEach((b) => b.classList.toggle('active', b.dataset.mode === m));
  if (push) history.replaceState(null, '', `?tod=${m}`);
}
buttons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
setMode(mode, false);
addEventListener('keydown', (e) => {
  if (e.key === '1') setMode('day');
  if (e.key === '2') setMode('dusk');
  if (e.key === '3') setMode('night');
});

// ---------- animation ----------
const clock = new THREE.Clock();
const _flagPos = scenery.flag.geometry.attributes.position;
const flagBase = scenery.flagBase;

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  controls.update();

  // smooth theme transition
  lerpTheme(cur, target, 1 - Math.exp(-dt * 2.8));
  applyTheme(cur);

  // drifting clouds
  scenery.clouds.rotation.y = t * 0.008;

  // circling birds
  for (const bird of scenery.birds) {
    const d = bird.userData;
    const a = t * d.w + d.off;
    bird.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * 0.5 + d.ph) * 10, Math.sin(a) * d.r);
    bird.rotation.y = -a;
    const flap = Math.sin(t * 9 + d.ph) * 0.7;
    d.wl.rotation.z = flap;
    d.wr.rotation.z = -flap;
  }

  // bobbing balloons
  for (let i = 0; i < scenery.balloons.length; i++) {
    const b = scenery.balloons[i];
    b.position.y += Math.sin(t * 0.3 + i * 2.4) * 0.008;
    b.rotation.z = Math.sin(t * 0.35 + i) * 0.04;
    b.rotation.x = Math.cos(t * 0.28 + i) * 0.03;
  }

  // waving flag
  for (let i = 0; i < _flagPos.count; i++) {
    const x = flagBase[i * 3], y = flagBase[i * 3 + 1];
    _flagPos.setZ(i, Math.sin(x * 1.15 - t * 6.5 + y * 0.5) * 0.6 * (0.2 + x / 9));
  }
  _flagPos.needsUpdate = true;
  scenery.flag.geometry.computeVertexNormals();

  // pulsing beacon
  const pulse = 0.45 + 0.55 * Math.sin(t * 2.4);
  tower.beaconMat.color.copy(beaconColor).multiplyScalar(beaconBase * (0.35 + 0.65 * pulse));

  sky.uniforms.uTime.value = t;

  renderer.render(scene, camera);
}
renderer.setAnimationLoop(animate);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});