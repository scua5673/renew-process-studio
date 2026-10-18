'use strict';
/* 3.096 — 사용자 «중계화면으로 애니메이션하면 라인이 벗어나» → «중계화면은 빼자».
   3D 의 «중계» 카메라(재생 중 공을 따라가며 판을 키우는 화면)를 걷는다: 보드 설정 › 카메라와 위쪽 보기 단추에서 빠지고,
   이 기기에 «중계»로 저장된 값(ps_tilt3d_opts_v1.cam='tv')은 «보통»으로 읽힌다. 3D «사람» 동작(board-broadcast.js 의 motion · pose)은 그대로. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const topbar=fs.readFileSync(path.join(__dirname,'../studio/board-topbar.js'),'utf8');
const tb=require('../studio/board-topbar.js');
function fnAt(src,start){const i=src.indexOf(start);assert.ok(i>=0,start);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(i,j+1);}
test('no «중계» choice is left in board settings or the top bar',()=>{
  assert.doesNotMatch(board,/data-cam="tv"/);
  assert.doesNotMatch(topbar,/data-v="tv"/);
  assert.match(board,/<button type="button" data-cam="low"[^>]*>낮게<\/button><button type="button" data-cam="mid"[^>]*>보통<\/button><button type="button" data-cam="high"[^>]*>높게<\/button><\/div>/,'카메라 = 낮게 · 보통 · 높게');
  assert.equal(tb.viewOf(true,'tv'),'3d');
});
test('a device that saved the broadcast camera opens the normal 3D camera',()=>{
  const i=board.indexOf('  var TILT_CAM={'),j=board.indexOf('\n',board.indexOf('function tiltOptsRead(){',i));
  assert.ok(i>0&&j>i);
  const tableLine=board.slice(i,board.indexOf('\n',i));
  const read=fnAt(board,'function tiltOptsRead(){');
  const store={ps_tilt3d_opts_v1:JSON.stringify({cam:'tv',deco:'simple',mood:'day'})};
  const c={JSON,localStorage:{getItem:k=>store[k]??null},TILT_PAD:{full:1,simple:1,grass:1},TILT_MOOD:{night:1,day:1,dusk:1}};
  vm.createContext(c);vm.runInContext(tableLine+';'+read+';this.o=tiltOptsRead();',c);
  assert.equal(c.o.cam,'mid','중계 → 보통');
  assert.equal(c.o.deco,'simple','다른 3D 설정은 그대로');assert.equal(c.o.mood,'day');
});
