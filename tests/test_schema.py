"""Le schéma SQL reste owner-only, sans secret."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = (ROOT / "supabase" / "schema.sql").read_text(encoding="utf-8")


def test_rls_covers_every_owner_table():
    tables = ["ide_files", "progress", "quiz_results", "training_runs", "training_plans"]
    assert "auth.uid()" in SCHEMA
    assert "service_role" not in SCHEMA
    assert "set search_path = ''" in SCHEMA
    assert "00000000-0000-0000-0000-000000000000" in SCHEMA
    for table in tables:
        assert f"alter table public.{table} enable row level security;" in SCHEMA
        assert f"create policy {table}_owner on public.{table}" in SCHEMA
        assert f"revoke all on table public.{table} from anon, public;" in SCHEMA
        assert f"grant select, insert, update, delete on table public.{table} to authenticated;" in SCHEMA


def test_manifest_lists_the_python_package():
    manifest = json.loads((ROOT / "model" / "manifest.json").read_text(encoding="utf-8"))
    found = sorted(
        str(path.relative_to(ROOT)).replace("\\", "/")
        for path in (ROOT / "model").rglob("*.py")
        if "__pycache__" not in path.parts
    )
    assert manifest["files"] == found


def test_versioned_workspace_is_owner_only_and_atomic():
    sql=(ROOT/'supabase'/'workspace.sql').read_text()
    assert 'enable row level security' in sql
    assert 'security invoker' in sql
    assert 'revision=p_revision' in sql
    assert "errcode='40001'" in sql
    assert 'from public,anon' in sql
