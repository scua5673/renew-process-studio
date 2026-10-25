'use strict';
// Actual SQL, in-memory PostgreSQL, synthetic JWT roles only. No network or real accounts.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8'),baseline=read('00000000_baseline.sql');
const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),W=id(10),P=id(11),Q=id(12),H='a'.repeat(24),MISSING='b'.repeat(24);
let assertions=0;const cases=[];
function eq(a,b,label){assert.deepEqual(a,b,label);assertions++;}
async function denied(work,code,label){let error;try{await work();}catch(e){error=e;}assert.ok(error,label);assertions++;eq(error.code,code,label+' SQLSTATE');}
function fn(name){const i=baseline.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');assert.ok(i>=0,name);return baseline.slice(i,baseline.indexOf('$function$;',i)+12);}
async function actor(db,uid,work,role='authenticated'){await db.exec('BEGIN');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid||'']);await db.exec('SET LOCAL ROLE '+role);eq((await db.query('SELECT current_user AS role,auth.uid()::text AS uid')).rows[0],{role,uid:uid||null},'actual SQL role and JWT');const result=await work();await db.exec('COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function fixture(db){
 await db.exec(read('20260913_scout_write_scope.local-fixture.sql'));
 await db.exec("CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;GRANT USAGE ON SCHEMA public,auth TO anon,service_role;");
 await db.exec(read('20260915_private_board.local-fixture.sql'));await db.exec(read('20260915_private_board.sql'));
 for(const name of ['ps_key_scope','ps_can_write_key','ps_can_read_key','ps_idp_can_view','ps_team_role'])await db.exec(fn(name));
 await db.exec(`CREATE TABLE public.ps_blob(workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,h text NOT NULL,v text NOT NULL,created_by uuid DEFAULT auth.uid(),created_at timestamptz DEFAULT now(),PRIMARY KEY(workspace_id,h));
 CREATE TABLE public.ps_library(workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,lib_id text NOT NULL,type text DEFAULT 'board',name text NOT NULL DEFAULT '',folder text NOT NULL DEFAULT '',tags jsonb DEFAULT '[]',pin boolean DEFAULT false,item jsonb,saved_at bigint DEFAULT 0,deleted_at bigint,updated_at timestamptz DEFAULT now(),owner_id uuid,private boolean DEFAULT false,PRIMARY KEY(workspace_id,lib_id));
 ALTER TABLE public.ps_blob ENABLE ROW LEVEL SECURITY;ALTER TABLE public.ps_library ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_blob,public.ps_library TO authenticated;`);
 for(const name of ['ps_blob_ins','ps_blob_sel','lib_del','lib_ins','lib_sel','lib_upd'])await db.exec(baseline.split('\n').find(l=>l.startsWith('create policy '+name+' ')));
 for(const [wid,owner,kind] of [[W,A,'team'],[P,A,'personal'],[Q,B,'personal']]){await db.query('INSERT INTO public.ps_workspaces(id,name,kind,owner_id) VALUES($1,$2,$3,$4)',[wid,'Synthetic',kind,owner]);for(const uid of [A,B])await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[wid,uid,uid===owner?'owner':'member']);}
 await db.query('INSERT INTO public.ps_blob(workspace_id,h,v) VALUES($1,$2,$3)',[W,H,'data:image/png;base64,'+'A'.repeat(720)]);
 await db.query('INSERT INTO public.ps_library(workspace_id,lib_id,name,item,owner_id,private,saved_at) VALUES($1,$2,$3,$4,$5,true,1)',[W,'L','Original',JSON.stringify({libId:'L',name:'Original',photo:'psblob:'+H,snap:{players:[{id:'p1'}]},pages:[{name:'p2'}]}),A]);
}
async function run(){const db=new PGlite();try{
 await fixture(db);
 const initial=(await db.query("SELECT to_jsonb(l) AS row FROM public.ps_library l WHERE lib_id='L'")).rows[0].row;
 await db.query("UPDATE public.ps_library SET item=jsonb_set(item,'{name}','\"Legacy overwrite\"'),name='Legacy overwrite' WHERE lib_id='L'");
 console.log(JSON.stringify({stage:'before',oldBodyStillCurrent:(await db.query("SELECT item->>'name' AS name FROM public.ps_library WHERE lib_id='L'")).rows[0].name==='Original',rowHistoryInstalled:(await db.query("SELECT to_regclass('public.ps_library_history') AS t")).rows[0].t!==null}));
 await db.exec(read('20261025_library_recovery.preflight.sql'));await db.exec(read('20261025_library_recovery.sql'));await db.exec(read('20261025_library_recovery.verify.sql'));
 await db.exec(read('20261025_private_blob_boundary.sql'));await db.exec(read('20261025_private_blob_boundary.verify.sql'));
 await denied(()=>db.exec(read('20261025_library_recovery.sql')),'55000','second install refuses catalog collision');await db.exec('ROLLBACK');
 async function check(label,work){await work();cases.push(label);}
 await check('every changed version and delete preserves its full previous row',async()=>{
  await actor(db,A,()=>db.query("UPDATE public.ps_library SET item=$1::jsonb,name='Version A',saved_at=2 WHERE lib_id='L'",[JSON.stringify(initial.item)]));
  const before=(await db.query("SELECT to_jsonb(l) AS row FROM public.ps_library l WHERE lib_id='L'")).rows[0].row;
  await actor(db,A,()=>db.query("UPDATE public.ps_library SET item=jsonb_set(item,'{name}','\"Version B\"'),name='Version B',saved_at=3 WHERE lib_id='L'"));
  const first=(await actor(db,A,()=>db.query('SELECT snapshot FROM public.ps_library_history WHERE snapshot=$1::jsonb',[JSON.stringify(before)]))).rows;
  eq(first.map(r=>r.snapshot),[before],'old original, pages, photo ref and metadata exact');
  await actor(db,A,()=>db.query("UPDATE public.ps_library SET item=jsonb_set(item,'{name}','\"Version C\"'),name='Version C',saved_at=4 WHERE lib_id='L'"));
  eq((await db.query("SELECT count(*)::int n FROM public.ps_library_history WHERE lib_id='L'")).rows[0].n,3,'no ten-minute sampling loses fast edits');
  await actor(db,A,()=>db.query("UPDATE public.ps_library SET updated_at=clock_timestamp() WHERE lib_id='L'"));
  eq((await db.query("SELECT count(*)::int n FROM public.ps_library_history WHERE lib_id='L'")).rows[0].n,3,'touch-only write does not duplicate originals');
 });
 let conflictId;
 await check('losing concurrent original is idempotently archived before any replacement',async()=>{
  const snap={...initial,item:{...initial.item,name:'Losing local edit',photo:'psblob:'+H},saved_at:2};
  const save=()=>actor(db,A,()=>db.query('SELECT public.ps_library_archive_conflict_v1($1,$2,$3::jsonb) AS out',[W,'L',JSON.stringify(snap)]).then(r=>r.rows[0].out));
  const first=await save(),again=await save();eq(first,again,'lost response retry uses the same archive');conflictId=first.id;
  eq((await db.query("SELECT count(*)::int n FROM public.ps_library_history WHERE kind='conflict'")).rows[0].n,1,'one durable conflict original');
  eq((await db.query("SELECT item->>'name' AS name FROM public.ps_library WHERE lib_id='L'")).rows[0].name,'Version C','archive never changes canonical winner');
  eq((await actor(db,A,()=>db.query('SELECT snapshot FROM public.ps_library_history WHERE id=$1',[conflictId]))).rows[0].snapshot.item,snap.item,'losing original and photo preserved');
 });
 await check('shared current item never shares private history, photos, or restore authority',async()=>{
  await actor(db,A,()=>db.query("UPDATE public.ps_library SET private=false WHERE lib_id='L'"));
  eq((await actor(db,B,()=>db.query('SELECT * FROM public.ps_library_history_list_v1($1,30)',[W]))).rows,[],'same-team staff cannot enumerate owner history');
  eq((await actor(db,B,()=>db.query('SELECT * FROM public.ps_library_history_get_v1($1,$2)',[W,conflictId]))).rows,[],'known ID is still private');
  await denied(()=>actor(db,B,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3)',[W,conflictId,id(21)])),'42501','teammate restore denied');
  await denied(()=>actor(db,A,()=>db.query('INSERT INTO public.ps_library_history(workspace_id,lib_id,owner_id,snapshot,kind) VALUES($1,$2,$3,$4,$5)',[W,'forged',A,'{}','conflict'])),'42501','direct history write denied');
  await denied(()=>actor(db,null,()=>db.query('SELECT * FROM public.ps_library_history_list_v1($1,30)',[W]),'anon'),'42501','anonymous history denied');
 });
 await check('restore makes one fresh private copy with every photo and leaves current original exact',async()=>{
  const before=(await db.query("SELECT to_jsonb(l) AS row FROM public.ps_library l WHERE lib_id='L'")).rows[0].row;
  const restore=()=>actor(db,A,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3) AS out',[W,conflictId,id(20)]).then(r=>r.rows[0].out));
  const first=await restore(),again=await restore();eq(first.lib_id,again.lib_id,'retry does not create a second copy');
  const restored=(await actor(db,A,()=>db.query('SELECT * FROM public.ps_library WHERE lib_id=$1',[first.lib_id]))).rows[0];
  eq(restored.private,true,'restore cannot republish');eq(restored.folder,'','restore cannot inherit a shared folder');eq(restored.owner_id,A,'restore belongs to history owner');eq(restored.item.photo,'psblob:'+H,'original photo ref exact');eq(restored.item.pages,initial.item.pages,'all original pages retained');eq(restored.item.snap,initial.item.snap,'all original board content retained');
  eq((await db.query("SELECT to_jsonb(l) AS row FROM public.ps_library l WHERE lib_id='L'")).rows[0].row,before,'current winner untouched');
  eq((await actor(db,A,()=>db.query('SELECT v FROM public.ps_blob WHERE workspace_id=$1 AND h=$2',[W,H]))).rows.length,1,'restored owner can read original photo');
  await denied(()=>actor(db,A,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3)',[P,conflictId,id(20)])),'42501','cross-workspace history rejected');
 });
 await check('lost response retry never recreates a deleted or republished copy',async()=>{
  for(const [n,change] of [[24,"DELETE FROM public.ps_library WHERE lib_id=$1"],[25,"UPDATE public.ps_library SET deleted_at=99 WHERE lib_id=$1"],[26,"UPDATE public.ps_library SET private=false WHERE lib_id=$1"],[27,"UPDATE public.ps_library SET owner_id='"+B+"' WHERE lib_id=$1"]]){
   const restore=()=>actor(db,A,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3) AS out',[W,conflictId,id(n)]).then(r=>r.rows[0].out));
   const first=await restore();await db.query(change,[first.lib_id]);
   const before=(await db.query('SELECT to_jsonb(l) AS row FROM public.ps_library l WHERE lib_id=$1',[first.lib_id])).rows;
   await denied(restore,'55000','retry must verify current private owner copy');
   eq((await db.query('SELECT to_jsonb(l) AS row FROM public.ps_library l WHERE lib_id=$1',[first.lib_id])).rows,before,'retry cannot recreate or overwrite edited destination');
  }
 });
 await check('missing photo cannot produce a successful partial restore',async()=>{
  await db.query("INSERT INTO public.ps_library_history(workspace_id,lib_id,owner_id,snapshot,kind) VALUES($1,'missing',$2,$3,'update')",[W,A,JSON.stringify({...initial,item:{photo:'psblob:'+MISSING}})]);
  const hid=(await db.query("SELECT id FROM public.ps_library_history WHERE lib_id='missing'")).rows[0].id;
  await denied(()=>actor(db,A,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3)',[W,hid,id(22)])),'55000','missing media restore rejected');
  eq((await db.query('SELECT count(*)::int n FROM public.ps_library_restore_requests WHERE request_id=$1',[id(22)])).rows[0].n,0,'failed restore leaves no success receipt');
 });
 await check('autosave timestamp-only updates add no history while content and access changes retain full OLD rows',async()=>{
  await db.query("INSERT INTO public.ps_library(workspace_id,lib_id,owner_id,private,name,saved_at,item) VALUES($1,'meaningful',$2,true,'Original',1,$3)",[W,A,JSON.stringify({name:'Original',savedAt:1,pages:[{name:'first'}],photo:'psblob:'+H})]);
  const count=async()=>(await db.query("SELECT count(*)::int n FROM public.ps_library_history WHERE lib_id='meaningful'")).rows[0].n;
  for(const stamp of [2,3])await actor(db,A,()=>db.query("UPDATE public.ps_library SET saved_at=$1,item=jsonb_set(item,'{savedAt}',to_jsonb($1::bigint)),updated_at=clock_timestamp() WHERE lib_id='meaningful'",[stamp]));
  eq(await count(),0,'saved_at + item.savedAt + updated_at alone produce no history');
  const changes=[
   ["name='Renamed'",'name'],
   [`item=jsonb_set(item,'{pages}','[{"name":"changed"},{"name":"second"}]')`,'pages'],
   [`item=jsonb_set(item,'{photo}','"data:image/png;base64,changed"')`,'photo'],
   ["folder='another'",'folder'],
   [`tags='["tag"]'`,'tags'],
   ["pin=true",'pin'],
   ["private=false",'sharing'],
   ["owner_id='"+B+"'",'owner']
  ];
  for(const [change,label] of changes){
   const before=(await db.query("SELECT to_jsonb(l) AS row FROM public.ps_library l WHERE lib_id='meaningful'")).rows[0].row,n=await count();
   await db.exec("UPDATE public.ps_library SET "+change+",saved_at=saved_at+1 WHERE lib_id='meaningful'");
   eq(await count(),n+1,label+' produces exactly one history row');
   eq((await db.query("SELECT snapshot FROM public.ps_library_history WHERE lib_id='meaningful' ORDER BY id DESC LIMIT 1")).rows[0].snapshot,before,label+' preserves FULL OLD row including timestamps');
  }
  const before=(await db.query("SELECT to_jsonb(l) AS row FROM public.ps_library l WHERE lib_id='meaningful'")).rows[0].row,n=await count();
  await db.exec("DELETE FROM public.ps_library WHERE lib_id='meaningful'");eq(await count(),n+1,'DELETE always captures');
  eq((await db.query("SELECT snapshot,kind FROM public.ps_library_history WHERE lib_id='meaningful' ORDER BY id DESC LIMIT 1")).rows[0],{snapshot:before,kind:'delete'},'DELETE retains the entire original');
  // Non-object legacy items must neither break capture nor become permission to discard a DELETE.
  await db.query("INSERT INTO public.ps_library(workspace_id,lib_id,owner_id,item) VALUES($1,'legacy-null',$2,NULL)",[W,A]);
  await db.exec("UPDATE public.ps_library SET saved_at=2 WHERE lib_id='legacy-null'");
  eq((await db.query("SELECT count(*)::int n FROM public.ps_library_history WHERE lib_id='legacy-null'")).rows[0].n,0,'null item timestamp-only update is safe');
  await db.exec("DELETE FROM public.ps_library WHERE lib_id='legacy-null'");
  eq((await db.query("SELECT count(*)::int n FROM public.ps_library_history WHERE lib_id='legacy-null' AND kind='delete'")).rows[0].n,1,'null item DELETE is still preserved');
 });
 await check('soft/hard deletion remains recoverable but leaving the team revokes history and media',async()=>{
  await actor(db,A,()=>db.query("UPDATE public.ps_library SET item=NULL,deleted_at=5 WHERE lib_id='L'"));
  eq((await actor(db,A,()=>db.query("SELECT count(*)::int n FROM public.ps_library_history WHERE lib_id='L' AND snapshot->'item' IS NOT NULL"))).rows[0].n>0,true,'tombstone preserves previous body');
  await actor(db,A,()=>db.query("DELETE FROM public.ps_library WHERE lib_id='L'"));
  eq((await db.query("SELECT count(*)::int n FROM public.ps_library_history WHERE lib_id='L' AND kind='delete'")).rows[0].n,1,'hard delete stores its previous row');
  await db.query('DELETE FROM public.ps_members WHERE workspace_id=$1 AND user_id=$2',[W,A]);
  eq((await actor(db,A,()=>db.query('SELECT * FROM public.ps_library_history_list_v1($1,30)',[W]))).rows,[],'former member cannot list history');
  await denied(()=>actor(db,A,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3)',[W,conflictId,id(23)])),'42501','former member cannot restore');
  eq((await actor(db,A,()=>db.query('SELECT h FROM public.ps_blob WHERE workspace_id=$1 AND h=$2',[W,H]))).rows,[],'former member cannot read photos');
 });
 await check('personal workspace recovery uses actual membership and owner boundary',async()=>{
  await db.query("INSERT INTO public.ps_library(workspace_id,lib_id,owner_id,private,item) VALUES($1,'personal',$2,true,'{\"name\":\"personal original\"}')",[P,A]);
  await actor(db,A,()=>db.query("UPDATE public.ps_library SET name='changed' WHERE workspace_id=$1 AND lib_id='personal'",[P]));
  eq((await actor(db,A,()=>db.query('SELECT * FROM public.ps_library_history_list_v1($1,30)',[P]))).rows.length,1,'personal owner history available');
  eq((await actor(db,B,()=>db.query('SELECT * FROM public.ps_library_history_list_v1($1,30)',[P]))).rows,[],'accidental personal co-member cannot read owner history');
 });
 console.log(JSON.stringify({passed:true,assertions,cases,scope:'in-memory SQL originals, conflict, photos, owner and membership; no live data'}));
}finally{await db.close();}}
run().catch(e=>{console.error(e);process.exitCode=1;});
