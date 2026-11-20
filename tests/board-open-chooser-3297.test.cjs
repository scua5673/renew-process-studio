const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.297 — 앱을 열면 «불러오기» 창(studio/board-open-chooser.js). 사용자 «처음 열었을 때 보드가 나오는데 불러오기 형태로 불러올 수 있게» → 목업 B-1.
   순수 규칙(누구에게 · 언제 뜨나 · 목록 · 글)은 여기, 실제 창 · 열기 · 설정 줄은 tests/browser/board-open-chooser-3297.mjs. */
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const OC=require('../studio/board-open-chooser.js');

const NOW=new Date(2026,10,15,19,10).getTime();   /* 2026-11-15 19:10 */
const ymd=(y,m,d,h=9)=>new Date(y,m-1,d,h,0).getTime();
const snap=()=>({players:[{id:1,team:'blue',num:'7',x:100,y:100}],equipment:[],drawings:[],ball:null});
const lib=()=>[
  {libId:'L1',type:'board',name:'4-3-3 빌드업 기본형',folder:'미팅 자료',savedAt:ymd(2026,11,13),pages:[{snap:snap(),anim:{frames:[1,2,3]}},{snap:snap(),anim:{frames:[1,2,3]}}]},
  {libId:'L2',type:'board',name:'수비 전환',folder:'미팅 자료',savedAt:ymd(2026,11,12),snap:snap(),frames:[1,2,3,4]},
  {libId:'L3',type:'board',name:'코너킥 공격',folder:'세트피스/공격',savedAt:ymd(2026,11,9),snap:snap()},
  {libId:'L4',type:'board',name:'론도 4v2',savedAt:ymd(2026,11,7),snap:snap()},
  {libId:'L5',type:'train',name:'훈련 카드',savedAt:ymd(2026,11,15),snap:snap()},          /* 훈련은 작전판이 아니다 */
  {libId:'L6',type:'board',name:'판 없는 작전판',savedAt:ymd(2026,11,15)},                 /* 판이 없으면 열 것이 없다 */
  {libId:'L7',type:'board',name:'오늘 저장',editedAt:NOW-60000,snap:snap()},              /* savedAt 없이 editedAt 만 */
  null,'글',[1]
];

test('boards: 보관함의 작전판(type board · 판 있음)만 · 최근 저장 순 · editedAt 도 시각으로 친다',()=>{
  const b=OC.boards(lib());
  assert.deepEqual(b.map(d=>d.libId),['L7','L1','L2','L3','L4']);
  assert.deepEqual(OC.boards(null),[]);
  assert.deepEqual(OC.boards('x'),[]);
});

test('meta: 날짜 · 페이지 · 장면 · 폴더 — 있는 것만, 오늘 · 어제는 시각으로',()=>{
  const [l7,l1,l2,l3,l4]=OC.boards(lib());
  assert.equal(OC.meta(l1,NOW),'11/13 · 페이지 2 · 장면 6 · 미팅 자료');
  assert.equal(OC.meta(l2,NOW),'11/12 · 장면 4 · 미팅 자료');
  assert.equal(OC.meta(l3,NOW),'11/9 · 공격','폴더는 마지막 마디만');
  assert.equal(OC.meta(l4,NOW),'11/7');
  assert.equal(OC.meta(l7,NOW),'오늘 19:09');
  assert.equal(OC.dateLabel(ymd(2026,11,14,8),NOW),'어제 08:00');
  assert.equal(OC.dateLabel(ymd(2025,3,2),NOW),'2025/3/2','다른 해는 해를 붙인다');
  assert.equal(OC.dateLabel(null,NOW),'');
  assert.equal(OC.meta({type:'board',snap:snap()},NOW),'');
});

test('folders: 전체가 먼저, 많은 순, 폴더 없는 자료는 «폴더 없음»',()=>{
  const f=OC.folders(OC.boards(lib()));
  assert.deepEqual(f.map(x=>[x.name,x.n]),[['전체',5],['미팅 자료',2],['폴더 없음',2],['공격',1]],'많은 순 · 같으면 이름순');
  assert.equal(f[0].key,null);
  assert.equal(f[1].key,'미팅 자료');
  const noFolder=f.find(x=>x.name==='폴더 없음');assert.equal(noFolder.key,'');assert.equal(noFolder.n,2);
});

test('filter: 폴더(키 그대로) · 이름 찾기(대소문자 · 앞뒤 빈칸 무시)',()=>{
  const b=OC.boards(lib());
  assert.deepEqual(OC.filter(b,{folder:'미팅 자료'}).map(d=>d.libId),['L1','L2']);
  assert.deepEqual(OC.filter(b,{folder:''}).map(d=>d.libId),['L7','L4'],'폴더 없는 자료');
  assert.deepEqual(OC.filter(b,{folder:null,q:' 빌드업 '}).map(d=>d.libId),['L1']);
  assert.deepEqual(OC.filter(b,{q:'없는 이름'}),[]);
  assert.equal(OC.filter(b,null).length,5);
});

test('decide: 셸 안 · 켜짐 · 아직 안 뜸 · 보이는 보드 · 잠금 풀림 · 선수 아님 · 작업 보드 화면 · 작전판 1개 이상',()=>{
  const ok={inShell:true,pref:true,shown:false,visible:true,unlocked:true,role:'coach',viewOnly:false,csView:'board',vault:false,capturing:false,community:false,meeting:false,editing:false,deeplink:false,count:3};
  assert.deepEqual(OC.decide(ok),{show:true,why:'ok'});
  assert.equal(OC.decide({...ok,count:undefined}).show,true,'보관함을 읽기 전엔 수를 모른다 — 다른 조건만 본다');
  const no=(patch,why)=>{const d=OC.decide({...ok,...patch});assert.equal(d.show,false,why);assert.equal(d.why,why);};
  no({inShell:false},'standalone');
  no({pref:false},'pref-off');
  no({shown:true},'shown');
  no({visible:false},'not-visible');
  no({unlocked:false},'locked');
  no({role:'player'},'player');
  no({viewOnly:true},'view-only');
  no({csView:'session'},'view:session');
  no({vault:true},'vault');
  no({capturing:true},'capturing');
  no({community:true},'community');
  no({meeting:true},'meeting');
  no({editing:true},'editing');
  no({deeplink:true},'deeplink');
  no({count:0},'no-boards');
  assert.equal(OC.decide({...ok,role:'admin'}).show,true,'개인 공간(admin) · 임원 · 스태프는 뜬다');
  assert.equal(OC.decide({...ok,role:''}).show,true,'권한표를 못 읽어도 잠금이 풀렸으면(psVaultUnlocked) 뜬다');
});

test('prefOn: 기본 켬 · «0» 이면 끔 · 저장소가 없어도 켬',()=>{
  const ls=v=>({getItem:k=>k===OC.PREF?v:null});
  assert.equal(OC.prefOn(ls(null)),true);
  assert.equal(OC.prefOn(ls('0')),false);
  assert.equal(OC.prefOn(ls('1')),true);
  assert.equal(OC.prefOn(null),true);
  assert.equal(OC.prefOn({getItem(){throw new Error('x');}}),true);
});

test('workMeta: 빈 보드는 «빈 보드로 시작», 아니면 페이지 · 장면',()=>{
  assert.deepEqual(OC.workMeta({empty:true}),{label:'이어서',name:'빈 보드로 시작',meta:'운동장만 있습니다'});
  assert.deepEqual(OC.workMeta({empty:false,pages:2,frames:6}),{label:'이어서',name:'작업 보드',meta:'페이지 2 · 장면 6'});
  assert.deepEqual(OC.workMeta({empty:false,pages:1,frames:0}),{label:'이어서',name:'작업 보드',meta:'마지막에 보던 판 그대로'});
});

test('wired into the board: <script> after board-guest.js · vault door · sw.js CORE · storage key · fixture default off · budget',()=>{
  const b=read('studio/board.html'),sw=read('sw.js'),keys=read('studio/storage-keys.js'),fx=read('tests/fixtures/team-app.mjs'),src=read('studio/board-open-chooser.js');
  const gi=b.indexOf('<script src="board-guest.js"></script>'),oi=b.indexOf('<script src="board-open-chooser.js"></script>');
  assert.ok(gi>=0&&oi>gi,'게스트 보드 모듈 뒤 · 본문 스크립트 앞');
  assert.ok(oi<b.indexOf('window.__boardReady=false'),'본문보다 먼저 읽혀 __boardReady 를 기다린다');
  assert.match(b,/window\.__psVaultOpenItem=function\(d,ro\)\{ *return ro\?openItemView\(d\):openItemEdit\(d\); *\};/,'보관함 IIFE 의 문 — 보기 · 편집 길 그대로');
  assert.ok(sw.includes("'/studio/board-open-chooser.js'"),'sw.js CORE');
  assert.match(keys,/\['ps_open_chooser_v1','device','ls','pref','board-open-chooser\.js'\]/,'저장 키 표');
  assert.match(fx,/openChooser=false/,'시험 fixture 는 기본으로 끈다');
  assert.match(fx,/if\(!openChooser\)\{try\{localStorage\.setItem\('ps_open_chooser_v1','0'\);\}catch\(_\)\{\}\}/);
  assert.ok(!/sessionStorage/.test(src),'탭 저장소 대신 셸 창의 표식(__psOpenChooserShown) — 새 저장 키를 늘리지 않는다');
  assert.ok(!/renderTokens\(\)/.test(src),'켜질 때 renderTokens 를 부르지 않는다(3.120)');
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
});

test('글자 · 굵기 · 모서리는 새 블록 기준(12·14·16·20 / 500·600·700 / 6·10·999) — 알림 kbd 11px 하나만 예외',()=>{
  const src=read('studio/board-open-chooser.js');
  const css=(src.match(/var CSS = '' \+([\s\S]*?);\n\n  function ensureCss/)||[])[1];assert.ok(css,'CSS 블록');
  const sizes=[...css.matchAll(/font-size:(\d+)px/g)].map(m=>+m[1]);
  assert.ok(sizes.length>10);
  sizes.forEach(s=>assert.ok([11,12,14,16,20].includes(s),'font-size '+s));
  [...css.matchAll(/font-weight:(\d+)/g)].forEach(m=>assert.ok(['500','600','700'].includes(m[1]),'font-weight '+m[1]));
  [...css.matchAll(/border-radius:([^;']+)/g)].forEach(m=>m[1].split(/\s+/).forEach(v=>assert.ok(['6px','10px','999px','0'].includes(v),'radius '+v)));
});
