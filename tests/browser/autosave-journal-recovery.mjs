import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Real browser IndexedDB, journal, runtime and merge code. Only the server/core
// transport is synthetic; this fixture never opens the deployed application.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.PS_TEST_REPO||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',base='https://autosave-journal-fixture.invalid';
const out=process.env.PS_TEST_OUTPUT||path.join(root,'test-results/autosave-journal-recovery',engine);
const html='<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated autosave journal regression</title><script src="/studio/storage.js"></script><script src="/studio/autosave-journal.js"></script><script src="/studio/autosave-merge.js"></script><script src="/studio/autosave-runtime.js"></script><body>가상 데이터로 자동 저장 기준본 복구 검증</body></html>';
fs.mkdirSync(out,{recursive:true});
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
const results=[];
try{
  for(const spec of [{name:'desktop',width:1280,height:900},{name:'phone',width:393,height:852,touch:true}]){
    if(process.env.PS_TEST_WIDTH&&Number(process.env.PS_TEST_WIDTH)!==spec.width)continue;
    const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:!!spec.touch,isMobile:!!spec.touch,serviceWorkers:'block'});
    const errors=[],blocked=[];
    await context.route('**/*',route=>{
      const u=new URL(route.request().url());
      if(u.origin!==base){blocked.push(u.origin);return route.abort();}
      if(u.pathname==='/fixture.html')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
      const file=path.resolve(root,'.'+decodeURIComponent(u.pathname));
      if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({contentType:'text/javascript; charset=utf-8',body:fs.readFileSync(file)});
    });
    const page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(String(e)));
    const result={viewport:spec.name,cases:[]};results.push(result);
    try{
      await page.goto(base+'/fixture.html');
      const merged=await page.evaluate(async()=>{
        const J=PSAutoSaveJournal,R=PSAutosaveRuntime,M=PSAutosaveMerge,S=window.storage;
        const check=(ok,message)=>{if(!ok)throw Error(message);};
        const ctx={uid:'synthetic-coach-a',wid:'synthetic-team',seal:'fixture-a',epoch:1};
        const KEY='fixture_notes_v1',A=' {"title":"original","note":"base"}\n',B=JSON.stringify({title:'intermediate',note:'base'}),C=JSON.stringify({title:'server latest',note:'base'});
        const localEdit=JSON.stringify({title:'original',note:'local edit while core runs'}),expected={title:'server latest',note:'local edit while core runs'};
        let meta={h:J.hash(A),c:1},review=null,coreCalls=0,remote={k:KEY,v:C,cupd:3};
        const journal=J.create({storage:S,context:()=>ctx});
        for(const [raw,c] of [[A,1],[B,2],[C,3]])await journal.remember(ctx,KEY,raw,J.hash(raw),c);
        const baseKey=J.PREFIX+encodeURIComponent(ctx.uid)+':'+encodeURIComponent(ctx.wid)+':base:'+encodeURIComponent(KEY);
        const before=(await S.get(baseKey)).value;
        let strictError='';try{await journal.remember(ctx,KEY,A,J.hash(A),1);}catch(e){strictError=e.name;}
        check(strictError==='AutosaveJournalVersionError','negative control: old remember must remain fenced');
        check((await S.get(baseKey)).value===before,'negative control must not rewrite current/previous');
        await S.set(KEY,A);
        const runtime=R.create({context:()=>ctx,hash:J.hash,journal:()=>journal,
          read:async k=>(await S.get(k))?.value??null,version:()=>({...meta}),confirmed:()=>[{wid:ctx.wid,k:KEY,...meta}],
          pending:()=>review?[review]:[],reviewCurrent:r=>r===review,remote:async()=>[{...remote}],plan:M.plan,
          async core(){
            coreCalls++;
            if(coreCalls===1){
              check((await S.get(baseKey)).value===before,'capture must preserve exact newest base bytes');
              check(await journal.base(ctx,KEY)===C,'head remains server C3');
              check(await journal.base(ctx,KEY,J.hash(A),1)===A,'exact A1 ancestor retained before core');
              await S.set(KEY,localEdit);review={wid:ctx.wid,k:KEY,h:J.hash(localEdit)};return {pending:1};
            }
            check(coreCalls===2,'only one reconcile/push is needed');
            const raw=(await S.get(KEY)).value;check(JSON.stringify(JSON.parse(raw))===JSON.stringify(expected),'both independent fields reach core CAS');
            remote={k:KEY,v:raw,cupd:4};meta={h:J.hash(raw),c:4};return {saved:1};
          },
          async apply(r,old,raw,row,current,version){
            check(review===r&&meta.h===version.h&&meta.c===version.c,'review and version unchanged');
            const changed=await S.replaceIfValue(KEY,old,raw,current);check(changed,'actual IndexedDB conditional document write');
            meta={h:J.hash(row.v),c:row.cupd};review=null;return true;
          },fail:e=>({error:e.name,message:e.message})
        });
        const run=await runtime.run('synthetic-confirmed-ancestor');
        check(!run.error,'runtime failed: '+JSON.stringify(run));check(coreCalls===2,'capture let core run twice');
        check(run.rebased===1&&run.archived===0,'trusted independent field edit must merge without archive');
        check((await S.get(KEY)).value===remote.v,'server ACK and local document agree');
        check((await journal.list(ctx)).length===0,'ancestor is not a user conflict archive');
        check(await journal.base(ctx,KEY,J.hash(A))===null,'hash-only lookup cannot choose older captured slot');
        check(await journal.base(ctx,KEY,J.hash(A),2)===null,'incorrect version cannot choose captured slot');
        check(await journal.base(ctx,KEY,J.hash(A),1)===A,'original formatting retained after newer ACK');
        window.fixtureExpected={ctx,KEY,A,remote};sessionStorage.setItem('fixture_expected',JSON.stringify(window.fixtureExpected));
        return {coreCalls,run,local:JSON.parse((await S.get(KEY)).value),strictError};
      });
      assert.equal(merged.coreCalls,2);assert.equal(merged.run.rebased,1);
      result.cases.push('three-version-old-confirmed-local-no-longer-blocks-core','exact-ancestor-preserved-without-rewinding-current-base','concurrent-independent-fields-merge-through-real-idb-cas');

      await page.reload();
      const reopened=await page.evaluate(async()=>{
        const {ctx,KEY,A,remote}=JSON.parse(sessionStorage.getItem('fixture_expected')),J=PSAutoSaveJournal;
        ctx.seal='reconnected';ctx.epoch++;
        const journal=J.create({storage:window.storage,context:()=>ctx});
        const original=await journal.base(ctx,KEY,J.hash(A),1),head=await journal.base(ctx,KEY);
        const foreign={...ctx,uid:'synthetic-coach-b'};
        const other=J.create({storage:window.storage,context:()=>foreign});
        return {original,expected:A,head,expectedHead:remote.v,other:await other.base(foreign,KEY,J.hash(A),1)};
      });
      assert.equal(reopened.original,reopened.expected);assert.equal(reopened.head,reopened.expectedHead);assert.equal(reopened.other,null);
      result.cases.push('browser-reload-keeps-exact-ancestor-and-denies-other-account');

      const guarded=await page.evaluate(async()=>{
        const J=PSAutoSaveJournal,R=PSAutosaveRuntime,S=window.storage;
        const report=[];
        for(const mode of ['account-change','write-failure','concurrent-collision']){
          let ctx={uid:'synthetic-guard-'+mode,wid:'synthetic-team',seal:'first',epoch:1},capturedCtx={...ctx},calls=0;
          const KEY='fixture_guard_'+mode,A=JSON.stringify({note:'A'}),B=JSON.stringify({note:'B'}),C=JSON.stringify({note:'C'}),hash=mode==='concurrent-collision'?()=>'synthetic-hash-collision':J.hash;
          let hit=false;
          const guardedStorage={get:k=>S.get(k),set:(...args)=>S.set(...args),keys:p=>S.keys(p),async replaceIfValue(k,old,next,current){
            hit=true;
            if(mode==='account-change'){ctx={...ctx,uid:'synthetic-new-coach',seal:'second',epoch:2};return S.replaceIfValue(k,old,next,current);}
            if(mode==='write-failure')throw new DOMException('Synthetic IndexedDB transaction failure','QuotaExceededError');
            // Simulate another tab filling this immutable slot before our CAS.
            const alternate=JSON.parse(next);alternate.entry.raw=JSON.stringify({note:'a different raw body'});
            await S.replaceIfValue(k,null,JSON.stringify(alternate));return S.replaceIfValue(k,old,next,current);
          }};
          const journal=J.create({storage:guardedStorage,context:()=>ctx,hash});
          for(const [raw,c] of [[A,1],[B,2],[C,3]])await journal.remember(ctx,KEY,raw,hash(raw),c);
          const prefix=J.PREFIX+encodeURIComponent(ctx.uid)+':'+encodeURIComponent(ctx.wid)+':',baseKey=prefix+'base:'+encodeURIComponent(KEY),before=(await S.get(baseKey)).value;
          await S.set(KEY,A);
          const runtime=R.create({context:()=>ctx,hash,journal:()=>journal,read:async k=>(await S.get(k))?.value??null,version:()=>({h:hash(A),c:1}),confirmed:()=>[{wid:capturedCtx.wid,k:KEY,h:hash(A),c:1}],pending:()=>[],async core(){calls++;return {saved:1};},fail:e=>({error:e.name,message:e.message})});
          const run=await runtime.run('guarded-capture'),keys=await S.keys(prefix+'captured:');
          report.push({mode,hit,calls,error:run.error,baseUnchanged:(await S.get(baseKey)).value===before,localUnchanged:(await S.get(KEY)).value===A,capturedCount:keys.length});
        }
        return report;
      });
      for(const g of guarded){assert.ok(g.hit);assert.equal(g.calls,0,g.mode);assert.ok(g.error,g.mode);assert.equal(g.baseUnchanged,true,g.mode);assert.equal(g.localUnchanged,true,g.mode);if(g.mode!=='concurrent-collision')assert.equal(g.capturedCount,0,g.mode);}
      result.cases.push('owner-change-before-idb-cas-stops-core-and-retains-source','failed-idb-capture-stops-core-and-retains-source','immutable-slot-race-is-detected-without-overwriting-head');
      assert.deepEqual(errors,[]);Object.assign(result,{ok:true,merged,guarded,errors,blocked});
    }catch(e){Object.assign(result,{ok:false,error:e.stack,errors,blocked});}
    finally{await context.close();}
  }
}finally{await browser.close();}
const report={ok:results.length>0&&results.every(r=>r.ok),engine,method:'Actual IndexedDB storage + autosave journal/runtime/merge, synthetic transport only; no production or external requests.',results};
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!report.ok)process.exitCode=1;
