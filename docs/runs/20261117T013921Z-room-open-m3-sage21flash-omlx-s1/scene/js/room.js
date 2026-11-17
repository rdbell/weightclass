import * as THREE from 'three';
import { M } from './materials.js';
import { box } from './util.js';
import { skyTexture } from './textures.js';
import { buildPicture } from './furniture.js';

// Room shell: 6 m (east-west) x 4.5 m (north-south), ceiling 2.7 m.
// North is -z, east is +x, origin at the centre of the floor.
export function buildRoom(scene) {
  const room = new THREE.Group();

  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 4.5), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  room.add(floor);

  // Walls (0.15 m thick, outside the 6 x 4.5 footprint)
  // North wall (-z), pierced by the window: x -0.8..0.8, y 0.9..2.3
  room.add(box(2.35, 2.7, 0.15, M.wall, -1.975, 1.35, -2.325));
  room.add(box(2.35, 2.7, 0.15, M.wall, 1.975, 1.35, -2.325));
  room.add(box(1.6, 0.9, 0.15, M.wall, 0, 0.45, -2.325));
  room.add(box(1.6, 0.4, 0.15, M.wall, 0, 2.5, -2.325));
  // South wall (+z), pierced by the door: x -2.25..-1.35, y 0..2.06
  room.add(box(0.9, 2.7, 0.15, M.wall, -2.7, 1.35, 2.325));
  room.add(box(4.5, 2.7, 0.15, M.wall, 0.9, 1.35, 2.325));
  room.add(box(0.9, 0.64, 0.15, M.wall, -1.8, 2.38, 2.325));
  // East wall (+x), behind the fireplace breast
  room.add(box(0.15, 2.7, 4.8, M.wall, 3.075, 1.35, 0));
  // West wall (-x)
  room.add(box(0.15, 2.7, 4.8, M.wall, -3.075, 1.35, 0));

  // Baseboards
  room.add(box(6, 0.1, 0.024, M.trim, 0, 0.05, -2.238));
  room.add(box(0.75, 0.1, 0.024, M.trim, -2.625, 0.05, 2.238));
  room.add(box(4.35, 0.1, 0.024, M.trim, 0.825, 0.05, 2.238));
  room.add(box(0.024, 0.1, 4.5, M.trim, 2.988, 0.05, 0));
  room.add(box(0.024, 0.1, 4.5, M.trim, -2.988, 0.05, 0));

  // Ceiling group (hidden in the top-down view)
  const ceilingGroup = new THREE.Group();
  const ceil = box(6.3, 0.06, 4.8, M.ceiling, 0, 2.72, 0);
  ceil.castShadow = false;
  ceilingGroup.add(ceil);
  for (const z of [-1.15, 0, 1.15]) {
    const beam = box(6.3, 0.1, 0.16, M.beam, 0, 2.66, z);
    beam.castShadow = false;
    ceilingGroup.add(beam);
  }
  room.add(ceilingGroup);

  buildDoor(room);
  const curtains = buildWindow(room);
  buildFireplace(room);
  buildPictures(room);
  buildExterior(room);

  scene.add(room);

  function update(t) {
    for (const cur of curtains) {
      cur.rotation.y = Math.sin(t * 0.8 + cur.userData.phase) * 0.035;
    }
  }

  return { ceilingGroup, update };
}

function buildDoor(room) {
  const door = new THREE.Group();
  // Casing
  door.add(box(0.07, 2.13, 0.03, M.trim, -2.285, 1.065, 2.235));
  door.add(box(0.07, 2.13, 0.03, M.trim, -1.315, 1.065, 2.235));
  door.add(box(1.11, 0.07, 0.03, M.trim, -1.8, 2.095, 2.235));
  // Threshold
  door.add(box(0.9, 0.025, 0.1, M.woodDark, -1.8, 0.012, 2.25));

  // Leaf, hinged on its west side (x = -2.25), opening into the room.
  const panel = new THREE.Group();
  panel.position.set(-2.25, 0, 2.25);
  panel.rotation.y = THREE.MathUtils.degToRad(75);
  panel.add(box(0.88, 2.02, 0.045, M.door, 0.44, 1.04, 0));
  for (const py of [0.63, 1.45]) {
    panel.add(box(0.6, 0.68, 0.014, M.door, 0.44, py, 0.026));
    panel.add(box(0.6, 0.68, 0.014, M.door, 0.44, py, -0.026));
  }
  const knobGeo = new THREE.SphereGeometry(0.034, 12, 10);
  const knob = new THREE.Mesh(knobGeo, M.brass);
  knob.position.set(0.8, 1.02, 0.055);
  knob.castShadow = true;
  panel.add(knob);
  const knob2 = knob.clone();
  knob2.position.z = -0.055;
  panel.add(knob2);
  for (const hy of [0.28, 1.78]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.07), M.iron);
    h.position.set(0.02, hy, 0);
    panel.add(h);
  }
  door.add(panel);
  room.add(door);
}

function buildWindow(room) {
  const win = new THREE.Group();
  // Frame inside the opening
  win.add(box(0.06, 1.46, 0.1, M.trim, -0.77, 1.6, -2.3));
  win.add(box(0.06, 1.46, 0.1, M.trim, 0.77, 1.6, -2.3));
  win.add(box(1.6, 0.06, 0.1, M.trim, 0, 2.27, -2.3));
  win.add(box(1.6, 0.06, 0.1, M.trim, 0, 0.93, -2.3));
  // Muntins
  win.add(box(0.035, 1.34, 0.045, M.trim, 0, 1.6, -2.29));
  win.add(box(1.54, 0.035, 0.045, M.trim, 0, 1.62, -2.29));
  // Sill
  win.add(box(1.8, 0.045, 0.16, M.trim, 0, 0.875, -2.19));
  // Glass
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.48, 1.32), M.glass);
  glass.position.set(0, 1.6, -2.31);
  glass.castShadow = false;
  glass.receiveShadow = false;
  win.add(glass);

  // Curtains, hung either side of the window (they sway gently; see update)
  const curtainGeo = new THREE.PlaneGeometry(0.5, 1.6, 14, 6);
  const pos = curtainGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    pos.setZ(i, Math.sin(x * 22 + y * 2) * 0.035 + Math.sin(y * 9) * 0.02);
  }
  curtainGeo.computeVertexNormals();
  curtainGeo.translate(0, -0.8, 0); // pivot at the rod
  const curtains = [];
  for (const sx of [-1.16, 1.16]) {
    const geo = curtainGeo.clone();
    const cur = new THREE.Mesh(geo, M.curtain);
    cur.position.set(sx, 2.43, -2.12);
    cur.castShadow = true;
    cur.userData.phase = sx;
    win.add(cur);
    curtains.push(cur);
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.5), M.brass);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0, 2.47, -2.12);
  rod.castShadow = true;
  win.add(rod);
  for (const sx of [-1.27, 1.27]) {
    const fin = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), M.brass);
    fin.position.set(sx, 2.47, -2.12);
    win.add(fin);
  }
  room.add(win);
  return curtains;
}

function buildFireplace(room) {
  const fp = new THREE.Group();
  // Brick chimney breast, opening 1 m wide x 0.75 m high
  fp.add(box(0.28, 1.95, 1.7, M.brick, 2.86, 1.725, 0));
  fp.add(box(0.28, 0.75, 0.35, M.brick, 2.86, 0.375, -0.675));
  fp.add(box(0.28, 0.75, 0.35, M.brick, 2.86, 0.375, 0.675));

  // Firebox interior (planes facing inwards)
  const interior = new THREE.Group();
  const backP = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), M.charred);
  backP.rotation.y = Math.PI / 2;
  backP.position.set(2.995, 0.375, 0);
  interior.add(backP);
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.75), M.charred);
  sideL.position.set(2.855, 0.375, -0.5);
  interior.add(sideL);
  const sideR = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.75), M.charred);
  sideR.rotation.y = Math.PI;
  sideR.position.set(2.855, 0.375, 0.5);
  interior.add(sideR);
  const topP = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.27), M.charred);
  topP.rotation.x = Math.PI / 2;
  topP.position.set(2.855, 0.735, 0);
  interior.add(topP);
  const botP = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.27), M.charred);
  botP.rotation.x = -Math.PI / 2;
  botP.position.set(2.855, 0.021, 0);
  interior.add(botP);
  fp.add(interior);

  // Hearth slab
  fp.add(box(0.36, 0.05, 1.9, M.stone, 2.6, 0.025, 0));
  // Cast-iron frame around the opening
  fp.add(box(0.05, 0.05, 1.12, M.iron, 2.735, 0.775, 0));
  fp.add(box(0.05, 0.82, 0.05, M.iron, 2.735, 0.39, -0.535));
  fp.add(box(0.05, 0.82, 0.05, M.iron, 2.735, 0.39, 0.535));
  // Mantel shelf + corbels
  fp.add(box(0.14, 0.07, 2.0, M.woodDark, 2.73, 1.215, 0));
  fp.add(box(0.1, 0.16, 0.06, M.woodDark, 2.70, 1.1, -0.8));
  fp.add(box(0.1, 0.16, 0.06, M.woodDark, 2.70, 1.1, 0.8));

  // Candles on the mantel
  for (const cz of [-0.55, 0.55]) {
    const holder = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.035, 0.025, 12), M.brass);
    holder.position.set(2.70, 1.2525, cz);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.09, 10), M.ceramic);
    candle.position.set(2.70, 1.31, cz);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), new THREE.MeshBasicMaterial({ color: '#ffbf50' }));
    flame.position.set(2.70, 1.362, cz);
    fp.add(holder, candle, flame);
  }

  // Picture above the mantel
  const art = buildPicture('dusk', 0.86, 0.62);
  art.position.set(2.73, 1.83, 0);
  art.rotation.y = -Math.PI / 2;
  fp.add(art);

  room.add(fp);
}

function buildPictures(room) {
  const p1 = buildPicture('abstract', 0.52, 0.66);
  p1.position.set(0.7, 1.75, 2.231);
  p1.rotation.y = Math.PI;
  room.add(p1);
  const p2 = buildPicture('botanical', 0.46, 0.6);
  p2.position.set(-1.85, 1.78, -2.231);
  room.add(p2);
  const p3 = buildPicture('abstract', 0.5, 0.62);
  p3.position.set(1.95, 1.8, -2.231);
  room.add(p3);
}

function buildExterior(room) {
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 14),
    new THREE.MeshBasicMaterial({ map: skyTexture() })
  );
  sky.position.set(0, 3, -7.5);
  room.add(sky);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 30),
    new THREE.MeshBasicMaterial({ color: '#0d121d' })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  room.add(ground);

  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 5),
    new THREE.MeshBasicMaterial({ color: '#080b11' })
  );
  back.position.set(-1.8, 2, 3.8);
  back.rotation.y = Math.PI;
  room.add(back);
}