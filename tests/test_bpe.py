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
