'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8'),start=source.indexOf('(function(){',source.indexOf('/* PROCESS STUDIO — 사진 보관소(PSImg)'));
const code=source.slice(start,source.indexOf('/* 2.463 — 안전 정리 자동화',start)).replace('  try{ ready().then(function(){ return migrate(); }).catch(function(){}); }catch(_){}','');
const raw=JSON.stringify,tick=()=>new Promise(r=>setImmediate(r));
function gate(){let release;return {promise:new Promise(r=>release=r),release:()=>release()};}
function harness(){
  const picture='data:image/png;base64,SYNTHETIC',docs={scout_tool_v1:{_items:{build:'original'},players:[{id:'a',name:'Synthetic',memo:'keep',profile:{photo:picture}}]},process_coach_v1:{weeks:{0:[{match:{logo:picture,opponent:'Synthetic'}}]},anchorMonday:'2026-09-14'},cs_team_v1:{logo:picture,name:'Synthetic team'}},local=new Map(Object.entries({ps_sync_session:'{"uid":"coach"}',ps_active_ws:'A',ps_cache_owner_v1:'{"uid":"coach","wid":"A","nonce":"one"}',...Object.fromEntries(Object.entries(docs).map(([k,v])=>[k,raw(v)]))})),disk=new Map(),hooks={},writes=[],imageWrites=[],events=[];
  const c={Promise,JSON,Math,Date,CustomEvent:function(type,options){this.type=type;this.detail=options?.detail;},dispatchEvent:e=>events.push(e),
    localStorage:{getItem:k=>local.get(k)??null,setItem(k,v){if(hooks.localWrite)hooks.localWrite(k,v);writes.push(k);local.set(k,String(v));},key:i=>[...local.keys()][i]??null,get length(){return local.size;}},
    storage:{async keys(){if(hooks.ready)await hooks.ready();return [];},async set(k,v){imageWrites.push(k);if(hooks.put)await hooks.put(k,v);disk.set(k,v);return true;},async get(k){return disk.has(k)?{value:disk.get(k)}:null;}}};c.window=c;vm.createContext(c);vm.runInContext(code,c);return {c,docs,local,disk,hooks,writes,imageWrites,events,picture};
}
test('normal image migration preserves every field, verifies image copies, and reports only completed document migrations',async()=>{
  const h=harness(),result=await h.c.PSImg.migrate();assert.deepEqual(JSON.parse(raw(result)),{moved:3,failed:0});assert.equal(h.writes.length,3);
  for(const [key,before]of Object.entries(h.docs)){const got=JSON.parse(h.local.get(key)),holder=key==='scout_tool_v1'?got.players[0].profile:key==='process_coach_v1'?got.weeks[0][0].match:got,field=key==='scout_tool_v1'?'photo':'logo';
    assert.match(holder[field],/^psimg:/);assert.equal(h.c.PSImg.src(holder[field]),h.picture);assert.equal(h.disk.get(holder[field].slice(6)),h.picture);holder[field]=h.picture;assert.deepEqual(got,before);}
  assert.equal((await h.c.PSImg.migrate()).moved,0);
});
const ownerChanges={team:h=>{h.local.set('ps_active_ws','B');h.local.set('ps_cache_owner_v1','{"uid":"coach","wid":"B","nonce":"two"}');},account:h=>{h.local.set('ps_sync_session','{"uid":"other"}');h.local.set('ps_cache_owner_v1','{"uid":"other","wid":"A","nonce":"two"}');},'same-owner ABA seal':h=>h.local.set('ps_cache_owner_v1','{"uid":"coach","wid":"A","nonce":"two"}'),'same-owner switch epoch':h=>h.local.set('ps_ws_switch_epoch_v1','two'),'switch in progress':h=>h.local.set('ps_ws_switch_guard_v1','{"token":"two"}')};
for(const [name,change]of Object.entries(ownerChanges))test('late parent-shell image migration preserves new documents after '+name,async()=>{
  const h=harness(),g=gate();h.hooks.put=()=>g.promise;const pending=h.c.PSImg.migrate();await tick();assert.equal(h.imageWrites.length,1);change(h);
  const expected={};for(const key of Object.keys(h.docs)){expected[key]=raw({newOwnerData:key,players:[]});h.local.set(key,expected[key]);}g.release();const result=await pending;
  assert.equal(result.moved,0);assert.equal(h.writes.length,0);for(const key of Object.keys(h.docs))assert.equal(h.local.get(key),expected[key]);assert.equal(h.disk.size,1,'completed opaque image copy is preserved');
});
test('owner change while image cache initializes cannot start migration against a new team',async()=>{
  const h=harness(),g=gate();h.hooks.ready=()=>g.promise;const pending=h.c.PSImg.migrate();ownerChanges.team(h);g.release();assert.equal((await pending).moved,0);assert.equal(h.imageWrites.length,0);assert.equal(h.writes.length,0);
});
test('same-team later roster edit remains exact while unrelated schedule and team images finish',async()=>{
  const h=harness(),g=gate();h.hooks.put=()=>g.promise;const pending=h.c.PSImg.migrate();await tick();const latest=raw({_items:{build:'new'},players:[{id:'new',name:'Later player',profile:{}}]});h.local.set('scout_tool_v1',latest);g.release();const result=await pending;
  assert.equal(h.local.get('scout_tool_v1'),latest);assert.equal(h.writes.includes('scout_tool_v1'),false);assert.equal(result.moved,2);assert.equal(result.failed,1);assert.equal(h.disk.size,3);
});
test('failed document write retains the inline original and is not counted as a successful migration',async()=>{
  const h=harness(),before=h.local.get('scout_tool_v1');h.hooks.localWrite=k=>{if(k==='scout_tool_v1')throw Error('quota');};const result=await h.c.PSImg.migrate();assert.equal(h.local.get('scout_tool_v1'),before);assert.equal(result.moved,2);assert.equal(result.failed,1);assert.equal(h.disk.size,3);
});
test('unlocked local-only documents can still migrate; mismatched authenticated ownership stays untouched',async()=>{
  const guest=harness();for(const k of ['ps_sync_session','ps_active_ws','ps_cache_owner_v1'])guest.local.delete(k);assert.equal((await guest.c.PSImg.migrate()).moved,3);
  const wrong=harness();wrong.local.set('ps_sync_session','{"uid":"other"}');assert.equal((await wrong.c.PSImg.migrate()).moved,0);assert.equal(wrong.writes.length,0);
});
