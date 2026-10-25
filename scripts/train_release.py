#!/usr/bin/env python3
"""Entraîne le modèle commité : BPE ou caractères, puis ajuste le dialogue.

Les nombres écrits dans data/gpt_run.json viennent de cette exécution.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import numpy as np

from model.bpe import BPETokenizer
from model.export_js import export_browser
from model.finetune import compare_finetunes, finetune, load_instructions
from model.gpt_train import corpus_loss, result_payload, sample_text, save_checkpoint, train_gpt
from model.tokenizer import CharTokenizer


ROOT = Path(__file__).resolve().parents[1]
CORPUS = ROOT / "model" / "data" / "corpus_fr.txt"
INSTRUCTIONS = ROOT / "model" / "data" / "instructions_fr.json"


def nats_per_char(model, tokenizer, text: str, block: int) -> float:
    ids = np.asarray(tokenizer.encode(text), dtype=np.int64)
    loss = corpus_loss(model, ids, block, max_windows=12)
    sample = text[:4000]
    ratio = len(tokenizer.encode(sample)) / max(len(sample), 1)
    return float(loss * ratio)


def main() -> None:
    text = CORPUS.read_text(encoding="utf-8")
    probe = text[:120000]
    print("corpus", len(text), flush=True)
    started = time.perf_counter()
    bpe = BPETokenizer.train(text, 240)
    bpe.save(ROOT / "model" / "data" / "bpe.json")
    print(f"bpe {time.perf_counter()-started:.1f}s merges {len(bpe.merges)} vocab {bpe.vocab_size}", flush=True)

    common = dict(steps=24, lr=3e-3, batch=4, block=32, d_model=32, n_heads=4, n_layers=2, seed=0, eval_windows=4, sample=False, val_every=24)
    char_model, char_tok, _ = train_gpt(probe, tokenizer=CharTokenizer(probe), **common)
    bpe_model, bpe_tok, _ = train_gpt(probe, tokenizer=bpe, **common)
    held = probe[-8000:]
    char_score = nats_per_char(char_model, char_tok, held, 32)
    bpe_score = nats_per_char(bpe_model, bpe_tok, held, 32)
    choice = "bpe" if bpe_score <= char_score else "char"
    print(f"nats/char char {char_score:.4f} bpe {bpe_score:.4f} -> {choice}", flush=True)

    prompts = (("Il ", 0.8, 8), ("Le ", 0.7, 6), ("La ", 0.5, 4))
    if choice == "bpe":
        tokenizer = bpe
    else:
        tokenizer = CharTokenizer(text)
    t0 = time.perf_counter()
    model, tokenizer, result = train_gpt(
        text,
        steps=180,
        lr=3e-3,
        batch=8,
        block=40,
        d_model=64,
        n_heads=4,
        n_layers=4,
        seed=1,
        tokenizer=tokenizer,
        eval_windows=6,
        val_every=30,
        sample=True,
        prompts=prompts,
    )
    print(f"train {result.train_loss_start:.3f}->{result.train_loss_end:.3f} val {result.val_loss_start:.3f}->{result.val_loss_end:.3f} {result.seconds:.1f}s params {result.parameter_count}", flush=True)
    history = result_payload(result, "model/data/corpus_fr.txt")
    history["tokenizer_kind"] = choice
    history["tokenizer_choice"] = (
        f"Comparaison sur 24 pas, {len(probe)} caractères : "
        f"{char_score:.4f} nats/caractère en caractères, {bpe_score:.4f} en BPE. "
        f"Le plus bas est retenu : {choice}."
    )
    history["bpe_merges"] = len(bpe.merges)
    history["char_nats_per_char"] = char_score
    history["bpe_nats_per_char"] = bpe_score
    save_checkpoint(ROOT / "model" / "data" / "gpt_checkpoint.npz", model, tokenizer, history)
    (ROOT / "data" / "gpt_run.json").write_text(json.dumps(history, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    export_browser(model, tokenizer, ROOT / "data" / "gpt_browser.json", prompts[0][0])

    rows = load_instructions(INSTRUCTIONS)
    # Le vocabulaire du grand modèle peut manquer une lettre rare : on filtre dans finetune.
    compared = compare_finetunes(model, tokenizer, rows, steps=20, lr=2e-3, rank=4, seed=2)
    chat_model = compared["full_model"] if compared["full"]["loss_end"] <= compared["lora"]["loss_end"] else compared["lora_model"]
    question = "qu'est-ce qu'un token"
    prompt = f"Question : {question}\nRéponse :"
    try:
        sample = sample_text(chat_model, tokenizer, prompt, 40, temperature=0.0, top_k=1, seed=0)
    except KeyError:
        sample = ""
    report = {
        "label": "Ajustement réel sur le jeu d'instructions écrit pour le cours.",
        "full": {key: compared["full"][key] for key in ("loss_start", "loss_end", "trainable", "steps", "examples")},
        "lora": {key: compared["lora"][key] for key in ("loss_start", "loss_end", "trainable", "steps", "examples", "lora_rank")},
        "chosen": "full" if chat_model is compared["full_model"] else "lora",
        "sample_prompt": prompt,
        "sample": sample,
    }
    (ROOT / "data" / "finetune_run.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    save_checkpoint(ROOT / "model" / "data" / "chat_checkpoint.npz", chat_model, tokenizer, report)
    try:
        export_browser(chat_model, tokenizer, ROOT / "data" / "chat_browser.json", prompt)
    except KeyError as error:
        print("export chat ignoré", error, flush=True)
    print(json.dumps(report, ensure_ascii=False)[:800], flush=True)
    print(f"total {time.perf_counter()-started:.1f}s", flush=True)


if __name__ == "__main__":
    main()
