import * as THREE from 'three';
import { rand } from './rng.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function toTexture(c, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

// Walnut plank floor: planks run along the texture's u axis.
export function woodFloorTexture() {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  const plankH = 64;
  for (let i = 0; i < 8; i++) {
    const y0 = i * plankH;
    const l = 88 + rand(-10, 12), m = 60 + rand(-8, 10), n = 40 + rand(-6, 8);
    g.fillStyle = `rgb(${l | 0},${m | 0},${n | 0})`;
    g.fillRect(0, y0, 512, plankH);
    for (let k = 0; k < 30; k++) {
      g.strokeStyle = `rgba(35,20,10,${(0.05 + rand(0, 0.09)).toFixed(3)})`;
      g.lineWidth = 0.8 + rand(0, 1.6);
      g.beginPath();
      const gy = y0 + rand(4, plankH - 4);
      g.moveTo(0, gy);
      for (let x = 0; x <= 512; x += 64) {
        g.lineTo(x, gy + Math.sin(x * 0.015 + k * 1.7 + i) * 2.2 + rand(-1, 1));
      }
      g.stroke();
    }
    if (rand() < 0.55) {
      const kx = rand(40, 470), ky = y0 + rand(10, plankH - 10), kr = rand(3, 6);
      const grd = g.createRadialGradient(kx, ky, 1, kx, ky, kr * 2.2);
      grd.addColorStop(0, 'rgba(40,22,10,0.85)');
      grd.addColorStop(1, 'rgba(40,22,10,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(kx, ky, kr * 2.2, 0, 7); g.fill();
      g.strokeStyle = 'rgba(35,18,8,0.6)';
      g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(kx, ky, kr, kr * 0.6, 0, 0, 7); g.stroke();
    }
    g.fillStyle = 'rgba(25,14,7,0.55)';
    g.fillRect(0, y0, 512, 1.5);
    g.fillRect(rand(0, 512), y0, 1.5, plankH);
  }
  return toTexture(c, [3, 4]);
}

// Light neutral wood grain, tinted per-material via material.color.
export function woodFineTexture() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#b59a78';
  g.fillRect(0, 0, 256, 256);
  for (let k = 0; k < 90; k++) {
    g.strokeStyle = `rgba(90,60,35,${(0.04 + rand(0, 0.08)).toFixed(3)})`;
    g.lineWidth = 0.6 + rand(0, 1.4);
    const y = rand(0, 256);
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= 256; x += 32) {
      g.lineTo(x, y + Math.sin(x * 0.02 + k) * 1.5 + rand(-0.8, 0.8));
    }
    g.stroke();
  }
  return toTexture(c);
}

export function plasterTexture(base = '#75806a') {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const a = rand(0, 0.055);
    g.fillStyle = rand() < 0.5 ? `rgba(255,250,235,${a.toFixed(3)})` : `rgba(30,25,15,${a.toFixed(3)})`;
    g.fillRect(rand(0, 256), rand(0, 256), rand(0.5, 2), rand(0.5, 2));
  }
  return toTexture(c, [3, 2]);
}

export function brickTexture() {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#b3a48e';
  g.fillRect(0, 0, 512, 512);
  const bw = 128, bh = 44, gap = 6;
  for (let row = 0; row * (bh + gap) < 512 + bh; row++) {
    const y = row * (bh + gap);
    const off = (row % 2) * (bw / 2);
    for (let x = -bw; x < 512 + bw; x += bw + gap) {
      const l = 125 + rand(-16, 14), m = 78 + rand(-12, 10), n = 58 + rand(-10, 9);
      g.fillStyle = `rgb(${l | 0},${m | 0},${n | 0})`;
      g.fillRect(x + off, y, bw, bh);
      for (let s = 0; s < 14; s++) {
        g.fillStyle = `rgba(60,30,20,${rand(0, 0.14).toFixed(3)})`;
        g.fillRect(x + off + rand(0, bw), y + rand(0, bh), rand(1, 3), rand(1, 3));
      }
    }
  }
  return toTexture(c, [2.2, 2.2]);
}

export function rugTexture() {
  const c = makeCanvas(560, 400);
  const g = c.getContext('2d');
  g.fillStyle = '#77352c';
  g.fillRect(0, 0, 560, 400);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(255,230,190,${rand(0, 0.045).toFixed(3)})`;
    g.fillRect(rand(0, 560), rand(0, 400), 1.5, 1.5);
  }
  g.strokeStyle = 'rgba(214,196,156,0.42)';
  g.lineWidth = 2;
  for (let x = -560; x < 1120; x += 56) {
    g.beginPath();
    g.moveTo(x, 0); g.lineTo(x + 280, 200); g.lineTo(x, 400); g.lineTo(x - 280, 200);
    g.closePath();
    g.stroke();
  }
  g.strokeStyle = '#d6c49c';
  g.lineWidth = 22;
  g.strokeRect(11, 11, 538, 378);
  g.strokeStyle = '#2c3550';
  g.lineWidth = 4;
  g.strokeRect(26, 26, 508, 348);
  g.strokeStyle = '#d6c49c';
  g.lineWidth = 3;
  g.strokeRect(36, 36, 488, 328);
  g.save();
  g.translate(280, 200);
  g.strokeStyle = '#b0573f';
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(0, -70); g.lineTo(70, 0); g.lineTo(0, 70); g.lineTo(-70, 0);
  g.closePath();
  g.stroke();
  g.strokeStyle = '#d6c49c';
  g.lineWidth = 3;
  for (const r of [46, 34]) {
    g.beginPath();
    g.moveTo(0, -r); g.lineTo(r, 0); g.lineTo(0, r); g.lineTo(-r, 0);
    g.closePath();
    g.stroke();
  }
  g.fillStyle = '#2c3550';
  g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill();
  g.restore();
  return toTexture(c);
}

// Night sky seen through the window. Moon kept low enough to be visible
// from inside the room through the 1.4 m tall window.
export function skyTexture() {
  const c = makeCanvas(1024, 640);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 640);
  grd.addColorStop(0, '#070d1d');
  grd.addColorStop(0.5, '#12203a');
  grd.addColorStop(0.78, '#26344c');
  grd.addColorStop(1, '#31405a');
  g.fillStyle = grd;
  g.fillRect(0, 0, 1024, 640);
  for (let i = 0; i < 260; i++) {
    const x = rand(0, 1024), y = rand(0, 400);
    const a = rand(0.15, 0.9) * (1 - y / 470);
    g.fillStyle = `rgba(220,230,255,${Math.max(0, a).toFixed(3)})`;
    g.fillRect(x, y, rand(0.6, 1.8), rand(0.6, 1.8));
  }
  const mg = g.createRadialGradient(420, 320, 6, 420, 320, 80);
  mg.addColorStop(0, 'rgba(225,233,250,0.95)');
  mg.addColorStop(0.3, 'rgba(190,205,240,0.32)');
  mg.addColorStop(1, 'rgba(190,205,240,0)');
  g.fillStyle = mg;
  g.fillRect(320, 220, 200, 200);
  g.fillStyle = '#e8edf8';
  g.beginPath(); g.arc(420, 320, 19, 0, 7); g.fill();
  g.fillStyle = 'rgba(160,175,205,0.5)';
  g.beginPath(); g.arc(414, 315, 4.4, 0, 7); g.fill();
  g.beginPath(); g.arc(427, 326, 3, 0, 7); g.fill();
  // distant hills and tree line at the horizon
  g.fillStyle = '#0c1424';
  g.beginPath();
  g.moveTo(0, 432);
  for (let x = 0; x <= 1024; x += 64) {
    g.lineTo(x, 424 + Math.sin(x * 0.006 + 1.2) * 16 + Math.sin(x * 0.021) * 7);
  }
  g.lineTo(1024, 640); g.lineTo(0, 640);
  g.closePath();
  g.fill();
  g.fillStyle = '#080d16';
  for (let i = 0; i < 30; i++) {
    const x = rand(0, 1024), h = rand(20, 52), w = rand(8, 18), base = rand(452, 480);
    g.beginPath();
    g.moveTo(x, base - h); g.lineTo(x + w, base); g.lineTo(x - w, base);
    g.closePath();
    g.fill();
  }
  g.fillRect(0, 462, 1024, 178);
  return toTexture(c);
}

export function plaidTexture() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#c9b294';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(140,60,45,0.55)';
  for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 14, 128);
  for (let y = 0; y < 128; y += 32) g.fillRect(0, y, 128, 14);
  g.fillStyle = 'rgba(50,60,80,0.4)';
  for (let x = 16; x < 128; x += 32) g.fillRect(x, 0, 3, 128);
  for (let y = 16; y < 128; y += 32) g.fillRect(0, y, 128, 3);
  return toTexture(c, [2, 2]);
}

export function artTexture(kind) {
  const c = makeCanvas(256, 320);
  const g = c.getContext('2d');
  if (kind === 'dusk') {
    const grd = g.createLinearGradient(0, 0, 0, 320);
    grd.addColorStop(0, '#2b3a55');
    grd.addColorStop(0.5, '#7a5a52');
    grd.addColorStop(0.62, '#c08a5a');
    grd.addColorStop(0.66, '#4a3a2e');
    grd.addColorStop(1, '#241d16');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 320);
    g.fillStyle = 'rgba(245,220,180,0.9)';
    g.beginPath(); g.arc(172, 148, 13, 0, 7); g.fill();
    g.fillStyle = '#1c1712';
    g.beginPath();
    g.moveTo(0, 232);
    for (let x = 0; x <= 256; x += 16) g.lineTo(x, 224 + Math.sin(x * 0.05 + 2) * 10);
    g.lineTo(256, 320); g.lineTo(0, 320);
    g.closePath();
    g.fill();
    g.fillRect(52, 158, 4, 72);
    g.beginPath(); g.arc(54, 156, 21, 0, 7); g.fill();
  } else if (kind === 'abstract') {
    g.fillStyle = '#d8cbb2';
    g.fillRect(0, 0, 256, 320);
    const cols = ['#9a4f3a', '#2c3550', '#6f7a5e', '#b3873f'];
    for (let i = 0; i < 7; i++) {
      g.fillStyle = cols[i % 4];
      g.globalAlpha = rand(0.5, 0.85);
      const x = rand(20, 236), y = rand(30, 290), r = rand(14, 52);
      if (rand() < 0.5) {
        g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      } else {
        g.save();
        g.translate(x, y);
        g.rotate(rand(0, 3));
        g.fillRect(-r, -r * 0.4, r * 2, r * 0.8);
        g.restore();
      }
    }
    g.globalAlpha = 1;
  } else { // botanical
    g.fillStyle = '#e2d7bd';
    g.fillRect(0, 0, 256, 320);
    g.strokeStyle = '#4a5f3a';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(128, 300);
    g.quadraticCurveTo(110, 200, 128, 90);
    g.stroke();
    for (let i = 0; i < 8; i++) {
      const y = 260 - i * 22, side = i % 2 ? 1 : -1;
      g.fillStyle = i % 2 ? '#5d7f44' : '#4a6b3a';
      g.beginPath();
      g.ellipse(128 + side * 26, y, 26, 9, side * -0.5, 0, 7);
      g.fill();
    }
    g.fillStyle = '#9a4f3a';
    for (let i = 0; i < 5; i++) {
      g.beginPath(); g.arc(120 + rand(0, 16), 78 + rand(0, 20), 4, 0, 7); g.fill();
    }
  }
  return toTexture(c);
}