'use strict';
// Fresh in-memory databases only. Actual history/privacy migrations ->
// read-only catalog -> role/auth-only prelude -> restored DDL. No live endpoint.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8'),catalog=read('00000000_baseline.catalog.sql'),baseline=read('00000000_baseline.sql');
const scout=read('20260913_scout_write_scope.local-fixture.sql'),split=scout.indexOf('CREATE TABLE public.ps_workspaces');
const admin='fixture_restore_admin',reader='ps_blob_reader_v1';
const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0'),A=id(1),B=id(2),C=id(3),D=id(4),W=id(10),P=id(11);
const H=n=>String(n).padStart(24,'a'),photo=n=>'data:image/png;base64,SYNTHETIC-'+n;
let assertions=0;const cases=[];
function eq(a,b,label){assert.deepEqual(a,b,label);assertions++;}
function ok(a,label){assert.ok(a,label);assertions++;}
function fn(name){const start=baseline.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');assert.ok(start>=0,name);return baseline.slice(start,baseline.indexOf('$function$;',start)+12);}
async function denied(work,code,label){let error;try{await work();}catch(e){error=e;}ok(error,label+' rejects');eq(error.code,code,label+' SQLSTATE');}
async function prelude(db){
 await db.exec(scout.slice(0,split)+`
 CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
 CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
 CREATE ROLE ${admin} NOLOGIN NOSUPERUSER BYPASSRLS CREATEROLE INHERIT;
 CREATE ROLE fixture_unmanaged NOLOGIN;
 ALTER SCHEMA public OWNER TO ${admin};
 GRANT USAGE ON SCHEMA auth TO ${admin} WITH GRANT OPTION;
 GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
 GRANT authenticated TO ${admin} WITH ADMIN OPTION;
 GRANT anon TO ${admin} WITH INHERIT FALSE,SET TRUE;
 SET SESSION AUTHORIZATION ${admin};`);
 eq((await db.query('SELECT current_user AS role,session_user AS session,rolsuper,rolbypassrls,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0],{role:admin,session:admin,rolsuper:false,rolbypassrls:true,rolcreaterole:true},'real non-superuser Supabase-like session and applying role');
}
async function source(db){
 await prelude(db);await db.exec(scout.slice(split));
 await db.exec(read('20260915_private_board.local-fixture.sql'));await db.exec(read('20260915_private_board.sql'));
 for(const name of ['ps_key_scope','ps_can_write_key','ps_can_read_key','ps_idp_can_view','ps_team_role'])await db.exec(fn(name));
 await db.exec(`CREATE TABLE public.ps_blob(workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,h text NOT NULL CHECK(h ~ '^[0-9a-f]{16,64}$'),v text NOT NULL,created_by uuid DEFAULT auth.uid(),created_at timestamptz DEFAULT now(),PRIMARY KEY(workspace_id,h));
 CREATE TABLE public.ps_library(workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,lib_id text NOT NULL,type text DEFAULT 'train',name text NOT NULL DEFAULT '',folder text NOT NULL DEFAULT '',tags jsonb DEFAULT '[]',pin boolean DEFAULT false,item jsonb,saved_at bigint DEFAULT 0,deleted_at bigint,updated_at timestamptz DEFAULT now(),owner_id uuid,private boolean DEFAULT false,PRIMARY KEY(workspace_id,lib_id));
 ALTER TABLE public.ps_blob ENABLE ROW LEVEL SECURITY;ALTER TABLE public.ps_library ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_blob,public.ps_library TO anon,authenticated,service_role;`);
 for(const name of ['ps_blob_ins','ps_blob_sel','lib_del','lib_ins','lib_sel','lib_upd']){
  const line=baseline.split('\n').find(l=>l.startsWith('create policy '+name+' '));ok(line,name+' exact baseline policy');await db.exec(line);
 }
 await db.exec(read('20261025_library_recovery.sql'));await db.exec(read('20261025_private_blob_boundary.sql'));
}
async function actor(db,uid,work,role='authenticated'){
 await db.exec('BEGIN');try{
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid||'']);await db.exec('SET LOCAL ROLE '+role);
  eq((await db.query('SELECT current_user AS role,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0],{role,rolbypassrls:false},'actual RLS client role');
  const result=await work();await db.exec('COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
async function ddlOf(db){
 await db.exec('BEGIN READ ONLY');try{const rows=(await db.query(catalog)).rows;eq(rows.length,1,'one read-only DDL cell');await db.exec('COMMIT');return rows[0].ddl;}catch(e){await db.exec('ROLLBACK');throw e;}
}
const card=(lib_id,owner_id,h,privateFlag=true)=>({workspace_id:W,lib_id,owner_id,private:privateFlag,item:{name:'Synthetic '+lib_id,photo:'psblob:'+h}});
async function seed(db){
 for(const [wid,kind] of [[W,'team'],[P,'personal']]){
  await db.query('INSERT INTO public.ps_workspaces(id,name,kind,owner_id) VALUES($1,$2,$3,$4)',[wid,'Synthetic '+wid,kind,A]);
  for(const uid of [A,B,C])await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[wid,uid,uid===A?'owner':'member']);
 }
 await db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'cs_perms_v1',$2)",[W,JSON.stringify({defaultRole:'player',staffEdit:'edit',members:{[B]:{role:'staff'},[C]:{role:'player'}}})]);
 for(let n=1;n<=6;n++)await db.query('INSERT INTO public.ps_blob(workspace_id,h,v,created_by) VALUES($1,$2,$3,$4)',[n===6?P:W,H(n),photo(n),A]);
 for(const row of [card('private-a',A,H(1)),card('shared',A,H(2),false),card('own-b',B,H(2))])await db.query('INSERT INTO public.ps_library(workspace_id,lib_id,owner_id,private,item,name) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[row.workspace_id,row.lib_id,row.owner_id,row.private,JSON.stringify(row.item),row.lib_id]);
 for(const [wid,k,v] of [[W,'scout_tool_v1',{emblemRef:H(3),players:[]}],[W,'process_coach_v1',{thumbRef:H(4),sessions:[]}],[P,'cs_private_board_v1',{snap:{photo:'psblob:'+H(6)},view:'board'}]])await db.query('INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,$2,$3)',[wid,k,JSON.stringify(v)]);
 await db.query("INSERT INTO public.ps_library_history(workspace_id,lib_id,owner_id,snapshot,kind) VALUES($1,'private-a',$2,$3::jsonb,'update')",[W,A,JSON.stringify(card('private-a',A,H(5)))]);
}
async function outcomes(db){
 const out={};for(const uid of [A,B,C,D])out[uid]=await actor(db,uid,async()=>({
  bodies:(await db.query('SELECT lib_id,item FROM public.ps_library ORDER BY lib_id')).rows,
  documents:(await db.query('SELECT workspace_id,k,v FROM public.ps_kv ORDER BY workspace_id,k')).rows,
  photos:(await db.query('SELECT workspace_id,h,v FROM public.ps_blob ORDER BY workspace_id,h')).rows,
  history:(await db.query('SELECT lib_id,snapshot FROM public.ps_library_history ORDER BY lib_id')).rows,
  privatePermission:(await db.query('SELECT public.ps_blob_can_read_v1($1,$2) AS allowed',[W,H(1)])).rows[0].allowed
 }));out.anon={photos:await actor(db,null,()=>db.query('SELECT workspace_id,h,v FROM public.ps_blob ORDER BY workspace_id,h').then(r=>r.rows),'anon')};return out;
}
async function roleState(db){return (await db.query(`SELECT r.rolcanlogin,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolinherit,
 pg_has_role(r.oid,'authenticated','USAGE') AS authenticated,
 has_schema_privilege(r.oid,'public','USAGE') AS public_usage,has_schema_privilege(r.oid,'auth','USAGE') AS auth_usage,
 has_schema_privilege(r.oid,'public','CREATE') AS public_create,has_schema_privilege(r.oid,'auth','CREATE') AS auth_create,
 pg_has_role('${admin}',r.oid,'SET') AS applying_role_set,
 pg_has_role('${admin}',r.oid,'USAGE') AS applying_role_inherit,
 (SELECT owner.rolname FROM pg_proc p JOIN pg_roles owner ON owner.oid=p.proowner WHERE p.oid='public.ps_blob_can_read_v1(uuid,text)'::regprocedure) AS function_owner
 FROM pg_roles r WHERE r.rolname='${reader}'`)).rows[0];}
const expectedRole={rolcanlogin:false,rolsuper:false,rolbypassrls:false,rolcreatedb:false,rolcreaterole:false,rolreplication:false,rolinherit:true,authenticated:true,public_usage:true,auth_usage:true,public_create:false,auth_create:false,applying_role_set:false,applying_role_inherit:false,function_owner:reader};
const adminMembership=db=>db.query(`SELECT a.rolname AS grantor,m.admin_option,m.inherit_option,m.set_option FROM pg_auth_members m JOIN pg_roles a ON a.oid=m.grantor WHERE m.roleid='${reader}'::regrole AND m.member='${admin}'::regrole ORDER BY a.rolname`).then(r=>r.rows);
async function run(){const src=new PGlite(),dst=new PGlite(),bad=new PGlite();try{
 await source(src);eq(await roleState(src),expectedRole,'non-superuser migration returns temporary SET/INHERIT/CREATE and preserves safe owner');
 const automaticMembership=[{grantor:'postgres',admin_option:true,inherit_option:false,set_option:false}];eq(await adminMembership(src),automaticMembership,'migration leaves only automatic management membership, without extra self-grant');
 const ddl=await ddlOf(src);
 ok(ddl.includes('CREATE ROLE ps_blob_reader_v1 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT NOBYPASSRLS'),'managed role is explicit');
 ok(ddl.includes('ALTER FUNCTION public.ps_blob_can_read_v1(wid uuid, digest text) OWNER TO ps_blob_reader_v1'),'function owner emitted from identity arguments');
 ok(!ddl.includes('CREATE ROLE fixture_unmanaged'),'arbitrary roles are not exported');
 ok(!ddl.includes('Unsafe source ps_blob_reader_v1'),'source is safe');
 await prelude(dst);await dst.exec(ddl);eq(await roleState(dst),expectedRole,'restored reader exactly preserves safe attributes, membership, usage and owner');
 eq(await adminMembership(dst),automaticMembership,'restore does not add empty or inheriting membership rows');
 eq(await ddlOf(dst),ddl,'privacy/history catalog round trip is byte identical');
 cases.push('non-superuser-history-and-privacy-migrations','read-only-catalog','managed-role-only','atomic-temporary-set-create','owner-before-acl','byte-identical-round-trip');
 for(const db of [src,dst])await seed(db);
 const before=await outcomes(src),after=await outcomes(dst);eq(after,before,'original body/photo/history RLS decisions and exact bytes survive restore');
 for(const user of [B,C,D]){eq(after[user].privatePermission,false,'non-owner cannot use definer to bypass source RLS');ok(!after[user].photos.some(p=>p.h===H(1)||p.h===H(5)||p.h===H(6)),'private/current/history/board photos hidden');}
 ok(after[A].photos.some(p=>p.h===H(1))&&after[A].photos.some(p=>p.h===H(5)),'owner retains exact current and historical photos');
 ok(!after[C].documents.some(p=>p.k==='scout_tool_v1')&&!after[C].photos.some(p=>p.h===H(3)),'student cannot read scout body or photo');
 ok(after[C].photos.some(p=>p.h===H(4)),'student keeps readable schedule photo');
 eq(after.anon.photos,[],'anonymous no photos');
 for(const db of [src,dst])await denied(()=>actor(db,B,()=>db.query('SELECT public.ps_library_archive_conflict_v1($1,$2,$3::jsonb)',[W,'own-b',JSON.stringify(card('own-b',B,H(1)))])),'42501','definer archive cannot launder another owner photo');
 cases.push('exact-body-photo-history-rls','student-and-anonymous-deny','definer-laundering-deny-after-restore');
 await prelude(bad);await bad.exec('SET SESSION AUTHORIZATION postgres;RESET ROLE');
 const hazards=[
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN BYPASSRLS',
  'CREATE ROLE ps_blob_reader_v1 LOGIN NOBYPASSRLS',
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN SUPERUSER',
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN CREATEDB',
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN CREATEROLE',
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN REPLICATION',
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN NOINHERIT',
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN;GRANT service_role TO ps_blob_reader_v1',
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN;GRANT ps_blob_reader_v1 TO authenticated',
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN;GRANT CREATE ON SCHEMA public TO ps_blob_reader_v1',
  'CREATE ROLE ps_blob_reader_v1 NOLOGIN;CREATE TABLE public.reader_owned(secret text);ALTER TABLE public.reader_owned OWNER TO ps_blob_reader_v1'
 ];
 for(const hazard of hazards){await bad.exec('BEGIN');try{await bad.exec(hazard+';SET ROLE '+admin);await denied(()=>bad.exec(ddl),'55000','unsafe destination reader fails closed');}finally{await bad.exec('ROLLBACK');}}
 for(const hazard of ['ALTER ROLE ps_blob_reader_v1 BYPASSRLS','ALTER ROLE ps_blob_reader_v1 REPLICATION','GRANT service_role TO ps_blob_reader_v1','SET ROLE '+admin+';REVOKE INHERIT OPTION FOR authenticated FROM ps_blob_reader_v1;RESET ROLE','GRANT CREATE ON SCHEMA public TO ps_blob_reader_v1','GRANT CREATE ON DATABASE postgres TO ps_blob_reader_v1','ALTER TABLE public.ps_blob_refs_v1 OWNER TO ps_blob_reader_v1','ALTER FUNCTION public.ps_blob_can_read_v1(uuid,text) OWNER TO '+admin]){
  await src.exec('SET SESSION AUTHORIZATION postgres;RESET ROLE;BEGIN');try{await src.exec(hazard);const unsafe=(await src.query(catalog)).rows[0].ddl;ok(unsafe.includes('Unsafe source ps_blob_reader_v1'),'unsafe source emits a restore refusal: '+hazard);await bad.exec('BEGIN;SET ROLE '+admin);try{await denied(()=>bad.exec(unsafe),'55000','unsafe source DDL refuses restore');}finally{await bad.exec('ROLLBACK');}}finally{await src.exec('ROLLBACK;SET SESSION AUTHORIZATION '+admin);}
 }
 cases.push('unsafe-source-and-destination-fail-closed');
 // A failed owner transfer must roll back both temporary privileges. Then a
 // pre-existing administrator SET grant must survive a successful restore.
 await bad.exec('SET SESSION AUTHORIZATION '+admin+';CREATE ROLE ps_blob_reader_v1 NOLOGIN NOSUPERUSER NOBYPASSRLS;GRANT authenticated TO ps_blob_reader_v1;GRANT USAGE ON SCHEMA public,auth TO ps_blob_reader_v1;');
 const ownerBlock=ddl.match(/DO \$ps_blob_owner_restore\$[\s\S]*?\$ps_blob_owner_restore\$;/)[0];
 await denied(()=>bad.exec(ownerBlock),'42883','missing function aborts the atomic owner block');
 eq((await bad.query("SELECT has_schema_privilege('ps_blob_reader_v1','public','CREATE') AS create,pg_has_role(current_user,'ps_blob_reader_v1','SET') AS set,pg_has_role(current_user,'ps_blob_reader_v1','USAGE') AS inherit")).rows[0],{create:false,set:false,inherit:false},'failed owner block leaves no temporary CREATE/SET/INHERIT');
 eq(await adminMembership(bad),automaticMembership,'failed owner block restores all original membership rows');
 await bad.exec('GRANT ps_blob_reader_v1 TO '+admin+' WITH INHERIT FALSE,SET TRUE');const existingMembership=await adminMembership(bad);await bad.exec(ddl);
 eq(await roleState(bad),{...expectedRole,applying_role_set:true},'existing administrator SET permission is preserved');
 eq(await adminMembership(bad),existingMembership,'existing membership rows/options are preserved exactly');
 await bad.exec('GRANT ps_blob_reader_v1 TO '+admin+' WITH ADMIN FALSE,INHERIT FALSE,SET FALSE');const priorSelfGrant=await adminMembership(bad);
 // Re-create only the just-defined function's original owner, as a fresh DDL
 // restore does, then exercise the pre-existing self-grant restoration branch.
 await bad.exec('SET SESSION AUTHORIZATION postgres;RESET ROLE;ALTER FUNCTION public.ps_blob_can_read_v1(uuid,text) OWNER TO '+admin+';SET SESSION AUTHORIZATION '+admin);
 await bad.exec(ownerBlock);eq(await adminMembership(bad),priorSelfGrant,'pre-existing self-grant ADMIN/INHERIT/SET options survive temporary SET');
 eq(await roleState(bad),expectedRole,'pre-existing non-inheriting self-grant never gains effective privileges');
 cases.push('owner-block-failure-rolls-back-privileges','existing-admin-set-preserved','existing-self-grant-options-preserved');
 console.log(JSON.stringify({passed:true,assertions,ddlBytes:Buffer.byteLength(ddl),cases,scope:'fresh synthetic PGlite; actual migrations; non-superuser BYPASSRLS/CREATEROLE admin; no live DB'}));
 }finally{await Promise.all([src.close(),dst.close(),bad.close()]);}}
run().catch(e=>{console.error({message:e.message,code:e.code,where:e.where,stack:String(e.stack).split('\n').slice(0,4).join('\n')});process.exitCode=1;});
