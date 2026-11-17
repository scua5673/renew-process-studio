'use strict';
/* 저장 계층 정리 1단계 — IndexedDB 를 건너뛰던 쓰기 넷을 공용 길로(설계 6절 «1 구멍 막기» · docs/STORAGE-GATE.md).
   조사(11/5 · 3.262): scout_tool_v1 에 쓰는 함수 10개 · 파일 6개 가운데 셋은 IndexedDB 를 건너뛰었다 — gamemodel.html saveDoc(거울에만) ·
   team-files.js(IDB_MIRROR 에 키 없음 → 거울에만) · storage.js PSImg.migrate 의 writeJSON(거울에만). 작전판 squadSave 는 두 저장소에 따로 썼고 읽는 차례가 scout 와 반대였다.
   거울과 정본이 갈라지면 다음 회차가 서버본으로 덮거나(sync.js) «사본 불일치»(3.201 PSRosterCopies)가 된다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const R=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
const K=require('../studio/storage-keys.js'),G=require('../scripts/storage-gate-scan.cjs');
const tick=()=>new Promise(r=>setImmediate(r));
function slice(src,a,b){const s=src.indexOf(a),e=src.indexOf(b,s+a.length);assert.ok(s>=0&&e>s,a);return src.slice(s,e);}

test('team-files.js — 선수단 · 게임모델도 IndexedDB 정본 + 거울 목록에 있다(가져오기 · 되돌리기가 공용 길을 쓴다)',()=>{
  const L=G.truthLists().find(x=>x.file==='studio/team-files.js');
  for(const k of ['scout_tool_v1','cs_gamemodel_v1','cs_squad_v1','process_coach_v1','cs_team_matches_v1','cs_scout_targets_v1'])assert.ok(L.keys.includes(k),k);
  assert.deepEqual(G.hints().filter(h=>h.startsWith('studio/team-files.js')),[],'team-files 의 «살펴볼 곳»이 없다');
  for(const k of L.keys){const row=K.info(k);assert.ok(row&&row.home==='idb'&&row.mirror,k+' — 표에서 IndexedDB 정본 + 거울');}
});

/* gamemodel.html 포지션별 요구 — 정본을 읽고 그 위에 고쳐 공용 길로 */
function gm({idb,mirror,shared=true}){
  const src=R('studio/gamemodel.html'),code=slice(src,'  function load(){try{return JSON.parse(localStorage.getItem("scout_tool_v1")','  function abbr(n){');
  const writes=[],local=new Map(mirror?[['scout_tool_v1',JSON.stringify(mirror)]]:[]);
  const c=vm.createContext({Promise,JSON,Array,localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>{writes.push(['ls',k,v]);local.set(k,v);}}});
  c.window=c;
  if(idb!==undefined)c.storage={get:async k=>idb&&k==='scout_tool_v1'?{value:JSON.stringify(idb)}:null};
  if(shared)c.psSaveSharedAsync=async(k,raw)=>{writes.push(['shared',k,raw]);return true;};
  vm.runInContext(code,c);
  return {c,writes,local};
}
const doc=(players,ideal)=>({v:1,players,positions:[{id:'p1',name:'CM',ideal:ideal||{}}]});
test('gamemodel — 고친 값은 IndexedDB 정본 위에 얹어 psSaveSharedAsync 로 쓴다(낡은 거울의 명단을 되살리지 않는다)',async()=>{
  const h=gm({idb:doc([{id:'a'},{id:'b'}]),mirror:doc([{id:'a'}])});
  assert.equal(await h.c.saveIdeal('p1','tac','압박 먼저'),true);
  assert.equal(h.writes.length,1);const [how,k,raw]=h.writes[0];assert.equal(how,'shared');assert.equal(k,'scout_tool_v1');
  const w=JSON.parse(raw);assert.equal(w.players.length,2,'정본의 선수 둘');assert.equal(w.positions[0].ideal.tac,'압박 먼저');
  assert.equal(h.local.get('scout_tool_v1'),JSON.stringify(doc([{id:'a'}])),'거울에 직접 쓰지 않는다(공용 길이 쓴다)');
});
test('gamemodel — 정본이 비어 있으면 거울을, 어댑터가 없으면 거울을 읽는다 · 모르는 포지션 · 자료 없음 · 공용 길 없음은 거부한다',async()=>{
  let h=gm({idb:null,mirror:doc([{id:'m'}])});await h.c.saveIdeal('p1','tech','x');assert.equal(JSON.parse(h.writes[0][2]).players[0].id,'m');
  h=gm({mirror:doc([{id:'n'}])});await h.c.saveIdeal('p1','tech','y');assert.equal(JSON.parse(h.writes[0][2]).players[0].id,'n');
  await assert.rejects(h.c.saveIdeal('nope','tech','z'),/포지션/);
  h=gm({idb:null,mirror:null});await assert.rejects(h.c.saveIdeal('p1','tac','v'),/읽지 못/);
  h=gm({mirror:doc([]),shared:false});await assert.rejects(h.c.saveIdeal('p1','psy','w'),/저장 길/);assert.equal(h.writes.length,0,'거울에 직접 쓰는 옛 길은 없다');
});
test('gamemodel — 거울에만 쓰던 saveDoc 은 없고, 실패는 저장 상태로 알린다',()=>{
  const src=R('studio/gamemodel.html');assert.doesNotMatch(src,/function saveDoc\(d\)\{try\{localStorage\.setItem\("scout_tool_v1"/);
  assert.match(src,/saveIdeal\(t\.dataset\.pos,this\.dataset\.gmis,this\.value\)\.catch\(function\(e\)\{ console\.warn\("\[PS\] gm ideal save",e\); if\(window\.PSSaveState\)PSSaveState\.fail\("gm-ideal",e\); \}\)/);
});

/* storage.js PSImg.migrate — 정본을 읽고 정본에 쓴다 */
function img({idbDocs,lsDocs,table=true}){
  /* PSImg IIFE — 기준점은 이름(window.PSImg= · window.PSSafe.img=safe)으로, 주석으로 자르지 않는다(code-budget-3043 래칫) */
  const source=R('studio/storage.js'),tail=source.indexOf('window.PSSafe.img=safe'),start=source.indexOf('(function(){',source.indexOf('사진 보관소(PSImg)'));
  const code=source.slice(start,source.indexOf('})();',tail)+5).replace('  try{ ready().then(function(){ return migrate(); }).catch(function(){}); }catch(_){}','');
  const picture='data:image/png;base64,SYNTHETIC',local=new Map(Object.entries({ps_sync_session:'{"uid":"coach"}',ps_active_ws:'A',ps_cache_owner_v1:'{"uid":"coach","wid":"A","nonce":"one"}'})),idb=new Map(),disk=new Map(),shared=[],lsWrites=[],hooks={};
  for(const [k,v]of Object.entries(lsDocs||{}))local.set(k,JSON.stringify(v).replace(/PIC/g,picture));
  for(const [k,v]of Object.entries(idbDocs||{}))idb.set(k,JSON.stringify(v).replace(/PIC/g,picture));
  const c={Promise,JSON,Math,Date,CustomEvent:function(type,o){this.type=type;this.detail=o&&o.detail;},dispatchEvent(){},
    localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){lsWrites.push(k);local.set(k,String(v));},key:i=>[...local.keys()][i]??null,get length(){return local.size;}},
    storage:{async keys(){return [];},async set(k,v){if(hooks.put)await hooks.put(k,v);disk.set(k,v);return true;},async get(k){if(idb.has(k))return {value:idb.get(k)};return disk.has(k)?{value:disk.get(k)}:null;}},
    psSaveSharedAsync:async(k,raw)=>{if(hooks.shared)await hooks.shared(k,raw);shared.push([k,raw]);local.set(k,raw);idb.set(k,raw);return true;}};
  if(table)c.PSStorageKeys=K;
  c.window=c;vm.createContext(c);vm.runInContext(code,c);
  return {c,picture,local,idb,disk,shared,lsWrites,hooks};
}
test('PSImg.migrate — 선수단 · 일정은 IndexedDB 정본에서 읽어 참조로 바꾸고 psSaveSharedAsync 로 쓴다, 팀(cs_team_v1 — 거울 정본)은 거울대로',async()=>{
  const h=img({idbDocs:{scout_tool_v1:{players:[{id:'a',profile:{photo:'PIC'}}]},process_coach_v1:{weeks:{0:[{match:{logo:'PIC'}}]}}},lsDocs:{scout_tool_v1:{players:[{id:'old',profile:{photo:'PIC'}}]},cs_team_v1:{logo:'PIC'}}});
  const r=JSON.parse(JSON.stringify(await h.c.PSImg.migrate()));assert.deepEqual(r,{moved:3,failed:0});
  assert.deepEqual(h.shared.map(x=>x[0]).sort(),['process_coach_v1','scout_tool_v1']);
  const sc=JSON.parse(h.idb.get('scout_tool_v1'));assert.equal(sc.players[0].id,'a','정본의 명단');assert.match(sc.players[0].profile.photo,/^psimg:/);
  assert.equal(h.local.get('scout_tool_v1'),h.idb.get('scout_tool_v1'),'거울은 공용 길이 같이 맞춘다');
  assert.deepEqual(h.lsWrites,['cs_team_v1'],'거울 정본(cs_team_v1)만 writeJSON');
  assert.equal(h.c.PSImg.src(sc.players[0].profile.photo),h.picture);
});
test('PSImg.migrate — 옮기는 사이 정본이 바뀌면 그 문서는 쓰지 않는다 · 공용 길이 거부하면 실패로 센다',async()=>{
  let h=img({idbDocs:{scout_tool_v1:{players:[{id:'a',profile:{photo:'PIC'}}]}}});
  h.hooks.put=async()=>{h.idb.set('scout_tool_v1',JSON.stringify({players:[{id:'later'}]}));};
  let r=JSON.parse(JSON.stringify(await h.c.PSImg.migrate()));assert.deepEqual(r,{moved:0,failed:1});assert.equal(h.shared.length,0);assert.equal(JSON.parse(h.idb.get('scout_tool_v1')).players[0].id,'later');
  h=img({idbDocs:{scout_tool_v1:{players:[{id:'a',profile:{photo:'PIC'}}]}}});
  h.hooks.shared=async()=>{throw new Error('quota');};
  r=JSON.parse(JSON.stringify(await h.c.PSImg.migrate()));assert.deepEqual(r,{moved:0,failed:1});assert.equal(h.lsWrites.length,0,'공용 길이 거부해도 거울에 따로 쓰지 않는다');
});
test('PSImg.migrate — 키 표가 없는 창(옛 판 · 시험)은 예전대로 거울을 읽고 거울에 쓴다',async()=>{
  const h=img({lsDocs:{scout_tool_v1:{players:[{id:'m',profile:{photo:'PIC'}}]}},table:false});
  const r=JSON.parse(JSON.stringify(await h.c.PSImg.migrate()));assert.deepEqual(r,{moved:1,failed:0});assert.equal(h.shared.length,0);assert.deepEqual(h.lsWrites,['scout_tool_v1']);
});

/* board.html 선수단 거울 */
function squad({viewonly=false,shared=true,idb,ls}={}){
  const src=R('studio/board.html'),code=slice(src,'async function squadLoad(){','function renderSquad(){');
  const calls=[],fails=[];
  const c=vm.createContext({Promise,JSON,Array,document:{body:{classList:{contains:()=>viewonly}}},$:()=>null,
    localStorage:{getItem:k=>k==='cs_squad_v1'&&ls?JSON.stringify(ls):null,setItem:(k,v)=>calls.push(['ls',k,v])},
    boardStore:{get:async k=>idb??null,set:(k,v)=>{calls.push(['store',k,JSON.stringify(v)]);return Promise.resolve(true);}},
    storeFailure:(k,e)=>fails.push([k,String(e&&e.message||e)]),TEAM_KEY:'cs_squad_v1'});
  c.window=c;if(shared)c.psSaveSharedAsync=async(k,raw)=>{calls.push(['shared',k,raw]);if(raw.includes('"boom"'))throw new Error('rejected');return true;};
  vm.runInContext('var squad={players:[]};\n'+code+'\nthis.get=()=>squad;this.setSquad=s=>{squad=s;};',c);
  return {c,calls,fails};
}
test('board — 선수단 거울은 IndexedDB 정본을 먼저 읽고, 쓰기는 psSaveSharedAsync 하나(실패는 storeFailure · 보기 전용 · 공용 길 없음은 boardStore)',async()=>{
  let h=squad({idb:{players:[{name:'정본'}]},ls:{players:[{name:'거울'}]}});await h.c.squadLoad();assert.equal(h.c.get().players[0].name,'정본');
  h=squad({idb:null,ls:{players:[{name:'거울'}]}});await h.c.squadLoad();assert.equal(h.c.get().players[0].name,'거울');
  h=squad();h.c.setSquad({players:[{name:'새'}]});h.c.squadSave();await tick();
  assert.deepEqual(h.calls,[['shared','cs_squad_v1','{"players":[{"name":"새"}]}']]);assert.equal(h.fails.length,0);
  h=squad();h.c.setSquad({players:[{name:'boom'}]});h.c.squadSave();await tick();await tick();assert.equal(h.fails.length,1);assert.equal(h.fails[0][0],'cs_squad_v1');
  h=squad({viewonly:true});h.c.setSquad({players:[]});h.c.squadSave();await tick();assert.deepEqual(h.calls.map(x=>x[0]),['store']);
  h=squad({shared:false});h.c.setSquad({players:[]});h.c.squadSave();await tick();assert.deepEqual(h.calls.map(x=>x[0]),['store']);
});

test('문의 기준 — 1단계로 직접 쓰기가 줄었다(gamemodel 5 · board 22)',()=>{
  const base=G.baseline();assert.equal(base.direct['studio/gamemodel.html'],5);assert.equal(base.direct['studio/board.html'],22);
});
