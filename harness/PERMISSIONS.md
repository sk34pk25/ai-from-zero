# Effets, permissions et limites

## Ce que le projet exécute

| Outil | Entrée | Effet | Contrôle |
| --- | --- | --- | --- |
| calculer | expression | Arithmétique limitée | AST autorisé, taille, profondeur et valeurs bornées |
| lire_fichier | path relatif | Lecture UTF-8, 8000 octets maximum | Racine dédiée, refus de `..`, absolus et liens |
| ecrire_fichier | path, content | Création d’un fichier neuf | Activation explicite, proposition exacte, accord, revérification, ouverture exclusive |
| chercher | query | Recherche lexicale dans au plus 100 documents fournis | Trois extraits limités, sources conservées |
| diagnostic | preset | Version Python ou nom du système | Arguments fixes, `shell=False`, timeout de cinq secondes |

Les permissions sont vérifiées en Python, après parsing. Un outil inconnu, un argument supplémentaire ou une instruction trouvée dans un fichier ne crée aucun droit. Les outils n’installent aucune dépendance et n’envoient aucun message.

## Frontière effective

Le workspace est un dossier local dédié. La politique refuse les liens symboliques et revérifie les chemins après approbation. Elle suppose que les répertoires ne sont pas modifiés simultanément par un autre processus hostile. Ce contrôle applicatif n’est pas un bac à sable du système. Pour ajouter du code arbitraire, un terminal libre, un navigateur ou des plugins non fiables, construire et tester une isolation de processus/conteneur, des limites de ressources et une politique réseau. Ces backends ne sont pas fournis comme déjà sûrs.

La deadline est coopérative entre appels. L’API a un timeout propre. Un appel de modèle en cours ne peut pas être préempté par une simple vérification de temps dans la boucle. Ctrl+C interrompt l’interface native ; l’état garde le début d’un éventuel effet.

## Reprise

Un résultat déjà enregistré peut être réutilisé pour le même identifiant et les mêmes arguments. Un identifiant contradictoire est refusé. Une écriture commencée sans résultat confirmé produit `uncertain_effect` : inspecter l’état réel, consigner la réconciliation et démarrer une nouvelle session. Les fichiers existants ne sont pas écrasés.

Le code, les permissions, le modèle et les budgets font partie de la signature de reprise. Changer un de ces éléments exige une nouvelle session. Le journal chaîné détecte une incohérence ; il n’est pas une signature d’identité.

## Données et passerelle

La base et les jetons restent hors du workspace. Les rapports excluent les champs secrets connus, mais les tâches, fichiers et erreurs peuvent eux-mêmes contenir des données personnelles. Garder les traces localement et choisir les éléments partagés. Les clés d’API éventuelles passent par des variables d’environnement ; elles n’entrent ni dans un prompt ni dans une URL.

La passerelle écoute seulement sur 127.0.0.1, exige un jeton, refuse les appels web intersites et les requêtes concurrentes. Elle utilise les outils de lecture seule. Son cache d’idempotence est limité à cent requêtes et dure le temps du processus. Elle n’est pas un service public prêt à exposer sur Internet.
