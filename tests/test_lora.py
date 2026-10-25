"""LoRA et masque de perte, sur un modèle minuscule."""

import numpy as np
import pytest

from model.autograd import Tensor, cross_entropy
from model.finetune import compare_finetunes, example_ids, finetune, masked_cross_entropy
from model.lora import apply_lora_numpy, init_lora, trainable_count
from model.tokenizer import CharTokenizer
from model.transformer import GPTConfig, TinyGPT


def test_lora_starts_at_the_base_model():
    config = GPTConfig(vocab_size=8, d_model=8, n_heads=2, n_layers=1, block_size=8, seed=1)
    model = TinyGPT(config)
    factors = init_lora(model.params, rank=2, seed=0)
    assert trainable_count(factors) < model.parameter_count()
    merged = apply_lora_numpy(model.params, factors)
    assert merged["l0.wq"] == pytest.approx(model.params["l0.wq"])


def test_mask_matches_full_cross_entropy_and_ignores_prompt():
    logits = Tensor(np.array([[0.2, -0.1, 0.4], [1.0, 0.0, -1.0]]))
    targets = np.array([2, 0])
    full = cross_entropy(logits, targets)
    masked = masked_cross_entropy(Tensor(logits.data.copy()), targets, np.ones(2))
    assert float(masked.data) == pytest.approx(float(full.data))
    prompt_only = masked_cross_entropy(Tensor(logits.data.copy()), targets, np.array([0.0, 1.0]))
    assert float(prompt_only.data) != pytest.approx(float(full.data))


def test_full_finetune_and_lora_both_train():
    text = "Question : salut\nRéponse : bonjour\n" * 8
    tokenizer = CharTokenizer(text)
    rows = [{"question": "salut", "answer": "bonjour"}]
    built = example_ids(tokenizer, "salut", "bonjour")
    assert built is not None
    ids, mask = built
    assert any(mask)
    assert tokenizer.decode(ids).startswith("Question :")
    config = GPTConfig(vocab_size=tokenizer.vocab_size, d_model=8, n_heads=2, n_layers=1, block_size=48, seed=2)
    model = TinyGPT(config)
    compared = compare_finetunes(model, tokenizer, rows * 4, steps=12, lr=0.08, rank=2, seed=1)
    assert compared["lora"]["trainable"] < compared["full"]["trainable"]
    assert compared["full"]["loss_end"] < compared["full"]["loss_start"]
    assert compared["lora"]["loss_end"] < compared["lora"]["loss_start"]
    tuned = finetune(compared["full_model"], tokenizer, rows, steps=2, lr=0.05, lora_rank=None)
    assert tuned["steps"] == 2
