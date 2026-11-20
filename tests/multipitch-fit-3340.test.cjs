/* 3.340 — 운동장 여럿 «모양 그대로»(B안): 배치 셈(PSMultiPitch.layout) · 기준 틀(base) · 판의 표식(mpFit) 배선 · 가로 카드의 잔디 띠 · 3D 골대.
   옛 판(표식 없음)은 예전 배치 그대로 — 브라우저 시험 multipitch-fit-3340 이 실제 판에서 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const M=require('../studio/board-multipitch.js');
const SPECS={fifa:{len:105,wid:68},u12:{len:65,wid:48},futsal:{len:40,wid:20}};
const near=(a,b,t)=>Math.abs(a-b)<(t||1e-6);

test('배치 — 11인제 2 · 3 세로 한 줄, 4 가로 2×2, 6 가로 3×2 · 5 · 1 은 예전 배치(null)',()=>{
  const want={2:['v',1,2],3:['v',1,3],4:['h',2,2],6:['h',2,3]};
  for(const n of [2,3,4,6]){const L=M.layout(n,SPECS.fifa),[dir,rows,cols]=want[n];
    assert.equal(L.dir,dir,'방향 '+n);assert.equal(L.cards.length,n);
    assert.equal(new Set(L.cards.map(c=>c.y.toFixed(3))).size,rows,'줄 '+n);assert.equal(new Set(L.cards.map(c=>c.x.toFixed(3))).size,cols,'칸 '+n);}
  assert.equal(M.layout(5,SPECS.fifa),null);assert.equal(M.layout(1,SPECS.fifa),null);assert.equal(M.layout(7,SPECS.fifa),null);
});

test('배치 — 실제 비율 · 16:9 틀 안 · 운동장 사이는 정한 간격 · 틀 = 카드 상자 + 여백 · 마주 보는 골대 깊이 제한',()=>{
  const F=M.FRAME;
  for(const [k,s] of Object.entries(SPECS))for(const n of [2,3,4,6]){const L=M.layout(n,s),tag=k+' '+n;
    L.cards.forEach(c=>{assert.ok(near(c.dir==='h'?c.w/c.h:c.h/c.w,s.len/s.wid,1e-9),'비율 '+tag);
      assert.ok(c.x>=F[0]-1e-6&&c.y>=F[1]-1e-6&&c.x+c.w<=F[0]+F[2]+1e-6&&c.y+c.h<=F[1]+F[3]+1e-6,'틀 안 '+tag);});
    const hz=L.dir==='h',gx=hz?26:16,gy=hz?16:26,mx=hz?18:12,my=hz?12:18;
    const xs=[...new Set(L.cards.map(c=>+c.x.toFixed(6)))].sort((a,b)=>a-b),ys=[...new Set(L.cards.map(c=>+c.y.toFixed(6)))].sort((a,b)=>a-b),c0=L.cards[0];
    for(let i=1;i<xs.length;i++)assert.ok(near(xs[i]-xs[i-1],c0.w+gx,1e-6),'가로 간격 '+tag);
    for(let i=1;i<ys.length;i++)assert.ok(near(ys[i]-ys[i-1],c0.h+gy,1e-6),'세로 간격 '+tag);
    const x0=Math.min(...L.cards.map(c=>c.x)),y0=Math.min(...L.cards.map(c=>c.y)),x1=Math.max(...L.cards.map(c=>c.x+c.w)),y1=Math.max(...L.cards.map(c=>c.y+c.h));
    assert.deepEqual(L.frame.map(v=>+v.toFixed(6)),[x0-mx,y0-my,x1-x0+2*mx,y1-y0+2*my].map(v=>+v.toFixed(6)),'틀 '+tag);
    assert.equal(L.cap,10.5,'골대 깊이 = 골라인 사이 간격의 절반 '+tag);
    /* 묶음은 틀 가운데 */
    assert.ok(near((x0+x1)/2,F[0]+F[2]/2,1e-6)&&near((y0+y1)/2,F[1]+F[3]/2,1e-6),'가운데 '+tag);
  }
  /* 4개 11인제 — 예전 세로 2×2(약 223×344)보다 훨씬 크다 */
  const c=M.layout(4,SPECS.fifa).cards[0];assert.ok(c.w*c.h>2*223*344,'4개 카드 넓이 '+c.w*c.h);
});

test('기준 틀(base) — 표식 · 전체 범위 · 운동장 바탕일 때만, 세로 판은 world 변형으로 돌린 상자',()=>{
  const world={transform:{baseVal:{consolidate:()=>null}}};
  const win=(o)=>Object.assign({__psMpFit:true,__getPitchN:()=>4,__getPitchSpec:()=>({len:105,wid:68}),__getPitchView:()=>'full',document:{getElementById:()=>world}},o||{});
  const b=[0,0,1110,740],L=M.layout(4,SPECS.fifa);
  assert.deepEqual(M.base(b,'full',win()),L.frame,'가로 판');
  assert.equal(M.base(b,'half',win()),b,'전체 범위가 아니면 그대로');
  assert.equal(M.base(b,'full',win({__psMpFit:false})),b,'표식 없음(옛 판) — 그대로');
  assert.equal(M.base(b,'full',win({__getPitchN:()=>5})),b,'5개 — 예전 배치');
  assert.equal(M.base(b,'full',win({__getPitchSpec:()=>({blank:true,len:105,wid:68})})),b,'그리드 판');
  assert.equal(M.base(b,'full',win({__getPitchView:()=>'q2'})),b,'범위 고름');
  /* 세로 판 — board.html applyView 의 matrix(0 -1 1 0 0 W): 판 = (y, W - x) */
  const v=win({document:{getElementById:()=>({transform:{baseVal:{consolidate:()=>({matrix:{a:0,b:-1,c:1,d:0,e:0,f:1110}})}}})}});
  const f=L.frame,r=M.base([0,0,740,1110],'full',v);
  [f[1],1110-f[0]-f[2],f[3],f[2]].forEach((x,i)=>assert.ok(near(r[i],x,1e-9),'세로 판 '+JSON.stringify({r,f})));
  assert.equal(M.fitLayout(null),null);assert.equal(M.fitLayout({}),null);
});

test('판의 표식 배선 — 스냅에만 · 개수를 고를 때 · 장면 · 새 페이지 · applyView 한 줄 · 3D 골대 좌 · 우',()=>{
  const b=read('studio/board.html');
  assert.ok(b.includes('<script src="board-train-grid.js"></script><script src="board-multipitch.js"></script>'),'작전판이 배치 모듈을 싣는다(기준 틀 셈)');
  assert.ok(b.includes('if(window.__psMpFit&&state.pitchN>1)__cs.mpFit=1;'),'captureSnap — 표식은 새 배치 · 여럿일 때만(옛 판 사본엔 칸이 생기지 않는다)');
  assert.ok(b.includes('state.pitchN=s.pitchN||1;window.__psMpFit=!!s.mpFit;'),'loadSnap — applyView 전에');
  assert.ok(b.indexOf('state.pitchN=s.pitchN||1;window.__psMpFit')<b.indexOf('applyView();renderTokens();renderDrawings();updateDelUI();updateAlignBar();'),'표식 다음에 applyView');
  assert.ok(b.includes('count:["pitchN","mpFit"]'),'개수를 바꾸면 장면에도');
  assert.ok(b.includes('pitchN:s.pitchN,mpFit:s.mpFit,'),'새 페이지는 지금 페이지의 배치');
  assert.match(b,/  if\(window\.PSMultiPitch\)\[bx,by,bw,bh\]=PSMultiPitch\.base\(\[bx,by,bw,bh\],a,window\);[^\n]*\n  BASEVB=\[bx,by,bw,bh\];/,'applyView — BASEVB 바로 앞');
  const sp=b.slice(b.indexOf('window.__setPitchN=function(n){'),b.indexOf('\n',b.indexOf('window.__setPitchN=function(n){')));
  assert.match(sp,/var _fit=_nn>1,_sw=_fit&&_nn!==5&&\(state\.pitchN\|\|1\)===_nn&&!window\.__psMpFit;/,'같은 개수를 다시 누른 옛 판만 알림');
  assert.match(sp,/if\(\(state\.pitchN\|\|1\)!==_nn\|\|!!window\.__psMpFit!==_fit\)\{try\{pushUndo\(\);\}catch\(_\)\{\}\}/,'되돌리기는 옛 표식을 담은 뒤');
  assert.ok(sp.indexOf('pushUndo')<sp.indexOf('window.__psMpFit=_fit;')&&sp.indexOf('window.__psMpFit=_fit;')<sp.indexOf('_viewScenesMatch("count")'),'차례 — 되돌리기 · 표식 · 장면');
  assert.match(sp,/applyView\(\);/,'기준 틀을 바로 다시');
  /* 3D 골대 두 곳 — data-side left/right 의 바깥 · 세로 입구의 높이(예전 Math.abs(x2-x) 는 0) */
  const outs=b.match(/o=s==='left'\?\[-1,0\]:s==='right'\?\[1,0\]:\[0,s==='top'\?-1:1\]/g)||[];assert.equal(outs.length,2,'tiltGoalsSync · __tiltGoalsGeo');
  assert.equal((b.match(/Math\.hypot\(x2-x,y2-y\)\*\(sp\.futsal/g)||[]).length,2,'골대 높이 = 입구 길이');
  assert.ok(!/side=g\.getAttribute\('data-side'\)==='top'\?-1:1/.test(b),'옛 위 · 아래만 아는 식은 없다');
  assert.ok(read('sw.js').includes("'/studio/board-multipitch.js'"),'sw CORE');
  assert.ok(/"운동장을 새 배치로 바꿨어요 · 선수는 그 자리 그대로 · 되돌리기로 이전 배치":"[^"]+"/.test(read('studio/i18n/en-board.js')),'영어');
});

test('가로 카드의 잔디 — 띠는 긴 변(길이) 따라 · 돌리지 않는다(3D · 평면 · 잎결 · 실사 사진 칸)',()=>{
  const G=require('../studio/board-stadium-ground.js'),F=require('../studio/board-flat-turf.js');
  const L=M.layout(4,SPECS.fifa),cards=L.cards.map(c=>[c.x,c.y,c.w,c.h]),v=[[10,20,200,309],[230,20,200,309]];
  const cb=G.cardBands(cards,105);cb.forEach((c,i)=>{assert.equal(c.hz,true);assert.ok(near(c.band,cards[i][2]/G.bands(105)),'띠 폭 = 길이 ÷ 띠 수');});
  G.cardBands(v,105).forEach((c,i)=>{assert.equal(c.hz,false);assert.ok(near(c.band,v[i][3]/G.bands(105)),'세로 카드는 예전 그대로');});
  const mp=G.mowPlan({multi:true,cards,len:105,L:0,T:0,m:10,pw:1316,ph:740,kind:'band',gap:4});
  assert.equal(mp.rot,0,'3D 잎결 — 가로 카드는 돌리지 않는다');assert.equal((mp.cards.match(/ps-mow-card/g)||[]).length,4);
  const pats=mp.defs.match(/<pattern id="psStMowC\d"[^>]*>/g)||[];assert.equal(pats.length,4);pats.forEach(p=>assert.ok(!/patternTransform/.test(p),'카드 띠 돌리지 않음 '+p));
  const mv=G.mowPlan({multi:true,cards:v,len:105,L:0,T:0,m:10,pw:430,ph:309,kind:'band',gap:4});assert.equal(mv.rot,90,'세로 카드는 예전 그대로 90°');
  assert.equal(F.plan({n:4,L:0,T:0,mpp:10,cards}).rot,0,'평면 잎결');assert.equal(F.plan({n:4,L:0,T:0,mpp:10,cards:v}).rot,90);
  assert.equal(F.turfPlan({L:0,T:0,PW:1050,len:105,cards}).base.rot,0,'실사 사진 칸');assert.equal(F.turfPlan({L:0,T:0,PW:1050,len:105,cards:v}).base.rot,90);
});
