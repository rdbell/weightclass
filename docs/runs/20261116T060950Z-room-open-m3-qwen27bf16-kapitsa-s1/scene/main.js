import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* =========================================================================
   The Reading Room
   North = -z, East = +x, y up, origin at floor centre.
   Room: 6 m (x: -3..3) x 4.5 m (z: -2.25..2.25), ceiling 2.7 m.
   ========================================================================= */

// ---------- seeded randomness (deterministic across loads) ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xC0FFEE);
const range = (a, b) => a + rand() * (b - a);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------- layout constants (metres) ----------
const ROOM = { x0: -3, x1: 3, z0: -2.25, z1: 2.25, h: 2.7, wall: 0.1 };
// door: south wall, 0.9 wide, centre 1.2 m from west wall -> x -2.25..-1.35, hinge at x=-2.25
const DOOR = { x0: -2.25, x1: -1.35, h: 2.05, open: THREE.MathUtils.degToRad(75) };
// window: north wall, 1.6 wide centred, sill 0.9, head 2.1
const WIN = { x0: -0.8, x1: 0.8, y0: 0.9, y1: 2.1 };
// fireplace: east wall, firebox 1 m wide centred (z -0.5..0.5)
const FIRE = { z0: -0.5, z1: 0.5, y0: 0.07, y1: 0.78, front: 2.86 };
// sofa: back 2.5 m from east wall -> back face x=0.5, depth 0.9 -> front x=1.4
const SOFA = { x0: 0.5, x1: 1.4, z0: -1.05, z1: 1.05 };
// coffee table between sofa and hearth, >=0.45 m walkway each side
const TABLE = { x0: 1.85, x1: 2.35, z0: -0.6, z1: 0.6, h: 0.4 };
// armchair in NE corner, angled 45 deg toward the fireplace (faces SE)
const CHAIR = { x: 2.0, z: -1.5 };
// bookshelf on west wall, floor to ceiling, stops short of the door swing (z=1.35)
const SHELF = { x0: -3.0, x1: -2.65, z0: -2.25, z1: 1.35 };
// rug centred under the table, reaching the sofa's front legs
const RUG = { x0: 1.34, x1: 2.86, z0: -1.1, z1: 1.1 };
const LAMP = { x: 1.42, z: -1.88 };
const DOOR_POS = new THREE.Vector3(-1.8, 1.6, 2.02);   // just inside the door, eye height
const DOOR_TARGET = new THREE.Vector3(0.0, 1.32, 0.3); // looking north-east

// ---------- renderer / scene ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0f14);

// ---------- cameras ----------
const persp = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 60);
const ortho = new THREE.OrthographicCamera(-3.5, 3.5, 2.8, -2.8, 0.1, 60);
ortho.position.set(0, 12, 0.0001);

function fitOrtho() {
  const a = innerWidth / innerHeight;
  const halfW = 3.55, halfH = 2.85; // frame all four walls with margin
  if (a >= halfW / halfH) {
    ortho.top = halfH; ortho.bottom = -halfH;
    ortho.right = halfH * a; ortho.left = -halfH * a;
  } else {
    ortho.left = -halfW; ortho.right = halfW;
    ortho.top = halfW / a; ortho.bottom = -halfW / a;
  }
  ortho.updateProjectionMatrix();
}
fitOrtho();

const controlsDoor = new OrbitControls(persp, renderer.domElement);
controlsDoor.target.copy(DOOR_TARGET);
controlsDoor.enableDamping = true;
controlsDoor.dampingFactor = 0.08;
controlsDoor.minDistance = 0.2;
controlsDoor.maxDistance = 9;
controlsDoor.maxPolarAngle = Math.PI * 0.55;

const controlsTop = new OrbitControls(ortho, renderer.domElement);
controlsTop.target.set(0, 0, 0);
controlsTop.enableDamping = true;
controlsTop.dampingFactor = 0.08;
controlsTop.minZoom = 0.55;
controlsTop.maxZoom = 5;
controlsTop.maxPolarAngle = Math.PI * 0.49;
controlsTop.enabled = false;

// ---------- canvas texture helpers ----------
function canvasTexture(w, h, draw, { srgb = true, repeat = null } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

function makeFloorTexture() {
  return canvasTexture(1200, 900, (g, w, h) => {
    g.fillStyle = '#6e4a2c'; g.fillRect(0, 0, w, h);
    const rows = 28, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = -((r * 173) % 420);
      while (x < w) {
        const len = 260 + rand() * 320;
        const hue = 22 + rand() * 10, sat = 40 + rand() * 16, lig = 27 + rand() * 15;
        g.fillStyle = `hsl(${hue},${sat}%,${lig}%)`;
        g.fillRect(x, r * rh, len, rh);
        g.strokeStyle = `hsla(${hue - 5},${sat}%,${lig - 11}%,0.4)`;
        g.lineWidth = 1;
        for (let k = 0; k < 4; k++) {
          const gy = r * rh + rand() * rh;
          g.beginPath(); g.moveTo(x + 4, gy);
          g.bezierCurveTo(x + len * 0.3, gy + (rand() - 0.5) * 5,
            x + len * 0.6, gy + (rand() - 0.5) * 5, x + len - 4, gy + (rand() - 0.5) * 4);
          g.stroke();
        }
        g.fillStyle = 'rgba(28,16,9,0.85)';
        g.fillRect(x + len - 2, r * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(28,16,9,0.75)';
      g.fillRect(0, r * rh, w, 1.5);
    }
  });
}

function makePlasterTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#e3d6bf'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 205 + rand() * 32;
      g.fillStyle = `rgba(${v},${v - 12},${v - 34},0.22)`;
      g.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
    }
  }, { repeat: [2, 1] });
}

function makeRugTexture() {
  return canvasTexture(512, 740, (g, w, h) => {
    g.fillStyle = '#8a4a34'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3500; i++) {
      g.fillStyle = `rgba(${rand() < 0.5 ? 255 : 30},${rand() < 0.5 ? 210 : 90},130,0.04)`;
      g.fillRect(rand() * w, rand() * h, 2, 2);
    }
    g.strokeStyle = '#e0c8a0'; g.lineWidth = 10; g.strokeRect(26, 26, w - 52, h - 52);
    g.strokeStyle = '#3e5c50'; g.lineWidth = 4;  g.strokeRect(48, 48, w - 96, h - 96);
    g.strokeStyle = 'rgba(224,200,160,0.4)'; g.lineWidth = 3;
    const step = 62;
    for (let x = -h; x < w + h; x += step) {
      g.beginPath(); g.moveTo(x, 60); g.lineTo(x + h - 120, h - 60); g.stroke();
      g.beginPath(); g.moveTo(x, h - 60); g.lineTo(x + h - 120, 60); g.stroke();
    }
    g.save(); g.translate(w / 2, h / 2); g.rotate(Math.PI / 4);
    g.fillStyle = 'rgba(62,92,80,0.9)'; g.fillRect(-72, -72, 144, 144);
    g.strokeStyle = '#e0c8a0'; g.lineWidth = 5; g.strokeRect(-72, -72, 144, 144);
    g.fillStyle = 'rgba(224,200,160,0.95)'; g.fillRect(-34, -34, 68, 68);
    g.restore();
  });
}

function makeSkyTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    // the window shows roughly canvas rows 0.35h..0.65h, so place the
    // dusk horizon and moon inside that band
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0e1526'); grad.addColorStop(0.3, '#1d2742');
    grad.addColorStop(0.44, '#3c3a58'); grad.addColorStop(0.56, '#7a5450');
    grad.addColorStop(0.64, '#c08050'); grad.addColorStop(0.72, '#5a4434');
    grad.addColorStop(1, '#241a14');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const y = h * (0.18 + rand() * 0.45);
      g.fillStyle = `rgba(255,255,255,${0.2 + rand() * 0.6})`;
      const s = rand() < 0.9 ? 1 : 2;
      g.fillRect(rand() * w, y, s, s);
    }
    const mx = w * 0.42, my = h * 0.4;
    const glow = g.createRadialGradient(mx, my, 2, mx, my, 44);
    glow.addColorStop(0, 'rgba(255,245,220,0.9)');
    glow.addColorStop(0.3, 'rgba(255,240,210,0.3)');
    glow.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(mx, my, 44, 0, 7); g.fill();
    g.fillStyle = '#f5ecd8'; g.beginPath(); g.arc(mx, my, 13, 0, 7); g.fill();
    g.fillStyle = 'rgba(130,110,130,0.14)';
    for (let i = 0; i < 8; i++) {
      g.beginPath();
      g.ellipse(rand() * w, h * (0.5 + rand() * 0.25), 60 + rand() * 90, 5 + rand() * 8, 0, 0, 7);
      g.fill();
    }
  });
}

function makeGlowTexture() {
  return canvasTexture(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    r.addColorStop(0, 'rgba(255,175,85,1)');
    r.addColorStop(0.3, 'rgba(255,120,40,0.55)');
    r.addColorStop(1, 'rgba(255,80,20,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
}

function makeContactTexture() {
  return canvasTexture(128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    r.addColorStop(0, 'rgba(0,0,0,0.55)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  }, { srgb: false });
}

function makeArtTexture(variant) {
  const palettes = [
    ['#22334a', '#c87a4a', '#e8c88a'],
    ['#33263a', '#8a5a6a', '#d8a878'],
    ['#22331f', '#5a7a4a', '#c8b878'],
  ];
  const cols = palettes[variant % palettes.length];
  return canvasTexture(256, 320, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, cols[0]); grad.addColorStop(0.62, cols[1]); grad.addColorStop(1, cols[2]);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,240,210,0.9)';
    g.beginPath(); g.arc(w * range(0.3, 0.7), h * range(0.22, 0.4), range(16, 26), 0, 7); g.fill();
    g.fillStyle = 'rgba(18,14,18,0.88)';
    g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 12) {
      g.lineTo(x, h * 0.74 + Math.sin(x * 0.02 + variant * 2.1) * 15 + (rand() - 0.5) * 5);
    }
    g.lineTo(w, h); g.fill();
  });
}

function makeMirrorTexture() {
  return canvasTexture(256, 320, (g, w, h) => {
    // a dim, warm "reflection" of the room, brightest near the fire
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#6b5c48'); grad.addColorStop(0.55, '#574836'); grad.addColorStop(1, '#3c3122');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    const r = g.createRadialGradient(w * 0.4, h * 0.62, 6, w * 0.4, h * 0.62, 130);
    r.addColorStop(0, 'rgba(255,196,120,0.9)'); r.addColorStop(0.4, 'rgba(255,170,90,0.35)');
    r.addColorStop(1, 'rgba(255,170,90,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
    const r2 = g.createRadialGradient(w * 0.75, h * 0.3, 3, w * 0.75, h * 0.3, 80);
    r2.addColorStop(0, 'rgba(150,180,215,0.4)'); r2.addColorStop(1, 'rgba(150,180,215,0)');
    g.fillStyle = r2; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.4, 0); g.lineTo(0, h * 0.5); g.fill();
  });
}

function makeClockTexture() {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#e8dcc8'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
    g.strokeStyle = '#3a2f24'; g.lineWidth = 4; g.stroke();
    g.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      g.beginPath();
      g.moveTo(64 + Math.cos(a) * 49, 64 + Math.sin(a) * 49);
      g.lineTo(64 + Math.cos(a) * 55, 64 + Math.sin(a) * 55);
      g.stroke();
    }
    const hour = -Math.PI / 2 + (10 + 10 / 60) / 12 * 2 * Math.PI;
    const min = -Math.PI / 2 + (10 / 60) * 2 * Math.PI;
    g.lineWidth = 5; g.beginPath(); g.moveTo(64, 64);
    g.lineTo(64 + Math.cos(hour) * 27, 64 + Math.sin(hour) * 27); g.stroke();
    g.lineWidth = 3; g.beginPath(); g.moveTo(64, 64);
    g.lineTo(64 + Math.cos(min) * 42, 64 + Math.sin(min) * 42); g.stroke();
    g.fillStyle = '#3a2f24'; g.beginPath(); g.arc(64, 64, 4, 0, 7); g.fill();
  });
}

function makeFabricBump() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      const v = 100 + rand() * 70;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(rand() * w, rand() * h, 1, 1);
    }
  }, { srgb: false, repeat: [3, 3] });
}

function makeWeaveTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#a07848'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 10) {
      g.fillStyle = 'rgba(70,45,22,0.5)'; g.fillRect(0, y, w, 3);
      for (let x = (y / 10) % 2 === 0 ? 0 : 8; x < w; x += 16) {
        g.fillStyle = 'rgba(220,180,120,0.35)'; g.fillRect(x, y + 3, 8, 7);
      }
    }
  }, { repeat: [3, 2] });
}

// ---------- materials ----------
const fabricBump = makeFabricBump();
const M = {
  floor: new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.55, metalness: 0.04 }),
  wall: new THREE.MeshStandardMaterial({ map: makePlasterTexture(), color: 0xe8dcc6, roughness: 0.95 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xefe6d6, roughness: 0.95 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xd8ccb4, roughness: 0.7 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x4a3527, roughness: 0.55 }),
  midWood: new THREE.MeshStandardMaterial({ color: 0x6e4e33, roughness: 0.6 }),
  sofa: new THREE.MeshStandardMaterial({ color: 0xba614a, roughness: 0.95, bumpMap: fabricBump, bumpScale: 0.4 }),
  chair: new THREE.MeshStandardMaterial({ color: 0x4f6b58, roughness: 0.95, bumpMap: fabricBump, bumpScale: 0.4 }),
  pillowA: new THREE.MeshStandardMaterial({ color: 0xc9973f, roughness: 0.95, bumpMap: fabricBump, bumpScale: 0.4 }),
  pillowB: new THREE.MeshStandardMaterial({ color: 0x5d7d8a, roughness: 0.95, bumpMap: fabricBump, bumpScale: 0.4 }),
  blanket: new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 1, bumpMap: fabricBump, bumpScale: 0.5 }),
  rug: new THREE.MeshStandardMaterial({ map: makeRugTexture(), roughness: 1 }),
  stone: new THREE.MeshStandardMaterial({ color: 0x5a524c, roughness: 0.9 }),
  firebox: new THREE.MeshStandardMaterial({ color: 0x1c1714, roughness: 1 }),
  log: new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 1 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xaac4d8, transparent: true, opacity: 0.13, roughness: 0.08, metalness: 0.1 }),
  curtain: new THREE.MeshStandardMaterial({ color: 0x9a6a50, roughness: 1, side: THREE.DoubleSide, bumpMap: fabricBump, bumpScale: 0.4 }),
  brass: new THREE.MeshStandardMaterial({ color: 0x8a6a3a, metalness: 0.85, roughness: 0.35 }),
  lampShade: new THREE.MeshStandardMaterial({ color: 0xe8c9a0, emissive: 0xff9a3d, emissiveIntensity: 0.5, roughness: 0.9, side: THREE.DoubleSide }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x3e5c3a, roughness: 0.8 }),
  pot: new THREE.MeshStandardMaterial({ color: 0x9c5a3c, roughness: 0.85 }),
  cat: new THREE.MeshStandardMaterial({ color: 0x8a7663, roughness: 0.9 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0x4a5a6e, roughness: 0.5 }),
  mirror: new THREE.MeshBasicMaterial({ map: makeMirrorTexture() }),
  sky: new THREE.MeshBasicMaterial({ map: makeSkyTexture() }),
  tree: new THREE.MeshBasicMaterial({ color: 0x0d1420 }),
  outside: new THREE.MeshBasicMaterial({ color: 0x131a14 }),
};

// ---------- mesh helpers ----------
function box(w, h, d, x, y, z, mat, parent = scene, { ry = 0, cast = true, recv = true } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = cast;
  m.receiveShadow = recv;
  parent.add(m);
  return m;
}
function cyl(rt, rb, h, x, y, z, mat, parent = scene, { seg = 20, cast = true, recv = true } = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = recv;
  parent.add(m);
  return m;
}
const contactTex = makeContactTexture();
function contactShadow(x, z, r, opacity = 0.3) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 24),
    new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.005, z);
  m.renderOrder = 1;
  scene.add(m);
}

// =========================================================================
// ROOM SHELL
// =========================================================================
// floor
const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5), M.floor);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ceiling (hidden in top view)
const ceilingGroup = new THREE.Group();
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5), M.ceiling);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ROOM.h;
ceiling.receiveShadow = true;
ceilingGroup.add(ceiling);
scene.add(ceilingGroup);

// walls (thickness 0.1, outside the room bounds)
const W = ROOM.wall;
// north wall (window opening x -0.8..0.8, y 0.9..2.1)
box(2.2, 2.7, W, -1.9, 1.35, -2.3, M.wall);
box(2.2, 2.7, W, 1.9, 1.35, -2.3, M.wall);
box(1.6, 0.9, W, 0, 0.45, -2.3, M.wall);
box(1.6, 0.6, W, 0, 2.4, -2.3, M.wall);
// south wall (door opening x -2.25..-1.35, h 2.05)
box(0.75, 2.7, W, -2.625, 1.35, 2.3, M.wall);
box(4.35, 2.7, W, 0.825, 1.35, 2.3, M.wall);
box(0.9, 0.65, W, -1.8, 2.375, 2.3, M.wall);
// west wall
box(W, 2.7, 4.5, -3.05, 1.35, 0, M.wall);
// east wall (firebox opening z -0.5..0.5, y 0.07..0.8)
box(W, 2.7, 1.73, 2.95, 1.35, -1.385, M.wall);
box(W, 2.7, 1.73, 2.95, 1.35, 1.385, M.wall);
box(W, 1.9, 1.04, 2.95, 1.75, 0, M.wall);

// baseboards (painted trim, 8 cm)
const bb = 0.08;
box(6, bb, 0.02, 0, bb / 2, -2.24, M.trim, scene, { cast: false });
box(0.75, bb, 0.02, -2.625, bb / 2, 2.24, M.trim, scene, { cast: false });
box(4.35, bb, 0.02, 0.825, bb / 2, 2.24, M.trim, scene, { cast: false });
box(0.02, bb, 0.87, 2.94, bb / 2, -1.815, M.trim, scene, { cast: false });
box(0.02, bb, 0.87, 2.94, bb / 2, 1.815, M.trim, scene, { cast: false });
box(0.02, bb, 0.87, -2.99, bb / 2, 1.815, M.trim, scene, { cast: false });

// ---------- door (hinged west, opens into the room, 75 deg open) ----------
box(0.07, 2.1, 0.14, -2.285, 1.05, 2.3, M.trim);
box(0.07, 2.1, 0.14, -1.315, 1.05, 2.3, M.trim);
box(1.14, 0.07, 0.14, -1.8, 2.085, 2.3, M.trim);
const doorGroup = new THREE.Group();
doorGroup.position.set(DOOR.x0, 0, 2.25);
doorGroup.rotation.y = DOOR.open;
const leaf = box(0.9, 2.05, 0.045, 0.45, 1.025, -0.0225, M.trim, doorGroup);
box(0.62, 0.72, 0.012, 0.45, 1.5, -0.052, M.trim, doorGroup, { cast: false });
box(0.62, 0.6, 0.012, 0.45, 0.55, -0.052, M.trim, doorGroup, { cast: false });
const handle = cyl(0.012, 0.012, 0.09, 0.8, 1.02, -0.075, M.brass, doorGroup, { seg: 10 });
handle.rotation.x = Math.PI / 2;
scene.add(doorGroup);
// door swing arc, kept clear
const swing = new THREE.Mesh(
  new THREE.RingGeometry(0.88, 0.9, 40, 1, 0, Math.PI / 2),
  new THREE.MeshBasicMaterial({ color: 0x2a1c10, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
swing.rotation.x = -Math.PI / 2;
swing.position.set(DOOR.x0, 0.006, 2.25);
scene.add(swing);

// ---------- window ----------
const winZ = -2.25;
box(1.72, 0.07, 0.09, 0, WIN.y0 + 0.005, winZ - 0.03, M.trim);            // sill
box(1.72, 0.06, 0.09, 0, WIN.y1 - 0.03, winZ - 0.03, M.trim);            // head
box(0.07, 1.2, 0.09, WIN.x0 - 0.03, 1.5, winZ - 0.03, M.trim);           // jambs
box(0.07, 1.2, 0.09, WIN.x1 + 0.03, 1.5, winZ - 0.03, M.trim);
box(0.035, 1.2, 0.03, 0, 1.5, winZ - 0.045, M.trim);                      // muntins
box(1.6, 0.035, 0.03, 0, 1.5, winZ - 0.045, M.trim);
const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), M.glass);
glass.position.set(0, 1.5, winZ - 0.055);
scene.add(glass);
// sill board protruding into the room
box(1.9, 0.035, 0.09, 0, 0.89, -2.205, M.trim);

// curtains (wavy planes flanking the window)
function curtain(x) {
  const geo = new THREE.PlaneGeometry(0.52, 1.55, 40, 6);
  const pos = geo.attributes.position;
  const phase = x < 0 ? 0.8 : 2.2;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i);
    const gather = 1 - 0.25 * (py / 0.775 + 1) / 2; // slightly fuller at the bottom
    pos.setZ(i, (0.035 + 0.03 * gather) * Math.sin(px * 26 + phase));
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, M.curtain);
  m.position.set(x, 1.52, -2.18);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
}
curtain(-1.06);
curtain(1.06);
const rod = cyl(0.012, 0.012, 2.7, 0, 2.34, -2.17, M.brass, scene, { seg: 10 });
rod.rotation.z = Math.PI / 2;
cyl(0.025, 0.025, 0.03, -1.36, 2.34, -2.17, M.brass, scene, { seg: 10 }).rotation.z = Math.PI / 2;
cyl(0.025, 0.025, 0.03, 1.36, 2.34, -2.17, M.brass, scene, { seg: 10 }).rotation.z = Math.PI / 2;

// outside: dusk sky, trees, ground
const sky = new THREE.Mesh(new THREE.PlaneGeometry(13, 7.5), M.sky);
sky.position.set(0, 1.7, -3.6);
scene.add(sky);
const groundOut = new THREE.Mesh(new THREE.PlaneGeometry(13, 3), M.outside);
groundOut.rotation.x = -Math.PI / 2;
groundOut.position.set(0, -0.02, -3.9);
scene.add(groundOut);
[[-2.7, 0.55, 1.9], [-1.5, 0.42, 1.5], [1.7, 0.6, 2.2], [2.9, 0.45, 1.6]].forEach(([x, r, h]) => {
  const t = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), M.tree);
  t.position.set(x, h / 2 - 0.1, -3.45);
  scene.add(t);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 6), M.tree);
  trunk.position.set(x, 0.05, -3.45);
  scene.add(trunk);
});

// =========================================================================
// FIREPLACE (east wall)
// =========================================================================
// hearth slab (rug edge x=2.86 meets it)
box(0.14, 0.07, 1.5, 2.93, 0.035, 0, M.stone);
// firebox shell (dark stone, recessed 10 cm)
box(0.04, 0.77, 1.04, 2.98, 0.435, 0, M.firebox);                    // back
box(0.1, 0.73, 0.02, 2.91, 0.435, -0.51, M.firebox);                 // north side
box(0.1, 0.73, 0.02, 2.91, 0.435, 0.51, M.firebox);                  // south side
box(0.1, 0.02, 1.04, 2.91, 0.79, 0, M.firebox);                      // top
// mantel
box(0.16, 0.07, 1.44, 2.92, 1.095, 0, M.darkWood);
// mirror above the mantel
box(0.045, 0.91, 0.78, 2.84, 1.78, 0, M.darkWood);
const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.83), M.mirror);
mirror.rotation.y = -Math.PI / 2;
mirror.position.set(2.816, 1.78, 0);
scene.add(mirror);
// mantel clock
box(0.07, 0.18, 0.15, 2.9, 1.22, 0.38, M.darkWood);
const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.055, 24),
  new THREE.MeshStandardMaterial({ map: makeClockTexture(), roughness: 0.6 }));
clockFace.rotation.y = -Math.PI / 2;
clockFace.position.set(2.863, 1.235, 0.38);
scene.add(clockFace);
// candlesticks
const candleFlames = [];
[[2.9, 1.13, -0.3], [2.9, 1.13, -0.12]].forEach(([x, y, z], i) => {
  cyl(0.014, 0.02, 0.1, x, y + 0.05, z, M.brass, scene, { seg: 10 });
  cyl(0.016, 0.016, 0.07, x, y + 0.135, z, new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 }), scene, { seg: 10 });
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.026, 8),
    new THREE.MeshBasicMaterial({ color: 0xffc45a }));
  flame.position.set(x, y + 0.19, z);
  flame.userData.phase = i * 1.7;
  scene.add(flame);
  candleFlames.push(flame);
});
// small vase on the mantel
{
  const pts = [];
  [[0.001, 0], [0.045, 0.005], [0.06, 0.04], [0.04, 0.09], [0.028, 0.12], [0.034, 0.15]]
    .forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
  const vase = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), M.ceramic);
  vase.position.set(2.9, 1.13, 0.02);
  vase.castShadow = true;
  scene.add(vase);
}

// ---------- the fire ----------
const fireGroup = new THREE.Group();
scene.add(fireGroup);
// logs
const log1 = cyl(0.034, 0.038, 0.34, 2.9, 0.115, 0, M.log, fireGroup, { seg: 8 });
log1.rotation.x = Math.PI / 2;
const log2 = cyl(0.03, 0.034, 0.3, 2.9, 0.15, 0.02, M.log, fireGroup, { seg: 8 });
log2.rotation.x = Math.PI / 2;
log2.rotation.y = 0.35;
const log3 = cyl(0.026, 0.03, 0.26, 2.9, 0.145, -0.05, M.log, fireGroup, { seg: 8 });
log3.rotation.x = Math.PI / 2;
log3.rotation.y = -0.5;
// embers
const emberMat = new THREE.MeshBasicMaterial({ color: 0xff6a1a });
[[-0.06, 0.09, 0.05], [0.04, 0.09, -0.06], [0.0, 0.095, 0.09]].forEach(([x, y, z]) => {
  const e = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), emberMat);
  e.position.set(2.9 + x, y, z);
  fireGroup.add(e);
});
// flames: crossed shader planes
const flameVert = `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const flameFrag = `
  uniform float uTime; uniform float uSeed;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed * 13.7) * 43758.5453123); }
  float noise(in vec2 p){
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p){ float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main(){
    vec2 uv = vUv;
    float t = uTime;
    float n  = fbm(vec2(uv.x * 3.0 + uSeed, uv.y * 2.0 - t * 2.1));
    float n2 = fbm(vec2(uv.x * 6.0 - uSeed, uv.y * 4.0 - t * 3.0));
    float cx = 0.5 + (n - 0.5) * 0.5 * uv.y + (n2 - 0.5) * 0.22 * uv.y;
    float halfW = mix(0.42, 0.015, uv.y * uv.y * 0.65 + uv.y * 0.35);
    float body = 1.0 - smoothstep(halfW * 0.3, halfW, abs(uv.x - cx));
    float tip = smoothstep(1.0, 0.55, uv.y);
    float base = smoothstep(0.0, 0.1, uv.y);
    float alpha = body * tip * base * (0.7 + 0.3 * n2);
    vec3 col = mix(vec3(1.0, 0.86, 0.4), vec3(1.0, 0.42, 0.08), smoothstep(0.0, 0.5, uv.y));
    col = mix(col, vec3(0.72, 0.14, 0.02), smoothstep(0.55, 1.0, uv.y));
    gl_FragColor = vec4(col * 1.9, alpha * 0.92);
  }`;
const flames = [];
function addFlame(x, y, z, w, h, ry, speed) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uSeed: { value: rand() * 10 } },
    vertexShader: flameVert, fragmentShader: flameFrag,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.userData.speed = speed;
  fireGroup.add(m);
  flames.push(m);
}
addFlame(2.9, 0.34, 0, 0.26, 0.5, Math.PI / 2, 1.0);
addFlame(2.9, 0.34, 0, 0.26, 0.5, 0, 1.15);
addFlame(2.9, 0.28, 0.13, 0.17, 0.36, Math.PI / 2, 1.3);
addFlame(2.9, 0.28, 0.13, 0.17, 0.36, 0, 1.2);
addFlame(2.9, 0.28, -0.13, 0.17, 0.36, Math.PI / 2, 1.25);
addFlame(2.9, 0.28, -0.13, 0.17, 0.36, 0, 1.1);
// glow sprite
const glow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.7,
}));
glow.position.set(2.78, 0.4, 0);
glow.scale.setScalar(0.55);
scene.add(glow);

// =========================================================================
// FURNITURE
// =========================================================================
// ---------- rug ----------
const rug = new THREE.Mesh(new THREE.PlaneGeometry(RUG.x1 - RUG.x0, RUG.z1 - RUG.z0), M.rug);
rug.rotation.x = -Math.PI / 2;
rug.position.set((RUG.x0 + RUG.x1) / 2, 0.012, 0);
rug.receiveShadow = true;
scene.add(rug);

// ---------- sofa (faces east, back at x=0.5) ----------
const sofa = new THREE.Group();
scene.add(sofa);
[[0.58, -0.95], [0.58, 0.95], [1.35, -0.95], [1.35, 0.95]].forEach(([x, z]) => {
  cyl(0.024, 0.028, 0.07, x, 0.035, z, M.darkWood, sofa, { seg: 10 });
});
box(0.9, 0.24, 2.1, 0.95, 0.18, 0, M.sofa, sofa);                       // base
box(0.24, 0.82, 2.1, 0.62, 0.47, 0, M.sofa, sofa);                      // back
box(0.9, 0.54, 0.22, 0.95, 0.33, -0.94, M.sofa, sofa);                  // arms
box(0.9, 0.54, 0.22, 0.95, 0.33, 0.94, M.sofa, sofa);
[-0.55, 0, 0.55].forEach((z) => {
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.17, 0.52, 3, 0.04), M.sofa);
  seat.position.set(0.99, 0.4, z);
  seat.castShadow = true; seat.receiveShadow = true;
  sofa.add(seat);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.36, 0.52, 3, 0.05), M.sofa);
  back.position.set(0.8, 0.62, z);
  back.rotation.z = 0.18;
  back.castShadow = true; back.receiveShadow = true;
  sofa.add(back);
});
// pillows
const pil1 = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.4, 0.4, 3, 0.05), M.pillowA);
pil1.position.set(0.82, 0.62, -0.66);
pil1.rotation.set(0, -0.12, 0.22);
pil1.castShadow = true;
sofa.add(pil1);
const pil2 = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.4, 0.4, 3, 0.05), M.pillowB);
pil2.position.set(0.82, 0.62, 0.68);
pil2.rotation.set(0, 0.15, 0.2);
pil2.castShadow = true;
sofa.add(pil2);
// throw blanket over the right arm
box(0.5, 0.03, 0.34, 1.16, 0.625, 0.94, M.blanket, sofa);
box(0.03, 0.3, 0.3, 1.38, 0.47, 0.94, M.blanket, sofa);
contactShadow(0.95, 0, 1.05, 0.28);

// ---------- coffee table ----------
const table = new THREE.Group();
scene.add(table);
box(0.5, 0.04, 1.2, 2.1, 0.38, 0, M.darkWood, table);                   // top
box(0.42, 0.03, 1.06, 2.1, 0.14, 0, M.midWood, table);                  // lower shelf
[[1.88, -0.56], [1.88, 0.56], [2.32, -0.56], [2.32, 0.56]].forEach(([x, z]) => {
  box(0.045, 0.36, 0.045, x, 0.18, z, M.darkWood, table);
});
// things on the table
const bookT1 = box(0.24, 0.03, 0.17, 2.0, 0.415, 0.28,
  new THREE.MeshStandardMaterial({ color: 0x7a3b2e, roughness: 0.8 }), table);
bookT1.rotation.y = 0.2;
const bookT2 = box(0.2, 0.026, 0.14, 2.01, 0.443, 0.27,
  new THREE.MeshStandardMaterial({ color: 0x3e5c50, roughness: 0.8 }), table);
bookT2.rotation.y = -0.12;
cyl(0.035, 0.032, 0.09, 2.22, 0.445, -0.28,
  new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 0.5 }), table, { seg: 14 });
const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.006, 6, 12),
  new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 0.5 }));
mugHandle.position.set(2.262, 0.445, -0.28);
mugHandle.rotation.y = Math.PI / 2;
table.add(mugHandle);
// little candle on the table
cyl(0.02, 0.02, 0.05, 1.95, 0.425, -0.32,
  new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.6 }), table, { seg: 10 });
const tableFlame = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.022, 8),
  new THREE.MeshBasicMaterial({ color: 0xffc45a }));
tableFlame.position.set(1.95, 0.465, -0.32);
table.add(tableFlame);
// tiny plant on the table
cyl(0.035, 0.028, 0.06, 1.94, 0.43, 0.36, M.pot, table, { seg: 12 });
for (let i = 0; i < 5; i++) {
  const lf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), M.leaf);
  lf.scale.set(0.5, 1.4, 0.8);
  const a = (i / 5) * Math.PI * 2;
  lf.position.set(1.94 + Math.cos(a) * 0.025, 0.49 + (i % 2) * 0.015, 0.36 + Math.sin(a) * 0.025);
  lf.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
  table.add(lf);
}

// ---------- armchair (NE corner, angled 45 deg toward the fireplace) ----------
const chair = new THREE.Group();
chair.position.set(CHAIR.x, 0, CHAIR.z);
chair.rotation.y = Math.PI / 4; // built facing +z; now faces SE
[[-0.3, -0.28], [-0.3, 0.28], [0.3, -0.28], [0.3, 0.28]].forEach(([x, z]) => {
  cyl(0.022, 0.026, 0.08, x, 0.04, z, M.darkWood, chair, { seg: 10 });
});
box(0.64, 0.2, 0.6, 0, 0.18, 0, M.chair, chair);                        // seat frame
const seatC = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.15, 0.54, 3, 0.045), M.chair);
seatC.position.set(0, 0.355, 0.02);
seatC.castShadow = true; seatC.receiveShadow = true;
chair.add(seatC);
const backC = box(0.64, 0.52, 0.14, 0, 0.52, -0.26, M.chair, chair);
backC.rotation.x = -0.1;
const backP = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.4, 0.13, 3, 0.05), M.chair);
backP.position.set(0, 0.5, -0.19);
backP.rotation.x = -0.12;
backP.castShadow = true;
chair.add(backP);
box(0.13, 0.26, 0.56, -0.3, 0.42, 0.02, M.chair, chair);                // arms
box(0.13, 0.26, 0.56, 0.3, 0.42, 0.02, M.chair, chair);
const chairPillow = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.3, 0.3, 3, 0.045), M.pillowA);
chairPillow.position.set(0.12, 0.52, -0.14);
chairPillow.rotation.set(-0.15, 0, 0.12);
chairPillow.castShadow = true;
chair.add(chairPillow);
// an open book on the seat
const openBook = box(0.16, 0.018, 0.22, -0.08, 0.445, 0.06,
  new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.9 }), chair);
openBook.rotation.y = 0.35;
scene.add(chair);
contactShadow(CHAIR.x, CHAIR.z, 0.55, 0.3);

// ---------- floor lamp (west side of the armchair) ----------
const lamp = new THREE.Group();
lamp.position.set(LAMP.x, 0, LAMP.z);
cyl(0.14, 0.15, 0.025, 0, 0.0125, 0, M.brass, lamp, { seg: 18 });
cyl(0.011, 0.011, 1.35, 0, 0.7, 0, M.brass, lamp, { seg: 10 });
const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.17, 0.24, 20, 1, true), M.lampShade);
shade.position.y = 1.44;
shade.castShadow = false;
lamp.add(shade);
const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10),
  new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
bulb.position.y = 1.4;
lamp.add(bulb);
scene.add(lamp);
contactShadow(LAMP.x, LAMP.z, 0.25, 0.35);

// ---------- bookshelf (west wall, floor to ceiling, clear of the door swing) ----------
const shelf = new THREE.Group();
scene.add(shelf);
box(0.02, 2.66, 3.52, -2.98, 1.35, -0.45, M.midWood, shelf);            // back
box(0.35, 2.7, 0.04, -2.825, 1.35, -2.23, M.midWood, shelf);            // side panels
box(0.35, 2.7, 0.04, -2.825, 1.35, 1.33, M.midWood, shelf);
box(0.35, 0.04, 3.6, -2.825, 2.68, -0.45, M.midWood, shelf);            // crown
const shelfTops = [0.055, 0.475, 0.895, 1.315, 1.735, 2.155];
shelfTops.forEach((y) => box(0.33, 0.035, 3.52, -2.845, y - 0.0175, -0.45, M.midWood, shelf));
// books (instanced)
const bookPalette = ['#7a3b2e', '#3e5c50', '#8a6d3b', '#5c4a6e', '#a8916c', '#6e3b3b',
  '#3b4a6e', '#7d7461', '#9c4f2e', '#4a6353', '#c2a878', '#5a3d5c', '#8a5a44', '#2f4a44'];
const bookData = [];
const compartments = [
  { y: 0.055, h: 0.385 }, { y: 0.475, h: 0.385 }, { y: 0.895, h: 0.385 },
  { y: 1.315, h: 0.385 }, { y: 1.735, h: 0.385 }, { y: 2.155, h: 0.505 },
];
compartments.forEach((c, ci) => {
  let z = -2.16;
  const zEnd = ci === 5 ? 0.2 : (ci === 3 ? 0.4 : 1.24);
  while (z < zEnd) {
    if (rand() < 0.09) { z += range(0.05, 0.12); continue; }
    const t = range(0.024, 0.056);
    const h = Math.min(range(0.19, 0.3), c.h - 0.045);
    const d = range(0.15, 0.2);
    bookData.push({ x: -2.855, y: c.y + h / 2, z: z + t / 2, sx: d, sy: h, sz: t, color: pick(bookPalette) });
    z += t + 0.003;
  }
});
const books = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ roughness: 0.85 }), bookData.length);
{
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const col = new THREE.Color();
  bookData.forEach((b, i) => {
    p.set(b.x, b.y, b.z); s.set(b.sx, b.sy, b.sz);
    m4.compose(p, q, s);
    books.setMatrixAt(i, m4);
    col.set(b.color);
    col.offsetHSL(0, 0, range(-0.03, 0.03));
    books.setColorAt(i, col);
  });
  books.instanceMatrix.needsUpdate = true;
  books.instanceColor.needsUpdate = true;
  books.castShadow = true;
  books.receiveShadow = true;
  shelf.add(books);
}
// shelf decorations
box(0.26, 0.18, 0.3, -2.85, 0.145, 0.95,
  new THREE.MeshStandardMaterial({ map: makeWeaveTexture(), roughness: 0.9 }), shelf); // storage box
{ // small vase, compartment 2
  const pts = [];
  [[0.001, 0], [0.05, 0.005], [0.065, 0.05], [0.045, 0.11], [0.03, 0.15], [0.038, 0.19]]
    .forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
  const v = new THREE.Mesh(new THREE.LatheGeometry(pts, 14), M.ceramic);
  v.position.set(-2.85, 0.895, -1.9);
  v.castShadow = true;
  shelf.add(v);
}
{ // horizontal stack + bowl, compartment 3
  box(0.22, 0.03, 0.16, -2.85, 1.33, -1.9,
    new THREE.MeshStandardMaterial({ color: 0x8a6d3b, roughness: 0.85 }), shelf);
  box(0.2, 0.028, 0.15, -2.85, 1.358, -1.9,
    new THREE.MeshStandardMaterial({ color: 0x6e3b3b, roughness: 0.85 }), shelf).rotation.y = 0.15;
  box(0.18, 0.026, 0.13, -2.85, 1.385, -1.9,
    new THREE.MeshStandardMaterial({ color: 0x3b4a6e, roughness: 0.85 }), shelf).rotation.y = -0.1;
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x6e4a3a, roughness: 0.6, side: THREE.DoubleSide }));
  bowl.scale.y = 0.65;
  bowl.position.set(-2.85, 1.315 + 0.0, 0.85);
  bowl.position.y = 1.315;
  bowl.castShadow = true;
  shelf.add(bowl);
}
{ // plant, compartment 4
  cyl(0.07, 0.055, 0.1, -2.85, 1.785, 1.0, M.pot, shelf, { seg: 12 });
  for (let i = 0; i < 6; i++) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M.leaf);
    lf.scale.set(0.5, 1.5, 0.8);
    const a = (i / 6) * Math.PI * 2;
    lf.position.set(-2.85 + Math.cos(a) * 0.04, 1.88 + (i % 3) * 0.02, 1.0 + Math.sin(a) * 0.04);
    lf.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
    shelf.add(lf);
  }
}
{ // top shelf: leaning photo frame + small plant
  const frame = box(0.02, 0.17, 0.13, -2.83, 2.245, 0.4, M.darkWood, shelf);
  frame.rotation.z = -0.12;
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.14),
    new THREE.MeshStandardMaterial({ map: makeArtTexture(1), roughness: 0.9 }));
  photo.position.set(-2.818, 2.245, 0.4);
  photo.rotation.y = -Math.PI / 2;
  photo.rotation.z = 0.12;
  shelf.add(photo);
  cyl(0.05, 0.04, 0.08, -2.85, 2.195, -1.6, M.pot, shelf, { seg: 12 });
  for (let i = 0; i < 5; i++) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), M.leaf);
    lf.scale.set(0.5, 1.5, 0.8);
    const a = (i / 5) * Math.PI * 2;
    lf.position.set(-2.85 + Math.cos(a) * 0.03, 2.27 + (i % 2) * 0.02, -1.6 + Math.sin(a) * 0.03);
    lf.rotation.set(Math.cos(a) * 0.6, 0, -Math.sin(a) * 0.6);
    shelf.add(lf);
  }
}

// ---------- potted plant, SE corner ----------
const plant = new THREE.Group();
plant.position.set(2.5, 0, 1.6);
cyl(0.17, 0.13, 0.3, 0, 0.15, 0, M.pot, plant, { seg: 16 });
cyl(0.15, 0.15, 0.02, 0, 0.29, 0,
  new THREE.MeshStandardMaterial({ color: 0x2a1d12, roughness: 1 }), plant, { seg: 16 });
cyl(0.015, 0.02, 0.5, 0, 0.5, 0,
  new THREE.MeshStandardMaterial({ color: 0x4a3a24, roughness: 1 }), plant, { seg: 8 });
for (let i = 0; i < 7; i++) {
  const a = (i / 7) * Math.PI * 2 + rand() * 0.5;
  const lf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), M.leaf);
  lf.scale.set(0.35, 1, 0.75);
  const hgt = 0.55 + (i % 3) * 0.16;
  lf.position.set(Math.cos(a) * 0.16, hgt, Math.sin(a) * 0.16);
  lf.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
  lf.castShadow = true;
  plant.add(lf);
}
scene.add(plant);
contactShadow(2.5, 1.6, 0.4, 0.3);

// ---------- sleeping cat on the rug ----------
const cat = new THREE.Group();
cat.position.set(1.65, 0.012, 0.85);
const catBody = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.065, 10, 20), M.cat);
catBody.rotation.x = Math.PI / 2;
catBody.scale.set(1, 1, 0.72);
catBody.position.y = 0.05;
catBody.castShadow = true;
cat.add(catBody);
const catHead = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), M.cat);
catHead.position.set(0.06, 0.06, 0.03);
catHead.castShadow = true;
cat.add(catHead);
[[-0.02, 0.075], [0.1, 0.075]].forEach(([x, y]) => {
  const ear = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.032, 6), M.cat);
  ear.position.set(x + 0.03, y, 0.03);
  cat.add(ear);
});
const catTail = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.016, 8, 20, 1.9), M.cat);
catTail.rotation.x = Math.PI / 2;
catTail.rotation.z = -0.6;
catTail.position.set(0.02, 0.035, 0.02);
cat.add(catTail);
scene.add(cat);

// ---------- wall art ----------
function artFrame(x, y, z, w, h, variant, ry) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  box(w + 0.06, h + 0.06, 0.03, 0, 0, 0, M.darkWood, g);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshStandardMaterial({ map: makeArtTexture(variant), roughness: 0.9 }));
  art.position.z = 0.017;
  g.add(art);
  scene.add(g);
}
artFrame(0.35, 1.62, 2.23, 0.5, 0.64, 0, Math.PI);      // south wall
artFrame(1.45, 1.55, 2.23, 0.44, 0.44, 2, Math.PI);
artFrame(-1.7, 1.55, -2.23, 0.58, 0.76, 1, 0);          // north wall, left of window
artFrame(1.7, 1.5, -2.23, 0.48, 0.48, 2, 0);

// ---------- pendant lamp over the coffee table ----------
const pendantGroup = new THREE.Group();
pendantGroup.position.set(2.1, 0, 0);
cyl(0.006, 0.006, 0.42, 0, 2.49, 0, M.brass, pendantGroup, { seg: 8, cast: false });
const pShade = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.17, 0.19, 22, 1, true),
  new THREE.MeshStandardMaterial({ color: 0x2e3a30, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }));
pShade.position.y = 2.24;
pShade.castShadow = true;
pendantGroup.add(pShade);
const pBulb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10),
  new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
pBulb.position.y = 2.16;
pendantGroup.add(pBulb);
ceilingGroup.add(pendantGroup); // hides with the ceiling in top view

// =========================================================================
// LIGHTING (cozy evening)
// =========================================================================
const hemi = new THREE.HemisphereLight(0x55506a, 0x2a1d14, 0.62);
scene.add(hemi);

// dusk light through the window (only enters through the opening)
const winLight = new THREE.SpotLight(0x8fb4d8, 95, 16, 0.5, 0.55, 2);
winLight.position.set(0, 2.8, -4.5);
winLight.target.position.set(0.3, 0, 1.2);
winLight.castShadow = true;
winLight.shadow.mapSize.set(1024, 1024);
winLight.shadow.bias = -0.0003;
winLight.shadow.normalBias = 0.02;
winLight.shadow.camera.near = 1;
winLight.shadow.camera.far = 16;
scene.add(winLight, winLight.target);

// firelight (flickering)
const fireLight = new THREE.PointLight(0xff8a3d, 12, 7, 2);
fireLight.position.set(2.7, 0.42, 0);
fireLight.castShadow = true;
fireLight.shadow.mapSize.set(512, 512);
fireLight.shadow.bias = -0.002;
fireLight.shadow.normalBias = 0.02;
scene.add(fireLight);

// floor lamp
const lampLight = new THREE.PointLight(0xffc98a, 7, 6, 2);
lampLight.position.set(LAMP.x, 1.42, LAMP.z);
lampLight.castShadow = true;
lampLight.shadow.mapSize.set(512, 512);
lampLight.shadow.bias = -0.002;
lampLight.shadow.normalBias = 0.02;
scene.add(lampLight);

// pendant (downward spot over the table)
const pendLight = new THREE.SpotLight(0xffd9a8, 18, 9, 0.95, 0.7, 2);
pendLight.position.set(2.1, 2.1, 0);
pendLight.target.position.set(2.1, 0, 0);
pendLight.castShadow = true;
pendLight.shadow.mapSize.set(1024, 1024);
pendLight.shadow.bias = -0.0003;
pendLight.shadow.normalBias = 0.02;
scene.add(pendLight, pendLight.target);

// neutral overhead light used only in the top view, so the layout reads evenly
const topLight = new THREE.DirectionalLight(0xfff2e0, 0);
topLight.position.set(0, 10, 0);
topLight.target.position.set(0, 0, 0);
scene.add(topLight, topLight.target);

// =========================================================================
// VIEWS
// =========================================================================
const params = new URLSearchParams(location.search);
let view = params.get('view') === 'top' ? 'top' : 'door';

function applyView(v) {
  view = v;
  const top = v === 'top';
  ceilingGroup.visible = !top;
  controlsDoor.enabled = !top;
  controlsTop.enabled = top;
  topLight.intensity = top ? 1.5 : 0;
  hemi.intensity = top ? 0.9 : 0.72;
  if (top) {
    ortho.position.set(0, 12, 0.0001);
    controlsTop.target.set(0, 0, 0);
    controlsTop.update();
  } else {
    persp.position.copy(DOOR_POS);
    controlsDoor.target.copy(DOOR_TARGET);
    controlsDoor.update();
  }
  document.querySelectorAll('.views button').forEach((b) =>
    b.classList.toggle('active', b.dataset.view === v));
}
document.querySelectorAll('.views button').forEach((b) =>
  b.addEventListener('click', () => applyView(b.dataset.view)));
applyView(view);

// ---------- resize ----------
function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  persp.aspect = innerWidth / innerHeight;
  persp.updateProjectionMatrix();
  fitOrtho();
}
addEventListener('resize', onResize);

// ---------- animation ----------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  // deterministic fire flicker
  const n = clamp01(0.5 + 0.26 * Math.sin(t * 6.1 + 1.3) + 0.17 * Math.sin(t * 10.7 + 4.1)
    + 0.11 * Math.sin(t * 16.3 + 2.2) + 0.06 * Math.sin(t * 23.7 + 0.7));
  fireLight.intensity = 8 + 7 * n;
  fireLight.position.x = 2.7 + 0.02 * Math.sin(t * 13.1);
  glow.material.opacity = 0.5 + 0.35 * n;
  glow.scale.setScalar(0.48 + 0.14 * n);
  for (const f of flames) f.material.uniforms.uTime.value = t * f.userData.speed;
  // candle flicker
  for (const c of candleFlames) c.scale.set(1, 1 + 0.18 * Math.sin(t * 9.3 + c.userData.phase), 1);
  tableFlame.scale.set(1, 1 + 0.15 * Math.sin(t * 8.1 + 2.0), 1);
  // cat breathing
  catBody.scale.y = 1 + 0.04 * Math.sin(t * 1.05);
  if (view === 'top') controlsTop.update(); else controlsDoor.update();
  renderer.render(scene, view === 'top' ? ortho : persp);
});
