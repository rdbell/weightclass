import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng } from './rng.js';
import { toonMat, setRim, addThickness, paintGeo, canvasTexture, glowTexture, GRADIENTS } from './toon.js';

// World layout (metres). Tower at origin; park runs to +z (south); Seine at -x.
const GROUND_SIZE = 2400;
const TEX = 2048;
const S = TEX / GROUND_SIZE;

// ---------------------------------------------------------------- ground texture
function makeGroundTexture(rng) {
  return canvasTexture(TEX, (ctx) => {
    const P = (x, z) => [x * S + TEX / 2, z * S + TEX / 2];
    const rect = (x0, z0, x1, z1, color) => {
      const [ax, ay] = P(x0, z0);
      const [bx, by] = P(x1, z1);
      ctx.fillStyle = color;
      ctx.fillRect(ax, ay, bx - ax, by - ay);
    };

    // Grass base + painterly patches
    ctx.fillStyle = '#58ae63';
    ctx.fillRect(0, 0, TEX, TEX);
    const greens = ['#54a85e', '#5db568', '#52a260', '#61b96c', '#4f9e58', '#57b068'];
    for (let i = 0; i < 280; i++) {
      ctx.fillStyle = rng.pick(greens);
      ctx.globalAlpha = rng.range(0.06, 0.17);
      ctx.beginPath();
      ctx.ellipse(rng.range(0, TEX), rng.range(0, TEX), rng.range(12, 75), rng.range(10, 55), rng.range(0, 3.14), 0, 6.29);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Seine (west)
    rect(-330, -1200, -215, 1200, '#3f8fd4');
    rect(-285, -1200, -245, 1200, '#4a97da');
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 26; i++) {
      const [x, y] = P(rng.range(-320, -225), rng.range(-1150, 1150));
      ctx.beginPath();
      ctx.arc(x, y, rng.range(6, 26), rng.range(0, 6.29), rng.range(0, 6.29) + rng.range(1.5, 4));
      ctx.stroke();
    }
    // Embankment wall
    rect(-215, -1200, -190, 1200, '#cbb894');

    // Trocadero plaza (far south)
    rect(-135, 780, 135, 950, '#d9c9a5');
    ctx.strokeStyle = 'rgba(150,130,95,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const [x, y] = P(-135, 780 + i * 22);
      const [x2, y2] = P(135, 780 + i * 22);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    }

    // Central path
    rect(-9, 50, 9, 800, '#e6d6ac');
    rect(-9, 50, -7.5, 800, '#c4b28a');
    rect(7.5, 50, 9, 800, '#c4b28a');
    ctx.strokeStyle = 'rgba(160,140,100,0.55)';
    ctx.lineWidth = 2;
    for (let z = 60; z < 800; z += 12) {
      const [x, y] = P(-9, z);
      const [x2, y2] = P(9, z);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
    }
    // Cross path
    rect(-190, 296, 190, 312, '#e6d6ac');
    rect(-190, 296, 190, 297.5, '#c4b28a');
    rect(-190, 310.5, 190, 312, '#c4b28a');

    // Plaza around the tower
    {
      const [cx, cy] = P(0, 0);
      ctx.fillStyle = '#dccda7';
      ctx.beginPath();
      ctx.arc(cx, cy, 85 * S, 0, 6.29);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,140,100,0.6)';
      ctx.lineWidth = 2;
      for (let r = 14; r < 85; r += 14) {
        ctx.beginPath();
        ctx.arc(cx, cy, r * S, 0, 6.29);
        ctx.stroke();
      }
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * 85 * S, cy + Math.sin(a) * 85 * S);
        ctx.stroke();
      }
    }

    // Pond
    {
      const [cx, cy] = P(95, 305);
      ctx.fillStyle = '#3f8fd4';
      ctx.beginPath();
      ctx.ellipse(cx, cy, 47 * S, 60 * S, 0, 0, 6.29);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 47 * S, 60 * S, 0, 0, 6.29);
      ctx.stroke();
    }

    // Flower beds along the paths
    const petals = ['#f2a0b8', '#f2d05a', '#e8e8e8', '#c88ae0', '#f28a5a'];
    for (let i = 0; i < 150; i++) {
      const side = rng.sign();
      const x = side * rng.range(12, 18);
      const z = rng.range(70, 780);
      const [px, py] = P(x, z);
      ctx.fillStyle = rng.pick(petals);
      ctx.beginPath();
      ctx.arc(px, py, rng.range(1.5, 3.5), 0, 6.29);
      ctx.fill();
    }
  }, { srgb: true });
}

// ---------------------------------------------------------------- ripple / streak textures
function makeRippleTexture(rng) {
  return canvasTexture(256, (ctx) => {
    // Opaque base (material is opaque; transparent texels would render black).
    ctx.fillStyle = '#cfd8e4';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 10; i++) {
      ctx.lineWidth = rng.range(1.5, 3);
      ctx.globalAlpha = rng.range(0.2, 0.5);
      ctx.beginPath();
      ctx.arc(rng.range(0, 256), rng.range(0, 256), rng.range(10, 60), rng.range(0, 6.29), rng.range(0, 6.29) + rng.range(1, 4));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, { repeat: [1, 1] });
}

function makeStreakTexture(rng) {
  return canvasTexture(128, (ctx) => {
    ctx.clearRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) {
      const w = 10 + 26 * Math.sin(y * 0.16) * Math.sin(y * 0.05 + 1.7) + rng.range(-6, 6);
      const a = 0.12 + 0.5 * (1 - Math.abs(y / 128 - 0.5) * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.max(0.02, a).toFixed(3)})`;
      ctx.fillRect(64 - Math.max(3, w) / 2, y, Math.max(3, w), 1);
    }
  }, { srgb: true });
}

function makeWindowTexture(rng, seed) {
  const r = makeRngLike(seed);
  return canvasTexture(128, (ctx) => {
    ctx.fillStyle = '#141a2c';
    ctx.fillRect(0, 0, 128, 128);
    const margin = 15;
    const cell = 12;
    const gap = (128 - margin * 2) / 8;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const lit = r() < 0.52;
        ctx.fillStyle = lit ? '#ffd98a' : '#2a3550';
        ctx.fillRect(margin + i * gap, margin + j * gap, cell, cell);
      }
    }
  }, { srgb: true, repeat: [1, 1] });
}

// tiny local rng so texture variants are deterministic
function makeRngLike(seed) { return makeRng(seed).next; }

// Subtle window-grid facade texture (multiplied into vertex colours).
function makeFacadeTexture(rng) {
  return canvasTexture(128, (ctx) => {
    ctx.fillStyle = '#a3a3a3';
    ctx.fillRect(0, 0, 128, 128);
    const margin = 15;
    const cell = 12;
    const gap = (128 - margin * 2) / 8;
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const v = rng.next() < 0.45 ? 138 : 168;
        ctx.fillStyle = `rgb(${v},${v},${v + 6})`;
        ctx.fillRect(margin + i * gap, margin + j * gap, cell, cell);
      }
    }
  }, { srgb: true, repeat: [1, 1] });
}

function makeStripeTexture() {
  return canvasTexture(128, (ctx) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#f2f0e8' : '#d95a4a';
      ctx.fillRect(i * 16, 0, 16, 128);
    }
  }, { srgb: true, repeat: [2, 1] });
}

// ---------------------------------------------------------------- people
const SHIRTS = [0xe85d4a, 0xf2a93b, 0x4a90d9, 0x7a5cc4, 0x3aa88a, 0xd94f8a, 0x5a6a7a, 0xe8e0d0, 0x8a5a3a];
const SKINS = [0xf2c9a0, 0xd9a878, 0xc98a5a, 0x8a5a3a];

function personGeo(rng) {
  const body = new THREE.CapsuleGeometry(0.45, 0.85, 4, 10);
  body.translate(0, 1.0, 0);
  paintGeo(body, rng.pick(SHIRTS));
  const head = new THREE.SphereGeometry(0.4, 12, 10);
  head.translate(0, 2.0, 0);
  paintGeo(head, rng.pick(SKINS));
  const g = mergeGeometries([body, head]);
  addThickness(g, 0.13);
  return g;
}

// ---------------------------------------------------------------- trees
function treeGeos(rng) {
  const trunks = [];
  const leaves = [];
  const round = rng.next() < 0.72;
  if (round) {
    const trunk = new THREE.CylinderGeometry(0.5, 0.75, 4.6, 6);
    trunk.translate(0, 2.3, 0);
    paintGeo(trunk, 0xffffff, rng.range(0.85, 1.1));
    trunks.push(trunk);
    const blobs = [
      [4.6, 0, 5.6, 0, 0.8],
      [3.7, 1.8, 8.2, 0.9, 1.0],
      [2.9, -1.3, 9.9, -0.7, 1.12],
    ];
    for (const [r, ox, oy, oz, m] of blobs) {
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.scale(1, 0.92, 1);
      g.translate(ox, oy, oz);
      paintGeo(g, 0xffffff, m);
      leaves.push(g);
    }
  } else {
    const trunk = new THREE.CylinderGeometry(0.4, 0.6, 3.4, 6);
    trunk.translate(0, 1.7, 0);
    paintGeo(trunk, 0xffffff, rng.range(0.85, 1.1));
    trunks.push(trunk);
    const cones = [
      [3.8, 4.2, 4.6, 0.85],
      [3.0, 3.6, 6.6, 1.0],
      [2.1, 3.2, 8.4, 1.12],
    ];
    for (const [r, h, y, m] of cones) {
      const g = new THREE.ConeGeometry(r, h, 7).toNonIndexed();
      g.translate(0, y, 0);
      paintGeo(g, 0xffffff, m);
      leaves.push(g);
    }
  }
  return { trunks, leaves };
}

// ---------------------------------------------------------------- build
export function buildEnvironment(ctx) {
  const { rng, outlineMat, glow } = ctx;

  const group = new THREE.Group();

  // -- ground
  const groundTex = makeGroundTexture(rng);
  const groundMat = toonMat({ map: groundTex, gradient: GRADIENTS.g3, rimStrength: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // -- water
  const rippleTex = makeRippleTexture(rng);
  const waterMat = toonMat({ map: rippleTex, gradient: GRADIENTS.g3, rimStrength: 0 });
  waterMat.side = THREE.DoubleSide;
  const river = new THREE.Mesh(new THREE.PlaneGeometry(115, GROUND_SIZE), waterMat);
  river.rotation.x = -Math.PI / 2;
  river.position.set(-265, 0.07, 0);
  river.receiveShadow = true;
  group.add(river);

  const pondGeo = new THREE.CircleGeometry(1, 40);
  pondGeo.scale(47, 60, 1);
  const pond = new THREE.Mesh(pondGeo, waterMat);
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(95, 0.07, 305);
  pond.receiveShadow = true;
  group.add(pond);

  // -- moon reflections
  const streakTex = makeStreakTexture(rng);
  const mkReflection = (w, len, x, z, scale) => {
    const mat = new THREE.MeshBasicMaterial({
      map: streakTex, color: 0xbfd4ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.14, z);
    if (scale) m.scale.set(1, scale, 1);
    group.add(m);
    return mat;
  };
  const reflRiver = mkReflection(64, 2300, -265, 0);
  const reflPond = mkReflection(30, 44, 95, 305);

  // -- trees
  const trunkGeos = [];
  const leafGeos = [];
  const treeSpots = [];
  let attempts = 0;
  while (treeSpots.length < 46 && attempts < 500) {
    attempts++;
    const x = rng.range(-185, 185);
    const z = rng.range(80, 760);
    if (Math.abs(x) < 18) continue;
    if (Math.hypot(x, z) < 95) continue;
    if (x < -188) continue;
    if (((x - 95) / 56) ** 2 + ((z - 305) / 68) ** 2 < 1) continue;
    if (z > 770) continue;
    treeSpots.push([x, z, rng.range(0.8, 1.6), rng.range(0, 6.29)]);
  }
  for (const [x, z, s, ry] of treeSpots) {
    const { trunks, leaves } = treeGeos(rng);
    for (const g of trunks) { g.rotateY(ry); g.scale(s, s, s); g.translate(x, 0, z); addThickness(g, 0.22); trunkGeos.push(g); }
    for (const g of leaves) { g.rotateY(ry); g.scale(s, s, s); g.translate(x, 0, z); addThickness(g, 0.5); leafGeos.push(g); }
  }
  const trunkMat = toonMat({ vertexColors: true, gradient: GRADIENTS.g3, rimColor: 0xffe2b0, rimStrength: 0.12 });
  const leafMat = toonMat({ vertexColors: true, gradient: GRADIENTS.g3, rimColor: 0xffe2b0, rimStrength: 0.3, rimPower: 2.2 });
  const trunkGeo = mergeGeometries(trunkGeos, false);
  const leafGeo = mergeGeometries(leafGeos, false);
  const trunkMesh = new THREE.Mesh(trunkGeo, trunkMat);
  const leafMesh = new THREE.Mesh(leafGeo, leafMat);
  trunkMesh.castShadow = trunkMesh.receiveShadow = true;
  leafMesh.castShadow = leafMesh.receiveShadow = true;
  group.add(trunkMesh, leafMesh, new THREE.Mesh(leafGeo, outlineMat), new THREE.Mesh(trunkGeo, outlineMat));

  // -- people
  const peopleMat = toonMat({ vertexColors: true, gradient: GRADIENTS.g3, rimColor: 0xffffff, rimStrength: 0.22 });
  const people = [];
  const mkPerson = (x, z) => {
    const g = personGeo(rng);
    const m = new THREE.Mesh(g, peopleMat);
    const o = new THREE.Mesh(g, outlineMat);
    const holder = new THREE.Group();
    holder.add(m, o);
    holder.position.set(x, 0, z);
    group.add(holder);
    return { holder, phase: rng.range(0, 6.29) };
  };
  for (let i = 0; i < 6; i++) {
    const p = mkPerson(rng.sign() * 4.5, rng.range(90, 690));
    p.walker = { z: p.holder.position.z, dir: rng.sign(), speed: rng.range(10, 16) };
    people.push(p);
  }
  for (let i = 0; i < 8; i++) {
    let x, z;
    if (i < 3) { const a = rng.range(0, 6.29); const r = rng.range(30, 72); x = Math.cos(a) * r; z = Math.sin(a) * r; }
    else { x = rng.sign() * rng.range(3, 7); z = rng.range(100, 660); }
    people.push(mkPerson(x, z));
  }

  // -- lamps
  const lampPoleGeos = [];
  const lampHeadGeos = [];
  const lampPos = [];
  for (const sx of [1, -1]) {
    for (const z of [130, 290, 450, 610]) lampPos.push([sx * 11, z]);
  }
  for (const [x, z] of lampPos) {
    const pole = new THREE.CylinderGeometry(0.18, 0.28, 6.5, 6);
    pole.translate(x, 3.25, z);
    paintGeo(pole, 0x454a58);
    addThickness(pole, 0.09);
    const base = new THREE.CylinderGeometry(0.55, 0.75, 0.5, 8);
    base.translate(x, 0.25, z);
    paintGeo(base, 0x454a58);
    addThickness(base, 0.1);
    lampPoleGeos.push(pole, base);
    const head = new THREE.SphereGeometry(0.75, 10, 8);
    head.translate(x, 6.9, z);
    addThickness(head, 0.12);
    const cap = new THREE.ConeGeometry(0.5, 0.6, 8);
    cap.translate(x, 7.85, z);
    addThickness(cap, 0.1);
    lampHeadGeos.push(head, cap);
  }
  const lampPoleMat = toonMat({ vertexColors: true, gradient: GRADIENTS.g3, rimStrength: 0 });
  const lampHeadMat = new THREE.MeshBasicMaterial({ color: 0x565b68, toneMapped: false });
  const lampPoleMesh = new THREE.Mesh(mergeGeometries(lampPoleGeos), lampPoleMat);
  lampPoleMesh.castShadow = true;
  const lampHeadMesh = new THREE.Mesh(mergeGeometries(lampHeadGeos), lampHeadMat);
  group.add(lampPoleMesh, lampHeadMesh, new THREE.Mesh(mergeGeometries(lampPoleGeos.map((g) => g.clone())), outlineMat));

  const lampSprites = [];
  const lampLights = [];
  for (const [x, z] of lampPos) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture([255, 196, 110]), color: 0xffc06a,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false,
    }));
    sp.position.set(x, 6.9, z);
    sp.scale.setScalar(7);
    group.add(sp);
    lampSprites.push({ sp, phase: rng.range(0, 6.29) });
  }
  for (const [x, z] of [[11, 290], [-11, 290], [11, 530], [-11, 530]]) {
    const l = new THREE.PointLight(0xffb45e, 0, 110, 2);
    l.position.set(x, 6.9, z);
    group.add(l);
    lampLights.push(l);
  }

  // -- skyline
  const buildingColors = [0x8a93a8, 0xa89a86, 0x96867a, 0x7a86a0, 0xa08a78, 0x86968a, 0x9a8a9a, 0x7a7a8a];
  const winTexes = [makeWindowTexture(rng, 11), makeWindowTexture(rng, 22), makeWindowTexture(rng, 33)];
  const bGroups = [[], [], []];
  let placed = 0;
  for (let i = 0; i < 110; i++) {
    const a = (i / 110) * Math.PI * 2 + rng.range(-0.03, 0.03);
    const r = rng.range(850, 1150);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (z > 680 && Math.abs(x) < 300) continue; // trocadero sector
    if (x < -185) continue; // river / embankment
    const h = rng.next() < 0.1 ? rng.range(160, 230) : rng.range(30, 150);
    const w = rng.range(30, 70);
    const d = rng.range(30, 70);
    const g = new THREE.BoxGeometry(w, h, d);
    // scale window UVs per face (6 m per cell); roofs map to dark border
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) {
      for (let v = 0; v < 4; v++) {
        const i = f * 4 + v;
        if (f === 2 || f === 3) { uv.setXY(i, 0.05, 0.05); continue; }
        const us = f < 2 ? d / 6 : w / 6;
        uv.setXY(i, uv.getX(i) * us, uv.getY(i) * (h / 6));
      }
    }
    g.translate(x, h / 2, z);
    paintGeo(g, rng.pick(buildingColors), rng.range(0.85, 1.1));
    bGroups[placed % 3].push(g);
    placed++;
  }
  const facadeTex = makeFacadeTexture(rng);
  const buildingMats = winTexes.map((tex) =>
    toonMat({ vertexColors: true, map: facadeTex, emissiveMap: tex, emissive: 0xffcf7a, emissiveIntensity: 0, gradient: GRADIENTS.g3, rimColor: 0xffffff, rimStrength: 0.1 })
  );
  bGroups.forEach((geos, i) => {
    if (!geos.length) return;
    const m = new THREE.Mesh(mergeGeometries(geos, false), buildingMats[i]);
    m.castShadow = false;
    m.receiveShadow = true;
    group.add(m);
  });

  // -- landmarks (trocadero, cathedral, montparnasse, bridge, stalls, fountain basin)
  const lmGeos = [];
  const lm = (geo, color, x, y, z) => {
    geo.translate(x, y, z);
    paintGeo(geo, color, rng.range(0.9, 1.1));
    addThickness(geo, 0.5);
    lmGeos.push(geo);
  };
  lm(new THREE.BoxGeometry(150, 36, 46), 0xb8ad98, 0, 18, 850);
  lm(new THREE.CylinderGeometry(16, 16, 10, 14), 0xa89a86, 0, 41, 850);
  lm(new THREE.SphereGeometry(18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x7a8a9a, 0, 46, 850);
  lm(new THREE.BoxGeometry(60, 26, 40), 0xb0a590, -105, 13, 850);
  lm(new THREE.BoxGeometry(60, 26, 40), 0xb0a590, 105, 13, 850);
  // cathedral by the river
  lm(new THREE.BoxGeometry(46, 52, 30), 0x9a8a7a, -320, 26, 240);
  lm(new THREE.ConeGeometry(5, 26, 6), 0x6a6a7a, -332, 65, 240);
  lm(new THREE.ConeGeometry(5, 26, 6), 0x6a6a7a, -308, 65, 240);
  // montparnasse
  lm(new THREE.BoxGeometry(26, 200, 26), 0x8a8a96, -620, 100, 480);
  lm(new THREE.BoxGeometry(34, 34, 34), 0x8a8a96, -620, 217, 480);
  // bridge over the Seine
  lm(new THREE.BoxGeometry(130, 3, 22), 0xb8ad98, -265, 2.5, 520);
  lm(new THREE.BoxGeometry(8, 10, 24), 0xa89a86, -328, 2, 520);
  lm(new THREE.BoxGeometry(8, 10, 24), 0xa89a86, -202, 2, 520);
  // market stalls
  const stallPos = [[16, 200], [-16, 480]];
  for (const [x, z] of stallPos) {
    lm(new THREE.BoxGeometry(5, 3, 4), 0xa86a3e, x, 1.5, z);
    lm(new THREE.BoxGeometry(5, 1.2, 1), 0x8a5a3a, x, 1.1, z + 2.2);
  }
  // fountain basin + column (trocadero)
  lm(new THREE.CylinderGeometry(14, 15, 3, 18), 0xb8ad98, 0, 1.5, 780);
  lm(new THREE.CylinderGeometry(1.2, 1.6, 5, 10), 0xa89a86, 0, 4, 780);
  const landmarkMat = toonMat({ vertexColors: true, gradient: GRADIENTS.g3, rimColor: 0xffe2b0, rimStrength: 0.15 });
  const lmGeo = mergeGeometries(lmGeos, false);
  const lmMesh = new THREE.Mesh(lmGeo, landmarkMat);
  lmMesh.castShadow = true;
  lmMesh.receiveShadow = true;
  group.add(lmMesh, new THREE.Mesh(lmGeo, outlineMat));

  // stall awnings
  const awnGeos = [];
  for (const [x, z] of stallPos) {
    const g = new THREE.BoxGeometry(6, 0.35, 5.5);
    g.rotateX(0.3);
    g.translate(x, 3.5, z + 1.2);
    addThickness(g, 0.25);
    awnGeos.push(g);
  }
  const awnMat = toonMat({ map: makeStripeTexture(), gradient: GRADIENTS.g3, rimColor: 0xffe2b0, rimStrength: 0.2 });
  const awnMesh = new THREE.Mesh(mergeGeometries(awnGeos), awnMat);
  awnMesh.castShadow = true;
  group.add(awnMesh, new THREE.Mesh(mergeGeometries(awnGeos.map((g) => g.clone())), outlineMat));

  // -- fountain water
  const fountainWaterMat = new THREE.MeshBasicMaterial({ color: 0x3f92d6, transparent: true, opacity: 0.9, toneMapped: false });
  const fw = new THREE.Mesh(new THREE.CircleGeometry(12.5, 24), fountainWaterMat);
  fw.rotation.x = -Math.PI / 2;
  fw.position.set(0, 2.95, 780);
  group.add(fw);
  const jetMat = new THREE.MeshBasicMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const jet = new THREE.Mesh(new THREE.ConeGeometry(2.4, 11, 8), jetMat);
  jet.position.set(0, 9.5, 780);
  group.add(jet);

  // ---------------------------------------------------------------- palette
  function apply(p) {
    groundMat.color.copy(p.groundTint);
    waterMat.color.copy(p.waterColor);
    waterMat.emissive.copy(p.waterEmissive);
    waterMat.emissiveIntensity = p.waterEmissiveI;
    leafMat.color.copy(p.leafColor);
    setRim(leafMat, p.leafColor, 0.25 + p.starAlpha * 0.15);
    trunkMat.color.copy(p.trunkColor);
    peopleMat.color.copy(p.groundTint);
    lampHeadMat.color.copy(p.lampColor);
    for (const l of lampLights) l.intensity = p.lampLight * 900;
    for (const m of buildingMats) {
      m.color.copy(p.buildingTint);
      m.emissiveIntensity = p.buildingGlow * 0.9;
    }
    landmarkMat.color.copy(p.buildingTint);
    setRim(landmarkMat, p.platRim, 0.15);
    awnMat.color.copy(p.groundTint);
    fountainWaterMat.color.copy(p.waterColor);
    reflRiver.opacity = p.reflectionI * 0.5;
    reflPond.opacity = p.reflectionI * 0.55;
    jetMat.opacity = 0.3 + p.reflectionI * 0.35;
  }

  function anim(t, dt, p) {
    rippleTex.offset.x += dt * 0.035;
    rippleTex.offset.y += dt * 0.1;
    for (const per of people) {
      if (per.walker) {
        const w = per.walker;
        w.z += w.dir * w.speed * dt;
        if (w.z > 690) { w.z = 690; w.dir = -1; }
        if (w.z < 90) { w.z = 90; w.dir = 1; }
        per.holder.position.z = w.z;
        per.holder.position.y = Math.abs(Math.sin(t * 8 + per.phase)) * 0.28;
      } else {
        per.holder.rotation.z = Math.sin(t * 1.4 + per.phase) * 0.08;
        per.holder.position.y = Math.abs(Math.sin(t * 2.4 + per.phase)) * 0.1;
      }
    }
    for (const { sp, phase } of lampSprites) {
      sp.material.opacity = p.lampLight * (0.75 + 0.25 * Math.sin(t * 6 + phase));
    }
    jet.scale.y = 1 + 0.18 * Math.sin(t * 2.2);
  }

  return { group, apply, anim };
}
