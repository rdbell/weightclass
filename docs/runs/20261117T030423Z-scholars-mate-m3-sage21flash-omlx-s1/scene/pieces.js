/* Canvas-drawn flat chess piece glyphs.
   Each glyph is drawn in a 0..100 box (y down) and rendered to a 512px canvas
   with a soft drop shadow. White and black knights are mirrored so they face
   opposite ways. */

export const PIECE_STYLE = {
  w: { fill: '#faf5e7', stroke: '#45403a', detail: '#45403a' },
  b: { fill: '#3b3733', stroke: '#191613', detail: '#a89f8d' },
};

function rrPath(x, y, w, h, r) {
  const p = new Path2D();
  p.moveTo(x + r, y);
  p.lineTo(x + w - r, y); p.arcTo(x + w, y, x + w, y + r, r);
  p.lineTo(x + w, y + h - r); p.arcTo(x + w, y + h, x + w - r, y + h, r);
  p.lineTo(x + r, y + h); p.arcTo(x, y + h, x, y + h - r, r);
  p.lineTo(x, y + r); p.arcTo(x, y, x + r, y, r);
  p.closePath();
  return p;
}

function circlePath(cx, cy, r) {
  const p = new Path2D();
  p.arc(cx, cy, r, 0, Math.PI * 2);
  return p;
}

// Returns { fills: Path2D[], details: [{p, w, fill?}] }
function glyph(type) {
  const fills = [], details = [];
  const add = d => fills.push(new Path2D(d));
  const line = (d, w = 2.6) => details.push({ p: new Path2D(d), w });

  if (type === 'p') {
    fills.push(circlePath(50, 32, 13.5));
    add('M42 43 C41 52 38 61 31 69 L69 69 C62 61 59 52 58 43 Z');
    fills.push(rrPath(29, 67, 42, 8, 3));
    fills.push(rrPath(25, 76, 50, 8, 4));
    line('M36 71 L64 71', 2.2);
  } else if (type === 'r') {
    add('M31 20 L39 20 L39 28 L46 28 L46 20 L54 20 L54 28 L61 28 L61 20 L69 20 L69 33 L64 39 L64 65 L69 71 L69 79 L31 79 L31 71 L36 65 L36 39 L31 33 Z');
    fills.push(rrPath(27, 79, 46, 7, 3));
    line('M36 42 L64 42', 2.2);
    line('M36 62 L64 62', 2.2);
  } else if (type === 'b') {
    fills.push(circlePath(50, 11, 4.5));
    add('M50 16 C61 25 66 38 63 50 L60 57 L40 57 L37 50 C34 38 39 25 50 16 Z');
    fills.push(rrPath(38, 57, 24, 6, 3));
    fills.push(rrPath(31, 63, 38, 6, 3));
    fills.push(rrPath(27, 69, 46, 8, 4));
    line('M54.5 27 L46 41', 3.4);
  } else if (type === 'n') {
    add('M31 79 L31 75 C31 68 35 63 39 58 C42 54 41 49 38 46 C35 43 29 44 26 41 C23 38 24 34 28 33 C33 31 36 27 39 22 C41 18 42 14 44 10 L48 17 L53 11 L56 19 C63 26 67 38 68 52 C69 62 69 71 69 79 Z');
    fills.push(rrPath(27, 79, 46, 7, 3));
    line('M60 25 C64 33 66 41 66.5 50', 2.4);
    details.push({ p: circlePath(43.5, 29, 2.3), w: 0, fill: true });
  } else if (type === 'q') {
    for (const [bx, by] of [[28, 19], [39, 12], [50, 10], [61, 12], [72, 19]])
      fills.push(circlePath(bx, by, 4.6));
    add('M28 23 L37 50 L39 17 L46 49 L50 15 L54 49 L61 17 L63 50 L72 23 L66 62 L34 62 Z');
    fills.push(rrPath(35, 61, 30, 6, 3));
    add('M38 67 L62 67 L66 77 L34 77 Z');
    fills.push(rrPath(29, 77, 42, 7, 3));
    line('M39 72 L61 72', 2.2);
  } else if (type === 'k') {
    fills.push(rrPath(47, 4, 6, 18, 2));
    fills.push(rrPath(42, 9, 16, 6, 2));
    add('M33 44 L36 26 L44 38 L50 21 L56 38 L64 26 L67 44 Z');
    fills.push(rrPath(35, 43, 30, 6, 3));
    add('M39 49 L61 49 L66 78 L34 78 Z');
    fills.push(rrPath(29, 78, 42, 7, 3));
    line('M40 72 L60 72', 2.2);
  }
  return { fills, details };
}

export function makePieceCanvas(type, color) {
  const S = 512, off = 14, sc = (S - 2 * off) / 100;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.setTransform(sc, 0, 0, sc, off, off);
  const st = PIECE_STYLE[color];
  const { fills, details } = glyph(type);
  const mirror = type === 'n' && color === 'b';

  const draw = (pass) => {
    g.save();
    if (mirror) { g.translate(100, 0); g.scale(-1, 1); }
    if (pass === 0) {
      g.shadowColor = 'rgba(0,0,0,0.42)';
      g.shadowBlur = 14; g.shadowOffsetY = 9;
    }
    g.fillStyle = st.fill; g.strokeStyle = st.stroke;
    g.lineWidth = 3.2; g.lineJoin = 'round'; g.lineCap = 'round';
    for (const p of fills) { g.fill(p); if (pass === 1) g.stroke(p); }
    for (const d of details) {
      if (pass !== 1) continue;
      if (d.fill) { g.fillStyle = st.detail; g.fill(d.p); }
      else {
        g.strokeStyle = st.detail; g.globalAlpha = 0.75;
        g.lineWidth = d.w; g.stroke(d.p); g.globalAlpha = 1;
      }
    }
    g.restore();
  };
  draw(0); // shadow pass
  draw(1); // fill + stroke pass
  return cv;
}