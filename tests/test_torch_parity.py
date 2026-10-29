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


def _torch_reference_logits(torch, weights, idx, config):
    """Forward PyTorch écrit indépendamment du laboratoire, en float64."""
    functional = torch.nn.functional
    batch, time = idx.shape
    hidden = weights["tok"][idx]
    if config.pos == "absolute":
        hidden = hidden + weights["pos"][:time]

    def norm(values, prefix):
        if config.norm == "rms":
            return values / torch.sqrt((values**2).mean(-1, keepdim=True) + 1e-5) * weights[prefix + "g"]
        mean = values.mean(-1, keepdim=True)
        var = ((values - mean) ** 2).mean(-1, keepdim=True)
        return (values - mean) / torch.sqrt(var + 1e-5) * weights[prefix + "g"] + weights[prefix + "b"]

    def rotate(states):
        dim = states.shape[-1]
        inv = 10000.0 ** (-torch.arange(0, dim, 2, dtype=torch.float64) / dim)
        angles = torch.arange(time, dtype=torch.float64)[:, None] * inv[None, :]
        cos, sin = torch.cos(angles), torch.sin(angles)
        even, odd = states[..., 0::2], states[..., 1::2]
        return torch.stack([even * cos - odd * sin, even * sin + odd * cos], dim=-1).flatten(-2)

    heads, kv, dim = config.n_heads, config.kv_heads, config.head_dim
    mask = torch.tril(torch.ones(time, time, dtype=torch.bool))
    for layer in range(config.n_layers):
        p = f"l{layer}."
        x = norm(hidden, p + "n1")
        q = (x @ weights[p + "wq"]).view(batch, time, heads, dim).transpose(1, 2)
        k = (x @ weights[p + "wk"]).view(batch, time, kv, dim).transpose(1, 2)
        v = (x @ weights[p + "wv"]).view(batch, time, kv, dim).transpose(1, 2)
        if config.pos == "rope":
            q, k = rotate(q), rotate(k)
        k = k.repeat_interleave(heads // kv, dim=1)
        v = v.repeat_interleave(heads // kv, dim=1)
        scores = (q @ k.transpose(-1, -2)) / dim**0.5
        attn = torch.softmax(scores.masked_fill(~mask, -1e9), dim=-1)
        context = (attn @ v).transpose(1, 2).reshape(batch, time, heads * dim)
        hidden = hidden + context @ weights[p + "wo"]
        x = norm(hidden, p + "n2")
        if config.ffn == "swiglu":
            inner = functional.silu(x @ weights[p + "wg"]) * (x @ weights[p + "wu"])
            hidden = hidden + inner @ weights[p + "wd"]
        else:
            inner = functional.gelu(x @ weights[p + "w1"], approximate="tanh")
            hidden = hidden + inner @ weights[p + "w2"]
    hidden = norm(hidden, "nf")
    return hidden @ (weights["tok"].T if config.tie_weights else weights["head"])


@pytest.mark.parametrize(
    "variant",
    [
        {},
        {"pos": "rope", "ffn": "swiglu", "norm": "rms", "n_kv_heads": 2, "tie_weights": True},
        {"pos": "rope", "n_kv_heads": 1},
    ],
)
def test_modern_variants_match_torch_gradients(variant):
    torch = pytest.importorskip("torch")
    import numpy as np

    from model.gpt_train import bind_parameters, sequence_loss
    from model.transformer import GPTConfig, TinyGPT

    config = GPTConfig(vocab_size=9, d_model=16, n_heads=4, n_layers=2, block_size=8, seed=2, **variant)
    model = TinyGPT(config)
    batch = np.array([[1, 2, 3, 4, 5, 6, 7], [8, 7, 6, 5, 4, 3, 2]])
    weights = {k: torch.tensor(v.copy(), dtype=torch.float64, requires_grad=True) for k, v in model.params.items()}
    params = bind_parameters(model)
    loss = sequence_loss(params, batch, config)
    loss.backward()
    idx = torch.tensor(batch[:, :-1])
    logits = _torch_reference_logits(torch, weights, idx, config)
    reference = torch.nn.functional.cross_entropy(
        logits.reshape(-1, config.vocab_size), torch.tensor(batch[:, 1:]).reshape(-1)
    )
    reference.backward()
    assert float(loss.data) == pytest.approx(float(reference.detach()), abs=1e-12)
    for name, tensor in params.items():
        np.testing.assert_allclose(tensor.grad, weights[name].grad.numpy(), atol=1e-10, err_msg=name)
