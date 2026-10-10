'use strict';
/* 2.995 — 그리기용 보관함 읽기(psVaultReadForRender)도 차례(libTurn)를 기다린다.
   staging CI 웹킷 vault-folder-delete 실측: 폴더 지우기 차례가 폴더 목록에서 빼 저장한 뒤, 항목 이동(libSet)이 디스크에 닿기 전에
   다시 그리면 자가 치유가 아직 옛 폴더에 있는 항목을 보고 지운 폴더를 목록에 되살려 저장했다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>=0,a);const j=source.indexOf(b,i+a.length);assert.ok(j>i,b);return source.slice(i,j);};
function fnAt(src,start){const i=src.indexOf(start);assert.ok(i>=0,start);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(i,j+1);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const code=slice('var _libTurnTail=Promise.resolve();','function psVaultOpenLogin(){')+fnAt(source,'async function psVaultReadForRender(){');

function ctx(lib){
  const st={raw:JSON.stringify(lib)};
  const c={JSON,Promise,setTimeout,st,
    libGet:async()=>{const s=st.raw;await sleep(5);return JSON.parse(s);},
    libWrite:async l=>{const s=JSON.stringify(l);await sleep(20);st.raw=s;return true;},libTouch(){},
    psMyUid:()=>'me',psActiveWs:()=>({id:'team'}),psVaultUnlocked:()=>true,psVaultShowLock(){}};
  c.libSet=l=>c.libWrite(l).then(()=>c.libTouch());
  vm.createContext(c);vm.runInContext(code+';this.libTurn=libTurn;this.read=psVaultReadForRender;',c);return c;
}
const items=()=>[{libId:'A',folder:'팀 공유/공격'},{libId:'B',folder:'팀 공유/공격/공격-수비'},{libId:'C',folder:'팀 공유'}];
const deleteFolder=c=>c.libTurn(()=>c.libGet().then(lib=>{lib.forEach(d=>{if(d.folder.indexOf('팀 공유/공격')===0)d.folder='팀 공유';});return c.libSet(lib);}));

test('a render read started while a folder delete is writing sees the items already moved (no resurrection)',async()=>{
  const c=ctx(items());
  const del=deleteFolder(c);
  await sleep(8);   /* 지우기 차례가 읽고 쓰는 중 — 폴더 목록은 이미 빠졌고 항목 이동은 아직 디스크에 없다 */
  const seen=await c.read();
  await del;
  assert.deepEqual(seen.map(d=>d.folder),['팀 공유','팀 공유','팀 공유'],'self-heal would find no item left in the deleted folder');
});
test('without waiting for the turn the same read sees the old folders (the CI failure)',async()=>{
  const c=ctx(items());
  const del=deleteFolder(c);
  await sleep(8);
  const seen=await c.libGet();await del;
  assert.ok(seen.some(d=>d.folder==='팀 공유/공격'),'a plain read returns the list before the write');
});
test('the render read still drops a result from a different account or workspace',async()=>{
  const c=ctx(items());let uid='me';c.psMyUid=()=>uid;
  const p=c.read();uid='other';
  assert.equal(await p,null);
});
test('no render function is awaited or returned by anyone (inside a turn it would wait for itself)',()=>{
  /* render* 와 작성자 채우기는 psVaultReadForRender 로 차례를 탄다. 부르기만 하고 기다리지 않는다 */
  assert.doesNotMatch(source,/(?:return|await)\s+(?:renderDrillFiles|renderLib|renderLibDock|renderLibTray|maybeBackfillCreators)\(/);
});
