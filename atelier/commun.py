"""Infrastructure du TP : dimensions, initialisation, fichiers. Pas de forward GPT."""

import hashlib
import importlib
import json
from pathlib import Path
import numpy as np
from moteur import Tensor


def module_eleve(name):
    if not name.isidentifier():
        raise ValueError("Nom de module Python simple requis")
    return importlib.import_module(name)


def empreinte(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def parametres(vocab, d=16, layers=1, heads=2, block=16, seed=0):
    if d < 2 or layers < 1 or heads < 1 or d % heads or block < 1:
        raise ValueError("Dimensions invalides")
    rng = np.random.default_rng(seed)
    p = {}

    def weight(name, shape):
        p[name] = Tensor(rng.normal(0, 0.02, shape))

    weight("tok", (vocab, d))
    weight("pos", (block, d))
    weight("head", (d, vocab))
    p["gain"] = Tensor(np.ones(d))
    p["bias"] = Tensor(np.zeros(d))
    for i in range(layers):
        for n in ("wq", "wk", "wv", "wo"):
            weight(f"{i}.{n}", (d, d))
        weight(f"{i}.w1", (d, 4 * d))
        weight(f"{i}.w2", (4 * d, d))
        for n in ("g1", "g2"):
            p[f"{i}.{n}"] = Tensor(np.ones(d))
        for n in ("b1", "b2"):
            p[f"{i}.{n}"] = Tensor(np.zeros(d))
    return p, dict(d=d, layers=layers, heads=heads, block=block, seed=seed)


def sauver(path, p, vocab, config):
    np.savez(
        Path(path),
        **{k: v.data for k, v in p.items()},
        metadata=np.array(json.dumps({"vocab": vocab, "config": config})),
    )


def charger(path):
    with np.load(Path(path), allow_pickle=False) as z:
        meta = json.loads(str(z["metadata"]))
        p = {k: Tensor(z[k]) for k in z.files if k != "metadata"}
    return p, meta["vocab"], meta["config"]
