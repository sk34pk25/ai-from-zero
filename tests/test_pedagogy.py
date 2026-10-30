"""Le cours livré et le projet élève doivent être exécutables indépendamment."""

import ast
import importlib.util
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import sys
import pytest

ROOT = Path(__file__).resolve().parents[1]


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_published_examples_execute_and_keep_the_reference_weights():
    import hashlib

    p = ROOT / "model/data/bpe.json"
    before = hashlib.sha256(p.read_bytes()).hexdigest()
    rows = load_script("check_examples").check_examples()
    assert len(rows) == 161
    assert all(r["ok"] for r in rows), [r for r in rows if not r["ok"]]
    assert hashlib.sha256(p.read_bytes()).hexdigest() == before


def test_references_resolve_to_real_functions_and_level_rubrics_are_specific():
    c = json.loads((ROOT / "data/curriculum.json").read_text())

    def names(nodes, prefix=""):
        found = set()
        for n in nodes:
            if isinstance(n, (ast.FunctionDef, ast.ClassDef)):
                full = prefix + n.name
                found.add(full)
                if isinstance(n, ast.ClassDef):
                    found |= names(n.body, full + ".")
        return found

    for level in c["levels"]:
        assert len(level["assessment"]["criteria"]) == 4
        for s in level["steps"]:
            tree = ast.parse((ROOT / s["codeFile"]).read_text())
            assert s["codeSymbol"] in names(tree.body), (
                s["id"],
                s["codeFile"],
                s["codeSymbol"],
            )
    assert len({tuple(l["assessment"]["criteria"]) for l in c["levels"]}) == 14
    assert c["learningPath"]["coreLevels"] == [0, 1, 2, 3, 4, 13, 12]


def test_manifest_is_complete_and_has_no_model_imports():
    manifest = json.loads((ROOT / "data/atelier.json").read_text())
    assert manifest == load_script("build_atelier").payload()
    for source, copy in (
        ("artifacts.py", "artifacts.py"),
        ("byte_bpe.py", "octet_bpe.py"),
    ):
        assert (ROOT / "model" / source).read_bytes() == (
            ROOT / "atelier" / copy
        ).read_bytes()
    for file in manifest["files"]:
        assert file.startswith("atelier/") and ".." not in file
        if file.endswith(".py"):
            tree = ast.parse((ROOT / file).read_text())
            assert not any(
                isinstance(n, ast.ImportFrom) and (n.module or "").startswith("model")
                for n in ast.walk(tree)
            )


def test_downloaded_project_reference_trains_without_repository(tmp_path):
    project = tmp_path / "independent"
    shutil.copytree(
        ROOT / "atelier", project, ignore=shutil.ignore_patterns("__pycache__")
    )
    env = {**os.environ, "OPENBLAS_NUM_THREADS": "1"}
    env.pop("PYTHONPATH", None)

    def run(*args, ok=True):
        p = subprocess.run(
            [sys.executable, *args],
            cwd=project,
            env=env,
            text=True,
            capture_output=True,
            timeout=60,
        )
        assert (p.returncode == 0) == ok, p.stdout + p.stderr
        return p

    run("verifier.py", "--jusqua", "1", ok=False)
    r = json.loads(run("verifier.py", "--module", "correction").stdout)
    assert r["reussis"] == 12
    out = project / "runs/first"
    r = json.loads(
        run(
            "entrainer.py",
            "--module",
            "correction",
            "--steps",
            "120",
            "--out",
            str(out),
        ).stdout
    )
    assert r["val_loss_end"] < r["baselines"]["bigramme"] < r["baselines"]["uniforme"]
    assert r["rechargement_identique"]
    assert all(r["poids_modifies"].values())
    assert r["train_sha256"] != r["validation_sha256"]
    test = project / "demo/test.txt"
    final = json.loads(
        run(
            "evaluer.py",
            "--module",
            "correction",
            "--checkpoint",
            str(out / "modele.npz"),
            "--test",
            str(test),
            "--out",
            str(out / "final.json"),
        ).stdout
    )
    assert final["test_loss"] > 0
    assert final["test_sha256"] not in (r["train_sha256"], r["validation_sha256"])
    run(
        "entrainer.py",
        "--module",
        "correction",
        "--steps",
        "2",
        "--out",
        str(out),
        ok=False,
    )


def test_document_split_normalizes_before_deduplicating(tmp_path):
    project = ROOT / "atelier"
    sys.path.insert(0, str(project))
    try:
        from preparer import preparer

        source = tmp_path / "sources"
        source.mkdir()
        for name, text in {
            "a": "café\n",
            "copy": "cafe\u0301\r\n",
            "b": "un chat\n",
            "c": "un chien\n",
            "d": "un cheval\n",
        }.items():
            (source / (name + ".txt")).write_text(text, encoding="utf-8")
        out = tmp_path / "corpus"
        meta = preparer(source, out)
        assert len(meta["doublons_retires"]) == 1
        hashes = [{d["sha256"] for d in docs} for docs in meta["documents"].values()]
        assert all(hashes)
        assert (
            not hashes[0] & hashes[1]
            and not hashes[0] & hashes[2]
            and not hashes[1] & hashes[2]
        )
        with pytest.raises(ValueError, match="vide"):
            preparer(source, out)
    finally:
        sys.path.remove(str(project))


def test_reference_report_matches_the_delivered_code_and_data():
    import hashlib

    report = json.loads((ROOT / "data/atelier_reference_run.json").read_text())
    for field, file in [
        ("code_sha256", "atelier/correction.py"),
        ("moteur_sha256", "atelier/moteur.py"),
        ("train_sha256", "atelier/demo/train.txt"),
        ("validation_sha256", "atelier/demo/validation.txt"),
    ]:
        assert report[field] == hashlib.sha256((ROOT / file).read_bytes()).hexdigest()
    assert (
        report["val_loss_end"]
        < report["baselines"]["bigramme"]
        < report["baselines"]["uniforme"]
    )
    assert report["rechargement_identique"] is True


def test_core_path_has_every_prerequisite_before_use_and_ends_with_delivery():
    c = json.loads((ROOT / "data/curriculum.json").read_text())
    lessons = {s["id"]: s for l in c["levels"] for s in l["steps"]}
    path = c["learningPath"]["coreSteps"]
    assert len(path) == len(set(path)) == 86
    assert path[-1] == "12.12"
    assert path[path.index("4.14") + 1] == "13.3"
    assert not {"13.1", "13.6", "13.7", "12.7", "12.8", "12.9"} & set(path)
    seen = set()
    for id in path:
        assert set(re.findall(r"\b\d+\.\d+\b", lessons[id]["prereq"])) <= seen, (id, lessons[id]["prereq"])
        seen.add(id)
    exercises = json.loads((ROOT / "data/exercises.json").read_text())
    python_ids = {e["lessonId"] for e in exercises}
    assert len(python_ids) == 66
    assert {id for id, s in lessons.items() if s["activityKind"] == "python"} == python_ids


def test_glossary_groups_contexts_and_keeps_curated_examples():
    rows = json.loads((ROOT / "data/glossary.json").read_text())
    assert rows == load_script("build_curriculum").build_glossary()
    terms = [row["term"].casefold() for row in rows]
    assert len(terms) == len(set(terms))
    baseline = next(row for row in rows if row["term"] == "Baseline")
    assert {"3.2", "12.2"} <= {context["lesson"] for context in baseline["contexts"]}
    assert len(baseline["contexts"]) == len({context["lesson"] for context in baseline["contexts"]})
    assert baseline["example"] and baseline["english"]
    core = json.loads((ROOT / "data/glossary-core.json").read_text())
    assert len(core) == 20 and all(row["example"] for row in core)
