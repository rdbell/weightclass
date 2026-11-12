import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Time-of-day palettes. Everything the lighting rig + materials need to swing
// between Day, Dusk and Night lives here.
// ---------------------------------------------------------------------------

const RAW = {
  day: {
    skyTop: 0x2e9be8, skyMid: 0x7fcbf5, skyHor: 0xd9f0f7,
    glowColor: 0xfff3b0, glowI: 0.4,
    fog: 0xc6e6f2,
    sunColor: 0xfff0b5, sunIntensity: 2.4, sunPos: [65, 85, 40],
    hemiSky: 0xcfe8ff, hemiGnd: 0x8cba68, hemiInt: 0.9,
    iron: 0xa06a38, ironEI: 0.0,
    deck: 0xc79c60, grass: 0x7cc952, baseGrass: 0x6dbb4a, stone: 0xe7d7a4,
    wallTint: 0xffffff, roofTint: 0xffffff, trunkTint: 0xffffff, foliageTint: 0xffffff,
    water: 0x58c0dd, cloud: 0xffffff,
    star: 0, sunOp: 1, moonOp: 0,
    lampGlow: 0, windowGlow: 0, spotI: 0, poolOp: 0,
    hull: 0x2a1c10,
  },
  dusk: {
    skyTop: 0x6a4a9c, skyMid: 0xef7d4c, skyHor: 0xffd9a1,
    glowColor: 0xffcf8f, glowI: 0.9,
    fog: 0xeab384,
    sunColor: 0xffb45c, sunIntensity: 2.0, sunPos: [110, 14, -30],
    hemiSky: 0xeab4cf, hemiGnd: 0x7c6a55, hemiInt: 0.65,
    iron: 0x99613a, ironEI: 0.15,
    deck: 0xc08b55, grass: 0xb3a05c, baseGrass: 0xa08c50, stone: 0xd9b184,
    wallTint: 0xffddb5, roofTint: 0xeda184, trunkTint: 0xd3a077, foliageTint: 0xd9a263,
    water: 0xe08f5c, cloud: 0xffd4ae,
    star: 0.35, sunOp: 1, moonOp: 0,
    lampGlow: 0.6, windowGlow: 0.55, spotI: 0, poolOp: 0.25,
    hull: 0x331c14,
  },
  night: {
    skyTop: 0x0a1028, skyMid: 0x1c2b52, skyHor: 0x33466e,
    glowColor: 0xc2d4ff, glowI: 0.35,
    fog: 0x131b34,
    sunColor: 0xa9c3ff, sunIntensity: 0.9, sunPos: [-70, 80, -35],
    hemiSky: 0x35426c, hemiGnd: 0x232a40, hemiInt: 0.6,
    iron: 0x4e4458, ironEI: 0.5,
    deck: 0x5b536e, grass: 0x3e5c80, baseGrass: 0x35526e, stone: 0x4e5878,
    wallTint: 0x5c648e, roofTint: 0x505682, trunkTint: 0x6a74a0, foliageTint: 0x7788b8,
    water: 0x26406e, cloud: 0x3e4c78,
    star: 1, sunOp: 0, moonOp: 1,
    lampGlow: 1, windowGlow: 1, spotI: 1, poolOp: 0.4,
    hull: 0x0c1122,
    water: 0x2c4a7c,
  },
};

const COLOR_KEYS = new Set([
  'skyTop', 'skyMid', 'skyHor', 'glowColor', 'fog', 'sunColor',
  'hemiSky', 'hemiGnd', 'iron', 'deck', 'grass', 'baseGrass', 'stone',
  'wallTint', 'roofTint', 'trunkTint', 'foliageTint', 'water', 'cloud', 'hull',
]);
const VEC_KEYS = new Set(['sunPos']);

function normalize(raw) {
  const out = {};
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    if (VEC_KEYS.has(k)) out[k] = new THREE.Vector3(v[0], v[1], v[2]);
    else if (COLOR_KEYS.has(k)) out[k] = new THREE.Color(v);
    else out[k] = v;
  }
  return out;
}

export const PALETTES = {};
for (const k of Object.keys(RAW)) PALETTES[k] = normalize(RAW[k]);

export function clonePalette(p) {
  const out = {};
  for (const k of Object.keys(p)) {
    const v = p[k];
    out[k] = (v && v.isColor) ? v.clone() : (v && v.isVector3) ? v.clone() : v;
  }
  return out;
}

export function blendPalette(a, b, t, out) {
  for (const k of Object.keys(a)) {
    const va = a[k], vb = b[k];
    if (va && va.isColor) out[k].copy(va).lerp(vb, t);
    else if (va && va.isVector3) out[k].copy(va).lerp(vb, t);
    else out[k] = va + (vb - va) * t;
  }
}