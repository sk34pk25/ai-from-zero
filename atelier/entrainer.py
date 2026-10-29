"""Entraîne uniquement le modèle que ton module eleve construit.

Aucun import depuis le laboratoire model/. Le test final se mesure séparément
avec evaluer.py, après choix sur validation.
"""

import argparse
import json
import math
from pathlib import Path
import time
import numpy as np
from commun import module_eleve, parametres, empreinte, sauver, charger


def charger_texte(path):
    return Path(path).read_text(encoding="utf-8")


def ids_couverts(m, text, vocab):
    unknown = sum(c not in vocab for c in text)
    return (
        np.array(
            m.encoder("".join(c if c in vocab else "�" for c in text), vocab),
            dtype=np.int64,
        ),
        unknown,
    )


def evaluer(m, p, c, ids, max_windows=32):
    if len(ids) <= c["block"]:
        raise ValueError("Plus de tokens que la fenêtre sont requis")
    starts = np.unique(
        np.linspace(
            0,
            len(ids) - c["block"] - 1,
            min(max_windows, len(ids) - c["block"]),
            dtype=int,
        )
    )
    batch = np.stack([ids[i : i + c["block"] + 1] for i in starts])
    return float(m.perte(m.logits(batch[:, :-1], p, c), batch[:, 1:]).data)


def baseline_bigram(train, validation, vocab, block):
    counts = np.ones((vocab, vocab))
    np.add.at(counts, (train[:-1], train[1:]), 1)
    probs = counts / counts.sum(-1, keepdims=True)
    starts = np.unique(
        np.linspace(
            0, len(validation) - block - 1, min(32, len(validation) - block), dtype=int
        )
    )
    losses = [
        -np.log(probs[validation[i : i + block], validation[i + 1 : i + block + 1]])
        for i in starts
    ]
    return float(np.mean(losses))


def entrainer(
    module,
    train_path,
    val_path,
    out,
    steps=160,
    d=16,
    layers=1,
    heads=2,
    block=16,
    batch=4,
    seed=0,
    lr=0.005,
):
    if steps < 2 or batch < 1 or lr <= 0:
        raise ValueError("Pas, batch et learning rate invalides")
    out = Path(out)
    if out.exists() and any(out.iterdir()):
        raise ValueError("Choisis un dossier de run vide")
    m = module_eleve(module)
    train_text = charger_texte(train_path)
    val_text = charger_texte(val_path)
    if empreinte(train_path) == empreinte(val_path):
        raise ValueError("Train et validation sont identiques")
    vocab = m.vocabulaire(train_text + "�")
    train, _ = ids_couverts(m, train_text, vocab)
    val, unknown = ids_couverts(m, val_text, vocab)
    if len(train) <= block or len(val) <= block:
        raise ValueError("Corpus trop court pour ce bloc")
    p, c = parametres(len(vocab), d, layers, heads, block, seed)
    rng = np.random.default_rng(seed)
    initial = {n: v.data.copy() for n, v in p.items()}
    history = []
    state = {}
    best = float("inf")
    start = time.perf_counter()
    out.mkdir(parents=True, exist_ok=True)
    first_train = evaluer(m, p, c, train)
    first_val = evaluer(m, p, c, val)
    for step in range(1, steps + 1):
        starts = rng.integers(0, len(train) - block, size=batch)
        windows = np.stack([train[i : i + block + 1] for i in starts])
        for v in p.values():
            v.zero_grad()
        loss = m.perte(m.logits(windows[:, :-1], p, c), windows[:, 1:])
        loss.backward()
        if not np.isfinite(float(loss.data)):
            raise ValueError("Loss non finie : vérifier gradient et pas")
        m.adamw(p, state, lr)
        if step % 20 == 0 or step == steps:
            v = evaluer(m, p, c, val)
            tr = evaluer(m, p, c, train)
            history.append({"step": step, "train": tr, "validation": v})
            if not np.isfinite(v):
                raise ValueError("Validation non finie")
            if v < best:
                best = v
                sauver(out / "modele.npz", p, vocab, c)
    learned = {n: bool(not np.array_equal(v.data, initial[n])) for n, v in p.items()}
    p, vocab, c = charger(out / "modele.npz")
    x = val[:block][None, :]
    before = m.logits(x, p, c).data.copy()
    p2, _, _ = charger(out / "modele.npz")
    reloaded = bool(np.array_equal(before, m.logits(x, p2, c).data))
    prompt = train[: min(4, block)].tolist()
    generated = list(prompt)
    sample_rng = np.random.default_rng(seed)
    for _ in range(48):
        z = m.logits(np.array([generated[-block:]]), p, c).data[0, -1]
        generated.append(
            m.prochain(z, sample_rng, temperature=0.7, top_k=min(5, len(vocab)))
        )
    report = {
        "format": "afz-atelier-run-v1",
        "module": module,
        "code_sha256": empreinte(m.__file__),
        "moteur_sha256": empreinte(Path(__file__).with_name("moteur.py")),
        "config": c,
        "steps": steps,
        "batch": batch,
        "lr": lr,
        "tokens_vus": steps * batch * block,
        "parameter_count": sum(v.data.size for v in p.values()),
        "seconds": time.perf_counter() - start,
        "train_sha256": empreinte(train_path),
        "validation_sha256": empreinte(val_path),
        "validation_caracteres_inconnus": unknown,
        "validation_caracteres_total": len(val_text),
        "train_loss_start": first_train,
        "train_loss_end": evaluer(m, p, c, train),
        "val_loss_start": first_val,
        "val_loss_end": best,
        "baselines": {
            "uniforme": math.log(len(vocab)),
            "bigramme": baseline_bigram(train, val, len(vocab), block),
        },
        "history": history,
        "poids_modifies": learned,
        "rechargement_identique": reloaded,
        "echantillon": m.decoder(generated, vocab),
        "selection": "meilleure loss validation ; test non consulté",
        "limite": "Fenêtres fixes échantillonnées ; corpus jouet ou documents à décrire. Ne prouve pas un assistant général.",
    }
    (out / "rapport.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return report


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--module", default="eleve")
    p.add_argument(
        "--train", type=Path, default=Path(__file__).with_name("demo") / "train.txt"
    )
    p.add_argument(
        "--validation",
        type=Path,
        default=Path(__file__).with_name("demo") / "validation.txt",
    )
    p.add_argument("--out", type=Path, required=True)
    for n, v in [
        ("steps", 160),
        ("d", 16),
        ("layers", 1),
        ("heads", 2),
        ("block", 16),
        ("batch", 4),
        ("seed", 0),
    ]:
        p.add_argument("--" + n, type=int, default=v)
    p.add_argument("--lr", type=float, default=0.005)
    a = p.parse_args()
    print(
        json.dumps(
            entrainer(
                a.module,
                a.train,
                a.validation,
                a.out,
                a.steps,
                a.d,
                a.layers,
                a.heads,
                a.block,
                a.batch,
                a.seed,
                a.lr,
            ),
            ensure_ascii=False,
            indent=2,
        )
    )
