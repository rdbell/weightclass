import * as THREE from 'three';
import { GeoBucket, canvasTexture, makeRng } from './utils.js';

export const TOWER_H = 100;
export const TOWER_BASE_HALF = 20.6;
export const TOWER_TOP_Y = 120;

const T = (y) => y / TOWER_H;
export const halfWidth = (y) => {
  const t = Math.min(Math.max(y / TOWER_H, 0), 1);
  return 20 * Math.exp(-2.55 * t) + 0.62;
};
export const columnHalf = (y) => {
  const t = Math.min(Math.max(y / TOWER_H, 0), 1);
  return 2.62 * Math.pow(1 - t, 0.62) + 0.34 * t;
};
const yAtT = (t) => t * TOWER_H;

function facePoint(face, x, y, extraZ = 0) {
  // x runs across the face; the face plane follows the tower profile
  const z = halfWidth(y) + extraZ;
  switch (face) {
    case 0: return new THREE.Vector3(x, y, z);
    case 1: return new THREE.Vector3(z, y, -x);
    case 2: return new THREE.Vector3(-x, y, -z);
    default: return new THREE.Vector3(-z, y, x);
  }
}

function railing(bucket, halfSize, y, role = 'iron', step = 2.1) {
  const corners = [
    new THREE.Vector3(-halfSize, 0, -halfSize),
    new THREE.Vector3(halfSize, 0, -halfSize),
    new THREE.Vector3(halfSize, 0, halfSize),
    new THREE.Vector3(-halfSize, 0, halfSize),
  ];
  const height = 1.05;
  for (let s = 0; s < 4; s++) {
    const a = corners[s];
    const b = corners[(s + 1) % 4];
    const len = a.distanceTo(b);
    const n = Math.max(2, Math.round(len / step));
    for (let i = 0; i <= n; i++) {
      const p = new THREE.Vector3().lerpVectors(a, b, i / n);
      bucket.beam(role, p.clone().setY(y), p.clone().setY(y + height), 0.075, 0.075);
    }
    bucket.beam(role, a.clone().setY(y + height), b.clone().setY(y + height), 0.1, 0.1);
    bucket.beam(role, a.clone().setY(y + height * 0.5), b.clone().setY(y + height * 0.5), 0.055, 0.055);
  }
}

function kiosk(bucket, x, z, baseY, scale, rotation, roofRole = 'roofRed') {
  const g = new THREE.Group();
  const w = 4.6 * scale;
  const d = 2.7 * scale;
  const h = 2.25 * scale;
  // body
  bucket.box('cream', w, h, d, x, baseY + h / 2, z, 0, rotation, 0);
  // dark base
  bucket.box('stoneDark', w * 1.02, 0.24 * scale, d * 1.02, x, baseY + 0.12 * scale, z, 0, rotation, 0);
  // window band (glowing at night)
  const win = new THREE.BoxGeometry(w * 0.72, h * 0.38, 0.06);
  win.translate(0, baseY + h * 0.58, d / 2 + 0.03);
  win.rotateY(rotation);
  win.translate(x, 0, z);
  bucket.add('windowLit', win);
  // back window
  const win2 = new THREE.BoxGeometry(w * 0.55, h * 0.32, 0.06);
  win2.translate(0, baseY + h * 0.56, -d / 2 - 0.03);
  win2.rotateY(rotation);
  win2.translate(x, 0, z);
  bucket.add('windowLit', win2);
  // roof (pyramid)
  const roof = new THREE.ConeGeometry(w * 0.82, 1.5 * scale, 4, 1);
  roof.rotateY(Math.PI / 4 + rotation);
  roof.translate(x, baseY + h + 0.75 * scale, z);
  bucket.add(roofRole, roof);
  // gold finial
  bucket.sphere('gold', 0.13 * scale, x, baseY + h + 1.5 * scale, z);
  // little awning stripe
  bucket.box('roofBlue', w * 1.05, 0.1 * scale, d * 1.05, x, baseY + h * 0.84, z, 0, rotation, 0);
}

export function buildTower(materials) {
  const bucket = new GeoBucket();
  const rng = makeRng(9241);
  const group = new THREE.Group();
  group.name = 'EiffelTower';

  const firstY = 19;
  const secondY = 39;
  const topY = 92;

  /* ---------------- stone bases & feet ---------------- */
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sz = -1; sz <= 1; sz += 2) {
      const h = halfWidth(0);
      const cx = sx * h;
      const cz = sz * h;
      bucket.box('stone', 7.4, 1.4, 7.4, cx, 0.7, cz);
      bucket.box('stone', 6.4, 1.5, 6.4, cx, 1.95, cz);
      bucket.box('stoneDark', 5.3, 0.7, 5.3, cx, 2.95, cz);
      // little step apron
      bucket.box('stoneDark', 9.2, 0.35, 9.2, cx, 0.17, cz);
      // decorative gold band
      bucket.box('gold', 6.5, 0.16, 6.5, cx, 2.72, cz);
    }
  }

  /* ---------------- four corner trusses ---------------- */
  const legSegments = 24;
  for (let leg = 0; leg < 4; leg++) {
    const sx = leg === 0 || leg === 3 ? 1 : -1;
    const sz = leg === 0 || leg === 1 ? 1 : -1;

    for (let i = 0; i < legSegments; i++) {
      const t0 = i / legSegments;
      const t1 = (i + 1) / legSegments;
      const y0 = yAtT(t0);
      const y1 = yAtT(t1);
      const c0 = new THREE.Vector3(sx * halfWidth(y0), y0, sz * halfWidth(y0));
      const c1 = new THREE.Vector3(sx * halfWidth(y1), y1, sz * halfWidth(y1));
      const s0 = columnHalf(y0);
      const s1 = columnHalf(y1);
      const thick = THREE.MathUtils.lerp(0.22, 0.07, Math.pow(t0, 0.7));
      const brace = thick * 0.56;

      // four rails of this leg
      const corners0 = [
        [s0, s0], [s0, -s0], [-s0, -s0], [-s0, s0],
      ];
      const corners1 = [
        [s1, s1], [s1, -s1], [-s1, -s1], [-s1, s1],
      ];
      for (let c = 0; c < 4; c++) {
        const p0 = new THREE.Vector3(c0.x + corners0[c][0], y0, c0.z + corners0[c][1]);
        const p1 = new THREE.Vector3(c1.x + corners1[c][0], y1, c1.z + corners1[c][1]);
        bucket.beam('iron', p0, p1, thick, thick);
      }
      // X bracing on each face + a horizontal collar
      for (let f = 0; f < 4; f++) {
        const a = corners0[f];
        const b = corners0[(f + 1) % 4];
        const a1 = corners1[f];
        const b1 = corners1[(f + 1) % 4];
        const pA0 = new THREE.Vector3(c0.x + a[0], y0, c0.z + a[1]);
        const pB0 = new THREE.Vector3(c0.x + b[0], y0, c0.z + b[1]);
        const pA1 = new THREE.Vector3(c1.x + a1[0], y1, c1.z + a1[1]);
        const pB1 = new THREE.Vector3(c1.x + b1[0], y1, c1.z + b1[1]);
        bucket.beam('ironDark', pA0, pB1, brace, brace);
        bucket.beam('ironDark', pB0, pA1, brace, brace);
        bucket.beam('iron', pA1, pB1, brace * 0.9, brace * 0.9);
      }
    }
  }

  /* ---------------- broad arches between the legs ---------------- */
  const springY = 7.2;
  const apexY = 17.1;
  const spanHalf = halfWidth(springY) - columnHalf(springY) - 0.15;
  const N = 20;
  for (let face = 0; face < 4; face++) {
    const outer = [];
    const inner = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = -spanHalf + 2 * spanHalf * u;
      const lift = Math.cos((u - 0.5) * Math.PI);
      const y = springY + (apexY - springY) * lift;
      outer.push(facePoint(face, x, y));
      inner.push(facePoint(face, x, y - 1.35));
    }
    for (let i = 0; i < N; i++) {
      bucket.beam('iron', outer[i], outer[i + 1], 0.27, 0.27);
      bucket.beam('iron', inner[i], inner[i + 1], 0.2, 0.2);
      if (i % 1 === 0) {
        bucket.beam('ironDark', outer[i], inner[i + 1], 0.09, 0.09);
        bucket.beam('ironDark', inner[i], outer[i + 1], 0.09, 0.09);
      }
      if (i % 2 === 0) {
        bucket.beam('ironDark', outer[i], inner[i], 0.075, 0.075);
      }
    }
    // spring blocks where the arch meets the legs
    for (const side of [-1, 1]) {
      const p = facePoint(face, side * spanHalf, springY);
      bucket.box('stoneDark', 1.5, 1.2, 0.9, p.x, p.y - 0.35, p.z, 0, face * Math.PI / 2, 0);
    }
  }

  /* ---------------- latticed shaft between the legs ---------------- */
  const shaftBottom = firstY;
  const shaftTop = topY;
  const panelLevels = [];
  {
    const base = 18;
    for (let y = shaftBottom; y < shaftTop - 0.5; y += 2.9) panelLevels.push(y);
    panelLevels.push(shaftTop);
  }

  for (let face = 0; face < 4; face++) {
    for (let li = 1; li < panelLevels.length; li++) {
      const y0 = panelLevels[li - 1];
      const y1 = panelLevels[li];
      const h0 = halfWidth(y0);
      const h1 = halfWidth(y1);
      const cells0 = h0 > 8.2 ? 3 : h0 > 4.75 ? 2 : 1;
      const cells1 = h1 > 8.2 ? 3 : h1 > 4.75 ? 2 : 1;

      // horizontal chord at this level
      bucket.beam(
        'iron',
        facePoint(face, -h1 + 0.12, y1),
        facePoint(face, h1 - 0.12, y1),
        THREE.MathUtils.lerp(0.2, 0.065, li / panelLevels.length)
      );

      const cells = Math.max(cells0, cells1);
      for (let c = 0; c < cells; c++) {
        const u0 = -1 + (2 * c) / cells;
        const u1 = -1 + (2 * (c + 1)) / cells;
        const a0 = facePoint(face, u0 * (h0 - 0.2), y0);
        const b0 = facePoint(face, u1 * (h0 - 0.2), y0);
        const a1 = facePoint(face, u0 * (h1 - 0.2), y1);
        const b1 = facePoint(face, u1 * (h1 - 0.2), y1);
        bucket.beam('ironDark', a0, b1, 0.115, 0.115);
        bucket.beam('ironDark', b0, a1, 0.115, 0.115);
        // mid-level small collar for density
        if (li % 3 === 0) {
          const ym = y0 + (y1 - y0) * 0.5;
          const hm = halfWidth(ym);
          bucket.beam(
            'ironDark',
            facePoint(face, u0 * (hm - 0.2), ym),
            facePoint(face, u1 * (hm - 0.2), ym),
            0.055
          );
        }
      }
    }
  }

  /* ---------------- first platform ---------------- */
  {
    const width = 2 * (halfWidth(firstY) + columnHalf(firstY) + 1.55);
    const y = firstY;
    bucket.box('platform', width, 0.9, width, 0, y + 0.45, 0);
    bucket.box('stoneDark', width * 0.985, 0.28, width * 0.985, 0, y + 0.0, 0);
    bucket.box('gold', width + 0.1, 0.18, width + 0.1, 0, y + 0.98, 0);
    // underside lattice skirt
    for (let s = 0; s < 4; s++) {
      const rot = (s * Math.PI) / 2;
      const c = Math.cos(rot);
      const sn = Math.sin(rot);
      for (let i = -3; i <= 3; i++) {
        const px = i * (width / 7);
        const pz = width / 2 - 0.2;
        const x = px * c + pz * sn;
        const z = -px * sn + pz * c;
        bucket.beam('ironDark', new THREE.Vector3(x, y + 0.02, z), new THREE.Vector3(x * 0.92, y - 1.1, z * 0.92), 0.08);
      }
    }
    railing(bucket, width / 2 - 0.25, y + 1.02);
    // four corner pavilions
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 4 + i * Math.PI / 2;
      const r = width / 2 - 3.2;
      kiosk(bucket, Math.cos(ang) * r, Math.sin(ang) * r, y + 1.0, 0.9, -ang + Math.PI / 2);
    }
    // flag poles at the corners
    for (let i = 0; i < 4; i++) {
      const ang = i * Math.PI / 2 + Math.PI / 4;
      const r = width / 2 - 0.8;
      const px = Math.cos(ang) * r;
      const pz = Math.sin(ang) * r;
      bucket.cyl('iron', 0.045, 0.06, 2.6, 5, px, y + 2.3, pz);
      bucket.sphere('gold', 0.1, px, y + 3.62, pz);
    }
  }

  /* ---------------- second platform ---------------- */
  {
    const width = 2 * (halfWidth(secondY) + columnHalf(secondY) + 1.25);
    const y = secondY;
    bucket.box('platform', width, 0.75, width, 0, y + 0.375, 0);
    bucket.box('stoneDark', width * 0.98, 0.25, width * 0.98, 0, y - 0.02, 0);
    bucket.box('gold', width + 0.08, 0.15, width + 0.08, 0, y + 0.85, 0);
    railing(bucket, width / 2 - 0.25, y + 0.9, 'iron', 1.8);
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 4 + i * Math.PI / 2;
      const r = width / 2 - 2.2;
      kiosk(bucket, Math.cos(ang) * r, Math.sin(ang) * r, y + 0.85, 0.55, -ang + Math.PI / 2, i % 2 ? 'roofBlue' : 'roofRed');
    }
  }

  /* ---------------- upper deck + cabin ---------------- */
  {
    const width = 2 * (halfWidth(topY) + columnHalf(topY) + 1.05);
    const y = topY;
    bucket.box('platform', width, 0.8, width, 0, y + 0.4, 0);
    bucket.box('gold', width + 0.06, 0.16, width + 0.06, 0, y + 0.9, 0);
    railing(bucket, width / 2 - 0.2, y + 0.96, 'iron', 1.0);

    const cabW = width * 0.62;
    const cabH = 3.0;
    bucket.box('cream', cabW, cabH, cabW, 0, y + 0.96 + cabH / 2, 0);
    // wraparound glass
    bucket.box('windowLit', cabW * 0.86, 1.15, cabW + 0.08, 0, y + 0.96 + cabH * 0.6, 0);
    bucket.box('windowLit', cabW + 0.08, 1.15, cabW * 0.86, 0, y + 0.96 + cabH * 0.6, 0);
    // roof dome
    const dome = new THREE.SphereGeometry(cabW * 0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(0, y + 0.96 + cabH, 0);
    bucket.add('roofBlue', dome);
    bucket.sphere('gold', 0.18, 0, y + 0.96 + cabH + cabW * 0.5, 0);
    // little rail deck on top of the cabin
    bucket.cyl('gold', 0.05, 0.07, 1.8, 5, 0, y + 0.96 + cabH + cabW * 0.5 + 1.1, 0);
  }

  /* ---------------- antenna mast ---------------- */
  {
    const baseY = topY + 4.4;
    const segs = 9;
    const topMast = 116.5;
    for (let i = 0; i < segs; i++) {
      const y0 = baseY + ((topMast - baseY) * i) / segs;
      const y1 = baseY + ((topMast - baseY) * (i + 1)) / segs;
      const r0 = THREE.MathUtils.lerp(0.52, 0.2, i / segs);
      const r1 = THREE.MathUtils.lerp(0.52, 0.2, (i + 1) / segs);
      const role = i % 2 === 0 ? 'cream' : 'roofRed';
      bucket.cyl(role, r1, r0, y1 - y0, 8, 0, (y0 + y1) / 2, 0);
      if (i % 2 === 0) {
        // small service ring
        bucket.cyl('metalDark', r0 * 1.5, r0 * 1.5, 0.10, 8, 0, y0 + 0.05, 0);
      }
    }
    // crossbars / antennae
    for (const [yy, len] of [[96.5, 4.2], [101, 3.4], [105.5, 2.8], [110, 2.1]]) {
      bucket.box('metalDark', len, 0.12, 0.12, 0, yy, 0);
      bucket.box('metalDark', 0.12, 0.12, len, 0, yy, 0);
      bucket.sphere('bulb', 0.1, len / 2, yy, 0);
      bucket.sphere('bulb', -len / 2, yy, 0);
      bucket.sphere('bulb', 0, yy, len / 2);
      bucket.sphere('bulb', 0, yy, -len / 2);
    }
    // final thin mast
    bucket.cyl('cream', 0.055, 0.12, 4.2, 6, 0, 118.25, 0);
    bucket.sphere('beacon', 0.34, 0, 120.1, 0, 1, 1, 1, 12);
    bucket.box('metalDark', 1.3, 0.1, 0.1, 0, 119.4, 0);
    // tiny dishes on the mast
    for (let i = 0; i < 3; i++) {
      const ang = i * 2.1;
      const disc = new THREE.SphereGeometry(0.5, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      disc.scale(1, 0.45, 1);
      disc.rotateZ(Math.PI / 2);
      disc.rotateY(ang);
      disc.translate(Math.cos(ang) * 0.8, 103.5 + i * 1.8, Math.sin(ang) * 0.8);
      bucket.add('cream', disc);
    }
  }

  /* ---------------- light bulbs along the silhouette ---------------- */
  {
    for (let i = 0; i < 58; i++) {
      const y = 2.2 + i * 1.55;
      if (y > 91) break;
      const t = T(y);
      const s = columnHalf(y);
      const h = halfWidth(y);
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          if ((i + (sx > 0 ? 0 : 1) + (sz > 0 ? 0 : 1)) % 2 === 0) continue;
          bucket.sphere('bulb', 0.095, sx * (h + s), y, sz * (h + s), 1, 1, 1, 6);
        }
      }
    }
    // bulbs under platform edges
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = halfWidth(firstY) + columnHalf(firstY) + 1.3;
      bucket.sphere('bulb', 0.1, Math.cos(a) * r, firstY + 0.2, Math.sin(a) * r, 1, 1, 1, 6);
      bucket.sphere('bulb', 0.075, Math.cos(a) * r * 0.66, secondY + 0.2, Math.sin(a) * r * 0.66, 1, 1, 1, 6);
    }
  }

  /* ---------------- merge & meshes ---------------- */
  const merged = bucket.merge();
  for (const [role, geo] of merged) {
    const mat = materials[role];
    if (!mat) {
      console.warn('missing material', role);
      continue;
    }
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  /* ---------------- waving tricolor flag ---------------- */
  const flagTex = canvasTexture(256, 160, (ctx, w, h) => {
    ctx.fillStyle = '#2c4f9e';
    ctx.fillRect(0, 0, w / 3, h);
    ctx.fillStyle = '#f5efe0';
    ctx.fillRect(w / 3, 0, w / 3, h);
    ctx.fillStyle = '#cf3b45';
    ctx.fillRect((2 * w) / 3, 0, w / 3, h);
    // subtle stripe shading
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#000';
    for (let i = 0; i < 4; i++) ctx.fillRect(0, (i + 0.5) * (h / 4), w, 2);
  });
  const flagMat = new THREE.MeshToonMaterial({
    map: flagTex,
    side: THREE.DoubleSide,
    gradientMap: materials.__gradient,
  });
  const flagTime = { value: 0 };
  flagMat.onBeforeCompile = (shader) => {
    shader.uniforms.uFlagTime = flagTime;
    shader.vertexShader = 'uniform float uFlagTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       float fx = max(position.x + 1.5, 0.0);
       transformed.z += sin(fx * 2.6 - uFlagTime * 5.0) * 0.16 * fx;
       transformed.y += sin(fx * 1.7 - uFlagTime * 3.0) * 0.035 * fx;`
    );
  };
  const flagGeo = new THREE.PlaneGeometry(3.0, 1.8, 14, 5);
  flagGeo.translate(1.5, 0, 0);
  const flag = new THREE.Mesh(flagGeo, flagMat);
  flag.position.set(0.05, 116.4, 0);
  flag.rotation.y = 0.35;
  flag.castShadow = true;
  group.add(flag);

  // beacon glow sprite (hidden during the day)
  const beaconGlowTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,90,80,1)');
    g.addColorStop(0.2, 'rgba(255,70,60,0.7)');
    g.addColorStop(0.55, 'rgba(255,60,50,0.18)');
    g.addColorStop(1, 'rgba(255,50,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const beaconSprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: beaconGlowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  beaconSprite.scale.set(5, 5, 1);
  beaconSprite.position.set(0, 120.1, 0);
  beaconSprite.userData.noOutline = true;
  beaconSprite.userData.beaconSprite = true;
  group.add(beaconSprite);

  group.userData.flagMat = flagMat;
  group.userData.flagTime = flagTime;
  group.userData.beaconSprite = beaconSprite;

  return {
    group,
    height: TOWER_TOP_Y,
    flagTime,
    beaconSprite,
  };
}
