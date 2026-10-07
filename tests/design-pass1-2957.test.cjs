'use strict';
/* 2.957 — 전체 디자인 점검 1판(고장 넷): 다크 흰 면 · 아이패드 선수단 넘침 · 주간 일정 이름 잘림 · 평가 «0». */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=path.join(__dirname,'../studio');
const read=f=>fs.readFileSync(path.join(D,f),'utf8');
const noComments=s=>s.replace(/\/\*[\s\S]*?\*\//g,'');

test('dark: no hard-coded white !important backgrounds left in the shared layout sheets',()=>{
  for(const f of ['figma-premium.css','design-v2.css','mobile-polish.css']){
    const s=noComments(read(f));
    assert.equal((s.match(/background:\s*#fff(?:fff)?\s*!important/gi)||[]).length,0,f+' 에 흰색 !important 가 남았다');
  }
});

test('dark: the replacement keeps light mode pixel-identical (fallbacks are the old values)',()=>{
  for(const f of ['figma-premium.css','design-v2.css','mobile-polish.css']){
    const s=read(f);
    for(const m of s.matchAll(/var\(--ps-w(surf|btn|pill),([^)]+)\)/g))assert.equal(m[2].trim(),'#fff',f+' 배경 폴백은 #fff');
    for(const m of s.matchAll(/var\(--ps-w(ink|acc|bad),(#[0-9a-fA-F]{6}|var\(--cmd-(?:text|muted)[^)]*\))\)/g))assert.ok(m[2].length>0);
  }
  const ug=read('ui-grammar.css');
  const dark=ug.slice(ug.indexOf(':is(#ps-grammar,html) body.fmdark{'));
  const block=dark.slice(0,dark.indexOf('\n}'));
  for(const v of ['--ps-wsurf','--ps-wbtn','--ps-wpill','--ps-wink','--ps-wacc','--ps-wbad'])assert.ok(block.includes(v+':'),v+' 는 다크 블록 안에서 정의');
  const light=ug.slice(0,ug.indexOf(':is(#ps-grammar,html) body.fmdark{'));
  assert.ok(!/--ps-w(surf|btn|pill|ink|acc|bad)\s*:/.test(noComments(light)),'라이트에서는 정의하지 않는다(폴백 = 옛 값)');
});

test('dark: the selected team tab and the community header use the dark-aware variables',()=>{
  const d=read('design-v2.css');
  assert.ok(/nav#teamNav \.tn-seg button\.on\{background:var\(--ps-wpill,#fff\)!important/.test(d),'팀 탭 선택 알약');
  assert.ok(/ps-page-community #wrap>\.top\{[^}]*background:var\(--ps-wsurf,#fff\)!important/.test(d),'커뮤니티 머리');
  const fp=read('figma-premium.css');
  assert.ok(/html\.ps-page-board #boardPageStrip\{[^}]*background:var\(--ps-wsurf,#fff\)!important/.test(fp),'보드 페이지 띠');
  assert.ok(fp.includes('color:var(--ps-wink,#646A73)!important'),'같은 규칙의 어두운 글자도 다크 값으로');
});

test('dark: schedule match column, scouting candidate chips and the learning canvas',()=>{
  const p=read('process.html');
  assert.ok(p.includes('body.fmdark .wks-kind.m{background:color-mix(in srgb,#2F6FB0 16%,#1B1E23)}'));
  assert.ok(p.includes('body.fmdark .wks-kind.m .wks-kbtn{'));
  assert.ok(read('scout.html').includes('body.fmdark #sbWrap .sb-chip{background:var(--surface-2,#23272D)'));
  const l=read('learning.html');
  assert.ok(l.includes('html:has(body.fmdark){background:#121417}')&&l.includes('body.fmdark{color-scheme:dark}'));
});

test('iPad: the squad list memo column can shrink — row and header grids stay identical',()=>{
  const s=read('scout.html');
  assert.equal((s.match(/ 56px 44px 280px 32px!important/g)||[]).length,0,'고정 280px 메모 열이 남았다');
  assert.equal((s.match(/ 56px 44px minmax\(0,280px\) 32px!important/g)||[]).length,5,'행 네 변형 + 머리글');
});

test('iPad: weekly board gives empty OFF days less room and wraps training names to two lines',()=>{
  const p=read('process.html');
  const i=p.indexOf('@media (min-width:901px){\n  .wks{display:flex');
  assert.ok(i>0,'7열 보기만 flex');
  const blk=p.slice(i,p.indexOf('}\n}',i)+3);
  assert.ok(blk.includes('.wks>.wks-day{flex:1 1 0;min-width:0}'));
  assert.ok(blk.includes('.wks>.wks-day.is-off:not(:has(.wks-ses)){flex-grow:.45;min-width:max-content}'),'세션 없는 OFF 날만 좁게 — 머리 한 줄은 남긴다');
  assert.ok(p.indexOf('@media (max-width:900px){.wks{grid-template-columns:repeat(3')>i,'3열·폰 규칙이 뒤에 그대로');
  assert.ok(/\.wks-li b\{[^}]*overflow-wrap:break-word[^}]*-webkit-line-clamp:2/.test(p),'이름 두 줄 · 단어 가운데서 안 꺾음');
  assert.ok(/\.wks-li\{flex:1 1 100%;display:flex;flex-wrap:wrap/.test(p),'이름이 먼저, 분은 안 들어가면 아래 줄');
  assert.ok(/\.wks-h \.wks-today\{[^}]*white-space:nowrap/.test(p),'오늘 배지 한 줄');
});

test('squad/scouting lists: unrated categories show «—», nothing rated shows «아직 평가 전»',()=>{
  const SC=read('scout.html');
  const a=SC.indexOf('function catAvgCellsHTML(');const b=SC.indexOf('\n}\n',a)+2;
  const c=vm.createContext({
    CATS:[['t','전술'],['k','기술'],['p','체력']],
    attrsByCat:()=>({t:[{id:'t1'},{id:'t2'}],k:[{id:'k1'}],p:[{id:'p1'}]}),
    esc:x=>String(x)
  });
  vm.runInContext(SC.slice(a,b),c);
  const none=c.catAvgCellsHTML({});
  assert.ok(none.includes('class="cat-none"')&&none.includes('아직 평가 전'));
  assert.ok(!/<b>0<\/b>/.test(none));
  const part=c.catAvgCellsHTML({t1:3,t2:4});
  assert.ok(part.includes('<b>3.5</b>'),'매긴 범주는 평균');
  assert.equal((part.match(/<b>—<\/b>/g)||[]).length,2,'안 매긴 두 범주는 «—»');
  assert.ok(!part.includes('cat-none'));
  assert.ok(!/<b>0<\/b>/.test(part),'«0» 은 더 이상 없다');
});
