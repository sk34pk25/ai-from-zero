"""Mesure finale réservée ; ne pas utiliser ce résultat pour choisir des réglages."""

import argparse
import json
from pathlib import Path
from commun import charger, module_eleve, empreinte
from entrainer import evaluer, ids_couverts


def evaluation(module, checkpoint, test, output):
    m = module_eleve(module)
    p, vocab, c = charger(checkpoint)
    text = Path(test).read_text(encoding="utf-8")
    ids, unknown = ids_couverts(m, text, vocab)
    r = {
        "format": "afz-atelier-test-v1",
        "checkpoint_sha256": empreinte(checkpoint),
        "code_sha256": empreinte(m.__file__),
        "test_sha256": empreinte(test),
        "test_loss": evaluer(m, p, c, ids),
        "caracteres_inconnus": unknown,
        "limite": "Résultat final ; si tu le consultes pour choisir, constitue ensuite un nouveau test.",
    }
    Path(output).write_text(
        json.dumps(r, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return r


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--module", default="eleve")
    p.add_argument("--checkpoint", type=Path, required=True)
    p.add_argument("--test", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    a = p.parse_args()
    print(
        json.dumps(
            evaluation(a.module, a.checkpoint, a.test, a.out),
            ensure_ascii=False,
            indent=2,
        )
    )
