'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const code=source.slice(source.indexOf('function kvPushRows('),source.indexOf('/* ── 1.568 안전장치'));
const KEY='cs_team_notice_v1',RAW='{"text":"my pending edit"}';
const row=(changes={})=>({workspace_id:'workspace-a',k:KEY,v:RAW,cupd:7,...changes});
function harness(options={}){
  const calls=[],acks=[],cleared=[];let valid=true;
  const ctx=vm.createContext({Promise,Map,Number,JSON,Object,String,Array,encodeURIComponent,
    BASE:'https://synthetic.invalid',KV_PUSH_BYTES:1e6,KV_PUSH_ROWS:15,_itemConflicts:[],
    blobPrepRows:async()=>{},hj:()=>({}),prefBuild:s=>s,kvInFilter:ks=>'k=in.('+ks.join(',')+')',
    syncIssue:(code,stage,message)=>Object.assign(new Error(message),{psCode:code,psStage:stage}),
    syncHttpError:(stage,status)=>Object.assign(new Error('HTTP '+status),{psCode:status===403?'sync_permission':'sync_server',psStage:stage}),
    holdClear:k=>cleared.push(k),importApprovalClear(){},
    async syncFetch(stage,url,init){
      const method=init.method||'GET';calls.push({stage,url,method,body:init.body});
      if(method!=='GET')return {ok:true,text:async()=>options.malformed?'null':'[]'};
      if(options.onRead)await options.onRead();
      if(options.invalidateRead)valid=false;
      if(options.readError)throw Error('read failed');
      return {ok:!options.status,status:options.status||200,json:async()=>options.rows===undefined?[row()]:options.rows};
    }
  });vm.runInContext(code,ctx);
  return {calls,acks,cleared,ctx,run(extra={}){
    const req=row({cupd:10,_casCupd:5,...extra});
    return ctx.kvPushRows('synthetic',[req],rs=>acks.push(JSON.parse(JSON.stringify(rs))),options.label||'kv_push',()=>valid);
  }};
}
for(const label of ['kv_push','personal_push'])for(const missing of [false,true])test(label+' confirms an exact persisted body after an empty '+(missing?'insert':'patch')+' response',async()=>{
  const h=harness({label});await h.run(missing?{_casCupd:undefined,_casMissing:true}:{});
  assert.equal(h.acks.length,1);assert.equal(h.acks[0][0].cupd,7);assert.equal(h.cleared.length,1);
  assert.deepEqual(h.calls.map(x=>x.method),[missing?'POST':'PATCH','GET']);
  assert.equal(h.calls[1].stage,label+'_cas_verify');assert.match(h.calls[1].url,/workspace_id=eq.workspace-a&k=eq.cs_team_notice_v1&select=workspace_id,k,v,cupd$/);
});
test('an unchanged server version with different content is a refusal, not a new competing edit',async()=>{
  const h=harness({rows:[row({cupd:5,v:'another body'})]});
  await assert.rejects(h.run(),e=>e.psCode==='sync_server_rejected'&&e.psStage==='kv_push_cas_verify'&&!e.psRejectedKeys);
  assert.equal(h.acks.length,0);assert.equal(h.cleared.length,0);assert.equal(h.calls.filter(x=>x.method!=='GET').length,1);
});
test('a real newer competing body remains unacknowledged and is never force-written',async()=>{
  const h=harness({rows:[row({v:'newer remote body'})]});
  await assert.rejects(h.run(),e=>e.psCode==='sync_conflict');assert.equal(h.acks.length,0);assert.equal(h.cleared.length,0);
  assert.equal(h.calls.length,2);assert.equal(h.calls[1].method,'GET');
});
for(const [name,rows] of Object.entries({missing:[],duplicate:[row(),row()],wrongWorkspace:[row({workspace_id:'other'})],wrongKey:[row({k:'other'})],invalidBody:[row({v:null})],invalidVersion:[row({cupd:true})],zeroVersion:[row({cupd:0})],malformed:{}}))test('empty CAS never acknowledges '+name+' readback',async()=>{
  const h=harness({rows});await assert.rejects(h.run(),e=>e.psCode==='sync_confirm_missing');assert.equal(h.acks.length,0);assert.equal(h.cleared.length,0);
});
for(const opts of [{status:403},{readError:true},{invalidateRead:true}])test('failed or stale confirmation preserves pending state '+JSON.stringify(opts),async()=>{
  const h=harness(opts);await assert.rejects(h.run());assert.equal(h.acks.length,0);assert.equal(h.cleared.length,0);
});
test('an invalid mutation response is not converted into a conflict or an acknowledgement',async()=>{
  const h=harness({malformed:true});await assert.rejects(h.run(),e=>e.psCode==='sync_confirm_missing');assert.equal(h.calls.length,1);assert.equal(h.acks.length,0);
});
test('player-row CAS keeps the existing soft conflict review path',async()=>{
  const h=harness();await h.run({k:'sq:synthetic',_casSoft:true});assert.equal(h.ctx._itemConflicts.length,1);assert.equal(h.calls.length,1);assert.equal(h.acks.length,0);
});
