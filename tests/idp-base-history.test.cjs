'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module'),J=require('../studio/autosave-journal.js');
const full=path.join(__dirname,'team-data-consistency.test.cjs'),fixture=fs.readFileSync(full,'utf8');
const box={require:createRequire(full),__dirname,module:{exports:{}},console,URL,setImmediate,Buffer};
vm.runInNewContext(fixture.slice(0,fixture.indexOf('\nconst pushed='))+'\nmodule.exports={harness};',box);
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const helpers=source.slice(source.indexOf('var syncBaseMem='),source.indexOf('function normalizeCoachDocument('));
const raw=JSON.stringify,privateKey='cs_idp_v1_player-a',publicKey='cs_idp_pub_v1_player-a';
const doc=(key,values)=>raw(key===privateKey?{v:1,log:values,imgNotes:[]}:{v:1,reacts:values});
async function setup(key,withHistory=true,options={}){
 const original=doc(key,{}),local=doc(key,{local:{memo:'SYNTHETIC local',t:'SYNTHETIC local'}}),remote=doc(key,{remote:{memo:'SYNTHETIC remote',t:'SYNTHETIC remote'}});
 const h=box.module.exports.harness({key,dynamic:true,localOnly:true,uid:key===privateKey?'player-a':'coach-a',server:remote,cupd:3,mirror:local,...options});
 h.baseline(original,1);vm.runInContext(helpers,h.c);
 const aux=new Map(),ctx=()=>({uid:h.c.getSess().uid,wid:h.c.activeWs(),seal:h.local.get('ps_cache_owner_v1'),epoch:0});
 Object.assign(h.c,{autosaveEnabled:()=>true,autosaveContext:ctx,isMergeBaseKey:k=>k===key});
 h.c.PSStorage.auxGet=async k=>aux.get(k)||null;h.c.PSStorage.auxSet=async(k,v)=>{aux.set(k,v);return true;};
 const journal=J.create({storage:h.c.storage,context:ctx,hash:h.c.hash});h.c.autosaveJournal=()=>journal;
 const auxKey=h.c.syncBaseKey(key,'team-a');aux.set(auxKey,h.c.IDP_BASE_TAG+raw({v:1,c:{r:remote,h:h.c.hash(remote),u:3}}));
 if(withHistory)await journal.capture(ctx(),key,original,h.c.hash(original),1);
 return {h,key,original,local,remote,aux,auxKey,journal,ctx};
}
for(const key of [privateKey,publicKey])test('exact journal ancestor restores IDP merge and server ACK: '+key,async()=>{
 const f=await setup(key),before=f.aux.get(f.auxKey);await f.h.mark();
 await f.h.c.syncBasePrimeAll('team-a',f.h.c.meta());
 assert.equal(f.h.c.syncBaseGet(key,'team-a'),f.original);assert.equal(f.aux.get(f.auxKey),before);
 assert.equal(f.h.local.get(key),f.local);assert.equal(f.h.queue.length,1,'priming does not ACK edits');
 const result=await f.h.run();assert.equal(result.error,undefined,JSON.stringify(f.h.errors));
 const saved=JSON.parse(f.h.server.get(key).v),items=key===privateKey?saved.log:saved.reacts;
 assert.ok(items.local);assert.ok(items.remote);assert.equal(f.h.queue.length,0);
});
test('absent exact history keeps both originals and the pending edit',async()=>{
 const f=await setup(privateKey,false);await f.h.mark();await f.h.run();
 assert.equal(f.h.local.get(f.key),f.local);assert.equal(f.h.server.get(f.key).v,f.remote);assert.equal(f.h.queue.length,1);
 assert.ok(f.h.errors.some(x=>x.stage==='idp-private-base-untrusted'));
});
test('the same hash at a different server version is not an ancestor',async()=>{
 const f=await setup(privateKey,false);await f.journal.capture(f.ctx(),f.key,f.original,f.h.c.hash(f.original),2);
 await f.h.c.syncBasePrimeAll('team-a',f.h.c.meta());assert.equal(f.h.c.syncBaseGet(f.key,'team-a'),null);
});
test('history recovery preserves diary deletions and device-only image notes',async()=>{
 const f=await setup(privateKey,false),original=doc(privateKey,{removed:{memo:'deleted day'}});
 const local=raw({v:1,log:{local:{memo:'new day'}},imgNotes:[{id:'private-image',memo:'SYNTHETIC PRIVATE NOTE'}]});
 const remote=doc(privateKey,{removed:{memo:'deleted day'},remote:{memo:'other device'}});
 const m=f.h.c.meta();m.h[f.key]=f.h.c.hash(original);m.c[f.key]=1;f.h.c.setMetaExact(m);f.h.local.set(f.key,local);
 f.h.server.set(f.key,{workspace_id:'team-a',k:f.key,v:remote,cupd:3});
 await f.journal.capture(f.ctx(),f.key,original,f.h.c.hash(original),1);await f.h.mark();
 const result=await f.h.run();assert.equal(result.error,undefined,JSON.stringify(f.h.errors));
 const saved=JSON.parse(f.h.server.get(f.key).v),current=JSON.parse(f.h.local.get(f.key));
 assert.equal(saved.log.removed,undefined);assert.ok(saved.log.remote);assert.ok(saved.log.local);
 assert.deepEqual(saved.imgNotes,[]);assert.equal(current.imgNotes[0].memo,'SYNTHETIC PRIVATE NOTE');assert.equal(f.h.queue.length,0);
});
test('corrupt journal history does not change the local draft or confirm pending edits',async()=>{
 const f=await setup(privateKey);for(const k of f.h.idb.keys())if(k.startsWith(J.PREFIX))f.h.idb.set(k,'corrupt');
 await f.h.mark();await f.h.run();assert.equal(f.h.local.get(f.key),f.local);assert.equal(f.h.server.get(f.key).v,f.remote);assert.equal(f.h.queue.length,1);
});
for(const change of ['account','meta'])test('journal read cannot repair a changed '+change+' context',async()=>{
 const f=await setup(privateKey),actual=f.h.c.storage.get;let changed=false;
 f.h.c.storage.get=async k=>{if(!changed&&k.startsWith(J.PREFIX)){changed=true;if(change==='account')f.h.switch();else{const m=f.h.c.meta();m.c[f.key]=9;f.h.c.setMetaExact(m);}}return actual(k);};
 await f.h.c.syncBasePrimeAll('team-a',f.h.c.meta());assert.equal(f.h.c.syncBaseGet(f.key,'team-a'),null);
 assert.equal(f.h.local.get(f.key),f.local);assert.equal(f.h.server.get(f.key).v,f.remote);
});

test('read-state-only divergence converges without an ancestor while retaining private image notes',async()=>{
 const f=await setup(privateKey,false),local=raw({v:1,log:{},imgNotes:[{id:'mine',memo:'SYNTHETIC PRIVATE'}],noticeSeen:20}),remote=raw({v:1,log:{},imgNotes:[],noticeSeen:10});
 f.h.local.set(f.key,local);f.h.server.set(f.key,{workspace_id:'team-a',k:f.key,v:remote,cupd:3});await f.h.mark();
 const result=await f.h.run();assert.equal(result.error,undefined,JSON.stringify(f.h.errors));
 assert.equal(JSON.parse(f.h.server.get(f.key).v).noticeSeen,20);assert.deepEqual(JSON.parse(f.h.server.get(f.key).v).imgNotes,[]);
 assert.equal(JSON.parse(f.h.local.get(f.key)).imgNotes[0].memo,'SYNTHETIC PRIVATE');assert.equal(f.h.queue.length,0);
});
test('read-state repair never treats authored differences or invalid read markers as equal',async()=>{
 const f=await setup(privateKey,false),base={v:1,log:{},imgNotes:[],noticeSeen:10};
 for(const changed of [{...base,log:{day:{memo:'authored'}}},{...base,noticeSeen:'invalid'}])assert.equal(f.h.c.idpReadStateMerge(f.key,raw(changed),raw(base),true),null);
 assert.equal(f.h.c.idpReadStateMerge(publicKey,raw(base),raw({...base,noticeSeen:20}),true),null);
});
test('read-state merge keeps later server read time and both sets of device-only images',async()=>{
 const f=await setup(privateKey,false),local=raw({v:1,log:{},imgNotes:[{id:'local'}],noticeSeen:10}),remote=raw({v:1,log:{},imgNotes:[{id:'legacy-server'}],noticeSeen:20});
 const result=f.h.c.idpReadStateMerge(f.key,local,remote,true);assert.equal(JSON.parse(result.cloud).noticeSeen,20);
 assert.deepEqual(JSON.parse(result.local).imgNotes.map(x=>x.id),['local','legacy-server']);assert.deepEqual(JSON.parse(result.cloud).imgNotes,[]);
 assert.equal(f.h.c.idpReadStateMerge(f.key,local,remote,false),null,'personal-space image edits remain authored differences');
});

test('read-state repair needs a matching server CAS acknowledgement before clearing pending',async()=>{
 const f=await setup(privateKey,false,{casZero:true}),local=raw({v:1,log:{},imgNotes:[],noticeSeen:20}),remote=raw({v:1,log:{},imgNotes:[],noticeSeen:10});
 f.h.local.set(f.key,local);f.h.server.set(f.key,{workspace_id:'team-a',k:f.key,v:remote,cupd:3});await f.h.mark();
 const result=await f.h.run();assert.ok(result.error||result.pending);assert.equal(f.h.server.get(f.key).v,remote);
 assert.equal(f.h.local.get(f.key),local);assert.equal(f.h.queue.length,1);
});
