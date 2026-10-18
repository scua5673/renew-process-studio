// 제보 4116fc54 — 저장 팀 선수 사진은 이 기기에만(studio/team-photos.js). 사진 바이트는 PSImg, 선수 → 사진 표는 기기 키 cs_team_photos_v1.
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../studio/team-photos.js');
const L=require('../studio/team-load.js');
const keys=require('../studio/storage-keys.js');

function fakeWindow(){
  const idb=new Map();let n=0;
  const storage={get:async k=>idb.has(k)?{value:idb.get(k)}:null,set:async(k,v)=>{idb.set(k,v);return true;},del:async k=>{idb.delete(k);}};
  const PSImg={put:async d=>{const id='psimg_t'+(++n);idb.set(id,d);return 'psimg:'+id;},del:async r=>{idb.delete(r.slice(6));},src:()=>''};
  return {idb,w:{storage,PSImg}};
}
const JPG=c=>'data:image/jpeg;base64,'+c.repeat(40);

test('표 키는 이 기기 키 — 동기화 목록에 없다',()=>{
  const row=keys.info(P.key);
  assert.ok(row,'storage-keys.js 에 있다');
  assert.equal(row.sync,'device');
  assert.equal(row.home,'idb');
});

test('apply — 선수 id 로 넣고 · 바꾸고 · 지우고, 팀에서 빠진 선수의 사진도 지운다(다른 팀은 그대로)',()=>{
  const map={v:1,teams:{a:{p1:'psimg:psimg_1',p2:'psimg:psimg_2',gone:'psimg:psimg_3'},b:{x:'psimg:psimg_9'}}};
  const r=P.apply(map,'a',{p1:'psimg:psimg_4',p2:null,p5:'psimg:psimg_5'},['p1','p2','p5']);
  assert.deepEqual(r.map.teams.a,{p1:'psimg:psimg_4',p5:'psimg:psimg_5'});
  assert.deepEqual(r.map.teams.b,{x:'psimg:psimg_9'});
  assert.deepEqual(r.drop.sort(),['psimg:psimg_1','psimg:psimg_2','psimg:psimg_3']);
  assert.deepEqual(map.teams.a.p1,'psimg:psimg_1','원래 표는 건드리지 않는다');
  const empty=P.apply(r.map,'a',{p1:null,p5:null},['p1','p5']);
  assert.equal(empty.map.teams.a,undefined,'사진이 없어진 팀은 표에서 뺀다');
  assert.deepEqual(P.apply(null,'a',{},[]).map,{v:1,teams:{}});
  assert.deepEqual(P.parse('broken'),{v:1,teams:{}});
});

test('commit — 사진은 PSImg 에, 참조는 기기 표에. 순서를 바꿔도(같은 id) 그대로, 지우면 PSImg 에서도 지운다',async()=>{
  const {idb,w}=fakeWindow();
  let got=await P.commit(w,'team1',{p1:JPG('A'),p2:JPG('B')},['p1','p2','p3']);
  assert.deepEqual(got,{p1:JPG('A'),p2:JPG('B')});
  const map=JSON.parse(idb.get(P.key));
  assert.match(map.teams.team1.p1,/^psimg:psimg_/);
  assert.equal(idb.get(map.teams.team1.p1.slice(6)),JPG('A'));
  // 순서 바꾸기 · 다른 선수 이름 바꾸기 — 사진은 선수 id 에 붙어 있다
  got=await P.commit(w,'team1',{},['p3','p2','p1']);
  assert.deepEqual(got,{p1:JPG('A'),p2:JPG('B')});
  // 바꾸기 — 새 사진이 들어가고 옛 사진은 지운다
  const old=map.teams.team1.p1;
  got=await P.commit(w,'team1',{p1:JPG('C')},['p1','p2','p3']);
  assert.equal(got.p1,JPG('C'));
  assert.equal(idb.has(old.slice(6)),false,'옛 사진은 남지 않는다');
  // 지우기 · 선수 빼기
  const refs=JSON.parse(idb.get(P.key)).teams.team1;
  got=await P.commit(w,'team1',{p1:null},['p1','p3']);
  assert.deepEqual(got,{});
  assert.equal(idb.has(refs.p1.slice(6)),false);
  assert.equal(idb.has(refs.p2.slice(6)),false,'팀에서 뺀 선수의 사진도 지운다');
  assert.deepEqual(JSON.parse(idb.get(P.key)).teams,{});
  assert.deepEqual([...idb.keys()].filter(k=>k.startsWith('psimg_')),[],'남는 사진 없음');
});

test('commit — 표를 못 쓰면 방금 넣은 사진도 지우고 실패를 알린다',async()=>{
  const {idb,w}=fakeWindow();
  w.storage.set=async()=>{throw Error('disk');};
  await assert.rejects(P.commit(w,'t',{p1:JPG('A')},['p1']),/disk/);
  assert.deepEqual([...idb.keys()],[]);
});

test('images — 다른 화면이 방금 넣은 사진(PSImg 메모리에 없음)도 저장소에서 읽는다',async()=>{
  const {w}=fakeWindow();
  await P.commit(w,'t',{p1:JPG('Z')},['p1']);
  assert.deepEqual(await P.images(w,'t'),{p1:JPG('Z')});
  assert.deepEqual(await P.images(w,'없는 팀'),{});
});

test('작전판 토큰 — 이 기기 사진은 팀 불러오기 표시(imgTeam)와 함께, 코치가 직접 올린 사진은 그대로',()=>{
  const t={id:1,num:1,pos:'GK',x:1,y:1};
  L.dress(t,{id:'p1',name:'골키퍼',no:'1'},JPG('A'));
  assert.equal(t.img,JPG('A'));assert.equal(t.imgTeam,L.mark(JPG('A')));
  L.dress(t,{id:'p2',name:'다른 선수',no:'12'},JPG('B'));
  assert.equal(t.img,JPG('B'),'팀 불러오기가 넣은 사진은 다음 불러오기 때 바뀐다');
  L.dress(t,{id:'p3',name:'사진 없음'},'');
  assert.equal(t.img,undefined,'사진 없는 선수면 팀 사진을 뺀다');
  const own={id:2,img:'data:image/png;base64,OWN',imgBg:'#fff'};
  L.dress(own,{id:'p1',name:'골키퍼'},JPG('A'));
  assert.equal(own.img,'data:image/png;base64,OWN','코치가 올린 사진은 그대로');
  own.imgTeam='9:stale';L.dress(own,null,'');
  assert.equal(own.img,'data:image/png;base64,OWN');
  const list=[{snap:{players:[]}},{snap:{players:[{id:1,img:JPG('B'),imgTeam:L.mark(JPG('B'))}]}}];
  L.frames(list,0,[{id:1,name:'사진 없음',num:1,pos:'GK'}],[]);
  assert.equal(list[1].snap.players[0].img,undefined,'다른 장면의 팀 사진도 같이 뺀다');
});
