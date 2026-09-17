-- Move existing ps_library media strings into ps_blob and leave psblob
-- references in ps_library.item. Applies only to large JSON string values that
-- contain inline image/SVG media, matching the client-side 2.727 wire format.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='10min';

DO $$
BEGIN
 IF to_regclass('public.ps_library') IS NULL OR to_regclass('public.ps_blob') IS NULL THEN
   RAISE EXCEPTION 'library blob backfill: ps_library and ps_blob are required' USING ERRCODE='55000';
 END IF;
 IF to_regprocedure('digest(bytea,text)') IS NULL
    AND to_regprocedure('public.digest(bytea,text)') IS NULL
    AND to_regprocedure('extensions.digest(bytea,text)') IS NULL THEN
   RAISE EXCEPTION 'library blob backfill: pgcrypto digest(bytea,text) is required' USING ERRCODE='55000';
 END IF;
 IF NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_library'::regclass AND attname='workspace_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_library'::regclass AND attname='lib_id' AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_library'::regclass AND attname='item' AND atttypid='jsonb'::regtype AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_blob'::regclass AND attname='workspace_id' AND atttypid='uuid'::regtype AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_blob'::regclass AND attname='h' AND atttypid='text'::regtype AND NOT attisdropped)
 OR NOT EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.ps_blob'::regclass AND attname='v' AND atttypid='text'::regtype AND NOT attisdropped) THEN
   RAISE EXCEPTION 'library blob backfill: reviewed column contract differs' USING ERRCODE='55000';
 END IF;
END $$;

CREATE TEMP TABLE ps_library_blob_stage(
  workspace_id uuid NOT NULL,
  h text NOT NULL,
  v text NOT NULL,
  PRIMARY KEY(workspace_id,h)
) ON COMMIT DROP;

CREATE OR REPLACE FUNCTION pg_temp.ps_library_blob_hash(p_value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,extensions AS $$
BEGIN
 RETURN substr(encode(digest(convert_to(p_value,'UTF8'),'sha256'),'hex'),1,24);
END $$;

CREATE OR REPLACE FUNCTION pg_temp.ps_library_blob_compact(p_workspace_id uuid,p_value jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,pg_temp AS $$
DECLARE
  kind text:=jsonb_typeof(p_value);
  s text;
  blob_hash text;
  out jsonb;
BEGIN
 IF kind='string' THEN
   s:=p_value #>> '{}';
   IF length(s) BETWEEN 512 AND 1900000
      AND (s LIKE 'data:image/%' OR s LIKE '%data:image/%' OR s LIKE '<svg%' OR s LIKE '%<svg%') THEN
     blob_hash:=pg_temp.ps_library_blob_hash(s);
     INSERT INTO ps_library_blob_stage(workspace_id,h,v)
     VALUES(p_workspace_id,blob_hash,s)
     ON CONFLICT(workspace_id,h) DO NOTHING;
     IF EXISTS(
       SELECT FROM ps_library_blob_stage b
       WHERE b.workspace_id=p_workspace_id AND b.h=blob_hash AND b.v IS DISTINCT FROM s
     ) THEN
       RAISE EXCEPTION 'library blob backfill: staged hash collision' USING ERRCODE='PT409';
     END IF;
     RETURN to_jsonb('psblob:'||blob_hash);
   END IF;
   RETURN p_value;
 ELSIF kind='array' THEN
   SELECT coalesce(jsonb_agg(pg_temp.ps_library_blob_compact(p_workspace_id,e.value) ORDER BY e.ordinality),'[]'::jsonb)
   INTO out
   FROM jsonb_array_elements(p_value) WITH ORDINALITY AS e(value,ordinality);
   RETURN out;
 ELSIF kind='object' THEN
   SELECT coalesce(jsonb_object_agg(e.key,pg_temp.ps_library_blob_compact(p_workspace_id,e.value)),'{}'::jsonb)
   INTO out
   FROM jsonb_each(p_value) AS e(key,value);
   RETURN out;
 END IF;
 RETURN p_value;
END $$;

CREATE TEMP TABLE ps_library_blob_rewrite ON COMMIT DROP AS
SELECT l.workspace_id,l.lib_id,l.item AS item_before,pg_temp.ps_library_blob_compact(l.workspace_id,l.item) AS item_after
FROM public.ps_library l
WHERE l.item::text LIKE '%"data:image/%'
  AND coalesce(l.deleted_at,0)=0
WITH NO DATA;

INSERT INTO ps_library_blob_rewrite(workspace_id,lib_id,item_before,item_after)
SELECT l.workspace_id,l.lib_id,l.item,pg_temp.ps_library_blob_compact(l.workspace_id,l.item)
FROM public.ps_library l
WHERE l.item::text LIKE '%"data:image/%'
  AND coalesce(l.deleted_at,0)=0;

DELETE FROM ps_library_blob_rewrite WHERE item_before IS NOT DISTINCT FROM item_after;

DO $$
BEGIN
 IF EXISTS(
   SELECT FROM ps_library_blob_stage s
   JOIN public.ps_blob b ON b.workspace_id=s.workspace_id AND b.h=s.h
   WHERE b.v IS DISTINCT FROM s.v
 ) THEN
   RAISE EXCEPTION 'library blob backfill: existing ps_blob hash collision' USING ERRCODE='PT409';
 END IF;
END $$;

INSERT INTO public.ps_blob(workspace_id,h,v)
SELECT workspace_id,h,v FROM ps_library_blob_stage
ON CONFLICT(workspace_id,h) DO NOTHING;

CREATE TEMP TABLE ps_library_blob_updated ON COMMIT DROP AS
SELECT workspace_id,lib_id FROM ps_library_blob_rewrite
WITH NO DATA;

WITH updated AS (
  UPDATE public.ps_library l
  SET item=r.item_after
  FROM ps_library_blob_rewrite r
  WHERE l.workspace_id=r.workspace_id
    AND l.lib_id=r.lib_id
    AND l.item IS NOT DISTINCT FROM r.item_before
  RETURNING l.workspace_id,l.lib_id
)
INSERT INTO ps_library_blob_updated(workspace_id,lib_id)
SELECT workspace_id,lib_id FROM updated;

DO $$
DECLARE
  planned integer;
  changed integer;
  blobs integer;
BEGIN
 SELECT count(*) INTO planned FROM ps_library_blob_rewrite;
 SELECT count(*) INTO changed FROM ps_library_blob_updated;
 SELECT count(*) INTO blobs FROM ps_library_blob_stage;
 RAISE NOTICE 'library blob backfill planned rows %, changed rows %, staged blobs %',planned,changed,blobs;
 IF changed<>planned THEN
   RAISE EXCEPTION 'library blob backfill: concurrent ps_library change detected' USING ERRCODE='40001';
 END IF;
END $$;

SELECT jsonb_build_object(
  'changed_rows',(SELECT count(*) FROM ps_library_blob_rewrite),
  'stored_blobs',(SELECT count(*) FROM ps_library_blob_stage),
  'remaining_inline_rows',(SELECT count(*) FROM public.ps_library WHERE item::text LIKE '%"data:image/%' AND coalesce(deleted_at,0)=0),
  'ps_blob_total_rows',(SELECT count(*) FROM public.ps_blob)
) AS library_blob_backfill_result;

COMMIT;
