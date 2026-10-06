'use strict';
/* 2.948 — 부팅 전 빈 뼈대가 명단 본문을 덮던 것(운영 풋볼A 10/2·10/5: meta 가 로고 두 칸만 남고 statusRuns·participationDays 가 사라짐).
   경로: 부팅 확인 전 «ps_items_rev» 신호 → itemsApply 가 아직 불러오지 않은 기본 문서 {attrs:[],positions:[],meta:{}} 에 선수 행만 얹어
   rosterProject 로 통째 저장. 지키는 것 셋: ① 불러오기 전·부팅 중 itemsApply 는 아무것도 안 한다 ② rosterPersist 는 빈 뼈대로 덮지 않는다
   ③ 기록 칸(statusRuns·participationDays·injuryInfo)이 저장본에만 있으면 옮겨 담는다. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const sync=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8'),scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
const raw=JSON.stringify,copy=x=>JSON.parse(raw(x)),MAIN='scout_tool_v1',PD='cs_player_del_v1';
function section(source,a,b){const x=source.indexOf(a),y=source.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return source.slice(x,y);}
const fn=(source,name)=>section(source,'function '+name+'(','\nfunction ');
const harnessPath=path.join(__dirname,'team-data-consistency.test.cjs'),harnessSource=fs.readFileSync(harnessPath,'utf8'),box={require:createRequire(harnessPath),__dirname,module:{exports:{}},console,URL,setImmediate,Buffer};
vm.runInNewContext(harnessSource.slice(0,harnessSource.indexOf('\nconst pushed='))+'\nmodule.exports={harness};',box);
const p=(id,name='Synthetic player',grp='A')=>({id,name,grp,type:'ours'});
const HISTORY={statusRuns:{a:[{s:'injury',from:'2026-09-22',to:'2026-10-01'}]},participationDays:{'2026-09-30':{b:{s:'rest',kind:'train',at:1}}},injuryInfo:{a:{'2026-09-22':{part:'발목'}}}};
const teamDoc=players=>({attrs:[{id:'ps_t_scan',cat:'tac',name:'Scan'}],positions:[{id:'pos_GK',name:'GK',targets:{},ideal:{}}],meta:Object.assign({evalMode:'fifa',evalStdForcedAt:1,emblem:'',emblemRef:'abc',tbXY:{pos_GK:{x:10,y:50}},tbCards:['pos_GK']},copy(HISTORY)),statusProposals:{a:{to:'ok'}},_items:{build:'2.947'},players:copy(players)});
function fixture(players,memory,opt){
  const h=box.module.exports.harness({key:'sq:fixture',dynamic:true,server:null}),c=h.c,saves=[];
  Object.assign(c,{ITEMS_ACTIVE:true,ITEMP:'sq:',ITEMS_HOLD:'ps_items_hold_v1',ITEMS_IDX:'ps_items_idx_v1',_itemConflicts:[],KEYS:[MAIN,PD],KEY:MAIN,PDKEY:PD,TKEY:'cs_scout_targets_v1',PS_BUILD:'2.948',scMainMigrationPending:false,
    PSRosterOutbox:require('../studio/roster-outbox.js'),PSPerms:{canEdit:()=>true,role:()=> 'executive'},
    itemsServerCheck:async()=>true,itemsPushAllowed:()=>true,isItemKey:k=>k.startsWith('sq:'),idbBacked:k=>k.startsWith('sq:'),data:memory,
    store:{get:k=>JSON.parse(h.local.get(k)||'null'),set(k,v){h.local.set(k,raw(v));saves.push({k,v:copy(v)});return true;}},
    evalMode:()=>'fifa',evalSetId:()=>'standard',canSeeTargets:()=>false,rosterKeepSave(){},posAbbr:x=>x,plStatusOf:p=>p.status||'ok',psAct(){}});
  h.local.set('ps_sync_session',raw(c.getSess()));
  c.storage.conditionalGuardVersion=1;c.storage.keys=async()=>[...h.idb.keys()];
  vm.runInContext(section(sync,'var _itemsT=null, _itemsPending=null','function itemsHoldOpen(')+'\n'+['itemsIdxKey','itemsIdx','itemVal','bigDrop','itemsReadAll','itemsResolveConflicts'].map(n=>fn(sync,n)).join('\n'),c);
  c.PSItems={patchVersion:1,active:()=>true,readAll:c.itemsReadAll,write:c.itemsWrite,writeReady:c.itemsWriteReady,flush:c.itemsWriteFlush};c.parent.PSItems=c.PSItems;c.parent.PS_BUILD='2.948';
  c.teamSaves={track(k,p){Promise.resolve(p).catch(()=>{});}};
  vm.runInContext(section(scout,'/* 2.825 — roster save coordinator.','\nfunction save(){')+'\n'+section(scout,'function teamSaveOwner(){','const teamSaves='),c);
  vm.runInContext(['isTargetPl','plTombs','plTombAdd','plTombApply','itemsPI','scoutAutomaticWriteAllowed','itemsApply','save'].map(n=>fn(scout,n)).join('\n'),c);
  const stored=teamDoc(players);if(opt&&opt.noBlob){delete stored.meta.emblemRef;delete stored.meta.emblem;if(memory&&memory.meta){delete memory.meta.emblemRef;delete memory.meta.emblem;}}h.local.set(MAIN,raw(stored));h.local.set(PD,'{}');for(const k of [MAIN,PD])h.server.set(k,{workspace_id:'team-a',k,v:h.local.get(k),cupd:10});
  const m=c.meta(),idx={};for(const player of players){const k='sq:'+player.id,v=raw(player);h.idb.set(k,v);h.server.set(k,{workspace_id:'team-a',k,v,cupd:10});m.h[k]=c.hash(v);m.c[k]=10;idx[player.id]=c.hash(v);}
  for(const k of [MAIN,PD]){m.h[k]=c.hash(h.local.get(k));m.c[k]=10;}c.setMeta(m);h.local.set('ps_items_idx_v1:team-a',raw(idx));
  return Object.assign(h,{saves,main:()=>JSON.parse(h.local.get(MAIN))});
}
const skeleton=()=>({attrs:[],positions:[],players:[],meta:{}});
const players=[p('a','Player A'),p('b','Player B','B')];
function assertIntact(h){const d=h.main();assert.deepEqual(d.meta.statusRuns,HISTORY.statusRuns);assert.deepEqual(d.meta.participationDays,HISTORY.participationDays);assert.equal(d.attrs.length,1);assert.equal(d.positions.length,1);assert.ok(d.statusProposals);assert.deepEqual(d.meta.tbXY,{pos_GK:{x:10,y:50}});}

/* 동기화 한 회차를 실제로 돌려 선수 행을 «서버 확인됨»으로 만든 뒤, 화면 메모리를 부팅 전 기본 문서로 둔다 — 사고 그때의 모양 */
async function observed(){
  const h=fixture(players,teamDoc(players),{noBlob:true});
  const fetch=h.c.syncFetch;h.c.syncFetch=async(stage,...args)=>stage==='items_conflict'?{ok:true,json:async()=>[...h.server.values()]}:fetch(stage,...args);
  const r=await h.run();assert.equal(r.error,undefined,raw(h.errors));h.saves.length=0;h.c.data=skeleton();return h;
}
function assertIntactNoBlob(h){const d=h.main();assert.deepEqual(d.meta.statusRuns,HISTORY.statusRuns);assert.deepEqual(d.meta.participationDays,HISTORY.participationDays);assert.equal(d.attrs.length,1);assert.equal(d.positions.length,1);assert.ok(d.statusProposals);assert.deepEqual(d.meta.tbXY,{pos_GK:{x:10,y:50}});}
test('불러오기 전(scoutDataLoaded=false) 동기화 신호가 와도 기본 문서에 선수만 얹어 저장하지 않는다',async()=>{
  const h=await observed();h.c.scoutDataLoaded=false;
  assert.equal(await h.c.itemsApply('sync'),false);assert.equal(h.saves.filter(x=>x.k===MAIN).length,0);assertIntactNoBlob(h);
  assert.equal(h.c.data.players.length,0,'메모리도 그대로 — 부팅 init 이 불러온 뒤 다시 돈다');
});
test('부팅 중(scoutBootPending)·후보 이관 중에도 마찬가지',async()=>{
  for(const flag of ['scoutBootPending','scMainMigrationPending']){
    const h=await observed();h.c.scoutDataLoaded=true;h.c[flag]=true;
    assert.equal(await h.c.itemsApply('sync'),false,flag);assert.equal(h.saves.filter(x=>x.k===MAIN).length,0,flag);assertIntactNoBlob(h);
  }
});
test('읽는 사이에 부팅 상태가 바뀌어도(읽기 시작 뒤 다시 확인) 뼈대를 쓰지 않는다',async()=>{
  const h=await observed();h.c.scoutDataLoaded=true;h.c.scoutBootPending=false;
  const pending=h.c.itemsApply('sync');h.c.scoutDataLoaded=false;assert.equal(await pending,false);assertIntactNoBlob(h);
});
test('표식만 빠뜨려도(예전 판의 storage 리스너 길) rosterPersist 가 마지막으로 막는다',async()=>{
  const h=await observed();h.c.scoutDataLoaded=true;h.c.scoutBootPending=false;   /* 표식이 잘못 켜진 경우를 흉내 — 둘째 방어선만 남는다 */
  await h.c.itemsApply('sync');assert.equal(h.saves.filter(x=>x.k===MAIN).length,0);assertIntactNoBlob(h);
});
test('어느 길로 오든 rosterPersist 는 저장본에 평가표·포지션이 있으면 빈 뼈대로 덮지 않는다(rosterProject 직접)',()=>{
  const h=fixture(players,skeleton());const mem=skeleton();mem.players=copy(players);h.c.data=mem;
  assert.equal(h.c.rosterProject(copy(players)),false);assert.equal(h.saves.filter(x=>x.k===MAIN).length,0);assertIntact(h);
});
test('메모리 문서에 기록 칸이 빠져 있어도 저장본의 statusRuns·participationDays·injuryInfo 를 옮겨 담는다(메모리도 채운다)',()=>{
  const mem=teamDoc(players);delete mem.meta.statusRuns;delete mem.meta.participationDays;delete mem.meta.injuryInfo;
  const h=fixture(players,mem);h.c.scoutDataLoaded=true;
  assert.notEqual(h.c.save({skipTargets:true}),false);const d=h.main();
  assert.deepEqual(d.meta.statusRuns,HISTORY.statusRuns);assert.deepEqual(d.meta.participationDays,HISTORY.participationDays);assert.deepEqual(d.meta.injuryInfo,HISTORY.injuryInfo);
  assert.deepEqual(copy(h.c.data.meta.statusRuns),HISTORY.statusRuns,'화면 계산(avTotals)도 같은 기록을 읽는다');
});
test('메모리에 기록 칸이 있으면 그 값이 이긴다(오늘 고친 기록을 옛 저장본으로 되돌리지 않는다)',()=>{
  const mem=teamDoc(players);mem.meta.statusRuns={a:[{s:'ok',from:'2026-10-06',to:'2026-10-06'}]};
  const h=fixture(players,mem);h.c.scoutDataLoaded=true;h.c.save({skipTargets:true});
  assert.deepEqual(h.main().meta.statusRuns,{a:[{s:'ok',from:'2026-10-06',to:'2026-10-06'}]});
});
test('불러온 뒤에는 선수 행 반영이 예전처럼 돈다 — 다른 기기가 더한 선수는 들어오고 기록 칸은 남는다',async()=>{
  const h=fixture(players,teamDoc(players),{noBlob:true});h.c.scoutDataLoaded=true;h.c.scoutBootPending=false;
  const fetch=h.c.syncFetch;h.c.syncFetch=async(stage,...args)=>stage==='items_conflict'?{ok:true,json:async()=>[...h.server.values()]}:fetch(stage,...args);
  const remote=p('c','Player C','B');h.server.set('sq:c',{workspace_id:'team-a',k:'sq:c',v:raw(remote),cupd:11});
  const r=await h.run();assert.equal(r.error,undefined,raw(h.errors));await h.c.itemsApply('sync');
  assert.deepEqual(Array.from(h.c.data.players,x=>x.id),['a','b','c']);const d=h.main();assert.equal(d.players.length,3);assert.deepEqual(d.meta.statusRuns,HISTORY.statusRuns);assert.deepEqual(d.meta.participationDays,HISTORY.participationDays);assert.equal(d.attrs.length,1);
});
test('scout.html: load() 가 실제로 불러온 뒤에만 표식을 켠다 · storage 리스너의 반영도 같은 itemsApply 를 지난다',()=>{
  const load=fn(scout,'load');assert.match(load,/scoutDataLoaded=true;/);
  assert.ok(load.indexOf('if(typeof scoutBootPending!==\'undefined\'&&scoutBootPending)return false;')<load.indexOf('scoutDataLoaded=true;'),'부팅 중 load 는 표식 전에 돌아간다');
  assert.match(scout,/var scoutDataLoaded=false;/);
});
