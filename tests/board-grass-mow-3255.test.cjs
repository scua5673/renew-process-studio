'use strict';
/* 3.255 — 3D 잔디결(사용자 «잔디 결이 제대로 표현되게», 운동장 5개 3D 화면).
   여러 운동장의 깎은 줄이 경기장 전체에 x 방향 한 장이라 카드(골대가 위 · 아래)에선 줄이 터치라인과 나란했고 카드끼리 안 맞았다.
   이제 카드마다 제 골라인에서 홀수 개 띠(가운데 띠가 하프라인에 걸친다), 그 위에 깎는 방향 잎결. 운동장 하나는 예전 줄 그대로.
   실제 화면은 tests/browser/board-grass-mow-3255.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../studio/board-stadium-ground.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const attrs=(xml,tag,id)=>{const m=new RegExp('<'+tag+' id="'+id+'"([^>]*)>').exec(xml);if(!m)return null;const o={};m[1].replace(/([\w-]+)="([^"]*)"/g,(_,k,v)=>{o[k]=v;});return o;};

/* 3.332 — 기대를 일부러 고침: 띠는 «약 4m(길이를 홀수 줄로)» · 골라인에서가 아니라 결 간격(노드 기본 4m) · 하프라인이 결 경계.
   잔디 사진 칸(per)은 무늬와 따로 예전 그대로. 결 간격 시험은 tests/board-mow-gap-3332.test.cjs */
test('운동장 하나 — 하프라인에서 어두운 줄 · 밝은 줄(x 방향, 3.332 부터 정확히 4m), 사진 칸은 약 4m 한 쌍(27개 띠) 그대로, 카드 띠 없음',()=>{
  const p=G.mowPlan({multi:false,L:30,T:30,m:10,len:105,pw:1050});
  assert.equal(p.cards,'');assert.equal(p.rot,0);assert.ok(Math.abs(p.per-2*1050/27)<1e-9,'per = 사진 칸(예전 그대로)');
  assert.deepEqual(attrs(p.defs,'pattern','psStMow'),{patternUnits:'userSpaceOnUse',x:'555',y:'30',width:'80',height:'80'},'하프라인(30+525)에서 4m 한 쌍');
  assert.match(p.defs,/<rect width="40" height="80" fill="#000" fill-opacity="\.07"\/><rect x="40" width="40" height="80" fill="#fff" fill-opacity="\.06"\/>/);
  assert.ok(Math.abs(G.mowPlan({multi:false,L:230,T:130,m:10,len:65,pw:650}).per-2*650/17)<1e-9,'8인제 17개 띠');
  assert.ok(Math.abs(G.mowPlan({multi:false,L:30,T:30,m:10}).per-2*1050/27)<1e-9,'길이를 모르면 105m');
  assert.equal(G.mowPlan({multi:true,cards:[],L:0,T:0,m:10}).cards,'','카드를 못 읽으면 예전 길');
});

test('여러 운동장은 카드마다 — 카드의 하프라인(가운데)이 결 경계, 결은 그 규격의 4m(3.332)',()=>{
  for(const [len,n] of [[105,27],[65,17],[40,11]]){   /* 3.263 — 약 4m(예전 5m: 21 · 13 · 9) · 3.332 — 정확히 4m */
    const cards=[[0,0,300,450],[320,0,150,220],[320,240,150,220]];
    const p=G.mowPlan({multi:true,cards,len,L:0,T:0,m:4});
    assert.equal(p.rot,90,'잎결은 x(깎는 방향) — 띠는 y');
    assert.deepEqual(attrs(p.defs,'pattern','psStMow'),{patternUnits:'userSpaceOnUse',width:'1',height:'1'},'psStMow 는 빈 무늬(이름을 쓰는 곳은 그대로)');
    cards.forEach((r,i)=>{const a=attrs(p.defs,'pattern','psStMowC'+i),band=4*r[3]/len;
      assert.equal(+a.x,r[0]);assert.ok(Math.abs(+a.y-(r[1]+r[3]/2))<.06,'카드 하프라인에서 시작');
      assert.ok(Math.abs(+a.height-2*band)<.06,len+'m → 4m 한 쌍');assert.ok(!a.patternTransform,'카드 띠는 돌리지 않는 y 띠');
    });
    assert.equal((p.cards.match(/class="ps-mow-card"/g)||[]).length,3);
  }
});

test('카드 띠는 둘레로 조금 나가되 옆 카드와 겹치지 않는다',()=>{
  const cards=[[0,0,300,450],[310,0,150,220],[310,230,150,220]];
  const p=G.mowPlan({multi:true,cards,len:105,L:0,T:0,m:4});
  const rs=[...p.cards.matchAll(/x="([\d.-]+)" y="([\d.-]+)" width="([\d.-]+)" height="([\d.-]+)"/g)].map(m=>m.slice(1).map(Number));
  rs.forEach((a,i)=>{const c=cards[i];assert.ok(a[0]<=c[0]&&a[1]<=c[1]&&a[0]+a[2]>=c[0]+c[2]&&a[1]+a[3]>=c[1]+c[3],'카드를 다 덮는다');
    rs.forEach((b,j)=>{if(i===j)return;const over=a[0]<b[0]+b[2]-.05&&b[0]<a[0]+a[2]-.05&&a[1]<b[1]+b[3]-.05&&b[1]<a[1]+a[3]-.05;assert.ok(!over,'카드 '+i+' · '+j+' 띠가 겹치지 않는다');});});
});

test('잎결 — 캔버스가 없으면(노드) 빈 문자열, 있으면 8m 칸 · 깎는 방향으로 돌린다',()=>{
  assert.equal(G.grainTile(),'');assert.equal(G.grainDefs({m:10,L:0,T:0}),'');
  const src=read('studio/board-stadium-ground.js');
  assert.match(src,/function grainDefs\(o\)\{const src=grainTile\(\);if\(!src\)return '';const f=o\.f\|\|\(n=>Math\.round\(n\*10\)\/10\),s=f\(8\*o\.m\);/);
  assert.match(src,/\(o\.rot\?' patternTransform="rotate\('\+o\.rot\+'\)"':''\)/);
  assert.match(src,/const wrap=\(x,y,r,fn\)=>\{for\(const dx of \[0,-N,N\]\)for\(const dy of \[0,-N,N\]\)/,'가장자리를 감아 그려 이음새가 없다');
  assert.doesNotMatch(src,/createRadialGradient/,'큰 얼룩은 8m 칸마다 되풀이돼 칸이 보인다 — 넣지 않는다');
});

test('«간단 · 잔디만» 바닥 묶음에도 잎결 — 카드 띠는 묶음 밖(영상이 묶음의 사각형을 늘린다)',()=>{
  const ground={box:[-100,-100,1200,850]};
  const on=G.paint(ground,true,{},true),off=G.paint(ground,true,{});
  assert.ok(on.includes('url(#psStGrain)')&&!off.includes('url(#psStGrain)'));
  assert.ok(!on.includes('ps-mow-card'));
});

test('작전판 배선 — 카드 · 규격 · 잎결 판이 그림 서명에, 카드 띠와 잎결은 바닥 위 · 빛 아래',()=>{
  const b=read('studio/board.html');
  assert.match(b,/let cards=\[\];   \/\* 3\.255/);
  assert.match(b,/cards=rs; if\(rs\.length\)\{/);
  assert.match(b,/turf\?1:0,cards\.join\(';'\),sp\.len,PSStadiumGround\.GRAIN_V,deco,ad,md\.key,brand\?1:0,tcol,bleed\?1:0\]\.join\('\|'\);/);
  assert.match(b,/const mow=PSStadiumGround\.mowPlan\(\{multi:multi,cards:cards,len:sp\.len,L:L,T:T,m:m,pw:PW,ph:PH,f:f,kind:pk\.turf\?'':'none'\}\),grain=pk\.turf&&!!PSStadiumGround\.grainTile\(\),per=mow\.per;/,'3.326 — 폭(ph)은 바둑판 · 원 · 5레인이 쓴다');
  assert.match(b,/<pattern id="psStGrass" patternUnits="userSpaceOnUse" x="'\+f\(L\)\+'" y="'\+f\(T\)\+'" width="'\+f\(per\)\+'" height="'\+f\(per\)\+'"><image href="'\+turf\+'" width="'\+f\(per\)\+'" height="'\+f\(per\)\+'"/,'잔디 사진 칸 = 깎은 줄 한 쌍(3.263)');
  assert.doesNotMatch(b,/f\(10\*m\)/,'10m 칸은 남지 않는다');
  assert.match(b,/\+mow\.defs\+PSStadiumGround\.grainDefs\(\{m:m,L:L,T:T,f:f,rot:mow\.rot\}\)/);
  assert.match(b,/fill="url\(#psStMow\)"\/>'   \/\* 잔디결\(5m\)을 중계 화면처럼 또렷하게 \*\/\n      \+mow\.cards\+\(grain\?'<path d="'\+rr\(0\)\+'" fill="url\(#psStGrain\)"\/>':''\)/);
  assert.match(b,/if\(ground\)o\+=PSStadiumGround\.paint\(ground,turf,md,grain\);/);
  assert.doesNotMatch(b,/id="psStMow" patternUnits="userSpaceOnUse" x="'\+f\(L\)/,'psStMow 는 모듈 한 곳에서');
  assert.match(b,/:mow\.grass\(pk\.ga,pk\.gb\)\)/,'사진 없는 기기의 x 줄은 운동장 하나에서만(3.316 — 색은 피치 pk · 3.326 무늬는 mowPlan)');
  const one=G.mowPlan({multi:false,L:30,T:30,m:10,len:105,pw:1050,kind:'band'}).grass('#111111','#222222'),many=G.mowPlan({multi:true,cards:[[0,0,300,450]],len:105,L:0,T:0,m:4,kind:'band'}).grass('#111111','#222222');
  assert.ok(one.includes('fill="#222222"')&&!many.includes('#222222'),'두 색 줄은 운동장 하나에서만');
  assert.ok(read('tests/browser/run-critical.mjs').includes("'board-grass-mow-3255'"));
});
