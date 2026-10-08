'use strict';
/* 2.968 — 팀 공간 보관함은 «내게 보일 폴더»만. 폴더 목록·정보는 팀 공용 문서 한 벌이라
   다른 코치의 비공개 폴더 이름이 빈 폴더로 보이고, 지운 폴더를 다른 기기·옛 판이 되살렸다(10/8 제보 팀 실측). */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const A=source.indexOf('  function folderNorm('),B=source.indexOf('  /* ══ 2.967 · 순수 함수 끝 ══ */');
const J=x=>JSON.parse(JSON.stringify(x));
function ctx(){const c={Object,String,JSON};vm.createContext(c);vm.runInContext(source.slice(A,B),c);return c;}
const ME='610822c7',OTHER='3f14970d';

test('another coach’s empty private folder is not shown, but anything with my visible items always is',()=>{
  const c=ctx();
  const list=['팀 공유','tactice','세트피스 수비','legacy 빈','다른 코치/내 자료 있음'];
  const meta={'팀 공유':{shared:true,by:ME},'tactice':{by:ME},'세트피스 수비':{by:OTHER},'다른 코치':{by:OTHER}};
  const lib=[{folder:'tactice'},{folder:'다른 코치/내 자료 있음'}];
  assert.deepEqual(J(c.folderShownList(list,lib,meta,ME,true)),['팀 공유','tactice','legacy 빈','다른 코치/내 자료 있음']);
  assert.deepEqual(J(c.folderShownList(list,[],meta,OTHER,true)),['팀 공유','세트피스 수비','legacy 빈','다른 코치/내 자료 있음'],'the other coach (own library: empty) sees their own empty folder, not my «tactice»');
  assert.equal(c.folderShownList(['세트피스 수비'],[],meta,ME,false).length,1,'personal space shows everything not hidden');
});

test('a folder I deleted stays hidden even if a stale list puts it back, unless an item I can see is inside',()=>{
  const c=ctx();
  let meta=c.folderHideMark({'rondo':{color:'red'}},'rondo',ME,100);
  assert.deepEqual(J(meta),{'rondo':{color:'red',hid:{[ME]:100}}});
  const stale=['팀 공유','rondo','rondo/4v2','Physical'];
  assert.deepEqual(J(c.folderShownList(stale,[],meta,ME,true)),['팀 공유','Physical'],'deleted folder and its children stay hidden for me');
  assert.deepEqual(J(c.folderShownList(stale,[],meta,OTHER,true)),stale,'other coaches are not affected');
  assert.ok(c.folderShownList(stale,[{folder:'rondo/4v2'}],meta,ME,true).includes('rondo/4v2'),'items are never hidden');
});

test('re-creating a folder I hid clears only my mark',()=>{
  const c=ctx();
  const meta={'rondo':{hid:{[ME]:1,[OTHER]:2},color:'red'},'x':{hid:{[ME]:1}}};
  assert.deepEqual(J(c.folderUnhide(meta,'rondo',ME)),{'rondo':{hid:{[OTHER]:2},color:'red'},'x':{hid:{[ME]:1}}});
  assert.deepEqual(J(c.folderUnhide(meta,'x',ME)),{'rondo':{hid:{[ME]:1,[OTHER]:2},color:'red'}},'an entry left empty is removed');
  assert.equal(c.folderUnhide(meta,'none',ME),null);
});

test('a shared folder is visible to the team even when empty, but my own hide mark wins',()=>{
  const c=ctx();
  const meta={'세트피스':{shared:true,by:OTHER},'세트피스/코너':{by:OTHER}};
  assert.deepEqual(J(c.folderShownList(['세트피스','세트피스/코너'],[],meta,ME,true)),['세트피스','세트피스/코너'],'shared inheritance');
  assert.deepEqual(J(c.folderShownList(['세트피스'],[],c.folderHideMark(meta,'세트피스',ME,5),ME,true)),[]);
});

test('the vault draws folders through the visibility rule and deletes leave a hide mark',()=>{
  const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>0,a);return source.slice(i,source.indexOf(b,i+a.length));};
  assert.match(slice('  function folderChildren(path){','\n'),/foldersShown\(\)\.forEach/);
  assert.match(source,/folders=foldersShown\(\)\.slice\(\)\.sort\(\)/);
  assert.match(source,/foldersShown\(\)\.slice\(\)\.sort\(\)\.forEach\(function\(f\)\{frow/);
  assert.match(source,/if\(!foldersShown\(\)\.length\)\{var empty=/);
  const del=slice('  function vaultDelFolder(full){','  function vaultTogglePin(');
  assert.equal((del.match(/folderHideMark\(folderMeta,full,_me,Date\.now\(\)\)/g)||[]).length,2,'both the hide-only and the delete path leave my mark');
  assert.match(del,/다른 코치가 만든 폴더예요 — 내 보관함에서만 숨길까요/);
  assert.match(slice('  function folderClaim(p){','\n  }'),/folderUnhide\(folderMeta,p,me\)/);
  assert.match(slice('  function addFolder(name){','\n  /* 2.968'),/folderClaim\(name\)/);
  assert.match(slice('      function _renameFolder(src,ndest){','  /* ══ 2.518'),/folderClaim\(ndest\)/);
  assert.match(slice('  function vaultMoveFolder(src,dest){','  function _zoneAt('),/folderClaim\(ndest\)/);
  assert.doesNotMatch(source,/folderOwnStamps/,'opening the vault never writes creator stamps on its own');
  assert.match(source,/folderLibSeen=lib;/);
});
