#!/usr/bin/env python3
"""Entraîne le modèle publié : BPE sur les sept livres, puis le dialogue.

Les nombres écrits dans data/gpt_run.json et data/finetune_run.json
viennent de cette exécution. Les textes Gutenberg préparés restent hors git.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from model.bpe import BPETokenizer
from model.datasets import dataset_by_id, load_catalog, prepare_id, prepared_corpus
from model.export_js import export_browser
from model.finetune import compare_finetunes, example_ids, load_instructions
from model.gpt_train import result_payload, sample_text, save_checkpoint, train_gpt


ROOT = Path(__file__).resolve().parents[1]
BOOKS = (
    "pg-candide",
    "pg-lune",
    "pg-tour-monde",
    "pg-bovary",
    "pg-miserables-1",
    "pg-vingt-mille",
    "pg-mousquetaires",
)
INSTRUCTIONS = ROOT / "model" / "data" / "instructions_fr.json"
PROMPTS = (("Il ", 0.0, 1), ("Le ", 0.7, 8), ("La ", 0.5, 4))
CHAT_QUESTIONS = (
    "qu'est-ce qu'un token",
    "qu'est-ce que LoRA",
    "qui a écrit madame bovary",
)
HELD_OUT = "explique le masque causal en une phrase"
WIDTH = 80
HEADS = 4
BLOCK = 64
BATCH = 8
MERGES = 1500
PRETRAIN_LR = 2.5e-3
PRETRAIN_BUDGET_S = 38 * 60


def load_books() -> tuple[str, list[dict]]:
    catalog = load_catalog()
    parts = []
    meta = []
    for identifier in BOOKS:
        try:
            text = prepared_corpus(identifier)
        except FileNotFoundError:
            prepare_id(identifier)
            text = prepared_corpus(identifier)
        row = dataset_by_id(catalog, identifier)
        parts.append(text.strip())
        meta.append({
            "id": identifier,
            "name": row["name"],
            "url": row["url"],
            "licence": row["licence"],
            "chars": len(text),
            "sha256": row.get("sha256"),
        })
    return "\n\n".join(parts) + "\n", meta


def _seconds_per_step(text: str, tokenizer, layers: int) -> tuple[float, int]:
    _, _, result = train_gpt(
        text,
        steps=4,
        lr=PRETRAIN_LR,
        batch=BATCH,
        block=BLOCK,
        d_model=WIDTH,
        n_heads=HEADS,
        n_layers=layers,
        seed=1,
        tokenizer=tokenizer,
        eval_windows=1,
        val_every=10,
        sample=False,
        schedule="constant",
    )
    return result.seconds / result.steps, result.parameter_count


def _fit_report(tokenizer, rows, block: int) -> dict:
    kept = 0
    missing = 0
    truncated = 0
    for row in rows:
        built = example_ids(tokenizer, row["question"], row["answer"])
        if built is None:
            missing += 1
            continue
        if len(built[0]) <= block + 1:
            kept += 1
        else:
            truncated += 1
    return {"kept_intact": kept, "truncated": truncated, "missing_chars": missing, "written": len(rows)}


def _downsample(values: list[float], limit: int = 120) -> list[float]:
    if not values:
        return []
    if len(values) <= limit:
        picked = range(len(values))
    else:
        picked = [round(index * (len(values) - 1) / (limit - 1)) for index in range(limit)]
    return [round(float(values[index]), 4) for index in picked]


def _attempt_summary(name: str, compared: dict) -> dict:
    def pack(side: str) -> dict:
        row = compared[side]
        return {
            "loss_start": row["loss_start"],
            "loss_end": row["loss_end"],
            "eval_loss_start": row["eval_loss_start"],
            "eval_loss_end": row["eval_loss_end"],
            "trainable": row["trainable"],
            "steps": row["steps"],
            "examples": row["examples"],
            "lora_rank": row["lora_rank"],
            "lr": row.get("lr"),
            "batch_losses": _downsample(row["losses"]),
        }

    return {"name": name, "full": pack("full"), "lora": pack("lora")}


def _chat_sample(model, tokenizer, question: str) -> dict:
    prompt = f"Question : {question}\nRéponse :"
    try:
        text = sample_text(model, tokenizer, prompt, 24, temperature=0.0, top_k=1, seed=0)
        error = ""
    except KeyError as exc:
        text = ""
        error = str(exc)
    return {"question": question, "prompt": prompt, "temperature": 0.0, "top_k": 1, "text": text, "error": error}


def main() -> None:
    started = time.perf_counter()
    text, books = load_books()
    print("corpus", len(text), "books", len(books), flush=True)
    bpe_started = time.perf_counter()
    tokenizer = BPETokenizer.train(
        text,
        MERGES,
        on_merge=lambda done, _total: print(f"bpe {done}", flush=True),
    )
    tokenizer.save(ROOT / "model" / "data" / "bpe.json")
    print(
        f"bpe {time.perf_counter() - bpe_started:.1f}s merges {len(tokenizer.merges)} vocab {tokenizer.vocab_size}",
        flush=True,
    )
    per_deep, params_deep = _seconds_per_step(text, tokenizer, 5)
    print(f"bench 5 layers {per_deep:.3f}s/step params {params_deep}", flush=True)
    if per_deep <= 0.7:
        layers = 5
        per_step = per_deep
    else:
        layers = 4
        per_step, params_shallow = _seconds_per_step(text, tokenizer, 4)
        print(f"bench 4 layers {per_step:.3f}s/step params {params_shallow}", flush=True)
    steps = int(PRETRAIN_BUDGET_S / max(per_step, 1e-3))
    steps = max(1500, min(steps, 7000))
    warmup = min(400, max(100, steps // 15))
    print(f"plan layers {layers} steps {steps} warmup {warmup}", flush=True)
    model, tokenizer, result = train_gpt(
        text,
        steps=steps,
        lr=PRETRAIN_LR,
        batch=BATCH,
        block=BLOCK,
        d_model=WIDTH,
        n_heads=HEADS,
        n_layers=layers,
        seed=1,
        tokenizer=tokenizer,
        eval_windows=24,
        val_every=max(100, steps // 20),
        sample=True,
        prompts=PROMPTS,
        schedule="cosine",
        warmup=warmup,
        clip=1.0,
        min_ratio=0.1,
        eval_spread=True,
        verbose=True,
        weight_decay=0.01,
        sample_tokens=48,
    )
    print(
        f"train {result.train_loss_start:.3f}->{result.train_loss_end:.3f} "
        f"val {result.val_loss_start:.3f}->{result.val_loss_end:.3f} "
        f"{result.seconds:.1f}s params {result.parameter_count}",
        flush=True,
    )
    for sample in result.samples:
        print("---", sample["prompt"], sample["temperature"], sample["top_k"], flush=True)
        print(sample["text"], flush=True)
    history = result_payload(result, "sept livres Project Gutenberg préparés, non commités")
    history["tokenizer_kind"] = "bpe"
    history["bpe_merges"] = len(tokenizer.merges)
    history["min_lr_ratio"] = 0.1
    history["eval_windows"] = 24
    history["eval_spread"] = True
    history["books"] = books
    history["dataset_note"] = (
        "Validation : les 10 % de tokens en fin de corpus, donc la fin du dernier livre. "
        "Les pertes train et val sont une moyenne de 24 fenêtres réparties sur chaque partie, pas le corpus entier."
    )
    history["tokenizer_choice"] = (
        "BPE à 1500 fusions. Une comparaison antérieure, sur 24 pas et 120 000 caractères de l'extrait, "
        "donnait 3,0885 nats/caractère en caractères et 2,5129 en BPE à 240 fusions. "
        "Ce run ne refait pas ce duel : il allonge le vocabulaire, comme demandé, et publie la perte de ce modèle-ci."
    )
    checkpoint = ROOT / "model" / "data" / "gpt_checkpoint.npz"
    save_checkpoint(checkpoint, model, tokenizer, history)
    (ROOT / "data" / "gpt_run.json").write_text(
        json.dumps(history, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    export_browser(model, tokenizer, ROOT / "data" / "gpt_browser.json", PROMPTS[1][0])
    print("checkpoint", checkpoint.stat().st_size, flush=True)

    rows = load_instructions(INSTRUCTIONS)
    print("instructions", _fit_report(tokenizer, rows, model.config.block_size), flush=True)
    probe_started = time.perf_counter()
    compare_finetunes(model, tokenizer, rows[:4], steps=6, lr=1e-3, lora_lr=8e-3, rank=8, seed=0)
    per_pair = (time.perf_counter() - probe_started) / 12
    sft_steps = int((8 * 60) / max(per_pair, 1e-3))
    sft_steps = max(400, min(sft_steps, 1600))
    print(f"sft {per_pair:.3f}s/step -> {sft_steps} steps", flush=True)

    attempts = []
    models = {}
    planned = compare_finetunes(
        model,
        tokenizer,
        rows,
        steps=sft_steps,
        lr=1e-3,
        lora_lr=8e-3,
        rank=16,
        seed=2,
        verbose=True,
    )
    for side in ("full", "lora"):
        planned[side]["lr"] = 1e-3 if side == "full" else 8e-3
    attempts.append(_attempt_summary("planned", planned))
    models[("planned", "full")] = planned["full_model"]
    models[("planned", "lora")] = planned["lora_model"]
    print(
        f"full eval {planned['full']['eval_loss_start']:.3f}->{planned['full']['eval_loss_end']:.3f} "
        f"lora eval {planned['lora']['eval_loss_start']:.3f}->{planned['lora']['eval_loss_end']:.3f}",
        flush=True,
    )
    if planned["lora"]["eval_loss_end"] >= planned["lora"]["eval_loss_start"] or planned["full"]["eval_loss_end"] >= planned["full"]["eval_loss_start"]:
        print("un des deux n'a pas baissé la perte moyenne, second essai documenté", flush=True)
        second = compare_finetunes(
            model,
            tokenizer,
            rows,
            steps=sft_steps,
            lr=3e-4,
            lora_lr=3e-3,
            rank=32,
            seed=3,
            verbose=True,
        )
        for side, rate in (("full", 3e-4), ("lora", 3e-3)):
            second[side]["lr"] = rate
        attempts.append(_attempt_summary("retry-lower-lr", second))
        models[("retry-lower-lr", "full")] = second["full_model"]
        models[("retry-lower-lr", "lora")] = second["lora_model"]

    best_name, best_side = min(
        models,
        key=lambda key: next(item for item in attempts if item["name"] == key[0])[key[1]]["eval_loss_end"],
    )
    chat_model = models[(best_name, best_side)]
    chosen_attempt = next(item for item in attempts if item["name"] == best_name)
    samples = [_chat_sample(chat_model, tokenizer, question) for question in CHAT_QUESTIONS]
    held = _chat_sample(chat_model, tokenizer, HELD_OUT)
    report = {
        "label": "Ajustement réel sur les paires écrites pour le cours. Licence MIT. Température 0, trois questions fixées avant le tirage.",
        "full": next(item["full"] for item in attempts if item["name"] == "planned"),
        "lora": next(item["lora"] for item in attempts if item["name"] == "planned"),
        "attempts": attempts,
        "chosen": best_side,
        "chosen_attempt": best_name,
        "chosen_eval_loss": chosen_attempt[best_side]["eval_loss_end"],
        "instructions": "model/data/instructions_fr.json",
        "instruction_licence": "MIT, comme le code. Paires écrites pour le cours, pas un jeu externe.",
        "examples_written": len(rows),
        "fit": _fit_report(tokenizer, rows, model.config.block_size),
        "samples": samples,
        "sample_prompt": samples[0]["prompt"],
        "sample": samples[0]["text"],
        "held_out": held,
        "held_out_note": "Cette question n'est pas dans le fichier d'instructions. Elle montre la limite, elle n'est pas choisie parmi plusieurs tirages.",
    }
    if best_name != "planned":
        report["exported_full"] = chosen_attempt["full"]
        report["exported_lora"] = chosen_attempt["lora"]
    (ROOT / "data" / "finetune_run.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    chat_path = ROOT / "model" / "data" / "chat_checkpoint.npz"
    save_checkpoint(chat_path, chat_model, tokenizer, report)
    export_browser(chat_model, tokenizer, ROOT / "data" / "chat_browser.json", samples[0]["prompt"])
    print("chat", best_name, best_side, "checkpoint", chat_path.stat().st_size, flush=True)
    for sample in samples:
        print("---", sample["question"], flush=True)
        print(sample["text"], flush=True)
    print("--- held out", flush=True)
    print(held["text"], flush=True)
    print(f"total {time.perf_counter() - started:.1f}s", flush=True)


if __name__ == "__main__":
    main()
