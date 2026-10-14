const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');

test('3.010 the settings tabs are grouped under section titles, rows keep their nodes',()=>{
  const plan=/var PLAN=\[([\s\S]*?)\];\n/.exec(src);assert.ok(plan,'one plan for the sections');
  for(const s of ['["view","내 설정",[presetRow]]','["view","화면",["보드 보기","카메라","경기장","광고판"]]','["view","편집",["끌기 자석"]]',
    '["pitch","운동장",["피치","밝기","연하기","잔디 줄무늬","라인","규격"]]','["pitch","범위·방향",["운동장 개수","운동장 범위","확대 쪽","운동장 방향"]]','["pitch","그리드",["전술 그리드","훈련 격자"]]'])
    assert.ok(plan[1].includes(s),s);
  assert.match(src,/"밝기":1,"연하기":1,"라인":1,"훈련 격자":1\}/,'lines and the training grid live on the pitch tab');
  assert.match(src,/viewMenu\.insertBefore\(frag,viewMenu\.firstChild\)/,'rows move inside the same parent — their handlers stay; rows not in the plan stay after');
  assert.match(src,/#cmd-board-settings-pop\[data-bs-tab="view"\] #viewMenu \.bs-sec\[data-bs-tab="pitch"\]/,'section titles hide with their tab');
});

test('3.010 hidden rows beat figma-premium «.menurow display:flex!important» (grass tone rows were always shown)',()=>{
  const C='#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop';
  assert.ok(src.includes('html body '+C+' .menurow.ps-tone-off{display:none!important}'),'grass tone rows hide off the real-grass pitch');
  assert.ok(src.includes('html body:not(.bc-tilt3d) '+C+' .menurow.ps-tilt-row{display:none!important}'),'3D rows only in 3D');
});

test('3.010 3D options: camera, stadium detail, ad text — a device setting',()=>{
  assert.match(src,/var TILT_CAM=\{low:\{ax:36,sy:1\.3\},mid:\{ax:24,sy:1\.08\},high:\{ax:12,sy:1\}\};/,'낮게 = more oblique, 보통 = 3.009, 높게 = from above');
  assert.match(src,/var TILT_PAD=\{full:\[\.15,\.11,\.05\],simple:\[[^\]]+\],grass:\[[^\]]+\]\};/,'«전체» keeps the 3.009 frame');
  assert.match(src,/scale\(var\(--tilt-k,1\),calc\(var\(--tilt-sy,1\.08\)\*var\(--tilt-k,1\)\)\) rotateX\(var\(--tilt-ax,24deg\)\)/,'one transform, defaults = 3.009');
  assert.match(src,/localStorage\.getItem\("ps_tilt3d_opts_v1"\)/);
  assert.match(src,/t3\.cam,deco,st\.getPropertyValue\("--tilt-k"\)/,'the fit key refits on a camera or stadium change (3.022: deco = tiltDecoNow(), a grid board is grass only)');
  assert.match(src,/const sig=\[wt,L,R,T,B,goals\?sp\.goal:0,turf\?1:0,deco,ad\]\.join\('\|'\);/,'the stadium picture redraws only when it changes');
  assert.match(src,/const adX=ad\.replace\(\/&\/g,'&amp;'\)\.replace\(\/<\/g,'&lt;'\)\.replace\(\/>\/g,'&gt;'\)\.replace\(\/"\/g,'&quot;'\);/,'ad text is escaped into the SVG');
  for(const id of ['tiltCamSeg','tiltDecoSeg','tiltAdInput'])assert.ok(src.includes('id="'+id+'"'),id);
  assert.match(src,/id="tiltAdInput"[^>]*maxlength="24"/);
});

test('3.010 «내 설정» keeps looks only, eight per device, never moves players',()=>{
  assert.match(src,/const LOOK_PRESET_KEY="ps_board_look_presets_v1",LOOK_PRESET_MAX=8;/);
  const save=/function lookPresetSave\(name\)\{[\s\S]*?\n\}?/.exec(src);assert.ok(save);
  assert.match(src,/var rec=\{name:name,at:Date\.now\(\),look:lookNow\(\),pitchTheme:snap\.pitchTheme\|\|"",pitchCustom:snap\.pitchCustom\|\|null\};/,'look + pitch colour, no players');
  const apply=/function lookPresetApply\(name\)\{[\s\S]*?return true; \}/.exec(src)[0];
  assert.match(apply,/ch=lookApply\(lookOf\(m\)\)/,'validated through lookOf');
  assert.ok(!/state\.players|pitchSpec|orientation/.test(apply),'a preset leaves players, spec and direction alone');
  assert.match(apply,/boardSaveLive\(\)/,'the board saves');
  assert.match(src,/armed=x\.name;draw\(\);armT=setTimeout/,'deleting takes two presses');
});
