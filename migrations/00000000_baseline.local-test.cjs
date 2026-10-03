'use strict';
// 기준본 추출 쿼리(00000000_baseline.catalog.sql)의 왕복 시험 — 합성 DB 만 쓴다. 운영 연결 인자가 없다.
// 원본 DB → 추출(ddl1) → 빈 DB 에 Supabase 가 주는 것(auth·역할·발행)만 깔고 ddl1 적용 → 다시 추출(ddl2) → ddl1 === ddl2.
// 그리고 되살린 DB 에서 행 단위 보안이 실제로 같은 판정을 내리는지 본다.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {PGlite}=require(process.env.PGLITE_MODULE||'@electric-sql/pglite');
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8');
const CATALOG=read('00000000_baseline.catalog.sql');
const scoutFixture=read('20260913_scout_write_scope.local-fixture.sql');
// Supabase 가 새 프로젝트에 이미 주는 것(기준본이 담지 않는 것)만 — 픽스처 머리의 auth 스키마·함수·역할
const SUPABASE_PRELUDE=scoutFixture.slice(0,scoutFixture.indexOf('CREATE TABLE public.ps_workspaces'))+`
CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS;
CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
CREATE PUBLICATION supabase_realtime;
GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`;
assert.ok(SUPABASE_PRELUDE.includes('CREATE SCHEMA auth')&&SUPABASE_PRELUDE.includes('auth.uid()'),'prelude must carry the auth stub');
// 픽스처에 없는 종류를 원본에 더해 카탈로그의 모든 칸을 실제로 거치게 한다
const EXTRAS=`
CREATE TYPE public.ps_test_mood AS ENUM ('low','ok','high');
CREATE TABLE public.ps_test_serial (id serial PRIMARY KEY, mood public.ps_test_mood NOT NULL DEFAULT 'ok',
  score int CHECK (score BETWEEN 0 AND 10), doubled int GENERATED ALWAYS AS (score*2) STORED,
  ws uuid REFERENCES public.ps_workspaces(id) ON DELETE CASCADE);
CREATE INDEX ps_test_serial_ws_idx ON public.ps_test_serial (ws) WHERE score IS NOT NULL;
CREATE SEQUENCE public.ps_test_free_seq;
CREATE VIEW public.ps_test_view WITH (security_invoker=true) AS SELECT id, mood FROM public.ps_test_serial WHERE score > 3;
CREATE MATERIALIZED VIEW public.ps_test_mat AS SELECT count(*) AS n FROM public.ps_test_serial WITH NO DATA;
CREATE FUNCTION public.ps_test_touch() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.score := coalesce(NEW.score,0); RETURN NEW; END $$;
CREATE TRIGGER ps_test_touch_t BEFORE INSERT OR UPDATE ON public.ps_test_serial FOR EACH ROW EXECUTE FUNCTION public.ps_test_touch();
CREATE FUNCTION public.ps_test_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN RETURN NEW; END $$;
CREATE TRIGGER ps_test_on_auth_user AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.ps_test_new_user();
REVOKE ALL ON FUNCTION public.ps_test_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ps_test_new_user() TO service_role;
ALTER TABLE public.ps_test_serial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ps_test_serial FORCE ROW LEVEL SECURITY;
CREATE POLICY ps_test_sel ON public.ps_test_serial AS PERMISSIVE FOR SELECT TO authenticated, anon USING (public.ps_is_member(ws));
GRANT SELECT, INSERT ON public.ps_test_serial TO authenticated;
GRANT SELECT ON public.ps_test_view TO anon;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ps_test_serial;
COMMENT ON TABLE public.ps_test_serial IS '합성 표 — 주석 왕복';
COMMENT ON COLUMN public.ps_test_serial.score IS '0~10';
COMMENT ON FUNCTION public.ps_test_touch() IS 'it''s a trigger';`;
const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002',WA='10000000-0000-4000-8000-000000000010';
async function ddlOf(db){const r=await db.query(CATALOG);assert.equal(r.rows.length,1);return r.rows[0].ddl;}
async function asUser(db,uid,sql,params=[]){await db.exec('BEGIN');try{await db.query("SELECT set_config('request.jwt.claim.sub',$1,true)",[uid]);await db.exec('SET LOCAL ROLE authenticated');const r=await db.query(sql,params);await db.exec('COMMIT');return r.rows;}catch(e){await db.exec('ROLLBACK');throw e;}}
async function seed(db){
  await db.query("INSERT INTO ps_workspaces(id,name,kind,owner_id) VALUES($1,'합성 팀','team',$2)",[WA,A]);
  await db.query("INSERT INTO ps_members(workspace_id,user_id,role) VALUES($1,$2,'owner')",[WA,A]);
  await db.query("INSERT INTO ps_kv(workspace_id,k,v,cupd) VALUES($1,'scout_tool_v1','{}',1)",[WA]);
}
(async()=>{let src,dst;
  try{
    src=new PGlite();
    await src.exec(scoutFixture);
    await src.exec(`CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE service_role NOLOGIN NOSUPERUSER BYPASSRLS;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text); CREATE PUBLICATION supabase_realtime;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;`);
    await src.exec(read('20260915_private_board.local-fixture.sql'));
    await src.exec(read('20260915_private_board.sql'));
    await src.exec(EXTRAS);
    const ddl1=await ddlOf(src);
    // 담겨야 하는 것
    for(const must of ['create table if not exists public.ps_kv (','create policy kv_sel_nonidp on public.ps_kv','create policy ps_private_board_owner_v1 on public.ps_kv as restrictive',
      'alter table public.ps_kv enable row level security;','force row level security','CREATE OR REPLACE FUNCTION public.ps_is_member(',
      "create type public.ps_test_mood as enum ('low', 'ok', 'high');",'create sequence if not exists public.ps_test_free_seq;','generated always as ((score * 2)) stored',
      'generated by default as identity','CREATE INDEX ps_test_serial_ws_idx','CREATE TRIGGER ps_test_on_auth_user AFTER INSERT ON auth.users',
      'create or replace view public.ps_test_view with (security_invoker=true) as','create materialized view if not exists public.ps_test_mat',
      'revoke all on function public.ps_test_new_user() from anon, authenticated, public, service_role;','grant execute on function public.ps_test_new_user() to service_role;',
      'grant DELETE, INSERT, SELECT, UPDATE on table public.ps_kv to authenticated;','alter publication supabase_realtime add table public.ps_test_serial;',
      'for select to anon, authenticated using',"comment on column public.ps_test_serial.score is '0~10';","comment on function public.ps_test_touch() is 'it''s a trigger';"])
      assert.ok(ddl1.includes(must),'baseline is missing: '+must);
    // 담기면 안 되는 것 — auth 스키마의 표, 행 값
    assert.ok(!ddl1.includes('create table if not exists auth.users'),'auth tables belong to Supabase, not the baseline');
    await seed(src);
    assert.ok(!(await ddlOf(src)).includes('합성 팀'),'baseline never carries row values');
    // 빈 DB 에 다시 만들기
    dst=new PGlite();
    await dst.exec(SUPABASE_PRELUDE);
    await dst.exec(ddl1);
    const ddl2=await ddlOf(dst);
    if(ddl2!==ddl1){const a=ddl1.split('\n'),b=ddl2.split('\n');const i=a.findIndex((l,j)=>l!==b[j]);assert.fail('round trip differs at line '+(i+1)+'\n- '+a[i]+'\n+ '+b[i]);}
    // 되살린 DB 의 보안 판정이 원본과 같다
    await seed(dst);
    for(const db of [src,dst]){
      assert.deepEqual((await asUser(db,A,"SELECT k FROM ps_kv WHERE workspace_id=$1",[WA])).map(r=>r.k),['scout_tool_v1'],'owner reads team row');
      assert.deepEqual(await asUser(db,B,"SELECT k FROM ps_kv WHERE workspace_id=$1",[WA]),[],'outsider reads nothing');
      assert.deepEqual(await asUser(db,B,"UPDATE ps_kv SET v='x' WHERE workspace_id=$1 RETURNING k",[WA]),[],'outsider write denied');
    }
    console.log(JSON.stringify({passed:true,scope:'synthetic PGlite round trip of 00000000_baseline.catalog.sql',ddlBytes:Buffer.byteLength(ddl1),lines:ddl1.split('\n').length,
      cases:['every-section-exercised','auth-trigger-captured','no-auth-tables','no-row-values','byte-identical-round-trip','rls-same-after-restore']}));
  }finally{if(src)await src.close();if(dst)await dst.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
