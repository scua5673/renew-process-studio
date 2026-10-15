const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const notes=require('../studio/release-notes.js');

/* 3.036 — 안전 모드 + 강제 종료 기록. 3.034(가벼운 부팅) 뒤에도 운영자 아이패드(iPadOS 26.6.1)는 «문제가 반복적으로 발생했습니다» — 서버 기록상 셸이 분에 4~6번 부팅하고
   페이지마다 5~30초, 미리 띄우기 없는 가벼운 부팅도 10~15초 안에 죽었다. 자료는 작다. 서버에선 까닭을 못 본다.
   ① 표시 «시각|다 뜸|단계|안전 단계» — 단계(window.__psBootStage)로 죽은 페이지가 어디까지 갔는지 ② 안전 단계 0/1/2(?safe= 로 강제) ③ 단계 2 = 안전 모드: 작전판을 미리 열지 않고
   안내 판(psSafePanel) ④ 서버에 boot_after_crash 한 건(sync.js always — 5분 억제 비껴감). */
const app=R('studio/app.html'),sync=R('studio/sync.js');
const START='<script>/* 3.034 — 셸 강제 종료 안전장치',END='}catch(_){ window.__psSafeBoot=false; } })();</script>';
const snippet=()=>{const i=app.indexOf(START),j=app.indexOf(END,i);assert.ok(i>0&&j>i,'shell breaker snippet');return app.slice(app.indexOf('*/',i)+2,j+END.length-'</script>'.length);};
const PSTART='<script>/* 3.036 — 안전 모드 판(psSafePanel)',PEND='}catch(_){} })();</script>';
const panelSnippet=()=>{const i=app.indexOf(PSTART),j=app.indexOf(PEND,i);assert.ok(i>0&&j>i,'safe panel snippet');return app.slice(app.indexOf('*/',i)+2,j+PEND.length-'</script>'.length);};
function store(init={},full){const m=new Map(Object.entries(init));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{if(full)throw new Error('QuotaExceededError');m.set(k,String(v));},removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)};}
const K='ps_boot_alive_v1';
/* 3.034 시험의 틀에 location · PSSync · navigator 를 더했다 */
function boot({device='ipad',local={},session={},now=1e12,full=false,board=null,search='',sync=null,nav=null}={}){
  const ls=local.getItem?local:store(local),ss=session.getItem?session:store(session,full),timers=[],listeners={};let t=now;
  const fb=board||{contentWindow:{},getBoundingClientRect:()=>({width:0})};
  const doc={hidden:false,documentElement:{getAttribute:k=>k==='data-ps-device'?device:null},body:{classList:{contains:c=>c==='ps-booting'}},
    getElementById:id=>id==='fBoard'?fb:null,addEventListener:(n,f)=>{(listeners['doc:'+n]=listeners['doc:'+n]||[]).push(f);}};
  const win={addEventListener:(n,f)=>{(listeners['win:'+n]=listeners['win:'+n]||[]).push(f);},removeEventListener:(n,f)=>{listeners['win:'+n]=(listeners['win:'+n]||[]).filter(x=>x!==f);},
    PSSync:sync,navigator:nav||{userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15',hardwareConcurrency:4,deviceMemory:undefined,standalone:true},
    innerWidth:1180,innerHeight:820,devicePixelRatio:2,matchMedia:q=>({matches:false})};
  const hist=[];win.history={state:null,replaceState:(st,t,u)=>hist.push(u)};
  const ctx={window:win,document:doc,localStorage:ls,sessionStorage:ss,getComputedStyle:()=>({visibility:'visible'}),isFinite,String,URL,history:win.history,location:{search,href:'https://x.test/studio/app.html'+search},
    Date:{now:()=>t},setTimeout:(f,ms)=>{timers.push({f,ms,kind:'t'});return timers.length;},clearTimeout:()=>{},setInterval:(f,ms)=>{timers.push({f,ms,kind:'i'});return timers.length;},clearInterval:()=>{}};
  vm.runInNewContext(snippet(),ctx);
  return {ls,ss,win,doc,fb,timers,hist,fire:(k,e)=>(listeners[k]||[]).forEach(f=>f(e||{})),adv:ms=>{t+=ms;},mark:()=>ss.getItem(K),
    polls:()=>timers.filter(x=>x.kind==='t'&&x.ms===500),stageTimers:()=>timers.filter(x=>x.kind==='t'&&[10000,30000,60000].includes(x.ms))};
}
function fakeSync(){const ev=[];return {ev,api:{event:(n,o)=>ev.push({n,o}),state:()=>({kind:'ok'})}};}

test('3.036 safe level: 0 normally, 1 after a death, 2 when the light boot died too — written into the mark',()=>{
  assert.equal(boot().win.__psSafeLevel,0);
  const a=boot({session:{[K]:(1e12-8000)+'|1'}});assert.equal(a.win.__psSafeLevel,1,'old-format mark (no level) → 1');assert.equal(a.win.__psSafeBoot,true);assert.equal(a.mark(),1e12+'|0|shell|1');
  const b=boot({session:{[K]:(1e12-8000)+'|1|t10|0'}});assert.equal(b.win.__psSafeLevel,1,'a normal boot died → light');
  const c=boot({session:{[K]:(1e12-8000)+'|1|t10w0|1'}});assert.equal(c.win.__psSafeLevel,2,'the light boot died → safe mode');assert.equal(c.win.__psSafeBoot,true,'board.html still reads __psSafeBoot');assert.equal(c.mark(),1e12+'|0|shell|2');
  const d=boot({session:{[K]:(1e12-8000)+'|0|boardload|2'}});assert.equal(d.win.__psSafeLevel,2,'safe mode died → safe mode again (never more than 2)');
  const e=boot({session:{[K]:(1e12-4*60000)+'|1|t60|1'}});assert.equal(e.win.__psSafeLevel,0,'an old mark is not a crash');
  assert.equal(boot({session:{[K]:(1e12-8000)+'|1|t10|9'}}).win.__psSafeLevel,1,'a nonsense level reads as 0 → 1');
  assert.equal(boot({session:{[K]:'x|1|t10|1'}}).win.__psSafeLevel,0,'a broken time never trips');
});

test('3.036 ?safe=0|1|2 forces the level for manual experiments; safe=0 also clears the mark; desktops ignore it all',()=>{
  const s=store({[K]:(1e12-8000)+'|1|t10|1'});
  const z=boot({session:s,search:'?safe=0'});assert.equal(z.win.__psSafeLevel,0);assert.deepEqual(z.hist,['/studio/app.html'],'safe is stripped from the address (this boot only)');assert.deepEqual(boot({search:'?mode=player&safe=2#x'}).hist,['/studio/app.html?mode=player#x'],'other params and the hash stay');assert.deepEqual(boot({search:'?mode=player'}).hist,[],'no safe → untouched');assert.equal(z.win.__psSafeBoot,false);assert.equal(z.mark(),1e12+'|0|shell|0','cleared, then this boot marks itself as level 0');
  assert.equal(boot({search:'?x=1&safe=2'}).win.__psSafeLevel,2,'no mark at all, forced');assert.equal(boot({search:'?safe=1#h'}).win.__psSafeLevel,1);
  assert.equal(boot({search:'?safe=3'}).win.__psSafeLevel,0,'unknown value ignored');assert.equal(boot({search:'?unsafe=2'}).win.__psSafeLevel,0);
  const dk=boot({device:'desktop',session:{[K]:(1e12-3000)+'|1|t10|1'},search:'?safe=2'});
  assert.equal(dk.win.__psSafeLevel,0);assert.equal(dk.win.__psSafeBoot,false);assert.equal(dk.timers.length,0);assert.equal(dk.mark(),(1e12-3000)+'|1|t10|1','a desktop does not touch the mark');
  assert.equal(dk.win.__psBootStage,undefined,'nothing exposed on a desktop');
});

test('3.036 the mark carries the boot stage: shell → board → boardload → sync → load → t10/t30/t60, with a w<N> tail; time is kept, hidden pages write nothing',()=>{
  const S=fakeSync(),e=boot({sync:S.api});
  assert.equal(e.mark(),1e12+'|0|shell|0');
  e.adv(1000);e.win.__psBootStage('board');assert.equal(e.mark(),1e12+'|0|board|0','stage replaced, time kept');
  e.win.__psBootStage('boardload');e.win.__psBootStage('w2');assert.equal(e.mark(),1e12+'|0|boardloadw2|0','warmed two tabs');
  e.fire('win:ps-sync-state');assert.equal(e.mark(),1e12+'|0|syncw2|0','PSSync says ok');
  e.adv(1000);e.fire('win:load');assert.equal(e.mark(),(1e12+2000)+'|1|loadw2|0','load stamps the time');
  e.win.__psBootStage('sync');assert.equal(e.mark(),(1e12+2000)+'|1|loadw2|0','a late sync (outbox drained after load) does not step back');
  e.win.__psBootStage('board');assert.equal(e.mark(),(1e12+2000)+'|1|loadw2|0');
  const ts=e.stageTimers();assert.deepEqual(ts.map(x=>x.ms),[10000,30000,60000],'visible-time timers');
  ts[0].f();assert.equal(e.mark(),(1e12+2000)+'|1|loadw2t10|0','seconds on screen ride as a tail');ts[2].f();assert.equal(e.mark(),(1e12+2000)+'|1|loadw2t60|0');
  e.win.__psBootStage('t30');assert.equal(e.mark(),(1e12+2000)+'|1|loadw2t60|0','never less');e.win.__psBootStage('sync');assert.equal(e.mark(),(1e12+2000)+'|1|loadw2t60|0','a late sync keeps load and the 60 s');
  e.win.__psBootStage('bad code!!');assert.equal(e.mark(),(1e12+2000)+'|1|badcodew2t60|0','sanitised (an unknown code is taken as is)');e.win.__psBootStage('');assert.equal(e.mark(),(1e12+2000)+'|1|badcodew2t60|0');
  e.doc.hidden=true;e.fire('doc:visibilitychange');assert.equal(e.mark(),null,'hidden → cleared');
  e.win.__psBootStage('t30');assert.equal(e.mark(),null,'a hidden page writes no mark (a tab iOS tidies in the background is not a death)');
  e.adv(5000);e.doc.hidden=false;e.fire('doc:visibilitychange');assert.equal(e.mark(),(1e12+7000)+'|1|badcodew2t60|0','back in front → marked again with the latest stage');
  const n=boot({sync:{state:()=>({kind:'busy'})}});n.fire('win:ps-sync-state');assert.equal(n.mark(),1e12+'|0|shell|0','not ok yet → no sync stage');
  const old=boot({session:{[K]:String(1e12-8000)}});assert.equal(old.win.__psSafeLevel,1,'a bare time still counts');
});

test('3.036 a boot after a death sends one boot_after_crash record once PSSync exists — payload, always, never throws, capped per tab',()=>{
  const S=fakeSync(),ss=store({[K]:(1e12-12000)+'|1|t10w2|1'});
  const e=boot({session:ss,sync:null});
  assert.equal(e.polls().length,1,'waits for PSSync (sync.js is at the end of the document)');
  e.win.PSSync=S.api;e.adv(500);e.polls()[0].f();
  assert.equal(S.ev.length,1);const {n,o}=S.ev[0];
  assert.equal(n,'boot_after_crash');assert.equal(o.status,'error');assert.equal(o.feature,'app');assert.equal(o.error_code,'L2');assert.equal(o.always,true,'not folded into the 5-minute error dedup');
  assert.deepEqual(JSON.parse(JSON.stringify(o.meta)),{age:12,stage:'t10w2',loaded:1,prevLevel:1,level:2,standalone:true,w:1180,h:820,dpr:2,hc:4,mem:0,ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6 Safari/605.1.15'});
  assert.ok(Object.keys(o.meta).length<=12,'safeEventMeta keeps at most 12 keys');
  assert.equal(e.polls().length,1,'sent once — no more polling');
  assert.equal(ss.getItem('ps_boot_crash_sent_v1'),Math.floor((1e12+500)/3600000)+'|1');
  /* 옛 표시 · 강제 단계 */
  const S2=fakeSync(),f=boot({session:{[K]:(1e12-8000)+'|1'},sync:S2.api});assert.equal(S2.ev[0].o.error_code,'L1');assert.deepEqual([S2.ev[0].o.meta.stage,S2.ev[0].o.meta.prevLevel,S2.ev[0].o.meta.age],['none',0,8]);assert.equal(S2.ev.length,1);assert.equal(f.polls().length,1,'the one 500 ms timer left is the 3.034 toast loop, not a crash-record poll');
  const S3=fakeSync();boot({search:'?safe=2',sync:S3.api});assert.deepEqual([S3.ev[0].o.error_code,S3.ev[0].o.meta.age,S3.ev[0].o.meta.loaded],['L2',-1,0],'forced without a death: age -1');
  const S4=fakeSync();boot({sync:S4.api});assert.equal(S4.ev.length,0,'a normal boot records nothing');
  /* 던지는 PSSync · 60초 한계 · 한 시간 40건 */
  const g=boot({session:{[K]:(1e12-8000)+'|1|load|0'},sync:{event:()=>{throw new Error('x');}}});assert.equal(g.win.__psSafeLevel,1,'a throwing event never breaks the breaker');
  const h=boot({session:{[K]:(1e12-8000)+'|1|load|0'}});for(let i=0;i<130;i++){const p=h.polls();if(!p.length)break;p[p.length-1].f();}
  assert.equal(h.polls().length,121,'gives up after 60 s (120 polls)');
  const S5=fakeSync(),capped=boot({session:{[K]:(1e12-8000)+'|1|load|0',ps_boot_crash_sent_v1:Math.floor(1e12/3600000)+'|40'},sync:S5.api});assert.equal(S5.ev.length,0,'40 in this hour → no more');
  const S6=fakeSync();boot({session:{[K]:(1e12-8000)+'|1|load|0',ps_boot_crash_sent_v1:(Math.floor(1e12/3600000)-1)+'|40'},sync:S6.api});assert.equal(S6.ev.length,1,'a new hour counts afresh');
  const S7=fakeSync(),nav={userAgent:'u'.repeat(300)};boot({session:{[K]:(1e12-8000)+'|1|load|0'},sync:S7.api,nav});assert.equal(S7.ev[0].o.meta.ua.length,140);assert.equal(S7.ev[0].o.meta.hc,0);
  const S8=fakeSync();boot({session:{[K]:(1e12-8000)+'|1|load|0'},sync:S8.api,nav:{userAgent:'x',hardwareConcurrency:8,deviceMemory:4},full:true});assert.equal(S8.ev[0].o.meta.mem,4,'a full sessionStorage still records (cap unwritable → still sends)');
});

/* 안전 모드 판 — 셸이 작전판 주소를 주는 자리와 같은 글 안에서 돈다 */
function panel({level=2,src=null}={}){
  const calls=[],listeners={},els={};
  const el=id=>els[id]||(els[id]={id,hidden:true,src,addEventListener:(n,f)=>{(listeners[id+':'+n]=listeners[id+':'+n]||[]).push(f);}});
  const fb=el('fBoard');fb.hidden=false;
  const doc={getElementById:id=>['psSafePanel','fBoard','psSafeOpen','psSafeNormal'].includes(id)?el(id):null};
  const win={__psSafeLevel:level,PS_BUILD:'9.999',__psFinishBoot:()=>calls.push('finishBoot'),__psBootStage:c=>calls.push('stage:'+c)};
  const loc={search:'?mode=player&safe=2#x',pathname:'/studio/app.html',href:''};
  vm.runInNewContext(panelSnippet(),{window:win,document:doc,location:loc,setTimeout:(f,ms)=>{calls.push('timeout:'+ms);f();}});
  return {win,els,calls,loc,fire:(k,e)=>(listeners[k]||[]).forEach(f=>f(e||{}))};
}
test('3.036 safe mode: the board frame gets no address at boot, the shell reveals itself at once, the panel is up; «작전판 열기» loads the board the normal way',()=>{
  const p=panel();
  assert.equal(p.win.__psSafeBoardPending,false);assert.equal(p.els.psSafePanel.hidden,true,'quiet until the shell decides');
  p.win.__psSafeModeStart();
  assert.equal(p.win.__psBoardBootReady,true,'finishBoot no longer waits for the board');assert.deepEqual(p.calls,['finishBoot']);
  assert.equal(p.els.fBoard.src,null,'no board.html');assert.equal(p.els.psSafePanel.hidden,false);assert.equal(p.win.__psSafeBoardPending,true);
  p.fire('psSafeOpen:click');
  assert.equal(p.els.fBoard.src,'board.html?v=9.999','the normal boot address');assert.equal(p.els.psSafePanel.hidden,false,'the panel stays while board.html loads');assert.deepEqual([p.els.psSafeOpen.disabled,p.els.psSafeOpen.textContent],[true,'여는 중…']);assert.deepEqual(p.calls,['finishBoot','stage:board']);assert.equal(p.win.__psSafeBoardPending,false);
  p.fire('fBoard:load');assert.equal(p.els.psSafePanel.hidden,true,'down once the board is up');
  assert.equal(p.win.__psSafeOpenBoard(),false,'a second tap does nothing');assert.equal(p.calls.length,2);
  /* 훈련 만들기 탭: 뜬 뒤에 할 일을 받는다 */
  const q=panel();q.win.__psSafeModeStart();let after=0;assert.equal(q.win.__psSafeOpenBoard(()=>after++),true);q.fire('fBoard:load');assert.equal(after,1);assert.equal(q.els.fBoard.src,'board.html?v=9.999');
  /* 평소대로 열기 → app.html?safe=0 (다른 질의는 그대로) */
  q.fire('psSafeNormal:click');assert.equal(q.loc.href,'/studio/app.html?mode=player&safe=0');
  /* 셸 배선 */
  assert.match(app,/if\(!shellSwitchBlocked&&window\.__psSafeLevel>=2\)\{ try\{ window\.__psSafeModeStart\(\); \}catch\(_\)\{\} \}[^\n]*\n    else if\(!shellSwitchBlocked\)try\{\n      fBoard\.src='board\.html\?v='\+PS_BUILD;\n      try\{ if\(window\.__psBootStage\)window\.__psBootStage\('board'\); \}catch\(_\)\{\}/,'the board address is skipped only in safe mode, and stamped as «board» otherwise');
  assert.match(app,/fBoard\.addEventListener\('load',function onBl\(\)\{ if\(!fBoard\.getAttribute\('src'\)\)return; fBoard\.removeEventListener\('load',onBl\); try\{ if\(window\.__psBootStage\)window\.__psBootStage\('boardload'\); \}catch\(_\)\{\} \}\);/,'about:blank of safe mode is not a board load');
  assert.match(app,/function psBoardThen\(fn,ms\)\{ if\(window\.__psSafeBoardPending\)\{ try\{ window\.__psSafeOpenBoard\(fn\); \}catch\(_\)\{\} return; \} psFrameWhenReady\(fBoard,fn,ms\|\|0\); \}/,'relays open the board in safe mode');
  assert.equal((app.match(/psBoardThen\(function\(\)\{/g)||[]).length,8,'eight relay sites: 3 enterCapture · 3 openDrillEditor · openBoardPage · openMeeting');
  assert.ok(app.indexOf("try{ clearTimeout(window.__psBootGuard); clearTimeout(window.__psBootCheck); }catch(_){}")>0,'safe mode cancels the 5 s boot guard');
  const rest=app.replace(/__psBootMarkDone\(\)[;,]location\.reload\(\)/g,'').match(/[\w.]*location\.reload\(\)/g)||[];
  assert.deepEqual(rest,['dockFrame.contentWindow.location.reload()'],'every self reload of the shell clears the alive mark first (the board frame reload is not the shell)');
  assert.match(sync,/function markSelfReload\(\)\{[^\n]*__psBootMarkDone/,'sync.js self reloads too');
  assert.match(app,/if\(app==='design'&&window\.__psSafeBoardPending\)\{ try\{ window\.__psSafeOpenBoard\(function\(\)\{/,'훈련 만들기 opens the board on tap');
  assert.match(app,/var plan=window\.__psSafeBoot\?\[\]:psWarmPlan\(psWarmLean\(\),psWarmUsed\(\)\);/,'safe boots (level ≥ 1) warm nothing');
  assert.match(app,/try\{ if\(window\.__psBootStage\)window\.__psBootStage\('w'\+plan\.length\); \}catch\(_\)\{\}/);
  assert.ok(app.indexOf(PSTART)<app.indexOf('    var bootFinished=false;'),'the panel script runs before the shell boot script');
  assert.ok(app.indexOf('id="psSafePanel" hidden')>0);assert.match(app,/<h2>안전 모드로 열었어요<\/h2><p>앱이 연달아 멈춰서 작전판을 미리 열지 않았어요\. 아래 단추로 열 수 있어요\. 계속 멈추면 아이패드를 다시 시작한 뒤 열어 보세요\.<\/p>/);
  assert.match(app,/id="psSafeOpen">작전판 열기<\/button><button type="button" id="psSafeNormal">평소대로 열기<\/button>/);
  assert.match(app,/#psSafePanel\[hidden\],body:not\(\[data-ps-app="board"\]\) #psSafePanel\{display:none;\}/,'other tabs cover the panel with their own frame');
  assert.doesNotMatch(panelSnippet(),/localStorage/,'the panel changes no stored settings');
});

test('3.036 sync.js: always:true skips the 5-minute error dedup; ua is kept in meta (140 chars)',()=>{
  const a=sync.indexOf('var PINGKEY='),b=sync.indexOf('/* ── 워크스페이스 상태',a);assert.ok(a>=0&&b>a);
  const local=new Map(),requests=[];let now=1e12;
  const ctx=vm.createContext({Promise,Date:{now:()=>now,toString:()=>''},Math,JSON,window:{PS_BUILD:'test'},navigator:{onLine:false,userAgent:'iPad'},
    localStorage:{getItem:k=>local.get(k)||null,setItem(k,v){local.set(k,v);}},getSess:()=>({uid:'u',at:'t'}),activeWsObj:()=>({id:'w'}),activeWs:()=>'w',signOutEpoch:0,
    ensureToken:()=>Promise.resolve('t'),BASE:'https://test.invalid',hj:()=>({}),syncDiagnostic(){},fetch(){return new Promise(()=>{});},setTimeout(){}});
  ctx.Date=Object.assign(function(){return {toISOString:()=>'2026-10-15T00:00:00.000Z'};},{now:()=>now});
  vm.runInContext(sync.slice(a,b),ctx);
  const meta={age:12,stage:'t10w2',ua:'u'.repeat(200),loaded:1};
  ctx.eventTrack('boot_after_crash',{status:'error',feature:'app',error_code:'L2',always:true,meta});
  now+=20000;ctx.eventTrack('boot_after_crash',{status:'error',feature:'app',error_code:'L2',always:true,meta});
  const q=ctx.eventQueue();assert.equal(q.length,2,'two boots 20 s apart → two rows');
  assert.equal(q[0].row.error_code,'L2');assert.equal(q[0].row.meta.ua.length,140);assert.equal(q[0].row.meta.stage,'t10w2');assert.equal(q[0].row.meta.age,12);
  ctx.eventTrack('sync_fail',{status:'error',error_code:'x'});ctx.eventTrack('sync_fail',{status:'error',error_code:'x'});
  assert.equal(ctx.eventQueue().length,3,'other errors are still folded');
  ctx.eventTrack('other',{status:'error',error_code:'y',always:'1'});ctx.eventTrack('other',{status:'error',error_code:'y',always:'1'});
  assert.equal(ctx.eventQueue().length,4,'only the boolean true skips the fold');
});

test('3.036 version, cache and release note',()=>{
  const build=app.match(/window\.PS_BUILD='([0-9.]+)'/)[1];
  assert.ok(Number(build)>=3.036);assert.match(R('sw.js'),new RegExp("const CACHE = 'process-"+build.replace('.','\\.')+"';   // "+build.replace('.','\\.')+' '));
  assert.equal((app.match(/\?v=3\.0\d\d/g)||[]).filter(v=>v==='?v='+build).length,7,'the seven shell script/style pins follow the build (3.026 pins are historic)');assert.doesNotMatch(app,/\?v=3\.035/);
  const e=notes.entries().find(x=>x.id==='2026-10-15-v3-036-safe-mode');assert.ok(e);assert.equal(e.changes.length,2);
  assert.match(e.changes[0],/안전 모드/);assert.match(e.changes[0],/작전판 열기/);assert.match(e.changes[1],/멈춘 뒤 다시 연 기록/);
  assert.doesNotMatch(e.changes.join(' '),/고쳤습니다|해결/,'does not promise the crash is fixed');
});
