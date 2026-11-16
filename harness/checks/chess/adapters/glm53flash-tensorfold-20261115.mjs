// GLM-5.3-Flash on TensorFold 1.2.8, 20261115T190659Z: the hook used for its
// 2026-11-15 interactive check. It reads the displayed logical position and
// requires every piece mesh to be visible on its square.
export default {
  name: 'glm53flash-tensorfold-20261115',
  hook: { file: 'lesson.js', code: `
globalThis.__v = {
  playing: () => playing,
  cur: () => cur,
  expected: () => STEPS.map(s => s.kind === 'move' ? s.mi + 1 : s.movesApplied),
  board: () => {
    const o = {}; let meshes_ok = true;
    for (const [sq, p] of Object.entries(displayedState || {})) {
      o[sq] = p.color === 'w' ? p.type.toUpperCase() : p.type;
      const m = pieceViews.get(p.id), want = posOf(sq);
      if (!m || !m.visible || Math.abs(m.position.x - want.x) > 1e-3 || Math.abs(m.position.y - want.y) > 1e-3) meshes_ok = false;
    }
    const visible = [...pieceViews.values()].filter(m => m.visible).length;
    return { o, on_squares: meshes_ok && visible === Object.keys(o).length };
  },
};` },
  ready: '() => !!globalThis.__v',
  board: '() => __v.board()',
  playing: '() => __v.playing()',
  step: '() => __v.cur()',
  expectedPly: '() => __v.expected()',
  moveCells: '#moveList button.chip',
  play: '#btnPlay', prev: '#btnPrev', replay: '#btnReplay',
};
