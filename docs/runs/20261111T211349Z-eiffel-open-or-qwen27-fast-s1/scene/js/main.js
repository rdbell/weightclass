import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mulberry32, makeGradientMap, makeRadialTexture } from './util.js';
import { buildTower } from './tower.js';
import { buildWorld } from './world.js';
import { ToonFXPass } from './fx.js';

const rng = mulberry32(1337);
const gradientMap = makeGradientMap();
const inkUniform = { value: new THREE.Color('#2a2115') };

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap; // hard, flat shadows
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xcfe9fb, 0.00155);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.5, 1500);

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xcfeaff, 0x7fa050, 0.62);
scene.add(hemi);

// soft fill from the opposite side keeps shadow faces readable (cartoon bounce)
const fill = new THREE.DirectionalLight(0xeaf6ff, 0.3);
fill.position.set(-90, 60, -120);
scene.add(fill);

const sun = new THREE.DirectionalLight(0xfff3d0, 1.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -140;
sun.shadow.camera.right = 140;
sun.shadow.camera.top = 140;
sun.shadow.camera.bottom = -140;
sun.shadow.camera.near = 30;
sun.shadow.camera.far = 560;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.9;
sun.target.position.set(0, 18, 0);
scene.add(sun, sun.target);

// ---------------------------------------------------------------------------
// Scene contents
// ---------------------------------------------------------------------------
const tower = buildTower({ gradientMap, inkUniform, rng });
scene.add(tower.group);

const world = buildWorld({ gradientMap, inkUniform, rng });
scene.add(world.group);

// The tower's nightly "sparkle"
const sparkMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uBurst: { value: 0 } },
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */ `
    attribute float aSeed;
    uniform float uTime;
    uniform float uBurst;
    varying float vA;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float tick = floor(uTime * 9.0);
      float on = step(0.35, fract(aSeed * 91.7 + tick * 0.713));
      float glow = 0.7 + 0.3 * sin(uTime * 6.0 + aSeed * 40.0);
      vA = on * uBurst * glow;
      gl_PointSize = (1.8 + 2.6 * fract(aSeed * 13.1)) * (320.0 / max(1.0, -mv.z));
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */ `
    varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.08, d) * vA;
      if (a < 0.02) discard;
      gl_FragColor = vec4(1.0, 0.92, 0.62, a);
    }`,
});
const sparkle = new THREE.Points(tower.sparkle, sparkMat);
sparkle.renderOrder = 5;
tower.group.add(sparkle);

// Beacon halo at the antenna tip
const beaconGlow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeRadialTexture(64), color: 0xff6a48, transparent: true, opacity: 0,
  blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
}));
beaconGlow.position.copy(tower.beacon.position);
beaconGlow.scale.set(9, 9, 1);
tower.group.add(beaconGlow);
const beaconOff = new THREE.Color(0x2a1d18);
const beaconOn = new THREE.Color(0xff4a38);

// ---------------------------------------------------------------------------
// Post processing: render -> sRGB output -> toon ink + vignette
// ---------------------------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new OutputPass());
const fx = new ToonFXPass();
composer.addPass(fx);

// ---------------------------------------------------------------------------
// Time-of-day moods
// ---------------------------------------------------------------------------
const C = (h) => new THREE.Color(h);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const TARGETS = {
  day: {
    skyTop: C('#3f8fd9'), skyBot: C('#d6efff'),
    sunPos: V(130, 205, 85), sunCol: C('#fff3d0'), sunInt: 1.15,
    hemiSky: C('#d7ecdf'), hemiGnd: C('#7fa050'), hemiInt: 0.5,
    fillCol: C('#eaf6ff'), fillInt: 0.3,
    orbPos: V(130, 205, 85),
    fogCol: C('#cfe9fb'), fogDen: 0.00155,
    groundTint: C('#ffffff'), cloudTint: C('#ffffff'),
    ink: C('#2a2115'), edge: 0.5,
    glowCol: C('#fff3cf'), glowStr: 0.5,
    starOp: 0, sunOp: 1, sunGlowOp: 0.4, moonOp: 0, moonGlowOp: 0,
    lampInt: 0.05, lampGlow: 0,
    birdOp: 1, sparkle: 0, beacon: 0,
  },
  dusk: {
    skyTop: C('#3d4a94'), skyBot: C('#ffa45e'),
    sunPos: V(-170, 150, -100), sunCol: C('#ff9d4f'), sunInt: 1.35,
    hemiSky: C('#8d6fa8'), hemiGnd: C('#54405a'), hemiInt: 0.5,
    fillCol: C('#ff9d5f'), fillInt: 0.4,
    orbPos: V(-170, 58, -100),
    fogCol: C('#e89a68'), fogDen: 0.0014,
    groundTint: C('#c39a82'), cloudTint: C('#ffd0a6'),
    ink: C('#332026'), edge: 0.55,
    glowCol: C('#ff8a45'), glowStr: 0.95,
    starOp: 0.15, sunOp: 1, sunGlowOp: 0.85, moonOp: 0, moonGlowOp: 0,
    lampInt: 1.0, lampGlow: 0.8,
    birdOp: 0.35, sparkle: 0.45, beacon: 0.7,
  },
  night: {
    skyTop: C('#060b24'), skyBot: C('#26375c'),
    sunPos: V(-110, 185, -140), sunCol: C('#a9c3ff'), sunInt: 0.85,
    hemiSky: C('#3f5a94'), hemiGnd: C('#141c33'), hemiInt: 0.7,
    fillCol: C('#5a76c0'), fillInt: 0.4,
    orbPos: V(-170, 45, -150),
    fogCol: C('#0a1124'), fogDen: 0.0019,
    groundTint: C('#5d70a8'), cloudTint: C('#5c6d9c'),
    ink: C('#0a0e22'), edge: 0.45,
    glowCol: C('#bcd2ff'), glowStr: 0.5,
    starOp: 1, sunOp: 0, sunGlowOp: 0, moonOp: 1, moonGlowOp: 0.65,
    lampInt: 1.5, lampGlow: 1,
    birdOp: 0, sparkle: 1, beacon: 1,
  },
};
const clonePreset = (p) => {
  const o = {};
  for (const k in p) o[k] = p[k].clone ? p[k].clone() : p[k];
  return o;
};

const todParam = new URLSearchParams(location.search).get('tod') || window.__TOD;
let goal = ['day', 'dusk', 'night'].includes(todParam) ? todParam : 'day';
let cur = clonePreset(TARGETS[goal]);

const buttons = [...document.querySelectorAll('#tod button')];
function setTod(name) {
  goal = name;
  for (const b of buttons) b.classList.toggle('on', b.dataset.tod === name);
}
buttons.forEach((b) => b.addEventListener('click', () => setTod(b.dataset.tod)));
window.addEventListener('keydown', (e) => {
  if (e.key === '1') setTod('day');
  else if (e.key === '2') setTod('dusk');
  else if (e.key === '3') setTod('night');
});
setTod(goal);

// ---------------------------------------------------------------------------
// Controls: a gentle fly-in, then orbit + zoom with idle auto-rotate
// ---------------------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 38, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 34;
controls.maxDistance = 250;
controls.maxPolarAngle = Math.PI * 0.495;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.enabled = false;

const camFrom = V(235, 150, 300);
const camTo = V(88, 42, 112);
let introT = 0;
let introDone = false;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

let idleTimer = 0;
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  clearTimeout(idleTimer);
});
controls.addEventListener('end', () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { controls.autoRotate = true; }, 12000);
});

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);
  fx.uniforms.uRes.value.copy(size);
}
window.addEventListener('resize', onResize);
onResize();

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const tmpDir = new THREE.Vector3();
const tmpP = new THREE.Vector3();

function applyMood() {
  const t = TARGETS[goal];
  scene.fog.color.copy(cur.fogCol);
  scene.fog.density = cur.fogDen;

  sun.position.copy(cur.sunPos);
  sun.color.copy(cur.sunCol);
  sun.intensity = cur.sunInt;
  hemi.color.copy(cur.hemiSky);
  hemi.groundColor.copy(cur.hemiGnd);
  hemi.intensity = cur.hemiInt;
  fill.color.copy(cur.fillCol);
  fill.intensity = cur.fillInt;

  // the visible sun/moon disc sits on the "orb" direction, which can be
  // lower on the horizon than the light itself (dusk drama without
  // unreasonably long shadows)
  tmpDir.copy(cur.orbPos).normalize();
  const u = world.sky.material.uniforms;
  u.uTop.value.copy(cur.skyTop);
  u.uBot.value.copy(cur.skyBot);
  u.uOrbDir.value.copy(tmpDir);
  u.uGlowCol.value.copy(cur.glowCol);
  u.uGlowStr.value = cur.glowStr;
  world.sun.visible = cur.sunOp > 0.02;
  world.sunMat.opacity = cur.sunOp;
  world.sun.position.copy(tmpDir).multiplyScalar(410);
  world.sun.lookAt(camera.position);
  world.sunGlow.visible = cur.sunGlowOp > 0.02;
  world.sunGlow.material.opacity = cur.sunGlowOp * 0.85;
  world.sunGlow.position.copy(tmpDir).multiplyScalar(410);
  world.moon.visible = cur.moonOp > 0.02;
  world.moonMat.opacity = cur.moonOp;
  world.moon.position.copy(tmpDir).multiplyScalar(415);
  world.moon.lookAt(camera.position);
  world.moonGlow.visible = cur.moonGlowOp > 0.02;
  world.moonGlow.material.opacity = cur.moonGlowOp;
  world.moonGlow.position.copy(tmpDir).multiplyScalar(415);

  world.groundMat.color.copy(cur.groundTint);
  world.cloudMat.color.copy(cur.cloudTint);
  world.starMat.uniforms.uOp.value = cur.starOp;
  world.bulbMat.emissiveIntensity = cur.lampInt;
  world.glowMat.opacity = cur.lampGlow * 0.85;
  world.birdMat.opacity = cur.birdOp;

  inkUniform.value.copy(cur.ink);
  fx.uniforms.uInk.value.copy(cur.ink);
  fx.uniforms.uEdge.value = cur.edge;

  tower.beaconMat.color.copy(beaconOff).lerp(beaconOn, cur.beacon);
}

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // relax the mood toward its target
  const k = 1 - Math.exp(-3.2 * dt);
  const t = TARGETS[goal];
  for (const key in t) {
    if (t[key].clone) cur[key].lerp(t[key], k);
    else cur[key] += (t[key] - cur[key]) * k;
  }
  applyMood();

  // camera: fly-in, then orbit controls
  if (!introDone) {
    introT += dt;
    const e = easeInOut(Math.min(introT / 3.6, 1));
    camera.position.lerpVectors(camFrom, camTo, e);
    camera.lookAt(0, 38, 0);
    if (introT >= 3.6) {
      introDone = true;
      controls.enabled = true;
    }
  } else {
    controls.update();
  }

  // sparkles: periodic bursts
  const cyc = time % 42;
  const win =
    THREE.MathUtils.smoothstep(cyc, 0, 1.5) *
    (1 - THREE.MathUtils.smoothstep(cyc, 8, 10.5));
  sparkMat.uniforms.uTime.value = time;
  // a faint constant shimmer, with periodic full bursts
  sparkMat.uniforms.uBurst.value = cur.sparkle * (0.15 + 0.85 * win);

  // beacon pulse
  const pulse = 0.3 + 0.7 * THREE.MathUtils.smoothstep(Math.sin(time * 1.9), 0.0, 0.35);
  beaconGlow.material.opacity = cur.beacon * pulse * 0.75;
  beaconGlow.scale.setScalar(7 + 3 * pulse);

  // drifting clouds
  for (const c of world.clouds) {
    c.mesh.position.x += c.speed * dt;
    if (c.mesh.position.x > 200) c.mesh.position.x -= 390;
    c.mesh.position.y = c.baseY + Math.sin(time * 0.25 + c.phase) * 0.9;
  }

  // birds
  const birdsVisible = cur.birdOp > 0.02;
  for (const b of world.birds) {
    if (!birdsVisible) { b.g.visible = false; continue; }
    b.g.visible = true;
    const a = time * b.w + b.ph;
    tmpP.set(Math.cos(a) * b.R, b.h + Math.sin(time * 0.7 + b.ph) * 1.5, Math.sin(a) * b.R);
    b.g.position.copy(tmpP);
    const a2 = a + Math.sign(b.w) * 0.12;
    b.g.lookAt(Math.cos(a2) * b.R, b.h, Math.sin(a2) * b.R);
    const f = Math.sin(time * 9 + b.fp) * 0.7;
    b.wr.rotation.z = f;
    b.wl.rotation.z = -f;
  }

  // fountain jets
  world.jets.forEach((jet, i) => {
    const s = 0.7 + 0.45 * (0.5 + 0.5 * Math.sin(time * 2.1 + i * 1.9));
    jet.scale.y = s;
    jet.position.y = 0.88 + 0.75 * s;
  });

  world.starMat.uniforms.uTime.value = time;
  composer.render();
}

renderer.setAnimationLoop(tick);
