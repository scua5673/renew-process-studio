'use strict';
// Isolated PGlite and synthetic identities only. No application data/network.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite');
const read=s=>fs.readFileSync(path.join(__dirname,'20260913_shared_views.'+s),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),U=id(3),V=id(4),W=id(100),X=id(101);let assertions=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);assertions++;};
async function actor(db,uid,fn,role='authenticated'){
 await db.exec('BEGIN');try{
  await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(uid?{sub:uid,role}:{role})]);
  await db.exec('SET LOCAL ROLE '+role);
  assert.deepEqual((await db.query('SELECT current_user actor,auth.uid()::text uid,(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) bypass')).rows[0],{actor:role,uid:uid||null,bypass:false});
  const r=await fn();await db.exec('COMMIT');return r;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
async function fail(fn,code,label){let e;try{await fn();}catch(x){e=x;}assert.ok(e,label+' must fail');equal(e.code,code,label);}
const put=(db,uid=A,wid=W,subject=U,kind='player_matches')=>actor(db,uid,async()=>(await db.query('SELECT public.ps_shared_view_put($1,$2,$3) row',[wid,subject,kind])).rows[0].row);
const list=(db,uid=A,target=U,wid=null)=>actor(db,uid,async()=>(await db.query('SELECT public.ps_admin_shared_views_list($1,$2) rows',[target,wid])).rows[0].rows);
const setRole=(db,uid,role,wid=W)=>db.query("UPDATE public.ps_kv SET v=jsonb_set(v::jsonb,ARRAY['members',$1,'role'],to_jsonb($2::text))::text WHERE workspace_id=$3 AND k='cs_perms_v1'",[uid,role,wid]);
async function baseline(db){return (await db.query(`SELECT
 (SELECT jsonb_agg(jsonb_build_object('name',c.relname,'acl',c.relacl::text,'rls',c.relrowsecurity,'owner',c.relowner) ORDER BY c.relname) FROM pg_class c WHERE c.oid IN ('public.ps_kv'::regclass,'public.ps_events'::regclass,'public.ps_members'::regclass,'public.ps_admins'::regclass)) tables,
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p) policies,
 (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(oid),'acl',proacl::text) ORDER BY proname) FROM pg_proc WHERE oid IN ('public.ps_is_admin()'::regprocedure,'public.ps_is_member(uuid)'::regprocedure,'public.ps_team_role(uuid)'::regprocedure,'public.ps_is_owner(uuid)'::regprocedure,'auth.uid()'::regprocedure)) helpers`)).rows[0];}
async function run(){const db=new PGlite();try{
 await db.exec(fs.readFileSync(path.join(__dirname,'20260913_admin_operations.local-fixture.sql'),'utf8'));
 await db.exec(read('local-fixture.sql'));
 for(const uid of [A,B,U,V])await db.query('INSERT INTO auth.users VALUES($1)',[uid]);
 await db.query('INSERT INTO public.ps_admins VALUES($1),($2)',[A,B]);
 await db.query('INSERT INTO public.ps_workspaces(id,name) VALUES($1,$2),($3,$4)',[W,'Synthetic view team',X,'Other synthetic team']);
 await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3),($1,$4,$5),($6,$7,$5)',[W,A,'staff',U,'player',X,V]);
 for(const [wid,members] of [[W,{[A]:{role:'staff'},[U]:{role:'player'}}],[X,{[V]:{role:'player'}}]]){
  await db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'cs_perms_v1',$2)",[wid,JSON.stringify({defaultRole:'player',members})]);
 }
 const original=await baseline(db);await db.exec(read('sql'));await db.exec(read('sql'));await db.exec(read('verify.sql'));
 equal(await baseline(db),original,'repeat installation preserves existing tables/policies/helpers');
 for(const role of ['anon','authenticated'])for(const command of ['SELECT * FROM','DELETE FROM','INSERT INTO']){
  await fail(()=>actor(db,role==='authenticated'?A:null,()=>db.query(command+' public.ps_shared_views'+(command==='INSERT INTO'?' DEFAULT VALUES':'')),role),'42501','direct '+role+' '+command+' denied');
 }
 await fail(()=>actor(db,null,()=>db.query('SELECT public.ps_shared_view_put($1,$2)',[W,U]),'anon'),'42501','anonymous report denied');
 await fail(()=>put(db,null),'42501','missing JWT actor denied');
 await fail(()=>put(db,A,W,A),'42501','self-view rejected');
 await fail(()=>put(db,A,X,V),'42501','actor outside target workspace denied');
 await fail(()=>put(db,A,W,V),'42501','subject outside actor workspace denied');
 await fail(()=>put(db,B,W,U),'42501','service administrator cannot fabricate unjoined-space reports');
 await fail(()=>put(db,U,W,A),'42501','same-team player cannot submit a direct coach-view RPC');
 await fail(()=>put(db,A,W,U,'other'),'22023','only player_matches kind allowed');
 await fail(()=>put(db,A,W,null),'22023','subject required');
 await fail(()=>put(db,A,null,U),'22023','workspace required');
 let row=await actor(db,A,async()=>(await db.query('SELECT public.ps_shared_view_put($1,$2) row',[W,U])).rows[0].row);
 equal(row.user_id,A,'actor assigned by JWT');equal(row.subject_user_id,U,'subject stored');equal(row.view_kind,'player_matches','default kind');
 equal(Object.keys(row).sort(),['user_id','workspace_id','subject_user_id','view_kind','received_at'].sort(),'no original content or individual match identifier');
 const first=row.received_at;row=await put(db);equal(row.received_at>=first,true,'server receipt refreshed');
 for(const role of ['admin','executive','staff']){
  await setRole(db,A,role);equal((await put(db)).user_id,A,role+' member can report');
 }
 const beforeDemotion=(await db.query('SELECT * FROM public.ps_shared_views')).rows;
 for(const role of ['player','guest','']){
  await setRole(db,A,role);await fail(()=>put(db),'42501',role+' actor role cannot refresh prior coach report');
  equal((await db.query('SELECT * FROM public.ps_shared_views')).rows,beforeDemotion,'denied role change preserves existing receipt');
 }
 await setRole(db,A,'staff');equal((await put(db)).user_id,A,'restored coach role can report again');
 equal((await list(db)).length,1,'repeat screen report updates latest row');
 equal((await list(db,A,A)).length,1,'admin actor-side lookup works');
 equal((await list(db,A,U,X)).length,0,'workspace filter applied');
 equal((await list(db,A,V)).length,0,'unrelated person excluded');
 await fail(()=>list(db,U),'42501','ordinary member cannot read any reports');
 await fail(()=>list(db,null),'42501','missing admin subject denied');
 await fail(()=>list(db,A,null),'22023','global unfiltered reads are not supported');
 await db.query('DELETE FROM public.ps_members WHERE workspace_id=$1 AND user_id=$2',[W,U]);
 await fail(()=>put(db),'42501','subject membership removal blocks refresh');
 await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[W,U,'player']);
 await db.query('DELETE FROM public.ps_members WHERE workspace_id=$1 AND user_id=$2',[W,A]);
 await fail(()=>put(db),'42501','actor membership removal blocks refresh');
 await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[W,A,'staff']);
 await db.query('DELETE FROM public.ps_admins WHERE user_id=$1',[A]);await fail(()=>list(db),'42501','admin revocation blocks reports');await db.query('INSERT INTO public.ps_admins VALUES($1)',[A]);
 await db.query("UPDATE public.ps_shared_views SET received_at=clock_timestamp()-interval '31 days'");
 equal((await list(db)).length,0,'stale rows not interpreted as recent views');
 // Administrative seeding is only for a bounded local pagination fixture.
 for(let i=0;i<103;i++)await db.query("INSERT INTO public.ps_shared_views VALUES($1,$2,$3,'player_matches',clock_timestamp()-$4*interval '1 second')",[id(1000+i),W,U,i]);
 const capped=await list(db);equal(capped.length,100,'recent report list capped at 100');equal(capped[0].user_id,id(1000),'latest report ordered first');
 await fail(()=>put(db,U,W,A),'42501','player still cannot report after earlier coach reports');
 await setRole(db,U,'staff');await put(db,U,W,A);equal((await list(db,A,A)).length,1,'promoted coach reverse report is separate from stale forward view');
 await setRole(db,U,'player');await fail(()=>put(db,U,W,A),'42501','demoted coach cannot renew reverse report');
 const before=(await db.query('SELECT count(*)::int n FROM public.ps_shared_views')).rows[0].n;
 await db.exec(read('rollback.sql'));await db.exec(read('rollback.sql'));
 equal((await db.query('SELECT count(*)::int n FROM public.ps_shared_views')).rows[0].n,before,'rollback preserves observations');
 await fail(()=>put(db),'42501','rollback disables put RPC');await fail(()=>list(db),'42501','rollback disables list RPC');
 equal(await baseline(db),original,'rollback preserves existing policies and helpers');
 await db.exec(read('sql'));await db.exec(read('verify.sql'));equal((await list(db)).length,100,'reinstallation restores access without clearing reports');
 await db.exec("COMMENT ON TABLE public.ps_shared_views IS 'unrelated-owner'");
 await fail(async()=>{try{await db.exec(read('sql'));}catch(e){await db.exec('ROLLBACK');throw e;}},'P0001','foreign table marker blocks install');
 await fail(async()=>{try{await db.exec(read('rollback.sql'));}catch(e){await db.exec('ROLLBACK');throw e;}},'P0001','foreign table marker blocks rollback');
 console.log(JSON.stringify({ok:true,assertions,method:'PGlite synthetic JWT; no production/network data',membershipPairChecked:true,coachRoleGate:true,playerDirectRpcDenied:true,roleChangesChecked:true,adminGate:true,listCap:100,retentionDays:30,existingObjectsUnchanged:true,rollbackPreservesData:true},null,2));
 }finally{await db.close();}}
run().catch(e=>{console.error(e);process.exitCode=1;});
