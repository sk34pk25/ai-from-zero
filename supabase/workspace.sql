-- Extension additive : ne remplace pas is_owner() et ne modifie pas les données existantes.
create table if not exists public.learning_records (
  key text primary key check (length(key) between 1 and 180),
  payload jsonb not null,
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.learning_records enable row level security;
drop policy if exists learning_records_owner on public.learning_records;
create policy learning_records_owner on public.learning_records to authenticated
  using ((select public.is_owner())) with check ((select public.is_owner()));
revoke all on public.learning_records from anon, public;
grant select, insert, update, delete on public.learning_records to authenticated;
create or replace function public.save_learning_record(p_key text, p_payload jsonb, p_revision bigint)
returns setof public.learning_records language plpgsql security invoker set search_path = '' as $$
declare saved public.learning_records;
begin
  if not coalesce(public.is_owner(), false) then raise exception 'owner required' using errcode='42501'; end if;
  if p_revision < 0 or p_revision is null or p_payload is null or octet_length(p_payload::text) > 2097152 then
    raise exception 'invalid payload' using errcode='22023';
  end if;
  if p_revision = 0 then
    insert into public.learning_records(key,payload) values(p_key,p_payload)
      on conflict (key) do nothing returning * into saved;
  else
    update public.learning_records set payload=p_payload, revision=revision+1, updated_at=now()
      where key=p_key and revision=p_revision returning * into saved;
  end if;
  if saved.key is null then raise exception 'revision conflict' using errcode='40001'; end if;
  return next saved;
end $$;
revoke all on function public.save_learning_record(text,jsonb,bigint) from public,anon;
grant execute on function public.save_learning_record(text,jsonb,bigint) to authenticated;
