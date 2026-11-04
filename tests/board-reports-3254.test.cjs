'use strict';
/* 3.254 — 작전판 제보 셋(2026-11-03, 같은 제보자).
   - 3d89e952 · eb30babd «영상마다 운동장 위치가 다르다 · 다른 이미지를 불러오면 내보내기 크기가 제각각» → 16:9 · 릴스 화면은 운동장 틀 하나.
   - 2456db8e «연결선 · 다각형 · 원 도형도 점선 모드» → 이미 있는 «선 스타일 › 모양»(실선 · 점선 · 둥근 점선)이 구역 · 원형 구역 · 그리드 모양에도 먹게.
   - 7db68045 «장면5부터 강조가 필요할 때 장면6~9 모두 일일이 눌러야 · 해제도» → 강조 · 깜박임을 이 장면부터 뒤로 이어서.
   실제 판은 tests/browser/board-reports-3254.mjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const M=require('../studio/board-shape-menu.js');
const tw=require('../studio/board-tweaks.js');
const P=require('../studio/board-pitch-photo.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const near=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-6);

test('선 모양 — 점선 도구 · 선수 이동은 처음부터 점선, 다른 그림은 표식으로',()=>{
  assert.equal(M.lineStyleOf({type:'link'}),'solid');
  assert.equal(M.lineStyleOf({type:'link',dash:true}),'dash');
  assert.equal(M.lineStyleOf({type:'poly',dot:true,dash:true}),'dot','둥근 점선이 먼저(2.681 그리기와 같은 차례)');
  assert.equal(M.lineStyleOf({type:'dashline'}),'dash');
  assert.equal(M.lineStyleOf({type:'rectdash'}),'dash');
  assert.equal(M.lineStyleOf({type:'rectdash',solid:true}),'solid');
  assert.equal(M.lineStyleOf({type:'run'}),'dash');
  assert.equal(M.lineStyleOf(null),'solid');
});

test('선 모양 바꾸기 — 연결선 · 다각형 · 원형 구역 · 그리드 원 · 점선 도구 모두 같은 말, 글은 건드리지 않는다',()=>{
  for(const type of ['link','poly','ellipse','rect','rectline','line','free']){
    const d={type};
    assert.equal(M.setLineStyle(d,'dash'),true);assert.deepEqual(d,{type,dash:true});
    assert.equal(M.setLineStyle(d,'dot'),true);assert.deepEqual(d,{type,dot:true});
    assert.equal(M.setLineStyle(d,'solid'),true);assert.deepEqual(d,{type},'실선은 표식 없음(옛 판과 같은 모양)');
    assert.equal(M.setLineStyle(d,'solid'),false,'이미 실선');
  }
  const r={type:'rectdash'};
  assert.equal(M.setLineStyle(r,'solid'),true);assert.deepEqual(r,{type:'rectdash',solid:true},'점선 도구를 실선으로 = solid 표식(종류는 그대로)');
  assert.equal(M.setLineStyle(r,'dash'),true);assert.deepEqual(r,{type:'rectdash'});
  const dl={type:'dashline',dash:true};
  assert.equal(M.setLineStyle(dl,'dash'),false,'옛 표식이 있어도 점선은 점선');assert.deepEqual(dl,{type:'dashline'});
  const run={type:'run'};
  assert.equal(M.setLineStyle(run,'solid'),false,'선수 이동은 «점선 화살표»라는 뜻이라 실선으로 바꾸지 않는다');assert.equal(M.lineStyleOf(run),'dash');
  assert.equal(M.setLineStyle({type:'text'},'dash'),false);
  assert.equal(M.setLineStyle({type:'link'},'zigzag'),false);
});

test('점선 무늬 — 연결선 · 다각형이 2.681 부터 쓰던 값, 굵기 배수를 따른다',()=>{
  assert.equal(M.dashArray('dash',1),'11 8');
  assert.equal(M.dashArray('dash',2),'22 16');
  assert.equal(M.dashArray('dot',1),'0.1 12.0');
  assert.equal(M.dashArray('solid',1),null);
});

test('새 단추는 늘리지 않는다 — 이미 있는 «선 스타일 › 모양»으로 가는 이름만 점선을 말한다',()=>{
  const src=read('studio/board-shape-menu.js');
  assert.doesNotMatch(src,/data-ls=/,'오른쪽 클릭 창에 모양 단추를 따로 두지 않는다(사용자 10/18 «단추 · 설정을 늘리지 않고»)');
  assert.match(src,/data-act="more" title="선 스타일 — 실선 · 점선 · 둥근 점선 · 끝 모양 · 채움">점선 · 선 스타일…<\/button>/);
});

test('그리기 — 구역 · 원형 구역은 점선이면 테두리, 사각형 · 그리드 모양은 선 모양을 따른다, 점선 도구는 solid 면 실선',()=>{
  const b=read('studio/board.html');
  assert.match(b,/const _zls=_lsOf\(d\),_zda=_zls==="solid"\?null:_lsDash\(_zls,LW\);/);
  assert.match(b,/"class":"zone-edge"/);
  assert.match(b,/const _rls=_lsOf\(d\),dash=_rls==="dash"\?"11 8":\(_rls==="dot"\?_lsDash\("dot",LW\):null\);/);
  assert.match(b,/else if\(type==="dashline"&&!d\.solid\)at\["stroke-dasharray"\]/);
  // 선 스타일 팝오버도 같은 함수
  assert.match(b,/if\(sd\.length\)\{ ls=_lsOf\(sd\[0\]\); fs=sd\[0\]\.fillStyle\|\|"solid"; \}/);
  assert.match(b,/sd\.forEach\(function\(d\)\{ _lsSet\(d,v\); \}\);/);
  assert.doesNotMatch(b,/if\(v==="dot"\)\{d\.dot=true;delete d\.dash;\} else if\(v==="dash"\)\{d\.dash=true;delete d\.dot;\}/,'옛 손 규칙은 남지 않는다');
  assert.match(b,/id="lineStyleBtn" title="선 스타일 — 굵기 · 투명도 · 점선"/);
  assert.match(read('studio/board-dock-float.js'),/data-df-line="1" title="선 스타일 — 굵기 · 투명도 · 점선\(새로 그릴 선 · 도형\)">굵기 · 점선<\/button>/);
});

// 강조 이어 적용 — board.html 의 순수 구간을 잘라 돌린다(테스트가 코드 모양을 지킨다: 구간 안에 새 전역을 끼우지 말 것)
function carryApi(){
  const b=read('studio/board.html'),A='/* ══ 3.254 · 강조 · 깜박임 이어 적용 — 순수 구간 시작 ══',Z='/* ══ 3.254 · 강조 · 깜박임 이어 적용 — 순수 구간 끝 ══ */';
  const i=b.indexOf(A),j=b.indexOf(Z);assert.ok(i>0&&j>i,'구간 표식');
  const c={};vm.runInNewContext(b.slice(i,j)+';this._animCarryIds=_animCarryIds;this._animCarryRange=_animCarryRange;',c);return c;
}
const F=(...hl)=>hl.map(h=>h?{hl:h.slice()}:{});
const ids=fr=>fr.map(f=>f.hl?f.hl.join(','):'');

test('강조 켜기 — 이 장면부터 끝까지(뒤 장면이 모두 꺼져 있던 흔한 경우)',()=>{
  const {_animCarryIds:carry,_animCarryRange:range}=carryApi();
  const fr=F(null,null,null,null,null,null,null,null,null);   // 장면 1~9
  assert.equal(carry(fr,4,'hl',7,true),8);
  assert.deepEqual(ids(fr),['','','','','7','7','7','7','7']);
  assert.equal(range(4,8),'장면 5~9');assert.equal(range(8,8),'장면 9');
});

test('강조 끄기 — 이 장면부터 켜져 있던 곳까지, 다른 토큰 강조는 그대로',()=>{
  const {_animCarryIds:carry}=carryApi();
  const fr=F([3],[3,7],[7,3],[7],[7],[3]);
  assert.equal(carry(fr,1,'hl',7,false),4);
  assert.deepEqual(ids(fr),['3','3','3','','','3']);
  assert.equal('hl' in fr[3],false,'빈 목록은 지운다(예전 toggleHl 과 같다)');
});

test('뒤에서 따로 바꿔 둔 장면이 나오면 거기서 멈춘다 — 장면 3~7 강조 · 8~9 해제를 만든 뒤 장면 3 에서 다시 켜도 8~9 는 그대로',()=>{
  const {_animCarryIds:carry}=carryApi();
  const fr=F(null,null,null,null,null,null,null,null,null);
  carry(fr,4,'hl',7,true);    // 장면 5~9 켬
  carry(fr,7,'hl',7,false);   // 장면 8~9 끔
  assert.deepEqual(ids(fr),['','','','','7','7','7','','']);
  assert.equal(carry(fr,2,'hl',7,true),3,'장면 3~4 만 켜고 장면 5(이미 켜짐)에서 멈춘다');
  assert.deepEqual(ids(fr),['','','7','7','7','7','7','','']);
  assert.equal(carry(fr,5,'hl',7,false),6,'장면 6~7 만 끄고 장면 8(이미 꺼짐)에서 멈춘다');
  assert.deepEqual(ids(fr),['','','7','7','7','','','','']);
});

test('장면끼리 같은 배열을 나눠 가져도 한 장면만 바뀌지 않는다 · 깜박임(blink)도 같은 규칙 · 잘못된 장면은 -1',()=>{
  const {_animCarryIds:carry}=carryApi();
  const shared=[5],fr=[{blink:shared},{blink:shared},{}];
  assert.equal(carry(fr,1,'blink',5,false),1);
  assert.deepEqual(fr.map(f=>f.blink||null),[[5],null,null]);
  assert.deepEqual(shared,[5],'원래 배열은 건드리지 않는다');
  assert.equal(carry([],0,'hl',1,true),-1);
});

test('강조 단추 · 깜박임 단추가 이어 적용을 쓴다(되돌리기 한 번)',()=>{
  const b=read('studio/board.html');
  assert.match(b,/function toggleHl\(\)\{ _animToggleCarry\("hl",/);
  assert.match(b,/function toggleBlink\(\)\{ _animToggleCarry\("blink",/);
  const fn=b.slice(b.indexOf('function _animToggleCarry('),b.indexOf('function toggleBlink(){'));
  assert.equal((fn.match(/pushUndo\(\)/g)||[]).length,2,'고른 것 있음 · 없음 각각 한 번');
  assert.match(fn,/toast\(words\.off\+" 모두 · "\+_animCarryRange\(k,last\)\)/);
});

test('영상 화면 — 기본 운동장 · 사진 운동장(어느 비율이든) · 놓인 것과 상관없이 같은 틀',()=>{
  const pr={L:30,T:30,PW:1050,PH:680},pb=[30,30,1080,710],m=30;
  const want=tw.frame169(pb,m,null,true);
  assert.ok(near(want.map(v=>Math.round(v*100)/100),[-102.78,0,1315.56,740]));
  for(const u of [[0,0,1110,740],[-175,0,1285,740],[0,0,1110,825],[0,0,1110,757]])assert.ok(near(tw.frame169(pb,m,u,true),want),'놓인 것 '+u);
  for(const [w,h] of [[1920,1080],[1600,1200],[1500,1000],[2560,1080],[900,1600]])
    assert.ok(P.videoBox({pitchImg:P.refOf('x'+w,w,h),orientation:'h'},pr,m,1110,740,16/9).every((v,i)=>Math.abs(v-want[i])<1e-6),'사진 '+w+'x'+h);
});

test('영상 배선 — 사진도 운동장 틀, 사진이 못 덮는 쪽은 어두운 띠(16:9 · GIF 에서만), 페이지 릴스도 운동장 기준',()=>{
  const b=read('studio/board.html'),t=read('studio/board-tweaks.js');
  assert.doesNotMatch(t,/isRef\(state\.pitchImg\)\) return orig169/,'사진이라고 다른 틀로 가지 않는다');
  assert.match(b,/else \{ uvb=_export169\(uvb\); window\.__psExport169=1;/);
  assert.match(b,/if\(o\.ratio==="16:9"\)\{ try\{ uvb=_export169\(uvb\); window\.__psExport169=1; \}catch\(_\)\{\} \}/);
  assert.match(b,/window\.__psExportFit=0; window\.__psExport169=0;/,'내보내기가 끝나면(예외여도) 끈다');
  assert.match(b,/if\(window\.__psExport169&&!window\.__animExport3d\)\{ const pim=clone\.querySelector\('#ps-pitchimg'\);/);
  assert.match(b,/fill:"#0B0D10","fill-rule":"evenodd","class":"ps-photo-bars"/);
  assert.match(b,/try\{ if\(window\.__psReelVB\)_segVB\[g\]\.rb=__psReelVB\(_segVB\[g\]\.raw\.slice\(\)\); \}catch\(_\)\{\}/);
  assert.match(b,/sg\.reel=_toAr\(\(!_fit&&sg\.rb\)\?sg\.rb:sg\.raw\)/);
  assert.doesNotMatch(b,/needW=2\*Math\.max\(cx-uvb\[0\]/,'board.html 의 옛 틀도 놓인 것으로 커지지 않는다');
  assert.match(b,/운동장은 영상마다 같은 자리 · 같은 크기예요 — 운동장 둘레 밖에 둔 것까지 담으려면 «훈련 구역»을 고르세요\./);
});

test('배포 묶음 — 새 브라우저 시험이 board2 묶음에 있다',()=>{
  assert.ok(read('tests/browser/run-critical.mjs').includes("'board-reports-3254'"));
  assert.ok(fs.existsSync(path.join(__dirname,'browser','board-reports-3254.mjs')));
});
