const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');

/* 3.299 — 폰 전용 세로 편집(studio/board-phone-edit.js). 사용자 «폰에서는 운동장 하나에 세로만 수정 가능하게 · 폰 전용» → 목업 B «보기 → 편집».
   순수 규칙(누가 · 언제 열 수 있나 · 줄의 글 · 선 단추)은 여기, 실제 편집 모드 · 도구 · 저장 · 가드는 tests/browser/board-phone-edit-3299.mjs. */
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const PE=require('../studio/board-phone-edit.js');

test('canEdit: 폰 · 펼치지 않음 · 부팅 끝 · 작업 보드 화면 · 운동장 하나일 때만',()=>{
  const ok={phone:true,expanded:false,ready:true,csView:'board',vault:false,community:false,meeting:false,editing:false,viewOnly:false,pitchN:1};
  assert.deepEqual(PE.canEdit(ok),{ok:true,why:'ok'});
  assert.deepEqual(PE.canEdit({...ok,pitchN:undefined}),{ok:true,why:'ok'},'pitchN 이 없으면 하나');
  const no=(patch,why)=>{const d=PE.canEdit({...ok,...patch});assert.equal(d.ok,false,why);assert.equal(d.why,why);};
  no({phone:false},'not-phone');
  no({expanded:true},'expanded');
  no({ready:false},'booting');
  no({csView:'session'},'view:session');
  no({vault:true},'vault');
  no({community:true},'community');
  no({meeting:true},'meeting');
  no({editing:true},'editing');
  no({viewOnly:true},'view-only');
  no({pitchN:2},'multi-pitch');
  no({pitchN:6},'multi-pitch');
  assert.equal(PE.canEdit(null).ok,false);
});

test('barText: 열 수 있으면 사실 한 줄 · 운동장이 여럿이면 안내 · 그 밖엔 줄 없음',()=>{
  assert.equal(PE.barText({ok:true,why:'ok'}),'세로 · 운동장 1');
  assert.equal(PE.barText({ok:false,why:'multi-pitch'}),'운동장이 여럿인 보드는 큰 화면에서 고쳐요');
  assert.equal(PE.barText({ok:false,why:'vault'}),'');
  assert.equal(PE.barText(null),'');
});

test('nextLine: 직선 ↔ 점선',()=>{
  assert.equal(PE.nextLine('line'),'dashline');
  assert.equal(PE.nextLine('dashline'),'line');
  assert.equal(PE.nextLine('move'),'line');
});

test('도구 띠 여덟 · 화살표 다섯 · 팀 넷 — 목업 B 그대로',()=>{
  assert.deepEqual(PE.TOOLS_LIST.map(t=>t[0]),['move','players','arrow','line','rect','text','eraser','undo']);
  assert.deepEqual(PE.ARROWS.map(a=>a[0]),['run','pass','dribble','line','dashline']);
  assert.deepEqual(PE.TEAMS.map(t=>t[0]),['blue','red','yellow','green']);
});

test('wired into the board: <script> after the open chooser · phone-view guard honours the edit flag · sw.js CORE · no new storage key · budget',()=>{
  const b=read('studio/board.html'),sw=read('sw.js'),pv=read('studio/board-phone-view.js'),src=read('studio/board-phone-edit.js');
  const oi=b.indexOf('<script src="board-open-chooser.js"></script>'),pi=b.indexOf('<script src="board-phone-edit.js"></script>');
  assert.ok(oi>=0&&pi>oi,'불러오기 창 모듈 뒤');
  assert.ok(pi<b.indexOf('window.__boardReady=false'),'본문보다 먼저 읽힌다');
  assert.match(pv,/function readOnly\(win\)\{return phone\(win\)&&!expanded\(win\)&&!\(win&&win\.__psPhoneEditOn===true\);\}/,'편집 모드 동안 가드가 풀린다');
  assert.ok(sw.includes("'/studio/board-phone-edit.js'"),'sw.js CORE');
  assert.ok(!/localStorage|sessionStorage/.test(src),'새 저장 키 없음 — 편집 모드는 메모리뿐');
  const boot=(src.match(/var boot = function \(\) \{([\s\S]*?)\n    \};/)||[])[1];assert.ok(boot,'boot 블록');
  assert.ok(!/renderTokens|repaint\(/.test(boot),'켜질 때 renderTokens 를 부르지 않는다(3.120) — 다시 그리기는 «편집» · «완료»를 누를 때만');
  assert.match(src,/__setBoardOrient\('v'\)/,'편집 모드에 들어가며 세로로');
  assert.match(src,/type: 'focusBoard', on: !!on/,'편집 모드 동안 셸 머리 · 메뉴를 걷는다');
  assert.match(src,/win\.commViewTok = w;/,'선수 배율은 commViewTok 을 감싼다(보관함 폰 보기와 같은 길)');
  assert.match(src,/win\.__capLock = had \+ 1;[\s\S]*?finally \{ win\.__capLock = had; \}/,'배율만 바뀐 다시 그리기는 편집으로 세지 않는다');
  assert.ok(Buffer.byteLength(b)<=2560000,'board.html budget '+Buffer.byteLength(b));
});

test('글자 · 굵기 · 모서리는 새 블록 기준(12·14·16·20 / 500·600·700 / 6·10·999)',()=>{
  const src=read('studio/board-phone-edit.js');
  const css=(src.match(/var CSS = '' \+([\s\S]*?);\n\n  function el/)||[])[1];assert.ok(css,'CSS 블록');
  const sizes=[...css.matchAll(/font-size:(\d+)px/g)].map(m=>+m[1]);
  assert.ok(sizes.length>8);
  sizes.forEach(s=>assert.ok([12,14,16,20].includes(s),'font-size '+s));
  [...css.matchAll(/font-weight:(\d+)/g)].forEach(m=>assert.ok(['500','600','700'].includes(m[1]),'font-weight '+m[1]));
  [...css.matchAll(/border-radius:([^;']+)/g)].forEach(m=>m[1].split(/\s+/).forEach(v=>assert.ok(['6px','10px','999px','0'].includes(v),'radius '+v)));
  assert.match(css,/#' \+ TOOLS \+ ' button\{[^}]*height:60px/,'도구 칸 60px');
  assert.match(css,/\.ps-chip\{[^}]*height:44px/,'팀 칩 44px');
  assert.match(css,/\.pe-btn\{[^}]*height:36px/,'«편집» 단추 36px');
  assert.match(css,/\.ps-opt\{[^}]*min-height:48px/,'시트 줄 48px');
});
