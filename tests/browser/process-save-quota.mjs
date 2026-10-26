import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {startFixture,openApp,A,WT,WP,OUT,SHOTS,root} from '../fixtures/team-app.mjs';

// Synthetic storage faults only. The actual schedule UI, permission checks,
// write barriers, CAS, sync and local fixture server remain in control.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const KEY='process_coach_v1',HEAD='ps_private_board_draft_v1:'+A,UNSAVED=HEAD+':unsaved',browsers={};
const hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
const result={engine,source:Object.fromEntries(['studio/process.html','studio/storage.js','studio/sync.js','studio/board.html','studio/board-draft.js'].map(f=>[f,hash(fs.readFileSync(path.join(root,f)))])),cases:[],passed:false};
const write=()=>fs.writeFileSync(path.join(OUT,'results.json'),JSON.stringify(result,null,2)+'\n');
const trainings=raw=>Object.values(JSON.parse(raw).weeks||{}).flatMap(days=>days.flatMap(d=>d.trainings||[])).map(t=>JSON.parse(JSON.stringify(t,(k,v)=>k==='_open'?undefined:v))).sort((a,b)=>String(a.slot).localeCompare(String(b.slot)));
const target=(raw,slot)=>trainings(raw).find(t=>t.slot===slot);
async function until(fn,label,ms=35000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out: '+label);}
async function openSchedule(page){
 await page.waitForFunction(()=>!!(window.PSSync&&PSSync.dataUnlocked()&&document.body&&!document.body.classList.contains('ps-booting')));
 const nav=page.locator('#teamNav [data-team-key="training"]:visible, #teamBottom [data-tb="training"]:visible').first();
 if(!await nav.isVisible())await page.locator('#appSeg [data-team-hub]:visible').click();
 await nav.click();
 const frame=await(await page.waitForSelector('#fProcess')).contentFrame();
 await frame.waitForFunction(()=>!!(typeof weeksMap==='object'&&window.PSSchedule&&PSSchedule.raw()));
 if(!await frame.locator('#weekView').isVisible())await frame.locator('#vtoggle [data-v="week"]').click();
 await frame.locator('#weekView').waitFor({state:'visible'});return frame;
}
async function protectedState(page){
 return page.evaluate(async keys=>{
  async function digest(raw){if(raw==null)return null;const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  async function proof(raw){const r=raw==null?null:JSON.parse(raw),body=r?.raw??null,base=r?.base?.raw??null;return{present:raw!=null,length:raw?.length??0,hash:await digest(raw),bodyHash:await digest(body),bodyLength:body?.length??0,baseBodyHash:await digest(base),baseBodyLength:base?.length??0};}
  const out={};for(const key of keys){const local=localStorage.getItem(key),idb=(await storage.peek(key))?.value??null,a=local==null?null:JSON.parse(local),b=idb==null?null:JSON.parse(idb),field=key.endsWith(':unsaved')?'at':'seq';
   const medium=!b||a&&a[field]>=b[field]?'local':'idb';
   out[key]={local:await proof(local),idb:await proof(idb),selected:{medium,...await proof(medium==='local'?local:idb)},placement:[local!=null?'local':null,idb!=null?'idb':null].filter(Boolean).join('+')||'none'};
  }return out;
 },[HEAD,UNSAVED]);
}
function protectedReopened(before,after){
 const original=before[HEAD].selected,head=after[HEAD];
 assert.equal(head.idb.present,true,'the complete active head remains in actual IDB');assert.equal(head.local.present,false,'normal IDB-primary loading must not recreate a full LS head');
 for(const v of [head.idb,head.selected]){assert.equal(v.bodyHash,original.bodyHash,'reopening preserves the entire active board body');assert.equal(v.bodyLength,original.bodyLength);assert.equal(v.baseBodyHash,original.baseBodyHash,'the complete board base is retained');assert.equal(v.baseBodyLength,original.baseBodyLength);}
 const draft=before[UNSAVED].selected,next=after[UNSAVED];assert.equal(next.selected.present,true,'an original unsaved record remains reload-selectable');
 for(const v of [next.local,next.idb,next.selected])if(v.present){assert.equal(v.hash,draft.hash,'only byte-exact legacy unsaved migration is allowed');assert.equal(v.length,draft.length);assert.equal(v.bodyHash,draft.bodyHash);assert.equal(v.bodyLength,draft.bodyLength);}
}
async function snapshot(page,fx,slot,label){
 const disk=await page.evaluate(async key=>(await storage.peek(key))?.value??null,KEY),frames=[];
 for(const f of page.frames())if(/\/studio\/(app|process|scout)\.html/.test(f.url()))frames.push(await f.evaluate(({KEY,slot})=>{
  const visible=id=>{const e=document.getElementById(id);if(!e)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden';};
  let memoryNote=null;try{memoryNote=Object.values(weeksMap).flatMap(ds=>ds.flatMap(d=>d.trainings||[])).find(t=>t.slot===slot)?.note;}catch(_){}
  return{frame:location.pathname,banner:visible('psStorageFull'),pill:visible('psSaveFailed'),schedule:window.PSSaveState?.get('schedule'),storage:window.PSSaveState?.get('storage'),pending:!!window.psHasPending?.(),memoryNote,...window.__quotaCase};
 },{KEY,slot}));
 const server=fx.db.get(WT+'|'+KEY).v,state=await page.evaluate(()=>({kind:PSSync.state().kind,pending:PSSync.pending().count,active:PSSync.activeWs()}));
 return{label,state,idbHash:hash(disk),serverHash:hash(server),idbTarget:disk&&target(disk,slot),serverTarget:target(server,slot),frames,protected:await protectedState(page),scheduleWrites:fx.writes.filter(w=>w.k===KEY&&w.v!=null).length};
}
const init={fn:()=>{
 window.__quotaCase={lsFaults:0,idbFaults:0,idbChecksStarted:0,idbChecksCompleted:0};
 // Observe the real 900ms boot check and its Promise; never replace its guards.
 let checker;Object.defineProperty(window,'__schedIdbCheck',{configurable:true,get:()=>checker,set:fn=>{checker=function(...args){const work=fn.apply(this,args);if(!work||typeof work.then!=='function')return work;window.__quotaCase.idbChecksStarted++;return work.then(v=>{window.__quotaCase.idbChecksCompleted++;return v;},e=>{window.__quotaCase.idbChecksCompleted++;throw e;});};}});
 const mode=()=>localStorage.getItem('qa_process_quota')||'off',set=Storage.prototype.setItem,put=IDBObjectStore.prototype.put;
 Storage.prototype.setItem=function(k,v){if(this===localStorage&&k==='process_coach_v1'&&mode()!=='off'){window.__quotaCase.lsFaults++;throw new DOMException('Synthetic schedule small-store quota','QuotaExceededError');}return set.apply(this,arguments);};
 IDBObjectStore.prototype.put=function(v,k){if(k==='process_coach_v1'&&this.name==='kv'&&this.transaction.db.name==='ps-store'&&mode()==='both'){window.__quotaCase.idbFaults++;throw new DOMException('Synthetic schedule durable-store quota','QuotaExceededError');}return put.apply(this,arguments);};
}};
try{
 for(const kind of ['ls-only','both-stores-fail']){
  const fx=await startFixture(),entry={kind,observations:[],passed:false};result.cases.push(entry);let page,context,logs=[];
  try{
   const initial=JSON.parse(fx.db.get(WT+'|'+KEY).v),slot=trainings(JSON.stringify(initial)).find(t=>t.note==='가상 훈련 화').slot;
   // Stable match IDs remove unrelated first-open maintenance from this test.
   for(const [w,days]of Object.entries(initial.weeks))for(const [i,d]of days.entries())if(d.board?.sched==='경기')d.mid='quota-match-'+w+'-'+i;
   fx.db.get(WT+'|'+KEY).v=JSON.stringify(initial);
   const boardRaw=JSON.stringify({snap:{players:[],equipment:[],drawings:[],ball:null,pitchTheme:'white'},view:'board',animFrames:[],meetSlides:[],syntheticPadding:'x'.repeat(750000)});
   fx.db.set(WP+'|cs_private_board_v1',{workspace_id:WP,k:'cs_private_board_v1',v:boardRaw,cupd:1000,updated_by:A});
   ({page,context,logs}=await openApp(fx,size,{browsers,phoneStart:true,init}));page.setDefaultTimeout(15000);
   let frame=await openSchedule(page);
   await until(async()=>{const s=await page.evaluate(async key=>({raw:(await storage.peek(key))?.value,pending:PSSync.pending().count,kind:PSSync.state().kind}),KEY);return s.pending===0&&s.kind==='ok'&&s.raw===fx.db.get(WT+'|'+KEY).v;},'normal bootstrap and exact IDB/server baseline');
   await page.waitForFunction(async({key,raw})=>{const saved=(await storage.peek(key))?.value;if(!saved)return false;const r=JSON.parse(saved);return r.raw===raw&&r.base?.raw===raw&&r.pending===false;},{key:HEAD,raw:boardRaw});
   await page.evaluate(({A,WP,UNSAVED,raw})=>localStorage.setItem(UNSAVED,JSON.stringify({v:1,uid:A,wid:WP,raw,at:Date.now()+1000})),{A,WP,UNSAVED,raw:boardRaw.replace('"view":"board"','"view":"synthetic-unsaved"')});
   const before=await snapshot(page,fx,slot,'before-edit');entry.observations.push(before);
   assert.equal(before.protected[HEAD].idb.present,true);assert.equal(before.protected[HEAD].local.present,false);assert.ok(before.protected[HEAD].selected.length>1500000,'large active board and its base exist in actual IDB before the fault');assert.ok(before.protected[UNSAVED].selected.length>750000,'large unsaved board exists before the fault');
   const expected=trainings(fx.db.get(WT+'|'+KEY).v),note='SYNTHETIC PROCESS QUOTA '+kind;expected.find(t=>t.slot===slot).note=note;
   await page.evaluate(kind=>localStorage.setItem('qa_process_quota',kind==='ls-only'?'ls':'both'),kind);
   await frame.locator('.wks-fill[onclick*="'+slot+'"]').click();await frame.locator('#wfNote').fill(note);await frame.locator('#wfNote').press('Tab');await frame.locator('#sheet .wf-x').click();
   await frame.waitForFunction(()=>!document.getElementById('scrim').classList.contains('show'));
   if(kind==='ls-only'){
    await frame.evaluate(()=>psFlushPendingReady());
    await until(async()=>{const raw=await page.evaluate(async key=>(await storage.peek(key))?.value,KEY);return target(fx.db.get(WT+'|'+KEY).v,slot)?.note===note&&raw===fx.db.get(WT+'|'+KEY).v&&await page.evaluate(()=>PSSync.pending().count===0&&PSSync.state().kind==='ok');},'actual schedule edit reaches exact IDB and fixture-server ACK');
    const saved=await snapshot(page,fx,slot,'server-ack');entry.observations.push(saved);assert.deepEqual(trainings(fx.db.get(WT+'|'+KEY).v),expected);assert.equal(saved.serverHash,saved.idbHash);assert.ok(saved.scheduleWrites>before.scheduleWrites);assert.deepEqual(saved.protected,before.protected,'quota handling preserves the active head and unsaved draft exactly');
    const process=saved.frames.find(f=>f.frame==='/studio/process.html');assert.ok(process.lsFaults>0);assert.equal(process.idbFaults,0);assert.equal(process.pending,false);assert.equal(process.schedule,'saved');
    for(const f of saved.frames){assert.equal(f.banner,false,'no obsolete full banner: '+f.frame);assert.equal(f.pill,false,'no obsolete failed pill: '+f.frame);assert.notEqual(f.storage,'failed');}
    await page.screenshot({path:path.join(SHOTS,engine+'-quota-saved.png')});
    await page.reload({waitUntil:'domcontentloaded'});frame=await openSchedule(page);
    await frame.waitForFunction(()=>window.__quotaCase.idbChecksCompleted>0&&window.__quotaCase.idbChecksCompleted===window.__quotaCase.idbChecksStarted);
    await frame.waitForFunction(({slot,note})=>Object.values(weeksMap).some(ds=>ds.some(d=>(d.trainings||[]).some(t=>t.slot===slot&&t.note===note))),{slot,note});
    await until(async()=>{const raw=await page.evaluate(async key=>(await storage.peek(key))?.value,KEY);return raw===fx.db.get(WT+'|'+KEY).v&&await page.evaluate(()=>PSSync.pending().count===0);},'reopened IDB retains the acknowledged edit');
    const reopened=await snapshot(page,fx,slot,'reopened');entry.observations.push(reopened);assert.equal(reopened.idbTarget.note,note);assert.equal(reopened.serverTarget.note,note);protectedReopened(before.protected,reopened.protected);
    assert.ok(reopened.frames.find(f=>f.frame==='/studio/process.html').idbChecksCompleted>0,'the actual delayed boot read completed before warning checks');
    for(const f of reopened.frames){assert.equal(f.banner,false,'reopened obsolete full banner: '+f.frame);assert.equal(f.pill,false,'reopened obsolete failed pill: '+f.frame);assert.notEqual(f.storage,'failed');}
    await page.screenshot({path:path.join(SHOTS,engine+'-quota-reopened.png')});
   }else{
    await frame.waitForFunction(()=>PSSaveState.get('schedule')==='failed'&&psHasPending());
    entry.barrier=await frame.evaluate(async()=>{try{await psFlushPendingReady();return{ok:true};}catch(e){return{ok:false,name:e.name};}});assert.equal(entry.barrier.ok,false);
    entry.switch=await page.evaluate(async wid=>await PSSync.switchWorkspace(wid),WP);assert.equal(entry.switch?.cancelled,1);assert.equal(await page.evaluate(()=>PSSync.activeWs()),WT);
    const failed=await snapshot(page,fx,slot,'durable-failure-blocked');entry.observations.push(failed);assert.equal(failed.serverHash,before.serverHash);assert.equal(failed.idbHash,before.idbHash);assert.equal(failed.scheduleWrites,before.scheduleWrites);assert.deepEqual(failed.protected,before.protected);
    const process=failed.frames.find(f=>f.frame==='/studio/process.html');assert.ok(process.lsFaults>0&&process.idbFaults>0);assert.equal(process.memoryNote,note);assert.equal(process.pending,true);assert.equal(process.schedule,'failed');assert.ok(process.banner||process.pill,'actual unsaved edit remains visibly failed');
    await page.screenshot({path:path.join(SHOTS,engine+'-quota-blocked.png')});
   }
   assert.equal(fx.db.get(WP+'|cs_private_board_v1').v,boardRaw,'the personal board server original is unchanged');assert.deepEqual(logs.filter(l=>l.type==='pageerror'),[]);entry.passed=true;console.log(JSON.stringify({engine,kind,passed:true}));
  }catch(error){entry.error={name:error.name,message:error.message,stack:error.stack};entry.logs=logs.slice(-30);if(page){await page.screenshot({path:path.join(SHOTS,engine+'-'+kind+'-failure.png')}).catch(()=>{});}throw error;}
  finally{write();if(context)await context.close();await fx.close();}
 }
 result.passed=true;
}finally{write();for(const b of Object.values(browsers))await b.close().catch(()=>{});}
