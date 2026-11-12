import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* --------------------------------------------------------------------------
   A cosy reading room, built from a simple plan.
   North is -z, east is +x, y is up.  All dimensions are metres, and the
   origin is the centre of the room floor.
-------------------------------------------------------------------------- */

const ROOM = {
  w: 6.0,
  d: 4.5,
  h: 2.7,
  wall: 0.16,
};
const EAST = ROOM.w / 2;
const WEST = -ROOM.w / 2;
const NORTH = -ROOM.d / 2;
const SOUTH = ROOM.d / 2;

const DOOR = {
  cx: -1.8,
  w: 0.9,
  h: 2.05,
};
DOOR.west = DOOR.cx - DOOR.w / 2;
DOOR.east = DOOR.cx + DOOR.w / 2;

const WINDOW = {
  cx: 0,
  w: 1.6,
  sill: 0.9,
  h: 1.25,
};
WINDOW.top = WINDOW.sill + WINDOW.h;

const FIREPLACE = {
  z: 0,
  openingW: 1.0,
  openingH: 0.82,
  frontX: 2.86,
  hearthFrontX: 2.78,
};

/* ------------------------------ helpers -------------------------------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20261112);

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function colorTexture(canvas, repeatX = 1, repeatY = 1, clamp = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (clamp) {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  } else {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

/* ------------------------------ textures ------------------------------- */

function makeFloorTexture() {
  const c = canvas2d(1024, 1024);
  const g = c.getContext('2d');
  const r = mulberry32(8231);

  g.fillStyle = '#8b6138';
  g.fillRect(0, 0, 1024, 1024);

  const plankColors = ['#96683e', '#8e6138', '#a07344', '#80552e', '#9b6b3d', '#8a5f34'];
  let y = 0;
  while (y < 1024) {
    const h = Math.round(60 + r() * 28);
    const base = plankColors[Math.floor(r() * plankColors.length)];
    g.fillStyle = base;
    g.fillRect(0, y, 1024, h);

    // Soft tonal variation down the length of the board.
    const grad = g.createLinearGradient(0, y, 1024, y);
    grad.addColorStop(0, 'rgba(255,255,255,0.015)');
    grad.addColorStop(0.35 + r() * 0.2, 'rgba(255,255,255,0.08)');
    grad.addColorStop(0.7, 'rgba(40,22,10,0.06)');
    grad.addColorStop(1, 'rgba(255,255,255,0.01)');
    g.fillStyle = grad;
    g.fillRect(0, y, 1024, h);

    // Long grain strokes.
    for (let i = 0; i < 16; i++) {
      const gy = y + 5 + r() * (h - 10);
      g.strokeStyle = r() > 0.48 ? `rgba(48,29,16,${0.10 + r() * 0.15})` : `rgba(255,224,186,${0.06 + r() * 0.07})`;
      g.lineWidth = 0.7 + r() * 1.4;
      g.beginPath();
      g.moveTo(-20, gy);
      const steps = 4;
      for (let s = 1; s <= steps; s++) {
        const x = (1024 + 40) * (s / steps) - 20;
        g.lineTo(x, gy + Math.sin((x / 1024) * Math.PI * (2 + r() * 3) + i) * (0.8 + r() * 2.2));
      }
      g.stroke();
    }

    // Board ends.
    let sx = 30 + r() * 180;
    while (sx < 1024) {
      g.fillStyle = 'rgba(48,30,17,0.52)';
      g.fillRect(sx, y, 1.5, h);
      g.fillStyle = 'rgba(255,226,190,0.10)';
      g.fillRect(sx + 2, y, 1, h);
      sx += 210 + r() * 280;
    }

    // Shadow gap between boards.
    g.fillStyle = 'rgba(43,26,14,0.60)';
    g.fillRect(0, y + h - 2, 1024, 2);
    y += h;
  }

  // Fine saw marks and dust.
  for (let i = 0; i < 2400; i++) {
    const x = r() * 1024;
    const yy = r() * 1024;
    g.fillStyle = r() > 0.55 ? 'rgba(255,228,198,0.035)' : 'rgba(40,24,12,0.05)';
    g.fillRect(x, yy, 1 + r() * 2.5, 0.6 + r() * 1.2);
  }

  return colorTexture(c, 2.0, 1.5, false);
}

function makePlasterTexture() {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  const r = mulberry32(4417);
  g.fillStyle = '#e7ddca';
  g.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 70; i++) {
    const x = r() * 512;
    const y = r() * 512;
    const rad = 25 + r() * 100;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    const warm = r() > 0.45;
    grad.addColorStop(0, warm ? 'rgba(190,160,124,0.055)' : 'rgba(255,255,250,0.10)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }

  for (let i = 0; i < 10000; i++) {
    const x = r() * 512;
    const y = r() * 512;
    g.fillStyle = r() > 0.5 ? 'rgba(120,92,63,0.025)' : 'rgba(255,248,236,0.035)';
    g.fillRect(x, y, 1.2, 1.2);
  }
  return colorTexture(c, 2.0, 2.0, false);
}

function makeRugTexture() {
  const c = canvas2d(512, 768);
  const g = c.getContext('2d');
  const r = mulberry32(9163);

  g.fillStyle = '#293a48';
  g.fillRect(0, 0, 512, 768);

  g.fillStyle = '#a65a40';
  g.fillRect(18, 18, 476, 732);

  // Border bands.
  g.strokeStyle = '#d8c39e';
  g.lineWidth = 5;
  g.strokeRect(30, 30, 452, 708);
  g.strokeStyle = '#c68c58';
  g.lineWidth = 2;
  g.strokeRect(42, 42, 428, 684);

  // Small repeating marks along the border.
  g.fillStyle = '#dfcca8';
  for (let z = 60; z < 720; z += 42) {
    for (const x of [22, 490]) {
      g.save();
      g.translate(x, z);
      g.rotate(Math.PI / 4);
      g.fillRect(-4, -4, 8, 8);
      g.restore();
    }
  }

  // The field has a quiet diamond lattice.
  g.strokeStyle = 'rgba(228,209,177,0.28)';
  g.lineWidth = 1.2;
  const stepX = 47;
  const stepY = 54;
  for (let row = -1; row < 17; row++) {
    for (let col = -1; col < 12; col++) {
      const cx = col * stepX + (row % 2 ? stepX / 2 : 0) + 10;
      const cy = row * stepY + 42;
      g.beginPath();
      g.moveTo(cx, cy - 13);
      g.lineTo(cx + 13, cy);
      g.lineTo(cx, cy + 13);
      g.lineTo(cx - 13, cy);
      g.closePath();
      g.stroke();
    }
  }

  // Central medallion.
  const cx = 256;
  const cy = 384;
  function diamond(radiusX, radiusY, fill, stroke, lineWidth = 2) {
    g.beginPath();
    g.moveTo(cx, cy - radiusY);
    g.lineTo(cx + radiusX, cy);
    g.lineTo(cx, cy + radiusY);
    g.lineTo(cx - radiusX, cy);
    g.closePath();
    if (fill) {
      g.fillStyle = fill;
      g.fill();
    }
    if (stroke) {
      g.strokeStyle = stroke;
      g.lineWidth = lineWidth;
      g.stroke();
    }
  }

  diamond(118, 154, '#2c3c49', null);
  diamond(108, 144, '#a65a40', '#d9c7a4', 4);
  diamond(82, 112, '#c88c58', '#e6d5b7', 3);
  diamond(57, 83, '#293a48', '#d1ba94', 2);
  diamond(29, 45, '#e0cdaa', null);
  diamond(13, 20, '#9e5a44', null);

  // Four corner stars.
  for (const [sx, sy] of [[88, 126], [424, 126], [88, 642], [424, 642]]) {
    g.save();
    g.translate(sx, sy);
    g.strokeStyle = '#e0cca7';
    g.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.beginPath();
      g.moveTo(Math.cos(a) * 7, Math.sin(a) * 8);
      g.lineTo(Math.cos(a) * 20, Math.sin(a) * 25);
      g.stroke();
    }
    g.fillStyle = '#d9c39b';
    g.beginPath();
    g.arc(0, 0, 6, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // Weave texture.
  for (let i = 0; i < 6000; i++) {
    const x = 20 + r() * 472;
    const y = 20 + r() * 728;
    g.fillStyle = r() > 0.5 ? 'rgba(255,245,226,0.035)' : 'rgba(35,20,16,0.05)';
    g.fillRect(x, y, 1.5 + r() * 2, 0.8);
  }

  return colorTexture(c, 1, 1, true);
}

function makeWoodTexture() {
  const c = canvas2d(512, 512);
  const g = c.getContext('2d');
  const r = mulberry32(6039);
  g.fillStyle = '#8f6749';
  g.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 90; i++) {
    const y = r() * 512;
    g.strokeStyle = r() > 0.5 ? `rgba(55,35,21,${0.06 + r() * 0.16})` : `rgba(214,178,137,${0.04 + r() * 0.11})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    g.moveTo(-10, y);
    for (let x = 0; x <= 520; x += 80) {
      g.lineTo(x, y + Math.sin(x * 0.02 + i) * (0.8 + r() * 2.8));
    }
    g.stroke();
  }

  for (let i = 0; i < 7; i++) {
    const x = 40 + r() * 430;
    const y = 40 + r() * 430;
    g.strokeStyle = 'rgba(55,32,20,0.20)';
    g.lineWidth = 1.2;
    g.beginPath();
    g.ellipse(x, y, 7 + r() * 12, 2 + r() * 4, r() * Math.PI, 0, Math.PI * 2);
    g.stroke();
  }

  for (let i = 0; i < 1200; i++) {
    g.fillStyle = r() > 0.5 ? 'rgba(255,228,194,0.035)' : 'rgba(42,24,14,0.03)';
    g.fillRect(r() * 512, r() * 512, 1 + r() * 3, 0.7);
  }

  return colorTexture(c, 1.6, 1.6, false);
}

function makeOutsideTexture() {
  const c = canvas2d(1024, 560);
  const g = c.getContext('2d');
  const r = mulberry32(2419);

  const sky = g.createLinearGradient(0, 0, 0, 560);
  sky.addColorStop(0, '#182234');
  sky.addColorStop(0.34, '#45526a');
  sky.addColorStop(0.62, '#9d7d72');
  sky.addColorStop(0.76, '#dca35f');
  sky.addColorStop(1, '#4a4b3f');
  g.fillStyle = sky;
  g.fillRect(0, 0, 1024, 560);

  // A pale sun sinking behind the hills.
  const sunX = 620;
  const sunY = 335;
  const glow = g.createRadialGradient(sunX, sunY, 4, sunX, sunY, 180);
  glow.addColorStop(0, 'rgba(255,227,170,0.88)');
  glow.addColorStop(0.25, 'rgba(230,185,122,0.35)');
  glow.addColorStop(1, 'rgba(230,185,122,0)');
  g.fillStyle = glow;
  g.fillRect(sunX - 180, sunY - 180, 360, 360);
  g.fillStyle = 'rgba(255,224,172,0.9)';
  g.beginPath();
  g.arc(sunX, sunY, 16, 0, Math.PI * 2);
  g.fill();

  // Distant hills.
  g.fillStyle = '#37413f';
  g.beginPath();
  g.moveTo(-20, 360);
  g.lineTo(130, 290);
  g.lineTo(265, 350);
  g.lineTo(410, 310);
  g.lineTo(565, 380);
  g.lineTo(730, 312);
  g.lineTo(880, 355);
  g.lineTo(1044, 300);
  g.lineTo(1044, 560);
  g.lineTo(-20, 560);
  g.closePath();
  g.fill();

  g.fillStyle = '#24322e';
  g.beginPath();
  g.moveTo(-20, 420);
  g.lineTo(190, 380);
  g.lineTo(340, 425);
  g.lineTo(520, 400);
  g.lineTo(660, 440);
  g.lineTo(810, 402);
  g.lineTo(1044, 430);
  g.lineTo(1044, 560);
  g.lineTo(-20, 560);
  g.closePath();
  g.fill();

  // Silhouetted pines and hedgerow at the edges.
  function pine(x, baseY, height, color) {
    g.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      const w = (height - i * height * 0.2) * 0.24;
      const top = baseY - height + i * height * 0.19;
      const bottom = baseY - height * 0.22;
      g.beginPath();
      g.moveTo(x, top);
      g.lineTo(x + w, bottom);
      g.lineTo(x - w, bottom);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#1d2824';
    g.fillRect(x - 2, baseY - height * 0.18, 4, height * 0.18);
  }

  pine(92, 455, 190, '#1e2d28');
  pine(135, 470, 150, '#22312a');
  pine(860, 450, 230, '#1e2d28');
  pine(924, 470, 180, '#22312a');
  pine(980, 470, 155, '#1c2925');

  g.fillStyle = '#17201c';
  for (let i = 0; i < 42; i++) {
    const x = r() * 1024;
    const y = 460 + r() * 70;
    const rad = 8 + r() * 22;
    g.beginPath();
    g.ellipse(x, y, rad, rad * (0.45 + r() * 0.25), 0, 0, Math.PI * 2);
    g.fill();
  }

  // A few tiny warm lights in the valley.
  g.fillStyle = 'rgba(255,205,128,0.65)';
  for (let i = 0; i < 12; i++) {
    g.fillRect(180 + r() * 650, 440 + r() * 50, 2, 2);
  }

  return colorTexture(c, 1, 1, true);
}

function makeArtTexture() {
  const c = canvas2d(360, 420);
  const g = c.getContext('2d');
  const r = mulberry32(7784);

  g.fillStyle = '#e9dfca';
  g.fillRect(0, 0, 360, 420);

  const grad = g.createLinearGradient(0, 40, 0, 380);
  grad.addColorStop(0, '#d9c8a7');
  grad.addColorStop(0.55, '#d7a778');
  grad.addColorStop(1, '#7b8c76');
  g.fillStyle = grad;
  g.fillRect(30, 42, 300, 256);

  g.fillStyle = '#bd724f';
  g.beginPath();
  g.arc(214, 166, 39, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(237,213,172,0.6)';
  g.beginPath();
  g.arc(203, 157, 17, 0, Math.PI * 2);
  g.fill();

  g.fillStyle = '#657562';
  g.beginPath();
  g.moveTo(26, 258);
  g.lineTo(104, 195);
  g.lineTo(170, 242);
  g.lineTo(251, 205);
  g.lineTo(334, 248);
  g.lineTo(334, 298);
  g.lineTo(26, 298);
  g.closePath();
  g.fill();

  g.fillStyle = '#39493f';
  g.beginPath();
  g.moveTo(26, 286);
  g.lineTo(134, 256);
  g.lineTo(211, 282);
  g.lineTo(280, 263);
  g.lineTo(334, 290);
  g.lineTo(334, 298);
  g.lineTo(26, 298);
  g.closePath();
  g.fill();

  // A small ink-like tree.
  g.strokeStyle = '#3b3329';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(72, 294);
  g.quadraticCurveTo(72, 250, 88, 221);
  g.stroke();
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i - 3.5) * 0.24;
    g.beginPath();
    g.moveTo(88, 221 + i * 5);
    g.lineTo(88 + Math.cos(a) * (16 + r() * 12), 221 + i * 5 + Math.sin(a) * (14 + r() * 9));
    g.stroke();
  }

  g.fillStyle = 'rgba(56,45,33,0.5)';
  g.font = 'italic 14px Georgia';
  g.fillText('an evening by the fire', 96, 358);
  g.fillStyle = 'rgba(56,45,33,0.35)';
  g.fillRect(80, 333, 200, 1);

  return colorTexture(c, 1, 1, true);
}

/* ------------------------------ renderer -------------------------------- */

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x19130e);

/* ------------------------------ materials ------------------------------- */

const floorTex = makeFloorTexture();
const plasterTex = makePlasterTexture();
const rugTex = makeRugTexture();
const woodTex = makeWoodTexture();
const outsideTex = makeOutsideTexture();
const artTex = makeArtTexture();

const mats = {
  floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.63, metalness: 0.02 }),
  plaster: new THREE.MeshStandardMaterial({ map: plasterTex, roughness: 0.96, metalness: 0.0 }),
  ceiling: new THREE.MeshStandardMaterial({ color: 0xe2d7c4, roughness: 0.98 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xe9e1d1, roughness: 0.82 }),
  oak: new THREE.MeshStandardMaterial({ map: woodTex, color: 0xe6d1b8, roughness: 0.58 }),
  walnut: new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8b7057, roughness: 0.6 }),
  darkWood: new THREE.MeshStandardMaterial({ map: woodTex, color: 0x6c5240, roughness: 0.68 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xb48644, roughness: 0.28, metalness: 0.78 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xb9ad9e, roughness: 0.9, metalness: 0.01 }),
  hearth: new THREE.MeshStandardMaterial({ color: 0x9c9185, roughness: 0.78 }),
  darkStone: new THREE.MeshStandardMaterial({ color: 0x17110e, roughness: 0.96 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x292421, roughness: 0.52, metalness: 0.6 }),
  moss: new THREE.MeshPhysicalMaterial({
    color: 0x526956,
    roughness: 0.84,
    sheen: 1.0,
    sheenColor: new THREE.Color(0xadb8a3),
    sheenRoughness: 0.75,
  }),
  mossDark: new THREE.MeshPhysicalMaterial({
    color: 0x435747,
    roughness: 0.9,
    sheen: 0.7,
    sheenColor: new THREE.Color(0x8d9f8d),
    sheenRoughness: 0.7,
  }),
  leather: new THREE.MeshStandardMaterial({ color: 0x95563a, roughness: 0.67 }),
  leatherDark: new THREE.MeshStandardMaterial({ color: 0x794331, roughness: 0.8 }),
  mustard: new THREE.MeshStandardMaterial({ color: 0xb68342, roughness: 0.9 }),
  rust: new THREE.MeshStandardMaterial({ color: 0xa75c43, roughness: 0.92 }),
  rug: new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.94, metalness: 0.0 }),
  linen: new THREE.MeshStandardMaterial({ color: 0x9b745b, roughness: 0.98, side: THREE.DoubleSide }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xd8cbb8, roughness: 0.56 }),
  ceramicBlue: new THREE.MeshStandardMaterial({ color: 0x52696a, roughness: 0.52 }),
  candle: new THREE.MeshStandardMaterial({ color: 0xf2e5cf, roughness: 0.82 }),
  glass: new THREE.MeshPhysicalMaterial({
    color: 0xb5ccd2,
    transparent: true,
    opacity: 0.23,
    roughness: 0.05,
    metalness: 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  }),
  outside: new THREE.MeshBasicMaterial({ map: outsideTex, toneMapped: false }),
  art: new THREE.MeshBasicMaterial({ map: artTex, toneMapped: false }),
  mirror: new THREE.MeshStandardMaterial({ color: 0x8f9b97, roughness: 0.12, metalness: 0.9 }),
  green: new THREE.MeshStandardMaterial({ color: 0x44604b, roughness: 0.82 }),
};

const room = new THREE.Group();
scene.add(room);

// The door header is lifted away in the plan view so the doorway reads clearly.
const planDoorHeaders = [];

/* ------------------------------ geometry -------------------------------- */

function box(parent, mat, w, h, d, x, y, z, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function rounded(parent, mat, w, h, d, x, y, z, radius = 0.035, opts = {}) {
  const geo = new RoundedBoxGeometry(w, h, d, 3, radius);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, mat, radiusTop, radiusBottom, h, x, y, z, opts = {}) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, h, opts.segments ?? 24, 1, opts.open ?? false);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (opts.rx) mesh.rotation.x = opts.rx;
  if (opts.ry) mesh.rotation.y = opts.ry;
  if (opts.rz) mesh.rotation.z = opts.rz;
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = opts.receiveShadow ?? true;
  parent.add(mesh);
  return mesh;
}

/* -------------------------------- room ---------------------------------- */

// Floor.
{
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.001;
  floor.receiveShadow = true;
  room.add(floor);

  // A thin structural slab just below the floor, so walls sit on something.
  box(room, mats.darkWood, ROOM.w + ROOM.wall * 2, 0.08, ROOM.d + ROOM.wall * 2, 0, -0.045, 0, {
    castShadow: false,
    receiveShadow: false,
  });
}

const ceilingGroup = new THREE.Group();
room.add(ceilingGroup);

// Ceiling.
{
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), mats.ceiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM.h;
  ceiling.receiveShadow = true;
  ceilingGroup.add(ceiling);

  // Simple exposed beams give the room a cottage feel.
  for (const x of [-1.65, 1.65]) {
    box(ceilingGroup, mats.oak, 0.075, 0.08, ROOM.d, x, ROOM.h - 0.08, 0);
  }
  // Small brass ceiling hooks for the pendant.
  cylinder(ceilingGroup, mats.brass, 0.025, 0.025, 0.03, 0, ROOM.h - 0.015, -0.25);
}

// Walls.  All interior faces land exactly on the plan boundaries.
{
  const t = ROOM.wall;
  // West and east.
  box(room, mats.plaster, t, ROOM.h, ROOM.d, WEST - t / 2, ROOM.h / 2, 0);
  box(room, mats.plaster, t, ROOM.h, ROOM.d, EAST + t / 2, ROOM.h / 2, 0);

  // North wall, with a window opening.
  const winL = WINDOW.cx - WINDOW.w / 2;
  const winR = WINDOW.cx + WINDOW.w / 2;
  box(room, mats.plaster, winL - WEST, ROOM.h, t, (WEST + winL) / 2, ROOM.h / 2, NORTH - t / 2);
  box(room, mats.plaster, EAST - winR, ROOM.h, t, (EAST + winR) / 2, ROOM.h / 2, NORTH - t / 2);
  box(room, mats.plaster, WINDOW.w, WINDOW.sill, t, 0, WINDOW.sill / 2, NORTH - t / 2);
  box(room, mats.plaster, WINDOW.w, ROOM.h - WINDOW.top, t, 0, (WINDOW.top + ROOM.h) / 2, NORTH - t / 2);

  // South wall, with the door opening.
  box(room, mats.plaster, DOOR.west - WEST, ROOM.h, t, (WEST + DOOR.west) / 2, ROOM.h / 2, SOUTH + t / 2);
  box(room, mats.plaster, EAST - DOOR.east, ROOM.h, t, (EAST + DOOR.east) / 2, ROOM.h / 2, SOUTH + t / 2);
  planDoorHeaders.push(
    box(room, mats.plaster, DOOR.w, ROOM.h - DOOR.h, t, DOOR.cx, (DOOR.h + ROOM.h) / 2, SOUTH + t / 2)
  );

  // Baseboards.
  box(room, mats.trim, ROOM.w, 0.12, 0.035, 0, 0.06, NORTH + 0.018);
  box(room, mats.trim, DOOR.west - WEST, 0.12, 0.035, (WEST + DOOR.west) / 2, 0.06, SOUTH - 0.018);
  box(room, mats.trim, EAST - DOOR.east, 0.12, 0.035, (EAST + DOOR.east) / 2, 0.06, SOUTH - 0.018);
  box(room, mats.trim, 0.035, 0.12, ROOM.d, WEST + 0.018, 0.06, 0);
  box(room, mats.trim, 0.035, 0.12, ROOM.d, EAST - 0.018, 0.06, 0);

  // Picture rail / crown trim.
  box(room, mats.trim, ROOM.w, 0.045, 0.04, 0, ROOM.h - 0.08, NORTH + 0.02);
  box(room, mats.trim, ROOM.w, 0.045, 0.04, 0, ROOM.h - 0.08, SOUTH - 0.02);
  box(room, mats.trim, 0.04, 0.045, ROOM.d, WEST + 0.02, ROOM.h - 0.08, 0);
  box(room, mats.trim, 0.04, 0.045, ROOM.d, EAST - 0.02, ROOM.h - 0.08, 0);
}

/* -------------------------------- door ---------------------------------- */

const doorGroup = new THREE.Group();
room.add(doorGroup);

{
  // Casings on the room side of the wall.
  box(doorGroup, mats.oak, 0.07, DOOR.h + 0.12, 0.06, DOOR.west - 0.025, (DOOR.h + 0.12) / 2, SOUTH - 0.04);
  box(doorGroup, mats.oak, 0.07, DOOR.h + 0.12, 0.06, DOOR.east + 0.025, (DOOR.h + 0.12) / 2, SOUTH - 0.04);
  planDoorHeaders.push(
    box(doorGroup, mats.oak, DOOR.w + 0.12, 0.07, 0.06, DOOR.cx, DOOR.h + 0.055, SOUTH - 0.04)
  );

  // Threshold.
  box(doorGroup, mats.darkWood, DOOR.w, 0.018, 0.10, DOOR.cx, 0.009, SOUTH - 0.06, {
    castShadow: false,
  });

  // Hinged leaf.  The pivot sits at the west jamb, and the door is open inward.
  const hinge = new THREE.Group();
  hinge.position.set(DOOR.west, 0, SOUTH - 0.035);
  hinge.rotation.y = THREE.MathUtils.degToRad(82);
  doorGroup.add(hinge);

  const leafW = 0.88;
  const leafH = 2.02;
  const leafT = 0.045;
  box(hinge, mats.oak, leafW, leafH, leafT, leafW / 2, leafH / 2, 0);

  // Raised panels, present on both faces.
  const panelMat = mats.walnut;
  for (const side of [-1, 1]) {
    const zz = side * (leafT / 2 + 0.007);
    box(hinge, panelMat, 0.30, 0.66, 0.014, leafW / 2 - 0.19, 1.42, zz);
    box(hinge, panelMat, 0.30, 0.66, 0.014, leafW / 2 + 0.19, 1.42, zz);
    box(hinge, panelMat, 0.30, 0.70, 0.014, leafW / 2 - 0.19, 0.58, zz);
    box(hinge, panelMat, 0.30, 0.70, 0.014, leafW / 2 + 0.19, 0.58, zz);
  }

  // Brass lever handles.
  for (const side of [-1, 1]) {
    const zz = side * (leafT / 2 + 0.035);
    cylinder(hinge, mats.brass, 0.018, 0.018, 0.025, leafW - 0.09, 1.04, zz, {
      rx: Math.PI / 2,
      segments: 16,
    });
    box(hinge, mats.brass, 0.11, 0.022, 0.022, leafW - 0.145, 1.04, zz, {
      castShadow: false,
    });
  }

  // Hinge plates.
  for (const yy of [0.38, 1.68]) {
    cylinder(hinge, mats.brass, 0.024, 0.024, 0.11, 0.01, yy, leafT / 2 + 0.006, {
      segments: 16,
    });
    cylinder(hinge, mats.brass, 0.024, 0.024, 0.11, 0.01, yy, -leafT / 2 - 0.006, {
      segments: 16,
    });
  }
}

/* ------------------------------- window --------------------------------- */

const windowGroup = new THREE.Group();
room.add(windowGroup);

{
  const winL = WINDOW.cx - WINDOW.w / 2;
  const winR = WINDOW.cx + WINDOW.w / 2;
  const glassZ = NORTH - ROOM.wall / 2;

  // Glass and frame within the opening.
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(WINDOW.w - 0.06, WINDOW.h - 0.06), mats.glass);
  glass.position.set(WINDOW.cx, WINDOW.sill + WINDOW.h / 2, glassZ);
  glass.castShadow = false;
  glass.receiveShadow = false;
  windowGroup.add(glass);

  const frameDepth = ROOM.wall * 0.8;
  box(windowGroup, mats.oak, 0.055, WINDOW.h, frameDepth, winL + 0.0275, WINDOW.sill + WINDOW.h / 2, glassZ);
  box(windowGroup, mats.oak, 0.055, WINDOW.h, frameDepth, winR - 0.0275, WINDOW.sill + WINDOW.h / 2, glassZ);
  box(windowGroup, mats.oak, WINDOW.w, 0.055, frameDepth, WINDOW.cx, WINDOW.sill + 0.0275, glassZ);
  box(windowGroup, mats.oak, WINDOW.w, 0.055, frameDepth, WINDOW.cx, WINDOW.top - 0.0275, glassZ);
  box(windowGroup, mats.oak, 0.04, WINDOW.h, frameDepth, WINDOW.cx, WINDOW.sill + WINDOW.h / 2, glassZ);
  box(windowGroup, mats.oak, WINDOW.w, 0.04, frameDepth, WINDOW.cx, WINDOW.sill + WINDOW.h / 2, glassZ);

  // Interior sill.
  box(windowGroup, mats.oak, WINDOW.w + 0.20, 0.055, 0.18, WINDOW.cx, WINDOW.sill - 0.023, NORTH + 0.09);

  // Curtain rod.
  cylinder(windowGroup, mats.brass, 0.014, 0.014, WINDOW.w + 1.10, WINDOW.cx, WINDOW.top + 0.15, NORTH + 0.085, {
    rz: Math.PI / 2,
    segments: 12,
  });
  for (const x of [-WINDOW.w / 2 - 0.54, WINDOW.w / 2 + 0.54]) {
    cylinder(windowGroup, mats.brass, 0.035, 0.035, 0.03, x, WINDOW.top + 0.15, NORTH + 0.085, {
      segments: 14,
    });
  }
  // Brackets connecting the rod to the wall.
  for (const x of [-1.24, 1.24]) {
    box(windowGroup, mats.brass, 0.025, 0.025, 0.085, x, WINDOW.top + 0.15, NORTH + 0.0425, {
      castShadow: false,
    });
  }

  // Gently pleated linen curtains flanking the window.
  const curtainMesh = [];
  function curtainPanel(centerX, width, seed) {
    const rr = mulberry32(seed);
    const geo = new THREE.PlaneGeometry(width, 2.27, 18, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const fold = Math.sin((x / width) * Math.PI * 7 + rr() * 0.2) * 0.028;
      pos.setZ(i, fold + Math.cos(y * 2.1) * 0.006);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mats.linen);
    mesh.position.set(centerX, WINDOW.top + 0.15 - 2.27 / 2, NORTH + 0.075);
    mesh.userData.baseX = centerX;
    mesh.userData.baseZ = NORTH + 0.075;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    windowGroup.add(mesh);
    curtainMesh.push(mesh);
  }
  curtainPanel(-WINDOW.w / 2 - 0.25, 0.38, 444);
  curtainPanel(WINDOW.w / 2 + 0.25, 0.38, 445);
  windowGroup.userData.curtains = curtainMesh;

  // A warm, slightly hazy dusk beyond the glass.
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), mats.outside);
  outside.position.set(0, 1.75, NORTH - 2.3);
  outside.castShadow = false;
  outside.receiveShadow = false;
  windowGroup.add(outside);

  // Very faint dust motes in the window light.
  const motes = [];
  const moteGeo = new THREE.BufferGeometry();
  const positions = [];
  const mr = mulberry32(1229);
  for (let i = 0; i < 85; i++) {
    positions.push(
      WINDOW.cx + (mr() - 0.5) * 1.9,
      0.8 + mr() * 1.5,
      NORTH + 0.35 + mr() * 1.7
    );
    motes.push({
      x: positions[positions.length - 3],
      y: positions[positions.length - 2],
      z: positions[positions.length - 1],
    });
  }
  moteGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xffe9c7,
    size: 0.012,
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const motesMesh = new THREE.Points(moteGeo, moteMat);
  motesMesh.castShadow = false;
  windowGroup.add(motesMesh);
  windowGroup.userData.motes = motes;

  // Artworks flanking the window, on the north wall.
  function smallPrint(x, seed) {
    const rr = mulberry32(seed);
    const c = canvas2d(220, 280);
    const g = c.getContext('2d');
    g.fillStyle = '#e5dcc6';
    g.fillRect(0, 0, 220, 280);
    g.strokeStyle = '#6e5842';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 208, 268);
    g.fillStyle = '#8f9b82';
    g.fillRect(28, 45, 164, 140);
    g.fillStyle = '#c47d53';
    g.beginPath();
    g.arc(110, 118, 37, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#596c5b';
    g.beginPath();
    g.moveTo(28, 170);
    g.lineTo(72, 135);
    g.lineTo(117, 166);
    g.lineTo(158, 128);
    g.lineTo(192, 170);
    g.lineTo(192, 185);
    g.lineTo(28, 185);
    g.closePath();
    g.fill();
    for (let i = 0; i < 130; i++) {
      g.fillStyle = rr() > 0.45 ? 'rgba(40,30,20,0.06)' : 'rgba(255,248,230,0.08)';
      g.fillRect(10 + rr() * 200, 10 + rr() * 260, 1.5, 1);
    }
    const tex = colorTexture(c, 1, 1, true);
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const frame = new THREE.Group();
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.32), mat);
    art.position.set(x, 1.95, NORTH + 0.018);
    frame.add(art);
    box(frame, mats.oak, 0.32, 0.035, 0.025, x, 1.95 - 0.175, NORTH + 0.012);
    box(frame, mats.oak, 0.32, 0.035, 0.025, x, 1.95 + 0.175, NORTH + 0.012);
    box(frame, mats.oak, 0.035, 0.38, 0.025, x - 0.145, 1.95, NORTH + 0.012);
    box(frame, mats.oak, 0.035, 0.38, 0.025, x + 0.145, 1.95, NORTH + 0.012);
    return frame;
  }
  windowGroup.add(smallPrint(-1.48, 331));
  windowGroup.add(smallPrint(1.48, 332));
}

/* ------------------------------ fireplace ------------------------------- */

const fireplaceGroup = new THREE.Group();
room.add(fireplaceGroup);

{
  const front = FIREPLACE.frontX;
  const openingW = FIREPLACE.openingW;
  const openingH = FIREPLACE.openingH;
  const hearthFront = FIREPLACE.hearthFrontX;
  const chimneyDepth = EAST - front;
  const breastWidth = 1.9;

  // Stone hearth.
  box(fireplaceGroup, mats.hearth, EAST - hearthFront, 0.075, breastWidth - 0.24, (EAST + hearthFront) / 2, 0.0375, 0, {
    castShadow: true,
  });

  // Chimney breast, split around the firebox opening.
  box(
    fireplaceGroup,
    mats.stone,
    chimneyDepth,
    1.12,
    (breastWidth - openingW) / 2,
    front + chimneyDepth / 2,
    0.56,
    -(openingW / 2 + (breastWidth - openingW) / 4)
  );
  box(
    fireplaceGroup,
    mats.stone,
    chimneyDepth,
    1.12,
    (breastWidth - openingW) / 2,
    front + chimneyDepth / 2,
    0.56,
    openingW / 2 + (breastWidth - openingW) / 4
  );
  box(fireplaceGroup, mats.stone, chimneyDepth, 1.12 - openingH, openingW, front + chimneyDepth / 2, openingH + (1.12 - openingH) / 2, 0);
  box(fireplaceGroup, mats.stone, chimneyDepth, 2.25 - 1.12, breastWidth, front + chimneyDepth / 2, (1.12 + 2.25) / 2, 0);

  // Recessed firebox interior surfaces.
  box(fireplaceGroup, mats.darkStone, 0.01, openingH, openingW, EAST - 0.006, openingH / 2, 0);
  box(fireplaceGroup, mats.darkStone, chimneyDepth, openingH, 0.02, front + chimneyDepth / 2, openingH / 2, -openingW / 2 + 0.01);
  box(fireplaceGroup, mats.darkStone, chimneyDepth, openingH, 0.02, front + chimneyDepth / 2, openingH / 2, openingW / 2 - 0.01);
  box(fireplaceGroup, mats.darkStone, chimneyDepth, 0.018, openingW, front + chimneyDepth / 2, 0.01, 0);
  box(fireplaceGroup, mats.darkStone, chimneyDepth, 0.018, openingW, front + chimneyDepth / 2, openingH - 0.009, 0);

  // Mantel shelf.
  box(fireplaceGroup, mats.darkWood, 0.25, 0.075, breastWidth + 0.16, front - 0.07, 1.18, 0);
  box(fireplaceGroup, mats.brass, 0.012, 0.012, breastWidth + 0.16, front + 0.055, 1.2235, 0, {
    castShadow: false,
  });

  // A little framed picture above the mantel.
  const artFrame = new THREE.Group();
  const artMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.72), mats.art);
  artMesh.position.set(front - 0.002, 1.78, 0);
  artMesh.rotation.y = -Math.PI / 2;
  artFrame.add(artMesh);
  for (const dz of [-0.38, 0.38]) {
    box(artFrame, mats.darkWood, 0.045, 0.86, 0.045, front - 0.005, 1.78, dz);
  }
  for (const dy of [1.37, 2.19]) {
    box(artFrame, mats.darkWood, 0.045, 0.045, 0.80, front - 0.005, dy, 0);
  }
  fireplaceGroup.add(artFrame);

  // Objects on the mantel: candles and a little stack of books.
  // Mantel top is at y = 1.2175.
  for (const zz of [-0.64, 0.64]) {
    cylinder(fireplaceGroup, mats.brass, 0.025, 0.045, 0.19, front - 0.01, 1.3125, zz, { segments: 18 });
    cylinder(fireplaceGroup, mats.candle, 0.019, 0.019, 0.33, front - 0.01, 1.5725, zz, { segments: 16 });
    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffcf81, toneMapped: false })
    );
    flame.scale.y = 1.8;
    flame.position.set(front - 0.01, 1.755, zz);
    fireplaceGroup.add(flame);
  }
  box(fireplaceGroup, mats.rug, 0.13, 0.035, 0.20, front - 0.02, 1.235, 0.34);
  box(fireplaceGroup, mats.ceramicBlue, 0.12, 0.035, 0.18, front - 0.03, 1.27, 0.36);
  box(fireplaceGroup, mats.oak, 0.10, 0.028, 0.172, front - 0.015, 1.3015, 0.37);

  // Fire grate, resting on the hearth inside the recess.
  const grateY = 0.087;
  for (const xx of [front + 0.055, front + 0.105]) {
    cylinder(fireplaceGroup, mats.darkMetal, 0.012, 0.012, 0.90, xx, grateY, 0, {
      rx: Math.PI / 2,
      segments: 8,
    });
  }
  cylinder(fireplaceGroup, mats.darkMetal, 0.012, 0.012, 0.10, front + 0.08, grateY + 0.03, 0, {
    rz: Math.PI / 2,
    segments: 8,
  });
  for (const zz of [-0.35, 0.35]) {
    cylinder(fireplaceGroup, mats.darkMetal, 0.012, 0.012, 0.06, front + 0.08, 0.105, zz, { segments: 8 });
  }

  // Logs resting on and against one another above the grate.
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3b2b20, roughness: 0.97 });
  function log(x, y, z, len, rotY, rotZ) {
    const geo = new THREE.CylinderGeometry(0.037, 0.041, len, 10);
    const m = new THREE.Mesh(geo, logMat);
    m.position.set(x, y, z);
    m.rotation.x = Math.PI / 2;
    m.rotation.y = rotY;
    m.rotation.z = rotZ;
    m.castShadow = true;
    m.receiveShadow = true;
    fireplaceGroup.add(m);
  }
  log(front + 0.07, 0.137, -0.10, 0.52, 0.1, 0.25);
  log(front + 0.08, 0.19, 0.12, 0.48, -0.12, -0.22);
  log(front + 0.09, 0.135, 0.10, 0.42, 0.45, 0.12);
  log(front + 0.065, 0.17, -0.22, 0.38, -0.55, 0.05);

  // Glowing embers.
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff7b33, toneMapped: false });
  const embers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 5, 4), emberMat, 23);
  const dummy = new THREE.Object3D();
  const er = mulberry32(801);
  for (let i = 0; i < 23; i++) {
    dummy.position.set(front + 0.05 + er() * 0.06, 0.16 + er() * 0.10, -0.25 + er() * 0.5);
    dummy.scale.setScalar(0.6 + er() * 1.2);
    dummy.updateMatrix();
    embers.setMatrixAt(i, dummy.matrix);
  }
  fireplaceGroup.add(embers);

  // Flames (animated below).
  const flameColors = [0xffb347, 0xff7f2a, 0xffd68a, 0xff9a36];
  const flames = [];
  const fr = mulberry32(711);
  for (let i = 0; i < 7; i++) {
    const geo = new THREE.ConeGeometry(0.025 + fr() * 0.025, 0.30 + fr() * 0.22, 7);
    const mat = new THREE.MeshBasicMaterial({
      color: flameColors[i % flameColors.length],
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    const flame = new THREE.Mesh(geo, mat);
    const baseX = front + 0.075 + fr() * 0.02;
    const baseZ = -0.20 + fr() * 0.4;
    flame.position.set(baseX, 0.26 + fr() * 0.06, baseZ);
    flame.rotation.z = (fr() - 0.5) * 0.3;
    flame.rotation.x = (fr() - 0.5) * 0.18;
    flame.userData.baseScale = 0.75 + fr() * 0.5;
    flame.userData.phase = fr() * Math.PI * 2;
    flame.userData.baseY = flame.position.y;
    flame.castShadow = false;
    fireplaceGroup.add(flame);
    flames.push(flame);
  }
  fireplaceGroup.userData.flames = flames;
}

/* ------------------------------ rug ------------------------------------- */

const seatingShiftZ = 0.30;

{
  const rug = box(room, mats.rug, 1.70, 0.012, 2.20, 1.90, 0.006, seatingShiftZ, {
    castShadow: false,
    receiveShadow: true,
  });
  rug.geometry.setAttribute('uv', rug.geometry.attributes.uv);

  // A fringe at each end, laid on the floor.
  const fringeMat = new THREE.MeshStandardMaterial({ color: 0xd6c29d, roughness: 1 });
  for (const side of [-1, 1]) {
    const zz = seatingShiftZ + side * 1.11;
    for (let i = 0; i < 18; i++) {
      const x = 1.90 - 0.78 + (i / 17) * 1.56;
      box(room, fringeMat, 0.007, 0.004, 0.055, x, 0.002, zz + side * 0.026, {
        castShadow: false,
        receiveShadow: true,
      });
    }
  }
}

/* ------------------------------ sofa ------------------------------------ */

const sofaGroup = new THREE.Group();
sofaGroup.position.z = seatingShiftZ;
room.add(sofaGroup);

{
  // The back plane is exactly 2.5 m from the fireplace wall.
  const backX = EAST - 2.5; // 0.5 m
  const frontX = backX + 0.70;
  const zHalf = 1.18;

  // Legs (front legs stand on the rug).
  const legMat = mats.darkWood;
  for (const [x, z] of [
    [backX + 0.08, -zHalf + 0.14],
    [backX + 0.08, zHalf - 0.14],
    [frontX - 0.10, -zHalf + 0.14],
    [frontX - 0.10, zHalf - 0.14],
  ]) {
    // The front pair stand on the rug (12 mm higher than the rear pair).
    const onRug = Math.abs(x - (frontX - 0.10)) < 0.01;
    const legTop = 0.18;
    const legBottom = onRug ? 0.012 : 0;
    cylinder(sofaGroup, legMat, 0.03, 0.025, legTop - legBottom, x, legBottom + (legTop - legBottom) / 2, z, {
      segments: 12,
    });
  }

  // Base frame and back.  The back is deliberately low enough that the
  // fireplace remains visible over it from the doorway.
  rounded(sofaGroup, mats.mossDark, frontX - backX, 0.26, zHalf * 2, (backX + frontX) / 2, 0.29, 0, 0.045);
  rounded(sofaGroup, mats.mossDark, 0.13, 0.72, zHalf * 2, backX + 0.065, 0.52, 0, 0.04);
  rounded(sofaGroup, mats.moss, frontX - backX, 0.06, zHalf * 2, (backX + frontX) / 2, 0.91, 0, 0.025);

  // Seat cushions.
  const cushionW = (zHalf * 2 - 0.06) / 3;
  for (let i = 0; i < 3; i++) {
    const zc = -zHalf + 0.03 + cushionW / 2 + i * cushionW;
    rounded(sofaGroup, mats.moss, 0.55, 0.16, cushionW - 0.028, frontX - 0.35, 0.50, zc, 0.055);
    // Back cushion, leaning against the rear.
    rounded(sofaGroup, mats.moss, 0.23, 0.34, cushionW - 0.05, backX + 0.18, 0.75, zc, 0.055, {
      rz: -0.10,
    });
  }

  // Arms.
  for (const side of [-1, 1]) {
    rounded(
      sofaGroup,
      mats.mossDark,
      0.61,
      0.43,
      0.17,
      frontX - 0.39,
      0.635,
      side * (zHalf - 0.085),
      0.05
    );
  }

  // A mustard throw cushion and a rust one, tucked against the back.
  rounded(sofaGroup, mats.mustard, 0.33, 0.30, 0.36, backX + 0.40, 0.73, -0.56, 0.08, {
    ry: 0.24,
    rz: -0.21,
  });
  rounded(sofaGroup, mats.rust, 0.33, 0.30, 0.36, backX + 0.40, 0.73, 0.55, 0.08, {
    ry: -0.16,
    rz: -0.21,
  });

  // Folded blanket over the right arm.
  rounded(sofaGroup, mats.rust, 0.37, 0.07, 0.42, frontX - 0.35, 0.885, zHalf - 0.09, 0.025, {
    ry: 0.08,
    rz: 0.05,
  });
  rounded(sofaGroup, mats.rust, 0.33, 0.04, 0.36, frontX - 0.38, 0.93, zHalf - 0.04, 0.02, {
    ry: 0.12,
    rz: 0.12,
  });
}

/* --------------------------- coffee table ------------------------------- */

const tableGroup = new THREE.Group();
tableGroup.position.z = seatingShiftZ;
tableGroup.position.y = 0.012; // the coffee table rests on the rug
room.add(tableGroup);

{
  // Gap to sofa front: 0.45 m.  Gap to fireplace: 0.71 m.
  const cx = 1.90;
  const cz = 0;
  const topW = 0.50;
  const topD = 1.35;
  const topY = 0.39;
  const legH = 0.3625;

  box(tableGroup, mats.oak, topW, 0.055, topD, cx, topY, cz);
  box(tableGroup, mats.brass, topW - 0.04, 0.006, topD - 0.04, cx, topY + 0.0305, cz, {
    castShadow: false,
  });

  for (const [x, z] of [
    [cx - 0.19, cz - 0.57],
    [cx + 0.19, cz - 0.57],
    [cx - 0.19, cz + 0.57],
    [cx + 0.19, cz + 0.57],
  ]) {
    cylinder(tableGroup, mats.darkWood, 0.025, 0.022, legH, x, legH / 2, z, { segments: 12 });
  }

  // Lower shelf.
  box(tableGroup, mats.walnut, topW - 0.10, 0.035, topD - 0.20, cx, 0.14, cz);

  // A small stack of books.
  box(tableGroup, mats.rug, 0.18, 0.030, 0.26, cx - 0.05, topY + 0.0425, cz - 0.43);
  box(tableGroup, mats.ceramicBlue, 0.16, 0.028, 0.23, cx - 0.06, topY + 0.0715, cz - 0.43);
  box(tableGroup, mats.oak, 0.19, 0.024, 0.25, cx - 0.05, topY + 0.0975, cz - 0.42);

  // A mug, resting on the same top.
  cylinder(tableGroup, mats.ceramic, 0.052, 0.048, 0.115, cx + 0.01, topY + 0.085, cz + 0.38, { segments: 24 });
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.009, 8, 14, Math.PI * 1.5), mats.ceramic);
  handle.position.set(cx + 0.10, topY + 0.085, cz + 0.38);
  handle.rotation.z = Math.PI / 2;
  handle.castShadow = true;
  tableGroup.add(handle);

  // A brass candle holder and small dish.
  cylinder(tableGroup, mats.brass, 0.036, 0.045, 0.025, cx - 0.10, topY + 0.040, cz + 0.23, { segments: 20 });
  cylinder(tableGroup, mats.candle, 0.021, 0.021, 0.14, cx - 0.10, topY + 0.112, cz + 0.23, { segments: 16 });
  cylinder(tableGroup, mats.ceramic, 0.055, 0.035, 0.025, cx + 0.14, topY + 0.040, cz - 0.08, { segments: 20 });
}

/* ------------------------------ armchair -------------------------------- */

const chairGroup = new THREE.Group();
chairGroup.position.set(2.12, 0, -1.55);
chairGroup.rotation.y = Math.PI / 4;
room.add(chairGroup);

{
  const seatW = 0.82;
  const seatD = 0.74;

  // Legs.
  for (const [x, z] of [
    [-0.32, -0.30],
    [0.32, -0.30],
    [-0.32, 0.30],
    [0.32, 0.30],
  ]) {
    cylinder(chairGroup, mats.darkWood, 0.025, 0.022, 0.17, x, 0.085, z, { segments: 12 });
  }

  rounded(chairGroup, mats.leatherDark, seatW, 0.19, seatD, 0, 0.265, 0, 0.04);
  rounded(chairGroup, mats.leather, 0.72, 0.17, 0.66, 0, 0.45, 0.015, 0.06);

  // Arms.
  for (const side of [-1, 1]) {
    rounded(chairGroup, mats.leatherDark, 0.12, 0.31, 0.67, side * 0.355, 0.59, 0, 0.045);
  }

  // Back, tilted back very slightly.
  rounded(chairGroup, mats.leatherDark, 0.82, 0.72, 0.15, 0, 0.85, -0.33, 0.05, {
    rx: -0.09,
  });
  rounded(chairGroup, mats.leather, 0.76, 0.61, 0.075, 0, 0.84, -0.25, 0.04, {
    rx: -0.09,
  });

  // Mustard lumbar cushion.
  rounded(chairGroup, mats.mustard, 0.46, 0.24, 0.11, 0, 0.73, -0.13, 0.035, {
    rx: -0.17,
  });

  // A little book left on the seat.
  box(chairGroup, mats.rug, 0.19, 0.028, 0.25, 0.16, 0.548, 0.13, { ry: 0.25 });
  box(chairGroup, mats.oak, 0.17, 0.022, 0.23, 0.17, 0.573, 0.12, { ry: 0.25 });
}

/* ------------------------------ floor lamp ------------------------------- */

const lampGroup = new THREE.Group();
room.add(lampGroup);

let lampBulb;
{
  const x = 1.22;
  const z = -1.58;
  cylinder(lampGroup, mats.brass, 0.26, 0.28, 0.045, x, 0.0225, z, { segments: 32 });
  cylinder(lampGroup, mats.brass, 0.042, 0.055, 0.12, x, 0.105, z, { segments: 20 });
  cylinder(lampGroup, mats.brass, 0.018, 0.018, 1.48, x, 0.89, z, { segments: 14 });

  // Shade, wider at the bottom.
  const shadeGeo = new THREE.CylinderGeometry(0.19, 0.30, 0.38, 32, 1, true);
  const shade = new THREE.Mesh(shadeGeo, mats.linen);
  shade.position.set(x, 1.70, z);
  shade.castShadow = true;
  shade.receiveShadow = true;
  lampGroup.add(shade);
  cylinder(lampGroup, mats.brass, 0.20, 0.20, 0.012, x, 1.89, z, { segments: 32 });

  // Warm bulb inside the shade.
  lampBulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd191, toneMapped: false })
  );
  lampBulb.position.set(x, 1.71, z);
  lampGroup.add(lampBulb);

  const lampLight = new THREE.PointLight(0xffbd78, 6.5, 4.0, 2);
  lampLight.position.set(x, 1.68, z);
  lampLight.castShadow = false;
  lampGroup.add(lampLight);
}

/* ------------------------------ bookshelf -------------------------------- */

const shelfGroup = new THREE.Group();
room.add(shelfGroup);

{
  // Floor-to-ceiling bookcase against the west wall.  It stops north of the
  // door swing, leaving the south-west corner clear for the opening door.
  const backX = WEST;
  const depth = 0.28;
  const frontX = backX + depth;
  const zStart = NORTH + 0.05;
  const zEnd = 1.15;
  const length = zEnd - zStart;
  const height = ROOM.h;

  // Carcass.
  box(shelfGroup, mats.darkWood, depth, height, 0.04, backX + depth / 2, height / 2, zStart);
  box(shelfGroup, mats.darkWood, depth, height, 0.04, backX + depth / 2, height / 2, zEnd);
  box(shelfGroup, mats.darkWood, depth, 0.04, length, backX + depth / 2, height - 0.02, (zStart + zEnd) / 2);
  box(shelfGroup, mats.darkWood, depth, 0.04, length, backX + depth / 2, 0.02, (zStart + zEnd) / 2);
  box(shelfGroup, mats.darkWood, 0.02, height, length, backX + 0.01, height / 2, (zStart + zEnd) / 2);

  // Shelf boards.
  const shelfYs = [0.46, 0.96, 1.46, 1.96, 2.46];
  for (const y of shelfYs) {
    box(shelfGroup, mats.darkWood, depth, 0.035, length, backX + depth / 2, y, (zStart + zEnd) / 2);
  }

  // Two narrow vertical dividers.
  for (const zz of [-0.85, 0.25]) {
    box(shelfGroup, mats.darkWood, depth, height - 0.08, 0.04, backX + depth / 2, height / 2, zz);
  }

  // Book bays: [zLow, zHigh] for each shelf.
  const dividers = [-0.885, -0.815, 0.215, 0.285];
  const bays = [
    [zStart + 0.04, dividers[0]],
    [dividers[1], dividers[2]],
    [dividers[3], zEnd - 0.04],
  ];

  const bookMaterials = [
    new THREE.Color(0x283744),
    new THREE.Color(0x7a3d2c),
    new THREE.Color(0xb8864c),
    new THREE.Color(0xd8c9ad),
    new THREE.Color(0x526654),
    new THREE.Color(0x6c3d47),
    new THREE.Color(0x8996a0),
    new THREE.Color(0xb05d41),
    new THREE.Color(0x3e4b52),
    new THREE.Color(0xc5ad83),
    new THREE.Color(0x77624d),
  ];

  const transforms = [];
  const colors = [];
  const br = mulberry32(5258);

  // Horizontal stacks occupy reserved parts of three shelves, so upright
  // books are generated around them and never intersect them.
  const stacks = [
    { z: -1.45, shelf: 0, count: 4, reserve: [-1.62, -1.28] },
    { z: -0.45, shelf: 2, count: 3, reserve: [-0.62, -0.28] },
    { z: 0.62, shelf: 3, count: 4, reserve: [0.45, 0.79] },
  ];

  // Bottom bay has a few larger volumes, then the upper shelves are densely
  // filled.  Books sit exactly on the shelf tops; nothing floats.
  const shelfTops = [0.04, 0.4775, 0.9775, 1.4775, 1.9775, 2.4775];
  for (let s = 0; s < shelfTops.length; s++) {
    const baseY = shelfTops[s];
    const maxH = s === shelfTops.length - 1 ? 0.18 : 0.30;
    const reservations = stacks.filter((stack) => stack.shelf === s).map((stack) => stack.reserve);
    for (const [lo, hi] of bays) {
      let z = lo + 0.015 + br() * 0.02;
      const gapZone = br() < 0.3 ? lo + (hi - lo) * (0.35 + br() * 0.35) : null;
      while (z < hi - 0.03) {
        const width = 0.025 + br() * 0.055;

        const reserved = reservations.find(([a, b]) => z + width > a && z < b);
        if (reserved) {
          z = reserved[1] + 0.012;
          continue;
        }

        if (z + width > hi - 0.01) break;
        if (gapZone !== null && z > gapZone - 0.02 && z < gapZone + 0.09) {
          z = gapZone + 0.11;
          continue;
        }
        const bookH = 0.17 + br() * (maxH - 0.17);
        const depthB = 0.13 + br() * 0.045;
        const x = frontX - 0.035 - depthB / 2;
        transforms.push({
          x,
          y: baseY + bookH / 2,
          z: z + width / 2,
          sx: depthB,
          sy: bookH,
          sz: width,
        });
        colors.push(bookMaterials[Math.floor(br() * bookMaterials.length)]);
        z += width + 0.006 + br() * 0.012;
        if (br() < 0.08) z += 0.04 + br() * 0.07;
      }
    }
  }

  // Horizontal stacks of books, each resting on its shelf.
  for (const stack of stacks) {
    let y = shelfTops[stack.shelf];
    for (let i = 0; i < stack.count; i++) {
      const th = 0.025 + br() * 0.022;
      const len = Math.min(0.18 + br() * 0.14, stack.reserve[1] - stack.reserve[0] - 0.02);
      transforms.push({
        x: frontX - 0.10,
        y: y + th / 2,
        z: stack.z,
        sx: 0.15,
        sy: th,
        sz: len,
      });
      colors.push(bookMaterials[Math.floor(br() * bookMaterials.length)]);
      y += th;
    }
  }

  // Instanced books keep the draw calls low while retaining varied colours.
  const bookGeo = new THREE.BoxGeometry(1, 1, 1);
  const bookMat = new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0 });
  const books = new THREE.InstancedMesh(bookGeo, bookMat, transforms.length);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    dummy.position.set(t.x, t.y, t.z);
    dummy.scale.set(t.sx, t.sy, t.sz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    books.setMatrixAt(i, dummy.matrix);
    books.setColorAt(i, colors[i]);
  }
  books.instanceColor.needsUpdate = true;
  books.castShadow = true;
  books.receiveShadow = true;
  shelfGroup.add(books);

  // A small brass bowl on one shelf.
  cylinder(shelfGroup, mats.brass, 0.065, 0.04, 0.055, frontX - 0.07, 2.505, -1.35, { segments: 24 });
  cylinder(shelfGroup, mats.brass, 0.05, 0.05, 0.012, frontX - 0.07, 2.536, -1.35, { segments: 24 });
}

/* ----------------------------- wall & floor decor ------------------------ */

{
  // Framed print on the south wall, east of the door.
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.58), mats.art);
  art.position.set(1.25, 1.85, SOUTH - 0.032);
  art.rotation.y = Math.PI;
  room.add(art);
  box(room, mats.darkWood, 0.51, 0.64, 0.028, 1.25, 1.85, SOUTH - 0.014);
  box(room, mats.darkWood, 0.55, 0.03, 0.05, 1.25, 1.56, SOUTH - 0.025);
  box(room, mats.darkWood, 0.55, 0.03, 0.05, 1.25, 2.14, SOUTH - 0.025);

  // Books left on the floor beside the bookcase, clear of the door swing.
  const stackX = -2.36;
  const stackZ = -1.72;
  box(room, mats.rug, 0.25, 0.030, 0.31, stackX, 0.015, stackZ, { ry: 0.16 });
  box(room, mats.oak, 0.23, 0.026, 0.29, stackX + 0.01, 0.043, stackZ + 0.01, { ry: 0.24 });
  box(room, mats.ceramicBlue, 0.21, 0.028, 0.27, stackX - 0.01, 0.070, stackZ - 0.01, { ry: 0.08 });
  box(room, mats.mustard, 0.19, 0.024, 0.24, stackX + 0.01, 0.096, stackZ + 0.01, { ry: 0.19 });
}

/* -------------------------------- pendant -------------------------------- */

const pendant = new THREE.Group();
pendant.position.set(0, ROOM.h, -0.25);
ceilingGroup.add(pendant);

{
  const cordLength = 0.31;
  cylinder(pendant, mats.brass, 0.006, 0.006, cordLength, 0, -cordLength / 2, 0, { segments: 8 });
  const shadeGeo = new THREE.CylinderGeometry(0.13, 0.29, 0.24, 32, 1, true);
  const shade = new THREE.Mesh(shadeGeo, mats.linen);
  shade.position.set(0, -0.42, 0);
  shade.castShadow = true;
  shade.receiveShadow = true;
  pendant.add(shade);
  cylinder(pendant, mats.brass, 0.10, 0.10, 0.012, 0, -0.542, 0, { segments: 24 });
  cylinder(pendant, mats.brass, 0.025, 0.025, 0.04, 0, -0.29, 0, { segments: 12 });

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd39a, toneMapped: false })
  );
  bulb.position.set(0, -0.53, 0);
  pendant.add(bulb);

  const pendantLight = new THREE.PointLight(0xffc47c, 10.0, 5.5, 2);
  pendantLight.position.set(0, -0.56, 0);
  pendantLight.castShadow = false;
  pendant.add(pendantLight);
}

/* -------------------------------- lights -------------------------------- */

const ambient = new THREE.AmbientLight(0xffe8cf, 0.28);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0x9eb7c9, 0x3c2920, 0.62);
scene.add(hemi);

// Late-afternoon light through the north window.
const sun = new THREE.DirectionalLight(0xffd3a1, 2.55);
sun.position.set(-1.05, 3.8, -5.6);
sun.target.position.set(0.55, 0.0, 0.55);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.2;
sun.shadow.camera.far = 18;
sun.shadow.camera.left = -6;
sun.shadow.camera.right = 6;
sun.shadow.camera.top = 6;
sun.shadow.camera.bottom = -6;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(sun.target);

// Warm glow from the firebox.
const fireLight = new THREE.PointLight(0xff8a3a, 7.2, 4.2, 2);
fireLight.position.set(FIREPLACE.frontX - 0.02, 0.46, 0);
fireLight.castShadow = false;
scene.add(fireLight);

// A soft fill from the doorway side so the near wall does not go black.
const fill = new THREE.PointLight(0xffc38d, 2.2, 6, 2);
fill.position.set(-1.9, 1.75, SOUTH - 0.45);
fill.castShadow = false;
scene.add(fill);

/* ------------------------------- cameras --------------------------------- */

const perspCamera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.04, 40);
const doorPosition = new THREE.Vector3(DOOR.cx, 1.6, SOUTH - 0.20);
const doorTarget = new THREE.Vector3(0.15, 1.12, -1.50);
perspCamera.position.copy(doorPosition);
perspCamera.lookAt(doorTarget);

const orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 30);
orthoCamera.position.set(0, 10, 0);
orthoCamera.up.set(0, 0, -1);
orthoCamera.lookAt(0, 0, 0);

const doorControls = new OrbitControls(perspCamera, renderer.domElement);
doorControls.target.copy(doorTarget);
doorControls.enableDamping = true;
doorControls.dampingFactor = 0.075;
doorControls.minDistance = 0.25;
doorControls.maxDistance = 8.0;
doorControls.maxPolarAngle = Math.PI * 0.53;
doorControls.minPolarAngle = 0.08;
doorControls.enablePan = true;
doorControls.panSpeed = 0.7;
doorControls.zoomSpeed = 0.8;
doorControls.update();

const topControls = new OrbitControls(orthoCamera, renderer.domElement);
topControls.target.set(0, 0, 0);
topControls.enableDamping = true;
topControls.dampingFactor = 0.08;
topControls.enableRotate = false;
topControls.enablePan = false;
topControls.enableZoom = true;
topControls.minZoom = 0.6;
topControls.maxZoom = 4.0;
topControls.update();

let activeCamera = perspCamera;
let activeControls = doorControls;
let isTopView = false;

function updateOrthoFrustum() {
  const aspect = window.innerWidth / window.innerHeight;
  const spanX = ROOM.w + ROOM.wall * 2 + 0.72;
  const spanZ = ROOM.d + ROOM.wall * 2 + 0.72;
  const planAspect = spanX / spanZ;
  let width;
  let height;
  if (aspect > planAspect) {
    height = spanZ;
    width = height * aspect;
  } else {
    width = spanX;
    height = width / aspect;
  }
  orthoCamera.left = -width / 2;
  orthoCamera.right = width / 2;
  orthoCamera.top = height / 2;
  orthoCamera.bottom = -height / 2;
  orthoCamera.updateProjectionMatrix();
}

updateOrthoFrustum();

function setView(view) {
  isTopView = view === 'top';
  ceilingGroup.visible = !isTopView;
  for (const mesh of planDoorHeaders) mesh.visible = !isTopView;

  if (isTopView) {
    activeCamera = orthoCamera;
    activeControls = topControls;
    doorControls.enabled = false;
    topControls.enabled = true;
    orthoCamera.position.set(0, 10, 0);
    orthoCamera.zoom = 1;
    orthoCamera.updateProjectionMatrix();
    updateOrthoFrustum();
    topControls.target.set(0, 0, 0);
    topControls.update();
  } else {
    activeCamera = perspCamera;
    activeControls = doorControls;
    topControls.enabled = false;
    doorControls.enabled = true;
    perspCamera.position.copy(doorPosition);
    doorControls.target.copy(doorTarget);
    doorControls.update();
  }

  document.getElementById('doorBtn').classList.toggle('active', !isTopView);
  document.getElementById('topBtn').classList.toggle('active', isTopView);
  document.getElementById('hint').textContent = isTopView
    ? 'Scroll to zoom · use the Door and Top buttons to switch views'
    : 'Drag to look around · scroll to zoom';
}

const params = new URLSearchParams(window.location.search);
setView(params.get('view') === 'top' ? 'top' : 'door');

document.getElementById('doorBtn').addEventListener('click', () => setView('door'));
document.getElementById('topBtn').addEventListener('click', () => setView('top'));

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  perspCamera.aspect = window.innerWidth / window.innerHeight;
  perspCamera.updateProjectionMatrix();
  updateOrthoFrustum();
});

/* -------------------------------- animate -------------------------------- */

const startTime = performance.now();
const flames = fireplaceGroup.userData.flames;
const motes = windowGroup.userData.motes;
const curtains = windowGroup.userData.curtains;

function animate() {
  requestAnimationFrame(animate);
  const t = (performance.now() - startTime) / 1000;

  // Firelight flicker.
  fireLight.intensity = 7.0 + Math.sin(t * 8.3) * 1.35 + Math.sin(t * 17.7 + 1.2) * 0.65 + Math.sin(t * 3.7) * 0.4;
  for (let i = 0; i < flames.length; i++) {
    const f = flames[i];
    const phase = f.userData.phase;
    const base = f.userData.baseScale;
    const wobble = 0.86 + Math.sin(t * (5.2 + i * 0.55) + phase) * 0.13 + Math.sin(t * 12.7 + phase * 2) * 0.06;
    f.scale.set(base * (0.92 + Math.sin(t * 4.3 + phase) * 0.10), base * wobble, base);
    f.position.y = f.userData.baseY + Math.sin(t * 7.1 + phase) * 0.018;
    f.rotation.z = Math.sin(t * 3.4 + phase) * 0.14;
    f.material.opacity = 0.55 + Math.sin(t * 6.2 + phase) * 0.13;
  }

  // Slow dust motes drifting through the window light.
  const posAttr = windowGroup.children.find((child) => child.isPoints)?.geometry.attributes.position;
  if (posAttr) {
    for (let i = 0; i < motes.length; i++) {
      const m = motes[i];
      posAttr.setX(i, m.x + Math.sin(t * 0.11 + i * 1.7) * 0.11);
      posAttr.setY(i, m.y + Math.sin(t * 0.09 + i * 0.8) * 0.075);
      posAttr.setZ(i, m.z + Math.cos(t * 0.10 + i * 2.1) * 0.07);
    }
    posAttr.needsUpdate = true;
  }

  // A very gentle draught moves the curtains, and the pendant swings a little.
  const curtainOffset = Math.sin(t * 0.64) * 0.018;
  for (let i = 0; i < curtains.length; i++) {
    curtains[i].position.z = curtains[i].userData.baseZ + curtainOffset * (i === 0 ? 1 : -1);
    curtains[i].position.x = curtains[i].userData.baseX + Math.sin(t * 0.47 + i * 1.9) * 0.013;
  }
  pendant.rotation.z = Math.sin(t * 0.72) * 0.055;
  pendant.rotation.x = Math.sin(t * 0.51 + 0.7) * 0.032;

  if (activeControls) activeControls.update();
  renderer.render(scene, activeCamera);
}

animate();
