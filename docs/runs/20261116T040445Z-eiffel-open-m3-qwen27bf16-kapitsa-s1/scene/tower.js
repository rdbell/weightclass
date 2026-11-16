import * as THREE from 'three';
import { makeRng } from './rng.js';
import { toonMaterial, addOutline, makeGlowTexture, makeFlagTexture } from './materials.js';

// ---------------------------------------------------------------------------
// The Eiffel Tower, built procedurally in metres (total height ~330).
//
//  * a Catmull-Rom profile through the real control widths
//      base 125 m  ->  1st floor 70 m @ 57 m  ->  2nd floor 40 m @ 115 m
//      ->  3rd floor 16 m @ 276 m  ->  top 9.6 m @ 300 m
//  * four curved, tapering corner legs
//  * open X-braced lattice on all four faces (instanced boxes)
//  * the four elliptical base arches (double tube)
//  * three platforms, the little dome, the antenna and a blinking beacon
//  * night "sparkle": a wave of twinkling points climbing the lattice
//  * a waving tricolour on the third floor
// ---------------------------------------------------------------------------

const PROFILE = [
  [0, 62.5], [12, 55.5], [26, 48.5], [40, 42.0], [57, 35.0],
  [74, 28.0], [92, 23.5], [115, 20.0],
  [140, 16.5], [165, 14.2], [196, 12.2], [222, 10.8], [248, 9.6], [276, 8.0],
  [288, 6.4], [300, 4.8],
];

function makeProfile(points) {
  const n = points.length;
  const ys = points.map((p) => p[0]);
  return function (y) {
    if (y <= ys[0]) return points[0][1];
    if (y >= ys[n - 1]) return points[n - 1][1];
    let i = 0;
    while (ys[i + 1] < y) i++;
    const p0 = points[Math.max(0, i - 1)][1];
    const p1 = points[i][1];
    const p2 = points[i + 1][1];
    const p3 = points[Math.min(n - 1, i + 2)][1];
    const t = (y - points[i][0]) / (points[i + 1][0] - points[i][0]);
    const w =
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    return Math.max(0.5, w);
  };
}

export function buildTower(ink, gradientMap) {
  const group = new THREE.Group();
  const rng = makeRng(20260116);
  const w = makeProfile(PROFILE);

  const towerMat = toonMaterial('#8a5426', gradientMap);
  const stoneMat = toonMaterial('#b8ab95', gradientMap);

  // Face frames: u = tangent across the face, n = outward normal (x,z pairs).
  const FACES = [
    { ux: 1, uz: 0, nx: 0, nz: 1 },
    { ux: 0, uz: -1, nx: 1, nz: 0 },
    { ux: -1, uz: 0, nx: 0, nz: -1 },
    { ux: 0, uz: 1, nx: -1, nz: 0 },
  ];
  const fp = (f, t, y) => {
    const ww = w(y);
    return { x: f.ux * t * ww + f.nx * ww, y, z: f.uz * t * ww + f.nz * ww };
  };

  // ---------------- lattice bars (one InstancedMesh) ----------------
  const bars = [];
  const pushBar = (a, b, bw) =>
    bars.push({ ax: a.x, ay: a.y, az: a.z, bx: b.x, by: b.y, bz: b.z, w: bw });

  const BANDS = [
    [0, 26], [26, 57],
    [57, 72], [72, 88], [88, 102], [102, 115],
    [115, 133], [133, 152], [152, 172], [172, 196], [196, 220],
    [220, 244], [244, 266], [266, 276],
    [276, 288], [288, 300],
  ];
  const barW = (y) => 2.6 * Math.pow(w(y) / 62.5, 0.5) + 0.3;

  for (const f of FACES) {
    for (const [y0, y1] of BANDS) {
      const mid = (y0 + y1) / 2;
      pushBar(fp(f, -1, y1), fp(f, 1, y1), barW(y1)); // horizontal ring
      pushBar(fp(f, -1, y0), fp(f, 1, y1), barW(mid)); // X bracing
      pushBar(fp(f, 1, y0), fp(f, -1, y1), barW(mid));
      for (const t of [-1 / 3, 1 / 3]) {
        pushBar(fp(f, t, y0), fp(f, t, y1), barW(mid) * 0.8); // verticals
      }
    }
  }

  // Corner legs follow the profile curve.
  const LEG_Y = [0, 15, 30, 45, 57, 72, 88, 105, 115, 133, 152, 172, 196, 220, 244, 266, 276, 286, 293, 300];
  const legW = (y) => 6.5 * Math.pow(w(y) / 62.5, 0.6) + 0.9;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    for (let i = 0; i < LEG_Y.length - 1; i++) {
      const y0 = LEG_Y[i];
      const y1 = LEG_Y[i + 1];
      pushBar(
        { x: sx * w(y0), y: y0, z: sz * w(y0) },
        { x: sx * w(y1), y: y1, z: sz * w(y1) },
        legW((y0 + y1) / 2)
      );
    }
  }

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const lattice = new THREE.InstancedMesh(boxGeo, towerMat, bars.length);
  {
    const M = new THREE.Matrix4();
    const Q = new THREE.Quaternion();
    const S = new THREE.Vector3();
    const P = new THREE.Vector3();
    const UP = new THREE.Vector3(0, 1, 0);
    const A = new THREE.Vector3();
    const B = new THREE.Vector3();
    const D = new THREE.Vector3();
    bars.forEach((bar, i) => {
      A.set(bar.ax, bar.ay, bar.az);
      B.set(bar.bx, bar.by, bar.bz);
      D.subVectors(B, A);
      const len = Math.max(0.001, D.length());
      Q.setFromUnitVectors(UP, D.normalize());
      P.addVectors(A, B).multiplyScalar(0.5);
      S.set(bar.w, len, bar.w * 0.85);
      M.compose(P, Q, S);
      lattice.setMatrixAt(i, M);
    });
    lattice.instanceMatrix.needsUpdate = true;
  }
  lattice.castShadow = true;
  lattice.receiveShadow = true;
  lattice.frustumCulled = false;
  group.add(lattice);
  addOutline(lattice, 0.22, ink);

  // ---------------- the four base arches (double elliptical tubes) ----------------
  for (const f of FACES) {
    for (const [a, b, r] of [[66, 34, 3.0], [58, 30, 2.0]]) {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const th = (Math.PI * i) / 24;
        const x = -a * Math.cos(th);
        const y = b * Math.sin(th);
        const zz = w(Math.max(0, y)) + 0.2;
        pts.push(new THREE.Vector3(f.ux * x + f.nx * zz, y, f.uz * x + f.nz * zz));
      }
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, r, 8),
        towerMat
      );
      tube.castShadow = true;
      tube.receiveShadow = true;
      group.add(tube);
      addOutline(tube, 0.3, ink);
    }
  }

  // ---------------- platforms, dome, antenna ----------------
  function slab(half, thick, y, mat = towerMat, off = 0.35) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(half * 2, thick, half * 2), mat);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    addOutline(m, off, ink);
    return m;
  }
  function rail(half, y, mat = towerMat) {
    for (const [dx, dz] of [[0, half], [half, 0], [0, -half], [-half, 0]]) {
      const alongX = dz !== 0;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(alongX ? half * 2 : 0.5, 1.4, alongX ? 0.5 : half * 2),
        mat
      );
      m.position.set(dx, y, dz);
      m.castShadow = true;
      group.add(m);
      addOutline(m, 0.12, ink);
    }
  }

  // 1st floor
  slab(41, 5, 56.5);
  slab(43, 1.6, 59.9);
  rail(41.5, 61.7);
  // 2nd floor
  slab(22.5, 4, 114.5);
  slab(24, 1.4, 117.5);
  rail(23, 119.2);
  // 3rd floor + dome + lantern
  slab(10.5, 3, 275.5);
  slab(8.5, 1.6, 278.2);
  rail(9, 279.9);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2),
    towerMat
  );
  dome.scale.set(1, 0.55, 1);
  dome.position.y = 278.9;
  dome.castShadow = true;
  group.add(dome);
  addOutline(dome, 0.25, ink);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.7, 2.2, 10), towerMat);
  lantern.position.y = 283.4;
  lantern.castShadow = true;
  group.add(lantern);
  addOutline(lantern, 0.15, ink);
  const lanternCap = new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.6, 10), towerMat);
  lanternCap.position.y = 285.6;
  group.add(lanternCap);
  addOutline(lanternCap, 0.15, ink);
  // top platform + antenna
  slab(5, 1.6, 299.6);
  const ant1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 15, 8), towerMat);
  ant1.position.y = 307.9;
  ant1.castShadow = true;
  group.add(ant1);
  addOutline(ant1, 0.1, ink);
  const ant2 = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 12, 6), towerMat);
  ant2.position.y = 320.9;
  group.add(ant2);
  addOutline(ant2, 0.08, ink);

  // Foundation pads under the legs.
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const pad = new THREE.Mesh(new THREE.BoxGeometry(17, 4.5, 17), stoneMat);
    pad.position.set(sx * 62.5, 2.2, sz * 62.5);
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);
    addOutline(pad, 0.3, ink);
  }

  // ---------------- night sparkle (twinkling points on the lattice) ----------------
  const SPARK_N = 700;
  const sPos = new Float32Array(SPARK_N * 3);
  const sPhase = new Float32Array(SPARK_N);
  const sSize = new Float32Array(SPARK_N);
  for (let i = 0; i < SPARK_N; i++) {
    const f = FACES[i % 4];
    const y = rng.range(4, 298);
    const t = rng.range(-1, 1);
    const ww = w(y) + 0.4;
    sPos[i * 3] = f.ux * t * ww + f.nx * ww;
    sPos[i * 3 + 1] = y;
    sPos[i * 3 + 2] = f.uz * t * ww + f.nz * ww;
    sPhase[i] = rng.range(0, Math.PI * 2);
    sSize[i] = rng.range(1.6, 3.4);
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sparkGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
  sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#ffd98a') },
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSize;
      uniform float uTime;
      uniform float uOpacity;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float tw = 0.5 + 0.5 * sin(uTime * 2.2 + aPhase - position.y * 0.045);
        tw = pow(tw, 3.0);
        vA = uOpacity * (0.25 + 0.75 * tw);
        gl_PointSize = aSize * (340.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d) * vA;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparkle = new THREE.Points(sparkGeo, sparkMat);
  sparkle.frustumCulled = false;
  group.add(sparkle);

  // ---------------- beacon + glow at the antenna tip ----------------
  const beaconMat = new THREE.MeshBasicMaterial({ color: '#ff4444' });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), beaconMat);
  beacon.position.y = 327.9;
  group.add(beacon);
  const glowTex = makeGlowTexture();
  const beaconGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: '#ff5544',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  beaconGlow.scale.setScalar(9);
  beaconGlow.position.y = 327.9;
  group.add(beaconGlow);

  // ---------------- waving tricolour on the 3rd floor ----------------
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 7, 6), stoneMat);
  flagPole.position.set(9, 280.5, 9);
  group.add(flagPole);
  addOutline(flagPole, 0.05, ink);
  const flagGeo = new THREE.PlaneGeometry(4.2, 2.6, 10, 6);
  const flagMat = new THREE.MeshToonMaterial({
    map: makeFlagTexture(),
    gradientMap,
    side: THREE.DoubleSide,
  });
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(9 + 2.1, 283.4, 9);
  flag.rotation.y = -Math.PI / 4;
  group.add(flag);
  const flagBaseX = new Float32Array(flagGeo.attributes.position.count);
  for (let i = 0; i < flagBaseX.length; i++) flagBaseX[i] = flagGeo.attributes.position.getX(i);

  return {
    group,
    towerMat,
    stoneMat,
    update(t, s) {
      // sparkle wave climbing the tower
      sparkMat.uniforms.uTime.value = t;
      sparkMat.uniforms.uOpacity.value = s.sparkle;
      // beacon blink
      const blink = Math.max(0, Math.sin(t * 2.6));
      const b = blink * blink;
      beaconMat.color.setRGB(1, 0.3, 0.25).multiplyScalar(0.25 + 1.4 * b * s.beacon);
      beaconGlow.material.opacity = s.beacon * (0.08 + 0.55 * b);
      // flag
      flagMat.color.copy(s.flagTint);
      const pos = flagGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = flagBaseX[i];
        const k = (x + 2.1) / 4.2;
        pos.setZ(
          i,
          Math.sin(x * 1.7 - t * 7.5) * 0.26 * k + Math.sin(t * 2.1 + 1.3) * 0.06 * k
        );
      }
      pos.needsUpdate = true;
    },
  };
}
