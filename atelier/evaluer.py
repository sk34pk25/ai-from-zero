"""Mesure finale réservée ; ne pas utiliser ce résultat pour choisir des réglages."""

import argparse
import json
from pathlib import Path
from commun import (
    charger,
    module_eleve,
    empreinte,
    provenance_texte,
    sortie_sure,
    ecrire_json,
)
from entrainer import evaluer, ids_couverts


def evaluation(module, checkpoint, test, output):
    m = module_eleve(module)
    sortie_sure(output, (checkpoint, test, m.__file__))
    if Path(output).suffix.lower() != ".json":
        raise ValueError("Un rapport doit avoir l'extension .json")
    p, vocab, c, meta = charger(checkpoint, avec_metadata=True)
    text = Path(test).read_text(encoding="utf-8")
    current = provenance_texte(test)
    provenance = meta.get("provenance")
    if provenance:
        if provenance["code_sha256"] != empreinte(m.__file__) or provenance[
            "moteur_sha256"
        ] != empreinte(Path(__file__).with_name("moteur.py")):
            raise ValueError(
                "Le code ou le moteur diffère du checkpoint : entraîne une nouvelle expérience"
            )
        for name in ("train", "validation"):
            used = provenance[name]
            if used["normalise_sha256"] == current["normalise_sha256"]:
                raise ValueError("Le test recouvre les données " + name)
            known = {d["sha256"] for d in used.get("documents", [])}
            if known & {d["sha256"] for d in current.get("documents", [])}:
                raise ValueError("Documents de test déjà utilisés dans " + name)
    ids, unknown = ids_couverts(m, text, vocab)
    mesure = evaluer(m, p, c, ids, max_windows=None, detail=True)
    documentary = bool(
        provenance
        and current.get("documents")
        and all(provenance[name].get("documents") for name in ("train", "validation"))
    )
    r = {
        "format": "afz-atelier-test-v1",
        "checkpoint_sha256": empreinte(checkpoint),
        "code_sha256": empreinte(m.__file__),
        "test_sha256": empreinte(test),
        "test_loss": mesure["loss"],
        "mesure": mesure,
        "known_overlap_checked": bool(provenance),
        "test_independent": documentary,
        "provenance_status": (
            "splits contrôlés ; quasi-doublons à relire"
            if documentary
            else (
                "empreintes contrôlées ; indépendance documentaire non vérifiable"
                if provenance
                else "indépendance du test non vérifiable : ancien checkpoint"
            )
        ),
        "caracteres_inconnus": unknown,
        "limite": "Résultat final ; si tu le consultes pour choisir, constitue ensuite un nouveau test.",
    }
    ecrire_json(output, r, (checkpoint, test, m.__file__))
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
