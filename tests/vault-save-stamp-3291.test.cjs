'use strict';
/* 3.291 — 보관함 자료를 쓰는 자리는 editedAt 도 함께 찍는다. 동기화(sync.js libTs)는 editedAt||savedAt 을 «편집 시각»으로 보고,
   팀 공간에서 편집 시각이 기준(rec.s)을 넘지 않은 지문 차이는 «계산 방식 변경»으로 보아 올리지 않는다(_syncLibrary 5974 줄 규칙).
   이름 바꾸기(editedAt 찍음) 뒤 내용 저장(savedAt 만)이면 내용이 영영 서버에 안 올라갔다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const board=fs.readFileSync(require.resolve('../studio/board.html'),'utf8'),sync=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8');
function once(src,needle,what){const i=src.indexOf(needle);assert.ok(i>=0,what+' missing');assert.equal(src.indexOf(needle,i+1),-1,what+' duplicated');return i;}
test('libTs prefers editedAt over savedAt — a stale editedAt hides a newer save',()=>{
 const i=once(sync,'function libTs(it){','libTs');const src=sync.slice(i,sync.indexOf('\n',i));const c={};vm.createContext(c);vm.runInContext(src+';this.libTs=libTs;',c);
 assert.equal(c.libTs({editedAt:100,savedAt:900}),100);assert.equal(c.libTs({savedAt:900}),900);assert.equal(c.libTs({editedAt:950,savedAt:900}),950);
});
test('every vault write site that bumps savedAt bumps editedAt with it',()=>{
 once(board,'lib[idx].editedAt=lib[idx].savedAt=Date.now();','vaultSaveCurrent existing item');
 once(board,'it.editedAt=it.savedAt=Date.now(); changed=true;','boardLinkWriteBack');
 once(board,'cp.editedAt=cp.savedAt=Date.now();cp.pin=false;','vaultDupItem copy');
 once(board,'lib[i].editedAt=lib[i].savedAt=Date.now(); return {ok:true};','meetRenameCur');
 once(board,'it.name=v;it.editedAt=it.savedAt=Date.now();','vaultRenameItem');
 const stale=board.match(/lib\[idx\]\.savedAt=Date\.now\(\);(?!\s*\/\*)/g);assert.equal(stale,null,'savedAt-only write on an existing vault item');
});
test('the vault idle probe exists and refuses unsaved · pending · hydrating · playing states',()=>{
 const i=once(board,'window.__psVaultIdle=function(){','__psVaultIdle');const src=board.slice(i,board.indexOf('};',i)+2);
 const run=(w,vars)=>{const c=Object.assign({window:null},vars);c.window=w;vm.createContext(c);vm.runInContext(src,c);return w.__psVaultIdle();};
 const quiet={_vaultAutoWriting:false,_vaultAutoAgain:false,_vaultAutoT:null,animPlaying:false};
 assert.equal(run({__vaultEdit:true},quiet),true,'saved item open');
 assert.equal(run({__vaultEdit:true,__vaultReadOnly:true,__vaultManualDirty:true},quiet),true,'read-only view');
 assert.equal(run({__vaultEdit:true,__vaultManualDirty:true},quiet),false,'unsaved change');
 assert.equal(run({__vaultEdit:true,__vaultPending:{type:'board'}},quiet),false,'new unsaved item');
 assert.equal(run({__vaultEdit:true,__vaultHydrating:true},quiet),false,'still opening');
 assert.equal(run({__vaultEdit:true},Object.assign({},quiet,{animPlaying:true})),false,'playing');
 assert.equal(run({__vaultEdit:true},Object.assign({},quiet,{_vaultAutoT:1})),false,'autosave pending');
 assert.equal(run({__vaultEdit:false},quiet),false,'not in the vault');
});
