const test=require('node:test'),assert=require('node:assert/strict');
const R=require('../studio/board-meet-reserve.js');
const eight=require('../studio/board-meet-8.js');
const form=require('../studio/board-meet-form.js');
const tweaks=require('../studio/board-tweaks.js');
test('reserve additions exceed eleven, use free positions and unique numbers across repeated batches',()=>{
  const box={x:30,y:30,w:1050,h:680},old=R.create({snap:eight.slides({},false,'v')[0].snap}).snap.players;
  const a=R.additions(old,12,box),b=R.additions(old.concat(a),7,box),all=old.concat(a,b);
  assert.equal(all.length,27);assert.equal(new Set(all.map(p=>String(p.num))).size,27);
  assert.equal(new Set(all.map(p=>p.x+','+p.y)).size,27);
  assert.ok(a.concat(b).every(p=>p.x>30&&p.x<1080&&p.y>30&&p.y<710));
  assert.equal(R.additions([{num:'9007199254740992',x:100,y:100}],1,box)[0].num,'1','oversized jersey labels cannot stall number allocation');
  for(const n of [0,-1,1.5,31,NaN,Infinity])assert.deepEqual(R.additions(old,n,box),[]);
});
test('kit changes cannot cross a reserve page in either direction, even after duplication and renaming',()=>{
  const slides=[{title:'BEST 11',snap:{}},{title:'RESERVE',snap:{}},{title:'후보 B',reserve:true,snap:{}},{title:'빌드업',snap:{}}];
  for(const index of [1,2])assert.deepEqual(tweaks.spreadKit(R.spreadTargets(slides,index),{teamColors:{blue:'#fedcba'}},index),[]);
  const changed=tweaks.spreadKit(R.spreadTargets(slides,0),{teamColors:{blue:'#123456'}},0);
  assert.equal(changed.length,1);assert.equal(changed[0].it,slides[3]);
  assert.deepEqual(slides[1].snap,{});assert.deepEqual(slides[2].snap,{});
});
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
