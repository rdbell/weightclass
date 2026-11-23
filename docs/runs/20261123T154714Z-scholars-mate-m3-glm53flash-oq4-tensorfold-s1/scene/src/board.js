// Flat orthographic board rendered with three.js.
// Orientation: Black at the bottom. Files run h -> a left to right,
// ranks run 1 -> 8 top to bottom. Pieces, labels and overlays stay upright.

import * as THREE from 'three';
import { pieceTexture } from './pieces.js';

const FR = 'abcdefgh';
export const sqToWorld = (alg) => {
  const f = FR.indexOf(alg[0]);
  const r = +alg[1];
  return { x: 3.5 - f, y: 4.5 - r };  // a1 -> top-right, h8 -> bottom-left
};

const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);

const HL_STYLES = {
  last:    { color: 0xf5ec63, opacity: 0.5 },
  threat:  { color: 0xd94f43, opacity: 0.5 },
  support: { color: 0x7fa650, opacity: 0.55 },
  info:    { color: 0x5b8bd6, opacity: 0.5 },
};
const ARROW_COLORS = { threat: 0xe14b3f, support: 0x7fa650, info: 0x5b8bd6 };

export function createBoardScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, -10, 10);
  camera.position.z = 5;

  // ---- frame + board ----
  const frameShape = new THREE.Shape();
  {
    const w = 9.5, r = 0.7, h = w;
    frameShape.moveTo(-w / 2 + r, -w / 2);
    frameShape.lineTo(w / 2 - r, -w / 2);
    frameShape.quadraticCurveTo(w / 2, -w / 2, w / 2, -w / 2 + r);
    frameShape.lineTo(w / 2, w / 2 - r);
    frameShape.quadraticCurveTo(w / 2, w / 2, w / 2 - r, w / 2);
    frameShape.lineTo(-w / 2 + r, w / 2);
    frameShape.quadraticCurveTo(-w / 2, w / 2, -w / 2, w / 2 - r);
    frameShape.lineTo(-w / 2, -w / 2 + r);
    frameShape.quadraticCurveTo(-w / 2, -w / 2, -w / 2 + r, -w / 2);
  }
  const frame = new THREE.Mesh(
    new THREE.ShapeGeometry(frameShape),
    new THREE.MeshBasicMaterial({ color: 0x3c3833 })
  );
  frame.position.z = -0.05;
  scene.add(frame);

  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({ map: makeBoardTexture(renderer) })
  );
  scene.add(board);

  // ---- highlights ----
  const hlGeo = new THREE.PlaneGeometry(1, 1);
  const hlPool = Array.from({ length: 16 }, () => {
    const m = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
      transparent: true, depthTest: false, depthWrite: false,
    }));
    m.renderOrder = 1;
    m.position.z = 0.02;
    m.visible = false;
    scene.add(m);
    return m;
  });

  function setHighlights(list = []) {
    for (const m of hlPool) m.visible = false;
    list.slice(0, hlPool.length).forEach((item, i) => {
      const m = hlPool[i];
      const st = HL_STYLES[item.kind] || HL_STYLES.last;
      const { x, y } = sqToWorld(item.sq);
      m.material.color.setHex(st.color);
      m.material.opacity = st.opacity;
      m.position.x = x; m.position.y = y;
      m.visible = true;
    });
  }

  // ---- check ring ----
  const ring = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({
      map: makeRingTexture(), transparent: true, depthTest: false, depthWrite: false, opacity: 0.9,
    })
  );
  ring.renderOrder = 2;
  ring.position.z = 0.03;
  ring.visible = false;
  scene.add(ring);

  function setCheckRing(alg) {
    if (!alg) { ring.visible = false; return; }
    const { x, y } = sqToWorld(alg);
    ring.position.x = x; ring.position.y = y;
    ring.visible = true;
  }

  // ---- pieces ----
  const pieceGeo = new THREE.PlaneGeometry(0.95, 0.95);
  const pieceMats = new Map();
  const pieceGroup = new THREE.Group();
  scene.add(pieceGroup);
  let pieceMap = {};       // square -> mesh

  function pieceMaterial(type, color) {
    const key = color + type;
    if (!pieceMats.has(key)) {
      pieceMats.set(key, new THREE.MeshBasicMaterial({
        map: pieceTexture(type, color), transparent: true, depthTest: false, depthWrite: false,
      }));
    }
    return pieceMats.get(key);
  }

  function syncPieces(boardState) {
    tweens.length = 0;
    pieceGroup.clear();
    pieceMap = {};
    for (const [alg, p] of Object.entries(boardState)) {
      const mesh = new THREE.Mesh(pieceGeo, pieceMaterial(p.type, p.color));
      const { x, y } = sqToWorld(alg);
      mesh.position.set(x, y, 0.05);
      mesh.renderOrder = 4;
      pieceGroup.add(mesh);
      pieceMap[alg] = mesh;
    }
  }

  // ---- arrows ----
  const arrowGroup = new THREE.Group();
  scene.add(arrowGroup);
  let arrows = [];

  function clearArrows() {
    for (const a of arrows) {
      arrowGroup.remove(a.mesh);
      a.mesh.geometry.dispose();
    }
    arrows = [];
  }

  function setArrows(list = [], { t = 0, delay = 0, instant = false } = {}) {
    clearArrows();
    for (const item of list) {
      const color = ARROW_COLORS[item.color] || ARROW_COLORS.support;
      const mesh = new THREE.Mesh(makeArrowGeometry(item.from, item.to),
        new THREE.MeshBasicMaterial({
          color, transparent: true, depthTest: false, depthWrite: false, opacity: instant ? 0.85 : 0,
        }));
      mesh.renderOrder = 5;
      mesh.position.z = 0.08;
      arrowGroup.add(mesh);
      const a = { mesh };
      arrows.push(a);
      if (!instant) {
        tween({
          t0: t + delay, dur: 260,
          update: (k) => {
            mesh.material.opacity = 0.85 * k;
            const s = 0.85 + 0.15 * k;
            mesh.scale.set(s, s, 1);
          },
        });
      }
    }
  }

  // ---- tween runner (driven by pausable lesson time) ----
  const tweens = [];
  function tween(o) { tweens.push(o); }

  function step(t) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const k = (t - tw.t0) / tw.dur;
      if (k >= 1) { tw.update(1); tweens.splice(i, 1); tw.done && tw.done(); }
      else if (k >= 0) tw.update(tw.ease ? tw.ease(k) : k);
    }
  }

  // ---- move animation ----
  function animateMove({ from, to, piece }, t) {
    const mesh = pieceMap[from];
    if (!mesh) return 0;
    delete pieceMap[from];
    const capMesh = pieceMap[to] || null;
    if (capMesh) delete pieceMap[to];
    pieceMap[to] = mesh;

    const p1 = sqToWorld(from), p2 = sqToWorld(to);
    const dur = 640;
    const isKnight = piece === 'N';
    tween({
      t0: t, dur, ease: easeInOut,
      update: (k) => {
        mesh.position.x = p1.x + (p2.x - p1.x) * k;
        mesh.position.y = p1.y + (p2.y - p1.y) * k;
        mesh.position.z = 0.05 + 0.075 * Math.sin(Math.PI * k);
        const s = isKnight ? 1 + 0.08 * Math.sin(Math.PI * k) : 1;
        mesh.scale.set(s, s, 1);
      },
      done: () => { mesh.position.z = 0.05; },
    });
    if (capMesh) {
      capMesh.material = capMesh.material.clone();  // fade independently of shared material
      capMesh.renderOrder = 3;
      tween({
        t0: t + 150, dur: 430, ease: easeOut,
        update: (k) => {
          capMesh.material.opacity = 1 - k;
          const s = 1 - 0.3 * k;
          capMesh.scale.set(s, s, 1);
        },
        done: () => {
          pieceGroup.remove(capMesh);
          capMesh.material.dispose();
        },
      });
    }
    return dur;
  }

  function resize(w, h) {
    renderer.setSize(w, h, false);
  }

  function render() { renderer.render(scene, camera); }

  return { setHighlights, setCheckRing, setArrows, syncPieces, animateMove, step, render, resize };
}

// ---------- texture builders ----------

function makeBoardTexture(renderer) {
  const SIZE = 1536, U = SIZE / 8;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const g = canvas.getContext('2d');
  const LIGHT = '#eae3cb', DARK = '#729455';

  for (let row = 0; row < 8; row++) {          // row 0 = top = rank 1
    for (let col = 0; col < 8; col++) {        // col 0 = left = file h
      g.fillStyle = (row + col) % 2 === 1 ? DARK : LIGHT;
      g.fillRect(col * U, row * U, U, U);
    }
  }
  // coordinate labels, rotated with the board (files h->a, ranks 1->8)
  g.font = `700 ${Math.round(U * 0.24)}px ui-sans-serif, system-ui, sans-serif`;
  g.textBaseline = 'alphabetic';
  for (let col = 0; col < 8; col++) {          // bottom edge: file letters
    const dark = (7 + col) % 2 === 1;
    g.fillStyle = dark ? LIGHT : DARK;
    g.fillText(FR[7 - col], col * U + U * 0.09, SIZE - U * 0.07);
  }
  for (let row = 0; row < 8; row++) {          // left edge: rank numbers
    const dark = (row + 0) % 2 === 1;
    g.fillStyle = dark ? LIGHT : DARK;
    g.fillText(String(row + 1), U * 0.08, row * U + U * 0.3);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function makeRingTexture() {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const g = canvas.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S * 0.5);
  grad.addColorStop(0, 'rgba(200,42,32,0.95)');
  grad.addColorStop(0.55, 'rgba(200,42,32,0.55)');
  grad.addColorStop(1, 'rgba(200,42,32,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeArrowGeometry(fromAlg, toAlg) {
  const p1 = sqToWorld(fromAlg), p2 = sqToWorld(toAlg);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const w = 0.17, hw = 0.36;
  const x0 = 0.3;                 // tail inset from source centre
  const xs = len - 0.42;          // shaft end / head base
  const tip = len - 0.16;
  const shape = new THREE.Shape();
  shape.moveTo(x0, -w);
  shape.lineTo(xs, -w);
  shape.lineTo(xs, -hw);
  shape.lineTo(tip, 0);
  shape.lineTo(xs, hw);
  shape.lineTo(xs, w);
  shape.lineTo(x0, w);
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  const mesh = { geo };
  // bake rotation into geometry so scaling animates around the tail
  geo.rotateZ(ang);
  geo.translate(p1.x, p1.y, 0);
  return mesh.geo;
}
