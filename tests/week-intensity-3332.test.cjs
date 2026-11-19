// 3.332 강도 막대 → 3.337 부하 막대(studio/week-intensity.js). 부하 = 세션 RPE × 분, 클수록 붉다 · 경기가 잡힌 주는 MD 축, 없는 주는 요일.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const W=require('../studio/week-intensity.js');
const D=['월','화','수','목','금','토','일'];
const day=(i,o)=>Object.assign({d:D[i],md:'',sessions:[],match:null,kind:''},o);

test('경기 없는 주 — 요일 축 · 부하 = RPE × 분 · 시간이 빈 세션은 점선 · 빈 날은 자리만',()=>{
  const m=W.model([day(0,{sessions:[{rpe:10,min:0}]}),day(1,{sessions:[{rpe:6,min:51}]}),day(2,{sessions:[{rpe:8,min:57}]}),
    day(3,{kind:'훈련',today:true}),day(4,{kind:'훈련'}),day(5,{kind:'OFF'}),day(6,{kind:'OFF'})]);
  assert.equal(m.mdMode,false);assert.equal(m.any,true);
  assert.equal(m.total,762);assert.equal(m.empty,1);assert.equal(m.top,'수');
  assert.deepEqual(m.cols.map(c=>c.val),['?','306','456','','','','']);
  assert.deepEqual(m.cols.map(c=>c.cap.join('/')),['RPE 10/분 –','RPE 6/51′','RPE 8/57′','계획만','계획만','OFF','OFF']);
  assert.deepEqual(m.cols.map(c=>c.k+':'+c.h),['0:40','2:31','2:46','0:0','0:0','0:0','0:0']);
  assert.deepEqual(m.cols.map(c=>c.tone),['hole','','','none','none','none','none']);
  const h=W.html(m);
  assert.equal((h.match(/class="wki-col/g)||[]).length,7);assert.ok(!h.includes('wki-md'),'MD 줄 없음');
  assert.match(h,/wki-col none today/);assert.match(h,/주간 부하<\/span> <b>762<\/b> · <span>빈 세션<\/span> <b>1<\/b>/);
  assert.match(h,/wki-bar hole/);assert.match(h,/class="hole"><\/i>RPE나 시간이 빈 세션/);
});

test('경기 있는 주 — MD 축 · 경기도 부하로 잰다 · 클수록 붉은 칸',()=>{
  const m=W.model([day(0,{md:'MD-5',sessions:[{rpe:3,min:45}]}),day(1,{md:'MD-4',sessions:[{rpe:8,min:80}]}),day(2,{md:'MD-3',sessions:[{rpe:7,min:75}]}),
    day(3,{md:'MD-2',sessions:[{rpe:5,min:60}]}),day(4,{md:'MD-1',sessions:[{rpe:3,min:45}]}),day(5,{md:'MD',match:{rpe:9,min:90}}),day(6,{md:'MD+1',kind:'OFF'})]);
  assert.equal(m.mdMode,true);assert.equal(m.total,2545);assert.equal(m.empty,0);assert.equal(m.top,'MD');
  assert.deepEqual(m.cols.map(c=>c.load),[135,640,525,300,135,810,0]);
  assert.deepEqual(m.cols.map(c=>c.k),[1,3,3,2,1,4,0]);
  assert.deepEqual(m.cols.map(c=>c.h),[14,64,53,30,14,81,0]);
  assert.equal(m.cols[5].cap.join('/'),'RPE 9/90′');
  const h=W.html(m);
  assert.equal((h.match(/class="wki-md/g)||[]).length,7);assert.match(h,/wki-md is-md">MD</);
  assert.match(h,/wki-bar k4" style="height:81%"/);assert.ok(!h.includes('경기</span>')&&!h.includes('빈 세션'),'범례는 부하 네 칸뿐');
  assert.match(h,/낮음 ~299.*보통 300–499.*높음 500–699.*매우 높음 700\+/);
});

test('하루 세션 둘은 한 막대에 쌓는다 · 회복은 분 × 0.3 · 1000 을 넘으면 축이 따라 큰다 · 천 단위 쉼표',()=>{
  const m=W.model([day(0,{sessions:[{rpe:8,min:50},{rpe:6,min:40}]}),day(1,{sessions:[{rec:true,min:30}]}),day(2,{sessions:[{rpe:0,min:50}]}),
    day(3,{sessions:[{rpe:6,min:60}],match:{rpe:9,min:90},md:'MD'})]);
  assert.deepEqual(m.cols[0].segs,[400,240]);assert.equal(m.cols[0].load,640);assert.equal(m.cols[0].cap.join('/'),'RPE 8/90′');
  assert.equal(m.cols[1].load,9);assert.equal(m.cols[1].k,1);assert.equal(m.cols[1].cap.join('/'),'회복/30′');assert.equal(m.cols[1].h,4,'작은 부하도 보이는 높이');
  assert.equal(m.cols[2].tone,'hole');assert.equal(m.cols[2].cap.join('/'),'RPE –/50′');
  assert.equal(m.cols[3].load,1170);assert.equal(m.cols[3].val,'1,170');assert.equal(m.cols[3].h,100);assert.equal(m.cols[0].h,55);
  assert.equal(m.total,1819);assert.equal(m.empty,1);assert.equal(m.top,'MD');
  assert.match(W.html(m),/<i style="flex:400 0 0"><\/i><i style="flex:240 0 0"><\/i>/);
});

test('세션이 하나도 없으면 안내 한 줄 · 범위 밖 RPE 는 빈 세션 · 이름은 글자로',()=>{
  assert.match(W.html(W.model([day(0,{kind:'훈련'}),day(1,{kind:'OFF'})])),/^<span class="mempty">/);
  assert.match(W.html(W.model([])),/mempty/);
  assert.equal(W.model([day(0,{sessions:[{rpe:11,min:30}]})]).cols[0].tone,'hole');
  const h=W.html(W.model([day(0,{d:'<img x>',md:'"x"',sessions:[{rpe:5,min:1}]})]));
  assert.ok(!h.includes('<img')&&h.includes('&lt;img x&gt;')&&h.includes('&quot;x&quot;'));
});

test('배선 — process.html 끝 한 줄 · 서비스워커 · 크기 예산',()=>{
  const root=path.join(__dirname,'..'),P=fs.readFileSync(path.join(root,'studio/process.html'),'utf8');
  assert.ok(P.lastIndexOf('<script src="week-intensity.js"></script>')>P.lastIndexOf('function renderMix('),'본문 뒤에서 읽힌다');
  assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes("'/studio/week-intensity.js'"));
  assert.ok(Buffer.byteLength(P)<=820*1024);
});
