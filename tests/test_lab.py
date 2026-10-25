"""Tests du laboratoire NumPy."""

import math
from pathlib import Path

import numpy as np
import pytest

from model.attention import apply_rope, causal_mask, rope_cos_sin, scaled_dot_product_attention
from model.backbone import Backbone
from model.bench import attention_flops, ffn_flops, parameter_bytes, quality_table
from model.bigram import BigramModel
from model.experiment import bigram_versus_uniform, run_ablation
from model.mathutil import cross_entropy, cross_entropy_grad, numerical_derivative, rmsnorm, softmax
from model.memory import build_context, retrieve
from model.mlp import mlp_forward, neuron, relu, train_linear_regression
from model.moe import load_balance_loss, moe_ffn
from model.multimodal import patchify, project_patches
from model.ssm import parallel_affine, selective_scan, sequential_affine
from model.stats import build_report, summarize
from model.tokenizer import CharTokenizer, MiniBPE, visualize
from model.train import train_linear_classifier
from model.transformer import GPTConfig, TinyGPT, generate


ROOT = Path(__file__).resolve().parents[1]


def test_summary_and_report(tmp_path):
    source = ROOT / "model" / "data" / "mesures.txt"
    destination = tmp_path / "rapport.json"
    report = build_report(source, destination)
    assert report["n"] == 7
    assert report["mean"] == pytest.approx(summarize([1.5, 2, 2.5, 3, 4, 3.5, 2.25])["mean"])
    assert destination.read_text(encoding="utf-8").startswith("{")


def test_neuron_and_regression():
    assert neuron(np.array([2.0, 3.0]), np.array([0.5, -0.2]), 0.1) == pytest.approx(0.5)
    assert relu(np.array([-2.0, 0.0, 3.0])).tolist() == [0.0, 0.0, 3.0]
    hidden = mlp_forward(
        np.array([[1.0, -1.0]]),
        np.array([[1.0, 0.0], [0.0, 1.0]]),
        np.array([0.0, 0.0]),
        np.array([[2.0], [4.0]]),
        np.array([0.0]),
    )
    assert hidden[0, 0] == pytest.approx(2.0)
    x = np.linspace(-1, 1, 21)
    y = 3 * x - 1
    trained = train_linear_regression(x, y, steps=200, lr=0.2, seed=1)
    assert trained["losses"][-1] < trained["losses"][0]
    assert trained["w"] == pytest.approx(3, abs=0.05)
    assert trained["b"] == pytest.approx(-1, abs=0.05)


def test_derivative_matches_square():
    slope = numerical_derivative(lambda value: value * value, 3.0)
    assert slope == pytest.approx(6.0, abs=1e-4)


def test_tokenizer_roundtrip_and_bpe():
    text = "bonjour bonjour"
    tokenizer = CharTokenizer(text)
    assert tokenizer.decode(tokenizer.encode(text)) == text
    assert "b|" in visualize(tokenizer, "bon")
    with pytest.raises(KeyError):
        tokenizer.encode("z")
    bpe = MiniBPE("banana bandana", num_merges=8)
    encoded = bpe.encode("banana")
    assert bpe.decode(encoded) == "banana"
    assert len(encoded) < len("banana")


def test_bigram_beats_uniform_and_samples():
    ids = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
    model = BigramModel(2)
    model.observe(ids)
    assert model.probabilities()[0, 1] > 0.8
    assert model.perplexity(ids) < 2
    rng = np.random.default_rng(0)
    generated = model.generate(0, 6, rng, temperature=0)
    assert generated[0] == 0
    assert set(generated) <= {0, 1}
    comparison = bigram_versus_uniform(ids * 5, 2)
    assert comparison["bigram_perplexity"] < comparison["uniform_perplexity"]


def test_softmax_and_cross_entropy_gradient():
    logits = np.array([[2.0, 0.0, 0.0], [0.0, 0.0, 0.0]])
    probs = softmax(logits, axis=-1)
    assert probs.sum(axis=-1) == pytest.approx([1, 1])
    targets = np.array([0, 1])
    analytic = cross_entropy_grad(logits, targets)
    numerical = np.zeros_like(logits)
    for row in range(2):
        for col in range(3):
            def loss(value, row=row, col=col):
                trial = logits.copy()
                trial[row, col] = value
                return cross_entropy(trial, targets)

            numerical[row, col] = numerical_derivative(loss, logits[row, col], eps=1e-5)
    assert analytic == pytest.approx(numerical, abs=1e-4)


def test_attention_is_causal_and_rope_preserves_norm():
    query = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
    _, weights = scaled_dot_product_attention(query, query, query, causal=True)
    assert weights.sum(axis=-1) == pytest.approx(np.ones(3))
    assert weights[0, 1] == pytest.approx(0.0)
    assert weights[0, 2] == pytest.approx(0.0)
    mask = causal_mask(np.array([1, 2]), np.array([0, 1, 2]))
    assert mask.tolist() == [[True, True, False], [True, True, True]]
    states = np.random.default_rng(0).normal(size=(2, 3, 4, 8))
    cos, sin = rope_cos_sin(np.arange(4), 8)
    rotated = apply_rope(states, cos, sin)
    assert np.linalg.norm(rotated, axis=-1) == pytest.approx(np.linalg.norm(states, axis=-1))


def test_transformer_shapes_cache_and_causality():
    config = GPTConfig(vocab_size=12, d_model=16, n_heads=4, n_layers=2, block_size=8, seed=2)
    model = TinyGPT(config)
    other = TinyGPT(config)
    idx = np.array([[1, 2, 3, 4, 5]])
    logits, cache = model.forward(idx)
    same, _ = other.forward(idx)
    assert logits.shape == (1, 5, 12)
    assert same == pytest.approx(logits)
    assert model.parameter_count() > 100
    changed = idx.copy()
    changed[0, -1] = 9
    past, _ = model.forward(changed)
    assert past[0, 0] == pytest.approx(logits[0, 0])
    assert past[0, 2] == pytest.approx(logits[0, 2])
    assert not np.allclose(past[0, -1], logits[0, -1])
    first, cache = model.forward(idx[:, :3])
    second, _ = model.forward(idx[:, 3:], cache=cache)
    assert first[0] == pytest.approx(logits[0, :3])
    assert second[0, -1] == pytest.approx(logits[0, -1])
    greedy = generate(model, np.array([[1]]), 3, np.random.default_rng(0), temperature=0)
    assert greedy.shape == (1, 4)
    assert greedy[0, 0] == 1


def test_modern_options_keep_contract():
    base = dict(vocab_size=10, d_model=16, n_heads=4, n_layers=1, block_size=6, seed=0)
    modern = TinyGPT(GPTConfig(**base, n_kv_heads=2, ffn="swiglu", norm="rms", pos="rope", tie_weights=True))
    plain = TinyGPT(GPTConfig(**base))
    idx = np.array([[1, 2, 3, 4]])
    modern_logits, _ = modern.forward(idx)
    plain_logits, _ = plain.forward(idx)
    assert modern_logits.shape == plain_logits.shape == (1, 4, 10)
    assert "head" not in modern.params
    assert modern.parameter_count() != plain.parameter_count()


def test_classifier_loss_decreases():
    rng = np.random.default_rng(0)
    features = rng.normal(size=(40, 6))
    weights = rng.normal(size=(6, 4))
    targets = np.argmax(features @ weights, axis=1)
    trained = train_linear_classifier(features, targets, n_classes=4, steps=100, lr=0.5, seed=1)
    assert trained["losses"][-1] < trained["losses"][0] * 0.7


def test_bench_formulas_and_table():
    assert parameter_bytes(1_000_000, "fp16", "adam") == pytest.approx(1_000_000 * 2 + 1_000_000 * 8)
    assert attention_flops(2, 4, 1) == 8 * 2 * 4 * 4 + 4 * 2 * 2 * 4
    assert ffn_flops(2, 4, 8, 1, gated=True) == 3 * 2 * 2 * 4 * 8
    table = quality_table(
        [
            {"name": "petit", "quality": 1.0, "seconds": 2.0, "ram_bytes": 10},
            {"name": "bon", "quality": 2.0, "seconds": 3.0, "ram_bytes": 50},
        ]
    )
    assert [row["name"] for row in table] == ["bon", "petit"]


def test_moe_routes_and_balance():
    experts = []
    for index in range(2):
        experts.append(
            {
                "w1": np.eye(2) * (index + 1),
                "b1": np.zeros(2),
                "w2": np.eye(2),
                "b2": np.zeros(2),
            }
        )
    tokens = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [0.5, 0.0]])
    router = np.array([[5.0, -5.0], [5.0, -5.0]])
    routed = moe_ffn(tokens, experts, router, k=1, capacity_factor=4)
    assert routed["output"].shape == tokens.shape
    assert routed["choices"][:, 0].tolist() == [0, 0, 0, 0]
    probs = np.array([[1.0, 0.0], [1.0, 0.0]])
    assert load_balance_loss(probs, np.array([0, 0])) == pytest.approx(2.0)
    uniform = np.full((4, 2), 0.5)
    assert load_balance_loss(uniform, np.array([0, 1, 0, 1])) == pytest.approx(1.0)
    tight = moe_ffn(tokens, experts, router, k=1, capacity_factor=0.1)
    assert tight["dropped"] > 0


def test_ssm_matches_scan_and_is_causal():
    signal = np.array([[1.0, 0.0], [0.0, 1.0], [0.5, -0.5]])
    output = selective_scan(
        signal,
        np.array([-0.2, -0.4]),
        np.ones_like(signal),
        np.ones_like(signal),
        np.full_like(signal, 0.5),
    )
    altered = signal.copy()
    altered[-1] = 9
    assert selective_scan(altered, np.array([-0.2, -0.4]), np.ones_like(signal), np.ones_like(signal), np.full_like(signal, 0.5))[0] == pytest.approx(output[0])
    rng = np.random.default_rng(0)
    scales = rng.uniform(0.1, 0.9, size=17)
    shifts = rng.normal(size=17)
    assert parallel_affine(scales, shifts, h0=0.3) == pytest.approx(sequential_affine(scales, shifts, h0=0.3))


def test_backbone_kinds_share_shape_and_are_causal():
    idx = np.array([[1, 2, 3, 4]])
    outputs = {}
    for kind in ("transformer", "ssm", "hybrid"):
        model = Backbone(kind, vocab_size=8, d_model=8, n_layers=2, block_size=6, seed=3)
        hidden = model.forward(idx)
        assert hidden.shape == (1, 4, 8)
        outputs[kind] = hidden
        changed = idx.copy()
        changed[0, -1] = 7
        assert model.forward(changed)[0, 0] == pytest.approx(hidden[0, 0])
    assert len(outputs) == 3


def test_patches_and_retrieval():
    image = np.arange(16, dtype=np.float64).reshape(4, 4)
    patches = patchify(image, 2)
    assert patches.shape == (4, 4)
    assert patches[0].tolist() == [0, 1, 4, 5]
    projected = project_patches(patches, np.ones((4, 2)), np.zeros(2))
    assert projected.shape == (4, 2)
    documents = [
        "le gradient indique la pente de la loss",
        "le tokenizer decoupe le texte",
        "la vram stocke les activations du gpu",
    ]
    hits = retrieve("pente de la loss", documents, k=1)
    assert hits[0]["index"] == 0
    assert "Question" in build_context("tokenizer", documents, k=1)


def test_ablation_keeps_names():
    rows = run_ablation(
        [{"name": "baseline", "lr": 0.1}, {"name": "variante", "lr": 0.2}],
        lambda config: {"loss": 1.0 / config["lr"]},
    )
    assert [row["name"] for row in rows] == ["baseline", "variante"]
    assert rows[1]["loss"] < rows[0]["loss"]


def test_gpt_gradients_match_finite_differences():
    from model.autograd import Tensor, layernorm
    from model.gpt_train import bind_parameters, logits_tensor, sequence_loss

    values = Tensor(np.array([-1.2, 0.0, 0.8]))
    values.gelu().sum().backward()
    for index, point in enumerate(values.data):
        def gelu_at(candidate, index=index):
            trial = values.data.copy()
            trial[index] = candidate
            return float(Tensor(trial).gelu().sum().data)

        assert values.grad[index] == pytest.approx(numerical_derivative(gelu_at, float(point), eps=1e-5), abs=1e-5)

    hidden = Tensor(np.array([[0.2, -0.4, 0.7, 1.1], [-0.3, 0.5, -1.2, 0.2]]))
    gain = Tensor(np.array([1.0, 0.8, 1.2, 0.5]))
    bias = Tensor(np.array([0.1, -0.2, 0.0, 0.3]))
    layernorm(hidden, gain, bias).sum().backward()

    def ln_input(candidate):
        trial = hidden.data.copy()
        trial[0, 1] = candidate
        return float(layernorm(Tensor(trial), Tensor(gain.data.copy()), Tensor(bias.data.copy())).sum().data)

    def ln_gain(candidate):
        trial = gain.data.copy()
        trial[2] = candidate
        return float(layernorm(Tensor(hidden.data.copy()), Tensor(trial), Tensor(bias.data.copy())).sum().data)

    assert hidden.grad[0, 1] == pytest.approx(numerical_derivative(ln_input, float(hidden.data[0, 1]), eps=1e-5), abs=1e-4)
    assert gain.grad[2] == pytest.approx(numerical_derivative(ln_gain, float(gain.data[2]), eps=1e-5), abs=1e-4)

    left = Tensor(np.random.default_rng(0).normal(size=(2, 3, 4)))
    right = Tensor(np.random.default_rng(1).normal(size=(4, 5)))
    left.matmul(right).sum().backward()

    def matmul_at(candidate):
        trial = right.data.copy()
        trial[1, 2] = candidate
        return float(Tensor(left.data.copy()).matmul(Tensor(trial)).sum().data)

    assert right.grad[1, 2] == pytest.approx(numerical_derivative(matmul_at, float(right.data[1, 2]), eps=1e-5), abs=1e-4)

    config = GPTConfig(vocab_size=6, d_model=4, n_heads=2, n_layers=1, block_size=4, seed=3)
    model = TinyGPT(config)
    params = bind_parameters(model)
    batch = np.array([[1, 2, 3, 4, 0]])
    numpy_logits, _ = model.forward(batch[:, :-1])
    assert logits_tensor(params, batch[:, :-1], config).data == pytest.approx(numpy_logits, abs=1e-8)
    for tensor in params.values():
        tensor.zero_grad()
    sequence_loss(params, batch, config).backward()
    saved = float(params["l0.wq"].grad[0, 1])
    eps = 1e-5
    params["l0.wq"].data[0, 1] += eps
    higher = float(sequence_loss(params, batch, config).data)
    params["l0.wq"].data[0, 1] -= 2 * eps
    lower = float(sequence_loss(params, batch, config).data)
    params["l0.wq"].data[0, 1] += eps
    assert saved == pytest.approx((higher - lower) / (2 * eps), abs=1e-4)


def test_gpt_trains_checkpoints_and_samples(tmp_path):
    from model.gpt_train import load_checkpoint, sample_text, save_checkpoint, train_gpt

    text = "le chat dort dans le bois.\nle chat mange.\n" * 20
    model, tokenizer, result = train_gpt(
        text,
        steps=30,
        lr=0.05,
        batch=4,
        block=12,
        d_model=8,
        n_heads=2,
        n_layers=1,
        seed=0,
        sample=False,
        val_every=30,
        weight_decay=0.0,
    )
    assert result.train_loss_end < result.train_loss_start * 0.5
    assert result.val_loss_end < result.val_loss_start
    path = tmp_path / "gpt.npz"
    save_checkpoint(path, model, tokenizer, {"steps": result.steps})
    loaded, loaded_tokenizer, history = load_checkpoint(path)
    assert history["steps"] == 30
    idx = np.asarray(tokenizer.encode("le chat do"))[None, :]
    original, _ = model.forward(idx)
    restored, _ = loaded.forward(idx)
    assert restored == pytest.approx(original)
    first = sample_text(loaded, loaded_tokenizer, "le chat ", 16, temperature=0.0, top_k=1, seed=0)
    second = sample_text(loaded, loaded_tokenizer, "le chat ", 16, temperature=0.0, top_k=1, seed=1)
    assert first == second
    assert first.startswith("le chat ")
    assert len(first) == len("le chat ") + 16
    warm = sample_text(loaded, loaded_tokenizer, "le chat ", 24, temperature=0.8, top_k=4, seed=2)
    assert warm.startswith("le chat ")
    assert len(warm) > len(first)


def test_committed_french_gpt_run():
    import json

    from model.gpt_train import load_checkpoint

    report = json.loads((ROOT / "data" / "gpt_run.json").read_text(encoding="utf-8"))
    assert report["dataset_chars"] > 10_000
    assert report["steps"] >= 200
    assert report["train_loss_end"] < report["train_loss_start"] * 0.5
    assert report["val_loss_end"] < report["val_loss_start"] * 0.5
    assert any("dans le" in sample["text"] for sample in report["samples"])
    assert sum(report["attention"]["last_row"]) == pytest.approx(1.0, abs=1e-2)
    model, tokenizer, _history = load_checkpoint(ROOT / "model" / "data" / "gpt_checkpoint.npz")
    assert model.parameter_count() == report["parameter_count"]
    assert tokenizer.vocab_size == report["vocab_size"]
    assert (ROOT / "model" / "data" / "francais.txt").read_text(encoding="utf-8").startswith("le chat ")


def test_gpt_training_refuses_a_modern_variant():
    from model.gpt_train import bind_parameters

    rope = TinyGPT(GPTConfig(vocab_size=8, d_model=8, n_heads=2, n_layers=1, block_size=4, pos="rope", seed=0))
    with pytest.raises(ValueError):
        bind_parameters(rope)


def test_tiny_lm_trains_with_real_backward():
    from model.autograd import Tensor
    from model.tiny_lm import TinyLM, train_tiny_lm
    from model.tokenizer import CharTokenizer

    text = "abababababababab"
    linear = train_tiny_lm(text, steps=40, lr=0.8, seed=0, attention=False)
    assert linear.loss_end < linear.loss_start * 0.5
    attended = train_tiny_lm(text, steps=40, lr=0.8, seed=0, attention=True, d_model=8)
    assert attended.loss_end < attended.loss_start * 0.5
    assert attended.vocab_size == 2
    assert attended.generated

    tokenizer = CharTokenizer(text)
    ids = tokenizer.encode(text)
    model = TinyLM(tokenizer.vocab_size, d_model=8, seed=1, attention=True)
    prefix = model.logits(ids)[0].copy()
    flipped = ids[:-1] + [0 if ids[-1] != 0 else 1]
    assert np.allclose(prefix, model.logits(flipped)[0])

    left = Tensor(np.array([[0.2, -0.1], [0.4, 0.3]]))
    right = Tensor(np.array([[0.5, -0.2], [0.1, 0.7]]))
    (left.matmul(right).sum()).backward()
    saved = right.grad.copy()
    eps = 1e-5
    numeric = np.zeros_like(right.data)
    for index in np.ndindex(right.data.shape):
        plus = right.data.copy()
        minus = right.data.copy()
        plus[index] += eps
        minus[index] -= eps
        higher = float(left.matmul(Tensor(plus)).sum().data)
        lower = float(left.matmul(Tensor(minus)).sum().data)
        numeric[index] = (higher - lower) / (2 * eps)
    assert np.allclose(saved, numeric, atol=1e-6)


def test_uniform_cross_entropy_is_log_vocab():
    logits = np.zeros((4, 5))
    targets = np.array([0, 1, 2, 3])
    assert cross_entropy(logits, targets) == pytest.approx(math.log(5))
