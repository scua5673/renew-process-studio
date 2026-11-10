import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';
// 빈 날 «일정 ＋» → «팀 공통» → «훈련»이 A팀 세션이 되던 것(studio/schedule-fill-team.js). 팀 공통 · 한 팀 · 여러 팀이 종류를 고른 뒤에도 그대로인지 실제 누름으로 본다.
const require=createRequire(import.meta.url),pw=require(process.env.PS_PLAYWRIGHT_MODULE||'playwright'),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),serve=require('../fixtures/session-team-page.cjs')(root),engine=process.env.PS_BROWSER_ENGINE||'chromium';
const browser=await pw[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.PS_CHROME_PATH||pw.chromium.executablePath()}:{})});
try{
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1180,height:820},hasTouch:true});await context.route('**/*',r=>{if(new URL(r.request().url()).origin!=='https://session-team.invalid')return r.abort();const data=serve(r.request().url());return r.fulfill(data||{status:404,body:''});});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://session-team.invalid/studio/process.html?mode=week',{waitUntil:'domcontentloaded'});
 await page.getByRole('button',{name:'＋ 세션 추가',exact:true}).first().waitFor();
 // 수 · 목 · 금을 «아직 아무것도 없는 날»로(«일정 ＋»가 보인다)
 await page.evaluate(()=>{[2,3,4].forEach(i=>{week[i].board={};week[i].trainings=[];});save();syncViews(false);});
 const sheet=page.locator('#sheet'),open=async di=>{const b=page.locator('button:visible',{hasText:/^일정 ＋$/}).and(page.locator('[onclick*="('+di+'"]'));await b.first().tap();await sheet.locator('#wfSec-grp').waitFor();};
 const grpBtn=name=>sheet.locator('#wfSec-grp').getByRole('button',{name,exact:true}),kind=name=>sheet.locator('#wfSec-kind').getByRole('button',{name,exact:true});
 const state=di=>page.evaluate(di=>({n:week[di].trainings.length,grp:week[di].trainings[0]&&('grp' in week[di].trainings[0]?[].concat(week[di].trainings[0].grp):null),sched:week[di].board&&week[di].board.sched,
   label:document.querySelector('#sheet #wfSec-grp .cnt')?.textContent,on:[...document.querySelectorAll('#sheet #wfSec-grp .fp.on')].map(b=>b.textContent.trim())}),di);
 // ① 팀 공통
 await open(2);assert.equal(await grpBtn('A팀').getAttribute('class'),'fp on','처음엔 첫 조가 골라져 있다');
 await grpBtn('팀 공통').tap();assert.equal(await grpBtn('팀 공통').getAttribute('class'),'fp on');assert.equal((await state(2)).n,0,'고르기만으론 세션이 안 생긴다');
 await kind('훈련').tap();await page.waitForFunction(()=>week[2].trainings.length===1);
 let s=await state(2);assert.deepEqual(s,{n:1,grp:null,sched:'훈련',label:'팀 공통',on:['팀 공통']},'팀 공통이 살아남는다 '+JSON.stringify(s));
 await sheet.getByRole('button',{name:'완료',exact:true}).tap();
 // ② 여러 팀(A팀 + B팀)
 await open(3);await grpBtn('B팀').tap();await kind('훈련').tap();await page.waitForFunction(()=>week[3].trainings.length===1);
 s=await state(3);assert.deepEqual(s.grp,['A팀','B팀']);assert.deepEqual(s.on,['A팀','B팀']);await sheet.getByRole('button',{name:'완료',exact:true}).tap();
 // ③ 한 팀(B팀만)
 await open(4);await grpBtn('A팀').tap();await grpBtn('B팀').tap();await kind('훈련').tap();await page.waitForFunction(()=>week[4].trainings.length===1);
 s=await state(4);assert.deepEqual(s.grp,['B팀']);assert.deepEqual(s.on,['B팀']);await sheet.getByRole('button',{name:'완료',exact:true}).tap();
 // 주간 카드의 표시 · 저장 · 새로고침
 const chips=await page.evaluate(()=>[2,3,4].map(di=>week[di].trainings.map(t=>schedGrpList(t,di).map(schedGroupLabel).join(' · ')||'팀 공통')[0]));
 assert.deepEqual(chips,['팀 공통','A팀 · B팀','B팀']);
 await page.waitForFunction(()=>{const w=JSON.parse(localStorage.getItem('process_coach_v1')).weeks[0];return w[2].trainings.length===1&&!('grp' in w[2].trainings[0])&&w[4].trainings.length===1;});
 await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'＋ 세션 추가',exact:true}).first().waitFor();
 assert.deepEqual(await page.evaluate(()=>[2,3,4].map(di=>week[di].trainings[0].grp||null)),[null,['A팀','B팀'],['B팀']]);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({engine,passed:true,cases:['team-common-survives-kind','multi-team','single-team','reload']}));await context.close();
}finally{await browser.close();}
