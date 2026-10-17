// 3.084 — 만들기 화면 한 틀(사용자 «보관함에서 훈련만들기는 어떻게 하는게 좋을까?» · «이것들 전부 같은 결로 만들고 싶어»)
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const cf=require('../studio/board-create-frame.js');
const src=fs.readFileSync(path.join(__dirname,'../studio/board-create-frame.js'),'utf8');
test('kind from the header title — same letters and colours as the vault «무엇을 만들까요?» chooser',()=>{
  assert.strictEqual(cf.kindOf('훈련 세션 만들기'),'train');
  assert.strictEqual(cf.kindOf('훈련 편집'),'train');
  assert.strictEqual(cf.kindOf('세트피스 만들기'),'setpiece');
  assert.strictEqual(cf.kindOf('작전판 만들기'),'board');
  assert.strictEqual(cf.kindOf('패턴북 수정'),'book');
  assert.strictEqual(cf.kindOf('미팅 만들기'),'meeting');
  assert.strictEqual(cf.kindOf(''),'board');
  const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  for(const k of Object.keys(cf.KINDS)){
    const it=cf.KINDS[k];
    assert.ok(board.includes('icon:"'+it.ic+'",color:"'+it.color+'"'),k+' matches the chooser');
  }
});
test('one header for both: vault create bar and the training editor head; phone untouched',()=>{
  const c=cf.css();
  assert.match(c,/#vCreateBar[^{]*\{min-height:56px!important;height:56px!important/);
  assert.match(c,/#editorModal \.modal-head\{min-height:56px!important/);
  // 폰(760 미만)에는 새 표시 · 단추가 없다 — 머리줄 규칙은 760 이상에서만
  assert.match(c,/^\.cf-badge,\.cf-panel-btn\{display:none\}$/m);
  assert.match(c,/^@media \(min-width:760px\)\{/m);
  // 보드가 숨겨 둔 단추(복사본 저장 등)는 그대로 숨김
  assert.match(c,/\.btn\[style\*="display:none"\]/);
});
test('training editor (wide): floating tabs, floating card, dock centred on the board, fold button',()=>{
  const c=cf.css();
  assert.match(c,/@media \(min-width:1000px\)\{/);
  assert.match(c,/#trainingStrip\{position:absolute!important;top:8px!important;left:12px!important/);
  assert.match(c,/#editorPanel\{position:absolute!important;top:6px!important;right:12px!important;bottom:12px!important;width:340px!important/);
  assert.match(c,/#editorBoardWrap\{position:relative!important;flex:1 1 auto!important;min-width:0!important;margin:0 364px 0 0!important/);
  assert.match(c,/\.cf-panel-off #editorModal #editorPanel\{display:none!important\}/);
  assert.match(c,/#ps-command-dock[^{]*\{left:calc\(\(100vw - 364px\) \/ 2\)!important/);
  assert.match(c,/\.cf-dock-full:not\(\.cf-panel-off\) #editorModal #editorPanel\{bottom:calc\(var\(--cf-dock-h,58px\) \+ 26px\)!important\}/);
  // 차례(CSS order) — 이 훈련 이름 · 분 × 세트가 맨 위
  assert.match(c,/#editorPanel>\.ep-row\[class="ep-row"\]:not\(\[id\]\)\{order:1;/);
  assert.match(c,/#editorPanel>\.ep-training-meta\{order:2;/);
});
test('no endless observer loop: classes are removed only when present; no whole-board subtree watch',()=>{
  assert.match(src,/if \(body\.classList\.contains\('cf-dock-full'\)\) body\.classList\.remove\('cf-dock-full'\)/);
  assert.match(src,/if \(!now && body\.classList\.contains\('cf-panel-off'\)\) body\.classList\.remove\('cf-panel-off'\)/);
  assert.doesNotMatch(src,/observe\(body, \{[^}]*subtree: true/);
});
test('wiring: board loads the module after the kit editor; service worker caches it',()=>{
  const b=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  assert.match(b,/<script src="board-kit\.js"><\/script><script src="board-create-frame\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),/'\/studio\/board-create-frame\.js'/);
});
test('meeting (step 2): own toolbar wins over the board top bar, no drawing dock on slide pages, one save in the vault',()=>{
  const c=cf.css();
  assert.match(c,/body\.ps-dock-float\.meet-mode:not\(\.focus-board\) #boardPageStrip\.ps-tb(:not\(#cf\d+\))+\{display:none!important\}/);
  assert.match(c,/body\.ps-dock-float\.meeting-page-mode #ps-command-dock(:not\(#cf\d+\))+,/);
  assert.match(c,/body\.vcreating(:not\(#cf\d+\))+ #ksTop \.ksbar \.kssave\{display:none!important\}/);
  // 넓은 화면: 슬라이드 목록 · «이 슬라이드» = 떠 있는 카드, 종이는 둘 사이
  assert.match(c,/@media \(min-width:980px\)\{/);
  assert.match(c,/ #ksStrip\{left:12px!important;top:52px!important;bottom:12px!important;width:150px!important/);
  assert.match(c,/ #ksEd\{right:12px!important;top:52px!important;bottom:12px!important;width:300px!important/);
  assert.match(c,/ #ksPagePreview\{left:174px!important;width:calc\(100% - 174px - 324px\)!important/);
});
test('badge kind on the vault bar comes from board state (item names are not types)',()=>{
  assert.match(src,/if \(c\.contains\('book-mode'\) \|\| win\.__vaultBook\) return 'book';/);
  assert.match(src,/if \(c\.contains\('meet-mode'\)\) return 'meeting';/);
  assert.match(src,/var it = win\.__vvItem; if \(it && KINDS\[it\.type\]\) return it\.type;/);
});
