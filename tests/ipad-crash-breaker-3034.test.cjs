const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

/* 3.034 — 아이패드 «'…/studio/app.html'에서 문제가 반복적으로 발생했습니다»가 3.033(작전판 3D 안전장치) 뒤에도 그대로(2026-10-15 운영자 아이패드).
   서버 기록: 쓰다가 한 번 죽고, 사파리가 다시 연 부팅이 4~10초 만에 또 죽었다 — 부팅이 최근 14일에 연 탭 아홉을 6.4초 안에 다 띄웠다.
   셸 안전장치: 보이는 동안 «살아 있음»을 적고 숨겨지거나 떠나면 지운다. 다음 부팅이 그 표시를 보면 가볍게(미리 띄우기 없음 · 작전판 평면) 연다. */
const app=R('studio/app.html');
const START='<script>/* 3.034 — 셸 강제 종료 안전장치',END='}catch(_){ window.__psSafeBoot=false; } })();</script>';
const snippet=()=>{const i=app.indexOf(START),j=app.indexOf(END,i);assert.ok(i>0&&j>i,'shell breaker snippet');return app.slice(app.indexOf('*/',i)+2,j+END.length-'</script>'.length);};
function store(init={},full){const m=new Map(Object.entries(init));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>{if(full&&k==='ps_boot_mark_v1')throw new Error('QuotaExceededError');m.set(k,String(v));},removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)};}
function boot({device='ipad',local={},session={},now=1e12,full=false,board=null}={}){
  const ls=local.getItem?local:store(local,full),ss=session.getItem?session:store(session),timers=[],listeners={};let t=now;
  const fb=board||{contentWindow:{},getBoundingClientRect:()=>({width:0})};
  const doc={hidden:false,documentElement:{getAttribute:k=>k==='data-ps-device'?device:null},body:{classList:{contains:c=>c==='ps-booting'}},
    getElementById:id=>id==='fBoard'?fb:null,addEventListener:(n,f)=>{(listeners['doc:'+n]=listeners['doc:'+n]||[]).push(f);}};
  const win={addEventListener:(n,f)=>{(listeners['win:'+n]=listeners['win:'+n]||[]).push(f);}};
  const ctx={window:win,document:doc,localStorage:ls,sessionStorage:ss,getComputedStyle:()=>({visibility:'visible'}),Math,JSON,Object,Array,
    Date:{now:()=>t},setTimeout:(f,ms)=>{timers.push({f,ms,kind:'t'});return timers.length;},clearTimeout:()=>{},setInterval:(f,ms)=>{timers.push({f,ms,kind:'i'});return timers.length;},clearInterval:()=>{}};
  vm.runInNewContext(snippet(),ctx);
  return {ls,ss,win,doc,fb,timers,fire:(k,e)=>(listeners[k]||[]).forEach(f=>f(e||{})),adv:ms=>{t+=ms;},marks:()=>JSON.parse(ls.getItem('ps_boot_mark_v1')||'{}')};
}

test('3.034 desktops are left alone — no mark, no light boot',()=>{
  const e=boot({device:'desktop',local:{ps_boot_mark_v1:JSON.stringify({other:1e12-3000})}});
  assert.equal(e.win.__psSafeBoot,false);assert.equal(e.timers.length,0);
  assert.deepEqual(e.marks(),{other:1e12-3000},'a desktop does not touch the marks');
});

test('3.034 an iPad marks this tab while it is on screen and refreshes the mark every minute',()=>{
  const e=boot();const tab=e.ss.getItem('ps_tilt3d_tab');
  assert.ok(tab,'tab id kept per tab (same id as the board 3D guard)');assert.equal(e.win.__psSafeBoot,false,'first boot is a normal boot');
  assert.deepEqual(e.marks(),{[tab]:1e12});
  const beat=e.timers.find(x=>x.kind==='i');assert.equal(beat.ms,60000);
  e.adv(60000);beat.f();assert.deepEqual(e.marks(),{[tab]:1e12+60000},'heartbeat');
});

test('3.034 going to the background or leaving normally clears the mark; the next boot is normal',()=>{
  const ls=store(),ss=store();
  const a=boot({local:ls,session:ss});a.doc.hidden=true;a.fire('doc:visibilitychange');assert.equal(ls.getItem('ps_boot_mark_v1'),null,'hidden → cleared');
  a.doc.hidden=false;a.fire('doc:visibilitychange');assert.ok(a.marks()[ss.getItem('ps_tilt3d_tab')],'back in front → marked again');
  a.fire('win:pagehide');assert.equal(ls.getItem('ps_boot_mark_v1'),null,'reload / leave → cleared');
  const b=boot({local:ls,session:ss,now:1e12+5000});assert.equal(b.win.__psSafeBoot,false,'nothing left → normal boot');
  b.fire('win:pageshow',{persisted:true});assert.ok(b.marks()[ss.getItem('ps_tilt3d_tab')],'restored from the back-forward cache → marked again');
});

test('3.034 a page that died while on screen opens the next boot light: no warm tabs, flat board, and it says so on the board',()=>{
  const ls=store({ps_board_tilt3d:'1'}),ss=store();
  const a=boot({local:ls,session:ss});const tab=ss.getItem('ps_tilt3d_tab');
  /* 강제 종료: pagehide 도 visibilitychange 도 오지 않는다 — 표시가 남는다. 사파리가 몇 초 뒤 같은 탭을 다시 연다 */
  const toasts=[],fb={contentWindow:{toast:m=>toasts.push(m)},getBoundingClientRect:()=>({width:900})};
  const b=boot({local:ls,session:ss,now:1e12+9000,board:fb});
  assert.equal(b.win.__psSafeBoot,true);assert.equal(ls.getItem('ps_board_tilt3d'),'0','board opens flat');
  assert.deepEqual(b.marks(),{[tab]:1e12+9000},'this boot is watched too (a second death in a row is still caught)');
  const say=b.timers.find(x=>x.kind==='t'&&x.ms===500);assert.ok(say,'waits while the boot splash is up');
  b.doc.body.classList.contains=()=>false;say.f();
  b.timers.filter(x=>[0,1800,3600].includes(x.ms)).forEach(x=>x.f());
  assert.equal(toasts.length,3);assert.match(toasts[0],/앞에서 앱이 갑자기 닫혀서 이번엔 가볍게 열었어요/);
  const c=boot({local:ls,session:ss,now:1e12+9000+60000});assert.equal(c.win.__psSafeBoot,true,'died again while light → still light');
});

test('3.034 an old mark is not a crash; a new tab that lost its id reads another tab\'s fresh mark as its own',()=>{
  const old=boot({local:{ps_boot_mark_v1:JSON.stringify({T1:1e12-4*60000})},session:{ps_tilt3d_tab:'T1'}});
  assert.equal(old.win.__psSafeBoot,false,'older than 3 minutes (the heartbeat stopped long ago) → normal');assert.deepEqual(old.marks(),{T1:1e12});
  const lost=boot({local:{ps_boot_mark_v1:JSON.stringify({T9:1e12-20000})}});
  assert.equal(lost.win.__psSafeBoot,true,'sessionStorage lost with the crash → still caught');
  assert.deepEqual(Object.keys(lost.marks()),[lost.ss.getItem('ps_tilt3d_tab')],'the dead tab\'s mark is taken over');
  const other=boot({local:{ps_boot_mark_v1:JSON.stringify({T9:1e12-20000})},session:{ps_tilt3d_tab:'T2'}});
  assert.equal(other.win.__psSafeBoot,false,'a known tab does not judge another live tab');assert.deepEqual(other.marks(),{T9:1e12-20000,T2:1e12});
});

test('3.034 a full storage or broken mark never blocks the boot',()=>{
  const full=boot({full:true});assert.equal(full.win.__psSafeBoot,false);
  for(const bad of ['{','[]','null','"x"','7'])assert.equal(boot({local:{ps_boot_mark_v1:bad}}).win.__psSafeBoot,false,bad);
});

test('3.034 the breaker runs before the board frame is given its address, and a light boot warms nothing',()=>{
  assert.ok(app.indexOf(START)>app.indexOf("var _psDev=document.documentElement.getAttribute('data-ps-device')"),'after the 3D default (so «flat» wins)');
  assert.ok(app.indexOf(START)<app.indexOf("fBoard.src='board.html?v='+PS_BUILD"),'before the board loads');
  assert.match(app,/var plan=window\.__psSafeBoot\?\[\]:psWarmPlan\(psWarmLean\(\),psWarmUsed\(\)\);/);
  assert.match(app,/var PS_WARM_LEAN_MAX=2;/);
});
