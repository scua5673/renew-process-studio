/* 3.338 — 훈련 격자는 운동장 가운데 기준으로 칸이 딱 맞게(11인제 · 8인제 · 풋살 각각, 운동장 여럿은 카드마다) · 골대는 선 골대(목업 B안).
   고치기 전 board.html 의 격자는 늘 11인제 모서리(30,30)에서 21×20 단위였다 — 8인제 판(230,130 · 650×480)의 왼쪽 골라인 230 은 격자선이 아니다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const TG=require('../studio/board-train-grid.js');
const board=R('studio/board.html'),mp=R('studio/board-multipitch.js'),sw=R('sw.js'),edit=R('studio/board-training-edit.js');
const SPECS=vm.runInNewContext('('+board.match(/const PITCH_SPECS=(\{[\s\S]*?\n\});/)[1]+')');
const near=(a,b)=>Math.abs(a-b)<1e-6;
const onGrid=(v,o,s)=>{const k=(v-o)/s;return Math.abs(k-Math.round(k))<1e-6;};

test('짝수 칸 · 칸 크기 — 11인제 50×34 = 2.1×2.0m 그대로, 8인제 30×24, 풋살 20×10',()=>{
  const cases=[['fifa',50,34,2.1,2.0],['u12',30,24,65/30,2.0],['futsal',20,10,2.0,2.0]];
  for(const [k,nL,nW,mL,mW] of cases){
    const sp=SPECS[k],l=TG.lattice({x:0,y:0,w:sp.len*10,h:sp.wid*10,dir:'h'},sp,'def');
    assert.deepEqual([l.nx,l.ny],[nL,nW],k);assert.ok(near(l.mL,mL)&&near(l.mW,mW),k+' '+l.mL+'×'+l.mW);
    assert.ok(near(l.sx*l.nx,sp.len*10)&&near(l.sy*l.ny,sp.wid*10),k+' 칸이 운동장에 딱 맞는다');
    assert.equal(l.nx%2,0);assert.equal(l.ny%2,0);
  }
  assert.equal(TG.even(105,3),36,"35 칸은 가운데가 칸 한가운데라 짝수로(같은 거리면 큰 쪽)");assert.equal(TG.even(68,5),14);assert.equal(TG.even(10,40),2,'칸은 둘보다 적지 않다');
  assert.deepEqual(TG.gaps('def'),[2.1,2.0]);assert.deepEqual(TG.gaps('3'),[3,3]);assert.deepEqual(TG.gaps('x'),[2.1,2.0]);
});

test('운동장 하나 — 네 변 · 하프라인 · 센터 점이 격자선 위(8인제는 고치기 전 어긋났다)',()=>{
  for(const k of ['fifa','u12','futsal']){
    const sp=SPECS[k],W=1110,H=740,PW=sp.len*10,PH=sp.wid*10,L=W/2-PW/2,T=H/2-PH/2;
    const p=TG.plan({pitch:'train',spec:sp,pr:{L,T,PW,PH,CX:W/2,CY:H/2},gap:'def',multi:false});
    assert.equal(p.multi,false);const c=p.cards[0];
    for(const x of [L,L+PW,W/2])assert.ok(onGrid(x,c.x0,c.sx),k+' x '+x);
    for(const y of [T,T+PH,H/2])assert.ok(onGrid(y,c.y0,c.sy),k+' y '+y);
    const lines=TG.lines(c,1000),xs=lines.filter(a=>a[0]===a[2]).map(a=>a[0]),ys=lines.filter(a=>a[1]===a[3]).map(a=>a[1]);
    assert.ok([L,L+PW,W/2].every(x=>xs.some(v=>near(v,x))),k+' 세로선이 골라인 · 하프라인에');
    assert.ok([T,T+PH,H/2].every(y=>ys.some(v=>near(v,y))),k+' 가로선이 터치라인 · 센터에');
    assert.ok(Math.min(...xs)<L-900&&Math.max(...xs)>L+PW+900,k+' 운동장 하나는 판 밖 여백까지 같은 위상으로');
    const s=TG.spec(p);assert.deepEqual(Object.keys(s).sort(),['sx','sy','x0','y0'],'자석 모양은 예전 그대로({x0,y0,sx,sy})');
  }
  /* 고치기 전 격자(11인제 모서리 30,30 에서 21×20)로는 8인제 골라인이 칸 가운데 */
  const u=SPECS.u12;assert.ok(!onGrid(555-u.len*5,30,21),'옛 격자는 8인제 왼쪽 골라인에서 어긋난다');
});

test('운동장 여럿 — 카드마다 · 긴 변 = 길이(dir 이 있으면 그것) · 카드 안에만',()=>{
  const sp=SPECS.fifa,rects=[{x:14,y:107.5,w:340,h:525},{x:385,y:107.5,w:340,h:525},{x:756,y:107.5,w:340,h:525}];
  const p=TG.plan({pitch:'train',spec:sp,pr:{L:30,T:30,PW:1050,PH:680},gap:'def',multi:true,rects});
  assert.equal(p.multi,true);assert.equal(p.cards.length,3);
  for(const [i,c] of p.cards.entries()){const r=rects[i];
    assert.deepEqual([c.nx,c.ny],[34,50],'세로 카드: 가로 = 너비 34칸, 세로 = 길이 50칸');
    for(const x of [r.x,r.x+r.w,r.x+r.w/2])assert.ok(onGrid(x,c.x0,c.sx));
    for(const y of [r.y,r.y+r.h,r.y+r.h/2])assert.ok(onGrid(y,c.y0,c.sy));
    const ls=TG.lines(c,0);assert.ok(ls.every(a=>a[0]>=r.x-1e-6&&a[2]<=r.x+r.w+1e-6&&a[1]>=r.y-1e-6&&a[3]<=r.y+r.h+1e-6),'카드 밖으로 안 나간다');
  }
  /* 가로로 눕힌 카드(다른 세션의 배치 — dir 'h') · dir 이 없으면 긴 변 */
  const h=TG.lattice({x:0,y:0,w:525,h:340,dir:'h'},sp,'def');assert.deepEqual([h.nx,h.ny],[50,34]);
  const g=TG.lattice({x:0,y:0,w:525,h:340},sp,'def');assert.deepEqual([g.nx,g.ny],[50,34]);
  const s=TG.spec(p);assert.equal(s.cards.length,3);assert.equal(s.x0,14,'맨 위 칸은 첫 카드(옛 자석 길도 그대로 돈다)');
  assert.equal(TG.pick(s,{x:400,y:300}).rect[0],385,'둘째 카드 안');
  assert.equal(TG.pick(s,{x:1300,y:300}).rect[0],756,'카드 밖이면 가장 가까운 카드');
  assert.equal(TG.pick({x0:1,y0:2,sx:3,sy:4},{x:9,y:9}).x0,1,'카드 없는 칸은 그대로');
});

test('그리지 않는 판 — 훈련 바탕이 아니거나 그리드 판(blank)은 board.html 그대로',()=>{
  const sp=SPECS.fifa,pr={L:30,T:30,PW:1050,PH:680};
  assert.equal(TG.plan({pitch:'',spec:sp,pr,gap:'def'}),null);
  assert.equal(TG.plan({pitch:'train',spec:Object.assign({},sp,{blank:true,m:20}),pr,gap:'def'}),null);
  assert.equal(TG.plan({pitch:'train',spec:sp,pr:null,gap:'def'}),null);
});

test('배선 — board.html 한 줄 · sw.js · 편집기 자석이 놓는 자리의 카드 칸으로',()=>{
  assert.match(board,/<script src="board-flat-turf\.js"><\/script><script src="board-train-grid\.js"><\/script>/);
  assert.match(sw,/'\/studio\/board-train-grid\.js'/);
  assert.match(edit,/function grid\(u\)\{[\s\S]{0,400}win\.PSTrainGrid\.pick\(g,u\)/);
  assert.match(edit,/api\.snapEditPoint=function\(u,e\)\{var g=grid\(u\);/);
  assert.match(edit,/return snapPoint\(u,grid\(u\),others,/);
  assert.match(edit,/api\.snapEnabled\(pointEvent\)\?grid\(u\):null;/);
});

/* 골대 */
function E(tag,attrs){return {tag,attrs,children:[],appendChild(n){this.children.push(n);}};}
function goalCtx(over){
  const src=mp.slice(mp.indexOf('        function goalShape('),mp.indexOf('        // Each measurement'));
  const g=E('g',{}),c=vm.createContext(Object.assign({E,_lc:'#8b95a3',x0:100,w:340,showGoals:true,goalDepthCap:Infinity,g},over||{}));
  vm.runInContext(src,c);return {c,g};
}
test('선 골대(B안) — 둥근 ㄷ 자 한 줄 · 망 무늬 없음 · 입구 선은 3D 가 읽는 자리 그대로',()=>{
  assert.doesNotMatch(mp,/ps-mp-goal-net|_goalMesh|patternUnits/,'카드 골대 마름모 망을 걷었다');
  assert.doesNotMatch(board,/psGoalNet|goalMesh/,'운동장 하나 골대 마름모 망을 걷었다');
  const {c,g}=goalCtx();c.goalShape(50,-1,36.6,10);   /* 위쪽 골대(카드 위 골라인 y 50) */
  const gg=g.children[0];assert.equal(gg.attrs.class,'ps-pitch-goal');assert.equal(gg.attrs['data-side'],'top');
  const kinds=gg.children.map(n=>n.attrs.class);assert.deepEqual(kinds,['ps-pitch-goal-bed','ps-pitch-goal-frame','ps-pitch-goal-mouth']);
  const fr=gg.children[1].attrs.d,n=fr.match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.match(fr,/Q/);assert.equal(n[1],50);assert.equal(n[n.length-1],50,'두 기둥 끝은 골라인 위');assert.ok(Math.min(...n.filter((v,i)=>i%2))<50,'그물은 바깥(위)으로');
  const m=gg.children[2].attrs;assert.deepEqual([m.y1,m.y2],[50,50]);assert.ok(near(m.x2-m.x1,36.6)&&near((m.x1+m.x2)/2,270),'입구 = 골대 너비 · 카드 가운데');
  assert.equal(gg.attrs['data-goal-depth'],12.5);
  /* 가로로 눕힌 카드(axis 'h') — 입구가 세로 · data-side left/right */
  const h=goalCtx();h.c.goalShape(400,1,36.6,10,'h',300);const hg=h.g.children[0],hm=hg.children[2].attrs;
  assert.equal(hg.attrs['data-side'],'right');assert.deepEqual([hm.x1,hm.x2],[400,400]);assert.ok(near((hm.y1+hm.y2)/2,300));
  const hn=hg.children[1].attrs.d.match(/-?\d+(?:\.\d+)?/g).map(Number);assert.ok(Math.max(...hn.filter((v,i)=>i%2===0))>400,'그물은 바깥(오른쪽)으로');
  /* 골대 없는 카드 · 깊이 제한(두 줄 배치) */
  const off=goalCtx({showGoals:false});off.c.goalShape(50,-1,36.6,10);assert.equal(off.g.children.length,0);
  const cap=goalCtx({goalDepthCap:8});cap.c.goalShape(50,-1,36.6,10);assert.equal(cap.g.children[0].attrs['data-goal-depth'],8);
});
test('운동장 하나 골대도 같은 모양(board.html buildLines)',()=>{
  assert.match(board,/const goalU=`M \$\{base\} \$\{gy\} L \$\{backX-out\*gr\} \$\{gy\} Q /);
  assert.match(board,/class:"pitch-goal-bed",d:goalU\+" Z",fill:PLN,opacity:"\.12"/);
  assert.match(board,/class:"pitch-goal-frame",d:goalU,fill:"none",stroke:PLN,"stroke-width":3\*LSF/);
  assert.match(board,/el\("g",\{class:"pitch-goal","data-side":side<0\?"left":"right","data-goal-depth":depth\}\)/,'3D · 세로 판 시험이 읽는 이름 그대로');
});
