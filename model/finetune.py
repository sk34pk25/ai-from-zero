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


def example_ids(tokenizer, question: str, answer: str) -> tuple[list[int], list[bool]] | None:
    prompt, full = format_pair(question, answer)
    try:
        ids = tokenizer.encode(full)
    except KeyError:
        return None
    strings = [_token_string(tokenizer, index) for index in ids]
    cursor = 0
    answer_token = []
    for piece in strings:
        start = cursor
        cursor += len(piece)
        answer_token.append(start >= len(prompt))
    if len(ids) < 2 or not any(answer_token):
        return None
    mask = answer_token[1:]
    if not any(mask):
        return None
    return ids, mask


def _token_string(tokenizer, index: int) -> str:
    if hasattr(tokenizer, "token_string"):
        return tokenizer.token_string(index)
    return tokenizer.itos[int(index)]


def masked_cross_entropy(logits: Tensor, targets: np.ndarray, mask: np.ndarray) -> Tensor:
    labels = np.asarray(targets, dtype=np.int64)
    weights = np.asarray(mask, dtype=np.float64)
    if logits.data.ndim != 2 or labels.shape != (logits.data.shape[0],) or weights.shape != labels.shape:
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


def batch_from_ids(ids: list[int], mask: list[bool], block: int) -> tuple[np.ndarray, np.ndarray] | None:
    window = ids[: block + 1]
    keep = mask[:block]
    if len(window) < 2 or not any(keep):
        return None
    if len(window) < block + 1:
        return np.asarray(window, dtype=np.int64)[None, :], np.asarray(keep, dtype=np.float64)[None, :]
    return np.asarray(window, dtype=np.int64)[None, :], np.asarray(keep, dtype=np.float64)[None, :]


def masked_loss(params: dict[str, Tensor], tokens: np.ndarray, mask: np.ndarray, config) -> Tensor:
    logits = logits_tensor(params, tokens[:, :-1], config)
    flat = logits.reshape(-1, config.vocab_size)
    return masked_cross_entropy(flat, tokens[:, 1:].reshape(-1), mask.reshape(-1))


def _prepare_rows(tokenizer, rows: list[dict[str, str]]) -> list[tuple[list[int], list[bool]]]:
    prepared = []
    for row in rows:
        built = example_ids(tokenizer, row["question"], row["answer"])
        if built is not None:
            prepared.append(built)
    if not prepared:
        raise ValueError("aucun exemple n'entre dans le vocabulaire")
    return prepared


def _run_steps(effective_of, trainable: dict[str, Tensor], config, prepared, steps: int, lr: float, seed: int) -> list[float]:
    optimizer = AdamW(trainable, lr=lr, weight_decay=0.0)
    rng = np.random.default_rng(seed)
    losses = []
    for _ in range(steps):
        for tensor in trainable.values():
            tensor.zero_grad()
        ids, mask = prepared[int(rng.integers(0, len(prepared)))]
        packed = batch_from_ids(ids, mask, config.block_size)
        if packed is None:
            raise ValueError("exemple trop court pour le bloc")
        tokens, weights = packed
        loss = masked_loss(effective_of(), tokens, weights, config)
        loss.backward()
        optimizer.step()
        losses.append(float(loss.data))
    return losses


def finetune(model: TinyGPT, tokenizer, rows: list[dict[str, str]], steps: int = 20, lr: float = 1e-3, seed: int = 0, lora_rank: int | None = None, scale: float = 1.0) -> dict:
    if steps < 1:
        raise ValueError("au moins un pas")
    prepared = _prepare_rows(tokenizer, rows)
    if lora_rank is None:
        base = bind_parameters(model)
        losses = _run_steps(lambda: base, base, model.config, prepared, steps, lr, seed)
        trained = int(sum(array.size for array in model.params.values()))
    else:
        numpy_params = {name: np.array(value, dtype=np.float64, copy=True) for name, value in model.params.items()}
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

        losses = _run_steps(effective, trainable, model.config, prepared, steps, lr, seed)
        for name, (left, right, factor_scale) in adapters.items():
            model.params[name][...] = base[name].data + factor_scale * (left.data @ right.data)
        trained = trainable_count(factors)
    return {
        "losses": losses,
        "loss_start": losses[0],
        "loss_end": losses[-1],
        "steps": steps,
        "trainable": trained,
        "lora_rank": lora_rank,
        "examples": len(prepared),
    }


def compare_finetunes(model: TinyGPT, tokenizer, rows: list[dict], steps: int = 8, lr: float = 1e-3, rank: int = 2, seed: int = 0) -> dict:
    full_model = TinyGPT(model.config)
    full_model.params = {name: np.array(value, dtype=np.float64, copy=True) for name, value in model.params.items()}
    lora_model = TinyGPT(model.config)
    lora_model.params = {name: np.array(value, dtype=np.float64, copy=True) for name, value in model.params.items()}
    full = finetune(full_model, tokenizer, rows, steps=steps, lr=lr, seed=seed, lora_rank=None)
    adapted = finetune(lora_model, tokenizer, rows, steps=steps, lr=lr, seed=seed, lora_rank=rank)
    return {"full": full, "lora": adapted, "full_model": full_model, "lora_model": lora_model}
