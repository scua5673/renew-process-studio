'use strict';
/* 3.325 — 일정에 가져온 작전판(보관함 type:"board") 줄에도 ▶ (제보 5d215b74 · 10/20 bf084b34 에 한 약속).
   일정: studio/schedule-board-play.js(줄 ↔ 페이지 · 장면 수) + process.html 세 줄. 사본 줄이기(schedule-lib-slim.js)는 장면 수(animN)를 남긴다.
   작전판: studio/board-sched-show.js — 보기 전용 미팅 슬라이드쇼로 열고, 쇼가 끝나면 보기를 닫고 일정으로(captureCancel). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../studio/schedule-board-play.js');
const SLIM=require('../studio/schedule-lib-slim.js');
const SHOW=require('../studio/board-sched-show.js');
const root=path.join(__dirname,'..');
const S=fs.readFileSync(path.join(root,'studio/process.html'),'utf8');
const B=fs.readFileSync(path.join(root,'studio/board.html'),'utf8');
const SW=fs.readFileSync(path.join(root,'sw.js'),'utf8');
function cut(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i);assert.ok(i>0&&j>i,a);return src.slice(i,j);}
const fr=n=>Array.from({length:n},(_,i)=>({snap:{i}}));
const J=o=>JSON.parse(JSON.stringify(o));
/* 여러 페이지 작전판 — 둘째 페이지는 이름 없음(«페이지 2»), 셋째는 장면 하나 */
const BOARD=()=>({name:'빌드업 3단계',libId:'B1',type:'board',pages:[
  {name:'1단계',snap:{a:1},anim:{frames:fr(4)}},{name:'',snap:{a:2},anim:{frames:fr(3)}},{name:'마무리',snap:{a:3},anim:{frames:fr(1)}}]});

test('사본 줄이기는 장면 본문을 떼고 장면 수(animN)만 남긴다',()=>{
  const lib=[BOARD(),{name:'옛',libId:'B0',type:'board',pages:[{name:'p',anim:fr(2)}]}];
  SLIM.slim(lib);
  assert.deepEqual(lib[0].pages.map(p=>[('anim' in p),p.animN]),[[false,4],[false,3],[false,1]]);
  assert.equal(lib[1].pages[0].animN,2,'옛 모양(anim 이 배열)도 센다');
  assert.equal(P.scenes(lib[0].pages[0]),4,'줄인 사본에서도 장면 수를 읽는다');
  assert.equal(P.scenes(BOARD().pages[1]),3,'줄이지 않은 사본은 anim 을 센다');
});

test('줄 ↔ 페이지: 번호와 이름 · 옛 줄은 이름으로 · 이름을 고친 줄은 번호로',()=>{
  const c=BOARD();
  assert.deepEqual(J(P.target(c,{fromLib:'B1',libIdx:1},'페이지 2')),{libId:'B1',idx:1,scenes:3,board:true});
  assert.equal(P.target(c,{fromLib:'B1',libIdx:0},'페이지 2').idx,1,'옛 줄은 번호가 모두 0 — 이름이 이긴다');
  assert.equal(P.target(c,{fromLib:'B1',libIdx:0},'1단계').idx,0);
  assert.equal(P.target(c,{fromLib:'B1',libIdx:1},'두 번째 그림').idx,1,'일정에서 이름을 고친 줄 — 번호로');
  assert.equal(P.target(c,{fromLib:'B1',libIdx:0},'모르는 이름'),null,'번호 0 + 이름 못 맞춤 — 열지 않는다');
  assert.equal(P.target(c,{fromLib:'B1',libIdx:2},'마무리').scenes,1);
  assert.equal(P.target({type:'train',trainings:[]},{fromLib:'X'},'a'),null,'작전판이 아니면 null');
  assert.equal(P.target(c,{},'1단계'),null,'보관함에서 오지 않은 줄');
});

test('한 페이지 작전판 · 옛 저장본(최상위 frames)은 자료 이름 줄 하나',()=>{
  assert.equal(P.target({type:'board',libId:'S',pages:[{name:'',anim:{frames:fr(5)}}]},{fromLib:'S',libIdx:0},'세트피스').scenes,5);
  assert.equal(P.target({type:'board',libId:'S',frames:fr(2)},{fromLib:'S'},'옛 작전판').scenes,2);
  assert.equal(P.target({type:'board',libId:'S',pages:[{name:''}]},{fromLib:'S'},'그림 하나').scenes,0);
});

/* process.html 의 실제 구간(가져오기 · ▶)을 잘라 vm 으로 — schedule-chip-anim 과 같은 harness */
const SET=cut(S,'window.wkbdSetLibItem=function','/* 보관함 전체에서 고르기');
const CHOOSE=cut(S,'window.wkbdLibChoose=function','window.wkbdAddTrain=function');
const ANIM=cut(S,'var __wksLibMemo=','window.wkbdTrainTap=function');
function ctx(lib){
  const board={};const posted=[];const toasts=[];
  const c=vm.createContext({Array,String,Math,parseInt,isNaN,JSON,Object,
    week:[{}],dayBoard:()=>board,psLibraryRequireUnlocked:()=>true,libDrills:()=>lib,FOCUS2THEME:{},__pendSlot:'S1',
    toast:t=>toasts.push(t),wkbdAutoTheme:()=>false,save(){},syncViews(){},closeSheet(){},wksFillBack(){},
    wkbdEsc:s=>String(s),parent:{postMessage:m=>posted.push(m)},PSSchedBoardPlay:P});
  c.window=c;
  vm.runInContext(SET+'\n'+CHOOSE+'\n'+ANIM+'\nthis.wksLibTrainOf=wksLibTrainOf;this.wksPlayBtn=wksPlayBtn;',c);
  return {c,board,posted,toasts};
}
test('일정: 작전판을 가져오면 페이지 줄마다 그 페이지 번호 · 장면 둘 이상인 줄에만 ▶ · 누르면 그 페이지로 연다',()=>{
  const lib=SLIM.slim([BOARD()]);
  const {c,board,posted}=ctx(lib);
  c.window.wkbdLibChoose(0,null,0);
  assert.deepEqual([...board.trains],['1단계','페이지 2','마무리']);
  assert.deepEqual([...board.trainData.map(d=>d.libIdx)],[0,1,2],'3.325 — 페이지 번호(예전엔 모두 0)');
  assert.ok(board.trainData.every(d=>!('frames' in d)&&!('anim' in d)),'일정 문서에 장면을 싣지 않는다');
  const btn=i=>c.wksPlayBtn(0,i,board.trainData[i],board.trains[i]);
  assert.match(btn(0),/4장면/);assert.match(btn(1),/3장면/);assert.equal(btn(2),'','장면 하나인 페이지엔 ▶ 없음');
  c.window.wksAnimPlay(0,1);
  assert.equal(posted.length,1);
  const m=posted[0];
  assert.equal(m.type,'openDrillEditor');assert.equal(m.readonly,true);assert.equal(m.play,true);assert.equal(m.reason,'anim');
  assert.equal(m.libId,'B1');assert.equal(m.libIdx,1);
});
test('일정: 모듈이 없으면 작전판 줄은 예전처럼 ▶ 없음',()=>{
  const {c,board}=ctx(SLIM.slim([BOARD()]));
  c.window.wkbdLibChoose(0,null,0);
  delete c.PSSchedBoardPlay;
  assert.equal(c.wksPlayBtn(0,0,board.trainData[0],board.trains[0]),'');
});

/* 작전판 쪽 — 가짜 창 */
function fakeWin(lib,o){
  o=o||{};
  const cls=new Set();let mo=null;const posted=[];const opened=[];const meet=[];const toasts=[];const timers=[];const again=[];let clicked=0,replay=0;
  const body={classList:{contains:k=>cls.has(k)}};
  const w={
    libGet:()=>Promise.resolve(lib),toast:t=>toasts.push(t),
    parent:{postMessage:m=>posted.push(m)},
    setTimeout:(f,ms)=>{timers.push({f,ms});return timers.length;},
    MutationObserver:function(cb){mo=cb;this.observe=()=>{};this.disconnect=()=>{mo=null;};},
    document:{body,getElementById:id=>id==='vCreateCancel'?{click(){clicked++;w.__vaultViewMode=false;}}:id==='meetReplay'?{click(){replay++;}}:null},
    __meetSlidesFromBoard:d=>(d.pages||[]).map(p=>({snap:p.snap,frames:(p.anim&&p.anim.frames)||[]})),
    __psVaultOpenItem:(d,ro)=>{opened.push({d,ro});if(o.openFails)return;w.__vaultViewMode=true;w.__vvMeetLib=d.__showOf;},
    __meet:{go:(i,w2)=>meet.push(['go',i,w2]),show:f=>meet.push(['show',f])},
    __openScheduleDrillView:p=>again.push(p)
  };
  return {w,posted,opened,meet,toasts,timers,again,
    clicked:()=>clicked,replays:()=>replay,
    focus(on){on?cls.add('focus-board'):cls.delete('focus-board');if(mo)mo();},
    run(ms){timers.filter(t=>t.ms===ms).forEach(t=>t.f());}};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('작전판: ▶ 는 보기 전용 미팅으로 열고(작업 보드 · 보관함 그대로) 고른 페이지부터 쇼',async()=>{
  const f=fakeWin([BOARD()]);
  const p={libId:'B1',libIdx:1,play:true,reason:'anim'};
  assert.equal(SHOW.route(f.w,p),true,'맡는다');
  await tick();await tick();
  assert.equal(f.opened.length,1);
  const o=f.opened[0];
  assert.equal(o.ro,true,'보기 전용');assert.equal(o.d.type,'meeting');assert.equal(o.d.__showOf,'B1');assert.equal(o.d.slides.length,3);
  assert.equal(f.again.length,0);
  f.run(320);
  assert.deepEqual(f.meet,[['go',1,'first'],['show',false]],'둘째 페이지부터');
  assert.match(f.toasts[0],/애니메이션 보기/);
});
test('작전판: 첫 페이지는 처음부터 · 쇼가 끝나면(전체 화면이 풀리면) 보기를 닫고 일정으로 — 한 번만',async()=>{
  const f=fakeWin([BOARD()]);
  SHOW.route(f.w,{libId:'B1',libIdx:0,play:true,reason:'anim'});
  await tick();await tick();f.run(320);
  assert.deepEqual(f.meet,[['show',true]]);
  f.focus(false);assert.equal(f.posted.length,0,'쇼가 서기 전의 바뀜은 무시');
  f.focus(true);assert.equal(f.replays(),0);f.run(700);assert.equal(f.replays(),1,'쇼가 선 뒤 «↻ 다시»로 장면 재생 — 시간이 아니라 쇼가 선 순간 기준');
  f.focus(false);
  assert.equal(f.clicked(),1,'보기 닫기');
  assert.deepEqual(f.posted,[{source:'board',type:'captureCancel'}],'일정으로');
  f.focus(true);f.focus(false);
  assert.equal(f.posted.length,1,'한 번만');
});
test('작전판: 훈련 · 못 찾음은 예전 길로 · 열리지 않으면(로그인) 일정으로 · 다른 문은 손대지 않는다',async()=>{
  const tr=fakeWin([{libId:'T1',type:'train',trainings:[]}]);
  const p={libId:'T1',libIdx:0,play:true,reason:'anim'};
  assert.equal(SHOW.route(tr.w,p),true);await tick();await tick();
  assert.equal(tr.again.length,1);assert.equal(tr.again[0].__psTyped,1);
  assert.equal(SHOW.route(tr.w,tr.again[0]),false,'두 번째로 들어오면 예전 길 그대로');
  const gone=fakeWin([]);SHOW.route(gone.w,{libId:'X',reason:'anim'});await tick();await tick();
  assert.equal(gone.again.length,1);
  const locked=fakeWin([BOARD()],{openFails:true});SHOW.route(locked.w,{libId:'B1',reason:'anim'});await tick();await tick();
  assert.deepEqual(locked.posted,[{source:'board',type:'captureCancel'}]);assert.equal(locked.meet.length,0);
  assert.equal(SHOW.route(tr.w,{libId:'T1',reason:''}),false,'지난 날 보기(reason 없음)는 예전 길');
  assert.equal(SHOW.route(tr.w,{reason:'anim'}),false);
});
test('배선: board.html · process.html · sw.js',()=>{
  assert.ok(B.includes('<script src="board-sched-show.js"></script>'));
  assert.match(B,/window\.__openScheduleDrillView=function\(p\)\{p=p\|\|\{\};if\(window\.PSSchedBoardShow&&PSSchedBoardShow\.route\(window,p\)\)return;/);
  assert.ok(S.includes('<script src="schedule-lib-slim.js"></script><script src="schedule-board-play.js"></script>'));
  assert.match(S,/if\(ty==='board'\)return window\.PSSchedBoardPlay\?PSSchedBoardPlay\.target\(card,td,name\):null;/);
  assert.ok(SW.includes("'/studio/board-sched-show.js'")&&SW.includes("'/studio/schedule-board-play.js'"),'sw CORE');
  assert.match(B,/window\.__meetSlidesFromBoard=meetSlidesFromBoard/,'3.031 의 장 만들기를 그대로 쓴다');
  assert.match(B,/window\.__psVaultOpenItem=function\(d,ro\)/);
});
