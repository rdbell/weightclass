// The supplied, verified line: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
// Segment = one caption beat; a segment may animate one half-move.
// highlight kinds: last (yellow), threat (red), support (green), info (blue)

export const SEGMENTS = [
  {
    caption: "Scholar's Mate — the most famous four-move trap in chess. You are playing Black.",
    dwell: 4200,
  },
  {
    move: { from: 'e2', to: 'e4', piece: 'P' }, san: 'e4', sanFull: '1. e4',
    caption: '1. e4 — White stakes a claim in the center and opens lines for bishop and queen.',
    dwell: 3400,
  },
  {
    caption: 'Your move. Black should meet the center head-on.',
    dwell: 2400,
  },
  {
    move: { from: 'e7', to: 'e5', piece: 'P' }, san: 'e5', sanFull: '1... e5',
    caption: '1... e5 — Black matches White in the center.',
    dwell: 3000,
  },
  {
    move: { from: 'f1', to: 'c4', piece: 'B' }, san: 'Bc4', sanFull: '2. Bc4',
    caption: '2. Bc4 — the bishop develops with a target in mind: the f7 square.',
    arrows: [{ from: 'c4', to: 'f7', color: 'threat' }],
    arrowDelay: 750, dwell: 4000,
  },
  {
    caption: 'f7 is the weakest square in the opening — only the king defends it.',
    arrows: [{ from: 'c4', to: 'f7', color: 'threat' }],
    highlights: [{ sq: 'f7', kind: 'threat' }],
    dwell: 4000,
  },
  {
    move: { from: 'b8', to: 'c6', piece: 'N' }, san: 'Nc6', sanFull: '2... Nc6',
    caption: '2... Nc6 — Black develops and defends e5, but ignores the bishop.',
    dwell: 3300,
  },
  {
    move: { from: 'd1', to: 'h5', piece: 'Q' }, san: 'Qh5', sanFull: '3. Qh5',
    caption: '3. Qh5 — the queen joins the bishop in attacking f7.',
    arrows: [{ from: 'h5', to: 'f7', color: 'threat' }],
    arrowDelay: 750, dwell: 3800,
  },
  {
    caption: 'Two attackers against one defender — f7 is fatally overloaded.',
    arrows: [
      { from: 'c4', to: 'f7', color: 'threat' },
      { from: 'h5', to: 'f7', color: 'threat' },
    ],
    highlights: [{ sq: 'f7', kind: 'threat' }],
    dwell: 4400,
  },
  {
    caption: 'This is the moment to notice the danger and defend f7.',
    dwell: 3000,
  },
  {
    move: { from: 'g8', to: 'f6', piece: 'N' }, san: 'Nf6', sanFull: '3... Nf6',
    caption: '3... Nf6? — looks active, but it leaves f7 completely unguarded.',
    arrows: [
      { from: 'c4', to: 'f7', color: 'threat' },
      { from: 'h5', to: 'f7', color: 'threat' },
    ],
    dwell: 3600,
  },
  {
    caption: "Nf6 even attacks the queen — but it's too late: White mates first.",
    arrows: [
      { from: 'c4', to: 'f7', color: 'threat' },
      { from: 'h5', to: 'f7', color: 'threat' },
    ],
    dwell: 3400,
  },
  {
    move: { from: 'h5', to: 'f7', piece: 'Q', capture: true }, san: 'Qxf7#', sanFull: '4. Qxf7#', mate: true,
    caption: "4. Qxf7# — the queen takes f7 with the bishop's full support.",
    arrows: [{ from: 'c4', to: 'f7', color: 'support' }],
    arrowDelay: 800, dwell: 4600,
  },
  {
    caption: 'Kxf7 is illegal — the bishop on c4 guards the queen.',
    arrows: [{ from: 'c4', to: 'f7', color: 'threat' }],
    highlights: [{ sq: 'f7', kind: 'threat' }],
    dwell: 4400,
  },
  {
    caption: "No escape: e7 is covered by the queen, and d8 and f8 are blocked by Black's own pieces.",
    highlights: [
      { sq: 'e8', kind: 'threat' },
      { sq: 'e7', kind: 'threat' },
      { sq: 'd8', kind: 'info' },
      { sq: 'f8', kind: 'info' },
    ],
    dwell: 4400,
  },
  {
    caption: 'Nothing can capture the queen, and no square is safe — checkmate in four moves.',
    dwell: 3600,
  },
  {
    caption: "Scholar's Mate is a trap, not a forced win — it only works against unprepared play.",
    badge: false, dwell: 3800,
  },
  {
    caption: 'Every move, ask: “What does this threaten?” — f7 was under fire from move two.',
    badge: false, dwell: 4000,
  },
  {
    caption: 'Defend f7 early — with a pawn or the queen — and develop a new piece every move.',
    badge: false, dwell: 4000,
  },
  {
    caption: "Takeaway: develop, protect f7, and check your opponent's threats before chasing the queen.",
    badge: false, dwell: 4800,
  },
  {
    caption: 'Lesson complete — replay to watch it again, or click any move to jump.',
    badge: false, dwell: 7000, end: true,
  },
];
