import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PS_PLAYWRIGHT_MODULE || 'playwright');
const root = process.env.PS_TEST_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const build = fs.readFileSync(path.join(root, 'studio/app.html'), 'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
const out = process.env.PS_TEST_OUTPUT || path.join(root, 'test-results/storage-safety');
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const server = http.createServer((request, response) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)); }
  catch { response.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(fs.readFileSync(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];

function fixture(kind) {
  const anchor = new Date(); anchor.setHours(12, 0, 0, 0); anchor.setDate(anchor.getDate() - (anchor.getDay() + 6) % 7);
  const date = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}`;
  const session = { slot: 'S1', time: '16:00', blocks: [], load: { rpe: 6 } };
  if (kind === 'review') session.review = { said: '주변을 먼저 확인했다', key: '다음에는 첫 터치를 전진 방향으로' };
  const days = ['월', '화', '수', '목', '금', '토', '일'].map((d, i) => ({ d, n: i + 1, rest: i !== 0, trainings: i === 0 ? [session] : [] }));
  days[0].board = { sched: '훈련', theme: '', trains: ['가상 론도'], trainSlot: ['S1'], trainData: [{ minutes: 15 }], trainThemes: ['스캔'] };
  return { version: 1, anchorMonday: date, scheduleRev: 1, weeks: { 0: days } };
}

async function ready(page) {
  await page.waitForFunction(() => typeof openSession === 'function' && window.PSStorage && typeof PSStorage.sharedReady === 'function');
  await page.evaluate(() => PSStorage.sharedReady());
}

async function seed(page, kind) {
  await page.evaluate(async raw => {
    await psSaveSharedAsync('process_coach_v1', raw);
    loadState({ raw }); wk = 0; week = weeksMap[0]; syncViews(false);
  }, JSON.stringify(fixture(kind)));
}

async function saved(page) {
  return page.evaluate(async () => {
    await PSStorage.sharedReady();
    const local = localStorage.getItem('process_coach_v1');
    const record = await storage.get('process_coach_v1');
    return { local: JSON.parse(local), idb: JSON.parse(record.value) };
  });
}

async function sharedStoreScenario(page, name) {
  await page.goto(base + '/studio/scout.html?fixture=storage-safety', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof store !== 'undefined' && typeof store.ready === 'function');
  await page.evaluate(() => PSStorage.sharedReady());
  const pending = await page.evaluate(() => {
    const key = 'cs_scout_targets_v1';
    window.fixtureStorageSet = storage.set.bind(storage);
    window.fixtureWriteGate = new Promise(resolve => { window.fixtureReleaseWrite = resolve; });
    storage.set = (k, raw) => k === key ? fixtureWriteGate.then(() => fixtureStorageSet(k, raw)) : fixtureStorageSet(k, raw);
    const accepted = store.set(key, { players: [{ id: 'fixture-target', type: 'target', name: '가상 후보 · 지연', levels: {} }] });
    return { accepted, state: PSSaveState.get('team'), pending: psHasPending() };
  });
  assert.deepEqual(pending, { accepted: true, state: 'saving', pending: true });
  const committed = await page.evaluate(async () => {
    fixtureReleaseWrite(); await store.ready();
    await PSStorage.sharedVerified('cs_scout_targets_v1', localStorage.getItem('cs_scout_targets_v1'));
    return { state: PSSaveState.get('team'), pending: psHasPending() };
  });
  assert.deepEqual(committed, { state: 'saved', pending: false });
  const failed = await page.evaluate(async () => {
    storage.set = (k, raw) => k === 'cs_scout_targets_v1' ? Promise.reject(new Error('fixture: disk unavailable')) : fixtureStorageSet(k, raw);
    store.set('cs_scout_targets_v1', { players: [{ id: 'fixture-target', type: 'target', name: '가상 후보 · 재시도', levels: {} }] });
    let rejected = false; try { await store.ready(); } catch (_) { rejected = true; }
    store.set('fixture_unrelated', { ok: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    return { rejected, state: PSSaveState.get('team'), pending: psHasPending() };
  });
  assert.deepEqual(failed, { rejected: true, state: 'failed', pending: true });
  await page.locator('#psSaveFailed').waitFor();
  await page.screenshot({ path: path.join(out, `${name}-save-failed.png`) });
  const recovered = await page.evaluate(async () => {
    storage.set = fixtureStorageSet;
    await psFlushPendingReady();
    await PSStorage.sharedVerified('cs_scout_targets_v1', localStorage.getItem('cs_scout_targets_v1'));
    return { state: PSSaveState.get('team'), pending: psHasPending() };
  });
  assert.deepEqual(recovered, { state: 'saved', pending: false });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof store !== 'undefined' && typeof store.ready === 'function');
  assert.equal(await page.evaluate(async () => JSON.parse((await storage.get('cs_scout_targets_v1')).value).players.find(p => p.id === 'fixture-target')?.name), '가상 후보 · 재시도');
  return ['delayed-commit', 'failed-commit-visible', 'unrelated-success-stays-failed', 'retry-recovery-reload'];
}

try {
  browser = await chromium.launch({ headless: true, ...(process.env.PS_CHROME_PATH ? { executablePath: process.env.PS_CHROME_PATH } : {}) });
  for (const spec of [
    { name: '375-mobile', width: 375, height: 812, touch: true, mobile: true },
    { name: '1100-coarse', width: 1100, height: 820, touch: true },
    { name: '1280-desktop', width: 1280, height: 900 }
  ]) {
    const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, hasTouch: !!spec.touch, isMobile: !!spec.mobile, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
    // This context is created for this test; no existing browser profiles or user tabs are used.
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base + '/studio/process.html?fixture=storage-safety', { waitUntil: 'domcontentloaded' });
    await ready(page);
    const cases = [];
    for (const kind of ['review', 'chips']) {
      for (const action of ['complete', 'close', 'escape']) {
        await seed(page, kind);
        await page.evaluate(() => { window.scrollTo(0, 0); openSession(0, 0); document.getElementById('sheet').scrollTop = 0; });
        await page.locator('#scrim.show').waitFor();
        await page.waitForTimeout(350);
        if (kind === 'review' && action === 'complete') {
          await page.screenshot({ path: path.join(out, `${spec.name}-session.png`) });
        }
        if (action === 'complete') await page.locator('#scrim button[onclick="commitSession()"]').click();
        else if (action === 'close') await page.locator('#scrim .closex').click();
        else await page.keyboard.press('Escape');
        await page.locator('#scrim.show').waitFor({ state: 'hidden' });
        const state = await saved(page);
        for (const medium of ['local', 'idb']) {
          assert.equal(state[medium].weeks[0][0].trainings.length, 1, `${spec.name} ${kind} ${action}: ${medium} session survives`);
          assert.equal(state[medium].weeks[0][0].rest, false);
          assert.deepEqual(state[medium].weeks[0][0].board.trains, ['가상 론도']);
          if (kind === 'review') assert.equal(state[medium].weeks[0][0].trainings[0].review.said, '주변을 먼저 확인했다');
        }
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page);
        assert.equal((await saved(page)).idb.weeks[0][0].trainings.length, 1, 'session survives reload');
        cases.push(`${kind}-${action}-reload`);
      }
    }
    await seed(page, 'review');
    await page.evaluate(() => openSession(0, null));
    await page.locator('#scrim button[onclick="commitSession()"]').click();
    assert.equal((await saved(page)).idb.weeks[0][0].trainings.length, 1, 'untouched new draft is not added');
    cases.push('empty-draft-discarded');
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, coarse: matchMedia('(any-pointer:coarse)').matches }));
    await page.screenshot({ path: path.join(out, `${spec.name}-saved.png`) });
    const storageCases = await sharedStoreScenario(page, spec.name);
    assert.deepEqual(errors, [], 'no application page errors');
    results.push({ viewport: spec.name, cases, storageCases, dimensions, pageErrors: errors });
    await context.close();
  }
  fs.writeFileSync(path.join(out, 'browser-results.json'), JSON.stringify({ ok: true, build, method: 'Isolated local Chrome, synthetic data, all non-local requests blocked', results }, null, 2));
  console.log(JSON.stringify({ ok: true, output: out, results }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
