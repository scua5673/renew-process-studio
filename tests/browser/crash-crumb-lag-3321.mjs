import assert from 'node:assert/strict';
import {startFixture,openApp} from '../fixtures/team-app.mjs';
// 3.321 — 데스크톱 탭 종료 기록(3.271 crash-breadcrumb.js)이 «방금 떠난 창»을 죽은 탭으로 보내지 않는다.
//  떠나는 창은 표식을 지우고(localStorage) 잠금을 놓는데, 잠금은 브라우저가 바로 보여 주고 저장소 삭제는 다른 탭(다른 프로세스)의 사본에 늦게 닿는다
//  — CI 크로미움 one-window-3276 이 같은 트리 세 번 중 두 번 boot_after_crash(D:board · D:design) 한 줄로 떨어진 까닭.
//  여기서는 그 «늦게 닿는 삭제»를 그대로 흉내 낸다: 부팅 전에 잠금 없는 표식 둘을 심고(lefttab — 방금 떠난 창 · deadtab — 진짜 죽은 탭),
//  모듈의 첫 잠금 읽기(navigator.locks.query) 뒤 300ms 에 lefttab 을 지운다. 고치기 전 코드는 첫 읽기로 바로 lefttab(D:lagtest · stage 꼬리 .x2)을 보냈다.
//  기대: boot_after_crash 한 줄 · D:deadtest(실제 종료는 그대로 잡힌다) · 심은 표식 둘 다 걷힘. 크로미움 데스크톱만(모듈이 data-ps-device=desktop 에서만 붙는다).
const engine=process.env.PS_BROWSER_ENGINE||'chromium';
if(engine!=='chromium'){console.log('crash-crumb-lag-3321 skipped',engine,'(desktop chromium only)');process.exit(0);}
const fx=await startFixture(),browsers={};
let cur='';const step=s=>{cur=s;try{fx.setStep(s);}catch(_){}console.log('crash-crumb-lag-3321 '+s);};
const errs=[];
const events=()=>fx.calls.filter(c=>c.p==='/rest/v1/ps_events').flatMap(c=>[].concat(c.body||[])).filter(r=>r&&r.event_name==='boot_after_crash');
try{
  const init={fn:()=>{
    if(window.top!==window||!/\/studio\/app\.html$/.test(location.pathname))return;
    /* 잠금 읽기 세기 · 읽기 뒤 300ms 에 lefttab 삭제 — 문서마다 건다: 셸은 부팅 중 한 번 더 열리는데(첫 문서가 300ms 전에 사라지면 그 문서의 예약은 죽는다 — 3.328 합침 뒤 #898 이 부팅 시각을 바꿔 한 번 그랬다)
       표식이 아직 남아 있으면 어느 문서의 읽기 뒤든 예약한다. 표식 심기는 한 번만 */
    const L=navigator.locks,q=L.query.bind(L),K='ps_crash_lag_queries_v1';
    L.query=function(){const n=+(localStorage.getItem(K)||0)+1;localStorage.setItem(K,String(n));
      if(localStorage.getItem('ps_crash_crumb_v1:lefttab')!=null)setTimeout(function(){localStorage.removeItem('ps_crash_crumb_v1:lefttab');},300);return q();};
    if(localStorage.getItem('ps_crash_lag_test_v1'))return;localStorage.setItem('ps_crash_lag_test_v1','1');
    const now=Date.now(),mark=o=>JSON.stringify(Object.assign({t:now-800,b:now-20000,l:1,s:'load',w:2,x:10,hid:0,v:'lagtest f:fBoard fr3',a:[],h:35,p:35,q:4192,n:null,k:null,g:null,d:'browser 1280x800@1 c4 m16 linux cr151'},o));
    localStorage.setItem('ps_crash_crumb_v1:lefttab',mark({}));
    localStorage.setItem('ps_crash_crumb_v1:deadtab',mark({t:now-45000,v:'deadtest f:fBoard fr3',a:[['board.saveBtn',now-46000]]}));
  },arg:null};
  const {page:A,logs}=await openApp(fx,'desktop',{browsers,init});
  A.on('pageerror',e=>{if(!/ResizeObserver loop/.test(e.message))errs.push(e.message);});
  step('event');
  const t0=Date.now();
  while(Date.now()-t0<20000&&!events().length)await A.waitForTimeout(300);
  await A.waitForTimeout(1500);   /* 둘째 줄이 더 오지 않는지 */
  const ev=events();
  console.log('crash-crumb-lag-3321 boot_after_crash '+JSON.stringify(ev.map(r=>[r.error_code,r.meta.stage,r.meta.age,r.meta.msg]))+' reads='+await A.evaluate(()=>localStorage.getItem('ps_crash_lag_queries_v1'))+' nav='+await A.evaluate(()=>performance.getEntriesByType('navigation')[0]?.type));
  assert.equal(ev.length,1,'죽은 탭 한 줄만 '+JSON.stringify(ev.map(r=>r.error_code)));
  assert.equal(ev[0].error_code,'D:deadtest','삭제가 늦게 닿은 표식(lagtest)이 아니라 남은 표식');
  assert.equal(ev[0].meta.stage,'loadw2t10','떠난 창을 세지 않는다(.x2 없음)');
  assert.ok(ev[0].meta.age>=40&&ev[0].meta.age<=70,'age '+ev[0].meta.age);
  assert.equal(ev[0].meta.msg,'board.saveBtn~1');
  step('reads');
  assert.ok(+(await A.evaluate(()=>localStorage.getItem('ps_crash_lag_queries_v1')))>=2,'첫 읽기 뒤 한 번 더 읽는다');
  step('cleared');
  const keys=await A.evaluate(()=>({keys:Object.keys(localStorage).filter(k=>k.indexOf('ps_crash_crumb_v1:')===0),mine:'ps_crash_crumb_v1:'+PSCrashCrumb.id}));
  assert.deepEqual(keys.keys.filter(k=>k!==keys.mine),[],'심은 표식 둘 다 걷힘(deadtab 은 보내며 · lefttab 은 떠난 창이 지움)');
  assert.deepEqual(await A.evaluate(()=>PSCrashCrumb.check()),{dead:0,stale:0});
  step('errors');
  for(const l of logs)if(l.type==='pageerror'&&!/ResizeObserver loop/.test(l.text))errs.push(l.text);
  assert.deepEqual(errs,[],'페이지 오류 없음');
  console.log('crash-crumb-lag-3321 ok',engine);
}catch(e){console.error('crash-crumb-lag-3321 실패 단계:',cur);console.error(e);process.exitCode=1;}
finally{for(const b of Object.values(browsers))try{await b.close();}catch(_){} await fx.close();}
