// 3.039 — 손가락 기기의 누르는 크기(피드백 DS-2 · UX-7 · UX-11). 실측은 tests/browser/coach-idp-entry 와 같은 픽스처에서 했다(폰 IDP 16 → 2개, 아이패드 IDP 16 → 2개).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const css=R('studio/ui-grammar.css'), board=R('studio/board.html'), app=R('studio/app.html'), learning=R('studio/learning.html');

test('손가락 기기(pointer:coarse)의 단추 하한은 44px — 마우스 화면은 그대로',()=>{
  assert.match(css,/@media \(pointer:coarse\)\{ button:not\(\.cdot\):not\(\.ms-o\):not\(\.arc-star\):not\(\.t-idp\):not\(\.t-grp\):not\(\.chk\)\{min-height:44px\} \}/);
  assert.doesNotMatch(css,/min-height:32px\} \}/);
  assert.match(app,/@media \(min-width:768px\) and \(pointer:coarse\)\{\nhtml\.ps-page-app body\.ps-team-open nav#teamNav \.tn-seg button:not\(#_\):not\(#__\):not\(#___\)\{min-height:44px!important\}/,'아이패드 팀 탭');
  assert.match(learning,/@media \(pointer:coarse\)\{\.top \.tabs\{gap:2px\}\.top \.tabs button\{padding:0 12px;min-height:44px\}\}/,'학습 «오늘 · 책 · 카드»');
});

test('ui-grammar.css 를 고쳤으니 모든 페이지의 ?v 가 같이 올라간다(3.039 이후 · 페이지마다 같은 값 — 그 뒤 판에서 이 파일을 안 고쳤으면 그대로 둔다)',()=>{
  const dir=path.join(__dirname,'..','studio'), pins=new Set();
  for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.html'))){ const m=R('studio/'+f).match(/ui-grammar\.css\?v=([\d.]+)/g); if(m)m.forEach(x=>pins.add(x)); }
  assert.equal(pins.size,1,[...pins].join(' '));
  const v=Number([...pins][0].split('=')[1]), build=Number(app.match(/window\.PS_BUILD='([\d.]+)'/)[1]);
  assert.ok(v>=3.039&&v<=build,String(v));
});

test('UX-7 — 토큰의 잡히는 원은 화면 지름 46px(폰 · 아이패드), 보이는 크기는 그대로',()=>{
  assert.match(board,/function _tokHitR\(g\)\{ try\{ if\(!_tokHitPx\)\{ var m=tokenLayer&&tokenLayer\.getScreenCTM&&tokenLayer\.getScreenCTM\(\); _tokHitPx=m\?Math\.hypot\(m\.a,m\.b\):0; \}/);
  assert.match(board,/return Math\.round\(Math\.max\(21,Math\.min\(160,px>0\?23\/px:70\)\)\);/);
  assert.match(board,/var _dv=psBoardDevice\(\); if\(_dv==="phone"\|\|_dv==="ipad"\)\{ g\.insertBefore\(el\("circle",\{r:_tokHitR\(g\),fill:"transparent","class":"tok-hit"\}\),g\.firstChild\); \}/);
  assert.match(board,/function renderTokens\(\)\{try\{applyLookAt\(\);\}catch\(_\)\{\} _tokHitPx=0;/,'배율은 그릴 때마다 다시 잰다');
  // 반지름 식: 화면 배율 0.452(아이패드 기본) · 판 1px/단위 → 23/0.452 ≈ 51
  const f=new Function('tokenLayer','g','var _tokHitPx=0;'+board.slice(board.indexOf('function _tokHitR(g)'),board.indexOf('function tokenTransform(p)'))+';return _tokHitR(g);');
  const layer={getScreenCTM:()=>({a:1,b:0})}, tok=s=>({getAttribute:()=>'translate(1,1) scale('+s+')'});
  assert.equal(f(layer,tok(0.452)),51); assert.equal(f(layer,tok(2)),21,'보이는 원보다 작아지지 않는다'); assert.equal(f(layer,tok(0.05)),160,'아주 작은 배율에서도 상한');
});

test('UX-7 — 아이패드도 길게 누르지 않고 바로 끈다. 데스크톱 터치 화면만 길게(안내는 막혔을 때만)',()=>{
  assert.match(board,/if\(e\.pointerType==="touch" && !_isDrawStart && psBoardDevice\(\)==="desktop"\)\{\n      const _lpT=setTimeout/);
  assert.match(board,/if\(Math\.hypot\(ev\.clientX-sx,ev\.clientY-sy\)>10\)\{_cleanup\(\);if\(typeof toast==="function"\)toast\("길게 눌러 이동하세요"\);\}/);
  assert.equal((board.match(/toast\("길게 눌러 이동하세요"\)/g)||[]).length,1,'누를 때마다 뜨던 안내는 없다');
});

test('UX-11 — 아이패드 도크는 컴퓨터와 같은 치수(2.922) 그대로, 이름은 길게 누르면(2.248) — 처음 한 번 알려 준다',()=>{
  assert.match(board,/html\.ps-page-board body\.ps-ipad-work:not\(\.ps-dock\):not\(\.cmd-dock-folded\) #ps-command-dock:not\(#_\)(:not\(#_\)){8} button\{height:30px!important;min-height:30px!important;max-height:30px!important/);
  assert.match(board,/if\(localStorage\.getItem\('ps_dock_tip_hint_v1'\)\)return; localStorage\.setItem\('ps_dock_tip_hint_v1','1'\);/);
  assert.match(board,/toast\('도구 이름은 단추를 길게 누르면 보여요'\)/);
});
