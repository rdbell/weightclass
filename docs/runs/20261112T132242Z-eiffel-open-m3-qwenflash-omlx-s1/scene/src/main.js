// Tour Eiffel - a toon study. Scene assembly, lighting, time-of-day blending
// and the frame loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { makeRng, damp, easeInOut, clamp } from './util.js';
import { PRESETS, makePalette, clonePalette, blendInto, TOD_ORDER } from './palette.js';
import { createMaterials, applyPaletteMaterials } from './mats.js';
import { createTower, animateFlag, T } from './tower.js';
import { createWorld, updateWorld } from './world.js';
import { createSky, createWater, GlowField, PoolField, createSparkles, createFireworks, createBeacon } from './fx.js';
import { createPipeline } from './pipeline.js';

const query = new URLSearchParams(location.search);
const HIDE_UI = query.get('ui') === '0';
const SHQ = query.get('shadow') ? clamp(parseInt(query.get('shadow'), 10), 512, 4096) : 2048;

const container = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0xcfe6f4, 1);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xcfe6f4, 620, 2900);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 6, 5200);
camera.position.set(760, 470, 1380);
camera.layers.enable(1);   // sky, glows and other un-inked layers

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 150, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.minDistance = 150;
controls.maxDistance = 1750;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = 1.535;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.26;
controls.enabled = false;
controls.update();

// ---------------------------------------------------------------------------
// lights
const sun = new THREE.DirectionalLight(0xfff2d4, 3.1);
sun.castShadow = true;
sun.shadow.mapSize.set(SHQ, SHQ);
sun.shadow.camera.left = -620;
sun.shadow.camera.right = 620;
sun.shadow.camera.top = 620;
sun.shadow.camera.bottom = -620;
sun.shadow.camera.near = 200;
sun.shadow.camera.far = 3200;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.7;
sun.target.position.set(0, 130, 0);
scene.add(sun, sun.target);

const fill = new THREE.DirectionalLight(0xa8c8f0, 0.7);
fill.position.set(-700, 350, -550);
scene.add(fill);

const amb = new THREE.AmbientLight(0xa9cdf2, 1.0);
scene.add(amb);

const hemi = new THREE.HemisphereLight(0xc2e2ff, 0x93a06a, 1.3);
scene.add(hemi);

// warm floodlights thrown at the ironwork at night
const floods = [];
{
	const rng = makeRng(5);
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
		const l = new THREE.PointLight(0xffcf8a, 0, 560, 1.85);
		l.position.set(Math.cos(a) * 150, 26 + i * 6, Math.sin(a) * 150);
		scene.add(l);
		floods.push(l);
	}
	const high = new THREE.PointLight(0xffd9a0, 0, 700, 1.3);
	high.position.set(0, T.y3 - 20, 0);
	scene.add(high);
	floods.push(high);
}

// ---------------------------------------------------------------------------
// content
const mats = createMaterials();
const sky = createSky();
scene.add(sky.mesh);

const tower = createTower(mats, 7);
scene.add(tower.group);

const world = createWorld(mats, 21);
scene.add(world.group);

const water = createWater(world.waterGeo);
scene.add(water.mesh);

const beacon = createBeacon(mats, T.yTip);
scene.add(beacon);

const lampField = new GlowField(140, { softness: 2.2 });
scene.add(lampField.mesh);
const cityField = new GlowField(120, { softness: 2.6 });
scene.add(cityField.mesh);
const pools = new PoolField(80);
scene.add(pools.mesh);

const sparkles = createSparkles(tower.sparkles);
scene.add(sparkles.mesh);
const fireworks = createFireworks(900, 5);
scene.add(fireworks.mesh);

// light pools under the tower and the lamp posts
{
	const warm = new THREE.Color(0xffb268);
	for (const l of world.lampSpots) if (l.post) pools.add(l.post.x, 0.22, l.post.z, 24, warm);
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
		pools.add(Math.cos(a) * 78, 0.3, Math.sin(a) * 78, 140, warm);
	}
}

// objects that must not receive ink lines
scene.traverse((o) => {
	if (o.userData && o.userData.noInk) {
		o.layers.set(1);
		o.traverse((c) => c.layers.set(1));
	}
});

const pipe = createPipeline(renderer, scene, camera);

// ---------------------------------------------------------------------------
// time of day
let todName = query.get('tod') || 'day';
if (!PRESETS[todName]) todName = 'day';
const live = makePalette(todName);
let blendFrom = clonePalette(live);
let blendT = 1;
const TARGET = PRESETS[todName];

function setTod(name, instant = false) {
	if (!PRESETS[name]) return;
	if (instant) {
		blendInto(live, PRESETS[name], PRESETS[name], 1);
		targetTod = name;
		todName = name;
		blendT = 1;
	} else if (name !== targetTod) {
		blendFrom = clonePalette(live);
		targetTod = name;
		todName = name;
		blendT = 0;
	}
	syncUi();
	history.replaceState(null, '', `?tod=${name}${HIDE_UI ? '&ui=0' : ''}`);
}
let targetTod = todName;

const tmpV = new THREE.Vector3();
function applyPalette(p) {
	const ex = p.exposure;

	sun.color.copy(p.sun.color);
	sun.intensity = p.sun.intensity * ex;
	tmpV.set(p.sun.x, p.sun.y, p.sun.z).normalize();
	sun.position.copy(tmpV).multiplyScalar(1500);
	sun.target.position.set(0, 130, 0);

	fill.color.copy(p.fill.color);
	fill.intensity = p.fill.intensity * ex;
	tmpV.set(p.fill.x, p.fill.y, p.fill.z).normalize();
	fill.position.copy(tmpV).multiplyScalar(1200);

	amb.color.copy(p.amb.color);
	amb.intensity = p.amb.intensity * ex;
	hemi.color.copy(p.hemi.sky);
	hemi.groundColor.copy(p.hemi.ground);
	hemi.intensity = p.hemi.intensity * ex;

	for (const f of floods) {
		f.color.copy(p.flood.color);
		f.intensity = p.flood.intensity * (f === floods[floods.length - 1] ? 900 : 2600);
	}

	sky.mat.uniforms.uZenith.value.copy(p.sky.zenith);
	sky.mat.uniforms.uMid.value.copy(p.sky.mid);
	sky.mat.uniforms.uHorizon.value.copy(p.sky.horizon);
	sky.mat.uniforms.uSunCol.value.copy(p.sky.sun);
	sky.mat.uniforms.uSunGlow.value.copy(p.sky.sunGlow);
	sky.mat.uniforms.uGlowWarm.value.copy(p.flood.color);
	sky.mat.uniforms.uSunDir.value.copy(tmpV.set(p.sun.x, p.sun.y, p.sun.z).normalize());
	sky.mat.uniforms.uBands.value = p.sky.bands;
	sky.mat.uniforms.uSunSize.value = p.sky.sunSize;
	sky.mat.uniforms.uStars.value = p.sky.stars;
	sky.mat.uniforms.uCityGlow.value = p.sky.cityGlow;
	sky.mat.uniforms.uGlowW.value = p.sky.glowW;
	sky.mat.uniforms.uSunset.value = p.sky.sunset;
	sky.mat.uniforms.uHaze.value = p.sky.haze;

	scene.fog.color.copy(p.fog.color);
	scene.fog.near = p.fog.near;
	scene.fog.far = p.fog.far;
	renderer.setClearColor(p.fog.color, 1);

	const wu = water.mat.uniforms;
	wu.uDeep.value.copy(p.water.deep);
	wu.uMid.value.copy(p.water.mid);
	wu.uLight.value.copy(p.water.light);
	wu.uFoam.value.copy(p.water.foam);
	wu.uGlint.value.copy(p.water.glint);
	wu.uSky.value.copy(p.fog.color);
	wu.uSunDir.value.copy(tmpV.set(p.sun.x, p.sun.y, p.sun.z).normalize());
	wu.uSparkle.value = p.water.sparkle;
	wu.uAmp.value = p.water.amp;
	wu.uSkyMix.value = p.water.skyMix;
	wu.uReflColor.value.copy(p.water.reflColor);
	wu.uReflStrength.value = p.water.reflStrength;
	wu.uTower.value.set(0, 0);

	applyPaletteMaterials(mats, p);

	const iu = pipe.inkPass.uniforms;
	iu.uInkColor.value.copy(p.ink.color);
	iu.uStrength.value = p.ink.strength;
	iu.uWidth.value = p.ink.width * renderer.getPixelRatio();
	iu.uDepthT.value = p.ink.depth;
	iu.uNormalT.value = p.ink.normal;
	iu.uFogNear.value = p.fog.near;
	iu.uFogFar.value = p.fog.far;
	iu.uNear.value = camera.near;
	iu.uFar.value = camera.far;
	iu.uGrade.value.copy(p.tint.grade);
	iu.uGradeAmount.value = p.tint.amount;
	iu.uVignette.value = p.tint.vignette;
	iu.uSaturate.value = p.tint.saturate;

	const glowGain = 0.85 + p.tint.bloom * 0.9;
	lampField.mat.uniforms.uIntensity.value = (0.05 + p.lights.lamp * 0.62) * glowGain;
	cityField.mat.uniforms.uIntensity.value = (0.04 + p.lights.lamp * 0.5) * glowGain;
	pools.mat.uniforms.uIntensity.value = p.lights.lamp * 0.2 * ( 0.6 + p.flood.intensity * 0.8 );
	lampField.mesh.visible = p.lights.lamp > 0.03;
	cityField.mesh.visible = p.lights.lamp > 0.03 && cityField.count > 0;
	pools.mesh.visible = p.lights.lamp > 0.03;
	sparkles.mat.uniforms.uOpacity.value = p.lights.sparkle;
	sparkles.mesh.visible = p.lights.sparkle > 0.01;
	fireworks.mat.uniforms.uOpacity.value = p.lights.firework;
	fireworks.mesh.visible = p.lights.firework > 0.01;
	world.anim.birds.mat.uniforms.uColor.value.copy(p.ink.color).lerp(new THREE.Color(0x1a1a22), 0.35);
	mats.beam.uniforms.uOpacity.value = p.lights.beacon * 0.55;

	{
		const css = document.documentElement.style;
		css.setProperty('--ink', '#' + p.ink.color.getHexString());
		css.setProperty('--paper', '#' + p.sky.horizon.clone().lerp(new THREE.Color(0xffffff), 0.35).getHexString());
		css.setProperty('--accent', '#' + p.sky.sun.clone().getHexString());
		css.setProperty('--sun', '#' + p.sun.color.getHexString());
	}
}

function pushGlows(p) {
	const lamp = p.lights.lamp;
	lampField.begin();
	const warm = tmpC.copy(p.flood.color);
	for (const l of world.lampSpots) {
		lampField.push(l.p.x, l.p.y, l.p.z, l.s * (0.85 + 0.15 * Math.sin(time * 2 + l.p.x)), warm, 1);
	}
	// the tower's own aureole, plus its platform lamps
	lampField.push(0, 118, 0, 430, tmpC2.copy(p.flood.color).multiplyScalar(0.42));
	for (const l of tower.lamps) {
		lampField.push(l.p.x, l.p.y, l.p.z, l.s * 1.3, warm);
	}
	lampField.push(0, T.yTip - 1, 0, 34, tmpC2.setRGB(1, 0.95, 0.85));
	lampField.end();

	cityField.begin();
	if (lamp > 0.02) {
		for (const b of world.anim.boats) {
			cityField.push(b.mesh.position.x, b.mesh.position.y + 6, b.mesh.position.z, 22, tmpC2.setRGB(1, 0.85, 0.6));
		}
		cityField.push(430, 100, -1080, 150, tmpC2.setRGB(1, 0.72, 0.35));
		cityField.push(0, 60, 985, 120, tmpC2.setRGB(1, 0.78, 0.42));
	}
	cityField.end();
}
const tmpC = new THREE.Color();
const tmpC2 = new THREE.Color();

// ---------------------------------------------------------------------------
// UI
const ui = HIDE_UI ? null : document.getElementById('ui');

// let the card state how much iron is really in the thing
const subtitle = document.querySelector('.card p');
if (subtitle) {
	subtitle.textContent = `cel-shaded study · ${tower.beams.toLocaleString('fr-FR')} beams of iron`;
}
const buttons = {};
if (HIDE_UI) document.getElementById('ui').style.display = 'none';
if (ui) {
	for (const name of TOD_ORDER) {
		const b = document.createElement('button');
		b.className = 'tod';
		b.dataset.tod = name;
		b.innerHTML = `<span class="orb ${name}"></span><span>${name}</span>`;
		b.addEventListener('click', () => setTod(name));
		ui.querySelector('.row').appendChild(b);
		buttons[name] = b;
	}
}
function syncUi() {
	if (!ui) return;
	for (const name of TOD_ORDER) buttons[name].classList.toggle('on', name === todName);
}

addEventListener('keydown', (e) => {
	const i = ['1', '2', '3'].indexOf(e.key);
	if (i >= 0) setTod(TOD_ORDER[i]);
	if (e.key === 't' || e.key === 'T') {
		setTod(TOD_ORDER[(TOD_ORDER.indexOf(todName) + 1) % 3]);
	}
	if (e.key === 'h' && ui) { ui.style.display = ui.style.display === 'none' ? '' : 'none'; }
});

// pause the auto orbit while the visitor is driving, resume after a pause
controls.addEventListener('start', () => { controls.autoRotate = false; idle = 0; });
controls.addEventListener('end', () => { idle = 0; });

// ---------------------------------------------------------------------------
// resize
function resize() {
	const w = window.innerWidth, h = window.innerHeight;
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
	renderer.setSize(w, h);
	pipe.setSize(w, h, renderer.getPixelRatio());
	pipe.inkPass.uniforms.uTexel.value.set(
		1 / (w * renderer.getPixelRatio()), 1 / (h * renderer.getPixelRatio())
	);
}
addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// loop
const t0 = performance.now();
let time = 0;            // wall-clock seconds since load: every animation is a
let dt = 0;              // pure function of this, so loads stay in lockstep
let prevTime = 0;
const INTRO = 3.4;
const camFrom = new THREE.Vector3(760, 470, 1380);
const camTo = new THREE.Vector3(368, 208, 470);
const tgtFrom = new THREE.Vector3(0, 215, 0);
const tgtTo = new THREE.Vector3(0, 132, 0);
let introDone = false;
let idle = 99;

setTod(todName, true);
resize();
applyPalette(live);

function frame() {
	time = (performance.now() - t0) / 1000;
	dt = Math.min( time - prevTime, 0.1 );
	prevTime = time;

	// time-of-day blend
	if (blendT < 1) {
		blendT = Math.min(1, blendT + dt / 1.35);
		blendInto(live, blendFrom, PRESETS[targetTod], easeInOut(blendT));
		applyPalette(live);
	}

	// camera: a slow approach, then hands over to the orbit controls
	if (!introDone) {
		const e = easeInOut(Math.min(1, time / INTRO));
		camera.position.lerpVectors(camFrom, camTo, e);
		controls.target.lerpVectors(tgtFrom, tgtTo, e);
		camera.lookAt(controls.target);
		if (time >= INTRO) {
			introDone = true;
			controls.enabled = true;
			controls.update(dt);
		}
	} else {
		idle += dt;
		controls.autoRotate = time > 13 && idle > 4.5;
		controls.update(dt);
	}

	const p = live;
	sky.mesh.position.copy(camera.position);
	sky.mat.uniforms.uTime.value = time;
	water.mat.uniforms.uTime.value = time;

	animateFlag(tower.flag, time);
	beacon.rotation.y = time * 0.55;
	if (fireworks.mesh.visible) fireworks.update(time);
	sparkles.mat.uniforms.uTime.value = time;

	const projScale = renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan((camera.fov * Math.PI / 180) / 2));
	sparkles.mat.uniforms.uProj.value = projScale * 0.55;
	fireworks.mat.uniforms.uProj.value = projScale * 0.5;

	// cloud altitude follows the mood
	for (const c of world.anim.clouds) c.mesh.scale.y = c.mesh.scale.x * p.cloudY;

	updateWorld(world, dt, time, world.river);
	pushGlows(p);

	pipe.renderInk(renderer, p.fog.color);
	pipe.composer.render(dt);
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// fade the title card a little after a while
if (ui) setTimeout(() => ui.classList.add('calm'), 7000);
