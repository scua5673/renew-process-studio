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
    assert.deepEqual(r.snap.players.map(p=>p.num),old[0].snap.players.map(p=>p.num));
    assert.ok(r.snap.players.every(p=>p.meetingRole==='reserve'&&!p.name&&!p.pid));
    assert.equal(new Set(r.snap.players.map(p=>p.num)).size,8);assert.equal(r.snap.ball,null);assert.equal(r.frames,undefined);
    assert.equal(JSON.stringify(old),before);assert.equal(R.withReserve(list),list);
    r.snap.teamColors.blue.color='#ffffff';assert.equal(old[0].snap.teamColors.blue.color,'#123456');
  }
});
test('new reserves keep BEST token sizes and tactical numbers without copying player identity',()=>{
  const best=eight.slides({tokenScale:.69,tokV:2},false,'v')[0];
  best.snap.players[3].scale=1.7;best.snap.players[3].name='선발';
  const r=R.create(best);
  assert.equal(r.reserveV,2);assert.equal(r.snap.tokenScale,.69);assert.equal(r.snap.tokV,2);
  assert.equal(r.snap.players[3].scale,1.7);assert.equal(r.snap.players[3].name,undefined);
  best.snap.players.forEach((p,i)=>p.num=String(30+i));
  assert.deepEqual(R.create(best).snap.players.map(p=>p.num),['1','2','3','4','5','6','7','8'],'roster shirt numbers do not become tactical reserve numbers');
});
test('legacy reserve upgrade corrects every scene once, preserving names, movement and extra players',()=>{
  const best=eight.slides({tokenScale:.69,tokV:2},false,'v')[0],r=R.create(best);
  delete r.reserveV;r.snap.tokenScale=.35;best.snap.players[2].scale=1.6;
  r.snap.players.forEach((p,i)=>{p.num=String(9+i);p.name='리저브 '+i;});
  r.snap.players.push({id:3000,team:'blue',num:'17',name:'추가 선수',x:77,y:88,scale:1.2});
  r.frames=[{snap:structuredClone(r.snap),thumb:'old1'},{snap:structuredClone(r.snap),thumb:'old2'}];
  r.frames[1].snap.players[2].x+=44;r.thumb='old';
  const list=[best,r,{title:'하이블록',snap:{players:[{num:'9',name:'선발'}]}}],before=structuredClone(list),bestRaw=JSON.stringify(best);
  assert.deepEqual(R.upgrade(list),[r]);
  for(const sn of [r.snap,...r.frames.map(f=>f.snap)]){
    assert.equal(sn.tokenScale,.69);assert.equal(sn.tokV,2);assert.equal(sn.players[2].scale,1.6);
    assert.deepEqual(sn.players.slice(0,8).map(p=>p.num),best.snap.players.map(p=>p.num));
    assert.equal(sn.players[2].name,'리저브 2');assert.deepEqual(sn.players[8],before[1].snap.players[8]);
  }
  assert.equal(r.frames[1].snap.players[2].x,before[1].frames[1].snap.players[2].x);
  assert.equal(r.thumb,undefined);assert.ok(r.frames.every(f=>!f.thumb));
  assert.equal(JSON.stringify(best),bestRaw);assert.deepEqual(list[2],before[2]);
  r.snap.tokenScale=.85;r.snap.players[0].num='90';assert.deepEqual(R.upgrade(list),[]);
  assert.equal(r.snap.tokenScale,.85);assert.equal(r.snap.players[0].num,'90');
});
test('legacy custom numbers and number collisions are not silently rewritten',()=>{
  for(const collision of [false,true]){
    const best=eight.slides({tokenScale:.69,tokV:2},false,'v')[0],r=R.create(best);delete r.reserveV;
    r.snap.players.forEach((p,i)=>p.num=String(9+i));
    if(collision)r.snap.players.push({id:3000,team:'blue',num:'1'});else r.snap.players[2].num='99';
    const nums=r.snap.players.map(p=>p.num);R.upgrade([best,r]);assert.deepEqual(r.snap.players.map(p=>p.num),nums);
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
