'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const fixture=path.join(__dirname,'team-data-consistency.test.cjs'),source=fs.readFileSync(fixture,'utf8');
const declarations=source.slice(0,source.indexOf('\nconst pushed='));
const {harness}=new Function('require','__dirname',declarations+'\nreturn {harness};')(createRequire(fixture),__dirname);
const scout=fs.readFileSync(path.join(__dirname,'../studio/scout.html'),'utf8');
function uiFunction(name){const start=scout.indexOf('function '+name+'('),end=scout.indexOf('\nfunction ',start+1);assert.ok(start>=0&&end>start);return scout.slice(start,end);}
const MATCH='cs_team_matches_v1',OTHER='cs_team_notice_v1';
const BASE=JSON.stringify({version:1,matches:[{id:'fixture-match',phaseBoards:{cur:'atk',boards:{atk:{us:[],opp:[]}}}}]});
const DRAFT=JSON.stringify({version:1,matches:[{id:'fixture-match',squad:{start:['fixture-player']},phaseBoards:{cur:'atk',boards:{atk:{us:[],opp:[]}}}}]});
const response=rows=>({ok:true,status:200,json:async()=>rows,text:async()=>JSON.stringify(rows)});
async function setup(options={}){
  const h=harness({key:MATCH,server:options.alreadySaved?DRAFT:BASE,cupd:options.alreadySaved?2:1,mirror:DRAFT,idb:DRAFT});
  h.baseline(BASE);h.local.set('ps_sync_session','{"uid":"coach-a"}');
  const meta=h.c.meta();if(!options.initiallyPending)meta.r[MATCH]={w:'team-a',present:true,h:h.c.hash(BASE)};
  meta.h[OTHER]=h.c.hash('old notice');meta.c[OTHER]=5;h.c.setMeta(meta);
  h.c.KEYS.push(OTHER);h.server.set(OTHER,{workspace_id:'team-a',k:OTHER,v:'old notice',cupd:5});h.local.set(OTHER,'new notice');
  await h.mark();await h.c.outboxMark('team-a',OTHER,h.c.hash('new notice'),'fixture');
  const fetch=h.c.syncFetch;
  h.c.syncFetch=async(stage,url,init)=>{
    if(stage==='kv_push_cas'&&url.includes(options.failMatch?MATCH:OTHER))return response([]);
    if(stage==='kv_push_cas_verify')return response([h.server.get(options.failMatch?MATCH:OTHER)]);
    return fetch(stage,url,init);
  };
  h.c.parent.PSSync={keyReady:h.c.keyReady};
  vm.runInContext(['matchDocPending','matchRole','matchCanEdit'].map(uiFunction).join('\n'),h.c);
  return h;
}

test('a confirmed lineup stays editable when an unrelated conditional save fails afterward',async()=>{
  const h=await setup();assert.equal(h.c.matchCanEdit(),true);
  for(let round=0;round<3;round++){
    const result=await h.run();assert.ok(result.error,'The unrelated unsaved notice is still reported');
    assert.equal(h.server.get(MATCH).v,DRAFT);assert.equal(h.local.get(MATCH),DRAFT);assert.equal(h.idb.get(MATCH),DRAFT);
    assert.equal(h.ready(),true,'Exact match confirmation must survive an unrelated failure');
    assert.equal(h.c.matchCanEdit(),true,'The real scout gate permits the next phase/token edit');
    assert.ok(h.queue.some(row=>row.key===OTHER));assert.equal(h.server.get(OTHER).v,'old notice');
    assert.equal(h.c.meta().h[OTHER],h.c.hash('old notice'),'Recovery cannot commit provisional metadata for the refused key');
    assert.equal(h.c.meta().c[OTHER],5);
  }
});

test('an already-saved exact match can recover readiness despite a different key still failing',async()=>{
  const h=await setup({alreadySaved:true,initiallyPending:true});assert.equal(h.c.matchCanEdit(),false);
  const result=await h.run();assert.ok(result.error);
  assert.equal(h.ready(),true);assert.equal(h.c.matchCanEdit(),true);assert.equal(h.server.get(MATCH).v,DRAFT);
});

test('a refused match write never gains readiness from another key or a failed round',async()=>{
  const h=await setup({failMatch:true});const result=await h.run();
  assert.ok(result.error);assert.equal(h.ready(),false);assert.equal(h.c.matchCanEdit(),false);
  assert.equal(h.server.get(MATCH).v,BASE);assert.equal(h.local.get(MATCH),DRAFT);assert.equal(h.idb.get(MATCH),DRAFT);
  assert.ok(h.queue.some(row=>row.key===MATCH));
});

test('new local input after the match ACK stays intact and cannot receive an old readiness proof',async()=>{
  const h=await setup(),newer=DRAFT.replace('fixture-player','later-player'),fetch=h.c.syncFetch;
  h.c.syncFetch=async(stage,url,init)=>{
    if(stage==='kv_push_cas_verify'){h.local.set(MATCH,newer);h.idb.set(MATCH,newer);}
    return fetch(stage,url,init);
  };
  const result=await h.run();assert.ok(result.error);assert.equal(h.ready(),false);assert.equal(h.c.matchCanEdit(),false);
  assert.equal(h.local.get(MATCH),newer);assert.equal(h.idb.get(MATCH),newer);assert.equal(h.server.get(MATCH).v,DRAFT);
});

test('owner change during the unrelated failure cannot confirm a match for the new owner',async()=>{
  const h=await setup(),fetch=h.c.syncFetch,newer='new owner match document';
  h.c.syncFetch=async(stage,url,init)=>{
    if(stage==='kv_push_cas_verify'){h.switch();h.local.set('ps_sync_session','{"uid":"coach-b"}');h.local.set(MATCH,newer);h.idb.set(MATCH,newer);}
    return fetch(stage,url,init);
  };
  const result=await h.run();assert.ok(result.error);assert.equal(h.ready(),false);assert.equal(h.c.matchCanEdit(),false);
  assert.equal(h.local.get(MATCH),newer);assert.equal(h.idb.get(MATCH),newer);assert.equal(h.server.get(MATCH).v,DRAFT);
});

test('a same-workspace owner change during readiness readback cannot inherit the previous owner confirmation',async()=>{
  const h=await setup(),fetch=h.c.syncFetch;let recovering=false,switched=false;
  h.c.syncFetch=async(stage,url,init)=>{if(stage==='kv_push_cas_verify')recovering=true;return fetch(stage,url,init);};
  h.hooks.idbRead=key=>{
    if(!recovering||switched||key!==MATCH)return;switched=true;
    h.switch('coach-b','team-a');h.local.set('ps_sync_session','{"uid":"coach-b"}');
    // Identical bytes do not substitute for proof belonging to this account.
    h.local.set(MATCH,DRAFT);h.idb.set(MATCH,DRAFT);h.base.set(MATCH,'new owner confirmed base');
  };
  const result=await h.run();assert.ok(result.error);
  assert.equal(h.ready(),false);assert.equal(h.c.matchCanEdit(),false);
  assert.equal(h.local.get(MATCH),DRAFT);assert.equal(h.idb.get(MATCH),DRAFT);
  if(switched)assert.equal(h.base.get(MATCH),'new owner confirmed base');
});

for(const failure of ['IDB read','pending local commit','readiness metadata write'])test(failure+' failure keeps the confirmed lineup closed until exact local verification succeeds',async()=>{
  const h=await setup(),fetch=h.c.syncFetch;let recovering=false,failed=false;
  h.c.syncFetch=async(stage,url,init)=>{if(stage==='kv_push_cas_verify')recovering=true;return fetch(stage,url,init);};
  function fail(){failed=true;throw new Error('fixture readiness storage failure');}
  if(failure==='IDB read')h.hooks.idbRead=key=>{if(recovering&&key===MATCH)fail();};
  if(failure==='pending local commit')h.hooks.sharedReady=key=>{if(recovering&&key===MATCH)fail();};
  if(failure==='readiness metadata write')h.hooks.localWrite=(key,value)=>{
    if(recovering&&key==='ps_sync_meta'&&JSON.parse(value).r[MATCH])fail();
  };
  const result=await h.run();assert.ok(result.error);assert.equal(failed,true);
  assert.equal(h.ready(),false);assert.equal(h.c.matchCanEdit(),false);
  assert.equal(h.local.get(MATCH),DRAFT);assert.equal(h.idb.get(MATCH),DRAFT);assert.equal(h.server.get(MATCH).v,DRAFT);
  assert.ok(h.queue.some(row=>row.key===MATCH));assert.ok(h.queue.some(row=>row.key===OTHER));
  assert.equal(h.c.meta().h[OTHER],h.c.hash('old notice'));assert.equal(h.c.meta().c[OTHER],5);
});
