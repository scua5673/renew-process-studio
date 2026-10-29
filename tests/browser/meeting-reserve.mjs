import assert from 'node:assert/strict';
import path from 'node:path';
import {startFixture,openApp,SHOTS} from '../fixtures/team-app.mjs';
const engine=process.env.PS_BROWSER_ENGINE||'chromium',size=engine==='webkit'?'ipad':'desktop';
const fx=await startFixture(),browsers={};
try{
 const {page,logs}=await openApp(fx,size,{browsers});console.log('reserve: app ready');
 await page.evaluate(()=>document.querySelector('#appSeg button[data-app="design"]:not([data-train])').click());
 const f=await (await page.waitForSelector('#fBoard',{state:'attached'})).contentFrame();
 await f.waitForFunction(()=>window.__psMeetReserve&&window.__boardReady&&window.__boardRestoreDone&&window._boardPrivateLoaded&&boardPrivateCurrent(_boardPrivateOwner)&&document.getElementById('dfNew'));
 await f.click('#dfNew');await f.locator('.vcc-item').filter({hasText:'미팅 자료'}).click();
 await f.waitForSelector('#psMeetForm.on');await f.click('#psMeetForm [data-start=filled]');
 await f.click('#psMeetForm [data-team="us"] [data-k="4231"]');await f.click('#psMeetForm .mf-go');
 await f.waitForFunction(()=>anim.slides.length===10&&!window.__ksNav);
 console.log('reserve: meeting ready');let st=await f.evaluate(()=>({titles:anim.slides.map(s=>s.title),best:anim.slides[0].snap.players,reserve:anim.slides[1].snap.players}));
 assert.deepEqual(st.titles.slice(0,3),['BEST 11','RESERVE','하이블록']);
 assert.equal(st.reserve.length,11);assert.ok(st.reserve.every(p=>p.team==='blue'&&p.meetingRole==='reserve'));
 assert.deepEqual(st.reserve.map(p=>[p.pos,p.x,p.y]),st.best.map(p=>[p.pos,p.x,p.y]),'reserve uses selected formation and evenly spread lineup');
 const work=await f.evaluate(()=>JSON.stringify(window.__psPages.pg(),(k,v)=>k==='thumb'?undefined:v));
 // Even after using the same shirt number, reserve names stay separate, including on reopen upgrade.
 await f.evaluate(()=>{window.__ksTransition='none';window.__meet.go(1);});
 await f.waitForFunction(()=>window.__meet.idx()===1&&!window.__ksNav);
 await f.evaluate(()=>{const p=state.players[0];p.num='1';p.name='리저브 선수';syncNameToScenes(p);renderTokens();window.__meet.saveCur();});
 await f.evaluate(()=>window.__meet.go(0));await f.waitForFunction(()=>!window.__ksNav);
 await f.evaluate(()=>{const p=state.players.find(p=>p.num==='1');p.name='선발 선수';syncNameToScenes(p);renderTokens();window.__meet.saveCur();window.__meetUpgrade();});
 assert.deepEqual(await f.evaluate(()=>[anim.slides[0].snap.players.find(p=>p.num==='1').name,anim.slides[1].snap.players.find(p=>p.num==='1').name]),['선발 선수','리저브 선수']);
 await f.evaluate(()=>window.__meet.go(1));await f.waitForFunction(()=>!window.__ksNav);
 for(const [oh,label] of [['portrait','세로형'],['landscape','가로형']]){
   await f.getByRole('button',{name:label,exact:true}).click();
   await f.waitForFunction(o=>meetingPdfOrientation(anim.slides)===o,oh);
   assert.equal(await f.evaluate(()=>anim.slides[1].snap.orientation),oh==='portrait'?'v':'h');
   await f.evaluate(()=>{const t=document.getElementById('cs-ftoast');if(t)t.style.opacity='0';});
   await page.screenshot({path:path.join(SHOTS,'meeting-reserve-'+oh+'-'+size+'.png')});
 }
 console.log('reserve: names and both orientations checked');
 // The normal save path persists the role and page order.
 await f.evaluate(()=>new Promise((resolve,reject)=>{window.__vaultPending.name='리저브 검증';window.__vaultSave({skipSheet:true,after:resolve,onerror:()=>reject(Error('save failed'))});}));
 const saved=await f.evaluate(async()=>{const it=(await libGet()).find(x=>x.name==='리저브 검증');return it;});
 console.log('reserve: saved');assert.equal(saved.slides[1].title,'RESERVE');assert.equal(saved.slides[1].snap.players[0].meetingRole,'reserve');
 await f.evaluate(id=>window.__vaultOpenMeeting(id),saved.libId);await f.waitForFunction(()=>!window.__ksNav);
 assert.equal(await f.evaluate(()=>anim.slides[1].snap.players[0].name),'리저브 선수');
 assert.equal(await f.evaluate(()=>meetingPdfSlides().length),10);
 // Legacy meetings keep their original pages until explicit insertion. Insert from another page too.
 const legacy={...saved,libId:'VRESERVELEGACY',slides:saved.slides.filter(s=>s.title!=='RESERVE')};
 await f.evaluate(async s=>{const lib=await libGet();lib.unshift(s);await libWrite(lib);await window.__vaultOpenMeeting(s.libId);},legacy);await f.waitForFunction(()=>!window.__ksNav);
 assert.equal(await f.evaluate(()=>anim.slides.length),9);
 await f.evaluate(()=>window.__meet.go(4));await f.waitForFunction(()=>!window.__ksNav);
 const before=await f.evaluate(()=>{window.__meet.saveCur();return JSON.stringify(anim.slides,(k,v)=>k==='thumb'?undefined:v);});
 await f.click('#psMeetReserveAdd');await f.waitForFunction(()=>anim.slides.length===10&&!window.__ksNav);
 assert.equal(await f.evaluate(()=>window.__meet.idx()),1);
 assert.equal(await f.evaluate(()=>JSON.stringify(anim.slides.filter(s=>!PSMeetReserve.isReserve(s)),(k,v)=>k==='thumb'?undefined:v)),before,'inserting preserves all existing pages');
 assert.equal(await f.evaluate(()=>window.__meetAddReserve()),false,'no duplicate insertion');
 await f.evaluate(()=>{window.__meet.del(1);PSMeetCover.add();});await f.waitForFunction(()=>!window.__ksNav);
 await f.click('#psMeetReserveAdd');await f.waitForFunction(()=>!window.__ksNav);
 assert.deepEqual(await f.evaluate(()=>anim.slides.slice(0,3).map(s=>s.title)),['표지','BEST 11','RESERVE'],'insertion while cover is selected still follows BEST');
 assert.equal(await f.evaluate(()=>JSON.stringify(window.__psPages.pg(),(k,v)=>k==='thumb'?undefined:v)),work,'private work board unchanged');
 await f.evaluate(()=>document.getElementById('vCreateCancel').click());
 await f.evaluate(async s=>{const lib=await libGet();s.createdBy=psMyUid();s.libId+='RO';lib.unshift(s);await libWrite(lib);window.psMyUid=()=>'99999999-9999-4999-8999-999999999999';await window.__vaultOpenMeeting(s.libId);},legacy);await f.waitForFunction(()=>!window.__ksNav);
 assert.equal(await f.locator('#psMeetReserveAdd').count(),0);assert.equal(await f.evaluate(()=>window.__meetAddReserve()),false);
 assert.equal(await f.evaluate(()=>anim.slides.length),9);
 assert.deepEqual(logs.filter(l=>l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text)),[]);
 console.log('meeting-reserve ok',engine,size);
}finally{for(const b of Object.values(browsers))await b.close();await fx.close();}
