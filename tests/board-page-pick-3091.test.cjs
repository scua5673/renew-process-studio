// 3.091 — 페이지 여러 개 골라 운동장 설정 함께 바꾸기(studio/board-page-pick.js). 사용자 «페이지를 다중 선택하고 보드설정에서 바꾸면 바뀌게».
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const P=require('../studio/board-page-pick.js');
const root=path.join(__dirname,'..');

test('stamp — 지금 값의 키만 적고, 같으면 그대로',()=>{
  const sn={pitchTheme:'',pitchCustom:null,pitchImg:null,players:[1]};
  assert.equal(P.stamp(sn,{pitchTheme:'white',pitchCustom:null,pitchImg:null},['pitchTheme','pitchCustom','pitchImg']),true);
  assert.deepEqual(sn,{pitchTheme:'white',pitchCustom:null,pitchImg:null,players:[1]},'선수는 그대로');
  assert.equal(P.stamp(sn,{pitchTheme:'white',pitchCustom:null,pitchImg:null},['pitchTheme','pitchCustom','pitchImg']),false,'같으면 안 바꾼다');
  const sn2={pitchSpec:'fifa',area:'half'};P.stamp(sn2,{pitchSpec:'u12'},['pitchSpec','area']);
  assert.deepEqual(sn2,{pitchSpec:'u12'},'지금 값에 없는 키는 지운다(기본값으로 읽힌다)');
});
test('stampPage — 페이지 스냅과 그 장면들 · 바뀐 장면은 썸네일을 지운다',()=>{
  const snap={pitchN:1},frames=[{snap:{pitchN:1},thumb:'x'},{snap:{pitchN:3},thumb:'y'},null];
  assert.equal(P.stampPage(snap,frames,{pitchN:3},['pitchN']),2);
  assert.equal(snap.pitchN,3);assert.equal(frames[0].thumb,undefined);assert.equal(frames[1].thumb,'y');
});
test('picker — 지금 페이지는 고르지 않는다 · 모두/풀기 · 개수나 지금 페이지가 바뀌면 비운다',()=>{
  const k=P.picker();k.sync(3,0);
  assert.equal(k.toggle(0,0),false);assert.equal(k.toggle(2,0),true);assert.deepEqual(k.list(),[2]);
  k.sync(3,0);assert.deepEqual(k.list(),[2],'그대로면 둔다');
  assert.equal(k.all(3,0),true);assert.deepEqual(k.list(),[1,2]);assert.equal(k.all(3,0),false);assert.deepEqual(k.list(),[]);
  k.toggle(1,0);k.sync(3,1);assert.deepEqual(k.list(),[],'지금 페이지가 바뀌면 비운다');
  k.toggle(2,1);k.sync(4,1);assert.deepEqual(k.list(),[],'개수가 바뀌면 비운다');
});
test('작전판에 연결 — script 한 줄 · 오프라인 묶음(sw.js)',()=>{
  assert.ok(fs.readFileSync(path.join(root,'studio/board.html'),'utf8').includes('<script src="board-page-pick.js"></script>'));
  assert.ok(fs.readFileSync(path.join(root,'sw.js'),'utf8').includes("'/studio/board-page-pick.js'"));
});
