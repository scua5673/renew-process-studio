const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');

test('3.010 the settings tabs are grouped under section titles, rows keep their nodes (3.036: four tabs, rows found by control id)',()=>{
  const plan=/var PLAN=\[([\s\S]*?)\];\n/.exec(src);assert.ok(plan,'one plan for the sections');
  for(const s of ['["board","내 스타일",[presetRow]]','["pitch","바탕",[blankHint,"pitchSpecSeg","pitchSeg","grassToneBSeg","grassTonePSeg","trainGridSeg","grassSeg"]]','["pitch","선·구역",["lineSeg","zonePreset"]]',
    '["pitch","범위·방향",["cmdPitchViewSeg","cmdPitchSideSeg","cmdOrientSeg","cmdPitchNSeg"]]','["look","칩",["shapeSeg","chip3dSeg","sizeGroup","realScaleSeg","labelSeg","tagSizeSeg"]]','["look","이름표",["namePosSeg","nameSizeSeg","nameStyleSeg","nameFontSeg"]]','["look","분석",["analysisSeg"]]',
    '["view","보기",["tiltSeg",editorHint]]','["view","3D 경기장",["tiltCamSeg","tiltDecoSeg","tiltAdInput","tiltMoodSeg","tiltBrandSeg"],"ps-tilt-row"]','["view","편집",["dragSnapSeg",snapHint]]','["view","새 보드",[defaultRow,defaultHint],"bs-sec-newboard"]'])
    assert.ok(plan[1].includes(s),s);
  assert.doesNotMatch(src,/var PITCH_LBL=/,'3.036 — the label-based tagging is gone; the plan tags rows');
  assert.match(src,/viewMenu\.insertBefore\(frag,viewMenu\.firstChild\)/,'rows move inside the same parent — their handlers stay; rows not in the plan stay after');
  assert.match(src,/#cmd-board-settings-pop:not\(\[data-bs-tab="pitch"\]\) #viewMenu > \[data-bs-tab="pitch"\]:not\(#_\)/,'section titles, rows and hints hide with their tab');
  assert.match(src,/#cmd-board-settings-pop:not\(\[data-bs-tab="pitch"\]\):not\(\[data-bs-tab="look"\]\) #viewMenu > \[data-bs-tab="board"\]:not\(#_\)\{display:none!important\}/,'«내 스타일» shows on both board tabs');
});

test('3.010 hidden rows beat figma-premium «.menurow display:flex!important» (grass tone rows were always shown)',()=>{
  const C='#cmd-board-settings-pop#cmd-board-settings-pop#cmd-board-settings-pop';
  assert.ok(src.includes('html body '+C+' .menurow.ps-tone-off{display:none!important}'),'grass tone rows hide off the real-grass pitch');
  assert.ok(src.includes('html body:not(.bc-tilt3d) '+C+' .menurow.ps-tilt-row,html body:not(.bc-tilt3d) '+C+' .bs-sec.ps-tilt-row{display:none!important}'),'3D rows only in 3D (3.036: the «3D 경기장» title too)');
});

test('3.010 3D options: camera, stadium detail, ad text — a device setting',()=>{
  assert.match(src,/var TILT_CAM=\{low:\{ax:36,sy:1\.3\},mid:\{ax:24,sy:1\.08\},high:\{ax:12,sy:1\}\};/,'낮게 = more oblique, 보통 = 3.009, 높게 = from above');
  assert.match(src,/var TILT_PAD=\{full:\[\.15,\.11,\.05\],simple:\[[^\]]+\],grass:\[[^\]]+\]\};/,'«전체» keeps the 3.009 frame');
  assert.match(src,/scale\(var\(--tilt-k,1\),calc\(var\(--tilt-sy,1\.08\)\*var\(--tilt-k,1\)\)\) rotateX\(var\(--tilt-ax,24deg\)\)/,'one transform, defaults = 3.009');
  assert.match(src,/localStorage\.getItem\("ps_tilt3d_opts_v1"\)/);
  assert.match(src,/t3\.cam,deco,st\.getPropertyValue\("--tilt-k"\)/,'the fit key refits on a camera or stadium change (3.027: deco = tiltDecoNow(), a grid board is grass only)');
  assert.match(src,/const sig=\[wt,L,R,T,B,goals\?sp\.goal:0,turf\?1:0,deco,ad,md\.key,brand\?1:0,tcol(?:,bleed\?1:0)?\]\.join\('\|'\);/,'the stadium picture redraws only when it changes (3.029: mood and branding too)');
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
