// Everything you can sit on, read on or trip over, placed straight from the
// plan in layout.js.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { L } from './layout.js';
import { box, boxFromBounds as B, cyl, rod, rbox, sphere, stemGeometry } from './geo.js';
import { stream } from './rng.js';

const D = THREE.MathUtils.degToRad;

// ---------------------------------------------------------------------------
// rug: centred on the coffee table, under the sofa's front legs
// ---------------------------------------------------------------------------
function buildRug(m) {
  const w = L.rug.x1 - L.rug.x0;
  const d = L.rug.halfZ * 2;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, L.rug.y, d),
    [m.rugSide, m.rugSide, m.rug, m.rugSide, m.rugSide, m.rugSide]
  );
  mesh.position.set((L.rug.x0 + L.rug.x1) / 2, L.rug.y / 2, 0);
  mesh.receiveShadow = true;
  mesh.name = 'rug';
  return mesh;
}

// ---------------------------------------------------------------------------
// three-seat sofa, facing the fire (+x)
// ---------------------------------------------------------------------------
function buildSofa(m) {
  const s = L.sofa;
  const g = new THREE.Group();
  g.name = 'sofa';
  const len = s.halfZ * 2;

  for (const x of [s.legFrontX, s.legBackX]) {
    for (const z of [-s.halfZ + 0.1, s.halfZ - 0.1]) {
      g.add(cyl(m.walnut, 0.024, 0.032, 0.11, x, 0.055, z, { seg: 10 }));
    }
  }
  // frame, arms, back
  g.add(rbox(m.sofaCloth, s.depth - 0.02, 0.3, len - 0.02, (s.backX + s.frontX) / 2, 0.26, 0, 0.05, 3));
  g.add(rbox(m.sofaCloth, s.depth - 0.02, 0.52, 0.18, (s.backX + s.frontX) / 2, 0.37, -s.halfZ + 0.09, 0.07, 3));
  g.add(rbox(m.sofaCloth, s.depth - 0.02, 0.52, 0.18, (s.backX + s.frontX) / 2, 0.37, s.halfZ - 0.09, 0.07, 3));
  g.add(rbox(m.sofaCloth, 0.2, s.backTopY - 0.11, len - 0.02, s.backX + 0.1, (0.11 + s.backTopY) / 2, 0, 0.1, 4));
  // a rolled top edge so the back does not read as a plank from behind
  g.add(rod(m.sofaCloth, 'z', len - 0.05, 0.062, s.backX + 0.1, s.backTopY - 0.005, 0, { seg: 14 }));
  // two shallow seams dividing the back panel
  for (const z of [-(len - 0.44) / 6, (len - 0.44) / 6]) {
    g.add(box(m.sofaCloth, 0.012, s.backTopY - 0.2, 0.012, s.backX + 0.005, (0.16 + s.backTopY) / 2, z, { receive: true }));
  }
  // inner back face, slightly lighter so the seats read
  g.add(rbox(m.sofaClothLight, 0.05, 0.42, len - 0.42, s.backX + 0.21, 0.66, 0, 0.03, 2));

  // three seats: cushion + back cushion
  const seats = [-1, 0, 1];
  const seatW = (len - 0.44) / 3;
  for (const i of seats) {
    const z = i * seatW;
    const c = rbox(m.sofaClothLight, 0.56, 0.15, seatW - 0.035, s.backX + 0.48, 0.47, z, 0.07, 4);
    c.rotation.z = -0.02;
    const b = rbox(m.sofaClothLight, 0.17, 0.46, seatW - 0.05, s.backX + 0.3, 0.66, z, 0.075, 4);
    b.rotation.z = 0.13;
    g.add(c, b);
  }

  // two scatter cushions, propped in the corners
  const p1 = rbox(m.throwCloth, 0.13, 0.34, 0.34, s.backX + 0.36, 0.62, -s.halfZ + 0.42, 0.08, 4);
  p1.rotation.set(0.05, 0.15, 0.2);
  const p2 = rbox(m.sofaCloth, 0.13, 0.32, 0.32, s.backX + 0.35, 0.6, s.halfZ - 0.44, 0.08, 4);
  p2.rotation.set(-0.05, -0.2, -0.17);
  g.add(p1, p2);

  // a blanket draped over the south arm
  const armZ = s.halfZ - 0.09;
  const thr = new THREE.Mesh(
    drapeGeometry(0.5, 0.3, 0.2, 0.46, { ripples: 6, amp: 0.016 }),
    m.throwCloth
  );
  thr.position.set(1.0, 0.63, armZ - 0.1);
  thr.rotation.y = 0.03;
  thr.castShadow = true;
  thr.receiveShadow = true;
  g.add(thr);
  return g;
}

/**
 * A piece of cloth hanging over a horizontal edge: the cross-section runs down
 * `inner`, across `top` and down `outer`, with soft folds along `width`.
 */
function drapeGeometry(width, inner, top, outer, { ripples = 5, amp = 0.014, segsU = 14, segsV = 18 } = {}) {
  const total = inner + top + outer;
  const verts = [];
  const idx = [];
  for (let j = 0; j <= segsV; j++) {
    const t = (j / segsV) * total;
    let z;
    let y;
    let pz;
    let py;
    if (t <= inner) {
      z = 0;
      y = -inner + t;
      pz = -1;
      py = 0;
    } else if (t <= inner + top) {
      z = t - inner;
      y = 0;
      pz = 0;
      py = 1;
    } else {
      z = top;
      y = -(t - inner - top);
      pz = 1;
      py = 0;
    }
    const droop = Math.min(1, Math.min(t, total - t) / 0.12);
    for (let i = 0; i <= segsU; i++) {
      const u = i / segsU;
      const fold = Math.sin(u * Math.PI * ripples) * amp * droop;
      verts.push((u - 0.5) * width, y + py * fold, z + pz * fold);
    }
  }
  const row = segsU + 1;
  for (let j = 0; j < segsV; j++) {
    for (let i = 0; i < segsU; i++) {
      const a = j * row + i;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------------------
// armchair, turned 45 deg to face the fire
// ---------------------------------------------------------------------------
function buildArmchair(m) {
  const c = L.chair;
  const g = new THREE.Group();
  g.name = 'armchair';
  const hw = c.halfW;
  const hd = c.halfD;

  for (const x of [-hw + 0.09, hw - 0.09]) {
    for (const z of [-hd + 0.09, hd - 0.09]) {
      g.add(cyl(m.walnut, 0.022, 0.03, 0.11, x, 0.055, z, { seg: 10 }));
    }
  }
  g.add(rbox(m.leather, hw * 2 - 0.02, 0.28, hd * 2 - 0.04, 0, 0.25, 0, 0.05, 3));
  const seat = rbox(m.leather, hw * 2 - 0.14, 0.16, hd * 2 - 0.18, 0, c.seatY - 0.02, 0.03, 0.06, 4);
  g.add(seat);
  const back = rbox(m.leather, hw * 2 - 0.02, 0.6, 0.17, 0, 0.62, -hd + 0.09, 0.07, 4);
  back.rotation.x = -0.12;
  g.add(back);
  for (const sx of [-1, 1]) {
    g.add(rbox(m.leather, 0.14, 0.44, hd * 2 - 0.06, sx * (hw - 0.07), 0.4, 0.0, 0.07, 4));
  }
  // little bolster cushion
  const bol = cyl(m.throwCloth, 0.07, 0.07, 0.3, 0, 0.6, -0.14, { seg: 12 });
  bol.rotation.z = Math.PI / 2;
  bol.position.y = 0.58;
  g.add(bol);

  g.position.set(c.cx, 0, c.cz);
  g.rotation.y = D(c.deg);
  return g;
}

// ---------------------------------------------------------------------------
// coffee table, with something worth reading on it
// ---------------------------------------------------------------------------
function buildTable(m) {
  const t = L.table;
  const g = new THREE.Group();
  g.name = 'coffee-table';
  const w = t.x1 - t.x0;
  const d = t.halfZ * 2;
  const cx = t.cx;
  g.add(rbox(m.walnut, w, 0.045, d, cx, t.topY - 0.022, 0, 0.012, 2));
  // apron
  g.add(
    B(m.walnut, cx - w / 2 + 0.05, cx + w / 2 - 0.05, t.topY - 0.11, t.topY - 0.045, -d / 2 + 0.04, -d / 2 + 0.07),
    B(m.walnut, cx - w / 2 + 0.05, cx + w / 2 - 0.05, t.topY - 0.11, t.topY - 0.045, d / 2 - 0.07, d / 2 - 0.04),
    B(m.walnut, cx - w / 2 + 0.04, cx - w / 2 + 0.07, t.topY - 0.11, t.topY - 0.045, -d / 2 + 0.05, d / 2 - 0.05),
    B(m.walnut, cx + w / 2 - 0.07, cx + w / 2 - 0.04, t.topY - 0.11, t.topY - 0.045, -d / 2 + 0.05, d / 2 - 0.05)
  );
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(cyl(m.walnut, 0.021, 0.028, t.topY - 0.045, cx + sx * (w / 2 - 0.055), (t.topY - 0.045) / 2, sz * (d / 2 - 0.06), { seg: 10 }));
    }
  }
  g.add(B(m.walnut, cx - w / 2 + 0.09, cx + w / 2 - 0.09, 0.11, 0.13, -d / 2 + 0.1, d / 2 - 0.1));

  // what is on it
  const top = t.topY;
  g.add(bookStack(m, cx - 0.02, top, -0.24, 3, 0.18));
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.ceramicBlue);
  bowl.rotation.x = Math.PI;
  bowl.position.set(cx + 0.02, top + 0.06, 0.12);
  bowl.castShadow = true;
  bowl.receiveShadow = true;
  g.add(bowl);
  g.add(cyl(m.ceramicBlue, 0.05, 0.05, 0.012, cx + 0.02, top + 0.006, 0.12, { seg: 14 }));
  // candle on a brass dish
  g.add(cyl(m.brass, 0.055, 0.06, 0.012, cx, top + 0.006, -0.36, { seg: 16 }));
  g.add(cyl(m.wax, 0.026, 0.028, 0.11, cx, top + 0.068, -0.36, { seg: 12 }));
  const flame = flameSprite(0.05, 0.11, 0xffc46a);
  flame.position.set(cx, top + 0.145, -0.36);
  g.add(flame);
  // a mug, still warm
  const mug = cyl(m.ceramic, 0.038, 0.032, 0.085, cx - 0.13, top + 0.043, 0.3, { seg: 14 });
  g.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 14, Math.PI * 1.4), m.ceramic);
  handle.position.set(cx - 0.165, top + 0.045, 0.3);
  handle.rotation.y = Math.PI / 2;
  handle.castShadow = true;
  g.add(handle);
  return { group: g, anim: [flame] };
}

function flameSprite(w, h, color) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: dotTexture(),
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.9,
    })
  );
  s.scale.set(w, h, 1);
  return s;
}

let _dot;
function dotTexture() {
  if (_dot) return _dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,250,230,1)');
  rg.addColorStop(0.3, 'rgba(255,190,110,0.65)');
  rg.addColorStop(1, 'rgba(255,150,60,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, 64, 64);
  _dot = new THREE.CanvasTexture(c);
  _dot.colorSpace = THREE.SRGBColorSpace;
  return _dot;
}

function bookStack(m, x, y, z, count, scale = 1) {
  const rng = stream(`stack${x.toFixed(2)}${z.toFixed(2)}`);
  const g = new THREE.Group();
  let yy = y;
  for (let i = 0; i < count; i++) {
    const w = rng.range(0.17, 0.23) * scale; // along z
    const d = rng.range(0.12, 0.16) * scale; // along x
    const h = rng.range(0.022, 0.035) * scale;
    const bk = box(rng.pick(m.bookPalette), d, h, w, x, yy + h / 2, z, { cast: true });
    bk.rotation.y = rng.range(-0.25, 0.25);
    g.add(bk);
    yy += h;
  }
  return g;
}

// ---------------------------------------------------------------------------
// bookcase, floor to ceiling, plus a rolling ladder
// ---------------------------------------------------------------------------
function buildShelf(m) {
  const s = L.shelf;
  const g = new THREE.Group();
  g.name = 'bookcase';
  const front = s.x1; // -2.62
  const back = s.x0 + 0.02; // back panel inner face
  const boardT = 0.024;

  // carcass
  g.add(B(m.walnut, s.x0, back, 0, L.height, s.z0, s.z1)); // back panel
  g.add(B(m.walnut, back, front, 0, L.height, s.z1 - 0.022, s.z1, { cast: true })); // south end
  g.add(B(m.walnut, back, front, 0, L.height, s.z0, s.z0 + 0.02)); // north end
  for (const dz of s.bays.slice(1, -1)) {
    g.add(B(m.walnut, back, front, 0, L.height, dz - 0.011, dz + 0.011, { cast: true }));
  }
  for (const y of s.levels) {
    g.add(B(m.walnut, back + 0.01, front, y, y + boardT, s.z0 + 0.02, s.z1 - 0.02));
  }
  g.add(B(m.walnut, back + 0.01, front, 2.62, 2.646, s.z0 + 0.02, s.z1 - 0.02));
  // plinth + cornice so it reads as built-in joinery
  g.add(B(m.walnut, front - 0.06, front + 0.012, 0, 0.06, s.z0, s.z1, { cast: true }));
  g.add(B(m.walnut, front - 0.05, front + 0.02, 2.646, L.height, s.z0, s.z1, { cast: true }));
  // dust board / shadow line at the very front of each shelf
  for (const y of s.levels) {
    g.add(B(m.walnut, front - 0.012, front + 0.003, y - 0.02, y, s.z0 + 0.02, s.z1 - 0.02));
  }

  // ---- books: one instanced mesh for every cover in the room --------------
  const rng = stream('books');
  const items = [];
  const bayEdges = s.bays;
  const shelfTops = s.levels.map((y) => y + boardT);
  const nextLevel = [...s.levels.slice(1), 2.62];

  const pad = 0.012; // keep every volume inside the carcass
  for (let b = 0; b < bayEdges.length - 1; b++) {
    const bz0 = bayEdges[b] + (b === 0 ? 0.025 : 0.014);
    const bz1 = bayEdges[b + 1] - (b === bayEdges.length - 2 ? 0.025 : 0.014);
    for (let li = 0; li < shelfTops.length; li++) {
      const baseY = shelfTops[li];
      const clear = nextLevel[li] - 0.006 - baseY;
      // a shelf holds books, and sometimes an object as well
      const objSlot = rng.chance(0.34) ? rng.range(bz0 + 0.12, Math.max(bz0 + 0.13, bz1 - 0.26)) : null;
      let z = bz0;
      while (z < bz1 - 0.03) {
        if (objSlot !== null && z > objSlot && z < objSlot + 0.22) {
          z = objSlot + 0.24;
          continue;
        }
        const roll = rng.next();
        if (roll < 0.07) {
          z += rng.range(0.03, 0.1); // a deliberate gap
          continue;
        }
        if (roll < 0.16) {
          // a small horizontal stack, clamped to the bay
          const sz = rng.range(0.17, 0.22);
          const depth = rng.range(0.15, 0.21);
          const cxm = Math.min(z + sz / 2, bz1 - pad - sz / 2);
          if (cxm - sz / 2 < z - 0.01) break; // no room left in this bay
          const n = rng.int(2, 4);
          let hh = 0;
          for (let k = 0; k < n; k++) {
            const th = rng.range(0.02, 0.036);
            if (hh + th > clear - 0.02) break;
            items.push({
              x: front - 0.02 - depth / 2 - rng.range(0, 0.04),
              y: baseY + hh + th / 2,
              z: cxm + rng.range(-0.01, 0.01),
              sx: depth,
              sy: th,
              sz,
              rot: rng.range(-0.05, 0.05),
              lean: 0,
              color: rng.pick(m.bookPalette).color,
            });
            hh += th;
          }
          z = cxm + sz / 2 + 0.01;
          continue;
        }
        const w = rng.range(0.022, 0.052);
        const h = Math.min(clear - 0.005, rng.range(0.17, 0.3));
        const d = rng.range(0.14, 0.23);
        const lean = rng.chance(0.07) ? rng.range(0.06, 0.16) * rng.sign() : 0;
        const half = w / 2 + (h / 2) * Math.sin(Math.abs(lean)) + 0.002;
        const zc = z + half;
        if (zc + half > bz1 - pad) break;
        items.push({
          x: front - 0.005 - d / 2,
          y: baseY + h / 2 - 0.002,
          z: zc,
          sx: d,
          sy: h,
          sz: w,
          rot: 0,
          lean,
          color: rng.pick(m.bookPalette).color,
        });
        z = zc + half;
      }
      if (objSlot !== null) shelfProps(m, g, rng, Math.min(objSlot + 0.1, bz1 - 0.12), baseY, clear);
    }
  }

  const geo = new THREE.BoxGeometry(1, 1, 1);
  const coverMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.76, metalness: 0.02, envMapIntensity: 0.5 });
  const inst = new THREE.InstancedMesh(geo, coverMat, items.length);
  inst.castShadow = true;
  inst.receiveShadow = true;
  const mm = new THREE.Matrix4();
  const qq = new THREE.Quaternion();
  const ee = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  items.forEach((it, i) => {
    ee.set(it.lean, it.rot, 0);
    qq.setFromEuler(ee);
    pos.set(it.x, it.y, it.z);
    scl.set(it.sx, it.sy, it.sz);
    mm.compose(pos, qq, scl);
    inst.setMatrixAt(i, mm);
    inst.setColorAt(i, it.color);
  });
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  g.add(inst);

  return g;
}

function shelfProps(m, g, rng, z, y, clear) {
  const front = L.shelf.x1;
  const x = front - 0.13;
  const kind = rng.int(0, 5);
  if (kind === 0) {
    // little pot plant
    g.add(cyl(m.pot, 0.05, 0.038, 0.08, x, y + 0.04, z, { seg: 12 }));
    for (let i = 0; i < 7; i++) {
      const s = rbox(m.leaf, 0.02, 0.09, 0.05, x, y + 0.12, z, 0.02, 2, { cast: false });
      s.rotation.set(rng.range(-0.6, 0.6), rng.next() * 6.28, rng.range(-0.6, 0.6));
      s.position.x += rng.range(-0.04, 0.04);
      s.position.z += rng.range(-0.05, 0.05);
      g.add(s);
    }
  } else if (kind === 1) {
    g.add(cyl(m.brass, 0.05, 0.07, 0.14, x, y + 0.07, z, { seg: 14 }));
  } else if (kind === 2) {
    // framed photograph, leaning
    const f = new THREE.Group();
    f.add(B(m.brassDark, -0.005, 0.005, 0, 0.16, -0.06, 0.06));
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.12), m.paper);
    art.position.set(0.006, 0.08, 0);
    art.rotation.y = Math.PI / 2;
    f.add(art);
    f.position.set(front - 0.1, y, z);
    f.rotation.x = rng.range(-0.16, 0.16);
    g.add(f);
  } else if (kind === 3) {
    // candlestick
    g.add(cyl(m.brass, 0.04, 0.05, 0.015, x, y + 0.008, z, { seg: 12 }));
    g.add(cyl(m.brass, 0.012, 0.016, 0.1, x, y + 0.06, z, { seg: 10 }));
    g.add(cyl(m.wax, 0.018, 0.02, 0.09, x, y + 0.15, z, { seg: 10 }));
  } else if (kind === 4) {
    // a globe-ish brass sphere on a stand
    g.add(cyl(m.brassDark, 0.045, 0.05, 0.02, x, y + 0.01, z, { seg: 12 }));
    g.add(sphere(m.brass, 0.06, x, y + 0.085, z, { seg: 14 }));
  } else {
    // a couple of rolled maps
    for (let i = 0; i < 3; i++) {
      const r = cyl(m.paper, 0.022, 0.022, 0.2, x + 0.02, y + 0.024 + i * 0.042, z, { seg: 10 });
      r.rotation.z = Math.PI / 2;
      r.rotation.y = 0.1;
      g.add(r);
    }
  }
}

function buildLadder(m) {
  const lad = L.ladder;
  const g = new THREE.Group();
  g.name = 'library-ladder';
  const topX = L.shelf.x1;
  const dx = topX - lad.footX;
  const len = Math.hypot(dx, lad.topY);
  const ang = Math.atan2(-dx, lad.topY);
  g.position.set((topX + lad.footX) / 2, lad.topY / 2, lad.z);
  g.rotation.z = ang;
  for (const dz of [-lad.railGap / 2, lad.railGap / 2]) {
    g.add(cyl(m.oak, 0.02, 0.022, len, 0, 0, dz, { seg: 10 }));
  }
  for (let i = 0; i < 6; i++) {
    const y = -len / 2 + 0.18 + i * 0.38;
    if (y > len / 2 - 0.1) break;
    g.add(rod(m.oak, 'z', lad.railGap, 0.013, 0, y, 0, { seg: 8 }));
  }
  // hook over the top rail
  g.add(rod(m.brassDark, 'z', lad.railGap + 0.06, 0.01, 0.02, len / 2 - 0.02, 0, { seg: 8 }));
  return g;
}

// ---------------------------------------------------------------------------
// floor lamp, west of the armchair
// ---------------------------------------------------------------------------
function buildFloorLamp(m) {
  const p = L.lamp;
  const g = new THREE.Group();
  g.name = 'floor-lamp';
  g.position.set(p.x, 0, p.z);
  g.add(cyl(m.brassDark, 0.15, 0.16, 0.022, 0, 0.011, 0, { seg: 22 }));
  g.add(cyl(m.brass, 0.03, 0.05, 0.06, 0, 0.04, 0, { seg: 14 }));
  g.add(cyl(m.brass, 0.011, 0.014, p.shadeY - 0.06, 0, (p.shadeY - 0.06) / 2 + 0.06, 0, { seg: 10 }));

  const shadeMat = m.linen.clone();
  shadeMat.side = THREE.DoubleSide;
  shadeMat.emissive = new THREE.Color(0xffca87);
  shadeMat.emissiveIntensity = 0.85;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.19, 0.25, 24, 1, true), shadeMat);
  shade.position.y = p.shadeY;
  shade.castShadow = false;
  g.add(shade);
  const shadeTop = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.125, 20), m.brassDark);
  shadeTop.rotation.x = -Math.PI / 2;
  shadeTop.position.y = p.shadeY + 0.125;
  g.add(shadeTop);
  const bulb = sphere(new THREE.MeshStandardMaterial({ color: 0xffe9c4, emissive: 0xffc879, emissiveIntensity: 3.2, roughness: 1 }), 0.032, 0, p.shadeY - 0.03, 0, {
    seg: 12,
    cast: false,
  });
  g.add(bulb);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffca8a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.28 })
  );
  glow.position.y = p.shadeY - 0.02;
  glow.scale.set(0.6, 0.6, 1);
  g.add(glow);

  const light = new THREE.PointLight(0xffcd91, 11, 5.5, 2);
  light.position.set(0, p.shadeY - 0.05, 0);
  g.add(light);

  return { group: g, light, glow, anim: [glow] };
}

// ---------------------------------------------------------------------------
// odds and ends
// ---------------------------------------------------------------------------
function buildSideTable(m) {
  const s = L.sideTable;
  const g = new THREE.Group();
  g.name = 'side-table';
  g.position.set(s.cx, 0, s.cz);
  g.add(rbox(m.walnut, s.half * 2, 0.035, s.half * 2, 0, s.topY - 0.017, 0, 0.01, 2));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(cyl(m.walnut, 0.015, 0.021, s.topY - 0.035, sx * (s.half - 0.04), (s.topY - 0.035) / 2, sz * (s.half - 0.04), { seg: 8 }));
    }
  }
  g.add(B(m.walnut, -s.half + 0.05, s.half - 0.05, 0.12, 0.14, -s.half + 0.05, s.half - 0.05));
  // hurricane lamp
  const lamp = new THREE.Group();
  lamp.position.y = s.topY;
  lamp.add(cyl(m.brass, 0.055, 0.065, 0.03, 0, 0.015, 0, { seg: 14 }));
  const glassMat = m.glass.clone();
  glassMat.opacity = 0.12;
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 14, 1, true), glassMat);
  chim.position.y = 0.1;
  lamp.add(chim);
  lamp.add(cyl(m.wax, 0.02, 0.022, 0.05, 0, 0.055, 0, { seg: 10 }));
  const fl = flameSprite(0.045, 0.1, 0xffc46a);
  fl.position.y = 0.115;
  lamp.add(fl);
  lamp.add(cyl(m.brass, 0.02, 0.05, 0.03, 0, 0.185, 0, { seg: 12 }));
  g.add(lamp);
  const light = new THREE.PointLight(0xffb46a, 1.15, 2.4, 2);
  light.position.set(s.cx, s.topY + 0.12, s.cz);
  return { group: g, light, anim: [fl] };
}

function buildPlant(m) {
  const p = L.plant;
  const rng = stream('plant');
  const g = new THREE.Group();
  g.name = 'plant';
  g.position.set(p.x, 0, p.z);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(p.potR, p.potR * 0.72, 0.32, 20, 1, false), m.pot);
  pot.position.y = 0.16;
  pot.castShadow = true;
  pot.receiveShadow = true;
  g.add(pot);
  g.add(cyl(m.pot, p.potR * 1.04, p.potR, 0.035, 0, 0.32, 0, { seg: 20 }));
  g.add(cyl(m.soil, p.potR * 0.92, p.potR * 0.92, 0.02, 0, 0.325, 0, { seg: 16 }));

  // stems with instanced leaves
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(0.055, 0.06, 0.05, 0.16, 0, 0.22);
  leafShape.bezierCurveTo(-0.05, 0.16, -0.055, 0.06, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 8);
  {
    const pos = leafGeo.attributes.position;
    const arr = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      arr[i * 3] = x;
      arr[i * 3 + 1] = y;
      arr[i * 3 + 2] = -x * x * 4.5 - y * y * 0.9; // cup the leaf
    }
    leafGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    leafGeo.computeVertexNormals();
  }
  const NLEAF = 26;
  const leaves = new THREE.InstancedMesh(leafGeo, m.leaf, NLEAF);
  leaves.castShadow = true;
  const mm = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  let n = 0;
  const stems = 6;
  for (let si = 0; si < stems; si++) {
    const a = (si / stems) * Math.PI * 2 + rng.next() * 0.6;
    const lean = rng.range(0.16, 0.42);
    const len = rng.range(0.55, 0.95);
    const stem = new THREE.Mesh(stemGeometry(len, 0.011, 0.005, lean * 0.5, 8), m.leaf);
    stem.position.set(Math.cos(a) * 0.05, 0.33 + len / 2, Math.sin(a) * 0.05);
    stem.rotation.set(Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    stem.castShadow = true;
    g.add(stem);
    const per = Math.floor(NLEAF / stems);
    for (let li = 0; li < per && n < NLEAF; li++, n++) {
      const t = 0.35 + (li / per) * 0.75;
      const px = Math.cos(a) * 0.05 + Math.sin(a) * lean * len * t * 0.5;
      const pz = Math.sin(a) * 0.05 - Math.cos(a) * lean * len * t * 0.5;
      const py = 0.33 + len * t;
      e.set(rng.range(-1.4, 0.4), rng.next() * Math.PI * 2, rng.range(-0.5, 0.5));
      q.setFromEuler(e);
      v.set(px, py, pz);
      const s0 = rng.range(0.75, 1.35);
      sc.set(s0, s0, s0);
      mm.compose(v, q, sc);
      leaves.setMatrixAt(n, mm);
    }
  }
  leaves.count = n;
  leaves.instanceMatrix.needsUpdate = true;
  g.add(leaves);
  return g;
}

function buildLogBasket(m) {
  const b = L.logBasket;
  const rng = stream('logs');
  const g = new THREE.Group();
  g.name = 'log-basket';
  g.position.set(b.x, 0, b.z);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(b.r, b.r * 0.86, 0.3, 18, 3, true), m.basket);
  wall.position.y = 0.15;
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);
  g.add(cyl(m.basket, b.r * 0.86, b.r * 0.86, 0.01, 0, 0.01, 0, { seg: 18 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(b.r, 0.012, 6, 20), m.basket);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.3;
  g.add(rim);
  for (let i = 0; i < 6; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = rng.range(0, b.r * 0.55);
    const len = rng.range(0.24, 0.34);
    const lg = cyl(m.firewood, 0.032, 0.036, len, Math.cos(a) * r, 0.3 + rng.range(-0.02, 0.06), Math.sin(a) * r, { seg: 8 });
    lg.rotation.set(Math.PI / 2 + rng.range(-0.25, 0.25), rng.next() * 3, rng.range(-0.3, 0.3));
    g.add(lg);
  }
  return g;
}

function buildFloorBooks(m) {
  const f = L.floorBooks;
  const g = new THREE.Group();
  g.name = 'floor-books';
  g.add(bookStack(m, f.x, 0, f.z, 4, 1.25));
  const lean = box(m.bookPalette[3], 0.16, 0.24, 0.035, f.x + 0.16, 0.12, f.z + 0.06, { cast: true });
  lean.rotation.set(0, 0.2, -0.12);
  g.add(lean);
  return g;
}

function buildMantelDecor(m) {
  const f = L.fire;
  const g = new THREE.Group();
  const anim = [];
  g.name = 'mantel-decor';
  const top = f.mantelY + 0.09;
  const cx = (f.mantelProjX + L.east) / 2;
  // pair of candles
  for (const z of [-1.05, 1.05]) {
    g.add(cyl(m.brass, 0.05, 0.058, 0.014, cx, top + 0.007, z, { seg: 14 }));
    g.add(cyl(m.brass, 0.014, 0.02, 0.14, cx, top + 0.078, z, { seg: 10 }));
    g.add(cyl(m.wax, 0.021, 0.023, 0.17, cx, top + 0.23, z, { seg: 10 }));
    const fl = flameSprite(0.05, 0.115, 0xffc46a);
    fl.position.set(cx, top + 0.35, z);
    g.add(fl);
    anim.push(fl);
  }
  // bracket clock
  const clock = new THREE.Group();
  clock.position.set(cx - 0.01, top, 0);
  clock.add(rbox(m.walnut, 0.16, 0.3, 0.1, 0, 0.15, 0, 0.015, 2));
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.056, 24), m.paintCream);
  face.position.set(-0.081, 0.2, 0);
  face.rotation.y = -Math.PI / 2;
  clock.add(face);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.006, 6, 24), m.brass);
  ring.position.set(-0.082, 0.2, 0);
  ring.rotation.y = Math.PI / 2;
  clock.add(ring);
  for (const [len, ang] of [
    [0.035, 0.9],
    [0.048, -2.1],
  ]) {
    const hand = box(m.paintDark, 0.004, 0.006, len, -0.085, 0.2, 0);
    hand.position.set(-0.086, 0.2, 0);
    hand.geometry.translate(0, 0, len / 2 - 0.006);
    hand.rotation.y = 0;
    hand.rotation.x = ang;
    clock.add(hand);
  }
  clock.add(cyl(m.brass, 0.02, 0.02, 0.02, -0.03, 0.32, 0, { seg: 10 }));
  g.add(clock);
  // flat books and a vase with dried stems
  g.add(bookStack(m, cx + 0.01, top, -0.55, 3, 1.05));
  const vase = new THREE.Mesh(latheVase(), m.ceramicBlue);
  vase.position.set(cx, top + 0.002, 0.58);
  vase.castShadow = true;
  vase.receiveShadow = true;
  g.add(vase);
  const rng = stream('stems');
  for (let i = 0; i < 7; i++) {
    const a = rng.next() * Math.PI * 2;
    const lean = rng.range(0.05, 0.3);
    const st = new THREE.Mesh(stemGeometry(rng.range(0.24, 0.4), 0.004, 0.002, lean, 5), m.leaf);
    st.position.set(cx + Math.cos(a) * 0.012, top + 0.19, 0.58 + Math.sin(a) * 0.012);
    st.rotation.set(Math.sin(a) * lean * 2, 0, -Math.cos(a) * lean * 2);
    g.add(st);
  }
  // picture light: a brass bar on arms, standing off the chimney breast, which
  // is where the warm wash in the light rig comes from
  const ly = f.mantelY + 0.97;
  const lx = f.breastX - 0.3;
  g.add(box(m.brassDark, 0.028, 0.075, 0.13, f.breastX - 0.014, ly + 0.03, 0, { cast: true }));
  for (const sz of [-0.24, 0.24]) {
    g.add(rod(m.brassDark, 'x', 0.3, 0.009, f.breastX - 0.17, ly, sz, { seg: 8 }));
  }
  g.add(rod(m.brassDark, 'z', 0.56, 0.011, lx, ly, 0, { seg: 8 }));
  const aim = new THREE.Vector3(0.78, -0.6, 0).normalize();
  for (const sz of [-0.2, 0.2]) {
    const shade = cyl(m.brass, 0.033, 0.047, 0.075, lx - 0.012, ly - 0.02, sz, { seg: 12, cast: true });
    shade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), aim);
    g.add(shade);
  }
  return { group: g, anim };
}

function latheVase() {
  const pts = [];
  const profile = [
    [0.0, 0.0],
    [0.055, 0.0],
    [0.062, 0.02],
    [0.05, 0.09],
    [0.038, 0.15],
    [0.036, 0.19],
    [0.045, 0.21],
    [0.042, 0.222],
    [0.03, 0.215],
  ];
  for (const [x, y] of profile) pts.push(new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 20);
}

// ---------------------------------------------------------------------------
// pendant light over the seating group (fixture only; the lamp itself is in
// lights.js so the light rig lives in one place)
// ---------------------------------------------------------------------------
function buildPendant(m) {
  const p = L.pendant;
  const g = new THREE.Group();
  g.name = 'pendant';
  g.position.set(p.x, 0, p.z);
  g.add(cyl(m.paintDark, 0.05, 0.055, 0.03, 0, L.height - 0.015, 0, { seg: 14 }));
  g.add(cyl(m.paintDark, 0.004, 0.004, L.height - p.y - 0.06, 0, (L.height + p.y) / 2 + 0.02, 0, { seg: 6 }));
  const outer = new THREE.Mesh(new THREE.SphereGeometry(p.r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), m.paintDark);
  outer.position.y = p.y;
  outer.castShadow = false;
  g.add(outer);
  const inner = new THREE.Mesh(
    new THREE.SphereGeometry(p.r * 0.965, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xd8a94f, roughness: 0.35, metalness: 0.85, side: THREE.BackSide, envMapIntensity: 1 })
  );
  inner.position.y = p.y;
  g.add(inner);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffcf92, emissiveIntensity: 3.2, roughness: 1 });
  const bulb = sphere(bulbMat, 0.042, 0, p.y - 0.05, 0, { seg: 14, cast: false });
  g.add(bulb);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: dotTexture(), color: 0xffd79a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.22 })
  );
  glow.position.y = p.y - 0.05;
  glow.scale.set(0.8, 0.8, 1);
  g.add(glow);
  return { group: g, glow };
}

// ---------------------------------------------------------------------------
export function buildFurniture(m) {
  const out = {};
  const root = new THREE.Group();
  root.name = 'furniture';

  out.rug = buildRug(m);
  out.sofa = buildSofa(m);
  out.armchair = buildArmchair(m);
  const table = buildTable(m);
  out.table = table.group;
  out.shelf = buildShelf(m);
  out.ladder = buildLadder(m);
  const lamp = buildFloorLamp(m);
  out.lamp = lamp.group;
  out.lampLight = lamp.light;
  const side = buildSideTable(m);
  out.sideTable = side.group;
  out.sideLight = side.light;
  out.plant = buildPlant(m);
  out.logs = buildLogBasket(m);
  out.floorBooks = buildFloorBooks(m);
  const mantel = buildMantelDecor(m);
  out.mantel = mantel.group;
  const pendant = buildPendant(m);
  out.pendant = pendant.group;
  out.pendantGlow = pendant.glow;

  for (const v of Object.values(out)) {
    if (v && v.isObject3D) root.add(v);
  }
  const anim = [...table.anim, side.anim[0], lamp.glow, ...mantel.anim].filter(Boolean);
  return { root, anim, pendant: out.pendant, lampLight: out.lampLight, lights: [lamp.light, side.light] };
}
