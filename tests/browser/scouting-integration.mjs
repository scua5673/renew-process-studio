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
const out = process.env.PS_TEST_OUTPUT || path.join(root, 'test-results/scouting-integration');
const build = fs.readFileSync(path.join(root, 'studio/app.html'), 'utf8').match(/window\.PS_BUILD='([^']+)'/)[1];
fs.mkdirSync(out, { recursive: true });
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((request, response) => {
  let file;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (pathname === '/fixture-review-host.html') {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,iframe{margin:0;width:100%;height:100%;border:0}iframe{display:block}</style><script src="/studio/storage.js"></script><script src="/studio/scouting-store.js"></script><script>window.fixtureMessages=[];window.addEventListener("message",function(e){var f=document.getElementById("fixtureScout");if(f&&e.source===f.contentWindow&&e.origin===location.origin&&e.data&&e.data.type==="reviewTrainingOpen")fixtureMessages.push(e.data);});</script><iframe id="fixtureScout" src="/studio/scout.html?fixture=review-training"></iframe>');
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
var SCOUT_KEY='cs_scout_targets_v1',scoutReadyPending=false;
function isTeamWs(){return true;}
function activeWsObj(){return JSON.parse(localStorage.getItem('ps_ws_list')||'[]').find(w=>w.id===activeWs());}
function permsRaw(){return localStorage.getItem('cs_perms_v1');}
${['scoutWriteAllowed','scoutReadyRaw'].map(syncFunction).join('\n')}
return keyReady;`;
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


const TARGETS='cs_scout_targets_v1';
const targetFixture={v:1,players:[{id:'qa-candidate',dbId:'qa-db',type:'target',name:'가상 후보',club:'현재 팀',grade:'B',posId:'pos_GK',num:'11',foot:'L',levels:{fifa_scan:4},memo:'반드시 남길 관찰 기록'},{id:'qa-other-placement',dbId:'qa-db',type:'target',name:'옛 표기',club:'다른 기록 팀',grade:'A',posId:'pos_LW',levels:{fifa_scan:2},memo:'다른 배치의 기록'}]};
const oldDb={players:[{id:'qa-db',nameKr:'옛 후보명',club:'옛 등록팀',grade:'S',pos:['ST'],points:{'가상 공격|공간을 먼저 찾는가?':3},ratings:{전술:4},photo:'data:image/png;base64,'+'A'.repeat(65536)},{id:'unselected-local',nameKr:'가져오지 않을 후보'}],meta:{pointSets:[{name:'가상 공격',positions:['ST'],text:'## 움직임\n공간을 먼저 찾는가?'}]}};
let browser;const results=[];
try{
 browser=await browserType.launch(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{});
 for(const width of [1280,375]){
  const context=await contextFor(browser,{width,height:900,mobile:width<600,touch:width<600}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/fixture-review-host.html');
  const frame=page.frame({url:/studio\/scout\.html/});
  await frame.waitForFunction(()=>typeof scPrepare==='function'&&window.PSPerms);
  await frame.evaluate(async ({targets,oldDb})=>{
    await PSStorage.sharedReady();await psSaveSharedAsync('cs_scout_targets_v1',JSON.stringify(targets));await PSStorage.sharedVerified('cs_scout_targets_v1',JSON.stringify(targets));
    localStorage.setItem('cs_scoutdb_v1',JSON.stringify(oldDb));
    const sess=JSON.parse(localStorage.getItem('ps_sync_session')),wid=localStorage.getItem('ps_active_ws'),seal=localStorage.getItem('ps_cache_owner_v1');
    localStorage.setItem('ps_sync_meta',JSON.stringify({h:{},c:{},r:{cs_scout_targets_v1:{w:wid,u:sess.uid,o:seal,present:true}}}));
    await scPrepare();setView('players');sbSetTab('cands');
  },{targets:targetFixture,oldDb});
  await frame.waitForFunction(()=>scStore().state.verified&&data.players.some(p=>p.id==='qa-candidate'));
  assert.equal(await frame.locator('#scDbHits').innerText(),'','local DB is not automatically attributed to this team');
  await frame.locator('[data-sc-import]').click();await frame.locator('[data-legacy-id="qa-db"]').check();await frame.locator('#scImportPoints').check();await frame.locator('[data-import]').click();
  await frame.evaluate(()=>store.ready());
  assert.equal(await frame.evaluate(()=>scStore().state.doc.scoutRegistry.candidates['db:unselected-local']),undefined);
  await frame.locator('[data-sccard="qa-candidate"]').click();
  await frame.locator('#plName').fill('원본 하나로 바꾼 이름');
  await frame.locator('#plName').focus();
  await frame.evaluate(()=>{window.__candidateInput=document.getElementById('plName');});
  await page.evaluate(()=>{let m=JSON.parse(localStorage.getItem('ps_sync_meta'));m.last=Date.now();localStorage.setItem('ps_sync_meta',JSON.stringify(m));});
  await frame.waitForTimeout(60);
  assert.equal(await frame.evaluate(()=>document.getElementById('plName')===window.__candidateInput&&document.activeElement===window.__candidateInput&&!!editingPlayer),true,'routine sync keeps candidate profile and focus');
  await page.evaluate(()=>{window.__readyMeta=localStorage.getItem('ps_sync_meta');const m=JSON.parse(__readyMeta);delete m.r.cs_scout_targets_v1;localStorage.setItem('ps_sync_meta',JSON.stringify(m));});
  assert.equal(await frame.evaluate(()=>{const e=new InputEvent('beforeinput',{bubbles:true,cancelable:true,data:'x',inputType:'insertText'});return document.getElementById('plName').dispatchEvent(e);}),false,'temporary readiness loss blocks mutation');
  assert.equal(await frame.evaluate(()=>!!editingPlayer&&document.getElementById('plName')===window.__candidateInput),true,'temporary readiness loss preserves editor and text');
  await frame.evaluate(()=>{scStore().state.verified=false;});
  await page.evaluate(()=>localStorage.setItem('ps_sync_meta',window.__readyMeta));
  await frame.waitForFunction(()=>scStore().state.verified);
  assert.equal(await frame.evaluate(()=>{const e=new InputEvent('beforeinput',{bubbles:true,cancelable:true,data:'x',inputType:'insertText'});return document.getElementById('plName').dispatchEvent(e);}),true,'input resumes after readiness returns');


  await frame.evaluate(()=>store.ready());
  assert.deepEqual(await frame.evaluate(()=>data.players.filter(p=>p.dbId==='qa-db').map(p=>p.name)),['원본 하나로 바꾼 이름','원본 하나로 바꾼 이름']);
  await frame.locator('#plScoutIdentity > details').first().locator('summary').first().click();
  assert.equal(await frame.locator('#plScoutIdentity').innerText().then(t=>t.includes('다른 기록 팀')),true);
  await frame.locator('#plScoutPoints summary').click();
  await frame.waitForFunction(()=>document.querySelector('#plScoutPoints iframe').contentWindow.location.href.includes('view=evaluate'));
  let evaluator=page.frames().find(f=>f.url().includes('view=evaluate'));
  try{await evaluator.locator('#ptEval.on').waitFor({timeout:10000});}catch(e){console.log('EVALUATOR',await evaluator.locator('body').innerText(),errors);await page.screenshot({path:path.join(out,'failed-evaluator.png')});throw e;}await evaluator.locator('#scStoreState').waitFor({state:'hidden'});
  assert.match(await evaluator.locator('#ptEvalBody').innerText(),/공간을 먼저 찾는가/);
  await evaluator.locator('.pe-q .pe-rate button').nth(3).click();
  await evaluator.evaluate(()=>PSStorage.sharedReady());
  await frame.waitForFunction(()=>JSON.parse(localStorage.getItem('cs_scout_targets_v1')).scoutRegistry.candidates['db:qa-db'].points['가상 공격|공간을 먼저 찾는가?']===4);
  await frame.evaluate(async()=>{await scPrepare();});
  assert.equal(await frame.evaluate(()=>!!editingPlayer&&document.getElementById('plScoutPoints').open),true,'child point save keeps profile and evaluator open');
  assert.equal(page.frames().find(f=>f.url().includes('view=evaluate')),evaluator,'same evaluation frame remains available');
  await evaluator.locator('.pe-q .pe-rate button').nth(4).click();await evaluator.evaluate(()=>PSStorage.sharedReady());
  await evaluator.locator('.pe-q .pe-rate button').nth(3).click();await evaluator.evaluate(()=>PSStorage.sharedReady());
  await frame.evaluate(async()=>{await scPrepare();});
  const sourceSize=await frame.evaluate(()=>{const c=scStore().state.doc.scoutRegistry.candidates['db:qa-db'];return {count:(c.sourceHistory||[]).length,size:JSON.stringify(c).length};});
  for(let i=0;i<22;i++){await evaluator.locator('.pe-q .pe-rate button').nth(i%2?3:4).click();await evaluator.evaluate(()=>PSStorage.sharedReady());}
  await frame.evaluate(async()=>{await scPrepare();});
  const scoredSize=await frame.evaluate(()=>{const c=scStore().state.doc.scoutRegistry.candidates['db:qa-db'];return {count:(c.sourceHistory||[]).length,size:JSON.stringify(c).length};});
  assert.equal(scoredSize.count,sourceSize.count,'scoring never copies source photos into history');assert.ok(scoredSize.size-sourceSize.size<5000,'score history growth remains small');
  await frame.locator('#plScoutPoints').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`${width}-candidate-points.png`)});
  await frame.locator('[data-sc-unplace]').click();
  assert.equal(await frame.evaluate(()=>data.players.find(p=>p.id==='qa-candidate').posId),'');
  assert.equal(await frame.evaluate(()=>data.players.find(p=>p.id==='qa-candidate').memo),'반드시 남길 관찰 기록');
  await frame.locator('#plDelete').click();
  assert.equal(await frame.locator('[data-sccard="qa-candidate"]').count(),0);
  assert.equal(await frame.locator('[data-dbattach="db:qa-db"]').count(),0,'archived candidate does not resurface in search');
  await frame.locator('#scCandidateTools summary').click();await frame.locator('[data-sc-restore="db:qa-db"]').click();
  await frame.locator('[data-sccard="qa-candidate"]').click();await frame.locator('[data-sc-place]').click();await frame.locator('.sas-pos').first().click();
  const saved=await frame.evaluate(async()=>{await store.ready();return scStore().state.doc;});
  assert.equal(saved.players.filter(p=>p.dbId==='qa-db').length,2);assert.equal(saved.players.find(p=>p.id==='qa-candidate').memo,'반드시 남길 관찰 기록');assert.equal(saved.players.find(p=>p.id==='qa-other-placement').levels.fifa_scan,2);
  assert.equal(saved.scoutRegistry.candidates['db:qa-db'].info.club,'현재 팀');assert.equal(saved.scoutRegistry.candidates['db:qa-db'].points['가상 공격|공간을 먼저 찾는가?'],4);
  assert.equal(await frame.evaluate(()=>localStorage.getItem('scout_tool_v1').includes('scoutRegistry')),false);
  await page.screenshot({path:path.join(out,`${width}-restored-candidate.png`)});
  // Actual points editor DOM stays intact while routine parent metadata changes.
  const pointsPage=await context.newPage();pointsPage.on('pageerror',e=>errors.push(e.message));await pointsPage.goto(base+'/studio/scouting.html?view=points');await pointsPage.locator('#scStoreState').waitFor({state:'hidden'});
  await pointsPage.locator('.pt-card').first().locator('.pc-head').click();
  const question=pointsPage.locator('.pt-sr .q').first();await question.fill('입력 중인 새 질문');await question.focus();await pointsPage.evaluate(()=>{window.__questionNode=document.activeElement;});
  await page.evaluate(()=>{const m=JSON.parse(localStorage.getItem('ps_sync_meta'));m.last=Date.now();localStorage.setItem('ps_sync_meta',JSON.stringify(m));});await pointsPage.waitForTimeout(60);
  assert.equal(await pointsPage.evaluate(()=>window.__questionNode.isConnected&&document.activeElement===window.__questionNode&&window.__questionNode.value==='입력 중인 새 질문'),true,'routine meta preserves point question DOM and focus');await pointsPage.close();
  // The full candidate editor uses canonical deletions and persists source-only notes.
  await frame.evaluate(async()=>{await scPrepare();const d=PSScoutStore.copy(scStore().state.doc);PSScoutStore.edit(d,'db:qa-db','profile.photo',undefined,scStore().stamp());store.set(TKEY,d);await store.ready();});
  const detailPage=await context.newPage();detailPage.on('pageerror',e=>errors.push(e.message));await detailPage.goto(base+'/studio/scouting.html');await detailPage.locator('#scStoreState').waitFor({state:'hidden'});await detailPage.locator('[data-id="db:qa-db"]').first().click();
  assert.equal(await detailPage.locator('#dPhoto img').count(),0,'source photo cannot restore deleted canonical photo');await detailPage.locator('#fOne').fill('수정한 관찰 한줄평');await detailPage.evaluate(()=>psFlushPendingReady());await detailPage.reload();await detailPage.locator('#scStoreState').waitFor({state:'hidden'});await detailPage.locator('[data-id="db:qa-db"]').first().click();assert.equal(await detailPage.locator('#fOne').inputValue(),'수정한 관찰 한줄평');assert.equal(await detailPage.locator('#dPhoto img').count(),0);await detailPage.close();await frame.evaluate(async()=>{await scPrepare();});
  // The registration handler itself receives two immediate click events, including while IDB is pending.
  await frame.evaluate(()=>{closePlayer();scOpenQuick();});await frame.locator('#mqName').fill('한 번만 등록할 후보');await frame.locator('#mqMemo').fill('새 후보 메모');
  await frame.evaluate(()=>{document.getElementById('mqAdd').click();document.getElementById('mqAdd').click();});
  await frame.waitForFunction(()=>!document.getElementById('scMobileQuick').classList.contains('on'));
  assert.equal(await frame.locator('#mqName').inputValue(),'');
  const registered=await frame.evaluate(()=>Object.values(scStore().state.doc.scoutRegistry.candidates).filter(c=>c.info.name==='한 번만 등록할 후보'));
  assert.equal(registered.length,1);assert.equal(registered[0].source.oneliner,'새 후보 메모');
  // A reopened quick sheet is empty; a repeat click cannot create a second candidate.
  await frame.evaluate(()=>{scOpenQuick();document.getElementById('mqAdd').click();});assert.equal(await frame.evaluate(()=>Object.values(scStore().state.doc.scoutRegistry.candidates).filter(c=>c.info.name==='한 번만 등록할 후보').length),1);
  if(width===1280){
    const migration=await frame.evaluate(async()=>{
      const raw=localStorage.getItem('scout_tool_v1'),main=JSON.parse(raw),legacy={id:'qa-candidate',dbId:'qa-db',type:'target',name:'본문에만 남은 표기',memo:'본문에만 남은 메모',levels:{fifa_scan:1},posId:'pos_GK'};
      main.players.push(legacy);const source=JSON.stringify(main);localStorage.setItem('scout_tool_v1',source);
      const realSet=storage.set.bind(storage);storage.set=(k,v)=>k===TKEY?Promise.reject(new Error('fixture migration disk')):realSet(k,v);
      let rejected=false;try{await scMigrateMainTargets();}catch(_){rejected=true;}
      const kept=localStorage.getItem('scout_tool_v1')===source;storage.set=realSet;await store.ready(true);await scMigrateMainTargets();await store.ready();
      const d=scStore().state.doc;return {rejected,kept,removed:!JSON.parse(localStorage.getItem('scout_tool_v1')).players.some(p=>p.type==='target'),history:d.scoutRegistry.placementHistory['qa-candidate'],variants:d.scoutRegistry.candidates['db:qa-db'].variants};
    });assert.equal(migration.rejected,true);assert.equal(migration.kept,true);assert.equal(migration.removed,true);assert.ok(migration.history.some(h=>h.memo==='본문에만 남은 메모'&&h.levels.fifa_scan===1));assert.ok(migration.variants.some(v=>v.value==='본문에만 남은 표기'));
  }
  // Stale role and owner cannot mutate even through direct module APIs.
  const before=await frame.evaluate(()=>localStorage.getItem('cs_scout_targets_v1'));
  await frame.evaluate(()=>{localStorage.setItem('ps_ws_list',JSON.stringify([{id:localStorage.getItem('ps_active_ws'),kind:'team',role:'member'}]));const s=JSON.parse(localStorage.getItem('ps_sync_session'));localStorage.setItem('cs_perms_v1',JSON.stringify({defaultRole:'player',members:{[s.uid]:{role:'staff'}}}));});
  assert.equal(await frame.evaluate(()=>{try{scStore().check();return false;}catch(_){return true;}}),true);
  assert.equal(await frame.evaluate(()=>localStorage.getItem('cs_scout_targets_v1')),before);
  results.push({width,migrationFailureAndSameId:width===1280,cases:['explicit-local-import','one-identity-two-placements','legacy-value-choices','profile-points-write','unplace-keeps-record','archive-does-not-resurface','restore-and-reattach-same-id','routine-sync-keeps-focus','temporary-readiness-preserves-draft','child-save-keeps-evaluator','quick-add-double-click-single-candidate','point-editor-sync-focus','score-photo-size-bounded','photo-delete-source-note-reload','staff-write-blocked'],errors});
  assert.deepEqual(errors,[]);
  await context.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({build,engine,results},null,2));console.log(JSON.stringify({build,engine,results},null,2));
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
