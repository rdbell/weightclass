import * as THREE from 'three';
import { makeRng } from './rng.js';
import {
  toonMaterial, addOutline, makeGlowTexture, makeGrassTexture,
  makePlazaTexture, makeSunTexture, makeMoonTexture,
} from './materials.js';

// ---------------------------------------------------------------------------
// Everything around the tower: grass, stone plaza and path, swaying toon
// trees, Parisian street lamps (glowing after dark), a fountain at the end
// of the path, drifting clouds, stars, birds, and the sun/moon sprites.
// ---------------------------------------------------------------------------
export function buildEnvironment(ink, gradientMap) {
  const group = new THREE.Group();
  const rng = makeRng(777);

  // ---------------- ground / plaza / path ----------------
  const grassTex = makeGrassTexture(rng);
  grassTex.repeat.set(6, 6);
  const grassMat = toonMaterial('#ffffff', gradientMap, { map: grassTex });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(520, 56), grassMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const plazaTex = makePlazaTexture(rng);
  plazaTex.repeat.set(2, 2);
  const plazaMat = toonMaterial('#ffffff', gradientMap, {
    map: plazaTex,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(96, 56), plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = 0.12;
  plaza.receiveShadow = true;
  group.add(plaza);

  const pathTex = makePlazaTexture(rng);
  pathTex.repeat.set(1, 11);
  const pathMat = toonMaterial('#ffffff', gradientMap, {
    map: pathTex,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  // The path runs along the (1,0,1) diagonal, from the plaza to the fountain.
  const path = new THREE.Mesh(new THREE.PlaneGeometry(17, 200), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.rotation.z = Math.PI / 4;
  path.position.set(139, 0.06, 139);
  path.receiveShadow = true;
  group.add(path);

  // ---------------- trees ----------------
  const trunkMat = toonMaterial('#7a4a28', gradientMap);
  const leafMat = toonMaterial('#4f9e3f', gradientMap);
  const LEAF_BASE = new THREE.Color('#4f9e3f');
  const trees = [];

  function makeTree() {
    const g = new THREE.Group();
    const h = rng.range(7.5, 11.5);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 1.0, h, 7), trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    g.add(trunk);
    addOutline(trunk, 0.12, ink);
    const canopy = new THREE.Group();
    canopy.position.y = h;
    const n = 3 + rng.int(0, 2);
    for (let i = 0; i < n; i++) {
      const r = rng.range(3.0, 4.5);
      // Non-indexed icosahedron => flat per-face normals for the toon look.
      const geo = new THREE.IcosahedronGeometry(r, 0);
      geo.computeVertexNormals();
      const blob = new THREE.Mesh(geo, leafMat);
      blob.position.set(rng.range(-2.2, 2.2), rng.range(0.8, 3.8), rng.range(-2.2, 2.2));
      blob.rotation.set(rng.range(0, 3.1), rng.range(0, 3.1), rng.range(0, 3.1));
      blob.castShadow = true;
      canopy.add(blob);
      addOutline(blob, 0.2, ink);
    }
    g.add(canopy);
    return { group: g, canopy, phase: rng.range(0, Math.PI * 2) };
  }
  function placeTree(x, z) {
    const t = makeTree();
    t.group.position.set(x, 0, z);
    t.group.scale.setScalar(rng.range(1.1, 1.6));
    group.add(t.group);
    trees.push(t);
  }
  // Ring around the plaza (leaving a gap for the path, which runs to the
  // (1,0,1) diagonal, i.e. angle π/4 in the (sin a, cos a) parameterisation).
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rng.range(-0.1, 0.1);
    let da = a - Math.PI / 4;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    if (Math.abs(da) < 0.34) continue;
    const R = rng.range(104, 150);
    placeTree(R * Math.sin(a), R * Math.cos(a));
  }
  // A scatter further out.
  for (let i = 0; i < 10; i++) {
    const a = rng.range(0, Math.PI * 2);
    const R = rng.range(190, 320);
    placeTree(R * Math.sin(a), R * Math.cos(a));
  }

  // ---------------- street lamps ----------------
  const ironMat = toonMaterial('#39424e', gradientMap);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#8a8a76' });
  const glowTex = makeGlowTexture();
  const lamps = [];

  function makeLamp(x, z) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.85, 0.8, 8), ironMat);
    base.position.y = 0.4;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 6.2, 8), ironMat);
    pole.position.y = 3.7;
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.3, 1.0, 8), ironMat);
    head.position.y = 7.1;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.7, 8), ironMat);
    cap.position.y = 7.9;
    for (const m of [base, pole, head, cap]) {
      m.castShadow = true;
      g.add(m);
      addOutline(m, 0.08, ink);
    }
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), bulbMat);
    bulb.position.y = 6.85;
    g.add(bulb);
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex,
        color: '#ffcf6e',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    glow.scale.setScalar(8);
    glow.position.y = 6.85;
    g.add(glow);
    g.position.set(x, 0, z);
    group.add(g);
    lamps.push({ glow, phase: rng.range(0, Math.PI * 2) });
  }
  // Pairs flanking the diagonal path (±14 m from the centreline).
  for (const r of [104, 132, 200]) {
    const c = r / Math.SQRT2;
    makeLamp(c + 10, c - 10);
    makeLamp(c - 10, c + 10);
  }
  // Ring around the plaza, avoiding the path gap at angle π/4.
  for (const a of [-2.4, -1.9, -1.4, 0.39, 1.19, 1.9, 2.4]) {
    makeLamp(104 * Math.sin(a), 104 * Math.cos(a));
  }

  // ---------------- fountain at the end of the path ----------------
  const stoneMat = toonMaterial('#cfc4b0', gradientMap);
  const waterMat = toonMaterial('#5fc4ea', gradientMap, { transparent: true, opacity: 0.92 });
  const WATER_BASE = new THREE.Color('#5fc4ea');
  const fountain = new THREE.Group();
  fountain.position.set(120, 0, 120);
  {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(24, 32), plazaMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.y = 0.14;
    pad.receiveShadow = true;
    fountain.add(pad);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(12, 13.2, 2.0, 26), stoneMat);
    basin.position.y = 1.0;
    basin.castShadow = true;
    basin.receiveShadow = true;
    fountain.add(basin);
    addOutline(basin, 0.2, ink);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(12.1, 0.85, 8, 30), stoneMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 2.0;
    rim.castShadow = true;
    fountain.add(rim);
    addOutline(rim, 0.18, ink);
    const water = new THREE.Mesh(new THREE.CircleGeometry(11.2, 26), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.y = 1.6;
    fountain.add(water);
    fountain.userData.water = water;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.9, 4.6, 10), stoneMat);
    column.position.y = 3.4;
    column.castShadow = true;
    fountain.add(column);
    addOutline(column, 0.15, ink);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), stoneMat);
    top.position.y = 5.9;
    top.scale.y = 0.7;
    fountain.add(top);
    addOutline(top, 0.15, ink);
  }
  const DROP_N = 42;
  const drops = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.34, 6, 5), waterMat, DROP_N
  );
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.frustumCulled = false;
  fountain.add(drops);
  const dropM = new THREE.Matrix4();
  group.add(fountain);

  function updateFountain(t) {
    for (let i = 0; i < DROP_N; i++) {
      const s = (t * 0.42 + i / DROP_N) % 1;
      const a = (i / DROP_N) * Math.PI * 2 + t * 0.12;
      const r = 1.4 + 8.6 * s;
      const y = 5.6 + 5.6 * s - 8.8 * s * s;
      const sc = 1 + 0.8 * s;
      dropM.makeScale(sc, sc * (1 + 0.6 * s), sc);
      dropM.setPosition(Math.cos(a) * r, y, Math.sin(a) * r);
      drops.setMatrixAt(i, dropM);
    }
    drops.instanceMatrix.needsUpdate = true;
    const water = fountain.userData.water;
    water.scale.setScalar(1 + 0.008 * Math.sin(t * 3));
  }

  // ---------------- clouds ----------------
  const cloudMat = toonMaterial('#ffffff', gradientMap);
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const n = 4 + rng.int(0, 2);
    for (let j = 0; j < n; j++) {
      const r = rng.range(6, 11);
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 9, 7), cloudMat);
      blob.position.set(rng.range(-15, 15), rng.range(-2, 3), rng.range(-6, 6));
      blob.scale.y = 0.6;
      g.add(blob);
      addOutline(blob, 0.35, ink);
    }
    const R = rng.range(320, 620);
    const a = rng.range(0, Math.PI * 2);
    g.position.set(R * Math.cos(a), rng.range(170, 330), R * Math.sin(a));
    g.scale.setScalar(rng.range(1.6, 2.8));
    group.add(g);
    clouds.push({ g, speed: rng.range(2, 5), dir: rng.next() < 0.5 ? 1 : -1 });
  }
  function updateClouds(dt) {
    for (const c of clouds) {
      c.g.position.x += c.speed * c.dir * dt;
      if (c.g.position.x > 850) c.g.position.x = -850;
      if (c.g.position.x < -850) c.g.position.x = 850;
    }
  }

  // ---------------- stars ----------------
  const STAR_N = 800;
  const stPos = new Float32Array(STAR_N * 3);
  const stPhase = new Float32Array(STAR_N);
  const stSize = new Float32Array(STAR_N);
  for (let i = 0; i < STAR_N; i++) {
    let x, y, z;
    do {
      x = rng.range(-1, 1);
      y = rng.range(0.08, 1);
      z = rng.range(-1, 1);
    } while (x * x + y * y + z * z > 1);
    const l = Math.hypot(x, y, z);
    stPos[i * 3] = (x / l) * 1450;
    stPos[i * 3 + 1] = (y / l) * 1450;
    stPos[i * 3 + 2] = (z / l) * 1450;
    stPhase[i] = rng.range(0, Math.PI * 2);
    stSize[i] = rng.range(1.8, 3.6);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(stPos, 3));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(stPhase, 1));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(stSize, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#dfe8ff') },
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uOpacity;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.55 + 0.45 * sin(uTime * (0.8 + fract(aPhase) * 1.7) + aPhase * 7.0);
        vA = uOpacity * tw;
        gl_PointSize = aSize * (700.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.08, d) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  group.add(stars);

  // ---------------- birds (daytime circling) ----------------
  const birdMat = new THREE.MeshBasicMaterial({
    color: '#33323e', side: THREE.DoubleSide, transparent: true, opacity: 1,
  });
  const wingGeo = (() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array([0, 0, 0, 1.1, 0.25, 2.6, 2.5, 0.15, 0.7]), 3
      )
    );
    g.computeVertexNormals();
    return g;
  })();
  const birds = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1.7, 5), birdMat);
    body.rotation.z = -Math.PI / 2;
    g.add(body);
    const wR = new THREE.Mesh(wingGeo, birdMat);
    const wL = new THREE.Mesh(wingGeo, birdMat);
    wL.scale.z = -1;
    g.add(wR, wL);
    group.add(g);
    birds.push({
      g, wR, wL,
      R: rng.range(110, 210),
      h: rng.range(140, 240),
      a0: rng.range(0, Math.PI * 2),
      w: rng.range(0.05, 0.11) * (rng.next() < 0.5 ? 1 : -1),
      phase: rng.range(0, Math.PI * 2),
    });
  }
  function updateBirds(t) {
    for (const b of birds) {
      const a = b.a0 + b.w * t;
      const dir = Math.sign(b.w);
      b.g.position.set(
        b.R * Math.sin(a),
        b.h + Math.sin(t * 0.5 + b.phase) * 5,
        b.R * Math.cos(a)
      );
      b.g.rotation.y = dir > 0 ? a : Math.PI - a;
      const flap = Math.sin(t * 9 + b.phase) * 0.55;
      b.wR.rotation.x = flap;
      b.wL.rotation.x = -flap;
    }
  }

  // ---------------- sun & moon sprites ----------------
  const sunMat = new THREE.SpriteMaterial({
    map: makeSunTexture(),
    color: '#fff8dc',
    transparent: true,
    opacity: 1,
    depthWrite: false,
    fog: false,
  });
  const sunSprite = new THREE.Sprite(sunMat);
  sunSprite.scale.setScalar(110);
  group.add(sunSprite);
  const moonMat = new THREE.SpriteMaterial({
    map: makeMoonTexture(rng),
    color: '#e8eeff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const moonSprite = new THREE.Sprite(moonMat);
  moonSprite.scale.setScalar(90);
  group.add(moonSprite);

  return {
    group,
    update(t, dt, s) {
      grassMat.color.copy(s.grassTint);
      plazaMat.color.copy(s.plazaTint);
      pathMat.color.copy(s.plazaTint);
      leafMat.color.copy(LEAF_BASE).multiply(s.treeTint);
      cloudMat.color.copy(s.cloudColor);
      // A little self-illumination keeps the clouds bright and cartoonish
      // instead of shading to grey on their lit side.
      cloudMat.emissive.copy(s.cloudColor).multiplyScalar(0.4);
      waterMat.color.copy(WATER_BASE).multiply(s.waterColor);
      bulbMat.color.copy(s.lampBulb);
      for (const l of lamps) {
        l.glow.material.opacity = s.lampGlow * (0.8 + 0.08 * Math.sin(t * 13 + l.phase));
      }
      starMat.uniforms.uTime.value = t;
      starMat.uniforms.uOpacity.value = s.starOpacity;
      sunMat.color.copy(s.sunTint);
      sunMat.opacity = s.sunSprite;
      sunSprite.scale.setScalar(s.sunScale);
      moonMat.opacity = s.moonSprite;
      sunSprite.position.copy(s.sunDir).multiplyScalar(1400);
      moonSprite.position.copy(s.sunDir).multiplyScalar(1400);
      for (const tr of trees) {
        tr.canopy.rotation.z = Math.sin(t * 0.9 + tr.phase) * 0.045;
        tr.canopy.rotation.x = Math.cos(t * 0.7 + tr.phase) * 0.035;
      }
      updateClouds(dt);
      updateBirds(t);
      birdMat.opacity = s.birdOpacity;
      updateFountain(t);
    },
  };
}
