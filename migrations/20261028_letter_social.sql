-- Additive, idempotent letter counters. No community posts or personal documents are modified.
begin;
create table if not exists public.ps_letter_issues (
  issue integer primary key check (issue between 1 and 999),
  counting_since timestamptz not null default now()
);
insert into public.ps_letter_issues(issue) select generate_series(1,46) on conflict do nothing;
create table if not exists public.ps_letter_readers (
  issue integer not null references public.ps_letter_issues(issue),
  reader_key text not null check (reader_key ~ '^[uv]:[0-9a-f-]{36}$'),
  has_read boolean not null default false,
  liked boolean not null default false,
  primary key(issue,reader_key)
);
alter table public.ps_letter_issues enable row level security;
alter table public.ps_letter_readers enable row level security;
revoke all on public.ps_letter_issues,public.ps_letter_readers from public,anon,authenticated;

create or replace function public.ps_letter_stats(p_visitor uuid default null)
returns table(issue integer,readers bigint,likes bigint,liked boolean)
language sql stable security definer set search_path=public,pg_temp as $$
  select i.issue,
    count(*) filter(where r.has_read),count(*) filter(where r.liked),
    coalesce(bool_or(r.liked and r.reader_key=case when auth.uid() is not null then 'u:'||auth.uid()::text else 'v:'||p_visitor::text end),false)
  from public.ps_letter_issues i left join public.ps_letter_readers r on r.issue=i.issue
  group by i.issue order by i.issue;
$$;

create or replace function public.ps_letter_engage(p_issue integer,p_visitor uuid,p_action text,p_liked boolean default null)
returns table(issue integer,readers bigint,likes bigint,liked boolean)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  uid uuid:=auth.uid();
  identity_key text;
begin
  if p_action is null or p_action not in ('read','like') or (p_action='like' and p_liked is null) then
    raise exception 'Invalid letter action' using errcode='22023';
  end if;
  if not exists(select 1 from public.ps_letter_issues i where i.issue=p_issue) then
    raise exception 'Unknown letter' using errcode='22023';
  end if;
  if uid is null and p_visitor is null then raise exception 'Reader identity required' using errcode='22023'; end if;
  identity_key:=case when uid is not null then 'u:'||uid::text else 'v:'||p_visitor::text end;
  -- One short transaction per issue makes anonymous→account merging safe across tabs.
  perform pg_advisory_xact_lock(73842,p_issue);
  if uid is not null and p_visitor is not null then
    insert into public.ps_letter_readers as r(issue,reader_key,has_read,liked)
      select p_issue,identity_key,g.has_read,g.liked from public.ps_letter_readers g
      where g.issue=p_issue and g.reader_key='v:'||p_visitor::text
      on conflict on constraint ps_letter_readers_pkey do update
      set has_read=r.has_read or excluded.has_read,liked=r.liked or excluded.liked;
    delete from public.ps_letter_readers g where g.issue=p_issue and g.reader_key='v:'||p_visitor::text;
  end if;
  insert into public.ps_letter_readers as r(issue,reader_key,has_read,liked)
    values(p_issue,identity_key,p_action='read',case when p_action='like' then p_liked else false end)
    on conflict on constraint ps_letter_readers_pkey do update
    set has_read=r.has_read or p_action='read',liked=case when p_action='like' then p_liked else r.liked end;
  return query select s.* from public.ps_letter_stats(p_visitor) s where s.issue=p_issue;
end;
$$;
revoke all on function public.ps_letter_stats(uuid),public.ps_letter_engage(integer,uuid,text,boolean) from public;
grant execute on function public.ps_letter_stats(uuid),public.ps_letter_engage(integer,uuid,text,boolean) to anon,authenticated;
comment on table public.ps_letter_readers is 'Private deduplication only. Public RPCs expose aggregate counts and the caller reaction; no reader identities.';
notify pgrst,'reload schema';
commit;
