// Time-of-day art direction. Every visual number in the scene lives here so the
// three looks can be blended smoothly into each other.
import * as THREE from 'three';

const C = (hex) => new THREE.Color(hex);

/**
 * NOTE: keys must be identical across the three presets so they can be lerp'd.
 */
export const PRESETS = {
	day: {
		sun: { color: C('#fff2d4'), intensity: 2.05, x: 0.58, y: 0.78, z: 0.46 },
		fill: { color: C('#a8c8f0'), intensity: 0.55, x: 0.6, y: 0.42, z: 0.68 },
		amb: { color: C('#a9cdf2'), intensity: 0.55 },
		hemi: { sky: C('#c2e2ff'), ground: C('#93a06a'), intensity: 0.68 },
		flood: { color: C('#ffcf8a'), intensity: 0.0 },
		lights: { lamp: 0.0, window: 0.0, beacon: 0.0, sparkle: 0.0, firework: 0.0, fire: 0.0 },

		sky: {
			zenith: C('#1e77cd'), mid: C('#69b6ee'), horizon: C('#cbe9fb'),
			sun: C('#fffaea'), sunGlow: C('#ffe6a8'), bands: 5.0, sunSize: 0.028,
			stars: 0.0, cityGlow: 0.0, glowW: 13.0, sunset: 0.30, haze: 0.16,
		},
		fog: { color: C('#c3e0f2'), near: 900, far: 3600 },
		ink: { color: C('#33241a'), strength: 0.82, width: 1.15, depth: 0.028, normal: 0.42 },

		mat: {
			tower: C('#c78d3f'), towerTop: C('#e2b571'), deck: C('#96652f'), trim: C('#8a5a2b'),
			girder: C('#b47c37'), stone: C('#e3d7bf'), plinth: C('#d5c7ab'),
			wall: C('#efe3c9'), roof: C('#7f92ab'), roofWarm: C('#b07a58'), road: C('#7a7d88'),
			glass: C('#9fd8ea'), metal: C('#b9c3cf'),
			ground: C('#8db968'), lawn: C('#9fce6c'), path: C('#e6d9bd'), hedge: C('#4f9247'),
			trunk: C('#7d5a3c'), leaf: C('#5fa64f'), leafAlt: C('#87bb4f'),
			sand: C('#e8d6a8'), waterFoam: C('#f2fbff'), quay: C('#d8ccb4'),
		},
		water: {
			deep: C('#2f6f9e'), mid: C('#4c9cc4'), light: C('#8fd6e6'),
			foam: C('#f4fdff'), glint: C('#ffffff'),
			sparkle: 0.55, amp: 1.0, reflStrength: 0.22, reflColor: C('#20405f'), skyMix: 0.30,
		},
		cloud: { light: C('#ffffff'), shade: C('#c3d8ec'), opacity: 1.0 },
		tint: { grade: C('#ffffff'), amount: 0.0, vignette: 0.30, saturate: 1.06, bloom: 0.10 },
		exposure: 1.04,
		cloudY: 1.0,
	},

	dusk: {
		sun: { color: C('#ff9746'), intensity: 2.05, x: -0.305, y: 0.174, z: -0.937 },
		fill: { color: C('#7f74cc'), intensity: 1.05, x: 0.52, y: 0.45, z: 0.66 },
		amb: { color: C('#8f76b8'), intensity: 0.78 },
		hemi: { sky: C('#ffb583'), ground: C('#4c4266'), intensity: 0.78 },
		flood: { color: C('#ffb862'), intensity: 0.7 },
		lights: { lamp: 0.45, window: 0.4, beacon: 0.3, sparkle: 0.0, firework: 0.0, fire: 0.0 },

		sky: {
			zenith: C('#332f6e'), mid: C('#bb5480'), horizon: C('#ffa95a'),
			sun: C('#ffe2a6'), sunGlow: C('#ff8b4a'), bands: 6.0, sunSize: 0.055,
			stars: 0.18, cityGlow: 0.22, glowW: 15.0, sunset: 1.15, haze: 0.5,
		},
		fog: { color: C('#b4707f'), near: 700, far: 3000 },
		ink: { color: C('#37182c'), strength: 0.78, width: 1.1, depth: 0.03, normal: 0.4 },

		mat: {
			tower: C('#c07f45'), towerTop: C('#e8a05c'), deck: C('#8a5330'), trim: C('#7c4a2a'),
			girder: C('#b0723a'), stone: C('#dcc2a6'), plinth: C('#c8ab8d'),
			wall: C('#e8c9a8'), roof: C('#5c5f8a'), roofWarm: C('#8f5a4e'), road: C('#6a5f6e'),
			glass: C('#e9b98a'), metal: C('#9a90ab'),
			ground: C('#74a064'), lawn: C('#82ad5c'), path: C('#d8bb96'), hedge: C('#3d6e42'),
			trunk: C('#5f4433'), leaf: C('#528a4c'), leafAlt: C('#74a452'),
			sand: C('#d8b98d'), waterFoam: C('#ffd9b3'), quay: C('#cbb39a'),
		},
		water: {
			deep: C('#2b2f66'), mid: C('#5b4d84'), light: C('#e08a72'),
			foam: C('#ffcf9e'), glint: C('#ffd9a0'),
			sparkle: 0.6, amp: 0.8, reflStrength: 0.3, reflColor: C('#3b2340'), skyMix: 0.42,
		},
		cloud: { light: C('#ffc79a'), shade: C('#7b5a8e'), opacity: 1.0 },
		tint: { grade: C('#ff9c5e'), amount: 0.14, vignette: 0.36, saturate: 1.12, bloom: 0.3 },
		exposure: 1.1,
		cloudY: 0.94,
	},

	night: {
		sun: { color: C('#9dbcff'), intensity: 0.95, x: -0.343, y: 0.178, z: -0.921 },
		fill: { color: C('#4c62b0'), intensity: 0.4, x: 0.6, y: 0.25, z: 0.7 },
		amb: { color: C('#40569c'), intensity: 0.66 },
		hemi: { sky: C('#5878c0'), ground: C('#303a63'), intensity: 0.85 },
		flood: { color: C('#ffc069'), intensity: 1.3 },
		lights: { lamp: 1.0, window: 1.0, beacon: 1.0, sparkle: 1.0, firework: 1.0, fire: 1.0 },

		sky: {
			zenith: C('#080e2c'), mid: C('#152553'), horizon: C('#2d4472'),
			sun: C('#f7f5e6'), sunGlow: C('#9db6e8'), bands: 6.0, sunSize: 0.034,
			stars: 1.15, cityGlow: 0.2, glowW: 21.0, sunset: 0.34, haze: 0.3,
		},
		fog: { color: C('#182342'), near: 520, far: 2900 },
		ink: { color: C('#0b1030'), strength: 0.6, width: 1.0, depth: 0.034, normal: 0.34 },

		mat: {
			tower: C('#8f7a63'), towerTop: C('#b79a72'), deck: C('#5e4a3b'), trim: C('#54443a'),
			girder: C('#7d6a52'), stone: C('#9c9bb4'), plinth: C('#8d8aa6'),
			wall: C('#9d9bb8'), roof: C('#4a4f74'), roofWarm: C('#6b4f5e'), road: C('#3f4463'),
			glass: C('#ffd98a'), metal: C('#7d88a8'),
			ground: C('#46607c'), lawn: C('#4e7181'), path: C('#9095b8'), hedge: C('#2d4c5a'),
			trunk: C('#3b3348'), leaf: C('#37646e'), leafAlt: C('#457163'),
			sand: C('#6e6f92'), waterFoam: C('#9fc4e8'), quay: C('#7c7d9c'),
		},
		water: {
			deep: C('#0d1636'), mid: C('#182a58'), light: C('#3d5f9c'),
			foam: C('#8fb6e0'), glint: C('#e8f0ff'),
			sparkle: 0.5, amp: 0.7, reflStrength: 0.62, reflColor: C('#c98a3a'), skyMix: 0.5,
		},
		cloud: { light: C('#475a86'), shade: C('#1b2347'), opacity: 0.95 },
		tint: { grade: C('#4c64b8'), amount: 0.12, vignette: 0.44, saturate: 0.98, bloom: 0.55 },
		exposure: 1.22,
		cloudY: 0.86,
	},
};

export const TOD_ORDER = ['day', 'dusk', 'night'];

/** Deep copy of a preset (used as the live, blended palette). */
export function clonePalette(v) {
	if (v && v.isColor) return v.clone();
	if (Array.isArray(v)) return v.slice();
	if (v && typeof v === 'object') {
		const o = {};
		for (const k in v) o[k] = clonePalette(v[k]);
		return o;
	}
	return v;
}

export function makePalette(name = 'day') {
	return clonePalette(PRESETS[name]);
}

/** Blend `out` in place toward mix(a,b,t). Reuses Color instances in `out`. */
export function blendInto(out, a, b, t) {
	for (const k in a) {
		const av = a[k];
		const ov = out[k];
		if (av && av.isColor) {
			ov.copy(av).lerp(b[k], t);
		} else if (typeof av === 'number') {
			out[k] = av + (b[k] - av) * t;
		} else if (av && typeof av === 'object') {
			blendInto(ov, av, b[k], t);
		} else {
			out[k] = av;
		}
	}
	return out;
}

/** True when every leaf of `out` matches its target (used to stop blending). */
export function paletteClose(a, b, eps = 0.004) {
	for (const k in a) {
		const av = a[k];
		if (av && av.isColor) {
			if (Math.abs(av.r - b[k].r) > eps || Math.abs(av.g - b[k].g) > eps || Math.abs(av.b - b[k].b) > eps) return false;
		} else if (typeof av === 'number') {
			const scale = Math.max(1, Math.abs(av));
			if (Math.abs(av - b[k]) > eps * scale) return false;
		} else if (av && typeof av === 'object') {
			if (!paletteClose(av, b[k], eps)) return false;
		}
	}
	return true;
}
