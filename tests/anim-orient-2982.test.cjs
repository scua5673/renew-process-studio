const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.982 — 운동장 방향(가로·세로·90° 회전)은 한 애니메이션의 모든 장면이 함께 쓴다.
   전에는 회전이 «지금 보는 장면» 스냅 하나만 바꿨다: 다른 장면을 누르면 가로로 돌아갔고,
   좌표를 뒤집는 180° 는 한 장면만 뒤집혀 재생 때 선수들이 운동장을 가로질렀다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const W=1110,H=740;
const clone=o=>JSON.parse(JSON.stringify(o));

function ctx(opts){ opts=opts||{};
  const log={undo:0,stop:0,toast:[],saved:0};
  const state={orientation:'h',spFlip:false,halfSide:'L',players:[],equipment:[],drawings:[],ball:null,press:null,spMarks:null};
  const c=vm.createContext({Object,Array,JSON,Number,Math,W,H,state,log,
    dc:clone,normPitchView:v=>(v==='q1'||v==='half'||v==='q3')?v:'full',PITCH_SPECS:{fifa:{},u12:{},futsal:{}},captureSnap:()=>clone(state),renderAnimFrames:()=>{},window:{},document:{body:{classList:{contains:k=>!!(opts.cls&&opts.cls[k])}}},
    anim:{frames:[]},animActive:-1,animPlaying:false,editorScenes:null,editorSceneIdx:0,
    _animLive:()=>opts.live!==false,
    pushUndo:()=>{log.undo++;},
    toast:m=>{log.toast.push(m);},
    boardSaveLive:()=>{log.saved++;}});
  vm.runInContext('function stopAnim(){ log.stop++; animPlaying=false; }\n'
    +'function autoSaveAnimFrame(){ if(_rotBound())anim.frames[animActive].snap=dc(state); }\n'
    +cut('function _mir180Of(','window.__getRotDeg=')
    +cut('window.__rotateHalf=function(){','function loadSnap(')
    +';this.api={_viewVal,_viewSnapTo,_viewScenesMatch,_viewScenesNote,_VIEW_KEYS,_rotIsMir,_rotCurvesMir,_rotSnapTo,_rotScenesMatch,_rotBound,set:function(f,a){anim.frames=f;animActive=a;},get:function(){return {frames:anim.frames,active:animActive,auto:(typeof autoOrient==="undefined"?null:autoOrient)};},play:function(v){animPlaying=v;},editor:function(s,i){editorScenes=s;editorSceneIdx=i;},editorGet:function(){return editorScenes;}};',c);
  return {c,state,log,api:c.api,win:c.window};
}
const scene=(x,extra)=>Object.assign({orientation:'h',spFlip:false,halfSide:'L',
  players:[{id:1,team:'blue',x,y:200,dir:30},{id:2,team:'red',x:x+100,y:500}],
  equipment:[{id:9,team:'cone',x:x+50,y:300,rot:90}],ball:{x:x+10,y:210},
  drawings:[{type:'pass',pts:[{x,y:200},{x:x+100,y:500}]},{type:'link',ids:[1,2],pts:[]}],
  press:null,spMarks:null},extra||{});
/* 세 장면짜리 애니메이션을 세우고, 지금 판(state)을 활성 장면과 같게 둔다 */
function setup(k,active){ k.api.set([{snap:scene(200),thumb:'<svg a/>',curves:{1:{mx:12,my:-7},ball:{mx:3,my:4,air:2}}},{snap:scene(400),thumb:'<svg b/>'},{snap:scene(600),thumb:'<svg c/>',curves:{2:{mx:-5,my:9}}}],active);
  const s=clone(k.api.get().frames[active].snap); Object.keys(s).forEach(key=>{k.state[key]=s[key];}); }
const dirs=k=>k.api.get().frames.map(f=>f.snap.orientation+(f.snap.spFlip?'F':'')+f.snap.halfSide);
const xs=k=>k.api.get().frames.map(f=>f.snap.players[0].x);

test('a snapshot is brought to the target direction as a copy — only the 180° view turns the coordinates',()=>{
  const {api}=ctx();
  const sn=scene(200),keep=clone(sn);
  assert.equal(api._rotSnapTo(sn,{orientation:'h',spFlip:false,halfSide:'L'}),null,'already there → nothing to do');
  const v=api._rotSnapTo(sn,{orientation:'v',spFlip:false,halfSide:'L'});
  assert.equal(v.mir,false);assert.equal(v.snap.orientation,'v');assert.notEqual(v.snap,sn);
  assert.deepEqual(clone(v.snap.players),keep.players,'vertical is a view: the coordinates stay');
  const r=api._rotSnapTo(sn,{orientation:'h',spFlip:false,halfSide:'R'});
  assert.equal(r.mir,true);
  assert.deepEqual([r.snap.players[0].x,r.snap.players[0].y,r.snap.players[0].dir],[W-200,H-200,210]);
  assert.deepEqual([r.snap.equipment[0].x,r.snap.equipment[0].rot],[W-250,270]);
  assert.deepEqual(clone(r.snap.ball),{x:W-210,y:H-210});
  assert.deepEqual(clone(r.snap.drawings[0].pts),[{x:W-200,y:H-200},{x:W-300,y:H-500}]);
  assert.deepEqual(clone(r.snap.drawings[1]),{type:'link',ids:[1,2],pts:[]},'a line tied to tokens follows them by id');
  assert.deepEqual(sn,keep,'the original snapshot is untouched (undo records share it)');
  const back=api._rotSnapTo(r.snap,{orientation:'v',spFlip:false,halfSide:'L'});
  assert.equal(back.mir,true,'leaving the 180° view turns the coordinates back');
  assert.deepEqual(clone(back.snap.players),keep.players);
});

test('curved paths are offsets from the midpoint — a turn flips their sign and keeps the height of a lofted ball',()=>{
  const {api}=ctx();
  const cv={1:{mx:12,my:-7},ball:{mx:3,my:4,air:2}},keep=clone(cv);
  assert.deepEqual(clone(api._rotCurvesMir(cv)),{1:{mx:-12,my:7},ball:{mx:-3,my:-4,air:2}});
  assert.deepEqual(cv,keep,'a new object — the undo record keeps the old one');
});

test('rotating the board turns every scene of the animation, and four turns bring every scene back exactly',()=>{
  const k=ctx();setup(k,1);
  const before=clone(k.api.get().frames),old=k.api.get().frames.map(f=>f.snap);
  let r=k.win.__rotateHalf();
  assert.deepEqual(dirs(k),['vFL','vFL','vFL'],'0° → 90° in all three scenes');
  assert.deepEqual(clone(r),{n:2,total:3});assert.deepEqual(k.log.toast,['장면 3개를 모두 함께 돌렸어요']);
  assert.deepEqual(xs(k),[200,400,600],'90° is a view change');
  assert.deepEqual(old.map(s=>s.orientation),['h','h','h'],'the snapshots held by the undo record are not edited in place');
  assert.equal(k.api.get().frames[0].thumb,undefined,'thumbnails of the other scenes are redrawn');
  assert.equal(k.api.get().auto,false,'a direction picked by hand switches the automatic one off');
  k.win.__rotateHalf();
  assert.deepEqual(dirs(k),['hR','hR','hR'],'180°');
  assert.deepEqual(xs(k),[W-200,W-400,W-600],'every scene is turned, so the players keep moving the same way between scenes');
  assert.deepEqual(clone(k.api.get().frames[0].curves),{1:{mx:-12,my:7},ball:{mx:-3,my:-4,air:2}});
  assert.deepEqual(clone(k.api.get().frames[2].curves),{2:{mx:5,my:-9}});
  k.win.__rotateHalf();
  assert.deepEqual(dirs(k),['vL','vL','vL'],'270°');assert.deepEqual(xs(k),[200,400,600]);
  k.win.__rotateHalf();
  assert.deepEqual(dirs(k),['hL','hL','hL']);
  const after=clone(k.api.get().frames);after.forEach(f=>{delete f.thumb;});before.forEach(f=>{delete f.thumb;});
  assert.deepEqual(after,before,'a full turn changes nothing');
  assert.equal(k.log.undo,4,'each press is one undo step');
});

test('the active scene’s curves turn with the board when the board itself was turned',()=>{
  const k=ctx();setup(k,0);
  k.win.__rotateHalf();k.win.__rotateHalf();
  assert.deepEqual(clone(k.api.get().frames[0].curves),{1:{mx:-12,my:7},ball:{mx:-3,my:-4,air:2}});
  assert.equal(k.state.players[0].x,W-200);
});

test('«세로» and «가로» set the direction of all scenes — also when only the others were out of step',()=>{
  const k=ctx();setup(k,0);
  let r=k.win.__setBoardOrient('v');
  assert.deepEqual(dirs(k),['vL','vL','vL'],'vertical = our goal at the bottom, as on the phone');
  assert.deepEqual(clone(r),{n:2,total:3});assert.deepEqual(k.log.toast,['장면 3개를 모두 세로로 맞췄어요']);
  r=k.win.__setBoardOrient('v');
  assert.deepEqual(clone(r),{n:0,total:0});assert.equal(k.log.undo,1,'nothing to do → no undo step, no message');assert.equal(k.log.toast.length,1);
  /* 예전 판이 남긴 어긋난 애니메이션: 한 장면만 가로 */
  const f=k.api.get().frames;f[2].snap=Object.assign({},f[2].snap,{orientation:'h',spFlip:false,halfSide:'L'});
  r=k.win.__setBoardOrient('v');
  assert.deepEqual(clone(r),{n:1,total:3},'the board is already vertical; the scene that was left behind follows');
  assert.deepEqual(dirs(k),['vL','vL','vL']);assert.equal(k.log.undo,2);
  r=k.win.__setBoardOrient('h');
  assert.deepEqual(dirs(k),['hL','hL','hL']);assert.equal(k.log.toast[k.log.toast.length-1],'장면 3개를 모두 가로로 맞췄어요');
  assert.deepEqual(xs(k),[200,400,600]);
});

test('going vertical from the 180° view turns the coordinates back in every scene',()=>{
  const k=ctx();setup(k,1);
  k.win.__rotateHalf();k.win.__rotateHalf();
  assert.deepEqual(xs(k),[W-200,W-400,W-600]);
  k.win.__setBoardOrient('v');
  assert.deepEqual(dirs(k),['vL','vL','vL']);assert.deepEqual(xs(k),[200,400,600]);assert.equal(k.state.players[0].x,400);
});

test('scenes that were out of step with each other end up in one direction with the right coordinates',()=>{
  const k=ctx();setup(k,0);
  const f=k.api.get().frames;
  f[1].snap=k.api._rotSnapTo(f[1].snap,{orientation:'h',spFlip:false,halfSide:'R'}).snap;   /* 한 장면만 180° 로 뒤집혀 있었다 */
  assert.deepEqual(xs(k),[200,W-400,600]);
  k.win.__setBoardOrient('v');
  assert.deepEqual(dirs(k),['vL','vL','vL']);assert.deepEqual(xs(k),[200,400,600]);
});

test('playback is stopped first, and a board that is not tied to the scene strip leaves the scenes alone',()=>{
  const k=ctx();setup(k,0);k.api.play(true);
  k.win.__rotateHalf();
  assert.equal(k.log.stop,1);assert.deepEqual(dirs(k),['vFL','vFL','vFL']);
  const off=ctx({live:false});setup(off,0);
  const r=off.win.__rotateHalf();
  assert.deepEqual(clone(r),{n:0,total:0});assert.equal(off.state.orientation,'v');
  assert.deepEqual(dirs(off),['hL','hL','hL'],'the scene strip is closed: the working board is separate from the scenes');
  assert.deepEqual(off.log.toast,[]);
  const one=ctx();one.api.set([{snap:scene(200)}],0);
  assert.deepEqual(clone(one.win.__rotateHalf()),{n:0,total:1});assert.deepEqual(one.log.toast,[],'a single scene needs no message');
});

test('old multi-scene training cards (editor scene strip) follow too',()=>{
  const k=ctx({cls:{editing:true}});
  k.api.editor([{snap:scene(100),thumb:'a'},{snap:scene(300),thumb:'b'}],0);
  const r=k.win.__setBoardOrient('v');
  assert.deepEqual(clone(r),{n:1,total:2});
  assert.equal(k.api.editorGet()[1].snap.orientation,'v');assert.equal(k.api.editorGet()[0].snap.orientation,'h','the active one is captured from the board by the editor itself');
});

/* ── 운동장 설정(범위·확대 쪽·개수·규격·피치)도 누르면 모든 장면에 ── */
test('a scene that never stored a setting counts as the default — only real differences are changed',()=>{
  const {api}=ctx();
  const old={players:[{id:1,x:1,y:1}]};   /* 옛 스냅: 범위·개수·규격 칸이 아예 없다 */
  const cur={area:'full',pitchView:'full',fieldMode:'standard',pvSide:'own',pitchN:1,pitchSpec:'fifa',pitchTheme:'',pitchCustom:null,pitchImg:null};
  assert.equal(api._viewSnapTo(old,cur,api._VIEW_KEYS.range),null);
  assert.equal(api._viewSnapTo(old,cur,api._VIEW_KEYS.count),null);
  assert.equal(api._viewSnapTo(old,cur,api._VIEW_KEYS.spec),null);
  assert.equal(api._viewSnapTo({area:'half'},cur,['pitchView']).pitchView,'full','an old «half» scene reads as the 2/4 view');
  assert.equal(api._viewSnapTo({pitchTheme:'navy',pitchCustom:null,pitchImg:null},cur,api._VIEW_KEYS.pitch),null,'navy is stored as an empty theme');
  assert.notEqual(api._viewSnapTo(old,cur,api._VIEW_KEYS.pitch),null,'a scene without a stored pitch follows whatever board is open — writing the pitch in is a change');
  const c=api._viewSnapTo(old,Object.assign({},cur,{pitchView:'q1',pvSide:'opp'}),api._VIEW_KEYS.range);
  assert.deepEqual([c.pitchView,c.pvSide,c.area,c.fieldMode],['q1','opp','full','standard']);
  assert.equal(c.players,old.players,'people are not touched');assert.notEqual(c,old,'a copy — the undo record keeps the old snapshot');
});

test('range · side · count · size · pitch go to every scene of the animation, and only those keys',()=>{
  const k=ctx();setup(k,1);
  const f=k.api.get().frames,old=f.map(x=>x.snap);
  const of=key=>k.api.get().frames.map(x=>x.snap[key]===undefined?'-':x.snap[key]);
  Object.assign(k.state,{pitchView:'half',area:'half',fieldMode:'standard',pvSide:'opp'});
  assert.deepEqual(clone(k.api._viewScenesMatch('range')),{n:2,total:3});
  assert.deepEqual(of('pitchView'),['half','half','half']);assert.deepEqual(of('pvSide'),['opp','opp','opp']);assert.deepEqual(of('area'),['half','half','half']);
  assert.deepEqual(xs(k),[200,400,600],'positions stay');
  assert.equal(old[0].pitchView,undefined,'snapshots are replaced by copies');
  assert.equal(k.api.get().frames[0].thumb,undefined);
  assert.deepEqual(clone(k.api._viewScenesMatch('range')),{n:0,total:3},'a second call has nothing to do');
  k.state.pitchN=4;
  assert.deepEqual(clone(k.api._viewScenesMatch('count')),{n:2,total:3});assert.deepEqual(of('pitchN'),[4,4,4]);
  Object.assign(k.state,{pitchSpec:'u12',pitchView:'full',area:'full'});
  assert.deepEqual(clone(k.api._viewScenesMatch('spec')),{n:2,total:3});assert.deepEqual(of('pitchSpec'),['u12','u12','u12']);assert.deepEqual(of('pitchView'),['full','full','full']);
  assert.deepEqual(of('pvSide'),['opp','opp','opp'],'size does not reset the side');
  Object.assign(k.state,{pitchTheme:'white',pitchCustom:null,pitchImg:null});
  f[0].snap=Object.assign({},f[0].snap,{pitchTheme:'grass',pitchImg:'@real'});
  assert.deepEqual(clone(k.api._viewScenesMatch('pitch')),{n:2,total:3});assert.deepEqual(of('pitchTheme'),['white','white','white']);assert.deepEqual(of('pitchImg'),[null,null,null]);
  assert.deepEqual(dirs(k),['hL','hL','hL'],'the direction is a separate matter');
  assert.equal(k.api._viewScenesNote({n:2,total:3}),' · 장면 3개 모두');assert.equal(k.api._viewScenesNote({n:0,total:3}),'');
  const off=ctx({live:false});setup(off,0);off.state.pitchN=3;
  assert.deepEqual(clone(off.api._viewScenesMatch('count')),{n:0,total:0},'a board that is not tied to the scene strip leaves the scenes alone');
});

test('the setters call it at the moment a person presses — loading a scene or switching scenes never spreads these settings',()=>{
  assert.match(src,/try\{_vr=_viewScenesMatch\("spec"\);\}catch\(_\)\{\}/);
  assert.match(src,/window\.__setPitchN=function\(n\)\{[^\n]*_viewScenesMatch\("count"\)/);
  assert.equal(src.split('_viewScenesMatch("side")').length-1,2,'both branches of the side setter');
  assert.equal(src.split('_viewScenesToast(_viewScenesMatch("range"),"운동장 범위를")').length-1,3,'range · area · field mode');
  assert.match(src,/if\(e\.isTrusted\|\|window\.__psUserClick\)\{ try\{_viewScenesToast\(_viewScenesMatch\("pitch"\),"피치를"\);\}catch\(_\)\{\} \}/,'a click made by the program (boot · restore) does not reach the scenes');
  assert.match(src,/window\.__psUserClick=1; try\{nx\.click\(\);\}finally\{window\.__psUserClick=0;\}/,'a shortcut is a person');
  assert.match(src,/if\(!_silent\)\{try\{boardSaveLive\(\);\}catch\(_\)\{\}try\{_viewScenesSoon\("pitch","피치 색을"\);\}catch\(_\)\{\}\}/,'the colour picker waits until the dragging stops');
  const load=cut('function loadSnap(','window.__psSnapTest=')+cut('function lookStampScenes(','window.__lookNow=')+cut('function selectAnimFrame(','function reorderAnimFrame(');
  assert.equal(/_viewScenesMatch|_viewSnapTo|_rotScenesMatch/.test(load),false);
});

test('board settings offer 가로 | 세로 next to the 90° turn, and a scene selection survives using them',()=>{
  assert.match(src,/rotRow\.appendChild\(make\("span",null,"menulbl","운동장 방향"\)\);/);
  assert.match(src,/var oseg=make\("div","cmdOrientSeg","seg"\);\n\s*\[\["h","가로"\],\["v","세로"\]\]\.forEach\(/);
  assert.match(src,/window\.__setBoardOrient\)window\.__setBoardOrient\(p\[0\]\);/);
  assert.match(src,/x\.classList\.toggle\("on",x\.getAttribute\("data-o"\)===oo\)/,'the segment shows the direction of the board that is open');
  assert.match(src,/"운동장 회전":1,"운동장 방향":1,/,'the row stays on the «운동장» tab');
  assert.match(src,/e\.target\.closest\("#animFrames,#animFrameMenu,#cmd-board-settings-pop,\.cmd-board-settings-wrap"\)/,'the settings panel is not «outside» for the scene selection');
  assert.match(src,/if\(id==="rotate"\)\{ var _rr=null; try\{ _rr=window\.__rotateHalf&&window\.__rotateHalf\(\);[^\n]*if\(!\(_rr&&_rr\.n\)\)toast\("운동장 회전"\); return; \}/,'the shortcut keeps the «all scenes» message');
  const body=cut('window.__rotateHalf=function(){','window.__getBoardOrient=');
  assert.ok(body.indexOf('stopAnim()')<body.indexOf('pushUndo()'),'stop first, then record the undo step');
  assert.match(body,/return _rotFinish\(mir,""\);/);
});
