'use strict';
/* 3.080 — 레이아웃 3단계: 오른쪽 선수 속성 패널 */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ins=require('../studio/board-inspector.js');
test('header line and footedness',()=>{
  assert.equal(ins.subLine({pos:'ST',num:9},''),'ST · #9');assert.equal(ins.subLine({pos:'ST',num:9,foot:'L'},'R'),'ST · #9 · 왼발','the player\'s own foot wins');
  assert.equal(ins.subLine({num:7},'R'),'#7 · 오른발','falls back to the roster');assert.equal(ins.subLine(null),'');
  const p={};assert.equal(ins.setFoot(p,'L'),true);assert.equal(p.foot,'L');ins.setFoot(p,'');assert.equal('foot' in p,false,'자동 removes it');ins.setFoot(p,'X');assert.equal('foot' in p,false);
  assert.deepEqual(ins.FEET.map(f=>f[0]),['','R','L']);
});
test('only in the floating dock, only while the panel is shown',()=>{
  const c=ins.css();
  assert.match(c,/body\.ps-dock-float\.ps-insp-on \.sel-ctl:not\(\.ps-selection-menu\)(:not\(#in\d+\)){16}:not\(\[style\*="display: none"\]\):not\(\[style\*="display:none"\]\)\{position:fixed/);
  assert.doesNotMatch(c,/body:not\(\.ps-dock-float\)/);
});
test('wiring: script tag after the film dock, offline cache',()=>{
  assert.match(fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8'),/<script src="board-dock-film\.js"><\/script><script src="board-inspector\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/'\/studio\/board-inspector\.js'/);
});
