const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.018 — 커뮤니티 안의 «엘미하» 칸(사용자 «커뮤니티에 엘미하의 전술노트 넣으려고 해 · 엘미하 페이지를 또 만들어 줘 · 보관함으로 가져오기도 ·
   엘미하가 애니메이션 만든 거 공유할 수 있게 · 박수빈이라는 이름으로 만들고 있어»).
   · 새 서버 표 · 새 올리기 길이 없다 — 엘미하 계정이 «＋ 올리기»로 올린 ps_community 글을 모은다. 그래서 애니메이션 · 뷰어 · 담기는 코치 자료와 같은 길.
   · 누구의 글인지는 계정 번호(owner — RLS comm_ins 가 auth.uid() 로 지킨다)로 고른다. 표시 이름(owner_name)은 올리는 쪽이 적는 값이다. */
const comm=fs.readFileSync(path.join(__dirname,'..','studio','community.html'),'utf8');
function cut(src,from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const PURE=cut(comm,'/* ── 3.018 · 엘미하 칸 순수 구간 시작','/* ── 3.018 · 엘미하 칸 순수 구간 끝 ── */');
function pure(){ const c=vm.createContext({}); vm.runInContext(PURE+';this.api={ELM_UID,ELM_MAX,elmPath,elmRead,elmSort};',c); return c.api; }
const OTHER='22222222-2222-4222-8222-222222222222';

test('the tab asks the server for one account by its id — never by the name a poster types',()=>{
  const g=pure();
  assert.match(g.ELM_UID,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,'계정 번호(uuid)');
  assert.equal(g.elmPath('id,title'),'/rest/v1/ps_community?select=id,title&owner=eq.'+g.ELM_UID+'&deleted=eq.false&order=created_at.desc&limit=200');
  assert.equal(/owner_name=/.test(PURE),false,'표시 이름으로 고르지 않는다');
  assert.match(comm,/var list=\(elmTab\?elmSort\(elm\.list,sort\):posts\)\.filter\(/,'카드 · 고르개 · 검색은 코치 자료와 같은 길');
});

test('only that account\'s posts get through — a lookalike name, a twin id or an odd row is dropped',()=>{
  const g=pure(),U=g.ELM_UID;
  const row=(id,over)=>Object.assign({id,owner:U,owner_name:'엘미하',title:'전술 '+id,views:0,likes:0,copies:0,created_at:'2026-10-13T00:00:00Z'},over||{});
  const got=plain(g.elmRead([row('C1'),row('C2',{owner:OTHER}),row('C3',{owner:OTHER,owner_name:'엘미하'}),row('C1',{title:'같은 글 두 번'}),null,'x',row(''),row(7),row('C4',{deleted:true}),row('C5')]));
  assert.deepEqual(got.map(p=>[p.id,p.title]),[['C1','전술 C1'],['C5','전술 C5']],'같은 이름을 적은 다른 계정의 글은 끼어들지 못한다');
  for(const bad of [null,{},'x',{rows:[]}])assert.equal(g.elmRead(bad),null);
  assert.deepEqual(plain(g.elmRead([])),[]);
  assert.equal(g.elmRead(Array.from({length:250},(_,i)=>row('C'+i))).length,200);
});

test('sorting by views, likes or saves keeps the newest first among equals; the newest order is the server\'s',()=>{
  const g=pure();
  const L=[{id:'a',views:1,likes:5,copies:0},{id:'b',views:9,likes:5,copies:2},{id:'c',views:9,likes:0},{id:'d'}];
  assert.deepEqual(plain(g.elmSort(L,'new')).map(p=>p.id),['a','b','c','d']);
  assert.deepEqual(plain(g.elmSort(L,'views')).map(p=>p.id),['b','c','a','d']);
  assert.deepEqual(plain(g.elmSort(L,'likes')).map(p=>p.id),['a','b','c','d']);
  assert.deepEqual(plain(g.elmSort(L,'copies')).map(p=>p.id),['b','a','c','d']);
  assert.deepEqual(L.map(p=>p.id),['a','b','c','d'],'받은 목록은 그대로');
  assert.deepEqual(plain(g.elmSort(null,'views')),[]);
});

test('the head has the elmiha tab (3.071 — FIFA comes after it) and the elmiha tab carries the YouTube channel link',()=>{
  assert.match(comm,/<button type="button" id="prTabElm" data-pr-tab="elmiha" aria-pressed="false">엘미하<span id="prElmN"><\/span><\/button><button type="button" id="prTabFifa" data-pr-tab="fifa"/);
  const hero=cut(comm,'<div class="el-hero" id="elHero" hidden>','<div class="comm-count" id="commCount">');
  assert.match(hero,/<b>엘미하의 전술노트<\/b>/);
  assert.match(hero,/<a class="el-yt" id="elYt" href="https:\/\/www\.youtube\.com\/@ELMIHA_TacticalNote" target="_blank" rel="noopener noreferrer"/,'새 창 · 이 앱의 창을 넘기지 않는다');
  assert.match(comm,/\[\['prTabCoach','coach'\],\['prTabProc','proc'\],\['prTabElm','elmiha'\],\['prTabFifa','fifa'\]\]/);
  assert.match(comm,/var hero=\$\('elHero'\); if\(hero\)hero\.hidden=\(t!=='elmiha'\);/);
  assert.match(comm,/html body \.top \.pr-seg:not\(#_\):not\(#__\)\{order:9;flex:1 0 100%;display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}/,'폰에서는 칸 넷(3.071 — FIFA)이 한 줄');
});

test('opening, playing and putting in the vault go the coach-post way — the viewer finds an elmiha post even outside the coach feed',()=>{
  assert.match(comm,/if\(!p\)p=elmFind\(id\);   \/\* 3\.018/,'뷰어의 «내 보관함에 담기» · 신고가 엘미하 글을 찾는다');
  assert.ok(comm.indexOf('if(!p)p=elmFind(id);')<comm.indexOf('if(!p)p=procFind(id)'));
  const body=cut(comm,'/* ── 3.018 · 엘미하 칸 순수 구간 끝 ── */','/* ══ 2.999 · 커뮤니티 안의 «프로세스» 칸 ══');
  assert.equal(/method:'(POST|PATCH|DELETE)'/.test(body),false,'엘미하 칸은 읽기만 한다(올리기 · 고치기 · 지우기는 코치 자료의 길)');
  assert.match(comm,/if\(force\)\{try\{sessionStorage\.removeItem\(FEED_CK\)\}catch\(_\)\{\}\n    elmStale\(\);\}/,'올린 · 고친 · 지운 뒤 엘미하 칸도 새로 받는다');
  assert.match(comm,/if\(seq!==elmSeq\)return;   \/\* 그사이 새로 받기 시작했다/,'늦게 온 옛 답은 버린다');
  assert.match(comm,/if\(tabF==='coach'\)grid\.innerHTML='<div class="empty loading"><b>커뮤니티를 불러오는 중…/,'코치 자료를 받는 동안 엘미하 칸을 덮지 않는다');
  assert.match(comm,/if\(tabF!=='coach'\)return;   \/\* 2\.999/);
});

test('upload stays where it means something — on the elmiha tab only for the elmiha account',()=>{
  assert.match(comm,/function elmIsOwner\(\)\{ var me=sess\(\); return !!\(me&&me\.uid===ELM_UID\); \}/);
  assert.match(comm,/html body\.pr-elm:not\(\.pr-elm-own\) \.fab:not\(#_\):not\(#__\),html body\.pr-elm:not\(\.pr-elm-own\) #upMenu:not\(#_\):not\(#__\)\{display:none!important\}/);
  assert.match(comm,/if\(elmTab\)\{ elmOwnerMark\(\);/);
});

test('sorting on the elmiha tab re-orders right away — it does not wait for the coach feed to come back',()=>{
  assert.match(comm,/    fetchPosts\(\);\n    if\(tabF==='elmiha'\)render\(\);   \/\* 3\.018/);
});
