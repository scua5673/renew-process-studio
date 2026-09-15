'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const code=source.slice(source.indexOf('function kvPushRows('),source.indexOf('/* ── 1.568 안전장치'));
const copy=x=>JSON.parse(JSON.stringify(x));
const keys=['sq:player-1','scout_tool_v1','cs_squad_v1','cs_team_attrs_v1','cs_player_del_v1'];
function fixture(options={}){
  const calls=[],acks=[],cleared=[],server=new Map();let valid=true;
  const ctx=vm.createContext({Promise,Map,Number,JSON,Object,String,Array,encodeURIComponent,
    BASE:'https://server.invalid',KV_PUSH_BYTES:1000000,KV_PUSH_ROWS:15,_itemConflicts:[],
    hj:()=>({}),prefBuild:s=>s,blobPrepRows:async()=>{},
    kvInFilter:ks=>'k=in.('+ks.join(',')+')',
    syncIssue:(code,stage,message)=>Object.assign(new Error(message),{psCode:code,psStage:stage}),
    syncHttpError:(stage,status)=>Object.assign(new Error('HTTP '+status),{psStage:stage}),
    holdClear:k=>cleared.push(k),importApprovalClear:()=>{},
    async syncFetch(stage,url,init){
      const u=new URL(url),method=init.method||'GET';calls.push({method,select:u.searchParams.get('select'),url});
      let result;
      if(method==='GET'){
        if(options.readFailure)throw new Error('offline while verifying');
        const wid=u.searchParams.get('workspace_id').slice(3),wanted=u.searchParams.get('k').slice(4,-1).split(',');
        result=wanted.flatMap(k=>server.has(wid+'|'+k)?[copy(server.get(wid+'|'+k))]:[]);
        if(options.read)result=options.read(result);
        if(options.invalidateRead)valid=false;
      }else{
        const body=JSON.parse(init.body),list=Array.isArray(body)?body:[body];
        result=list.map(r=>{
          if(method==='PATCH')r={...r,workspace_id:u.searchParams.get('workspace_id').slice(3),k:u.searchParams.get('k').slice(3)};
          const saved=options.saved?options.saved(copy(r)):copy(r);server.set(r.workspace_id+'|'+r.k,saved);return saved;
        });
        if(!u.searchParams.get('select').split(',').includes('v'))result=result.map(({workspace_id,k,cupd})=>({workspace_id,k,cupd}));
        if(options.response)result=options.response(copy(result));
      }
      return {ok:true,status:200,json:async()=>copy(result),text:async()=>JSON.stringify(result)};
    }
  });vm.runInContext(code,ctx);
  return {calls,acks,cleared,server,ctx,run(rows){return ctx.kvPushRows('synthetic',rows,rs=>acks.push(copy(rs)),'ack-test',()=>valid);}};
}
const request=(k,more={})=>({workspace_id:'team-a',k,v:'{"saved":"exact original"}',cupd:10,...more});
for(const k of keys){
  test(k+': same version with a different stored body never acknowledges the edit',async()=>{
    const h=fixture({saved:r=>({...r,v:'{"saved":"server kept another body"}'})});
    await assert.rejects(h.run([request(k)]),e=>e.psCode==='sync_server_rejected');
    assert.equal(h.acks.length,0);assert.equal(h.cleared.length,0);assert.ok(h.calls[0].select.split(',').includes('v'));
  });
  test(k+': exact body is acknowledged with the actual server version on a retry',async()=>{
    const h=fixture({saved:r=>({...r,cupd:7})});await h.run([request(k)]);
    assert.equal(h.acks[0][0].cupd,7);assert.equal(h.calls.length,1,'full response avoids a second download');
  });
  test(k+': missing response body requires a complete exact verification read',async()=>{
    const h=fixture({response:rs=>rs.map(({workspace_id,k,cupd})=>({workspace_id,k,cupd}))});await h.run([request(k)]);
    assert.equal(h.calls.length,2);assert.equal(h.calls[1].method,'GET');assert.equal(h.acks.length,1);
  });
}
test('CAS patches and missing-row inserts both request the saved roster body',async()=>{
  for(const options of [{_casCupd:1},{_casMissing:true}]){
    const h=fixture();await h.run([request('sq:p',options)]);assert.ok(h.calls[0].select.split(',').includes('v'));assert.equal(h.acks.length,1);
  }
});
test('a changed row with an unchanged timestamp is retained for the existing conflict handler',async()=>{
  const h=fixture({saved:r=>({...r,v:'ANOTHER_PLAYER_EDIT'})});await h.run([request('sq:p',{_casCupd:1,_casSoft:true})]);
  assert.equal(h.acks.length,0);assert.equal(h.ctx._itemConflicts.length,1);assert.equal(h.ctx._itemConflicts[0].v,request('sq:p').v);
});
for(const mode of ['missing row','wrong workspace','duplicate row','bad version'])test('verification refuses '+mode,async()=>{
  const alter=rs=>mode==='missing row'?[]:mode==='wrong workspace'?rs.map(r=>({...r,workspace_id:'team-b'})):mode==='duplicate row'?rs.concat(rs):rs.map(r=>({...r,cupd:null}));
  const h=fixture({response:alter,read:alter});await assert.rejects(h.run([request('sq:p')]));assert.equal(h.acks.length,0);assert.equal(h.cleared.length,0);
});
test('failed confirmation read keeps the edit unacknowledged',async()=>{
  const h=fixture({response:()=>[],readFailure:true});await assert.rejects(h.run([request('sq:p')]),/offline/);assert.equal(h.acks.length,0);
});
test('a boolean cannot stand in for a server revision',async()=>{
  const h=fixture({saved:r=>({...r,cupd:true})});await assert.rejects(h.run([request('sq:p')]));assert.equal(h.acks.length,0);
});
test('workspace switch during confirmation cannot clear the pending edit',async()=>{
  const h=fixture({response:()=>[],invalidateRead:true});await assert.rejects(h.run([request('sq:p')]),e=>e.psCode==='sync_workspace_changed');assert.equal(h.acks.length,0);assert.equal(h.cleared.length,0);
});
test('versions for the same key in separate workspaces remain distinct',async()=>{
  const h=fixture({saved:r=>({...r,cupd:r.workspace_id==='team-a'?11:22})});await h.run([request('scout_tool_v1'),request('scout_tool_v1',{workspace_id:'team-b'})]);
  assert.deepEqual(h.acks[0].map(r=>r.cupd),[11,22]);
});
test('unrelated documents retain the compact timestamp response',async()=>{
  const h=fixture();await h.run([request('cs_notes_v1')]);assert.equal(h.calls.length,1);assert.equal(h.calls[0].select,'workspace_id,k,cupd');
});
