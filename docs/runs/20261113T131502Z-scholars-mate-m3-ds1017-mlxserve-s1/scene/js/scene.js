import * as THREE from 'three';
import { pieceTexture } from './pieces.js';

const BOARD_SIZE = 8;
const VIEW_HALF = 4.42;
const PIECE_SCALE = 1.1;
const EASE = (t) => t * t * (3 - 2 * t);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBoardTexture() {
  const px = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, px, px);

  const radius = 46;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(2, 2, px - 4, px - 4, radius);
  ctx.clip();

  const cell = px / 8;
  const lightTop = '#efe9d8';
  const lightBottom = '#e6dfca';
  const darkTop = '#78985e';
  const darkBottom = '#6e8c55';

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const light = (col + row) % 2 === 0;
      const g = ctx.createLinearGradient(0, row * cell, 0, (row + 1) * cell);
      g.addColorStop(0, light ? lightTop : darkTop);
      g.addColorStop(1, light ? lightBottom : darkBottom);
      ctx.fillStyle = g;
      ctx.fillRect(col * cell, row * cell, cell + 0.5, cell + 0.5);
    }
  }

  // A whisper of paper grain keeps the flat colours from feeling sterile.
  const rand = mulberry32(0x5d3a1f);
  ctx.globalAlpha = 0.018;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 3200; i++) {
    ctx.fillRect(rand() * px, rand() * px, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // Thin inset edge, framing the 64 squares.
  ctx.strokeStyle = '#5d7948';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(6, 6, px - 12, px - 12, radius - 4);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

function makeHighlightTexture() {
  const px = 256;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.roundRect(18, 18, px - 36, px - 36, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function makeMarkTexture() {
  const px = 256;
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');

  ctx.lineWidth = 25;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(80, 80);
  ctx.lineTo(176, 176);
  ctx.moveTo(176, 80);
  ctx.lineTo(80, 176);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function squareToWorld(square) {
  const file = square.charCodeAt(0) - 97; // a=0 ... h=7
  const rank = Number(square.slice(1));
  const col = 7 - file; // Black's view: files run h..a left to right
  const row = rank - 1; // Black's view: ranks run 1..8 top to bottom
  return {
    x: -BOARD_SIZE / 2 + col + 0.5,
    y: BOARD_SIZE / 2 - row - 0.5,
  };
}

function makeArrowGeometry(from, to) {
  const sx = from.x;
  const sy = from.y;
  const tx = to.x;
  const ty = to.y;
  const dx = tx - sx;
  const dy = ty - sy;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const trimStart = 0.18;
  const trimEnd = 0.2;
  const shaft = 0.075;
  const headWidth = 0.23;
  const headLength = 0.26;

  const ax = sx + ux * trimStart;
  const ay = sy + uy * trimStart;
  const bx = tx - ux * trimEnd;
  const by = ty - uy * trimEnd;
  const hx = bx - ux * headLength;
  const hy = by - uy * headLength;

  const pts = [
    [ax + px * shaft, ay + py * shaft],
    [hx + px * shaft, hy + py * shaft],
    [hx + px * headWidth * 0.5, hy + py * headWidth * 0.5],
    [bx, by],
    [hx - px * headWidth * 0.5, hy - py * headWidth * 0.5],
    [hx - px * shaft, hy - py * shaft],
    [ax - px * shaft, ay - py * shaft],
  ];

  const positions = [];
  for (const [x, y] of pts) positions.push(x, y, 0);
  const indices = [];
  for (let i = 1; i < pts.length - 1; i++) indices.push(0, i, i + 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export class ChessScene {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(
      -VIEW_HALF,
      VIEW_HALF,
      VIEW_HALF,
      -VIEW_HALF,
      0.1,
      30
    );
    this.camera.position.set(0, 0, 10);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    const boardMat = new THREE.MeshBasicMaterial({
      map: makeBoardTexture(),
      transparent: true,
      depthWrite: true,
    });
    this.board = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_SIZE, BOARD_SIZE), boardMat);
    this.scene.add(this.board);

    this.highlightTexture = makeHighlightTexture();
    this.markTexture = makeMarkTexture();
    this.pieceSprites = new Map();
    this.moveAnim = null;
    this.overlayGroups = [];
    this.time = 0;
  }

  resize(width, height) {
    if (width <= 0 || height <= 0) return;
    const aspect = width / height;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);
    this.camera.left = -VIEW_HALF * aspect;
    this.camera.right = VIEW_HALF * aspect;
    this.camera.top = VIEW_HALF;
    this.camera.bottom = -VIEW_HALF;
    this.camera.updateProjectionMatrix();
  }

  pieceSprite(piece) {
    const material = new THREE.SpriteMaterial({
      map: pieceTexture(piece.type, piece.color),
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(PIECE_SCALE, PIECE_SCALE, 1);
    sprite.renderOrder = 4;
    const pos = squareToWorld(piece.square);
    sprite.position.set(pos.x, pos.y, 0.24);
    sprite.userData.pieceId = piece.id;
    return sprite;
  }

  removeSprite(id, instant = false) {
    const sprite = this.pieceSprites.get(id);
    if (!sprite) return null;
    this.pieceSprites.delete(id);
    this.scene.remove(sprite);
    if (instant || !this.moveAnim) {
      sprite.material.dispose();
    }
    return sprite;
  }

  cancelMove() {
    if (!this.moveAnim) return;
    const { sprite, captureSprite, captureId, target } = this.moveAnim;
    const pos = squareToWorld(target.square);
    sprite.position.x = pos.x;
    sprite.position.y = pos.y;
    sprite.scale.set(PIECE_SCALE, PIECE_SCALE, 1);
    sprite.material.opacity = 1;
    if (captureSprite) {
      this.scene.remove(captureSprite);
      captureSprite.material.dispose();
      if (captureId) this.pieceSprites.delete(captureId);
    }
    this.moveAnim = null;
  }

  setSnapshot(snapshot) {
    this.cancelMove();

    const wanted = new Map(snapshot.map((p) => [p.id, p]));
    for (const [id, sprite] of [...this.pieceSprites.entries()]) {
      if (!wanted.has(id)) {
        this.scene.remove(sprite);
        sprite.material.dispose();
        this.pieceSprites.delete(id);
      }
    }

    for (const piece of snapshot) {
      let sprite = this.pieceSprites.get(piece.id);
      if (!sprite) {
        sprite = this.pieceSprite(piece);
        this.pieceSprites.set(piece.id, sprite);
        this.scene.add(sprite);
      }
      const pos = squareToWorld(piece.square);
      sprite.position.set(pos.x, pos.y, 0.24);
      sprite.scale.set(PIECE_SCALE, PIECE_SCALE, 1);
      sprite.material.opacity = 1;
    }
  }

  animateToSnapshot(snapshot, duration = 0.72) {
    this.cancelMove();

    const wanted = new Map(snapshot.map((p) => [p.id, p]));
    const captured = [];
    for (const [id, sprite] of [...this.pieceSprites.entries()]) {
      if (!wanted.has(id)) captured.push({ id, sprite });
    }

    let moved = null;
    for (const piece of snapshot) {
      let sprite = this.pieceSprites.get(piece.id);
      if (!sprite) {
        sprite = this.pieceSprite(piece);
        this.pieceSprites.set(piece.id, sprite);
        this.scene.add(sprite);
      }
      const pos = squareToWorld(piece.square);
      const dist = Math.hypot(sprite.position.x - pos.x, sprite.position.y - pos.y);
      if (dist > 0.001 && !moved) {
        moved = { sprite, piece };
      } else {
        sprite.position.set(pos.x, pos.y, 0.24);
        sprite.scale.set(PIECE_SCALE, PIECE_SCALE, 1);
        sprite.material.opacity = 1;
      }
    }

    const captureSprite = captured.length ? captured[0].sprite : null;
    for (let i = 1; i < captured.length; i++) {
      this.scene.remove(captured[i].sprite);
      captured[i].sprite.material.dispose();
      this.pieceSprites.delete(captured[i].id);
    }

    if (!moved) {
      if (captureSprite) {
        this.scene.remove(captureSprite);
        captureSprite.material.dispose();
        this.pieceSprites.delete(captured[0].id);
      }
      return;
    }

    const from = { ...moved.sprite.position };
    const to = squareToWorld(moved.piece.square);
    this.moveAnim = {
      sprite: moved.sprite,
      captureSprite,
      captureId: captureSprite ? captured[0].id : null,
      from,
      to,
      target: moved.piece,
      elapsed: 0,
      duration,
    };
  }

  addOverlays(spec) {
    // Retire whatever was on screen.
    for (const entry of this.overlayGroups) entry.out = true;    if (!spec || (!spec.highlights?.length && !spec.arrows?.length && !spec.marks?.length)) {
      return;
    }

    const group = new THREE.Group();
    group.userData = { opacity: 0, pulse: [] };

    for (const h of spec.highlights || []) {
      const pos = squareToWorld(h.square);
      const material = new THREE.MeshBasicMaterial({
        map: this.highlightTexture,
        color: new THREE.Color(h.color),
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      material.userData.baseOpacity = 1;
      material.userData.pulse = !!h.pulse;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), material);
      mesh.position.set(pos.x, pos.y, 0.03);
      mesh.renderOrder = 2;
      group.add(mesh);
    }

    for (const a of spec.arrows || []) {
      const from = squareToWorld(a.from);
      const to = squareToWorld(a.to);
      const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(a.color),
        transparent: true,
        depthWrite: false,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      material.userData.baseOpacity = 0.92;
      material.userData.pulse = false;
      const mesh = new THREE.Mesh(makeArrowGeometry(from, to), material);
      mesh.position.z = 0.6;
      mesh.renderOrder = 8;
      group.add(mesh);
    }

    for (const m of spec.marks || []) {
      const pos = squareToWorld(m.square);
      const material = new THREE.MeshBasicMaterial({
        map: this.markTexture,
        color: new THREE.Color(m.color),
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      material.userData.baseOpacity = 0.95;
      material.userData.pulse = false;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), material);
      mesh.position.set(pos.x, pos.y, 0.72);
      mesh.renderOrder = 9;
      group.add(mesh);
    }

    this.scene.add(group);
    this.overlayGroups.push({ group, out: false });
  }

  clearOverlays() {
    for (const entry of this.overlayGroups) {
      this.scene.remove(entry.group);
      for (const mesh of entry.group.children) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
    }
    this.overlayGroups = [];
  }

  update(dt) {
    this.time += dt;

    if (this.moveAnim) {
      const anim = this.moveAnim;
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const e = EASE(t);
      anim.sprite.position.x = anim.from.x + (anim.to.x - anim.from.x) * e;
      anim.sprite.position.y = anim.from.y + (anim.to.y - anim.from.y) * e;
      const lift = Math.sin(Math.PI * t) * 0.045;
      anim.sprite.scale.set(PIECE_SCALE + lift, PIECE_SCALE + lift, 1);

      if (anim.captureSprite) {
        const fade = Math.max(0, Math.min(1, (t - 0.6) / 0.32));
        anim.captureSprite.material.opacity = 1 - fade;
        const s = PIECE_SCALE * (1 - fade * 0.25);
        anim.captureSprite.scale.set(s, s, 1);
      }

      if (t >= 1) {
        anim.sprite.position.set(anim.to.x, anim.to.y, 0.24);
        anim.sprite.scale.set(PIECE_SCALE, PIECE_SCALE, 1);
        if (anim.captureSprite) {
          this.scene.remove(anim.captureSprite);
          anim.captureSprite.material.dispose();
          this.pieceSprites.delete(anim.captureId);
        }
        this.moveAnim = null;
      }
    }

    for (let i = this.overlayGroups.length - 1; i >= 0; i--) {
      const entry = this.overlayGroups[i];
      entry.group.userData.opacity += dt * (entry.out ? -4 : 3.4);
      if (entry.group.userData.opacity > 1) entry.group.userData.opacity = 1;
      if (entry.group.userData.opacity < 0) entry.group.userData.opacity = 0;

      const pulse = 0.82 + 0.18 * Math.sin(this.time * 3.0);
      for (const mesh of entry.group.children) {
        const base = mesh.material.userData.baseOpacity ?? 1;
        const p = mesh.material.userData.pulse ? pulse : 1;
        mesh.material.opacity = base * entry.group.userData.opacity * p;
      }

      if (entry.out && entry.group.userData.opacity <= 0.001) {
        this.scene.remove(entry.group);
        for (const mesh of entry.group.children) {
          mesh.geometry.dispose();
          mesh.material.dispose();
        }
        this.overlayGroups.splice(i, 1);
      }
    }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
