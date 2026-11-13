// Shared material library.  Textures are generated once and re-used; anything
// that needs a different tiling density gets a cheap clone of the same canvas.

import * as THREE from 'three';
import {
  woodMaps,
  plasterCanvas,
  fabricCanvas,
  leatherCanvas,
  rugCanvas,
  stoneCanvas,
  skyCanvas,
  paintingCanvas,
  dotCanvas,
  makeTexture,
} from './textures.js';
import { L } from './layout.js';

export function buildMaterials() {
  const m = {};

  // ---- floor -------------------------------------------------------------
  const floor = woodMaps({
    size: 1024,
    planks: 8,
    rows: 4,
    hue: 0.085,
    sat: 0.27,
    light: 0.33,
    grain: 0.13,
    roughBase: 0.55,
    seed: 'floor',
  });
  m.floor = new THREE.MeshStandardMaterial({
    map: makeTexture(floor.map, { repeat: [2, 3] }),
    roughnessMap: makeTexture(floor.roughness, { repeat: [2, 3], srgb: false }),
    bumpMap: makeTexture(floor.roughness, { repeat: [2, 3], srgb: false }),
    bumpScale: 0.12,
    roughness: 0.62,
    metalness: 0,
    envMapIntensity: 0.35,
  });

  // ---- plaster -----------------------------------------------------------
  const wallCanvas = plasterCanvas({ hue: 0.095, sat: 0.14, light: 0.52, seed: 'wall' });
  const ceilCanvas = plasterCanvas({ hue: 0.085, sat: 0.12, light: 0.55, seed: 'ceil' });
  const plasterCache = new Map();
  m.plaster = function plaster(w, h, { ceiling = false, tint = 0xffffff } = {}) {
    const key = `${ceiling ? 'c' : 'w'}${Math.round(w * 4)}x${Math.round(h * 4)}:${tint}`;
    let mat = plasterCache.get(key);
    if (mat) return mat;
    const src = ceiling ? ceilCanvas : wallCanvas;
    const tex = makeTexture(src, { repeat: [Math.max(0.5, w / 1.6), Math.max(0.5, h / 1.6)] });
    mat = new THREE.MeshStandardMaterial({
      map: tex,
      bumpMap: tex,
      bumpScale: 0.12,
      color: new THREE.Color(tint),
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.2,
    });
    plasterCache.set(key, mat);
    return mat;
  };

  // ---- timbers -----------------------------------------------------------
  function timber(opts) {
    const w = woodMaps(opts);
    return {
      map: makeTexture(w.map, { repeat: opts.repeat || [1, 1] }),
      roughnessMap: makeTexture(w.roughness, { repeat: opts.repeat || [1, 1], srgb: false }),
    };
  }

  const walnut = timber({
    size: 512,
    planks: 3,
    rows: 2,
    hue: 0.06,
    sat: 0.34,
    light: 0.22,
    grain: 0.12,
    roughBase: 0.42,
    repeat: [1.4, 1.4],
    seed: 'walnut',
  });
  m.walnut = new THREE.MeshStandardMaterial({ ...walnut, color: 0x8e7460, roughness: 0.55, metalness: 0.02, envMapIntensity: 0.5 });
  // the mantel takes a picture light straight onto its top: a satin finish keeps
  // that from turning into a mirror
  m.mantelWood = new THREE.MeshStandardMaterial({ ...walnut, color: 0x8a705c, roughness: 0.82, metalness: 0, envMapIntensity: 0.22 });

  const oak = timber({
    size: 512,
    planks: 3,
    rows: 2,
    hue: 0.085,
    sat: 0.36,
    light: 0.36,
    grain: 0.12,
    roughBase: 0.6,
    repeat: [1.2, 1.2],
    seed: 'oak',
  });
  m.oak = new THREE.MeshStandardMaterial({ ...oak, color: 0xb69a78, roughness: 0.7, metalness: 0, envMapIntensity: 0.35 });

  const paintWood = (hex, rough = 0.5) =>
    new THREE.MeshStandardMaterial({ map: makeTexture(fabricCanvas({ size: 128, scale: 12, seed: `pw${hex}` }), { repeat: [3, 3] }), color: hex, roughness: rough, metalness: 0, envMapIntensity: 0.4 });
  m.paintCream = paintWood(0xd9cdb6, 0.5);
  m.paintDark = paintWood(0x2b2f2a, 0.45);

  m.beam = new THREE.MeshStandardMaterial({
    ...timber({ size: 512, planks: 2, rows: 1, hue: 0.07, sat: 0.3, light: 0.2, grain: 0.16, roughBase: 0.75, repeat: [3, 1], seed: 'beam' }),
    color: 0x8a6f52,
    roughness: 0.8,
    envMapIntensity: 0.25,
  });

  // ---- textiles ----------------------------------------------------------
  const cloth = makeTexture(fabricCanvas({ size: 256, scale: 30, seed: 'cloth' }), { repeat: [4, 4] });
  const clothR = makeTexture(fabricCanvas({ size: 256, scale: 30, seed: 'cloth' }), { repeat: [4, 4], srgb: false });
  m.sofaCloth = new THREE.MeshStandardMaterial({ map: cloth, roughnessMap: clothR, color: 0x37493f, roughness: 0.92, metalness: 0, envMapIntensity: 0.25 });
  m.sofaClothLight = m.sofaCloth.clone();
  m.sofaClothLight.color = new THREE.Color(0x45594e);
  m.throwCloth = new THREE.MeshStandardMaterial({ map: cloth, color: 0x9c5033, roughness: 0.95, side: THREE.DoubleSide });
  m.linen = new THREE.MeshStandardMaterial({
    map: makeTexture(fabricCanvas({ size: 256, scale: 26, seed: 'linen' }), { repeat: [9, 16] }),
    color: 0xb3a488,
    roughness: 0.95,
    side: THREE.DoubleSide,
    envMapIntensity: 0.3,
  });

  const leatherTex = makeTexture(leatherCanvas({ seed: 'leather' }), { repeat: [3, 3] });
  m.leather = new THREE.MeshStandardMaterial({ map: leatherTex, color: 0xb07a52, roughness: 0.48, metalness: 0.02, envMapIntensity: 0.7 });

  const rugTex = makeTexture(rugCanvas({ seed: 'rug' }), { repeat: [1, 1], wrap: THREE.ClampToEdgeWrapping });
  m.rug = new THREE.MeshStandardMaterial({ map: rugTex, color: 0xd9bfa6, roughness: 1, metalness: 0, envMapIntensity: 0.2 });
  m.rugSide = new THREE.MeshStandardMaterial({ color: 0x532522, roughness: 1 });

  // ---- fireplace ---------------------------------------------------------
  const stoneTex = makeTexture(stoneCanvas({ seed: 'stone', cols: 6, rows: 10, hue: 0.085, sat: 0.17, light: 0.54 }), { repeat: [1, 1] });
  m.stone = new THREE.MeshStandardMaterial({ map: stoneTex, bumpMap: stoneTex, bumpScale: 0.22, roughness: 0.78, metalness: 0, envMapIntensity: 0.4 });
  m.iron = new THREE.MeshStandardMaterial({ color: 0x14120f, roughness: 0.62, metalness: 0.55, envMapIntensity: 0.6 });
  m.firebrick = new THREE.MeshStandardMaterial({
    map: makeTexture(stoneCanvas({ size: 256, cols: 6, rows: 10, hue: 0.04, sat: 0.42, light: 0.2, seed: 'firebrick' }), { repeat: [2, 2] }),
    color: 0x8a5a44,
    roughness: 0.95,
  });
  m.ash = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 1 });

  // ---- metals & misc -----------------------------------------------------
  m.brass = new THREE.MeshStandardMaterial({ color: 0xb9912f, roughness: 0.42, metalness: 0.85, envMapIntensity: 0.55 });
  m.brassDark = new THREE.MeshStandardMaterial({ color: 0x6f5a29, roughness: 0.42, metalness: 0.9, envMapIntensity: 0.9 });
  m.glass = new THREE.MeshPhysicalMaterial({
    color: 0xbfd2e6,
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.07,
    envMapIntensity: 0.45,
    side: THREE.DoubleSide,
  });
  m.ceramic = new THREE.MeshStandardMaterial({ color: 0xcfc4b0, roughness: 0.35, metalness: 0, envMapIntensity: 0.8 });
  m.ceramicBlue = new THREE.MeshStandardMaterial({ color: 0x4e6b74, roughness: 0.3, envMapIntensity: 0.9 });
  m.paper = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 });
  m.inkMat = new THREE.MeshBasicMaterial({ color: 0x2a241d });
  m.floorDark = new THREE.MeshStandardMaterial({ color: 0x1b1611, roughness: 0.9 });
  m.soot = new THREE.MeshStandardMaterial({ color: 0x100d0b, roughness: 1, metalness: 0 });
  m.paintMid = paintWood(0xbcae95, 0.55);
  m.paintSash = paintWood(0xc8bda6, 0.45);
  m.doorWood = new THREE.MeshStandardMaterial({
    ...timber({ size: 512, planks: 2, rows: 2, hue: 0.075, sat: 0.3, light: 0.3, grain: 0.12, roughBase: 0.5, repeat: [1, 2], seed: 'door' }),
    color: 0x9c8365,
    roughness: 0.55,
    envMapIntensity: 0.4,
  });
  m.runner = new THREE.MeshStandardMaterial({
    map: makeTexture(fabricCanvas({ size: 128, scale: 22, seed: 'runner' }), { repeat: [2, 6] }),
    color: 0x7a3a34,
    roughness: 1,
    envMapIntensity: 0.2,
  });
  m.dust = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 0.016 },
      uFocal: { value: 900 },
      uColor: { value: new THREE.Color(0xffd9a8) },
      uOpacity: { value: 0.72 },
      uDot: { value: null },
    },
    vertexShader: `
      attribute float aPhase;
      attribute float aSpeed;
      uniform float uTime;
      uniform float uSize;
      uniform float uFocal;
      varying float vGlow;
      void main() {
        vec3 p = position;
        p.y += mod(uTime * aSpeed + aPhase, 2.4);
        p.x += sin(uTime * 0.25 + aPhase * 2.1) * 0.10;
        p.z += cos(uTime * 0.19 + aPhase * 1.7) * 0.10;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // uSize is the mote radius in metres, uFocal the focal length in pixels
        float px = uSize * uFocal / max(0.4, -mv.z);
        gl_PointSize = clamp(px * (0.7 + 0.6 * sin(uTime * 1.6 + aPhase * 4.0)), 0.5, 5.5);
        gl_Position = projectionMatrix * mv;
        vGlow = 0.35 + 0.65 * abs(sin(uTime * 1.1 + aPhase * 3.3));
      }
    `,
    fragmentShader: `
      uniform sampler2D uDot;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vGlow;
      void main() {
        float a = texture2D(uDot, gl_PointCoord).a;
        if (a < 0.02) discard;
        gl_FragColor = vec4(uColor * vGlow, a * uOpacity * vGlow);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  m.dust.map = m.dot;
  m.wax = new THREE.MeshStandardMaterial({ color: 0xf0e3c8, roughness: 0.55, emissive: 0x352211, emissiveIntensity: 0.3 });
  m.leaf = new THREE.MeshStandardMaterial({ color: 0x38603a, roughness: 0.6, side: THREE.DoubleSide, envMapIntensity: 0.5 });
  m.soil = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 1 });
  m.pot = new THREE.MeshStandardMaterial({ color: 0x77492f, roughness: 0.75 });
  m.basket = new THREE.MeshStandardMaterial({
    map: makeTexture(fabricCanvas({ size: 128, scale: 26, seed: 'basket' }), { repeat: [3, 2] }),
    color: 0x8a6a3e,
    roughness: 0.9,
    side: THREE.DoubleSide,
  });
  m.firewood = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.85 });
  m.firewoodEnd = new THREE.MeshStandardMaterial({ color: 0xc2a071, roughness: 0.9 });

  // ---- sky & art ---------------------------------------------------------
  m.sky = new THREE.MeshBasicMaterial({
    map: makeTexture(skyCanvas({ seed: 'sky' }), { repeat: [1, 1], wrap: THREE.ClampToEdgeWrapping }),
    toneMapped: true,
  });
  m.art = [0, 1, 2, 3].map((i) =>
    new THREE.MeshStandardMaterial({
      map: makeTexture(paintingCanvas({ seed: `paint${i}`, kind: i % 2 ? 'abstract' : 'landscape' }), {
        repeat: [1, 1],
        wrap: THREE.ClampToEdgeWrapping,
      }),
      roughness: 0.7,
      envMapIntensity: 0.4,
    })
  );
  m.goldLeaf = new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.35, metalness: 0.8, envMapIntensity: 1 });

  m.dot = makeTexture(dotCanvas({}), { repeat: [1, 1], wrap: THREE.ClampToEdgeWrapping });

  // book cover palette
  m.bookPalette = [
    0x7d3b2e, 0x2f4438, 0x8d6f4e, 0x383a52, 0xa9803f, 0x5c3336, 0x2e4a5c, 0x6c5a3a,
    0x93411f, 0x3f3f2f, 0x7a5c86, 0xb0a184, 0x445a46, 0x6a3d5c, 0x2c3e50, 0xc0a15e,
  ].map(
    (c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.78,
        metalness: 0.02,
        envMapIntensity: 0.45,
      })
  );
  m.pages = new THREE.MeshStandardMaterial({ color: 0xd8cbaa, roughness: 0.95 });

  // rug geometry helper values
  m.rugDims = { x: L.rug.x1 - L.rug.x0, z: L.rug.halfZ * 2 };
  m.dust.uniforms.uDot.value = m.dot;
  return m;
}
