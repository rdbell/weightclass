// Wires the board, lesson timeline and UI controls together.
import { Board } from './board.js';
import { Lesson, STEPS, PHASES } from './lesson.js';
import { MOVES, verifyLine } from './chess.js';

// ---------------------------------------------------------------- verify the line
verifyLine();

// ---------------------------------------------------------------- board
const canvas = document.getElementById('board');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const board = new Board(canvas, { reducedMotion: reduced });

// ---------------------------------------------------------------- dom
const $ = (id) => document.getElementById(id);
const capCard = $('captionCard');
const capTag = $('capTag');
const capText = $('capText');
const badge = $('badge');
const badgeText = $('badgeText');
const btnPlay = $('btnPlay');
const btnPrev = $('btnPrev');
const btnNext = $('btnNext');
const btnReplay = $('btnReplay');
const iconPlay = $('iconPlay');
const iconPause = $('iconPause');
const phaseLabel = $('phaseLabel');
const stepCount = $('stepCount');
const bar = $('bar');
const barFill = $('barFill');
const movelist = $('movelist');
const mateStamp = $('mateStamp');

// progress ticks (one per step boundary)
for (let i = 0; i < STEPS.length; i++) {
  const t = document.createElement('div');
  t.className = 'tick';
  t.style.left = (i / (STEPS.length - 1)) * 100 + '%';
  bar.appendChild(t);
}

// move list: 4 rows, white | black
const mlCells = [];
for (let m = 0; m < 4; m++) {
  const row = document.createElement('div');
  row.className = 'ml-row';
  const num = document.createElement('span');
  num.className = 'num';
  num.textContent = m + 1 + '.';
  row.appendChild(num);
  for (const half of [2 * m, 2 * m + 1]) {
    const mv = MOVES[half];
    const btn = document.createElement('button');
    btn.className = 'ml-cell';
    btn.dataset.half = String(half);
    if (mv) {
      const label = mv.san.replace('#', '');
      btn.innerHTML = label + (mv.san.includes('#') ? ' <span class="mate">#</span>' : '');
      btn.title = `Jump to ${mv.san}`;
      // The step showing the position *after* this half-move is step (half+1).
      btn.addEventListener('click', () => lesson.goTo(half + 1));
    } else {
      btn.textContent = '\u2014'; // mated: no reply
      btn.disabled = true;
      btn.style.cursor = 'default';
    }
    row.appendChild(btn);
    mlCells.push(btn);
  }
  movelist.appendChild(row);
}

// ---------------------------------------------------------------- lesson
const lesson = new Lesson({
  board,
  onStep: (s, i) => {
    capTag.textContent = s.tag;
    capText.textContent = s.text;
    capCard.classList.remove('swap');
    void capCard.offsetWidth; // restart the transition
    capCard.classList.add('swap');
    const activeHalf = s.moveIndex > 0 ? s.moveIndex - 1 : -1;
    mlCells.forEach((cell, h) => cell.classList.toggle('active', h === activeHalf));
    phaseLabel.textContent = PHASES[i];
    stepCount.textContent = `Step ${i + 1} of ${STEPS.length}`;
    mateStamp.classList.toggle('show', s.moveIndex === 7);
  },
  onState: (ls) => {
    const playing = ls.playing;
    iconPlay.style.display = playing ? 'none' : '';
    iconPause.style.display = playing ? '' : 'none';
    btnPlay.title = playing ? 'Pause (Space)' : ls.finished ? 'Replay (R)' : 'Play (Space)';
    badge.className = 'badge ' + (playing ? 'playing' : ls.finished ? 'finished' : 'paused');
    badgeText.textContent = playing ? 'Playing' : ls.finished ? 'Finished' : 'Paused';
    btnPrev.disabled = ls.step === 0;
    btnNext.disabled = ls.step === ls.last;
  },
});

// ---------------------------------------------------------------- controls
btnPlay.addEventListener('click', () => lesson.toggle());
btnPrev.addEventListener('click', () => lesson.prev());
btnNext.addEventListener('click', () => lesson.next());
btnReplay.addEventListener('click', () => lesson.replay());

// progress bar: click + drag to seek
let scrubbing = false;
function scrubTo(clientX) {
  const rect = bar.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  lesson.seekFraction(frac);
}
bar.addEventListener('pointerdown', (e) => {
  scrubbing = true;
  bar.setPointerCapture(e.pointerId);
  scrubTo(e.clientX);
});
bar.addEventListener('pointermove', (e) => { if (scrubbing) scrubTo(e.clientX); });
bar.addEventListener('pointerup', () => { scrubbing = false; });
bar.addEventListener('pointercancel', () => { scrubbing = false; });

// keyboard
addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLButtonElement && e.key === ' ') return; // let the button handle it
  if (e.key === ' ') { e.preventDefault(); lesson.toggle(); }
  else if (e.key === 'ArrowRight') lesson.next();
  else if (e.key === 'ArrowLeft') lesson.prev();
  else if (e.key === 'r' || e.key === 'R') lesson.replay();
  else if (e.key === 'Home') lesson.goTo(0);
  else if (e.key === 'End') lesson.goTo(lesson.last);
});

// ---------------------------------------------------------------- resize
const boardWrap = $('boardWrap');
const boardBox = $('boardBox');
const mqMobile = matchMedia('(max-width: 820px)');
function fit() {
  const rect = boardWrap.getBoundingClientRect();
  const size = mqMobile.matches
    ? rect.width
    : Math.min(rect.width, rect.height);
  const px = Math.max(140, Math.floor(size));
  boardBox.style.width = px + 'px';
  boardBox.style.height = px + 'px';
  board.resize(px);
}
new ResizeObserver(fit).observe(boardWrap);
mqMobile.addEventListener?.('change', fit);
fit();

// ---------------------------------------------------------------- loop
let last = performance.now();
let lastRender = performance.now();

function syncUI() {
  barFill.style.width = (lesson.fraction * 100).toFixed(2) + '%';
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  lesson.tick(now);
  board.tick(dt, now);
  lastRender = now;
  syncUI();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Fallback ticker: if rAF is paused/throttled (hidden tab, headless),
// keep the real-time lesson clock and canvas current. In a normal
// 60fps tab this never triggers because rAF renders every ~16ms.
setInterval(() => {
  const now = performance.now();
  if (now - lastRender > 250) {
    lesson.tick(now);
    board.tick(0.25, now);
    lastRender = now;
    syncUI();
  }
}, 120);

// auto-play after a brief settle
setTimeout(() => {
  lesson.playing = true;
  lesson.onState?.(lesson);
}, 700);

// debug/inspection handles
window.__lesson = lesson;
window.__board = board;
