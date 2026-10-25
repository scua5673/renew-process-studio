import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,OUT,SHOTS} from '../fixtures/team-app.mjs';

// The optional baseline is an exact old board.html served only by this isolated fixture.
// It proves both reported failures before checking the same real UI/keyboard path after repair.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=process.env.PS_SIZE||(engine==='webkit'?'ipad':'desktop');
const baseline=process.env.PS_PAGE_HISTORY_BASELINE,fx=await startFixture(),browsers={},results=[];
const B_NAME='B';let activePage,activeFrame;
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  activePage=page;
  await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
  let f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
  activeFrame=f;
  if(baseline){
    const old=fs.readFileSync(baseline,'utf8');
    await context.route('**/studio/board.html*',route=>route.fulfill({body:old,contentType:'text/html; charset=utf-8'}));
    await f.evaluate(()=>location.reload());
  }
  await f.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&window.__psPages,null,{timeout:30000});
  const now=()=>f.evaluate(()=>({names:(__psPages.pg()||[]).map(p=>p.name),idx:__psPages.book.idx(),id:state.players[0]?.id,x:state.players[0]?.x,frames:anim.frames.length,undo:undoStack.length,redo:redoStack.length}));
  async function showBoard(){
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="board"]:not([data-train])').click());
    await page.locator('#fBoard').waitFor({state:'visible'});
    await f.waitForFunction(()=>window.__csView==='board');
  }
  async function seed(single=false){await showBoard();
    await f.evaluate(({single,B_NAME})=>{
    window.__vaultBook=false;window.__vaultEdit=false;window.__vaultReadOnly=false;window.__curVaultId=null;
    boardShowDefault();const copy=x=>JSON.parse(JSON.stringify(x)),base=captureSnap();
    const snap=(id,x)=>({...copy(base),players:[{id,team:'blue',num:8,name:id,x,y:350}],equipment:[],drawings:[],ball:null});
    const pages=[['A',200],['B',600],['C',900]].map(([name,x])=>({name:name==='B'?B_NAME:name,snap:snap(name,x),thumb:'',anim:null}));
    __psPages.restoreContext({pages:single?null:pages,idx:0});loadSnap(pages[0].snap);__animReset();renderTokens();clearBoardHistory();
  },{single,B_NAME});}
  async function edit(x){await f.evaluate(x=>{pushUndo();state.players[0].x=x;renderTokens();},x);}
  async function rename(index,name,inactive=false){
    if(inactive)await f.locator('#boardPageStrip .bp-tab').nth(index).dblclick({position:{x:12,y:12}});
    else await f.locator('#boardPageStrip [title="페이지 이름 변경"]').click();
    const ok=f.locator('button[data-ps-ok]').last();await ok.waitFor({state:'visible'});
    const input=ok.locator('xpath=../..').locator('input');await input.fill(name);await ok.click();
    const remaining=await f.locator('button[data-ps-ok]').evaluateAll(bs=>bs.map(b=>b.parentElement.parentElement.textContent));
    if(baseline&&inactive&&remaining.length){
      assert.deepEqual(remaining,['이 페이지를 삭제할까요?취소삭제'],'old reflow sends the second click to the new delete control');
      results.push({case:'old-short-tab-control-reflow',remaining});await f.getByRole('button',{name:'취소',exact:true}).last().click();
    }else assert.deepEqual(remaining,[],'one rename gesture opens one dialog');
    await f.waitForFunction(({index,name})=>__psPages.pg()?.[index]?.name===name,{index,name});
  }
  async function key(redo=false){await f.evaluate(()=>document.activeElement?.blur());await f.locator('body').press(redo?'Control+Shift+z':'Control+z');}
  async function reorder(from,to){await f.evaluate(({from,to})=>{
    const tabs=document.querySelectorAll('#boardPageStrip .bp-tab'),dt=new DataTransfer();
    tabs[from].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:dt}));
    tabs[to].dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt}));
  },{from,to});}
  async function duplicateCase(){
    await seed();await edit(340);assert.equal((await now()).undo,1);
    assert.equal(await f.evaluate(()=>__psPages.duplicateByName('A','Review')),true);
    const copied=await now();assert.deepEqual(copied.names,['A','Review','B','C']);assert.equal(copied.idx,1);assert.equal(copied.x,340);assert.equal(copied.undo,0,'review duplication preserves its old history boundary');
    await key();assert.deepEqual(await now(),copied,'undo cannot replace the new review page with an earlier source-page snapshot');results.push({case:'review-duplication-boundary',ok:true});
  }

  if(process.env.PS_PAGE_HISTORY_CASE==='duplicate')await duplicateCase();
  else{

  await seed();await edit(340);await rename(0,'Alpha');await reorder(0,2);await key();
  const first=await now();results.push({case:'rename-reorder-first-undo',state:first});
  if(baseline){assert.deepEqual(first.names,[B_NAME,'C','Alpha']);assert.equal(first.x,200,'old CmdZ incorrectly consumes the token edit');}
  else{
    assert.deepEqual(first.names,['Alpha',B_NAME,'C'],'first undo reverses page order');assert.equal(first.x,340,'page undo preserves the earlier token edit');
    await key();assert.equal((await now()).names[0],'A');assert.equal((await now()).x,340);
    await key();assert.equal((await now()).x,200);
    await key(true);await key(true);await key(true);
    assert.deepEqual(await now(),{names:[B_NAME,'C','Alpha'],idx:2,id:'A',x:340,frames:0,undo:3,redo:0});
  }

  await seed();await edit(340);await rename(1,'Beta',true);const inactive=await now();await key();const undone=await now();
  results.push({case:'inactive-double-click',beforeUndo:inactive,afterUndo:undone});
  if(baseline){assert.equal(inactive.undo,0,'old inactive click clears the token edit');assert.equal(undone.names[1],'Beta','old rename cannot be undone');}
  else{
    assert.equal(inactive.undo,2);assert.equal(undone.names[1],B_NAME);assert.equal(undone.id,'B');assert.equal(undone.x,600);
    await key();assert.equal((await now()).id,'A');assert.equal((await now()).x,200,'undo returns to the owning page');
    await key(true);await key(true);assert.equal((await now()).names[1],'Beta');assert.equal((await now()).id,'B');
    await f.locator('#boardPageStrip .bp-tab').nth(0).click();assert.equal((await now()).x,340,'redo never copied the other page over A');
  }
  if(!baseline){
    await seed(true);await edit(340);await rename(0,'Single');await key();assert.equal((await now()).names[0],'');await key();assert.equal((await now()).x,200,'virtual single page adopts its identity when named');
    await seed();await f.evaluate(()=>{pushUndo();anim.frames=[{snap:captureSnap(),dur:1},{snap:captureSnap(),dur:2}];animActive=1;renderAnimFrames();});
    await f.locator('#boardPageStrip .bp-tab').nth(1).click();await key();assert.equal((await now()).id,'A');assert.equal((await now()).frames,0);await key(true);assert.equal((await now()).frames,2);
    results.push({case:'single-and-animation-history',ok:true});

    // Capture lends the same canvas but must return the original page identities and stacks.
    await seed();await edit(340);await rename(0,'Alpha');const live=await now();
    await page.evaluate(()=>document.querySelector('#fBoard').contentWindow.postMessage({type:'enterCapture',snap:{players:[],equipment:[],drawings:[],ball:null}},location.origin));
    await f.waitForFunction(()=>document.body.classList.contains('ps-capturing')&&__psPages.lent());
    assert.equal((await now()).undo,0);await f.evaluate(()=>{pushUndo();state.players=[{id:'CAPTURE',team:'red',num:9,x:100,y:100}];renderTokens();});
    await f.getByRole('button',{name:'취소',exact:true}).last().click();await f.waitForFunction(()=>!__psPages.lent());
    assert.deepEqual(await now(),live);await showBoard();await key();assert.equal((await now()).names[0],'A');assert.equal((await now()).x,340);
    results.push({case:'capture-history-restored',ok:true});

    await seed();await edit(340);await rename(0,'Alpha');const beforeEditor=await now();
    await f.evaluate(()=>openEditor(null,'train'));await f.waitForFunction(()=>document.body.classList.contains('editing'));
    assert.equal((await now()).undo,0,'training editor starts with its own history');
    await f.evaluate(()=>{pushUndo();state.players=[{id:'EDITOR',team:'red',num:9,x:100,y:100}];renderTokens();closeEditor(false);});
    await f.waitForFunction(()=>!document.body.classList.contains('editing'));
    assert.deepEqual(await now(),beforeEditor);await showBoard();await key();assert.equal((await now()).names[0],'A');assert.equal((await now()).x,340);
    results.push({case:'editor-history-isolated',ok:true});

    // Open a real library-board edit, then restore JSON-cloned work context and its IDs.
    await seed();await edit(340);await rename(0,'Alpha');const beforeVault=await now();
    await f.evaluate(async()=>{const copy=x=>JSON.parse(JSON.stringify(x)),base=captureSnap(),sn=(id,x)=>({...copy(base),players:[{id,team:'blue',num:8,x,y:350}]});
      const item={libId:'page-history-vault',type:'board',name:'합성 페이지 기록',owner:parent.PSSync.session().uid,savedAt:Date.now(),folder:'',tags:[],thumb:'',snap:sn('VA',420),pages:[{name:'Vault A',snap:sn('VA',420),thumb:''},{name:'Vault B',snap:sn('VB',720),thumb:''}]};
      const rows=await libGet();rows.unshift(item);await libWrite(rows);libTouch();});
    await page.evaluate(()=>document.querySelector('#appSeg [data-app="design"]:not([data-train])').click());
    await f.waitForFunction(()=>window.__csView==='session');await f.evaluate(()=>{libFilter.folder='__all';renderDrillFiles();});
    await f.locator('#drillFiles .vcard').filter({hasText:'합성 페이지 기록'}).locator('button.edit').click();
    await f.waitForFunction(()=>window.__vaultEdit&&window.__curVaultId==='page-history-vault'&&!window.__vaultHydrating&&__psPages.pg()?.length===2);
    assert.equal((await now()).undo,0);await edit(460);await rename(0,'Vault Alpha');await reorder(0,1);await key();
    assert.deepEqual((await now()).names,['Vault Alpha','Vault B']);assert.equal((await now()).x,460);await key();assert.equal((await now()).names[0],'Vault A');await key();assert.equal((await now()).x,420);
    await showBoard();assert.deepEqual(await now(),beforeVault,'returning restores live pages, tokens and chronological history');
    await key();assert.equal((await now()).names[0],'A');assert.equal((await now()).x,340);await key();assert.equal((await now()).x,200,'live board history remains usable after JSON-cloned vault context');
    results.push({case:'vault-edit-and-live-context-history',ok:true});
  }

  // Patternbook pages are sequences; their existing document boundary remains in both versions.
  await seed();await f.evaluate(()=>{window.__vaultBook=true;window.__vaultEdit=true;window.__curVaultId='synthetic-book';});await edit(340);
  assert.equal((await now()).undo,1);await f.evaluate(()=>__psPages.book.go(1));assert.equal((await now()).undo,0,'sequence navigation clears its local board undo');
  await key();assert.equal((await now()).id,'B');assert.equal((await now()).x,600,'CmdZ cannot put sequence A onto sequence B');
  results.push({case:'patternbook-navigation-boundary',ok:true});
  await f.evaluate(()=>{window.__vaultBook=false;window.__vaultEdit=false;window.__curVaultId=null;});
  await duplicateCase();
  await seed();await edit(340);await rename(1,'Beta',true);
  await page.screenshot({path:path.join(SHOTS,`board-page-history-${engine}-${size}-${baseline?'before':'after'}.png`)});
  if(!baseline&&engine==='webkit'){
    await seed();await edit(340);
    await f.evaluate(()=>{const r=document.querySelector('#boardPageStrip .bp-tab').getBoundingClientRect();document.querySelector('#boardPageStrip .bp-tab').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'touch',pointerId:71,clientX:r.left+10,clientY:r.top+10}));});
    await f.locator('#boardPageStrip .bp-dragging').waitFor({state:'attached'});
    await f.evaluate(()=>{const r=document.querySelectorAll('#boardPageStrip .bp-tab')[2].getBoundingClientRect(),opts={bubbles:true,pointerType:'touch',pointerId:71,clientX:r.left+10,clientY:r.top+10};document.dispatchEvent(new PointerEvent('pointermove',opts));document.dispatchEvent(new PointerEvent('pointerup',opts));});
    assert.deepEqual((await now()).names,['B','C','A']);await key();assert.deepEqual((await now()).names,['A','B','C']);assert.equal((await now()).x,340,'touch reorder undo preserves the prior token edit');
    results.push({case:'touch-hold-reorder-history',ok:true});
  }
  }
  const errors=logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text));assert.deepEqual(errors,[],JSON.stringify(errors));
  const report={engine,size,baseline:!!baseline,ok:true,results};fs.writeFileSync(path.join(OUT,`board-page-history-${engine}-${baseline?'before':'after'}.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){
  const diagnostics=await activeFrame?.evaluate(()=>({dialogs:[...document.querySelectorAll('button[data-ps-ok]')].map(b=>b.parentElement.parentElement.textContent),body:document.body.className,view:window.__csView})).catch(()=>null);
  console.error(JSON.stringify({results,diagnostics}));await activePage?.screenshot({path:path.join(SHOTS,`board-page-history-${engine}-failure.png`)}).catch(()=>{});throw error;
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
