# Mon harness personnel — dossier final

Le livrable est un agent local inspectable, construit à partir de ton module élève et d’un modèle dont l’origine est documentée. La référence Hermes sert à comprendre les mécanismes ; ce projet pédagogique ne revendique pas ses plateformes, ses backends ni sa maturité de production.

## Pièces à fournir

- Code élève, versions Python/dépendances et commande exacte de lancement.
- Résultat des huit TP avec empreinte du module, et banc de régression complet avec échecs.
- Modèle réellement utilisé : checkpoint, tokenizer, configuration, empreinte et capacité de contexte ; distinguer toute fixture ou comparaison.
- Protocole de données : familles, séparation train/validation/test, hypothèse, graines et budget.
- Sonde du modèle réel, avec JSON valide et bonne action séparés.
- Une trace réussie, un refus correct, une panne suivie d’une reprise ou d’une réconciliation.
- Politique d’outils, effets autorisés, limites d’isolation et cas non couverts.
- Explication sur une tâche nouvelle, avec prédiction, résultat observé, erreur et contre-test.
- Aides utilisées et relecture par une personne réelle si elle a eu lieu. Aucune observation n’est préremplie.

Ne pas publier de jetons, fichiers privés ou échanges de participants. Un checkpoint volumineux peut être référencé par son empreinte et son emplacement choisi, sans l’ajouter au dépôt public.

## Grille de relecture sur 20

| Axe | 0 | 1–2 | 3 | 4 | Preuve |
| --- | --- | --- | --- | --- | --- |
| Contrats et boucle | Absents | Démonstration partielle | Formats et budgets vérifiés | Contre-exemples et arrêts expliqués sur un cas nouveau | À renseigner |
| Outils et permissions | Effets incontrôlés | Chemin heureux seul | Refus et accord contrôlés | Limites et scénarios hostiles diagnostiqués | À renseigner |
| Contexte, mémoire, reprise | Absents | Persistance partielle | Sources et reprise cohérentes | Panne au milieu d’un effet et réconciliation démontrées | À renseigner |
| Modèle et évaluation | Origine inconnue | Fixture ou mesure incomplète | Modèle réel, cas réservés et coûts | Comparaison reproductible et limites expliquées | À renseigner |
| Autonomie d’explication | Non observée | Explication aidée ou descriptive | Reconstruction et diagnostic observés | Prédiction, exécution et contre-test autonomes sur un cas nouveau | À renseigner |

La note est attribuée après relecture de preuves. Un rapport JSON importé ne certifie ni l’exécution ni l’identité. Une fixture ne reçoit pas les points de capacité d’un modèle neuronal.

## Observation d’un débutant

Choisir un palier après ses prérequis. Demander de reconstruire un parseur, diagnostiquer un rejeu puis expliquer une trace avec d’autres nombres. Noter le temps actif, les blocages, les aides et les abandons. Faire un nouvel essai réservé après correction ou quelques jours. Recueillir l’accord avant de partager une trace. Un petit pilote repère des obstacles ; il ne démontre pas une efficacité universelle du cours.

## Extensions à développer après cette remise

Connecteurs de messagerie avec gestion de destinataires, backends de terminal réellement isolés, protocole de plugins, sous-agents parallèles, planificateur persistant et supervision de service. Le projet livré fournit les mécanismes de base : API locale, procédures documentaires, délégation synchrone bornée et file locale explicitement déclenchée. Une extension doit garder ses contrôles et faire l’objet d’une mesure distincte.
