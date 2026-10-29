"""Le JSON commité, le plan markdown et les sources racontent le même parcours."""

from __future__ import annotations

import importlib.util
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_builder():
    spec = importlib.util.spec_from_file_location("build_curriculum", ROOT / "scripts" / "build_curriculum.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_sources_json_and_docs_match():
    builder = load_builder()
    fresh = builder.build_data()
    committed = json.loads((ROOT / "data" / "curriculum.json").read_text(encoding="utf-8"))
    assert fresh == committed
    assert (ROOT / "docs" / "CURRICULUM.md").read_text(encoding="utf-8") == builder.render_markdown(fresh)


def test_every_step_is_real_and_answers_move():
    data = json.loads((ROOT / "data" / "curriculum.json").read_text(encoding="utf-8"))
    steps = [step for level in data["levels"] for step in level["steps"]]
    assert len(steps) == 161
    counts = Counter(step["quiz"]["answer"] for step in steps)
    assert counts == {0: 41, 1: 40, 2: 40, 3: 40}
    blob = json.dumps(data, ensure_ascii=False)
    assert "Planifié" not in blob
    for step in steps:
        assert len(step["quiz"]["choices"]) == 4
        assert step["build"]
        assert step["exercise"]
        assert step["why"]


def test_every_step_has_a_short_visual_summary():
    builder = load_builder()
    data = json.loads((ROOT / "data" / "curriculum.json").read_text(encoding="utf-8"))
    glances = json.loads((ROOT / "data" / "glance.json").read_text(encoding="utf-8"))
    assert glances == builder.build_glances()
    steps = [step for level in data["levels"] for step in level["steps"]]
    assert list(glances) == [step["id"] for step in steps]
    for step in steps:
        glance = glances[step["id"]]
        assert 0 < len(glance["phrase"]) <= 120, step["id"]
        assert 0 < len(glance["image"]) <= 95, step["id"]
        assert 0 < len(glance["key"]) <= 60, step["id"]
        assert 0 < len(glance["trap"]) <= 100, step["id"]
        assert len(glance["steps"]) == 3, step["id"]
        for item in glance["steps"]:
            assert 0 < len(item["title"]) <= 20 and 0 < len(item["text"]) <= 42, step["id"]
    phrases = [glance["phrase"] for glance in glances.values()]
    assert len(set(phrases)) == len(phrases), "chaque leçon a sa propre phrase clé"
