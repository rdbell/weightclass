// pieces.js — flat vector piece artwork, drawn in code onto canvas textures.
//
// Each piece is authored as a union of simple sub-shapes in a 100x100 unit box
// (baseline y=93, centre x=50). The outline comes from the silhouette mask:
// dilate the mask and paint the larger copy in the outline colour, then draw the
// body on top. Only the outer band survives, giving a uniform outline with no
// seams where sub-shapes overlap — which flat piece art needs.

const OUTLINE = 3.1;   // units
const DETAIL = 2.0;    // units

// ---------------------------------------------------------------------------
// Path helpers (unit space)
// ---------------------------------------------------------------------------

function rect(p, x0, y0, x1, y1, r) {
  const rr = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  p.moveTo(x0 + rr, y0);
  p.lineTo(x1 - rr, y0);
  p.quadraticCurveTo(x1, y0, x1, y0 + rr);
  p.lineTo(x1, y1 - rr);
  p.quadraticCurveTo(x1, y1, x1 - rr, y1);
  p.lineTo(x0 + rr, y1);
  p.quadraticCurveTo(x0, y1, x0, y1 - rr);
  p.lineTo(x0, y0 + rr);
  p.quadraticCurveTo(x0, y0, x0 + rr, y0);
  p.closePath();
}

function circle(p, cx, cy, r) { ellipse(p, cx, cy, r, r); }

function ellipse(p, cx, cy, rx, ry) {
  p.moveTo(cx + rx, cy);
  p.bezierCurveTo(cx + rx, cy + ry * 0.5523, cx + rx * 0.5523, cy + ry, cx, cy + ry);
  p.bezierCurveTo(cx - rx * 0.5523, cy + ry, cx - rx, cy + ry * 0.5523, cx - rx, cy);
  p.bezierCurveTo(cx - rx, cy - ry * 0.5523, cx - rx * 0.5523, cy - ry, cx, cy - ry);
  p.bezierCurveTo(cx + rx * 0.5523, cy - ry, cx + rx, cy - ry * 0.5523, cx + rx, cy);
  p.closePath();
}

/** Bell-shaped skirt from a collar down onto the pedestal. */
function skirt(p, topHalf, footHalf, waist, top, bottom) {
  p.moveTo(50 - topHalf, top);
  p.bezierCurveTo(50 - topHalf + 1.2, top + (bottom - top) * 0.42, 50 - footHalf + waist, bottom - 8, 50 - footHalf, bottom);
  p.lineTo(50 + footHalf, bottom);
  p.bezierCurveTo(50 + footHalf - waist, bottom - 8, 50 + topHalf - 1.2, top + (bottom - top) * 0.42, 50 + topHalf, top);
  p.closePath();
}

function poly(p, pts) {
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  p.closePath();
}

function seg(p, x0, y0, x1, y1) {
  p.moveTo(x0, y0);
  p.lineTo(x1, y1);
}

/** Shared two-tier pedestal — everything in the set stands on this. */
function foot(p) {
  rect(p, 27.5, 78.5, 72.5, 87, 2.2);
  rect(p, 21.5, 84.5, 78.5, 93, 2.6);
}
const footDetail = (p) => seg(p, 23.2, 84.9, 76.8, 84.9);

// ---------------------------------------------------------------------------
// Silhouettes
// ---------------------------------------------------------------------------

const SHAPES = {
  P(p) {
    ellipse(p, 50, 27, 10.8, 10.8);
    rect(p, 39.5, 35.5, 60.5, 43.5, 2.6);
    skirt(p, 15.5, 19, 4.5, 42.5, 80.5);
    foot(p);
  },

  R(p) {
    const yTop = 17.5;
    const yGap = 26;
    const yBot = 33.5;
    const m = 11.4;
    const g = (58 - 4 * m) / 3;
    let x = 21;
    p.moveTo(x, yBot);
    p.lineTo(x, yTop);
    for (let i = 0; i < 4; i++) {
      p.lineTo(x + m, yTop);
      p.lineTo(x + m, yGap);
      x += m + g;
      if (i < 3) {
        p.lineTo(x, yGap);
        p.lineTo(x, yTop);
      }
    }
    p.lineTo(79, yTop);
    p.lineTo(79, yBot);
    p.closePath();
    // Barrel: nearly straight sides, a touch of waist.
    p.moveTo(25, yBot - 1);
    p.lineTo(75, yBot - 1);
    p.bezierCurveTo(72.6, 48, 72.6, 64, 74.5, 80.5);
    p.lineTo(25.5, 80.5);
    p.bezierCurveTo(27.4, 64, 27.4, 48, 25, yBot - 1);
    p.closePath();
    foot(p);
  },

  B(p) {
    circle(p, 50, 11.2, 4.5);
    p.moveTo(50, 15);
    p.bezierCurveTo(61.5, 22, 68.5, 31.5, 66.5, 42);
    p.bezierCurveTo(65, 50.5, 58, 55.5, 50, 55.5);
    p.bezierCurveTo(42, 55.5, 35, 50.5, 33.5, 42);
    p.bezierCurveTo(31.5, 31.5, 38.5, 22, 50, 15);
    p.closePath();
    rect(p, 34.5, 53, 65.5, 61, 2.6);
    skirt(p, 14.5, 19.5, 4.5, 60, 80.5);
    foot(p);
  },

  Q(p) {
    const base = 49;
    const tips = [[22, 30], [36, 20.5], [50, 14.5], [64, 20.5], [78, 30]];
    const valleys = [[29, 41], [43, 41.5], [57, 41.5], [71, 41]];
    const zig = [tips[0], valleys[0], tips[1], valleys[1], tips[2], valleys[2], tips[3], valleys[3], tips[4]];
    poly(p, [...zig, [76, base], [24, base]]);
    for (const [x, y] of tips) circle(p, x, y, 4.9);
    rect(p, 24.5, 47, 75.5, 56.5, 2.8);
    skirt(p, 22, 21, 5, 55.5, 80.5);
    foot(p);
  },

  K(p) {
    // Cross, wide rounded crown, collar, skirt.
    rect(p, 47.1, 4.5, 52.9, 27, 1.6);
    rect(p, 41.5, 10.5, 58.5, 17, 1.6);
    ellipse(p, 50, 35, 15.5, 12);
    rect(p, 30.5, 43.5, 69.5, 52.5, 3);
    skirt(p, 19, 21, 5, 51.5, 80.5);
    foot(p);
  },

  N(p, mirror) {
    // One profile, facing right; mirrored for the other army.
    let cmds = [
      ['c', 23.2, 66, 24.5, 51, 31, 41],        // back of the neck
      ['c', 35.5, 34.5, 39, 30.5, 41.5, 25.5],
      ['l', 39.5, 12],                          // near ear
      ['l', 50, 21.5],
      ['l', 55.5, 9.5],                         // far ear
      ['l', 60.5, 22],
      ['c', 67.5, 25.5, 74, 30.5, 78.5, 36.5],  // forehead to muzzle
      ['c', 81, 40, 80.5, 43.5, 77, 45],
      ['l', 71, 47.5],                          // nose / mouth
      ['c', 68, 49, 65, 50, 62, 50.5],
      ['c', 66, 55.5, 68.6, 61.5, 70, 67.5],    // throat and chest
      ['c', 71, 72, 71.8, 76, 72.2, 80.5],
    ];
    if (mirror) cmds = cmds.map(([k, ...v]) => [k, ...v.map((n, i) => (i % 2 === 0 ? 100 - n : n))]);
    const sx = mirror ? 100 - 22.5 : 22.5;
    p.moveTo(sx, 80.5);
    for (const c of cmds) {
      if (c[0] === 'l') p.lineTo(c[1], c[2]);
      else p.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]);
    }
    p.closePath();
    foot(p);
  },
};

// Interior detail: strokes clipped to the silhouette, plus one filled dot.
const DETAILS = {
  P(p, d) { footDetail(p); },
  R(p, d) { d.line = true; seg(p, 24.2, 34.2, 75.8, 34.2); footDetail(p); },
  B(p, d) {
    d.line = true;
    p.moveTo(50.5, 27);
    p.quadraticCurveTo(57.5, 31.5, 60, 39);
    seg(p, 36.2, 60.4, 63.8, 60.4);
    footDetail(p);
  },
  Q(p, d) {
    d.line = true;
    seg(p, 26.5, 47.6, 73.5, 47.6);
    footDetail(p);
    d.dot = null;
  },
  K(p, d) {
    d.line = true;
    seg(p, 32.4, 44.2, 67.6, 44.2);
    footDetail(p);
  },
  N(p, d, mirror) {
    const pt = (x, y) => (mirror ? [100 - x, y] : [x, y]);
    d.dot = pt(57.5, 30);
    d.dotR = 2.6;
    d.line = true;
    // mane
    let a = pt(40.5, 26), b = pt(33, 38);
    seg(p, a[0], a[1], b[0], b[1]);
    a = pt(36, 32.5); b = pt(29, 44.5);
    seg(p, a[0], a[1], b[0], b[1]);
    // nostril and mouth
    a = pt(75.5, 39.5); b = pt(78.5, 42);
    seg(p, a[0], a[1], b[0], b[1]);
    a = pt(70, 46.8); b = pt(64, 48.8);
    seg(p, a[0], a[1], b[0], b[1]);
    footDetail(p);
  },
};

const STYLE = {
  w: { top: '#fbf8ee', bottom: '#ddd4bb', line: '#2b3038', detail: 'rgba(43,48,56,0.85)', sheen: 0.3, shade: 0.1 },
  b: { top: '#4b535d', bottom: '#242a31', line: '#0d1014', detail: 'rgba(196,206,217,0.7)', sheen: 0.16, shade: 0.14 },
};

// ---------------------------------------------------------------------------
// Rasterising
// ---------------------------------------------------------------------------

function canvasOf(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

/**
 * The outline is the silhouette dilated by OUTLINE and painted in the outline
 * colour; the body is then drawn over it, so only the outer band shows. Dilation
 * is a union of shifted copies (source-over: alpha can only grow), which is why
 * this survives repeated compositing — shrinking a mask by intersecting shifted
 * copies instead multiplies a near-zero alpha over and over and collapses it.
 */
function dilate(mask, size, r) {
  const out = canvasOf(size);
  const g = out.getContext('2d');
  const steps = 32;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    g.drawImage(mask, Math.cos(a) * r, Math.sin(a) * r);
  }
  // Close the centre in case of a hairline gap between samples.
  g.drawImage(mask, 0, 0);
  return out;
}

/** @returns {Record<string, HTMLCanvasElement>} keyed 'wK', 'bp', … */
export function makePieceTextures({ size = 256 } = {}) {
  const out = {};
  for (const color of ['w', 'b']) {
    for (const type of ['K', 'Q', 'R', 'B', 'N', 'P']) {
      out[color + type] = renderPiece(type, color, size);
    }
  }
  return out;
}

function renderPiece(type, color, size) {
  // Leave room for the outline band inside the texture.
  const s = (size / 100) * (1 - (OUTLINE * 2) / 100);
  const style = STYLE[color];
  const mirror = type === 'N' && color === 'b';

  const path = new Path2D();
  SHAPES[type](path, mirror);
  const detailPath = new Path2D();
  const flags = {};
  DETAILS[type](detailPath, flags, mirror);

  const mask = canvasOf(size);
  {
    const g = mask.getContext('2d');
    g.scale(s, s);
    g.fillStyle = '#fff';
    g.fill(path, 'nonzero');
  }

  const band = dilate(mask, size, OUTLINE * s);
  const bg = band.getContext('2d');
  bg.globalCompositeOperation = 'source-in';
  bg.fillStyle = style.line;
  bg.fillRect(0, 0, size, size);
  bg.globalCompositeOperation = 'source-over';

  const body = canvasOf(size);
  {
    const g = body.getContext('2d');
    g.drawImage(mask, 0, 0);
    g.globalCompositeOperation = 'source-in';
    const grad = g.createLinearGradient(0, 4 * s, 0, 94 * s);
    grad.addColorStop(0, style.top);
    grad.addColorStop(1, style.bottom);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }

  const out = canvasOf(size);
  const g = out.getContext('2d', { willReadFrequently: false });

  // Contact shadow: a flat piece still has to look like it stands on the square.
  g.save();
  g.translate(1.2 * s, 1.6 * s);
  g.scale(1, 0.3);
  const cy = 92 * s / 0.3;
  const sh = g.createRadialGradient(50 * s, cy, 2 * s, 50 * s, cy, 28 * s);
  sh.addColorStop(0, 'rgba(8,12,10,0.40)');
  sh.addColorStop(0.55, 'rgba(8,12,10,0.18)');
  sh.addColorStop(1, 'rgba(8,12,10,0)');
  g.fillStyle = sh;
  g.beginPath();
  g.arc(50 * s, cy, 28 * s, 0, Math.PI * 2);
  g.fill();
  g.restore();

  g.drawImage(band, 0, 0);
  g.drawImage(body, 0, 0);

  // Light at the top, weight at the bottom, both clipped inside the silhouette.
  g.save();
  g.scale(s, s);
  g.clip(path, 'nonzero');
  g.globalCompositeOperation = 'source-atop';
  const sheen = g.createLinearGradient(0, 4, 0, 60);
  sheen.addColorStop(0, `rgba(255,255,255,${style.sheen})`);
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.fillRect(0, 0, 100, 100);
  const shade = g.createLinearGradient(0, 62, 0, 94);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, `rgba(0,0,0,${style.shade})`);
  g.fillStyle = shade;
  g.fillRect(0, 0, 100, 100);
  g.globalCompositeOperation = 'source-over';

  g.strokeStyle = style.detail;
  g.lineWidth = DETAIL;
  g.lineCap = 'round';
  g.stroke(detailPath);
  if (flags.dot) {
    g.fillStyle = style.detail;
    g.beginPath();
    g.arc(flags.dot[0], flags.dot[1], flags.dotR, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  return out;
}
