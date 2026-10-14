const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const R=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const notes=require('../studio/release-notes.js');

/* 3.020 — 사용자 «진한 네이비가 나을 것 같은데» · «추천대로»: 앱 메인색(UI 강조색)만 파랑 → 옥스퍼드 네이비 #14213D */
test('3.020 the design tokens carry the navy main colour, light and dark',()=>{
  const dv=R('studio/design-v2.css');
  for(const [k,v] of [['--ps-color-action','#14213D'],['--ps-color-action-fill','#14213D'],['--ps-color-action-fill-hover','#1D2D50'],['--ps-color-action-hover','#1D2D50'],['--ps-color-action-soft','#E9EDF5']])
    assert.ok(dv.includes('  '+k+': '+v+';'),'light '+k);
  const dark=dv.slice(dv.indexOf('body.fmdark {'),dv.indexOf('body.fmdark {')+1200);
  for(const [k,v] of [['--ps-color-action','#A9BCE6'],['--ps-color-action-fill','#34508F'],['--ps-color-action-fill-hover','#3D5C9F'],['--ps-color-action-hover','#C2D0EE'],['--ps-color-action-soft','#1B2640']])
    assert.ok(dark.includes('  '+k+': '+v+';'),'dark '+k+' — readable on dark surfaces, white text on the fill');
  assert.match(R('vendor/tokens.css'),/--c-act:#14213D/);
  assert.match(R('studio/ui-grammar.css'),/body\.fmdark\{[^}]*--accent:#7F98D0;--blue:#7F98D0;--act:#7F98D0;--cmd-blue:#7F98D0/,'dark one-value accent keeps the old brightness');
});

test('3.020 page accents follow; team colour, pens and data colours stay',()=>{
  const b=R('studio/board.html');
  assert.match(b,/--blue:#14213D;--home:#3a6df0;/,'board accent is navy, the home team colour is not');
  assert.match(b,/--blue:#7F98D0!important;--home:#6F94F5!important;/);
  assert.match(b,/ANIM_TCOLORS=\["#e23b3b","#3a6df0",/,'animation title colours');
  assert.match(b,/\["#0a84ff","파랑"\]/,'pen and photo swatches');
  assert.match(b,/const A=\{stroke:"#3a6df0",/,'snap guides on the pitch stay visible on a navy pitch');
  const s=R('studio/scout.html');
  assert.match(s,/\.mb2-pitch \.mlb-tok\.sel i\{outline:3px solid #3a6df0;/,'selection ring around (navy) team tokens stays blue');
  assert.match(s,/GRADE_COL=\{[^}]*B:"#3A6DF0"/,'grade colours');
  assert.match(R('studio/process.html'),/BSCHED=\[\['훈련','#3a6df0'\]/,'schedule kinds');
  assert.match(R('studio/note.html'),/COLORS=\['#14161A','#3a6df0','#D6453D','#1D9E75'\]/,'note pens');
  assert.match(R('studio/sync.js'),/'#3a6df0','#e0569f','#34a56f'/,'workspace avatar colours');
  assert.match(R('studio/gamemodel.html'),/--at:#3a6df0;/,'attacking-transition phase colour');
  assert.match(R('studio/figma-premium.css'),/\.cmd-stamp-token\.on\{\n    box-shadow:0 0 0 2px #fff,0 0 0 4px #3a6df0!important;/);
  assert.match(R('studio/idp.html'),/--accent:#7C4DFF/,'IDP keeps its violet accent');
});

test('3.020 restyled sheets are re-fetched and the change is announced',()=>{
  for(const f of ['studio/app.html','studio/board.html','studio/scout.html','studio/process.html','studio/community.html'])
    assert.match(R(f),/ui-grammar\.css\?v=3\.020/,f);
  assert.match(R('studio/app.html'),/\/vendor\/tokens\.css\?v=3\.020/);
  const e=notes.entries().find(x=>x.id==='2026-10-14-v3-020-navy');
  assert.ok(e,'3.020 note');
  assert.ok(e.changes.some(c=>/진한 네이비/.test(c))&&e.changes.some(c=>/다크 모드/.test(c))&&e.changes.some(c=>/팀 색 · 펜 색/.test(c)));
});
