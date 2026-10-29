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
