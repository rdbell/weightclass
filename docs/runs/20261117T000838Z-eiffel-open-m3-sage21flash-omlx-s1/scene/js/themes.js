import * as THREE from 'three';

const C = (h) => new THREE.Color(h);
const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

export const THEMES = {
  day: {
    skyTop: C('#2e7cd6'), skyHorizon: C('#aadcf5'), skyBottom: C('#eaf7fd'),
    sunColor: C('#fff4cc'), haloColor: C('#fff6d8'),
    sunDir: V(0.55, 0.88, -0.32),
    sunDisc: 0.99935, halo: 0.9987,
    sunLightColor: C('#fff1d0'), sunLightIntensity: 3.1,
    hemiSky: C('#bfe0f5'), hemiGround: C('#8fbf7a'), hemiIntensity: 1.75,
    fogColor: C('#cfe9f5'), fogNear: 550, fogFar: 1900,
    ink: C('#332a3f'), rim: C('#ffedb8'),
    grass: C('#7ec35a'), plaza: C('#e6d3a8'), avenue: C('#dcbf92'),
    trunk: C('#7c4a2d'), leaf: C('#55a644'), leaf2: C('#6dbb4f'),
    wall: C('#f4e6c6'), roof: C('#5d6f96'), windows: C('#3b4a5e'),
    towerDark: C('#6d3f2b'), towerMid: C('#8a4f33'), towerLight: C('#a8623c'),
    gold: C('#e8b04b'), cream: C('#f2e3c0'),
    cloud: C('#ffffff'),
    lampPost: C('#3e4a3c'), lampBulb: C('#6a7076'),
    stars: 0, flood: 0, floodColor: C('#ffb545'), beacon: 0.3, lampPool: 0,
  },
  dusk: {
    skyTop: C('#3c3a8c'), skyHorizon: C('#ff9d5c'), skyBottom: C('#ffd9a3'),
    sunColor: C('#ffb347'), haloColor: C('#ff9e4d'),
    sunDir: V(-0.7, 0.2, -0.55),
    sunDisc: 0.9989, halo: 0.9962,
    sunLightColor: C('#ff9a45'), sunLightIntensity: 3.2,
    hemiSky: C('#a86fb8'), hemiGround: C('#5c4a63'), hemiIntensity: 1.4,
    fogColor: C('#e8a56f'), fogNear: 450, fogFar: 1700,
    ink: C('#2c2140'), rim: C('#ff9a55'),
    grass: C('#5f9a4c'), plaza: C('#d9b98d'), avenue: C('#d4b483'),
    trunk: C('#6e4026'), leaf: C('#4c8f42'), leaf2: C('#61a24c'),
    wall: C('#e8c8a4'), roof: C('#4a4a70'), windows: C('#ffb45e'),
    towerDark: C('#55301f'), towerMid: C('#6e3d27'), towerLight: C('#874f30'),
    gold: C('#f0b545'), cream: C('#e8cf9f'),
    cloud: C('#ffb58a'),
    lampPost: C('#33352e'), lampBulb: C('#ffca6a'),
    stars: 0.45, flood: 0.5, floodColor: C('#ffb045'), beacon: 0.6, lampPool: 0.55,
  },
  night: {
    skyTop: C('#0b1734'), skyHorizon: C('#27406e'), skyBottom: C('#33507e'),
    sunColor: C('#e8f2ff'), haloColor: C('#9fb4da'),
    sunDir: V(-0.55, 0.34, -0.76),
    sunDisc: 0.99955, halo: 0.9988,
    sunLightColor: C('#b8cdf0'), sunLightIntensity: 2.6,
    hemiSky: C('#5577ad'), hemiGround: C('#2c3750'), hemiIntensity: 1.55,
    fogColor: C('#17233f'), fogNear: 400, fogFar: 1600,
    ink: C('#0b1020'), rim: C('#8fa8d8'),
    grass: C('#3e6b48'), plaza: C('#8f8ba0'), avenue: C('#8a869c'),
    trunk: C('#4a3020'), leaf: C('#2f5e38'), leaf2: C('#3a6f42'),
    wall: C('#6f7892'), roof: C('#3c425e'), windows: C('#ffd27a'),
    towerDark: C('#503326'), towerMid: C('#5f3d2b'), towerLight: C('#6e4630'),
    gold: C('#c8923c'), cream: C('#b8a684'),
    cloud: C('#46536e'),
    lampPost: C('#232823'), lampBulb: C('#ffd98a'),
    stars: 1, flood: 1, floodColor: C('#ffb545'), beacon: 1, lampPool: 1,
  },
};

export function snapshot(theme) {
  const out = {};
  for (const key of Object.keys(theme)) {
    const v = theme[key];
    if (v instanceof THREE.Color || v instanceof THREE.Vector3) out[key] = v.clone();
    else out[key] = v;
  }
  return out;
}

export function lerpTheme(cur, tgt, k) {
  for (const key of Object.keys(tgt)) {
    const a = cur[key], b = tgt[key];
    if (a instanceof THREE.Color) a.lerp(b, k);
    else if (a instanceof THREE.Vector3) a.lerp(b, k).normalize();
    else cur[key] = a + (b - a) * k;
  }
}