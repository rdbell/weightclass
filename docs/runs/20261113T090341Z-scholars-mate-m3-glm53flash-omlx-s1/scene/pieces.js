// pieces.js — hand-drawn flat chess piece artwork rendered to canvas textures.
// Each piece is drawn in a 100×100 design space, then scaled onto a 256px canvas.
import * as THREE from 'three';

const SIZE = 256;
const DESIGN = 100;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function circle(ctx, cx, cy, rad) {
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.closePath();
}
function ellipse(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.closePath();
}

const SCHEMES = {
  w: { fill: '#f6f1de', line: '#35322b', shadow: 'rgba(30,26,16,0.28)' },
  b: { fill: '#37332e', line: '#e9e4d6', shadow: 'rgba(0,0,0,0.38)' },
};

/**
 * Draw one piece into a 2D context.
 * ctx: context of a SIZE×SIZE canvas; type: 'P','N','B','R','Q','K'; color: 'w'|'b'
 */
export function drawPiece(ctx, type, color) {
  const s = SCHEMES[color];
  const k = SIZE / DESIGN;
  ctx.save();
  ctx.scale(k, k);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // soft ground shadow
  ctx.fillStyle = s.shadow;
  ellipse(ctx, 50, 89.5, 26, 3.6);
  ctx.fill();

  const LW = 4.4;
  const F = (path) => {
    ctx.beginPath();
    path(ctx);
    ctx.fillStyle = s.fill;
    ctx.fill();
    ctx.lineWidth = LW;
    ctx.strokeStyle = s.line;
    ctx.stroke();
  };
  const D = (path, w) => { // detail stroke only
    ctx.beginPath();
    path(ctx);
    ctx.lineWidth = w || 3.4;
    ctx.strokeStyle = s.line;
    ctx.stroke();
  };

  if (type === 'P') {
    F((c) => { c.moveTo(41.5, 66); c.lineTo(35, 79); c.lineTo(65, 79); c.lineTo(58.5, 66); c.closePath(); });
    F((c) => rr(c, 29.5, 77, 41, 11, 4));
    F((c) => ellipse(c, 50, 62.5, 15.5, 4.8));
    F((c) => { c.moveTo(43.5, 40); c.lineTo(45.5, 59.5); c.lineTo(54.5, 59.5); c.lineTo(56.5, 40); c.closePath(); });
    F((c) => circle(c, 50, 30, 11));
  }

  if (type === 'R') {
    F((c) => {
      c.moveTo(31, 19); c.lineTo(69, 19); c.lineTo(69, 35.5); c.lineTo(62, 35.5);
      c.lineTo(62, 28.5); c.lineTo(55, 28.5); c.lineTo(55, 35.5); c.lineTo(45, 35.5);
      c.lineTo(45, 28.5); c.lineTo(38, 28.5); c.lineTo(38, 35.5); c.lineTo(31, 35.5);
      c.closePath();
    });
    F((c) => { c.moveTo(39, 37.5); c.lineTo(61, 37.5); c.lineTo(59.5, 69); c.lineTo(40.5, 69); c.closePath(); });
    F((c) => rr(c, 34, 69, 32, 7, 2.5));
    F((c) => rr(c, 28, 76, 44, 12, 4));
  }

  if (type === 'B') {
    F((c) => circle(c, 50, 12, 4.6));
    F((c) => {
      c.moveTo(50, 16);
      c.bezierCurveTo(63, 23, 66, 38, 55, 50);
      c.lineTo(45, 50);
      c.bezierCurveTo(34, 38, 37, 23, 50, 16);
      c.closePath();
    });
    D((c) => { c.moveTo(51.5, 23.5); c.lineTo(58.5, 37); });
    F((c) => ellipse(c, 50, 52.5, 14, 4.6));
    F((c) => { c.moveTo(44, 56.5); c.lineTo(56, 56.5); c.lineTo(59.5, 75.5); c.lineTo(40.5, 75.5); c.closePath(); });
    F((c) => rr(c, 29, 76, 42, 12, 4));
  }

  if (type === 'N') {
    F((c) => rr(c, 27, 77, 46, 12, 4));
    F((c) => {
      c.moveTo(61, 77);
      c.lineTo(65, 54);
      c.bezierCurveTo(67, 42, 63, 32, 57, 27);
      c.lineTo(60.5, 16.5);
      c.lineTo(50, 23);
      c.bezierCurveTo(40, 26, 31, 35, 30, 41);
      c.lineTo(27, 47);
      c.lineTo(33, 50);
      c.lineTo(30, 53);
      c.bezierCurveTo(38, 55, 43, 53, 45, 58);
      c.bezierCurveTo(47, 64, 45, 70, 41, 77);
      c.closePath();
    });
    ctx.fillStyle = s.line;
    circle(ctx, 48, 32.5, 2);
    ctx.fill();
    circle(ctx, 32.5, 45.5, 1.7);
    ctx.fill();
    D((c) => { c.moveTo(58, 30); c.quadraticCurveTo(63.5, 40, 61.5, 50); }, 2.6);
  }

  if (type === 'Q') {
    F((c) => {
      c.moveTo(31, 42); c.lineTo(26, 18); c.lineTo(32.5, 31); c.lineTo(38, 15);
      c.lineTo(44, 30); c.lineTo(50, 13); c.lineTo(56, 30); c.lineTo(62, 15);
      c.lineTo(67.5, 31); c.lineTo(74, 18); c.lineTo(69, 42); c.closePath();
    });
    for (const [bx, by] of [[26, 14.5], [38, 11.5], [50, 9.5], [62, 11.5], [74, 14.5]]) {
      F((c) => circle(c, bx, by, 3));
    }
    F((c) => ellipse(c, 50, 44, 17, 5));
    F((c) => { c.moveTo(41.5, 48.5); c.lineTo(58.5, 48.5); c.lineTo(62, 72); c.lineTo(38, 72); c.closePath(); });
    F((c) => rr(c, 33, 72, 34, 7, 2.5));
    F((c) => rr(c, 27, 79, 46, 11, 4));
  }

  if (type === 'K') {
    F((c) => {
      c.moveTo(46.5, 5); c.lineTo(53.5, 5); c.lineTo(53.5, 12); c.lineTo(60, 12);
      c.lineTo(60, 19); c.lineTo(53.5, 19); c.lineTo(53.5, 27); c.lineTo(46.5, 27);
      c.lineTo(46.5, 19); c.lineTo(40, 19); c.lineTo(40, 12); c.lineTo(46.5, 12);
      c.closePath();
    });
    F((c) => {
      c.moveTo(34, 41);
      c.bezierCurveTo(34, 28, 66, 28, 66, 41);
      c.lineTo(62, 71.5);
      c.lineTo(38, 71.5);
      c.closePath();
    });
    F((c) => ellipse(c, 50, 43, 17, 5));
    F((c) => rr(c, 33, 71.5, 34, 7, 2.5));
    F((c) => rr(c, 27, 78.5, 46, 11, 4));
  }

  ctx.restore();
}

const cache = new Map();

export function pieceTexture(type, color) {
  const key = type + color;
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = SIZE; cv.height = SIZE;
  const ctx = cv.getContext('2d');
  drawPiece(ctx, type, color);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, tex);
  return tex;
}