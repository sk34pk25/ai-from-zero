# Un petit banc français, avec preuves et limites

Le corpus benchmark/textes.json contient douze documents originaux en français, sous licence MIT : huit pour train, deux pour validation, deux pour test. Il ne répète pas automatiquement des phrases. Les documents ont une provenance de rédaction commune : réserver leurs IDs ne réserve pas des auteurs indépendants.

Le fichier benchmark/manifest.json fige le hash du corpus, l’appartenance aux splits et l’invite de génération AVANT le run. Le lanceur refuse un dossier existant. Toute modification du corpus demande un nouveau protocole et une nouvelle identité de benchmark ; ne change pas ses données après avoir vu un résultat pour conserver le même nom de test.

## Exécuter

Depuis le dossier de l’atelier, avec ton module complété :

```bash
python benchmark.py --module eleve --out runs/banc-fr --steps 240 --widths 16,24 --seeds 0,1,2
```

Le mode correction vérifie la référence seulement. Les six runs utilisent les mêmes textes, tokenizer caractère, fenêtre, batch, learning rate et nombre de pas. La largeur fait varier les paramètres et le coût ; ce n’est pas une comparaison à FLOPs constants. Chaque run sélectionne ses poids sur validation. La moyenne de validation choisit une largeur. Seuls les checkpoints de cette largeur sont ensuite évalués sur le test, avec leurs graines fixées.

Les résultats comprennent les paires de mesures par graine, les courbes, les poids retenus, les hashes et la machine. Les baselines uniforme/bigramme utilisent le même tokenizer et les mêmes cibles que le GPT pour chaque mesure. Le test couvre toutes ses cibles ; la dernière fenêtre peut recouvrir la précédente et le rapport donne le nombre de cibles comptées. Trois graines décrivent une variabilité limitée, sans établir une supériorité statistique générale.

## Lire et conserver

Ouvre runs/banc-fr/benchmark.json ou importe-le dans la page Expériences. La recette écrite avant l’évaluation est recette-avant-test.json. Les fichiers test-final.json sont distincts des rapports de validation. Conserve également tes checkpoints : un hash de fichier, seul, ne permet pas de reconstruire son contenu.

Ne relance pas les variantes en choisissant sur le test. Si le GPT perd contre le bigramme, publie le résultat et cherche une hypothèse à tester sur validation avec un prochain protocole. Une bonne loss par caractère ne démontre pas des réponses correctes à des questions.

## Questions, reformulations et abstention

Le jeu questions.json propose un second diagnostic, groupé par famille. Les reformulations d’une famille restent ensemble. Certains cas demandent une information absente et attendent une abstention. Le laboratoire fournit model.eval_questions pour calculer loss de réponse, exact-match textuel, répétitions et présence d’un arrêt. Le score exact ne reconnaît pas tous les synonymes : relis les sorties.

Depuis la racine du dépôt, sur TON checkpoint ajusté :

```bash
python -m model.eval_questions --checkpoint runs/sft/modele.npz --questions atelier/benchmark/questions.json --split validation --out runs/questions-validation.json
python -m model.eval_questions --checkpoint runs/sft/modele.npz --questions atelier/benchmark/questions.json --split test --test-final --out runs/questions-test.json
```

Les anciens poids sans historique des groupes restent marqués « indépendance non vérifiable ». L’évaluateur ne transforme pas ces anciens poids en assistant fiable. Les cas réservés sont publics pour l’apprentissage ; leur simple publication ne garantit pas leur absence d’un autre corpus. N’entraîne pas sur ces cas si tu veux les conserver comme test.

Pour préparer les trois fichiers d’instructions en gardant les familles : `python -m model.eval_questions --questions atelier/benchmark/questions.json --prepare-to runs/questions`. Dans un plan SFT, utilise ensuite train.json comme instructions, validation.json comme validation et test.json comme test. Le fichier source questions.json contient tous les splits : ne l’utilise pas directement comme jeu d’entraînement.


## Un second banc : sept livres et des auteurs principaux réservés

Depuis la racine du dépôt complet (le lanceur n'est pas dans le ZIP autonome de l'atelier) :

~~~bash
OPENBLAS_NUM_THREADS=1 python -m model.benchmark_modern --out runs/litterature-rope
python scripts/package_modern_benchmark.py --run runs/litterature-rope --out runs/litterature-rope.zip
~~~

Sous PowerShell, fixer d'abord $env:OPENBLAS_NUM_THREADS="1", puis lancer les commandes Python. Aucun téléchargement : data/benchmark_literature_protocol.json fige les positions et empreintes des extraits du corpus existant, décrit dans model/data/SOURCES.md. Les textes gardent leurs conditions ; ils ne deviennent pas MIT par leur présence à côté du code.

Le protocole précède le calcul : 21 extraits de 6 000 caractères, sept livres et cinq auteurs principaux ; 12 train (Voltaire, Verne), 3 validation (Flaubert), 6 test (Hugo, Dumas). Aucun livre ni auteur principal ne traverse les splits. Le paratexte peut provenir d'autres contributeurs : ces groupes ne prouvent pas une absence de toute contribution commune. Les romans historiques d'une seule plateforme éditoriale ne représentent pas tous les usages du français.

Positions absolues contre RoPE : une modification conceptuelle, largeur 16, une couche, deux têtes, bloc 32, batch 4, 600 pas, graines 0/1/2. Les matrices communes de chaque paire partent des mêmes poids neufs et reçoivent les mêmes lots. Les poids finaux au budget fixé sont comparés ; le choix se fait sur la moyenne de validation documentaire avant le test de cette seule position. Le tokenizer caractère vient seulement de train. Les caractères inconnus sont remplacés et comptés. Chaque cible est évaluée une fois dans son document, y compris le dernier morceau court.

Le rapport data/benchmark_modern_run.json conserve les six runs, les générations fixées, paramètres, coûts, empreintes et différences appariées. Validation moyenne : baseline 2,4747, RoPE 2,3112. Différence RoPE−baseline : −0,1635 nat/caractère ; écart-type des trois différences 0,0141. RoPE retenu obtient au test 2,3841 ± 0,0094, contre 2,5335 pour le bigramme et 4,6151 pour l'uniforme. Les comparaisons portent sur les mêmes 35 996 cibles ; 42 caractères sont remplacés. Baseline : 6 912 paramètres ; RoPE : 6 400. Pas et tokens sont égaux, pas les paramètres ni les FLOPs.

Ce résultat ne valide ni un chat ni une supériorité générale de RoPE. Trois graines donnent une dispersion descriptive. Les anciens poids du playground ont vu certains livres ; ils ne servent pas ici, où tout part de zéro. Ne choisir aucun nouveau réglage sur ce test public après consultation de ses résultats. Une nouvelle question demande un autre protocole et, si nécessaire, d'autres documents réservés.

L'archive contient sources exactes, données existantes, rapports, poids et SHA256SUMS. L'empaquetage refuse une source ou un checkpoint changé depuis le run. Le workflow manuel de publication propose litterature pour ce banc, atelier pour le premier ; les nouveaux poids restent hors de l'historique Git.
