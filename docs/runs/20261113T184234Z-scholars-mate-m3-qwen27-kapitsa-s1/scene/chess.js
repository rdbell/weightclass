// Minimal chess rules engine — just enough to verify the supplied Scholar's Mate line.
// Squares: f = 0..7 (a..h), r = 0..7 (rank 1..8). Board key = r * 8 + f.

export const FILES = 'abcdefgh';

export const inB = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;
export const sq = (f, r) => r * 8 + f;
export const name = (f, r) => FILES[f] + (r + 1);
export const parse = (s) => ({ f: FILES.indexOf(s[0]), r: +s[1] - 1 });

export function startPosition() {
  const pos = new Map();
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r']; // types always lowercase; color in `c`
  for (let f = 0; f < 8; f++) {
    // Standard chess: rank 1 = White's back rank, rank 8 = Black's back rank.
    pos.set(sq(f, 0), { t: back[f], c: 'w' });
    pos.set(sq(f, 1), { t: 'p', c: 'w' });
    pos.set(sq(f, 6), { t: 'p', c: 'b' });
    pos.set(sq(f, 7), { t: back[f], c: 'b' });
  }
  return pos;
}

// The supplied, verified line: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
export const MOVES = [
  { san: 'e4', from: 'e2', to: 'e4', c: 'w' },
  { san: 'e5', from: 'e7', to: 'e5', c: 'b' },
  { san: 'Bc4', from: 'f1', to: 'c4', c: 'w' },
  { san: 'Nc6', from: 'b8', to: 'c6', c: 'b' },
  { san: 'Qh5', from: 'd1', to: 'h5', c: 'w' },
  { san: 'Nf6', from: 'g8', to: 'f6', c: 'b' },
  { san: 'Qxf7#', from: 'h5', to: 'f7', c: 'w' },
];

export function applyMove(pos, m) {
  const p = new Map(pos);
  const from = parse(m.from), to = parse(m.to);
  const piece = p.get(sq(from.f, from.r));
  if (!piece) return p;
  p.delete(sq(from.f, from.r));
  p.set(sq(to.f, to.r), piece); // overwrites any captured piece
  return p;
}

// Stable identity for a piece (so the UI can track it across seeks).
export function pieceId(p, f, r) {
  const T = p.t.toUpperCase();
  return (T === 'K' || T === 'Q') ? p.c + T : p.c + T + '_' + name(f, r);
}

// All 32 pieces with their squares after `n` half-moves of the supplied line.
export function piecesAfter(n) {
  const pieces = new Map();
  for (const [key, p] of startPosition()) {
    const f = key & 7, r = key >> 3;
    const id = pieceId(p, f, r);
    pieces.set(id, { id, type: p.t.toLowerCase(), color: p.c, f, r, dead: false });
  }
  for (let i = 0; i < n; i++) {
    const m = MOVES[i];
    const from = parse(m.from), to = parse(m.to);
    let movedId = null, capturedId = null;
    for (const pc of pieces.values()) {
      if (!pc.dead && pc.f === from.f && pc.r === from.r) movedId = pc.id;
      if (!pc.dead && pc.f === to.f && pc.r === to.r) capturedId = pc.id;
    }
    if (!movedId) continue;
    const mv = pieces.get(movedId);
    mv.f = to.f; mv.r = to.r;
    if (capturedId) pieces.get(capturedId).dead = true;
  }
  return pieces;
}

export function findPieceAt(pieces, squareName) {
  const { f, r } = parse(squareName);
  for (const pc of pieces.values()) {
    if (!pc.dead && pc.f === f && pc.r === r) return pc.id;
  }
  return null;
}

// ---------------------------------------------------------------- rules

const N_D = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const K_D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const B_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const R_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function pseudoMoves(pos, color) {
  const ms = [];
  const push = (f, r, f2, r2) => {
    if (!inB(f2, r2)) return;
    const o = pos.get(sq(f2, r2));
    if (!o || o.c !== color) ms.push({ from: name(f, r), to: name(f2, r2) });
  };
  for (const [key, p] of pos) {
    if (p.c !== color) continue;
    const f = key & 7, r = key >> 3;
    if (p.t === 'p') {
      const d = color === 'w' ? 1 : -1;
      const r1 = r + d;
      if (inB(f, r1) && !pos.has(sq(f, r1))) {
        ms.push({ from: name(f, r), to: name(f, r1) });
        if ((color === 'w' ? r === 1 : r === 6)) {
          const r2 = r + 2 * d;
          if (inB(f, r2) && !pos.has(sq(f, r2))) ms.push({ from: name(f, r), to: name(f, r2) });
        }
      }
      for (const df of [-1, 1]) {
        const f2 = f + df, r2 = r + d;
        if (inB(f2, r2)) {
          const o = pos.get(sq(f2, r2));
          if (o && o.c !== color) ms.push({ from: name(f, r), to: name(f2, r2) });
        }
      }
    } else if (p.t === 'n' || p.t === 'k') {
      for (const [df, dr] of (p.t === 'n' ? N_D : K_D)) push(f, r, f + df, r + dr);
    } else {
      const dirs = p.t === 'b' ? B_D : p.t === 'q' ? B_D.concat(R_D) : R_D;
      for (const [df, dr] of dirs) {
        let f2 = f + df, r2 = r + dr;
        while (inB(f2, r2)) {
          const o = pos.get(sq(f2, r2));
          if (o) { if (o.c !== color) ms.push({ from: name(f, r), to: name(f2, r2) }); break; }
          ms.push({ from: name(f, r), to: name(f2, r2) });
          f2 += df; r2 += dr;
        }
      }
    }
  }
  return ms;
}

export function isAttacked(pos, f, r, by) {
  if (!inB(f, r)) return false;
  // pawns
  const pr = by === 'w' ? -1 : 1;
  for (const df of [-1, 1]) {
    const f2 = f + df, r2 = r + pr;
    if (inB(f2, r2)) {
      const p = pos.get(sq(f2, r2));
      if (p && p.c === by && p.t === 'p') return true;
    }
  }
  for (const [df, dr] of N_D) {
    const f2 = f + df, r2 = r + dr;
    if (inB(f2, r2)) {
      const p = pos.get(sq(f2, r2));
      if (p && p.c === by && p.t === 'n') return true;
    }
  }
  for (const [df, dr] of K_D) {
    const f2 = f + df, r2 = r + dr;
    if (inB(f2, r2)) {
      const p = pos.get(sq(f2, r2));
      if (p && p.c === by && p.t === 'k') return true;
    }
  }
  for (const [df, dr] of B_D) {
    let f2 = f + df, r2 = r + dr;
    while (inB(f2, r2)) {
      const p = pos.get(sq(f2, r2));
      if (p) { if (p.c === by && (p.t === 'b' || p.t === 'q')) return true; break; }
      f2 += df; r2 += dr;
    }
  }
  for (const [df, dr] of R_D) {
    let f2 = f + df, r2 = r + dr;
    while (inB(f2, r2)) {
      const p = pos.get(sq(f2, r2));
      if (p) { if (p.c === by && (p.t === 'r' || p.t === 'q')) return true; break; }
      f2 += df; r2 += dr;
    }
  }
  return false;
}

export function kingPos(pos, color) {
  for (const [k, p] of pos) {
    if (p.t === 'k' && p.c === color) return { f: k & 7, r: k >> 3 };
  }
  return null;
}

export function inCheck(pos, color) {
  const k = kingPos(pos, color);
  if (!k) return false;
  return isAttacked(pos, k.f, k.r, color === 'w' ? 'b' : 'w');
}

export function legalMoves(pos, color) {
  return pseudoMoves(pos, color).filter((m) => !inCheck(applyMove(pos, m), color));
}

export function isCheckmated(pos, color) {
  return inCheck(pos, color) && legalMoves(pos, color).length === 0;
}

export function toFen(pos, side) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.get(sq(f, r));
      if (!p) empty++;
      else {
        if (empty) { row += empty; empty = 0; }
        row += p.c === 'w' ? p.t.toUpperCase() : p.t;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join('/')} ${side === 'w' ? 'w' : 'b'} KQkq - 0 1`;
}

// Verify the whole supplied line: every half-move legal, final position checkmated.
export function verifyLine() {
  let pos = startPosition();
  const problems = [];
  for (const m of MOVES) {
    const ok = legalMoves(pos, m.c).some((x) => x.from === m.from && x.to === m.to);
    if (!ok) problems.push(`${m.san} is not a legal move`);
    pos = applyMove(pos, m);
  }
  const chk = inCheck(pos, 'b');
  const nLegal = legalMoves(pos, 'b').length;
  const mated = isCheckmated(pos, 'b');
  const fen = toFen(pos, 'b');
  const ok = problems.length === 0 && mated;
  const msg = ok
    ? `Line verified: all ${MOVES.length} half-moves legal; Black is checkmated. FEN: ${fen}`
    : `Verification FAILED: ${problems.join('; ') || `inCheck=${chk}, legalReplies=${nLegal}`}`;
  console.log(`[scholars-mate] ${msg}`);
  return { ok, msg, fen, inCheck: chk, nLegal };
}
