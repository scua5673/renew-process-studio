/* 3.102 — 오류 제보 934aaa3e(엘미하) «보드 설정에서 운동장 스타일을 수정하면, 해당 페이지 뿐만 아니라 모든 페이지가 적용돼야».
   피치를 바꾸면 작전판의 모든 페이지(와 그 장면) · 미팅의 모든 슬라이드(와 그 장면)에. 기본이 판 전체 — 알림의 «이 페이지만»으로 되돌린다.
   CLAUDE.md «전체에 적용» 단추를 더하지 말고 기본을 «판 전체»로. studio/board-tweaks.js · tests/browser/board-pitch-all-pages.mjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const T=require(path.join(root,'studio','board-tweaks.js'));
const PHOTO='@photo:0123456789abcdef-160x90';

test('every other page and its scenes take the pitch; the open page is skipped; players and orientation stay',()=>{
  const pages=[
    {snap:{pitchTheme:'white',players:[1],orientation:'v'},anim:{frames:[{snap:{pitchTheme:'white'},thumb:'a'},{snap:{pitchTheme:''}}]}},
    {snap:{pitchTheme:''}},
    {snap:{pitchTheme:'grass',pitchImg:'@real',pitchCustom:null}}
  ];
  const cur={pitchTheme:'calm',pitchCustom:null,pitchImg:null};
  const recs=T.spreadPitch(pages,cur,1);
  assert.equal(recs.length,2,'two other pages');
  assert.deepEqual(pages[0].snap,{pitchTheme:'calm',players:[1],orientation:'v'});
  assert.deepEqual(pages[0].anim.frames.map(f=>f.snap.pitchTheme),['calm','calm']);
  assert.deepEqual(pages[1].snap,{pitchTheme:''},'the open page is the board itself — left to the board');
  assert.equal(pages[2].snap.pitchImg,null,'real grass off when a flat colour is picked');
  T.undoPitch(recs);
  assert.deepEqual(pages[0].snap,{pitchTheme:'white',players:[1],orientation:'v'},'«이 페이지만» puts the others back');
  assert.deepEqual(pages[0].anim.frames.map(f=>f.snap.pitchTheme),['white','']);
  assert.equal(pages[2].snap.pitchImg,'@real');
});

test('a custom colour and real grass travel; «네이비» and missing values compare as the board reads them',()=>{
  const a={snap:{pitchTheme:'navy'}},b={snap:{}};
  assert.equal(T.spreadPitch([a],{pitchTheme:''},-1).length,0,'navy = «» (the default)');
  assert.equal(T.spreadPitch([b],{pitchTheme:''},-1).length,1,'a page without a pitch gets one');
  const c={snap:{pitchTheme:'',pitchCustom:null}};
  T.spreadPitch([c],{pitchTheme:'custom',pitchCustom:'#345678'},-1);
  assert.deepEqual(c.snap,{pitchTheme:'custom',pitchCustom:'#345678'});
  const d={snap:{pitchTheme:'calm'}};
  T.spreadPitch([d],{pitchTheme:'grass',pitchImg:'@real'},-1);
  assert.deepEqual(d.snap,{pitchTheme:'grass',pitchImg:'@real'});
});

test('a page photo (3.100) is that page\'s own content: never spread, never covered',()=>{
  const p={snap:{pitchTheme:'',pitchImg:PHOTO}},q={snap:{pitchTheme:''}};
  assert.equal(T.putPitch(p.snap,{pitchTheme:'calm'}),null);assert.equal(p.snap.pitchImg,PHOTO);
  assert.equal(T.spreadPitch([q],{pitchTheme:'',pitchImg:PHOTO},-1).length,0,'a photo picked on one page stays on that page');
});

test('meeting slides: the slide list shape (frames on the slide)',()=>{
  const s=[{snap:{pitchTheme:'calm'}},{snap:{pitchTheme:'white',orientation:'h'},frames:[{snap:{pitchTheme:'white'}},null]}];
  const recs=T.spreadPitch(s,{pitchTheme:'calm'},-1);
  assert.equal(recs.length,1,'the open slide (already synced) is unchanged');
  assert.equal(s[1].snap.pitchTheme,'calm');assert.equal(s[1].snap.orientation,'h');assert.equal(s[1].frames[0].snap.pitchTheme,'calm');
});

test('wiring: human pitch changes go through _viewScenesMatch("pitch"); pages are reachable; offline cache; CI',()=>{
  const b=read('studio/board.html'),w=read('studio/board-tweaks.js');
  assert.match(b,/if\(e\.isTrusted\|\|window\.__psUserClick\)\{ try\{_viewScenesToast\(_viewScenesMatch\("pitch"\),"피치를"\);\}catch\(_\)\{\} \}/,'pitch buttons (people only)');
  assert.match(b,/if\(!_silent\)\{try\{boardSaveLive\(\);\}catch\(_\)\{\}try\{_viewScenesSoon\("pitch","피치 색을"\);\}catch\(_\)\{\}\}/,'colour picker (people only)');
  assert.match(b,/^function _viewScenesMatch\(kind\)\{/m,'a function declaration — a window property board-tweaks wraps');
  assert.match(b,/window\.__psPages=\{pg:function\(\)\{return pages;\},/,'the live page list');
  assert.match(b,/book:\{[\s\S]{0,400}idx:function\(\)\{ return idx; \},/,'the open page');
  assert.match(w,/var g = function \(kind\) \{ var r = f\.apply\(this, arguments\); if \(kind === 'pitch'\) \{ try \{ spreadNow\(\); \} catch \(_\) \{\} \} return r; \};/);
  assert.match(w,/if \(playing\(\) \|\| doc\.body\.classList\.contains\('editing'\)\) return null;/,'not while playing, not inside the training editor');
  assert.match(w,/win\.__meetSyncCur\(\{ thumb: true \}\)/,'the open slide is stored and its picture redrawn first');
  /* 다른 페이지 · 슬라이드 그림은 한 번에 그리지 않는다 — 슬라이드 9장에 화면이 몇 초 멈추고 알림이 늦었다(WebKit) */
  assert.doesNotMatch(w,/recs\.forEach\(function \(r\) \{ thumbsOf\(r, meet\); \}\)/,'no all-at-once redraw');
  assert.equal((w.match(/queueThumbs\(recs, meet\);/g)||[]).length,2,'spread and «이 페이지만» both queue the pictures');
  assert.match(w,/if \(thumbBusy\(\)\) \{ if \(\+\+q\.tries < 600\)/,'never swaps the board while playing · dragging · exporting · editing');
  assert.match(read('tests/browser/run-critical.mjs'),/board2:\['board-pitch-all-pages',/);
  assert.match(read('sw.js'),/'\/studio\/board-tweaks\.js'/);
});
