import assert from 'node:assert/strict';
import {startFixture,openApp,ready} from '../fixtures/team-app.mjs';
// 3.276(PR #770 의 3.261) — 한 기기 한 창(합성 팀 fixture). 같은 브라우저 문맥(= 같은 기기 저장소)에 앱 창을 둘 띄운다.
// ⚠ fixture(openApp)는 한 기기 한 창을 기본으로 끈다(ps_one_window='0' — 같은 문맥에 창을 둘 띄우는 다른 시험들 때문). 이 시험만 oneWindow:true 로 켠다.
//   꺼진 채로 돌리면 첫 단계(a-held)에서 떨어져야 한다 — 통과 줄 «one-window-3276 ok» 가 안 찍히면 통과가 아니다(CLAUDE.md 함정 3.273).
//  · 새로 연 창(B)이 잠금을 가져가고, 먼저 있던 창(A)은 안내 화면으로 — 동기화를 싣지 않는다
//  · A 가 물러나도 팀 사본이 남는다(닫기 정리 wipeTeamCacheSoft 는 15초 넘게 산 창에서 서버와 같은 사본을 지운다 — 우리 새로고침 표시로 건너뛴다)
//  · 안내 화면의 «이 창에서 계속하기» → A 가 다시 쥐고 B 가 물러난다
//  · 숨은 채 열린 창(H)은 뺏지 않고 스스로 물러난다
//  · 쥔 창을 닫으면 안내 화면의 창이 저절로 다시 연다
//  · 쥔 창을 새로고침해도 덮개 없이 그대로(옛 문서가 새 문서를 만지지 않는다)
//  · 서버 기록 window_elsewhere
//  · 보관함에서 만들던 작전판(3.273 board-vault-draft)이 열린 창이 물러나도 — 저장 확인은 blocked:vault-edit 로 거절되지만 방금 손질까지 기기에 남는다
//  · 물러난 창은 «죽은 탭»(3.271 crash-breadcrumb boot_after_crash)으로 보고되지 않는다
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('one-window-3276 '+s);};
const errs=[];const watch=(p,n)=>p.on('pageerror',e=>{if(!/ResizeObserver loop/.test(e.message))errs.push(n+': '+e.message);});
const TEAM=/^(scout_tool_v1|cs_team_v1|process_coach_v1|cs_squad_v1|cs_team_attrs_v1|cs_perms_v1)$/;
const teamKeys=p=>p.evaluate(re=>Object.keys(localStorage).filter(k=>new RegExp(re).test(k)).sort(),TEAM.source);
const mode=p=>p.evaluate(()=>window.__psOneWindow&&window.__psOneWindow.mode);
try{
  const {context,page:A,logs}=await openApp(fx,size,{browsers,oneWindow:true});
  assert.equal(await A.evaluate(()=>localStorage.getItem('ps_one_window')),null,'이 시험은 운영 기본(켬)으로 돈다');
  step('a-held');
  await A.waitForFunction(()=>window.__psOneWindow&&window.__psOneWindow.mode==='held',null,{timeout:15000});
  /* A 가 15초 넘게 살아야 닫기 정리가 «지워도 되는» 창이 된다 — 그래야 정리를 건너뛰는지 본다 */
  await A.waitForFunction(()=>performance.now()>16500,null,{timeout:30000});
  const before=await teamKeys(A);assert.ok(before.length>=3,'팀 사본 '+before.join(','));

  step('b-opens');
  const B=await context.newPage();B.setDefaultTimeout(45000);watch(B,'B');
  await B.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});
  await A.waitForURL(/\/studio\/elsewhere\.html$/,{timeout:30000});
  await ready(B);
  assert.equal(await mode(B),'held');
  assert.deepEqual(await teamKeys(B),before,'물러난 창이 팀 사본을 지우지 않는다');
  assert.equal(await A.locator('#ewTitle').textContent(),'다른 창에서 이어서 쓰고 있어요');
  assert.equal(await A.evaluate(()=>typeof window.PSSync),'undefined','안내 화면은 동기화를 싣지 않는다');
  assert.equal(await A.evaluate(()=>sessionStorage.getItem('ps_elsewhere_back')),'app.html');
  const box=await A.locator('.ew').boundingBox(),vw=A.viewportSize().width;
  assert.ok(box&&box.x>=16&&box.x+box.width<=vw-16,'안내 카드가 화면 안 '+JSON.stringify(box));

  step('a-takes-back');
  await A.locator('#ewHere').click();
  await A.waitForURL(/\/studio\/app\.html$/,{timeout:15000});
  await B.waitForURL(/\/studio\/elsewhere\.html$/,{timeout:30000});
  await ready(A);
  assert.equal(await mode(A),'held');
  assert.deepEqual(await teamKeys(A),before,'되돌아와도 팀 사본 그대로');

  step('hidden-boot');
  const H=await context.newPage();watch(H,'H');
  await H.addInitScript(()=>{
    Object.defineProperty(Document.prototype,'hidden',{configurable:true,get(){return true;}});
    Object.defineProperty(Document.prototype,'visibilityState',{configurable:true,get(){return 'hidden';}});
  });
  await H.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});
  await H.waitForURL(/\/studio\/elsewhere\.html$/,{timeout:30000});
  await H.waitForTimeout(3600);   /* 안내 화면의 3초 확인이 한 번 지나도 숨은 창은 다시 열지 않는다 */
  assert.match(H.url(),/elsewhere\.html$/);
  assert.match(A.url(),/\/studio\/app\.html$/);assert.equal(await mode(A),'held','숨은 창은 뺏지 않는다');
  await H.close();

  step('auto-return');
  await A.close();
  await B.waitForURL(/\/studio\/app\.html$/,{timeout:20000});
  await ready(B);
  assert.equal(await mode(B),'held');

  step('reload');
  /* 같은 탭 새로고침 — 새 문서가 잠금을 가져가고 «뺏김»은 떠나는 옛 문서가 받는다. 옛 문서가 새 문서를 덮거나 보내면 안 된다(#770 첫 CI) */
  await B.reload({waitUntil:'domcontentloaded'});await ready(B);await B.waitForTimeout(3000);
  assert.match(B.url(),/\/studio\/app\.html$/);assert.equal(await mode(B),'held');
  assert.equal(await B.locator('#psElsewhereCover').count(),0,'새로고침한 창에 덮개가 없다');

  step('event');
  const t0=Date.now();let ev=[];
  while(Date.now()-t0<15000){ev=fx.calls.filter(c=>c.p==='/rest/v1/ps_events').flatMap(c=>[].concat(c.body||[])).filter(r=>r&&r.event_name==='window_elsewhere');if(ev.length>=2)break;await B.waitForTimeout(500);}
  assert.ok(ev.length>=2,'window_elsewhere '+ev.length);
  assert.ok(ev.every(r=>r.error_code==='stolen'&&/^(ok|none|timeout|fail:)/.test(r.meta.stage)),JSON.stringify(ev.map(r=>[r.error_code,r.meta])));

  step('vault-draft');
  /* B(쥔 창)에서 보관함 «＋ 만들기 › 작전판»으로 장면을 만들고, 마지막 손질 직후(0.8초 예약이 돌기 전) 새 창 C 가 가져간다 */
  const boardOf=async p=>{
    await p.waitForFunction(()=>{const w=document.getElementById('fBoard')?.contentWindow;return window.PSSync&&PSSync.dataUnlocked()&&!document.body.classList.contains('ps-booting')&&w&&w.__boardReady===true&&w.__boardRestoreDone===true&&w._boardPrivateLoaded&&w.boardPrivateCurrent(w._boardPrivateOwner)&&!w.__boardRestoring&&!!w.__psVaultDraft;},null,{timeout:45000});
    return (await p.$('#fBoard')).contentFrame();
  };
  const draft=f=>f.evaluate(async()=>{
    const o=vaultBoardOwner(),k=PSVaultDraft.key(o);let idb=null;try{idb=(await storage.peek(k))?.value??null;}catch(_){}
    const rec=PSVaultDraft.pick(localStorage.getItem(k),idb,o);
    return rec?{frames:(rec.doc.frames||[]).length,xs:(rec.doc.frames||[]).map(fr=>fr.snap.players[0]&&fr.snap.players[0].x)}:null;
  });
  let fb=await boardOf(B);
  assert.equal(await draft(fb),null,'처음엔 초안이 없다');
  /* 작업 보드에도 저장 안 한 손질이 있다 — 그 초안(board-draft.js)은 보관함 편집 중엔 다시 확인하지 못해 저장 확인이 거절된다(vault-board-draft ③과 같은 상태) */
  await fb.evaluate(()=>{pushUndo();const sn=captureSnap();sn.players=[{id:'w1',name:'가',num:9,team:'blue',x:333,y:300}];loadSnap(sn);boardSaveLive();});
  const workKey=await fb.evaluate(()=>boardDraftKey(_boardPrivateOwner));
  let work=null;for(let i=0;i<40&&!work;i++){work=await fb.evaluate(async k=>(await storage.peek(k))?.value??null,workKey);if(!work)await B.waitForTimeout(250);}
  assert.ok(work,'작업 보드 초안이 먼저 기기에 있다');
  await B.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
  await fb.waitForFunction(()=>window.__csView==='session'&&document.getElementById('dfNew'),null,{timeout:20000});await B.waitForTimeout(700);
  await fb.evaluate(()=>document.getElementById('dfNew').click());await fb.waitForSelector('.vcc-item');
  await fb.evaluate(()=>[...document.querySelectorAll('.vcc-item')].find(b=>/작전판/.test(b.textContent)).click());
  await fb.waitForFunction(()=>window.__csView==='board'&&!!window.__vaultPending&&!!_vaultBoardContext,null,{timeout:10000});
  await B.waitForTimeout(900);
  await fb.evaluate(()=>{pushUndo();state.players=[{id:901,team:'blue',num:7,x:300,y:370}];renderTokens();});
  for(const x of [400,460]){await fb.evaluate(x=>{pushUndo();state.players[0].x=x;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click();},x);await B.waitForTimeout(220);}
  for(let i=0;i<40;i++){const d=await draft(fb);if(d&&d.frames===3)break;await B.waitForTimeout(250);}
  assert.equal((await draft(fb))?.frames,3,'장면 셋이 먼저 기기에');
  const evBefore=fx.calls.filter(c=>c.p==='/rest/v1/ps_events').flatMap(c=>[].concat(c.body||[])).filter(r=>r&&r.event_name==='window_elsewhere').length;
  await fb.evaluate(()=>{pushUndo();state.players[0].x=580;renderTokens();autoSaveAnimFrame();document.getElementById('animAdd').click();});   /* 마지막 손질 — 기다리지 않는다 */
  const C=await context.newPage();C.setDefaultTimeout(45000);watch(C,'C');
  await C.goto(fx.base+'/studio/app.html',{waitUntil:'domcontentloaded'});
  await B.waitForURL(/\/studio\/elsewhere\.html$/,{timeout:30000});
  await ready(C);assert.equal(await mode(C),'held');
  const fc=await boardOf(C);
  let d=null;for(let i=0;i<40;i++){d=await draft(fc);if(d&&d.frames===4)break;await C.waitForTimeout(250);}
  assert.deepEqual(d,{frames:4,xs:[400,460,580,580]},'물러난 창의 마지막 손질까지 기기에 남는다');
  assert.equal(await fc.evaluate(async k=>(await storage.peek(k))?.value??null,workKey),work,'작업 보드 초안도 그대로');
  await fc.waitForSelector('#psVaultDraftBar',{state:'attached',timeout:20000});   /* 새 창이 «되살리기»를 묻는다 */
  let ev2=[];const t1=Date.now();
  while(Date.now()-t1<15000){ev2=fx.calls.filter(c=>c.p==='/rest/v1/ps_events').flatMap(c=>[].concat(c.body||[])).filter(r=>r&&r.event_name==='window_elsewhere').slice(evBefore);if(ev2.length)break;await C.waitForTimeout(500);}
  assert.equal(ev2.length,1,'물러난 기록 한 줄');
  assert.equal(ev2[0].meta.stage,'fail:fBoard:board_draft_storage:blocked:vault-edit','저장 확인이 거절된 까닭이 남는다');

  step('no-crash-report');
  /* 물러난 창들의 탭 표식(ps_crash_crumb_v1:<탭>)은 남지 않고, 어느 부팅도 boot_after_crash 를 보내지 않았다(데스크톱만 — 3.271) */
  if(size==='desktop'){
    const crumbs=await C.evaluate(()=>({keys:Object.keys(localStorage).filter(k=>k.indexOf('ps_crash_crumb_v1:')===0),mine:window.PSCrashCrumb&&'ps_crash_crumb_v1:'+PSCrashCrumb.id}));
    assert.deepEqual(crumbs.keys.filter(k=>k!==crumbs.mine),[],'물러난 창의 표식이 남지 않는다');
    assert.deepEqual(await C.evaluate(()=>PSCrashCrumb.check()),{dead:0,stale:0});
  }
  assert.equal(fx.calls.filter(c=>c.p==='/rest/v1/ps_events').flatMap(c=>[].concat(c.body||[])).filter(r=>r&&r.event_name==='boot_after_crash').length,0,'죽은 탭 기록 없음');

  step('errors');
  for(const l of logs)if(l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text))errs.push('A: '+l.text);
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('one-window-3276 ok',engine,size);
}catch(e){console.error('one-window-3276 실패 단계:',cur);console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}
