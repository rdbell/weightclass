// main.js — flat top-down three.js board + lesson playback engine.
import * as THREE from 'three';
import { STEPS, PAIRS, CHIP_STEPS } from './lesson.js';
import { pieceTexture } from './pieces.js';

/* ---------- seeded randomness (deterministic across loads) ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- coordinates ----------
   Black's perspective: files h→a left→right, ranks 1→8 top→bottom.
   World XZ plane viewed from +Y. Camera up = (0,0,-1) ⇒ screen-up = -Z, screen-right = +X.
   file a (idx 0) → x=+3.5 (right) ; rank 1 (idx 0) → z=-3.5 (top).        */
const fIdx = (s) => s.charCodeAt(0) - 97;
const rIdx = (s) => s.charCodeAt(1) - 49;
const center = (name) => new THREE.Vector3(3.5 - fIdx(name), 0, rIdx(name) - 3.5);

/* ---------- board texture (squares + margins + rotated labels) ---------- */
const BOARD_UNITS = 9.4;      // 8 squares + 0.7 margin each side
const PX_PER_UNIT = 148;
function makeBoardTexture() {
  const W = Math.round(BOARD_UNITS * PX_PER_UNIT); // 1391
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = W;
  const c = cv.getContext('2d');
  const U = PX_PER_UNIT, half = W / 2;
  const X = (x) => half + x * U;
  const Y = (z) => half + z * U;

  // margin
  c.fillStyle = '#3f4a39';
  c.fillRect(0, 0, W, W);

  // subtle deterministic grain on the margin
  const rnd = mulberry32(20261113);
  c.fillStyle = 'rgba(255,255,255,0.028)';
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * W, y = rnd() * W;
    if (Math.abs(x - half) < 4 * U && Math.abs(y - half) < 4 * U) continue; // skip board
    c.fillRect(x, y, 2.2, 2.2);
  }

  // squares
  const LIGHT = '#ede9cf', DARK = '#75955c';
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const x0 = X(3 - f), x1 = X(4 - f);
      const y0 = Y(r - 4), y1 = Y(r - 3);
      c.fillStyle = (f + r) % 2 === 0 ? DARK : LIGHT;
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // inner frame line
  c.strokeStyle = 'rgba(0,0,0,0.35)';
  c.lineWidth = 3;
  c.strokeRect(X(-4), Y(-4), 8 * U, 8 * U);

  // labels — files h→a along the bottom, ranks 1→8 down the left; upright text
  c.fillStyle = 'rgba(238,235,220,0.85)';
  c.font = `700 ${Math.round(0.30 * U)}px system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  for (let f = 0; f < 8; f++) {
    const letter = 'abcdefgh'[f];
    c.fillText(letter, X(3.5 - f), Y(4.35));
  }
  for (let r = 0; r < 8; r++) {
    c.fillText(String(r + 1), X(-4.35), Y(r - 3.5));
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- renderer / scene / camera ---------- */
const boardArea = document.getElementById('boardArea');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
boardArea.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
camera.position.set(0, 20, 0);
camera.up.set(0, 0, -1);
camera.lookAt(0, 0, 0);

function resize() {
  const w = boardArea.clientWidth, h = boardArea.clientHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  const fit = 5.0; // half-extent that must always be visible (board is 4.7)
  const halfH = aspect >= 1 ? fit : fit / aspect;
  const halfW = halfH * aspect;
  camera.left = -halfW; camera.right = halfW;
  camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(boardArea);
resize();

/* ---------- board ---------- */
const board = new THREE.Mesh(
  new THREE.PlaneGeometry(BOARD_UNITS, BOARD_UNITS).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ map: makeBoardTexture() })
);
scene.add(board);

/* ---------- pieces ---------- */
const pieceGeo = new THREE.PlaneGeometry(0.98, 0.98).rotateX(-Math.PI / 2);
const pieces = [];
function addPiece(type, color, square) {
  const mesh = new THREE.Mesh(
    pieceGeo,
    new THREE.MeshBasicMaterial({ map: pieceTexture(type, color), transparent: true, depthWrite: false })
  );
  mesh.renderOrder = 2;
  const p = { type, color, home: square, square, alive: true, mesh };
  setMeshSquare(p);
  scene.add(mesh);
  pieces.push(p);
  return p;
}
function setMeshSquare(p) {
  p.mesh.position.copy(center(p.square)).setY(0.02);
}
// standard start position (files a..h = idx 0..7)
const BACK = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
for (let f = 0; f < 8; f++) {
  addPiece(BACK[f], 'w', squareName(f, 0));
  addPiece('P', 'w', squareName(f, 1));
  addPiece('P', 'b', squareName(f, 6));
  addPiece(BACK[f], 'b', squareName(f, 7));
}
function squareName(f, r) { return 'abcdefgh'[f] + (r + 1); }
function pieceAt(name) {
  return pieces.find((p) => p.alive && p.square === name) || null;
}

/* ---------- fx: highlights + arrows ---------- */
const fx = new THREE.Group();
scene.add(fx);
const HL_COLORS = {
  last:    { color: 0xf0c14b, opacity: 0.42 },
  danger:  { color: 0xe0523f, opacity: 0.52 },
  guard:   { color: 0x59b14e, opacity: 0.5 },
  key:     { color: 0x5aa7d6, opacity: 0.5 },
  blocked: { color: 0x1d1c18, opacity: 0.55 },
};
const hlGeo = new THREE.PlaneGeometry(0.97, 0.97).rotateX(-Math.PI / 2);
const pulsing = [];

function addHighlight(name, kind, pulse) {
  const { color, opacity } = HL_COLORS[kind];
  const m = new THREE.Mesh(hlGeo, new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false,
  }));
  m.position.copy(center(name)).setY(0.012);
  m.renderOrder = 1;
  fx.add(m);
  if (pulse) pulsing.push({ mat: m.material, base: opacity, t0: performance.now() });
}

function addArrow(fromName, toName, colorHex) {
  const a = center(fromName), b = center(toName);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const perp = new THREE.Vector3(-dir.z, 0, dir.x);
  const tip = b.clone().addScaledVector(dir, -0.12);
  const base = tip.clone().addScaledVector(dir, -0.42);
  const s0 = a.clone().addScaledVector(dir, Math.min(0.30, len * 0.35));
  const w = 0.115, hw = 0.30, y = 0.05;
  const v = [];
  const push = (p) => v.push(p.x, y, p.z);
  push(s0.clone().addScaledVector(perp, w));
  push(s0.clone().addScaledVector(perp, -w));
  push(base.clone().addScaledVector(perp, -w));
  push(base.clone().addScaledVector(perp, w));
  push(base.clone().addScaledVector(perp, hw));
  push(tip.clone());
  push(base.clone().addScaledVector(perp, -hw));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6]);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({
    color: colorHex, transparent: true, opacity: 0.92, depthWrite: false, side: THREE.DoubleSide,
  }));
  mesh.renderOrder = 3;
  fx.add(mesh);
}

const ARROW_COLORS = { gold: 0xf0c14b, danger: 0xe0523f, guard: 0x59b14e };

function clearFX() {
  while (fx.children.length) {
    const ch = fx.children.pop();
    ch.material.dispose();
    if (ch.geometry !== hlGeo) ch.geometry.dispose();
  }
  pulsing.length = 0;
}

function applyVisuals(step) {
  clearFX();
  if (step.move) {
    addHighlight(step.move.from, 'last');
    addHighlight(step.move.to, 'last');
  }
  for (const h of step.highlights || []) addHighlight(h.sq, h.kind, h.pulse);
  for (const a of step.arrows || []) addArrow(a.from, a.to, ARROW_COLORS[a.color] || 0xf0c14b);
}

/* ---------- playback engine ---------- */
let idx = 0;
let playing = true;
let anim = null;       // active move animation
let fading = [];       // captured pieces fading out
let holdT0 = performance.now();
let seeking = false;

const N = STEPS.length;

function rebuildTo(k) {
  anim = null;
  fading.forEach((f) => { f.mesh.visible = false; f.mesh.scale.setScalar(1); f.mesh.material.opacity = 1; });
  fading = [];
  for (const p of pieces) {
    p.square = p.home;
    p.alive = true;
    p.mesh.visible = true;
    p.mesh.scale.setScalar(1);
    p.mesh.material.opacity = 1;
    setMeshSquare(p);
  }
  for (let i = 1; i <= k; i++) {
    const mv = STEPS[i].move;
    if (!mv) continue;
    const mover = pieceAt(mv.from);
    if (!mover) continue; // should never happen with a verified line
    const victim = mv.capture ? pieceAt(mv.to) : null;
    if (victim) { victim.alive = false; victim.mesh.visible = false; }
    mover.square = mv.to;
  }
  for (const p of pieces) setMeshSquare(p);
}

function startMoveAnim(mv) {
  const mover = pieceAt(mv.from);
  if (!mover) { applyVisuals(STEPS[idx]); return; }
  const victim = mv.capture ? pieceAt(mv.to) : null;
  if (victim && victim !== mover) {
    victim.alive = false;
    fading.push({ mesh: victim.mesh, t0: performance.now() + 260, dur: 340 });
  }
  mover.square = mv.to; // logical state is final immediately; mesh catches up
  const a = center(mv.from), b = center(mv.to);
  anim = { mover, a, b, t0: performance.now(), dur: 640 };
  clearFX();
  addHighlight(mv.from, 'last');
}

function finishAnim() {
  setMeshSquare(anim.mover);
  anim.mover.mesh.scale.setScalar(1);
  anim = null;
  applyVisuals(STEPS[idx]);
  holdT0 = performance.now();
}

function goto(target, { animate = true } = {}) {
  target = Math.max(0, Math.min(N - 1, target));
  const step = STEPS[target];
  // if a move animation is still in flight, snap its piece to its destination first
  if (anim) {
    setMeshSquare(anim.mover);
    anim.mover.mesh.scale.setScalar(1);
    anim.mover.mesh.position.setY(0.02);
    anim = null;
  }
  const forwardOne = target === idx + 1;
  if (target === idx) {
    // re-applying the current step (e.g. re-clicked chip) — just refresh visuals
    applyVisuals(step);
    holdT0 = performance.now();
    updateHUD();
    return;
  }
  if (animate && step.move && forwardOne) {
    idx = target;
    startMoveAnim(step.move);
  } else {
    idx = target;
    rebuildTo(idx);
    applyVisuals(step);
    holdT0 = performance.now();
  }
  updateHUD();
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function tick(now) {
  requestAnimationFrame(tick);

  // pulse highlights
  for (const p of pulsing) {
    p.mat.opacity = p.base * (0.72 + 0.28 * Math.sin((now - p.t0) / 320));
  }
  // fading captures
  fading = fading.filter((f) => {
    const t = (now - f.t0) / f.dur;
    if (t < 0) return true;
    if (t >= 1) { f.mesh.visible = false; f.mesh.material.opacity = 1; f.mesh.scale.setScalar(1); return false; }
    f.mesh.material.opacity = 1 - t;
    f.mesh.scale.setScalar(1 - 0.25 * t);
    return true;
  });
  // move animation
  if (anim) {
    const t = Math.min(1, (now - anim.t0) / anim.dur);
    const e = easeInOut(t);
    anim.mover.mesh.position.lerpVectors(anim.a, anim.b, e).setY(0.02 + Math.sin(e * Math.PI) * 0.14);
    anim.mover.mesh.scale.setScalar(1 + Math.sin(e * Math.PI) * 0.05);
    if (t >= 1) finishAnim();
  } else if (playing && !seeking) {
    const step = STEPS[idx];
    if (now - holdT0 > step.hold * 1000) {
      if (idx === N - 1) { playing = false; updateHUD(); }
      else goto(idx + 1, { animate: true });
    }
  }

  renderer.render(scene, camera);
}
requestAnimationFrame(tick);

/* ---------- UI ---------- */
const capTag = document.getElementById('capTag');
const capText = document.getElementById('capText');
const caption = document.getElementById('caption');
const fill = document.getElementById('fill');
const stepLabel = document.getElementById('stepLabel');
const playBtn = document.getElementById('playBtn');
const iconPlay = document.getElementById('iconPlay');
const iconPause = document.getElementById('iconPause');
const iconReplay = document.getElementById('iconReplay');
const moveList = document.getElementById('moveList');
const moveStrip = document.getElementById('moveStrip');

// build move list (sidebar rows + mobile strip share the same chips list)
const chips = [];
PAIRS.forEach(([w, b], i) => {
  const row = document.createElement('div');
  row.className = 'mvrow';
  const num = document.createElement('span'); num.className = 'num'; num.textContent = i + 1 + '.';
  row.appendChild(num);
  [w, b].forEach((san, j) => {
    if (!san) return; // skip empty slot (final move has no black reply)
    const chip = document.createElement('div');
    chip.className = 'chip';
    chip.textContent = san;
    const stepIdx = CHIP_STEPS[i * 2 + j];
    chip.addEventListener('click', () => goto(stepIdx, { animate: stepIdx > idx }));
    row.appendChild(chip);
    chips.push({ chip, stepIdx });
  });
  moveList.appendChild(row);
  moveStrip.appendChild(row.cloneNode(true));
});
// re-bind strip chips (cloneNode loses listeners) — mirror classes instead:
const stripChips = [...moveStrip.querySelectorAll('.chip')];
stripChips.forEach((chip, i) => {
  chip.addEventListener('click', () => goto(chips[i].stepIdx, { animate: chips[i].stepIdx > idx }));
});

function currentChipIndex() {
  if (idx >= CHIP_STEPS[CHIP_STEPS.length - 1]) return chips.length - 1;
  const found = chips.findIndex((c) => c.stepIdx === idx);
  return found;
}

function updateHUD() {
  const step = STEPS[idx];
  capTag.textContent = step.tag;
  capText.textContent = step.text;
  caption.classList.remove('flash');
  void caption.offsetWidth;
  caption.classList.add('flash');

  fill.style.width = (idx / (N - 1)) * 100 + '%';
  stepLabel.textContent = `Step ${idx + 1} / ${N}`;

  const cur = currentChipIndex();
  chips.forEach((c, i) => c.chip.classList.toggle('current', i === cur));
  stripChips.forEach((c, i) => c.classList.toggle('current', i === cur));
  if (cur >= 0) {
    chips[cur].chip.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    stripChips[cur].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  iconPlay.style.display = (!playing && idx < N - 1) ? 'block' : 'none';
  iconReplay.style.display = (!playing && idx === N - 1) ? 'block' : 'none';
  iconPause.style.display = playing ? 'block' : 'none';
}

playBtn.addEventListener('click', () => {
  if (!playing && idx === N - 1) { goto(0, { animate: false }); playing = true; holdT0 = performance.now(); }
  else playing = !playing;
  updateHUD();
});
document.getElementById('replayBtn').addEventListener('click', () => {
  goto(0, { animate: false });
  playing = true;
  holdT0 = performance.now();
  updateHUD();
});
document.getElementById('prevBtn').addEventListener('click', () => {
  goto(idx - 1, { animate: false });
  holdT0 = performance.now();
});
document.getElementById('nextBtn').addEventListener('click', () => {
  if (idx === N - 1) { goto(0, { animate: false }); playing = false; }
  else goto(idx + 1, { animate: true });
  holdT0 = performance.now();
  updateHUD();
});

/* progress seeking */
const track = document.getElementById('track');
function seekFromEvent(e) {
  const rect = track.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  goto(Math.round(frac * (N - 1)), { animate: false });
}
track.addEventListener('pointerdown', (e) => {
  seeking = true;
  track.setPointerCapture(e.pointerId);
  seekFromEvent(e);
});
track.addEventListener('pointermove', (e) => { if (seeking) seekFromEvent(e); });
track.addEventListener('pointerup', () => { seeking = false; holdT0 = performance.now(); });

/* keyboard */
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLButtonElement) return; // let focused buttons handle Space natively
  if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
  else if (e.code === 'ArrowRight') document.getElementById('nextBtn').click();
  else if (e.code === 'ArrowLeft') document.getElementById('prevBtn').click();
  else if (e.key === 'r' || e.key === 'R') document.getElementById('replayBtn').click();
});

/* ---------- go ---------- */
applyVisuals(STEPS[0]);
updateHUD();