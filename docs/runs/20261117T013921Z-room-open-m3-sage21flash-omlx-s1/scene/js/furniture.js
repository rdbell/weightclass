import * as THREE from 'three';
import { M } from './materials.js';
import { box, shadows } from './util.js';
import { rng, rand, pick } from './rng.js';
import { rugTexture, artTexture } from './textures.js';

// Three-seat sofa facing the fireplace (+x), its back 2.5 m from the east wall.
export function createSofa() {
  const g = new THREE.Group();
  const legGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.13);
  for (const [lx, lz] of [[-0.88, -0.36], [0.88, -0.36], [-0.88, 0.36], [0.88, 0.36]]) {
    const leg = new THREE.Mesh(legGeo, M.woodDark);
    leg.position.set(lx, 0.065, lz);
    g.add(leg);
  }
  g.add(box(1.84, 0.3, 0.95, M.sofa, 0, 0.27, 0));
  for (const sx of [-0.92, 0.92]) g.add(box(0.16, 0.5, 0.95, M.sofa, sx, 0.37, 0));
  g.add(box(2.0, 0.58, 0.16, M.sofa, 0, 0.71, -0.395));
  for (let i = 0; i < 3; i++) {
    g.add(box(0.58, 0.15, 0.62, M.sofaLight, -0.6 + i * 0.6, 0.495, 0.06));
    const bc = box(0.56, 0.4, 0.13, M.sofaLight, -0.6 + i * 0.6, 0.78, -0.24);
    bc.rotation.x = -0.1;
    g.add(bc);
  }
  const t1 = box(0.38, 0.38, 0.11, M.cushionCream, -0.68, 0.72, -0.12);
  t1.rotation.set(-0.18, 0, 0.22);
  g.add(t1);
  const t2 = box(0.36, 0.36, 0.11, M.cushionNavy, 0.68, 0.72, -0.12);
  t2.rotation.set(-0.15, 0, -0.26);
  g.add(t2);
  const bl = box(0.2, 0.025, 0.78, M.blanket, -0.92, 0.635, 0.05);
  bl.rotation.x = 0.03;
  g.add(bl);
  g.add(box(0.03, 0.34, 0.78, M.blanket, -1.005, 0.47, 0.05));
  shadows(g);
  g.rotation.y = Math.PI / 2; // face east, toward the fireplace
  g.position.set(0.025, 0.021, 0); // legs rest on the rug's surface
  return g;
}

// Armchair in the north-east corner, angled 45 degrees toward the fireplace.
export function createArmchair() {
  const g = new THREE.Group();
  const legGeo = new THREE.CylinderGeometry(0.02, 0.028, 0.12);
  for (const [lx, lz] of [[-0.32, -0.28], [0.32, -0.28], [-0.32, 0.28], [0.32, 0.28]]) {
    const leg = new THREE.Mesh(legGeo, M.woodDark);
    leg.position.set(lx, 0.06, lz);
    g.add(leg);
  }
  g.add(box(0.64, 0.28, 0.78, M.chair, 0, 0.26, 0));
  for (const sx of [-0.36, 0.36]) g.add(box(0.08, 0.46, 0.78, M.chair, sx, 0.35, 0));
  // curved wrap-around back
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 0.52, 18, 1, true, Math.PI - 1.15, 2.3),
    M.chairShell
  );
  shell.position.set(0, 0.66, 0.02);
  g.add(shell);
  g.add(box(0.6, 0.13, 0.55, M.chairLight, 0, 0.465, 0.04));
  const bc = box(0.56, 0.36, 0.12, M.cushionCream, 0, 0.64, -0.2);
  bc.rotation.x = -0.12;
  g.add(bc);
  const t1 = box(0.3, 0.3, 0.1, M.cushionNavy, -0.17, 0.6, -0.1);
  t1.rotation.set(-0.15, 0, 0.28);
  g.add(t1);
  shadows(g);
  g.rotation.y = Math.PI / 4; // face south-east, toward the fireplace
  g.position.set(2.1, 0, -1.64);
  return g;
}

// Low coffee table between the sofa and the fireplace.
export function createCoffeeTable() {
  const g = new THREE.Group();
  g.add(box(1.1, 0.045, 0.55, M.woodMid, 0, 0.4275, 0));
  for (const [lx, lz] of [[-0.49, -0.225], [0.49, -0.225], [-0.49, 0.225], [0.49, 0.225]]) {
    g.add(box(0.045, 0.41, 0.045, M.woodDark, lx, 0.205, lz));
  }
  g.add(box(0.94, 0.025, 0.36, M.woodMid, 0, 0.15, 0));
  const b1 = box(0.24, 0.032, 0.17, M.cushionNavy, -0.18, 0.466, 0.04);
  b1.rotation.y = 0.12;
  const b2 = box(0.22, 0.028, 0.16, M.sofa, -0.18, 0.496, 0.05);
  b2.rotation.y = -0.08;
  const b3 = box(0.19, 0.026, 0.14, M.cushionCream, -0.17, 0.523, 0.03);
  b3.rotation.y = 0.2;
  g.add(b1, b2, b3);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 14), M.mug);
  mug.position.set(0.22, 0.495, -0.1);
  g.add(mug);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.007, 8, 14), M.mug);
  handle.position.set(0.265, 0.5, -0.1);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.028, 0.13, 10), M.ceramic);
  vase.position.set(0.05, 0.515, 0.14);
  g.add(vase);
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.14, 5), i % 2 ? M.leafA : M.leafB);
    blade.position.set(0.05 + (i - 1) * 0.02, 0.63, 0.14 + (i - 1) * 0.015);
    blade.rotation.z = (i - 1) * 0.35;
    g.add(blade);
  }
  shadows(g);
  g.position.set(1.0, 0.021, 0);
  return g;
}

// Rug centred under the coffee table, reaching under the sofa's front legs.
export function createRug() {
  const g = new THREE.Group();
  const topMat = new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 });
  const mats = [M.rugSide, M.rugSide, topMat, M.rugSide, M.rugSide, M.rugSide];
  const rug = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.02, 2.0), mats);
  rug.position.set(1.0, 0.011, 0);
  rug.receiveShadow = true;
  g.add(rug);
  return g;
}

// Floor-to-ceiling bookshelf along the west wall, stopping clear of the
// door's swing arc (hinge at x -2.25, z 2.25).
export function createBookshelf() {
  const g = new THREE.Group();
  const h = 2.7;
  g.add(box(0.3, h, 0.035, M.woodDark, -2.85, h / 2, -2.2325));
  g.add(box(0.3, h, 0.035, M.woodDark, -2.85, h / 2, 1.2325));
  g.add(box(0.3, 0.035, 3.5, M.woodDark, -2.85, 2.6825, -0.5));
  g.add(box(0.3, 0.06, 3.5, M.woodDark, -2.85, 0.03, -0.5));
  g.add(box(0.02, h, 3.5, M.woodDark, -2.99, h / 2, -0.5));
  const shelfY = [0.6, 1.1, 1.6, 2.1, 2.6];
  for (const y of shelfY) g.add(box(0.28, 0.03, 3.43, M.woodDark, -2.86, y, -0.5));

  // Books: one InstancedMesh, seeded colours and sizes.
  const bookGeo = new THREE.BoxGeometry(1, 1, 1);
  const bookMat = new THREE.MeshStandardMaterial({ roughness: 0.92 });
  const palette = ['#7d3b30', '#31405e', '#5d7247', '#a8873f', '#6b4a3a', '#8a5a68',
    '#42605f', '#9a6b4a', '#b08d57', '#54476b', '#7a4a52', '#48604a'].map((c) => new THREE.Color(c));
  const books = [];
  const shelfTops = [0.06, 0.615, 1.115, 1.615, 2.115];
  for (const baseY of shelfTops) {
    let z = -2.16;
    while (z < 1.14) {
      // reserved gaps for shelf decorations
      if (baseY === 1.115 && z > 0.3 && z < 0.62) { z = 0.62; continue; }
      if (baseY === 2.115 && z > -1.35 && z < -1.02) { z = -1.02; continue; }
      const r = rng();
      if (r < 0.1) { z += rand(0.05, 0.18); continue; }
      if (r < 0.22) {
        const n = 2 + Math.floor(rand(0, 2));
        const w = rand(0.15, 0.2);
        let y = baseY;
        for (let i = 0; i < n; i++) {
          const th = rand(0.03, 0.05);
          books.push({
            pos: [-2.885, y + th / 2, z + w / 2],
            scale: [rand(0.13, 0.16), th, w],
            rot: [0, rand(-0.06, 0.06), 0],
            color: pick(palette),
          });
          y += th;
        }
        z += w + 0.015;
      } else {
        const w = rand(0.024, 0.05), bh = rand(0.2, 0.33);
        books.push({
          pos: [-2.885 + rand(-0.008, 0.008), baseY + bh / 2, z + w / 2],
          scale: [rand(0.17, 0.2), bh, w],
          rot: [0, 0, 0],
          color: pick(palette),
        });
        z += w + 0.004;
      }
    }
  }
  const dummy = new THREE.Object3D();
  const inst = new THREE.InstancedMesh(bookGeo, bookMat, books.length);
  books.forEach((b, i) => {
    dummy.position.set(...b.pos);
    dummy.rotation.set(...b.rot);
    dummy.scale.set(...b.scale);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
    inst.setColorAt(i, b.color);
  });
  inst.castShadow = inst.receiveShadow = true;
  g.add(inst);

  // Decorations on the reserved gaps
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.22, 12), M.ceramic);
  vase.position.set(-2.85, 1.115 + 0.11, 0.46);
  vase.castShadow = true;
  g.add(vase);
  const sprig = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.16, 5), M.leafB);
  sprig.position.set(-2.85, 1.35, 0.46);
  sprig.rotation.z = 0.2;
  g.add(sprig);
  const photo = buildPicture('botanical', 0.16, 0.2);
  photo.position.set(-2.83, 2.245, -1.18);
  photo.rotation.y = Math.PI / 2;
  g.add(photo);
  // iron bookends flanking the vase gap
  for (const bz of [0.32, 0.6]) {
    const be = box(0.02, 0.12, 0.05, M.iron, -2.86, 1.115 + 0.06, bz);
    g.add(be);
  }

  shadows(g);
  return g;
}

// Floor lamp beside the armchair, on its west side.
export function createFloorLamp() {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.035, 20), M.brass);
  base.position.y = 0.0175;
  g.add(base);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 1.3, 10), M.brass);
  pole.position.y = 0.68;
  g.add(pole);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.32, 24, 1, true), M.shade);
  shade.position.y = 1.42;
  shade.castShadow = false;
  g.add(shade);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(0.16, 24), M.shade);
  cap.rotation.x = -Math.PI / 2;
  cap.position.y = 1.58;
  g.add(cap);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
  bulb.position.y = 1.36;
  g.add(bulb);
  const light = new THREE.PointLight('#ffb066', 14, 0, 2);
  light.position.set(0, 1.4, 0);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.004;
  light.shadow.camera.near = 0.06;
  g.add(light);
  shadows(g);
  shade.castShadow = false;
  cap.castShadow = false;
  bulb.castShadow = false;
  g.userData.light = light;
  g.position.set(1.15, 0, -1.75);
  return g;
}

// Small side table west of the sofa, with a book and reading glasses.
export function createSideTable() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.025, 20), M.woodMid);
  top.position.y = 0.55;
  g.add(top);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.53, 10), M.woodDark);
  pole.position.y = 0.28;
  g.add(pole);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.03, 16), M.woodDark);
  base.position.y = 0.015;
  g.add(base);
  const book = box(0.16, 0.025, 0.12, M.sofa, 0.03, 0.563, 0.02);
  book.rotation.y = 0.4;
  g.add(book);
  const ringGeo = new THREE.TorusGeometry(0.026, 0.004, 6, 12);
  for (const gx of [0.0, 0.06]) {
    const ring = new THREE.Mesh(ringGeo, M.iron);
    ring.position.set(gx + 0.01, 0.585, 0.02);
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
  }
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 6), M.iron);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0.04, 0.585, 0.02);
  g.add(bridge);
  shadows(g);
  g.position.set(-0.85, 0, 0.8);
  return g;
}

// Woven basket of firewood beside the fireplace.
export function createLogBasket() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.16, 0.32, 14, 1, true), M.basket);
  body.position.y = 0.16;
  g.add(body);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.16, 14), M.basket);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.005;
  g.add(bottom);
  for (const [ry, rr] of [[0.1, 0.185], [0.22, 0.2]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.011, 6, 18), M.basket);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = ry;
    g.add(ring);
  }
  const logGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.36, 9);
  const layouts = [[0.0, 0.33, 0.0, 0.4], [0.05, 0.34, 0.1, 1.2], [-0.06, 0.35, -0.05, 2.0], [0.0, 0.39, 0.05, 0.9]];
  for (const [lx, ly, lz, lr] of layouts) {
    const log = new THREE.Mesh(logGeo, M.log);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = lr;
    log.position.set(lx, ly, lz);
    g.add(log);
  }
  shadows(g);
  g.position.set(2.6, 0, 1.3);
  return g;
}

// Potted plant in the north-west corner.
export function createPlant() {
  const g = new THREE.Group();
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.24, 14), M.pot);
  pot.position.y = 0.12;
  g.add(pot);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 14), M.charred);
  soil.position.y = 0.245;
  g.add(soil);
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + rand(-0.2, 0.2);
    const h = rand(0.3, 0.55);
    const geo = new THREE.ConeGeometry(rand(0.025, 0.04), h, 6);
    geo.translate(0, h / 2, 0);
    const leaf = new THREE.Mesh(geo, i % 2 ? M.leafA : M.leafB);
    leaf.position.set(Math.cos(ang) * 0.03, 0.24, Math.sin(ang) * 0.03);
    leaf.rotation.set(0, -ang, -rand(0.35, 0.75));
    g.add(leaf);
  }
  shadows(g);
  g.position.set(-2.35, 0, -1.85);
  return g;
}

// Framed picture facing +z by default.
export function buildPicture(kind, w, h) {
  const g = new THREE.Group();
  const frame = box(w + 0.07, h + 0.07, 0.035, M.woodDark);
  g.add(frame);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({
    map: artTexture(kind), roughness: 0.9,
  }));
  art.position.z = 0.019;
  g.add(art);
  shadows(g);
  return g;
}