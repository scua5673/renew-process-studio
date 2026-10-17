'use strict';
/* 3.073 · 3.076 — 떠 있는 하단 도크(한 줄 · 도구 묶음 · «선수» 칸) */
const test=require('node:test'),assert=require('node:assert/strict');
const df=require('../studio/board-dock-float.js');
const ls=v=>({getItem:()=>v==null?null:JSON.stringify(v)});
test('tools are grouped into arrow, line and shape; the rest stand alone',()=>{
  assert.equal(df.groupOf('dribble').key,'arrow');assert.equal(df.groupOf('dashline').key,'line');assert.equal(df.groupOf('ellipse').key,'shape');
  assert.equal(df.groupOf('move'),null);assert.equal(df.groupOf('free'),null);assert.equal(df.groupOf('text'),null);
});
test('the dock state: one row by default, the «선수» panel remembers its tab, nonsense is ignored',()=>{
  assert.deepEqual(df.readOpen(ls(null)),{panel:'',tab:'team',anim:null,last:{}});
  assert.deepEqual(df.readOpen(ls({panel:'equip',tab:'form',anim:false,last:{arrow:'run'}})),{panel:'equip',tab:'form',anim:false,last:{arrow:'run'}});
  assert.deepEqual(df.readOpen(ls({panel:'x',tab:'y',anim:'z',last:5})),{panel:'',tab:'team',anim:null,last:{}});
});
