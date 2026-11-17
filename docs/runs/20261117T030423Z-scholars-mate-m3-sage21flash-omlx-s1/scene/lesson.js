import * as THREE from 'three';
import { makePieceCanvas } from './pieces.js';

/* ============================================================
   Scholar's Mate — an animated chess lesson
   Board is drawn from BLACK's perspective (180° rotated):
   files h→a left→right, ranks 8→1 top→bottom.
   ============================================================ */

const FILES = 'abcdefgh';
const F = n => FILES[n];            // file index -> letter
const R = n => n + 1;               // rank index -> number
const sqName = (f, r) => F(f) + R(r);
const parseSq = s => [s.charCodeAt(0) - 97, Number(s[1]) - 1];

// world position of a square's center (board spans -4..4)
const px = f => 3.5 - f;   // file a (0) at right … h (7) at left
const py = r => 3.5 - r;   // rank 1 (0) at top  … 8 (7) at bottom

/* ---------------- chess logic (for verification) ---------------- */

const startBoard = () => {
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let f = 0; f < 8; f++) {
    b[1][f] = { t: 'p', c: 'w' };
    b[6][f] = { t: 'p', c: 'b' };
    b[0][f] = { t: back[f], c: 'w' };
    b[7][f] = { t: back[f], c: 'b' };
  }
  return b;
};
const inside = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
const KNIGHT_D = [[1,2],[2,1],[2,-1],[1,-2],[-1,-2],[-2,-1],[-2,1],[-1,2]];
const KING_D   = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
const BISHOP_D = [[1,1],[1,-1],[-1,1],[-1,-1]];
const ROOK_D   = [[1,0],[-1,0],[0,1],[0,-1]];
const QUEEN_D  = [...BISHOP_D, ...ROOK_D];

function attacksSquare(b, f, r, by) {
  const dir = by === 'w' ? 1 : -1;
  for (const df of [-1, 1]) {
    const pf = f - df, pr = r - dir;
    if (inside(pf, pr)) { const p = b[pr][pf]; if (p && p.c === by && p.t === 'p') return true; }
  }
  for (const [df, dr] of KNIGHT_D) {
    const nf = f + df, nr = r + dr;
    if (inside(nf, nr)) { const p = b[nr][nf]; if (p && p.c === by && p.t === 'n') return true; }
  }
  for (const [df, dr] of KING_D) {
    const kf = f + df, kr = r + dr;
    if (inside(kf, kr)) { const p = b[kr][kf]; if (p && p.c === by && p.t === 'k') return true; }
  }
  for (const t of ['b', 'r', 'q']) for (const [df, dr] of t === 'b' ? BISHOP_D : t === 'r' ? ROOK_D : QUEEN_D) {
    let cf = f + df, cr = r + dr;
    while (inside(cf, cr)) {
      const p = b[cr][cf];
      if (p) { if (p.c === by && (p.t === t || p.t === 'q')) return true; break; }
      cf += df; cr += dr;
    }
  }
  return false;
}
function kingPos(b, c) {
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = b[r][f]; if (p && p.c === c && p.t === 'k') return [f, r];
  }
}
const inCheck = (b, c) => attacksSquare(b, ...kingPos(b, c), c === 'w' ? 'b' : 'w');
function legalMoves(b, c) {
  const out = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = b[r][f]; if (!p || p.c !== c) continue;
    const push = (tf, tr) => {
      if (!inside(tf, tr)) return;
      const t = b[tr][tf]; if (t && t.c === c) return;
      const nb = b.map(row => row.slice());
      nb[tr][tf] = p; nb[r][f] = null;
      if (!inCheck(nb, c)) out.push([f, r, tf, tr]);
    };
    if (p.t === 'p') {
      const dir = c === 'w' ? 1 : -1, start = c === 'w' ? 1 : 6;
      if (inside(f, r + dir) && !b[r + dir][f]) {
        push(f, r + dir);
        if (r === start && !b[r + 2 * dir][f]) push(f, r + 2 * dir);
      }
      for (const df of [-1, 1]) {
        const tf = f + df, tr = r + dir;
        if (inside(tf, tr) && b[tr][tf] && b[tr][tf].c !== c) push(tf, tr);
      }
    } else if (p.t === 'n') { for (const [df, dr] of KNIGHT_D) push(f + df, r + dr); }
    else if (p.t === 'k') { for (const [df, dr] of KING_D) push(f + df, r + dr); }
    else {
      const dirs = p.t === 'b' ? BISHOP_D : p.t === 'r' ? ROOK_D : QUEEN_D;
      for (const [df, dr] of dirs) {
        let tf = f + df, tr = r + dr;
        while (inside(tf, tr) && !b[tr][tf]) { push(tf, tr); tf += df; tr += dr; }
        push(tf, tr);
      }
    }
  }
  return out;
}
const applyMove = (b, from, to) => {
  const nb = b.map(row => row.slice());
  nb[to[1]][to[0]] = nb[from[1]][from[0]];
  nb[from[1]][from[0]] = null;
  return nb;
};

/* ---------------- the supplied line (verified) ---------------- */

const MOVES = [
  { san: 'e4',    from: 'e2', to: 'e4', piece: 'p', color: 'w', capture: null },
  { san: 'e5',    from: 'e7', to: 'e5', piece: 'p', color: 'b', capture: null },
  { san: 'Bc4',   from: 'f1', to: 'c4', piece: 'b', color: 'w', capture: null },
  { san: 'Nc6',   from: 'b8', to: 'c6', piece: 'n', color: 'b', capture: null },
  { san: 'Qh5',   from: 'd1', to: 'h5', piece: 'q', color: 'w', capture: null },
  { san: 'Nf6',   from: 'g8', to: 'f6', piece: 'n', color: 'b', capture: null },
  { san: 'Qxf7#', from: 'h5', to: 'f7', piece: 'q', color: 'w', capture: 'f7' },
];

// precompute every position along the line
const BOARDS = [startBoard()];
for (const m of MOVES) {
  BOARDS.push(applyMove(BOARDS[BOARDS.length - 1], parseSq(m.from), parseSq(m.to)));
}

// self-verify: legality of the line + checkmate in the final position
(function verify() {
  let b = startBoard(), ok = true;
  MOVES.forEach((m, i) => {
    const c = i % 2 === 0 ? 'w' : 'b';
    const from = parseSq(m.from), to = parseSq(m.to);
    const legal = legalMoves(b, c).some(l => l[0] === from[0] && l[1] === from[1] && l[2] === to[0] && l[3] === to[1]);
    const captured = b[to[1]][to[0]];
    const capOk = m.capture ? (captured && captured.t === 'p' && captured.c === 'b') : !captured;
    if (!legal || !capOk || !b[from[1]][from[0]] || b[from[1]][from[0]].t !== m.piece || b[from[1]][from[0]].c !== m.color) ok = false;
    b = applyMove(b, from, to);
  });
  const mate = inCheck(b, 'b') && legalMoves(b, 'b').length === 0;
  const msg = `Lesson line 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# — ${ok ? 'all moves legal' : 'MOVE ERROR'}, final: ${mate ? 'Black is checkmated ✔' : 'NOT CHECKMATE ✘'}`;
  if (ok && mate) console.log('✔ ' + msg);
  else console.error('✘ ' + msg);
})();

/* ---------------- lesson script ---------------- */

const ATTACK = '#f59e42';   // threat arrows
const DEFEND = '#5aa2f0';   // defensive / informational arrows
const AMBER = '#f2c14e';
const RED = '#ff5f52';

const steps = [
  {
    ply: 0, chip: 'The trap', dur: 5.2,
    cap: `Scholar's Mate — the classic four-move trap. The target is <b>f7</b>: the weakest square in the opening.`,
    hl: [{ sq: 'f7', pulse: AMBER }],
  },
  {
    ply: 1, chip: '1. e4', move: 0, dur: 4.4,
    cap: `<b>1. e4</b> — White takes the center and opens lines for the queen and bishop.`,
  },
  {
    ply: 2, chip: '1... e5', move: 1, dur: 3.8,
    cap: `<b>1... e5</b> — Black mirrors in the center. Everything looks normal so far.`,
  },
  {
    ply: 3, chip: '2. Bc4', move: 2, dur: 4.6,
    cap: `<b>2. Bc4</b> — the bishop is aimed straight at f7 through d5 and e6.`,
    arrows: [{ from: 'c4', to: 'f7', color: ATTACK }],
    hl: [{ sq: 'f7', pulse: AMBER }],
  },
  {
    ply: 4, chip: '2... Nc6', move: 3, dur: 3.8,
    cap: `<b>2... Nc6</b> — Black develops a knight. White's plan is already on the board.`,
    hl: [{ sq: 'f7', pulse: AMBER, faint: true }],
  },
  {
    ply: 5, chip: '3. Qh5', move: 4, dur: 5.4,
    cap: `<b>3. Qh5</b> — the queen joins the attack. f7 is hit twice and defended only by the king.`,
    arrows: [
      { from: 'h5', to: 'f7', color: ATTACK },
      { from: 'c4', to: 'f7', color: ATTACK },
      { from: 'e8', to: 'f7', color: DEFEND, width: 0.75, opacity: 0.75 },
    ],
    hl: [{ sq: 'f7', pulse: RED }],
  },
  {
    ply: 6, chip: '3... Nf6', move: 5, dur: 5.4,
    cap: `<b>3... Nf6</b> attacks the queen — but abandons f7. The knight cannot stop the mate.`,
    arrows: [{ from: 'f6', to: 'h5', color: DEFEND }],
    hl: [{ sq: 'f7', pulse: RED }],
  },
  {
    ply: 7, chip: '4. Qxf7#', move: 6, dur: 4.8, check: 'e8',
    cap: `<b>4. Qxf7#</b> — the pawn falls with check. No black piece can capture the queen.`,
  },
  {
    ply: 7, chip: 'Checkmate', dur: 7.5, check: 'e8',
    cap: `Why the king is stuck: the queen is protected by the bishop, <b>e7</b> is covered, and d7, d8 and f8 are blocked by Black's own pieces.`,
    arrows: [{ from: 'c4', to: 'f7', color: DEFEND }],
    hl: [
      { sq: 'e7', color: AMBER, opacity: 0.42 },
      { sq: 'd7', ring: '#ffffff', opacity: 0.5 },
      { sq: 'd8', ring: '#ffffff', opacity: 0.5 },
      { sq: 'f8', ring: '#ffffff', opacity: 0.5 },
    ],
  },
  {
    ply: 7, chip: 'Takeaway', dur: 9, check: 'e8',
    cap: `A trap, not a forced win. <b>Notice the threat</b>, defend f7 and develop safely — check your opponent's ideas before chasing the queen.`,
    hl: [{ sq: 'f7', pulse: AMBER }],
  },
];
const MOVE_DUR = 0.8;
const totalDur = steps.reduce((s, st) => s + st.dur, 0);
const cum = [0];
steps.forEach((st, i) => cum.push(cum[i] + st.dur));

/* ---------------- three.js setup ---------------- */

const wrap = document.getElementById('board-wrap');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
wrap.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-4.55, 4.55, 4.55, -4.55, -10, 10);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

const Z_HL = 0.05, Z_PIECE = 0.25, Z_ARROW = 0.6;
const groupHL = new THREE.Group();
const groupPieces = new THREE.Group();
const groupArrows = new THREE.Group();
scene.add(groupHL, groupPieces, groupArrows);

/* ---------------- board texture (drawn once) ---------------- */

function makeBoardTexture() {
  const SIZE = 2048;
  const u = SIZE / 8.6;             // px per world unit
  const m = 0.3 * u;                // frame margin
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const g = cv.getContext('2d');

  // frame
  g.fillStyle = '#37332c';
  g.beginPath();
  if (g.roundRect) g.roundRect(0, 0, SIZE, SIZE, 0.14 * u); else g.rect(0, 0, SIZE, SIZE);
  g.fill();
  g.strokeStyle = '#191713';
  g.lineWidth = 0.045 * u;
  g.stroke();

  // squares  (file f at column (7-f), rank r at row r → rotated view)
  const LIGHT = '#eeeed2', DARK = '#769656';
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const x = m + (7 - f) * u, y = m + r * u;
      g.fillStyle = (f + r) % 2 === 0 ? DARK : LIGHT;
      g.fillRect(x, y, u + 0.5, u + 0.5);
    }
  }
  // faint inner edge line around the playing area
  g.strokeStyle = 'rgba(25,23,19,0.55)';
  g.lineWidth = 0.03 * u;
  g.strokeRect(m, m, 8 * u, 8 * u);

  // coordinate labels (upright, chess.com style: files bottom edge, ranks left edge)
  const fs = 0.23 * u;
  g.font = `700 ${fs}px ui-sans-serif, system-ui, sans-serif`;
  g.textBaseline = 'alphabetic';
  for (let f = 0; f < 8; f++) {           // bottom row = rank 8
    const x = m + (7 - f) * u, y = m + 7 * u;
    g.fillStyle = (f + 7) % 2 === 0 ? LIGHT : DARK;
    g.textAlign = 'right';
    g.fillText(F(f), x + u - 0.07 * u, y + u - 0.07 * u);
  }
  g.textAlign = 'left';
  for (let r = 0; r < 8; r++) {           // left column = file h
    const x = m + 0 * u, y = m + r * u;
    g.fillStyle = (7 + r) % 2 === 0 ? LIGHT : DARK;
    g.fillText(R(r), x + 0.07 * u, y + 0.27 * u);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}
const boardMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(8.6, 8.6),
  new THREE.MeshBasicMaterial({ map: makeBoardTexture(), transparent: true, depthTest: false, depthWrite: false })
);
boardMesh.renderOrder = 0;
scene.add(boardMesh);

/* ---------------- piece meshes ---------------- */

const pieceMatCache = new Map();
function pieceMaterial(type, color) {
  const key = type + color;
  if (!pieceMatCache.has(key)) {
    pieceMatCache.set(key, new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(makePieceCanvas(type, color)),
      transparent: true, depthTest: false, depthWrite: false,
    }));
    pieceMatCache.get(key).map.colorSpace = THREE.SRGBColorSpace;
  }
  return pieceMatCache.get(key);
}
const pieceGeo = new THREE.PlaneGeometry(0.98, 0.98);

function spawnPiece(type, color) {
  const m = new THREE.Mesh(pieceGeo, pieceMaterial(type, color));
  m.renderOrder = 2;
  m.userData = { t: type, c: color };
  return m;
}

/* ---------------- highlight / glow / arrow builders ---------------- */

const hlGeo = new THREE.PlaneGeometry(1, 1);
function squareMesh(color, opacity, z, order) {
  const m = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthTest: false, depthWrite: false,
  }));
  m.position.z = z; m.renderOrder = order;
  return m;
}

function radialTexture(inner, outer) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ringTex = (() => {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.42, 'rgba(255,255,255,0)');
  grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.68, 'rgba(255,255,255,0.35)');
  grad.addColorStop(0.78, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

function addRingSquare(sq, color) {
  const [f, r] = parseSq(sq);
  const m = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
    map: ringTex.clone(), color, transparent: true, opacity: 0.9,
    depthTest: false, depthWrite: false,
  }));
  m.material.map.needsUpdate = true;
  m.position.set(px(f), py(r), Z_HL + 0.01);
  m.renderOrder = 1;
  groupHL.add(m);
  return m;
}

function addCheckGlow(sq) {
  const [f, r] = parseSq(sq);
  const m = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
    map: radialTexture('rgba(255,60,45,0.75)', 'rgba(255,60,45,0)'),
    transparent: true, opacity: 0.85, depthTest: false, depthWrite: false,
  }));
  m.position.set(px(f), py(r), Z_HL + 0.02);
  m.scale.setScalar(1.15);
  m.renderOrder = 1;
  groupHL.add(m);
  return m;
}

function makeArrow(from, to, color, opacity = 0.88, width = 1) {
  const a = parseSq(from), b = parseSq(to);
  const x0 = px(a[0]), y0 = py(a[1]), x1 = px(b[0]), y1 = py(b[1]);
  const dx = x1 - x0, dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  const hl = 0.34 * width, hw = 0.42 * width, sw = 0.17 * width;
  const grp = new THREE.Group();
  grp.position.set(x0, y0, Z_ARROW);
  grp.rotation.z = ang;
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false });
  const shaftLen = Math.max(L - hl * 0.55, 0.05);
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(shaftLen, sw), mat);
  shaft.position.x = shaftLen / 2;
  shaft.renderOrder = 4;
  const shape = new THREE.Shape();
  shape.moveTo(L - hl, -hw / 2);
  shape.lineTo(L - hl, hw / 2);
  shape.lineTo(L, 0);
  shape.closePath();
  const head = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat);
  head.renderOrder = 4;
  grp.add(shaft, head);
  return grp;
}

/* ---------------- board state ---------------- */

let meshMap = new Map();          // "f,r" -> mesh
function clearPieces() {
  for (const m of meshMap.values()) groupPieces.remove(m);
  meshMap = new Map();
}
function setBoard(ply) {
  clearPieces();
  const b = BOARDS[ply];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = b[r][f]; if (!p) continue;
    const m = spawnPiece(p.t, p.c);
    m.position.set(px(f), py(r), Z_PIECE);
    groupPieces.add(m);
    meshMap.set(f + ',' + r, m);
  }
}

/* ---------------- tweens ---------------- */

const tweens = [];
const easeInOut = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
function tween(dur, onUpdate, onDone) {
  tweens.push({ t: 0, dur, onUpdate, onDone });
}
function killTweens() { tweens.length = 0; }
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(tw.t / tw.dur, 1);
    tw.onUpdate(k);
    if (k >= 1) { tweens.splice(i, 1); tw.onDone && tw.onDone(); }
  }
}

/* ---------------- step visuals ---------------- */

let pulseMeshes = [];   // {mesh, base, speed}
let glowMeshes = [];
let pendingVisuals = null;  // applied when the current move animation lands

function clearStepVisuals() {
  while (groupHL.children.length) {
    const c = groupHL.children[0];
    groupHL.remove(c);
    if (c.material && c.material.map && c.material.map !== ringTex) c.material.map.dispose();
    if (c.material) c.material.dispose();
  }
  while (groupArrows.children.length) {
    const c = groupArrows.children[0];
    groupArrows.remove(c);
    c.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
  pulseMeshes = []; glowMeshes = [];
}

function applyStepVisuals(step, defer = false) {
  clearStepVisuals();
  pendingVisuals = null;
  // last-move highlight (from/to of the move that led to this ply)
  if (step.ply > 0) {
    const lm = MOVES[step.ply - 1];
    for (const s of [lm.from, lm.to]) {
      const [f, r] = parseSq(s);
      const m = squareMesh('#f7dc5e', 0.5, Z_HL, 1);
      m.position.set(px(f), py(r), Z_HL);
      groupHL.add(m);
    }
  }
  const rest = () => {
    for (const h of step.hl || []) {
      const [f, r] = parseSq(h.sq);
      if (h.pulse) {
        const m = addRingSquare(h.sq, h.pulse);
        pulseMeshes.push({ mesh: m, base: h.faint ? 0.45 : 0.9, speed: 3.2 });
      } else if (h.ring) {
        const m = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
          map: ringTex.clone(), color: h.ring, transparent: true, opacity: h.opacity ?? 0.5,
          depthTest: false, depthWrite: false,
        }));
        m.material.map.needsUpdate = true;
        m.position.set(px(f), py(r), Z_HL + 0.01);
        m.scale.setScalar(0.82);
        m.renderOrder = 1;
        groupHL.add(m);
      } else {
        const m = squareMesh(h.color, h.opacity ?? 0.4, Z_HL, 1);
        m.position.set(px(f), py(r), Z_HL);
        groupHL.add(m);
      }
    }
    for (const a of step.arrows || []) {
      groupArrows.add(makeArrow(a.from, a.to, a.color, a.opacity, a.width));
    }
    if (step.check) {
      const m = addCheckGlow(step.check);
      glowMeshes.push({ mesh: m, base: 0.85, speed: 2.2 });
    }
  };
  // while a move is animating, reveal arrows/highlights only once it lands
  if (defer && step.move != null) pendingVisuals = rest;
  else rest();
}

/* ---------------- move animation ---------------- */

function animateMove(mi, onDone) {
  const m = MOVES[mi];
  const [ff, fr] = parseSq(m.from), [tf, tr] = parseSq(m.to);
  const mesh = meshMap.get(ff + ',' + fr);
  const capKey = tf + ',' + tr;
  const capMesh = meshMap.get(capKey);
  if (!mesh) { pendingVisuals = null; onDone && onDone(); return; }
  meshMap.delete(ff + ',' + fr);
  meshMap.delete(capKey);
  meshMap.set(capKey, mesh);

  const p0 = mesh.position.clone();
  const p1 = new THREE.Vector3(px(tf), py(tr), Z_PIECE);
  const hop = m.piece === 'n';
  tween(MOVE_DUR, k => {
    const e = easeInOut(k);
    mesh.position.lerpVectors(p0, p1, e);
    mesh.position.z = Z_PIECE + (hop ? 0.4 : 0.18) * Math.sin(k * Math.PI);
    mesh.scale.setScalar(1 + 0.13 * Math.sin(k * Math.PI));
  }, () => {
    mesh.scale.setScalar(1);
    mesh.position.z = Z_PIECE;
    if (capMesh) {
      capMesh.material = capMesh.material.clone();   // fade must not touch the shared material
      tween(0.28, k => {
        capMesh.scale.setScalar(1 - 0.6 * k);
        capMesh.material.opacity = 1 - k;
      }, () => {
        groupPieces.remove(capMesh);
        capMesh.material.dispose();
      });
    }
    if (pendingVisuals) { const fn = pendingVisuals; pendingVisuals = null; fn(); }
    onDone && onDone();
  });
}

/* ---------------- playback engine ---------------- */

const state = {
  step: 0,
  playing: false,
  elapsed: 0,        // time within current step
  moveStarted: false,
  ended: false,
};

function seek(i, opts = {}) {
  i = Math.max(0, Math.min(steps.length - 1, i));
  killTweens();
  state.step = i;
  state.ended = false;
  // seeking snaps to the position AFTER this step's move, so don't re-animate it
  state.moveStarted = steps[i].move != null;
  state.elapsed = opts.elapsed != null ? opts.elapsed : 0;
  if (opts.keepPlaying !== true) state.playing = false;
  setBoard(steps[i].ply);
  applyStepVisuals(steps[i]);
  updateHUD(true);
}

function play() {
  if (state.ended || (state.step === steps.length - 1 && !state.playing && state.elapsed >= steps[steps.length - 1].dur)) {
    seek(0);
  }
  state.playing = true;
  updateHUD();
}
function pause() { state.playing = false; updateHUD(); }
function togglePlay() { state.playing ? pause() : play(); }

function advance(dt) {
  if (!state.playing) return;
  const step = steps[state.step];
  state.elapsed += dt;
  if (step.move != null && !state.moveStarted) {
    state.moveStarted = true;
    animateMove(step.move);
  }
  if (state.elapsed >= step.dur) {
    if (state.step < steps.length - 1) {
      // step forward WITHOUT snapping the board: the next step's move
      // animates from the current position
      killTweens();
      state.step += 1;
      state.elapsed = 0;
      state.moveStarted = false;
      applyStepVisuals(steps[state.step], true);
      updateHUD(true);
    } else {
      state.playing = false;
      state.ended = true;
      state.elapsed = step.dur;
      updateHUD();
    }
  }
}

/* ---------------- HUD ---------------- */

const chipEl = document.getElementById('chip');
const capText = document.getElementById('cap-text');
const capBox = document.getElementById('caption');
const statusEl = document.getElementById('status');
const statusText = document.getElementById('status-text');
const movesEl = document.getElementById('moves');
const resultEl = document.getElementById('result');
const playBtn = document.getElementById('play');
const icPlay = document.getElementById('ic-play');
const icPause = document.getElementById('ic-pause');
const prevBtn = document.getElementById('prev');
const nextBtn = document.getElementById('next');
const replayBtn = document.getElementById('replay');
const progressEl = document.getElementById('progress');
const progressFill = document.getElementById('progress-fill');
const stepCounter = document.getElementById('step-counter');

// build move list: 4 rows x (number, white, black)
const PAIRS = [];
for (let i = 0; i < MOVES.length; i += 2) {
  PAIRS.push({ n: i / 2 + 1, w: MOVES[i], b: MOVES[i + 1] || null });
}
const cellSteps = [];   // half-move index -> element
for (const p of PAIRS) {
  const row = document.createElement('div');
  row.className = 'mrow';
  const num = document.createElement('div');
  num.className = 'num';
  num.textContent = p.n + '.';
  row.appendChild(num);
  for (const half of [p.w, p.b]) {
    const cell = document.createElement('div');
    if (half) {
      cell.className = 'mcell';
      cell.textContent = half.san;
      cell.title = `${p.n}${half.color === 'w' ? '.' : '...'} ${half.san}`;
      const mi = MOVES.indexOf(half);
      cellSteps[mi] = cell;
      cell.addEventListener('click', () => { seek(mi + 1); });
    } else {
      cell.className = 'mcell empty';
      cell.textContent = '';
    }
    row.appendChild(cell);
  }
  movesEl.appendChild(row);
}

function updateHUD(captionChange) {
  const step = steps[state.step];
  // caption (JS-driven fade — CSS animation clocks can crawl under software rendering)
  if (captionChange) {
    chipEl.textContent = step.chip;
    capText.innerHTML = step.cap;
    capBox.style.opacity = '0';
    capBox.style.transform = 'translateY(4px)';
    tween(0.28, k => {
      capBox.style.opacity = k.toFixed(3);
      capBox.style.transform = `translateY(${(3 * (1 - k)).toFixed(2)}px)`;
    });
  }
  // status
  if (step.ply === MOVES.length) {
    statusEl.className = 'mate';
    statusText.textContent = 'Checkmate — White wins';
    resultEl.classList.add('show');
  } else {
    const whiteToMove = step.ply % 2 === 0;
    statusEl.className = whiteToMove ? '' : 'black';
    statusText.textContent = whiteToMove ? 'White to move' : 'Black to move';
    resultEl.classList.remove('show');
  }
  // move list highlight
  const cur = step.ply - 1;   // last played half-move
  cellSteps.forEach((cell, i) => {
    cell.classList.toggle('current', i === cur);
    cell.classList.toggle('future', i > cur);
  });
  // play icon
  icPlay.style.display = state.playing ? 'none' : '';
  icPause.style.display = state.playing ? '' : 'none';
  // progress
  const t = cum[state.step] + Math.min(state.elapsed, steps[state.step].dur);
  progressFill.style.width = (100 * t / totalDur).toFixed(2) + '%';
  progressFill.classList.toggle('at-start', t <= 0.01);
  stepCounter.textContent = `${state.step + 1} / ${steps.length}`;
}

playBtn.addEventListener('click', togglePlay);
prevBtn.addEventListener('click', () => { pause(); seek(state.step - 1); });
nextBtn.addEventListener('click', () => { pause(); seek(state.step + 1); });
replayBtn.addEventListener('click', () => { seek(0); play(); });

// keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.code === 'ArrowLeft') { pause(); seek(state.step - 1); }
  else if (e.code === 'ArrowRight') { pause(); seek(state.step + 1); }
  else if (e.code === 'KeyR') { seek(0); play(); }
});

// progress bar seeking (click + drag)
let dragging = false;
function seekFraction(e) {
  const rect = progressEl.getBoundingClientRect();
  const f = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  const t = f * totalDur;
  let i = 0;
  while (i < steps.length - 1 && cum[i + 1] <= t) i++;
  seek(i, { keepPlaying: state.playing, elapsed: t - cum[i] });
}
progressEl.addEventListener('pointerdown', e => {
  dragging = true;
  progressEl.setPointerCapture(e.pointerId);
  seekFraction(e);
});
progressEl.addEventListener('pointermove', e => { if (dragging) seekFraction(e); });
progressEl.addEventListener('pointerup', () => { dragging = false; });
progressEl.addEventListener('pointercancel', () => { dragging = false; });

/* ---------------- hover highlight ---------------- */

const hoverMesh = squareMesh('#ffffff', 0.0, Z_HL + 0.005, 1);
hoverMesh.visible = false;
scene.add(hoverMesh);   // not in groupHL: step visuals clear that group
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const hitPt = new THREE.Vector3();

renderer.domElement.addEventListener('pointermove', e => {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(plane, hitPt)) {
    const f = Math.round(3.5 - hitPt.x), r = Math.round(3.5 - hitPt.y);
    if (inside(f, r)) {
      hoverMesh.position.set(px(f), py(r), Z_HL + 0.005);
      hoverMesh.material.opacity = 0.14;
      hoverMesh.visible = true;
      return;
    }
  }
  hoverMesh.visible = false;
});
renderer.domElement.addEventListener('pointerleave', () => { hoverMesh.visible = false; });

/* ---------------- resize ---------------- */

function resize() {
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.left = -4.55; camera.right = 4.55; camera.top = 4.55; camera.bottom = -4.55;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(wrap);
window.addEventListener('resize', resize);
resize();

/* ---------------- main loop ---------------- */

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  advance(dt);
  updateTweens(dt);
  const t = clock.elapsedTime;
  for (const p of pulseMeshes) {
    p.mesh.material.opacity = p.base * (0.62 + 0.38 * Math.sin(t * p.speed));
  }
  for (const g of glowMeshes) {
    g.mesh.material.opacity = g.base * (0.75 + 0.25 * Math.sin(t * g.speed));
  }
  // keep HUD progress fresh while playing
  if (state.playing) updateHUD(false);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */

setBoard(0);
applyStepVisuals(steps[0]);
updateHUD(true);
frame();
if (!new URLSearchParams(location.search).has('noautoplay')) {
  setTimeout(() => play(), 700);   // autoplay after first paint
}

// debug/testing hook (also lets tests seek deterministically)
window.__lesson = { seek, state, steps, totalDur };
window.__pieces = () => [...meshMap.entries()].map(([k, m]) => ({
  sq: k, t: m.userData.t, c: m.userData.c,
  x: +m.position.x.toFixed(3), y: +m.position.y.toFixed(3),
  op: +m.material.opacity.toFixed(3),
}));
window.__dbg = () => ({
  t: Math.round(performance.now()),
  n: tweens.length,
  op: capBox.style.opacity,
  step: state.step,
  playing: state.playing,
  elapsed: +state.elapsed.toFixed(2),
});
window.__arrowCount = () => { let n = 0; groupArrows.traverse(o => { if (o.isMesh) n++; }); return n; };
window.__visState = () => ({
  hl: groupHL.children.length,
  arrows: window.__arrowCount(),
  glows: glowMeshes.length,
  pulses: pulseMeshes.length,
  pending: !!pendingVisuals,
  step: state.step,
  elapsed: +state.elapsed.toFixed(2),
  playing: state.playing,
});