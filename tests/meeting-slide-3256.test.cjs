// 3.256 — 미팅 슬라이드 넘김: 같은 팀 · 같은 역할 · 같은 번호만 잇고, 나머지는 사라지고 나타난다(board-meet-slide.js).
// 사용자 제보(2026-11-04): 슬라이드를 넘길 때 토큰 색이 막 바뀌고 흔적이 남으며 이상하게 넘어간다.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const S=require('../studio/board-meet-slide.js');
const root=path.join(__dirname,'..');

const US=[1,3,4,5,2,6,8,10,7,9,11],OP=[1,2,4,5,3,7,8,6,11,9,10];
function team(team,nums,from,extra){return nums.map((n,i)=>Object.assign({id:from+i,team,num:String(n),x:100+i*10,y:200+i*5},extra||{}));}
function snap(players,more){return Object.assign({players,equipment:[],drawings:[],ball:null,teamColors:{blue:'#ffffff'}},more||{});}
const ids=a=>a.map(p=>p.id);

test('열쇠: 팀 · 역할 · 번호 — 리저브와 선발, 다른 팀은 같은 번호여도 다른 선수',()=>{
  assert.equal(S.key({id:1003,team:'blue',num:'10'}),'blue||#10');
  assert.notEqual(S.key({id:1,team:'blue',num:'10'}),S.key({id:2,team:'red',num:'10'}));
  assert.notEqual(S.key({id:1,team:'blue',num:'10'}),S.key({id:2,team:'blue',num:'10',meetingRole:'reserve'}));
  assert.equal(S.key({id:1,team:'blue',num:' 7 '}),S.key({id:99,team:'blue',num:'7'}),'번호 앞뒤 칸은 같은 번호');
  assert.equal(S.key({id:5,team:'blue',num:''}),'blue||@5','번호가 없으면 같은 팀 같은 id');
  assert.equal(S.key({id:5,team:'blue',coach:true,num:''}),'blue|c|@5');
});

test('BEST 11 → RESERVE: 잇지 않는다 — 선발은 사라지고 리저브가 나타난다(id 그대로)',()=>{
  const a=snap(team('blue',US,1001)),b=snap(team('blue',US,2001,{meetingRole:'reserve'}));
  const al=S.align(a,b,'slide');
  assert.deepEqual(ids(al.a.players),ids(a.players),'겹치지 않는 id 는 그대로');
  assert.deepEqual(Object.keys(al.out).map(Number).sort(),ids(a.players));
  assert.deepEqual(Object.keys(al.inn).map(Number).sort(),ids(b.players));
  assert.equal(al.whole,false,'사라지고 나타나는 쪽이 다 있으면 차례로');
  const early=S.fades(al,.25),late=S.fades(al,.75);
  assert.equal(early['1001'],.5);assert.equal(early['2001'],0,'앞 절반엔 나타날 토큰이 안 보인다');
  assert.equal(late['1001'],0,'뒤 절반엔 사라진 토큰이 안 보인다');assert.equal(late['2001'],.5);
});

test('겹친 id 의 다른 팀(경기 상대 분석 장 1001~ 빨강) — 날아가 색이 바뀌지 않는다',()=>{
  const a=snap(team('blue',US,1001)),b=snap(team('red',OP,1001));
  const al=S.align(a,b,'slide');
  assert.ok(al.a.players.every(p=>p.id<0),'앞 장 토큰은 다음 장 id 와 겹치지 않는 새 id 로');
  assert.equal(new Set(ids(al.a.players)).size,11);
  assert.ok(al.a.players.every(p=>p.team==='blue'));
  assert.deepEqual(Object.keys(al.inn).map(Number).sort(),ids(b.players));
  assert.deepEqual(a.players.map(p=>p.id),ids(team('blue',US,1001)),'원문은 그대로');
});

test('같은 팀 · 같은 번호는 id 가 달라도 이어 움직인다(경기 선발 11 ↔ 기본 장)',()=>{
  const a=snap([{id:1001,team:'blue',num:'1',x:10,y:10},{id:1002,team:'blue',num:'10',x:20,y:20},{id:1003,team:'blue',num:'4',x:30,y:30}]);
  const b=snap([{id:1001,team:'blue',num:'1',x:11,y:11},{id:1003,team:'blue',num:'10',x:50,y:50},{id:1008,team:'blue',num:'4',x:60,y:60}]);
  const al=S.align(a,b,'slide');
  assert.deepEqual(al.a.players.map(p=>[p.num,p.id,p.x]),[['1',1001,10],['10',1003,20],['4',1008,30]],'자리는 앞 장 것, id 는 다음 장 것');
  assert.deepEqual(al.out,{});assert.deepEqual(al.inn,{});
});

test('같은 열쇠가 둘이면 나온 순서대로 · 남는 것은 사라짐/나타남',()=>{
  const a=snap([{id:1,team:'blue',num:'7',x:0,y:0},{id:2,team:'blue',num:'7',x:5,y:5},{id:3,team:'blue',num:'7',x:9,y:9}]);
  const b=snap([{id:10,team:'blue',num:'7',x:1,y:1},{id:11,team:'blue',num:'7',x:2,y:2}]);
  const al=S.align(a,b,'slide');
  assert.deepEqual(al.a.players.map(p=>p.id),[10,11,3]);
  assert.deepEqual(Object.keys(al.out),['3']);assert.deepEqual(al.inn,{});
  assert.equal(al.whole,true,'사라지기만 하고 겉모습이 같으면 처음부터 끝까지 서서히');
  assert.equal(S.fades(al,.25)['3'],.75);
});

test('id 가 서로 엇갈려도 겹치지 않는다(이어진 토큰이 가져간 id 를 남은 토큰이 쓰지 않음)',()=>{
  const a=snap([{id:5,team:'blue',num:'9'},{id:7,team:'red',num:'3'}]);
  const b=snap([{id:7,team:'blue',num:'9'}]);
  const al=S.align(a,b,'slide');
  assert.equal(al.a.players[0].id,7);assert.ok(al.a.players[1].id<0);
  assert.equal(new Set(ids(al.a.players)).size,2);
});

test('앞 장의 참조(시선 · 토큰에 묶인 그림 끝)도 새 id 를 따른다 · 원문 그림은 그대로',()=>{
  const d={type:'pass',pts:[{x:0,y:0},{x:1,y:1}],tk:[1001,null]};
  const a=snap([{id:1001,team:'blue',num:'9',lookAt:1002},{id:1002,team:'red',num:'4'}],{drawings:[d]});
  const b=snap([{id:1001,team:'red',num:'4'},{id:1002,team:'blue',num:'9'}]);
  const al=S.align(a,b,'slide');
  assert.deepEqual(al.a.players.map(p=>p.id),[1002,1001]);
  assert.equal(al.a.players[0].lookAt,1001,'시선 대상(빨강 4)의 새 id');
  assert.deepEqual(al.a.drawings[0].tk,[1002,null]);assert.deepEqual(d.tk,[1001,null],'원문 그림은 고치지 않는다');
});

test('잔상 · 사라지는 토큰의 시야는 경계에서 그리지 않는다(사본만)',()=>{
  const a=snap([{id:1,team:'blue',num:'9',trail:3,vis:true},{id:2,team:'blue',num:'5',vis:true}]),b=snap([{id:1,team:'blue',num:'9',trail:3},{id:9,team:'red',num:'2',vis:true}],{ball:{x:1,y:1,trail:2}});
  const al=S.align(a,b,'slide');
  assert.ok(al.a.players.every(p=>!p.trail));assert.equal(al.a.players[1].vis,undefined);assert.equal(al.a.players[0].vis,true,'이어지는 선수의 시야는 그대로');
  assert.ok(al.b.players.every(p=>!p.trail));assert.equal(al.b.players[1].vis,undefined);assert.ok(!al.b.ball.trail);
  assert.equal(b.players[0].trail,3);assert.equal(b.ball.trail,2);assert.equal(b.players[1].vis,true);
  assert.deepEqual(ids(al.b.players),ids(b.players),'다음 장 id 는 그대로(끝 프레임 = 원문)');
});

test('유니폼 · 토큰 크기는 한가운데에서 다음 장 값으로(리저브만 옛 색인 미팅)',()=>{
  const a=snap(team('blue',US,2001,{meetingRole:'reserve'}),{teamColors:{blue:'#1a2f5c'},tokenScale:.5});
  const b=snap(team('blue',US,1001).concat(team('red',OP,1012)),{teamColors:{blue:'#ffffff'},tokenScale:.6,tokV:2});
  const al=S.align(a,b,'slide');
  assert.equal(S.pick(al,.49).a.teamColors.blue,'#1a2f5c');
  assert.equal(S.pick(al,.5).a.teamColors.blue,'#ffffff');assert.equal(S.pick(al,.5).a.tokenScale,.6);assert.equal(S.pick(al,.5).a.tokV,2);
  assert.equal(al.whole,false);
  for(const id of ids(b.players))assert.equal(S.fades(al,.49)[String(id)],0,'다음 장 색이 오기 전엔 나타나지 않는다');
});

test('공: 한쪽에만 있으면 사라짐/나타남 · «페이드»는 잇지 않고 공도 제자리에서',()=>{
  const a=snap(team('blue',[9],1),{ball:{x:0,y:0}}),b=snap(team('blue',[9],1));
  let al=S.align(a,b,'slide');assert.equal(al.ballOut,true);assert.equal(S.fades(al,.3).ball,.7);
  al=S.align(b,a,'slide');assert.equal(al.ballIn,true);
  const c=snap(team('blue',[9],1),{ball:{x:50,y:50}});
  al=S.align(a,c,'fade');
  assert.deepEqual(al.out,{'-1':1});assert.deepEqual(al.inn,{'1':1},'«페이드»는 같은 선수도 잇지 않는다');
  assert.equal(al.ballBoth,true);
  assert.deepEqual(S.pick(al,.2).b.ball,{x:0,y:0},'앞 절반 공은 앞 자리');assert.deepEqual(S.pick(al,.7).a.ball,{x:50,y:50},'뒤 절반 공은 다음 자리');
  assert.equal(S.fades(al,.25).ball,.5);assert.equal(S.fades(al,.75).ball,.5);
});

test('표지에서 나올 때(blank): 표지 밑 판은 잇지 않고 다음 장이 처음부터 서서히',()=>{
  const a=snap(team('blue',US,1001)),b=snap(team('blue',US,1001));
  const al=S.align(a,b,'slide',{blank:true});
  assert.deepEqual(al.a.players,[]);assert.equal(Object.keys(al.inn).length,11);assert.equal(al.whole,true);
  assert.equal(S.fades(al,.3)['1001'],.3);
});

test('경계 기록은 넘기는 두 판(객체)에만 — 장면 사이 보간은 그대로',()=>{
  const a=snap([]),b=snap([]),c=snap([]);
  assert.ok(S.edge(a,b,'slide'));assert.ok(S.find(a,b));assert.equal(S.find(b,c),null);assert.equal(S.find(a,c),null);
  assert.equal(S.edge(a,a,'slide'),null);
  // exportMeetingVideo 의 모양: 표지(0)와 그다음 장의 첫 장면은 cut
  const seq=[{snap:snap([]),capNo:0,cut:true},{snap:snap([]),capNo:1,cut:true},{snap:snap([]),capNo:1},{snap:snap([]),capNo:2},{snap:snap([]),capNo:3,cut:true}];
  assert.equal(S.edges(seq),1,'다른 슬라이드의 첫 장면으로 넘어가는 칸만(표지 칸 · 같은 슬라이드 장면 제외)');
  assert.ok(S.find(seq[2].snap,seq[3].snap));assert.equal(S.find(seq[1].snap,seq[2].snap),null);assert.equal(S.find(seq[3].snap,seq[4].snap),null);
});

test('renderInterp 감싸기: 경계면 맞춘 사본 · 잔상 새로 · 투명도, 아니면 원래 그대로',()=>{
  const calls=[],resets=[];const layer={children:[]};
  const mk=id=>{const at={'data-id':String(id)};return {getAttribute:k=>at[k]??null,hasAttribute:k=>k in at,setAttribute:(k,v)=>{at[k]=v;},at};};
  const win={document:{getElementById:id=>id==='tokenLayer'?layer:null},__trailLive:1,trailReset:()=>resets.push(1),
    renderInterp:function(a,b,u){calls.push({a,b,u});layer.children=a.players.concat(b.players).map(p=>mk(p.id));}};
  assert.equal(S.install(win),true);assert.equal(S.install(win),false,'한 번만');
  const a=snap(team('blue',US,1001)),b=snap(team('blue',US,2001,{meetingRole:'reserve'})),c=snap(team('blue',US,1001));
  win.renderInterp(a,c,.3);
  assert.equal(calls[0].a,a,'기록 없는 보간은 원래 판 그대로');assert.equal(resets.length,0);
  S.edge(a,b,'slide');win.renderInterp(a,b,.25);
  assert.notEqual(calls[1].a,a);assert.equal(win.__trailLive,0);assert.equal(resets.length,1);
  const op=Object.fromEntries(layer.children.map(g=>[g.at['data-id'],g.at.opacity]));
  assert.equal(op['1001'],'0.5');assert.equal(op['2001'],'0');
  win.renderInterp(a,b,.6);assert.equal(resets.length,1,'잔상은 경계 첫 프레임에서 한 번');
  win.renderInterp(a,b,0);assert.equal(resets.length,2,'다시 처음부터 그리면(영상 두 번째 패스) 다시 새로');
});

test('board.html 이 경계를 알린다 · 넘기는 중에는 슬라이드에 판을 담지 않는다 · 모듈이 실린다',()=>{
  const b=fs.readFileSync(path.join(root,'studio/board.html'),'utf8');
  const fn=name=>{const i=b.indexOf('function '+name+'(');assert.ok(i>=0,name);return b.slice(i,b.indexOf('\n  }',i)+4);};
  assert.match(fn('meetSettle'),/cancelAnimationFrame\(meetRaf\)[\s\S]*loadSnap\(meetTo\)/);
  assert.match(fn('meetStore'),/__meetVideoBusy\)return;meetSettle\(\);/,'meetStore 는 먼저 넘기던 판을 끝낸다');
  const step=fn('meetStep');
  assert.match(step,/meetAutoTok\+\+;meetSettle\(\);/);
  assert.match(step,/__ksTransition\|\|"slide"/,'←→ 도 «전환» 고르개를 따른다');
  assert.match(step,/PSMeetSlide\.live\(from,to,tr\)/);
  const go=b.slice(b.indexOf('go:function(i,which){'),b.indexOf('go:function(i,which){')+1600);
  assert.match(go,/meetAutoTok\+\+;meetSettle\(\);var from=meetCap\(\)/);
  assert.match(go,/meetTo=to;if\(window\.PSMeetSlide\)PSMeetSlide\.live\(from,to,tr\)/);
  assert.match(go,/meetRaf=null;meetTo=null;loadSnap\(to\)/);
  const ex=b.slice(b.indexOf('async function exportMeetingVideo('),b.indexOf('async function exportMeetingVideo(')+2400);
  assert.match(ex,/PSMeetSlide\.edges\(seq\)/);
  assert.match(b,/<script src="board-meet-reserve\.js"><\/script><script src="board-meet-slide\.js"><\/script>/);
  assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),/'\/studio\/board-meet-slide\.js'/);
  assert.match(fs.readFileSync(path.join(root,'tests/browser/run-critical.mjs'),'utf8'),/meeting-slide-transition/);
});
