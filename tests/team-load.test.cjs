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
