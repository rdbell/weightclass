// Interactive validation of a chess-lesson scene (RUN_PROTOCOL.md section 4:
// legal supplied moves, board states, orientation, seeking, captures, mate and
// controls). Runs in the harness image with no network:
//
//   /work           the run's workspace (read-only), three.js at /work/vendor/three
//   /reference.json legal reference positions, one per ply ({san, fen})
//   /adapter.mjs    how to read this particular lesson (see adapters/)
//   /out            interaction-validation.json and screenshots
//
// The board is read as DRAWN where the adapter can: visible, opaque piece
// meshes mapped back to squares, so a lesson whose logical state is right but
// whose pixels are wrong still fails. An adapter's hook only exposes module
// state; it never changes the lesson.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '/opt/weightclass/node_modules/playwright/index.mjs';
import adapter from '/adapter.mjs';

const ref = JSON.parse(fs.readFileSync('/reference.json', 'utf8'));
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const fenMap = fen => { const o = {}; fen.split(' ')[0].split('/').forEach((row, y) => { let x = 0; for (const c of row) { if (/\d/.test(c)) x += +c; else o['abcdefgh'[x++] + (8 - y)] = c; } }); return o; };
const refs = [fenMap(START), ...ref.map(x => fenMap(x.fen))];
const same = (a, b) => JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => a[k] !== b[k]).sort()
  .map(k => `${k}: shown ${a[k] || '-'}, ref ${b[k] || '-'}`);
const settle = adapter.settleMs ?? 1200;
// One step's autoplay samples, in order. The first samples of a step may still
// show the previous step's position (the move animation has not started yet);
// after that, only the step's own position or mid-animation frames (-1) are
// acceptable. previous_position_share separates a one-frame transition from a
// board that lags the lesson.
const judgeStep = (v, want, prev) => {
  let i = 0;
  while (i < v.length && prev != null && prev !== want && v[i] === prev) i++;
  const rest = v.slice(i);
  return { previous_position_share: prev == null || prev === want ? 0 : +(v.filter(k => k === prev).length / v.length).toFixed(2),
           shows_wrong_position: rest.some(k => k !== want && k !== -1) };
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.route('http://lesson.test/**', async route => {
  const p = new URL(route.request().url()).pathname;
  const f = path.join('/work', p === '/' ? 'index.html' : p);
  try {
    let body = fs.readFileSync(f);
    if (adapter.hook && p === '/' + adapter.hook.file) body = Buffer.from(body.toString() + '\n' + adapter.hook.code);
    await route.fulfill({ body, contentType: f.endsWith('.js') ? 'application/javascript' : f.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  } catch { await route.fulfill({ status: 404, body: 'missing' }); }
});
const call = (fn, ...a) => page.evaluate(`(${fn})(${a.map(x => JSON.stringify(x)).join(',')})`);
await page.goto('http://lesson.test/');
await page.waitForFunction(`(${adapter.ready})()`);
await page.waitForTimeout(1500);
const board = () => call(adapter.board);
const playing = () => call(adapter.playing);
const step = () => call(adapter.step);
const cells = page.locator(adapter.moveCells);

const r = { adapter: adapter.name, autoplay: await playing(), page_errors: errors };
let b = await board(); r.initial_board = same(b.o, refs[0]) && b.on_squares;
r.move_cells = await cells.count();

// Pause, then every ply through its move-list cell: after the move animation and again mid-hold.
if (await playing()) await page.locator(adapter.play).click();
await page.waitForTimeout(300);
r.paused_for_seek = !(await playing());
r.positions = [];
for (let k = 1; k <= 7; k++) {
  await cells.nth(k - 1).click();
  await page.waitForTimeout(settle);
  const a = await board();
  await page.waitForTimeout(1500);
  const c = await board();
  r.positions.push({ ply: k, san: ref[k - 1].san, reference_match: same(a.o, refs[k]) && same(c.o, refs[k]),
                     meshes_on_squares: a.on_squares && c.on_squares, differences: same(a.o, refs[k]) ? [] : diff(a.o, refs[k]) });
}
await page.screenshot({ path: '/out/validation-mate.png' });
// Backwards from mate to ply 6 restores the captured f7 pawn.
await cells.nth(5).click(); await page.waitForTimeout(settle);
b = await board(); r.capture_restored = same(b.o, refs[6]) && b.on_squares;
// Previous steps back.
const before = await step();
await page.locator(adapter.prev).click(); await page.waitForTimeout(settle);
r.previous_steps_back = (await step()) < before;
await page.screenshot({ path: '/out/validation-desktop.png' });
// Replay restarts from the opening position and plays.
await page.locator(adapter.replay).click(); await page.waitForTimeout(settle);
b = await board(); r.replay_initial = same(b.o, refs[0]) && b.on_squares;
r.replay_playing = await playing();
// Uninterrupted autoplay: which position every lesson step shows (-1 = none, i.e. mid-animation).
const expected = adapter.expectedPly ? await call(adapter.expectedPly) : null;
const seen = {}; const t0 = Date.now(); let quiet = 0, lastStep = -1;
while (Date.now() - t0 < (adapter.autoplayMaxMs ?? 240000)) {
  const s = await step(); const x = await board();
  (seen[s] ||= []).push(refs.findIndex(y => same(x.o, y)));
  if (adapter.finished && await call(adapter.finished)) break;
  quiet = s === lastStep ? quiet + 200 : 0; lastStep = s;
  if (!adapter.finished && quiet > (adapter.quietMs ?? 45000)) break;
  await page.waitForTimeout(200);
}
r.autoplay_steps = Object.keys(seen).map(Number).sort((a, c) => a - c).map(i => {
  const v = seen[i], want = expected ? expected[i] : null;
  return { step: i, expected_position_after_ply: want, samples: v.length, shown: [...new Set(v)],
           share_expected: want == null ? null : +(v.filter(k => k === want).length / v.length).toFixed(2),
           ...(want == null ? { shows_wrong_position: null } : judgeStep(v, want, expected && i > 0 ? expected[i - 1] : null)) };
});
b = await board(); r.autoplay_final_board = same(b.o, refs[7]) && b.on_squares;
// Pause holds the step.
await page.locator(adapter.replay).click(); await page.waitForTimeout(3000);
if (!(await playing())) await page.locator(adapter.play).click();
await page.locator(adapter.play).click(); const held = await step();
await page.waitForTimeout(6000);
r.pause = !(await playing()) && (await step()) === held;
await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(600);
r.mobile_no_horizontal_overflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
await page.screenshot({ path: '/out/validation-mobile.png', fullPage: true });
r.all_positions_match = r.positions.every(p => p.reference_match && p.meshes_on_squares);
r.autoplay_never_wrong = r.autoplay_steps.every(s => s.shows_wrong_position !== true);
fs.writeFileSync('/out/interaction-validation.json', JSON.stringify(r, null, 2));
console.log(JSON.stringify(r));
await browser.close();
