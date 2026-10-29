"""Exécute les exemples publiés dans une copie temporaire du laboratoire.

0.12 est volontairement un IndexError de débogage. Toute autre exception est
un échec. Les assertions des exemples contrôlent aussi les résultats clés.
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def check_examples():
    data = json.loads((ROOT / "data/curriculum.json").read_text(encoding="utf-8"))
    results = []
    with tempfile.TemporaryDirectory(prefix="afz-examples-") as folder:
        work = Path(folder)
        for name in ("model", "data"):
            shutil.copytree(
                ROOT / name, work / name, ignore=shutil.ignore_patterns("__pycache__")
            )
        for level in data["levels"]:
            for lesson in level["steps"]:
                for section in lesson["sections"]:
                    if section["kind"] != "code" or section.get("lang") != "python":
                        continue
                    code = section["code"]
                    id = lesson["id"]
                    try:
                        compile(code, id, "exec")
                        p = subprocess.run(
                            [sys.executable, "-c", code],
                            cwd=work,
                            capture_output=True,
                            text=True,
                            timeout=20,
                            env={**os.environ, "OPENBLAS_NUM_THREADS": "1"},
                        )
                        ok = (
                            (p.returncode != 0 and "IndexError" in p.stderr)
                            if id == "0.12"
                            else p.returncode == 0
                        )
                        row = {
                            "lesson": id,
                            "ok": ok,
                            "expected_error": "IndexError" if id == "0.12" else None,
                        }
                        if not ok:
                            row["error"] = p.stderr[-2000:]
                    except Exception as e:
                        row = {"lesson": id, "ok": False, "error": str(e)}
                    results.append(row)
    return results


if __name__ == "__main__":
    rows = check_examples()
    failed = [r for r in rows if not r["ok"]]
    print(
        json.dumps(
            {
                "examples": len(rows),
                "success": len(rows) - len(failed),
                "failures": failed,
            },
            ensure_ascii=False,
            indent=2,
        )
    )
    raise SystemExit(bool(failed))
