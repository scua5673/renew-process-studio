'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {view}=require('../studio/autosave-status.js');
const confirmed={kind:'ok',at:100,n:0,review:0,archivedCount:0};

test('only an acknowledged active document can be described as saved',()=>{
  assert.equal(view(confirmed).text,'저장됨');
  for(const state of [null,{kind:'off'},{...confirmed,at:0},{...confirmed,n:1},{...confirmed,review:27},{kind:'busy',at:100},{kind:'pending',at:100},{kind:'bad',at:100}]){
    assert.equal(view(state).complete,false,JSON.stringify(state));
    assert.notEqual(view(state).text,'저장됨');
  }
});
test('archived original edits stay visible without falsely calling every edit saved',()=>{
  const state={...confirmed,archivedCount:27},snapshot=JSON.stringify(state),shown=view(state);
  assert.equal(shown.text,'일부 변경 별도 보관');assert.equal(shown.action,'recovery');
  assert.equal(shown.complete,true,'Only the active document has been acknowledged');
  assert.doesNotMatch(shown.text,/저장됨|27|선택/);assert.equal(JSON.stringify(state),snapshot);
  assert.equal(view({...state,n:1}).complete,false);assert.equal(view({...state,review:1}).complete,false);
});
test('offline, storage failure and authentication expose the appropriate next step',()=>{
  assert.equal(view({kind:'bad',reason:'sync_auth'}).action,'login');
  const offline=view({kind:'bad',reason:'sync_offline',n:2});
  assert.match(offline.text,/오프라인/);assert.equal(offline.action,'retry');
  const storage=view({kind:'bad',reason:'sync_storage'});
  assert.doesNotMatch(storage.text+storage.detail,/보관했|저장됨/);assert.equal(storage.attention,true);
});
test('the number of conflicts never becomes an ordinary document-choice prompt',()=>{
  const shown=view({kind:'ask',review:27,n:0});
  assert.equal(shown.text,'일부 변경 보관');assert.equal(shown.action,'retry');
  assert.doesNotMatch(JSON.stringify(shown),/27|문서 전체|내용 선택/);
});
test('a conflict and a server refusal have distinct truthful failure states',()=>{
  const conflict=view({kind:'bad',reason:'sync_conflict'}),refusal=view({kind:'bad',reason:'sync_server_rejected'});
  assert.notEqual(conflict.text,refusal.text);
  for(const shown of [conflict,refusal]){
    assert.equal(shown.complete,false);assert.equal(shown.action,'retry');assert.match(shown.detail,/오류 제보/);
    assert.doesNotMatch(shown.text+shown.detail,/인터넷|저장됨|안전하게|더 새로/);
  }
});
