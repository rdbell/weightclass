// The Reading Room — a cosy 6m × 4.5m room with fireplace, sofa, armchair,
// bookshelf, window and fire. North is −z, east is +x, y is up, origin = floor centre.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Seeded randomness (deterministic across loads)
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xC0FFEE ^ 20261112);
const R = {
  f: (a, b) => a + rand() * (b - a),
  i: (a, b) => Math.floor(a + rand() * (b - a + 1)),
  pick: (arr) => arr[Math.floor(rand() * arr.length)],
};

// ---------------------------------------------------------------------------
// Renderer / scene / cameras
// ---------------------------------------------------------------------------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0810);
scene.fog = new THREE.FogExp2(0x120d14, 0.045);

RectAreaLightUniformsLib.init();

// Room extents (metres)
const RX = 3, RZ = 2.25, RH = 2.7, WT = 0.15; // half-width, half-depth, height, wall thickness

const perspCam = new THREE.PerspectiveCamera(60, 1, 0.08, 40);
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
orthoCam.up.set(0, 0, -1); // north (−z) up in the top view

let activeCam = perspCam;
let activeControls = null;

const controlsDoor = new OrbitControls(perspCam, renderer.domElement);
const controlsTop = new OrbitControls(orthoCam, renderer.domElement);
for (const c of [controlsDoor, controlsTop]) {
  c.enableDamping = true;
  c.dampingFactor = 0.08;
  c.enablePan = true;
  c.panSpeed = 0.6;
  c.rotateSpeed = 0.55;
}
controlsDoor.minDistance = 0.15;
controlsDoor.maxDistance = 9;
controlsDoor.maxPolarAngle = 1.66;
controlsTop.minDistance = 2.5;
controlsTop.maxDistance = 26;
controlsTop.maxPolarAngle = 1.55;

// ---------------------------------------------------------------------------
// Canvas texture helpers
// ---------------------------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function toTexture(c, { srgb = true, repeat, wrapRepeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrapRepeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

// --- oak floor (one tile covers the whole floor; planks run east–west) ---
function floorTexture() {
  const [c, g] = makeCanvas(1024, 768);
  const rows = 12, ph = 768 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -R.f(0, 260);
    while (x < 1024) {
      const w = R.f(230, 430);
      g.fillStyle = `hsl(${R.f(25, 34)} ${R.f(30, 46)}% ${R.f(33, 46)}%)`;
      g.fillRect(x, r * ph, w, ph);
      g.lineWidth = 1;
      for (let i = 0; i < 8; i++) {
        const gy = r * ph + R.f(3, ph - 3);
        g.strokeStyle = `rgba(38, 20, 8, ${R.f(0.1, 0.3)})`;
        g.beginPath();
        g.moveTo(x + 2, gy);
        g.bezierCurveTo(x + w * 0.3, gy + R.f(-5, 5), x + w * 0.65, gy + R.f(-5, 5), x + w - 2, gy + R.f(-3, 3));
        g.stroke();
      }
      if (rand() < 0.16) { // knot
        const kx = x + R.f(0.2, 0.8) * w, ky = r * ph + R.f(0.3, 0.7) * ph;
        const gr = g.createRadialGradient(kx, ky, 1, kx, ky, R.f(4, 9));
        gr.addColorStop(0, 'rgba(30,16,6,0.55)');
        gr.addColorStop(1, 'rgba(30,16,6,0)');
        g.fillStyle = gr;
        g.beginPath(); g.ellipse(kx, ky, 10, 6, R.f(0, 3), 0, 7); g.fill();
      }
      g.fillStyle = 'rgba(18,9,4,0.6)';
      g.fillRect(x + w - 1.5, r * ph, 3, ph);
      x += w;
    }
    g.fillStyle = 'rgba(18,9,4,0.55)';
    g.fillRect(0, r * ph, 1024, 2);
  }
  const gr = g.createRadialGradient(512, 384, 100, 512, 384, 720);
  gr.addColorStop(0, 'rgba(255,220,160,0.05)');
  gr.addColorStop(1, 'rgba(0,0,0,0.22)');
  g.fillStyle = gr; g.fillRect(0, 0, 1024, 768);
  return toTexture(c);
}

// --- rug (burgundy field, cream borders, diamond lattice, medallion) ---
function rugTexture() {
  const [c, g] = makeCanvas(1024, 1408);
  g.fillStyle = '#7d3a42'; g.fillRect(0, 0, 1024, 1408);
  // weave noise
  for (let i = 0; i < 26000; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '0,0,0' : '255,235,210'},${R.f(0.015, 0.05)})`;
    g.fillRect(R.f(0, 1024), R.f(0, 1408), 2, 2);
  }
  // borders
  g.strokeStyle = '#e2cfab'; g.lineWidth = 26; g.strokeRect(46, 46, 1024 - 92, 1408 - 92);
  g.strokeStyle = '#3d1a20'; g.lineWidth = 8; g.strokeRect(96, 96, 1024 - 192, 1408 - 192);
  // diamond lattice
  g.strokeStyle = 'rgba(226,207,171,0.34)'; g.lineWidth = 5;
  const step = 128;
  for (let d = -1408; d < 1024 + 1408; d += step) {
    g.beginPath(); g.moveTo(d, 104); g.lineTo(d + 1408, 1408 - 104); g.stroke();
    g.beginPath(); g.moveTo(d, 104); g.lineTo(d - 1408, 1408 - 104); g.stroke();
  }
  g.save();
  g.beginPath(); g.rect(104, 104, 1024 - 208, 1408 - 208); g.clip();
  g.strokeStyle = 'rgba(226,207,171,0.34)'; g.lineWidth = 5;
  for (let d = -2432; d < 1024 + 2432; d += step) {
    g.beginPath(); g.moveTo(d, 104); g.lineTo(d + 1408, 1408 - 104); g.stroke();
    g.beginPath(); g.moveTo(d, 104); g.lineTo(d - 1408, 1408 - 104); g.stroke();
  }
  g.restore();
  // central medallion
  const cx = 512, cy = 704;
  g.save(); g.translate(cx, cy); g.rotate(Math.PI / 4);
  g.fillStyle = '#3d1a20'; g.fillRect(-150, -150, 300, 300);
  g.strokeStyle = '#e2cfab'; g.lineWidth = 12; g.strokeRect(-150, -150, 300, 300);
  g.strokeStyle = 'rgba(226,207,171,0.5)'; g.lineWidth = 5; g.strokeRect(-110, -110, 220, 220);
  g.rotate(-Math.PI / 4);
  g.fillStyle = '#c98a4b'; g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill();
  g.strokeStyle = '#e2cfab'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 58, 0, 7); g.stroke();
  g.restore();
  return toTexture(c);
}

// --- warm plaster (1 m tile) ---
function plasterTexture() {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#e3d2b6'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '120,95,60' : '255,244,220'},${R.f(0.02, 0.07)})`;
    g.fillRect(R.f(0, 512), R.f(0, 512), R.f(1, 3), R.f(1, 3));
  }
  for (let i = 0; i < 26; i++) { // faint blotches
    const gr = g.createRadialGradient(R.f(0, 512), R.f(0, 512), 2, R.f(0, 512), R.f(0, 512), R.f(30, 90));
    gr.addColorStop(0, `rgba(150,120,80,${R.f(0.02, 0.05)})`);
    gr.addColorStop(1, 'rgba(150,120,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  }
  return toTexture(c, { wrapRepeat: true });
}

// --- wainscot panel (1 m tile, dark wood) ---
function wainscotTexture() {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#54402d'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2200; i++) {
    g.strokeStyle = `rgba(30,18,8,${R.f(0.05, 0.16)})`;
    g.lineWidth = R.f(0.6, 1.8);
    const y = R.f(0, 512);
    g.beginPath(); g.moveTo(0, y);
    g.bezierCurveTo(170, y + R.f(-6, 6), 340, y + R.f(-6, 6), 512, y + R.f(-4, 4));
    g.stroke();
  }
  // raised panel with bevel
  g.fillStyle = 'rgba(20,10,4,0.8)'; g.fillRect(14, 14, 484, 484);
  g.fillStyle = '#5d4732'; g.fillRect(26, 26, 460, 460);
  g.strokeStyle = 'rgba(255,220,160,0.14)'; g.lineWidth = 4; g.strokeRect(30, 30, 452, 452);
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 3; g.strokeRect(480, 480, 20, 20);
  return toTexture(c, { wrapRepeat: true });
}

// --- warm stone for the fireplace breast (1 m tile) ---
function stoneTexture() {
  const [c, g] = makeCanvas(512, 512);
  g.fillStyle = '#6e6358'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 5200; i++) {
    const v = R.f(0.05, 0.16);
    g.fillStyle = `rgba(${rand() < 0.5 ? '30,24,20' : '215,195,170'},${v})`;
    g.fillRect(R.f(0, 512), R.f(0, 512), R.f(1, 4), R.f(1, 4));
  }
  g.strokeStyle = 'rgba(30,24,20,0.55)'; g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    let x = R.f(0, 512), y = R.f(0, 512);
    g.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += R.f(-90, 90); y += R.f(-90, 90); g.lineTo(x, y); }
    g.stroke();
  }
  return toTexture(c, { wrapRepeat: true });
}

// --- dusk sky seen through the window ---
function skyTexture() {
  const [c, g] = makeCanvas(1024, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#0a0e24');
  grad.addColorStop(0.42, '#1b2650');
  grad.addColorStop(0.68, '#3c3a68');
  grad.addColorStop(0.85, '#7a4a5e');
  grad.addColorStop(1, '#b56a45');
  g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
  // stars
  for (let i = 0; i < 170; i++) {
    const y = R.f(0, 330);
    g.fillStyle = `rgba(230,235,255,${R.f(0.15, 0.85) * (1 - y / 380)})`;
    const s = R.f(0.6, 2.1);
    g.fillRect(R.f(0, 1024), y, s, s);
  }
  // moon + halo
  const mx = 690, my = 150;
  const halo = g.createRadialGradient(mx, my, 8, mx, my, 120);
  halo.addColorStop(0, 'rgba(220,225,240,0.5)');
  halo.addColorStop(1, 'rgba(220,225,240,0)');
  g.fillStyle = halo; g.fillRect(mx - 130, my - 130, 260, 260);
  g.fillStyle = '#e9e6da';
  g.beginPath(); g.arc(mx, my, 24, 0, 7); g.fill();
  g.fillStyle = 'rgba(160,160,170,0.5)';
  g.beginPath(); g.arc(mx - 8, my - 5, 5, 0, 7); g.fill();
  g.beginPath(); g.arc(mx + 7, my + 8, 3.5, 0, 7); g.fill();
  // far hills
  g.fillStyle = '#101626';
  g.beginPath(); g.moveTo(0, 512);
  g.lineTo(0, 452);
  for (let x = 0; x <= 1024; x += 64) g.lineTo(x, 452 + Math.sin(x * 0.011) * 16 + Math.sin(x * 0.031 + 2) * 9);
  g.lineTo(1024, 512); g.closePath(); g.fill();
  g.fillStyle = '#0a0e1a';
  g.beginPath(); g.moveTo(0, 512);
  g.lineTo(0, 478);
  for (let x = 0; x <= 1024; x += 48) g.lineTo(x, 478 + Math.sin(x * 0.017 + 1) * 10 + Math.sin(x * 0.05) * 5);
  g.lineTo(1024, 512); g.closePath(); g.fill();
  return toTexture(c);
}

// --- fabric noise (tinted per material) ---
function fabricTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#cfcfcf'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 20000; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '90,90,90' : '235,235,235'},${R.f(0.03, 0.09)})`;
    g.fillRect(R.f(0, 256), R.f(0, 256), 2, 1);
  }
  return toTexture(c, { wrapRepeat: true });
}

// --- door leaf (two recessed panels) ---
function doorTexture() {
  const [c, g] = makeCanvas(256, 512);
  g.fillStyle = '#6b4a30'; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 900; i++) {
    g.strokeStyle = `rgba(30,16,6,${R.f(0.05, 0.2)})`;
    g.lineWidth = R.f(0.5, 1.5);
    const y = R.f(0, 512);
    g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(90, y + R.f(-5, 5), 170, y + R.f(-5, 5), 256, y + R.f(-4, 4)); g.stroke();
  }
  for (const py of [36, 288]) {
    g.fillStyle = 'rgba(20,10,4,0.75)'; g.fillRect(30, py, 196, 188);
    g.fillStyle = '#755236'; g.fillRect(38, py + 8, 180, 172);
    g.strokeStyle = 'rgba(255,220,160,0.18)'; g.lineWidth = 3; g.strokeRect(40, py + 10, 176, 168);
  }
  return toTexture(c);
}

// --- clock face ---
function clockFaceTexture() {
  const [c, g] = makeCanvas(256, 256);
  g.fillStyle = '#efe6d2'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.strokeStyle = '#3a2c20'; g.lineWidth = 6; g.beginPath(); g.arc(128, 128, 123, 0, 7); g.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const big = i % 3 === 0;
    g.strokeStyle = '#3a2c20'; g.lineWidth = big ? 7 : 3;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * (big ? 96 : 104), 128 + Math.sin(a) * (big ? 96 : 104));
    g.lineTo(128 + Math.cos(a) * 114, 128 + Math.sin(a) * 114);
    g.stroke();
  }
  return toTexture(c);
}

// --- leaf (alpha) ---
function leafTexture() {
  const [c, g] = makeCanvas(128, 128);
  g.clearRect(0, 0, 128, 128);
  const grad = g.createLinearGradient(0, 128, 0, 0);
  grad.addColorStop(0, '#3f5a30');
  grad.addColorStop(1, '#6d8a4a');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(64, 128);
  g.bezierCurveTo(10, 90, 18, 26, 64, 4);
  g.bezierCurveTo(110, 26, 118, 90, 64, 128);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,45,20,0.8)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(64, 126); g.lineTo(64, 8); g.stroke();
  g.lineWidth = 1.5;
  for (let i = 1; i < 6; i++) {
    const y = 118 - i * 18;
    g.beginPath(); g.moveTo(64, y); g.lineTo(64 - i * 5 - 8, y - 10); g.stroke();
    g.beginPath(); g.moveTo(64, y); g.lineTo(64 + i * 5 + 8, y - 10); g.stroke();
  }
  return toTexture(c, { srgb: true });
}

// --- radial glow ---
function radialTexture(inner, outer) {
  const [c, g] = makeCanvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = toTexture(c);
  return t;
}

// --- procedural wall art ---
function artCanvas(kind) {
  const [c, g] = makeCanvas(256, 320);
  if (kind === 0) { // dusk hills
    const grad = g.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, '#232c4e'); grad.addColorStop(0.7, '#6a4a5e'); grad.addColorStop(1, '#c07a4a');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#e9e2cc'; g.beginPath(); g.arc(170, 84, 20, 0, 7); g.fill();
    g.fillStyle = '#3a2f42'; g.beginPath(); g.moveTo(0, 320); g.lineTo(0, 210);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, 210 + Math.sin(x * 0.03) * 22);
    g.lineTo(256, 320); g.fill();
    g.fillStyle = '#241d2e'; g.beginPath(); g.moveTo(0, 320); g.lineTo(0, 258);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, 258 + Math.sin(x * 0.045 + 2) * 16);
    g.lineTo(256, 320); g.fill();
  } else if (kind === 1) { // boat
    const grad = g.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, '#1d2a4a'); grad.addColorStop(0.62, '#54506e'); grad.addColorStop(1, '#182036');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#d8d2c0'; g.beginPath(); g.arc(64, 78, 14, 0, 7); g.fill();
    g.fillStyle = '#10141f';
    g.beginPath(); g.moveTo(96, 232); g.lineTo(168, 232); g.lineTo(150, 252); g.lineTo(112, 252); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(132, 230); g.lineTo(132, 168); g.lineTo(166, 226); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(128, 230); g.lineTo(128, 186); g.lineTo(102, 226); g.closePath(); g.fill();
    g.fillStyle = 'rgba(216,210,192,0.25)'; g.fillRect(118, 254, 30, 58);
  } else if (kind === 2) { // fern
    g.fillStyle = '#26201a'; g.fillRect(0, 0, 256, 320);
    g.strokeStyle = '#5d7a4a'; g.lineCap = 'round';
    for (let f = 0; f < 5; f++) {
      const bx = 60 + f * 34, ang = -0.5 + f * 0.26;
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(bx, 316);
      g.quadraticCurveTo(bx + Math.sin(ang) * 60, 200, bx + Math.sin(ang) * 110, 90 - f * 8);
      g.stroke();
      g.lineWidth = 2.5;
      for (let i = 1; i < 9; i++) {
        const t = i / 9;
        const x = bx + Math.sin(ang) * 60 * t * (2 - t) + Math.sin(ang) * 110 * t * t * 0.6;
        const y = 316 - (316 - (90 - f * 8)) * t;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 16 - t * 14, y - 10); g.stroke();
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + 16 + t * 14, y - 12); g.stroke();
      }
    }
  } else { // arches
    g.fillStyle = '#31404a'; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#8a6a4a'; g.beginPath(); g.arc(128, 236, 84, Math.PI, 0); g.rect(44, 236, 168, 84); g.fill();
    g.fillStyle = '#5a6a52'; g.beginPath(); g.arc(128, 236, 58, Math.PI, 0); g.rect(70, 236, 116, 84); g.fill();
    g.fillStyle = '#c98a4b'; g.beginPath(); g.arc(128, 236, 30, Math.PI, 0); g.rect(98, 236, 60, 84); g.fill();
  }
  return c;
}

// ---------------------------------------------------------------------------
// Materials
// ---------------------------------------------------------------------------
const fabricTex = fabricTexture();
const M = {
  floor: new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.6, metalness: 0.04 }),
  wall: new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: 0.95 }),
  wainscot: new THREE.MeshStandardMaterial({ map: wainscotTexture(), roughness: 0.7 }),
  ceil: new THREE.MeshStandardMaterial({ color: 0xece1cc, roughness: 0.95 }),
  base: new THREE.MeshStandardMaterial({ color: 0x46331f, roughness: 0.55 }),
  paint: new THREE.MeshStandardMaterial({ color: 0xe6ddc9, roughness: 0.5 }),
  door: new THREE.MeshStandardMaterial({ map: doorTexture(), roughness: 0.55 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x9fb8d8, transparent: true, opacity: 0.16, roughness: 0.06, metalness: 0.25, side: THREE.DoubleSide, depthWrite: false }),
  stone: new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.9 }),
  fireback: new THREE.MeshStandardMaterial({ color: 0x241a12, roughness: 1 }),
  mantel: new THREE.MeshStandardMaterial({ color: 0x4c3626, roughness: 0.5 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x63452f, roughness: 0.55 }),
  woodDark: new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.6 }),
  sofa: new THREE.MeshStandardMaterial({ color: 0x6d7f5c, roughness: 0.95, map: fabricTex }),
  sofaCushion: new THREE.MeshStandardMaterial({ color: 0x7d8f6a, roughness: 0.95, map: fabricTex }),
  chair: new THREE.MeshStandardMaterial({ color: 0xa0563a, roughness: 0.95, map: fabricTex }),
  chairCushion: new THREE.MeshStandardMaterial({ color: 0xb06a4c, roughness: 0.95, map: fabricTex }),
  pillow: new THREE.MeshStandardMaterial({ color: 0xb98a3e, roughness: 0.95, map: fabricTex }),
  throw: new THREE.MeshStandardMaterial({ color: 0xe4d6bc, roughness: 1, map: fabricTex }),
  rug: new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.4, metalness: 0.7 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb08d4f, roughness: 0.35, metalness: 0.85 }),
  shade: new THREE.MeshStandardMaterial({ color: 0xf0e2c8, roughness: 0.9, side: THREE.DoubleSide, emissive: 0xff9c4a, emissiveIntensity: 0.32, map: fabricTex }),
  curtain: new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 1, side: THREE.DoubleSide, map: fabricTex }),
  cat: new THREE.MeshStandardMaterial({ color: 0x6a584c, roughness: 0.95 }),
  catDark: new THREE.MeshStandardMaterial({ color: 0x54443a, roughness: 0.95 }),
  pot: new THREE.MeshStandardMaterial({ color: 0x8a5a40, roughness: 0.8 }),
  soil: new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 1 }),
  leaf: new THREE.MeshStandardMaterial({ map: leafTexture(), transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.9 }),
  log: new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.9, emissive: 0x301005, emissiveIntensity: 0.5 }),
  mug: new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.4 }),
  book: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  sky: new THREE.MeshBasicMaterial({ map: skyTexture() }),
  glow: null, // set below
  candle: new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.5 }),
  flameTip: new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 2.2, roughness: 1 }),
};
M.sky.fog = false;
M.glow = new THREE.SpriteMaterial({
  map: radialTexture('rgba(255,170,80,0.85)', 'rgba(255,120,40,0)'),
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.55,
});

const uTime = { value: 0 };
const col = new THREE.Color();

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function box(w, h, d, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.recv !== false;
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 14), mat);
  m.position.set(x, y, z);
  if (o.rx) m.rotation.x = o.rx;
  if (o.ry) m.rotation.y = o.ry;
  if (o.rz) m.rotation.z = o.rz;
  m.castShadow = o.cast !== false;
  m.receiveShadow = o.recv !== false;
  return m;
}
function group(...children) {
  const g = new THREE.Group();
  for (const c of children) g.add(c);
  return g;
}

// ---------------------------------------------------------------------------
// Room shell
// ---------------------------------------------------------------------------
const ceilingGroup = new THREE.Group();
scene.add(ceilingGroup);

{ // floor
  const f = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5), M.floor);
  f.rotation.x = -Math.PI / 2;
  f.receiveShadow = true;
  scene.add(f);
  const sub = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.15, 5.1), new THREE.MeshStandardMaterial({ color: 0x141018, roughness: 1 }));
  sub.position.y = -0.085; // top face stays 1 cm below the floor plane (no z-fighting)
  scene.add(sub);
}

// walls — north (−z) with window, south (+z) with door, east/west solid
{
  const N = -RZ, S = RZ;
  // north wall pieces around window (x −0.8…0.8, y 0.9…2.1)
  scene.add(box(2.35, RH, WT, M.wall, -3 + 2.35 / 2 - 0.15, RH / 2, N - WT / 2, { cast: false }));
  scene.add(box(2.35, RH, WT, M.wall, 3 - 2.35 / 2 + 0.15, RH / 2, N - WT / 2, { cast: false }));
  scene.add(box(1.6, 0.9, WT, M.wall, 0, 0.45, N - WT / 2, { cast: false }));
  scene.add(box(1.6, 0.6, WT, M.wall, 0, 2.4, N - WT / 2, { cast: false }));
  // south wall pieces around door (x −2.25…−1.35, y 0…2.1)
  scene.add(box(0.9, RH, WT, M.wall, -2.7, RH / 2, S + WT / 2, { cast: false }));
  scene.add(box(4.5, RH, WT, M.wall, 0.9, RH / 2, S + WT / 2, { cast: false }));
  scene.add(box(0.9, 0.6, WT, M.wall, -1.8, 2.4, S + WT / 2, { cast: false }));
  // east + west walls (between north/south)
  scene.add(box(WT, RH, 4.5, M.wall, RX + WT / 2, RH / 2, 0, { cast: false }));
  scene.add(box(WT, RH, 4.5, M.wall, -RX - WT / 2, RH / 2, 0, { cast: false }));
  // ceiling
  const ceil = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.15, 5.1), M.ceil);
  ceil.position.y = RH + 0.075;
  ceil.receiveShadow = true;
  ceilingGroup.add(ceil);
}

// wainscot + baseboards (skip the door gap on the south wall)
{
  const wain = (len, x, z, rotY) => {
    const t = M.wainscot.map.clone();
    t.repeat.set(len, 0.9);
    t.needsUpdate = true;
    const mat = M.wainscot.clone(); mat.map = t;
    const m = box(len, 0.9, 0.02, mat, x, 0.45, z, { cast: false });
    m.rotation.y = rotY;
    return m;
  };
  scene.add(wain(4.5, -3 + 0.011, 0, Math.PI / 2));
  scene.add(wain(4.5, 3 - 0.011, 0, Math.PI / 2));
  scene.add(wain(6, 0, -RZ + 0.011, 0));
  scene.add(wain(0.75, -2.625, RZ - 0.011, 0));
  scene.add(wain(4.35, 0.825, RZ - 0.011, 0));
  // chair rail
  scene.add(box(0.025, 0.05, 4.5, M.woodDark, -3 + 0.0125, 0.915, 0, { cast: false }));
  scene.add(box(0.025, 0.05, 4.5, M.woodDark, 3 - 0.0125, 0.915, 0, { cast: false }));
  scene.add(box(6, 0.05, 0.025, M.woodDark, 0, 0.915, -RZ + 0.0125, { cast: false }));
  scene.add(box(0.75, 0.05, 0.025, M.woodDark, -3 + 0.375, 0.915, RZ - 0.0125, { cast: false }));
  scene.add(box(4.35, 0.05, 0.025, M.woodDark, -1.35 + 2.175, 0.915, RZ - 0.0125, { cast: false }));
  // baseboards
  const bb = (w, x, z, rotY) => {
    const m = box(w, 0.1, 0.018, M.base, x, 0.05, z, { cast: false });
    m.rotation.y = rotY;
    return m;
  };
  scene.add(bb(4.5, -3 + 0.009, 0, Math.PI / 2));
  scene.add(bb(4.5, 3 - 0.009, 0, Math.PI / 2));
  scene.add(bb(6, 0, -RZ + 0.009, 0));
  scene.add(bb(0.75, -3 + 0.375, RZ - 0.009, 0));
  scene.add(bb(4.35, -1.35 + 2.175, RZ - 0.009, 0));
}

// ---------------------------------------------------------------------------
// Window (north wall) + curtains + sky
// ---------------------------------------------------------------------------
{
  const N = -RZ;
  scene.add(box(1.78, 0.05, 0.16, M.paint, 0, 0.885, N + 0.055, { cast: false })); // sill
  scene.add(box(1.78, 0.07, 0.1, M.paint, 0, 2.135, N + 0.03, { cast: false }));   // lintel
  scene.add(box(0.07, 1.24, 0.1, M.paint, -0.835, 1.5, N + 0.03, { cast: false }));
  scene.add(box(0.07, 1.24, 0.1, M.paint, 0.835, 1.5, N + 0.03, { cast: false }));
  scene.add(box(0.045, 1.2, 0.05, M.paint, 0, 1.5, N + 0.022, { cast: false }));   // muntins
  scene.add(box(1.6, 0.045, 0.05, M.paint, 0, 1.5, N + 0.022, { cast: false }));
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), M.glass);
  glass.position.set(0, 1.5, N + 0.012);
  scene.add(glass);
  // sky outside
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.6), M.sky);
  sky.position.set(0, 1.7, N - 1.15);
  scene.add(sky);
  // little plant on the sill
  const pot = cyl(0.06, 0.045, 0.09, M.pot, -0.45, 0.965, N + 0.05);
  pot.castShadow = false;
  scene.add(pot);
  scene.add(cyl(0.052, 0.052, 0.012, M.soil, -0.45, 1.01, N + 0.05, { cast: false }));
  for (let i = 0; i < 4; i++) {
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.16), M.leaf);
    lf.position.set(-0.45 + R.f(-0.03, 0.03), 1.09, N + 0.05 + R.f(-0.02, 0.02));
    lf.rotation.set(R.f(-0.7, -0.2), R.f(0, 6.28), R.f(-0.4, 0.4));
    lf.castShadow = false;
    scene.add(lf);
  }
}

// curtains with a gentle sway
const curtainMats = [];
{
  const N = -RZ;
  const rod = cyl(0.016, 0.016, 2.7, M.metal, 0, 2.33, N + 0.09, { rx: 0, rz: Math.PI / 2 });
  rod.castShadow = false;
  scene.add(rod);
  const fin1 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.metal);
  fin1.position.set(-1.35, 2.33, N + 0.09);
  const fin2 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.metal);
  fin2.position.set(1.35, 2.33, N + 0.09);
  scene.add(fin1, fin2);

  for (const sx of [-1.06, 1.06]) {
    const mat = M.curtain.clone();
    mat.map = M.curtain.map;
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.uniforms.uSeed = { value: sx < 0 ? 3.1 : 7.7 };
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uSeed;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float fold = sin(transformed.x * 15.0 + uTime * 0.8 + uSeed) * 0.55
                      + sin(transformed.x * 6.0 - uTime * 0.5 + uSeed * 2.0) * 0.45;
          transformed.z += fold * 0.028 * (1.0 - uv.y * 0.35);`);
    };
    curtainMats.push(mat);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.2, 20, 1), mat);
    p.position.set(sx, 1.22, N + 0.085);
    p.castShadow = false;
    p.receiveShadow = true;
    scene.add(p);
  }
}

// ---------------------------------------------------------------------------
// Door (south wall) — hinged west, opens inwards
// ---------------------------------------------------------------------------
const doorGroup = new THREE.Group();
{
  const S = RZ;
  scene.add(box(0.09, 2.12, 0.1, M.paint, -2.295, 1.06, S - 0.03, { cast: false }));
  scene.add(box(0.09, 2.12, 0.1, M.paint, -1.305, 1.06, S - 0.03, { cast: false }));
  scene.add(box(1.16, 0.09, 0.1, M.paint, -1.8, 2.155, S - 0.03, { cast: false }));

  doorGroup.position.set(-2.25, 0, S);
  const leaf = box(0.9, 2.08, 0.045, M.door, 0.45, 1.06, -0.005);
  doorGroup.add(leaf);
  // knob on the room side (−z local)
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), M.brass);
  knob.position.set(0.78, 1.02, -0.045);
  knob.castShadow = false;
  doorGroup.add(knob);
  const stem = cyl(0.012, 0.012, 0.05, M.brass, 0.78, 1.02, -0.028, { rx: Math.PI / 2, seg: 8 });
  stem.castShadow = false;
  doorGroup.add(stem);
  // hinges on the wall side
  for (const hy of [0.35, 1.75]) {
    const h = box(0.05, 0.14, 0.012, M.brass, 0.06, hy, 0.03, { cast: false });
    doorGroup.add(h);
  }
  scene.add(doorGroup);
  // doorstop on the floor at the open position
  const stop = box(0.09, 0.03, 0.05, M.woodDark, -2.25 + 0.9 * Math.sin(1.396), 0.015, S - 0.9 * Math.cos(1.396), { cast: false });
  stop.rotation.y = 1.396;
  scene.add(stop);
}

// ---------------------------------------------------------------------------
// Fireplace (east wall, centred)
// ---------------------------------------------------------------------------
const fireGroup = new THREE.Group();
const flameMats = [];
let fireLight, fireGlow, fireFloorGlow;
{
  const E = RX;
  // chimney breast
  fireGroup.add(box(0.3, 1.85, 1.6, M.stone, E - 0.15, 0.85 + 0.925, 0));
  fireGroup.add(box(0.3, 0.15, 1.6, M.stone, E - 0.15, 0.075, 0));
  fireGroup.add(box(0.3, 0.7, 0.3, M.stone, E - 0.15, 0.5, -0.65));
  fireGroup.add(box(0.3, 0.7, 0.3, M.stone, E - 0.15, 0.5, 0.65));
  // firebox interior — five inward-facing planes (front open)
  const fbMat = new THREE.MeshStandardMaterial({ color: 0x17100b, roughness: 1 });
  const fbBack = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.7), fbMat);
  fbBack.position.set(E - 0.01, 0.5, 0);
  fbBack.rotation.y = -Math.PI / 2;
  const fbTop = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), fbMat);
  fbTop.position.set(E - 0.15, 0.85, 0);
  fbTop.rotation.x = Math.PI / 2;
  const fbBot = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), fbMat);
  fbBot.position.set(E - 0.15, 0.15, 0);
  fbBot.rotation.x = -Math.PI / 2;
  const fbL = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.7), fbMat);
  fbL.position.set(E - 0.15, 0.5, -0.5);
  const fbR = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.7), fbMat);
  fbR.position.set(E - 0.15, 0.5, 0.5);
  fbR.rotation.y = Math.PI;
  fireGroup.add(fbBack, fbTop, fbBot, fbL, fbR);
  fireGroup.add(box(0.03, 0.52, 0.82, M.fireback, E - 0.05, 0.46, 0, { cast: false }));
  // hearth slab (thin, flush with the breast face)
  fireGroup.add(box(0.02, 0.03, 1.1, M.stone, E - 0.31, 0.015, 0, { cast: false }));
  // dark stone trim framing the opening
  const trim = new THREE.MeshStandardMaterial({ color: 0x453c33, roughness: 0.9 });
  fireGroup.add(box(0.08, 0.95, 0.16, trim, E - 0.30, 0.5, -0.58));
  fireGroup.add(box(0.08, 0.95, 0.16, trim, E - 0.30, 0.5, 0.58));
  fireGroup.add(box(0.08, 0.14, 1.32, trim, E - 0.30, 0.92, 0));
  fireGroup.add(box(0.08, 0.14, 1.32, trim, E - 0.30, 0.105, 0));
  // mantel shelf + corbels
  fireGroup.add(box(0.16, 0.06, 1.5, M.mantel, E - 0.08, 1.13, 0));
  fireGroup.add(box(0.1, 0.1, 0.12, M.mantel, E - 0.1, 1.03, -0.6, { cast: false }));
  fireGroup.add(box(0.1, 0.1, 0.12, M.mantel, E - 0.1, 1.03, 0.6, { cast: false }));
  // candles on the mantel
  for (const cz of [-0.5, 0.5]) {
    fireGroup.add(cyl(0.024, 0.028, 0.16, M.candle, E - 0.09, 1.24, cz, { seg: 10 }));
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.045, 8), M.flameTip);
    fl.position.set(E - 0.09, 1.35, cz);
    fl.castShadow = false;
    fireGroup.add(fl);
  }
  // framed picture above the mantel
  const pic = box(0.05, 0.62, 0.82, M.woodDark, E - 0.028, 1.78, 0, { cast: false });
  fireGroup.add(pic);
  const artMat = new THREE.MeshStandardMaterial({ map: toTexture(artCanvas(0)), roughness: 0.9 });
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.54), artMat);
  art.position.set(E - 0.056, 1.78, 0);
  art.rotation.y = -Math.PI / 2;
  fireGroup.add(art);
  // small leaning frame on the mantel
  const sf = box(0.03, 0.22, 0.18, M.woodDark, E - 0.1, 1.26, 0.16, { rz: 0.16, cast: false });
  fireGroup.add(sf);

  // logs
  const log1 = cyl(0.055, 0.055, 0.55, M.log, E - 0.17, 0.235, 0, { rx: Math.PI / 2, ry: 0.15, seg: 10 });
  const log2 = cyl(0.05, 0.05, 0.5, M.log, E - 0.15, 0.32, 0.06, { rx: Math.PI / 2, ry: -0.5, seg: 10 });
  const log3 = cyl(0.04, 0.04, 0.34, M.log, E - 0.2, 0.27, -0.16, { rx: Math.PI / 2, ry: 0.9, seg: 10 });
  fireGroup.add(log1, log2, log3);

  // flames
  const flameDefs = [
    { r: 0.15, h: 0.52, x: -0.16, y: 0.44, z: 0.0, s: 1.0 },
    { r: 0.11, h: 0.38, x: -0.18, y: 0.38, z: -0.16, s: 0.8 },
    { r: 0.12, h: 0.42, x: -0.18, y: 0.4, z: 0.15, s: 0.85 },
    { r: 0.08, h: 0.27, x: -0.2, y: 0.33, z: 0.05, s: 0.7 },
    { r: 0.07, h: 0.24, x: -0.2, y: 0.31, z: -0.06, s: 0.65 },
  ];
  for (let i = 0; i < flameDefs.length; i++) {
    const d = flameDefs[i];
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime, uSeed: { value: 2.3 + i * 5.7 }, uHeight: { value: d.h } },
      vertexShader: `
        uniform float uTime; uniform float uSeed; uniform float uHeight;
        varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          vec3 p = position;
          float h = clamp((p.y + uHeight * 0.5) / uHeight, 0.0, 1.0);
          vH = h;
          float s1 = sin(uTime * 2.3 + uSeed * 17.0 + h * 5.5) * 0.6 + sin(uTime * 4.7 + uSeed * 31.0 + h * 11.0) * 0.4;
          float s2 = cos(uTime * 3.1 + uSeed * 23.0 + h * 8.0) * 0.6 + sin(uTime * 6.3 + uSeed * 7.0 + h * 13.0) * 0.4;
          p.x += s1 * h * h * 0.24;
          p.z += s2 * h * h * 0.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalMatrix * normal;
          vV = -mv.xyz;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uSeed;
        varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          float rim = abs(dot(normalize(vN), normalize(vV)));
          float soft = 0.35 + 0.65 * pow(rim, 0.8);
          float a = smoothstep(0.0, 0.18, vH) * (1.0 - smoothstep(0.55, 1.0, vH)) * soft;
          vec3 c = mix(vec3(1.0, 0.3, 0.04), vec3(1.0, 0.72, 0.16), smoothstep(0.0, 0.6, vH));
          c = mix(c, vec3(1.0, 0.93, 0.55), smoothstep(0.55, 0.95, vH));
          c *= 0.92 + 0.14 * sin(vH * 34.0 + uTime * 21.0 + uSeed * 13.0);
          gl_FragColor = vec4(c * 1.9, a * 0.85);
        }`,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    flameMats.push(mat);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(d.r, d.h, 10, 12, true), mat);
    fl.position.set(E + d.x, d.y, d.z);
    fl.rotation.z = R.f(-0.08, 0.08);
    fl.rotation.x = R.f(-0.06, 0.1);
    fl.renderOrder = 5;
    fl.frustumCulled = false;
    fireGroup.add(fl);
  }

  // glow sprite + floor glow
  fireGlow = new THREE.Sprite(M.glow);
  fireGlow.position.set(E - 0.4, 0.42, 0);
  fireGlow.scale.set(0.9, 0.9, 1);
  fireGroup.add(fireGlow);

  const fgMat = new THREE.MeshBasicMaterial({
    map: radialTexture('rgba(255,140,50,0.5)', 'rgba(255,110,30,0)'),
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5,
  });
  fireFloorGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), fgMat);
  fireFloorGlow.rotation.x = -Math.PI / 2;
  fireFloorGlow.position.set(2.05, 0.012, 0);
  fireFloorGlow.renderOrder = 4;
  fireGroup.add(fireFloorGlow);
  scene.add(fireGroup);

  fireLight = new THREE.PointLight(0xff7f35, 20, 9, 2);
  fireLight.position.set(E - 0.22, 0.55, 0);
  fireLight.castShadow = true;
  fireLight.shadow.mapSize.set(512, 512);
  fireLight.shadow.camera.near = 0.05;
  fireLight.shadow.camera.far = 7;
  fireLight.shadow.bias = -0.004;
  fireLight.shadow.normalBias = 0.02;
  scene.add(fireLight);
}

// embers
let emberMat;
{
  const n = 16;
  const base = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    base[i * 3] = RX - 0.2 + R.f(-0.16, 0.16);
    base[i * 3 + 1] = 0.3 + R.f(0, 0.15);
    base[i * 3 + 2] = R.f(-0.18, 0.18);
    seed[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  emberMat = new THREE.ShaderMaterial({
    uniforms: { uTime },
    vertexShader: `
      uniform float uTime;
      attribute vec3 aBase; attribute float aSeed;
      varying float vA;
      void main() {
        float speed = 0.22 + 0.25 * fract(aSeed * 7.31);
        float life = fract(uTime * speed + aSeed * 11.7);
        vec3 p = aBase;
        p.y += life * (0.5 + 0.5 * fract(aSeed * 3.7));
        p.x += sin(uTime * 1.9 + aSeed * 21.0) * 0.07 * life;
        p.z += cos(uTime * 1.5 + aSeed * 17.0) * 0.07 * life;
        vA = (1.0 - life) * smoothstep(0.0, 0.08, life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (2.0 + 3.0 * (1.0 - life)) * (5.0 / max(0.1, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.2, d) * vA;
        gl_FragColor = vec4(1.0, 0.55, 0.18, a * 0.9);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, emberMat);
  pts.renderOrder = 6;
  pts.frustumCulled = false;
  scene.add(pts);
}

// fire tools + firewood beside the hearth
{
  const g = new THREE.Group();
  g.position.set(2.5, 0, 0.92);
  g.add(box(0.2, 0.05, 0.08, M.woodDark, 0, 0.025, 0));
  const poker = cyl(0.007, 0.007, 0.5, M.brass, 0.05, 0.28, 0, { rz: 0.12, seg: 6 });
  g.add(poker);
  const t1 = cyl(0.005, 0.005, 0.42, M.brass, -0.05, 0.26, 0, { rz: -0.14, seg: 6 });
  const t2 = cyl(0.005, 0.005, 0.42, M.brass, -0.035, 0.26, 0, { rz: -0.1, seg: 6 });
  g.add(t1, t2);
  scene.add(g);

  // firewood stack against the east wall, south of the breast
  const logs = [];
  const push = (z, y) => {
    const l = cyl(0.07, 0.07, 0.35, M.log, 2.85, y, z, { rx: Math.PI / 2, seg: 9 });
    logs.push(l);
  };
  for (const z of [1.0, 1.225, 1.45]) push(z, 0.07);
  for (const z of [1.11, 1.335]) push(z, 0.185);
  scene.add(group(...logs));
}

// ---------------------------------------------------------------------------
// Sofa (faces the fireplace; back 2.5 m from the east wall)
// ---------------------------------------------------------------------------
const sofaGroup = new THREE.Group();
{
  sofaGroup.add(box(0.8, 0.3, 2.1, M.sofa, 0.9, 0.27, 0));
  sofaGroup.add(box(0.14, 0.73, 2.1, M.sofa, 0.57, 0.485, 0));
  sofaGroup.add(box(0.8, 0.5, 0.17, M.sofa, 0.9, 0.37, -0.965));
  sofaGroup.add(box(0.8, 0.5, 0.17, M.sofa, 0.9, 0.37, 0.965));
  for (const cz of [-0.6, 0, 0.6]) {
    sofaGroup.add(box(0.62, 0.15, 0.58, M.sofaCushion, 1.0, 0.495, cz));
    const bc = box(0.13, 0.36, 0.56, M.sofaCushion, 0.72, 0.66, cz, { rz: 0.12 });
    sofaGroup.add(bc);
  }
  for (const [lx, lz] of [[0.62, -0.93], [1.18, -0.93], [0.62, 0.93], [1.18, 0.93]]) {
    sofaGroup.add(cyl(0.03, 0.026, 0.12, M.woodDark, lx, 0.06, lz, { seg: 8 }));
  }
  // throw blanket over the south arm
  const throwG = new THREE.Group();
  throwG.add(box(0.82, 0.06, 0.3, M.throw, 0.9, 0.65, 0.965));
  throwG.add(box(0.05, 0.52, 0.3, M.throw, 1.325, 0.38, 0.965));
  throwG.add(box(0.82, 0.05, 0.3, M.throw, 0.9, 0.62, 0.965, { rz: 0.02 }));
  throwG.rotation.z = -0.03;
  sofaGroup.add(throwG);
  // accent pillow
  const pil = box(0.1, 0.3, 0.3, M.pillow, 0.75, 0.68, -0.78, { rz: 0.2, ry: 0.18 });
  sofaGroup.add(pil);
  scene.add(sofaGroup);
}

// ---------------------------------------------------------------------------
// Coffee table (between sofa and fireplace, ≥ 0.45 m walkway each side)
// ---------------------------------------------------------------------------
{
  const g = new THREE.Group();
  g.add(box(0.4, 0.035, 1.1, M.wood, 1.95, 0.3625, 0));
  g.add(box(0.36, 0.02, 1.0, M.woodDark, 1.95, 0.12, 0, { cast: false }));
  for (const [lx, lz] of [[1.79, -0.51], [2.11, -0.51], [1.79, 0.51], [2.11, 0.51]]) {
    g.add(box(0.05, 0.345, 0.05, M.woodDark, lx, 0.1725, lz));
  }
  // books + mug on top
  const b1 = box(0.2, 0.035, 0.15, new THREE.MeshStandardMaterial({ color: 0x7a3b3b, roughness: 0.8 }), 1.88, 0.3975, -0.22, { ry: 0.25 });
  const b2 = box(0.17, 0.03, 0.13, new THREE.MeshStandardMaterial({ color: 0x3b4a5a, roughness: 0.8 }), 1.88, 0.432, -0.22, { ry: 0.1 });
  g.add(b1, b2);
  const mug = cyl(0.035, 0.03, 0.09, M.mug, 2.05, 0.425, 0.2, { seg: 14 });
  g.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 8, 14, Math.PI), M.mug);
  handle.position.set(2.095, 0.43, 0.2);
  handle.rotation.z = -Math.PI / 2;
  g.add(handle);
  const candle = cyl(0.02, 0.02, 0.07, M.candle, 2.02, 0.415, -0.05, { seg: 10 });
  g.add(candle);
  const wick = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.02, 6), M.flameTip);
  wick.position.set(2.02, 0.46, -0.05);
  wick.castShadow = false;
  g.add(wick);
  scene.add(g);
}

// ---------------------------------------------------------------------------
// Rug — centred under the table, reaching under the sofa's front legs
// ---------------------------------------------------------------------------
{
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 2.0), M.rug);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(1.905, 0.006, 0);
  rug.receiveShadow = true;
  scene.add(rug);
}

// ---------------------------------------------------------------------------
// Armchair — NE corner, angled 45° toward the fireplace
// ---------------------------------------------------------------------------
const chairGroup = new THREE.Group();
{
  chairGroup.add(box(0.8, 0.28, 0.8, M.chair, 0, 0.26, 0));
  chairGroup.add(box(0.13, 0.68, 0.8, M.chair, -0.335, 0.46, 0));
  chairGroup.add(box(0.8, 0.45, 0.15, M.chair, 0, 0.345, -0.325));
  chairGroup.add(box(0.8, 0.45, 0.15, M.chair, 0, 0.345, 0.325));
  chairGroup.add(box(0.6, 0.14, 0.62, M.chairCushion, 0.04, 0.47, 0));
  chairGroup.add(box(0.12, 0.34, 0.6, M.chairCushion, -0.22, 0.64, 0, { rz: 0.12 }));
  for (const [lx, lz] of [[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]]) {
    chairGroup.add(cyl(0.028, 0.024, 0.12, M.woodDark, lx, 0.06, lz, { seg: 8 }));
  }
  chairGroup.add(box(0.1, 0.28, 0.28, M.pillow, -0.16, 0.66, 0.16, { rz: 0.18, ry: 0.2 }));
  chairGroup.add(box(0.16, 0.03, 0.12, new THREE.MeshStandardMaterial({ color: 0x5a6b4a, roughness: 0.8 }), 0.08, 0.585, 0.325, { ry: 0.3 }));
  chairGroup.position.set(2.15, 0, -1.55);
  chairGroup.rotation.y = -Math.PI / 4; // facing east-south, toward the fire
  scene.add(chairGroup);
}

// ---------------------------------------------------------------------------
// Floor lamp — west side of the armchair
// ---------------------------------------------------------------------------
let lampLight;
{
  const g = new THREE.Group();
  g.position.set(1.6, 0, -1.75);
  g.add(cyl(0.14, 0.16, 0.025, M.metal, 0, 0.0125, 0, { seg: 18 }));
  g.add(cyl(0.014, 0.014, 1.42, M.metal, 0, 0.735, 0, { seg: 8 }));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.3, 20, 1, true), M.shade);
  shade.position.y = 1.5;
  shade.castShadow = false;
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffc27a, emissiveIntensity: 2.6 }));
  bulb.position.y = 1.44;
  g.add(bulb);
  scene.add(g);
  lampLight = new THREE.PointLight(0xffc489, 8, 7, 2);
  lampLight.position.set(1.6, 1.45, -1.75);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(512, 512);
  lampLight.shadow.camera.near = 0.05;
  lampLight.shadow.camera.far = 6;
  lampLight.shadow.bias = -0.004;
  lampLight.shadow.normalBias = 0.02;
  scene.add(lampLight);
}

// ---------------------------------------------------------------------------
// Bookshelf — west wall, floor to ceiling, clear of the door swing
// ---------------------------------------------------------------------------
{
  const g = new THREE.Group();
  g.position.set(-3, 0, 0); // local +x faces into the room
  const L = 3.5, Z0 = -2.25; // spans z −2.25…1.25
  const zc = -0.5;
  g.add(box(0.02, 2.7, L, M.woodDark, 0.01, 1.35, zc, { cast: false })); // back
  g.add(box(0.3, 2.7, 0.04, M.wood, 0.15, 1.35, Z0 + 0.02));
  g.add(box(0.3, 2.7, 0.04, M.wood, 0.15, 1.35, Z0 + L - 0.02));
  g.add(box(0.3, 0.04, L, M.wood, 0.15, 2.68, zc));
  g.add(box(0.3, 0.05, L, M.wood, 0.15, 0.025, zc));
  const shelfYs = [0.55, 1.05, 1.55, 2.05];
  for (const y of shelfYs) g.add(box(0.28, 0.03, L - 0.06, M.wood, 0.15, y, zc));
  for (const dz of [-1.08, 0.08]) g.add(box(0.28, 2.63, 0.04, M.wood, 0.15, 1.365, dz, { cast: false }));

  // books (merged per shelf level)
  const palette = [0x7a3b3b, 0x3b4a5a, 0x5a6b4a, 0x8a6b3a, 0x4a3b5a, 0x6b4a3a, 0x3a5a5a, 0x8a4a5a, 0x5a4a3a, 0x4a5a6b, 0x6b5a6b, 0x8a7a5a, 0x996633, 0x2f4f4f];
  const sections = [[-2.21, -1.1], [-1.06, 0.06], [0.1, 1.21]];
  const addBooks = (yBase, zStart, zEnd, maxH, chance = 1) => {
    const geos = [];
    let z = zStart;
    while (z < zEnd - 0.03) {
      if (rand() < 0.07 * (2 - chance)) { z += R.f(0.03, 0.1); continue; }
      const w = R.f(0.028, 0.062);
      if (z + w > zEnd) break;
      const h = R.f(0.2, maxH);
      const d = R.f(0.15, 0.2);
      const geo = new THREE.BoxGeometry(d, h, w);
      geo.translate(0, h / 2, 0);
      if (rand() < 0.09) geo.rotateX(R.f(-0.13, 0.13));
      geo.translate(0.16, yBase, z + w / 2);
      col.setHex(R.pick(palette)).offsetHSL(0, R.f(-0.04, 0.04), R.f(-0.05, 0.05));
      const n = geo.attributes.position.count;
      const ca = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(ca, 3));
      geos.push(geo);
      z += w + 0.005;
    }
    if (geos.length) {
      const merged = mergeGeometries(geos);
      const mesh = new THREE.Mesh(merged, M.book);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
      geos.forEach((x) => x.dispose());
    }
  };
  addBooks(0.05, ...sections[0], 0.42);
  addBooks(0.05, ...sections[1], 0.42);
  addBooks(0.05, ...sections[2], 0.42);
  addBooks(0.565, ...sections[0], 0.34);
  addBooks(0.565, ...sections[1], 0.34);
  addBooks(0.565, ...sections[2], 0.34);
  addBooks(1.065, ...sections[0], 0.32);
  addBooks(1.065, ...sections[1], 0.32);
  addBooks(1.065, ...sections[2], 0.32);
  addBooks(1.565, ...sections[0], 0.3);
  addBooks(1.565, ...sections[1], 0.3);
  addBooks(1.565, ...sections[2], 0.3);
  // top level: books + storage boxes + a small plant
  addBooks(2.065, sections[0][0], sections[0][1] - 0.3, 0.28);
  addBooks(2.065, sections[1][0], sections[1][1], 0.28);
  addBooks(2.065, sections[2][0] + 0.3, sections[2][1] - 0.36, 0.28);
  g.add(box(0.24, 0.2, 0.3, M.woodDark, 0.15, 2.165, sections[0][1] - 0.17));
  g.add(box(0.24, 0.2, 0.3, M.woodDark, 0.15, 2.165, sections[2][1] - 0.17));
  g.add(cyl(0.05, 0.04, 0.08, M.pot, 0.15, 2.11, sections[2][0] + 0.15, { seg: 10 }));
  for (let i = 0; i < 4; i++) {
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.14), M.leaf);
    lf.position.set(0.15, 2.24, sections[2][0] + 0.15 + R.f(-0.03, 0.03));
    lf.rotation.set(R.f(-0.8, -0.2), R.f(0, 6.28), R.f(-0.4, 0.4));
    lf.castShadow = false;
    g.add(lf);
  }
  scene.add(g);
}

// ---------------------------------------------------------------------------
// Potted plant (SE corner), sleeping cat (rug, by the fire)
// ---------------------------------------------------------------------------
let catBody;
{
  const g = new THREE.Group();
  g.position.set(2.55, 0, 1.8);
  g.add(cyl(0.15, 0.11, 0.24, M.pot, 0, 0.12, 0, { seg: 14 }));
  g.add(cyl(0.13, 0.13, 0.02, M.soil, 0, 0.24, 0, { cast: false, seg: 14 }));
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + R.f(-0.3, 0.3);
    const stem = cyl(0.006, 0.008, R.f(0.4, 0.7), M.catDark, Math.sin(a) * 0.08, 0.5, Math.cos(a) * 0.08, {
      rx: Math.cos(a) * 0.5, rz: -Math.sin(a) * 0.5, seg: 5, cast: false,
    });
    g.add(stem);
    const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.42), M.leaf);
    lf.position.set(Math.sin(a) * 0.16, R.f(0.62, 0.85), Math.cos(a) * 0.16);
    lf.rotation.set(Math.cos(a) * 0.8, -a, -Math.sin(a) * 0.8);
    lf.castShadow = false;
    g.add(lf);
  }
  scene.add(g);

  // cat
  const c = new THREE.Group();
  c.position.set(2.35, 0, 0.78);
  catBody = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 14), M.cat);
  catBody.scale.set(1.15, 0.62, 0.9);
  catBody.position.y = 0.1;
  catBody.castShadow = true;
  c.add(catBody);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), M.cat);
  head.position.set(0.17, 0.12, 0.05);
  head.castShadow = true;
  c.add(head);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.05, 6), M.catDark);
    ear.position.set(0.17 + s * 0.02, 0.2, 0.05 + s * 0.05);
    ear.rotation.z = -s * 0.4;
    c.add(ear);
  }
  const tail = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 8, 20, 4.6), M.catDark);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(-0.06, 0.045, 0.02);
  tail.castShadow = true;
  c.add(tail);
  scene.add(c);
}

// ---------------------------------------------------------------------------
// Wall art, clock, coat hook, floating shelf
// ---------------------------------------------------------------------------
function picture(w, h, kind, frameMat = M.woodDark) {
  const g = new THREE.Group();
  g.add(box(w + 0.09, h + 0.09, 0.035, frameMat, 0, 0, 0, { cast: false }));
  const mat = new THREE.MeshStandardMaterial({ map: toTexture(artCanvas(kind)), roughness: 0.9 });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  p.position.z = 0.019;
  g.add(p);
  return g;
}
{
  const N = -RZ, S = RZ;
  let p = picture(0.5, 0.65, 0);
  p.position.set(-1.9, 1.55, N + 0.025);
  scene.add(p);
  p = picture(0.45, 0.6, 1);
  p.position.set(1.9, 1.5, N + 0.025);
  scene.add(p);
  // south-wall gallery (east of the door)
  p = picture(0.4, 0.5, 2);
  p.position.set(0.5, 1.5, S - 0.025);
  p.rotation.y = Math.PI;
  scene.add(p);
  p = picture(0.34, 0.42, 3);
  p.position.set(1.15, 1.62, S - 0.025);
  p.rotation.y = Math.PI;
  scene.add(p);
  p = picture(0.5, 0.38, 0);
  p.position.set(1.75, 1.42, S - 0.025);
  p.rotation.y = Math.PI;
  scene.add(p);
  // coat hook + scarf + hat in the bookshelf gap (outside the swing arc)
  const hook = new THREE.Group();
  hook.position.set(-2.985, 1.5, 1.5);
  hook.add(cyl(0.012, 0.012, 0.1, M.brass, 0, 0.02, 0.02, { rz: Math.PI / 2, seg: 6 }));
  const scarf = box(0.07, 0.5, 0.025, new THREE.MeshStandardMaterial({ color: 0x8a4a5a, roughness: 1, map: fabricTex }), 0.01, -0.24, 0.03, { rz: 0.06 });
  hook.add(scarf);
  const hat = new THREE.Group();
  hat.position.set(0.05, -0.02, 0.04);
  hat.add(cyl(0.07, 0.08, 0.09, new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1, map: fabricTex }), 0, 0.02, 0, { seg: 12 }));
  hat.add(cyl(0.12, 0.12, 0.012, new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 1, map: fabricTex }), 0, -0.03, 0, { seg: 12 }));
  hat.rotation.z = 0.5;
  hook.add(hat);
  scene.add(hook);
  // floating shelf on the north wall, east of the window
  const sh = new THREE.Group();
  sh.position.set(2.25, 1.5, N + 0.07);
  sh.add(box(0.8, 0.03, 0.14, M.wood, 0, 0, 0));
  sh.add(box(0.03, 0.08, 0.12, M.woodDark, -0.3, -0.05, 0, { cast: false }));
  sh.add(box(0.03, 0.08, 0.12, M.woodDark, 0.3, -0.05, 0, { cast: false }));
  const sb = [];
  for (let i = 0; i < 4; i++) {
    const w = R.f(0.03, 0.05), h = R.f(0.18, 0.24);
    const geo = new THREE.BoxGeometry(0.14, h, w);
    geo.translate(0, h / 2, 0);
    if (i === 3) geo.rotateZ(0.16);
    geo.translate(-0.28 + i * 0.055, 0.015, 0);
    col.setHex(R.pick([0x7a3b3b, 0x3b4a5a, 0x8a6b3a, 0x5a6b4a]));
    const n = geo.attributes.position.count;
    const ca = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) { ca[k * 3] = col.r; ca[k * 3 + 1] = col.g; ca[k * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(ca, 3));
    sb.push(geo);
  }
  const sbm = new THREE.Mesh(mergeGeometries(sb), M.book);
  sbm.castShadow = true;
  sh.add(sbm);
  scene.add(sh);
}

// clock above the door
let clockMinute, clockHour;
{
  const g = new THREE.Group();
  g.position.set(-1.8, 2.42, RZ - 0.02);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.035, 24), M.woodDark);
  rim.rotation.x = Math.PI / 2;
  g.add(rim);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.27),
    new THREE.MeshStandardMaterial({ map: clockFaceTexture(), roughness: 0.8 }));
  face.position.z = -0.019;
  face.rotation.y = Math.PI;
  g.add(face);
  const mkHand = (w, l) => {
    const geo = new THREE.BoxGeometry(w, l, 0.008);
    geo.translate(0, l / 2 - 0.012, 0);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.5 }));
    m.position.z = -0.026;
    return m;
  };
  clockMinute = mkHand(0.012, 0.11);
  clockHour = mkHand(0.016, 0.075);
  g.add(clockHour, clockMinute);
  scene.add(g);
}

// pendant lamp above the coffee table (part of the ceiling group)
let pendantLight;
const pendantGroup = new THREE.Group();
{
  pendantGroup.position.set(1.95, 0, 0);
  const rose = cyl(0.07, 0.09, 0.03, M.paint, 0, RH - 0.015, 0, { seg: 16, cast: false });
  pendantGroup.add(rose);
  pendantGroup.add(cyl(0.004, 0.004, 0.6, M.metal, 0, RH - 0.31, 0, { seg: 6, cast: false }));
  const shade = new THREE.Mesh(new THREE.SphereGeometry(0.17, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.shade.clone());
  shade.material.side = THREE.DoubleSide;
  shade.position.y = RH - 0.62;
  shade.castShadow = false;
  pendantGroup.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffcf90, emissiveIntensity: 2.4 }));
  bulb.position.y = RH - 0.66;
  pendantGroup.add(bulb);
  ceilingGroup.add(pendantGroup);
  pendantLight = new THREE.PointLight(0xffd2a0, 4, 6, 2);
  pendantLight.position.set(1.95, RH - 0.7, 0);
  ceilingGroup.add(pendantLight);
}

// ---------------------------------------------------------------------------
// Dust motes
// ---------------------------------------------------------------------------
{
  const n = 130;
  const base = new Float32Array(n * 3);
  const seed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (rand() < 0.55) { // around the fire
      base[i * 3] = R.f(2.0, 2.95);
      base[i * 3 + 1] = R.f(0.1, 1.7);
      base[i * 3 + 2] = R.f(-0.9, 0.9);
    } else { // drifting in from the window
      base[i * 3] = R.f(-1.1, 1.1);
      base[i * 3 + 1] = R.f(0.5, 2.3);
      base[i * 3 + 2] = R.f(-2.2, -1.1);
    }
    seed[i] = rand();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aBase', new THREE.BufferAttribute(base, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime },
    vertexShader: `
      uniform float uTime;
      attribute vec3 aBase; attribute float aSeed;
      varying float vA;
      void main() {
        vec3 p = aBase;
        float t = uTime * (0.05 + 0.09 * fract(aSeed * 5.13));
        p.x += sin(t * 6.28 + aSeed * 40.0) * 0.14;
        p.y += sin(t * 4.7 + aSeed * 31.0) * 0.12 + sin(uTime * 0.25 + aSeed * 7.0) * 0.06;
        p.z += cos(t * 5.3 + aSeed * 23.0) * 0.14;
        vA = 0.45 + 0.55 * sin(uTime * 0.7 + aSeed * 50.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (1.1 + 1.9 * fract(aSeed * 9.31)) * (4.0 / max(0.1, -mv.z));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.1, d) * vA * 0.16;
        gl_FragColor = vec4(1.0, 0.85, 0.6, a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(geo, mat);
  pts.renderOrder = 6;
  pts.frustumCulled = false;
  scene.add(pts);
}

// ---------------------------------------------------------------------------
// Lights
// ---------------------------------------------------------------------------
const hemiLight = new THREE.HemisphereLight(0x3d4a6e, 0x4a382b, 1.0);
scene.add(hemiLight);
// faint warm fill so shadowed corners still read
const fillLight = new THREE.PointLight(0xffd9b0, 2.3, 9, 2);
fillLight.position.set(-0.4, 1.9, 0.6);
scene.add(fillLight);
// soft overhead light, used only for the top-down layout view
const topLight = new THREE.PointLight(0xfff0dd, 0, 40, 2);
topLight.position.set(0, 8, 0);
scene.add(topLight);

const lightLevels = { hemi: 1.0, fire: 20, lamp: 8, fill: 2.3, top: 0 };

const windowLight = new THREE.RectAreaLight(0x7d97d8, 5, 1.6, 1.2);
windowLight.position.set(0, 1.5, -RZ + 0.02);
windowLight.lookAt(0, 1.1, 0);
scene.add(windowLight);

const moonLight = new THREE.PointLight(0x8fa8e8, 2.5, 5, 2);
moonLight.position.set(0.4, 1.7, -RZ - 0.45);
scene.add(moonLight);

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
const DOOR_CAM_POS = new THREE.Vector3(-1.65, 1.6, 1.92);
const DOOR_TARGET = new THREE.Vector3(0.75, 1.2, -0.55);
const TOP_TARGET = new THREE.Vector3(0, 0, 0);

function frameTopCamera() {
  const a = window.innerWidth / Math.max(1, window.innerHeight);
  const halfH = Math.max(2.95, 3.65 / a);
  orthoCam.left = -halfH * a;
  orthoCam.right = halfH * a;
  orthoCam.top = halfH;
  orthoCam.bottom = -halfH;
  orthoCam.updateProjectionMatrix();
}
function framePerspCamera() {
  perspCam.aspect = window.innerWidth / Math.max(1, window.innerHeight);
  perspCam.updateProjectionMatrix();
}

const btnDoor = document.getElementById('btn-door');
const btnTop = document.getElementById('btn-top');
let currentView = 'door';

function setView(name) {
  currentView = name;
  if (name === 'top') {
    activeCam = orthoCam;
    activeControls = controlsTop;
    ceilingGroup.visible = false; // hide ceiling (+ pendant) so the layout reads
    Object.assign(lightLevels, { hemi: 1.2, fire: 6, lamp: 4, fill: 2, top: 130 });
    fireLight.castShadow = false;
    lampLight.castShadow = false;
    orthoCam.position.set(0, 10, 0);
    orthoCam.up.set(0, 0, -1);
    orthoCam.lookAt(TOP_TARGET);
    controlsTop.target.copy(TOP_TARGET);
    frameTopCamera();
  } else {
    activeCam = perspCam;
    activeControls = controlsDoor;
    ceilingGroup.visible = true;
    Object.assign(lightLevels, { hemi: 1.0, fire: 20, lamp: 8, fill: 2.3, top: 0 });
    fireLight.castShadow = true;
    lampLight.castShadow = true;
    perspCam.position.copy(DOOR_CAM_POS);
    controlsDoor.target.copy(DOOR_TARGET);
    framePerspCamera();
  }
  controlsDoor.enabled = name !== 'top';
  controlsTop.enabled = name === 'top';
  controlsDoor.update();
  controlsTop.update();
  btnDoor.classList.toggle('active', name !== 'top');
  btnTop.classList.toggle('active', name === 'top');
  // sync the URL without a reload
  const url = new URL(window.location);
  url.searchParams.set('view', name);
  history.replaceState(null, '', url);
}
btnDoor.addEventListener('click', () => setView('door'));
btnTop.addEventListener('click', () => setView('top'));

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  framePerspCamera();
  frameTopCamera();
}
window.addEventListener('resize', onResize);

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------
const clock = new THREE.Timer();
const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function tick() {
  clock.update();
  const t = clock.getElapsed();
  uTime.value = t;

  // door eases open after a beat
  const dp = easeInOutCubic(clamp01((t - 0.9) / 2.4));
  doorGroup.rotation.y = 1.396 * dp;

  // fire flicker
  const f = 0.72 * Math.sin(7.3 * t + 1.3) + 0.2 * Math.sin(15.7 * t + 0.4) + 0.08 * Math.sin(27.9 * t + 2.0);
  const fl = 1 + 0.4 * f;
  fireLight.intensity = lightLevels.fire * fl;
  fireGlow.scale.set(1.1 * (0.9 + 0.18 * f), 1.1 * (0.9 + 0.18 * f), 1);
  fireFloorGlow.material.opacity = 0.5 * (0.85 + 0.2 * f);

  // lamp: steady with a whisper of life
  lampLight.intensity = lightLevels.lamp * (1 + 0.02 * Math.sin(3.7 * t));
  hemiLight.intensity = lightLevels.hemi;
  fillLight.intensity = lightLevels.fill;
  topLight.intensity = lightLevels.top;
  // cat breathing
  if (catBody) catBody.scale.y = 0.62 * (1 + 0.045 * Math.sin(t * 1.1));
  // clock hands (a slow evening; positive angle = clockwise as seen from the room)
  if (clockMinute) {
    clockMinute.rotation.z = ((30 + t * 6) * Math.PI) / 180;
    clockHour.rotation.z = ((242.5 + t * 0.1) * Math.PI) / 180;
  }

  if (activeControls) activeControls.update();
  renderer.render(scene, activeCam);
}

// ---------------------------------------------------------------------------
// Go
// ---------------------------------------------------------------------------
onResize();
const initialView = new URLSearchParams(window.location.search).get('view');
setView(initialView === 'top' ? 'top' : 'door');
renderer.setAnimationLoop(tick);

// fade the hint after a while
setTimeout(() => { const h = document.getElementById('hint'); if (h) h.style.opacity = '0.3'; }, 9000);
