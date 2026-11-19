import assert from 'node:assert/strict';
import {startFixture,openApp,SIZES} from '../fixtures/team-app.mjs';
// 3.331 — 일정 훈련 줄의 ▶(2.946 · 보관함 훈련을 보기 전용으로 열어 재생)를 닫고 일정으로 돌아오면 셸 상태 줄이 «기기에 저장 중…»에 머물던 것.
// 작업 보드에 저장 안 한 편집이 있는 채로(보드 초안) ▶ → 닫기(편집기 «나가기») → 일정. 작전판 틀은 보관함 목록(session)으로 떠나며 초안을 적는데,
// 그 영수증 확인(ready)을 아무도 부르지 않아 초안이 «대기»로 남았다(사람이 탭을 누르면 셸 장벽이 부른다). 고치기 전 코드는 마지막 단정에서 떨어진다.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
if(engine==='chromium'){SIZES.ipad.engine='chromium';SIZES.phone.engine='chromium';}
const fx=await startFixture(),browsers={},LIB='Vqa_tr3331',DI=1;
const out={engine,size,passed:false,steps:[]};
try{
  const {page}=await openApp(fx,size,{browsers}),touch=size!=='desktop';
  const hit=l=>touch?l.tap():l.click();
  await page.waitForTimeout(2500);
  const bf=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await bf.waitForFunction(()=>typeof boardStore==='object'&&window.__boardReady&&window.__boardRestoreDone&&window.__psBoardDraft,null,{timeout:45000});
  const strip=()=>page.evaluate(()=>{const e=document.getElementById('psSyncStrip');return e?e.textContent.replace(/\s+/g,' ').trim():'';});
  const draft=()=>bf.evaluate(()=>{const s=window.__psBoardDraft.snapshot();return {view:window.__csView,needed:s.needed,pending:s.pending,localDurable:s.localDurable};});
  // 1) 작업 보드에 저장 안 한 편집(사람의 편집처럼 pushUndo 먼저)
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]').click());
  await bf.waitForFunction(()=>(window.__csView||'board')==='board'&&!window.__vaultEdit&&_boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner),null,{timeout:30000});
  await page.waitForTimeout(800);
  await bf.evaluate(()=>{pushUndo();loadSnap({players:[{id:71,team:'blue',num:'7',x:211,y:333}],equipment:[],drawings:[],ball:{x:500,y:300}});renderTokens();boardSaveLive();});
  await page.waitForTimeout(2500);
  out.afterEdit=await strip();out.steps.push('edit');
  // 2) 보관함에 장면 셋짜리 훈련 카드 → 일정 › 세션 채우기 › «보관함에서 가져오기»
  await bf.evaluate(async lid=>{const s=x=>({players:[{id:1,team:'blue',num:'1',x,y:300}],equipment:[],drawings:[]});const lib=(await boardStore.get('cs_drill_lib_v1'))||[],t=Date.now();
    lib.unshift({libId:lid,type:'train',name:'가상 훈련카드',folder:'',snap:s(300),thumb:'',trainings:[{name:'워밍업',minutes:10,frames:[{snap:s(300)},{snap:s(400)},{snap:s(500)}]}],savedAt:t,editedAt:t});
    await boardStore.set('cs_drill_lib_v1',lib);localStorage.setItem('cs_lib_rev',String(t));},LIB);
  await page.evaluate(()=>{document.querySelector('#appSeg [data-team-hub]').click();const t=document.querySelector('#teamNav [data-team-key="training"]')||document.querySelector('#teamBottom [data-tb="training"]');if(t)t.click();});
  const pf=await (await page.waitForSelector('#fProcess',{state:'attached'})).contentFrame();
  await pf.waitForFunction(()=>typeof week!=='undefined'&&week&&week.length===7&&typeof wksFill==='function'&&document.querySelectorAll('.wks-day').length===7,null,{timeout:30000});
  await pf.waitForFunction(lid=>{try{if(!window.__sbpAsk&&typeof psLibraryRefresh==='function'){window.__sbpAsk=1;psLibraryRefresh();}}catch(_){}return libDrills().some(d=>d&&d.libId===lid);},LIB,{timeout:30000});
  await pf.evaluate(di=>wksFill(di,week[di].trainings[0].slot),DI);
  const sheet=pf.locator('#sheet');
  await hit(sheet.locator('#wfSec-lib').getByRole('button',{name:'보관함에서 가져오기',exact:true}));
  await hit(sheet.locator('.lp-item',{hasText:'가상 훈련카드'}));
  await pf.waitForFunction(di=>(dayBoard(week[di]).trains||[]).indexOf('워밍업')>=0,DI,{timeout:15000});
  await sheet.locator('#wfSec-lib').waitFor();
  await hit(sheet.getByRole('button',{name:'완료',exact:true}).last());
  await pf.waitForFunction(()=>!document.getElementById('scrim').classList.contains('show'),null,{timeout:10000});
  out.steps.push('imported');
  // 3) ▶ → 보기 전용 훈련 편집기 → «나가기» → 일정
  await pf.evaluate(di=>document.querySelectorAll('.wks-day')[di].querySelector('.wks-li[title="워밍업"] .wks-play').click(),DI);
  await bf.waitForFunction(()=>document.body.classList.contains('editing'),null,{timeout:20000});
  await page.waitForTimeout(1500);out.steps.push('open');
  await bf.evaluate(()=>document.getElementById('editorCancel').click());
  await page.waitForFunction(()=>document.body.getAttribute('data-ps-app')==='process',null,{timeout:15000});
  out.steps.push('back');
  // 4) 상태 줄은 «기기에 저장 중…» · «확인 중»에 머물지 않고, 초안은 대기가 아니다(보관함 목록으로 떠날 때 영수증을 확인했다)
  await page.waitForTimeout(3000);
  out.stripEnd=await strip();out.draftEnd=await draft();
  assert.equal(out.draftEnd.view,'session','작전판 틀은 보관함 목록(빌린 화면)에 있다 '+JSON.stringify(out.draftEnd));
  assert.equal(out.draftEnd.pending,false,'작업 보드 초안이 대기로 남지 않는다 '+JSON.stringify(out.draftEnd));
  assert.ok(!/확인 중|저장 중/.test(out.stripEnd),'돌아온 뒤 상태 줄이 머물지 않는다: '+out.stripEnd);
  out.passed=true;
  console.log(JSON.stringify(out));
}catch(e){
  console.error('[train-play-status-3331] failure',JSON.stringify(out));console.error(e);process.exitCode=1;
}finally{
  for(const b of Object.values(browsers))await b.close().catch(()=>{});
  await fx.close();
}
