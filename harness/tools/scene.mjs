// scene.mjs MODE DIR [OUT]
//   preview DIR      the agent's check: render DIR, print a summary, save
//                    DIR/.preview/screenshot.png
//   check DIR OUT    the judged render: write OUT/checks.json,
//                    OUT/screenshot.png and OUT/shots/*.png. Reads optional
//                    OUT/input/check.json {modes: [...], mode_param: "tod"}.
// Both serve DIR on loopback with the site's scene policy (CSP, no outside
// requests) and render in Chromium with software WebGL (SwiftShader).
//
// check (version 2) records, per load: console/page errors, outside
// requests, missing files, frame rate, WebGL draw calls and triangles per
// frame, a blank test; plus a second screenshot 3 s later (animation), a
// second fresh load (determinism), one load per mode via ?<mode_param>=,
// and a click on each mode's button (does the scene change?).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const VERSION = 2;
const SETTLE_MS = 5000;
const [mode, dirArg, outArg] = process.argv.slice(2);
if (!['preview', 'check'].includes(mode) || !dirArg || (mode === 'check' && !outArg)) {
  console.error('usage: scene.mjs preview DIR | scene.mjs check DIR OUT');
  process.exit(2);
}
const root = path.resolve(dirArg);
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glsl': 'text/plain',
  '.vert': 'text/plain', '.frag': 'text/plain', '.wasm': 'application/wasm',
};
// The policy the public site serves scenes with: same-origin files only.
const CSP = [
  "default-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self' data: blob:",
  "form-action 'none'",
  "frame-src 'none'",
].join('; ');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Security-Policy': CSP,
  });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const indexExists = fs.existsSync(path.join(root, 'index.html'));

// Counts draw calls and primitives per animation frame, page-side.
const GL_PROBE = () => {
  const stats = { frames: 0, draws: 0, prims: 0 };
  window.__wcGL = stats;
  const modeVerts = (m, n) => (m === 4 ? n / 3 : m === 5 || m === 6 ? Math.max(0, n - 2) : m === 1 ? n / 2 : n);
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    const p = C.prototype;
    for (const [fn, countArg, instArg] of [['drawArrays', 2, -1], ['drawElements', 1, -1], ['drawArraysInstanced', 2, 3], ['drawElementsInstanced', 1, 4]]) {
      const orig = p[fn];
      if (!orig) continue;
      p[fn] = function (...a) {
        stats.draws += 1;
        stats.prims += modeVerts(a[0], a[countArg]) * (instArg >= 0 ? a[instArg] : 1);
        return orig.apply(this, a);
      };
    }
  }
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { stats.frames += 1; cb(t); });
};

function analyse(png) {
  const img = PNG.sync.read(png);
  let n = 0, sum = 0, sum2 = 0; const colours = new Set();
  for (let i = 0; i < img.data.length; i += 4 * 7) {
    const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    n += 1; sum += y; sum2 += y * y;
    colours.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
  }
  const luma_stddev = Math.round(Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2)) * 100) / 100;
  return { luma_stddev, distinct_colours: colours.size, blank: luma_stddev < 2 || colours.size < 4 };
}

// Fraction of sampled pixels that differ noticeably between two shots.
function diff(a, b) {
  const A = PNG.sync.read(a), B = PNG.sync.read(b);
  if (A.width !== B.width || A.height !== B.height) return 1;
  let n = 0, d = 0;
  for (let i = 0; i < A.data.length; i += 4 * 5) {
    n += 1;
    if (Math.abs(A.data[i] - B.data[i]) > 16 || Math.abs(A.data[i + 1] - B.data[i + 1]) > 16 || Math.abs(A.data[i + 2] - B.data[i + 2]) > 16) d += 1;
  }
  return Math.round((d / n) * 10000) / 10000;
}

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

// One fresh page load; returns its record and the screenshot.
async function load(query = '', { measure = true } = {}) {
  const r = { query, console_errors: [], console_warnings: [], page_errors: [], outside_requests: [], missing_files: [] };
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(GL_PROBE);
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    r.outside_requests.push(u);
    return route.abort();
  });
  page.on('console', (m) => {
    if (m.type() === 'error') r.console_errors.push(m.text().slice(0, 500));
    if (m.type() === 'warning') r.console_warnings.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => r.page_errors.push(String(e).slice(0, 500)));
  page.on('response', (res) => { if (res.status() === 404) r.missing_files.push(res.url().replace(origin, '')); });
  if (indexExists) {
    await page.goto(`${origin}/index.html${query}`, { waitUntil: 'load', timeout: 60000 })
      .catch((e) => r.page_errors.push(`load: ${e.message}`.slice(0, 500)));
    await page.waitForTimeout(SETTLE_MS);
    if (measure) {
      Object.assign(r, await page.evaluate(() => new Promise((resolve) => {
        const s0 = { ...(window.__wcGL || {}) }; const t0 = performance.now();
        const done = () => {
          const s = window.__wcGL || {}; const secs = (performance.now() - t0) / 1000;
          const frames = (s.frames || 0) - (s0.frames || 0);
          resolve({
            fps: Math.round(frames / secs * 10) / 10,
            draw_calls_per_frame: frames ? Math.round(((s.draws || 0) - (s0.draws || 0)) / frames) : null,
            primitives_per_frame: frames ? Math.round(((s.prims || 0) - (s0.prims || 0)) / frames) : null,
            canvases: document.querySelectorAll('canvas').length,
          });
        };
        setTimeout(done, 2000);
      })).catch(() => ({ fps: null })));
    }
  }
  const png = await page.screenshot();
  Object.assign(r, analyse(png));
  return { r, png, page };
}

const result = { check_version: VERSION, index_exists: indexExists };
let main;
try {
  main = await load();
  Object.assign(result, main.r);
  if (mode === 'check') {
    const out = path.resolve(outArg);
    const shots = path.join(out, 'shots');
    fs.mkdirSync(shots, { recursive: true });
    let cfg = {};
    try { cfg = JSON.parse(fs.readFileSync(path.join(out, 'input', 'check.json'), 'utf8')); } catch { /* none */ }

    // Animation: the same page 3 s later.
    await main.page.waitForTimeout(3000);
    const later = await main.page.screenshot();
    fs.writeFileSync(path.join(shots, 'default-later.png'), later);
    result.animation_diff = diff(main.png, later);
    result.animated = result.animation_diff > 0.002;

    // Clicks: find each mode's control by its text, click, compare.
    result.clicks = [];
    for (const m of cfg.modes || []) {
      const rec = { mode: m, found: false, diff_vs_before: null };
      try {
        const loc = main.page.getByRole('button', { name: new RegExp(`^\\W*${m}\\W*$`, 'i') })
          .or(main.page.getByText(new RegExp(`^\\W*${m}\\W*$`, 'i'))).first();
        if (await loc.count()) {
          rec.found = true;
          const before = await main.page.screenshot();
          await loc.click({ timeout: 5000 });
          await main.page.waitForTimeout(2000);
          const after = await main.page.screenshot();
          fs.writeFileSync(path.join(shots, `click-${m}.png`), after);
          rec.diff_vs_before = diff(before, after);
        }
      } catch (e) { rec.error = String(e).slice(0, 300); }
      result.clicks.push(rec);
    }
    await main.page.close();

    // Determinism: a second fresh load, same timing.
    const again = await load('', { measure: false });
    fs.writeFileSync(path.join(shots, 'default-second-load.png'), again.png);
    result.second_load_diff = diff(main.png, again.png);
    await again.page.close();

    // Modes via the URL parameter.
    result.modes = [];
    for (const m of cfg.modes || []) {
      if (!cfg.mode_param) break;
      const one = await load(`?${encodeURIComponent(cfg.mode_param)}=${encodeURIComponent(m)}`);
      fs.writeFileSync(path.join(shots, `mode-${m}.png`), one.png);
      one.r.mode = m;
      one.r.diff_vs_default = diff(main.png, one.png);
      result.modes.push(one.r);
      await one.page.close();
    }
    result.rendered = indexExists && !result.blank && result.page_errors.length === 0;
    result.modes_rendered = result.modes.every((x) => !x.blank && x.page_errors.length === 0);
    fs.writeFileSync(path.join(out, 'screenshot.png'), main.png);
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(result, null, 2));
  } else {
    await main.page.close();
    const dir = path.join(root, '.preview');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'screenshot.png'), main.png);
    const lines = [
      indexExists ? 'Loaded index.html.' : 'No index.html in this directory.',
      `Screenshot: .preview/screenshot.png (1280x800). ${result.blank ? 'It looks blank.' : 'It is not blank.'}`,
      `Frames per second (software rendering): ${result.fps ?? 'n/a'}; canvases: ${result.canvases ?? 'n/a'}.`,
    ];
    for (const [label, list] of [['Page error', result.page_errors], ['Console error', result.console_errors], ['Blocked outside request', result.outside_requests], ['Missing file', result.missing_files]]) {
      for (const item of list.slice(0, 20)) lines.push(`${label}: ${item}`);
    }
    console.log(lines.join('\n'));
  }
} finally {
  await browser.close();
  server.close();
}
