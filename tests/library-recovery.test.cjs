'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const recovery=require('../studio/library-recovery.js'),sync=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8');
function cut(a,b){const i=sync.indexOf(a),j=sync.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return sync.slice(i,j);}
const photo='data:image/png;base64,'+'Q'.repeat(750),H='a'.repeat(24);
function cacheHarness(){let uid='A',wid='W',seal=0,getGate=null,setGate=null,fetchGate=null;const cache=new Map(),writes=[],calls=[];
 const c={Promise,JSON,Uint8Array,TextEncoder,crypto:require('node:crypto').webcrypto,PSLibraryRecovery:recovery,BASE:'https://synthetic.invalid',
  rpcContext:()=>({uid,wid,seal}),rpcCurrent:o=>{if(o.uid!==uid||o.wid!==wid||o.seal!==seal)throw Error('stale owner');return true;},hj:()=>({}),syncHttpError:()=>Error('fetch'),
  storage:{async get(k){if(getGate)await getGate;return cache.has(k)?{value:cache.get(k)}:null;},async set(k,v,current){if(setGate)await setGate;current();writes.push(k);cache.set(k,v);}},
  async syncFetch(stage,url){calls.push({stage,url});if(fetchGate)await fetchGate;return {ok:true,json:async()=>[{h:H,v:photo}]};}
 };c.window=c;vm.createContext(c);vm.runInContext(cut('var BLOB_MIN=','/* ══ 2.628'),c);
 return {c,cache,writes,calls,switch(u,w){uid=u;wid=w;seal++;},gate(kind){let release;const p=new Promise(r=>release=r);if(kind==='get')getGate=p;else if(kind==='set')setGate=p;else fetchGate=p;return release;}};
}
test('private originals and media fingerprints retain nested photos while excluding only transient top fields',()=>{
 const original={libId:'L',thumb:'temporary',_teamOwner:'B',photo,snap:{players:[{photo}]},pages:[{emblemRef:H}]};
 const copy=recovery.privateCopy(original);assert.equal(copy.photo,photo);assert.equal(copy.snap.players[0].photo,photo);assert.equal(copy.pages[0].emblemRef,H);assert.equal(copy.thumb,undefined);assert.equal(copy._teamOwner,undefined);assert.equal(original.thumb,'temporary');
 assert.equal(recovery.mediaHash({name:'a'}),'');assert.notEqual(recovery.mediaHash(original),recovery.mediaHash({...original,photo:photo+'X'}));assert.equal(recovery.mediaHash(original),recovery.mediaHash({...original,thumb:'different'}));
});
test('private upload row keeps photos; public fingerprint and public upload shape remain compatible',()=>{
 const c={PSLibraryRecovery:recovery,libPriv:true,libUid:()=> 'A',hash:s=>s};vm.createContext(c);vm.runInContext(cut('function libShareCopy(it){','function libHash(it)')+cut('function libHash(it){','\n')+cut('function libStamp(o,priv){','\n')+cut('function libRow(it,t,wid,priv){','\n'),c);
 const item={libId:'L',photo,snap:{photo},name:'one'};assert.equal(c.libRow(item,1,'W',true).item.photo,photo);assert.equal(c.libRow(item,1,'W',false).item.photo,undefined);assert.equal(c.libHash({name:'plain'}),c.libShareJSON({name:'plain'}));assert.notEqual(c.libHash(item),c.libHash({...item,photo:photo+'X'}));
});
test('private picture strip and hydration round-trip exact original through the scoped cache',async()=>{
 const h=cacheHarness(),raw=JSON.stringify({photo,pages:[{snap:{photo}}]});const stripped=await h.c.libBlobStrip(raw);assert.equal(stripped.blobs.length,1);const b=stripped.blobs[0];h.cache.set('ps_blob:A:W:'+b.h,b.v);assert.equal(await h.c.libBlobHydrate(null,'W',stripped.v),raw);assert.equal(h.calls.length,0);
});
test('legacy global blobs are preserved but never read; cache lookups are isolated by uid and workspace',async()=>{
 const h=cacheHarness();h.cache.set('ps_blob:'+H,'legacy private');h.cache.set('ps_blob:A:W:'+H,photo);
 assert.equal((await h.c.blobFetchMap(null,'W',[H]))[H],photo);h.switch('B','W');assert.equal((await h.c.blobFetchMap(null,'W',[H]))[H],undefined);h.switch('A','Q');assert.equal((await h.c.blobFetchMap(null,'Q',[H]))[H],undefined);assert.equal(h.cache.get('ps_blob:'+H),'legacy private');assert.equal(h.calls.length,0);
});
for(const kind of ['get','fetch'])test('late '+kind+' photo completion is discarded after account or team transition',async()=>{
 for(const [uid,wid] of [['B','W'],['A','Q'],['A','W']]){const h=cacheHarness();if(kind==='get')h.cache.set('ps_blob:A:W:'+H,photo);const release=h.gate(kind),p=h.c.blobFetchMap('token','W',[H]);await new Promise(r=>setImmediate(r));h.switch(uid,wid);release();await assert.rejects(p,/stale owner/);assert.deepEqual(h.writes,[]);assert.equal(h.cache.has('ps_blob:B:W:'+H),false);}
});
test('storage current callback rejects delayed scoped writes after transition without deleting legacy originals',async()=>{
 const h=cacheHarness();h.cache.set('ps_blob:'+H,'legacy');const release=h.gate('set'),p=h.c.blobCacheSet(H,photo,'W');await new Promise(r=>setImmediate(r));h.switch('B','W');release();await p;assert.deepEqual(h.writes,[]);assert.equal(h.cache.get('ps_blob:'+H),'legacy');
});
function syncHarness({fail=false,change=false,ack=true}={}){const events=[],local={libId:'L',name:'local',editedAt:2,createdBy:'A',photo},server={lib_id:'L',owner_id:'A',private:true,saved_at:3,item:{libId:'L',name:'winner',editedAt:3}},ls=new Map([['cs_lib_rev','1']]);let saved;
 const c={Promise,JSON,PSLibraryRecovery:recovery,BASE:'x',libPriv:true,TOMBKEY:'tomb',localStorage:{getItem:k=>ls.get(k)??null,setItem:(k,v)=>ls.set(k,v)},isTeamWs:()=>true,pJSON:(s,d)=>s?JSON.parse(s):d,libDietHas:()=>false,libUid:()=> 'A',libFolderShared:()=>false,libHash:i=>i.name,libTs:i=>i.editedAt,srvPrivate:i=>i.private,libSelCols:s=>s,hj:()=>({}),hash:s=>s,libCrumb(){},libDietItem(){},libPullCap:()=>({chunk:20,budget:0}),libBlobPrepRows:async()=>{},syncIssue:(code,stage)=>Object.assign(Error(stage),{code}),syncHttpError:()=>Error('fetch'),libRow:(i,t,w,p)=>({workspace_id:w,lib_id:i.libId,owner_id:'A',private:p,item:recovery.privateCopy(i),saved_at:t}),
  async rpc(name,args,current){events.push('archive');assert.equal(args.p_snapshot.item.photo,photo);current();if(change)ls.set('cs_lib_rev','2');if(fail)throw Error('archive failed');return {id:7,preserved:ack};},
  async syncFetch(stage){events.push(stage);return {ok:true,json:async()=>[server],text:async()=>JSON.stringify([server])};},async libSave(items){events.push('save');saved=JSON.parse(JSON.stringify(items));return '1';}};
 vm.createContext(c);vm.runInContext(cut('function _syncLibrary(','\n/* 1.532 — 자료 하나씩'),c);return {events,local,get saved(){return saved;},run:()=>c._syncLibrary('T',{li:{L:{h:'base',s:1}}},10,'W',[local],()=>true,JSON.stringify([local]),'1')};}
test('actual sync archives the losing complete local original before reading and applying the canonical winner',async()=>{const h=syncHarness();await h.run();assert.deepEqual(h.events,['library_pull','archive','library_body','save']);assert.equal(h.saved[0].name,'winner');});
for(const opts of [{fail:true},{ack:false},{change:true}])test('actual sync keeps its local original when archive lacks confirmation or source changes '+JSON.stringify(opts),async()=>{const h=syncHarness(opts);await assert.rejects(h.run());assert.deepEqual(h.events,['library_pull','archive']);assert.equal(h.saved,undefined);assert.equal(h.local.photo,photo);assert.equal(h.local.name,'local');});
test('recovery client rejects a same-account same-workspace response after owner or switch epoch changes',async()=>{
 let epoch=0,release;const syncs=[],api=recovery.client({session:()=>({uid:'A'}),workspace:()=> 'W',unlocked:()=>true,capture:()=>epoch,current:c=>{if(c!==epoch)throw Error('changed epoch');},rpc:()=>new Promise(r=>release=r),sync:r=>syncs.push(r)});
 const p=api.restore(1,'request');await new Promise(r=>setImmediate(r));epoch++;release({restored:true,lib_id:'R'});await assert.rejects(p,/changed epoch/);assert.deepEqual(syncs,[]);
});
test('actual upload, fresh-device hydration and next sync keep a stable media baseline while photo-only edits become dirty',async()=>{
 const h=cacheHarness(),c=h.c,rows=new Map(),blobs=new Map(),events=[],ls=new Map([['cs_lib_rev','1']]);let saved;
 Object.assign(c,{libPriv:true,TOMBKEY:'tomb',localStorage:{getItem:k=>ls.get(k)??null,setItem:(k,v)=>ls.set(k,v)},isTeamWs:()=>true,pJSON:(s,d)=>s?JSON.parse(s):d,libDietHas:()=>false,libUid:()=> 'A',libFolderShared:()=>false,srvPrivate:i=>i.private,libSelCols:s=>s,hj:()=>({}),hash:s=>s,libCrumb(){},libDietItem(){},libPullCap:()=>({chunk:20,budget:0}),outboxMark:async()=>{},syncIssue:(code,stage)=>Object.assign(Error(stage),{code}),async libSave(items){saved=JSON.parse(JSON.stringify(items));return '1';},
  async syncFetch(stage,url,opts){events.push(stage);let data=[];
   if(stage==='blob_have')data=[...blobs].map(([h])=>({h}));else if(stage==='blob_push'){for(const b of JSON.parse(opts.body))blobs.set(b.h,b.v);}else if(stage==='blob_pull')data=[...blobs].map(([h,v])=>({h,v}));
   else if(stage==='library_pull'||stage==='library_body')data=[...rows.values()].map(x=>JSON.parse(JSON.stringify(x)));
   else if(stage==='library_insert'||stage==='library_push'){data=JSON.parse(opts.body);for(const row of data)rows.set(row.lib_id,JSON.parse(JSON.stringify(row)));}
   else throw Error('unexpected '+stage);return {ok:true,status:200,json:async()=>data,text:async()=>JSON.stringify(data)};}
 });
 vm.runInContext(cut('function libShareCopy(it){','function libHash(it)')+cut('function libHash(it){','\n')+cut('function libStamp(o,priv){','\n')+cut('function libTs(it){','\n')+cut('function libRow(it,t,wid,priv){','\n')+cut('function _syncLibrary(','\n/* 1.532 — 자료 하나씩'),c);
 const item={libId:'M',name:'picture',createdBy:'A',editedAt:2,savedAt:2,photo,pages:[{snap:{photo}}]},m={li:{}};
 const first=await c._syncLibrary('T',m,10,'W',[item],()=>true,'raw','1');assert.equal(first.pushed,1);assert.match(rows.get('M').item.photo,/^psblob:/);assert.equal(item.photo,photo,'wire preparation never changes local representation');const baseline=m.li.M.h;
 // Another device has no cache and receives the exact inline original before recording its baseline.
 h.cache.clear();const fresh={li:{}};await c._syncLibrary('T',fresh,11,'W',[],()=>true,'[]','1');assert.equal(saved[0].photo,photo);assert.equal(saved[0].pages[0].snap.photo,photo);assert.equal(fresh.li.M.h,baseline);
 events.length=0;const quiet=await c._syncLibrary('T',fresh,12,'W',saved,()=>true,JSON.stringify(saved),'1');assert.equal(quiet.pushed,0);assert.equal(quiet.applied,0);assert.deepEqual(events,['library_pull']);
 saved[0].photo=photo+'X';events.length=0;const edit=await c._syncLibrary('T',fresh,13,'W',saved,()=>true,JSON.stringify(saved),'1');assert.equal(edit.pushed,1);assert.ok(events.includes('library_push'),'picture-only change uploads');
});
