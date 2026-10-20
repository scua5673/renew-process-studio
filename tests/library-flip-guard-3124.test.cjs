'use strict';
// 3.124 — 오류 제보 ac40be30: 옛 판 아이패드가 맥에서 «팀 공유»로 옮긴 자료 17개를 옛 폴더 · 비공개로 되돌렸다.
// 공유 표시가 폴더와 어긋나면(flip) 시각을 보지 않고 이 기기 사본을 올렸다 — 옮김(2.967: editedAt=now)이 서버에 더 새것으로 있어도.
// 이제 서버가 더 새것이면 받는다. 그리고 보관함 확인(library_probe)은 고친 시각(updated_at)을 보아, 옛 시각으로 올린 줄도 다른 기기를 깨운다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sync=fs.readFileSync(path.join(__dirname,'..','studio','sync.js'),'utf8');
function cut(from,to){ const a=sync.indexOf(from); assert.ok(a>0,'start: '+from); const b=sync.indexOf(to,a+from.length); assert.ok(b>a,'end: '+to); return sync.slice(a,b); }
const LOOP=cut('    order.forEach(function(id){\n      var it=locMap[id], rec=m.li[id], s=srv[id];','    /* 로컬 무덤돌 → 서버');

/* 판정 고리만 떼어 가짜 서버 줄 하나로 돌린다. 폴더 «팀 공유»(와 그 아래)만 공유 폴더 */
function decide({local,rec,server}){
  const pushes=[],ctx=vm.createContext({
    order:['L1'],locMap:{L1:local},m:{li:rec?{L1:rec}:{}},srv:server?{L1:server}:{},now:9000,wid:'W',teamOnly:true,priv:true,
    delLocal:[],pullIds:[],mutated:false,
    libHash:it=>it.h,libTs:it=>+(it.editedAt||it.savedAt)||0,libUid:()=>'U',
    libFolderShared:f=>/^팀 공유(\/|$)/.test(String(f||'')),
    srvStamp:s=>Math.max(s.saved_at||0,s.deleted_at||0),
    libRow:(it,t,wid,p)=>({lib_id:it.libId,folder:it.folder,saved_at:t,private:p}),
    queueLibPush:row=>pushes.push(row)
  });
  vm.runInContext(LOOP,ctx);
  return {pushes,pull:[...ctx.pullIds],del:[...ctx.delLocal],li:ctx.m.li.L1};
}

test('옛 사본을 가진 기기는 다른 기기가 «팀 공유»로 옮긴 자료를 되돌리지 않고 받는다',()=>{
  // 아이패드: 10/19 이전 사본(폴더 ssg · 시각 100). 서버: 맥이 «팀 공유/ssg» 로 옮김(공개 · 시각 500)
  const r=decide({local:{libId:'L1',h:'old',folder:'ssg',editedAt:100},rec:{h:'old',s:100},server:{lib_id:'L1',private:false,saved_at:500,owner_id:'U'}});
  assert.deepEqual(r.pushes,[],'옛 사본을 올리지 않는다');
  assert.deepEqual(r.pull,['L1'],'서버의 새것을 받는다');
});

test('공유를 끈 것도 마찬가지 — 옛 «팀 공유» 사본이 다시 공개로 올리지 않는다',()=>{
  const r=decide({local:{libId:'L1',h:'old',folder:'팀 공유',editedAt:100,_teamSharedAt:50},rec:{h:'old',s:100},server:{lib_id:'L1',private:true,saved_at:500,owner_id:'U'}});
  assert.deepEqual(r.pushes,[]);assert.deepEqual(r.pull,['L1']);
});

test('이 기기에서 폴더 공유를 바꾼 것은 예전처럼 다시 올린다(서버가 더 새것이 아니면)',()=>{
  const r=decide({local:{libId:'L1',h:'a',folder:'팀 공유/ssg',editedAt:100},rec:{h:'a',s:100},server:{lib_id:'L1',private:true,saved_at:100,owner_id:'U'}});
  assert.equal(r.pushes.length,1);assert.equal(r.pushes[0].private,false,'공개로');assert.equal(r.pushes[0].saved_at,100,'시각은 그대로');
  assert.deepEqual(r.pull,[]);
});

test('옛 사본이 서버를 덮은 뒤에는 새 사본을 가진 기기(맥)가 제 것을 다시 올려 되살린다',()=>{
  // 맥: «팀 공유/ssg» · 시각 500 · 기준 500. 서버: 아이패드가 옛 시각 100 으로 비공개 · ssg 로 덮음
  const r=decide({local:{libId:'L1',h:'new',folder:'팀 공유/ssg',editedAt:500},rec:{h:'new',s:500},server:{lib_id:'L1',private:true,saved_at:100,owner_id:'U'}});
  assert.equal(r.pushes.length,1);assert.equal(r.pushes[0].folder,'팀 공유/ssg');assert.equal(r.pushes[0].saved_at,500);assert.equal(r.pushes[0].private,false);
});

test('양쪽을 다 고쳤으면 예전처럼 더 늦은 쪽이 이긴다',()=>{
  let r=decide({local:{libId:'L1',h:'mine',folder:'ssg',editedAt:300},rec:{h:'old',s:100},server:{lib_id:'L1',private:false,saved_at:500,owner_id:'U'}});
  assert.deepEqual(r.pushes,[]);assert.deepEqual(r.pull,['L1'],'서버가 더 늦다 → 받는다');
  r=decide({local:{libId:'L1',h:'mine',folder:'ssg',editedAt:700},rec:{h:'old',s:100},server:{lib_id:'L1',private:false,saved_at:500,owner_id:'U'}});
  assert.equal(r.pushes.length,1);assert.equal(r.pushes[0].saved_at,700,'이 기기가 더 늦다 → 올린다');assert.equal(r.pushes[0].private,true);
});

test('서버에서 지운 것이 더 새것이면 이 기기에서도 지운다(되살려 올리지 않는다)',()=>{
  const r=decide({local:{libId:'L1',h:'old',folder:'ssg',editedAt:100},rec:{h:'old',s:100},server:{lib_id:'L1',private:false,saved_at:100,deleted_at:600,owner_id:'U'}});
  assert.deepEqual(r.pushes,[]);assert.deepEqual(r.del,['L1']);
});

test('보관함 확인은 고친 시각(updated_at)으로 — 옛 시각으로 올린 줄도 다른 기기가 알아챈다',()=>{
  const probe=cut('  function probe(){','\n  return probe()');
  assert.match(probe,/select=updated_at&order=updated_at\.desc\.nullslast&limit=1/);
  assert.match(probe,/rows\[0\]\.updated_at/);
  assert.doesNotMatch(probe,/order=saved_at/);
});
