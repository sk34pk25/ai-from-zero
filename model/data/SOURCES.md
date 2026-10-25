# Sources des textes

Les gros jeux ne sont pas dans le dépôt. `data/datasets.json` est la liste vérifiée le 2026-10-25 : chaque URL a répondu à un GET ou un HEAD. `python -m model.datasets prepare <id>` réécrit le texte nettoyé sous `model/data/prepared/<id>/` avec un fichier `ATTRIBUTION.md`. Ces dossiers sont ignorés par git.

## Dans le dépôt

| Fichier | Origine | Licence |
| --- | --- | --- |
| `model/data/francais.txt` | Texte jouet écrit pour le cours. Il commence par « le chat ». | MIT, comme le code. |
| `model/data/instructions_fr.json` | 294 paires question / réponse écrites pour le cours. Ce n'est pas un jeu public externe. | MIT, comme le code. |
| `model/data/corpus_fr.txt` | Extrait d'environ 180 000 caractères nettoyés par livre, pris dans les sept textes Project Gutenberg du catalogue. Le run publié n'utilise pas cet extrait : il entraîne sur les textes entiers préparés localement. | Texte original dans le domaine public. L'édition Project Gutenberg est sous la [Project Gutenberg License](https://www.gutenberg.org/policy/license.html). |

Le rapport `data/gpt_run.json` dit quel tokenizer a été retenu pour le run publié, et pourquoi. L'entraînement publié lit les sept livres entiers du catalogue, dans l'ordre : Candide, De la Terre à la Lune, Le Tour du monde en quatre-vingts jours, Madame Bovary, Les Misérables tome I, Vingt mille lieues sous les mers, Les Trois Mousquetaires. `python -m model.datasets prepare <id>` les reconstruit. Leurs fichiers nettoyés ne sont pas commités. L'en-tête de licence Project Gutenberg reste dans le téléchargement brut.

## Catalogue

Les fiches, les licences exactes et les réserves (partage à l'identique, usage non commercial, accès manuel, format non décodé) sont dans `data/datasets.json`. On n'en ajoute pas une sans avoir revu l'URL et la licence.

Jeux cités après vérification, et jeux écartés : le compte-rendu du changement les liste. En bref, CulturaX, Common Voice, OpenSubtitles et FQuAD n'ont pas de licence et d'URL vérifiées ensemble, ils ne sont pas dans le JSON.
