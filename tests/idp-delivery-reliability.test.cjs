'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
// Reuse the actual syncNowCore/CAS transport harness without registering the team tests.
const sourcePath=path.join(__dirname,'team-data-consistency.test.cjs');
const source=fs.readFileSync(sourcePath,'utf8');
const end=source.indexOf('\nconst pushed=');assert.ok(end>0,'shared harness boundary');
const box={require:createRequire(sourcePath),__dirname,module:{exports:{}},console,URL,setImmediate,Buffer};
vm.runInNewContext(source.slice(0,end)+'\nmodule.exports={harness};',box,{filename:sourcePath});
const {harness}=box.module.exports;
const PRIVATE='cs_idp_v1_player-a',PUBLIC='cs_idp_pub_v1_player-a';
const raw=JSON.stringify;
const doc=log=>raw({v:1,log:log||{},imgNotes:[]});
const pub=reacts=>raw({v:1,reacts:reacts||{}});
const push=h=>h.requests.filter(r=>r.stage.startsWith('kv_push')&&!r.stage.endsWith('_verify'));
const fixture=(key,opts={})=>harness({key,localOnly:true,dynamic:true,...opts});
async function run(h){const r=await h.run();assert.equal(r.error,undefined,JSON.stringify({r,errors:h.errors}));return r;}
const oldMark=h=>h.c.outboxTxn(q=>q.concat({id:'coach-a|team-a|'+PRIVATE,uid:'coach-a',wid:'team-a',key:PRIVATE,hash:h.c.hash(h.local.get(PRIVATE)),at:Date.now()}));
const set=(h,k,v,cupd)=>h.server.set(k,{workspace_id:'team-a',k,v,cupd});

test('a player edit reaches the team server and the coach reads that exact log without republishing it',async()=>{
 const initial=doc(),edited=doc({'2026-09-13':{text:'SYNTHETIC player diary'}});
 const player=fixture(PRIVATE,{uid:'player-a',role:'player',teamRole:'member',server:initial,mirror:edited});player.baseline(initial);await player.mark();await run(player);
 assert.equal(player.server.get(PRIVATE).v,edited);assert.equal(player.queue.length,0);assert.equal(push(player).length,1);
 const coach=fixture(PRIVATE,{uid:'coach-a',sharedServer:player.server});await run(coach);
 assert.equal(coach.local.get(PRIVATE),edited);assert.equal(push(coach).length,0);assert.equal(coach.queue.length,0);
});

test('coach public replies reach the target player and are never pushed by the player',async()=>{
 const initial=pub(),reply=pub({'day:2026-09-13':{t:'SYNTHETIC coach reply',by:'coach-a',at:100}});
 const coach=fixture(PUBLIC,{uid:'coach-a',server:initial,mirror:reply});coach.baseline(initial);await coach.mark();await run(coach);
 assert.equal(coach.server.get(PUBLIC).v,reply);assert.equal(coach.queue.length,0);
 const player=fixture(PUBLIC,{uid:'player-a',role:'player',teamRole:'member',sharedServer:coach.server});await run(player);
 assert.equal(player.local.get(PUBLIC),reply);assert.equal(push(player).length,0);assert.equal(player.queue.length,0);
});

test('a real competing IDP save first fails CAS safely then merges the two different diary days',async()=>{
 const initial=doc(),mine=doc({'2026-09-12':{text:'SYNTHETIC local day'}}),other=doc({'2026-09-13':{text:'SYNTHETIC other device'}});
 const h=fixture(PRIVATE,{uid:'player-a',role:'player',teamRole:'member',server:initial,mirror:mine});h.baseline(initial);await h.mark();
 h.hooks.fetch=stage=>{if(stage==='kv_push_cas')set(h,PRIVATE,other,2);};
 await h.run();assert.equal(h.local.get(PRIVATE),mine);assert.equal(h.server.get(PRIVATE).v,other);assert.equal(h.queue.length,1);
 delete h.hooks.fetch;await run(h);
 const saved=JSON.parse(h.server.get(PRIVATE).v);assert.equal(saved.log['2026-09-12'].text,'SYNTHETIC local day');assert.equal(saved.log['2026-09-13'].text,'SYNTHETIC other device');assert.equal(h.queue.length,0);
});

for(const key of [PRIVATE,PUBLIC])test('same body with a later server version acknowledges without another push: '+key,async()=>{
 const initial=key===PRIVATE?doc():pub(),value=key===PRIVATE?doc({'2026-09-13':{text:'SYNTHETIC already delivered'}}):pub({'day:2026-09-13':{t:'SYNTHETIC already delivered',at:100,by:'coach-a'}});
 const h=fixture(key,{uid:key===PRIVATE?'player-a':'coach-a',server:value,cupd:2,mirror:value});h.baseline(initial);await h.mark();await run(h);
 assert.equal(push(h).length,0);assert.equal(h.queue.length,0);assert.equal(h.c.meta().c[key],2);
});

test('an accidental outbox mark of unchanged other-player IDP clears without a push',async()=>{
 const value=doc({'2026-09-13':{text:'SYNTHETIC read-only player'}});
 const h=fixture(PRIVATE,{uid:'coach-a',server:value,mirror:value});h.baseline(value);await oldMark(h);await run(h);
 assert.equal(push(h).length,0);assert.equal(h.queue.length,0);
});

test('other-player private local drift refreshes its read-only cache and clears old queue entries',async()=>{
 const value=doc({'2026-09-13':{text:'SYNTHETIC player source'}}),drift=doc({'2026-09-13':{text:'SYNTHETIC stale local drift'}});
 const h=fixture(PRIVATE,{uid:'coach-a',server:value,mirror:drift});h.baseline(value);await oldMark(h);
 for(let i=0;i<3;i++)await run(h);
 assert.equal(push(h).length,0);assert.equal(h.server.get(PRIVATE).v,value);assert.equal(h.local.get(PRIVATE),value);assert.equal(h.queue.length,0);
});

test('new local cache events for foreign private IDP do not enter the upload queue',async()=>{
 const h=fixture(PRIVATE,{uid:'coach-a',server:doc(),mirror:doc()});await h.mark();assert.equal(h.queue.length,0);
});

for(const key of [PRIVATE,PUBLIC])test('two devices with the same millisecond clock retain both IDP additions: '+key,async()=>{
 const privateKey=key===PRIVATE,initial=privateKey?doc():pub();
 const a=privateKey?doc({'2026-09-12':{text:'SYNTHETIC A'}}):pub({'day:2026-09-12':{t:'SYNTHETIC A',at:90,by:'coach-a'}});
 const b=privateKey?doc({'2026-09-13':{text:'SYNTHETIC B'}}):pub({'day:2026-09-13':{t:'SYNTHETIC B',at:91,by:'coach-b'}});
 const first=fixture(key,{uid:privateKey?'player-a':'coach-a',server:initial,cupd:100,mirror:a});first.baseline(initial,100);
 const second=fixture(key,{uid:privateKey?'player-a':'coach-b',sharedServer:first.server,mirror:b});second.baseline(initial,100);
 class SameClock extends Date{static now(){return 100;}}
 first.c.Date=SameClock;second.c.Date=SameClock;
 await first.mark();await second.mark();await run(first);await run(second);
 assert.ok(first.server.get(key).cupd>100,'every accepted IDP edit advances the server CAS version');
 const saved=JSON.parse(first.server.get(key).v),field=privateKey?'log':'reacts';
 assert.equal(Object.keys(saved[field]).length,2,'both devices records retained');assert.equal(first.queue.length,0);assert.equal(second.queue.length,0);
});

const PHOTO='data:image/png;base64,U1lOVEhFVElD',REF='psimg:synthetic-photo';
const withPhoto=(photo,text='SYNTHETIC diary')=>raw({v:1,profile:{photo},log:{'2026-09-13':{text}},imgNotes:[]});
function imageFixture(h,opt={}){
 const memory=new Map(opt.reference?[[REF,PHOTO]]:[]),durable=new Map(memory);let puts=0,strips=0;
 h.c.PSImg={ready:async()=>{},isData:x=>typeof x==='string'&&x.startsWith('data:image/'),isRef:x=>typeof x==='string'&&x.startsWith('psimg:'),src:x=>memory.get(x)||x,
  verify:async(ref,value)=>{if(opt.verifyFail)throw Error('SYNTHETIC IDB read failure');return durable.get(ref)===value;},
  put:async(value)=>{puts++;if(opt.duringPut)await opt.duringPut();if(opt.fail)throw Error('SYNTHETIC IDB failure');durable.set(REF,value);memory.set(REF,value);return REF;},
  stripIdp(){strips++;throw Error('late strip must not run for staged cache');}};
 h.c.psCount=()=>7;return {durable,get puts(){return puts;},get strips(){return strips;}};
}

test('verified photo-reference cache clears old queue and stays confirmed on following rounds',async()=>{
 const server=withPhoto(PHOTO),cached=withPhoto(REF),h=fixture(PRIVATE,{uid:'coach-a',server,mirror:cached});h.baseline(server);await oldMark(h);
 const img=imageFixture(h,{reference:true});await run(h);
 assert.equal(h.local.get(PRIVATE),cached);assert.equal(h.c.meta().h[PRIVATE],h.c.hash(cached));assert.equal(h.queue.length,0);assert.equal(img.puts,0);assert.equal(img.strips,0);
 const pulls=h.requests.filter(r=>r.stage==='kv_pull').length;assert.ok(pulls>0,'dirty cache fetches exact server despite unchanged cupd');
 await run(h);await run(h);assert.equal(h.requests.filter(r=>r.stage==='kv_pull').length,pulls,'confirmed photo cache avoids repeated full pulls');assert.equal(push(h).length,0);
});

test('first photo cache confirms only after the photo bytes have a durable reference',async()=>{
 const server=withPhoto(PHOTO),h=fixture(PRIVATE,{uid:'coach-a',server}),img=imageFixture(h);await run(h);
 const cached=JSON.parse(h.local.get(PRIVATE));assert.equal(cached.profile.photo,REF);assert.equal(img.durable.get(REF),PHOTO);assert.equal(img.puts,1);assert.equal(img.strips,0);assert.equal(h.c.meta().h[PRIVATE],h.c.hash(h.local.get(PRIVATE)));
});

for(const kind of ['put','verify'])test('photo '+kind+' failure preserves the old cache and its pending item',async()=>{
 const server=withPhoto(PHOTO,'SYNTHETIC newer'),old=withPhoto(kind==='verify'?REF:PHOTO,'SYNTHETIC old'),h=fixture(PRIVATE,{uid:'coach-a',server,cupd:2,mirror:old});h.baseline(old,1);await oldMark(h);
 imageFixture(h,{reference:kind==='verify',verifyFail:kind==='verify',fail:kind==='put'});const r=await h.run();assert.ok(r.error);assert.equal(h.local.get(PRIVATE),old);assert.equal(h.queue.length,1);assert.equal(h.c.meta().c[PRIVATE],1);assert.equal(push(h).length,0);
});

for(const kind of ['owner','raw'])test('photo cache staging refuses an intervening '+kind+' change',async()=>{
 const server=withPhoto(PHOTO,'SYNTHETIC server'),old=withPhoto(PHOTO,'SYNTHETIC old'),newer=withPhoto(PHOTO,'SYNTHETIC concurrent cache'),h=fixture(PRIVATE,{uid:'coach-a',server,cupd:2,mirror:old});h.baseline(old,1);await oldMark(h);
 imageFixture(h,{duringPut:async()=>{if(kind==='owner')h.switch();else h.local.set(PRIVATE,newer);}});const r=await h.run();assert.ok(r.error);assert.equal(h.local.get(PRIVATE),kind==='raw'?newer:old);assert.equal(h.queue.length,1);assert.equal(h.c.meta().c[PRIVATE],1);assert.equal(push(h).length,0);
});

test('unsupported foreign private cache is preserved without false confirmation',async()=>{
 const future=raw({v:2,log:{future:'SYNTHETIC unsupported record'}}),h=fixture(PRIVATE,{uid:'coach-a',server:doc(),mirror:future});await oldMark(h);await run(h);assert.equal(h.local.get(PRIVATE),future);assert.equal(h.queue.length,1);assert.equal(push(h).length,0);
});

// Exercise the actual storage.js background photo migration with a paused IDB put.
const imageSource=fs.readFileSync(path.join(__dirname,'../studio/storage.js'),'utf8');
const migrationCode=imageSource.slice(imageSource.indexOf('  function isForeignIdpKey(k){'),imageSource.indexOf('\n\n  function migrate(){',imageSource.indexOf('  function isForeignIdpKey(k){')));
for(const change of ['uid','workspace','owner-seal','raw','none','write-failure'])test('background photo migration respects '+change,async()=>{
 const original=withPhoto(PHOTO),map=new Map([['ps_sync_session',raw({uid:'coach-a'})],['ps_active_ws','team-a'],['ps_cache_owner_v1',raw({uid:'coach-a',wid:'team-a',nonce:1})],[PRIVATE,original]]);let release;
 const pending=new Promise(resolve=>release=resolve);const c=vm.createContext({Promise,localStorage:{getItem:k=>map.get(k)||null},isData:v=>typeof v==='string'&&v.startsWith('data:image/'),put:()=>pending,writeJSON(k,d){map.set(k,raw(d));return true;}});
 vm.runInContext(migrationCode,c);const running=c.stripIdp(PRIVATE);
 if(change==='uid')map.set('ps_sync_session',raw({uid:'coach-b'}));
 if(change==='workspace')map.set('ps_active_ws','team-b');
 if(change==='owner-seal')map.set('ps_cache_owner_v1',raw({uid:'coach-a',wid:'team-a',nonce:2}));
 if(change==='raw')map.set(PRIVATE,withPhoto(PHOTO,'SYNTHETIC new text, same photograph'));
 if(change==='write-failure')release(Promise.reject(Error('SYNTHETIC IDB failure')));else release(REF);
 const ok=await running;
 assert.equal(ok,change==='none');assert.equal(map.get(PRIVATE),change==='none'?withPhoto(REF):change==='raw'?withPhoto(PHOTO,'SYNTHETIC new text, same photograph'):original);
});
