'use strict';
/* 3.121 — 유니폼 꾸미기 «토큰 미리보기»(studio/board-kit.js). 사용자 «토큰 유니폼 설정할 때 미리보기 가능하게 해줘 유니폼 설정에서».
   창 가운데에 판에서 보일 원형 · 유니폼 토큰(3.120 board-jersey.js 그림)을 그리고, 색 · 무늬 · 골키퍼를 바꿀 때마다(paint) 다시 그린다.
   실제 창은 tests/browser/board-kit-preview.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../studio/board-kit.js'),'utf8');
const fn=name=>{const i=src.indexOf('function '+name+'(');assert.ok(i>0,name);let d=0,j=src.indexOf('{',i);for(let k=j;k<src.length;k++){if(src[k]==='{')d++;else if(src[k]==='}'&&--d===0)return src.slice(i,k+1);}return '';};

test('the editor shows both token shapes under the big kit figure',()=>{
  assert.match(src,/var PREV = \[\['circle', '원형'\], \['shirt', '유니폼'\]\];/);
  const at=src.indexOf('<div class="ke-h">토큰 미리보기');
  assert.ok(at>src.indexOf("kitHTML('ke-fig')")&&at<src.indexOf('<div class="ke-h">빠른 조합'),'큰 그림 아래 · 빠른 조합 위');
  assert.match(src,/'#psKitEd \.ke-tok\.on span:after\{content:" · 지금 판"/,'지금 판에서 쓰는 모양 표시');
});

test('every repaint redraws the preview, with the same drawing as the board (base shape + PSJersey + number)',()=>{
  assert.match(fn('paint'),/paintPrev\(s\);/);
  const d=fn('drawToken');
  assert.match(d,/J\.spec\(shape, \{ main: main, acc: s\.accent, pat: s\.pat, stroke: stroke, sleeve: x\.sleeve, trim: x\.trim, collar: x\.collar, autoStroke: !s\.stroke \}\)/,'3.123 소매 · 테두리 · 목깃도');
  assert.match(d,/win\.kitSVGDef\(id, main, s\.accent, s\.pat\)/,'무늬는 작전판과 같은 기하');
  assert.match(d,/J\.SHIRT_D/);assert.match(d,/'stroke-width': '2\.6'/);assert.match(d,/'stroke-width': '2\.2'/);
  assert.match(fn('paintPrev'),/ed\.gk \? '1' : '10'/,'골키퍼는 1번');
  assert.match(fn('paintPrev'),/shape === 'person' \? 'shirt' : shape/,'«사람»은 평면에서 유니폼 모양');
});

test('preview values go through setAttribute only (team colours can come from shared boards)',()=>{
  const d=fn('drawToken');
  assert.doesNotMatch(d,/innerHTML|insertAdjacentHTML/);
  assert.match(d,/createElementNS\(NS, tag\)/);assert.match(d,/t\.textContent = num/);
});

test('version and release notes',()=>{
  const v=+(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8').match(/const CACHE = 'process-3\.(\d{3})'/)||[])[1];assert.ok(v>=121,'판 3.121 이상 '+v);
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/release-notes.js'),'utf8'),/v3\.121 · 유니폼 꾸미기에서 토큰을 미리 봐요/);
});
