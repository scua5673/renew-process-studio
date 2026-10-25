import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,OUT,SHOTS,WT,A} from '../fixtures/team-app.mjs';

// Synthetic images reproduce a schedule whose screen copy exceeds the wire
// limit. The server document and separately stored images remain small.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={},faults={},fx=await startFixture(faults);
const KEY='process_coach_v1',MATCH='cs_team_matches_v1';
// Node's seed and the Seoul browser can be on different weeks. Normalization
// moves week keys while preserving dates, so follow the original training slot.
// This same function runs in Node for assertions and in the frame for edits.
function trainingAt({raw,slot,date,KEY,append}){
  if(raw==null)raw=PSSchedule.raw();
  const d=JSON.parse(raw),matches=[];
  for(const [week,days] of Object.entries(d.weeks))days.forEach((day,index)=>{
    for(const training of day.trainings||[])if(training.slot===slot)matches.push({week:Number(week),day:index,training});
  });
  if(matches.length!==1)throw new Error('expected one training for slot '+slot+', found '+matches.length);
  const found=matches[0],parts=d.anchorMonday.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!parts||!Number.isInteger(found.week))throw new Error('invalid schedule calendar');
  const absoluteDate=new Date(Date.UTC(+parts[1],+parts[2]-1,+parts[3]+found.week*7+found.day)).toISOString().slice(0,10);
  if(date&&absoluteDate!==date)throw new Error('training date changed: '+absoluteDate+' !== '+date);
  const result={slot,anchorMonday:d.anchorMonday,week:found.week,day:found.day,date:absoluteDate,blocks:found.training.blocks};
  if(!append)return result;
  found.training.blocks.push(...append);d.editedAt=Date.now();const next=JSON.stringify(d);
  scoutStore.set(KEY,d);
  return Promise.resolve(psFlushPendingReady()).then(()=>({...result,before:raw.length,after:next.length,raw:next}));
}
const image=i=>'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="50"><!--'+i+'x'.repeat(56000)+'--><rect width="80" height="50" fill="green"/></svg>';
const doc=JSON.parse(fx.db.get(WT+'|'+KEY).v);
const slot=doc.weeks[0][1].trainings[0].slot;
assert.ok(slot,'the seeded image training has a stable slot');
const date=trainingAt({raw:JSON.stringify(doc),slot}).date;
const proof={engine,nodeTimezone:Intl.DateTimeFormat().resolvedOptions().timeZone,slot,date,stages:[],passed:false};
function check(raw,stage,count){
  const state=trainingAt({raw,slot,date});
  assert.equal(state.blocks.length,count,stage+' block count');
  for(let i=0;i<count;i++)assert.equal(state.blocks[i].id,'fixture-drill-'+i,stage+' block identity '+i);
  proof.stages.push({stage,slot:state.slot,anchorMonday:state.anchorMonday,week:state.week,day:state.day,date:state.date,blocks:count});
  return state.blocks;
}
function checkImages(blocks,count,wire=false){
  assert.equal(blocks.length,count);
  for(let i=0;i<count;i++){
    if(wire)assert.ok(blocks[i].thumbRef,'server image reference '+i);
    const actual=(!wire&&blocks[i].thumb)||JSON.parse('"'+fx.blobs.get(WT+'|'+blocks[i].thumbRef).v+'"');
    assert.equal(actual,image(i),'exact image bytes '+i);
  }
}
for(const [wk,days] of Object.entries(doc.weeks))days.forEach((d,i)=>{if(d.board?.sched==='경기')d.mid='fixture-match-'+wk+'-'+i;});
trainingAt({raw:JSON.stringify(doc),slot,date});
const seededBlocks=Array.from({length:60},(_,i)=>{
  const v=JSON.stringify(image(i)).slice(1,-1),h=crypto.createHash('sha256').update(v).digest('hex').slice(0,24);
  fx.blobs.set(WT+'|'+h,{workspace_id:WT,h,v});
  return {id:'fixture-drill-'+i,name:'가상 훈련 '+i,thumb:'',thumbRef:h};
});
// Use the saved slot even when choosing the initial source to avoid a second
// implicit dependency on its week/day coordinates.
for(const days of Object.values(doc.weeks))for(const day of days)for(const training of day.trainings||[])if(training.slot===slot)training.blocks=seededBlocks;
fx.db.get(WT+'|'+KEY).v=JSON.stringify(doc);
checkImages(check(fx.db.get(WT+'|'+KEY).v,'seed',60),60,true);
const originalServer=fx.db.get(WT+'|'+KEY).v;
fx.db.set(WT+'|'+MATCH,{workspace_id:WT,k:MATCH,cupd:1000,updated_by:A,v:JSON.stringify({version:1,matches:[{
  id:'fixture-review',date:'2026-10-20',opponent:'프로세스FC',reviewGood:'기존 리뷰 보존',reviewImprove:'',createdAt:1000,updatedAt:1000
}]})});
try{
  const {page,context,logs}=await openApp(fx,engine==='webkit'?'ipad':'desktop',{browsers,phoneStart:true});
  await page.evaluate(()=>document.querySelector('[data-team-key="match"]').click());
  const sf=await (await page.waitForSelector('#fScout')).contentFrame();
  await sf.waitForFunction(()=>typeof matchOpen==='function'&&!matchDocPending(),null,{timeout:30000});
  await sf.evaluate(()=>{setView('match');matchOpen('fixture-review');matchStage='review';matchTab='review';renderMatch();});
  const field=sf.locator('[data-match-field="reviewGood"]');
  await field.waitFor({state:'visible'});
  await sf.waitForFunction(()=>PSSchedule.raw()!=null,null,{timeout:15000});
  // Existing image bytes survive a normal edit; only four new pictures are added.
  const newImages=Array.from({length:4},(_,i)=>image(i+60));
  checkImages(check(await sf.evaluate(()=>PSSchedule.raw()),'raw-before-edit',60),60);
  const edit=await sf.evaluate(trainingAt,{KEY,slot,date,append:newImages.map((thumb,i)=>({id:'fixture-drill-'+(60+i),name:'가상 새 훈련 '+i,thumb}))});
  checkImages(check(edit.raw,'raw-edited',64),64);
  const sizes={before:edit.before,after:edit.after};
  assert.ok(sizes.before<3500000&&sizes.after>3500000,JSON.stringify(sizes));
  const rounds=[];
  for(let i=0;i<3;i++)rounds.push(await page.evaluate(()=>PSSync.syncNow('fixture-large-schedule')));
  const status=await page.evaluate(()=>({ready:PSSync.keyReady('cs_team_matches_v1'),scheduleReady:PSSync.keyReady('process_coach_v1'),skipped:localStorage.getItem('ps_sync_skipped'),state:PSSync.state()}));
  console.log(JSON.stringify({engine,sizes,rounds,status,blobCount:fx.blobs.size}));
  await page.screenshot({path:path.join(SHOTS,'match-large-schedule-'+engine+'.png')});
  assert.equal(status.ready,true,'image extraction must finish and unblock the match: '+JSON.stringify(status));
  if(!status.scheduleReady)assert.equal(await page.evaluate(()=>localStorage.getItem('process_coach_v1')),null,'only the optional quota-blocked mirror may be absent');
  await sf.waitForFunction(slot=>{
    if(PSSchedule.raw()==null)return false;
    const matches=Object.values(JSON.parse(PSSchedule.raw()).weeks).flatMap(days=>days.flatMap(day=>(day.trainings||[]).filter(t=>t.slot===slot)));
    return matches.length===1&&matches[0].blocks.length===64;
  },slot,{timeout:15000});
  checkImages(check(await sf.evaluate(()=>PSSchedule.raw()),'raw-ready',64),64);
  assert.equal(status.skipped,null);
  await sf.waitForFunction(()=>!document.querySelector('.match-shell').classList.contains('readonly'));
  await field.fill('가상 리뷰 입력 저장 확인');
  await sf.evaluate(()=>psFlushPendingReady());
  for(let i=0;i<6&&!fx.db.get(WT+'|'+MATCH).v.includes('가상 리뷰 입력 저장 확인');i++){
    await page.evaluate(()=>PSSync.syncNow('fixture-review-save'));
    await page.waitForTimeout(250);
  }
  assert.match(fx.db.get(WT+'|'+MATCH).v,/가상 리뷰 입력 저장 확인/);
  const savedBlocks=check(fx.db.get(WT+'|'+KEY).v,'server-saved',64);
  assert.ok(fx.db.get(WT+'|'+KEY).v.length<3500000);
  checkImages(savedBlocks,64,true);
  assert.notEqual(fx.db.get(WT+'|'+KEY).v,originalServer);
  // If the image service is unavailable, the oversized fallback must never be
  // uploaded or acknowledged. Keep the exact pending local edit for recovery.
  const beforeFailure=fx.db.get(WT+'|'+KEY).v;
  faults.blobStatus=403;
  const pending=await sf.evaluate(trainingAt,{KEY,slot,date,append:[{id:'fixture-drill-64',name:'가상 보존할 훈련',thumb:image(64)}]});
  const pendingRaw=pending.raw;
  const failed=await page.evaluate(()=>PSSync.syncNow('fixture-blob-unavailable'));
  assert.ok(failed.error||failed.skipped?.includes(KEY),JSON.stringify(failed));
  assert.equal(fx.db.get(WT+'|'+KEY).v,beforeFailure,'oversized raw fallback never reaches the server');
  checkImages(check(await page.evaluate(async KEY=>(await storage.get(KEY)).value,KEY),'pending-idb',65),65);
  const pendingBlocks=check(pendingRaw,'pending-exact-edit',65);
  checkImages(pendingBlocks,65);
  assert.equal(pendingBlocks[64].thumb,image(64));
  check(fx.db.get(WT+'|'+KEY).v,'server-after-403',64);
  faults.blobStatus=0;
  const imagePulls=()=>fx.calls.filter(x=>x.p==='/rest/v1/ps_blob'&&x.m==='GET'&&new URLSearchParams(x.q).get('select')==='h,v').length;
  const readsBefore=imagePulls();
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.PSSync&&PSSync.dataUnlocked(),null,{timeout:45000});
  await page.waitForFunction(()=>window.PSSync&&PSSync.keyReady('cs_team_matches_v1'),null,{timeout:45000}).catch(async error=>{console.error(JSON.stringify({reload:await page.evaluate(()=>({state:PSSync.state(),pending:PSSync.pending(),skipped:localStorage.getItem('ps_sync_skipped'),match:localStorage.getItem('cs_team_matches_v1')?.length,blobOff:PSSync.blob.off()})),events:fx.calls.filter(x=>x.p==='/rest/v1/ps_events').slice(-8),logs:logs.slice(-8)}));throw error;});
  await page.evaluate(()=>document.querySelector('[data-team-key="match"]').click());
  const reloadFrame=await (await page.waitForSelector('#fScout')).contentFrame();
  await reloadFrame.waitForFunction(()=>typeof matchLoad==='function'&&!matchDocPending());
  assert.equal(await reloadFrame.evaluate(()=>matchLoad().matches.find(m=>m.id==='fixture-review').reviewGood),'가상 리뷰 입력 저장 확인');
  checkImages(check(fx.db.get(WT+'|'+KEY).v,'server-recovered',65),65,true);
  await reloadFrame.waitForFunction(slot=>{
    if(PSSchedule.raw()==null)return false;
    const matches=Object.values(JSON.parse(PSSchedule.raw()).weeks).flatMap(days=>days.flatMap(day=>(day.trainings||[]).filter(t=>t.slot===slot)));
    return matches.length===1&&matches[0].blocks.length===65;
  },slot,{timeout:15000});
  checkImages(check(await reloadFrame.evaluate(()=>PSSchedule.raw()),'raw-reloaded',65),65);
  checkImages(check(await page.evaluate(async KEY=>(await storage.get(KEY)).value,KEY),'idb-reloaded',65),65);
  assert.equal(imagePulls(),readsBefore,'cached images need no repeat download');
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'),[]);
  Object.assign(proof,{passed:true,sizes,rounds,status,reviewPreserved:true,pending403Preserved:true,exactImages:65,imageReadsBeforeReload:readsBefore,imageReadsAfterReload:imagePulls()});
  console.log('match-large-schedule OK',engine);
  await context.close();
}catch(error){proof.error={name:error.name,message:error.message,stack:error.stack};throw error;
}finally{fs.writeFileSync(path.join(OUT,'final.json'),JSON.stringify(proof,null,2)+'\n');for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
