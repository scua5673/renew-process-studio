// 영어 번역 재기(사용자 «영어사용자도 사용할수 있게»). 사전은 studio/i18n/en-<영역>.js, 걷기는 studio/i18n.js.
// ① 재는 도구가 돈다 ② 사전 파일의 모양(빈 값 없음 · 틀의 구멍 수 = 규칙의 $n) ③ 래칫: 영역마다 번역 안 된 한국어 글이
// 기준(tests/i18n-baseline.json)보다 늘지 않고, 앱 전체 번역 비율이 내려가지 않는다 — 새 한국어 글은 영어와 함께 넣는다.
// 기준 다시 적기(번역을 늘렸거나 글을 일부러 더했을 때): node scripts/i18n-coverage.mjs --write-baseline
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const lib=()=>import('../scripts/i18n-lib.mjs');
let once=null;const measured=()=>once||(once=lib().then(m=>{const files=m.extractAll();return {files,cov:m.coverage(files)};}));
const baseline=JSON.parse(fs.readFileSync(path.join(__dirname,'i18n-baseline.json'),'utf8'));
const HANGUL=/[ㄱ-ㆎ가-힣]/;

test('재기 — 뽑은 글을 영역마다 세고 사전으로 견준다',async()=>{
  const {coverage,AREAS,extractAll,areaOf}=await lib();
  const {files,cov}=await measured();
  assert.ok(Object.keys(files).length>100,'소스 파일을 훑는다');
  assert.ok(files['studio/app.html'].length>500,'셸의 한국어 글');
  assert.ok(files['studio/app.html'].includes('오류 제보'),'HTML 글 노드');
  assert.ok(files['studio/app.html'].some(s=>s.includes('{}')),'JS 틀(구멍)');
  assert.ok(!files['studio/app.html'].includes('ロンド'),'사전 블록은 원문이 아니다');
  assert.equal(areaOf('studio/sync.js'),'shell');assert.equal(areaOf('studio/board-topbar.js'),'board');assert.equal(areaOf('studio/process.html'),'schedule');
  assert.equal(areaOf('studio/learn-toc.js'),'content');assert.equal(areaOf('guide/quick.html'),'site');
  for(const a of AREAS){const c=cov.areas[a];assert.equal(c.total,c.translated+c.untranslated,a);}
  assert.equal(cov.app.total,AREAS.reduce((n,a)=>n+cov.areas[a].total,0));
});

test('뽑기 — 글 노드 · 속성 · 리터럴 · 이어 붙이기 · 틀',async()=>{
  const {scanHtml,scanJs}=await lib();
  const html=[];scanHtml('<div title="도움말" data-x="무시"><!-- 주석 --><b>저장&nbsp;됨</b> 끝<script>var a="알림 "+n+"건";/* 주석글 */ var re=/한글/;</script><style>.x::after{content:"꾸밈"}</style><button onclick="toast(\'눌렀어요\')">확인</button></div>',s=>html.push(s));
  assert.deepEqual(html.sort(),['끝','눌렀어요','도움말','알림 {}건','저장 됨','확인'].sort());
  const js=[];scanJs("var o={'열쇠':1};if(x==='비교')y=1;switch(z){case '갈래':break;} t=`선수 ${n}명 · ${f(`안쪽 글`)}`; u='<p class=\"a\">문단 <b>'+esc(v)+'</b> 뒤</p>'; w=name+' 님';",s=>js.push(s));
  assert.deepEqual(js.sort(),['선수 {}명 · {}','안쪽 글','문단','뒤','{} 님'].sort());
});

test('사전 파일 — 빈 값 없음 · 틀의 구멍과 규칙의 $n 이 맞는다 · 영어에 한글이 섞이지 않는다',async()=>{
  const {loadDictionaries,AREAS,norm}=await lib();
  const d=loadDictionaries();
  assert.deepEqual(Object.keys(d.packs).sort(),[...AREAS].sort(),'영역마다 en-<영역>.js 하나');
  let keys=0;
  for(const [k,v] of Object.entries(d.extra)){
    keys++;
    assert.ok(k&&k===norm(k),'원문은 공백을 한 칸으로: '+JSON.stringify(k));
    assert.ok(HANGUL.test(k),'원문은 한국어: '+k);
    assert.ok(v&&typeof v.en==='string'&&v.en.trim(),'영어가 비었다: '+k);
    if(!/"삭제"|한국어/.test(k))assert.ok(!HANGUL.test(v.en)||/삭제/.test(v.en),'영어에 한글: '+k+' → '+v.en);
  }
  assert.ok(keys>1500,'셸 씨앗 사전 '+keys);
  for(const [re,to] of d.rules){
    assert.ok(re instanceof RegExp||typeof re.test==='function');
    assert.ok(re.source.startsWith('^')&&re.source.endsWith('$'),'규칙은 글 전체에 맞춘다: '+re.source);
    assert.ok(typeof to.en==='string'&&to.en.trim(),'규칙의 영어가 비었다: '+re.source);
    const groups=new RegExp(re.source+'|').exec('').length-1;
    const used=[...to.en.matchAll(/\$(\d)/g)].map(m=>+m[1]);
    assert.ok(groups<=9,'구멍은 아홉 개까지: '+re.source);
    assert.deepEqual([...new Set(used)].sort((a,b)=>a-b),Array.from({length:groups},(_,i)=>i+1),'구멍 '+groups+'개와 $n 이 다르다: '+re.source+' → '+to.en);
  }
});

test('찾기 — 공백 정규화 · 틀 · 구멍 안의 말 · « · » 토막 · 덜 번역된 글은 세지 않는다',async()=>{
  const {loadDictionaries}=await lib();
  const d=loadDictionaries();
  assert.equal(d.en('오류 제보'),true);
  assert.equal(d.en('  오류\n   제보 '),true,'공백 · 줄바꿈');
  assert.equal(d.en('3분 전'),true,'틀');
  assert.equal(d.en('세상에 없는 글'),false);
  assert.equal(d.covered('{}분 전'),true);
  assert.equal(d.covered('세상에 없는 {} 틀'),false);
});

test('래칫 — 영역마다 번역 안 된 글이 늘지 않고 앱 전체 비율이 내려가지 않는다',async()=>{
  const {AREAS}=await lib();
  const {cov}=await measured(),over=[];
  for(const a of AREAS){
    const now=cov.areas[a].untranslated,max=baseline.areas[a].untranslated;
    if(now>max)over.push(`${a}: 번역 안 된 글 ${now} > 기준 ${max} — 예: ${cov.areas[a].missing.slice(0,3).join(' | ')}`);
  }
  assert.deepEqual(over,[],'새 한국어 글에는 영어를 함께(studio/i18n/en-<영역>.js). 보기: node scripts/i18n-coverage.mjs --missing <영역>');
  assert.ok(cov.app.pct>=baseline.app.pct,`앱 전체 번역 ${cov.app.pct}% < 기준 ${baseline.app.pct}%`);
  assert.equal(cov.areas.shell.untranslated,0,'셸은 100% — '+cov.areas.shell.missing.slice(0,5).join(' | '));
});

test('배선 — 셸만 번역기를 싣고(자식 화면 0바이트) · 영어 사전은 미리 받지 않는다 · «학습» 끄기',()=>{
  const app=fs.readFileSync(path.join(root,'studio/app.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.match(app,/<script src="storage\.js"><\/script>\n<script src="learning-off\.js"><\/script><script src="i18n\.js"><\/script>/,'storage.js 바로 뒤(출처 막이 다음 · 셸 처리기 앞)');
  assert.match(app,/window\.PS_I18N_BASE=\{D:DICT,R:RULES\};/,'기본 사전만 app.html 에');
  assert.ok(!/function wrapDialogs|function trStr/.test(app),'걷기 코드는 i18n.js 로 옮겼다');
  for(const f of ['board','process','scout','idp','gamemodel','community','note','scouting','terms','playbook','analysis'])
    assert.ok(!/"i18n\.js|i18n\/en-/.test(fs.readFileSync(path.join(root,'studio/'+f+'.html'),'utf8')),f+'.html 은 그대로');
  assert.ok(sw.includes("'/studio/i18n.js'")&&sw.includes("'/studio/learning-off.js'"),'sw.js CORE');
  assert.ok(!/i18n\/en-/.test(sw),'영어 사전은 CORE 에 없다 — 영어 사용자만 받고 받은 뒤 캐시에 남는다');
  const CORE_OPT=sw.slice(sw.indexOf('const CORE'),sw.indexOf('const SHELL')).replace(/\/\*[\s\S]*?\*\//g,'');
  assert.ok(!CORE_OPT.includes("'/studio/learning.html'"),'«학습» 끄기 동안 learning.html 을 미리 받지 않는다');
  const off=fs.readFileSync(path.join(root,'studio/learning-off.js'),'utf8'),nav=fs.readFileSync(path.join(root,'studio/mobile-navigation.js'),'utf8');
  assert.match(off,/^var PS_LEARNING_ENABLED=false;$/m,'한 줄 깃발');
  assert.match(nav,/window\.PS_LEARNING_ENABLED===false\)selectors\.splice\(4,1\)/,'폰 메뉴는 깃발을 읽어 다섯 칸');
  assert.ok(fs.existsSync(path.join(root,'studio/learning.html')),'학습 화면 파일은 지우지 않는다');
  const run=fs.readFileSync(path.join(root,'tests/browser/run-critical.mjs'),'utf8');
  assert.ok(run.includes("'i18n-english-shell'"),'브라우저 시험 묶음');
});
