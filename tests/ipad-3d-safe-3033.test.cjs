const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const notes=require('../studio/release-notes.js');

/* 3.033 — 아이패드 사파리 «'…/studio/app.html'에서 문제가 반복적으로 발생했습니다»(2026-10-15 운영자 아이패드, 3.031).
   3.027 이 3D 를 켠 적 없는 터치 기기까지 작전판을 3D 경기장으로 열었고, 사파리가 그 화면을 버티지 못해 새로고침을 몇 번 하다 멈췄다. */
function store(init={}){const m=new Map(Object.entries(init));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)};}
const appSnippet=()=>{const a=R('studio/app.html'),m=a.match(/try\{var _psDev=document\.documentElement\.getAttribute\('data-ps-device'\)[\s\S]*?\}catch\(_\)\{\}(?=<\/script>)/);assert.ok(m,'app.html default snippet');return m[0];};
function runApp(device,init){const ls=store(init);vm.runInNewContext(appSnippet(),{localStorage:ls,document:{documentElement:{getAttribute:k=>k==='data-ps-device'?device:null}}});return ls.dump();}

test('3.033 only a mouse desktop starts in 3D; an iPad or phone that never chose stays flat',()=>{
  assert.equal(runApp('desktop',{}).ps_board_tilt3d,'1');
  assert.equal(runApp('ipad',{}).ps_board_tilt3d,undefined,'iPad: nothing chosen → board boots flat (board opens 3D only on «1»)');
  assert.equal(runApp('phone',{}).ps_board_tilt3d,undefined);
  assert.equal(runApp(null,{}).ps_board_tilt3d,'1','no device mark → desktop as before');
  assert.equal(runApp('desktop',{ps_board_tilt3d:'0'}).ps_board_tilt3d,'0','a desktop that chose flat stays flat');
});

test('3.033 the «1» that 3.027-3.032 put on touch devices is turned off once, later choices stay',()=>{
  const once=runApp('ipad',{ps_board_tilt3d:'1'});
  assert.equal(once.ps_board_tilt3d,'0');assert.equal(once.ps_tilt3d_touch_reset_v1,'1');
  assert.equal(runApp('ipad',{ps_board_tilt3d:'1',ps_tilt3d_touch_reset_v1:'1'}).ps_board_tilt3d,'1','turned on again after the reset → kept');
  assert.equal(runApp('phone',{ps_board_tilt3d:'0'}).ps_board_tilt3d,'0');
  assert.equal(runApp('desktop',{ps_board_tilt3d:'1'}).ps_board_tilt3d,'1','desktops are not reset');
  assert.equal(runApp('desktop',{ps_board_tilt3d:'1'}).ps_tilt3d_touch_reset_v1,undefined);
  const a=R('studio/app.html');
  assert.ok(a.indexOf("var _psDev=document.documentElement.getAttribute('data-ps-device')")>a.indexOf("document.documentElement.setAttribute('data-ps-device'"),'device mark is set before');
  assert.ok(a.indexOf("var _psDev=")<a.indexOf('id="fBoard"'),'and before the board frame loads');
});

/* board.html 부팅 안전장치 — 실제 코드 조각을 그대로 돌린다(터치 기기만 · 탭마다 표시 · 작전판이 보인 때부터 20초) */
const bootSnippet=()=>{const b=R('studio/board.html'),i=b.indexOf('window.__tiltBootSafe=false; window.__tiltBootOk=true;'),j=b.indexOf('try{ if(localStorage.getItem("ps_board_tilt3d")==="1"&&window.__tiltBootOk!==false){');assert.ok(i>0&&j>i,'board boot guard snippet');return b.slice(i,j);};
function env({device='ipad',local={},session={},now=1e12,search='',frame=null,full=false}={}){
  const ls=store(local),ss=store(session),timers=[],listeners={},toasts=[];let t=now;
  if(full){const set=ls.setItem;ls.setItem=(k,v)=>{if(k==='ps_tilt3d_boot')throw new Error('QuotaExceededError');set(k,v);};}
  const doc={hidden:false,body:{classList:{contains:c=>c==='bc-tilt3d'&&ls.getItem('ps_board_tilt3d')==='1'}},addEventListener:(n,f)=>{(listeners['doc:'+n]=listeners['doc:'+n]||[]).push(f);}};
  const win={top:{document:{documentElement:{getAttribute:k=>k==='data-ps-device'?device:null}}},frameElement:frame,addEventListener:(n,f)=>{(listeners['win:'+n]=listeners['win:'+n]||[]).push(f);}};
  const ctx={window:win,document:doc,localStorage:ls,sessionStorage:ss,location:{search},navigator:{maxTouchPoints:device==='desktop'?0:5},toast:m=>toasts.push(m),
    Date:{now:()=>t},setTimeout:(f,ms)=>{timers.push({f,ms,kind:'t'});return timers.length;},clearTimeout:()=>{},setInterval:(f,ms)=>{timers.push({f,ms,kind:'i'});return timers.length;},clearInterval:()=>{}};
  vm.runInNewContext(bootSnippet(),ctx);
  return {ls,ss,win,doc,timers,listeners,toasts,fire:k=>(listeners[k]||[]).forEach(f=>f({})),adv:ms=>{t+=ms;},marks:()=>JSON.parse(ls.getItem('ps_tilt3d_boot')||'{}')};
}
const frame=({booting=false,visibility='visible',display='block'}={})=>({ownerDocument:{defaultView:{getComputedStyle:()=>({display,visibility})},body:{classList:{contains:c=>booting&&c==='ps-booting'}}},getBoundingClientRect:()=>({width:800,height:600})});

test('3.033 desktops are left alone: two windows never trip each other',()=>{
  const e=env({device:'desktop',local:{ps_board_tilt3d:'1',ps_tilt3d_boot:JSON.stringify({other:1e12-3000})}});
  assert.equal(e.win.__tiltBootSafe,false);assert.equal(e.win.__tiltBootOk,true);assert.equal(e.ls.getItem('ps_board_tilt3d'),'1');
  assert.equal(e.timers.length,0,'no mark, no timers');assert.equal(e.win.__tiltBootArm(),true);
});

test('3.033 a 3D boot on a touch device marks this tab and clears it 20 s after the board is actually on screen',()=>{
  const fr=frame({booting:true}),e=env({local:{ps_board_tilt3d:'1'},frame:fr});
  const tab=e.ss.getItem('ps_tilt3d_tab');assert.ok(tab,'tab id kept per tab');
  assert.deepEqual(e.marks(),{[tab]:1e12},'mark written before the stadium is drawn');assert.equal(e.win.__tiltBootOk,true);
  const poll=e.timers.find(x=>x.kind==='i');assert.equal(poll.ms,500);
  poll.f();assert.equal(e.timers.filter(x=>x.kind==='t').length,0,'behind the boot splash: the 20 s do not start');
  fr.ownerDocument.body.classList.contains=()=>false;poll.f();
  const t=e.timers.find(x=>x.kind==='t');assert.equal(t.ms,20000,'on screen → 20 s');t.f();
  assert.equal(e.ls.getItem('ps_tilt3d_boot'),null,'survived → cleared');
});

test('3.033 leaving normally or going to the background after being seen clears the mark; coming back watches again',()=>{
  const left=env({local:{ps_board_tilt3d:'1'}});left.fire('win:pagehide');assert.equal(left.ls.getItem('ps_tilt3d_boot'),null);
  const bg=env({local:{ps_board_tilt3d:'1'}});bg.doc.hidden=true;bg.fire('doc:visibilitychange');assert.equal(bg.ls.getItem('ps_tilt3d_boot'),null,'seen (no frame = on screen) then hidden → cleared');
  bg.doc.hidden=false;bg.fire('doc:visibilitychange');assert.ok(bg.marks()[bg.ss.getItem('ps_tilt3d_tab')],'back in front → watched again');
  const early=env({local:{ps_board_tilt3d:'1'},frame:frame({booting:true})});early.doc.hidden=true;early.fire('doc:visibilitychange');
  assert.ok(early.ls.getItem('ps_tilt3d_boot'),'hidden before it was ever on screen → kept');
  assert.equal(env({local:{ps_board_tilt3d:'0'}}).ls.getItem('ps_tilt3d_boot'),null,'flat boot: no mark');
});

test('3.033 this tab\'s mark left by a 3D boot that died opens the next boot flat and says so on screen',()=>{
  const e=env({local:{ps_board_tilt3d:'1',ps_tilt3d_boot:JSON.stringify({T1:1e12-8000})},session:{ps_tilt3d_tab:'T1'}});
  assert.equal(e.win.__tiltBootSafe,true);assert.equal(e.win.__tiltBootOk,false);assert.equal(e.ls.getItem('ps_board_tilt3d'),'0');assert.equal(e.ls.getItem('ps_tilt3d_boot'),null);
  assert.equal(e.toasts.length,0,'not yet');const first=e.timers.find(x=>x.ms===1600);first.f();
  e.timers.filter(x=>[0,1500,3000,4500].includes(x.ms)).forEach(x=>x.f());
  assert.equal(e.toasts.length,4);assert.match(e.toasts[0],/평면으로 열었어요 · 보드 설정 › 보드 보기에서 다시 켤 수 있어요/);assert.ok(e.win.__tiltBootSafeShown>0);
  const old=env({local:{ps_board_tilt3d:'1',ps_tilt3d_boot:JSON.stringify({T1:1e12-11*60000})},session:{ps_tilt3d_tab:'T1'}});
  assert.equal(old.win.__tiltBootSafe,false,'older than 10 minutes is not a crash loop');assert.deepEqual(old.marks(),{T1:1e12});
});

test('3.033 another live tab\'s mark does not trip this tab; a brand-new tab after a dead one does',()=>{
  const second=env({local:{ps_board_tilt3d:'1',ps_tilt3d_boot:JSON.stringify({A:1e12-3000})},session:{ps_tilt3d_tab:'B'}});
  assert.equal(second.win.__tiltBootSafe,false,'a tab that already had an id is another live tab');assert.deepEqual(second.marks(),{A:1e12-3000,B:1e12},'both marks kept');
  second.fire('win:pagehide');assert.deepEqual(second.marks(),{A:1e12-3000},'clearing removes only its own mark');
  const reopened=env({local:{ps_board_tilt3d:'1',ps_tilt3d_boot:JSON.stringify({A:1e12-30000})}});
  assert.equal(reopened.win.__tiltBootSafe,true,'new tab (no id yet) right after a tab died with 3D on');assert.equal(reopened.ls.getItem('ps_tilt3d_boot'),null);
});

test('3.033 side boards open flat on touch devices; a full storage cannot guard so it opens flat',()=>{
  const side=env({local:{ps_board_tilt3d:'1'},search:'?community_view=1&v=265'});
  assert.equal(side.win.__tiltBootOk,false,'community view: flat');assert.equal(side.ls.getItem('ps_board_tilt3d'),'1','setting unchanged');assert.equal(side.ls.getItem('ps_tilt3d_boot'),null);
  const full=env({local:{ps_board_tilt3d:'1'},full:true});
  assert.equal(full.win.__tiltBootOk,false);assert.equal(full.ls.getItem('ps_board_tilt3d'),'1');
});

test('3.033 the guard runs right before the 3D boot restore, which obeys it; turning 3D on arms, off clears',()=>{
  const b=R('studio/board.html');
  const guard=b.indexOf('window.__tiltBootSafe=false; window.__tiltBootOk=true;'),restore=b.indexOf('try{ if(localStorage.getItem("ps_board_tilt3d")==="1"&&window.__tiltBootOk!==false){ document.body.classList.add("bc-tilt3d");');
  assert.ok(guard>0&&restore>guard&&restore-guard<6000,'guard sits right above the restore');
  assert.match(b,/window\.__setTilt=function\(on,opts\)\{ on=!!on; opts=opts\|\|\{\}; var _was=document\.body\.classList\.contains\("bc-tilt3d"\);[\s\S]{0,200}try\{ if\(on&&!_was&&window\.__tiltBootArm\)window\.__tiltBootArm\(\); else if\(!on&&_was&&window\.__tiltBootDone\)window\.__tiltBootDone\(\); \}catch\(_\)\{\}/);
});

test('3.033 iPhone/iPad Safari does not draw the stage-sized 3D light layer',()=>{
  const b=R('studio/board.html');
  assert.match(b,/@supports \(-webkit-touch-callout:none\)\{ html body\.bc-tilt3d #tiltMood\{display:none!important\} \}/);
  assert.ok(b.indexOf('@supports (-webkit-touch-callout:none){ html body.bc-tilt3d #tiltMood')>b.indexOf('body.bc-tilt3d #tiltMood{display:block}'),'after the rule that shows it');
});

test('3.033 version and release note',()=>{
  const app=R('studio/app.html'),sw=R('sw.js');
  const build=app.match(/window\.PS_BUILD='([0-9.]+)'/)[1];
  assert.ok(Number(build)>=3.033);assert.match(sw,new RegExp("const CACHE = 'process-"+build.replace('.','\\.')+"'"));
  const e=notes.entries().find(x=>x.id==='2026-10-15-v3-033-ipad-3d-safe');
  assert.ok(e,'release note');assert.match(e.title,/아이패드에서 앱이 반복해서 닫히던 것/);
  assert.match(e.changes.join(' '),/보드 설정 › 보드 보기/);
});
