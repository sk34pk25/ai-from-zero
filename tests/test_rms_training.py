import numpy as np
from model.autograd import Tensor, rmsnorm
from model.gpt_train import train_gpt, bind_parameters, logits_tensor, sequence_loss
from model.transformer import GPTConfig, TinyGPT


def test_rmsnorm_values_and_gradients_against_independent_formula():
    rng = np.random.default_rng(9)
    raw = rng.normal(size=(2, 3))
    gain = rng.normal(size=3)
    received = rng.normal(size=raw.shape)
    x, g = Tensor(raw.copy()), Tensor(gain.copy())
    out = rmsnorm(x, g)
    expected = raw / np.sqrt(np.mean(raw**2, axis=-1, keepdims=True) + 1e-5) * gain
    np.testing.assert_allclose(out.data, expected, atol=1e-12)
    (out * received).sum().backward()

    def f(a, b):
        return np.sum(
            a / np.sqrt(np.mean(a**2, axis=-1, keepdims=True) + 1e-5) * b * received
        )

    for array, grad, argument in ((raw, x.grad, 0), (gain, g.grad, 1)):
        for index in np.ndindex(array.shape):
            high, low = array.copy(), array.copy()
            high[index] += 1e-6
            low[index] -= 1e-6
            numeric = (
                (f(high, gain) - f(low, gain)) / 2e-6
                if argument == 0
                else (f(raw, high) - f(raw, low)) / 2e-6
            )
            np.testing.assert_allclose(grad[index], numeric, atol=1e-7)


def test_rms_decoder_matches_forward_has_attention_gradient_and_trains():
    model = TinyGPT(
        GPTConfig(
            vocab_size=7, d_model=8, n_heads=2, n_layers=2, block_size=8, norm="rms"
        )
    )
    ids = np.array([[1, 2, 1, 4], [2, 3, 4, 1]])
    expected, _ = model.forward(ids)
    p = bind_parameters(model)
    np.testing.assert_allclose(
        logits_tensor(p, ids, model.config).data, expected, atol=1e-12
    )
    sequence_loss(p, ids, model.config).backward()
    assert np.linalg.norm(p["l0.wq"].grad) > 0 and np.linalg.norm(p["nfg"].grad) > 0
    m, _, r = train_gpt(
        "le chat dort.\n" * 50,
        norm="rms",
        steps=20,
        d_model=8,
        n_heads=2,
        n_layers=1,
        block=8,
        batch=2,
        sample=False,
        eval_windows=2,
    )
    assert m.config.norm == "rms" and "nfb" not in m.params
    assert r.train_loss_end < r.train_loss_start
