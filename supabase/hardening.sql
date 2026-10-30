-- Projet déjà installé : appliquer après schema.sql et workspace.sql dans une transaction.
-- Ne remplace ni données, ni is_owner()/UUID, ni politiques. Préserve les droits backend.
revoke all on table public.ide_files, public.progress, public.quiz_results,
  public.training_runs, public.training_plans, public.learning_records
  from anon, public, authenticated;
grant select, insert, update, delete on table public.ide_files, public.progress,
  public.quiz_results, public.training_runs, public.training_plans,
  public.learning_records to authenticated;
-- Défauts du créateur courant (postgres dans le SQL Editor/MCP).
-- Les défauts du rôle interne supabase_admin ne sont pas modifiés.
alter default privileges in schema public revoke all on tables from anon, authenticated, public;
