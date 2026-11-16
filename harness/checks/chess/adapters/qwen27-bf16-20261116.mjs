// Qwen3.8-27B bf16, 20261116T070223Z: module state read through a hook
// appended to lesson.js. Black's side: x = 3.5 - file, y = 3.5 - rank.
export default {
  name: 'qwen27-bf16-20261116',
  hook: { file: 'lesson.js', code: `
globalThis.__v = {
  playing: () => playing,
  step: () => stepAt(t),
  expected: () => STEPS.map((s, i) => s.from ? s.movesApplied + 1 : s.movesApplied),
  board: () => {
    const kinds = new Map([...labeledAfter(LINE, 0).values()].map(e => [e.id, e.piece]));
    const o = {}; let on_squares = true;
    for (const [id, rec] of pieceMeshes) {
      if (!rec.mesh.visible || rec.mat.opacity < 0.5) continue;
      const f = 3.5 - rec.mesh.position.x, r = 3.5 - rec.mesh.position.y, F = Math.round(f), R = Math.round(r);
      if (Math.abs(f - F) > 1e-3 || Math.abs(r - R) > 1e-3 || F < 0 || F > 7 || R < 0 || R > 7) { on_squares = false; continue; }
      const sq = 'abcdefgh'[F] + (R + 1), p = kinds.get(id); if (o[sq]) on_squares = false;
      o[sq] = p[0] === 'w' ? p[1].toUpperCase() : p[1].toLowerCase();
    }
    return { o, on_squares };
  },
};` },
  ready: '() => !!globalThis.__v',
  board: '() => __v.board()',
  playing: '() => __v.playing()',
  step: '() => __v.step()',
  // A move step is about the position after its move.
  expectedPly: '() => __v.expected()',
  moveCells: '#moveList .ml-cell:not(.empty)',
  play: '#btnPlay', prev: '#btnPrev', replay: '#btnReplay',
};
