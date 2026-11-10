import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.271 — 제보 756c0a48 «시야 기능 관련»(합성 팀 fixture 에서만 · 실계정 · 서버 없음).
//  ① 한 페이지에서 토큰의 «시야»를 누르면 다른 페이지의 같은 토큰은 그대로여야 한다.
//  ② 장면에서 누르면 그 장면부터 뒤로 이어 켜지고 꺼진다(뒤에서 따로 바꿔 둔 장면 앞까지 — 3.254 «계속 강조»와 같은 규칙) · ⌘Z 한 번.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
const step=s=>{try{fx.setStep(s);}catch(_){}console.log('board-vision-carry-3271 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psPages,null,{timeout:30000});
  await f.waitForFunction(()=>window.__csView==='board');
  // 페이지 둘(같은 선수 id 7 · 8) — 1페이지에 장면 여덟, 2페이지에 장면 셋.
  const seed=()=>f.evaluate(()=>{
    window.__vaultBook=false;window.__vaultEdit=false;window.__vaultReadOnly=false;window.__curVaultId=null;
    try{stopAnim();}catch(_){}
    boardShowDefault();const copy=x=>JSON.parse(JSON.stringify(x)),base=captureSnap();
    const snap=dx=>({...copy(base),players:[{id:7,team:'blue',num:'7',name:'가',x:300+dx,y:300,dir:0},{id:8,team:'blue',num:'8',name:'나',x:500+dx,y:420,dir:0}],equipment:[],drawings:[],ball:null});
    const frames=(n,dx)=>Array.from({length:n},(_,i)=>({snap:snap(dx+i*12),dur:1}));
    const pages=[{name:'하나',snap:snap(0),thumb:'',anim:{frames:frames(8,0),active:0}},{name:'둘',snap:snap(40),thumb:'',anim:{frames:frames(3,40),active:0}}];
    __psPages.restoreContext({pages,idx:0});loadSnap(pages[0].snap);__animRestore(pages[0].anim.frames,0);renderTokens();renderAnimFrames();clearBoardHistory();
  });
  // 장면마다 그 선수의 시야(지금 장면은 판, 다른 장면은 장면에 담긴 판)
  const visNow=id=>f.evaluate(id=>{try{autoSaveAnimFrame();}catch(_){}return anim.frames.map(fr=>{const p=(fr.snap.players||[]).find(p=>p.id===id);return p&&p.vis?1:0;}).join('');},id);
  const other=()=>f.evaluate(()=>JSON.stringify((__psPages.pg()||[]).map((p,i)=>i===__psPages.book.idx()?null:{snap:p.snap.players,frames:(p.anim&&p.anim.frames||[]).map(fr=>fr.snap.players)})));
  const scene=k=>f.evaluate(k=>{selectAnimFrame(k);},k);
  const press=async id=>{await f.evaluate(id=>{const p=state.players.find(p=>p.id===id);sel={type:'player',ref:p};multiSel=[];renderTokens();updateDelUI();},id);
    await f.evaluate(()=>document.getElementById('visBtn').click());};
  const undoN=()=>f.evaluate(()=>undoStack.length);

  step('look-at-this-page-only');
  // «시선»(바라볼 대상 고르기)은 시야도 함께 켠다 — 이 페이지의 모든 장면에(2.980), 다른 페이지는 그대로(고치기 전엔 모든 페이지의 같은 토큰에 시야가 켜졌다).
  await seed();await scene(3);
  const before3=await other();
  await f.evaluate(()=>{const p=state.players.find(p=>p.id===8);sel={type:'player',ref:p};multiSel=[];renderTokens();updateDelUI();document.getElementById('lookBtn').click();lookPickTarget(state.players.find(p=>p.id===7));});
  assert.equal(await f.evaluate(()=>{try{autoSaveAnimFrame();}catch(_){}return anim.frames.map(fr=>{const p=fr.snap.players.find(p=>p.id===8);return p.lookAt===7&&p.vis?1:0;}).join('');}),'11111111','시선은 이 페이지의 모든 장면에');
  assert.equal(await other(),before3,'시선 · 시야가 다른 페이지로 번지지 않는다');
  await f.evaluate(()=>{const p=state.players.find(p=>p.id===8);sel={type:'player',ref:p};multiSel=[];updateDelUI();document.getElementById('lookBtn').click();});
  assert.equal(await f.evaluate(()=>anim.frames.some(fr=>fr.snap.players.find(p=>p.id===8).lookAt!=null)),false,'시선 끄기도 이 페이지의 모든 장면');
  assert.equal(await other(),before3,'시선을 꺼도 다른 페이지는 그대로');
  // 잔상은 2.980 그대로 모든 페이지에
  await f.evaluate(()=>{const p=state.players.find(p=>p.id===8);sel={type:'player',ref:p};multiSel=[];updateDelUI();cycleTrail();});
  assert.equal(await f.evaluate(()=>__psPages.pg()[1].snap.players.find(p=>p.id===8).trail),1,'잔상은 예전처럼 모든 페이지');

  step('other-pages-untouched');
  await seed();
  const before=await other();
  await scene(3);const u0=await undoN();await press(7);
  assert.equal(await other(),before,'다른 페이지의 같은 토큰(판 · 장면)은 그대로');
  assert.equal(await f.evaluate(()=>!!state.players.find(p=>p.id===7).vis),true,'지금 장면의 토큰은 시야가 켜졌다');
  assert.equal(await f.evaluate(()=>!!document.querySelector('#tokenLayer .vision-cone,#visionLayer path,#visionLayer polygon,.vis-cone')||!!state.players.find(p=>p.id===7).visW),true,'시야가 그려진다');

  step('carry-forward');
  assert.equal(await visNow(7),'00011111','장면 4에서 켜면 4~8 이 켜진다(앞 장면은 그대로)');
  assert.equal(await visNow(8),'00000000','고르지 않은 토큰은 그대로');
  assert.equal(await undoN(),u0+1,'되돌리기 기록 하나');
  await f.evaluate(()=>undoLast());
  assert.equal(await visNow(7),'00000000','⌘Z 한 번에 모든 장면이 돌아온다');
  assert.equal(await other(),before,'되돌린 뒤에도 다른 페이지는 그대로');
  await f.evaluate(()=>redoLast());
  assert.equal(await visNow(7),'00011111','다시 실행');

  step('stops-at-user-change');
  // 장면 7 에서 끈다 → 7~8 꺼짐. 그다음 장면 2 에서 켜면 2~3 만(장면 4~6 은 이미 켜져 있어 «다른 상태» — 거기서 멈춘다).
  await scene(6);await press(7);
  assert.equal(await visNow(7),'00011100','장면 7에서 끄면 7~8 이 꺼진다');
  await scene(1);await press(7);
  assert.equal(await visNow(7),'01111100','장면 2에서 켜면 따로 켜 둔 장면 앞까지만 — 뒤에서 끈 장면(7 · 8)은 그대로');
  await scene(4);await press(7);
  assert.equal(await visNow(7),'01110000','장면 5에서 끄면 따로 꺼 둔 장면 앞까지(5~6)');
  assert.equal(await other(),before,'여러 번 눌러도 다른 페이지는 그대로');

  step('page-switch-keeps');
  // 페이지를 넘겼다 돌아와도 장면마다의 값이 남고, 2페이지는 처음 그대로다.
  await f.locator('#boardPageStrip .bp-tab').nth(1).click();
  await f.waitForFunction(()=>__psPages.book.idx()===1&&anim.frames.length===3);
  assert.equal(await visNow(7),'000','2페이지의 장면은 그대로');
  assert.equal(await f.evaluate(()=>!!state.players.find(p=>p.id===7).vis),false,'2페이지 판도 그대로');
  await scene(1);await press(8);
  assert.equal(await visNow(8),'011','2페이지에서 켜면 2페이지의 그 장면부터');
  await f.locator('#boardPageStrip .bp-tab').nth(0).click();
  await f.waitForFunction(()=>__psPages.book.idx()===0&&anim.frames.length===8);
  assert.equal(await visNow(7),'01110000','1페이지는 넘기기 전 그대로');
  assert.equal(await visNow(8),'00000000','2페이지에서 켠 것이 1페이지로 오지 않는다');

  step('no-scenes');
  // 장면이 없는 판(장면 막대 닫힘)은 예전처럼 그 판의 토큰만.
  await f.evaluate(()=>{boardShowDefault();const copy=x=>JSON.parse(JSON.stringify(x)),base=captureSnap();
    const snap=dx=>({...copy(base),players:[{id:7,team:'blue',num:'7',x:300+dx,y:300}],equipment:[],drawings:[],ball:null});
    const pages=[{name:'하나',snap:snap(0),thumb:'',anim:null},{name:'둘',snap:snap(40),thumb:'',anim:null}];
    __psPages.restoreContext({pages,idx:0});loadSnap(pages[0].snap);__animReset();renderTokens();clearBoardHistory();});
  const before2=await other();await press(7);
  assert.equal(await f.evaluate(()=>!!state.players[0].vis),true);
  assert.equal(await other(),before2,'장면 없는 판에서도 다른 페이지는 그대로');
  await f.evaluate(()=>undoLast());assert.equal(await f.evaluate(()=>!!state.players[0].vis),false);

  const errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errors,[],JSON.stringify(errors));
  console.log(JSON.stringify({engine,size,ok:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
