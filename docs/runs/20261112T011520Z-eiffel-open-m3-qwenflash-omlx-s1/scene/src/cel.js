// cel.js — the cel-shading pipeline: a beauty pass, a normal/depth pre-pass and
// a final composite that draws the ink outlines over the top.
//
// Outlines are found in screen space from two buffers:
//   * view-space normals  -> creases and form lines
//   * view-space depth    -> silhouettes and steps in the lattice
// Each object also carries an "ink weight" (its layer) so the fine ironwork of
// the tower gets thin, faint lines while the chunky stuff gets bold ones.

import * as THREE from 'three';

export const LAYER_SOLID = 0;  // bold outline objects
export const LAYER_FINE = 1;   // delicate lattice: fainter lines
export const LAYER_GLOW = 2;   // emissive / additive stuff: no lines at all

const PREPASS_VERT = /* glsl */`
	varying vec3 vNrm;
	void main() {
		#include <beginnormal_vertex>
		#include <defaultnormal_vertex>
		vNrm = normalize( transformedNormal );
		#include <begin_vertex>
		#include <project_vertex>
	}
`;

const PREPASS_FRAG = /* glsl */`
	uniform float uWeight;
	varying vec3 vNrm;
	void main() {
		gl_FragColor = vec4( normalize( vNrm ) * 0.5 + 0.5, uWeight );
	}
`;

const COMPOSITE_FRAG = /* glsl */`
	precision highp float;

	uniform sampler2D tColor;
	uniform sampler2D tNormal;
	uniform sampler2D tDepth;

	uniform vec2 uPx;         // 1 / resolution
	uniform vec2 uRes;
	uniform float uNear;
	uniform float uFar;
	uniform float uTime;

	uniform vec3 uInk;
	uniform float uInkStrength;
	uniform float uInkWidth;
	uniform float uDepthThresh;
	uniform float uNormalThresh;
	uniform float uLineFadeNear;
	uniform float uLineFadeFar;
	uniform float uVignette;
	uniform float uSat;
	uniform float uGrade;
	uniform vec2 uFog;        // fog near / far, used to soften far ink

	varying vec2 vUv;

	float hash12(vec2 p) {
		vec3 p3 = fract(vec3(p.xyx) * 0.1031);
		p3 += dot(p3, p3.yzx + 33.33);
		return fract((p3.x + p3.y) * p3.z);
	}

	float viewDist(float d) {
		// three: viewZ = (near*far) / ((far-near)*d - far); returns negative
		float vz = (uNear * uFar) / ((uFar - uNear) * d - uFar);
		return -vz;
	}

	float depthAt(vec2 uv) { return texture2D(tDepth, uv).x; }
	float distAt(vec2 uv) {
		float d = texture2D(tDepth, uv).x;
		if (d >= 0.9999) return 1e9;
		return viewDist(d);
	}
	vec3 normAt(vec2 uv) { return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
	float weightAt(vec2 uv) { return texture2D(tNormal, uv).w; }

	void main() {
		vec3 col = texture2D(tColor, vUv).rgb;

		float d0 = texture2D(tDepth, vUv).x;
		float line = 0.0;

		if (d0 < 0.9999) {
			float dist = viewDist(d0);
			vec3 n0 = normAt(vUv);
			float w0 = weightAt(vUv);

			// hand-drawn wobble: the sampling radius breathes along the line
			float seed = hash12(floor(vUv * uRes) * 0.37 + floor(uTime * 6.0));
			float radius = uInkWidth * (0.85 + 0.4 * seed);

			float depthEdge = 0.0;
			float normalEdge = 0.0;

			for (int i = 0; i < 8; i++) {
				vec2 off;
				float wgt;
				if (i < 4) {
					off = vec2(float(i == 1) - float(i == 3), float(i == 0) - float(i == 2));
					wgt = 1.0;
				} else {
					float sx = (i == 4 || i == 7) ? -1.0 : 1.0;
					float sy = (i < 6) ? 1.0 : -1.0;
					off = vec2(sx, sy);
					wgt = 0.62;
				}
				vec2 uvN = vUv + off * uPx * radius;
				float wN = weightAt(uvN);
				if (wN <= 0.001) continue;

				float dn = distAt(uvN);
				if (dn < 1e8) {
					float scale = max(2.0, dist * uDepthThresh);
					float dz = abs(dn - dist);
					float e = smoothstep(scale * 0.55, scale * 1.9, dz);
					// a neighbour that is closer than us never makes a line here
					e *= step(0.0, dist - dn + 0.02 * dist);
					depthEdge += e * wgt * mix(0.42, 1.0, wN);
				}

				vec3 nN = normAt(uvN);
				float nd = 1.0 - dot(n0, nN);
				normalEdge += smoothstep(uNormalThresh, uNormalThresh + 0.42, nd) * wgt * mix(0.0, 1.0, wN) * mix(0.15, 1.0, wN);
			}

			float ink = depthEdge * 0.62 + normalEdge * 0.5;
			ink *= mix(0.35, 1.0, w0);
			ink = smoothstep(0.42, 1.05, ink);

			// far away detail melts into the haze instead of turning into mush
			float fade = 1.0 - smoothstep(uLineFadeNear, uLineFadeFar, dist);
			// anything swallowed by fog stops being inked too
			float fogFade = 1.0 - smoothstep(uFog.x, uFog.y, dist);
			line = ink * uInkStrength * max(fade, 0.25) * mix(0.35, 1.0, fogFade);
		}

		if (line > 0.0) {
			float lum = dot(col, vec3(0.299, 0.587, 0.114));
			vec3 inkCol = uInk * (0.42 + 0.72 * vec3(pow(max(lum, 0.0), 0.55)));
			col = mix(col, inkCol, clamp(line, 0.0, 1.0));
		}

		// --- grade --------------------------------------------------------
		vec2 p = vUv - 0.5;
		float vig = 1.0 - uVignette * dot(p, p) * 1.55;
		col *= vig;

		float lum2 = dot(col, vec3(0.299, 0.587, 0.114));
		col = mix(vec3(lum2), col, uSat);
		col *= uGrade;

		// ordered-ish dither kills any leftover banding in the sky
		float dith = (hash12(floor(vUv * uRes) + fract(uTime)) - 0.5) / 210.0;
		col += dith;

		gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
		#include <colorspace_fragment>
	}
`;

export class CelPipeline {
	constructor(renderer, scene, camera) {
		this.renderer = renderer;
		this.scene = scene;
		this.camera = camera;
		this.samples = renderer.capabilities.isWebGL2 ? 4 : 0;

		this.prepassSolid = new THREE.ShaderMaterial({
			vertexShader: PREPASS_VERT,
			fragmentShader: PREPASS_FRAG,
			uniforms: { uWeight: { value: 1.0 } },
			blending: THREE.NoBlending,
			fog: false,
		});
		this.prepassFine = new THREE.ShaderMaterial({
			vertexShader: PREPASS_VERT,
			fragmentShader: PREPASS_FRAG,
			uniforms: { uWeight: { value: 0.4 } },
			blending: THREE.NoBlending,
			fog: false,
		});

		this.composite = new THREE.ShaderMaterial({
			vertexShader: /* glsl */`
				varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = vec4( position.xy * 2.0 - 0.0, 0.0, 1.0 );
				}
			`,
			fragmentShader: COMPOSITE_FRAG,
			uniforms: {
				tColor: { value: null },
				tNormal: { value: null },
				tDepth: { value: null },
				uPx: { value: new THREE.Vector2() },
				uRes: { value: new THREE.Vector2() },
				uNear: { value: 1 },
				uFar: { value: 6000 },
				uTime: { value: 0 },
				uInk: { value: new THREE.Color('#3a2c40') },
				uInkStrength: { value: 1 },
				uInkWidth: { value: 1 },
				uDepthThresh: { value: 0.016 },
				uNormalThresh: { value: 0.3 },
				uLineFadeNear: { value: 1300 },
				uLineFadeFar: { value: 3000 },
				uFog: { value: new THREE.Vector2(900, 3400) },
				uVignette: { value: 0.32 },
				uSat: { value: 1.06 },
				uGrade: { value: 1 },
			},
			depthTest: false,
			depthWrite: false,
			fog: false,
		});
		// the composite shader declares its own varyings; keep three from
		// injecting the default ones twice
		this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.composite);
		this.quad.frustumCulled = false;
		this.quadScene = new THREE.Scene();
		this.quadScene.add(this.quad);

		this._allLayers = new THREE.Layers();
		this.fullMask = this._allLayers.mask;

		this.colorRT = null;
		this.normalRT = null;
		this.setSize(1, 1);
	}

	setSize(w, h) {
		w = Math.max(1, Math.floor(w));
		h = Math.max(1, Math.floor(h));
		if (this.colorRT) { this.colorRT.dispose(); this.normalRT.dispose(); }

		this.colorRT = new THREE.WebGLRenderTarget(w, h, {
			type: THREE.HalfFloatType,
			samples: this.samples,
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
		});
		this.normalRT = new THREE.WebGLRenderTarget(w, h, {
			type: THREE.UnsignedByteType,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			depthTexture: new THREE.DepthTexture(w, h, THREE.UnsignedIntType),
		});
		this.normalRT.depthTexture.format = THREE.DepthFormat;

		const u = this.composite.uniforms;
		u.tColor.value = this.colorRT.texture;
		u.tNormal.value = this.normalRT.texture;
		u.tDepth.value = this.normalRT.depthTexture;
		u.uPx.value.set(1 / w, 1 / h);
		u.uRes.value.set(w, h);
	}

	render(time) {
		const r = this.renderer, c = this.camera;
		const u = this.composite.uniforms;
		u.uTime.value = time;
		u.uNear.value = c.near;
		u.uFar.value = c.far;

		// 1. beauty pass (also renders the shadow maps, once per frame)
		r.shadowMap.needsUpdate = true;
		c.layers.enableAll();
		r.setRenderTarget(this.colorRT);
		r.setClearColor(0x000000, 0);
		r.clear(true, true, false);
		r.render(this.scene, c);

		// 2. normals + depth pre-pass
		r.shadowMap.needsUpdate = false;
		r.shadowMap.autoUpdate = false;
		r.setRenderTarget(this.normalRT);
		r.setClearColor(0x000000, 0);
		r.clear(true, true, false);
		const prevOverride = this.scene.overrideMaterial;
		this.scene.overrideMaterial = this.prepassSolid;
		c.layers.set(LAYER_SOLID);
		r.render(this.scene, c);
		this.scene.overrideMaterial = this.prepassFine;
		c.layers.set(LAYER_FINE);
		r.render(this.scene, c);
		this.scene.overrideMaterial = prevOverride;
		c.layers.enableAll();

		// 3. composite
		r.setRenderTarget(null);
		r.clear(true, true, false);
		r.render(this.quadScene, this.quadCamera);
	}
}
