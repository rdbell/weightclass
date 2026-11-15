import * as THREE from 'three';

/* ================================================================
   1. CHESS MODEL — the supplied, verified line
   1. e4 e5  2. Bc4 Nc6  3. Qh5 Nf6  4. Qxf7#
   ================================================================ */

const FILES = 'abcdefgh';
const sqName = (f, r) => FILES[f] + r;          // f: 0..7 (a..h), r: 1..8
const sqIdx  = (name) => [FILES.indexOf(name[0]), +name[1]];

function initialBoard() {
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const bd = {};
  for (let f = 0; f < 8; f++) {
    bd[sqName(f, 1)] = { type: back[f], color: 'w', id: `w${back[f]}${f}` };
    bd[sqName(f, 2)] = { type: 'p',     color: 'w', id: `wp${f}` };
    bd[sqName(f, 7)] = { type: 'p',     color: 'b', id: `bp${f}` };
    bd[sqName(f, 8)] = { type: back[f], color: 'b', id: `b${back[f]}${f}` };
  }
  return bd;
}

// Supplied move order — used exactly as given, no alternatives.
const MOVES = [
  { san: 'e4',    num: 1, color: 'w', from: 'e2', to: 'e4' },
  { san: 'e5',    num: 1, color: 'b', from: 'e7', to: 'e5' },
  { san: 'Bc4',   num: 2, color: 'w', from: 'f1', to: 'c4' },
  { san: 'Nc6',   num: 2, color: 'b', from: 'b8', to: 'c6' },
  { san: 'Qh5',   num: 3, color: 'w', from: 'd1', to: 'h5' },
  { san: 'Nf6',   num: 3, color: 'b', from: 'g8', to: 'f6' },
  { san: 'Qxf7#', num: 4, color: 'w', from: 'h5', to: 'f7', capture: true },
];

function applyMove(bd, m) {
  const nb = { ...bd };
  nb[m.to] = nb[m.from];
  delete nb[m.from];
  return nb;
}

// states[i] = position after i half-moves. Rebuilt by replay, so seeking
// backwards always restores the exact board, including captured pieces.
const states = [initialBoard()];
MOVES.forEach((m, i) => states.push(applyMove(states[i], m)));

/* ---------------- rules helpers (for verification) ---------------- */

const KING_D = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

function pieceAt(bd, f, r) {
  if (f < 0 || f > 7 || r < 1 || r > 8) return null;
  return bd[sqName(f, r)] || null;
}

// Does the piece standing at (f,r) pseudo-legally attack (tf,tr)?
function attacksFrom(bd, f, r, p, tf, tr) {
  const df = tf - f, dr = tr - r;
  switch (p.type) {
    case 'p': {
      const dir = p.color === 'w' ? 1 : -1;
      return dr === dir && Math.abs(df) === 1;
    }
    case 'n': return (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
    case 'k': return Math.max(Math.abs(df), Math.abs(dr)) === 1 && (df !== 0 || dr !== 0);
    case 'r': if (df !== 0 && dr !== 0) return false; break;
    case 'b': if (Math.abs(df) !== Math.abs(dr)) return false; break;
    case 'q': if (!(df === 0 || dr === 0 || Math.abs(df) === Math.abs(dr))) return false; break;
  }
  const sf = Math.sign(df), sr = Math.sign(dr);
  let cf = f + sf, cr = r + sr;
  while (cf !== tf || cr !== tr) {
    if (pieceAt(bd, cf, cr)) return false;
    cf += sf; cr += sr;
  }
  return true;
}

function isAttacked(bd, f, r, by) {
  for (const key in bd) {
    const p = bd[key];
    if (p.color !== by) continue;
    const [pf, pr] = sqIdx(key);
    if (attacksFrom(bd, pf, pr, p, f, r)) return true;
  }
  return false;
}

function findKing(bd, color) {
  for (const key in bd) {
    const p = bd[key];
    if (p.color === color && p.type === 'k') return sqIdx(key);
  }
  return null;
}

// Would `kingColor` be in check if its king stood on (f,r)?
// (used for "can the king capture the checker" — the king is lifted first)
function squareSafeForKing(bd, f, r, kingColor, kingSq, removedToo) {
  const test = { ...bd };
  delete test[sqName(kingSq[0], kingSq[1])];
  if (removedToo) delete test[removedToo];
  return !isAttacked(test, f, r, kingColor === 'w' ? 'b' : 'w');
}

// Full (if compact) checkmate verification for the final position.
function verifyFinalPosition() {
  const bd = states[states.length - 1];
  const out = [];

  // --- material after 4.Qxf7# (one black pawn captured) ---
  const counts = { w: {}, b: {} };
  for (const key in bd) {
    const p = bd[key];
    counts[p.color][p.type] = (counts[p.color][p.type] || 0) + 1;
  }
  const expect = { w: { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 }, b: { k: 1, q: 1, r: 2, b: 2, n: 2, p: 7 } };
  let materialOK = true;
  for (const c of ['w', 'b']) for (const t in expect[c]) {
    if (counts[c][t] !== expect[c][t]) materialOK = false;
  }
  out.push(`material after the capture: ${materialOK ? 'OK (black f7 pawn captured)' : 'MISMATCH'}`);

  // --- key squares of the supplied line ---
  const expectSquares = {
    e4: 'w p', e5: 'b p', c4: 'w b', c6: 'b n', f6: 'b n',
    f7: 'w q', e8: 'b k', e1: 'w k', h5: null, d1: null, f1: null, g8: null, e2: null, e7: null,
  };
  let squaresOK = true;
  for (const [s, want] of Object.entries(expectSquares)) {
    const p = bd[s];
    const got = p ? `${p.color} ${p.type}` : null;
    if (got !== want) { squaresOK = false; out.push(`  square mismatch at ${s}: want ${want}, got ${got}`); }
  }
  out.push(`supplied-line piece placement: ${squaresOK ? 'OK' : 'MISMATCH'}`);

  // --- is Black in check? ---
  const [kf, kr] = findKing(bd, 'b');
  const kingSq = [kf, kr];
  const inCheck = isAttacked(bd, kf, kr, 'w');
  out.push(`black king on e8 in check: ${inCheck ? 'YES (queen on f7)' : 'NO'}`);

  // --- king flight squares ---
  const escapes = [];
  for (const [df, dr] of KING_D) {
    const tf = kf + df, tr = kr + dr;
    if (tf < 0 || tf > 7 || tr < 1 || tr > 8) continue;
    const occ = bd[sqName(tf, tr)];
    if (occ && occ.color === 'b') continue;                     // blocked by own piece
    if (!squareSafeForKing(bd, tf, tr, 'b', kingSq, occ ? sqName(tf, tr) : null)) continue;
    escapes.push(sqName(tf, tr));
  }
  out.push(`safe king flights: ${escapes.length ? escapes.join(' ') : 'none (e7 covered by the queen; d7/d8/f8 occupied; f7 defended)'}`);

  // --- can Black capture the checker? ---
  const checkers = [];
  for (const key in bd) {
    const p = bd[key];
    if (p.color !== 'w') continue;
    const [pf, pr] = sqIdx(key);
    if (attacksFrom(bd, pf, pr, p, kf, kr)) checkers.push(key);
  }
  let canCapture = false;
  if (checkers.length === 1) {
    const [cf, cr] = sqIdx(checkers[0]);
    for (const key in bd) {
      const p = bd[key];
      if (p.color !== 'b') continue;
      const [pf, pr] = sqIdx(key);
      if (!attacksFrom(bd, pf, pr, p, cf, cr)) continue;
      if (p.type === 'k') {
        if (squareSafeForKing(bd, cf, cr, 'b', kingSq, checkers[0])) { canCapture = true; break; }
      } else {
        // (no black piece is pinned here, so a pseudo-legal capture resolves)
        canCapture = true; break;
      }
    }
  }
  out.push(`capture of the checker possible: ${canCapture ? 'YES' : 'no — the c4 bishop protects the queen'}`);

  // --- can Black interpose? (only sliders at distance > 1) ---
  let canBlock = false;
  for (const cs of checkers) {
    const p = bd[cs];
    if (!(p.type === 'r' || p.type === 'b' || p.type === 'q')) continue;
    const [cf, cr] = sqIdx(cs);
    const df = cf - kf, dr = cr - kr;
    if (Math.max(Math.abs(df), Math.abs(dr)) < 2) continue;     // adjacent check — nothing to interpose
    const sf = Math.sign(df), sr = Math.sign(dr);
    let f = kf + sf, r = kr + sr;
    while (f !== cf || r !== cr) {
      for (const key in bd) {
        const q = bd[key];
        if (q.color !== 'b' || q.type === 'k') continue;
        const [pf, pr] = sqIdx(key);
        if (attacksFrom(bd, pf, pr, q, f, r)) { canBlock = true; }
      }
      f += sf; r += sr;
    }
  }
  out.push(`interposition possible: ${canBlock ? 'YES' : 'no — the queen checks from an adjacent square'}`);

  const checkmated = inCheck && escapes.length === 0 && !canCapture && !canBlock;
  out.push(`RESULT: Black is ${checkmated ? 'CHECKMATED — 4.Qxf7# ends the game' : 'NOT checkmated (problem!)'}`);

  const header = 'Verify final position of 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7#';
  if (checkmated && materialOK && squaresOK) console.log(`✔ ${header}\n  ${out.join('\n  ')}`);
  else console.error(`✖ ${header}\n  ${out.join('\n  ')}`);
  window.__lessonVerified = checkmated && materialOK && squaresOK;
  return checkmated;
}
verifyFinalPosition();

/* ================================================================
   2. LESSON SCRIPT — notes + the seven half-moves
   ================================================================ */

const STEPS = [
  {
    kind: 'note', tag: 'THE TRAP', dur: 5200,
    caption: 'This is <b>Scholar’s Mate</b> — the famous four-move checkmate. Everything turns on the weakest square in the opening: <b>f7</b>.',
    hl: [['f7', 'focus']],
  },
  {
    kind: 'move', mi: 0, dur: 3000,
    caption: '<b>1. e4</b> — White takes the centre and opens a diagonal toward Black’s king.',
  },
  {
    kind: 'move', mi: 1, dur: 3600,
    caption: '<b>1… e5</b> — Black mirrors. But from now on f7 is defended by the king alone.',
    hl: [['f7', 'focus']],
  },
  {
    kind: 'move', mi: 2, dur: 3600,
    caption: '<b>2. Bc4</b> — The bishop takes aim at f7, which the king now guards by itself.',
    hl: [['f7', 'focus']],
    arrows: [['c4', 'f7', 'attack']],
  },
  {
    kind: 'move', mi: 3, dur: 3200,
    caption: '<b>2… Nc6</b> — A natural developing move — but it ignores the bishop’s threat.',
    hl: [['f7', 'focus']],
    arrows: [['c4', 'f7', 'attack']],
  },
  {
    kind: 'move', mi: 4, dur: 4200,
    caption: '<b>3. Qh5</b> — The queen joins in: bishop and queen both attack f7. Mate is threatened.',
    hl: [['f7', 'threat']],
    arrows: [['h5', 'f7', 'attack'], ['c4', 'f7', 'attack']],
  },
  {
    kind: 'note', tag: 'THE THREAT', dur: 3800,
    caption: 'White threatens <b>4.Qxf7#</b> — queen takes f7, supported by the bishop. Black must react now.',
    hl: [['f7', 'threat']],
    arrows: [['h5', 'f7', 'attack'], ['c4', 'f7', 'attack']],
  },
  {
    kind: 'move', mi: 5, dur: 3600,
    caption: '<b>3… Nf6??</b> — Black attacks the queen, but the knight defends nothing on f7.',
    hl: [['f7', 'focus']],
    arrows: [['c4', 'f7', 'attack'], ['h5', 'f7', 'attack']],
  },
  {
    kind: 'note', tag: 'WHY IT FAILS', dur: 4000,
    caption: 'Chasing the queen changes nothing: f7 is still undefended — and the queen simply captures anyway.',
    hl: [['f7', 'threat'], ['f6', 'block']],
    arrows: [['c4', 'f7', 'attack'], ['h5', 'f7', 'attack']],
  },
  {
    kind: 'move', mi: 6, dur: 4600,
    caption: '<b>4. Qxf7#</b> — Checkmate! The queen captures on f7, protected by the bishop on c4.',
    hl: [['f7', 'mate'], ['c4', 'focus']],
    arrows: [['c4', 'f7', 'guard']],
  },
  {
    kind: 'note', tag: 'WHY IT’S MATE', dur: 4000,
    caption: 'The king can’t take the queen — the bishop on <b>c4</b> protects it from the side.',
    hl: [['f7', 'threat'], ['c4', 'focus']],
    arrows: [['c4', 'f7', 'guard']],
  },
  {
    kind: 'note', tag: 'NO ESCAPE', dur: 4600,
    caption: 'No escape either: d7, d8 and f8 are blocked by Black’s own pieces, and the queen controls e7.',
    hl: [['e8', 'threat'], ['d7', 'block'], ['d8', 'block'], ['f8', 'block'], ['e7', 'threat']],
  },
  {
    kind: 'note', tag: 'CHECKMATE', dur: 3400,
    caption: '<b>Checkmate</b> — Black is mated on move four. The game is over.',
    hl: [['f7', 'mate'], ['e8', 'threat']],
  },
  {
    kind: 'note', tag: 'HOW TO STOP IT', dur: 4800,
    caption: 'This is a trap, not a forced win. Spot the threat early and defend f7 — a timely <b>…g6</b> or <b>…Qe7</b> ends the attack.',
    hl: [['f7', 'focus']],
  },
  {
    kind: 'note', tag: 'TAKEAWAY', dur: 6000,
    caption: '<b>Develop</b> your pieces, <b>guard f7</b>, and ask what every check really threatens — don’t just chase the queen.',
    hl: [['f7', 'focus']],
  },
];
{
  let applied = 0;
  for (const s of STEPS) {
    if (s.kind === 'move') applied++;
    s.movesApplied = applied;
  }
}

/* ================================================================
   3. THREE.JS SCENE — flat orthographic board, Black's perspective
   ================================================================ */

const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x000000, 0);
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
camera.position.set(0, 0, 10);
camera.lookAt(0, 0, 0);

// Board laid out already rotated 180°: a1 is top-right, h8 bottom-left.
// x = 3.5 - file  (h-file left … a-file right)
// y = 4.5 - rank  (rank 1 top  … rank 8 bottom)
const posOf = (name) => {
  const [f, r] = sqIdx(name);
  return { x: 3.5 - f, y: 4.5 - r };
};

const boardGroup = new THREE.Group();
const hlGroup = new THREE.Group();
const pieceGroup = new THREE.Group();
const arrowGroup = new THREE.Group();
scene.add(boardGroup, hlGroup, pieceGroup, arrowGroup);

const SQ_LIGHT = 0xf1e4c3;
const SQ_DARK  = 0x75975e;

{
  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(8.3, 8.3),
    new THREE.MeshBasicMaterial({ color: 0x3e3930 })
  );
  frame.position.z = -0.02;
  boardGroup.add(frame);

  const sqGeo = new THREE.PlaneGeometry(1, 1);
  const lightMat = new THREE.MeshBasicMaterial({ color: SQ_LIGHT });
  const darkMat = new THREE.MeshBasicMaterial({ color: SQ_DARK });
  for (let f = 0; f < 8; f++) {
    for (let r = 1; r <= 8; r++) {
      const m = new THREE.Mesh(sqGeo, (f + r) % 2 === 0 ? lightMat : darkMat);
      const p = posOf(sqName(f, r));
      m.position.set(p.x, p.y, 0);
      boardGroup.add(m);
    }
  }
}

/* ---------------- coordinate labels (upright) ---------------- */

function textTexture(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.font = '700 84px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillStyle = '#c9bd9e';
  x.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
{
  const geo = new THREE.PlaneGeometry(0.55, 0.55);
  const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85 });
  for (let f = 0; f < 8; f++) {           // files h → a, left → right, under the bottom rank
    const m = new THREE.Mesh(geo, mat.clone());
    m.material.map = textTexture(FILES[f]);
    m.position.set(3.5 - f, -4.45, 0);
    boardGroup.add(m);
  }
  for (let r = 1; r <= 8; r++) {          // ranks 1 → 8, top → bottom, along the left edge
    const m = new THREE.Mesh(geo, mat.clone());
    m.material.map = textTexture(String(r));
    m.position.set(-4.45, 4.5 - r, 0);
    boardGroup.add(m);
  }
}

/* ---------------- piece artwork (drawn in code) ---------------- */

function rr(x, a, b, w, h, rad) {
  if (x.roundRect) x.roundRect(a, b, w, h, rad);
  else x.rect(a, b, w, h);
}
function subCircle(x, cx, cy, r) {
  x.moveTo(cx + r, cy);
  x.arc(cx, cy, r, 0, Math.PI * 2);
}

// One path per piece (subpaths appended); drawn as unified silhouette:
// pass 1 strokes the outline, pass 2 fills the interior, pass 3 adds details.
const PIECE_PATHS = {
  p(x) {
    subCircle(x, 50, 30, 12.5);
    x.moveTo(39, 74);
    x.bezierCurveTo(40, 56, 43, 49, 45, 44);
    x.lineTo(55, 44);
    x.bezierCurveTo(57, 49, 60, 56, 61, 74);
    x.closePath();
    rr(x, 28, 74, 44, 12, 4);
  },
  r(x) {
    x.rect(31, 16, 10, 16);
    x.rect(45, 16, 10, 16);
    x.rect(59, 16, 10, 16);
    x.moveTo(33, 28); x.lineTo(33, 74); x.lineTo(67, 74); x.lineTo(67, 28); x.closePath();
    rr(x, 26, 74, 48, 12, 4);
  },
  n(x) {
    x.moveTo(36, 74);
    x.bezierCurveTo(31, 68, 28, 60, 28, 54);
    x.bezierCurveTo(24, 52, 20, 50, 19, 46);
    x.bezierCurveTo(18, 42, 19, 39, 22, 37);
    x.bezierCurveTo(27, 31, 33, 28, 38, 26);
    x.lineTo(40, 15); x.lineTo(45, 21);
    x.lineTo(49, 14); x.lineTo(53, 23);
    x.bezierCurveTo(58, 26, 61, 31, 62, 38);
    x.bezierCurveTo(63, 48, 60, 60, 57, 74);
    x.closePath();
    rr(x, 26, 74, 48, 12, 4);
  },
  b(x) {
    subCircle(x, 50, 13, 5.5);
    x.moveTo(50, 20);
    x.bezierCurveTo(63, 29, 67, 39, 67, 46);
    x.bezierCurveTo(67, 56, 60, 61, 50, 61);
    x.bezierCurveTo(40, 61, 33, 56, 33, 46);
    x.bezierCurveTo(33, 39, 37, 29, 50, 20);
    x.closePath();
    x.moveTo(41, 60); x.lineTo(59, 60); x.lineTo(63, 75); x.lineTo(37, 75); x.closePath();
    rr(x, 26, 74, 48, 12, 4);
  },
  q(x) {
    x.moveTo(31, 48);
    x.lineTo(28, 24); x.lineTo(39, 34); x.lineTo(50, 15); x.lineTo(61, 34); x.lineTo(72, 24); x.lineTo(69, 48);
    x.closePath();
    x.moveTo(32, 46); x.lineTo(68, 46);
    x.bezierCurveTo(66, 60, 61, 66, 60, 74); x.lineTo(40, 74);
    x.bezierCurveTo(39, 66, 34, 60, 32, 46);
    x.closePath();
    rr(x, 25, 74, 50, 12, 4);
    subCircle(x, 28, 21, 3.4);
    subCircle(x, 50, 12, 3.4);
    subCircle(x, 72, 21, 3.4);
  },
  k(x) {
    x.rect(46.5, 7, 7, 20);
    x.rect(40, 13, 20, 7);
    x.moveTo(34, 30);
    x.quadraticCurveTo(50, 21, 66, 30);
    x.lineTo(61, 74); x.lineTo(39, 74); x.closePath();
    rr(x, 25, 74, 50, 12, 4);
  },
};

const PIECE_DETAILS = {
  b(x) { // mitre slit
    x.beginPath(); x.moveTo(53, 27); x.lineTo(46, 42); x.stroke();
  },
  n(x) { // eye
    x.beginPath(); x.arc(36, 31.5, 2.2, 0, Math.PI * 2); x.fillStyle = x.strokeStyle; x.fill();
  },
};

const pieceTexCache = new Map();
function pieceTexture(type, color) {
  const key = type + color;
  if (pieceTexCache.has(key)) return pieceTexCache.get(key);
  const S = 240;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const x = c.getContext('2d');
  x.scale(S / 100, S / 100);
  x.lineJoin = 'round';
  x.lineCap = 'round';
  const fill = color === 'w' ? '#f7f1e0' : '#322d27';
  const stroke = color === 'w' ? '#4a3f2b' : '#ddd0ab';
  const draw = PIECE_PATHS[type];
  // pass 1 — outline
  x.strokeStyle = stroke;
  x.lineWidth = 8;
  x.beginPath(); draw(x); x.stroke();
  // pass 2 — interior fill
  x.fillStyle = fill;
  x.beginPath(); draw(x); x.fill();
  // pass 3 — details
  if (PIECE_DETAILS[type]) {
    x.strokeStyle = stroke;
    x.lineWidth = 3.2;
    PIECE_DETAILS[type](x);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  pieceTexCache.set(key, tex);
  return tex;
}

/* ---------------- piece meshes ---------------- */

const pieceGeo = new THREE.PlaneGeometry(1, 1);
const pieceViews = new Map();   // piece id -> mesh
const meshPool = [];

function acquireMesh(piece) {
  let mesh = meshPool.pop();
  if (!mesh) {
    mesh = new THREE.Mesh(pieceGeo, new THREE.MeshBasicMaterial({ transparent: true }));
    mesh.renderOrder = 2;
    pieceGroup.add(mesh);
  }
  mesh.material.map = pieceTexture(piece.type, piece.color);
  mesh.material.needsUpdate = true;
  mesh.visible = true;
  return mesh;
}

function releaseMesh(mesh) {
  mesh.visible = false;
  meshPool.push(mesh);
}

function pieceScale(type) { return type === 'p' ? 0.8 : 0.94; }

// Snap the visual board to an exact logical state.
let displayedState = null;
function syncPieces(bd) {
  displayedState = bd;
  const seen = new Set();
  for (const key in bd) {
    const p = bd[key];
    seen.add(p.id);
    let mesh = pieceViews.get(p.id);
    if (!mesh) {
      mesh = acquireMesh(p);
      pieceViews.set(p.id, mesh);
    }
    const pos = posOf(key);
    mesh.position.set(pos.x, pos.y, 0.12);
    const s = pieceScale(p.type);
    mesh.scale.set(s, s, 1);
    mesh.material.opacity = 1;
  }
  for (const [id, mesh] of [...pieceViews]) {
    if (!seen.has(id)) {
      pieceViews.delete(id);
      releaseMesh(mesh);
    }
  }
}

/* ---------------- highlights & arrows ---------------- */

const HL_STYLE = {
  focus:  { color: 0xf0b544, opacity: 0.45, pulse: false },
  threat: { color: 0xe0513c, opacity: 0.52, pulse: true  },
  mate:   { color: 0xd63c24, opacity: 0.62, pulse: true  },
  block:  { color: 0x2e2a24, opacity: 0.5,  pulse: false },
  trace:  { color: 0xd9b04c, opacity: 0.28, pulse: false },
};
const ARROW_COLOR = { attack: 0xe0684b, guard: 0x5fa8a0 };

const hlGeo = new THREE.PlaneGeometry(0.98, 0.98);
const headGeo = new THREE.BufferGeometry();
headGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, -0.27, 0, 0, 0.27, 0, 0.5, 0, 0], 3));
headGeo.computeVertexNormals();

let overlayItems = [];   // { mat, base, pulse, born }

function clearOverlays() {
  hlGroup.clear();
  arrowGroup.clear();
  overlayItems = [];
}

function trackOverlay(mat, style) {
  mat.opacity = 0;
  overlayItems.push({ mat, base: style.opacity, pulse: style.pulse, born: performance.now() });
}

function addHighlight(square, kind) {
  const style = HL_STYLE[kind];
  const mat = new THREE.MeshBasicMaterial({
    color: style.color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(hlGeo, mat);
  const p = posOf(square);
  mesh.position.set(p.x, p.y, 0.05);
  mesh.renderOrder = 1;
  hlGroup.add(mesh);
  trackOverlay(mat, style);
}

function addArrow(from, to, kind) {
  const a = posOf(from), b = posOf(to);
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.2) return;
  const ux = dx / len, uy = dy / len;
  const angle = Math.atan2(dy, dx);
  const color = ARROW_COLOR[kind] || ARROW_COLOR.attack;
  const shaftMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const shaft = new THREE.Mesh(hlGeo, shaftMat);
  const L = Math.max(len - 0.34, 0.25);
  shaft.scale.set(L, 0.2, 1);
  shaft.rotation.z = angle;
  shaft.position.set(a.x + ux * (L / 2), a.y + uy * (L / 2), 0.3);
  shaft.renderOrder = 3;
  arrowGroup.add(shaft);
  trackOverlay(shaftMat, { opacity: 0.82, pulse: false });

  const headMat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.rotation.z = angle;
  head.position.set(a.x + ux * (len - 0.5), a.y + uy * (len - 0.5), 0.3);
  head.renderOrder = 3;
  arrowGroup.add(head);
  trackOverlay(headMat, { opacity: 0.82, pulse: false });
}

function applyStepOverlays(step) {
  clearOverlays();
  // faint trace of the move that led here
  if (step.movesApplied > 0) {
    const mv = MOVES[step.movesApplied - 1];
    const marked = new Set((step.hl || []).map(h => h[0]));
    if (!marked.has(mv.from)) addHighlight(mv.from, 'trace');
    if (!marked.has(mv.to)) addHighlight(mv.to, 'trace');
  }
  for (const [square, kind] of step.hl || []) addHighlight(square, kind);
  for (const [from, to, kind] of step.arrows || []) addArrow(from, to, kind);
}

/* ---------------- tweens ---------------- */

const tweens = new Set();
function tween(dur, onU, opts = {}) {
  const tw = { start: performance.now() + (opts.delay || 0), dur, onU, onC: opts.onComplete };
  tweens.add(tw);
  return tw;
}
function stepTweens(now) {
  for (const tw of [...tweens]) {
    let t = (now - tw.start) / tw.dur;
    if (t < 0) continue;
    if (t >= 1) t = 1;
    tw.onU(t);
    if (t === 1) {
      if (tw.onC) tw.onC();
      tweens.delete(tw);
    }
  }
}
function killTweens() { tweens.clear(); }

const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/* ---------------- move animation ---------------- */

function animateMove(moveIndex, onDone) {
  const before = states[moveIndex];
  const move = MOVES[moveIndex];
  const piece = before[move.from];
  const captured = before[move.to] || null;
  const mesh = pieceViews.get(piece.id);
  const A = posOf(move.from), B = posOf(move.to);
  const sBase = pieceScale(piece.type);
  const hop = piece.type === 'n';

  addHighlight(move.to, 'trace');   // destination hint while sliding

  tween(hop ? 660 : 560, (t) => {
    const e = easeInOutCubic(t);
    mesh.position.x = A.x + (B.x - A.x) * e;
    mesh.position.y = A.y + (B.y - A.y) * e;
    mesh.position.z = 0.16;
    if (hop) {
      const k = sBase * (1 + 0.22 * Math.sin(Math.PI * t));
      mesh.scale.set(k, k, 1);
    }
  }, {
    onComplete: () => {
      if (captured) {
        const cm = pieceViews.get(captured.id);
        if (cm) { pieceViews.delete(captured.id); releaseMesh(cm); }
      }
      syncPieces(states[moveIndex + 1]);
      onDone();
    },
  });

  if (captured) {
    const cm = pieceViews.get(captured.id);
    if (cm) {
      const cs = pieceScale(captured.type);
      tween(300, (t) => {
        cm.material.opacity = 1 - t;
        const k = cs * (1 - 0.3 * t);
        cm.scale.set(k, k, 1);
      }, { delay: 220 });
    }
  }
}

/* ---------------- resize ---------------- */

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const half = 4.9;   // fits the 8x8 board plus label margins
  if (aspect >= 1) {
    camera.top = half; camera.bottom = -half;
    camera.left = -half * aspect; camera.right = half * aspect;
  } else {
    camera.left = -half; camera.right = half;
    camera.top = half / aspect; camera.bottom = -half / aspect;
  }
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

/* ================================================================
   4. PLAYBACK & UI
   ================================================================ */

const el = (id) => document.getElementById(id);
const captionEl = el('caption');
const captionTag = el('captionTag');
const captionText = el('captionText');
const moveCounter = el('moveCounter');
const moveListEl = el('moveList');
const progressWrap = el('progressWrap');
const progressFill = el('progressFill');
const stepLabel = el('stepLabel');

let cur = -1;
let stepStart = 0;
let playing = false;
let pausedAt = 0;

/* move list chips */
const chips = MOVES.map((m, i) => {
  const b = document.createElement('button');
  b.className = 'chip';
  b.textContent = m.color === 'w' ? `${m.num}. ${m.san}` : `${m.num}… ${m.san}`;
  b.addEventListener('click', () => {
    const idx = STEPS.findIndex(s => s.kind === 'move' && s.mi === i);
    if (idx >= 0) gotoStep(idx, { animate: false });
  });
  moveListEl.appendChild(b);
  return b;
});
{
  const div = document.createElement('span');
  div.className = 'chip-divider';
  moveListEl.appendChild(div);
  const res = document.createElement('span');
  res.className = 'chip';
  res.textContent = '1–0';
  res.style.cursor = 'default';
  res.style.opacity = '0.55';
  moveListEl.appendChild(res);
}

function setCaption(step) {
  if (step.kind === 'note') {
    captionTag.textContent = step.tag;
    captionEl.classList.add('show-tag');
  } else {
    captionEl.classList.remove('show-tag');
  }
  captionText.innerHTML = step.caption;
  captionEl.classList.remove('flash');
  void captionEl.offsetWidth;
  captionEl.classList.add('flash');
}

function updateMoveListUI() {
  const applied = cur >= 0 ? STEPS[cur].movesApplied : 0;
  chips.forEach((c, i) => c.classList.toggle('current', i === applied - 1));
  if (applied > 0) {
    const chip = chips[applied - 1];
    if (chip.scrollIntoView) {
      try { chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch (e) { /* older browsers */ }
    }
  }
  moveCounter.textContent = applied === 0 ? 'Start' : `Move ${applied} of ${MOVES.length}`;
}

function updateProgressUI() {
  const frac = (cur + 1) / STEPS.length;
  progressFill.style.width = `${(frac * 100).toFixed(2)}%`;
  stepLabel.textContent = `${cur + 1} / ${STEPS.length}`;
}

function setPlaying(v) {
  if (v === playing) return;
  const now = performance.now();
  if (v) {
    if (pausedAt) stepStart += now - pausedAt;   // preserve remaining dwell time
  } else {
    pausedAt = now;
  }
  playing = v;
  el('iconPlay').style.display = v ? 'none' : 'block';
  el('iconPause').style.display = v ? 'block' : 'none';
}

function gotoStep(i, opts = {}) {
  i = Math.max(0, Math.min(STEPS.length - 1, i));
  if (i === cur) { stepStart = performance.now(); return; }
  killTweens();
  const step = STEPS[i];
  const prevApplied = cur >= 0 ? STEPS[cur].movesApplied : 0;
  cur = i;

  if (opts.animate && step.kind === 'move' && step.movesApplied === prevApplied + 1) {
    syncPieces(states[prevApplied]);   // make sure meshes match the before-state exactly
    clearOverlays();
    setCaption(step);
    updateMoveListUI();
    stepStart = performance.now() + 720; // provisional; refined on completion
    animateMove(prevApplied, () => {
      applyStepOverlays(step);
      stepStart = performance.now();
    });
  } else {
    syncPieces(states[step.movesApplied]);
    clearOverlays();
    applyStepOverlays(step);
    setCaption(step);
    updateMoveListUI();
    stepStart = performance.now();
  }
  updateProgressUI();
}

/* controls */

el('btnPlay').addEventListener('click', () => {
  if (playing) { setPlaying(false); return; }
  if (cur >= STEPS.length - 1) gotoStep(0, { animate: false });
  setPlaying(true);
});
el('btnReplay').addEventListener('click', () => {
  gotoStep(0, { animate: false });
  setPlaying(true);
});
el('btnNext').addEventListener('click', () => gotoStep(cur + 1, { animate: true }));
el('btnPrev').addEventListener('click', () => gotoStep(cur - 1, { animate: false }));

let dragging = false;
function seekFromEvent(e) {
  const r = progressWrap.getBoundingClientRect();
  const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  gotoStep(Math.round(frac * (STEPS.length - 1)), { animate: false });
}
progressWrap.addEventListener('pointerdown', (e) => {
  dragging = true;
  progressWrap.setPointerCapture(e.pointerId);
  seekFromEvent(e);
});
progressWrap.addEventListener('pointermove', (e) => { if (dragging) seekFromEvent(e); });
progressWrap.addEventListener('pointerup', () => { dragging = false; });
progressWrap.addEventListener('pointercancel', () => { dragging = false; });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    if (e.target && e.target.tagName === 'BUTTON') return; // let the focused button handle it natively
    e.preventDefault(); el('btnPlay').click();
  }
  else if (e.code === 'ArrowRight') el('btnNext').click();
  else if (e.code === 'ArrowLeft') el('btnPrev').click();
  else if (e.code === 'KeyR') el('btnReplay').click();
});

/* render loop */

function updateOverlays(now) {
  for (const item of overlayItems) {
    const fade = Math.min(1, (now - item.born) / 260);
    const wave = item.pulse ? 0.82 + 0.18 * Math.sin(now * 0.005) : 1;
    item.mat.opacity = item.base * fade * wave;
  }
}

function playbackTick(now) {
  if (!playing || cur < 0) return;
  if (now >= stepStart + STEPS[cur].dur) {
    if (cur < STEPS.length - 1) gotoStep(cur + 1, { animate: true });
    else setPlaying(false);
  }
}

function loop(now) {
  requestAnimationFrame(loop);
  stepTweens(now);
  updateOverlays(now);
  playbackTick(now);
  renderer.render(scene, camera);
}

/* boot */

gotoStep(0, { animate: false });
requestAnimationFrame(loop);

// Debug helper: /?step=N jumps straight to step N without autoplay.
const debugStep = parseInt(new URLSearchParams(location.search).get('step'), 10);
if (!Number.isNaN(debugStep)) {
  gotoStep(debugStep, { animate: false });
} else {
  setTimeout(() => setPlaying(true), 900);
}
