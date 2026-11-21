import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mulberry32, toonMaterial, glowTexture } from './toon.js';

/* ================= SKY ================= */
export function buildSky() {
  const geo = new THREE.SphereGeometry(430, 32, 18);
  const uniforms = {
    uTop: { value: new THREE.Color('#3f9dff') },
    uMid: { value: new THREE.Color('#7ec9ff') },
    uBottom: { value: new THREE.Color('#e8f7ff') },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vWorld;
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uBottom;
      void main() {
        float h = normalize(vWorld).y;
        vec3 col = h < 0.14
          ? mix(uBottom, uMid, smoothstep(-0.28, 0.14, h))
          : mix(uMid, uTop, smoothstep(0.14, 0.72, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return { mesh: sky, uniforms };
}

/* ================= STARS ================= */
export function buildStars(rng) {
  const N = 170;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    // upper hemisphere dome
    const az = rng() * Math.PI * 2;
    const el = Math.asin(0.18 + rng() * 0.82);
    const r = 400;
    pos[i * 3] = Math.cos(az) * Math.cos(el) * r;
    pos[i * 3 + 1] = Math.sin(el) * r;
    pos[i * 3 + 2] = Math.sin(az) * Math.cos(el) * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: '#ffffff', size: 2.4, sizeAttenuation: false,
    transparent: true, opacity: 0, depthWrite: false, fog: false,
  });
  const stars = new THREE.Points(geo, mat);
  stars.renderOrder = -5;
  stars.frustumCulled = false;
  return { mesh: stars, material: mat };
}

/* ================= GROUND & PLAZA ================= */
export function buildGround(materials) {
  const group = new THREE.Group();

  const groundGeo = new THREE.CylinderGeometry(430, 430, 4, 64);
  const ground = new THREE.Mesh(groundGeo, materials.grass);
  ground.position.y = -2;
  ground.receiveShadow = true;
  group.add(ground);

  const plazaGeo = new THREE.CylinderGeometry(56, 56, 1.6, 56);
  const plaza = new THREE.Mesh(plazaGeo, materials.plaza);
  plaza.position.y = 0.8;
  plaza.receiveShadow = true;
  group.add(plaza);

  // plinth under the tower
  const plinthGeo = new RoundedBoxGeometry(84, 3.4, 84, 2, 1.4);
  const plinth = new THREE.Mesh(plinthGeo, materials.plinth);
  plinth.position.y = 1.7;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  group.add(plinth);

  // 4 paths (cardineal)
  const pathGeos = [];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const g = new THREE.BoxGeometry(9, 0.5, 160);
    if (dx !== 0) g.rotateY(Math.PI / 2);
    g.translate(dx * 136, 0.35, dz * 136);
    pathGeos.push(g);
  }
  const pathGeo = mergeGeometries(pathGeos, false);
  const paths = new THREE.Mesh(pathGeo, materials.path);
  paths.receiveShadow = true;
  group.add(paths);

  // pond to the front-right
  const pondGeo = new THREE.CylinderGeometry(13, 13, 0.8, 28);
  const pond = new THREE.Mesh(pondGeo, materials.pond);
  pond.position.set(92, 0.4, 26);
  pond.receiveShadow = true;
  group.add(pond);
  const pondRimGeo = new THREE.TorusGeometry(13.4, 1.0, 8, 28);
  pondRimGeo.rotateX(Math.PI / 2);
  const pondRim = new THREE.Mesh(pondRimGeo, materials.plinth);
  pondRim.position.set(92, 0.5, 26);
  pondRim.receiveShadow = true;
  group.add(pondRim);

  /* horizon skirt — melts the ground rim into the sky */
  const skirtGeo = new THREE.RingGeometry(190, 416, 64, 1);
  skirtGeo.rotateX(-Math.PI / 2);
  const skirtMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    uniforms: { uColor: { value: new THREE.Color('#d9f0ff') } },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 uColor;
      void main() {
        float r = length(vWorld.xz);
        float t = smoothstep(225.0, 400.0, r);
        gl_FragColor = vec4(uColor, t * 0.92);
      }
    `,
  });
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.position.y = 0.18;
  skirt.renderOrder = 1;
  group.add(skirt);

  return { group, ground, plaza, plinth, paths, pond, skirtMat };
}

/* ================= TREES ================= */
export function buildTrees(rng, materials) {
  const trunkGeos = [];
  const canopyGeos = [];
  const spots = [];
  let attempts = 0;
  while (spots.length < 13 && attempts < 400) {
    attempts++;
    const az = rng() * Math.PI * 2;
    const r = 64 + rng() * 78;
    // avoid the cardinal paths (N/E/S/W)
    const k = Math.round((az / (Math.PI * 2)) * 4);
    let angleToAxis = Math.abs(az - k * (Math.PI / 2));
    angleToAxis = Math.min(angleToAxis, Math.PI * 2 - angleToAxis);
    if (angleToAxis < 0.20) continue;
    const x = Math.cos(az) * r, z = Math.sin(az) * r;
    // avoid pond
    if (Math.hypot(x - 92, z - 26) < 19) continue;
    // keep the camera corridor (azimuth ~0.55 rad from origin) clear
    let dAz = Math.abs(az - 0.55);
    dAz = Math.min(dAz, Math.PI * 2 - dAz);
    if (dAz < 1.05 && r < 175) continue;
    // avoid other trees
    if (spots.some(s => Math.hypot(s.x - x, s.z - z) < 16)) continue;
    spots.push({ x, z, az });
  }
  for (const s of spots) {
    const scale = 0.75 + rng() * 0.5;
    const h = 4.2 * scale;
    const trunk = new THREE.CylinderGeometry(0.55 * scale, 0.8 * scale, h, 7);
    trunk.translate(s.x, h / 2, s.z);
    trunkGeos.push(trunk);
    const nPuffs = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < nPuffs; i++) {
      const pr = (2.55 - i * 0.6) * scale;
      const px = s.x + (rng() - 0.5) * 1.6 * scale;
      const pz = s.z + (rng() - 0.5) * 1.6 * scale;
      const py = h + (1.4 + i * 1.9) * scale;
      const puff = new THREE.SphereGeometry(pr, 10, 8);
      puff.scale(1, 0.86, 1);
      puff.translate(px, py, pz);
      canopyGeos.push(puff);
    }
  }
  const trunks = new THREE.Mesh(mergeGeometries(trunkGeos, false), materials.trunk);
  trunks.castShadow = true;
  const canopy = new THREE.Mesh(mergeGeometries(canopyGeos, false), materials.canopy);
  canopy.castShadow = true;
  return { group: new THREE.Group().add(trunks, canopy), trunks, canopy };
}

/* ================= ROCKS & FLOWERS ================= */
export function buildRocks(rng, materials) {
  const geos = [];
  for (let i = 0; i < 7; i++) {
    const az = rng() * Math.PI * 2;
    const r = 58 + rng() * 60;
    const g = new THREE.DodecahedronGeometry(0.7 + rng() * 0.9, 0);
    g.scale(1, 0.75, 1);
    g.translate(Math.cos(az) * r, 0.35, Math.sin(az) * r);
    geos.push(g);
  }
  const rocks = new THREE.Mesh(mergeGeometries(geos, false), materials.rock);
  rocks.castShadow = true;
  return rocks;
}

export function buildFlowers(rng, materials) {
  const geos = [];
  const colors = ['#ff7eb0', '#ffd166', '#ff9e5e', '#c79bff', '#ffffff'].map(c => new THREE.Color(c));
  const c = new THREE.Color();
  for (let i = 0; i < 22; i++) {
    const az = rng() * Math.PI * 2;
    const r = 58 + rng() * 70;
    const px = Math.cos(az) * r, pz = Math.sin(az) * r;
    if (Math.hypot(px - 92, pz - 26) < 18) continue;
    const g = new THREE.OctahedronGeometry(0.45 + rng() * 0.3, 0);
    g.scale(1, 1.5, 1);
    g.translate(px, 0.7, pz);
    c.copy(colors[Math.floor(rng() * colors.length)]);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let j = 0; j < n; j++) { col[j * 3] = c.r; col[j * 3 + 1] = c.g; col[j * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(g);
  }
  const flowers = new THREE.Mesh(mergeGeometries(geos, false), materials.flower);
  return flowers;
}

/* ================= LAMPS ================= */
export function buildLamps(materials) {
  const poleGeos = [];
  const headGeos = [];
  const heads = [];
  const lampAzs = [1.90, 2.20, 2.62, 4.35, 4.75, 5.10];
  for (let i = 0; i < lampAzs.length; i++) {
    const az = lampAzs[i];
    const x = Math.cos(az) * 46, z = Math.sin(az) * 46;
    const pole = new THREE.CylinderGeometry(0.3, 0.45, 4.9, 7);
    pole.translate(x, 2.45, z);
    poleGeos.push(pole);
    const head = new THREE.SphereGeometry(0.85, 10, 8);
    head.translate(x, 5.35, z);
    headGeos.push(head);
    heads.push(new THREE.Vector3(x, 5.35, z));
  }
  const poles = new THREE.Mesh(mergeGeometries(poleGeos, false), materials.rail);
  poles.castShadow = true;
  const headsMesh = new THREE.Mesh(mergeGeometries(headGeos, false), materials.lampHead);
  return { group: new THREE.Group().add(poles, headsMesh), heads, poles, headsMesh };
}

/* ================= BENCHES ================= */
export function buildBenches(materials) {
  const geos = [];
  const benchAzs = [1.95, 2.35, 4.42, 4.80];
  for (let i = 0; i < benchAzs.length; i++) {
    const az = benchAzs[i];
    const r = 30;
    const x = Math.cos(az) * r, z = Math.sin(az) * r;
    const yaw = Math.atan2(-Math.cos(az), -Math.sin(az)); // local +Z faces the tower
    const seat = new THREE.BoxGeometry(5.4, 0.55, 1.5);
    seat.translate(0, 1.55, 0);
    seat.rotateY(yaw);
    seat.translate(x, 0, z);
    geos.push(seat);
    const back = new THREE.BoxGeometry(5.4, 1.7, 0.45);
    back.translate(0, 2.5, -1.15);
    back.rotateY(yaw);
    back.translate(x, 0, z);
    geos.push(back);
    for (const s of [-2.15, 2.15]) {
      const leg = new THREE.BoxGeometry(0.5, 1.45, 1.35);
      leg.translate(s, 0.72, 0);
      leg.rotateY(yaw);
      leg.translate(x, 0, z);
      geos.push(leg);
    }
  }
  const benches = new THREE.Mesh(mergeGeometries(geos, false), materials.bench);
  benches.castShadow = true;
  benches.receiveShadow = true;
  return benches;
}

/* ================= CLOUDS ================= */
export function buildClouds(rng, materials) {
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const az = 3.35 + (rng() - 0.5) * 2.4;
    const r = 80 + rng() * 150;
    const y = 112 + rng() * 58;
    const scale = 0.9 + rng() * 1.3;
    const geos = [];
    const n = 4 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) {
      const ox = (j - (n - 1) / 2) * 4.6 + (rng() - 0.5) * 2.4;
      const pz = (rng() - 0.5) * 4.4;
      const py = (rng() - 0.5) * 1.6;
      const pr = (3.2 + rng() * 2.2) * scale;
      const g = new THREE.SphereGeometry(pr, 10, 8);
      g.scale(1, 0.62, 1);
      g.translate(ox * scale, py, pz * scale);
      geos.push(g);
    }
    const geo = mergeGeometries(geos, false);
    const mesh = new THREE.Mesh(geo, materials.cloud);
    mesh.position.set(Math.cos(az) * r, y, Math.sin(az) * r);
    mesh.userData = {
      speed: 0.85 + rng() * 0.85,
      bob: 0.5 + rng() * 0.8,
      phase: rng() * Math.PI * 2,
      baseY: y,
    };
    clouds.push(mesh);
  }
  return clouds;
}

/* ================= BALLOON ================= */
export function buildBalloon(materials) {
  const group = new THREE.Group();
  const envelope = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 14, 11), materials.balloon,
  );
  envelope.scale.set(1, 1.18, 1);
  envelope.castShadow = false;
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 1.35, 2.2, 8), materials.balloonSkirt);
  skirt.position.y = -6.6;
  const basket = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.9, 2.4), materials.basket);
  basket.position.y = -9.4;
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), materials.lantern);
  lantern.position.y = -7.6;
  group.add(envelope, skirt, basket, lantern);
  group.userData = { envelope, lantern };
  return group;
}

/* ================= BIRDS ================= */
export function buildBirds(materials) {
  const birds = [];
  for (let i = 0; i < 4; i++) {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), materials.bird);
    body.scale.set(0.8, 0.72, 1.7);   // long along forward (+Z)
    bird.add(body);
    const wingGeoR = new THREE.PlaneGeometry(1.95, 0.95, 3, 1);
    wingGeoR.translate(0.97, 0, 0);    // extends +X
    const right = new THREE.Mesh(wingGeoR, materials.birdWing);
    const wingGeoL = new THREE.PlaneGeometry(1.95, 0.95, 3, 1);
    wingGeoL.translate(-0.97, 0, 0);   // extends -X
    const left = new THREE.Mesh(wingGeoL, materials.birdWing);
    bird.add(left, right);
    bird.userData = {
      left, right,
      angle: (i / 4) * Math.PI * 2,
      radius: 95 + i * 14,
      height: 78 + (i % 3) * 14,
      speed: 0.026 + (i % 2) * 0.009,
      phase: i * 1.7,
    };
    birds.push(bird);
  }
  return birds;
}

/* ================= FLOWER / ROCK materials helper ================= */
export function buildGlowSprite(scale, color = '#ffffff', opacity = 0.8) {
  const mat = new THREE.SpriteMaterial({
    map: glowTexture(color),
    color: color,
    transparent: true,
    opacity,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}
