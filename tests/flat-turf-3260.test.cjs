'use strict';
/* 3.260 — 평면 잔디(사용자 «평면에서도 잔디결 아주 희미하게» · «4m 간격으로» · «가로일 때 세로일 때 다 신경써서»).
   ① 잎결 — 사진 없는 «잔디» 피치에 3D 잎결을 옅게. ② 실사 잔디 사진 — 칸 = 깎은 줄 한 쌍, 돌리기는 운동장 하나(0°) · 여럿(90°)으로
   (세로 판에서 world 가 이미 도는데 무늬를 또 돌려 사진의 띠가 터치라인과 나란했다). ③ 깎은 줄 — 3D psStMow · 카드 띠를 평면에 더 옅게, 약 4m.
   실제 화면은 tests/browser/board-flat-turf-3260.mjs. 띠 규칙(PSStadiumGround.bands)은 board-grass-mow-3255 도 본다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const F=require('../studio/board-flat-turf.js'),G=require('../studio/board-stadium-ground.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');

test('띠 — 골라인에서 골라인까지 홀수 개 ≈ 4m: 가운데 띠가 하프라인에 걸치고 두 골라인이 띠 경계',()=>{
  assert.equal(G.BAND,4);
  for(const [len,n] of [[105,27],[65,17],[40,11],[20,5]]){const k=G.bands(len);assert.equal(k,n,len+'m');assert.equal(k%2,1);assert.ok(Math.abs(len/k-4)<.5,'약 4m');}
});

test('실사 잔디 · 깎은 줄 자리 — 운동장 하나는 골라인 L · T 에서 0°(가로 · 세로는 world 가 돌린다), 여럿은 카드마다 90°',()=>{
  assert.deepEqual(F.turfPlan({L:30,T:30,PW:1050,len:105}),{base:{x:30,y:30,size:77.78,rot:0},cards:[]});
  assert.deepEqual(F.turfPlan({L:230,T:130,PW:650,len:65}),{base:{x:230,y:130,size:76.47,rot:0},cards:[]},'8인제 — 실제 운동장 골라인(PR)에서');
  const cards=[[0,0,300,460],[400,0,150,230]],p=F.turfPlan({L:30,T:30,PW:1050,len:105,cards});
  assert.equal(p.base.rot,90);assert.equal(p.cards.length,2);
  p.cards.forEach((c,i)=>{const r=cards[i];assert.equal(c.x,r[0]);assert.equal(c.y,r[1],'카드 위 골라인에서');assert.ok(Math.abs(c.size-2*r[3]/27)<.01,'카드마다 27개 띠');
    assert.ok(c.box[0]<=r[0]&&c.box[1]<=r[1]&&c.box[0]+c.box[2]>=r[0]+r[2]&&c.box[1]+c.box[3]>=r[1]+r[3],'카드를 덮는다');});
  assert.ok(p.cards[0].box[0]+p.cards[0].box[2]<=p.cards[1].box[0],'옆 카드와 겹치지 않는다');
});

test('어디에 깔까 — 잎결은 사진 없는 잔디, 깎은 줄은 잔디(실사 포함) · «잔디 줄무늬»를 직접 켠 판은 그 줄',()=>{
  assert.equal(F.want({pitch:'grass',img:''}),true);
  for(const o of [{pitch:'',img:''},{pitch:'white',img:''},{pitch:'grass',img:'@real'},{pitch:'grass',img:'@photo:abc'},null])assert.equal(F.want(o),false,JSON.stringify(o));
  assert.equal(F.wantMow({pitch:'grass',img:'@real'}),true);assert.equal(F.wantMow({pitch:'grass',img:'@real',grassM:5}),true,'실사 잔디는 줄무늬가 사진 밑');
  assert.equal(F.wantMow({pitch:'grass',img:''}),true);assert.equal(F.wantMow({pitch:'grass',img:'',grassM:5}),false,'두 겹이 되지 않게');
  for(const o of [{pitch:'',img:''},{pitch:'white',img:''},{pitch:'train',img:''},{pitch:'custom',img:''},{pitch:'grass',img:'@photo:abc'},null])assert.equal(F.wantMow(o),false,JSON.stringify(o));
  assert.ok(F.DK<.07&&F.LT<.06,'3D(.07 · .06)보다 옅게');assert.ok(F.OP>0&&F.OP<=.5);
});

test('잎결 칸 — 8m, 운동장 여럿이면 90°',()=>{
  assert.deepEqual(F.plan({L:30,T:30,mpp:10,n:1}),{x:30,y:30,size:80,rot:0,op:F.OP});
  assert.deepEqual(F.plan({L:30,T:30,mpp:10,n:5}),{x:30,y:30,size:80,rot:90,op:F.OP});
});

test('감싸기 — 판 · 사진 · 운동장 수 · 카드(셸이 그린 뒤 __psWmPlace)를 지난 뒤 맞추고, 원래 값을 돌려준다',()=>{
  const calls=[],ks=['buildPitch','redrawGrass','renderPitchImg','__setPitchN','__psWmPlace'];
  const win={document:{readyState:'complete',getElementById:()=>null,documentElement:{dataset:{}}}};
  ks.forEach(k=>{win[k]=function(){calls.push(k);return k+'!';};});
  assert.equal(F.install(win),true);assert.equal(F.install(win),false);
  for(const k of ks){assert.equal(win[k](),k+'!');assert.equal(win[k].__psFlatTurf,1);}
  assert.deepEqual(calls,ks);assert.equal(F.sync(win),null,'판(#world)이 없으면 아무것도 안 한다');
});

test('자리 — id 없는 #world 자식 rect: 3D 화면 · 3D 영상 · 운동장 사진이 바탕을 숨기는 규칙에 같이 숨는다',()=>{
  const f=read('studio/board-flat-turf.js'),b=read('studio/board.html');
  assert.match(f,/mk\(d,'rect',\{'class':'ps-flat-grain',fill:'url\(#'\+PAT\+'\)','pointer-events':'none'\}\)/);
  assert.match(f,/mk\(d,'rect',\{'class':'ps-flat-mow',x:base\.getAttribute\('x'\)/);
  assert.doesNotMatch(f,/mk\(d,'rect',\{[^}]*\bid:/,'rect 에 id 를 주지 않는다');
  assert.ok(b.includes('body.bc-tilt3d #board #world>rect:not([id])'),'3D 화면');
  assert.ok(b.includes("return (stadium?'#world>rect:not([id]),.grass-stripes,#ps-pitchtile,#ps-pitchimg,':'')"),'3D 영상');
  assert.ok(b.includes('body.ps-custompitch #world>rect:not([id]){display:none!important;}'),'운동장 사진');
});

test('작전판 — 세로 판에서 사진 무늬를 또 돌리지 않는다 · 3D 잔디 사진 칸도 깎은 줄 한 쌍 · 잎결 타일은 평면 128 / 3D 256',()=>{
  const b=read('studio/board.html'),s=read('studio/board-stadium-ground.js'),f=read('studio/board-flat-turf.js');
  assert.doesNotMatch(b,/state\.orientation==="v"\)\?\("rotate\(90 "\+L\+" "\+T\+"\)"\)/,'옛 세로 판 회전');
  assert.ok(b.includes('맞춤은 board-flat-turf.js. 세로 판은 world 가 이미 돈다'),'renderPitchImg 는 무늬를 돌리지 않는다');
  assert.match(s,/function grainTile\(n\)\{\n  const N=n>0\?Math\.round\(n\):256,k=N\/256;/);
  assert.match(s,/function grainDefs\(o\)\{const src=grainTile\(\);/,'3D 는 기본(256)');
  assert.match(f,/TILE=128/);assert.match(f,/grainTile\(TILE\)/);
});

test('배선 — board.html <script> 한 줄(잔디 모듈 다음) · sw.js CORE · 브라우저 시험 묶음',()=>{
  const b=read('studio/board.html');
  assert.ok(b.includes('<script src="board-stadium-ground.js"></script><script src="board-flat-turf.js"></script>'));
  assert.ok(read('sw.js').includes("'/studio/board-stadium-ground.js', '/studio/board-flat-turf.js',"));
  assert.ok(read('tests/browser/run-critical.mjs').includes("suites.board.push('board-flat-turf-3260')"));
});
