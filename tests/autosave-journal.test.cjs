'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const J=require('../studio/autosave-journal.js');
const OWNER={uid:'synthetic-owner-a',wid:'synthetic-team-a',seal:'seal-a',epoch:'epoch-a'};
const KEY='scout_tool_v1';
const A=' {"players":[{"id":"p1","memo":"PRIVATE_LOCAL","unknown":{"x":1}}], "meta":{} }\n';
const B='{"players":[{"id":"p1","memo":"PRIVATE_REMOTE"}],"meta":{"photo":"data:image/png;base64,EXACT"}}';
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(options={}){
  let owner={...OWNER},sequence=0,time=1000;
  const data=new Map(),calls=[],hooks={};
  const storage={
    async get(k){calls.push(['get',k]);if(hooks.get)await hooks.get(k);return data.has(k)?{value:data.get(k)}:null;},
    async set(k,raw,current){calls.push(['set',k]);if(hooks.set)await hooks.set(k,raw);if(current)current();if(hooks.noop)return false;data.set(k,hooks.rewrite?hooks.rewrite(raw):raw);if(hooks.afterSet)await hooks.afterSet(k,raw);return true;},
    async keys(prefix){calls.push(['keys',prefix]);if(hooks.keys)await hooks.keys(prefix);return [...data.keys()];}
  };
  const api=J.create({storage,context:()=>owner,randomUUID:()=>uuid(++sequence),now:()=>time++,...options});
  return {api,data,calls,hooks,storage,ctx:{...OWNER},get owner(){return owner;},change(change){owner=change===null?null:{...owner,...change};}};
}
const ownerError=e=>e.name==='AutosaveJournalOwnerError';
const corrupt=e=>e.name==='AutosaveJournalCorruptError';
function archive(f,raw=A){return f.api.archive(f.ctx,KEY,raw,B,2,'team-conflict');}
function remember(f,raw=A,cupd=1){return f.api.remember(f.ctx,KEY,raw,J.hash(raw),cupd);}

test('browser and CommonJS expose the same explicit create API without storage side effects',()=>{
  const w={};vm.runInNewContext(fs.readFileSync(require.resolve('../studio/autosave-journal.js'),'utf8'),{window:w});
  assert.equal(typeof w.PSAutoSaveJournal.create,'function');assert.equal(w.PSAutoSaveJournal.PREFIX,J.PREFIX);
});
test('archive verifies and returns both original strings byte-for-byte, while lists contain metadata only',async()=>{
  const f=fixture(),m=await archive(f),read=await f.api.read(f.ctx,m.id),rows=await f.api.list(f.ctx);
  assert.deepEqual(read,{metadata:m,localRaw:A,remoteRaw:B});assert.deepEqual(rows,[m]);
  assert.equal(JSON.stringify(rows).includes('PRIVATE_'),false);assert.equal(JSON.stringify(rows).includes('data:image'),false);
  assert.deepEqual(Object.keys(m).sort(),['id','k','at','cupd','reason','localHash','remoteHash'].sort());
  assert.deepEqual(f.calls.slice(0,3).map(x=>x[0]),['get','set','get']);
  assert.ok([...f.data.keys()].every(k=>k.startsWith(J.PREFIX)));
});
test('archives remain distinct for repeated conflicts and list newest first; no silent retention deletion',async()=>{
  const f=fixture(),first=await archive(f),second=await archive(f);assert.notEqual(first.id,second.id);
  assert.deepEqual((await f.api.list(f.ctx)).map(x=>x.id),[second.id,first.id]);assert.equal(f.data.size,2);
  assert.equal((await f.api.read(f.ctx,first.id)).localRaw,A);
});
test('archive IDs cannot overwrite an existing original, including a caller-provided UUID collision',async()=>{
  const f=fixture({randomUUID:()=>uuid(1)}),first=await archive(f);
  await assert.rejects(archive(f,'NEW_LOCAL'),e=>e.name==='AutosaveJournalCollisionError');
  assert.equal((await f.api.read(f.ctx,first.id)).localRaw,A);
});
test('same-call owner snapshot cannot be changed by mutating the caller context before its first microtask',async()=>{
  const f=fixture(),run=archive(f);Object.assign(f.ctx,{uid:'owner-b',seal:'seal-b'});f.change(f.ctx);
  await assert.rejects(run,ownerError);assert.equal(f.calls.length,0);
});
test('base requires exact confirmed hash/version and retains previous after base-first/meta-failed commit',async()=>{
  const f=fixture();assert.equal(await f.api.base(f.ctx,KEY,J.hash(A),1),null);
  await remember(f);await remember(f,B,2);
  assert.equal(await f.api.base(f.ctx,KEY,J.hash(A),1),A);
  assert.equal(await f.api.base(f.ctx,KEY,J.hash(B),2),B);
  assert.equal(await f.api.base(f.ctx,KEY,J.hash(B),1),null);
  assert.equal(await f.api.base(f.ctx,KEY,'unconfirmed',2),null);
  assert.equal(await f.api.base(f.ctx,KEY,J.hash(A)),A);
});
test('a missing meta hash accepts only a previously verified same-scope base',async()=>{
  const f=fixture();await remember(f);
  assert.equal(await f.api.base(f.ctx,KEY,'',0),A);
  assert.equal(await f.api.base(f.ctx,KEY),A);
  f.change({wid:'synthetic-team-b',seal:'seal-b'});
  assert.equal(await f.api.base({...f.owner},KEY),null);
});
test('base may be reopened after a legitimate same-owner/team new generation, but stale captured contexts fail',async()=>{
  const f=fixture();await remember(f);f.change({seal:'new-login',epoch:'new-epoch'});
  await assert.rejects(f.api.base(f.ctx,KEY),ownerError);
  assert.equal(await f.api.base({...f.owner},KEY,J.hash(A),1),A);
});
test('a failed second base write leaves the old confirmed base usable',async()=>{
  const f=fixture();await remember(f);f.hooks.set=()=>{throw Error('disk unavailable');};
  await assert.rejects(remember(f,B,2),/disk unavailable/);delete f.hooks.set;
  assert.equal(await f.api.base(f.ctx,KEY,J.hash(A),1),A);
});
test('older server versions and different bodies with the same cupd cannot rewind an existing base',async()=>{
  const f=fixture();await remember(f,B,3);
  for(const c of [2,3])await assert.rejects(remember(f,A,c),e=>e.name==='AutosaveJournalVersionError');
  assert.equal(await f.api.base(f.ctx,KEY,J.hash(B),3),B);
});
test('reconfirming exact previous after a cancelled local apply succeeds without rewinding current',async()=>{
  const f=fixture();await remember(f,A,1);await remember(f,B,2);
  const before=[...f.data.entries()],writes=f.calls.filter(x=>x[0]==='set').length;
  assert.equal(await remember(f,A,1),true);
  assert.deepEqual([...f.data.entries()],before);assert.equal(f.calls.filter(x=>x[0]==='set').length,writes);
  assert.equal(await f.api.base(f.ctx,KEY,J.hash(A),1),A);assert.equal(await f.api.base(f.ctx,KEY,'',0),B);
  await assert.rejects(remember(f,A,0),e=>e.name==='AutosaveJournalVersionError');
});
test('concurrent remembers in one controller commit in order and keep the immediately preceding confirmed body',async()=>{
  const f=fixture(),wait=deferred();let count=0;f.hooks.set=()=>++count===1?wait.promise:undefined;
  const one=remember(f),two=remember(f,B,2);await tick();assert.equal(count,1);wait.resolve();await Promise.all([one,two]);
  assert.equal(await f.api.base(f.ctx,KEY,J.hash(A),1),A);assert.equal(await f.api.base(f.ctx,KEY,J.hash(B),2),B);
});
test('an optional hash function must agree with remember metadata and validates persisted content',async()=>{
  const f=fixture({hash:raw=>'custom:'+raw.length});
  await assert.rejects(f.api.remember(f.ctx,KEY,A,J.hash(A),1),e=>e.name==='AutosaveJournalInputError');
  await f.api.remember(f.ctx,KEY,A,'custom:'+A.length,1);
  assert.equal(await f.api.base(f.ctx,KEY,'custom:'+A.length,1),A);
});
for(const operation of ['archive','remember'])for(const mode of ['reject','noop','rewrite'])test(`${operation} never succeeds on storage ${mode}`,async()=>{
  const f=fixture();if(mode==='reject')f.hooks.set=()=>{throw Error('disk failure');};
  if(mode==='noop')f.hooks.noop=true;if(mode==='rewrite')f.hooks.rewrite=raw=>raw+' ';
  await assert.rejects(operation==='archive'?archive(f):remember(f));
});
for(const change of [{uid:'other-account'},{wid:'other-team'},{seal:'same-owner-ABA'},{epoch:'next-switch'},null])test(`archive cannot commit after async owner/permission change ${JSON.stringify(change)}`,async()=>{
  const f=fixture(),wait=deferred();f.hooks.set=()=>wait.promise;
  const pending=archive(f);await tick();f.change(change);wait.resolve();await assert.rejects(pending,ownerError);assert.equal(f.data.size,0);
});
test('after-commit owner transition rejects the ACK even though the old scoped original is safely persisted',async()=>{
  const f=fixture();f.hooks.afterSet=()=>f.change({uid:'other-account',seal:'other-seal'});
  await assert.rejects(archive(f),ownerError);assert.equal(f.data.size,1);
  assert.deepEqual(await f.api.list({...f.owner}),[]);
});
for(const method of ['base','read','list'])test(`${method} rejects delayed private data after permission loss`,async()=>{
  const f=fixture();await remember(f);const m=await archive(f),wait=deferred();
  if(method==='list')f.hooks.keys=()=>wait.promise;else f.hooks.get=()=>wait.promise;
  const pending=method==='base'?f.api.base(f.ctx,KEY):method==='read'?f.api.read(f.ctx,m.id):f.api.list(f.ctx);
  await tick();f.change(null);wait.resolve();await assert.rejects(pending,ownerError);
});
test('list rechecks the owner during individual record reads, not only the key listing',async()=>{
  const f=fixture();await archive(f);f.hooks.get=()=>f.change({epoch:'new-generation'});
  await assert.rejects(f.api.list(f.ctx),ownerError);
});
test('normal token rotation is allowed because the required context excludes tokens',async()=>{
  const f=fixture(),wait=deferred();f.hooks.set=()=>wait.promise;
  const run=archive(f);await tick();f.change({accessToken:'NEW_TOKEN_NOT_SAVED'});wait.resolve();await run;
  assert.ok([...f.data.values()].every(raw=>!raw.includes('NEW_TOKEN')));
});
test('delimiter characters in owner/workspace IDs cannot alias another scope',async()=>{
  const f=fixture();f.change({uid:'x:y',wid:'z'});const ctx1={...f.owner};
  const m=await f.api.archive(ctx1,KEY,A,B,2,'team-conflict');f.change({uid:'x',wid:'y:z'});
  assert.deepEqual(await f.api.list({...f.owner}),[]);assert.equal(await f.api.read({...f.owner},m.id),null);
});
test('foreign account records and unrelated IndexedDB values are never read by current-scope listing',async()=>{
  const f=fixture(),m=await archive(f);f.change({uid:'other',seal:'other-seal'});
  await f.api.archive({...f.owner},KEY,'OTHER_PRIVATE',B,2,'team-conflict');f.change(OWNER);
  f.data.set('ps_sync_session','TOKEN_DO_NOT_READ');f.data.set('cs_notes_v1','PERSONAL_DOC_DO_NOT_READ');f.calls.length=0;
  assert.deepEqual(await f.api.list(f.ctx),[m]);
  assert.ok(f.calls.filter(x=>x[0]==='get').every(x=>x[1].startsWith(J.PREFIX+OWNER.uid+':'+OWNER.wid+':')));
});
test('copied archive data under another scope fails its embedded identity check',async()=>{
  const f=fixture(),m=await archive(f),raw=[...f.data.values()][0];f.change({uid:'other'});
  f.data.set(J.PREFIX+'other:'+OWNER.wid+':archive:'+m.id,raw);
  await assert.rejects(f.api.read({...f.owner},m.id),corrupt);await assert.rejects(f.api.list({...f.owner}),corrupt);
});
for(const method of ['base','list','read'])test(`${method} rejects storage read failures instead of returning empty success`,async()=>{
  const f=fixture();await remember(f);const m=await archive(f);f.hooks.get=()=>{throw Error('IDB read failed');};
  await assert.rejects(method==='base'?f.api.base(f.ctx,KEY):method==='read'?f.api.read(f.ctx,m.id):f.api.list(f.ctx),/IDB read failed/);
});
test('malformed and corrupted stored baselines/archives fail closed',async()=>{
  const f=fixture();await remember(f);const m=await archive(f);
  const baseKey=[...f.data.keys()].find(k=>k.includes(':base:')),archiveKey=[...f.data.keys()].find(k=>k.includes(':archive:'));
  const base=JSON.parse(f.data.get(baseKey));base.current.raw='changed';f.data.set(baseKey,JSON.stringify(base));
  await assert.rejects(f.api.base(f.ctx,KEY),corrupt);
  const saved=JSON.parse(f.data.get(archiveKey));saved.remoteRaw='changed';f.data.set(archiveKey,JSON.stringify(saved));
  await assert.rejects(f.api.read(f.ctx,m.id),corrupt);await assert.rejects(f.api.list(f.ctx),corrupt);
});
test('a missing record during list is an incomplete read, not a successful partial list',async()=>{
  const f=fixture();await archive(f);f.hooks.get=k=>f.data.delete(k);
  await assert.rejects(f.api.list(f.ctx),corrupt);
});
test('invalid inputs never save tokens as metadata reasons or bypass context/ID constraints',async()=>{
  const f=fixture();
  for(const c of [null,{}, {...OWNER,uid:''},{...OWNER,seal:''},{...OWNER,epoch:{}}])await assert.rejects(f.api.archive(c,KEY,A,B,2,'team-conflict'),ownerError);
  for(const reason of ['', 'PRIVATE title with spaces','https://private.invalid/?token=secret'])await assert.rejects(f.api.archive(f.ctx,KEY,A,B,2,reason));
  for(const id of ['../other',J.PREFIX+'other',null])await assert.rejects(f.api.read(f.ctx,id));
  for(const value of [NaN,Infinity,-1,'2'])await assert.rejects(f.api.archive(f.ctx,KEY,A,B,value,'conflict'));
  assert.equal(f.data.size,0);
});
