// Everything here paints its own textures on a <canvas>: no image files, no
// network.  All randomness comes from seeded streams so two loads match.

import * as THREE from 'three';
import { stream } from './rng.js';

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function makeTexture(canvasEl, { repeat = [1, 1], srgb = true, aniso = 8, wrap = THREE.RepeatWrapping } = {}) {
  const t = new THREE.CanvasTexture(canvasEl);
  t.wrapS = t.wrapT = wrap;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
}

// --------------------------------------------------------------------------
// tileable fractal value noise -> Float32Array(w*h) in 0..1
// --------------------------------------------------------------------------
export function fbm(w, h, cells, octaves, seed) {
  const rng = stream(`noise${seed}-${w}`);
  const out = new Float32Array(w * h);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const n = Math.max(1, cells << o);
    const grid = new Float32Array(n * n);
    for (let i = 0; i < grid.length; i++) grid[i] = rng.next();
    for (let y = 0; y < h; y++) {
      const fy = (y / h) * n;
      const iy = Math.floor(fy);
      const ty = fy - iy;
      const y0 = ((iy % n) + n) % n;
      const y1 = (y0 + 1) % n;
      const sy = ty * ty * (3 - 2 * ty);
      const row0 = y0 * n;
      const row1 = y1 * n;
      const orow = y * w;
      for (let x = 0; x < w; x++) {
        const fx = (x / w) * n;
        const ix = Math.floor(fx);
        const tx = fx - ix;
        const x0 = ((ix % n) + n) % n;
        const x1 = (x0 + 1) % n;
        const sx = tx * tx * (3 - 2 * tx);
        const a = grid[row0 + x0];
        const b = grid[row0 + x1];
        const c = grid[row1 + x0];
        const d = grid[row1 + x1];
        const i1 = a + (b - a) * sx;
        const i2 = c + (d - c) * sx;
        out[orow + x] += amp * (i1 + (i2 - i1) * sy);
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// bilinear wrap-sample of an fbm field at uv (any range, wraps)
function sample(f, w, h, u, v) {
  const fx = u * w;
  const fy = v * h;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const tx = fx - ix;
  const ty = fy - iy;
  const x0 = ((ix % w) + w) % w;
  const y0 = ((iy % h) + h) % h;
  const x1 = (x0 + 1) % w;
  const y1 = (y0 + 1) % h;
  const a = f[y0 * w + x0];
  const b = f[y0 * w + x1];
  const c = f[y1 * w + x0];
  const d = f[y1 * w + x1];
  const i1 = a + (b - a) * tx;
  const i2 = c + (d - c) * tx;
  return i1 + (i2 - i1) * ty;
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

function hsl(h, s, l, out) {
  const c = new THREE.Color();
  c.setHSL(h, s, l, THREE.SRGBColorSpace);
  out.r = c.r;
  out.g = c.g;
  out.b = c.b;
}

// --------------------------------------------------------------------------
// timber: floor boards, shelves, tables.  Planks run along +u.
// --------------------------------------------------------------------------
export function woodMaps({
  size = 512,
  planks = 6,
  rows = 3, // plank segments per row across the tile
  hue = 0.075,
  sat = 0.4,
  light = 0.34,
  grain = 0.13,
  roughBase = 0.62,
  seed = 'wood',
} = {}) {
  const rng = stream(seed);
  const streak = fbm(size, size, 6, 4, `${seed}s`);
  const fine = fbm(size, size, 60, 3, `${seed}f`);
  const blotch = fbm(size, size, 3, 2, `${seed}b`);

  // per-row plank phase + per-plank colour jitter
  const rowPhase = [];
  const jitter = [];
  for (let r = 0; r < planks; r++) {
    rowPhase.push(rng.next() / rows);
    const j = [];
    for (let k = 0; k < rows + 1; k++) j.push(rng.next() - 0.5);
    jitter.push(j);
  }

  const col = canvas(size);
  const rgh = canvas(size);
  const cctx = col.getContext('2d');
  const rctx = rgh.getContext('2d');
  const cimg = cctx.createImageData(size, size);
  const rimg = rctx.createImageData(size, size);
  const rgb = { r: 0, g: 0, b: 0 };

  for (let y = 0; y < size; y++) {
    const v = y / size;
    const rowF = v * planks;
    const row = Math.floor(rowF) % planks;
    const inRow = rowF - Math.floor(rowF);
    const uEdge = (v + rowPhase[row] / 1) * rows;
    const seg = Math.floor(uEdge) % rows;
    const inSeg = uEdge - Math.floor(uEdge);
    const j = jitter[row][seg];

    for (let x = 0; x < size; x++) {
      const u = x / size;
      const st = sample(streak, size, size, u * 0.55, v * 14);
      const fn = sample(fine, size, size, u * 0.3, v * 60);
      const bl = sample(blotch, size, size, u, v);

      let l = light + j * 0.16 + (st - 0.5) * grain + (fn - 0.5) * grain * 0.45 + (bl - 0.5) * 0.05;
      // ring / grain streaks
      const rings = 0.5 + 0.5 * Math.sin((st * 7.0 + v * planks * 26.0) * Math.PI);
      l += (rings - 0.5) * grain * 0.35;

      // chamfer darkening on plank edges
      const ev = Math.min(inRow, 1 - inRow);
      const eu = Math.min(inSeg, 1 - inSeg);
      const bevel = 1 - 0.55 * (1 - clamp01(ev / 0.035)) - 0.45 * (1 - clamp01(eu / 0.012));
      l *= 0.55 + 0.45 * bevel;

      const satNow = sat * (0.85 + 0.3 * st);
      hsl(hue + (st - 0.5) * 0.012, satNow, clamp01(l * 0.95), rgb);

      const i = (y * size + x) * 4;
      cimg.data[i] = rgb.r * 255;
      cimg.data[i + 1] = rgb.g * 255;
      cimg.data[i + 2] = rgb.b * 255;
      cimg.data[i + 3] = 255;

      const rough = clamp01(roughBase + (st - 0.5) * 0.22 - bevel * 0.06 + (fn - 0.5) * 0.05);
      const rc = Math.round(rough * 255);
      rimg.data[i] = rc;
      rimg.data[i + 1] = rc;
      rimg.data[i + 2] = rc;
      rimg.data[i + 3] = 255;
    }
  }
  cctx.putImageData(cimg, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  return { map: col, roughness: rgh };
}

// --------------------------------------------------------------------------
// lime plaster wall
// --------------------------------------------------------------------------
export function plasterCanvas({ size = 512, hue = 0.08, sat = 0.22, light = 0.42, seed = 'plaster' } = {}) {
  const n1 = fbm(size, size, 5, 4, `${seed}a`);
  const n2 = fbm(size, size, 90, 2, `${seed}b`);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rgb = { r: 0, g: 0, b: 0 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = sample(n1, size, size, x / size, y / size);
      const b = sample(n2, size, size, x / size, y / size);
      const l = light + (a - 0.5) * 0.07 + (b - 0.5) * 0.045;
      hsl(hue + (a - 0.5) * 0.01, sat, clamp01(l), rgb);
      const i = (y * size + x) * 4;
      img.data[i] = rgb.r * 255;
      img.data[i + 1] = rgb.g * 255;
      img.data[i + 2] = rgb.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// --------------------------------------------------------------------------
// woven upholstery cloth (near white: tint with material.color)
// --------------------------------------------------------------------------
export function fabricCanvas({ size = 256, scale = 34, seed = 'fabric' } = {}) {
  const n = fbm(size, size, 60, 2, `${seed}n`);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const warp = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * scale);
      const weft = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * scale);
      const over = (Math.floor(u * scale) + Math.floor(v * scale)) % 2 === 0 ? warp : weft;
      const nn = sample(n, size, size, u, v);
      const l = clamp01(0.72 + over * 0.2 + (nn - 0.5) * 0.22);
      const i = (y * size + x) * 4;
      const v8 = l * 255;
      img.data[i] = v8;
      img.data[i + 1] = v8 * 0.99;
      img.data[i + 2] = v8 * 0.96;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// leather, for the armchair
export function leatherCanvas({ size = 256, hue = 0.055, sat = 0.45, light = 0.26, seed = 'leather' } = {}) {
  const n1 = fbm(size, size, 24, 3, `${seed}a`);
  const n2 = fbm(size, size, 120, 2, `${seed}b`);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const rgb = { r: 0, g: 0, b: 0 };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const a = sample(n1, size, size, u, v);
      const b = sample(n2, size, size, u, v);
      const cre = Math.sin((a * 9 + b * 2) * Math.PI * 3);
      const l = light + (a - 0.5) * 0.1 + (b - 0.5) * 0.06 + cre * 0.03;
      hsl(hue + (a - 0.5) * 0.02, sat, clamp01(l), rgb);
      const i = (y * size + x) * 4;
      img.data[i] = rgb.r * 255;
      img.data[i + 1] = rgb.g * 255;
      img.data[i + 2] = rgb.b * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// --------------------------------------------------------------------------
// hand-knotted rug: one rug = one texture, drawn to the rug's aspect ratio
// --------------------------------------------------------------------------
export function rugCanvas({ w = 620, h = 1000, seed = 'rug' } = {}) {
  const rng = stream(seed);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const field = '#6f2f2b';
  const cream = '#d8c3a0';
  const dark = '#3d1c1c';
  const blue = '#3a4a5c';

  ctx.fillStyle = field;
  ctx.fillRect(0, 0, w, h);

  // borders
  const b = Math.round(w * 0.075);
  ctx.lineWidth = b;
  ctx.strokeStyle = cream;
  ctx.strokeRect(b / 2, b / 2, w - b, h - b);
  ctx.lineWidth = b * 0.28;
  ctx.strokeStyle = dark;
  ctx.strokeRect(b * 1.14, b * 1.14, w - b * 2.28, h - b * 2.28);
  ctx.lineWidth = Math.max(2, b * 0.1);
  ctx.strokeStyle = blue;
  ctx.strokeRect(b * 1.62, b * 1.62, w - b * 3.24, h - b * 3.24);

  // inner field panel
  const inset = b * 2.0;
  ctx.save();
  ctx.beginPath();
  ctx.rect(inset, inset, w - inset * 2, h - inset * 2);
  ctx.clip();

  // kilim diamonds
  const cols = 4;
  const rows = 7;
  const cw = (w - inset * 2) / cols;
  const ch = (h - inset * 2) / rows;
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const cx = inset + cw * (q + 0.5);
      const cy = inset + ch * (r + 0.5);
      const rad = Math.min(cw, ch) * 0.42;
      const alt = (r + q) % 2 === 0;
      ctx.beginPath();
      ctx.moveTo(cx, cy - rad);
      ctx.lineTo(cx + rad * 0.72, cy);
      ctx.lineTo(cx, cy + rad);
      ctx.lineTo(cx - rad * 0.72, cy);
      ctx.closePath();
      ctx.fillStyle = alt ? cream : blue;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx, cy - rad * 0.5);
      ctx.lineTo(cx + rad * 0.36, cy);
      ctx.lineTo(cx, cy + rad * 0.5);
      ctx.lineTo(cx - rad * 0.36, cy);
      ctx.closePath();
      ctx.fillStyle = alt ? dark : field;
      ctx.fill();
      // tiny motifs between the diamonds
      ctx.fillStyle = cream;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, cy + s * rad * 1.28);
        ctx.lineTo(cx + rad * 0.16, cy + s * rad * 1.1);
        ctx.lineTo(cx, cy + s * rad * 0.92);
        ctx.lineTo(cx - rad * 0.16, cy + s * rad * 1.1);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  ctx.restore();

  // fringe at both short ends (short ends are left/right of the canvas = x)
  ctx.strokeStyle = '#c9b48f';
  ctx.lineWidth = 2;
  for (let i = 0; i < 90; i++) {
    const yy = (i + 0.5) * (h / 90);
    ctx.beginPath();
    ctx.moveTo(0, yy);
    ctx.lineTo(b * 0.5 + rng.next() * 6, yy + (rng.next() - 0.5) * 3);
    ctx.moveTo(w, yy);
    ctx.lineTo(w - b * 0.5 - rng.next() * 6, yy + (rng.next() - 0.5) * 3);
    ctx.stroke();
  }

  // fleece fuzz / wear
  const img = ctx.getImageData(0, 0, w, h);
  const n = fbm(w, h, 140, 2, `${seed}fuzz`);
  const wear = fbm(w, h, 4, 3, `${seed}wear`);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const f = (sample(n, w, h, x / w, y / h) - 0.5) * 46;
      const wl = (sample(wear, w, h, x / w, y / h) - 0.5) * 22;
      img.data[i] = clamp01((img.data[i] + f + wl) / 255) * 255;
      img.data[i + 1] = clamp01((img.data[i + 1] + f + wl) / 255) * 255;
      img.data[i + 2] = clamp01((img.data[i + 2] + f + wl) / 255) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// --------------------------------------------------------------------------
// limestone blocks for the fireplace
// --------------------------------------------------------------------------
export function stoneCanvas({ size = 512, cols = 5, rows = 8, hue = 0.09, sat = 0.13, light = 0.55, seed = 'stone' } = {}) {
  const rng = stream(seed);
  const n = fbm(size, size, 40, 3, `${seed}n`);
  const c = canvas(size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#6b6156';
  ctx.fillRect(0, 0, size, size);
  const hh = size / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2 ? 0.5 : 0) * (size / cols);
    for (let q = -1; q < cols + 1; q++) {
      const x = off + q * (size / cols) + 2;
      const y = r * hh + 2;
      const w = size / cols - 4;
      const l = light + (rng.next() - 0.5) * 0.16;
      hsl(hue + rng.next() * 0.02, sat, clamp01(l), ctx.__rgb || (ctx.__rgb = {}));
      const rgb = ctx.__rgb;
      ctx.fillStyle = `rgb(${(rgb.r * 255) | 0},${(rgb.g * 255) | 0},${(rgb.b * 255) | 0})`;
      const rr = 3;
      ctx.beginPath();
      ctx.roundRect(x, y, w, hh - 4, rr);
      ctx.fill();
    }
  }
  // grime + pitting
  const img = ctx.getImageData(0, 0, size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const f = (sample(n, size, size, x / size, y / size) - 0.5) * 52;
      img.data[i] = clamp01((img.data[i] + f) / 255) * 255;
      img.data[i + 1] = clamp01((img.data[i + 1] + f) / 255) * 255;
      img.data[i + 2] = clamp01((img.data[i + 2] + f * 0.9) / 255) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// --------------------------------------------------------------------------
// what you see through the glass: a night sky, a moon, hills, a distant light
// --------------------------------------------------------------------------
export function skyCanvas({ w = 1024, h = 512, seed = 'sky' } = {}) {
  const rng = stream(seed);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#050a1c');
  g.addColorStop(0.42, '#0c1631');
  g.addColorStop(0.7, '#1d2b4e');
  g.addColorStop(0.85, '#3a3554');
  g.addColorStop(1, '#5b4653');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 260; i++) {
    const x = rng.next() * w;
    const y = rng.next() * h * 0.62;
    const a = Math.pow(1 - y / (h * 0.7), 1.6) * rng.next();
    const r = rng.range(0.4, 1.5);
    ctx.fillStyle = `rgba(226,236,255,${a.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // moon with a halo
  const mx = w * 0.72;
  const my = h * 0.26;
  const halo = ctx.createRadialGradient(mx, my, 2, mx, my, 90);
  halo.addColorStop(0, 'rgba(220,232,255,0.85)');
  halo.addColorStop(0.25, 'rgba(170,196,240,0.28)');
  halo.addColorStop(1, 'rgba(140,170,220,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(mx, my, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2f5ff';
  ctx.beginPath();
  ctx.arc(mx, my, 15, 0, Math.PI * 2);
  ctx.fill();

  // hills
  for (let layer = 0; layer < 3; layer++) {
    const baseY = h * (0.76 + layer * 0.055);
    const shade = ['#1b2740', '#141d31', '#0d1422'][layer];
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, baseY);
    let x = 0;
    let y = baseY;
    while (x < w) {
      const nx = x + rng.range(40, 130);
      const ny = baseY - rng.range(-14, 46) * (1 - layer * 0.25);
      ctx.quadraticCurveTo((x + nx) / 2, y - rng.range(4, 26), nx, ny);
      x = nx;
      y = ny;
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // a lone lit window in the valley
  ctx.fillStyle = 'rgba(255,203,128,0.9)';
  ctx.fillRect(w * 0.28, h * 0.845, 4, 3);
  ctx.fillStyle = 'rgba(255,190,120,0.22)';
  ctx.beginPath();
  ctx.arc(w * 0.28 + 2, h * 0.845 + 1.5, 16, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

// --------------------------------------------------------------------------
// little paintings for the frames
// --------------------------------------------------------------------------
export function paintingCanvas({ w = 300, h = 220, seed = 'paint', kind = 'landscape' } = {}) {
  const rng = stream(seed);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  if (kind === 'landscape') {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2b3a4a');
    g.addColorStop(0.55, '#7e6f5c');
    g.addColorStop(0.62, '#4a4030');
    g.addColorStop(1, '#241d18');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,214,150,0.85)';
    ctx.beginPath();
    ctx.arc(w * rng.range(0.25, 0.75), h * 0.36, rng.range(9, 16), 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = `rgba(${20 + i * 16},${24 + i * 14},${30 + i * 10},0.92)`;
      const base = h * (0.55 + i * 0.1);
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, base);
      let x = 0;
      while (x < w) {
        const nx = x + rng.range(25, 90);
        ctx.lineTo(nx, base - rng.range(0, 40) * (1 - i * 0.2));
        x = nx;
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#453e36';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = ['#7d3b2e', '#2f4438', '#b3823a', '#383a52', '#8d6f4e'][i % 5];
      ctx.globalAlpha = rng.range(0.3, 0.75);
      ctx.beginPath();
      ctx.ellipse(rng.next() * w, rng.next() * h, rng.range(12, 60), rng.range(8, 40), rng.next() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(226,206,168,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(rng.next() * w, rng.next() * h);
      ctx.lineTo(rng.next() * w, rng.next() * h);
      ctx.stroke();
    }
  }
  // canvas tooth + a bit of varnish sheen
  const img = ctx.getImageData(0, 0, w, h);
  const n = fbm(w, h, 120, 2, `${seed}t`);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const f = (sample(n, w, h, x / w, y / h) - 0.5) * 26;
      img.data[i] = clamp01((img.data[i] + f) / 255) * 255;
      img.data[i + 1] = clamp01((img.data[i + 1] + f) / 255) * 255;
      img.data[i + 2] = clamp01((img.data[i + 2] + f) / 255) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// soft round sprite for dust motes / candle glow
export function dotCanvas({ size = 64, inner = 'rgba(255,236,200,1)', outer = 'rgba(255,200,140,0)' } = {}) {
  const c = canvas(size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, 'rgba(255,220,170,0.35)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}
