'use strict';
// 3.128 — 사용자 «미팅만들기 들어가면 평면에 15존에 네이비 피치로».
// 판 모양(네이비 · 15존)은 board.html 기본 9장 · 경기 미팅 바탕 · board-meet-8.js 8인제에서, 평면은 board-meet-look.js 가 새 미팅을 만든 순간에.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const L=require('../studio/board-meet-look.js');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');

test('새 미팅의 판 모양은 세 곳이 같다 — 네이비(빈 값) · 15존',()=>{
  assert.deepEqual(L.LOOK,{pitchTheme:'',pitchCustom:null,pitchImg:null,gridType:'grid15'});
  const b=read('studio/board.html');
  assert.ok(b.includes('boardLocked:false,pitchTheme:"",pitchCustom:null,pitchImg:null,gridType:"grid15"});'),'기본 9장(meetTplSnap)');
  assert.ok(b.includes('base=Object.assign(meetBaseSnap(),{pitchTheme:"",pitchCustom:null,pitchImg:null,gridType:"grid15"})'),'경기 «＋ 새 미팅»의 바탕');
  assert.ok(!/meetTplSnap[\s\S]{0,600}pitchTheme:"white"/.test(b),'흰 운동장 기본은 걷었다');
  assert.ok(read('studio/board-meet-8.js').includes("pitchTheme: '', pitchCustom: null, pitchImg: null, gridType: 'grid15'"),'8인제 9장');
  // 이미 만든 미팅에 경기 자료를 넣는 길(meetInsertSlides)은 예전 그대로 — 그 미팅의 판을 따른다
  assert.match(b,/var base=meetBaseSnap\(\); try\{ var mc=window\.__meetCap/);
});

function fake(){
  const cls=new Set(),calls=[];let obs=null;
  const body={classList:{contains:c=>cls.has(c),add:c=>{cls.add(c);obs&&obs();},remove:c=>{cls.delete(c);obs&&obs();}}};
  const win={document:{readyState:'complete',body},setTimeout:f=>f(),
    MutationObserver:function(cb){this.observe=()=>{obs=cb;};},
    __setTilt(on,opts){calls.push([!!on,!!(opts&&opts.transient)]);if(on)cls.add('bc-tilt3d');else cls.delete('bc-tilt3d');},
    __meetSeed(){cls.add('meet-mode');return true;},
    __meetingFromMatch(){cls.add('meet-mode');return Promise.resolve(true);}};
  return {win,cls,calls,body};
}

test('보관함 «미팅 만들기» — 3D 였으면 평면으로(기기 설정은 그대로) · 나가면 3D 로',()=>{
  const {win,cls,calls,body}=fake();cls.add('bc-tilt3d');
  L.install(win);
  assert.equal(win.__meetSeed(),true);
  assert.equal(cls.has('bc-tilt3d'),false,'평면');
  assert.deepEqual(calls,[[false,true]],'transient — ps_board_tilt3d 를 쓰지 않는다');
  body.classList.remove('meet-mode');
  assert.equal(cls.has('bc-tilt3d'),true,'나가면 들어오기 전 보기');
  assert.deepEqual(calls[1],[true,true]);
});

test('경기 «＋ 새 미팅»도 평면 · 평면이던 기기는 건드리지 않는다',async()=>{
  let f=fake();f.cls.add('bc-tilt3d');L.install(f.win);
  await f.win.__meetingFromMatch({template:true});await Promise.resolve();
  assert.equal(f.cls.has('bc-tilt3d'),false);
  f=fake();L.install(f.win);
  f.win.__meetSeed();f.body.classList.remove('meet-mode');
  assert.deepEqual(f.calls,[],'처음부터 평면이면 아무것도 안 한다');
});

test('미팅 안에서 코치가 고른 보기는 나갈 때 되돌리지 않는다',()=>{
  const {win,cls,calls,body}=fake();cls.add('bc-tilt3d');L.install(win);
  win.__meetSeed();
  win.__setTilt(false);   // 코치가 직접 평면(기기 설정에 저장)
  body.classList.remove('meet-mode');
  assert.equal(cls.has('bc-tilt3d'),false,'그대로 평면');
  assert.equal(calls.filter(c=>c[0]===true).length,0);
});

test('작전판이 이 모듈을 읽고, 앱이 오프라인에도 싣는다',()=>{
  assert.ok(read('studio/board.html').includes('<script src="board-meet-look.js"></script>'));
  assert.ok(read('sw.js').includes("'/studio/board-meet-look.js'"));
});
