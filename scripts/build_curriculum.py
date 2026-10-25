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


INTERACTIVE = {
    "tokenize",
    "softmax",
    "descent",
    "loss",
    "attention",
    "transformer",
    "moe",
    "scan",
    "embed",
    "bigram",
    "patches",
    "relu",
    "retrieve",
}

VISUAL_CAPTION = {
    "tokenize": "Joue avec le texte : chaque caractère reçoit un identifiant stable, comme le tokenizer du laboratoire.",
    "softmax": "Des scores deviennent une distribution. La température étale ou concentre la masse.",
    "descent": "Le point descend la pente. Un pas trop grand dépasse le creux, un pas trop petit traîne.",
    "loss": "Chaque pas d'entraînement doit faire descendre la perte. Si elle monte, le pas est trop grand ou le gradient est faux.",
    "attention": "Choisis une position. Elle ne regarde que son passé : le futur reste masqué.",
    "transformer": "Un bloc relit, ajoute le résidu, transforme, puis ajoute encore. La forme ne change pas.",
    "moe": "Chaque token n'entre que dans l'expert au score le plus haut. Les autres restent en mémoire.",
    "scan": "L'état se met à jour. Plus l'oubli est fort, moins le premier pas survit à la fin.",
    "embed": "Deux vecteurs proches ont un produit scalaire élevé. L'ordre des coordonnées compte.",
    "bigram": "La ligne du token courant est une distribution sur le token suivant.",
    "patches": "Le carré en haut à gauche n'est pas le début de la première ligne : c'est un bloc.",
    "relu": "Sous zéro, la sortie est nulle. Au-dessus, la valeur passe telle quelle.",
    "retrieve": "La question et les documents sont comparés par les mots qu'ils partagent.",
    "bars": "Trois colonnes, trois unités. On ne les additionne pas.",
    "stack": "Les briques s'empilent. Changer celle du milieu ne change pas la forme de la sortie.",
    "compare": "Deux colonnes : ce qui est mesuré ici, et ce qui reste une lecture.",
    "machine": "CPU, mémoire, disque : trois ressources, trois façons de saturer.",
    "flow": "Une entrée, une transformation, une sortie. La forme se lit à chaque flèche.",
}

CODE_FILE = {
    "tokenize": "model/tokenizer.py",
    "softmax": "model/mathutil.py",
    "descent": "model/tiny_lm.py",
    "loss": "model/tiny_lm.py",
    "attention": "model/tiny_lm.py",
    "transformer": "model/transformer.py",
    "moe": "model/moe.py",
    "scan": "model/ssm.py",
    "embed": "model/tiny_lm.py",
    "bigram": "model/bigram.py",
    "patches": "model/multimodal.py",
    "relu": "model/mlp.py",
    "retrieve": "model/memory.py",
    "bars": "model/bench.py",
    "stack": "model/backbone.py",
    "compare": "model/experiment.py",
    "machine": "model/stats.py",
    "flow": "model/train.py",
}

TRACK = [
    {"id": "dossier", "title": "Un dossier vide", "step": "0.3", "file": "model/README.md", "summary": "Tu sais où tu es dans le terminal, et tu lances les commandes depuis la racine du dépôt."},
    {"id": "nombres", "title": "Lire des nombres", "step": "0.15", "file": "model/stats.py", "summary": "Le premier programme utile lit une colonne et écrit un résumé. Rien n'est encore un modèle."},
    {"id": "descente", "title": "Une perte qui descend", "step": "1.14", "file": "model/tiny_lm.py", "summary": "Une tête linéaire apprend par descente. Le gradient est calculé, pas deviné."},
    {"id": "tokenizer", "title": "Du texte aux identifiants", "step": "2.5", "file": "model/tokenizer.py", "summary": "Le tokenizer caractère est la frontière. Sans lui, le modèle ne voit que des lettres brutes."},
    {"id": "bigramme", "title": "La baseline", "step": "3.2", "file": "model/bigram.py", "summary": "Avant le réseau, le bigramme lissé donne la perplexité à battre."},
    {"id": "autograd", "title": "La rétropropagation", "step": "1.12", "file": "model/autograd.py", "summary": "Chaque opération se souvient de son gradient. C'est le moteur de l'entraînement."},
    {"id": "entrainement", "title": "Entraîner le petit modèle", "step": "3.8", "file": "model/tiny_lm.py", "summary": "train_tiny_lm lit un texte, descend la perte, puis propose une suite."},
    {"id": "attention", "title": "L'attention entraînable", "step": "4.4", "file": "model/tiny_lm.py", "summary": "Avec attention=True, le même entraînement traverse le masque causal et le softmax."},
    {"id": "echantillon", "title": "Échantillonner", "step": "3.9", "file": "model/tiny_lm.py", "summary": "Générer, c'est répéter : lire les scores du dernier pas, tirer un token, le recoller."},
    {"id": "evaluer", "title": "Évaluer sans tricher", "step": "11.2", "file": "model/experiment.py", "summary": "La fin de la séquence reste cachée. La baseline uniforme vaut la taille du vocabulaire."},
    {"id": "elargir", "title": "Élargir sans se raconter d'histoires", "step": "12.8", "file": "model/backbone.py", "summary": "Le dos interchangeable compare des formes. Il n'est pas, lui, entraîné de bout en bout."},
    {"id": "tetes", "title": "L'attention multi-têtes", "step": "4.7", "file": "model/transformer.py", "summary": "Plusieurs têtes relisent le passé en parallèle. Dans TinyGPT, le gradient traverse chacune."},
    {"id": "bloc", "title": "Le bloc decoder complet", "step": "4.11", "file": "model/transformer.py", "summary": "Norme, attention causale, résidu, norme, MLP GELU, résidu. Puis les embeddings, les blocs empilés et la tête."},
    {"id": "gpt", "title": "Entraîner ton GPT", "step": "4.14", "file": "model/gpt_train.py", "summary": "AdamW, découpage train/val, perte, checkpoint. Le corpus français est model/data/francais.txt."},
    {"id": "suite", "title": "Échantillonner ton GPT", "step": "3.9", "file": "model/gpt_sample.py", "summary": "Température et top-k sur ton checkpoint. Le texte doit ressembler au corpus que tu as entraîné."},
]


def visual_for(step_id: str, title: str) -> str:
    level, index = (int(part) for part in step_id.split("."))
    low = title.lower()
    if level == 2 and index >= 4:
        return "embed" if index >= 9 else "tokenize"
    if "softmax" in low or step_id in {"3.5", "0.19"}:
        return "softmax"
    if step_id in {"1.12", "1.13", "1.14", "0.20"} or "gradient" in low or "descente" in low:
        return "descent"
    if step_id in {"1.6", "1.7", "1.8"} or "relu" in low or "activation" in low:
        return "relu"
    if any(word in low for word in ("perplex", "loss", "entrop")) or step_id in {"1.9", "1.10", "1.11", "3.6", "3.7", "3.10"}:
        return "loss"
    if level == 4 and index <= 8:
        return "attention"
    if level in {4, 5}:
        return "transformer"
    if level == 7:
        return "moe"
    if level == 8:
        return "scan"
    if level == 9 and index in {2, 3, 6, 7}:
        return "patches"
    if level == 9:
        return "stack"
    if level == 3 and index <= 4:
        return "bigram"
    if level == 3:
        return "loss"
    if "vecteur" in low or "embedding" in low or "matrice" in low:
        return "embed"
    if level == 6:
        return "bars"
    if level == 10:
        return "retrieve"
    if level == 11:
        return "compare"
    if level == 12:
        return "stack"
    if level == 0 and index <= 5:
        return "machine"
    if level <= 1:
        return "flow"
    return "flow"


def learning_aids(fields: dict[str, str], correct: str, wrong: list[str], visual: str) -> dict:
    title = fields["title"].strip()
    code_file = CODE_FILE[visual]
    explanation = fields["explanation"].strip()
    why_first = fields["why"].strip().split(".")[0].strip()
    takeaways = [
        explanation,
        f"Pourquoi cette étape arrive maintenant : {why_first}.",
        f"Le fichier à ouvrir à côté du cours est {code_file}.",
    ]
    pitfalls = [
        f"Le piège le plus proche est de retenir « {wrong[0]} ». La phrase ressemble à l'étape, mais elle décrit autre chose.",
        f"Deuxième confusion : « {wrong[1]} ». Si ce mot te rassure trop vite, reviens au schéma avant la formule.",
        f"Troisième réflexe : « {wrong[2]} ». Vérifie la forme des tableaux et, s'il y a un futur, le masque.",
    ]
    hints = [
        "Ferme le code. Raconte l'intuition avec une image : un carnet, un réservoir, une file, une pente.",
        f"Garde la question sous les yeux, sans regarder les choix : {fields['question'].strip()}",
        f"Ouvre {code_file} et cherche la fonction citée dans le fil rouge. Le nom doit correspondre au geste, pas seulement au chapitre.",
    ]
    solution = (
        f"La réponse courte est : {correct}. {explanation} "
        f"Pour la rendre concrète, relie-la à {code_file} et à l'exercice : {fields['exercise'].strip()}"
    )
    review = f"Sans rouvrir la page, explique « {title} » en une phrase, puis dis ce que {code_file} en garde vraiment."
    return {
        "visual": visual,
        "visualCaption": VISUAL_CAPTION[visual],
        "interactive": visual in INTERACTIVE,
        "codeFile": code_file,
        "takeaways": takeaways,
        "pitfalls": pitfalls,
        "hints": hints,
        "solution": solution,
        "review": review,
    }


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
    visual = fields.get("visual", "").strip() or visual_for(fields["id"].strip(), fields["title"].strip())
    if visual not in VISUAL_CAPTION:
        raise SystemExit(f"{fields['id']} : visuel inconnu {visual}")
    aids = learning_aids(fields, fields["correct"].strip(), wrong, visual)
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
        **aids,
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
    return {"meta": META, "levels": levels, "architecture": ARCHITECTURE, "track": TRACK}


def main() -> None:
    data = build_data()
    JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    DOC_PATH.write_text(render_markdown(data), encoding="utf-8")
    total = sum(len(level["steps"]) for level in data["levels"])
    print(f"{total} leçons -> {JSON_PATH}")


if __name__ == "__main__":
    main()
