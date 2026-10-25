# AI From Zero

Parcours francophone pour partir d'aucune base en informatique et arriver à concevoir une petite architecture : Python, réseau, tokenizer, bigramme, Transformer, variantes modernes, coût, Mixture of Experts, SSM, multimodal, mémoire, puis une candidate que tu peux mesurer.

Le site publié : [https://sk34pk25.github.io/ai-from-zero/](https://sk34pk25.github.io/ai-from-zero/)

![Accueil du parcours, thème clair, grand écran](docs/images/accueil-bureau-clair.png)

## Où en est le parcours

157 étapes, 14 niveaux, toutes rédigées. Aucune étape n'est laissée au statut « planifié ». Chaque leçon ouvre sur une intuition, un schéma (parfois manipulable), puis les objectifs, les pièges, des indices progressifs et une correction. Le plan lisible est généré dans [`docs/CURRICULUM.md`](docs/CURRICULUM.md) à partir de [`data/curriculum.json`](data/curriculum.json). Les sources de rédaction sont dans `curriculum_src/` ; le script `scripts/build_curriculum.py` régénère le JSON, les aides et le plan, et les tests refusent qu'ils divergent.

La piste [Construire mon LLM](https://sk34pk25.github.io/ai-from-zero/#/construire) relie les leçons aux fichiers de `model/`, du dossier vide jusqu'à un TinyGPT entraîné, puis au BPE, au catalogue de données, au playground et à l'ajustement. Le compte-rendu d'un run CPU réel est dans [`data/gpt_run.json`](data/gpt_run.json).

## Ce qui s'ajoute au parcours

- `python3 -m model.bpe` n'est pas une commande : le tokenizer est `model/bpe.py`. On l'entraîne depuis Python, ou via `scripts/train_release.py`, qui compare caractères et BPE en nats par caractère.
- Le playground est `#/playground`. Il charge `data/gpt_browser.json`, produit par `python3 -m model.export_js`.
- Le catalogue est `#/donnees`, lu depuis `data/datasets.json`. Préparer un jeu : `python3 -m model.datasets list`, puis `python3 -m model.datasets prepare <id> --max-mb 5`. Les fichiers lourds ne sont pas commités. `python3 -m model.gpt_train --dataset <id>` ou `--plan plan.json` enchaîne pré-entraînement et ajustement.
- L'ajustement masqué et LoRA sont dans `model/finetune.py` et `model/lora.py`. Le jouet d'instructions est `model/data/instructions_fr.json`.
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

## Licences

Le code (site, laboratoire, scripts, tests) est sous licence [MIT](LICENSE). Le contenu pédagogique — leçons, énoncés, quiz, plan de cours — est sous licence [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
