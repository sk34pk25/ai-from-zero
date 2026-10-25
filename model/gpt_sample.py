"""Échantillonne un TinyGPT déjà entraîné.

Depuis la racine du dépôt :

    python3 -m model.gpt_sample --prompt "le chat "
"""

from __future__ import annotations

import argparse
from pathlib import Path

from model.gpt_train import DEFAULT_CHECKPOINT, load_checkpoint, sample_text


def main() -> None:
    parser = argparse.ArgumentParser(description="Tirer une suite depuis le checkpoint TinyGPT.")
    parser.add_argument("--checkpoint", type=Path, default=DEFAULT_CHECKPOINT)
    parser.add_argument("--prompt", default="le chat ")
    parser.add_argument("--steps", type=int, default=80)
    parser.add_argument("--temperature", type=float, default=0.8)
    parser.add_argument("--top-k", type=int, default=8)
    parser.add_argument("--seed", type=int, default=0)
    args = parser.parse_args()
    model, tokenizer, _history = load_checkpoint(args.checkpoint)
    text = sample_text(
        model,
        tokenizer,
        args.prompt,
        steps=args.steps,
        temperature=args.temperature,
        top_k=args.top_k,
        seed=args.seed,
    )
    print(text)


if __name__ == "__main__":
    main()
