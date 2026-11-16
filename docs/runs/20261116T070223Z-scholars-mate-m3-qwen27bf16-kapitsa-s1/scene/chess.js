// chess.js — minimal chess logic used to verify the supplied line and the
// final checkmate. Deterministic, no randomness.

export const FILES = 'abcdefgh';

export function initialPosition() {
  const pos = new Map();
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let f = 0; f < 8; f++) {
    pos.set(FILES[f] + '1', 'w' + back[f]);
    pos.set(FILES[f] + '2', 'wP');
    pos.set(FILES[f] + '7', 'bP');
    pos.set(FILES[f] + '8', 'b' + back[f]);
  }
  return pos;
}

// index = file + rank*8, file a=0, rank 1=0
export function toIndex(sq) {
  return (sq.charCodeAt(0) - 97) + (sq.charCodeAt(1) - 49) * 8;
}
export function fromIndex(i) {
  return FILES[i % 8] + String(Math.floor(i / 8) + 1);
}

const KNIGHT_D = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const BISHOP_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

export function squareAttacked(pos, sq, byColor) {
  const f = sq.charCodeAt(0) - 97;
  const r = sq.charCodeAt(1) - 49;
  // pawns: a `byColor` pawn attacks sq from one rank "behind" (from its view)
  const pawnDir = byColor === 'w' ? 1 : -1;
  for (const df of [-1, 1]) {
    const nf = f + df, nr = r - pawnDir;
    if (onBoard(nf, nr) && pos.get(fromIndex(nf + nr * 8)) === byColor + 'P') return true;
  }
  for (const [df, dr] of KNIGHT_D) {
    const nf = f + df, nr = r + dr;
    if (onBoard(nf, nr) && pos.get(fromIndex(nf + nr * 8)) === byColor + 'n') return true;
  }
  for (const [df, dr] of KING_D) {
    const nf = f + df, nr = r + dr;
    if (onBoard(nf, nr) && pos.get(fromIndex(nf + nr * 8)) === byColor + 'k') return true;
  }
  for (const [df, dr] of BISHOP_D) {
    let nf = f + df, nr = r + dr;
    while (onBoard(nf, nr)) {
      const p = pos.get(fromIndex(nf + nr * 8));
      if (p) { if (p[0] === byColor && (p[1] === 'b' || p[1] === 'q')) return true; break; }
      nf += df; nr += dr;
    }
  }
  for (const [df, dr] of ROOK_D) {
    let nf = f + df, nr = r + dr;
    while (onBoard(nf, nr)) {
      const p = pos.get(fromIndex(nf + nr * 8));
      if (p) { if (p[0] === byColor && (p[1] === 'r' || p[1] === 'q')) return true; break; }
      nf += df; nr += dr;
    }
  }
  return false;
}

export function kingSquare(pos, color) {
  for (const [sq, p] of pos) if (p === color + 'k') return sq;
  return null;
}

export function inCheck(pos, color) {
  const k = kingSquare(pos, color);
  return k ? squareAttacked(pos, k, color === 'w' ? 'b' : 'w') : false;
}

// Pseudo-legal moves (castling / en passant not needed for this line).
export function pseudoMoves(pos, color) {
  const moves = [];
  const opp = color === 'w' ? 'b' : 'w';
  for (const [sq, p] of pos) {
    if (p[0] !== color) continue;
    const f = sq.charCodeAt(0) - 97;
    const r = sq.charCodeAt(1) - 49;
    const type = p[1];
    if (type === 'P') {
      const dir = color === 'w' ? 1 : -1;
      const startRank = color === 'w' ? 1 : 6;
      const fwd = (nr) => fromIndex(f + nr * 8);
      if (onBoard(f, r + dir) && !pos.get(fwd(r + dir))) {
        moves.push({ from: sq, to: fwd(r + dir) });
        if (r === startRank && !pos.get(fwd(r + 2 * dir))) {
          moves.push({ from: sq, to: fwd(r + 2 * dir), special: 'double' });
        }
      }
      for (const df of [-1, 1]) {
        const nf = f + df, nr = r + dir;
        if (!onBoard(nf, nr)) continue;
        const t = pos.get(fromIndex(nf + nr * 8));
        if (t && t[0] === opp) moves.push({ from: sq, to: fromIndex(nf + nr * 8), special: 'capture' });
      }
    } else if (type === 'n' || type === 'k') {
      for (const [df, dr] of (type === 'n' ? KNIGHT_D : KING_D)) {
        const nf = f + df, nr = r + dr;
        if (!onBoard(nf, nr)) continue;
        const t = pos.get(fromIndex(nf + nr * 8));
        if (t && t[0] === color) continue;
        moves.push({ from: sq, to: fromIndex(nf + nr * 8) });
      }
    } else {
      const dirs = type === 'b' ? BISHOP_D : type === 'r' ? ROOK_D : BISHOP_D.concat(ROOK_D);
      for (const [df, dr] of dirs) {
        let nf = f + df, nr = r + dr;
        while (onBoard(nf, nr)) {
          const nsq = fromIndex(nf + nr * 8);
          const t = pos.get(nsq);
          if (t) { if (t[0] === opp) moves.push({ from: sq, to: nsq }); break; }
          moves.push({ from: sq, to: nsq });
          nf += df; nr += dr;
        }
      }
    }
  }
  return moves;
}

export function makeMove(pos, m) {
  const next = new Map(pos);
  next.set(m.to, next.get(m.from));
  next.delete(m.from);
  return next;
}

export function legalMoves(pos, color) {
  return pseudoMoves(pos, color).filter((m) => !inCheck(makeMove(pos, m), color));
}

export function isCheckmate(pos, color) {
  return inCheck(pos, color) && legalMoves(pos, color).length === 0;
}

export function fen(pos, turn, moveNumber = 4) {
  const rows = [];
  for (let r = 7; r >= 0; r--) {
    let row = '', empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = pos.get(fromIndex(f + r * 8));
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      row += p[0] === 'w' ? p[1].toUpperCase() : p[1].toLowerCase();
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return rows.join('/') + ' ' + turn + ' KQkq - 0 ' + moveNumber;
}

// Labeled positions: each physical piece keeps a stable id across the line,
// so the UI can animate the same mesh through the whole lesson (and restore
// exact states when seeking, including which pawn was captured).
export function labeledInitial() {
  const m = new Map();
  let id = 0;
  for (const [sq, p] of initialPosition()) m.set(sq, { id: id++, piece: p });
  return m;
}

export function labeledAfter(moves, k) {
  const m = labeledInitial();
  for (let i = 0; i < k; i++) {
    const mv = moves[i];
    const entry = m.get(mv.from);
    m.delete(mv.from);
    m.set(mv.to, entry);
  }
  return m;
}
