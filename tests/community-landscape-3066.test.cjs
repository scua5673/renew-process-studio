'use strict';
/* 3.066 — 폰을 가로로 돌려 커뮤니티 글을 보면 판이 124px 로 눌렸다(엘미하 글). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const comm=fs.readFileSync(path.join(__dirname,'..','studio','community.html'),'utf8');
test('커뮤니티 뷰어 창은 폰 가로에서 화면을 다 쓴다',()=>{
  assert.match(comm,/@media\(max-height:500px\) and \(orientation:landscape\)\{\s*\.cv-mask\{padding:0;align-items:stretch\}\.cv-shell\{width:100%;height:100%;border:0;border-radius:0\}/);
});
test('보드 뷰어는 폰 가로에서 판이 화면 높이를 다 쓴다',()=>{
  const i=board.indexOf('@media (max-height:500px) and (orientation:landscape){');assert.ok(i>0);
  const blk=board.slice(i,board.indexOf('\n  }',i));
  assert.match(blk,/body\.comm-viewing #editorBoardWrap #boardStage\{flex:0 0 auto!important;height:100dvh!important;aspect-ratio:auto!important;max-height:none!important\}/);
});
test('보다가 돌리면 보기 전용 뷰어만 판 방향을 다시 세운다',()=>{
  const i=board.indexOf('var _commRotT=0;');assert.ok(i>0&&i<board.indexOf('window.__commView=function('));
  const blk=board.slice(i,board.indexOf('window.__commView=function('));
  assert.match(blk,/if\(!document\.body\.classList\.contains\("comm-viewing"\)\|\|__commEdit\)return;/);
  assert.match(blk,/window\.innerWidth<=600\?"v":\(window\.innerHeight<=500&&window\.innerWidth>window\.innerHeight\?"h":null\)/);
});
