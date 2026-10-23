import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import {startFixture,openApp,SHOTS,WT,A} from '../fixtures/team-app.mjs';

// Synthetic images reproduce a schedule whose screen copy exceeds the wire
// limit. The server document and separately stored images remain small.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',browsers={},faults={},fx=await startFixture(faults);
const KEY='process_coach_v1',MATCH='cs_team_matches_v1';
const image=i=>'<svg xmlns="http://www.w3.org/2000/svg" width="80" height="50"><!--'+i+'x'.repeat(56000)+'--><rect width="80" height="50" fill="green"/></svg>';
const doc=JSON.parse(fx.db.get(WT+'|'+KEY).v);
for(const [wk,days] of Object.entries(doc.weeks))days.forEach((d,i)=>{if(d.board?.sched==='경기')d.mid='fixture-match-'+wk+'-'+i;});
doc.weeks[0][1].trainings[0].blocks=Array.from({length:60},(_,i)=>{
  const v=JSON.stringify(image(i)).slice(1,-1),h=crypto.createHash('sha256').update(v).digest('hex').slice(0,24);
  fx.blobs.set(WT+'|'+h,{workspace_id:WT,h,v});
  return {id:'fixture-drill-'+i,name:'가상 훈련 '+i,thumb:'',thumbRef:h};
});
fx.db.get(WT+'|'+KEY).v=JSON.stringify(doc);
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
  const sizes=await sf.evaluate(async({KEY,newImages})=>{
    const raw=PSSchedule.raw(),d=JSON.parse(raw),blocks=d.weeks[0][1].trainings[0].blocks;
    newImages.forEach((thumb,i)=>blocks.push({id:'fixture-drill-'+(60+i),name:'가상 새 훈련 '+i,thumb}));
    d.editedAt=Date.now();const next=JSON.stringify(d);
    scoutStore.set(KEY,d);await psFlushPendingReady();
    return {before:raw.length,after:next.length};
  },{KEY,newImages});
  assert.ok(sizes.before<3500000&&sizes.after>3500000,JSON.stringify(sizes));
  const rounds=[];
  for(let i=0;i<3;i++)rounds.push(await page.evaluate(()=>PSSync.syncNow('fixture-large-schedule')));
  const status=await page.evaluate(()=>({ready:PSSync.keyReady('cs_team_matches_v1'),scheduleReady:PSSync.keyReady('process_coach_v1'),skipped:localStorage.getItem('ps_sync_skipped'),state:PSSync.state()}));
  console.log(JSON.stringify({engine,sizes,rounds,status,blobCount:fx.blobs.size}));
  await page.screenshot({path:path.join(SHOTS,'match-large-schedule-'+engine+'.png')});
  assert.equal(status.ready,true,'image extraction must finish and unblock the match: '+JSON.stringify(status));
  if(!status.scheduleReady)assert.equal(await page.evaluate(()=>localStorage.getItem('process_coach_v1')),null,'only the optional quota-blocked mirror may be absent');
  await sf.waitForFunction(()=>PSSchedule.raw()!=null&&JSON.parse(PSSchedule.raw()).weeks[0][1].trainings[0].blocks.length===64,null,{timeout:15000});
  assert.equal(status.skipped,null);
  await sf.waitForFunction(()=>!document.querySelector('.match-shell').classList.contains('readonly'));
  await field.fill('가상 리뷰 입력 저장 확인');
  await sf.evaluate(()=>psFlushPendingReady());
  for(let i=0;i<6&&!fx.db.get(WT+'|'+MATCH).v.includes('가상 리뷰 입력 저장 확인');i++){
    await page.evaluate(()=>PSSync.syncNow('fixture-review-save'));
    await page.waitForTimeout(250);
  }
  assert.match(fx.db.get(WT+'|'+MATCH).v,/가상 리뷰 입력 저장 확인/);
  const saved=JSON.parse(fx.db.get(WT+'|'+KEY).v),savedBlocks=saved.weeks[0][1].trainings[0].blocks;
  assert.equal(savedBlocks.length,64);
  assert.ok(fx.db.get(WT+'|'+KEY).v.length<3500000);
  for(let i=0;i<64;i++)assert.equal(JSON.parse('"'+fx.blobs.get(WT+'|'+savedBlocks[i].thumbRef).v+'"'),image(i));
  assert.notEqual(fx.db.get(WT+'|'+KEY).v,originalServer);
  // If the image service is unavailable, the oversized fallback must never be
  // uploaded or acknowledged. Keep the exact pending local edit for recovery.
  const beforeFailure=fx.db.get(WT+'|'+KEY).v;
  faults.blobStatus=403;
  const pendingRaw=await sf.evaluate(async({KEY,thumb})=>{
    const d=JSON.parse(PSSchedule.raw());d.weeks[0][1].trainings[0].blocks.push({id:'fixture-drill-64',name:'가상 보존할 훈련',thumb});
    d.editedAt=Date.now();scoutStore.set(KEY,d);await psFlushPendingReady();return JSON.stringify(d);
  },{KEY,thumb:image(64)});
  const failed=await page.evaluate(()=>PSSync.syncNow('fixture-blob-unavailable'));
  assert.ok(failed.error||failed.skipped?.includes(KEY),JSON.stringify(failed));
  assert.equal(fx.db.get(WT+'|'+KEY).v,beforeFailure,'oversized raw fallback never reaches the server');
  assert.equal(await page.evaluate(async KEY=>JSON.parse((await storage.get(KEY)).value).weeks[0][1].trainings[0].blocks.length,KEY),65);
  assert.equal(JSON.parse(pendingRaw).weeks[0][1].trainings[0].blocks[64].thumb,image(64));
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
  assert.equal(JSON.parse(fx.db.get(WT+'|'+KEY).v).weeks[0][1].trainings[0].blocks.length,65,'pending edit recovers after the service returns');
  assert.equal(imagePulls(),readsBefore,'cached images need no repeat download');
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'),[]);
  console.log('match-large-schedule OK',engine);
  await context.close();
}finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close();}
