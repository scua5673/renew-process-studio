'use strict';
/* 2.930 — 미팅 세로형 편집: 위 한 줄 도구줄 · 책상 위 종이 · 오른쪽 «이 슬라이드» · 방향은 모든 슬라이드 운동장에도 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
function line(start){const a=src.indexOf(start);assert.ok(a>=0,start);return src.slice(a,src.indexOf('\n',a));}

test('choosing an orientation turns every slide pitch the same way and keeps the choice per slide',()=>{
  const code=line('  window.__meetingPageChoose=function(orientation){')+'\n'+src.slice(src.indexOf('\n',src.indexOf('  window.__meetingPageChoose=function(orientation){'))+1,src.indexOf('  };',src.indexOf('  window.__meetingPageChoose=function(orientation){'))+4);
  let renders=0;
  const c=vm.createContext({window:{__ksRender(){renders++;}},communityBoardReadOnly:()=>false,
    anim:{slides:[{snap:{orientation:'h',spFlip:true}},{snap:{orientation:'h'}},{title:'그림 없음'}]}});
  c.window.__vaultReadOnly=false;
  vm.runInContext(code,c);
  c.window.__meetingPageChoose('portrait');
  assert.deepEqual(c.anim.slides.map(s=>s.pdfOrientation),['portrait','portrait','portrait']);
  assert.deepEqual(c.anim.slides.filter(s=>s.snap).map(s=>s.snap.orientation),['v','v']);
  assert.equal(c.anim.slides[0].snap.spFlip,false);
  assert.equal(c.window.__meetingPageActive,true);assert.ok(renders>0);
  c.window.__meetingPageChoose('landscape');
  assert.deepEqual(c.anim.slides.filter(s=>s.snap).map(s=>s.snap.orientation),['h','h']);
  c.window.__vaultReadOnly=true;c.window.__meetingPageChoose('portrait');
  assert.deepEqual(c.anim.slides.filter(s=>s.snap).map(s=>s.snap.orientation),['h','h'],'read-only meetings are not changed');
});

test('editing the pitch keeps the chosen meeting orientation instead of auto-rotating it',()=>{
  const l=line('  window.__meetingPageEdit=function(){');
  assert.ok(l.indexOf('autoOrient=false')>=0&&l.indexOf('autoOrient=false')<l.indexOf('loadSnap('),'auto-orient is switched off before the slide pitch is loaded');
});

test('the meeting tools sit in one top row and the page sits centered on a desk',()=>{
  assert.match(src,/if\(top\)\{top\.innerHTML="";top\.appendChild\(bar\);\}else strip\.appendChild\(bar\);/);
  assert.match(src,/\["PDF로 내보내기",function\(\)\{exportMeetingPDF\(\);\}\],\["PPT로 내보내기"/);
  assert.match(src,/#ksTop\{position:absolute;left:0;right:0;top:0;height:52px;/);
  assert.match(src,/body\.meet-mode:not\(\.focus-board\) #ksTop\{display:flex;\}/);
  /* 종이는 가운데: 좌우 auto 여백(!important), 위 여백은 fit() 가 계산해 넣는다(!important 로 막지 않는다) */
  const _d=src.indexOf('function deskCss(land)');const desk=src.slice(_d,src.indexOf('function fit()',_d));
  assert.match(desk,/margin-left:auto!important;margin-right:auto!important/);
  assert.equal(/margin:0 auto!important/.test(desk),false);
  assert.match(src,/doc\.body\.style\.marginTop=Math\.max\(G\/2,\(H-ph\*z\)\/2\)\/z\+'px'/);
});

test('the right-hand slide panel only appears where there is room, phones keep the toggle and finger-size buttons',()=>{
  const wide=src.slice(src.indexOf('@media(min-width:980px){\n  body.meeting-page-mode #ksPagePreview'),src.indexOf('@media(max-width:600px){#ksTop'));
  assert.match(wide,/body\.meeting-page-mode #ksEd\{display:block!important;left:auto;right:0;top:52px;bottom:0;width:300px;/);
  assert.match(wide,/body\.meeting-page-mode #ksTop \.ksbar \.kstxt\{display:none;\}/);
  assert.match(src,/@media\(max-width:600px\)\{#ksTop \.ksbar button\{height:40px;\}/);
  assert.match(src,/body\.meet-portrait #ksStrip \.ksc \.ktb\{height:auto;aspect-ratio:210\/297;/);
  assert.match(line("  var oldExit=window.__ksExit;"),/classList\.remove\('meet-portrait'\)/);
});
