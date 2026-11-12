// The rendering pipeline: colour pass + an ink pass built from a normal/depth
// prepass, then grading, vignette and AA. All line art comes from geometry.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';

const INK_SHADER = {
	uniforms: {
		tDiffuse: { value: null },
		tInk: { value: null },
		tDepth: { value: null },
		uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
		uNear: { value: 6 },
		uFar: { value: 4000 },
		uInkColor: { value: new THREE.Color(0x33241a) },
		uStrength: { value: 0.85 },
		uWidth: { value: 1.2 },
		uDepthT: { value: 0.34 },
		uNormalT: { value: 0.4 },
		uFogNear: { value: 620 },
		uFogFar: { value: 2900 },
		uGrade: { value: new THREE.Color(0xffffff) },
		uGradeAmount: { value: 0 },
		uVignette: { value: 0.3 },
		uSaturate: { value: 1.05 },
		uDither: { value: 0.004 },
		uDebug: { value: 0 },
	},
	vertexShader: /* glsl */`
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
		}`,
	fragmentShader: /* glsl */`
		uniform sampler2D tDiffuse, tInk, tDepth;
		uniform vec2 uTexel;
		uniform float uNear, uFar, uStrength, uWidth, uDepthT, uNormalT, uFogNear, uFogFar;
		uniform float uGradeAmount, uVignette, uSaturate, uDither, uDebug;
		uniform vec3 uInkColor, uGrade;
		varying vec2 vUv;

		float invDist(vec2 uv) {
			float z = texture2D( tDepth, uv ).x;
			float d = -( uNear * uFar ) / ( ( uFar - uNear ) * z - uFar );
			return 1.0 / max( d, 1.5 );
		}

		float hash12( vec2 p ) {
			vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
			p3 += dot( p3, p3.yzx + 33.33 );
			return fract( ( p3.x + p3.y ) * p3.z );
		}

		void main() {
			vec3 col = texture2D( tDiffuse, vUv ).rgb;
			vec2 o = uTexel * uWidth;

			// --- depth creases. Comparing a pixel with the mean of its neighbours in
			// 1/z space is exactly zero on any flat plane at any viewing angle, so the
			// only things that print are real discontinuities.
			float dc = invDist( vUv );
			float dl = invDist( vUv + vec2( o.x, 0.0 ) );
			float dr = invDist( vUv - vec2( o.x, 0.0 ) );
			float dt = invDist( vUv + vec2( 0.0, o.y ) );
			float db = invDist( vUv - vec2( 0.0, o.y ) );
			float cx = abs( dc * 2.0 - dl - dr );
			float cy = abs( dc * 2.0 - dt - db );
			float sx = max( abs( dc - dl ), abs( dc - dr ) ) + 1e-5;
			float sy = max( abs( dc - dt ), abs( dc - db ) ) + 1e-5;
			float curvature = max( cx / sx, cy / sy );
			float depthEdge = smoothstep( uDepthT, uDepthT * 2.1, curvature );

			// --- normal creases
			vec3 nl = texture2D( tInk, vUv + vec2( o.x, 0.0 ) ).xyz;
			vec3 nr = texture2D( tInk, vUv - vec2( o.x, 0.0 ) ).xyz;
			vec3 nt = texture2D( tInk, vUv + vec2( 0.0, o.y ) ).xyz;
			vec3 nb = texture2D( tInk, vUv - vec2( 0.0, o.y ) ).xyz;
			vec3 nd = max( abs( nl - nr ), abs( nt - nb ) );
			float nEdge = smoothstep( uNormalT, uNormalT * 2.0, max( nd.x, max( nd.y, nd.z ) ) );
			float facing = abs( texture2D( tInk, vUv ).z * 2.0 - 1.0 );
			nEdge *= mix( 0.35, 1.0, smoothstep( 0.04, 0.3, facing ) );

			// lines taper away into the haze so the far city stays a wash of colour
			float dist = 1.0 / max( dc, 1e-5 );
			float far = 1.0 - smoothstep( uFogNear * 0.7, uFogFar * 0.9, dist );
			nEdge *= far;
			depthEdge *= mix( 0.35, 1.0, far );

			float ink = clamp( max( depthEdge, nEdge * 0.92 ) * uStrength, 0.0, 1.0 );
			if ( uDebug > 0.5 ) {
				vec3 n = texture2D( tInk, vUv ).rgb;
				float z = texture2D( tDepth, vUv ).x;
				gl_FragColor = vec4( n.r, n.g, z, 1.0 );
				return;
			}
			col = mix( col, uInkColor, ink );

			// grade, vignette, a whisper of dither
			col = mix( col, col * uGrade, uGradeAmount );
			float lum = dot( col, vec3( 0.2126, 0.7152, 0.0722 ) );
			col = mix( vec3( lum ), col, uSaturate );
			float r = length( ( vUv - 0.5 ) * vec2( 1.06, 1.0 ) );
			col *= mix( 1.0, smoothstep( 1.05, 0.32, r ), uVignette );
			col += ( hash12( vUv * 1024.0 ) - 0.5 ) * uDither;

			gl_FragColor = vec4( col, 1.0 );
		}`,
};

export function createPipeline(renderer, scene, camera) {
	const size = new THREE.Vector2();
	renderer.getDrawingBufferSize(size);

	const samples = 0;
	const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
		type: THREE.HalfFloatType,
		samples,
	});
	const composer = new EffectComposer(renderer, rt);
	composer.addPass(new RenderPass(scene, camera));

	const inkPass = new ShaderPass(INK_SHADER);
	composer.addPass(inkPass);

	composer.addPass(new OutputPass());
	const fxaa = new FXAAPass();
	composer.addPass(fxaa);

	// normal + depth prepass for the ink
	const inkRT = new THREE.WebGLRenderTarget(size.x, size.y, {
		depthBuffer: true,
		minFilter: THREE.LinearFilter,
		magFilter: THREE.LinearFilter,
	});
	inkRT.depthTexture = new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType);
	const normalMat = new THREE.MeshNormalMaterial();

	const prevLayers = { mask: 3 };
	function renderInk(rendererRef, bg) {
		const prevOverride = scene.overrideMaterial;
		const prevBg = scene.background;
		const prevAuto = rendererRef.shadowMap.autoUpdate;
		scene.overrideMaterial = normalMat;
		scene.background = null;
		rendererRef.shadowMap.autoUpdate = false;
		prevLayers.mask = camera.layers.mask;
		camera.layers.set(0);
		rendererRef.setClearColor(0x8080ff, 1);
		const prevRT = rendererRef.getRenderTarget();
		rendererRef.setRenderTarget(inkRT);
		rendererRef.render(scene, camera);
		rendererRef.setRenderTarget(prevRT);
		camera.layers.mask = prevLayers.mask;
		scene.overrideMaterial = prevOverride;
		scene.background = prevBg;
		rendererRef.shadowMap.autoUpdate = prevAuto;
		rendererRef.setClearColor(bg, 1);
		inkPass.uniforms.tInk.value = inkRT.texture;
		inkPass.uniforms.tDepth.value = inkRT.depthTexture;
	}

	function setSize(w, h, pixelRatio) {
		composer.setSize(w, h);
		composer.setPixelRatio(pixelRatio);
		const db = new THREE.Vector2();
		renderer.getDrawingBufferSize(db);
		inkRT.setSize(db.x, db.y);
		if (inkRT.depthTexture) inkRT.depthTexture.dispose();
		inkRT.depthTexture = new THREE.DepthTexture(db.x, db.y, THREE.UnsignedIntType);
		inkPass.uniforms.uTexel.value.set(1 / db.x, 1 / db.y);
		fxaa.setSize(db.x, db.y);
	}

	return { composer, inkPass, renderInk, setSize };
}
