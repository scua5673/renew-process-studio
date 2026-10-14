'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const board=R('studio/board.html'),scout=R('studio/scout.html');
const notes=require('../studio/release-notes.js');

/* 3.031 — 오류 제보 88a82188 후속 «처음엔 새 보드가 초기화됐는데 시간이 좀 지나고 누르니 초기화가 안 되고 선수는 그대로 남아 있다».
   «새 보드»는 보드 설정 › 배치 › «기본 세팅»이 있으면 그 배치(선수 포함)로 시작한다. 그 단추(«현재 보드 저장»)가 «보드 저장»과 헷갈려 눌리면
   그 뒤 «새 보드»는 늘 그 선수들로 시작했고, 확인 창은 «선수를 모두 지워요»라고 했다. */
test('3.031 «새 보드» asks «빈 보드 / 기본 세팅» when the saved default has players',()=>{
  const nb=/function newBoard\(\)\{[\s\S]*?\n  \}\n/.exec(board);assert.ok(nb,'newBoard');
  assert.match(board,/function _nbDefaultPlayers\(\)\{ try\{ var d=window\.__psGetBoardDefault&&window\.__psGetBoardDefault\(\); return \(d&&Array\.isArray\(d\.players\)\)\?d\.players\.length:0; \}/);
  assert.match(nb[0],/dn=_nbDefaultPlayers\(\)/);
  const ask=nb[0].indexOf('if(dn){'),plain=nb[0].indexOf('if(!lose){ go(); return; }');
  assert.ok(ask>0&&plain>ask,'the choice comes before the empty-board shortcut — an empty board with a default still asks');
  assert.match(nb[0],/psChoice\("새 보드를 어떻게 시작할까요\?[\s\S]*«새 보드 기본 세팅»에 선수 "\+dn\+"명 배치가 저장돼 있어요/);
  assert.match(nb[0],/\{label:"빈 보드로 시작",primary:true,value:"empty"\},\{label:"기본 세팅으로 시작 \(선수 "\+dn\+"명\)",value:"default"\},\{label:"취소",value:null\}/);
  assert.match(nb[0],/function\(v\)\{ if\(v==="empty"\)go\(false\); else if\(v==="default"\)go\(true\); \}/,'cancel does nothing');
  assert.match(nb[0],/window\.__boardNewCanvas\(keep\)/);
  assert.match(nb[0],/var chain=\(_nbUndo&&_nbSig\(\)===_nbUndo\.fresh\)\?_nbUndo\.prev:null;/,'switching choice on an untouched new board keeps the first board for «↶ 이전 보드»');
  assert.match(nb[0],/_nbUndo=\(chain\|\|lose\)\?\{prev:prev,/);
});

test('3.031 «빈 보드로 시작» keeps the default look but drops its players',()=>{
  const fn=/function boardNewCanvas\(keep\)\{[\s\S]*?\n\}\n/.exec(board);assert.ok(fn);
  assert.match(fn[0],/if\(d&&keep===false\)\{d\.players=\[\];d\.ball=\{x:CX,y:CY\};\}/);
  assert.match(fn[0],/return !!d&&keep!==false;/,'the toast says «기본 세팅으로» only when it was used');
});

test('3.031 the default row button no longer reads like «보드 저장»',()=>{
  assert.match(board,/make\("button","cmd-board-default-save",null,"새 보드로 정하기"\)/);
  assert.doesNotMatch(board,/"현재 보드 저장"/);
  assert.match(board,/toast\("지금 보드를 «새 보드» 기본 세팅으로 정했어요"\+\(__dn\?\(" · 선수 "\+__dn\+"명"\):""\)\+" · 이 보드는 «보드 저장»으로 저장해요"\)/);
});

/* 3.031 — 오류 제보 81e77b91 «새 미팅은 슬라이드쇼가 되는데 보관함에서 가져온 자료는 슬라이드쇼가 없다» — 가져온 것은 작전판(페이지 10)이었다 */
test('3.031 match prep shows «▶ 슬라이드쇼» for vault boards too',()=>{
  assert.match(scout,/'<div class="mmv-acts"><button type="button" class="mm-show" data-mm-show="'\+esc\(d\.libId\)\+'"'/,'no meeting-only condition');
  assert.doesNotMatch(scout,/\(!isB\?'<button type="button" class="mm-show"/);
  assert.match(scout,/sc\.textContent="장면 "\+s\.scenes\+" · 슬라이드쇼에서 재생";/);
});

test('3.031 a board slideshow is a read-only meeting built from its pages — nothing is written to the vault',()=>{
  const fn=/function meetSlidesFromBoard\(d\)\{[\s\S]*?\n  \}\n/.exec(board);assert.ok(fn,'meetSlidesFromBoard');
  assert.match(fn[0],/pdfOrientation:sn\.orientation==="v"\?"portrait":"landscape",snap:cl\(sn\)/,'the page keeps its own direction');
  assert.match(fn[0],/title:String\(p\.name\|\|""\)\.trim\(\)/,'page name = slide title');
  assert.match(fn[0],/if\(fr\.length>=2\)\{ s\.frames=cl\(fr\);/,'scenes stay scenes');
  const op=/window\.__vaultOpenMeeting=function\(libId,opts\)\{[\s\S]*?\n  \};\n/.exec(board)[0];
  assert.match(op,/if\(opts\.show&&\(d\.type\|\|""\)==="board"\)\{ var _bs=meetSlidesFromBoard\(d\);/);
  assert.match(op,/openItem\(\{type:"meeting",name:d\.name\|\|"작전판",slides:_bs,__showOf:d\.libId\},true\);/,'read-only, no libId of its own');
  assert.match(op,/showReturn:_inp\};/,'back to match prep when the show ends');
  assert.match(board,/window\.__vvMeetLib=\(ty==="meeting"&&ro\)\?\(d\.__showOf\|\|d\.libId\|\|null\):null;/);
  assert.match(board,/cur=window\.__curVaultId\|\|\(\(window\.__vvItem&&window\.__vvItem\.libId\)\|\|""\)\|\|window\.__vvMeetLib\|\|"";/,'a read-only meeting from match prep is recognised (vc-match)');
  assert.match(board,/if\(ty==="meeting"\)\{ window\.__vvItem=null; window\.__vvNextItem=null; var _veb=document\.getElementById\("vCreateEdit"\); if\(_veb\)_veb\.style\.display="none"; \}/,'a stale board view (__vvItem) must not hide __vvMeetLib or leave «편집» pointing at another item');
});

test('3.031 version and release note',()=>{
  /* 3.032 — 뒤 판이 올라가도 깨지지 않게: 3.031 이상 · sw.js CACHE = app.html PS_BUILD = ?v= 일곱 곳 · 3.031 은 sw.js 기록에 남는다 */
  const cache=(R('sw.js').match(/^const CACHE = 'process-(3\.\d{3})';/m)||[])[1],build=(R('studio/app.html').match(/window\.PS_BUILD='(3\.\d{3})'/)||[])[1];
  assert.ok(cache&&build);assert.equal(cache,build);assert.ok(+build.slice(2)>=31,build);
  assert.equal((R('studio/app.html').match(new RegExp('\\?v='+build.replace('.','\\.')+'"','g'))||[]).length,7);
  assert.match(R('sw.js'),/^(const CACHE = 'process-3\.031';|\/\/) 3\.031 오류 제보 둘/m,'3.031 판 기록');
  const e=notes.entries().find(x=>x.id==='2026-10-14-v3-031-reports');assert.ok(e,'3.031 note');
  assert.ok(e.changes.some(c=>/«빈 보드로 시작»/.test(c))&&e.changes.some(c=>/«새 보드로 정하기»/.test(c))&&e.changes.some(c=>/«▶ 슬라이드쇼»/.test(c)));
});
