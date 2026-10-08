'use strict';
/* 2.963 — 전체 디자인 점검 2판: «아무 일 없음»을 줄마다 색으로 말하지 않는다 + 바로 고칠 작은 것.
   선수단 «정상»·가용인원 «가능» 조용히 · 보관함 줄 버튼은 고른 줄에만 · 미리보기 주 버튼 하나 · «＋ 만들기» 머리줄 ·
   IDP 표 입력칸은 누른 줄에만 · 커뮤니티 태그 회색 · 숫자 띠 분모 · 폰 카운트 줄바꿈 · ✎ 아이콘 · 포인트 버튼 자리. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const D=path.join(__dirname,'../studio');
const read=f=>fs.readFileSync(path.join(D,f),'utf8');
const block=(s,id)=>{const i=s.indexOf('<style id="'+id+'">');assert.ok(i>0,id+' 블록이 있다');return s.slice(i,s.indexOf('</style>',i));};

test('squad list: «정상» is quiet on desktop — hidden for mouse until hover, faint (never hidden) for fingers',()=>{
  const s=read('scout.html'),b=block(s,'ps-2963-quiet');
  assert.ok(s.lastIndexOf('<style id="ps-2963-quiet">')>s.lastIndexOf('<style id="ps-2903-phone-squad">'),'앞 층(2.903)보다 뒤 — 문서 맨 끝');
  assert.ok(/@media \(min-width:801px\)\{\s*html\.ps-page-scout #teamList\.tm-4col \.tm-row\[data-status="ok"\]:not\(\.has-proposal\):not\(#_\) \.t-injury\{color:#8A9099!important/.test(b),'데스크톱 기본 = 옅은 회색(손가락 기기에서도 보인다)');
  const hov=b.slice(b.indexOf('@media (min-width:801px) and (hover:hover) and (pointer:fine)'));
  assert.ok(hov.includes('.t-injury{color:transparent!important}'),'마우스 기기만 비운다');
  assert.ok(/:hover \.t-injury,[\s\S]*?:focus-within \.t-injury\{color:var\(--dim/.test(hov),'줄에 손을 올리면(또는 포커스) 보인다');
  assert.ok(b.includes(':not(.has-proposal)'),'제안 대기(→부상) 표시는 그대로 보인다');
});

test('availability: «가능» chip is grey without a border; rest states keep their colour chips',()=>{
  const b=block(read('scout.html'),'ps-2963-quiet');
  assert.ok(/#availView \.av-chip\.ok:not\(#_\):not\(#__\)\{background:transparent;color:var\(--dim,#646A73\);border-color:transparent/.test(b));
  assert.ok(!/\.av-chip\.(injury|rehab|rest|out)/.test(b),'쉼 칩 색은 건드리지 않는다');
});

test('hero denominator sits next to its number, phone count wraps instead of being clipped',()=>{
  const b=block(read('scout.html'),'ps-2963-quiet');
  assert.ok(b.includes('.tm-hero .tm-hero-big:not(#_){justify-content:start!important}'));
  assert.ok(/@media \(max-width:767px\)\{[\s\S]*?\.tm-titleline:not\(#_\)\{flex-wrap:wrap!important[\s\S]*?#teamCount\{flex:1 0 100%!important/.test(b));
});

test('group rename uses a line icon, not the tiny ✎ glyph',()=>{
  const s=read('scout.html');
  assert.ok(!s.includes('e.textContent="✎"'),'작은 ✎ 글자는 % 처럼 읽혔다');
  assert.ok(/e\.className="btn sm grp-edit"[^\n]*<svg viewBox="0 0 24 24"[^\n]*aria-hidden="true"/.test(s));
});

test('scouting points button: moves into the card tool row (desktop shell), one listener, and back on the points screen',()=>{
  const s=read('scout.html');
  const a=s.indexOf('function sbPtsPlace(t){'),e=s.indexOf('\n}\n',a)+2;assert.ok(a>0);
  const fn=s.slice(a,e);
  assert.ok(fn.includes('(t||sbTab)!=="crit"'),'포인트 화면에서는 탭 줄로 돌아간다(«‹ 후보 DB» 로 되돌아갈 길)');
  assert.ok(fn.includes('matchMedia("(max-width:600px)")'),'폰은 그대로');
  assert.ok(/function sbSetTab\(t\)\{[\s\S]*?try\{ sbPtsPlace\(t\); \}catch\(_\)\{\}/.test(s),'탭을 바꿀 때마다 자리를 정한다');
  const init=s.slice(s.indexOf('function sbInit(){'),s.indexOf('var ssg=$("sbShowSeg");'));
  assert.ok(!init.includes('e.target.closest("#sbPtsToggle")'),'탭 줄 위임에서는 뺐다 — 두 번 토글되지 않게');
  assert.ok(init.includes('ptb0.addEventListener("click"'),'버튼에 직접');
  // DOM 흉내로 자리 옮기기 확인
  const nodes={};const mk=(cls)=>({className:cls,parentNode:null,children:[],appendChild(c){if(c.parentNode)c.parentNode.children=c.parentNode.children.filter(x=>x!==c);c.parentNode=this;this.children.push(c);}});
  const tabs=mk('sb-tabs'),row=mk('sb-cardrow sb-cardrow-tools'),btn=mk('sb-ptsbtn');tabs.appendChild(btn);
  const cls=new Set();
  const ctx=vm.createContext({sbTab:'cands',$:id=>id==='sbPtsToggle'?btn:null,window:{matchMedia:()=>({matches:false})},matchMedia:()=>({matches:false}),
    document:{querySelector:q=>q==='.sb-tabs'?tabs:(q==='#sbBoardCard .sb-cardrow-tools'?row:null),documentElement:{getAttribute:()=>'1'},body:{classList:{toggle:(c,on)=>on?cls.add(c):cls.delete(c)}}}});
  vm.runInContext(fn,ctx);
  ctx.sbPtsPlace('cands');assert.equal(btn.parentNode,row,'후보 DB(데스크톱 셸) — 도구 줄 끝');assert.ok(cls.has('sb-pts-inrow'));
  ctx.sbPtsPlace('crit');assert.equal(btn.parentNode,tabs,'포인트 화면 — 탭 줄');assert.ok(!cls.has('sb-pts-inrow'));
});

test('vault: list row buttons only on the selected row (wide), one primary in the preview, create button in the header',()=>{
  const b=block(read('board.html'),'ps-2963-vault');
  assert.ok(/@media \(min-width:901px\)\{\s*html\.ps-page-board #drillFiles \.vx-items\.vx-list \.vcard:not\(\.selected\):not\(#_\) \.vc-acts\{visibility:hidden\}/.test(b),'고른 줄에만 · 자리는 남긴다(visibility)');
  assert.ok(/\(hover:hover\) and \(pointer:fine\)[\s\S]*?:hover \.vc-acts\{visibility:visible\}/.test(b),'마우스는 손을 올린 줄에도');
  assert.ok(/\.vx-preview-actions\.v2:not\(#_\) \.vx-pub,[^{]*\.vx-note\{\s*background:var\(--panel2/.test(b),'커뮤니티에 올리기·개인 노트는 회색 무게');
  assert.ok(/@media \(min-width:901px\)\{\s*html\.ps-page-board #sessionView \.df-head #dfNew:not\(#_\)\{position:static!important;margin-left:auto!important/.test(b),'넓은 화면은 머리줄 오른쪽');
  assert.ok(!b.includes('body.vault-full #sessionView'),'셸 안 보관함엔 vault-full 이 붙지 않는다(실측) — 그 조건을 쓰면 안 먹는다');
});

test('IDP squad table: input only on the opened row; written text stays readable; IME-safe Enter',()=>{
  const s=read('idp.html');
  const a=s.indexOf('  function sqdCellHTML(uid,t,name){'),e=s.indexOf('\n  }\n',a)+4;assert.ok(a>0);
  const ctx=vm.createContext({sqdOpenUid:'',esc:x=>String(x).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))});
  vm.runInContext(s.slice(a,e),ctx);
  const empty=ctx.sqdCellHTML('u1','','가상 선수');
  assert.ok(empty.includes('class="sqd-add"')&&empty.includes('＋ 한 줄')&&!empty.includes('<input'),'안 쓴 줄 — 입력칸 없이 «＋ 한 줄»');
  const wrote=ctx.sqdCellHTML('u2','잘했어 <b>','가상');
  assert.ok(wrote.includes('class="sqd-tt"')&&wrote.includes('잘했어 &lt;b&gt;')&&!wrote.includes('<input'),'쓴 줄 — 그 글(이스케이프)');
  vm.runInContext("sqdOpenUid='u2'",ctx);
  const open=ctx.sqdCellHTML('u2','잘했어','가상');
  assert.ok(open.includes('<input class="sqd-in" data-sqd-in="u2"')&&open.includes('value="잘했어"'),'연 줄에만 입력칸');
  assert.ok(!ctx.sqdCellHTML('u1','','x').includes('<input'),'다른 줄은 그대로');
  assert.ok(!s.includes(`<input class="sqd-in" data-sqd-in="'+esc(uid)+'" maxlength="300" placeholder="❤ 또는 제안·격려 한 줄" value="'+esc((r.rc&&r.rc.t)||'')+'"></td>`),'옛 «줄마다 입력칸» 마크업이 남지 않았다');
  assert.ok(s.includes("if(e.key==='Enter'&&!e.isComposing&&e.keyCode!==229)"),'한글 조합 중 엔터는 흘려보낸다');
  assert.ok(/getComputedStyle\(td\)\.display==='none'\)return;/.test(s),'칸이 숨은 폭(폰)에서는 줄을 눌러도 열지 않는다');
});

test('community: topic tags are one grey, the category colour table stays',()=>{
  const c=read('community.html');
  const a=c.indexOf('function catBadges(catStr){'),e=c.indexOf('\n}\n',a);
  const fn=c.slice(a,e);
  assert.ok(!/style="background:/.test(fn),'태그에 색을 입히지 않는다');
  assert.ok(/\.cat\{[^}]*color:var\(--text-2,#646A73\);background:var\(--surface-2,#F1F3F5\)\}/.test(c));
  assert.ok(c.includes("['rondo','론도','#8E5BC0']"),'CATS 색 값은 남긴다');
});

test('IDP unlinked chip keeps the colours the user chose (2.204 · 2.406 — red unlinked, green linked)',()=>{
  const s=read('scout.html');
  assert.ok(s.includes('justify-self:center!important;color:#d4403a!important;opacity:1!important}'),'점검은 회색을 권했지만 사용자가 두 번 정한 색이라 이번 판에서 바꾸지 않는다');
});
