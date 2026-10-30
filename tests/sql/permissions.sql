-- UNIQUEMENT dans un PostgreSQL jetable, jamais dans le projet Supabase réel.
\set ON_ERROR_STOP on
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
grant usage on schema auth, public to anon, authenticated, service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
\ir ../../supabase/schema.sql
\ir ../../supabase/workspace.sql

create function pg_temp.assert_table_grants() returns void language plpgsql as $$
declare t text; p text;
begin
  foreach t in array array['ide_files','progress','quiz_results','training_runs','training_plans','learning_records'] loop
    if not (select relrowsecurity from pg_class where oid=('public.'||t)::regclass) then raise exception 'RLS absente : %',t; end if;
    foreach p in array array['SELECT','INSERT','UPDATE','DELETE'] loop
      if not has_table_privilege('authenticated','public.'||t,p) then raise exception 'CRUD manquant : % %',t,p; end if;
    end loop;
    foreach p in array array['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      if has_table_privilege('authenticated','public.'||t,p) then raise exception 'Droit inutile : % %',t,p; end if;
    end loop;
    foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] loop
      if has_table_privilege('anon','public.'||t,p) then raise exception 'Accès anonyme : % %',t,p; end if;
    end loop;
    if not has_table_privilege('service_role','public.'||t,'SELECT') then raise exception 'Droit backend perdu : %',t; end if;
  end loop;
end $$;
select pg_temp.assert_table_grants();
-- Simule les anciens grants trop larges, puis vérifie l'idempotence de la réparation.
grant all on all tables in schema public to anon, authenticated, public;
\ir ../../supabase/hardening.sql
\ir ../../supabase/hardening.sql
select pg_temp.assert_table_grants();

create table public.future_private_table(id integer);
do $$ begin
  if has_table_privilege('anon','public.future_private_table','SELECT') or has_table_privilege('authenticated','public.future_private_table','SELECT') then raise exception 'Table future exposée'; end if;
  if not has_table_privilege('service_role','public.future_private_table','SELECT') then raise exception 'Défauts backend modifiés'; end if;
  if has_function_privilege('anon','public.save_learning_record(text,jsonb,bigint)','EXECUTE') then raise exception 'RPC anonyme'; end if;
end $$;
set role authenticated;
set request.jwt.claim.sub='00000000-0000-0000-0000-000000000000';
insert into public.progress(id,done) values(1,'["0.1"]');
update public.progress set done='["0.1","0.2"]' where id=1;
select public.save_learning_record('ci/record','{"note":"première"}',0);
select public.save_learning_record('ci/record','{"note":"seconde"}',1);
do $$ begin
  if (select done from public.progress where id=1)<>'["0.1","0.2"]'::jsonb then raise exception 'CRUD propriétaire cassé'; end if;
  begin
    perform public.save_learning_record('ci/record','{"note":"obsolète"}',1);
    raise exception 'Révision obsolète acceptée';
  exception when serialization_failure then null; end;
  if (select revision from public.learning_records where key='ci/record')<>2 or (select payload->>'note' from public.learning_records where key='ci/record')<>'seconde' then raise exception 'Fiche écrasée'; end if;
end $$;
set request.jwt.claim.sub='11111111-1111-1111-1111-111111111111';
do $$ begin
  if exists(select 1 from public.progress) or exists(select 1 from public.learning_records) then raise exception 'Lecture interutilisateur'; end if;
  update public.progress set done='[]' where id=1;
  if found then raise exception 'Écriture interutilisateur'; end if;
  begin
    perform public.save_learning_record('ci/other','{}',0);
    raise exception 'RPC propriétaire contournée';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.ide_files(path,content) values('intrus.py','');
    raise exception 'INSERT interutilisateur accepté';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform 1 from public.progress;
    raise exception 'Lecture anonyme acceptée';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'Privilèges, RLS, RPC et défauts : contrôles réussis' as resultat;
