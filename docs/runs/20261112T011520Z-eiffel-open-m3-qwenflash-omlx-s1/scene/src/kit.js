// kit.js — tiny geometry kit used to build the whole scene by hand.
// Everything ends up as non-indexed, flat-shaded triangles with a per-vertex
// "colour multiplier" that gets baked into the vertex colours. The materials
// then only need one tint per mode, which keeps the day / dusk / night swap cheap.

import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
const _s = new THREE.Vector3();
const _u = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export function v(x = 0, y = 0, z = 0) { return new THREE.Vector3(x, y, z); }

/** Orthonormal frame around a direction. */
function frame(dir, out) {
	out ||= {};
	out.dir = _d.copy(dir).normalize();
	const ref = Math.abs(out.dir.y) > 0.92 ? new THREE.Vector3(1, 0, 0) : UP;
	out.side = _s.copy(out.dir).cross(ref).normalize();
	out.up = _u.copy(out.side).cross(out.dir).normalize();
	return out;
}

export class Geo {
	constructor() {
		this.pos = [];
		this.nrm = [];
		this.col = [];
		this._f = {};
	}

	get count() { return this.pos.length / 3; }

	/** Append a flat-shaded triangle. */
	tri(p0, p1, p2, col) {
		_a.subVectors(p1, p0);
		_b.subVectors(p2, p0);
		_d.crossVectors(_a, _b);
		if (_d.lengthSq() < 1e-12) return;
		_d.normalize();
		const c = col || [1, 1, 1];
		const { nrm } = this;
		this.pos.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
		for (let i = 0; i < 3; i++) nrm.push(_d.x, _d.y, _d.z);
		for (let i = 0; i < 3; i++) this.col.push(c[0], c[1], c[2]);
	}

	quad(p0, p1, p2, p3, col) {
		this.tri(p0, p1, p2, col);
		this.tri(p0, p2, p3, col);
	}

	/**
	 * Loft between polygonal rings. rings = [[v,v,v,...], ...].
	 * Each ring may have a different number of points only if `cap` handles it,
	 * so keep a constant point count per loft.
	 */
	loft(rings, col, capStart = true, capEnd = true) {
		const n = rings[0].length;
		const closed = true;
		for (let r = 0; r + 1 < rings.length; r++) {
			const a = rings[r], b = rings[r + 1];
			for (let i = 0; i < n; i++) {
				const j = (i + 1) % n;
				this.quad(a[i], a[j], b[j], b[i], col);
			}
		}
		const last = rings[rings.length - 1];
		if (capEnd) {
			const c = ringCenter(last);
			for (let i = 0; i < n; i++) this.tri(c, last[i], last[(i + 1) % n], col);
		}
		if (capStart) {
			const c = ringCenter(rings[0]);
			for (let i = 0; i < n; i++) this.tri(c, rings[0][(i + 1) % n], rings[0][i], col);
		}
		return this;
	}

	/**
	 * A prism tube following a polyline, with a rectangular cross-section that
	 * can taper. This is the bread and butter of the lattice.
	 */
	beam(p0, p1, w0, h0, w1 = w0, h1 = h0, col = null, steps = 1) {
		const rings = [];
		const f = {};
		for (let s = 0; s <= steps; s++) {
			const t = s / steps;
			const p = new THREE.Vector3().lerpVectors(p0, p1, t);
			const next = new THREE.Vector3().lerpVectors(p0, p1, Math.min(1, t + 1 / steps));
			const prev = new THREE.Vector3().lerpVectors(p0, p1, Math.max(0, t - 1 / steps));
			_d.subVectors(next, prev);
			if (_d.lengthSq() < 1e-12) _d.set(0, 1, 0);
			frame(_d, f);
			const w = w0 + (w1 - w0) * t, h = h0 + (h1 - h0) * t;
			const hw = w * 0.5, hh = h * 0.5;
			const ring = [];
			const so = f.side, up = f.up, di = f.dir;
			for (let k = 0; k < 4; k++) {
				const sx = (k === 0 || k === 3) ? -hw : hw;
				const sy = (k < 2) ? hh : -hh;
				ring.push(new THREE.Vector3(
					p.x + so.x * sx + up.x * sy + di.x * 0,
					p.y + so.y * sx + up.y * sy,
					p.z + so.z * sx + up.z * sy
				));
			}
			rings.push(ring);
		}
		return this.loft(rings, col, true, true);
	}

	/** Convenience: axis-aligned box. */
	box(cx, cy, cz, sx, sy, sz, col = null) {
		const x0 = cx - sx / 2, x1 = cx + sx / 2;
		const y0 = cy - sy / 2, y1 = cy + sy / 2;
		const z0 = cz - sz / 2, z1 = cz + sz / 2;
		const p = [
			v(x0, y0, z0), v(x1, y0, z0), v(x1, y1, z0), v(x0, y1, z0),
			v(x0, y0, z1), v(x1, y0, z1), v(x1, y1, z1), v(x0, y1, z1)
		];
		// +z, -z, +x, -x, +y, -y
		this.quad(p[4], p[5], p[6], p[7], col);
		this.quad(p[1], p[0], p[3], p[2], col);
		this.quad(p[5], p[1], p[2], p[6], col);
		this.quad(p[0], p[4], p[7], p[3], col);
		this.quad(p[7], p[6], p[2], p[3], col);
		this.quad(p[0], p[1], p[5], p[4], col);
		return this;
	}

	/**
	 * Extrude a 2D shape (list of [x,y] in local frame) along a path of points.
	 * Used for arches and curved girders.
	 */
	extrudeAlong(path, profile, cols, col = null) {
		// profile: [[x,y],...] constant cross section; path: Vector3[]
		const f = {};
		for (let s = 0; s + 1 < path.length; s++) {
			const p0 = path[s], p1 = path[s + 1];
			_d.subVectors(p1, p0);
			if (_d.lengthSq() < 1e-12) continue;
			frame(_d, f);
			const so = f.side, up = f.up, di = f.dir;
			const ring0 = [], ring1 = [];
			for (const [lx, ly] of profile) {
				ring0.push(v(p0.x + so.x * lx + up.x * ly, p0.y + so.y * lx + up.y * ly, p0.z + so.z * lx + up.z * ly));
				ring1.push(v(p1.x + so.x * lx + up.x * ly, p1.y + so.y * lx + up.y * ly, p1.z + so.z * lx + up.z * ly));
			}
			this.loft([ring0, ring1], col, s === 0, s + 2 === path.length);
		}
		return this;
	}

	/** Low-poly blob (sphere with jittered vertices) for trees and clouds. */
	blob(cx, cy, cz, r, col = null, sx = 1, sy = 1, sz = 1, seg = 8, rings = 5, jitter = 0, rand = Math.random) {
		const ringPts = [];
		for (let i = 0; i <= rings; i++) {
			const tv = i / rings;
			const phi = tv * Math.PI;
		 const	row = [];
			const rad = Math.sin(phi) * r;
			const yy = Math.cos(phi) * r;
			const segs = (i === 0 || i === rings) ? 1 : seg;
			for (let j = 0; j < segs; j++) {
				const th = (j / segs) * Math.PI * 2 + i * 0.4;
				const jj = 1 + (rand() - 0.5) * jitter;
				row.push(v(
					cx + Math.cos(th) * rad * jj * sx,
					cy + yy * jj * sy,
					cz + Math.sin(th) * rad * jj * sz
				));
			}
			ringPts.push(row);
		}
		for (let i = 0; i + 1 < ringPts.length; i++) {
			const a = ringPts[i], b = ringPts[i + 1];
			if (a.length === 1) {
				for (let j = 0; j < b.length; j++) this.tri(a[0], b[j], b[(j + 1) % b.length], col);
			} else if (b.length === 1) {
				for (let j = 0; j < a.length; j++) this.tri(a[j], b[0], a[(j + 1) % a.length], col);
			} else {
				for (let j = 0; j < a.length; j++) {
					const k = (j + 1) % a.length;
					this.quad(a[j], a[k], b[k], b[j], col);
				}
			}
		}
		return this;
	}

	/** Append another Geo. */
	merge(other) {
		for (let i = 0; i < other.pos.length; i++) this.pos.push(other.pos[i]);
		for (let i = 0; i < other.nrm.length; i++) this.nrm.push(other.nrm[i]);
		for (let i = 0; i < other.col.length; i++) this.col.push(other.col[i]);
		return this;
	}

	/** Multiply existing vertex colours (used to fade members into shade). */
	scaleColorsFromHeight(y0, y1, k0, k1) {
		const n = this.pos.length / 3;
		for (let i = 0; i < n; i++) {
			const t = THREE.MathUtils.clamp((this.pos[i * 3 + 1] - y0) / (y1 - y0), 0, 1);
			const k = k0 + (k1 - k0) * t;
			this.col[i * 3] *= k;
			this.col[i * 3 + 1] *= k;
			this.col[i * 3 + 2] *= k;
		}
	}

	geometry() {
		const g = new THREE.BufferGeometry();
		g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
		g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
		g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
		g.computeBoundingSphere();
		return g;
	}
}

function ringCenter(ring) {
	const c = new THREE.Vector3();
	for (const p of ring) c.add(p);
	return c.multiplyScalar(1 / ring.length);
}

/** Monotone-ish centripetal Catmull-Rom through 2D control points, sampled by x. */
export function profileCurve(points) {
	const pts = points.slice();
	return function (t) {
		// points sorted by first component; interpolate both components with a
		// centripetal Catmull-Rom on the arc parameter.
		const n = pts.length;
		let i = 0;
		while (i < n - 2 && t > pts[i + 1][0]) i++;
		const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
		const span = Math.max(1e-6, p2[0] - p1[0]);
		const u = THREE.MathUtils.clamp((t - p1[0]) / span, 0, 1);
		const uu = u * u, uuu = uu * u;
		const out = [];
		for (let k = 0; k < 2; k++) {
			out.push(0.5 * ((2 * p1[k]) +
				(-p0[k] + p2[k]) * u +
				(2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * uu +
				(-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * uuu));
		}
		return out[1];
	};
}

/** Deterministic PRNG so two loads look identical. */
export function mulberry32(seed) {
	let a = seed >>> 0;
	return function () {
		a = (a + 0x6D2B79F5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** A soft round sprite texture, generated in code (no assets allowed). */
export function makeGlowTexture(size = 128, power = 2.4) {
	const c = document.createElement('canvas');
	c.width = c.height = size;
	const ctx = c.getContext('2d');
	const img = ctx.createImageData(size, size);
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1;
			const r = Math.min(1, Math.hypot(dx, dy));
			const a = Math.pow(1 - r, power);
			const i = (y * size + x) * 4;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
			img.data[i + 3] = Math.round(a * 255);
		}
	}
	ctx.putImageData(img, 0, 0);
	const tex = new THREE.CanvasTexture(c);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}
