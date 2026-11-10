'use strict';
/* 데스크톱 탭 종료 기록(studio/crash-breadcrumb.js · 제보 de2e508c). app.html 3.034 표식은 폰 · 아이패드만 돌아 맥 크롬 설치 앱의
   «앗, 이런! 오류 코드: 5»가 서버에 한 줄도 안 남았다. 표식 고르기 · meta 꾸리기 · 단추 이름 · 보관함 어림은 순수 함수 — 여기서 그대로 부른다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Crumb=require('../studio/crash-breadcrumb.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const NOW=Date.UTC(2026,10,10,12,0,0);
const mark=over=>({t:NOW-40000,b:NOW-40000-25*60000,l:1,s:'load',w:2,x:60,hid:0,v:'design f:fBoard fr5 3d edit pg4s12',a:[['app-design',NOW-90000],['board.vxOpen',NOW-52000],['board.saveBtn',NOW-41000]],h:1830,p:2410,q:4096,n:82,k:20480,g:3259,d:'fullscreen 2560x1440@2 c10 m8 mac cr141',...over});

test('the old marker stays phone-only and the desktop module is loaded right after it',()=>{
  const app=read('studio/app.html');
  assert.match(app,/window\.__psSafeLevel=0; if\(dev==='desktop'\)return;/,'3.034 marker: phones and iPads only — the reason desktop crashes left no row');
  assert.match(app,/\}catch\(_\)\{ window\.__psSafeBoot=false; \} \}\)\(\);<\/script>\n<script src="crash-breadcrumb\.js"><\/script>/,'loaded in the head, before the shell opens frames');
  assert.ok(read('sw.js').includes("'/studio/crash-breadcrumb.js'"),'precached with the shell');
  const src=read('studio/crash-breadcrumb.js');
  assert.match(src,/getAttribute\('data-ps-device'\)\|\|'desktop'\)==='desktop'\)api\.mount\(root\)/,'mounts on desktop top windows only — phones keep one sender');
  assert.ok(!/\.textContent|\.innerText|\.value\b[^:]|\.href\b/.test(src.replace(/w\.location\.href==='about:blank'/,'').replace(/r&&r\.value/,'')),'never reads text, input values or links');
});

test('pick: a marker whose alive lock is gone is a dead tab; live tabs, my tab and discarded tabs are not',()=>{
  const e=[{id:'aaa',m:mark()},{id:'bbb',m:mark({t:NOW-5000})},{id:'me',m:mark()},{id:'old',m:mark({t:NOW-8*86400000})},{id:'bad',m:null},{id:'disc',m:mark()}];
  const r=Crumb.pick(e,['ps-crash-alive:aaa','process-studio-sync-x'],NOW,{me:1,disc:1});
  assert.deepEqual(r.dead.map(x=>x.id),['bbb'],'only the unlocked marker');
  assert.deepEqual(r.stale.sort(),['bad','old'],'unreadable and week-old markers are dropped without a report');
  const two=Crumb.pick(e,[],NOW,{me:1,disc:1});
  assert.deepEqual(two.dead.map(x=>x.id),['bbb','aaa'],'most recent first');assert.equal(two.report.id,'bbb');
  assert.deepEqual(Crumb.pick(e,null,NOW,{}).dead,[],'without a readable lock list nothing is judged dead');
});

test('meta: twelve slots the event filter keeps — numbers, and text only in stage · reason · msg · mode',()=>{
  const m=Crumb.meta(mark(),NOW,1);
  assert.deepEqual(m,{age:40,min:25,stage:'loadw2t60',reason:'design f:fBoard fr5 3d edit pg4s12',msg:'app-design~50,board.vxOpen~12,board.saveBtn~1',mode:'fullscreen 2560x1440@2 c10 m8 mac cr141',heap:1830,peak:2410,lim:4096,n:82,kb:20480,maxKb:3259});
  assert.equal(Object.keys(m).length,12);
  /* sync.js 의 실제 거르개를 그대로 지난다 */
  const sync=read('studio/sync.js'),at=sync.indexOf('function safeEventMeta(meta){'),end=sync.indexOf('\n}\n',at)+3;
  const safe=vm.runInNewContext('('+sync.slice(at,end)+')');
  assert.deepEqual(JSON.parse(JSON.stringify(safe(m))),m,'nothing is dropped or cut by safeEventMeta');
  assert.equal(Crumb.meta(mark({l:0,hid:1,w:null,x:0,s:'board'}),NOW,3).stage,'board.early.hid.x3','died before load · hidden · three dead markers');
  const none=Crumb.meta({t:NOW,b:NOW},NOW,1);
  assert.deepEqual([none.n,none.kb,none.maxKb,none.heap,none.msg,none.stage],[-1,-1,-1,0,'','none.early'],'unknowns are -1 / 0, never guessed');
  const noisy=Crumb.meta(mark({v:'design <b>김민재</b> "x"',d:'standalone\n<script>',a:Array.from({length:40},(_,i)=>['very-long-control-name-number-'+i,NOW-50000])}),NOW,1);
  assert.ok(noisy.msg.length<=120&&noisy.reason.length<=80&&noisy.mode.length<=80);
  assert.ok(!/[<>"가-힣\n]/.test(noisy.reason+noisy.mode+noisy.msg),'only code-like characters survive');
});

test('codeOf: the name of a pressed control — id, known data attribute, attribute name or first class; never its text',()=>{
  const el=(attrs,text)=>{const self={tagName:'BUTTON',textContent:text||'',closest:()=>self,getAttribute:k=>k==='id'?null:(attrs[k]??null),getAttributeNames:()=>Object.keys(attrs),id:attrs.id||''};return self;};
  assert.equal(Crumb.codeOf(el({id:'psSaveBar'},'홍길동 저장')),'psSaveBar');
  assert.equal(Crumb.codeOf(el({'data-app':'design'},'보관함')),'app-design');
  assert.equal(Crumb.codeOf(el({'data-vx-view':'L1730123456789'},'김민재 프리킥')),'vx-view','an unlisted data attribute gives its name, not its value');
  assert.equal(Crumb.codeOf(el({class:'vx-card on'},'비밀 전술')),'vx-card');
  assert.equal(Crumb.codeOf(el({id:'card_1730123456789_x'})),'card_N_x','long digit runs (record ids) are folded');
  assert.equal(Crumb.codeOf(null),'');
});

test('scan: vault size from the text already read — count, total KB, largest item KB, without parsing',()=>{
  const item=(i,n)=>({libId:'L'+i,name:'자료'+i,snap:{players:[]},overview:'x'.repeat(n)});
  const raw=JSON.stringify([item(1,3000),item(2,900000),item(3,50000)]);
  const s=Crumb.scan(raw);
  assert.equal(s.n,3);assert.equal(s.kb,Math.round(raw.length/1024));
  assert.ok(Math.abs(s.maxKb-879)<=2,'largest ≈ 900,000 characters: '+s.maxKb);
  assert.deepEqual(Crumb.scan('[]'),{n:0,kb:0,maxKb:0});
  assert.deepEqual(Crumb.scan(null),{n:-1,kb:-1,maxKb:-1});
  assert.ok(!/JSON\.parse\(raw\)|\.split\(/.test(Crumb.scan.toString()),'no second copy of a 20MB vault');
});

/* 가짜 창으로 부팅을 돌려 본다: 죽은 탭 표식 → 한 줄, 정상 종료 → 표식 없음 */
function fakeWindow({ls=new Map(),ss=new Map(),held=[],discarded=false,session=true,locks=true}={}){
  const events=[],listeners={},docL={},timers=[];
  const store=m=>({getItem:k=>m.has(k)?m.get(k):null,setItem(k,v){m.set(k,String(v));},removeItem(k){m.delete(k);},key:i=>[...m.keys()][i]??null,get length(){return m.size;}});
  const heldNow=new Set(held);
  const win={navigator:{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',hardwareConcurrency:10,deviceMemory:8,
      ...(locks?{locks:{query:async()=>({held:[...heldNow].map(name=>({name}))}),request:async(name,fn)=>{if(name.startsWith('ps-crash-alive:'))heldNow.add(name);const r=await fn();heldNow.delete(name);return r;}}}:{})},
    document:{hidden:false,wasDiscarded:discarded,documentElement:{getAttribute:()=>'desktop'},body:{getAttribute:k=>k==='data-ps-app'?'board':null,classList:{contains:()=>false}},getElementsByTagName:()=>[],getElementById:()=>null,
      addEventListener(t,f){(docL[t]=docL[t]||[]).push(f);}},
    addEventListener(t,f){(listeners[t]=listeners[t]||[]).push(f);},
    setTimeout(f,ms){timers.push({f,ms});return timers.length;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},
    matchMedia:q=>({matches:/fullscreen/.test(q)}),screen:{width:2560,height:1440},devicePixelRatio:2,performance:{memory:{usedJSHeapSize:900*1048576,jsHeapSizeLimit:4096*1048576}},
    getComputedStyle:()=>({visibility:'visible'}),localStorage:store(ls),sessionStorage:store(ss),
    PSSync:{session:()=>session?{uid:'u'}:null,event:(name,o)=>events.push({name,...o})}};
  win.top=win;
  return {win,ls,ss,events,heldNow,fire:(t,e)=>(listeners[t]||[]).forEach(f=>f(e||{})),fireDoc:(t,e)=>(docL[t]||[]).forEach(f=>f(e||{})),timers};
}
function fresh(){delete require.cache[require.resolve('../studio/crash-breadcrumb.js')];return require('../studio/crash-breadcrumb.js');}
const tick=()=>new Promise(r=>setImmediate(r));

test('boot after a dead tab sends exactly one boot_after_crash and clears the marker; a second boot is quiet',async()=>{
  const ls=new Map([['ps_crash_crumb_v1:dead1',JSON.stringify(mark({t:Date.now()-40000,b:Date.now()-40000-25*60000}))],['ps_crash_crumb_v1:live1',JSON.stringify(mark({t:Date.now()-1000}))],['unrelated','1']]);
  const h=fakeWindow({ls,held:['ps-crash-alive:live1']}),C=fresh();
  C.mount(h.win);await C.checked;await tick();
  assert.equal(h.events.length,1);
  const ev=h.events[0];
  assert.deepEqual([ev.name,ev.status,ev.feature,ev.error_code,ev.always],['boot_after_crash','error','app','D:design',true],'always: not folded into the 5-minute error dedup');
  assert.equal(ev.meta.reason,'design f:fBoard fr5 3d edit pg4s12');assert.equal(ev.meta.kb,20480);assert.ok(ev.meta.age>=40&&ev.meta.age<=42);
  assert.ok(!ls.has('ps_crash_crumb_v1:dead1'),'dead marker cleared');assert.ok(ls.has('ps_crash_crumb_v1:live1'),'another open window is left alone');assert.ok(ls.has('unrelated'));
  const mine=[...ls.keys()].filter(k=>k.startsWith('ps_crash_crumb_v1:')&&k!=='ps_crash_crumb_v1:live1');
  assert.deepEqual(mine,['ps_crash_crumb_v1:'+C.id],'this tab wrote its own marker after taking its lock');
  assert.ok(ls.get(mine[0]).length<700,'tiny');
  assert.match(JSON.parse(ls.get(mine[0])).d,/^fullscreen 2560x1440@2 c10 m8 mac cr141$/);
  /* 정상 종료: pagehide 가 표식과 잠금을 내려놓는다 → 다음 부팅은 조용하다 */
  h.fire('pagehide');await tick();
  assert.deepEqual([...ls.keys()].filter(k=>k.startsWith('ps_crash_crumb_v1:')),['ps_crash_crumb_v1:live1']);
  assert.ok(!h.heldNow.has('ps-crash-alive:'+C.id),'alive lock released');
  const h2=fakeWindow({ls,held:['ps-crash-alive:live1']}),C2=fresh();C2.mount(h2.win);await C2.checked;await tick();
  assert.equal(h2.events.length,0);
});

test('self reload, a discarded tab and a signed-out boot are not reported',async()=>{
  /* 스스로 새로고침(__psBootMarkDone) */
  const a=fakeWindow(),CA=fresh();CA.mount(a.win);await CA.checked;await tick();
  assert.equal([...a.ls.keys()].length,1);a.win.__psBootMarkDone();assert.equal([...a.ls.keys()].length,0,'marker removed before the reload');
  /* 크롬이 버린 탭(메모리 절약)을 다시 연 부팅 */
  const ls=new Map([['ps_crash_crumb_v1:gone',JSON.stringify(mark({t:Date.now()-5000}))]]),ss=new Map([['ps_crash_crumb_v1:tab','gone']]);
  const b=fakeWindow({ls,ss,discarded:true}),CB=fresh();CB.mount(b.win);await CB.checked;await tick();
  assert.equal(b.events.length,0,'document.wasDiscarded is not a crash');assert.ok(!ls.has('ps_crash_crumb_v1:gone'));
  assert.equal(ss.get('ps_crash_crumb_v1:tab'),CB.id,'the tab remembers its own id for the next document');
  /* 로그인 전: 보내지 않는다(세션을 기다린다) */
  const c=fakeWindow({ls:new Map([['ps_crash_crumb_v1:d',JSON.stringify(mark({t:Date.now()-5000}))]]),session:false}),CC=fresh();CC.mount(c.win);await CC.checked;await tick();
  assert.equal(c.events.length,0);
});

test('a full small storage falls back to sessionStorage, read by the next document of the same tab',async()=>{
  const h=fakeWindow();h.win.localStorage.setItem=()=>{throw Object.assign(Error('full'),{name:'QuotaExceededError'});};
  const C=fresh();C.mount(h.win);await C.checked;await tick();
  assert.ok(h.ss.has('ps_crash_crumb_v1'),'marker kept in sessionStorage');
  const next=fakeWindow({ss:h.ss}),C2=fresh();C2.mount(next.win);await C2.checked;await tick();
  assert.equal(next.events.length,1,'the same tab reopened after a death');assert.equal(next.events[0].name,'boot_after_crash');
});

test('phones and iPads keep the 3.034 sender — the module does not mount there',()=>{
  const h=fakeWindow();h.win.document.documentElement.getAttribute=()=>'phone';
  const src=read('studio/crash-breadcrumb.js'),ctx={window:h.win,module:undefined};
  vm.runInNewContext(src.replace("typeof window!=='undefined'?window:null","window"),ctx);
  assert.equal(h.win.__psCrashCrumbMounted,undefined);assert.equal(typeof h.win.PSCrashCrumb,'object','helpers still exist');
  assert.equal([...h.ls.keys()].length,0);
});
