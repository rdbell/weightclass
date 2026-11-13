import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { L, validate, FOOTPRINTS, inDoorSwing, withinRoom } from './layout.js';
import { buildMaterials } from './materials.js';
import { buildRoom } from './room.js';
import { buildFurniture } from './furniture.js';
import { buildFire } from './fire.js';
import { buildLights } from './lights.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const query = (params.get('view') || 'door').toLowerCase();

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------
const VIEWS = {
  // standing just inside the door at eye height, looking north-east
  door: {
    label: 'from the doorway',
    kind: 'persp',
    pos: [-1.5, 1.6, 1.95],
    target: [0.97, 1.28, -0.53],
    fov: 60,
  },
  // from the fire, back across the room
  hearth: {
    label: 'from the fireside',
    kind: 'persp',
    pos: [2.62, 1.42, -0.62],
    target: [-2.2, 0.95, 0.85],
    fov: 62,
  },
  // over the armchair, taking in the bookcase
  reading: {
    label: 'from the armchair',
    kind: 'persp',
    pos: [2.72, 1.55, -0.95],
    target: [-2.1, 0.92, 0.6],
    fov: 58,
  },
  // orthographic plan, north up, ceiling removed
  top: {
    label: 'plan of the room',
    kind: 'ortho',
  },
};
let viewName = VIEWS[query] ? query : 'door';

// ---------------------------------------------------------------------------
// renderer / scene
// ---------------------------------------------------------------------------
const holder = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setClearColor(0x07060a, 1);
holder.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = null;

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.16;

const materials = buildMaterials();
const room = buildRoom(materials);
scene.add(room.shell, room.ceiling, room.exterior);

// the drawing aids (mount board, wall names, dimensions) only belong to the
// overhead plan view
const planAids = room.planGroup();
scene.add(planAids);
planAids.visible = false;

const furniture = buildFurniture(materials);
scene.add(furniture.root);

const fire = buildFire(materials);
scene.add(fire.group);

const lights = buildLights(scene);
scene.add(lights.group);

// ---------------------------------------------------------------------------
// cameras + controls
// ---------------------------------------------------------------------------
const persp = new THREE.PerspectiveCamera(VIEWS.door.fov, 1, 0.05, 60);
const ortho = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.1, 60);
ortho.up.set(0, 0, -1); // north up in the plan

const perspRig = { cam: persp, controls: null };
const orthoRig = { cam: ortho, controls: null };

function makeControls(cam) {
  const c = new OrbitControls(cam, renderer.domElement);
  c.enableDamping = true;
  c.dampingFactor = 0.07;
  c.rotateSpeed = 0.55;
  c.zoomSpeed = 0.9;
  c.panSpeed = 0.7;
  c.screenSpacePanning = true;
  c.minDistance = 0.35;
  c.maxDistance = 8;
  c.maxPolarAngle = Math.PI * 0.92;
  c.minPolarAngle = 0.02;
  return c;
}
perspRig.controls = makeControls(persp);
orthoRig.controls = makeControls(ortho);
orthoRig.controls.enableRotate = false;
orthoRig.controls.minZoom = 0.25;
orthoRig.controls.maxZoom = 6;

let active = perspRig;

function fitOrtho() {
  const aspect = Math.max(0.2, window.innerWidth / window.innerHeight);
  // the mount board is 8.1 x 5.96 m: fit it, with all four walls inside it
  const needW = 8.3;
  const needH = 6.05;
  let h = needH;
  let w = h * aspect;
  if (w < needW) {
    w = needW;
    h = w / aspect;
  }
  ortho.left = -w / 2;
  ortho.right = w / 2;
  ortho.top = h / 2;
  ortho.bottom = -h / 2;
  ortho.updateProjectionMatrix();
}

function applyView(name, { announce = true } = {}) {
  const v = VIEWS[name] || VIEWS.door;
  viewName = VIEWS[name] ? name : 'door';
  const top = v.kind === 'ortho';

  if (top) {
    ortho.position.set(0, 9, 0);
    ortho.up.set(0, 0, -1);
    ortho.zoom = 1;
    orthoRig.controls.target.set(0, 0, 0);
    fitOrtho();
    ortho.lookAt(0, 0, 0);
    active = orthoRig;
  } else {
    persp.fov = v.fov;
    persp.position.set(...v.pos);
    persp.lookAt(...v.target);
    perspRig.controls.target.set(...v.target);
    persp.updateProjectionMatrix();
    active = perspRig;
  }
  perspRig.controls.enabled = !top;
  orthoRig.controls.enabled = top;
  perspRig.controls.update();
  orthoRig.controls.update();

  room.ceiling.visible = !top;
  room.exterior.visible = !top;
  room.dust.points.visible = !top;
  furniture.pendant.visible = !top;
  planAids.visible = top;
  bloom.enabled = !top;
  lights.setTopView(top);
  scene.environmentIntensity = top ? 1.15 : 0.16;

  try {
    history.replaceState(null, '', top ? '?view=top' : viewName === 'door' ? '?view=door' : `?view=${viewName}`);
  } catch (e) {
    /* file:// without history access, no problem */
  }
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === viewName));
  const cap = document.getElementById('caption');
  if (cap) cap.textContent = v.label;
  const compass = document.getElementById('compass');
  if (compass) compass.classList.toggle('show', top);
}

// ---------------------------------------------------------------------------
// post processing
// ---------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, persp));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.26, 0.6, 0.95);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function syncRenderPass() {
  composer.passes[0].camera = active.cam;
}

// ---------------------------------------------------------------------------
// resize
// ---------------------------------------------------------------------------
function resize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloom.setSize(w, h);
  persp.aspect = w / h;
  persp.updateProjectionMatrix();
  fitOrtho();
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// debug helpers: footprints, the door swing, and the plan check
// ---------------------------------------------------------------------------
if (DEBUG) {
  const boxMat = new THREE.LineBasicMaterial({ color: 0x54ffcf });
  for (const f of FOOTPRINTS) {
    const g = new THREE.BoxGeometry(f.x1 - f.x0, Math.max(0.02, f.h), f.z1 - f.z0);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(g), boxMat);
    edges.position.set((f.x0 + f.x1) / 2, f.h / 2, (f.z0 + f.z1) / 2);
    scene.add(edges);
  }
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * (Math.PI / 2);
    pts.push(new THREE.Vector3(L.door.hingeX - Math.sin(a) * 0.9, 0.02, L.south - Math.cos(a) * 0.9));
  }
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff6a4d })));
  const { problems, clear } = validate();
  console.info('[layout] clearances ' + JSON.stringify(clear, null, 1));
  console.info('[layout] problems ' + (problems.length ? JSON.stringify(problems) : 'none'));
  window.__dbg = () => ({
    active: active.cam.type,
    pos: active.cam.position.toArray().map((v) => +v.toFixed(2)),
    ortho: [ortho.left, ortho.right, ortho.top, ortho.bottom, ortho.near, ortho.far, ortho.zoom].map((v) => +v.toFixed(2)),
    up: ortho.up.toArray(),
    quat: active.cam.quaternion.toArray().map((v) => +v.toFixed(3)),
    ceiling: room.ceiling.visible,
    exterior: room.exterior.visible,
    sceneChildren: scene.children.length,
    render: { ...renderer.info.render },
    pick: (x, z) => {
      const rc = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0), 0.1, 12);
      const list = [];
      const shown = (o) => {
        for (let p = o; p; p = p.parent) if (!p.visible) return false;
        return true;
      };
      scene.traverse((o) => {
        if (o.isMesh && shown(o)) list.push(o);
      });
      return rc
        .intersectObjects(list, false)
        .slice(0, 4)
        .map((h) => `${h.object.name || h.object.type}:${h.point.y.toFixed(2)}${h.object.parent && h.object.parent.name ? '<' + h.object.parent.name : ''}`);
    },
  });
}

// ---------------------------------------------------------------------------
// animation
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
timer.update();
// THREE.Timer clamps each frame's delta, so its "elapsed" runs slow; the fire
// and the candles are driven off the real clock instead
const clockStart = performance.now();
const now = () => (performance.now() - clockStart) / 1000;
const clampMin = new THREE.Vector3(L.west + 0.22, 0.18, L.north + 0.22);
const clampMax = new THREE.Vector3(L.east - 0.22, L.height - 0.12, L.south - 0.22);

function tick() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.05);
  const t = now();

  const swell = fire.update(t);
  room.dust.update(t);
  room.clouds.update(t);
  // the room holds the fire's breath: the bounced light follows the slow swell
  // only, so the whole view warms and cools without strobing
  if (viewName !== 'top') {
    scene.environmentIntensity = 0.02 + 0.155 * swell;
    lights.amb.intensity = 0.02 + 0.2 * swell;
    // the hemisphere fill stands for all the bounce in a dark room, and most of
    // that bounce starts at the fire
    lights.hemi.intensity = 0.9 * (0.4 + 0.66 * swell);
  }
  // motes are sized in metres, so they need this frame's focal length in pixels
  materials.dust.uniforms.uFocal.value = 0.5 * renderer.domElement.height * persp.projectionMatrix.elements[5];

  // candle and lamp flicker, cheap and unsynchronised
  for (let i = 0; i < furniture.anim.length; i++) {
    const s = furniture.anim[i];
    const k = 1 + 0.14 * Math.sin(t * 8.7 + i * 2.1) + 0.08 * Math.sin(t * 19.3 + i);
    if (s.isSprite && s.userData.w) {
      s.scale.set(s.userData.w * k, s.userData.h * (2 - k), 1);
      s.material.opacity = 0.75 + 0.18 * Math.sin(t * 9.7 + i);
    }
  }
  furniture.lampLight.intensity = viewName === 'top' ? 0 : 13 + 0.55 * Math.sin(t * 2.3);

  active.controls.update();
  if (active === perspRig) {
    persp.position.clamp(clampMin, clampMax);
  }

  if (composer.passes[0].camera !== active.cam) syncRenderPass();
  composer.render(dt);
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// interface
// ---------------------------------------------------------------------------
function buildHud() {
  const bar = document.getElementById('views');
  const names = ['door', 'top', 'hearth', 'reading'];
  // the buttons live in the markup so they are there before this module runs;
  // create any that are missing rather than relying on it
  for (const key of names) {
    let b = bar.querySelector(`[data-view="${key}"]`);
    if (!b) {
      b = document.createElement('button');
      b.dataset.view = key;
      bar.appendChild(b);
    }
    b.textContent = key;
    b.addEventListener('click', () => applyView(key));
  }
  window.addEventListener('keydown', (e) => {
    if (!e.key) return;
    const keys = { 1: 'door', 2: 'top', 3: 'hearth', 4: 'reading', d: 'door', t: 'top', f: 'hearth', r: 'reading' };
    const v = keys[e.key.toLowerCase()];
    if (v) applyView(v);
  });
}

// remember flame sprite base sizes so flicker does not drift
scene.traverse((o) => {
  if (o.isSprite) {
    o.userData.w = o.scale.x;
    o.userData.h = o.scale.y;
  }
});

buildHud();
applyView(viewName, { announce: false });
resize();
tick();

// lift the curtain once the first frame is on screen
requestAnimationFrame(() => {
  const fade = document.getElementById('fade');
  if (fade) {
    fade.style.opacity = '0';
    setTimeout(() => fade.remove(), 1400);
  }
});

window.addEventListener('pointerdown', () => document.body.classList.add('touched'));
