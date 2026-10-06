'use strict';
/* 2.946 — 일정 훈련 줄마다 그 훈련의 애니메이션(오류 제보 10/5 «워밍업을 누르면 워밍업 애니메이션, 패스를 누르면 패스 애니메이션»).
   보관함 카드에서 가져온 줄은 카드의 몇 번째 훈련인지(libIdx)를 기억하고, 장면이 2개 이상이면 줄 끝 ▶ 로 그 훈련을 보기 모드로 열어 재생한다.
   장면 자체는 일정 문서에 복사하지 않는다(문서 크기 — 2.600~2.622 에서 줄여 온 것). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const S=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
const B=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const A=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
function cut(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i);assert.ok(i>0&&j>i,a);return src.slice(i,j);}
const SET=cut(S,'window.wkbdSetLibItem=function','/* 보관함 전체에서 고르기');
const CHOOSE=cut(S,'window.wkbdLibChoose=function','window.wkbdAddTrain=function');
const ANIM=cut(S,'var __wksLibMemo=','window.wkbdTrainTap=function');
const fr=n=>Array.from({length:n},(_,i)=>({snap:{i}}));
function ctx(lib){
  const board={};const posted=[];const toasts=[];
  const c=vm.createContext({Array,String,Math,parseInt,isNaN,JSON,Object,
    week:[{}],dayBoard:()=>board,psLibraryRequireUnlocked:()=>true,libDrills:()=>lib,FOCUS2THEME:{},__pendSlot:'S1',
    toast:t=>toasts.push(t),wkbdAutoTheme:()=>false,save(){},syncViews(){},closeSheet(){},wksFillBack(){},
    wkbdEsc:s=>String(s),parent:{postMessage:m=>posted.push(m)}});
  c.window=c;
  vm.runInContext(SET+'\n'+CHOOSE+'\n'+ANIM+'\nthis.wksLibTrainOf=wksLibTrainOf;this.wksPlayBtn=wksPlayBtn;',c);
  return {c,board,posted,toasts};
}
const CARD={name:'10월 6일 훈련',libId:'L1',type:'train',trainings:[
  {name:'워밍업',minutes:10,frames:fr(3)},{name:'패스',minutes:15,frames:fr(4)},{name:'마무리',minutes:12}]};
test('가져올 때 카드의 몇 번째 훈련인지 기억한다(장면은 복사하지 않는다)',()=>{
  const {c,board}=ctx([CARD]);c.window.wkbdLibChoose(0,null,0);
  assert.deepEqual([...board.trains],['워밍업','패스','마무리']);
  assert.deepEqual([...board.trainData.map(d=>d.libIdx)],[0,1,2]);
  assert.ok(board.trainData.every(d=>!('frames' in d)),'일정 문서에 장면을 싣지 않는다');
});
test('▶ 는 장면이 2개 이상인 훈련에만 — 누르면 그 훈련을 보기 모드로 열고 재생',()=>{
  const {c,board,posted}=ctx([CARD]);c.window.wkbdLibChoose(0,null,0);
  const btn=i=>c.wksPlayBtn(0,i,board.trainData[i],board.trains[i]);
  assert.match(btn(0),/애니메이션 보기 · 3장면/);assert.match(btn(1),/4장면/);assert.equal(btn(2),'','장면 없는 훈련엔 ▶ 없음');
  c.window.wksAnimPlay(0,1);
  assert.equal(posted.length,1);
  const m=posted[0];assert.equal(m.type,'openDrillEditor');assert.equal(m.readonly,true);assert.equal(m.play,true);
  assert.equal(m.libId,'L1');assert.equal(m.libIdx,1,'패스 = 두 번째 훈련');
});
test('옛 줄(번호 없음)은 이름으로 · 일정에서 이름을 고친 줄은 번호로 찾는다',()=>{
  const {c}=ctx([CARD]);
  assert.equal(c.wksLibTrainOf({fromLib:'L1'},'패스').idx,1);
  assert.equal(c.wksLibTrainOf({fromLib:'L1',libIdx:1},'패스 4v2').idx,1);
  assert.equal(c.wksLibTrainOf({fromLib:'L1',libIdx:0},'패스').idx,1,'카드 순서가 바뀌면 이름이 이긴다');
  assert.equal(c.wksLibTrainOf({fromLib:'L1'},'없는 이름'),null,'훈련이 여럿인데 못 맞추면 아무것도 열지 않는다');
});
test('훈련 하나짜리 옛 카드는 카드 대표 장면을 쓴다 · 지워진 카드·작전판(pages)·직접 적은 줄은 ▶ 없음',()=>{
  const old={name:'옛 카드',libId:'L2',frames:fr(2)};
  const board={name:'작전판',libId:'L3',type:'board',pages:[{name:'p1'},{name:'p2'}],frames:fr(3)};
  const {c,posted,toasts}=ctx([old,board]);
  assert.deepEqual(JSON.parse(JSON.stringify(c.wksLibTrainOf({fromLib:'L2',libIdx:0},'옛 카드'))),{libId:'L2',idx:0,scenes:2});
  assert.equal(c.wksLibTrainOf({fromLib:'L3',libIdx:0},'p1'),null);
  assert.equal(c.wksLibTrainOf({fromLib:'GONE'},'워밍업'),null);
  assert.equal(c.wksLibTrainOf({minutes:10},'직접 적은 줄'),null);
  c.window.week=[{}];c.dayBoard=()=>({trains:['x'],trainData:[{fromLib:'GONE'}]});
  c.window.wksAnimPlay(0,0);assert.equal(posted.length,0);assert.match(toasts[0],/찾지 못했어요/);
});
test('셸·작전판이 번호와 재생을 이어 받는다',()=>{
  assert.match(A,/__openScheduleDrillView\(\{libId:_ed\.libId,libIdx:_ed\.libIdx,play:!!_ed\.play,reason:_ed\.reason/);
  assert.match(A,/__openScheduleDrillEdit\(\{libId:_ed\.libId,libIdx:_ed\.libIdx/);
  assert.match(B,/async function openLibDrawEditor\(libId, readOnly, opts\)/);
  assert.match(B,/openLibDrawEditor\(p\.libId,true,\{idx:p\.libIdx,play:!!p\.play\}\)/);
  assert.match(B,/openLibDrawEditor\(p\.libId,false,\{idx:p\.libIdx\}\)/);
  const body=cut(B,'async function openLibDrawEditor','function applyEditorReadOnly');
  assert.ok(body.indexOf('_activateTraining(_ix)')<body.indexOf('fillEditorPanel();renderSceneStrip();renderTrainingTabs();'),'훈련을 바꾼 뒤에 패널·탭을 그린다');
  assert.match(body,/opts&&opts\.play[\s\S]*playAnim\(\)/);
});
