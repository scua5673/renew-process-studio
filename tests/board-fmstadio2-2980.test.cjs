const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.980 — FMStadio 새 기능 대조(잔상·시선·화살표와 다각형·맨 앞으로·다중 선택).
   뼈대는 2.679~2.902 에 있었다. 이 판이 메운 빈 곳:
   잔상이 영상·GIF·미팅 발표에 안 나오던 것 · 잔상·시선이 한 장면에만 남던 것 · 공이 섞인 다중 선택 ·
   열린 화살·양쪽 · 다각형 도구 · «맨 앞»이 장면마다 따로던 것(그리고 깊이 값 z 가 생긴 판에서 ⌘] 가 먹지 않던 것). */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }

/* ── 맨 앞으로 ── */
function zCtx(){ const c=vm.createContext({Map,Number,Object,Array}); vm.runInContext(cut('function _zPick(','function zOrderItems(')+';this._zOrderTokens=_zOrderTokens;',c); return c; }
const order=sn=>{ const all=[]; sn.players.forEach(o=>all.push(o)); sn.equipment.forEach(o=>all.push(o)); if(sn.ball)all.push(Object.assign({id:'ball'},sn.ball));
  return all.map((o,i)=>({o,i,z:Number.isFinite(+o.z)?+o.z:1e9})).sort((a,b)=>(a.z-b.z)||(a.i-b.i)).map(q=>q.o.id).join('>'); };

test('bring to front renumbers depth from the order that is drawn now — a scene snapshot is replaced by copies',()=>{
  const c=zCtx();
  const p1={id:1,x:0,y:0},p2={id:2,x:0,y:0},cone={id:9,team:'cone',x:0,y:0},ball={x:0,y:0};
  const sn={players:[p1,p2],equipment:[cone],ball};
  assert.equal(order(sn),'1>2>9>ball');
  assert.equal(c._zOrderTokens(sn,{players:{1:1},equipment:{},ball:false},true,false),true);
  assert.equal(order(sn),'2>9>ball>1','the picked player ends up above everything, the rest keep their order');
  assert.equal(p1.z,undefined,'the original token object is untouched (undo records share it)');
  assert.notEqual(sn.players[0],p1,'the snapshot holds a copy');
  assert.equal(c._zOrderTokens(sn,{players:{1:1},equipment:{},ball:false},true,false),false,'already in front → nothing to do');
});

test('a board that already has depth values (the overlap picker wrote them) obeys them — array order alone would do nothing',()=>{
  const c=zCtx();
  const sn={players:[{id:1,z:2},{id:2,z:0},{id:3,z:1}],equipment:[],ball:null};
  assert.equal(order(sn),'2>3>1');
  c._zOrderTokens(sn,{players:{2:1},equipment:{},ball:false},true,false);
  assert.equal(order(sn),'3>1>2');
  c._zOrderTokens(sn,{players:{1:1,2:1},equipment:{},ball:false},false,false);
  assert.equal(order(sn),'1>2>3','send to back keeps the picked ones in their relative order');
});

test('the live board is changed in place (the selection points at those objects) and scenes without the token are skipped',()=>{
  const c=zCtx();
  const p1={id:1},p2={id:2},live={players:[p1,p2],equipment:[],ball:{x:1,y:1}};
  assert.equal(c._zOrderTokens(live,{players:{1:1},equipment:{},ball:false},true,true),true);
  assert.equal(live.players[0],p1,'same objects');assert.equal(order(live),'2>ball>1');
  assert.equal(c._zOrderTokens({players:[{id:7}],equipment:[]},{players:{1:1},equipment:{},ball:false},true,false),false);
  assert.equal(c._zOrderTokens(live,{players:{},equipment:{},ball:true},false,true),true,'the ball can be moved too');
  assert.equal(order(live),'ball>2>1');
});

test('one function serves ⌘] ⌘[, the panel button and the overlap picker, and reaches every scene and page',()=>{
  assert.match(src,/if\(e\.key==="\]"\|\|e\.key==="\["\)\{[^\n]*\n\s*if\(zOrderSel\(e\.key==="\]"\)\)e\.preventDefault\(\); return; \}/,'keyboard');
  assert.match(src,/\$\("frontSelBtn"\)\.onclick=function\(e\)\{ e\.stopPropagation\(\); zOrderSel\(true\);/,'panel button');
  assert.match(src,/function moveTokenLayer\(o,mode\)\{\n\s*if\(mode==="front"\|\|mode==="back"\)\{ if\(zOrderItems\(\[o\],mode==="front"\)\)/,'overlap picker front/back');
  const body=cut('function zOrderItems(','function zOrderSel(');
  assert.match(body,/anim\.frames\.forEach\(function\(f,k\)\{[^\n]*var c=Object\.assign\(\{\},f\.snap\); if\(_zOrderTokens\(c,ids,front,false\)\)\{ f\.snap=c;/,'scenes of this page: copy-on-write');
  assert.match(body,/__psPages\.eachOther\(/,'other pages');
  assert.match(body,/pushUndo\(\);/);
  assert.match(src,/id="frontSelBtn" class="dup-sel"[^>]*style="display:none"/,'the button exists, hidden until something is selected');
  assert.equal(src.split('#shaperBtn,#ballLookBtn,#mirHBtn,#mirVBtn,#frontSelBtn,#rotCtl,#ballStyleBtn)').length-1,3,'on the phone sheet it lives in the «⋯» row (three rules; 2.986 — «볼 보기» sits next to 쉐이퍼)');
});

/* ── 잔상·시선을 모든 장면에 ── */
function propCtx(state){ const c=vm.createContext({Object,Array,state}); vm.runInContext(cut('function _tokPropSnap(','function _tokPropAll(')+';this._tokPropSnap=_tokPropSnap;',c); return c; }

test('a trail or look-at set in one scene is copied to the same token in another scene — as copies, never in place',()=>{
  const p={id:1,trail:2,lookAt:'ball',vis:true},q={id:2},ball={x:5,y:5,trail:1};
  const state={players:[p,q],equipment:[],ball};
  const c=propCtx(state);
  const t1={id:1,x:9},t2={id:2,x:8},sn={players:[t1,t2],equipment:[],ball:{x:1,y:1},drawings:['keep']};
  const out=c._tokPropSnap(sn,[p,ball],['trail','lookAt','vis']);
  assert.ok(out&&out!==sn,'a new snapshot object');
  assert.deepEqual(JSON.parse(JSON.stringify(out.players[0])),{id:1,x:9,trail:2,lookAt:'ball',vis:true});
  assert.equal(out.players[1],t2,'untouched tokens are shared');
  assert.equal(out.ball.trail,1);assert.equal(out.ball.x,1,'the ball keeps its own place');
  assert.equal(out.drawings,sn.drawings);
  assert.equal(t1.trail,undefined,'the scene the undo stack holds is unchanged');assert.equal(sn.ball.trail,undefined);
  assert.equal(c._tokPropSnap(out,[p,ball],['trail','lookAt','vis']),null,'nothing to change → no copy');
});

test('turning it off removes the value everywhere, and a token that is not in the scene is skipped',()=>{
  const p={id:1},state={players:[p],equipment:[],ball:null};
  const c=propCtx(state);
  const sn={players:[{id:1,trail:3,lookAt:5},{id:4,trail:1}],equipment:[]};
  const out=c._tokPropSnap(sn,[p],['trail','lookAt']);
  assert.deepEqual(JSON.parse(JSON.stringify(out.players)),[{id:1},{id:4,trail:1}]);
  assert.equal(c._tokPropSnap({players:[{id:4}],equipment:[]},[p],['trail']),null);
});

test('trail, look-at off and look-at on all go through the all-scenes helper; a ball in the selection gets the trail and is the look target',()=>{
  assert.match(src,/ps\.forEach\(function\(p\)\{ if\(next\)p\.trail=next; else delete p\.trail; \}\); _tokPropAll\(ps,\["trail"\]\);/);
  assert.match(src,/ps\.forEach\(function\(p\)\{delete p\.lookAt; if\(!p\.dirFix\)p\.dirBall=1;\}\); _tokPropAll\(ps,\["lookAt","dirBall"\]\);/,'2.986 — a shaper goes back to the ball when its look-at is turned off');
  assert.match(src,/_tokPropAll\(ps\.filter\(function\(p\)\{return p\.id!==id;\}\),\["lookAt","vis","visW","visR"\]\);/);
  assert.match(src,/if\(_ballInMulti\(\)\)ps=ps\.concat\(\[state\.ball\]\);/,'trail targets include the ball of a mixed selection');
  assert.match(src,/if\(_ballInMulti\(\)\)\{ _lookPick=ps\.slice\(\); lookPickTarget\(\{id:"ball"\}\);/,'look-at goes straight to the ball');
  assert.match(src,/const _trailTs=trailTargets\(\);/,'the panel button uses the same targets');
});

/* ── 잔상이 영상·GIF·발표에도 ── */
test('trails are drawn while exporting and while stepping scenes in a presentation, and are cleared when playback ends',()=>{
  assert.match(src,/if\(!animPlaying&&!window\.__animExport&&!window\.__trailLive\)\{ if\(L\.childNodes\.length\)L\.innerHTML=""; _trail=\{\}; return; \}/,'gate');
  assert.match(src,/window\.__animExport=1; try\{trailReset\(\);window\.__animSeg=0;\}catch\(_\)\{\}/,'export starts clean');
  assert.match(src,/finally\{ window\.__animExport=0; try\{trailReset\(\);\}catch\(_\)\{\}/,'export ends clean');
  assert.match(src,/return function\(\)\{ window\.__animSeg=Math\.max\(0,i-1\); if\(k2===0&&\(i===0\|\|f\.cut\)\)\{ try\{trailReset\(\);\}catch\(_\)\{\} \}/,'MP4 hold frames know their segment; a new page starts a new trail');
  assert.match(src,/return function\(\)\{ window\.__animSeg=s; renderInterp\(a,b,easeInOut\(i2\/steps\),cv\);/,'MP4 move frames');
  assert.match(src,/window\.__animSeg=s;   \/\* 2\.980 \*\/\n\s*renderInterp\(a,bb,0,cv\);await addFrame\(/,'GIF');
  assert.match(src,/else\{ animPlaying=false;animRaf=null;animRangeEnd=-1;_animCapShow\(null\);try\{trailReset\(\);\}catch\(_\)\{\}/,'natural end of playback (2.985 — the play range is cleared with it)');
  assert.match(src,/window\.__trailLive=1;window\.__animSeg=k;/,'presentation scene step');
  assert.match(src,/function meetSceneFinish\(\)\{window\.__trailLive=0;/);
});

/* ── 끝 모양 ── */
function headCtx(){ const made=[]; const c=vm.createContext({Math,made,el:(tag,at)=>({tag,at})}); vm.runInContext(cut('function _drawHeadAt(','function drawingEl(d){')+';this._drawHeadAt=_drawHeadAt;',c); return {c,made,g:{appendChild(n){made.push(n);}}}; }

test('line ends: the filled arrow is unchanged, the open arrow is a stroked V, «none» draws nothing',()=>{
  let h=headCtx(); h.c._drawHeadAt(h.g,'arrow',{x:100,y:0},{x:0,y:0},'#fff',1);
  assert.equal(h.made.length,1);assert.equal(h.made[0].at.fill,'#fff');assert.equal(h.made[0].at.d,'M 100 0 L 85 6.6 L 85 -6.6 Z','same triangle as before 2.980');
  h=headCtx(); h.c._drawHeadAt(h.g,'open',{x:100,y:0},{x:0,y:0},'#fff',2);
  assert.equal(h.made[0].at.fill,'none');assert.equal(h.made[0].at.stroke,'#fff');assert.equal(h.made[0].at['stroke-width'],'9.0','the V follows the line width');
  assert.match(h.made[0].at.d,/^M 83 9 L 100 0 L 83 -9$/,'tip at the end point, no closing edge');
  h=headCtx(); h.c._drawHeadAt(h.g,'bar',{x:0,y:50},{x:0,y:0},'#000',1);
  assert.equal(h.made[0].tag,'line');assert.ok(Math.abs(h.made[0].at.y1-50)<1e-9&&Math.abs(h.made[0].at.y2-50)<1e-9,'the bar is square to the line');
  h=headCtx(); h.c._drawHeadAt(h.g,'dot',{x:3,y:4},{x:0,y:0},'#000',1);assert.equal(h.made[0].tag,'circle');
  h=headCtx(); h.c._drawHeadAt(h.g,'none',{x:1,y:1},{x:0,y:0},'#000',1); h.c._drawHeadAt(h.g,undefined,{x:1,y:1},{x:0,y:0},'#000',1);assert.equal(h.made.length,0);
});

test('«both ends» draws the same shape at the start, pointing away from the line (a curve uses its control point)',()=>{
  assert.match(src,/_drawHeadAt\(g,_hd,b,_tan,C,LW\);\n\s*if\(d\.head2\)_drawHeadAt\(g,_hd,a,cpt\|\|b,C,LW\);/);
  const h=headCtx(); h.c._drawHeadAt(h.g,'arrow',{x:0,y:0},{x:100,y:0},'#fff',1);
  const nums=h.made[0].at.d.match(/-?\d+(\.\d+)?/g).map(v=>Math.round(+v*10)/10);
  assert.deepEqual(nums,[0,0,15,-6.6,15,6.6],'the start head opens toward the line');
  assert.match(src,/data-v="arrow" title="화살">→<\/button><button type="button" data-v="open" title="열린 화살">＞<\/button>/,'the picker offers the open arrow');
  assert.match(src,/id="lsHead2"><button type="button" data-v="one"[^>]*>한쪽<\/button><button type="button" data-v="both"[^>]*>양쪽<\/button>/,'direction row');
  assert.match(src,/if\(both\)d\.head2=true; else delete d\.head2;/);
  assert.match(src,/head2:\(state\.drawHead2&&\/\^\(pass\|run\|dribble\|shot\|line\|dashline\)\$\/\.test\(state\.tool\)\)\|\|undefined\};/,'new lines start with the chosen default');
});

/* ── 다각형 ── */
function polyCtx(){
  const st={tool:'poly',color:'#ff0',drawLw:1,drawOp:1,drawings:[]},log={toast:[],undo:0,zone:[],auto:0,render:0};
  const node=()=>({style:{},appendChild(){},remove(){}});
  const c=vm.createContext({Math,isFinite,state:st,window:{},toast:m=>log.toast.push(m),pushUndo:()=>log.undo++,renderDrawings:()=>log.render++,autoSaveAnimFrame:()=>log.auto++,
    afterDrawZone:d=>log.zone.push(d),drawingEl:node,el:node,drawLayer:{appendChild(){}}});
  vm.runInContext(cut('let _poly=null,_polyTmp=null;','try{ window.addEventListener("keydown",function(e){   /* Enter = 다각형으로 닫기')
    +';this.polyTap=polyTap;this.polyFinish=polyFinish;this.polyCancel=polyCancel;this.building=()=>_poly?_poly.pts.length:-1;',c);
  return {c,st,log};
}

test('polygon: tapping the first point again closes it, and the finished zone is selected so its corners can be dragged',()=>{
  const {c,st,log}=polyCtx();
  c.polyTap({x:100,y:100});c.polyTap({x:300,y:100});c.polyTap({x:300,y:300});c.polyTap({x:100,y:300});
  assert.equal(c.building(),4);assert.equal(st.drawings.length,0);
  c.polyTap({x:108,y:105});   /* 처음 점에서 2m 안 */
  assert.equal(c.building(),-1);assert.equal(st.drawings.length,1);
  const d=st.drawings[0];
  assert.equal(d.type,'poly');assert.equal(d.closed,true);assert.equal(d.pts.length,4,'the closing tap adds no vertex');assert.equal(d.color,'#ff0');
  assert.equal(log.undo,1);assert.equal(log.zone[0],d,'handed to the «zone just drawn» step (move tool + select)');assert.equal(log.auto,1,'committed to the current scene');
});

test('polygon: tapping the last point again ends an open polyline and stays in the tool; a double tap adds one point only',()=>{
  const {c,st,log}=polyCtx();
  c.polyTap({x:10,y:10});c.polyTap({x:11,y:11});   /* 같은 자리 두 번 */
  assert.equal(c.building(),1);
  c.polyTap({x:200,y:10});c.polyTap({x:200,y:200});c.polyTap({x:205,y:195});
  const d=st.drawings[0];
  assert.equal(d.closed,false);assert.equal(d.pts.length,3);assert.equal(log.zone.length,0,'an open line keeps the tool for the next one');
});

test('polygon: Enter and a tool change finish what is being drawn; fewer than three points cannot be a polygon; Esc discards',()=>{
  let p=polyCtx();
  p.c.polyTap({x:0,y:0});p.c.polyTap({x:100,y:0});
  assert.equal(p.c.polyFinish(true).closed,false,'two points → a line');
  p=polyCtx();
  p.c.polyTap({x:0,y:0});p.c.polyTap({x:100,y:0});p.c.polyTap({x:50,y:90});
  const d=p.c.polyFinish(true,true);
  assert.equal(d.closed,true);assert.equal(p.log.zone.length,0,'finishing because the tool changed does not switch the tool back');
  p=polyCtx();
  p.c.polyTap({x:0,y:0});assert.equal(p.c.polyFinish(true,true),null,'one point is nothing');assert.equal(p.st.drawings.length,0);
  p.c.polyTap({x:0,y:0});p.c.polyTap({x:90,y:0});p.c.polyCancel();
  assert.equal(p.c.building(),-1);assert.equal(p.st.drawings.length,0);assert.equal(p.log.undo,0,'nothing drawn, nothing to undo');
});

test('polygon is a real tool: button, draw mode, shortcut table, hint, canvas and token taps, lasso and zone name',()=>{
  assert.match(src,/<button data-tool="poly" title="다각형 \(운동장을 차례로 눌러 구역·꺾은선 그리기\)">/);
  assert.match(src,/const DRAW_TOOLS=\["run","pass","dribble","line","dashline","link","poly","free",/);
  assert.match(src,/const TOOLS=\["move","run","pass","dribble","line","dashline","link","poly","free",/);
  assert.match(src,/link:"연결선",poly:"다각형",free:"자유선",/);
  assert.match(src,/dashline:"6",link:"",poly:"",free:"7",/,'no default key — existing shortcuts keep their numbers');
  assert.match(src,/:t==="poly"\?"운동장을 차례로 눌러 꼭짓점을 찍으세요/);
  assert.match(src,/if\(state\.tool==="poly"\)\{e\.stopPropagation\(\);if\(e\.pointerType==="mouse"&&e\.button!==0\)return;polyTap\(toUnit\(e\)\);return;\}/,'canvas tap');
  assert.match(src,/if\(state\.tool==="poly"\)\{e\.stopPropagation\(\);polyTap\(\{x:p\.x,y:p\.y\}\);return;\}/,'a token is a corner too');
  assert.match(src,/try\{if\(_poly&&t!=="poly"\)polyFinish\(true,true\);\}catch\(_\)\{\}/,'keyboard tool change');
  assert.match(src,/seg\("toolSeg","data-tool",t=>\{try\{if\(_poly&&t!=="poly"\)polyFinish\(true,true\);\}catch\(_\)\{\}/,'tool button change');
  assert.match(src,/if\(e\.key==="Enter"\)\{e\.preventDefault\(\);e\.stopImmediatePropagation\(\);polyFinish\(true\);\}\n\s*else if\(e\.key==="Escape"\)\{e\.preventDefault\(\);e\.stopImmediatePropagation\(\);polyCancel\(\);/,'Enter closes, Esc discards before the global Esc');
  assert.match(src,/\|\|\(o\.type==="poly"&&o\.closed\)\)\{   \/\* 2\.980 — 닫힌 다각형도 구역 \*\//,'lasso picks a closed polygon only when it is wholly inside');
  assert.match(src,/\|\|\(base\.type==="poly"&&base\.closed\)\)\)\?'<div class="ls-row"><span class="ls-lb">이름<\/span>/,'zone name row');
  assert.match(src,/enableEndpointDrag\(hg,d,idx\); g\.appendChild\(hg\); \}\);/,'corner handles reuse the end-point drag');
});

test('version marks agree',()=>{
  const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8'),app=fs.readFileSync(path.join(__dirname,'..','studio','app.html'),'utf8');
  const cache=/const CACHE = 'process-(\d+\.\d+)'/.exec(sw)[1],build=/window\.PS_BUILD='(\d+\.\d+)'/.exec(app)[1];
  assert.equal(cache,build);assert.ok(parseFloat(build)>=2.98);
  const notes=require('../studio/release-notes.js').entries();
  assert.ok(notes.some(e=>/v2\.980/.test(e.title)),'release note for 2.980');
});
