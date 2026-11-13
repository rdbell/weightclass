// Flat, top-down orthographic chess board rendered with three.js.
// Orientation: Black's perspective — files h..a left to right, ranks 1..8 top to bottom.
import * as THREE from 'three';
import { FILES, parse, piecesAfter } from './chess.js';
import { pieceTexture, shadowTexture } from './pieces.js';

const CANVAS = 1280; // board texture size
const PX = 160; // px per square

// logical square (file a=0..h=7, rank 1=0..8=7) -> canvas px (Black perspective)
export const sqPx = (f, r) => ({ x: (7 - f) * PX + PX / 2, y: r * PX + PX / 2 });
// logical square -> world units (board is 8x8, centered on origin)
export const sqWorld = (f, r) => new THREE.Vector3(7 - f - 3.5, 3.5 - r, 0);

// ---------------------------------------------------------------- easing / tweens

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Time-based tweens (absolute clock) so pacing stays correct even if frames drop.
const tweens = new Set();
export function addTween({ dur, delay = 0, ease = (t) => t, update, done, owner }) {
  const tw = {
    start: performance.now() + delay * 1000,
    dur: Math.max(0, dur) * 1000,
    ease, update, done, owner,
  };
  tweens.add(tw);
  if (owner) (owner.tweens ||= []).push(tw);
  return tw;
}
export function killTweens(owner) {
  if (!owner) return;
  for (const tw of owner.tweens || []) tweens.delete(tw);
  owner.tweens = [];
}
export function updateTweens(nowMs) {
  for (const tw of [...tweens]) {
    if (nowMs < tw.start) continue;
    const k = tw.dur > 0 ? Math.min(1, (nowMs - tw.start) / tw.dur) : 1;
    tw.update?.(tw.ease(k), k);
    if (k >= 1) {
      tweens.delete(tw);
      if (tw.owner?.tweens) tw.owner.tweens = tw.owner.tweens.filter((x) => x !== tw);
      tw.done?.();
    }
  }
}

// ---------------------------------------------------------------- board

export class Board {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.reduced = !!opts.reducedMotion;
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-4.35, 4.35, 4.35, -4.35, 0.1, 10);
    this.camera.position.set(0, 0, 5);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.time = 0;

    // board surface (squares + labels baked into one texture)
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ map: this.makeBoardTexture() })
    );
    board.renderOrder = 0;
    this.scene.add(board);

    // arrow layer (redrawn canvas)
    this.arrowCanvas = document.createElement('canvas');
    this.arrowCanvas.width = this.arrowCanvas.height = CANVAS;
    this.arrowCtx = this.arrowCanvas.getContext('2d');
    this.arrowTex = new THREE.CanvasTexture(this.arrowCanvas);
    this.arrowTex.colorSpace = THREE.SRGBColorSpace;
    this.arrowTex.anisotropy = this.maxAniso;
    this.arrowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 8),
      new THREE.MeshBasicMaterial({ map: this.arrowTex, transparent: true, depthWrite: false })
    );
    this.arrowMesh.position.z = 0.02;
    this.arrowMesh.renderOrder = 3;
    this.scene.add(this.arrowMesh);
    this.arrowDefs = [];
    this.arrowT = 1;
    this.arrowStart = 0;

    // highlight pool (one plane per active highlight)
    this.hlGeo = new THREE.PlaneGeometry(1, 1);
    this.hlPool = [];

    // pieces
    this.pieceGeo = new THREE.PlaneGeometry(1.02, 1.02);
    this.shadowGeo = new THREE.PlaneGeometry(0.86, 0.86);
    this.shadowTex = shadowTexture();
    this.pieces = new Map();
    this.buildPieces();
  }

  makeBoardTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = CANVAS;
    const ctx = c.getContext('2d');
    for (let sy = 0; sy < 8; sy++) {
      for (let sx = 0; sx < 8; sx++) {
        const f = 7 - sx, r = sy; // Black's perspective
        ctx.fillStyle = (f + r) % 2 === 0 ? '#769656' : '#EBECD0';
        ctx.fillRect(sx * PX, sy * PX, PX, PX);
      }
    }
    // coordinate labels, drawn in the corners of the edge squares (upright by construction)
    ctx.font = '600 46px -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    for (let sx = 0; sx < 8; sx++) {
      const f = 7 - sx; // bottom row = rank 8, files h..a left to right
      ctx.fillStyle = (f + 7) % 2 === 0 ? '#EBECD0' : '#769656';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(FILES[f], sx * PX + PX - 12, 8 * PX - 10);
    }
    for (let sy = 0; sy < 8; sy++) {
      const r = sy; // left column = file h, ranks 1..8 top to bottom
      ctx.fillStyle = (7 + r) % 2 === 0 ? '#EBECD0' : '#769656';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(String(r + 1), 12, sy * PX + 8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAniso;
    return tex;
  }

  buildPieces() {
    const start = piecesAfter(0);
    for (const pc of start.values()) {
      const mat = new THREE.MeshBasicMaterial({
        map: pieceTexture(pc.type, pc.color, this.maxAniso),
        transparent: true,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.pieceGeo, mat);
      mesh.position.copy(sqWorld(pc.f, pc.r));
      mesh.position.z = 0.06;
      mesh.renderOrder = 10;
      const smat = new THREE.MeshBasicMaterial({
        map: this.shadowTex,
        transparent: true,
        depthWrite: false,
      });
      const shadow = new THREE.Mesh(this.shadowGeo, smat);
      shadow.position.copy(mesh.position);
      shadow.position.z = 0.01;
      shadow.scale.set(1, 0.68, 1);
      shadow.renderOrder = 4;
      this.scene.add(shadow, mesh);
      this.pieces.set(pc.id, {
        id: pc.id, type: pc.type, color: pc.color, f: pc.f, r: pc.r,
        alive: true, mesh, shadow, mat, smat, tweens: [],
      });
    }
  }

  resize(size) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setSize(size, size, false);
  }

  // ------------------------------------------------------------- state

  /**
   * Move all piece meshes to the state described by `target` (a Map id -> piece).
   * mode 'move': animate a single half-move (with lift + capture fade).
   * mode 'seek': tween every changed piece (handles forward/backward jumps,
   *              restoring captures when going backwards).
   */
  setState(target, { mode = 'seek', movedId = null, capturedId = null } = {}) {
    const dur = this.reduced ? 0 : mode === 'move' ? 0.95 : 0.5;
    for (const [id, mine] of this.pieces) {
      const t = target.get(id);
      const tAlive = !!t && !t.dead;
      const wasAlive = mine.alive;
      const tPos = sqWorld(t && tAlive ? t.f : mine.f, t && tAlive ? t.r : mine.r);
      killTweens(mine);
      mine.f = t ? t.f : mine.f;
      mine.r = t ? t.r : mine.r;
      const from = mine.mesh.position.clone();
      const moved = from.distanceTo(tPos) > 0.001;

      if (mode === 'move') {
        if (id === movedId && dur > 0) {
          this.liftMove(mine, from, tPos, dur);
        } else if (id === capturedId && dur > 0) {
          this.captureFade(mine, dur * 0.55, dur * 0.45);
        } else {
          mine.mesh.position.copy(tPos);
          mine.shadow.position.copy(tPos);
          mine.mesh.scale.setScalar(1);
          mine.mat.opacity = 1;
          mine.smat.opacity = 1;
        }
      } else if (dur > 0) {
        if (moved) {
          this.seekMove(mine, from, tPos, dur, wasAlive, tAlive);
        } else if (wasAlive !== tAlive) {
          this.fadeInPlace(mine, tPos, wasAlive ? 1 : 0, tAlive ? 1 : 0, dur * 0.8);
        } else {
          mine.mesh.position.copy(tPos);
          mine.mat.opacity = tAlive ? 1 : 0;
          mine.smat.opacity = tAlive ? 1 : 0;
        }
      } else {
        mine.mesh.position.copy(tPos);
        mine.shadow.position.copy(tPos);
        mine.mat.opacity = tAlive ? 1 : 0;
        mine.smat.opacity = tAlive ? 1 : 0;
        mine.mesh.scale.setScalar(1);
      }
      mine.alive = tAlive;
    }
  }

  liftMove(mine, from, to, dur) {
    addTween({
      dur, ease: easeInOutCubic, owner: mine,
      update: (e) => {
        mine.mesh.position.lerpVectors(from, to, e);
        mine.shadow.position.lerpVectors(from, to, e);
        const s = 1 + 0.09 * Math.sin(Math.PI * e);
        mine.mesh.scale.setScalar(s);
      },
      done: () => {
        mine.mesh.position.copy(to);
        mine.shadow.position.copy(to);
        mine.mesh.scale.setScalar(1);
      },
    });
  }

  captureFade(mine, delay, dur) {
    addTween({
      dur, delay, ease: easeOutCubic, owner: mine,
      update: (e) => {
        mine.mat.opacity = 1 - e;
        mine.smat.opacity = 1 - e;
        mine.mesh.scale.setScalar(1 - 0.5 * e);
      },
      done: () => {
        mine.mat.opacity = 0;
        mine.smat.opacity = 0;
        mine.mesh.scale.setScalar(1);
      },
    });
  }

  seekMove(mine, from, to, dur, fromOp, toOp) {
    addTween({
      dur, ease: easeOutCubic, owner: mine,
      update: (e) => {
        mine.mesh.position.lerpVectors(from, to, e);
        mine.shadow.position.lerpVectors(from, to, e);
        const op = fromOp + (toOp - fromOp) * e;
        mine.mat.opacity = op;
        mine.smat.opacity = op;
        mine.mesh.scale.setScalar(1 + 0.05 * Math.sin(Math.PI * e));
      },
      done: () => {
        mine.mesh.position.copy(to);
        mine.shadow.position.copy(to);
        mine.mat.opacity = toOp;
        mine.smat.opacity = toOp;
        mine.mesh.scale.setScalar(1);
      },
    });
  }

  fadeInPlace(mine, pos, fromOp, toOp, dur) {
    addTween({
      dur, ease: easeOutCubic, owner: mine,
      update: (e) => {
        const op = fromOp + (toOp - fromOp) * e;
        mine.mat.opacity = op;
        mine.smat.opacity = op;
        mine.mesh.scale.setScalar(0.85 + 0.15 * e);
      },
      done: () => {
        mine.mat.opacity = toOp;
        mine.smat.opacity = toOp;
        mine.mesh.scale.setScalar(1);
      },
    });
  }

  // ------------------------------------------------------------- highlights

  makeHl() {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    });
    const plane = new THREE.Mesh(this.hlGeo, mat);
    plane.position.z = 0.015;
    plane.renderOrder = 2;
    this.scene.add(plane);
    return { plane, mat, def: null, fade: 0, phase: 0, tw: null };
  }

  /** defs: [{ f, r, color, alpha, pulse?, delay? }] */
  setHighlights(defs) {
    while (this.hlPool.length < defs.length) this.hlPool.push(this.makeHl());
    for (let i = 0; i < this.hlPool.length; i++) {
      const hl = this.hlPool[i];
      if (hl.tw) { tweens.delete(hl.tw); hl.tw = null; }
      if (i < defs.length) {
        const d = defs[i];
        if (!hl.def || hl.def.f !== d.f || hl.def.r !== d.r || hl.def.color !== d.color) {
          hl.plane.position.copy(sqWorld(d.f, d.r));
          hl.mat.color.set(d.color);
        }
        hl.def = d;
        hl.phase = i * 1.9;
        hl.fade = 0;
        hl.tw = addTween({
          dur: 0.5, delay: d.delay ?? 0, ease: easeOutCubic,
          update: (e) => { hl.fade = e; },
        });
      } else {
        hl.def = null; // decays in tick()
      }
    }
  }

  // ------------------------------------------------------------- arrows

  /** defs: [{ from, to, color, dashed?, delay?, width? }] (square names) */
  setArrows(defs) {
    this.arrowDefs = defs.map((d) => ({ ...d }));
    this.arrowStart = performance.now();
    this.arrowT = 0;
    this.redrawArrows();
  }

  redrawArrows() {
    const ctx = this.arrowCtx;
    ctx.clearRect(0, 0, CANVAS, CANVAS);
    for (const a of this.arrowDefs) {
      const p = clamp01((this.arrowT - (a.delay ?? 0)) / 0.5);
      if (p <= 0) continue;
      const a1 = parse(a.from), a2 = parse(a.to);
      this.drawArrow(ctx, sqPx(a1.f, a1.r), sqPx(a2.f, a2.r), a, p);
    }
    this.arrowTex.needsUpdate = true;
  }

  drawArrow(ctx, s, e, a, p) {
    const dx = e.x - s.x, dy = e.y - s.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    const ux = dx / len, uy = dy / len;
    const start = 0.36; // start a bit inside the origin square
    const sx = s.x + dx * start, sy = s.y + dy * start;
    const tipX = s.x + dx * (start + (1 - start) * p);
    const tipY = s.y + dy * (start + (1 - start) * p);
    const headLen = Math.min(44, len * 0.45) * Math.min(1, Math.max(0, (p - 0.55) / 0.45));
    const w = a.width ?? 15;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // contrast edge
    ctx.strokeStyle = 'rgba(20, 16, 8, 0.42)';
    ctx.lineWidth = w + 8;
    ctx.setLineDash(a.dashed ? [22, 18] : []);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tipX - ux * headLen, tipY - uy * headLen);
    ctx.stroke();
    // core
    ctx.strokeStyle = a.color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(tipX - ux * headLen, tipY - uy * headLen);
    ctx.stroke();
    ctx.setLineDash([]);
    // head
    if (headLen > 1) {
      const hw = headLen * 0.62;
      const px = -uy, py = ux;
      ctx.fillStyle = a.color;
      ctx.strokeStyle = 'rgba(20, 16, 8, 0.42)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX - ux * headLen + px * hw, tipY - uy * headLen + py * hw);
      ctx.lineTo(tipX - ux * headLen - px * hw, tipY - uy * headLen - py * hw);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
  }

  // ------------------------------------------------------------- frame

  tick(dt, nowMs) {
    this.time += dt;
    updateTweens(nowMs);
    // highlights: smooth toward target (with pulse)
    for (const hl of this.hlPool) {
      if (!hl.def) {
        if (hl.mat.opacity > 0.002) hl.mat.opacity = Math.max(0, hl.mat.opacity - dt * 2.2);
        continue;
      }
      const d = hl.def;
      const pulse = this.reduced || !d.pulse
        ? 1
        : 1 - d.pulse + d.pulse * (0.5 + 0.5 * Math.sin(this.time * 2.6 + hl.phase));
      const target = d.alpha * hl.fade * pulse;
      hl.mat.opacity += (target - hl.mat.opacity) * Math.min(1, dt * 9);
    }
    // arrow draw-in (real-time)
    if (this.arrowT < 1) {
      this.arrowT = Math.min(1, (nowMs - this.arrowStart) / 550);
      this.redrawArrows();
    }
    this.renderer.render(this.scene, this.camera);
  }
}
