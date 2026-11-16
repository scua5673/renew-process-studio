// 3.300 휴대폰 빠른 보드: 안내 띠 «＋ 빠른 보드» → 포메이션 · 선수단 순서로 채우기 → 자리 시트로 이름 넣기 · 순서 바꾸기 · 붙여넣기 → 저장
// → 보관함에 작전판 하나(quick · 토큰 depth) → 보기 화면에 뒤 순번 이름표 → «이름 고치기»로 같은 항목만 고침 → 쓰던 보드 이어서.
// 아이패드는 같은 항목을 열어 같은 뒤 순번 이름표를 그리고, 안내 띠 · 빠른 보드 단추가 없다.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,SIZES,OUT,SHOTS,ready} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
for(const s of Object.values(SIZES))s.engine=engine;
const shot=(page,name)=>page.screenshot({path:path.join(SHOTS,'board-quick-depth-'+engine+'-'+name+'.png')});
async function boardFrame(page){
  await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
  const f=await(await page.waitForSelector('#fBoard')).contentFrame();
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&!window.__boardRestoring&&window.PSQuickDepth&&window.__psQuickTokWrap);
  return f;
}
const quickItems=()=>[...fx.lib.values()].map(r=>r&&r.item||r).filter(d=>d&&d.quick);
// 기기 보관함 → 서버는 동기화 회차 뒤에 온다 — 서버 사본이 조건을 만족할 때까지(20초)
async function serverItems(ok){for(let i=0;i<80;i++){const l=quickItems();if(ok(l))return l;await new Promise(r=>setTimeout(r,250));}return quickItems();}
const slots=f=>f.evaluate(()=>JSON.parse(JSON.stringify(window.__psQuickDepth.ui().state().slots)));
const depthText=f=>f.evaluate(()=>[...document.querySelectorAll('#tokenLayer .ps-depth')].map(g=>[...g.querySelectorAll('text')].map(t=>t.textContent)));
try{
 /* ── 폰 ── */
 {const {page,context,logs}=await openApp(fx,'phone',{browsers,examples:false,tilt3d:false});
  await ready(page);
  const f=await boardFrame(page);
  const btn=f.locator('#psPhoneBoardNotice [data-quick]');
  await btn.waitFor({state:'visible'});
  assert.equal((await btn.innerText()).trim(),'＋ 빠른 보드');
  const libBefore=quickItems().length;
  await btn.tap();
  await f.locator('#pqForm').waitFor({state:'visible'});
  await f.waitForFunction(()=>window.__psQuickDepth.ui().state().rosterState==='ok',null,{timeout:20000});
  assert.match(await f.locator('#pqForm').innerText(),/선수단 18명/,'squad count from the roster (read-only)');
  await shot(page,'1-form');
  await f.locator('#pqForm [data-pq="form-go"]').tap();
  await f.waitForFunction(()=>document.getElementById('pqForm').hidden);
  let s=await slots(f);
  assert.deepEqual(s[0],['가상 선수 1','가상 선수 2'],'GK in squad depth order');
  assert.deepEqual(s[2],['가상 선수 3','가상 선수 5'],'two centre backs share the CB depth');
  assert.equal(s.flat().length,18,'every squad player with a position is placed once');
  /* 자리 시트 — 이름 넣기(띄어 쓴 이름 그대로) · 한 칸 위로 · 다른 자리 선수 옮기기 */
  await f.locator('#pqStage .pq-slot[data-i="7"]').tap();
  await f.locator('#pqPos').waitFor({state:'visible'});
  assert.equal((await f.locator('#pqPosName').innerText()).trim(),'왼쪽 윙');
  await f.locator('#pqInput').fill('김 새로');await f.locator('#pqInput').press('Enter');
  s=await slots(f);assert.deepEqual(s[7],['가상 선수 13','가상 선수 15','김 새로']);
  assert.equal(await f.evaluate(()=>document.activeElement&&document.activeElement.id),'pqInput','input keeps focus for the next name');
  await f.locator('#pqList li').nth(2).locator('[data-up]').tap();
  s=await slots(f);assert.deepEqual(s[7],['가상 선수 13','김 새로','가상 선수 15']);
  await f.locator('#pqChips [data-name="가상 선수 14"]').tap();
  s=await slots(f);assert.deepEqual(s[9],[],'moved from RW');assert.equal(s[7].at(-1),'가상 선수 14');
  await shot(page,'2-sheet');
  await f.locator('#pqPos [data-pq="next"]').tap();
  assert.equal((await f.locator('#pqPosName').innerText()).trim(),'공격형 미드필더','next slot without closing');
  await f.locator('#pqPos [data-pq="pos-close"]').tap();
  /* 붙여넣기 */
  await f.locator('#psQuick [data-pq="paste"]').tap();
  await f.locator('#pqPasteText').fill('RW 길태양, 탁서윤\nST: 가상 선수 16 / 황보건');
  await f.locator('#psQuick [data-pq="paste-go"]').tap();
  s=await slots(f);assert.deepEqual(s[9],['길태양','탁서윤']);assert.deepEqual(s[10],['가상 선수 16','황보건']);
  await shot(page,'3-edit');
  /* 저장 → 보관함 · 보기 화면 */
  await f.locator('#pqTitle').fill('U-15 뎁스');
  await f.locator('#psQuick [data-pq="save"]').tap();
  await f.waitForFunction(()=>document.getElementById('psQuick').hidden);
  await f.waitForFunction(()=>window.__vaultReadOnly===true&&document.body.classList.contains('vcreating')&&window.__vvItem&&window.__vvItem.quick,null,{timeout:20000});
  const items=await serverItems(l=>l.length===libBefore+1);assert.equal(items.length,libBefore+1,'one new library item');
  const it=items.find(d=>d.name==='U-15 뎁스');assert.ok(it,'saved with the typed name');
  assert.equal(it.type,'board');assert.deepEqual(it.tags,['빠른 보드']);assert.equal(it.quick.form,'4-2-3-1');assert.ok(await f.evaluate(id=>libGet().then(l=>{const d=l.find(x=>x.libId===id);return !!d&&String(d.thumb||'').length>100;}),it.libId),'card thumbnail on the device copy');
  assert.equal(it.snap.orientation,'v');assert.equal(it.snap.label,'pos');assert.equal(it.snap.players.length,11);
  const lw=it.snap.players.find(p=>p.id===8);assert.equal(lw.pos,'LW');assert.equal(lw.name,'가상 선수 13');assert.deepEqual(lw.depth,['김 새로','가상 선수 15','가상 선수 14']);
  assert.equal(it.snap.players.find(p=>p.id===4).depth,undefined,'no empty depth list');
  assert.ok(it.editedAt&&it.editedAt===it.savedAt);
  await f.waitForFunction(()=>document.querySelectorAll('#tokenLayer .ps-depth').length>=8);
  assert.ok((await depthText(f)).some(t=>t.join('|')==='김 새로|가상 선수 15|가상 선수 14'),'backup names drawn under the starter');
  await f.waitForFunction(()=>{const b=document.querySelector('#psPhoneBoardNotice [data-quick]');return b&&!b.hidden&&b.textContent==='이름 고치기';});
  await page.waitForTimeout(800);
  await shot(page,'4-view');
  /* 이름 고치기 — 같은 항목만 */
  const savedAt=it.savedAt;
  await f.locator('#psPhoneBoardNotice [data-quick]').tap();
  await f.locator('#psQuick').waitFor({state:'visible'});
  assert.equal(await f.locator('#pqForm').isVisible(),false,'edit opens straight on the pitch');
  s=await slots(f);assert.deepEqual(s[7],['가상 선수 13','김 새로','가상 선수 15','가상 선수 14'],'slots read back from the item');
  assert.equal(await f.inputValue('#pqTitle'),'U-15 뎁스');
  await f.locator('#pqStage .pq-slot[data-i="7"]').tap();
  await f.locator('#pqList li').nth(3).locator('[data-rm]').tap();
  await f.locator('#pqPos [data-pq="pos-close"]').tap();
  await page.waitForTimeout(5);
  await f.locator('#psQuick [data-pq="save"]').tap();
  await f.waitForFunction(()=>document.getElementById('psQuick').hidden);
  await f.waitForFunction(()=>window.__vvItem&&window.__vvItem.quick&&(window.__vvItem.snap.players.find(p=>p.id===8).depth||[]).length===2,null,{timeout:20000});
  const after=await serverItems(l=>l.some(d=>d.libId===it.libId&&(d.snap.players.find(p=>p.id===8).depth||[]).length===2));assert.equal(after.length,libBefore+1,'edit replaces, does not add');
  const ed=after.find(d=>d.libId===it.libId);assert.deepEqual(ed.snap.players.find(p=>p.id===8).depth,['김 새로','가상 선수 15']);
  assert.ok(ed.editedAt>savedAt&&ed.editedAt===ed.savedAt,'editedAt and savedAt move together (3.291)');
  assert.equal(ed.snap.players.find(p=>p.id===8).x,lw.x,'same formation keeps token places');
  /* 쓰던 보드 이어서 — 작업 보드로 돌아가 새로 시작했다 닫으면 남는다 */
  await f.locator('#vCreateCancel').click();
  await f.waitForFunction(()=>!document.body.classList.contains('vcreating'));
  await page.locator('#appSeg [data-app="board"]:not([data-train])').click();
  await f.waitForFunction(()=>{const b=document.querySelector('#psPhoneBoardNotice [data-quick]');return b&&!b.hidden&&b.textContent==='＋ 빠른 보드';},null,{timeout:15000});
  await f.locator('#psPhoneBoardNotice [data-quick]').tap();
  await f.locator('#pqForm').waitFor({state:'visible'});
  await f.locator('#pqFill-blank').check();
  await f.locator('#pqForm [data-form="3-3-1"]').tap();
  await f.locator('#pqForm [data-pq="form-go"]').tap();
  s=await slots(f);assert.equal(s.length,8,'8-a-side has eight slots');assert.equal(s.flat().length,0);
  await f.locator('#pqStage .pq-slot[data-i="0"]').tap();
  await f.locator('#pqInput').fill('골키퍼 하나, 골키퍼 둘');await f.locator('#pqInput').press('Enter');
  await f.locator('#psQuick [data-pq="back"]').tap();
  await f.waitForFunction(()=>document.getElementById('psQuick').hidden);
  await f.locator('#psPhoneBoardNotice [data-quick]').tap();
  await f.locator('#pqForm [data-pq="draft"]').waitFor({state:'visible'});
  await f.locator('#pqForm [data-pq="draft"]').tap();
  s=await slots(f);assert.deepEqual(s[0],['골키퍼 하나','골키퍼 둘']);
  assert.equal(await f.evaluate(()=>window.__psQuickDepth.ui().state().form),'3-3-1');
  await f.locator('#psQuick [data-pq="back"]').tap();
  assert.equal(quickItems().length,libBefore+1,'closing without saving writes nothing');
  const errors=logs.filter(x=>x.type==='pageerror'&&!/ResizeObserver loop/.test(x.text));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({engine,size:'phone',passed:true}));
  await context.close();}
 /* ── 아이패드 — 같은 항목을 같은 뒤 순번으로 그린다 · 빠른 보드 단추 없음 ── */
 {const {page,context,logs}=await openApp(fx,'ipad',{browsers,examples:false,tilt3d:false});
  await ready(page);
  const f=await boardFrame(page);
  assert.equal(await f.locator('#psPhoneBoardNotice').isVisible(),false);
  assert.equal(await f.evaluate(()=>window.PSQuickDepth.entry(window)),null,'no quick entry outside the phone viewer');
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="design"]:not([data-train])').click());
  await f.waitForFunction(n=>[...document.querySelectorAll('#drillFiles .vcard')].some(c=>c.textContent.includes(n)),'U-15 뎁스',{timeout:30000});
  await f.evaluate(n=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n));[...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click();},'U-15 뎁스');
  await f.waitForFunction(()=>document.body.classList.contains('vcreating')&&document.querySelectorAll('#tokenLayer .ps-depth').length>=8,null,{timeout:20000});
  assert.ok((await depthText(f)).some(t=>t.join('|')==='김 새로|가상 선수 15'));
  await page.waitForTimeout(800);
  await shot(page,'5-ipad');
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'&&!/ResizeObserver loop/.test(x.text)),[]);
  console.log(JSON.stringify({engine,size:'ipad',passed:true}));
  await context.close();}
}catch(e){console.error(e);fs.writeFileSync(path.join(OUT,'board-quick-depth-failure.txt'),String(e&&e.stack||e));process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
