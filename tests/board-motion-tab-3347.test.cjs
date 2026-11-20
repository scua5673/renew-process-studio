// 3.347 — 사용자 11/21 «잔상 · 시선을 보드 설정에서 쉽게»(FmStadio 1.8 영상 → 목업 B안 «움직임» 탭).
// 묶음(공 · 판 위의 팀)마다 잔상 길이 · 공 보기를 한 번에 적는 순수 셈. 값은 토큰에 그대로(trail · lookAt · dirMark).
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../studio/board-motion-marks.js');
const T=require('../studio/board-teams.js');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const board=()=>({ball:{id:'ball',x:5,y:5},players:[{id:1,team:'blue'},{id:2,team:'red'},{id:3,team:'blue'},{id:4,team:'blue',coach:true},{id:5,team:'cone'},{id:6,team:'yellow'},null]});

test('묶음 — 공이 먼저, 팀은 판에 놓인 차례 · 코치와 팀 아닌 토큰은 빼고',()=>{
  const g=M.fieldOf(board(),T.has);
  assert.deepEqual(g.map(x=>[x.key,x.toks.map(p=>p.id)]),[['ball',['ball']],['blue',[1,3]],['red',[2]],['yellow',[6]]]);
  assert.deepEqual(M.fieldOf({players:[]},T.has),[],'an empty board has no groups');
  assert.deepEqual(M.fieldOf(null,T.has),[]);
});

test('잔상 — 묶음에 같은 길이를 적고 바뀐 토큰만 돌려준다 · 끄면 칸을 지운다',()=>{
  const st=board(),blue=M.fieldOf(st,T.has)[1].toks;
  blue[0].trail=3;
  assert.equal(M.trailOf(blue),-1,'mixed values read as -1');
  assert.deepEqual(M.setTrail(blue,3).map(p=>p.id),[3],'only the token that changed');
  assert.equal(M.trailOf(blue),3);
  assert.equal(st.players[1].trail,undefined,'the other team is untouched');
  assert.equal(M.setTrail(blue,9).length,2);assert.equal(M.trailOf(blue),5,'clamped to five');
  assert.equal(M.setTrail(blue,0).length,2);
  assert.ok(!('trail' in blue[0])&&!('trail' in blue[1]),'off removes the field');
  assert.equal(M.trailOf(blue),0);assert.equal(M.trailOf([]),0);
});

test('공 보기 — lookAt ball + 방향 표식, 부채꼴은 켜지 않는다 · 끄면 이 길로 켠 것만 걷는다',()=>{
  const st=board(),blue=M.fieldOf(st,T.has)[1].toks;
  assert.equal(M.lookOf(blue),'off');
  blue[1].vis=true;   // 부채꼴을 따로 켜 둔 선수
  assert.equal(M.setLook(blue,true).length,2);
  assert.deepEqual(blue.map(p=>[p.lookAt,!!p.dirMark,!!p.vis]),[['ball',true,false],['ball',false,true]],'a cone already shows the direction — no extra mark, and no cone is added');
  assert.equal(M.lookOf(blue),'ball');
  assert.equal(M.setLook(blue,true).length,0,'pressing the same value changes nothing');
  assert.ok(M.marked(blue[0],false),'the triangle is the 3.302 direction mark');
  blue[0].lookAt=2;assert.equal(M.lookOf(blue),'mix','looking at another player is neither off nor «공 보기»');
  blue[0].lookAt='ball';
  assert.equal(M.setLook(blue,false).length,2);
  assert.deepEqual(blue.map(p=>[p.lookAt,!!p.dirMark,!!p.vis,p.dirBall]),[[undefined,false,false,1],[undefined,false,true,1]],'look and mark are gone · the cone the coach turned on stays');
  const fixed={id:9,team:'blue',lookAt:'ball',dirMark:true,dirFix:1};M.setLook([fixed],false);assert.equal(fixed.dirBall,undefined,'a fixed direction stays fixed');
});

test('배선 — 탭은 모듈이 붙인다(board.html 그대로) · 값은 원래 길로 퍼진다',()=>{
  const src=read('studio/board-motion-marks.js');
  assert.match(src,/api\.installTab\(root\)/);
  assert.match(src,/cmd-board-settings-motion-tab/);
  assert.match(src,/call\('_tokPropAll', ch, \['trail'\]\)/,'trail goes to every scene the way the «잔상» button does');
  assert.match(src,/call\('_tokPropAll', ch, \['lookAt', 'dirMark', 'dirBall'\]\)/);
  assert.match(src,/call\('pushUndo'\)/,'one undo step per press');
  assert.doesNotMatch(read('studio/board.html'),/cmd-board-settings-motion-tab/,'board.html is untouched');
  const added=src.slice(src.indexOf('③ 보드 설정'));
  assert.doesNotMatch(added,/catch\s*\(\s*_?\s*\)\s*\{\s*\}/,'no empty catch in the new part');
});
