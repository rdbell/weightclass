import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ============================================================
   Cosy reading room — plan (metres, y up, north = -z, east = +x)
   Room: 6 (x: -3..3) × 4.5 (z: -2.25..2.25), ceiling 2.7
   Door: south wall, 0.9 wide, centre 1.2 m from west wall,
         hinged west, opens into the room
   Window: north wall, 1.6 wide centred, sill 0.9
   Fireplace: east wall centred, firebox 1 m wide
   Sofa: faces fireplace (+x), back at x = 0.5 (2.5 m from wall)
   Coffee table: between sofa and fireplace, ≥0.45 m walkways
   Armchair: NE corner, angled 45° toward the fireplace
   Bookshelf: west wall, floor→ceiling, stops clear of door swing
   Rug: centred under coffee table, under sofa's front legs
   Floor lamp: west (inland) side of the armchair
   ============================================================ */

/* ---------------- seeded randomness ---------------- */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261115);
const range = (a, b) => a + rand() * (b - a);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

/* ---------------- renderer / scene ---------------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);

const params = new URLSearchParams(location.search);
const viewName = params.get('view') || 'door';
const isTop = viewName === 'top';
window.__roomReady = true;

/* ---------------- cameras ---------------- */
const DOOR_POS = new THREE.Vector3(-1.8, 1.6, 1.9);   // just inside the door, eye 1.6 m
const DOOR_TGT = new THREE.Vector3(1.5, 1.0, -1.0);  // looking north-east into the room

let camera;
if (isTop) {
  const a = window.innerWidth / window.innerHeight;
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 60);
  camera.up.set(0, 0, -1);            // north up
  camera.position.set(0, 25, 0);
  camera.lookAt(0, 0, 0);
  fitOrtho(a);
} else {
  camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.05, 60);
  camera.position.copy(DOOR_POS);
  camera.lookAt(DOOR_TGT);
}

function fitOrtho(aspect) {
  // frame the whole room incl. wall thickness, with a margin
  const halfH = Math.max(2.65, 3.35 / aspect);
  const halfW = halfH * aspect;
  camera.left = -halfW; camera.right = halfW;
  camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = 1.62;
controls.minDistance = 0.3;
controls.maxDistance = 14;
controls.target.copy(isTop ? new THREE.Vector3(0, 0, 0) : DOOR_TGT);
controls.update();

/* ---------------- texture helpers ---------------- */
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// wood-plank floor
const floorTex = canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#6e4a30'; g.fillRect(0, 0, w, h);
  const rows = 7, rh = h / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 120;
    while (x < w) {
      const pw = 150 + rand() * 160;
      const l = 26 + rand() * 10;
      g.fillStyle = `hsl(${22 + rand() * 8}, 34%, ${l}%)`;
      g.fillRect(x, r * rh, pw, rh);
      g.strokeStyle = 'rgba(30,18,10,0.55)'; g.lineWidth = 2;
      g.strokeRect(x, r * rh, pw, rh);
      for (let i = 0; i < 5; i++) {           // grain
        g.strokeStyle = `rgba(40,24,12,${0.05 + rand() * 0.05})`;
        g.lineWidth = 1;
        g.beginPath();
        const gy = r * rh + rand() * rh;
        g.moveTo(x + 4, gy); g.lineTo(x + pw - 4, gy + (rand() - 0.5) * 6);
        g.stroke();
      }
      x += pw;
    }
  }
});
floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
floorTex.repeat.set(2.6, 2);

// rug
const rugTex = canvasTexture(512, 512, (g, w, h) => {
  g.fillStyle = '#6e2a30'; g.fillRect(0, 0, w, h);
  // faint field pattern
  g.strokeStyle = 'rgba(240,225,190,0.10)'; g.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    g.beginPath(); g.moveTo(0, i * h / 8); g.lineTo(w, i * h / 8); g.stroke();
  }
  // border
  g.strokeStyle = '#2f3f6b'; g.lineWidth = 34; g.strokeRect(17, 17, w - 34, h - 34);
  g.strokeStyle = '#d9c39a'; g.lineWidth = 5;
  g.strokeRect(44, 44, w - 88, h - 88);
  g.strokeRect(58, 58, w - 116, h - 116);
  // medallion diamonds
  g.lineWidth = 7; g.strokeStyle = '#d9c39a';
  const dia = (cx, cy, r) => {
    g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx + r, cy); g.lineTo(cx, cy + r); g.lineTo(cx - r, cy); g.closePath(); g.stroke();
  };
  dia(w / 2, h / 2, 110); dia(w / 2, h / 2, 78); dia(w / 2, h / 2, 40);
  g.fillStyle = '#2f3f6b';
  g.beginPath(); g.moveTo(w / 2, h / 2 - 24); g.lineTo(w / 2 + 24, h / 2); g.lineTo(w / 2, h / 2 + 24); g.lineTo(w / 2 - 24, h / 2); g.closePath(); g.fill();
  // corner motifs
  [[92, 92], [w - 92, 92], [92, h - 92], [w - 92, h - 92]].forEach(([x, y]) => dia(x, y, 22));
  // wear specks
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${rand() * 0.07})`;
    g.fillRect(rand() * w, rand() * h, 2, 2);
  }
});

// stone for the fireplace surround
const stoneTex = canvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#6e6053'; g.fillRect(0, 0, w, h);
  const bh = 42;
  for (let r = 0; r * bh < h; r++) {
    let x = (r % 2) * -40;
    while (x < w) {
      const bw = 74 + rand() * 30;
      const l = 40 + rand() * 14;
      g.fillStyle = `hsl(${26 + rand() * 10}, 12%, ${l}%)`;
      g.fillRect(x + 2, r * bh + 2, bw - 4, bh - 4);
      x += bw;
    }
  }
});

// dusk backdrop seen through the window
const duskTex = canvasTexture(1024, 640, (g, w, h) => {
  const sky = g.createLinearGradient(0, 0, 0, h * 0.72);
  sky.addColorStop(0, '#0d1830'); sky.addColorStop(0.55, '#2a3a63');
  sky.addColorStop(0.85, '#b86a45'); sky.addColorStop(1, '#e8995c');
  g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.72);
  g.fillStyle = '#120e0c'; g.fillRect(0, h * 0.72, w, h * 0.28);
  // stars
  for (let i = 0; i < 130; i++) {
    const y = rand() * h * 0.42;
    g.fillStyle = `rgba(255,255,240,${0.25 + rand() * 0.6})`;
    g.fillRect(rand() * w, y, 2, 2);
  }
  // moon
  g.fillStyle = 'rgba(240,238,220,0.95)';
  g.beginPath(); g.arc(w * 0.78, h * 0.2, 26, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(240,238,220,0.12)';
  g.beginPath(); g.arc(w * 0.78, h * 0.2, 52, 0, Math.PI * 2); g.fill();
  // hills
  g.fillStyle = '#1a1622';
  g.beginPath(); g.moveTo(0, h * 0.72);
  for (let x = 0; x <= w; x += 40) g.lineTo(x, h * 0.72 - 30 - 26 * Math.sin(x * 0.008) - rand() * 8);
  g.lineTo(w, h); g.lineTo(0, h); g.fill();
  // fir silhouettes
  g.fillStyle = '#0d0b10';
  for (let i = 0; i < 14; i++) {
    const x = rand() * w, base = h * 0.74 + rand() * h * 0.1, hh = 40 + rand() * 90, ww = hh * 0.3;
    g.beginPath();
    g.moveTo(x, base - hh); g.lineTo(x + ww, base); g.lineTo(x - ww, base); g.closePath(); g.fill();
  }
});

// small paintings
function paintTex(seedShift) {
  return canvasTexture(256, 320, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h * 0.7);
    sky.addColorStop(0, ['#31406e', '#41507a', '#2c3a60'][seedShift % 3]);
    sky.addColorStop(1, '#d98d55');
    g.fillStyle = sky; g.fillRect(0, 0, w, h * 0.7);
    g.fillStyle = '#d9c39a';
    g.beginPath(); g.arc(w * 0.68, h * 0.42, 18, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#23301f'; g.fillRect(0, h * 0.7, w, h * 0.3);
    g.fillStyle = '#1a2418';
    g.beginPath(); g.moveTo(0, h * 0.7);
    g.lineTo(w * 0.35, h * 0.52); g.lineTo(w * 0.62, h * 0.7); g.fill();
    g.fillStyle = '#141d13';
    g.beginPath(); g.moveTo(w * 0.45, h * 0.7);
    g.lineTo(w * 0.8, h * 0.56); g.lineTo(w, h * 0.7); g.fill();
  });
}

// flame sprite
const flameTex = canvasTexture(128, 128, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h * 0.62, 4, w / 2, h * 0.62, w * 0.46);
  grd.addColorStop(0, 'rgba(255,255,235,1)');
  grd.addColorStop(0.25, 'rgba(255,214,120,0.95)');
  grd.addColorStop(0.55, 'rgba(255,130,40,0.6)');
  grd.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
});

/* ---------------- shared materials ---------------- */
const wallMat = new THREE.MeshStandardMaterial({ color: 0xe3d5bd, roughness: 0.92 });
const woodDark = new THREE.MeshStandardMaterial({ color: 0x54382a, roughness: 0.72 });
const woodMid = new THREE.MeshStandardMaterial({ color: 0x77502f, roughness: 0.7 });
const brassMat = new THREE.MeshStandardMaterial({ color: 0xc9a24a, metalness: 0.85, roughness: 0.35 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x17100c, roughness: 1 });
const stoneMat = new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 });

/* ---------------- the room shell ---------------- */
const R = { x: 3, z: 2.25, h: 2.7, t: 0.12 }; // half sizes, wall thickness
const hideInTop = [];
const room = new THREE.Group();
scene.add(room);

function box(w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = shadow; m.receiveShadow = shadow;
  room.add(m);
  return m;
}

// floor
const floor = box(6, 0.12, 4.5,
  new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 }),
  0, -0.06, 0);
floor.castShadow = false;

// ceiling (hidden in top view)
const ceilingGrp = new THREE.Group();
let ceilingMesh;
{
  ceilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5),
    new THREE.MeshStandardMaterial({ color: 0xefe8da, roughness: 0.95 }));
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.y = R.h;
  ceilingMesh.receiveShadow = true;
  ceilingGrp.add(ceilingMesh);
}
room.add(ceilingGrp);
hideInTop.push(ceilingGrp);

// west wall (solid)
box(R.t, R.h, 4.5, wallMat, -R.x - R.t / 2, R.h / 2, 0);

// north wall with window (opening x ±0.8, y 0.9..2.1)
{
  const zN = -R.z - R.t / 2;
  box(6.24, 0.9, R.t, wallMat, 0, 0.45, zN);            // below sill
  box(6.24, 0.6, R.t, wallMat, 0, 2.4, zN);             // above
  box(2.32, 1.2, R.t, wallMat, -1.96, 1.5, zN);         // left
  box(2.32, 1.2, R.t, wallMat, 1.96, 1.5, zN);          // right
  // frame + mullions
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d2, roughness: 0.6 });
  box(0.07, 1.28, 0.14, frameMat, -0.835, 1.5, -R.z, false);
  box(0.07, 1.28, 0.14, frameMat, 0.835, 1.5, -R.z, false);
  box(1.74, 0.07, 0.14, frameMat, 0, 2.135, -R.z, false);
  box(1.74, 0.06, 0.12, frameMat, 0, 0.87, -R.z, false);
  box(0.045, 1.2, 0.05, frameMat, 0, 1.5, -R.z, false);  // mullions
  box(1.6, 0.045, 0.05, frameMat, 0, 1.5, -R.z, false);
  box(1.84, 0.05, 0.18, woodMid, 0, 0.875, -R.z + 0.03, false); // sill board
  // glass
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2),
    new THREE.MeshStandardMaterial({
      color: 0x9fb4d8, transparent: true, opacity: 0.14,
      roughness: 0.05, metalness: 0.1, depthWrite: false,
    }));
  glass.position.set(0, 1.5, -R.z - 0.01);
  room.add(glass);
  // dusk backdrop outside
  const back = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.4),
    new THREE.MeshBasicMaterial({ map: duskTex }));
  back.position.set(0, 1.55, -R.z - 1.25); // faces +z, toward the room
  room.add(back);
  // curtains + rod
  const curMat = new THREE.MeshStandardMaterial({ color: 0xd8c5a0, roughness: 0.95 });
  [-1.12, 1.12].forEach((x) => {
    const cur = box(0.42, 1.75, 0.09, curMat, x, 1.56, -R.z + 0.11);
    cur.castShadow = true;
  });
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.5, 10), woodDark);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 2.5, -R.z + 0.11);
  room.add(rod);
}

// south wall with door opening (x -2.25..-1.35, h 2.1)
{
  const zS = R.z + R.t / 2;
  box(0.87, R.h, R.t, wallMat, -2.685, R.h / 2, zS);
  box(4.47, R.h, R.t, wallMat, 0.885, R.h / 2, zS);
  box(0.9, 0.6, R.t, wallMat, -1.8, 2.4, zS);
  // casing
  const caseMat = woodMid;
  box(0.08, 2.14, 0.16, caseMat, -2.28, 1.05, R.z, false);
  box(0.08, 2.14, 0.16, caseMat, -1.32, 1.05, R.z, false);
  box(1.0, 0.09, 0.16, caseMat, -1.8, 2.13, R.z, false);
  // dark hallway behind the open doorway
  const hall = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3),
    new THREE.MeshBasicMaterial({ color: 0x0a0806 }));
  hall.position.set(-1.8, 1.05, R.z + 0.35);
  hall.rotation.y = Math.PI;
  room.add(hall);
  // the door itself — hinged on its west side, opens into the room
  const door = new THREE.Group();
  door.position.set(-2.25, 0, R.z);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5c4433, roughness: 0.65 });
  const leaf = new THREE.Mesh(new RoundedBoxGeometry(0.88, 2.06, 0.045, 2, 0.012), leafMat);
  leaf.position.set(0.44, 1.03, 0);
  leaf.castShadow = leaf.receiveShadow = true;
  door.add(leaf);
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x4a372a, roughness: 0.7 });
  [0.56, 1.48].forEach((y) => {
    [0.026, -0.026].forEach((zo) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.66, 0.016), panelMat);
      p.position.set(0.44, y, zo);
      door.add(p);
    });
  });
  [0.06, -0.06].forEach((zo) => {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), brassMat);
    knob.position.set(0.8, 1.02, zo);
    door.add(knob);
  });
  door.rotation.y = THREE.MathUtils.degToRad(72); // swung open into the room
  room.add(door);
}

// east wall with fireplace (opening z ±0.5, y 0.08..1.02)
{
  const xE = R.x + R.t / 2;
  box(R.t, R.h, 1.87, wallMat, xE, R.h / 2, -1.435);
  box(R.t, R.h, 1.87, wallMat, xE, R.h / 2, 1.435);
  box(R.t, 1.68, 1.0, wallMat, xE, 1.86, 0);      // above opening
  box(R.t, 0.08, 1.0, wallMat, xE, 0.04, 0);      // below opening
  // stone surround (flush with the wall face)
  box(R.t, 1.22, 0.16, stoneMat, xE, 0.61, -0.58);
  box(R.t, 1.22, 0.16, stoneMat, xE, 0.61, 0.58);
  box(R.t, 0.2, 1.32, stoneMat, xE, 1.12, 0);
  // firebox cavity (chimney recess behind the wall)
  box(0.46, 0.03, 1.0, blackMat, R.x + 0.23, 0.095, 0, false);
  box(0.03, 0.94, 1.0, blackMat, R.x + 0.44, 0.55, 0, false);
  box(0.46, 0.94, 0.03, blackMat, R.x + 0.23, 0.55, -0.515, false);
  box(0.46, 0.94, 0.03, blackMat, R.x + 0.23, 0.55, 0.515, false);
  box(0.46, 0.03, 1.06, blackMat, R.x + 0.23, 1.035, 0, false);
  // logs
  const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.9 });
  [[0.2, 0.19, 0.10], [0.26, 0.2, -0.12], [0.33, 0.21, 0.0]].forEach(([y, xoff, zo], i) => {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.5, 8), logMat);
    log.rotation.x = Math.PI / 2;
    log.rotation.z = (i - 1) * 0.5;
    log.position.set(R.x + 0.16 + xoff, y, zo);
    log.castShadow = true;
    room.add(log);
  });
  // ember bed
  const ember = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.55),
    new THREE.MeshStandardMaterial({
      color: 0x571c07, emissive: 0xff5a1a, emissiveIntensity: 1.6, roughness: 1,
    }));
  ember.position.set(R.x + 0.18, 0.14, 0);
  room.add(ember);
  // mantel + corbels
  box(0.14, 0.06, 1.5, woodDark, R.x - 0.07, 1.24, 0);
  [-0.62, 0.62].forEach((zo) => {
    box(0.1, 0.14, 0.05, woodDark, R.x - 0.05, 1.14, zo, false);
  });
}

// baseboards
{
  const bbMat = new THREE.MeshStandardMaterial({ color: 0x6f5238, roughness: 0.75 });
  box(0.024, 0.09, 3.45, bbMat, -R.x + 0.012, 0.045, -0.45, false);   // west (clear of swing)
  box(6.2, 0.09, 0.024, bbMat, 0, 0.045, -R.z + 0.012, false);        // north
  box(0.87, 0.09, 0.024, bbMat, -2.685, 0.045, R.z - 0.012, false);   // south (2 pcs)
  box(4.47, 0.09, 0.024, bbMat, 0.885, 0.045, R.z - 0.012, false);
  box(0.024, 0.09, 4.46, bbMat, R.x - 0.012, 0.045, 0, false);        // east
}

/* ---------------- sofa (faces +x, back at world x = 0.5) ---------------- */
function buildSofa() {
  const g = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: 0x4d6a52, roughness: 0.96 });
  const fabricDk = new THREE.MeshStandardMaterial({ color: 0x3f5644, roughness: 0.96 });
  const add = (geo, mat, x, y, z, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.z = rz;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  // legs
  [[-0.34, -1.0], [-0.34, 1.0], [0.34, -1.0], [0.34, 1.0]].forEach(([x, z]) => {
    add(new THREE.BoxGeometry(0.07, 0.12, 0.07), woodDark, x, 0.06, z);
  });
  add(new RoundedBoxGeometry(0.85, 0.34, 2.06, 3, 0.05), fabricDk, 0, 0.29, 0);      // base
  add(new RoundedBoxGeometry(0.20, 0.9, 2.06, 3, 0.06), fabricDk, -0.325, 0.57, 0);  // back
  [-0.53, 0, 0.53].forEach((z) => {                                                   // 3 seat cushions
    add(new RoundedBoxGeometry(0.58, 0.17, 0.62, 3, 0.06), fabric, 0.09, 0.545, z);
  });
  [-0.53, 0, 0.53].forEach((z) => {                                                   // 3 back cushions
    add(new RoundedBoxGeometry(0.15, 0.44, 0.58, 3, 0.06), fabric, -0.17, 0.76, z, 0.14);
  });
  [-0.95, 0.95].forEach((z) => {                                                      // arms
    add(new RoundedBoxGeometry(0.8, 0.58, 0.3, 3, 0.06), fabricDk, -0.03, 0.41, z);
  });
  // throw pillows
  const pil = (mat, z, ry) => {
    const m = add(new RoundedBoxGeometry(0.36, 0.36, 0.13, 3, 0.07), mat, 0.12, 0.72, z);
    m.rotation.y = ry; m.rotation.x = 0.12;
  };
  pil(new THREE.MeshStandardMaterial({ color: 0xb0623a, roughness: 0.95 }), -0.62, 0.35);
  pil(new THREE.MeshStandardMaterial({ color: 0xd8c6a0, roughness: 0.95 }), 0.66, -0.3);
  // throw over the arm
  const throwMat = new THREE.MeshStandardMaterial({ color: 0xc9b489, roughness: 1 });
  add(new THREE.BoxGeometry(0.5, 0.045, 0.4), throwMat, -0.05, 0.715, -0.95);
  add(new THREE.BoxGeometry(0.34, 0.3, 0.045), throwMat, -0.05, 0.57, -1.13);
  return g;
}
const sofa = buildSofa();
sofa.position.set(0.925, 0, 0); // back plane at x = 0.5 → 2.5 m from east wall
room.add(sofa);

/* ---------------- armchair (NE corner, 45° toward fireplace) ---------------- */
function buildArmchair() {
  const g = new THREE.Group();
  const fabric = new THREE.MeshStandardMaterial({ color: 0xa4552f, roughness: 0.95 });
  const fabricDk = new THREE.MeshStandardMaterial({ color: 0x8c4626, roughness: 0.95 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  [[-0.28, -0.28], [-0.28, 0.28], [0.28, -0.28], [0.28, 0.28]].forEach(([x, z]) => {
    add(new THREE.BoxGeometry(0.06, 0.11, 0.06), woodDark, x, 0.055, z);
  });
  add(new RoundedBoxGeometry(0.72, 0.3, 0.72, 3, 0.05), fabricDk, 0, 0.26, 0);
  add(new RoundedBoxGeometry(0.56, 0.15, 0.58, 3, 0.06), fabric, 0.05, 0.48, 0);
  add(new RoundedBoxGeometry(0.2, 0.86, 0.68, 3, 0.07), fabricDk, -0.26, 0.55, 0);
  [-0.35, 0.35].forEach((z) => {   // wings
    const w = add(new RoundedBoxGeometry(0.36, 0.6, 0.11, 3, 0.05), fabricDk, -0.1, 0.72, z);
    w.rotation.y = z > 0 ? -0.38 : 0.38;
  });
  [-0.33, 0.33].forEach((z) => {
    add(new RoundedBoxGeometry(0.56, 0.28, 0.14, 3, 0.05), fabricDk, 0.06, 0.55, z);
  });
  return g;
}
const chair = buildArmchair();
chair.position.set(2.15, 0, -1.5);
chair.rotation.y = -Math.PI / 4; // angled 45°, facing the fireplace
room.add(chair);

/* ---------------- coffee table ---------------- */
{
  const g = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.045, 1.1, 2, 0.018), woodMid);
  top.position.y = 0.42;
  top.castShadow = top.receiveShadow = true;
  g.add(top);
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.98), woodDark);
  apron.position.y = 0.375; apron.castShadow = true;
  g.add(apron);
  [[-0.24, -0.48], [-0.24, 0.48], [0.24, -0.48], [0.24, 0.48]].forEach(([x, z]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.4, 0.045), woodDark);
    l.position.set(x, 0.2, z); l.castShadow = true;
    g.add(l);
  });
  // props: a small stack of books + a mug
  const bookMats = [0x7d3b3b, 0x3e5a52, 0x8a6d3b].map(
    (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  let by = 0.465;
  bookMats.forEach((m, i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.032, 0.31), m);
    b.position.set(0.02, by, -0.18);
    b.rotation.y = (i - 1) * 0.14;
    b.castShadow = true;
    g.add(b);
    by += 0.034;
  });
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.095, 14),
    new THREE.MeshStandardMaterial({ color: 0xc9702f, roughness: 0.6 }));
  mug.position.set(-0.12, 0.49, 0.22); mug.castShadow = true;
  g.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 8, 14), mug.material);
  handle.position.set(-0.12 - 0.05, 0.49, 0.22); handle.rotation.y = Math.PI / 2;
  g.add(handle);
  g.position.set(2.11, 0, 0);
  room.add(g);
}

/* ---------------- bookshelf: west wall, floor→ceiling, clear of the swing ---------------- */
{
  const g = new THREE.Group();
  g.position.set(-2.85, 0, -0.45); // spans z -2.25..1.35 (door swing stays clear)
  const add = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  add(0.3, R.h, 0.03, woodDark, 0, R.h / 2, -1.785);
  add(0.3, R.h, 0.03, woodDark, 0, R.h / 2, 1.785);
  add(0.3, 0.03, 3.6, woodDark, 0, 2.685, 0);
  add(0.3, 0.03, 3.54, woodDark, 0, 0.065, 0);
  add(0.02, R.h, 3.54, woodDark, -0.14, R.h / 2, 0);
  const boardYs = [0.42, 0.78, 1.14, 1.5, 1.86, 2.22];
  boardYs.forEach((y) => add(0.28, 0.028, 3.54, woodMid, 0, y, 0));

  // books (instanced)
  const bookCols = [0x7d3b3b, 0x3e5a52, 0x8a6d3b, 0x44578a, 0x6b4a7a, 0x9c5a3c,
    0x5d6b42, 0xa08c5a, 0x734b3e, 0x42576b, 0x8a4a3a];
  const books = [];
  for (let c = 0; c < 7; c++) {
    const bottom = c === 0 ? 0.08 : boardYs[c - 1] + 0.014;
    const top = c < 6 ? boardYs[c] - 0.014 : 2.665;
    let z = -1.72;
    const zEnd = 1.72;
    while (z < zEnd - 0.02) {
      if (rand() < 0.055) { z += range(0.1, 0.24); continue; }   // breathing gap
      if (rand() < 0.06 && z < zEnd - 0.3) {                      // horizontal stack
        const n = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) {
          const col = new THREE.Color(pick(bookCols)).offsetHSL(0, 0, range(-0.05, 0.05));
          books.push({
            y: bottom + 0.018 + i * 0.035, z: z + 0.12,
            h: 0.034, w: 0.24, d: range(0.2, 0.24), col,
          });
        }
        z += 0.27;
        continue;
      }
      const w = range(0.024, 0.052);
      if (z + w > zEnd) break;
      const h = Math.min(range(0.2, 0.285), top - bottom - 0.015);
      const col = new THREE.Color(pick(bookCols)).offsetHSL(0, 0, range(-0.05, 0.05));
      books.push({ y: bottom + h / 2, z: z + w / 2, h, w, d: range(0.19, 0.25), col });
      z += w + 0.004;
    }
  }
  const inst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.85 }),
    books.length);
  const M = new THREE.Matrix4();
  books.forEach((b, i) => {
    M.compose(
      new THREE.Vector3(-0.005, b.y, b.z),
      new THREE.Quaternion(),
      new THREE.Vector3(b.d, b.h, b.w));
    inst.setMatrixAt(i, M);
    inst.setColorAt(i, b.col);
  });
  inst.castShadow = inst.receiveShadow = true;
  g.add(inst);
  room.add(g);
}

/* ---------------- rug (centred under the coffee table) ---------------- */
{
  const rug = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.015, 2.4),
    new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
  rug.position.set(2.11, 0.0075, 0);
  rug.receiveShadow = true;
  room.add(rug);
}

/* ---------------- floor lamp (west of the armchair) ---------------- */
let lampLight;
{
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.025, 20), brassMat);
  base.position.y = 0.0125; base.castShadow = true;
  g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.45, 10), brassMat);
  pole.position.y = 0.75; pole.castShadow = true;
  g.add(pole);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.19, 0.28, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0xe8d3a8, roughness: 0.9, side: THREE.DoubleSide,
      emissive: 0xffb45e, emissiveIntensity: 0.35,
    }));
  shade.position.y = 1.56;
  g.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8),
    new THREE.MeshStandardMaterial({ emissive: 0xffd9a0, emissiveIntensity: 3, color: 0x000000 }));
  bulb.position.y = 1.5;
  g.add(bulb);
  lampLight = new THREE.PointLight(0xffd6a0, 10, 0, 2);
  lampLight.position.set(0, 1.5, 0);
  lampLight.castShadow = true;
  lampLight.shadow.mapSize.set(512, 512);
  lampLight.shadow.camera.far = 8;
  lampLight.shadow.bias = -0.002;
  lampLight.shadow.normalBias = 0.03;
  g.add(lampLight);
  g.position.set(1.5, 0, -1.78);
  room.add(g);
}

/* ---------------- potted plant in the south-east corner ---------------- */
{
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.24, 14),
    new THREE.MeshStandardMaterial({ color: 0x8a4a30, roughness: 0.9 }));
  pot.position.y = 0.12; pot.castShadow = true;
  g.add(pot);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.02, 14),
    blackMat);
  soil.position.y = 0.235;
  g.add(soil);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e4a2c, roughness: 0.9 });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand();
    const lean = 0.18 + rand() * 0.2;   // kept small so nothing nears a wall
    const len = 0.34 + rand() * 0.22;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, len, 6), leafMat);
    stem.position.set(Math.cos(a) * lean * 0.5, 0.24 + len / 2, Math.sin(a) * lean * 0.5);
    stem.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    g.add(stem);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), leafMat);
    leaf.scale.set(0.55, 1.7, 0.8);
    leaf.position.set(Math.cos(a) * lean, 0.24 + len + 0.06, Math.sin(a) * lean);
    leaf.rotation.z = -Math.cos(a) * lean;
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(2.5, 0, 1.75);
  room.add(g);
}

/* ---------------- mantel decorations + candle flames ---------------- */
const candleFlames = [];
{
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xe6dcc2, roughness: 0.6 });
  [[-0.28, 0.15], [0.24, 0.21]].forEach(([zo, hh]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, hh, 10), candleMat);
    c.position.set(2.9, 1.27 + hh / 2, zo);
    c.castShadow = true;
    room.add(c);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    f.position.set(2.9, 1.29 + hh, zo);
    f.scale.set(0.045, 0.085, 1);
    room.add(f);
    candleFlames.push(f);
  });
  // little succulent on the mantel
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.038, 0.07, 10),
    new THREE.MeshStandardMaterial({ color: 0x8a4a30, roughness: 0.9 }));
  pot.position.set(2.92, 1.335, 0.52); pot.castShadow = true;
  room.add(pot);
  for (let i = 0; i < 5; i++) {
    const lf = new THREE.Mesh(new THREE.SphereGeometry(0.024, 6, 5), leafGreenMat());
    lf.scale.set(0.5, 1.4, 0.5);
    lf.position.set(2.92 + Math.cos(i * 2.2) * 0.02, 1.39 + (i % 2) * 0.02, 0.52 + Math.sin(i * 2.2) * 0.02);
    room.add(lf);
  }
  // painting above the mantel
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.6, 0.8), woodDark);
  frame.position.set(R.x - 0.017, 1.82, 0);
  room.add(frame);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.52),
    new THREE.MeshStandardMaterial({ map: paintTex(1), roughness: 0.9 }));
  art.position.set(R.x - 0.036, 1.82, 0);
  art.rotation.y = -Math.PI / 2;
  room.add(art);
  // two small frames on the south wall
  [[0.95, 1.68, 0.52, 0.66, 0], [1.75, 1.55, 0.42, 0.52, 2]].forEach(([x, y, w, h, s]) => {
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, h + 0.06, 0.035), woodDark);
    fr.position.set(x, y, R.z - 0.017);
    room.add(fr);
    const art2 = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: paintTex(s), roughness: 0.9 }));
    art2.position.set(x, y, R.z - 0.036);
    art2.rotation.y = Math.PI;
    room.add(art2);
  });
}
function leafGreenMat() {
  return new THREE.MeshStandardMaterial({ color: 0x3d5a35, roughness: 0.9 });
}

/* ---------------- fire: sprites + flickering light ---------------- */
const fireLight = new THREE.PointLight(0xff8a3c, 11, 7, 2);
fireLight.position.set(2.92, 0.55, 0);
room.add(fireLight);

const flames = [];
for (let i = 0; i < 4; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({
    map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    rotation: (rand() - 0.5) * 0.4,
  }));
  s.position.set(2.9 + rand() * 0.1, 0.32 + rand() * 0.16, (rand() - 0.5) * 0.4);
  s.scale.set(0.22, 0.3, 1);
  room.add(s);
  flames.push(s);
}

// rising embers
const EMBERS = 26;
const emberPos = new Float32Array(EMBERS * 3);
const emberSeed = [];
for (let i = 0; i < EMBERS; i++) {
  emberSeed.push({ z: (rand() - 0.5) * 0.5, ph: rand() * 10, sp: 0.25 + rand() * 0.4 });
}
const emberGeo = new THREE.BufferGeometry();
emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
const emberPts = new THREE.Points(emberGeo, new THREE.PointsMaterial({
  color: 0xff7733, size: 0.022, transparent: true, opacity: 0.9,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
room.add(emberPts);

/* ---------------- dust motes drifting in the lamplight ---------------- */
const DUST = 130;
const dustBase = [];
const dustPos = new Float32Array(DUST * 3);
for (let i = 0; i < DUST; i++) {
  const b = {
    x: range(-2.6, 2.8), y: range(0.3, 2.3), z: range(-2.0, 2.0),
    ph: rand() * 10, sp: 0.1 + rand() * 0.2,
  };
  dustBase.push(b);
  dustPos[i * 3] = b.x; dustPos[i * 3 + 1] = b.y; dustPos[i * 3 + 2] = b.z;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xffe8c0, size: 0.011, transparent: true, opacity: 0.22,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
scene.add(dust);

/* ---------------- lights ---------------- */
const hemi = new THREE.HemisphereLight(0x8aa2c8, 0x5a4636, 0.6);
scene.add(hemi);
if (isTop) hemi.intensity = 1.6; // brighter dollhouse lighting for the plan view

const moon = new THREE.DirectionalLight(0xa8c4e8, 0.9);
moon.position.set(0, 2.4, -8);
moon.target.position.set(0, 0, 1);
moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024);
moon.shadow.camera.left = -4.5; moon.shadow.camera.right = 4.5;
moon.shadow.camera.top = 4; moon.shadow.camera.bottom = -4;
moon.shadow.camera.near = 1; moon.shadow.camera.far = 16;
moon.shadow.bias = -0.0005;
moon.shadow.normalBias = 0.03;
if (isTop) moon.intensity = 0.25; // subtle shadows in the plan view
scene.add(moon, moon.target);

const pendantGrp = new THREE.Group();
let pendantLight;
{
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.55, 8), blackMat);
  cord.position.set(2.11, 2.425, 0);
  pendantGrp.add(cord);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.17, 0.16, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x2f4a3d, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide,
    }));
  shade.position.set(2.11, 2.1, 0);
  pendantGrp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8),
    new THREE.MeshStandardMaterial({ emissive: 0xffd9a0, emissiveIntensity: 3.2, color: 0x000000 }));
  bulb.position.set(2.11, 2.04, 0);
  pendantGrp.add(bulb);
  pendantLight = new THREE.PointLight(0xffc287, 12.5, 0, 2);
  pendantLight.position.set(2.11, 1.92, 0);
  pendantLight.castShadow = true;
  pendantLight.shadow.mapSize.set(512, 512);
  pendantLight.shadow.camera.far = 9;
  pendantLight.shadow.bias = -0.002;
  pendantLight.shadow.normalBias = 0.03;
  scene.add(pendantLight);   // stays on in top view — only its meshes hide
  room.add(pendantGrp);
  hideInTop.push(pendantGrp);
}

// cool fill from the window side
const fill = new THREE.PointLight(0x9fb8e8, 3.5, 6, 2);
fill.position.set(0, 2.1, -1.7);
scene.add(fill);

hideInTop.forEach((o) => { o.visible = !isTop; });

/* ---------------- animation ---------------- */
const startMs = performance.now();
let lastMs = startMs;

renderer.setAnimationLoop(() => {
  const nowMs = performance.now();
  lastMs = nowMs;
  const t = (nowMs - startMs) / 1000;

  fireLight.intensity = 10.5 + Math.sin(t * 11) * 1.6 + Math.sin(t * 23 + 1.7) * 1.2
    + Math.sin(t * 5.3) * 0.8;
  flames.forEach((f, i) => {
    const s = 0.9 + 0.18 * Math.sin(t * 12 + i * 2.1) + 0.1 * Math.sin(t * 7.3 + i);
    f.scale.set(0.22 * (0.9 + 0.1 * Math.sin(t * 9 + i)), 0.3 * s, 1);
    f.material.opacity = 0.72 + 0.2 * Math.sin(t * 10 + i * 1.3);
  });
  candleFlames.forEach((f, i) => {
    const s = 0.8 + 0.25 * Math.sin(t * 13 + i * 2.7) + 0.12 * Math.sin(t * 29 + i);
    f.scale.set(0.045, 0.085 * s, 1);
  });

  // embers rise and wrap
  for (let i = 0; i < EMBERS; i++) {
    const e = emberSeed[i];
    const y = 0.16 + ((t * e.sp + e.ph) % 0.75);
    emberPos[i * 3] = 2.92 + Math.sin(t * 2 + e.ph) * 0.06;
    emberPos[i * 3 + 1] = y;
    emberPos[i * 3 + 2] = e.z + Math.cos(t * 1.5 + e.ph) * 0.05;
  }
  emberGeo.attributes.position.needsUpdate = true;

  // dust drifts
  for (let i = 0; i < DUST; i++) {
    const b = dustBase[i];
    dustPos[i * 3] = b.x + Math.sin(t * b.sp + b.ph) * 0.18;
    dustPos[i * 3 + 1] = b.y + Math.sin(t * b.sp * 0.7 + b.ph * 2) * 0.12;
    dustPos[i * 3 + 2] = b.z + Math.cos(t * b.sp * 0.9 + b.ph) * 0.14;
  }
  dustGeo.attributes.position.needsUpdate = true;

  controls.update();
  renderer.render(scene, camera);
});

/* ---------------- resize ---------------- */
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  if (isTop) {
    fitOrtho(w / h);
  } else {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  renderer.setSize(w, h);
});
