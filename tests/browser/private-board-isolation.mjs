import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/private-board-isolation',engine);
const base='https://private-board-fixture.invalid';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const PA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',PB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const T1='33333333-3333-4333-8333-333333333333',T2='44444444-4444-4444-8444-444444444444';
const PREFIX='ps_private_board_draft_v1:';
const legacyKeys=['cs_board_live_v1','cs_board_recovery_v1','cs_snap_board_v1','cs_snap_match_v1','cs_snap_match_v2','cs_board_stash_v1'];
const legacy=JSON.stringify({snap:{players:[{id:'OTHER-COACH-SECRET',name:'다른 코치 원본',team:'blue',x:500,y:350}],equipment:[],drawings:[],ball:null,pitchTheme:'white',pitchCustom:'#ff00ff',pitchN:1},view:'board',animFrames:[],meetSlides:[],_savedAt:9999999999999});
const shell='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;font:14px system-ui}header{height:42px;box-sizing:border-box;padding:10px 14px;background:#eef2ff;color:#172445}iframe{border:0;width:100%;height:calc(100% - 42px)}</style><header>개인 보드 · 가상 계정 격리 검증</header><iframe src="/studio/board.html?fixture=private-isolation"></iframe></html>';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
fs.mkdirSync(out,{recursive:true});

async function fixture(browser,spec){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,isMobile:!!spec.touch,serviceWorkers:'block'});
  const blocked=[];
  await context.route('**/*',route=>{
    const u=new URL(route.request().url());
    if(u.origin!==base){blocked.push(u.origin);return route.abort();}
    if(u.pathname==='/fixture.html')return route.fulfill({contentType:mime['.html'],body:shell});
    const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:mime[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
  });
  await context.addInitScript(({A,B,PA,PB,T1,T2,legacyKeys,legacy})=>{
    if(window!==top)return;
    const clone=v=>JSON.parse(JSON.stringify(v)),serverKey='fixture_private_server';
    if(!localStorage.getItem('fixture_private_seeded')){
      localStorage.setItem('fixture_private_seeded','1');
      legacyKeys.forEach(k=>localStorage.setItem(k,legacy));
      localStorage.setItem('cs_lang','ko');localStorage.setItem('cs_theme','light');
    }
    const f=window.fixture={uid:A,active:T1,epoch:1,locked:false,requests:[],deferred:[],holdGet:null,holdSave:null,server:JSON.parse(localStorage.getItem(serverKey)||'{}')};
    const current=()=>f.locked?null:{uid:f.uid,wid:f.uid===A?PA:PB,active:f.active,seal:f.uid+':'+f.active+':'+f.epoch,epoch:f.epoch,switchSeal:'',switchEpoch:String(f.epoch)};
    function setStorage(){
      localStorage.setItem('ps_sync_session',JSON.stringify({uid:f.uid,at:'synthetic-token',rt:'synthetic-refresh'}));
      localStorage.setItem('ps_active_ws',f.active);
      localStorage.setItem('ps_cache_owner_v1',JSON.stringify({v:1,uid:f.uid,wid:f.active,nonce:'fixture-'+f.epoch}));
      localStorage.setItem('ps_ws_list',JSON.stringify([{id:T1,kind:'team',role:'owner',name:'가상 팀 1'},{id:T2,kind:'team',role:'owner',name:'가상 팀 2'},{id:f.uid===A?PA:PB,kind:'personal',role:'owner',owner_id:f.uid}]));
      localStorage.setItem('cs_perms_v1',JSON.stringify({v:1,defaultRole:'player',members:{[A]:{role:'executive'},[B]:{role:'executive'}}}));
    }
    setStorage();
    function response(o){return {ok:true,uid:o.uid,wid:o.wid,...(f.server[o.uid]||{raw:null,cupd:null})};}
    function delayed(type,o,value){return new Promise(resolve=>f.deferred.push({type,uid:o.uid,resolve:()=>resolve(clone(value))}));}
    f.switch=(uid,active=T1,locked=false)=>{
      f.uid=uid;f.active=active;f.locked=locked;f.epoch++;setStorage();
      document.querySelector('iframe')?.contentWindow.postMessage({source:'process-studio',type:'ps-auth-state'},location.origin);
    };
    f.resolve=type=>{const i=f.deferred.findIndex(d=>d.type===type);if(i<0)throw Error('No deferred '+type);f.deferred.splice(i,1)[0].resolve();};
    window.PSSync={
      session:()=>({uid:f.uid,at:'synthetic-token'}),activeWs:()=>f.active,activeWsObj:()=>({id:f.active,kind:'team',role:'owner'}),
      dataUnlocked:()=>!f.locked,keyReady:()=>true,displayName:()=>f.uid===A?'가상 코치 A':'가상 코치 B',act(){},ping(){},event(){},
      boardLive:{version:2,scope:'personal',owner:current,
        async get(){const o=current();if(!o)throw Error('fixture locked');const r=clone(response(o));f.requests.push({type:'get',owner:clone(o)});if(f.holdGet===o.uid){f.holdGet=null;return delayed('get',o,r);}return r;},
        async save(raw,options){
          const o=current();if(!o)throw Error('fixture locked');f.requests.push({type:'save',owner:clone(o),raw,options:clone(options)});
          if(options.uid!==o.uid||options.wid!==o.wid)throw Error('fixture mismatched owner');
          const old=response(o);
          if(old.raw!==raw){
            if(options.expected_raw!==old.raw||options.expected_cupd!==old.cupd)throw Error('fixture CAS conflict');
            f.server[o.uid]={raw,cupd:Math.max(Date.now(),(old.cupd||0)+1)};localStorage.setItem(serverKey,JSON.stringify(f.server));
          }
          const r=response(o);if(f.holdSave===o.uid){f.holdSave=null;return delayed('save',o,r);}return clone(r);
        }
      }
    };
  },{A,B,PA,PB,T1,T2,legacyKeys,legacy});
  const page=await context.newPage(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(base+'/fixture.html');
  const frame=page.frame({url:/board.html\?fixture=private-isolation/});
  await frame.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&window.__psPages);
  await page.waitForTimeout(700);
  return {context,page,frame,errors,blocked};
}
async function ids(frame){return frame.evaluate(()=>captureSnap().players.map(p=>p.name||String(p.id)));}
async function boardRecord(page,uid){return page.evaluate(({PREFIX,uid})=>JSON.parse(localStorage.getItem(PREFIX+uid)||'null'),{PREFIX,uid});}
async function settled(frame,uid){await frame.waitForFunction(uid=>_boardPrivateLoaded&&_boardPrivateOwner?.uid===uid&&!_boardPrivateFlight,uid);}
async function switchTo(page,frame,uid,active=T1){await page.evaluate(({uid,active})=>fixture.switch(uid,active),{uid,active});await settled(frame,uid);}
async function edit(frame,label){
  await frame.evaluate(label=>{
    const sn=captureSnap();sn.players=[{id:'synthetic-'+label,name:label,team:'blue',num:8,x:450,y:330}];sn.equipment=[];sn.drawings=[];sn.ball=null;
    loadSnap(sn);boardSaveLive();
  },label);
}
async function flush(frame){assert.equal(await frame.evaluate(()=>window.__boardFlushLive()),true);}
async function fullPrivateState(frame){return frame.evaluate(()=>({snap:captureSnap(),frames:anim.frames,slides:anim.slides,pages:window.__psPages.liveVal(),undo:undoStack,redo:redoStack,views:window.__viewSnaps}));}

const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const results=[];
try{
  for(const spec of [{name:'desktop',width:1280,height:900},{name:'phone',width:393,height:852,touch:true}]){
    const r={viewport:spec.name,cases:[]};results.push(r);
    const {context,page,frame,errors,blocked}=await fixture(browser,spec);
    try{
      assert.deepEqual(await ids(frame),[],'unowned/team live, recovery, snapshots never become a personal board');
      assert.equal(await frame.locator('.token[data-id="OTHER-COACH-SECRET"]').count(),0);
      const leftovers=await frame.evaluate(async keys=>{const out={};for(const k of keys){const r=await window.storage.get(k);out[k]=r?.value??localStorage.getItem(k);}return out;},legacyKeys);
      for(const k of legacyKeys)assert.equal(leftovers[k],legacy,'legacy original retained: '+k);
      assert.notEqual(await frame.evaluate(()=>document.documentElement.style.getPropertyValue('--pitchbg')),'#ff00ff','legacy first paint must not adopt another coach color');
      r.cases.push('legacy-live-recovery-snapshots-stay-unowned-and-unchanged');
      await page.screenshot({path:path.join(out,spec.name+'-blank-personal.png')});

      await edit(frame,'A-PRIVATE');
      const staged=await boardRecord(page,A);assert.equal(staged.uid,A);assert.equal(staged.wid,PA);assert.equal(staged.pending,true);assert.equal(JSON.parse(staged.raw).snap.players[0].name,'A-PRIVATE');
      // Exercise a real selected-token edit, including mobile input events.
      await frame.locator('.token[data-id="synthetic-A-PRIVATE"]').click();
      await frame.locator('#nameInput').fill('A-EDIT');await frame.locator('#nameInput').press('Tab');
      assert.deepEqual(await ids(frame),['A-EDIT']);await flush(frame);
      const ackA=await boardRecord(page,A);assert.equal(ackA.pending,false);assert.equal(JSON.parse(ackA.base.raw).snap.players[0].name,'A-EDIT');
      await page.screenshot({path:path.join(out,spec.name+'-coach-a.png')});
      r.cases.push('actual-token-edit-persists-owner-tagged-draft-and-exact-cloud-ack');

      await switchTo(page,frame,B);
      assert.deepEqual(await ids(frame),[],'same team coach B starts blank');
      const blankB=await fullPrivateState(frame);assert.deepEqual(blankB.frames,[]);assert.deepEqual(blankB.slides,[]);assert.deepEqual(blankB.undo,[]);assert.deepEqual(blankB.redo,[]);
      assert.ok(!JSON.stringify(blankB).includes('A-EDIT'),'snapshots and page caches contain no coach A content');
      await edit(frame,'B-PRIVATE');await flush(frame);
      const savedB=await boardRecord(page,B);
      assert.notEqual(savedB.wid,ackA.wid);assert.equal((await boardRecord(page,A)).raw,ackA.raw);
      await page.screenshot({path:path.join(out,spec.name+'-coach-b.png')});
      await switchTo(page,frame,A);assert.deepEqual(await ids(frame),['A-EDIT']);
      r.cases.push('same-team-coaches-have-separate-live-board-and-undo-history');

      await edit(frame,'A-TEAM2');
      await page.evaluate(({A,T2})=>fixture.switch(A,T2,true),{A,T2});
      await page.waitForTimeout(100);assert.deepEqual(await ids(frame),['A-TEAM2'],'temporary team switch lock preserves same-account canvas');
      await switchTo(page,frame,A,T2);await frame.waitForFunction(()=>_boardPrivateRecord&&!_boardPrivateRecord.pending);
      assert.deepEqual(await ids(frame),['A-TEAM2']);assert.equal((await boardRecord(page,A)).wid,PA);assert.equal((await boardRecord(page,B)).raw,savedB.raw);
      const teamSave=await page.evaluate(()=>fixture.requests.filter(r=>r.type==='save').at(-1));assert.equal(teamSave.owner.active,T2);assert.equal(teamSave.options.wid,PA);
      r.cases.push('same-account-team-switch-keeps-unsent-work-in-original-personal-workspace');

      await switchTo(page,frame,B);
      await page.evaluate(({A,T1})=>{fixture.holdGet=A;fixture.switch(A,T1);},{A,T1});
      await page.waitForFunction(()=>fixture.deferred.some(d=>d.type==='get'));
      assert.deepEqual(await ids(frame),[],'account transition blanks previous coach before delayed get');
      await switchTo(page,frame,B);assert.deepEqual(await ids(frame),['B-PRIVATE']);
      const beforeLateGet=await fullPrivateState(frame),beforeB=await boardRecord(page,B);
      await page.evaluate(()=>fixture.resolve('get'));await page.waitForTimeout(250);
      assert.deepEqual(await fullPrivateState(frame),beforeLateGet);assert.deepEqual(await boardRecord(page,B),beforeB);
      r.cases.push('delayed-coach-a-get-cannot-replace-coach-b-canvas-or-draft');

      await switchTo(page,frame,A);await edit(frame,'A-LATE-ACK');
      await page.evaluate(A=>{fixture.holdSave=A;},A);
      await frame.evaluate(()=>{window.fixtureFlush=window.__boardFlushLive();});
      await page.waitForFunction(()=>fixture.deferred.some(d=>d.type==='save'));
      const frozenA=await boardRecord(page,A);assert.ok(frozenA.attempt);
      await switchTo(page,frame,B);await edit(frame,'B-NEW');await flush(frame);
      const newB=await boardRecord(page,B),newBState=await fullPrivateState(frame);
      await page.evaluate(()=>fixture.resolve('save'));await page.waitForTimeout(250);
      assert.deepEqual(await fullPrivateState(frame),newBState);assert.deepEqual(await boardRecord(page,B),newB);assert.deepEqual(await boardRecord(page,A),frozenA,'stale A acknowledgement must not clear its retained attempt');
      await switchTo(page,frame,A);await frame.waitForFunction(()=>_boardPrivateRecord&&!_boardPrivateRecord.pending);
      assert.deepEqual(await ids(frame),['A-LATE-ACK']);assert.equal((await boardRecord(page,A)).attempt,null,'same-account retry confirms the exact already-saved body');
      r.cases.push('delayed-coach-a-ack-does-not-touch-b-and-exact-retry-recovers-a');

      await page.reload();
      const reloaded=page.frame({url:/board.html\?fixture=private-isolation/});
      await reloaded.waitForFunction(()=>window.__boardReady&&window.__boardRestoreDone&&_boardPrivateLoaded);
      await page.waitForTimeout(250);assert.deepEqual(await ids(reloaded),['A-LATE-ACK']);
      await switchTo(page,reloaded,B);assert.deepEqual(await ids(reloaded),['B-NEW']);
      r.cases.push('reload-restores-only-explicit-current-account-data');
      const recovery=await reloaded.evaluate(async()=>{
        const o=boardPrivateOwner(),key=boardPrivateKey(o),before=localStorage.getItem(key);
        const oldKey=key+':kept:legacy-fixture';localStorage.setItem(oldKey,before);
        const other=JSON.stringify({...JSON.parse(before),token:'synthetic-other-tab',seq:Date.now()+1000});localStorage.setItem(key,other);
        for(let i=0;i<30;i++){state.players[0].name='RECOVERY-'+i;await _boardLiveWriteNow(false);}
        const branch=_boardPrivateKept.key;await PSStorage.optimize();
        const preserved=await storage.get(branch),legacy=await storage.get(oldKey);
        return {mainSame:localStorage.getItem(key)===other,branchKeys:(await storage.keys()).filter(k=>k.startsWith(key+':kept:')),localBranch:localStorage.getItem(branch),localLegacy:localStorage.getItem(oldKey),legacySame:legacy?.value===before,lastName:JSON.parse(JSON.parse(preserved.value).raw).snap.players[0].name,durable:_boardPrivateDurableToken===_boardPrivateRecord.token};
      });
      assert.equal(recovery.mainSame,true);assert.equal(recovery.branchKeys.length,2);assert.equal(recovery.localBranch,null);assert.equal(recovery.localLegacy,null);assert.equal(recovery.legacySame,true);assert.equal(recovery.lastName,'RECOVERY-29');assert.equal(recovery.durable,true);
      r.cases.push('real-indexeddb-bounds-conflict-draft-and-migrates-legacy-copy-with-exact-body');
      const quota=await reloaded.evaluate(async()=>{
        let full=false,n=0;const native=Storage.prototype.setItem;
        try{for(;n<80;n++)native.call(localStorage,'fixture-quota-'+n,'x'.repeat(128*1024));}catch(e){full=e.name==='QuotaExceededError';}
        let tail='';try{for(let i=0;i<1024;i++){tail+='x'.repeat(256);native.call(localStorage,'fixture-quota-tail',tail);}}catch(_){}
        let probeFailed=false;try{native.call(localStorage,'fixture-quota-probe','x'.repeat(2048));}catch(e){probeFailed=e.name==='QuotaExceededError';}
        if(!probeFailed)throw Error('Quota fixture did not exhaust the small store');
        state.players[0].name='QUOTA-RECOVERED';await _boardLiveWriteNow(false);
        const row=await storage.get(_boardPrivateKept.key),result={full,lastName:JSON.parse(JSON.parse(row.value).raw).snap.players[0].name,durable:_boardPrivateDurableToken===_boardPrivateRecord.token,falseBanner:!!document.getElementById('psStorageFull')};
        for(let i=0;i<n;i++)localStorage.removeItem('fixture-quota-'+i);return result;
      });
      assert.equal(quota.full,true);assert.equal(quota.lastName,'QUOTA-RECOVERED');assert.equal(quota.durable,true);assert.equal(quota.falseBanner,false);
      r.cases.push('real-localstorage-quota-falls-back-to-indexeddb-without-false-loss-banner');


      assert.deepEqual(errors.filter(e=>!e.includes('ResizeObserver loop')),[]);
      Object.assign(r,{ok:true,errors,externalOriginsBlocked:[...new Set(blocked)]});
    }catch(e){r.ok=false;r.error=e.stack;r.errors=errors;r.state=await frame.evaluate(()=>({ids:captureSnap().players.map(p=>p.name||p.id),owner:_boardPrivateOwner,loaded:_boardPrivateLoaded,dirty:_bliveDirty,text:document.body.innerText.slice(0,1600)})).catch(()=>null);await page.screenshot({path:path.join(out,spec.name+'-failure.png')}).catch(()=>{});}
    finally{await context.close();}
  }
}finally{await browser.close();}
const report={ok:results.length===2&&results.every(r=>r.ok),engine,method:'Actual board.html and storage.js in an isolated parent shell; synthetic account-specific API with controlled deferred replies; all external requests aborted.',results};
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
