'use strict';
// 3.125 — 오류 제보 70307dd9: 팀 등록에서 선수 사진을 넣을 때도 작전판 토큰처럼 사진 영역(확대 · 좌우 · 위아래)을 정한다.
// 창은 studio/photo-crop.js, 팀 등록은 PSTeamPhotos.pick 으로 부른다. 화면 흐름은 tests/browser/team-photo-crop.mjs.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../studio/photo-crop.js');
const P=require('../studio/team-photos.js');
const root=path.join(__dirname,'..');

test('잘라 낼 영역: 확대 1 은 짧은 변 전체 · 자리는 남는 폭 안에서',()=>{
  assert.deepEqual(C.rect(400,200,1,.5,.5),{size:200,x:100,y:0},'가로 사진 — 가운데');
  assert.deepEqual(C.rect(400,200,1,0,.5),{size:200,x:0,y:0},'왼쪽 끝');
  assert.deepEqual(C.rect(400,200,1,1,.5),{size:200,x:200,y:0},'오른쪽 끝');
  assert.deepEqual(C.rect(200,400,2,.5,0),{size:100,x:50,y:0},'세로 사진 2배 — 위쪽');
  assert.deepEqual(C.rect(200,200,9,.5,.5),{size:50,x:75,y:75},'확대는 4배까지');
  assert.deepEqual(C.rect(200,200,.2,.5,.5),{size:200,x:0,y:0},'1 아래로는 줄이지 않는다');
  assert.equal(C.clamp(-1),0);assert.equal(C.clamp(3),1);assert.equal(C.clamp('x'),.5);
});

test('끌기: 사진이 손가락을 따라온다(오른쪽으로 끌면 왼쪽 부분이 보인다)',()=>{
  const s={fx:.5,fy:.5};
  const r=C.dragTo(s,50,0,400,200,1,200);   // 미리보기 200px 에서 50px 오른쪽 → 원본 50px(=남는 폭 200 의 1/4)
  assert.equal(r.fx,.25);assert.equal(r.fy,.5,'남는 높이가 없으면 위아래는 가운데');
  assert.equal(C.dragTo(s,-1000,0,400,200,1,200).fx,1,'끝을 넘지 않는다');
  assert.equal(C.dragTo({fx:.5,fy:.5},0,0,300,300,1,200).fx,.5,'정사각 · 확대 1 이면 움직일 곳이 없다');
});

test('창 모듈이 없으면 예전처럼 가운데 정사각형(square)',()=>{
  assert.equal(typeof P.pick,'function');
  // pick 은 같은 모듈 안의 square 를 부른다 — 창이 없으면 square 로 간다는 것을 소스에서 본다(브라우저 없는 시험)
  const src=fs.readFileSync(path.join(root,'studio/team-photos.js'),'utf8');
  assert.match(src,/if\(!C\|\|!C\.open\)return square\(file,doc\);/);
});

test('팀 등록이 창을 읽고, 앱이 오프라인에도 싣는다',()=>{
  const html=fs.readFileSync(path.join(root,'studio/analysis.html'),'utf8');
  const a=html.indexOf('<script src="photo-crop.js"></script>'),b=html.indexOf('<script src="team-photos.js"></script>');
  assert.ok(a>0&&b>a,'photo-crop.js 를 team-photos.js 보다 먼저');
  assert.match(html,/photos\.pick\?photos\.pick\(file,document,window\):photos\.square\(file\)/);
  assert.match(html,/if\(!url\)\{status\.textContent='사진을 넣지 않았습니다\.';return;\}/,'취소하면 아무것도 바꾸지 않는다');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  assert.ok(sw.includes("'/studio/photo-crop.js'"));
});
