'use strict';
// In-memory PostgreSQL only. No URL, credentials, connection string or live data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const baseline=read('00000000_baseline.sql');
const sql=read('20261025_private_blob_boundary.sql');
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),C=id(3),D=id(4),W=id(10),P=id(11),Q=id(12);
const H=n=>String(n).padStart(24,'a'),photo=n=>'data:image/png;base64,'+String(n).repeat(720);
let assertions=0;const cases=[];
function eq(actual,expected,label){assert.deepEqual(actual,expected,label);assertions++;}
function fn(name){const start=baseline.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(');assert.ok(start>=0,name);return baseline.slice(start,baseline.indexOf('$function$;',start)+12);}
async function actor(db,uid,work,role='authenticated'){
 await db.exec('BEGIN');try{
  await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid||'']);await db.exec('SET LOCAL ROLE '+role);
  eq((await db.query('SELECT current_user AS role,(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass')).rows[0],{role,bypass:role==='service_role'},'actual non-bypass SQL role');
  const result=await work();await db.exec('COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
async function denied(work,code,label){let e;try{await work();}catch(x){e=x;}assert.ok(e,label+' rejects');assertions++;eq(e.code,code,label+' SQLSTATE');}
const blob=(db,uid,wid,h)=>actor(db,uid,()=>db.query('SELECT h,v FROM public.ps_blob WHERE workspace_id=$1 AND h=$2',[wid,h]).then(r=>r.rows));
const doc=(db,uid,wid,k)=>actor(db,uid,()=>db.query('SELECT v FROM public.ps_kv WHERE workspace_id=$1 AND k=$2',[wid,k]).then(r=>r.rows));
const card=(uid,libId,h)=>({workspace_id:W,lib_id:libId,owner_id:uid,private:true,item:{name:'Synthetic '+libId,photo:'psblob:'+h}});
const insertCard=(db,c)=>db.query('INSERT INTO public.ps_library(workspace_id,lib_id,owner_id,private,item,name) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[c.workspace_id,c.lib_id,c.owner_id,c.private,JSON.stringify(c.item),c.lib_id]);
const upload=(db,uid,h,body=photo(h),wid=W,creator=uid)=>actor(db,uid,()=>db.query('INSERT INTO public.ps_blob(workspace_id,h,v,created_by) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,h) DO NOTHING',[wid,h,body,creator]));
async function originals(db){const out={};for(const t of ['ps_kv','ps_library','ps_blob','ps_kv_history','ps_library_history'])out[t]=(await db.query('SELECT to_jsonb(t) AS row FROM public.'+t+' t ORDER BY to_jsonb(t)::text')).rows;return out;}
async function fixture(db){
 await db.exec(read('20260913_scout_write_scope.local-fixture.sql'));
 await db.exec("CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;GRANT USAGE ON SCHEMA public,auth TO anon,service_role;");
 await db.exec(read('20260915_private_board.local-fixture.sql'));await db.exec(read('20260915_private_board.sql'));
 for(const name of ['ps_key_scope','ps_can_write_key','ps_can_read_key','ps_idp_can_view','ps_team_role'])await db.exec(fn(name));
 await db.exec(`CREATE TABLE public.ps_blob(workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,h text NOT NULL CHECK(h ~ '^[0-9a-f]{16,64}$'),v text NOT NULL,created_by uuid DEFAULT auth.uid(),created_at timestamptz DEFAULT now(),PRIMARY KEY(workspace_id,h));
 CREATE TABLE public.ps_library(workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,lib_id text NOT NULL,type text DEFAULT 'train',name text NOT NULL DEFAULT '',folder text NOT NULL DEFAULT '',tags jsonb DEFAULT '[]',pin boolean DEFAULT false,item jsonb,saved_at bigint DEFAULT 0,deleted_at bigint,updated_at timestamptz DEFAULT now(),owner_id uuid,private boolean DEFAULT false,PRIMARY KEY(workspace_id,lib_id));
 ALTER TABLE public.ps_blob ENABLE ROW LEVEL SECURITY;ALTER TABLE public.ps_library ENABLE ROW LEVEL SECURITY;
 GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_blob,public.ps_library TO anon,authenticated,service_role;`);
 for(const name of ['ps_blob_ins','ps_blob_sel','lib_del','lib_ins','lib_sel','lib_upd']){
  const line=baseline.split('\n').find(l=>l.startsWith('create policy '+name+' '));assert.ok(line,name);await db.exec(line);
 }
 await db.exec(read('20261025_library_recovery.sql'));
 for(const [wid,owner,kind] of [[W,A,'team'],[P,A,'personal'],[Q,B,'personal']]){
  await db.query('INSERT INTO public.ps_workspaces(id,name,kind,owner_id) VALUES($1,$2,$3,$4)',[wid,'Synthetic '+wid,kind,owner]);
  for(const uid of [A,B,C])await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[wid,uid,uid===owner?'owner':'member']);
 }
 await db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'cs_perms_v1',$2)",[W,JSON.stringify({defaultRole:'player',staffEdit:'edit',members:{[B]:{role:'staff'},[C]:{role:'player'}}})]);
 for(let n=1;n<=8;n++)await db.query('INSERT INTO public.ps_blob(workspace_id,h,v,created_by) VALUES($1,$2,$3,$4)',[n===6?P:W,H(n),photo(H(n)),A]);
 await insertCard(db,card(A,'private-a',H(1)));
 const shared=card(A,'shared',H(2));shared.private=false;await insertCard(db,shared);
 await insertCard(db,{...card(B,'own-b',H(2)),item:{name:'B source'}});
 await db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'scout_tool_v1',$2),($1,'process_coach_v1',$3)",[W,JSON.stringify({emblem:'',emblemRef:H(3),players:[]}),JSON.stringify({thumb:'',thumbRef:H(4),sessions:[]})]);
 // Direct/legacy board reference is schema-valid, while the normal current
 // private-board writer keeps its images inline (not blobPrepRows).
 await db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'cs_private_board_v1',$2)",[P,JSON.stringify({snap:{players:[],photo:'psblob:'+H(6)},view:'board'})]);
 await db.query("INSERT INTO public.ps_kv_history(workspace_id,k,v,cupd,changed_by) VALUES($1,'process_coach_v1',$2,1,$3)",[W,JSON.stringify({thumbRef:H(7)}),A]);
 await db.query("INSERT INTO public.ps_library_history(workspace_id,lib_id,owner_id,snapshot,kind) VALUES($1,'shared',$2,$3::jsonb,'update')",[W,A,JSON.stringify(card(A,'shared',H(8)))]);
}
async function run(){const db=new PGlite();try{
 await fixture(db);
 const before={
  privateBody:await actor(db,B,()=>db.query("SELECT item FROM public.ps_library WHERE lib_id='private-a'").then(r=>r.rows)),
  privatePhoto:await blob(db,B,W,H(1)),studentBody:await doc(db,C,W,'scout_tool_v1'),studentPhoto:await blob(db,C,W,H(3)),
  privateBoardBody:await doc(db,B,P,'cs_private_board_v1'),privateBoardPhoto:await blob(db,B,P,H(6))
 };
 eq(before.privateBody,[],'old policy hides private library body');eq(before.privatePhoto.length,1,'old policy nevertheless exposes private library photo');
 eq(before.studentBody,[],'old policy hides scout original from student');eq(before.studentPhoto.length,1,'old policy exposes actual scout photo to student');
 eq(before.privateBoardBody,[],'private board original hidden even from accidental personal member');eq(before.privateBoardPhoto.length,1,'legacy/direct board ref photo exposed under old policy');
 console.log(JSON.stringify({stage:'before',reproduced:{privateLibraryPhoto:before.privatePhoto.length,studentScoutPhoto:before.studentPhoto.length,legacyPrivateBoardPhoto:before.privateBoardPhoto.length},scope:'synthetic SQL roles; no live data'}));
 const original=await originals(db);
 for(const suffix of ['preflight.sql','dryrun.sql'])await db.exec(read('20261025_private_blob_boundary.'+suffix));
 // Actual Supabase applying-role attributes: NOSUPERUSER, BYPASSRLS,
 // CREATEROLE, INHERIT. Source-table ownership matches its operational role.
 await db.exec('CREATE ROLE fixture_migrator NOLOGIN NOSUPERUSER BYPASSRLS CREATEROLE INHERIT;GRANT authenticated TO fixture_migrator WITH ADMIN OPTION;GRANT USAGE,CREATE ON SCHEMA public TO fixture_migrator WITH GRANT OPTION;GRANT USAGE ON SCHEMA auth TO fixture_migrator;');
 for(const table of ['ps_workspaces','ps_members','ps_blob','ps_kv','ps_library','ps_kv_history','ps_library_history'])await db.exec('ALTER TABLE public.'+table+' OWNER TO fixture_migrator');
 await db.exec('SET SESSION AUTHORIZATION fixture_migrator');
 eq((await db.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolinherit FROM pg_roles WHERE rolname=current_user')).rows[0],{rolsuper:false,rolbypassrls:true,rolcreaterole:true,rolinherit:true},'non-superuser applying role matches operational metadata');
 await db.exec(sql);await db.exec(read('20261025_private_blob_boundary.verify.sql'));
 eq((await db.query("SELECT has_schema_privilege('ps_blob_reader_v1','public','CREATE') AS create_allowed")).rows[0].create_allowed,false,'temporary schema CREATE is revoked');
 if(Number((await db.query("SELECT current_setting('server_version_num') AS version")).rows[0].version)>=160000){
  eq((await db.query("SELECT pg_has_role(current_user,'ps_blob_reader_v1','SET') AS can_set")).rows[0].can_set,false,'temporary SET ROLE is revoked while creator ADMIN is preserved');
  eq((await db.query("SELECT count(*)::int n,bool_or(admin_option) AS admin,bool_or(inherit_option) AS inherit,bool_or(set_option) AS set FROM pg_auth_members WHERE roleid='ps_blob_reader_v1'::regrole AND member=(SELECT oid FROM pg_roles WHERE rolname=current_user)")).rows[0],{n:1,admin:true,inherit:false,set:false},'only original automatic ADMIN membership remains, with no INHERIT/SET leak');
 }
 await db.exec('SET SESSION AUTHORIZATION postgres;RESET ROLE');
 eq((await db.query('SELECT session_user,current_user')).rows[0],{session_user:'postgres',current_user:'postgres'},'test harness returns to its original identity after the non-superuser rehearsal');
 eq(await originals(db),original,'installation never modifies original documents, history, blob bytes or timestamps');
 await denied(()=>db.exec(sql),'55000','second installation refuses collisions');await db.exec('ROLLBACK');
 async function check(label,work){await work();cases.push(label);}
 await check('source privacy, students and personal ownership',async()=>{
  eq(await blob(db,B,W,H(1)),[],'private media denied');eq(await blob(db,C,W,H(3)),[],'student scout media denied');eq(await blob(db,B,P,H(6)),[],'private-board media denied');
  eq((await blob(db,A,W,H(1))).length,1,'owner private media exact');eq((await blob(db,A,P,H(6))).length,1,'personal board owner media');
  eq((await blob(db,B,W,H(2))).length,1,'staff shared media');eq((await blob(db,C,W,H(4))).length,1,'student readable schedule media');
  eq(await blob(db,D,W,H(2)),[],'other team/no membership');eq(await blob(db,A,W,H(5)),[],'orphan is hidden even from creator');
  eq(await actor(db,null,()=>db.query('SELECT h FROM public.ps_blob').then(r=>r.rows),'anon'),[],'anonymous reads no media despite table grant');
 });
 await check('owner-only historical media survives current sharing changes',async()=>{
  eq((await blob(db,A,W,H(7))).length,1,'authorized KV history-only image');eq(await blob(db,C,W,H(7)),[],'student cannot use admin history bypass');
  eq((await blob(db,A,W,H(8))).length,1,'owner private historical image');eq(await blob(db,B,W,H(8)),[],'shared current item does not share historical private image');
 });
 await check('new reference laundering, including SECURITY DEFINER archive, denied atomically',async()=>{
  await denied(()=>actor(db,B,()=>insertCard(db,card(B,'forged',H(1)))),'42501','forged current-source hash');
  await denied(()=>actor(db,B,()=>db.query('SELECT public.ps_library_archive_conflict_v1($1,$2,$3::jsonb)',[W,'own-b',JSON.stringify(card(B,'own-b',H(1)))])),'42501','definer archive cannot bypass reader RLS');
  await db.exec("CREATE FUNCTION public.fixture_definer_write(wid uuid,body jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN INSERT INTO public.ps_library(workspace_id,lib_id,owner_id,private,item) VALUES(wid,'definer-forged',auth.uid(),true,body);END $$;GRANT EXECUTE ON FUNCTION public.fixture_definer_write(uuid,jsonb) TO authenticated;");
  await denied(()=>actor(db,B,()=>db.query('SELECT public.fixture_definer_write($1,$2::jsonb)',[W,JSON.stringify({photo:'psblob:'+H(1)})])),'42501','generic definer writer cannot skip new refs validation');
  eq((await db.query("SELECT count(*)::int n FROM public.ps_library WHERE lib_id IN('forged','definer-forged')")).rows[0].n,0,'forged source never lands');
  await denied(()=>actor(db,B,()=>db.query("INSERT INTO public.ps_library(workspace_id,lib_id,owner_id,private,item) VALUES($1,'bulk-good',$2,true,$3::jsonb),($1,'bulk-forged',$2,true,$4::jsonb)",[W,B,JSON.stringify({photo:'psblob:'+H(2)}),JSON.stringify({photo:'psblob:'+H(1)})])),'42501','mixed source batch is atomic');
  eq((await db.query("SELECT count(*)::int n FROM public.ps_library WHERE lib_id LIKE 'bulk-%'")).rows[0].n,0,'valid row from rejected bulk batch also absent');
 });
 await check('old upload-before-parent sequence and exact bytes dedup work',async()=>{
  await upload(db,A,H(9));eq((await blob(db,A,W,H(9))).length,1,'exact-byte uploader can finish upload-before-parent SQL');eq(await blob(db,B,W,H(9)),[],'upload proof never grants access to another account');
  await actor(db,A,()=>insertCard(db,card(A,'new-a',H(9))));eq((await blob(db,A,W,H(9))).length,1,'parent commit enables image read');eq(await blob(db,B,W,H(9)),[],'new private upload stays private');
  await upload(db,B,H(9));await actor(db,B,()=>insertCard(db,card(B,'same-bytes-b',H(9))));eq((await blob(db,B,W,H(9))).length,1,'same bytes can dedup across private owners without knowing original source');
  await denied(()=>upload(db,B,H(9),'different image'),'PT409','same hash different bytes rejected');
  eq((await db.query('SELECT v FROM public.ps_blob WHERE workspace_id=$1 AND h=$2',[W,H(9)])).rows[0].v,photo(H(9)),'collision leaves original exact bytes');
  await denied(()=>upload(db,B,H(10),photo(H(10)),W,A),'42501','creator spoof denied');
  await denied(()=>upload(db,D,H(10)),'42501','outsider upload denied');
  await denied(()=>actor(db,B,()=>db.query('SELECT public.ps_blob_stage_v1($1,$2,$3,$4)',[W,H(14),'invented body',B])),'42501','public RPC cannot preclaim an absent hash');
  await db.query('INSERT INTO public.ps_blob_upload_proof_v1(workspace_id,user_id,h,content_digest) VALUES($1,$2,$3,sha256(convert_to($4,\'UTF8\')))',[W,B,H(15),'different preclaimed bytes']);
  await db.query('INSERT INTO public.ps_blob(workspace_id,h,v,created_by) VALUES($1,$2,$3,$4)',[W,H(15),photo(H(15)),A]);
  eq(await blob(db,B,W,H(15)),[],'even a privileged stale/wrong-body proof cannot read later bytes');
  await denied(()=>actor(db,B,()=>insertCard(db,card(B,'preclaimed',H(15)))),'42501','wrong-body proof cannot authorize a new reference');
 });
 await check('expired upload proof fails closed and ordinary retry recovers',async()=>{
  await upload(db,A,H(11));await db.query("UPDATE public.ps_blob_upload_proof_v1 SET at=now()-interval '31 minutes' WHERE h=$1",[H(11)]);
  eq(await blob(db,A,W,H(11)),[],'expired receipt does not authorize orphan read');
  await denied(()=>actor(db,A,()=>insertCard(db,card(A,'expired',H(11)))),'42501','stale receipt not adopted');
  await upload(db,A,H(11));await actor(db,A,()=>insertCard(db,card(A,'retried',H(11))));eq((await blob(db,A,W,H(11))).length,1,'exact upload retry refreshes proof');
 });
 await check('sharing revocation and history trim update the same transaction',async()=>{
  await actor(db,A,()=>db.query("UPDATE public.ps_library SET private=true WHERE workspace_id=$1 AND lib_id='shared'",[W]));
  eq(await blob(db,B,W,H(2)),[],'unsharing removes current media access; history remains owner-only');
  await db.query("UPDATE public.ps_kv_history SET v=NULL WHERE workspace_id=$1 AND k='process_coach_v1'",[W]);eq(await blob(db,A,W,H(7)),[],'trimmed history no longer grants image access');
  await db.query("INSERT INTO public.ps_kv_history(workspace_id,k,v,cupd) VALUES('legacy-non-uuid','process_coach_v1',$1,1)",[JSON.stringify({thumbRef:H(7)})]);
  await db.exec("UPDATE public.ps_kv_history SET v=NULL WHERE workspace_id='legacy-non-uuid';DELETE FROM public.ps_kv_history WHERE workspace_id='legacy-non-uuid';");
  eq((await db.query("SELECT count(*)::int n FROM public.ps_kv_history WHERE workspace_id='legacy-non-uuid'")).rows[0].n,0,'legacy text workspace does not break retention trim/delete');
 });
 await check('history restore copy preserves photos and rejects missing media',async()=>{
  const hid=(await db.query('SELECT id FROM public.ps_library_history WHERE snapshot::text LIKE $1 ORDER BY id LIMIT 1',['%'+H(8)+'%'])).rows[0].id;
  const out=await actor(db,A,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3) AS out',[W,hid,id(30)]).then(r=>r.rows[0].out));
  eq(out.restored,true,'own history restore acknowledged');eq((await blob(db,A,W,H(8))).length,1,'historical media remains exact after copy');
  await denied(()=>actor(db,B,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3)',[W,hid,id(31)])),'42501','other owner cannot restore private history');
  for(const n of [16,17,18])await db.query('INSERT INTO public.ps_blob(workspace_id,h,v,created_by) VALUES($1,$2,$3,$4)',[W,H(n),photo(H(n)),A]);
  const item={photo:'psblob:'+H(16),frames:[{thumbRef:H(17),emblemRef:H(18)}]};
  const hist=(await db.query("INSERT INTO public.ps_library_history(workspace_id,lib_id,owner_id,snapshot,kind) VALUES($1,'three-refs',$2,$3::jsonb,'update') RETURNING id",[W,A,JSON.stringify({...card(A,'three-refs',H(16)),item})])).rows[0].id;
  await db.query('DELETE FROM public.ps_blob WHERE workspace_id=$1 AND h=$2',[W,H(18)]);
  const beforeMissing=await originals(db);
  await denied(()=>actor(db,A,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3)',[W,hist,id(32)])),'55000','missing nested emblemRef aborts photo restore');
  eq(await originals(db),beforeMissing,'failed photo restore leaves every original intact');
  eq((await db.query('SELECT count(*)::int n FROM public.ps_library_restore_requests WHERE request_id=$1',[id(32)])).rows[0].n,0,'missing-media request rolls back rather than recording false success');
  await db.query('INSERT INTO public.ps_blob(workspace_id,h,v,created_by) VALUES($1,$2,$3,$4)',[W,H(18),photo(H(18)),A]);
  const recovered=await actor(db,A,()=>db.query('SELECT public.ps_library_restore_copy_v1($1,$2,$3) AS out',[W,hist,id(32)]).then(r=>r.rows[0].out));
  const restored=(await db.query('SELECT item FROM public.ps_library WHERE workspace_id=$1 AND lib_id=$2',[W,recovered.lib_id])).rows[0].item;
  eq(restored.frames,item.frames,'all nested authored media references restored unchanged');
  eq(restored.photo,item.photo,'full photo reference restored unchanged');
 });
 await check('revoked membership blocks all current, historical and staged access',async()=>{
  await db.query('DELETE FROM public.ps_members WHERE workspace_id=$1 AND user_id=$2',[W,B]);eq(await blob(db,B,W,H(9)),[],'removed member cannot read owned source');
  await denied(()=>upload(db,B,H(12)),'42501','removed member cannot upload');
  await denied(()=>actor(db,A,()=>db.query('SELECT * FROM public.ps_blob_upload_proof_v1')),'42501','upload proof table private');
 });
 // Rollback changes only derived protection; saved originals remain untouched.
 const final=await originals(db);await db.exec('DROP FUNCTION public.fixture_definer_write(uuid,jsonb)');await db.exec('SET SESSION AUTHORIZATION fixture_migrator');await db.exec(read('20261025_private_blob_boundary.rollback.sql'));await db.exec('SET SESSION AUTHORIZATION postgres;RESET ROLE');
 eq(await originals(db),final,'rollback does not delete or rewrite content');eq((await blob(db,C,W,H(3))).length,1,'rollback explicitly restores prior insecure membership boundary');
 console.log(JSON.stringify({passed:true,assertions,cases,scope:'synthetic PGlite; exact baseline policies/helpers and actual library recovery migration; no live access'}));
 }finally{await db.close();}}
run().catch(e=>{console.error({message:e.message,code:e.code,where:e.where,query:e.query,stack:String(e.stack).split('\n').slice(0,3).join('\n')});process.exitCode=1;});
