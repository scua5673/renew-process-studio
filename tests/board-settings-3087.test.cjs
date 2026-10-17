// 3.087 — 사용자 «이름 포지션 번호도 크기 조절 가능하게 해줘» · «보드설정 레이아웃과 디자인 더 잘 만들어줘»
//         · «등번호나 포지션 알약으로 할 때 유니폼색상이 들어가니까 잘 안보이는거 같아».
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const SK=require('../studio/board-settings-skin.js'),NF=require('../studio/board-name-font.js');
test('name size has «아주 크게»; the person tag has its own size, saved per board',()=>{
  const b=read('studio/board.html'),m=read('studio/board-name-font.js'),d=read('studio/board-token-depth.js');
  assert.match(b,/return v==="s"\?0\.8:\(v==="l"\?1\.25:\(v==="xl"\?1\.6:1\)\);/);
  assert.match(b,/window\.__setNameSize=function\(v\)\{ if\(!\/\^\(s\|m\|l\|xl\)\$\/\.test\(v\)\)return;/);
  assert.match(m,/b\.setAttribute\('data-ns', 'xl'\);[^\n]*b\.textContent = '아주 크게'/,'the button joins the existing size row');
  assert.deepStrictEqual(NF.TAG_K,{s:0.8,m:1,l:1.3,xl:1.7});
  assert.match(m,/ext\.tagSize = \{ def: 'm', ok:/,'a per-board look setting (board.html reads window.__psLookExt)');
  assert.match(m,/Object\.defineProperty\(win, '__tagK'/);
  assert.match(d,/var lf = tagK\(doc, opts\) \* size\.font/,'the tag scales');
  assert.match(b,/"labelSeg","tagSizeSeg"\]\]/,'the row sits under «칩 글자»');
  assert.match(m,/row\.classList\.toggle\('ps-tag-off', !person\)/,'only for the «사람» shape');
});
test('the person tag is a dark pill with white letters; the kit colour is a thin bar',()=>{
  const d=read('studio/board-token-depth.js');
  assert.match(d,/'class': 'ps-person-tag', [^\n]*fill: 'rgba\(14,18,26,\.9\)'/);
  assert.match(d,/'class': 'ps-person-tagbar', [^\n]*fill: fill,/);
  assert.match(d,/'class': 'ps-person-tagtxt', [^\n]*\n\s*fill: '#fff',/,'white letters on every kit');
});
test('settings panel: one label column, even groups, the hide rules keep working',()=>{
  const css=SK.css();
  // 3.087 개발 중 — 줄에 display:grid 를 걸었더니 탭 · 조건으로 숨긴 줄(display:none)까지 모두 보였다. display 는 건드리지 않는다
  assert.doesNotMatch(css,/#viewMenu>\.menurow\{[^}]*display:/,'rows keep their display (tabs and conditions hide rows with display:none)');
  assert.match(css,/#viewMenu>\.menurow>\.menulbl\{flex:0 0 64px!important;width:64px!important/,'label column');
  assert.match(css,/#viewMenu>\.menurow>\*:not\(\.menulbl\)\{flex:1 1 0!important;min-width:0!important/,'the control fills the row');
  assert.match(css,/#viewMenu \.seg>button\{flex:1 1 0!important/,'buttons share the width');
  assert.match(css,/#analysisSeg\{display:grid!important;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important\}/,'long labels → three per line');
  assert.match(css,/#viewMenu>\.menurow\.ps-tag-off\{display:none!important\}/);
  assert.match(css,/body\.fmdark #cmd-board-settings-pop/,'dark screen: a brighter chosen button');
  const ids=(css.match(/#cmd-board-settings-pop/g)||[]).length; assert.ok(ids>=5,'wins over the 4-id rules');
  assert.deepStrictEqual(SK.NAME_LBL,{namePosSeg:'위치',nameSizeSeg:'크기',nameStyleSeg:'모양',nameFontSeg:'글꼴'});
  assert.match(read('studio/board-settings-skin.js'),/pop\.contains\(vm\)/,'short names only in the desktop tab panel (the phone list has no section titles)');
  assert.match(read('sw.js'),/'\/studio\/board-settings-skin\.js'/);
});
