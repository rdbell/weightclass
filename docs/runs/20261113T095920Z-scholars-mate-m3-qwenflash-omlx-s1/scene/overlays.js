// overlays.js — square highlights, the pulsing "hot square" marker, coaching
// arrows and the capture burst. Everything is drawn in board-local pixel space,
// so every mark follows the rotated coordinate mapping in board.js: arrows point
// where the squares actually are on screen, and glyph shapes stay upright.

export const INK = {
  attack: '#f0b23c',   // a white attacking move / threat
  danger: '#e1564a',   // the fatal square, the mate
  protect: '#4fbf95',  // a defender / protected square
  black: '#9db8dd',    // black's own moves and counter-play
  lastMove: 'rgba(248,212,110,0.55)',
  lastMoveDark: 'rgba(240,196,74,0.62)',
  block: 'rgba(16,22,26,0.5)',
};

function roundedSquare(g, layout, name, inset, radius) {
  const r = layout.squareRect(name);
  const i = r.w * inset;
  const rad = r.w * radius;
  const x = r.x + i, y = r.y + i, w = r.w - i * 2, h = r.h - i * 2;
  g.beginPath();
  g.moveTo(x + rad, y);
  g.lineTo(x + w - rad, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rad);
  g.lineTo(x + w, y + h - rad);
  g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  g.lineTo(x + rad, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rad);
  g.lineTo(x, y + rad);
  g.quadraticCurveTo(x, y, x + rad, y);
  g.closePath();
}

/**
 * Static per-beat square marks.
 * kinds: 'last' the squares the move touched · 'danger' the target square
 *        'block' a square Black's own pieces stand on · 'guard' a defended square
 */
export function drawMarks(g, layout, marks) {
  const SQ = layout.SQ;
  for (const m of marks) {
    const r = layout.squareRect(m.sq);
    if (m.kind === 'last') {
      g.fillStyle = m.dark ? INK.lastMoveDark : INK.lastMove;
      g.fillRect(r.x, r.y, r.w, r.h);
    } else if (m.kind === 'danger') {
      g.fillStyle = 'rgba(225,86,74,0.5)';
      g.fillRect(r.x, r.y, r.w, r.h);
    } else if (m.kind === 'block') {
      g.fillStyle = 'rgba(14,20,24,0.34)';
      roundedSquare(g, layout, m.sq, 0.02, 0.16);
      g.fill();
      // The badge sits in the corner: the square's own piece stands in the middle.
      const c = { x: r.x + r.w * 0.76, y: r.y + r.h * 0.24 };
      const rad = r.w * 0.15;
      g.fillStyle = 'rgba(12,16,20,0.82)';
      g.beginPath();
      g.arc(c.x, c.y, rad, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(238,244,250,0.95)';
      g.lineWidth = SQ * 0.05;
      g.lineCap = 'round';
      const k = rad * 0.52;
      g.beginPath();
      g.moveTo(c.x - k, c.y - k);
      g.lineTo(c.x + k, c.y + k);
      g.moveTo(c.x + k, c.y - k);
      g.lineTo(c.x - k, c.y + k);
      g.stroke();
    } else if (m.kind === 'guard') {
      const c = layout.center(m.sq);
      g.strokeStyle = INK.protect;
      g.lineWidth = SQ * 0.055;
      g.beginPath();
      g.arc(c.x, c.y, SQ * 0.36, 0, Math.PI * 2);
      g.stroke();
    } else if (m.kind === 'hover') {
      roundedSquare(g, layout, m.sq, 0.05, 0.14);
      // Contrast against whichever colour the square happens to be.
      g.strokeStyle = m.dark ? 'rgba(240,247,253,0.62)' : 'rgba(26,34,40,0.55)';
      g.lineWidth = SQ * 0.045;
      g.stroke();
    }
  }
}

/**
 * The layer whose opacity breathes: the marked target square and the check glow.
 * Both are also ringed so the eye lands there without hiding the piece.
 */
export function drawMarkers(g, layout, markers) {
  const SQ = layout.SQ;
  for (const m of markers) {
    const c = layout.center(m.sq);
    const danger = m.kind === 'check' || m.kind === 'target-hit';
    const hot = danger ? [226, 86, 72] : [244, 196, 90];
    const glow = g.createRadialGradient(c.x, c.y, SQ * 0.05, c.x, c.y, SQ * 0.78);
    glow.addColorStop(0, `rgba(${hot[0]},${hot[1]},${hot[2]},0.62)`);
    glow.addColorStop(0.55, `rgba(${hot[0]},${hot[1]},${hot[2]},0.30)`);
    glow.addColorStop(1, `rgba(${hot[0]},${hot[1]},${hot[2]},0)`);
    g.fillStyle = glow;
    g.fillRect(c.x - SQ, c.y - SQ, SQ * 2, SQ * 2);

    roundedSquare(g, layout, m.sq, 0.06, 0.14);
    g.strokeStyle = `rgba(${hot[0]},${hot[1]},${hot[2]},0.95)`;
    g.lineWidth = SQ * (danger ? 0.075 : 0.06);
    g.stroke();

    if (m.kind === 'target') {
      // A small diamond in the middle: "this is the square under discussion".
      g.fillStyle = 'rgba(255,238,200,0.9)';
      g.beginPath();
      const k = SQ * 0.11;
      g.moveTo(c.x, c.y - k);
      g.lineTo(c.x + k, c.y);
      g.lineTo(c.x, c.y + k);
      g.lineTo(c.x - k, c.y);
      g.closePath();
      g.fill();
    }
  }
}

/** One arrow: shaft with a dark casing so it reads on cream and on green. */
function arrow(g, layout, from, to, color, grow, style) {
  const SQ = layout.SQ;
  const a = layout.center(from);
  const b = layout.center(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Neighbouring squares are only one unit apart, so the gaps and the head have
  // to shrink with the arrow or the shaft would be shorter than nothing.
  const startGap = Math.min(SQ * 0.3, len * 0.16);
  const tipGap = Math.min(SQ * 0.3, len * 0.14);
  const headLen = Math.min(SQ * 0.42, len * 0.34);
  const headHalf = Math.min(SQ * 0.235, len * 0.2);
  const shaft = SQ * 0.075;

  const tail = { x: a.x + ux * startGap, y: a.y + uy * startGap };
  const headBase = { x: b.x - ux * (tipGap + headLen), y: b.y - uy * (tipGap + headLen) };
  const tip = { x: b.x - ux * tipGap, y: b.y - uy * tipGap };
  const full = Math.hypot(headBase.x - tail.x, headBase.y - tail.y);
  const reached = full * Math.max(0, Math.min(1, grow));
  const nose = { x: tail.x + ux * reached, y: tail.y + uy * reached };
  if (reached < SQ * 0.05) return;

  const casing = 'rgba(10,14,16,0.42)';
  const drawLine = (w, col, dash) => {
    g.save();
    g.strokeStyle = col;
    g.lineWidth = w;
    g.lineCap = style === 'forbid' ? 'butt' : 'round';
    g.lineJoin = 'round';
    if (dash) g.setLineDash(dash);
    g.beginPath();
    g.moveTo(tail.x, tail.y);
    g.lineTo(nose.x, nose.y);
    g.stroke();
    g.restore();
  };

  if (style === 'forbid') {
    const dash = [SQ * 0.14, SQ * 0.11];
    drawLine(shaft * 2 + SQ * 0.05, casing, dash);
    drawLine(shaft * 2, color, dash);
    // A prohibition sign where the move would land.
    if (grow > 0.72) {
      const k = Math.min(1, (grow - 0.72) / 0.28);
      g.save();
      g.globalAlpha *= k;
      const rr = SQ * 0.3;
      g.strokeStyle = casing;
      g.lineWidth = shaft * 2 + SQ * 0.05;
      g.beginPath();
      g.arc(tip.x, tip.y, rr, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = color;
      g.lineWidth = shaft * 2;
      g.beginPath();
      g.arc(tip.x, tip.y, rr, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(tip.x - rr * 0.66, tip.y - rr * 0.66);
      g.lineTo(tip.x + rr * 0.66, tip.y + rr * 0.66);
      g.stroke();
      g.restore();
    }
    return;
  }

  drawLine(shaft * 2 + SQ * 0.06, casing);
  drawLine(shaft * 2, color);

  if (grow > 0.86) {
    const k = Math.min(1, (grow - 0.86) / 0.14);
    const h = headLen * k;
    const base = { x: tip.x - ux * h, y: tip.y - uy * h };
    const px = -uy;
    const py = ux;
    const half = headHalf * (0.55 + 0.45 * k);
    const tri = () => {
      g.beginPath();
      g.moveTo(tip.x, tip.y);
      g.lineTo(base.x + px * half, base.y + py * half);
      g.lineTo(base.x - px * half, base.y - py * half);
      g.closePath();
    };
    g.fillStyle = casing;
    tri();
    g.fill();
    g.fillStyle = color;
    tri();
    g.fill();
  }
}

/** Arrows plus one-shot effects (the capture burst). */
export function drawArrows(g, layout, arrows, fx, grow) {
  for (const a of arrows) {
    arrow(g, layout, a.from, a.to, INK[a.color] || a.color, grow === undefined ? 1 : grow, a.style);
  }
  const SQ = layout.SQ;
  for (const f of fx || []) {
    const c = layout.center(f.sq);
    const t = Math.max(0, Math.min(1, f.t));
    if (t >= 1) continue;
    const ease = 1 - Math.pow(1 - t, 2);
    g.save();
    g.globalAlpha *= 1 - t;
    g.strokeStyle = f.color || INK.danger;
    g.lineWidth = SQ * (0.16 - 0.1 * t);
    g.beginPath();
    g.arc(c.x, c.y, SQ * (0.2 + 0.62 * ease), 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
}
