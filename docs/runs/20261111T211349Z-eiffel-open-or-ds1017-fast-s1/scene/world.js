import * as THREE from 'three';
import {
  GeoBucket,
  mergeAll,
  canvasTexture,
  glowTexture,
  makeRng,
  rand,
  pick,
} from './utils.js';

const TAU = Math.PI * 2;
const PLAZA_R = 34;
const CAROUSEL = { x: -44.2, z: 25.5, r: 10.5 };
const CAFE = { x: 26.0, z: -45.0, r: 9.0 };
const CART = { x: 35.2, z: 16.6 };
const POND = { x: -55, z: -12, r: 9.5, sx: 1.22, sz: 0.86 };
const PARTERRES = [0.55, 1.85, 3.0, 4.2, 5.4].map((a) => ({ x: Math.cos(a) * 87, z: Math.sin(a) * 87, r: 4.2 }));

/* ------------------------------------------------------------------ *
 *  Geometry helpers
 * ------------------------------------------------------------------ */
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function groundTextures() {
  return { plaza: plazaTexture(), grass: grassTexture(), path: pathTexture() };
}

function plazaTexture() {
  return canvasTexture(1024, 1024, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;

    ctx.fillStyle = '#e6cfa4';
    ctx.fillRect(0, 0, w, h);

    // concentric paving rings
    const rings = [
      [0.0, 0.09, '#d3b384'],
      [0.09, 0.25, '#ecd9b2'],
      [0.25, 0.27, '#c4a678'],
      [0.27, 0.44, '#e4cda3'],
      [0.44, 0.46, '#bfa071'],
      [0.46, 0.63, '#eedcb6'],
      [0.63, 0.65, '#c4a678'],
      [0.65, 0.86, '#e3caa0'],
      [0.86, 0.875, '#b99a6d'],
      [0.875, 1.0, '#d9bd8e'],
    ];
    for (const [a, b, color] of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, b * cx, 0, TAU);
      ctx.arc(cx, cy, a * cx, 0, TAU, true);
      ctx.fillStyle = color;
      ctx.fill();
    }

    // radial grout lines
    ctx.strokeStyle = 'rgba(120, 90, 55, 0.30)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * cx * 0.09, cy + Math.sin(a) * cx * 0.09);
      ctx.lineTo(cx + Math.cos(a) * cx, cy + Math.sin(a) * cx);
      ctx.stroke();
    }
    // ring joints
    ctx.lineWidth = 2.5;
    for (const [a] of rings) {
      ctx.beginPath();
      ctx.arc(cx, cy, a * cx, 0, TAU);
      ctx.stroke();
    }

    // little tile joints in the outer fields
    ctx.strokeStyle = 'rgba(120, 90, 55, 0.16)';
    ctx.lineWidth = 1.5;
    for (let r = 0.2; r < 1; r += 0.035) {
      const n = Math.floor(TAU * r * 10);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + r * 6;
        const rr = r + 0.035;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r * cx, cy + Math.sin(a) * r * cx);
        ctx.lineTo(cx + Math.cos(a) * rr * cx, cy + Math.sin(a) * rr * cx);
        ctx.stroke();
      }
    }

    // central compass rose
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = '#9d8058';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, cx * 0.085, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
      ctx.rotate(TAU / 8);
      ctx.beginPath();
      ctx.moveTo(0, cx * 0.02);
      ctx.lineTo(cx * 0.065, 0);
      ctx.lineTo(0, -cx * 0.03);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? '#b5935e' : '#d7bd8c';
      ctx.fill();
    }
    ctx.restore();

    // soft wear speckles
    ctx.globalAlpha = 0.08;
    const rng = makeRng(8);
    for (let i = 0; i < 2600; i++) {
      const a = rng() * TAU;
      const r = Math.sqrt(rng()) * cx;
      ctx.fillStyle = rng() > 0.5 ? '#7f6642' : '#fff3d6';
      ctx.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2 + rng() * 5, 2 + rng() * 5);
    }
    ctx.globalAlpha = 1;
  });
}

function grassTexture() {
  return canvasTexture(
    512,
    512,
    (ctx, w, h) => {
      ctx.fillStyle = '#76a955';
      ctx.fillRect(0, 0, w, h);
      const rng = makeRng(99);
      const colors = ['#699c4b', '#82b35f', '#5f8f44', '#8bbc68', '#74a757'];
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
        const x = rng() * w;
        const y = rng() * h;
        const rr = 2 + rng() * 12;
        ctx.globalAlpha = 0.12 + rng() * 0.2;
        ctx.beginPath();
        ctx.ellipse(x, y, rr, rr * 0.5, rng() * TAU, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = '#557f3e';
      ctx.lineWidth = 1;
      for (let i = 0; i < 2400; i++) {
        const x = rng() * w;
        const y = rng() * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rng() - 0.5) * 4, y - 2 - rng() * 5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    { repeat: [70, 70], wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping }
  );
}

function pathTexture() {
  return canvasTexture(
    256,
    256,
    (ctx, w, h) => {
      ctx.fillStyle = '#e2cda2';
      ctx.fillRect(0, 0, w, h);
      const rng = makeRng(23);
      ctx.strokeStyle = 'rgba(150, 120, 80, 0.25)';
      ctx.lineWidth = 2;
      const step = 64;
      for (let x = 0; x <= w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = rng() > 0.5 ? '#8f7449' : '#fff5dc';
        ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 5, 1 + rng() * 5);
      }
      ctx.globalAlpha = 1;
    },
    { repeat: [16, 16], wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping }
  );
}

function frustumGeo(w, h, d, topW, topD) {
  const hw = w / 2;
  const hd = d / 2;
  const tw = topW / 2;
  const td = topD / 2;
  const A = [-hw, 0, hd];
  const B = [hw, 0, hd];
  const C = [hw, 0, -hd];
  const D = [-hw, 0, -hd];
  const A2 = [-tw, h, td];
  const B2 = [tw, h, td];
  const C2 = [tw, h, -td];
  const D2 = [-tw, h, -td];

  const pos = [];
  const uv = [];
  function quad(p1, p2, p3, p4) {
    pos.push(...p1, ...p2, ...p3, ...p1, ...p3, ...p4);
    uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
  }
  quad(A, B, B2, A2);
  quad(B, C, C2, B2);
  quad(C, D, D2, C2);
  quad(D, A, A2, D2);
  quad(A2, B2, C2, D2);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function tree(bucket, x, z, scale, variant, rng) {
  const base = 0;
  const trunkH = 2.5 * scale;
  bucket.cyl('trunk', 0.22 * scale, 0.42 * scale, trunkH, 6, x, base + trunkH / 2, z);
  bucket.cyl('trunk', 0.13 * scale, 0.2 * scale, 1.4 * scale, 5, x + 0.35 * scale, base + trunkH * 0.95, z, 0, 0, 0.6);
  const role = variant === 0 ? 'foliageA' : variant === 1 ? 'foliageB' : 'foliageC';
  const role2 = variant === 2 ? 'foliageB' : 'foliageC';

  if (variant === 2) {
    // tall clipped cone tree
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const rr = (1.9 - i * 0.45) * scale;
      const hh = 2.4 * scale;
      const cy = trunkH + 0.6 + i * 1.65 * scale;
      const cone = new THREE.ConeGeometry(rr, hh, 8, 1);
      cone.translate(x, cy, z);
      bucket.add(i % 2 ? role2 : role, cone);
    }
    return;
  }

  const n = 3;
  for (let i = 0; i < n; i++) {
    const rr = (2.1 - i * 0.28) * scale * rand(rng, 0.92, 1.08);
    const ox = rand(rng, -0.7, 0.7) * scale;
    const oz = rand(rng, -0.7, 0.7) * scale;
    const oy = trunkH + (1.2 + i * 1.05) * scale;
    bucket.ico(i === 0 ? role : i === 1 ? role2 : role, rr, x + ox, oy, z + oz, 1, 0.92, 1);
  }
  // a couple of little side puffs
  bucket.ico(role2, 1.0 * scale, x + 1.2 * scale, trunkH + 1.1 * scale, z - 0.3 * scale);
  bucket.ico(role, 0.9 * scale, x - 1.15 * scale, trunkH + 1.35 * scale, z + 0.3 * scale);
}

function bench(bucket, x, z, rot) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const o = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
  let p = o(0, 0);
  bucket.box('wood', 2.8, 0.16, 0.85, p[0], 0.82, p[1], 0, rot, 0);
  p = o(0, -0.36);
  bucket.box('wood', 2.8, 0.7, 0.15, p[0], 1.18, p[1], -0.12, rot, 0);
  p = o(0, 0.3);
  bucket.box('wood', 2.8, 0.55, 0.12, p[0], 1.16, p[1], 0.18, rot, 0);
  for (const lx of [-1.05, 1.05]) {
    p = o(lx, 0);
    bucket.box('ironDark', 0.1, 0.82, 0.75, p[0], 0.41, p[1], 0, rot, 0);
    p = o(lx, -0.38);
    bucket.box('ironDark', 0.1, 1.55, 0.1, p[0], 0.78, p[1], 0, rot, 0);
  }
}

function lamp(bucket, x, z, scale, glowTargets) {
  const y = 0;
  bucket.cyl('metalDark', 0.34, 0.5, 0.28, 8, x, 0.14, z);
  bucket.cyl('metalDark', 0.16, 0.28, 0.65, 8, x, 0.6, z);
  bucket.cyl('ironDark', 0.085, 0.13, 4.0 * scale, 7, x, 2.6 * scale, z);
  // decorative collar
  bucket.cyl('gold', 0.17, 0.17, 0.12, 8, x, 4.45 * scale, z);
  // lantern
  bucket.box('gold', 0.62, 0.1, 0.62, x, 4.78 * scale, z);
  bucket.box('gold', 0.52, 0.1, 0.52, x, 5.42 * scale, z);
  bucket.box('lampGlass', 0.44, 0.62, 0.44, x, 5.1 * scale, z);
  for (const [ox, oz] of [[-0.27, -0.27], [0.27, -0.27], [0.27, 0.27], [-0.27, 0.27]]) {
    bucket.box('gold', 0.06, 0.62, 0.06, x + ox, 5.1 * scale, z + oz);
  }
  const cap = new THREE.ConeGeometry(0.48, 0.55, 4, 1);
  cap.rotateY(Math.PI / 4);
  cap.translate(x, 5.73 * scale, z);
  bucket.add('roofBlue', cap);
  bucket.sphere('gold', 0.1, x, 6.03 * scale, z);
  glowTargets.push(new THREE.Vector3(x, 5.1 * scale, z));
}

function person(materials, x, z, rot, seed, scale = 1, walking = false) {
  const rng = makeRng(seed);
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = rot;
  group.scale.setScalar(scale);

  const cloth = materials['cloth' + (1 + Math.floor(rng() * 6))];
  const pants = materials.pants;
  const skin = materials.skin;
  const hair = materials.hair;

  // torso + arms in one merged mesh
  const bodyBucket = new GeoBucket();
  bodyBucket.cyl('cloth', 0.23, 0.31, 0.62, 7, 0, 1.0, 0);
  bodyBucket.sphere('cloth', 0.31, 0, 1.0, 0, 1, 0.7, 0.8, 8);
  bodyBucket.cyl('cloth', 0.12, 0.1, 0.58, 5, 0.34, 1.02, 0, 0, 0, -0.2);
  bodyBucket.cyl('cloth', 0.12, 0.1, 0.58, 5, -0.34, 1.02, 0, 0, 0, 0.2);
  const bodyMerged = bodyBucket.merge();
  for (const [role, geo] of bodyMerged) {
    const mat = role === 'cloth' ? cloth : materials[role];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);

  // hair / hat
  const hb = new GeoBucket();
  if (rng() > 0.55) {
    hb.cyl('hair', 0.22, 0.3, 0.16, 8, 0, 1.79, 0);
    hb.sphere('hair', 0.29, 0, 1.69, -0.03, 1, 0.75, 1, 8);
  } else {
    hb.sphere('hair', 0.285, 0, 1.64, -0.03, 1, 0.8, 1, 8);
    hb.sphere('hair', 0.13, 0.22, 1.72, -0.12, 1, 1.2, 1, 8);
  }
  if (rng() > 0.7) {
    hb.cyl('cloth', 0.44, 0.44, 0.05, 10, 0, 1.82, 0);
    hb.cyl('cloth', 0.25, 0.28, 0.16, 10, 0, 1.9, 0);
  }
  const hairMerged = hb.merge();
  for (const [role, geo] of hairMerged) {
    const mat = role === 'cloth' ? cloth : materials[role];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    group.add(mesh);
  }

  // two legs
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.72, 0.2), pants);
    leg.geometry.translate(0, -0.36, 0);
    leg.position.set(sx * 0.12, 0.72, 0);
    leg.castShadow = true;
    group.add(leg);
    legs.push(leg);
  }

  // occasionally a little bag or balloon
  let balloon = null;
  if (rng() > 0.8) {
    const colors = [materials.cloth1, materials.cloth2, materials.cloth3, materials.cloth4];
    balloon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), pick(rng, colors));
    balloon.position.set(0.48, 1.9, 0.08);
    balloon.scale.set(1, 1.15, 1);
    group.add(balloon);
    const string = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.85, 3),
      materials.metalDark
    );
    string.position.set(0.34, 1.42, 0.05);
    string.rotation.z = 0.3;
    group.add(string);
  }

  return { group, legs, walking, balloon, baseY: 0 };
}

/* ------------------------------------------------------------------ *
 *  Cloud geometry
 * ------------------------------------------------------------------ */
function cloudGeometry(rng) {
  const bucket = new GeoBucket();
  bucket.sphere('cloud', 1, 0, 0, 0, 3.0, 1.5, 1.9, 10);
  bucket.sphere('cloud', 0.85, 1.95, 0.42, 0.25, 2.1, 1.35, 1.5, 8);
  bucket.sphere('cloud', 0.95, -2.25, 0.12, -0.28, 2.0, 1.2, 1.5, 8);
  bucket.sphere('cloud', 0.72, 0.35, 1.02, 0.34, 1.7, 1.15, 1.25, 8);
  bucket.sphere('cloud', 0.6, -1.35, 0.9, -0.4, 1.4, 1.0, 1.15, 8);
  bucket.sphere('cloud', 0.55, 2.9, -0.1, -0.1, 1.4, 0.85, 1.15, 8);
  const merged = bucket.merge();
  return merged.get('cloud');
}

function balloonTexture(colors) {
  return canvasTexture(512, 256, (ctx, w, h) => {
    const bands = 14;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect((i / bands) * w, 0, w / bands + 1, h);
    }
    // vertical seam shading
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000';
    for (let i = 0; i <= bands; i++) ctx.fillRect((i / bands) * w, 0, 2, h);
    ctx.globalAlpha = 1;
  });
}

/* ------------------------------------------------------------------ *
 *  Build the world
 * ------------------------------------------------------------------ */
export function buildWorld(materials) {
  const group = new THREE.Group();
  group.name = 'World';
  const bucket = new GeoBucket();
  const rng = makeRng(20261111);
  const glows = [];
  const lampPositions = [];
  const dynamic = {};

  /* ---------------- ground & plaza ---------------- */
  const grassGeo = new THREE.CircleGeometry(430, 72);
  grassGeo.rotateX(-Math.PI / 2);
  const grass = new THREE.Mesh(grassGeo, materials.grass);
  grass.receiveShadow = true;
  group.add(grass);

  const plazaGeo = new THREE.CircleGeometry(PLAZA_R, 96);
  plazaGeo.rotateX(-Math.PI / 2);
  plazaGeo.translate(0, 0.035, 0);
  const plaza = new THREE.Mesh(plazaGeo, materials.plaza);
  plaza.receiveShadow = true;
  group.add(plaza);

  // paths
  const pathGeos = [];
  // a grand boulevard encircling the park, grounding the city ring
  {
    const g = new THREE.RingGeometry(198, 209, 128);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.05, 0);
    pathGeos.push(g);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const g = new THREE.BoxGeometry(7, 0.06, 176);
    g.rotateY(a);
    g.translate(Math.sin(a) * 121, 0.045, Math.cos(a) * 121);
    pathGeos.push(g);
  }
  for (const [r, wdt] of [[47, 5.6], [73, 4.8]]) {
    const g = new THREE.RingGeometry(r - wdt / 2, r + wdt / 2, 96);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.045, 0);
    pathGeos.push(g);
  }
  for (const [c, rr] of [
    [CAROUSEL, 12.5],
    [CAFE, 10.5],
  ]) {
    const g = new THREE.CircleGeometry(rr, 40);
    g.rotateX(-Math.PI / 2);
    g.translate(c.x, 0.05, c.z);
    pathGeos.push(g);
  }
  const paths = new THREE.Mesh(mergeAll(pathGeos), materials.path);
  paths.receiveShadow = true;
  group.add(paths);

  // thin curb around the plaza
  const curb = new THREE.Mesh(new THREE.TorusGeometry(PLAZA_R + 0.2, 0.32, 6, 100), materials.stone);
  curb.rotation.x = Math.PI / 2;
  curb.position.y = 0.12;
  curb.receiveShadow = true;
  curb.castShadow = true;
  group.add(curb);

  /* ---------------- flower beds around the plaza ---------------- */
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.06;
    const r = PLAZA_R + 1.7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    // clipped hedge arc
    const hedge = new THREE.BoxGeometry(8.0, 0.7, 1.35);
    hedge.rotateY(-a);
    hedge.translate(x, 0.35, z);
    bucket.add('hedge', hedge);
    // flowers
    for (let f = 0; f < 16; f++) {
      const t = (f / 15 - 0.5) * 7.4;
      const px = x + Math.cos(a + Math.PI / 2) * t;
      const pz = z + Math.sin(a + Math.PI / 2) * t;
      const role = ['flowerA', 'flowerB', 'flowerC', 'flowerD'][(f + i) % 4];
      bucket.sphere(role, 0.18, px, 0.85, pz, 1, 1, 1, 5);
      bucket.beam('hedge', new THREE.Vector3(px, 0.55, pz), new THREE.Vector3(px, 0.8, pz), 0.035);
    }
  }

  /* ---------------- trees ---------------- */
  const treeSpots = [];
  const avoid = (x, z) => {
    if (Math.hypot(x - CAROUSEL.x, z - CAROUSEL.z) < 15) return false;
    if (Math.hypot(x - CAFE.x, z - CAFE.z) < 13) return false;
    if (Math.hypot(x - CART.x, z - CART.z) < 7) return false;
    if (Math.hypot((x - POND.x) / 1.35, (z - POND.z) / 1.05) < 17) return false;
    for (const p of PARTERRES) if (Math.hypot(x - p.x, z - p.z) < p.r + 4) return false;
    if (Math.hypot(x, z) < PLAZA_R + 4) return false;
    for (const p of treeSpots) if (Math.hypot(x - p.x, z - p.z) < 4.6) return false;
    const r = Math.hypot(x, z);
    if (Math.abs(r - 47) < 5 || Math.abs(r - 73) < 4.5) return false;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const along = x * Math.sin(a) + z * Math.cos(a);
      const lat = x * Math.cos(a) - z * Math.sin(a);
      if (along > PLAZA_R - 1 && Math.abs(lat) < 6.5) return false;
    }
    return true;
  };

  // formal rows along the main avenue (north / south)
  for (const side of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const z = side * (54 + i * 12.5);
      for (const sx of [-1, 1]) {
        const x = sx * 10.5;
        if (avoid(x, z)) treeSpots.push({ x, z, s: rand(rng, 0.85, 1.15), v: 2 });
      }
    }
  }
  // matching rows along the east-west avenue
  for (const side of [-1, 1]) {
    for (let i = 0; i < 10; i++) {
      const x = side * (54 + i * 12.5);
      for (const sz of [-1, 1]) {
        const z = sz * 10.5;
        if (avoid(x, z)) treeSpots.push({ x, z, s: rand(rng, 0.85, 1.15), v: 2 });
      }
    }
  }
  // scattered park trees
  let attempts = 0;
  while (treeSpots.length < 64 && attempts < 900) {
    attempts++;
    const a = rng() * TAU;
    const r = rand(rng, 40, 170);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (avoid(x, z)) treeSpots.push({ x, z, s: rand(rng, 0.8, 1.35), v: Math.floor(rng() * 3) });
  }
  for (const t of treeSpots) tree(bucket, t.x, t.z, t.s, t.v, rng);

  // bushes near the plaza
  for (let i = 0; i < 22; i++) {
    const a = rng() * TAU;
    const r = rand(rng, 38, 55);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.hypot(x - CAROUSEL.x, z - CAROUSEL.z) < 14) continue;
    if (Math.hypot(x - CAFE.x, z - CAFE.z) < 12) continue;
    if (Math.hypot((x - POND.x) / 1.35, (z - POND.z) / 1.05) < 16) continue;
    bucket.ico(rng() > 0.5 ? 'foliageB' : 'foliageC', rand(rng, 0.7, 1.4), x, rand(rng, 0.5, 0.9), z, 1.3, 0.8, 1.1);
  }

  /* ---------------- the park pond & fountain ---------------- */
  {
    // paved apron
    const apronGeo = new THREE.RingGeometry(POND.r * 0.98, POND.r + 3.1, 64);
    apronGeo.rotateX(-Math.PI / 2);
    const apron = new THREE.Mesh(apronGeo, materials.path);
    apron.scale.set(POND.sx, 1, POND.sz);
    apron.position.set(POND.x, 0.045, POND.z);
    apron.receiveShadow = true;
    group.add(apron);

    // water surface
    const waterGeo = new THREE.CircleGeometry(POND.r, 64);
    waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, materials.water);
    water.scale.set(POND.sx, 1, POND.sz);
    water.position.set(POND.x, 0.075, POND.z);
    water.receiveShadow = true;
    group.add(water);

    // pale moon shimmer on the water
    const shimmerTex = canvasTexture(256, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.55, 4, w * 0.5, h * 0.55, w * 0.45);
      g.addColorStop(0, 'rgba(220,242,255,0.65)');
      g.addColorStop(0.4, 'rgba(170,215,255,0.22)');
      g.addColorStop(1, 'rgba(140,200,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = '#dff4ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) {
        const yy = h * (0.35 + i * 0.07);
        ctx.beginPath();
        ctx.ellipse(w * 0.5, yy, w * 0.2, 2.2, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
    const shimmer = new THREE.Mesh(
      new THREE.PlaneGeometry(8.5, 4.6),
      new THREE.MeshBasicMaterial({
        map: shimmerTex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    shimmer.rotation.x = -Math.PI / 2;
    shimmer.position.set(POND.x + 1.0, 0.13, POND.z - 0.5);
    shimmer.userData.noOutline = true;
    group.add(shimmer);
    dynamic.pondShimmer = shimmer;

    // stone edging
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * TAU;
      const x = POND.x + Math.cos(a) * POND.r * POND.sx;
      const z = POND.z + Math.sin(a) * POND.r * POND.sz;
      bucket.box('stoneDark', 1.45, 0.42, 0.72, x, 0.21, z, 0, -a, 0);
    }

    // small ripples around the fountain
    for (let i = 0; i < 3; i++) {
      const rg = new THREE.RingGeometry(2.3 + i * 1.35, 2.38 + i * 1.35, 48);
      rg.rotateX(-Math.PI / 2);
      rg.scale(POND.sx, 1, POND.sz);
      rg.translate(POND.x, 0.09, POND.z);
      bucket.add('waterLine', rg);
    }

    // fountain
    const fx = POND.x;
    const fz = POND.z;
    bucket.cyl('stone', 2.5, 2.85, 0.55, 20, fx, 0.36, fz);
    bucket.cyl('stoneDark', 2.9, 3.0, 0.2, 20, fx, 0.11, fz);
    bucket.cyl('water', 2.25, 2.25, 0.10, 20, fx, 0.66, fz);
    bucket.cyl('stone', 0.55, 0.78, 1.15, 10, fx, 1.2, fz);
    bucket.cyl('stone', 1.45, 1.7, 0.3, 16, fx, 1.9, fz);
    bucket.cyl('water', 1.3, 1.3, 0.08, 16, fx, 2.08, fz);
    bucket.cyl('stone', 0.24, 0.34, 0.9, 8, fx, 2.5, fz);
    bucket.sphere('gold', 0.16, fx, 3.0, fz);

    // lily pads and flowers
    const padSpots = [
      [-6.8, 3.2, 0.8], [5.6, -2.4, 0.65], [3.9, 4.1, 0.55], [-4.4, -4.7, 0.7],
      [7.2, 1.6, 0.45], [-2.0, 6.1, 0.5], [-7.8, -1.2, 0.6], [1.2, -6.8, 0.55],
    ];
    for (let i = 0; i < padSpots.length; i++) {
      const [dx, dz, s] = padSpots[i];
      const px = fx + dx;
      const pz = fz + dz;
      bucket.cyl('foliageB', s, s, 0.045, 9, px, 0.105, pz);
      if (i % 2 === 0) {
        bucket.sphere(i % 4 === 0 ? 'flowerA' : 'flowerD', 0.13, px + 0.16, 0.2, pz, 1, 1, 1, 5);
      }
    }

    // reeds at the water's edge
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * TAU + 0.12;
      const rr = 1.05;
      const x = fx + Math.cos(a) * POND.r * POND.sx * rr;
      const z = fz + Math.sin(a) * POND.r * POND.sz * rr;
      const h = rand(rng, 0.8, 1.5);
      bucket.beam('foliageC', new THREE.Vector3(x, 0.08, z), new THREE.Vector3(x + rand(rng, -0.18, 0.18), h, z + rand(rng, -0.18, 0.18)), 0.035);
      bucket.sphere('trunk', 0.07, x, h + 0.05, z, 1, 1.8, 1, 5);
    }

    // fountain jet sprite
    const jetTex = canvasTexture(64, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(210,245,255,0)');
      g.addColorStop(0.15, 'rgba(215,248,255,0.75)');
      g.addColorStop(0.55, 'rgba(180,235,255,0.45)');
      g.addColorStop(1, 'rgba(150,220,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(w * 0.3, 0, w * 0.4, h);
      // a few bright streaks
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#f2feff';
      for (let i = 0; i < 5; i++) {
        const xx = w * 0.38 + i * 3;
        ctx.fillRect(xx, h * (0.15 + i * 0.08), 1.5, h * 0.3);
      }
      ctx.globalAlpha = 1;
    });
    const jet = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: jetTex,
        color: 0xd8f6ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    jet.position.set(fx, 4.4, fz);
    jet.scale.set(2.6, 5.4, 1);
    jet.userData.noOutline = true;
    group.add(jet);
    dynamic.fountainJet = jet;

    // droplets
    const droplets = [];
    const dropGeo = new THREE.SphereGeometry(0.075, 6, 5);
    for (let i = 0; i < 10; i++) {
      const d = new THREE.Mesh(dropGeo, materials.waterLine);
      d.userData.noOutline = true;
      d.userData.phase = i / 10;
      d.userData.angle = (i / 10) * TAU + 0.4;
      group.add(d);
      droplets.push(d);
    }
    dynamic.droplets = droplets;

    // ducks
    const ducks = [];
    for (let i = 0; i < 2; i++) {
      const dg = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 9, 7), materials.cream);
      body.scale.set(1.35, 0.8, 0.95);
      body.castShadow = true;
      dg.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), materials.cream);
      head.position.set(0.38, 0.42, 0);
      head.castShadow = true;
      dg.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 5), materials.gold);
      beak.rotation.z = -Math.PI / 2;
      beak.position.set(0.64, 0.4, 0);
      dg.add(beak);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), materials.metalDark);
      eye.position.set(0.48, 0.52, 0.15);
      dg.add(eye);
      const eye2 = eye.clone();
      eye2.position.z = -0.15;
      dg.add(eye2);
      group.add(dg);
      ducks.push({ group: dg, angle: i * 2.4 + 0.5, radius: 5.3 + i * 1.4, speed: 0.12 - i * 0.05 });
    }
    dynamic.ducks = ducks;

    // a cool halo over the fountain after dark
    const fountainGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xbfe9ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    fountainGlow.position.set(fx, 3.2, fz);
    fountainGlow.scale.set(7, 7, 1);
    fountainGlow.userData.noOutline = true;
    group.add(fountainGlow);
    glows.push(fountainGlow);

    // benches facing the pond
    bench(bucket, POND.x + 14.8, POND.z + 3.2, -1.15);
    bench(bucket, POND.x - 10.2, POND.z - 12.6, 1.9);
    lamp(bucket, POND.x + 14.2, POND.z - 7.4, 1.0, lampPositions);
    lamp(bucket, POND.x - 14.0, POND.z + 7.8, 0.95, lampPositions);
  }

  /* ---------------- formal flower parterres ---------------- */
  for (let i = 0; i < PARTERRES.length; i++) {
    const p = PARTERRES[i];
    bucket.cyl('stoneDark', p.r + 0.45, p.r + 0.6, 0.16, 20, p.x, 0.08, p.z);
    bucket.cyl('foliageC', p.r, p.r, 0.18, 20, p.x, 0.17, p.z);
    bucket.cyl('stone', p.r * 0.45, p.r * 0.45, 0.24, 12, p.x, 0.24, p.z);
    for (let f = 0; f < 26; f++) {
      const a = (f / 26) * TAU + i;
      const rr = p.r * (0.58 + (f % 3) * 0.11);
      const role = ['flowerA', 'flowerB', 'flowerC', 'flowerD'][(f + i) % 4];
      bucket.sphere(role, 0.2, p.x + Math.cos(a) * rr, 0.34, p.z + Math.sin(a) * rr, 1, 1, 1, 5);
    }
    // little central shrub
    bucket.ico(i % 2 ? 'foliageA' : 'foliageB', 1.15, p.x, 1.1, p.z, 1, 0.85, 1);
    // bench beside two of them
    if (i === 1 || i === 3) {
      bench(bucket, p.x + 6.2, p.z + 1.6, -0.9);
    }
  }

  /* ---------------- benches & lamps ---------------- */
  const benchAngles = [0.4, 0.85, 1.2, 1.6, 2.0, 2.5, 2.9, 3.4, 3.9, 4.4, 4.9, 5.5];
  for (let i = 0; i < benchAngles.length; i++) {
    const a = benchAngles[i];
    const r = i % 2 === 0 ? 45.2 : 70.8;
    bench(bucket, Math.cos(a) * r, Math.sin(a) * r, -a + (i % 2 ? Math.PI : 0));
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.18;
    const r = PLAZA_R - 1.6;
    lamp(bucket, Math.cos(a) * r, Math.sin(a) * r, 1, lampPositions);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.4;
    lamp(bucket, Math.cos(a) * 47, Math.sin(a) * 47, 0.9, lampPositions);
  }
  lamp(bucket, CAROUSEL.x + 9.5, CAROUSEL.z + 6.5, 0.95, lampPositions);
  lamp(bucket, CAFE.x - 7.5, CAFE.z - 4.2, 0.95, lampPositions);

  /* ---------------- the little city ring ---------------- */
  const facadeRoles = ['facadeA', 'facadeB', 'facadeC', 'facadeD', 'facadeE'];
  const buildingCount = 64;
  for (let i = 0; i < buildingCount; i++) {
    const a = (i / buildingCount) * TAU + rand(rng, -0.02, 0.02);
    // leave the four grand avenues open
    let nearAvenue = false;
    for (let k = 0; k < 4; k++) {
      const d = Math.abs(Math.atan2(Math.sin(a - (k * Math.PI) / 2), Math.cos(a - (k * Math.PI) / 2)));
      if (d < 0.10) nearAvenue = true;
    }
    if (nearAvenue) continue;

    const radius = rand(rng, 218, 258);
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const rot = -a - Math.PI / 2; // local +Z faces the tower
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const place = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const box = (role, w, h, d, lx, ly, lz, ry = 0, rx = 0, rz = 0) => {
      const p = place(lx, lz);
      bucket.box(role, w, h, d, p[0], ly, p[1], rx, rot + ry, rz);
    };
    const cyl = (role, rt, rb, h, seg, lx, ly, lz, rx = 0, rz = 0) => {
      const p = place(lx, lz);
      bucket.cyl(role, rt, rb, h, seg, p[0], ly, p[1], rx, rot, rz);
    };

    const w = rand(rng, 17, 28);
    const d = rand(rng, 11, 15);
    const h = rand(rng, 12, 27);
    const facade = facadeRoles[Math.floor(rng() * facadeRoles.length)];
    const roofRole = rng() > 0.35 ? 'roofBlue' : 'roofRed';

    // pavement apron
    box('stoneDark', w + 4.5, 0.22, d + 4.5, 0, 0.11, 0);
    // body
    box(facade, w, h, d, 0, h / 2, 0);
    // corner quoins
    for (const qx of [-1, 1]) {
      box('cream', 0.55, h, 0.55, qx * (w / 2 - 0.2), h / 2, d / 2 - 0.1);
    }
    // storey bands
    const floors = Math.max(2, Math.floor(h / 3.1));
    for (let f = 1; f < floors; f++) {
      box('cream', w + 0.16, 0.13, d + 0.16, 0, (h * f) / floors, 0);
    }
    // windows on the front and sides
    const cols = Math.max(2, Math.floor(w / 3.4));
    for (let f = 0; f < floors; f++) {
      const wy = (f + 0.52) * (h / floors);
      if (wy < 1.2) continue;
      for (let col = 0; col < cols; col++) {
        const lx = -w / 2 + (w / cols) * (col + 0.5);
        const lit = rng() < 0.46;
        // frame
        box('windowFrame', 1.35, 1.9, 0.10, lx, wy, d / 2 + 0.02);
        // glass
        box(lit ? 'windowLit' : 'windowDark', 0.96, 1.5, 0.08, lx, wy, d / 2 + 0.09);
        // little iron balcony
        if (f === 1 || (f === floors - 2 && rng() > 0.6)) {
          box('ironDark', 1.45, 0.08, 0.36, lx, wy - 0.85, d / 2 + 0.22);
          for (let bx = -2; bx <= 2; bx++) {
            box('ironDark', 0.04, 0.52, 0.04, lx + bx * 0.3, wy - 0.55, d / 2 + 0.36);
          }
          box('ironDark', 1.45, 0.05, 0.05, lx, wy - 0.30, d / 2 + 0.36);
        }
      }
      // side windows on the side facing the avenue
      for (let col = 0; col < 2; col++) {
        const lz = -d / 2 + (d / 3) * (col + 1);
        const lit = rng() < 0.4;
        box('windowFrame', 0.1, 1.9, 1.35, w / 2 + 0.02, wy, lz);
        box(lit ? 'windowLit' : 'windowDark', 0.08, 1.5, 0.96, w / 2 + 0.09, wy, lz);
      }
    }
    // shopfronts
    const shopCols = Math.max(1, Math.floor(w / 6));
    for (let sIdx = 0; sIdx < shopCols; sIdx++) {
      const lx = -w / 2 + (w / shopCols) * (sIdx + 0.5);
      box('windowLit', 2.2, 1.5, 0.12, lx, 1.1, d / 2 + 0.06);
      box('windowFrame', 2.6, 1.9, 0.08, lx, 1.1, d / 2 + 0.02);
      const awningRole = ['roofRed', 'cloth2', 'cloth3', 'cloth4'][(sIdx + i) % 4];
      box(awningRole, 2.7, 0.12, 1.15, lx, 2.25, d / 2 + 0.45, 0, -0.25, 0);
    }
    // roof
    const roofH = rand(rng, 2.3, 4.2);
    const roof = frustumGeo(w + 0.7, roofH, d + 0.7, w * 0.62, d * 0.6);
    roof.rotateY(rot);
    const rp = place(0, 0);
    roof.translate(rp[0], h, rp[1]);
    bucket.add(roofRole, roof);
    // dormers
    const dormers = Math.max(1, Math.floor(w / 8));
    for (let dd = 0; dd < dormers; dd++) {
      const lx = -w / 2 + (w / (dormers + 1)) * (dd + 1);
      const p = place(lx, d / 2 - 0.8);
      bucket.box('cream', 1.2, 1.25, 0.8, p[0], h + roofH * 0.45, p[1], 0, rot, 0);
      bucket.box('windowDark', 0.7, 0.75, 0.1, p[0], h + roofH * 0.45, p[1] + 0.42, 0, rot, 0);
      // dormer cap
      const cap = new THREE.ConeGeometry(0.9, 0.7, 4, 1);
      cap.rotateY(Math.PI / 4);
      cap.rotateY(rot);
      cap.translate(p[0], h + roofH * 0.45 + 0.95, p[1]);
      bucket.add(roofRole, cap);
    }
    // chimneys
    for (let cc = 0; cc < 2; cc++) {
      const lx = rand(rng, -w / 2 + 2, w / 2 - 2);
      const lz = rand(rng, -d / 4, d / 4);
      const p = place(lx, lz);
      bucket.box('stone', 1.0, rand(rng, 1.6, 2.6), 1.0, p[0], h + roofH + 0.7, p[1], 0, rot, 0);
      bucket.box('stoneDark', 1.2, 0.2, 1.2, p[0], h + roofH + 1.55, p[1], 0, rot, 0);
    }
  }

  /* ---------------- distant landmarks on the skyline ---------------- */
  {
    // a white domed basilica on a low hill
    const bx = Math.cos(2.35) * 292;
    const bz = Math.sin(2.35) * 292;
    const hill = new THREE.SphereGeometry(52, 16, 8, 0, TAU, 0, Math.PI / 2);
    hill.scale(1.25, 0.18, 1.0);
    hill.translate(bx, -0.5, bz);
    const hillMesh = new THREE.Mesh(hill, materials.foliageC);
    hillMesh.receiveShadow = true;
    group.add(hillMesh);
    bucket.box('stone', 32, 4, 20, bx, 3.1, bz, 0, -2.35, 0);
    bucket.box('cream', 21, 17, 15, bx, 12.5, bz, 0, -2.35, 0);
    bucket.box('cream', 15, 8, 11, bx, 23.5, bz, 0, -2.35, 0);
    // drum and dome
    const drum = new THREE.CylinderGeometry(6.4, 6.8, 4, 16);
    drum.translate(bx, 28.5, bz);
    bucket.add('cream', drum);
    const dome = new THREE.SphereGeometry(6.6, 16, 8, 0, TAU, 0, Math.PI / 2);
    dome.scale(1, 1.25, 1);
    dome.translate(bx, 30.4, bz);
    bucket.add('stone', dome);
    bucket.cyl('gold', 0.12, 0.12, 3.4, 5, bx, 39.4, bz);
    bucket.box('gold', 1.5, 0.14, 0.14, bx, 39.7, bz);
    // small flanking domes
    for (const s of [-1, 1]) {
      const dx = bx + Math.cos(-2.35) * 7.5 * s;
      const dz = bz + Math.sin(-2.35) * 7.5 * s;
      const d2 = new THREE.SphereGeometry(3.2, 12, 6, 0, TAU, 0, Math.PI / 2);
      d2.scale(1, 1.25, 1);
      d2.translate(dx, 23.5, dz);
      bucket.add('stone', d2);
      bucket.cyl('cream', 3.1, 3.4, 2.6, 12, dx, 21.2, dz);
    }

    // a gothic spire on the opposite side of the horizon
    const sx2 = Math.cos(4.9) * 286;
    const sz2 = Math.sin(4.9) * 286;
    bucket.box('stone', 11, 30, 11, sx2, 15, sz2, 0, 4.9, 0);
    bucket.box('cream', 9, 8, 9, sx2, 34, sz2, 0, 4.9, 0);
    const spire = new THREE.ConeGeometry(6.8, 22, 4);
    spire.rotateY(Math.PI / 4);
    spire.rotateY(4.9);
    spire.translate(sx2, 49, sz2);
    bucket.add('roofBlue', spire);
    bucket.cyl('gold', 0.08, 0.08, 3, 4, sx2, 61.5, sz2);
    for (const s of [-1, 1]) {
      const px = sx2 + Math.cos(4.9) * 7.0 * s;
      const pz = sz2 + Math.sin(4.9) * 7.0 * s;
      const pin = new THREE.ConeGeometry(1.4, 8, 4);
      pin.rotateY(Math.PI / 4);
      pin.translate(px, 31, pz);
      bucket.add('roofBlue', pin);
    }
  }

  /* ---------------- carousel ---------------- */
  const carousel = new THREE.Group();
  carousel.position.set(CAROUSEL.x, 0, CAROUSEL.z);
  group.add(carousel);
  const carBucket = new GeoBucket();
  carBucket.cyl('stone', 8.3, 8.8, 0.6, 40, 0, 0.3, 0);
  carBucket.cyl('wood', 7.9, 7.9, 0.35, 40, 0, 0.75, 0);
  carBucket.cyl('gold', 8.0, 8.0, 0.14, 40, 0, 0.95, 0);
  carBucket.cyl('gold', 0.35, 0.45, 6.4, 10, 0, 4.0, 0);
  carBucket.cyl('cream', 0.8, 0.8, 0.3, 12, 0, 7.2, 0);
  // poles
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    carBucket.cyl('gold', 0.07, 0.07, 4.6, 6, Math.cos(a) * 5.1, 3.1, Math.sin(a) * 5.1);
  }
  // roof canopy with striped texture
  const roofTex = canvasTexture(512, 256, (ctx, w, h) => {
    const bands = 24;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = i % 2 ? '#f2dfb8' : '#c54a48';
      ctx.fillRect((i / bands) * w, 0, w / bands + 1, h);
    }
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000';
    for (let i = 0; i <= bands; i++) ctx.fillRect((i / bands) * w, 0, 2, h);
    ctx.globalAlpha = 1;
  });
  const carRoofMat = new THREE.MeshToonMaterial({
    map: roofTex,
    gradientMap: materials.__gradient,
    side: THREE.DoubleSide,
  });
  const roofGeo = new THREE.ConeGeometry(8.6, 3.1, 40, 1, true);
  roofGeo.translate(0, 7.9, 0);
  const carRoof = new THREE.Mesh(roofGeo, carRoofMat);
  carRoof.castShadow = true;
  carRoof.receiveShadow = true;
  carousel.add(carRoof);
  // scalloped valance
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * TAU;
    carBucket.box(i % 2 ? 'cream' : 'roofRed', 1.55, 0.55, 0.08, Math.cos(a) * 8.38, 6.45, Math.sin(a) * 8.38, 0, -a + Math.PI / 2, 0);
  }
  carBucket.cyl('gold', 8.45, 8.45, 0.12, 40, 0, 6.75, 0);
  carBucket.sphere('gold', 0.28, 0, 9.6, 0);
  // bulbs around the rim
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * TAU;
    carBucket.sphere('bulb', 0.12, Math.cos(a) * 8.42, 6.78, Math.sin(a) * 8.42, 1, 1, 1, 6);
  }
  for (const [role, geo] of carBucket.merge()) {
    const mesh = new THREE.Mesh(geo, materials[role]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    carousel.add(mesh);
  }
  // horse geometry (reused)
  const horseBucket = new GeoBucket();
  horseBucket.sphere('x', 0.34, 0, 0, 0, 1.55, 0.75, 0.72, 8); // body
  horseBucket.sphere('x', 0.22, 0, 0.33, 0.3, 1, 1.3, 1, 8); // neck
  horseBucket.box('x', 0.3, 0.34, 0.52, 0, 0.5, 0.48, 0.35, 0, 0); // head
  horseBucket.box('x', 0.12, 0.45, 0.12, 0.18, -0.4, 0.3, 0.15, 0, 0);
  horseBucket.box('x', 0.12, 0.45, 0.12, -0.18, -0.4, 0.3, 0.15, 0, 0);
  horseBucket.box('x', 0.12, 0.45, 0.12, 0.18, -0.4, -0.3, -0.15, 0, 0);
  horseBucket.box('x', 0.12, 0.45, 0.12, -0.18, -0.4, -0.3, -0.15, 0, 0);
  horseBucket.cyl('x', 0.03, 0.07, 0.65, 4, 0, 0.05, -0.5, 0.8, 0, 0);
  const horseGeo = horseBucket.merge().get('x');
  const horseMats = [materials.cloth1, materials.cloth2, materials.cloth3, materials.cloth4, materials.cloth5, materials.cloth6];
  const horses = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.2;
    const holder = new THREE.Group();
    holder.position.set(Math.cos(a) * 5.1, 1.55, Math.sin(a) * 5.1);
    holder.rotation.y = -a;
    const horse = new THREE.Mesh(horseGeo, horseMats[i % horseMats.length]);
    horse.castShadow = true;
    horse.receiveShadow = true;
    holder.add(horse);
    // saddle
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.62), materials.gold);
    saddle.position.set(0, 0.28, 0);
    holder.add(saddle);
    carousel.add(holder);
    horses.push({ holder, phase: i * 1.7, baseY: 1.55 });
  }
  dynamic.carousel = carousel;
  dynamic.horses = horses;
  {
    const carGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xffc47a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    carGlow.position.set(0, 5.2, 0);
    carGlow.scale.set(11, 11, 1);
    carGlow.userData.noOutline = true;
    carousel.add(carGlow);
    glows.push(carGlow);
  }

  /* ---------------- café ---------------- */
  const cafe = new THREE.Group();
  cafe.position.set(CAFE.x, 0, CAFE.z);
  cafe.rotation.y = Math.atan2(-CAFE.x, -CAFE.z) + Math.PI;
  group.add(cafe);
  const cafeB = new GeoBucket();
  cafeB.cyl('stone', 2.7, 3.0, 0.5, 20, 0, 0.25, 0);
  cafeB.cyl('cream', 2.5, 2.5, 2.9, 20, 0, 1.9, 0);
  cafeB.cyl('gold', 2.62, 2.62, 0.12, 20, 0, 3.35, 0);
  // windows
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    cafeB.box('windowLit', 0.9, 1.15, 0.1, Math.cos(a) * 2.52, 2.0, Math.sin(a) * 2.52, 0, -a, 0);
  }
  // door
  cafeB.box('windowDark', 0.75, 1.5, 0.1, 0, 1.0, 2.53);
  // awning cone
  const cafeRoofMat = new THREE.MeshToonMaterial({
    map: canvasTexture(512, 256, (ctx, w, h) => {
      const bands = 20;
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = i % 2 ? '#f4e7c6' : '#3d8a72';
        ctx.fillRect((i / bands) * w, 0, w / bands + 1, h);
      }
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#000';
      for (let i = 0; i <= bands; i++) ctx.fillRect((i / bands) * w, 0, 2, h);
      ctx.globalAlpha = 1;
    }),
    gradientMap: materials.__gradient,
    side: THREE.DoubleSide,
  });
  const cafeRoof = new THREE.ConeGeometry(3.7, 1.9, 24, 1);
  cafeRoof.translate(0, 4.25, 0);
  const cafeRoofMesh = new THREE.Mesh(cafeRoof, cafeRoofMat);
  cafeRoofMesh.castShadow = true;
  cafe.add(cafeRoofMesh);
  cafeB.cyl('gold', 2.75, 2.75, 0.15, 24, 0, 3.35, 0);
  cafeB.sphere('gold', 0.18, 0, 5.3, 0);
  cafeB.cyl('gold', 0.08, 0.08, 1.1, 5, 0, 4.8, 0);

  // tables and chairs around the café
  const tableSpots = [
    [5.2, 2.1],
    [5.5, -2.8],
    [2.0, 5.2],
    [-5.4, 2.4],
    [-3.8, -4.4],
  ];
  for (const [tx, tz] of tableSpots) {
    cafeB.cyl('metalDark', 0.06, 0.06, 0.8, 5, tx, 0.4, tz);
    cafeB.cyl('wood', 0.78, 0.78, 0.09, 14, tx, 0.84, tz);
    cafeB.cyl('gold', 0.9, 0.9, 0.03, 14, tx, 0.9, tz);
    // umbrella
    cafeB.cyl('wood', 0.04, 0.04, 2.2, 4, tx, 1.9, tz);
    const um = new THREE.ConeGeometry(1.5, 0.6, 10, 1);
    um.translate(tx, 3.0, tz);
    cafeB.add('cloth2', um);
    // chairs
    for (let ci = 0; ci < 2; ci++) {
      const a = ci * Math.PI + 0.5;
      const cx = tx + Math.cos(a) * 1.15;
      const cz = tz + Math.sin(a) * 1.15;
      cafeB.box('wood', 0.5, 0.09, 0.5, cx, 0.56, cz, 0, -a, 0);
      cafeB.box('wood', 0.5, 0.6, 0.08, cx - Math.cos(a) * 0.22, 0.82, cz - Math.sin(a) * 0.22, 0, -a, 0);
      for (const [ox, oz] of [[-0.18, -0.18], [0.18, -0.18], [0.18, 0.18], [-0.18, 0.18]]) {
        cafeB.box('metalDark', 0.04, 0.5, 0.04, cx + ox, 0.3, cz + oz);
      }
    }
  }
  // string lights on a pole
  cafeB.cyl('metalDark', 0.06, 0.08, 3.4, 5, 3.1, 1.7, -3.2);
  const stringBulbs = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const px = 3.1 + (2.6 - 3.1) * t;
    const pz = -3.2 + (0.5 + 3.2) * t;
    const py = 3.0 - Math.sin(t * Math.PI) * 0.55;
    cafeB.sphere('bulb', 0.085, px, py, pz, 1, 1, 1, 5);
    stringBulbs.push([px, py, pz]);
  }
  for (const [role, geo] of cafeB.merge()) {
    const mesh = new THREE.Mesh(geo, materials[role]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cafe.add(mesh);
  }
  // café sign
  const signTex = canvasTexture(512, 220, (ctx, w, h) => {
    ctx.fillStyle = '#f6ead0';
    roundRectPath(ctx, 8, 8, w - 16, h - 16, 28);
    ctx.fill();
    ctx.lineWidth = 9;
    ctx.strokeStyle = '#3c2c2a';
    ctx.stroke();
    ctx.fillStyle = '#3d8a72';
    ctx.font = 'bold 104px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CAFÉ', w / 2, h / 2 + 2);
    ctx.fillStyle = '#c54a48';
    ctx.fillRect(40, h - 40, w - 80, 7);
  });
  const signMat = new THREE.MeshToonMaterial({ map: signTex, gradientMap: materials.__gradient, side: THREE.DoubleSide });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 1.25), signMat);
  sign.position.set(0, 3.0, 2.75);
  sign.rotation.x = -0.05;
  sign.castShadow = true;
  cafe.add(sign);
  // glow sprite at the café
  const cafeGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: 0xffc070,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  cafeGlow.position.set(0, 2.4, 0);
  cafeGlow.scale.set(10, 10, 1);
  cafeGlow.userData.noOutline = true;
  cafe.add(cafeGlow);
  glows.push(cafeGlow);
  for (const [px, py, pz] of stringBulbs) {
    const g = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xffbf70,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    g.position.set(px, py, pz);
    g.scale.set(1.5, 1.5, 1);
    g.userData.noOutline = true;
    cafe.add(g);
    glows.push(g);
  }

  /* ---------------- balloon cart ---------------- */
  const cart = new THREE.Group();
  cart.position.set(CART.x, 0, CART.z);
  cart.rotation.y = -0.7;
  group.add(cart);
  const cartB = new GeoBucket();
  cartB.box('wood', 2.4, 1.2, 1.35, 0, 0.95, 0);
  cartB.box('roofRed', 2.55, 0.14, 1.48, 0, 1.56, 0);
  cartB.box('gold', 2.45, 0.08, 1.42, 0, 1.45, 0);
  for (const sx of [-0.8, 0.8]) {
    cartB.cyl('metalDark', 0.48, 0.48, 0.16, 12, sx, 0.48, 0.72, Math.PI / 2, 0, 0);
    cartB.cyl('metalDark', 0.48, 0.48, 0.16, 12, sx, 0.48, -0.72, Math.PI / 2, 0, 0);
    cartB.cyl('gold', 0.1, 0.1, 1.0, 6, sx, 1.45, 0);
  }
  for (const [role, geo] of cartB.merge()) {
    const mesh = new THREE.Mesh(geo, materials[role]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    cart.add(mesh);
  }
  const balloonBundle = new THREE.Group();
  balloonBundle.position.set(0, 1.7, 0);
  cart.add(balloonBundle);
  const balloonGeo = new THREE.SphereGeometry(0.32, 10, 8);
  const balloonColors = [materials.cloth1, materials.cloth2, materials.cloth3, materials.cloth4, materials.cloth5, materials.cloth6];
  const cartBalloons = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    const rr = i === 0 ? 0 : 0.45;
    const b = new THREE.Mesh(balloonGeo, balloonColors[i % balloonColors.length]);
    b.position.set(Math.cos(a) * rr, 1.4 + (i % 3) * 0.32, Math.sin(a) * rr);
    b.scale.set(1, 1.2, 1);
    b.castShadow = true;
    balloonBundle.add(b);
    cartBalloons.push({ mesh: b, phase: i * 1.3, baseY: b.position.y });
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.4, 3), materials.metalDark);
    string.position.set(b.position.x * 0.5, 0.65, b.position.z * 0.5);
    balloonBundle.add(string);
  }
  dynamic.balloonBundle = balloonBundle;
  dynamic.cartBalloons = cartBalloons;

  /* ---------------- hot air balloons ---------------- */
  const balloonProfiles = [
    [[0.05, 0], [0.5, 0.15], [1.1, 0.6], [1.5, 1.3], [1.55, 2.1], [1.3, 2.85], [0.8, 3.35], [0.15, 3.5]],
    [[0.03, 0], [0.4, 0.1], [0.95, 0.5], [1.35, 1.15], [1.42, 1.95], [1.22, 2.65], [0.7, 3.15], [0.1, 3.3]],
    [[0.04, 0], [0.55, 0.12], [1.2, 0.65], [1.6, 1.4], [1.6, 2.2], [1.35, 2.95], [0.8, 3.4], [0.12, 3.55]],
  ];
  const balloonColorSets = [
    ['#d9534f', '#f6e7c8', '#3f7fb5', '#f6e7c8'],
    ['#e8a33f', '#f3ddb4', '#7f4f8f', '#f3ddb4'],
    ['#4f9c78', '#f2e7c8', '#d46a6a', '#f2e7c8'],
  ];
  const balloonDefs = [
    { pos: new THREE.Vector3(96, 78, 54), s: 1.45, ph: 0.3 },
    { pos: new THREE.Vector3(-92, 88, -58), s: 1.8, ph: 1.7 },
    { pos: new THREE.Vector3(40, 96, -108), s: 1.35, ph: 3.1 },
  ];
  const balloons = [];
  for (let i = 0; i < balloonDefs.length; i++) {
    const def = balloonDefs[i];
    const bGroup = new THREE.Group();
    bGroup.position.copy(def.pos);
    bGroup.scale.setScalar(def.s);
    const profile = balloonProfiles[i].map(([x, y]) => new THREE.Vector2(x + 0.001, y));
    const envGeo = new THREE.LatheGeometry(profile, 24);
    envGeo.translate(0, 3.5, 0);
    const envMat = new THREE.MeshToonMaterial({
      map: balloonTexture(balloonColorSets[i]),
      gradientMap: materials.__gradient,
      side: THREE.DoubleSide,
    });
    const env = new THREE.Mesh(envGeo, envMat);
    env.castShadow = true;
    bGroup.add(env);
    const basket = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.75, 1.1), materials.wood);
    basket.position.y = 0.2;
    basket.castShadow = true;
    bGroup.add(basket);
    const ropeMat = materials.metalDark;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.0, 3), ropeMat);
        rope.position.set(sx * 0.45, 1.25, sz * 0.45);
        rope.rotation.z = sx * 0.15;
        rope.rotation.x = -sz * 0.15;
        bGroup.add(rope);
      }
    }
    const burnerGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: 0xffb45e,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    burnerGlow.position.set(0, 1.2, 0);
    burnerGlow.scale.set(2.4, 2.4, 1);
    burnerGlow.userData.noOutline = true;
    bGroup.add(burnerGlow);
    glows.push(burnerGlow);
    group.add(bGroup);
    balloons.push({ group: bGroup, base: def.pos.clone(), phase: def.ph, speed: 0.018 + i * 0.004, radius: Math.hypot(def.pos.x, def.pos.z), angle: Math.atan2(def.pos.z, def.pos.x) });
  }
  dynamic.balloons = balloons;

  /* ---------------- clouds ---------------- */
  const cloudGeo = cloudGeometry(rng);
  const cloudCount = 10;
  const cloudMesh = new THREE.InstancedMesh(cloudGeo, materials.cloud, cloudCount);
  cloudMesh.castShadow = false;
  cloudMesh.receiveShadow = false;
  cloudMesh.frustumCulled = false;
  const cloudDefs = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < cloudCount; i++) {
    const a = (i / cloudCount) * TAU + rand(rng, -0.2, 0.2);
    const r = rand(rng, 190, 320);
    cloudDefs.push({
      angle: a,
      radius: r,
      y: rand(rng, 88, 150),
      scale: rand(rng, 3.6, 7.4),
      speed: rand(rng, 0.004, 0.012) * (rng() > 0.5 ? 1 : -1),
      bob: rng() * TAU,
    });
    dummy.position.set(Math.cos(a) * r, cloudDefs[i].y, Math.sin(a) * r);
    dummy.rotation.y = rng() * TAU;
    dummy.scale.setScalar(cloudDefs[i].scale);
    dummy.updateMatrix();
    cloudMesh.setMatrixAt(i, dummy.matrix);
  }
  cloudMesh.instanceMatrix.needsUpdate = true;
  group.add(cloudMesh);
  dynamic.clouds = { mesh: cloudMesh, defs: cloudDefs, dummy };

  // a couple of low drifting puffs near the top of the tower for depth
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 1.2;
    const r = rand(rng, 100, 145);
    const y = rand(rng, 58, 92);
    const cloud = new THREE.Mesh(cloudGeo, materials.cloud);
    cloud.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    cloud.scale.setScalar(rand(rng, 2.0, 3.1));
    cloud.rotation.y = rng() * TAU;
    cloud.userData.drift = { angle: a, radius: r, y, speed: rand(rng, 0.004, 0.008) * (rng() > 0.5 ? 1 : -1) };
    group.add(cloud);
    if (!dynamic.lowClouds) dynamic.lowClouds = [];
    dynamic.lowClouds.push(cloud);
  }

  /* ---------------- glows for lamps ---------------- */
  const glowTex = glowTexture();
  for (const p of lampPositions) {
    const g = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xffc873,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    g.position.copy(p);
    g.scale.set(4.4, 4.4, 1);
    g.userData.noOutline = true;
    group.add(g);
    glows.push(g);
  }
  dynamic.glows = glows;

  /* ---------------- birds ---------------- */
  const birds = [];
  const birdBodyMat = materials.bird;
  for (let i = 0; i < 7; i++) {
    const bg = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.62, 4), birdBodyMat);
    body.rotation.x = Math.PI / 2;
    bg.add(body);
    const wings = [];
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.045, 0.22), birdBodyMat);
      wing.position.x = s * 0.36;
      wing.geometry.translate(s * 0.36, 0, 0);
      bg.add(wing);
      wings.push({ mesh: wing, side: s });
    }
    const def = {
      radius: rand(rng, 26, 54),
      y: rand(rng, 48, 92),
      angle: rng() * TAU,
      speed: rand(rng, 0.06, 0.12) * (rng() > 0.5 ? 1 : -1),
      flap: rng() * TAU,
      scale: rand(rng, 0.7, 1.4),
    };
    bg.scale.setScalar(def.scale);
    group.add(bg);
    birds.push({ group: bg, wings, def });
  }
  dynamic.birds = birds;

  /* ---------------- people ---------------- */
  const walkers = [];
  const walkDefs = [
    { a: 0.4, r: 28.5, speed: 0.035, dress: true },
    { a: 2.2, r: 29.5, speed: -0.028, dress: false },
    { a: 4.1, r: 27.8, speed: 0.032, dress: false },
    { a: 5.3, r: 30.3, speed: -0.024, dress: true },
    { a: 1.3, r: 26.0, speed: 0.03, dress: false },
    { a: 3.3, r: 30.8, speed: 0.022, dress: true },
    { a: 0.95, r: 29.0, speed: 0.026, dress: false },
    { a: 2.7, r: 31.2, speed: -0.03, dress: true },
    { a: 4.8, r: 28.4, speed: 0.024, dress: false },
  ];
  for (let i = 0; i < walkDefs.length; i++) {
    const d = walkDefs[i];
    const p = person(materials, Math.cos(d.a) * d.r, Math.sin(d.a) * d.r, -d.a + Math.PI / 2, 300 + i, rand(rng, 1.05, 1.2), true);
    group.add(p.group);
    walkers.push({ ...p, def: d, angle: d.a });
  }

  const standers = [
    [2.1, 3.4, 0.4],
    [4.2, 1.7, -0.8],
    [CAROUSEL.x + 7, CAROUSEL.z + 7.8, 2.3],
    [CAROUSEL.x - 6, CAROUSEL.z + 8.5, 3.2],
    [CAFE.x + 6.4, CAFE.z + 2.1, -1.4],
    [CART.x - 1.8, CART.z + 2.4, 2.9],
    [32, -8, 1.2],
    [-28, -19, 0.3],
    [POND.x + 13.0, POND.z + 3.0, -1.4],
    [POND.x - 8.0, POND.z - 11.2, 0.7],
  ];
  for (let i = 0; i < standers.length; i++) {
    const [x, z, rot] = standers[i];
    const p = person(materials, x, z, rot, 500 + i, rand(rng, 1.0, 1.16), false);
    group.add(p.group);
  }

  // a child with a balloon near the plaza
  {
    const child = person(materials, 30.5, 12.5, -0.8, 777, 0.68, false);
    group.add(child.group);
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), materials.cloth4);
    b.position.set(31.1, 3.0, 12.4);
    b.scale.set(1, 1.18, 1);
    b.castShadow = true;
    group.add(b);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.65, 3), materials.metalDark);
    str.position.set(30.9, 2.0, 12.45);
    str.rotation.z = -0.15;
    group.add(str);
    dynamic.childBalloon = b;
  }

  /* ---------------- signs ---------------- */
  const parkSignTex = canvasTexture(512, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3e6b54';
    roundRectPath(ctx, 10, 10, w - 20, h - 20, 32);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#f1e3c2';
    ctx.stroke();
    ctx.fillStyle = '#f7ecd0';
    ctx.textAlign = 'center';
    ctx.font = 'bold 58px Georgia, serif';
    ctx.fillText('CHAMP DE MARS', w / 2, 112);
    ctx.font = '30px Georgia, serif';
    ctx.fillStyle = '#dfd2ae';
    ctx.fillText('JARDIN  ·  PARIS', w / 2, 170);
  });
  const signBoardMat = new THREE.MeshToonMaterial({ map: parkSignTex, gradientMap: materials.__gradient, side: THREE.DoubleSide });
  const signBoard = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), signBoardMat);
  signBoard.position.set(0, 2.6, 0);
  signBoard.castShadow = true;
  const signGroup = new THREE.Group();
  signGroup.position.set(31.5, 0, 30.5);
  signGroup.rotation.y = -2.35;
  for (const sx of [-1.9, 1.9]) {
    bucket.cyl('wood', 0.12, 0.15, 3.3, 6, 31.5 + sx * Math.cos(-2.35), 1.65, 30.5 - sx * Math.sin(-2.35));
  }
  signGroup.add(signBoard);
  group.add(signGroup);

  /* ---------------- merge static geometry ---------------- */
  for (const [role, geo] of bucket.merge()) {
    const mat = materials[role];
    if (!mat) {
      console.warn('missing material role', role);
      continue;
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  /* ---------------- update ---------------- */
  function update(time, dt, glowAmount) {
    // carousel
    carousel.rotation.y += dt * 0.09;
    for (const h of horses) {
      h.holder.position.y = h.baseY + Math.sin(time * 2.6 + h.phase) * 0.22;
    }
    // balloon bundle
    balloonBundle.rotation.z = Math.sin(time * 0.9) * 0.06;
    balloonBundle.rotation.x = Math.cos(time * 0.7) * 0.05;
    for (const b of cartBalloons) {
      b.mesh.position.y = b.baseY + Math.sin(time * 1.4 + b.phase) * 0.06;
    }
    // hot air balloons drift in slow circles
    for (const b of balloons) {
      b.angle += dt * b.speed;
      b.group.position.set(
        Math.cos(b.angle) * b.radius,
        b.base.y + Math.sin(time * 0.35 + b.phase) * 2.4,
        Math.sin(b.angle) * b.radius
      );
      b.group.rotation.y = Math.sin(time * 0.2 + b.phase) * 0.3;
    }
    // clouds
    for (let i = 0; i < cloudDefs.length; i++) {
      const c = cloudDefs[i];
      c.angle += dt * c.speed * 0.06;
      const d = dynamic.clouds.dummy;
      d.position.set(Math.cos(c.angle) * c.radius, c.y + Math.sin(time * 0.12 + c.bob) * 0.6, Math.sin(c.angle) * c.radius);
      d.rotation.set(0, c.angle * 1.5 + c.bob, 0);
      d.scale.setScalar(c.scale);
      d.updateMatrix();
      cloudMesh.setMatrixAt(i, d.matrix);
    }
    cloudMesh.instanceMatrix.needsUpdate = true;
    for (const c of dynamic.lowClouds || []) {
      const dr = c.userData.drift;
      dr.angle += dt * dr.speed * 0.06;
      c.position.set(Math.cos(dr.angle) * dr.radius, dr.y + Math.sin(time * 0.2) * 0.4, Math.sin(dr.angle) * dr.radius);
    }
    // birds
    for (const b of birds) {
      const d = b.def;
      d.angle += dt * d.speed;
      const x = Math.cos(d.angle) * d.radius;
      const z = Math.sin(d.angle) * d.radius;
      const y = d.y + Math.sin(time * 0.7 + d.flap) * 1.6;
      b.group.position.set(x, y, z);
      b.group.rotation.y = -d.angle + (d.speed > 0 ? Math.PI / 2 : -Math.PI / 2);
      b.group.rotation.z = d.speed > 0 ? -0.14 : 0.14;
      const flap = Math.sin(time * 7 + d.flap) * 0.55;
      for (const w of b.wings) {
        w.mesh.rotation.z = w.side * flap;
        w.mesh.rotation.x = 0;
      }
    }
    // walkers
    for (const w of walkers) {
      w.angle += dt * w.def.speed;
      const x = Math.cos(w.angle) * w.def.r;
      const z = Math.sin(w.angle) * w.def.r;
      const s = Math.sign(w.def.speed);
      w.group.position.set(x, Math.abs(Math.sin(time * 4.2 + w.angle * 12)) * 0.055, z);
      w.group.rotation.y = -w.angle + (s > 0 ? Math.PI / 2 : -Math.PI / 2);
      const swing = Math.sin(time * 5.5 + w.angle * 10) * 0.5;
      w.legs[0].rotation.x = swing;
      w.legs[1].rotation.x = -swing;
    }
    // pond fountain & ducks
    if (dynamic.fountainJet) {
      dynamic.fountainJet.material.opacity = 0.45 + 0.12 * Math.sin(time * 2.1);
      dynamic.fountainJet.scale.y = 5.2 + Math.sin(time * 2.1) * 0.28;
    }
    if (dynamic.droplets) {
      for (const d of dynamic.droplets) {
        const p = (time * 0.55 + d.userData.phase) % 1;
        const a = d.userData.angle + time * 0.08;
        const rad = 0.3 + p * 1.9;
        d.position.set(
          POND.x + Math.cos(a) * rad,
          3.0 + Math.sin(p * Math.PI) * 1.7 - p * 1.8,
          POND.z + Math.sin(a) * rad
        );
        d.scale.setScalar(0.55 + (1 - p) * 0.8);
      }
    }
    if (dynamic.ducks) {
      for (const duck of dynamic.ducks) {
        duck.angle += dt * duck.speed;
        const x = POND.x + Math.cos(duck.angle) * duck.radius * POND.sx;
        const z = POND.z + Math.sin(duck.angle) * duck.radius * POND.sz;
        duck.group.position.set(x, 0.08 + Math.sin(time * 2 + duck.angle * 3) * 0.035, z);
        duck.group.rotation.y = -duck.angle + Math.PI / 2;
      }
    }

    // child's balloon
    if (dynamic.childBalloon) {
      dynamic.childBalloon.position.y = 3.0 + Math.sin(time * 1.1) * 0.12;
      dynamic.childBalloon.position.x = 31.1 + Math.sin(time * 0.7) * 0.06;
    }
    // moon shimmer on the pond
    if (dynamic.pondShimmer) {
      dynamic.pondShimmer.material.opacity = glowAmount * (0.45 + Math.sin(time * 1.3) * 0.08);
    }
    // glows
    for (const g of glows) {
      g.material.opacity = glowAmount;
      const sc = g.userData.baseScale || g.scale.x;
      g.userData.baseScale = sc;
      g.scale.setScalar(sc * (0.94 + Math.sin(time * 9 + g.position.x * 3.1) * 0.05));
    }
  }

  return { group, update, glows, treeSpots };
}
