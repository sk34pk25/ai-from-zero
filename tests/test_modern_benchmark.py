import hashlib
import importlib.util
import json
import zipfile
import numpy as np
import pytest
from model.benchmark_modern import ROOT, PROTOCOL, documents, evaluate_documents, benchmark
from model.tokenizer import CharTokenizer
from model.transformer import GPTConfig, TinyGPT


def test_literary_protocol_reserves_books_and_primary_authors(tmp_path):
    _, groups = documents()
    assert {k:len(v) for k,v in groups.items()} == {"train":12,"validation":3,"test":6}
    for key in ("book","author"):
        values=[{d[key] for d in docs} for docs in groups.values()]
        assert not values[0]&values[1] and not values[0]&values[2] and not values[1]&values[2]
    broken=json.loads(PROTOCOL.read_text())
    next(d for d in broken["documents"] if d["split"]=="test")["author"]=broken["documents"][0]["author"]
    path=tmp_path/"bad.json";path.write_text(json.dumps(broken))
    with pytest.raises(ValueError,match="chevauche"): documents(path)


def test_evaluation_counts_each_target_once_including_the_remainder():
    tok=CharTokenizer("abc�")
    model=TinyGPT(GPTConfig(vocab_size=4,d_model=4,n_heads=1,n_layers=1,block_size=4))
    for value in model.params.values(): value[:]=0
    result=evaluate_documents(model,[{"id":"a","text":"abca"},{"id":"b","text":"cabaabc"}],tok,np.full((4,4),0.25),3)
    assert result["target_tokens"]==9
    assert result["loss"]==pytest.approx(np.log(4))
    assert result["baselines"]["bigram"]==pytest.approx(result["loss"])


def test_selection_precedes_test_and_archive_preserves_bytes(tmp_path):
    run=tmp_path/"trial"
    r=benchmark(run,steps=2,seeds=(0,))
    assert len(r["runs"])==2 and len(r["test_final"])==1
    assert all(row["reload_identical"] for row in r["runs"])
    for row in r["runs"]:
        assert (run/row["folder"]/"test-final.json").exists()==(row["position"]==r["selected_position"])
    spec=importlib.util.spec_from_file_location("pack",ROOT/"scripts/package_modern_benchmark.py")
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    archive=module.package(run,tmp_path/"proof.zip")
    with zipfile.ZipFile(archive) as z:
        sums=json.loads(z.read("SHA256SUMS.json"))
        assert all(hashlib.sha256(z.read(n)).hexdigest()==h for n,h in sums.items())
        assert "model/benchmark_modern.py" in sums
        assert sum(n.endswith("modele.npz") for n in sums)==2
    with pytest.raises(FileExistsError): module.package(run,archive)
    with pytest.raises(FileExistsError): benchmark(run,steps=2,seeds=(0,))
