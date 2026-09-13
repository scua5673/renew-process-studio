-- OPERATIONAL SYNTHETIC TRANSACTION, PREPARED BUT NOT RUN ON THE LIVE SERVER.
-- Run only after explicit approval + catalog/trigger-call-chain review.
-- No auth.users creation, real team/user IDs, policy/grant changes, or trigger
-- disabling. Creates random workspaces/members/perms in this transaction only.
-- Existing DB-only audit/history/ping/denial writes roll back with this test.
-- Sequence-generated IDs, if present in audit tables, can still consume numbers.
-- All operational DELETE/UPDATE statements have synthetic workspace + key filters.
-- Consequently scoped DELETE does NOT prove the separate blind/unfiltered DELETE
-- case; that exact case is exercised only by local-test.cjs in an empty local DB.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $synthetic_rls$
DECLARE
  original_role text := current_user;
  spec jsonb;
  wid uuid;
  owner_uid uuid;
  actor_uid uuid;
  claims text;
  key_name text;
  permission_doc jsonb;
  initial_value text;
  attempted_value text;
  actual_value text;
  initial_cupd bigint;
  error_code text;
  error_category text;
  affected bigint;
  changed boolean;
  expected_allowed boolean;
  can_read boolean;
  can_write boolean;
  role_name text;
  results jsonb := '[]'::jsonb;
  case_index integer := 0;
BEGIN
  IF current_user='authenticated'
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.rolname=current_user
       WHERE c.oid='public.ps_kv'::regclass
         AND (r.rolsuper OR r.rolbypassrls OR (c.relowner=r.oid AND NOT c.relforcerowsecurity))) THEN
    RAISE EXCEPTION 'synthetic fixture setup needs a reviewed database administrator connection';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.ps_kv'::regclass AND relrowsecurity)
     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='authenticated'
       AND NOT r.rolsuper AND NOT r.rolbypassrls
       AND r.oid<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.ps_kv'::regclass)) THEN
    RAISE EXCEPTION 'authenticated must be a non-owner role subject to RLS';
  END IF;
  -- Positive controls first. Each operation has its own newly generated team.
  FOR spec IN SELECT value FROM jsonb_array_elements('[
    {"role":"admin","operation":"insert"},
    {"role":"executive","operation":"update"},
    {"role":"executive","operation":"upsert"},
    {"role":"executive","operation":"delete"},
    {"role":"staff","operation":"insert"},
    {"role":"player","operation":"insert","scopes":["scout"]},
    {"role":"player","operation":"insert"},
    {"role":"outsider","operation":"insert"},
    {"role":"staff","operation":"update"},
    {"role":"staff","operation":"upsert"},
    {"role":"staff","operation":"delete"},
    {"role":"staff","operation":"insert","otherKey":true},
    {"role":"staff","operation":"update","otherKey":true},
    {"role":"staff","operation":"upsert","otherKey":true},
    {"role":"staff","operation":"delete","otherKey":true}
  ]'::jsonb) LOOP
    case_index:=case_index+1;
    wid:=gen_random_uuid(); owner_uid:=gen_random_uuid(); actor_uid:=gen_random_uuid();
    -- Abort rather than ever reuse a generated identity that already has a team.
    IF EXISTS (SELECT 1 FROM public.ps_workspaces WHERE id=wid OR owner_id IN (owner_uid,actor_uid))
       OR EXISTS (SELECT 1 FROM public.ps_members WHERE user_id IN (owner_uid,actor_uid)) THEN
      RAISE EXCEPTION 'synthetic identity collision; regenerate in a fresh transaction';
    END IF;
    role_name:=spec->>'role';
    key_name:=CASE WHEN coalesce((spec->>'otherKey')::boolean,false) THEN 'cs_team_notice_v1' ELSE 'cs_scout_targets_v1' END;
    claims:=jsonb_build_object('sub',owner_uid::text,'role','authenticated','aud','authenticated')::text;
    PERFORM set_config('request.jwt.claim.sub',owner_uid::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claim',claims,true);
    PERFORM set_config('request.jwt.claims',claims,true);
    PERFORM set_config('request.headers','{"prefer":"ps-build=2.790"}',true);
    INSERT INTO public.ps_workspaces(id,name,kind,owner_id)
      VALUES (wid,'PS synthetic scout RLS — rollback only','team',owner_uid);
    INSERT INTO public.ps_members(workspace_id,user_id,role,name)
      VALUES (wid,owner_uid,'owner','Synthetic owner');
    IF role_name<>'outsider' THEN
      INSERT INTO public.ps_members(workspace_id,user_id,role,name)
        VALUES (wid,actor_uid,'member','Synthetic actor');
    END IF;
    permission_doc:=jsonb_build_object('defaultRole','staff','members',jsonb_build_object(
      owner_uid::text,jsonb_build_object('role','admin'),
      actor_uid::text,jsonb_build_object('role',CASE WHEN role_name='outsider' THEN 'staff' ELSE role_name END)
        || CASE WHEN spec ? 'scopes' THEN jsonb_build_object('scopes',spec->'scopes') ELSE '{}'::jsonb END));
    initial_cupd:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint+case_index;
    INSERT INTO public.ps_kv(workspace_id,k,v,cupd)
      VALUES (wid,'cs_perms_v1',permission_doc::text,initial_cupd);
    IF (SELECT v FROM public.ps_kv WHERE workspace_id=wid AND k='cs_perms_v1') IS DISTINCT FROM permission_doc::text THEN
      RAISE EXCEPTION 'synthetic permission seed rejected; do not interpret later cases as RLS results';
    END IF;
    IF key_name='cs_scout_targets_v1' THEN
      initial_value:='{"v":1,"players":[],"scoutRegistry":{"v":1,"candidates":{},"meta":{},"metaHistory":[],"placementHistory":{}},"_ps_rls_probe":"before"}';
    ELSE initial_value:='{"v":1,"items":[],"_ps_rls_probe":"before"}'; END IF;
    attempted_value:=replace(initial_value,'"before"','"after"');
    IF spec->>'operation'<>'insert' THEN
      INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES(wid,key_name,initial_value,initial_cupd);
      IF (SELECT v FROM public.ps_kv WHERE workspace_id=wid AND k=key_name) IS DISTINCT FROM initial_value THEN
        RAISE EXCEPTION 'synthetic target seed rejected';
      END IF;
    END IF;
    claims:=jsonb_build_object('sub',actor_uid::text,'role','authenticated','aud','authenticated')::text;
    PERFORM set_config('request.jwt.claim.sub',actor_uid::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claim',claims,true);
    PERFORM set_config('request.jwt.claims',claims,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    IF current_user<>'authenticated' OR auth.uid() IS DISTINCT FROM actor_uid
       OR auth.role() IS DISTINCT FROM 'authenticated'
       OR auth.jwt()->>'sub' IS DISTINCT FROM actor_uid::text THEN
      RAISE EXCEPTION 'synthetic authenticated role/JWT context mismatch';
    END IF;
    can_read:=public.ps_can_read_key(wid,key_name);
    can_write:=public.ps_can_write_key(wid,key_name);
    affected:=0; error_code:=NULL; error_category:=NULL;
    BEGIN
      CASE spec->>'operation'
        WHEN 'insert' THEN
          -- No RETURNING: a hidden row may be writable even when unreadable.
          INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES(wid,key_name,attempted_value,initial_cupd+1);
        WHEN 'update' THEN
          UPDATE public.ps_kv SET v=attempted_value,cupd=initial_cupd+1 WHERE workspace_id=wid AND k=key_name;
        WHEN 'upsert' THEN
          INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES(wid,key_name,attempted_value,initial_cupd+1)
          ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v,cupd=excluded.cupd;
        WHEN 'delete' THEN
          DELETE FROM public.ps_kv WHERE workspace_id=wid AND k=key_name;
      END CASE;
      GET DIAGNOSTICS affected=ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS error_code=RETURNED_SQLSTATE;
      error_category:=CASE
        WHEN error_code='42501' AND SQLERRM ILIKE '%row-level security%' THEN 'RLS_REJECTED'
        WHEN error_code='42501' THEN 'OTHER_AUTHORIZATION_ERROR'
        WHEN error_code='23514' THEN 'CONTENT_OR_CHECK_GUARD'
        ELSE 'SETUP_OR_OTHER_ERROR' END;
    END;
    EXECUTE format('SET LOCAL ROLE %I',original_role);
    IF current_user IS DISTINCT FROM original_role THEN RAISE EXCEPTION 'database administrator role was not restored'; END IF;
    SELECT v INTO actual_value FROM public.ps_kv WHERE workspace_id=wid AND k=key_name;
    changed:=CASE WHEN spec->>'operation'='delete' THEN actual_value IS NULL ELSE actual_value=attempted_value END;
    changed:=coalesce(changed,false);
    expected_allowed:=role_name IN ('admin','executive') OR key_name='cs_team_notice_v1';
    results:=results||jsonb_build_array(jsonb_build_object(
      'case',case_index,'role',role_name,'scopes',spec->'scopes','operation',spec->>'operation',
      'key',key_name,'readHelper',can_read,'writeHelper',can_write,'expectedAllowed',expected_allowed,
      'affected',affected,'storedChange',changed,'sqlstate',error_code,
      'outcome',coalesce(error_category,CASE WHEN changed THEN 'WRITE_ALLOWED'
        WHEN affected=0 THEN 'SCOPED_FILTERED_OR_TRIGGER_SKIPPED' ELSE 'TRIGGER_REFUSED' END),
      'matchesExpected',CASE WHEN expected_allowed THEN changed
        ELSE NOT changed AND (error_category='RLS_REJECTED'
          OR (error_code IS NULL AND affected=0 AND NOT can_read AND spec->>'operation' IN ('update','delete'))) END));
    -- A positive-control failure makes denial results uninterpretable. Stop
    -- atomically; never call a FK/shape/build failure an authorization success.
    IF expected_allowed AND NOT changed THEN
      RAISE EXCEPTION 'synthetic positive control failed at case %, SQLSTATE %, category %',case_index,error_code,error_category;
    END IF;
  END LOOP;
  PERFORM set_config('ps_scout_rls.results',results::text,true);
EXCEPTION WHEN OTHERS THEN
  EXECUTE format('SET LOCAL ROLE %I',original_role);
  RAISE;
END
$synthetic_rls$;

SELECT value AS synthetic_result
FROM jsonb_array_elements(current_setting('ps_scout_rls.results')::jsonb);
-- Verify caller-judged result rows above, not merely a successful SQL response.
ROLLBACK;
