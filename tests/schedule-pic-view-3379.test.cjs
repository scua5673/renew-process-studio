'use strict';
/* 3.379 — 그림만 있는 일정 줄도 그 그림으로 바로(제보 c1bad13d «이미지만 넣으면 … 클릭하면 바로 이미지로 넘어 가게»).
   ▶(장면 둘 이상) 자리에, 장면이 하나뿐이고 그림이 있는 보관함 줄은 «그림 보기» — 같은 보기 전용 문을 재생 없이(reason 'pic').
   버튼 글은 studio/schedule-board-play.js(picBtn · hasPic) — process.html 은 크기 예산에 닿아 있어 네 곳만 고쳤다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=require('../studio/schedule-board-play.js');
const SHOW=require('../studio/board-sched-show.js');
const root=path.join(__dirname,'..');
const S=fs.readFileSync(path.join(root,'studio/process.html'),'utf8');
const B=fs.readFileSync(path.join(root,'studio/board.html'),'utf8');
function cut(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i);assert.ok(i>0&&j>i,a);return src.slice(i,j);}
const fr=n=>Array.from({length:n},(_,i)=>({snap:{i}}));

test('그림이 있는가 — 일정 줄의 그림 · 보관함의 그 훈련(페이지) · 하나짜리 자료의 대표 그림',()=>{
  const r={libId:'L',idx:1,scenes:0};
  assert.equal(P.hasPic(null,{thumb:'<svg/>'},r),true,'일정 줄이 그림을 들고 있다');
  assert.equal(P.hasPic({trainings:[{},{snap:{a:1}}]},{},r),true,'그 훈련의 판');
  assert.equal(P.hasPic({trainings:[{thumb:'x'},{}]},{},r),false,'다른 훈련의 그림은 세지 않는다');
  assert.equal(P.hasPic({thumb:'x',trainings:[{}]},{},{libId:'L',idx:0,scenes:0}),true,'훈련 하나짜리 — 자료 대표 그림');
  assert.equal(P.hasPic({thumb:'x',trainings:[{},{}]},{},r),false,'여럿이면 대표 그림을 그 줄 것으로 보지 않는다');
  assert.equal(P.hasPic({type:'board',pages:[{},{snap:{}}]},{},{libId:'L',idx:1,scenes:1,board:true}),true,'작전판 페이지');
  assert.equal(P.hasPic({},{},null),false);
});

test('버튼 — 장면 하나 + 그림이면 «그림 보기», 장면 둘 이상 · 그림 없음이면 없음',()=>{
  const card={trainings:[{snap:{a:1}}]},r={libId:'L',idx:0,scenes:1};
  const b=P.picBtn(2,3,{},'패스 "4v2" <b>',null,r,0,card);
  assert.match(b,/class="wks-play wks-pic"/);assert.match(b,/title="그림 보기"/);
  assert.match(b,/wksAnimPlay\(2,3,1\)/);assert.match(b,/event\.stopPropagation\(\)/,'줄 누름(시간 시트)과 겹치지 않는다');
  assert.match(b,/aria-label="패스 &quot;4v2&quot; &lt;b&gt; 그림 보기"/,'이름은 글자로만');
  assert.match(P.picBtn(0,0,{},'x','wks-play wft-play',r,0,card),/class="wks-play wft-play wks-pic"/,'세션 채우기 창의 줄');
  assert.equal(P.picBtn(0,0,{},'x',0,r,1,card),'<button class="btn solid" onclick="wksAnimPlay(0,0,1)">그림 보기</button>','훈련 칩 시트의 큰 버튼');
  assert.equal(P.picBtn(0,0,{},'x',null,{libId:'L',idx:0,scenes:2},0,card),'','장면 둘 이상은 ▶ 가 맡는다');
  assert.equal(P.picBtn(0,0,{},'x',null,r,0,{trainings:[{}]}),'','그림이 없으면 버튼도 없다');
  assert.equal(P.picBtn(0,0,{},'x',null,null,0,card),'');
  assert.match(P.picBtn('1);alert(1','0',{},'x',null,r,0,card),/wksAnimPlay\(1,0,1\)/,'번호는 숫자로만');
});

test('일정: 그림 한 장 훈련 줄 — 버튼이 붙고, 누르면 그 훈련을 보기 전용으로 재생 없이 연다',()=>{
  const SET=cut(S,'window.wkbdSetLibItem=function','/* 보관함 전체에서 고르기');
  const CHOOSE=cut(S,'window.wkbdLibChoose=function','window.wkbdAddTrain=function');
  const ANIM=cut(S,'var __wksLibMemo=','window.wkbdTrainTap=function');
  const CARD={name:'11월 25일 훈련',libId:'L1',type:'train',trainings:[
    {name:'워밍업',minutes:10,frames:fr(3),thumb:'<svg/>'},{name:'론도',minutes:15,thumb:'<svg/>',snap:{a:1}},{name:'이름만',minutes:5}]};
  const board={},posted=[];
  const c=vm.createContext({Array,String,Math,parseInt,isNaN,JSON,Object,
    week:[{}],dayBoard:()=>board,psLibraryRequireUnlocked:()=>true,libDrills:()=>[CARD],FOCUS2THEME:{},__pendSlot:'S1',
    toast(){},wkbdAutoTheme:()=>false,save(){},syncViews(){},closeSheet(){},wksFillBack(){},
    wkbdEsc:s=>String(s),parent:{postMessage:m=>posted.push(m)},PSSchedBoardPlay:P});
  c.window=c;
  vm.runInContext(SET+'\n'+CHOOSE+'\n'+ANIM+'\nthis.wksPlayBtn=wksPlayBtn;',c);
  c.window.wkbdLibChoose(0,null,0);
  const btn=i=>c.wksPlayBtn(0,i,board.trainData[i],board.trains[i]);
  assert.match(btn(0),/애니메이션 보기 · 3장면/);assert.doesNotMatch(btn(0),/wks-pic/);
  assert.match(btn(1),/wks-pic/);assert.match(btn(1),/wksAnimPlay\(0,1,1\)/);
  assert.equal(btn(2),'','그림 없는 줄엔 아무 버튼도 없다');
  c.window.wksAnimPlay(0,1,1);
  assert.deepEqual(JSON.parse(JSON.stringify(posted[0])),{source:'process',type:'openDrillEditor',readonly:true,play:false,reason:'pic',libId:'L1',libIdx:1,name:'론도'});
  c.window.wksAnimPlay(0,0);
  assert.equal(posted[1].play,true);assert.equal(posted[1].reason,'anim','▶ 는 예전 그대로');
});

test('작전판: reason pic 도 보기 전용으로 받는다 — 안내는 «그림 보기», 작전판 자료는 쇼로(재생 누름 없음)',()=>{
  assert.match(B,/p\.reason==='pic'\?'그림 보기 — 고치려면 보관함에서'/);
  const says=[];let opened=null,replay=0;
  const w={toast:m=>says.push(m),document:{body:{classList:{contains:()=>false}},getElementById:id=>id==='meetReplay'?{click(){replay++;}}:null},
    MutationObserver:function(){this.observe=()=>{};this.disconnect=()=>{};},setTimeout:()=>0,parent:{postMessage(){}},
    __meetSlidesFromBoard:d=>d.pages.map(()=>({})),__psVaultOpenItem(it){opened=it;w.__vaultViewMode=true;w.__vvMeetLib=it.__showOf;}};
  assert.equal(SHOW.show(w,{libId:'B1',type:'board',name:'그림',pages:[{},{}]},1,true),true);
  assert.equal(opened.type,'meeting');assert.deepEqual(says,['그림 보기 — 고치려면 보관함에서']);assert.equal(replay,0);
  assert.equal(SHOW.route({libGet:()=>[]},{reason:'pic',libId:'B1'}),true,'pic 도 길을 묻는다');
  assert.equal(SHOW.route({libGet:()=>[]},{reason:'',libId:'B1'}),false);
});

test('A안 — 줄 누름: 그림 · 애니메이션이 있는 줄은 표식을 대신 누르고, 시간 칩 · 표식 자신 · 다른 줄은 제 처리기에',()=>{
  let clicks=0,stopped=0;
  const play={click(){clicks++;}},li={querySelector:s=>s==='.wks-play'?play:null};
  const ev=hit=>({target:{closest:s=>hit[s]||null},stopPropagation(){stopped++;},preventDefault(){}});
  assert.equal(P.rowTap(ev({'.wks-li.has-play':li})),true);assert.equal(clicks,1);assert.equal(stopped,1,'줄의 예전 누름(세션 채우기 창)은 막는다');
  assert.equal(P.rowTap(ev({'.wks-li.has-play':li,'i':{}})),false,'시간 칩');
  assert.equal(P.rowTap(ev({'.wks-li.has-play':li,'.wks-play':play})),false,'표식 자신');
  assert.equal(P.rowTap(ev({})),false,'그림 없는 줄 · 다른 곳');
  assert.equal(P.rowTap({target:null}),false);
  assert.equal(clicks,1);assert.equal(stopped,1);
  assert.match(P.ROW_CSS,/\.wks-li\.has-play \.wks-play[^{]*\{order:-1/);assert.doesNotMatch(P.ROW_CSS,/!important/);
  const made=[];const doc={head:{appendChild:e=>made.push(e)},getElementById:id=>made.find(e=>e.id===id)||null,createElement:()=>({}),addEventListener:(t,f,c)=>made.push([t,f===P.rowTap,c])};
  assert.equal(P.mountRows(doc),true);assert.equal(P.mountRows(doc),false,'한 번만');
  assert.deepEqual(made[1],['click',true,true],'capture 로 — 줄의 inline onclick 보다 먼저');
});
