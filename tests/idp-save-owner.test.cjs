'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/idp.html'),'utf8');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);assert.ok(start>=0&&end>start,`actual IDP ${a}`);return source.slice(start,end);}
const ownerStart='  function idpSaveApi(){';
const code=[section('  function sess(){','  (function migrate()'),
  source.includes(ownerStart)?section(ownerStart,'  function syncMyIdpSoon('):'',
  section('  function syncMyIdpSoon(','/* 2.022 — 핵심 행동 핑'),
  section('  function save(){',"  window.addEventListener('pagehide'")].join('\n');
const copy=x=>JSON.parse(JSON.stringify(x)),settle=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

// The exact shipped save/timer functions run in a VM. Only storage, clocks and
// the parent authentication/sync API are simulated; no network is available.
function harness(options={}){
  const uid=options.uid===undefined?'player-1':options.uid,wid=options.wid===undefined?'team-1':options.wid;
  const key='cs_idp_v1_'+(uid||'local'),base={v:1,log:{},weekly:{'2026-09-07':{better:'keep prior text'}}};
  const initial=JSON.stringify(base),local=new Map([[key,initial],['ps_active_ws',wid]]),writes=[],timers=new Map(),syncCalls=[],toasts=[];
  if(uid)local.set('ps_sync_session',JSON.stringify({uid}));
  let nextTimer=0;
  const state={apiUid:uid,unlocked:!!uid,failWrite:false,alterWrite:false,reply:()=>Promise.resolve({}),...options.state};
  const api={session:()=>state.apiUid?{uid:state.apiUid}:null,dataUnlocked:()=>state.unlocked,
    syncNow:reason=>{syncCalls.push({reason,uid:state.apiUid,wid:local.get('ps_active_ws')});return state.reply();}};
  const c={PREFIX:'cs_idp_v1_',viewing:key,doc:copy(base),_saveT:null,_cloudSaveT:null,_docSeenRaw:initial,_docSourceValid:true,_privateWriteConflict:false,visionEdit:false,
    localStorage:{getItem:k=>local.has(k)?local.get(k):null,setItem(k,v){if(state.failWrite)throw new Error('QuotaExceededError');writes.push({key:k,raw:String(v)});local.set(k,state.alterWrite?'other value':String(v));}},
    setTimeout:(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
    gToast:t=>toasts.push(t),Promise,console,
  };c.window=c;c.PSSync=options.api===false?null:api;c.parent=options.standalone?c:{PSSync:c.PSSync};
  vm.createContext(c);vm.runInContext(code,c,{filename:'idp.html actual save paths'});
  return {c,key,initial,local,writes,timers,syncCalls,toasts,state,
    run(delay){const entry=[...timers].find(([,t])=>delay===undefined||t.delay===delay);assert.ok(entry,`pending ${delay}ms timer`);timers.delete(entry[0]);entry[1].fn();},
    pending:delay=>[...timers.values()].filter(t=>delay===undefined||t.delay===delay).length,
    change(uid2,wid2=local.get('ps_active_ws')){if(uid2)local.set('ps_sync_session',JSON.stringify({uid:uid2}));else local.delete('ps_sync_session');state.apiUid=uid2;state.unlocked=!!uid2;local.set('ps_active_ws',wid2);},
  };
}

test('debounced IDP save persists the latest input once and preserves other fields',()=>{
  const h=harness();h.c.doc.log['2026-09-12']={memo:'first'};h.c.save();h.c.doc.log['2026-09-12'].memo='last';h.c.save();
  assert.equal(h.pending(250),1);h.run(250);assert.equal(h.writes.length,1);
  const saved=JSON.parse(h.local.get(h.key));assert.equal(saved.log['2026-09-12'].memo,'last');assert.equal(saved.weekly['2026-09-07'].better,'keep prior text');
  assert.equal(h.c._docSeenRaw,h.local.get(h.key));assert.equal(h.pending(1200),1);
});

for(const [name,change]of [
  ['account changes',h=>h.change('player-2')],['account logs out',h=>h.change('')],
  ['workspace changes',h=>h.change('player-1','team-2')],['API owner changes before local session',h=>{h.state.apiUid='player-2';}],
  ['authenticated data becomes locked',h=>{h.state.unlocked=false;}],
  ['another player is viewed',h=>{h.c.viewing='cs_idp_v1_other';h.c.doc={v:1,log:{memo:'other'}};}],
  ['same key adopts a replacement document',h=>{h.c.doc={v:1,log:{memo:'replacement'}};}],
])test(`a queued save cannot write after ${name}`,()=>{
  const h=harness();h.c.doc.log.pending={memo:'old draft'};h.c.save();change(h);h.run(250);
  assert.deepEqual(h.writes,[]);assert.equal(h.local.get(h.key),h.initial);assert.equal(h.pending(1200),0);
  assert.equal(h.c._privateWriteConflict,false);
});

test('owner changes also cancel a queued standalone save without a parent API',()=>{
  const h=harness({api:false,standalone:true});h.c.save();h.change('player-2');h.run(250);assert.deepEqual(h.writes,[]);
});

for(const [name,options]of [
  ['standalone signed-in offline use',{api:false,standalone:true}],['standalone anonymous local use',{api:false,standalone:true,uid:'',wid:''}],
  ['standalone use with its own authenticated sync API',{standalone:true}],
  ['existing anonymous local mode with a locked anonymous shell',{uid:'',wid:'',state:{unlocked:false}}],
])test(`${name} remains writable`,()=>{
  const h=harness(options);h.c.doc.log.today={memo:'allowed local draft'};h.c.save();h.run(250);
  assert.equal(h.writes.length,1);assert.equal(h.writes[0].key,h.key);
});

test('signing in cannot redirect an anonymous pending save into either account',()=>{
  const h=harness({uid:'',wid:''});h.c.save();h.change('player-1','personal-1');h.run(250);assert.deepEqual(h.writes,[]);
});

for(const [name,change]of [
  ['API uid differs',h=>{h.state.apiUid='player-2';}],['API session is missing',h=>{h.state.apiUid='';}],
  ['authenticated data is locked',h=>{h.state.unlocked=false;}],
])test(`a fresh save is rejected when ${name}`,()=>{
  const h=harness();change(h);h.c.save();assert.equal(h.pending(250),0);assert.equal(h.c.persistMyIdpNow(),false);assert.deepEqual(h.writes,[]);
});

test('anonymous local storage does not override an authenticated shell owner',()=>{
  const h=harness({uid:'',state:{apiUid:'player-1',unlocked:true}});h.c.save();assert.equal(h.pending(250),0);assert.deepEqual(h.writes,[]);
});

test('immediate persistence flushes the pending timer using the same current owner',()=>{
  const h=harness();h.c.doc.log.today={memo:'flush'};h.c.save();assert.equal(h.c.persistMyIdpNow(),true);
  assert.equal(h.pending(250),0);assert.equal(h.writes.length,1);assert.equal(h.pending(80),1);
});

function attachVisionStart(h){
  h.c.ro=()=>h.c.viewing!==h.c.myKey();h.c.load=key=>JSON.parse(h.local.get(key));
  vm.runInContext(section('  function visionCore(','  /* 시간은 자유 입력')+
    section('  function visionBeginEdit(){','  function visionEndEdit(){'),h.c,{filename:'idp.html actual vision-start flush'});
}

test('opening the direction editor flushes a pending daily input through the guarded immediate save',()=>{
  const h=harness();attachVisionStart(h);h.c.doc.log.today={memo:'last characters'};h.c.save();
  assert.equal(h.c.visionBeginEdit(),true);assert.equal(h.pending(250),0);assert.equal(h.c.visionEdit,true);
  assert.equal(JSON.parse(h.local.get(h.key)).log.today.memo,'last characters');assert.equal(h.writes.length,1);
});

test('opening the direction editor after an account change cannot flush the previous account draft',()=>{
  const h=harness();attachVisionStart(h);h.c.doc.log.today={memo:'old account draft'};h.c.save();h.change('player-2');
  assert.equal(h.c.visionBeginEdit(),false);assert.deepEqual(h.writes,[]);assert.equal(h.c.visionEdit,false);
});

test('a conflicting pending daily input survives an attempted direction-editor transition in memory',()=>{
  const h=harness();attachVisionStart(h);h.c.doc.log.today={memo:'keep in memory'};h.c.save();
  const changed='{"v":1,"log":{"today":{"memo":"other tab"}}}';h.local.set(h.key,changed);
  assert.equal(h.c.visionBeginEdit(),false);assert.equal(h.c.doc.log.today.memo,'keep in memory');
  assert.equal(h.local.get(h.key),changed);assert.equal(h.c._privateWriteConflict,true);assert.deepEqual(h.writes,[]);
});

test('a changed stored raw stays intact and reports a local conflict',()=>{
  const h=harness();h.c.save();h.local.set(h.key,'{"v":1,"log":{"other":"new"}}');h.run(250);
  assert.deepEqual(h.writes,[]);assert.equal(h.c._privateWriteConflict,true);assert.equal(h.toasts.length,1);
});

for(const [name,change]of [
  ['invalid source',h=>{h.c._docSourceValid=false;}],['existing conflict',h=>{h.c._privateWriteConflict=true;}],
  ['explicit vision draft',h=>{h.c.visionEdit=true;}],
])test(`queued input does not save through ${name}`,()=>{
  const h=harness();h.c.save();change(h);h.run(250);assert.deepEqual(h.writes,[]);assert.equal(h.c.persistMyIdpNow(),false);
});

for(const [name,state]of [['quota rejection',{failWrite:true}],['write/read mismatch',{alterWrite:true}]])test(`${name} cannot advance the observed raw or schedule sync`,()=>{
  const h=harness({state});h.c.doc.log.today={memo:'not confirmed'};h.c.save();h.run(250);
  assert.equal(h.c._docSeenRaw,h.initial);assert.equal(h.pending(1200),0);assert.equal(h.c.persistMyIdpNow(),false);
});

test('cloud sync scheduled by an old owner does not run after account or team changes',()=>{
  for(const next of [['player-2','team-1'],['player-1','team-2']]){
    const h=harness();h.c.syncMyIdpSoon();h.change(...next);h.run(1200);assert.deepEqual(h.syncCalls,[]);
  }
});

test('viewing another document keeps a previously saved same-owner cloud sync usable',()=>{
  const h=harness();h.c.syncMyIdpSoon();h.c.viewing='cs_idp_v1_other';h.c.doc={v:1};h.run(1200);assert.equal(h.syncCalls.length,1);
});

test('a late skipped sync cannot retry for a changed owner',async()=>{
  const reply=deferred(),h=harness({state:{reply:()=>reply.promise}});h.c.syncMyIdpSoon();h.run(1200);h.change('player-2');reply.resolve({skip:1});await settle();
  assert.equal(h.pending(2200),0);assert.equal(h.syncCalls.length,1);
});

test('a late skipped sync cannot replace a more recent save request',async()=>{
  const reply=deferred(),h=harness({state:{reply:()=>reply.promise}});h.c.syncMyIdpSoon();h.run(1200);
  h.c.syncMyIdpSoon(80);reply.resolve({skip:1});await settle();assert.equal(h.pending(80),1);assert.equal(h.pending(2200),0);
});

test('a skipped sync retries for the same owner and checks ownership again before retry',async()=>{
  const h=harness({state:{reply:()=>Promise.resolve({skip:1})}});h.c.syncMyIdpSoon();h.run(1200);await settle();assert.equal(h.pending(2200),1);
  h.change('player-2');h.run(2200);assert.equal(h.syncCalls.length,1);
});
