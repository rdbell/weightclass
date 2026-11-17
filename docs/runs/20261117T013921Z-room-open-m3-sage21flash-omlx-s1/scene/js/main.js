import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildRoom } from './room.js';
import {
  createSofa, createArmchair, createCoffeeTable, createRug, createBookshelf,
  createFloorLamp, createSideTable, createLogBasket, createPlant,
} from './furniture.js';
import { createFire } from './fire.js';
import { rand } from './rng.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#0b0e14');

const { ceilingGroup, update: updateCurtains } = buildRoom(scene);

const lampGroup = createFloorLamp();
scene.add(
  createSofa(),
  createArmchair(),
  createCoffeeTable(),
  createRug(),
  createBookshelf(),
  lampGroup,
  createSideTable(),
  createLogBasket(),
  createPlant()
);
const fire = createFire(scene);
const lamp = lampGroup.userData.light;

// Lighting: cool moonlight through the window, warm lamp and fire inside.
const hemi = new THREE.HemisphereLight('#32425f', '#392a1e', 0.5);
scene.add(hemi);

const moon = new THREE.DirectionalLight('#a9c2e8', 2.4);
moon.position.set(-1.5, 5.5, -6.5);
moon.target.position.set(0.3, 0, 0.8);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -5.5;
moon.shadow.camera.right = 5.5;
moon.shadow.camera.top = 5.5;
moon.shadow.camera.bottom = -5.5;
moon.shadow.camera.near = 0.5;
moon.shadow.camera.far = 22;
moon.shadow.bias = -0.0004;
moon.shadow.normalBias = 0.02;
scene.add(moon, moon.target);

const fill = new THREE.PointLight('#ff9a5a', 6, 12, 2);
fill.position.set(-0.6, 2.2, 0.5);
scene.add(fill);

// Dust motes drifting in the lamplight.
const MOTES = 150;
const moteGeo = new THREE.BufferGeometry();
const mpos = new Float32Array(MOTES * 3);
const mseed = new Float32Array(MOTES);
for (let i = 0; i < MOTES; i++) {
  mpos[i * 3] = rand(-0.6, 2.3);
  mpos[i * 3 + 1] = rand(0.15, 2.3);
  mpos[i * 3 + 2] = rand(-2.0, 0.9);
  mseed[i] = rand(0, 6.28);
}
moteGeo.setAttribute('position', new THREE.BufferAttribute(mpos, 3));
const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({
  color: '#c8d4ea', size: 0.02, transparent: true, opacity: 0.5,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(motes);

// Views. Default and ?view=door: standing just inside the door at eye
// height, looking north-east. ?view=top: orthographic top-down, north up.
const params = new URLSearchParams(location.search);
const viewName = params.get('view') === 'top' ? 'top' : 'door';

let camera;
let controls;

function fitOrtho(cam, aspect) {
  const halfW = 3.35, halfH = 2.62;
  let hw = halfW, hh = halfH;
  if (aspect > hw / hh) hw = hh * aspect;
  else hh = hw / aspect;
  cam.left = -hw;
  cam.right = hw;
  cam.top = hh;
  cam.bottom = -hh;
  cam.updateProjectionMatrix();
}

if (viewName === 'top') {
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  camera.position.set(0, 20, 0);
  camera.up.set(0, 0, -1); // north up
  camera.lookAt(0, 0, 0);
  fitOrtho(camera, window.innerWidth / window.innerHeight);
  ceilingGroup.visible = false;
  hemi.intensity = 1.15; // brighter plan view
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minZoom = 0.6;
  controls.maxZoom = 4;
} else {
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.05, 80);
  camera.position.set(-1.8, 1.6, 1.85);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(1.45, 0.95, -1.15);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0.2;
  controls.maxDistance = 10;
  controls.maxPolarAngle = Math.PI * 0.495;
}

window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  if (camera.isPerspectiveCamera) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  } else {
    fitOrtho(camera, w / h);
  }
});

function updateMotes(t) {
  const a = moteGeo.attributes.position;
  for (let i = 0; i < MOTES; i++) {
    a.array[i * 3 + 1] += Math.sin(t * 0.5 + mseed[i]) * 0.0006;
    a.array[i * 3] += Math.cos(t * 0.4 + mseed[i]) * 0.0004;
  }
  a.needsUpdate = true;
}

function tick() {
  requestAnimationFrame(tick);
  const elapsed = performance.now() / 1000;
  fire.update(elapsed);
  updateCurtains(elapsed);
  lamp.intensity = 14 * (1 + 0.045 * Math.sin(elapsed * 6.7) + 0.03 * Math.sin(elapsed * 11.3 + 1));
  updateMotes(elapsed);
  controls.update();
  renderer.render(scene, camera);
}
tick();