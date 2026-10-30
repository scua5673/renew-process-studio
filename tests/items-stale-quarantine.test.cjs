'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const J=require('../studio/autosave-journal.js');
const Q=require('../studio/sync-items-stale.js');
const R=require('../studio/roster-outbox.js');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const raw=JSON.stringify;
const ROW='sq:p1',CARRIERS=['scout_tool_v1','cs_squad_v1','cs_team_attrs_v1'];
const BASE=' {"id":"p1","name":"Synthetic original","memo":"baseline","unknown":{"x":1}}\n';
const A=raw({id:'p1',name:'Synthetic original',memo:'authored A'});
const B='\n '+raw({id:'p1',name:'Synthetic original',memo:'other writer B',unknown:{bytes:'keep exactly'}})+'\n';
const C=raw({id:'p1',name:'Synthetic original',memo:'latest writer C'});
const D=raw({id:'p1',name:'Synthetic original',memo:'concurrent writer D'});
const PERMISSION=raw({role:'admin',edit:{team:true,scout:true}});
function stale(job,stage='items_write_stale_job'){
 return Object.assign(Error('synthetic stale preimage'),{psCode:'sync_local_changed',psStage:stage,psItemsJob:job,psItemId:'p1'});
}
function fixture(){
 let owner={uid:'synthetic-coach-a',wid:'synthetic-team-a',seal:'seal-a',epoch:'epoch-a',signout:0},permission=PERMISSION,uuid=0,at=1000;
 let context={uid:owner.uid,wid:owner.wid,seal:'autosave-seal-a',epoch:'epoch-a'};
 const disk=new Map([[ROW,B]]),calls=[],hooks={},localDisk=new Map(),localCalls=[],localHooks={};
 const localStorage={get length(){return localDisk.size;},key:i=>[...localDisk.keys()][i]??null,getItem:k=>localDisk.get(k)??null,setItem(k,v){if(localHooks.set)localHooks.set(k,v);localDisk.set(k,String(v));localCalls.push({method:'set',key:k,value:String(v)});},removeItem(k){localCalls.push({method:'remove',key:k});localDisk.delete(k);}};
 const makeOutbox=()=>R.create({storage:localStorage,owner:()=>context?{uid:context.uid,wid:context.wid}:null}),outbox=makeOutbox();
 const storage={
  async get(k){calls.push({method:'get',key:k});if(hooks.get)await hooks.get(k);return disk.has(k)?{value:disk.get(k)}:null;},
  async set(k,v,current){calls.push({method:'set',key:k,value:v});if(hooks.set)await hooks.set(k,v);if(current&&current()===false)throw Error('synthetic rejected owner guard');if(hooks.noop)return false;disk.set(k,hooks.rewrite?hooks.rewrite(k,v):v);if(hooks.afterSet)await hooks.afterSet(k,v);return true;},
  async keys(prefix){calls.push({method:'keys',prefix});if(hooks.keys)await hooks.keys(prefix);return [...disk.keys()];},
  async replaceIfValue(k,before,value,current){if(hooks.cas)await hooks.cas(k,before,value);if(current&&current()===false)throw Error('synthetic rejected owner guard');if((disk.get(k)??null)!==before)return false;if(value===null)disk.delete(k);else disk.set(k,value);calls.push({method:'cas',key:k,before,value});return true;},
  async setIfValues(k,expected,value,checks,current){
   calls.push({method:'atomic-attempt',key:k,value,checks:{...checks}});
   if(hooks.atomic)await hooks.atomic(k,value,checks);
   if(current&&current()!==true)throw Error('synthetic rejected atomic owner guard');
   if((disk.get(k)??null)!==expected||Object.keys(checks).some(key=>(disk.get(key)??null)!==checks[key]))return false;
   if(hooks.atomicNoop)return false;
   disk.set(k,hooks.atomicRewrite?hooks.atomicRewrite(k,value):value);
   calls.push({method:'atomic-commit',key:k,value:disk.get(k)});
   if(hooks.afterAtomic)await hooks.afterAtomic(k,value);
   return disk.get(k)===value;
  }
 };
 const journal=J.create({storage,context:()=>context,hash:J.hash,randomUUID:()=> '00000000-0000-4000-8000-'+String(++uuid).padStart(12,'0'),now:()=>at++});
 const same=o=>!!o&&!!owner&&['uid','wid','seal','epoch','signout'].every(k=>o[k]===owner[k]);
 const deps={context:()=>context,journal:()=>journal,current:same,permission:()=>permission,storage,hash:J.hash,createJournal:J.create,journalPrefix:J.PREFIX,outbox:()=>outbox};
 const job=(patch=false)=>({players:[JSON.parse(A)],owner:{...owner},at:50,sequence:1,expected:{p1:BASE},written:[],predecessors:[],patch,permission:patch?permission:undefined,changedIds:patch?['p1']:[],deletedIds:[]});
 const archiveRows=async()=>journal.list({...context});
 return {api:Q.create(deps),deps,journal,disk,calls,hooks,job,archiveRows,outbox,makeOutbox,localDisk,localCalls,localHooks,get owner(){return owner;},get context(){return context;},setPermission(v){permission=v;},move(change){owner=change===null?null:{...owner,...change};context=owner?{uid:owner.uid,wid:owner.wid,seal:'autosave-'+owner.seal,epoch:owner.epoch}:null;}};
}

for(const patch of [false,true])test(`${patch?'patch':'ordinary'} stale background job archives exact authored/base/device bodies before releasing unrelated sync`,async()=>{
 const h=fixture(),job=h.job(patch),error=stale(job);let runs=0;
 await h.api.background(async()=>{runs++;throw error;});
 const rows=await h.archiveRows();assert.equal(rows.length,1);assert.equal(rows[0].reason,'items-stale-device');
 const kept=await h.journal.read({...h.context},rows[0].id),local=JSON.parse(kept.localRaw),device=JSON.parse(kept.remoteRaw);
 assert.equal(local.kind,'items-stale-device');assert.deepEqual(local.expected,{p1:BASE});assert.deepEqual(local.authored,{p1:A});assert.equal(local.sequence,1);assert.equal(local.owner.uid,h.owner.uid);
 assert.equal(device.kind,'items-stale-device-comparison');assert.equal(device.provenance,'device-idb');assert.deepEqual(device.values,{p1:B});
 assert.equal(local.permission,undefined,'permission documents are not recovery content');assert.equal(local.permissionHash,J.hash(patch?PERMISSION:''));
 assert.equal(h.disk.get(ROW),B);assert.equal(runs,1);assert.equal(h.api.skip(job),true);
 for(const k of [...CARRIERS,ROW])assert.equal(h.api.fenced(k),true,k);
 assert.equal(h.api.fenced('process_coach_v1'),false);assert.equal(h.api.fenced('sq:unrelated'),false);
 assert.ok(h.api.count()>0);const state=h.api.state({kind:'ok',text:'팀과 같아요',n:0,review:0});assert.notEqual(state.kind,'ok');assert.ok(state.n>0||state.review>0);
 assert.equal(h.api.state({kind:'bad',reason:'sync_storage',n:0,review:0}).kind,'bad');
 assert.ok(h.calls.filter(c=>c.method==='set').every(c=>c.key.startsWith(J.PREFIX)),'the quarantine is never a business-row write');
});

test('direct guards stay failed after durable quarantine and a newer C job cannot overwrite B or replace archived A',async()=>{
 const h=fixture(),job=h.job();await h.api.background(()=>Promise.reject(stale(job)));
 const rows=await h.archiveRows(),original=await h.journal.read({...h.context},rows[0].id);
 await assert.rejects(h.api.before(job),e=>e.psStage==='items_stale_review');
 const newer={...h.job(true),sequence:2,at:60,players:[JSON.parse(C)],expected:{p1:B}};
 await assert.rejects(h.api.before(newer),e=>e.psStage==='items_stale_review');
 assert.equal(h.api.skip(newer),false);assert.equal(h.disk.get(ROW),B);
 assert.deepEqual(await h.journal.read({...h.context},rows[0].id),original);
});

test('a partial own CAS remains immutable provenance and does not permit writing the changed second row',async()=>{
 const h=fixture(),base2=raw({id:'p2',memo:'base2'}),a2=raw({id:'p2',memo:'authored2'}),b2=raw({id:'p2',memo:'other2'}),job=h.job(true);
 job.players.push(JSON.parse(a2));job.expected.p2=base2;job.changedIds.push('p2');job.written.push({id:'p1',before:BASE,after:A});h.disk.set(ROW,A);h.disk.set('sq:p2',b2);
 await h.api.background(()=>Promise.reject(stale(job)));
 const row=(await h.archiveRows())[0],kept=await h.journal.read({...h.context},row.id),local=JSON.parse(kept.localRaw),device=JSON.parse(kept.remoteRaw);
 assert.deepEqual(local.written,[{id:'p1',before:BASE,after:A}]);assert.deepEqual(local.expected,{p1:BASE,p2:base2});assert.deepEqual(local.authored,{p1:A,p2:a2});assert.deepEqual(device.values,{p1:A,p2:b2});
 assert.equal(h.disk.get('sq:p2'),b2);assert.equal(h.api.fenced('sq:p2'),true);
 job.written.push({id:'p2',before:b2,after:a2});assert.equal(h.api.skip(job),false,'a changed job cannot inherit an old exact quarantine receipt');
});

test('changing B to C during archive verification preserves C and cannot release the current round on an old receipt',async()=>{
 const h=fixture(),job=h.job(),gate=deferred();let entered;
 const started=new Promise(r=>entered=r);h.hooks.set=async(k)=>{if(k.startsWith(J.PREFIX)){entered();await gate.promise;}};
 const work=h.api.background(()=>Promise.reject(stale(job)));await started;
 assert.equal(await h.deps.storage.replaceIfValue(ROW,B,C),true);gate.resolve();
 await assert.rejects(work);assert.equal(h.disk.get(ROW),C);assert.equal(h.api.skip(job),false);
 const rows=await h.archiveRows();assert.equal(rows.length,1);const kept=await h.journal.read({...h.context},rows[0].id);assert.equal(JSON.parse(kept.remoteRaw).values.p1,B);
});

for(const mode of ['reject','noop','rewrite'])test(`archive ${mode} never converts a stale write into a safe background defer`,async()=>{
 const h=fixture(),job=h.job();
 if(mode==='reject')h.hooks.set=()=>{throw Error('synthetic archive I/O failure');};
 if(mode==='noop')h.hooks.noop=true;
 if(mode==='rewrite')h.hooks.rewrite=(_k,v)=>v+' ';
 await assert.rejects(h.api.background(()=>Promise.reject(stale(job))));assert.equal(h.api.skip(job),false);assert.equal(h.disk.get(ROW),B);
});

test('owner generation change while archive I/O waits cannot authorize unrelated sync or a newer owner job',async()=>{
 const h=fixture(),job=h.job(),gate=deferred();let entered;const started=new Promise(r=>entered=r);
 h.hooks.set=async()=>{entered();await gate.promise;};const work=h.api.background(()=>Promise.reject(stale(job)));await started;h.move({seal:'new-generation',epoch:'epoch-b'});gate.resolve();
 await assert.rejects(work);assert.equal(h.api.skip(job),false);assert.equal(h.disk.get(ROW),B);
});

test('permission change during patch archival rejects the defer even when account and team are unchanged',async()=>{
 const h=fixture(),job=h.job(true),gate=deferred();let entered;const started=new Promise(r=>entered=r);
 h.hooks.set=async()=>{entered();await gate.promise;};const work=h.api.background(()=>Promise.reject(stale(job)));await started;h.setPermission('changed-permission');gate.resolve();
 await assert.rejects(work);assert.equal(h.api.skip(job),false);assert.equal(h.disk.get(ROW),B);
});

test('reload rediscovers durable quarantine with a fresh same-account generation and never auto-clears server-equal B',async()=>{
 const h=fixture(),job=h.job();await h.api.background(()=>Promise.reject(stale(job)));const before=[...h.disk.entries()];
 h.move({seal:'same-account-reloaded',epoch:'epoch-b'});const reloaded=Q.create(h.deps);await reloaded.load();
 assert.ok(reloaded.count()>0);assert.equal(reloaded.fenced(ROW),true);assert.equal(reloaded.skip(job),false);
 await reloaded.load();assert.ok(reloaded.count()>0);assert.deepEqual([...h.disk.entries()],before,'reading the server-equal device original is no clear or confirmation');
 h.move({uid:'synthetic-coach-b',wid:'synthetic-team-b',seal:'foreign'});await reloaded.load();assert.equal(reloaded.count(),0);assert.equal(reloaded.fenced(ROW),false);assert.deepEqual([...h.disk.entries()],before);
});

test('unclassified I/O and owner failures still reject the background round without a quarantine receipt',async()=>{
 for(const error of [Error('synthetic normal storage failure'),Object.assign(Error('owner changed'),{psCode:'sync_workspace_changed',psStage:'items_write_owner'})]){
  const h=fixture(),job=h.job();error.psItemsJob=job;await assert.rejects(h.api.background(()=>Promise.reject(error)),e=>e===error);assert.equal((await h.archiveRows()).length,0);assert.equal(h.disk.get(ROW),B);
 }
});

test('unknown persisted archive content or a failed reload read cannot produce an idle successful state',async()=>{
 const h=fixture(),job=h.job();await h.api.background(()=>Promise.reject(stale(job)));const reloaded=Q.create(h.deps);h.hooks.get=k=>{if(k.startsWith(J.PREFIX))throw Error('synthetic reload read failure');};
 await assert.rejects(reloaded.load());assert.notEqual(reloaded.state({kind:'ok',text:'팀과 같아요',n:0,review:0}).kind,'ok');assert.equal(reloaded.fenced(ROW),true);assert.equal(h.disk.get(ROW),B);
});

async function archivedFixture(){
 const h=fixture(),job=h.job(true);await h.api.background(()=>Promise.reject(stale(job)));
 const row=(await h.archiveRows()).find(r=>r.reason==='items-stale-device'),value=await h.journal.read({...h.context},row.id);
 return {h,job,row,value};
}
const resolutionRows=async h=>(await h.archiveRows()).filter(r=>r.reason==='items-stale-resolved');
const businessWrites=h=>h.calls.filter(c=>['set','cas','atomic-commit'].includes(c.method)&&!c.key.startsWith(J.PREFIX));

// Prepare and confirm are distinct user actions. Neither selects an old authored
// body for the business row; confirm only records an immutable review decision.
test('prepare is read-only and explicit confirmation preserves both originals while retiring exactly its job',async()=>{
 const {h,job,row,value}=await archivedFixture(),before=[...h.disk.entries()],writeCount=h.calls.filter(c=>['set','cas','atomic-commit'].includes(c.method)).length;
 const view=await h.api.prepare(row,value,()=>true);
 assert.equal(view.token,row.id);assert.deepEqual(JSON.parse(view.currentRaw),{provenance:'device-idb',values:{p1:B}});
 assert.deepEqual([...h.disk.entries()],before);assert.equal(h.calls.filter(c=>['set','cas','atomic-commit'].includes(c.method)).length,writeCount);assert.equal(h.api.count(),1);assert.equal(h.api.retired(job),false);
 assert.deepEqual(await h.api.resolve(row,value,view,()=>true),{resolved:true});
 assert.equal(h.api.count(),0);assert.equal(h.api.fenced(ROW),false);assert.equal(h.api.retired(job),true);assert.equal(h.disk.get(ROW),B);assert.equal(businessWrites(h).length,0);
 for(const [k,v] of before)assert.equal(h.disk.get(k),v,'the original row/archive is immutable');
 const markers=await resolutionRows(h);assert.equal(markers.length,1);const marker=await h.journal.read({...h.context},markers[0].id),choice=JSON.parse(marker.localRaw);
 assert.equal(choice.kind,'items-stale-resolution');assert.equal(choice.choice,'keep-current-device');assert.equal(choice.archiveId,row.id);assert.equal(choice.originalLocalRaw,value.localRaw);assert.equal(choice.originalRemoteRaw,value.remoteRaw);assert.equal(choice.currentRaw,view.currentRaw);assert.equal(marker.remoteRaw,view.currentRaw);
 await assert.rejects(h.api.resolve(row,value,view,()=>true),'one confirmation cannot be replayed');
});

test('a new C already present when prepare is opened can be explicitly kept without choosing archived A or B',async()=>{
 const {h,job,row,value}=await archivedFixture();assert.equal(await h.deps.storage.replaceIfValue(ROW,B,C),true);
 const original=await h.journal.read({...h.context},row.id),view=await h.api.prepare(row,value,()=>true);
 assert.equal(JSON.parse(view.currentRaw).values.p1,C);assert.equal(h.api.count(),1);assert.equal((await resolutionRows(h)).length,0);
 await h.api.resolve(row,value,view,()=>true);assert.equal(h.disk.get(ROW),C);assert.equal(h.api.retired(job),true);assert.deepEqual(await h.journal.read({...h.context},row.id),original);
 const fresh={...h.job(true),sequence:2,at:60,players:[JSON.parse(C)],expected:{p1:B}};assert.equal(h.api.retired(fresh),false);await h.api.before(fresh);
});

test('new D between prepare and confirm rejects without any resolution marker or business write',async()=>{
 const {h,row,value}=await archivedFixture(),view=await h.api.prepare(row,value,()=>true);assert.equal(await h.deps.storage.replaceIfValue(ROW,B,D),true);const writes=businessWrites(h).length;
 await assert.rejects(h.api.resolve(row,value,view,()=>true));assert.equal(h.disk.get(ROW),D);assert.equal((await resolutionRows(h)).length,0);assert.equal(h.api.count(),1);assert.equal(h.api.fenced(ROW),true);assert.equal(businessWrites(h).length,writes);
});

test('new D immediately before atomic marker commit fails the exact source check and leaves no marker',async()=>{
 const {h,row,value}=await archivedFixture(),view=await h.api.prepare(row,value,()=>true);let attempts=0;
 h.hooks.atomic=()=>{attempts++;h.disk.set(ROW,D);};await assert.rejects(h.api.resolve(row,value,view,()=>true));
 assert.equal(attempts,1);assert.equal(h.disk.get(ROW),D);assert.equal((await resolutionRows(h)).length,0);assert.equal(h.api.count(),1);assert.equal(h.calls.filter(c=>c.method==='atomic-commit').length,0);
});

for(const change of ['selection','owner','permission'])test(`${change} change between review and confirmation cannot retire the original`,async()=>{
 const {h,job,row,value}=await archivedFixture();let selected=true;const view=await h.api.prepare(row,value,()=>selected);
 if(change==='selection')selected=false;else if(change==='owner')h.move({seal:'new-owner-generation',epoch:'epoch-new'});else h.setPermission(raw({role:'player',edit:{team:false,scout:false}}));
 await assert.rejects(h.api.resolve(row,value,view,()=>selected));assert.equal((await resolutionRows(h)).length,0);assert.equal(h.api.retired(job),false);assert.equal(h.disk.get(ROW),B);assert.equal(h.calls.filter(c=>c.method==='atomic-commit').length,0);
});

for(const change of ['selection','owner','permission'])test(`${change} change inside the final atomic boundary rejects before marker storage`,async()=>{
 const {h,row,value}=await archivedFixture();let selected=true;const view=await h.api.prepare(row,value,()=>selected);
 h.hooks.atomic=()=>{if(change==='selection')selected=false;else if(change==='owner')h.move({seal:'atomic-owner-generation',epoch:'epoch-new'});else h.setPermission(raw({role:'player'}));};
 await assert.rejects(h.api.resolve(row,value,view,()=>selected));assert.equal((await resolutionRows(h)).length,0);assert.equal(h.disk.get(ROW),B);assert.equal(h.calls.filter(c=>c.method==='atomic-commit').length,0);
});

for(const mode of ['reject','noop'])test(`resolution ${mode} I/O retains pending review and all exact original bodies`,async()=>{
 const {h,job,row,value}=await archivedFixture(),before=[...h.disk.entries()],view=await h.api.prepare(row,value,()=>true);
 if(mode==='reject')h.hooks.atomic=()=>{throw Error('synthetic resolution disk failure');};else h.hooks.atomicNoop=true;
 await assert.rejects(h.api.resolve(row,value,view,()=>true));assert.deepEqual([...h.disk.entries()],before);assert.equal(h.api.retired(job),false);assert.equal(h.api.count(),1);assert.equal(h.api.fenced(ROW),true);assert.equal((await resolutionRows(h)).length,0);
});

test('same-account reload reads an exact resolution marker and retires only its original job, never a fresh C edit',async()=>{
 const {h,job,row,value}=await archivedFixture(),view=await h.api.prepare(row,value,()=>true);await h.api.resolve(row,value,view,()=>true);const before=[...h.disk.entries()];
 const reloaded=Q.create(h.deps);assert.equal(await reloaded.load(),0);assert.equal(reloaded.retired(job),true);
 const fresh={...h.job(true),sequence:2,at:60,players:[JSON.parse(C)],expected:{p1:B}};assert.equal(reloaded.retired(fresh),false);assert.equal(reloaded.skip(fresh),false);await reloaded.before(fresh);assert.deepEqual([...h.disk.entries()],before);
});

test('resolving A leaves a separate C archive of the same player pending and retains both immutable pairs',async()=>{
 const {h,job,row,value}=await archivedFixture(),newer={...h.job(true),sequence:2,at:60,players:[JSON.parse(C)],expected:{p1:B}};
 await h.api.background(()=>Promise.reject(stale(newer)));assert.equal(h.api.count(),2);const before=[...h.disk.entries()],view=await h.api.prepare(row,value,()=>true);
 await h.api.resolve(row,value,view,()=>true);assert.equal(h.api.count(),1);assert.equal(h.api.fenced(ROW),true);assert.equal(h.api.retired(job),true);assert.equal(h.api.retired(newer),false);
 for(const [k,v] of before)assert.equal(h.disk.get(k),v,'every unresolved and resolved original stays immutable');assert.equal((await resolutionRows(h)).length,1);
 const reloaded=Q.create(h.deps);assert.equal(await reloaded.load(),1);assert.equal(reloaded.retired(job),true);assert.equal(reloaded.retired(newer),false);assert.equal(reloaded.fenced(ROW),true);await assert.rejects(reloaded.before(newer),e=>e.psStage==='items_stale_review');
});

test('an older empty load cannot overwrite a newer exact quarantine publication',async()=>{
 const h=fixture(),gate=deferred(),entered=deferred();let reads=0;
 h.deps.journal=()=>Object.assign({},h.journal,{async list(ctx){const result=await h.journal.list(ctx);if(++reads===1){entered.resolve();await gate.promise;}return result;}});
 const old=h.api.load(),oldResult=old.then(value=>({value}),error=>({error}));await entered.promise;
 const job=h.job();await h.api.capture(job,stale(job));assert.equal(h.api.count(),1);assert.equal(h.api.fenced(ROW),true);
 gate.resolve();const late=await oldResult;assert.equal(late.error,undefined);assert.equal(late.value,1,'old empty snapshot joins the newer exact result without publishing');assert.equal(h.api.count(),1);assert.equal(h.api.fenced(ROW),true);assert.equal(h.api.skip(job),true);assert.equal(h.disk.get(ROW),B);
});

test('fresh foreground flush must actually reload durable review before allowing a caller with no in-memory job',async()=>{
 const {h}=await archivedFixture(),fresh=Q.create(h.deps);let calls=0;
 await assert.rejects(fresh.foreground(()=>{calls++;return true;}),e=>e.psStage==='items_stale_review');assert.equal(calls,0);assert.equal(fresh.count(),1);assert.equal(fresh.fenced(ROW),true);assert.equal(h.disk.get(ROW),B);
 const empty=fixture();let allowed=0;assert.equal(await empty.api.foreground(()=>{allowed++;return 'ordinary flush';}),'ordinary flush');assert.equal(allowed,1);
});

for(const phase of ['initial-list','archive-write','exact-readback'])test(`capture lease keeps all player and carrier fences while ${phase} is delayed`,async()=>{
 const h=fixture(),gate=deferred(),entered=deferred(),job=h.job();let held=false;
 function hold(){if(held)return;held=true;entered.resolve();return gate.promise;}
 if(phase==='initial-list')h.hooks.keys=hold;
 if(phase==='archive-write')h.hooks.set=k=>k.startsWith(J.PREFIX)?hold():undefined;
 if(phase==='exact-readback')h.hooks.get=k=>k.startsWith(J.PREFIX)&&h.disk.has(k)?hold():undefined;
 const pending=h.api.capture(job,stale(job));await entered.promise;
 assert.ok(h.api.count()>=1);for(const key of [...CARRIERS,ROW,'sq:another-player'])assert.equal(h.api.fenced(key),true,key);
 const s=h.api.state({kind:'ok',text:'팀과 같아요',n:0,review:0});assert.equal(s.kind,'busy');assert.ok(s.n>=1);assert.equal(h.api.skip(job),false);assert.equal(h.disk.get(ROW),B);
 gate.resolve();await pending;assert.equal(h.api.count(),1);assert.equal(h.api.fenced(ROW),true);assert.equal(h.api.fenced('sq:another-player'),false);assert.equal(h.api.skip(job),true);
});

const stage=(outbox,player,base)=>outbox.stage({players:[JSON.parse(player)],basePlayers:[JSON.parse(base)],changedIds:['p1'],deletedIds:[]});
async function outboxArchived(){
 const h=fixture(),intent=stage(h.outbox,A,BASE),job=h.job(true);job.pendingIntent=intent;
 await h.api.capture(job,stale(job));const row=(await h.archiveRows()).find(r=>r.reason==='items-stale-device'),value=await h.journal.read({...h.context},row.id);
 return {h,job,intent,row,value};
}

test('explicit A resolution settles only its durable outbox sources while later C remains pending across fresh clients',async()=>{
 const {h,job,intent,row,value}=await outboxArchived(),originalBatches=[...h.localDisk.entries()],intentC=stage(h.outbox,C,BASE),allOriginals=[...h.disk.entries()];
 assert.deepEqual(JSON.parse(value.localRaw).intent,intent);const view=await h.api.prepare(row,value,()=>true);
 assert.equal(h.outbox.pending(),true);assert.equal(h.outbox.read().rows[0].player.memo,'latest writer C');await h.api.resolve(row,value,view,()=>true);
 assert.equal(h.disk.get(ROW),B);assert.equal(h.api.retired(job),true);assert.equal(h.api.count(),0);for(const [key,bytes] of allOriginals)assert.equal(h.disk.get(key),bytes);for(const [key,bytes] of originalBatches)assert.equal(h.localDisk.get(key),bytes);
 const markerRow=(await resolutionRows(h))[0],marker=await h.journal.read({...h.context},markerRow.id),proof=JSON.parse(marker.localRaw).settlement;
 assert.equal(h.outbox.settled(proof,()=>true),true);assert.equal(h.localDisk.get(proof.key),proof.raw);assert.equal(JSON.parse(proof.raw).retain,true);assert.deepEqual(proof.sources,intent.rows[0].sources);
 const freshOutbox=h.makeOutbox(),pending=freshOutbox.read();assert.equal(pending.rows.length,1);assert.equal(pending.rows[0].player.memo,'latest writer C');assert.deepEqual(pending.rows[0].sources,[intentC.rows[0].sources.at(-1)]);assert.deepEqual(freshOutbox.overlay([JSON.parse(B)]),[JSON.parse(C)]);
 const fresh=Q.create(Object.assign({},h.deps,{outbox:()=>freshOutbox}));assert.equal(await fresh.load(),0);assert.equal(fresh.retired(job),true);
 const resume={...h.job(true),players:freshOutbox.overlay([JSON.parse(B)]),expected:{p1:B},pendingIntent:pending,sequence:99,at:5000};assert.equal(fresh.retired(resume),false);await fresh.before(resume);assert.equal(resume.players[0].memo,'latest writer C');
 const retained=proof.batches.concat([{key:proof.key,raw:proof.raw}]);assert.equal(freshOutbox.ack(pending),1);assert.equal(freshOutbox.pending(),false);
 for(const entry of retained)assert.equal(h.localDisk.get(entry.key),entry.raw,'normal ACK cleanup must preserve the reviewed original batch and retained ACK');assert.equal(h.outbox.settled(proof,()=>true),true);
});

test('a resolution with an actual outbox ACK I/O failure stays pending and cannot retire or replay its source',async()=>{
 const {h,job,row,value}=await outboxArchived(),before=[...h.localDisk.entries()],view=await h.api.prepare(row,value,()=>true);
 h.localHooks.set=k=>{if(k.includes(':a:'))throw Error('synthetic outbox ACK disk failure');};await assert.rejects(h.api.resolve(row,value,view,()=>true));
 assert.equal(h.api.count(),1);assert.equal(h.api.retired(job),false);assert.equal(h.api.fenced(ROW),true);assert.equal((await resolutionRows(h)).length,0);assert.deepEqual([...h.localDisk.entries()],before);assert.equal(h.outbox.pending(),true);assert.equal(h.disk.get(ROW),B);
});

test('a reloaded resolution cannot retire its original when its actual retained outbox proof is missing',async()=>{
 const {h,job,row,value}=await outboxArchived(),view=await h.api.prepare(row,value,()=>true);await h.api.resolve(row,value,view,()=>true);
 const marker=await h.journal.read({...h.context},(await resolutionRows(h))[0].id),proof=JSON.parse(marker.localRaw).settlement;h.localDisk.delete(proof.key);
 const fresh=Q.create(Object.assign({},h.deps,{outbox:()=>h.makeOutbox()}));await assert.rejects(fresh.load());assert.equal(fresh.retired(job),false);assert.ok(fresh.count()>=1);assert.equal(fresh.fenced(ROW),true);assert.equal(h.disk.get(ROW),B);
 for(const batch of proof.batches)assert.equal(h.localDisk.get(batch.key),batch.raw);
});

async function resolvedOutbox(){
 const f=await outboxArchived(),view=await f.h.api.prepare(f.row,f.value,()=>true);await f.h.api.resolve(f.row,f.value,view,()=>true);return f;
}
const cachedRetry=(h,intent,players=A)=>({...h.job(true),players:[JSON.parse(players)],pendingIntent:intent,expected:{p1:B},sequence:99,at:5000});

test('cached retry: exact settled intent and authored A remain retired despite fresh transport sequence, timestamp, and preimage',async()=>{
 const {h,intent}=await resolvedOutbox(),replay=cachedRetry(h,intent),beforeDisk=[...h.disk.entries()],beforeLocal=[...h.localDisk.entries()];
 const retired=h.api.retired(replay),result=await h.api.before(replay);
 assert.equal(retired,true,'transport metadata cannot revive an explicitly settled cached A intent');assert.equal(result,true,'before returns the retired-job no-write result');
 assert.equal(h.disk.get(ROW),B);assert.equal(h.outbox.pending(),false);assert.deepEqual([...h.disk.entries()],beforeDisk);assert.deepEqual([...h.localDisk.entries()],beforeLocal);
});

test('cached retry: the settled receipt cannot retire a different authored C body',async()=>{
 const {h,intent}=await resolvedOutbox(),fresh=cachedRetry(h,intent,C),beforeDisk=[...h.disk.entries()];
 assert.equal(h.api.retired(fresh),false);assert.notEqual(await h.api.before(fresh),true,'new authored content must use the ordinary guarded path');assert.deepEqual([...h.disk.entries()],beforeDisk);assert.equal(h.disk.get(ROW),B);
});

test('cached retry: same authored A with a new or unknown receipt is not the settled intent',async()=>{
 const {h,intent}=await resolvedOutbox(),newIntent=stage(h.outbox,A,BASE);assert.notDeepEqual(newIntent,intent);
 for(const candidate of [newIntent,null]){
  const fresh=cachedRetry(h,candidate),beforeDisk=[...h.disk.entries()];assert.equal(h.api.retired(fresh),false);assert.notEqual(await h.api.before(fresh),true);assert.deepEqual([...h.disk.entries()],beforeDisk);
 }
 assert.equal(h.outbox.pending(),true);assert.equal(h.disk.get(ROW),B);
});

test('cached retry: permission or owner mismatch never inherits a settled-intent retirement',async()=>{
 const {h,intent}=await resolvedOutbox(),replay=cachedRetry(h,intent);
 h.setPermission(raw({role:'player',edit:{team:false,scout:false}}));assert.equal(h.api.retired(replay),false);await assert.rejects(h.api.before(replay));
 h.setPermission(PERMISSION);h.move({seal:'cached-retry-new-generation',epoch:'new-epoch'});assert.equal(h.api.retired(replay),false);await assert.rejects(h.api.before(replay));assert.equal(h.disk.get(ROW),B);
});

test('cached subset: resolved ordinary roster keeps exact p1 intent retired for its cached patch without retiring any new authored content',async()=>{
 const h=fixture(),intent=stage(h.outbox,A,BASE),p2=raw({id:'p2',name:'Synthetic unchanged',memo:'original p2'}),p2C=raw({id:'p2',name:'Synthetic unchanged',memo:'new p2 input'}),ordinary=h.job(false);
 ordinary.pendingIntent=intent;ordinary.players.push(JSON.parse(p2));ordinary.expected.p2=p2;h.disk.set('sq:p2',p2);
 await h.api.capture(ordinary,stale(ordinary));const row=(await h.archiveRows()).find(r=>r.reason==='items-stale-device'),value=await h.journal.read({...h.context},row.id),view=await h.api.prepare(row,value,()=>true);await h.api.resolve(row,value,view,()=>true);
 const replay=cachedRetry(h,intent),changedP1=cachedRetry(h,intent,C),changedP2=cachedRetry(h,intent);changedP2.players.push(JSON.parse(p2C));changedP2.expected.p2=p2;changedP2.changedIds.push('p2');
 assert.equal(h.api.retired(changedP1),false,'same source receipt does not acknowledge new p1 content');assert.equal(h.api.retired(changedP2),false,'a new change outside the settled intent cannot be swallowed');
 const beforeDisk=[...h.disk.entries()],retired=h.api.retired(replay),result=await h.api.before(replay);assert.deepEqual([...h.disk.entries()],beforeDisk);assert.equal(h.disk.get(ROW),B);assert.equal(h.disk.get('sq:p2'),p2);
 assert.equal(retired,true,'unchanged full-roster rows must not prevent retiring the settled p1 cached patch');assert.equal(result,true,'the subset cached retry is a no-write retired result');
});

test('concurrent prepare: an unchanged newer background load cannot cancel a current explicit review read',async()=>{
 const {h,row,value}=await archivedFixture(),gate=deferred(),entered=deferred();let lists=0;
 h.hooks.keys=()=>{if(++lists===1){entered.resolve();return gate.promise;}};
 const before=[...h.disk.entries()],pending=h.api.prepare(row,value,()=>true).then(view=>({view}),error=>({error}));await entered.promise;
 assert.equal(await h.api.load(),1,'the concurrent complete load sees the same unchanged archive');assert.equal(h.api.count(),1);gate.resolve();
 const result=await pending;assert.equal(result.error,undefined,'a background refresh cannot invalidate an unchanged authorized review selection');assert.equal(result.view.token,row.id);assert.deepEqual(JSON.parse(result.view.currentRaw),{provenance:'device-idb',values:{p1:B}});assert.deepEqual([...h.disk.entries()],before);
});

// A joined read cannot use an older successful snapshot to hide the newest I/O failure.
test('concurrent load: a failed newest read cannot be replaced by an older valid snapshot',async()=>{
 const {h}=await archivedFixture(),gate=deferred(),entered=deferred();let reads=0;
 h.deps.journal=()=>Object.assign({},h.journal,{async list(ctx){const result=await h.journal.list(ctx);if(++reads===1){entered.resolve();await gate.promise;}else throw Error('synthetic newest journal I/O');return result;}});
 const old=h.api.load().then(value=>({value}),error=>({error}));await entered.promise;
 await assert.rejects(h.api.load(),e=>e.message==='synthetic newest journal I/O');gate.resolve();const result=await old;assert.equal(result.error.message,'synthetic newest journal I/O');assert.ok(h.api.count()>0);assert.equal(h.api.fenced(ROW),true);assert.equal(h.disk.get(ROW),B);
});

test('quarantine notify: an actual empty journal load completion publishes its unlocked projection readiness',async()=>{
 const h=fixture(),gate=deferred(),entered=deferred(),timers=new Map(),notified=[];let nextTimer=0;
 function surface(){const listeners=new Map();return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatch(type){for(const fn of [...(listeners.get(type)||[])])fn({type});}};}
 const parent=surface(),child=surface();parent.PSSync={dataUnlocked:()=>true,state:()=>h.api.state({kind:'ok',at:1,n:0,review:0})};child.parent=parent;child.setTimeout=(fn,delay)=>{assert.equal(delay,0);timers.set(++nextTimer,fn);return nextTimer;};child.clearTimeout=id=>timers.delete(id);
 h.deps.notify=()=>parent.dispatch('ps-sync-state');h.hooks.keys=async()=>{entered.resolve();await gate.promise;};const pending=h.api.load();await entered.promise;
 Q.watchProjection(child,()=>h.owner.uid+'/'+h.owner.wid+'/'+h.owner.seal,()=>notified.push(parent.PSSync.state()));assert.equal(parent.PSSync.state().kind,'wait');assert.equal(timers.size,0);assert.equal(notified.length,0);
 gate.resolve();assert.equal(await pending,0);assert.equal(parent.PSSync.state().kind,'ok');await new Promise(resolve=>setTimeout(resolve,0));for(const [id,fn] of [...timers]){timers.delete(id);fn();}
 assert.equal(notified.length,1,'finishing the actual quarantine read must publish readiness to the already mounted child');assert.equal(notified[0].kind,'ok');assert.equal(h.calls.filter(c=>['set','cas','atomic-commit'].includes(c.method)).length,0);assert.equal(h.disk.get(ROW),B);
});

test('quarantine notify loop: exact load completion and guarded child reload settle after two events and one projection',async()=>{
 const h=fixture(),timers=new Map();let nextTimer=0,events=0,updates=0,projectionRead=null;
 function surface(){const listeners=new Map();return {addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},dispatch(type){for(const fn of [...(listeners.get(type)||[])])fn({type});}};}
 const parent=surface(),child=surface();parent.PSSync={dataUnlocked:()=>true,state:()=>h.api.state({kind:'ok',at:1,n:0,review:0})};child.parent=parent;child.setTimeout=(fn,delay)=>{assert.equal(delay,0);timers.set(++nextTimer,fn);return nextTimer;};child.clearTimeout=id=>timers.delete(id);
 h.deps.notify=()=>{events++;parent.dispatch('ps-sync-state');};
 Q.watchProjection(child,()=>h.owner.uid+'/'+h.owner.wid+'/'+h.owner.seal,()=>{updates++;projectionRead=h.api.load();});assert.equal(timers.size,0);
 await h.api.load();await new Promise(resolve=>setTimeout(resolve,0));assert.equal(events,1);assert.equal(timers.size,1);
 for(const [id,fn] of [...timers]){timers.delete(id);fn();}assert.equal(updates,1);assert.ok(projectionRead);await projectionRead;
 await new Promise(resolve=>setTimeout(resolve,0));assert.equal(events,2);assert.equal(timers.size,0,'the same completion at/scope cannot queue another child reload');assert.equal(updates,1);
 await new Promise(resolve=>setTimeout(resolve,20));assert.equal(events,2,'the actual publish/reload cycle stays bounded');assert.equal(updates,1);assert.equal(timers.size,0);assert.equal(h.calls.filter(c=>['set','cas','atomic-commit'].includes(c.method)).length,0);assert.equal(h.disk.get(ROW),B);
});
