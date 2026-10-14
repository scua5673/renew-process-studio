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

/* board.html 부팅 안전장치 — 실제 코드 조각을 그대로 돌린다 */
const bootSnippet=()=>{const b=R('studio/board.html'),m=b.match(/window\.__tiltBootSafe=false;[\s\S]*?\n\} \}catch\(_\)\{\}\n/);assert.ok(m,'board boot guard snippet');return m[0];};
function boot(init,{now=1e12,search='',run=()=>{}}={}){
  const ls=store(init),timers=[],listeners={},toasts=[],win={};
  const ctx={localStorage:ls,location:{search},Date:{now:()=>now},toast:m=>toasts.push(m),
    setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},clearTimeout:()=>{},
    document:{hidden:false,addEventListener:(t,f)=>{(listeners['doc:'+t]=listeners['doc:'+t]||[]).push(f);},removeEventListener:(t,f)=>{listeners['doc:'+t]=(listeners['doc:'+t]||[]).filter(x=>x!==f);}}};
  Object.assign(win,{addEventListener:(t,f)=>{(listeners['win:'+t]=listeners['win:'+t]||[]).push(f);},removeEventListener:(t,f)=>{listeners['win:'+t]=(listeners['win:'+t]||[]).filter(x=>x!==f);}});
  ctx.window=win;Object.assign(ctx,{addEventListener:win.addEventListener});
  /* window.* 와 맨 이름 window.addEventListener 를 같은 곳으로 */
  vm.runInNewContext(bootSnippet(),ctx);run(ctx,timers,listeners);
  return {ls:ls.dump(),safe:win.__tiltBootSafe,timers,listeners,toasts,ctx};
}

test('3.033 a 3D boot leaves a mark that is cleared once it survives 20 s, leaves normally or is hidden',()=>{
  const b=boot({ps_board_tilt3d:'1'});
  assert.equal(b.safe,false);assert.equal(b.ls.ps_tilt3d_boot,String(1e12),'mark written before the stadium is drawn');
  assert.deepEqual(b.timers.map(t=>t.ms),[20000]);
  b.timers[0].f();assert.equal(b.ctx.localStorage.getItem('ps_tilt3d_boot'),null,'survived 20 s → cleared');
  const left=boot({ps_board_tilt3d:'1'});left.listeners['win:pagehide'][0]();assert.equal(left.ctx.localStorage.getItem('ps_tilt3d_boot'),null,'reload / leaving → cleared');
  const hidden=boot({ps_board_tilt3d:'1'});hidden.ctx.document.hidden=true;hidden.listeners['doc:visibilitychange'][0]();assert.equal(hidden.ctx.localStorage.getItem('ps_tilt3d_boot'),null,'went to background → cleared');
  assert.equal(boot({ps_board_tilt3d:'0'}).ls.ps_tilt3d_boot,undefined,'flat boot: no mark');
  assert.equal(boot({}).ls.ps_tilt3d_boot,undefined);
});

test('3.033 a mark left by a 3D boot that died opens the next boot flat and says so',()=>{
  const b=boot({ps_board_tilt3d:'1',ps_tilt3d_boot:String(1e12-8000)});
  assert.equal(b.safe,true);assert.equal(b.ls.ps_board_tilt3d,'0','this boot is flat');assert.equal(b.ls.ps_tilt3d_boot,undefined);
  assert.equal(b.toasts.length,0,'not yet');b.timers[0].f();   /* 1.6초 뒤, 작전판이 보이면(여기선 iframe 이 아님) — 짧은 알림을 네 번 이어 6초쯤 */
  assert.deepEqual(b.timers.slice(1).map(t=>t.ms),[0,1500,3000,4500]);b.timers.slice(1).forEach(t=>t.f());
  assert.equal(b.toasts.length,4);assert.match(b.toasts[0],/평면으로 열었어요 · 보드 설정 › 보드 보기에서 다시 켤 수 있어요/);
  assert.ok(b.ctx.window.__tiltBootSafeShown>0);
  const old=boot({ps_board_tilt3d:'1',ps_tilt3d_boot:String(1e12-11*60000)});
  assert.equal(old.safe,false,'a mark older than 10 minutes is not a crash loop');assert.equal(old.ls.ps_board_tilt3d,'1');assert.equal(old.ls.ps_tilt3d_boot,String(1e12));
  const side=boot({ps_board_tilt3d:'1',ps_tilt3d_boot:String(1e12-1000)},{search:'?community_view=1&v=265'});
  assert.equal(side.safe,false,'a side board (community view) neither trips nor writes the mark');assert.equal(side.ls.ps_tilt3d_boot,String(1e12-1000));assert.equal(side.ls.ps_board_tilt3d,'1');
});

test('3.033 the guard runs right before the 3D boot restore, and turning 3D on arms the same mark',()=>{
  const b=R('studio/board.html');
  const guard=b.indexOf('window.__tiltBootSafe=false;'),restore=b.indexOf('try{ if(localStorage.getItem("ps_board_tilt3d")==="1"){ document.body.classList.add("bc-tilt3d");');
  assert.ok(guard>0&&restore>guard&&restore-guard<3000,'guard sits right above the restore');
  assert.match(b,/window\.__setTilt=function\(on\)\{ on=!!on; var _was=document\.body\.classList\.contains\("bc-tilt3d"\);[\s\S]{0,200}try\{ if\(on&&!_was&&window\.__tiltBootArm\)window\.__tiltBootArm\(\); \}catch\(_\)\{\}/);
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
