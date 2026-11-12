import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);

// Compass azimuth: 0 = north (-z), 90 = east (+x). Elevation in degrees.
function sdir(elevDeg, azDeg) {
  const e = THREE.MathUtils.degToRad(elevDeg);
  const a = THREE.MathUtils.degToRad(azDeg);
  return new THREE.Vector3(
    Math.sin(a) * Math.cos(e),
    Math.sin(e),
    -Math.cos(a) * Math.cos(e)
  ).normalize();
}

// Shared moon position (low in the NNW sky so it's visible from the default view).
export const MOON_DIR = sdir(15, 335);

export const PALETTES = {
  day: {
    skyTop: C(0x2b74cc), skyMid: C(0x8fd2f2), skyBottom: C(0xeaf7ff),
    horizonGlow: C(0xffffff), horizonGlowI: 0.0,
    sunDir: sdir(52, 218), sunColor: C(0xfff3c4),
    sunDiscI: 1.0, sunGlowI: 0.5, sunSize: 1.0,
    sunIntensity: 2.5,
    moonIntensity: 0.0, moonGlowI: 0.0,
    hemiSky: C(0xcfe9ff), hemiGround: C(0x9cc98a), hemiIntensity: 0.9,
    fogColor: C(0xd9efff), fogDensity: 0.00034,
    ironColor: C(0x9a5f36), ironEmissive: C(0x000000), ironEmissiveI: 0.0,
    ironRim: C(0xffe2b0), ironRimI: 0.2,
    platColor: C(0xa86e42), platRim: C(0xffe2b0), platRimI: 0.16,
    leafColor: C(0x46a45e), trunkColor: C(0x7c4a2c),
    groundTint: C(0xffffff),
    cloudColor: C(0xffffff), cloudRim: C(0xffffff), cloudRimI: 0.12,
    waterColor: C(0x3f92d6), waterEmissive: C(0x000000), waterEmissiveI: 0.0,
    windowColor: C(0x28303e),
    lampColor: C(0x565b68), lampLight: 0.0,
    starAlpha: 0.0,
    outlineColor: C(0x382a3e),
    buildingTint: C(0xffffff), buildingGlow: 0.0,
    beaconI: 0.15,
    baseLightI: 0.0,
    reflectionI: 0.0,
    shadowSize: 450,
  },

  dusk: {
    skyTop: C(0x35306e), skyMid: C(0xb05a86), skyBottom: C(0xffa25e),
    horizonGlow: C(0xffb066), horizonGlowI: 0.55,
    sunDir: sdir(8, 262), sunColor: C(0xff8a3a),
    sunDiscI: 1.2, sunGlowI: 0.95, sunSize: 1.7,
    sunIntensity: 1.5,
    moonIntensity: 0.12, moonGlowI: 0.18,
    hemiSky: C(0x8a6aa8), hemiGround: C(0x584a6e), hemiIntensity: 0.55,
    fogColor: C(0xb46a92), fogDensity: 0.0004,
    ironColor: C(0x7a4a3c), ironEmissive: C(0xff8a3d), ironEmissiveI: 0.1,
    ironRim: C(0xff9a5e), ironRimI: 0.5,
    platColor: C(0x8a5244), platRim: C(0xff9a5e), platRimI: 0.4,
    leafColor: C(0x3e8264), trunkColor: C(0x5e3a32),
    groundTint: C(0xcfa0b4),
    cloudColor: C(0xf0a4c0), cloudRim: C(0xffb0a0), cloudRimI: 0.4,
    waterColor: C(0x6a5a9e), waterEmissive: C(0x5a3a6e), waterEmissiveI: 0.18,
    windowColor: C(0xd88a4a),
    lampColor: C(0xffc06a), lampLight: 0.55,
    starAlpha: 0.25,
    outlineColor: C(0x2e2038),
    buildingTint: C(0xb890b8), buildingGlow: 0.45,
    beaconI: 0.6,
    baseLightI: 0.45,
    reflectionI: 0.25,
    shadowSize: 1300,
  },

  night: {
    skyTop: C(0x0a1030), skyMid: C(0x1a2a52), skyBottom: C(0x2c4270),
    horizonGlow: C(0xd98a5e), horizonGlowI: 0.13,
    sunDir: sdir(0, 0), sunColor: C(0x000000),
    sunDiscI: 0.0, sunGlowI: 0.0, sunSize: 0.0,
    sunIntensity: 0.0,
    moonIntensity: 0.5, moonGlowI: 1.0,
    hemiSky: C(0x2c3d6e), hemiGround: C(0x1a2140), hemiIntensity: 0.65,
    fogColor: C(0x111b3a), fogDensity: 0.00046,
    ironColor: C(0x584a60), ironEmissive: C(0xffa040), ironEmissiveI: 0.5,
    ironRim: C(0x8fb8ff), ironRimI: 0.4,
    platColor: C(0x5e4a68), platRim: C(0x8fb8ff), platRimI: 0.35,
    leafColor: C(0x2a5070), trunkColor: C(0x33305a),
    groundTint: C(0x46539a),
    cloudColor: C(0x44548a), cloudRim: C(0x6a7ab8), cloudRimI: 0.3,
    waterColor: C(0x1c2f5e), waterEmissive: C(0x2a4a8a), waterEmissiveI: 0.3,
    windowColor: C(0xffc873),
    lampColor: C(0xffd98a), lampLight: 1.0,
    starAlpha: 1.0,
    outlineColor: C(0x14102a),
    buildingTint: C(0x3a4670), buildingGlow: 1.0,
    beaconI: 1.0,
    baseLightI: 1.0,
    reflectionI: 0.8,
    shadowSize: 500,
  },
};

export function clonePalette(p) {
  const out = {};
  for (const key in p) {
    const v = p[key];
    out[key] = v.isColor ? v.clone() : v.isVector3 ? v.clone() : v;
  }
  return out;
}

// Lerp palette `a` toward `b` by t, writing into `out` (reused each frame).
export function lerpPalette(a, b, t, out) {
  for (const key in b) {
    const bv = b[key];
    const av = a[key];
    if (bv.isColor) out[key].lerpColors(av, bv, t);
    else if (bv.isVector3) out[key].lerpVectors(av, bv, t);
    else out[key] = av + (bv - av) * t;
  }
  return out;
}
