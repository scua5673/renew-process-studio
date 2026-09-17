'use strict';
// All records and JWT subjects below are synthetic. PGlite is local only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'/private/tmp/process-owner-sql-runtime/node_modules/@electric-sql/pglite');
const read=s=>fs.readFileSync(path.join(__dirname,'20260917_admin_content_owners.'+s),'utf8');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ADMIN=id(1),AUTHOR=id(2),OWNER=id(3),NAMELESS=id(4),DELETED=id(5),MALFORMED=id(6),W=id(100),X=id(101),ORPHAN=id(102);
let checks=0;
function equal(a,b,label){assert.deepEqual(a,b,label);checks++;}
async function denied(fn,code,label){let e;try{await fn();}catch(error){e=error;}assert.ok(e,label);equal(e.code,code,label);}
async function as(db,uid,fn,role='authenticated'){
  await db.exec('BEGIN');
  try{
    await db.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(uid?{sub:uid,role}:{role})]);
    await db.exec('SET LOCAL ROLE '+role);
    const result=await fn();await db.exec('COMMIT');return result;
  }catch(e){await db.exec('ROLLBACK');throw e;}
}
async function setup(){const db=new PGlite();await db.exec(`
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,email varchar,raw_user_meta_data jsonb);
  CREATE TABLE public.ps_admins(user_id uuid PRIMARY KEY);
  CREATE FUNCTION public.ps_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT FROM public.ps_admins WHERE user_id=auth.uid()) $$;
  CREATE TABLE public.ps_workspaces(id uuid PRIMARY KEY,owner_id uuid,name text);
  CREATE TABLE public.ps_library(workspace_id uuid,lib_id text,owner_id uuid,deleted_at bigint,item jsonb,PRIMARY KEY(workspace_id,lib_id));
  CREATE TABLE public.ps_members(workspace_id uuid,user_id uuid,name text,email text);
  CREATE FUNCTION public.ps_admin_library(p_wid uuid DEFAULT NULL,p_include_deleted boolean DEFAULT false) RETURNS jsonb LANGUAGE sql AS $$ SELECT '[]'::jsonb $$;
  ALTER TABLE public.ps_library ENABLE ROW LEVEL SECURITY;
  CREATE POLICY existing_policy ON public.ps_library USING(false);
  REVOKE ALL ON public.ps_library,public.ps_members,public.ps_workspaces,public.ps_admins FROM PUBLIC,anon,authenticated;
  REVOKE ALL ON auth.users FROM PUBLIC,anon,authenticated;
`);
for(const [uid,email,meta] of [[ADMIN,'admin@example.invalid',{}],[AUTHOR,null,{name:'  Auth Author  '}],[OWNER,'workspace-owner@example.invalid',{name:'Workspace Owner'}],[NAMELESS,'  author@example.invalid ',{}],[MALFORMED,null,{name:{untrusted:'object'},full_name:[],nickname:'  Nick Author  '}]] )
  await db.query('INSERT INTO auth.users VALUES($1,$2,$3)',[uid,email,JSON.stringify(meta)]);
await db.query('INSERT INTO public.ps_admins VALUES($1)',[ADMIN]);
await db.query('INSERT INTO public.ps_workspaces VALUES($1,$2,$3),($4,$2,$5)',[W,OWNER,'Synthetic W',X,'Synthetic X']);
await db.query('INSERT INTO public.ps_members VALUES($1,$2,$3,$4),($5,$2,$6,null)',[W,AUTHOR,'  Team Author  ','stale-member@example.invalid',X,'Other Team Name']);
for(const [wid,lid,owner,deleted] of [[W,'same',AUTHOR,null],[X,'same',NAMELESS,null],[W,'no-owner',null,null],[W,'missing-account',DELETED,null],[W,'malformed-name',MALFORMED,null],[W,'trash',AUTHOR,10],[W,'zero-tombstone',AUTHOR,0],[ORPHAN,'orphan-workspace',AUTHOR,null]])
  await db.query('INSERT INTO public.ps_library VALUES($1,$2,$3,$4,$5)',[wid,lid,owner,deleted,JSON.stringify({secret:'synthetic body must never be returned'})]);
return db;}
async function baseline(db){return (await db.query(`SELECT
  (SELECT jsonb_agg(to_jsonb(l) ORDER BY workspace_id,lib_id) FROM public.ps_library l) content,
  (SELECT jsonb_agg(jsonb_build_object('oid',oid,'acl',relacl::text,'rls',relrowsecurity,'owner',relowner) ORDER BY oid) FROM pg_class WHERE oid IN('public.ps_library'::regclass,'public.ps_members'::regclass,'public.ps_workspaces'::regclass,'auth.users'::regclass)) tables,
  (SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid='public.ps_library'::regclass) policies,
  (SELECT jsonb_agg(jsonb_build_object('def',pg_get_functiondef(oid),'acl',proacl::text) ORDER BY oid) FROM pg_proc WHERE oid IN('public.ps_admin_library(uuid,boolean)'::regprocedure,'public.ps_is_admin()'::regprocedure,'auth.uid()'::regprocedure)) helpers
`)).rows[0];}
async function run(){const db=await setup();try{
  const original=await baseline(db);
  await db.exec(read('sql'));
  await db.exec(read('sql'));
  equal(await baseline(db),original,'repeat installation changes no existing content, grants, RLS, or helper');
  await db.exec(read('verify.sql'));
  const list=(uid=ADMIN,wid=null,deleted=false)=>as(db,uid,async()=>(await db.query('SELECT public.ps_admin_content_owners($1,$2) rows',[wid,deleted])).rows[0].rows);
  await denied(()=>as(db,null,()=>db.query('SELECT public.ps_admin_content_owners()'),'anon'),'42501','anonymous RPC rejected');
  await denied(()=>list(null),'42501','missing subject rejected');
  await denied(()=>list(OWNER),'42501','workspace owner is not service admin');
  await denied(()=>list(AUTHOR),'42501','content author is not service admin');
  await denied(()=>as(db,ADMIN,()=>db.query('SELECT * FROM public.ps_library')),'42501','RPC does not grant direct table access');
  const rows=await list();
  equal(rows.length,5,'live rows mirror existing library scope, excluding orphan workspace and tombstones');
  const row=rows.find(r=>r.workspace_id===W&&r.lib_id==='same');
  equal(row,{workspace_id:W,lib_id:'same',owner_id:AUTHOR,owner_name:'Team Author',owner_email:null},'actual author metadata with trimmed own-workspace name');
  equal(rows.find(r=>r.workspace_id===X&&r.lib_id==='same').owner_email,'author@example.invalid','composite key isolates same lib ID and trims email');
  equal(rows.find(r=>r.lib_id==='no-owner'),{workspace_id:W,lib_id:'no-owner',owner_id:null,owner_name:null,owner_email:null},'null author never inherits workspace owner');
  equal(rows.find(r=>r.lib_id==='missing-account').owner_id,DELETED,'missing account preserves historical author ID');
  equal(rows.find(r=>r.lib_id==='missing-account').owner_name,null,'missing account is not fabricated');
  equal(rows.find(r=>r.lib_id==='malformed-name').owner_name,'Nick Author','nonstring metadata skipped for textual fallback');
  equal(rows.every(r=>Object.keys(r).sort().join(',')==='lib_id,owner_email,owner_id,owner_name,workspace_id'),true,'only exact metadata contract returned');
  equal(JSON.stringify(rows).includes('synthetic body'),false,'body is never returned');
  equal(JSON.stringify(rows).includes('workspace-owner@example.invalid'),false,'workspace owner email never returned');
  equal(JSON.stringify(rows).includes('stale-member@example.invalid'),false,'stale member email not used');
  equal((await list(ADMIN,W)).length,4,'workspace filter');
  equal(await list(ADMIN,id(999)),[],'unknown workspace is empty');
  equal((await list(ADMIN,W,true)).length,6,'include deleted explicitly includes both timestamp and zero tombstone');
  equal(await list(ADMIN,W,null),await list(ADMIN,W,false),'null deletion option fails closed');
  await db.query('DELETE FROM public.ps_members WHERE workspace_id=$1 AND user_id=$2',[W,AUTHOR]);
  equal((await list(ADMIN,W)).find(r=>r.lib_id==='same').owner_name,'Auth Author','auth metadata fallback never uses other workspace membership');
  await db.query('UPDATE auth.users SET raw_user_meta_data=$1 WHERE id=$2',[JSON.stringify({name:' ',full_name:' Full Author '}),AUTHOR]);
  equal((await list(ADMIN,W)).find(r=>r.lib_id==='same').owner_name,'Full Author','blank metadata falls through');
  await db.query('UPDATE auth.users SET raw_user_meta_data=$1 WHERE id=$2',[JSON.stringify({display_name:' Display Author '}),AUTHOR]);
  equal((await list(ADMIN,W)).find(r=>r.lib_id==='same').owner_name,'Display Author','display name fallback');
  await db.query('DELETE FROM public.ps_admins WHERE user_id=$1',[ADMIN]);
  await denied(()=>list(),'42501','admin removal takes effect immediately');
  await db.exec("COMMENT ON FUNCTION public.ps_admin_content_owners(uuid,boolean) IS 'foreign-owner'");
  await denied(()=>db.exec(read('sql')),'P0001','foreign migration collision rejected');
  await db.exec('ROLLBACK');
  console.log('admin content owners: '+checks+' local SQL checks passed');
}finally{await db.close();}}
run().catch(e=>{console.error(e);process.exitCode=1;});
