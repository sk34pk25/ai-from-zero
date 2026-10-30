# AI From Zero

Parcours francophone pour partir d'aucune base en informatique et arriver à concevoir une petite architecture : Python, réseau, tokenizer, bigramme, Transformer, variantes modernes, coût, Mixture of Experts, SSM, multimodal, mémoire, puis une candidate que tu peux mesurer.

Le site publié : [https://sk34pk25.github.io/ai-from-zero/](https://sk34pk25.github.io/ai-from-zero/)

![Accueil du parcours, thème clair, grand écran](docs/images/accueil-bureau-clair.png)

## Où en est le parcours

161 étapes, 14 niveaux, toutes rédigées. Aucune étape n'est laissée au statut « planifié ». Chaque leçon ouvre sur une intuition, un schéma (parfois manipulable), puis les objectifs, les pièges, des indices progressifs et une correction. Le plan lisible est généré dans [`docs/CURRICULUM.md`](docs/CURRICULUM.md) à partir de [`data/curriculum.json`](data/curriculum.json). Les sources de rédaction sont dans `curriculum_src/` ; le script `scripts/build_curriculum.py` régénère le JSON, les aides et le plan, et les tests refusent qu'ils divergent.

La piste [Construire mon LLM](https://sk34pk25.github.io/ai-from-zero/#/construire) relie les leçons aux fichiers de `model/`, du dossier vide jusqu'à un TinyGPT entraîné, puis au BPE, au catalogue de données, au playground et à l'ajustement. Le compte-rendu d'un run CPU réel est dans [`data/gpt_run.json`](data/gpt_run.json).

## Design et format visuel

Le site utilise le thème « Cahier lumineux » : fond clair, bleu vif `#2558E8`, surligneur jaune, polices Inter et Inter Display servies par le site (`assets/fonts/`, licence OFL). La variante sombre « Cahier nuit » suit le réglage du système et reste au choix avec le bouton de thème.

Chaque leçon présente d’abord ses objectifs et prérequis, puis l’intuition illustrée et l’explication complète, ouverte en cours guidé. La révision visuelle permet de la replier. Le code, la pratique et les contrôles précèdent le quiz, le bilan et les liens de suite. Un sommaire permet de rejoindre chaque activité ; les commandes de lecture sont dans « Affichage et lecture ». Les résumés visuels sont écrits dans `curriculum_src/visuel/`.

## Ce qui s'ajoute au parcours

- `python3 -m model.bpe` n'est pas une commande : le tokenizer est `model/bpe.py`. `scripts/train_release.py` entraîne le BPE du run publié (1 500 fusions) puis le modèle. Une comparaison antérieure, plus courte, avait déjà donné moins de nats par caractère au BPE qu'aux caractères.
- Le playground est `#/playground`. Il charge les poids publiés de `data/gpt_browser.json`. Pour tes essais, `python3 -m model.export_js` écrit un export séparé dans `runs/gpt_browser.json`.
- Le catalogue est `#/donnees`, lu depuis `data/datasets.json`. Préparer un jeu : `python3 -m model.datasets list`, puis `python3 -m model.datasets prepare <id> --max-mb 5`. Les fichiers lourds ne sont pas commités. `python3 -m model.gpt_train --dataset <id>` ou `--plan plan.json` enchaîne pré-entraînement et ajustement.
- L'ajustement masqué et LoRA sont dans `model/finetune.py` et `model/lora.py`. Les 294 paires du cours sont dans `model/data/instructions_fr.json`. Le compte-rendu est [`data/finetune_run.json`](data/finetune_run.json).
- L'IDE `#/ide` et les exercices exécutables chargent Pyodide dans un worker, lors d’un lancement explicite de l’activité. Le pas à pas rejoue une trace, il ne fige pas la page.

Le cadenas de l'interface laisse le site lisible pour tout le monde. Il n'est pas la sécurité : seul le compte dont l'UUID est dans `assets/config.js` peut écrire, et `supabase/schema.sql` le redit avec RLS. Le mode d'emploi est [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md). Sans configuration, tout reste en lecture seule. Par défaut, rien n'est enregistré pour un visiteur, à part le thème. S'il le demande (« Suivre ma progression sur cet appareil »), ses étapes cochées, quiz, résultats et brouillons d’exercices restent dans son navigateur, sans compte ni envoi ; il peut les exporter, les réimporter ou les effacer depuis l'accueil (`assets/js/learner.js`). L'IDE et la synchronisation restent réservés au propriétaire. Le positionnement `#/positionnement` demande douze réponses et un petit programme contrôlé avant de proposer de survoler le niveau 0. Les étapes liées aux erreurs restent à faire. Son programme peut être testé sans compte ni sauvegarde.

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

Le code vit dans [`model/`](model/README.md) : tokenizer caractère, bigramme, autograd NumPy, petit modèle (`tiny_lm.py`), TinyGPT entraînable (embeddings, attention multi-têtes, MLP, résidus, LayerNorm, AdamW) avec ses variantes modernes elles aussi entraînables (RoPE, RMSNorm, SwiGLU, GQA, poids partagés ; `--pos rope --ffn swiglu --norm rms --kv-heads 2 --tie-weights`), le cache KV pour la génération, MoE, scan sélectif, patches, mémoire, ablations. Pas de PyTorch, pour que les tests restent installables partout.

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
npm run test:python-runtime
CHROME_PATH="$(node -e "console.log(require('playwright').chromium.executablePath())")" npm run lighthouse
```

L'intégration continue est dans [`.github/workflows/ci.yml`](.github/workflows/ci.yml) : pytest, tests JavaScript, validation HTML, Playwright (parcours, leçons, quiz, recherche au clavier, thème, historique, mobile, visuels, axe, catalogue, IDE) et Lighthouse. La suite `test:python-runtime` demande HTTPS vers jsDelivr : elle charge réellement Python/NumPy, entraîne un petit GPT, vérifie le positionnement et l'arrêt/redémarrage du moteur sous Chromium, Firefox et WebKit. Le script Lighthouse sert les fichiers compressés, comme GitHub Pages, et refuse un score sous 95 au bureau comme sur mobile.

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

## Espace personnel, lecture et expériences

- `#/espace` : notes, favoris, reprise de lecture, séances de 15/30/60 minutes, révisions datées, sauvegarde JSON et restauration avec aperçu.
- `#/glossaire` : termes issus du vocabulaire des leçons, avec lien vers leur contexte.
- `#/experiences` : comparaison des rapports publiés, des runs enregistrés et d'un rapport JSON local. Les données absentes restent « Non mesuré ».
- Les 161 corrigés propres aux exercices sont édités dans `curriculum_src/corrections.json`. Les 66 exercices Python ont un squelette à compléter, une solution et des contrôles exécutés en CI. Les bilans de niveau restent des autoévaluations explicites.
- Le playground charge le second modèle à la demande, affiche les tokens de l'invite, accepte une graine et une longueur de génération, et mesure la vitesse sur l'appareil. Les sorties ajustées s'arrêtent au premier saut de ligne. La comparaison utilise le même prompt et les mêmes réglages ; ce n'est pas un benchmark de généralisation.

Les brouillons sont écrits localement à la saisie. La synchronisation distante est réservée au propriétaire. `supabase/workspace.sql` ajoute `learning_records` et une fonction d'écriture atomique avec numéro de révision, sans modifier la fonction `is_owner()` existante. Cette extension est appliquée au projet du site. Une modification concurrente conserve les deux versions jusqu'au choix dans Mon espace. La migration des fichiers historiques conserve aussi les copies divergentes. Ne supprime pas les anciennes tables avant d'avoir exporté et vérifié les données.

La sauvegarde exporte uniquement les données d'apprentissage connues, jamais les clés de session. Une restauration demande un fichier valide et un clic de confirmation ; les mêmes clés sont remplacées, les autres conservées. La réinitialisation de la progression garde notes, favoris et fichiers. La réinitialisation locale est distincte du changement synchronisé sur tous les appareils.

Le site est installable depuis le menu du navigateur. Le cache public permet la lecture des cours hors connexion ; Mon espace propose aussi le téléchargement des fichiers de cours et des modèles du playground. Les appels Supabase et les sessions ne sont jamais mis dans ce cache. L'exécution Python nécessite une connexion pour charger Pyodide et NumPy ; elle n'est pas annoncée comme disponible hors connexion. Une session expirée peut demander une reconnexion avant l'accès aux données privées.

## Entraînement reproductible et reprise

Les nouveaux entraînements découpent le texte **avant** de construire le tokenizer. `--dataset` conserve les fichiers préparés `train.txt` et `val.txt` séparés ; `--validation chemin.txt` fournit une validation explicite. Le tokenizer fixe remplace un caractère absent par `�` lorsque cet alphabet de remplacement a été réservé ; le rapport donne le nombre de caractères inconnus, les empreintes des deux textes et les versions Python/NumPy. Les anciens rapports publiés ne sont pas recalculés ni présentés comme des évaluations nouvelles.

Les éléments `pretrain` d'un `--plan` poursuivent désormais les poids du modèle précédent. Ils réinitialisent volontairement l'optimiseur et le générateur aléatoire pour chaque nouvelle phase ; l'alphabet reste fixe. Les dimensions doivent être identiques.

Pour une reprise exacte au sein d'une phase, les nouveaux checkpoints conservent les moments AdamW, son compteur, le RNG, le calendrier total et les empreintes des données. Exemple miniature :

```bash
python3 -m model.gpt_train --steps 20 --total-steps 40 --checkpoint /tmp/phase.npz
python3 -m model.gpt_train --steps 20 --resume /tmp/phase.npz --checkpoint /tmp/phase-fin.npz
```

La recette et les données doivent rester identiques. Pour une configuration personnalisée, répète ses options lors de la reprise. Un test compare tous les poids d'une exécution continue avec une exécution sauvegardée/rechargée.

`compare_finetunes` réserve validation et test sur les jeux d'au moins dix paires, en regroupant réponses identiques et questions lexicalement proches. Ce regroupement n'est pas un détecteur sémantique : relire les groupes reste pertinent. Sur un jeu plus petit, le résultat est explicitement un diagnostic sur train. Le script de publication garde le même découpage pendant les essais, choisit sur validation et mesure le test réservé après sélection. Son pré-entraînement réserve un livre entier et utilise par défaut un budget fixe de 4 220 pas et cinq couches. Aucun nouveau run long n'a été exécuté pour cette mise à jour.

## Vérifier les navigateurs et le backend

La CI Chromium exécute le parcours complet. Deux jobs supplémentaires exécutent les scénarios responsive et espace personnel avec Firefox et WebKit. WebKit valide un moteur apparenté à Safari ; cela ne remplace pas un essai sur un véritable iPhone/iPad. Les scénarios incluent zoom, stockage indisponible, coupure réseau, deux appareils et conflit de révisions. Les tests qui simulent les API bloquent les service workers ; le test du cache les active explicitement pour ne pas contourner les simulations réseau.

La vérification backend a confirmé les refus de lecture/écriture d'un autre compte, l'absence de droits anonymes et le refus atomique d'une révision obsolète, dans des transactions annulées. L'advisor Supabase conserve un avertissement : la protection contre les mots de passe compromis est désactivée. Ce paramètre Auth n'est pas exposé par le connecteur utilisé ; il reste à activer dans le tableau de bord lorsque le plan le permet : https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Atelier personnel et progression

L’[atelier du site](https://sk34pk25.github.io/ai-from-zero/#/atelier) livre un projet autonome : `eleve.py` à compléter, corrigé séparé, primitives de tableaux NumPy, douze TP cumulatifs, entraînement et évaluation. Les 161 leçons restent accessibles à leurs adresses. Le tronc commun recommandé est **0 → 1 → 2 → 3 → 4 → 13**, puis 5 et 6 pour les variantes/coûts. Les autres niveaux sont des approfondissements.

Les guides sont [Installation](atelier/INSTALLATION.md), [12 TP](atelier/GUIDE.md) et [Projet final](atelier/PROJET_FINAL.md). Les bilans ont quatre critères spécifiques par niveau ; les anciennes cases génériques sont conservées comme historique, pas interprétées comme maîtrise des nouveaux critères. L’épreuve finale demande code personnel, documents réservés, baselines, checkpoint rechargé et variation contrôlée. Les contrôles publics ne certifient pas l’autonomie ; la grille /20 demande aussi des explications et une reconstruction sans corrigé.

Depuis le dépôt, les commandes de validation de la référence sont :

```bash
python3 atelier/verifier.py --module correction
python3 atelier/entrainer.py --module correction --steps 120 --out runs/verification-atelier
python3 scripts/check_examples.py
```

Le mode `correction` teste la référence. Pour apprendre, complète `eleve.py` et utilise le module par défaut. Les démos répètent des phrases synthétiques et ne démontrent pas un transfert entre livres. Le projet téléchargé fonctionne hors du dépôt avec NumPy ; aucun poids existant ni API n’est chargé.

## Contrôles indépendants et modèle personnel

L’atelier contrôle aussi des valeurs attendues indépendantes de l’attention, de la loss et des têtes. Les tests de mutation refusent sept erreurs volontaires : échelle, loss constante, masque, ordre des têtes, cible, résidu et accumulation. `--tp N` permet un contrôle individuel lorsque les TP précédents demandent des leçons encore non étudiées. Les nouveaux checkpoints lient poids, code, moteur, données normalisées et documents connus ; l’évaluation refuse le recouvrement connu. Les rapports neufs ne peuvent pas écraser sources ou poids.

Le choix « Mon parcours » dès l’accueil, dans Atelier et Mon espace règle Continuer et les séances : par défaut 0 → 1 → 2 → 3 → 4 → 13, soit 84 leçons, puis le bilan du projet. Les 77 explorations restent accessibles séparément et possèdent leur propre indicateur. Le planificateur est public ; le suivi local et son point d’arrêt sont facultatifs. Mon espace distingue lecture, rapport de contrôles importé et explications déclarées. Ces déclarations ne certifient pas l’autonomie.

Le [banc français](atelier/BANC_FR.md) contient douze textes originaux, huit train/deux validation/deux test, sans répétition automatique. Six entraînements réels comparent largeurs 16/24, trois graines appariées et 240 pas. La largeur 16 est retenue sur validation ; son test moyen vaut **2,3921 ± 0,0082 nats/caractère** (écart-type des trois graines), contre **2,4514** pour le bigramme et **3,9703** pour l’uniforme, sur les mêmes cibles. Le tokenizer réserve aussi � ; le détail de couverture est dans le rapport. Ces résultats locaux ne constituent pas une preuve de supériorité générale ni de réponses fiables. [Rapport réel](data/benchmark_fr_run.json).

Les [extensions exécutables](atelier/EXTENSIONS.md) ajoutent BPE octets, BOS/EOS/PAD, un port du decoder en opérations PyTorch avec contrôle de chaque gradient, puis génération/API sur 127.0.0.1 pour le checkpoint personnel. NumPy reste suffisant pour le tronc commun. Le laboratoire accepte `--byte-bpe 64` ; le playground historique ne lit pas encore ce format. Les [fondations](atelier/FONDATIONS.md) et [pannes guidées](atelier/PANNES.md) renforcent objets, axes et gradients. Un diagnostic de [questions par familles](atelier/benchmark/questions.json) et `model.eval_questions` distingue loss, exact-match lexical et arrêt, avec relecture des sorties.

Les groupes SFT sont maintenant canoniques : réordonner les lignes conserve les splits. L’historique des groupes réservés est contrôlé et conservé dans les nouveaux checkpoints entre phases SFT. Les anciens checkpoints sans cet historique restent explicitement non vérifiables. Le contrôle lexical ne garantit pas l’absence de paraphrases ou de contamination du pré-entraînement.

Après modification des sources partagées, `python scripts/build_atelier.py` régénère leurs copies autonomes et les catalogues Python/atelier. `python scripts/build_curriculum.py` intègre les compléments du cours. Termine par `npm run stamp` pour les versions et le cache hors connexion.

Les commandes ordinaires `model.gpt_train` et `model.gpt_sample` utilisent désormais `runs/gpt_checkpoint.npz`, et le rapport va dans `runs/gpt_run.json`. L’export CLI va dans `runs/gpt_browser.json`. Les poids et rapports publiés dans `model/data/` et `data/` sont conservés ; `scripts/train_release.py` reste le chemin explicite de publication.

### Plan SFT avec validation réservée

`--plan` utilise le même regroupement lexical train/validation/test que le comparateur. Des fichiers explicites se déclarent avec `instructions` (train), `validation` et `test` dans la phase SFT. Un recouvrement de groupes est refusé. Un jeu trop petit exige `diagnostic_train: true` pour annoncer un diagnostic sur train. Les rapports donnent les tailles, empreintes, cibles retenues et exemples inconnus/tronqués.

```bash
python3 -m model.gpt_train --plan examples/plan-sft.json --checkpoint runs/sft-demo/modele.npz --report runs/sft-demo/rapport.json
```

Cet exemple court valide l’outillage ; il ne promet pas un assistant utile. Compare les recettes sur validation. Après choix, demande la mesure finale avec `--test-final` ; ne réutilise pas ce résultat pour choisir d’autres réglages. Les données réservées ne servent pas aux mises à jour des poids. Le format reste mono-tour ; la fin de réponse est le saut de ligne, pas un token EOS spécialisé.

Le workflow manuel « Publier un benchmark et ses checkpoints » exécute la recette fixée et joint une archive avec sources, poids et SHA256SUMS à une GitHub Release. Les futurs poids sont ainsi distribués hors de l’historique Git ; ce workflow n’est pas déclenché par les visites du site.

Un plan peut repartir des poids et de l’historique SFT d’un checkpoint avec `--plan nouveau-plan.json --resume runs/precedent.npz`. Ce sont de nouvelles phases ; leurs optimiseurs sont réinitialisés. Les groupes réservés restent protégés. Une reprise exacte dans une même phase continue d’utiliser `--resume` sans `--plan`, avec la recette identique.


Le second [banc littéraire](atelier/BANC_FR.md) compare réellement baseline et RoPE sur 21 extraits de sept livres, avec auteurs principaux réservés et trois graines appariées. Le [rapport](data/benchmark_modern_run.json) conserve les résultats, coûts et limites. Le [protocole de relecture](atelier/RELECTURE.md) prépare des essais avec de vrais débutants et appareils : les cases restent à remplir après observation.

### Apprendre visuellement

Les leçons proposent des calculs inspectables, des matrices sélectionnables, des graphes de gradients et une attention causale numérique. Avance à ton rythme, relie chaque étape à son code NumPy, puis vérifie ta prédiction. Voir [le guide de l’apprentissage visuel](docs/APPRENTISSAGE_VISUEL.md).
