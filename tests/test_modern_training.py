"""RoPE, SwiGLU, GQA et poids partagés : le backward du laboratoire couvre chaque variante.

Trois preuves indépendantes par variante : le forward autograd reproduit le
forward NumPy de l'inférence, chaque gradient égale sa différence finie
centrée, et quelques pas d'AdamW font baisser la loss.
"""

import numpy as np
import pytest

from model.autograd import Tensor, repeat_kv, rope
from model.attention import apply_rope, rope_cos_sin
from model.attention import repeat_kv as numpy_repeat_kv
from model.gpt_train import (
    AdamW,
    bind_parameters,
    logits_tensor,
    numpy_sequence_loss,
    sequence_loss,
    train_gpt,
)
from model.lora import lora_names
from model.mathutil import silu
from model.transformer import GPTConfig, TinyGPT

VARIANTS = {
    "rope": dict(pos="rope"),
    "swiglu": dict(ffn="swiglu"),
    "gqa": dict(n_heads=4, n_kv_heads=2),
    "mqa": dict(n_heads=4, n_kv_heads=1),
    "tie": dict(tie_weights=True),
    "moderne": dict(
        pos="rope", ffn="swiglu", norm="rms", n_heads=4, n_kv_heads=2, tie_weights=True
    ),
}


def _config(**variant) -> GPTConfig:
    base = dict(vocab_size=7, d_model=8, n_heads=2, n_layers=2, block_size=6, seed=4)
    base.update(variant)
    return GPTConfig(**base)


def _numeric_gradient(model: TinyGPT, name: str, index, batch: np.ndarray) -> float:
    array = model.params[name]
    saved = array[index]
    array[index] = saved + 1e-6
    high = numpy_sequence_loss(model, batch)
    array[index] = saved - 1e-6
    low = numpy_sequence_loss(model, batch)
    array[index] = saved
    return (high - low) / 2e-6


@pytest.mark.parametrize("name", VARIANTS)
def test_variant_forward_matches_inference_and_gradients_match_finite_differences(name):
    model = TinyGPT(_config(**VARIANTS[name]))
    batch = np.array([[1, 2, 1, 4, 0, 3], [2, 3, 4, 1, 1, 6]])
    expected, _ = model.forward(batch[:, :-1])
    params = bind_parameters(model)
    np.testing.assert_allclose(
        logits_tensor(params, batch[:, :-1], model.config).data, expected, atol=1e-12
    )
    loss = sequence_loss(params, batch, model.config)
    assert float(loss.data) == pytest.approx(numpy_sequence_loss(model, batch), abs=1e-12)
    loss.backward()
    rng = np.random.default_rng(0)
    for key, tensor in params.items():
        assert tensor.grad is not None and np.isfinite(tensor.grad).all(), key
        for _ in range(2):
            index = tuple(int(rng.integers(0, size)) for size in tensor.data.shape)
            numeric = _numeric_gradient(model, key, index, batch)
            assert tensor.grad[index] == pytest.approx(numeric, abs=1e-6, rel=1e-4), (
                key,
                index,
            )


@pytest.mark.parametrize("name", ["rope", "swiglu", "gqa", "moderne"])
def test_variant_trains_and_round_trips_through_a_checkpoint(name, tmp_path):
    from model.gpt_train import load_checkpoint, save_checkpoint

    variant = dict(VARIANTS[name])
    heads = variant.pop("n_heads", 2)
    kv = variant.pop("n_kv_heads", None)
    model, tokenizer, result = train_gpt(
        "le chat dort. le chien court.\n" * 40,
        steps=30,
        lr=1e-2,
        d_model=8,
        n_heads=heads,
        n_kv_heads=kv,
        n_layers=1,
        block=8,
        batch=4,
        sample=False,
        eval_windows=4,
        **variant,
    )
    assert result.train_loss_end < result.train_loss_start
    path = tmp_path / "variante.npz"
    save_checkpoint(path, model, tokenizer, {})
    restored, _, _ = load_checkpoint(path)
    assert restored.config == model.config
    ids = np.array([tokenizer.encode("le chat")])
    np.testing.assert_allclose(restored.forward(ids)[0], model.forward(ids)[0])


def test_rope_backward_is_the_inverse_rotation():
    rng = np.random.default_rng(1)
    raw = rng.normal(size=(1, 2, 4, 6))
    received = rng.normal(size=raw.shape)
    cos, sin = rope_cos_sin(np.arange(4), 6)
    states = Tensor(raw.copy())
    out = rope(states, cos, sin)
    np.testing.assert_allclose(out.data, apply_rope(raw, cos, sin), atol=1e-14)
    (out * received).sum().backward()
    # Rotation orthogonale : tourner le gradient à l'envers puis à l'endroit le rend intact.
    np.testing.assert_allclose(apply_rope(states.grad, cos, sin), received, atol=1e-12)


def test_repeat_kv_sums_the_gradients_of_shared_heads():
    raw = np.arange(2 * 2 * 3 * 2, dtype=np.float64).reshape(2, 2, 3, 2)
    states = Tensor(raw.copy())
    out = repeat_kv(states, 3)
    np.testing.assert_array_equal(out.data, numpy_repeat_kv(raw, 3))
    out.sum().backward()
    np.testing.assert_array_equal(states.grad, np.full(raw.shape, 3.0))


def test_silu_value_and_derivative():
    values = np.array([-3.0, -0.5, 0.0, 0.7, 4.0])
    x = Tensor(values.copy())
    out = x.silu()
    np.testing.assert_allclose(out.data, silu(values), atol=1e-15)
    out.sum().backward()
    numeric = (silu(values + 1e-6) - silu(values - 1e-6)) / 2e-6
    np.testing.assert_allclose(x.grad, numeric, atol=1e-8)


def test_tied_head_accumulates_both_gradients_in_the_embedding():
    model = TinyGPT(_config(tie_weights=True))
    assert "head" not in model.params
    params = bind_parameters(model)
    batch = np.array([[1, 2, 3, 4]])
    sequence_loss(params, batch, model.config).backward()
    # Le token 6 n'apparaît pas en entrée : son gradient vient uniquement de la tête.
    assert np.linalg.norm(params["tok"].grad[6]) > 0
    optimizer = AdamW(params, lr=1e-2)
    before = params["tok"].data.copy()
    optimizer.step()
    assert not np.allclose(before, params["tok"].data)


def test_lora_targets_swiglu_matrices():
    model = TinyGPT(_config(ffn="swiglu"))
    names = lora_names(model.params)
    assert {"l0.wg", "l0.wu", "l0.wd"} <= set(names)
