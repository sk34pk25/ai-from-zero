"""Port du même decoder en opérations PyTorch ; aucun bloc LLM préfabriqué.

Installer requirements-torch.txt séparément. La parité porte sur les logits,
la loss et TOUS les gradients avant toute recherche de vitesse.
"""

import argparse
import json
import time
import numpy as np
from commun import parametres, module_eleve, ecrire_json, empreinte


def norm(x, gain, bias):
    mean = x.mean(dim=-1, keepdim=True)
    variance = ((x - mean) ** 2).mean(dim=-1, keepdim=True)
    return (x - mean) * (variance + 1e-5).rsqrt() * gain + bias


def logits(ids, p, c):
    import torch
    import torch.nn.functional as F

    b, t = ids.shape
    d, heads = c["d"], c["heads"]
    if t > c["block"]:
        raise ValueError("Fenêtre dépassée")
    h = p["tok"][ids] + p["pos"][torch.arange(t, device=ids.device)]
    mask = torch.tril(torch.ones(t, t, dtype=torch.bool, device=ids.device))
    for i in range(c["layers"]):
        prefix = f"{i}."
        n = norm(h, p[prefix + "g1"], p[prefix + "b1"])
        q, k, v = [
            (n @ p[prefix + name]).reshape(b, t, heads, d // heads).permute(0, 2, 1, 3)
            for name in ("wq", "wk", "wv")
        ]
        scores = (q @ k.transpose(-1, -2)) * ((d // heads) ** -0.5)
        weights = torch.softmax(scores.masked_fill(~mask, -1e9), dim=-1)
        h = h + (weights @ v).permute(0, 2, 1, 3).reshape(b, t, d) @ p[prefix + "wo"]
        n = norm(h, p[prefix + "g2"], p[prefix + "b2"])
        h = h + F.gelu(n @ p[prefix + "w1"], approximate="tanh") @ p[prefix + "w2"]
    return norm(h, p["gain"], p["bias"]) @ p["head"]


def perte(z, y):
    import torch

    return (
        torch.logsumexp(z, dim=-1) - z.gather(-1, y.unsqueeze(-1)).squeeze(-1)
    ).mean()


def comparer(module="eleve", device="cpu", steps=20):
    import torch

    if device not in ("cpu", "cuda", "mps") or steps < 1:
        raise ValueError("Appareil ou nombre de pas invalide")
    if device == "cuda" and not torch.cuda.is_available():
        raise ValueError("Accélérateur CUDA/HIP indisponible dans cette installation")
    if device == "mps":
        raise ValueError(
            "Ce contrôle utilise float64, non pris en charge par MPS ; commence sur CPU"
        )
    torch.set_num_threads(1)
    m = module_eleve(module)
    params, config = parametres(11, d=8, layers=2, heads=2, block=6, seed=7)
    ids = np.array([[1, 2, 1, 4], [3, 1, 2, 5]])
    targets = np.array([[2, 1, 4, 6], [1, 2, 5, 7]])
    p = {
        k: torch.tensor(
            v.data.copy(), dtype=torch.float64, device=device, requires_grad=True
        )
        for k, v in params.items()
    }
    x = torch.tensor(ids, dtype=torch.long, device=device)
    y = torch.tensor(targets, dtype=torch.long, device=device)
    expected = m.logits(ids, params, config)
    numpy_loss = m.perte(expected, targets)
    numpy_loss.backward()
    actual = logits(x, p, config)
    torch_loss = perte(actual, y)
    torch_loss.backward()
    np.testing.assert_allclose(
        actual.detach().cpu().numpy(), expected.data, rtol=1e-8, atol=1e-10
    )
    np.testing.assert_allclose(
        torch_loss.item(), float(numpy_loss.data), rtol=1e-9, atol=1e-11
    )
    errors = {}
    for name in p:
        gradient = p[name].grad.detach().cpu().numpy()
        np.testing.assert_allclose(
            gradient, params[name].grad, rtol=1e-7, atol=1e-9, err_msg=name
        )
        errors[name] = float(np.max(np.abs(gradient - params[name].grad)))
    optimizer = torch.optim.AdamW(
        [
            {"params": [v for v in p.values() if v.ndim >= 2], "weight_decay": 0.01},
            {"params": [v for v in p.values() if v.ndim < 2], "weight_decay": 0.0},
        ],
        lr=0.005,
        betas=(0.9, 0.95),
    )
    if device == "cuda":
        torch.cuda.synchronize()
    start = time.perf_counter()
    for _ in range(steps):
        optimizer.zero_grad()
        loss = perte(logits(x, p, config), y)
        loss.backward()
        optimizer.step()
    if device == "cuda":
        torch.cuda.synchronize()
    seconds = time.perf_counter() - start
    return {
        "format": "afz-parite-torch-v1",
        "module": module,
        "code_sha256": empreinte(m.__file__),
        "torch": torch.__version__,
        "numpy": np.__version__,
        "device": device,
        "dtype": "float64",
        "logits_max_abs_error": float(
            np.max(np.abs(actual.detach().cpu().numpy() - expected.data))
        ),
        "gradient_max_abs_error": max(errors.values()),
        "gradients": errors,
        "loss_start": float(numpy_loss.data),
        "loss_end": perte(logits(x, p, config), y).item(),
        "steps": steps,
        "seconds": seconds,
        "limite": "Parité numérique puis surapprentissage d'un seul lot ; ni benchmark de généralisation ni comparaison CPU/GPU à lui seul.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--module", default="eleve")
    parser.add_argument("--device", default="cpu")
    parser.add_argument("--steps", type=int, default=20)
    parser.add_argument("--rapport")
    a = parser.parse_args()
    result = comparer(a.module, a.device, a.steps)
    if a.rapport:
        ecrire_json(a.rapport, result, (module_eleve(a.module).__file__, __file__))
    print(json.dumps(result, ensure_ascii=False, indent=2))
