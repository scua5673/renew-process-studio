/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 *   node migrations/20261017_server_hardening.local-test.cjs
 * 20261017_server_hardening 을 운영 권한 모양(2026-10-17 조회) 그대로 흉내 낸 PGlite 위에서 시험한다.
 * 함수 6개 본문은 운영 원문, 관리자 RPC 30개는 «관리자 아니면 예외» 뼈대, 가드 트리거는 SECURITY DEFINER 로 ps_kv_note_denied 를 부른다.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite'));
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const sql=read('20261017_server_hardening.sql'),verify=read('20261017_server_hardening.verify.sql'),rollback=read('20261017_server_hardening.rollback.sql');
const W='00000000-0000-4000-8000-000000000301';
const ADMIN='00000000-0000-4000-8000-000000000001',USER='00000000-0000-4000-8000-000000000002';
const ADMIN_RPC=['ps_admin_activity_keys(integer)','ps_admin_activity_users()','ps_admin_activity_ws()','ps_admin_delete_workspace(uuid)',
  'ps_admin_event_breakdown(integer)','ps_admin_event_summary()','ps_admin_event_summary_v2()','ps_admin_health()',
  'ps_admin_idp_funnel()','ps_admin_idp_get(uuid)','ps_admin_idp_users()','ps_admin_kv_history(text,text,integer)',
  'ps_admin_library(uuid,boolean)','ps_admin_library_item(uuid,text)','ps_admin_log(text,uuid,text,jsonb)','ps_admin_members(uuid)',
  'ps_admin_reach()','ps_admin_recent_activity(integer,integer,uuid,uuid)','ps_admin_remove_member(uuid,uuid)',
  'ps_admin_restore_lib(uuid,text)','ps_admin_soft_delete_lib(uuid,text)','ps_admin_sync_stuck(integer)','ps_admin_team_idp(uuid)',
  'ps_admin_usage_daily(integer)','ps_admin_usage_features(integer)','ps_admin_usage_summary()','ps_admin_users()',
  'ps_admin_versions(integer)','ps_admin_workspaces()'];
const HAD_PUBLIC=new Set(['ps_admin_event_summary_v2()','ps_admin_health()','ps_admin_kv_history(text,text,integer)','ps_admin_sync_stuck(integer)',
  'ps_admin_versions(integer)','ps_admin_recent_activity(integer,integer,uuid,uuid)']);
const FIXED=['ps_build_lt(text,text)','ps_key_scope(text)','ps_kv_noop_guard()','ps_request_build()','ps_touch()','ps_try_jsonb(text)'];
const NOTE='public.ps_kv_note_denied(uuid,uuid,text,text)';
let passed=0;
const equal=(a,b,label)=>{assert.deepEqual(a,b,label);passed++;};

// 운영의 ACL 모양: PUBLIC 은 일부만, anon·authenticated·service_role 은 명시 GRANT.
const grant=(sig,pub)=>`REVOKE ALL ON FUNCTION public.${sig} FROM PUBLIC;${pub?`GRANT EXECUTE ON FUNCTION public.${sig} TO PUBLIC;`:''}GRANT EXECUTE ON FUNCTION public.${sig} TO anon, authenticated, service_role;`;
function fixture(){
  const admin=ADMIN_RPC.map(sig=>`CREATE FUNCTION public.${sig} RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $f$
begin if not exists(select 1 from public.ps_admins a where a.user_id=auth.uid()) then raise exception 'admin only'; end if; return 'ok'; end $f$;
${grant(sig,HAD_PUBLIC.has(sig))}`).join('\n');
  return `
CREATE SCHEMA auth;
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN NOSUPERUSER;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
CREATE TABLE public.ps_admins(user_id uuid PRIMARY KEY);
CREATE TABLE public.ps_kv(workspace_id uuid NOT NULL, k text NOT NULL, v text NOT NULL, cupd bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,k));
GRANT SELECT, INSERT, UPDATE ON public.ps_kv TO authenticated;
CREATE TABLE public.ps_kv_denied(workspace_id uuid NOT NULL, user_id uuid NOT NULL, k text NOT NULL, reason text, at timestamptz DEFAULT now(),
  PRIMARY KEY(workspace_id,user_id,k));
CREATE TABLE public.ps_usage(day date NOT NULL, user_id uuid NOT NULL, feature text NOT NULL, n int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT ps_usage_pkey PRIMARY KEY(day,user_id,feature));
CREATE UNIQUE INDEX ps_usage_day_user_feature_uidx ON public.ps_usage USING btree (day, user_id, feature);
GRANT SELECT, INSERT, UPDATE ON public.ps_usage TO authenticated;

-- 운영 원문(2026-10-17 pg_proc.prosrc)
CREATE FUNCTION public.ps_build_lt(a text, b text) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
 with pa as (select coalesce(nullif(regexp_replace(x,'[^0-9]','','g'),'')::bigint,0) v, ord from unnest(string_to_array(coalesce(a,''),'.')) with ordinality t(x,ord)),
 pb as (select coalesce(nullif(regexp_replace(x,'[^0-9]','','g'),'')::bigint,0) v, ord from unnest(string_to_array(coalesce(b,''),'.')) with ordinality t(x,ord))
 select coalesce((select case when pa.v<pb.v then true when pa.v>pb.v then false else null end
   from generate_series(1,greatest((select count(*) from pa),(select count(*) from pb))) g(ord)
   left join pa on pa.ord=g.ord left join pb on pb.ord=g.ord where coalesce(pa.v,0)<>coalesce(pb.v,0) order by g.ord limit 1), false); $$;
CREATE FUNCTION public.ps_key_scope(key text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
 select case when key like 'sq:%' then 'team' when key = 'cs_scout_targets_v1' then 'scout'
  when key in ('cs_team_v1','cs_squad_v1','scout_tool_v1','cs_match_v1','cs_match_roster_v1','cs_idp_pub_v1','cs_team_attrs_v1','cs_player_del_v1','cs_team_matches_v1','cs_idp_daily_v1','cs_team_notice_v1') then 'team'
  when key in ('training_sessions_v1','cs_psched_v1','cs_pmeet_v1','cs_pwarm_v1','cs_ptrain_v1') then 'schedule'
  when key = 'cs_gamemodel_v1' then 'gamemodel' when key = 'cs_terms_v1' then 'terms' when key = 'ps_tomb_v1' then null
  when key = 'cs_perms_v1' then 'perms' else 'board' end; $$;
CREATE FUNCTION public.ps_kv_noop_guard() RETURNS trigger LANGUAGE plpgsql AS $$
 begin if tg_op = 'UPDATE' and new.v is not distinct from old.v then new.cupd := old.cupd; end if; return new; end $$;
CREATE FUNCTION public.ps_request_build() RETURNS text LANGUAGE plpgsql STABLE AS $$
 declare hdr text; begin begin hdr := coalesce((current_setting('request.headers', true))::json->>'prefer',''); exception when others then hdr := ''; end;
 return substring(hdr from 'ps-build=([0-9.]+)'); end $$;
CREATE FUNCTION public.ps_touch() RETURNS trigger LANGUAGE plpgsql AS $$ begin new.updated_at = now(); return new; end $$;
CREATE FUNCTION public.ps_try_jsonb(p_text text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
 begin return coalesce(p_text,'{}')::jsonb; exception when others then return '{}'::jsonb; end $$;
${FIXED.map(s=>grant(s,s!=='ps_try_jsonb(text)')).join('\n')}

CREATE FUNCTION public.ps_kv_note_denied(p_wid uuid, p_uid uuid, p_k text, p_reason text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
 insert into public.ps_kv_denied(workspace_id, user_id, k, reason, at) values (p_wid, p_uid, p_k, p_reason, now())
 on conflict (workspace_id, user_id, k) do update set reason = excluded.reason, at = excluded.at; $$;
${grant('ps_kv_note_denied(uuid,uuid,text,text)',true)}
-- 가드 뼈대: 운영 가드들처럼 SECURITY DEFINER(소유자 같음)로 거절 사유를 남기고 행을 버린다.
CREATE FUNCTION public.ps_kv_shape_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
 begin if new.v = 'bad' then begin perform public.ps_kv_note_denied(new.workspace_id, auth.uid(), new.k, 'shape'); exception when others then null; end; return null; end if;
 return new; end $$;
CREATE FUNCTION public.ps_audit_log() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ begin return new; end $$;
${grant('ps_audit_log()',true)}
CREATE TRIGGER ps_00b_shape BEFORE INSERT OR UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.ps_kv_shape_guard();
CREATE TRIGGER ps_00c_noop_guard_t BEFORE UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.ps_kv_noop_guard();
CREATE TRIGGER ps_kv_touch BEFORE UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.ps_touch();
${admin}
INSERT INTO public.ps_admins VALUES('${ADMIN}');
`;}

async function as(db,role,uid,fn){
  await db.exec('BEGIN');
  try{
    await db.query('SELECT set_config($1,$2,true)',['request.jwt.claim.sub',uid||'']);
    await db.exec(`SET LOCAL ROLE ${role}`);
    return await fn();
  }finally{await db.exec('ROLLBACK');}
}
const outcome=async(db,role,uid,q,params)=>as(db,role,uid,async()=>{try{return (await db.query(q,params)).rows[0];}catch(e){return /permission denied/.test(e.message)?'denied':/admin only/.test(e.message)?'admin only':e.message;}});
const call=(db,role,uid,sig)=>{
  const name=sig.slice(0,sig.indexOf('(')),types=sig.slice(sig.indexOf('(')+1,-1).split(',').filter(Boolean);
  const args=types.map((t,i)=>`$${i+1}::${t}`).join(',');
  const vals=types.map(t=>({integer:7,uuid:W,text:'x',boolean:false,jsonb:'{}'})[t]);
  return outcome(db,role,uid,`SELECT public.${name}(${args}) AS r`,vals).then(r=>r&&r.r!==undefined?r.r:r);
};
const priv=async(db,who,sig)=>(await db.query('SELECT has_function_privilege($1,$2,$3) p',[who,'public.'+sig,'EXECUTE'])).rows[0].p;
const cfg=async(db,sig)=>(await db.query('SELECT proconfig::text c FROM pg_proc WHERE oid=to_regprocedure($1)',['public.'+sig])).rows[0].c;
const indexes=async db=>(await db.query("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='ps_usage' ORDER BY 1")).rows.map(r=>r.indexname);
const snapshot=async db=>{
  const out={};
  for(const sig of [...ADMIN_RPC,...FIXED,'ps_audit_log()','ps_kv_note_denied(uuid,uuid,text,text)'])
    out[sig]={cfg:await cfg(db,sig),public:await priv(db,'public',sig),anon:await priv(db,'anon',sig),auth:await priv(db,'authenticated',sig),svc:await priv(db,'service_role',sig)};
  out.indexes=await indexes(db);
  return out;
};
const behaviour=async db=>{
  const q=async(s,p)=>(await db.query(s,p)).rows[0].r;
  return {lt:await q("SELECT public.ps_build_lt('3.9','3.10') r"),eq:await q("SELECT public.ps_build_lt('3.10','3.10') r"),
    scope:await q("SELECT public.ps_key_scope('sq:abc') r"),board:await q("SELECT public.ps_key_scope('anything') r"),
    json:await q("SELECT public.ps_try_jsonb('not json')::text r"),build:await q("SELECT public.ps_request_build() r")};
};

async function run(){
  const db=new PGlite();
  try{
    await db.exec(fixture());
    const before=await snapshot(db),beforeBehaviour=await behaviour(db);

    // ── 적용 전: 문제가 실제로 있다 ─────────────────────────────
    equal(await call(db,'anon',null,'ps_admin_users()'),'admin only','before: anon reaches the admin RPC body (only the inner check stops it)');
    equal(await outcome(db,'anon',null,`SELECT public.ps_kv_note_denied($1,$2,'k','forged')::text AS r`,[W,USER]),{r:null},'before: anon can forge a denial row for any user');
    await db.exec('DELETE FROM public.ps_kv_denied');
    equal(before['ps_touch()'].cfg,null,'before: search_path is open');

    // ── 적용(두 번 실행해도 안전) + 확인 ─────────────────────────
    await db.exec(sql);await db.exec(sql);
    const vr=await db.exec(verify);
    equal(vr[vr.length-1].rows[0].result,'server_hardening_verified','verify passes');

    // ① search_path 고정, 동작은 그대로
    for(const sig of FIXED)equal(await cfg(db,sig),'{search_path=public}',`after: ${sig} pins search_path`);
    equal(await behaviour(db),beforeBehaviour,'after: the six functions return exactly what they did');
    await db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'a','1')",[W]);
    const c0=(await db.query("SELECT cupd FROM public.ps_kv WHERE k='a'")).rows[0].cupd;
    await db.query("UPDATE public.ps_kv SET v='1', cupd=cupd+5 WHERE k='a'");
    equal((await db.query("SELECT cupd FROM public.ps_kv WHERE k='a'")).rows[0].cupd,c0,'after: the no-op guard trigger still keeps cupd on an unchanged value');

    // ② ps_kv_note_denied: 클라이언트는 못 부르고, 가드는 계속 기록한다
    equal(await outcome(db,'anon',null,`SELECT public.ps_kv_note_denied($1,$2,'k','forged')::text AS r`,[W,USER]),'denied','after: anon cannot forge a denial row');
    equal(await outcome(db,'authenticated',USER,`SELECT public.ps_kv_note_denied($1,$2,'k','forged')::text AS r`,[W,ADMIN]),'denied','after: a signed-in user cannot forge one either');
    await as(db,'authenticated',USER,async()=>{await db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'b','bad')",[W]);
      await db.exec('RESET ROLE');
      equal((await db.query('SELECT count(*)::int n FROM public.ps_kv_denied WHERE user_id=$1',[USER])).rows[0].n,1,'after: a SECURITY DEFINER guard still records the denial');});
    equal(await priv(db,'service_role','ps_kv_note_denied(uuid,uuid,text,text)'),true,'after: service_role keeps execute');

    // ③ 관리자 RPC: anon 은 문 앞에서, 로그인한 관리자는 그대로
    for(const sig of ADMIN_RPC){
      equal(await call(db,'anon',null,sig),'denied',`after: anon is refused at the door — ${sig}`);
      equal(await call(db,'authenticated',ADMIN,sig),'ok',`after: a signed-in admin still runs ${sig}`);
    }
    equal(await call(db,'authenticated',USER,'ps_admin_users()'),'admin only','after: a signed-in non-admin is still stopped by the inner check');
    equal(await priv(db,'anon','ps_audit_log()'),false,'after: the audit trigger function is not executable by anon');
    await db.query("INSERT INTO public.ps_kv(workspace_id,k,v) VALUES($1,'c','1')",[W]);   // 트리거는 실행 권한과 무관하게 돈다

    // ④ 중복 색인 삭제, upsert 는 그대로
    equal(await indexes(db),['ps_usage_pkey'],'after: only the primary key index is left');
    for(let i=0;i<2;i++)await db.query(`INSERT INTO public.ps_usage(day,user_id,feature) VALUES('2026-10-17',$1,'board') ON CONFLICT (day,user_id,feature) DO UPDATE SET n=public.ps_usage.n+1`,[USER]);
    equal((await db.query('SELECT n FROM public.ps_usage')).rows,[{n:2}],'after: the usage upsert still lands on one row per (day,user,feature)');

    // ── 되돌리기: 적용 전 권한·설정·색인 그대로 ──────────────────
    await db.exec(rollback);await db.exec(rollback);
    equal(await snapshot(db),before,'rollback restores every privilege, setting and index exactly');
    await db.exec(sql);
    const vr2=await db.exec(verify);
    equal(vr2[vr2.length-1].rows[0].result,'server_hardening_verified','re-applying after a rollback works');
  }finally{await db.close();}

  // ── 예상과 다른 운영: 아무것도 바꾸지 않고 멈춘다 ──────────────
  for(const [label,tweak,msg] of [
    ['a caller that is not SECURITY DEFINER',`CREATE FUNCTION public.ps_plain_caller() RETURNS void LANGUAGE sql AS $$ select public.ps_kv_note_denied(null,null,null,null) $$;`,/SECURITY DEFINER 가 아닌 곳/],
    ['an unexpected search_path',`ALTER FUNCTION public.ps_touch() SET search_path = pg_catalog;`,/설정이 예상과 다릅니다/],
    ['an admin RPC that authenticated cannot run',`REVOKE EXECUTE ON FUNCTION public.ps_admin_users() FROM authenticated, PUBLIC;`,/authenticated 가 실행하지 못합니다/],
    ['a "duplicate" index that is not the same',`DROP INDEX public.ps_usage_day_user_feature_uidx; CREATE UNIQUE INDEX ps_usage_day_user_feature_uidx ON public.ps_usage(day,user_id);`,/같은 색인이 아닙니다/],
  ]){
    const d2=new PGlite();
    try{
      await d2.exec(fixture());await d2.exec(tweak);
      const snap=await snapshot(d2);
      await assert.rejects(()=>d2.exec(sql),msg,label);
      await d2.exec('ROLLBACK');
      equal(await snapshot(d2),snap,`stops on ${label} and changes nothing`);
    }finally{await d2.close();}
  }
  console.log(`20261017_server_hardening local test: ${passed} checks passed`);
}
run().catch(e=>{console.error(e);process.exit(1);});
