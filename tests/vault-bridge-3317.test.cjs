'use strict';
/* 3.317 — 보관함↔보드 다리(B안). 편집 띠 말 하나(저장 · 저장하고 닫기 · 닫기) · 빵부스러기 · 목록 «편집 중» 칩 ·
   초안 띠 «돌아가기 · 저장하고 닫기 · 버리기»가 그 자료를 다시 열어 초안을 입힌다 · 불러오기 «이어서»가 그 초안을 본다.
   화면 흐름은 tests/browser/vault-bridge-3317. 여기서는 소스 모양과 모듈을 가짜 창으로 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('../studio/board-vault-draft.js'),OC=require('../studio/board-open-chooser.js');
const OWNER={uid:'synthetic-coach',wid:'synthetic-team',seal:'s'};
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');

test('편집 띠의 말은 하나다 — 편집: 저장 · 저장하고 닫기 · 닫기 / 새 자료: 저장 · 닫기 / 경기 준비 안: 닫기 · 완료',()=>{
  assert.match(board,/_sb\.textContent="저장하고 닫기";/);assert.doesNotMatch(board,/_sb\.textContent="저장하고 나가기"/);
  assert.match(board,/_cb\.textContent="닫기";var _cr=\$id\("vCreateCrumb"\)/,'편집으로 열면 «닫기»와 빵부스러기');
  assert.match(board,/_sb\.textContent="저장";\}var _so0/,'새 자료의 «저장»은 이름 시트로 가는 그 단추');
  assert.doesNotMatch(board,/_cb\.textContent="나가기"|_cb\.textContent=ro\?"닫기":"나가기"/,'편집 띠의 닫기 단추는 «나가기»가 아니다');
  assert.match(board,/psConfirm\("저장하지 않은 변경 사항을 버리고 닫을까요\?"/);
});

test('띠 앞의 빵부스러기: 보관함 › 폴더 › — openItem 이 폴더를 넘기고, 새로 만들 때는 비운다',()=>{
  assert.match(board,/<span class="vcb-crumb" id="vCreateCrumb"><\/span><b id="vCreateTitle"><\/b>/);
  assert.match(board,/function showViewBar\(name,readOnly,folder\)/);
  assert.match(board,/_cr\.textContent="보관함 › "\+\(folder\?folderLeaf\(folder\)\+" › ":""\)/);
  assert.match(board,/showViewBar\(d\.name\|\|"작전판",ro,d\.folder\)/);
  assert.match(board,/_cr0\.textContent="";/);
  assert.match(board,/#vCreateBar \.vcb-crumb:empty\{display:none;\}/);
});

test('보관함 목록은 고치다 둔 자료에 «편집 중» 칩을 단다 — 초안 모듈의 editingId 로',()=>{
  assert.match(board,/var _edc=\(window\.__psVaultDraft&&window\.__psVaultDraft\.editingId&&window\.__psVaultDraft\.editingId\(\)===d\.libId\)\?'<span class="vc-editing">편집 중<\/span>':'';/);
  assert.equal((board.match(/\+_edc\+'<\/div>/g)||[]).length,2,'목록 행과 카드 보기 둘 다');
  assert.match(board,/\.vcard \.vc-editing\{/);
});

function fakeWindow(){
  const timers=[];let now=0,seq=0;
  const el=()=>({id:'',style:{},textContent:'',innerHTML:'',parentNode:null,setAttribute(){},classList:{add(){},remove(){}},querySelector(){return {textContent:'',onclick:null};},click(){}});
  const w={
    location:{search:''},URLSearchParams:class{get(){return null;}},__cls:new Set(),__x:1,opened:[],toasts:[],redraws:0,
    document:{body:{classList:{contains:n=>w.__cls.has(n)},appendChild(){}},head:{appendChild(){}},getElementById(id){return id==='vCreateTitle'?{textContent:'가상 작전판'}:(id==='vCreateSave'?w.saveBtn:null);},createElement:tag=>tag==='span'?{className:'',textContent:'',parentNode:null}:el(),addEventListener(){},querySelectorAll(sel){return sel==='#drillFiles .vcard'?w.cards:[];}},
    saveBtn:{clicks:0,click(){this.clicks++;}},
    setTimeout(fn,ms){const t={id:++seq,fn,at:now+ms};timers.push(t);return t.id;},clearTimeout(id){const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);},
    setInterval(){return 0;},clearInterval(){},addEventListener(){},toast(m){w.toasts.push(m);},
    localStorage:{m:new Map(),getItem(k){return this.m.has(k)?this.m.get(k):null;},setItem(k,v){this.m.set(k,String(v));},removeItem(k){this.m.delete(k);}},
    storage:{m:new Map(),writes:[],async set(k,v){this.writes.push({k,v});this.m.set(k,v);},async get(k){return this.m.has(k)?{value:this.m.get(k)}:null;},async del(k){this.m.delete(k);}},
    vaultBoardOwner:()=>OWNER,vaultBoardBegin(){return 1;},vaultBoardRestore(){w._vaultBoardContext=null;},pushUndo(){},
    captureSnap:()=>({players:[{id:1,x:w.__x}]}),__vaultEditSig:()=>'sig:'+w.__x,
    lib:[{libId:'V1',type:'board',name:'4-3-3 빌드업',folder:'전술',savedAt:1000,snap:{players:[{id:1,x:100}]},createdBy:'synthetic-coach'}],
    libGet:async()=>w.lib,setView(v){w.__csView=v;},cards:[],
    __psVaultOpenItem(d,ro){w.opened.push({d,ro});w._vaultBoardContext={owner:{uid:OWNER.uid,wid:OWNER.wid,seal:OWNER.seal}};w.__curVaultId=d.libId;w.__vaultEdit=true;w.__vaultPending=null;w.__vaultHydrating=true;w.__cls.add('vcreating');w.vaultBoardBegin();w.setTimeout(()=>{w.__vaultHydrating=false;},420);},
    __vaultAutoSaveSchedule(){w.scheduled=(w.scheduled||0)+1;},
    _vaultBoardContext:null,__vaultEdit:false,__vaultHydrating:false,__vaultPending:null,__curVaultId:null,__vaultManualDirty:false,__boardRestoreDone:true,__csView:'board'
  };
  const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
  w.tick=async ms=>{const end=now+ms;for(;;){timers.sort((a,b)=>a.at-b.at);const t=timers[0];if(!t||t.at>end)break;timers.shift();now=t.at;t.fn();await flush();}now=end;await flush();};
  w.flush=flush;return w;
}
const DRAFT=()=>D.make(OWNER,{snap:{players:[{id:1,x:655}]},frames:null,pages:null},{libId:'V1',name:'4-3-3 빌드업',folder:'전술'},5000);

test('고치다 둔 보관함 자료의 초안: 띠는 «편집 중 · 보관함 › 이름 — 돌아가기 · 저장하고 닫기 · 버리기», editingId · pending 이 그 자료를 가리키고 목록을 다시 그린다',async()=>{
  const w=fakeWindow();w.storage.m.set(D.key(OWNER),DRAFT());w.__csView='session';
  const card=id=>{const nm={kids:[],querySelector(s){return s==='.vc-editing'?this.kids[0]||null:null;},appendChild(c){c.parentNode={removeChild:()=>{this.kids=[];}};this.kids.push(c);}};return {__libId:id,querySelector(s){return s==='.vc-nm'?nm:null;},nm};};
  w.cards=[card('V1'),card('V2')];
  const api=D.install(w);await w.flush();await w.flush();
  assert.equal(api.state().offered,true);
  assert.equal(api.editingId(),'V1');
  assert.equal(w.cards[0].nm.kids.length,1,'그 자료의 행에 «편집 중» 칩');assert.equal(w.cards[0].nm.kids[0].textContent,'편집 중');assert.equal(w.cards[1].nm.kids.length,0,'다른 자료에는 없다');
  const w2=fakeWindow();w2.storage.m.set(D.key(OWNER),DRAFT());w2.__csView='board';w2.cards=[card('V1')];
  const api2=D.install(w2);await w2.flush();await w2.flush();
  assert.equal(w2.cards[0].nm.kids.length,1,'목록이 안 보여도 그려진 행이 있으면 붙인다');
  w2.setView('session');await w2.tick(1600);assert.equal(w2.cards[0].nm.kids.length,1,'목록을 열면 다시 맞춘다 — 중복으로 붙이지 않는다');
  w2.storage.m.clear();await api2.refresh();await w2.flush();assert.equal(w2.cards[0].nm.kids.length,0,'초안이 없어지면 칩을 뗀다');
  const rec=await api.pending();assert.equal(rec.libId,'V1');assert.equal(rec.name,'4-3-3 빌드업');assert.equal(rec.folder,'전술');
});

test('«돌아가기»는 그 자료를 편집으로 다시 열고 초안 내용을 입힌 뒤 «변경 있음»으로 둔다 — «(되살림)» 새 자료가 아니다',async()=>{
  const w=fakeWindow();w.storage.m.set(D.key(OWNER),DRAFT());
  const api=D.install(w);await w.flush();await w.flush();
  assert.equal(api.restore(),true);await w.flush();await w.flush();
  assert.equal(w.opened.length,1);const d=w.opened[0].d;
  assert.equal(d.libId,'V1');assert.equal(d.name,'4-3-3 빌드업');assert.equal(d.createdBy,'synthetic-coach','자료의 다른 필드는 그대로');
  assert.equal(d.snap.players[0].x,655,'판은 초안 것');assert.equal(w.opened[0].ro,false);
  assert.equal(w.__vaultManualDirty,false,'불러오는 동안은 아직');
  await w.tick(600);
  assert.equal(w.__vaultManualDirty,true,'불러온 뒤 «변경 있음»');assert.equal(w.scheduled,1);
  assert.equal(w.saveBtn.clicks,0);assert.ok(w.toasts.some(t=>/다시 열었어요/.test(t)));
});

test('«저장하고 닫기»는 다시 연 뒤 저장 단추를 누른다 · 자료가 지워졌으면 예전처럼 새 작전판으로',async()=>{
  const w=fakeWindow();w.storage.m.set(D.key(OWNER),DRAFT());
  const api=D.install(w);await w.flush();await w.flush();
  api.restore({save:true});await w.flush();await w.tick(600);
  assert.equal(w.saveBtn.clicks,1);
  const w2=fakeWindow();w2.lib=[];w2.storage.m.set(D.key(OWNER),DRAFT());let newBoard=0;
  w2.__vaultNewBoard=function(){newBoard++;w2._vaultBoardContext={owner:{uid:OWNER.uid,wid:OWNER.wid,seal:OWNER.seal}};w2.__vaultPending={name:'x'};w2.__vaultEdit=true;w2.__cls.add('vcreating');w2.vaultBoardBegin();};
  w2.loadSnap=()=>{};w2.renderTokens=()=>{};w2.renderDrawings=()=>{};w2.updateDelUI=()=>{};
  const api2=D.install(w2);await w2.flush();await w2.flush();
  api2.restore();await w2.flush();await w2.flush();
  assert.equal(w2.opened.length,0);assert.equal(newBoard,1,'없는 자료의 초안은 새 작전판으로');
});

test('새로 만들던 초안(libId 없음)의 띠와 되살리기는 예전 그대로',async()=>{
  const w=fakeWindow();w.storage.m.set(D.key(OWNER),D.make(OWNER,{snap:{players:[{id:1,x:5}]},frames:[{snap:{players:[{id:1,x:5}]}},{snap:{players:[{id:1,x:6}]}}],pages:null},{},1000));
  const api=D.install(w);await w.flush();await w.flush();
  assert.equal(api.state().offered,true);assert.equal(api.editingId(),null,'libId 가 없으면 칩을 달 자료가 없다');
});

test('불러오기 창의 «이어서»: 고치다 둔 보관함 자료가 있으면 그 자료, 아니면 예전 그대로',()=>{
  assert.deepEqual(OC.workMeta({draft:{name:'4-3-3 빌드업',folder:'팀/전술'}}),{label:'이어서',name:'4-3-3 빌드업',meta:'보관함 · 저장 안 한 변경 · 전술'});
  assert.deepEqual(OC.workMeta({draft:{}}),{label:'이어서',name:'보관함 작전판',meta:'보관함 · 저장 안 한 변경'});
  assert.deepEqual(OC.workMeta({empty:true}),{label:'이어서',name:'빈 보드로 시작',meta:'운동장만 있어요'});
  assert.deepEqual(OC.workMeta({pages:1,frames:0}),{label:'이어서',name:'작업 보드',meta:'마지막에 보던 판 그대로'});
  const src=fs.readFileSync(path.join(__dirname,'../studio/board-open-chooser.js'),'utf8');
  assert.match(src,/vd\.pending\(\)\.then\(function \(rec\)/);assert.match(src,/cont\.onclick = function \(\) \{ close\(win\); vd\.restore\(\); \}/);
  const vd=fs.readFileSync(path.join(__dirname,'../studio/board-vault-draft.js'),'utf8');
  assert.match(vd,/body:has\(#psOpenChooser\) #psVaultDraftBar\{display:none!important\}/,'창이 떠 있는 동안 초안 띠는 숨긴다');
});
