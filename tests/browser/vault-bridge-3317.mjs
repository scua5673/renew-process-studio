/* 3.317 — 보관함↔보드 다리(B안). 보관함 자료를 «편집»으로 고치다 보드 탭으로 가도 편집이 남는다:
   작업 보드 위 띠 «편집 중 · 보관함 › 이름 · 저장 안 한 변경 — 돌아가기 · 저장하고 닫기 · 버리기» · 보관함 목록의 «편집 중» 칩 ·
   «돌아가기»는 그 자료를 다시 열어 초안을 입힌다(«(되살림)» 새 자료가 아니다) · «저장»은 그 자료에 · 불러오기 창의 «이어서»도 그 자료.
   편집 띠의 말은 하나(새 자료 «저장 · 닫기» · 편집 «저장 · 저장하고 닫기 · 닫기») · 띠 앞에 «보관함 › 폴더 ›». */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,ready,SIZES} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',out=process.env.PS_TEST_OUTPUT||'/tmp/ps-vault-bridge-3317';
fs.mkdirSync(out,{recursive:true});
const browsers={},fx=await startFixture();
SIZES.vb={engine,ctx:{viewport:{width:1280,height:860},deviceScaleFactor:1}};
const {page,logs}=await openApp(fx,'vb',{browsers});
const NAME='다리 시험 작전판';
async function board(){
  await page.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!w.__boardRestoring&&!!w.__psVaultDraft;},null,{timeout:45000});
  return (await page.$('#fBoard')).contentFrame();
}
async function toVault(f){
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:20000});await page.waitForTimeout(700);
}
const stored=f=>f.evaluate(async()=>{const o=vaultBoardOwner(),k=PSVaultDraft.key(o);let idb=null;try{idb=(await storage.peek(k))?.value??null;}catch(_){}const rec=PSVaultDraft.pick(localStorage.getItem(k),idb,o);return {rec:rec&&{libId:rec.libId,x:rec.doc.snap.players[0]&&rec.doc.snap.players[0].x}};});
async function until(f,test,what){for(let i=0;i<60;i++){const s=await stored(f);if(test(s))return s;await page.waitForTimeout(250);}throw new Error('시간 초과: '+what+' '+JSON.stringify(await stored(f)));}
const gone=s=>!s.rec;
const bar=f=>f.evaluate(()=>{const b=document.getElementById('psVaultDraftBar');if(!b)return null;return {text:b.querySelector('.vd-tx').textContent,keep:b.querySelector('.vd-keep')?.textContent,save:b.querySelector('.vd-save')?.textContent,drop:b.querySelector('.vd-drop')?.textContent,shown:getComputedStyle(b).display!=='none'};});
const labels=f=>f.evaluate(()=>({save:document.getElementById('vCreateSave').textContent,only:document.getElementById('vCreateSaveOnly').textContent,onlyShown:getComputedStyle(document.getElementById('vCreateSaveOnly')).display!=='none',cancel:document.getElementById('vCreateCancel').textContent,crumb:document.getElementById('vCreateCrumb').textContent,crumbShown:getComputedStyle(document.getElementById('vCreateCrumb')).display!=='none'}));
const openEdit=async f=>{
  await toVault(f);
  await f.evaluate(n=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n));[...c.querySelectorAll('button')].find(b=>b.textContent.trim()==='편집').click();},NAME);
  await f.waitForFunction(()=>!!window.__vaultEdit&&!!_vaultBoardContext&&!!window.__curVaultId&&!window.__vaultHydrating,null,{timeout:15000});await page.waitForTimeout(1300);
};
const nudge=(f,x)=>f.evaluate(x=>{pushUndo();state.players[0].x=x;renderTokens();window.__vaultAutoSaveSchedule();},x);
const boardTab=async f=>{
  await page.evaluate(()=>document.querySelector('#appSeg button[data-app="board"]').click());
  await f.waitForFunction(()=>!_vaultBoardContext&&!window.__vaultEdit&&window.__csView==='board',null,{timeout:15000});
};
try{
  let f=await board();
  // ① 새 작전판 → 띠 «저장 · 닫기» · 빵부스러기 없음 → 이름 붙여 저장
  await toVault(f);
  await f.evaluate(()=>document.getElementById('dfNew').click());await f.waitForSelector('.vcc-item');
  await f.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/작전판/.test(b.textContent)).click());
  await f.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultPending&&!!_vaultBoardContext,null,{timeout:10000});await page.waitForTimeout(900);
  let lb=await labels(f);assert.equal(lb.save,'저장');assert.equal(lb.cancel,'닫기');assert.equal(lb.onlyShown,false);assert.equal(lb.crumbShown,false,'새로 만들 때는 빵부스러기가 없다');
  await f.evaluate(()=>{pushUndo();state.players=[{id:701,team:'blue',num:7,x:300,y:370}];renderTokens();});
  await f.evaluate(()=>document.getElementById('vCreateSave').click());await f.locator('#pssName').fill(NAME);await f.locator('#pssOk').click();
  await f.waitForFunction(()=>!document.body.classList.contains('vcreating')&&!_vaultBoardContext,null,{timeout:15000});
  const id=await f.evaluate(async n=>((await libGet())||[]).find(x=>x.name===n)?.libId,NAME);assert.ok(id,'보관함에 담겼다');
  // ② 편집으로 열면 «저장 · 저장하고 닫기 · 닫기» · «보관함 › …»
  await openEdit(f);
  lb=await labels(f);assert.equal(lb.only,'저장');assert.equal(lb.onlyShown,true);assert.equal(lb.save,'저장하고 닫기');assert.equal(lb.cancel,'닫기');
  assert.equal(lb.crumbShown,true);assert.match(lb.crumb,/^보관함 › /);
  assert.equal(await f.evaluate(()=>{const c=document.getElementById('vCreateCrumb'),t=document.getElementById('vCreateTitle');return c.parentElement===t.parentElement&&!!(c.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING);}),true,'빵부스러기는 제목 앞, 같은 띠 안');
  // ③ 손질 → 보드 탭 → 편집이 남는다(띠)
  await nudge(f,555);await until(f,s=>!!s.rec&&s.rec.libId===id,'고치던 초안');
  await boardTab(f);
  await f.waitForSelector('#psVaultDraftBar',{state:'attached',timeout:15000});
  let b=await bar(f);assert.match(b.text,/^편집 중 · 보관함 › 다리 시험 작전판 · 저장 안 한 변경 · /);assert.equal(b.keep,'돌아가기');assert.equal(b.save,'저장하고 닫기');assert.equal(b.drop,'버리기');assert.equal(b.shown,true);
  assert.equal(await f.evaluate(()=>state.players.some(p=>p.id===701&&p.x===555)),false,'작업 보드는 그 자료가 아니다');
  // ④ 보관함 목록에 «편집 중» 칩
  await toVault(f);
  await f.waitForFunction(n=>{const c=[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n));return !!(c&&c.querySelector('.vc-editing'));},NAME,{timeout:8000});
  assert.equal(await f.evaluate(n=>[...document.querySelectorAll('#drillFiles .vcard')].find(c=>c.textContent.includes(n)).querySelector('.vc-editing').textContent,NAME),'편집 중');
  assert.equal(await f.evaluate(()=>[...document.querySelectorAll('#drillFiles .vc-editing')].length),1,'칩은 그 자료에만');
  b=await bar(f);assert.ok(b&&b.shown,'목록 위에도 띠가 있다');
  // ⑤ «돌아가기» → 같은 자료가 편집으로 열리고 초안이 입혀져 «변경 있음»
  await f.evaluate(()=>document.querySelector('#psVaultDraftBar .vd-keep').click());
  await f.waitForFunction(i=>window.__curVaultId===i&&!!window.__vaultEdit&&!window.__vaultHydrating&&!!_vaultBoardContext,id,{timeout:15000});await page.waitForTimeout(900);
  assert.equal(await f.evaluate(()=>state.players[0].x),555,'초안의 판');
  assert.equal(await f.evaluate(()=>!!window.__vaultManualDirty),true);
  assert.equal(await f.evaluate(()=>!!document.getElementById('psVaultDraftBar')),false,'띠는 걷힌다');
  assert.equal(await f.evaluate(()=>!!window.__vaultPending),false,'새 자료가 아니라 그 자료');
  // ⑥ «저장» → 그 자료에 · 자료 수 그대로
  await f.evaluate(()=>document.getElementById('vCreateSaveOnly').click());
  await f.waitForFunction(()=>!window.__vaultManualDirty&&/저장됨/.test(document.getElementById('vCreateSub').textContent||''),null,{timeout:10000});
  const saved=await f.evaluate(async n=>{const lib=(await libGet())||[];const m=lib.filter(x=>x.name===n);return {n:m.length,x:m[0]&&m[0].snap.players[0].x,restored:lib.filter(x=>/되살림/.test(x.name||'')).length};},NAME);
  assert.deepEqual(saved,{n:1,x:555,restored:0},'그 자료 하나에 저장됐다');
  // ⑦ «닫기» → 저장했으니 묻지 않고, 초안은 낡은 것으로 걷힌다
  await f.evaluate(()=>document.getElementById('vCreateCancel').click());
  await f.waitForFunction(()=>!_vaultBoardContext,null,{timeout:10000});
  await until(f,gone,'저장하고 닫으면 초안이 걷힌다');
  // ⑧ 불러오기 창의 «이어서»는 고치다 둔 그 자료 · 창이 떠 있는 동안 띠는 숨는다
  await openEdit(f);await nudge(f,575);await until(f,s=>!!s.rec&&s.rec.libId===id,'다시 고친 초안');
  await boardTab(f);await f.waitForSelector('#psVaultDraftBar',{state:'attached',timeout:15000});
  /* 앱을 다시 여는 대신 창을 직접 띄운다 — 시험 fixture 는 페이지마다 ps_open_chooser_v1='0' 을 넣는다 */
  await f.evaluate(()=>{try{localStorage.removeItem('ps_open_chooser_v1');}catch(_){}try{parent.__psOpenChooserShown=false;}catch(_){}return PSOpenChooser.run(window);});
  await f.waitForSelector('#psOpenChooser',{state:'attached',timeout:20000});
  await f.waitForFunction(n=>document.querySelector('#psOpenChooserContinue .oc-nm')?.textContent===n,NAME,{timeout:8000});
  assert.match(await f.evaluate(()=>document.querySelector('#psOpenChooserContinue .oc-mt').textContent),/^보관함 · 저장 안 한 변경/);
  b=await bar(f);assert.equal(!b||!b.shown,true,'창이 떠 있는 동안 초안 띠는 보이지 않는다');
  await f.evaluate(()=>document.getElementById('psOpenChooserContinue').click());
  await f.waitForFunction(i=>window.__curVaultId===i&&!!window.__vaultEdit&&!window.__vaultHydrating,id,{timeout:15000});await page.waitForTimeout(900);
  assert.equal(await f.evaluate(()=>state.players[0].x),575,'«이어서»도 초안의 판');
  await page.screenshot({path:path.join(out,`vault-bridge-${engine}-reopened.png`),animations:'disabled'});
  // 정리 — 버리고 닫기
  await f.evaluate(()=>document.getElementById('vCreateCancel').click());
  await f.waitForSelector('[data-ps-ok="1"]');await page.waitForTimeout(200);await f.evaluate(()=>document.querySelector('[data-ps-ok="1"]').click());
  await f.waitForFunction(()=>!_vaultBoardContext,null,{timeout:10000});await until(f,gone,'버리고 닫으면 초안도 버린다');
  // ⑨ 폰 폭: 띠는 한 줄, 단추가 화면 안
  await page.setViewportSize({width:375,height:812});await page.waitForTimeout(300);
  await openEdit(f);await page.waitForTimeout(300);
  const ph=await f.evaluate(()=>{const b=document.getElementById('vCreateBar'),c=document.getElementById('vCreateCancel');const r=b.getBoundingClientRect(),cr=c.getBoundingClientRect();return {h:Math.round(r.height),right:Math.round(cr.right),w:innerWidth,crumb:getComputedStyle(document.getElementById('vCreateCrumb')).display!=='none'};});
  assert.ok(ph.h<=64,'띠는 한 줄 '+JSON.stringify(ph));assert.ok(ph.right<=ph.w,'닫기 단추가 화면 안 '+JSON.stringify(ph));
  await page.screenshot({path:path.join(out,`vault-bridge-${engine}-375.png`),animations:'disabled'});
  await f.evaluate(()=>document.getElementById('vCreateCancel').click());await f.waitForFunction(()=>!_vaultBoardContext,null,{timeout:10000});
  const errs=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));
  assert.deepEqual(errs,[],JSON.stringify(errs));
  console.log(JSON.stringify({engine,passed:true}));
}catch(e){
  await page.screenshot({path:path.join(out,`vault-bridge-${engine}-failure.png`)}).catch(()=>{});
  console.error(JSON.stringify({logs:logs.filter(l=>l.type==='pageerror').slice(0,5)}));throw e;
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
