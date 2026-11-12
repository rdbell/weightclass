// Sky dome, toon water, lamp glows, tower sparkles, fireworks and the beacon.
import * as THREE from 'three';
import { makeRng } from './util.js';

const rng = makeRng(90210);

// ---------------------------------------------------------------------------
// Sky
export function createSky() {
	const geo = new THREE.SphereGeometry(2600, 32, 20);
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uZenith: { value: new THREE.Color(0x2f86d6) },
			uMid: { value: new THREE.Color(0x78bdf0) },
			uHorizon: { value: new THREE.Color(0xd3ecfb) },
			uSunCol: { value: new THREE.Color(0xfffaea) },
			uSunGlow: { value: new THREE.Color(0xffe6a8) },
			uGlowWarm: { value: new THREE.Color(0xffa85c) },
			uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.4) },
			uBands: { value: 5 },
			uSunSize: { value: 0.028 },
			uStars: { value: 0 },
			uCityGlow: { value: 0 },
			uGlowW: { value: 11.0 },
			uSunset: { value: 0.5 },
			uHaze: { value: 0.2 },
			uTime: { value: 0 },
		},
		vertexShader: /* glsl */`
			varying vec3 vDir;
			void main() {
				vDir = position;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 uZenith, uMid, uHorizon, uSunCol, uSunGlow, uGlowWarm, uSunDir;
			uniform float uBands, uSunSize, uStars, uCityGlow, uGlowW, uSunset, uHaze, uTime;
			varying vec3 vDir;

			float hash21( vec2 p ) {
				p = fract( p * vec2( 123.34, 456.21 ) );
				p += dot( p, p + 34.56 );
				return fract( p.x * p.y );
			}

			void main() {
				vec3 d = normalize( vDir );
				float t = clamp( d.y, 0.0, 1.0 );

				// hard-banded gradient: flat cartoon sky, no smooth ramp
				float q = floor( pow( t, 0.7 ) * uBands + 0.5 ) / uBands;
				vec3 col = mix( uHorizon, uMid, smoothstep( 0.0, 0.42, q ) );
				col = mix( col, uZenith, smoothstep( 0.34, 1.0, q ) );
				col = mix( col, uHorizon, exp( -t * 7.0 ) * uHaze );

				// sun / moon
				vec3 sd = normalize( uSunDir );
				float ang = distance( d, sd );
				float disc = 1.0 - smoothstep( uSunSize, uSunSize * 1.05, ang );
				float halo = exp( -pow( ang / ( uSunSize * 4.0 ), 2.4 ) ) * 0.42
					+ exp( -pow( ang / ( uSunSize * 9.0 ), 2.0 ) ) * 0.10;
				col += uSunGlow * halo;
				float ring = smoothstep( uSunSize * 1.16, uSunSize * 1.26, ang )
					* ( 1.0 - smoothstep( uSunSize * 1.34, uSunSize * 1.46, ang ) );
				col = mix( col, uSunCol, max( disc, ring * 0.45 ) );

				// craters, only when the light in the sky is the moon
				if ( disc > 0.5 && uStars > 0.2 ) {
					vec3 t1 = normalize( cross( sd, vec3( 0.0, 0.0, 1.0 ) ) + vec3( 0.002, 0.0, 0.0 ) );
					vec3 t2 = cross( t1, sd );
					vec2 qq = vec2( dot( d, t1 ), dot( d, t2 ) ) / uSunSize;
					float c = smoothstep( 0.34, 0.2, length( qq - vec2( -0.32, 0.3 ) ) )
						+ smoothstep( 0.26, 0.14, length( qq - vec2( 0.36, -0.1 ) ) )
						+ smoothstep( 0.2, 0.1, length( qq - vec2( -0.05, -0.45 ) ) ) * 0.8
						+ smoothstep( 0.16, 0.08, length( qq - vec2( 0.1, 0.52 ) ) ) * 0.7;
					col *= 1.0 - clamp( c, 0.0, 1.0 ) * 0.16;
				}

				// stars
				if ( uStars > 0.01 ) {
					vec2 sp = vec2( atan( d.z, d.x ) / 6.2831 + 0.5, d.y * 0.5 + 0.5 );
					vec2 g = sp * vec2( 260.0, 190.0 );
					vec2 cell = floor( g );
					vec2 f = fract( g ) - 0.5;
					float h = hash21( cell );
					float present = step( 0.984, h );
					vec2 off = ( vec2( hash21( cell + 1.3 ), hash21( cell + 7.7 ) ) - 0.5 ) * 0.66;
					float dd = length( f - off );
					float size = 0.02 + hash21( cell + 3.1 ) * 0.05;
					float star = 1.0 - smoothstep( size * 0.25, size, dd );
					float tw = 0.55 + 0.45 * sin( uTime * ( 0.7 + h * 2.6 ) + h * 40.0 );
					col += vec3( 0.92, 0.95, 1.0 ) * star * tw * present * uStars * smoothstep( -0.03, 0.12, d.y ) * 1.7;
				}

				// warm haze of the city, hugging the horizon line only
				col += uGlowWarm * exp( -abs( d.y ) * uGlowW ) * uCityGlow;

				// light of the sun or moon pooling at its own azimuth
				vec3 sf = normalize( vec3( sd.x, 0.0, sd.z ) );
				float az = clamp( dot( normalize( vec3( d.x, 0.0, d.z ) ), sf ), 0.0, 1.0 );
				col += uSunGlow * pow( az, 9.0 ) * exp( -abs( d.y ) * 3.0 ) * uSunset;

				gl_FragColor = vec4( col, 1.0 );
			}`,
		side: THREE.BackSide,
		depthWrite: false,
		fog: false,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.renderOrder = -10;
	mesh.userData.noInk = true;
	mesh.frustumCulled = false;
	return { mesh, mat };
}

// ---------------------------------------------------------------------------
// Water
export function createWater(geo) {
	const mat = new THREE.ShaderMaterial({
		uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
			uTime: { value: 0 },
			uDeep: { value: new THREE.Color(0x2f6f9e) },
			uMid: { value: new THREE.Color(0x4c9cc4) },
			uLight: { value: new THREE.Color(0x8fd6e6) },
			uFoam: { value: new THREE.Color(0xf4fdff) },
			uGlint: { value: new THREE.Color(0xffffff) },
			uSky: { value: new THREE.Color(0xcfe6f4) },
			uSunDir: { value: new THREE.Vector3(0.5, 0.8, 0.4) },
			uSparkle: { value: 0.6 },
			uAmp: { value: 1.0 },
			uSkyMix: { value: 0.3 },
			uReflColor: { value: new THREE.Color(0x20405f) },
			uReflStrength: { value: 0.2 },
			uTower: { value: new THREE.Vector2(0, 0) },
			uFoamAmt: { value: 1.0 },
		}),
		fog: true,
		vertexShader: /* glsl */`
			varying vec3 vWorld;
			varying vec2 vUvw;
			#include <fog_pars_vertex>
			void main() {
				vec4 wp = modelMatrix * vec4( position, 1.0 );
				vWorld = wp.xyz;
				vUvw = uv;
				vec4 mvPosition = viewMatrix * wp;
				gl_Position = projectionMatrix * mvPosition;
				#include <fog_vertex>
			}`,
		fragmentShader: /* glsl */`
			uniform float uTime, uSparkle, uAmp, uSkyMix, uReflStrength, uFoamAmt;
			uniform vec3 uDeep, uMid, uLight, uFoam, uGlint, uSky, uSunDir, uReflColor;
			uniform vec2 uTower;
			varying vec3 vWorld;
			varying vec2 vUvw;
			#include <fog_pars_fragment>

			float hash21( vec2 p ) {
				p = fract( p * vec2( 123.34, 456.21 ) );
				p += dot( p, p + 34.56 );
				return fract( p.x * p.y );
			}

			float vnoise( vec2 p ) {
				vec2 i = floor( p ), f = fract( p );
				f = f * f * ( 3.0 - 2.0 * f );
				float a = hash21( i ), b = hash21( i + vec2( 1.0, 0.0 ) );
				float c = hash21( i + vec2( 0.0, 1.0 ) ), d = hash21( i + vec2( 1.0, 1.0 ) );
				return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
			}

			void waves( vec2 p, float t, float m, out vec3 n, out float h ) {
				vec2 k1 = vec2(  0.050, 0.028 ) * 6.2831;
				vec2 k2 = vec2( -0.016, 0.052 ) * 6.2831;
				vec2 k3 = vec2(  0.098, -0.060 ) * 6.2831;
				vec2 k4 = vec2(  0.175, 0.095 ) * 6.2831;
				float a1 = 1.00, a2 = 0.70, a3 = 0.30, a4 = 0.10;
				float p1 = dot( k1, p ) + t * 0.85;
				float p2 = dot( k2, p ) - t * 0.75;
				float p3 = dot( k3, p ) + t * 1.30;
				float p4 = dot( k4, p ) - t * 1.70;
				h = sin( p1 ) * a1 + sin( p2 ) * a2 + sin( p3 ) * a3 + sin( p4 ) * a4;
				vec2 gr = k1 * cos( p1 ) * a1 + k2 * cos( p2 ) * a2 + k3 * cos( p3 ) * a3 + k4 * cos( p4 ) * a4;
				float amp = uAmp * 1.25 * m;
				n = normalize( vec3( -gr.x * amp, 1.0, -gr.y * amp ) );
			}

			void main() {
				vec2 wp = vWorld.xz;
				// the swell comes in patches: an even field of sines reads as wallpaper
				float m = 0.16 + 1.25 * vnoise( wp * 0.0032 + vec2( uTime * 0.012, -uTime * 0.009 ) );
				m *= 0.5 + 0.8 * vnoise( wp * 0.0093 + 3.1 );
				m *= mix( 1.0, 0.28, smoothstep( 380.0, 1250.0, distance( cameraPosition.xz, wp ) ) );
				vec2 warp = ( vec2( vnoise( wp * 0.0021 + 13.7 ), vnoise( wp * 0.0021 - 5.3 ) ) - 0.5 ) * 220.0;

				vec3 n; float h;
				waves( wp + warp, uTime * 0.85, m, n, h );

				// cel bands straight off the wave normal
				float ndl = clamp( dot( n, normalize( uSunDir ) ) * 0.5 + 0.5, 0.0, 1.0 );
				float band = floor( ndl * 3.0 ) / 2.0;
				vec3 col = mix( uDeep, uMid, smoothstep( 0.10, 0.62, band ) );
				col = mix( col, uLight, smoothstep( 0.68, 0.98, band ) );

				// specular glitter toward the sun / moon
				vec3 V = normalize( cameraPosition - vWorld );
				vec3 R = reflect( -normalize( uSunDir ), n );
				float g = dot( R, V );
				float glit = smoothstep( 1.0 - 0.024 * uSparkle, 1.0 - 0.005 * uSparkle, g )
					* smoothstep( 0.55, 1.05, m );
				col = mix( col, uGlint, glit * 0.7 );

				// sky reflection at grazing angles
				float fres = pow( 1.0 - clamp( dot( n, V ), 0.0, 1.0 ), 3.0 );
				col = mix( col, uSky, fres * uSkyMix );

				// floodlight spill around the tower
				float r = length( vWorld.xz - uTower );
				float spill = exp( -pow( r / 135.0, 2.2 ) ) * ( 0.6 + 0.4 * sin( h * 2.4 + uTime * 0.9 ) );
				col = mix( col, uReflColor, clamp( spill, 0.0, 1.0 ) * uReflStrength );

				// shoreline foam
				float edge = min( vUvw.y, 1.0 - vUvw.y );
				float foamLine = smoothstep( 0.05 + 0.018 * sin( h * 3.0 ), 0.0, edge );
				col = mix( col, uFoam, foamLine * 0.85 * uFoamAmt );

				gl_FragColor = vec4( col, 1.0 );
				#include <fog_fragment>
			}`,
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.receiveShadow = false;
	return { mesh, mat };
}

// ---------------------------------------------------------------------------
// Additive billboard glows (lamplight, boat lamps, the tower's aureole)
export class GlowField {
	constructor(max, { softness = 2.3, fadeStart = 900, fadeEnd = 2400 } = {}) {
		const geo = new THREE.PlaneGeometry(1, 1);
		const mat = new THREE.ShaderMaterial({
			uniforms: {
				uIntensity: { value: 1 },
				uSoft: { value: softness },
				uFade: { value: new THREE.Vector2(fadeStart, fadeEnd) },
			},
			vertexShader: /* glsl */`
				varying vec2 vUv;
				varying vec3 vTint;
				varying float vFade;
				uniform vec2 uFade;
				void main() {
					vUv = uv;
					#ifdef USE_INSTANCING_COLOR
						vTint = instanceColor;
					#else
						vTint = vec3( 1.0 );
					#endif
					vec3 ip = instanceMatrix[3].xyz;
					float sx = length( instanceMatrix[0].xyz );
					float sy = length( instanceMatrix[1].xyz );
					vec4 mv = viewMatrix * vec4( ip, 1.0 );
					vFade = 1.0 - smoothstep( uFade.x, uFade.y, -mv.z );
					mv.xy += position.xy * vec2( sx, sy );
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: /* glsl */`
				uniform float uIntensity, uSoft;
				varying vec2 vUv;
				varying vec3 vTint;
				varying float vFade;
				void main() {
					float d = length( ( vUv - 0.5 ) * 2.0 );
					float a = pow( clamp( 1.0 - d, 0.0, 1.0 ), uSoft );
					a *= a;
					gl_FragColor = vec4( vTint * a * uIntensity * vFade, a );
				}`,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			fog: false,
		});
		const mesh = new THREE.InstancedMesh(geo, mat, max);
		mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		mesh.frustumCulled = false;
		mesh.userData.noInk = true;
		this.mesh = mesh;
		this.mat = mat;
		this.max = max;
		this._m = new THREE.Matrix4();
		this._q = new THREE.Quaternion();
		this._p = new THREE.Vector3();
		this._s = new THREE.Vector3();
		this._c = new THREE.Color();
		for (let i = 0; i < max; i++) mesh.setColorAt(i, this._c.setRGB(1, 1, 1));
		this.count = 0;
	}

	begin() { this.count = 0; }
	push(x, y, z, size, color, aspect = 1) {
		if (this.count >= this.max) return;
		this._p.set(x, y, z);
		this._s.set(size * aspect, size, 1);
		this._m.compose(this._p, this._q, this._s);
		this.mesh.setMatrixAt(this.count, this._m);
		if (color) this.mesh.setColorAt(this.count, this._c.copy(color));
		this.count++;
	}
	end() {
		this.mesh.count = this.count;
		this.mesh.instanceMatrix.needsUpdate = true;
		if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
	}
}

/** Flat pools of light on the ground. */
export class PoolField {
	constructor(max) {
		const geo = new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2);
		const mat = new THREE.ShaderMaterial({
			uniforms: { uIntensity: { value: 0 } },
			vertexShader: /* glsl */`
				varying vec2 vUv;
				varying vec3 vTint;
				#ifdef USE_INSTANCING_COLOR
				#endif
				void main() {
					vUv = uv;
					#ifdef USE_INSTANCING_COLOR
						vTint = instanceColor;
					#else
						vTint = vec3( 1.0 );
					#endif
					gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4( position, 1.0 );
				}`,
			fragmentShader: /* glsl */`
				uniform float uIntensity;
				varying vec2 vUv;
				varying vec3 vTint;
				void main() {
					float d = length( vUv - 0.5 ) * 2.0;
					float a = pow( clamp( 1.0 - d, 0.0, 1.0 ), 2.7 );
					gl_FragColor = vec4( vTint * a * uIntensity, a );
				}`,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			polygonOffset: true,
			polygonOffsetUnits: -4,
			polygonOffsetFactor: -4,
			fog: false,
		});
		const mesh = new THREE.InstancedMesh(geo, mat, max);
		mesh.frustumCulled = false;
		mesh.userData.noInk = true;
		this.mesh = mesh;
		this.mat = mat;
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
		const c = new THREE.Color();
		this._i = 0;
		this.add = (x, y, z, size, color) => {
			if (this._i >= max) return;
			p.set(x, y, z); s.set(size, 1, size);
			m.compose(p, q, s);
			mesh.setMatrixAt(this._i, m);
			mesh.setColorAt(this._i, c.copy(color));
			this._i++;
			mesh.count = this._i;
		};
	}
}

// ---------------------------------------------------------------------------
// Golden sparkles over the ironwork (the hourly light show)
export function createSparkles(points) {
	const n = points.length / 3;
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(points, 3));
	const rand = new Float32Array(n);
	for (let i = 0; i < n; i++) rand[i] = rng.next();
	geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
	geo.computeBoundingSphere();
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uOpacity: { value: 0 },
			uProj: { value: 800 },
			uColor: { value: new THREE.Color(0xffe9b0) },
		},
		vertexShader: /* glsl */`
			attribute float aRand;
			uniform float uTime, uOpacity, uProj;
			varying float vA;
			void main() {
				vec4 mv = modelViewMatrix * vec4( position, 1.0 );
				float tw = sin( uTime * ( 1.4 + fract( aRand * 13.7 ) * 3.2 ) + aRand * 62.83 );
				float on = smoothstep( 0.55, 0.96, tw );
				vA = on * uOpacity * ( 0.5 + 0.5 * fract( aRand * 7.1 ) );
				gl_PointSize = ( 1.6 + 3.4 * fract( aRand * 3.3 ) ) * uProj / max( -mv.z, 1.0 );
				gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 uColor;
			varying float vA;
			void main() {
				vec2 p = ( gl_PointCoord - 0.5 ) * 2.0;
				float core = 1.0 - clamp( length( p ), 0.0, 1.0 );
				float crossF = max(
					exp( -abs( p.x * 7.0 ) ) * exp( -abs( p.y * 26.0 ) ),
					exp( -abs( p.y * 7.0 ) ) * exp( -abs( p.x * 26.0 ) ) );
				float a = ( pow( core, 2.0 ) * 1.2 + crossF * 0.7 ) * vA;
				gl_FragColor = vec4( uColor * a * 1.7, a );
			}`,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		fog: false,
	});
	const mesh = new THREE.Points(geo, mat);
	mesh.frustumCulled = false;
	mesh.userData.noInk = true;
	return { mesh, mat };
}

// ---------------------------------------------------------------------------
// Fireworks: CPU simulated, only used at night
export function createFireworks(count = 560, bursts = 4) {
	const geo = new THREE.BufferGeometry();
	const pos = new Float32Array(count * 3);
	const col = new Float32Array(count * 3);
	const fade = new Float32Array(count);
	const size = new Float32Array(count);
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('aFade', new THREE.BufferAttribute(fade, 1).setUsage(THREE.DynamicDrawUsage));
	geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));

	const mat = new THREE.ShaderMaterial({
		uniforms: { uProj: { value: 800 }, uOpacity: { value: 0 } },
		vertexShader: /* glsl */`
			attribute vec3 aColor;
			attribute float aFade, aSize;
			uniform float uProj, uOpacity;
			varying vec3 vCol;
			varying float vA;
			void main() {
				vec4 mv = modelViewMatrix * vec4( position, 1.0 );
				vCol = aColor;
				vA = aFade * uOpacity;
				gl_PointSize = aSize * uProj / max( -mv.z, 1.0 );
				gl_Position = projectionMatrix * mv;
			}`,
		fragmentShader: /* glsl */`
			varying vec3 vCol;
			varying float vA;
			void main() {
				float d = length( gl_PointCoord - 0.5 ) * 2.0;
				float a = pow( clamp( 1.0 - d, 0.0, 1.0 ), 2.0 ) * vA;
				gl_FragColor = vec4( vCol * a * 2.4, a );
			}`,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		fog: false,
	});
	const mesh = new THREE.Points(geo, mat);
	geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 400, 0), 4000);
	mesh.frustumCulled = false;
	mesh.userData.noInk = true;

	const per = Math.floor(count / bursts);
	const state = [];
	for (let b = 0; b < bursts; b++) {
		state.push({
			base: b * per, n: per, offset: b * 1.3, period: 6.2, cycle: -999,
			origin: new THREE.Vector3(), dir: [], speed: [], col: new THREE.Color(),
		});
	}
	const PAL = [0xffd35e, 0xff7a6b, 0x8fd0ff, 0xff9ad5, 0xb8f08f, 0xfff2c9];
	function respawn(st) {
		// bursts out to either side of the tower, where the default view can see them
		const ahead = rng.range( 280, 520 );
		const side = ( rng.chance( 0.5 ) ? -1 : 1 ) * rng.range( 330, 520 );
		st.origin.set( -0.619 * ahead + 0.79 * side, rng.range( 230, 400 ), -0.791 * ahead - 0.627 * side );
		st.col.set(rng.pick(PAL));
		for (let i = 0; i < st.n; i++) {
			const u = rng.range(-1, 1), th = rng.range(0, Math.PI * 2);
			const s = Math.sqrt(Math.max(0, 1 - u * u));
			st.dir.push(new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th)));
			st.speed.push( rng.chance( 0.26 ) ? rng.range( 44, 58 ) : rng.range( 72, 90 ) );
			size[st.base + i] = rng.range( 7, 13 );
			const c = st.col.clone().lerp(new THREE.Color(0xffffff), rng.range(0, 0.3));
			col[(st.base + i) * 3] = c.r; col[(st.base + i) * 3 + 1] = c.g; col[(st.base + i) * 3 + 2] = c.b;
		}
		geo.attributes.aSize.needsUpdate = true;
		geo.attributes.aColor.needsUpdate = true;
	}
	for (const st of state) respawn(st);

	function update(time) {
		for (const st of state) {
			const local = time + st.offset;
			const cycle = Math.floor(local / st.period);
			if (cycle !== st.cycle) {
				st.cycle = cycle;
				st.dir.length = 0; st.speed.length = 0;
				respawn(st);
			}
			const t = Math.max(local - cycle * st.period, 0);
			const k = (1 - Math.exp(-1.75 * t)) / 1.75;
			const drop = 3.2 * t * t;
			const f = t > 1.8 ? Math.max(0, 1 - (t - 1.8) / 1.9) : 1;
			const flash = 1 + 1.5 * Math.exp( -t * 3.2 );
			for (let i = 0; i < st.n; i++) {
				const idx = st.base + i;
				const d = st.dir[i];
				if (!d) continue;
				const sp = st.speed[i];
				pos[idx * 3] = st.origin.x + d.x * sp * k;
				pos[idx * 3 + 1] = st.origin.y + d.y * sp * k - drop + Math.sin(t * 2 + i) * 1.5;
				pos[idx * 3 + 2] = st.origin.z + d.z * sp * k;
				fade[idx] = f * flash * (0.75 + 0.25 * ((i * 7919) % 97) / 97);
			}
		}
		geo.attributes.position.needsUpdate = true;
		geo.attributes.aFade.needsUpdate = true;
	}
	return { mesh, mat, update, state };
}

// ---------------------------------------------------------------------------
// Summit beacon: two rotating beams
export function createBeacon(mats, height) {
	const len = 240, rad = 30;
	const geo = new THREE.ConeGeometry(rad, len, 16, 1, true);
	geo.translate(0, -len / 2, 0);
	geo.rotateZ(Math.PI / 2);
	const a = new THREE.Mesh(geo, mats.beam);
	const b = new THREE.Mesh(geo, mats.beam);
	b.rotation.y = Math.PI;
	a.userData.noInk = b.userData.noInk = true;
	const g = new THREE.Group();
	g.add(a, b);
	g.position.y = height - 8;
	g.renderOrder = 4;
	return g;
}
