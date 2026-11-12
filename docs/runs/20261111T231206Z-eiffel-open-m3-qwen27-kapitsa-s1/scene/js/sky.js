import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOON_DIR } from './palettes.js';
import { toonMat, setRim, addThickness, glowTexture, GRADIENTS } from './toon.js';

// ---------------------------------------------------------------- sky dome
function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: new THREE.Color(0x2b74cc) },
      uMid: { value: new THREE.Color(0x8fd2f2) },
      uBottom: { value: new THREE.Color(0xeaf7ff) },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color(0xfff3c4) },
      uSunDisc: { value: 1 },
      uSunGlow: { value: 0.5 },
      uHorizonGlow: { value: new THREE.Color(0xffffff) },
      uHorizonGlowI: { value: 0 },
      uBands: { value: 4.0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uBottom, uSunDir, uSunColor, uHorizonGlow;
      uniform float uSunDisc, uSunGlow, uHorizonGlowI, uBands;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        // Soft-quantized height bands for a cel-style sky.
        float hb = h;
        if (uBands > 1.0) {
          float q = floor(h * uBands) / uBands;
          float q1 = q + 1.0 / uBands;
          hb = mix(q, q1, smoothstep(q, q + 0.055, h));
        }
        vec3 col = mix(uBottom, uMid, smoothstep(-0.08, 0.2, hb));
        col = mix(col, uTop, smoothstep(0.08, 0.6, hb));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 900.0) * uSunDisc * 1.2 + pow(s, 16.0) * uSunGlow * 0.55 + pow(s, 3.5) * uSunGlow * 0.22);
        col += uHorizonGlow * exp(-abs(h) * 7.0) * uHorizonGlowI;
        gl_FragColor = vec4(col, 1.0);
        gl_FragColor = linearToOutputTexel(gl_FragColor);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

// ---------------------------------------------------------------- stars
function makeStars(rng, count) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const col = new Float32Array(count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    // random point on upper hemisphere
    let v;
    do {
      v = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.1, 1), rng.range(-1, 1));
    } while (v.lengthSq() > 1 || v.lengthSq() < 0.05);
    v.normalize().multiplyScalar(3000);
    pos.set([v.x, v.y, v.z], i * 3);
    size[i] = rng.range(1.4, 3.4);
    phase[i] = rng.range(0, 100);
    c.setHSL(rng.range(0.55, 0.68), rng.range(0.1, 0.5), rng.range(0.75, 1));
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aPhase;
      attribute vec3 aColor;
      uniform float uTime;
      varying vec3 vColor;
      varying float vTw;
      void main() {
        vColor = aColor;
        vTw = 0.55 + 0.45 * sin(uTime * (0.4 + fract(aPhase) * 1.3) + aPhase);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uAlpha;
      varying vec3 vColor;
      varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.12, d) * vTw * uAlpha;
        gl_FragColor = vec4(vColor, a);
        gl_FragColor = linearToOutputTexel(gl_FragColor);
      }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  return { points, mat };
}

// ---------------------------------------------------------------- moon texture
function makeMoonTexture(rng) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0f24';
  ctx.fillRect(0, 0, 128, 128);
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0, '#eef1ff');
  grad.addColorStop(0.75, '#d8ddf2');
  grad.addColorStop(1, '#8a92b8');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(64, 64, 62, 0, 6.29);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,150,190,0.5)';
  for (let i = 0; i < 8; i++) {
    const a = rng.range(0, 6.29);
    const r = rng.range(0, 44);
    ctx.beginPath();
    ctx.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, rng.range(3, 11), 0, 6.29);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- clouds
function makeCloudGeo(rng) {
  const parts = [];
  const n = rng.int(4, 6);
  for (let i = 0; i < n; i++) {
    const r = rng.range(8, 16);
    const g = new THREE.IcosahedronGeometry(r, 1);
    g.scale(1, 0.6, 0.8);
    g.translate(rng.range(-16, 16), rng.range(-4, 5), rng.range(-8, 8));
    addThickness(g, 0.8);
    parts.push(g);
  }
  return mergeGeometries(parts, false);
}

// ---------------------------------------------------------------- birds
function makeBird(rng) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x26222e, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const body = new THREE.ConeGeometry(0.35, 1.7, 5);
  body.rotateZ(-Math.PI / 2);
  const bodyMesh = new THREE.Mesh(body, mat);
  const wingGeo = new THREE.PlaneGeometry(2.6, 1.1);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(0, 0.05, 1.35);
  const wingL = new THREE.Mesh(wingGeo, mat);
  const wingR = new THREE.Mesh(wingGeo, mat);
  wingR.scale.z = -1;
  const g = new THREE.Group();
  g.add(bodyMesh, wingL, wingR);
  g.scale.setScalar(2.2);
  return {
    group: g,
    wingL,
    wingR,
    radius: rng.range(110, 230),
    height: rng.range(150, 290),
    speed: rng.range(0.3, 0.62) * rng.sign(),
    phase: rng.range(0, 6.29),
    flap: rng.range(7, 12),
  };
}

// ---------------------------------------------------------------- build
export function buildSky(ctx) {
  const { rng, glow } = ctx;
  const group = new THREE.Group();

  // Sky dome
  const skyMat = makeSkyMaterial();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3200, 32, 16), skyMat);
  group.add(sky);

  // Stars
  const stars = makeStars(rng, 900);
  group.add(stars.points);

  // Sun
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4, toneMapped: false, fog: false });
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 20, 14), sunMat);
  group.add(sunMesh);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([255, 220, 150]), color: 0xfff3c4,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false,
  }));
  sunSprite.scale.setScalar(900);
  group.add(sunSprite);

  // Moon
  const moonDir = MOON_DIR;
  const moonMat = new THREE.MeshBasicMaterial({ map: makeMoonTexture(rng), toneMapped: false, fog: false });
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(45, 20, 14), moonMat);
  moonMesh.position.copy(moonDir).multiplyScalar(2600);
  group.add(moonMesh);
  const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([190, 205, 255]), color: 0xcdd8ff,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false,
  }));
  moonSprite.position.copy(moonMesh.position);
  moonSprite.scale.setScalar(640);
  group.add(moonSprite);

  // Clouds (close enough to drift visibly across the view; they also cast soft shadows)
  const cloudMat = toonMat({ color: 0xffffff, gradient: GRADIENTS.g3, rimColor: 0xffffff, rimStrength: 0.12 });
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const geo = makeCloudGeo(rng);
    const m = new THREE.Mesh(geo, cloudMat);
    m.castShadow = true;
    const holder = new THREE.Group();
    holder.add(m, new THREE.Mesh(geo, ctx.outlineMat));
    const a = rng.range(0, Math.PI * 2);
    // a mix of near (big, drifts across the view) and far (backdrop) clouds
    const near = i < 3;
    const r = near ? rng.range(280, 680) : rng.range(900, 1300);
    holder.position.set(Math.cos(a) * r, rng.range(230, 430), Math.sin(a) * r);
    holder.scale.setScalar(near ? rng.range(1.8, 2.8) : rng.range(1.2, 2));
    group.add(holder);
    clouds.push({ m: holder, speed: rng.range(5, 9), phase: rng.range(0, 6.29) });
  }

  // Birds
  const birds = [];
  for (let i = 0; i < 6; i++) {
    const b = makeBird(rng);
    group.add(b.group);
    birds.push(b);
  }

  // ---------------------------------------------------------------- palette
  function apply(p) {
    const u = skyMat.uniforms;
    u.uTop.value.copy(p.skyTop);
    u.uMid.value.copy(p.skyMid);
    u.uBottom.value.copy(p.skyBottom);
    u.uSunDir.value.copy(p.sunDir);
    u.uSunColor.value.copy(p.sunColor);
    u.uSunDisc.value = p.sunDiscI;
    u.uSunGlow.value = p.sunGlowI;
    u.uHorizonGlow.value.copy(p.horizonGlow);
    u.uHorizonGlowI.value = p.horizonGlowI;
    stars.mat.uniforms.uAlpha.value = p.starAlpha;

    sunMesh.position.copy(p.sunDir).multiplyScalar(2600);
    sunMesh.scale.setScalar(Math.max(0.0001, p.sunSize));
    sunMat.color.copy(p.sunColor);
    sunSprite.position.copy(sunMesh.position);
    sunSprite.material.opacity = p.sunGlowI;
    sunSprite.scale.setScalar(200 + 900 * p.sunSize);

    moonMesh.visible = p.moonGlowI > 0.02;
    moonSprite.material.opacity = p.moonGlowI * 0.8;

    cloudMat.color.copy(p.cloudColor);
    setRim(cloudMat, p.cloudRim, p.cloudRimI);
  }

  function anim(t, dt, p) {
    stars.mat.uniforms.uTime.value = t;
    for (const c of clouds) {
      c.m.position.x += c.speed * dt;
      if (c.m.position.x > 1500) c.m.position.x = -1500;
      c.m.position.y += Math.sin(t * 0.5 + c.phase) * dt * 3;
    }
    for (const b of birds) {
      const a = b.phase + t * b.speed;
      const x = Math.cos(a) * b.radius;
      const z = Math.sin(a) * b.radius;
      b.group.position.set(x, b.height + Math.sin(t * 0.7 + b.phase) * 9, z);
      const vx = -Math.sin(a) * b.speed;
      const vz = Math.cos(a) * b.speed;
      b.group.rotation.y = Math.atan2(-vz, vx);
      const flap = Math.sin(t * b.flap + b.phase) * 0.7;
      b.wingL.rotation.x = -flap;
      b.wingR.rotation.x = flap;
    }
    sunSprite.scale.setScalar((200 + 900 * p.sunSize) * (1 + 0.03 * Math.sin(t * 0.8)));
  }

  return { group, apply, anim };
}
