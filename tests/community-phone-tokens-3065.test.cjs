'use strict';
/* 3.065 — 폰으로 커뮤니티 글을 열면 토큰 · 이름이 점처럼 작았다(사용자 «토큰이 너무 작게 보이는 거 같은데 폰으로 볼 때 · 커뮤니티에 엘미하가 올린 거»). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=board.indexOf(from); assert.ok(a>0,from); const b=board.indexOf(to,a); assert.ok(b>a,to); return board.slice(a,b); }
const SRC=cut('var COMM_PHONE_TOK=','function tokenTransform(');
function run(cls,w,dev,thumb){ const c=vm.createContext({document:{body:{classList:{contains:k=>cls.includes(k)}}},window:{innerWidth:w,__psThumbNoEd:thumb},psBoardDevice:()=>dev}); vm.runInContext(SRC+';this.f=commViewTok();',c); return c.f; }
test('보기 전용 뷰어 · 폰 폭이면 토큰을 키운다',()=>{
  assert.equal(run(['comm-viewing','editing'],375,'phone',false),1.6);
  assert.equal(run(['comm-viewing','editing'],1200,'desktop',false),1,'넓은 화면 뷰어는 편집기 축소만 뺀다');
  assert.equal(run(['editing'],375,'phone',false),0,'편집기는 예전 그대로(×0.68)');
  assert.equal(run(['comm-viewing'],375,'phone',true),0,'썸네일을 뜰 때는 손대지 않는다');
});
test('토큰 배율 두 곳(그리기 · 잡기)이 같은 규칙을 쓴다',()=>{
  assert.equal((board.match(/const _cv=commViewTok\(\);const _ed=_cv\?_cv:/g)||[]).length,1);
  assert.equal((board.match(/var _cv=commViewTok\(\);var _ed=_cv\?_cv:/g)||[]).length,1);
});
test('폰 뷰어의 판 칸은 3:4 — 세로 판이 폭을 채운다',()=>{
  assert.match(board,/body\.comm-viewing #editorBoardWrap #boardStage\{flex:0 0 auto!important;height:auto!important;aspect-ratio:3\/4!important;max-height:none!important\}/);
});
