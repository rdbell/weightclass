// lesson.js — the verified line, its captions, and the per-step annotation choreography.
// Line: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#  (checkmated — verified)

// Highlight kinds: last | danger | guard | key | blocked
// Arrow colors: gold (move) | danger (attack) | guard (protection)

export const STEPS = [
  {
    tag: "SCHOLAR'S MATE",
    text: "The famous four-move trap. Everything White does aims at one square: f7 — guarded only by Black's king.",
    hold: 4.2,
    highlights: [{ sq: 'f7', kind: 'key', pulse: true }],
  },
  {
    san: '1. e4',
    move: { from: 'e2', to: 'e4', piece: 'P', color: 'w' },
    tag: '1. e4',
    text: "White takes central space and opens lines for the bishop and queen — the two pieces that will attack f7.",
    hold: 3.0,
  },
  {
    san: '1... e5',
    move: { from: 'e7', to: 'e5', piece: 'P', color: 'b' },
    tag: '1... e5',
    text: "Black mirrors in the center. A perfectly good reply — the trouble hasn't started yet.",
    hold: 2.8,
  },
  {
    san: '2. Bc4',
    move: { from: 'f1', to: 'c4', piece: 'B', color: 'w' },
    tag: '2. Bc4',
    text: "Developing — but the bishop's diagonal lands straight on f7, the weakest square in Black's camp.",
    hold: 3.6,
    arrows: [{ from: 'c4', to: 'f7', color: 'danger' }],
    highlights: [{ sq: 'f7', kind: 'danger' }],
  },
  {
    san: '2... Nc6',
    move: { from: 'b8', to: 'c6', piece: 'N', color: 'b' },
    tag: '2... Nc6',
    text: "Natural development — but it ignores the bishop staring at f7. The pawn there is still defended only by the king.",
    hold: 3.2,
    arrows: [{ from: 'c4', to: 'f7', color: 'danger' }],
    highlights: [{ sq: 'f7', kind: 'danger' }],
  },
  {
    san: '3. Qh5',
    move: { from: 'd1', to: 'h5', piece: 'Q', color: 'w' },
    tag: '3. Qh5',
    text: "The queen joins the attack. Two pieces now hit f7 — and 4. Qxf7# is threatened.",
    hold: 3.6,
    arrows: [
      { from: 'h5', to: 'f7', color: 'danger' },
      { from: 'c4', to: 'f7', color: 'danger' },
    ],
    highlights: [{ sq: 'f7', kind: 'danger', pulse: true }],
  },
  {
    san: '3... Nf6??',
    move: { from: 'g8', to: 'f6', piece: 'N', color: 'b' },
    tag: '3... Nf6??',
    text: "Nf6 attacks the queen and develops — but it defends nothing on f7. The mate threat still stands.",
    hold: 3.8,
    arrows: [
      { from: 'g8', to: 'f6', color: 'gold' },
      { from: 'h5', to: 'f7', color: 'danger' },
    ],
    highlights: [{ sq: 'f7', kind: 'danger', pulse: true }],
  },
  {
    san: '4. Qxf7#',
    move: { from: 'h5', to: 'f7', piece: 'Q', color: 'w', capture: 'P' },
    tag: '4. Qxf7#',
    text: "Checkmate. The king would love to capture the queen — but the bishop on c4 protects her.",
    hold: 4.2,
    arrows: [{ from: 'c4', to: 'f7', color: 'guard' }],
    highlights: [{ sq: 'f7', kind: 'danger', pulse: true }],
  },
  {
    tag: 'WHY NOT Kxf7?',
    text: "Capture the queen and the bishop on c4 simply recaptures the king. A protected check cannot be answered by taking.",
    hold: 4.4,
    arrows: [
      { from: 'c4', to: 'f7', color: 'guard' },
      { from: 'e8', to: 'f7', color: 'danger' },
    ],
    highlights: [{ sq: 'f7', kind: 'danger', pulse: true }],
  },
  {
    tag: 'NO ESCAPE',
    text: "e7, d7 and f8 are all covered by the queen — and d8 is blocked by Black's own queen. Nowhere to run.",
    hold: 4.6,
    highlights: [
      { sq: 'e7', kind: 'danger' },
      { sq: 'd7', kind: 'danger' },
      { sq: 'f8', kind: 'danger' },
      { sq: 'd8', kind: 'blocked' },
    ],
  },
  {
    tag: 'NOT FORCED',
    text: "This is a trap, not a forced win: 2...d5, 3...g6 or 3...Qe7 all defend f7 and call the bluff.",
    hold: 4.4,
    highlights: [{ sq: 'f7', kind: 'guard' }],
  },
  {
    tag: 'TAKEAWAY',
    text: "Develop with purpose, guard f7 early — and before chasing a queen, ask: what does my opponent's last move threaten?",
    hold: 7.0,
    highlights: [{ sq: 'f7', kind: 'key', pulse: true }],
  },
];

// move chips: [white SAN, black SAN] per move number
export const PAIRS = [
  ['e4', 'e5'],
  ['Bc4', 'Nc6'],
  ['Qh5', 'Nf6'],
  ['Qxf7#', ''],
];

// which step index each half-move chip corresponds to
export const CHIP_STEPS = [1, 2, 3, 4, 5, 6, 7];