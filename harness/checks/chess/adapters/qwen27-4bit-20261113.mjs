// Qwen3.8-27B 4-bit, 20261113T184234Z: the lesson exposes window.__board and
// window.__lesson itself; no hook. Black's side: x = 3.5 - file, y = 3.5 - rank.
export default {
  name: 'qwen27-4bit-20261113',
  ready: '() => !!(window.__board && window.__lesson)',
  board: `() => {
    const o = {}; let on_squares = true;
    for (const [, pc] of window.__board.pieces) {
      if (!pc.mesh.visible || pc.mat.opacity < 0.5) continue;
      const f = 3.5 - pc.mesh.position.x, r = 3.5 - pc.mesh.position.y, F = Math.round(f), R = Math.round(r);
      if (Math.abs(f - F) > 1e-3 || Math.abs(r - R) > 1e-3 || F < 0 || F > 7 || R < 0 || R > 7) { on_squares = false; continue; }
      const sq = 'abcdefgh'[F] + (R + 1); if (o[sq]) on_squares = false;
      o[sq] = pc.color === 'w' ? pc.type.toUpperCase() : pc.type.toLowerCase();
    }
    return { o, on_squares };
  }`,
  playing: '() => window.__lesson.playing',
  step: '() => window.__lesson.step',
  finished: '() => window.__lesson.finished',
  expectedPly: '() => window.__lesson.steps.map(s => s.moveIndex)',
  moveCells: '#movelist .ml-cell:not([disabled])',
  play: '#btnPlay', prev: '#btnPrev', replay: '#btnReplay',
};
