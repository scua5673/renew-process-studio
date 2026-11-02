'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../studio/admin-data.js'),H=require('../studio/admin-hub.js');
const at='2026-11-02T00:00:00.000Z';
function eventReader(count,cap){
 const rows=Array.from({length:count},(_,i)=>({id:count-i,created_at:at,event_name:'a_diary'})),queries=[];
 return {queries,read:async q=>{queries.push(q);const p=new URL('https://fixture.invalid/'+q).searchParams,m=(p.get('or')||'').match(/id\.lt\.(\d+)/);return rows.filter(r=>r.id<(m?+m[1]:Infinity)).slice(0,Math.min(cap,+p.get('limit')));}};
}
test('usage reads the full selected period past a lower server row cap, including equal timestamps',async()=>{
 const f=eventReader(2347,200),r=await D.events(f.read,14,30000,()=>true);
 assert.equal(r.rows.length,2347);assert.equal(new Set(r.rows.map(x=>x.id)).size,2347);assert.equal(r.capped,false);assert.equal(f.queries.length,13);
 assert.equal(new Set(f.queries.map(q=>new URL('https://fixture.invalid/'+q).searchParams.getAll('created_at').join('|'))).size,1);
});
for(const [n,capped] of [[1000,false],[1001,true]])test('usage distinguishes a complete result exactly at the ceiling from a truncated result: '+n,async()=>{
 const f=eventReader(n,150),r=await D.events(f.read,30,1000,()=>true);assert.equal(r.rows.length,1000);assert.equal(r.capped,capped);
});
test('later page failure never yields partial usage success',async()=>{
 const f=eventReader(1200,500);let calls=0;await assert.rejects(D.events(q=>++calls===2?Promise.reject(Error('read failed')):f.read(q),7,30000,()=>true),/read failed/);
});
test('a changed administrator cancels both event and RPC publication after a late response',async()=>{
 for(const kind of ['events','rpc']){let release,valid=true;const read=()=>new Promise(r=>release=r);const p=kind==='events'?D.events(read,7,30000,()=>valid):D.rpcRows(read,'example',{},'id.asc',()=>valid);valid=false;release([]);await assert.rejects(p,/view changed/);}
});
test('a server ignoring the event cursor fails explicitly instead of looping',async()=>{
 await assert.rejects(D.events(async()=>[{id:2,created_at:at}],7,30000,()=>true),/did not advance/);
});
test('metadata RPC lists continue after short pages and use deterministic order',async()=>{
 const source=Array.from({length:1231},(_,id)=>({id})),queries=[];
 const rows=await D.rpcRows(async q=>{queries.push(q);const p=new URL('https://fixture.invalid/'+q).searchParams;return source.slice(+p.get('offset'),+p.get('offset')+137);},'example',{},'id.asc',()=>true);
 assert.equal(rows.length,1231);assert.equal(queries.length,10);assert.ok(queries.every(q=>decodeURIComponent(q).includes('order=id.asc')));
});
test('metadata pagination rejects an endpoint that ignores offsets',async()=>{
 await assert.rejects(D.rpcRows(async()=>[{id:'same'}],'example',{},'id.asc',()=>true),/did not advance/);
});
for(const name of ['ps_admin_people','ps_admin_content_owners'])test('JSON-valued metadata is read once without SQL row filters: '+name,async()=>{
 const calls=[],source=Array.from({length:1251},(_,id)=>({id}));const result=await D.rpcRows(async(q,o)=>{calls.push({q,o});return source;},name,{},'user_id.asc',()=>true);
 assert.equal(result.length,1251);assert.equal(calls.length,1);assert.equal(calls[0].q,'rpc/'+name);assert.equal(calls[0].o.method,'POST');
});
test('independent metric states distinguish zero from unavailable',()=>{
 const s=D.summary({users:{ok:true,rows:[]},workspaces:{ok:false,rows:[{kind:'team'}]},library:{ok:true,rows:[{deleted_at:at},{deleted_at:null}]}});
 assert.deepEqual(s,{accounts:0,spaces:null,teams:null,content:1});assert.equal(D.unknown(s.teams),'확인 못 함');assert.equal(D.unknown(s.accounts),'0');
});
test('team reconstruction uses actual library records and owner identities without guessing a creation date',()=>{
 const activity=[{id:'w',name:'프로세스FC',kind:'team',member_count:2,last_kv:at}],lib=[{workspace_id:'w'},{workspace_id:'w',deleted_at:at},{workspace_id:'other'}];
 const people=[{user_id:'owner',email:'coach@example.test',member_name:'코치',teams:[{workspace_id:'w',owner:true}]}];
 const [w]=D.workspaces(activity,lib,people);assert.equal(w.lib_count,1);assert.equal(w.owner_id,'owner');assert.equal(w.owner_email,'coach@example.test');assert.equal(w.created_at,null);assert.equal(w.last_activity,at);assert.equal(D.workspaces(activity,null,[])[0].lib_count,null);
});
test('activity sort uses the latest of content and document updates without mutating the source',()=>{
 const rows=[{id:'old',last_kv:'2026-09-01'},{id:'new',last_lib:at},{id:'empty'}];assert.deepEqual(D.sortWorkspaces(rows).map(r=>r.id),['new','old','empty']);assert.equal(rows[0].id,'old');
});
test('raw identifiers have operational labels',()=>{assert.equal(D.feature('sq:example'),'선수별 명단 정보');assert.equal(D.feature('cs_private_board_v1'),'개인 작전판');});
test('issue queue ignores stale reports, includes unknown sources and keeps deployed followups open',()=>{
 const now=Date.parse(at),reports=[{user_id:'a',received_at:at,pending_team:1},{user_id:'b',received_at:'2026-09-01',conflicts:3}];
 const rows=H.issues({sources:{teams:{ok:false,label:'팀 목록',tab:'ws'}},reports,followups:[{id:1,status:'deployed',subject_user_id:'a',note:'배포 확인'},{id:2,status:'verified'},{id:3,status:'closed'}]},now);
 assert.equal(rows.length,3);assert.ok(rows.some(r=>r.id==='source:teams'));assert.ok(rows.some(r=>r.id==='followup:1'));assert.ok(rows.some(r=>r.user==='a'));assert.ok(rows.every(r=>r.user!=='b'));
});
test('overdue followups are prioritized without changing their saved status or content',()=>{
 const followups=[{id:1,status:'open',next_check_at:'2026-09-01',note:'원문',subject_user_id:'a'}],before=JSON.stringify(followups),rows=H.issues({followups},Date.parse(at));assert.equal(rows[0].rank,3);assert.equal(JSON.stringify(followups),before);
});
