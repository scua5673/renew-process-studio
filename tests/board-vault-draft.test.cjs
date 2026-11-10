'use strict';
/* 0976735a — 보관함에서 만들던 작전판의 기기 초안(board-vault-draft.js). 화면 흐름은 tests/browser/vault-board-draft. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('../studio/board-vault-draft.js');
const o={uid:'synthetic-coach',wid:'synthetic-team',seal:'s'},doc={snap:{players:[{x:1}]},frames:[{snap:{players:[{x:1}]}},{snap:{players:[{x:2}]}}],pages:null};
test('the key is device-only, per account and team, under the registered private-board prefix',()=>{
 assert.equal(D.key(o),'ps_private_board_draft_v1:synthetic-coach:vault-unsaved:synthetic-team');
 const keys=require('../studio/storage-keys.js');
 const info=(keys.info||keys.PSStorageKeys&&keys.PSStorageKeys.info);if(info)assert.equal(info(D.key(o)).key,'ps_private_board_draft_v1:');
 assert.equal(/:kept:/.test(D.key(o)),false);assert.equal(/:unsaved$/.test(D.key(o)),false,'never mistaken for the working-board draft');
});
test('only the same account and team can read a draft; broken text is not a draft',()=>{
 const raw=D.make(o,doc,{name:'가상',folder:'f',tags:['a'],book:true},1000),r=D.parse(raw,o);
 assert.equal(r.at,1000);assert.equal(r.libId,null);assert.equal(r.book,1);assert.deepEqual(r.doc,doc);assert.equal(r.text,raw);
 assert.equal(D.parse(raw,{uid:'other',wid:o.wid}),null);assert.equal(D.parse(raw,{uid:o.uid,wid:'other-team'}),null);
 assert.equal(D.parse('{',o),null);assert.equal(D.parse(null,o),null);assert.equal(D.parse(JSON.stringify({v:1,uid:o.uid,wid:o.wid,at:1,raw:'[]'}),o),null);
 assert.equal(D.parse(JSON.stringify({v:1,uid:o.uid,wid:o.wid,at:0,raw:JSON.stringify(doc)}),o),null);
});
test('the newer of the two stores wins and a foreign copy never does',()=>{
 const a=D.make(o,doc,{},1000),b=D.make(o,doc,{},2000),x=D.make({uid:'other',wid:o.wid},doc,{},9000);
 assert.equal(D.pick(a,b,o).at,2000);assert.equal(D.pick(b,a,o).at,2000);assert.equal(D.pick(a,null,o).at,1000);assert.equal(D.pick(null,b,o).at,2000);
 assert.equal(D.pick(a,x,o).at,1000);assert.equal(D.pick(null,x,o),null);
});
test('a draft is stale only when its own vault item was saved after it',()=>{
 const linked=D.parse(D.make(o,doc,{libId:'V1'},1000),o),fresh=D.parse(D.make(o,doc,{},1000),o);
 assert.equal(D.stale(linked,{libId:'V1',savedAt:1000}),true);assert.equal(D.stale(linked,{libId:'V1',savedAt:999}),false);
 assert.equal(D.stale(linked,null),false,'a missing item (failed save, deleted) keeps the draft');assert.equal(D.stale(fresh,{savedAt:5000}),false);
});
test('scene count reads pages first, then frames',()=>{
 assert.equal(D.scenes(doc),2);assert.equal(D.scenes({snap:{},pages:[{anim:{frames:[1,2,3]}},{anim:{frames:[1,2]}},{}]}),5);assert.equal(D.scenes({snap:{}}),0);
});
test('the board loads the module, exposes the create entry it restores through, and the worker precaches it',()=>{
 const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8'),sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),src=fs.readFileSync(path.join(__dirname,'../studio/board-vault-draft.js'),'utf8');
 assert.match(board,/<script src="board-vault-draft\.js"><\/script>/);assert.match(board,/window\.__vaultNewBoard=newBoardItem;/);
 assert.match(sw,/'\/studio\/board-vault-draft\.js'/);
 // 보관함 · 서버에는 쓰지 않는다: 저장 함수 · 동기화를 부르지 않는다
 assert.equal(/libSet|libWrite|libTurn|__vaultSave\b|PSSync/.test(src),false);
 // 되살리기는 늘 새 항목 만들기로(원래 자료를 열어 덮지 않는다)
 assert.match(src,/w\.__vaultNewBoard\('board'/);assert.equal(/__curVaultId\s*=[^=]/.test(src),false);
});
