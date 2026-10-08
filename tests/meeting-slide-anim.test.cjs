'use strict';
/* 2.935 — 미팅 슬라이드마다 장면(애니메이션). 사용자 «미팅자료 만들 때 페이지별 애니메이션도» · «PDF 로 내보내도 재생».
   편집 = 장면 줄이 지금 슬라이드의 장면 · 발표 = 장면부터 넘긴다 · PDF = 장면 1→2→3 스토리보드 · PPT = 움직이는 GIF. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require.resolve('../studio/board.html'),'utf8');
const part=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return src.slice(i,j);};
const dc=v=>JSON.parse(JSON.stringify(v));

/* ── 미팅 장면 묶기(편집·발표) — 실제 함수를 그대로 돌린다 ── */
function meeting(){
  const cls=new Set(['meet-mode']),bar={classList:new Set()};bar.classList.contains=bar.classList.has;
  const raf=[];
  const c=vm.createContext({JSON,Math,
    window:{},document:{body:{classList:{contains:k=>cls.has(k)}},getElementById:id=>id==='animBar'?bar:null},
    anim:{frames:[],slides:[]},animActive:-1,animHold:.6,animPlaying:false,meetIdx:-1,meetRaf:null,undoStack:[1],redoStack:[1],
    state:{x:0},dc,captureSnap(){return {x:c.state.x};},meetCap(){return {x:c.state.x,orientation:'h'};},boardThumbSVG(){return '<svg x="'+c.state.x+'"/>';},
    loadSnap(s){c.state.x=s.x;},renderInterp(a,b,u){c.state.x=a.x+(b.x-a.x)*u;},easeInOut:u=>u,animMoveSpeed:()=>1,
    requestAnimationFrame(f){raf.push(f);return raf.length;},cancelAnimationFrame(){},performance:{now:()=>c.__now},__now:0,
    stopAnim(){},clearOnion(){},renderAnimFrames(){},renderOnion(){},syncAnimTiming(){},updateMotionPaths(){},_animCapShow(){},_applyHl(){},
    autoSaveAnimFrame(){},selectAnimFrame(k){c.animActive=k;c.state.x=c.anim.frames[k].snap.x;},setTimeout(f){f();}});
  vm.runInContext(part('  var meetBound=null,meetSceneRaf=null,meetAutoTok=0;','  /* 2.932 — 슬라이드에 판을 담을 때는'),c);
  c.cls=cls;c.bar=bar;
  c.flushRaf=()=>{let n=0;while(raf.length&&n++<50){c.__now+=1e6;raf.shift()(c.__now);}assert.equal(raf.length,0,'animation settles');};   /* 가짜 시계는 늘 앞으로 */
  return c;
}
const scenes=xs=>xs.map(x=>({snap:{x},dur:1}));

test('a slide with scenes is bound to the scene strip; editing goes into the current scene and the slide keeps scene 1',()=>{
  const c=meeting();
  c.anim.slides=[{snap:{x:10},frames:scenes([10,20,30])},{snap:{x:99}}];
  const to=c.meetBind(0,'first');c.meetIdx=0;
  assert.deepEqual(c.anim.frames.map(f=>f.snap.x),[10,20,30]);assert.equal(c.animActive,0);assert.equal(to.x,10);
  assert.ok(c.bar.classList.has('on'),'scene strip turns on');
  assert.deepEqual([c.undoStack.length,c.redoStack.length],[0,0],'undo never carries another slide into this one');
  c.animActive=1;c.state.x=25;c.meetStore(0,true);
  assert.deepEqual(c.anim.slides[0].frames.map(f=>f.snap.x),[10,25,30],'scene 2 edited');
  assert.equal(c.anim.slides[0].snap.x,10,'slide representative stays scene 1');
  assert.equal(c.anim.slides[0].frames[0].__hold,.6);
  assert.equal(c.anim.slides[0].frames[1].thumb,undefined,'only scene 1 keeps a thumbnail in saved data');
  assert.equal(c.anim.frames[0].snap.x,10,'working copy is separate from saved data');
});

test('switching slides writes the scenes back to the slide object they belong to, even after reordering',()=>{
  const c=meeting();
  const A={snap:{x:1},frames:scenes([1,2])},B={snap:{x:5}};
  c.anim.slides=[A,B];c.meetBind(0);c.meetIdx=0;c.animActive=1;c.state.x=7;c.meetStore(0);
  c.anim.slides=[B,A];   /* 순서를 바꿔도 묶인 것은 객체 */
  c.meetIdx=0;const to=c.meetBind(0,'first');
  assert.deepEqual(A.frames.map(f=>f.snap.x),[1,7]);assert.equal(c.anim.frames.length,0,'plain slide has no scenes');assert.equal(to.x,5);
  c.state.x=9;c.meetStore(0,true);assert.equal(B.snap.x,9,'plain slide still stores the board as before');assert.equal(B.thumb,'<svg x="9"/>');
});

test('scenes down to one turn the slide back into a plain slide',()=>{
  const c=meeting();const A={snap:{x:1},frames:scenes([1,2])};c.anim.slides=[A];c.meetBind(0);c.meetIdx=0;
  c.anim.frames.splice(1,1);c.animActive=0;c.state.x=3;c.meetStore(0);
  assert.equal(A.frames,undefined);assert.equal(A.snap.x,3);
});

test('during the slideshow → steps scenes first, ← walks back, and the board is never stored into the slide',()=>{
  const c=meeting();c.cls.add('focus-board');
  const A={snap:{x:0},frames:scenes([0,100,200])};c.anim.slides=[A,{snap:{x:50}}];
  c.meetIdx=0;c.meetBind(0,'first');
  assert.equal(c.meetSceneStep(1),true);assert.equal(c.animActive,1);c.flushRaf();assert.equal(c.state.x,100);
  c.state.x=123;c.meetStore(0,true);assert.deepEqual(A.frames.map(f=>f.snap.x),[0,100,200],'presenting never edits the scenes');
  assert.equal(c.meetSceneStep(1),true);c.flushRaf();assert.equal(c.state.x,200);
  assert.equal(c.meetSceneStep(1),false,'last scene → next slide');
  assert.equal(c.meetSceneStep(-1),true);assert.equal(c.animActive,1);assert.equal(c.state.x,100,'back is immediate');
  c.meetIdx=1;c.meetBind(1,'first');c.meetIdx=0;assert.equal(c.meetBind(0,'last').x,200,'coming back from the next slide lands on the last scene');
  c.cls.delete('focus-board');assert.equal(c.meetSceneStep(1),false,'arrows step scenes only while presenting');
});

test('↻ replays a slide from scene 1 to the last scene',()=>{
  const c=meeting();c.cls.add('focus-board');c.anim.slides=[{snap:{x:0},frames:scenes([0,10,20])}];c.meetIdx=0;c.meetBind(0,'first');
  c.animActive=2;c.state.x=20;
  let guard=0;c.requestAnimationFrame=f=>{if(guard++>50)throw new Error('runaway');c.__now+=1e6;f(c.__now);return 1;};   /* 장면 사이를 바로 끝까지 */
  c.meetReplay();assert.equal(c.animActive,2);assert.equal(c.state.x,20);
});

test('outside a meeting the work board animation is never touched; leaving restores it',()=>{
  const c=meeting();c.cls.delete('meet-mode');
  c.anim.frames=scenes([5,6]);c.anim.slides=[{snap:{x:1},frames:scenes([1,2])}];
  assert.equal(c.meetBind(0,'first').x,1);assert.deepEqual(c.anim.frames.map(f=>f.snap.x),[5,6]);
  c.cls.add('meet-mode');c.window.__meetAnimStash={a:{frames:scenes([7,8]),active:1,hold:1.2,title:'t',titleColor:'#000'}};
  c.anim.frames=scenes([1,2]);c.meetRestoreBoardAnim();
  assert.deepEqual(c.anim.frames.map(f=>f.snap.x),[7,8]);assert.equal(c.animActive,1);assert.equal(c.animHold,1.2);assert.equal(c.window.__meetAnimStash,null);
});

test('meeting wiring: stash on enter, restore on exit, autosave and live save follow the slide',()=>{
  const enter=part('  window.__bmEnterMeeting=function(){','  window.__bmExitMeeting=');
  assert.match(enter,/var _first=!document\.body\.classList\.contains\("meet-mode"\)/);
  assert.match(enter,/window\.__meetAnimStash=\{a:_a\}/);
  const exit=part('  window.__bmExitMeeting=function(){','window.__meetBoardStash=null;');
  assert.ok(exit.indexOf('meetStore(meetIdx,true)')<exit.indexOf('classList.remove("meet-mode")'),'the current scene is stored before leaving');
  assert.match(exit,/meetRestoreBoardAnim\(\)/);
  assert.match(part('function autoSaveAnimFrame(){','\n'),/\(!document\.body\.classList\.contains\("meet-mode"\)\|\|\(window\.__meetSceneBound&&window\.__meetSceneBound\(\)\)\)/);
  const live=part('function _boardLiveWriteNow(recovery){','var old=_boardPrivateRecord;');
  assert.match(live,/window\.__meetSyncCur\(\)/);
  assert.match(live,/_af=_animToFrames\(_sa\)/,'the work board animation is saved from the stash during a meeting');
  const step=part('  function meetStep(dir){','  window.__meetStep=meetStep;');
  assert.match(step,/^  function meetStep\(dir\)\{\n    if\(meetSceneStep\(dir\)\)return;/);
  assert.match(part('    zL.onclick=','    trSel.querySelector'),/window\.__meetStep\(-1\)[\s\S]*window\.__meetStep\(1\)/);
  assert.match(part('function renderOnion(){','const sc='),/focus-board/,'no onion ghosts while presenting');
});

/* ── PDF 스토리보드 ── */
function pdf(){
  const drawn=[];
  const c=vm.createContext({Intl,encodeURIComponent,Array,JSON,Math,String,window:{__meet:{idx:()=>0}},anim:{slides:[]},dc,
    captureSnap:()=>({id:'live'}),boardThumbSVG:()=>'<svg/>',inkifySVG:s=>s,
    document:{createElement:()=>({getContext:()=>({font:'24px',measureText(t){return {width:Array.from(t).length*10};}})})},
    esc:s=>String(s??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))});
  vm.runInContext(part('function meetingPdfOrientation(slides){','function vaultPrintSpec('),c);
  c.meetingPdfPicture=(s)=>{drawn.push(s.snap&&s.snap.n);return '<svg n="'+(s.snap&&s.snap.n)+'"><rect fill="#15172b"/></svg>';};
  c.drawn=drawn;return c;
}
const fr=n=>Array.from({length:n},(_,k)=>({snap:{n:k+1},cap:k===1?'<b>침투</b>':''}));

test('a slide with scenes prints them 1→2→3 on its page, with captions escaped',()=>{
  const c=pdf();
  for(const orientation of ['landscape','portrait']){
    const html=c.buildMeetingPrintDoc([{title:'빌드업',points:['하나'],snap:{n:1},frames:fr(3)},{title:'수비',snap:{n:9}}],'미팅',{orientation});
    assert.equal((html.match(/class="page mp-page"/g)||[]).length,2);
    assert.equal((html.match(/class="mp-scene"/g)||[]).length,3);
    assert.ok(html.indexOf('장면 1')<html.indexOf('장면 2')&&html.indexOf('장면 2')<html.indexOf('장면 3'));
    assert.ok(html.includes('&lt;b&gt;침투&lt;/b&gt;'));assert.equal(html.includes('<b>침투</b>'),false);
    assert.match(html,/alt="슬라이드 2 운동장"/,'plain slides print as before');
  }
});

test('more than six scenes continue on the next page with the slide title',()=>{
  const c=pdf(),html=c.buildMeetingPrintDoc([{title:'전환',points:['요점'],frames:fr(8)}],'미팅',{orientation:'landscape'});
  const pages=html.split('class="page mp-page"').slice(1);
  assert.equal(pages.length,2);
  assert.equal((pages[0].match(/class="mp-scene"/g)||[]).length,6);assert.equal((pages[1].match(/class="mp-scene"/g)||[]).length,2);
  assert.match(pages[1],/전환 \(이어서\)/);assert.match(pages[1],/data-scene="7"/);
});

test('page view draws only the slide on screen',()=>{
  const c=pdf();c.buildMeetingPrintDoc([{title:'a',snap:{n:1}},{title:'b',frames:fr(3)},{title:'c',snap:{n:5}}],'미팅',{orientation:'landscape',only:1});
  assert.deepEqual(c.drawn,[1,2,3]);
});

test('the scene grid picks the layout that gives the biggest pictures',()=>{
  const c=pdf();
  assert.deepEqual([c.meetingSceneGrid(2,true).c,c.meetingSceneGrid(2,true).r],[1,2],'landscape: stacked');
  assert.deepEqual([c.meetingSceneGrid(2,false).c,c.meetingSceneGrid(2,false).r],[2,1],'portrait: side by side');
  for(let n=1;n<=6;n++)for(const l of [true,false]){const g=c.meetingSceneGrid(n,l);assert.ok(g.c*g.r>=n);}
});

test('PDF slides keep scene 1 as the picture of an animated slide (no live capture over it)',()=>{
  const c=pdf();c.anim.slides=[{title:'a',snap:{n:1},frames:fr(2)}];
  const out=c.meetingPdfSlides();assert.equal(out[0].snap.n,1);
  c.anim.slides=[{title:'b',snap:{n:1}}];assert.equal(c.meetingPdfSlides()[0].snap.id,'live','plain slides still take the unsaved board');
});

/* ── PPT ── */
test('PPT gives animated slides a moving GIF and guards the board while drawing',()=>{
  const ppt=part('function exportPPTX(){','window.__exportPPTX=exportPPTX;');
  assert.match(ppt,/_animExportGuard\(function\(\)\{ return new Promise/);
  assert.match(ppt,/if\(meetingSlideAnimated\(sc\)\)\{ _gifEncode\(sc\.frames,/);
  assert.match(ppt,/"image\/gif;base64,"\+_bytesB64\(g\.bytes\)/);
  assert.match(ppt,/\.catch\(function\(\)\{ __sceneToPng\(sc\.snap,cb\); \}\); return; \}\n      __sceneToPng\(sc\.snap,cb\);/,'falls back to a still picture');
  const gif=part('async function _exportGifRun(target){','let toastT;')   /* 2.969 — 저장 위치(target)를 받는다 */;
  assert.match(gif,/await _gifEncode\(anim\.frames,\{hold:animHold\|\|\.6,fps:25,title:anim\.title,titleColor:anim\.titleColor\}\)/,'board GIF keeps 25fps and its title');
  const c=vm.createContext({btoa:s=>Buffer.from(s,'binary').toString('base64'),String,Math});
  vm.runInContext(part('function _bytesB64(u8){','\nfunction exportPPTX(){'),c);
  const bytes=new Uint8Array(70000).map((_,i)=>i*7%256);
  assert.equal(c._bytesB64(bytes),Buffer.from(bytes).toString('base64'),'large GIFs encode in chunks');
});
