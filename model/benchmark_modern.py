"""RoPE contre positions absolues : livres réservés et différences appariées."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import statistics
import unicodedata
import numpy as np
from model.artifacts import ecrire_json, empreinte
from model.gpt_train import train_gpt, result_payload, save_checkpoint, load_checkpoint, sample_text
from model.transformer import GPTConfig, TinyGPT
from model.tokenizer import CharTokenizer

ROOT = Path(__file__).resolve().parents[1]
PROTOCOL = ROOT / "data/benchmark_literature_protocol.json"


def documents(protocol_path=PROTOCOL):
    protocol = json.loads(Path(protocol_path).read_text(encoding="utf-8"))
    if protocol.get("format") != "afz-literature-protocol-v1":
        raise ValueError("Protocole documentaire requis")
    source = (ROOT / protocol["source"]).resolve()
    if not source.is_relative_to(ROOT) or empreinte(source) != protocol["source_sha256"]:
        raise ValueError("Source différente du protocole figé")
    raw = source.read_text(encoding="utf-8")
    result = {s: [] for s in ("train", "validation", "test")}
    authors, books, identities, hashes = {}, {}, set(), set()
    for row in protocol["documents"]:
        split, identifier = row["split"], row["id"]
        if split not in result or identifier in identities:
            raise ValueError("Split ou identifiant invalide")
        for groups, key in ((authors, row["author"]), (books, row["book"])):
            if key in groups and groups[key] != split:
                raise ValueError("Un auteur ou livre chevauche les splits")
            groups[key] = split
        start, count = row["character_start"], row["characters"]
        if not isinstance(start, int) or not isinstance(count, int) or start < 0 or count < 34:
            raise ValueError("Intervalle documentaire invalide")
        text = raw[start:start + count]
        if len(text) != count or hashlib.sha256(text.encode()).hexdigest() != row["raw_text_sha256"]:
            raise ValueError("Extrait différent du protocole")
        text = unicodedata.normalize("NFC", text).strip() + "\n"
        digest = hashlib.sha256(text.encode()).hexdigest()
        if digest in hashes:
            raise ValueError("Document dupliqué")
        hashes.add(digest); identities.add(identifier)
        result[split].append({**row, "text": text, "normalized_sha256": digest})
    if not all(result.values()):
        raise ValueError("Trois splits non vides requis")
    return protocol, result


def encoded(text, tokenizer):
    unknown = sum(c not in tokenizer.stoi for c in text)
    clean = "".join(c if c in tokenizer.stoi else "�" for c in text)
    return np.array(tokenizer.encode(clean), dtype=np.int64), unknown


def evaluate_documents(model, docs, tokenizer, bigram, block):
    """Chaque cible une fois, dernier morceau conservé, aucune frontière documentaire jointe."""
    total, base, targets, unknown = 0.0, 0.0, 0, 0
    details = []
    for doc in docs:
        ids, missing = encoded(doc["text"], tokenizer)
        unknown += missing
        local, count = 0.0, 0
        starts = list(range(0, len(ids) - 1, block))
        for first in range(0, len(starts), 32):
            by_length = {}
            for start in starts[first:first + 32]:
                window = ids[start:start + block + 1]
                by_length.setdefault(len(window), []).append(window)
            for windows in by_length.values():
                batch = np.stack(windows)
                logits, _ = model.forward(batch[:, :-1])
                shifted = logits - logits.max(-1, keepdims=True)
                log_probs = shifted - np.log(np.exp(shifted).sum(-1, keepdims=True))
                y = batch[:, 1:]
                loss_sum = -float(np.take_along_axis(log_probs, y[..., None], -1).sum())
                total += loss_sum; local += loss_sum
                base -= float(np.log(bigram[batch[:, :-1], y]).sum())
                count += y.size; targets += y.size
        details.append({"document": doc["id"], "loss": local / count, "target_tokens": count, "unknown_characters": missing})
    return {"loss": total / targets, "target_tokens": targets, "unknown_characters": unknown,
            "baselines": {"uniform": float(np.log(tokenizer.vocab_size)), "bigram": base / targets},
            "documents": details, "windows": "Chaque cible une fois ; contexte remis à zéro par fenêtre et document"}


def source_hashes():
    paths = [*sorted(ROOT.glob("model/*.py")), PROTOCOL, ROOT / "model/data/corpus_fr.txt",
             ROOT / "model/data/SOURCES.md", ROOT / "data/datasets.json", ROOT / "requirements.txt", ROOT / "LICENSE"]
    return {p.relative_to(ROOT).as_posix(): empreinte(p) for p in paths}


def benchmark(destination, steps=None, seeds=None):
    protocol, parts = documents()
    recipe = dict(protocol["recipe"])
    if steps is not None: recipe["steps"] = steps
    if seeds is not None: recipe["seeds"] = list(seeds)
    if recipe["steps"] < 2 or not recipe["seeds"] or len(set(recipe["seeds"])) != len(recipe["seeds"]):
        raise ValueError("Budget et graines distinctes requis")
    out = Path(destination)
    out.mkdir(parents=True, exist_ok=False)
    recipe.update({"protocol_sha256": empreinte(PROTOCOL), "initialization": "Poids neufs ; matrices communes identiques au début de chaque paire",
                   "selection": "Poids finaux au budget fixé ; choix sur la moyenne de validation documentaire, puis test de cette seule position",
                   "evaluation": "Toutes les cibles, une fois par document ; contexte au plus 32",
                   "source_hashes": source_hashes(), "python": platform.python_version(), "numpy": np.__version__,
                   "machine": {"system": platform.system(), "architecture": platform.machine(),
                               "logical_cpus": os.cpu_count(), "openblas_threads": os.environ.get("OPENBLAS_NUM_THREADS", "non fixé")}})
    ecrire_json(out / "recette-avant-test.json", recipe)
    train = "\n".join(d["text"] for d in parts["train"])
    validation = "\n".join(d["text"] for d in parts["validation"])
    tokenizer = CharTokenizer(train + "�")
    train_ids, _ = encoded(train, tokenizer)
    counts = np.ones((tokenizer.vocab_size, tokenizer.vocab_size))
    np.add.at(counts, (train_ids[:-1], train_ids[1:]), 1)
    bigram = counts / counts.sum(-1, keepdims=True)
    runs = []
    for seed in recipe["seeds"]:
        common = dict(vocab_size=tokenizer.vocab_size, d_model=recipe["d_model"], n_heads=recipe["heads"],
                      n_layers=recipe["layers"], block_size=recipe["block"], seed=seed)
        baseline = TinyGPT(GPTConfig(**common))
        for position in ("absolute", "rope"):
            initial = TinyGPT(GPTConfig(**common, pos=position))
            for name, value in initial.params.items():
                if name in baseline.params: value[:] = baseline.params[name]
            model, tok, result = train_gpt(train, val_text=validation, initial_model=initial, tokenizer=tokenizer,
                steps=recipe["steps"], d_model=recipe["d_model"], n_heads=recipe["heads"],
                n_layers=recipe["layers"], block=recipe["block"], batch=recipe["batch"],
                lr=recipe["lr"], seed=seed, pos=position, sample=False, eval_windows=32, eval_spread=True)
            measured = evaluate_documents(model, parts["validation"], tok, bigram, recipe["block"])
            folder = out / (position + "-graine" + str(seed))
            folder.mkdir()
            row = {**result_payload(result, protocol["id"]), "position": position, "seed": seed,
                   "folder": folder.name, "validation_probe_loss": result.val_loss_end,
                   "val_loss_end": measured["loss"], "validation": measured,
                   "tokens_seen": recipe["steps"] * recipe["batch"] * recipe["block"],
                   "generation_fixed": sample_text(model, tok, recipe["prompt"], recipe["generation_tokens"], temperature=0.7, top_k=8, seed=seed)}
            checkpoint = folder / "modele.npz"
            save_checkpoint(checkpoint, model, tok, {"recipe": recipe, "run": row})
            row["checkpoint_sha256"] = empreinte(checkpoint)
            restored, _, _ = load_checkpoint(checkpoint)
            probe = train_ids[:recipe["block"]][None, :]
            row["reload_identical"] = bool(np.array_equal(restored.forward(probe)[0], model.forward(probe)[0]))
            ecrire_json(folder / "rapport.json", row)
            runs.append(row)
            print(position, seed, "validation", round(measured["loss"], 5), flush=True)
    means = {p: statistics.mean(r["val_loss_end"] for r in runs if r["position"] == p) for p in ("absolute", "rope")}
    selected = min(means, key=lambda p: (means[p], p))
    ecrire_json(out / "selection-avant-test.json", {"selected_position": selected, "validation_means": means})
    tests = []
    for row in runs:
        if row["position"] != selected: continue
        model, tok, _ = load_checkpoint(out / row["folder"] / "modele.npz")
        test = {"seed": row["seed"], "position": selected,
                **evaluate_documents(model, parts["test"], tok, bigram, recipe["block"])}
        ecrire_json(out / row["folder"] / "test-final.json", test)
        tests.append(test)
    pairs = [{"seed": seed,
              "delta_rope_minus_absolute": next(r["val_loss_end"] for r in runs if r["seed"] == seed and r["position"] == "rope")
              - next(r["val_loss_end"] for r in runs if r["seed"] == seed and r["position"] == "absolute")} for seed in recipe["seeds"]]
    report = {"format": "afz-modern-benchmark-v1", "protocol_id": protocol["id"], "recipe": recipe,
              "documents": {k: [{a: b for a, b in d.items() if a != "text"} for d in docs] for k, docs in parts.items()},
              "runs": runs, "validation_means": means, "selected_position": selected, "paired": pairs,
              "paired_delta_mean": statistics.mean(p["delta_rope_minus_absolute"] for p in pairs),
              "paired_delta_std": statistics.stdev(p["delta_rope_minus_absolute"] for p in pairs) if len(pairs) > 1 else None,
              "test_final": tests, "test_loss_mean": statistics.mean(t["loss"] for t in tests),
              "test_loss_std": statistics.stdev(t["loss"] for t in tests) if len(tests) > 1 else None,
              "limite": protocol["limite"] + " Budget égal en pas et tokens, pas en paramètres ni FLOPs. Trois graines ne prouvent pas une supériorité générale."}
    ecrire_json(out / "benchmark.json", report)
    return report


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--steps", type=int, default=None)
    p.add_argument("--seeds", default=None)
    a = p.parse_args()
    r = benchmark(a.out, a.steps, tuple(int(s) for s in a.seeds.split(",")) if a.seeds else None)
    print("Test retenu :", r["selected_position"], r["test_loss_mean"])
