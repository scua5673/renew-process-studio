const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('node:vm');
const board=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
const notes=require('../studio/release-notes.js');
const cut=(re,what)=>{const m=re.exec(board);assert.ok(m,what);return m[0];};

/* 3.017 — 사용자 «아이패드 펜슬 사용할 때 더 부드럽게 움직이게 · 터치 펜을 잘 활용할 수 있게» */
test('3.017 freehand is drawn as a curve from the saved points, which stay as they are',()=>{
  const src=cut(/function _freePathD\(src\)\{[\s\S]*?\n  return d\+" L "\+f\(s\[n-1\]\.x\)\+" "\+f\(s\[n-1\]\.y\);\}/,'_freePathD');
  const c=vm.createContext({});vm.runInContext(src+'\nthis.P=_freePathD;',c);
  const zig=[];for(let i=0;i<=10;i++)zig.push({x:i*10,y:i%2?5:-5});
  const before=JSON.stringify(zig),d=c.P(zig);
  assert.equal(JSON.stringify(zig),before,'the points are not touched');
  assert.ok(d.startsWith('M 0.0 -5.0'),'starts at the first point');assert.ok(d.endsWith(' L 100.0 -5.0'),'ends at the pen tip');
  assert.equal((d.match(/ Q /g)||[]).length,9,'quadratic curves through the midpoints');
  const dense=[{x:0,y:0},{x:.5,y:.2},{x:1,y:.1},{x:1.5,y:.3},{x:30,y:0}];
  assert.equal(c.P(dense),'M 0.0 0.0 L 30.0 0.0','points closer than 2.5 units are skipped, the last one never');
  assert.equal(c.P([{x:1,y:2},{x:NaN,y:3},{x:9,y:8}]),'M 1.0 2.0 L 9.0 8.0','a broken point is dropped');
  assert.equal(c.P([]),'');
  assert.match(board,/\}else if\(d\.type==="free"\)\{const dd=_freePathD\(\(d===_draw&&_inkPred\)\?d\.pts\.concat\(_inkPred\):d\.pts\);/,'drawingEl uses it (screen, export and thumbnails alike); prediction only on the live stroke');
});

test('3.017 one pointer owns a stroke: palm, second finger and a pencil taking over',()=>{
  const src=cut(/function _inkPalm\(e\)\{[^\n]*\n/,'_inkPalm')+cut(/function _inkTakeOver\(e\)\{[\s\S]*?\n  return false;\}/,'_inkTakeOver');
  const log=[];const c=vm.createContext({Date,_draw:null,_drawPtype:'',_inkLastAt:0,_penUpAt:0,_inkAbort(){log.push('abort');c._draw=null;},endDraw(){log.push('end');c._draw=null;}});
  vm.runInContext(src+'\nthis.palm=_inkPalm;this.take=_inkTakeOver;',c);
  const set=(o)=>vm.runInContext(Object.keys(o).map(k=>k+'='+JSON.stringify(o[k])).join(';'),c);
  set({_draw:{},_drawPtype:'pen',_inkLastAt:Date.now()});
  assert.equal(c.palm({pointerType:'touch'}),true,'a touch while the pencil draws is a palm');
  assert.equal(c.palm({pointerType:'pen'}),false);
  set({_draw:null,_penUpAt:Date.now()});assert.equal(c.palm({pointerType:'touch'}),true,'just after the pencil lifts, too');
  set({_penUpAt:Date.now()-1000});assert.equal(c.palm({pointerType:'touch'}),false);
  set({_draw:{},_drawPtype:'touch',_inkLastAt:Date.now()});
  assert.equal(c.take({pointerType:'touch'}),false,'a second finger does not take a finger stroke');
  assert.equal(c.take({pointerType:'pen'}),true);assert.deepEqual(log,['abort'],'the pencil drops the finger stroke');
  set({_draw:{},_drawPtype:'touch',_inkLastAt:Date.now()-5000});
  assert.equal(c.take({pointerType:'touch'}),true);assert.deepEqual(log,['abort','end'],'a stroke with a lost pointerup is finished, not stuck');
  set({_draw:{},_drawPtype:'mouse',_inkLastAt:Date.now()});
  assert.equal(c.take({pointerType:'mouse'}),true);assert.equal(log[2],'end');
});

test('3.017 the drawing layer and tokens hand points through the pointer that owns the stroke',()=>{
  assert.match(board,/if\(!_draw\)return;_inkMove\(e\);\}\);/,'drawing layer moves');
  assert.match(board,/const end=e=>\{if\(!_draw\|\|e\.pointerId!==_drawPid\)return;/,'only the owner ends it');
  assert.match(board,/if\(_inkFingerOnly\(e\)\)\{e\.stopPropagation\(\);if\(!_inkHintShown\)\{_inkHintShown=true;toast\("펜슬로 그려요 · 손가락으로는 선수를 옮깁니다"\);\}return;\}/);
  assert.match(board,/const _isDrawStart=\(kind!=="ball"&&!selected&&isDraw\(\)&&!_inkFingerOnly\(e\)\);/,'a finger moves a player once the pencil is in use');
  assert.match(board,/if\(mode==="draw"\)\{_inkMove\(e\);\}/,'drawing started on a token');
  assert.match(board,/if\(_pid!=null&&e\.pointerId!==_pid\)return;/,'another finger does not drive a dragged token');
  assert.match(board,/else if\(e\.pointerId===_drawPid\)\{endDraw\(\);\}/);
  const mv=cut(/function moveDraw\(u\)\{[\s\S]*?_inkSchedule\(\);\}/,'moveDraw');
  assert.doesNotMatch(mv,/drawingEl|replaceChild/,'no rebuild per pointermove — once per frame in _inkFlush');
  assert.match(board,/function _inkEvents\(e\)\{let l=null;try\{l=e\.getCoalescedEvents\?e\.getCoalescedEvents\(\):null;\}catch\(_\)\{l=null;\}return \(l&&l\.length\)\?l:\[e\];\}/,'coalesced points, the event itself when the list is empty');
  assert.match(board,/_inkHoverEl=el\("g",\{"class":"draw-handle",id:"penHover"\}\)/,'the hover ring is a .draw-handle, so exports and thumbnails drop it');
});

test('3.017 release note explains the pencil changes in plain words',()=>{
  const e=notes.entries()[0];
  assert.equal(e.id,'2026-10-14-v3-017-pencil');
  assert.ok(e.changes.some(c=>/손바닥/.test(c))&&e.changes.some(c=>/손가락으로 선수를 옮길/.test(c))&&e.changes.some(c=>/둥근 곡선/.test(c))&&e.changes.some(c=>/호버/.test(c)));
});
