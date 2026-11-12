// The tower: procedural ironwork built from tapered trusses, plus platforms,
// arches, lifts and the summit antenna. Everything is instanced boxes so the
// lattice stays cheap even though there is a lot of it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng, beamMatrix } from './util.js';

export const T = { y1: 57.35, y2: 115.7, y3: 276.1, yTop: 300, yMast: 322, yTip: 331, yFlag: 337 };

// half-width of the square through the four leg centres, at height y
const PROFILE = [
	[0, 62.5], [10, 57.6], [20, 52.2], [30, 46.8], [40, 41.8], [50, 37.6], [57.35, 34.8],
	[70, 29.6], [85, 25.4], [100, 22.3], [115.7, 19.9], [135, 17.4], [160, 14.7],
	[190, 12.5], [220, 10.7], [250, 9.3], [276.1, 8.0], [290, 6.9], [300, 5.7],
];

export function halfWidth(y) {
	const P = PROFILE;
	if (y <= 0) return P[0][1];
	for (let i = 1; i < P.length; i++) {
		if (y <= P[i][0]) {
			const [y0, w0] = P[i - 1], [y1, w1] = P[i];
			const t = (y - y0) / (y1 - y0);
			return Math.exp(Math.log(w0) + (Math.log(w1) - Math.log(w0)) * t);
		}
	}
	return P[P.length - 1][1];
}

/** Width of one leg (each leg is itself a 4-post truss). */
export function legSize(y) {
	return 2.9 + 11.6 * Math.pow(halfWidth(y) / 62.5, 0.8);
}

const CORNERS = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
const SUB = [[-1, -1], [1, -1], [1, 1], [-1, 1]];

export function createTower(mats, seed = 7) {
	const rng = makeRng(seed);
	const group = new THREE.Group();
	const lattice = [], braces = [], trims = [];
	const solids = { deck: [], stone: [], plinth: [], trim: [], glass: [], mast: [] };

	const beam = (arr, a, b, tx, tz) => arr.push([a[0], a[1], a[2], b[0], b[1], b[2], tx, tz]);
	const box = (arr, w, h, d, x, y, z, ry = 0) => {
		const g = new THREE.BoxGeometry(w, h, d);
		if (ry) g.rotateY(ry);
		g.translate(x, y, z);
		solids[arr].push(g);
	};

	// ---- levels ------------------------------------------------------------
	const levels = [];
	for (let i = 0; i <= 44; i++) levels.push(T.yTop * Math.pow(i / 44, 1.09));
	for (const py of [T.y1, T.y2, T.y3]) {
		let bi = -1, bd = 1e9;
		levels.forEach((y, i) => { const d = Math.abs(y - py); if (d < bd) { bd = d; bi = i; } });
		if (bd < 3) levels[bi] = py; else levels.push(py);
	}
	levels.sort((a, b) => a - b);

	const legPoint = (sx, sz, ci, cj, y) => {
		const w = halfWidth(y), s = legSize(y);
		return [sx * w + ci * s * 0.5, y, sz * w + cj * s * 0.5];
	};
	const centrePoint = (sx, sz, y) => [sx * halfWidth(y), y, sz * halfWidth(y)];

	// ---- the four legs, all the way to the pylon top ----------------------
	for (const [sx, sz] of CORNERS) {
		for (let i = 0; i < levels.length - 1; i++) {
			const y0 = levels[i], y1 = levels[i + 1];
			const s0 = legSize(y0), s1 = legSize(y1);
			const tv = 0.155 * s0 + 0.5, td = 0.085 * s0 + 0.28;
			// the pylon above the second platform is sparser: real ironwork opens out
			const sparse = y0 > T.y2;
			const tr = ( 0.12 * s1 + 0.36 ) * ( sparse ? 0.78 : 1 );

			const a = SUB.map(([ci, cj]) => legPoint(sx, sz, ci, cj, y0));
			const b = SUB.map(([ci, cj]) => legPoint(sx, sz, ci, cj, y1));

			for (let k = 0; k < 4; k++) beam(lattice, a[k], b[k], tv, tv);      // posts
			for (let k = 0; k < 4; k++) beam(lattice, b[k], b[(k + 1) % 4], tr, tr); // ring
			const dir = (i % 2) ? 1 : -1;                                        // zigzag bracing
			if (!sparse || i % 2) {
				for (let k = 0; k < 4; k++) beam(braces, a[k], b[(k + dir + 4) % 4], td, td);
			}
		}
	}

	// ---- cross-face bracing + girders where the legs have merged ----------
	for (let i = 0; i < levels.length - 1; i++) {
		const y0 = levels[i], y1 = levels[i + 1];
		if (y0 < T.y2 - 1) continue;
		const t = THREE.MathUtils.clamp(1 - y0 / 340, 0.25, 1);
		const tg = 0.5 + 1.5 * t, tb = 0.4 + 1.0 * t;
		const xBrace = y0 < 250 || i % 2 === 0;
		for (let c = 0; c < 4; c++) {
			const [sx, sz] = CORNERS[c], [nx, nz] = CORNERS[(c + 1) % 4];
			const A0 = centrePoint(sx, sz, y0), A1 = centrePoint(sx, sz, y1);
			const B0 = centrePoint(nx, nz, y0), B1 = centrePoint(nx, nz, y1);
			beam(trims, A1, B1, tg, tg);          // horizontal girder
			if (xBrace) {
				beam(braces, A0, B1, tb, tb);     // X
				beam(braces, B0, A1, tb, tb);
			}
		}
	}
	// ties between the separate legs under the second platform
	for (const y of [T.y1 - 2.6, T.y2 - 2.8]) {
		const w = halfWidth(y), t = 2.0 + 1.6 * (1 - y / 140);
		for (let c = 0; c < 4; c++) {
			const [sx, sz] = CORNERS[c], [nx, nz] = CORNERS[(c + 1) % 4];
			beam(trims, [sx * w, y, sz * w], [nx * w, y, nz * w], t, t);
		}
	}

	// ---- the great arches --------------------------------------------------
	const ARCH_SEGS = 18;
	for (let side = 0; side < 4; side++) {
		const ax = side % 2 === 0 ? 1 : 0;      // arch plane normal axis
		const sign = side < 2 ? 1 : -1;
		const arcPoint = (u) => {
			const y = 5.5 + 47 * Math.pow(Math.max(0, 1 - u * u), 0.62);
			const w = halfWidth(y) + 1.6;
			const lateral = u * (halfWidth(y) - 2.2);
			return ax ? [w, y, lateral * sign] : [lateral * sign, y, w];
		};
		for (let i = 0; i < ARCH_SEGS; i++) {
			const u0 = -1 + (2 * i) / ARCH_SEGS, u1 = -1 + (2 * (i + 1)) / ARCH_SEGS;
			beam(trims, arcPoint(u0), arcPoint(u1), 2.6, 2.6);
			const inner = (u) => {
				const y = 5.5 + 34 * Math.pow(Math.max(0, 1 - u * u), 0.7);
				const w = halfWidth(y) + 1.4;
				const lateral = u * (halfWidth(y) - 8.5);
				return ax ? [w, y, lateral * sign] : [lateral * sign, y, w];
			};
			if (i < ARCH_SEGS) beam(trims, inner(u0), inner(u1), 1.3, 1.3);
			if (i % 2 === 0) beam(braces, arcPoint(u0), inner(u1), 0.9, 0.9);
		}
	}

	// ---- platforms ---------------------------------------------------------
	function platform(y, over, thick, opts = {}) {
		const w = halfWidth(y) + over;
		box('deck', w * 2, thick, w * 2, 0, y - thick / 2, 0);
		// underside girders
		const g = 1.5;
		for (let k = -1; k <= 1; k++) {
			beam(trims, [-w, y - thick, k * w * 0.6], [w, y - thick, k * w * 0.6], g, g);
			beam(trims, [k * w * 0.6, y - thick, -w], [k * w * 0.6, y - thick, w], g, g);
		}
		// railing
		const rh = opts.railH || 1.7;
		const step = opts.railStep || 3.2;
		const n = Math.max(4, Math.round((w * 2) / step));
		for (let e = 0; e < 4; e++) {
			const sgn = e < 2 ? 1 : -1;
			const axisX = e % 2 === 0;
			for (let i = 0; i <= n; i++) {
				const t = -w + (2 * w * i) / n;
				const px = axisX ? t : sgn * w, pz = axisX ? sgn * w : t;
				beam(trims, [px, y, pz], [px, y + rh, pz], 0.32, 0.32);
			}
			const a = axisX ? [-w, y + rh, sgn * w] : [sgn * w, y + rh, -w];
			const b = axisX ? [w, y + rh, sgn * w] : [sgn * w, y + rh, w];
			beam(trims, a, b, 0.45, 0.45);
			beam(trims, [a[0], y + rh * 0.5, a[2]], [b[0], y + rh * 0.5, b[2]], 0.3, 0.3);
		}
		return w;
	}

	// first platform: wide deck, colonnade and glass roofs
	const w1 = platform(T.y1, 7.5, 3.4, { railH: 1.9 });
	for (let e = 0; e < 4; e++) {
		const sgn = e < 2 ? 1 : -1, axisX = e % 2 === 0;
		const step = 4.4, n = Math.floor((w1 * 2) / step);
		for (let i = 0; i <= n; i++) {
			const t = -w1 + (2 * w1 * i) / n;
			const px = axisX ? t : sgn * (w1 - 2.4), pz = axisX ? sgn * (w1 - 2.4) : t;
			beam(trims, [px, T.y1, pz], [px, T.y1 + 5.4, pz], 0.85, 0.85);
		}
		const a = axisX ? [-w1, T.y1 + 5.4, sgn * (w1 - 2.4)] : [sgn * (w1 - 2.4), T.y1 + 5.4, -w1];
		const b = axisX ? [w1, T.y1 + 5.4, sgn * (w1 - 2.4)] : [sgn * (w1 - 2.4), T.y1 + 5.4, w1];
		beam(trims, a, b, 1.0, 1.0);
	}
	box('glass', (w1 - 5) * 2, 3.0, (w1 - 5) * 2, 0, T.y1 + 7.4, 0);
	box('deck', (w1 - 4) * 2, 0.9, (w1 - 4) * 2, 0, T.y1 + 9.2, 0);
	// little pavilions at the corners of the first platform
	for (const [sx, sz] of CORNERS) {
		box('deck', 12, 7, 12, sx * (w1 - 9), T.y1 + 4.5, sz * (w1 - 9));
		box('trim', 14, 1.2, 14, sx * (w1 - 9), T.y1 + 8.4, sz * (w1 - 9));
	}

	// second platform
	const w2 = platform(T.y2, 7.0, 3.0, { railH: 1.8, railStep: 2.8 });
	box('deck', (w2 - 3) * 2, 6.5, (w2 - 10) * 2, 0, T.y2 + 3.6, 0);          // restaurant
	box('glass', (w2 - 4) * 2, 2.4, (w2 - 9) * 2, 0, T.y2 + 6.6, 0);
	box('deck', (w2 - 2.4) * 2, 0.8, (w2 - 9) * 2, 0, T.y2 + 8.0, 0);
	box('deck', 9, 5.5, 9, 0, T.y2 + 3.1, 0);                                  // lift core
	for (const s of [-1, 1]) box('trim', 3.6, 0.8, (w2 - 4) * 2, s * (w2 - 2), T.y2 + 9.0, 0);

	// third platform + cupola
	const w3 = platform(T.y3, 6.2, 2.4, { railH: 1.6, railStep: 2.2 });
	box('deck', 13, 7.5, 13, 0, T.y3 + 4.0, 0);
	box('glass', 9.5, 3.2, 9.5, 0, T.y3 + 9.0, 0);
	{
		const g = new THREE.ConeGeometry(8.2, 6.5, 8);
		g.translate(0, T.y3 + 13.6, 0);
		solids.trim.push(g);
	}
	for (const [sx, sz] of CORNERS) beam(trims, [sx * (w3 - 1), T.y3, sz * (w3 - 1)], [sx * (w3 - 1), T.y3 + 3.2, sz * (w3 - 1)], 0.5, 0.5);

	// ---- summit mast -------------------------------------------------------
	const MAST_LEVELS = 7;
	for (let i = 0; i < MAST_LEVELS; i++) {
		const y0 = T.yTop + ((T.yMast - T.yTop) * i) / MAST_LEVELS;
		const y1 = T.yTop + ((T.yMast - T.yTop) * (i + 1)) / MAST_LEVELS;
		const r0 = 3.4 * (1 - i / (MAST_LEVELS + 2)), r1 = 3.4 * (1 - (i + 1) / (MAST_LEVELS + 2));
		const p0 = [[r0, y0, 0], [0, y0, r0], [-r0, y0, 0], [0, y0, -r0]];
		const p1 = [[r1, y1, 0], [0, y1, r1], [-r1, y1, 0], [0, y1, -r1]];
		for (let k = 0; k < 4; k++) {
			beam(trims, p0[k], p1[k], 0.75, 0.75);
			beam(trims, p1[k], p1[(k + 1) % 4], 0.6, 0.6);
			beam(braces, p0[k], p1[(k + 1) % 4], 0.4, 0.4);
		}
		if (i % 2 === 0) {
			const r = r0 + 3.4;
			beam(trims, [-r, y1, 0], [r, y1, 0], 0.55, 0.55);
			beam(trims, [0, y1, -r], [0, y1, r], 0.55, 0.55);
		}
	}
	beam(trims, [0, T.yMast, 0], [0, T.yTip, 0], 0.85, 0.85);
	beam(trims, [0, T.yTip, 0], [0, T.yFlag, 0], 0.42, 0.42);
	{
		const dish = new THREE.SphereGeometry(2.6, 12, 8);
		dish.scale(1, 0.45, 1);
		dish.translate(0, T.yMast - 6, 0);
		solids.mast.push(dish);
		const ball = new THREE.SphereGeometry(1.5, 12, 10);
		ball.translate(0, T.yTip - 0.6, 0);
		solids.mast.push(ball);
	}

	// ---- masonry piers & base plinths --------------------------------------
	for (const [sx, sz] of CORNERS) {
		const w = halfWidth(0), s = legSize(0);
		box('stone', s + 7.5, 2.2, s + 7.5, sx * w, 1.1, sz * w, Math.PI / 4 * 0);
		box('stone', s + 3.5, 5.0, s + 3.5, sx * w, 2.5 + 2.2, sz * w);
		box('plinth', s + 9.5, 0.7, s + 9.5, sx * w, 0.35, sz * w);
	}
	// shallow apron linking the piers
	for (let c = 0; c < 4; c++) {
		const [sx, sz] = CORNERS[c], [nx, nz] = CORNERS[(c + 1) % 4];
		const mx = ((sx + nx) / 2) * halfWidth(0), mz = ((sz + nz) / 2) * halfWidth(0);
		const len = Math.hypot((nx - sx) * halfWidth(0), (nz - sz) * halfWidth(0));
		box('plinth', len, 0.55, 13, mx, 0.27, mz, sx === nx ? Math.PI / 2 : 0);
	}

	// ---- the lifts: inclined rails on the legs -----------------------------
	function lift(from, to, side, cabinAt) {
		const dir = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
		const nrm = new THREE.Vector3(side[0], 0, side[1]).normalize();
		const off = new THREE.Vector3().crossVectors(dir, nrm).normalize().multiplyScalar(1.5);
		for (const s of [-1, 1]) {
			const a = [from[0] + off.x * s, from[1], from[2] + off.z * s];
			const b = [to[0] + off.x * s, to[1], to[2] + off.z * s];
			beam(trims, a, b, 1.05, 1.05);
		}
		for (let k = 0; k < 6; k++) {
			const t = 0.1 + 0.8 * (k / 5);
			const p = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t];
			beam(trims, [p[0] - off.x, p[1], p[2] - off.z], [p[0] + off.x, p[1], p[2] + off.z], 0.55, 0.55);
		}
		const t = cabinAt;
		const cx = from[0] + (to[0] - from[0]) * t, cy = from[1] + (to[1] - from[1]) * t, cz = from[2] + (to[2] - from[2]) * t;
		const g = new THREE.BoxGeometry(4.2, 4.6, 3.4);
		g.rotateY(Math.atan2(dir.x, dir.z));
		g.translate(cx, cy + 2.0, cz);
		solids.glass.push(g);
	}
	for (const [sx, sz] of CORNERS) {
		const w0 = halfWidth(9), w1 = halfWidth(T.y1 - 2), w2 = halfWidth(T.y2 - 3);
		const s0 = legSize(9), s1 = legSize(T.y1 - 2);
		lift([sx * (w0 + s0 * 0.5 - 0.6), 7.5, sz * (w0 - 1.5)], [sx * (w1 + s1 * 0.5 - 1.4), T.y1 - 2.2, sz * (w1 - 1.5)], [sz, -sx], 0.35 + 0.3 * (sz > 0 ? 1 : 0));
		lift([sx * (w1 - 2), T.y1 + 3.6, sz * (w1 + s1 * 0.5 - 1.4)], [sx * (w2 - 1.5), T.y2 - 2.4, sz * (halfWidth(T.y2 - 3) + legSize(T.y2 - 3) * 0.35)], [sx, sz], 0.4);
	}

	// ---- decorative arcade under the first platform ------------------------
	const arcGeo = new THREE.TorusGeometry(2.6, 0.42, 4, 10, Math.PI);
	const arcMat = mats.trim;
	const arcList = [];
	{
		const w = w1 + 1.2;
		for (let e = 0; e < 4; e++) {
			const sgn = e < 2 ? 1 : -1, axisX = e % 2 === 0;
			const n = 12;
			for (let i = 0; i < n; i++) {
				const t = -w + (2 * w * (i + 0.5)) / n;
				const px = axisX ? t : sgn * w, pz = axisX ? sgn * w : t;
				arcList.push([px, T.y1 - 3.4, pz, axisX ? 0 : Math.PI / 2]);
			}
		}
	}
	const arcs = new THREE.InstancedMesh(arcGeo, arcMat, arcList.length);
	{
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
		arcList.forEach((a, i) => {
			q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), a[3]);
			p.set(a[0], a[1], a[2]);
			m.compose(p, q, s);
			arcs.setMatrixAt(i, m);
		});
	}
	arcs.castShadow = true;
	arcs.receiveShadow = true;

	// ---- assemble ----------------------------------------------------------
	function buildBeams(list, material, tint) {
		const geo = new THREE.BoxGeometry(1, 1, 1);
		const mesh = new THREE.InstancedMesh(geo, material, list.length);
		const m = new THREE.Matrix4(), c = new THREE.Color();
		list.forEach((b, i) => {
			beamMatrix(m, b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], 1.06);
			mesh.setMatrixAt(i, m);
			const h = THREE.MathUtils.clamp((b[1] + b[4]) / 2 / 300, 0, 1);
			c.setRGB(1, 1, 1).multiplyScalar(0.94 + rng.next() * 0.1).lerp(WHITE_UP, Math.pow(h, 0.85) * 0.55);
			mesh.setColorAt(i, c);
		});
		mesh.instanceMatrix.needsUpdate = true;
		if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		return mesh;
	}
	const WHITE_UP = new THREE.Color(1.35, 1.28, 1.15);

	group.add(buildBeams(lattice, mats.tower));
	group.add(buildBeams(braces, mats.girder));
	group.add(buildBeams(trims, mats.trim));
	for (const key of ['deck', 'stone', 'plinth', 'trim', 'glass', 'mast']) {
		if (!solids[key].length) continue;
		const merged = mergeGeometries(solids[key], false);
		merged.computeVertexNormals();
		const mat = key === 'deck' ? mats.deck
			: key === 'stone' ? mats.stone
				: key === 'plinth' ? mats.plinth
					: key === 'glass' ? mats.glass
						: key === 'mast' ? mats.metal : mats.trim;
		const mesh = new THREE.Mesh(merged, mat);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		group.add(mesh);
	}
	group.add(arcs);

	// ---- flag --------------------------------------------------------------
	const flag = makeFlag();
	flag.position.set(0.15, T.yFlag - 3.0, 0);
	flag.rotation.y = 0.4;
	group.add(flag);

	// ---- sparkle seed points over the ironwork -----------------------------
	const sparklePts = [];
	const all = lattice.concat(braces, trims);
	let totalLen = 0;
	const lens = all.map((b) => {
	 const l = Math.hypot(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
		totalLen += l; return l;
	});
	const WANT = 2200;
	for (let i = 0; i < all.length && sparklePts.length / 3 < WANT; i++) {
		const b = all[i];
		const n = Math.max(1, Math.round((lens[i] / totalLen) * WANT));
		for (let k = 0; k < n && sparklePts.length / 3 < WANT; k++) {
			const t = rng.next();
			sparklePts.push(
				b[0] + (b[3] - b[0]) * t,
				b[1] + (b[4] - b[1]) * t + 0.6,
				b[2] + (b[5] - b[2]) * t
			);
		}
	}

	// ---- lamp anchors for the night lighting -------------------------------
	const lamps = [];
	for (const [sx, sz] of CORNERS) {
		lamps.push({ p: new THREE.Vector3(sx * halfWidth(0), 4, sz * halfWidth(0)), s: 34, warm: 1 });
		lamps.push({ p: new THREE.Vector3(sx * (w1 - 4), T.y1 + 10.5, sz * (w1 - 4)), s: 26, warm: 1 });
		lamps.push({ p: new THREE.Vector3(sx * (w2 - 3), T.y2 + 9.5, sz * (w2 - 3)), s: 20, warm: 1 });
	}
	lamps.push({ p: new THREE.Vector3(0, T.y3 + 16, 0), s: 16, warm: 1 });
	lamps.push({ p: new THREE.Vector3(0, T.yTip - 1, 0), s: 22, warm: 0 });

	return {
		group,
		flag,
		lamps,
		beams: lattice.length + braces.length + trims.length,
		sparkles: new Float32Array(sparklePts),
		height: T.yFlag,
		baseHalf: halfWidth(0),
		platformHalf: [w1, w2, w3],
	};
}

function makeFlag() {
	const geo = new THREE.PlaneGeometry(6.8, 4.4, 12, 4);
	geo.translate(3.4, 0, 0);            // hoist at the local origin, sheet to +x
	const pos = geo.attributes.position;
	const col = [];
	for (let i = 0; i < pos.count; i++) {
		const t = pos.getX(i) / 6.8;
		const c = t < 0.355 ? [0.13, 0.24, 0.62] : t < 0.68 ? [0.95, 0.95, 0.97] : [0.79, 0.16, 0.24];
		col.push(c[0], c[1], c[2]);
	}
	geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
	const mat = new THREE.MeshToonMaterial({ vertexColors: true, side: THREE.DoubleSide });
	const mesh = new THREE.Mesh(geo, mat);
	mesh.castShadow = false;
	mesh.userData.base = pos.array.slice();
	return mesh;
}

/** Flutters the flag; called each frame. */
export function animateFlag(flag, time) {
	const pos = flag.geometry.attributes.position;
	const base = flag.userData.base;
	for (let i = 0; i < pos.count; i++) {
		const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
		const t = Math.min(1, Math.max(0, x / 6.8));
		const w = Math.sin(t * 7.5 - time * 6.5) * 0.9 * Math.pow(t, 1.4);
		pos.setZ(i, z + w);
		pos.setY(i, y + Math.sin(t * 5.0 - time * 4.2) * 0.3 * t);
	}
	pos.needsUpdate = true;
	flag.geometry.computeVertexNormals();
}
