import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { toonMaterial, addOutline, glowTexture, discTexture, mulberry32 } from './toon.js';
import { buildTower, H_TOP } from './tower.js';
import {
  buildSky, buildStars, buildGround, buildTrees, buildRocks, buildFlowers,
  buildLamps, buildBenches, buildClouds, buildBalloon, buildBirds, buildGlowSprite,
} from './world.js';

/* ═══════════════════════ MODE DEFINITIONS ═══════════════════════ */
const MODES = {
  day: {
    sky: ['#3d96f2', '#7cc8ff', '#e6f6ff'],
    sunPos: [170, 215, 95], sunColor: '#fff1ca', sunIntensity: 2.9,
    hemi: ['#bfe0ff', '#7ccf6a', 0.78], ambient: ['#ffffff', 0.3],
    fill: ['#cfe8ff', 0.32],
    fog: ['#d9f0ff', 250, 780],
    grass: '#6fd35b', plaza: '#edd9a8', plinth: '#d9c9a8', path: '#f6ead0',
    pond: '#4cc4ec', cloud: '#ffffff', canopy: '#45b055', trunk: '#8a5a3c',
    iron: '#44506b', platform: '#f2e7cf', rail: '#3a4257', rock: '#9a917f',
    bench: '#a9744a', hut: '#f6efdd',
    starOpacity: 0, moonOpacity: 0,
    windowIntensity: 0, lampIntensity: 0, lampGlow: 0, lanternGlow: 0,
    beaconBase: 0.7, pointLight: 0,
  },
  dusk: {
    sky: ['#33245a', '#b95a76', '#ffb163'],
    sunPos: [185, 60, -70], sunColor: '#ff9a52', sunIntensity: 2.5,
    hemi: ['#c0809a', '#46385a', 0.56], ambient: ['#ffb08a', 0.2],
    fill: ['#ffb08a', 0.34],
    fog: ['#e8936c', 250, 720],
    grass: '#569a4e', plaza: '#d8b78e', plinth: '#b89a80', path: '#e5c49a',
    pond: '#3a7ea8', cloud: '#f2b18d', canopy: '#36703f', trunk: '#6e4630',
    iron: '#3a3448', platform: '#d9bfa0', rail: '#2e2a3e', rock: '#7d6a6e',
    bench: '#7a5636', hut: '#d3b89a',
    starOpacity: 0.35, moonOpacity: 0.4,
    windowIntensity: 1.1, lampIntensity: 1.2, lampGlow: 0.6, lanternGlow: 0.55,
    beaconBase: 1.35, pointLight: 300,
  },
  night: {
    sky: ['#0b1130', '#1a2148', '#33305c'],
    sunPos: [-150, 210, -112], sunColor: '#b9c8f4', sunIntensity: 1.65,
    hemi: ['#4c5d9c', '#262e46', 1.15], ambient: ['#7d8eb9', 0.55],
    fill: ['#8d9fd8', 1.3],
    fog: ['#232a4e', 260, 820],
    grass: '#3a6552', plaza: '#7e7596', plinth: '#675e7c', path: '#716a8a',
    pond: '#2a4a76', cloud: '#46547a', canopy: '#1f4534', trunk: '#4a3424',
    iron: '#2c2940', platform: '#6a6490', rail: '#221f33', rock: '#453f5a',
    bench: '#3f3049', hut: '#6f6890',
    starOpacity: 0.95, moonOpacity: 1.0,
    windowIntensity: 1.7, lampIntensity: 2.1, lampGlow: 0.92, lanternGlow: 0.9,
    beaconBase: 1.0, pointLight: 1150,
  },
};

function makeModeState(m) {
  return {
    skyTop: new THREE.Color(m.sky[0]), skyMid: new THREE.Color(m.sky[1]), skyBottom: new THREE.Color(m.sky[2]),
    sunColor: new THREE.Color(m.sunColor), sunIntensity: m.sunIntensity,
    sunPos: new THREE.Vector3(...m.sunPos),
    hemiSky: new THREE.Color(m.hemi[0]), hemiGround: new THREE.Color(m.hemi[1]), hemiIntensity: m.hemi[2],
    ambientColor: new THREE.Color(m.ambient[0]), ambientIntensity: m.ambient[1],
    fog: new THREE.Color(m.fog[0]), fogNear: m.fog[1], fogFar: m.fog[2],
    grass: new THREE.Color(m.grass), plaza: new THREE.Color(m.plaza), plinth: new THREE.Color(m.plinth),
    path: new THREE.Color(m.path), pond: new THREE.Color(m.pond), cloud: new THREE.Color(m.cloud),
    canopy: new THREE.Color(m.canopy), trunk: new THREE.Color(m.trunk),
    iron: new THREE.Color(m.iron), platform: new THREE.Color(m.platform), rail: new THREE.Color(m.rail),
    rock: new THREE.Color(m.rock), bench: new THREE.Color(m.bench), hut: new THREE.Color(m.hut),
    starOpacity: m.starOpacity, moonOpacity: m.moonOpacity,
    fillColor: new THREE.Color(m.fill[0]), fillIntensity: m.fill[1],
    windowIntensity: m.windowIntensity, lampIntensity: m.lampIntensity,
    lampGlow: m.lampGlow, lanternGlow: m.lanternGlow,
    beaconBase: m.beaconBase, pointLight: m.pointLight,
  };
}

function copyModeState(dst, src) {
  dst.skyTop.copy(src.skyTop); dst.skyMid.copy(src.skyMid); dst.skyBottom.copy(src.skyBottom);
  dst.sunColor.copy(src.sunColor); dst.sunIntensity = src.sunIntensity; dst.sunPos.copy(src.sunPos);
  dst.hemiSky.copy(src.hemiSky); dst.hemiGround.copy(src.hemiGround); dst.hemiIntensity = src.hemiIntensity;
  dst.ambientColor.copy(src.ambientColor); dst.ambientIntensity = src.ambientIntensity;
  dst.fog.copy(src.fog); dst.fogNear = src.fogNear; dst.fogFar = src.fogFar;
  dst.grass.copy(src.grass); dst.plaza.copy(src.plaza); dst.plinth.copy(src.plinth); dst.path.copy(src.path);
  dst.pond.copy(src.pond); dst.cloud.copy(src.cloud); dst.canopy.copy(src.canopy); dst.trunk.copy(src.trunk);
  dst.iron.copy(src.iron); dst.platform.copy(src.platform); dst.rail.copy(src.rail);
  dst.rock.copy(src.rock); dst.bench.copy(src.bench); dst.hut.copy(src.hut);
  dst.starOpacity = src.starOpacity; dst.moonOpacity = src.moonOpacity;
  dst.fillColor.copy(src.fillColor); dst.fillIntensity = src.fillIntensity;
  dst.windowIntensity = src.windowIntensity; dst.lampIntensity = src.lampIntensity;
  dst.lampGlow = src.lampGlow; dst.lanternGlow = src.lanternGlow;
  dst.beaconBase = src.beaconBase; dst.pointLight = src.pointLight;
  return dst;
}

/* ═══════════════════════ RENDERER / SCENE ═══════════════════════ */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#d9f0ff', 250, 780);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 1600);
camera.position.set(205, 160, 280);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 54, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 70;
controls.maxDistance = 420;
controls.maxPolarAngle = 1.52;
controls.enablePan = false;

/* ═══════════════════════ LIGHTS ═══════════════════════ */
const sun = new THREE.DirectionalLight('#fff1ca', 3.1);
sun.position.set(170, 215, 95);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 135;
sun.shadow.camera.bottom = -60;
sun.shadow.camera.near = 40;
sun.shadow.camera.far = 640;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 1.6;
scene.add(sun);
const sunTarget = new THREE.Object3D();
sunTarget.position.set(0, 45, 0);
scene.add(sunTarget);
sun.target = sunTarget;

const hemi = new THREE.HemisphereLight('#bfe0ff', '#7ccf6a', 0.72);
scene.add(hemi);
const ambient = new THREE.AmbientLight('#ffffff', 0.24);
scene.add(ambient);
const fill = new THREE.DirectionalLight('#cfe8ff', 0.32);
fill.position.set(150, 110, 165);
scene.add(fill);

const plazaLight = new THREE.PointLight('#ffc789', 0, 100, 2);
plazaLight.position.set(0, 11, 0);
scene.add(plazaLight);

/* ═══════════════════════ MATERIALS ═══════════════════════ */
const M = {
  iron: toonMaterial('#44506b'),
  platform: toonMaterial('#f2e7cf'),
  rail: toonMaterial('#3a4257'),
  windows: new THREE.MeshToonMaterial({ color: '#5a4a38', emissive: '#ffd166', emissiveIntensity: 0 }),
  hut: toonMaterial('#f6efdd'),
  roof: toonMaterial('#e2574c'),
  flag: toonMaterial('#e2574c', { side: THREE.DoubleSide }),
  beacon: new THREE.MeshToonMaterial({ color: '#ff5a4c', emissive: '#ff3b2f', emissiveIntensity: 1.4 }),
  grass: toonMaterial('#6fd35b'),
  plaza: toonMaterial('#edd9a8'),
  plinth: toonMaterial('#d9c9a8'),
  path: toonMaterial('#f6ead0'),
  pond: toonMaterial('#4cc4ec', { emissive: '#2a9fd8', emissiveIntensity: 0.14 }),
  trunk: toonMaterial('#8a5a3c'),
  canopy: toonMaterial('#45b055'),
  rock: toonMaterial('#9a917f'),
  flower: new THREE.MeshToonMaterial({ vertexColors: true }),
  bench: toonMaterial('#a9744a'),
  cloud: toonMaterial('#ffffff'),
  bird: toonMaterial('#2d2a3a'),
  birdWing: toonMaterial('#2d2a3a', { side: THREE.DoubleSide }),
  balloon: toonMaterial('#e2574c'),
  balloonSkirt: toonMaterial('#f6efdd'),
  basket: toonMaterial('#7a4b2a'),
  lantern: new THREE.MeshToonMaterial({ color: '#ffd166', emissive: '#ffc45e', emissiveIntensity: 0 }),
  lampHead: new THREE.MeshToonMaterial({ color: '#fff3c8', emissive: '#ffce7a', emissiveIntensity: 0 }),
};

/* ═══════════════════════ SCENE BUILD ═══════════════════════ */
const rng = mulberry32(20240614);

const sky = buildSky();
scene.add(sky.mesh);
const stars = buildStars(rng);
scene.add(stars.mesh);

const ground = buildGround(M);
scene.add(ground.group);
const skirtMat = ground.skirtMat;

const tower = buildTower(M);
scene.add(tower);
addOutline(tower.userData.corners, 0.42);
addOutline(tower.userData.slabs, 0.45);
addOutline(tower.userData.hutMesh, 0.45);
addOutline(tower.userData.roofMesh, 0.4);
addOutline(tower.userData.antenna, 0.35);

addOutline(ground.plinth, 0.8);

/* beacon glow */
const beaconGlow = buildGlowSprite(11, '#ff6a5e', 0.75);
beaconGlow.position.set(0, H_TOP + 19.6, 0);
scene.add(beaconGlow);

/* moon sprite (visible at night) */
const MOON_POS = new THREE.Vector3(-190, 165, -130);
const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: discTexture('#f2f5ff', '#aab8e8', [[95, 92, 12], [158, 150, 9], [120, 170, 6]]), color: '#ffffff',
  transparent: true, opacity: 0, depthWrite: false, fog: false,
}));
moonSprite.scale.set(38, 38, 1);
moonSprite.position.copy(MOON_POS);
scene.add(moonSprite);
const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
  map: glowTexture('#cdd8ff'), color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, fog: false,
}));
moonHalo.scale.set(78, 78, 1);
moonHalo.position.copy(MOON_POS);
scene.add(moonHalo);

/* world dressing */
const trees = buildTrees(rng, M);
scene.add(trees.group);
addOutline(trees.canopy, 0.5);

const rocks = buildRocks(rng, M);
scene.add(rocks);
const flowers = buildFlowers(rng, M);
scene.add(flowers);

const lamps = buildLamps(M);
scene.add(lamps.group);
const lampGlows = lamps.heads.map((p) => {
  const s = buildGlowSprite(6.5, '#ffce7a', 0);
  s.position.copy(p);
  scene.add(s);
  return s;
});

const benches = buildBenches(M);
scene.add(benches);

const clouds = buildClouds(rng, M);
for (const c of clouds) scene.add(c);

const balloon = buildBalloon(M);
scene.add(balloon);
const balloonLantern = buildGlowSprite(5, '#ffcf7a', 0);
balloonLantern.position.set(0, -7.6, 0);
balloon.add(balloonLantern);

const birds = buildBirds(M);
for (const b of birds) scene.add(b);

/* ═══════════════════════ MODE STATE ═══════════════════════ */
function initialModeFromURL() {
  const p = new URLSearchParams(location.search).get('tod');
  if (p === null) return 'day';
  const k = p.toLowerCase();
  return ['day', 'dusk', 'night'].includes(k) ? k : 'day';
}

const state = makeModeState(MODES.day);
const target = makeModeState(MODES.day);
let currentMode = initialModeFromURL();
copyModeState(state, makeModeState(MODES[currentMode]));
copyModeState(target, makeModeState(MODES[currentMode]));

const buttons = [...document.querySelectorAll('.mode-btn')];
function syncButtons() {
  for (const b of buttons) b.classList.toggle('active', b.dataset.mode === currentMode);
}
function setMode(mode, instant = false) {
  if (!MODES[mode]) mode = 'day';
  currentMode = mode;
  copyModeState(target, makeModeState(MODES[mode]));
  if (instant) copyModeState(state, target);
  syncButtons();
}

buttons.forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
window.addEventListener('keydown', (e) => {
  if (e.key === '1') setMode('day');
  else if (e.key === '2') setMode('dusk');
  else if (e.key === '3') setMode('night');
});
syncButtons();

/* layout positions that the modes drive */
function applyMode() {
  sky.uniforms.uTop.value = state.skyTop;
  sky.uniforms.uMid.value = state.skyMid;
  sky.uniforms.uBottom.value = state.skyBottom;

  sun.color = state.sunColor;
  sun.intensity = state.sunIntensity;
  sun.position.copy(state.sunPos);
  hemi.color = state.hemiSky;
  hemi.groundColor = state.hemiGround;
  hemi.intensity = state.hemiIntensity;
  ambient.color = state.ambientColor;
  ambient.intensity = state.ambientIntensity;

  scene.fog.color = state.fog;
  scene.fog.near = state.fogNear;
  scene.fog.far = state.fogFar;
  renderer.setClearColor(state.fog);
  if (skirtMat) skirtMat.uniforms.uColor.value = state.fog;

  M.grass.color = state.grass;
  M.plaza.color = state.plaza;
  M.plinth.color = state.plinth;
  M.path.color = state.path;
  M.pond.color = state.pond;
  M.cloud.color = state.cloud;
  M.canopy.color = state.canopy;
  M.trunk.color = state.trunk;
  M.iron.color = state.iron;
  M.platform.color = state.platform;
  M.rail.color = state.rail;
  M.rock.color = state.rock;
  M.bench.color = state.bench;
  M.hut.color = state.hut;
  M.windows.emissiveIntensity = state.windowIntensity;
  M.lampHead.emissiveIntensity = state.lampIntensity;
  M.lantern.emissiveIntensity = state.lanternGlow * 1.9;
  M.beacon.emissiveIntensity = state.beaconBase * 1.35;

  fill.color = state.fillColor;
  fill.intensity = state.fillIntensity;
  stars.material.opacity = state.starOpacity;
  plazaLight.intensity = state.pointLight;

  moonSprite.material.opacity = state.moonOpacity;
  moonHalo.material.opacity = 0.32 * state.moonOpacity;

  beaconGlow.material.opacity = 0.25 + state.beaconBase * 0.35;
}

/* initial apply */
applyMode();

/* camera intro */
const INTRO_FROM = new THREE.Vector3(205, 160, 280);
const INTRO_TO = new THREE.Vector3(122, 90, 207);
camera.position.copy(INTRO_FROM);
controls.enabled = false;
const INTRO_START = performance.now();
let introT = 0;
function finishIntro() { controls.enabled = true; introT = 1; }
canvas.addEventListener('pointerdown', finishIntro);
canvas.addEventListener('wheel', finishIntro);

/* ═══════════════════════ LOOP ═══════════════════════ */
let timeT = 0;
let lastNow = performance.now();
function tick() {
  requestAnimationFrame(tick);
  const now = performance.now();
  const dt = Math.min((now - lastNow) / 1000, 0.05);
  lastNow = now;
  timeT += dt;
  const t = timeT;

  // lerp mode toward target
  const k = 1 - Math.exp(-dt * 3.1);
  const lerpNum = (a, b) => a + (b - a) * k;
  state.skyTop.lerp(target.skyTop, k); state.skyMid.lerp(target.skyMid, k); state.skyBottom.lerp(target.skyBottom, k);
  state.sunColor.lerp(target.sunColor, k); state.sunIntensity = lerpNum(state.sunIntensity, target.sunIntensity);
  state.sunPos.lerp(target.sunPos, k);
  state.hemiSky.lerp(target.hemiSky, k); state.hemiGround.lerp(target.hemiGround, k);
  state.hemiIntensity = lerpNum(state.hemiIntensity, target.hemiIntensity);
  state.ambientColor.lerp(target.ambientColor, k); state.ambientIntensity = lerpNum(state.ambientIntensity, target.ambientIntensity);
  state.fog.lerp(target.fog, k);
  state.fogNear = lerpNum(state.fogNear, target.fogNear); state.fogFar = lerpNum(state.fogFar, target.fogFar);
  state.grass.lerp(target.grass, k); state.plaza.lerp(target.plaza, k); state.plinth.lerp(target.plinth, k);
  state.path.lerp(target.path, k); state.pond.lerp(target.pond, k); state.cloud.lerp(target.cloud, k);
  state.canopy.lerp(target.canopy, k); state.trunk.lerp(target.trunk, k); state.iron.lerp(target.iron, k);
  state.platform.lerp(target.platform, k); state.rail.lerp(target.rail, k); state.rock.lerp(target.rock, k);
  state.bench.lerp(target.bench, k); state.hut.lerp(target.hut, k);
  state.starOpacity = lerpNum(state.starOpacity, target.starOpacity);
  state.fillColor.lerp(target.fillColor, k);
  state.fillIntensity = lerpNum(state.fillIntensity, target.fillIntensity);
  state.moonOpacity = lerpNum(state.moonOpacity, target.moonOpacity);
  state.windowIntensity = lerpNum(state.windowIntensity, target.windowIntensity);
  state.lampIntensity = lerpNum(state.lampIntensity, target.lampIntensity);
  state.lampGlow = lerpNum(state.lampGlow, target.lampGlow);
  state.lanternGlow = lerpNum(state.lanternGlow, target.lanternGlow);
  state.beaconBase = lerpNum(state.beaconBase, target.beaconBase);
  state.pointLight = lerpNum(state.pointLight, target.pointLight);
  applyMode();

  // intro camera dolly
  if (introT < 1) {
    introT = Math.min(1, (performance.now() - INTRO_START) / 2600);
    const e = 1 - Math.pow(1 - introT, 3);
    camera.position.lerpVectors(INTRO_FROM, INTRO_TO, e);
    if (introT >= 1) controls.enabled = true;
  }

  // flag wave
  const flagGeo = tower.userData.flagGeo;
  const flagPos = flagGeo.attributes.position;
  for (let i = 0; i < flagPos.count; i++) {
    const x = flagPos.getX(i);
    const u = Math.min(1, Math.max(0, (x - 0.15) / 4.1));
    flagPos.setZ(i, Math.sin(x * 1.55 - t * 4.5) * 0.42 * u);
  }
  flagPos.needsUpdate = true;
  flagGeo.computeVertexNormals();

  // beacon pulse
  const pulse = 0.55 + 0.45 * Math.sin(t * 1.6);
  M.beacon.emissiveIntensity = state.beaconBase * (0.6 + 0.9 * pulse);
  beaconGlow.material.opacity = (0.15 + 0.7 * pulse) * Math.min(1, state.beaconBase + 0.25);
  const bgScale = 7.5 + 5.5 * pulse;
  beaconGlow.scale.set(bgScale, bgScale, 1);

  // lamp glows
  for (let i = 0; i < lampGlows.length; i++) {
    const g = lampGlows[i];
    g.material.opacity = state.lampGlow * (0.78 + 0.22 * Math.sin(t * 1.1 + i * 1.3));
    const s = 6.2 + 0.8 * Math.sin(t * 1.1 + i * 1.3);
    g.scale.set(s, s, 1);
  }

  // balloon
  const bAngle = t * 0.022 + 0.9;
  balloon.position.set(Math.cos(bAngle) * 145, 98 + Math.sin(t * 0.22) * 4.5, Math.sin(bAngle) * 145);
  balloon.rotation.y = -bAngle + Math.PI / 2;
  balloon.rotation.z = Math.sin(t * 0.2) * 0.05;
  balloonLantern.material.opacity = state.lanternGlow * (0.75 + 0.25 * Math.sin(t * 1.4));

  // stars slow rotation
  stars.mesh.rotation.y = t * 0.002;

  // clouds
  for (const c of clouds) {
    const u = c.userData;
    c.position.x += u.speed * dt * 0.62;
    if (c.position.x > 340) c.position.x = -340;
    c.position.y = u.baseY + Math.sin(t * u.bob * 0.5 + u.phase) * 1.8;
  }

  // birds
  for (const b of birds) {
    const u = b.userData;
    u.angle += u.speed * dt;
    const R = u.radius;
    const px = Math.cos(u.angle) * R, pz = Math.sin(u.angle) * R;
    const py = u.height + Math.sin(t * 0.38 + u.phase) * 3;
    const nx = Math.cos(u.angle + 0.06) * R, nz = Math.sin(u.angle + 0.06) * R;
    b.position.set(px, py, pz);
    b.lookAt(nx, py, nz);
    const flap = Math.sin(t * 5.2 + u.phase) * 0.62;
    u.left.rotation.z = -flap;
    u.right.rotation.z = flap;
  }

  // pond shimmer
  M.pond.emissiveIntensity = 0.12 + 0.1 * Math.sin(t * 0.9);

  controls.update();
  renderer.render(scene, camera);
}
tick();

/* ═══════════════════════ RESIZE ═══════════════════════ */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
