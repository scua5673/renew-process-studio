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

test('뎁스는 실제 배치마다 후보를 표시하고 같은 자리 중복과 전체 인원 중복을 제거한다',()=>{
  const rows=[{id:'c1',name:'여러 자리',placements:[{posId:'l',pid:'a',statusKey:'rep',status:'추천',order:3},{posId:'r',pid:'b',statusKey:'go',status:'영입대상',order:0},{posId:'l',pid:'c',statusKey:'rep',status:'추천',order:4}]},{id:'c2',name:'미배치',pos:'GK',placements:[]}];
  const defs=[{id:'l',name:'왼쪽',abbr:'LCB'},{id:'r',name:'오른쪽',abbr:'RCB'},{id:'g',name:'골키퍼',abbr:'GK'}],before=JSON.stringify({rows,defs});
  const b=workspace.depthBoard(rows,defs,['g'],{});
  assert.equal(b.total,2);assert.equal(b.shown,2);assert.equal(b.cards.find(c=>c.id==='g').all.length,0);
  assert.deepEqual(b.cards.find(c=>c.id==='l').all.map(r=>[r.id,r.pid,r.statusKey]),[['c1','a','rep']]);
  assert.deepEqual(b.cards.find(c=>c.id==='r').all.map(r=>[r.id,r.pid,r.statusKey]),[['c1','b','go']]);
  assert.deepEqual(b.unplaced.rows.map(r=>r.id),['c2']);
  assert.equal(JSON.stringify({rows,defs}),before,'projection does not mutate the source');
  const filtered=workspace.depthBoard(rows,defs,['g'],{status:'go'});
  assert.equal(filtered.shown,1);assert.equal(filtered.cards.find(c=>c.id==='l').rows.length,0);
  assert.equal(filtered.cards.find(c=>c.id==='r').rows[0].pid,'b');
});
test('같은 약어의 사용자 포지션을 합치지 않고 미확인 배치는 미배치에서 찾는다',()=>{
  const b=workspace.depthBoard([{id:'a',posId:'one',name:'가상 A'},{id:'b',posId:'two',name:'가상 B'},{id:'c',posId:'removed',name:'가상 C'}],[{id:'one',name:'LCB'},{id:'two',name:'LCB'}],[],{});
  assert.equal(b.cards.length,2);assert.deepEqual(b.cards.map(c=>c.rows[0].id),['a','b']);assert.equal(b.unplaced.rows[0].id,'c');
});
test('한 자리의 많은 후보를 자르지 않고 검색해도 배치 순서를 보존한다',()=>{
  const rows=Array.from({length:138},(_,i)=>({id:'c'+i,name:'후보 '+i,placements:[{posId:'p',pid:'placement'+i,statusKey:'rep',order:137-i}]}));
  const b=workspace.depthBoard(rows,[{id:'p',name:'LCB'}],[],{});
  assert.equal(b.cards[0].rows.length,138);assert.equal(b.max,138);assert.equal(b.cards[0].rows[0].id,'c137');
  const searched=workspace.depthBoard(rows,[{id:'p',name:'LCB'}],[],{q:'후보 137'});
  assert.equal(searched.shown,1);assert.equal(searched.cards[0].rows[0].rank,1);
  assert.equal(searched.cards[0].all.length,138);
});
test('같은 자리의 서로 다른 단계는 상이로 남기고 빈 정의도 안전하게 표시한다',()=>{
  const b=workspace.depthBoard([{id:'c',placements:[{posId:'p',statusKey:'rep'},{posId:'p',statusKey:'done'}]}],[{id:'p',name:'GK'}],[],{});
  assert.equal(b.cards[0].all[0].statusKey,'mixed');
  assert.equal(workspace.depthBoard([],[],[],{}).unplaced.rows.length,0);
  assert.equal(workspace.depthBoard([],[{id:'p',name:'GK'}],[],{}).cards.length,1);
});
