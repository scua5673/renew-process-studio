const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const notes=require('../studio/release-notes.js');

/* 3.034 — 사용자 «하단 도크 더 잘보이게 만들어줘». 크기 · 높이 · 배치는 그대로(2.702 «너무 크다» · 2.922 아이패드 한 단계 작게), 대비만.
   3.026 네이비 바꿈이 밝은 모드 데스크톱 · 아이패드 토큰에 다크 값(#1B2640 · #A9BCE6 · #7F98D0)을 넣었고, 아이패드는 svg 가 글자색을 물려받지 않아
   켜진 이동 도구 · 겹쳐 보기 아이콘이 네이비 바탕에 네이비(1.1:1)로 사라졌다. */
const block=()=>{const b=R('studio/board.html'),m=b.match(/<style id="ps-3034-dock-legible">([\s\S]*?)<\/style>/);assert.ok(m,'block');return m[1].replace(/\/\*[\s\S]*?\*\//g,'');};
const PFX='#ps-command-dock'+':not(#_)'.repeat(13);

test('3.034 the legibility block comes after every dock style it overrides and outranks them (14 ids)',()=>{
  const b=R('studio/board.html'),at=b.indexOf('<style id="ps-3034-dock-legible">');
  for(const id of ['ps-2614-dock','ps-2216','ps-2922-ipad-dock','ps-ipad-desktop-dock'])if(b.includes(`<style id="${id}`))assert.ok(b.indexOf(`<style id="${id}`)<at,id+' comes first');
  const css=block();assert.ok(css.includes(PFX),'13 :not(#_) + #ps-command-dock');
  assert.match(css,/@media \(min-width:768px\)\{/);
  assert.doesNotMatch(css,/#ps-dock\b/,'phone dock untouched');
  for(const sel of css.match(/[^{}]+(?=\{)/g).filter(s=>s.includes('#ps-command-dock')))assert.match(sel,/body(?::not\(\.fmdark\)|\.fmdark)?\.command-dock-v5\.rail-full:not\(\.ps-dock\):not\(\.ps-phone-work\)/,'scoped to the desktop/iPad dock: '+sel.trim().slice(0,80));
});

test('3.034 light mode: on = navy with white icon, primary = navy, icons inherit the button colour (the iPad fix)',()=>{
  const css=block();
  assert.match(css,/body:not\(\.fmdark\)[^{]*\{[^}]*--dk-soft:#14213D!important;--dk-soft-ink:#FFFFFF!important;/);
  assert.match(css,/--dk-blue:#14213D!important;[^}]*--dk-primary-bg:#14213D!important;/);
  assert.match(css,/--dk-text:#1F2937!important;--dk-muted:#59616E!important;--dk-line:#D9DEE6!important;--dk-hair:#D9DEE6!important;/);
  assert.match(css,/button:not\(\.catpill\):not\(\.cmd-stamp-token\):not\(\.chip\):not\(#colorBtn\):not\(#cmd-equip-color\) svg\{color:inherit!important;\}/);
  assert.match(css,/#animAdd:not\(:hover\)\{background:#EEF1F6!important;color:#14213D!important;\}/,'＋ no longer white-on-white');
  assert.match(css,/\.anim-frame\.on \.afi\{color:#14213D!important;\}/,'chosen scene number readable on its light card');
});

test('3.034 team pills are not faded, white chips get a hairline, the dark mode white seam is gone; no size changes',()=>{
  const css=block();
  assert.match(css,/\.catpill\.tpill:not\(\.on\)\{opacity:\.9!important;filter:none!important;\}/);
  assert.match(css,/:is\(\.catpill\.tpill,\.cmd-stamp-token\):not\(\.on\)\{box-shadow:inset 0 0 0 1px rgba\(15,23,42,\.24\)!important;\}/);
  assert.match(css,/body\.fmdark[^{]*\{[^}]*--dk-soft:#5070B5!important;--dk-soft-ink:#FFFFFF!important;/);
  assert.match(css,/#cmd-tool-row\{border-top-color:transparent!important;\}/);
  assert.doesNotMatch(css,/(?:^|[;{\s])(?:width|height|min-width|min-height|max-width|max-height|padding|margin|font-size|flex)\s*:/,'contrast only — no geometry');
});

test('3.034 version and release note',()=>{
  const app=R('studio/app.html'),build=app.match(/window\.PS_BUILD='([0-9.]+)'/)[1];
  assert.ok(Number(build)>=3.034);assert.match(R('sw.js'),new RegExp("const CACHE = 'process-"+build.replace('.','\\.')+"'"));
  const e=notes.entries().find(x=>x.id==='2026-10-15-v3-034-dock-legible');assert.ok(e);assert.match(e.title,/하단 도크/);
  assert.match(e.changes.join(' '),/단추 크기와 도크 높이는 그대로/);
});
