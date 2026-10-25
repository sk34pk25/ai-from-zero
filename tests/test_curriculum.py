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
    assert len(steps) == 149
    counts = Counter(step["quiz"]["answer"] for step in steps)
    assert counts == {0: 37, 1: 38, 2: 37, 3: 37}
    blob = json.dumps(data, ensure_ascii=False)
    assert "Planifié" not in blob
    for step in steps:
        assert len(step["quiz"]["choices"]) == 4
        assert step["build"]
        assert step["exercise"]
        assert step["why"]
