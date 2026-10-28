'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../studio/sync-diagnosis.js'),UI=require('../studio/sync-diagnosis-ui.js');
const key='scout_tool_v1',clone=x=>JSON.parse(JSON.stringify(x));
const raw=(players=[{id:'p1',name:'가상 선수',memo:'첫 메모'}],extra={})=>JSON.stringify({players,attrs:[],positions:[],...extra});
test('status line tolerates a partial sync API and resumes after diagnosis becomes available',async()=>{
  const callbacks=[],line={textContent:'확인 중'},button={addEventListener(){}};let calls=0;
  const win={PSSync:{},document:{getElementById:id=>id==='psDiagOpen'?button:line,addEventListener(){}},setInterval:fn=>callbacks.push(fn),setTimeout(){}};
  assert.doesNotThrow(()=>UI.install(win));assert.doesNotThrow(()=>callbacks[0]());assert.equal(line.textContent,'확인 중');
  win.PSSync.diag=async()=>{calls++;return {current:()=>true,online:true,lastPull:0,pending:[]};};callbacks[0]();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.match(line.textContent,/전송 대기 목록 없음/);
});
function sources(a,b=a,c=a){return [a,b,c].map((value,i)=>({id:['screen','device','server'][i],status:'read',raw:value}));}
function fixture(){
  let owner={uid:'coach-a',wid:'team-a',seal:'A'},mirror=raw(),idb=raw(),server=raw();const reads=[],hooks={};
  const d={context:()=>clone(owner),current:c=>JSON.stringify(c)===JSON.stringify(owner),mirror:()=>mirror,
    stored:async()=>{reads.push('device');await hooks.stored?.();return idb===null?null:{value:idb};},
    server:async ctx=>{reads.push('server:'+ctx.wid);await hooks.server?.();return server===null?[]:[{k:key,v:server,cupd:'2026-10-28T01:00:00Z'}];}};
  return {d,reads,hooks,changeOwner(){owner.seal+='B';},setMirror(v){mirror=v;},setIdb(v){idb=v;},setServer(v){server=v;},values:()=>[mirror,idb,server]};
}
test('same headcount still exposes changed player fields, metadata and order',()=>{
  const a=raw([{id:'p1',name:'A',memo:'before'},{id:'p2',name:'B'}]);
  const b=raw([{id:'p2',name:'B'},{id:'p1',name:'A',memo:'after'}],{attrs:[{id:'v1',name:'새 기준'}]});
  const c=D.compare(sources(a,b,a));assert.equal(c.complete,true);assert.deepEqual(c.sources.map(x=>x.roster),[2,2,2]);
  assert.equal(c.players.length,1);assert.deepEqual(c.players[0].fields.map(x=>x.key),['memo']);
  assert.deepEqual(c.document.map(x=>x.key),['attrs','players (순서)']);assert.equal(c.rawEqual,false);assert.equal(c.contentEqual,false);
});
test('format and object key order differ without inventing semantic changes',()=>{
  const a=raw(),b=JSON.stringify({positions:[],attrs:[],players:[{memo:'첫 메모',name:'가상 선수',id:'p1'}]},null,2);
  const c=D.compare(sources(a,b));assert.equal(c.contentEqual,true);assert.equal(c.rawEqual,false);
});
test('missing player, removed field, null and empty string remain distinct',()=>{
  const c=D.compare(sources(raw([{id:'p1',memo:null},{id:'p2',memo:''}]),raw([{id:'p1',memo:''}]),raw([{id:'p1'}])));
  assert.equal(c.players.length,2);assert.deepEqual(c.players[1].presence,[true,false,false]);
  assert.deepEqual(c.players[0].fields.find(f=>f.key==='memo').values,[{present:true,value:null},{present:true,value:''},{present:false}]);
});
for(const value of [null,'broken','{}','{"players":{}}','{"players":[{"id":"x"},{"id":"x"}]}','{"players":[{"id":1}]}'])test('unverified document is never an empty roster: '+value,()=>{
  const c=D.compare(sources(raw(),value));assert.equal(c.complete,false);assert.equal(c.sources[1].players,undefined);assert.equal(c.players.length,0);
});
test('read errors remain unknown and valid empty documents stay explicitly empty',()=>{
  const s=sources(raw([]));s[1]={status:'error'};assert.equal(D.compare(s).sources[1].status,'error');
  const c=D.compare(sources(raw([])));assert.equal(c.complete,true);assert.equal(c.sources[0].roster,0);
});
test('malformed criteria, positions or padded IDs cannot be described as valid documents',()=>{
  for(const value of [raw(undefined,{attrs:{}}),raw(undefined,{positions:null}),raw([{id:' padded '}])])assert.equal(D.compare(sources(raw(),value)).sources[1].status,'invalid');
});
test('candidate and deleted records are retained in full comparison',()=>{
  const c=D.compare(sources(raw([{id:'a',type:'target'},{id:'b',_del:123},{id:'c'}]),raw([{id:'a',type:'target',memo:'new'},{id:'b',_del:123},{id:'c'}])));
  assert.equal(c.sources[0].roster,1);assert.equal(c.sources[0].players,3);assert.equal(c.players[0].id,'a');
});
test('field keys and source values with markup are escaped in the comparison UI',()=>{
  const f=fixture();f.setIdb(raw([{id:'p1',name:'<img src=x onerror=alert(1)>','<script>':'<svg onload=alert(1)>'}]));
  return D.inspect(f.d).then(r=>{const html=UI.comparison(r.snapshot);assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<svg'));assert.ok(html.includes('&lt;img'));});
});
test('inspection preserves all three exact raw strings including unknown fields',async()=>{
  const f=fixture();f.setMirror(raw(undefined,{extension:{unknown:'원본\n보존'}}));f.setIdb(raw(undefined,{extension:{unknown:'기기'}}));
  const before=f.values(),result=await D.inspect(f.d);assert.deepEqual(result.snapshot.sources.map(x=>x.raw),before);assert.deepEqual(f.values(),before);
  assert.deepEqual(JSON.parse(JSON.stringify(result.snapshot)).sources.map(x=>x.raw),before);assert.equal(await result.check(),true);
  assert.deepEqual(f.reads,['device','server:team-a','device','device']);
});
for(const stage of ['stored','server'])test('owner/permission change during '+stage+' rejects late private results',async()=>{
  const f=fixture();f.hooks[stage]=()=>f.changeOwner();await assert.rejects(D.inspect(f.d),/바뀌었습니다/);
});
for(const which of ['mirror','idb'])test('local edit during server read rejects mixed snapshots: '+which,async()=>{
  const f=fixture();f.hooks.server=()=>f[which==='mirror'?'setMirror':'setIdb'](raw([{id:'new'}]));await assert.rejects(D.inspect(f.d),/바뀌었습니다/);
});
test('unavailable IDB and offline/server errors cannot produce a success report',async()=>{
  const f=fixture();f.d.stored=async()=>{throw Error('unreadable');};await assert.rejects(D.inspect(f.d),/unreadable/);assert.equal(f.reads.length,0);
  const g=fixture();g.d.server=async()=>{throw Error('offline');};await assert.rejects(D.inspect(g.d),/offline/);
});
for(const rows of [null,{},[{k:'wrong',v:raw(),cupd:1}],[{k:key,v:raw()}],[{k:key,v:null,cupd:1}],[{k:key,v:raw(),cupd:1},{k:key,v:raw(),cupd:1}]])test('ambiguous or incomplete server reply is rejected: '+JSON.stringify(rows),async()=>{
  const f=fixture();f.d.server=async()=>rows;await assert.rejects(D.inspect(f.d),/서버 응답/);
});
test('absent server record is displayed as absent, never as an empty confirmed team',async()=>{
  const f=fixture();f.setServer(null);const r=await D.inspect(f.d);assert.equal(r.snapshot.comparison.complete,false);assert.equal(r.snapshot.comparison.sources[2].status,'absent');
});
test('export guard rechecks owner, mirror and durable source after the dialog opens',async()=>{
  for(const change of [f=>f.changeOwner(),f=>f.setMirror('new'),f=>f.setIdb('new')]){const f=fixture(),r=await D.inspect(f.d);change(f);await assert.rejects(r.check(),/바뀌었습니다/);}
});
function diagnostic(){
  const f=fixture(),queue=[{uid:'coach-a',wid:'team-a',key:'attrs',roundError:'sync_storage',roundStage:'roster_copies_differ',roundFails:30000},
    {uid:'coach-a',wid:'team-a',key:'schedule',roundError:'sync_storage',roundStage:'roster_copies_differ'},
    {uid:'someone-else',wid:'team-a',key:'secret'},{uid:'coach-a',wid:'another-team',key:'secret2'}];
  Object.assign(f.d,{outbox:async()=>clone(queue),held:()=>[{kind:'conflict',uid:'coach-a',wid:'team-a',k:'attrs'}],label:k=>k,text:c=>c,info:()=>({ws:'합성 팀',recent:[],largest:[],online:true})});return {...f,queue};
}
test('held choices and shared round interruption are separate; common cause appears once',async()=>{
  const f=diagnostic(),before=clone(f.queue),d=await D.collect(f.d);
  assert.equal(d.pending.length,2);assert.equal(d.reviewCount,1);assert.deepEqual(d.pending.map(x=>x.kind),['review','waiting']);
  assert.equal(d.blockers.length,1);assert.equal(d.blockers[0].stage,'roster_copies_differ');assert.equal(d.pending[0].round.count,30000);
  assert.deepEqual(f.queue,before);assert.equal(d.current(),true);f.changeOwner();assert.equal(d.current(),false);
});
test('historical send error cannot hide a different round error or held choice',async()=>{
  const f=diagnostic();Object.assign(f.queue[0],{lastError:'sync_network',lastStage:'kv_push',attempts:1});const d=await D.collect(f.d);
  assert.equal(d.pending[0].kind,'review');assert.equal(d.pending[0].push.code,'sync_network');assert.equal(d.pending[0].round.code,'sync_storage');
});
test('another owner or already chosen held row cannot label this owner as requiring a choice',async()=>{
  const f=diagnostic();f.d.held=()=>[{kind:'conflict',uid:'someone-else',wid:'team-a',k:'attrs'},{kind:'conflict',uid:'coach-a',wid:'team-a',k:'schedule',choice:'mine'}];assert.equal((await D.collect(f.d)).reviewCount,0);
});
test('diagnosis rejects account changes and unreadable queue instead of showing empty success',async()=>{
  const f=diagnostic();f.d.outbox=async()=>{f.changeOwner();return f.queue;};await assert.rejects(D.collect(f.d),/바뀌었습니다/);
  f.d.outbox=async()=>{throw Error('storage failed');};await assert.rejects(D.collect(f.d),/storage failed/);
  const html=UI.summary({pending:[],ws:'<script>',online:true});assert.ok(!html.includes('전부 서버'));assert.ok(html.includes('판단할 수는 없어요'));assert.ok(!html.includes('<script>'));
});
test('shipped sync adapters require strict queue reading and make roster reads only in the captured team',async()=>{
  const source=fs.readFileSync(require.resolve('../studio/sync.js'),'utf8'),begin=source.indexOf('  diag:function(){'),end=source.indexOf('  history:function(',begin);
  const f=fixture(),calls=[],c={window:{PSSyncDiagnosis:D},autosaveContext:f.d.context,activeWsObj:()=>({name:'합성 팀'}),navigator:{onLine:true},getSess:()=>({uid:'coach-a'}),SYNC_DIAG_LOG:[],outboxRead:strict=>{assert.equal(strict,true);return Promise.resolve([]);},holdList:()=>[],keyLabel:k=>k,syncCodeText:x=>x,localStorage:{getItem:k=>k===key?f.values()[0]:null},histRosterContext:f.d.context,histRosterCurrent:f.d.current,storage:{get:k=>{assert.equal(k,key);return f.d.stored();}},ensureToken:async()=>{await f.hooks.token?.();return 'synthetic-token';},BASE:'https://fixture.invalid',hj:at=>({authorization:at}),syncFetch:async(stage,url,options)=>{calls.push({stage,url,options});return {ok:true,json:()=>f.d.server(f.d.context())};},syncHttpError:()=>Error('HTTP')};
  const api=vm.runInNewContext('({'+source.slice(begin,end)+'})',c);assert.equal((await api.diag()).pending.length,0);
  const r=await api.inspectRosterCopies();assert.equal(r.snapshot.sources[0].raw,f.values()[0]);assert.equal(calls.length,1);assert.ok(calls[0].url.includes('workspace_id=eq.team-a&k=eq.scout_tool_v1'));assert.equal(calls[0].options.method,undefined);assert.equal(calls[0].options.body,undefined);
  f.hooks.token=()=>f.changeOwner();await assert.rejects(api.inspectRosterCopies(),/권한이 바뀌었습니다/);assert.equal(calls.length,1);
});
