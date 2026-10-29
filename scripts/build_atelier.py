"""Inventaire déterministe du projet autonome livré au site."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def payload():
    t = json.loads((ROOT / "curriculum_src/teaching.json").read_text(encoding="utf-8"))
    files = sorted(
        p.relative_to(ROOT).as_posix()
        for p in (ROOT / "atelier").rglob("*")
        if p.is_file() and "__pycache__" not in p.parts
    )
    return {
        "format": "afz-atelier-v1",
        "coreLevels": t["coreLevels"],
        "stages": t["stages"],
        "files": files,
        "documents": [
            "atelier/INSTALLATION.md",
            "atelier/GUIDE.md",
            "atelier/PROJET_FINAL.md",
        ],
    }


if __name__ == "__main__":
    (ROOT / "data/atelier.json").write_text(
        json.dumps(payload(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
