/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 * PGLITE_MODULE=/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite \
 *   node migrations/20260913_scout_write_scope.local-test.cjs
 * Reproduces the catalog-confirmed non-IDP policy subset in a new in-memory DB.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite');
const read=name=>fs.readFileSync(path.join(__dirname,'20260913_scout_write_scope.'+name),'utf8');
const fixture=read('local-fixture.sql'),migration=read('sql'),verify=read('verify.sql'),rollback=read('rollback.sql'),syntheticVerify=read('synthetic-verify.sql');
const TKEY='cs_scout_targets_v1',OTHER='cs_team_notice_v1';
const WID='00000000-0000-4000-8000-000000000100';
const roles=['executive','admin','owner','staff','player','nonmember'];
const ids=Object.fromEntries(roles.map((role,index)=>[role,'00000000-0000-4000-8000-'+String(index+1).padStart(12,'0')]));
const marker='process-studio/scout-write-scope/20260913/v1';
const policyNames=['ps_scout_insert_scope_v1','ps_scout_update_scope_v1','ps_scout_delete_scope_v1'];
let passed=0;const outcomes=[];
function equal(a,b,label){assert.deepEqual(a,b,label);passed++;}
async function fresh(){const db=new PGlite();await db.exec(fixture);return db;}
async function seed(db){
 await db.query('INSERT INTO public.ps_workspaces(id,name,owner_id) VALUES($1,$2,$3)',[WID,'Synthetic policy team',ids.owner]);
 for(const role of roles.filter(x=>x!=='nonmember'))await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[WID,ids[role],role==='owner'?'owner':'member']);
 const perms={v:1,defaultRole:'player',members:Object.fromEntries(roles.map(role=>[ids[role],{role:role==='nonmember'?'executive':role==='owner'?'player':role}]))};
 await db.query('INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,$2,$3)',[WID,'cs_perms_v1',JSON.stringify(perms)]);
}
async function catalog(db){return (await db.query(`SELECT relrowsecurity,relforcerowsecurity,relowner,relacl::text,
 (SELECT jsonb_agg(jsonb_build_object('name',p.polname,'permissive',p.polpermissive,'roles',p.polroles,'cmd',p.polcmd,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname)
 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname NOT IN ('ps_scout_insert_scope_v1','ps_scout_update_scope_v1','ps_scout_delete_scope_v1')) policies,
 (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('ps_is_member','ps_is_owner','ps_team_role','ps_key_scope','ps_can_read_key','ps_can_write_key')) helpers
 FROM pg_class c WHERE c.oid='public.ps_kv'::regclass`)).rows[0];}
async function row(db,key){return (await db.query('SELECT v FROM public.ps_kv WHERE workspace_id=$1 AND k=$2',[WID,key])).rows[0]?.v??null;}
async function actor(db,role){
 const uid=ids[role],claims=JSON.stringify({sub:uid,role:'authenticated'});
 for(const [key,value] of Object.entries({'request.jwt.claims':claims,'request.jwt.claim':claims,'request.jwt.claim.sub':uid,'request.jwt.claim.role':'authenticated'}))await db.query('SELECT set_config($1,$2,true)',[key,value]);
 await db.exec('SET LOCAL ROLE authenticated');
 const actual=(await db.query(`SELECT current_user AS actor,auth.uid()::text AS uid,auth.role() AS jwt_role,
 (SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass,
 (SELECT relowner=current_user::regrole FROM pg_class WHERE oid='public.ps_kv'::regclass) AS owns_table`)).rows[0];
 assert.deepEqual(actual,{actor:'authenticated',uid,jwt_role:'authenticated',bypass:false,owns_table:false},'real authenticated actor and exact synthetic JWT subject');
}
async function attempt(db,phase,role,key,operation,scopedPlayer=false){
 await db.exec('BEGIN');let result,error,before,after,visible;
 try{
  if(scopedPlayer){const p=JSON.parse(await row(db,'cs_perms_v1'));p.members[ids.player].scopes=['scout'];await db.query('UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k=$3',[JSON.stringify(p),WID,'cs_perms_v1']);}
  if(operation!=='insert')await db.query('INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,$2,$3)',[WID,key,'{"synthetic":"before"}']);
  before=await row(db,key);
  await db.exec('SAVEPOINT action');await actor(db,role);
  visible=(await db.query('SELECT k FROM public.ps_kv WHERE workspace_id=$1 AND k=$2',[WID,key])).rows.length;
  try{
   if(operation==='insert')result=await db.query('INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,$2,$3)',[WID,key,'{"synthetic":"after"}']);
   else if(operation==='update')result=await db.query('UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k=$3',['{"synthetic":"after"}',WID,key]);
   else if(operation==='upsert')result=await db.query('INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,$2,$3) ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v',[WID,key,'{"synthetic":"after"}']);
   // Intentionally no WHERE/RETURNING: exercises DELETE policy independently of
   // hidden candidate SELECT rows. This is confined to a fresh in-memory DB.
   else result=await db.query('DELETE FROM public.ps_kv');
  }catch(e){error=e;await db.exec('ROLLBACK TO SAVEPOINT action');}
  await db.exec('RESET ROLE');after=await row(db,key);
  if(error)assert.equal(error.code,'42501',phase+' '+role+' '+key+' '+operation+': reject must be RLS/permission, not malformed payload or a content trigger');
  const changed=after!==before;
  if(operation==='delete'&&changed)assert.equal(after,null);
  if(operation!=='delete'&&changed)assert.equal(after,'{"synthetic":"after"}');
  if(operation==='update'&&!changed&&!error)assert.equal(result.affectedRows,0,'hidden row update must report zero');
  const outcome={phase,role,key,operation,changed,error:error?.code||null,visible,affected:result?.affectedRows??null};
  outcomes.push(outcome);return outcome;
 }finally{await db.exec('ROLLBACK');}
}
async function matrix(db,phase,restricted){
 const rows=[];
 for(const role of roles)for(const key of [TKEY,OTHER])for(const operation of ['insert','update','upsert','delete']){
  const result=await attempt(db,phase,role,key,operation);rows.push(result);
  const privileged=['executive','admin','owner'].includes(role);
  const canWrite=privileged||role==='staff';
  const expected=key===OTHER?canWrite:privileged||(!restricted&&role==='staff'&&['insert','delete'].includes(operation));
  equal(result.changed,expected,[phase,role,key,operation,'expected mutation'].join(' '));
  if(key===TKEY&&role==='staff'&&operation!=='insert')equal(result.visible,0,phase+': staff cannot read TKEY despite any blind write capability');
 }
 return rows;
}
async function rejectedScript(db,sql,pattern){
 let error;try{await db.exec(sql);}catch(e){error=e;await db.exec('ROLLBACK');}
 assert.ok(error&&pattern.test(error.message),'expected atomic migration rejection');passed++;
}
async function run(){const db=await fresh();
 try{
  await seed(db);const original=await catalog(db);
  const baseline=await matrix(db,'original',false);
  equal((await attempt(db,'original-scoped-player','player',TKEY,'insert',true)).changed,true,'original explicit scout scope permits player blind INSERT');
  await db.exec(migration);await db.exec(migration);await db.exec(verify);
  equal(await catalog(db),original,'installation/reinstallation retains existing policies, table grants/RLS and helper definitions');
  const secured=await matrix(db,'restricted',true);
  equal((await attempt(db,'restricted-scoped-player','player',TKEY,'insert',true)).changed,false,'restrictive candidate policy overrides player scout scope');
  const fixtureRows=async()=> (await db.query(`SELECT jsonb_build_object('workspaces',(SELECT jsonb_agg(to_jsonb(w) ORDER BY id) FROM public.ps_workspaces w),'members',(SELECT jsonb_agg(to_jsonb(m) ORDER BY workspace_id,user_id) FROM public.ps_members m),'kv',(SELECT jsonb_agg(to_jsonb(k) ORDER BY workspace_id,k) FROM public.ps_kv k)) AS data`)).rows[0].data;
  const beforeSynthetic=await fixtureRows();const sqlResults=await db.exec(syntheticVerify);
  const synthetic=sqlResults.flatMap(r=>r.rows||[]).filter(r=>r.synthetic_result).map(r=>r.synthetic_result);
  equal(synthetic.length,15,'operational verification SQL produces 15 synthetic outcomes locally');
  synthetic.forEach(r=>equal(r.matchesExpected,true,'synthetic SQL case '+r.case+' '+r.role+' '+r.operation));
  equal(await fixtureRows(),beforeSynthetic,'operational verification SQL rolls back every synthetic row');
  equal(await catalog(db),original,'synthetic SQL retains policy/helper/grant baseline');
  const project=rows=>rows.filter(x=>x.key===OTHER).map(({role,operation,changed,error,visible,affected})=>({role,operation,changed,error,visible,affected}));
  equal(project(secured),project(baseline),'unrelated team notice read/write behavior is identical for every role');
  equal((await db.query("SELECT count(*)::int n FROM public.ps_kv WHERE k<>'cs_perms_v1'")).rows[0].n,0,'all role actions roll back their synthetic rows');
  await db.exec("COMMENT ON POLICY ps_scout_insert_scope_v1 ON public.ps_kv IS 'unrelated-owner'");
  await rejectedScript(db,rollback,/ownership marker differs/);
  equal((await db.query('SELECT count(*)::int n FROM pg_policy WHERE polrelid=$1::regclass AND polname=ANY($2::text[])',['public.ps_kv',policyNames])).rows[0].n,3,'rollback collision leaves all policies installed');
  await rejectedScript(db,migration,/owned by another migration/);
  await db.exec("COMMENT ON POLICY ps_scout_insert_scope_v1 ON public.ps_kv IS '"+marker+"'");
  await db.exec(rollback);await db.exec(rollback);
  equal(await catalog(db),original,'rollback retains exact original policies, grants/RLS and helpers');
  equal((await db.query('SELECT count(*)::int n FROM pg_policy WHERE polrelid=$1::regclass AND polname=ANY($2::text[])',['public.ps_kv',policyNames])).rows[0].n,0,'rollback removes only the three scoped policies');
  equal((await attempt(db,'rollback','staff',TKEY,'insert')).changed,true,'rollback restores known staff blind INSERT exposure');
  equal((await attempt(db,'rollback','staff',TKEY,'delete')).changed,true,'rollback restores known staff blind DELETE exposure');
  // A same-name unrelated policy is not replaced, even on first installation.
  await db.exec('CREATE POLICY ps_scout_insert_scope_v1 ON public.ps_kv FOR INSERT TO authenticated WITH CHECK(false)');
  const collision=(await db.query("SELECT pg_get_expr(polwithcheck,polrelid) AS expr FROM pg_policy WHERE polname='ps_scout_insert_scope_v1' AND polrelid='public.ps_kv'::regclass")).rows[0];
  await rejectedScript(db,migration,/owned by another migration/);
  equal((await db.query("SELECT pg_get_expr(polwithcheck,polrelid) AS expr FROM pg_policy WHERE polname='ps_scout_insert_scope_v1' AND polrelid='public.ps_kv'::regclass")).rows[0],collision,'unrelated colliding policy is unchanged');
  console.log(JSON.stringify({ok:true,assertions:passed,operations:outcomes.length,method:'isolated in-memory PostgreSQL; catalog-confirmed non-IDP policy fixture; no network',originalStaffBlindInsert:true,originalStaffBlindDelete:true,restrictedRoles:{allowed:['executive','admin','owner'],blocked:['staff','player','nonmember']},unrelatedKeyBehaviorUnchanged:true,claimsAndRoleAssertedForEveryAction:true,repeatedInstallAndRollback:true,markerCollisionsRejected:true,operationalSyntheticSqlCases:15,operationalSyntheticSqlRollback:true},null,2));
 }finally{await db.close();}}
run().catch(error=>{console.error(error);process.exitCode=1;});
