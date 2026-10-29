# Espace d'apprentissage — suivi de réalisation

Périmètre autorisé : uniquement ai-from-zero, accès propriétaire conservé.

- [x] Données : révisions atomiques, conflits, migration douce, brouillons, restauration et sauvegardes.
- [x] Apprentissage : corrigés spécifiques, indices, exercices, bilans, glossaire, prérequis, révisions.
- [x] Usage : tableau de bord, reprise, notes/favoris, séances, lecture/impression, installation et hors connexion.
- [x] Laboratoire : continuité, splits, validation SFT, reprise exacte, provenance.
- [x] Playground : chargement à la demande, comparaison, graine, tokens, métriques et historique.
- [x] Qualité : navigateurs, réseau/stockage/conflits, pages lourdes, dépendances et backend.

## Vérifications et limites

- Les corrigés Python des 52 exercices sont exécutés en CI. Les 157 corrections textuelles sont rédigées pour les exercices ; elles ne constituent pas une certification pédagogique externe.
- Les tests de reprise exacte comparent tous les poids après sauvegarde/rechargement. Les anciens checkpoints et rapports publiés sont conservés.
- Le backend versionné est déployé : vérifications propriétaire, autre utilisateur et absence de droits anonymes réalisées par transactions annulées.
- La matrice CI vérifie Chromium, Firefox et WebKit. Un véritable iPhone/iPad ou appareil Android n'est pas accessible à cet environnement ; cette vérification physique reste manuelle.
- Le mode hors connexion concerne la lecture et les modèles téléchargés volontairement. Le moteur Python et une session expirée peuvent nécessiter une connexion.
- Le seul avertissement de l'advisor Supabase est la protection contre les mots de passe compromis désactivée. L'outil connecté n'expose pas ce réglage ; lien de configuration dans le README.

## Correction de l’audit pédagogique

- [x] Exemples de résidu, export, SiLU, loss stochastique, formes et sauvegarde corrigés.
- [x] Explications du backward complet réconciliées avec le code ; références par leçon avec fonction précise.
- [x] Tronc commun 0–4 puis 13, atelier indépendant et corrigé séparé.
- [x] Douze TP cumulatifs et projet final entraîné, avec variation et grille d’explications.
- [x] Exercices réalignés, nouveaux cas numériques et quatre critères propres à chaque niveau.
- [x] Séparation documentaire, dédoublonnage exact, couverture et provenance.
- [x] Plans SFT avec validation réservée ; test final explicite ; diagnostics de rejet/troncature.
- [x] Vérification automatique des 152 exemples et du projet téléchargé hors dépôt.

Les contrôles vérifient l’outillage et des propriétés. La réussite d’un élève, son autonomie et la qualité d’un modèle sur de nouvelles tâches demandent encore une réalisation et une relecture de son projet.
