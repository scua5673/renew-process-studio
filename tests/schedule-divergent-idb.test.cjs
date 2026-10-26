'use strict';
// A full schedule mirror can stay at the server/base while a newer attempted
// edit reaches IDB. Neither copy's apparent age is permission to discard it.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createRequire}=require('node:module');
const fixture=path.join(__dirname,'schedule-readiness.test.cjs'),source=fs.readFileSync(fixture,'utf8');
const declarations=source.slice(0,source.indexOf('\ntest('));
const {harness,doc,KEY}=new Function('require','__dirname',declarations+'\nreturn {harness,doc,KEY};')(createRequire(fixture),__dirname);
const pushes=h=>h.requests.filter(r=>r.stage.startsWith('kv_push'));
function setup(){const before=doc('confirmed-before'),server=doc('confirmed-server');const h=harness({mirror:server,idb:before,server,cupd:2});h.baseline(before,1);return {h,before,server};}
for(const baseline of [false,true])test('server-equal mirror cannot discard an unconfirmed differing IDB, baseline '+baseline,async()=>{
 const server=doc('server'),mine=doc('unconfirmed-complete-program'),h=harness({mirror:server,idb:mine,server});if(baseline)h.baseline(server);
 const r=await h.run();assert.equal(h.idb.get(KEY),mine,'unknown IDB body is preserved exactly');assert.equal(h.local.get(KEY),server);assert.equal(h.server.get(KEY).v,server);assert.equal(h.ready(),false);assert.equal(r.code,'sync_storage');assert.equal(h.c.lastIssue.stage,'schedule_copies_differ');assert.equal(pushes(h).length,0);
});
test('a full exact confirmed previous base can still converge to the server mirror',async()=>{
 const {h,server}=setup(),r=await h.run();assert.equal(r.error,undefined);assert.equal(h.idb.get(KEY),server);assert.equal(h.local.get(KEY),server);assert.equal(h.server.get(KEY).v,server);assert.equal(h.ready(),true);assert.equal(pushes(h).length,0);
});
test('a new IDB edit after preload cannot be repaired over even with a known prior base',async()=>{
 const {h,server}=setup(),mine=doc('arrived-after-preload');let injected=false;h.hooks.idbRead=k=>{if(k===KEY&&!injected){injected=true;h.idb.set(KEY,mine);}};
 const r=await h.run();assert.equal(injected,true);assert.equal(h.idb.get(KEY),mine);assert.equal(h.local.get(KEY),server);assert.equal(h.server.get(KEY).v,server);assert.equal(h.ready(),false);assert.ok(r.error||r.scheduleDeferred);assert.equal(pushes(h).length,0);
});
test('the allowed prior-base repair compares IDB again in its atomic write',async()=>{
 const {h,server}=setup(),mine=doc('arrived-at-atomic-write'),cas=h.c.storage.replaceIfValue;let injected=false;
 h.c.storage.replaceIfValue=async(k,before,value,current)=>{if(k===KEY&&!injected){injected=true;h.idb.set(KEY,mine);}if(current)current();return cas(k,before,value);};
 const r=await h.run();assert.equal(injected,true,'repair must use an atomic comparison');assert.equal(h.idb.get(KEY),mine);assert.equal(h.local.get(KEY),server);assert.equal(h.server.get(KEY).v,server);assert.equal(h.ready(),false);assert.ok(r.error||r.scheduleDeferred);assert.equal(pushes(h).length,0);
});
test('an unreadable IDB cannot be treated as an absent or disposable prior base',async()=>{
 const {h,before,server}=setup();h.hooks.idbRead=()=>{throw Object.assign(Error('synthetic read failure'),{name:'UnknownError'});};
 await h.run();assert.equal(h.idb.get(KEY),before);assert.equal(h.local.get(KEY),server);assert.equal(h.server.get(KEY).v,server);assert.equal(h.ready(),false);assert.equal(pushes(h).length,0);
});
for(const changed of ['owner','mirror'])test('the atomic prior-base repair rejects a changed '+changed,async()=>{
 const {h,before,server}=setup(),mine=doc('current-'+changed),cas=h.c.storage.replaceIfValue;let injected=false;
 h.c.storage.replaceIfValue=async(k,expected,value,current)=>{if(k===KEY&&!injected){injected=true;if(changed==='owner'){h.switch();h.idb.set(KEY,mine);}h.local.set(KEY,mine);}if(current)current();return cas(k,expected,value);};
 await h.run();assert.equal(injected,true);assert.equal(h.idb.get(KEY),changed==='owner'?mine:before);assert.equal(h.local.get(KEY),mine);assert.equal(h.server.get(KEY).v,server);assert.equal(h.ready(),false);assert.equal(pushes(h).length,0);
});
test('exact non-null schedule confirmation awaits per-key quota recovery',async()=>{
 const server=doc('server'),h=harness({server});let called=0;h.c.PSStorage.sharedRecovered=async(k,raw)=>{called++;assert.equal(k,KEY);assert.equal(raw,server);assert.equal(h.idb.get(KEY),raw);assert.equal(h.local.get(KEY),raw);return true;};
 const r=await h.run();assert.equal(r.error,undefined);assert.equal(called,1);assert.equal(h.ready(),true);
});
test('verified mirrorless server/IDB fallback also awaits quota recovery',async()=>{
 const server=doc('server'),old=doc('old'),h=harness({mirror:old,idb:old,server,cupd:2});h.baseline(old,1);let called=0;
 h.hooks.localWrite=k=>{if(k===KEY)throw Object.assign(Error('synthetic mirror full'),{name:'QuotaExceededError'});};
 h.c.PSStorage.sharedRecovered=async(k,raw)=>{called++;assert.equal(k,KEY);assert.equal(raw,server);assert.equal(h.idb.get(KEY),raw);assert.equal(h.local.has(KEY),false);return true;};
 const r=await h.run();assert.equal(r.error,undefined);assert.equal(called,1);assert.equal(h.ready(),false);assert.equal(h.idb.get(KEY),server);assert.equal(pushes(h).length,0);
});
test('confirmed server absence does not pretend a failed write recovered',async()=>{
 const h=harness({server:null});let called=0;h.c.PSStorage.sharedRecovered=async()=>{called++;};await h.run();assert.equal(h.ready(),true);assert.equal(called,0);
});
test('a source owner changing during quota recovery cannot finish schedule confirmation',async()=>{
 const h=harness(),g={};g.promise=new Promise(resolve=>g.resolve=resolve);let entered=false;
 h.c.PSStorage.sharedRecovered=()=>{entered=true;return g.promise;};const work=h.run();for(let i=0;i<30&&!entered;i++)await new Promise(r=>setImmediate(r));assert.equal(entered,true);h.switch();g.resolve(true);const r=await work;assert.ok(r.error||r.code);assert.equal(h.ready(),false);
});
