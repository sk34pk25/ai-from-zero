"""BPE : aller-retour et fusions déterministes."""

from model.bpe import BPETokenizer


def test_roundtrip_and_deterministic_merges(tmp_path):
    text = "le chat chat dort dans le chat. le chien court."
    first = BPETokenizer.train(text, 12)
    second = BPETokenizer.train(text, 12)
    assert first.to_dict() == second.to_dict()
    encoded = first.encode(text)
    assert first.decode(encoded) == text
    assert len(encoded) < len(text)
    path = tmp_path / "bpe.json"
    first.save(path)
    loaded = BPETokenizer.load(path)
    assert loaded.encode("le chat") == first.encode("le chat")
    assert loaded.decode(loaded.encode("le chat")) == "le chat"


def test_tie_break_is_stable():
    text = "abab"
    tokenizer = BPETokenizer.train(text, 1)
    again = BPETokenizer.train(text, 1)
    assert tokenizer.merges == again.merges
    assert tokenizer.decode(tokenizer.encode(text)) == text


def test_indexed_bpe_matches_the_scan():
    from model.bpe import reference_encode, reference_merges

    samples = [
        "abab",
        "aaa",
        "abcdabcd",
        "ba ba ba",
        "le chat chat dort dans le chat. le chien court.",
        ("ab c ab c " * 40) + "zzz zzz",
    ]
    for text in samples:
        merges = reference_merges(text, 8)
        tokenizer = BPETokenizer.train(text, 8)
        assert tokenizer.merges == merges
        assert tokenizer.encode(text) == reference_encode(text, tokenizer.vocab, merges)
        assert tokenizer.decode(tokenizer.encode(text)) == text
    from pathlib import Path
    prose = Path("model/data/francais.txt").read_text(encoding="utf-8")[:4000]
    merges = reference_merges(prose, 20)
    tokenizer = BPETokenizer.train(prose, 20)
    assert tokenizer.merges == merges
    assert tokenizer.encode(prose) == reference_encode(prose, tokenizer.vocab, merges)
