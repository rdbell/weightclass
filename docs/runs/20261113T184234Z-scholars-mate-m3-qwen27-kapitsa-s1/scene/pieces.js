// Flat vector chess piece artwork, drawn on canvas (no external assets).
import * as THREE from 'three';

const S = 256; // texture size in px

const PAL = {
  w: { fill: '#F3ECDB', line: '#3D372E', detail: '#3D372E' },
  b: { fill: '#3B352D', line: '#12100B', detail: '#D3C9B3' },
};

// ---------------------------------------------------------------- silhouettes
// All paths are drawn on a 256x256 canvas, centered on x=128, base at y~214.

function pawnPath() {
  const p = new Path2D();
  p.moveTo(128, 54);
  p.bezierCurveTo(150, 54, 164, 70, 164, 90);
  p.bezierCurveTo(164, 102, 158, 111, 149, 117);
  p.bezierCurveTo(161, 126, 169, 141, 171, 159);
  p.lineTo(175, 188);
  p.bezierCurveTo(189, 193, 196, 201, 197, 214);
  p.lineTo(59, 214);
  p.bezierCurveTo(60, 201, 67, 193, 81, 188);
  p.lineTo(85, 159);
  p.bezierCurveTo(87, 141, 95, 126, 107, 117);
  p.bezierCurveTo(98, 111, 92, 102, 92, 90);
  p.bezierCurveTo(92, 70, 106, 54, 128, 54);
  p.closePath();
  return p;
}

function rookPath() {
  const p = new Path2D();
  p.moveTo(68, 56);
  p.lineTo(95, 56); p.lineTo(95, 84); p.lineTo(115, 84); p.lineTo(115, 56);
  p.lineTo(141, 56); p.lineTo(141, 84); p.lineTo(161, 84); p.lineTo(161, 56);
  p.lineTo(188, 56);
  p.lineTo(185, 152);
  p.bezierCurveTo(184, 170, 178, 180, 171, 189);
  p.bezierCurveTo(189, 195, 197, 203, 198, 214);
  p.lineTo(58, 214);
  p.bezierCurveTo(59, 203, 67, 195, 85, 189);
  p.bezierCurveTo(78, 180, 72, 170, 71, 152);
  p.closePath();
  return p;
}

function knightPath() {
  const p = new Path2D();
  p.moveTo(72, 214);
  p.lineTo(184, 214);
  p.bezierCurveTo(185, 202, 179, 191, 171, 183);
  p.bezierCurveTo(176, 168, 178, 152, 173, 136);
  p.bezierCurveTo(169, 121, 161, 108, 149, 99);
  p.bezierCurveTo(143, 95, 137, 90, 133, 82);
  p.lineTo(129, 64);
  p.lineTo(115, 77);
  p.bezierCurveTo(106, 81, 96, 88, 88, 97);
  p.bezierCurveTo(80, 105, 74, 113, 72, 121);
  p.bezierCurveTo(71, 127, 74, 131, 80, 132);
  p.bezierCurveTo(86, 133, 92, 131, 96, 128);
  p.bezierCurveTo(93, 141, 89, 155, 87, 169);
  p.bezierCurveTo(83, 178, 77, 186, 75, 194);
  p.bezierCurveTo(72, 201, 71, 207, 72, 214);
  p.closePath();
  return p;
}

function bishopPath() {
  const p = new Path2D();
  p.moveTo(128, 56);
  p.bezierCurveTo(147, 75, 157, 98, 156, 121);
  p.bezierCurveTo(155, 139, 147, 153, 135, 161);
  p.bezierCurveTo(143, 169, 147, 179, 149, 189);
  p.bezierCurveTo(168, 195, 177, 203, 178, 214);
  p.lineTo(78, 214);
  p.bezierCurveTo(79, 203, 88, 195, 107, 189);
  p.bezierCurveTo(109, 179, 113, 169, 121, 161);
  p.bezierCurveTo(109, 153, 101, 139, 100, 121);
  p.bezierCurveTo(99, 98, 109, 75, 128, 56);
  p.closePath();
  return p;
}

function queenPath() {
  const p = new Path2D();
  p.moveTo(82, 120);
  p.lineTo(70, 56);
  p.lineTo(97, 90);
  p.lineTo(110, 48);
  p.lineTo(121, 88);
  p.lineTo(128, 40);
  p.lineTo(135, 88);
  p.lineTo(146, 48);
  p.lineTo(159, 90);
  p.lineTo(186, 56);
  p.lineTo(174, 120);
  p.bezierCurveTo(165, 141, 157, 153, 155, 167);
  p.bezierCurveTo(161, 177, 167, 185, 171, 191);
  p.bezierCurveTo(188, 197, 196, 205, 197, 214);
  p.lineTo(59, 214);
  p.bezierCurveTo(60, 205, 68, 197, 85, 191);
  p.bezierCurveTo(89, 185, 95, 177, 101, 167);
  p.bezierCurveTo(99, 153, 91, 141, 82, 120);
  p.closePath();
  return p;
}

function kingPath() {
  const p = new Path2D();
  p.moveTo(86, 114);
  p.bezierCurveTo(86, 86, 103, 68, 128, 68);
  p.bezierCurveTo(153, 68, 170, 86, 170, 114);
  p.bezierCurveTo(162, 139, 153, 152, 151, 167);
  p.bezierCurveTo(157, 177, 163, 185, 167, 191);
  p.bezierCurveTo(185, 197, 193, 205, 194, 214);
  p.lineTo(62, 214);
  p.bezierCurveTo(63, 205, 71, 197, 89, 191);
  p.bezierCurveTo(93, 185, 99, 177, 105, 167);
  p.bezierCurveTo(103, 152, 94, 139, 86, 114);
  p.closePath();
  return p;
}

function crossPath() {
  const p = new Path2D();
  p.moveTo(121, 22);
  p.lineTo(135, 22);
  p.lineTo(135, 38);
  p.lineTo(151, 38);
  p.lineTo(151, 52);
  p.lineTo(135, 52);
  p.lineTo(135, 74);
  p.lineTo(121, 74);
  p.lineTo(121, 52);
  p.lineTo(105, 52);
  p.lineTo(105, 38);
  p.lineTo(121, 38);
  p.closePath();
  return p;
}

const PATHS = { p: pawnPath, r: rookPath, n: knightPath, b: bishopPath, q: queenPath, k: kingPath };

// ---------------------------------------------------------------- details

function ball(ctx, x, y, r, pal, lw) {
  const b = new Path2D();
  b.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = pal.fill;
  ctx.fill(b);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = lw;
  ctx.stroke(b);
}

function drawDetails(ctx, type, pal) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const d = pal.detail;
  if (type === 'p') {
    ctx.strokeStyle = d;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(106, 126); ctx.lineTo(150, 126); ctx.stroke();
  } else if (type === 'r') {
    ctx.strokeStyle = d;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(78, 100); ctx.lineTo(178, 100); ctx.stroke();
  } else if (type === 'n') {
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(109, 103, 5.5, 0, Math.PI * 2); ctx.fill(); // eye
    ctx.beginPath(); ctx.arc(81, 122, 3, 0, Math.PI * 2); ctx.fill(); // nostril
  } else if (type === 'b') {
    ball(ctx, 128, 46, 9, pal, 8); // knob on top
    ctx.strokeStyle = d;
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(116, 90); ctx.lineTo(138, 112); ctx.stroke(); // mitre slit
    ctx.beginPath(); ctx.moveTo(110, 168); ctx.lineTo(146, 168); ctx.stroke(); // collar
  } else if (type === 'q') {
    for (const [x, y] of [[70, 56], [110, 48], [128, 40], [146, 48], [186, 56]]) ball(ctx, x, y, 7, pal, 7);
    ctx.strokeStyle = d;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(103, 158); ctx.lineTo(153, 158); ctx.stroke();
  } else if (type === 'k') {
    const cross = crossPath();
    ctx.fillStyle = pal.fill;
    ctx.fill(cross);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 8;
    ctx.stroke(cross);
    ctx.strokeStyle = d;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(105, 158); ctx.lineTo(151, 158); ctx.stroke();
  }
}

// ---------------------------------------------------------------- textures

const texCache = new Map();

export function pieceTexture(type, color, maxAniso) {
  const key = type + color;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const pal = PAL[color];
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const sil = PATHS[type]();
  ctx.fillStyle = pal.fill;
  ctx.fill(sil);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = 9;
  ctx.stroke(sil);
  drawDetails(ctx, type, pal);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  texCache.set(key, tex);
  return tex;
}

export function shadowTexture() {
  if (texCache.has('__shadow')) return texCache.get('__shadow');
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(14, 11, 7, 0.40)');
  g.addColorStop(0.55, 'rgba(14, 11, 7, 0.18)');
  g.addColorStop(1, 'rgba(14, 11, 7, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  texCache.set('__shadow', tex);
  return tex;
}
