// Sage-S2.1-Flash oQ4e (our build) on oMLX, 20261117T030423Z: the lesson
// exposes window.__lesson (steps, state) and window.__pieces() (every piece
// mesh's position, type, colour and opacity); no hook. Black's side:
// x = 3.5 - file, y = 3.5 - rank (lesson.js px/py).
export default {
  name: 'sage21flash-omlx-20261117',
  ready: '() => !!(window.__lesson && window.__pieces)',
  board: `() => {
    const o = {}; let on_squares = true;
    for (const p of window.__pieces()) {
      if (p.op < 0.5) continue;
      const f = 3.5 - p.x, r = 3.5 - p.y, F = Math.round(f), R = Math.round(r);
      if (Math.abs(f - F) > 1e-3 || Math.abs(r - R) > 1e-3 || F < 0 || F > 7 || R < 0 || R > 7) { on_squares = false; continue; }
      const sq = 'abcdefgh'[F] + (R + 1); if (o[sq]) on_squares = false;
      o[sq] = p.c === 'w' ? p.t.toUpperCase() : p.t.toLowerCase();
    }
    return { o, on_squares };
  }`,
  playing: '() => window.__lesson.state.playing',
  step: '() => window.__lesson.state.step',
  finished: '() => window.__lesson.state.ended',
  expectedPly: '() => window.__lesson.steps.map(s => s.ply)',
  moveCells: '#moves .mcell:not(.empty)',
  play: '#play', prev: '#prev', replay: '#replay',
};
