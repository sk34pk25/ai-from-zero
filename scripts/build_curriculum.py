#!/usr/bin/env python3
"""Compile les leçons sources vers data/curriculum.json et docs/CURRICULUM.md.

Le JSON commité est la source lue par le site. Ce script sert à le régénérer
à partir de curriculum_src/ pendant la rédaction. Le contrôle de cohérence
des docs, lui, ne dépend que du JSON.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "curriculum_src"
JSON_PATH = ROOT / "data" / "curriculum.json"
DOC_PATH = ROOT / "docs" / "CURRICULUM.md"

PATTERN = [0, 1, 2, 3, 1, 2, 3, 0, 2, 3, 0, 1, 3, 0, 1, 2]

META = {
    "title": "AI From Zero",
    "language": "fr",
    "description": (
        "Un parcours francophone pour partir d'aucune base en informatique et arriver à concevoir, "
        "entraîner et comparer une petite architecture de modèle. Chaque étape explique une idée, "
        "montre comment elle se code, avance le même laboratoire, puis se vérifie par un quiz."
    ),
    "contract": (
        "Point de départ : aucune connaissance informatique supposée. Une notion n'arrive qu'après "
        "ses prérequis. Chaque étape suit le même geste : intuition, vocabulaire, explication, "
        "exemple, expérience, exercice, fil rouge, quiz."
    ),
}

LEVELS = [
    (0, "Fondations numériques", "Prendre en main la machine, Python, puis les quelques outils mathématiques qui reviendront dans chaque modèle.", "Un programme lit une colonne de nombres, calcule un résumé statistique et écrit un rapport. Dans le dépôt, c'est model/stats.py."),
    (1, "Machine learning depuis zéro", "Comprendre ce que veut dire apprendre, puis écrire un petit réseau dont on voit passer le calcul et le gradient.", "Un prédicteur linéaire, puis un réseau à une couche cachée, entraînés par descente de gradient. Référence : model/mlp.py et model/train.py."),
    (2, "Transformer le langage en nombres", "Passer du texte à des identifiants, puis à des vecteurs, sans cacher le tokenizer dans une bibliothèque.", "Un tokenizer caractère, un mini-BPE et un visualiseur. Référence : model/tokenizer.py."),
    (3, "Premier modèle de langage", "Prédire le prochain token avec un bigramme, mesurer la perplexité, générer.", "Un modèle bigramme lissé, entraînable et capable d'échantillonner. Référence : model/bigram.py."),
    (4, "Transformer construit à la main", "Assembler l'attention, le masque causal, les résidus et un bloc decoder-only sans module préfabriqué.", "Un mini-GPT NumPy dont on peut vérifier la causalité et le cache. Référence : model/attention.py et model/transformer.py."),
    (5, "Transformer moderne", "Remplacer, une par une, les pièces de 2017 par celles qu'on retrouve dans les modèles récents.", "RoPE, RMSNorm, SwiGLU, GQA et weight tying sont des options du même TinyGPT."),
    (6, "Efficacité et machines modestes", "Compter la mémoire, les FLOPs et le compromis qualité / vitesse / RAM avant de grossir le modèle.", "Des formules explicites et un tableau trié. Référence : model/bench.py."),
    (7, "Mixture of Experts", "Garder le calcul d'un petit réseau tout en augmentant le nombre de paramètres utiles.", "Un FFN à experts, routeur top-k, capacité et perte d'équilibrage. Référence : model/moe.py."),
    (8, "State space models et Mamba", "Une autre façon de lire une séquence : un état qui se met à jour, au lieu d'une attention quadratique.", "Une récurrence sélective, un scan associatif, et un dos interchangeable. Référence : model/ssm.py et model/backbone.py."),
    (9, "Multimodal", "Faire entrer une deuxième modalité dans le même espace de vecteurs que le texte.", "Découpage d'une image en patches et projection linéaire. Référence : model/multimodal.py."),
    (10, "Mémoire, retrieval et calcul adaptatif", "Dépasser la fenêtre de contexte par une mémoire qu'on peut éteindre et mesurer.", "Une recherche par similarité et un contexte construit à partir des extraits. Référence : model/memory.py."),
    (11, "Frontière de la recherche", "Lire une idée récente, la réduire à une expérience, et dire ce qui n'a pas été reproduit.", "Un comparateur baseline / variante. Référence : model/experiment.py."),
    (12, "Concevoir ton architecture", "Formuler une hypothèse, la mesurer contre une baseline, et documenter le compromis.", "Trois dos interchangeables — Transformer, SSM, hybride — avec la même forme de sortie."),
]

ARCHITECTURE = [
    {"id": "machine", "name": "Machine", "step": "0.1", "summary": "CPU, RAM, stockage, puis GPU : savoir quel ressource sature quand un entraînement échoue."},
    {"id": "stats", "name": "Statistiques", "step": "0.15", "summary": "Lire une série, calculer moyenne et écart-type, écrire un rapport reproductible."},
    {"id": "reseau", "name": "Réseau", "step": "1.7", "summary": "Un neurone, une activation, une couche : la fonction paramétrée que l'on va entraîner."},
    {"id": "tokenizer", "name": "Tokenizer", "step": "2.5", "summary": "La frontière entre une chaîne Unicode et les entiers que le modèle consomme."},
    {"id": "bigramme", "name": "Bigramme", "step": "3.2", "summary": "La baseline de langage : la probabilité du token suivant ne dépend que du token courant."},
    {"id": "attention", "name": "Attention", "step": "4.4", "summary": "Chaque position regarde les précédentes via requêtes, clés et valeurs."},
    {"id": "transformer", "name": "Transformer", "step": "4.13", "summary": "Empilement de blocs decoder-only, avec résidus, normalisation et tête de sortie."},
    {"id": "moderne", "name": "Blocs modernes", "step": "5.2", "summary": "RoPE, RMSNorm, SwiGLU, GQA, cache KV et poids partagés."},
    {"id": "mesures", "name": "Mesures", "step": "6.3", "summary": "Octets par paramètre, FLOPs d'attention et tableau qualité / temps / RAM."},
    {"id": "moe", "name": "Mixture of Experts", "step": "7.4", "summary": "Plusieurs FFN, un routeur top-k, une capacité et une perte d'équilibre."},
    {"id": "ssm", "name": "SSM", "step": "8.7", "summary": "État récurrent sélectif, scan parallèle, alternative linéaire à l'attention."},
    {"id": "patches", "name": "Patches", "step": "9.2", "summary": "Une image devient une séquence de patches projetés dans la dimension du modèle."},
    {"id": "memoire", "name": "Mémoire externe", "step": "10.4", "summary": "Des documents retrouvés par similarité, injectés dans le contexte, et désactivables."},
    {"id": "experiences", "name": "Expériences", "step": "11.2", "summary": "Une baseline et une variante, sur le même découpage, avec les mêmes métriques."},
    {"id": "candidate", "name": "Architecture candidate", "step": "12.8", "summary": "Le dos se change sans changer la forme de la sortie : Transformer, SSM ou hybride."},
]


def parse_file(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    lessons = []
    for block in text.split("\n@@@\n"):
        if not block.strip():
            continue
        fields: dict[str, str] = {}
        current = None
        buf: list[str] = []

        def flush() -> None:
            nonlocal buf, current
            if current is not None:
                fields[current] = "\n".join(buf).strip()
            buf = []

        for line in block.splitlines():
            if line.startswith("@") and line[1:].split(" ", 1)[0].isalpha() and line[1:].split(" ", 1)[0].isupper():
                flush()
                key, _, rest = line[1:].partition(" ")
                current = key.lower()
                buf = [rest] if rest else []
            else:
                if current is None:
                    continue
                buf.append(line)
        flush()
        lessons.append(fields)
    return lessons


def bullets(value: str) -> list[str]:
    items = []
    for line in value.splitlines():
        line = line.strip()
        if line.startswith("- "):
            items.append(line[2:].strip())
    return items


def lesson_from_fields(fields: dict[str, str], answer_index: int) -> dict:
    required = ["id", "title", "tag", "minutes", "why", "objectives", "prereq", "intuition", "vocab", "explain", "code", "experiment", "exercise", "build", "question", "correct", "wrong", "explanation"]
    missing = [key for key in required if not fields.get(key, "").strip()]
    if missing:
        raise SystemExit(f"Champs vides pour {fields.get('id', '?')} : {missing}")
    wrong = bullets(fields["wrong"])
    goals = bullets(fields["objectives"])
    if len(wrong) != 3 or len(goals) != 3:
        raise SystemExit(f"{fields['id']} : 3 objectifs et 3 mauvaises réponses requis")
    choices = list(wrong)
    choices.insert(answer_index, fields["correct"].strip())
    if len(set(choices)) != 4:
        raise SystemExit(f"{fields['id']} : réponses de quiz non distinctes")
    limits = {
        "why": 140,
        "intuition": 120,
        "vocab": 70,
        "explain": 220,
        "experiment": 70,
        "exercise": 70,
        "build": 80,
        "explanation": 70,
        "question": 25,
        "correct": 8,
    }
    for key, minimum in limits.items():
        if len(fields[key].strip()) < minimum:
            raise SystemExit(f"{fields['id']} : {key} trop court ({len(fields[key].strip())} < {minimum})")
    code = fields["code"]
    if code.startswith(":::"):
        code = code.split("\n", 1)[1]
    if code.endswith(":::"):
        code = code[: code.rfind(":::")].rstrip("\n")
    if len(code.strip()) < 40:
        raise SystemExit(f"{fields['id']} : exemple de code trop court")
    return {
        "id": fields["id"].strip(),
        "title": fields["title"].strip(),
        "tag": fields["tag"].strip(),
        "minutes": int(fields["minutes"]),
        "why": fields["why"].strip(),
        "objectives": goals,
        "prereq": fields["prereq"].strip(),
        "sections": [
            {"kind": "intuition", "heading": "Intuition", "text": fields["intuition"].strip()},
            {"kind": "vocab", "heading": "Vocabulaire", "text": fields["vocab"].strip()},
            {"kind": "explain", "heading": "Explication", "text": fields["explain"].strip()},
            {"kind": "code", "heading": "Exemple", "lang": fields.get("lang", "python").strip() or "python", "code": code.strip("\n")},
            {"kind": "experiment", "heading": "Expérience", "text": fields["experiment"].strip()},
        ],
        "exercise": fields["exercise"].strip(),
        "build": fields["build"].strip(),
        "quiz": {
            "question": fields["question"].strip(),
            "choices": choices,
            "answer": answer_index,
            "explanation": fields["explanation"].strip(),
        },
    }


def render_markdown(data: dict) -> str:
    lines = [
        f"# {data['meta']['title']} — parcours maître",
        "",
        "## Contrat pédagogique",
        data["meta"]["contract"],
        "",
        data["meta"]["description"],
        "",
        "## Sommaire",
    ]
    for level in data["levels"]:
        lines.append(f"- [{level['id']} — {level['title']}](#{anchor(level)}) — {len(level['steps'])} étapes")
    lines.append("")
    for level in data["levels"]:
        lines.append(f"## {level['id']} — {level['title']}")
        lines.append("")
        lines.append(level["summary"])
        lines.append("")
        lines.append(f"**Projet :** {level['project']}")
        lines.append("")
        lines.append("| Étape | Titre | Pourquoi | Fil rouge |")
        lines.append("| --- | --- | --- | --- |")
        for step in level["steps"]:
            why = step["why"].replace("\n", " ")
            build = step["build"].replace("\n", " ")
            lines.append(f"| {step['id']} | {step['title']} | {why} | {build} |")
        lines.append("")
    lines.append("## Critères de sortie")
    lines.append("")
    lines.append(
        "Le parcours est réussi si tu peux expliquer une brique sans jargon inutile, la retrouver dans `model/`, "
        "lancer son test, dire ce qu'elle coûte, la remplacer par une alternative du laboratoire et comparer le résultat à une baseline."
    )
    lines.append("")
    return "\n".join(lines)


def anchor(level: dict) -> str:
    raw = f"{level['id']} — {level['title']}".lower()
    raw = raw.replace(" ", "-")
    raw = re.sub(r"[^a-z0-9àâäéèêëïîôùûüçœ-]", "", raw)
    return raw


def build_data() -> dict:
    by_level: dict[int, list] = {level_id: [] for level_id, *_ in LEVELS}
    order = 0
    for path in sorted(SRC.glob("*.md")):
        for fields in parse_file(path):
            level_id = int(fields["id"].split(".")[0])
            lesson = lesson_from_fields(fields, PATTERN[order % len(PATTERN)])
            order += 1
            by_level[level_id].append(lesson)
    levels = []
    for level_id, title, summary, project in LEVELS:
        steps = sorted(by_level[level_id], key=lambda step: [int(part) for part in step["id"].split(".")])
        expected = {"0": 20, "1": 17, "2": 11, "3": 11, "4": 14, "5": 9, "6": 12, "7": 9, "8": 9, "9": 9, "10": 8, "11": 8, "12": 12}[str(level_id)]
        ids = [step["id"] for step in steps]
        if ids != [f"{level_id}.{index}" for index in range(1, expected + 1)]:
            raise SystemExit(f"Niveau {level_id} incomplet : {ids}")
        levels.append({"id": level_id, "title": title, "summary": summary, "project": project, "steps": steps})
    return {"meta": META, "levels": levels, "architecture": ARCHITECTURE}


def main() -> None:
    data = build_data()
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    DOC_PATH.write_text(render_markdown(data), encoding="utf-8")
    total = sum(len(level["steps"]) for level in data["levels"])
    print(f"{total} leçons -> {JSON_PATH}")


if __name__ == "__main__":
    main()
