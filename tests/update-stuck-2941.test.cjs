'use strict';
/* 2.941 — 운영 기록(update_deferred, 10/1~10/5)에서 새 판 적용을 몇 시간~하루 넘게 막은 경우들.
   ① 선택 상자 포커스(focus_select:fBoard 36시간) ② 손대지 않은 입력칸 포커스(focus_input:fBoard 26시간)
   ③ 끌기가 끝났는데 남은 «끄는 중» 표시(drag_or_modal:fBoard 23시간) ④ 다른 출처 iframe 의 SecurityError(flush_fail:frame12, 5시간)
   ⑤ 스카우팅 저장 확인 실패가 이유 없이 «Error» 로만 남던 것. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
const safeCode=app.slice(app.indexOf('function psReloadWorkspaceSeal(){'),app.indexOf('/* ⚠ 2.395'));
const flushCode=app.slice(app.indexOf('function psFlushAllPendingReady(track){'),app.indexOf('window.psFlushAllPendingReady=psFlushAllPendingReady;'));

function frameDoc(o={}){
  const classes=new Set(o.classes||[]);
  return {activeElement:o.active||null,querySelector:()=>null,body:{classList:{contains:c=>classes.has(c)}},defaultView:o.view||null};
}
function safeCtx(frames){
  const data=new Map([['ps_active_ws','team-a'],['ps_cache_owner_v1','owner-a'],['ps_ws_switch_epoch_v1','epoch-a']]);
  const c={JSON,Date,localStorage:{getItem:k=>data.has(k)?data.get(k):null},
    document:{activeElement:null,querySelector:()=>null,querySelectorAll:()=>frames.map((d,i)=>({id:'f'+i,contentDocument:d})),body:{classList:{contains:()=>false}}},
    getComputedStyle:()=>({display:'block'})};
  c.window=c;vm.createContext(c);vm.runInContext(safeCode,c);return c;
}
function reason(doc){const c=safeCtx([doc]),w={};const ok=c.psSafeToReload(w);return ok?'safe':w.r;}

test('선택 상자·체크박스·슬라이더에 포커스가 남아도 «입력 중»이 아니다',()=>{
  assert.equal(reason(frameDoc({active:{tagName:'SELECT',value:'433'}})),'safe');
  for(const type of ['checkbox','radio','range','color','button'])
    assert.equal(reason(frameDoc({active:{tagName:'INPUT',type,value:'x',defaultValue:''}})),'safe',type);
});
test('손대지 않은 입력칸(값 = 처음 값)은 막지 않고, 고친 칸은 예전처럼 기다린다',()=>{
  assert.equal(reason(frameDoc({active:{tagName:'INPUT',type:'text',value:'A팀',defaultValue:'A팀'}})),'safe');
  assert.equal(reason(frameDoc({active:{tagName:'TEXTAREA',value:'',defaultValue:''}})),'safe');
  assert.equal(reason(frameDoc({active:{tagName:'INPUT',type:'text',value:'A팀 수정',defaultValue:'A팀'}})),'focus_input:f0');
  assert.equal(reason(frameDoc({active:{tagName:'TEXTAREA',value:'쓰는 중',defaultValue:''}})),'focus_textarea:f0');
  assert.equal(reason(frameDoc({active:{tagName:'DIV',isContentEditable:true}})),'focus_editable:f0','글 편집 칸은 늘 기다린다');
  assert.equal(reason(frameDoc({active:{tagName:'INPUT'}})),'focus_input:f0','값을 알 수 없으면 기다린다');
});
test('«끄는 중» 표시는 실제로 눌려 있을 때만 막는다',()=>{
  assert.equal(reason(frameDoc({classes:['token-drag'],view:{psDragging:()=>false}})),'safe','남은 표시');
  assert.equal(reason(frameDoc({classes:['token-drag'],view:{psDragging:()=>true}})),'drag_or_modal:f0','끄는 중');
  assert.equal(reason(frameDoc({classes:['token-drag']})),'drag_or_modal:f0','판정 함수가 없으면 예전처럼 기다린다');
  assert.equal(reason(frameDoc({classes:['ps-modal-open']})),'drag_or_modal:f0','오류 제보 창은 그대로 기다린다');
});
test('다른 출처 iframe 은 저장 확인에서 건너뛴다',async()=>{
  const ours={psFlushPendingReady:async()=>true,psHasPending:()=>false,document:{readyState:'complete'}};
  const foreign={get document(){const e=new Error('Blocked a frame');e.name='SecurityError';throw e;},get psFlushPendingReady(){const e=new Error('Blocked');e.name='SecurityError';throw e;}};
  const c={Promise,Error,document:{querySelectorAll:()=>[{id:'fBoard',contentWindow:ours},{contentWindow:foreign}]}};
  c.window=c;vm.createContext(c);vm.runInContext(flushCode,c);
  const track={};assert.equal(await c.psFlushAllPendingReady(track),true);
  assert.deepEqual(Object.keys(track.pending||{}),[]);
});
test('보드는 손을 떼면 남은 «끄는 중» 표시를 지운다',()=>{
  const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.match(board,/function up\(\)\{ window\.__psPtrDown=0; setTimeout\(function\(\)\{ try\{ if\(!window\.__psPtrDown\)document\.body\.classList\.remove\("token-drag"\); \}catch\(_\)\{\} \},0\); \}/);
});
test('스카우팅 저장 확인 실패마다 코드가 붙는다',()=>{
  const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
  for(const code of ['match_save_failed','match_public_review_pending','match_pending_left'])assert.ok(scout.includes("'"+code+"'"),code);
  assert.doesNotMatch(scout,/throw new Error\('경기 지연 저장이 남아 있습니다'\)/);
});
