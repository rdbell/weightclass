// GLM-5.3-Flash oQ4 on TensorFold 1.3.3, 20261123T154714Z: the hook is
// appended to main.js, which holds the player state (idx, playing, ended,
// SEGMENTS). The piece meshes live in board.js's closure, so the hook reads
// the board as drawn from the scenes the lesson renders: it wraps three.js's
// no-op Object3D.prototype.onBeforeRender, which the renderer calls with the
// scene for every object it draws, to note that scene (it then calls the
// original, so the lesson renders exactly as before; WebGLRenderer.render is
// an instance method and cannot be observed on the prototype). Each visible,
// opaque piece mesh is mapped back to its square by the lesson's own piece
// textures (pieces.js pieceTexture, cached one per type and colour).
// Black's side: x = 3.5 - file, y = 4.5 - rank (board.js sqToWorld).
export default {
  name: 'glm53flash-oq4-tensorfold-20261123',
  hook: { file: 'src/main.js', code: `
import * as __T from 'three';
import { pieceTexture as __pieceTexture } from './pieces.js';
const __byTexture = new Map();
for (const t of 'PNBRQK') for (const c of 'wb') __byTexture.set(__pieceTexture(t, c), c === 'w' ? t : t.toLowerCase());
const __scenes = new Set();
const __onBeforeRender = __T.Object3D.prototype.onBeforeRender;
__T.Object3D.prototype.onBeforeRender = function (renderer, s) { if (s && s.isScene) __scenes.add(s); return __onBeforeRender.apply(this, arguments); };
globalThis.__v = {
  playing: () => playing,
  step: () => idx,
  ended: () => ended,
  expected: () => SEGMENTS.map((s, i) => SEGMENTS.slice(0, i + 1).filter(x => x.move).length),
  board: () => {
    const o = {}; let on_squares = true;
    if (!__scenes.size) return { o, on_squares: false };
    const w = new __T.Vector3();
    for (const sc of __scenes) sc.traverseVisible(m => {
      if (!m.isMesh || !m.material || !__byTexture.has(m.material.map)) return;
      if ((m.material.opacity ?? 1) < 0.5) return;
      m.getWorldPosition(w);
      const f = 3.5 - w.x, r = 4.5 - w.y, F = Math.round(f), R = Math.round(r);
      if (Math.abs(f - F) > 1e-3 || Math.abs(r - R) > 1e-3 || F < 0 || F > 7 || R < 1 || R > 8) { on_squares = false; return; }
      const sq = 'abcdefgh'[F] + R;
      if (o[sq]) on_squares = false;
      o[sq] = __byTexture.get(m.material.map);
    });
    return { o, on_squares };
  },
};` },
  ready: '() => !!globalThis.__v',
  board: '() => __v.board()',
  playing: '() => __v.playing()',
  step: '() => __v.step()',
  finished: '() => __v.ended()',
  expectedPly: '() => __v.expected()',
  moveCells: '#moveList button.chip',
  play: '#btnPlay', prev: '#btnPrev', replay: '#btnReplay',
};
