-- READ ONLY. 운영 데이터베이스의 «우리가 만든 구조»를 다시 만들 수 있는 DDL 텍스트 한 칸(ddl)으로 돌려준다.
-- 행 값(팀·선수 자료)·비밀값은 읽지 않는다. 카탈로그만 읽는다.
-- 담는 것: 우리 스키마(public + Supabase/시스템이 아닌 스키마)의 확장·enum·시퀀스·표·제약·함수·뷰·색인·
--          트리거(우리 함수를 부르는 auth 트리거 포함)·RLS·정책·표/함수 권한·realtime 발행 표.
--          pg_cron 작업은 cron 스키마가 없는 DB 에서 이 쿼리가 깨지지 않게 scripts/schema-baseline.mjs 가 따로 묻는다.
-- 안 담는 것(맨 끝 «안 담긴 것» 주석에 개수로 남는다): 데이터, auth/storage 설정, 도메인·복합 타입·집계 함수,
--          열 단위 권한, 타입 주석, 일반 스키마 권한·소유자. 예외: 사진 RLS 전용 managed reader 역할·함수 소유자는 보존한다.
--          갱신·복원 절차는 00000000_baseline.runbook.md.
with
ours as (
  select n.oid, n.nspname from pg_namespace n
  where n.nspname !~ '^pg_' and n.nspname <> 'information_schema'
    and n.nspname not in ('auth','storage','realtime','_realtime','extensions','graphql','graphql_public','pgbouncer',
      'pgsodium','pgsodium_masks','supabase_functions','supabase_migrations','vault','net','cron','_analytics','tiger','topology')
    and not exists (select 1 from pg_depend d where d.classid='pg_namespace'::regclass and d.objid=n.oid and d.deptype='e')
),
ext_member as (select d.classid, d.objid from pg_depend d where d.deptype='e'),
rels as (
  select c.oid, c.relname, c.relkind, c.relrowsecurity, c.relforcerowsecurity, c.relacl, c.relowner, c.reloptions, o.nspname
  from pg_class c join ours o on o.oid=c.relnamespace
  where c.relkind in ('r','p','v','m','S') and not c.relispartition
    and not exists (select 1 from ext_member e where e.classid='pg_class'::regclass and e.objid=c.oid)
),
fns as (
  select p.oid, p.proname, p.prokind, p.proacl, p.proowner, o.nspname,
    format('%I.%I(%s)', o.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) sig
  from pg_proc p join ours o on o.oid=p.pronamespace
  where not exists (select 1 from ext_member e where e.classid='pg_proc'::regclass and e.objid=p.oid)
),
grantees as (
  select 0::oid oid, 'public'::text nm
  union all select r.oid, quote_ident(r.rolname) from pg_roles r where r.rolname in ('anon','authenticated','service_role')
),
managed_reader as (select r.* from pg_roles r where r.rolname='ps_blob_reader_v1'),
managed_state as (
 select
  exists(select from managed_reader) or exists(select from fns where nspname='public' and proname='ps_blob_can_read_v1') needed,
  not exists(select from managed_reader) or exists(select from managed_reader r where
   r.rolcanlogin or r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolreplication or not r.rolinherit
   or not exists(select from pg_auth_members m join pg_roles a on a.oid=m.roleid where m.member=r.oid and a.rolname='authenticated' and not m.admin_option)
   or not pg_has_role(r.oid,'authenticated','USAGE')
   or exists(select from pg_auth_members m join pg_roles a on a.oid=m.roleid where m.member=r.oid and (a.rolname<>'authenticated' or m.admin_option))
   or exists(select from pg_auth_members m join pg_roles a on a.oid=m.member where m.roleid=r.oid and not(a.rolsuper or(a.rolbypassrls and a.rolcreaterole)))
   or exists(select from pg_roles a where a.oid<>r.oid and a.rolname<>'authenticated' and pg_has_role(r.oid,a.oid,'MEMBER'))
   or exists(select from pg_namespace n where n.nspname !~ '^pg_' and n.nspname<>'information_schema' and has_schema_privilege(r.oid,n.oid,'CREATE'))
   or exists(select from pg_database d where has_database_privilege(r.oid,d.oid,'CREATE'))
   or exists(select from rels c where pg_has_role(r.oid,c.relowner,'USAGE'))
   or exists(select from pg_namespace n where pg_has_role(r.oid,n.nspowner,'USAGE'))
   or not exists(select from fns f where f.oid=to_regprocedure('public.ps_blob_can_read_v1(uuid,text)') and f.proowner=r.oid)
  ) unsafe
),
managed_fn_acl as (
 select f.sig k1,0 k2,'' k3,format('REVOKE ALL ON %s %s FROM %s',case f.prokind when 'p' then 'PROCEDURE' else 'FUNCTION' end,f.sig,(select string_agg(nm,', ' order by nm) from grantees)) stmt
 from fns f join managed_reader r on r.oid=f.proowner where f.prokind in('f','p') and f.proacl is not null
 union all
 select f.sig,1,g.nm,format('GRANT EXECUTE ON %s %s TO %s',case f.prokind when 'p' then 'PROCEDURE' else 'FUNCTION' end,f.sig,g.nm)
 from fns f join managed_reader r on r.oid=f.proowner cross join lateral aclexplode(f.proacl) a join grantees g on g.oid=a.grantee
 where f.prokind in('f','p') and a.grantee<>f.proowner and a.privilege_type='EXECUTE'
),
managed_fn_comments as (
 select f.sig,format('COMMENT ON %s %s IS %L',case f.prokind when 'p' then 'PROCEDURE' else 'FUNCTION' end,f.sig,d.description) stmt
 from pg_description d join fns f on f.oid=d.objoid join managed_reader r on r.oid=f.proowner
 where d.classoid='pg_proc'::regclass and f.prokind in('f','p')
),
sec as (
  select 1 o, '-- 0. 함수 본문은 만들 때 검사하지 않는다(표·함수 순서와 무관하게 다시 만들 수 있게)' || E'\n' || 'set check_function_bodies = off;' t
  union all select 2, '-- 1. 스키마' || coalesce(E'\n' || (select string_agg(format('create schema if not exists %I;', nspname), E'\n' order by nspname) from ours where nspname<>'public'), '')
  union all select 3, '-- 1a. 사진 RLS managed reader(이 역할만, 일반 역할/비밀번호는 반출하지 않음)' || case when not needed then E'\n-- (없음)'
   when unsafe then E'\nDO $ps_blob_reader_restore$ BEGIN RAISE EXCEPTION ''Unsafe source ps_blob_reader_v1; baseline restore refused'' USING ERRCODE=''55000''; END $ps_blob_reader_restore$;'
   else E'\n' || $reader_ddl$DO $ps_blob_reader_restore$
DECLARE r pg_catalog.pg_roles%ROWTYPE;
BEGIN
 IF NOT EXISTS(SELECT FROM pg_catalog.pg_roles WHERE rolname='authenticated' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolcanlogin) THEN
  RAISE EXCEPTION 'A trusted Supabase authenticated role is required' USING ERRCODE='55000';
 END IF;
 SELECT * INTO r FROM pg_catalog.pg_roles WHERE rolname='ps_blob_reader_v1';
 IF NOT FOUND THEN
  CREATE ROLE ps_blob_reader_v1 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION INHERIT NOBYPASSRLS;
  SELECT * INTO r FROM pg_catalog.pg_roles WHERE rolname='ps_blob_reader_v1';
 END IF;
 IF r.rolcanlogin OR r.rolsuper OR r.rolbypassrls OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR NOT r.rolinherit
  OR EXISTS(SELECT FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles a ON a.oid=m.roleid WHERE m.member=r.oid AND(a.rolname<>'authenticated' OR m.admin_option))
  OR EXISTS(SELECT FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles a ON a.oid=m.member WHERE m.roleid=r.oid AND NOT(a.rolsuper OR(a.rolbypassrls AND a.rolcreaterole)))
  OR EXISTS(SELECT FROM pg_catalog.pg_roles a WHERE a.oid<>r.oid AND a.rolname<>'authenticated' AND pg_catalog.pg_has_role(r.oid,a.oid,'MEMBER'))
  OR EXISTS(SELECT FROM pg_catalog.pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE'))
  OR EXISTS(SELECT FROM pg_catalog.pg_database d WHERE pg_catalog.has_database_privilege(r.oid,d.oid,'CREATE'))
  OR EXISTS(SELECT FROM pg_catalog.pg_class c WHERE c.relkind IN('r','p','v','m','S') AND pg_catalog.pg_has_role(r.oid,c.relowner,'USAGE'))
  OR EXISTS(SELECT FROM pg_catalog.pg_namespace n WHERE pg_catalog.pg_has_role(r.oid,n.nspowner,'USAGE')) THEN
  RAISE EXCEPTION 'Unsafe destination ps_blob_reader_v1; baseline restore refused' USING ERRCODE='55000';
 END IF;
 GRANT authenticated TO ps_blob_reader_v1;
 GRANT USAGE ON SCHEMA public,auth TO ps_blob_reader_v1;
 IF NOT pg_catalog.pg_has_role(r.oid,'authenticated','USAGE')
  OR EXISTS(SELECT FROM pg_catalog.pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND pg_catalog.has_schema_privilege(r.oid,n.oid,'CREATE')) THEN
  RAISE EXCEPTION 'Reader must inherit authenticated without schema CREATE' USING ERRCODE='55000';
 END IF;
 COMMENT ON ROLE ps_blob_reader_v1 IS 'privacy-blob-boundary/20261025/v1';
END $ps_blob_reader_restore$;$reader_ddl$ end from managed_state
  union all select 4, '-- 2. 확장' || coalesce(E'\n' || (select string_agg(format('create extension if not exists %I with schema %I;', e.extname, n.nspname), E'\n' order by e.extname)
      from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname<>'plpgsql'), '')
  union all select 5, '-- 3. enum' || coalesce(E'\n' || (select string_agg(format('create type %I.%I as enum (%s);', o.nspname, t.typname,
        (select string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid)), E'\n' order by o.nspname, t.typname)
      from pg_type t join ours o on o.oid=t.typnamespace where t.typtype='e'
        and not exists (select 1 from ext_member e where e.classid='pg_type'::regclass and e.objid=t.oid)), '')
  union all select 6, '-- 4. 시퀀스(식별 열이 아닌 것)' || coalesce(E'\n' || (select string_agg(format('create sequence if not exists %I.%I;', r.nspname, r.relname), E'\n' order by r.nspname, r.relname)
      from rels r where r.relkind='S'
        and not exists (select 1 from pg_depend d where d.classid='pg_class'::regclass and d.objid=r.oid and d.deptype='i')), '')
  union all select 7, '-- 5. 표' || coalesce(E'\n' || (select string_agg(
        format('create table if not exists %I.%I (%s)%s;', r.nspname, r.relname,
          (select string_agg(
             format('%I %s', a.attname, format_type(a.atttypid, a.atttypmod))
             || case when a.attidentity='a' then ' generated always as identity'
                     when a.attidentity='d' then ' generated by default as identity'
                     when a.attgenerated='s' then ' generated always as (' || pg_get_expr(ad.adbin, ad.adrelid) || ') stored'
                     when ad.adbin is not null then ' default ' || pg_get_expr(ad.adbin, ad.adrelid) else '' end
             || case when a.attnotnull then ' not null' else '' end, ', ' order by a.attnum)
           from pg_attribute a left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
           where a.attrelid=r.oid and a.attnum>0 and not a.attisdropped),
          case when r.relkind='p' then ' partition by ' || pg_get_partkeydef(r.oid) else '' end),
        E'\n' order by r.nspname, r.relname) from rels r where r.relkind in ('r','p')), '')
  union all select 8, '-- 6. 제약(기본키·유일·검사 먼저, 외래키 나중)' || coalesce(E'\n' || (select string_agg(format('alter table %I.%I add constraint %I %s;', r.nspname, r.relname, c.conname, pg_get_constraintdef(c.oid)), E'\n'
        order by (c.contype='f'), r.nspname, r.relname, c.conname)
      from pg_constraint c join rels r on r.oid=c.conrelid where c.contype in ('p','u','c','x','f') and c.conislocal), '')
  union all select 9, '-- 7. 함수' || coalesce(E'\n' || (select string_agg(rtrim(pg_get_functiondef(f.oid), E'\n') || ';', E'\n\n' order by f.nspname, f.proname, f.sig)
      from fns f where f.prokind in ('f','p')), '')
  union all select 10, '-- 7a. 사진 RLS 함수 소유자(권한/주석보다 먼저, 임시 SET/CREATE는 이 DO 안에서 회수)' ||
    case when not exists(select from fns f join managed_reader r on r.oid=f.proowner where f.prokind in('f','p')) then E'\n-- (없음)'
    else E'\n' || $owner_start$DO $ps_blob_owner_restore$
DECLARE had_set boolean; prior_grant jsonb; restorer text:=current_user;modern boolean:=pg_catalog.current_setting('server_version_num')::int>=160000;
BEGIN
 IF modern THEN had_set:=pg_catalog.pg_has_role(current_user,'ps_blob_reader_v1','SET');
 ELSE had_set:=pg_catalog.pg_has_role(current_user,'ps_blob_reader_v1','MEMBER'); END IF;
 IF NOT had_set THEN
  IF modern THEN
   EXECUTE 'SELECT to_jsonb(m) FROM pg_catalog.pg_auth_members m WHERE m.roleid=$1 AND m.member=$2 AND m.grantor=$2'
    INTO prior_grant USING 'ps_blob_reader_v1'::regrole,current_user::regrole;
   EXECUTE pg_catalog.format('GRANT ps_blob_reader_v1 TO %I WITH INHERIT %s, SET TRUE GRANTED BY %I',restorer,CASE WHEN coalesce((prior_grant->>'inherit_option')::boolean,false) THEN 'TRUE' ELSE 'FALSE' END,restorer);
  ELSE EXECUTE pg_catalog.format('GRANT ps_blob_reader_v1 TO %I',restorer); END IF;
 END IF;
$owner_start$ ||
    (select string_agg(format(' EXECUTE %L;',format('GRANT CREATE ON SCHEMA %I TO ps_blob_reader_v1',nspname)),E'\n' order by nspname) from(select distinct f.nspname from fns f join managed_reader r on r.oid=f.proowner where f.prokind in('f','p')) n) || E'\n' ||
    (select string_agg(format(' EXECUTE %L;',format('ALTER %s %s OWNER TO ps_blob_reader_v1',case f.prokind when 'p' then 'PROCEDURE' else 'FUNCTION' end,f.sig)),E'\n' order by f.sig) from fns f join managed_reader r on r.oid=f.proowner where f.prokind in('f','p')) || E'\n' ||
    (select string_agg(format(' EXECUTE %L;',format('REVOKE CREATE ON SCHEMA %I FROM ps_blob_reader_v1',nspname)),E'\n' order by nspname) from(select distinct f.nspname from fns f join managed_reader r on r.oid=f.proowner where f.prokind in('f','p')) n) || E'\n EXECUTE ''SET LOCAL ROLE ps_blob_reader_v1'';\n' ||
    coalesce((select string_agg(format(' EXECUTE %L;',stmt),E'\n' order by k1,k2,k3) from managed_fn_acl),'') || E'\n' ||
    coalesce((select string_agg(format(' EXECUTE %L;',stmt),E'\n' order by sig) from managed_fn_comments),'') || E'\n' || $owner_end$
 EXECUTE pg_catalog.format('SET LOCAL ROLE %I',restorer);
 IF NOT had_set THEN
  IF modern AND prior_grant IS NOT NULL THEN
   EXECUTE pg_catalog.format('GRANT ps_blob_reader_v1 TO %I WITH ADMIN %s, INHERIT %s, SET %s GRANTED BY %I',restorer,
    CASE WHEN(prior_grant->>'admin_option')::boolean THEN 'TRUE' ELSE 'FALSE' END,
    CASE WHEN(prior_grant->>'inherit_option')::boolean THEN 'TRUE' ELSE 'FALSE' END,
    CASE WHEN(prior_grant->>'set_option')::boolean THEN 'TRUE' ELSE 'FALSE' END,restorer);
  ELSIF modern THEN EXECUTE pg_catalog.format('REVOKE ps_blob_reader_v1 FROM %I GRANTED BY %I',restorer,restorer);
  ELSE EXECUTE pg_catalog.format('REVOKE ps_blob_reader_v1 FROM %I',restorer); END IF;
 END IF;
 IF EXISTS(SELECT FROM pg_catalog.pg_namespace n WHERE n.nspname !~ '^pg_' AND n.nspname<>'information_schema' AND pg_catalog.has_schema_privilege('ps_blob_reader_v1',n.oid,'CREATE')) THEN
  RAISE EXCEPTION 'Reader schema CREATE remained after ownership restore' USING ERRCODE='55000';
 END IF;
END $ps_blob_owner_restore$;$owner_end$ end
  union all select 11, '-- 8. 뷰' || coalesce(E'\n' || (select string_agg(
        case when r.relkind='v' then format('create or replace view %I.%I%s as %s;', r.nspname, r.relname,
               case when r.reloptions is not null then ' with (' || array_to_string(r.reloptions, ', ') || ')' else '' end,
               rtrim(rtrim(pg_get_viewdef(r.oid), E'\n'), ';'))
             else format('create materialized view if not exists %I.%I as %s with no data;', r.nspname, r.relname, rtrim(rtrim(pg_get_viewdef(r.oid), E'\n'), ';')) end,
        E'\n\n' order by r.nspname, r.relname) from rels r where r.relkind in ('v','m')), '')
  union all select 12, '-- 9. 색인(제약이 만든 것 제외)' || coalesce(E'\n' || (select string_agg(pg_get_indexdef(i.indexrelid) || ';', E'\n' order by r.nspname, r.relname, ic.relname)
      from pg_index i join rels r on r.oid=i.indrelid join pg_class ic on ic.oid=i.indexrelid
      where not exists (select 1 from pg_constraint c where c.conindid=i.indexrelid and c.contype in ('p','u','x'))), '')
  union all select 13, '-- 10. 트리거' || coalesce(E'\n' || (select string_agg(pg_get_triggerdef(t.oid) || ';', E'\n' order by tn.nspname, tc.relname, t.tgname)
      from pg_trigger t join pg_class tc on tc.oid=t.tgrelid join pg_namespace tn on tn.oid=tc.relnamespace
      join pg_proc tp on tp.oid=t.tgfoid
      where not t.tgisinternal
        and (tc.oid in (select oid from rels) or tp.pronamespace in (select oid from ours))), '')
  union all select 14, '-- 11. 행 단위 보안' || coalesce(E'\n' || (select string_agg(
        format('alter table %I.%I enable row level security;', r.nspname, r.relname)
        || case when r.relforcerowsecurity then E'\n' || format('alter table %I.%I force row level security;', r.nspname, r.relname) else '' end,
        E'\n' order by r.nspname, r.relname) from rels r where r.relkind in ('r','p') and r.relrowsecurity), '')
  union all select 15, '-- 12. 정책' || coalesce(E'\n' || (select string_agg(
        format('create policy %I on %I.%I as %s for %s to %s%s%s;', p.polname, r.nspname, r.relname,
          case when p.polpermissive then 'permissive' else 'restrictive' end,
          case p.polcmd when 'r' then 'select' when 'a' then 'insert' when 'w' then 'update' when 'd' then 'delete' else 'all' end,
          (select string_agg(case when x=0 then 'public' else quote_ident(rr.rolname) end, ', ' order by case when x=0 then 'public' else rr.rolname::text end)
             from unnest(p.polroles) x left join pg_roles rr on rr.oid=x),
          case when p.polqual is not null then ' using (' || pg_get_expr(p.polqual, p.polrelid) || ')' else '' end,
          case when p.polwithcheck is not null then ' with check (' || pg_get_expr(p.polwithcheck, p.polrelid) || ')' else '' end),
        E'\n' order by r.nspname, r.relname, p.polname)
      from pg_policy p join rels r on r.oid=p.polrelid), '')
  union all select 16, '-- 13. 표 권한(public·anon·authenticated·service_role 만, 소유자 제외)' || coalesce(E'\n' || (select string_agg(stmt, E'\n' order by k1, k2, k3) from (
        select r.nspname || '.' || r.relname k1, 0 k2, '' k3,
          format('revoke all on table %I.%I from %s;', r.nspname, r.relname, (select string_agg(nm, ', ' order by nm) from grantees)) stmt
        from rels r where r.relkind in ('r','p','v','m') and r.relacl is not null
        union all
        select r.nspname || '.' || r.relname, 1, g.nm, format('grant %s on table %I.%I to %s;',
          string_agg(a.privilege_type, ', ' order by a.privilege_type), r.nspname, r.relname, g.nm)
        from rels r cross join lateral aclexplode(r.relacl) a join grantees g on g.oid=a.grantee
        where r.relkind in ('r','p','v','m') and a.grantee<>r.relowner
        group by r.nspname, r.relname, g.nm
      ) z), '')
  union all select 17, '-- 14. 함수 실행 권한(기본값과 다른 함수만)' || coalesce(E'\n' || (select string_agg(stmt, E'\n' order by k1, k2, k3) from (
        select f.sig k1, 0 k2, '' k3, format('revoke all on function %s from %s;', f.sig, (select string_agg(nm, ', ' order by nm) from grantees)) stmt
        from fns f where f.proacl is not null and not exists(select from managed_reader r where r.oid=f.proowner)
        union all
        select f.sig, 1, g.nm, format('grant execute on function %s to %s;', f.sig, g.nm)
        from fns f cross join lateral aclexplode(f.proacl) a join grantees g on g.oid=a.grantee
        where a.grantee<>f.proowner and a.privilege_type='EXECUTE' and not exists(select from managed_reader r where r.oid=f.proowner)
      ) z), '')
  union all select 18, '-- 15. realtime 발행 표' || coalesce(E'\n' || (select string_agg(format('alter publication %I add table %I.%I;', p.pubname, pn.nspname, pc.relname), E'\n' order by p.pubname, pn.nspname, pc.relname)
      from pg_publication p join pg_publication_rel pr on pr.prpubid=p.oid join pg_class pc on pc.oid=pr.prrelid join pg_namespace pn on pn.oid=pc.relnamespace
      where pc.oid in (select oid from rels)), '')
  union all select 19, '-- 16. 주석(표·뷰·시퀀스·열·함수·제약·정책·트리거)' || coalesce(E'\n' || (select string_agg(stmt, E'\n' order by stmt) from (
        select format('comment on %s %I.%I is %L;', case r.relkind when 'v' then 'view' when 'm' then 'materialized view' when 'S' then 'sequence' else 'table' end,
          r.nspname, r.relname, d.description) stmt
        from pg_description d join rels r on r.oid=d.objoid where d.classoid='pg_class'::regclass and d.objsubid=0
        union all
        select format('comment on column %I.%I.%I is %L;', r.nspname, r.relname, a.attname, d.description)
        from pg_description d join rels r on r.oid=d.objoid join pg_attribute a on a.attrelid=r.oid and a.attnum=d.objsubid
        where d.classoid='pg_class'::regclass and d.objsubid>0
        union all
        select format('comment on %s %s is %L;', case f.prokind when 'p' then 'procedure' else 'function' end, f.sig, d.description)
        from pg_description d join fns f on f.oid=d.objoid where d.classoid='pg_proc'::regclass and f.prokind in ('f','p') and not exists(select from managed_reader r where r.oid=f.proowner)
        union all
        select format('comment on constraint %I on %I.%I is %L;', c.conname, r.nspname, r.relname, d.description)
        from pg_description d join pg_constraint c on c.oid=d.objoid join rels r on r.oid=c.conrelid where d.classoid='pg_constraint'::regclass
        union all
        select format('comment on policy %I on %I.%I is %L;', pl.polname, r.nspname, r.relname, d.description)
        from pg_description d join pg_policy pl on pl.oid=d.objoid join rels r on r.oid=pl.polrelid where d.classoid='pg_policy'::regclass
        union all
        select format('comment on trigger %I on %I.%I is %L;', t.tgname, tn.nspname, tc.relname, d.description)
        from pg_description d join pg_trigger t on t.oid=d.objoid join pg_class tc on tc.oid=t.tgrelid join pg_namespace tn on tn.oid=tc.relnamespace
        where d.classoid='pg_trigger'::regclass and not t.tgisinternal
      ) z), '')
  union all select 20, '-- 17. 안 담긴 것(복원 뒤 손으로 확인)' || E'\n-- ' || concat_ws(' · ',
      'domain ' || (select count(*) from pg_type t join ours o on o.oid=t.typnamespace where t.typtype='d'),
      'composite ' || (select count(*) from pg_type t join ours o on o.oid=t.typnamespace join pg_class c on c.oid=t.typrelid where t.typtype='c' and c.relkind='c'),
      'aggregate/window ' || (select count(*) from fns where prokind in ('a','w')),
      'column-grant ' || (select count(*) from pg_attribute a join rels r on r.oid=a.attrelid where a.attacl is not null),
      'enum-comment ' || (select count(*) from pg_description d join pg_type t on t.oid=d.objoid join ours o on o.oid=t.typnamespace where d.classoid='pg_type'::regclass))
)
select string_agg(t, E'\n\n' order by o) as ddl from sec;
