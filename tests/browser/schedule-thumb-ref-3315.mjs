import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,OUT,SHOTS,WT} from '../fixtures/team-app.mjs';

/* 3.315 — 일정 사본의 훈련 그림은 기기에서도 참조만(schedule-thumb-ref.js · sync-sched-blob.js).
   ① 서버 참조(thumbRef)로 받은 그림이 화면에 그려지고 기기 사본(localStorage · IDB)은 참조만 든다(그림은 ps_blob:<h> 캐시)
   ② 이 기기에서 새로 담은 그림은 저장 때 참조로 떼어 캐시에 두고, 올릴 때 서버 ps_blob 에 그림이 간다(문서엔 참조만)
   ③ 새로고침 뒤 두 그림이 캐시에서 돌아온다(다시 내려받지 않는다)
   ④ 그림을 품은 옛 기기 사본(2.622 이전 모양)은 회차가 참조만 남긴 서버 원문으로 바꾼다 — 11/17 풋볼A 맥 8MB 의 길 */
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop',browsers={};
const KEY='process_coach_v1';
const svg=mark=>'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 50">'+'<rect width="9" height="9"/>'.repeat(70)+mark+'</svg>';
const SERVER=svg('<circle r="3"/>'),LOCAL=svg('<ellipse rx="3" ry="2"/>');
const segment=s=>JSON.stringify(s).slice(1,-1),sha=s=>crypto.createHash('sha256').update(s).digest('hex').slice(0,24);
const fx=await startFixture();
const H=sha(segment(SERVER));fx.blobs.set(WT+'|'+H,{workspace_id:WT,h:H,v:segment(SERVER)});
{ const row=fx.db.get(WT+'|'+KEY),doc=JSON.parse(row.v),day=doc.weeks[0][1],slot=day.trainings[0].slot;
  day.board=Object.assign(day.board||{},{sched:'훈련',trains:['가상 서버 그림'],trainThemes:[''],trainData:[{minutes:20,thumb:'',thumbRef:H,snap:null,focus:''}],trainSlot:[slot]});
  row.v=JSON.stringify(doc); }
const proof={engine,stages:[],passed:false};
const write=()=>fs.writeFileSync(path.join(OUT,'schedule-thumb-ref-3315-'+engine+'.json'),JSON.stringify(proof,null,2)+'\n');
const pulls=()=>fx.calls.filter(x=>x.p==='/rest/v1/ps_blob'&&x.m==='GET'&&new URLSearchParams(x.q).get('select')==='h,v').length;
async function openSchedule(page){
  await page.waitForFunction(()=>!!(window.PSSync&&PSSync.dataUnlocked()&&document.body&&!document.body.classList.contains('ps-booting')));
  const nav=page.locator('#teamNav [data-team-key="training"]:visible, #teamBottom [data-tb="training"]:visible').first();
  if(!await nav.isVisible())await page.locator('#appSeg [data-team-hub]:visible').click();
  await nav.click();
  const frame=await(await page.waitForSelector('#fProcess')).contentFrame();
  await frame.waitForFunction(()=>!!(typeof weeksMap==='object'&&window.PSSchedule&&PSSchedule.raw()&&window.__psSchedThumbRef));
  if(!await frame.locator('#weekView').isVisible())await frame.locator('#vtoggle [data-v="week"]').click();
  await frame.locator('#weekView').waitFor({state:'visible'});
  /* 훈련 그림(.dthumb)은 하루 보기(renderDay)가 그린다 — 화요일(dayIdx 1) 하루 보기로 */
  await frame.evaluate(()=>{dayIdx=1;});await frame.locator('#vtoggle [data-v="day"]').click();
  await frame.locator('#dayViewWrap').waitFor({state:'visible'});return frame;
}
const pictures=frame=>frame.evaluate(()=>{dayIdx=1;renderDay();const a=document.querySelectorAll('#dayView .dthumb svg circle').length;dayIdx=2;renderDay();const b=document.querySelectorAll('#dayView .dthumb svg ellipse').length;dayIdx=1;renderDay();return {circle:a,ellipse:b};});
const device=page=>page.evaluate(async KEY=>({ls:localStorage.getItem(KEY),idb:(await storage.get(KEY))?.value??null}),KEY);
const cells=raw=>Object.values(JSON.parse(raw).weeks).flatMap(days=>days.flatMap(d=>(d.board&&d.board.trainData)||[]));
const marks=frame=>frame.evaluate(()=>({circle:document.querySelectorAll('svg circle').length,ellipse:document.querySelectorAll('svg ellipse').length}));
try{
  const {page,context,logs}=await openApp(fx,size,{browsers});
  let frame=await openSchedule(page);
  /* ① 서버 참조 → 화면엔 그림, 기기 사본엔 참조만 */
  const diag=async()=>({ls:(await device(page)).ls.slice(0,400),svgs:await frame.evaluate(()=>({svg:document.querySelectorAll('svg').length,circle:document.querySelectorAll('svg circle').length,dthumb:document.querySelectorAll('.dthumb').length,mem:(weeksMap[0]&&weeksMap[0][1]&&weeksMap[0][1].board&&weeksMap[0][1].board.trainData||[]).map(t=>({len:(t.thumb||'').length,ref:t.thumbRef})),week:document.querySelector('#weekView')?.innerHTML.slice(0,600)})),blob:await page.evaluate(async h=>!!(await storage.get('ps_blob:'+h)),H),calls:fx.calls.filter(x=>x.p==='/rest/v1/ps_blob').length});
  /* 하루 보기 토글은 오늘로 맞춘다 — 화요일을 다시 그려 본다 */
  await frame.waitForFunction(()=>{dayIdx=1;renderDay();return document.querySelectorAll('#dayView .dthumb svg circle').length>=1;},null,{timeout:20000,polling:500}).catch(async e=>{console.error('DIAG',JSON.stringify(await diag()));throw e;});
  let dev=await device(page);
  assert.ok(dev.ls.includes('"thumbRef":"'+H+'"'),'기기 거울은 서버 참조 그대로');assert.ok(!dev.ls.includes('<rect'),'기기 거울에 그림이 없다');assert.equal(dev.idb,dev.ls);
  assert.equal(await page.evaluate(async h=>(await storage.get('ps_blob:'+h))?.value,H),segment(SERVER),'그림은 IDB 캐시에');
  proof.stages.push({stage:'server-ref',marks:await marks(frame),lsLength:dev.ls.length});
  /* ② 이 기기에서 새로 담은 그림 → 참조 + 캐시, 올릴 때 서버 ps_blob 로 */
  await frame.evaluate(async svg=>{
    const b=dayBoard(week[2]);b.sched='훈련';b.trains=['가상 기기 그림'];b.trainThemes=[''];b.trainData=[{minutes:10,thumb:svg,snap:null,focus:''}];b.trainSlot=[''];
    syncViews();saveFlush();await (window.__schedWriteWork||Promise.resolve());
  },LOCAL);
  assert.deepEqual(await pictures(frame),{circle:1,ellipse:1},'새 그림도 하루 보기에 바로');
  dev=await device(page);
  const mine=cells(dev.ls).find(c=>c.thumbRef&&c.thumbRef!==H);
  assert.ok(mine&&/^[0-9a-f]{24}$/.test(mine.thumbRef),'새 그림은 참조로 저장된다 '+JSON.stringify(mine));assert.equal(mine.thumb,'');
  assert.ok(!dev.ls.includes('<ellipse'),'기기 거울에 새 그림이 들어가지 않는다');assert.equal(dev.idb,dev.ls);
  assert.equal(await page.evaluate(async h=>(await storage.get('ps_blob:'+h))?.value,mine.thumbRef),segment(LOCAL),'새 그림은 IDB 캐시에');
  /* 저장 직후 5초는 셸이 일정 키를 보류한다(__schedTouch) — 보류가 풀릴 때까지 회차를 되풀이한다 */
  const rounds2=[];
  for(let i=0;i<30&&!fx.db.get(WT+'|'+KEY).v.includes(mine.thumbRef);i++){rounds2.push(await page.evaluate(()=>PSSync.syncNow('fixture-thumb-ref')));await page.waitForTimeout(500);}
  const server=fx.db.get(WT+'|'+KEY).v;
  assert.ok(server.includes('"thumbRef":"'+mine.thumbRef+'"'),'서버 문서엔 참조 '+JSON.stringify(rounds2.slice(-2)));assert.ok(!server.includes('<ellipse'),'서버 문서에 그림이 없다');
  assert.equal(fx.blobs.get(WT+'|'+mine.thumbRef)?.v,segment(LOCAL),'그림은 서버 ps_blob 에(이 기기 캐시에서 올렸다)');
  proof.stages.push({stage:'local-picture',ref:mine.thumbRef,serverLength:server.length});
  /* ③ 새로고침 — 두 그림 모두 캐시에서, 다시 내려받지 않는다 */
  const before=pulls();
  await page.reload({waitUntil:'domcontentloaded'});
  frame=await openSchedule(page);
  await frame.waitForFunction(()=>{dayIdx=1;renderDay();return document.querySelectorAll('#dayView .dthumb svg circle').length>=1;},null,{timeout:20000,polling:500});
  assert.deepEqual(await pictures(frame),{circle:1,ellipse:1},'두 그림 모두 캐시에서 돌아온다');
  assert.equal(pulls(),before,'캐시에 있는 그림은 다시 받지 않는다');
  dev=await device(page);assert.ok(!dev.ls.includes('<rect'));
  proof.stages.push({stage:'reload',marks:await marks(frame)});
  /* ④ 그림을 품은 옛 기기 사본 → 회차가 참조만 남긴 서버 원문으로 */
  const hydrated=dev.ls.split('"thumb":"","thumbRef":"'+H+'"').join('"thumb":'+JSON.stringify(SERVER)).split('"thumb":"","thumbRef":"'+mine.thumbRef+'"').join('"thumb":'+JSON.stringify(LOCAL));
  assert.ok(hydrated.includes('<rect')&&hydrated.length>dev.ls.length+1000);
  await page.evaluate(async ({KEY,raw})=>{localStorage.setItem(KEY,raw);await storage.set(KEY,raw);},{KEY,raw:hydrated});
  let rounds=[];
  for(let i=0;i<20&&(await device(page)).ls.includes('<rect');i++){rounds.push(await page.evaluate(()=>PSSync.syncNow('fixture-diet'))); await page.waitForTimeout(500);}
  dev=await device(page);
  assert.ok(!dev.ls.includes('<rect'),'옛 사본의 그림이 빠졌다 '+JSON.stringify(rounds));assert.equal(dev.idb,dev.ls);
  assert.ok(dev.ls.includes('"thumbRef":"'+H+'"'),'서버 그림의 참조는 같은 SHA-256 으로 돌아온다');
  /* 옛 사본에 품긴 기기 그림(djb 참조였던 것)은 sync 의 SHA-256 으로 다시 떼어 한 번 올라간다 — 내용 주소라 어느 참조든 같은 그림 */
  const again=cells(dev.ls).find(c=>c.thumbRef&&c.thumbRef!==H);
  assert.ok(again&&/^[0-9a-f]{24}$/.test(again.thumbRef)&&again.thumb==='','기기 그림도 참조로 '+JSON.stringify(again));
  assert.equal(fx.blobs.get(WT+'|'+again.thumbRef)?.v,segment(LOCAL),'그 참조의 그림이 서버 ps_blob 에 있다');
  assert.equal(await page.evaluate(()=>PSSync.keyReady('process_coach_v1')),true,'준비표는 서버 원문으로 다시 확인된다');
  await frame.waitForFunction(()=>weeksMap[0]&&weeksMap[0][1].board.trainData[0].thumb.length>100,null,{timeout:20000});
  assert.deepEqual(await pictures(frame),{circle:1,ellipse:1},'다이어트 뒤에도 그림은 그대로');
  assert.ok(!fx.db.get(WT+'|'+KEY).v.includes('<rect'),'서버 문서는 내내 참조만');
  proof.stages.push({stage:'legacy-diet',rounds:rounds.length,marks:await marks(frame),lsLength:dev.ls.length});
  await page.screenshot({path:path.join(SHOTS,'schedule-thumb-ref-3315-'+engine+'.png')});
  assert.deepEqual(logs.filter(x=>x.type==='pageerror'),[]);
  proof.passed=true;write();
  console.log('schedule-thumb-ref-3315 OK',engine,JSON.stringify(proof.stages));
  await context.close();
}catch(error){proof.error={name:error.name,message:error.message,stack:error.stack};write();console.error(error);process.exitCode=1;}
finally{for(const b of Object.values(browsers))await b.close().catch(()=>{});await fx.close?.();}
