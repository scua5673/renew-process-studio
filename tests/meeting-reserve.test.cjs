const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../studio/board-meet-reserve.js');
const eight=require('../studio/board-meet-8.js');
const form=require('../studio/board-meet-form.js');
test('reserve follows BEST in both formats and orientations, with independent identities and snapshots',()=>{
  for(const oh of ['h','v']){
    const old=eight.slides({teamColors:{blue:{color:'#123456'}}},false,oh),raw=JSON.stringify(old);
    old[0].snap.players[0].name='선발';old[0].snap.players[0].pid='starter';old[0].frames=[{snap:old[0].snap}];
    const before=JSON.stringify(old),list=R.withReserve(old),r=list[1];
    assert.deepEqual(list.slice(0,3).map(s=>s.title),['BEST 8','RESERVE','하이블록']);
    assert.equal(list.length,10);assert.equal(r.snap.players.length,8);assert.equal(r.snap.orientation,oh);
    assert.deepEqual(r.snap.players.map(p=>[p.pos,p.x,p.y]),old[0].snap.players.map(p=>[p.pos,p.x,p.y]));
    assert.ok(r.snap.players.every(p=>p.meetingRole==='reserve'&&!p.name&&!p.pid));
    assert.equal(new Set(r.snap.players.map(p=>p.num)).size,8);assert.equal(r.snap.ball,null);assert.equal(r.frames,undefined);
    assert.equal(JSON.stringify(old),before);assert.equal(R.withReserve(list),list);
    r.snap.teamColors.blue.color='#ffffff';assert.equal(old[0].snap.teamColors.blue.color,'#123456');
  }
});
test('no reserve is silently added to a custom or opponent-analysis meeting',()=>{
  for(const list of [[],[{title:'상대 BEST 11',snap:{}}],[{title:'직접 만든 제목',snap:{}}]])assert.equal(R.withReserve(list),list);
  assert.equal(R.isBest({title:'BEST 11'}),true);assert.equal(R.isBest({title:'선발 11'}),true);
  const list=[{title:'BEST 11',snap:{players:[]}},{title:'리저브',snap:{players:[]}}];assert.equal(R.withReserve(list),list);
});
test('reserve survives category selection and has a lineup layout when formations change',()=>{
  const list=R.withReserve(eight.slides({},false,'v'));
  const blank=form.startSlides(list,'categories');assert.equal(blank[1].title,'RESERVE');assert.deepEqual(blank[1].snap.players,[]);
  const selected=form.startSlides(list,'filled',[1]);assert.equal(selected.length,1);assert.equal(selected[0].snap.players.length,8);
  assert.equal(form.kindOf('RESERVE'),'best');
});
