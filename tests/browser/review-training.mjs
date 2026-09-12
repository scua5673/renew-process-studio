import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const playwright = require(process.env.PS_PLAYWRIGHT_MODULE || 'playwright');
const engine = process.env.PS_BROWSER_ENGINE || 'chromium';
assert.ok(['chromium','webkit'].includes(engine), 'supported test engine');
const browserType = playwright[engine];
const root = process.env.PS_TEST_REPO || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.env.PS_TEST_OUTPUT || path.join(root, 'test-results/review-training');
const build = fs.readFileSync(path.join(root, 'studio/app.html'), 'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  let file;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/fixture-review-host.html') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}iframe{display:block}</style><script src="/studio/storage.js"></script><script>window.fixtureMessages=[];window.addEventListener("message",function(e){var f=document.getElementById("fixtureScout");if(f&&e.source===f.contentWindow&&e.origin===location.origin&&e.data&&e.data.type==="reviewTrainingOpen")fixtureMessages.push(e.data);});</script><iframe id="fixtureScout" src="/studio/scout.html?fixture=review-training"></iframe>');
      return;
    }
    file = path.resolve(root, '.' + pathname);
  }
  catch { response.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
  try {
    const bytes = fs.readFileSync(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(bytes);
  } catch { response.writeHead(404).end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const base = `http://127.0.0.1:${server.address().port}`;
const KEY = 'process_coach_v1', MATCH_KEY = 'cs_team_matches_v1';
const MID = 'fixture-review-match', WID = 'fixture-review-team', UID = 'fixture-review-account';
const syncSource = fs.readFileSync(path.join(root, 'studio/sync.js'), 'utf8');
const syncFunction = name => {
  const start = syncSource.indexOf('function ' + name + '(');
  const end = syncSource.indexOf('\nfunction ', start + 1);
  assert.ok(start >= 0 && end > start, 'actual readiness function ' + name);
  return syncSource.slice(start, end);
};
// Real readiness reader, synthetic authentication and confirmed-store marker.
// schedule-readiness.test.cjs separately exercises actual sync generation of it.
const readinessSource = `var MATCH_KEY='cs_team_matches_v1',SCHEDULE_KEY='process_coach_v1',MKEY='ps_sync_meta',OWNERKEY='ps_cache_owner_v1';
var matchReadyPending=false,scheduleReadyPending=false;
function getSess(){return JSON.parse(localStorage.getItem('ps_sync_session')||'null');}
function activeWs(){return localStorage.getItem('ps_active_ws');}
function dataUnlocked(){return true;}
${['meta','keyReady','scheduleReadyRaw'].map(syncFunction).join('\n')}
return keyReady;`;
const PRIVATE = '가상 비공개 개선점 · 개인 이름과 내부 판단은 일정에 남기지 않음';
const LEGACY_PRIVATE = 'AUDIT_PRIVATE_LEGACY_TRAINING_ACTION';
const ACTION = '측면으로 공이 이동하면 가까운 수비수가 커버 위치를 먼저 잡는다.';
const OBSERVATION = '후반 두 장면에서 커버 위치를 먼저 잡았다. 다음에는 반대쪽도 확인한다.';
const iso = date => date.toISOString().slice(0, 10);
const today = new Date(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()) + 'T00:00:00Z');
const anchor = new Date(today); anchor.setUTCDate(anchor.getUTCDate() - (anchor.getUTCDay() + 6) % 7);
const target = new Date(today); target.setUTCDate(target.getUTCDate() + 1);
const prior = new Date(today); prior.setUTCDate(prior.getUTCDate() - 1);
const targetDate = iso(target), matchDate = iso(prior);
const targetOffset = Math.round((target - anchor) / 864e5), targetWeek = Math.floor(targetOffset / 7), targetDay = targetOffset % 7;
const matchFixture = { v: 1, matches: [{ id: MID, date: matchDate, opponent: '가상 상대', scoreUs: '1', scoreThem: '1',
  reviewPublished: false, reviewImprove: PRIVATE, reviewGood: 'AUDIT_PRIVATE_GOOD', resultSummary: 'AUDIT_PRIVATE_SUMMARY',
  phaseReview: { attack: { improve: '가상 국면 개선점', note: 'AUDIT_PRIVATE_PHASE_NOTE' } }, trainingAction: LEGACY_PRIVATE }] };

function scheduleFixture() {
  const weeks = {};
  for (let w = 0; w <= targetWeek; w++) {
    weeks[w] = ['월', '화', '수', '목', '금', '토', '일'].map((d, i) => ({ d, n: i + 1, rest: false, trainings: [], board: { sched: '훈련', theme: '가상 팀 훈련' } }));
  }
  return { version: 1, anchorMonday: iso(anchor), scheduleRev: 1, weeks };
}

async function contextFor(browser, spec, role = 'admin') {
  const context = await browser.newContext({ viewport: { width: spec.width, height: spec.height }, hasTouch: !!spec.touch,
    isMobile: !!spec.mobile, serviceWorkers: 'block', timezoneId: 'Asia/Seoul' });
  // Every scenario gets a new temporary profile. No production host, account, or browser storage is accessed.
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort('blockedbyclient'));
  await context.addInitScript(({ uid, wid, role, readinessSource }) => {
    if (!localStorage.getItem('fixture-review-seeded')) {
      localStorage.setItem('fixture-review-seeded', '1');
      localStorage.setItem('ps_sync_session', JSON.stringify({ uid, at: 'fixture-not-a-real-token' }));
      localStorage.setItem('ps_active_ws', wid);
      localStorage.setItem('ps_cache_owner_v1', JSON.stringify({v:1,uid,wid,nonce:'fixture'}));
      localStorage.setItem('ps_ws_list', JSON.stringify([{ id: wid, kind: 'team', name: '가상 QA 팀', role: role === 'admin' ? 'owner' : 'member' }]));
      localStorage.setItem('cs_perms_v1', JSON.stringify({ v: 1, defaultRole: 'player', members: { [uid]: { role: role === 'admin' ? 'executive' : 'player' } } }));
      localStorage.setItem('cs_lang', 'ko');
      localStorage.setItem('cs_wkmode', 'ses');
    }
    window.PSSync = { session: () => JSON.parse(localStorage.getItem('ps_sync_session') || 'null'), dataUnlocked: () => true,
      keyReady: new Function(readinessSource)() };
  }, { uid: UID, wid: WID, role, readinessSource });
  return context;
}

async function ready(page) {
  await page.waitForFunction(() => typeof loadState === 'function' && typeof weeksMap !== 'undefined' &&
    typeof week !== 'undefined' && window.PSReviewSchedule && window.PSReviewTraining && window.PSStorage && window.PSPerms);
  await page.evaluate(() => PSStorage.sharedReady());
}

async function prepare(page, doc = scheduleFixture()) {
  await page.goto(base + '/studio/process.html?fixture=review-training', { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.evaluate(async ({ schedule, matches, w, di }) => {
    await psSaveSharedAsync('cs_team_matches_v1', JSON.stringify(matches));
    const raw = JSON.stringify(schedule);
    await psSaveSharedAsync('process_coach_v1', raw);
    await PSStorage.sharedVerified('process_coach_v1', raw);
    const session = JSON.parse(localStorage.getItem('ps_sync_session'));
    const wid = localStorage.getItem('ps_active_ws');
    const marker = {w:wid,u:session.uid,o:localStorage.getItem('ps_cache_owner_v1'),present:true};
    localStorage.setItem('ps_sync_meta',JSON.stringify({h:{},c:{},r:{process_coach_v1:marker,cs_team_matches_v1:marker}}));
    if(!PSSync.keyReady('process_coach_v1',wid))throw new Error('actual schedule readiness reader rejected fixture');
    loadState({ raw }); schedGrpAfterLoad(schedule);
    wk = w; dayIdx = di; week = weeksMap[w];
    go('schedule'); setWkMode('ses'); focusScheduleDate(w, di); syncViews(false);
  }, { schedule: doc, matches: matchFixture, w: targetWeek, di: targetDay });
}

async function stored(page) {
  return page.evaluate(async ({ key, mid }) => {
    await PSStorage.sharedReady(key);
    const local = localStorage.getItem(key), record = await storage.get(key);
    if (!local || !record?.value) throw new Error('schedule missing from localStorage or IndexedDB');
    await PSStorage.sharedVerified(key, local);
    return { local: JSON.parse(local), idb: JSON.parse(record.value), rows: PSReviewTraining.forMatch(JSON.parse(record.value), mid) };
  }, { key: KEY, mid: MID });
}

async function openCreate(page) {
  const opened = await page.evaluate(mid => PSReviewSchedule.open({ matchId: mid }), MID);
  assert.equal(opened, true, 'real open handler accepts authorized match');
  await page.locator('#sheet[data-review-training]').waitFor({ state: 'visible' });
  assert.match(await page.locator('.rt-scope').innerText(), /선수도 읽을 수 있는 팀 일정/);
}

async function fillCreate(page, { action = ACTION, group = 'A팀', source = 'reviewImprove' } = {}) {
  if (source) {
    await page.locator('#rtSource').selectOption(source);
    await page.locator('#rtCopy').click();
    assert.equal(await page.locator('#rtAction').inputValue(), source === 'reviewImprove' ? PRIVATE : '가상 국면 개선점');
  }
  await page.locator('#rtAction').fill(action);
  await page.locator('#rtDate').fill(targetDate);
  await page.locator('#rtGroup').selectOption(group);
}

async function sheetLayout(page, spec, name) {
  await page.waitForFunction(() => document.getElementById('scrim').getAnimations({ subtree: true }).every(animation =>
    animation.playState !== 'running' || animation.effect?.getComputedTiming().iterations === Infinity));
  const layout = await page.evaluate(() => {
    const sheet = document.querySelector('#sheet[data-review-training]'), rect = sheet.getBoundingClientRect();
    const close = sheet.querySelector('[data-rt-close]'), closeRect = close.getBoundingClientRect();
    const hit = document.elementFromPoint(closeRect.left + closeRect.width / 2, closeRect.top + closeRect.height / 2);
    return { width: innerWidth, height: innerHeight, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      close: { left: closeRect.left, right: closeRect.right, top: closeRect.top, bottom: closeRect.bottom,
        width: closeRect.width, height: closeRect.height, reachable: hit === close || close.contains(hit) },
      clientWidth: sheet.clientWidth, scrollWidth: sheet.scrollWidth, clientHeight: sheet.clientHeight, scrollHeight: sheet.scrollHeight };
  });
  assert.ok(layout.left >= -1 && layout.right <= layout.width + 1, `${spec.name} ${name}: sheet fits viewport horizontally`);
  assert.ok(layout.scrollWidth <= layout.clientWidth + 1, `${spec.name} ${name}: sheet has no horizontal overflow`);
  assert.ok(layout.close.left >= layout.left && layout.close.right <= layout.right && layout.close.top >= layout.top &&
    layout.close.bottom <= layout.bottom, `${spec.name} ${name}: close button is inside the sheet`);
  assert.ok(layout.close.left >= 0 && layout.close.right <= layout.width && layout.close.top >= 0 &&
    layout.close.bottom <= layout.height, `${spec.name} ${name}: close button fits the viewport`);
  assert.ok(layout.close.width >= 44 && layout.close.height >= 44 && layout.close.reachable,
    `${spec.name} ${name}: close button has a reachable 44px target`);
  await page.screenshot({ path: path.join(out, `${spec.name}-${name}.png`), animations: 'disabled' });
  return layout;
}

async function reloadAndFocus(page) {
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page);
  await page.evaluate(({ w, di }) => { go('schedule'); focusScheduleDate(w, di); setWkMode('ses'); }, { w: targetWeek, di: targetDay });
}

async function adminScenario(page, spec, result) {
  await prepare(page);
  const originalMatches = await page.evaluate(key => localStorage.getItem(key), MATCH_KEY);
  assert.equal(await page.evaluate(() => PSReviewSchedule.canWrite()), true);

  await openCreate(page); await fillCreate(page);
  result.createLayout = await sheetLayout(page, spec, 'create');
  if(spec.mobile){
    const shifted=await page.evaluate(()=>{const app=document.getElementById('scrim').parentElement;const before={x:scrollX,y:scrollY,left:app.scrollLeft};app.scrollLeft=34;window.scrollTo(0,78);return {before,left:app.scrollLeft,y:scrollY};});
    assert.ok(shifted.left>0&&shifted.y>0,'fixture reproduces focus-driven ancestor scrolling');
    result.scrolledLayout=await sheetLayout(page,spec,'scrolled-ancestors');
    await page.evaluate(before=>{document.getElementById('scrim').parentElement.scrollLeft=before.left;window.scrollTo(before.x,before.y);},shifted.before);
    result.cases.push('sheet-stays-visible-with-scrolled-ancestors');
  }
  await page.locator('[data-rt-close]').click();
  await page.locator('#scrim.show').waitFor({ state: 'hidden' });
  assert.equal((await stored(page)).rows.length, 0, 'cancelled draft creates no task');
  result.cases.push('cancel-without-write');

  await openCreate(page); await fillCreate(page);
  await page.evaluate(key => {
    window.fixtureStorageSet = storage.set.bind(storage);
    window.fixtureWriteGate = new Promise(resolve => { window.fixtureReleaseWrite = resolve; });
    storage.set = (k, raw) => k === key ? fixtureWriteGate.then(() => fixtureStorageSet(k, raw)) : fixtureStorageSet(k, raw);
  }, KEY);
  await page.locator('#rtSave').click();
  for (const id of ['rtSource', 'rtCopy', 'rtAction', 'rtDate', 'rtGroup', 'rtSave']) {
    assert.equal(await page.locator('#' + id).isDisabled(), true, `${id} stays locked while IndexedDB is pending`);
  }
  await page.locator('[data-rt-close]').click();
  assert.equal(await page.locator('#scrim.show').isVisible(), true, 'pending save keeps its editor open');
  await page.evaluate(() => { storage.set = fixtureStorageSet; fixtureReleaseWrite(); });
  await page.locator('#scrim.show').waitFor({ state: 'hidden' });
  let state = await stored(page);
  assert.equal(state.rows.length, 1);
  const taskId = state.rows[0].task.id;
  assert.equal(state.rows[0].date, targetDate);
  assert.equal(state.rows[0].task.action, ACTION);
  assert.equal(state.rows[0].task.sourceKey, 'reviewImprove');
  assert.deepEqual(state.rows[0].task.grp, ['A팀']);
  assert.equal(state.rows[0].task.status, 'planned');
  assert.deepEqual(state.local, state.idb, 'local mirror and actual IndexedDB agree');
  for (const secret of [PRIVATE, LEGACY_PRIVATE, 'AUDIT_PRIVATE_GOOD', 'AUDIT_PRIVATE_SUMMARY', 'AUDIT_PRIVATE_PHASE_NOTE']) {
    assert.ok(!JSON.stringify(state.idb).includes(secret), 'source/private match text is not copied to schedule');
  }
  assert.equal(await page.evaluate(key => localStorage.getItem(key), MATCH_KEY), originalMatches, 'source match record remains unchanged');
  result.cases.push('source-edit-date-group-idb', 'pending-save-locks-inputs-and-close');

  await reloadAndFocus(page);
  state = await stored(page); assert.equal(state.rows[0].task.id, taskId);
  const taskButton = page.locator(`#wkBoard [data-rt-task="${taskId}"]`);
  await taskButton.waitFor({ state: 'visible' });
  await taskButton.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${spec.name}-planned-card.png`) });
  await taskButton.click();
  await page.locator('#rtStatus').waitFor({ state: 'visible' });
  await page.locator('#rtStatus').selectOption('done');
  await page.locator('#rtObservation').fill(OBSERVATION);
  result.resultLayout = await sheetLayout(page, spec, 'result');
  await page.locator('#rtSave').click();
  await page.locator('#scrim.show').waitFor({ state: 'hidden' });
  await reloadAndFocus(page);
  state = await stored(page);
  assert.equal(state.rows.length, 1);
  assert.equal(state.rows[0].task.status, 'done');
  assert.equal(state.rows[0].task.observation, OBSERVATION);
  assert.match(await page.locator(`#wkBoard [data-rt-task="${taskId}"]`).innerText(), /결과 남김/);
  result.cases.push('real-card-click-result-save-reload');

  await openCreate(page); await fillCreate(page, { action: ACTION.replace('공이 이동하면', '공이   이동하면') });
  await page.locator('#rtSave').click();
  await page.locator('#rtStatus').waitFor({ state: 'visible' });
  assert.equal((await stored(page)).rows.length, 1, 'same match/date/action/group opens existing task instead of duplicating');
  assert.equal(await page.locator('#rtObservation').inputValue(), OBSERVATION, 'duplicate detection preserves the existing result');
  await page.locator('[data-rt-close]').click();
  result.cases.push('duplicate-opens-existing-result');

  await page.evaluate(() => schedSetGrp('B팀'));
  assert.equal(await page.locator(`#wkBoard [data-rt-task="${taskId}"]`).count(), 0, 'another group does not see this group task');
  await page.evaluate(() => schedSetGrp('A팀'));
  await page.locator(`#wkBoard [data-rt-task="${taskId}"]`).waitFor({ state: 'visible' });
  await page.evaluate(() => schedSetGrp(''));
  result.cases.push('group-filter');
  await page.locator(`#wkBoard [data-rt-task="${taskId}"]`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${spec.name}-result-card.png`) });
  result.task = (await stored(page)).rows[0];
  return (await stored(page)).idb;
}

async function playerScenario(page, spec, schedule, result) {
  await prepare(page, schedule);
  // Seed the isolated fixture as its administrator, then enter a fresh player page.
  // Writing fixture data after the player guard is active would test the setup, not the feature.
  await stored(page);
  await page.evaluate(({ uid, wid }) => {
    localStorage.setItem('cs_perms_v1', JSON.stringify({ v: 1, defaultRole: 'player', members: { [uid]: { role: 'player' } } }));
    localStorage.setItem('ps_ws_list', JSON.stringify([{ id: wid, kind: 'team', name: '가상 QA 팀', role: 'member' }]));
  }, { uid: UID, wid: WID });
  await reloadAndFocus(page);
  const before = await stored(page);
  assert.equal(await page.evaluate(() => PSPerms.role()), 'player');
  assert.equal(await page.evaluate(() => PSReviewSchedule.canWrite()), false);
  assert.equal(await page.evaluate(mid => PSReviewSchedule.open({ matchId: mid }), MID), false, 'player cannot open create flow');
  assert.equal(await page.locator('#sheet[data-review-training]').count(), 0);
  await page.evaluate(() => PSReviewSchedule.commit());
  assert.deepEqual((await stored(page)).idb, before.idb, 'player create/commit attempt cannot change the schedule');
  const strip = await page.locator('#wkBoard').innerText();
  assert.ok(!strip.includes(LEGACY_PRIVATE), 'unpublished legacy trainingAction is hidden from the player schedule');
  const taskId = before.rows[0].task.id;
  // The readonly result view must have no usable mutation controls, even if opened through its public API.
  assert.equal(await page.evaluate(id => PSReviewSchedule.open({ taskId: id }), taskId), true);
  assert.equal(await page.locator('#rtSave').count(), 0);
  assert.equal(await page.locator('#rtAction').isDisabled(), true);
  assert.equal(await page.locator('#rtStatus').isDisabled(), true);
  assert.equal(await page.locator('#rtObservation').isDisabled(), true);
  await page.evaluate(() => PSReviewSchedule.commit());
  assert.deepEqual((await stored(page)).idb, before.idb, 'player cannot save through the direct commit API');
  result.playerLayout = await sheetLayout(page, spec, 'player-readonly');
  await page.evaluate(() => PSReviewSchedule.close());
  result.cases.push('player-create-and-update-blocked', 'unpublished-legacy-strip-hidden');
}

async function scoutScenario(page, spec, schedule, result) {
  await page.goto(base + '/fixture-review-host.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.getElementById('fixtureScout')?.contentWindow.location.pathname === '/studio/scout.html');
  const frame = page.frame({ url: /\/studio\/scout\.html\?fixture=review-training$/ });
  assert.ok(frame, 'real scout iframe is mounted');
  await frame.waitForFunction(() => typeof matchLoad === 'function' && typeof matchState !== 'undefined' &&
    window.PSReviewTraining && typeof matchReviewTrainingOpen === 'function' && typeof store.ready === 'function');
  await frame.evaluate(async ({ matches, schedule, mid }) => {
    await PSStorage.sharedReady();
    if (!store.set('cs_team_matches_v1', matches) || !store.set('process_coach_v1', schedule)) throw new Error('fixture admission failed');
    await store.ready();
    await PSStorage.sharedVerified('process_coach_v1',JSON.stringify(schedule));
    const session=JSON.parse(localStorage.getItem('ps_sync_session')),wid=localStorage.getItem('ps_active_ws');
    const marker={w:wid,u:session.uid,o:localStorage.getItem('ps_cache_owner_v1'),present:true};
    localStorage.setItem('ps_sync_meta',JSON.stringify({h:{},c:{},r:{process_coach_v1:marker,cs_team_matches_v1:marker}}));
    if(!parent.PSSync.keyReady('process_coach_v1',wid))throw new Error('actual scout readiness reader rejected fixture');
    matchState = null; matchLoad(); setView('match'); matchOpen(mid);
  }, { matches: { ...matchFixture, matches: [...matchFixture.matches, { ...matchFixture.matches[0], id: 'fixture-other-match', opponent: '다른 가상 상대' }] }, schedule, mid: MID });
  await frame.locator('[data-match-step="review"]').click();
  const taskId = result.task.task.id;
  const card = frame.locator('#matchTrainingCard');
  await card.waitFor({ state: 'visible' });
  assert.match(await card.innerText(), /결과 남김/);
  assert.ok((await card.innerText()).includes(ACTION));
  assert.ok((await card.innerText()).includes(OBSERVATION));
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${spec.name}-scout-linked-card.png`), animations: 'disabled' });

  await frame.locator('#matchTrainingOpen').click();
  await page.waitForFunction(() => fixtureMessages.length === 1);
  let message = await page.evaluate(() => fixtureMessages[0]);
  assert.deepEqual(Object.keys(message).sort(), ['matchId', 'requestId', 'source', 'type', 'uid', 'wid']);
  assert.equal(message.matchId, MID); assert.equal(message.uid, UID); assert.equal(message.wid, WID);
  assert.equal(message.type, 'reviewTrainingOpen');
  assert.ok(!JSON.stringify(message).includes(PRIVATE), 'CTA sends identifiers, not review text');
  await frame.locator(`[data-review-training-task="${taskId}"]`).click();
  await page.waitForFunction(() => fixtureMessages.length === 2);
  message = await page.evaluate(() => fixtureMessages[1]);
  assert.equal(message.taskId, taskId); assert.equal(message.matchId, MID);
  result.cases.push('scout-real-card-and-cta-parent-message');

  const refreshed = '저장 메시지로 받은 가상 관찰 결과';
  await frame.evaluate(async ({ taskId, refreshed }) => {
    const doc = store.get('process_coach_v1');
    const row = PSReviewTraining.list(doc).find(row => row.task.id === taskId);
    row.task.observation = refreshed; row.task.updatedAt = Date.now();
    store.set('process_coach_v1', doc); await store.ready();
  }, { taskId, refreshed });
  await page.evaluate(({ uid, wid, mid, taskId }) => document.getElementById('fixtureScout').contentWindow.postMessage(
    { source: 'app', type: 'reviewTrainingSaved', uid, wid, matchId: mid, taskId }, location.origin), { uid: UID, wid: WID, mid: MID, taskId });
  await frame.waitForFunction(text => document.getElementById('matchTrainingTasks').innerText.includes(text), refreshed);
  assert.equal(await frame.evaluate(() => matchCurrent), MID, 'saved refresh keeps the current match');
  result.cases.push('scout-saved-message-refresh');

  await frame.evaluate(() => { matchTab = 'prep'; matchStage = 'prep'; matchOpen('fixture-other-match'); });
  assert.equal(await frame.evaluate(() => matchCurrent), 'fixture-other-match');
  await page.evaluate(({ uid, wid, mid }) => document.getElementById('fixtureScout').contentWindow.postMessage(
    { source: 'app', type: 'reviewTrainingBack', uid, wid, matchId: mid }, location.origin), { uid: UID, wid: WID, mid: MID });
  await frame.waitForFunction(mid => matchCurrent === mid && matchTab === 'review' && matchStage === 'review', MID);
  assert.equal(await frame.locator('#matchTitle').innerText(), '가상 상대');
  await card.waitFor({ state: 'visible' });
  assert.ok((await card.innerText()).includes(refreshed));
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(out, `${spec.name}-scout-returned-review.png`), animations: 'disabled' });
  result.cases.push('scout-back-message-correct-match-and-review');
}

let browser;
const results = [], failures = [];
try {
  browser = await browserType.launch({ headless: true, ...(engine === 'chromium' && process.env.PS_CHROME_PATH ? { executablePath: process.env.PS_CHROME_PATH } : {}) });
  for (const spec of [
    { name: '375-phone', width: 375, height: 812, touch: true, mobile: true },
    { name: '768-tablet', width: 768, height: 820, touch: true },
    { name: '1280-desktop', width: 1280, height: 900 }
  ]) {
    const result = { viewport: spec.name, cases: [], pageErrors: [] };
    results.push(result);
    let context, page;
    try {
      context = await contextFor(browser, spec);
      page = await context.newPage(); page.setDefaultTimeout(12000);
      page.on('pageerror', error => result.pageErrors.push(error.stack || String(error)));
      const schedule = await adminScenario(page, spec, result);
      await context.close(); context = await contextFor(browser, spec);
      page = await context.newPage(); page.setDefaultTimeout(12000);
      page.on('pageerror', error => result.pageErrors.push(error.stack || String(error)));
      await playerScenario(page, spec, schedule, result);
      await context.close(); context = await contextFor(browser, spec);
      page = await context.newPage(); page.setDefaultTimeout(12000);
      page.on('pageerror', error => result.pageErrors.push(error.stack || String(error)));
      await scoutScenario(page, spec, schedule, result);
      assert.deepEqual(result.pageErrors, [], 'no uncaught application errors');
      result.ok = true;
    } catch (error) {
      result.ok = false; result.error = error.stack || String(error);
      failures.push({ viewport: spec.name, error: result.error });
      if (page && !page.isClosed()) {
        result.failureState = await page.evaluate(() => ({ url: location.pathname, title: document.title,
          error: document.getElementById('rtError')?.textContent, sheet: document.getElementById('sheet')?.innerText })).catch(() => null);
        await page.screenshot({ path: path.join(out, `${spec.name}-failure.png`) }).catch(() => {});
      }
    } finally { if (context) await context.close(); }
  }
  const report = { ok: failures.length === 0, build, engine, method: 'Isolated local browser; synthetic admin/player accounts; every non-local request blocked; actual UI and IndexedDB', targetDate, matchDate, results };
  fs.writeFileSync(path.join(out, 'review-training-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, output: out, results: results.map(({ viewport, ok, cases, error }) => ({ viewport, ok, cases, error })) }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
