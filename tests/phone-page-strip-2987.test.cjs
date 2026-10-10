const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.987 — 세로 폰의 보드 탭 · 폰에서 여는 보관함 작전판: 페이지가 둘 이상이면 페이지 띠가 페이지 고르개가 된다.
   띠는 원래 그 자리(52px)에 있었지만 번진 운동장 배경에 덮여 다른 페이지로 넘어갈 길이 없었다(2.985 는 패턴북에서만 올렸다).
   폰은 편집 도구가 없는 화면(2.086)이라 띠도 고르기만 한다. 한 페이지·눕힌 폰·아이패드·데스크톱은 그대로다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }

function phoneNav({book=false,phone=true,width=375,broken=false}={}){
  const c=vm.createContext({
    window:{__vaultBook:book,innerWidth:width},
    document:{body:{classList:{contains:k=>{ if(broken)throw new Error('no body'); return k==='ps-phone-work'&&phone; }}}}
  });
  vm.runInContext(cut('  function _phoneNav(){','\n')+';this.f=_phoneNav;',c);
  return c.f();
}

test('the picker is only for a portrait phone — the shell marks it, and the width stays under 640',()=>{
  assert.equal(phoneNav(),true);
  assert.equal(phoneNav({width:430}),true);
  assert.equal(phoneNav({phone:false}),false,'a narrow desktop window is not a phone');
  assert.equal(phoneNav({width:640}),false,'from 640 the save buttons live in this strip — leave it alone');
  assert.equal(phoneNav({width:932}),false,'a phone on its side keeps what it has');
  assert.equal(phoneNav({book:true}),false,'a patternbook has its own phone strip (2.985)');
  assert.equal(phoneNav({broken:true}),false,'never throws');
});

const css=cut('/* 2.987 — 세로 폰의 보드 탭','\n}\n');

test('the strip rises only when there is a page to pick, and only on the phone',()=>{
  assert.match(css,/@media \(max-width:639\.98px\)\{/);
  const rules=css.split('\n').filter(l=>/#boardPageStrip/.test(l));
  assert.ok(rules.length>=6,'rules: '+rules.length);
  for(const r of rules)assert.match(r,/html\.ps-page-board body\.ps-phone-work:not\(\.book-mode\) #boardPageStrip/,r);
  const rise=rules.filter(r=>/z-index:6!important/.test(r));
  assert.equal(rise.length,1);
  assert.match(rise[0],/#boardPageStrip\.on\.bp-multi:not\(#_\)\{position:relative!important;z-index:6!important/);
  assert.doesNotMatch(rise[0],/height/,'the strip keeps its height — the pitch must not move');
});

test('a phone has no editing tools, so the strip only picks — and the save buttons are left alone',()=>{
  for(const sel of ['.bp-head:not(#_)','.bp-tab .bpx:not(#_)','.bp-add:not(#_)','#bpLinkChip:not(#_)'])
    assert.ok(css.includes('#boardPageStrip '+sel),'hidden on the phone: '+sel);
  assert.match(css,/#bpLinkChip:not\(#_\)\{display:none!important\}/);
  assert.match(css,/#boardPageStrip \.bp-tab:not\(#_\)\{min-height:40px!important/,'a 40px touch target');
  assert.doesNotMatch(css,/boardManualSave|vaultSave/,'«더보기 › 보드 저장»(2.940) presses the real button — do not hide it');
});

test('wiring: the page count marks the strip, and renaming and reordering rest on the phone',()=>{
  assert.match(src,/box\.classList\.toggle\("on", !!show\);\n\s*box\.classList\.toggle\("bp-multi", \(pages\?pages\.length:1\)>1\);/);
  assert.match(src,/if\(typeof opt\.off==="function"&&opt\.off\(\)\)return;/,'PSTouchSort lets the caller switch it off');
  assert.match(src,/PSTouchSort\(box,"\.bp-tab",function\(a,b\)\{ reorder\(a,b\); \},\{dragClass:"bp-dragging",overClass:"bp-over",ctl:"\.bpx",off:_phoneNav\}\)/);
  assert.match(src,/b\.ondblclick=function\(e\)\{ e\.preventDefault\(\); e\.stopPropagation\(\); if\(_phoneNav\(\)\)return; rename\(i\); \};/);
  assert.match(src,/if\(_phoneNav\(\)\|\|_bkNarrow\)\{ var _on=box\.querySelector\("\.bp-tab\.on"\); if\(_on\)box\.scrollLeft=/,'the current page scrolls into the middle of the strip');
});

test('the patternbook rule from 2.985 is untouched',()=>{
  assert.ok(src.includes('html.ps-page-board body.book-mode.ps-phone-work #boardPageStrip.on:not(#_),html.ps-page-board body.book-mode.ps-dock #boardPageStrip.on:not(#_){position:relative!important;z-index:6!important}'));
  assert.ok(src.includes('@media (max-width:767.98px){html.ps-page-board body.book-mode #boardPageStrip.on:not(#_){position:relative!important;z-index:6!important}}'));
});
