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

test('2.941 — 기기 대기열이 하루를 넘으면 며칠째인지 말한다',()=>{
  const day=86400000,now=Date.UTC(2026,9,5,3,0,0);
  const stuck=view({kind:'pending',n:3,oldest:now-2*day-5,now});
  assert.equal(stuck.kind,'bad');assert.equal(stuck.text,'2일째 저장 대기 · 3건');assert.equal(stuck.action,'retry');assert.equal(stuck.attention,true);
  assert.match(stuck.detail,/동기화 진단/);
  assert.equal(view({kind:'pending',n:3,oldest:now-23*3600000,now}).text,'저장 대기','하루 안이면 그대로');
  assert.equal(view({kind:'bad',reason:'sync_permission',n:1,oldest:now-3*day,now}).text,'3일째 저장 대기 · 1건');
  assert.equal(view({kind:'bad',reason:'sync_auth',n:1,oldest:now-3*day,now}).action,'login','로그인 필요는 그대로');
  assert.equal(view({kind:'busy',n:1,oldest:now-3*day,now}).text,'저장 중…','저장 중엔 그대로');
  assert.equal(view({kind:'ok',at:100,n:0,oldest:now-3*day,now}).text,'저장됨','대기열이 비면 날짜는 무관');
});
