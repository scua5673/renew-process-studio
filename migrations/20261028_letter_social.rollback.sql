-- Stop public traffic; preserve collected counts for a safe forward repair.
begin;
revoke all on function public.ps_letter_stats(uuid),public.ps_letter_engage(integer,uuid,text,boolean) from anon,authenticated;
notify pgrst,'reload schema';
commit;
