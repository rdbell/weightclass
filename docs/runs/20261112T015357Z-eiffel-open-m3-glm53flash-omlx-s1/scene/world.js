import * as THREE from 'three';
import { hullMaterial } from './materials.js';

// ---------------------------------------------------------------------------
// Everything around the tower: banded sky, stars, sun/moon, striped lawns,
// paths, the river + bridge, a small Parisian skyline with glowing windows,
// toon trees, lamp posts, drifting clouds, birds, a barge and fireflies.
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Sky --------------------------------------------------------------------

export function buildSky(scene, mats) {
  const u = {
    uTop: { value: new THREE.Color(0x2e9be8) },
    uMid: { value: new THREE.Color(0x7fcbf5) },
    uHor: { value: new THREE.Color(0xd9f0f7) },
    uSunDir: { value: new THREE.Vector3(0.6, 0.7, 0.35) },
    uSunColor: { value: new THREE.Color(0xfff3b0) },
    uGlow: { value: 0.4 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(420, 48, 24),
    new THREE.ShaderMaterial({
      uniforms: u,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vDir = wp.xyz - cameraPosition;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uTop, uMid, uHor, uSunColor, uSunDir;
        uniform float uGlow;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = uHor;
          col = mix(col, uMid, step(0.10, h));
          col = mix(col, uTop, step(0.42, h));
          if (h < 0.0) col = uHor * 0.92;
          float sd = max(dot(d, normalize(uSunDir)), 0.0);
          col += uSunColor * uGlow * 0.35 * step(0.93, sd);
          col += uSunColor * uGlow * 0.45 * step(0.975, sd);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
  );
  scene.add(sky);

  // Stars
  const rng = mulberry32(4242);
  const N = 550;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = rng() * Math.PI * 2;
    const y = 0.12 + rng() * 0.85;
    const r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(a) * r * 400;
    pos[i * 3 + 1] = y * 400;
    pos[i * 3 + 2] = Math.sin(a) * r * 400;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(starGeo, mats.star);
  stars.frustumCulled = false;
  scene.add(stars);

  // Sun & moon sprites
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({
    map: discTexture('#ffdf60', '#fff0a0', null),
    transparent: true, depthWrite: false, fog: false,
  }));
  sun.scale.setScalar(42);
  sun.position.set(0.6, 0.7, 0.35).normalize().multiplyScalar(395);
  scene.add(sun);

  const moon = new THREE.Sprite(new THREE.SpriteMaterial({
    map: discTexture('#e8eefc', null, '#c9d5ec'),
    transparent: true, depthWrite: false, fog: false, opacity: 0,
  }));
  moon.scale.setScalar(36);
  moon.position.set(-0.45, 0.62, -0.42).normalize().multiplyScalar(395);
  scene.add(moon);

  return { u, stars, sun, moon };
}

function discTexture(core, ring, craters) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = core;
  x.beginPath(); x.arc(64, 64, 42, 0, Math.PI * 2); x.fill();
  if (ring) {
    x.strokeStyle = ring; x.lineWidth = 6;
    x.beginPath(); x.arc(64, 64, 48, 0, Math.PI * 2); x.stroke();
  }
  if (craters) {
    x.fillStyle = craters;
    for (const [cx, cy, r] of [[52, 50, 8], [76, 72, 6], [58, 80, 4], [80, 44, 4]]) {
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- Ground, park, river, city ----------------------------------------------

export function buildWorld(scene, mats) {
  const rng = mulberry32(20260714);
  const handles = { update: null };

  const flat = (geo, mat, y, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    if (rx) m.rotation.x = rx;
    m.position.y = y;
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // Ground layers
  flat(new THREE.CircleGeometry(280, 64), mats.baseGrass, 0, -Math.PI / 2);
  const lawn = flat(new THREE.PlaneGeometry(46, 164), mats.grass, 0.06, -Math.PI / 2);
  lawn.position.z = 10;
  flat(new THREE.PlaneGeometry(6.4, 174), mats.stone, 0.14, -Math.PI / 2).position.z = 9;
  flat(new THREE.PlaneGeometry(34, 6), mats.stone, 0.14, -Math.PI / 2).position.set(-36, 0.14, 0);
  flat(new THREE.PlaneGeometry(34, 6), mats.stone, 0.14, -Math.PI / 2).position.set(36, 0.14, 0);
  flat(new THREE.CircleGeometry(20, 48), mats.stone, 0.2, -Math.PI / 2);
  const ring = flat(new THREE.RingGeometry(20, 21.6, 48), mats.stoneDark, 0.19, -Math.PI / 2);
  ring.receiveShadow = false;

  // River + quays
  const water = flat(new THREE.PlaneGeometry(360, 19), mats.water, 0.1, -Math.PI / 2);
  water.position.z = -85.5;
  water.receiveShadow = false;
  const quayGeo = new THREE.BoxGeometry(360, 0.5, 3.2);
  const q1 = new THREE.Mesh(quayGeo, mats.stoneDark);
  q1.position.set(0, 0.12, -74.6); q1.receiveShadow = true; scene.add(q1);
  const q2 = new THREE.Mesh(quayGeo, mats.stoneDark);
  q2.position.set(0, 0.12, -96.4); q2.receiveShadow = true; scene.add(q2);

  // Bridge
  const bridge = new THREE.Group();
  const deck = new THREE.Mesh(new THREE.BoxGeometry(9, 1.3, 24), mats.stone);
  deck.position.set(0, 2.8, -85.5); deck.castShadow = deck.receiveShadow = true;
  bridge.add(deck);
  for (const pz of [-79, -92]) {
    const pier = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 2.2), mats.stoneDark);
    pier.position.set(0, 1.2, pz); pier.castShadow = true;
    bridge.add(pier);
  }
  const rampS = new THREE.Mesh(new THREE.BoxGeometry(9, 2.8, 6), mats.stone);
  rampS.position.set(0, 1.4, -71.5); rampS.castShadow = rampS.receiveShadow = true;
  bridge.add(rampS);
  const railGeo = new THREE.BoxGeometry(0.3, 0.9, 24);
  for (const rx of [-4.2, 4.2]) {
    const rl = new THREE.Mesh(railGeo, mats.stoneDark);
    rl.position.set(rx, 3.9, -85.5); rl.castShadow = true;
    bridge.add(rl);
  }
  for (const [lx, lz] of [[-3.6, -77], [3.6, -77], [-3.6, -94], [3.6, -94]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 2.4, 6), mats.iron);
    pole.position.set(lx, 4.5, lz); bridge.add(pole);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), mats.lampGlass);
    glass.position.set(lx, 5.85, lz); bridge.add(glass);
  }
  scene.add(bridge);

  // ---- Skyline ----------------------------------------------------------------
  const wallMats = [mats.wall, mats.wall2, mats.wall3, mats.wall4];
  const roofMats = [mats.roof, mats.roof2, mats.roof3];
  const windowXf = [];
  const chimneyXf = [];
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1);
  const QY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

  function addWindows(cx, cz, w, d, h, face) {
    const horiz = (face === 'x+' || face === 'x-');
    const off = horiz ? w / 2 + 0.07 : d / 2 + 0.07;
    const span = horiz ? d : w;
    const cols = Math.max(1, Math.floor((span - 1.4) / 1.6));
    const rows = Math.max(1, Math.floor((h - 2.6) / 2.5));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = -span / 2 + ((c + 0.5) * span) / cols;
        const y = 2.3 + r * 2.5;
        let px = cx, pz = cz;
        if (face === 'z+') pz = cz + off; else if (face === 'z-') pz = cz - off;
        else if (face === 'x+') px = cx + off; else px = cx - off;
        if (horiz) { M.compose(new THREE.Vector3(px, y, pz + a), QY, S); }
        else { M.compose(new THREE.Vector3(px + a, y, pz), Q, S); }
        windowXf.push(M.clone());
      }
    }
  }

  function building(x, z, rotY, facesTower) {
    const w = 7 + rng() * 5, d = 7 + rng() * 3, h = 8 + rng() * 9;
    const wall = wallMats[Math.floor(rng() * wallMats.length)];
    const roof = roofMats[Math.floor(rng() * roofMats.length)];
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wall);
    box.position.y = h / 2; box.castShadow = box.receiveShadow = true;
    g.add(box);
    const roofM = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.74, 2.4 + rng() * 1.6, 4), roof);
    roofM.rotation.y = Math.PI / 4;
    roofM.position.y = h + 1.3;
    roofM.castShadow = true;
    g.add(roofM);
    const nCh = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < nCh; i++) {
      M.compose(new THREE.Vector3((rng() - 0.5) * w * 0.5, h + 2.4, (rng() - 0.5) * d * 0.5), Q, S);
      chimneyXf.push(M.clone());
    }
    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
    // windows face the tower / river
    const face = facesTower ? (z < -98 ? 'z+' : (x > 0 ? 'x-' : 'x+')) : 'z+';
    addWindows(x, z, w, d, h, face);
  }

  for (let x = -72; x <= 72; x += 11) {
    if (Math.abs(x) < 7) continue;
    building(x + (rng() - 0.5) * 4, -100 - rng() * 4, 0, true);
  }
  for (const [bx, bz] of [[-46, -18], [-52, 16], [-58, 44], [47, -14], [53, 20], [59, 48]]) {
    building(bx + (rng() - 0.5) * 4, bz + (rng() - 0.5) * 6, 0, true);
  }

  const winMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 1.25, 0.12), mats.window, windowXf.length);
  windowXf.forEach((m, i) => winMesh.setMatrixAt(i, m));
  winMesh.instanceMatrix.needsUpdate = true;
  scene.add(winMesh);

  const chimMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 1.6, 0.8), mats.roof2, chimneyXf.length);
  chimneyXf.forEach((m, i) => chimMesh.setMatrixAt(i, m));
  chimMesh.instanceMatrix.needsUpdate = true;
  chimMesh.castShadow = true;
  scene.add(chimMesh);

  // ---- Trees --------------------------------------------------------------------
  const treeDefs = [];
  for (let z = 26; z <= 88; z += 6.5) {
    for (const sx of [-19.5, 19.5]) {
      if (rng() < 0.15) continue;
      treeDefs.push([sx + (rng() - 0.5) * 3, z + (rng() - 0.5) * 2, 0.85 + rng() * 0.45]);
    }
  }
  for (let z = -30; z >= -66; z -= 7) {
    for (const sx of [-18.5, 18.5]) {
      if (rng() < 0.2) continue;
      treeDefs.push([sx + (rng() - 0.5) * 3, z + (rng() - 0.5) * 2, 0.85 + rng() * 0.45]);
    }
  }

  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 2.6, 6);
  trunkGeo.translate(0, 1.3, 0);
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);
  const trunkXf = [];
  const blobXf = [[], [], []];
  const hull = hullMaterial(0.12);
  for (const [tx, tz, s] of treeDefs) {
    M.compose(new THREE.Vector3(tx, 0, tz), Q, new THREE.Vector3(s, s, s));
    trunkXf.push(M.clone());
    const blobs = [
      [0, 2.6 + s * 1.1, 0, 1.75],
      [(rng() - 0.5) * 2.0, 2.2 + s * 1.4, (rng() - 0.5) * 2.0, 1.1],
      [(rng() - 0.5) * 2.2, 3.0 + s * 1.2, (rng() - 0.5) * 2.2, 1.25],
    ];
    for (const [ox, oy, oz, r] of blobs) {
      const list = blobXf[Math.floor(rng() * 3)];
      M.compose(new THREE.Vector3(tx + ox * s, oy * s, tz + oz * s), Q, new THREE.Vector3(r * s, r * s * 0.9, r * s));
      list.push(M.clone());
    }
  }
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, mats.trunk, trunkXf.length);
  trunkXf.forEach((m, i) => trunkMesh.setMatrixAt(i, m));
  trunkMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.castShadow = trunkMesh.receiveShadow = true;
  trunkMesh.frustumCulled = false;
  scene.add(trunkMesh);
  const trunkHull = new THREE.InstancedMesh(trunkGeo, hull, trunkXf.length);
  trunkXf.forEach((m, i) => trunkHull.setMatrixAt(i, m));
  trunkHull.frustumCulled = false;
  scene.add(trunkHull);
  blobXf.forEach((list, i) => {
    const fm = new THREE.InstancedMesh(blobGeo, mats.foliage[i], list.length);
    list.forEach((m, j) => fm.setMatrixAt(j, m));
    fm.instanceMatrix.needsUpdate = true;
    fm.castShadow = fm.receiveShadow = true;
    fm.frustumCulled = false;
    scene.add(fm);
    const oh = new THREE.InstancedMesh(blobGeo, hull, list.length);
    list.forEach((m, j) => oh.setMatrixAt(j, m));
    oh.frustumCulled = false;
    scene.add(oh);
  });

  // Bushes around the plaza
  const bushXf = [];
  for (let i = 0; i < 15; i++) {
    const a = (i / 15) * Math.PI * 2 + 0.2;
    const r = 22.6 + rng() * 1.5;
    M.compose(new THREE.Vector3(Math.cos(a) * r, 0.55, Math.sin(a) * r), Q, new THREE.Vector3(1.3, 0.75, 1.3));
    bushXf.push(M.clone());
  }
  const bushMesh = new THREE.InstancedMesh(blobGeo, mats.foliage[2], bushXf.length);
  bushXf.forEach((m, i) => bushMesh.setMatrixAt(i, m));
  bushMesh.castShadow = true;
  scene.add(bushMesh);

  // ---- Lamp posts + glow pools ----------------------------------------------------
  const lampPos = [];
  for (const z of [-62, -40, -18, 30, 52, 74]) lampPos.push([5, z, 0], [-5, z, 0]);
  for (const [a, r] of [[0.6, 16], [2.2, 16], [3.9, 16], [5.5, 16]]) {
    lampPos.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
  }
  for (const [lx, lz] of [[-3.6, -77], [3.6, -77], [-3.6, -94], [3.6, -94]]) lampPos.push([lx, lz, 3.45]);

  const poleGeo = new THREE.CylinderGeometry(0.13, 0.16, 4.4, 6);
  poleGeo.translate(0, 2.2, 0);
  const glassGeo = new THREE.SphereGeometry(0.45, 10, 8);
  glassGeo.translate(0, 4.55, 0);
  const lp = lampPos.map(([x, z, y]) => new THREE.Vector3(x, y, z));
  const lampPoles = new THREE.InstancedMesh(poleGeo, mats.iron, lp.length);
  const lampGlasses = new THREE.InstancedMesh(glassGeo, mats.lampGlass, lp.length);
  lp.forEach((p, i) => { M.compose(p, Q, S); lampPoles.setMatrixAt(i, M); lampGlasses.setMatrixAt(i, M); });
  lampPoles.instanceMatrix.needsUpdate = lampGlasses.instanceMatrix.needsUpdate = true;
  lampPoles.castShadow = true;
  lampPoles.frustumCulled = lampGlasses.frustumCulled = false;
  scene.add(lampPoles, lampGlasses);

  const poolGeo = new THREE.CircleGeometry(2.4, 20);
  poolGeo.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolGeo, mats.pool, lp.length);
  lp.forEach((p, i) => { M.compose(new THREE.Vector3(p.x, p.y + 0.06, p.z), Q, S); pools.setMatrixAt(i, M); });
  pools.instanceMatrix.needsUpdate = true;
  scene.add(pools);

  // ---- Clouds ----------------------------------------------------------------------
  const cloudRng = mulberry32(777);
  const cloudData = [];
  let blobTotal = 0;
  for (let c = 0; c < 9; c++) {
    const blobs = [];
    const n = 4 + Math.floor(cloudRng() * 3);
    for (let i = 0; i < n; i++) {
      blobs.push({
        ox: (cloudRng() - 0.5) * 5, oy: (cloudRng() - 0.5) * 1.2, oz: (cloudRng() - 0.5) * 3,
        r: 1.6 + cloudRng() * 1.4,
      });
    }
    cloudData.push({
      x0: -160 + cloudRng() * 320,
      y: 55 + cloudRng() * 24,
      z: -130 + cloudRng() * 250,
      sp: 0.8 + cloudRng() * 1.0,
      blobs,
    });
    blobTotal += n;
  }
  const cloudMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mats.cloud, blobTotal);
  cloudMesh.frustumCulled = false;
  scene.add(cloudMesh);

  // ---- Barge --------------------------------------------------------------------------
  const boat = new THREE.Group();
  const hullB = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 8), mats.boat);
  hullB.position.y = 0.55; hullB.castShadow = true;
  boat.add(hullB);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.2, 3), mats.wall);
  cab.position.set(0, 1.6, -1.2); cab.castShadow = true;
  boat.add(cab);
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.25, 3.3), mats.roof);
  cabRoof.position.set(0, 2.3, -1.2);
  boat.add(cabRoof);
  boat.rotation.y = Math.PI / 2;
  scene.add(boat);

  // ---- Birds ----------------------------------------------------------------------------
  const birds = [];
  const wingGeo = new THREE.PlaneGeometry(1.5, 0.5);
  wingGeo.rotateX(-Math.PI / 2);
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const wl = new THREE.Mesh(wingGeo, mats.bird);
    wl.position.x = -0.75;
    const wr = new THREE.Mesh(wingGeo, mats.bird);
    wr.position.x = 0.75;
    g.add(wl, wr);
    g.scale.setScalar(0.8 + rng() * 0.5);
    scene.add(g);
    birds.push({ g, wl, wr, r: 26 + i * 4.5, y: 42 + i * 3, sp: 0.22 - i * 0.015, ph: rng() * 6 });
  }

  // ---- Fireflies --------------------------------------------------------------------------
  const FN = 36;
  const fData = [];
  for (let i = 0; i < FN; i++) {
    fData.push({
      x: -24 + rng() * 48, y: 0.8 + rng() * 3, z: 4 + rng() * 56,
      s1: 0.5 + rng(), s2: 0.5 + rng(), s3: 0.5 + rng(), ph: rng() * 6,
    });
  }
  const fGeo = new THREE.BufferGeometry();
  const fPos = new Float32Array(FN * 3);
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  const fireflies = new THREE.Points(fGeo, mats.firefly);
  fireflies.frustumCulled = false;
  scene.add(fireflies);

  // ---- Per-frame update -------------------------------------------------------------------
  const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), cs = new THREE.Vector3();
  handles.update = (t) => {
    // Clouds drift + wrap
    let idx = 0;
    for (const c of cloudData) {
      const cx = ((c.x0 + t * c.sp + 160) % 320) - 160;
      for (const b of c.blobs) {
        cs.set(b.r, b.r * 0.62, b.r);
        cm.compose(new THREE.Vector3(cx + b.ox, c.y + b.oy, c.z + b.oz), cq, cs);
        cloudMesh.setMatrixAt(idx++, cm);
      }
    }
    cloudMesh.instanceMatrix.needsUpdate = true;

    // Water shimmer
    mats.water.map.offset.x = (t * 0.013) % 1;
    mats.water.map.offset.y = (t * 0.004) % 1;

    // Barge
    boat.position.set(((t * 2.0 + 200) % 150) - 75, 0.12, -85.5);

    // Birds
    for (const b of birds) {
      const a = t * b.sp + b.ph;
      const px = Math.cos(a) * b.r, pz = Math.sin(a) * b.r;
      const py = b.y + Math.sin(t * 1.3 + b.ph) * 2;
      b.g.position.set(px, py, pz);
      b.g.lookAt(Math.cos(a + 0.12) * b.r, py, Math.sin(a + 0.12) * b.r);
      const flap = Math.sin(t * 9 + b.ph) * 0.55;
      b.wl.rotation.z = flap;
      b.wr.rotation.z = -flap;
    }

    // Fireflies
    for (let i = 0; i < FN; i++) {
      const f = fData[i];
      fPos[i * 3] = f.x + Math.sin(t * f.s1 + f.ph) * 1.8;
      fPos[i * 3 + 1] = f.y + Math.sin(t * f.s2 + f.ph * 1.7) * 0.8;
      fPos[i * 3 + 2] = f.z + Math.cos(t * f.s3 + f.ph * 0.6) * 1.8;
    }
    fGeo.attributes.position.needsUpdate = true;
  };

  handles.fireflies = fireflies;
  return handles;
}