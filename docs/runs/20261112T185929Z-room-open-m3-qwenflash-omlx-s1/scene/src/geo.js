// Small geometry helpers shared by the room and the furniture.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _v = new THREE.Vector3();

/** Cheap guard: a NaN in a transform makes geometry vanish or explode. */
function chk(x, y, z, tag) {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new Error(`non-finite position for ${tag}: ${x}, ${y}, ${z}`);
  }
}

/** Axis-aligned box built from min/max corners. */
export function boxFromBounds(mat, x0, x1, y0, y1, z0, z1, { cast = false, receive = true, name = '' } = {}) {
  chk((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, name || 'boxFromBounds');
  const g = new THREE.BoxGeometry(Math.max(1e-4, x1 - x0), Math.max(1e-4, y1 - y0), Math.max(1e-4, z1 - z0));
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.name = name;
  return mesh;
}

export function box(mat, w, h, d, x, y, z, { cast = false, receive = true, parent = null } = {}) {
  chk(x, y, z, 'box');
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1e-4, w), Math.max(1e-4, h), Math.max(1e-4, d)), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

export function rbox(mat, w, h, d, x, y, z, r = 0.04, seg = 3, { cast = true, receive = true, parent = null } = {}) {
  chk(x, y, z, 'rbox');
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.max(0.002, rr)), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

export function cyl(mat, rTop, rBottom, h, x, y, z, { seg = 16, cast = true, receive = true, parent = null, open = false } = {}) {
  chk(x, y, z, 'cyl');
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, seg, 1, open), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  if (parent) parent.add(mesh);
  return mesh;
}

export function sphere(mat, r, x, y, z, { seg = 18, cast = true, parent = null } = {}) {
  chk(x, y, z, 'sphere');
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2)), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  if (parent) parent.add(mesh);
  return mesh;
}

/** Cylinder lying along an axis ('x' | 'z' | 'y'). */
export function rod(mat, axis, len, r, x, y, z, { seg = 12, cast = true, parent = null } = {}) {
  chk(x, y, z, 'rod');
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  mesh.position.set(x, y, z);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  if (parent) parent.add(mesh);
  return mesh;
}

/**
 * Gently rippled cloth panel in the x/y plane, rippling along z.  With
 * `gather` the skirt is pinched into a narrower, deeper-folded column below
 * `gatherAt` (as if tied back).
 */
export function curtainGeometry(width, height, { waves = 3.5, amp = 0.055, segsX = 16, segsY = 10, gather = 0, gatherAt = 0.36 } = {}) {
  const g = new THREE.PlaneGeometry(width, height, segsX, segsY);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i);
    const v = p.getY(i);
    const t = (height / 2 - v) / height;
    const k = gather > 0 ? THREE.MathUtils.smoothstep(t, gatherAt, gatherAt + 0.16) * gather : 0;
    const taper = 0.55 + 0.45 * (0.5 + v / height);
    p.setX(i, u * (1 - k));
    p.setZ(i, Math.sin((u / width + 0.5) * Math.PI * 2 * waves) * amp * taper * (1 + 2.4 * k));
  }
  g.computeVertexNormals();
  return g;
}

/** Tapered, slightly bent tree branch / stem. */
export function stemGeometry(len, r0, r1, bend = 0.2, segs = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 6, segs, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + len / 2) / len;
    p.setX(i, p.getX(i) + bend * t * t);
  }
  g.computeVertexNormals();
  return g;
}

export function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

export const up = _v;
