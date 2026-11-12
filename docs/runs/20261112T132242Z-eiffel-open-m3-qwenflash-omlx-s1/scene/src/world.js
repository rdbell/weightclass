// Everything around the tower: the Seine, quays, the bridge, the Champ de Mars,
// cartoon Paris, trees, lamps, boats, cars, balloons, clouds and birds.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeRng, stripGeometry, offsetCurve, curveFrame, distToPolyline, taperX, clamp } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function createWorld(mats, seed = 21) {
	const rng = makeRng(seed);
	const group = new THREE.Group();
	const anim = { boats: [], cars: [], clouds: [], balloons: [], birds: null, people: [] };
	const lampSpots = [];   // { p: Vector3, s: size, warm: 0..1 }
	const poolSpots = [];   // flat light pools on the ground

	const add = (mesh, noInk = false) => {
		if (noInk) mesh.userData.noInk = true;
		group.add(mesh);
		return mesh;
	};

	// ---- the Seine ---------------------------------------------------------
	const river = new THREE.CatmullRomCurve3([
		V(-3000, 0, -1120), V(-1900, 0, -700), V(-1200, 0, -520), V(-700, 0, -395),
		V(-260, 0, -322), V(60, 0, -312), V(520, 0, -338), V(1050, 0, -430),
		V(1700, 0, -590), V(3000, 0, -980),
	], false, 'catmullrom', 0.4);
	const HW = 66;          // half width of the water
	const WY = -4.6;        // water level
	const QY = 0.0;         // quay level
	const SEGS = 190;

	// ---- ground, with a channel cut out for the river ----------------------
	{
		const outer = new THREE.Shape();
		outer.absarc(0, 0, 3400, 0, Math.PI * 2, false);
		const hole = new THREE.Path();
		const bank = HW + 5;
		const L = [], R = [];
		for (let i = 0; i <= 90; i++) {
			const f = curveFrame(river, i / 90);
			L.push([f.px + f.nx * bank, -(f.pz + f.nz * bank)]);
			R.push([f.px - f.nx * bank, -(f.pz - f.nz * bank)]);
		}
		hole.moveTo(L[0][0], L[0][1]);
		for (let i = 1; i < L.length; i++) hole.lineTo(L[i][0], L[i][1]);
		for (let i = R.length - 1; i >= 0; i--) hole.lineTo(R[i][0], R[i][1]);
		hole.closePath();
		outer.holes.push(hole);
		const g = new THREE.ShapeGeometry(outer, 72).rotateX(-Math.PI / 2);
		const ground = new THREE.Mesh(g, mats.ground);
		ground.receiveShadow = true;
		add(ground);
	}

	const waterGeo = stripGeometry(river, SEGS, -HW, WY, HW, WY, 0.02);

	// quay walls + promenade on both banks
	const quayParts = [];
	for (const sgn of [-1, 1]) {
		quayParts.push(stripGeometry(river, SEGS, sgn * HW, WY, sgn * (HW + 5), QY, 0.03));
		quayParts.push(stripGeometry(river, SEGS, sgn * (HW + 5), QY, sgn * (HW + 26), QY, 0.03));
	}
	const quay = new THREE.Mesh(mergeGeometries(quayParts, false), mats.quay);
	quay.receiveShadow = true;
	add(quay);

	// ---- roads -------------------------------------------------------------
	const roadNear = offsetCurve(river, -(HW + 42), 90, 0.12);
	const roadFar = offsetCurve(river, HW + 42, 90, 0.12);
	const roadGeo = [
		stripGeometry(roadNear, 130, -11, 0.12, 11, 0.12, 0.05),
		stripGeometry(roadFar, 130, -11, 0.12, 11, 0.12, 0.05),
	];
	const road = new THREE.Mesh(mergeGeometries(roadGeo, false), mats.road);
	road.receiveShadow = true;
	add(road);

	// ---- the bridge (Pont d'Iéna) ------------------------------------------
	const bridgeT = 0.5;
	const bf = curveFrame(river, bridgeT);
	const bridgeAngle = Math.atan2(bf.nx, bf.nz);
	// local (bridge) -> world: local +z runs across the river, +x is the width
	const bridgeToWorld = (lx, ly, lz) => new THREE.Vector3(
		bf.px + lx * Math.cos(bridgeAngle) + lz * Math.sin(bridgeAngle),
		ly,
		bf.pz - lx * Math.sin(bridgeAngle) + lz * Math.cos(bridgeAngle)
	);
	const bridge = new THREE.Group();
	bridge.position.set(bf.px, 0, bf.pz);
	bridge.rotation.y = bridgeAngle;
	let bridgeHalf = HW + 46;
	{
		const half = HW + 46, deckY = 3.4, w = 15;
		const g = [];
		const put = (geo, x, y, z) => { geo.translate(x, y, z); g.push(geo); };
		put(new THREE.BoxGeometry(w, 2.0, half * 2), 0, deckY - 1.0, 0);
		for (const s of [-1, 1]) {
			put(new THREE.BoxGeometry(1.1, 1.7, half * 2), s * (w / 2 - 0.6), deckY + 0.85, 0);
			for (let i = -14; i <= 14; i++) {
				const along = (i / 14) * (half - 4);
				put(new THREE.BoxGeometry(1.5, 3.4, 1.5), s * (w / 2 - 0.6), deckY + 1.7, along);
				if (i % 2 === 0) {
					lampSpots.push({
						p: bridgeToWorld(s * 7, deckY + 3.6, along),
						s: 15, warm: 1,
						post: bridgeToWorld(s * 7, deckY, along), postH: 3.0,
					});
				}
			}
		}
		for (let k = -1; k <= 1; k++) {
			const arc = new THREE.TorusGeometry(30, 2.4, 5, 16, Math.PI);
			arc.rotateY(Math.PI / 2);
			put(arc, 0, WY + 6.5, k * 52);
		}
		for (const s of [-1, 1]) put(new THREE.BoxGeometry(7, 16, 8), 0, WY + 4, s * 26);
		const mesh = new THREE.Mesh(mergeGeometries(g, false), mats.stone);
		mesh.castShadow = mesh.receiveShadow = true;
		bridge.add(mesh);
	}
	group.add(bridge);
	anim.bridge = { frame: bf, angle: bridgeAngle, half: bridgeHalf, y: 3.4 };

	// ---- plaza under the tower + the Champ de Mars -------------------------
	const plaza = new THREE.Mesh(new THREE.CircleGeometry(132, 12).rotateX(-Math.PI / 2), mats.sand);
	plaza.position.y = 0.06;
	plaza.receiveShadow = true;
	add(plaza);
	const plazaRing = new THREE.Mesh(new THREE.RingGeometry(132, 162, 44).rotateX(-Math.PI / 2), mats.path);
	plazaRing.position.y = 0.05;
	plazaRing.receiveShadow = true;
	add(plazaRing);

	// park lawn, hedges and paths running south to the École Militaire
	const lawnGeos = [], pathGeos = [], hedgeGeos = [];
	for (const s of [-1, 1]) {
		lawnGeos.push(new THREE.BoxGeometry(96, 0.3, 700).translate(s * 74, 0.08, 530));
		pathGeos.push(new THREE.BoxGeometry(26, 0.28, 720).translate(s * 172, 0.07, 530));
	}
	pathGeos.push(new THREE.BoxGeometry(370, 0.26, 30).translate(0, 0.07, 300));
	pathGeos.push(new THREE.BoxGeometry(370, 0.26, 30).translate(0, 0.07, 620));
	pathGeos.push(new THREE.BoxGeometry(34, 0.26, 760).translate(0, 0.09, 540));
	const lawn = new THREE.Mesh(mergeGeometries(lawnGeos, false), mats.lawn);
	lawn.receiveShadow = true; add(lawn);
	const paths = new THREE.Mesh(mergeGeometries(pathGeos, false), mats.path);
	paths.receiveShadow = true; add(paths);
	for (const s of [-1, 1]) {
		hedgeGeos.push(new THREE.BoxGeometry(4, 2.2, 690).translate(s * 22, 1.1, 530));
		hedgeGeos.push(new THREE.BoxGeometry(3, 1.6, 690).translate(s * 148, 0.8, 530));
	}
	const hedge = new THREE.Mesh(mergeGeometries(hedgeGeos, false), mats.hedge);
	hedge.castShadow = hedge.receiveShadow = true; add(hedge);

	// École Militaire closing the axis
	{
		const g = new THREE.Group();
		g.position.set(0, 0, 985);
		const body = new THREE.Mesh(new THREE.BoxGeometry(230, 34, 46), mats.wall);
		body.position.y = 17; body.castShadow = body.receiveShadow = true; g.add(body);
		const wing = new THREE.Mesh(new THREE.BoxGeometry(70, 24, 30), mats.wall);
		wing.position.set(0, 12, 34); wing.castShadow = true; g.add(wing);
		const roof = new THREE.Mesh(new THREE.BoxGeometry(236, 5, 52), mats.roof);
		roof.position.y = 36; roof.castShadow = true; g.add(roof);
		const drum = new THREE.Mesh(new THREE.CylinderGeometry(17, 19, 16, 14), mats.wall);
		drum.position.set(0, 44, 0); drum.castShadow = true; g.add(drum);
		const dome = new THREE.Mesh(new THREE.SphereGeometry(17, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mats.roofWarm);
		dome.position.set(0, 52, 0); dome.castShadow = true; g.add(dome);
		const spire = new THREE.Mesh(new THREE.ConeGeometry(2.4, 14, 8), mats.metal);
		spire.position.set(0, 72, 0); g.add(spire);
		group.add(g);
	}

	// ---- cartoon Paris -----------------------------------------------------
	const riverPts = [];
	for (let i = 0; i <= 90; i++) riverPts.push(river.getPointAt(i / 90));
	const facadeGeos = [], roofGeos = [];
	const paint = (geo, r, g, b) => {
		const n = geo.attributes.position.count;
		const arr = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) { arr[i * 3] = r; arr[i * 3 + 1] = g; arr[i * 3 + 2] = b; }
		geo.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3));
		return geo;
	};
	const scaleUv = (geo, su, sv) => {
		const uv = geo.attributes.uv;
		for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
		return geo;
	};
	const buildingAt = (x, z, w, d, h, ry) => {
		const tone = 0.88 + rng.next() * 0.24;
		const warm = rng.range(-0.03, 0.05);
		const g = new THREE.BoxGeometry(w, h, d);
		scaleUv(g, Math.max(1, Math.round(w / 7)), Math.max(1, Math.round(h / 4.2)));
		paint(g, tone + warm, tone, tone - warm * 0.6);
		g.rotateY(ry); g.translate(x, h / 2, z);
		facadeGeos.push(g);
		const hr = 5 + rng.range(0, 5);
		const rg = new THREE.CylinderGeometry(0.62, 0.72, 1, 4);
		rg.rotateY(Math.PI / 4);
		rg.scale((w + 2.6) / 1.4142, hr, (d + 2.6) / 1.4142);
		paint(rg, 0.9 + rng.range(-0.06, 0.06), 0.92, 1.0);
		rg.rotateY(ry); rg.translate(x, h + hr / 2 - 0.2, z);
		roofGeos.push(rg);
		const nChim = rng.int(2, 4);
		for (let i = 0; i < nChim; i++) {
			const cg = new THREE.BoxGeometry(2.2, rng.range(4, 8), 2.2);
			paint(cg, 0.86, 0.84, 0.88);
			cg.rotateY(ry);
			cg.translate(x + rng.range(-w * 0.35, w * 0.35), h + hr + 1.5, z + rng.range(-d * 0.35, d * 0.35));
			roofGeos.push(cg);
		}
	};
	let placed = 0, guard = 0;
	while (placed < 190 && guard++ < 6000) {
		const a = rng.next() * Math.PI * 2;
		const rad = 340 + Math.pow(rng.next(), 0.62) * 1150;
		const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
		if (distToPolyline(x, z, riverPts) < 105) continue;         // keep the river clear
		if (z > 130 && z < 1060 && Math.abs(x) < 300) continue;      // keep the park clear
		if (Math.abs(x) < 250 && Math.abs(z) < 250) continue;        // keep the tower clear
		if (Math.hypot(x, z - 985) < 190) continue;
		const near = Math.hypot(x, z) < 620;
		const w = rng.range(16, near ? 30 : 44), d = rng.range(16, near ? 28 : 40);
		const h = rng.range(17, near ? 30 : 40) * (1 + 0.3 * (1 - clamp((rad - 340) / 900, 0, 1)));
		const ry = rng.range(-0.35, 0.35) + (rad > 900 ? rng.range(0, 1.2) : 0);
		buildingAt(x, z, w, d, h, ry);
		placed++;
	}
	// a few haussmann blocks lining the near quay
	for (let i = 0; i < 26; i++) {
		const t = 0.16 + 0.68 * (i / 25);
		const f = curveFrame(river, t);
		const off = -(HW + 96 + rng.range(0, 34));
		const x = f.px + f.nx * off, z = f.pz + f.nz * off;
		if (Math.abs(x) < 210 && z > -260) continue;
		buildingAt(x, z, rng.range(22, 40), rng.range(18, 28), rng.range(20, 27), Math.atan2(f.nx, f.nz) + Math.PI / 2);
	}
	const facades = new THREE.Mesh(mergeGeometries(facadeGeos, false), mats.facade);
	facades.castShadow = facades.receiveShadow = true;
	add(facades);
	const roofs = new THREE.Mesh(mergeGeometries(roofGeos, false), mats.roofed);
	roofs.castShadow = roofs.receiveShadow = true;
	add(roofs);

	// ---- the dome across the river (Les Invalides) -------------------------
	{
		const g = new THREE.Group();
		g.position.set(430, 0, -1080);
		g.rotation.y = -0.5;
		const base = new THREE.Mesh(new THREE.BoxGeometry(120, 26, 90), mats.wall);
		base.position.y = 13; base.castShadow = base.receiveShadow = true; g.add(base);
		const drum = new THREE.Mesh(new THREE.CylinderGeometry(27, 30, 30, 16), mats.wall);
		drum.position.y = 40; drum.castShadow = true; g.add(drum);
		const dome = new THREE.Mesh(new THREE.SphereGeometry(27, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), mats.roofWarm);
		dome.position.y = 54; dome.castShadow = true; g.add(dome);
		const lantern = new THREE.Mesh(new THREE.CylinderGeometry(7, 9, 16, 10), mats.wall);
		lantern.position.y = 84; g.add(lantern);
		const cap = new THREE.Mesh(new THREE.ConeGeometry(9, 18, 10), mats.roofWarm);
		cap.position.y = 100; g.add(cap);
		const spire = new THREE.Mesh(new THREE.ConeGeometry(1.6, 12, 6), mats.metal);
		spire.position.y = 115; g.add(spire);
		group.add(g);
	}

	// ---- trees -------------------------------------------------------------
	const treeSpots = [];
	// park rows: two lines of trees either side of the central alley
	for (const sx of [-1, 1]) {
		for (let i = 0; i < 21; i++) {
			for (const off of [30, 118]) {
				treeSpots.push({ x: sx * off, z: 205 + i * 34, r: rng.range(7, 9.5) });
			}
		}
	}
	for (let i = 0; i < 16; i++) {
		treeSpots.push({ x: -16, z: 195 + i * 46, r: rng.range(6, 8) });
		treeSpots.push({ x: 16, z: 195 + i * 46, r: rng.range(6, 8) });
	}
	// around the plaza and along the near bank
	for (let i = 0; i < 22; i++) {
		const a = (i / 22) * Math.PI * 2;
		treeSpots.push({ x: Math.cos(a) * 205, z: Math.sin(a) * 205, r: rng.range(8, 11) });
	}
	for (let i = 0; i < 44; i++) {
		const t = 0.05 + 0.9 * rng.next();
		const f = curveFrame(roadNear, t);
		const off = -19 - rng.range(0, 4);
		treeSpots.push({ x: f.px + f.nx * off, z: f.pz + f.nz * off, r: rng.range(6.5, 9) });
	}
	for (let i = 0; i < 60; i++) {
		const a = rng.next() * Math.PI * 2;
		const rad = 300 + rng.next() * 900;
		const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
		if (distToPolyline(x, z, riverPts) < 112) continue;
		if (z > 150 && z < 1050 && Math.abs(x) < 260) continue;
		treeSpots.push({ x, z, r: rng.range(7, 12) });
	}
	{
		const n = treeSpots.length;
		const trunkGeo = new THREE.CylinderGeometry(0.62, 0.95, 1, 6);
		trunkGeo.translate(0, 0.5, 0);
		const blobGeo = new THREE.IcosahedronGeometry(1, 2);
		const coneGeo = new THREE.ConeGeometry(1, 2, 7);
		coneGeo.translate(0, 1, 0);
		const trunks = new THREE.InstancedMesh(trunkGeo, mats.trunk, n);
		const blobs = new THREE.InstancedMesh(blobGeo, mats.leafBlob, Math.ceil(n * 0.62));
		const cones = new THREE.InstancedMesh(coneGeo, mats.hedge, n - Math.ceil(n * 0.62));
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
		let bi = 0, ci = 0;
		treeSpots.forEach((t, i) => {
			const hgt = t.r * (1.5 + rng.range(0, 0.5));
			q.setFromAxisAngle(V(0, 1, 0), rng.range(0, 6.28));
			p.set(t.x, 0, t.z);
			s.set(t.r * 0.16, hgt, t.r * 0.16);
			m.compose(p, q, s);
			trunks.setMatrixAt(i, m);
			const round = rng.chance(0.62);
			if (round && bi < blobs.count) {
				p.set(t.x, hgt + t.r * 0.35, t.z);
				s.set(t.r * rng.range(0.95, 1.25), t.r * rng.range(0.85, 1.15), t.r * rng.range(0.95, 1.25));
				m.compose(p, q, s);
				blobs.setMatrixAt(bi++, m);
			} else if (ci < cones.count) {
				p.set(t.x, hgt * 0.82, t.z);
				s.set(t.r * rng.range(0.7, 0.95), t.r * rng.range(1.1, 1.5), t.r * rng.range(0.7, 0.95));
				m.compose(p, q, s);
				cones.setMatrixAt(ci++, m);
			}
		});
		for (const im of [trunks, blobs, cones]) {
			im.count = im === blobs ? bi : im === cones ? ci : n;
			im.instanceMatrix.needsUpdate = true;
			im.castShadow = true;
			im.receiveShadow = true;
			add(im);
		}
	}

	// ---- street lamps ------------------------------------------------------
	function lamp(x, y, z, h = 7.5) { return lampSpots.push({ p: V(x, y + h, z), s: 15, warm: 1, post: V(x, 0, z), postH: h }); }
	for (let i = 0; i < 40; i++) {
		const t = 0.05 + 0.9 * (i / 39);
		const f = curveFrame(roadNear, t);
		const off = -15;
		lamp(f.px + f.nx * off, 0.1, f.pz + f.nz * off);
		const f2 = curveFrame(roadFar, t);
		lamp(f2.px + f2.nx * 15, 0.1, f2.pz + f2.nz * 15);
	}
	for (let i = 0; i < 16; i++) {
		const a = (i / 16) * Math.PI * 2 + 0.2;
		lamp(Math.cos(a) * 152, 0.1, Math.sin(a) * 152, 8.5);
		poolSpots.push({ p: V(Math.cos(a) * 152, 0.2, Math.sin(a) * 152), s: 34, warm: 1 });
	}
	for (let i = 0; i < 18; i++) {
		for (const sx of [-1, 1]) lamp(sx * 24, 0.1, 210 + i * 40, 7);
	}
	for (const s of [-1, 1]) for (let i = 0; i < 5; i++) {
		const f = curveFrame(roadNear, 0.5 + s * (0.02 + i * 0.012));
		lamp(f.px, 0.12, f.pz, 6);
	}

	{
		const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.85, 1, 0.85), mats.metal, lampSpots.filter((l) => l.post).length + 1);
		const heads = new THREE.InstancedMesh(new THREE.BoxGeometry(2.1, 2.0, 2.1), mats.glass, lampSpots.filter((l) => l.post).length + 1);
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
		let k = 0;
		for (const l of lampSpots) {
			if (!l.post) continue;
			p.copy(l.post); q.identity(); s.set(1, l.postH, 1);
			m.compose(p, q, s); posts.setMatrixAt(k, m);
			p.set(l.p.x, l.p.y - 0.6, l.p.z); s.set(1, 1, 1);
			m.compose(p, q, s); heads.setMatrixAt(k, m);
			k++;
		}
		posts.count = heads.count = k;
		posts.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = true;
		posts.castShadow = true;
		add(posts); add(heads);
	}

	// ---- boats -------------------------------------------------------------
	const boatPaint = [0xe8e3d8, 0x6ea8d8, 0xd8745e, 0x74b878];
	for (let i = 0; i < 4; i++) {
		const g = new THREE.Group();
		const hullGeo = taperX(new THREE.BoxGeometry(26, 4.2, 7.6, 4, 1, 1), (t) => 1 - 0.72 * Math.pow(t, 2.2));
		hullGeo.rotateY(-Math.PI / 2);
		const hull = new THREE.Mesh(hullGeo, new THREE.MeshToonMaterial({ color: boatPaint[i % boatPaint.length], gradientMap: mats.deck.gradientMap }));
		hull.castShadow = true;
		g.add(hull);
		const house = new THREE.Mesh(new THREE.BoxGeometry(6, 4.6, 14), new THREE.MeshToonMaterial({ color: 0xf4f0e6, gradientMap: mats.deck.gradientMap }));
		house.position.set(0, 4.3, -2);
		house.castShadow = true;
		g.add(house);
		const roofB = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.8, 15), new THREE.MeshToonMaterial({ color: boatPaint[(i + 2) % boatPaint.length], gradientMap: mats.deck.gradientMap }));
		roofB.position.set(0, 6.9, -2);
		g.add(roofB);
		const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 6, 5), mats.metal);
		mast.position.set(0, 5, 9);
		g.add(mast);
		group.add(g);
		anim.boats.push({
			mesh: g, t0: 0.12 + i * 0.21, dir: i % 2 === 0 ? 1 : -1,
			lane: (i % 2 === 0 ? -1 : 1) * 26, speed: 0.0075 + i * 0.0012, phase: rng.range(0, 6.28),
			nose: null,
		});
	}

	// ---- cars --------------------------------------------------------------
	const CAR_N = 26;
	const CAR_COLORS = ['#e0554e', '#f0c04a', '#5b8fd6', '#efefef', '#3f4a5a', '#68b56f', '#c85fa8', '#8f6fd0'];
	{
		const bodyGeo = taperX(new THREE.BoxGeometry(5.2, 1.7, 2.3, 3, 1, 1), (t) => 0.72 + 0.28 * Math.sin(Math.PI * clamp(t * 1.05, 0, 1)));
		const topGeo = taperX(new THREE.BoxGeometry(2.8, 1.5, 2.1, 2, 1, 1), (t) => 0.75 + 0.25 * Math.sin(Math.PI * t));
		const bodies = new THREE.InstancedMesh(bodyGeo, mats.cars, CAR_N);
		const tops = new THREE.InstancedMesh(topGeo, mats.metal, CAR_N);
		bodies.castShadow = true;
		add(bodies); add(tops);
		const c = new THREE.Color();
		for (let i = 0; i < CAR_N; i++) {
			c.set(CAR_COLORS[i % CAR_COLORS.length]);
			bodies.setColorAt(i, c);
			c.setRGB(0.62, 0.66, 0.72);
			tops.setColorAt(i, c);
			const onBridge = i < 4;
			anim.cars.push({
				onBridge,
				t0: rng.next(),
				lane: i % 2 === 0 ? 5.5 : -5.5,
				dir: i % 2 === 0 ? 1 : -1,
				speed: rng.range(0.02, 0.045),
				i,
			});
		}
		bodies.instanceColor.needsUpdate = true;
		tops.instanceColor.needsUpdate = true;
		anim.carMesh = { bodies, tops };
	}

	// ---- people ------------------------------------------------------------
	{
		const N = 190;
		const bodyGeo = new THREE.ConeGeometry(0.62, 2.0, 6);
		bodyGeo.translate(0, 1.0, 0);
		const headGeo = new THREE.SphereGeometry(0.45, 6, 5);
		headGeo.translate(0, 2.35, 0);
		const bodies = new THREE.InstancedMesh(bodyGeo, mats.people, N);
		const heads = new THREE.InstancedMesh(headGeo, mats.people, N);
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
		const c = new THREE.Color();
		const SKIN = ['#e8c39a', '#c8956a', '#8a5c3a', '#f0d3b2'];
		for (let i = 0; i < N; i++) {
			let x, z;
			const pick = rng.next();
			if (pick < 0.42) {
				const a = rng.next() * Math.PI * 2, r = rng.range(90, 190);
				x = Math.cos(a) * r; z = Math.sin(a) * r;
			} else if (pick < 0.62) {
				x = rng.range(-30, 30); z = rng.range(180, 940);
			} else if (pick < 0.82) {
				x = rng.sign() * rng.range(60, 110); z = rng.range(190, 900);
			} else {
				const f = curveFrame(roadNear, 0.3 + rng.next() * 0.4);
				x = f.px + f.nx * -(HW + 66); z = f.pz + f.nz * -(HW + 66);
			}
			const sc = rng.range(0.85, 1.25);
			q.setFromAxisAngle(V(0, 1, 0), rng.range(0, 6.28));
			p.set(x, 0.15, z); s.set(sc, sc, sc);
			m.compose(p, q, s);
			bodies.setMatrixAt(i, m); heads.setMatrixAt(i, m);
			c.setHSL(rng.next(), rng.range(0.45, 0.8), rng.range(0.45, 0.66));
			bodies.setColorAt(i, c);
			c.set(SKIN[rng.int(0, 3)]);
			heads.setColorAt(i, c);
			if (i < 60) anim.people.push({ i, x, z, a0: rng.range(0, 6.28), r: rng.range(90, 190), sp: rng.range(0.02, 0.06) * rng.sign(), sc });
		}
		bodies.instanceColor.needsUpdate = true;
		heads.instanceColor.needsUpdate = true;
		add(bodies); add(heads);
		anim.peopleMesh = { bodies, heads };
	}

	// ---- clouds ------------------------------------------------------------
	for (let i = 0; i < 14; i++) {
		const geos = [];
		const nb = rng.int(4, 7);
		for (let b = 0; b < nb; b++) {
			const g = new THREE.IcosahedronGeometry(1, 1);
			const r = rng.range(0.55, 1.0);
			g.scale(r * rng.range(1.0, 1.5), r * rng.range(0.62, 0.85), r * rng.range(0.9, 1.3));
			g.translate(rng.range(-6, 6), rng.range(-1.2, 1.2), rng.range(-3, 3));
			geos.push(g);
		}
		const geo = mergeGeometries(geos, false);
		const mesh = new THREE.Mesh(geo, mats.cloud);
		const sc = rng.range(20, 44);
		mesh.scale.set(sc, sc, sc);
		mesh.position.set(rng.range(-1500, 1500), rng.range(290, 520), rng.range(-1400, 1150));
		mesh.rotation.y = rng.range(0, 6.28);
		add(mesh, true);
		anim.clouds.push({ mesh, x0: mesh.position.x, v: rng.range(2.5, 7) * (rng.chance(0.5) ? 1 : -1), baseY: mesh.position.y });
	}

	// ---- balloons ----------------------------------------------------------
	const BALLOON_COLORS = [['#e05a4e', '#f6f1e4'], ['#4f8fd0', '#f4d85e'], ['#59b57f', '#f0efe6']];
	for (let i = 0; i < 3; i++) {
		const g = new THREE.Group();
		const balloonGeo = new THREE.SphereGeometry(3.2, 16, 12);
		balloonGeo.scale(1, 1.3, 1);
		const pos = balloonGeo.attributes.position;
		const cols = [];
		const [ca, cb] = BALLOON_COLORS[i];
		const A = new THREE.Color(ca), B = new THREE.Color(cb);
		const tmp = new THREE.Color();
		for (let v = 0; v < pos.count; v++) {
			const ang = Math.atan2(pos.getZ(v), pos.getX(v));
			const gore = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 10) % 2;
			tmp.copy(gore ? A : B).multiplyScalar(0.86 + 0.2 * ((pos.getY(v) + 4.2) / 8.4));
			cols.push(tmp.r, tmp.g, tmp.b);
		}
		balloonGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
		const envelope = new THREE.Mesh(balloonGeo, mats.balloon);
		envelope.castShadow = true;
		g.add(envelope);
		const basket = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.6, 1.9), mats.trim);
		basket.position.y = -6.0;
		g.add(basket);
		for (let k = 0; k < 4; k++) {
			const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 4), mats.metal);
			rope.position.set((k % 2 ? 1 : -1) * 0.85, -4.7, (k < 2 ? 1 : -1) * 0.85);
			g.add(rope);
		}
		g.scale.setScalar(rng.range(3.6, 5.6));
		group.add(g);
		anim.balloons.push({
			mesh: g, r: rng.range(650, 1150), a0: rng.range(0, 6.28),
			sp: rng.range(0.012, 0.03) * (rng.chance(0.5) ? 1 : -1),
			y: rng.range(230, 430), bob: rng.range(0, 6.28),
		});
	}

	// ---- birds -------------------------------------------------------------
	anim.birds = makeBirds(mats, rng);
	group.add(anim.birds.mesh);

	// ---- grass tufts / rocks for texture ----------------------------------
	{
		const tuftGeo = new THREE.ConeGeometry(1.6, 3.2, 5);
		tuftGeo.translate(0, 1.6, 0);
		const n = 240;
		const tufts = new THREE.InstancedMesh(tuftGeo, mats.hedge, n);
		const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
		for (let i = 0; i < n; i++) {
			const a = rng.next() * Math.PI * 2;
			const r = 230 + Math.pow(rng.next(), 0.7) * 900;
			p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
			q.setFromAxisAngle(V(0, 1, 0), rng.range(0, 6.28));
			const sc = rng.range(0.5, 1.5);
			s.set(sc, rng.range(0.6, 1.8), sc);
			m.compose(p, q, s);
			tufts.setMatrixAt(i, m);
		}
		tufts.instanceMatrix.needsUpdate = true;
		add(tufts);
	}

	return { group, anim, waterGeo, river, lampSpots, poolSpots, roadNear, roadFar };
}

// ---------------------------------------------------------------------------
// birds: a flat "V" that flaps in the vertex shader
function makeBirds(mats, rng) {
	const N = 20;
	const pos = [], wing = [];
	const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, w) => {
		pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz);
		for (let i = 0; i < 6; i++) wing.push(w);
	};
	// body sliver + two wings
	quad(-0.9, 0, -0.25, 0.9, 0, 0, 0.1, 0, 0.35, -0.4, 0, 0.35, 0);
	quad(-0.1, 0, 0, -1.9, 0.5, -0.5, -0.6, 0.05, -0.35, 0.5, 0.1, -0.55, 1);
	quad(-0.1, 0, 0, -0.5, 0.05, 0.75, 0.5, 0.1, 0.62, -1.6, 0.45, 0.85, 1);
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
	geo.setAttribute('aWing', new THREE.Float32BufferAttribute(wing, 1));
	geo.computeVertexNormals();

	const mat = new THREE.ShaderMaterial({
		uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x2a2a33) } },
		vertexShader: /* glsl */`
			attribute float aWing;
			uniform float uTime;
			void main() {
				float phase = instanceMatrix[3][0] * 0.031 + instanceMatrix[3][2] * 0.017;
				float flap = sin(uTime * 9.0 + phase) * 0.6 + 0.4;
				vec3 p = position;
				p.y += aWing * flap * abs(p.x) * 0.55;
				#ifdef USE_INSTANCING
					vec4 wp = instanceMatrix * vec4( p, 1.0 );
				#else
					vec4 wp = vec4( p, 1.0 );
				#endif
				gl_Position = projectionMatrix * modelViewMatrix * wp;
			}`,
		fragmentShader: /* glsl */`
			uniform vec3 uColor;
			void main() { gl_FragColor = vec4( uColor, 1.0 ); }`,
		side: THREE.DoubleSide,
	});
	const mesh = new THREE.InstancedMesh(geo, mat, N);
	const state = [];
	const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
	for (let i = 0; i < N; i++) {
		state.push({
			r: rng.range(150, 480), a0: rng.range(0, 6.28), y: rng.range(150, 330),
			sp: rng.range(0.05, 0.13) * (rng.chance(0.5) ? 1 : -1), sc: rng.range(1.5, 3.0), bob: rng.range(0, 6.28),
		});
		m.compose(p.set(0, -500, 0), q.identity(), s.set(1, 1, 1));
		mesh.setMatrixAt(i, m);
	}
	mesh.userData.state = state;
	mesh.userData.material = mat;
	return { mesh, mat, state };
}

/** Advance the animated life of the world. Everything is a pure function of
 *  clock time, so two loads of the page are in the same pose at the same age. */
const wrap = (v, lo, hi) => { const s = hi - lo; return lo + ((((v - lo) % s) + s) % s); };
const frac = (v) => v - Math.floor(v);

export function updateWorld(world, dt, time, river) {
	const { anim } = world;

	// boats cruise along the river centre line
	for (const b of anim.boats) {
		const t = wrap(b.t0 + b.speed * time * b.dir, 0.04, 0.96);
		const f = curveFrame(river, t);
		const bob = Math.sin(time * 1.1 + b.phase) * 0.45;
		b.mesh.position.set(f.px + f.nx * b.lane, -4.6 + bob, f.pz + f.nz * b.lane);
		const heading = Math.atan2(f.tx, f.tz) + (b.dir > 0 ? 0 : Math.PI);
		b.mesh.rotation.y = heading;
		b.mesh.rotation.z = Math.sin(time * 0.9 + b.phase) * 0.025;
		b.mesh.rotation.x = Math.sin(time * 1.4 + b.phase * 1.7) * 0.02;
	}

	// cars
	const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
	const bf = anim.bridge;
	for (const c of anim.cars) {
		const u = frac(c.t0 + c.speed * time);
		const t = c.dir > 0 ? u : 1 - u;
		let px, py, pz, ang;
		if (c.onBridge) {
			const along = (t * 2 - 1) * (bf.half - 10);
			px = bf.frame.px + Math.cos(bf.angle) * c.lane + Math.sin(bf.angle) * along;
			pz = bf.frame.pz - Math.sin(bf.angle) * c.lane + Math.cos(bf.angle) * along;
			ang = bf.angle + (c.dir > 0 ? 0 : Math.PI);
			py = bf.y + 0.95;
		} else {
			const tt = 0.06 + 0.88 * t;
			const f = curveFrame(world.roadNear, tt);
			const lane = c.dir > 0 ? -4.4 : 4.4;
			px = f.px + f.nx * lane; pz = f.pz + f.nz * lane;
			ang = Math.atan2(f.tx * (c.dir > 0 ? 1 : -1), f.tz * (c.dir > 0 ? 1 : -1));
			py = 1.05;
		}
		q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
		p.set(px, py, pz);
		m.compose(p, q, s);
		anim.carMesh.bodies.setMatrixAt(c.i, m);
		anim.carMesh.tops.setMatrixAt(c.i, m);
	}
	anim.carMesh.bodies.instanceMatrix.needsUpdate = true;
	anim.carMesh.tops.instanceMatrix.needsUpdate = true;

	// clouds drift
	for (const c of anim.clouds) {
		c.mesh.position.x = wrap(c.x0 + c.v * time, -1900, 1900);
		c.mesh.position.y = c.baseY;
	}

	// balloons
	for (const b of anim.balloons) {
		const a = b.a0 + b.sp * time;
		b.mesh.position.set(Math.cos(a) * b.r, b.y + Math.sin(time * 0.35 + b.bob) * 9, Math.sin(a) * b.r);
		b.mesh.rotation.y = -a + Math.PI / 2;
		b.mesh.rotation.z = Math.sin(time * 0.4 + b.bob) * 0.05;
	}

	// birds wheel around the tower
	const bm = anim.birds.mesh, st = anim.birds.state;
	const mm = new THREE.Matrix4(), qq = new THREE.Quaternion(), pp = new THREE.Vector3(), ss = new THREE.Vector3();
	const fwd = new THREE.Vector3();
	const AX = new THREE.Vector3(1, 0, 0);
	const QZ = new THREE.Quaternion();
	for (let i = 0; i < st.length; i++) {
		const b = st[i];
		const a = b.a0 + b.sp * time;
		const x = Math.cos(a) * b.r, z = Math.sin(a) * b.r;
		const y = b.y + Math.sin(time * 0.6 + b.bob) * 14;
		fwd.set(-Math.sin(a) * Math.sign(b.sp), 0, Math.cos(a) * Math.sign(b.sp)).normalize();
		qq.setFromUnitVectors(new THREE.Vector3(1, 0, 0), fwd);
		QZ.setFromAxisAngle(AX, 0.22);
		qq.multiply(QZ);
		ss.setScalar(b.sc);
		pp.set(x, y, z);
		mm.compose(pp, qq, ss);
		bm.setMatrixAt(i, mm);
	}
	bm.instanceMatrix.needsUpdate = true;
	anim.birds.mat.uniforms.uTime.value = time;

	// strolling people
	if (anim.peopleMesh) {
		const { bodies, heads } = anim.peopleMesh;
		const pm = new THREE.Matrix4(), pq = new THREE.Quaternion(), pp2 = new THREE.Vector3(), ps = new THREE.Vector3();
		const AX2 = new THREE.Vector3(0, 1, 0);
		for (const pr of anim.people) {
			const a = pr.a0 + pr.sp * time;
			const x = Math.cos(a) * pr.r, z = Math.sin(a) * pr.r;
			pq.setFromAxisAngle(AX2, -a + Math.PI / 2);
			const step = Math.abs(Math.sin(time * 2.4 + pr.i));
			pp2.set(x, 0.15 + step * 0.13, z);
			ps.set(pr.sc, pr.sc * (1 + step * 0.05), pr.sc);
			pm.compose(pp2, pq, ps);
			bodies.setMatrixAt(pr.i, pm);
			heads.setMatrixAt(pr.i, pm);
		}
		bodies.instanceMatrix.needsUpdate = true;
		heads.instanceMatrix.needsUpdate = true;
	}
}
