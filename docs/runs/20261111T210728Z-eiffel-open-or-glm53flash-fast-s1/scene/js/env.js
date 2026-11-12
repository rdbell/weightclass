import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, addOutline, addInstancedOutline } from './materials.js';
import { mulberry32 } from './rng.js';

function makeGroundTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  // world 2400m across -> 2.34 m per pixel
  g.fillStyle = '#7cc24f';
  g.fillRect(0, 0, S, S);
  // hard-edged cel grass patches
  const rng = mulberry32(42);
  for (let i = 0; i < 80; i++) {
    g.fillStyle = i % 2 ? '#8fd45f' : '#68b344';
    const x = rng() * S, y = rng() * S, r = 26 + rng() * 70;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.55 + rng() * 0.5), rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // gravel paths along the two axes
  const path = (x0, y0, w, h) => {
    g.fillStyle = '#d5c187';
    g.fillRect(x0 - 3, y0 - 3, w + 6, h + 6);
    g.fillStyle = '#e8d9a6';
    g.fillRect(x0, y0, w, h);
  };
  path(0, S / 2 - 12, S, 24);
  path(S / 2 - 12, 0, 24, S);
  // plaza around the tower
  g.fillStyle = '#d5c187';
  g.beginPath(); g.arc(S / 2, S / 2, 60, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#e8d9a6';
  g.beginPath(); g.arc(S / 2, S / 2, 56, 0, Math.PI * 2); g.fill();
  // ring trim
  g.strokeStyle = '#c9b377'; g.lineWidth = 3;
  g.beginPath(); g.arc(S / 2, S / 2, 47, 0, Math.PI * 2); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildEnvironment() {
  const group = new THREE.Group();

  // ---------------- stepped cel sky ----------------
  const skyUniforms = {
    uTop: { value: new THREE.Color('#2b87dd') },
    uMid: { value: new THREE.Color('#7cc7f2') },
    uHor: { value: new THREE.Color('#e2f4fb') },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2800, 32, 18),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: `varying vec3 vP;
        void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec3 vP;
        uniform vec3 uTop, uMid, uHor;
        void main(){
          float h = normalize(vP).y;
          vec3 c = uHor;
          c = mix(c, uMid, step(0.10, h));
          c = mix(c, uTop, step(0.42, h));
          if (h < 0.0) c = uHor * 0.82;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  group.add(sky);

  // ---------------- ground ----------------
  const groundMat = toon('#ffffff', { map: makeGroundTexture() });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1200, 72), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---------------- trees (two-tone canopies, instanced) ----------------
  const rng = mulberry32(7);
  const treePts = [];
  for (const s of [-1, 1]) {
    for (let d = 175; d <= 820; d += 54) {
      if (rng() > 0.18) treePts.push([d + (rng() - 0.5) * 30, s * (46 + rng() * 14)]);
      if (rng() > 0.18) treePts.push([d + (rng() - 0.5) * 30, s * (64 + rng() * 16)]);
      if (rng() > 0.18) treePts.push([s * (46 + rng() * 14), d + (rng() - 0.5) * 30]);
      if (rng() > 0.18) treePts.push([s * (64 + rng() * 16), d + (rng() - 0.5) * 30]);
    }
  }
  for (let i = 0; i < 80; i++) {
    const a = rng() * Math.PI * 2, r = 210 + rng() * 610;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.abs(x) < 62 || Math.abs(z) < 62) continue;
    treePts.push([x, z]);
  }

  const trunkMat = toon('#8a5a33');
  const leafA = toon('#55b052');
  const leafB = toon('#3f9642');
  const N = treePts.length;
  const trunkGeo = new THREE.CylinderGeometry(0.45, 0.8, 1, 7);
  trunkGeo.translate(0, 0.5, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, N);
  const canA = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leafA, N);
  const canB = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), leafB, N);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    treePts.forEach(([x, z], i) => {
      const h = 6 + rng() * 3.5;
      const r = 3.6 + h * 0.5;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rng() * Math.PI * 2);
      p.set(x, 0, z); s.set(0.7 + h * 0.05, h, 0.7 + h * 0.05);
      m.compose(p, q, s); trunks.setMatrixAt(i, m);
      p.set(x + (rng() - 0.5) * 1.2, h + r * 0.62, z + (rng() - 0.5) * 1.2);
      s.set(r, r * 1.18, r);
      m.compose(p, q, s); canA.setMatrixAt(i, m);
      p.set(x + (rng() - 0.5) * r * 0.9, h + r * 0.3, z + (rng() - 0.5) * r * 0.9);
      s.set(r * 0.62, r * 0.7, r * 0.62);
      m.compose(p, q, s); canB.setMatrixAt(i, m);
    });
  }
  for (const im of [trunks, canA, canB]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;
    group.add(im);
  }
  addInstancedOutline(trunks, 0.6);
  addInstancedOutline(canA, 1.2);
  addInstancedOutline(canB, 0.9);

  // ---------------- lampposts ----------------
  const lampPts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.31;
    lampPts.push({ x: Math.cos(a) * 140, z: Math.sin(a) * 140, lit: true });
  }
  for (const d of [300, 520, 740]) {
    lampPts.push({ x: d, z: 34 }, { x: -d, z: -34 }, { x: 34, z: -d }, { x: -34, z: d });
  }
  const lampIron = toon('#4c4038');
  const lampHeadMat = toon('#5a4a3c', { emissive: new THREE.Color('#ffd27a'), emissiveIntensity: 0 });
  const poleGeo = new THREE.CylinderGeometry(0.22, 0.36, 7, 6);
  poleGeo.translate(0, 3.5, 0);
  const baseGeo = new THREE.CylinderGeometry(0.6, 0.8, 0.8, 8);
  baseGeo.translate(0, 0.4, 0);
  const headGeo = new THREE.SphereGeometry(0.85, 10, 8);
  headGeo.translate(0, 7.4, 0);
  const poles = new THREE.InstancedMesh(mergeGeometries([poleGeo, baseGeo]), lampIron, lampPts.length);
  const heads = new THREE.InstancedMesh(headGeo, lampHeadMat, lampPts.length);
  const glowTex = makeGlowTexture();
  const haloMat = new THREE.SpriteMaterial({
    map: glowTex, color: '#ffc46a', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const lampLights = [];
  lampPts.forEach((L, i) => {
    const m = new THREE.Matrix4().makeTranslation(L.x, 0, L.z);
    poles.setMatrixAt(i, m);
    heads.setMatrixAt(i, m);
    const halo = new THREE.Sprite(haloMat);
    halo.position.set(L.x, 7.4, L.z);
    halo.scale.setScalar(9);
    group.add(halo);
    if (L.lit) {
      const pl = new THREE.PointLight('#ffb45e', 0, 75, 1.6);
      pl.position.set(L.x, 7.6, L.z);
      group.add(pl);
      lampLights.push(pl);
    }
  });
  poles.castShadow = true;
  poles.frustumCulled = false;
  heads.frustumCulled = false;
  group.add(poles, heads);

  // ---------------- clouds ----------------
  const cloudMat = toon('#ffffff');
  const clouds = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const rr = mulberry32(100 + i);
    const parts = [];
    const blobs = 4 + ((rr() * 3) | 0);
    for (let j = 0; j < blobs; j++) {
      const r = 14 + rr() * 16;
      const g = new THREE.SphereGeometry(1, 10, 8);
      g.scale(r, r * 0.62, r * 0.85);
      g.translate((j - blobs / 2) * r * 0.9 + (rr() - 0.5) * 8, (rr() - 0.5) * r * 0.35, (rr() - 0.5) * r * 0.8);
      parts.push(g);
    }
    const geo = mergeGeometries(parts);
    const mesh = new THREE.Mesh(geo, cloudMat);
    const a = (i / 8) * Math.PI * 2 + rr() * 0.5;
    const rad = 430 + rr() * 380;
    mesh.position.set(Math.cos(a) * rad, 250 + rr() * 160, Math.sin(a) * rad);
    mesh.scale.setScalar(1 + rr() * 0.8);
    addOutline(mesh, 1.4);
    clouds.add(mesh);
  }
  group.add(clouds);

  // ---------------- sun, moon, stars ----------------
  const sunMat = new THREE.MeshBasicMaterial({ color: '#ffdf6b', fog: false, transparent: true });
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(85, 40), sunMat);
  sunDisc.renderOrder = -5;
  group.add(sunDisc);
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: '#ffe9a0', transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunHalo.scale.setScalar(760);
  sunDisc.add(sunHalo);

  const moonMat = new THREE.MeshBasicMaterial({ color: '#e9f1ff', fog: false, transparent: true, opacity: 0 });
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(62, 40), moonMat);
  moonDisc.position.set(-1057, 1586, -1374);
  moonDisc.renderOrder = -5;
  group.add(moonDisc);
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: '#cfe0ff', transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  moonHalo.scale.setScalar(460);
  moonDisc.add(moonHalo);

  // stars
  const starN = 800;
  const starPos = new Float32Array(starN * 3);
  const srng = mulberry32(99);
  for (let i = 0; i < starN; i++) {
    let x, y, z;
    do {
      x = srng() * 2 - 1; y = srng(); z = srng() * 2 - 1;
    } while (x * x + y * y + z * z > 1 || y < 0.06);
    const l = Math.hypot(x, y, z) || 1;
    starPos[i * 3] = (x / l) * 2400;
    starPos[i * 3 + 1] = (y / l) * 2400;
    starPos[i * 3 + 2] = (z / l) * 2400;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: '#dfe8ff', size: 2.4, sizeAttenuation: false,
    transparent: true, opacity: 0, fog: false, depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -8;
  stars.frustumCulled = false;
  group.add(stars);

  // ---------------- birds ----------------
  const birdMat = toon('#3a3f52');
  const birds = [];
  const wingL = new THREE.BoxGeometry(3.4, 0.22, 1.4); wingL.translate(1.9, 0, 0);
  const wingR = new THREE.BoxGeometry(3.4, 0.22, 1.4); wingR.translate(-1.9, 0, 0);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.7, 1.0), birdMat);
    const w1 = new THREE.Mesh(wingL, birdMat);
    const w2 = new THREE.Mesh(wingR, birdMat);
    b.add(body, w1, w2);
    group.add(b);
    birds.push({
      g: b, w1, w2,
      r: 240 + rng() * 260, h: 150 + rng() * 120,
      sp: (0.06 + rng() * 0.06) * (i % 2 ? 1 : -1),
      a: rng() * 6.28, ph: rng() * 6.28,
    });
  }

  const lampState = { factor: 0 };
  function update(t, dt, camera) {
    clouds.rotation.y += dt * 0.004;
    sunDisc.lookAt(camera.position);
    moonDisc.lookAt(camera.position);
    for (const b of birds) {
      b.a += b.sp * dt;
      const px = Math.cos(b.a) * b.r;
      const pz = Math.sin(b.a) * b.r;
      const py = b.h + Math.sin(t * 0.7 + b.ph) * 8;
      b.g.position.set(px, py, pz);
      const s = Math.sign(b.sp);
      b.g.lookAt(px - Math.sin(b.a) * s, py, pz + Math.cos(b.a) * s);
      const f = Math.sin(t * 9 + b.ph) * 0.55;
      b.w1.rotation.z = f;
      b.w2.rotation.z = -f;
    }
    for (const l of lampLights) l.intensity = lampState.factor * 850;
  }

  return {
    group, skyUniforms, groundMat, trunkMat, leafA, leafB, cloudMat,
    lampHeadMat, haloMat, lampLights, sunDisc, sunMat, sunHalo,
    moonDisc, moonMat, moonHalo, starMat, birdMat,
    getLampFactor: () => lampState.factor,
    setLampFactor: (v) => { lampState.factor = v; },
    update,
  };
}
