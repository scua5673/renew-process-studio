import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {startFixture,openApp,WT,A} from '../fixtures/team-app.mjs';
const require=createRequire(import.meta.url),S=require('../../studio/scouting-store.js');
const engine=process.env.PS_BROWSER_ENGINE||'chromium',fx=await startFixture(),browsers={};
const candidate=S.reconcile(null,{v:1,players:[{id:'candidate-1',type:'target',name:'프로세스FC 후보',posId:'',memo:'원래 관찰'}]});
const raw=JSON.stringify(candidate),key='cs_scout_targets_v1';
fx.db.set(WT+'|'+key,{workspace_id:WT,k:key,v:raw,cupd:1000,updated_by:A});
const init={fn:()=>{
  if(window.top!==window)return;
  let api;
  Object.defineProperty(window,'PSSync',{configurable:true,get:()=>api,set:v=>{
    api=v;const keyReady=v.keyReady;
    v.keyReady=function(k,...args){return k==='cs_scout_targets_v1'&&!window.qaTargetsReady?false:keyReady.call(this,k,...args);};
  }});
}};
try{
  const {page,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,init});
  await page.locator('[data-team-hub="1"]').click();
  await page.locator('[data-team-key="players"][data-tn-grp="squad"]').click();
  const f=await (await page.waitForSelector('#fScout')).contentFrame();
  await f.waitForFunction(()=>typeof scoutBootPending!=='undefined'&&!scoutBootPending&&typeof save==='function');
  const before=await f.evaluate(()=>({read:!!scStore().state.doc,targets:data.players.filter(isTargetPl).length,failed:teamSaves.hasFailed(TKEY)}));
  assert.deepEqual(before,{read:false,targets:0,failed:false});
  assert.equal(await f.evaluate(()=>{data.meta.qaCandidateDelay='roster-edit';return save();}),true,'roster save must not attempt an unread candidate document');
  await f.evaluate(()=>psFlushPendingReady());
  assert.equal(await f.evaluate(()=>teamSaves.hasFailed(TKEY)),false);
  assert.equal(fx.db.get(WT+'|'+key).v,raw,'unread server candidates are preserved');
  await page.evaluate(()=>{window.qaTargetsReady=true;});
  await f.evaluate(()=>scPrepare());
  await f.evaluate(()=>psFlushPendingReady());
  assert.equal(await f.evaluate(()=>scStore().state.verified),true);
  assert.equal(await f.evaluate(()=>data.players.find(p=>p.id==='candidate-1').memo),'원래 관찰');
  assert.equal(await f.evaluate(()=>data.meta.qaCandidateDelay),'roster-edit','candidate adoption preserves the roster edit');
  await page.evaluate(()=>PSSync.syncNow('fixture-roster-save'));
  assert.equal(JSON.parse(fx.db.get(WT+'|scout_tool_v1').v).meta.qaCandidateDelay,'roster-edit');
  assert.equal(fx.db.get(WT+'|'+key).v,raw,'loading candidates does not rewrite them');
  assert.equal(await f.evaluate(()=>{data.players.find(p=>p.id==='candidate-1').memo='새 관찰';return save();}),true,'normal candidate edits still save');
  await f.evaluate(()=>psFlushPendingReady());
  await page.evaluate(()=>PSSync.syncNow('fixture-candidate-save'));
  assert.equal(JSON.parse(fx.db.get(WT+'|'+key).v).players.find(p=>p.id==='candidate-1').memo,'새 관찰');
  assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
  console.log(JSON.stringify({engine,unreadCandidatesPreserved:true,rosterEditSaved:true,updateFlushReady:true,candidateEditSaved:true}));
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
