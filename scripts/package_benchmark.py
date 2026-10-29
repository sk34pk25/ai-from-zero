"""Archive les poids hors Git, avec sources autonomes et sommes SHA-256."""

import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def package(run, destination):
    run, destination = Path(run), Path(destination)
    report = json.loads((run / "benchmark.json").read_text(encoding="utf-8"))
    if report.get("format") != "afz-benchmark-v1":
        raise ValueError("Rapport de benchmark requis")
    files = {}
    manifest = json.loads((ROOT / "data/atelier.json").read_text(encoding="utf-8"))
    for name in manifest["files"]:
        path = ROOT / name
        if not name.startswith("atelier/") or not path.resolve().is_relative_to(
            (ROOT / "atelier").resolve()
        ):
            raise ValueError("Source hors de l'atelier")
        files[name] = path.read_bytes()
    for row in report["runs"]:
        folder = row["folder"]
        if (
            not isinstance(folder, str)
            or Path(folder).name != folder
            or folder in (".", "..")
        ):
            raise ValueError("Chemin de run invalide")
        path = run / folder / "modele.npz"
        if hashlib.sha256(path.read_bytes()).hexdigest() != row["checkpoint_sha256"]:
            raise ValueError("Checkpoint différent du rapport")
        for name in ("modele.npz", "rapport.json", "test-final.json"):
            path = run / folder / name
            if path.is_file():
                files["experience/" + path.relative_to(run).as_posix()] = (
                    path.read_bytes()
                )
    for path in [
        run / "benchmark.json",
        run / "recette-avant-test.json",
        *(
            run / "corpus" / name
            for name in ("train.txt", "validation.txt", "test.txt", "provenance.json")
        ),
    ]:
        if path.is_file():
            files["experience/" + path.relative_to(run).as_posix()] = path.read_bytes()
    files["SHA256SUMS.json"] = (
        json.dumps(
            {
                name: hashlib.sha256(content).hexdigest()
                for name, content in sorted(files.items())
            },
            indent=2,
        )
        + "\n"
    ).encode()
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "x", zipfile.ZIP_DEFLATED) as archive:
        for name, data in sorted(files.items()):
            archive.writestr(name, data)
    return destination


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(package(args.run, args.out))
