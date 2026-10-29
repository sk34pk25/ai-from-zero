import json
import numpy as np
import pytest
from pathlib import Path
from model.finetune import (
    finetune_phase,
    load_instructions,
    instruction_diagnostics,
    example_ids,
    split_instructions,
    finetune,
)
from model.tokenizer import CharTokenizer
from model.transformer import TinyGPT, GPTConfig


def setup_model(rows):
    tok = CharTokenizer(
        "".join(x["question"] + x["answer"] for x in rows) + "Question : \nRéponse :"
    )
    return (
        TinyGPT(
            GPTConfig(
                vocab_size=tok.vocab_size,
                d_model=4,
                n_heads=1,
                n_layers=1,
                block_size=96,
            )
        ),
        tok,
    )


def test_plan_sft_reserves_validation_and_does_not_consult_test():
    rows = load_instructions("model/data/instructions_fr.json")
    m, t = setup_model(rows)
    r, test = finetune_phase(
        m, t, {"instructions": "model/data/instructions_fr.json", "steps": 2}
    )
    assert r["split"] == {"train": 210, "validation": 58, "test": 26}
    assert len(test) == 26 and r["test_consulted"] is False
    assert "test_loss" not in r
    assert np.isfinite(r["validation_loss_end"])
    assert len(set(r["split_sha256"].values())) == 3


def test_small_sft_requires_explicit_diagnostic_and_reports_coverage(tmp_path):
    rows = [{"question": "salut", "answer": "bonjour"}]
    m, t = setup_model(rows)
    p = tmp_path / "instructions.json"
    p.write_text(json.dumps(rows))
    with pytest.raises(ValueError, match="diagnostic_train"):
        finetune_phase(m, t, {"instructions": str(p), "steps": 1})
    r, test = finetune_phase(
        m, t, {"instructions": str(p), "steps": 1, "diagnostic_train": True}
    )
    assert not test and "diagnostic" in r["evaluation"]
    assert r["diagnostics"]["train"]["target_tokens"] > 0
    bad = rows + [{"question": "🤖", "answer": "🦄"}]
    assert instruction_diagnostics(t, bad, 96)["unknown_alphabet"] == 1


def test_explicit_instruction_splits_reject_shared_groups(tmp_path):
    rows = [{"question": "salut", "answer": "bonjour"}]
    m, t = setup_model(rows)
    a = tmp_path / "a.json"
    b = tmp_path / "b.json"
    a.write_text(json.dumps(rows))
    b.write_text(json.dumps(rows))
    with pytest.raises(ValueError, match="communs"):
        finetune_phase(m, t, {"instructions": str(a), "validation": str(b), "steps": 1})


def test_reordering_preserves_groups_and_cross_phase_leaks_are_blocked(tmp_path):
    from model.gpt_train import save_checkpoint, load_checkpoint

    rows = load_instructions("model/data/instructions_fr.json")
    assert split_instructions(rows, 0) == split_instructions(list(reversed(rows)), 0)
    m, t = setup_model(rows)
    finetune_phase(
        m, t, {"instructions": "model/data/instructions_fr.json", "steps": 1}
    )
    train, validation, test = split_instructions(rows, 0)
    paths = {}
    for name, part in {"train": test, "validation": validation, "test": train}.items():
        p = tmp_path / (name + ".json")
        p.write_text(json.dumps(part))
        paths[name] = str(p)
    before = {k: v.copy() for k, v in m.params.items()}
    with pytest.raises(ValueError, match="communs"):
        finetune_phase(
            m,
            t,
            {
                "instructions": paths["train"],
                "validation": paths["validation"],
                "test": paths["test"],
                "steps": 1,
            },
        )
    for k in before:
        np.testing.assert_array_equal(before[k], m.params[k])
    checkpoint = tmp_path / "m.npz"
    save_checkpoint(checkpoint, m, t, {})
    loaded, tok, _ = load_checkpoint(checkpoint)
    assert loaded.sft_lineage == m.sft_lineage
    with pytest.raises(ValueError, match="communs"):
        finetune(loaded, tok, test, steps=1)


def test_canonical_split_rejects_unicode_equivalent_reserved_pairs(tmp_path):
    rows = [{"question": "café ?", "answer": "thé"}]
    m, t = setup_model(rows)
    a, b = tmp_path / "a.json", tmp_path / "b.json"
    a.write_text(json.dumps(rows))
    b.write_text(json.dumps([{"question": "cafe\u0301 ?", "answer": "the\u0301"}]))
    with pytest.raises(ValueError, match="communs"):
        finetune_phase(m, t, {"instructions": str(a), "validation": str(b), "steps": 1})


def test_plan_continues_saved_sft_weights_and_keeps_reserved_history(tmp_path):
    from types import SimpleNamespace
    from model.gpt_train import save_checkpoint, load_checkpoint, _run_plan

    rows = load_instructions("model/data/instructions_fr.json")
    model, tok = setup_model(rows)
    item = {
        "mode": "sft",
        "instructions": "model/data/instructions_fr.json",
        "steps": 1,
    }
    finetune_phase(model, tok, item)
    source = tmp_path / "source.npz"
    save_checkpoint(source, model, tok, {})
    plan = tmp_path / "plan.json"
    plan.write_text(json.dumps({"items": [item]}))
    target = tmp_path / "target.npz"
    _run_plan(
        SimpleNamespace(
            plan=plan,
            resume=source,
            seed=0,
            checkpoint=target,
            report=tmp_path / "rapport.json",
            test_final=False,
        )
    )
    loaded, _, _ = load_checkpoint(target)
    assert loaded.sft_lineage == model.sft_lineage
    assert any(
        not np.array_equal(loaded.params[k], model.params[k]) for k in loaded.params
    )


def test_plan_final_test_is_only_requested_after_training(tmp_path):
    from types import SimpleNamespace
    from model.gpt_train import _run_plan, load_checkpoint

    questions = [
        "alpha",
        "bravo",
        "charlie",
        "delta",
        "echo",
        "foxtrot",
        "golf",
        "hotel",
        "india",
        "juliet",
        "kilo",
        "lima",
    ]
    rows = [{"question": q, "answer": str(i)} for i, q in enumerate(questions)]
    text = "Question : " + "".join(questions) + "\nRéponse : 0123456789\n"
    corpus = tmp_path / "corpus.txt"
    corpus.write_text(text * 40)
    instructions = tmp_path / "instructions.json"
    instructions.write_text(json.dumps(rows))
    plan = tmp_path / "plan.json"
    plan.write_text(
        json.dumps(
            {
                "items": [
                    {
                        "mode": "pretrain",
                        "text": str(corpus),
                        "steps": 2,
                        "d_model": 4,
                        "heads": 1,
                        "layers": 1,
                        "block": 32,
                        "batch": 1,
                        "eval_windows": 1,
                        "sample": False,
                    },
                    {"mode": "sft", "instructions": str(instructions), "steps": 1},
                ]
            }
        )
    )
    args = SimpleNamespace(
        plan=plan,
        steps=2,
        lr=0.01,
        batch=1,
        block=32,
        d_model=4,
        heads=1,
        layers=1,
        seed=0,
        eval_windows=1,
        checkpoint=tmp_path / "m.npz",
        report=tmp_path / "r.json",
        test_final=False,
    )
    _run_plan(args)
    r = json.loads(args.report.read_text())["items"][-1]
    assert r["test_consulted"] is False and "test_final" not in r
    args.test_final = True
    _run_plan(args)
    r = json.loads(args.report.read_text())["items"][-1]
    assert r["test_consulted"] is True and r["test_final"]["examples"] >= 1
    _, _, meta = load_checkpoint(args.checkpoint)
    assert meta["plan"][-1]["test_consulted"] is True
