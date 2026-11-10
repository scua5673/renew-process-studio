import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,ready,SHOTS} from '../fixtures/team-app.mjs';
// 3.271 — 제보 1bc9b7d4 «페이지를 삭제하거나 추가하거나 제목을 바꾸거나 했을 때, 되돌리기»(합성 팀 fixture 에서만).
//  실제 띠 단추(＋ · 복제 · ··· 삭제 · 이름)와 실제 ⌘Z / ⇧⌘Z 로: 추가 · 복제 · 삭제가 기록을 비우지 않고 한 번씩 되돌려지며,
//  지운 페이지는 장면 · 그림 · 운동장 사진 표식까지 제자리에 돌아온다. 미팅 세트 · 패턴북의 경계는 예전 그대로.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const fx=await startFixture(),browsers={};
const step=s=>{try{fx.setStep(s);}catch(_){}console.log('board-page-undo-3271 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  let f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  const boot=()=>f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psPages&&window.__psPageHistory&&window.__csView==='board',null,{timeout:30000});
  await boot();
  const PHOTO=await f.evaluate(()=>PSPitchPhoto.refOf('synthetic3271',1600,900));   // 운동장 사진 표식(사진 자체는 기기 저장소 — 페이지엔 표식만)
  assert.match(PHOTO,/^@photo:/);
  // 세 페이지 — B 는 장면 셋 · 그림 둘 · 운동장 사진 표식
  const seed=()=>f.evaluate(PHOTO=>{
    window.__vaultBook=false;window.__vaultEdit=false;window.__vaultReadOnly=false;window.__curVaultId=null;try{stopAnim();}catch(_){}
    boardShowDefault();const copy=x=>JSON.parse(JSON.stringify(x)),base=captureSnap();
    const snap=(id,x,extra)=>({...copy(base),players:[{id,team:'blue',num:8,name:id,x,y:350}],equipment:[],drawings:[],ball:null,...(extra||{})});
    const draw=[{type:'line',color:'#ffffff',pts:[{x:200,y:200},{x:420,y:260}]},{type:'text',color:'#ffffff',size:26,text:'압박',pts:[{x:500,y:300}]}];
    const bFrames=[0,1,2].map(i=>({snap:snap('B',600+i*40,{drawings:copy(draw),pitchImg:PHOTO}),dur:1+i,cap:'장면 '+(i+1)}));
    const pages=[{name:'A',snap:snap('A',200),thumb:'',anim:null},{name:'B',snap:snap('B',600,{drawings:copy(draw),pitchImg:PHOTO}),thumb:'',anim:{frames:bFrames,active:0}},{name:'C',snap:snap('C',900),thumb:'',anim:null}];
    __psPages.restoreContext({pages,idx:0});loadSnap(pages[0].snap);__animReset();renderTokens();renderDrawings();clearBoardHistory();
  },PHOTO);
  const now=()=>f.evaluate(()=>({names:(__psPages.pg()||[]).map(p=>p.name||''),idx:__psPages.book.idx(),id:state.players[0]?.id||null,x:state.players[0]?.x??null,frames:anim.frames.length,draw:state.drawings.length,undo:undoStack.length,redo:redoStack.length}));
  const tab=i=>f.locator('#boardPageStrip .bp-tab').nth(i);
  const go=async i=>{await tab(i).click();await f.waitForFunction(i=>__psPages.book.idx()===i,i);};
  const edit=x=>f.evaluate(x=>{pushUndo();state.players[0].x=x;renderTokens();},x);
  // 진짜 키 — 맥은 ⌘Z, 그 밖은 Ctrl+Z. 초점을 일부러 빼지 않는다(창을 닫은 뒤 그대로 누르는 사용자처럼)
  const mod=engine==='webkit'?'Meta':'Control';
  const undo=()=>f.locator('body').press(mod+'+z'),redo=()=>f.locator('body').press(mod+'+Shift+z');
  const confirmOk=async()=>{const ok=f.locator('button[data-ps-ok]').last();await ok.waitFor({state:'visible'});await ok.click();await f.waitForFunction(()=>!document.querySelector('button[data-ps-ok]'));};
  const rename=async name=>{await f.locator('#boardPageStrip [title="페이지 이름 변경"],#boardPageStrip [data-tip="페이지 이름 변경"]').click();
    const ok=f.locator('button[data-ps-ok]').last();await ok.waitFor({state:'visible'});await ok.locator('xpath=../..').locator('input').fill(name);await ok.click();await f.waitForFunction(()=>!document.querySelector('button[data-ps-ok]'));};
  const add=()=>f.locator('#bpAddPage').click();
  const dup=()=>f.locator('#boardPageStrip [title="이 페이지 복제"],#boardPageStrip [data-tip="이 페이지 복제"]').click();
  const del=async()=>{await f.locator('#boardPageStrip .bp-more').click();await confirmOk();};
  const bodyOf=i=>f.evaluate(i=>{try{autoSaveAnimFrame();}catch(_){}const p=__psPages.liveVal().pages[i];return JSON.stringify({name:p.name,players:p.snap.players,drawings:p.snap.drawings,pitchImg:p.snap.pitchImg||null,frames:(p.anim&&p.anim.frames||[]).map(fr=>({x:fr.snap.players[0].x,dur:fr.dur,cap:fr.cap||'',draw:(fr.snap.drawings||[]).length}))});},i);

  step('rename-undo');   // 먼저 확인 — 이름 되돌리기는 지금도 된다(3.175). 초점을 빼지 않은 진짜 키로.
  await seed();await rename('Alpha');assert.deepEqual((await now()).names,['Alpha','B','C']);
  await undo();assert.deepEqual((await now()).names,['A','B','C'],'이름 바꾸기 되돌리기');
  await redo();assert.deepEqual((await now()).names,['Alpha','B','C']);await undo();

  step('add-undo');
  await seed();await edit(340);await rename('Alpha');
  await add();
  let s=await now();assert.deepEqual(s.names,['Alpha','','B','C']);assert.equal(s.idx,1);assert.equal(s.id,null,'새 페이지는 비어 있다');
  assert.equal(s.undo,3,'페이지를 더해도 앞의 기록(토큰 · 이름)이 남는다');
  await undo();s=await now();assert.deepEqual(s.names,['Alpha','B','C'],'추가 되돌리기');assert.equal(s.idx,0);assert.equal(s.id,'A');assert.equal(s.x,340);assert.equal(s.redo,1);
  await redo();s=await now();assert.deepEqual(s.names,['Alpha','','B','C'],'추가 다시 실행 — 같은 자리');assert.equal(s.idx,1);assert.equal(s.id,null);
  await undo();await undo();assert.deepEqual((await now()).names,['A','B','C'],'그 앞의 이름 바꾸기도 이어서 되돌려진다');
  await undo();s=await now();assert.equal(s.x,200,'그 앞의 토큰 편집도');assert.equal(s.undo,0);
  await redo();await redo();await redo();s=await now();assert.deepEqual(s.names,['Alpha','','B','C']);assert.equal(s.idx,1);
  assert.equal(await f.evaluate(()=>__psPages.pg()[0].snap.players[0].x),340,'다시 실행이 페이지를 섞지 않는다');
  // 새 페이지에서 그린 뒤 되돌리면 그린 것 → 페이지 차례로
  await f.evaluate(()=>{pushUndo();state.players=[{id:'N',team:'red',num:9,x:444,y:333}];renderTokens();});
  await undo();assert.equal((await now()).id,null);await undo();assert.deepEqual((await now()).names,['Alpha','B','C']);
  await redo();await redo();s=await now();assert.equal(s.idx,1);assert.equal(s.id,'N','새 페이지와 그 위 편집이 함께 돌아온다');

  step('delete-undo');
  await seed();await go(1);
  await f.evaluate(()=>{selectAnimFrame(1);});
  await edit(777);   // 지우기 직전의 편집(장면 2 위)도 지운 페이지와 함께 돌아와야 한다
  const before=await bodyOf(1);assert.match(before,/"x":777/);assert.ok(before.includes(PHOTO));
  const u0=(await now()).undo;
  await del();
  s=await now();assert.deepEqual(s.names,['A','C']);assert.equal(s.idx,0);assert.equal(s.id,'A');assert.equal(s.undo,u0+1,'삭제는 기록을 비우지 않고 한 줄');
  await page.screenshot({path:path.join(SHOTS,`board-page-undo-${engine}-${size}-deleted.png`)});
  await undo();
  s=await now();assert.deepEqual(s.names,['A','B','C'],'삭제 되돌리기 — 제자리(둘째)');assert.equal(s.idx,1,'지운 페이지가 다시 보인다');assert.equal(s.id,'B');assert.equal(s.frames,3,'장면 셋');assert.equal(s.draw,2,'그림 둘');
  assert.equal(await bodyOf(1),before,'지우기 직전 내용 그대로(장면 · 그림 · 운동장 사진 표식 · 마지막 편집)');
  assert.equal(await f.evaluate(()=>state.pitchImg),PHOTO);
  assert.equal(await f.locator('#boardPageStrip .bp-tab').count(),3);
  await page.screenshot({path:path.join(SHOTS,`board-page-undo-${engine}-${size}-restored.png`)});
  await redo();s=await now();assert.deepEqual(s.names,['A','C'],'다시 실행하면 다시 지운다');assert.equal(s.idx,0);assert.equal(s.id,'A');
  await undo();assert.equal(await bodyOf(1),before);
  await undo();assert.equal(await f.evaluate(()=>state.players[0].x),640,'되살린 페이지의 그 앞 편집도 되돌려진다(장면 2 의 원래 자리)');
  assert.doesNotMatch(await f.evaluate(()=>JSON.stringify(__psPages.liveVal())),/"_p[hmp]"|page-\d+/,'저장본에 식별자 · 기록을 넣지 않는다');

  step('delete-first-last-dup');
  await seed();await del();s=await now();assert.deepEqual(s.names,['B','C']);assert.equal(s.id,'B');
  await undo();s=await now();assert.deepEqual(s.names,['A','B','C']);assert.equal(s.idx,0);assert.equal(s.id,'A');
  await go(2);await del();s=await now();assert.deepEqual(s.names,['A','B']);assert.equal(s.idx,1);
  await undo();s=await now();assert.deepEqual(s.names,['A','B','C']);assert.equal(s.idx,2);assert.equal(s.id,'C');
  await go(1);await dup();s=await now();assert.deepEqual(s.names,['A','B','B 복사','C']);assert.equal(s.idx,2);assert.equal(s.frames,3);
  await undo();s=await now();assert.deepEqual(s.names,['A','B','C'],'복제 되돌리기');assert.equal(s.idx,1);
  await redo();s=await now();assert.deepEqual(s.names,['A','B','B 복사','C']);assert.equal(s.frames,3,'복제본의 장면도');

  step('single-page');
  await f.evaluate(()=>{boardShowDefault();__psPages.restoreContext({pages:null,idx:0});state.players=[{id:'S',team:'blue',num:1,x:100,y:100}];state.drawings=[];renderTokens();__animReset();clearBoardHistory();});
  await edit(150);await add();s=await now();assert.equal(s.names.length,2);assert.equal(s.undo,2);
  await undo();s=await now();assert.equal(s.names.length,1,'한 페이지 보드의 첫 추가 되돌리기');assert.equal(s.id,'S');assert.equal(s.x,150);
  await undo();assert.equal((await now()).x,100);
  assert.equal(await f.locator('#boardPageStrip .bp-more').count(),0,'한 장 남으면 지우기 단추가 없다(예전 그대로)');

  step('boundaries');
  // 여러 장을 한 번에 더하는 «미팅 세트» · 패턴북(시퀀스)은 예전처럼 기록을 비운다
  await seed();await edit(340);await f.evaluate(()=>__psPages.meetingSet());await confirmOk();
  s=await now();assert.equal(s.names.length,11);assert.equal(s.undo,0,'미팅 세트는 예전 경계');
  await undo();assert.equal((await now()).names.length,11);
  await seed();await f.evaluate(()=>{window.__vaultBook=true;window.__vaultEdit=true;window.__curVaultId='synthetic-book';});await edit(340);
  await f.evaluate(()=>__psPages.book.dup(0));s=await now();assert.equal(s.undo,0,'패턴북(시퀀스 복제)은 예전 경계');assert.equal(s.names.length,4);await undo();assert.equal((await now()).names.length,4);
  await f.evaluate(()=>{window.__vaultBook=false;window.__vaultEdit=false;window.__curVaultId=null;});

  step('vault-edit');
  // 보관함 작전판 편집 안에서도 같은 기록 — 나갔다 오면 작업 보드의 기록(지운 페이지 포함)이 그대로 돌아온다
  await seed();await go(1);const liveB=await bodyOf(1);await del();const liveState=await now();
  await f.evaluate(async()=>{const copy=x=>JSON.parse(JSON.stringify(x)),base=captureSnap(),sn=(id,x)=>({...copy(base),players:[{id,team:'blue',num:8,x,y:350}],drawings:[],pitchImg:null});
    const item={libId:'page-undo-vault',type:'board',name:'합성 페이지 되돌리기',owner:parent.PSSync.session().uid,savedAt:Date.now(),folder:'',tags:[],thumb:'',snap:sn('VA',420),pages:[{name:'Vault A',snap:sn('VA',420),thumb:''},{name:'Vault B',snap:sn('VB',720),thumb:''},{name:'Vault C',snap:sn('VC',820),thumb:''}]};
    const rows=await libGet();rows.unshift(item);await libWrite(rows);libTouch();});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="design"]:not([data-train])').click());
  await f.waitForFunction(()=>window.__csView==='session');await f.evaluate(()=>{libFilter.folder='__all';renderDrillFiles();});
  await f.locator('#drillFiles .vcard').filter({hasText:'합성 페이지 되돌리기'}).locator('button.edit').click();
  await f.waitForFunction(()=>window.__vaultEdit&&window.__curVaultId==='page-undo-vault'&&!window.__vaultHydrating&&__psPages.pg()?.length===3);
  assert.equal((await now()).undo,0,'보관함 편집은 제 기록으로 시작');
  await go(1);await del();s=await now();assert.deepEqual(s.names,['Vault A','Vault C']);assert.equal(s.undo,1);
  await undo();s=await now();assert.deepEqual(s.names,['Vault A','Vault B','Vault C'],'보관함 편집 안의 삭제 되돌리기');assert.equal(s.idx,1);assert.equal(s.id,'VB');assert.equal(s.x,720);
  await add();await undo();assert.deepEqual((await now()).names,['Vault A','Vault B','Vault C']);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  await page.locator('#fBoard').waitFor({state:'visible'});await f.waitForFunction(()=>window.__csView==='board'&&!window.__vaultEdit);
  assert.deepEqual(await now(),liveState,'작업 보드로 돌아오면 페이지 · 기록 그대로');
  await undo();s=await now();assert.deepEqual(s.names,['A','B','C'],'보관함에 다녀온 뒤에도 지운 페이지를 되살린다');assert.equal(s.idx,1);assert.equal(await bodyOf(1),liveB);

  step('save-reopen');
  // 지웠다 되살린 페이지가 저장 · 다시 열기 뒤에도 온전하다
  await seed();await go(1);const keep=await bodyOf(1);await del();await undo();
  assert.equal(await f.evaluate(()=>__boardSaveExplicit({quiet:true,noLink:true})),true);
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();await boot();
  await f.waitForFunction(()=>(__psPages.pg()||[]).length===3,null,{timeout:20000});
  assert.equal(await bodyOf(1),keep,'다시 연 뒤에도 그대로');
  assert.equal((await now()).undo,0,'새로 열면 기록은 비어 있다');

  const errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errors,[],JSON.stringify(errors));
  console.log(JSON.stringify({engine,size,ok:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
