// 3.054 — 피드백 17(DS-4 · DS-6 · DS-13): vendor/tokens.css 가 글자 · 면 · 선 · 모서리의 정본이고, ui-grammar 의 별칭은 그 값을 가리키기만 한다.
// stylelint 를 들이지 않고 같은 일을 래칫으로 — 새 hex · px 글자 크기 · !important · :not(#_) 가 늘지 않고, 반 픽셀 글자는 없다.
// 화면이 바뀌지 않았다는 확인은 계산된 스타일 비교로 했다(PR 본문 — 데스크톱 라이트/다크 · 폰 · 아이패드의 모든 요소).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const R=f=>fs.readFileSync(path.join(root,f),'utf8');
const styleFiles=()=>fs.readdirSync(path.join(root,'studio')).filter(f=>/\.(html|css)$/.test(f)).map(f=>'studio/'+f);

test('tokens.css 가 정본 — 라이트 :root 와 다크 body.fmdark 한 곳씩, ui-grammar 별칭은 var(--c-*) 로 가리킨다',()=>{
  const t=R('vendor/tokens.css'),light=t.slice(0,t.indexOf('body.fmdark{')),dark=t.slice(t.indexOf('body.fmdark{'));
  for(const k of ['--c-ink','--c-muted','--c-faint','--c-line','--c-line-2','--c-line-3','--c-bg','--c-surface','--c-surface-2'])
    { assert.match(light,new RegExp(k+':#[0-9A-F]{6}'),k+' 라이트'); assert.match(dark,new RegExp(k+':#[0-9A-F]{6}'),k+' 다크'); }
  for(const k of ['--c-act','--c-ok','--c-warn','--c-bad'])assert.match(dark,new RegExp(k+':#[0-9A-F]{6}'),k+' 다크');
  assert.match(light,/--r-card:12px/); assert.match(light,/--r-control:10px/);
  const ug=R('studio/ui-grammar.css'),ugLight=ug.slice(0,ug.indexOf(':is(#ps-grammar,html) body.fmdark{')),ugDark=ug.slice(ug.indexOf(':is(#ps-grammar,html) body.fmdark{'),ug.indexOf('\n}',ug.indexOf(':is(#ps-grammar,html) body.fmdark{')));
  /* 별칭 줄에 hex 를 다시 적지 않는다 — 값은 tokens.css 에서만 바꾼다 */
  for(const n of ['--ink','--txt','--dim','--muted','--gray','--faint','--line','--border','--bg','--surface','--panel','--panel2','--surface-2'])
    { assert.match(ugLight,new RegExp('[;\\s{]'+n+':var\\(--c-'),n+' 라이트'); assert.match(ugDark,new RegExp('[;\\s{]'+n+':var\\(--c-'),n+' 다크'); }
  assert.match(ugLight,/--fs-micro:var\(--t-2,11px\);--fs-caption:var\(--t-3,12px\);--fs-sub:var\(--t-4,13px\);--fs-body:var\(--t-5,14px\);--fs-title:var\(--t-6,16px\)/,'글자 이름 하나');
  assert.doesNotMatch(ugDark,/--c-(act|ok|warn|bad):/,'의미색 다크 값은 tokens.css 한 곳');
});

test('tokens.css · ui-grammar.css 를 고쳤으니 모든 페이지의 ?v 가 같다',()=>{
  for(const re of [/\/vendor\/tokens\.css\?v=([\d.]+)/g,/ui-grammar\.css\?v=([\d.]+)/g]){
    const pins=new Set(); for(const f of styleFiles().filter(f=>f.endsWith('.html')))for(const m of R(f).matchAll(re))pins.add(m[1]);
    assert.equal(pins.size,1,re+' '+[...pins].join(' '));
    assert.ok(Number([...pins][0])>=3.054,re+' '+[...pins][0]);
  }
});

/* 스타일 코드 래칫(3.054 실측값이 상한). 줄였으면 상한도 내린다 */
const CSS_RATCHET={hex:1320,important:13474,notId:1360,fontPx:4349};   /* staging #418 · #419 가 더한 !important 3 · :not(#_) 7 포함 */
test('스타일 래칫 — 새 hex 색 · px 글자 크기 · !important · :not(#_) 가 늘지 않는다, 반 픽셀 글자는 0',()=>{
  const hex=new Set(); let important=0,notId=0,fontPx=0; const half=[];
  for(const f of styleFiles()){
    const s=R(f);
    (s.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g)||[]).forEach(h=>hex.add(h.toLowerCase()));
    important+=(s.match(/!important/g)||[]).length; notId+=(s.match(/:not\(#_\)/g)||[]).length; fontPx+=(s.match(/font-size:\s*\d+px/g)||[]).length;
    if(/font-size:\s*\d+\.\d+px/.test(s))half.push(f);
  }
  assert.deepEqual(half,[],'반 픽셀 글자 크기 — tokens.css 7단(10 · 11 · 12 · 13 · 14 · 16 · 20)으로');
  const now={hex:hex.size,important,notId,fontPx};
  for(const k of Object.keys(CSS_RATCHET))assert.ok(now[k]<=CSS_RATCHET[k],`${k} ${now[k]} > ${CSS_RATCHET[k]} — 새 값은 tokens.css 의 var(--c-* · --t-* · --sp-* · --r-*) 로`);
});

/* 공통 시트 순서(DS-13): fonts → tokens → mobile-polish → premium-ui → (team-ui) → design-v2 → figma-premium → … → ui-grammar(맨 끝).
   scout.html 만 design-v2 를 맨 앞에 둔다 — 옮기면 아이패드 폭의 기본 단추 그림자 13곳이 바뀐다(계산된 스타일 비교). 그 단추를 정리할 때 함께 옮긴다 */
test('스타일시트 순서 — 페이지마다 같은 순서, 예외는 적어 둔 하나',()=>{
  const ORDER=['/vendor/fonts.css','/vendor/tokens.css','mobile-polish.css','premium-ui.css','team-ui-v375.css','design-v2.css','figma-premium.css','ui-grammar.css'];
  const EXCEPT={'studio/scout.html':['design-v2.css']};
  for(const f of styleFiles().filter(f=>f.endsWith('.html'))){
    const s=R(f).replace(/'[^'\n]*<link rel="stylesheet"[^'\n]*'/g,'');   /* 인쇄 문서 문자열 안의 링크는 빼고 */
    const seq=[...s.matchAll(/<link rel="stylesheet" href="([^"?]+)/g)].map(m=>m[1]).filter(h=>ORDER.includes(h)&&!(EXCEPT[f]||[]).includes(h));
    if(!seq.length)continue;
    const idx=seq.map(h=>ORDER.indexOf(h));
    assert.deepEqual(idx,idx.slice().sort((a,b)=>a-b),f+' '+seq.join(' → '));
    assert.equal(new Set(seq).size,seq.length,f+' 같은 시트를 두 번');
    if(seq.includes('ui-grammar.css'))assert.equal(seq[seq.length-1],'ui-grammar.css',f+' ui-grammar 가 마지막');
  }
});
