import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {startFixture,openApp,OUT,root,SIZES,WT} from '../fixtures/team-app.mjs';

// Synthetic originals only. A session moving to another group must stay in its
// source stores, disappear from the strict old-group view, and remain reachable
// through the existing notice. No customer incident snapshots belong here.
const engine=process.env.PS_BROWSER_ENGINE||'chromium',KEY='process_coach_v1';
assert.ok(['chromium','webkit'].includes(engine));
const widths=(process.env.PS_SCHEDULE_GROUP_WIDTHS||'375,768,1280').split(',').map(Number);
assert.ok(widths.length&&new Set(widths).size===widths.length&&widths.every(width=>[375,768,1280].includes(width)),'supported unique schedule group widths');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const report={engine,source:Object.fromEntries(['studio/process.html','studio/storage.js','studio/sync.js'].map(file=>[file,sha(fs.readFileSync(path.join(root,file)))])),cases:[],passed:false};
const browsers={};
const target='fixture-group-A',labels=['합성 원본 A 프로그램','합성 원본 B 프로그램','합성 원본 공통 프로그램','합성 다음주 하루 조 프로그램','합성 다음주 3학년 프로그램','합성 다음주 복수 조 프로그램'];
const write=()=>fs.writeFileSync(path.join(OUT,'final.json'),JSON.stringify(report,null,2)+'\n');
function seed(fx){
 const old=JSON.parse(fx.db.get(WT+'|'+KEY).v),blank=()=>['월','화','수','목','금','토','일'].map((d,i)=>({d,n:i+1,rest:true,trainings:[],board:{sched:'',theme:'',meet:'',load:'',warm:'',warmData:null,warms:[],warmsData:[],warmSlot:[],meets:[],meetsData:[],meetSlot:[],trains:[],trainThemes:[],trainData:[],trainSlot:[],libs:[],libSlot:[],libData:[]}}));
 const monday=new Date(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())+'T00:00:00Z');
 monday.setUTCDate(monday.getUTCDate()-((monday.getUTCDay()+6)%7));
 const d={...old,anchorMonday:monday.toISOString().slice(0,10),weeks:{0:blank(),1:blank()}};
 const add=(week,di,id,i,grp)=>{
  const day=d.weeks[week][di],tr={slot:id,time:['17:00','18:00','19:00'][i%3],players:'',aims:'공격',note:'합성 보존 메모 '+i,load:{rpe:5},blocks:[],...(grp===undefined?{}:{grp})};
  day.rest=false;day.board.sched='훈련';day.board.theme='공격';day.trainings.push(tr);
  day.board.trains.push(labels[i]);day.board.trainSlot.push(id);day.board.trainThemes.push('공격');
  day.board.trainData.push({minutes:12+i,sets:2,custom:{keep:i},snap:{players:[{id:'synthetic-player-'+i,x:.21+i*.03,y:.43}],drawings:[{kind:'arrow',points:[[.1,.2],[.4,.5]]}]}});
 };
 add(0,1,target,0,['A팀']);add(0,1,'fixture-group-B',1,'B팀');add(0,1,'fixture-group-common',2);
 d.weeks[1][3].grp='B팀';d.weeks[1][3].groupKinds={'B팀':'훈련'};
 add(1,3,'fixture-group-day',3);add(1,3,'fixture-group-grade',4,'3학년');add(1,3,'fixture-group-multi',5,['B팀','3학년']);
 fx.db.get(WT+'|'+KEY).v=JSON.stringify(d);
 const roster=fx.db.get(WT+'|scout_tool_v1'),r=JSON.parse(roster.v);r.meta.grpBase=['A팀','B팀','3학년'];roster.v=JSON.stringify(r);
 return d;
}
function originals(raw){
 const d=typeof raw==='string'?JSON.parse(raw):raw,out=[];
 for(const[week,days]of Object.entries(d.weeks||{}))days.forEach((day,di)=>{
  const b=day.board||{};
  for(const tr of day.trainings||[]){
   if(!String(tr.slot||'').startsWith('fixture-group-'))continue;
   out.push({week:Number(week),day:di,dayGroup:day.grp||'',groupKinds:day.groupKinds||{},training:tr,programs:(b.trainSlot||[]).flatMap((slot,i)=>slot===tr.slot?[{label:b.trains[i],slot,data:b.trainData[i],theme:b.trainThemes[i]}]:[])});
  }
 });
 return out.sort((a,b)=>a.training.slot.localeCompare(b.training.slot));
}
const intended=d=>{const copy=JSON.parse(JSON.stringify(d));for(const days of Object.values(copy.weeks))for(const day of days)for(const tr of day.trainings)if(tr.slot===target)tr.grp=['3학년'];return copy;};
async function sources(page,frame,fx){
 const device=await page.evaluate(async KEY=>({mirror:localStorage.getItem(KEY),idb:(await storage.get(KEY))?.value}),KEY);
 const local=await frame.evaluate(()=>({screen:JSON.stringify({weeks:weeksMap}),raw:PSSchedule.raw(),filter:__schedGrp,common:localStorage.getItem('ps_sched_grp_common'),puts:(window.__scheduleGroupPuts||[]).length}));
 const shellPuts=await page.evaluate(()=>(window.__scheduleGroupPuts||[]).length);
 const server=fx.db.get(WT+'|'+KEY).v;
 return {raws:{...device,raw:local.raw,server},screen:local.screen,filter:local.filter,common:local.common,puts:local.puts+shellPuts,serverWrites:fx.writes.filter(w=>w.k===KEY).length};
}
function assertOriginals(state,expected,label){
 for(const[k,v]of Object.entries({...state.raws,screen:state.screen})){assert.equal(typeof v,'string',label+' '+k+' exists');assert.deepEqual(originals(v),originals(expected),label+' '+k+' retains all original fields/programs and only the intended grp');}
}
async function chooseGroup(frame,width,value){
 // Use the control actually displayed by this browser/layout, not the requested
 // viewport alone (a mobile WebKit context with a desktop UA can lay out at 980).
 if(await frame.locator('#psPhGrp').isVisible())await frame.locator('#psPhGrp').selectOption(value);
 else await frame.locator('#schedGrp [data-g="'+value+'"]').click();
 await frame.waitForFunction(value=>__schedGrp===value,value);
}
async function openSchedule(page,width){
 if(!await page.evaluate(()=>document.body.classList.contains('ps-team-open')))await page.locator('#appSeg [data-team-hub]').click();
 const desktop=page.locator('#teamNav [data-team-key="training"]');
 if(await desktop.isVisible())await desktop.click();else await page.locator('#teamBottom [data-tb="training"]').click();
 const frame=await(await page.waitForSelector('#fProcess')).contentFrame();
 await frame.waitForFunction(()=>typeof weeksMap==='object'&&PSSchedule.raw()!=null);
 if(!await frame.locator('#weekView').isVisible()){
  const phoneWeek=frame.locator('#psPhBar .sg [data-sv="week"]');
  if(await phoneWeek.isVisible())await phoneWeek.click();else await frame.locator('#vtoggle [data-v="week"]').click();
 }
 await frame.locator('#weekView').waitFor({state:'visible'});
 await frame.evaluate(()=>PSStorage.sharedReady('process_coach_v1'));await page.evaluate(()=>PSStorage.sharedReady('process_coach_v1'));
 return frame;
}
async function notice(frame,mine,other){
 await frame.waitForFunction(({mine,other})=>{const n=document.querySelector('#schedGrpNote > span');return !!n&&n.textContent.includes('A팀 일정 '+mine+'개')&&n.textContent.includes('다른 조 '+other+'개 숨김');},{mine,other},{timeout:15000});
 const text=await frame.locator('#schedGrpNote').innerText();assert.match(text,/팀 공통 1개/);return text;
}
async function noWrites(before,after,label){
 assert.deepEqual(after.raws,before.raws,label+' never changes the schedule raw in LS/IDB/server/PSSchedule');
 assert.equal(after.puts,before.puts,label+' issues no real schedule IDB put');assert.equal(after.serverWrites,before.serverWrites,label+' issues no server schedule mutation');
 assert.deepEqual(originals(after.screen),originals(before.screen),label+' keeps all in-memory authored data');
}
try{
 for(const width of widths){
  const entry={width,passed:false,stages:[]};report.cases.push(entry);const fx=await startFixture(),initial=seed(fx),expected=intended(initial);
  let page,context,frame,logs=[];
  try{
   const size='schedule-group-'+width;SIZES[size]={engine,ctx:{viewport:{width,height:900},deviceScaleFactor:1,hasTouch:width<1280,isMobile:width<768,...(engine==='webkit'&&width<=600?{userAgent:SIZES.phone.ctx.userAgent}:{})}};
   ({page,context,logs}=await openApp(fx,size,{browsers,phoneStart:true,init:{fn:()=>{
    window.__scheduleGroupPuts=[];const put=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(value,key){const result=put.apply(this,arguments);if(key==='process_coach_v1'&&this.name==='kv'&&this.transaction.db.name==='ps-store')window.__scheduleGroupPuts.push({at:performance.now(),length:String(value).length});return result;};
   },arg:null}}));
   page.setDefaultTimeout(15000);frame=await openSchedule(page,width);
   entry.viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,userAgent:navigator.userAgent}));
   entry.frameWidth=await frame.evaluate(()=>innerWidth);
   entry.frameDisplayWidth=await page.locator('#fProcess').evaluate(el=>el.getBoundingClientRect().width);
   assert.equal(entry.viewport.width,width,'the requested viewport is the actual layout width');assert.equal(entry.frameWidth,entry.frameDisplayWidth,'the schedule uses its actual iframe display width, after the shell rail');
   await chooseGroup(frame,width,'');const before=await sources(page,frame,fx);assertOriginals(before,initial,'initial');
   await chooseGroup(frame,width,'A팀');entry.initialNotice=await notice(frame,1,4);
   const filtered=await sources(page,frame,fx);await noWrites(before,filtered,'A filter');assertOriginals(filtered,initial,'A filter');
   const boardText=await frame.locator('#wkBoard').innerText();assert.ok(boardText.includes(labels[0]));assert.ok(!boardText.includes(labels[1]));assert.ok(!boardText.includes(labels[2]));
   // The common-view toggle is also view-only; the strict other-group filter stays.
   await frame.locator('#schedGrpCommonBtn').click();
   assert.ok((await frame.locator('#wkBoard').innerText()).includes(labels[2]));assert.ok(!(await frame.locator('#wkBoard').innerText()).includes(labels[1]));
   await noWrites(before,await sources(page,frame,fx),'show common');
   await frame.locator('#schedGrpCommonBtn').click();await noWrites(before,await sources(page,frame,fx),'hide common');
   await frame.locator('#schedGrpAllBtn').click();await frame.waitForFunction(()=>__schedGrp==='');
   await noWrites(before,await sources(page,frame,fx),'notice All before edit');
   assert.equal(await frame.locator('#schedGrpNote').count(),0);
   // Inspect the inherited day group, a single string group and multiple groups
   // in week 1 as well; this also keeps the notice's all-weeks count meaningful.
   const phoneNext=frame.locator('#psPhBar .nv[data-d="1"]'),nextWeek=await phoneNext.isVisible()?phoneNext:frame.locator('#weekView .weeknav button').last();
   await nextWeek.click();await frame.waitForFunction(()=>wk===1);
   const future=await frame.locator('#wkBoard').innerText();for(const label of labels.slice(3))assert.ok(future.includes(label));
   await noWrites(before,await sources(page,frame,fx),'next week view');
   const phonePrevious=frame.locator('#psPhBar .nv[data-d="-1"]'),previousWeek=await phonePrevious.isVisible()?phonePrevious:frame.locator('#weekView .weeknav button').first();
   await previousWeek.click();await frame.waitForFunction(()=>wk===0);await chooseGroup(frame,width,'A팀');
   await frame.locator('.wks-fill[onclick*="'+target+'"]').click();await frame.locator('#wfSec-grp').waitFor({state:'visible'});
   await frame.locator('#wfSec-grp').getByRole('button',{name:'3학년',exact:true}).click();
   assert.deepEqual(await frame.evaluate(slot=>week.flatMap(d=>d.trainings||[]).find(t=>t.slot===slot).grp,target),['A팀','3학년']);
   await frame.locator('#wfSec-grp').getByRole('button',{name:'A팀',exact:true}).click();
   await frame.locator('#sheet .actionbar').getByRole('button',{name:'완료',exact:true}).click();
   await frame.waitForFunction(()=>!document.getElementById('scrim').classList.contains('show'));
   entry.afterTransferNotice=await notice(frame,0,5);entry.stages.push('live notice after actual A to A+grade3 to grade3 edit');
   assert.ok(!(await frame.locator('#wkBoard').innerText()).includes(labels[0]),'old A filter remains strict after transfer');
   await page.screenshot({path:path.join(OUT,'notice-after-transfer-'+engine+'-'+width+'.png')});
   await frame.evaluate(()=>{saveFlush();return PSStorage.sharedReady('process_coach_v1');});await page.evaluate(()=>PSStorage.sharedReady('process_coach_v1'));
   await page.waitForFunction(()=>!PSSync.scheduleEdit.active(),null,{timeout:15000});
   entry.sync=await page.evaluate(()=>PSSync.syncNow('fixture-schedule-group-transfer'));
   // Real fixture server ACK, not an optimistic local save or mocked sync result.
   assert.deepEqual(originals(fx.db.get(WT+'|'+KEY).v),originals(expected),'actual server stores exact intended transfer');
   const saved=await sources(page,frame,fx);assertOriginals(saved,expected,'confirmed transfer');entry.serverConfirmed=true;
   await frame.locator('#schedGrpAllBtn').click();await frame.waitForFunction(()=>__schedGrp==='');
   const all=await sources(page,frame,fx);await noWrites(saved,all,'notice All after transfer');assertOriginals(all,expected,'All after transfer');
   const allText=await frame.locator('#wkBoard').innerText();for(const label of labels.slice(0,3))assert.ok(allText.includes(label),'All recovers '+label);
   assert.equal(await frame.locator('#schedGrpNote').count(),0);
   await page.screenshot({path:path.join(OUT,'all-programs-restored-'+engine+'-'+width+'.png')});
   await chooseGroup(frame,width,'3학년');assert.ok((await frame.locator('#wkBoard').innerText()).includes(labels[0]));
   await noWrites(all,await sources(page,frame,fx),'new group view');
   await frame.locator('#schedGrpAllBtn').click();await frame.waitForFunction(()=>__schedGrp==='');
   await noWrites(all,await sources(page,frame,fx),'All from new group');
   await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>PSSync?.dataUnlocked());frame=await openSchedule(page,width);await chooseGroup(frame,width,'');
   const reloaded=await sources(page,frame,fx);assertOriginals(reloaded,expected,'reload actual server-confirmed transfer');
   assert.ok((await frame.locator('#wkBoard').innerText()).includes(labels[0]));
   const geometry=await frame.locator('#schedGrpAllBtn').count();assert.equal(geometry,0,'All notice removed when no filter selected');
   assert.deepEqual(logs.filter(x=>x.type==='pageerror'),[]);
   Object.assign(entry,{passed:true,viewOnlyNoScheduleWrites:true,authoredRecords:6,programs:6,strictFilter:true,allRestoresView:true,reloadPreserved:true,storedSignature:sha(JSON.stringify(originals(reloaded.raws.server))),scheduleServerWrites:fx.writes.filter(x=>x.k===KEY).length});
   console.log(JSON.stringify({engine,width,passed:true,serverConfirmed:true,initialNotice:entry.initialNotice,afterTransferNotice:entry.afterTransferNotice}));
  }catch(error){entry.error={name:error.name,message:error.message,stack:error.stack};entry.logs=logs.slice(-30);if(page)await page.screenshot({path:path.join(OUT,'failure-'+engine+'-'+width+'.png')}).catch(()=>{});if(page&&frame)entry.failureSources=await sources(page,frame,fx).catch(e=>({error:e.message}));throw error;
  }finally{write();if(context)await context.close();await fx.close();}
 }
 report.passed=true;
}finally{write();for(const browser of Object.values(browsers))await browser.close().catch(()=>{});}
