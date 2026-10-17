const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 3.019 — 커뮤니티에 올린 프로세스 훈련을 더 잘 보이게(사용자): 처음 여는 칸은 «프로세스», 카드 그림은 한 장을 크게 + 1·2·3.
   브라우저 시험(tests/browser/community-process.mjs)이 화면을 본다. 여기서는 처음 칸을 고르는 규칙과 그 칸을 바꾸는 길만 본다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','community.html'),'utf8');
function first(store){
  const a=src.indexOf("var PROC_TAB_KEY='ps_comm_tab_v1';"),b=src.indexOf('\n',src.indexOf('function procTabFirst(',a));
  assert.ok(a>0&&b>a,'procTabFirst');
  const c=vm.createContext({localStorage:store});
  vm.runInContext(src.slice(a,b)+';this.f=procTabFirst;',c);
  return c.f();
}

test('the first tab is «프로세스» unless this device last looked at «코치 자료» or «엘미하»',()=>{
  const ls=v=>({getItem:k=>(k==='ps_comm_tab_v1'?v:null)});
  assert.equal(first(ls(null)),'proc','처음 쓰는 기기');
  assert.equal(first(ls('proc')),'proc');
  assert.equal(first(ls('coach')),'coach','마지막에 본 칸');
  assert.equal(first(ls('elmiha')),'elmiha','엘미하 칸(3.018)도');
  assert.equal(first(ls('fifa')),'fifa','FIFA 칸(3.071)도');
  assert.equal(first(ls('x')),'proc','모르는 값은 기본으로');
  assert.equal(first({getItem(){ throw new Error('blocked'); }}),'proc','저장소를 못 써도 연다');
});

test('the tab is chosen once at start, remembered only when the user switches, and an upload lands on «코치 자료»',()=>{
  assert.match(src,/fillFilters\(\);\nprocSetTab\(procTabFirst\(\),true\);[^\n]*\nfetchPosts\(\);\n\}\)\(\);/,'처음 열 때 고른 칸으로 — 코치 자료의 개수는 그대로 받는다');
  const set=src.slice(src.indexOf('function procSetTab(t,boot){'),src.indexOf("$('prSeg').addEventListener('click'"));
  assert.match(set,/t=\(t==='proc'\|\|t==='elmiha'\|\|t==='fifa'\)\?t:'coach'; if\(t===tabF&&!boot\)return;/,'칸 넷(3.071 — FIFA)');
  assert.match(set,/if\(!boot\)try\{localStorage\.setItem\(PROC_TAB_KEY,t\);\}catch\(_\)\{\}/,'적는 것은 사용자가 칸을 바꿀 때만');
  assert.match(set,/if\(boot\)\{ if\(t!=='coach'\)render\(\); return; \}/,'처음 열 때는 받지 않는다(«불러오는 중»만) — 화면이 실제로 보일 때 받는다');
  assert.match(src,/setTimeout\(function\(\)\{ if\(!proc\.ready\)procFetch\(\); if\(!elm\.ready\)elmFetch\(\); \},tabF==='coach'\?800:0\);/,'프로세스(첫 화면)나 엘미하 칸으로 열면 목록을 곧바로');
  assert.match(src,/toast\('커뮤니티에 올라갔어요 ✓'\);sort='new';\$\('sortSel'\)\.value='new';if\(tabF==='proc'\)procSetTab\('coach'\);fetchPosts\(true\);/,'올리고 나면 방금 올린 글이 있는 칸');
});

test('a session card shows one large picture, picks it with 1·2·3 and opens the viewer on the picked training',()=>{
  const card=src.slice(src.indexOf('function renderProc(){'),src.indexOf('function procEnsure('));
  assert.ok(!/pr-tri/.test(src),'작은 그림 셋은 없다');
  assert.match(card,/'<div class="pr-hero">'\+procThumb\(s,k\+1\)\+'<\/div>'/,'그림은 한 장 — 그 위에 얹는 것은 없다');
  assert.match(card,/aria-label="훈련 그림 고르기"/);
  assert.match(card,/if\(e\.target!==c\)return;/,'1·2·3 단추의 Enter·Space 는 단추 몫');
  assert.match(src,/function procViewOpen\(p,post\)\{ var n=p\.item\.trainings\.length,k=\(\(?p\.proc(\|\|p\.fifa\))?\)?&&\+p\.__k>0&&\+p\.__k<n\)\?\+p\.__k:0;/,'뷰어는 고른 훈련부터');
  assert.match(src,/\.pr-hero\{aspect-ratio:3\/2;/,'판 비율 그대로');
});
