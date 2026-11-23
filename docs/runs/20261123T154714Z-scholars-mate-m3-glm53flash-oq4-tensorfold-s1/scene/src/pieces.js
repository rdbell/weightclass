// Hand-drawn vector chess piece artwork, rasterised to canvas textures.
// Every shape is authored here in a 0-100 coordinate box (y grows downward);
// no external images or fonts are used.

import * as THREE from 'three';

const S = 256;
const U = S / 100;

const PALETTE = {
  w: { fill: '#f6edd8', stroke: '#3f382e', detail: '#3f382e' },
  b: { fill: '#3d372e', stroke: '#ece2c6', detail: '#ece2c6' },
};

const cache = new Map();

function circle(ctx, cx, cy, r) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shape(ctx, C, build, lw = 5) {
  build(ctx);
  ctx.fillStyle = C.fill;
  ctx.shadowColor = 'rgba(18,14,8,0.30)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 3;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = C.stroke;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function detail(ctx, C, build, lw = 3.5) {
  build(ctx);
  ctx.strokeStyle = C.detail;
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

// ---------- per-piece builders (all coordinates in the 0-100 box) ----------

function drawPawn(ctx, C) {
  shape(ctx, C, (c) => {           // flared body
    c.beginPath();
    c.moveTo(38, 46);
    c.bezierCurveTo(38, 60, 32, 72, 27, 81);
    c.lineTo(73, 81);
    c.bezierCurveTo(68, 72, 62, 60, 62, 46);
    c.closePath();
  });
  shape(ctx, C, (c) => rrect(c, 39, 43, 22, 9, 4.5));   // collar
  shape(ctx, C, (c) => circle(c, 50, 30, 12), 4.5);     // head
  shape(ctx, C, (c) => rrect(c, 26, 80, 48, 10, 3.5));  // plinth
}

function drawRook(ctx, C) {
  shape(ctx, C, (c) => {           // crenellated crown
    c.beginPath();
    c.moveTo(28, 30);
    c.lineTo(28, 13); c.lineTo(39, 13); c.lineTo(39, 21);
    c.lineTo(45.5, 21); c.lineTo(45.5, 13); c.lineTo(54.5, 13);
    c.lineTo(54.5, 21); c.lineTo(61, 21); c.lineTo(61, 13);
    c.lineTo(72, 13); c.lineTo(72, 30);
    c.closePath();
  });
  shape(ctx, C, (c) => rrect(c, 26, 29, 48, 7, 2));     // ledge
  shape(ctx, C, (c) => {           // shaft
    c.beginPath();
    c.moveTo(37, 36); c.lineTo(63, 36); c.lineTo(67, 70); c.lineTo(33, 70);
    c.closePath();
  });
  shape(ctx, C, (c) => {           // base flare
    c.beginPath();
    c.moveTo(31, 70); c.lineTo(69, 70); c.lineTo(73, 81); c.lineTo(27, 81);
    c.closePath();
  });
  shape(ctx, C, (c) => rrect(c, 24, 80, 52, 10, 3.5));
}

function drawBishop(ctx, C) {
  shape(ctx, C, (c) => circle(c, 50, 13, 5.5), 4.5);    // top ball
  shape(ctx, C, (c) => {           // mitre
    c.beginPath();
    c.moveTo(50, 18);
    c.bezierCurveTo(59, 25, 65, 33, 65, 41);
    c.bezierCurveTo(65, 51, 58, 57, 50, 57);
    c.bezierCurveTo(42, 57, 35, 51, 35, 41);
    c.bezierCurveTo(35, 33, 41, 25, 50, 18);
    c.closePath();
  });
  detail(ctx, C, (c) => {          // slit
    c.beginPath();
    c.moveTo(56, 27);
    c.lineTo(45.5, 41.5);
  }, 4);
  shape(ctx, C, (c) => rrect(c, 37, 55, 26, 8, 4));     // collar
  shape(ctx, C, (c) => {           // body
    c.beginPath();
    c.moveTo(43, 63);
    c.bezierCurveTo(41, 70, 36, 76, 31, 81);
    c.lineTo(69, 81);
    c.bezierCurveTo(64, 76, 59, 70, 57, 63);
    c.closePath();
  });
  shape(ctx, C, (c) => rrect(c, 25, 80, 50, 10, 3.5));
}

function drawKnight(ctx, C) {
  shape(ctx, C, (c) => {           // head + neck, facing left
    c.beginPath();
    c.moveTo(31, 81);
    c.bezierCurveTo(30, 68, 26, 60, 22, 52);
    c.bezierCurveTo(19, 47, 19, 42, 22, 39);
    c.bezierCurveTo(24, 37, 27, 36, 29, 35);
    c.bezierCurveTo(32, 31, 34, 28, 35, 22);
    c.lineTo(38, 11);                       // ear
    c.lineTo(45, 20);
    c.bezierCurveTo(47, 22, 49, 23, 51, 25);
    c.bezierCurveTo(60, 30, 67, 40, 69, 52);
    c.bezierCurveTo(71, 62, 71, 72, 70, 81);
    c.closePath();
  });
  detail(ctx, C, (c) => {          // mane
    c.beginPath();
    c.moveTo(45, 23);
    c.bezierCurveTo(54, 30, 61, 41, 63.5, 55);
  });
  detail(ctx, C, (c) => circle(c, 25.5, 46.5, 1.6), 2.4); // nostril
  detail(ctx, C, (c) => circle(c, 33, 29.5, 2.1), 3.4);   // eye
  shape(ctx, C, (c) => rrect(c, 25, 80, 50, 10, 3.5));
}

function drawQueen(ctx, C) {
  shape(ctx, C, (c) => {           // crown with five spikes
    c.beginPath();
    c.moveTo(27, 47);
    c.lineTo(19, 21); c.lineTo(33, 38); c.lineTo(37, 14);
    c.lineTo(45, 35); c.lineTo(50, 11); c.lineTo(55, 35);
    c.lineTo(63, 14); c.lineTo(67, 38); c.lineTo(81, 21);
    c.lineTo(73, 47);
    c.closePath();
  });
  for (const [bx, by] of [[19, 19.5], [37, 12.5], [50, 9.5], [63, 12.5], [81, 19.5]]) {
    shape(ctx, C, (c) => circle(c, bx, by, 5), 3.5);
  }
  shape(ctx, C, (c) => rrect(c, 31, 46, 38, 8, 4));     // collar
  shape(ctx, C, (c) => {           // body
    c.beginPath();
    c.moveTo(37, 54);
    c.bezierCurveTo(35, 65, 31, 74, 27, 81);
    c.lineTo(73, 81);
    c.bezierCurveTo(69, 74, 65, 65, 63, 54);
    c.closePath();
  });
  shape(ctx, C, (c) => rrect(c, 24, 80, 52, 10, 3.5));
}

function drawKing(ctx, C) {
  shape(ctx, C, (c) => rrect(c, 47.5, 2, 5, 23, 2));    // cross vertical
  shape(ctx, C, (c) => rrect(c, 38.5, 6, 23, 7, 2));    // cross arm
  shape(ctx, C, (c) => circle(c, 50, 26, 3), 3);        // orb under cross
  shape(ctx, C, (c) => {           // dome
    c.beginPath();
    c.moveTo(33, 47);
    c.bezierCurveTo(31, 33, 40, 25, 50, 25);
    c.bezierCurveTo(60, 25, 69, 33, 67, 47);
    c.closePath();
  });
  shape(ctx, C, (c) => rrect(c, 31, 46, 38, 8, 4));     // band
  shape(ctx, C, (c) => {           // body
    c.beginPath();
    c.moveTo(37, 54);
    c.bezierCurveTo(35, 65, 31, 74, 27, 81);
    c.lineTo(73, 81);
    c.bezierCurveTo(69, 74, 65, 65, 63, 54);
    c.closePath();
  });
  shape(ctx, C, (c) => rrect(c, 24, 80, 52, 10, 3.5));
}

const DRAWERS = { P: drawPawn, R: drawRook, B: drawBishop, N: drawKnight, Q: drawQueen, K: drawKing };

function makeTexture(type, color) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.scale(U, U);
  DRAWERS[type](ctx, PALETTE[color]);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export function pieceTexture(type, color) {
  const key = color + type;
  if (!cache.has(key)) cache.set(key, makeTexture(type, color));
  return cache.get(key);
}
