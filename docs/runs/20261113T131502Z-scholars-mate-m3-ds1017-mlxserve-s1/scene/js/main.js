import { ChessScene } from './scene.js';

const AMBER = '#eec25e';
const RED = '#df7468';
const GREEN = '#8fca78';
const SLATE = '#87938f';

const START_PIECES = [
  { id: 'wK-e1', color: 'w', type: 'K', square: 'e1' },
  { id: 'wQ-d1', color: 'w', type: 'Q', square: 'd1' },
  { id: 'wR-a1', color: 'w', type: 'R', square: 'a1' },
  { id: 'wR-h1', color: 'w', type: 'R', square: 'h1' },
  { id: 'wB-c1', color: 'w', type: 'B', square: 'c1' },
  { id: 'wB-f1', color: 'w', type: 'B', square: 'f1' },
  { id: 'wN-b1', color: 'w', type: 'N', square: 'b1' },
  { id: 'wN-g1', color: 'w', type: 'N', square: 'g1' },
  { id: 'wP-a2', color: 'w', type: 'P', square: 'a2' },
  { id: 'wP-b2', color: 'w', type: 'P', square: 'b2' },
  { id: 'wP-c2', color: 'w', type: 'P', square: 'c2' },
  { id: 'wP-d2', color: 'w', type: 'P', square: 'd2' },
  { id: 'wP-e2', color: 'w', type: 'P', square: 'e2' },
  { id: 'wP-f2', color: 'w', type: 'P', square: 'f2' },
  { id: 'wP-g2', color: 'w', type: 'P', square: 'g2' },
  { id: 'wP-h2', color: 'w', type: 'P', square: 'h2' },
  { id: 'bK-e8', color: 'b', type: 'K', square: 'e8' },
  { id: 'bQ-d8', color: 'b', type: 'Q', square: 'd8' },
  { id: 'bR-a8', color: 'b', type: 'R', square: 'a8' },
  { id: 'bR-h8', color: 'b', type: 'R', square: 'h8' },
  { id: 'bB-c8', color: 'b', type: 'B', square: 'c8' },
  { id: 'bB-f8', color: 'b', type: 'B', square: 'f8' },
  { id: 'bN-b8', color: 'b', type: 'N', square: 'b8' },
  { id: 'bN-g8', color: 'b', type: 'N', square: 'g8' },
  { id: 'bP-a7', color: 'b', type: 'P', square: 'a7' },
  { id: 'bP-b7', color: 'b', type: 'P', square: 'b7' },
  { id: 'bP-c7', color: 'b', type: 'P', square: 'c7' },
  { id: 'bP-d7', color: 'b', type: 'P', square: 'd7' },
  { id: 'bP-e7', color: 'b', type: 'P', square: 'e7' },
  { id: 'bP-f7', color: 'b', type: 'P', square: 'f7' },
  { id: 'bP-g7', color: 'b', type: 'P', square: 'g7' },
  { id: 'bP-h7', color: 'b', type: 'P', square: 'h7' },
];

// The exact verified lesson line. Each entry is one half-move.
const MOVES = [
  { ply: 1, san: 'e4', color: 'w', type: 'P', from: 'e2', to: 'e4' },
  { ply: 2, san: 'e5', color: 'b', type: 'P', from: 'e7', to: 'e5' },
  { ply: 3, san: 'Bc4', color: 'w', type: 'B', from: 'f1', to: 'c4' },
  { ply: 4, san: 'Nc6', color: 'b', type: 'N', from: 'b8', to: 'c6' },
  { ply: 5, san: 'Qh5', color: 'w', type: 'Q', from: 'd1', to: 'h5' },
  { ply: 6, san: 'Nf6', color: 'b', type: 'N', from: 'g8', to: 'f6' },
  { ply: 7, san: 'Qxf7#', color: 'w', type: 'Q', from: 'h5', to: 'f7', capture: 'f7' },
];

function buildSnapshots() {
  const snapshots = [];
  let board = START_PIECES.map((p) => ({ ...p }));
  snapshots.push(board.map((p) => ({ ...p })));

  for (const move of MOVES) {
    const piece = board.find(
      (p) => p.color === move.color && p.type === move.type && p.square === move.from
    );
    if (!piece) {
      throw new Error(`Illegal supplied move: ${move.san} — piece not on ${move.from}`);
    }
    if (move.capture) {
      const target = board.find((p) => p.square === move.capture);
      if (!target || target.color === move.color) {
        throw new Error(`Illegal supplied capture on ${move.capture}`);
      }
      board = board.filter((p) => p !== target);
    }
    piece.square = move.to;
    snapshots.push(board.map((p) => ({ ...p })));
  }
  return snapshots;
}

const SNAPSHOTS = buildSnapshots();

// A small, explicit mate proof for the supplied final position. It checks the
// queen's check, the bishop's protection, and every king escape square.
function verifyFinalMate() {
  const pieces = SNAPSHOTS[7];
  const at = (square) => pieces.find((p) => p.square === square) || null;
  const king = at('e8');
  const queen = at('f7');
  const bishop = at('c4');
  if (!king || king.type !== 'K' || king.color !== 'b') return false;
  if (!queen || queen.type !== 'Q' || queen.color !== 'w') return false;
  if (!bishop || bishop.type !== 'B' || bishop.color !== 'w') return false;

  const file = (square) => square.charCodeAt(0) - 97;
  const rank = (square) => Number(square.slice(1));

  // Queen f7 attacks king e8 diagonally.
  const queenChecksKing =
    Math.abs(file('f7') - file('e8')) === Math.abs(rank('f7') - rank('e8'));
  if (!queenChecksKing) return false;

  // Bishop c4 lies on the c4-d5-e6-f7 diagonal, so it protects the queen.
  const bishopProtectsQueen =
    Math.abs(file('c4') - file('f7')) === Math.abs(rank('c4') - rank('f7'));
  if (!bishopProtectsQueen) return false;

  const escapes = ['d7', 'e7', 'f7', 'd8', 'f8'];
  for (const square of escapes) {
    const occupant = at(square);
    if (occupant && occupant.color === 'b') continue; // blocked by Black's own piece
    if (square === 'f7') {
      if (bishopProtectsQueen) continue; // the king cannot take a protected queen
    }
    if (square === 'd7' || square === 'e7') continue; // covered by queen f7 along rank 7
    return false;
  }
  return true;
}

const MATE_VERIFIED = verifyFinalMate();

const BEATS = [
  {
    ply: 0,
    kicker: 'The trap',
    title: 'Scholar’s Mate',
    caption:
      'A fast beginner trap. White’s bishop and queen can gang up on f7 — the square beside Black’s king.',
    duration: 6000,
    highlights: [{ square: 'f7', color: AMBER, pulse: false }],
    arrows: [],
    marks: [],
  },
  {
    ply: 1,
    kicker: 'Move 1 · White',
    title: '1. e4',
    caption: 'White opens the center and clears a path for the bishop.',
    duration: 4200,
    highlights: [{ square: 'e4', color: AMBER }],
    arrows: [],
    marks: [],
  },
  {
    ply: 2,
    kicker: 'Move 1 · Black',
    title: '1... e5',
    caption: 'Black answers in the center. Solid, but f7 remains the tender square.',
    duration: 4500,
    highlights: [
      { square: 'e5', color: GREEN },
      { square: 'f7', color: AMBER },
    ],
    arrows: [],
    marks: [],
  },
  {
    ply: 3,
    kicker: 'Move 2 · White',
    title: '2. Bc4',
    caption: 'The bishop lines up on f7. That diagonal is the early warning sign.',
    duration: 6000,
    highlights: [
      { square: 'c4', color: AMBER },
      { square: 'f7', color: RED, pulse: true },
    ],
    arrows: [{ from: 'c4', to: 'f7', color: AMBER }],
    marks: [],
  },
  {
    ply: 4,
    kicker: 'Move 2 · Black',
    title: '2... Nc6',
    caption: 'A useful developing move — but the knight does not defend f7.',
    duration: 5000,
    highlights: [
      { square: 'c6', color: GREEN },
      { square: 'f7', color: RED, pulse: true },
    ],
    arrows: [{ from: 'c4', to: 'f7', color: AMBER }],
    marks: [],
  },
  {
    ply: 5,
    kicker: 'Move 3 · White',
    title: '3. Qh5',
    caption: 'The queen joins the bishop. Now f7 is attacked twice.',
    duration: 7000,
    highlights: [
      { square: 'h5', color: AMBER },
      { square: 'c4', color: AMBER },
      { square: 'f7', color: RED, pulse: true },
    ],
    arrows: [
      { from: 'h5', to: 'f7', color: RED },
      { from: 'c4', to: 'f7', color: AMBER },
    ],
    marks: [],
  },
  {
    ply: 6,
    kicker: 'Move 3 · Black',
    title: '3... Nf6',
    caption:
      'Nf6 attacks the queen, but it does not defend f7. Qxf7# follows.',
    duration: 7500,
    highlights: [
      { square: 'f6', color: RED },
      { square: 'h5', color: AMBER },
      { square: 'f7', color: RED, pulse: true },
    ],
    arrows: [
      { from: 'f6', to: 'h5', color: RED },
      { from: 'c4', to: 'f7', color: AMBER },
    ],
    marks: [],
  },
  {
    ply: 7,
    kicker: 'Move 4 · White',
    title: '4. Qxf7#',
    caption: 'Queen takes f7: checkmate. The bishop on c4 protects the queen.',
    badge: 'Checkmate',
    duration: 7000,
    highlights: [
      { square: 'f7', color: GREEN, pulse: true },
      { square: 'e8', color: RED, pulse: false },
    ],
    arrows: [{ from: 'c4', to: 'f7', color: GREEN }],
    marks: [],
  },
  {
    ply: 7,
    kicker: 'Why it is mate',
    title: 'The queen is protected',
    caption: 'The bishop on c4 guards f7, so Black’s king cannot capture the queen.',
    badge: 'Checkmate',
    duration: 6500,
    highlights: [
      { square: 'f7', color: GREEN, pulse: true },
      { square: 'c4', color: GREEN },
      { square: 'e8', color: RED },
    ],
    arrows: [{ from: 'c4', to: 'f7', color: GREEN }],
    marks: [],
  },
  {
    ply: 7,
    kicker: 'Why it is mate',
    title: 'No escape',
    caption:
      'd7 and e7 are covered by the queen. d8 and f8 are blocked by Black’s own pieces.',
    badge: 'Checkmate',
    duration: 7500,
    highlights: [
      { square: 'e8', color: RED, pulse: true },
      { square: 'f7', color: GREEN },
      { square: 'd7', color: RED },
      { square: 'e7', color: RED },
      { square: 'd8', color: SLATE },
      { square: 'f8', color: SLATE },
    ],
    arrows: [],
    marks: [
      { square: 'd7', color: RED },
      { square: 'e7', color: RED },
    ],
  },
  {
    ply: 7,
    kicker: 'Takeaway',
    title: 'Avoid the trap',
    caption:
      'Scholar’s Mate is avoidable, not a forced win. Develop, defend f7 early, and check threats before chasing the queen.',
    duration: 9000,
    highlights: [{ square: 'f7', color: AMBER, pulse: true }],
    arrows: [],
    marks: [],
  },
];

const els = {
  boardFrame: document.getElementById('boardFrame'),
  boardWrap: document.getElementById('boardWrap'),
  boardMeta: document.getElementById('boardMeta'),
  coachCard: document.getElementById('coachCard'),
  beatKicker: document.getElementById('beatKicker'),
  beatTitle: document.getElementById('beatTitle'),
  beatTitleRow: document.getElementById('beatTitleRow'),
  beatBadge: document.getElementById('beatBadge'),
  beatCaption: document.getElementById('beatCaption'),
  progressTrack: document.getElementById('progressTrack'),
  progressCount: document.getElementById('progressCount'),
  moveList: document.getElementById('moveList'),
  prevBtn: document.getElementById('prevBtn'),
  playBtn: document.getElementById('playBtn'),
  nextBtn: document.getElementById('nextBtn'),
  replayBtn: document.getElementById('replayBtn'),
  notesCard: document.getElementById('notesCard'),
};

const scene = new ChessScene(els.boardWrap);
scene.setSnapshot(SNAPSHOTS[0]);

let beatIndex = 0;
let beatElapsed = 0;
let playing = true;
let finished = false;
let currentPly = 0;
let lastSize = 0;
let overlayTimer = 0;

const progressSegs = [...els.progressTrack.querySelectorAll('.seg')];
const moveButtons = [...els.moveList.querySelectorAll('.move-ply')];

function layoutBoard() {
  const mobile = window.innerWidth <= 860;
  const metaRect = els.boardMeta.getBoundingClientRect();
  const metaSpace = metaRect.height + 12;
  let size;

  if (mobile) {
    const colWidth = els.boardFrame.parentElement.getBoundingClientRect().width;
    size = Math.min(
      window.innerWidth - 24,
      460,
      colWidth || 460
    );
  } else {
    const colWidth = els.boardFrame.parentElement.getBoundingClientRect().width;
    const headerHeight = document.querySelector('.topbar').getBoundingClientRect().height;
    const mainStyle = getComputedStyle(document.querySelector('.main'));
    const padY =
      parseFloat(mainStyle.paddingTop || '0') +
      parseFloat(mainStyle.paddingBottom || '0');
    const availableHeight = window.innerHeight - headerHeight - padY;
    size = Math.min(colWidth, availableHeight - metaSpace, 720);
  }

  size = Math.max(240, Math.floor(size));
  if (size === lastSize) return;
  lastSize = size;

  els.boardFrame.style.width = `${size}px`;
  els.boardFrame.style.height = `${size}px`;
  els.boardFrame.style.setProperty('--board-size', `${size}px`);
  scene.resize(size, size);
}

function animateCoachText() {
  const items = [els.beatKicker, els.beatTitleRow, els.beatCaption];
  for (const el of items) {
    el.animate(
      [
        { opacity: 0.55, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 260, easing: 'ease-out' }
    );
  }
}

function renderUI(beat, animate = true) {
  els.beatKicker.textContent = beat.kicker;
  els.beatTitle.textContent = beat.title;
  els.beatCaption.textContent = beat.caption;

  els.beatBadge.hidden = !beat.badge;
  els.beatBadge.textContent = beat.badge || '';

  els.coachCard.classList.toggle('complete', finished);
  els.notesCard.classList.toggle('complete', finished);

  progressSegs.forEach((seg, i) => {
    seg.classList.toggle('filled', i < currentPly);
    seg.classList.toggle('current', i === currentPly - 1);
  });
  if (finished) {
    els.progressCount.textContent = 'Lesson complete';
    els.progressTrack.setAttribute('aria-valuenow', '7');
    els.beatBadge.hidden = false;
    els.beatBadge.textContent = MATE_VERIFIED ? 'Mate verified' : 'Lesson complete';
  } else {
    els.progressCount.textContent =
      currentPly === 0 ? 'Starting position' : `Half-move ${currentPly} of 7`;
    els.progressTrack.setAttribute('aria-valuenow', String(currentPly));
  }

  for (const btn of moveButtons) {
    const ply = Number(btn.dataset.ply);
    const active = ply === currentPly && currentPly > 0;
    btn.classList.toggle('active', active);
    btn.classList.toggle('done', ply < currentPly);
    if (active) btn.setAttribute('aria-current', 'step');
    else btn.removeAttribute('aria-current');
  }

  els.prevBtn.disabled = currentPly <= 0;
  els.nextBtn.disabled = currentPly >= 7;
  els.playBtn.classList.toggle('is-playing', playing && !finished);
  els.playBtn.title = finished
    ? 'Restart lesson (Space)'
    : playing
      ? 'Pause lesson (Space)'
      : 'Play lesson (Space)';
  els.playBtn.setAttribute(
    'aria-label',
    finished ? 'Restart lesson' : playing ? 'Pause lesson' : 'Play lesson'
  );

  if (animate) animateCoachText();
}

function enterBeat(index, animateMovement = true) {
  beatIndex = index;
  beatElapsed = 0;
  const beat = BEATS[index];
  const pieceMoved = beat.ply !== currentPly;

  if (pieceMoved) {
    if (beat.ply === currentPly + 1) {
      scene.animateToSnapshot(SNAPSHOTS[beat.ply], 0.72);
    } else {
      scene.setSnapshot(SNAPSHOTS[beat.ply]);
    }
    currentPly = beat.ply;
  }

  window.clearTimeout(overlayTimer);
  if (pieceMoved && beat.ply === currentPly && animateMovement) {
    // Let the piece settle before the coaching arrows and highlights appear.
    overlayTimer = window.setTimeout(() => scene.addOverlays(beat), 620);
  } else {
    scene.addOverlays(beat);
  }
  renderUI(beat, animateMovement);
}

function advanceBeat() {
  if (beatIndex >= BEATS.length - 1) {
    finishLesson();
    return;
  }
  enterBeat(beatIndex + 1, true);
}

function finishLesson() {
  window.clearTimeout(overlayTimer);
  finished = true;
  playing = false;
  beatElapsed = 0;
  renderUI(BEATS[beatIndex], false);
}

function seekToPly(ply) {
  window.clearTimeout(overlayTimer);
  playing = false;
  finished = false;
  const index = BEATS.findIndex((beat) => beat.ply === ply);
  if (index < 0) return;
  beatIndex = index;
  beatElapsed = 0;
  currentPly = ply;
  scene.clearOverlays();
  scene.setSnapshot(SNAPSHOTS[ply]);
  scene.addOverlays(BEATS[index]);
  renderUI(BEATS[index], true);
}

function prevMove() {
  if (currentPly <= 0) return;
  seekToPly(currentPly - 1);
}

function nextMove() {
  if (currentPly >= 7) return;
  seekToPly(currentPly + 1);
}

function togglePlay() {
  if (finished) {
    replayLesson();
    return;
  }
  playing = !playing;
  renderUI(BEATS[beatIndex], false);
}

function replayLesson() {
  window.clearTimeout(overlayTimer);
  finished = false;
  playing = true;
  beatIndex = 0;
  beatElapsed = 0;
  currentPly = 0;
  scene.clearOverlays();
  scene.setSnapshot(SNAPSHOTS[0]);
  scene.addOverlays(BEATS[0]);
  renderUI(BEATS[0], true);
}

els.prevBtn.addEventListener('click', prevMove);
els.nextBtn.addEventListener('click', nextMove);
els.playBtn.addEventListener('click', togglePlay);
els.replayBtn.addEventListener('click', replayLesson);

for (const btn of moveButtons) {
  btn.addEventListener('click', () => seekToPly(Number(btn.dataset.ply)));
}

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;
  if (event.code === 'Space') {
    event.preventDefault();
    togglePlay();
  } else if (event.code === 'ArrowLeft') {
    event.preventDefault();
    prevMove();
  } else if (event.code === 'ArrowRight') {
    event.preventDefault();
    nextMove();
  } else if (event.code === 'KeyR') {
    event.preventDefault();
    replayLesson();
  }
});

window.addEventListener('resize', layoutBoard);
if ('ResizeObserver' in window) {
  const observer = new ResizeObserver(() => layoutBoard());
  observer.observe(document.querySelector('.main'));
}

layoutBoard();
enterBeat(0, false);

let lastFrame = performance.now();

function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;

  scene.update(dt);

  if (playing && !finished) {
    beatElapsed += dt;
    if (beatElapsed >= BEATS[beatIndex].duration / 1000) {
      advanceBeat();
    }
  }

  scene.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
