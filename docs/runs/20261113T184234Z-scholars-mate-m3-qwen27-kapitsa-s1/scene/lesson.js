// The Scholar's Mate lesson: an 11-step timeline with captions, arrows and
// highlights, plus a small playback engine (auto-play, seek, replay).
import { MOVES, piecesAfter, findPieceAt } from './chess.js';

const GOLD = '#E8B84B';
const RED = '#E85D4F';
const GREEN = '#7CC98B';
const CREAM = '#F2ECDC';
const INK = '#2E2A23';

const H = (square, color, alpha, pulse = 0, delay = 0) => {
  const f = 'abcdefgh'.indexOf(square[0]);
  const r = +square[1] - 1;
  return { f, r, color, alpha, pulse, delay };
};
const A = (from, to, color, { dashed = false, delay = 0, width = 15 } = {}) => ({ from, to, color, dashed, delay, width });

// Last-move tints (chess.com style)
const lastMove = (from, to) => [
  H(from, GOLD, 0.30),
  H(to, GOLD, 0.30),
];

export const STEPS = [
  {
    moveIndex: 0,
    tag: 'Scholar\u2019s Mate',
    text: 'A four-move trap aimed at f7 \u2014 the weakest square in Black\u2019s camp. Watch how White builds the attack.',
    highlights: [H('f7', GOLD, 0.55, 0.5)],
    arrows: [],
    duration: 4.2,
  },
  {
    moveIndex: 1,
    tag: '1. e4',
    text: 'White opens the center and unblocks the c1 bishop \u2014 the first step of the plan.',
    highlights: [...lastMove('e2', 'e4')],
    arrows: [A('e2', 'e4', CREAM)],
    duration: 4.4,
  },
  {
    moveIndex: 2,
    tag: '1\u2026 e5',
    text: 'Black mirrors in the center. The game looks harmless \u2014 the trap is brewing quietly.',
    highlights: [...lastMove('e7', 'e5')],
    arrows: [A('e7', 'e5', INK)],
    duration: 4.2,
  },
  {
    moveIndex: 3,
    tag: '2. Bc4',
    text: 'The bishop swings to c4, aiming at f7. The black king sits right behind that pawn.',
    highlights: [...lastMove('f1', 'c4'), H('f7', RED, 0.5, 0.45, 0.5)],
    arrows: [A('f1', 'c4', CREAM), A('c4', 'f7', RED, { dashed: true, delay: 0.25 })],
    duration: 5.6,
  },
  {
    moveIndex: 4,
    tag: '2\u2026 Nc6',
    text: 'Black develops a knight \u2014 but f7 is still undefended. Only the king guards it.',
    highlights: [...lastMove('b8', 'c6'), H('f7', RED, 0.5, 0.45)],
    arrows: [A('b8', 'c6', INK)],
    duration: 4.6,
  },
  {
    moveIndex: 5,
    tag: '3. Qh5',
    text: 'The queen joins the attack. Bishop and queen now both point at f7.',
    highlights: [...lastMove('d1', 'h5'), H('f7', RED, 0.6, 0.5, 0.5)],
    arrows: [A('d1', 'h5', CREAM), A('h5', 'f7', RED, { dashed: true, delay: 0.25 })],
    duration: 5.8,
  },
  {
    moveIndex: 6,
    tag: '3\u2026 Nf6??',
    text: 'Black develops again, but still doesn\u2019t defend f7. The trap is set.',
    highlights: [...lastMove('g8', 'f6'), H('f7', RED, 0.62, 0.55)],
    arrows: [A('g8', 'f6', INK)],
    duration: 5.2,
  },
  {
    moveIndex: 7,
    tag: '4. Qxf7#',
    text: 'Checkmate! The queen takes on f7 \u2014 the bishop covers her, and the king has nowhere to go.',
    highlights: [...lastMove('h5', 'f7'), H('e8', RED, 0.55, 0.5, 0.6)],
    arrows: [A('h5', 'f7', CREAM), A('c4', 'f7', GOLD, { delay: 0.3, width: 13 })],
    duration: 6.8,
  },
  {
    moveIndex: 7,
    tag: 'Why it\u2019s mate',
    text: 'Kxf7 is illegal: the bishop on c4 covers the queen. d8 is blocked by Black\u2019s own queen, and e7 and f8 are covered or occupied.',
    highlights: [
      H('e8', RED, 0.62, 0.4),
      H('d8', RED, 0.42, 0.3, 0.35),
      H('e7', RED, 0.42, 0.3, 0.5),
      H('f8', RED, 0.42, 0.3, 0.65),
    ],
    arrows: [A('c4', 'f7', GOLD, { width: 13 })],
    duration: 7.8,
  },
  {
    moveIndex: 5, // rewind to the moment of choice: after 3. Qh5
    tag: 'How to avoid it',
    text: 'Rewind to move 3: after 3. Qh5, Black must notice the threat. 3\u2026g6, 3\u2026Qe7 or 3\u2026Be7 all defend f7 and stop the trap.',
    highlights: [...lastMove('d1', 'h5'), H('f7', GREEN, 0.55, 0.4, 0.5)],
    arrows: [
      A('g7', 'g6', GREEN, { dashed: true, delay: 0.15 }),
      A('d8', 'e7', GREEN, { dashed: true, delay: 0.3 }),
      A('f8', 'e7', GREEN, { dashed: true, delay: 0.45 }),
    ],
    duration: 8.2,
  },
  {
    moveIndex: 7,
    tag: 'The takeaway',
    text: 'Develop quickly, protect f7, and always check the opponent\u2019s threats before chasing. Scholar\u2019s Mate is an avoidable trap \u2014 not a forced win.',
    highlights: [H('f7', GOLD, 0.5, 0.4), H('e8', RED, 0.4, 0.3)],
    arrows: [A('c4', 'f7', GOLD, { width: 13 })],
    duration: 8.5,
  },
];

export const PHASES = [
  'Start', '1. e4', '1\u2026 e5', '2. Bc4', '2\u2026 Nc6', '3. Qh5', '3\u2026 Nf6', '4. Qxf7#', 'Checkmate', 'The defense', 'Takeaway',
];

export class Lesson {
  constructor({ board, onStep, onState }) {
    this.board = board;
    this.steps = STEPS;
    this.last = STEPS.length - 1;
    this.step = -1;
    this.time = 0;
    this.playing = false;
    this.finished = false;
    this.lastPieces = piecesAfter(0);
    this.lastMoveIndex = 0;
    this.stepStart = 0;
    this.onStep = onStep;
    this.onState = onState;
    this.goTo(0, { play: false, initial: true });
  }

  // Real-time clock: pacing is wall-clock accurate even if frames drop.
  tick(nowMs) {
    if (!this.playing) return;
    this.time = (nowMs - this.stepStart) / 1000;
    const s = this.steps[this.step];
    if (this.time >= s.duration) {
      if (this.step < this.last) {
        this.goTo(this.step + 1, { play: true });
      } else {
        this.time = s.duration;
        this.playing = false;
        this.finished = true;
        this.onState?.(this);
      }
    }
  }

  goTo(i, { play = this.playing, initial = false } = {}) {
    i = Math.max(0, Math.min(this.last, Math.round(i)));
    const s = this.steps[i];
    this.step = i;
    this.time = 0;
    this.stepStart = performance.now();
    this.finished = false;

    const target = piecesAfter(s.moveIndex);
    let mode = 'seek', movedId = null, capturedId = null;
    if (!initial && s.moveIndex === this.lastMoveIndex + 1) {
      const m = MOVES[s.moveIndex - 1];
      mode = 'move';
      movedId = findPieceAt(this.lastPieces, m.from);
      capturedId = findPieceAt(this.lastPieces, m.to);
    }
    this.board.setState(target, { mode, movedId, capturedId });
    this.lastPieces = target;
    this.lastMoveIndex = s.moveIndex;

    this.board.setHighlights(s.highlights ?? []);
    this.board.setArrows(s.arrows ?? []);

    this.playing = play;
    this.onStep?.(s, i);
    this.onState?.(this);
  }

  next() { if (this.step < this.last) this.goTo(this.step + 1); }
  prev() { if (this.step > 0) this.goTo(this.step - 1); }
  replay() { this.goTo(0, { play: true }); }

  toggle() {
    if (this.finished) { this.replay(); return; }
    this.playing = !this.playing;
    if (this.playing) this.stepStart = performance.now() - this.time * 1000; // resume in place
    this.onState?.(this);
  }

  seekFraction(frac) {
    this.goTo(frac * this.last);
  }

  get fraction() {
    const s = this.steps[this.step];
    const within = Math.min(1, this.time / s.duration);
    return Math.min(1, (this.step + within) / this.last);
  }
}
