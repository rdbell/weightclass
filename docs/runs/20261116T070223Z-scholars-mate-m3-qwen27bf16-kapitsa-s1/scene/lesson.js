// lesson.js — Scholar's Mate animated lesson (Black's perspective)
import * as THREE from 'three';
import { pieceCanvas, shadowCanvas } from './pieces.js';
import {
  initialPosition, labeledAfter, makeMove, legalMoves, inCheck,
  isCheckmate, fen,
} from './chess.js';

// ---------------------------------------------------------------------------
// Seeded RNG (mulberry32) — deterministic across loads
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xC0FFEE);

// ---------------------------------------------------------------------------
// The supplied line (verified below) and the lesson timeline
// ---------------------------------------------------------------------------
const LINE = [
  { san: 'e4',    from: 'e2', to: 'e4', white: true },
  { san: 'e5',    from: 'e7', to: 'e5', white: false },
  { san: 'Bc4',   from: 'f1', to: 'c4', white: true },
  { san: 'Nc6',   from: 'b8', to: 'c6', white: false },
  { san: 'Qh5',   from: 'd1', to: 'h5', white: true },
  { san: 'Nf6',   from: 'g8', to: 'f6', white: false },
  { san: 'Qxf7#', from: 'h5', to: 'f7', white: true },
];

const STEPS = [
  {
    id: 'intro', movesApplied: 0,
    tag: "Scholar's Mate",
    text: 'The classic beginner trap — checkmate in four moves. You are watching as Black: your pieces are on the bottom.',
    hold: 4200,
  },
  {
    id: 'e4', movesApplied: 0, from: 'e2', to: 'e4',
    tag: '1. e4',
    text: 'White opens the center, freeing the queen and the king’s bishop.',
    lastMove: ['e2', 'e4'],
    hold: 3400,
  },
  {
    id: 'e5', movesApplied: 1, from: 'e7', to: 'e5',
    tag: '1... e5',
    text: 'Black mirrors. Notice f7 — it is guarded only by the king.',
    lastMove: ['e7', 'e5'],
    target: 'f7',
    hold: 3600,
  },
  {
    id: 'Bc4', movesApplied: 2, from: 'f1', to: 'c4',
    tag: '2. Bc4',
    text: 'The bishop takes the long diagonal, aiming straight at f7.',
    lastMove: ['f1', 'c4'],
    target: 'f7',
    arrows: [{ from: 'c4', to: 'f7', kind: 'attack' }],
    hold: 3600,
  },
  {
    id: 'Nc6', movesApplied: 3, from: 'b8', to: 'c6',
    tag: '2... Nc6',
    text: 'A natural developing move — but it does nothing about the threat on f7.',
    lastMove: ['b8', 'c6'],
    target: 'f7',
    arrows: [{ from: 'c4', to: 'f7', kind: 'attack', faint: true }],
    hold: 3600,
  },
  {
    id: 'Qh5', movesApplied: 4, from: 'd1', to: 'h5',
    tag: '3. Qh5',
    text: 'The queen swings into the attack. Bishop and queen now both point at f7.',
    lastMove: ['d1', 'h5'],
    target: 'f7',
    arrows: [
      { from: 'c4', to: 'f7', kind: 'attack', faint: true },
      { from: 'h5', to: 'f7', kind: 'attack' },
    ],
    hold: 3800,
  },
  {
    id: 'Nf6', movesApplied: 5, from: 'g8', to: 'f6',
    tag: '3... Nf6??',
    text: 'Black attacks the queen, but f7 is still guarded only by the king. The fatal mistake.',
    lastMove: ['g8', 'f6'],
    target: 'f7',
    arrows: [
      { from: 'f6', to: 'h5', kind: 'attack', faint: true },
      { from: 'h5', to: 'f7', kind: 'attack' },
    ],
    hold: 4000,
  },
  {
    id: 'Qxf7', movesApplied: 6, from: 'h5', to: 'f7', captured: 'f7',
    tag: '4. Qxf7#',
    text: 'Checkmate. The king cannot take the queen — the bishop guards her — and has no escape.',
    lastMove: ['h5', 'f7'],
    check: 'e8',
    arrows: [{ from: 'c4', to: 'f7', kind: 'guard' }],
    blocked: ['e7'],
    hold: 4800,
  },
  {
    id: 'takeaway', movesApplied: 7,
    tag: 'The takeaway',
    text: 'Scholar’s Mate is an avoidable trap, not a forced win. Develop, defend f7 early, and always check for threats before chasing the queen.',
    hold: 6000,
  },
];

// ---------------------------------------------------------------------------
// Verification: every supplied move is legal, and the final position is mate
// ---------------------------------------------------------------------------
function validate() {
  let pos = initialPosition();
  let ok = true;
  for (const m of LINE) {
    const color = m.white ? 'w' : 'b';
    const found = legalMoves(pos, color).some((x) => x.from === m.from && x.to === m.to);
    if (!found) { ok = false; console.error('[lesson] move', m.san, 'is NOT legal'); }
    pos = makeMove(pos, { from: m.from, to: m.to });
  }
  const expected = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
  const got = fen(pos, 'b');
  console.info('[lesson] final FEN:', got, got === expected ? '(matches expected)' : '(MISMATCH!)');
  const mate = isCheckmate(pos, 'b');
  console.info('[lesson] Black in check:', inCheck(pos, 'b'),
    '| legal replies:', legalMoves(pos, 'b').length,
    '| checkmate:', mate);
  return ok && mate && got === expected;
}
const VALID = validate();
if (!VALID) console.error('[lesson] VERIFICATION FAILED');

// ---------------------------------------------------------------------------
// Geometry: Black's perspective.
// Files run h→a left to right, ranks 1→8 top to bottom.
//   x = 3.5 - fileIndex(a=0),  y = 3.5 - rankIndex(rank 1 = 0)
// ---------------------------------------------------------------------------
function squareXY(sq) {
  const file = sq.charCodeAt(0) - 97;
  const rank = sq.charCodeAt(1) - 49; // 0-based: rank 1 -> 0
  return [3.5 - file, 3.5 - rank];
}
function squarePx(sq) {
  const [x, y] = squareXY(sq);
  return [(x + 4) * 128, (4 - y) * 128];
}
// a1 is dark: with 0-based ranks, dark when (file + rank) is even.
const isDark = (sq) => ((sq.charCodeAt(0) - 97) + (sq.charCodeAt(1) - 49)) % 2 === 0;

// Precomputed labeled states: STATE[k] = Map(pieceId -> square) after k moves
const STATE = [];
const ID_AT = [];
for (let k = 0; k <= LINE.length; k++) {
  const labeled = labeledAfter(LINE, k);
  const byId = new Map();
  const bySq = new Map();
  for (const [sq, e] of labeled) { byId.set(e.id, sq); bySq.set(sq, e.id); }
  STATE.push(byId);
  ID_AT.push(bySq);
}

// ---------------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------------
const wrap = document.getElementById('boardWrap');
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x35322c, 1);

const scene = new THREE.Scene();
const CAM = 4.78;
const camera = new THREE.OrthographicCamera(-CAM, CAM, CAM, -CAM, 0.1, 50);
camera.position.set(0, 0, 12);

// ---- board texture (squares + rotated coordinate labels) ----
const FILES = 'abcdefgh';
function buildBoardTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const ctx = c.getContext('2d');
  const LIGHT = [0xee, 0xee, 0xd2];
  const DARK = [0x76, 0x96, 0x56];
  for (let file = 0; file < 8; file++) {
    for (let rank = 1; rank <= 8; rank++) {
      const col = 7 - file;
      const rowTop = rank - 1;
      const base = isDark(FILES[file] + rank) ? DARK : LIGHT;
      const j = (rand() - 0.5) * 5;
      ctx.fillStyle = `rgb(${(base[0] + j) | 0},${(base[1] + j) | 0},${(base[2] + j) | 0})`;
      ctx.fillRect(col * 128, rowTop * 128, 128, 128);
    }
  }
  ctx.font = '600 30px -apple-system, "Segoe UI", Roboto, "DejaVu Sans", sans-serif';
  for (let col = 0; col < 8; col++) {
    const file = 7 - col;
    // file letter, bottom row (rank 8), bottom-right corner
    ctx.fillStyle = isDark(FILES[file] + '8') ? 'rgba(238,238,210,0.92)' : 'rgba(118,150,86,1)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(FILES[file], col * 128 + 114, 7 * 128 + 116);
    // rank number, left column (h-file), top-left corner
    if (col === 0) {
      for (let rowTop = 0; rowTop < 8; rowTop++) {
        const rank = rowTop + 1;
        ctx.fillStyle = isDark('h' + rank) ? 'rgba(238,238,210,0.92)' : 'rgba(118,150,86,1)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(rank), 14, rowTop * 128 + 10);
      }
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, 1018, 1018);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const board = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshBasicMaterial({ map: buildBoardTexture() })
);
board.position.z = 0;
board.renderOrder = 0;
scene.add(board);

// ---- overlays: last-move squares (immediate) + explanatory graphics
// (arrows / blocked rings), which fade in just after the move lands ----
function makeOverlayPlane(z, renderOrder) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  );
  mesh.position.z = z;
  mesh.renderOrder = renderOrder;
  scene.add(mesh);
  return { canvas: c, ctx: c.getContext('2d'), tex, mesh };
}
const ovLast = makeOverlayPlane(0.02, 2);
const ovExplain = makeOverlayPlane(0.022, 2);

function drawArrow(ctx, a) {
  const [x1, y1] = squarePx(a.from);
  const [x2, y2] = squarePx(a.to);
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len;
  const tipX = x2 - ux * 46, tipY = y2 - uy * 46;
  const headLen = 62, w = 27;
  const baseX = tipX - ux * headLen, baseY = tipY - uy * headLen;
  const sx = x1 + ux * 46, sy = y1 + uy * 46;
  const rgb = a.kind === 'guard' ? '96, 165, 240' : '232, 168, 32';
  const alpha = a.faint ? 0.5 : 0.9;
  // dark underlay for contrast
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(30,26,18,${(alpha * 0.35).toFixed(3)})`;
  ctx.lineWidth = 36;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(baseX, baseY); ctx.stroke();
  ctx.fillStyle = `rgba(30,26,18,${(alpha * 0.35).toFixed(3)})`;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseX - uy * w, baseY + ux * w);
  ctx.lineTo(baseX + uy * w, baseY - ux * w);
  ctx.closePath(); ctx.fill();
  // colored arrow
  ctx.strokeStyle = `rgba(${rgb},${alpha})`;
  ctx.lineWidth = 26;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(baseX, baseY); ctx.stroke();
  ctx.fillStyle = `rgba(${rgb},${alpha})`;
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(baseX - uy * w, baseY + ux * w);
  ctx.lineTo(baseX + uy * w, baseY - ux * w);
  ctx.closePath(); ctx.fill();
}

function drawOverlay(step) {
  ovLast.ctx.clearRect(0, 0, 1024, 1024);
  if (step.lastMove) {
    ovLast.ctx.fillStyle = 'rgba(247, 222, 84, 0.42)';
    for (const sq of step.lastMove) {
      const [px, py] = squarePx(sq);
      ovLast.ctx.fillRect(px - 64, py - 64, 128, 128);
    }
  }
  ovLast.tex.needsUpdate = true;

  ovExplain.ctx.clearRect(0, 0, 1024, 1024);
  for (const a of step.arrows || []) drawArrow(ovExplain.ctx, a);
  for (const sq of step.blocked || []) {
    const [px, py] = squarePx(sq);
    ovExplain.ctx.strokeStyle = 'rgba(224, 82, 60, 0.8)';
    ovExplain.ctx.lineWidth = 9;
    ovExplain.ctx.beginPath();
    ovExplain.ctx.arc(px, py, 34, 0, Math.PI * 2);
    ovExplain.ctx.stroke();
  }
  ovExplain.tex.needsUpdate = true;
  ovExplain.mesh.material.opacity = 0; // fades in after the move lands
}

// ---- pulsing glow planes (target square, check) ----
function glowTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const targetPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1.08, 1.08),
  new THREE.MeshBasicMaterial({
    map: glowTexture('rgba(255,193,7,0.9)', 'rgba(255,193,7,0)'),
    transparent: true, depthWrite: false,
  })
);
targetPlane.position.z = 0.025;
targetPlane.renderOrder = 3;
targetPlane.visible = false;
scene.add(targetPlane);

const checkPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(1.2, 1.2),
  new THREE.MeshBasicMaterial({
    map: glowTexture('rgba(230,57,44,0.95)', 'rgba(230,57,44,0)'),
    transparent: true, depthWrite: false,
  })
);
checkPlane.position.z = 0.03;
checkPlane.renderOrder = 4;
checkPlane.visible = false;
scene.add(checkPlane);

// ---- pieces (stable ids, one mesh per physical piece) ----
const PIECE_Z = 0.06;
const pieceMeshes = new Map(); // id -> { mesh, shadow, mat, smat }
{
  const shadowTex = new THREE.CanvasTexture(shadowCanvas());
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  for (const [sq, entry] of labeledAfter(LINE, 0)) {
    const color = entry.piece[0], type = entry.piece[1];
    const tex = new THREE.CanvasTexture(pieceCanvas(color, type));
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), mat);
    mesh.position.z = PIECE_Z;
    mesh.renderOrder = 10;
    const smat = new THREE.MeshBasicMaterial({
      map: shadowTex, transparent: true, depthWrite: false, opacity: 0.9,
    });
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), smat);
    shadow.position.z = 0.04;
    shadow.renderOrder = 5;
    scene.add(mesh);
    scene.add(shadow);
    pieceMeshes.set(entry.id, { mesh, shadow, mat, smat });
  }
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------
const ANIM_MS = 620;
const stepDur = (s) => (s.from ? ANIM_MS + s.hold : s.hold);
const stepStart = [];
{
  let acc = 0;
  for (const s of STEPS) { stepStart.push(acc); acc += stepDur(s); }
}
const TOTAL = stepStart[STEPS.length];

let t = 0;
let playing = false;
let currentStep = -1;
let seekAnim = null; // { step, t0 } — one-shot move animation after seeking
let stepChangeTime = 0;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function stepAt(time) {
  for (let i = STEPS.length - 1; i >= 0; i--) if (time >= stepStart[i]) return i;
  return 0;
}

function moveProgress(s, now) {
  const st = STEPS[s];
  if (!st.from) return 1;
  if (seekAnim && seekAnim.step === s) {
    const p = (now - seekAnim.t0) / ANIM_MS;
    if (p >= 1) { seekAnim = null; return 1; }
    return ease(Math.max(0, p));
  }
  const local = t - stepStart[s];
  if (local >= ANIM_MS) return 1;
  return ease(Math.max(0, local) / ANIM_MS);
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const captionInner = $('captionInner');
const captionTag = $('captionTag');
const captionText = $('captionText');
const turnChip = $('turnChip');
const turnLabel = $('turnLabel');
const banner = $('mateBanner');
const progressEl = $('progress');
const progressFill = $('progressFill');
const capW = $('capW');
const capB = $('capB');
const ml = $('moveList');
const btnPlay = $('btnPlay');
const btnPrev = $('btnPrev');
const btnNext = $('btnNext');
const btnReplay = $('btnReplay');

const ICONS = {
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2.2v14H6zM19.4 5.9v12.2c0 .8-.9 1.3-1.6.9L8.4 12.8c-.6-.4-.6-1.4 0-1.8l9.4-6.2c.7-.4 1.6.1 1.6.9z"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.8 5H18v14h-2.2zM4.6 5.9v12.2c0 .8.9 1.3 1.6.9l9.4-6.2c.6-.4.6-1.4 0-1.8L6.2 4.8c-.7-.4-1.6.1-1.6.9z"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8c0 .8.9 1.3 1.6.9l10.2-6.4c.6-.4.6-1.4 0-1.8L9.6 4.7c-.7-.4-1.6.1-1.6.9z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.6z"/></svg>',
  replay: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5V1.8L7.4 6 12 10.2V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z"/></svg>',
};
btnPrev.innerHTML = ICONS.prev;
btnNext.innerHTML = ICONS.next;
btnReplay.innerHTML = ICONS.replay;

// move list
const mlCells = [];
for (let i = 0; i < 4; i++) {
  const row = document.createElement('div');
  row.className = 'ml-row';
  const num = document.createElement('span');
  num.className = 'ml-num';
  num.textContent = (i + 1) + '.';
  row.appendChild(num);
  const mk = (move, stepIdx) => {
    const b = document.createElement('button');
    b.className = 'ml-cell';
    if (move) {
      b.textContent = move.san;
      b.dataset.step = String(stepIdx);
      b.title = 'Show position after ' + move.san;
      mlCells.push(b);
    } else {
      b.classList.add('empty');
    }
    return b;
  };
  row.appendChild(mk(LINE[2 * i], 2 * i + 1));
  row.appendChild(mk(LINE[2 * i + 1], 2 * i + 2));
  ml.appendChild(row);
}
ml.addEventListener('click', (e) => {
  const cell = e.target.closest('.ml-cell');
  if (!cell || cell.dataset.step === undefined) return;
  seekToStep(+cell.dataset.step);
});

// progress ticks (one per step boundary after the intro)
for (let i = 1; i < STEPS.length; i++) {
  const tick = document.createElement('div');
  tick.className = 'ptick';
  tick.style.left = (stepStart[i] / TOTAL * 100).toFixed(2) + '%';
  progressEl.appendChild(tick);
}

function setCaption(st) {
  captionTag.textContent = st.tag;
  captionText.textContent = st.text;
  captionInner.classList.remove('swap');
  void captionInner.offsetWidth;
  captionInner.classList.add('swap');
}

function turnForStep(s) {
  if (s === 0) return { label: 'White to move', cls: '' };
  if (s >= 7) return { label: 'Checkmate', cls: 'mate' };
  return LINE[s - 1].white ? { label: 'Black to move', cls: 'b' } : { label: 'White to move', cls: '' };
}

function captureIcon(color, type) {
  const img = document.createElement('img');
  img.className = 'cap-piece';
  img.alt = '';
  img.src = pieceCanvas(color, type).toDataURL();
  return img;
}
function updateCaptures(s) {
  capW.innerHTML = '';
  capB.innerHTML = '';
  if (s >= 7) capW.appendChild(captureIcon('b', 'P'));
}

function onStepChange(s) {
  currentStep = s;
  stepChangeTime = performance.now();
  const st = STEPS[s];
  setCaption(st);
  const turn = turnForStep(s);
  turnChip.className = turn.cls;
  turnLabel.textContent = turn.label;
  const highlightStep = s === 0 ? -1 : Math.min(s, 7);
  for (const cell of mlCells) cell.classList.toggle('current', +cell.dataset.step === highlightStep);
  updateCaptures(s);
  drawOverlay(st);
  if (st.target) {
    const [x, y] = squareXY(st.target);
    targetPlane.position.set(x, y, 0.025);
    targetPlane.visible = true;
  } else {
    targetPlane.visible = false;
  }
  if (st.check) {
    const [x, y] = squareXY(st.check);
    checkPlane.position.set(x, y, 0.03);
    checkPlane.visible = true;
  } else {
    checkPlane.visible = false;
  }
  banner.classList.toggle('delay', s === 7);
  banner.classList.toggle('show', s >= 7);
}

function updatePlayButton() {
  btnPlay.innerHTML = playing ? ICONS.pause : ICONS.play;
  btnPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function seekToStep(s) {
  s = Math.max(0, Math.min(STEPS.length - 1, s));
  const st = STEPS[s];
  t = stepStart[s] + (st.from ? ANIM_MS : 0);
  seekAnim = st.from ? { step: s, t0: performance.now() } : null;
  currentStep = -1; // force UI refresh
}

function togglePlay() {
  if (!playing && t >= TOTAL - 1) {
    seekToStep(0);
    playing = true;
  } else {
    playing = !playing;
  }
  updatePlayButton();
}
function replay() {
  seekToStep(0);
  playing = true;
  updatePlayButton();
}
const nextStep = () => seekToStep(stepAt(t) + 1);
const prevStep = () => seekToStep(stepAt(t) - 1);

btnPlay.addEventListener('click', togglePlay);
btnPrev.addEventListener('click', prevStep);
btnNext.addEventListener('click', nextStep);
btnReplay.addEventListener('click', replay);
progressEl.addEventListener('click', (e) => {
  const r = progressEl.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  seekToStep(stepAt(frac * TOTAL));
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') nextStep();
  else if (e.key === 'ArrowLeft') prevStep();
  else if (e.key === 'r' || e.key === 'R') replay();
});

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------
function renderBoard(now) {
  const s = stepAt(t);
  if (s !== currentStep) onStepChange(s);
  const st = STEPS[s];
  const state = STATE[st.movesApplied];
  const idAt = ID_AT[st.movesApplied];
  const prog = moveProgress(s, now);
  const moverId = st.from ? idAt.get(st.from) : null;
  const capturedId = st.captured ? idAt.get(st.captured) : null;
  const [fx, fy] = st.from ? squareXY(st.from) : [0, 0];
  const [tx, ty] = st.from ? squareXY(st.to) : [0, 0];

  for (const [id, rec] of pieceMeshes) {
    const sq = state.get(id);
    if (!sq) { rec.mesh.visible = false; rec.shadow.visible = false; continue; }
    let [x, y] = squareXY(sq);
    let scale = 1, opacity = 1, z = PIECE_Z;
    if (id === moverId && prog < 1) {
      x = fx + (tx - fx) * prog;
      y = fy + (ty - fy) * prog;
      const lift = Math.sin(prog * Math.PI);
      z = PIECE_Z + 0.05 * lift;
      scale = 1 + 0.05 * lift;
    }
    if (id === capturedId && prog < 1) {
      const p = Math.max(0, (prog - 0.55) / 0.45);
      scale = 1 - p;
      opacity = 1 - p;
      if (scale <= 0.02) { rec.mesh.visible = false; rec.shadow.visible = false; continue; }
    }
    rec.mesh.visible = true;
    rec.shadow.visible = true;
    rec.mesh.position.set(x, y, z);
    rec.mesh.scale.setScalar(scale);
    rec.mat.opacity = opacity;
    rec.shadow.position.set(x + 0.02, y - 0.045, 0.04);
    rec.shadow.scale.setScalar(scale * (1 + 0.5 * (z - PIECE_Z)));
    rec.smat.opacity = opacity * 0.85;
  }
}

function updateProgress() {
  progressFill.style.width = (TOTAL ? (t / TOTAL) * 100 : 0).toFixed(3) + '%';
}

let lastNow = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(100, now - lastNow);
  lastNow = now;
  if (playing) {
    t += dt;
    if (t >= TOTAL) { t = TOTAL; playing = false; updatePlayButton(); }
  }
  renderBoard(now);
  // explanatory graphics fade in just after the move lands
  const s = stepAt(t);
  const st = STEPS[s];
  const since = now - stepChangeTime;
  const revealP = st.from ? clamp01((since - (ANIM_MS - 120)) / 380) : clamp01(since / 260);
  ovExplain.mesh.material.opacity = revealP;
  if (st.check) {
    checkPlane.visible = revealP > 0.02;
    const w = Math.sin(now / 210);
    checkPlane.material.opacity = revealP * (0.62 + 0.33 * w);
    checkPlane.scale.setScalar(1 + 0.05 * w * revealP);
  } else {
    checkPlane.visible = false;
  }
  if (targetPlane.visible) {
    targetPlane.material.opacity = 0.5 + 0.3 * Math.sin(now / 260);
  }
  updateProgress();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// Resize + start
// ---------------------------------------------------------------------------
function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w > 0 && h > 0) renderer.setSize(w, h, false);
}
new ResizeObserver(resize).observe(wrap);
resize();

onStepChange(0);
playing = true; // the lesson starts on its own
updatePlayButton();
requestAnimationFrame(frame);

// Tiny debug/test hook (used by the local preview tooling).
window.__lesson = {
  seekToStep,
  play: () => { playing = true; updatePlayButton(); },
  pause: () => { playing = false; updatePlayButton(); },
  get t() { return t; },
  get step() { return stepAt(t); },
  get playing() { return playing; },
  TOTAL,
};
