import * as THREE from 'three';
import {
  toonMat, merge, outlineMat, boxGeo, cylGeo, coneGeo, icoGeo, sphereGeo,
  makeRadialTexture,
} from './util.js';

/** Paints the grass, plaza and paths on a canvas (seeded speckle). */
function makeGroundTexture(rng) {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const cx = S / 2;
  const U = S / 480; // 240 world units per side -> px per unit

  g.fillStyle = '#74a84e';
  g.fillRect(0, 0, S, S);

  // soft mottling
  for (let i = 0; i < 34; i++) {
    g.fillStyle = i % 2 ? 'rgba(58,102,44,0.10)' : 'rgba(150,196,110,0.12)';
    g.beginPath();
    g.ellipse(
      rng() * S, rng() * S,
      (30 + rng() * 90) * U, (24 + rng() * 70) * U,
      rng() * Math.PI, 0, Math.PI * 2
    );
    g.fill();
  }
  // grass speckle
  const specks = ['rgba(47,88,38,0.5)', 'rgba(122,168,84,0.55)', 'rgba(88,140,60,0.5)'];
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = specks[Math.floor(rng() * specks.length)];
    g.fillRect(rng() * S, rng() * S, 1 + rng() * 2.2, 1 + rng() * 2.2);
  }

  // cross paths
  const pw = 10.5 * U;
  g.fillStyle = '#d3c090';
  g.fillRect(0, cx - pw / 2, S, pw);
  g.fillRect(cx - pw / 2, 0, pw, S);
  g.strokeStyle = 'rgba(150,125,80,0.55)';
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(0, cx - pw / 2); g.lineTo(S, cx - pw / 2);
  g.moveTo(0, cx + pw / 2); g.lineTo(S, cx + pw / 2);
  g.moveTo(cx - pw / 2, 0); g.lineTo(cx - pw / 2, S);
  g.moveTo(cx + pw / 2, 0); g.lineTo(cx + pw / 2, S);
  g.stroke();

  // circular plaza
  const pr = 26.5 * U;
  g.fillStyle = '#d9c69a';
  g.beginPath(); g.arc(cx, cx, pr, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#b7a06e';
  g.lineWidth = 5 * U;
  g.beginPath(); g.arc(cx, cx, pr, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(150,125,80,0.5)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cx, 22 * U, 0, Math.PI * 2); g.stroke();

  // baked-in contact shading at the tower foot
  const gr = g.createRadialGradient(cx, cx, 18 * U, cx, cx, 62 * U);
  gr.addColorStop(0, 'rgba(38,32,20,0.22)');
  gr.addColorStop(1, 'rgba(38,32,20,0)');
  g.fillStyle = gr;
  g.beginPath(); g.arc(cx, cx, 62 * U, 0, Math.PI * 2); g.fill();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function buildWorld({ gradientMap, inkUniform, rng }) {
  const group = new THREE.Group();
  const addOutlined = (list, mat, th) => {
    if (!list.length) return null;
    const geo = merge(list);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    const o = new THREE.Mesh(geo, outlineMat(inkUniform, th));
    o.castShadow = false;
    o.receiveShadow = false;
    group.add(m, o);
    return m;
  };

  // ---- ground -------------------------------------------------------------
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(240, 96).rotateX(-Math.PI / 2),
    toonMat(gradientMap, 0xffffff, { map: makeGroundTexture(rng) })
  );
  ground.receiveShadow = true;
  group.add(ground);

  // ---- trees ---------------------------------------------------------------
  const wood = toonMat(gradientMap, 0x6b4a28);
  const leafA = toonMat(gradientMap, 0x3f8f45);
  const leafB = toonMat(gradientMap, 0x2f7a3d);
  const trunks = [], leavesA = [], leavesB = [];
  let placed = 0, guard = 0;
  const trees = [];
  while (placed < 26 && guard++ < 600) {
    const a = rng() * Math.PI * 2;
    const r = 33 + rng() * 75;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 9.5 || Math.abs(z) < 9.5) continue; // keep the paths clear
    trees.push([x, z, rng()]);
    placed++;
  }
  for (const [x, z, r1] of trees) {
    const s = 0.8 + r1 * 0.9;
    if (r1 > 0.62) { // cypress
      const h = 1.0 * s;
      trunks.push(cylGeo(x, h / 2, z, 0.22 * s, 0.34 * s, h, 6));
      leavesB.push(coneGeo(x, h + 1.9 * s, z, 1.5 * s, 4.2 * s, 7));
    } else { // round tree
      const h = 2.4 * s;
      trunks.push(cylGeo(x, h / 2, z, 0.3 * s, 0.45 * s, h, 6));
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const rr = (1.5 + rng() * 1.3) * s;
        leavesA.push(icoGeo(
          x + (rng() - 0.5) * 1.6 * s,
          h + rr * 0.55 + rng() * s * 0.7,
          z + (rng() - 0.5) * 1.6 * s,
          rr, 0, 0.92
        ));
      }
    }
  }
  addOutlined(trunks, wood, 0.16);
  addOutlined(leavesA, leafA, 0.18);
  addOutlined(leavesB, leafB, 0.18);

  // ---- lamp posts -----------------------------------------------------------
  const lampMat = toonMat(gradientMap, 0x3a352c);
  const bulbMat = toonMat(gradientMap, 0xffd27a);
  bulbMat.emissive = new THREE.Color(0xffb545);
  bulbMat.emissiveIntensity = 0;
  const lampDark = [], lampBulbs = [];
  const glowTex = makeRadialTexture(128);
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, color: 0xffc978, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0, fog: false,
  });
  const lampGlows = [];
  const LAMP_R = 27.5;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8;
    const x = Math.cos(a) * LAMP_R;
    const z = Math.sin(a) * LAMP_R;
    lampDark.push(cylGeo(x, 0.3, z, 0.42, 0.5, 0.6, 8));
    lampDark.push(cylGeo(x, 2.8, z, 0.13, 0.18, 4.6, 6));
    lampDark.push(coneGeo(x, 5.85, z, 0.62, 0.5, 8));
    lampBulbs.push(sphereGeo(x, 5.35, z, 0.5, 10, 8));
    const glow = new THREE.Sprite(glowMat);
    glow.position.set(x, 5.5, z);
    glow.scale.set(5, 5, 1);
    group.add(glow);
    lampGlows.push(glow);
  }
  addOutlined(lampDark, lampMat, 0.08);
  const bulbs = addOutlined(lampBulbs, bulbMat, 0.05);
  if (bulbs) bulbs.castShadow = false;

  // ---- benches ---------------------------------------------------------------
  const benchMat = toonMat(gradientMap, 0x4e3b29);
  const bench = [];
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4 + Math.PI / 8; // same diagonals as lamps, on the plaza rim
    const x = Math.cos(a) * 23.5;
    const z = Math.sin(a) * 23.5;
    const yaw = Math.atan2(-x, -z); // face the tower
    const part = (geo) => {
      geo.rotateY(yaw);
      geo.translate(x, 0, z);
      bench.push(geo);
    };
    part(boxGeo(0, 0.62, 0, 2.6, 0.18, 0.85));
    part(boxGeo(-1.0, 0.3, 0, 0.18, 0.6, 0.7));
    part(boxGeo(1.0, 0.3, 0, 0.18, 0.6, 0.7));
    part(boxGeo(0, 1.05, -0.36, 2.6, 0.62, 0.16));
    part(boxGeo(-1.1, 0.6, -0.36, 0.16, 1.2, 0.16));
    part(boxGeo(1.1, 0.6, -0.36, 0.16, 1.2, 0.16));
  }
  addOutlined(bench, benchMat, 0.1);

  // ---- fountains --------------------------------------------------------------
  const basinMat = toonMat(gradientMap, 0xb8a888);
  const waterMat = toonMat(gradientMap, 0x59c2dd, {
    emissive: 0x0a2e38, emissiveIntensity: 0.6,
  });
  const jetMat = toonMat(gradientMap, 0xeef7ff, {
    emissive: 0x9fd8ff, emissiveIntensity: 0.3,
  });
  const basin = [], water = [];
  const jets = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4;
    const x = Math.cos(a) * 16;
    const z = Math.sin(a) * 16;
    basin.push(cylGeo(x, 0.45, z, 2.7, 2.95, 0.9, 18));
    water.push(cylGeo(x, 0.88, z, 2.45, 2.45, 0.12, 18));
    const jet = new THREE.Mesh(coneGeo(x, 1.55, z, 0.38, 1.5, 8), jetMat);
    jet.castShadow = true;
    group.add(jet);
    jets.push(jet);
  }
  addOutlined(basin, basinMat, 0.1);
  addOutlined(water, waterMat, 0.06);

  // ---- clouds ------------------------------------------------------------------
  const cloudMat = toonMat(gradientMap, 0xffffff);
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const puffs = [];
    const n = 4 + Math.floor(rng() * 3);
    for (let j = 0; j < n; j++) {
      puffs.push(sphereGeo(
        (j - (n - 1) / 2) * (3.2 + rng() * 1.5),
        (rng() - 0.5) * 2.2,
        (rng() - 0.5) * 5.5,
        2.6 + rng() * 3.2, 8, 6
      ));
    }
    const m = new THREE.Mesh(merge(puffs), cloudMat);
    m.castShadow = true;
    // keep the first frame clear of the tower's silhouette corridor
    let px = -170 + rng() * 340;
    let pz = -170 + rng() * 340;
    while (Math.abs(px) < 100 && Math.abs(pz) < 125) {
      px = -170 + rng() * 340;
      pz = -170 + rng() * 340;
    }
    m.position.set(px, 58 + rng() * 34, pz);
    m.scale.setScalar(0.8 + rng() * 0.9);
    group.add(m);
    clouds.push({ mesh: m, speed: 1.0 + rng() * 1.8, phase: rng() * 6.28, baseY: m.position.y });
  }

  // ---- stars ---------------------------------------------------------------------
  const NS = 420;
  const sp = new Float32Array(NS * 3);
  const phase = new Float32Array(NS);
  const ssize = new Float32Array(NS);
  for (let i = 0; i < NS; i++) {
    const a = rng() * Math.PI * 2;
    const y = 0.06 + Math.pow(rng(), 0.6) * 0.94;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    sp.set([Math.cos(a) * rr * 430, y * 430, Math.sin(a) * rr * 430], i * 3);
    phase[i] = rng() * 6.28;
    ssize[i] = 1.4 + rng() * 2.2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(ssize, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOp: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      varying float vA;
      void main() {
        vA = 0.55 + 0.45 * sin(uTime * (0.4 + fract(aPhase) * 0.8) + aPhase * 6.2831);
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uOp;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.08, d) * vA * uOp;
        if (a < 0.01) discard;
        gl_FragColor = vec4(0.87, 0.91, 1.0, a);
      }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -4;
  group.add(stars);

  // ---- sky dome --------------------------------------------------------------------
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color('#3f8fd9') },
      uBot: { value: new THREE.Color('#d6efff') },
      uOrbDir: { value: new THREE.Vector3(0, 1, 0) },
      uGlowCol: { value: new THREE.Color('#fff3cf') },
      uGlowStr: { value: 0.5 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBot;
      uniform vec3 uOrbDir;
      uniform vec3 uGlowCol;
      uniform float uGlowStr;
      varying vec3 vPos;
      void main() {
        vec3 d = normalize(vPos);
        float hgt = d.y;
        vec3 col = mix(uBot, uTop, smoothstep(-0.02, 0.5, hgt));
        float g1 = pow(max(dot(d, uOrbDir), 0.0), 12.0);
        float g2 = pow(max(dot(d, uOrbDir), 0.0), 4.0) * 0.3;
        col += uGlowCol * (g1 * 0.9 + g2) * uGlowStr;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(460, 32, 18), skyMat);
  sky.renderOrder = -10;
  group.add(sky);

  // ---- sun & moon discs + halos ------------------------------------------------------
  const sunMat = new THREE.MeshBasicMaterial({
    color: 0xfff3c8, transparent: true, opacity: 1, fog: false, depthWrite: false,
  });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(15, 28), sunMat);
  sun.renderOrder = -8;
  group.add(sun);

  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xe8eef8, transparent: true, opacity: 0, fog: false, depthWrite: false,
  });
  const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 28), moonMat);
  moon.renderOrder = -8;
  group.add(moon);

  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffe2a8, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  sunGlow.scale.set(150, 150, 1);
  sunGlow.renderOrder = -7;
  group.add(sunGlow);

  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xbcd2ff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  moonGlow.scale.set(85, 85, 1);
  moonGlow.renderOrder = -7;
  group.add(moonGlow);

  // ---- birds on a slow patrol ----------------------------------------------------------
  const birdMat = new THREE.MeshBasicMaterial({
    color: 0x2e2820, side: THREE.DoubleSide, transparent: true, opacity: 1,
  });
  const birds = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    const wr = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.55).translate(0.75, 0, 0), birdMat);
    const wl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.55).translate(-0.75, 0, 0), birdMat);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 1.0), birdMat);
    g.add(wr, wl, body);
    group.add(g);
    birds.push({
      g, wr, wl,
      R: 36 + rng() * 26,
      h: 50 + rng() * 20,
      w: (0.1 + rng() * 0.08) * (rng() < 0.5 ? 1 : -1),
      ph: rng() * 6.28,
      fp: rng() * 6.28,
    });
  }

  return {
    group, sky, sun, sunMat, moon, moonMat, sunGlow, moonGlow,
    stars, starMat, clouds, birds, birdMat,
    lampGlows, glowMat, bulbMat,
    groundMat: ground.material, cloudMat,
    jets,
  };
}
