# AI From Zero

Parcours francophone pour partir d'aucune base en informatique et arriver à concevoir une petite architecture : Python, réseau, tokenizer, bigramme, Transformer, variantes modernes, coût, Mixture of Experts, SSM, multimodal, mémoire, puis une candidate que tu peux mesurer.

Le site publié : [https://sk34pk25.github.io/ai-from-zero/](https://sk34pk25.github.io/ai-from-zero/)

![Accueil du parcours, thème clair, grand écran](docs/images/accueil-bureau-clair.png)

## Où en est le parcours

157 étapes, 14 niveaux, toutes rédigées. Aucune étape n'est laissée au statut « planifié ». Chaque leçon ouvre sur une intuition, un schéma (parfois manipulable), puis les objectifs, les pièges, des indices progressifs et une correction. Le plan lisible est généré dans [`docs/CURRICULUM.md`](docs/CURRICULUM.md) à partir de [`data/curriculum.json`](data/curriculum.json). Les sources de rédaction sont dans `curriculum_src/` ; le script `scripts/build_curriculum.py` régénère le JSON, les aides et le plan, et les tests refusent qu'ils divergent.

La piste [Construire mon LLM](https://sk34pk25.github.io/ai-from-zero/#/construire) relie les leçons aux fichiers de `model/`, du dossier vide jusqu'à un TinyGPT entraîné, puis au BPE, au catalogue de données, au playground et à l'ajustement. Le compte-rendu d'un run CPU réel est dans [`data/gpt_run.json`](data/gpt_run.json).

## Ce qui s'ajoute au parcours

- `python3 -m model.bpe` n'est pas une commande : le tokenizer est `model/bpe.py`. `scripts/train_release.py` entraîne le BPE du run publié (1 500 fusions) puis le modèle. Une comparaison antérieure, plus courte, avait déjà donné moins de nats par caractère au BPE qu'aux caractères.
- Le playground est `#/playground`. Il charge `data/gpt_browser.json`, produit par `python3 -m model.export_js`.
- Le catalogue est `#/donnees`, lu depuis `data/datasets.json`. Préparer un jeu : `python3 -m model.datasets list`, puis `python3 -m model.datasets prepare <id> --max-mb 5`. Les fichiers lourds ne sont pas commités. `python3 -m model.gpt_train --dataset <id>` ou `--plan plan.json` enchaîne pré-entraînement et ajustement.
- L'ajustement masqué et LoRA sont dans `model/finetune.py` et `model/lora.py`. Les 294 paires du cours sont dans `model/data/instructions_fr.json`. Le compte-rendu est [`data/finetune_run.json`](data/finetune_run.json).
- L'IDE `#/ide` et les exercices exécutables chargent Pyodide dans un worker, seulement quand le propriétaire les lance. Le pas à pas rejoue une trace, il ne fige pas la page.
- La page À propos est `#/a-propos`.

Le cadenas de l'interface laisse le site lisible pour tout le monde. Il n'est pas la sécurité : seul le compte dont l'UUID est dans `assets/config.js` peut écrire, et `supabase/schema.sql` le redit avec RLS. Le mode d'emploi est [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md). Sans configuration, tout reste en lecture seule. La progression, les quiz et les fichiers d'IDE ne sont pas enregistrés pour un visiteur. Le thème, lui, reste local.

## Lancer le site en local

Le site est statique : pas d'étape de build pour le publier. Les modules JavaScript et le chargement du parcours demandent un serveur HTTP (ouvrir `index.html` en `file://` ne suffit pas).

```bash
python3 -m http.server 4173
```

Puis ouvre [http://127.0.0.1:4173/](http://127.0.0.1:4173/). La progression et le thème restent dans le navigateur (`localStorage`). Une leçon se partage par son adresse, par exemple `http://127.0.0.1:4173/#/lecon/4.5`.

GitHub Pages sert la branche `main` telle quelle (fichier `.nojekyll` à la racine).

## Lancer le laboratoire

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest
python3 -m model
```

Le code vit dans [`model/`](model/README.md) : tokenizer caractère, bigramme, autograd NumPy, petit modèle (`tiny_lm.py`), TinyGPT entraînable (embeddings, attention multi-têtes, MLP, résidus, LayerNorm, AdamW), et les variantes en forward (RoPE, RMSNorm, SwiGLU, GQA, cache), MoE, scan sélectif, patches, mémoire, ablations. Pas de PyTorch, pour que les tests restent installables partout.

```bash
python3 -m model.gpt_train --steps 400
python3 -m model.gpt_sample --prompt "le chat "
python3 -m model.datasets list
python3 -m model.export_js --prompt "Le "
```

## Vérifier

```bash
pytest
npm ci
npm test
npm run validate:html
npx playwright install chromium
npm run test:e2e
CHROME_PATH="$(node -e "console.log(require('playwright').chromium.executablePath())")" npm run lighthouse
```

L'intégration continue est dans [`.github/workflows/ci.yml`](.github/workflows/ci.yml) : pytest, tests JavaScript, validation HTML, Playwright (parcours, leçons, quiz, recherche au clavier, thème, historique, mobile, visuels, axe, catalogue, IDE) et Lighthouse. Le script Lighthouse sert les fichiers compressés, comme GitHub Pages, et refuse un score sous 95 au bureau comme sur mobile.

Les bundles `assets/vendor/editor.js` et `assets/vendor/supabase.js` sont déjà construits, pour que le site n'ait pas d'étape de build. Pour les refaire : `npx esbuild scripts/vendor-editor.js --bundle --format=esm --outfile=assets/vendor/editor.js` et la même commande pour `scripts/vendor-supabase.js`.

## Structure

| Chemin | Rôle |
| --- | --- |
| `index.html`, `assets/js/`, `assets/css/` | Site statique |
| `data/curriculum.json` | Source lue par le site |
| `curriculum_src/` | Rédaction des leçons |
| `docs/CURRICULUM.md` | Plan généré, une ligne par étape |
| `model/` | Laboratoire NumPy |
| `tests/` | pytest, tests JavaScript, Playwright |

## Dernier entraînement publié

Les chiffres viennent de `scripts/train_release.py`, sur CPU, avec l'autograd NumPy. Ce n'est pas une courbe dessinée.

Pré-entraînement sur les sept livres Gutenberg préparés (4 509 357 caractères, non commités), BPE de 1 500 fusions, vocabulaire 1 632. Le modèle a 652 000 paramètres : largeur 80, 5 couches, 4 têtes, bloc 64, batch 8. AdamW, pas de pointe 2,5e-3, montée sur 281 pas, puis cosinus jusqu'à 10 % de ce pas, gradient coupé à 1. 4 220 pas en 2 140 s. Perte train 7,417 → 4,373. Perte validation 7,410 → 4,607, sur 24 fenêtres réparties. La validation est la fin du corpus, donc la fin des Trois Mousquetaires. Elle baissait encore un peu en fin de run, d'environ 0,02 par 200 pas.

Trois suites tirées de ce checkpoint, invites fixées avant le tirage :

- `Il `, température 0 : « Il ne pouvait être un homme de regarde ce de ce de ce beau de ce beau de ce beau de ponze mille livres de camens, qui avait été élevé par un peu à un peu »
- `Le `, température 0,7, top-k 8 : « Le feu et d'artel des membles, le plus épisel de massés. Les mers les cachins qui n'ont point le pend du _Nautilus_ se récielopent »
- `La `, température 0,5, top-k 4 : « La fille-là, en retournant et à cette évie des fourrconsphysieurs du matin, il est un homme de villagrés qui ne savait pas un homme qui avait fait un »

On y lit des mots et de courts bouts de phrase (« qui avait été élevé », « Les mers », « en retournant », « _Nautilus_ »). Les répétitions (« de ce beau ») et les mots inventés (« épisel », « villagrés ») restent là.

L'ajustement utilise 294 paires écrites pour le cours, licence MIT, pas un jeu externe. La question et la réponse sont encodées à part, pour que le BPE ne traverse pas la frontière. Perte moyenne sur les réponses : complet 5,347 → 0,317 en 8 000 pas (4 000 à 1e-3, puis 4 000 à 5e-4). LoRA rang 32, pas 2e-3, 230 400 poids entraînés : 5,347 → 2,265 en 4 000 pas. Un premier LoRA à 8e-3, avant la séparation question/réponse, ne baissait presque pas (5,148 → 5,049) et la perte de lot montait. L'export du playground est le complet, perte moyenne plus basse.

Trois réponses à température 0, questions fixées avant le tirage. Elles sont dans le fichier d'instructions :

- « qu'est-ce qu'un token » → « un morceau de texte représenté par un entier », puis la suite dérape.
- « qu'est-ce que LoRA » → « deux petites matrices ajoutées à un poids gelé », puis quelques tokens de trop.
- « qui a écrit madame bovary » → « gustave flaubert », puis la suite dérape.

Une question absente du fichier, « explique le masque causal en une phrase », donne « non, il reste proche des livres et des paires ». C'est une autre paire du cours, pas une explication du masque. Le modèle récite, il ne reformule pas.

## Licences

Le code (site, laboratoire, scripts, tests) est sous licence [MIT](LICENSE). Le contenu pédagogique — leçons, énoncés, quiz, plan de cours — est sous licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
