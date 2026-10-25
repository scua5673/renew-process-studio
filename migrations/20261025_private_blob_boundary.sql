-- privacy-blob-boundary. Forward-only privacy boundary; original documents and
-- blobs are never rewritten or deleted. Apply library_recovery first.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='2min';
DO $$
BEGIN
 IF to_regclass('public.ps_library_history') IS NULL THEN RAISE EXCEPTION 'Apply 20261025_library_recovery first' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT FROM pg_roles WHERE rolname='ps_blob_reader_v1')
 OR to_regclass('public.ps_blob_refs_v1') IS NOT NULL
 OR to_regprocedure('public.ps_blob_assert_refs_v1(uuid,jsonb,jsonb)') IS NOT NULL THEN
   RAISE EXCEPTION 'Blob boundary objects already exist; verify instead of overwriting' USING ERRCODE='55000';
 END IF;
 IF NOT EXISTS(SELECT FROM pg_policy WHERE polrelid='public.ps_blob'::regclass AND polname='ps_blob_sel'
   AND polpermissive AND polcmd='r' AND pg_get_expr(polqual,polrelid)='ps_is_member(workspace_id)') THEN
   RAISE EXCEPTION 'Reviewed blob SELECT policy differs' USING ERRCODE='55000';
 END IF;
 IF EXISTS(SELECT FROM pg_class WHERE oid IN ('public.ps_blob'::regclass,'public.ps_kv'::regclass,'public.ps_library'::regclass,'public.ps_library_history'::regclass) AND NOT relrowsecurity) THEN
   RAISE EXCEPTION 'Source RLS must be enabled' USING ERRCODE='55000';
 END IF;
END $$;
LOCK TABLE public.ps_blob,public.ps_kv,public.ps_library,public.ps_kv_history,public.ps_library_history IN SHARE ROW EXCLUSIVE MODE;

-- A non-login, non-owner reader makes RLS apply even when an archive RPC calls
-- the validator from SECURITY DEFINER. Never grant this role to authenticated.
CREATE ROLE ps_blob_reader_v1 NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS;
GRANT authenticated TO ps_blob_reader_v1;
GRANT USAGE ON SCHEMA public,auth TO ps_blob_reader_v1;
COMMENT ON ROLE ps_blob_reader_v1 IS 'privacy-blob-boundary/20261025/v1';

CREATE TABLE public.ps_blob_refs_v1(
 workspace_id uuid NOT NULL REFERENCES public.ps_workspaces(id) ON DELETE CASCADE,
 h text NOT NULL,source_kind text NOT NULL CHECK(source_kind IN ('kv','library','kv_history','library_history')),
 source_key text NOT NULL,PRIMARY KEY(workspace_id,h,source_kind,source_key)
);
CREATE INDEX ps_blob_refs_source_v1 ON public.ps_blob_refs_v1(source_kind,workspace_id,source_key);
ALTER TABLE public.ps_blob_refs_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ps_blob_refs_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.ps_blob_refs_v1 TO authenticated;
COMMENT ON TABLE public.ps_blob_refs_v1 IS 'privacy-blob-boundary/20261025/v1; derived references, never content';
CREATE TABLE public.ps_blob_upload_proof_v1(
 workspace_id uuid NOT NULL,user_id uuid NOT NULL,h text NOT NULL,content_digest bytea NOT NULL,at timestamptz NOT NULL DEFAULT statement_timestamp(),
 PRIMARY KEY(workspace_id,user_id,h),
 FOREIGN KEY(workspace_id,user_id) REFERENCES public.ps_members(workspace_id,user_id) ON DELETE CASCADE
);
CREATE INDEX ps_blob_upload_proof_at_v1 ON public.ps_blob_upload_proof_v1(at);
ALTER TABLE public.ps_blob_upload_proof_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ps_blob_upload_proof_v1 FROM PUBLIC,anon,authenticated;
COMMENT ON TABLE public.ps_blob_upload_proof_v1 IS 'privacy-blob-boundary/20261025/v1; expires after 30 minutes; no image bytes';

CREATE FUNCTION public.ps_blob_refs_json_v1(doc jsonb) RETURNS SETOF text
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 WITH RECURSIVE nodes(v,k) AS (
   SELECT doc,NULL::text
   UNION ALL
   SELECT c.v,c.k FROM nodes n CROSS JOIN LATERAL(
     SELECT e.value AS v,e.key AS k FROM jsonb_each(CASE WHEN jsonb_typeof(n.v)='object' THEN n.v ELSE '{}'::jsonb END) e
     UNION ALL
     SELECT a.value,NULL::text FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.v)='array' THEN n.v ELSE '[]'::jsonb END) a
   ) c
 ) SELECT DISTINCT CASE WHEN (v#>>'{}') LIKE 'psblob:%' THEN substr(v#>>'{}',8) ELSE v#>>'{}' END
 FROM nodes WHERE jsonb_typeof(v)='string' AND (
   (v#>>'{}') ~ '^psblob:[0-9a-f]{16,64}$' OR (k IN ('thumbRef','emblemRef') AND (v#>>'{}') ~ '^[0-9a-f]{16,64}$')
 );
$$;
CREATE FUNCTION public.ps_blob_refs_text_v1(doc text) RETURNS SETOF text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 RETURN QUERY SELECT * FROM public.ps_blob_refs_json_v1(doc::jsonb);
EXCEPTION WHEN invalid_text_representation THEN RETURN;
END $$;

CREATE FUNCTION public.ps_blob_source_allowed_v1(wid uuid,kind text,source text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 CASE kind
 WHEN 'kv' THEN RETURN EXISTS(SELECT FROM public.ps_kv d WHERE d.workspace_id=wid AND d.k=source);
 WHEN 'library' THEN RETURN EXISTS(SELECT FROM public.ps_library d WHERE d.workspace_id=wid AND d.lib_id=source);
 WHEN 'library_history' THEN RETURN EXISTS(SELECT FROM public.ps_library_history d WHERE d.workspace_id=wid AND d.id=source::bigint);
 WHEN 'kv_history' THEN
   BEGIN
     RETURN EXISTS(SELECT FROM public.ps_kv_history_get(wid,source::bigint));
   EXCEPTION WHEN raise_exception OR insufficient_privilege THEN RETURN false;
   END;
 ELSE RETURN false;
 END CASE;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN RETURN false;
END $$;
CREATE POLICY ps_blob_ref_source_v1 ON public.ps_blob_refs_v1 FOR SELECT TO authenticated
 USING(public.ps_blob_source_allowed_v1(workspace_id,source_kind,source_key));
CREATE FUNCTION public.ps_blob_can_read_v1(wid uuid,digest text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND public.ps_is_member(wid) AND EXISTS(
   SELECT FROM public.ps_blob_refs_v1 r WHERE r.workspace_id=wid AND r.h=digest
 );
$$;
-- Supabase postgres is CREATEROLE/BYPASSRLS, not a superuser. Ownership transfer
-- requires schema CREATE and, on PG16+, SET ROLE permission. Grant only inside
-- this transaction/DO block and restore the applying role's original membership.
DO $$
DECLARE modern boolean:=current_setting('server_version_num')::int>=160000;had boolean;
 applying text:=current_user;applying_oid oid;own_grant jsonb;
BEGIN
 SELECT oid INTO applying_oid FROM pg_roles WHERE rolname=applying;
 IF modern THEN
   EXECUTE 'SELECT to_jsonb(m) FROM pg_auth_members m WHERE roleid=''ps_blob_reader_v1''::regrole AND member=$1 AND grantor=$1' INTO own_grant USING applying_oid;
   had:=pg_has_role(current_user,'ps_blob_reader_v1','SET');
   IF NOT had THEN EXECUTE format('GRANT ps_blob_reader_v1 TO %I WITH ADMIN %s, INHERIT FALSE, SET TRUE',applying,coalesce(own_grant->>'admin_option','false'));END IF;
 ELSE
   had:=pg_has_role(current_user,'ps_blob_reader_v1','MEMBER');
   IF NOT had THEN EXECUTE format('GRANT ps_blob_reader_v1 TO %I',current_user);END IF;
 END IF;
 GRANT CREATE ON SCHEMA public TO ps_blob_reader_v1;
 ALTER FUNCTION public.ps_blob_can_read_v1(uuid,text) OWNER TO ps_blob_reader_v1;
 -- SET permission is enough for ALTER OWNER but not for ACL/COMMENT ownership.
 -- Execute those as the owner, without leaking INHERIT to the applying role.
 SET LOCAL ROLE ps_blob_reader_v1;
 REVOKE ALL ON FUNCTION public.ps_blob_can_read_v1(uuid,text) FROM PUBLIC,anon;
 GRANT EXECUTE ON FUNCTION public.ps_blob_can_read_v1(uuid,text) TO authenticated;
 COMMENT ON FUNCTION public.ps_blob_can_read_v1(uuid,text) IS 'privacy-blob-boundary/20261025/v1; RLS reader, never superuser';
 EXECUTE format('SET LOCAL ROLE %I',applying);
 REVOKE CREATE ON SCHEMA public FROM ps_blob_reader_v1;
 IF NOT had THEN
   IF modern THEN
     IF own_grant IS NULL THEN EXECUTE format('REVOKE ps_blob_reader_v1 FROM %I GRANTED BY %I',applying,applying);
     ELSE EXECUTE format('GRANT ps_blob_reader_v1 TO %I WITH ADMIN %s, INHERIT %s, SET %s',applying,own_grant->>'admin_option',own_grant->>'inherit_option',own_grant->>'set_option');END IF;
   ELSE EXECUTE format('REVOKE ps_blob_reader_v1 FROM %I',applying);END IF;
 END IF;
 IF has_schema_privilege('ps_blob_reader_v1','public','CREATE') THEN RAISE EXCEPTION 'Reader must not retain schema CREATE' USING ERRCODE='55000';END IF;
END $$;
CREATE POLICY ps_blob_uploader_v1 ON public.ps_blob AS RESTRICTIVE FOR INSERT TO authenticated
 WITH CHECK(created_by=auth.uid());

CREATE FUNCTION public.ps_blob_stage_v1(wid uuid,digest text,body text,creator uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE me uuid:=auth.uid(); previous text;
BEGIN
 IF me IS NULL OR creator IS DISTINCT FROM me OR NOT public.ps_is_member(wid) THEN
   RAISE EXCEPTION 'blob_upload_owner_required' USING ERRCODE='42501';
 END IF;
 -- Serialize same-h uploads, including two first INSERTs, before inspecting bytes.
 PERFORM pg_advisory_xact_lock(hashtext(wid::text),hashtext(digest));
 SELECT b.v INTO previous FROM public.ps_blob b WHERE b.workspace_id=wid AND b.h=digest;
 IF FOUND AND previous IS DISTINCT FROM body THEN
   RAISE EXCEPTION 'blob_digest_content_mismatch' USING ERRCODE='PT409';
 END IF;
 DELETE FROM public.ps_blob_upload_proof_v1 p WHERE p.user_id=me AND p.at<statement_timestamp()-interval '30 minutes';
 INSERT INTO public.ps_blob_upload_proof_v1(workspace_id,user_id,h,content_digest) VALUES(wid,me,digest,sha256(convert_to(body,'UTF8')))
 ON CONFLICT(workspace_id,user_id,h) DO UPDATE SET at=statement_timestamp(),content_digest=excluded.content_digest;
END $$;
REVOKE ALL ON FUNCTION public.ps_blob_stage_v1(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.ps_blob_has_upload_v1(wid uuid,digest text,body text) RETURNS boolean
-- VOLATILE is required: INSERT RLS must see proof written by its BEFORE trigger.
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT auth.uid() IS NOT NULL AND public.ps_is_member(wid) AND EXISTS(
   SELECT FROM public.ps_blob_upload_proof_v1 p
   WHERE p.workspace_id=wid AND p.user_id=auth.uid() AND p.h=digest AND p.at>=statement_timestamp()-interval '30 minutes'
     AND p.content_digest=sha256(convert_to(body,'UTF8'))
 );
$$;
REVOKE ALL ON FUNCTION public.ps_blob_has_upload_v1(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ps_blob_has_upload_v1(uuid,text,text) TO authenticated;
CREATE FUNCTION public.ps_blob_has_upload_v1(wid uuid,digest text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
 SELECT EXISTS(SELECT FROM public.ps_blob b WHERE b.workspace_id=wid AND b.h=digest AND public.ps_blob_has_upload_v1(wid,digest,b.v));
$$;
REVOKE ALL ON FUNCTION public.ps_blob_has_upload_v1(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ps_blob_has_upload_v1(uuid,text) TO authenticated;
-- PostgreSQL also evaluates SELECT RLS during ON CONFLICT DO NOTHING. A short
-- proof of these exact bytes preserves old clients' upload-before-parent order.
CREATE POLICY ps_blob_parent_read_v1 ON public.ps_blob AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.ps_blob_can_read_v1(workspace_id,h) OR public.ps_blob_has_upload_v1(workspace_id,h,v));
CREATE FUNCTION public.ps_blob_assert_refs_v1(p_wid uuid,p_next jsonb,p_previous jsonb DEFAULT NULL) RETURNS void
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE digest text;
BEGIN
 FOR digest IN SELECT * FROM public.ps_blob_refs_json_v1(p_next) EXCEPT SELECT * FROM public.ps_blob_refs_json_v1(p_previous) LOOP
   IF NOT public.ps_blob_can_read_v1(p_wid,digest) AND NOT public.ps_blob_has_upload_v1(p_wid,digest) THEN
     RAISE EXCEPTION 'blob_reference_not_authorized' USING ERRCODE='42501';
   END IF;
 END LOOP;
END $$;

CREATE FUNCTION public.ps_blob_before_upload_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 -- A client without a JWT is still denied by existing blob INSERT RLS. This
 -- permits credential-free administrative backfills without inventing a user.
 IF auth.uid() IS NULL THEN RETURN NEW; END IF;
 PERFORM public.ps_blob_stage_v1(NEW.workspace_id,NEW.h,NEW.v,NEW.created_by);RETURN NEW;
END $$;
CREATE TRIGGER ps_blob_stage_before_insert_v1 BEFORE INSERT ON public.ps_blob FOR EACH ROW EXECUTE FUNCTION public.ps_blob_before_upload_v1();
CREATE FUNCTION public.ps_blob_before_source_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE next_doc jsonb;previous_doc jsonb;
BEGIN
 IF auth.uid() IS NULL AND EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND(rolsuper OR rolbypassrls)) THEN RETURN NEW; END IF;
 IF TG_TABLE_NAME='ps_kv' THEN
   BEGIN next_doc:=NEW.v::jsonb;EXCEPTION WHEN invalid_text_representation THEN RETURN NEW;END;
   IF TG_OP='UPDATE' AND OLD.workspace_id=NEW.workspace_id THEN BEGIN previous_doc:=OLD.v::jsonb;EXCEPTION WHEN invalid_text_representation THEN previous_doc:=NULL;END;END IF;
 ELSE
   next_doc:=NEW.item;
   IF TG_OP='UPDATE' AND OLD.workspace_id=NEW.workspace_id THEN previous_doc:=OLD.item;END IF;
 END IF;
 PERFORM public.ps_blob_assert_refs_v1(NEW.workspace_id,next_doc,previous_doc);RETURN NEW;
END $$;
CREATE TRIGGER ps_blob_refs_before_kv_v1 BEFORE INSERT OR UPDATE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.ps_blob_before_source_v1();
CREATE TRIGGER ps_blob_refs_before_library_v1 BEFORE INSERT OR UPDATE ON public.ps_library FOR EACH ROW EXECUTE FUNCTION public.ps_blob_before_source_v1();

CREATE FUNCTION public.ps_blob_index_source_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE kind text:=TG_ARGV[0];wid uuid;source text;doc jsonb;old_wid uuid;old_source text;
BEGIN
 IF TG_OP<>'INSERT' THEN
   IF kind='kv' THEN old_wid:=OLD.workspace_id;old_source:=OLD.k;
   ELSIF kind='library' THEN old_wid:=OLD.workspace_id;old_source:=OLD.lib_id;
   ELSE BEGIN old_wid:=OLD.workspace_id::uuid;EXCEPTION WHEN invalid_text_representation THEN old_wid:=NULL;END;old_source:=OLD.id::text;END IF;
   DELETE FROM public.ps_blob_refs_v1 r WHERE r.workspace_id=old_wid AND r.source_kind=kind AND r.source_key=old_source;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;
 IF kind='kv' THEN wid:=NEW.workspace_id;source:=NEW.k;BEGIN doc:=NEW.v::jsonb;EXCEPTION WHEN invalid_text_representation THEN doc:=NULL;END;
 ELSIF kind='library' THEN wid:=NEW.workspace_id;source:=NEW.lib_id;doc:=NEW.item;
 ELSIF kind='kv_history' THEN
   BEGIN wid:=NEW.workspace_id::uuid;EXCEPTION WHEN invalid_text_representation THEN RETURN NEW;END;
   source:=NEW.id::text;BEGIN doc:=NEW.v::jsonb;EXCEPTION WHEN invalid_text_representation THEN doc:=NULL;END;
 ELSE wid:=NEW.workspace_id;source:=NEW.id::text;doc:=NEW.snapshot;END IF;
 IF EXISTS(SELECT FROM public.ps_workspaces w WHERE w.id=wid) THEN
   INSERT INTO public.ps_blob_refs_v1 SELECT wid,h,kind,source FROM public.ps_blob_refs_json_v1(doc) h ON CONFLICT DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ps_blob_refs_after_kv_v1 AFTER INSERT OR UPDATE OR DELETE ON public.ps_kv FOR EACH ROW EXECUTE FUNCTION public.ps_blob_index_source_v1('kv');
CREATE TRIGGER ps_blob_refs_after_library_v1 AFTER INSERT OR UPDATE OR DELETE ON public.ps_library FOR EACH ROW EXECUTE FUNCTION public.ps_blob_index_source_v1('library');
CREATE TRIGGER ps_blob_refs_after_history_v1 AFTER INSERT OR UPDATE OR DELETE ON public.ps_kv_history FOR EACH ROW EXECUTE FUNCTION public.ps_blob_index_source_v1('kv_history');
CREATE TRIGGER ps_blob_refs_after_library_history_v1 AFTER INSERT OR UPDATE OR DELETE ON public.ps_library_history FOR EACH ROW EXECUTE FUNCTION public.ps_blob_index_source_v1('library_history');

INSERT INTO public.ps_blob_refs_v1 SELECT d.workspace_id,h,'kv',d.k FROM public.ps_kv d CROSS JOIN LATERAL public.ps_blob_refs_text_v1(d.v) h;
INSERT INTO public.ps_blob_refs_v1 SELECT d.workspace_id,h,'library',d.lib_id FROM public.ps_library d CROSS JOIN LATERAL public.ps_blob_refs_json_v1(d.item) h;
INSERT INTO public.ps_blob_refs_v1 SELECT d.workspace_id::uuid,h,'kv_history',d.id::text FROM public.ps_kv_history d JOIN public.ps_workspaces w ON w.id::text=d.workspace_id CROSS JOIN LATERAL public.ps_blob_refs_text_v1(d.v) h;
INSERT INTO public.ps_blob_refs_v1 SELECT d.workspace_id,h,'library_history',d.id::text FROM public.ps_library_history d JOIN public.ps_workspaces w ON w.id=d.workspace_id CROSS JOIN LATERAL public.ps_blob_refs_json_v1(d.snapshot) h;
REVOKE ALL ON FUNCTION public.ps_blob_before_upload_v1(),public.ps_blob_before_source_v1(),public.ps_blob_index_source_v1() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ps_blob_refs_json_v1(jsonb),public.ps_blob_refs_text_v1(text),public.ps_blob_source_allowed_v1(uuid,text,text),public.ps_blob_assert_refs_v1(uuid,jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.ps_blob_refs_json_v1(jsonb),public.ps_blob_refs_text_v1(text),public.ps_blob_source_allowed_v1(uuid,text,text),public.ps_blob_assert_refs_v1(uuid,jsonb,jsonb) FROM PUBLIC,anon;
DO $$ BEGIN
 IF to_regprocedure('cron.schedule(text,text,text)') IS NOT NULL THEN
   EXECUTE $cron$SELECT cron.schedule('ps-blob-upload-proof-trim','20 * * * *','delete from public.ps_blob_upload_proof_v1 where at < now() - interval ''30 minutes'';')$cron$;
 END IF;
END $$;
COMMIT;
