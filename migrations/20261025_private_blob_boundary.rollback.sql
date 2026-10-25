-- Restores the prior membership-only blob read policy: private media can become
-- readable to teammates again. Prefer fixing forward. No source/blob bytes lost.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $$ BEGIN
 IF obj_description('public.ps_blob_can_read_v1(uuid,text)'::regprocedure,'pg_proc') IS DISTINCT FROM 'privacy-blob-boundary/20261025/v1; RLS reader, never superuser' THEN
  RAISE EXCEPTION 'Unknown blob boundary; refusing rollback' USING ERRCODE='55000';END IF;
 IF to_regprocedure('cron.unschedule(text)') IS NOT NULL THEN
  EXECUTE $cron$SELECT cron.unschedule('ps-blob-upload-proof-trim') WHERE EXISTS(SELECT FROM cron.job WHERE jobname='ps-blob-upload-proof-trim' AND command='delete from public.ps_blob_upload_proof_v1 where at < now() - interval ''30 minutes'';')$cron$;
 END IF;
END $$;
DROP POLICY ps_blob_parent_read_v1 ON public.ps_blob;
DROP POLICY ps_blob_uploader_v1 ON public.ps_blob;
DROP TRIGGER ps_blob_stage_before_insert_v1 ON public.ps_blob;
DROP TRIGGER ps_blob_refs_before_kv_v1 ON public.ps_kv;
DROP TRIGGER ps_blob_refs_before_library_v1 ON public.ps_library;
DROP TRIGGER ps_blob_refs_after_kv_v1 ON public.ps_kv;
DROP TRIGGER ps_blob_refs_after_library_v1 ON public.ps_library;
DROP TRIGGER ps_blob_refs_after_history_v1 ON public.ps_kv_history;
DROP TRIGGER ps_blob_refs_after_library_history_v1 ON public.ps_library_history;
DROP FUNCTION public.ps_blob_before_upload_v1(),public.ps_blob_before_source_v1(),public.ps_blob_index_source_v1();
DROP FUNCTION public.ps_blob_assert_refs_v1(uuid,jsonb,jsonb),public.ps_blob_has_upload_v1(uuid,text),public.ps_blob_has_upload_v1(uuid,text,text),public.ps_blob_stage_v1(uuid,text,text,uuid);
DO $$
DECLARE modern boolean:=current_setting('server_version_num')::int>=160000;had boolean;applying text:=current_user;applying_oid oid;own_grant jsonb;
BEGIN
 SELECT oid INTO applying_oid FROM pg_roles WHERE rolname=applying;
 IF modern THEN
  EXECUTE 'SELECT to_jsonb(m) FROM pg_auth_members m WHERE roleid=''ps_blob_reader_v1''::regrole AND member=$1 AND grantor=$1' INTO own_grant USING applying_oid;
  had:=pg_has_role(applying,'ps_blob_reader_v1','SET');
  IF NOT had THEN EXECUTE format('GRANT ps_blob_reader_v1 TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE',applying,coalesce(own_grant->>'admin_option','false'));END IF;
 ELSE
  had:=pg_has_role(applying,'ps_blob_reader_v1','MEMBER');
  IF NOT had THEN EXECUTE format('GRANT ps_blob_reader_v1 TO %I',applying);END IF;
 END IF;
 SET LOCAL ROLE ps_blob_reader_v1;
 DROP FUNCTION public.ps_blob_can_read_v1(uuid,text);
 EXECUTE format('SET LOCAL ROLE %I',applying);
 IF NOT had THEN
  IF modern THEN
   IF own_grant IS NULL THEN EXECUTE format('REVOKE ps_blob_reader_v1 FROM %I GRANTED BY %I',applying,applying);
   ELSE EXECUTE format('GRANT ps_blob_reader_v1 TO %I WITH ADMIN %s, INHERIT %s, SET %s',applying,own_grant->>'admin_option',own_grant->>'inherit_option',own_grant->>'set_option');END IF;
  ELSE EXECUTE format('REVOKE ps_blob_reader_v1 FROM %I',applying);END IF;
 END IF;
END $$;
DROP TABLE public.ps_blob_refs_v1,public.ps_blob_upload_proof_v1;
DROP FUNCTION public.ps_blob_source_allowed_v1(uuid,text,text),public.ps_blob_refs_text_v1(text),public.ps_blob_refs_json_v1(jsonb);
REVOKE USAGE ON SCHEMA public,auth FROM ps_blob_reader_v1;
REVOKE authenticated FROM ps_blob_reader_v1;
DROP ROLE ps_blob_reader_v1;
COMMIT;
