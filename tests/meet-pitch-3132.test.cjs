'use strict';
// 3.132 — 사용자 «미팅자료 만들때 처음에 운동장을 고르게 하자 피치와 전술구역 운동장 가로 세로 · 미팅 자료 토큰은 지금보다 1단계 크게».
// 새 미팅 창(board-meet-form.js)의 «운동장» 값 · 판에 적는 모양 · 토큰 한 칸. 화면 흐름은 tests/browser/meeting-pitch-pick.mjs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const F=require('../studio/board-meet-form.js');
const root=path.join(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('고르개는 작전판 보드 설정의 피치 · 전술 구역과 같은 값 · 같은 이름',()=>{
  const b=read('studio/board.html');
  const pitch=[...b.match(/id="pitchSeg"[\s\S]*?<\/div>/)[0].matchAll(/data-p="([^"]+)"[^>]*>([^<]+)/g)].map(m=>[m[1],m[2]]);
  assert.deepEqual([...F.PITCHES].sort(),[...pitch].sort(),'피치 다섯');
  const zone=[...b.match(/id="zonePreset">[\s\S]*?<\/div><\/div>/)[0].matchAll(/data-ps="full\|([^"]+)"[^>]*>([^<]+)/g)].map(m=>[m[1],m[2]]);
  assert.deepEqual(F.GRIDS,zone,'전술 구역 여섯(같은 차례)');
  assert.deepEqual(F.LOOK_DEF,{pitch:'navy',grid:'grid15'},'3.128 새 미팅 기본 — 네이비 · 15존');
});

test('판에 적는 모양 — 네이비는 빈 값, 잔디는 grass + 실사 타일',()=>{
  assert.deepEqual(F.lookSnap({pitch:'navy',grid:'grid15'}),{pitchTheme:'',pitchImg:null,pitchCustom:null,gridType:'grid15'});
  assert.deepEqual(F.lookSnap({pitch:'real',grid:'off'}),{pitchTheme:'grass',pitchImg:'@real',pitchCustom:null,gridType:'off'});
  assert.deepEqual(F.lookSnap({pitch:'white',grid:'grid'}),{pitchTheme:'white',pitchImg:null,pitchCustom:null,gridType:'grid'});
  assert.equal(F.sameLook({pitchTheme:'',gridType:'grid15'},{pitch:'navy',grid:'grid15'}),true);
  assert.equal(F.sameLook({pitchTheme:'grass',pitchImg:null,gridType:'off'},{pitch:'real',grid:'off'}),false,'실사 타일이 없는 잔디는 다르다');
  assert.equal(F.sameLook({pitchTheme:'custom',pitchCustom:'#123456',gridType:'grid15'},{pitch:'navy',grid:'grid15'}),false);
  assert.deepEqual(F.normLook({pitch:'x',grid:'y'},'h'),{pitch:'navy',custom:null,grid:'grid15',oh:'h'},'모르는 값은 기본 · 방향은 지금 미팅 방향');
  assert.deepEqual(F.normLook({pitch:'calm',grid:'thirds',oh:'v'},'h'),{pitch:'calm',custom:null,grid:'thirds',oh:'v'});
  // «직접» — 작전판 «직접 색»(applyCustom)과 같은 값(custom + #rrggbb). 색이 없거나 깨졌으면 기본
  assert.deepEqual(F.normLook({pitch:'custom',custom:'#C2410C'},'h'),{pitch:'custom',custom:'#c2410c',grid:'grid15',oh:'h'});
  assert.equal(F.normLook({pitch:'custom',custom:'red'},'h').pitch,'navy');assert.equal(F.normLook({pitch:'custom'},'h').pitch,'navy');
  assert.deepEqual(F.lookSnap({pitch:'custom',custom:'#c2410c',grid:'off'}),{pitchTheme:'custom',pitchImg:null,pitchCustom:'#c2410c',gridType:'off'});
  assert.equal(F.sameLook({pitchTheme:'custom',pitchCustom:'#C2410C',gridType:'off'},{pitch:'custom',custom:'#c2410c',grid:'off'}),true);
  assert.equal(F.sameLook({pitchTheme:'custom',pitchCustom:'#000000',gridType:'off'},{pitch:'custom',custom:'#c2410c',grid:'off'}),false);
  const b=read('studio/board.html');
  assert.match(b,/pitchCustom:\(function\(\)\{try\{return \(document\.documentElement\.dataset\.pitch==="custom"\)/,'작전판도 custom + 색으로 담는다');
  assert.match(b,/if\(s\.pitchTheme!=null\|\|s\.pitchCustom!=null\)\{ window\.__applyPitch\(s\.pitchTheme\|\|"", s\.pitchCustom\|\|null\); \}/,'판을 열면 그 색을 칠한다');
});

test('토큰 한 칸 — 작전판 «＋»와 같은 사다리 · 같은 반올림, 맨 위면 그대로',()=>{
  const o=0.55,b=Math.round(o/1.55*1000)/1000,L=[b,b*1.25,o,o*1.25,o*1.55,o*1.9,o*2.3];   // board.html tokScaleLevels(데스크톱)
  assert.equal(F.bumpTok(L,b),0.44,'기본(0.355) → 0.44');
  assert.equal(F.bumpTok(L,0.44),0.55);
  assert.equal(F.bumpTok(L,0.4),0.55,'0.4 는 가까운 칸(0.444)의 다음 — 작전판 «＋»(scaleAll)와 같다');
  assert.equal(F.bumpTok(L,o*2.3),Math.round(o*2.3*100)/100,'가장 큰 칸');
  assert.equal(F.bumpTok(null,0.4),0.46,'사다리가 없으면 1.15배');
  const b2=read('studio/board.html');
  assert.match(b2,/function tokScaleLevels\(\)\{var b=defaultTokenScale\(\),o=_tokOldDefault\(\);return \[b,b\*1\.25,o,o\*1\.25,o\*1\.55,o\*1\.9,o\*2\.3\];\}/,'시험의 사다리 = 작전판 사다리');
  assert.match(b2,/Math\.round\(L\[idx\]\*100\)\/100/,'같은 반올림(scaleAll)');
});

test('미리보기 — 고른 색 · 구역선 · 세로(우리 골대 아래)',()=>{
  const sn={pitchSpec:'fifa',players:[{team:'blue',num:'1',x:555-50*10,y:370}],ball:null},g={mpp:10,cx:555,cy:370};
  const h=F.previewSVG(sn,g,{},{pitch:'navy',grid:'off',oh:'h'}),v=F.previewSVG(sn,g,{},{pitch:'white',grid:'grid15',oh:'v'});
  assert.match(h,/viewBox="-3 -3 111 74"/);assert.match(h,/fill="#15172b"/);assert.doesNotMatch(h,/stroke-dasharray/,'구역 없음');
  assert.match(v,/viewBox="-3 -3 74 111"/,'세로는 돌린 판');assert.match(v,/fill="#ffffff"/);
  assert.equal((v.match(/stroke-dasharray/g)||[]).length,6,'15존 = 레인 넷 + 3등분 둘');
  assert.match(v,/<circle cx="34" cy="102\.5"/,'우리 골키퍼(왼쪽 2.5m)는 세로에서 아래');
  const c=F.previewSVG(sn,g,{},{pitch:'custom',custom:'#f0e68c',grid:'off',oh:'h'}),d=F.previewSVG(sn,g,{},{pitch:'custom',custom:'#c2410c',grid:'lanes',oh:'h'});
  assert.match(c,/fill="#f0e68c"/);assert.match(c,/stroke="#39414f"/,'밝은 색은 진한 선(작전판 applyCustom 처럼)');
  assert.match(d,/stroke="#ffffff"/,'어두운 색은 흰 선');assert.match(d,/stroke="#cfe0ff"/,'어두운 색의 구역선');
  assert.doesNotMatch(h+v+c+d,/NaN|undefined/);
});

test('경기 미팅 바탕이 창의 운동장 · 토큰을 받는다 — board.html 은 한 군데만',()=>{
  const b=read('studio/board.html'),m=read('studio/board-meet-form.js');
  assert.ok(b.includes('base=Object.assign(meetBaseSnap(),{pitchTheme:"",pitchCustom:null,pitchImg:null,gridType:"grid15"},window.__meetLook)'));
  assert.match(m,/win\.__meetLook = Object\.assign\(lookSnap\(lk\), \{ tokenScale: bigTok\(curTok\(\)\), tokV: 2 \}\);/,'경기 장면까지 · tokV:2');
  assert.match(m,/finally \{ cur = null; win\.__meetLook = null; \}/,'만든 뒤 걷는다');
  assert.match(m,/base\.tokenScale = bigTok\(base\.tokenScale\); base\.tokV = 2;/,'보관함 «미팅 만들기»의 바탕도 한 칸');
  assert.match(m,/ls\.setItem\('ps_meet_orient_v2'/,'방향은 미팅 방향 기억(2.932 — 새 키 없음)');
});
