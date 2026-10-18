'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const move=require('../studio/vault-folder-move.js');

test('folder picker offers root and peers but never itself or its descendants',()=>{
  assert.deepEqual(move.destinations('공격',['공격','공격/측면','수비','세트피스/코너']),['','세트피스/코너','수비']);
  assert.deepEqual(move.destinations('세트피스/코너',['세트피스','세트피스/코너','세트피스/코너/공격']),['','세트피스']);
});

test('mount adds folder move immediately after open and keeps the original menu',()=>{
  const children=[{textContent:'열기'}],menu={children,insertBefore(node,before){const at=before?children.indexOf(before):children.length;children.splice(at,0,node);}},doc={readyState:'complete',getElementById:id=>id==='vMenu'?menu:null,createElement:()=>({})};
  let opened=0;const win={document:doc,folderMenu(){opened++;},closeVMenu(){},folderNorm:x=>x,foldersShown:()=>[],folderLeaf:x=>x,vaultMoveFolder(){}};
  move.mount(win);win.folderMenu({},'공격','',[]);assert.equal(opened,1);assert.deepEqual(children.map(x=>x.textContent),['열기','폴더 이동…']);
});
