// board.js — board geometry, the rotated (Black's-eye) coordinate mapping, and
// the baked board + frame texture with its square labels.
//
// Orientation: the whole lesson is seen from Black's side.
//   * files run h -> a from left to right
//   * ranks run 1 -> 8 from top to bottom
// So the displayed top-left square is h1 and the bottom-right is a8. Nothing is
// ever rotated in 3D: pieces, labels and captions stay screen-upright at all
// times, the mapping below just places squares differently to a normal board.
//
// Board-local pixel space: origin at the displayed top-left corner of the 8x8
// area, x right, y down, in CSS pixels. World space is the same size but with
// the board centred on the origin and y pointing up (1 world unit = 1 CSS px).

export const LIGHT = '#e9edcb';
export const DARK = '#6b8f4f';

export const FILES = 'abcdefgh';

export function fileOf(name) { return name.charCodeAt(0) - 97; }
export function rankOf(name) { return name.charCodeAt(1) - 49; }

/** Is this square a dark one? (a1 is dark.) */
export function isDark(name) { return (fileOf(name) + rankOf(name) + 1) % 2 === 1; }

export class Layout {
  /**
   * @param {number} boardPx side of the 8x8 playing area in CSS px
   */
  constructor(boardPx) {
    this.B = Math.max(120, Math.round(boardPx));
    this.SQ = this.B / 8;
    this.F = Math.max(14, Math.round(this.B * 0.062)); // label frame
    this.total = this.B + this.F * 2;
  }

  /** Centre of a square in board-local px. */
  center(name, insetX = 0, insetY = 0) {
    return {
      x: (7 - fileOf(name)) * this.SQ + this.SQ / 2 + insetX,
      y: rankOf(name) * this.SQ + this.SQ / 2 + insetY,
    };
  }

  /** Top-left + size of a square in board-local px. */
  squareRect(name) {
    return {
      x: (7 - fileOf(name)) * this.SQ,
      y: rankOf(name) * this.SQ,
      w: this.SQ,
      h: this.SQ,
    };
  }

  /** Board-local px -> world px (board centred at origin, y up). */
  world(x, y) {
    return { x: x - this.B / 2, y: this.B / 2 - y };
  }

  worldX(x) { return x - this.B / 2; }
  worldY(y) { return this.B / 2 - y; }

  /** World offset of the board's displayed top-left corner. */
  get originX() { return -this.B / 2; }
  get originY() { return this.B / 2; }
}

/**
 * Deterministic grain, so the board has a hint of material without a texture
 * file. Seeded: two loads of the page produce the same speckle.
 */
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [];
for (let r = 1; r <= 8; r++) for (let f = 0; f < 8; f++) NAMES.push(FILES[f] + r);

/**
 * One texture holding the frame, the labels and the 64 squares. Drawn at device
 * resolution and mapped 1:1, so the labels stay razor sharp.
 */
export function makeBoardCanvas(layout, dpr, palette) {
  const { B, SQ, F } = layout;
  const total = layout.total;
  const c = document.createElement('canvas');
  c.width = Math.round(total * dpr);
  c.height = Math.round(total * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);

  const pal = Object.assign({
    frameTop: '#2c343e',
    frameBottom: '#1d232b',
    frameEdge: 'rgba(255,255,255,0.07)',
    label: 'rgba(206,216,228,0.72)',
    labelDim: 'rgba(206,216,228,0.5)',
    light: LIGHT,
    dark: DARK,
    inner: 'rgba(8,12,10,0.45)',
  }, palette || {});

  // Drop shadow under the whole board.
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.55)';
  g.shadowBlur = B * 0.055;
  g.shadowOffsetY = B * 0.02;
  g.fillStyle = '#000';
  roundRect(g, 0.5, 0.5, total - 1, total - 1, Math.min(16, B * 0.03));
  g.fill();
  g.restore();

  // Frame plate.
  const plate = g.createLinearGradient(0, 0, 0, total);
  plate.addColorStop(0, pal.frameTop);
  plate.addColorStop(1, pal.frameBottom);
  g.fillStyle = plate;
  roundRect(g, 0.5, 0.5, total - 1, total - 1, Math.min(16, B * 0.03));
  g.fill();
  g.strokeStyle = pal.frameEdge;
  g.lineWidth = 1;
  roundRect(g, 0.5, 0.5, total - 1, total - 1, Math.min(16, B * 0.03));
  g.stroke();

  // Squares.
  for (const name of NAMES) {
    const dark = isDark(name);
    g.fillStyle = dark ? pal.dark : pal.light;
    const x = (7 - fileOf(name)) * SQ + F;
    const y = rankOf(name) * SQ + F;
    g.fillRect(x, y, Math.ceil(SQ) + 0.5, Math.ceil(SQ) + 0.5);
  }

  // Grain.
  const rnd = mulberry32(0x2c4f5a71);
  const area = B * B;
  const dots = Math.round(area / 260);
  for (let i = 0; i < dots; i++) {
    const x = F + rnd() * B;
    const y = F + rnd() * B;
    const dark = isDark(NAMES[Math.floor(rnd() * 64)]);
    g.fillStyle = dark ? `rgba(255,255,255,${0.012 + rnd() * 0.02})` : `rgba(30,40,20,${0.012 + rnd() * 0.016})`;
    const r = 0.6 + rnd() * 1.5;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // Vignette on the playing surface, very subtle.
  const vig = g.createRadialGradient(F + B / 2, F + B / 2, B * 0.28, F + B / 2, F + B / 2, B * 0.78);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.14)');
  g.fillStyle = vig;
  g.fillRect(F, F, B, B);

  // Inner rule around the playing surface.
  g.strokeStyle = pal.inner;
  g.lineWidth = 1;
  g.strokeRect(F - 0.5, F - 0.5, B + 1, B + 1);

  // Labels — upright, and ordered for Black's view: h..a across the bottom,
  // 1..8 down the left.
  const font = `${Math.round(F * 0.62)}px "DejaVu Sans", "Liberation Sans", system-ui, sans-serif`;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let f = 0; f < 8; f++) {
    const cx = (7 - f) * SQ + SQ / 2 + F;
    g.fillStyle = pal.label;
    g.fillText(FILES[f], cx, F + B + F * 0.54);
  }
  for (let r = 0; r < 8; r++) {
    const cy = r * SQ + SQ / 2 + F;
    g.fillStyle = pal.label;
    g.fillText(String(r + 1), F * 0.5, cy);
  }

  return c;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
