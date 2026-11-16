// 3.302 — 사용자 11/16 «잔상을 가늘어지는 꼬리로 · 방향 표식(작은 삼각형) 더하기 — 이거해주고»(시안 오른쪽).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../studio/board-motion-marks.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const nums=d=>d.replace(/[MLZ]/g,' ').trim().split(/\s+/).map(Number);
const pairs=d=>{const n=nums(d),o=[];for(let i=0;i<n.length;i+=2)o.push([n[i],n[i+1]]);return o;};

test('잔상 — 지나온 쪽은 뾰족하고 지금 자리는 머리 폭: 닫힌 면 하나',()=>{
  const pts=[];for(let x=0;x<=100;x+=10)pts.push({x,y:50});
  const d=M.taper(pts,12);
  assert.match(d,/^M [\d. -]+( L [\d. -]+)+ Z$/);
  const p=pairs(d),n=p.length/2;
  assert.equal(n,11,'점이 적으면 그대로');
  assert.deepEqual(p[0],[0,50]);assert.deepEqual(p[p.length-1],[0,50],'꼬리 끝은 한 점');
  assert.deepEqual(p[n-1],[100,62]);assert.deepEqual(p[n],[100,38],'머리는 반 폭 12 씩');
  assert.deepEqual(p[5],[50,56],'폭은 지나온 길이에 비례');
  // 고르지 않게 찍힌 점(빠를 때 성기고 느릴 때 촘촘)도 길이 기준
  const uneven=[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0},{x:100,y:0}],q=pairs(M.taper(uneven,10));
  assert.deepEqual(q[3],[3,0.3]);
});
test('잔상 — 점이 많으면 36개로 줄이고, 짧거나 이상한 값이면 그리지 않는다',()=>{
  const many=[];for(let i=0;i<=400;i++)many.push({x:i*0.5,y:Math.sin(i/30)*20});
  const p=pairs(M.taper(many,14));
  assert.equal(p.length,M.MAX_PTS*2);
  assert.ok(p.every(q=>Number.isFinite(q[0])&&Number.isFinite(q[1])));
  assert.equal(M.taper([{x:0,y:0},{x:1,y:0}],10),'','2 단위 미만');
  assert.equal(M.taper([{x:0,y:0}],10),'');assert.equal(M.taper(null,10),'');assert.equal(M.taper([{x:0,y:0},{x:50,y:0}],0),'');
  assert.equal(M.taper([{x:0,y:0},{x:NaN,y:1},{x:0,y:0}],10),'','쓸 수 있는 점이 한 자리뿐');
  assert.notEqual(M.taper([{x:0,y:0},{x:NaN,y:1},{x:40,y:0}],10),'');
});
test('잔상 머리 폭 — 시안의 비율: 기본 크기에서 16, 큰 토큰 17 · 아주 작은 토큰 8 로 묶고 공은 0.6배',()=>{
  assert.equal(M.head(10),16);assert.equal(M.head(21),17);assert.equal(M.head(4),8);
  assert.ok(Math.abs(M.head(10,true)-9.6)<1e-9);
});
test('방향 삼각형 — 뾰족한 쪽이 보는 방향, 테두리 밖에 선다',()=>{
  for(const [deg,r] of [[0,10],[90,10],[200,21],[335,7.5]]){
    const g=M.markGeom(100,200,deg,r),a=deg*Math.PI/180,u=[Math.cos(a),Math.sin(a)];
    const along=p=>(p[0]-100)*u[0]+(p[1]-200)*u[1],side=p=>-(p[0]-100)*u[1]+(p[1]-200)*u[0];
    assert.ok(along(g.pts[0])>along(g.pts[1])&&along(g.pts[0])>along(g.pts[2]),'꼭짓점이 가장 멀다');
    assert.ok(Math.abs(side(g.pts[0]))<1e-9,'꼭짓점은 방향 선 위');
    assert.ok(Math.abs(side(g.pts[1])+side(g.pts[2]))<1e-9,'밑변은 좌우로 같다');
    assert.ok(Math.min(along(g.pts[1]),along(g.pts[2]))>r+4,'밑변도 테두리 밖');
    assert.ok(g.s>=6.5&&g.s<=9.5);
    assert.ok(along(g.pts[0])-along(g.pts[1])>Math.abs(side(g.pts[1]))*2,'길이가 밑변보다 길다(방향이 읽힌다)');
  }
  assert.match(M.markPath(0,0,0,10),/^M [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ L [\d.-]+ [\d.-]+ Z$/);
});
test('«시야» 단추의 걸음 — 끔 → 방향 표식 → 시야 → 끔, 섞이면 앞선 쪽으로',()=>{
  assert.equal(M.step([{},{}]),'mark');
  assert.equal(M.step([{dirMark:true},{dirMark:true}]),'cone');
  assert.equal(M.step([{dirMark:true},{}]),'mark');
  assert.equal(M.step([{vis:true,dirMark:true},{vis:true}]),'off');
  assert.equal(M.step([{vis:true},{dirMark:true}]),'cone');
  assert.equal(M.step([]),'');
  // 그리는 대상: 표식만 켠 선수(시야 · 쉐이퍼 · 코치는 제외)
  assert.equal(M.marked({dirMark:true}),true);assert.equal(M.marked({dirMark:true,vis:true}),false);assert.equal(M.marked({dirMark:true,shaper:true}),false);
  assert.equal(M.marked({dirMark:true,coach:true}),false);assert.equal(M.marked({dirMark:true},true),false);assert.equal(M.marked({}),false);
});
test('방향 표식 — 이 장면부터 뒤로: 구간은 _animCarryIds 규칙에 맡기고 사본으로 고친다',()=>{
  const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
  const i=board.indexOf('function _animCarryIds('),j=board.indexOf('\nfunction ',i+10);
  const carry=new Function(board.slice(i,j)+';return _animCarryIds;')();
  const mk=(marks)=>marks.map(m=>({snap:{players:[{id:'a',x:1,y:1,...(m?{dirMark:true}:{})},{id:'b',x:2,y:2}]}}));
  const frames=mk([0,0,0,1,0]),before=frames.map(f=>f.snap),p={id:'a',dir:40};
  const last=M.flagCarry(frames,1,[p],true,{a:false},carry);
  assert.equal(last,2,'뒤에서 따로 켠 장면(4번째) 앞에서 멈춘다');
  assert.deepEqual(frames.map(f=>!!f.snap.players[0].dirMark),[false,false,true,true,false]);
  assert.equal(frames[2].snap.players[0].dir,40,'방향이 없던 장면은 지금 방향을 받는다');
  assert.notEqual(frames[2].snap,before[2],'바꾼 장면은 사본');assert.equal(before[2].players[0].dirMark,undefined,'옛 snap(되돌리기 기록)은 그대로');
  assert.equal(frames[0].snap,before[0]);assert.equal(frames[4].snap,before[4]);
  // 끄기
  const on=mk([0,1,1,1,0]);assert.equal(M.flagCarry(on,1,[{id:'a'}],false,{a:true},carry),3);
  assert.deepEqual(on.map(f=>'dirMark' in f.snap.players[0]),[false,true,false,false,false],'지금 장면(판이 주인)은 건드리지 않는다');
  // 이미 그 상태였던 토큰은 이어 가지 않는다
  const same=mk([0,1,0]);assert.equal(M.flagCarry(same,1,[{id:'a'}],true,{a:true},carry),1);assert.equal(same[2].snap.players[0].dirMark,undefined);
  assert.equal(M.flagCarry(null,0,[p],true,{},carry),0);assert.equal(M.flagCarry(frames,1,[p],true,{},null),1);
});
test('배선 — 본문은 그리기만 맡기고(없으면 예전 선), 모듈은 묶음 · 영어 사전 · 시험에 들어 있다',()=>{
  const b=read('studio/board.html'),sw=read('sw.js'),en=read('studio/i18n/en-board.js'),src=read('studio/board-motion-marks.js');
  assert.match(b,/<script src="board-motion-marks\.js"><\/script>/);
  assert.match(b,/PSMotionMarks\.taper\(keep,PSMotionMarks\.head\(21\*_tokScaleOf\(p\),p===state\.ball\)\)/);
  assert.match(b,/if\(_tp\)\{L\.appendChild\(el\("path",\{d:_tp,fill:_gridInk\(\),opacity:"\.3","class":"ps-trail"\}\)\);return;\}/);
  assert.match(b,/"stroke-width":7,"stroke-linecap":"round","stroke-linejoin":"round",opacity:"\.18"/,'모듈이 없을 때의 예전 선이 남아 있다');
  assert.match(sw,/'\/studio\/board-motion-marks\.js'/);
  for(const m of src.matchAll(/toast\('([^']*[가-힣][^']*)'\)/g))assert.ok(en.includes('"'+m[1]+'":'),'no English for: '+m[1]);
  assert.match(src,/var inner = win\.toggleVision;/);assert.match(src,/if \(next === 'mark'\) \{\s*try \{ win\.pushUndo\(\); \}/,'표식을 켜기 전에 되돌리기 기록');
  assert.match(read('tests/browser/run-critical.mjs'),/board-motion-marks-3302/);
});
