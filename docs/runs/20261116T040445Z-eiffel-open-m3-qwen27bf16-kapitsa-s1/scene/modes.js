import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Time-of-day definitions. Every visual parameter of the scene lives here;
// DayState damps the current values toward the active mode each frame, so
// toggling modes crossfades the whole scene (sky, lights, fog, tints, glows).
// ---------------------------------------------------------------------------
const C = (h) => new THREE.Color(h);
const V = (a) => new THREE.Vector3(a[0], a[1], a[2]).normalize();

export const MODES = {
  day: {
    skyTop: C('#2f8fd8'),
    skyHorizon: C('#d9f2ff'),
    sunDir: V([-0.65, 0.45, -0.5]),
    sunAmount: 1.0,
    sunHalo: 0.25,
    sunSprite: 1.0,
    moonSprite: 0.0,
    sunTint: C('#fff8dc'),
    sunScale: 110,
    lightColor: C('#fff2d0'),
    lightIntensity: 1.15,
    hemiSky: C('#cfeaff'),
    hemiGround: C('#8fbf72'),
    hemiIntensity: 0.55,
    fogColor: C('#cfeaff'),
    fogNear: 480,
    fogFar: 1700,
    shadowSize: 620,
    towerColor: C('#a96a32'),
    towerEmissive: C('#000000'),
    towerEmissiveIntensity: 0.0,
    grassTint: C('#ffffff'),
    plazaTint: C('#ffffff'),
    treeTint: C('#ffffff'),
    cloudColor: C('#ffffff'),
    cloudOpacity: 1.0,
    ink: C('#33221a'),
    lampBulb: C('#8a8a76'),
    lampGlow: 0.0,
    starOpacity: 0.0,
    sparkle: 0.0,
    beacon: 0.2,
    waterColor: C('#ffffff'),
    birdOpacity: 1.0,
    flagTint: C('#ffffff'),
  },
  dusk: {
    skyTop: C('#3a3f78'),
    skyHorizon: C('#ffb066'),
    sunDir: V([-0.75, 0.3, -0.4]),
    sunAmount: 1.0,
    sunHalo: 0.55,
    sunSprite: 1.0,
    moonSprite: 0.0,
    sunTint: C('#ff9a4a'),
    sunScale: 150,
    lightColor: C('#ffb070'),
    lightIntensity: 1.3,
    hemiSky: C('#8a7bb0'),
    hemiGround: C('#6a7a55'),
    hemiIntensity: 0.6,
    fogColor: C('#f0a86e'),
    fogNear: 380,
    fogFar: 1550,
    shadowSize: 950,
    towerColor: C('#7c4a24'),
    towerEmissive: C('#5a2e12'),
    towerEmissiveIntensity: 0.55,
    grassTint: C('#e0a882'),
    plazaTint: C('#e8b490'),
    treeTint: C('#d09a92'),
    cloudColor: C('#ffb98a'),
    cloudOpacity: 1.0,
    ink: C('#2c1c22'),
    lampBulb: C('#ffcf8a'),
    lampGlow: 0.55,
    starOpacity: 0.3,
    sparkle: 0.2,
    beacon: 0.8,
    waterColor: C('#e89a6a'),
    birdOpacity: 0.3,
    flagTint: C('#e8b090'),
  },
  night: {
    skyTop: C('#0a102e'),
    skyHorizon: C('#2a3a6e'),
    sunDir: V([-0.5, 0.44, -0.5]),
    sunAmount: 0.0,
    sunHalo: 0.0,
    sunSprite: 0.0,
    moonSprite: 1.0,
    sunTint: C('#e8eeff'),
    sunScale: 90,
    lightColor: C('#8fa8e8'),
    lightIntensity: 0.85,
    hemiSky: C('#33406e'),
    hemiGround: C('#22283e'),
    hemiIntensity: 0.65,
    fogColor: C('#1c2647'),
    fogNear: 380,
    fogFar: 1450,
    shadowSize: 560,
    towerColor: C('#6e4522'),
    towerEmissive: C('#ffb347'),
    towerEmissiveIntensity: 0.55,
    grassTint: C('#5a6a9a'),
    plazaTint: C('#6a749e'),
    treeTint: C('#4a5a8a'),
    cloudColor: C('#3a466e'),
    cloudOpacity: 0.9,
    ink: C('#141225'),
    lampBulb: C('#ffe9a8'),
    lampGlow: 1.0,
    starOpacity: 1.0,
    sparkle: 1.0,
    beacon: 1.0,
    waterColor: C('#7fa0e0'),
    birdOpacity: 0.0,
    flagTint: C('#8a94c8'),
  },
};

const COLOR_KEYS = [
  'skyTop', 'skyHorizon', 'sunTint', 'lightColor', 'hemiSky', 'hemiGround',
  'fogColor', 'towerColor', 'towerEmissive', 'grassTint', 'plazaTint',
  'treeTint', 'cloudColor', 'ink', 'lampBulb', 'waterColor', 'flagTint',
];
const VEC_KEYS = ['sunDir'];
const NUM_KEYS = [
  'sunAmount', 'sunHalo', 'sunSprite', 'moonSprite', 'sunScale',
  'lightIntensity', 'hemiIntensity', 'fogNear', 'fogFar', 'shadowSize',
  'towerEmissiveIntensity', 'lampGlow', 'starOpacity', 'sparkle', 'beacon',
  'cloudOpacity', 'birdOpacity',
];

export class DayState {
  constructor(name) {
    this.name = MODES[name] ? name : 'day';
    this.cur = {};
    for (const k of COLOR_KEYS) this.cur[k] = MODES[this.name][k].clone();
    for (const k of VEC_KEYS) this.cur[k] = MODES[this.name][k].clone();
    for (const k of NUM_KEYS) this.cur[k] = MODES[this.name][k];
  }
  setMode(name) {
    if (MODES[name]) this.name = name;
  }
  update(dt) {
    const t = MODES[this.name];
    const k = 1 - Math.exp(-dt * 3.2);
    for (const key of COLOR_KEYS) this.cur[key].lerp(t[key], k);
    for (const key of VEC_KEYS) this.cur[key].lerp(t[key], k).normalize();
    for (const key of NUM_KEYS) this.cur[key] += (t[key] - this.cur[key]) * k;
  }
}
