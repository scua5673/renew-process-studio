const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

/* 3.034 — 아이패드 «'…/studio/app.html'에서 문제가 반복적으로 발생했습니다»가 3.033(작전판 3D 안전장치) 뒤에도 그대로(2026-10-15 운영자 아이패드).
   서버 기록: 쓰다가 한 번 죽고, 사파리가 다시 연 부팅이 4~10초 만에 또 죽었다 — 부팅이 최근 14일에 연 탭 아홉을 6.4초 안에 다 띄웠다.
   셸 안전장치: 보이는 동안 이 탭의 «살아 있음»을 sessionStorage 에 적고 숨겨지거나 떠나면 지운다. 다음 부팅이 그 표시를 보면 이번만 가볍게(미리 띄우기 없음 · 작전판 평면). */
const app=R('studio/app.html'),board=R('studio/board.html');
const START='<script>/* 3.034 — 셸 강제 종료 안전장치',END='}catch(_){ window.__psSafeBoot=false; } })();</script>';
const snippet=()=>{const i=app.indexOf(START),j=app.indexOf(END,i);assert.ok(i>0&&j>i,'shell breaker snippet');return app.slice(app.indexOf('*/',i)+2,j+END.length-'</script>'.length);};
function store(init={},full){const m=new Map(Object.entries(init));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{if(full)throw new Error('QuotaExceededError');m.set(k,String(v));},removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)};}
function boot({device='ipad',local={},session={},now=1e12,full=false,board=null}={}){
  const ls=local.getItem?local:store(local),ss=session.getItem?session:store(session,full),timers=[],listeners={};let t=now;
  const fb=board||{contentWindow:{},getBoundingClientRect:()=>({width:0})};
  const doc={hidden:false,documentElement:{getAttribute:k=>k==='data-ps-device'?device:null},body:{classList:{contains:c=>c==='ps-booting'}},
    getElementById:id=>id==='fBoard'?fb:null,addEventListener:(n,f)=>{(listeners['doc:'+n]=listeners['doc:'+n]||[]).push(f);}};
  const win={addEventListener:(n,f)=>{(listeners['win:'+n]=listeners['win:'+n]||[]).push(f);}};
  const ctx={window:win,document:doc,localStorage:ls,sessionStorage:ss,getComputedStyle:()=>({visibility:'visible'}),isFinite,String,
    Date:{now:()=>t},setTimeout:(f,ms)=>{timers.push({f,ms,kind:'t'});return timers.length;},clearTimeout:()=>{},setInterval:(f,ms)=>{timers.push({f,ms,kind:'i'});return timers.length;},clearInterval:()=>{}};
  vm.runInNewContext(snippet(),ctx);
  return {ls,ss,win,doc,fb,timers,fire:(k,e)=>(listeners[k]||[]).forEach(f=>f(e||{})),adv:ms=>{t+=ms;},mark:()=>ss.getItem('ps_boot_alive_v1')};
}
const K='ps_boot_alive_v1';

test('3.034 desktops are left alone — no mark, no light boot',()=>{
  const e=boot({device:'desktop',session:{[K]:(1e12-3000)+'|1'}});
  assert.equal(e.win.__psSafeBoot,false);assert.equal(e.timers.length,0);assert.equal(e.mark(),(1e12-3000)+'|1','a desktop does not touch the mark');
});

test('3.034 an iPad marks this tab (sessionStorage) while it is on screen and refreshes the mark every minute',()=>{
  const e=boot();
  assert.equal(e.win.__psSafeBoot,false,'first boot is a normal boot');assert.equal(e.mark(),1e12+'|0|shell|0','marked at boot — not loaded yet (3.036: stage · safe level)');
  assert.deepEqual(e.ls.dump(),{},'nothing in localStorage — two windows never read each other, a full localStorage does not matter');
  assert.equal(e.ss.getItem('ps_tilt3d_tab'),null,'the board 3D guard keeps its own tab id (its «new tab» rule still works)');
  const beat=e.timers.find(x=>x.kind==='i');assert.equal(beat.ms,60000);
  e.adv(30000);e.fire('win:load');assert.equal(e.mark(),(1e12+30000)+'|1|load|0','load finished → stamped «loaded»');
  e.adv(30000);beat.f();assert.equal(e.mark(),(1e12+60000)+'|1|load|0','heartbeat');
});

test('3.034 going to the background or leaving normally clears the mark; the next boot is normal',()=>{
  const ss=store();
  const a=boot({session:ss});a.doc.hidden=true;a.fire('doc:visibilitychange');assert.equal(a.mark(),null,'hidden → cleared');
  a.doc.hidden=false;a.fire('doc:visibilitychange');assert.ok(a.mark(),'back in front → marked again');
  a.fire('win:pagehide');assert.equal(a.mark(),null,'reload / leave → cleared');
  const b=boot({session:ss,now:1e12+5000});assert.equal(b.win.__psSafeBoot,false,'nothing left → normal boot');
  b.fire('win:pagehide');b.fire('win:pageshow',{persisted:true});assert.ok(b.mark(),'restored from the back-forward cache → marked again');
});

test('3.034 a page that died while on screen opens the next boot light — this boot only, the 3D choice is kept, and it says so on the board',()=>{
  const ls=store({ps_board_tilt3d:'1'}),ss=store();
  const a=boot({local:ls,session:ss});a.fire('win:load');
  /* 강제 종료: pagehide 도 visibilitychange 도 오지 않는다 — 표시가 남는다. 사파리가 몇 초 뒤 같은 탭을 다시 연다(sessionStorage 는 남는다) */
  const toasts=[],fb={contentWindow:{toast:m=>toasts.push(m),__tiltBootSafe:false},getBoundingClientRect:()=>({width:900})};
  const b=boot({local:ls,session:ss,now:1e12+9000,board:fb});
  assert.equal(b.win.__psSafeBoot,true);assert.equal(ls.getItem('ps_board_tilt3d'),'1','the 3D choice is not changed (the board opens flat for this boot only)');
  assert.equal(b.mark(),(1e12+9000)+'|0|shell|1','this boot is watched too (a second death in a row is still caught) — 3.036: written as safe level 1');
  const say=b.timers.find(x=>x.kind==='t'&&x.ms===500);assert.ok(say,'waits while the boot splash is up');
  b.doc.body.classList.contains=()=>false;say.f();
  b.timers.filter(x=>[0,1800,3600].includes(x.ms)).forEach(x=>x.f());
  assert.equal(toasts.length,3);assert.match(toasts[0],/앞에서 앱이 제대로 닫히지 않아 이번엔 가볍게 열었어요 — 다른 탭은 누를 때 열려요 · 작전판도 이번만 평면/);
  const c=boot({local:ls,session:ss,now:1e12+9000+60000});assert.equal(c.win.__psSafeBoot,true,'died again while light → still light');assert.equal(c.win.__psSafeLevel,2,'3.036: the light boot died too → safe mode');
});

test('3.034 a page that left before its load finished (WebKit sends no pagehide then) boots light once but says nothing',()=>{
  const ss=store();boot({session:ss});   /* load 전에 새로고침 — WebKit 은 pagehide · visibilitychange 를 보내지 않는다: 표시 «…|0» 이 남는다 */
  const toasts=[],fb={contentWindow:{toast:m=>toasts.push(m),__tiltBootSafe:false},getBoundingClientRect:()=>({width:900})};
  const b=boot({session:ss,now:1e12+3000,board:fb});
  assert.equal(b.win.__psSafeBoot,true,'still light (cheap)');
  assert.equal(b.timers.filter(x=>x.kind==='t'&&x.ms===500).length,1,'no «제대로 닫히지 않아» notice — only the 3.036 crash record waits for PSSync');
});

test('3.034 the board 3D guard speaks for itself when 3D was the cause; the shell waits until that guard has run',()=>{
  const ss=store({[K]:(1e12-8000)+'|1'}),toasts=[];
  const fb={contentWindow:{toast:m=>toasts.push(m)},getBoundingClientRect:()=>({width:900})};
  const e=boot({session:ss,board:fb});e.doc.body.classList.contains=()=>false;
  const say=e.timers.find(x=>x.kind==='t'&&x.ms===500);say.f();
  assert.ok(e.timers.filter(x=>x.ms===500).length>=2,'board guard not run yet → keep waiting');assert.equal(toasts.length,0);
  fb.contentWindow.__tiltBootSafe=true;e.timers.filter(x=>x.ms===500).pop().f();
  assert.equal(e.timers.filter(x=>[0,1800,3600].includes(x.ms)).length,0,'the board already says «3D 를 껐어요» — no second notice');
  const f2={contentWindow:{toast:m=>toasts.push(m),__tiltBootSafe:false},getBoundingClientRect:()=>({width:900})};
  const g=boot({local:{ps_board_tilt3d:'0'},session:store({[K]:(1e12-8000)+'|1'}),board:f2});g.doc.body.classList.contains=()=>false;
  g.timers.find(x=>x.ms===500).f();g.timers.filter(x=>x.ms===0).forEach(x=>x.f());
  assert.equal(toasts.at(-1),'앞에서 앱이 제대로 닫히지 않아 이번엔 가볍게 열었어요 — 다른 탭은 누를 때 열려요','flat already → no «평면» tail');
});

test('3.034 an old mark is not a crash; a broken or unwritable mark never blocks the boot',()=>{
  const old=boot({session:{[K]:(1e12-4*60000)+'|1'}});assert.equal(old.win.__psSafeBoot,false,'older than 3 minutes → normal');assert.equal(old.mark(),1e12+'|0|shell|0');
  assert.equal(boot({session:{[K]:(1e12+60000)+'|1'}}).win.__psSafeBoot,false,'a mark from the future is not trusted');
  for(const bad of ['x','','-5','NaN','{}','|1'])assert.equal(boot({session:{[K]:bad}}).win.__psSafeBoot,false,bad);
  assert.equal(boot({session:{[K]:String(1e12-8000)}}).win.__psSafeBoot,true,'a bare time (no flag) still counts');
  const full=boot({full:true,session:{[K]:(1e12-8000)+'|1'}});assert.equal(full.win.__psSafeBoot,true,'an unwritable sessionStorage still reads the mark and goes light');
  assert.equal(boot({full:true}).win.__psSafeBoot,false);
  const other=boot({session:{ps_tilt3d_tab:'T9'}});assert.equal(other.win.__psSafeBoot,false,'a new window never reads another window');
});

test('3.034 the breaker runs before the board frame is given its address, and a light boot warms nothing',()=>{
  assert.ok(app.indexOf(START)>app.indexOf("var _psDev=document.documentElement.getAttribute('data-ps-device')"),'after the 3D default');
  assert.ok(app.indexOf(START)<app.indexOf("fBoard.src='board.html?v='+PS_BUILD"),'before the board loads');
  assert.match(app,/var plan=\(window\.__psSafeBoot\|\|psWarmNone\(\)\)\?\[\]:psWarmPlan\(psWarmLean\(\),psWarmUsed\(\)\);/);   /* 3.059 — 아이패드는 처음부터 미리 띄우지 않는다(psWarmNone) */
  assert.match(app,/var PS_WARM_LEAN_MAX=2;/);
  assert.doesNotMatch(snippet(),/localStorage\.setItem/,'the shell never changes stored settings');
});

/* board.html 3D 안전장치 — 셸이 가볍게 여는 부팅은 이번만 평면(설정은 그대로). 3D 가 원인이었으면(작전판 표시가 남음) 예전처럼 평면으로 저장하고 알린다 */
const bootSnippet=()=>{const b=board,i=b.indexOf('window.__tiltBootSafe=false; window.__tiltBootOk=true;'),j=b.indexOf('try{ if(localStorage.getItem("ps_board_tilt3d")==="1"&&window.__tiltBootOk!==false){');assert.ok(i>0&&j>i);return b.slice(i,j);};
function boardBoot({local={},session={},light=false,top=null}={}){
  const ls=store(local),ss=store(session),timers=[];
  const doc={hidden:false,body:{classList:{contains:()=>false}},addEventListener:()=>{}};
  const win={top:top||{__psSafeBoot:light,document:{documentElement:{getAttribute:k=>k==='data-ps-device'?'ipad':null}}},frameElement:null,addEventListener:()=>{}};
  vm.runInNewContext(bootSnippet(),{window:win,document:doc,localStorage:ls,sessionStorage:ss,location:{search:''},navigator:{maxTouchPoints:5},toast:()=>{},
    Date:{now:()=>1e12},setTimeout:(f,ms)=>{timers.push({f,ms});return 1;},clearTimeout:()=>{},setInterval:()=>1,clearInterval:()=>{}});
  return {ls,win};
}
test('3.034 a light boot opens the board flat for this boot only; a 3D crash still turns 3D off',()=>{
  const l=boardBoot({local:{ps_board_tilt3d:'1'},light:true});
  assert.equal(l.win.__tiltBootOk,false,'flat this boot');assert.equal(l.ls.getItem('ps_board_tilt3d'),'1','3D choice kept');assert.equal(l.ls.getItem('ps_tilt3d_boot'),null,'not armed');assert.equal(l.win.__tiltBootSafe,false);
  const n=boardBoot({local:{ps_board_tilt3d:'1'}});assert.equal(n.win.__tiltBootOk,true,'a normal boot keeps 3D');
  const top={__psSafeBoot:true,document:{documentElement:{getAttribute:k=>k==='data-ps-device'?'ipad':null}}};
  assert.equal(boardBoot({local:{ps_board_tilt3d:'1'},top}).win.__tiltBootOk,false,'first board load of a light boot: flat');
  assert.equal(top.__psSafeBootBoard,true);
  assert.equal(boardBoot({local:{ps_board_tilt3d:'1'},top}).win.__tiltBootOk,true,'the board reloaded in the same shell (iPad rotation) opens as usual — once only');
  const d=boardBoot({local:{ps_board_tilt3d:'1',ps_tilt3d_boot:JSON.stringify({T1:1e12-8000})},session:{ps_tilt3d_tab:'T1'},light:true});
  assert.equal(d.win.__tiltBootSafe,true,'3D was on when it died → the 3.033 rule still applies');assert.equal(d.ls.getItem('ps_board_tilt3d'),'0');
  assert.ok(board.indexOf('    if(light){ window.__tiltBootOk=false; return; }')>board.indexOf('if(died){ window.__tiltBootSafe=true;'),'the 3D rule is checked first');
  /* 첫 작전판이 3D 꺼짐이었거나 3.033 판정이 먼저 돌았어도 한 번은 쓴 것 — 같은 셸에서 다시 읽은 작전판(폰 회전)은 평소대로 */
  const t2={__psSafeBoot:true,document:{documentElement:{getAttribute:k=>k==='data-ps-device'?'ipad':null}}};
  boardBoot({local:{ps_board_tilt3d:'0'},top:t2});assert.equal(t2.__psSafeBootBoard,true,'3D off at the first load still uses it up');
  assert.equal(boardBoot({local:{ps_board_tilt3d:'1'},top:t2}).win.__tiltBootOk,true,'turned 3D on, rotated → 3D');
  const t3={__psSafeBoot:true,document:{documentElement:{getAttribute:k=>k==='data-ps-device'?'ipad':null}}};
  boardBoot({local:{ps_board_tilt3d:'1',ps_tilt3d_boot:JSON.stringify({T1:1e12-8000})},session:{ps_tilt3d_tab:'T1'},top:t3});assert.equal(t3.__psSafeBootBoard,true,'the 3.033 branch first still uses it up');
  assert.equal(boardBoot({local:{ps_board_tilt3d:'1'},top:t3}).win.__tiltBootOk,true);
});

/* 3.059 — 오류 제보 10/16(아이패드 «경기 준비 열기 → 문제가 반복적으로 발생»): 강제 종료 두 번 모두 prevLevel 0 —
   가볍게 연 부팅(단계 1)이 부팅 동기화 뒤 스스로 새로고침하며 표시를 지워, 다음 부팅이 다시 평소(미리 띄우기 둘)로 열렸다. 단계는 그 새로고침을 건너 이어 간다. */
test('3.059 a self-reload of a light boot keeps the next boot light (not reported as a crash), only once and only for 3 minutes',()=>{
  const ss=store();
  boot({session:ss}).fire('win:load');                       // 평소 부팅이 보이는 채 죽음(표시가 남는다)
  const b=boot({session:ss,now:1e12+9000});assert.equal(b.win.__psSafeLevel,1);
  b.win.__psBootMarkDone();b.fire('win:pagehide');            // 부팅 동기화가 바뀐 것을 받아 스스로 새로고침
  assert.equal(b.mark(),null,'the alive mark is cleared as before');assert.equal(ss.getItem('ps_boot_safe_carry_v1'),(1e12+9000)+'|1');
  const c=boot({session:ss,now:1e12+12000});
  assert.equal(c.win.__psSafeBoot,true,'still light after the self-reload');assert.equal(c.win.__psSafeLevel,1);
  assert.equal(ss.getItem('ps_boot_safe_carry_v1'),null,'used once');
  assert.equal(c.timers.filter(x=>x.kind==='t'&&x.ms===500).length,0,'not reported as a crash — no boot_after_crash, no «closed badly» notice');
  c.fire('win:pagehide');                                     // 사용자가 닫음 — 이어 가지 않는다
  assert.equal(boot({session:ss,now:1e12+15000}).win.__psSafeBoot,false,'a normal leave is a normal next boot');
  const ss2=store({ps_boot_safe_carry_v1:(1e12-4*60000)+'|2'});
  assert.equal(boot({session:ss2}).win.__psSafeBoot,false,'older than 3 minutes → normal');
  assert.equal(boot({device:'desktop',session:store({ps_boot_safe_carry_v1:(1e12-1000)+'|2'})}).win.__psSafeBoot,false,'desktops are untouched');
  const ss3=store({ps_boot_safe_carry_v1:(1e12-1000)+'|1'});boot({session:ss3}).fire('win:load');   // 이어받은 부팅이 또 죽으면 → 안전 모드
  assert.equal(boot({session:ss3,now:1e12+9000}).win.__psSafeLevel,2,'a carried light boot that dies escalates to safe mode as before');
});

test('3.069 phones never boot the board in 3D (setting kept, no boot marker)',()=>{
  const top={__psSafeBoot:false,document:{documentElement:{getAttribute:k=>k==='data-ps-device'?'phone':null}}};
  const p=boardBoot({local:{ps_board_tilt3d:'1'},top});
  assert.equal(p.win.__tiltBootOk,false,'flat');assert.equal(p.ls.getItem('ps_board_tilt3d'),'1','3D choice kept');assert.equal(p.ls.getItem('ps_tilt3d_boot'),null,'not armed');
  assert.match(board,/if\(_wrapT&&window\.__setTilt&&window\.PSBoardDepth&&psBoardDevice\(\)!=="phone"\)\{/,'no community 3D button on phones');
});
