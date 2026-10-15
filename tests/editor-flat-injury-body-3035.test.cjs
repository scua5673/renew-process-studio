'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('node:vm');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const board=R('studio/board.html'),scout=R('studio/scout.html');
const notes=require('../studio/release-notes.js');

/* 3.035 — 사용자 «훈련 세션 만들기 들어갔을 때는 보드 설정이 평면에 훈련 피치로». 3.027 이 컴퓨터는 3D 로 시작하게 하자 훈련 편집기도 3D 경기장으로 열렸다.
   편집기는 평면으로 열고(설정 값 ps_board_tilt3d 는 그대로), 나갈 때 되돌린다. */
test('3.035 the training editor opens flat without touching the 3D setting, and brings 3D back on exit',()=>{
  assert.match(board,/window\.__setTilt=function\(on,opts\)\{ on=!!on; opts=opts\|\|\{\}; var _was=document\.body\.classList\.contains\("bc-tilt3d"\); document\.body\.classList\.toggle\("bc-tilt3d",on\);\n    if\(!opts\.transient\)\{ try\{localStorage\.setItem\("ps_board_tilt3d",on\?"1":"0"\);\}catch\(_\)\{\} \}/,'transient keeps the device setting');
  assert.match(board,/if\(!opts\.quiet\)\{ try\{toast\(on\?"3D 보기 — 끌기·그리기 그대로 됩니다":"3D 보기 끔"\);\}catch\(_\)\{\} \}/,'quiet skips the toast');
  const open=/function openEditor\(id,type\)\{[\s\S]*?\n\}\n/.exec(board);assert.ok(open,'openEditor');
  const stash=open[0].indexOf('editorStash=captureSnap();'),flat=open[0].indexOf('window.__edTiltPrev=document.body.classList.contains("bc-tilt3d");');
  assert.ok(stash>0&&flat>stash,'remembered after the stash, inside the first-entry branch');
  assert.match(open[0],/if\(window\.__edTiltPrev&&window\.__setTilt\)\{ window\.__setTilt\(false,\{transient:true,quiet:true\}\);/);
  assert.match(open[0],/localStorage\.getItem\("ps_editor_flat_told"\)!=="1"/,'told once');
  assert.match(open[0],/toast\("훈련 편집기는 평면으로 열려요 — 나가면 3D 로 돌아갑니다"\)/);
  assert.match(open[0],/window\.__applyPitch\('train', null\);/,'new trainings still get the train pitch');
  const close=/function closeEditor\(save\)\{[\s\S]*?\n\}\n/.exec(board);assert.ok(close,'closeEditor');
  assert.match(close[0],/var _etp=window\.__edTiltPrev; window\.__edTiltPrev=false;\n    if\(_etp&&!document\.body\.classList\.contains\("bc-tilt3d"\)&&window\.__setTilt\)\{ var _tv=null; try\{ _tv=localStorage\.getItem\("ps_board_tilt3d"\); \}catch\(_\)\{\} if\(_tv!=="0"\)window\.__setTilt\(true,\{transient:true,quiet:true\}\); \}/,'back to 3D unless the coach chose flat inside');
  const restorePitch=close[0].indexOf('if(__spPrevPitch!=null)'),restoreTilt=close[0].indexOf('var _etp=window.__edTiltPrev');
  assert.ok(restorePitch>0&&restoreTilt>restorePitch,'pitch first, then 3D — the fit measures the restored board');
});

/* 사용자 «그리드 선택했을 때 보드에 여백이 없이 다 활용할 수 있게». 3D 에서 그리드 판은 잔디 사다리꼴 둘레가 어두운 무대였다. */
test('3.035 a grid board in 3D fills the stage: no fit margin, grass bleeding one board width outward',()=>{
  assert.match(board,/var TILT_PAD_BLANK=\[\.012,\.012,\.012\];/);
  assert.match(board,/try\{ if\(isBlankSpec\(\)&&\(state\.pitchN\|\|1\)<=1\)pads=TILT_PAD_BLANK; \}catch\(_\)\{\}/,'after the multi-pitch rule');
  assert.match(board,/const bleed=\(!multi&&!!sp\.blank\)\?Math\.max\(PW,PH\)\*\.5:0;/,'half a board outward — enough for the low camera, small enough for the iPad');
  assert.match(board,/r=r0\+Math\.min\(d,dRo\),a='A'/,'the bleed keeps square corners (rounded only up to the roof)');
  assert.match(board,/if\(bleed\)o\+=line\(0,'#ffffff',S\*\.0014,\.18\);/,'a faint line marks where the board (card, photo) ends');
  assert.match(board,/const dE=bleed\?dT\+bleed:\(deco==="full"\?dRo:\(deco==="simple"\?dT\+S\*\.03:dT\)\);/,'the picture box grows with the bleed');
  assert.match(board,/ring\(0,bleed\?dE:dT,'url\(#psStGrass\)'\)\+ring\(0,bleed\?dE:dT,'url\(#psStMow\)'\)\+ring\(0,dT,'#0b2410',\.18\)/,'grass and mowing stripes reach the bleed edge');
  assert.match(board,/tcol,bleed\?1:0\]\.join\('\|'\)/,'the signature redraws when the bleed changes');
  assert.match(board,/var TILT_PAD=\{full:\[\.15,\.11,\.05\],simple:\[\.09,\.08,\.035\],grass:\[\.05,\.05,\.03\]\};/,'other stadiums unchanged');
});

/* 사용자 «부상 부위 사람 모형으로 해서 선택할 수 있게». 가용인원 › 부상 기록 창(2.943)의 부위 칩 위에 앞 · 뒤 사람 모형 */
test('3.035 the injury sheet has a front and a back body figure; a click picks the part and its side',()=>{
  const c=vm.createContext({data:{meta:{}},Date,String,Math,esc:s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]))});
  vm.runInContext(scout.slice(scout.indexOf('var INJ_PARTS='),scout.indexOf('function stEpisodes(')),c);
  assert.equal(c.INJ_PARTS.length,19);
  for(const p of ['목','가슴','손','엉덩이','정강이'])assert.ok(c.INJ_PARTS.includes(p),p);
  assert.equal(c.INJ_PARTS[c.INJ_PARTS.length-1],'기타');
  const front=c.injBodySvg('front'),back=c.injBodySvg('back');
  const parts=s=>[...s.matchAll(/data-part="([^"]+)" data-side="([LR]?)"/g)].map(m=>m[1]+'/'+m[2]);
  const pf=parts(front),pb=parts(back);
  assert.ok(pf.includes('얼굴/')&&pf.includes('사타구니/')&&pf.includes('허벅지 앞/L')&&pf.includes('허벅지 앞/R')&&pf.includes('정강이/L'),'front: face, groin, quads, shins');
  assert.ok(pb.includes('등/')&&pb.includes('허리/')&&pb.includes('햄스트링/L')&&pb.includes('종아리/R')&&pb.includes('엉덩이/L'),'back: back, lower back, hamstrings, calves, glutes');
  assert.ok(!pf.includes('햄스트링/L')&&!pb.includes('얼굴/'),'hamstrings only on the back, the face only on the front');
  /* 앞 모형은 마주 보는 사람 — 화면 왼쪽(x<60)이 선수의 오른쪽. 뒤 모형은 화면 왼쪽이 선수의 왼쪽 */
  const kneeFront=[...front.matchAll(/<ellipse cx="([\d.]+)"[^>]*data-part="무릎" data-side="([LR])"/g)].map(m=>[+m[1],m[2]]);
  const kneeBack=[...back.matchAll(/<ellipse cx="([\d.]+)"[^>]*data-part="무릎" data-side="([LR])"/g)].map(m=>[+m[1],m[2]]);
  assert.deepEqual(kneeFront.sort((a,b)=>a[0]-b[0]).map(k=>k[1]),['R','L'],'front: right knee on the viewer\'s left');
  assert.deepEqual(kneeBack.sort((a,b)=>a[0]-b[0]).map(k=>k[1]),['L','R'],'back: left knee on the viewer\'s left');
  assert.ok(Math.abs(kneeFront[0][0]+kneeFront[1][0]-120)<.01,'mirrored around x=60');
  for(const p of new Set([...pf,...pb].map(x=>x.split('/')[0])))assert.ok(c.INJ_PARTS.includes(p),'every figure part is in the list: '+p);
  assert.match(front,/<title>왼쪽 무릎<\/title>/);assert.match(front,/<title>얼굴<\/title>/);
  assert.match(scout,/'<div class="inj-body"><figure>'\+injBodySvg\("front"\)\+'<figcaption>앞<\/figcaption><\/figure><figure>'\+injBodySvg\("back"\)\+'<figcaption>뒤<\/figcaption><\/figure><\/div>'/);
  assert.match(scout,/'<div class="inj-pick" data-inj-pick aria-live="polite"><\/div><div class="inj-c" data-f="part"><\/div><\/div>'/,'the chips stay under the figures');
  const sheet=scout.slice(scout.indexOf('function stInjurySheet('),scout.indexOf('document.addEventListener("click",function(ev){\n  var b=ev.target&&ev.target.closest&&ev.target.closest("[data-inj-edit]")'));
  assert.match(sheet,/if\(sel\.part===p&&\(sel\.side\|\|""\)===sd\)\{sel\.part="";sel\.side="";\}else\{sel\.part=p;sel\.side=sd\?\(sel\.side==="B"\?"B":sd\):"";\}/,'same spot again clears · «양쪽» survives a part change · centre parts have no side');
  assert.match(sheet,/on=!!sel\.part&&r\.getAttribute\("data-part"\)===sel\.part&&\(!sd\|\|!sel\.side\|\|sel\.side==="B"\|\|sd===sel\.side\)/,'both sides lit until a side is chosen');
  assert.match(sheet,/pk\.textContent=sel\.part\?\("고른 부위 · "\+stInjLabel\(\{part:sel\.part,side:sel\.side\}\)\):"모형에서 누르거나 아래 목록에서 고르세요"/);
  assert.match(scout,/#stInjOv \.inj-body \[data-part\]\.on,#stInjOv \.inj-body \[data-part\]\.on:hover\{fill:#C24A46\}/,'injury red');
  assert.match(scout,/body\.fmdark #stInjOv \.inj-body \[data-part\]\{fill:#3A414B\}/,'dark mode');
});

test('3.035 release note and cache',()=>{
  const e=notes.entries().find(x=>x.id==='2026-10-15-v3-035-editor-flat-injury-body');assert.ok(e);
  assert.match(e.title,/v3\.035/);assert.equal(e.changes.length,3);
  assert.match(e.changes[0],/평면 · 훈련 피치/);assert.match(e.changes[1],/그리드/);assert.match(e.changes[2],/사람 모형/);
  assert.match(R('sw.js'),/const CACHE = 'process-3\.035';/);
  assert.match(R('studio/app.html'),/window\.PS_BUILD='3\.035';/);
});
