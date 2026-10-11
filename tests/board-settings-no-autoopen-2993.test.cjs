'use strict';
/* 2.993 — 보드 설정은 저절로 열리지 않는다(사용자 «보드 설정은 자동으로 열리지 않게»).
   예전(2.220~2.732): 데스크톱에서 한 번 열어 두면 ps_board_settings_pinned_v1='1' 로 기억해 ① 셸 부팅 끝 ② 보드 준비 직후
   ③ 셸이 보드 화면을 보일 때마다(sync) 다시 열었다. 이제 여는 길은 사람이 누르는 것뿐이다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const board=fs.readFileSync(path.join(__dirname,'../studio/board.html'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../studio/app.html'),'utf8');
function fnAt(src,start){const i=src.indexOf(start);assert.ok(i>=0,start);let j=src.indexOf('{',i),d=0;for(;j<src.length;j++){if(src[j]==='{')d++;else if(src[j]==='}'&&--d===0)break;}return src.slice(i,j+1);}

function settings(pinnedMode){
  const calls=[],store={ps_board_settings_pinned_v1:'1'};   /* 옛 기억이 남아 있는 기기 */
  const c={calls,activePop:null,panel:{id:'cmd-board-settings-pop'},view:{},tabs:{querySelector:()=>null},viewTab:{focus(){}},
    localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>{store[k]=String(v);}},store,
    bsPinnedMode:()=>pinnedMode,place:()=>calls.push('place'),closeCustom(){calls.push('close');c.activePop=null;},
    toggleCustom(p){calls.push('open');c.activePop=p;},notifyBoardSettings(){},fieldSync(){},requestAnimationFrame(){}};
  vm.createContext(c);
  vm.runInContext('var activePop=null;'+fnAt(board,'    function toggleSettings(action,trusted){')+';this.toggle=toggleSettings;this.pop=function(){return activePop;};this.setPop=function(p){activePop=p;};',c);
  /* toggleSettings 는 클로저의 activePop 을 본다 — 열고 닫는 함수가 그 값을 바꾸게 잇는다 */
  c.toggleCustom=p=>{calls.push('open');c.setPop(p);};c.closeCustom=()=>{calls.push('close');c.setPop(null);};
  return c;
}

test('the shell’s sync never opens board settings, even with an old “pinned” memory on a desktop',()=>{
  for(const pinned of [true,false]){
    const c=settings(pinned);c.toggle('sync');
    assert.deepEqual(c.calls,[],'pinnedMode='+pinned);assert.equal(c.pop(),null);
  }
});
test('sync only re-places a panel the person already opened',()=>{
  const c=settings(true);c.toggle('toggle',true);assert.deepEqual(c.calls,['open']);
  c.toggle('sync');assert.deepEqual(c.calls,['open','place']);
});
test('opening and closing by hand still works and writes no memory',()=>{
  const c=settings(true);c.store.ps_board_settings_pinned_v1='0';
  c.toggle('toggle',true);assert.equal(c.pop().id,'cmd-board-settings-pop');
  c.toggle('toggle',true);assert.equal(c.pop(),null);
  assert.equal(c.store.ps_board_settings_pinned_v1,'0','nothing remembers «open» for the next boot');
});
test('no boot path reopens it from memory (board ready · shell boot)',()=>{
  assert.doesNotMatch(board,/getItem\(["']ps_board_settings_pinned_v1["']\)/,'board.html never reads the old memory');
  assert.doesNotMatch(app,/getItem\(["']ps_board_settings_pinned_v1["']\)/,'app.html never reads the old memory');
  assert.doesNotMatch(app,/__pinOpen/);
  assert.doesNotMatch(board,/function bsRemember|[;{)]\s*bsRemember\(/,'nothing writes it either');
});
