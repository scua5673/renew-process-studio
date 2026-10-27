select count(*)=46 as catalog_ready from public.ps_letter_issues;
select relname,relrowsecurity from pg_class where oid in ('public.ps_letter_issues'::regclass,'public.ps_letter_readers'::regclass);
select not has_table_privilege('anon','public.ps_letter_readers','SELECT') as anonymous_cannot_read_identities,
  not has_table_privilege('authenticated','public.ps_letter_readers','SELECT') as accounts_cannot_read_identities,
  has_function_privilege('anon','public.ps_letter_stats(uuid)','EXECUTE') as anonymous_counts,
  has_function_privilege('anon','public.ps_letter_engage(integer,uuid,text,boolean)','EXECUTE') as anonymous_reactions;
select count(*) as public_letters from public.ps_letter_stats(null);
