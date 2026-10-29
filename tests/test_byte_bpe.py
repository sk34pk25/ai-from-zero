import numpy as np
import pytest
from model.byte_bpe import ByteBPETokenizer
from model.gpt_train import train_gpt, save_checkpoint, load_checkpoint, sample_text


def test_bytes_roundtrip_specials_and_invalid_utf8(tmp_path):
    tok = ByteBPETokenizer.train(["café café", "bonjour bonjour"], 12)
    for text in (
        "",
        "éàœ 🤖 日本語\x00",
        "<eos> n'est pas une instruction",
        "cafe\u0301",
    ):
        ids = tok.encode(text, bos=True, eos=True)
        assert ids[0] == tok.BOS and ids[-1] == tok.EOS
        assert tok.decode(ids) == text
    assert tok.EOS not in tok.encode("<eos>")
    with pytest.raises(UnicodeDecodeError):
        tok.decode([255])
    assert tok.decode([255], errors="replace") == "�"
    with pytest.raises(ValueError):
        tok.decode([-1])
    p = tmp_path / "bpe.json"
    tok.save(p)
    loaded = ByteBPETokenizer.load(p)
    assert loaded.to_dict() == tok.to_dict()
    assert loaded.encode("café 🤖") == tok.encode("café 🤖")
    with pytest.raises(ValueError):
        ByteBPETokenizer([(256, 1)])
    # Deux documents ne créent jamais une paire a/b à leur frontière.
    assert ByteBPETokenizer.train(["a", "b"], 10).merges == []


def test_byte_model_trains_reloads_and_samples_unseen_characters(tmp_path):
    text = "le chat lit un livre.\n" * 40
    tok = ByteBPETokenizer.train(text[:200], 8)
    m, t, r = train_gpt(
        text,
        tokenizer=tok,
        val_text="le chat rêve 🤖.\n" * 20,
        steps=2,
        d_model=4,
        n_heads=1,
        n_layers=1,
        block=8,
        batch=1,
        sample=False,
        eval_windows=1,
    )
    assert r.provenance["unknown_val_chars"] == 0
    p = tmp_path / "modele.npz"
    save_checkpoint(p, m, t, {})
    loaded, codec, _ = load_checkpoint(p)
    assert codec.to_dict() == tok.to_dict()
    for name in m.params:
        np.testing.assert_array_equal(m.params[name], loaded.params[name])
    assert isinstance(sample_text(loaded, codec, "🤖", steps=4, seed=1), str)
