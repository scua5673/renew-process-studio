// 제보 5400cd9e — 저장 팀 불러오기는 판 위 토큰 자리를 그대로 두고 포지션대로 이름·번호만 입힌다(studio/team-load.js).
const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('../studio/team-load.js');

// [nx, ny, 번호, 포지션] — 4-4-2 처럼 4-3-3 이 아닌 판(위쪽 ny 가 작은 쪽 = 왼쪽)
const S442=[[.045,.5,1,'GK'],[.15,.15,3,'LB'],[.15,.38,4,'LCB'],[.15,.62,5,'RCB'],[.15,.85,2,'RB'],
  [.30,.16,7,'LM'],[.30,.40,8,'LCM'],[.30,.60,6,'RCM'],[.30,.84,11,'RM'],[.44,.40,9,'ST'],[.44,.60,10,'ST']];
const P=(pos,name)=>({no:'',name:name||pos,pos});
function byPos(slots,players,r){return Object.fromEntries(slots.map((s,i)=>[s[3]+'@'+s[1],r.pick[i]>=0?players[r.pick[i]].name:null]));}

test('정확한 포지션 → 같은 기본(CB) → 가까운 자리(윙어 ↔ 측면 미드) 순서로 판 위 자리에 맞춘다',()=>{
  const players=[P('GK'),P('CB','CB1'),P('CB','CB2'),P('LB'),P('RB'),P('CM','CM1'),P('CM','CM2'),P('LW'),P('RW'),P('CF','CF1'),P('ST','ST1')];
  const r=L.match(S442,players);
  const m=byPos(S442,players,r);
  assert.equal(m['GK@0.5'],'GK');
  assert.equal(m['LCB@0.38'],'CB1');
  assert.equal(m['RCB@0.62'],'CB2');
  assert.equal(m['LM@0.16'],'LW');
  assert.equal(m['RM@0.84'],'RW');
  assert.equal(m['LCM@0.4'],'CM1');
  assert.equal(m['RCM@0.6'],'CM2');
  assert.equal(m['ST@0.4'],'ST1','정확히 ST 인 선수가 먼저');
  assert.equal(m['ST@0.6'],'CF1','CF 는 ST 자리로');
  assert.deepEqual(r.extra,[]);
});

test('정확히 같은 자리가 기본 코드보다 먼저 — 목록 앞의 CB 가 LCB 자리를 가로채지 않는다',()=>{
  const slots=[[.15,.38,4,'LCB'],[.15,.5,5,'CB']],players=[P('CB','중앙'),P('LCB','왼쪽')];
  const r=L.match(slots,players);
  assert.deepEqual(r.pick,[1,0]);
});

test('CDM · CAM 같은 표기도 DM · AM 자리로',()=>{
  const slots=[[.24,.5,6,'DM'],[.38,.5,10,'AM']],players=[P('CAM'),P('CDM')];
  assert.deepEqual(L.match(slots,players).pick,[1,0]);
});

test('맞는 자리가 없는 선수는 남은 자리에 목록 순서대로 — 필드 선수는 골키퍼 자리를 마지막에',()=>{
  const slots=[[.045,.5,1,'GK'],[.15,.5,4,'CB'],[.3,.2,7,'LM'],[.44,.5,9,'ST']];
  const r=L.match(slots,[P('ST','A'),P('','이름만'),P('CB','B'),P('ST','C')]);
  assert.deepEqual(r.pick,[3,2,1,0],'이름만 있는 선수는 남은 필드 자리(LM)로, GK 자리는 다른 자리가 다 찬 뒤에야');
  assert.deepEqual(r.extra,[]);
  const r2=L.match(slots,[P('ST','A'),P('CB','B'),P('LW','C'),P('','D'),P('','E')]);
  assert.deepEqual(r2.pick,[3,1,2,0],'LW 는 LM 자리로, 필드 자리가 다 찬 뒤 남은 선수가 GK 자리로');
  assert.deepEqual(r2.extra,[4],'그래도 남으면 대기');
});

test('토큰보다 많은 선수는 extra — 대기 줄은 16명마다 한 줄 위, 자리가 겹치지 않는다',()=>{
  const players=Array.from({length:30},(_,i)=>P(i?'CM':'GK','선수'+i));
  const p=L.plan(S442,players,{keep:true});
  assert.equal(p.bench,19);
  assert.equal(p.add.length,19,'판 위 자리는 새로 만들지 않는다');
  assert.ok(p.add.every(a=>a.bench));
  const keys=new Set(p.add.map(a=>a.x.toFixed(3)+','+a.y.toFixed(3)));
  assert.equal(keys.size,19);
  assert.deepEqual(L.bench(0),[0.955,0.965]);
  assert.equal(L.bench(16)[1],0.965-0.05);
});

test('판이 비었으면 포메이션 자리에 새로 놓고 빈 자리는 비워 둔다',()=>{
  const players=[P('GK','골키퍼'),P('LCB','왼쪽 수비'),P('ST','공격수')];
  const p=L.plan(S442,players,{keep:false});
  assert.equal(p.bench,0);
  assert.deepEqual(p.add.map(a=>[a.p.name,a.x,a.y]),[['골키퍼',.045,.5],['왼쪽 수비',.15,.38],['공격수',.44,.4]]);
});

test('작전판의 포지션 함수(한글 이름)를 넘기면 그것으로 읽는다',()=>{
  const code=v=>({'센터백':'CB','왼쪽 윙':'LW'})[v]||L.code(v);
  const slots=[[.15,.5,4,'CB'],[.43,.15,7,'LW']],players=[P('왼쪽 윙','윙'),P('센터백','수비')];
  assert.deepEqual(L.match(slots,players,{code}).pick,[1,0]);
});

test('토큰에 입힐 때 위치 · id · 사진 · 포지션 표시는 그대로, 선수가 없으면 이름만 비운다',()=>{
  const t={id:7,team:'blue',num:4,pos:'LCB',x:123,y:45,img:'data:image/png;base64,AA',name:'예전'};
  L.dress(t,{no:'15',name:' 새 선수 ',pos:'CB'});
  assert.deepEqual(t,{id:7,team:'blue',num:'15',pos:'LCB',x:123,y:45,img:'data:image/png;base64,AA',name:'새 선수'});
  L.dress(t,{no:'',name:'번호 없음',pos:'CB'});
  assert.equal(t.num,'15','등번호가 비어 있으면 토큰 번호를 지킨다');
  const blank={id:8,num:3,pos:'',x:1,y:2};L.dress(blank,{name:'A',pos:'RB'});assert.equal(blank.pos,'RB','포지션 표시가 없던 토큰만 채운다');
  L.dress(t,undefined);
  assert.equal(t.name,null);assert.equal(t.x,123);assert.equal(t.num,'15');
});

test('다른 장면도 같은 토큰(id)은 이름을 같이 — 장면 묶음은 새 객체라 되돌리기 사본은 그대로',()=>{
  const old={players:[{id:1,name:null,num:1,pos:'GK',x:5,y:5},{id:9,team:'red',name:'상대',x:1,y:1}],ball:{x:0,y:0}};
  const list=[{snap:{players:[]}},{snap:old,thumb:'<svg/>'}];
  const undoCopy=list.map(f=>Object.assign({},f));
  const toks=[{id:1,name:'골키퍼',num:'21',pos:'GK',x:50,y:50}],fresh=[{id:30,team:'blue',name:'대기',num:'30',pos:'',x:9,y:9}];
  assert.equal(L.frames(list,0,toks,fresh),1,'지금 장면(0)은 건너뛴다');
  assert.deepEqual(list[0].snap.players,[]);
  assert.deepEqual(list[1].snap.players.map(q=>[q.id,q.name,q.num,q.x]),[[1,'골키퍼','21',5],[9,'상대',undefined,1],[30,'대기','30',9]],'다른 장면의 위치는 그 장면 것');
  assert.equal(list[1].thumb,undefined);
  assert.equal(list[1].snap.ball,old.ball);
  assert.notEqual(list[1].snap,old);
  assert.equal(undoCopy[1].snap.players[0].name,null,'되돌리기 사본은 바뀌지 않는다');
  assert.equal(L.frames(undefined,0,toks,fresh),0);
});

// 3.137 — 오류 제보 738f37d1 «팀 불러오기 시, 모든 장면에 적용». 같은 선수 찾기(who) · 장면에 입히기(wear) — 판 전체에 퍼뜨리기는 board-tweaks.js 8,
// 화면 흐름은 tests/browser/team-load-all-scenes.mjs.
{
  const T=(id,num,name,pos,extra)=>Object.assign({id,team:'blue',num,name,pos},extra||{});
  test('who · wear — id 먼저, 아니면 같은 팀의 불러오기 전 번호(포메이션을 다시 놓은 장면은 id 가 다르다)',()=>{
    const gk=T(50,'21','골키퍼','GK'),lb=T(51,'4','왼풀백','LB');   // 입힌 토큰(새 번호)
    const find=L.who([{t:gk,team:'blue',key:'1'},{t:lb,team:'blue',key:'3'}]);
    const sn={players:[T(1,'1',null,'GK',{x:5}),T(3,'3',null,'LB',{x:9}),{id:9,team:'red',num:'1',name:null},T(50,'99',null,'')]};
    const keep=sn.players;const w=L.wear(sn,find,false);
    assert.deepEqual(w.players.map(q=>[q.id,q.num,q.name,q.pos,q.x]),[[1,'21','골키퍼','GK',5],[3,'4','왼풀백','LB',9],[9,'1',null,undefined,undefined],[50,'21','골키퍼','GK',undefined]]);
    assert.equal(w.was,keep);assert.equal(keep[0].name,null,'옛 객체는 그대로(되돌리기 사본)');assert.equal(w.players[2],keep[2],'상대 팀은 같은 객체 그대로');
  });
  test('who — 미팅 슬라이드는 번호 먼저(2.970), 번호가 없을 때만 id',()=>{
    const a=T(7,'10','A','CM'),b=T(8,'9','B','ST');const find=L.who([{t:a,team:'blue',key:'8'},{t:b,team:'blue',key:'9'}]);
    assert.equal(find(T(8,'8',null,''),true),a,'id 8 이어도 미팅은 번호 8 → A');
    assert.equal(find(T(8,'8',null,''),false),b,'작업 보드는 id 먼저');
    assert.equal(find(T(7,'',null,''),true),a,'번호가 없으면 id');
    assert.equal(find(Object.assign(T(8,'9',null,''),{team:'red'}),false),null,'다른 팀은 같은 id · 번호여도 아니다');
  });
  test('who — 두 토큰이 같이 쓰던 번호 · 코치 · 새로 놓은 토큰은 번호로 찾지 않는다',()=>{
    const a=T(1,'5','A',''),b=T(2,'6','B',''),fresh=T(30,'7','후보','');
    const find=L.who([{t:a,team:'blue',key:'4'},{t:b,team:'blue',key:'4'},{t:fresh,team:'blue',key:'8'}],[30]);
    assert.equal(find(T(9,'4',null,'')),null,'번호 4 를 둘이 썼다');
    assert.equal(find(T(1,'4',null,'')),a,'id 는 그대로 찾는다');
    assert.equal(find(T(30,'4',null,'')),null,'새로 놓은 토큰의 사본은 건너뛴다');
    assert.equal(find(T(12,'8',null,'')),null,'새로 놓은 토큰의 번호로는 찾지 않는다');
    assert.equal(find(Object.assign(T(1,'4',null,''),{coach:true})),null,'코치');
  });
  test('wear — 팀 사진은 따라가고 코치가 올린 사진은 둔다 · 두 번 입혀도 그대로',()=>{
    const img='data:image/jpeg;base64,AA',t=T(1,'9','A','',{img,imgTeam:L.mark(img)});const find=L.who([{t,team:'blue',key:'9'}]);
    const own='data:image/png;base64,BB';
    const w=L.wear({players:[T(5,'9',null,'ST'),T(6,'9',null,'ST',{img:own})]},find,false);
    assert.equal(w.players[0].img,img,'팀 사진');assert.equal(w.players[0].imgTeam,L.mark(img));
    assert.equal(w.players[1].img,own,'코치가 올린 사진은 그대로');assert.equal(w.players[1].name,'A');
    assert.equal(L.wear({players:w.players},find,false),null,'두 번째는 바꿀 것이 없다');
    assert.equal(L.wear(null,find),null);assert.equal(L.wear({players:[]},null),null);
  });
  test('board-tweaks 8 — PSTeamLoad.dress · frames 를 감싸고 eachOther 는 쓰지 않는다 · 그림은 하나씩',()=>{
    const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','studio','board-tweaks.js'),'utf8');
    const s8s=src.indexOf('// ── 8. 저장 팀은 판 전체'),s8e=[src.indexOf('// ── 9.',s8s),src.indexOf('// ── 시작 · 다시 그릴 때 ──',s8s)].filter(i=>i>0).sort((a,b)=>a-b)[0];   // 3.137 — 뒤에 3.136 의 9(hookPages)가 온다
    const s8=src.slice(s8s,s8e);
    assert.ok(s8.length>500);
    assert.ok(/L\.dress = function/.test(s8)&&/L\.frames = g/.test(s8),'감싼다');
    assert.ok(!/eachOther/.test(s8.replace(/eachOther 는 쓰지 않는다/,'')),'미팅 중 capture() 가 작업 보드 페이지를 덮는 eachOther 는 안 쓴다');
    assert.ok(/queueThumbs\(recs, meet\)/.test(s8),'다른 페이지 · 슬라이드 그림은 하나씩(3.102)');
    assert.ok(/ok4 = hookTeam\(\)/.test(src),'시작할 때 감싼다');
    const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','studio','board.html'),'utf8');
    assert.ok(html.includes('PSTeamLoad.frames(anim.frames,animActive,cur,fresh)')&&html.includes('PSTeamLoad.dress(p,q,ph(q)'),'보드는 객체 속성으로 부른다(감싼 것을 지난다)');
  });
}
