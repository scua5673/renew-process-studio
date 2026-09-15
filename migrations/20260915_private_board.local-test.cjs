'use strict';
// In-memory PostgreSQL only. No application credentials, network or live data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'/private/tmp/process-scout-sql-runtime/node_modules/@electric-sql/pglite');
const read=s=>fs.readFileSync(path.join(__dirname,'20260915_private_board.'+s),'utf8');
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(1),B=id(2),PA=id(10),PB=id(11),TEAM=id(12),REVOKED=id(13);
const KEYS=['cs_private_board_v1','cs_board_live_v1'];
let assertions=0;const cases=[];
function equal(a,b,label){assert.deepEqual(a,b,label);assertions++;}
function ok(v,label){assert.ok(v,label);assertions++;}
async function fail(fn,code,label){let e;try{await fn();}catch(x){e=x;}ok(e,label+' rejects');equal(e.code,code,label+' code');}
async function actor(db,uid,fn,role='authenticated'){
  await db.exec('BEGIN');try{
    await db.query("SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[uid||'',JSON.stringify(uid?{sub:uid,role}:{role})]);
    await db.exec('SET LOCAL ROLE '+role);
    const ctx=(await db.query("SELECT current_user AS role,auth.uid()::text AS uid,(SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass")).rows[0];
    equal(ctx,{role,uid:uid||null,bypass:role==='service_role'},'actual synthetic SQL role/JWT');
    const result=await fn();await db.exec('COMMIT');return result;
  }catch(e){await db.exec('ROLLBACK');throw e;}
}
const rows=db=>db.query('SELECT workspace_id::text,k,v,cupd FROM public.ps_kv ORDER BY workspace_id,k').then(r=>r.rows);
const historyRows=db=>db.query('SELECT * FROM public.ps_kv_history ORDER BY id').then(r=>r.rows);
const historyMeta=db=>db.query("SELECT oid::int,proname,proacl::text,proowner::int,prosecdef,proconfig,proargtypes::text,proallargtypes::text,prorettype::int,proretset FROM pg_proc WHERE oid IN ('public.ps_kv_history_get(uuid,bigint)'::regprocedure,'public.ps_kv_history_list(uuid,text,integer)'::regprocedure) ORDER BY proname").then(r=>r.rows);
async function security(db){return (await db.query(`SELECT
 (SELECT relacl::text FROM pg_class WHERE oid='public.ps_kv'::regclass) grants,
 (SELECT jsonb_agg(to_jsonb(p) ORDER BY polname) FROM pg_policy p WHERE polrelid='public.ps_kv'::regclass AND polname NOT IN ('ps_private_board_owner_v1','ps_private_board_role_v1')) policies,
 (SELECT jsonb_agg(jsonb_build_object('definition',pg_get_functiondef(p.oid),'acl',p.proacl::text) ORDER BY p.proname) FROM pg_proc p WHERE p.oid IN
 ('public.ps_is_member(uuid)'::regprocedure,'public.ps_is_owner(uuid)'::regprocedure,'public.ps_team_role(uuid)'::regprocedure,'public.ps_key_scope(text)'::regprocedure,'public.ps_can_read_key(uuid,text)'::regprocedure,'public.ps_can_write_key(uuid,text)'::regprocedure)) helpers`)).rows[0];}
async function fixture(db){
  await db.exec(fs.readFileSync(path.join(__dirname,'20260913_scout_write_scope.local-fixture.sql'),'utf8'));
  await db.exec(`CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
    CREATE ROLE auth_noinherit NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS; GRANT authenticated TO auth_noinherit;
    GRANT USAGE ON SCHEMA public,auth TO anon,service_role,auth_noinherit; GRANT SELECT,INSERT,UPDATE,DELETE ON public.ps_kv TO anon,service_role,auth_noinherit;
    -- Deliberately permissive legacy board policy proves that the new rule adds
    -- a mandatory restriction instead of relying on old policies already denying.
    CREATE POLICY fixture_old_board_allow ON public.ps_kv FOR ALL TO PUBLIC
    USING (k IN ('cs_private_board_v1','cs_board_live_v1')) WITH CHECK (k IN ('cs_private_board_v1','cs_board_live_v1'));
    CREATE POLICY fixture_anon_public_read ON public.ps_kv FOR SELECT TO anon USING (k='fixture_public');`);
  await db.exec(read('local-fixture.sql'));
  for(const [wid,owner,kind] of [[PA,A,'personal'],[PB,B,'personal'],[TEAM,A,'team'],[REVOKED,A,'personal']]){
    await db.query('INSERT INTO public.ps_workspaces(id,name,kind,owner_id) VALUES($1,$2,$3,$4)',[wid,'Synthetic '+wid,kind,owner]);
    for(const uid of [A,B])await db.query('INSERT INTO public.ps_members(workspace_id,user_id,role) VALUES($1,$2,$3)',[wid,uid,uid===owner?'owner':'executive']);
    for(const key of KEYS)await db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,$2,$3,1)',[wid,key,JSON.stringify({snap:{players:[{id:'synthetic',name:'Owned by '+owner}]},_savedAt:1})]);
    await db.query("INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,'cs_team_notice_v1','{\"notice\":\"preserve\"}',1)",[wid]);
  }
  await db.query("INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,'fixture_public','synthetic public content',1)",[TEAM]);
  await db.query('INSERT INTO public.ps_kv_history(workspace_id,k,v,cupd,changed_by) SELECT workspace_id::text,k,v,cupd,$1::uuid FROM public.ps_kv',[A]);
}
async function run(){const db=new PGlite();try{
  await fixture(db);const originals=await rows(db),beforeSecurity=await security(db),historyOriginal=await historyRows(db),oldHistoryMeta=await historyMeta(db);
  equal((await actor(db,B,()=>db.query('SELECT * FROM public.ps_kv_history_list($1,NULL,60)',[TEAM]))).rows.filter(r=>KEYS.includes(r.k)).length,2,'catalog-original executive history exposes both team board keys');
  await db.exec(read('preflight.sql'));await db.exec(read('sql'));await db.exec(read('verify.sql'));
  equal(await rows(db),originals,'installation preserves every board original byte/cupd');equal(await security(db),beforeSecurity,'existing policies/grants/helpers untouched');
  equal(await historyRows(db),historyOriginal,'installation preserves all history originals');equal(await historyMeta(db),oldHistoryMeta,'history OID/signature/owner/security/ACL preserved');
  async function check(name,fn){await fn();cases.push(name);}
  await check('fresh-only installation refuses collisions without changes',async()=>{
    await fail(()=>db.exec(read('sql')),'55000','second installation');await db.exec('ROLLBACK');
    equal(await rows(db),originals,'collision leaves documents unchanged');equal(await security(db),beforeSecurity,'collision leaves existing security unchanged');
  });
  await check('same-team coaches only read their personally owned workspace',async()=>{
    for(const [uid,own] of [[A,PA],[B,PB]])for(const key of KEYS){
      const visible=await actor(db,uid,()=>db.query('SELECT workspace_id::text,k FROM public.ps_kv WHERE k=$1 ORDER BY workspace_id',[key]).then(r=>r.rows));
      equal(visible.filter(r=>r.workspace_id!==REVOKED),[{workspace_id:own,k:key}],'no teammate or team live board read');
    }
  });
  await check('history RPCs cannot bypass the private board boundary',async()=>{
    for(const [uid,own,other] of [[A,PA,PB],[B,PB,PA]]){
      for(const wid of [TEAM,other]){
        const list=(await actor(db,uid,()=>db.query('SELECT * FROM public.ps_kv_history_list($1,NULL,60)',[wid]))).rows;
        equal(list.filter(r=>KEYS.includes(r.k)),[],'all-key history listing hides board metadata');ok(list.some(r=>r.k==='cs_team_notice_v1'),'unrelated history remains available');
        for(const key of KEYS){
          equal((await actor(db,uid,()=>db.query('SELECT * FROM public.ps_kv_history_list($1,$2,60)',[wid,key]))).rows,[],'explicit board-key history listing denied');
          const row=historyOriginal.find(r=>r.workspace_id===wid&&r.k===key);
          equal((await actor(db,uid,()=>db.query('SELECT * FROM public.ps_kv_history_get($1,$2)',[wid,row.id]))).rows,[],'known history ID cannot reveal another board');
        }
      }
      for(const key of KEYS){const row=historyOriginal.find(r=>r.workspace_id===own&&r.k===key);
        equal((await actor(db,uid,()=>db.query('SELECT * FROM public.ps_kv_history_get($1,$2)',[own,row.id]))).rows.map(r=>r.v),[row.v],'own personal board history remains exact');
      }
    }
    await fail(()=>actor(db,null,()=>db.query('SELECT * FROM public.ps_kv_history_list($1,NULL,60)',[TEAM]),'anon'),'P0001','existing anonymous history authorization remains denied');
  });
  await check('owner plus membership is necessary for personal writes and deletes',async()=>{
    for(const [uid,own,other] of [[A,PA,PB],[B,PB,PA]])for(const key of KEYS){
      const before=await rows(db);
      for(const wid of [TEAM,other]){
        await fail(()=>actor(db,uid,()=>db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,$2,$3,2) ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v,cupd=excluded.cupd',[wid,key,'{}'])),'42501','cross-owner/team UPSERT');
        equal((await actor(db,uid,()=>db.query('UPDATE public.ps_kv SET v=$1 WHERE workspace_id=$2 AND k=$3 RETURNING k',['{}',wid,key]))).rows,[],'unreadable board update affects zero rows');
        equal((await actor(db,uid,()=>db.query('DELETE FROM public.ps_kv WHERE workspace_id=$1 AND k=$2 RETURNING k',[wid,key]))).rows,[],'unreadable board deletion affects zero rows');
      }
      equal(await rows(db),before,'denied operations preserve all board originals');
      const raw=JSON.stringify({snap:{players:[]},note:'Synthetic '+uid});
      equal((await actor(db,uid,()=>db.query('UPDATE public.ps_kv SET v=$1,cupd=2 WHERE workspace_id=$2 AND k=$3 RETURNING v',[raw,own,key]))).rows,[{v:raw}],'own board write succeeds');
      equal((await actor(db,uid,()=>db.query('DELETE FROM public.ps_kv WHERE workspace_id=$1 AND k=$2 RETURNING k',[own,key]))).rows,[{k:key}],'own board delete succeeds');
      await actor(db,uid,()=>db.query('INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,$2,$3,3)',[own,key,raw]));
    }
  });
  await check('moving an allowed record into another owner or team cannot bypass WITH CHECK',async()=>{
    for(const target of [TEAM,PB])await fail(()=>actor(db,A,()=>db.query("UPDATE public.ps_kv SET workspace_id=$1,k='cs_private_board_v1' WHERE workspace_id=$2 AND k='cs_team_notice_v1'",[target,PA])),'42501','unprotected-to-board key move');
    equal((await actor(db,A,()=>db.query("UPDATE public.ps_kv SET k='unprotected_copy' WHERE workspace_id=$1 AND k='cs_board_live_v1' RETURNING k",[TEAM]))).rows,[],'hidden legacy row cannot be moved into a readable key');
  });
  await check('one denied team row rolls back an otherwise allowed mixed request',async()=>{
    const before=await rows(db);
    await fail(()=>actor(db,A,()=>db.query("INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES($1,'cs_private_board_v1','{\"new\":true}',4),($2,'cs_board_live_v1','{\"new\":true}',4) ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v,cupd=excluded.cupd",[PA,TEAM])),'42501','mixed private/team upsert');
    equal(await rows(db),before,'entire mixed board statement rolled back');
  });
  await check('membership removal and workspace-kind changes revoke access',async()=>{
    await db.query('DELETE FROM public.ps_members WHERE workspace_id=$1 AND user_id=$2',[REVOKED,A]);
    equal((await actor(db,A,()=>db.query('SELECT k FROM public.ps_kv WHERE workspace_id=$1 AND k=ANY($2::text[])',[REVOKED,KEYS]))).rows,[],'owner without membership cannot read');
    await fail(()=>actor(db,A,()=>db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'cs_private_board_v1','{}') ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v",[REVOKED])),'42501','owner without membership cannot write');
    await db.query("UPDATE public.ps_workspaces SET kind='team' WHERE id=$1",[PB]);
    equal((await actor(db,B,()=>db.query('SELECT k FROM public.ps_kv WHERE workspace_id=$1 AND k=ANY($2::text[])',[PB,KEYS]))).rows,[],'owner of team-space cannot read live boards');
    await db.query("UPDATE public.ps_workspaces SET kind='personal' WHERE id=$1",[PB]);
  });
  await check('anonymous roles have no live-board access or helper execution',async()=>{
    equal((await actor(db,null,()=>db.query('SELECT k FROM public.ps_kv WHERE k=ANY($1::text[])',[KEYS]),'anon')).rows,[],'anonymous cannot read even with legacy permissive board policy');
    await fail(()=>actor(db,null,()=>db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'cs_private_board_v1','{}') ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v",[PA]),'anon'),'42501','anonymous board write');
    await fail(()=>actor(db,null,()=>db.query('SELECT public.ps_private_board_owner_v1($1)',[PA]),'anon'),'42501','anonymous helper execution');
    equal((await actor(db,null,()=>db.query("SELECT v FROM public.ps_kv WHERE k='fixture_public'"),'anon')).rows,[{v:'synthetic public content'}],'unrelated existing anonymous read remains available');
    equal((await actor(db,A,async()=>{
      await db.query("SELECT set_config('request.jwt.claim.role','service_role',true),set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:A,role:'service_role'})]);
      return db.query('SELECT k FROM public.ps_kv WHERE k=ANY($1::text[])',[KEYS]);
    },'anon')).rows,[],'forged role claim does not replace the real DB role');
    equal((await actor(db,A,()=>db.query('SELECT k FROM public.ps_kv WHERE k=ANY($1::text[])',[KEYS]),'auth_noinherit')).rows,[],'noninherited membership cannot skip the authenticated owner policy');
  });
  await check('unrelated team content still follows its original sharing policy',async()=>{
    equal((await actor(db,B,()=>db.query("SELECT v FROM public.ps_kv WHERE workspace_id=$1 AND k='cs_team_notice_v1'",[TEAM]))).rows,[{v:'{"notice":"preserve"}'}],'team notice still readable by teammate');
    await actor(db,A,()=>db.query("UPDATE public.ps_kv SET v='{\"notice\":\"updated\"}' WHERE workspace_id=$1 AND k='cs_team_notice_v1'",[TEAM]));
    equal((await actor(db,B,()=>db.query("SELECT v FROM public.ps_kv WHERE workspace_id=$1 AND k='cs_team_notice_v1'",[TEAM]))).rows,[{v:'{"notice":"updated"}'}],'unrelated writes unaffected');
  });
  await check('trusted BYPASSRLS role remains an explicitly documented administrative boundary',async()=>{
    equal((await actor(db,null,()=>db.query('SELECT k FROM public.ps_kv WHERE workspace_id=$1 AND k=ANY($2::text[]) ORDER BY k',[TEAM,KEYS]),'service_role')).rows.map(r=>r.k),KEYS.slice().sort(),'service role can preserve/read administrative originals');
  });
  await db.exec(read('verify.sql'));equal(await security(db),beforeSecurity,'final unrelated security definitions unchanged');
  equal(await historyMeta(db),oldHistoryMeta,'final history function identity/grants unchanged');equal(await historyRows(db),historyOriginal,'no history content was rewritten or removed');
  await check('unreviewed history body aborts installation before creating privacy objects',async()=>{
    const otherDb=new PGlite();try{
      await fixture(otherDb);const before=await rows(otherDb);
      const def=(await otherDb.query("SELECT pg_get_functiondef('public.ps_kv_history_get(uuid,bigint)'::regprocedure) AS def")).rows[0].def;
      await otherDb.exec(def.replace('declare','-- unreviewed change\ndeclare'));
      const changed=(await otherDb.query("SELECT prosrc FROM pg_proc WHERE oid='public.ps_kv_history_get(uuid,bigint)'::regprocedure")).rows[0].prosrc;
      await fail(()=>otherDb.exec(read('sql')),'55000','unreviewed history source');await otherDb.exec('ROLLBACK');
      equal((await otherDb.query("SELECT to_regprocedure('public.ps_private_board_owner_v1(uuid)')::text AS helper")).rows[0].helper,null,'no helper created before source mismatch');
      equal((await otherDb.query("SELECT prosrc FROM pg_proc WHERE oid='public.ps_kv_history_get(uuid,bigint)'::regprocedure")).rows[0].prosrc,changed,'unreviewed function remains untouched');equal(await rows(otherDb),before,'unreviewed-source failure retains all originals');
    }finally{await otherDb.close();}
  });
  console.log(JSON.stringify({ok:true,assertions,cases,method:'isolated PGlite / synthetic JWT and roles; no network or production data',serviceRoleBypassesRls:true},null,2));
}finally{await db.close();}}
run().catch(e=>{console.error(e);process.exitCode=1;});
