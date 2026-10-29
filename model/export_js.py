"""Exporte un TinyGPT en JSON lisible par le playground JavaScript.

Les poids sont en float32. Les logits de référence sont recalculés après
cet arrondi, pour que le test compare le même point de départ.
"""

from __future__ import annotations

import base64
import json
from pathlib import Path

import numpy as np

from model.bpe import BPETokenizer
from model.gpt_train import clip_prompt
from model.transformer import TinyGPT


def _b64(array: np.ndarray) -> str:
    raw = np.ascontiguousarray(array, dtype=np.float32).tobytes()
    return base64.b64encode(raw).decode("ascii")


def export_browser(model: TinyGPT, tokenizer, path: str | Path, prompt: str) -> dict:
    path = Path(path)
    rounded = TinyGPT(model.config)
    tensors = {}
    for name, value in model.params.items():
        array = np.ascontiguousarray(value, dtype=np.float32)
        rounded.params[name] = array.astype(np.float64)
        tensors[name] = {"shape": list(array.shape), "b64": _b64(array)}
    if isinstance(tokenizer, BPETokenizer):
        tokenizer_payload = {"kind": "bpe", **tokenizer.to_dict()}
    else:
        tokenizer_payload = {"kind": "char", "stoi": tokenizer.stoi}
    ids = clip_prompt(tokenizer, prompt, model.config.block_size)
    logits, _ = rounded.forward(ids)
    last = np.asarray(logits[0, -1], dtype=np.float64)
    payload = {
        "format": "afz-gpt-f32-v1",
        "config": {
            "vocab_size": model.config.vocab_size,
            "d_model": model.config.d_model,
            "n_heads": model.config.n_heads,
            "n_layers": model.config.n_layers,
            "block_size": model.config.block_size,
            "ffn": model.config.ffn,
            "norm": model.config.norm,
            "pos": model.config.pos,
        },
        "tokenizer": tokenizer_payload,
        "tensors": tensors,
        "reference": {
            "prompt": prompt,
            "ids": [int(value) for value in ids[0]],
            "logits": [round(float(value), 6) for value in last],
        },
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False) + "\n", encoding="utf-8")
    return payload


if __name__ == "__main__":
    import argparse

    from model.gpt_train import DEFAULT_CHECKPOINT, load_checkpoint

    parser = argparse.ArgumentParser(
        description="Exporte le checkpoint vers le playground."
    )
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--out", type=Path, default=Path("runs/gpt_browser.json"))
    parser.add_argument("--prompt", default="Le ")
    args = parser.parse_args()
    trained, tokenizer, _history = load_checkpoint(args.checkpoint)
    export_browser(trained, tokenizer, args.out, args.prompt)
    print(args.out)
