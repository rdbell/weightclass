// pieces.js — flat 2D chess piece artwork, drawn in code (no external assets).
// Each piece is rendered to a 160x160 canvas and used as a texture.

export const CANVAS_SIZE = 160;

const PALETTES = {
  w: { fill: '#f6f2e9', stroke: '#4c453a', detail: '#4c453a', accent: '#d9d2c2' },
  b: { fill: '#3d3830', stroke: '#15120d', detail: '#cfc8b8', accent: '#5a544a' },
};

function makeCanvas() {
  const c = document.createElement('canvas');
  c.width = CANVAS_SIZE;
  c.height = CANVAS_SIZE;
  return c;
}

function fillStroke(ctx, pal, width = 5) {
  ctx.fillStyle = pal.fill;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = pal.stroke;
  ctx.stroke();
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// Shared pedestal for the taller pieces.
function pedestal(ctx, pal, topY) {
  ctx.beginPath();
  ctx.moveTo(58, topY);
  ctx.lineTo(102, topY);
  ctx.lineTo(110, topY + 18);
  ctx.lineTo(50, topY + 18);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  roundedRect(ctx, 44, topY + 18, 72, 12, 5);
  fillStroke(ctx, pal, 5);
}

// ---------------------------------------------------------------- pawn
function drawPawn(ctx, pal) {
  circle(ctx, 80, 52, 17);
  fillStroke(ctx, pal, 5);
  ctx.beginPath();
  ctx.moveTo(67, 66);
  ctx.bezierCurveTo(63, 82, 59, 96, 55, 110);
  ctx.lineTo(105, 110);
  ctx.bezierCurveTo(101, 96, 97, 82, 93, 66);
  ctx.bezierCurveTo(88, 73, 72, 73, 67, 66);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  roundedRect(ctx, 46, 110, 68, 14, 5);
  fillStroke(ctx, pal, 5);
}

// ---------------------------------------------------------------- rook
function drawRook(ctx, pal) {
  ctx.beginPath();
  ctx.moveTo(56, 28);
  ctx.lineTo(68, 28);
  ctx.lineTo(68, 42);
  ctx.lineTo(74, 42);
  ctx.lineTo(74, 28);
  ctx.lineTo(86, 28);
  ctx.lineTo(86, 42);
  ctx.lineTo(92, 42);
  ctx.lineTo(92, 28);
  ctx.lineTo(104, 28);
  ctx.lineTo(104, 58);
  ctx.lineTo(56, 58);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  ctx.beginPath();
  ctx.moveTo(60, 58);
  ctx.lineTo(100, 58);
  ctx.lineTo(98, 76);
  ctx.lineTo(62, 76);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  ctx.beginPath();
  ctx.moveTo(62, 76);
  ctx.lineTo(98, 76);
  ctx.lineTo(104, 112);
  ctx.lineTo(56, 112);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  roundedRect(ctx, 46, 112, 68, 14, 5);
  fillStroke(ctx, pal, 5);
}

// ---------------------------------------------------------------- knight
function drawKnight(ctx, pal) {
  ctx.beginPath();
  ctx.moveTo(56, 126);
  ctx.lineTo(59, 102);
  ctx.bezierCurveTo(57, 90, 51, 83, 43, 78);
  ctx.bezierCurveTo(38, 75, 35, 70, 37, 65);
  ctx.bezierCurveTo(38, 61, 41, 57, 46, 55);
  ctx.bezierCurveTo(52, 51, 58, 45, 63, 38);
  ctx.lineTo(70, 22);
  ctx.lineTo(79, 39);
  ctx.bezierCurveTo(88, 45, 96, 57, 100, 71);
  ctx.bezierCurveTo(104, 84, 105, 104, 106, 126);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  // mane accent along the back of the neck
  ctx.beginPath();
  ctx.moveTo(96, 74);
  ctx.bezierCurveTo(100, 88, 101, 104, 102, 122);
  ctx.lineWidth = 4;
  ctx.strokeStyle = pal.detail;
  ctx.stroke();
  // eye
  circle(ctx, 63, 55, 3.4);
  ctx.fillStyle = pal.detail;
  ctx.fill();
  // nostril
  circle(ctx, 44, 67, 2.4);
  ctx.fillStyle = pal.detail;
  ctx.fill();
  roundedRect(ctx, 46, 126, 68, 12, 5);
  fillStroke(ctx, pal, 5);
}

// ---------------------------------------------------------------- bishop
function drawBishop(ctx, pal) {
  circle(ctx, 80, 28, 6.5);
  fillStroke(ctx, pal, 4.5);
  ctx.beginPath();
  ctx.moveTo(80, 36);
  ctx.bezierCurveTo(63, 45, 57, 63, 59, 80);
  ctx.bezierCurveTo(61, 94, 71, 101, 80, 101);
  ctx.bezierCurveTo(89, 101, 99, 94, 101, 80);
  ctx.bezierCurveTo(103, 63, 97, 45, 80, 36);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  // mitre slit
  ctx.beginPath();
  ctx.moveTo(80, 47);
  ctx.lineTo(68, 71);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = pal.stroke;
  ctx.stroke();
  roundedRect(ctx, 62, 101, 36, 10, 4);
  fillStroke(ctx, pal, 5);
  pedestal(ctx, pal, 111);
}

// ---------------------------------------------------------------- queen
function drawQueen(ctx, pal) {
  ctx.beginPath();
  ctx.moveTo(50, 66);
  ctx.lineTo(44, 38);
  ctx.lineTo(58, 56);
  ctx.lineTo(64, 30);
  ctx.lineTo(72, 54);
  ctx.lineTo(80, 26);
  ctx.lineTo(88, 54);
  ctx.lineTo(96, 30);
  ctx.lineTo(102, 56);
  ctx.lineTo(116, 38);
  ctx.lineTo(110, 66);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  // crown balls
  for (const [bx, by] of [[44, 38], [64, 30], [80, 26], [96, 30], [116, 38]]) {
    circle(ctx, bx, by, 5.5);
    fillStroke(ctx, pal, 4.5);
  }
  ctx.beginPath();
  ctx.moveTo(50, 66);
  ctx.lineTo(110, 66);
  ctx.lineTo(104, 110);
  ctx.lineTo(56, 110);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  roundedRect(ctx, 46, 110, 68, 14, 5);
  fillStroke(ctx, pal, 5);
}

// ---------------------------------------------------------------- king
function drawKing(ctx, pal) {
  // cross
  ctx.beginPath();
  ctx.moveTo(76, 14);
  ctx.lineTo(84, 14);
  ctx.lineTo(84, 40);
  ctx.lineTo(76, 40);
  ctx.closePath();
  fillStroke(ctx, pal, 4.5);
  ctx.beginPath();
  ctx.moveTo(66, 22);
  ctx.lineTo(94, 22);
  ctx.lineTo(94, 30);
  ctx.lineTo(66, 30);
  ctx.closePath();
  fillStroke(ctx, pal, 4.5);
  // crown dome
  ctx.beginPath();
  ctx.moveTo(52, 70);
  ctx.bezierCurveTo(52, 46, 66, 40, 80, 40);
  ctx.bezierCurveTo(94, 40, 108, 46, 108, 70);
  ctx.lineTo(108, 78);
  ctx.lineTo(52, 78);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  // band
  roundedRect(ctx, 50, 78, 60, 10, 4);
  fillStroke(ctx, pal, 5);
  // body
  ctx.beginPath();
  ctx.moveTo(54, 88);
  ctx.lineTo(106, 88);
  ctx.lineTo(104, 112);
  ctx.lineTo(56, 112);
  ctx.closePath();
  fillStroke(ctx, pal, 5);
  // small cross detail on the body
  ctx.beginPath();
  ctx.moveTo(77, 92);
  ctx.lineTo(83, 92);
  ctx.lineTo(83, 108);
  ctx.lineTo(77, 108);
  ctx.closePath();
  ctx.fillStyle = pal.accent;
  ctx.fill();
  roundedRect(ctx, 46, 112, 68, 14, 5);
  fillStroke(ctx, pal, 5);
}

const DRAWERS = { P: drawPawn, r: drawRook, n: drawKnight, b: drawBishop, q: drawQueen, k: drawKing };

const cache = new Map();

// Returns a 160x160 canvas with the piece (color: 'w'|'b', type: P r n b q k).
export function pieceCanvas(color, type) {
  const key = color + type;
  if (cache.has(key)) return cache.get(key);
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  DRAWERS[type](ctx, PALETTES[color]);
  cache.set(key, c);
  return c;
}

// Soft elliptical shadow texture (shared by all pieces).
let shadowCanvasCache = null;
export function shadowCanvas() {
  if (shadowCanvasCache) return shadowCanvasCache;
  const c = makeCanvas();
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(80, 80, 8, 80, 80, 74);
  g.addColorStop(0, 'rgba(0,0,0,0.34)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.translate(80, 80);
  ctx.scale(1, 0.72);
  ctx.translate(-80, -80);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 160, 160);
  ctx.restore();
  shadowCanvasCache = c;
  return c;
}
