// Qwen3.8-Flash-Next oQ4e on oMLX, 20261113T095920Z: the lesson exposes
// window.__lesson (state, SCRIPT, three.js scene, layout). Piece meshes carry
// userData.key such as "wP"; board units are pixels, B = 8 * SQ, Black's side:
// x = (7 - file) * SQ + SQ / 2 - B / 2, y = B / 2 - (rank0 * SQ + SQ / 2).
export default {
  name: 'qwenflash-omlx-20261113',
  ready: '() => !!window.__lesson',
  board: `() => {
    const L = window.__lesson, { B, SQ } = L.marksInfo().board;
    const o = {}; let on_squares = true;
    L.three.scene.traverse(m => {
      if (!m.isMesh || !m.visible || !m.userData || !/^[wb][KQRBNP]$/.test(m.userData.key || '')) return;
      if (m.material.opacity < 0.5) return;
      const f = 7 - (m.position.x + B / 2 - SQ / 2) / SQ, r = (B / 2 - m.position.y - SQ / 2) / SQ;
      const F = Math.round(f), R = Math.round(r);
      if (Math.abs(f - F) > 1e-3 || Math.abs(r - R) > 1e-3 || F < 0 || F > 7 || R < 0 || R > 7) { on_squares = false; return; }
      const sq = 'abcdefgh'[F] + (R + 1), k = m.userData.key; if (o[sq]) on_squares = false;
      o[sq] = k[0] === 'w' ? k[1] : k[1].toLowerCase();
    });
    return { o, on_squares };
  }`,
  playing: '() => window.__lesson.state().playing',
  step: '() => window.__lesson.state().beat',
  finished: '() => window.__lesson.state().finished',
  expectedPly: '() => window.__lesson.SCRIPT.map(b => b.ply)',
  moveCells: '#moves button.mv',
  play: '#btn-play', prev: '#btn-prev', replay: '#btn-replay',
};
