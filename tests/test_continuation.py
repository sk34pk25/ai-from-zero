import numpy as np
from model.gpt_train import train_gpt, save_checkpoint, load_checkpoint
from model.finetune import split_instructions


def test_checkpoint_resume_matches_uninterrupted(tmp_path):
    text = "ab ba ab ba\n" * 100
    args = dict(
        block=4,
        batch=2,
        d_model=8,
        n_heads=2,
        n_layers=1,
        seed=2,
        sample=False,
        eval_windows=2,
        schedule="cosine",
        warmup=1,
    )
    complete, _, _ = train_gpt(text, steps=4, total_steps=4, **args)
    first, tok, _ = train_gpt(text, steps=2, total_steps=4, **args)
    path = tmp_path / "resume.npz"
    save_checkpoint(path, first, tok, {})
    restored, tok, _ = load_checkpoint(path)
    resumed, _, _ = train_gpt(
        text, steps=2, tokenizer=tok, initial_model=restored, resume_state=True, **args
    )
    for key in complete.params:
        np.testing.assert_array_equal(complete.params[key], resumed.params[key])


def test_second_phase_keeps_learned_weights():
    args = dict(
        steps=2,
        block=4,
        batch=1,
        d_model=4,
        n_heads=1,
        n_layers=1,
        sample=False,
        eval_windows=1,
    )
    a, tok, _ = train_gpt("ab " * 200, **args)
    ab, _, _ = train_gpt("ba " * 200, initial_model=a, tokenizer=tok, **args)
    b, _, _ = train_gpt("ba " * 200, tokenizer=tok, **args)
    assert any(not np.array_equal(ab.params[k], b.params[k]) for k in b.params)


def test_instruction_groups_are_disjoint():
    import json

    payload = json.loads(
        __import__("pathlib").Path("model/data/instructions_fr.json").read_text()
    )
    rows = payload["items"] if isinstance(payload, dict) else payload
    rows.append(dict(rows[0]))
    train, val, test = split_instructions(rows)
    assert train and val and test
    sets = [set(x["answer"] for x in part) for part in (train, val, test)]
    assert not sets[0] & sets[1] and not sets[0] & sets[2] and not sets[1] & sets[2]


def test_weight_only_checkpoint_cannot_claim_exact_resume():
    import pytest

    args = dict(
        steps=2,
        block=4,
        batch=1,
        d_model=4,
        n_heads=1,
        n_layers=1,
        sample=False,
        eval_windows=1,
    )
    model, tok, _ = train_gpt("ab " * 200, **args)
    del model.training_state
    with pytest.raises(ValueError, match="état complet"):
        train_gpt(
            "ab " * 200, tokenizer=tok, initial_model=model, resume_state=True, **args
        )
