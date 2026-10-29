import os
from pathlib import Path
import subprocess
import sys
import json
import pytest


def test_all_gradients_match_and_torch_can_train():
    pytest.importorskip("torch")
    result = subprocess.run(
        [sys.executable, "port_torch.py", "--module", "correction", "--steps", "12"],
        cwd=Path(__file__).resolve().parents[1] / "atelier",
        text=True,
        capture_output=True,
        env={**os.environ, "OPENBLAS_NUM_THREADS": "1"},
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    r = json.loads(result.stdout)
    assert r["gradient_max_abs_error"] < 1e-9
    assert r["logits_max_abs_error"] < 1e-10
    assert {"tok", "0.wq", "1.w1", "head"} <= set(r["gradients"])
    assert r["loss_end"] < r["loss_start"]
