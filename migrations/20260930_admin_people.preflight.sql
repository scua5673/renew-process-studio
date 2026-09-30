-- READ-ONLY preflight for 20260930_admin_people. Writes nothing.
-- 설치 전에 운영 DB 모양이 함수가 기대하는 것과 같은지, 무엇을 보여 주게 될지 숫자로만 확인한다.
SELECT
  -- 1) 함수가 기대는 도우미·열이 있는가
  to_regprocedure('auth.uid()') IS NOT NULL                                    AS has_auth_uid,
  to_regprocedure('public.ps_is_admin()') IS NOT NULL                          AS has_is_admin,
  to_regprocedure('public.ps_admin_people()') IS NULL                          AS name_free,
  (SELECT count(*) FROM pg_catalog.pg_attribute a
     WHERE NOT a.attisdropped AND (a.attrelid,a.attname,a.atttypid) IN (
       ('auth.users'::regclass,'raw_app_meta_data','jsonb'::regtype),
       ('auth.users'::regclass,'raw_user_meta_data','jsonb'::regtype),
       ('auth.users'::regclass,'last_sign_in_at','timestamptz'::regtype),
       ('public.ps_members'::regclass,'name','text'::regtype),
       ('public.ps_members'::regclass,'role','text'::regtype),
       ('public.ps_kv'::regclass,'v','text'::regtype),
       ('public.ps_library'::regclass,'owner_id','uuid'::regtype),
       ('public.ps_library'::regclass,'deleted_at','bigint'::regtype)))        AS columns_ok_of_8,
  -- 2) 무엇이 보이게 되나(숫자만 — 이름·이메일은 읽지 않는다)
  (SELECT count(*) FROM auth.users)                                            AS accounts,
  (SELECT count(*) FROM auth.users WHERE coalesce(btrim(email),'')='')         AS accounts_without_email,
  (SELECT count(*) FROM auth.users WHERE raw_app_meta_data->>'provider'='kakao') AS kakao_accounts,
  (SELECT count(*) FROM auth.users u WHERE coalesce(btrim(u.email),'')=''
     AND NOT EXISTS(SELECT FROM public.ps_members m WHERE m.user_id=u.id AND coalesce(btrim(m.name),'')<>'')
     AND coalesce(btrim(u.raw_user_meta_data->>'name'),btrim(u.raw_user_meta_data->>'full_name'),btrim(u.raw_user_meta_data->>'nickname'),'')='')
                                                                               AS no_email_no_name_today,
  (SELECT count(*) FROM public.ps_kv WHERE k='cs_perms_v1')                    AS perms_docs,
  (SELECT count(*) FROM public.ps_kv WHERE k='cs_perms_v1' AND left(btrim(v),1)<>'{') AS perms_docs_broken,
  (SELECT count(*) FROM public.ps_kv WHERE k LIKE 'sq:%')                      AS roster_item_rows,
  (SELECT pg_size_pretty(coalesce(sum(length(v)),0)) FROM public.ps_kv WHERE k='cs_perms_v1' OR k LIKE 'sq:%') AS bytes_read_per_call;
