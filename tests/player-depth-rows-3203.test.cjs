const test=require('node:test');
const assert=require('node:assert/strict');
const workspace=require('../studio/player-workspace.js');

const card=(id,abbr)=>({id,abbr,name:abbr,family:workspace.family(abbr),all:[],rows:[]});
const cards=['LW','CF','RW','AM','CM','DM','LB','LCB','RCB','RB','GK'].map(a=>card('p-'+a,a));
const ids=rows=>workspace.rowsIds(rows);

test('저장이 없으면 역할군별로 넷씩 끊어 줄을 만든다(DF 넷은 한 줄, 다섯이면 둘로)',()=>{
  const rows=workspace.layoutRows(cards,null,4);
  assert.deepEqual(ids(rows),[['p-LW','p-CF','p-RW'],['p-AM','p-CM','p-DM'],['p-LB','p-LCB','p-RCB','p-RB'],['p-GK']]);
  const five=workspace.layoutRows(cards.concat([card('p-CB','CB')]),null,4);
  assert.deepEqual(ids(five)[2],['p-LB','p-LCB','p-RCB','p-RB']);assert.deepEqual(ids(five)[3],['p-CB']);
  assert.deepEqual(rows.map(workspace.rowLabel),['FW','MF','DF','GK']);
});
test('저장된 줄을 그대로 쓰되 없는 카드는 빼고 빠진 카드는 뒤 줄에 덧붙인다',()=>{
  const saved=[['p-AM','p-LW','p-CF','p-RW'],['p-CM','p-DM','p-없음'],['p-LB','p-LCB','p-RCB','p-RB','p-GK']];
  const rows=workspace.layoutRows(cards,saved,4);
  assert.deepEqual(ids(rows),[['p-AM','p-LW','p-CF','p-RW'],['p-CM','p-DM'],['p-LB','p-LCB','p-RCB','p-RB'],['p-GK']]);
  assert.equal(workspace.rowLabel(rows[0]),'FW');
});
test('카드 옮기기: 다른 줄 가운데로, 가득 찬 줄은 거부, 새 줄은 뒤에, 빈 줄은 없앤다',()=>{
  const rows=workspace.layoutRows(cards,null,4);
  const moved=workspace.moveCard(rows,'p-AM',0,1,4);
  assert.deepEqual(ids(moved),[['p-LW','p-AM','p-CF','p-RW'],['p-CM','p-DM'],['p-LB','p-LCB','p-RCB','p-RB'],['p-GK']]);
  assert.equal(workspace.moveCard(moved,'p-CM',0,0,4),null,'네 장이 찬 줄에는 못 넣는다');
  const fresh=workspace.moveCard(moved,'p-GK',moved.length,0,4);
  assert.deepEqual(ids(fresh)[fresh.length-1],['p-GK']);
  const same=workspace.moveCard(rows,'p-RW',0,0,4);
  assert.deepEqual(ids(same)[0],['p-RW','p-LW','p-CF']);
  assert.equal(workspace.moveCard(rows,'p-없음',0,0,4),null);
  assert.deepEqual(ids(rows)[0],['p-LW','p-CF','p-RW'],'원본은 바뀌지 않는다');
});
test('골키퍼는 저장된 혼합 줄에서도 하나씩 분리하고 기존 저장값은 바꾸지 않는다',()=>{
  const saved=[['p-GK','p-LW','p-CF','p-RW'],['p-AM','p-CM','p-DM']],before=JSON.stringify(saved);
  const rows=workspace.layoutRows(cards.concat([card('gk-two','GK')]),saved,4);
  assert.deepEqual(ids(rows).slice(-2),[['p-GK'],['gk-two']]);
  assert.deepEqual(ids(rows)[0],['p-LW','p-CF','p-RW']);
  assert.equal(JSON.stringify(saved),before);
  assert.equal(workspace.moveCard(rows,'p-GK',0,0,4),null);
  assert.equal(workspace.moveCard(rows,'p-AM',rows.length-1,0,4),null);
});
test('네 칸 공격수의 좌우 중앙 역할을 미지정으로 버리지 않는다',()=>{
  const four=['LW','LCF','RCF','RW'].map(a=>card(a,a));
  assert.ok(four.every(c=>c.family==='FW'));
  assert.deepEqual(ids(workspace.layoutRows(four,null,4)),[['LW','LCF','RCF','RW']]);
});
