/* LOCAL SYNTHETIC POSTGRESQL ONLY. No network, production connection or user data.
 * 20261110_* 묶음의 local-test 가 같이 쓰는 발판: 기준본(00000000_baseline.sql — 운영 카탈로그에서 받은 실제 함수 · 트리거 · 정책 · 권한)을
 * PGlite 에 통째로 올린다. Supabase 가 새 프로젝트에 주는 것(auth 스키마 · 역할 · extensions.pgcrypto · realtime 발행)만 여기서 흉내 낸다.
 * pg_cron · vault · pg_stat_statements 는 PGlite 에 없어 그 줄만 건너뛴다(기준본의 «create extension» · «select cron.schedule»).
 * 파일 이름이 .local-test.cjs 가 아니라서 scripts/test-sql.cjs 가 직접 돌리지 않는다. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const mod=process.env.PGLITE_MODULE||require.resolve('@electric-sql/pglite');
const {PGlite}=require(mod);
const {pgcrypto}=require(path.join(path.dirname(mod),'contrib','pgcrypto.cjs'));
const read=name=>fs.readFileSync(path.join(__dirname,name),'utf8');
const PRELUDE=`
create schema auth; create schema extensions;
create extension pgcrypto with schema extensions;
create role anon nologin nosuperuser nobypassrls;
create role authenticated nologin nosuperuser nobypassrls;
create role service_role nologin nosuperuser bypassrls;
create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(), last_sign_in_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
create publication supabase_realtime;
grant usage on schema public, auth, extensions to anon, authenticated, service_role;
alter role anon set search_path = public, extensions;
alter role authenticated set search_path = public, extensions;
`;
function baselineSql(){
  return read('00000000_baseline.sql').split('\n').filter(l=>!/^create extension /.test(l)&&!/^select cron\.schedule\(/.test(l)).join('\n');
}
/* 운영과 같은 구조의 빈 DB. search_path 는 Supabase 처럼 public, extensions. */
async function open(){
  const db=new PGlite({extensions:{pgcrypto}});
  await db.exec(PRELUDE);
  await db.exec(baselineSql());
  await db.exec('set search_path = public, extensions');
  await db.exec("insert into public.ps_guard_mode(id,enforce) values(1,true) on conflict (id) do update set enforce=true");
  return db;
}
/* 한 요청 = 한 트랜잭션(PostgREST 와 같다). role: anon | authenticated | service_role. commit=false 면 끝에 되돌린다. */
async function as(db,role,uid,fn,{commit=true}={}){
  await db.exec('BEGIN');
  try{
    await db.query("select set_config('request.jwt.claim.sub',$1,true)",[uid||'']);
    await db.query("select set_config('request.jwt.claim.role',$1,true)",[role==='postgres'?'':role]);   // SQL 편집기(postgres)는 JWT 가 없다 — ps_1644_lineage_guard 가 이것으로 운영 우회를 가린다
    await db.exec(`SET LOCAL ROLE ${role}`);
    const r=await fn(db);
    await db.exec(commit?'COMMIT':'ROLLBACK');
    return r;
  }catch(e){await db.exec('ROLLBACK');throw e;}
}
/* 결과 행 또는 «거절 사유» 문자열 */
async function attempt(db,role,uid,sql,params,opt){
  try{return (await as(db,role,uid,d=>d.query(sql,params),opt)).rows;}
  catch(e){return 'ERR: '+e.message;}
}
const uuid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
async function user(db,n,email){const id=uuid(n);await db.query('insert into auth.users(id,email) values($1,$2) on conflict do nothing',[id,email||('u'+n+'@example.test')]);return id;}
module.exports={open,as,attempt,uuid,user,read,PGlite};
