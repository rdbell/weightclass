import * as THREE from 'three';
import { mulberry32, boxGeo, barGeo, merge, smoothstep } from './utils.js';
import { toon, bind, inkFlatMaterial, birdMat, addShell } from './materials.js';

export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const edge = smoothstep(140, 320, r);
  const flat = 1 - (1 - smoothstep(26, 75, Math.abs(x))) * smoothstep(-40, 60, z);
  return (Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 + 0.6)
    + 0.6 * Math.sin(x * 0.043 + 0.5) * Math.cos(z * 0.05 + 2.0)) * 4.5 * edge * flat;
}

function discGeometry(radius, rings, sectors) {
  const pos = [], idx = [];
  for (let i = 0; i <= rings; i++) {
    const rr = radius * Math.sqrt(i / rings);
    for (let s = 0; s <= sectors; s++) {
      const a = (s / sectors) * Math.PI * 2;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pos.push(x, groundHeight(x, z), z);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let s = 0; s < sectors; s++) {
      const a = i * (sectors + 1) + s, b = a + sectors + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  let ny = 0;
  const nor = g.attributes.normal;
  for (let i = 0; i < nor.count; i++) ny += nor.getY(i);
  if (ny < 0) { // flip winding if normals point down
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t;
    }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

function roundedRect(w, h, rad) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + rad, y);
  s.lineTo(x + w - rad, y);
  s.absarc(x + w - rad, y + rad, rad, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - rad);
  s.absarc(x + w - rad, y + h - rad, rad, 0, Math.PI / 2, false);
  s.lineTo(x + rad, y + h);
  s.absarc(x + rad, y + h - rad, rad, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + rad);
  s.absarc(x + rad, y + rad, rad, Math.PI, Math.PI * 1.5, false);
  return s;
}

function circleShape(rad) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rad, 0, Math.PI * 2, false);
  return s;
}

function flatInkBorder(shape, y) {
  const g = new THREE.ShapeGeometry(shape, 24);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const m = new THREE.Mesh(g, inkFlatMaterial);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

function flatInkRing(inner, outer, y) {
  const g = new THREE.RingGeometry(inner, outer, 72);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const m = new THREE.Mesh(g, inkFlatMaterial);
  m.castShadow = false;
  m.receiveShadow = false;
  return m;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function poolTexture() {
  return canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
}

function flagTexture() {
  return canvasTexture(96, 48, (g) => {
    g.fillStyle = '#3a5aa8'; g.fillRect(0, 0, 32, 48);
    g.fillStyle = '#f4f4f4'; g.fillRect(32, 0, 32, 48);
    g.fillStyle = '#c8394a'; g.fillRect(64, 0, 32, 48);
  });
}

function balloonTexture(a, b) {
  return canvasTexture(256, 128, (g, w, h) => {
    const n = 8;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 === 0 ? a : b;
      g.fillRect((i / n) * w, 0, w / n + 1, h);
    }
  });
}

export function buildScenery(seed = 20261117) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  const animated = {};

  // ---------- ground ----------
  const groundMat = toon('#7ec35a');
  bind(groundMat, 'grass');
  const ground = new THREE.Mesh(discGeometry(760, 72, 96), groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // ---------- plaza + avenue ----------
  const plazaMat = toon('#e6d3a8');
  bind(plazaMat, 'plaza');
  const plazaShape = circleShape(95);
  const plazaGeo = new THREE.ExtrudeGeometry(plazaShape, { depth: 0.36, bevelEnabled: false });
  plazaGeo.rotateX(-Math.PI / 2);
  plazaGeo.translate(0, 0.1, 0);
  const plaza = new THREE.Mesh(plazaGeo, plazaMat);
  plaza.receiveShadow = true;
  plaza.castShadow = false;
  group.add(plaza);
  group.add(flatInkBorder(circleShape(96.8), 0.065));
  group.add(flatInkRing(71, 72.6, 0.47));
  group.add(flatInkRing(44, 45.2, 0.47));

  const avenueMat = toon('#dcbf92');
  bind(avenueMat, 'avenue');
  const aveShape = roundedRect(34, 470, 17);
  const aveGeo = new THREE.ExtrudeGeometry(aveShape, { depth: 0.34, bevelEnabled: false });
  aveGeo.rotateX(-Math.PI / 2);
  aveGeo.translate(0, 0.09, 290);
  const avenue = new THREE.Mesh(aveGeo, avenueMat);
  avenue.receiveShadow = true;
  avenue.castShadow = false;
  group.add(avenue);
  const aveBorder = flatInkBorder(roundedRect(37, 473, 18.5), 0.06);
  aveBorder.position.z = 290;
  group.add(aveBorder);

  // ---------- buildings ----------
  const walls = [], roofs = [], wins = [];
  const winMat = new THREE.MeshBasicMaterial({ color: '#3b4a5e' });
  bind(winMat, 'windows');
  const buildingPos = [];
  const N = 26;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + (rng() - 0.5) * 0.14;
    const rad = 300 + rng() * 210;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (z > 110 && Math.abs(x) < 95) continue; // leave the avenue a clear run
    const w = 26 + rng() * 36, d = 22 + rng() * 26, h = 14 + rng() * 22;
    const ry = -a - Math.PI / 2;
    const y0 = groundHeight(x, z) - 1.5;
    buildingPos.push([x, z]);
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y0, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
      new THREE.Vector3(1, 1, 1));
    const local = (g) => { g.applyMatrix4(m); return g; };

    walls.push(local(boxGeo(w, h, d, 0, h / 2, 0)));

    const roofH = h * 0.42;
    const frustum = new THREE.CylinderGeometry(0.55, 1.0, 1, 4, 1);
    frustum.rotateY(Math.PI / 4);
    frustum.scale((w / 2) * 1.15, roofH, (d / 2) * 1.15);
    frustum.translate(0, h + roofH / 2, 0);
    roofs.push(local(frustum));
    roofs.push(local(boxGeo(w * 0.6, h * 0.18, d * 0.6, 0, h + roofH + h * 0.09, 0)));
    const nChim = 1 + Math.floor(rng() * 3);
    for (let c = 0; c < nChim; c++) {
      roofs.push(local(boxGeo(1.4, 3.2, 1.4,
        (rng() - 0.5) * w * 0.5, h + roofH + 1.4, (rng() - 0.5) * d * 0.5)));
    }

    // windows on the four facades
    const faces = [
      { rot: 0, px: 0, pz: d / 2 + 0.06, fw: w },
      { rot: Math.PI, px: 0, pz: -d / 2 - 0.06, fw: w },
      { rot: Math.PI / 2, px: w / 2 + 0.06, pz: 0, fw: d },
      { rot: -Math.PI / 2, px: -w / 2 - 0.06, pz: 0, fw: d },
    ];
    for (const f of faces) {
      const cols = Math.floor((f.fw - 5) / 6.5);
      const rows = Math.floor((h - 4) / 6.5);
      for (let cx = 0; cx < cols; cx++) {
        for (let ry2 = 0; ry2 < rows; ry2++) {
          if (rng() < 0.14) continue;
          const px = (cx - (cols - 1) / 2) * 6.5;
          const py = 4.5 + ry2 * 6.5;
          const g = new THREE.PlaneGeometry(2.6, 3.6);
          if (f.rot) g.rotateY(f.rot);
          g.translate(f.px + (f.rot === 0 || f.rot === Math.PI ? px : 0),
            py, f.pz + (f.rot === Math.PI / 2 || f.rot === -Math.PI / 2 ? px : 0));
          wins.push(local(g));
        }
      }
    }
  }

  const wallMat = toon('#f4e6c6', { rimStrength: 0.18 });
  bind(wallMat, 'wall');
  const wallMesh = new THREE.Mesh(merge(walls), wallMat);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  addShell(wallMesh, 0.45);
  group.add(wallMesh);

  const roofMat = toon('#5d6f96', { rimStrength: 0.22 });
  bind(roofMat, 'roof');
  const roofMesh = new THREE.Mesh(merge(roofs), roofMat);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  addShell(roofMesh, 0.35);
  group.add(roofMesh);

  const winMesh = new THREE.Mesh(merge(wins), winMat);
  winMesh.castShadow = false;
  winMesh.receiveShadow = false;
  group.add(winMesh);

  // ---------- trees ----------
  const trunksA = [], canA = [], canB = [];
  function blob(list, r, x, y, z) {
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.translate(x, y, z);
    list.push(g);
  }
  function tree(x, z, s, tall, alt) {
    const y0 = groundHeight(x, z);
    const trunk = new THREE.CylinderGeometry(tall ? 0.4 * s : 0.55 * s, tall ? 0.55 * s : 0.7 * s,
      tall ? 5.5 * s : 3.6 * s, 6);
    trunk.translate(x, y0 + (tall ? 2.7 : 1.8) * s, z);
    trunksA.push(trunk);
    const list = alt ? canB : canA;
    if (tall) {
      blob(list, 2.2 * s, x, y0 + 6.6 * s, z);
      blob(list, 1.8 * s, x, y0 + 8.7 * s, z + 0.6 * s);
      blob(list, 1.3 * s, x, y0 + 10.4 * s, z);
    } else {
      blob(list, 2.8 * s, x, y0 + 5.0 * s, z);
      blob(list, 2.2 * s, x + 1.7 * s, y0 + 6.3 * s, z + 0.8 * s);
      blob(list, 2.0 * s, x - 1.8 * s, y0 + 6.1 * s, z - 0.7 * s);
    }
  }
  const treePts = [];
  let attempts = 0;
  while (treePts.length < 64 && attempts++ < 500) {
    const x = (rng() * 2 - 1) * 640;
    const z = (rng() * 2 - 1) * 640;
    const r = Math.hypot(x, z);
    if (r < 118 || r > 645) continue;
    if (z > 20 && Math.abs(x) < 30) continue; // avenue
    if (buildingPos.some(([bx, bz]) => (bx - x) ** 2 + (bz - z) ** 2 < 34 * 34)) continue;
    if (treePts.some(([tx, tz]) => (tx - x) ** 2 + (tz - z) ** 2 < 13 * 13)) continue;
    treePts.push([x, z]);
    tree(x, z, 0.8 + rng() * 0.6, false, rng() < 0.5);
  }
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 10; i++) {
      const z = 105 + i * 43 + (rng() - 0.5) * 6;
      tree(side * 24.5, z, 0.75 + rng() * 0.25, true, i % 2 === 0);
    }
  }

  const trunkMat = toon('#7c4a2d');
  bind(trunkMat, 'trunk');
  const trunkMesh = new THREE.Mesh(merge(trunksA), trunkMat);
  trunkMesh.castShadow = true;
  trunkMesh.receiveShadow = true;
  addShell(trunkMesh, 0.12);
  group.add(trunkMesh);

  const leafMat = toon('#55a644', { rimStrength: 0.3 });
  bind(leafMat, 'leaf');
  const leafMesh = new THREE.Mesh(merge(canA), leafMat);
  leafMesh.castShadow = true;
  leafMesh.receiveShadow = true;
  addShell(leafMesh, 0.3);
  group.add(leafMesh);

  const leafMat2 = toon('#6dbb4f', { rimStrength: 0.3 });
  bind(leafMat2, 'leaf2');
  const leafMesh2 = new THREE.Mesh(merge(canB), leafMat2);
  leafMesh2.castShadow = true;
  leafMesh2.receiveShadow = true;
  addShell(leafMesh2, 0.3);
  group.add(leafMesh2);

  // ---------- lampposts ----------
  const poles = [], bulbs = [], pools = [];
  for (let i = 0; i < 9; i++) {
    const z = 130 + i * 46;
    for (const x of [-23, 23]) {
      const y0 = groundHeight(x, z);
      const pole = new THREE.CylinderGeometry(0.2, 0.28, 5.6, 6);
      pole.translate(x, y0 + 2.8, z);
      poles.push(pole);
      const cap = new THREE.CylinderGeometry(0.5, 0.15, 0.7, 6);
      cap.translate(x, y0 + 5.95, z);
      poles.push(cap);
      const bulb = new THREE.SphereGeometry(0.34, 8, 6);
      bulb.translate(x, y0 + 5.62, z);
      bulbs.push(bulb);
      const pool = new THREE.PlaneGeometry(8, 8);
      pool.rotateX(-Math.PI / 2);
      pool.translate(x, y0 + 0.05, z);
      pools.push(pool);
    }
  }
  const poleMat = toon('#3e4a3c');
  bind(poleMat, 'lampPost');
  const poleMesh = new THREE.Mesh(merge(poles), poleMat);
  poleMesh.castShadow = true;
  poleMesh.receiveShadow = true;
  addShell(poleMesh, 0.09);
  group.add(poleMesh);

  const bulbMat = new THREE.MeshBasicMaterial({ color: '#6a7076' });
  bind(bulbMat, 'lampBulb');
  group.add(new THREE.Mesh(merge(bulbs), bulbMat));

  const poolMat = new THREE.MeshBasicMaterial({
    map: poolTexture(), color: '#ffd98a', transparent: true, opacity: 0,
    depthWrite: false,
  });
  const poolMesh = new THREE.Mesh(merge(pools), poolMat);
  poolMesh.renderOrder = 1;
  group.add(poolMesh);

  // ---------- clouds ----------
  const cloudMat = toon('#ffffff', { rimStrength: 0.15 });
  bind(cloudMat, 'cloud');
  const cloudGeos = [];
  for (let i = 0; i < 9; i++) {
    const n = 5 + Math.floor(rng() * 3);
    const cx = (rng() * 2 - 1) * 420;
    const cz = (rng() * 2 - 1) * 420;
    const cy = 270 + rng() * 130;
    for (let j = 0; j < n; j++) {
      const r = 10 + rng() * 16;
      const g = new THREE.IcosahedronGeometry(r, 1);
      g.scale(1, 0.55, 1);
      g.translate(cx + (rng() * 2 - 1) * r * 1.6, cy + (rng() * 2 - 1) * 5, cz + (rng() * 2 - 1) * r * 1.2);
      cloudGeos.push(g);
    }
  }
  const cloudMesh = new THREE.Mesh(merge(cloudGeos), cloudMat);
  cloudMesh.castShadow = true;
  cloudMesh.receiveShadow = false;
  addShell(cloudMesh, 0.55);
  const clouds = new THREE.Group();
  clouds.add(cloudMesh);
  group.add(clouds);
  animated.clouds = clouds;

  // ---------- birds ----------
  const birds = [];
  for (let i = 0; i < 6; i++) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 5), birdMat);
    body.geometry.rotateX(Math.PI / 2);
    bird.add(body);
    const wingL = new THREE.Group();
    wingL.position.set(0.25, 0.1, 0);
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), birdMat);
    wl.position.x = 1.3;
    wingL.add(wl);
    const wingR = new THREE.Group();
    wingR.position.set(-0.25, 0.1, 0);
    const wr = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.1), birdMat);
    wr.position.x = -1.3;
    wingR.add(wr);
    bird.add(wingL, wingR);
    bird.scale.setScalar(1.5);
    bird.userData = {
      r: 120 + rng() * 80, w: 0.12 + rng() * 0.1,
      off: rng() * Math.PI * 2, y: 150 + rng() * 70, ph: rng() * Math.PI * 2,
      wl, wr,
    };
    birds.push(bird);
    group.add(bird);
  }
  animated.birds = birds;

  // ---------- balloons ----------
  const balloons = [];
  const balloonDefs = [
    { x: 240, y: 175, z: -300, s: 1.0, a: '#d94f45', b: '#f2e3c0' },
    { x: -320, y: 235, z: -170, s: 0.8, a: '#3f7fbf', b: '#f2e3c0' },
  ];
  for (const d of balloonDefs) {
    const b = new THREE.Group();
    const env = new THREE.Mesh(
      new THREE.SphereGeometry(7 * d.s, 20, 14),
      toon('#ffffff', { map: balloonTexture(d.a, d.b) }));
    env.castShadow = true;
    addShell(env, 0.28 * d.s);
    b.add(env);
    const basketMat = toon('#8a5a34');
    const basket = new THREE.Mesh(boxGeo(2.6 * d.s, 2.2 * d.s, 2.6 * d.s, 0, -10.2 * d.s, 0), basketMat);
    basket.castShadow = true;
    b.add(basket);
    for (const [rx, rz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      b.add(new THREE.Mesh(barGeo(
        new THREE.Vector3(rx * 3.4 * d.s, -4 * d.s, rz * 3.4 * d.s),
        new THREE.Vector3(rx * 1.1 * d.s, -9.1 * d.s, rz * 1.1 * d.s),
        0.1 * d.s, 0.1 * d.s), basketMat));
    }
    b.position.set(d.x, d.y, d.z);
    balloons.push(b);
    group.add(b);
  }
  animated.balloons = balloons;

  // ---------- flag on the second platform ----------
  const flagGroup = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 13, 6), toon('#c8923c'));
  pole.position.set(15, 124, 15);
  flagGroup.add(pole);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), toon('#e8b04b'));
  knob.position.set(15, 130.6, 15);
  flagGroup.add(knob);
  const flagGeo = new THREE.PlaneGeometry(9, 5.5, 16, 8);
  flagGeo.translate(4.5, 0, 0);
  const flag = new THREE.Mesh(flagGeo, toon('#f4f4f4', { map: flagTexture(), side: THREE.DoubleSide }));
  flag.position.set(15, 128, 15);
  flag.castShadow = true;
  flagGroup.add(flag);
  group.add(flagGroup);
  animated.flag = flag;
  animated.flagBase = flagGeo.attributes.position.array.slice();

  return { group, ...animated };
}