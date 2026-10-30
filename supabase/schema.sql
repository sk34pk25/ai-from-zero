-- Schéma propriétaire pour AI From Zero.
--
-- Projet neuf : remplace l'UUID ci-dessous par l'id du compte créé dans
-- Authentication → Users, puis exécute ce fichier. Le mode d'emploi est
-- docs/SUPABASE_SETUP.md.
--
-- Le projet qffcqvwndnpdbrmqbjpz est déjà en place. Sa fonction is_owner()
-- a le même corps, avec set search_path = '' et l'UUID du propriétaire
-- (OWNER_ID dans assets/config.js). Ne pas réappliquer ce fichier tel quel
-- sur ce projet : l'UUID nul remplacerait l'identifiant réel.
--
-- Le cadenas du site est une commodité d'interface. Ces politiques sont
-- la protection réelle. Un anonyme, ou un autre utilisateur authentifié,
-- ne lit ni n'écrit ces tables. Aucun secret n'est stocké dans ce fichier.

-- Une table future créée par le rôle courant demande ses GRANT et politiques explicites.
alter default privileges in schema public revoke all on tables from anon, authenticated, public;

create or replace function public.is_owner()
returns boolean
language sql
stable
set search_path = ''
as $$
  select auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid;
$$;

create table if not exists public.ide_files (
  path text primary key,
  content text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.progress (
  id integer primary key default 1 check (id = 1),
  done jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_results (
  lesson_id text primary key,
  choice integer not null,
  correct boolean not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.training_runs (
  id bigint generated always as identity primary key,
  label text not null,
  loss jsonb not null,
  sample text,
  created_at timestamptz not null default now()
);

create table if not exists public.training_plans (
  id integer primary key default 1 check (id = 1),
  dataset_ids jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ide_files enable row level security;
alter table public.progress enable row level security;
alter table public.quiz_results enable row level security;
alter table public.training_runs enable row level security;
alter table public.training_plans enable row level security;

drop policy if exists ide_files_owner on public.ide_files;
create policy ide_files_owner on public.ide_files
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists progress_owner on public.progress;
create policy progress_owner on public.progress
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists quiz_results_owner on public.quiz_results;
create policy quiz_results_owner on public.quiz_results
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists training_runs_owner on public.training_runs;
create policy training_runs_owner on public.training_runs
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists training_plans_owner on public.training_plans;
create policy training_plans_owner on public.training_plans
  for all using (public.is_owner()) with check (public.is_owner());

revoke all on table public.ide_files from anon, public, authenticated;
revoke all on table public.progress from anon, public, authenticated;
revoke all on table public.quiz_results from anon, public, authenticated;
revoke all on table public.training_runs from anon, public, authenticated;
revoke all on table public.training_plans from anon, public, authenticated;

grant select, insert, update, delete on table public.ide_files to authenticated;
grant select, insert, update, delete on table public.progress to authenticated;
grant select, insert, update, delete on table public.quiz_results to authenticated;
grant select, insert, update, delete on table public.training_runs to authenticated;
grant select, insert, update, delete on table public.training_plans to authenticated;
grant usage, select on sequence public.training_runs_id_seq to authenticated;
