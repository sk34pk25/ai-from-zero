# Observer le parcours sur le terrain

Aucune session de débutant ni aucun appareil physique n’est déclaré testé par ce protocole. Les tests logiciels ne donnent pas une note de pédagogie. Le volume reste de 161 leçons ; on vérifie maintenant ce qu’une personne sait reconstruire, diagnostiquer et expliquer.

## Préparer un premier pilote

Inviter trois à cinq volontaires avec leur accord. Noter leurs bases réelles en Python et en mathématiques ; ne pas appeler « débutant » un programmeur expérimenté. Leur donner un alias distinct, sans nom, adresse ni donnée sensible. Définir ensemble les données conservées, la personne qui les relira et leur date d’effacement. En session visiteur, rien n’est transmis par le site. Le compte propriétaire synchronise ses dossiers privés : utiliser une session visiteur pour un essai sans envoi. L’enregistrement audio/vidéo demande un accord séparé ; il n’est pas nécessaire.

Utiliser un navigateur neuf. Expliquer la différence entre travail en mémoire, suivi local facultatif et export. Ouvrir **Mon espace → Éprouver ma compréhension sur un cas nouveau** (`#/preuves`). Choisir la variante A pour le premier essai ; réserver B à un second essai après correction ou après sept jours. Les variantes contiennent aussi des défauts différents : les scores ne sont pas supposés psychométriquement équivalents.

Le cours complet demande plusieurs séances : observer un palier après les leçons correspondantes, sans exiger qu’un vrai débutant connaisse déjà l’attention. Le chronomètre mesure le temps actif de la tentative ; il ne mesure pas le temps de tout l’apprentissage. Noter aussi les séances de lecture et de pratique dans le journal ci-dessous.

| Palier | Prérequis du cours | Reconstruction | Diagnostic | Transfert à expliquer |
| --- | --- | --- | --- | --- |
| Fondations | 0.9, 0.18, 1.4, 1.9 | Fonction affine | Carré et moyenne | Négatifs, biais et erreurs opposées |
| Texte | 2.4, 2.5, 2.11 | Encodage avec indices fixés | Cibles décalées et fenêtres complètes | Nouvelles unités et nouvelle séquence |
| Probabilités | 3.5, 3.6, 3.10 | Softmax stable | Base ou signe du logarithme | Autres logits, nats et perplexité |
| Attention | 4.3–4.6 | Masque causal | Racine de la dimension | Valeur attendue et modification du futur |
| Modèle personnel | 5.10, 12.4–12.12 | Détection de groupes communs | Graines appariées et signe de l’écart | Checkpoint réel, cas inédit, limite expliquée |

## Observer sans transformer l’essai en démonstration

1. Demander une prédiction et un calcul à la main avant d’exécuter. Laisser la personne expliquer son raisonnement à voix haute si elle le souhaite.
2. Démarrer une tentative. Ne pas fournir le code de la solution. Pour chaque blocage, relever action, attente, message, hypothèse et durée approximative.
3. Si la personne demande une aide, la laisser choisir : leçon, indice, corrigé, personne ou outil externe. La déclarer même si elle permet ensuite de réussir. Ne pas confondre essai autonome et essai accompagné.
4. Demander un contre-exemple qui échoue avec le code fautif, puis le relancer après correction. Une shape correcte ou un test causal ne suffisent pas à valider une attention numérique.
5. Demander une explication sans les choix du quiz. Sur le dernier palier, ouvrir son propre code et checkpoint : le contrôle miniature ne prouve pas l’existence d’un modèle personnel entraîné.
6. Terminer ou conserver l’abandon. Renseigner la relecture seulement après observation effective. Exporter le dossier avec l’accord de la personne. Conserver aussi les échecs et les aides, pas seulement la meilleure tentative.

## Grille commune par tentative

Les trois axes sont évalués séparément, de 0 à 2. Aucun score n’est prérempli et aucun succès Python ne remplit cette grille.

| Axe | 0 | 1 | 2 | Preuve à noter |
| --- | --- | --- | --- | --- |
| Reconstruire | Fonction absente ou incorrecte | Réussite partielle ou aidée | Reconstruction autonome sur le cas nouveau | Code, cas testé et aides |
| Diagnostiquer | Cause non identifiée | Défaut nommé sans vérification suffisante | Hypothèse, contre-exemple et vérification après correction | Entrée, sortie attendue et sortie observée |
| Expliquer | Résultat non expliqué | Décrit le calcul sans prédiction vérifiée | Prédit, vérifie et nomme une limite | Phrase exacte ou reformulation fidèle |

Noter **non évalué** lorsque la preuve manque. Une autoévaluation reste distincte d’une observation par un tiers. Le code et l’explication sont figés après fin de tentative ; une nouvelle version demande un nouvel essai. Le dossier lie le contrôle au code et à la version de l’épreuve ; il n’est ni signé ni une attestation d’identité.

## Journal des séances et incidents

| Alias | Date / version du site | Bases initiales | Palier / variante | Temps lecture | Temps pratique | Blocage et attente | Aide | Résultat sur cas nouveau | Action à tester |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| À remplir après observation | | | | | | | | | |

Pour chaque blocage, créer une correction vérifiable : par exemple « déplacer la définition du batch avant son premier usage », puis refaire l’essai avec une autre personne ou la variante réservée. Ne pas corriger seulement le texte en supposant le problème résolu.

## Décider à partir des preuves

Pour le pilote, traiter immédiatement tout obstacle qui empêche de lire, exécuter, sauvegarder ou reprendre. Revoir aussi les confusions rencontrées par plusieurs personnes. Rapporter les effectifs bruts : personnes invitées, participantes, tentatives terminées, abandons, contrôles réussis, aides et relectures réellement faites. Plusieurs tentatives d’une personne ne deviennent pas plusieurs personnes.

Un objectif de conception est que chaque participant puisse réussir les trois gestes à son rythme, puis refaire un cas réservé après sept jours. C’est une cible à mesurer, pas une promesse de résultat. Un pilote de trois à cinq personnes repère des obstacles ; il ne suffit pas à annoncer une efficacité universelle ni un 20/20 scientifique. Faire ensuite un second groupe de débutants et comparer les mêmes critères après les corrections.

Depuis la racine du dépôt, résumer les dossiers consentis :

```sh
python scripts/summarize_observations.py preuves-eleve-01.json preuves-eleve-02.json
python scripts/summarize_observations.py --format json preuves-eleve-01.json
```

Sans dossier, le script affiche zéro observation. Il distingue contrôles courants, relectures déclarées par un tiers et autonomie déclarée observée. Cette dernière demande un contrôle courant réussi, trois axes à 2 et aucune aide déclarée dans la tentative ou ses contrôles. Il exclut les relectures dont le contenu a changé, garde les abandons et refuse deux versions différentes d’une même tentative. Lire aussi les faits et les limites ; le nombre ne remplace pas la relecture.

## Projet final /20

Utiliser PROJET_FINAL.md et DOSSIER_MODELE.md. La grille du projet examine cinq axes sur quatre points : fondations et explications, modèle construit, exactitude, autonomie et expérimentation, évaluation et reproductibilité. Chaque point doit citer une trace, une commande ou une explication sur un cas nouveau. Aucune note n’est préremplie.

## Appareils physiques

Suivre aussi `docs/DEVICE_CHECKLIST.md` dans le dépôt. Noter OS, navigateur, version et date ; tester portrait/paysage, zoom, gros texte, clavier, ZIP, sauvegarde/reprise et réseau coupé/revenu. Tester deux onglets, un effacement suivi d’une réactivation et le stockage refusé. Les essais Chromium/Firefox/WebKit automatisés ne valent pas une observation sur iPhone, iPad ou Android physique. Les TP locaux demandent Python/NumPy ; lire sur tablette ne fournit pas un terminal système.
