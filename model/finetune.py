"""Ajustement supervisé avec masque : la perte ne tombe que sur la réponse.

Le format est volontairement court, pour tenir dans un bloc CPU :

    Question : ...
    Réponse : ...
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

from model.autograd import Tensor
from model.gpt_train import AdamW, bind_parameters, logits_tensor
from model.lora import init_lora, trainable_count
from model.transformer import TinyGPT


def format_pair(question: str, answer: str) -> tuple[str, str]:
    prompt = f"Question : {question.strip()}\nRéponse :"
    full = f"{prompt} {answer.strip()}\n"
    return prompt, full


def load_instructions(path: str | Path) -> list[dict[str, str]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = payload["items"] if isinstance(payload, dict) else payload
    cleaned = []
    for row in rows:
        question = str(row["question"]).strip()
        answer = str(row["answer"]).strip()
        if question and answer:
            cleaned.append({"question": question, "answer": answer})
    if not cleaned:
        raise ValueError("le jeu d'instructions est vide")
    return cleaned


def example_ids(
    tokenizer, question: str, answer: str
) -> tuple[list[int], list[bool]] | None:
    """Encode la question et la réponse séparément.

    Une fusion BPE ne traverse pas la frontière. Le préfixe est donc le même
    au moment de répondre, quand on n'encode que la question.
    """
    prompt, full = format_pair(question, answer)
    answer_text = full[len(prompt) :]
    try:
        prompt_ids = tokenizer.encode(prompt)
        answer_ids = tokenizer.encode(answer_text)
    except KeyError:
        return None
    ids = prompt_ids + answer_ids
    if len(ids) < 2 or not answer_ids:
        return None
    mask = [index + 1 >= len(prompt_ids) for index in range(len(ids) - 1)]
    if not any(mask):
        return None
    return ids, mask


def masked_cross_entropy(
    logits: Tensor, targets: np.ndarray, mask: np.ndarray
) -> Tensor:
    labels = np.asarray(targets, dtype=np.int64)
    weights = np.asarray(mask, dtype=np.float64)
    if (
        logits.data.ndim != 2
        or labels.shape != (logits.data.shape[0],)
        or weights.shape != labels.shape
    ):
        raise ValueError("masque, cibles et logits incompatibles")
    denom = float(weights.sum())
    if denom <= 0:
        raise ValueError("le masque ne couvre aucune cible")
    log_probs = logits.log_softmax(axis=-1)
    picked = log_probs.data[np.arange(labels.shape[0]), labels]
    loss_value = -float(np.sum(picked * weights) / denom)

    def backward() -> None:
        if not log_probs.requires_grad:
            return
        grad = np.zeros_like(log_probs.data)
        grad[np.arange(labels.shape[0]), labels] = -weights / denom
        log_probs.grad += grad * result.grad

    result = Tensor(loss_value, requires_grad=logits.requires_grad)
    result._prev = (log_probs,) if logits.requires_grad else ()
    result._backward = backward
    return result


def batch_from_ids(
    ids: list[int], mask: list[bool], block: int
) -> tuple[np.ndarray, np.ndarray] | None:
    window = ids[: block + 1]
    keep = mask[:block]
    if len(window) < 2 or not any(keep):
        return None
    if len(window) < block + 1:
        return (
            np.asarray(window, dtype=np.int64)[None, :],
            np.asarray(keep, dtype=np.float64)[None, :],
        )
    return (
        np.asarray(window, dtype=np.int64)[None, :],
        np.asarray(keep, dtype=np.float64)[None, :],
    )


def masked_loss(
    params: dict[str, Tensor], tokens: np.ndarray, mask: np.ndarray, config
) -> Tensor:
    logits = logits_tensor(params, tokens[:, :-1], config)
    flat = logits.reshape(-1, config.vocab_size)
    return masked_cross_entropy(flat, tokens[:, 1:].reshape(-1), mask.reshape(-1))


def _prepare_rows(
    tokenizer, rows: list[dict[str, str]]
) -> list[tuple[list[int], list[bool]]]:
    prepared = []
    for row in rows:
        built = example_ids(tokenizer, row["question"], row["answer"])
        if built is not None:
            prepared.append(built)
    if not prepared:
        raise ValueError("aucun exemple n'entre dans le vocabulaire")
    return prepared


def _numpy_masked_loss(
    model: TinyGPT, tokens: np.ndarray, mask: np.ndarray
) -> tuple[float, float]:
    logits, _ = model.forward(tokens[:, :-1])
    flat = np.asarray(logits, dtype=np.float64).reshape(-1, model.config.vocab_size)
    targets = tokens[:, 1:].reshape(-1)
    weights = np.asarray(mask, dtype=np.float64).reshape(-1)
    shifted = flat - flat.max(axis=-1, keepdims=True)
    log_probs = shifted - np.log(np.exp(shifted).sum(axis=-1, keepdims=True))
    picked = log_probs[np.arange(targets.shape[0]), targets]
    denom = float(weights.sum())
    if denom <= 0:
        return 0.0, 0.0
    return -float(np.sum(picked * weights) / denom), denom


def evaluate_instructions(
    model: TinyGPT, tokenizer, rows: list[dict[str, str]]
) -> dict:
    """Perte masquée moyenne sur tous les exemples qui tiennent dans le bloc."""
    prepared = _prepare_rows(tokenizer, rows)
    total = 0.0
    weight = 0.0
    kept = 0
    for ids, mask in prepared:
        packed = batch_from_ids(ids, mask, model.config.block_size)
        if packed is None:
            continue
        tokens, weights = packed
        loss, denom = _numpy_masked_loss(model, tokens, weights)
        if denom <= 0:
            continue
        total += loss * denom
        weight += denom
        kept += 1
    if weight <= 0:
        raise ValueError("aucune cible d'évaluation")
    return {"loss": total / weight, "examples": kept, "target_tokens": int(weight)}


def _run_steps(
    effective_of,
    trainable: dict[str, Tensor],
    config,
    prepared,
    steps: int,
    lr: float,
    seed: int,
    verbose: bool = False,
) -> list[float]:
    optimizer = AdamW(trainable, lr=lr, weight_decay=0.0)
    rng = np.random.default_rng(seed)
    losses = []
    for index in range(steps):
        for tensor in trainable.values():
            tensor.zero_grad()
        ids, mask = prepared[int(rng.integers(0, len(prepared)))]
        packed = batch_from_ids(ids, mask, config.block_size)
        if packed is None:
            raise ValueError("exemple trop court pour le bloc")
        tokens, weights = packed
        loss = masked_loss(effective_of(), tokens, weights, config)
        loss.backward()
        optimizer.step(clip=1.0)
        losses.append(float(loss.data))
        if verbose and (index % 50 == 0 or index == steps - 1):
            print(f"sft {index} loss {losses[-1]:.3f}", flush=True)
    return losses


def finetune(
    model: TinyGPT,
    tokenizer,
    rows: list[dict[str, str]],
    steps: int = 20,
    lr: float = 1e-3,
    seed: int = 0,
    lora_rank: int | None = None,
    scale: float = 1.0,
    verbose: bool = False,
) -> dict:
    if steps < 1:
        raise ValueError("au moins un pas")
    prepared = _prepare_rows(tokenizer, rows)
    prepared = [
        item
        for item in prepared
        if batch_from_ids(item[0], item[1], model.config.block_size) is not None
    ]
    if not prepared:
        raise ValueError("aucun exemple avec une cible dans la fenêtre")
    if lora_rank is None:
        base = bind_parameters(model)
        losses = _run_steps(
            lambda: base, base, model.config, prepared, steps, lr, seed, verbose
        )
        trained = int(sum(array.size for array in model.params.values()))
    else:
        numpy_params = {
            name: np.array(value, dtype=np.float64, copy=True)
            for name, value in model.params.items()
        }
        factors = init_lora(numpy_params, lora_rank, seed=seed, scale=scale)
        base = bind_parameters(model)
        for tensor in base.values():
            tensor.requires_grad = False
            tensor.grad = None
        adapters: dict[str, tuple[Tensor, Tensor, float]] = {}
        trainable: dict[str, Tensor] = {}
        for name, factor in factors.items():
            left = Tensor(np.array(factor["A"], copy=True))
            right = Tensor(np.array(factor["B"], copy=True))
            adapters[name] = (left, right, float(factor["scale"]))
            trainable[f"{name}.A"] = left
            trainable[f"{name}.B"] = right

        def effective() -> dict[str, Tensor]:
            merged = dict(base)
            for name, (left, right, factor_scale) in adapters.items():
                merged[name] = base[name] + (left.matmul(right) * factor_scale)
            return merged

        losses = _run_steps(
            effective, trainable, model.config, prepared, steps, lr, seed, verbose
        )
        for name, (left, right, factor_scale) in adapters.items():
            model.params[name][...] = base[name].data + factor_scale * (
                left.data @ right.data
            )
        trained = trainable_count(factors)
    return {
        "losses": losses,
        "loss_start": losses[0],
        "loss_end": losses[-1],
        "steps": steps,
        "trainable": trained,
        "lora_rank": lora_rank,
        "examples": len(prepared),
        "examples_skipped": len(rows) - len(prepared),
    }


def compare_finetunes(
    model: TinyGPT,
    tokenizer,
    rows: list[dict],
    steps: int = 8,
    lr: float = 1e-3,
    rank: int = 2,
    seed: int = 0,
    lora_lr: float | None = None,
    verbose: bool = False,
) -> dict:
    full_model = TinyGPT(model.config)
    full_model.params = {
        name: np.array(value, dtype=np.float64, copy=True)
        for name, value in model.params.items()
    }
    lora_model = TinyGPT(model.config)
    lora_model.params = {
        name: np.array(value, dtype=np.float64, copy=True)
        for name, value in model.params.items()
    }
    original_rows = rows
    if len(rows) >= 10:
        rows, validation, test = split_instructions(rows, seed)
        label = "validation réservée par groupes lexicaux"
    else:
        validation, test = rows, []
        label = "diagnostic sur train : trop peu de paires pour conclure à la généralisation"
    before = evaluate_instructions(full_model, tokenizer, validation)
    full = finetune(
        full_model,
        tokenizer,
        rows,
        steps=steps,
        lr=lr,
        seed=seed,
        lora_rank=None,
        verbose=verbose,
    )
    full["eval_loss_start"] = before["loss"]
    full["eval_loss_end"] = evaluate_instructions(full_model, tokenizer, validation)[
        "loss"
    ]
    if verbose:
        print("lora", flush=True)
    adapted = finetune(
        lora_model,
        tokenizer,
        rows,
        steps=steps,
        lr=lr if lora_lr is None else lora_lr,
        seed=seed,
        lora_rank=rank,
        verbose=verbose,
    )
    adapted["eval_loss_start"] = before["loss"]
    adapted["eval_loss_end"] = evaluate_instructions(lora_model, tokenizer, validation)[
        "loss"
    ]
    for report in (full, adapted):
        report["evaluation"] = label
        report["split"] = {
            "train": len(rows),
            "validation": len(validation),
            "test": len(test),
        }
    return {
        "full": full,
        "lora": adapted,
        "full_model": full_model,
        "lora_model": lora_model,
        "eval_before": before,
        "test_rows": test,
        "train_questions": [r["question"] for r in rows],
    }


def split_instructions(
    rows: list[dict], seed: int = 0
) -> tuple[list[dict], list[dict], list[dict]]:
    """Sépare des groupes de réponses identiques et questions proches, sans casser les groupes.

    Ce regroupement lexical est conservateur ; ce n'est pas un détecteur sémantique.
    """
    import re
    from difflib import SequenceMatcher

    def norm(text):
        return re.sub(r"[^\w]+", " ", text.casefold()).strip()

    parent = list(range(len(rows)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i, row in enumerate(rows):
        for j in range(i):
            if (
                norm(row["answer"]) == norm(rows[j]["answer"])
                or SequenceMatcher(
                    None, norm(row["question"]), norm(rows[j]["question"])
                ).ratio()
                > 0.88
            ):
                parent[find(i)] = find(j)
    groups = {}
    for i, row in enumerate(rows):
        groups.setdefault(find(i), []).append(row)
    blocks = list(groups.values())
    np.random.default_rng(seed).shuffle(blocks)
    if len(blocks) < 3:
        raise ValueError(
            "au moins trois groupes indépendants pour train/validation/test"
        )
    test_n = max(1, round(len(blocks) * 0.1))
    val_n = max(1, round(len(blocks) * 0.2))
    return (
        [r for b in blocks[test_n + val_n :] for r in b],
        [r for b in blocks[test_n : test_n + val_n] for r in b],
        [r for b in blocks[:test_n] for r in b],
    )
