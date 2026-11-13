// A fire: coal bed, crossed logs, shader flames, embers and the flickering
// light that goes with them.

import * as THREE from 'three';
import { L } from './layout.js';
import { box, cyl, sphere } from './geo.js';
import { stream } from './rng.js';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSeed;
  uniform float uStrength;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float s = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.04; a *= 0.5; }
    return s;
  }

  void main() {
    vec2 uv = vUv;
    float h = uv.y;
    float n = fbm(vec2(uv.x * 3.4 + uSeed, uv.y * 2.2 - uTime * 1.55));
    float n2 = fbm(vec2(uv.x * 7.0 - uSeed, uv.y * 4.0 - uTime * 2.6));
    float dx = abs(uv.x - 0.5) * (1.0 + h * 1.7);
    float body = (1.0 - h) - dx * 1.45;
    body += (n - 0.5) * (0.3 + 0.75 * h) + (n2 - 0.5) * 0.18 * h;
    float a = smoothstep(0.02, 0.4, body);
    a *= smoothstep(1.0, 0.42, h);          // melt away at the top
    a *= smoothstep(0.0, 0.10, h);          // and at the very base
    a *= uStrength;
    vec3 col = mix(vec3(1.00, 0.52, 0.10), vec3(1.00, 0.86, 0.42), clamp(body * 1.6, 0.0, 1.0));
    col = mix(vec3(0.55, 0.12, 0.02), col, smoothstep(0.0, 0.30, body));
    col = mix(col, vec3(1.0, 0.98, 0.88), pow(clamp(body - 0.45, 0.0, 1.0), 2.0));
    gl_FragColor = vec4(col * a * 1.35, a);
  }
`;

export function buildFire(m) {
  const rng = stream('fire');
  const f = L.fire;
  const g = new THREE.Group();
  g.name = 'fire';
  const bedY = f.opening.y0 + 0.02;
  const cx = (f.faceX + f.cavityBackX) / 2 + 0.04;

  // coal bed
  const bed = box(m.ash, f.cavityBackX - 0.06 - (f.faceX + 0.04), 0.03, 0.86, (f.faceX + 0.04 + f.cavityBackX - 0.06) / 2, bedY, 0, {
    cast: false,
    receive: true,
  });
  g.add(bed);
  for (let i = 0; i < 16; i++) {
    const s = sphere(m.iron, rng.range(0.018, 0.035), 0, 0, 0, { seg: 8, cast: false });
    s.position.set(cx + rng.range(-0.16, 0.18), bedY + 0.03, rng.range(-0.34, 0.34));
    s.material = new THREE.MeshStandardMaterial({
      color: 0x1c0a05,
      emissive: new THREE.Color(0xff5a12),
      emissiveIntensity: rng.range(1.2, 3.4),
      roughness: 1,
    });
    g.add(s);
  }

  // grate bars
  for (const z of [-0.3, -0.1, 0.1, 0.3]) {
    g.add(box(m.iron, 0.5, 0.05, 0.022, cx, bedY + 0.045, z, { cast: false }));
  }

  // logs: one bed of logs along z, two above at an angle
  const logMat = m.firewood;
  const logs = [];
  function log(x, y, z, len, r, rotX, rotZ) {
    const mesh = cyl(logMat, r * 0.8, r, len, x, y, z, { seg: 10 });
    mesh.rotation.set(rotX, 0, rotZ);
    mesh.castShadow = false;
    g.add(mesh);
    const end = new THREE.Mesh(new THREE.CircleGeometry(r * 0.82, 10), m.firewoodEnd);
    end.position.set(0, -len / 2 - 0.001, 0);
    end.rotation.x = -Math.PI / 2;
    mesh.add(end);
    logs.push(mesh);
    return mesh;
  }
  log(cx - 0.02, bedY + 0.09, -0.18, 0.6, 0.055, Math.PI / 2, 0.05);
  log(cx + 0.04, bedY + 0.09, 0.16, 0.58, 0.05, Math.PI / 2, -0.06);
  log(cx, bedY + 0.2, 0.0, 0.54, 0.052, Math.PI / 2, 0.02);
  log(cx + 0.02, bedY + 0.28, 0.02, 0.42, 0.044, Math.PI / 2 + 0.28, 0.4);
  // glowing seams between the logs
  for (let i = 0; i < 7; i++) {
    const s = sphere(m.iron, rng.range(0.02, 0.038), 0, 0, 0, { seg: 8, cast: false });
    s.material = new THREE.MeshStandardMaterial({
      color: 0x2a0d02,
      emissive: new THREE.Color(0xff7a1e),
      emissiveIntensity: rng.range(2.5, 6),
      roughness: 1,
    });
    s.position.set(cx + rng.range(-0.07, 0.09), bedY + rng.range(0.09, 0.3), rng.range(-0.24, 0.24));
    g.add(s);
  }

  // flames: crossed billboards
  const flames = [];
  function flame(w, h, x, y, z, ry, seed, strength) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: seed }, uSeed: { value: seed * 3.7 }, uStrength: { value: strength } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.rotation.y = ry;
    mesh.renderOrder = 3;
    g.add(mesh);
    flames.push(mat);
    return mesh;
  }
  const baseY = bedY + 0.1;
  flame(0.62, 0.5, cx, baseY, 0, 0, 0.0, 1.0);
  flame(0.62, 0.44, cx, baseY, 0, Math.PI / 2, 1.7, 0.85);
  flame(0.4, 0.36, cx - 0.02, baseY, -0.22, 0.4, 3.1, 0.6);
  flame(0.36, 0.34, cx + 0.03, baseY, 0.2, -0.5, 4.9, 0.6);
  flame(0.3, 0.5, cx + 0.06, baseY, 0.0, Math.PI / 3, 6.3, 0.42);

  // soft glow sprite for the bloom pass to catch
  const glowTex = m.dot;
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, color: 0xff8a34, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.6 })
  );
  glow.position.set(cx + 0.02, baseY + 0.2, 0);
  glow.scale.set(1.5, 1.5, 1);
  g.add(glow);

  // the fire's own light, sitting in the mouth of the chimney
  const light = new THREE.PointLight(0xff7b2e, 12, 7.5, 2);
  light.position.set(f.faceX + 0.16, f.opening.y0 + 0.3, 0);
  g.add(light);
  const spill = new THREE.PointLight(0xffb066, 3.2, 4.5, 2);
  spill.position.set(f.faceX + 0.7, 0.55, 0);
  g.add(spill);

  // A wide shallow spot throws the firelight across the floor, and its target
  // wanders: this is the light that dances on the rug and the sofa front.
  const dance = new THREE.SpotLight(0xff8f3d, 12, 8.0, 0.62, 0.95, 2);
  dance.position.set(f.faceX + 0.06, f.opening.y0 + 0.5, 0);
  dance.target.position.set(1.6, 0.02, 0);
  g.add(dance, dance.target);

  // mantel things that lean on the fireplace: a pair of pokers in a stand
  const standX = f.faceX + 0.06;
  const pokers = [-0.92, -1.06];
  for (let i = 0; i < pokers.length; i++) {
    const p = cyl(m.brassDark, 0.008, 0.011, 0.72, standX + 0.02, 0.36, pokers[i], { seg: 8 });
    p.rotation.x = i ? -0.05 : 0.05;
    g.add(p);
  }

  // --- embers: sparks carried up the flue, always on the move -------------
  const SPARKS = 80;
  const sparkGeo = new THREE.BufferGeometry();
  {
    const pos = new Float32Array(SPARKS * 3);
    const phase = new Float32Array(SPARKS);
    const speed = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i++) {
      pos[i * 3] = rng.range(f.backX + 0.25, f.faceX - 0.05);
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = rng.range(f.opening.z0 + 0.12, f.opening.z1 - 0.12);
      phase[i] = rng.next();
      speed[i] = rng.range(0.3, 0.75);
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    sparkGeo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    sparkGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
  }
  const sparkMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 0.012 },
      uFocal: { value: 900 },
      uPixel: { value: 1 },
      uStrength: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aSpeed;
      uniform float uTime;
      uniform float uSize;
      uniform float uFocal;
      uniform float uPixel;
      uniform float uStrength;
      varying float vA;
      varying float vRise;
      void main() {
        const float span = 1.2;
        vec3 p = position;
        float rise = fract(uTime * aSpeed / span + aPhase);
        p.y = 0.24 + rise * span;
        p.x += sin(uTime * 1.9 + aPhase * 31.0) * 0.06 * rise;
        p.z += cos(uTime * 1.5 + aPhase * 23.0) * 0.07 * rise;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(uSize * uFocal * uPixel / max(0.4, -mv.z), 0.5, 3.4);
        gl_Position = projectionMatrix * mv;
        vRise = rise;
        vA = uStrength * smoothstep(0.0, 0.12, rise) * pow(1.0 - rise, 1.7) *
             (0.4 + 0.6 * abs(sin(uTime * 5.0 + aPhase * 40.0)));
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vA;
      varying float vRise;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float a = smoothstep(0.5, 0.06, length(d));
        vec3 hot = vec3(1.0, 0.85, 0.5);
        vec3 cool = vec3(0.85, 0.28, 0.08);
        gl_FragColor = vec4(mix(hot, cool, vRise), vA * a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.name = 'embers';
  sparks.frustumCulled = false;
  g.add(sparks);

  function update(t) {
    // a slow swell under the quick flicker: the fire breathes as the logs settle
    const swell = 0.9 + 0.13 * Math.sin(t * 1.15 + 0.9) + 0.05 * Math.sin(t * 0.53);
    const flick =
      swell +
      0.16 * Math.sin(t * 6.9) +
      0.11 * Math.sin(t * 2.9 + 1.3) +
      0.07 * Math.sin(t * 12.7 + 0.4) +
      0.05 * Math.sin(t * 21.3 + 2.1);
    const k = Math.max(0.45, Math.min(1.35, flick));
    light.intensity = 8.5 * k;
    spill.intensity = 2.2 * k;
    dance.intensity = 9 * k;
    // the sweep periods are deliberately not near 3 s, so the light is always
    // somewhere new rather than keep pace with a stopwatch
    dance.target.position.set(
      1.85 + 0.72 * Math.sin(t * 0.9) + 0.38 * Math.sin(t * 2.6 + 1.1),
      0.02,
      0.68 * Math.sin(t * 1.3 + 0.4) + 0.42 * Math.sin(t * 2.2)
    );
    for (const mat of flames) {
      mat.uniforms.uTime.value = t;
      mat.uniforms.uStrength.value = Math.min(1.45, Math.max(0.6, 0.7 + 0.55 * (k - 0.72)));
    }
    glow.material.opacity = 0.45 + 0.25 * (k - 0.6);
    const s = 1.35 + 0.35 * k;
    glow.scale.set(s, s * 1.05, 1);
    // the slow term only: the quick flicker stays at the hearth, while this is
    // what the rest of the room is allowed to breathe with
    return swell;
  }

  return { group: g, update, light };
}
