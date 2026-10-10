'use strict';
/* 2.991 — 보관함 «읽고-고치고-쓰기»를 한 줄로(libTurn). 리눅스 CI 웹킷 실측(45회 중 3회): 미팅 자동 저장이 새 내용을 쓴 1~27ms 뒤,
   그보다 먼저 목록을 읽어 둔 썸네일 채우기(vxThumbOf)가 옛 목록을 통째로 되써 자동 저장이 사라졌다(상태 줄은 «저장됨 ✓»). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};
const J=x=>JSON.parse(JSON.stringify(x));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const turnCode=slice('var _libTurnTail=Promise.resolve();','function psVaultOpenLogin(){');

/* 느린 저장소 — 읽기는 그 순간의 사본을 조금 늦게, 쓰기는 더 늦게 끝난다(IDB 처럼) */
function slowStore(lib){
  const st={raw:JSON.stringify(lib),writes:0};
  st.libGet=async()=>{const snap=st.raw;await sleep(5);return JSON.parse(snap);};
  st.libWrite=async l=>{const raw=JSON.stringify(l);await sleep(15);st.raw=raw;st.writes++;return true;};
  st.read=()=>JSON.parse(st.raw);
  return st;
}
function ctxWith(st,extra){
  const c=Object.assign({JSON,Math,Date,Promise,setTimeout,clearTimeout,libGet:st.libGet,libWrite:st.libWrite,libTouch(){}},extra||{});
  c.libSet=l=>c.libWrite(l).then(()=>{c.libTouch();});
  c.window=c;vm.createContext(c);vm.runInContext(turnCode+';this.libTurn=libTurn;this.libFix=libFix;',c);return c;
}

test('without a turn the later writer erases the earlier one (the CI failure, reproduced)',async()=>{
  const st=slowStore([{libId:'M',savedAt:1,n7:'-'},{libId:'V',savedAt:1}]);
  const thumb=st.libGet().then(lib=>{lib.find(x=>x.libId==='V').thumb='svg';return sleep(20).then(()=>st.libWrite(lib));});
  const save=st.libGet().then(lib=>{Object.assign(lib.find(x=>x.libId==='M'),{savedAt:2,n7:'김민수'});return st.libWrite(lib);});
  await Promise.all([thumb,save]);
  assert.equal(st.read().find(x=>x.libId==='M').n7,'-','the autosave was overwritten by the stale list');
});
test('libTurn: each read-modify-write reads after the previous write landed — nothing is lost',async()=>{
  const st=slowStore([{libId:'M',savedAt:1,n7:'-'},{libId:'V',savedAt:1}]),c=ctxWith(st);
  const thumb=c.libTurn(()=>c.libGet().then(lib=>{lib.find(x=>x.libId==='V').thumb='svg';return sleep(20).then(()=>c.libSet(lib));}));
  const save=c.libTurn(()=>c.libGet().then(lib=>{Object.assign(lib.find(x=>x.libId==='M'),{savedAt:2,n7:'김민수'});return c.libSet(lib);}));
  await Promise.all([thumb,save]);
  const out=st.read();
  assert.equal(out.find(x=>x.libId==='M').n7,'김민수','autosave kept');
  assert.equal(out.find(x=>x.libId==='V').thumb,'svg','thumbnail kept');
});
test('libTurn: a failed turn does not block the ones after it',async()=>{
  const st=slowStore([]),c=ctxWith(st);
  const bad=c.libTurn(()=>Promise.reject(new Error('quota')));
  const good=c.libTurn(()=>c.libGet().then(lib=>{lib.push({libId:'N'});return c.libSet(lib);}));
  await assert.rejects(bad,/quota/);await good;
  assert.deepEqual(st.read(),[{libId:'N'}]);
});
test('libFix re-applies a repair to the freshly read list and writes only when something changed',async()=>{
  const st=slowStore([{libId:'A',folder:'__mine'},{libId:'B',folder:''}]),c=ctxWith(st);
  const ghost=l=>{let n=0;l.forEach(d=>{if(String(d.folder||'').indexOf('__')===0){d.folder='';n++;}});return n;};
  const save=c.libTurn(()=>c.libGet().then(lib=>{lib.push({libId:'NEW',folder:'__all'});return c.libSet(lib);}));
  const fix=c.libFix(ghost);
  await Promise.all([save,fix]);
  assert.deepEqual(st.read().map(d=>[d.libId,d.folder]),[['A',''],['B',''],['NEW','']],'the save made just before is kept and repaired too');
  const w=st.writes;assert.equal(await c.libFix(ghost),false);assert.equal(st.writes,w,'nothing to repair → no write');
});

/* 썸네일 채우기 — 한 화면에서 그린 것을 모아 한 차례에 쓰고, 그 차례에 새로 읽은 목록에 넣는다 */
const keepCode=slice('  var _vxThumbPend=null;','  function vxThumbOf(d){');
test('thumbnail backfill: many items → one write, after the open item’s autosave, without undoing it',async()=>{
  const st=slowStore([{libId:'M',savedAt:1,n7:'-'},{libId:'V',savedAt:1},{libId:'W',savedAt:1,thumb:'mine'}]),c=ctxWith(st);
  vm.runInContext(keepCode+';this.keep=vxThumbKeep;',c);
  c.keep('M','svgM');c.keep('V','svgV');c.keep('W','svgW');
  await sleep(250);   /* 자동 저장이 썸네일 쓰기 직전에 끝난다 */
  await c.libTurn(()=>c.libGet().then(lib=>{Object.assign(lib.find(x=>x.libId==='M'),{savedAt:2,n7:'김민수',thumb:'slide1'});return c.libSet(lib);}));
  const before=st.writes;await sleep(200);
  const out=st.read();
  assert.equal(st.writes-before,1,'one write for every thumbnail drawn in that pass');
  assert.equal(out.find(x=>x.libId==='M').n7,'김민수','autosave kept');
  assert.equal(out.find(x=>x.libId==='M').thumb,'slide1','an item that already has a thumbnail keeps it');
  assert.equal(out.find(x=>x.libId==='V').thumb,'svgV');
  assert.equal(out.find(x=>x.libId==='W').thumb,'mine');
});

test('every board writer that runs on its own (no click) and can meet an open item’s autosave goes through a turn',()=>{
  const save=slice('  function vaultSaveCurrent(_o){','  try{window.__vaultSave=vaultSaveCurrent;}catch(_){}');
  assert.match(save,/libTurn\(function\(\)\{return libGet\(\)\.then\(function\(lib\)\{/,'the save itself');
  assert.equal((save.match(/return libSet\(lib\)\.then\(/g)||[]).length,2,'the turn lasts until the write lands');
  const thumbOf=slice('  function vxThumbOf(d){','  function vxFramesOf(');
  assert.doesNotMatch(thumbOf,/libSet|libWrite/,'vxThumbOf no longer writes the list itself');
  assert.match(slice('  function meetLibMutate(fn,_n){','  function meetSetMatch('),/libTurn\(/);
  assert.match(slice('function maybeBackfillCreators(){','\n}\n'),/libFix\(fill\)/);
});
