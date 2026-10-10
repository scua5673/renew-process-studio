const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

/* 2.986 — 사용자 «보드의 토큰 쉐이퍼 표시를 더 명확하게 · 쉐이퍼는 자동으로 모두 볼을 보게».
   쉐이퍼는 볼 쪽을 본다. 그 방향은 그릴 때 계산만 하고 토큰에 적지 않는다(열기만 해도 «변경 있음»이 뜨지 않게).
   손으로 돌리면 고정(dirFix), «볼 보기»로 되돌린다(dirBall). 옛 보드에서 손으로 돌려 둔 방향은 그대로 둔다. */
const src=fs.readFileSync(path.join(__dirname,'..','studio','board.html'),'utf8');
function cut(from,to){ const a=src.indexOf(from); assert.ok(a>0,'start marker: '+from); const b=src.indexOf(to,a+from.length); assert.ok(b>a,'end marker: '+to); return src.slice(a,b); }
function ctx(shape){
  const state={players:[],equipment:[],ball:null};
  const c=vm.createContext({Math,Object,Array,Infinity,state,tokShape:shape||'shaper',W:1110,H:740,
    isRightTeam:t=>t==='red'||t==='green'||t==='away',_tokScaleOf:p=>(p.scale||1)*0.355});
  vm.runInContext(cut('/* ══ 2.986 · 쉐이퍼는 볼을 본다 ══','/* ══ 2.986 · 쉐이퍼는 볼을 본다 — 순수 구간 끝 ══ */')
    +cut('function _shaperGeom(','function _shaperBody(')
    +cut('function _mir180Of(','(o.equipment||[]).forEach(')+'}'
    +';this.api={_shaperOn,_dirDef,_dirWantsBall,_ballFor,_dirOf,_dirFixNow,_dirLive,_shaperGeom,_mir180Of};',c);
  return {c,state,api:c.api};
}
const near=(a,b,tol=.01)=>Math.abs(((a-b)%360+540)%360-180)<=tol;

test('a shaper faces the ball — every player but the coach, in the shaper shape or with the token switch',()=>{
  const k=ctx('shaper'),A=k.api; k.state.ball={x:500,y:300};
  const p={id:1,team:'blue',x:300,y:300},up={id:2,team:'red',x:500,y:600},coach={id:3,team:'blue',coach:true,x:100,y:100};
  assert.equal(A._shaperOn(p),true); assert.equal(A._shaperOn(coach),false);
  assert.ok(near(A._dirOf(p),0)); assert.ok(near(A._dirOf(up),270),'the ball is straight above');
  k.state.ball={x:300,y:500}; assert.ok(near(A._dirOf(p),90),'it follows when the ball moves');
  assert.equal(typeof p.dir,'undefined','computed when drawn — never written into the token');
  /* 원형 모양에서는 토큰의 «쉐이퍼»를 켠 선수만 */
  const k2=ctx('circle'),B=k2.api; k2.state.ball={x:500,y:300};
  assert.equal(B._shaperOn({team:'blue'}),false); assert.equal(B._shaperOn({team:'blue',shaper:true}),true);
  assert.ok(near(B._dirOf({id:1,team:'red',x:300,y:300}),180),'not a shaper — the team default');
  assert.ok(near(B._dirOf({id:2,team:'red',x:300,y:300,shaper:true}),0));
  assert.equal(B._dirLive(),false); k2.state.players=[{shaper:true}]; assert.equal(B._dirLive(),true);
});

test('turned by hand = fixed · «볼 보기» = back on the ball · «시선» to someone else wins',()=>{
  const k=ctx('shaper'),A=k.api; k.state.ball={x:500,y:300};
  const p={id:1,team:'blue',x:300,y:300};
  A._dirFixNow(p,A._dirOf(p)+45);
  assert.deepEqual([p.dir,p.dirFix,'dirBall' in p],[45,1,false]);
  k.state.ball={x:300,y:700}; assert.ok(near(A._dirOf(p),45),'fixed: the ball moved, the body did not');
  assert.equal(A._dirWantsBall(p),false);
  delete p.dirFix; p.dirBall=1;   /* «볼 보기» */
  assert.equal(A._dirWantsBall(p),true); assert.ok(near(A._dirOf(p),90),'the stored 45° no longer counts');
  A._dirFixNow(p,-30); assert.equal(p.dir,330,'angles are kept in 0–359'); assert.equal('dirBall' in p,false);
  const look={id:2,team:'blue',x:300,y:300,lookAt:9,dir:200};
  assert.equal(A._dirWantsBall(look),false); assert.ok(near(A._dirOf(look),200),'the look-at direction (written by applyLookAt) is used as it is');
});

test('boards from before 2.986 — a direction turned by hand stays, an untouched one follows the ball',()=>{
  const k=ctx('shaper'),A=k.api; k.state.ball={x:500,y:500};
  assert.ok(near(A._dirOf({id:1,team:'blue',x:300,y:300,dir:90}),90),'non-default number without flags = turned by hand');
  assert.ok(near(A._dirOf({id:2,team:'blue',x:300,y:300,dir:0}),45),'the blue default (0) was never turned');
  assert.ok(near(A._dirOf({id:3,team:'red',x:700,y:300,dir:180}),135),'the red default (180) was never turned');
  assert.ok(near(A._dirOf({id:4,team:'red',x:700,y:300,dir:0}),0),'0 on the right-side team is a hand-turned value');
  assert.ok(near(A._dirOf({id:5,team:'blue',x:300,y:300}),45),'no direction at all');
});

test('which ball — the board ball, else the nearest equipment ball, else the team default; a ball under the feet keeps the last direction',()=>{
  const k=ctx('shaper'),A=k.api,p={id:1,team:'blue',x:300,y:300};
  k.state.equipment=[{id:9,team:'cone',x:310,y:300},{id:10,team:'ball',x:300,y:600},{id:11,team:'ball',x:900,y:300}];
  assert.equal(A._ballFor(p).id,10); assert.ok(near(A._dirOf(p),90));
  k.state.ball={x:100,y:300}; assert.ok(near(A._dirOf(p),180),'the board ball comes first');
  k.state.ball=null; k.state.equipment=[]; assert.equal(A._ballFor(p),null); assert.ok(near(A._dirOf(p),0));
  /* 볼이 토큰에 겹치면(발밑) 각도가 뜻이 없다 — 방금 보던 쪽을 유지한다 */
  const q={id:7,team:'blue',x:300,y:300}; k.state.ball={x:300,y:500}; assert.ok(near(A._dirOf(q),90));
  k.state.ball={x:301,y:301}; assert.ok(near(A._dirOf(q),90),'kept, not snapped to 45°');
  assert.ok(near(A._dirOf({id:8,team:'red',x:300,y:300}),180),'nothing seen before — the team default');
});

test('the beak is one piece with the token: base on the circle, tip at least a radius (and 10 units) beyond',()=>{
  const A=ctx().api;
  for(const s of [0.25,0.355,0.55,1,1.6]){ const g=A._shaperGeom(100,100,30,s),d=pt=>Math.hypot(pt[0]-100,pt[1]-100);
    assert.ok(Math.abs(g.R-21*s)<1e-9); assert.ok(Math.abs(d(g.pts[1])-g.R)<1e-9&&Math.abs(d(g.pts[2])-g.R)<1e-9,'base on the token circle at s='+s);
    assert.ok(d(g.pts[0])-g.R>=Math.max(g.R,10)-1e-9,'tip clears the token at s='+s+': '+(d(g.pts[0])-g.R));
    assert.ok(near(Math.atan2(g.pts[0][1]-100,g.pts[0][0]-100)*180/Math.PI,30),'the tip points along the direction'); }
  /* 2.597 의 작은 삼각형(꼭짓점 33·s, 토큰에서 떨어짐)보다 크다 */
  assert.ok(A._shaperGeom(0,0,0,0.355).tip>33*0.355*1.4);
});

test('a half turn of the pitch keeps an untouched token on the ball and turns a hand-set one with the pitch',()=>{
  const k=ctx('shaper'),A=k.api;
  const o={players:[{id:1,team:'blue',x:300,y:300,dir:0},{id:2,team:'red',x:800,y:500,dir:180},{id:3,team:'blue',x:500,y:500,dir:45},{id:4,team:'blue',x:500,y:200,dir:0,dirFix:1},{id:5,team:'blue',x:400,y:200}],equipment:[]};
  A._mir180Of(o);
  assert.deepEqual(o.players.map(p=>[p.dir,p.dirBall||0]),[[180,1],[0,1],[225,0],[180,0],[undefined,0]]);
  k.state.ball={x:500,y:300};
  assert.equal(A._dirWantsBall(o.players[0]),true,'the flipped default would otherwise read as hand-turned');
  assert.equal(A._dirWantsBall(o.players[2]),false); assert.equal(A._dirWantsBall(o.players[3]),false); assert.equal(A._dirWantsBall(o.players[4]),true);
});

test('wiring — drawing, handle, rotate buttons and the «볼 보기» button all go through the same direction',()=>{
  assert.match(src,/var deg=_dirOf\(p\), half=\(p\.visW\|\|52\)/,'the vision layer draws with the computed direction');
  assert.match(src,/deg=\(_t\.k==="dir"\)\?_dirOf\(p\):\(p\[_t\.k\]\|\|0\)/,'the handle sits where the token is looking');
  assert.match(src,/if\(_rotDrag\.k==="dir"\)\{ p\.dirFix=1; delete p\.dirBall; \}/,'dragging the handle fixes the direction');
  assert.ok(src.split('_dirFixNow(p,_dirOf(p)+deg)').length-1>=2,'↺↻ turn from where it was looking, single and multi');
  assert.match(src,/id="ballLookBtn"/); assert.match(src,/\$\("ballLookBtn"\)\.onclick=\(\)=>toggleBallLook\(\)/);
  assert.match(src,/_blb\.style\.display=_shp\.length\?"inline-flex":"none"/,'shown only for shapers');
  assert.match(src,/\|\|_dirLive\(\)\)\{renderVisionRAF\(\);\}/,'dragging the ball redraws the directions');
  assert.match(src,/const h=27,yy=_shaperOn\(p\)\?60:48;/,'the name label clears the beak');
  /* 부리 색은 팀이 아니라 운동장과의 대비 */
  const body=cut('function _shaperBody(','/* ===== 쉐이퍼·시야 방향');
  assert.match(body,/fill:light\?"#1b2434":"#ffffff"/);
  /* 폰 선택 시트의 ⋯ 줄 목록에도 들어 있다 */
  assert.equal(src.split('#visBlindBtn,#shaperBtn,#ballLookBtn,').length-1,3);
});

test('the rotate handle has its own target function — 2.982 declared a second _rotTarget and shadowed it',()=>{
  assert.equal(src.split('function _rotTarget(').length-1,1,'one _rotTarget: the pitch-orientation target');
  assert.equal(src.split('function _rotHandleTarget(').length-1,1);
  assert.equal(src.split('_rotHandleTarget()').length-1,3,'declared once, used by the handle and its pointerdown');
  const h=cut('function _renderRotHandle(){','function _rotDown(e){'); assert.match(h,/var _t=_rotHandleTarget\(\); if\(!_t\)return;/);
  /* 같은 인라인 스크립트 안에 같은 이름의 최상위 함수가 둘 있으면 나중 것이 앞 것을 조용히 덮는다 */
  const re=/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g; let m; const dups=[];
  while((m=re.exec(src))){ const seen={}; m[1].split('\n').forEach(l=>{ const x=/^function\s+([A-Za-z0-9_$]+)\s*\(/.exec(l); if(x)seen[x[1]]=(seen[x[1]]||0)+1; }); Object.keys(seen).forEach(n=>{ if(seen[n]>1)dups.push(n); }); }
  assert.deepEqual(dups,[],'duplicate top-level functions: '+dups.join());
});
