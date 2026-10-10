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

/* 2.992 — 사람이 누르는 보관함 조작(고정·옮기기·이름·태그·분류·공유·복사·폴더·템플릿·saveToLib…)도 같은 차례를 탄다.
   전에는 차례 밖에서 libGet→libSet 을 돌려, 썸네일 차례가 쓰는 사이 읽은 옛 목록으로 그 썸네일을 지우거나 거꾸로 조작이 지워졌다. */
const userCode=['  function vaultMoveItemTo(','  function vaultTogglePin('].map(a=>slice(a,'\n')).join('\n');
const saveCode=slice('async function saveToLib(d){','async function addLibToSession(');
/* 겹침이 또렷하게 — 읽기 20ms, 쓰기 60ms(읽기는 부른 순간의 사본) */
function lagStore(lib){
  const st={raw:JSON.stringify(lib),writes:0};
  st.libGet=async()=>{const snap=st.raw;await sleep(20);return JSON.parse(snap);};
  st.libWrite=async l=>{const raw=JSON.stringify(l);await sleep(60);st.raw=raw;st.writes++;return true;};
  st.read=()=>JSON.parse(st.raw);
  return st;
}
function userCtx(st){
  const c=ctxWith(st,{renderDrillFiles(){},renderLibDock(){},renderLib(){},toast(){},folderNorm:s=>String(s||''),itemMine:()=>true,
    psVaultRequireLogin:()=>true,dc:J,stampCreator(){},localStorage:{getItem:()=>null,setItem(){}}});
  vm.runInContext(keepCode+userCode+saveCode+';this.keep=vxThumbKeep;this.pin=vaultTogglePin;this.move=vaultMoveItemTo;this.save=saveToLib;this.del=delFromLib;',c);
  return c;
}
test('a person’s vault action and the thumbnail turn overlap — both survive',async()=>{
  const st=lagStore([{libId:'A',savedAt:1},{libId:'V',savedAt:1},{libId:'W',savedAt:1,folder:''}]),c=userCtx(st);
  c.keep('V','svgV');
  await sleep(310);   /* 썸네일 차례(300ms 뒤)가 목록을 읽고 쓰는 사이에 사람이 누른다 */
  c.pin({libId:'A'});c.move('W','rondo');
  await c.save({name:'새 훈련'});
  const out=st.read();
  assert.equal(out.find(x=>x.libId==='V').thumb,'svgV','the thumbnail is kept');
  assert.equal(out.find(x=>x.libId==='A').pin,true,'pin kept');
  assert.equal(out.find(x=>x.libId==='W').folder,'rondo','move kept');
  assert.equal(out.filter(x=>x.name==='새 훈련').length,1,'saveToLib kept');
});
test('the thumbnail turn arriving while a person’s action is writing does not bring the old list back',async()=>{
  const st=lagStore([{libId:'A',savedAt:1},{libId:'W',savedAt:1}]),c=userCtx(st);
  c.keep('W','svgW');
  await sleep(270);   /* 삭제가 쓰는 중(270~350ms)에 썸네일 차례(300ms)가 온다 */
  await c.del('A');await c.libTurn(()=>null);   /* 그 뒤에 줄 선 썸네일 차례까지 끝난 뒤 */
  const out=st.read();
  assert.equal(out.some(x=>x.libId==='A'),false,'the delete is kept');
  assert.equal(out.find(x=>x.libId==='W').thumb,'svgW','the thumbnail is kept');
});
test('every vault action a person starts reads and writes inside one libTurn and returns the write',()=>{
  const sites=[['  function vaultMoveItemTo(','\n'],['  function vaultMoveFolder(src,dest){','  function _zoneAt('],['      function _renameFolder(src,ndest){','  /* ══ 2.518'],
    ['  function vaultDelFolder(full){','  function vaultTogglePin('],['  function vaultTogglePin(','\n'],['  function vaultRenameItem(d){','  /* 2.725'],
    ['  function vaultDupItem(d){','  /* ══ 2.518'],['  function itemShareToggle(d,after){','  /* ══ 2.928'],['    if(canEdit)mi("태그"','\n'],
    ['    function pick(k){','\n'],['      function moveTo(path){','\n'],['  function applyVaultTemplate(t){','    function vaultStarter(){']];
  for(const [a,b] of sites){
    const code=slice(a,b),writes=(code.match(/libSet\(/g)||[]).length;
    assert.ok(writes>0,a);
    assert.equal((code.match(/return (?:\(n\?)?libSet\(/g)||[]).length,writes,'the turn waits for every write: '+a.trim());
    assert.equal((code.match(/libTurn\(function\(\)\{return libGet\(\)\.then\(function\((?:lib|lib2|l2)\)\{/g)||[]).length,writes,'one turn per write: '+a.trim());
  }
  /* 확인 창 뒤에 차례 안에서 다시 읽는다 — 확인 전에 읽은 목록(안내 문구용)으로는 쓰지 않는다 */
  const del=slice('  function vaultDelFolder(full){','  function vaultTogglePin(');
  assert.match(del,/psConfirm\(msg,function\(\)\{\s*libTurn\(function\(\)\{return libGet\(\)\.then\(function\(lib2\)\{/);
  /* async 길: 읽기와 쓰기가 한 차례 안, 차례 앞에서는 읽지 않는다 */
  const asyncSites=[['async function seedTemplates(){','\n}'],['async function saveToLib(d){','async function delFromLib('],['async function delFromLib(libId){','\n'],
    ['async function importDrillPack(file){','\n}'],['async function boardLinkWriteBack(onlyCurrent){','\n}'],['    else if(editorLibId!=null){','    else if(editorDrillId!=null){'],
    ['window.__importSessionDrills=function(drills){','\n};']];
  for(const [a,b] of asyncSites){
    const code=slice(a,b);
    assert.match(code,/libTurn\(async(?:\(\)=>| function\(\))\{[\s\S]*?(?:const|let|var) lib=await libGet\(\)[;,][\s\S]*?await libWrite\(/,a);
    assert.doesNotMatch(code.slice(0,code.indexOf('libTurn(')),/libGet\(/,'no read before the turn: '+a);
  }
  /* 교착 막기: 훈련 편집기 «복사본으로 저장»은 차례에서 원본만 꺼내고 saveToLib(저도 차례를 탄다)는 차례가 끝난 뒤 */
  const ed=slice('    else if(editorLibId!=null){','    else if(editorDrillId!=null){');
  assert.match(ed,/if\(asCopy\)return \{src:dc\(d\)\};[\s\S]*?return \{saved:true\};\}\);\s*if\(r\)\{\s*if\(r\.src\)\{[^\n]*await saveToLib\(cp\)/);
});
test('awaiting saveToLib inside a turn would deadlock — reading in the turn and saving after it does not',async()=>{
  const lib=[{libId:'E',name:'훈련',savedAt:1}];
  const stuck=userCtx(lagStore(lib));
  const inside=stuck.libTurn(()=>stuck.libGet().then(l=>stuck.save(Object.assign(J(l[0]),{name:'훈련 복사본'}))));
  assert.equal(await Promise.race([inside.then(()=>'done'),sleep(400).then(()=>'stuck')]),'stuck','the hazard this guards against');
  const st=lagStore(lib),c=userCtx(st);
  const r=await c.libTurn(()=>c.libGet().then(l=>({src:J(l[0])})));
  const id=await c.save(Object.assign(r.src,{name:'훈련 복사본'}));
  assert.match(String(id),/^L/);
  assert.deepEqual(st.read().map(x=>x.name),['훈련 복사본','훈련']);
});
