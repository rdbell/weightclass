// Minimal chess-board helpers: position model, attack detection, and
// a small legal-move generator used only to verify the supplied line.

export const FILES = 'abcdefgh';

export const sq = (f, r) => FILES[f] + r;            // f: 0-7 (a-h), r: 1-8
export const parseSq = (s) => ({ f: FILES.indexOf(s[0]), r: +s[1] });
export const flip = (c) => (c === 'w' ? 'b' : 'w');

export function initialBoard() {
  const b = {};
  const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let f = 0; f < 8; f++) {
    b[sq(f, 1)] = { type: back[f], color: 'w' };
    b[sq(f, 2)] = { type: 'P', color: 'w' };
    b[sq(f, 7)] = { type: 'P', color: 'b' };
    b[sq(f, 8)] = { type: back[f], color: 'b' };
  }
  return b;
}

export function applyMove(board, from, to) {
  const b = { ...board };
  b[to] = b[from];
  delete b[from];
  return b;
}

const KNIGHT_D = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING_D   = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const BISHOP_D = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const ROOK_D   = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const onBoard = (f, r) => f >= 0 && f < 8 && r >= 1 && r <= 8;

export function attackedBy(board, target, byColor) {
  const { f, r } = parseSq(target);
  const pawnDR = byColor === 'w' ? -1 : 1; // rank the attacking pawn stands on
  for (const df of [-1, 1]) {
    const af = f + df, ar = r + pawnDR;
    if (onBoard(af, ar)) {
      const p = board[sq(af, ar)];
      if (p && p.color === byColor && p.type === 'P') return true;
    }
  }
  for (const [df, dr] of KNIGHT_D) {
    const af = f + df, ar = r + dr;
    if (onBoard(af, ar)) {
      const p = board[sq(af, ar)];
      if (p && p.color === byColor && p.type === 'N') return true;
    }
  }
  for (const [df, dr] of KING_D) {
    const af = f + df, ar = r + dr;
    if (onBoard(af, ar)) {
      const p = board[sq(af, ar)];
      if (p && p.color === byColor && p.type === 'K') return true;
    }
  }
  for (const [dirs, types] of [[BISHOP_D, 'BQ'], [ROOK_D, 'RQ']]) {
    for (const [df, dr] of dirs) {
      let af = f + df, ar = r + dr;
      while (onBoard(af, ar)) {
        const p = board[sq(af, ar)];
        if (p) {
          if (p.color === byColor && types.includes(p.type)) return true;
          break;
        }
        af += df; ar += dr;
      }
    }
  }
  return false;
}

export function kingSquare(board, color) {
  for (const s of Object.keys(board)) {
    const p = board[s];
    if (p.type === 'K' && p.color === color) return s;
  }
  return null;
}

export function inCheck(board, color) {
  const k = kingSquare(board, color);
  return k ? attackedBy(board, k, flip(color)) : false;
}

export function pseudoMoves(board, from) {
  const p = board[from];
  if (!p) return [];
  const { f, r } = parseSq(from);
  const res = [];
  const en = p.color === 'w' ? 1 : -1;
  const push = (tf, tr) => {
    if (!onBoard(tf, tr)) return;
    const t = board[sq(tf, tr)];
    if (!t || t.color !== p.color) res.push(sq(tf, tr));
  };
  if (p.type === 'P') {
    if (onBoard(f, r + en) && !board[sq(f, r + en)]) {
      res.push(sq(f, r + en));
      const startR = p.color === 'w' ? 2 : 7;
      if (r === startR && !board[sq(f, r + 2 * en)]) res.push(sq(f, r + 2 * en));
    }
    for (const df of [-1, 1]) {
      const tf = f + df, tr = r + en;
      if (onBoard(tf, tr)) {
        const t = board[sq(tf, tr)];
        if (t && t.color !== p.color) res.push(sq(tf, tr));
      }
    }
  } else if (p.type === 'N' || p.type === 'K') {
    const dirs = p.type === 'N' ? KNIGHT_D : KING_D;
    for (const [df, dr] of dirs) push(f + df, r + dr);
  } else {
    const dirs = p.type === 'B' ? BISHOP_D : p.type === 'R' ? ROOK_D : [...BISHOP_D, ...ROOK_D];
    for (const [df, dr] of dirs) {
      let tf = f + df, tr = r + dr;
      while (onBoard(tf, tr)) {
        const t = board[sq(tf, tr)];
        if (!t) res.push(sq(tf, tr));
        else { if (t.color !== p.color) res.push(sq(tf, tr)); break; }
        tf += df; tr += dr;
      }
    }
  }
  return res;
}

export function hasAnyLegalMove(board, color) {
  for (const from of Object.keys(board)) {
    if (board[from].color !== color) continue;
    for (const to of pseudoMoves(board, from)) {
      if (!inCheck(applyMove(board, from, to), color)) return true;
    }
  }
  return false;
}

export function isCheckmate(board, color) {
  return inCheck(board, color) && !hasAnyLegalMove(board, color);
}

function placementFEN(board) {
  let out = '';
  for (let r = 8; r >= 1; r--) {
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = board[sq(f, r)];
      if (!p) { empty++; continue; }
      if (empty) { out += empty; empty = 0; }
      out += p.color === 'w' ? p.type : p.type.toLowerCase();
    }
    if (empty) out += empty;
    if (r > 1) out += '/';
  }
  return out;
}

// Replays the supplied line and verifies notation, the final position and mate.
export function verifyLesson(segments) {
  const problems = [];
  let board = initialBoard();
  let color = 'w';
  for (const seg of segments) {
    if (!seg.move) continue;
    const { from, to } = seg.move;
    const p = board[from];
    const expectedType = 'PNBRQK'.includes(seg.san[0]) ? seg.san[0] : 'P';
    if (!p || p.color !== color) problems.push(`${seg.san}: no ${color} piece on ${from}`);
    else if (p.type !== expectedType) problems.push(`${seg.san}: ${from} holds a ${p.type}, not ${expectedType}`);
    else if (seg.san.includes('x') !== !!board[to]) problems.push(`${seg.san}: capture flag mismatch`);
    else if (seg.san.endsWith('#') !== (seg.mate === true)) problems.push(`${seg.san}: mate flag mismatch`);
    board = applyMove(board, from, to);
    color = flip(color);
  }
  const fen = placementFEN(board);
  const expected = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR';
  if (fen !== expected) problems.push(`final position ${fen} != expected ${expected}`);
  const mate = isCheckmate(board, 'b');
  if (!mate) problems.push('final position is not checkmate for Black');
  return { ok: problems.length === 0 && mate, problems, fen, mate };
}
