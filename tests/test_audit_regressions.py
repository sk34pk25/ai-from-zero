"""Compatibilité de l'ancienne interface élève et contrôles pratiques indépendants."""
import ast
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import pytest

ROOT = Path(__file__).resolve().parents[1]


def test_standard_training_keeps_the_previous_student_autograd_contract(tmp_path):
    target = tmp_path / "model"
    shutil.copytree(ROOT / "model", target, ignore=shutil.ignore_patterns("data", "__pycache__"))
    path = target / "autograd.py"
    tree = ast.parse(path.read_text())
    tree.body = [n for n in tree.body if not isinstance(n, ast.FunctionDef) or n.name not in {"rope", "repeat_kv"}]
    for node in tree.body:
        if isinstance(node, ast.ClassDef) and node.name == "Tensor":
            node.body = [n for n in node.body if not isinstance(n, ast.FunctionDef) or n.name != "silu"]
    path.write_text(ast.unparse(tree))
    code = """
from model.gpt_train import train_gpt
from model.live import LiveTrainer
base = dict(steps=2, d_model=8, n_heads=2, n_layers=1, block=4, batch=1, sample=False, eval_windows=1)
_, _, result = train_gpt("le chat dort. " * 100, **base)
assert result.train_loss_end > 0
for options, message in [({"pos":"rope"}, "rope"), ({"n_kv_heads":1}, "repeat_kv"), ({"ffn":"swiglu"}, "silu")]:
    try:
        train_gpt("le chat dort. " * 100, **base, **options)
    except ValueError as error:
        assert message in str(error), str(error)
    else:
        raise AssertionError("La variante doit signaler la primitive manquante")
"""
    p = subprocess.run([sys.executable, "-c", code], cwd=tmp_path, capture_output=True, text=True,
                       env={**os.environ, "PYTHONPATH": str(tmp_path), "OPENBLAS_NUM_THREADS":"1"}, timeout=30)
    assert p.returncode == 0, p.stdout + p.stderr


SOLUTION = """
def analyser(texte, seuil):
    values = [float(line) for line in texte.splitlines() if line.strip()]
    if not values:
        raise ValueError("vide")
    total = sum(values)
    return {"nombre":len(values), "total":total, "moyenne":total / len(values),
            "au_dessus":[v for v in values if v > seuil]}
"""


@pytest.mark.parametrize("variant,accepted", [
    (SOLUTION, True),
    (SOLUTION.replace("v > seuil", "v >= seuil"), False),
    (SOLUTION.replace("total / len(values)", "total / 2"), False),
    (SOLUTION.replace("float(line)", "int(float(line))"), False),
    ('def analyser(texte, seuil):\n    return {"nombre":3,"total":39.5,"moyenne":39.5/3,"au_dessus":[12,20]}', False),
])
def test_practical_checks_accept_calculation_and_reject_shortcuts(variant, accepted):
    spec = json.loads((ROOT / "data/placement_practice.json").read_text())
    try:
        exec(variant + "\n" + spec["check"], {})
    except (AssertionError, ValueError, KeyError, ZeroDivisionError):
        assert not accepted
    else:
        assert accepted
