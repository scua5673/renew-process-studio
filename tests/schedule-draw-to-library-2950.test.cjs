'use strict';
/* 2.950 — 일정에 직접 적은 훈련 줄의 «작전판에서 그리기»가 그린 애니메이션(장면)을 버리던 것(2.946 조사).
   예전엔 보관함에 넣지 않고 그림 한 장(snap)만 돌려받았다 — 장면은 사라지고, 칸을 통째로 새로 만들어 «20분×3»의 세트까지 지웠다.
   이제 저장하면 보관함에 넣고(2.304 «훈련은 보관함에서 만들고 일정에는 가져오기만»), 보관함 쓰기가 끝나면 그 줄을 그 항목과 잇는다
   — 가져온 줄과 같아진다(▶ 재생·보관함에서 열기, 장면은 일정 문서에 복사하지 않는다). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const P=fs.readFileSync(path.join(__dirname,'../studio/process.html'),'utf8');
const B=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const A=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
function cut(src,a,b){const i=src.indexOf(a),j=src.indexOf(b,i);assert.ok(i>0&&j>i,a);return src.slice(i,j);}
const DRAW=cut(P,'window.boardDrawForCell=function','\n',);
const HANDLE=(()=>{const i=P.indexOf("    if(d.type==='boardCancel'){window.__boardCapTarget=null;");const r=P.indexOf("    if(d.type==='boardResult'){",i);const e=P.indexOf('\n',P.indexOf("if(!curSession)return;var bi=window.__boardBi;",r));assert.ok(i>0&&r>i&&e>r);return P.slice(i,e);})();

function setup(){
  const day={board:{trains:['패스 4v2'],trainData:[{minutes:20,sets:3,secs:30,snap:{old:1},thumb:'<svg/>'}],trainThemes:['']}};
  const posted=[],toasts=[];let saves=0;
  const c=vm.createContext({Array,String,Date,parseInt,JSON,Math,week:[{},{},day],dayBoard:d=>d.board,
    save(){saves++;},syncViews(){},closeSheet(){},toast:t=>toasts.push(t),curSession:null,parent:{postMessage:m=>posted.push(m)}});
  c.window=c;
  vm.runInContext(DRAW+'\nfunction __handle(d){\n'+HANDLE+'\n}\nthis.__handle=__handle;',c);
  return {c,day,posted,toasts,saves:()=>saves};
}

test('그리기 → 그림 받음 → 보관함 번호 받음 → 그 줄이 보관함 항목과 이어진다(세트·초는 그대로)',()=>{
  const {c,day,posted,toasts}=setup();
  c.boardDrawForCell(2,0);
  assert.equal(posted.length,1);assert.equal(posted[0].toLib,true);assert.equal(posted[0].edit,true);assert.equal(posted[0].minutes,20);
  c.__handle({type:'boardResult',name:'패스 4v2',minutes:'20',thumb:'<svg id="n"/>',snap:{fresh:1},gmPhases:['p1']});
  const td=day.board.trainData[0];
  assert.equal(td.sets,3,'«20분×3»이 «20분»이 되지 않는다');assert.equal(td.secs,30);
  assert.deepEqual({...td.snap},{fresh:1});assert.equal(td.fromLib,undefined,'번호를 받기 전에는 잇지 않는다');
  c.__handle({type:'boardSaved',libId:'Labc'});
  assert.equal(td.fromLib,'Labc');assert.equal(td.libIdx,0);assert.equal(td.type,undefined,'이제 가져온 줄과 같다');
  assert.ok(toasts.some(t=>/보관함에 저장하고 이 훈련과 이었어요/.test(t)));
  assert.equal(td.frames,undefined,'장면은 일정 문서에 복사하지 않는다');
  c.__handle({type:'boardSaved',libId:'Lother'});
  assert.equal(td.fromLib,'Labc','한 번 이으면 끝 — 다른 저장 신호가 덮지 않는다');
});

test('이름이 바뀌었거나 2분이 지났거나 취소했으면 잇지 않는다',()=>{
  let s=setup();s.c.boardDrawForCell(2,0);s.c.__handle({type:'boardResult',name:'패스 4v2',minutes:'20'});
  s.day.board.trains[0]='다른 훈련';s.c.__handle({type:'boardSaved',libId:'L1'});
  assert.equal(s.day.board.trainData[0].fromLib,undefined,'다른 줄이 되었으면 잇지 않는다');
  s=setup();s.c.boardDrawForCell(2,0);s.c.__handle({type:'boardResult',name:'패스 4v2',minutes:'20'});
  s.c.window.__boardCapLink.at-=121000;s.c.__handle({type:'boardSaved',libId:'L1'});
  assert.equal(s.day.board.trainData[0].fromLib,undefined,'2분 지난 신호');
  s=setup();s.c.boardDrawForCell(2,0);s.c.__handle({type:'boardCancel'});s.c.__handle({type:'boardSaved',libId:'L1'});
  assert.equal(s.day.board.trainData[0].fromLib,undefined,'취소');
});

test('웜업·미팅 «새로 그리기»(보관함 저장)는 일정 줄을 잇지 않는다 — 훈련 줄 그리기만',()=>{
  const s=setup();s.c.window.__boardCapTarget={di:2,warm:true,wi:0};
  s.c.__handle({type:'boardResult',name:'워밍업',minutes:'10',thumb:'',snap:null});
  assert.equal(s.c.window.__boardCapLink||null,null);
  s.c.__handle({type:'boardSaved',libId:'L1'});
  assert.equal(s.day.board.trainData[0].fromLib,undefined);
});

test('작전판: 일정 훈련 줄에서 연 편집(toLib, 보관함 번호 없음)만 저장 때 보관함에 넣는다',()=>{
  const edit=cut(B,'window.__openScheduleDrillEdit=function','\n');
  assert.match(edit,/window\.__editorSchedToLib=!!\(p\.toLib&&!p\.libId\)/,'보관함 항목을 여는 길(libId)은 그 항목을 고친다');
  assert.match(B,/if\(window\.__editorSchedLink!=='edit'\|\|window\.__editorSchedToLib\)_schedSavePr=saveToLib\(_nd\);/);
  assert.match(cut(B,'window.__openScheduleDrill=function','\n'),/__editorSchedToLib=false/);
  assert.match(cut(B,'window.__openScheduleDrillView=function','\n'),/__editorSchedToLib=false/);
  assert.match(B,/if\(window\.__editorSchedLink\)\{window\.__editorSchedLink=false;window\.__editorSchedToLib=false;/,'닫을 때 풀어 다음 편집기(IDP 등)에 새지 않는다');
});

test('셸: toLib 는 일정에서 온 것만 넘기고, 보관함 저장 신호를 일정에 잇는다',()=>{
  assert.match(A,/toLib:!!\(_ed\.toLib&&d\.source==='process'\)/,'IDP 개인훈련 그림(선수 것)은 보관함에 넣지 않는다');
  assert.match(A,/else if\(captureReq==='process'&&d\.libId\)\{ try\{ fProcess\.contentWindow\.postMessage\(\{type:'boardSaved',libId:String\(d\.libId\)\},'\*'\); \}catch\(_\)\{\} \}/);
  const idp=cut(A,"d.source==='idp' && d.type==='openDrillEditor'","} else if(d.source==='board' && d.type==='capture')");
  assert.doesNotMatch(idp,/toLib/,'IDP 그림 첨부는 예전 그대로(일정 문서에만)');
});
