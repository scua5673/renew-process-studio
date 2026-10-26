'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio/sync.js'),'utf8');
const Confirmation=require('../studio/sync-confirmation.js');
const KEY='process_coach_v1',W='11111111-1111-4111-8111-111111111111',A='22222222-2222-4222-8222-222222222222',RAW='{"weeks":{},"note":"synthetic exact body"}';
const clone=x=>JSON.parse(JSON.stringify(x));
function harness(){
 let identity={uid:A,wid:W,seal:'owner-a',epoch:0,switchSeal:'',switchEpoch:'1'},permission='synthetic permitted',role='owner',allowed=true,metadata={h:{},c:{}},state={kind:'ok',n:0,review:0};
 const calls=[],sideEffects=[];
 const c={busy:false,hash:raw=>raw==null?'':String(raw.length)+':'+raw,meta:()=>clone(metadata)};
 const api=Confirmation.create({key:KEY,
  context:()=>allowed?{...clone(identity),permission,role}:null,
  meta:()=>c.meta(),hash:raw=>c.hash(raw),state:()=>clone(state),busy:()=>c.busy});
 Object.assign(c,{syncValueBegin:api.begin,syncValueObserve:api.observe,syncValueObserveAccepted:api.observeAccepted,
  syncValueAck:api.ack,syncValueFinish:api.finish,syncValueEdited:api.edited,syncConfirmedValue:api.confirmedValue});
 const row=(raw=RAW,version=7)=>({workspace_id:W,k:KEY,v:raw,cupd:version});
 const result=changes=>({pending:0,skipped:[],held:[],deferred:[],scheduleDeferred:false,...changes});
 function meta(raw=RAW,version=7){metadata={h:{[KEY]:c.hash(raw)},c:{[KEY]:version}};}
 function observe(round,rows=[row()],mode='pull',keys=[KEY],wid=W){c.syncValueObserve(round,wid,rows,keys,mode);}
 function confirmed(raw=RAW){return c.syncConfirmedValue(KEY,raw);}
 function commit(raw=RAW,version=7){const r=c.syncValueBegin();observe(r,[row(raw,version)]);meta(raw,version);c.syncValueFinish(r,result());return r;}
 return {c,calls,sideEffects,row,result,meta,observe,confirmed,commit,identity:()=>identity,
  change(x){identity={...identity,...x};},permission(v){permission=v;},role(v){role=v;},allow(v){allowed=v;},state(v){state={kind:'ok',n:0,review:0,...v};},
  accept(req,rows,readback){const round=api.begin();api.ack(round,[req],readback?[rows,readback]:[rows]);const stored=readback?readback[0]:req;meta(stored.v,stored.cupd);api.finish(round,result());return round;}};
}
test('matching persisted metadata, a successful unrelated sync and a local base are not exact proof',()=>{
 const h=harness();h.meta();assert.equal(h.confirmed(),false);const r=h.c.syncValueBegin();h.observe(r,[{workspace_id:W,k:'other',v:RAW,cupd:7}],'ack',['other']);h.c.syncValueFinish(r,h.result());assert.equal(h.confirmed(),false);
});
test('actual full server row requires successful round completion, even after busy watchdog clears',()=>{
 const h=harness(),r=h.c.syncValueBegin();h.observe(r);h.meta();h.c.busy=false;assert.equal(h.confirmed(),false);h.c.syncValueFinish(r,h.result());assert.equal(h.confirmed(),true);assert.deepEqual(h.sideEffects,[]);assert.deepEqual(h.calls,[]);
});
test('raw equality remains exact even when fingerprints collide',()=>{
 const h=harness();h.c.hash=()=> 'collision';h.commit();assert.equal(h.confirmed(),true);assert.equal(h.confirmed(RAW.replace('exact','wrong')),false);assert.equal(h.c.syncConfirmedValue('other',RAW),false);assert.equal(h.c.syncConfirmedValue(KEY,null),false);
});
for(const field of ['uid','wid','seal','epoch','switchSeal','switchEpoch'])test('receipt cannot cross owner '+field,()=>{
 const h=harness();h.commit();h.change({[field]:field==='epoch'?1:'synthetic-other'});assert.equal(h.confirmed(),false);
 const q=harness(),r=q.c.syncValueBegin();q.observe(r);q.meta();q.change({[field]:field==='epoch'?1:'synthetic-other'});q.c.syncValueFinish(r,q.result());assert.equal(q.confirmed(),false);
});
test('permission/role changes and inaccessible keys fail closed',()=>{
 for(const change of [h=>h.permission('changed'),h=>h.role('member'),h=>h.allow(false)]){const h=harness();h.commit();change(h);assert.equal(h.confirmed(),false);}
});
test('same-key edit sequence invalidates an old row and old ACK; unrelated edits cannot confirm it',()=>{
 const h=harness(),r=h.c.syncValueBegin();h.observe(r);h.meta();h.c.syncValueEdited(KEY);h.c.syncValueFinish(r,h.result());assert.equal(h.confirmed(),false);
 h.commit();h.c.syncValueEdited('other');assert.equal(h.confirmed(),true);h.c.syncValueEdited(KEY);assert.equal(h.confirmed(),false);
});
test('late older round cannot end or publish a newer round',()=>{
 const h=harness(),old=h.c.syncValueBegin();h.observe(old);const fresh=h.c.syncValueBegin();h.observe(fresh,[h.row('new raw',8)]);h.meta('new raw',8);h.c.syncValueFinish(old,h.result());assert.equal(h.confirmed('new raw'),false);h.c.syncValueFinish(fresh,h.result());assert.equal(h.confirmed('new raw'),true);assert.equal(h.confirmed(),false);
});
for(const state of [{kind:'busy'},{kind:'pending'},{kind:'ask'},{kind:'bad'},{kind:'wait'},{n:1},{review:1}])test('busy/pending/review cannot claim confirmation '+JSON.stringify(state),()=>{
 const h=harness();h.commit();h.state(state);assert.equal(h.confirmed(),false);
});
test('changed metadata version/fingerprint and failed reads are only invalidation fences',()=>{
 const h=harness();h.commit();h.meta(RAW,8);assert.equal(h.confirmed(),false);h.meta('different',7);assert.equal(h.confirmed(),false);h.c.meta=()=>{throw Error('unavailable');};assert.equal(h.confirmed(),false);
});
for(const delta of [{error:'failed'},{personalError:{code:'failed'}},{scheduleDeferred:true},{pending:1},{skipped:[KEY]},{held:[KEY]},{deferred:[KEY]}])test('incomplete round cannot publish or retain a receipt '+JSON.stringify(delta),()=>{
 const h=harness();h.commit();const r=h.c.syncValueBegin();h.observe(r);h.c.syncValueFinish(r,h.result(delta));assert.equal(h.confirmed(),false);
});
for(const kind of ['missing','duplicate','wrong-workspace','bad-version','local-base'])test('actual response refuses '+kind,()=>{
 const h=harness(),r=h.c.syncValueBegin();let rows=[h.row()];if(kind==='missing')rows=[];if(kind==='duplicate')rows.push(h.row());if(kind==='wrong-workspace')rows[0].workspace_id='other';if(kind==='bad-version')rows[0].cupd=true;if(kind==='local-base')rows[0].__fromBase=1;h.observe(r,rows);h.meta();h.c.syncValueFinish(r,h.result());assert.equal(h.confirmed(),false);
});
test('accepted atomic CAS proves exact submitted raw from unique strictly newer version',()=>{
 const h=harness();h.accept({workspace_id:W,k:KEY,v:RAW,cupd:7,_casCupd:5},[{workspace_id:W,k:KEY,cupd:7}]);assert.equal(h.confirmed(),true);assert.deepEqual(h.sideEffects,[]);assert.deepEqual(h.calls,[]);
});
test('conditional missing-row insert has an accepted-body receipt',()=>{
 const h=harness();h.accept({workspace_id:W,k:KEY,v:RAW,cupd:7,_casMissing:true},[{workspace_id:W,k:KEY,cupd:7}]);assert.equal(h.confirmed(),true);
});
test('invalid expected CAS guard cannot create an accepted-body receipt',()=>{
 for(const previous of [true,{},NaN,Infinity,-1,7]){const h=harness(),r=h.c.syncValueBegin();h.c.syncValueObserveAccepted(r,[{workspace_id:W,k:KEY,v:RAW,cupd:7,_casCupd:previous}],[{workspace_id:W,k:KEY,cupd:7}]);h.meta();h.c.syncValueFinish(r,h.result());assert.equal(h.confirmed(),false);}
});
test('plain/unconditional version-only ACK is never promoted to exact body proof',()=>{
 const h=harness();h.accept({workspace_id:W,k:KEY,v:RAW,cupd:7},[{workspace_id:W,k:KEY,cupd:7}]);assert.equal(h.confirmed(),false);
});
test('empty CAS proof requires the existing actual full-row readback',()=>{
 const h=harness();h.accept({workspace_id:W,k:KEY,v:RAW,cupd:5,_casCupd:5},[],[h.row(RAW,5)]);assert.equal(h.confirmed(),true);assert.deepEqual(h.sideEffects,[]);
 const q=harness();q.accept({workspace_id:W,k:KEY,v:RAW,cupd:7,_casCupd:5},[]);assert.equal(q.confirmed(),false);
});
test('refused CAS, duplicate ACK and conflicting echoed body cannot create accepted-body proof',()=>{
 for(const rows of [[harness().row('server refused',5)],[harness().row(),harness().row()],[harness().row('different echoed body',7)]]){
  const h=harness();h.accept({workspace_id:W,k:KEY,v:RAW,cupd:7,_casCupd:5},rows);assert.equal(h.confirmed(),false);
 }
});
test('blob-prepared wire bytes cannot confirm a different inline local body',()=>{
 const h=harness(),wire='{"emblemRef":"synthetic-ref"}';h.accept({workspace_id:W,k:KEY,v:wire,cupd:7,_casCupd:5},[{workspace_id:W,k:KEY,cupd:7}]);assert.equal(h.confirmed(),false);assert.equal(h.confirmed(wire),true);
});
test('exact schedule ACK deferred only by another key waits for a later clean round without another server read',()=>{
 const h=harness(),r=h.c.syncValueBegin();h.observe(r);h.meta();h.c.syncValueFinish(r,h.result({deferred:['cs_team_matches_v1']}));
 assert.equal(h.confirmed(),false,'a deferred round must never display server confirmation');
 const clean=h.c.syncValueBegin();assert.equal(h.confirmed(),false,'the next active round is still unconfirmed');h.c.syncValueFinish(clean,h.result());
 assert.equal(h.confirmed(),true,'the already exact ACK can be published only after the same-owner clean round');assert.deepEqual(h.sideEffects,[]);assert.deepEqual(h.calls,[]);
});
for(const change of ['edit','owner','failed-round','self-deferred','pending'])test('provisional schedule proof is invalidated by '+change,()=>{
 const h=harness(),r=h.c.syncValueBegin();h.observe(r);h.meta();h.c.syncValueFinish(r,h.result({deferred:['cs_team_matches_v1']}));
 if(change==='edit')h.c.syncValueEdited(KEY);if(change==='owner')h.change({epoch:1});
 if(change==='failed-round'||change==='self-deferred'||change==='pending'){const q=h.c.syncValueBegin();h.c.syncValueFinish(q,h.result(change==='failed-round'?{error:'failed'}:change==='pending'?{pending:1}:{deferred:[KEY]}));}
 const clean=h.c.syncValueBegin();h.c.syncValueFinish(clean,h.result());assert.equal(h.confirmed(),false);
});
test('public API and existing normal-round hooks are wired without trusting clock or metadata alone',()=>{
 assert.match(source,/confirmedValue:syncConfirmedValue/);assert.match(source,/kvPullValues\(at,wid,needV,valueRound\)/);assert.match(source,/syncValueFinish\(valueRound,result\)/);assert.match(source,/syncValueFinish\(valueRound,\{error:info.code\}\)/);assert.match(source,/syncValueEdited\(e.key\)/);assert.match(source,/syncValueAck\(valueRound,ch,observedResponses\)/);assert.match(source,/PSSyncConfirmation.create/);
});

test('actual schedule SQL guards preserve exact accepted CAS bytes; rejected/noop versions cannot impersonate acceptance',async()=>{
 const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite'),sql=fs.readFileSync(path.join(__dirname,'../migrations/00000000_baseline.sql'),'utf8'),db=new PGlite();
 const fn=name=>{const a=sql.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'('),b=sql.indexOf('$function$;',a);assert.ok(a>0&&b>a,name);return sql.slice(a,b+'$function$;'.length);};
 try{
  await db.exec(`set check_function_bodies=off;create schema auth;create function auth.uid() returns uuid language sql as $$select '${A}'::uuid$$;create function auth.role() returns text language sql as $$select 'authenticated'::text$$;
   create table ps_workspaces(id uuid primary key,owner_id uuid);create table ps_guard_mode(id int,enforce boolean);insert into ps_guard_mode values(1,true);
   create table ps_app_policy(id int,min_build text,note text,block_unversioned boolean);create table ps_kv(workspace_id uuid,k text,v text,cupd bigint,updated_at timestamptz,updated_by uuid,primary key(workspace_id,k));
   create function public.ps_kv_note_denied(uuid,uuid,text,text) returns void language sql as $$select$$;insert into ps_workspaces values('${W}','${A}');`);
  for(const name of ['ps_1644_json_truthy','ps_1644_schedule_structure_ok','ps_1644_lineage_guard','ps_kv_build_guard','ps_kv_shape_guard','ps_kv_noop_guard','ps_kv_team_guard','ps_touch','ps_kv_stamp_who'])await db.exec(fn(name));
  for(const name of ['ps_00_lineage_guard_1644_t','ps_00a_build_guard_t','ps_00b_shape_guard_t','ps_00c_noop_guard_t','ps_kv_team_guard_insert_t','ps_kv_team_guard_t','ps_kv_touch','ps_kv_who_t']){const line=sql.split('\n').find(l=>l.startsWith('CREATE TRIGGER '+name+' '));assert.ok(line,name);await db.exec(line);}
  const doc=(rev,extra={})=>({anchorMonday:'2026-10-26',weeks:{0:Array.from({length:7},()=>({}))},scheduleRev:rev,scheduleBaseRev:rev-1,scheduleToken:'synthetic-schedule-token-'+rev,scheduleBaseToken:rev===1?'':'synthetic-schedule-token-'+(rev-1),editedAt:100+rev,note:'exact bytes — spaces preserved',...extra});
  const first=JSON.stringify(doc(1)),next=JSON.stringify(doc(2),null,1);
  await db.query('insert into ps_kv(workspace_id,k,v,cupd) values($1,$2,$3,7)',[W,KEY,first]);
  const accepted=await db.query('update ps_kv set v=$1,cupd=8 where workspace_id=$2 and k=$3 and cupd=7 returning workspace_id,k,cupd',[next,W,KEY]);assert.equal(accepted.rows.length,1);assert.equal(Number(accepted.rows[0].cupd),8);assert.equal((await db.query('select v from ps_kv')).rows[0].v,next,'accepted text is byte-exact, not normalized JSON');
  const stale=await db.query('update ps_kv set v=$1,cupd=9 where workspace_id=$2 and k=$3 and cupd=7 returning cupd',[JSON.stringify(doc(3)),W,KEY]);assert.equal(stale.rows.length,0);
  const denied=await db.query('update ps_kv set v=$1,cupd=9 where workspace_id=$2 and k=$3 and cupd=8 returning cupd',[first,W,KEY]);assert.equal(denied.rows.length,0,'invalid lineage cannot return the requested newer version');
  const noop=await db.query('update ps_kv set v=$1,cupd=9 where workspace_id=$2 and k=$3 and cupd=8 returning cupd',[next,W,KEY]);assert.equal(Number(noop.rows[0].cupd),8,'no-op keeps the older version');
  const stored=(await db.query('select v,cupd from ps_kv')).rows[0];assert.equal(stored.v,next);assert.equal(Number(stored.cupd),8);
 }finally{await db.close();}
});
