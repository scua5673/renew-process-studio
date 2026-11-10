'use strict';
/* 3.273 제보 0976735a — «되살리기» 띠는 내 보드를 불러올 때 한 번만 권했다. 그때 보관함 · 훈련 편집 · 미팅(같은 틀을 빌린 화면)이면
   건너뛰고 다시 묻지 않았다. offerWhenFree 는 불러온 기록마다 작업 보드가 처음 한가할 때 한 번 권한다. */
const test=require('node:test'),assert=require('node:assert/strict');
const {install}=require('../studio/board-draft.js');
function win(){
 const calls=[],w={calls,busy:true,changed:false,_boardPrivateOwner:{uid:'synthetic-u',wid:'synthetic-w'},_boardPrivateRecord:{token:'t1'},_boardPrivateLoaded:true,__boardRestoring:0,
  boardPrivateCurrent:()=>true,boardDraftBusy:()=>w.busy,boardManualChanged:()=>w.changed,boardDraftOffer:(o,r)=>{calls.push([o.uid,r&&r.token]);return Promise.resolve(true);},
  boardDraftWriteNow(){return false;},localStorage:{getItem:()=>null},document:{body:{classList:{contains:()=>false}}},clearTimeout(){},setTimeout(){return 0;}};
 return w;
}
test('빌린 화면에서는 기다렸다가 작업 보드가 한가해지면 한 번 권한다',()=>{
 const w=win(),api=install(w);
 assert.equal(api.offerWhenFree(),false);assert.equal(w.calls.length,0,'보관함 · 편집 중에는 권하지 않는다');
 w.busy=false;assert.equal(api.offerWhenFree(),true);assert.deepEqual(w.calls,[['synthetic-u','t1']]);
 assert.equal(api.offerWhenFree(),false);assert.equal(w.calls.length,1,'같은 기록에는 한 번만');
});
test('손대는 중 · 불러오는 중 · 주인이 바뀐 동안은 권하지 않고, 새 기록은 다시 한 번',()=>{
 const w=win(),api=install(w);w.busy=false;
 w.changed=true;assert.equal(api.offerWhenFree(),false);
 w.changed=false;w.__boardRestoring=3;assert.equal(api.offerWhenFree(),false);
 w.__boardRestoring=0;w._boardPrivateLoaded=false;assert.equal(api.offerWhenFree(),false);
 w._boardPrivateLoaded=true;w.boardPrivateCurrent=()=>false;assert.equal(api.offerWhenFree(),false);assert.equal(w.calls.length,0);
 w.boardPrivateCurrent=()=>true;assert.equal(api.offerWhenFree(),true);
 w._boardPrivateRecord={token:'t2'};assert.equal(api.offerWhenFree(),true);assert.deepEqual(w.calls.map(c=>c[1]),['t1','t2']);
 w._boardPrivateRecord=null;assert.equal(api.offerWhenFree(),true,'저장본이 없는 보드도 초안은 권한다');
});
