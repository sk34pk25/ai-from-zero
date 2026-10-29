import json
import numpy as np
import pytest
from model.eval_questions import questions, preparer, evaluer
from model.gpt_train import save_checkpoint
from model.transformer import TinyGPT, GPTConfig
from model.byte_bpe import ByteBPETokenizer


SOURCE = "atelier/benchmark/questions.json"


def test_question_families_stay_together_and_test_needs_intent(tmp_path):
    data = questions(SOURCE)
    preparer(SOURCE, tmp_path / "splits")
    parts = [
        json.loads((tmp_path / "splits" / (name + ".json")).read_text())
        for name in ("train", "validation", "test")
    ]
    assert sum(map(len, parts)) == len(data["items"])
    groups = [{r["group"] for r in rows} for rows in parts]
    assert (
        not groups[0] & groups[1]
        and not groups[0] & groups[2]
        and not groups[1] & groups[2]
    )
    broken = json.loads(json.dumps(data))
    broken["items"][1]["split"] = "test"
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(broken))
    with pytest.raises(ValueError, match="famille"):
        questions(path)
    with pytest.raises(ValueError, match="test-final"):
        evaluer(tmp_path / "absent.npz", SOURCE, split="test")


def test_question_report_keeps_failed_predictions_and_coverage(tmp_path):
    tok = ByteBPETokenizer()
    model = TinyGPT(
        GPTConfig(
            vocab_size=tok.vocab_size, d_model=4, n_heads=1, n_layers=1, block_size=128
        )
    )
    path = tmp_path / "model.npz"
    save_checkpoint(path, model, tok, {})
    report = evaluer(path, SOURCE, split="validation", steps=3)
    assert report["examples"] == 4
    assert np.isfinite(report["loss"]["loss"])
    assert len(report["results"]) == 4
    assert report["sft_overlap_checked"] is False
    assert "non vérifiable" in report["provenance_status"]
    assert 0 <= report["exact_match_rate"] <= 1
