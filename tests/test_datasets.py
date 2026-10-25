"""Catalogue : schéma, nettoyage, préparation sans réseau."""

import json
from pathlib import Path

import pytest

from model.datasets import clean_text, prepare_id, split_text, validate_catalog
from model.gpt_train import _run_plan


ROOT = Path(__file__).resolve().parents[1]


def test_committed_catalog_is_valid():
    data = json.loads((ROOT / "data" / "datasets.json").read_text(encoding="utf-8"))
    assert validate_catalog(data) == []
    orders = [row["order"] for row in data["datasets"]]
    assert orders == sorted(orders)
    assert any(row["language"] == "fr" for row in data["datasets"])
    assert all(row["url"].startswith("https://") for row in data["datasets"])


def test_clean_and_split_gutenberg_marker():
    raw = "header\n*** START OF THE PROJECT GUTENBERG EBOOK ***\nBonjour le monde.\n*** END OF THE PROJECT GUTENBERG EBOOK ***\nlicence"
    cleaned = clean_text(raw)
    assert cleaned.startswith("Bonjour")
    assert "header" not in cleaned
    assert "licence" not in cleaned
    train, val = split_text(cleaned * 20)
    assert train and val
    assert len(train) > len(val)


def test_prepare_fixture_without_network(tmp_path, monkeypatch):
    payload = "abc " * 50
    monkeypatch.setattr("model.datasets.download_bytes", lambda url, max_bytes=None: payload.encode("utf-8"))
    catalog = {
        "datasets": [
            {
                "id": "jouet-local",
                "name": "Jouet",
                "url": "https://example.com/jouet.txt",
                "licence": "MIT",
                "licenceUrl": "https://example.com/LICENSE",
                "language": "fr",
                "sizeMb": 0.01,
                "approxChars": len(payload),
                "format": "txt",
                "stage": 1,
                "order": 1,
                "prerequisites": [],
                "compatibility": {"char": True, "bpe": True, "numpyCpu": True, "pyodide": True, "needsGpu": False, "ramMb": 32, "minutes": 1},
                "teaches": "Un aller-retour de préparation.",
                "caveats": [],
                "gated": False,
                "checkedOn": "2026-10-25",
            }
        ]
    }
    destination = prepare_id("jouet-local", catalog=catalog, root=tmp_path)
    assert (destination / "train.txt").exists()
    assert (destination / "val.txt").exists()
    assert "MIT" in (destination / "ATTRIBUTION.md").read_text(encoding="utf-8")
    with pytest.raises(RuntimeError):
        gated = json.loads(json.dumps(catalog))
        gated["datasets"][0]["id"] = "secret"
        gated["datasets"][0]["gated"] = True
        prepare_id("secret", catalog=gated, root=tmp_path)


def test_plan_runs_a_tiny_pretrain(tmp_path):
    source = tmp_path / "corpus.txt"
    source.write_text("abcabcabcabc " * 20, encoding="utf-8")
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps({"items": [{"mode": "pretrain", "text": str(source), "steps": 2, "d_model": 8, "heads": 2, "layers": 1, "block": 8, "batch": 2, "eval_windows": 1, "sample": False}]}), encoding="utf-8")
    checkpoint = tmp_path / "plan.npz"

    args = type("Args", (), {})()
    args.plan = plan
    args.steps = 2
    args.lr = 0.05
    args.batch = 2
    args.block = 8
    args.d_model = 8
    args.heads = 2
    args.layers = 1
    args.seed = 0
    args.eval_windows = 1
    args.checkpoint = checkpoint
    _run_plan(args)
    assert checkpoint.exists()
