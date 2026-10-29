"""Archive du banc littéraire : sources vérifiées et checkpoints hors de Git."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile
ROOT = Path(__file__).resolve().parents[1]


def package(run, destination):
    run, destination = Path(run), Path(destination)
    report = json.loads((run / "benchmark.json").read_text(encoding="utf-8"))
    if report.get("format") != "afz-modern-benchmark-v1":
        raise ValueError("Rapport moderne requis")
    allowed = {p.relative_to(ROOT).as_posix() for p in ROOT.glob("model/*.py")} | {
        "data/benchmark_literature_protocol.json", "model/data/corpus_fr.txt",
        "model/data/SOURCES.md", "data/datasets.json", "requirements.txt", "LICENSE"}
    hashes, files = report["recipe"]["source_hashes"], {}
    if set(hashes) != allowed:
        raise ValueError("Inventaire différent du protocole")
    for name, digest in hashes.items():
        raw = (ROOT / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != digest:
            raise ValueError("Source modifiée depuis le run : " + name)
        files[name] = raw
    for row in report["runs"]:
        folder = row["folder"]
        if not isinstance(folder, str) or Path(folder).name != folder or folder in (".", ".."):
            raise ValueError("Chemin de run invalide")
        p = run / folder / "modele.npz"
        if hashlib.sha256(p.read_bytes()).hexdigest() != row["checkpoint_sha256"]:
            raise ValueError("Checkpoint modifié depuis le run")
        for name in ("modele.npz", "rapport.json", "test-final.json"):
            p = run / folder / name
            if p.is_file(): files["experience/" + folder + "/" + name] = p.read_bytes()
    for name in ("benchmark.json", "recette-avant-test.json", "selection-avant-test.json"):
        files["experience/" + name] = (run / name).read_bytes()
    files["SHA256SUMS.json"] = (json.dumps({p: hashlib.sha256(b).hexdigest() for p, b in sorted(files.items())}, indent=2) + "\n").encode()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "x", zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()): archive.writestr(name, data)
    return destination


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--run", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    print(package(a.run, a.out))
