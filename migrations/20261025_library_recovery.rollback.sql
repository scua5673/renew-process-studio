-- Recovery rollback disables entry points but deliberately preserves originals,
-- history and restored copies. Blob privacy remains installed independently.
BEGIN;
REVOKE EXECUTE ON FUNCTION public.ps_library_history_list_v1(uuid,integer),public.ps_library_history_get_v1(uuid,bigint),
 public.ps_library_archive_conflict_v1(uuid,text,jsonb),public.ps_library_restore_copy_v1(uuid,bigint,uuid) FROM authenticated;
-- Keep the capture trigger: rolling back the UI must not silently discard new originals.
COMMIT;
