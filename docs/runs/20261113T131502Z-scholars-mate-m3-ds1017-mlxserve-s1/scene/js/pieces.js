import * as THREE from 'three';

// All piece artwork is generated here, on a 512px canvas per piece. The flat,
// front-facing silhouettes are rendered as sprites so they stay perfectly
// upright on the top-down board.

const SIZE = 512;
const CX = 256;

const PALETTE = {
  w: {
    fill0: '#fffdf4',
    fill1: '#f3ecd9',
    fill2: '#ded4bd',
    stroke: '#5a5147',
    detail: '#8d806b',
    shadow: 0.22,
  },
  b: {
    fill0: '#343d3f',
    fill1: '#232c2e',
    fill2: '#141a1b',
    stroke: '#080b0c',
    detail: '#647577',
    shadow: 0.30,
  },
};

function begin(ctx) {
  ctx.beginPath();
}

function fillStroke(ctx, gradient, p, lineWidth = 7) {
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = p.stroke;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function detailStroke(ctx, p, width = 5) {
  ctx.lineWidth = width;
  ctx.strokeStyle = p.detail;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawShadow(ctx, p) {
  ctx.save();
  ctx.globalAlpha = p.shadow;
  ctx.filter = 'blur(8px)';
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(CX, 464, 132, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function baseSlab(ctx, g, p, left, right, top, radius = 34) {
  const bottom = 456;
  begin(ctx);
  ctx.moveTo(left + 30, top);
  ctx.lineTo(right - 30, top);
  ctx.quadraticCurveTo(right + 12, top, right + 12, top + 28);
  ctx.quadraticCurveTo(right + 12, bottom, right - 16, bottom);
  ctx.lineTo(left + 16, bottom);
  ctx.quadraticCurveTo(left - 12, bottom, left - 12, top + 28);
  ctx.quadraticCurveTo(left - 12, top, left + 30, top);
  ctx.closePath();
  fillStroke(ctx, g, p);
}

function drawPawn(ctx, g, p) {
  drawShadow(ctx, p);

  // Curved body.
  begin(ctx);
  ctx.moveTo(202, 238);
  ctx.bezierCurveTo(195, 280, 190, 330, 184, 378);
  ctx.bezierCurveTo(181, 394, 181, 402, 183, 408);
  ctx.lineTo(329, 408);
  ctx.bezierCurveTo(331, 402, 331, 394, 328, 378);
  ctx.bezierCurveTo(322, 330, 317, 280, 310, 238);
  ctx.closePath();
  fillStroke(ctx, g, p);

  baseSlab(ctx, g, p, 152, 360, 408);

  // Head.
  begin(ctx);
  ctx.arc(CX, 186, 58, 0, Math.PI * 2);
  fillStroke(ctx, g, p);

  // Collar seam.
  begin(ctx);
  ctx.moveTo(206, 241);
  ctx.bezierCurveTo(220, 252, 292, 252, 306, 241);
  detailStroke(ctx, p, 5);

  // Plinth seam.
  begin(ctx);
  ctx.moveTo(170, 412);
  ctx.lineTo(342, 412);
  detailStroke(ctx, p, 4.5);
}

function drawRook(ctx, g, p) {
  drawShadow(ctx, p);

  // Body.
  begin(ctx);
  ctx.moveTo(150, 160);
  ctx.bezierCurveTo(148, 230, 152, 310, 158, 408);
  ctx.lineTo(354, 408);
  ctx.bezierCurveTo(360, 310, 364, 230, 362, 160);
  ctx.closePath();
  fillStroke(ctx, g, p);

  // Crenellated crown.
  begin(ctx);
  ctx.moveTo(138, 160);
  ctx.lineTo(138, 76);
  ctx.lineTo(188, 76);
  ctx.lineTo(188, 118);
  ctx.lineTo(200, 118);
  ctx.lineTo(200, 76);
  ctx.lineTo(250, 76);
  ctx.lineTo(250, 118);
  ctx.lineTo(262, 118);
  ctx.lineTo(262, 76);
  ctx.lineTo(312, 76);
  ctx.lineTo(312, 118);
  ctx.lineTo(324, 118);
  ctx.lineTo(324, 76);
  ctx.lineTo(374, 76);
  ctx.lineTo(374, 160);
  ctx.closePath();
  fillStroke(ctx, g, p);

  baseSlab(ctx, g, p, 140, 372, 408);

  // Crown seam and base seam.
  begin(ctx);
  ctx.moveTo(154, 164);
  ctx.lineTo(358, 164);
  detailStroke(ctx, p, 4.5);

  begin(ctx);
  ctx.moveTo(158, 412);
  ctx.lineTo(354, 412);
  detailStroke(ctx, p, 4.5);
}

function drawKnight(ctx, g, p) {
  drawShadow(ctx, p);

  baseSlab(ctx, g, p, 134, 378, 404, 32);

  // Horse head and neck. The muzzle points left, ears sit high on the crown.
  begin(ctx);
  ctx.moveTo(128, 268);
  ctx.bezierCurveTo(118, 284, 128, 300, 150, 306);
  ctx.bezierCurveTo(178, 314, 194, 326, 204, 350);
  ctx.bezierCurveTo(212, 374, 220, 390, 228, 402);
  ctx.lineTo(318, 402);
  ctx.bezierCurveTo(328, 360, 336, 310, 342, 262);
  ctx.bezierCurveTo(348, 212, 350, 172, 344, 138);
  ctx.bezierCurveTo(352, 124, 360, 108, 364, 88);
  ctx.bezierCurveTo(350, 92, 338, 102, 328, 112);
  ctx.lineTo(318, 64);
  ctx.bezierCurveTo(300, 68, 284, 76, 270, 90);
  ctx.lineTo(258, 68);
  ctx.bezierCurveTo(246, 84, 238, 96, 228, 108);
  ctx.bezierCurveTo(210, 134, 188, 166, 170, 190);
  ctx.bezierCurveTo(150, 214, 138, 242, 128, 268);
  ctx.closePath();
  fillStroke(ctx, g, p);

  // Mane ridge.
  begin(ctx);
  ctx.moveTo(342, 150);
  ctx.bezierCurveTo(336, 220, 332, 310, 318, 392);
  detailStroke(ctx, p, 5);

  begin(ctx);
  ctx.moveTo(326, 168);
  ctx.bezierCurveTo(320, 236, 316, 314, 306, 386);
  detailStroke(ctx, p, 3.5);

  // Eye and nostril.
  begin(ctx);
  ctx.arc(236, 166, 7, 0, Math.PI * 2);
  ctx.fillStyle = p.detail;
  ctx.fill();

  begin(ctx);
  ctx.moveTo(146, 288);
  ctx.bezierCurveTo(154, 296, 162, 299, 172, 300);
  detailStroke(ctx, p, 4.5);

  // Mouth / jaw hint.
  begin(ctx);
  ctx.moveTo(133, 274);
  ctx.bezierCurveTo(146, 279, 158, 283, 170, 290);
  detailStroke(ctx, p, 4);
}

function drawBishop(ctx, g, p) {
  drawShadow(ctx, p);

  // Body.
  begin(ctx);
  ctx.moveTo(204, 308);
  ctx.bezierCurveTo(203, 350, 214, 380, 224, 408);
  ctx.lineTo(288, 408);
  ctx.bezierCurveTo(297, 380, 309, 350, 308, 308);
  ctx.closePath();
  fillStroke(ctx, g, p);

  baseSlab(ctx, g, p, 144, 368, 408);

  // Mitre.
  begin(ctx);
  ctx.moveTo(CX, 116);
  ctx.bezierCurveTo(220, 158, 190, 214, 192, 272);
  ctx.bezierCurveTo(208, 292, 304, 292, 320, 272);
  ctx.bezierCurveTo(322, 214, 292, 158, CX, 116);
  ctx.closePath();
  fillStroke(ctx, g, p);

  // Collar.
  begin(ctx);
  ctx.moveTo(188, 276);
  ctx.bezierCurveTo(188, 266, 324, 266, 324, 276);
  ctx.bezierCurveTo(324, 306, 319, 314, 310, 314);
  ctx.lineTo(202, 314);
  ctx.bezierCurveTo(193, 314, 188, 306, 188, 276);
  ctx.closePath();
  fillStroke(ctx, g, p, 6);

  // Top orb.
  begin(ctx);
  ctx.arc(CX, 98, 25, 0, Math.PI * 2);
  fillStroke(ctx, g, p, 6);

  // Mitre slit.
  begin(ctx);
  ctx.moveTo(256, 132);
  ctx.bezierCurveTo(248, 160, 236, 184, 229, 208);
  detailStroke(ctx, p, 6);

  // Collar seam.
  begin(ctx);
  ctx.moveTo(194, 300);
  ctx.lineTo(318, 300);
  detailStroke(ctx, p, 4.5);
}

function drawQueen(ctx, g, p) {
  drawShadow(ctx, p);

  // Body.
  begin(ctx);
  ctx.moveTo(186, 206);
  ctx.bezierCurveTo(183, 280, 194, 350, 205, 408);
  ctx.lineTo(307, 408);
  ctx.bezierCurveTo(318, 350, 329, 280, 326, 206);
  ctx.closePath();
  fillStroke(ctx, g, p);

  baseSlab(ctx, g, p, 122, 390, 408, 34);

  // Crown.
  begin(ctx);
  ctx.moveTo(128, 168);
  ctx.lineTo(128, 144);
  ctx.quadraticCurveTo(140, 128, 150, 108);
  ctx.lineTo(156, 134);
  ctx.quadraticCurveTo(178, 126, 205, 100);
  ctx.lineTo(212, 130);
  ctx.quadraticCurveTo(232, 122, 256, 90);
  ctx.lineTo(262, 128);
  ctx.quadraticCurveTo(288, 122, 307, 100);
  ctx.lineTo(316, 130);
  ctx.quadraticCurveTo(342, 126, 362, 108);
  ctx.lineTo(372, 144);
  ctx.lineTo(384, 168);
  ctx.closePath();
  fillStroke(ctx, g, p);

  // Collar.
  begin(ctx);
  ctx.moveTo(168, 168);
  ctx.quadraticCurveTo(148, 168, 146, 190);
  ctx.quadraticCurveTo(146, 208, 166, 210);
  ctx.lineTo(346, 210);
  ctx.quadraticCurveTo(366, 208, 366, 190);
  ctx.quadraticCurveTo(364, 168, 344, 168);
  ctx.closePath();
  fillStroke(ctx, g, p, 6);

  // Crown pearls.
  const pearls = [[150, 102], [205, 94], [256, 84], [307, 94], [362, 102]];
  for (const [x, y] of pearls) {
    begin(ctx);
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    fillStroke(ctx, g, p, 5);
  }

  // Crown band seam.
  begin(ctx);
  ctx.moveTo(168, 174);
  ctx.lineTo(344, 174);
  detailStroke(ctx, p, 4.5);

  // Collar seam.
  begin(ctx);
  ctx.moveTo(174, 206);
  ctx.lineTo(338, 206);
  detailStroke(ctx, p, 4.5);
}

function drawKing(ctx, g, p) {
  drawShadow(ctx, p);

  // Body.
  begin(ctx);
  ctx.moveTo(190, 204);
  ctx.bezierCurveTo(187, 280, 198, 350, 208, 408);
  ctx.lineTo(304, 408);
  ctx.bezierCurveTo(314, 350, 325, 280, 322, 204);
  ctx.closePath();
  fillStroke(ctx, g, p);

  baseSlab(ctx, g, p, 118, 394, 408, 34);

  // Crown dome.
  begin(ctx);
  ctx.moveTo(178, 176);
  ctx.bezierCurveTo(178, 148, 198, 126, 226, 120);
  ctx.lineTo(286, 120);
  ctx.bezierCurveTo(314, 126, 334, 148, 334, 176);
  ctx.closePath();
  fillStroke(ctx, g, p);

  // Crown band.
  begin(ctx);
  ctx.moveTo(170, 176);
  ctx.quadraticCurveTo(156, 176, 156, 194);
  ctx.quadraticCurveTo(156, 210, 174, 210);
  ctx.lineTo(338, 210);
  ctx.quadraticCurveTo(356, 210, 356, 194);
  ctx.quadraticCurveTo(356, 176, 342, 176);
  ctx.closePath();
  fillStroke(ctx, g, p, 6);

  // Cross.
  begin(ctx);
  ctx.roundRect(245, 46, 22, 78, 8);
  fillStroke(ctx, g, p, 6);
  begin(ctx);
  ctx.roundRect(233, 66, 46, 22, 8);
  fillStroke(ctx, g, p, 6);

  // Crown seam.
  begin(ctx);
  ctx.moveTo(170, 180);
  ctx.lineTo(342, 180);
  detailStroke(ctx, p, 4.5);
}

const DRAWERS = {
  P: drawPawn,
  R: drawRook,
  N: drawKnight,
  B: drawBishop,
  Q: drawQueen,
  K: drawKing,
};

function makeTexture(type, color) {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SIZE, SIZE);

  const p = PALETTE[color];
  const gradient = ctx.createLinearGradient(0, 30, 0, 458);
  gradient.addColorStop(0, p.fill0);
  gradient.addColorStop(0.55, p.fill1);
  gradient.addColorStop(1, p.fill2);

  DRAWERS[type](ctx, gradient, p);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

const cache = new Map();

export function pieceTexture(type, color) {
  const key = `${color}${type}`;
  if (!cache.has(key)) cache.set(key, makeTexture(type, color));
  return cache.get(key);
}
