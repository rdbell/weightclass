import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ------------------------------------------------------------------ */
/* Seeded randomness (same layout & decor on every load)               */
/* ------------------------------------------------------------------ */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261123);
const rr = (a, b) => a + rand() * (b - a);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/* ------------------------------------------------------------------ */
/* Plan (metres). North = -z, east = +x, origin = centre of floor.     */
/* ------------------------------------------------------------------ */
const ROOM = { W: 6, D: 4.5, H: 2.7, T: 0.15 };          // x: -3..3, z: -2.25..2.25
const DOOR = { cx: -1.8, w: 0.9, h: 2.05 };               // south wall, centre 1.2 m from west wall
const DOOR_HINGE = new THREE.Vector2(-2.25, 2.25);        // hinged west side, opens into room
const WIN  = { cx: 0, w: 1.6, sill: 0.9, top: 2.1 };      // north wall, centred
const FIRE = { front: 2.8, halfW: 0.85, openHalf: 0.5, openH: 0.75 }; // east wall, centred, 1 m opening

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0b09);

/* ------------------------------------------------------------------ */
/* Renderer / cameras / controls                                       */
/* ------------------------------------------------------------------ */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('app').appendChild(renderer.domElement);

/* View from the doorway: just inside the door, eye height 1.6, looking NE */
const persp = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 80);
persp.position.set(-1.8, 1.6, 1.9);
const doorTarget = new THREE.Vector3(0.9, 1.05, -0.75);

/* Orthographic top-down: north up, framing all four walls */
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, -5, 60);
function fitOrtho() {
  const a = innerWidth / innerHeight;
  const hw = Math.max(3.6, 2.8 * a);           // covers 6 m + walls + margin
  const hh = hw / a;
  ortho.left = -hw; ortho.right = hw; ortho.top = hh; ortho.bottom = -hh;
  ortho.updateProjectionMatrix();
}
ortho.position.set(0, 30, 0);
ortho.up.set(0, 0, -1);                        // north (-z) up
ortho.lookAt(0, 0, 0);
fitOrtho();

const mode = new URLSearchParams(location.search).get('view') === 'top' ? 'top' : 'door';
const activeCamera = mode === 'top' ? ortho : persp;

const controls = new OrbitControls(activeCamera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxDistance = mode === 'top' ? 8 : 14;
controls.minDistance = mode === 'top' ? 0.3 : 0.4;
if (mode === 'top') {
  controls.target.set(0, 0, 0);
} else {
  controls.target.copy(doorTarget);
}
controls.update();

addEventListener('resize', () => {
  persp.aspect = innerWidth / innerHeight;
  persp.updateProjectionMatrix();
  fitOrtho();
  renderer.setSize(innerWidth, innerHeight);
});

setTimeout(() => { document.getElementById('hint').style.opacity = '0'; }, 8000);

/* ------------------------------------------------------------------ */
/* Procedural textures                                                 */
/* ------------------------------------------------------------------ */
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* Oak plank floor, planks running east-west */
const floorTex = canvasTex(512, 512, (g, w, h) => {
  const rows = 6, rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rr(0, 160);
    while (x < w) {
      const pw = rr(130, 230), l = rr(-16, 16);
      g.fillStyle = `rgb(${126 + l | 0},${88 + l * 0.72 | 0},${55 + l * 0.5 | 0})`;
      g.fillRect(x, r * rh, pw - 2, rh - 2);
      g.strokeStyle = 'rgba(58,38,22,0.30)';
      for (let i = 0; i < 9; i++) {
        const y = r * rh + rr(4, rh - 4);
        g.lineWidth = rr(0.5, 1.6);
        g.beginPath();
        g.moveTo(x + 3, y);
        g.bezierCurveTo(x + pw * 0.3, y + rr(-3, 3), x + pw * 0.6, y + rr(-3, 3), x + pw - 4, y + rr(-2, 2));
        g.stroke();
      }
      g.fillStyle = 'rgba(28,18,10,0.85)';
      g.fillRect(x + pw - 2, r * rh, 2, rh);
      x += pw;
    }
    g.fillStyle = 'rgba(28,18,10,0.9)';
    g.fillRect(0, r * rh - 1, w, 2);
  }
}, [2.0, 1.6]);

/* Warm plaster */
const plasterTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#e6d7bf';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${rr(120, 200) | 0},${rr(100, 175) | 0},${rr(75, 140) | 0},${rr(0.02, 0.07)})`;
    g.fillRect(rr(0, w), rr(0, h), rr(1, 2.5), rr(1, 2.5));
  }
}, [2, 1]);

/* Brick for the chimney breast */
const brickTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#8d8378';
  g.fillRect(0, 0, w, h);
  const bh = 21, bw = 52;
  let row = 0;
  for (let y = 0; y < h; y += bh, row++) {
    for (let x = -bw; x < w + bw; x += bw) {
      const ox = (row % 2) * bw / 2;
      g.fillStyle = `rgb(${148 + rr(-26, 26) | 0},${72 + rr(-14, 14) | 0},${56 + rr(-12, 12) | 0})`;
      g.fillRect(x + ox + 2, y + 2, bw - 4, bh - 4);
      g.fillStyle = 'rgba(0,0,0,0.12)';
      g.fillRect(x + ox + 2, y + bh - 5, bw - 4, 3);
    }
  }
}, [1.6, 1.6]);

/* Dark walnut for furniture */
const walnutTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#4a3320';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(${rr(20, 60) | 0},${rr(14, 40) | 0},${rr(8, 24) | 0},${rr(0.15, 0.5)})`;
    g.lineWidth = rr(1, 4);
    const y = rr(0, h);
    g.beginPath();
    g.moveTo(0, y);
    g.bezierCurveTo(w * 0.3, y + rr(-8, 8), w * 0.6, y + rr(-8, 8), w, y + rr(-6, 6));
    g.stroke();
  }
}, [1, 1]);

/* Stone hearth slabs */
const stoneTex = canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#6d675e';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const l = rr(-14, 14);
    g.fillStyle = `rgb(${118 + l | 0},${110 + l | 0},${100 + l | 0})`;
    g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60);
    for (let k = 0; k < 30; k++) {
      g.fillStyle = `rgba(60,55,48,${rr(0.05, 0.2)})`;
      g.fillRect(i * 64 + rr(3, 58), j * 64 + rr(3, 58), rr(1, 5), rr(1, 3));
    }
  }
}, [1, 1]);

/* Crimson wool rug with a cream border and diamond lattice */
const rugTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#772c24';
  g.fillRect(0, 0, w, h);
  // field lattice
  g.strokeStyle = 'rgba(222,196,150,0.55)';
  g.lineWidth = 3;
  const step = 64;
  for (let y = -h; y < h * 2; y += step) {
    g.beginPath(); g.moveTo(y, 0); g.lineTo(y + h, h); g.stroke();
    g.beginPath(); g.moveTo(y, 0); g.lineTo(y - h, h); g.stroke();
  }
  // medallion
  g.fillStyle = 'rgba(222,196,150,0.85)';
  g.beginPath();
  g.moveTo(w / 2, h / 2 - 70); g.lineTo(w / 2 + 70, h / 2);
  g.lineTo(w / 2, h / 2 + 70); g.lineTo(w / 2 - 70, h / 2);
  g.closePath(); g.fill();
  g.fillStyle = '#772c24';
  g.beginPath();
  g.moveTo(w / 2, h / 2 - 44); g.lineTo(w / 2 + 44, h / 2);
  g.lineTo(w / 2, h / 2 + 44); g.lineTo(w / 2 - 44, h / 2);
  g.closePath(); g.fill();
  // borders
  g.strokeStyle = '#dec496'; g.lineWidth = 10; g.strokeRect(22, 22, w - 44, h - 44);
  g.strokeStyle = '#2e3a4a'; g.lineWidth = 4; g.strokeRect(38, 38, w - 76, h - 76);
  g.strokeStyle = '#dec496'; g.lineWidth = 3; g.strokeRect(50, 50, w - 100, h - 100);
  // woolly noise
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${rr(90, 235) | 0},${rr(60, 190) | 0},${rr(40, 140) | 0},${rr(0.03, 0.09)})`;
    g.fillRect(rr(0, w), rr(0, h), rr(1, 2), rr(1, 2));
  }
});

/* Little landscape paintings for the frames */
function artTexture() {
  return canvasTex(256, 192, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, pick(['#e8c98f', '#d9b47e', '#e3cf9f']));
    sky.addColorStop(1, pick(['#b07a4e', '#a3653f', '#c08a55']));
    g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.7);
    g.fillStyle = pick(['#2e3b2c', '#3a2f26', '#25332c']);
    let x = 0;
    while (x < w) { // pine silhouettes
      const th = rr(30, 80), tw = rr(10, 22);
      g.beginPath();
      g.moveTo(x, h * 0.7);
      g.lineTo(x + tw / 2, h * 0.7 - th);
      g.lineTo(x + tw, h * 0.7);
      g.closePath(); g.fill();
      x += rr(14, 34);
    }
    g.fillStyle = '#241d15';
    g.fillRect(0, h * 0.7, w, h * 0.3);
    g.fillStyle = 'rgba(240,225,190,0.9)';
    g.beginPath(); g.arc(rr(40, 210), rr(25, 60), rr(8, 15), 0, Math.PI * 2); g.fill();
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(40,30,20,${rr(0.02, 0.08)})`;
      g.fillRect(rr(0, w), rr(0, h), 1.5, 1.5);
    }
  });
}

/* ------------------------------------------------------------------ */
/* Materials                                                           */
/* ------------------------------------------------------------------ */
const matFloor   = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0 });
const matWall    = new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.92 });
const matCeil    = new THREE.MeshStandardMaterial({ color: 0xe9dfcc, roughness: 0.95 });
const matWalnut  = new THREE.MeshStandardMaterial({ map: walnutTex, roughness: 0.6 });
const matOak     = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55, color: 0xcfa878 });
const matBrick   = new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.95 });
const matStone   = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.85 });
const matRug     = new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.98 });
const matPainted = new THREE.MeshStandardMaterial({ color: 0xd9cab0, roughness: 0.85 });
const matDark    = new THREE.MeshStandardMaterial({ color: 0x17120d, roughness: 1 });
const matSofa    = new THREE.MeshStandardMaterial({ color: 0xa5673a, roughness: 0.9 });
const matChair   = new THREE.MeshStandardMaterial({ color: 0x46583f, roughness: 0.9 });
const matCream   = new THREE.MeshStandardMaterial({ color: 0xe4d3ac, roughness: 0.9 });
const matCurtain = new THREE.MeshStandardMaterial({ color: 0x3c5142, roughness: 0.95 });
const matMetal   = new THREE.MeshStandardMaterial({ color: 0x3a3630, roughness: 0.4, metalness: 0.8 });
const matBrass   = new THREE.MeshStandardMaterial({ color: 0x8a6b35, roughness: 0.35, metalness: 0.85 });
const matGlass   = new THREE.MeshPhysicalMaterial({ color: 0xc7d8e8, transparent: true, opacity: 0.16, roughness: 0.08, side: THREE.DoubleSide });
const matLeaf    = new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.85 });
const matPot     = new THREE.MeshStandardMaterial({ color: 0x9a5636, roughness: 0.9 });

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
function box(w, h, d, mat, x, y, z, parent = scene, cast = true, recv = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = cast; m.receiveShadow = recv;
  parent.add(m);
  return m;
}
function rbox(w, h, d, r, mat, x, y, z, parent = scene, seg = 3) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, r), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cyl(rT, rB, h, mat, x, y, z, parent = scene, seg = 20) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}
function sph(r, mat, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/* ------------------------------------------------------------------ */
/* The room shell                                                      */
/* ------------------------------------------------------------------ */
const T = ROOM.T;
const shell = new THREE.Group();
scene.add(shell);

/* floor */
box(6.3, 0.1, 4.8, matFloor, 0, -0.05, 0, shell, false, true);

/* ceiling (hidden in the top view so the layout is visible) */
const ceiling = box(6.3, 0.08, 4.8, matCeil, 0, ROOM.H + 0.04, 0, shell, false, false);
ceiling.visible = mode !== 'top';

/* south wall (z = +2.25..2.4) with door opening x -2.25..-1.35, h 2.05 */
box(0.75, ROOM.H, T, matWall, -2.625, ROOM.H / 2, 2.325, shell);
box(4.35, ROOM.H, T, matWall, 0.825, ROOM.H / 2, 2.325, shell);
box(DOOR.w, ROOM.H - DOOR.h, T, matWall, DOOR.cx, DOOR.h + (ROOM.H - DOOR.h) / 2, 2.325, shell);

/* north wall (z = -2.4..-2.25) with window opening x -0.8..0.8, y 0.9..2.1 */
box(2.2, ROOM.H, T, matWall, -1.9, ROOM.H / 2, -2.325, shell);
box(2.2, ROOM.H, T, matWall, 1.9, ROOM.H / 2, -2.325, shell);
box(WIN.w, WIN.sill, T, matWall, 0, WIN.sill / 2, -2.325, shell);
box(WIN.w, ROOM.H - WIN.top, T, matWall, 0, WIN.top + (ROOM.H - WIN.top) / 2, -2.325, shell);

/* west wall, solid */
box(T, ROOM.H, 4.5 + 2 * T, matWall, -3.075, ROOM.H / 2, 0, shell);

/* east wall, solid except where the firebox recesses into it (z +-0.5, y<0.75) */
box(T, ROOM.H, 1.4, matWall, 3.075, ROOM.H / 2, -1.55, shell);
box(T, ROOM.H, 1.4, matWall, 3.075, ROOM.H / 2, 1.55, shell);

/* baseboards (painted), skipping the door and the fireplace breast */
box(0.74, 0.12, 0.025, matPainted, -2.63, 0.06, 2.235, shell);
box(4.34, 0.12, 0.025, matPainted, 0.83, 0.06, 2.235, shell);
box(6.0, 0.12, 0.025, matPainted, 0, 0.06, -2.235, shell);
box(0.025, 0.12, 1.37, matPainted, 2.987, 0.06, -1.555, shell);
box(0.025, 0.12, 1.37, matPainted, 2.987, 0.06, 1.555, shell);

/* ------------------------------------------------------------------ */
/* Door — hinged on its west side, opening into the room               */
/* ------------------------------------------------------------------ */
const doorG = new THREE.Group();
doorG.position.set(DOOR_HINGE.x, 0, DOOR_HINGE.y);
doorG.rotation.y = THREE.MathUtils.degToRad(82); // leaf sweeps into the room
shell.add(doorG);
{
  const leaf = box(0.86, DOOR.h - 0.04, 0.045, matWalnut, 0.45, (DOOR.h - 0.04) / 2, 0, doorG);
  // recessed panels
  box(0.62, 0.72, 0.012, matDark, 0.45, 0.62, 0, doorG, false, false);
  box(0.62, 0.72, 0.012, matDark, 0.45, 1.52, 0, doorG, false, false);
  // knobs
  sph(0.028, matBrass, 0.84, 1.02, 0.045, doorG);
  sph(0.028, matBrass, 0.84, 1.02, -0.045, doorG);
  // frame trim around the opening
  box(0.09, DOOR.h + 0.05, 0.05, matPainted, -2.26, (DOOR.h + 0.05) / 2, 2.245, shell);
  box(0.09, DOOR.h + 0.05, 0.05, matPainted, -1.34, (DOOR.h + 0.05) / 2, 2.245, shell);
  box(1.08, 0.09, 0.05, matPainted, DOOR.cx, DOOR.h + 0.045, 2.245, shell);
}

/* ------------------------------------------------------------------ */
/* Window — frame, mullions, glass, sill, curtains                     */
/* ------------------------------------------------------------------ */
{
  const z = -2.26;
  // frame
  box(0.1, 1.3, 0.07, matPainted, -0.83, 1.5, z, shell);
  box(0.1, 1.3, 0.07, matPainted, 0.83, 1.5, z, shell);
  box(1.76, 0.1, 0.07, matPainted, 0, 2.13, z, shell);
  box(1.76, 0.1, 0.07, matPainted, 0, 0.87, z, shell);
  // mullions
  box(0.045, 1.2, 0.05, matPainted, 0, 1.5, z, shell);
  box(1.6, 0.045, 0.05, matPainted, 0, 1.5, z, shell);
  // glass
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), matGlass);
  glass.position.set(0, 1.5, -2.32);
  shell.add(glass);
  // sill board
  box(1.86, 0.05, 0.16, matOak, 0, 0.875, -2.2, shell);
  // curtain rod + panels
  const rod = cyl(0.018, 0.018, 2.5, matWalnut, 0, 2.32, -2.12, shell);
  rod.rotation.z = Math.PI / 2;
  sph(0.035, matWalnut, -1.25, 2.32, -2.12, shell);
  sph(0.035, matWalnut, 1.25, 2.32, -2.12, shell);
  box(0.32, 1.62, 0.07, matCurtain, -1.02, 1.5, -2.11, shell);
  box(0.32, 1.62, 0.07, matCurtain, 1.02, 1.5, -2.11, shell);
}

/* ------------------------------------------------------------------ */
/* Fireplace — chimney breast on the east wall, 1 m opening            */
/* ------------------------------------------------------------------ */
const fireG = new THREE.Group();
scene.add(fireG);
let fireLight, flames = [], emberMat;
{
  const fx = FIRE.front;                       // 2.8, front plane of the breast
  // jambs (z +-0.5..0.85, full height)
  box(3.15 - fx, ROOM.H, 0.35, matBrick, (fx + 3.15) / 2, ROOM.H / 2, -0.675, fireG);
  box(3.15 - fx, ROOM.H, 0.35, matBrick, (fx + 3.15) / 2, ROOM.H / 2, 0.675, fireG);
  // lintel + upper breast (z +-0.5)
  box(3.15 - fx, ROOM.H - FIRE.openH, 1.0, matBrick, (fx + 3.15) / 2, FIRE.openH + (ROOM.H - FIRE.openH) / 2, 0, fireG);
  // dark firebox back
  box(0.1, FIRE.openH, 1.0, matDark, 3.12, FIRE.openH / 2, 0, fireG, false, false);
  // flush stone hearth
  const hearth = box(0.24, 0.012, 1.1, matStone, 2.9, 0.006, 0, fireG);
  hearth.castShadow = false;
  // glowing ember bed
  emberMat = new THREE.MeshStandardMaterial({ color: 0x2a0d05, emissive: 0xff5a1a, emissiveIntensity: 1.2, roughness: 1 });
  const embers = box(0.34, 0.05, 0.8, emberMat, 2.96, 0.03, 0, fireG, false, false);
  embers.receiveShadow = false;
  // logs
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2415, roughness: 0.95 });
  const logs = [
    [0.10, 0.05, 2.97, 0.35], [-0.06, 0.04, 2.99, -0.30], [0.03, 0.11, 2.96, 0.10],
  ];
  for (const [y, dy, lx, rot] of logs) {
    const log = cyl(0.055, 0.06, 0.5, logMat, lx, 0.09 + dy, 0, fireG);
    log.rotation.x = Math.PI / 2;
    log.rotation.y = rot;
  }
  // flames (additive cones, animated)
  const flameGeo = new THREE.ConeGeometry(0.09, 0.4, 7);
  for (let i = 0; i < 7; i++) {
    const inner = i % 2 === 0;
    const mat = new THREE.MeshBasicMaterial({
      color: inner ? 0xffd685 : 0xff8a2e,
      transparent: true, opacity: 0.8,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const f = new THREE.Mesh(flameGeo, mat);
    f.position.set(2.95 + rr(-0.05, 0.05), 0.3, rr(-0.26, 0.26));
    f.userData = { phase: rr(0, 10), speed: rr(6, 12), base: rr(0.7, 1.3) };
    fireG.add(f);
    flames.push(f);
  }
  // mantel shelf + trim
  box(0.13, 0.07, 2.0, matWalnut, 2.785, 1.19, 0, fireG);
  box(0.04, FIRE.openH + 0.06, 1.08, matWalnut, 2.79, FIRE.openH / 2, 0, fireG, true, true);
  // mantel decor: candlesticks and a couple of books
  for (const cz of [-0.55, 0.5]) {
    cyl(0.035, 0.05, 0.03, matBrass, 2.78, 1.245, cz, fireG);
    cyl(0.014, 0.02, 0.16, matCream, 2.78, 1.33, cz, fireG);
    const fl = cyl(0.008, 0.014, 0.05, new THREE.MeshBasicMaterial({ color: 0xffc266 }), 2.78, 1.43, cz, fireG, 8);
    fl.castShadow = false;
  }
  const b1 = box(0.22, 0.035, 0.16, matChair, 2.78, 1.225, 0.72, fireG);
  b1.rotation.y = 0.3;
  const b2 = box(0.2, 0.03, 0.14, matCream, 2.78, 1.258, 0.72, fireG);
  b2.rotation.y = -0.15;
  // framed picture above the mantel
  wallPicture(0.5, 0.38, 2.795, 1.85, 0, -Math.PI / 2, fireG);
  // firelight
  fireLight = new THREE.PointLight(0xff7a2a, 16, 9, 2);
  fireLight.position.set(2.75, 0.55, 0);
  fireLight.castShadow = true;
  fireLight.shadow.mapSize.set(512, 512);
  fireLight.shadow.bias = -0.02;
  fireG.add(fireLight);
}

/* ------------------------------------------------------------------ */
/* Sofa — faces the fireplace, back 2.5 m from the east wall (x=0.5)   */
/* ------------------------------------------------------------------ */
const sofa = new THREE.Group();
scene.add(sofa);
{
  // legs (front legs reach onto the rug)
  for (const [lx, lz] of [[0.56, -0.92], [0.56, 0.92], [1.25, -0.92], [1.25, 0.92]]) {
    cyl(0.03, 0.035, 0.14, matWalnut, lx, 0.07, lz, sofa, 10);
  }
  // base: x 0.5..1.30 (0.8 deep), z +-1.05
  rbox(0.8, 0.3, 2.1, 0.04, matSofa, 0.9, 0.285, 0, sofa);
  // back: plane at x = 0.5
  rbox(0.2, 0.68, 2.1, 0.05, matSofa, 0.6, 0.78, 0, sofa);
  // arms
  rbox(0.8, 0.3, 0.24, 0.06, matSofa, 0.9, 0.55, -0.945, sofa);
  rbox(0.8, 0.3, 0.24, 0.06, matSofa, 0.9, 0.55, 0.945, sofa);
  // seat cushions
  rbox(0.57, 0.16, 0.94, 0.06, matSofa, 1.0, 0.5, -0.41, sofa, 4);
  rbox(0.57, 0.16, 0.94, 0.06, matSofa, 1.0, 0.5, 0.41, sofa, 4);
  // back cushions
  const bc1 = rbox(0.14, 0.52, 0.9, 0.06, matSofa, 0.74, 0.86, -0.41, sofa, 4);
  bc1.rotation.z = -0.08;
  const bc2 = rbox(0.14, 0.52, 0.9, 0.06, matSofa, 0.74, 0.86, 0.41, sofa, 4);
  bc2.rotation.z = -0.08;
  // throw pillows
  const p1 = rbox(0.4, 0.4, 0.13, 0.05, matCream, 0.86, 0.72, -0.78, sofa, 5);
  p1.rotation.set(0.1, 0.25, 0.9);
  const p2 = rbox(0.38, 0.38, 0.13, 0.05, matChair, 0.88, 0.72, 0.76, sofa, 5);
  p2.rotation.set(-0.08, -0.2, 1.05);
  // blanket draped over the north arm
  rbox(0.55, 0.045, 0.5, 0.02, matCream, 0.86, 0.715, -0.94, sofa, 3);
  box(0.4, 0.3, 0.03, matCream, 0.68, 0.56, -1.08, sofa, true, false);
  // a book left on the seat
  box(0.2, 0.025, 0.14, matChair, 1.05, 0.595, 0.15, sofa).rotation.y = 0.4;
}

/* ------------------------------------------------------------------ */
/* Coffee table — between sofa and fireplace, 0.45 m+ walkway both sides*/
/* top spans x 1.80..2.20                                              */
/* ------------------------------------------------------------------ */
const table = new THREE.Group();
scene.add(table);
{
  rbox(0.4, 0.045, 0.95, 0.012, matOak, 2.0, 0.4, 0, table, 3);
  // lower shelf
  box(0.32, 0.025, 0.7, matOak, 2.0, 0.14, 0, table);
  // legs
  for (const [lz] of [[-0.4], [0.4]]) {
    cyl(0.024, 0.028, 0.38, matWalnut, 1.85, 0.2, lz, table, 10);
    cyl(0.024, 0.028, 0.38, matWalnut, 2.15, 0.2, lz, table, 10);
  }
  // things on top: stacked books, a mug
  box(0.22, 0.03, 0.16, matChair, 1.97, 0.438, -0.22, table).rotation.y = 0.35;
  box(0.2, 0.026, 0.14, matCream, 1.97, 0.466, -0.22, table).rotation.y = -0.1;
  cyl(0.042, 0.038, 0.095, matCream, 2.05, 0.473, 0.24, table, 16);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.008, 8, 16), matCream);
  handle.position.set(2.05, 0.473, 0.29);
  handle.rotation.x = Math.PI / 2;
  handle.castShadow = true;
  table.add(handle);
}

/* ------------------------------------------------------------------ */
/* Rug — centred under the coffee table, under the sofa's front legs   */
/* ------------------------------------------------------------------ */
{
  const rug = box(1.57, 0.012, 2.0, matRug, 1.985, 0.006, 0, scene, false, true);
  rug.receiveShadow = true;
}

/* ------------------------------------------------------------------ */
/* Armchair — 45° toward the fireplace in the north-east corner        */
/* ------------------------------------------------------------------ */
const chair = new THREE.Group();
chair.position.set(2.32, 0, -1.63);
chair.rotation.y = -Math.PI / 4;   // local +x (its facing) turns to south-east
scene.add(chair);
{
  for (const [lx, lz] of [[-0.28, -0.28], [-0.28, 0.28], [0.28, -0.28], [0.28, 0.28]]) {
    cyl(0.026, 0.03, 0.13, matWalnut, lx, 0.065, lz, chair, 10);
  }
  rbox(0.74, 0.3, 0.74, 0.05, matChair, 0.02, 0.29, 0, chair);
  rbox(0.18, 0.72, 0.74, 0.06, matChair, -0.29, 0.73, 0, chair); // back
  rbox(0.66, 0.26, 0.16, 0.06, matChair, 0.02, 0.55, -0.315, chair); // arms
  rbox(0.66, 0.26, 0.16, 0.06, matChair, 0.02, 0.55, 0.315, chair);
  rbox(0.46, 0.14, 0.52, 0.06, matChair, 0.09, 0.5, 0, chair, 4); // seat cushion
  const bc = rbox(0.12, 0.46, 0.52, 0.06, matChair, -0.15, 0.8, 0, chair, 4);
  bc.rotation.z = -0.1;
  const pil = rbox(0.32, 0.32, 0.11, 0.05, matCream, -0.02, 0.7, -0.2, chair, 5);
  pil.rotation.set(0.15, 0.2, 0.85);
}

/* ------------------------------------------------------------------ */
/* Floor lamp — beside the armchair, on its west side                  */
/* ------------------------------------------------------------------ */
const lampG = new THREE.Group();
lampG.position.set(1.5, 0, -1.85);
scene.add(lampG);
let lampLight;
{
  cyl(0.16, 0.19, 0.025, matMetal, 0, 0.012, 0, lampG);
  cyl(0.018, 0.018, 1.42, matMetal, 0, 0.72, 0, lampG, 12);
  // shade
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.2, 0.26, 24, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xe8cfa0, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xffb45e, emissiveIntensity: 0.55 })
  );
  shade.position.set(0, 1.5, 0);
  shade.castShadow = true;
  lampG.add(shade);
  lampLight = new THREE.PointLight(0xffc98a, 9, 9, 2);
  lampLight.position.set(0, 1.42, 0);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(512, 512);
  lampLight.shadow.bias = -0.02;
  lampG.add(lampLight);
}

/* ------------------------------------------------------------------ */
/* Bookshelf — floor to ceiling on the west wall, clear of door swing  */
/* ------------------------------------------------------------------ */
const shelf = new THREE.Group();
scene.add(shelf);
{
  const x0 = -3, x1 = -2.72, z0 = -2.24, z1 = 1.35, H = ROOM.H;
  const cx = (x0 + x1) / 2;
  // back panel
  box(0.02, H, z1 - z0, matWalnut, x0 + 0.015, H / 2, (z0 + z1) / 2, shelf, false, true);
  // sides
  box(x1 - x0, H, 0.03, matWalnut, cx, H / 2, z0 + 0.015, shelf);
  box(x1 - x0, H, 0.03, matWalnut, cx, H / 2, z1 - 0.015, shelf);
  // top
  box(x1 - x0, 0.03, z1 - z0, matWalnut, cx, H - 0.015, (z0 + z1) / 2, shelf);
  // shelves
  const levels = [0.015, 0.565, 1.085, 1.605, 2.125];
  for (const y of levels) box(x1 - x0, 0.03, z1 - z0, matWalnut, cx, y, (z0 + z1) / 2, shelf);

  // books
  const palette = ['#7a3324', '#3e5a47', '#8a6d3b', '#413a5e', '#71493a',
                   '#93482f', '#34565e', '#6b2737', '#5a6b3a', '#8f7f5a', '#2f3a4a'];
  const bookMat = {};
  const getMat = (c) => bookMat[c] || (bookMat[c] = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75 }));
  const zs = z0 + 0.045, ze = z1 - 0.045;
  levels.forEach((y, li) => {
    let z = zs;
    const cap = li === 2 ? 0.78 : 1; // one shelf partly filled with a horizontal stack
    while (z < ze - 0.05) {
      if (rand() < 0.09) { z += rr(0.03, 0.14); continue; }
      const thick = rr(0.018, 0.05);
      const bh = rr(0.2, 0.33);
      const bd = rr(0.14, 0.2);
      if (rand() < 0.06 * cap && z < ze - 0.3) {
        // small flat stack
        let sy = levels[li] + 0.015;
        const n = 2 + Math.floor(rand() * 2);
        for (let k = 0; k < n; k++) {
          const sw = rr(0.2, 0.26), sh = rr(0.02, 0.032);
          box(bd, sh, sw, getMat(pick(palette)), -2.87 + rr(-0.01, 0.01), sy + sh / 2, z + sw / 2, shelf);
          sy += sh;
        }
        z += 0.3;
        continue;
      }
      const b = box(bd, bh, thick, getMat(pick(palette)), -2.87 + rr(-0.012, 0.012), levels[li] + 0.015 + bh / 2, z + thick / 2, shelf);
      b.rotation.x = rr(-0.015, 0.015);
      z += thick + 0.002;
      if (z - zs > (ze - zs) * cap && li === 2) break;
    }
    if (li === 2) { // a tiny plant and bookend at the end of that shelf
      cyl(0.05, 0.04, 0.07, matPot, -2.87, levels[li] + 0.05, 0.95, shelf);
      const s = sph(0.05, matLeaf, -2.87, levels[li] + 0.13, 0.95, shelf);
      s.scale.y = 1.4;
      box(0.02, 0.12, 0.05, matMetal, -2.87, levels[li] + 0.075, 0.7, shelf);
    }
  });
}

/* ------------------------------------------------------------------ */
/* A potted plant in the north-west corner                             */
/* ------------------------------------------------------------------ */
{
  const g = new THREE.Group();
  g.position.set(-2.42, 0, -1.82);
  scene.add(g);
  cyl(0.14, 0.11, 0.26, matPot, 0, 0.13, 0, g);
  cyl(0.12, 0.12, 0.02, new THREE.MeshStandardMaterial({ color: 0x2c1d10, roughness: 1 }), 0, 0.255, 0, g);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a5a2e, roughness: 0.9 });
  for (let i = 0; i < 7; i++) {
    const a = rr(0, Math.PI * 2), tilt = rr(0.5, 1.1), len = rr(0.3, 0.55);
    const stem = cyl(0.008, 0.011, len, stemMat, 0, 0.26 + len / 2, 0, g, 6);
    stem.rotation.set(Math.sin(a) * tilt, 0, Math.cos(a) * tilt);
    const leaf = sph(rr(0.07, 0.12), matLeaf,
      Math.sin(a) * tilt * len * 0.9, 0.26 + len * (0.9 + 0.12), Math.cos(a) * tilt * len * 0.9, g);
    leaf.scale.set(1.4, 0.45, 1);
    leaf.rotation.y = -a;
  }
}

/* ------------------------------------------------------------------ */
/* Pictures on the walls                                               */
/* ------------------------------------------------------------------ */
function wallPicture(w, h, x, y, z, rotY, parent = scene) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: artTexture(), roughness: 0.9 }));
  art.position.z = 0.012;
  g.add(art);
  const fr = box(w + 0.08, h + 0.08, 0.03, matWalnut, 0, 0, -0.005, g, true, false);
  fr.receiveShadow = false;
}
wallPicture(0.42, 0.32, 0.35, 1.62, 2.24, Math.PI);          // south wall
wallPicture(0.34, 0.42, 1.25, 1.55, 2.24, Math.PI);
wallPicture(0.4, 0.3, -1.55, 1.55, -2.24, 0);               // north wall
wallPicture(0.34, 0.42, 1.5, 1.6, -2.24, 0);

/* wall clock on the south wall, east of the door */
{
  const g = new THREE.Group();
  g.position.set(2.2, 2.0, 2.24);
  g.rotation.y = Math.PI;
  scene.add(g);
  cyl(0.16, 0.16, 0.05, matWalnut, 0, 0, 0, g, 24).rotation.x = Math.PI / 2;
  cyl(0.13, 0.13, 0.052, matCream, 0, 0, -0.002, g, 24).rotation.x = Math.PI / 2;
  const hand = box(0.008, 0.1, 0.006, matDark, 0, 0.035, -0.03, g, false);
  const hand2 = box(0.008, 0.07, 0.006, matDark, 0, 0.025, -0.03, g, false);
  hand.rotation.z = 0.8; hand2.rotation.z = -2.2;
}

/* ------------------------------------------------------------------ */
/* Outside: night sky, moon and stars (visible through the window)      */
/* ------------------------------------------------------------------ */
{
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(34, 22),
    new THREE.MeshBasicMaterial({ color: 0x101827 })
  );
  sky.position.set(0, 4, -10.5);
  scene.add(sky);
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32),
    new THREE.MeshBasicMaterial({ color: 0xf3edda }));
  moon.position.set(2.6, 2.6, -10.3);
  scene.add(moon);
  const halo = new THREE.Mesh(new THREE.CircleGeometry(1.7, 32),
    new THREE.MeshBasicMaterial({ color: 0xbdc8dd, transparent: true, opacity: 0.14 }));
  halo.position.set(2.6, 2.6, -10.31);
  scene.add(halo);
  const starPos = [];
  for (let i = 0; i < 260; i++) starPos.push(rr(-16, 16), rr(0.5, 11), -10.4);
  const stars = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
    new THREE.PointsMaterial({ color: 0xcfd8e8, size: 0.05, transparent: true, opacity: 0.8 })
  );
  scene.add(stars);
}

/* ------------------------------------------------------------------ */
/* Dust motes drifting in the lamplight                                */
/* ------------------------------------------------------------------ */
let motes;
{
  const n = 60, pos = new Float32Array(n * 3), seeds = [];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = rr(0.8, 2.7);
    pos[i * 3 + 1] = rr(0.1, 2.0);
    pos[i * 3 + 2] = rr(-1.9, 1.7);
    seeds.push(rr(0, 20));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  motes = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xffe6b8, size: 0.013, transparent: true, opacity: 0.22,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  motes.userData.seeds = seeds;
  scene.add(motes);
}

/* ------------------------------------------------------------------ */
/* Lighting                                                            */
/* ------------------------------------------------------------------ */
scene.add(new THREE.HemisphereLight(0x4a5468, 0x2a1f14, 0.5));
scene.add(new THREE.AmbientLight(0xffe2c0, 0.16));

/* moonlight falling through the window */
const moonLight = new THREE.DirectionalLight(0xbcd2f5, 1.1);
moonLight.position.set(2.6, 3.5, -7);
moonLight.target.position.set(-0.6, 0, 0.6);
scene.add(moonLight, moonLight.target);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
moonLight.shadow.camera.left = -4; moonLight.shadow.camera.right = 4;
moonLight.shadow.camera.top = 4; moonLight.shadow.camera.bottom = -4;
moonLight.shadow.camera.near = 1; moonLight.shadow.camera.far = 16;
moonLight.shadow.bias = -0.0006;
moonLight.shadow.normalBias = 0.02;

/* faint warm fill high in the room */
const fill = new THREE.PointLight(0xffd9b0, 2.0, 9, 2);
fill.position.set(-0.5, 2.4, 0.3);
scene.add(fill);

/* ------------------------------------------------------------------ */
/* Animation                                                           */
/* ------------------------------------------------------------------ */
const clock = new THREE.Clock();
function flicker(t, s = 1) {
  return 0.72
    + 0.18 * Math.sin(t * 9.3 * s)
    + 0.10 * Math.sin(t * 23.7 * s + 1.7)
    + 0.07 * Math.sin(t * 41.1 * s + 4.2);
}

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  fireLight.intensity = 13 + 5 * flicker(t);
  emberMat.emissiveIntensity = 0.9 + 0.5 * flicker(t, 1.3);
  for (const f of flames) {
    const u = f.userData;
    const k = flicker(t + u.phase, u.speed / 9);
    f.scale.set(0.8 + 0.35 * k, u.base * (0.75 + 0.45 * k), 0.8 + 0.35 * k);
    f.material.opacity = 0.55 + 0.3 * k;
    f.position.y = 0.3 + 0.03 * Math.sin(t * u.speed + u.phase);
  }

  const pos = motes.geometry.attributes.position;
  const seeds = motes.userData.seeds;
  for (let i = 0; i < seeds.length; i++) {
    pos.array[i * 3 + 1] += 0.0012;
    pos.array[i * 3] += Math.sin(t * 0.4 + seeds[i]) * 0.0008;
    pos.array[i * 3 + 2] += Math.cos(t * 0.3 + seeds[i]) * 0.0008;
    if (pos.array[i * 3 + 1] > 2.35) pos.array[i * 3 + 1] = 0.1;
  }
  pos.needsUpdate = true;

  controls.update();
  renderer.render(scene, activeCamera);
}
animate();
