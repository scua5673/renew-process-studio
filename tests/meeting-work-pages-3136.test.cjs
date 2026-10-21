/* 3.136 — 미팅을 고치는 동안 뒤에 둔 작업 보드의 페이지는 그대로다(738f37d1 을 고치다 찾음).
   작업 보드의 «모든 페이지»(window.__psPages.eachOther · applyNames · thumbs)는 먼저 capture() 로 지금 판을 지금 페이지에 담는다 —
   미팅 중의 지금 판은 슬라이드라, psEachSnapAll(3.122)을 거치지 않는 선수단 불러오기 · 맨 앞/뒤 · 잔상 · 시선 · 이름표 글꼴이
   작업 보드의 다른 페이지를 고치고 지금 페이지에 슬라이드 배치 · 미팅 설정을 적었다. studio/board-tweaks.js 9 · tests/browser/meeting-work-pages.mjs */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const T=require(path.join(root,'studio','board-tweaks.js'));

function fakePages(){
  const calls=[],pages=[{name:'A',thumb:'<svg>a</svg>',snap:{players:[{id:1}]}},{name:'',thumb:'x'},{name:'C',thumb:'<svg>c</svg>'}];
  const P={pg:()=>pages,
    eachOther:fn=>{calls.push('eachOther');return pages.reduce((n,p)=>n+(fn(p.snap,null)||0),0);},
    applyNames:fn=>{calls.push('applyNames');return {pages:pages.length,changed:1};},
    thumbs:()=>{calls.push('thumbs');return {A:'fresh'};}};
  return {P,calls,pages};
}

test('in a meeting the work pages are not read into, captured or changed',()=>{
  const {P,calls}=fakePages();let meet=true;
  assert.equal(T.guardPages(P,()=>meet),true);
  let seen=0;
  assert.equal(P.eachOther(()=>{seen++;return 1;}),0,'nothing changed');
  assert.equal(seen,0,'the callback never sees a work page');
  assert.equal(P.applyNames(()=>1),null,'«이름 전체 장면 적용» counts no pages');
  assert.deepEqual(P.thumbs(),{A:'<svg>a</svg>',C:'<svg>c</svg>'},'the pictures the pages already have — without capturing the slide');
  assert.deepEqual(calls,[],'the board methods (which capture first) are not called');
});

test('on the work board the same calls reach every page',()=>{
  const {P,calls}=fakePages();let meet=false;
  T.guardPages(P,()=>meet);
  assert.equal(P.eachOther(()=>1),3);
  assert.deepEqual(P.applyNames(()=>1),{pages:3,changed:1});
  assert.deepEqual(P.thumbs(),{A:'fresh'});
  assert.deepEqual(calls,['eachOther','applyNames','thumbs']);
  meet=true;assert.equal(P.eachOther(()=>1),0,'decided at call time');
  meet=false;assert.equal(P.eachOther(()=>1),3);
});

test('wraps once; a missing page book waits',()=>{
  assert.equal(T.guardPages(null,()=>true),false);
  assert.equal(T.guardPages({},()=>true),false);
  const {P,calls}=fakePages();
  T.guardPages(P,()=>false);const w=P.eachOther;
  assert.equal(T.guardPages(P,()=>true),true);
  assert.equal(P.eachOther,w,'not wrapped twice');
  P.eachOther(()=>0);assert.deepEqual(calls,['eachOther'],'the first meetOn still decides');
  assert.ok(P.eachOther.__psMeetSafe);
});

test('psEachSnapAll (3.122) still swaps eachOther for a no-op and puts the guarded one back',()=>{
  const src=read('studio/board-tweaks.js');
  assert.match(src,/P\.eachOther = function \(\) \{ return 0; \};/);
  assert.match(src,/finally \{ P\.eachOther = eo; \}/);
  assert.match(src,/hookKit\(\) && hookEach\(\) && hookPages\(\)/,'retried with the other hooks until the page book exists');
  assert.match(src,/function hookPages\(\) \{ return guardPages\(win\.__psPages, function \(\) \{ return doc\.body\.classList\.contains\('meet-mode'\); \}\); \}/);
});

test('every board caller looks __psPages up when it runs (so the guard is the one it calls)',()=>{
  const B=read('studio/board.html');
  // squadSpreadAll · _tokPropAll · zOrderItems · psEachSnapAll · applyNamesAllScenes
  assert.ok((B.match(/window\.__psPages\.eachOther\(function\(snap,frames\)/g)||[]).length>=3);
  assert.match(B,/function squadSpreadAll\(opts,uid0,sq\)\{[\s\S]{0,1600}window\.__psPages\.eachOther\(function\(snap,frames\)/);
  assert.match(B,/function _tokPropAll\(ps,fields\)\{[\s\S]{0,500}window\.__psPages\.eachOther\(/);
  assert.match(B,/pg=window\.__psPages\.applyNames\(s=>_nmApplySnap\(s,byId,byKey\)\)/);
  assert.match(B,/window\.__psPages=\{pg:function\(\)\{return pages;\}/,'the page book is one object — wrapped in place');
  assert.match(B,/eachOther:function\(fn\)\{ if\(!pages\|\|pages\.length<2\) return 0; capture\(\);/,'eachOther captures first — the reason for the guard');
});

test('name font: in a meeting the glyphs come from the other slides, not the work pages',()=>{
  const src=read('studio/board-name-font.js');
  assert.match(src,/doc\.body\.classList\.contains\('meet-mode'\)\) \(typeof anim !== 'undefined' && anim && anim\.slides \|\| \[\]\)\.forEach/);
});

test('wired: service worker, browser suite, version',()=>{
  const sw=read('sw.js');
  assert.ok(sw.includes("'/studio/board-tweaks.js'")&&sw.includes("'/studio/board-name-font.js'"));
  assert.match(read('tests/browser/run-critical.mjs'),/'meeting-work-pages'/);
  const v=+(sw.match(/const CACHE = 'process-3\.(\d{3})'/)||[])[1];assert.ok(v>=136);
  assert.match(read('studio/release-notes.js'),/v3\.136 · 미팅에서 고친 것이 작업 보드의 다른 페이지로 새지 않아요/);
});
