'use strict';
// Local PGlite only. Does not read application credentials, call a network API,
// or use any real user/team record. Supabase JWT claims are synthetic.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite');
const read=s=>fs.readFileSync(path.join(__dirname,'20260913_admin_operations.'+s),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),U=id(3),V=id(4),W=id(100),X=id(101),D=id(200);
let assertions=0;
function equal(actual,expected,label){assert.deepEqual(actual,expected,label);assertions++;}
const fields={subject_user_id:U,workspace_id:W,kind:'support',note:'Synthetic reconnect check',status:'open',assignee_label:'Operator A',next_check_at:'2026-09-20T03:00:00Z',release_version:'2.792'};
const report={pending_team:1,pending_personal:null,held:0,skipped:null,deferred:2,conflicts:0,oldest_pending_at:'2026-09-13T01:00:00Z',last_round_ack_at:null,error_code:'sync_network',device_class:'tablet',app_version:'2.792',online:true,busy:false};
async function fresh(){const db=new PGlite();await db.exec(read('local-fixture.sql'));
 for(const uid of [A,B,U,V])await db.query('INSERT INTO auth.users VALUES($1)',[uid]);
 await db.query('INSERT INTO public.ps_admins VALUES($1),($2)',[A,B]);
 await db.query('INSERT INTO public.ps_workspaces VALUES($1,$2),($3,$4)',[W,'Synthetic one',X,'Synthetic other']);
 await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3),($1,$4,$5),($6,$7,$8)',[W,U,'admin',A,'member',X,V,'player']);
 return db;}
async function as(db,uid,fn,role='authenticated'){
 await db.exec('BEGIN');
 try{
  await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(uid?{sub:uid,role}:{role})]);
  await db.exec('SET LOCAL ROLE '+role);
  const actual=(await db.query('SELECT current_user actor,auth.uid()::text uid,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) bypass')).rows[0];
  assert.deepEqual(actual,{actor:role,uid:uid||null,bypass:false});
  const result=await fn();await db.exec('COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
async function fail(fn,code,label){let error;try{await fn();}catch(e){error=e;}assert.ok(error,label+' must fail');equal(error.code,code,label);}
const save=(db,uid,rid,ver,data=fields)=>as(db,uid,async()=>(await db.query('SELECT public.ps_admin_followup_save($1,$2,$3) AS row',[rid,ver,JSON.stringify(data)])).rows[0].row);
const put=(db,uid=U,wid=W,seq=1,data=report,device=D)=>as(db,uid,async()=>(await db.query('SELECT public.ps_sync_report_put($1,$2,$3,$4) AS row',[device,wid,seq,JSON.stringify(data)])).rows[0].row);
const list=(db,uid,name='ps_admin_followups_list',target=null,wid=null)=>as(db,uid,async()=>(await db.query('SELECT public.'+name+'($1,$2) AS rows',[target,wid])).rows[0].rows);
async function baseline(db){return (await db.query(`SELECT
 (SELECT jsonb_agg(jsonb_build_object('name',relname,'owner',relowner,'acl',relacl::text,'rls',relrowsecurity,'force',relforcerowsecurity) ORDER BY relname)
 FROM pg_class WHERE oid IN ('public.ps_kv'::regclass,'public.ps_events'::regclass)) tables,
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid IN ('public.ps_kv'::regclass,'public.ps_events'::regclass)) policies,
 (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text) ORDER BY proname) FROM pg_proc
 WHERE oid IN ('public.ps_is_admin()'::regprocedure,'public.ps_is_member(uuid)'::regprocedure,'auth.uid()'::regprocedure)) helpers,
 (SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_trigger t WHERE tgrelid IN ('public.ps_kv'::regclass,'public.ps_events'::regclass)) triggers`)).rows[0];}
async function run(){const db=await fresh();try{
 const original=await baseline(db);await db.exec(read('sql'));await db.exec(read('sql'));
 equal(await baseline(db),original,'existing grants/RLS/policies/triggers/helpers unchanged after repeat installation');
 for(const name of ['ps_admin_followups_list','ps_admin_sync_reports_list']){
  await fail(()=>list(db,U,name),'42501','team admin is not a service admin: '+name);
  await fail(()=>list(db,null,name),'42501','missing authenticated subject: '+name);
  await fail(()=>as(db,null,()=>db.query('SELECT public.'+name+'(null,null)'),'anon'),'42501','anonymous RPC denied: '+name);
 }
 for(const table of ['ps_admin_followups','ps_admin_followup_changes','ps_sync_reports'])for(const role of ['authenticated','anon']){
  await fail(()=>as(db,role==='authenticated'?A:null,()=>db.query('SELECT * FROM public.'+table),role),'42501','direct table read denied '+role+' '+table);
  await fail(()=>as(db,role==='authenticated'?A:null,()=>db.query('DELETE FROM public.'+table),role),'42501','direct DELETE without WHERE denied '+role+' '+table);
  await fail(()=>as(db,role==='authenticated'?A:null,()=>db.query('INSERT INTO public.'+table+' DEFAULT VALUES'),role),'42501','direct INSERT without RETURNING denied '+role+' '+table);
 }
 await fail(()=>as(db,U,()=>db.query('SELECT public.ps_admin_ops_is_admin()')),'42501','internal helper not exposed directly');
 await fail(()=>save(db,U,null,0),'42501','ordinary team admin cannot create operational note');
 let row=await save(db,A,null,0);equal(row.version,1,'server assigns initial version');equal(row.created_by,A,'server assigns creator');
 const created=row.created_at;const rid=row.id;
 equal((await list(db,A,'ps_admin_followups_list',U,W)).length,1,'admin filters target and workspace');
 equal((await list(db,A,'ps_admin_followups_list',V,W)).length,0,'other user filter empty');
 row=await save(db,B,rid,1,{...fields,status:'in_progress',note:'Synthetic follow-up'});
 equal(row.version,2,'second administrator advances version');equal(row.created_at,created,'creation time immutable');equal(row.created_by,A,'creator immutable');equal(row.updated_by,B,'server stamps updater');
 await fail(()=>save(db,A,rid,1,{...fields,note:'Stale edit'}),'PT409','stale second writer cannot overwrite');
 equal((await list(db,A))[0].note,'Synthetic follow-up','stale write preserves current note');
 await fail(()=>save(db,A,rid,null),'22023','version required');
 await fail(()=>save(db,A,null,1),'PT409','create requires zero version');
 await fail(()=>save(db,A,id(777),1),'PT404','missing row not recreated');
 for(const [key,value] of [['note','x'.repeat(2001)],['assignee_label','x'.repeat(81)],['release_version','x'.repeat(41)],['kind','clinical'],['status','unknown'],['next_check_at','tomorrow'],['next_check_at','2026-99-99T00:00:00Z'],['subject_user_id','bad'],['note',{raw:'forbidden'}],['created_by',B],['raw_document','forbidden']])
  await fail(()=>save(db,A,null,0,{...fields,[key]:value}),'22023','invalid follow-up '+key);
 await fail(()=>save(db,A,null,0,{...fields,workspace_id:null,subject_user_id:null}),'22023','subject required');
 await fail(()=>save(db,A,null,0,{...fields,subject_user_id:id(998)}),'22023','unknown subject account rejected');
 await fail(()=>save(db,A,null,0,{...fields,workspace_id:id(999)}),'22023','unknown workspace rejected');
 await fail(()=>save(db,A,null,0,[]),'22023','array payload rejected');
 const audit=(await db.query('SELECT * FROM public.ps_admin_followup_changes ORDER BY id')).rows;
 equal(audit.length,2,'only successful writes audit');equal(audit[1].changed_fields,['note','status'],'audit records changed names only');
 equal(Object.keys(audit[1]).sort(),['actor_id','at','changed_fields','followup_id','from_version','id','to_version'].sort(),'audit contains no note body');
 row=await save(db,A,rid,2,{...fields,status:'closed'});equal(row.status,'closed','close retains row');
 await fail(()=>put(db,U,X),'42501','member cannot report another workspace');
 await fail(()=>put(db,B,W),'42501','service admin still cannot report an unjoined workspace');
 await fail(()=>put(db,null,W),'42501','missing user cannot report');
 await fail(()=>as(db,null,()=>db.query('SELECT public.ps_sync_report_put($1,$2,1,$3)',[D,W,JSON.stringify(report)]),'anon'),'42501','anonymous report RPC denied');
 let r=await put(db);equal(r.user_id,U,'report UID derives solely from JWT');equal(r.pending_personal,null,'unknown count remains null');equal(r.received_at!=null,true,'server receipt time exists');
 await db.query('DELETE FROM public.ps_members WHERE workspace_id=$1 AND user_id=$2',[W,U]);
 await fail(()=>put(db,U,W,2),'42501','membership removal immediately blocks existing report updates');
 await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[W,U,'admin']);
 await fail(()=>put(db,U,W,1),'PT409','same sequence rejected');await fail(()=>put(db,U,W,0),'22023','zero sequence rejected');
 r=await put(db,U,W,3,{...report,pending_team:0,error_code:null});equal(r.report_seq,3,'new sequence accepted');
 await fail(()=>put(db,U,W,2),'PT409','late report cannot restore old pending state');
 equal((await list(db,A,'ps_admin_sync_reports_list',U,W))[0].pending_team,0,'newer report retained');
 await put(db,A,W,1,report,D);equal((await list(db,A,'ps_admin_sync_reports_list')).length,2,'same device ID for two users remains isolated');
 for(const [key,value] of [['pending_team',-1],['pending_personal',100001],['held',1.5],['skipped','0'],['deferred',{}],['conflicts',true],['oldest_pending_at','infinity'],['last_round_ack_at','today'],['error_code','private message'],['error_code','sync_foo'],['device_class','MacBook'],['app_version','x'.repeat(33)],['online','true'],['busy',null],['user_id',V],['raw_document','forbidden'],['received_at','2020-01-01T00:00:00Z']])
  await fail(()=>put(db,U,W,4,{...report,[key]:value}),'22023','invalid report '+key);
 await fail(()=>put(db,U,W,4,[]),'22023','array report rejected');
 for(const key of ['pending_team','pending_personal','held','skipped','deferred','conflicts']){
  const next=(await list(db,A,'ps_admin_sync_reports_list',U,W))[0].report_seq+1;
  const rr=await put(db,U,W,next,{...report,[key]:100000});equal(rr[key],100000,'count boundary accepted '+key);
 }
 await db.query("UPDATE public.ps_sync_reports SET received_at=clock_timestamp()-interval '31 days' WHERE user_id=$1",[A]);
 await put(db,U,W,20,report,id(201));equal((await list(db,A,'ps_admin_sync_reports_list',A,W)).length,1,'ordinary reporting cannot clean another account');
 await put(db,A,W,1,report,id(202));equal((await list(db,A,'ps_admin_sync_reports_list',A,W)).length,1,'own stale report cleanup preserves fresh report');
 await db.query('DELETE FROM public.ps_admins WHERE user_id=$1',[A]);
 await fail(()=>list(db,A),'42501','admin revocation immediately blocks existing metadata reads');
 await db.query('INSERT INTO public.ps_admins VALUES($1)',[A]);
 const counts=(await db.query('SELECT (SELECT count(*) FROM public.ps_admin_followups)::int f,(SELECT count(*) FROM public.ps_admin_followup_changes)::int a,(SELECT count(*) FROM public.ps_sync_reports)::int r')).rows[0];
 await db.exec(read('verify.sql'));await db.exec(read('rollback.sql'));await db.exec(read('rollback.sql'));
 equal((await db.query('SELECT (SELECT count(*) FROM public.ps_admin_followups)::int f,(SELECT count(*) FROM public.ps_admin_followup_changes)::int a,(SELECT count(*) FROM public.ps_sync_reports)::int r')).rows[0],counts,'rollback retains all new data');
 await fail(()=>list(db,A),'42501','rollback disables admin RPC');await fail(()=>put(db,U,W,21),'42501','rollback disables report RPC');
 equal(await baseline(db),original,'rollback leaves existing tables and helpers unchanged');
 await db.exec(read('sql'));equal((await list(db,A)).length,1,'reinstall re-enables RPC and retains data');
 await db.exec("COMMENT ON TABLE public.ps_admin_followups IS 'unrelated-owner'");
 await fail(async()=>{try{await db.exec(read('sql'));}catch(e){await db.exec('ROLLBACK');throw e;}},'P0001','foreign marker blocks reinstall');
 await fail(async()=>{try{await db.exec(read('rollback.sql'));}catch(e){await db.exec('ROLLBACK');throw e;}},'P0001','foreign marker blocks rollback');
 console.log(JSON.stringify({ok:true,assertions,method:'PGlite synthetic JWT/RLS; no production/network data',existingObjectsUnchanged:true,versionConflict:true,staleReportRejected:true,rollbackPreservesData:true},null,2));
 }finally{await db.close();}}
run().catch(e=>{console.error(e);process.exitCode=1;});
