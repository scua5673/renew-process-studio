// 3.332 — 주간 «이번 주 요약»의 강도 막대(studio/week-intensity.js). 적힌 세션 RPE 만 그린다 · 경기가 잡힌 주는 MD 축, 없는 주는 요일.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const W=require('../studio/week-intensity.js');
const D=['월','화','수','목','금','토','일'];
const day=(i,o)=>Object.assign({d:D[i],md:'',sessions:[],match:null,kind:''},o);

test('경기 없는 주 — 요일 축 · 적힌 강도만 · 빈 날은 자리만',()=>{
  const m=W.model([day(0,{sessions:[{rpe:10,min:0}]}),day(1,{sessions:[{rpe:6,min:51}]}),day(2,{sessions:[{rpe:8,min:57}]}),
    day(3,{kind:'훈련',today:true}),day(4,{kind:'훈련'}),day(5,{kind:'OFF'}),day(6,{kind:'OFF'})]);
  assert.equal(m.mdMode,false);assert.equal(m.any,true);assert.equal(m.hasMatch,false);
  assert.equal(m.avg,'8.0');assert.equal(m.top,'월');
  assert.deepEqual(m.cols.map(c=>c.val),['10','6','8','','','','']);
  assert.deepEqual(m.cols.map(c=>c.cap),['–','51′','57′','계획만','계획만','OFF','OFF']);
  assert.deepEqual(m.cols.map(c=>c.bars.map(b=>b.k+b.h).join()),['hi100','mid60','hi80','','','','']);
  assert.deepEqual(m.cols.map(c=>c.tone),['','','','none','none','none','none']);
  const h=W.html(m);
  assert.equal((h.match(/class="wki-col/g)||[]).length,7);assert.ok(!h.includes('wki-md'),'MD 줄 없음');
  assert.ok(!h.includes('class="mt"'),'경기 범례 없음');assert.match(h,/wki-col none today/);
});

test('경기 있는 주 — MD 축 · 경기 막대 · 평균과 가장 높은 날은 훈련만',()=>{
  const m=W.model([day(0,{md:'MD-5',sessions:[{rpe:3,min:60}]}),day(1,{md:'MD-4',sessions:[{rpe:8,min:75}]}),day(2,{md:'MD-3',sessions:[{rpe:7,min:75}]}),
    day(3,{md:'MD-2',sessions:[{rpe:5,min:60}]}),day(4,{md:'MD-1',sessions:[{rpe:3,min:45}]}),day(5,{md:'MD',match:{rpe:9,min:90}}),day(6,{md:'MD+1',kind:'OFF'})]);
  assert.equal(m.mdMode,true);assert.equal(m.hasMatch,true);assert.equal(m.avg,'5.2');assert.equal(m.top,'MD-4');
  assert.equal(m.cols[5].tone,'mt');assert.equal(m.cols[5].val,'9');assert.equal(m.cols[5].cap,'90′');
  assert.deepEqual(m.cols.map(c=>c.bars[0]?c.bars[0].k:''),['lo','hi','hi','mid','lo','mt','']);
  const h=W.html(m);
  assert.equal((h.match(/class="wki-md/g)||[]).length,7);assert.match(h,/wki-md is-md">MD</);assert.match(h,/class="mt"><\/i>경기/);
});

test('하루 세션 둘은 막대 둘 · 큰 숫자는 가장 높은 값 · 회복 · 강도 없는 세션',()=>{
  const m=W.model([day(0,{sessions:[{rpe:4,min:40},{rpe:7,min:60}]}),day(1,{sessions:[{rec:true,min:30}]}),day(2,{sessions:[{rpe:0,min:50}]}),
    day(3,{sessions:[{rpe:6,min:60}],match:{rpe:9,min:90},md:'MD'})]);
  assert.equal(m.cols[0].bars.length,2);assert.equal(m.cols[0].val,'7');assert.equal(m.cols[0].h,70);assert.equal(m.cols[0].cap,'100′');
  assert.equal(m.cols[1].rec,true);assert.equal(m.cols[1].val,'');assert.equal(m.cols[1].h,10);
  assert.equal(m.cols[2].tone,'none');assert.equal(m.cols[2].cap,'50′');
  assert.equal(m.cols[3].tone,'','훈련과 경기가 같은 날이면 숫자는 경기 색을 쓰지 않는다');assert.equal(m.cols[3].val,'9');
  assert.equal(m.avg,'5.7');assert.equal(m.top,'월');
  assert.match(W.html(m),/wki-v rec" style="bottom:10%">회복/);
});

test('적힌 강도가 하나도 없으면 안내 한 줄 · 범위 밖 값은 버린다 · 이름은 글자로',()=>{
  assert.match(W.html(W.model([day(0,{kind:'훈련'}),day(1,{sessions:[{rpe:11,min:30}]})])),/^<span class="mempty">/);
  assert.match(W.html(W.model([])),/mempty/);
  const h=W.html(W.model([day(0,{d:'<img x>',md:'"x"',sessions:[{rpe:5,min:1}]})]));
  assert.ok(!h.includes('<img')&&h.includes('&lt;img x&gt;')&&h.includes('&quot;x&quot;'));
});

test('배선 — process.html 끝 한 줄 · 서비스워커 · 크기 예산',()=>{
  const root=path.join(__dirname,'..'),P=fs.readFileSync(path.join(root,'studio/process.html'),'utf8');
  assert.ok(P.lastIndexOf('<script src="week-intensity.js"></script>')>P.lastIndexOf('function renderMix('),'본문 뒤에서 읽힌다');
  assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes("'/studio/week-intensity.js'"));
  assert.ok(Buffer.byteLength(P)<=820*1024);
});
