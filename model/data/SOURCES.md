# Sources des textes

Les gros jeux ne sont pas dans le dépôt. `data/datasets.json` est la liste vérifiée le 2026-10-25 : chaque URL a répondu à un GET ou un HEAD. `python -m model.datasets prepare <id>` réécrit le texte nettoyé sous `model/data/prepared/<id>/` avec un fichier `ATTRIBUTION.md`. Ces dossiers sont ignorés par git.

## Dans le dépôt

| Fichier | Origine | Licence |
| --- | --- | --- |
| `model/data/francais.txt` | Texte jouet écrit pour le cours. Il commence par « le chat ». | MIT, comme le code. |
| `model/data/instructions_fr.json` | Trente paires question / réponse écrites pour le cours. Ce n'est pas un jeu public externe. | MIT, comme le code. |
| `model/data/corpus_fr.txt` | Extrait d'environ 180 000 caractères nettoyés par livre, pris dans sept textes Project Gutenberg déjà listés dans le catalogue : Candide (4650), De la Terre à la Lune (799), Le Tour du monde en quatre-vingts jours (800), Madame Bovary (14155), Les Misérables tome I (17489), Vingt mille lieues sous les mers (5097), Les Trois Mousquetaires (13951). | Texte original dans le domaine public. L'édition Project Gutenberg est sous la [Project Gutenberg License](https://www.gutenberg.org/policy/license.html). L'en-tête de licence du fichier brut doit rester si tu redistribues le téléchargement complet. Cet extrait ne remplace pas le fichier brut. |

Le rapport `data/gpt_run.json` dit quel tokenizer a été retenu pour le run publié, et pourquoi.

## Catalogue

Les fiches, les licences exactes et les réserves (partage à l'identique, usage non commercial, accès manuel, format non décodé) sont dans `data/datasets.json`. On n'en ajoute pas une sans avoir revu l'URL et la licence.

Jeux cités après vérification, et jeux écartés : le compte-rendu du changement les liste. En bref, CulturaX, Common Voice, OpenSubtitles et FQuAD n'ont pas de licence et d'URL vérifiées ensemble, ils ne sont pas dans le JSON.
