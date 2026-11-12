// Small shared helpers: seeded randomness, curve ribbons, geometry tidying.
import * as THREE from 'three';

/** Deterministic PRNG so two loads of the page look alike. */
export function makeRng(seed = 1) {
	let s = seed >>> 0;
	function next() {
		s = (s + 0x6d2b79f5) | 0;
		let t = Math.imul(s ^ (s >>> 15), 1 | s);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	return {
		next,
		range: (a, b) => a + (b - a) * next(),
		int: (a, b) => Math.floor(a + (b - a + 1) * next()),
		sym: (m = 1) => (next() * 2 - 1) * m,
		sign: () => (next() < 0.5 ? -1 : 1),
		pick: (arr) => arr[Math.min(arr.length - 1, Math.floor(next() * arr.length))],
		chance: (p) => next() < p,
	};
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
	const t = clamp((x - e0) / (e1 - e0), 0, 1);
	return t * t * (3 - 2 * t);
};
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

/** Exponential smoothing that is frame-rate independent. */
export const dampAngle = (cur, target, lambda, dt) => {
	let d = target - cur;
	while (d > Math.PI) d -= Math.PI * 2;
	while (d < -Math.PI) d += Math.PI * 2;
	return cur + d * (1 - Math.exp(-lambda * dt));
};

/**
 * Horizontal-perpendicular normal of a curve at t (in the XZ plane).
 */
export function curveFrame(curve, t) {
	const p = curve.getPointAt(t);
	const tan = curve.getTangentAt(t);
	let nx = tan.z, nz = -tan.x;
	const l = Math.hypot(nx, nz) || 1;
	nx /= l; nz /= l;
	return { px: p.x, py: p.y, pz: p.z, tx: tan.x, tz: tan.z, nx, nz };
}

/** A new curve offset sideways from `curve` by `dist` (signed, along its XZ normal). */
export function offsetCurve(curve, dist, samples = 64, yAdd = 0) {
	const pts = [];
	for (let i = 0; i <= samples; i++) {
		const f = curveFrame(curve, i / samples);
		pts.push(new THREE.Vector3(f.px + f.nx * dist, f.py + yAdd, f.pz + f.nz * dist));
	}
	return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.35);
}

/**
 * A quad strip swept along a curve. aOff/aY and bOff/bY describe the two rails
 * of the strip (offset sideways, absolute height).
 */
export function stripGeometry(curve, segs, aOff, aY, bOff, bY, uvScale = 0.05) {
	const pos = [], uvs = [], idx = [];
	for (let i = 0; i <= segs; i++) {
		const t = i / segs;
		const f = curveFrame(curve, t);
		pos.push(f.px + f.nx * aOff, aY, f.pz + f.nz * aOff);
		pos.push(f.px + f.nx * bOff, bY, f.pz + f.nz * bOff);
		const u = (t * curve.getLength()) * uvScale;
		uvs.push(u, 0, u, 1);
	}
	for (let i = 0; i < segs; i++) {
		const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
		idx.push(a, c, b, b, c, d);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
	g.setIndex(idx);
	g.computeVertexNormals();
	return g;
}

/** Flat-ish shading: drop smoothing groups by de-indexing. */
export function faceted(geo) {
	const g = geo.index ? geo.toNonIndexed() : geo;
	g.computeVertexNormals();
	return g;
}

/**
 * Taper a geometry along +x/-x: for every vertex the perpendicular coordinates
 * are scaled by fn((x + hx) / (2hx)) where fn(0..1) -> multiplier.
 */
export function taperX(geo, fn) {
	const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position);
	const hx = (box.max.x - box.min.x) / 2;
	const cx = (box.max.x + box.min.x) / 2;
	const cy = (box.max.y + box.min.y) / 2;
	const cz = (box.max.z + box.min.z) / 2;
	const p = geo.attributes.position;
	for (let i = 0; i < p.count; i++) {
		const x = p.getX(i);
		const k = fn(clamp((x - cx) / (2 * hx) + 0.5, 0, 1));
		p.setY(i, cy + (p.getY(i) - cy) * k);
		p.setZ(i, cz + (p.getZ(i) - cz) * k);
	}
	p.needsUpdate = true;
	geo.computeVertexNormals();
	return geo;
}

/** Scale a geometry so that it fits the given world size (x,y,z). */
export function fitSize(geo, sx, sy, sz) {
	geo.computeBoundingBox();
	const b = geo.boundingBox;
	const d = new THREE.Vector3();
	b.getSize(d);
	geo.scale(sx / (d.x || 1), sy / (d.y || 1), sz / (d.z || 1));
	geo.translate(-(b.min.x + b.max.x) / 2 * (sx / (d.x || 1)), -b.min.y, -(b.min.z + b.max.z) / 2 * (sz / (d.z || 1)));
	return geo;
}

/** Sample n points on a curve at even arc length. */
export function curvePoints(curve, n) {
	const out = [];
	for (let i = 0; i < n; i++) out.push(curve.getPointAt(i / (n - 1)));
	return out;
}

/** Distance from a point to a polyline in XZ. */
export function distToPolyline(x, z, pts) {
	let best = Infinity;
	for (let i = 0; i < pts.length - 1; i++) {
		const a = pts[i], b = pts[i + 1];
		const dx = b.x - a.x, dz = b.z - a.z;
		const l2 = dx * dx + dz * dz || 1e-6;
		let t = ((x - a.x) * dx + (z - a.z) * dz) / l2;
		t = clamp(t, 0, 1);
		const px = a.x + dx * t - x, pz = a.z + dz * t - z;
		best = Math.min(best, Math.hypot(px, pz));
	}
	return best;
}

/** Set an instance matrix that stretches a unit box from a -> b. */
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _d = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
export function beamMatrix(out, ax, ay, az, bx, by, bz, tx, tz, pad = 1.05) {
	_d.set(bx - ax, by - ay, bz - az);
	const len = _d.length();
	_d.multiplyScalar(1 / (len || 1));
	_q.setFromUnitVectors(UP, _d);
	_p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
	_s.set(tx, Math.max(len, 0.001) * pad, tz);
	return out.compose(_p, _q, _s);
}

export { _m4 };
