-- Prepared for explicitly approved live verification; never run automatically.
-- Fresh UUIDs only. No auth.users, real teams, policy/grant/trigger changes.
-- Uses reviewed DB-only trigger chains; all fixture/audit rows ROLLBACK.
-- Sequence-generated audit IDs may consume numbers even after rollback.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $combined_guard$
DECLARE
  original_role text:=current_user;
  app_role text; operation text; wid uuid; owner_uid uuid; actor_uid uuid;
  claims text; permissions jsonb; initial_doc jsonb; edited_doc jsonb;
  old_raw text; edited_raw text; legacy_raw text; actual_raw text;
  notice_before text:='{"v":1,"items":[],"_ps_guard_probe":"before"}';
  notice_after text:='{"v":1,"items":[],"_ps_guard_probe":"after"}';
  actual_notice text; expected_notice text; stamp bigint; step integer;
  actual_cupd bigint; notice_cupd bigint; expected_notice_cupd bigint;
  affected bigint; error_code text; error_message text; results jsonb:='[]'::jsonb;
BEGIN
  IF current_user='authenticated' OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_roles r ON r.rolname=current_user
    WHERE c.oid='public.ps_kv'::regclass
      AND (r.rolsuper OR r.rolbypassrls OR (c.relowner=r.oid AND NOT c.relforcerowsecurity))) THEN
    RAISE EXCEPTION 'guard fixture requires a reviewed database administrator connection';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid='public.ps_kv'::regclass AND relrowsecurity)
    OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname='authenticated'
      AND NOT r.rolsuper AND NOT r.rolbypassrls
      AND r.oid<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.ps_kv'::regclass)) THEN
    RAISE EXCEPTION 'authenticated must be a non-owner role subject to RLS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger WHERE tgrelid='public.ps_kv'::regclass
    AND tgname='zzzz_ps_scout_registry_guard_v1' AND tgenabled='O'
    AND tgfoid='public.ps_scout_registry_guard_v1()'::regprocedure) THEN
    RAISE EXCEPTION 'candidate content guard is not installed/enabled';
  END IF;
  FOREACH app_role IN ARRAY ARRAY['admin','executive'] LOOP
    wid:=gen_random_uuid(); owner_uid:=gen_random_uuid(); actor_uid:=gen_random_uuid();
    IF EXISTS (SELECT 1 FROM public.ps_workspaces WHERE id=wid OR owner_id IN(owner_uid,actor_uid))
      OR EXISTS (SELECT 1 FROM public.ps_members WHERE user_id IN(owner_uid,actor_uid)) THEN
      RAISE EXCEPTION 'synthetic UUID collision; abort and generate a fresh transaction';
    END IF;
    claims:=jsonb_build_object('sub',owner_uid::text,'role','authenticated','aud','authenticated')::text;
    PERFORM set_config('request.jwt.claim.sub',owner_uid::text,true);
    PERFORM set_config('request.jwt.claim.role','authenticated',true);
    PERFORM set_config('request.jwt.claim',claims,true);
    PERFORM set_config('request.jwt.claims',claims,true);
    PERFORM set_config('request.headers','{"prefer":"ps-build=2.790"}',true);
    INSERT INTO public.ps_workspaces(id,name,kind,owner_id)
      VALUES(wid,'PS synthetic combined guard — rollback only','team',owner_uid);
    INSERT INTO public.ps_members(workspace_id,user_id,role,name) VALUES
      (wid,owner_uid,'owner','Synthetic owner'),(wid,actor_uid,'member','Synthetic actor');
    permissions:=jsonb_build_object('defaultRole','staff','members',jsonb_build_object(
      owner_uid::text,jsonb_build_object('role','admin'),actor_uid::text,jsonb_build_object('role',app_role)));
    stamp:=floor(extract(epoch FROM clock_timestamp())*1000)::bigint;
    INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES(wid,'cs_perms_v1',permissions::text,stamp);
    IF (SELECT v FROM public.ps_kv WHERE workspace_id=wid AND k='cs_perms_v1') IS DISTINCT FROM permissions::text THEN
      RAISE EXCEPTION 'synthetic permission seed rejected';
    END IF;
    initial_doc:='{"v":1,"players":[{"id":"placement","type":"target","dbId":"fixture","name":"Synthetic","club":"Before","profile":{},"memo":"Original observation"}],"scoutRegistry":{"v":1,"candidates":{"db:fixture":{"id":"db:fixture","info":{"name":"Synthetic","club":"Before","profile":{"photo":"synthetic-photo-reference"}},"points":{"q1":2},"ratings":{},"edits":{},"variants":[],"source":{"oneliner":"Before","obs":[{"text":"Original source"}]},"sourceHistory":[],"scoreHistory":[]}},"meta":{"pointSets":[{"id":"fixture-questions","sections":[{"name":"Section","qs":["Question"]}]}]},"metaHistory":[],"placementHistory":{}}}'::jsonb;
    edited_doc:=jsonb_set(initial_doc,'{players,0,club}','"After"');
    edited_doc:=jsonb_set(edited_doc,'{scoutRegistry,candidates,db:fixture,info,club}','"After"');
    edited_doc:=jsonb_set(edited_doc,'{scoutRegistry,candidates,db:fixture,variants}',
      '[{"field":"club","value":"Before","source":"Synthetic edit history"}]');
    edited_doc:=jsonb_set(edited_doc,'{scoutRegistry,candidates,db:fixture,points,q1}','5');
    edited_doc:=jsonb_set(edited_doc,'{scoutRegistry,candidates,db:fixture,scoreHistory}',
      '[{"kind":"points","key":"q1","value":2}]');
    edited_doc:=jsonb_set(edited_doc,'{scoutRegistry,candidates,db:fixture,source,oneliner}','"After"');
    edited_doc:=jsonb_set(edited_doc,'{scoutRegistry,candidates,db:fixture,sourceHistory}',
      jsonb_build_array(initial_doc#>'{scoutRegistry,candidates,db:fixture,source}'));
    edited_doc:=jsonb_set(edited_doc,'{scoutRegistry,candidates,db:fixture,edits}',
      jsonb_build_object('club',jsonb_build_object('at',stamp+1,'id','synthetic-club'),
        'points.q1',jsonb_build_object('at',stamp+1,'id','synthetic-score')));
    edited_doc:=jsonb_set(edited_doc,'{scoutRegistry,candidates,db:fixture,sourceEdit}',
      jsonb_build_object('at',stamp+1,'id','synthetic-source'));
    old_raw:=initial_doc::text; edited_raw:=edited_doc::text;
    legacy_raw:=(edited_doc-'scoutRegistry')::text;
    INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES
      (wid,'cs_scout_targets_v1',old_raw,stamp),(wid,'cs_team_notice_v1',notice_before,stamp);
    IF (SELECT v FROM public.ps_kv WHERE workspace_id=wid AND k='cs_scout_targets_v1') IS DISTINCT FROM old_raw
      OR (SELECT v FROM public.ps_kv WHERE workspace_id=wid AND k='cs_team_notice_v1') IS DISTINCT FROM notice_before THEN
      RAISE EXCEPTION 'synthetic candidate/notice seed rejected';
    END IF;
    step:=0;
    FOREACH operation IN ARRAY ARRAY['normal_update','legacy_update','legacy_upsert','mixed_upsert','separate_notice'] LOOP
      step:=step+1; affected:=0; error_code:=NULL; error_message:=NULL;
      claims:=jsonb_build_object('sub',actor_uid::text,'role','authenticated','aud','authenticated')::text;
      PERFORM set_config('request.jwt.claim.sub',actor_uid::text,true);
      PERFORM set_config('request.jwt.claim.role','authenticated',true);
      PERFORM set_config('request.jwt.claim',claims,true);
      PERFORM set_config('request.jwt.claims',claims,true);
      PERFORM set_config('request.headers','{"prefer":"ps-build=2.790"}',true);
      EXECUTE 'SET LOCAL ROLE authenticated';
      IF current_user<>'authenticated' OR auth.uid() IS DISTINCT FROM actor_uid
        OR auth.role() IS DISTINCT FROM 'authenticated' OR auth.jwt()->>'sub' IS DISTINCT FROM actor_uid::text
        OR public.ps_team_role(wid) IS DISTINCT FROM app_role THEN
        RAISE EXCEPTION 'authenticated/JWT/app role mismatch';
      END IF;
      BEGIN
        CASE operation
          WHEN 'normal_update' THEN UPDATE public.ps_kv SET v=edited_raw,cupd=stamp+step WHERE workspace_id=wid AND k='cs_scout_targets_v1';
          WHEN 'legacy_update' THEN UPDATE public.ps_kv SET v=legacy_raw,cupd=stamp+step WHERE workspace_id=wid AND k='cs_scout_targets_v1';
          WHEN 'legacy_upsert' THEN INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES(wid,'cs_scout_targets_v1',legacy_raw,stamp+step)
            ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v,cupd=excluded.cupd;
          WHEN 'mixed_upsert' THEN INSERT INTO public.ps_kv(workspace_id,k,v,cupd) VALUES
            (wid,'cs_team_notice_v1',notice_after,stamp+step),(wid,'cs_scout_targets_v1',legacy_raw,stamp+step)
            ON CONFLICT(workspace_id,k) DO UPDATE SET v=excluded.v,cupd=excluded.cupd;
          WHEN 'separate_notice' THEN UPDATE public.ps_kv SET v=notice_after,cupd=stamp+step WHERE workspace_id=wid AND k='cs_team_notice_v1';
        END CASE;
        GET DIAGNOSTICS affected=ROW_COUNT;
      EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS error_code=RETURNED_SQLSTATE,error_message=MESSAGE_TEXT;
      END;
      EXECUTE format('SET LOCAL ROLE %I',original_role);
      SELECT v,cupd INTO actual_raw,actual_cupd FROM public.ps_kv WHERE workspace_id=wid AND k='cs_scout_targets_v1';
      SELECT v,cupd INTO actual_notice,notice_cupd FROM public.ps_kv WHERE workspace_id=wid AND k='cs_team_notice_v1';
      IF operation IN('legacy_update','legacy_upsert','mixed_upsert') THEN
        IF error_code IS DISTINCT FROM '23514' OR error_message NOT LIKE 'ps_scout_registry_guard_v1:%' THEN
          RAISE EXCEPTION 'expected real candidate guard 23514: role %, operation %, got % / %',app_role,operation,error_code,error_message;
        END IF;
      ELSIF error_code IS NOT NULL OR affected<>1 THEN
        RAISE EXCEPTION 'positive control failed: role %, operation %, SQLSTATE %, affected %',app_role,operation,error_code,affected;
      END IF;
      expected_notice:=CASE WHEN operation='separate_notice' THEN notice_after ELSE notice_before END;
      expected_notice_cupd:=CASE WHEN operation='separate_notice' THEN stamp+step ELSE stamp END;
      IF actual_raw IS DISTINCT FROM edited_raw OR actual_cupd IS DISTINCT FROM stamp+1
        OR actual_notice IS DISTINCT FROM expected_notice OR notice_cupd IS DISTINCT FROM expected_notice_cupd THEN
        RAISE EXCEPTION 'exact document/cupd preservation failed: role %, operation %',app_role,operation;
      END IF;
      results:=results||jsonb_build_array(jsonb_build_object('role',app_role,'operation',operation,
        'sqlstate',error_code,'guardReason',error_message,'candidateExact',true,'otherKeyExact',true,'passed',true));
    END LOOP;
  END LOOP;
  PERFORM set_config('ps_scout_guard.results',results::text,true);
EXCEPTION WHEN OTHERS THEN EXECUTE format('SET LOCAL ROLE %I',original_role); RAISE;
END
$combined_guard$;
SELECT value AS combined_guard_result FROM jsonb_array_elements(current_setting('ps_scout_guard.results')::jsonb);
ROLLBACK;
