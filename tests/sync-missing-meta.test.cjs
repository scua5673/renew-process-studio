'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createRequire}=require('node:module');

// Run the production sync core and conditional HTTP writes from the existing
// harness, without registering that file's tests a second time.
const fixture=path.join(__dirname,'team-data-consistency.test.cjs');
const source=fs.readFileSync(fixture,'utf8');
const declarations=source.slice(0,source.indexOf('\nconst pushed='));
assert.ok(declarations.length>1000);
const {harness}=new Function('require','__dirname',declarations+'\nreturn {harness};')(createRequire(fixture),__dirname);
const KEY='cs_team_match_private_v1';
const BASE=JSON.stringify({v:1,entries:{a:{good:'base A'},b:{good:'base B'}}});
function edit(raw,id,text){const doc=JSON.parse(raw);doc.entries[id].good=text;return JSON.stringify(doc);}
const LOCAL=edit(BASE,'b','unsent local B');
const REMOTE=edit(BASE,'a','new remote A');
function response(rows,status=200){return {ok:status>=200&&status<300,status,json:async()=>rows,text:async()=>JSON.stringify(rows)};}
function writes(h){return h.requests.filter(r=>r.stage==='kv_push_cas');}
function reads(h){return h.requests.filter(r=>r.stage==='kv_pull');}
async function fixtureWith(options={}){
  const h=harness({server:BASE,mirror:LOCAL,idb:LOCAL,omitMeta:true,...options});
  h.baseline(BASE);await h.mark();return h;
}

test('an existing locally edited row omitted from metadata is read directly and conditionally updated',async()=>{
  const h=await fixtureWith();
  const result=await h.run();
  assert.equal(result.error,undefined,JSON.stringify(result));
  assert.equal(reads(h).length,1);assert.match(reads(h)[0].url,/cs_team_match_private_v1/);
  assert.equal(writes(h).length,1);assert.equal(writes(h)[0].options.method,'PATCH');
  assert.match(writes(h)[0].url,/cupd=eq\.1/);
  assert.equal(h.server.get(KEY).v,LOCAL);assert.equal(h.local.get(KEY),LOCAL);assert.equal(h.idb.get(KEY),LOCAL);
  assert.equal(h.queue.length,0);
  const again=await h.run();assert.equal(again.error,undefined);assert.equal(writes(h).length,1,'An acknowledged body is not inserted again');
});

test('an omitted row already equal to the local body is acknowledged without any write',async()=>{
  const h=await fixtureWith({server:LOCAL,cupd:2});
  const result=await h.run();
  assert.equal(result.error,undefined);assert.equal(writes(h).length,0);assert.equal(h.queue.length,0);
  assert.equal(h.c.meta().c[KEY],2);assert.equal(h.c.meta().h[KEY],h.c.hash(LOCAL));
});

test('an empty CAS with the exact body already persisted drains pending and records the actual version',async()=>{
  const h=await fixtureWith({server:LOCAL,cupd:1,omitMeta:false,casZero:true});
  const result=await h.run();
  assert.equal(result.error,undefined);assert.equal(h.queue.length,0);assert.equal(h.c.meta().c[KEY],1);
  assert.equal(h.c.meta().h[KEY],h.c.hash(LOCAL));assert.equal(h.server.get(KEY).v,LOCAL);
  const again=await h.run();assert.equal(again.error,undefined);assert.equal(writes(h).length,1);
});

test('an omitted remote edit competes with the local edit without replacing either original',async()=>{
  const h=await fixtureWith({server:REMOTE,cupd:2});
  const result=await h.run();
  assert.equal(result.error,undefined);assert.equal(writes(h).length,0);
  assert.equal(h.local.get(KEY),LOCAL);assert.equal(h.idb.get(KEY),LOCAL);assert.equal(h.server.get(KEY).v,REMOTE);
  assert.equal(h.queue.length,1);assert.equal(h.c.holdList()[0].k,KEY);assert.equal(h.c.meta().h[KEY],h.c.hash(BASE));
});

test('a second server edit after the direct read survives the conditional write',async()=>{
  const h=await fixtureWith();let raced=false;
  h.hooks.fetch=stage=>{if(stage==='kv_push_cas'&&!raced){raced=true;h.server.set(KEY,{workspace_id:'team-a',k:KEY,v:REMOTE,cupd:2});}};
  const result=await h.run();
  assert.ok(result.error);assert.equal(raced,true);assert.equal(h.server.get(KEY).v,REMOTE);
  assert.equal(h.local.get(KEY),LOCAL);assert.equal(h.idb.get(KEY),LOCAL);assert.equal(h.queue.length,1);
  assert.equal(h.c.meta().h[KEY],h.c.hash(BASE));
});

test('a local edit during the direct read is never replaced by an older pull candidate',async()=>{
  const h=await fixtureWith({server:REMOTE,cupd:2,mirror:BASE,idb:BASE});
  const newer=edit(BASE,'b','typed during direct read');
  h.hooks.fetch=stage=>{if(stage==='kv_pull'){h.local.set(KEY,newer);h.idb.set(KEY,newer);}};
  await h.run();
  assert.equal(h.local.get(KEY),newer);assert.equal(h.idb.get(KEY),newer);assert.equal(h.server.get(KEY).v,REMOTE);
  assert.equal(writes(h).length,0);assert.equal(h.queue.length,1);
});

test('a failed direct read cannot fall through to a blind insert',async()=>{
  const h=await fixtureWith(),fetch=h.c.syncFetch;
  h.c.syncFetch=async(stage,url,options)=>stage==='kv_pull'?response([],503):fetch(stage,url,options);
  const result=await h.run();
  assert.equal(result.code,'sync_server');assert.equal(writes(h).length,0);
  assert.equal(h.local.get(KEY),LOCAL);assert.equal(h.idb.get(KEY),LOCAL);assert.equal(h.server.get(KEY).v,BASE);
  assert.equal(h.queue.length,1);assert.equal(h.c.meta().h[KEY],h.c.hash(BASE));
});

test('a row absent from both metadata and the direct read uses an insert-only write',async()=>{
  const h=await fixtureWith({server:null});
  const result=await h.run();
  assert.equal(result.error,undefined);assert.equal(reads(h).length,1);assert.equal(writes(h).length,1);
  assert.equal(writes(h)[0].options.method,'POST');assert.match(writes(h)[0].options.headers.Prefer,/ignore-duplicates/);
  assert.equal(h.server.get(KEY).v,LOCAL);assert.equal(h.queue.length,0);
});

test('metadata recovery excludes personal keys and keys with no local value',async()=>{
  const h=harness({server:null,omitMeta:true}),personal='cs_notes_v1',empty='cs_team_notice_v1';
  h.c.KEYS.push(personal,empty);h.c.PERSONAL[personal]=1;h.local.set(personal,'private notes');
  const result=await h.run();
  assert.equal(result.error,undefined);assert.equal(reads(h).length,0);assert.equal(writes(h).length,0);
  assert.equal(h.local.get(personal),'private notes');
});

test('only requested missing keys from a direct-read response enter the shared sync round',async()=>{
  const h=await fixtureWith(),extra='cs_team_notice_v1';h.c.KEYS.push(extra);
  h.server.set(extra,{workspace_id:'team-a',k:extra,v:'unrequested server document',cupd:2});
  const result=await h.run();
  assert.equal(result.error,undefined);assert.doesNotMatch(reads(h)[0].url,/cs_team_notice_v1/);
  assert.equal(h.local.has(extra),false);assert.equal(h.idb.has(extra),false);assert.equal(h.c.meta().h[extra],undefined);
});

test('a permission-filtered direct read does not authorize a denied local write',async()=>{
  const h=await fixtureWith({role:'player',teamRole:'member',scopes:[]}),fetch=h.c.syncFetch;
  h.c.syncFetch=async(stage,url,options)=>stage==='kv_pull'?response([]):fetch(stage,url,options);
  const result=await h.run();
  assert.equal(result.error,undefined);assert.equal(writes(h).length,0);assert.equal(h.server.get(KEY).v,BASE);
  assert.equal(h.local.get(KEY),LOCAL);assert.equal(h.idb.get(KEY),LOCAL);assert.equal(h.queue.length,1);
});

test('an owner switch during the direct read cannot apply or send the prior owner draft',async()=>{
  const h=await fixtureWith(),newer='new owner document';
  h.hooks.fetch=stage=>{if(stage==='kv_pull'){h.switch();h.local.set(KEY,newer);h.idb.set(KEY,newer);}};
  const result=await h.run();
  assert.equal(result.code,'sync_workspace_changed');assert.equal(writes(h).length,0);
  assert.equal(h.local.get(KEY),newer);assert.equal(h.idb.get(KEY),newer);assert.equal(h.server.get(KEY).v,BASE);
  assert.equal(h.queue.length,1);assert.equal(h.queue[0].uid,'coach-a');
});
