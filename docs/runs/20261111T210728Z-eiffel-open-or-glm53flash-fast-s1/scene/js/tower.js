import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, addOutline } from './materials.js';
import { mulberry32 } from './rng.js';

// ---- Eiffel profile: half-width of the tower as a function of height ----
// (stylized real proportions: 125 m base, platforms at 57 / 115 / 196 / 276)
const PTS = [
  [0, 62], [16, 56], [34, 47.5], [52, 40], [70, 32.5], [88, 25.5],
  [104, 18.5], [115, 12.5], [125, 11.2], [150, 10.2], [180, 9.2],
  [210, 8.4], [240, 7.6], [276, 6.8],
];

function slope(k) {
  const n = PTS.length;
  const a = PTS[Math.max(0, k - 1)], b = PTS[k], c = PTS[Math.min(n - 1, k + 1)];
  const s1 = (b[1] - a[1]) / Math.max(1e-6, b[0] - a[0]);
  const s2 = (c[1] - b[1]) / Math.max(1e-6, c[0] - b[0]);
  return (s1 + s2) / 2;
}

export function hwAt(y) {
  y = Math.max(0, Math.min(276, y));
  let i = 0;
  while (i < PTS.length - 2 && PTS[i + 1][0] < y) i++;
  const [u0, v0] = PTS[i], [u1, v1] = PTS[i + 1];
  const h = u1 - u0, t = (y - u0) / h, t2 = t * t, t3 = t2 * t;
  const m0 = slope(i), m1 = slope(i + 1);
  return (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * h * m0
       + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * h * m1;
}

// leg cross-section side, shrinks from 15.5 to 8 over the leg region
const sAt = (y) => 15.5 - 7.5 * Math.pow(Math.min(y, 115) / 115, 0.9);

// ---- swept-square geometry builder (flat shaded, outward winding) ----
function sweepGeometry(pathFn, half, steps, capBottom = true, capTop = true) {
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = pathFn(t);
    rings.push([
      new THREE.Vector3(c.x - half, c.y, c.z - half),
      new THREE.Vector3(c.x + half, c.y, c.z - half),
      new THREE.Vector3(c.x + half, c.y, c.z + half),
      new THREE.Vector3(c.x - half, c.y, c.z + half),
      c.clone(),
    ]);
  }
  const pos = [];
  const push = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const nrm = new THREE.Vector3(), cen = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < steps; i++) {
    const r0 = rings[i], r1 = rings[i + 1];
    const cm = r0[4].clone().add(r1[4]).multiplyScalar(0.5);
    for (let j = 0; j < 4; j++) {
      const a = r0[j], b = r0[(j + 1) % 4], c = r1[(j + 1) % 4], d = r1[j];
      cen.set(0, 0, 0).add(a).add(b).add(c).add(d).multiplyScalar(0.25).sub(cm);
      cen.y = 0;
      nrm.crossVectors(e1.subVectors(b, a), e2.subVectors(c, a));
      if (nrm.dot(cen) < 0) { push(a, c, b); push(a, d, c); }
      else { push(a, b, c); push(a, c, d); }
    }
  }
  const fan = (r, sign) => {
    const c = r[4];
    for (let j = 1; j < 3; j++) {
      const a = r[0], b = r[j], d = r[j + 1];
      nrm.crossVectors(e1.subVectors(b, a), e2.subVectors(d, a));
      if (nrm.y * sign < 0) push(a, d, b); else push(a, b, d);
    }
  };
  if (capBottom) fan(rings[0], -1);
  if (capTop) fan(rings[steps], 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildTower() {
  const group = new THREE.Group();
  const rng = mulberry32(20260703);

  const ironMat = toon('#a87b52');
  const ironDarkMat = toon('#755136');
  const platMat = toon('#cbb28f');
  const railMat = toon('#e9e0c8');

  // ---------------- legs: 4 curved tapering corner-chord trusses ----------------
  const legSteps = 48, legTop = 115;
  const chordGeos = [];
  // chord ring order per leg (distance multipliers of the section):
  // 0: outer-outer, 1: inner-outer, 2: inner-inner, 3: outer-inner
  const RING = [[0, 0], [1, 0], [1, 1], [0, 1]]; // [Xs, Zs] use (hw - Xs*s)
  const legCorner = (sx, sz, j, y) => {
    const hw = hwAt(y), s = sAt(y);
    const x = sx * (hw - RING[j][0] * s);
    const z = sz * (hw - RING[j][1] * s);
    return new THREE.Vector3(x, y, z);
  };
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [Xs, Zs] of RING) {
      chordGeos.push(sweepGeometry((t) => {
        const y = t * legTop;
        const hw = hwAt(y), s = sAt(y);
        return new THREE.Vector3(sx * (hw - Xs * s), y, sz * (hw - Zs * s));
      }, 0.85, legSteps));
    }
  }

  // ---------------- upper column: 4 corner chords 115 -> 276 ----------------
  const colTop = 276, colSteps = 36;
  const colCorner = (j, y) => {
    const hw = hwAt(y);
    const s = [[1, 1], [-1, 1], [-1, -1], [1, -1]][j];
    return new THREE.Vector3(s[0] * hw, y, s[1] * hw);
  };
  for (let j = 0; j < 4; j++) {
    chordGeos.push(sweepGeometry((t) => colCorner(j, t * (colTop - legTop) + legTop), 0.75, colSteps));
  }
  const chords = new THREE.Mesh(mergeGeometries(chordGeos), ironMat);
  chords.castShadow = true;
  addOutline(chords, 0.9);
  group.add(chords);

  // ---------------- bracing (instanced boxes) ----------------
  const braces = []; // {a, b, t}
  const addBrace = (a, b, t) => braces.push({ a, b, t });

  // leg X-lattice every 5 m
  const legLevels = [];
  for (let y = 0; y <= legTop + 0.01; y += 5) legLevels.push(y);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let i = 0; i < legLevels.length; i++) {
      const y = legLevels[i];
      for (let j = 0; j < 4; j++) {
        const j2 = (j + 1) % 4;
        addBrace(legCorner(sx, sz, j, y), legCorner(sx, sz, j2, y), 0.8);
        if (i < legLevels.length - 1) {
          const yn = legLevels[i + 1];
          addBrace(legCorner(sx, sz, j, y), legCorner(sx, sz, j2, yn), 0.78);
          addBrace(legCorner(sx, sz, j2, y), legCorner(sx, sz, j, yn), 0.78);
        }
      }
    }
  }

  // column lattice every 8 m, diagonals sit slightly proud of the faces
  const colLevels = [];
  for (let y = legTop; y <= colTop - 0.01; y += 8) colLevels.push(y);
  const FACE_N = [[0, 0, 1], [-1, 0, 0], [0, 0, -1], [1, 0, 0]];
  for (let i = 0; i < colLevels.length; i++) {
    const y = colLevels[i];
    for (let j = 0; j < 4; j++) {
      const j2 = (j + 1) % 4;
      addBrace(colCorner(j, y), colCorner(j2, y), 0.7);
      if (i < colLevels.length - 1) {
        const yn = colLevels[i + 1];
        const n = FACE_N[j];
        const A = colCorner(j, y), B = colCorner(j2, yn);
        const C = colCorner(j2, y), D = colCorner(j, yn);
        A.x += n[0] * 0.4; A.z += n[2] * 0.4;
        B.x += n[0] * 0.4; B.z += n[2] * 0.4;
        C.x += n[0] * 0.4; C.z += n[2] * 0.4;
        D.x += n[0] * 0.4; D.z += n[2] * 0.4;
        addBrace(A, B, 0.72); addBrace(C, D, 0.72);
      }
    }
  }

  // ---------------- platforms ----------------
  const railBoxes = []; // merged into one mesh per platform
  const addRailBox = (w, h, d, x, y, z) => {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    railBoxes.push(g);
  };
  function buildPlatform(y, thick, halfW, postsEvery = 4.6) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, thick, halfW * 2), platMat);
    slab.position.y = y + thick / 2;
    slab.castShadow = slab.receiveShadow = true;
    addOutline(slab, 1.6);
    group.add(slab);

    const lip = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2 + 2, 1.0, halfW * 2 + 2), railMat);
    lip.position.y = y - 0.5;
    lip.castShadow = true;
    addOutline(lip, 1.1);
    group.add(lip);

    const top = y + thick;
    railBoxes.length = 0;
    for (const [ax, rot] of [[0, 0], [0, 1]]) {
      for (const s of [-1, 1]) {
        // rails along one axis, mirrored on the other via rotation
        const off = s * (halfW - 0.25);
        if (rot === 0) {
          addRailBox(halfW * 2 - 0.5, 0.42, 0.32, 0, top + 1.35, off);
          addRailBox(halfW * 2 - 0.5, 0.3, 0.26, 0, top + 0.78, off);
        } else {
          addRailBox(0.32, 0.42, halfW * 2 - 0.5, off, top + 1.35, 0);
          addRailBox(0.26, 0.3, halfW * 2 - 0.5, off, top + 0.78, 0);
        }
      }
    }
    const rails = new THREE.Mesh(mergeGeometries(railBoxes), railMat);
    rails.castShadow = true;
    addOutline(rails, 0.4);
    group.add(rails);

    // posts
    const n = Math.max(2, Math.round((halfW * 2) / postsEvery));
    for (let side = 0; side < 4; side++) {
      for (let i = 0; i < n; i++) {
        const u = -halfW + 0.3 + (i / (n - 1)) * (halfW * 2 - 0.6);
        let px, pz;
        if (side === 0) { px = u; pz = halfW - 0.25; }
        else if (side === 1) { px = halfW - 0.25; pz = u; }
        else if (side === 2) { px = u; pz = -(halfW - 0.25); }
        else { px = -(halfW - 0.25); pz = u; }
        postMats.push(new THREE.Matrix4().makeTranslation(px, top + 0.75, pz));
      }
    }
  }

  const postMats = [];
  buildPlatform(57, 3.2, 46);
  buildPlatform(115, 2.6, 19);
  buildPlatform(196, 1.8, 10);
  buildPlatform(276, 2.2, 11.5);

  // support struts from legs to first platform corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const y0 = 42, c = hwAt(y0) - sAt(y0) / 2;
    addBrace(
      new THREE.Vector3(sx * c, y0, sz * c),
      new THREE.Vector3(sx * 43.5, 57.6, sz * 43.5),
      1.4,
    );
  }

  // posts InstancedMesh
  const postGeo = new THREE.BoxGeometry(0.3, 1.5, 0.3);
  const posts = new THREE.InstancedMesh(postGeo, ironDarkMat, postMats.length);
  postMats.forEach((m, i) => posts.setMatrixAt(i, m));
  posts.castShadow = true;
  posts.frustumCulled = false;
  group.add(posts);

  // ---------------- bracing InstancedMesh ----------------
  const braceGeo = new THREE.BoxGeometry(1, 1, 1);
  const braceMesh = new THREE.InstancedMesh(braceGeo, ironDarkMat, braces.length);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(), mid = new THREE.Vector3(), scl = new THREE.Vector3();
    braces.forEach((b, i) => {
      dir.subVectors(b.b, b.a);
      const len = dir.length();
      mid.addVectors(b.a, b.b).multiplyScalar(0.5);
      q.setFromUnitVectors(up, dir.normalize());
      scl.set(b.t, len, b.t);
      m.compose(mid, q, scl);
      braceMesh.setMatrixAt(i, m);
    });
  }
  braceMesh.castShadow = true;
  braceMesh.frustumCulled = false;
  group.add(braceMesh);

  // ---------------- ground footings ----------------
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = hwAt(0) - sAt(0) / 2;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(17, 1.6, 17), railMat);
    pad.position.set(sx * c, 0.8, sz * c);
    pad.castShadow = pad.receiveShadow = true;
    addOutline(pad, 0.9);
    group.add(pad);
  }

  // ---------------- the four famous arches ----------------
  {
    const pts = [];
    const y0 = 8, yc = 9, R = 45;
    const thetaEnd = Math.acos((y0 - yc) / R);
    for (let i = 0; i <= 26; i++) {
      const th = -thetaEnd + (i / 26) * 2 * thetaEnd;
      pts.push(new THREE.Vector3(R * Math.sin(th), yc + R * Math.cos(th), 0));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const archGeo = new THREE.TubeGeometry(curve, 40, 1.7, 10, false);
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(archGeo, ironMat);
      a.position.z = s * 46;
      a.castShadow = true;
      addOutline(a, 1.0);
      group.add(a);
      const b = new THREE.Mesh(archGeo, ironMat);
      b.rotation.y = Math.PI / 2;
      b.position.x = s * 46;
      b.castShadow = true;
      addOutline(b, 1.0);
      group.add(b);
    }
  }

  // ---------------- antenna + beacon + flag ----------------
  const beaconMat = toon('#8a2430', { emissive: new THREE.Color('#ff4a4a'), emissiveIntensity: 0.1 });
  const mast = [
    [1.1, 276, 294], [0.7, 294, 308], [0.42, 308, 320],
  ];
  for (const [r, y0, y1] of mast) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.25, y1 - y0, 10), ironMat);
    seg.position.y = (y0 + y1) / 2;
    seg.castShadow = true;
    addOutline(seg, 0.5);
    group.add(seg);
  }
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 12), platMat);
  disc.position.y = 300;
  disc.castShadow = true;
  group.add(disc);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 10), beaconMat);
  beacon.position.y = 321.4;
  addOutline(beacon, 0.5);
  group.add(beacon);

  // tricolor flag
  const flagCanvas = document.createElement('canvas');
  flagCanvas.width = 96; flagCanvas.height = 64;
  {
    const g = flagCanvas.getContext('2d');
    g.fillStyle = '#1f3f8f'; g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#f6f4ee'; g.fillRect(32, 0, 32, 64);
    g.fillStyle = '#d8352c'; g.fillRect(64, 0, 32, 64);
  }
  const flagTex = new THREE.CanvasTexture(flagCanvas);
  flagTex.colorSpace = THREE.SRGBColorSpace;
  const flagGeo = new THREE.PlaneGeometry(9, 5.5, 14, 6);
  flagGeo.translate(4.5, 0, 0);
  const flag = new THREE.Mesh(flagGeo, toon('#ffffff', { map: flagTex, side: THREE.DoubleSide }));
  flag.position.set(0.6, 315.6, 0);
  flag.castShadow = true;
  group.add(flag);

  // ---------------- night sparkle ----------------
  const sparklePos = [];
  for (let i = 0; i < 260; i++) {
    const y = rng() * 274 + 1;
    const hw = hwAt(y);
    const p = new THREE.Vector3();
    if (y < 115) {
      const s = sAt(y);
      const sx = rng() < 0.5 ? -1 : 1, sz = rng() < 0.5 ? -1 : 1;
      const u = hw - rng() * s;
      if (rng() < 0.5) p.set(sx * (hw + 0.5), y, sz * u);
      else p.set(sx * u, y, sz * (hw + 0.5));
    } else {
      const f = (rng() * 4) | 0;
      const sign = f < 2 ? 1 : -1;
      const u = (rng() * 2 - 1) * hw;
      if (f % 2) p.set(u, y, sign * (hw + 0.4));
      else p.set(sign * (hw + 0.4), y, u);
    }
    sparklePos.push(p.x, p.y, p.z);
  }
  const sparkleGeo = new THREE.BufferGeometry();
  sparkleGeo.setAttribute('position', new THREE.Float32BufferAttribute(sparklePos, 3));
  const phases = new Float32Array(260);
  for (let i = 0; i < 260; i++) phases[i] = rng();
  sparkleGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const sparkleMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aPhase;
      uniform float uTime;
      varying float vA;
      void main(){
        float tw = 0.5 + 0.5 * sin(uTime * 2.6 + aPhase * 6.2831);
        vA = 0.25 + 0.75 * pow(tw, 3.0);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = (560.0 / -mv.z) * (0.8 + vA * 1.7);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      varying float vA;
      uniform float uOpacity;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float m = smoothstep(0.5, 0.08, length(d));
        gl_FragColor = vec4(vec3(1.0, 0.85, 0.5) * (0.4 + vA), m * vA * uOpacity);
      }`,
  });
  const sparkles = new THREE.Points(sparkleGeo, sparkleMat);
  sparkles.frustumCulled = false;
  group.add(sparkles);

  // golden floodlights up the spine at night
  const glowLights = [];
  for (const y of [85, 155, 235, 305]) {
    const pl = new THREE.PointLight('#ffb45e', 0, 210, 2);
    pl.position.set(0, y, 0);
    group.add(pl);
    glowLights.push(pl);
  }
  const glowState = { factor: 0 };

  // ---------------- little cabins for life ----------------
  function cabin(x, y, z, w, h, d, rot) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), railMat);
    c.position.set(x, y, z);
    c.rotation.y = rot;
    c.castShadow = c.receiveShadow = true;
    addOutline(c, 0.7);
    group.add(c);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.6, d + 1.4), platMat);
    roof.position.set(x, y + h / 2 + 0.3, z);
    roof.rotation.y = rot;
    roof.castShadow = true;
    addOutline(roof, 0.6);
    group.add(roof);
  }
  cabin(26, 62.3, 12, 7, 4.2, 6, 0.35);
  cabin(-7, 118.9, 6, 5, 3, 5, 0.6);
  cabin(3, 279.6, -3, 4.5, 2.8, 4.5, -0.4);

  function update(t, mode) {
    sparkleMat.uniforms.uTime.value = t;
    // waving flag
    const p = flagGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const w = Math.sin(x * 0.85 - t * 5.2) * 0.5 + Math.sin(x * 1.7 - t * 3.1) * 0.22;
      p.setZ(i, w * Math.pow(Math.max(x, 0.001) / 9, 1.3) * 0.9);
    }
    p.needsUpdate = true;
    flagGeo.computeVertexNormals();
    flag.rotation.y = Math.sin(t * 0.25) * 0.5 + 0.2;
    // beacon blink
    beaconMat.emissiveIntensity = mode === 'night' ? 0.9 + 0.8 * Math.sin(t * 4.2)
      : mode === 'dusk' ? 0.4 : 0.08;
  }

  return {
    group, ironMat, ironDarkMat, platMat, railMat, sparkleMat,
    getGlowFactor: () => glowState.factor,
    setGlowFactor: (v) => {
      glowState.factor = v;
      for (const l of glowLights) l.intensity = v * 800;
    },
    update,
  };
}
