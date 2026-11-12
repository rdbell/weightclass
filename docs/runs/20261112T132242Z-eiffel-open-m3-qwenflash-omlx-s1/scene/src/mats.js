// Cel-shaded material set + the code that repaints everything from the palette.
import * as THREE from 'three';

/**
 * Hard-stepped ramp used as gradientMap. `stops` is a list of
 * { at: NdotL threshold, v: brightness } sorted ascending; the last matching
 * stop wins, so bands are crisp steps, never gradients.
 */
function toonRamp(stops) {
	const N = 32;
	const data = new Uint8Array(N);
	for (let i = 0; i < N; i++) {
		const nd = ((i + 0.5) / N) * 2 - 1;
		let v = stops[0].v;
		for (let s = 0; s < stops.length; s++) if (nd >= stops[s].at) v = stops[s].v;
		data[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
	}
	const tex = new THREE.DataTexture(data, N, 1, THREE.RedFormat);
	tex.minFilter = THREE.NearestFilter;
	tex.magFilter = THREE.NearestFilter;
	tex.generateMipmaps = false;
	tex.needsUpdate = true;
	return tex;
}

const RAMPS = {
	metal: toonRamp([{ at: -1, v: 0.40 }, { at: -0.06, v: 0.56 }, { at: 0.24, v: 0.80 }, { at: 0.60, v: 1.0 }]),
	hard: toonRamp([{ at: -1, v: 0.44 }, { at: -0.02, v: 0.62 }, { at: 0.28, v: 0.84 }, { at: 0.66, v: 1.0 }]),
	soft: toonRamp([{ at: -1, v: 0.54 }, { at: 0.02, v: 0.72 }, { at: 0.34, v: 0.90 }, { at: 0.72, v: 1.0 }]),
	veg: toonRamp([{ at: -1, v: 0.46 }, { at: -0.05, v: 0.66 }, { at: 0.30, v: 0.86 }, { at: 0.70, v: 1.0 }]),
	// canopy blobs only: two flat tones keep a round tree a round tree
	veg2: toonRamp([{ at: -1, v: 0.60 }, { at: 0.16, v: 1.0 }]),
	cloud: toonRamp([{ at: -1, v: 0.58 }, { at: 0.04, v: 0.78 }, { at: 0.42, v: 1.0 }]),
};

export function createMaterials() {
	const mk = (color, ramp, extra = {}) =>
		new THREE.MeshToonMaterial(Object.assign({ color, gradientMap: RAMPS[ramp] }, extra));

	const mats = {
		tower: mk(0xc78d3f, 'metal'),
		girder: mk(0xb47c37, 'metal'),
		deck: mk(0x96652f, 'hard'),
		trim: mk(0x8a5a2b, 'hard'),
		stone: mk(0xe3d7bf, 'hard'),
		plinth: mk(0xd5c7ab, 'hard'),
		metal: mk(0xb9c3cf, 'metal'),
		glass: mk(0x9fd8ea, 'hard', { transparent: true, opacity: 0.9 }),

		ground: mk(0x8db968, 'soft'),
		lawn: mk(0x9fce6c, 'soft'),
		path: mk(0xe6d9bd, 'soft'),
		sand: mk(0xe8d6a8, 'soft'),
		hedge: mk(0x4f9247, 'veg'),
		trunk: mk(0x7d5a3c, 'veg'),
		leaf: mk(0x5fa64f, 'veg'),
		leafBlob: mk(0x5fa64f, 'veg2'),
		wall: mk(0xefe3c9, 'hard'),
		roof: mk(0x7f92ab, 'hard'),
		roofWarm: mk(0xa4785e, 'hard'),
		quay: mk(0xd2c6ad, 'hard'),
		road: mk(0x6c6f7a, 'soft'),

		cloud: mk(0xffffff, 'cloud'),
		people: mk(0xffffff, 'soft'),
		cars: mk(0xffffff, 'hard'),
		balloon: mk(0xffffff, 'soft', { vertexColors: true }),
		inkHelper: null,
	};

	// City facades: procedural window grid, glowing at night.
	const { map, emissive } = cityWindows();
	mats.facade = new THREE.MeshToonMaterial({
		color: 0xefe3c9,
		gradientMap: RAMPS.hard,
		map,
		emissiveMap: emissive,
		emissive: new THREE.Color(0xffb95e),
		emissiveIntensity: 0.0,
		vertexColors: true,
	});
	mats.facade.map.wrapS = mats.facade.map.wrapT = THREE.RepeatWrapping;
	mats.facade.emissiveMap.wrapS = mats.facade.emissiveMap.wrapT = THREE.RepeatWrapping;
	mats.roofed = new THREE.MeshToonMaterial({ color: 0x7f92ab, gradientMap: RAMPS.hard, vertexColors: true });

	mats.beam = beamMaterial();
	return mats;
}

/** Two tiny canvases: a window grid for the facade, and a random subset for glow. */
function cityWindows() {
	const S = 128, cols = 6, rows = 6;
	const mkCanvas = () => {
		const c = document.createElement('canvas');
		c.width = c.height = S;
		return c;
	};
	const base = mkCanvas();
	let b = base.getContext('2d');
	b.fillStyle = '#ffffff';
	b.fillRect(0, 0, S, S);
	const lit = mkCanvas();
	let l = lit.getContext('2d');
	l.fillStyle = '#000000';
	l.fillRect(0, 0, S, S);

	let seed = 20260512 >>> 0;
	const rnd = () => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	const cw = S / cols, ch = S / rows;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = c * cw + cw * 0.24, y = r * ch + ch * 0.24;
			const w = cw * 0.52, h = ch * 0.44;
			b.fillStyle = '#4a5f78';
			b.fillRect(x, y, w, h);
			b.fillStyle = '#8fa7bd';
			b.fillRect(x, y, w, h * 0.34);
			const on = rnd();
			if (on > 0.42) {
				const v = 0.55 + rnd() * 0.45;
				l.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(205 * v)},${Math.round(130 * v)})`;
				l.fillRect(x, y, w, h);
			}
		}
		// floor band
		b.fillStyle = '#e6dbc6';
		b.fillRect(0, rows === r ? 0 : (r + 1) * ch - 2, S, 2);
	}
	const t1 = new THREE.CanvasTexture(base);
	const t2 = new THREE.CanvasTexture(lit);
	for (const t of [t1, t2]) {
		t.colorSpace = THREE.SRGBColorSpace;
		t.wrapS = t.wrapT = THREE.RepeatWrapping;
		t.anisotropy = 4;
	}
	return { map: t1, emissive: t2 };
}

/** Additive cone for the rotating summit beacon. */
function beamMaterial() {
	return new THREE.ShaderMaterial({
		uniforms: {
			uColor: { value: new THREE.Color(0xfff3d0) },
			uOpacity: { value: 0.0 },
		},
		vertexShader: /* glsl */`
			varying float vAxial;
			varying float vFace;
			void main() {
				vAxial = uv.y;
				vec4 mv = modelViewMatrix * vec4( position, 1.0 );
				vec3 n = normalize( normalMatrix * normal );
				vFace = abs( dot( n, normalize( -mv.xyz ) ) );
				gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 uColor;
			uniform float uOpacity;
			varying float vAxial;
			varying float vFace;
			void main() {
				float a = pow( clamp( vAxial, 0.0, 1.0 ), 1.7 ) * ( 0.28 + 0.72 * vFace ) * uOpacity;
				gl_FragColor = vec4( uColor * a, a );
			}`,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		side: THREE.DoubleSide,
		fog: false,
	});
}

const MAT_KEYS = [
	'tower', 'girder', 'deck', 'trim', 'stone', 'plinth', 'metal', 'glass',
	'ground', 'lawn', 'path', 'sand', 'hedge', 'trunk', 'leaf', 'wall', 'roof', 'roofWarm', 'quay', 'road',
];

const tmpE = new THREE.Color();

/** Repaint every material from the (already blended) palette. */
export function applyPaletteMaterials(mats, p) {
	for (const k of MAT_KEYS) if (mats[k]) mats[k].color.copy(p.mat[k]);
	mats.leafBlob.color.copy(p.mat.leaf);
	mats.cloud.color.copy(p.cloud.light);
	mats.cloud.opacity = p.cloud.opacity;
	mats.cloud.transparent = p.cloud.opacity < 0.999;

	const lamp = p.lights.lamp;
	mats.facade.color.copy(p.mat.wall);
	mats.facade.emissiveIntensity = 0.0 + lamp * 1.35;
	mats.roofed.color.copy(p.mat.roof);

	// Night readability: a gentle self-illumination keeps the ironwork legible
	// in silhouette-free shadow while still banding under the floodlights.
	const lift = 0.06 + p.lights.lamp * 0.20;
	tmpE.copy(p.flood.color).multiplyScalar(p.lights.lamp * 0.05);
	mats.tower.emissive.copy(p.mat.tower).multiplyScalar(lift * 0.9).add(tmpE);
	mats.girder.emissive.copy(mats.tower.emissive).multiplyScalar(0.8);
	mats.deck.emissive.copy(p.mat.deck).multiplyScalar(lift * 0.7);
	mats.trim.emissive.copy(p.mat.trim).multiplyScalar(lift * 0.7);
	mats.stone.emissive.copy(p.mat.stone).multiplyScalar(p.lights.lamp * 0.05);
	mats.glass.emissive.copy(p.mat.glass).multiplyScalar(0.15 + lamp * 0.85);
	mats.beam.uniforms.uOpacity.value = p.lights.beacon * 0.5;
	mats.beam.uniforms.uColor.value.copy(p.tint.grade).lerp(new THREE.Color(0xfff4d8), 0.7);
}

export { RAMPS };
