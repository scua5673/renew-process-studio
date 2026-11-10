'use strict';
/* 3.273 — 경기 화면을 열 때 도는 동기화(syncMatchFromCloud)가 끝나면 모델을 비우고 다시 그린다. 그 전에 저장 대기(matchSaveTimer 320ms) 중인
   입력을 먼저 적지 않으면 방금 친 글 · 고른 값이 메모리에서 사라졌다(CI 웹킷 match-meet-parts · 제보 0ce6d0cc 와 같은 모양). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const s=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
test('syncMatchFromCloud flushes a pending match save before it resets the model',()=>{
  const i=s.indexOf('function syncMatchFromCloud(){'),body=s.slice(i,s.indexOf('\nfunction ',i+10));
  const flush=body.indexOf('matchFlushNow()'),reset=body.indexOf('matchState=null');
  assert.ok(i>0&&flush>0&&reset>0,'both present');assert.ok(flush<reset,'flush comes first');
});
