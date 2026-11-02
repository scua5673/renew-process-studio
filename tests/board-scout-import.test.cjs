const test=require('node:test');
const assert=require('node:assert/strict');
const API=require('../studio/board-scout-import.js');
const S=require('../studio/scouting-store.js');
const L=require('../studio/team-load.js');
function source(){return S.reconcile(null,{v:1,players:[
 {id:'p1',dbId:'one',name:'후보 하나',num:0,club:'프로세스FC',posId:'lw',scoutSt:'go'},
 {id:'p2',dbId:'one',name:'옛 이름',posId:'cm',scoutSt:'signed'},
 {id:'p3',name:'삭제 후보',posId:'cm'},
 {id:'p4',name:'숨긴 후보',_scoutHidden:true},
 {id:'p5',name:'복원 후보',_scoutMove:{at:300}},
 {id:'p6',name:'보관 후보'}]});}
const team={positions:[{id:'lw',name:'LW'},{id:'cm',name:'CM'}],meta:{posAbbr:{cm:'LCM'}}};
test('current canonical candidates appear once, with positions/stages and deletion rules preserved',()=>{
 const d=source();S.archive(d,'target:p6',100,{at:100,id:'archive'});
 d.scoutRegistry.candidates['db:unplaced']={id:'db:unplaced',info:{name:'미배치 후보'},source:{pos:['RW']}};
 const before=JSON.stringify(d),r=API.rows(d,team,{p3:200,p5:200},S,L.code);
 assert.deepEqual(r.map(p=>p.name),['후보 하나','복원 후보','미배치 후보']);
 assert.deepEqual(r[0].positions,['LW','LCM']);assert.equal(r[0].status,'mixed');assert.equal(r[0].no,'0');
 assert.equal(r[2].pos,'RW');assert.equal(JSON.stringify(d),before);
 assert.deepEqual(Object.keys(r[0]).sort(),['club','id','name','no','pos','positions','status'].sort(),'private notes, assessments, photos are never projected onto board data');
});
test('search, stage and any of a candidate’s positions can narrow the roster',()=>{
 const r=API.rows(source(),team,{},S,L.code);
 assert.equal(API.filter(r,'프로세스FC 0','mixed','LCM').length,1);
 assert.equal(API.filter(r,'프로세스FC','go','').length,0);
 assert.equal(API.filter(r,'없는 이름','','').length,0);
});
function win(){
 const raw={'cs_scout_targets_v1':JSON.stringify(source()),scout_tool_v1:JSON.stringify(team),cs_player_del_v1:'{}'};
 let permitted=true;const w={localStorage:{getItem:k=>raw[k]??null},storage:{get:async k=>raw[k]?{value:raw[k]}:null},PSStorage:{sharedReady:async()=>{},sharedVerified:async(k,v)=>{assert.equal(raw[k],v);}},PSScoutStore:{createClient:()=>({prepare:async()=>{if(!permitted)throw Error('denied');return JSON.parse(raw.cs_scout_targets_v1);},check:()=>{if(!permitted)throw Error('changed');}})}};
 return {w,raw,deny:()=>{permitted=false;}};
}
test('a prepared import rejects changes of permission, team roster or tombstones',async()=>{
 for(const key of ['scout_tool_v1','cs_player_del_v1']){const f=win(),r=await API.read(f.w);r.check();f.raw[key]='{} ';assert.throws(r.check,/명단이 바뀌/);}
 const f=win(),r=await API.read(f.w);f.deny();assert.throws(r.check,/changed/);await assert.rejects(API.read(f.w),/denied/);
});
test('durable-read failures and absent-mirror disagreements cannot produce an import',async()=>{
 const f=win();f.w.PSStorage.sharedVerified=async()=>{throw Error('durable mismatch');};await assert.rejects(API.read(f.w),/mismatch/);
 const g=win();delete g.raw.scout_tool_v1;g.w.storage.get=async()=>({value:'{"players":[]}'});await assert.rejects(API.read(g.w),/다시 불러/);
});
