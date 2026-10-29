"""Inventaire déterministe du projet autonome livré au site."""

import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def payload():
    t = json.loads((ROOT / "curriculum_src/teaching.json").read_text(encoding="utf-8"))
    files = sorted(
        p.relative_to(ROOT).as_posix()
        for p in (ROOT / "atelier").rglob("*")
        if p.is_file()
        and not any(
            part in {"__pycache__", "runs", ".venv", "venv"} or part.startswith(".")
            for part in p.relative_to(ROOT / "atelier").parts
        )
        and (p.suffix in {".py", ".md", ".txt", ".json"} or p.name == "LICENSE")
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
            "atelier/FONDATIONS.md",
            "atelier/PANNES.md",
            "atelier/BANC_FR.md",
            "atelier/EXTENSIONS.md",
            "atelier/RELECTURE.md",
        ],
        "diagnostics": json.loads(
            (ROOT / "curriculum_src/diagnostics.json").read_text(encoding="utf-8")
        ),
    }


if __name__ == "__main__":
    for source, target in (
        ("artifacts.py", "artifacts.py"),
        ("byte_bpe.py", "octet_bpe.py"),
    ):
        shutil.copyfile(ROOT / "model" / source, ROOT / "atelier" / target)
    (ROOT / "model/manifest.json").write_text(
        json.dumps(
            {
                "files": sorted(
                    p.relative_to(ROOT).as_posix()
                    for p in (ROOT / "model").rglob("*.py")
                    if "__pycache__" not in p.parts
                )
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (ROOT / "data/atelier.json").write_text(
        json.dumps(payload(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
