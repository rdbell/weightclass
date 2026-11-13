// lesson.js — the flat 2D chess lesson: an orthographic three.js scene whose
// camera looks straight down at a board laid out in CSS pixels, plus an HTML
// interface. Board, pieces, arrows and labels are all drawn in code.
//
// The board is never rotated in 3D. Squares are placed by the rotated mapping in
// board.js (files h→a left to right, ranks 1→8 top to bottom, Black's pieces at
// the bottom), so pieces, labels and captions stay screen-upright during
// playback, seeking and replay alike.

import * as THREE from 'three';
import { Layout, makeBoardCanvas, isDark, FILES } from './board.js';
import { makePieceTextures } from './pieces.js';
import { drawMarks, drawMarkers, drawArrows } from './overlays.js';
import { SCRIPT, TOTAL, beatAt, ARROW_DELAY, ARROW_DUR, MARK_FADE } from './script.js';
import { positionAfter, LINE, moveAt, status, verify } from './game.js';

const qs = (id) => document.getElementById(id);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

// Debug aids used while building the artwork:
//   ?sheet=1   every glyph laid out big, plus a row at real on-screen size
//   ?t=SECONDS&paused=1   jump the clock to review one beat
if (params.get('sheet')) {
  const S = 150;
  const sheet = document.createElement('canvas');
  const W = 176 * 6;
  sheet.width = W;
  sheet.height = S * 2 + 92;
  sheet.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${sheet.height}px;background:#0e1216`;
  const g = sheet.getContext('2d');
  g.fillStyle = '#0e1216';
  g.fillRect(0, 0, sheet.width, sheet.height);
  const tex = makePieceTextures({ size: 320 });
  const order = ['K', 'Q', 'R', 'B', 'N', 'P'];
  ['w', 'b'].forEach((color, row) => {
    order.forEach((type, i) => {
      const x = i * 176 + (176 - S) / 2;
      const y = row * S;
      g.fillStyle = i % 2 === 0 ? '#e9edcb' : '#6b8f4f';
      g.fillRect(x, y, S, S);
      g.drawImage(tex[color + type], x, y, S, S);
      g.fillStyle = i % 2 === 0 ? '#233018' : '#f2f6e6';
      g.font = 'bold 15px monospace';
      g.fillText(color + type, x + 7, y + 19);
    });
  });
  const sq = 88;
  const y = S * 2 + 4;
  ['w', 'b'].forEach((color) => {
    order.forEach((type, i) => {
      const x = ((color === 'w' ? 0 : 6) + i) * sq;
      g.fillStyle = (i + (color === 'w' ? 0 : 1)) % 2 === 0 ? '#e9edcb' : '#6b8f4f';
      g.fillRect(x, y, sq, sq);
      g.drawImage(tex[color + type], x - 3, y - 3, sq * 1.07, sq * 1.07);
    });
  });
  document.body.appendChild(sheet);
  const corner = tex.wK.getContext('2d').getImageData(6, 6, 1, 1).data;
  console.log(`sheet: wK corner rgba=${[...corner]} ${corner[3] === 0 ? 'transparent OK' : 'NOT TRANSPARENT'}`);
} else {
  main();
}

function main() {
  // -------------------------------------------------------------------------
  // Renderer
  // -------------------------------------------------------------------------

  const stage = qs('stage');
  const canvas = qs('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
  camera.position.set(0, 0, 10);

  const unitQuad = new THREE.PlaneGeometry(1, 1);
  const dpr = () => Math.min(window.devicePixelRatio || 1, 1.5);

  function texFromCanvas(c, mipmaps) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.generateMipmaps = !!mipmaps;
    t.minFilter = mipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }

  /**
   * A transparent overlay drawn over the board. The canvas is a viewport onto
   * the board: it only covers the squares the current beat marks, and the
   * painting code still uses board coordinates because the context is translated
   * to match. Overlay layers are the bulk of the fill rate and of the texture
   * upload cost, so keeping them small matters more than it looks.
   */
  class Layer {
    constructor(order) {
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.tex = texFromCanvas(this.canvas, false);
      this.mesh = new THREE.Mesh(unitQuad, new THREE.MeshBasicMaterial({
        map: this.tex, transparent: true, depthTest: false, depthWrite: false,
      }));
      this.mesh.renderOrder = order;
      this.mesh.visible = false;
      this.key = '';
      this.boxKey = '';
      this.box = null;
      scene.add(this.mesh);
    }

    /** Forget the viewport; the next frame re-measures it against the new layout. */
    resize() {
      this.box = null;
      this.boxKey = '';
      this.key = '';
    }

    /** Move the canvas/mesh onto a rect of the board, in board-local px. */
    setBox(b) {
      const key = `${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.w)},${Math.round(b.h)}`;
      if (key === this.boxKey) return;
      this.boxKey = key;
      this.box = b;
      const d = dpr();
      const w = Math.max(4, Math.round(b.w * d));
      const h = Math.max(4, Math.round(b.h * d));
      const resized = this.canvas.width !== w || this.canvas.height !== h;
      if (resized) {
        this.canvas.width = w;
        this.canvas.height = h;
        // Resizing gives the canvas a new backing surface, and a canvas texture
        // that keeps its identity may go on sampling the old one, so swap in a
        // fresh texture. Resizing is rare: a few times per beat.
        this.tex.dispose();
        this.tex = texFromCanvas(this.canvas, false);
        this.mesh.material.map = this.tex;
      } else {
        this.tex.needsUpdate = true;
      }
      this.mesh.scale.set(b.w, b.h, 1);
      this.mesh.position.set(layout.worldX(b.x + b.w / 2), layout.worldY(b.y + b.h / 2), 0);
      this.key = '';
    }

    /** Repaint when the key changed; a no-op until the viewport has been set. */
    draw(key, paint) {
      if (!this.box || key === this.key) return false;
      this.key = key;
      const d = dpr();
      const b = this.box;
      const g = this.ctx;
      g.setTransform(d, 0, 0, d, -b.x * d, -b.y * d);
      g.clearRect(b.x, b.y, b.w, b.h);
      g.globalAlpha = 1;
      g.lineCap = 'butt';
      g.lineJoin = 'miter';
      g.setLineDash([]);
      paint(g);
      this.tex.needsUpdate = true;
      return true;
    }
  }

  /** Board-local rect covering the given squares, padded, clamped to the board. */
  function squareBox(squares, pad) {
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const sq of squares) {
      const r = layout.squareRect(sq);
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    }
    const B = layout.B;
    return {
      x: Math.max(0, x0 - pad),
      y: Math.max(0, y0 - pad),
      w: Math.min(B, x1 + pad) - Math.max(0, x0 - pad),
      h: Math.min(B, y1 + pad) - Math.max(0, y0 - pad),
    };
  }

  let layout = new Layout(480);
  let boardMesh = null;
  let boardTex = null;
  const marks = new Layer(1);
  const markers = new Layer(2);
  const arrows = new Layer(3);
  // The hover ring sits above the pieces: it is a pointer affordance, so it
  // should never be eaten by the piece standing on the square.
  const cursor = new Layer(60);

  // -------------------------------------------------------------------------
  // Pieces
  // -------------------------------------------------------------------------

  const pieceTex = {};
  {
    const canvases = makePieceTextures({ size: 256 });
    for (const k in canvases) pieceTex[k] = texFromCanvas(canvases[k], true);
  }

  const PIECE_FILL = 1.02;   // plane side as a fraction of one square
  const pool = [];

  function takeMesh(key, index) {
    let m = pool[index];
    if (!m) {
      m = new THREE.Mesh(unitQuad, new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false }));
      m.renderOrder = 20 + index;
      pool.push(m);
      scene.add(m);
    }
    if (m.material.map !== pieceTex[key]) {
      m.material.map = pieceTex[key];
      m.material.needsUpdate = true;
    }
    m.userData.key = key;
    m.visible = true;
    return m;
  }

  const squareName = (i) => FILES[i & 7] + (1 + (i >> 3));
  const pieceKey = (code) => (code === code.toUpperCase() ? 'w' : 'b') + code.toUpperCase();

  /**
   * Which pieces to draw for a beat. During a slide the moving piece is
   * interpolated and a captured piece fades out; once the slide is over the list
   * comes straight from positionAfter(ply), so seeking is always exact.
   */
  function pieceList(beat, local) {
    const out = [];
    if (beat.movePly == null || local >= beat.moveDur) {
      const board = positionAfter(beat.ply);
      for (let i = 0; i < 64; i++) {
        const code = board[i];
        if (code) out.push({ key: pieceKey(code), sq: squareName(i), alpha: 1, scale: 1 });
      }
      return out;
    }

    const mv = moveAt(beat.movePly);
    const before = positionAfter(beat.movePly - 1);
    const t = ease(clamp01(local / beat.moveDur));
    const a = layout.center(mv.from);
    const b = layout.center(mv.to);
    const lift = 1 + 0.07 * Math.sin(Math.PI * t);

    for (let i = 0; i < 64; i++) {
      const code = before[i];
      if (!code) continue;
      const sq = squareName(i);
      if (sq === mv.from) {
        out.push({
          key: pieceKey(code),
          px: a.x + (b.x - a.x) * t,
          py: a.y + (b.y - a.y) * t,
          alpha: 1,
          scale: reduceMotion ? 1 : lift,
        });
      } else if (mv.captured && sq === mv.to) {
        const f = clamp01((t - 0.4) / 0.45);
        out.push({ key: pieceKey(code), sq, alpha: 1 - f, scale: 1 + 0.24 * f });
      } else {
        out.push({ key: pieceKey(code), sq, alpha: 1, scale: 1 });
      }
    }
    return out;
  }

  function updatePieces(list) {
    const side = layout.SQ * PIECE_FILL;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const m = takeMesh(p.key, i);
      const c = p.px === undefined ? layout.center(p.sq) : { x: p.px, y: p.py };
      m.position.set(layout.worldX(c.x), layout.worldY(c.y), 0);
      m.scale.set(side * p.scale, side * p.scale, 1);
      m.material.opacity = p.alpha;
    }
    for (let i = list.length; i < pool.length; i++) pool[i].visible = false;
  }

  // -------------------------------------------------------------------------
  // Sizing
  // -------------------------------------------------------------------------

  let hover = null;
  let viewW = 0;
  let viewH = 0;

  function resize() {
    const w = Math.max(220, stage.clientWidth);
    const h = Math.max(220, stage.clientHeight);
    viewW = w;
    viewH = h;
    const d = dpr();
    renderer.setPixelRatio(d);
    renderer.setSize(w, h, false);
    camera.left = -w / 2;
    camera.right = w / 2;
    camera.top = h / 2;
    camera.bottom = -h / 2;
    camera.updateProjectionMatrix();

    // The baked texture carries the label frame, so leave room for it.
    layout = new Layout(Math.floor((Math.min(w, h) - 6) / 1.13));

    const boardCanvas = makeBoardCanvas(layout, d);
    if (!boardMesh) {
      boardTex = texFromCanvas(boardCanvas, false);
      boardMesh = new THREE.Mesh(unitQuad, new THREE.MeshBasicMaterial({
        map: boardTex, transparent: true, depthTest: false, depthWrite: false,
      }));
      boardMesh.renderOrder = 0;
      scene.add(boardMesh);
    } else {
      boardTex.image = boardCanvas;
      boardTex.needsUpdate = true;
    }
    boardMesh.scale.set(layout.total, layout.total, 1);

    marks.resize();
    markers.resize();
    arrows.resize();
    cursor.resize();
    drawnBeat = -1;
    drawnArrowBeat = -1;
  }

  // -------------------------------------------------------------------------
  // Layer contents for one beat
  // -------------------------------------------------------------------------

  function markList(beat) {
    const list = [];
    if (beat.lastPair) {
      list.push({ sq: beat.lastPair.from, kind: 'last', dark: isDark(beat.lastPair.from) });
      list.push({ sq: beat.lastPair.to, kind: 'last', dark: isDark(beat.lastPair.to) });
    }
    for (const m of beat.extra || []) list.push(m);
    return list;
  }

  /** The hovered square, drawn above the pieces by its own tiny layer. */
  function hoverMark() {
    return hover ? [{ sq: hover, kind: 'hover', dark: isDark(hover) }] : [];
  }

  /** How long after a beat starts its overlays are still animating. */
  function overlayWindow(beat) {
    const hasArrows = !!(beat.arrows && beat.arrows.length);
    if (!beat.moveDur && !hasArrows) return 0;
    return beat.moveDur + ARROW_DELAY + ARROW_DUR + 0.9;
  }

  function arrowGrow(beat, local) {
    const start = (beat.moveDur > 0 ? beat.moveDur : 0) + ARROW_DELAY * (beat.index === 0 ? 1.6 : 0.4);
    return clamp01((local - start) / ARROW_DUR);
  }

  function captureFx(beat, local) {
    if (beat.movePly == null) return null;
    const mv = moveAt(beat.movePly);
    if (!mv || !mv.captured) return null;
    const t = (local - beat.moveDur * 0.6) / 0.72;
    return t > 0 && t < 1 ? [{ sq: mv.to, t }] : (t >= 1 ? [] : null);
  }

  // -------------------------------------------------------------------------
  // Clock and state
  // -------------------------------------------------------------------------

  let clock = 0;
  let playing = true;
  let finished = false;
  let shownBeat = -1;
  let last = performance.now();
  let drawnBeat = -1;
  let drawnArrowBeat = -1;

  function seekBeat(index, { animate = true } = {}) {
    const i = Math.max(0, Math.min(SCRIPT.length - 1, index));
    const beat = SCRIPT[i];
    finished = false;
    // When stepping by hand, land on the completed position so the board always
    // shows a real position, never a piece mid-flight.
    clock = animate ? beat.start : beat.start + beat.moveDur + 0.004;
    paintBeat(true);
    updatePlayButton();
  }

  /**
   * Nearest beat that changes the position, in the given direction. Beats are
   * keyed by the position they show, so two beats describing the same position
   * count as one step.
   */
  function beatInDirection(dir) {
    const i = beatAt(clock);
    const here = SCRIPT[i].ply;
    if (dir > 0) {
      for (let j = i + 1; j < SCRIPT.length; j++) if (SCRIPT[j].ply > here) return j;
      return SCRIPT.length - 1;
    }
    for (let j = i - 1; j >= 0; j--) if (SCRIPT[j].ply < here) return j;
    return 0;
  }

  function stepMove(dir) {
    seekBeat(beatInDirection(dir), { animate: playing });
  }

  // -------------------------------------------------------------------------
  // HTML interface
  // -------------------------------------------------------------------------

  const el = {
    kicker: qs('kicker'),
    head: qs('head'),
    body: qs('body'),
    card: qs('caption'),
    turn: qs('turn'),
    turnText: qs('turn-text'),
    step: qs('step'),
    fill: qs('fill'),
    progress: qs('progress'),
    play: qs('btn-play'),
    prev: qs('btn-prev'),
    next: qs('btn-next'),
    replay: qs('btn-replay'),
    moves: qs('moves'),
    square: qs('square-chip'),
    ticks: qs('ticks'),
  };

  function buildMoveList() {
    const rows = [];
    for (let n = 1; n <= Math.ceil(LINE.length / 2); n++) {
      const cells = [`<td class="no">${n}.</td>`];
      for (const ply of [2 * n - 1, 2 * n]) {
        const m = LINE[ply - 1];
        if (m) cells.push(`<td><button class="mv" data-ply="${ply}" title="Jump to move ${n}">${m.san}</button></td>`);
      }
      rows.push(`<tr>${cells.join('')}</tr>`);
    }
    el.moves.innerHTML = rows.join('');
    el.moves.querySelectorAll('button.mv').forEach((b) => {
      b.addEventListener('click', () => {
        seekBeat(SCRIPT.findIndex((x) => x.ply === Number(b.dataset.ply)), { animate: false });
      });
    });
  }

  function paintBeat(force) {
    const beat = SCRIPT[beatAt(clock)];
    if (!force && beat.index === shownBeat) return;
    shownBeat = beat.index;

    el.kicker.textContent = beat.kicker;
    el.head.textContent = beat.head;
    el.body.textContent = beat.body;
    el.card.classList.remove('in');
    void el.card.offsetWidth;
    el.card.classList.add('in');
    el.step.textContent = `${beat.index + 1} / ${SCRIPT.length}`;

    const toMove = beat.ply % 2 === 0 ? 'w' : 'b';
    const st = status(positionAfter(beat.ply), toMove);
    const mover = beat.movePly != null ? moveAt(beat.movePly) : null;
    el.turnText.textContent = (mover ? `${mover.white ? 'White' : 'Black'} played ${mover.san} · ` : '')
      + (st === 'mate' ? 'Checkmate — Black is mated'
        : st === 'check' ? 'Check'
          : (toMove === 'w' ? 'White to play' : 'Black to play'));
    el.turn.classList.toggle('mate', st === 'mate');

    el.moves.querySelectorAll('button.mv').forEach((b) => {
      b.classList.toggle('current', Number(b.dataset.ply) === beat.ply);
    });
  }

  function updatePlayButton() {
    el.play.dataset.icon = finished ? 'replay' : playing ? 'pause' : 'play';
    el.play.setAttribute('aria-label', finished ? 'Replay lesson' : playing ? 'Pause' : 'Play');
  }

  // -------------------------------------------------------------------------
  // Frame
  // -------------------------------------------------------------------------

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (playing && !finished) {
      clock += dt;
      if (clock >= TOTAL) {
        clock = TOTAL;
        finished = true;
        playing = false;
        paintBeat(true);
        updatePlayButton();
      }
    }

    const beat = SCRIPT[beatAt(clock)];
    const local = clock - beat.start;
    paintBeat(false);

    // --- overlays ----------------------------------------------------------
    const list = markList(beat);
    const markerList = beat.markers || [];
    const fx = captureFx(beat, local) || [];
    const showArrows = !!(beat.arrows && beat.arrows.length) || fx.length > 0;

    // Size each layer's viewport first: the painting code below addresses the
    // board in absolute coordinates.
    if (list.length) marks.setBox(squareBox(list.map((m) => m.sq), layout.SQ * 0.2));
    if (markerList.length) markers.setBox(squareBox(markerList.map((m) => m.sq), layout.SQ * 0.85));
    if (showArrows) {
      const squares = (beat.arrows || []).flatMap((a) => [a.from, a.to]).concat(fx.map((f) => f.sq));
      arrows.setBox(squareBox(squares, layout.SQ * 0.75));
    }

    if (beat.index !== drawnBeat) {
      drawnBeat = beat.index;
      marks.draw(`m${beat.index}`, (g) => drawMarks(g, layout, list));
      markers.draw(`k${beat.index}`, (g) => drawMarkers(g, layout, markerList));
    }
    marks.mesh.visible = list.length > 0;
    markers.mesh.visible = markerList.length > 0;

    // Hover ring: one square wide, repainted only when the square changes.
    const hoverList = hoverMark();
    if (hoverList.length) {
      cursor.setBox(squareBox(hoverList.map((m) => m.sq), layout.SQ * 0.1));
      cursor.draw(`h${hoverList[0].sq}|${hoverList[0].dark}`, (g) => drawMarks(g, layout, hoverList));
    }
    cursor.mesh.visible = hoverList.length > 0;

    if (beat.index !== drawnArrowBeat || local < overlayWindow(beat)) {
      drawnArrowBeat = beat.index;
      const grow = arrowGrow(beat, local);
      // Repainting re-uploads a texture, so quantise the draw-in to 24 steps:
      // the growth still reads as continuous, but happens a fraction as often.
      const step = (v) => Math.round(v * 24) / 24;
      arrows.draw(`a${beat.index}|${step(grow).toFixed(3)}|${fx.length ? step(fx[0].t).toFixed(3) : 'x'}`,
        (g) => drawArrows(g, layout, beat.arrows || [], fx, grow));
    }
    arrows.mesh.visible = showArrows;

    updatePieces(pieceList(beat, local));

    // Marks fade in as the beat settles; the marker layer keeps breathing, so the
    // square under discussion never looks like a static sticker.
    const fadeFrom = beat.moveDur ? beat.moveDur * 0.55 : 0;
    marks.mesh.material.opacity = reduceMotion ? 1 : clamp01((local - fadeFrom) / MARK_FADE);
    markers.mesh.material.opacity = markerList.length
      ? (reduceMotion ? 0.95 : 0.66 + 0.2 * Math.sin(now / 445) + 0.14 * Math.sin(now / 143))
      : 0;

    const p = clock / TOTAL;
    el.fill.style.transform = `scaleX(${p})`;
    el.progress.setAttribute('aria-valuenow', Math.round(p * 100));

    renderer.render(scene, camera);
  }

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------

  el.play.addEventListener('click', () => {
    if (finished) { clock = 0; finished = false; playing = true; paintBeat(true); }
    else playing = !playing;
    updatePlayButton();
  });
  el.prev.addEventListener('click', () => stepMove(-1));
  el.next.addEventListener('click', () => stepMove(1));
  el.replay.addEventListener('click', () => {
    clock = 0;
    finished = false;
    playing = true;
    paintBeat(true);
    updatePlayButton();
  });
  /** Advance one beat: while playing let the next beat animate, otherwise land
   *  on its finished position so stepping never stops on a piece in flight. */
  function advance() {
    if (finished) { el.replay.click(); return; }
    const nextBeat = SCRIPT[beatAt(clock) + 1];
    if (!nextBeat) { clock = TOTAL; paintBeat(true); return; }
    clock = playing ? nextBeat.start + 0.002
      : Math.min(nextBeat.start + nextBeat.moveDur + 0.004, nextBeat.start + nextBeat.dur - 0.02);
    paintBeat(true);
  }

  el.card.addEventListener('click', advance);
  canvas.addEventListener('click', advance);

  window.addEventListener('keydown', (ev) => {
    if (ev.key === ' ') { ev.preventDefault(); el.play.click(); }
    else if (ev.key === 'ArrowRight') { ev.preventDefault(); stepMove(1); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); stepMove(-1); }
    else if (ev.key === 'Home' || ev.key.toLowerCase() === 'r') el.replay.click();
  });

  function setHover(name) {
    if (name === hover) return;
    hover = name;
    el.square.textContent = name ? `square ${name}` : '';
    el.square.classList.toggle('on', !!name);
  }

  canvas.addEventListener('pointermove', (ev) => {
    // Touch has no hover: a tap would leave a ring stuck on the board.
    if (ev.pointerType === 'touch') return;
    const r = canvas.getBoundingClientRect();
    // Screen px -> board-local px: world x is rightward and world y is upward,
    // while board-local y runs downward from the top of the displayed board.
    const x = ev.clientX - r.left - viewW / 2 + layout.B / 2;
    const y = layout.B / 2 - (viewH / 2 - (ev.clientY - r.top));
    const f = 7 - Math.floor(x / layout.SQ);
    const rk = Math.floor(y / layout.SQ) + 1;
    setHover(f >= 0 && f < 8 && rk >= 1 && rk <= 8 ? FILES[f] + rk : null);
  });
  canvas.addEventListener('pointerleave', () => setHover(null));
  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'touch') setHover(null);
  });

  window.addEventListener('resize', () => {
    resize();
    paintBeat(true);
  });

  // -------------------------------------------------------------------------
  // Go
  // -------------------------------------------------------------------------

  const problems = verify();
  if (problems.length) console.error('lesson self-check failed:', problems.join('; '));

  /**
   * Debug/verification API. readBoard() rebuilds the position from the meshes
   * actually in the scene, so a test can compare what is drawn against what the
   * move list says should be drawn.
   */
  window.__lesson = {
    SCRIPT,
    state: () => ({ clock, beat: beatAt(clock), playing, finished, total: TOTAL, hover }),
    seekBeat: (i) => { playing = false; seekBeat(i, { animate: false }); },
    seek: (t) => { playing = false; finished = false; clock = Math.max(0, Math.min(TOTAL, t)); paintBeat(true); },
    play: () => { playing = true; finished = false; updatePlayButton(); },
    pause: () => { playing = false; updatePlayButton(); },
    stepMove,
    beatPly: (i) => SCRIPT[i] ? SCRIPT[i].ply : -1,
    /** Centre of a square in page pixels (the renderer draws at 1 unit = 1 px). */
    squareScreen(square) {
      const r = canvas.getBoundingClientRect();
      const c = layout.center(square);
      return {
        x: r.left + r.width / 2 + layout.worldX(c.x),
        y: r.top + r.height / 2 - layout.worldY(c.y),
      };
    },
    /** Overlay layer state, for tests: which viewport each layer is using.
     *  Pass true to also get each layer's canvas as a data URL. */
    layers: (withPng = false) => [marks, markers, arrows, cursor].map((l) => ({
      box: l.box && [Math.round(l.box.x), Math.round(l.box.y), Math.round(l.box.w), Math.round(l.box.h)],
      canvas: [l.canvas.width, l.canvas.height],
      visible: l.mesh.visible,
      opacity: +l.mesh.material.opacity.toFixed(2),
      key: l.key,
      ink: l.canvas.width ? l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height).data
        .reduce((n, v, i) => (i % 4 === 3 && v > 8 ? n + 1 : n), 0) : 0,
      png: withPng ? l.canvas.toDataURL() : undefined,
    })),
    /** Live three.js objects, for tests. */
    three: { renderer, scene, camera, marks, markers, arrows },
    /** Squares the marks layer is currently sized for, plus that box. */
    marksInfo: () => {      const beat = SCRIPT[beatAt(clock)];
      const list = markList(beat);
      return {
        squares: list.map((m) => m.sq),
        box: marks.box,
        board: { B: layout.B, SQ: layout.SQ, total: layout.total },
        rects: Object.fromEntries(list.map((m) => [m.sq, layout.squareRect(m.sq)])),
      };
    },
    readBoard() {
      const cells = new Array(64).fill('..');      for (const m of pool) {
        if (!m.visible) continue;
        const x = m.position.x + layout.B / 2;
        const y = layout.B / 2 - m.position.y;
        const f = 7 - Math.floor(x / layout.SQ);
        const r = Math.floor(y / layout.SQ) + 1;
        if (f < 0 || f > 7 || r < 1 || r > 8) return `offboard:${m.userData.key}`;
        const i = (r - 1) * 8 + f;
        cells[i] = cells[i] === '..' ? m.userData.key : '!!';
      }
      return cells.join('');
    },
  };

  el.ticks.innerHTML = SCRIPT.map((b) => `<i style="flex:${b.dur}"></i>`).join('');
  buildMoveList();
  resize();
  if (params.get('paused') || params.get('t')) {
    playing = false;
    const t = Number(params.get('t'));
    if (Number.isFinite(t)) clock = Math.max(0, Math.min(TOTAL, t));
  }
  paintBeat(true);
  updatePlayButton();
  requestAnimationFrame((t) => { last = t; frame(t); });
}
