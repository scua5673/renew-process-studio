const test=require('node:test');
const assert=require('node:assert/strict');
const edit=require('../studio/board-training-edit.js');
test('mixed alignment translates every vertex and preserves locked positions',()=>{
  const player={x:10,y:10},cone={x:50,y:30},zone={type:'rect',pts:[{x:60,y:40},{x:80,y:60}],tk:[1,2]},locked={x:1,y:99,locked:true};
  const plan=edit.alignPlan([player,cone,zone,locked],'rowY',false);
  plan.forEach(p=>edit.translate(p.o,p.dx,p.dy));
  assert.equal(player.y,30);assert.equal(cone.y,30);assert.deepEqual(zone.pts,[{x:60,y:20},{x:80,y:40}]);assert.equal(zone.tk,undefined);assert.equal(locked.y,99);
});
test('equal spacing fixes endpoints and redistributes mixed objects',()=>{
  const a={x:0,y:4},b={type:'text',pts:[{x:10,y:9}]},c={x:100,y:3};
  edit.alignPlan([c,b,a],'distX',false).forEach(p=>edit.translate(p.o,p.dx,p.dy));
  assert.deepEqual([a.x,b.pts[0].x,c.x],[0,50,100]);assert.equal(b.pts[0].y,9);
});
test('vertical pitch alignment follows screen axes',()=>{
  const a={x:0,y:2},b={x:40,y:6};edit.alignPlan([a,b],'rowY',true).forEach(p=>edit.translate(p.o,p.dx,p.dy));assert.equal(a.x,20);assert.equal(b.x,20);assert.equal(a.y,2);
});
test('no-op, too small, linked drawings and invalid modes create no edit',()=>{
  assert.deepEqual(edit.alignPlan([{x:1,y:2},{x:3,y:2}],'rowY',false),[]);
  assert.deepEqual(edit.alignPlan([{x:1,y:2},{x:3,y:4}],'distX',false),[]);
  assert.equal(edit.center({type:'link',ids:[1,2],pts:[]}),null);
  assert.deepEqual(edit.alignPlan([{x:1,y:2},{x:3,y:4}],'invalid',false),[]);
});
test('grid phase is exact and a nearby object cannot pull an item off-grid',()=>{
  const g={x0:5,y0:8,sx:20,sy:20},r=edit.snapPoint({x:33,y:43},g,[{x:26,y:47}],{x:30,y:40},7);
  assert.deepEqual(r,{x:25,y:48,gx:25,gy:48});
});
test('object snaps choose nearest target independently on both axes',()=>{
  assert.deepEqual(edit.snapPoint({x:10,y:20},null,[{x:11,y:40},{x:30,y:23}],{x:14,y:25},7),{x:11,y:23,gx:11,gy:23});
  assert.deepEqual(edit.snapPoint({x:100,y:200},null,[],null,7),{x:100,y:200,gx:null,gy:null});
});
test('locked geometry cannot be translated and nonfinite values do not corrupt data',()=>{
  const p={x:12,y:13,locked:true};assert.equal(edit.translate(p,9,9),false);assert.equal(p.x,12);
  assert.equal(edit.translate({x:1,y:2},Infinity,0),false);assert.equal(edit.center({pts:[{x:NaN,y:2}]}),null);
});
test('text defaults preserve legacy appearance; arbitrary weights and invalid angles are normalized',()=>{
  assert.deepEqual(edit.textStyle({}),{textWeight:700,textItalic:false,textAngle:0,textFont:'base'});
  assert.deepEqual(edit.textStyle({textWeight:999,textItalic:'true',textAngle:500}),{textWeight:700,textItalic:false,textAngle:180,textFont:'base'});
  assert.equal(edit.textStyle({textAngle:'NaN'}).textAngle,0);
});
test('text font identifiers are allowlisted and cannot inject a font or URL',()=>{
  for(const key of ['base','bold','round','hand','serif'])assert.equal(edit.textStyle({textFont:key}).textFont,key);
  for(const key of ['url(https://invalid)','__proto__','constructor',null,{},['hand']])assert.equal(edit.textStyle({textFont:key}).textFont,'base');
  assert.match(edit.textFamily({textFont:'hand'}),/^'PSN Gaegu',Pretendard,/);
  assert.match(edit.textFamily({}),/^Pretendard,/);
});
test('bib is a separate validated overlay; removing it preserves kit and identity',()=>{
  const p={team:'blue',num:7,color:'#123456',bib:'#FACC15'};assert.equal(edit.bibColor(p),'#facc15');delete p.bib;assert.equal(p.color,'#123456');assert.equal(p.team,'blue');
  assert.equal(edit.bibColor({bib:'url(https://invalid)'}),'');assert.equal(edit.bibColor({coach:true,bib:'#facc15'}),'');
});
test('rotated text hit testing and resize use the displayed horizontal axis',()=>{
  const d={pts:[{x:100,y:200}],textAngle:90};
  const p=edit.textPoint(d,{x:100,y:240},false,false);assert.ok(Math.abs(p.x-40)<1e-8);assert.ok(Math.abs(p.y)<1e-8);
  const v=edit.textPoint({...d,textAngle:0},{x:100,y:160},true,true);assert.ok(Math.abs(v.x-40)<1e-8);assert.ok(Math.abs(v.y)<1e-8);
});
test('diagonal distribution fixes farthest endpoints, orders projections and translates mixed geometry',()=>{
  const a={id:1,x:0,y:100},b={id:2,x:100,y:0},p={id:3,x:22,y:65},d={id:4,type:'poly',pts:[{x:60,y:15},{x:80,y:25}]},lock={x:900,y:900,locked:true};
  const input=[d,b,lock,p,a],before=structuredClone(input);
  const plan=edit.alignPlan(input,'distDiag',false,false);
  assert.deepEqual(edit.alignPlan(input,'distDiag',true,true),plan);
  plan.forEach(v=>edit.translate(v.o,v.dx,v.dy));
  assert.deepEqual(a,before[4]);assert.deepEqual(b,before[1]);assert.deepEqual(lock,before[2]);
  assert.ok(Math.abs(p.x-100/3)<1e-8);assert.ok(Math.abs(p.y-200/3)<1e-8);
  assert.ok(Math.abs(edit.center(d).x-200/3)<1e-8);assert.ok(Math.abs(edit.center(d).y-100/3)<1e-8);
  assert.deepEqual({x:d.pts[1].x-d.pts[0].x,y:d.pts[1].y-d.pts[0].y},{x:20,y:10});
});
test('diagonal ties, duplicates, horizontal and vertical cases are finite and repeatable',()=>{
  for(const points of [[[0,0],[0,0],[0,0]],[[0,0],[0,0],[100,0]],[[0,0],[0,20],[0,100]],[[0,0],[100,0],[100,100],[0,100]]]){
    const items=points.map(([x,y],id)=>({id,x,y}));
    const plan=edit.alignPlan(items,'distDiag');
    assert.deepEqual(edit.alignPlan(items.slice().reverse(),'distDiag'),plan);
    plan.forEach(v=>{assert.ok(Number.isFinite(v.dx)&&Number.isFinite(v.dy));edit.translate(v.o,v.dx,v.dy);});
    assert.deepEqual(edit.alignPlan(items,'distDiag'),[]);
  }
  assert.deepEqual(edit.alignPlan([{x:0,y:0},{x:50,y:50},{x:100,y:100,locked:true}],'distDiag'),[]);
});

test('one-shot suppression overrides permanent and explicit snapping without changing Alt duplication',()=>{
  for(const e of [{},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}]){
    assert.equal(edit.snapAllowed(e,true,true),false);
    assert.equal(edit.snapAllowed(e,false,true),false);
    assert.equal(edit.snapAllowed(e,true,false),true);
  }
  assert.equal(edit.snapAllowed({altKey:true},false,false),false);
  assert.equal(edit.snapAllowed({ctrlKey:true},false,false),true);
  assert.equal(edit.snapAllowed({},false,false),false);
});

// 3.302 — 사용자 11/16 «훈련만들기로 들어가면 자동으로 훈련격자로 해서 정렬 잘 할 수 있게끔»
test('training-editor grid snaps by default: the modifier frees one drag there and still snaps everywhere else',()=>{
  // 편집기 격자(auto) + 켬: 맨손 끌기는 붙고 ⌘/Ctrl 은 이번만 자유
  for(const e of [{},{altKey:true},{shiftKey:true},null,undefined])assert.equal(edit.moveSnap(e,true,false,true),true);
  for(const e of [{ctrlKey:true},{metaKey:true}])assert.equal(edit.moveSnap(e,true,false,true),false);
  // 편집기에서 끈 때 · 작전판 · 격자 없는 훈련은 예전 규칙(snapAllowed) 그대로
  for(const e of [{},{ctrlKey:true},{metaKey:true},{altKey:true},{shiftKey:true}])for(const enabled of [true,false])for(const temporary of [true,false]){
    assert.equal(edit.moveSnap(e,enabled,temporary,false),edit.snapAllowed(e,enabled,temporary));
    if(!enabled)assert.equal(edit.moveSnap(e,false,temporary,true),edit.snapAllowed(e,false,temporary));
  }
  // «한 번 자유 이동»은 어디서든 이긴다
  for(const e of [{},{ctrlKey:true},{metaKey:true}])assert.equal(edit.moveSnap(e,true,true,true),false);
});
test('the editor default lives in its own device key and leaves line ends and the board magnet alone',()=>{
  const fs=require('node:fs'),path=require('node:path'),read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  const src=read('studio/board-training-edit.js'),keys=require('../studio/storage-keys.js');
  assert.deepEqual({sync:keys.info('ps_edit_snap_v1').sync,home:keys.info('ps_edit_snap_v1').home,role:keys.info('ps_edit_snap_v1').role},{sync:'device',home:'ls',role:'pref'});
  // 편집기 문맥 = 편집 중 + 격자가 있을 때만, 기본 켬('0' 만 끔)
  assert.match(src,/function editCtx\(\)\{return body\.classList\.contains\('editing'\)&&!!grid\(\);\}/);
  assert.match(src,/getItem\(EDIT_SNAP\)!=='0'/);
  // 보드 설정 줄 · 배치 도구가 읽는 값은 문맥의 값, 작전판 키는 편집기 안에서 쓰지 않는다
  assert.match(src,/win\._dragSnapOn=function\(\)\{return editCtx\(\)\?editPref\(\):deviceSnap\(\);\};/);
  assert.equal((src.match(/cs_drag_snap_v1/g)||[]).length,2,'the board key is only named in the comment and the no-button fallback');
  assert.match(src,/if\(!editCtx\(\)\)\{var b=doc\.querySelector\('#dragSnapSeg \[data-ds=/,'outside the editor the board row keeps its own handler');
  // 선 끝(2.719 선수에 묶기)은 작전판 자석 · ⌘/Ctrl 에만 — 편집기 기본값이 끌어들이지 않는다
  assert.match(src,/function pointSnap\(e\)\{return snapAllowed\(e,deviceSnap\(\)&&\(!editCtx\(\)\|\|editPref\(\)\),freeOnce\);\}/);
  for(const name of ['pointGridActive','snapEditPoint'])assert.match(src,new RegExp('api\\.'+name+'=function\\([^)]*\\)\\{[^}]*pointSnap\\('));
  assert.match(src,/win\._anchorEnds=function\(d\)\{return grid\(\)&&pointSnap\(pointEvent\)\?false:anchorEnds\(d\);\};/);
  // 놓기(dropToken)도 편집기 문맥에서만 교차점으로
  assert.match(src,/editCtx\(\)&&editable\(\)&&api\.snapEnabled\(pointEvent\)\?grid\(\):null/);
  // 새 글은 영어 사전에도
  const en=read('studio/i18n/en-board.js');
  for(const m of src.matchAll(/'(훈련 (?:격자 칸에 맞춰|편집기는 격자|편집기 자석)[^']*)'/g))assert.ok(en.includes('"'+m[1]+'":'),'no English for: '+m[1]);
  assert.match(read('tests/browser/run-critical.mjs'),/training-grid-snap-3302/);
});
