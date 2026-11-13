// script.js — the lesson itself: seven half-moves, thirteen beats.
//
// `ply` is the number of half-moves played, so a beat's position is always
// `positionAfter(ply)` — the same function the controls use for seeking. Several
// beats can share a ply (explaining one position from two angles); the move only
// animates on the first beat that reaches that ply.
//
// arrows  {from,to,color:'attack'|'danger'|'protect'|'black',style:'forbid'?}
// markers pulsing layer: 'target' (the square under discussion) · 'check'
// extra   static marks added on top of the last-move highlight: 'block' | 'guard'

import { LINE } from './game.js';

export const SCRIPT = [
  {
    ply: 0, dur: 9.2,
    kicker: 'The starting position',
    head: 'One square matters: f7',
    body: 'Seen from Black’s side. The pawn on f7 sits in front of the black king and is guarded by the king alone.',
    arrows: [{ from: 'e8', to: 'f7', color: 'protect' }],
    markers: [{ sq: 'f7', kind: 'target' }],
  },
  {
    ply: 1, dur: 3.8,
    kicker: '1. e4',
    head: 'Space, and open lines',
    body: 'White grabs the centre and unblocks the f1 bishop and the d1 queen. Harmless on its own.',
  },
  {
    ply: 2, dur: 3.8,
    kicker: '1… e5',
    head: 'Black answers in kind',
    body: 'Black takes an equal share of the centre and frees the queen and bishop. Nothing to fear yet.',
  },
  {
    ply: 3, dur: 5.4,
    kicker: '2. Bc4',
    head: 'The bishop points at f7',
    body: 'From c4 the bishop looks down the a2–g8 diagonal straight onto f7. One attacker against that lone defender.',
    arrows: [{ from: 'c4', to: 'f7', color: 'attack' }],
    markers: [{ sq: 'f7', kind: 'target' }],
  },
  {
    ply: 4, dur: 4.2,
    kicker: '2… Nc6',
    head: 'Natural — and beside the point',
    body: 'A sensible developing move that does nothing whatsoever for f7. The target has not changed.',
  },
  {
    ply: 5, dur: 5.8,
    kicker: '3. Qh5',
    head: 'Two attackers, one defender',
    body: 'The queen joins the bishop and both aim at f7. Attacked twice, defended once: the threat is Qxf7#.',
    arrows: [
      { from: 'c4', to: 'f7', color: 'attack' },
      { from: 'h5', to: 'f7', color: 'attack' },
    ],
    markers: [{ sq: 'f7', kind: 'target' }],
  },
  {
    ply: 6, dur: 5.0,
    kicker: '3… Nf6?',
    head: 'The move that loses',
    body: 'The knight develops and even attacks the queen on h5. It also ignores f7 completely — and it is White’s move.',
    arrows: [{ from: 'f6', to: 'h5', color: 'black' }],
    markers: [{ sq: 'f7', kind: 'target' }],
  },
  {
    ply: 6, dur: 5.4,
    kicker: 'Why 3… Nf6 fails',
    head: 'A counter-attack, one tempo late',
    body: 'A knight on f6 covers d5, e4 and h5 — never f7. Two white attackers still face one black defender, so the mate lands first.',
    arrows: [
      { from: 'c4', to: 'f7', color: 'attack' },
      { from: 'h5', to: 'f7', color: 'attack' },
      { from: 'e8', to: 'f7', color: 'protect' },
    ],
    markers: [{ sq: 'f7', kind: 'target' }],
  },
  {
    ply: 7, dur: 5.2,
    kicker: '4. Qxf7#',
    head: 'Checkmate',
    body: 'The queen takes the f7 pawn with check. The bishop on c4 guards her, so the king cannot simply take her.',
    arrows: [{ from: 'c4', to: 'f7', color: 'protect' }],
    markers: [{ sq: 'f7', kind: 'check' }, { sq: 'e8', kind: 'check' }],
  },
  {
    ply: 7, dur: 5.6,
    kicker: 'Why Kxf7 is illegal',
    head: 'The queen is protected',
    body: 'f7 is covered by the bishop on c4. Walking onto it would leave the king in check, which no rule allows.',
    arrows: [
      { from: 'c4', to: 'f7', color: 'protect' },
      { from: 'e8', to: 'f7', color: 'danger', style: 'forbid' },
    ],
    markers: [{ sq: 'f7', kind: 'check' }, { sq: 'e8', kind: 'check' }],
  },
  {
    ply: 7, dur: 6.0,
    kicker: 'No escape, no block',
    head: 'Every door is shut',
    body: 'd8, f8 and d7 are blocked by Black’s own pieces, and e7 is covered by the queen. A check this close cannot be blocked.',
    arrows: [{ from: 'f7', to: 'e7', color: 'danger' }],
    markers: [{ sq: 'e8', kind: 'check' }],
    extra: [
      { sq: 'd8', kind: 'block' },
      { sq: 'f8', kind: 'block' },
      { sq: 'd7', kind: 'block' },
    ],
  },
  {
    ply: 7, dur: 5.4,
    kicker: 'The lesson',
    head: 'An avoidable trap, not a forced win',
    body: 'Scholar’s Mate only works when one side stops asking what the opponent is attacking. Play it against decent defence and the early queen becomes a target.',
  },
  {
    ply: 7, dur: 7.4,
    kicker: 'Takeaway',
    head: 'Develop · protect f7 · check threats',
    body: 'Bring pieces out with a purpose, keep a defender on f7, and ask what the last move really threatened. Instead of 3…Nf6, Black had 3…g6 or 3…Qe7 — either takes the mate off the table.',
    markers: [{ sq: 'f7', kind: 'target' }],
    arrows: [{ from: 'c4', to: 'f7', color: 'protect' }],
  },
];

export const MOVE_DUR = 0.62;      // a quiet slide
export const CAPTURE_DUR = 0.8;    // the queen takes the pawn with a bit of drama
export const ARROW_DELAY = 0.3;    // arrows appear after the piece has landed
export const ARROW_DUR = 0.42;
export const MARK_FADE = 0.28;

export const TOTAL = SCRIPT.reduce((s, b) => s + b.dur, 0);

/** Duration of the slide for the beat's move (0 when the beat has no move). */
export function beatMoveDuration(beat) {
  if (beat.movePly == null) return 0;
  return beat.movePly === 7 ? CAPTURE_DUR : MOVE_DUR;
}

// Pre-compute each beat's start time, which ply it introduces, and which
// last-move squares should stay lit while it is on screen.
let acc = 0;
let lastPly = 0;
let lastPair = null;
for (let i = 0; i < SCRIPT.length; i++) {
  const beat = SCRIPT[i];
  beat.index = i;
  beat.start = acc;
  acc += beat.dur;
  beat.movePly = beat.ply > lastPly ? beat.ply : null;
  if (beat.movePly != null) {
    const m = LINE[beat.movePly - 1];
    lastPair = { from: m.from, to: m.to };
  }
  beat.lastPair = lastPair;
  beat.moveDur = beatMoveDuration(beat);
  lastPly = beat.ply;
}

/** Beat index for a global time. */
export function beatAt(time) {
  for (let i = SCRIPT.length - 1; i >= 0; i--) {
    if (time >= SCRIPT[i].start) return i;
  }
  return 0;
}
