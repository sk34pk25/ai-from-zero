"""Diagnostic de questions réservées : loss masquée et réponses à relire."""

import argparse
import json
from pathlib import Path
import re
import unicodedata
from model.artifacts import ecrire_json, empreinte, sortie_sure
from model.finetune import (
    format_pair,
    evaluate_instructions,
    instruction_diagnostics,
    _assert_separate_instructions,
)
from model.gpt_train import load_checkpoint, sample_text, clip_prompt
from model.byte_bpe import ByteBPETokenizer


def questions(path):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    if data.get("format") != "afz-questions-fr-v1" or not isinstance(
        data.get("items"), list
    ):
        raise ValueError("Format de questions invalide")
    groups = {}
    for row in data["items"]:
        if not all(
            isinstance(row.get(k), str) and row[k].strip()
            for k in ("group", "question", "answer", "split")
        ) or row["split"] not in ("train", "validation", "test"):
            raise ValueError("Question ou groupe invalide")
        if row["group"] in groups and groups[row["group"]] != row["split"]:
            raise ValueError("Une famille doit rester dans un seul split")
        groups[row["group"]] = row["split"]
    return data


def preparer(path, destination):
    data = questions(path)
    destination = Path(destination)
    if destination.exists():
        raise FileExistsError("Nouveau dossier requis")
    destination.mkdir(parents=True)
    for split in ("train", "validation", "test"):
        ecrire_json(
            destination / (split + ".json"),
            [r for r in data["items"] if r["split"] == split],
        )
    ecrire_json(
        destination / "provenance.json",
        {
            "source_sha256": empreinte(path),
            "licence": data["licence"],
            "groupes": {r["group"]: r["split"] for r in data["items"]},
        },
    )


def normaliser(text):
    return re.sub(r"[^\w]+", " ", unicodedata.normalize("NFC", text).casefold()).strip()


def evaluer(checkpoint, source, split="validation", final=False, steps=64, seed=0):
    if split not in ("validation", "test") or steps < 1:
        raise ValueError("Split ou longueur invalide")
    if split == "test" and not final:
        raise ValueError("Le test final exige --test-final, après choix sur validation")
    data = questions(source)
    rows = [r for r in data["items"] if r["split"] == split]
    if not rows:
        raise ValueError("Split vide")
    model, tok, history = load_checkpoint(Path(checkpoint))
    lineage = getattr(model, "sft_lineage", None)
    if lineage:
        _assert_separate_instructions(
            {"train_connu": lineage["train"], "evaluation": rows}
        )
    diagnostics = instruction_diagnostics(tok, rows, model.config.block_size)
    try:
        loss = evaluate_instructions(model, tok, rows)
    except ValueError:
        loss = None
    results = []
    for i, row in enumerate(rows):
        prompt, _ = format_pair(row["question"], row["answer"])
        try:
            ids = clip_prompt(tok, prompt, model.config.block_size)
            prefix = (
                tok.decode(ids[0].tolist(), errors="replace")
                if isinstance(tok, ByteBPETokenizer)
                else tok.decode(ids[0].tolist())
            )
            full = sample_text(
                model,
                tok,
                prompt,
                steps=steps,
                temperature=0,
                top_k=None,
                seed=seed + i,
            )
            continuation = full[len(prefix) :]
            reply = continuation.split("\n", 1)[0].strip()
            accepted = row.get("accepted", [row["answer"]])
            exact = normaliser(reply) in [normaliser(a) for a in accepted]
            words = normaliser(reply).split()
            triples = list(zip(words, words[1:], words[2:]))
            repetition = 1 - len(set(triples)) / len(triples) if triples else 0.0
            result = {
                "reply": reply,
                "exact_match": exact,
                "newline_observed": "\n" in continuation,
                "repeated_trigram_ratio": repetition,
            }
        except KeyError:
            result = {
                "reply": None,
                "exact_match": False,
                "newline_observed": False,
                "error": "alphabet inconnu",
            }
        results.append({**row, **result, "seed": seed + i})
    return {
        "format": "afz-questions-eval-v1",
        "checkpoint_sha256": empreinte(checkpoint),
        "questions_sha256": empreinte(source),
        "split": split,
        "steps": steps,
        "seed": seed,
        "examples": len(results),
        "loss": loss,
        "diagnostics": diagnostics,
        "exact_match_rate": sum(r["exact_match"] for r in results) / len(results),
        "newline_rate": sum(r["newline_observed"] for r in results) / len(results),
        "results": results,
        "sft_overlap_checked": bool(lineage),
        "provenance_status": (
            "recouvrement des groupes SFT connus contrôlé ; pré-entraînement à auditer"
            if lineage
            else "indépendance non vérifiable : historique des groupes absent"
        ),
        "limite": "Exact-match lexical, pas juge sémantique. Relire reformulations et abstentions. Le contrôle lexical n'écarte pas toutes les contaminations du pré-entraînement.",
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path)
    parser.add_argument("--questions", type=Path, required=True)
    parser.add_argument("--prepare-to", type=Path)
    parser.add_argument("--split", choices=["validation", "test"], default="validation")
    parser.add_argument("--test-final", action="store_true")
    parser.add_argument("--steps", type=int, default=64)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", type=Path)
    a = parser.parse_args()
    if a.prepare_to:
        preparer(a.questions, a.prepare_to)
    else:
        if not a.checkpoint or not a.out:
            parser.error("--checkpoint et --out requis pour l'évaluation")
        sortie_sure(a.out, (a.checkpoint, a.questions))
        if a.out.suffix != ".json":
            parser.error("Le rapport doit avoir l'extension .json")
        r = evaluer(a.checkpoint, a.questions, a.split, a.test_final, a.steps, a.seed)
        ecrire_json(a.out, r, (a.checkpoint, a.questions))
        print(json.dumps(r, ensure_ascii=False, indent=2))
