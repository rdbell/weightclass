// GLM-5.3-Flash oQ4e on oMLX, 20261113T090341Z: module state read through a
// hook appended to main.js. The board lies in the x-z plane, Black's side:
// x = 3.5 - file, z = rank - 3.5 (main.js center()).
export default {
  name: 'glm53flash-omlx-20261113',
  hook: { file: 'main.js', code: `
globalThis.__v = {
  playing: () => playing,
  step: () => idx,
  expected: () => STEPS.map((s, i) => STEPS.slice(0, i + 1).filter(x => x.move).length),
  board: () => {
    const o = {}; let on_squares = true;
    for (const p of pieces) {
      if (!p.mesh.visible || p.mesh.material.opacity < 0.5) continue;
      const f = 3.5 - p.mesh.position.x, r = p.mesh.position.z + 3.5, F = Math.round(f), R = Math.round(r);
      if (Math.abs(f - F) > 1e-3 || Math.abs(r - R) > 1e-3 || F < 0 || F > 7 || R < 0 || R > 7) { on_squares = false; continue; }
      const sq = 'abcdefgh'[F] + (R + 1); if (o[sq]) on_squares = false;
      o[sq] = p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
    }
    return { o, on_squares };
  },
};` },
  ready: '() => !!globalThis.__v',
  board: '() => __v.board()',
  playing: '() => __v.playing()',
  step: '() => __v.step()',
  expectedPly: '() => __v.expected()',
  moveCells: '#moveList .chip',
  play: '#playBtn', prev: '#prevBtn', replay: '#replayBtn',
};
