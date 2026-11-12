import * as THREE from 'three';

export const MODES = ['day', 'dusk', 'night'];

// Normalized direction * 2350 (distance where the sun/moon discs live).
const DISC = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return v.map((c) => (c / l) * 2350);
};

export const PALETTES = {
  day: {
    skyTop: '#2b87dd', skyMid: '#7cc7f2', skyHor: '#e2f4fb', fog: '#e2f4fb',
    sunPos: [260, 320, 180], sunColor: '#fff1cf', sunI: 1.45,
    hemiSky: '#bfe0ff', hemiGround: '#93c06c', hemiI: 0.45,
    sunDiscPos: DISC([260, 320, 180]), sunDiscColor: '#ffdf6b',
    sunOpacity: 1, sunHalo: 0.55, moonOpacity: 0, moonHalo: 0,
    stars: 0, sparkle: 0,
    glowColor: '#000000', glowI: 0, glowLight: 0,
    iron: '#a87b52', ironDark: '#755136', plat: '#cbb28f', rail: '#e9e0c8',
    groundTint: '#ffffff', trunk: '#8a5a33', leafA: '#55b052', leafB: '#3f9642',
    cloud: '#ffffff', bird: '#3a3f52',
    lampHeadI: 0, lampLight: 0, halo: 0,
  },
  dusk: {
    skyTop: '#4a3577', skyMid: '#c46a6f', skyHor: '#ffb56b', fog: '#eda56f',
    sunPos: [430, 110, -160], sunColor: '#ff9b4f', sunI: 1.35,
    hemiSky: '#d98a6f', hemiGround: '#4f4270', hemiI: 0.42,
    sunDiscPos: DISC([430, 110, -160]), sunDiscColor: '#ff8a3d',
    sunOpacity: 1, sunHalo: 0.7, moonOpacity: 0, moonHalo: 0,
    stars: 0.3, sparkle: 0.1,
    glowColor: '#ff9040', glowI: 0.06, glowLight: 0.12,
    iron: '#7d5464', ironDark: '#573a4c', plat: '#b08a7a', rail: '#d8c0a8',
    groundTint: '#e8a878', trunk: '#6b4530', leafA: '#6f9a48', leafB: '#577a3a',
    cloud: '#f5b890', bird: '#463255',
    lampHeadI: 0.6, lampLight: 0.3, halo: 0.35,
  },
  night: {
    skyTop: '#070d28', skyMid: '#142050', skyHor: '#2c4a80', fog: '#1d3055',
    sunPos: [-200, 300, -260], sunColor: '#cfe2ff', sunI: 1.0,
    hemiSky: '#3d5590', hemiGround: '#1a2338', hemiI: 0.5,
    sunDiscPos: DISC([260, 320, 180]), sunDiscColor: '#ffdf6b',
    sunOpacity: 0, sunHalo: 0, moonOpacity: 1, moonHalo: 0.4,
    stars: 1, sparkle: 1,
    glowColor: '#ff9d45', glowI: 0.22, glowLight: 1,
    iron: '#5d7098', ironDark: '#46587e', plat: '#8f9abd', rail: '#aab4d0',
    groundTint: '#5a6ca8', trunk: '#4b3a50', leafA: '#2f6b60', leafB: '#255249',
    cloud: '#3c4a74', bird: '#232c44',
    lampHeadI: 1.3, lampLight: 1, halo: 0.9,
  },
};

// ---- tiny tween system: everything lerps smoothly between modes ----
const tweens = [];
let t0 = -1;
const DUR = 1.6;

export function colorTween(targetColor, key) {
  tweens.push({ kind: 'c', target: targetColor, key });
}
export function numTween(get, set, key) {
  tweens.push({ kind: 'n', get, set, key });
}
export function vecTween(targetVec3, key) {
  tweens.push({ kind: 'v', target: targetVec3, key });
}

export function startMode(mode, instant = false) {
  const P = PALETTES[mode];
  for (const t of tweens) {
    if (t.kind === 'c') {
      t.from = t.target.clone();
      t.to = new THREE.Color(P[t.key]);
    } else if (t.kind === 'v') {
      t.from = t.target.clone();
      t.to = new THREE.Vector3().fromArray(P[t.key]);
    } else {
      t.from = t.get();
      t.to = P[t.key];
    }
    if (instant) {
      if (t.kind === 'c') t.target.copy(t.to);
      else if (t.kind === 'v') t.target.copy(t.to);
      else t.set(t.to);
    }
  }
  t0 = instant ? -1 : 0;
}

export function updateTweens(time) {
  if (t0 < 0) return;
  let k = Math.min(1, (time - t0) / DUR);
  const e = k * k * (3 - 2 * k); // smoothstep
  for (const t of tweens) {
    if (t.kind === 'c') t.target.lerpColors(t.from, t.to, e);
    else if (t.kind === 'v') t.target.lerpVectors(t.from, t.to, e);
    else t.set(t.from + (t.to - t.from) * e);
  }
  if (k >= 1) t0 = -1;
}
