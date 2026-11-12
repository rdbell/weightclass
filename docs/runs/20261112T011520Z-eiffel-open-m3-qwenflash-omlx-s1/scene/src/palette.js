// palette.js — every colour and light value in the scene lives here, indexed by
// time of day. Slots are interpolated every frame, so switching mode is a smooth
// cross-fade of the entire world rather than a hard swap.

import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);

/** shorthand for a per-mode slot */
const T = (day, dusk, night) => ({ day, dusk, night });

export const MODES = ['day', 'dusk', 'night'];

export const COLOR_SLOTS = {
	// sky dome
	skyTop:        T(C('#2b86c9'), C('#37356f'), C('#070f28')),
	skyMid:        T(C('#7cc3ea'), C('#c86b8c'), C('#172a5c')),
	skyBottom:     T(C('#d8eef7'), C('#ffb469'), C('#4a5f96')),
	sunGlow:       T(C('#fff8e0'), C('#ffd08a'), C('#9fc4ff')),
	horizonGlow:   T(C('#cbe6f2'), C('#ff8f5c'), C('#6f6ea8')),

	// atmosphere
	fog:           T(C('#c2e2f2'), C('#e39a7e'), C('#1a2a5e')),
	ink:           T(C('#3a2c40'), C('#4b2733'), C('#0a1030')),

	// lights
	sunColor:      T(C('#fff6d8'), C('#ffb05e'), C('#a8c6ff')),
	hemiSky:       T(C('#a8d8f6'), C('#8a72b8'), C('#2b4079')),
	hemiGround:    T(C('#84ad57'), C('#5e4a53'), C('#1a2340')),
	upColor:       T(C('#ffd9a0'), C('#ffc47a'), C('#ffab45')),

	// the tower
	tower:         T(C('#a08054'), C('#a5714c'), C('#4f4c6a')),
	towerGlow:     T(C('#000000'), C('#2a1108'), C('#c97c2a')),
	stone:         T(C('#d3c3a4'), C('#c69a7c'), C('#3b3f5e')),
	trim:          T(C('#efd8a0'), C('#f0b877'), C('#ffcf7d')),
	deck:          T(C('#c9b189'), C('#b58a6c'), C('#5c5a7c')),

	// ground & water
	grass:         T(C('#74bf4e'), C('#6b8a54'), C('#2b4567')),
	grassDeep:     T(C('#4f9a44'), C('#4d6244'), C('#1e3352')),
	plaza:         T(C('#e8d8ae'), C('#d3a884'), C('#4a5075')),
	gravel:        T(C('#dcc79b'), C('#c69c7e'), C('#3f4666')),
	path:          T(C('#f2e6c4'), C('#e0b78f'), C('#5a6188')),
	water:         T(C('#39a0d4'), C('#c9705f'), C('#122452')),
	waterHi:       T(C('#e8fbff'), C('#ffd6a2'), C('#8fb6ff')),

	// buildings
	wall:          T(C('#f4e7cb'), C('#e9c39c'), C('#39426b')),
	wall2:         T(C('#e5d3ae'), C('#d5a583'), C('#2f3760')),
	roof:          T(C('#5d6f8f'), C('#4e4b6b'), C('#1e2547')),
	roofTrim:      T(C('#f6f0e2'), C('#d8b08c'), C('#525a86')),
	window:        T(C('#8fa9c4'), C('#6a5a7a'), C('#ffcf8c')),

	// plants
	leaf:          T(C('#4dae4c'), C('#5f8a49'), C('#24455f')),
	leaf2:         T(C('#3d9146'), C('#4a6f45'), C('#1c3a55')),
	trunk:         T(C('#7c5b3a'), C('#6b4a3c'), C('#232c4c')),

	// props
	metal:         T(C('#4b4f63'), C('#463a4c'), C('#1c2340')),
	lampGlass:     T(C('#fff6d2'), C('#ffd39a'), C('#ffe2ad')),
	boat:          T(C('#f6f2e4'), C('#e8c39c'), C('#424a74')),
	cloudLit:      T(C('#ffffff'), C('#ffc79b'), C('#39477f')),
	cloudShade:    T(C('#cfe2f0'), C('#8a5f86'), C('#232f5e')),

	// additive glows
	glowWarm:      T(C('#fff0c0'), C('#ffb968'), C('#ffc46a')),
	star:          T(C('#ffffff'), C('#ffe9d0'), C('#dfe9ff')),
	fireworkA:     T(C('#ff8fb0'), C('#ff9f6a'), C('#ffd27a')),
	fireworkB:     T(C('#8fe8ff'), C('#c79bff'), C('#7fd8ff')),
};

export const NUMBER_SLOTS = {
	sunI:          T(3.15, 2.05, 1.15),
	hemiI:         T(1.15, 0.8, 0.95),
	upI:           T(0.0, 0.22, 1.55),
	fogNear:       T(850, 620, 460),
	fogFar:        T(3400, 2900, 2700),
	inkStrength:   T(1.0, 0.95, 0.8),
	inkWidth:      T(1.0, 1.05, 1.15),
	skyGlowSize:   T(42, 11, 5.5),
	skyGlowI:      T(0.5, 0.95, 0.45),
	horizonGlowI:  T(0.35, 0.75, 0.6),
	stars:         T(0.0, 0.28, 1.0),
	lampGlow:      T(0.0, 0.65, 1.0),
	windowGlow:    T(0.04, 0.45, 1.0),
	towerSparkle:  T(0.0, 0.25, 1.0),
	beacon:        T(0.0, 0.35, 1.0),
	fireworks:     T(0.0, 0.0, 1.0),
	waterSparkle:  T(0.55, 0.8, 0.9),
	groundSparkle: T(0.0, 0.0, 0.0),
	vignette:      T(0.32, 0.4, 0.5),
	grade:         T(1.0, 1.04, 1.1),
	sat:           T(1.06, 1.12, 1.1),
	beamLength:    T(0.0, 0.4, 1.0),
};

// light directions (towards the light), lerped + renormalised each frame
export const DIR_SLOTS = {
	sunDir: T(new THREE.Vector3(0.62, 0.6, 0.45), new THREE.Vector3(-0.95, 0.16, 0.26), new THREE.Vector3(-0.5, 0.52, -0.68)),
	upDir:  T(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0.2, -0.85, 0.45), new THREE.Vector3(0.3, -0.72, 0.55)),
};

export function makeTheme(mode = 'day') {
	const theme = { mode, prevMode: mode, t: 1 };
	theme.c = {};
	for (const k in COLOR_SLOTS) theme.c[k] = COLOR_SLOTS[k][mode].clone();
	theme.n = {};
	for (const k in NUMBER_SLOTS) theme.n[k] = NUMBER_SLOTS[k][mode];
	theme.d = {};
	for (const k in DIR_SLOTS) theme.d[k] = DIR_SLOTS[k][mode].clone().normalize();
	return theme;
}

/** Ease the theme towards `mode`. Returns true while still moving. */
export function advanceTheme(theme, mode, dt) {
	const rate = 1 - Math.pow(0.001, dt / 1.35); // ~1.35s to settle
	if (theme.mode !== mode) { theme.prevMode = theme.mode; theme.mode = mode; }
	for (const k in COLOR_SLOTS) theme.c[k].lerp(COLOR_SLOTS[k][theme.mode], rate);
	for (const k in NUMBER_SLOTS) {
		const target = NUMBER_SLOTS[k][theme.mode];
		theme.n[k] += (target - theme.n[k]) * rate;
	}
	let moving = false;
	for (const k in DIR_SLOTS) {
		theme.d[k].lerp(DIR_SLOTS[k][theme.mode], rate).normalize();
		if (theme.d[k].distanceToSquared(DIR_SLOTS[k][theme.mode]) > 1e-6) moving = true;
	}
	for (const k in NUMBER_SLOTS) {
		if (Math.abs(NUMBER_SLOTS[k][theme.mode] - theme.n[k]) > 1e-4) { moving = true; break; }
	}
	return moving;
}

/** Snap the theme straight to a mode (used on load). */
export function setTheme(theme, mode) {
	theme.mode = theme.prevMode = mode;
	for (const k in COLOR_SLOTS) theme.c[k].copy(COLOR_SLOTS[k][mode]);
	for (const k in NUMBER_SLOTS) theme.n[k] = NUMBER_SLOTS[k][mode];
	for (const k in DIR_SLOTS) theme.d[k].copy(DIR_SLOTS[k][mode]).normalize();
	return theme;
}
