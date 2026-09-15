'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const begin=source.indexOf('function bulkPush(){'),end=source.indexOf('\n}',begin)+2;
assert.ok(begin>=0&&end>begin);const bulk=source.slice(begin,end);
// Reuse the exact ACK transport fixture without registering its tests. This
// suite additionally executes the real bulkPush full-body/meta commit path.
const fixtureFile=path.join(__dirname,'roster-server-ack.test.cjs'),fixtureSource=fs.readFileSync(fixtureFile,'utf8');
const box={require:createRequire(fixtureFile),__dirname,module:{exports:{}},URL,console};
vm.runInNewContext(fixtureSource.slice(0,fixtureSource.indexOf('\nfor(const k of keys)'))+'\nmodule.exports={fixture};',box);
const MAIN='scout_tool_v1',SQUAD='cs_squad_v1',raw=JSON.stringify,copy=v=>JSON.parse(raw(v));
const mainRaw=raw({players:[{id:'p1',name:'Synthetic player'}],meta:{emblem:'full local image'}});
function fixture(options={}){
  const h=box.module.exports.fixture(options),values=new Map(Object.entries(options.values||{[MAIN]:mainRaw})),bases=[],commits=[];
  const owner={uid:'u',wid:'team-a',seal:'owner-seal',epoch:''},m={h:{unrelated:'kept-hash'},c:{unrelated:3},n:{}};
  Object.assign(h.ctx,{busy:false,OWNERKEY:'owner',bulkGuard:()=>null,activeWs:()=>owner.wid,bulkKeys:()=>[...values.keys()],
    workspaceSwitchGuardRead:()=>null,workspaceSwitchGuardRaw:()=>'',workspaceSwitchEpochRaw:()=>owner.epoch,
    getSess:()=>({uid:owner.uid}),cacheOwner:()=>({uid:owner.uid,wid:owner.wid}),
    localStorage:{getItem:()=>owner.seal},dataUnlocked:()=>true,ensureToken:async()=> 'synthetic-token',
    currentValueForKey:async k=>values.get(k)??null,syncBaseSet:async(k,v,wid)=>{bases.push({k,v,wid});if(options.onBase)options.onBase({owner,values,m,k});return true;},
    meta:()=>copy(m),hash:v=>'hash:'+v,nSet:(meta,k,v)=>{meta.n[k]=v.length;},setMetaExact:next=>{commits.push(copy(next));Object.assign(m,copy(next));},syncDiagnostic(){}});
  if(options.prepare)h.ctx.blobPrepRows=async(_at,rows)=>options.prepare(rows,{owner,values,m});
  if(options.transport){const send=h.ctx.syncFetch;h.ctx.syncFetch=(...args)=>options.transport(send,args,{owner,values,m});}
  vm.runInContext(bulk,h.ctx);return {...h,values,bases,commits,owner,m,run:()=>h.ctx.bulkPush()};
}
test('bulk upload commits the exact server revision while retaining the original full local body',async()=>{
  const wire=raw({players:[{id:'p1',name:'Synthetic player'}],meta:{emblem:'',emblemRef:'synthetic-ref'}});
  const h=fixture({saved:r=>({...r,cupd:7}),prepare:rows=>{rows[0].v=wire;}}),result=await h.run();
  assert.equal(result.ok,1);assert.equal(h.server.get('team-a|'+MAIN).v,wire);
  assert.equal(h.server.get('team-a|'+MAIN).cupd,7);assert.equal(h.m.c[MAIN],7);
  assert.equal(h.values.get(MAIN),mainRaw);assert.equal(h.m.h[MAIN],'hash:'+mainRaw);assert.deepEqual(h.bases,[{k:MAIN,v:mainRaw,wid:'team-a'}]);
});
test('fallback verification also carries the real revision into bulk metadata',async()=>{
  const h=fixture({saved:r=>({...r,cupd:9}),response:rs=>rs.map(({workspace_id,k,cupd})=>({workspace_id,k,cupd}))});
  assert.equal((await h.run()).ok,1);assert.equal(h.calls.length,2);assert.equal(h.m.c[MAIN],9);
});
test('transformed or rejected roster bodies cannot commit a successful bulk baseline',async()=>{
  const h=fixture({saved:r=>({...r,v:'DIFFERENT SERVER BODY'})}),result=await h.run();
  assert.ok(result.error);assert.deepEqual(h.bases,[]);assert.deepEqual(h.commits,[]);assert.equal(h.values.get(MAIN),mainRaw);
});
test('separate chunks commit each confirmed roster revision without replacing sibling metadata',async()=>{
  const values=Object.fromEntries(Array.from({length:17},(_,i)=>['sq:p'+i,raw({id:'p'+i,name:'Synthetic '+i})]));
  const h=fixture({values,saved:r=>({...r,cupd:100+Number(r.k.slice(4))}),onBase:({m})=>{m.c.unrelated=99;m.h.unrelated='new sibling';}}),result=await h.run();
  assert.equal(result.n,17);assert.equal(h.calls.length,2);for(let i=0;i<17;i++)assert.equal(h.m.c['sq:p'+i],100+i);
  assert.equal(h.m.c.unrelated,99);assert.equal(h.m.h.unrelated,'new sibling');
});
test('403 isolation commits only the accepted key and leaves the denied body unconfirmed',async()=>{
  const h=fixture({values:{[MAIN]:mainRaw,[SQUAD]:'{"players":[]}'},saved:r=>({...r,cupd:7}),
    transport(send,args){const init=args[2],rows=init?.method==='POST'?JSON.parse(init.body):[];
      if(Array.isArray(rows)&&(rows.length>1||rows[0]?.k===SQUAD))return Promise.resolve({ok:false,status:403});return send(...args);}});
  const result=await h.run();assert.equal(result.ok,1);assert.equal(result.n,1);assert.equal(result.skipped,1);
  assert.equal(h.m.c[MAIN],7);assert.equal(h.m.c[SQUAD],undefined);assert.deepEqual(h.bases.map(r=>r.k),[MAIN]);
});
for(const phase of ['response','base'])test('owner changes during '+phase+' cannot commit bulk metadata',async()=>{
  const h=fixture({saved:r=>({...r,cupd:7}),
    transport:async(send,args,state)=>{const result=await send(...args);if(phase==='response')state.owner.uid='other';return result;},
    onBase:state=>{if(phase==='base')state.owner.epoch='new epoch';}}),result=await h.run();
  assert.ok(result.error);assert.deepEqual(h.commits,[]);assert.equal(h.m.c[MAIN],undefined);
});
test('a newer local edit survives an older successful upload and remains different from the confirmed hash',async()=>{
  const newer=raw({players:[{id:'p1',name:'Newer local edit'}],meta:{}});
  const h=fixture({saved:r=>({...r,cupd:7}),transport:async(send,args,{values})=>{const result=await send(...args);values.set(MAIN,newer);return result;}});
  assert.equal((await h.run()).ok,1);assert.equal(h.values.get(MAIN),newer);assert.equal(h.m.h[MAIN],'hash:'+mainRaw);
  assert.notEqual(h.m.h[MAIN],'hash:'+newer);assert.equal(h.m.c[MAIN],7);
});
