import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url);
const playwright=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const engine=process.env.PS_BROWSER_ENGINE||'webkit';
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/vault-board-isolation',engine);
fs.mkdirSync(out,{recursive:true});
const UID='11111111-1111-4111-8111-111111111111',WID='22222222-2222-4222-8222-222222222222';
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;font:14px system-ui}nav{height:40px;display:flex;gap:12px;align-items:center;padding:0 12px;background:#f4f5f8}button{padding:6px 16px}iframe{border:0;width:100%;height:calc(100% - 40px)}</style><nav><button id="live" onclick="document.querySelector('iframe').contentWindow.boardShowDefault()">작업 보드</button><button id="library" onclick="document.querySelector('iframe').contentWindow.setView('session')">보관함</button><span>가상 데이터 검증</span></nav><iframe src="/studio/board.html?fixture=vault-isolation"></iframe><script>addEventListener('message',e=>{const f=document.querySelector('iframe');if(e.source!==f.contentWindow||e.origin!==location.origin)return;if(e.data?.type==='goApp'&&e.data.app==='design')f.contentWindow.setView('session');});</script>`;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
  if(pathname==='/fixture.html'){res.writeHead(200,{'Content-Type':mime['.html']});res.end(fixture);return;}
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
async function newFixture(browser,spec){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,isMobile:!!spec.mobile,serviceWorkers:'block'});
  await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  await context.addInitScript(({uid,wid})=>{
    if(!localStorage.getItem('fixture-seeded')){
      localStorage.setItem('fixture-seeded','1');
      localStorage.setItem('ps_sync_session',JSON.stringify({uid,at:'fixture-only',rt:'fixture-only'}));
      localStorage.setItem('ps_active_ws',wid);
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid,wid,nonce:'fixture'}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:wid,kind:'team',role:'owner',name:'가상 팀'}]));
      localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,defaultRole:'player',members:{[uid]:{role:'executive'}}}));
      localStorage.setItem('cs_lang','ko');localStorage.setItem('cs_theme','light');
    }
    window.fixtureLocked=false;
    window.PSSync={session:()=>JSON.parse(localStorage.getItem('ps_sync_session')),activeWs:()=>localStorage.getItem('ps_active_ws'),activeWsObj:()=>JSON.parse(localStorage.getItem('ps_ws_list')).find(w=>w.id===localStorage.getItem('ps_active_ws')),dataUnlocked:()=>!window.fixtureLocked,keyReady:()=>true,displayName:()=> '가상 코치',act(){},ping(){},event(){}};
    // Enforce the real personal-board v2 owner and compare-and-swap contract.
    const personal='33333333-3333-4333-8333-333333333333', serverKey='fixture_personal_board_v2';
    const owner=()=>({uid:uid,wid:personal,active:wid,seal:uid+':'+wid+':1',epoch:1,switchSeal:'',switchEpoch:'1'});
    const response=()=>({ok:true,uid:uid,wid:personal,...JSON.parse(localStorage.getItem(serverKey)||'{"raw":null,"cupd":null}')});
    const spaces=JSON.parse(localStorage.getItem('ps_ws_list')||'[]');
    if(!spaces.some(w=>w.id===personal)){spaces.push({id:personal,kind:'personal',role:'owner',owner_id:uid});localStorage.setItem('ps_ws_list',JSON.stringify(spaces));}
    window.PSSync.boardLive={version:2,scope:'personal',owner,async get(){return response();},async save(raw,options){
      const old=response();if(options.uid!==uid||options.wid!==personal)throw Error('fixture owner mismatch');
      if(raw!==old.raw){if(options.expected_raw!==old.raw||options.expected_cupd!==old.cupd)throw Error('fixture CAS conflict');
        localStorage.setItem(serverKey,JSON.stringify({raw,cupd:Math.max(Date.now(),(old.cupd||0)+1)}));}
      return response();
    }};
  },{uid:UID,wid:WID});
  const page=await context.newPage();page.setDefaultTimeout(12000);
  await page.goto(base+'/fixture.html');
  const frame=page.frame({url:/\/studio\/board.html\?fixture=vault-isolation$/});
  await frame.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window.__psPages);
  await page.waitForTimeout(1100);
  return {context,page,frame};
}
async function seed(frame,{blank=false}={}){
  return frame.evaluate(async({uid,blank})=>{
    const clone=v=>JSON.parse(JSON.stringify(v));
    window.boardShowDefault();
    const template=captureSnap();
    const snap=(name,x)=>({...clone(template),players:blank&&name==='LIVE'?[]:[{id:name,team:'A',num:8,name,x,y:350}],equipment:[],drawings:[],ball:null,matchNote:name,orientation:template.orientation,pitchN:1});
    const live=snap('LIVE',460),other=snap('LIVE-OTHER',680),a=snap('LIBRARY-A',300),b=snap('LIBRARY-B',850);
    const thumb='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><rect width="1600" height="1000" fill="#eaf3e9"/></svg>';
    const frames=(sn,label)=>[{snap:clone(sn),thumb,title:label+' 1',dur:1,__t:'',__tc:'#e23b3b',__hold:.6},{snap:clone(sn),thumb,title:label+' 2',dur:1}];
    const liveFrames=blank?[]:frames(live,'LIVE-FRAME');
    if(!blank){
      window.__pendingBoardPages={pages:[{name:'LIVE-PAGE-1',snap:other,thumb,anim:null},{name:'LIVE-PAGE-2',snap:live,thumb,anim:{frames:liveFrames,active:1}}],idx:1};
      window.__psPagesConsume();
    }
    loadSnap(live);anim.frames=clone(liveFrames);animActive=blank?-1:1;renderAnimFrames();
    document.getElementById('animBar').classList.toggle('on',!blank);
    window.__viewSnaps={board:clone(live)};
    undoStack=[{board:clone(other),anim:{frames:clone(liveFrames),active:0}}];redoStack=[{board:clone(live),anim:{frames:clone(liveFrames),active:1}}];
    const items=[{libId:'fixture-a',name:'가상 보관함 A',snap:a},{libId:'fixture-b',name:'가상 보관함 B',snap:b}].map(d=>({...d,type:'board',createdBy:uid,author:'가상 코치',savedAt:1,thumb,frames:frames(d.snap,d.libId),pages:[{name:d.libId+' PAGE 1',snap:clone(d.snap),thumb},{name:d.libId+' PAGE 2',snap:clone(d.snap),thumb}]}));
    await libWrite(items);libTouch();
    await window.__boardSaveExplicit();
    await new Promise(r=>setTimeout(r,100));
    if(blank)delete window.__viewSnaps.board;
    return {library:await store.get('cs_drill_lib_v1'),live:await store.get('cs_board_live_v1')};
  },{uid:UID,blank});
}
async function stateOf(frame){
  return frame.evaluate(()=>{
    const clone=v=>JSON.parse(JSON.stringify(v));
    const cleanFrames=fs=>(fs||[]).map(({thumb,...f})=>f);
    const pages=window.__psPages.forSave();
    return {snap:captureSnap(),frames:cleanFrames(anim.frames),active:animActive,pages:(pages||[]).map(({thumb,anim:a,...p})=>({...p,anim:a?{...a,frames:cleanFrames(a.frames)}:null})),page:window.__psPages.pageInfo(),undo:clone(undoStack).map(e=>({...e,anim:e.anim?{...e.anim,frames:cleanFrames(e.anim.frames)}:null})),redo:clone(redoStack).map(e=>({...e,anim:e.anim?{...e.anim,frames:cleanFrames(e.anim.frames)}:null}))};
  });
}
async function library(page,frame){await page.locator('#library').click();await frame.locator('.vcard').filter({hasText:'가상 보관함 A'}).waitFor({state:'visible'});}
async function view(frame,name='A',edit=false){
  await frame.locator('.vcard').filter({hasText:'가상 보관함 '+name}).locator(edit?'.vc-act.edit':'.vc-act.view').click();
  await frame.locator('#vCreateBar.on').waitFor({state:'visible'});
}
async function assertLive(frame,before,label){
  const after=await stateOf(frame);
  assert.deepEqual(after,before,label);
}
let browser;const results=[];
try{
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.PS_CHROME_PATH?{executablePath:process.env.PS_CHROME_PATH}:{})});
  for(const spec of [{name:'desktop',width:1280,height:900},{name:'tablet',width:1024,height:820,touch:true},{name:'phone',width:393,height:852,touch:true,mobile:true}]){
    const result={viewport:spec.name,cases:[],errors:[]};results.push(result);
    const {context,page,frame}=await newFixture(browser,spec);
    page.on('pageerror',e=>result.errors.push(String(e)));
    try{
      const seeded=await seed(frame),before=await stateOf(frame);
      await library(page,frame);await page.waitForTimeout(150);
      const liveAtEntry=await frame.evaluate(()=>store.get('cs_board_live_v1'));
      await view(frame);await page.waitForTimeout(550);
      assert.equal(await frame.evaluate(()=>captureSnap().players[0]?.id),'LIBRARY-A','viewer opens saved board');
      await frame.evaluate(()=>{boardSaveLive();window.__boardFlushLive();dispatchEvent(new PageTransitionEvent('pagehide'));});
      await page.waitForTimeout(500);
      assert.deepEqual(await frame.evaluate(()=>store.get('cs_board_live_v1')),liveAtEntry,'view and pagehide do not overwrite live persisted data');
      assert.deepEqual(await frame.evaluate(()=>store.get('cs_drill_lib_v1')),seeded.library,'read-only viewing does not rewrite library');
      await page.screenshot({path:path.join(out,spec.name+'-viewer.png')});
      await page.locator('#live').click();await page.waitForTimeout(550);
      await assertLive(frame,before,'main board restores snapshot, animation, pages and history');
      await page.screenshot({path:path.join(out,spec.name+'-restored.png')});
      result.cases.push('view-and-hidden-tab-never-overwrite-live-storage','main-board-restores-all-working-context');

      await library(page,frame);
      await frame.locator('.vcard').filter({hasText:'가상 보관함 A'}).locator('.vc-act.view').evaluate(el=>{el.click();window.boardShowDefault();});
      await page.waitForTimeout(650);await assertLive(frame,before,'fast return cannot be overwritten by delayed library callbacks');
      result.cases.push('fast-return-ignores-stale-load-callbacks');

      await library(page,frame);await view(frame);await frame.locator('#vCreateFull').click();
      assert.equal(await frame.locator('body.vault-full').count(),1,'library fullscreen is available');
      await page.locator('#live').click();await page.waitForTimeout(500);
      await assertLive(frame,before,'return from library fullscreen restores working board');
      assert.equal(await frame.locator('body.vault-full').count(),0,'fullscreen does not remain on live board');
      result.cases.push('fullscreen-view-returns-to-original-board');

      await library(page,frame);await view(frame);
      await page.evaluate(()=>document.querySelector('iframe').contentWindow.postMessage({source:'app',type:'closeTransientUI',nextApp:'team'},location.origin));
      await page.waitForTimeout(500);await page.locator('#live').click();
      await assertLive(frame,before,'leaving for another app restores working context before hiding iframe');
      result.cases.push('leaving-for-another-app-cleans-up-viewer');

      await library(page,frame);await view(frame);
      await frame.locator('#vCreateEdit').evaluate(el=>{el.click();setTimeout(()=>window.boardShowDefault(),20);});
      await page.waitForTimeout(650);await assertLive(frame,before,'leaving during view-to-edit transition cancels delayed reopen');
      assert.equal(await frame.locator('#vCreateBar.on').count(),0,'cancelled edit transition leaves no library editor');
      result.cases.push('view-to-edit-transition-cannot-reopen-after-board-return');

      await library(page,frame);await view(frame);
      await frame.locator('#vCreateCancel').click();
      await frame.locator('.vcard').filter({hasText:'가상 보관함 B'}).waitFor({state:'visible'});
      await view(frame,'B');await page.waitForTimeout(550);
      assert.equal(await frame.evaluate(()=>captureSnap().players[0]?.id),'LIBRARY-B');
      await page.locator('#live').click();await page.waitForTimeout(500);await assertLive(frame,before,'A-close-B-return preserves original board');
      result.cases.push('close-to-library-and-open-another-item-keeps-live-board');

      await library(page,frame);await view(frame,'A',true);await page.waitForTimeout(500);
      const libraryBeforeEdit=await frame.evaluate(()=>store.get('cs_drill_lib_v1'));
      await frame.evaluate(()=>{state.players[0].name='가상 편집 저장 검증';renderTokens();boardSaveLive();});
      await page.waitForTimeout(2300);
      await frame.evaluate(()=>{window.__vaultAutoSaveFlush();dispatchEvent(new PageTransitionEvent('pagehide'));});
      assert.deepEqual(await frame.evaluate(()=>store.get('cs_drill_lib_v1')),libraryBeforeEdit,'library edits and lifecycle events wait for Save');
      await frame.evaluate(()=>{window.fixtureOriginalLibSet=libSet;libSet=()=>Promise.reject(new Error('synthetic save failure'));});
      await frame.locator('#vCreateSave').click();
      await frame.waitForFunction(()=>!document.getElementById('vCreateSave').disabled);
      assert.equal(await frame.locator('#vCreateBar.on').count(),1,'save failure keeps editor open');
      assert.equal(await frame.evaluate(()=>state.players[0].name),'가상 편집 저장 검증');
      await frame.evaluate(()=>{libSet=window.fixtureOriginalLibSet;});
      await frame.locator('#vCreateSave').click();
      await frame.waitForFunction(async()=>((await store.get('cs_drill_lib_v1'))||[]).find(d=>d.libId==='fixture-a')?.snap?.players?.[0]?.name==='가상 편집 저장 검증');
      await page.locator('#live').click();await page.waitForTimeout(500);await assertLive(frame,before,'saving edited library item leaves working board intact');
      result.cases.push('library-edit-saves-only-library-item');

      await library(page,frame);await view(frame,'B');await page.waitForTimeout(500);
      await frame.evaluate(()=>window.__boardFlushLive());
      await page.reload();
      const reloaded=page.frame({url:/\/studio\/board.html\?fixture=vault-isolation$/});
      await reloaded.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window.__psPages);
      await page.waitForTimeout(1100);
      const restored=await stateOf(reloaded);
      for(const key of ['snap','frames','active','pages','page'])assert.deepEqual(restored[key],before[key],'reload while viewing retains live '+key);
      result.cases.push('reload-during-view-restores-original-live-board');
      assert.deepEqual(result.errors,[]);result.ok=true;
    }catch(e){result.ok=false;result.error=e.stack;result.state=await frame.evaluate(()=>({view:window.__csView,text:document.body.innerText.slice(0,3000),readonly:window.__vaultReadOnly})).catch(()=>null);await page.screenshot({path:path.join(out,spec.name+'-failure.png')}).catch(()=>{});}
    finally{await context.close();}
  }
  const {context,page,frame}=await newFixture(browser,{width:1280,height:900});
  const result={viewport:'empty-working-board',cases:[]};results.push(result);
  try{
    await seed(frame,{blank:true});const before=await stateOf(frame);
    await library(page,frame);await view(frame);await page.waitForTimeout(550);
    await page.locator('#live').click();await page.waitForTimeout(550);
    await assertLive(frame,before,'missing live view snapshot restores truly empty working board');
    result.cases.push('empty-board-without-cached-snapshot-stays-empty');result.ok=true;
  }catch(e){result.ok=false;result.error=e.stack;}finally{await context.close();}
}finally{
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  const report={ok:results.length===4&&results.every(r=>r.ok),engine,method:'Real board.html iframe with synthetic local data and parent shell navigation; all external requests blocked.',results};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({...report,results:results.map(({state,error,...r})=>({...r,error:error?.slice(0,2200)}))},null,2));if(!report.ok)process.exitCode=1;
}
