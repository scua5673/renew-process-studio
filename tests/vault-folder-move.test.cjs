'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const move=require('../studio/vault-folder-move.js');

test('folder picker offers root and peers but never itself or its descendants',()=>{
  assert.deepEqual(move.destinations('공격',['공격','공격/측면','수비','세트피스/코너']),['','세트피스/코너','수비']);
  assert.deepEqual(move.destinations('세트피스/코너',['세트피스','세트피스/코너','세트피스/코너/공격']),['','세트피스']);
});

test('the scoped folder menu opens the picker with its scoped move functions',()=>{
  const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  const start=board.indexOf('function folderMenu('),end=board.indexOf('function vaultDelFolder(',start),menu=board.slice(start,end);
  assert.match(menu,/mi\("폴더 이동…"/);
  assert.match(menu,/PSVaultFolderMove\.open\(\{src:full,folders:foldersShown\(\),leaf:folderLeaf,onMove:function\(dest\)\{vaultMoveFolder\(full,dest\);\}\}\)/);
});
