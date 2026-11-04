'use strict';
/* 3.258 — 한 기기 한 창(사용자 «가용인원 체크가 잘 안 돼 · 바꿨는데 되돌아가», 풋볼A 주인 맥에 3.233 창이 11/2부터 숨은 채 살아 있었다).
   셸은 창 잠금 하나를 쥐고, 보이는 새 창이 가져가면 먼저 있던 창은 저장 확인을 잠깐 기다린 뒤 안내 화면으로 물러난다.
   실제 두 창은 tests/browser/one-window-3258.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const W=require('../studio/one-window.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const tick=(n=5)=>new Promise(r=>{let i=0;(function go(){if(++i>=n)return r();setImmediate(go);})();});

function fakeWin({hidden=false,top=true,locks=true,off=false,search='?layout=mobile',hash='#access_token=x'}={}){
  const ss=new Map(),ls=new Map(off?[['ps_one_window','0']]:[]),body={attrs:{'data-ps-app':'board'},children:[],getAttribute(k){return this.attrs[k]||null;},appendChild(el){this.children.push(el);}};
  const w={
    calls:[],replaced:null,events:[],busy:0,
    document:{hidden,body,getElementById(id){return body.children.find(c=>c.id===id)||null;},createElement(){return {style:{},setAttribute(){},id:'',textContent:''};},addEventListener(){}},
    sessionStorage:{setItem(k,v){ss.set(k,String(v));},getItem(k){return ss.has(k)?ss.get(k):null;}},
    localStorage:{getItem(k){return ls.has(k)?ls.get(k):null;}},
    location:{search,hash,replace(u){w.replaced=u;}},
    setTimeout:(f,ms)=>setTimeout(f,Math.min(ms,5)),
    __psTeamSection:()=>'roster',
    __psBootMarkDone(){w.calls.push('bootDone');},
    psReloadWorkspaceBusy(){return w.busy-->0;},
    PSSync:{event(n,o){w.events.push([n,o]);}},
    ss,ls
  };
  w.top=top?w:{};
  if(locks){
    w.lockReqs=[];
    w.navigator={locks:{request(name,opts,cb){const r={name,opts};w.lockReqs.push(r);return new Promise((res,rej)=>{r.grant=v=>Promise.resolve(cb(v)).then(res,rej);r.steal=()=>{const e=new Error('stolen');e.name='AbortError';rej(e);};});}}};
  }else w.navigator={};
  return w;
}

test('보이는 창은 가져가고(steal) · 숨은 창은 비어 있을 때만(ifAvailable)',async()=>{
  const v=fakeWin();const st=W.start(v);await tick();
  assert.equal(v.lockReqs.length,1);assert.equal(v.lockReqs[0].name,'ps-app-window-v1');
  assert.deepEqual(v.lockReqs[0].opts,{mode:'exclusive',steal:true});assert.equal(st.mode,'take');
  v.lockReqs[0].grant({name:'ps-app-window-v1'});await tick();assert.equal(st.mode,'held');assert.equal(v.replaced,null,'쥐고 있으면 그대로');
  const h=fakeWin({hidden:true});W.start(h);await tick();
  assert.deepEqual(h.lockReqs[0].opts,{mode:'exclusive',ifAvailable:true});
});

test('잠금 API 가 없거나 · iframe 안 · 되돌리기 스위치면 예전 그대로',async()=>{
  for(const o of [{locks:false},{top:false},{off:true}]){const w=fakeWin(o);const st=W.start(w);await tick();assert.equal(st.mode,'off',JSON.stringify(o));assert.ok(!w.lockReqs||!w.lockReqs.length);}
});

test('숨은 채 열렸는데 다른 창이 쥐고 있으면 — 뺏지 않고, 저장 확인 없이 안내 화면으로',async()=>{
  const h=fakeWin({hidden:true});let flushed=0;h.psFlushAllPendingReady=()=>{flushed++;return Promise.resolve();};
  const st=W.start(h);await tick();h.lockReqs[0].grant(null);await st.done||await tick(20);await tick(20);
  assert.equal(st.mode,'busy');assert.equal(st.reason,'hidden_busy');assert.equal(flushed,0);assert.equal(h.replaced,'elsewhere.html');
  assert.equal(h.document.body.children.length,0,'숨은 창은 덮지 않는다');
});

test('가져가졌으면 — 덮고 · 전환이 끝나길 기다리고 · 저장 확인 뒤 · 기록 · 안내 화면',async()=>{
  const v=fakeWin();v.busy=3;const order=[];
  v.psFlushAllPendingReady=()=>{order.push('flush:busy='+v.busy);return Promise.resolve();};
  const st=W.start(v,{busyMs:1000});await tick();v.lockReqs[0].grant({});await tick();v.lockReqs[0].steal();await tick();
  assert.equal(v.document.body.children[0].id,'psElsewhereCover','바로 덮는다');
  await st.done;
  assert.equal(st.mode,'stolen');assert.equal(st.flush,'ok');assert.deepEqual(order,['flush:busy=-1'],'전환이 끝난 뒤 저장 확인');
  assert.equal(v.replaced,'elsewhere.html');
  assert.equal(v.events[0][0],'window_elsewhere');assert.equal(v.events[0][1].error_code,'stolen');assert.equal(v.events[0][1].meta.stage,'ok');
  assert.equal(v.ss.get('ps_self_reload'),'1','닫기 정리(wipeTeamCacheSoft)를 건너뛰는 표시');
  assert.equal(v.ss.get('ps_elsewhere_back'),'app.html?layout=mobile','돌아올 곳에 해시(로그인 토큰)를 싣지 않는다');
  assert.deepEqual(JSON.parse(v.ss.get('ps_elsewhere_screen')),{app:'board',team:'roster'});
  assert.deepEqual(v.calls,['bootDone']);
});

test('저장 확인이 실패하거나 늦어도 떠난다(새 창이 이어서 올린다)',async()=>{
  const f=fakeWin();f.psFlushAllPendingReady=()=>Promise.reject(Object.assign(new Error('x'),{psFrame:'fScout',psCode:'sync_local_changed'}));
  let st=W.start(f);await tick();f.lockReqs[0].grant({});await tick();f.lockReqs[0].steal();await st.done||await tick(30);await tick(30);
  assert.equal(st.flush,'fail:fScout:sync_local_changed');assert.equal(f.replaced,'elsewhere.html');
  const t=fakeWin();t.psFlushAllPendingReady=()=>new Promise(()=>{});
  st=W.start(t,{flushMs:20});await tick();t.lockReqs[0].grant({});await tick();t.lockReqs[0].steal();await tick(10);await st.done;
  assert.equal(st.flush,'timeout');assert.equal(t.replaced,'elsewhere.html');
});

test('기록이 대기열에 남아 있으면 나갈 때까지(최대 sendMs) 기다렸다 떠난다',async()=>{
  const v=fakeWin();v.psFlushAllPendingReady=()=>Promise.resolve();
  v.PSSync={event(n){v.ls.set('ps_event_queue_v2',JSON.stringify([{row:{event_name:n}}]));setTimeout(()=>v.ls.set('ps_event_queue_v2','[]'),30);}};
  const st=W.start(v);await tick();v.lockReqs[0].grant({});await tick();v.lockReqs[0].steal();await tick(10);
  assert.equal(v.replaced,null,'아직 대기열에 있다');await st.done;assert.equal(v.replaced,'elsewhere.html');
  const t=fakeWin();t.PSSync={event(n){t.ls.set('ps_event_queue_v2',JSON.stringify([{row:{event_name:n}}]));}};
  const s2=W.start(t,{sendMs:30});await tick();t.lockReqs[0].grant({});await tick();t.lockReqs[0].steal();await tick();await s2.done;assert.equal(t.replaced,'elsewhere.html','못 보내도 떠난다');
});

test('배선 — 셸은 동기화보다 먼저 잠금을 쥔다 · 안내 화면은 아무것도 쓰지 않는다 · 서비스워커가 둘 다 담는다',()=>{
  const app=read('studio/app.html'),ew=read('studio/elsewhere.html'),sw=read('sw.js'),sync=read('studio/sync.js');
  const at=app.indexOf('<script src="one-window.js"></script><script>if(window.PSOneWindow)window.__psOneWindow=PSOneWindow.start(window);</script>');
  assert.ok(at>0&&at<app.indexOf('src="sync.js')&&at<app.indexOf('src="storage.js"'),'셸 머리에서');
  assert.match(app,/function psFlushAllPendingReady\(track\)/,'떠날 때 부르는 저장 확인');assert.match(app,/function psReloadWorkspaceBusy\(\)/);
  assert.match(sync,/SELF_RELOAD='ps_self_reload'|SELF_RELOAD="ps_self_reload"/,'닫기 정리를 건너뛰는 표시 이름');
  assert.match(sync,/function wipeAllowedNow\(\)\{\s*try\{ if\(sessionStorage\.getItem\(SELF_RELOAD\)\)return false;/);
  for(const s of ['sync.js','storage.js','scout','board.html'])assert.ok(!ew.includes(s),'안내 화면은 '+s+' 를 싣지 않는다');
  assert.match(ew,/var LOCK='ps-app-window-v1'/);assert.equal(W.LOCK,'ps-app-window-v1');
  assert.match(ew,/return \/\^app\\\.html\(\\\?\[\^#\]\*\)\?\$\/\.test\(b\)\?b:'app\.html';/,'돌아갈 곳은 app.html 만');
  assert.match(ew,/if\(gone\|\|document\.hidden\|\|/,'숨은 동안은 저절로 열지 않는다');
  assert.match(sw,/'\/studio\/one-window\.js', '\/studio\/elsewhere\.html'/);
  assert.ok(read('tests/browser/run-critical.mjs').includes("'one-window-3258'"));
});
