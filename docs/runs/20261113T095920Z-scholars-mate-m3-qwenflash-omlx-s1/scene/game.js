// game.js — a tiny, self-contained chess move generator.
//
// It exists for one reason: the lesson must never show a wrong position. Every
// position the lesson displays is derived by replaying the supplied half-moves
// from the standard start position, and `verify()` proves with the move
// generator that
//   * every supplied half-move is legal,
//   * the final position is checkmate for Black,
//   * and the specific claims made by the coaching captions are true.
//
// Board representation: array of 64, index 0 = a1, index = (rank-1)*8 + file.
// Pieces are single characters: uppercase = White, lowercase = Black, null = empty.

export const FILES = 'abcdefgh';

export function sq(name) {
  const file = name.charCodeAt(0) - 97;
  const rank = name.charCodeAt(1) - 49;
  return rank * 8 + file;
}

export function nameOf(index) {
  return FILES[index & 7] + (1 + (index >> 3));
}

export const EMPTY_BOARD = () => new Array(64).fill(null);

export function startPosition() {
  const back = 'rnbqkbnr';
  const board = EMPTY_BOARD();
  for (let f = 0; f < 8; f++) {
    board[f] = back[f].toUpperCase();
    board[8 + f] = 'P';
    board[48 + f] = 'p';
    board[56 + f] = back[f];
  }
  return board;
}

export const isWhite = (p) => p !== null && p === p.toUpperCase();
export const colorOf = (p) => (p === null ? null : isWhite(p) ? 'w' : 'b');
export const typeOf = (p) => (p === null ? null : p.toUpperCase());

const RAYS = {
  B: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  R: [[1, 0], [0, 1], [-1, 0], [0, -1]],
};
RAYS.Q = RAYS.B.concat(RAYS.R);
const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = RAYS.Q;

function inside(file, rank) {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

/** Is `index` attacked by any piece of `by` ('w' | 'b')? */
export function attacked(board, index, by) {
  const file = index & 7;
  const rank = index >> 3;

  // Pawns: a white pawn attacks "upwards" (+rank), so the attackers of this
  // square sit one rank below it, one file to either side.
  const pr = by === 'w' ? rank - 1 : rank + 1;
  for (const df of [-1, 1]) {
    if (inside(file + df, pr)) {
      const p = board[pr * 8 + file + df];
      if (p === (by === 'w' ? 'P' : 'p')) return true;
    }
  }
  for (const [df, dr] of KNIGHT) {
    if (!inside(file + df, rank + dr)) continue;
    const p = board[(rank + dr) * 8 + file + df];
    if (colorOf(p) === by && typeOf(p) === 'N') return true;
  }
  for (const [df, dr] of KING) {
    if (!inside(file + df, rank + dr)) continue;
    const p = board[(rank + dr) * 8 + file + df];
    if (colorOf(p) === by && typeOf(p) === 'K') return true;
  }
  for (const [type, dirs] of [['B', RAYS.B], ['R', RAYS.R], ['Q', RAYS.Q]]) {
    for (const [df, dr] of dirs) {
      let f = file + df;
      let r = rank + dr;
      while (inside(f, r)) {
        const p = board[r * 8 + f];
        if (p !== null) {
          if (colorOf(p) === by && typeOf(p) === type) return true;
          break;
        }
        f += df;
        r += dr;
      }
    }
  }
  return false;
}

export function findKing(board, color) {
  const king = color === 'w' ? 'K' : 'k';
  for (let i = 0; i < 64; i++) if (board[i] === king) return i;
  return -1;
}

export function inCheck(board, color) {
  return attacked(board, findKing(board, color), color === 'w' ? 'b' : 'w');
}

/** All legal moves for `color` as {from,to,promo}. Castling and en-passant are
 *  not needed for this lesson and are deliberately left out. */
export function legalMoves(board, color) {
  const out = [];
  const foe = color === 'w' ? 'b' : 'w';
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (colorOf(p) !== color) continue;
    const type = typeOf(p);
    const file = i & 7;
    const rank = i >> 3;
    const push = (to, promo) => {
      const next = board.slice();
      next[to] = promo || next[i];
      next[i] = null;
      if (!attacked(next, findKing(next, color), foe)) out.push({ from: i, to, promo: promo || null });
    };

    if (type === 'P') {
      const dir = color === 'w' ? 1 : -1;
      const homeRank = color === 'w' ? 1 : 6;
      const lastRank = color === 'w' ? 7 : 0;
      const one = (rank + dir) * 8 + file;
      if (inside(file, rank + dir) && board[one] === null) {
        if (rank + dir === lastRank) {
          for (const q of ['Q', 'R', 'B', 'N']) push(one, color === 'w' ? q : q.toLowerCase());
        } else {
          push(one);
          if (rank === homeRank) {
            const two = (rank + 2 * dir) * 8 + file;
            if (board[two] === null) push(two);
          }
        }
      }
      for (const df of [-1, 1]) {
        if (!inside(file + df, rank + dir)) continue;
        const to = (rank + dir) * 8 + file + df;
        if (board[to] !== null && colorOf(board[to]) === foe) {
          if (rank + dir === lastRank) {
            for (const q of ['Q', 'R', 'B', 'N']) push(to, color === 'w' ? q : q.toLowerCase());
          } else push(to);
        }
      }
      continue;
    }

    const dirs = type === 'N' ? KNIGHT : type === 'K' ? KING : RAYS[type];
    for (const [df, dr] of dirs) {
      let f = file + df;
      let r = rank + dr;
      while (inside(f, r)) {
        const to = r * 8 + f;
        if (board[to] === null) push(to);
        else {
          if (colorOf(board[to]) === foe) push(to);
          break;
        }
        f += df;
        r += dr;
      }
    }
  }
  return out;
}

export function status(board, colorToMove) {
  const moves = legalMoves(board, colorToMove);
  const checked = inCheck(board, colorToMove);
  if (moves.length === 0) return checked ? 'mate' : 'stalemate';
  return checked ? 'check' : 'normal';
}

// ---------------------------------------------------------------------------
// The supplied lesson line. Verified, not reconstructed.
// ---------------------------------------------------------------------------

export const LINE = [
  { san: 'e4', from: 'e2', to: 'e4', piece: 'P' },
  { san: 'e5', from: 'e7', to: 'e5', piece: 'p' },
  { san: 'Bc4', from: 'f1', to: 'c4', piece: 'B' },
  { san: 'Nc6', from: 'b8', to: 'c6', piece: 'n' },
  { san: 'Qh5', from: 'd1', to: 'h5', piece: 'Q' },
  { san: 'Nf6', from: 'g8', to: 'f6', piece: 'n' },
  { san: 'Qxf7#', from: 'h5', to: 'f7', piece: 'Q' },
];

/** Position after `ply` half-moves (0 = the standard start position). Pure, so
 *  seeking to any ply reproduces the board exactly, captures included. */
export function positionAfter(ply) {
  const board = startPosition();
  const n = Math.max(0, Math.min(LINE.length, ply));
  for (let i = 0; i < n; i++) {
    const m = LINE[i];
    const from = sq(m.from);
    const to = sq(m.to);
    board[to] = board[from];
    board[from] = null;
  }
  return board;
}

/** The half-move at `ply` (1-based) enriched with capture info, or null. */
export function moveAt(ply) {
  if (ply < 1 || ply > LINE.length) return null;
  const before = positionAfter(ply - 1);
  const m = LINE[ply - 1];
  const captured = before[sq(m.to)];
  return {
    ...m,
    ply,
    white: colorOf(m.piece) === 'w',
    captured: captured ? { sq: m.to, piece: captured } : null,
    moveNo: Math.floor((ply - 1) / 2) + 1,
  };
}

export function turnAfter(ply) {
  return ply % 2 === 0 ? 'w' : 'b';
}

// ---------------------------------------------------------------------------
// Self-check. Runs on load; logs nothing unless something is wrong.
// ---------------------------------------------------------------------------

export function verify() {
  const problems = [];
  const claim = (ok, message) => { if (!ok) problems.push(message); };

  // 1. Every supplied half-move is legal and moves the piece its SAN names.
  for (let ply = 1; ply <= LINE.length; ply++) {
    const board = positionAfter(ply - 1);
    const m = LINE[ply - 1];
    const mover = colorOf(m.piece);
    claim(turnAfter(ply - 1) === mover, `ply ${ply}: turn mismatch`);
    claim(board[sq(m.from)] === m.piece, `ply ${ply}: ${m.from} does not hold ${m.piece}`);
    const legal = legalMoves(board, mover).some((x) => x.from === sq(m.from) && x.to === sq(m.to));
    claim(legal, `ply ${ply}: ${m.san} (${m.from}${m.to}) is not a legal move`);
    claim(!inCheck(positionAfter(ply - 1), mover), `ply ${ply}: mover was already in check before ${m.san}`);
  }

  // 2. The capture and the mate.
  const seventh = moveAt(7);
  claim(seventh.san === 'Qxf7#' && seventh.to === 'f7', 'ply 7 is not the capture on f7');
  claim(seventh.captured && seventh.captured.piece === 'p', 'ply 7 does not capture the black f-pawn');
  const final = positionAfter(7);
  claim(status(final, 'b') === 'mate', 'the final position is not checkmate for Black');
  claim(inCheck(final, 'b'), 'Black is not in check in the final position');
  claim(final[sq('f7')] === 'Q' && final[sq('e8')] === 'k', 'final geometry wrong: Qf7 vs ke8');

  // 3. Claims made by the coaching captions.
  //    f7 is defended by the king alone in the start position.
  const start = positionAfter(0);
  const countDefenders = (board, color, target) => {
    let n = 0;
    for (let i = 0; i < 64; i++) {
      if (colorOf(board[i]) === color && typeOf(board[i]) !== 'K' && attacksSquareQuietly(board, i, target)) n++;
    }
    return n;
  };
  claim(!attacked(start, sq('f7'), 'w'), 'f7 already attacked at the start');
  claim(countDefenders(start, 'b', sq('f7')) === 0, 'something other than the king defends f7 at the start');
  claim(attacked(start, sq('f7'), 'b'), 'the king should defend f7 at the start');

  //    After 3.Qh5 the pawn is attacked twice and defended once.
  const afterQh5 = positionAfter(5);
  claim(countDefenders(afterQh5, 'w', sq('f7')) === 2, `f7 should be attacked twice after Qh5, found ${countDefenders(afterQh5, 'w', sq('f7'))}`);

  //    3...Nf6 attacks the white queen but does not add a defender to f7.
  const afterNf6 = positionAfter(6);
  claim(attacked(afterNf6, sq('h5'), 'b'), '3...Nf6 should attack the queen on h5');
  claim(!attacksSquareQuietly(afterNf6, sq('f6'), sq('f7')), 'Nf6 must not cover f7');
  claim(countDefenders(afterNf6, 'b', sq('f7')) === 0, 'f7 should still have no defender but the king after Nf6');

  //    The mate: the queen is protected by the c4 bishop, the king cannot take,
  //    e7 is covered, and d8/f8/d7 are blocked by Black's own pieces.
  claim(attacked(final, sq('f7'), 'w'), 'the queen on f7 is not protected');
  claim(final[sq('c4')] === 'B', 'the protecting bishop is not on c4');
  claim(attacked(final, sq('e7'), 'w'), 'e7 should be covered by White');
  claim(['d8', 'f8', 'd7'].every((s) => colorOf(final[sq(s)]) === 'b'), 'escape squares should be blocked by black pieces');
  const kingFlights = legalMoves(final, 'b').filter((m) => m.from === findKing(final, 'b'));
  claim(kingFlights.length === 0, 'the black king should have no legal move');

  //    A king on f7 would be in check from the bishop, i.e. Kxf7 is illegal.
  const captureTry = final.slice();
  captureTry[sq('e8')] = null;
  captureTry[sq('f7')] = 'k';
  claim(attacked(captureTry, sq('f7'), 'w'), 'Kxf7 must be illegal because of Bc4');

  //    The defensive ideas named in the takeaway are real moves: ...g6 cuts the
  //    queen off from f7, ...Qe7 puts a second defender on f7.
  const before = positionAfter(5);
  for (const [from, to] of [['g7', 'g6'], ['d8', 'e7']]) {
    claim(legalMoves(before, 'b').some((m) => m.from === sq(from) && m.to === sq(to)),
      `takeaway suggestion ${from}${to} is not legal after 3.Qh5`);
  }
  const g6 = before.slice();
  g6[sq('g6')] = g6[sq('g7')];
  g6[sq('g7')] = null;
  claim(!attacksSquareQuietly(g6, sq('h5'), sq('f7')), '...g6 should cut the queen off from f7');
  claim(attacked(g6, sq('h5'), 'b'), '...g6 should hit the queen on h5');
  const qe7 = before.slice();
  qe7[sq('e7')] = qe7[sq('d8')];
  qe7[sq('d8')] = null;
  claim(attacksSquareQuietly(qe7, sq('e7'), sq('f7')), '...Qe7 should defend f7');

  return problems;}

/** Does the piece on `from` attack `target` right now (ignoring pins)? */
function attacksSquareQuietly(board, from, target) {
  const p = board[from];
  if (!p) return false;
  const type = typeOf(p);
  const df = (target & 7) - (from & 7);
  const dr = (target >> 3) - (from >> 3);
  const af = Math.abs(df);
  const ar = Math.abs(dr);
  const clear = (stepF, stepR) => {
    let f = (from & 7) + stepF;
    let r = (from >> 3) + stepR;
    while (f !== (target & 7) || r !== (target >> 3)) {
      if (board[r * 8 + f] !== null) return false;
      f += stepF;
      r += stepR;
    }
    return true;
  };
  if (type === 'P') {
    const dir = isWhite(p) ? 1 : -1;
    return ar === 1 && af === 1 && dr === dir;
  }
  if (type === 'N') return (af === 1 && ar === 2) || (af === 2 && ar === 1);
  if (type === 'K') return af <= 1 && ar <= 1;
  const diagonal = af === ar && af > 0;
  const straight = (df === 0 && ar > 0) || (dr === 0 && af > 0);
  if (type === 'B' && !diagonal) return false;
  if (type === 'R' && !straight) return false;
  if (type === 'Q' && !(diagonal || straight)) return false;
  return clear(Math.sign(df), Math.sign(dr));
}
