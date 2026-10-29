"""Banc français documentaire : sélection sur validation, puis test des seuls retenus."""

import argparse
import hashlib
import json
from pathlib import Path
import statistics
from commun import ecrire_json, empreinte, charger, module_eleve
from entrainer import entrainer, ids_couverts, debuts_evaluation
from evaluer import evaluation
from preparer import normaliser
from generer import generer
import numpy as np


def corpus(destination):
    source = Path(__file__).with_name("benchmark") / "textes.json"
    manifest_path = source.with_name("manifest.json")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if empreinte(source) != manifest["source_sha256"]:
        raise ValueError(
            "Le corpus a changé : définir un nouveau protocole avant le test"
        )
    data = json.loads(source.read_text(encoding="utf-8"))
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=False)
    parts = {}
    for name in ("train", "validation", "test"):
        docs = [d for d in data["documents"] if d["split"] == name]
        parts[name] = [
            {
                "document": d["id"],
                "sha256": hashlib.sha256(normaliser(d["text"]).encode()).hexdigest(),
            }
            for d in docs
        ]
        (destination / (name + ".txt")).write_text(
            "\n".join(normaliser(d["text"]) for d in docs), encoding="utf-8"
        )
    ecrire_json(
        destination / "provenance.json",
        {
            "documents": parts,
            "splits": {k: empreinte(destination / (k + ".txt")) for k in parts},
            "licence": data["licence"],
            "source_sha256": manifest["source_sha256"],
        },
    )
    return manifest, data


def benchmark(module, out, steps=240, widths=(16, 24), seeds=(0, 1, 2)):
    if (
        steps < 2
        or not widths
        or not seeds
        or len(set(widths)) != len(widths)
        or len(set(seeds)) != len(seeds)
    ):
        raise ValueError("Budget, largeurs et graines distincts requis")
    out = Path(out)
    if out.exists():
        raise FileExistsError("Nouveau dossier de benchmark requis")
    out.mkdir(parents=True)
    manifest, data = corpus(out / "corpus")
    recipe = {
        "module": module,
        "steps": steps,
        "widths": list(widths),
        "seeds": list(seeds),
        "block": 32,
        "batch": 4,
        "lr": 0.005,
        "selection": "moyenne de loss validation sur les mêmes graines ; test mesuré après le choix de largeur",
        "runner_sha256": empreinte(__file__),
        "prompt_fixe": manifest["prompt_fixe"],
    }
    ecrire_json(out / "recette-avant-test.json", {**recipe, "manifest": manifest})
    runs = []
    for width in widths:
        for seed in seeds:
            folder = out / f"d{width}-graine{seed}"
            r = entrainer(
                module,
                out / "corpus/train.txt",
                out / "corpus/validation.txt",
                folder,
                steps=steps,
                d=width,
                heads=2,
                block=32,
                batch=4,
                seed=seed,
            )
            r["generation_fixe"] = generer(
                module,
                folder / "modele.npz",
                manifest["prompt_fixe"],
                tokens=64,
                seed=seed,
                stop="",
            )
            runs.append({"width": width, "seed": seed, "folder": folder.name, **r})
    means = {
        width: statistics.mean(r["val_loss_end"] for r in runs if r["width"] == width)
        for width in widths
    }
    selected = min(widths, key=lambda width: (means[width], width))
    tests = []
    for r in runs:
        if r["width"] != selected:
            continue
        folder = out / r["folder"]
        test = evaluation(
            module,
            folder / "modele.npz",
            out / "corpus/test.txt",
            folder / "test-final.json",
        )
        p, vocab, config = charger(folder / "modele.npz")
        m = module_eleve(module)
        train, _ = ids_couverts(
            m, (out / "corpus/train.txt").read_text(encoding="utf-8"), vocab
        )
        ids, _ = ids_couverts(
            m, (out / "corpus/test.txt").read_text(encoding="utf-8"), vocab
        )
        counts = np.ones((len(vocab), len(vocab)))
        np.add.at(counts, (train[:-1], train[1:]), 1)
        probs = counts / counts.sum(-1, keepdims=True)
        starts = debuts_evaluation(ids, config["block"], None)
        bigram = float(
            np.mean(
                [
                    -np.log(
                        probs[
                            ids[i : i + config["block"]],
                            ids[i + 1 : i + config["block"] + 1],
                        ]
                    )
                    for i in starts
                ]
            )
        )
        tests.append(
            {
                "seed": r["seed"],
                **test,
                "baselines": {
                    "uniforme": float(np.log(len(vocab))),
                    "bigramme": bigram,
                },
            }
        )
    paired = [
        {
            "seed": seed,
            "validation": {
                str(width): next(
                    r["val_loss_end"]
                    for r in runs
                    if r["seed"] == seed and r["width"] == width
                )
                for width in widths
            },
        }
        for seed in seeds
    ]
    report = {
        "format": "afz-benchmark-v1",
        "recipe": recipe,
        "manifest": manifest,
        "runs": runs,
        "selected_width": selected,
        "validation_means": means,
        "paired": paired,
        "test_final": tests,
        "test_loss_mean": statistics.mean(r["test_loss"] for r in tests),
        "test_loss_std": (
            statistics.stdev(r["test_loss"] for r in tests) if len(tests) > 1 else None
        ),
        "dataset_note": data["limite"],
        "limite": "Petit banc original, documents réservés. Trois graines décrivent une variabilité, pas une preuve statistique de supériorité ni un assistant fiable.",
    }
    ecrire_json(out / "benchmark.json", report)
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--module", default="eleve")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--steps", type=int, default=240)
    parser.add_argument("--widths", default="16,24")
    parser.add_argument("--seeds", default="0,1,2")
    a = parser.parse_args()
    r = benchmark(
        a.module,
        a.out,
        a.steps,
        tuple(map(int, a.widths.split(","))),
        tuple(map(int, a.seeds.split(","))),
    )
    print(
        json.dumps(
            {
                "selected_width": r["selected_width"],
                "test_loss_mean": r["test_loss_mean"],
                "test_loss_std": r["test_loss_std"],
            },
            ensure_ascii=False,
        )
    )
