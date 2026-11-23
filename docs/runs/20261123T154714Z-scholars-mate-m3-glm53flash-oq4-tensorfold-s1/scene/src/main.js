// Lesson player: pacing, seeking, UI wiring.

import { createBoardScene } from './board.js';
import { SEGMENTS } from './lesson.js';
import { initialBoard, applyMove, flip, inCheck, kingSquare, isCheckmate, verifyLesson } from './engine.js';

const $ = (id) => document.getElementById(id);

const DEBUG_SEG = 0;        // overridden by #seg=N
const DEBUG_PAUSE = false;

// Optional debug/deep-link: index.html#seg=12  /  #seg=12,pause
function urlParams() {
  return new URLSearchParams(location.hash.replace(/^#/, ''));
}
function initialSegment() {
  const n = parseInt(urlParams().get('seg'), 10);
  if (Number.isFinite(n)) return Math.max(0, Math.min(N - 1, n));
  return DEBUG_SEG;
}
function urlFlag(name) { return urlParams().get(name) === '1' || DEBUG_PAUSE; }

// ---- verify the supplied line up front (also logged to console) ----
const verification = verifyLesson(SEGMENTS);
console.log(`[lesson] verified: ${verification.ok ? 'OK' : 'FAILED'}`, verification);
if (!verification.ok) console.error('[lesson] problems:', verification.problems);
$('verifiedNote').textContent = verification.ok
  ? `Supplied line verified · final position ${verification.fen} · Black is checkmated`
  : 'Verification failed — see console';

// ---- scene ----
const scene = createBoardScene($('board'));
const boardFrame = document.querySelector('.board-frame');
const fit = () => scene.resize(boardFrame.clientWidth, boardFrame.clientHeight);
new ResizeObserver(fit).observe(boardFrame);
fit();

// ---- player state ----
const N = SEGMENTS.length;
let lessonTime = 0;            // pausable clock (ms)
let idx = -1;                  // current segment
let segStart = 0, phaseEnd = 0;
let playing = true;
let ended = false;
let position = initialBoard(); // position after all completed moves up to idx
let sideToMove = 'w';
let pendingEvents = [];        // { at, fn }

function rebuildPosition(upto /* inclusive segment index */) {
  position = initialBoard();
  sideToMove = 'w';
  for (let j = 0; j <= upto; j++) {
    const seg = SEGMENTS[j];
    if (seg.move) {
      position = applyMove(position, seg.move.from, seg.move.to);
      sideToMove = flip(sideToMove);
    }
  }
}

function updateCheckRing(seg) {
  const show = inCheck(position, sideToMove) && (!seg || seg.badge !== false);
  scene.setCheckRing(show ? kingSquare(position, sideToMove) : null);
}

// ---- UI: caption ----
function setCaption(seg) {
  const moveEl = $('capMove');
  moveEl.textContent = seg.sanFull || '';
  moveEl.style.display = seg.sanFull ? '' : 'none';
  $('mateBadge').style.display =
    (seg.badge !== false && isCheckmate(position, sideToMove)) ? '' : 'none';
  const textEl = $('capText');
  textEl.textContent = seg.caption;
  textEl.animate(
    [{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }],
    { duration: 260, easing: 'ease-out' }
  );
}

// ---- UI: move list ----
const moveSegIndices = SEGMENTS.map((s, i) => (s.move ? i : -1)).filter((i) => i >= 0);
function buildMoveList() {
  const list = $('moveList');
  list.innerHTML = '';
  for (let p = 0; p < moveSegIndices.length; p += 2) {
    const row = document.createElement('span');
    row.className = 'row-num';
    row.textContent = `${p / 2 + 1}.`;
    list.appendChild(row);
    for (const segIdx of moveSegIndices.slice(p, p + 2)) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.seg = segIdx;
      b.textContent = SEGMENTS[segIdx].san;
      b.addEventListener('click', () => seekTo(segIdx));
      list.appendChild(b);
    }
  }
}
buildMoveList();

function updateMoveList() {
  let lastMoveSeg = -1;
  for (const s of moveSegIndices) if (s <= idx) lastMoveSeg = s;
  for (const b of document.querySelectorAll('.chip')) {
    const s = +b.dataset.seg;
    b.classList.toggle('current', s === lastMoveSeg);
    b.classList.toggle('done', s < lastMoveSeg);
  }
}

function updateProgress() {
  const segDur = Math.max(1, phaseEnd - segStart);
  const frac = Math.max(0, Math.min(1, (lessonTime - segStart) / segDur));
  $('progressFill').style.width = `${((idx + frac) / N) * 100}%`;
}

function updateButtons() {
  $('btnPrev').disabled = idx <= 0;
  $('btnNext').disabled = idx >= N - 1 || ended;
  $('btnPlay').innerHTML = ended
    ? '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6.2 12 10V7a5 5 0 1 1-4.9 6H5a7 7 0 1 0 7-8z"/></svg>'
    : playing
      ? '<svg viewBox="0 0 24 24"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
}

// ---- segment control ----
function applySegmentVisuals(seg, { instant }) {
  const list = seg.move
    ? [{ sq: seg.move.from, kind: 'last' }, { sq: seg.move.to, kind: 'last' }, ...(seg.highlights || [])]
    : (seg.highlights || []);
  scene.setHighlights(list);
  scene.setArrows(seg.arrows || [], {
    t: lessonTime,
    delay: instant ? 0 : (seg.arrowDelay ?? 250),
    instant,
  });
}

function enterSegment(i, { seek = false } = {}) {
  idx = i;
  pendingEvents = [];
  const seg = SEGMENTS[i];

  if (seg.move) {
    if (seek) {
      rebuildPosition(i);
      scene.syncPieces(position);
    } else {
      const dur = scene.animateMove(seg.move, lessonTime);
      position = applyMove(position, seg.move.from, seg.move.to);
      sideToMove = flip(sideToMove);
      pendingEvents.push({ at: lessonTime + dur - 60, fn: () => updateCheckRing(seg) });
      segStart = lessonTime;
      phaseEnd = lessonTime + dur + 150 + seg.dwell;
      applySegmentVisuals(seg, { instant: false });
      setCaption(seg);
      updateMoveList();
      return;
    }
  } else if (seek) {
    rebuildPosition(i);
    scene.syncPieces(position);
  }

  // caption-only segment, or a move segment reached via seek (already applied)
  updateCheckRing(seg);
  segStart = lessonTime;
  phaseEnd = lessonTime + seg.dwell;
  applySegmentVisuals(seg, { instant: seek });
  setCaption(seg);
  updateMoveList();
}

function seekTo(i) {
  i = Math.max(0, Math.min(N - 1, i));
  ended = false;
  enterSegment(i, { seek: true });
  updateButtons();
}

function finish() {
  ended = true;
  playing = false;
  updateButtons();
}

// ---- transport controls ----
$('btnPlay').addEventListener('click', () => {
  if (ended) { seekTo(0); playing = true; }
  else playing = !playing;
  updateButtons();
});
$('btnPrev').addEventListener('click', () => seekTo(idx - 1));
$('btnNext').addEventListener('click', () => seekTo(idx + 1));
$('btnReplay').addEventListener('click', () => { seekTo(0); playing = true; updateButtons(); });

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); $('btnPlay').click(); }
  else if (e.code === 'ArrowLeft') seekTo(idx - 1);
  else if (e.code === 'ArrowRight') seekTo(idx + 1);
  else if (e.code === 'KeyR') { seekTo(0); playing = true; updateButtons(); }
});

// ---- main loop ----
let lastNow = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (playing && !document.hidden) lessonTime += dt * 1000;

  for (let i = pendingEvents.length - 1; i >= 0; i--) {
    if (lessonTime >= pendingEvents[i].at) {
      pendingEvents[i].fn();
      pendingEvents.splice(i, 1);
    }
  }
  scene.step(lessonTime);

  if (playing && lessonTime >= phaseEnd) {
    if (idx < N - 1) enterSegment(idx + 1);
    else finish();
  }

  updateProgress();
  scene.render();
  requestAnimationFrame(frame);
}

enterSegment(initialSegment(), { seek: true });
playing = !urlFlag('pause');
updateButtons();
requestAnimationFrame(frame);
