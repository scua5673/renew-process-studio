'use strict';
/* 3.081 — 운영 홈 «오늘 확인할 일» 한 줄(studio/admin-today.js). 못 받은 값은 0 이 아니라 «확인 못 함» */
const test=require('node:test'),assert=require('node:assert/strict');
const T=require('../studio/admin-today.js');
const byKey=s=>Object.fromEntries(T.tiles(s).map(t=>[t.key,t]));

test('five tiles in order, each going to its screen',()=>{
  assert.deepEqual(T.tiles({}).map(t=>[t.key,t.go]),[['support','support'],['comm','comm'],['errors','errors'],['overdue','followups'],['incident','back']]);
});
test('not yet answered is waiting, failed is unknown — neither reads as zero',()=>{
  const t=byKey({support:null,comm:undefined,errors:'3',overdue:-1});
  assert.equal(t.support.tone,'unknown');assert.equal(t.support.value,'—');assert.match(t.support.note,/확인 못 함/);
  assert.equal(t.comm.tone,'wait');
  assert.equal(t.errors.tone,'unknown','a string is not a count');
  assert.equal(t.overdue.tone,'unknown','a negative is not a count');
  assert.equal(t.incident.tone,'wait');
});
test('zero is calm, a count is highlighted — app errors in red',()=>{
  const t=byKey({support:0,comm:2,errors:5,overdue:0});
  assert.deepEqual([t.support.tone,t.support.note],['ok','없음']);
  assert.deepEqual([t.comm.tone,t.comm.value,t.comm.note],['warn','2','열린 신고']);
  assert.equal(t.errors.tone,'danger');
  assert.equal(t.overdue.tone,'ok');
});
test('incident counter: days since the last loss against the goal',()=>{
  assert.deepEqual((({tone,value,note})=>({tone,value,note}))(byKey({incident:{since_days:20,goal_days:56}}).incident),{tone:'plain',value:'20일',note:'목표 56일까지 36일'});
  assert.equal(byKey({incident:{since_days:3,goal_days:56}}).incident.tone,'warn');
  assert.equal(byKey({incident:{since_days:60,goal_days:56}}).incident.tone,'ok');
  assert.match(byKey({incident:{since_days:null,goal_days:56}}).incident.note,/기록된 사고 없음/);
  assert.equal(byKey({incident:null}).incident.tone,'unknown');
});
test('overdue counts only open follow-ups past their check date',()=>{
  const now=Date.parse('2026-10-17T00:00:00Z');
  const rows=[{status:'open',next_check_at:'2026-10-16T00:00:00Z'},{status:'in_progress',next_check_at:'2026-10-18T00:00:00Z'},
    {status:'closed',next_check_at:'2026-10-01T00:00:00Z'},{status:'verified',next_check_at:'2026-10-01T00:00:00Z'},{status:'open',next_check_at:null},{status:'deployed',next_check_at:'2026-10-10T00:00:00Z'}];
  assert.equal(T.overdueCount(rows,now),2);
  assert.equal(T.overdueCount(null,now),null);
});
