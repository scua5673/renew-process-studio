const test=require('node:test');
const assert=require('node:assert/strict');
const workspace=require('../studio/player-workspace.js');
const positions=require('../studio/scouting-position.js');

test('검색어는 AND, 포지션과 상태와 미평가 조건도 함께 적용하고 원문을 보존한다',()=>{
  const rows=[{id:'one',name:'가상 민수',num:'1',pos:'GK',group:'A팀',statusKey:'ok',evaluated:false},{id:'two',name:'가상 민수',num:'2',pos:'CB',group:'B팀',statusKey:'injury',evaluated:true}];
  const before=JSON.stringify(rows);
  assert.deepEqual(workspace.filter(rows,{q:'민수 A팀',pos:'GK',status:'ok',unevaluated:true}).map(r=>r.id),['one']);
  assert.deepEqual(workspace.filter(rows,{q:'민수',pos:'GK',status:'injury'}),[]);
  assert.deepEqual(workspace.filter(rows,{q:'없는 선수'}),[]);
  assert.equal(JSON.stringify(rows),before);
});
test('세부 포지션은 역할군으로 읽되 알 수 없는 포지션을 공격수로 추정하지 않는다',()=>{
  for(const p of ['LCB','RCB','LWB','RWB'])assert.equal(workspace.family(p),'DF');
  assert.equal(workspace.family('GK'),'GK');assert.equal(workspace.family('CM'),'MF');assert.equal(workspace.family('LCM'),'MF');assert.equal(workspace.family('CF'),'FW');assert.equal(workspace.family('특수 역할'),'미지정');
});
test('비교 선택은 최대 3명, 재선택으로 해제하고 삭제된 선수만 선택에서 뺀다',()=>{
  const a=['a','b','c'];assert.deepEqual(workspace.select(a,'d'),a);assert.deepEqual(workspace.select(a,'b'),['a','c']);assert.deepEqual(a,['a','b','c']);
  assert.deepEqual(workspace.reconcile(a,[{id:'a'},{id:'c'}]),['a','c']);
});
test('질문 자동 초깃값 1은 평가로 세지 않고 저장된 1점 평가는 기록으로 센다',()=>{
  assert.equal(workspace.evaluated({levels:{a:1,b:1}}),false);assert.equal(workspace.evaluated({levels:{a:1},evalAt:100}),true);
  assert.equal(workspace.evaluated({levels:{},evalAt:100}),false);assert.equal(workspace.evaluated({levels:{a:3}}),true);assert.equal(workspace.evaluated({levels:{a:0,b:'x'}}),false);
});
test('동일 후보의 여러 배치는 한 명으로 세고 미배치 후보도 유지한다',()=>{
  const placements=[{cid:'c1',p:{id:'p1'}},{cid:'c1',p:{id:'p2'}}],registry={c1:{info:{name:'가상 후보'}}},before=JSON.stringify({placements,registry});
  const result=workspace.candidates(placements,registry,[{id:'c1'},{id:'c2'}]);
  assert.equal(result.length,2);assert.equal(result[0].placements.length,2);assert.equal(result[1].player,null);
  assert.equal(JSON.stringify({placements,registry}),before);
});
test('사용자 문자열이 표나 선수 상세의 HTML로 해석되지 않는다',()=>{
  assert.equal(workspace.escape('<img src=x onerror="x">'), '&lt;img src=x onerror=&quot;x&quot;&gt;');
});
test('GK 배치는 후보 원본에 포지션이 없어도 GK 질문을 고른다',()=>{
  const sets=[{name:'공격수',positions:['ST']},{name:'골키퍼',positions:['GK']}],before=JSON.stringify(sets);
  assert.equal(positions.pick(sets,['GK']),1);assert.equal(positions.pick(sets,[]),-1);assert.equal(positions.pick(sets,['unknown']),-1);assert.equal(JSON.stringify(sets),before);
});
test('세부 포지션과 표준 별칭을 질문 그룹에 연결하고 미지정은 사용자가 선택한다',()=>{
  const sets=[{positions:['CB']},{positions:['WB']},{positions:['ST']}];
  assert.equal(positions.pick(sets,['LCB']),0);assert.equal(positions.pick(sets,['RWB']),1);assert.equal(positions.pick(sets,['CF']),2);assert.equal(positions.pick([],['GK']),-1);
});
