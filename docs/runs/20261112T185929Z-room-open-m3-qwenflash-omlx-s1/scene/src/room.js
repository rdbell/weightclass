// ---------------------------------------------------------------------------
// The shell.  Everything here is measured against layout.js: the interior faces
// of the four walls are the box x[3,3] z[2.25,2.25], the wall bodies sit
// outside it, and the openings are actual holes cut with jambs, heads, sill and
// a reveal deep enough to look like real construction.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { L, D } from './layout.js';
import { stream } from './rng.js';
import { boxFromBounds as B, box, rbox, cyl, rod, sphere, curtainGeometry } from './geo.js';

const H = L.height;
const T = L.wallT;
const WX = L.west;
const EX = L.east;
const NZ = L.north;
const SZ = L.south;
const F = L.fire;

function add(parent, ...meshes) {
  for (const mesh of meshes) parent.add(mesh);
  return meshes.length === 1 ? meshes[0] : parent;
}

/** Adds a solid between two corner points. Shorthand keeps the code readable. */
function solid(parent, mat, x0, x1, y0, y1, z0, z1, opts = {}) {
  return add(parent, B(mat, x0, x1, y0, y1, z0, z1, opts));
}

// ---------------------------------------------------------------------------
// Wall solving.  Given a wall slab and its openings, return the solid pieces
// that remain.  Each opening splits the wall in the horizontal axis first, then
// the leftover height spans are emitted, so nothing is ever generated with an
// inverted span.
// ---------------------------------------------------------------------------
function wallPieces(axis, u0, u1, openings) {
  const cuts = new Set([u0, u1]);
  for (const o of openings) {
    if (o.u0 > u0 && o.u0 < u1) cuts.add(o.u0);
    if (o.u1 > u0 && o.u1 < u1) cuts.add(o.u1);
  }
  const marks = [...cuts].sort((a, b) => a - b);
  const pieces = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i];
    const b = marks[i + 1];
    if (b - a < 1e-6) continue;
    const mid = (a + b) / 2;
    // heights that are holes in this strip of wall, clamped and ordered
    const holes = openings
      .filter((o) => mid > o.u0 && mid < o.u1)
      .map((o) => [Math.max(0, o.y0), Math.min(H, o.y1)])
      .filter(([p, q]) => q > p)
      .sort((p, q) => p[0] - q[0]);
    let cur = 0;
    for (const [y0, y1] of holes) {
      if (y0 > cur) pieces.push({ u0: a, u1: b, y0: cur, y1: y0, axis });
      cur = Math.max(cur, y1);
    }
    if (cur < H) pieces.push({ u0: a, u1: b, y0: cur, y1: H, axis });
  }
  return pieces;
}

// ---------------------------------------------------------------------------
// Floor, ceiling, joinery
// ---------------------------------------------------------------------------
// three variants of the floor boards so the grain does not repeat down the room
function floorVariants(m) {
  const list = [m.floor];
  for (const k of [1, 2]) {
    const c = m.floor.clone();
    for (const key of ['map', 'roughnessMap', 'bumpMap']) {
      if (c[key]) {
        const t = c[key].clone();
        t.offset.set(k * 0.37, k * 0.21);
        t.needsUpdate = true;
        c[key] = t;
      }
    }
    list.push(c);
  }
  return list;
}

function floorBoards(m) {
  const g = new THREE.Group();
  g.name = 'floor';
  const boards = floorVariants(m);
  const bw = 0.135;
  let z = NZ;
  let i = 0;
  while (z < SZ - 0.02) {
    const z1 = Math.min(SZ, z + bw);
    solid(g, boards[i % boards.length], WX, EX, 0, 0.018, z, z1 - 0.005, { receive: true });
    z = z1 + 0.005;
    i++;
  }
  // structural slab below, so no light leaks through the board gaps
  solid(g, m.floorDark, WX - T, EX + T, -0.14, 0, NZ - T, SZ + T);
  return g;
}

function ceiling(m) {
  const g = new THREE.Group();
  g.name = 'ceiling';
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(EX - WX, SZ - NZ), m.plaster(EX - WX, SZ - NZ, { ceiling: true }));
  plate.rotation.x = Math.PI / 2;
  plate.position.y = H;
  plate.receiveShadow = true;
  g.add(plate);
  for (const bz of L.beamZ) {
    solid(g, m.beam, WX, EX, H - 0.205, H - 0.005, bz - 0.085, bz + 0.085, { cast: true });
  }
  for (const jx of [WX + 1.0, -0.25, 1.55, EX - 0.95]) {
    solid(g, m.beam, jx - 0.05, jx + 0.05, H - 0.135, H - 0.008, NZ, SZ, { cast: true });
  }
  return g;
}

function corniceAndSkirting(m) {
  const g = new THREE.Group();
  g.name = 'joinery';
  const sk = 0.115;
  const cT = 0.075;
  // skirting on the interior faces, notched at the door
  solid(g, m.paintCream, WX, EX, 0, sk, NZ, NZ + 0.022);
  solid(g, m.paintCream, SZ - 0.022, SZ, 0, sk, WX, L.door.x0);
  solid(g, m.paintCream, SZ - 0.022, SZ, 0, sk, L.door.x1, EX);
  solid(g, m.paintCream, WX, WX + 0.022, 0, sk, NZ, SZ);
  for (const x of [EX - 0.022]) {
    solid(g, m.paintCream, x, x + 0.022, 0, sk, NZ, -F.halfWidth);
    solid(g, m.paintCream, x, x + 0.022, 0, sk, F.halfWidth, SZ);
  }
  // cornice, returned on all four walls
  solid(g, m.paintCream, WX, EX, H - cT, H, NZ, NZ + 0.07);
  solid(g, m.paintCream, WX, EX, H - cT, H, SZ - 0.07, SZ);
  solid(g, m.paintCream, WX, WX + 0.07, H - cT, H, NZ, SZ);
  solid(g, m.paintCream, EX - 0.07, EX, H - cT, H, NZ, SZ);
  return g;
}

// ---------------------------------------------------------------------------
// Openings
// ---------------------------------------------------------------------------
function doorSet(m) {
  const g = new THREE.Group();
  g.name = 'door-set';
  const d = L.door;
  // reveal lining (jambs + head), casing on the room face, threshold plate
  solid(g, m.paintMid, d.x0 - 0.012, d.x0, 0, d.height, SZ, SZ + T);
  solid(g, m.paintMid, d.x1, d.x1 + 0.012, 0, d.height, SZ, SZ + T);
  solid(g, m.paintMid, d.x0, d.x1, d.height, d.height + 0.012, SZ, SZ + T);
  const cw = 0.062;
  const cd = 0.032;
  solid(g, m.paintCream, d.x0 - cw, d.x0, 0, d.height + cw, SZ - cd, SZ, { cast: true });
  solid(g, m.paintCream, d.x1, d.x1 + cw, 0, d.height + cw, SZ - cd, SZ, { cast: true });
  solid(g, m.paintCream, d.x0 - cw, d.x1 + cw, d.height, d.height + cw, SZ - cd, SZ, { cast: true });
  // same on the passage side, without the fancy casing
  solid(g, m.paintMid, d.x0 - 0.05, d.x0, 0, d.height + 0.05, SZ + T - 0.02, SZ + T);
  solid(g, m.paintMid, d.x1, d.x1 + 0.05, 0, d.height + 0.05, SZ + T - 0.02, SZ + T);
  solid(g, m.brassDark, d.x0, d.x1, -0.004, 0.02, SZ - 0.05, SZ + 0.05);
  return g;
}

function doorLeaf(m) {
  const rng = stream('doorleaf');
  const leaf = new THREE.Group();
  leaf.name = 'door-leaf';
  const w = L.door.x1 - L.door.x0;
  const h = L.door.height - 0.012;
  const t = L.door.leafT;
  // stiles and rails, local x runs from the hinge outwards
  solid(leaf, m.doorWood, 0.0, 0.115, 0, h, -t / 2, t / 2, { cast: true });
  solid(leaf, m.doorWood, w - 0.115, w, 0, h, -t / 2, t / 2, { cast: true });
  for (const [y0, y1] of [[0, 0.14], [0.88, 1.0], [1.62, 1.74], [1.9, h]]) {
    solid(leaf, m.doorWood, 0.115, w - 0.115, y0, y1, -t / 2, t / 2, { cast: true });
  }
  // fielded panels
  for (const [p0, p1] of [[0.14, 0.88], [1.0, 1.62]]) {
    for (const [a, b] of [[0.135, 0.53], [0.585, 0.98]]) {
      const px = a * w;
      const qx = b * w;
      rbox(m.doorWood, qx - px, p1 - p0 - 0.03, t * 0.7, (px + qx) / 2, (p0 + p1) / 2, 0, 0.02, 2, { cast: true, parent: leaf });
    }
  }
  // iron furniture
  for (const yy of [0.3, 1.05, 1.8]) {
    for (const s of [-1, 1]) {
      solid(leaf, m.iron, 0.0, 0.14, yy, yy + 0.1, s * (t / 2) - 0.006, s * (t / 2) + 0.006, { cast: true });
    }
  }
  solid(leaf, m.brassDark, w - 0.11, w - 0.05, 1.0, 1.18, -0.028, 0.028, { cast: true });
  const knob = sphere(m.brass, 0.03, w - 0.02, 1.09, 0, { seg: 16, parent: leaf });
  void knob;
  rod(m.brass, 'x', 0.1, 0.009, w - 0.07, 1.09, 0.06, { seg: 8, parent: leaf });
  leaf.position.set(L.door.hingeX, 0, SZ);
  leaf.rotation.y = D(L.door.openDeg);
  leaf.userData.jitter = rng.range(0, 6.283);
  return leaf;
}

function windowSet(m) {
  const g = new THREE.Group();
  g.name = 'window';
  const w = L.window;
  const zr0 = NZ - T;
  const zr1 = NZ;
  // reveal lining
  solid(g, m.paintMid, w.x0 - 0.012, w.x0, w.sill, w.head, zr0, zr1);
  solid(g, m.paintMid, w.x1, w.x1 + 0.012, w.sill, w.head, zr0, zr1);
  solid(g, m.paintMid, w.x0, w.x1, w.head, w.head + 0.012, zr0, zr1);
  // frame and two sashes
  const fz0 = NZ - T + 0.03;
  const fz1 = NZ - T + 0.09;
  const mid = (w.sill + w.head) / 2;
  solid(g, m.paintSash, w.x0, w.x1, w.sill, w.sill + 0.05, fz0, fz1, { cast: true });
  solid(g, m.paintSash, w.x0, w.x1, w.head - 0.05, w.head, fz0, fz1, { cast: true });
  solid(g, m.paintSash, w.x0, w.x0 + 0.05, w.sill, w.head, fz0, fz1, { cast: true });
  solid(g, m.paintSash, w.x1 - 0.05, w.x1, w.sill, w.head, fz0, fz1, { cast: true });
  solid(g, m.paintSash, -0.028, 0.028, w.sill, w.head, fz0, fz1, { cast: true });
  solid(g, m.paintSash, w.x0, w.x1, mid - 0.026, mid + 0.026, fz0, fz1, { cast: true });
  // glazing bars: three lights per leaf
  for (const yy of [(w.sill + mid) / 2, (mid + w.head) / 2]) {
    solid(g, m.paintSash, w.x0, w.x1, yy - 0.011, yy + 0.011, fz0 + 0.008, fz1 - 0.008, { cast: true });
  }
  for (const xx of [-0.267, 0.267]) {
    solid(g, m.paintSash, xx - 0.01, xx + 0.01, w.sill, w.head, fz0 + 0.008, fz1 - 0.008, { cast: true });
  }
  // glass
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(w.x1 - w.x0, w.head - w.sill), m.glass);
  glass.position.set(0, (w.sill + w.head) / 2, NZ - T + 0.055);
  g.add(glass);
  // architrave on the room face
  const aw = 0.07;
  solid(g, m.paintCream, w.x0 - aw, w.x0, w.sill - aw, w.head + aw, NZ + 0.004, NZ + 0.03, { cast: true });
  solid(g, m.paintCream, w.x1, w.x1 + aw, w.sill - aw, w.head + aw, NZ + 0.004, NZ + 0.03, { cast: true });
  solid(g, m.paintCream, w.x0 - aw, w.x1 + aw, w.head, w.head + aw, NZ + 0.004, NZ + 0.03, { cast: true });
  // stone sill, returned onto the jambs and nosing into the room
  solid(g, m.stone, w.x0 - aw - 0.04, w.x1 + aw + 0.04, w.sill - 0.055, w.sill, NZ - T, NZ + 0.12, { cast: true, receive: true });
  solid(g, m.paintCream, w.x0 - aw - 0.04, w.x1 + aw + 0.04, w.sill - 0.1, w.sill - 0.055, NZ - T, NZ + 0.04, { cast: true });
  // sash handles, one per leaf
  for (const s of [-1, 1]) {
    solid(g, m.brassDark, s * 0.02 - 0.012, s * 0.02 + 0.012, mid - 0.09, mid + 0.05, NZ - T + 0.1, NZ - T + 0.15, { cast: true });
  }
  return g;
}

function curtains(m) {
  const g = new THREE.Group();
  g.name = 'curtains';
  const z = NZ + 0.2;
  rod(m.brassDark, 'x', 2.62, 0.014, 0, 2.44, z, { seg: 10, parent: g });
  for (const s of [-1, 1]) {
    cyl(m.brassDark, 0.026, 0.026, 0.014, s * 1.28, 2.44, z, { seg: 10, parent: g });
    const geo = curtainGeometry(0.8, 2.3, { waves: 5.5, amp: 0.055, gather: 0.42, gatherAt: 0.62 });
    const panel = new THREE.Mesh(geo, m.linen);
    panel.position.set(s * 1.12, 1.28, z - 0.04);
    panel.rotation.y = s > 0 ? -0.05 : 0.05;
    panel.castShadow = true;
    g.add(panel);
    cyl(m.throwCloth, 0.026, 0.026, 0.86, s * 1.1, 0.86, z - 0.06, { seg: 8, cast: true, parent: g }).rotation.z = Math.PI / 2;
  }
  return g;
}

// ---------------------------------------------------------------------------
// Fireplace
// ---------------------------------------------------------------------------
function fireplace(m) {
  const g = new THREE.Group();
  g.name = 'fireplace';
  const o = F.opening;
  const fx = F.faceX;
  // stone band around the opening, hearth included
  solid(g, m.stone, fx, EX, 0, F.mantelY, -F.halfWidth, o.z0, { cast: true, receive: true });
  solid(g, m.stone, fx, EX, 0, F.mantelY, o.z1, F.halfWidth, { cast: true, receive: true });
  solid(g, m.stone, fx, EX, o.y1, F.mantelY, -F.halfWidth, o.z1, { cast: true });
  solid(g, m.stone, fx, EX, 0, o.y0, -F.halfWidth, o.z1, { cast: true, receive: true });
  // projecting hearth stone
  solid(g, m.stone, fx - 0.26, fx, 0, 0.05, -F.halfWidth - 0.12, F.halfWidth + 0.12, { cast: true, receive: true });
  // iron lip around the mouth
  for (const s of [-1, 1]) {
    const zIn = s < 0 ? o.z0 : o.z1;
    const zOut = s < 0 ? -F.halfWidth : F.halfWidth;
    solid(g, m.iron, fx - 0.012, fx + 0.02, 0.05, F.mantelY, Math.min(zIn, zOut), Math.max(zIn, zOut), { cast: true });
  }
  solid(g, m.iron, fx - 0.012, fx + 0.02, o.y1, o.y1 + 0.06, o.z0, o.z1, { cast: true });
  solid(g, m.iron, fx - 0.012, fx + 0.02, 0.045, 0.075, o.z0, o.z1, { cast: true });
  // fireback and sooty throat inside the cut-out
  solid(g, m.iron, F.cavityBackX - 0.05, F.cavityBackX, 0.075, 1.16, o.z0 + 0.04, o.z1 - 0.04, { receive: true });
  solid(g, m.soot, F.cavityBackX - 0.02, fx, 1.15, 1.62, o.z0, o.z1);
  // mantel shelf with a moulded edge
  solid(g, m.mantelWood, F.mantelProjX - 0.07, EX, F.mantelY, F.mantelY + 0.08, -F.mantelHalfZ, F.mantelHalfZ, { cast: true });
  solid(g, m.mantelWood, F.mantelProjX - 0.02, F.mantelProjX + 0.06, F.mantelY + 0.08, F.mantelY + 0.12, -F.mantelHalfZ, F.mantelHalfZ, { cast: true });
  // wood-paneled chimney breast above
  const b0 = F.mantelY + 0.12;
  solid(g, m.oak, F.breastX, EX, b0, H, -F.breastHalfZ, F.breastHalfZ, { cast: true, receive: true });
  for (const yy of [b0 + 0.02, 1.9, 2.56]) {
    solid(g, m.walnut, F.breastX - 0.014, F.breastX, yy - 0.028, yy, -F.breastHalfZ + 0.05, F.breastHalfZ - 0.05);
  }
  for (const zz of [-0.45, 0.45]) {
    solid(g, m.walnut, F.breastX - 0.014, F.breastX, b0 + 0.02, 2.56, zz - 0.014, zz + 0.014);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Passage behind the door, with a glimpse of the hall beyond
// ---------------------------------------------------------------------------
function passage(m) {
  const g = new THREE.Group();
  g.name = 'passage';
  const wall = m.plaster(3, 2.4, { tint: 0xb9b2a6 });
  const z0 = SZ + T;
  solid(g, m.floorDark, WX - T, EX + T, -0.14, 0.005, z0, z0 + 3.2);
  const runner = box(m.runner, 1.4, 0.012, 2.9, L.door.x0 + 0.45, 0.011, SZ + 1.6, { receive: true, cast: false });
  g.add(runner);
  // passage walls and a ceiling
  solid(g, wall, -2.95, -2.85, 0, 2.35, z0 - 0.02, z0 + 3.2);
  solid(g, wall, -0.75, -0.65, 0, 2.35, z0 - 0.02, z0 + 3.2);
  solid(g, wall, -2.95, -0.65, 2.35, 2.46, z0 + 2.5, z0 + 3.2);
  // far doorway, lit from the room beyond (solid, so it reads from any angle)
  solid(g, new THREE.MeshBasicMaterial({ color: 0x4c341f }), -2.9, -0.7, 0.0, 2.34, z0 + 2.44, z0 + 2.48);
  solid(g, new THREE.MeshBasicMaterial({ color: 0x7c5734 }), -2.5, -1.1, 0.0, 1.5, z0 + 2.4, z0 + 2.44);
  // hall furniture just out of the room
  solid(g, m.walnut, -2.4, -1.2, 0.62, 0.665, SZ + 2.0, SZ + 2.5, { cast: true });
  for (const px of [-2.34, -1.26]) {
    for (const pz of [SZ + 2.06, SZ + 2.44]) {
      solid(g, m.walnut, px - 0.03, px + 0.03, 0, 0.62, pz - 0.03, pz + 0.03, { cast: true });
    }
  }
  const bowl = sphere(m.brass, 0.09, -1.8, 0.7, SZ + 2.25, { seg: 14 });
  bowl.scale.y = 0.5;
  g.add(bowl);
  cyl(m.ceramicBlue, 0.05, 0.075, 0.22, -2.1, 0.78, SZ + 2.3, { seg: 12, cast: true, parent: g });
  cyl(m.walnut, 0.026, 0.04, 1.72, -0.9, 0.86, SZ + 1.05, { seg: 10, cast: true, parent: g });
  const coat = box(m.sofaCloth, 0.36, 0.9, 0.18, -0.9, 1.36, SZ + 1.12, { cast: true });
  coat.rotation.z = 0.05;
  g.add(coat);
  cyl(m.iron, 0.12, 0.14, 0.36, -0.74, 0.18, SZ + 1.25, { seg: 14, cast: true, parent: g });
  cyl(m.paintDark, 0.02, 0.03, 0.92, -0.72, 0.6, SZ + 1.25, { seg: 8, cast: true, parent: g }).rotation.z = 0.18;
  // a few stair treads climbing away to the west
  for (let i = 0; i < 5; i++) {
    solid(g, m.paintCream, -2.9, -1.95, i * 0.2, i * 0.2 + 0.05, SZ + 2.6 + i * 0.24, SZ + 2.84 + i * 0.24, { cast: true });
  }
  return g;
}

// ---------------------------------------------------------------------------
// Clouds drifting past the moon, seen through the window
// ---------------------------------------------------------------------------
function clouds(m) {
  const g = new THREE.Group();
  g.name = 'clouds';
  const rng = stream('clouds');
  const mat = new THREE.MeshBasicMaterial({
    map: m.dot,
    color: 0x2a3547,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const quads = [];
  for (let i = 0; i < 5; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    p.scale.set(rng.range(1.6, 3.2), rng.range(0.5, 0.95), 1);
    p.position.set(rng.range(-4, 4), rng.range(1.15, 2.9), NZ - 1.4 - i * 0.45);
    p.userData = { x0: p.position.x, y: p.position.y, v: rng.range(0.22, 0.5), ph: rng.range(0, 6.28) };
    g.add(p);
    quads.push(p);
  }
  return {
    group: g,
    update(t) {
      for (const p of quads) {
        const u = p.userData;
        const span = 11;
        let x = u.x0 + u.v * t;
        x = ((((x + 5.5) % span) + span) % span) - 5.5; // wrap across the sky
        p.position.x = x;
        p.position.y = u.y + 0.06 * Math.sin(t * 0.21 + u.ph);
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Dust motes in the firelight
// ---------------------------------------------------------------------------
function makeDust(m) {
  const rng = stream('dust');
  const N = 620;
  const pos = new Float32Array(N * 3);
  const phase = new Float32Array(N);
  const speed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = rng.range(WX + 0.3, EX - 0.2);
    pos[i * 3 + 1] = rng.range(0.15, 0.45);
    pos[i * 3 + 2] = rng.range(NZ + 0.3, SZ - 0.3);
    phase[i] = rng.next() * 6.283;
    speed[i] = rng.range(0.05, 0.16);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  const points = new THREE.Points(geo, m.dust);
  points.frustumCulled = false;
  return { points, update: (t) => (m.dust.uniforms.uTime.value = t) };
}

// ---------------------------------------------------------------------------
// Plan drawing, only shown by the overhead view
// ---------------------------------------------------------------------------
function planSheet(m) {
  const g = new THREE.Group();
  g.name = 'plan-sheet';
  const outer = { x: 4.05, z: 2.98 };
  const inner = { x: EX + T, z: SZ + T };
  solid(g, m.paper, -outer.x, outer.x, -0.02, 0.0, -outer.z, -inner.z);
  solid(g, m.paper, -outer.x, outer.x, -0.02, 0.0, inner.z, outer.z);
  solid(g, m.paper, -outer.x, -inner.x, -0.02, 0.0, -inner.z, inner.z);
  solid(g, m.paper, inner.x, outer.x, -0.02, 0.0, -inner.z, inner.z);
  return g;
}

function planText(text, { px = 96, color = '#2b241c' } = {}) {
  const h = 128;
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = `${px}px Georgia, "Times New Roman", serif`;
  const lines = String(text).split('\n');
  const w = Math.ceil(Math.max(64, ...lines.map((l) => probe.measureText(l).width))) + 20;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = color;
  ctx.font = `${px}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, h / 2 + (i - (lines.length - 1) / 2) * px * 1.18);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // how much of the plate height the capitals actually fill
  return { tex, aspect: w / h, fill: (px * 0.72) / h };
}

function planAnnotations(m) {
  const g = new THREE.Group();
  g.name = 'plan-annotations';
  const quad = new THREE.PlaneGeometry(1, 1);
  const y = 0.9;
  // capH is the letter height in metres, so the drawing stays legible when zoomed
  const put = (text, x, z, ry, capH, opts) => {
    const { tex, aspect, fill } = planText(text, opts);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(quad, mat);
    const h2 = capH / fill;
    mesh.position.set(x, y + 0.02, z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = ry;
    mesh.scale.set(h2 * aspect, h2, 1);
    g.add(mesh);
  };
  const rule = (x0, z0, x1, z1) => solid(g, m.inkMat, Math.min(x0, x1) - 0.007, Math.max(x0, x1) + 0.007, y, y + 0.01, Math.min(z0, z1) - 0.007, Math.max(z0, z1) + 0.007);
  const wall = { px: 88, color: '#54473b' };
  const dim = { px: 92, color: '#2b241c' };
  const tiny = { px: 84, color: '#4b4038' };

  // the four walls, named outside the frame, north up
  put('WINDOW · NORTH WALL', 0, -2.66, 0, 0.13, wall);
  put('DOOR · SOUTH WALL', 0, 2.66, 0, 0.13, wall);
  put('FIREPLACE · EAST WALL', 3.52, 0, -Math.PI / 2, 0.13, wall);
  put('BOOKCASE · WEST WALL', -3.52, 0, Math.PI / 2, 0.13, wall);
  rule(-1.3, -2.45, 1.3, -2.45);
  rule(-0.5, 2.45, 0.5, 2.45);
  rule(3.2, -0.5, 3.2, 0.5);
  rule(-3.2, -1.1, -3.2, 1.1);

  // one dimension plus the title block
  rule(-3.8, -2.25, -3.8, 2.25);
  rule(-3.68, -2.25, -3.92, -2.25);
  rule(-3.68, 2.25, -3.92, 2.25);
  put('4.50 m', -3.62, 0, Math.PI / 2, 0.115, dim);
  put('COSY READING ROOM\n6.00 × 4.50 × 2.70 m · plan 1:50 · north up', 0.0, 1.78, 0, 0.1, tiny);

  // furniture
  put('sofa', 0.92, 0, -Math.PI / 2, 0.085, tiny);
  put('coffee table', 2.08, 0.86, 0, 0.085, tiny);
  put('armchair', 2.3, -1.0, 0, 0.085, tiny);
  put('ladder', -2.5, -1.95, 0, 0.085, tiny);
  put('rug', 1.58, -1.16, 0, 0.075, tiny);
  put('hearth', 2.66, -1.4, -Math.PI / 2, 0.075, tiny);
  put('floor lamp', 1.33, -2.02, 0, 0.075, tiny);
  put('pendant', 0.35, 0.44, 0, 0.075, tiny);
  return g;
}

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------
export function buildRoom(m) {
  const shell = new THREE.Group();
  shell.name = 'room';
  const ceilingGrp = ceiling(m);
  const exterior = new THREE.Group();
  exterior.name = 'exterior';

  shell.add(floorBoards(m));
  shell.add(ceilingGrp);
  shell.add(corniceAndSkirting(m));

  // ---- walls, with the openings cut out -----------------------------------
  const runs = [
    {
      // north: runs along x
      axis: 'x',
      u0: WX - T,
      u1: EX + T,
      slab: (p) => [p.u0, p.u1, p.y0, p.y1, NZ - T, NZ],
      openings: [{ u0: L.window.x0, u1: L.window.x1, y0: L.window.sill, y1: L.window.head }],
    },
    {
      // south: runs along x, door opening
      axis: 'x',
      u0: WX - T,
      u1: EX + T,
      slab: (p) => [p.u0, p.u1, p.y0, p.y1, SZ, SZ + T],
      openings: [{ u0: L.door.x0, u1: L.door.x1, y0: 0, y1: L.door.height }],
    },
    {
      // east: runs along z, fireplace opening straight through
      axis: 'z',
      u0: NZ,
      u1: SZ,
      slab: (p) => [EX, EX + T, p.y0, p.y1, p.u0, p.u1],
      openings: [{ u0: F.opening.z0, u1: F.opening.z1, y0: 0, y1: F.opening.y1 }],
    },
    {
      // west: runs along z, solid behind the bookcase
      axis: 'z',
      u0: NZ,
      u1: SZ,
      slab: (p) => [WX - T, WX, p.y0, p.y1, p.u0, p.u1],
      openings: [],
    },
  ];
  for (const run of runs) {
    const pieces = wallPieces(run.axis, run.u0, run.u1, run.openings);
    for (const p of pieces) {
      const [x0, x1, y0, y1, z0, z1] = run.slab(p);
      const horiz = run.axis === 'x' ? x1 - x0 : z1 - z0;
      add(shell, B(m.plaster(horiz, y1 - y0), x0, x1, y0, y1, z0, z1, { receive: true }));
    }
  }

  // ---- joinery and openings -----------------------------------------------
  shell.add(doorSet(m));
  const doorGroup = new THREE.Group();
  doorGroup.name = 'door';
  shell.add(doorGroup);
  const leaf = doorLeaf(m);
  doorGroup.add(leaf);
  shell.add(windowSet(m));
  shell.add(curtains(m));
  shell.add(fireplace(m));

  // ---- pictures -----------------------------------------------------------
  const picture = (w2, h2, x, y, z, ry, artIndex) => {
    const grp = new THREE.Group();
    const bez = 0.05;
    solid(grp, m.goldLeaf, -w2 / 2 - bez, w2 / 2 + bez, -h2 / 2 - bez, h2 / 2 + bez, -0.03, 0.0, { cast: true });
    const art = new THREE.Mesh(new THREE.PlaneGeometry(w2, h2), m.art[artIndex % m.art.length]);
    art.position.z = 0.002;
    grp.add(art);
    grp.position.set(x, y, z);
    grp.rotation.y = ry;
    return grp;
  };
  shell.add(picture(0.9, 0.58, F.breastX - 0.016, 1.98, 0, -Math.PI / 2, 0));
  shell.add(picture(0.48, 0.6, -1.9, 1.62, NZ + 0.008, 0, 1));

  // ---- exterior: night sky, and the passage behind the door ---------------
  exterior.add(passage(m));
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), m.sky);
  sky.position.set(0, 3.0, NZ - 7.5);
  exterior.add(sky);
  const crest = new THREE.Mesh(new THREE.PlaneGeometry(24, 2.2), new THREE.MeshBasicMaterial({ color: 0x060a11 }));
  crest.position.set(0, 0.9, NZ - 6.9);
  exterior.add(crest);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), new THREE.MeshBasicMaterial({ color: 0x0a1017 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.4, NZ - 4.6);
  exterior.add(ground);
  shell.add(exterior);

  // ---- dust ---------------------------------------------------------------
  const dust = makeDust(m);
  shell.add(dust.points);
  const skyWeather = clouds(m);
  exterior.add(skyWeather.group);

  return {
    shell,
    ceiling: ceilingGrp,
    exterior,
    dust,
    clouds: skyWeather,
    leaf,
    doorGroup,
    planGroup: () => {
      const g = new THREE.Group();
      g.name = 'plan-view-aids';
      g.add(planSheet(m));
      g.add(planAnnotations(m));
      return g;
    },
  };
}
