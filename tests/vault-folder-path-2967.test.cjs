'use strict';
/* 2.967 — 오류 제보(10/8) «팀공유 폴더 생성/삭제 과정에서 잘 안됩니다! 삭제가 되지 않습니다».
   서버 실측: 팀 폴더 목록에 «팀 공유/공격 /공격-수비»(공격 뒤 띄어쓰기)와 «팀 공유/공격/공격-수비»가 함께 있었다.
   board.html 보관함 모듈의 2.967 순수 함수 묶음을 잘라 그 상황을 그대로 재현한다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const A=source.indexOf('  function folderNorm('),B=source.indexOf('  /* ══ 2.967 · 순수 함수 끝 ══ */');
assert.ok(A>0&&B>A,'2.967 helper block present');
const J=x=>JSON.parse(JSON.stringify(x));
function ctx(){const c={Object,String,JSON};vm.createContext(c);vm.runInContext(source.slice(A,B),c);return c;}

/* 예전 화면이 하던 자가 치유(칸마다 trim) — 항목 경로에서 폴더 목록을 다시 채운다 */
function selfHeal(list,lib){const out=list.slice();lib.forEach(d=>{const f=String(d.folder||'').trim();if(!f||f.indexOf('__')===0)return;let acc='';f.split('/').forEach(s=>{s=s.trim();if(!s)return;acc=acc?acc+'/'+s:s;if(out.indexOf(acc)<0)out.push(acc);});});return out;}
function children(list,p){const pre=p?p+'/':'',set={};list.forEach(f=>{if(p&&f.indexOf(pre)!==0)return;const rest=p?f.slice(pre.length):f;const leaf=rest.split('/')[0];if(leaf)set[leaf]=1;});return Object.keys(set).sort();}
const SERVER_LIST=['팀 공유','tactice','w-up','팀 공유/w-up','팀 공유/pass drill','팀 공유/rondo','팀 공유/tactice','팀 공유/ssg','팀 공유/공격 /공격-수비','팀 공유/피지컬','팀 공유/공격','팀 공유/공격/수비','팀 공유/공격/공격-수비','ssg','pass drill','빌드업','세트피스 수비'];
const mine=()=>true;

test('the reported state shows two identical-looking «공격» folders, and the old delete was undone by self-heal',()=>{
  /* 재현 — 고치기 전 동작을 기록해 둔다 */
  assert.deepEqual(children(SERVER_LIST,'팀 공유').filter(x=>x.trim()==='공격'),['공격','공격 ']);
  const lib=[{libId:'a',folder:'팀 공유/공격 /공격-수비'},{libId:'b',folder:'팀 공유/공격 /공격-수비'}];
  const full='팀 공유/공격';   /* 빈 쪽(공백 없는 «공격») */
  lib.forEach(it=>{const f=it.folder;if(f===full||f.indexOf(full+'/')===0)it.folder='팀 공유';});   /* 옛 삭제: 글자 그대로 비교 */
  assert.equal(lib[0].folder,'팀 공유/공격 /공격-수비','old delete did not move the items');
  const after=selfHeal(SERVER_LIST.filter(fp=>!(fp===full||fp.indexOf(full+'/')===0)),lib);
  assert.ok(after.includes('팀 공유/공격'),'old self-heal brought the deleted folder back');
});

test('normalizing merges the two «공격» folders into one and the items into the visible one',()=>{
  const c=ctx(),lib=[{libId:'a',folder:'팀 공유/공격 /공격-수비'},{libId:'b',folder:'팀 공유/공격 /공격-수비',editedAt:1}];
  const list=c.folderListNorm(SERVER_LIST);
  assert.equal(list.filter(x=>x==='팀 공유/공격/공격-수비').length,1);
  assert.ok(!list.some(x=>/ \/|\/ | $/.test(x)),'no segment keeps outer spaces');
  assert.deepEqual(children(list,'팀 공유').filter(x=>x.trim()==='공격'),['공격']);
  assert.equal(c.folderLibNorm(lib,500,mine),2);
  assert.deepEqual(lib.map(x=>x.folder),['팀 공유/공격/공격-수비','팀 공유/공격/공격-수비']);
  assert.deepEqual(lib.map(x=>x.editedAt),[500,500],'my moved items carry a new edit time to the server');
  assert.equal(c.folderLibNorm(lib,900,mine),0,'a second pass changes nothing');
});

test('after normalizing, deleting «공격» moves the items up and self-heal does not bring it back',()=>{
  const c=ctx(),lib=[{libId:'a',folder:'팀 공유/공격 /공격-수비'},{libId:'b',folder:'팀 공유/공격 /공격-수비'},{libId:'c',folder:'팀 공유2'}];
  let list=c.folderListNorm(SERVER_LIST);c.folderLibNorm(lib,100,mine);
  const full='팀 공유/공격';
  assert.equal(c.folderForeign(lib,full,mine).length,0);
  assert.equal(c.folderItemsTo(lib,full,'팀 공유',200),2);
  list=c.folderListMove(list,full,null);
  assert.ok(!list.some(x=>x===full||x.indexOf(full+'/')===0));
  assert.deepEqual(J(selfHeal(list,lib).filter(x=>x===full||x.indexOf(full+'/')===0)),[],'deleted folder stays deleted');
  assert.equal(lib[2].folder,'팀 공유2','a sibling with the same prefix is not inside');
});

test('typing «/» in a folder name makes one folder, not a hidden nesting with a trailing space',()=>{
  const c=ctx();
  assert.equal(c.folderJoin('팀 공유','공격 /공격-수비'),'팀 공유/공격 ／공격-수비');
  assert.equal(c.folderJoin('','  수비  '),'수비');
  assert.equal(c.folderJoin('a','   '),'');
  assert.equal(c.folderNorm(' a //  b /'),'a/b');
  assert.equal(c.folderNorm('a　/b'),'a/b','full-width space is trimmed too');
  assert.equal(c.folderNorm('__mine'),'__mine','quick-view keys are left alone');
});

test('another coach’s items block delete, rename and move of that folder',()=>{
  const c=ctx(),lib=[{libId:'m',folder:'팀 공유',createdBy:'me'},{libId:'o',folder:'팀 공유/세트피스',_teamOwner:'other'}];
  const isMine=d=>!d._teamOwner;
  assert.deepEqual(c.folderForeign(lib,'팀 공유',isMine).map(x=>x.libId),['o']);
  assert.deepEqual(c.folderForeign(lib,'팀 공유/세트피스',isMine).map(x=>x.libId),['o']);
  assert.equal(c.folderForeign(lib,'tactice',isMine).length,0);
  const other=[{libId:'o',folder:'팀 공유/공격 ',_teamOwner:'other',editedAt:7}];
  c.folderLibNorm(other,99,isMine);
  assert.equal(other[0].folder,'팀 공유/공격');assert.equal(other[0].editedAt,7,'someone else’s item is only tidied for this screen');
});

test('share flag, colour and tags follow a rename or move, and disappear on delete',()=>{
  const c=ctx();
  const meta={'팀 공유':{shared:true},'팀 공유/공격':{color:'#C24A46'},'tactice':{pin:1}};
  const moved=c.folderMapMove(meta,'팀 공유','우리 팀 공유',c.folderMetaMerge);
  assert.deepEqual(JSON.parse(JSON.stringify(moved)),{'tactice':{pin:1},'우리 팀 공유':{shared:true},'우리 팀 공유/공격':{color:'#C24A46'}});
  const gone=c.folderMapMove(meta,'팀 공유',null,c.folderMetaMerge);
  assert.deepEqual(JSON.parse(JSON.stringify(gone)),{'tactice':{pin:1}},'a re-created «팀 공유» is no longer silently shared');
  assert.equal(c.folderMapMove(meta,'없는 폴더','x',c.folderMetaMerge),null,'untouched maps are not rewritten');
  const into=c.folderMapMove({'a':{shared:true},'b':{color:'red'}},'a','b',c.folderMetaMerge);
  assert.deepEqual(JSON.parse(JSON.stringify(into)),{'b':{shared:true,color:'red'}},'merging keeps what the destination already had');
  const tags=c.folderMapMove({'x':['코너'],'y':['수비']},'x','y',c.folderTagMerge);
  assert.deepEqual(JSON.parse(JSON.stringify(tags)),{'y':['수비','코너']});
  const norm=c.folderMapNorm({'팀 공유/공격 ':{color:'red'},'팀 공유/공격':{pin:1}},c.folderMetaMerge);
  assert.deepEqual(JSON.parse(JSON.stringify(norm)),{'팀 공유/공격':{pin:1,color:'red'}});
  assert.equal(c.folderMapNorm({'a':{}},c.folderMetaMerge),null);
});

test('folder moves keep paths below the moved folder and stamp only moved items',()=>{
  const c=ctx(),lib=[{folder:'rondo'},{folder:'rondo/4v2'},{folder:'rondo2',editedAt:3},{folder:''}];
  assert.equal(c.folderItemsMove(lib,'rondo','팀 공유/rondo',10),2);
  assert.deepEqual(lib.map(x=>x.folder),['팀 공유/rondo','팀 공유/rondo/4v2','rondo2','']);
  assert.deepEqual(lib.map(x=>x.editedAt),[10,10,3,undefined]);
  assert.deepEqual(J(c.folderListMove(['rondo','rondo/4v2','팀 공유','팀 공유/rondo'],'rondo','팀 공유/rondo')),['팀 공유/rondo','팀 공유/rondo/4v2','팀 공유']);
});

test('every folder action in the vault goes through the 2.967 rules',()=>{
  const slice=(a,b)=>{const i=source.indexOf(a);assert.ok(i>0,a);return source.slice(i,source.indexOf(b,i+a.length));};
  const del=slice('  function vaultDelFolder(full){','  function vaultTogglePin(');
  assert.match(del,/folderForeign\(lib,full,itemMine\)/);assert.match(del,/folderForeign\(lib2,full,itemMine\)/);
  assert.match(del,/folderItemsTo\(lib2,full,parent,Date\.now\(\)\)/);assert.match(del,/folderSettingsMove\(full,null\)/);
  const ren=slice('      function _renameFolder(src,ndest){','  /* ══ 2.518');
  assert.match(ren,/folderSettingsMove\(src,ndest\)/);assert.match(ren,/folderForeign\(lib,src,itemMine\)/);
  const mv=slice('  function vaultMoveFolder(src,dest){','  function _zoneAt(');
  assert.match(mv,/folderSettingsMove\(src,ndest\)/);assert.match(mv,/folderItemsMove\(lib,src,ndest,Date\.now\(\)\)/);
  assert.match(slice('  function vaultMoveItemTo(','\n'),/it\.editedAt=Date\.now\(\)/);
  assert.match(slice('      function moveTo(path){','\n'),/it\.editedAt=Date\.now\(\)/);
  const share=slice('  function itemShareToggle(d,after){','  /* ══ 2.928');
  assert.equal((share.match(/it\.editedAt=Date\.now\(\)/g)||[]).length,2);
  assert.match(slice('  function setFolderMeta(','\n'),/folderSettingsLoad\(\)/);
  assert.match(slice('  function setFolderTags(','\n'),/folderSettingsLoad\(\)/);
  assert.match(source,/if\(folderLibNorm\(lib,Date\.now\(\),itemMine\)\)libSet\(lib\);/);
  /* 렌더 서명에 폴더 목록·정보·태그 — 빈 폴더 만들기·지우기·☁ 가 화면에 바로 보이게 */
  assert.match(source,/window\.__vaultView\|\|"",vaultFolders,folderMeta,folderTags,/);
  assert.doesNotMatch(source,/_renameFolder\(full,\(parent\?parent\+"\/":""\)\+nn\.trim\(\)\)/);
  assert.doesNotMatch(source,/var np=path\?path\+"\/"\+nm\.trim\(\):nm\.trim\(\)/);
});
