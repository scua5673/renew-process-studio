const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.989 — 그리드 판(라인 없는 빈 판)과 그리드(모양 있는 테두리 구역).
   사용자 «훈련 편집기에서 론도 그리드도 · 운동장 말고 라인 없이 보드에 · 보드 안에서 수정 · 사각형뿐 아니라 다양하게(팔각형도)».
   · 화면과 좌표는 운동장과 같게 두고 «1m 가 몇 단위인가»만 바꾼다 → 바탕을 바꿔도 선수·그림이 제자리다.
   · 판 넓이를 바꿀 때만 내용을 판 가운데 기준으로 줄이고 늘린다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
const plain=o=>JSON.parse(JSON.stringify(o));
const PURE=cut('/* ══ 2.989 · 그리드 순수 함수 ══','/* ══ 2.989 · 그리드 순수 함수 끝 ══ */');
function pure(){ const c=vm.createContext({}); vm.runInContext(PURE+';this.api={GRID_SHAPES,GRID_SIDES,GRID_SPLITS,gridShapePath,gridSplitPath,_gridScaleOf,_gridScaleCurves};',c); return c.api; }
function nums(d){ return (d.match(/-?\d+(?:\.\d+)?/g)||[]).map(Number); }
function corners(d){ return d.replace(/^M /,'').replace(/ Z$/,'').split(' L ').map(p=>p.split(' ').map(Number)); }

test('every shape fills the box it is given',()=>{
  const g=pure(),box=[100,40,300,180];
  assert.deepEqual(plain(g.GRID_SHAPES.map(s=>s[0])),['rect','circle','tri','diamond','penta','hexa','octa'],'seven shapes, the octagon among them');
  for(const [shape,n] of Object.entries(plain(g.GRID_SIDES))){
    const pts=corners(g.gridShapePath(shape,...box));
    assert.equal(pts.length,n,shape+' has '+n+' corners');
    const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
    assert.deepEqual([Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],[100,40,400,220],shape+' touches all four sides of the box');
  }
  assert.equal(g.gridShapePath('rect',...box),'','a rectangle is the plain zone outline');
  assert.equal(g.gridShapePath('nope',...box),'','an unknown shape falls back to the rectangle');
});

test('the octagon sits flat, the others point up',()=>{
  const g=pure();
  const oct=corners(g.gridShapePath('octa',0,0,100,100)),top=oct.filter(p=>p[1]===0);
  assert.equal(top.length,2,'two corners on the top edge');
  assert.ok(Math.abs((top[0][0]+top[1][0])/2-50)<0.11,'centred');
  for(const s of ['tri','diamond','penta','hexa']){ const pts=corners(g.gridShapePath(s,0,0,100,100)); assert.deepEqual(pts.filter(p=>p[1]===0),[[50,0]],s+' has one corner at the top, in the middle'); }
});

test('the circle is an ellipse through the middle of each side',()=>{
  const g=pure(),d=g.gridShapePath('circle',100,40,300,180);
  assert.equal(d,'M 100 130 A 150 90 0 1 0 400 130 A 150 90 0 1 0 100 130 Z');
});

test('splitting a rectangle draws only the inner lines',()=>{
  const g=pure();
  assert.equal(g.gridSplitPath('2',0,0,120,60),'M 60 0 V 60');
  assert.equal(g.gridSplitPath('3',0,0,120,60),'M 40 0 V 60 M 80 0 V 60');
  assert.equal(g.gridSplitPath('2x2',0,0,120,60),'M 60 0 V 60 M 0 30 H 120');
  assert.equal(g.gridSplitPath('1',0,0,120,60),'');assert.equal(g.gridSplitPath(undefined,0,0,120,60),'');
});

test('changing the board width scales the places about the centre and nothing else',()=>{
  const g=pure();
  const o={players:[{id:1,x:255,y:170,scale:1.4,num:7}],equipment:[{id:9,x:855,y:570,rot:30}],ball:{x:555,y:370},
    drawings:[{type:'rectline',grid:1,pts:[{x:380,y:205},{x:730,y:555}]},{type:'text',text:'압박',size:22,w:180,pts:[{x:405,y:70}]},{type:'link',ids:[1,2]}],
    spMarks:{on:true,pts:[{x:105,y:670}]},press:{on:true,x:400}};
  g._gridScaleOf(o,2/3,555,370);
  assert.deepEqual(plain(o.players),[{id:1,x:355,y:236.7,scale:1.4,num:7}],'the token moves, its size stays');
  assert.deepEqual(plain(o.equipment),[{id:9,x:755,y:503.3,rot:30}]);
  assert.deepEqual(plain(o.ball),{x:555,y:370},'the centre does not move');
  assert.deepEqual(plain(o.drawings[0].pts),[{x:438.3,y:260},{x:671.7,y:493.3}],'a 10 m grid stays 10 m: 350 units at 35/m → 233.4 at 23.33/m');
  assert.deepEqual(plain(o.drawings[1]),{type:'text',text:'압박',size:22,w:180,pts:[{x:455,y:170}]},'text keeps its size and wrap width');
  assert.deepEqual(plain(o.drawings[2]),{type:'link',ids:[1,2]},'a link follows its tokens');
  assert.deepEqual(plain(o.spMarks.pts),[{x:255,y:570}]);
  const same=plain(o);g._gridScaleOf(o,1,555,370);g._gridScaleOf(o,0,555,370);g._gridScaleOf(null,2,0,0);
  assert.deepEqual(plain(o),same,'a ratio of 1 or a bad ratio changes nothing');
  assert.deepEqual(plain(g._gridScaleCurves({7:{mx:30,my:-12,air:2},ball:{mx:9}},2/3)),{7:{mx:20,my:-8,air:2},ball:{mx:6}},'curve offsets scale too');
});

test('one metre is ten units on a pitch and length ÷ width-in-metres on a grid board',()=>{
  const c=vm.createContext({state:{pitchSpec:'fifa'},FL:105,MPP:10,PITCH_SPECS:{fifa:{name:'11인제',len:105,wid:68},futsal:{name:'풋살',len:40,wid:20,futsal:true}}});
  vm.runInContext(cut('["20","30","45"].forEach(function(m){ PITCH_SPECS["grid"+m]','function isPosLabel()')+';this.api={pitchSpec,isBlankSpec,mppNow,_mNum};',c);
  const {isBlankSpec,mppNow,_mNum}=c.api;
  assert.deepEqual(Object.keys(c.PITCH_SPECS).filter(k=>c.PITCH_SPECS[k].blank),['grid20','grid30','grid45']);
  assert.equal(c.PITCH_SPECS.grid30.len,105,'a grid board uses the whole board, like the 11-a-side pitch');
  assert.equal(isBlankSpec(),false);assert.equal(mppNow(),10);assert.equal(_mNum(104),10,'whole metres on the pitch, as before');
  c.state.pitchSpec='futsal';assert.equal(mppNow(),10,'a smaller pitch keeps the scale — it zooms the view instead');
  for(const [k,mpp] of [['grid20',52.5],['grid30',35],['grid45',1050/45]]){ c.state.pitchSpec=k; assert.equal(isBlankSpec(),true); assert.equal(mppNow(),mpp,k); }
  c.state.pitchSpec='grid30';assert.equal(_mNum(350),10);assert.equal(_mNum(367.5),10.5,'half metres on a grid board');
  c.state.pitchSpec='grid99';assert.equal(isBlankSpec(),false,'an unknown key is the 11-a-side pitch');assert.equal(mppNow(),10);
});

test('switching the surface: lines, tokens and the remembered width',()=>{
  const log={undo:0,n:[],train:0,toast:''};
  const P={fifa:{name:'11인제',len:105,wid:68},futsal:{name:'풋살',len:40,wid:20,futsal:true}};
  for(const m of [20,30,45])P['grid'+m]=Object.assign({},P.fifa,{name:'그리드',blank:true,m});
  const c=vm.createContext({state:{pitchSpec:'fifa',tokenScale:0.36,pitchN:1,gridType:'grid15'},window:{},document:{addEventListener(){},querySelectorAll:()=>[]},PITCH_SPECS:P,
    pitchSpec(){ return P[c.state.pitchSpec]||P.fifa; },isBlankSpec(){ return !!c.pitchSpec().blank; },
    pushUndo(){ log.undo++; },tokScaleLevels:()=>[0.36,0.45,0.55,0.69,0.85,1.05,1.27],_lookFreeze(){},buildTrainGrid(){ log.train++; },buildLines(){},buildGrid(){},applyView(){},renderTokens(){},renderDrawings(){},
    _viewScenesMatch:()=>({n:0,total:0}),_viewScenesNote:()=>'',boardSaveLive(){},toast(t){ log.toast=t; }});
  c.window.__setPitchN=n=>{ log.n.push(n); c.state.pitchN=n; };
  vm.runInContext(cut('window.__setPitchSpec=function(k){','document.addEventListener("click",function(e){var b=e.target&&e.target.closest&&e.target.closest("#pitchSpecSeg'),c);
  const set=c.window.__setPitchSpec;
  set('grid30');
  assert.equal(c.state.pitchSpec,'grid30');assert.equal(c.state.tokenScale,0.85,'tokens grow to the fifth step of the size ladder');assert.equal(log.toast,'그리드 판 · 긴 쪽 30m');assert.equal(log.undo,1);assert.equal(log.train,1);
  assert.equal(c.state.gridType,'grid15','the tactical grid setting is kept for the way back');
  set('grid45');assert.equal(c.state.pitchSpec,'grid30','grid to grid is the width control’s job — it rescales the content');assert.equal(log.undo,1);
  set('fifa');
  assert.equal(c.state.pitchSpec,'fifa');assert.equal(c.state.gridM,30,'the board remembers how wide its grid was');assert.equal(c.state.tokenScale,0.36,'and the tokens return to their pitch size');
  // 코치가 그리드 판에서 크기를 손댔으면 돌아와도 그 크기 그대로
  set('grid30');c.state.tokenScale=1.05;set('fifa');assert.equal(c.state.tokenScale,1.05,'a size the coach chose is left alone');
  // 이미 큰 토큰은 키우지 않는다
  c.state.tokenScale=1.27;set('grid20');assert.equal(c.state.tokenScale,1.27);set('fifa');assert.equal(c.state.tokenScale,1.27);
  // 운동장 여러 개였으면 한 판으로
  c.state.pitchN=3;set('grid30');assert.deepEqual(log.n,[1],'a grid board is one board');
  // 풋살은 예전 그대로
  set('fifa');set('futsal');assert.equal(c.state.gridType,'off');assert.equal(log.toast,'풋살 규격 · 40×20m');
});

test('the grid board draws no pitch lines, and an older build still reads a grid as a zone',()=>{
  const lines=cut('function buildLines(){','const __SPL=pitchSpec()');
  assert.ok(lines.includes('if(isBlankSpec()){ if(__oldL)__oldL.remove(); return; }'),'buildLines leaves on a grid board');
  assert.ok(cut('function buildGrid(){','const lane=y=>').includes('const gt=isBlankSpec()?"off":(state.gridType||"lanes");'),'the tactical grid is a pitch thing');
  assert.ok(src.includes('<button data-spec="grid30"'),'the spec segment has 그리드');
  const add=cut('function gridAdd(opts){','function gridSetShape(k){');
  assert.ok(add.includes('type:"rectline",grid:1'),'a grid is an outline zone with a mark — old builds draw the rectangle');
  // 모눈은 그리드 판에서 1m
  assert.ok(cut('function buildTrainGrid(){','function buildPitch(){').includes('_bl?(_mp*((_tgm==="def")?1:(+_tgm||1)))'),'squared paper is 1 m on a grid board');
  // 판 넓이는 모든 장면을 사본으로
  const area=cut('window.__setGridArea=function(m,opts){','window.__setBoardSurface=function(kind){');
  assert.ok(area.includes('var c=Object.assign({},sn); c.players=dc(sn.players||[])')&&area.includes('f.snap=o.snap; delete f.thumb'),'scene snapshots are replaced by copies, never edited in place');
});
