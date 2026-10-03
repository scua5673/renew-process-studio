'use strict';
/* 2.936 — 셸이 보드에 보내는 boardPopover 메시지의 동작 판정(board.html __psBoardPopoverAction).
   예전엔 'close' 말고는 전부 토글이라 'sync'·'force-close' 가 닫힌 보기 메뉴를 열었다(폰 부팅 때 메뉴가 저절로 뜸). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const m=src.match(/window\.__psBoardPopoverAction=function\(action,id\)\{[\s\S]*?\n  \};/);
const win={};new Function('window',m[0])(win);const act=win.__psBoardPopoverAction;
test('close and force-close never open a menu',()=>{
  for(const a of ['close','force-close'])for(const id of ['view','more',undefined])assert.equal(act(a,id),'close');
});
test('sync does nothing for the old popover menus (no pinned concept)',()=>{
  assert.equal(act('sync','view'),null);assert.equal(act('sync','more'),null);
});
test('open opens, toggle (or no action) toggles',()=>{
  assert.equal(act('open','view'),'open');assert.equal(act('toggle','more'),'toggle');
  assert.equal(act(undefined,'view'),'toggle');assert.equal(act('','view'),'toggle');
});
test('unknown actions or ids do nothing',()=>{
  assert.equal(act('whatever','view'),null);assert.equal(act('toggle','other'),null);assert.equal(act('open',undefined),null);
});
test('the message handler routes through the judgement (no blanket toggle left)',()=>{
  const h=src.slice(src.indexOf('d.type!=="boardPopover"'),src.indexOf('d.type!=="boardPopover"')+1400);
  assert.match(h,/__psBoardPopoverAction\(d\.action,d\.id\)/);
  assert.doesNotMatch(h,/if\(d\.action==="close"\)closeMenus\(\);else if\(d\.id==="more"\|\|d\.id==="view"\)toggleMenu/);
});
