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

/* 2.931 · 폰 판(목업 안 A · 폰) — 왼쪽 세로 띠 대신 위 가로 썸네일 줄 + 아래 줄 넷 */
test('phones get a horizontal thumbnail row and a bottom bar instead of the 108px side strip',()=>{
  const phone=src.slice(src.indexOf('/* 2.931 · 폰 판(목업 안 A · 폰)'),src.indexOf('</style>',src.indexOf('/* 2.931 · 폰 판(목업 안 A · 폰)')));
  assert.match(phone,/@media\(max-width:600px\)\{/);
  assert.match(phone,/body\.meet-mode:not\(\.focus-board\) #ksStrip\{top:52px;bottom:auto;left:0;right:0;width:auto;height:82px;[^}]*flex-direction:row;/);
  assert.match(phone,/body\.meet-portrait #ksStrip \.ksc\{width:46px;\}/);
  assert.match(phone,/body\.meet-mode:not\(\.focus-board\) #ksBot\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(phone,/body\.meeting-page-mode #ksPagePreview\{left:0;width:100%;top:134px;height:calc\(100% - 198px\);\}/);
  assert.match(phone,/#boardStage\{padding-top:140px!important;padding-left:0!important;\}/,'the old 162px side-strip padding does not squeeze the pitch on phones');
  assert.equal(/#ksStrip\{width:108px/.test(src),false,'the 108px side strip is gone');
  /* JS 경계 = CSS 경계 */
  assert.match(src,/function ksPhone\(\)\{try\{return window\.matchMedia\("\(max-width:600px\)"\)\.matches;\}/);
  /* 아래 줄은 위 줄 버튼을 그대로 부른다(동작 두 벌 금지) */
  const bot=src.slice(src.indexOf('    if(bot){ bot.innerHTML="";'),src.indexOf('    if(bot){ bot.innerHTML="";')+1400);
  assert.match(bot,/function\(\)\{bt\.onclick\(\);\}/);
  assert.match(bot,/function\(\)\{editBoard\.onclick\(\);\}/);
  assert.match(bot,/ksShowMenu\(e\.currentTarget,true\)/);
  assert.match(bot,/bmm\.click\(\)/);
  /* 폰에서 지금 슬라이드를 한 번 더 누르면 메뉴 · 넓은 화면은 예전대로 */
  assert.match(src,/if\(i===ci&&ksPhone\(\)\)\{ksCtxMenu\(e,i\);return;\}/);
});

test('the bottom bar is counted as space the board must leave free, wherever the reserve is measured',()=>{
  const sel=src.slice(src.indexOf('function psSelBarLayout(){'),src.indexOf('window.psSelBarLayout=psSelBarLayout;'));
  assert.match(sel,/getElementById\("ksBot"\)[\s\S]*below=Math\.max\(below, Math\.round\(sr\.bottom-kr\.top\)\)/);
  const obs=src.slice(src.indexOf('/* 2.607 — 아래 띠 자리 예약'),src.indexOf('<style id="ps-2614-dock">'));
  assert.match(obs,/getElementById\('ksBot'\)[\s\S]*below=Math\.max\(below,Math\.round\(sr\.bottom-kr\.top\)\)/);
});

test('an empty slide title no longer picks up the global .empty padding',()=>{
  assert.match(src,/headSync[\s\S]{0,400}hd\.classList\.toggle\("empty"/);
  assert.match(src,/#ksHead\.empty\{padding:0;font-size:inherit;line-height:inherit;\}/);
});

test('ksPop can open above its button and clamps to the screen',()=>{
  const a=src.indexOf('  function ksPop(x,y,items,above){');assert.ok(a>=0);
  const code=src.slice(a,src.indexOf('\n',src.indexOf('\n',a)+1));
  const made=[];let clickCb=null;
  const doc={getElementById:()=>null,createElement:()=>{const el={className:'',id:'',style:{},children:[],textContent:'',offsetWidth:160,offsetHeight:100,appendChild(c){this.children.push(c);},remove(){}};return el;},body:{appendChild(m){made.push(m);}},addEventListener:(t,cb)=>{clickCb=cb;},removeEventListener(){}};
  const c=vm.createContext({document:doc,window:{innerWidth:375,innerHeight:812},setTimeout:f=>f()});
  vm.runInContext(code,c);
  c.ksPop(300,759,[['a',()=>{}]],true);
  assert.equal(made[0].style.top,(759-100-4)+'px','above: the menu ends 4px above the button top');
  assert.equal(made[0].style.left,(375-160-8)+'px','clamped inside the screen');
  c.ksPop(10,100,[['a',()=>{}]]);
  assert.equal(made[1].style.top,'100px','default: opens below as before');
});
