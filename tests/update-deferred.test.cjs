'use strict';
/* 2.925 — 새 판을 받았는데 10분 넘게 새로고침을 못 하면 «어디서 막혔나»를 운영 기록(update_deferred)에 남긴다.
   (10/1 실측: 옛 판 컴퓨터 몇 대가 탭을 하루 넘게 연 채 새 판을 못 받았는데, 어느 화면이 막았는지 기록이 없었다.) */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const code=app.slice(app.indexOf('function psReloadWorkspaceSeal(){'),app.indexOf('/* ⚠ 2.395'))+'\n'+app.slice(app.indexOf('function psUpdateStatus('),app.indexOf('</script>',app.indexOf('function psUpdateStatus(')));
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(opt={}){
  let now=Date.UTC(2026,9,1,3,0,0);
  class FakeDate extends Date{static now(){return now;}}
  const data=new Map([['ps_active_ws','team-a'],['ps_cache_owner_v1','owner-a'],['ps_ws_switch_epoch_v1','epoch-a']]);
  const events=[],timers=[],polls=[];let reloads=0;
  const elements={};for(const id of ['updBanner','updNow','updLater','updMessage'])elements[id]={style:{display:'none'},textContent:'',addEventListener(){}};
  const frames=(opt.frames||[]).map(f=>({id:f.id,contentDocument:{activeElement:f.active||null,querySelector:()=>f.overlay?{}:null,body:{classList:{contains:()=>false}}}}));
  const c={Date:FakeDate,JSON,Promise,Math,Object,String,
    localStorage:{getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))},
    document:{getElementById:id=>elements[id],hidden:!!opt.hidden,activeElement:opt.shellActive||null,querySelector:()=>null,querySelectorAll:()=>frames,body:{classList:{contains:()=>false}},addEventListener(){}},
    getComputedStyle:()=>({display:'block'}),navigator:{},location:{reload(){reloads++;}},psShowUpdBand(){},
    psFlushAllPendingReady:opt.flush||(async()=>{}),
    PSSync:{event:(name,o)=>events.push({name,...o})},
    setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cancelled=true;},setInterval:fn=>polls.push(fn)};
  c.window=c;vm.createContext(c);vm.runInContext(code,c);
  return {c,events,timers,polls,data,get reloads(){return reloads;},advance(ms){now+=ms;}};
}
test('왜 아직 안 되나 — 셸·화면별 입력 중, 전환 중',()=>{
  let f=fixture({shellActive:{tagName:'INPUT'}});let w={};
  assert.equal(f.c.psSafeToReload(w),false);assert.equal(w.r,'focus_input:shell');
  f=fixture({frames:[{id:'fBoard'},{id:'fScout',active:{tagName:'TEXTAREA'}}]});w={};
  assert.equal(f.c.psSafeToReload(w),false);assert.equal(w.r,'focus_textarea:fScout');
  f=fixture({frames:[{id:'fProcess',overlay:true}]});w={};
  assert.equal(f.c.psSafeToReload(w),false);assert.equal(w.r,'overlay:fProcess');
  f=fixture();f.data.set('ps_ws_switch_guard_v1',JSON.stringify({token:'t',from:'team-a',at:Date.UTC(2026,9,1,3,0,0)}));w={};
  assert.equal(f.c.psSafeToReload(w),false);assert.equal(w.r,'ws_busy');
  f=fixture();assert.equal(f.c.psSafeToReload(),true,'인자 없이 부르던 곳은 그대로');
});
test('10분 전에는 남기지 않고, 10분 넘으면 한 번 — 그 뒤엔 한 시간에 한 번',()=>{
  const f=fixture({frames:[{id:'fScout',active:{tagName:'TEXTAREA'}}]});
  f.c.psAutoReloadWhenSafe();               /* 새 판을 안 시각 + 첫 확인(입력 중이라 미룸) */
  assert.equal(f.events.length,0);assert.equal(f.reloads,0);
  f.advance(9*60000);f.polls[0]();assert.equal(f.events.length,0,'9분 — 아직');
  f.advance(2*60000);f.polls[0]();
  assert.equal(f.events.length,1);
  const e=f.events[0];
  assert.equal(e.name,'update_deferred');assert.equal(e.status,'error');assert.equal(e.error_code,'unsafe:focus_textarea:fScout');
  assert.equal(e.meta.mins,11);assert.equal(e.meta.tries,3);assert.equal(e.meta.hidden,false);
  f.advance(30*60000);f.polls[0]();assert.equal(f.events.length,1,'한 시간 안엔 다시 안 남김');
  f.advance(31*60000);f.polls[0]();assert.equal(f.events.length,2);
});
test('저장 확인이 20초 안에 안 끝나면 — 아직 안 끝난 화면 이름을 단계로',async()=>{
  const f=fixture({hidden:true,flush:track=>{track.pending={fScout:1,fBoard:1};return new Promise(()=>{});}});
  f.c.psAutoReloadWhenSafe();await tick();
  f.advance(11*60000);
  f.timers.find(t=>t.ms===20000).fn();
  assert.equal(f.c.__psReloading,0);assert.equal(f.reloads,0);
  assert.equal(f.events.length,1);assert.equal(f.events[0].error_code,'flush_timeout:fScout+fBoard');
});
test('저장 확인 실패 — 실패한 화면과 코드를 단계로',async()=>{
  const f=fixture({hidden:true,flush:async()=>{const e=new Error('pending');e.psFrame='fBoard';e.psCode='frame_pending';throw e;}});
  f.c.psAutoReloadWhenSafe();await tick();
  assert.equal(f.c.__psUpdState.last,'flush_fail:fBoard:frame_pending');assert.equal(f.events.length,0,'10분 전');
  f.advance(10*60000+5);f.c.__psForceReload();await tick();
  assert.equal(f.events.length,1);assert.equal(f.events[0].error_code,'flush_fail:fBoard:frame_pending');
});
test('막히지 않으면 아무것도 남기지 않고 새로고침',async()=>{
  const f=fixture({hidden:true});f.c.psAutoReloadWhenSafe();await tick();
  assert.equal(f.reloads,1);assert.equal(f.events.length,0);
});
test('새 판 설치 실패는 6시간에 한 번 · 서비스워커가 redundant 일 때만',()=>{
  const f=fixture();
  f.c.psUpdSwFailed();f.c.psUpdSwFailed();
  assert.equal(f.events.length,1);assert.equal(f.events[0].name,'update_sw_failed');
  f.advance(6*3600000+1);f.c.psUpdSwFailed();assert.equal(f.events.length,2);
  assert.match(app,/else if\(nw\.state==="redundant"&&navigator\.serviceWorker\.controller\)\{try\{psUpdSwFailed\(\);\}catch\(_\)\{\}\}/);
});
test('관리자 오류 탭이 두 이벤트를 사람 말로',()=>{
  const admin=fs.readFileSync(path.join(__dirname,'../admin.html'),'utf8');
  assert.match(admin,/event==='update_deferred'\)r=\['새 판 적용 미뤄짐'/);
  assert.match(admin,/event==='update_sw_failed'\)r=\['새 판 설치 실패'/);
  assert.match(admin,/if\(event==='update_deferred'\)return '그 사람에게 앱 탭을 완전히 닫았다가/);
});
