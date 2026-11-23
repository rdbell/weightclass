import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ============================================================ utilities */

// Seeded RNG so every load looks the same.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260714);

const smooth01 = (t) => t * t * (3 - 2 * t);

// Monotone profile s(h): tower half-width (to each flat face) at height h.
function makeProfile(pts) {
  return function (h) {
    if (h <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [h0, s0] = pts[i], [h1, s1] = pts[i + 1];
      if (h <= h1) return s0 + (s1 - s0) * smooth01((h - h0) / (h1 - h0));
    }
    return pts[pts.length - 1][1];
  };
}
const S = makeProfile([
  [0, 62], [30, 52], [57.6, 34], [90, 26], [115.7, 20],
  [150, 13.5], [200, 8.6], [240, 7.3], [276, 6.6], [300, 6],
]);

// A bar (cylinder) from point a to point b, optional taper.
function bar(ax, ay, az, bx, by, bz, r, r2 = r) {
  const dir = new THREE.Vector3(bx - ax, by - ay, bz - az);
  const len = Math.max(dir.length(), 0.001);
  const g = new THREE.CylinderGeometry(r2, r, len, 8, 1, true);
  const q = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyMatrix4(new THREE.Matrix4()
    .makeRotationFromQuaternion(q)
    .setPosition((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2));
  return g;
}

function boxAt(w, h, d, x, y, z, ry = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return g;
}

function sphAt(r, x, y, z, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
}

function cylAt(rTop, rBot, h, x, y, z, seg = 10) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1);
  g.translate(x, y, z);
  return g;
}

// Tapered tube swept along a smooth curve through pts.
function tubeAlong(pts, radiusFn, radial = 12, segs = 56) {
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nor = [], uvs = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const c = curve.getPoint(t);
    const r = radiusFn(t);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const dx = N.x * ca + B.x * sa, dy = N.y * ca + B.y * sa, dz = N.z * ca + B.z * sa;
      pos.push(c.x + dx * r, c.y + dy * r, c.z + dz * r);
      nor.push(dx, dy, dz);
      uvs.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j, b = a + radial + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

/* ============================================================ renderer / scene */

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd8f0fb, 500, 2400);

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 1, 6000);
camera.position.set(310, 175, 395);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 120, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 90;
controls.maxDistance = 1150;
controls.maxPolarAngle = 1.535;
controls.autoRotate = true;
controls.autoRotateSpeed = -0.55;
controls.addEventListener('start', () => { controls.autoRotate = false; });

/* ============================================================ cel shading */

// Hard 4-step light bands shared by every toon material.
function gradientMap() {
  const steps = [110, 155, 205, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  const t = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
const grad = gradientMap();

const matGround = new THREE.MeshToonMaterial({ color: 0x7ec35f, gradientMap: grad });
const matPatch  = new THREE.MeshToonMaterial({ color: 0x6cb251, gradientMap: grad });
const matPath   = new THREE.MeshToonMaterial({ color: 0xecdcae, gradientMap: grad });
const matWater  = new THREE.MeshToonMaterial({ color: 0x56aae0, gradientMap: grad });
const matIron   = new THREE.MeshToonMaterial({ color: 0x8a5433, gradientMap: grad });
const matDeck   = new THREE.MeshToonMaterial({ color: 0xc39a62, gradientMap: grad });
const matTrunk  = new THREE.MeshToonMaterial({ color: 0x7a4f2e, gradientMap: grad });
const matLeaf   = new THREE.MeshToonMaterial({ color: 0x4da34d, gradientMap: grad });
const matCloud  = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: grad });
const matGlow   = new THREE.MeshBasicMaterial({ color: 0x9a7a45 });
const matBird   = new THREE.MeshBasicMaterial({ color: 0x2f2038 });
const matBeacon = new THREE.MeshBasicMaterial({ color: 0xff4d4d });

// Ink outline: back-face hull pushed out along view-space normals so the
// on-screen line width stays roughly constant with distance.
const outlineMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    uWidth: { value: 1.25 },
    uColor: { value: new THREE.Color(0x2f2038) },
  },
  vertexShader: /* glsl */`
    uniform float uWidth;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 n = normalize(normalMatrix * normal);
      float w = uWidth * 0.001 * max(-mv.z, 1.0);
      mv.xyz += n * w;
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 uColor;
    void main() { gl_FragColor = vec4(uColor, 1.0); }`,
});

function makeOutlined(geos, material, { cast = true, receive = true } = {}) {
  const group = new THREE.Group();
  const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  const hull = new THREE.Mesh(geo, outlineMat);
  hull.castShadow = false;
  hull.receiveShadow = false;
  group.add(mesh, hull);
  return group;
}

/* ============================================================ geometry buckets */

const iron = [], deck = [], glow = [], trunk = [], leaf = [], cloud = [], patch = [];

/* ---------------------------------------------------------- the tower */

const H1 = 57.6, H2 = 115.7, H3 = 276, HT = 300;
// corners in winding order so consecutive ones share a flat face
const CORNERS = [[1, 1], [1, -1], [-1, -1], [-1, 1]];

// Four curved, tapering legs.
const LEG_H = [0, 15, 32, 57.6, 85, 115.7, 145, 175, 205, 240, 276, 300];
for (const [sx, sz] of CORNERS) {
  const pts = LEG_H.map(h => new THREE.Vector3(sx * S(h), h, sz * S(h)));
  iron.push(tubeAlong(pts, t => 6.4 - 4.2 * Math.pow(t, 0.85), 12, 64));
}

// Ring beams + X bracing on every face.
const ringH = [8, 22, 40, H1, 72, 92, H2, 135, 158, 182, 205, 228, 252, H3, 288, HT];
const barR = (h) => (h < 60 ? 1.25 : h < 200 ? 1.0 : 0.75);

for (const h of ringH) {
  const r = barR(h);
  for (let f = 0; f < 4; f++) {
    const A = CORNERS[f], B = CORNERS[(f + 1) % 4];
    iron.push(bar(A[0] * S(h), h, A[1] * S(h), B[0] * S(h), h, B[1] * S(h), r));
  }
}
for (let i = 0; i < ringH.length - 1; i++) {
  const h0 = ringH[i], h1 = ringH[i + 1];
  if (h1 - h0 < 12) continue;
  const r = barR(h1) * 0.88;
  for (let f = 0; f < 4; f++) {
    const A = CORNERS[f], B = CORNERS[(f + 1) % 4];
    iron.push(bar(A[0] * S(h0), h0, A[1] * S(h0), B[0] * S(h1), h1, B[1] * S(h1), r));
    iron.push(bar(B[0] * S(h0), h0, B[1] * S(h0), A[0] * S(h1), h1, A[1] * S(h1), r));
  }
}

// The famous decorative arches under the first platform, hugging each face.
for (let f = 0; f < 4; f++) {
  const A = CORNERS[f], B = CORNERS[(f + 1) % 4];
  const pts = [];
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const h = 8 + 38 * Math.sin(Math.PI * t);
    const s = S(h);
    const px = s * (A[0] === B[0] ? A[0] : A[0] * (1 - 2 * t));
    const pz = s * (A[1] === B[1] ? A[1] : A[1] * (1 - 2 * t));
    pts.push(new THREE.Vector3(px, h, pz));
  }
  iron.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 2.3, 8, false));
}

// Platforms: deck slab + railings + a glow strip tucked under each edge.
function platform(h, half, th) {
  deck.push(boxAt(half * 2, th, half * 2, 0, h + th / 2, 0));
  const rTop = h + th + 1.7;
  for (let f = 0; f < 4; f++) {
    const A = CORNERS[f], B = CORNERS[(f + 1) % 4];
    const sharedX = A[0] === B[0];   // face lies at x = ±half
    const s = sharedX ? A[0] : A[1];
    for (const ry of [rTop, rTop - 1.4]) {
      iron.push(sharedX
        ? boxAt(0.55, 0.55, half * 2, s * half, ry, 0)
        : boxAt(half * 2, 0.55, 0.55, 0, ry, s * half));
    }
    const n = Math.max(2, Math.round(half / 5));
    for (let i = 0; i <= n; i++) {
      const t = -half + (2 * half * i) / n;
      iron.push(sharedX
        ? boxAt(0.45, 1.7, 0.45, s * half, h + th + 0.9, t)
        : boxAt(0.45, 1.7, 0.45, t, h + th + 0.9, s * half));
    }
    // under-edge lantern strip
    glow.push(sharedX
      ? boxAt(1.3, 1.0, half * 2 - 3, s * (half - 1.2), h - 0.7, 0)
      : boxAt(half * 2 - 3, 1.0, 1.3, 0, h - 0.7, s * (half - 1.2)));
  }
}
platform(H1, 42, 5);
platform(H2, 24, 4.5);
platform(H3, 10, 3.5);

// Top cabin, antenna mast, beacon.
deck.push(boxAt(13, 5, 13, 0, 282.5, 0));
for (let f = 0; f < 4; f++) {
  const A = CORNERS[f], B = CORNERS[(f + 1) % 4];
  const sharedX = A[0] === B[0];
  const s = sharedX ? A[0] : A[1];
  glow.push(sharedX
    ? boxAt(0.4, 1.4, 9, s * 6.7, 283, 0)
    : boxAt(9, 1.4, 0.4, 0, 283, s * 6.7));
}
iron.push(cylAt(0.55, 1.5, 46, 0, 323, 0, 8));
iron.push(boxAt(3.4, 0.7, 0.7, 0, 310, 0));
const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.15, 10, 8), matBeacon);
beacon.position.set(0, 346.5, 0);

/* ---------------------------------------------------------- the park */

// Ground disc.
const groundGeo = new THREE.CircleGeometry(950, 72);
groundGeo.rotateX(-Math.PI / 2);
const ground = new THREE.Mesh(groundGeo, matGround);
ground.receiveShadow = true;

// Crossing gravel paths + circular plaza (the axis of the Champ de Mars).
const path = [
  boxAt(1900, 0.9, 30, 0, 0.1, 0),
  boxAt(30, 0.9, 1900, 0, 0.1, 0),
  cylAt(95, 95, 1.0, 0, 0.1, 0, 48),
];

// Meadow tone patches.
for (let i = 0; i < 9; i++) {
  const a = rand() * Math.PI * 2, r = 140 + rand() * 380;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (Math.abs(z) < 38 || Math.abs(x) < 38 || x > 335) continue;
  patch.push(cylAt(30 + rand() * 55, 30 + rand() * 55, 0.5, x, 0.15, z, 26));
}

// The Seine: a straight band + a little bridge where the path crosses.
const water = [boxAt(150, 1.2, 1900, 470, 0.1, 0)];
deck.push(
  boxAt(176, 5, 30, 470, 4.0, 0),
  boxAt(176, 1.2, 1.2, 470, 7.6, 14.4),
  boxAt(176, 1.2, 1.2, 470, 7.6, -14.4),
);
iron.push(
  boxAt(7, 12, 7, 418, 4, 12), boxAt(7, 12, 7, 418, 4, -12),
  boxAt(7, 12, 7, 522, 4, 12), boxAt(7, 12, 7, 522, 4, -12),
);

// Lamp posts along both paths.
const LAMPS = [];
for (const a of [75, 165, 265]) {
  LAMPS.push([a, 32], [-a, 32], [a, -32], [-a, -32], [32, a], [32, -a], [-32, a], [-32, -a]);
}
for (const [x, z] of LAMPS) {
  iron.push(cylAt(0.55, 0.8, 10, x, 5, z, 7));
  iron.push(sphAt(1.15, x, 10.4, z, 1, 0.75, 1));
  glow.push(sphAt(1.35, x, 10.35, z));
}

// Trees around the lawn.
let planted = 0, guard = 0;
while (planted < 26 && guard++ < 400) {
  const a = rand() * Math.PI * 2, r = 150 + rand() * 330;
  const x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (x > 335) continue;
  if (Math.abs(z) < 36 || Math.abs(x) < 36) continue;
  if (x * x + z * z < 125 * 125) continue;
  const trunkH = 7 + rand() * 4;
  trunk.push(cylAt(1.5 + rand() * 0.7, 2.2 + rand() * 0.8, trunkH, x, trunkH / 2, z, 7));
  const cr = 5.5 + rand() * 3.5;
  leaf.push(sphAt(cr, x, trunkH + cr * 0.75, z, 1, 0.9, 1));
  leaf.push(sphAt(cr * 0.72, x + (rand() - 0.5) * cr * 1.5, trunkH + cr * 1.35, z + (rand() - 0.5) * cr * 1.5));
  leaf.push(sphAt(cr * 0.6, x + (rand() - 0.5) * cr * 1.7, trunkH + cr * 0.4, z + (rand() - 0.5) * cr * 1.7));
  planted++;
}

// Puffy clouds.
for (let i = 0; i < 7; i++) {
  const a = rand() * Math.PI * 2, r = 380 + rand() * 480, y = 250 + rand() * 150;
  const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
  const n = 3 + ((rand() * 3) | 0);
  for (let j = 0; j < n; j++) {
    const rr = 16 + rand() * 15;
    cloud.push(sphAt(rr, cx + (rand() - 0.5) * 46, y + (rand() - 0.5) * 9, cz + (rand() - 0.5) * 46, 1, 0.55, 1));
  }
}

/* ---------------------------------------------------------- assemble */

const cloudMesh = new THREE.Mesh(mergeGeometries(cloud, false), matCloud);
const clouds = cloudMesh; // soft white puffs stay outline-free
const towerIron = makeOutlined(iron, matIron);
const towerDeck = makeOutlined(deck, matDeck);
const glowMesh = new THREE.Mesh(mergeGeometries(glow, false), matGlow);
const treeTrunks = makeOutlined(trunk, matTrunk);
const treeCrowns = makeOutlined(leaf, matLeaf);
const paths = new THREE.Mesh(mergeGeometries(path, false), matPath);
const meadows = new THREE.Mesh(mergeGeometries(patch, false), matPatch);
const river = new THREE.Mesh(mergeGeometries(water, false), matWater);
paths.receiveShadow = meadows.receiveShadow = river.receiveShadow = true;

scene.add(ground, paths, meadows, river, towerIron, towerDeck, glowMesh,
  treeTrunks, treeCrowns, clouds, beacon);

// The little barge puttering along the Seine.
const boat = makeOutlined([
  boxAt(34, 4, 9, 0, 2.4, 0),
  boxAt(10, 4.5, 7, 3, 6.6, 0),
  boxAt(2.2, 7, 0.6, -13, 7.5, 0),
  cylAt(0.25, 0.25, 6, -13, 13, 0, 6),
], matDeck);
scene.add(boat);

// Soft radial glow sprites (generated in code) for lamps & lanterns.
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0.0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const matHalo = new THREE.SpriteMaterial({
  map: makeGlowTexture(), color: 0xffc46a,
  transparent: true, opacity: 0, depthWrite: false,
});
const halos = [];
function addHalo(x, y, z, size) {
  const s = new THREE.Sprite(matHalo);
  s.position.set(x, y, z);
  s.scale.setScalar(size);
  scene.add(s);
  halos.push(s);
}
for (const [x, z] of LAMPS) addHalo(x, 10.4, z, 11);
for (const [h, half] of [[H1, 42], [H2, 24], [H3, 10]]) {
  addHalo(half, h - 1, 0, half * 0.85);
  addHalo(-half, h - 1, 0, half * 0.85);
  addHalo(0, h - 1, half, half * 0.85);
  addHalo(0, h - 1, -half, half * 0.85);
}
addHalo(0, 283, 0, 22); // cabin windows
const matBeaconHalo = matHalo.clone();
matBeaconHalo.color.set(0xff5a4a);
const beaconHalo = new THREE.Sprite(matBeaconHalo);
beaconHalo.position.copy(beacon.position);
beaconHalo.scale.setScalar(7);
scene.add(beaconHalo);

/* ---------------------------------------------------------- sky, sun, stars */

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    uTop:    { value: new THREE.Color(0x4aa3e8) },
    uMid:    { value: new THREE.Color(0x8ecdf2) },
    uHor:    { value: new THREE.Color(0xd8f0fb) },
    uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.4) },
    uGlowC:  { value: new THREE.Color(0xffffff) },
    uGlowR:  { value: 0.16 },
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vDir;
    uniform vec3 uTop, uMid, uHor, uGlowC, uSunDir;
    uniform float uGlowR;
    void main() {
      vec3 d = normalize(vDir);
      vec3 c = uHor;
      c = mix(c, uMid, step(0.06, d.y));
      c = mix(c, uTop, step(0.40, d.y));
      float sd = distance(d, normalize(uSunDir));
      c = mix(c, uGlowC, step(sd, uGlowR));
      gl_FragColor = vec4(c, 1.0);
    }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1600, 32, 18), skyMat);
sky.renderOrder = -2;
scene.add(sky);

const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40),
  new THREE.MeshBasicMaterial({ color: 0xfff2b8, fog: false }));
sunDisc.renderOrder = -1;
scene.add(sunDisc);

// Stars (visible at night).
const starPos = [];
for (let i = 0; i < 420; i++) {
  const a = rand() * Math.PI * 2;
  const y = 0.12 + rand() * 0.88;
  const rr = Math.sqrt(1 - y * y);
  starPos.push(Math.cos(a) * rr * 1500, y * 1500, Math.sin(a) * rr * 1500);
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
const matStars = new THREE.PointsMaterial({
  color: 0xffffff, size: 3.2, sizeAttenuation: false,
  transparent: true, opacity: 0, fog: false, depthWrite: false,
});
const stars = new THREE.Points(starGeo, matStars);
scene.add(stars);

/* ---------------------------------------------------------- lights */

const sun = new THREE.DirectionalLight(0xfff1cf, 3.4);
sun.position.set(360, 480, 250);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 2400;
sun.shadow.camera.left = sun.shadow.camera.bottom = -900;
sun.shadow.camera.right = sun.shadow.camera.top = 900;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 1.6;
scene.add(sun, sun.target);

const hemi = new THREE.HemisphereLight(0xcde9ff, 0x8fbf72, 1.0);
scene.add(hemi);
const amb = new THREE.AmbientLight(0xcfe4ff, 0.32);
scene.add(amb);

const lampLightA = new THREE.PointLight(0xffb35c, 0, 300, 2);
lampLightA.position.set(0, 62, 0);
const lampLightB = new THREE.PointLight(0xffb35c, 0, 260, 2);
lampLightB.position.set(56, 12, 56);
scene.add(lampLightA, lampLightB);

/* ============================================================ day / dusk / night */

const MODES = {
  day: {
    skyTop: 0x4aa3e8, skyMid: 0x8ecdf2, skyHorizon: 0xd8f0fb, fog: 0xd8f0fb,
    sun: 0xfff1cf, sunInt: 3.4, sunPos: [360, 480, 250],
    hemiSky: 0xcde9ff, hemiGround: 0x8fbf72, hemiInt: 1.0,
    amb: 0xcfe4ff, ambInt: 0.32,
    ground: 0x7ec35f, patch: 0x6cb251, path: 0xecdcae, water: 0x56aae0,
    iron: 0xa5663a, deck: 0xc39a62, trunk: 0x7a4f2e, leaf: 0x4da34d, cloud: 0xffffff,
    glow: 0x9a7a45, bird: 0x2f2038, outline: 0x2f2038,
    disc: 0xfff2b8, discSize: 60, glowR: 0.16, glowC: 0xffffff,
    haloC: 0xffc46a, stars: 0, lampInt: 0, halo: 0, birdsOn: true,
  },
  dusk: {
    skyTop: 0x46386e, skyMid: 0xb95f86, skyHorizon: 0xff9e58, fog: 0xeb9a62,
    sun: 0xffb469, sunInt: 2.8, sunPos: [560, 220, -300],
    hemiSky: 0xd98a9a, hemiGround: 0x6a5340, hemiInt: 0.85,
    amb: 0xffd2b8, ambInt: 0.38,
    ground: 0x649c4c, patch: 0x57903f, path: 0xd8b488, water: 0x7a7fc0,
    iron: 0x84502f, deck: 0xb08050, trunk: 0x6a4226, leaf: 0x3f8243, cloud: 0xffc39b,
    glow: 0xffbe66, bird: 0x2a1830, outline: 0x2a1830,
    disc: 0xffb050, discSize: 95, glowR: 0.42, glowC: 0xff9a4a,
    haloC: 0xffa050, stars: 0.3, lampInt: 1500, halo: 0.5, birdsOn: true,
  },
  night: {
    skyTop: 0x0b1130, skyMid: 0x1d2b58, skyHorizon: 0x3d5484, fog: 0x2c3d63,
    sun: 0xcddcff, sunInt: 2.0, sunPos: [-330, 430, -280],
    hemiSky: 0x44548c, hemiGround: 0x262c48, hemiInt: 1.1,
    amb: 0x9fb4e8, ambInt: 0.55,
    ground: 0x2f5c40, patch: 0x275137, path: 0x8f89a8, water: 0x2c4a7c,
    iron: 0x5a6a96, deck: 0x7a6a4e, trunk: 0x4a3a2a, leaf: 0x2f6244, cloud: 0x46527a,
    glow: 0xffd98c, bird: 0x10101e, outline: 0x10101e,
    disc: 0xeef4ff, discSize: 46, glowR: 0.10, glowC: 0xaac4ff,
    haloC: 0xffc46a, stars: 1, lampInt: 5200, halo: 0.85, birdsOn: false,
  },
};

const MATS = {
  ground: matGround, patch: matPatch, path: matPath, water: matWater,
  iron: matIron, deck: matDeck, trunk: matTrunk, leaf: matLeaf,
  cloud: matCloud, glow: matGlow, bird: matBird,
};

function snapMode(name) {
  const m = MODES[name];
  const c = {}, n = {};
  for (const k in MATS) c[k] = new THREE.Color(m[k]);
  c.skyTop = new THREE.Color(m.skyTop);
  c.skyMid = new THREE.Color(m.skyMid);
  c.skyHorizon = new THREE.Color(m.skyHorizon);
  c.fog = new THREE.Color(m.fog);
  c.sun = new THREE.Color(m.sun);
  c.hemiSky = new THREE.Color(m.hemiSky);
  c.hemiGround = new THREE.Color(m.hemiGround);
  c.amb = new THREE.Color(m.amb);
  c.disc = new THREE.Color(m.disc);
  c.outline = new THREE.Color(m.outline);
  c.glowC = new THREE.Color(m.glowC);
  c.haloC = new THREE.Color(m.haloC);
  n.sunInt = m.sunInt; n.hemiInt = m.hemiInt; n.ambInt = m.ambInt;
  n.stars = m.stars; n.lampInt = m.lampInt; n.discSize = m.discSize; n.glowR = m.glowR;
  n.halo = m.halo;
  return { c, n, sunPos: new THREE.Vector3(...m.sunPos) };
}

// ?tod=day|dusk|night
const urlMode = new URLSearchParams(location.search).get('tod');
const startMode = MODES[urlMode] ? urlMode : 'day';

let cur = snapMode(startMode);
let tgt = snapMode(startMode);
let modeName = startMode;

function setMode(name) {
  modeName = name;
  tgt = snapMode(name);
  document.querySelectorAll('.modes button').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === name));
  birds.forEach(b => { b.visible = tgt.c.bird && MODES[name].birdsOn; });
}

document.querySelectorAll('.modes button').forEach(b =>
  b.addEventListener('click', () => setMode(b.dataset.mode)));
addEventListener('keydown', (e) => {
  if (e.key === '1') setMode('day');
  if (e.key === '2') setMode('dusk');
  if (e.key === '3') setMode('night');
});

/* ---------------------------------------------------------- birds */

const birds = [];
for (let i = 0; i < 5; i++) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.5, 1.8), matBird);
  const wL = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 1.6), matBird);
  const wR = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.5, 1.6), matBird);
  wL.position.set(0, 0.3, 2.6);
  wR.position.set(0, 0.3, -2.6);
  wL.geometry.translate(0, 0, 2.3);
  wR.geometry.translate(0, 0, -2.3);
  g.add(body, wL, wR);
  g.userData = {
    r: 150 + rand() * 130, h: 170 + rand() * 70,
    sp: (0.12 + rand() * 0.1) * (rand() > 0.5 ? 1 : -1),
    ph: rand() * Math.PI * 2, flap: 7 + rand() * 4, wL, wR,
  };
  scene.add(g);
  birds.push(g);
}
setMode(startMode); // apply initial mode to UI + birds

/* ============================================================ loop */

const clock = new THREE.Clock();
const sunDir = new THREE.Vector3();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  // ease current palette toward the target one
  const k = 1 - Math.exp(-dt * 2.4);
  for (const key in MATS) cur.c[key].lerp(tgt.c[key], k);
  for (const key in cur.n) cur.n[key] += (tgt.n[key] - cur.n[key]) * k;
  cur.sunPos.lerp(tgt.sunPos, k);

  for (const key in MATS) MATS[key].color.copy(cur.c[key]);
  outlineMat.uniforms.uColor.value.copy(cur.c.outline);
  matStars.opacity = cur.n.stars;
  sunDisc.material.color.copy(cur.c.disc);
  sunDisc.scale.setScalar(Math.max(cur.n.discSize, 0.001));

  skyMat.uniforms.uTop.value.copy(cur.c.skyTop);
  skyMat.uniforms.uMid.value.copy(cur.c.skyMid);
  skyMat.uniforms.uHor.value.copy(cur.c.skyHorizon);
  skyMat.uniforms.uGlowC.value.copy(cur.c.glowC);
  skyMat.uniforms.uGlowR.value = cur.n.glowR;

  scene.fog.color.copy(cur.c.fog);

  sun.color.copy(cur.c.sun);
  sun.intensity = cur.n.sunInt;
  sun.position.copy(cur.sunPos);
  sunDir.copy(cur.sunPos).normalize();
  skyMat.uniforms.uSunDir.value.copy(sunDir);
  sunDisc.position.copy(sunDir).multiplyScalar(1520);
  sunDisc.lookAt(camera.position);

  hemi.color.copy(cur.c.hemiSky);
  hemi.groundColor.copy(cur.c.hemiGround);
  hemi.intensity = cur.n.hemiInt;
  amb.color.copy(cur.c.amb);
  amb.intensity = cur.n.ambInt;
  lampLightA.intensity = lampLightB.intensity = cur.n.lampInt;
  matHalo.opacity = cur.n.halo;
  matHalo.color.copy(cur.c.haloC);

  // ambient life
  clouds.rotation.y = t * 0.006;
  beacon.visible = (t % 1.4) < 0.7;
  beaconHalo.material.opacity = cur.n.halo > 0.05 ? (beacon.visible ? 0.9 : 0.15) : 0.25;
  for (const b of birds) {
    const u = b.userData;
    const a = t * u.sp + u.ph;
    b.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 0.7 + u.ph) * 6, Math.sin(a) * u.r);
    b.rotation.y = -a + (u.sp > 0 ? Math.PI / 2 : -Math.PI / 2);
    const f = Math.sin(t * u.flap + u.ph) * 0.55;
    u.wL.rotation.x = f;
    u.wR.rotation.x = -f;
  }
  const bz = 250 + 185 * Math.sin(t * 0.05 + 1.0);
  boat.position.set(470, 0, bz);
  boat.rotation.y = Math.cos(t * 0.05 + 1.0) > 0 ? 0 : Math.PI;

  controls.update();
  renderer.render(scene, camera);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
