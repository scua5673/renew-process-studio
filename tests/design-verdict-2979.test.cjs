const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 2.979 — 디자인 판정 반영(사용자 «보드 빼고 다 고쳐보자»). 팀 › 오늘 · 팀 헤더 · 일정 주간 · 내 IDP 데스크톱.
   기준은 새로 쓴 블록(ps-2979-*) 안에서 지킨다: 글자 12·14·16·20·28 / 굵기 500·600·700 / 모서리 6·10·999.
   앞 층의 옛 값은 이 테스트가 보지 않는다 — 새로 쓰는 것이 다시 흩어지지 않게 막는 문이다. */
const read=f=>fs.readFileSync(path.join(__dirname,'..','studio',f),'utf8');
const block=(s,id)=>{const i=s.indexOf('<style id="'+id+'">');assert.ok(i>=0,id+' 블록이 있다');return s.slice(i,s.indexOf('</style>',i));};
const scout=read('scout.html'),app=read('app.html'),proc=read('process.html'),idp=read('idp.html');
const BLOCKS=[[scout,'ps-2979-ck'],[proc,'ps-2979-wks'],[idp,'ps-2979-desk']];
const css=b=>b.replace(/\/\*[\s\S]*?\*\//g,'');   /* 주석 속 숫자는 세지 않는다 */

test('new blocks only use the type scale 12·14·16·20·28',()=>{
  for(const [s,id] of BLOCKS){
    const sizes=[...css(block(s,id)).matchAll(/font-size:\s*([\d.]+)px/g)].map(m=>m[1]);
    assert.ok(sizes.length>0,id+' 에 글자 크기가 있다');
    for(const v of sizes)assert.ok(['12','14','16','20','28'].includes(v),id+' font-size '+v+'px');
    assert.equal(/font:\s*[^;]*\d+px/.test(css(block(s,id))),false,id+' — font 축약으로 크기를 숨기지 않는다');
  }
});

test('new blocks only use weights 500·600·700 and radii 0·6·10·999',()=>{
  for(const [s,id] of BLOCKS){
    const b=css(block(s,id));
    for(const m of b.matchAll(/font-weight:\s*(\d+)/g))assert.ok(['500','600','700'].includes(m[1]),id+' font-weight '+m[1]);
    for(const m of b.matchAll(/border-radius:\s*([\d.]+)(px)?/g))assert.ok(['0','6','10','999'].includes(m[1]),id+' border-radius '+m[1]);
  }
});

test('the new blocks sit after the layers they override',()=>{
  assert.ok(scout.lastIndexOf('<style id="ps-2979-ck">')>scout.lastIndexOf('<style id="ps-2963-quiet">'),'콕핏 블록은 문서 맨 끝');
  assert.ok(proc.lastIndexOf('<style id="ps-2979-wks">')>proc.lastIndexOf('<style id="ps-2620-mx">'),'일정 블록은 파일 맨 끝');
  assert.ok(idp.lastIndexOf('<style id="ps-2979-desk">')>idp.lastIndexOf('<style id="ps-2945-claim">'),'IDP 블록은 문서 맨 끝');
});

test('today: session card on top with tasks beside it, then the week, then two cards',()=>{
  const a=scout.indexOf('function renderCkHome(){'),b=scout.indexOf('function renderTeamHome(){',a),r=scout.slice(a,b);
  assert.ok(a>0&&b>a);
  const top=r.indexOf(`h+='<div class="ck-top'`);
  assert.ok(top>0,'맨 위 줄을 한 번에 잇는다');
  const line=r.slice(top,r.indexOf('\n',top));
  assert.ok(line.indexOf('hs')<line.indexOf('ck-side')&&line.indexOf('ck-side')<line.indexOf('_wkH')&&line.indexOf('_wkH')<line.indexOf('ck-grid'),'세션 → 할 일·공지 → 주간 → 그리드');
  assert.equal(r.includes(`h+='<div class="wk-hd">`),false,'주간 띠는 조각(_wkH)으로 만든다');
  assert.ok(r.includes(`var mdChip=(m&&diff===0)?'':m?(`),'경기 날에는 머리 칩을 접는다 — «vs 상대»는 오늘 칸이 말한다');
  assert.ok(r.includes('quiet:1'),'세션 카드·주간 머리가 말한 줄은 «다음 할 일»에서 접는다');
  const k=r.indexOf(`+'<div class="hero">'+(function(){ var k=[`);
  assert.ok(k>0,'세션 카드의 날짜 줄');
  assert.equal(r.slice(k,r.indexOf('</h4>',k)).includes('ckCtx.line'),false,'날짜 줄에 제목과 같은 말(오늘 한 줄)을 붙이지 않는다');
});

test('today: availability is one bar per group, not five colour tiles',()=>{
  assert.equal(scout.includes('<div class="avail g g5">'),false);
  assert.ok(scout.includes(`'<div class="ck-avbar" role="img"`)&&scout.includes(`'<div class="ck-avlg">`));
  assert.ok(/var _wcol=function\(n\)\{ return "var\(--ck-bar,#9AA3AF\)"; \};/.test(scout),'국면 막대는 한 색');
  assert.ok(scout.includes(`(wm?wm+'분':'—')`)&&scout.includes(`(n?n+'일':'—')`),'분·일 단위는 칸마다');
});

test('ckNextTask: quiet mode drops the lines the cards already say',()=>{
  const a=scout.indexOf('function ckNextTask(c){'),b=scout.indexOf('function ckMatchOn(',a),f=scout.slice(a,b);
  assert.ok(a>0&&b>a);
  assert.ok(f.includes('if(c.quiet)return "";')&&f.indexOf('if(c.quiet)return "";')<f.indexOf('/* 5) 오늘 세션 */'));
  assert.ok(f.includes('&&!(c.quiet&&c.diff===0)'),'경기 날의 준비 줄도 접는다(세션 카드의 문이 같은 일)');
});

test('team header: tabs sit on the header row again',()=>{
  const b=block(app,'ps-2176-ctx');
  assert.equal(/\.tn-seg\{position:absolute/.test(b),false,'탭을 둘째 줄로 띄우지 않는다');
  assert.equal(b.includes('margin-bottom:44px'),false,'둘째 줄 자리(44px)를 비워 두지 않는다');
  assert.ok(b.includes('.tn-seg{position:static!important')&&b.includes('margin:0 0 0 auto!important'),'탭은 머리줄 오른쪽 끝');
});

test('personal IDP is no longer boxed into the 392px phone frame',()=>{
  assert.equal(app.includes(`classList.toggle('ps-idp-phone'`),false);
  assert.ok(app.includes(`document.body.classList.remove('ps-idp-phone');`));
  assert.ok(idp.includes(`if(_todaySimple)h+='<div class="dcols"><div class="dcol dcol-main">';`)&&idp.includes(`if(_todaySimple)h+='</div><div class="dcol dcol-side">';`)&&idp.includes(`if(_todaySimple)h+='</div></div>';`),'오늘 화면을 두 칸으로 감싼다');
  assert.ok(block(idp,'ps-2979-desk').includes('html.ps-page-idp .dcols,html.ps-page-idp .dcol{display:contents}'),'좁은 화면은 예전 순서 그대로');
});

test('the archived-changes line goes quiet once it has been opened',()=>{
  assert.ok(app.includes(`if(st&&st.action==='recovery'&&archSeen())st={kind:'ok',text:'저장됨',detail:st.detail||'',action:''};`));
  assert.ok(app.includes('function archSeen(){var n=archCount();return n>0&&Number(archSeenMap()[archKey()])===n;}'),'같은 개수일 때만 조용하다 — 새 보관이 생기면 다시 뜬다');
});

test('schedule week: filled rows only, one fill door, sync line only when it needs attention',()=>{
  const a=proc.indexOf('function wksCard(di,slot){'),b=proc.indexOf('function wksReviewStrip(){',a),f=proc.slice(a,b);
  assert.ok(a>0&&b>a);
  assert.equal(f.includes('class="wks-plus"'),false,'카드 안에 ＋ 를 줄마다 세우지 않는다');
  assert.equal(f.includes('wksRow('),false);
  assert.ok(f.includes(`h+='<button type="button" class="wks-fill'`)&&f.includes(`var _any=!!(aims||rpe||_mch||_tch||_lch)`));
  assert.ok(proc.includes(`try{ box.classList.toggle('att',att); }catch(_){}`)&&proc.includes('compact=ph||!att'));
  assert.ok(proc.includes('box.hidden=false;'),'줄을 지우지 않는다 — 받은 시각은 기기가 뒤처졌을 때 알아채는 표시다');
});
