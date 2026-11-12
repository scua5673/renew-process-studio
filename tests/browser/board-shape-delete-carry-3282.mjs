import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.282 — 제보 74e59fd4 «도형 삭제 기능»(합성 팀 fixture 에서만 · 실계정 · 서버 없음).
//  장면에서 그림을 지우면 그 장면부터 뒤 장면에서도 지워진다(앞 장면은 그대로) · ⌘Z 한 번 · 알림의 «이 장면만» · 잘라내기는 이 장면만 · 다른 페이지 그대로.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
const step=s=>{try{fx.setStep(s);}catch(_){}console.log('board-shape-delete-carry-3282 '+s);};
try{
  const {page,logs}=await openApp(fx,size,{browsers});
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  await f.waitForFunction(()=>typeof renderTokens==='function'&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psPages,null,{timeout:30000});
  await f.waitForFunction(()=>window.__csView==='board');
  // 1페이지 장면 여섯: 사각형 A(장면마다 조금씩 옮겨 둠) · 선 B 는 모든 장면, 원 C 는 장면 3~6. 2페이지에도 같은 A.
  const seed=()=>f.evaluate(()=>{
    window.__vaultBook=false;window.__vaultEdit=false;window.__vaultReadOnly=false;window.__curVaultId=null;
    try{stopAnim();}catch(_){}
    boardShowDefault();const copy=x=>JSON.parse(JSON.stringify(x)),base=captureSnap();
    const A=i=>({type:'rect',_sceneId:'A',color:'#3a6df0',lw:1,op:1,pts:[{x:300+i*10,y:200},{x:420+i*10,y:300}]});
    const B=()=>({type:'line',_sceneId:'B',color:'#ffffff',lw:1,op:1,pts:[{x:500,y:400},{x:700,y:460}]});
    const C=()=>({type:'ellipse',_sceneId:'C',color:'#e23b3b',lw:1,op:1,pts:[{x:600,y:150},{x:700,y:230}]});
    const snap=i=>({...copy(base),players:[{id:7,team:'blue',num:'7',x:300,y:500,dir:0}],equipment:[],ball:null,drawings:[A(i),B()].concat(i>=2?[C()]:[])});
    const frames=n=>Array.from({length:n},(_,i)=>({snap:snap(i),dur:1}));
    const pages=[{name:'하나',snap:snap(0),thumb:'',anim:{frames:frames(6),active:0}},{name:'둘',snap:snap(0),thumb:'',anim:{frames:frames(3),active:0}}];
    __psPages.restoreContext({pages,idx:0});loadSnap(pages[0].snap);__animRestore(pages[0].anim.frames,0);renderTokens();renderDrawings();renderAnimFrames();clearBoardHistory();
  });
  const has=id=>f.evaluate(id=>{try{autoSaveAnimFrame();}catch(_){}return anim.frames.map(fr=>(fr.snap.drawings||[]).some(d=>d._sceneId===id)?1:0).join('');},id);
  const other=()=>f.evaluate(()=>JSON.stringify((__psPages.pg()||[]).map((p,i)=>i===__psPages.book.idx()?null:{snap:p.snap.drawings,frames:(p.anim&&p.anim.frames||[]).map(fr=>fr.snap.drawings)})));
  const scene=k=>f.evaluate(k=>{selectAnimFrame(k);},k);
  const pick=ids=>f.evaluate(ids=>{const ds=ids.map(id=>state.drawings.find(d=>d._sceneId===id));if(ds.some(d=>!d))throw new Error('no drawing '+ids);
    if(ds.length===1){sel={type:'drawing',ref:ds[0]};multiSel=[];}else{sel=null;multiSel=ds;}renderDrawings();updateDelUI();},ids);
  const toastText=()=>f.evaluate(()=>((document.getElementById('cs-ftoast')||{}).textContent||'').trim());
  const undoN=()=>f.evaluate(()=>undoStack.length);

  step('delete-carries-forward');
  await seed();const before=await other();
  await scene(2);await pick(['A']);const u0=await undoN();
  await f.evaluate(()=>deleteSelected());
  assert.equal(await has('A'),'110000','장면 3에서 지우면 3~6 에서 사라진다(앞 장면은 그대로)');
  assert.equal(await has('B'),'111111','고르지 않은 그림은 그대로');
  assert.equal(await has('C'),'001111');
  assert.match(await toastText(),/장면 4~6에서도 지웠어요/);
  assert.equal(await undoN(),u0+1,'되돌리기 기록 하나');
  assert.equal(await other(),before,'다른 페이지의 같은 그림은 그대로');
  await f.evaluate(()=>undoLast());
  assert.equal(await has('A'),'111111','⌘Z 한 번에 모든 장면이 돌아온다');
  await f.evaluate(()=>redoLast());
  assert.equal(await has('A'),'110000','다시 실행');

  step('this-scene-only');
  await seed();await scene(1);await pick(['B']);
  await f.evaluate(()=>deleteSelected());
  assert.equal(await has('B'),'100000');
  await f.locator('#cs-ftoast .ftoast-act').click();
  assert.equal(await has('B'),'101111','«이 장면만» — 뒤 장면은 되돌리고 지금 장면의 삭제는 남는다');
  assert.match(await toastText(),/이 장면에서만/);

  step('several-and-stop');
  // 장면 5 에서 C 를 먼저 지운 뒤(5~6), 장면 3 에서 A · C 를 함께 지우면 A 는 3~6, C 는 이미 없는 장면 앞까지(3~4).
  await seed();await scene(4);await pick(['C']);await f.evaluate(()=>deleteSelected());
  assert.equal(await has('C'),'001100');
  await scene(2);await pick(['A','C']);await f.evaluate(()=>deleteSelected());
  assert.equal(await has('A'),'110000');assert.equal(await has('C'),'000000');assert.equal(await has('B'),'111111');

  step('right-click-menu-and-eraser');
  await seed();await scene(3);
  await f.evaluate(()=>{const d=state.drawings.find(d=>d._sceneId==='C');__psShapeMenu.open(d,300,300);document.querySelector('#psShapeMenu [data-act="del"]').click();});
  assert.equal(await has('C'),'001000','오른쪽 클릭 창의 «삭제»도 같은 규칙');
  await f.evaluate(()=>{removeDrawing(state.drawings.find(d=>d._sceneId==='B'));});
  assert.equal(await has('B'),'111000','지우개(removeDrawing)도 같은 규칙');

  step('cut-last-scene-no-scenes');
  await seed();await scene(1);await pick(['A']);
  await f.evaluate(()=>{if(tokClipCopy())deleteSelected();});
  assert.equal(await has('A'),'101111','잘라내기는 이 장면만(옮기려는 것)');
  await new Promise(r=>setTimeout(r,50));
  await scene(5);await pick(['B']);await f.evaluate(()=>deleteSelected());
  assert.equal(await has('B'),'111110','마지막 장면은 그 장면만');
  assert.equal(await f.evaluate(()=>!document.querySelector('#cs-ftoast .ftoast-act')),true,'뒤에 지운 것이 없으면 «이 장면만» 단추가 없다');
  await f.evaluate(()=>{boardShowDefault();__animReset();state.drawings=[{type:'rect',color:'#fff',pts:[{x:300,y:200},{x:400,y:300}]}];renderDrawings();clearBoardHistory();
    sel={type:'drawing',ref:state.drawings[0]};multiSel=[];updateDelUI();deleteSelected();});
  assert.equal(await f.evaluate(()=>state.drawings.length),0,'장면 없는 판은 예전 그대로');

  const errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errors,[],JSON.stringify(errors));
  console.log(JSON.stringify({engine,size,ok:true,passed:true}));
}catch(e){console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
