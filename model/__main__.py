"""Démonstration courte du fil rouge : tokenizer, bigramme, forme du Transformer."""

from pathlib import Path

import numpy as np

from model.bigram import BigramModel
from model.tokenizer import CharTokenizer, visualize
from model.transformer import GPTConfig, TinyGPT


def main() -> None:
    corpus_path = Path(__file__).resolve().parent / "data" / "corpus.txt"
    text = corpus_path.read_text(encoding="utf-8")
    tokenizer = CharTokenizer(text)
    print(visualize(tokenizer, text[:24]))
    ids = tokenizer.encode(text)
    model = BigramModel(tokenizer.vocab_size)
    model.observe(ids)
    rng = np.random.default_rng(0)
    generated = tokenizer.decode(model.generate(ids[0], 24, rng, temperature=0.8))
    print(generated)
    gpt = TinyGPT(GPTConfig(vocab_size=tokenizer.vocab_size, d_model=32, n_heads=4, n_layers=2, block_size=32, seed=0))
    logits, _ = gpt.forward(np.asarray(ids[:8], dtype=np.int64)[None, :])
    print("logits", tuple(logits.shape), "paramètres", gpt.parameter_count())


if __name__ == "__main__":
    main()
