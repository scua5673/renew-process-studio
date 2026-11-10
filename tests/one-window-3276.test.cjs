'use strict';
/* 3.276(PR #770 의 3.261) — 한 기기 한 창(사용자 «가용인원 체크가 잘 안 돼 · 바꿨는데 되돌아가», 풋볼A 주인 맥에 3.233 창이 11/2부터 숨은 채 살아 있었다).
   셸은 창 잠금 하나를 쥐고, 보이는 새 창이 가져가면 먼저 있던 창은 저장 확인을 잠깐 기다린 뒤 안내 화면으로 물러난다.
   실제 두 창은 tests/browser/one-window-3276.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const W=require('../studio/one-window.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const tick=(n=5)=>new Promise(r=>{let i=0;(function go(){if(++i>=n)return r();setImmediate(go);})();});

function fakeWin({hidden=false,top=true,locks=true,off=false,search='?layout=mobile',hash='#view=team'}={}){
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

test('같은 탭이 새 문서로 넘어간 뒤(새로고침) 뺏김을 받으면 — 옛 문서는 아무것도 하지 않는다(새 문서를 덮거나 보내지 않는다)',async()=>{
  /* 브라우저의 window 는 WindowProxy 라 옛 문서의 남은 일이 새 문서를 만진다(WebKit · 3.261 CI 의 덮개) */
  const v=fakeWin();let flushed=0;v.psFlushAllPendingReady=()=>{flushed++;return Promise.resolve();};
  const oldLoc=v.location;const st=W.start(v);await tick();v.lockReqs[0].grant({});await tick();
  const fresh={hidden:false,body:{attrs:{},children:[],getAttribute(){return null;},appendChild(el){this.children.push(el);}},getElementById(){return null;},createElement(){return {style:{},setAttribute(){}};},addEventListener(){}};
  let freshReplaced=null;v.document=fresh;v.location={search:'',hash:'',replace(u){freshReplaced=u;}};
  v.lockReqs[0].steal();await tick(30);
  assert.equal(st.left,false);assert.equal(fresh.body.children.length,0,'새 문서를 덮지 않는다');
  assert.equal(freshReplaced,null);assert.equal(v.replaced,null);assert.equal(flushed,0);assert.equal(v.events.length,0);
  assert.equal(v.ss.get('ps_self_reload'),undefined);
  /* 떠나는 도중에 넘어가도 멈춘다 */
  const m=fakeWin();m.busy=50;const s2=W.start(m,{busyMs:1000});await tick();m.lockReqs[0].grant({});await tick();m.lockReqs[0].steal();await tick();
  assert.equal(m.document.body.children[0].id,'psElsewhereCover','아직 이 문서 — 덮는다');
  m.document={...m.document,body:{attrs:{},children:[],getAttribute(){return null;},appendChild(){}}};m.busy=0;
  await s2.done;assert.equal(s2.mode,'gone');assert.equal(m.replaced,null);assert.equal(m.events.length,0);
});

test('기록이 대기열에 남아 있으면 나갈 때까지(최대 sendMs) 기다렸다 떠난다',async()=>{
  const v=fakeWin();v.psFlushAllPendingReady=()=>Promise.resolve();
  v.PSSync={event(n){v.ls.set('ps_event_queue_v2',JSON.stringify([{row:{event_name:n}}]));setTimeout(()=>v.ls.set('ps_event_queue_v2','[]'),30);}};
  const st=W.start(v);await tick();v.lockReqs[0].grant({});await tick();v.lockReqs[0].steal();await tick(10);
  assert.equal(v.replaced,null,'아직 대기열에 있다');await st.done;assert.equal(v.replaced,'elsewhere.html');
  const t=fakeWin();t.PSSync={event(n){t.ls.set('ps_event_queue_v2',JSON.stringify([{row:{event_name:n}}]));}};
  const s2=W.start(t,{sendMs:30});await tick();t.lockReqs[0].grant({});await tick();t.lockReqs[0].steal();await tick();await s2.done;assert.equal(t.replaced,'elsewhere.html','못 보내도 떠난다');
});

test('로그인에서 돌아온 창(#access_token)은 응답이 주소에서 지워질 때까지 물러나지 않는다 — 안내 화면으로 가며 토큰을 버리지 않는다(3.272 oauth-gate)',async()=>{
  /* 숨은 채 열린 콜백 창 — 다른 창이 쥐고 있어도 sync.js consumeHash 가 받고(또는 거절하고) 주소를 지운 뒤에 떠난다 */
  const h=fakeWin({hidden:true,hash:'#access_token=a.b.c&refresh_token=r'});
  const st=W.start(h,{authMs:2000});await tick();h.lockReqs[0].grant(null);await tick(30);
  assert.equal(st.reason,'hidden_busy');assert.equal(h.replaced,null,'토큰이 주소에 있는 동안은 떠나지 않는다');assert.equal(h.events.length,0);
  h.location.hash='';await st.done;
  assert.equal(h.replaced,'elsewhere.html');assert.equal(h.ss.get('ps_elsewhere_back'),'app.html?layout=mobile');
  /* 가져가진 창도 같다 — 덮개는 바로, 떠나는 것은 응답을 받은 뒤 */
  const v=fakeWin({hash:'#refresh_token=r&access_token=a'});let flushed=0;v.psFlushAllPendingReady=()=>{flushed++;return Promise.resolve();};
  const s2=W.start(v,{authMs:2000});await tick();v.lockReqs[0].grant({});await tick();v.lockReqs[0].steal();await tick(30);
  assert.equal(v.document.body.children[0].id,'psElsewhereCover');assert.equal(flushed,0);assert.equal(v.replaced,null);
  v.location.hash='';await s2.done;assert.equal(flushed,1);assert.equal(v.replaced,'elsewhere.html');
  /* 끝내 안 지워져도(동기화가 못 읽힘) 한도 뒤엔 떠난다 · 로그인 시작 표식은 건드리지 않는다 */
  const t=fakeWin({hidden:true,hash:'#access_token=x'});t.ls.set('ps_oauth_pending_v1','{"t":1}');t.ss.set('ps_oauth_pending_v1','{"t":1}');
  const s3=W.start(t,{authMs:20});await tick();t.lockReqs[0].grant(null);await s3.done||await tick(30);await tick(30);
  assert.equal(t.replaced,'elsewhere.html');assert.equal(t.ls.get('ps_oauth_pending_v1'),'{"t":1}');assert.equal(t.ss.get('ps_oauth_pending_v1'),'{"t":1}');
  const src=read('studio/one-window.js');assert.ok(!src.includes('ps_oauth_pending_v1')||!/removeItem/.test(src),'표식을 지우는 코드가 없다');
  /* 토큰 없는 보통 해시(#foo)는 기다리지 않는다 */
  assert.equal(await Promise.race([W._auth(fakeWin(),{hash:'#foo=1'},5000).then(()=>'now'),new Promise(r=>setTimeout(()=>r('late'),200))]),'now');
});

test('저장 확인이 보관함 편집(3.273 blocked:vault-edit)으로 거절돼도 떠나고 · 까닭(psWhy)이 기록에 남는다',async()=>{
  const v=fakeWin();v.psFlushAllPendingReady=()=>Promise.reject(Object.assign(new Error('x'),{psFrame:'fBoard',psCode:'board_draft_storage',psWhy:'blocked:vault-edit'}));
  const st=W.start(v);await tick();v.lockReqs[0].grant({});await tick();v.lockReqs[0].steal();await tick(10);await st.done;
  assert.equal(st.flush,'fail:fBoard:board_draft_storage:blocked:vault-edit');assert.equal(v.events[0][1].meta.stage,st.flush);
  assert.ok(st.flush.length<=80,'sync.js safeEventMeta 의 stage 80자 안');
  assert.equal(v.replaced,'elsewhere.html','보통 이동이라 pagehide 가 돈다 — board-vault-draft.js 가 그때 적는다');
  assert.match(read('studio/board-vault-draft.js'),/addEventListener\('pagehide'/);
});

test('탭 종료 기록(3.271 crash-breadcrumb)과 — 잠금 이름이 다르고 · 물러나기 직전 표식을 내려놓는다',()=>{
  const C=require('../studio/crash-breadcrumb.js'),crumb=read('studio/crash-breadcrumb.js');
  assert.notEqual(W.LOCK.indexOf(C.LOCK),0);assert.ok(!('ps-crash-check'===W.LOCK));
  assert.match(crumb,/win\.__psBootMarkDone=function\(\)\{disarm\(\);/,'데스크톱의 __psBootMarkDone 은 표식 · 잠금을 내려놓는다');
  assert.match(crumb,/win\.addEventListener\('pagehide',function\(\)\{gone=true;disarm\(\);\}\)/);
  assert.match(read('studio/one-window.js'),/call\(w,'__psBootMarkDone'\);[^\n]*\n\s*loc\.replace\(PAGE\);/,'떠나기 바로 앞에서');
  assert.ok(!read('studio/elsewhere.html').includes('crash-breadcrumb'),'안내 화면은 표식을 만들지 않는다');
});

test('운영 기본은 켬 · 시험 fixture 만 기본으로 끈다(켠 채 보는 시험은 oneWindow:true)',async()=>{
  const v=fakeWin();const st=W.start(v);await tick();assert.notEqual(st.mode,'off','스위치가 없으면 켜진다');assert.equal(v.lockReqs.length,1);
  for(const val of ['1','','off','false']){const w=fakeWin();w.ls.set('ps_one_window',val);assert.notEqual(W.start(w).mode,'off','끄는 값은 "0" 하나: '+JSON.stringify(val));}
  const app=read('studio/app.html'),fxs=read('tests/fixtures/team-app.mjs');
  assert.ok(!app.includes('ps_one_window'),'셸은 스위치를 쓰지 않는다');
  for(const f of ['studio/sync.js','studio/storage.js','studio/account-hygiene.js','studio/update-client.js'])assert.ok(!read(f).includes("'ps_one_window'"),f+' 가 스위치를 켜거나 끄지 않는다');
  assert.match(fxs,/oneWindow=false\}=\{\}\)\{/);assert.match(fxs,/if\(!oneWindow\)\{try\{localStorage\.setItem\('ps_one_window','0'\);\}catch\(_\)\{\}\}/);
  assert.match(read('tests/browser/one-window-3276.mjs'),/openApp\(fx,size,\{browsers,oneWindow:true\}\)/);
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
  assert.ok(read('tests/browser/run-critical.mjs').includes("'one-window-3276'"));
});
