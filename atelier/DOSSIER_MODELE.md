# Mon dossier de modèle

Copie ce document et remplis-le pour ton projet final avec PROJET_FINAL.md. Les champs vides et les échecs restent visibles. Aucun résultat ni aucune note ne sont attribués à l'avance.

## Mon hypothèse et mon budget

- Version/commit de mon code et fonctions complétées dans eleve.py :
- Aides consultées et parties réalisées seul :
- Hypothèse sur un corpus différent de demo/ :
- Résultat qui me ferait rejeter mon hypothèse :
- Budget décidé avant entraînement : pas, batch, contexte, largeur, profondeur, graines :
- Machine, Python et NumPy :

## Des documents réellement réservés

Choisis des textes dont tu peux justifier la provenance et les conditions d'utilisation. Évite les données personnelles. Réserve des documents entiers avant l'entraînement ; garde les fichiers d'un même livre ou auteur dans un seul split. preparer.py sépare des fichiers entiers, mais ne connaît pas leurs auteurs : il ne garantit pas cette indépendance à ta place.

| Split | Documents et groupe livre/auteur | Provenance/licence | Taille | SHA-256 |
| --- | --- | --- | --- | --- |
| Train | | | | |
| Validation | | | | |
| Test réservé | | | | |

- Normalisation, doublons exacts retirés et quasi-doublons examinés :
- Tokenizer ajusté uniquement sur train :
- Caractères inconnus en validation/test et traitement retenu :
- Date de gel des données et du budget :

Pour des fichiers indépendants en UTF-8, `python preparer.py mes_documents donnees --seed 0` produit les trois fichiers et provenance.json. Vérifie la répartition avant tout entraînement. Si les groupes se chevauchent, constitue toi-même train.txt, validation.txt et test.txt avec des groupes disjoints et conserve leur manifeste. Ne recommence pas le tirage pour obtenir un meilleur score après avoir consulté le test.

## Mes preuves techniques

Depuis le dossier autonome, après avoir complété eleve.py :

```bash
python verifier.py --module eleve --rapport controles.json
python entrainer.py --module eleve --train donnees/train.txt --validation donnees/validation.txt --steps 120 --seed 0 --out runs/personnel-a
```

120 pas vérifient le fonctionnement, sans garantir la qualité. Fixe ensuite un budget adapté avant ta comparaison et utilise un nouveau dossier pour chaque run. Le mode correction vérifie la référence, pas ton autonomie.

| Preuve | Fichier ou explication | Résultat/problème |
| --- | --- | --- |
| Contrôles des 12 TP | controles.json | |
| Formes, cibles décalées et causalité expliquées | | |
| Gradient vérifié numériquement | | |
| Minuscule lot volontairement surappris | | |
| Poids modifiés dans les différentes briques | rapport.json | |
| Logits identiques après rechargement | rapport.json | |
| Une panne diagnostiquée et corrigée | | |

## Ma comparaison contrôlée

Change une seule variable : par exemple largeur OU profondeur. Conserve les mêmes textes, tokenizer, contexte, batch et pas pour comparer des budgets en tokens. Cela ne garantit pas le même nombre de paramètres ou de FLOPs. Apparier les graines entre les configurations permet de mieux discuter la variabilité.

| Configuration/graine | Paramètres | Tokens vus | Train | Validation | Bigramme sur les mêmes fenêtres | Durée |
| --- | --- | --- | --- | --- | --- | --- |
| A / | | | | | | |
| B / | | | | | | |

- Configuration retenue uniquement sur validation et raison du choix :
- Si le GPT ne bat pas le bigramme, analyse de l'échec :
- Prompt, graine et réglages fixés avant la génération :
- Ce que l'échantillon démontre et ses limites :

Après ce choix, mesure le checkpoint retenu sur le test réservé :

```bash
python evaluer.py --module eleve --checkpoint runs/personnel-a/modele.npz --test donnees/test.txt --out runs/test-final.json
```

Adapte le chemin au run effectivement retenu. Après lecture de ce résultat, ne l'utilise pas pour sélectionner un autre modèle. Une nouvelle sélection demande de nouvelles données de test. Les pertes par token obtenues avec des tokenizers différents ne se comparent pas directement.

- Score test, baselines et nombre de cibles évaluées :
- Limites de la mesure :
- Prochaine expérience et nouveau test si nécessaire :

## Ce que je sais reconstruire et expliquer

Sans ouvrir la correction, explique le masque avec d'autres nombres, le décalage entrée/cible et le trajet d'un gradient. Reconstruis une brique et vérifie-la sur un cas nouveau choisi par la personne qui relit. Indique l'aide reçue : réussir après aide reste une étape d'apprentissage, pas une preuve d'autonomie complète.

| Axe de PROJET_FINAL.md | Preuve examinée | Cas nouveau/explication | Aide reçue | Note /4 après relecture |
| --- | --- | --- | --- | --- |
| Fondations et explications | | | | |
| Modèle construit | | | | |
| Exactitude | | | | |
| Autonomie et expérimentation | | | | |
| Évaluation et reproductibilité | | | | |

## Si je poursuis avec un fine-tuning

Prépare les questions réservées avant l'ajustement. Garde des groupes indépendants et sépare les exemples de train des vraies questions d'évaluation. Ajoute des reformulations inédites et des demandes auxquelles le corpus ne permet pas de répondre. Compare le modèle de départ et le modèle ajusté avec les mêmes réglages.

| Type | Question | Réponse attendue/abstention acceptable | Avant | Après |
| --- | --- | --- | --- | --- |
| Diagnostic sur un exemple connu, déclaré comme tel | | | | |
| Reformulation inédite réservée | | | | |
| Fait absent des données | | | | |

Une loss très basse sur train peut correspondre à de la récitation. Conserve les réponses hors sujet et échecs de reformulation. Les outils de BANC_FR.md aident à organiser ces mesures ; aucun tableau ne prouve à lui seul la fiabilité d'un assistant général.
