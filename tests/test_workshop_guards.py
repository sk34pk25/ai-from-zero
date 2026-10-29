"""Contre-exemples de l'audit : tester les erreurs que la référence ne produit pas."""

import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def workshop(tmp_path):
    target = tmp_path / "atelier"
    shutil.copytree(
        ROOT / "atelier", target, ignore=shutil.ignore_patterns("__pycache__")
    )
    return target


def run(workshop, *args):
    return subprocess.run(
        [sys.executable, *args],
        cwd=workshop,
        text=True,
        capture_output=True,
        env={**os.environ, "OPENBLAS_NUM_THREADS": "1"},
        timeout=60,
    )


@pytest.mark.parametrize(
    "variant,tp",
    [
        ("scale", 7),
        ("constant", 3),
        ("mask", 7),
        ("heads", 8),
        ("target", 10),
        ("residual", 9),
        ("accumulation", 5),
    ],
)
def test_wrong_math_is_rejected(workshop, variant, tp):
    source = (workshop / "correction.py").read_text()
    if variant == "constant":
        tree = ast.parse(source)
        for n in tree.body:
            if isinstance(n, ast.FunctionDef) and n.name == "entropie":
                n.body = ast.parse("return float(np.log(np.asarray(z).shape[-1]))").body
        changed = ast.unparse(tree)
    else:
        old, new = {
            "scale": (" * (q.data.shape[-1] ** -0.5)", ""),
            "mask": ("(scores + mask).softmax", "scores.softmax"),
            "heads": (
                ".permute((0, 2, 1, 3))\n        .reshape",
                ".permute((0, 1, 2, 3))\n        .reshape",
            ),
            "target": ("y.reshape(-1)", "np.roll(y, 1, axis=1).reshape(-1)"),
            "residual": ("return h + n.matmul", "return n.matmul"),
            "accumulation": ("self.grad += out.grad", "self.grad = out.grad"),
        }[variant]
        assert old in source
        changed = source.replace(old, new)
    (workshop / "incorrect.py").write_text(changed)
    result = run(workshop, "verifier.py", "--module", "incorrect")
    assert result.returncode == 1, result.stderr
    report = json.loads(result.stdout)
    assert report["reussis"] < 12
    assert not next(c for c in report["controles"] if c["tp"] == tp)["ok"]


def trained(workshop):
    result = run(
        workshop,
        "entrainer.py",
        "--module",
        "correction",
        "--steps",
        "2",
        "--out",
        "runs/baseline",
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_final_rejects_train_even_renamed_and_normalized(workshop):
    report = trained(workshop)
    assert report["selected_step"] == 2
    assert report["rechargement_identique"]
    assert report["environment"]["numpy"]
    copy = workshop / "copie.txt"
    copy.write_text(
        "  " + (workshop / "demo/train.txt").read_text().replace("\n", "\r\n") + "\n"
    )
    bad = run(
        workshop,
        "evaluer.py",
        "--module",
        "correction",
        "--checkpoint",
        "runs/baseline/modele.npz",
        "--test",
        str(copy),
        "--out",
        "runs/faux.json",
    )
    assert bad.returncode != 0 and "recouvre" in bad.stderr
    assert not (workshop / "runs/faux.json").exists()
    good = run(
        workshop,
        "evaluer.py",
        "--module",
        "correction",
        "--checkpoint",
        "runs/baseline/modele.npz",
        "--test",
        "demo/test.txt",
        "--out",
        "runs/final.json",
    )
    assert good.returncode == 0, good.stderr
    r = json.loads(good.stdout)
    assert r["known_overlap_checked"] and not r["test_independent"]
    assert "non vérifiable" in r["provenance_status"]
    assert r["mesure"]["target_tokens"] >= r["mesure"]["available_target_tokens"]
    (workshop / "correction.py").write_text(
        (workshop / "correction.py").read_text() + "\n# changement\n"
    )
    changed = run(
        workshop,
        "evaluer.py",
        "--module",
        "correction",
        "--checkpoint",
        "runs/baseline/modele.npz",
        "--test",
        "demo/test.txt",
        "--out",
        "runs/change.json",
    )
    assert changed.returncode != 0 and "diffère" in changed.stderr


def test_outputs_never_overwrite_inputs_or_existing_reports(workshop):
    source = workshop / "correction.py"
    before = source.read_bytes()
    r = run(
        workshop, "verifier.py", "--module", "correction", "--rapport", "correction.py"
    )
    assert r.returncode != 0 and source.read_bytes() == before
    trained(workshop)
    p = workshop / "runs/baseline/modele.npz"
    before = p.read_bytes()
    r = run(
        workshop,
        "evaluer.py",
        "--module",
        "correction",
        "--checkpoint",
        str(p),
        "--test",
        "demo/test.txt",
        "--out",
        str(p),
    )
    assert r.returncode != 0 and p.read_bytes() == before
    report = workshop / "deja.json"
    report.write_text("mon résultat\n")
    r = run(workshop, "verifier.py", "--module", "correction", "--rapport", str(report))
    assert r.returncode != 0 and report.read_text() == "mon résultat\n"


def test_individual_tp_can_start_before_tokenizer(workshop):
    r = run(workshop, "verifier.py", "--module", "correction", "--tp", "5")
    report = json.loads(r.stdout)
    assert (
        r.returncode == 0 and report["total"] == 1 and report["controles"][0]["tp"] == 5
    )


def test_document_benchmark_selects_on_validation_and_tests_only_the_winner(workshop):
    result = run(
        workshop,
        "benchmark.py",
        "--module",
        "correction",
        "--out",
        "runs/banc",
        "--steps",
        "2",
        "--widths",
        "4,8",
        "--seeds",
        "0,1",
    )
    assert result.returncode == 0, result.stderr
    report = json.loads((workshop / "runs/banc/benchmark.json").read_text())
    assert len(report["runs"]) == 4 and len(report["test_final"]) == 2
    winner = min(
        report["validation_means"],
        key=lambda w: (report["validation_means"][w], int(w)),
    )
    assert report["selected_width"] == int(winner)
    selected = {
        r["checkpoint_sha256"] for r in report["runs"] if r["width"] == int(winner)
    }
    assert {r["checkpoint_sha256"] for r in report["test_final"]} == selected
    assert all(r["test_independent"] for r in report["test_final"])
    assert (workshop / "runs/banc/recette-avant-test.json").is_file()


def test_cli_generation_and_local_api_use_the_personal_checkpoint(workshop):
    trained(workshop)
    r = run(
        workshop,
        "-c",
        """
import json, threading, urllib.request, urllib.error
from generer import generer, serveur
kwargs=dict(module="correction",checkpoint="runs/baseline/modele.npz",prompt="le ",tokens=8,seed=9,stop="")
a=generer(**kwargs);b=generer(**kwargs)
assert a["text"]==b["text"] and a["generated_tokens"]==8
s=serveur("correction",kwargs["checkpoint"],port=0)
t=threading.Thread(target=s.serve_forever,daemon=True);t.start()
url=f"http://127.0.0.1:{s.server_port}/generer"
def post(payload,origin=None):
 headers={"Content-Type":"application/json"}
 if origin:headers["Origin"]=origin
 return urllib.request.urlopen(urllib.request.Request(url,data=json.dumps(payload).encode(),headers=headers),timeout=10)
try:
 result=json.load(post({"prompt":"le ","tokens":8,"seed":9,"stop":""}))
 assert result["text"]==a["text"]
 for payload,origin,code in [({"prompt":"x","tokens":99999},None,400),({"prompt":"x"},"https://exemple.invalid",403)]:
  try:post(payload,origin);raise AssertionError("requête invalide acceptée")
  except urllib.error.HTTPError as e:assert e.code==code
finally:s.shutdown();s.server_close();t.join()
print(json.dumps({"ok":True}))
""",
    )
    assert r.returncode == 0, r.stderr
