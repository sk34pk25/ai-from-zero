# Espace d'apprentissage — suivi de réalisation

Périmètre autorisé : uniquement ai-from-zero, accès propriétaire conservé.

- [x] Données : révisions atomiques, conflits, migration douce, brouillons, restauration et sauvegardes.
- [x] Apprentissage : corrigés spécifiques, indices, exercices, bilans, glossaire, prérequis, révisions.
- [x] Usage : tableau de bord, reprise, notes/favoris, séances, lecture/impression, installation et hors connexion.
- [x] Laboratoire : continuité, splits, validation SFT, reprise exacte, provenance.
- [x] Playground : chargement à la demande, comparaison, graine, tokens, métriques et historique.
- [x] Qualité : navigateurs, réseau/stockage/conflits, pages lourdes, dépendances et backend.

## Vérifications et limites

- Les corrigés Python des 66 exercices sont exécutés en CI. Les 161 corrections textuelles sont rédigées pour les exercices ; elles ne constituent pas une certification pédagogique externe.
- Les tests de reprise exacte comparent tous les poids après sauvegarde/rechargement. Les anciens checkpoints et rapports publiés sont conservés.
- Le backend versionné est déployé : vérifications propriétaire, autre utilisateur et absence de droits anonymes réalisées par transactions annulées.
- La matrice CI vérifie Chromium, Firefox et WebKit. Un véritable iPhone/iPad ou appareil Android n'est pas accessible à cet environnement ; cette vérification physique reste manuelle.
- Le mode hors connexion concerne la lecture et les modèles téléchargés volontairement. Le moteur Python et une session expirée peuvent nécessiter une connexion.
- Le seul avertissement de l'advisor Supabase est la protection contre les mots de passe compromis désactivée. L'outil connecté n'expose pas ce réglage ; lien de configuration dans le README.

## Correction de l’audit pédagogique

- [x] Exemples de résidu, export, SiLU, loss stochastique, formes et sauvegarde corrigés.
- [x] Explications du backward complet réconciliées avec le code ; références par leçon avec fonction précise.
- [x] Tronc commun de 86 leçons : fondations 0–4, données 13.3 et neuf étapes de méthode du niveau 12 ; atelier indépendant et corrigé séparé.
- [x] Douze TP cumulatifs et projet final entraîné, avec variation et grille d’explications.
- [x] Exercices réalignés, nouveaux cas numériques et quatre critères propres à chaque niveau.
- [x] Séparation documentaire, dédoublonnage exact, couverture et provenance.
- [x] Plans SFT avec validation réservée ; test final explicite ; diagnostics de rejet/troncature.
- [x] Vérification automatique des 161 exemples et du projet téléchargé hors dépôt.

Les contrôles vérifient l’outillage et des propriétés. La réussite d’un élève, son autonomie et la qualité d’un modèle sur de nouvelles tâches demandent encore une réalisation et une relecture de son projet.

## Audit du 29 octobre 2026

- [x] Niveau 0 : classes et objets (0.21), assert et pytest (0.22), mini-projet de synthèse (0.23), avec exercices exécutables.
- [x] Test de positionnement à douze questions ; les étapes liées aux erreurs ne sont jamais marquées.
- [x] Mode apprenant local, sur demande explicite : progression, quiz et exercices dans le navigateur, export/import au format de Mon espace, effacement.
- [x] RoPE, SwiGLU, GQA/MQA et poids partagés entraînables ; gradients vérifiés par différences finies et contre PyTorch ; leçon 5.10 de comparaison sur plusieurs graines.
- [x] Backward itératif, sans limite de profondeur.
- [x] Content-Security-Policy générée avec les empreintes des scripts inline ; actions CI à jour.
- [x] Exemples chiffrés dans les TP 3, 6, 7, 8, 10, 11 et 12 de l'atelier, et dans les leçons 1.13 et 3.6.
- [ ] Observation humaine : faire suivre les niveaux 0 à 2 à un débutant, noter où il bloque (docs/DEVICE_CHECKLIST.md pour les appareils).

## Compréhension vérifiable

- [x] Résultats liés à l’empreinte du code et à la version du contrôle, avec historique de tentatives.
- [x] Cas supplémentaires dans les 66 exercices et distracteurs rédigés dans les 161 quiz.
- [x] Portée réelle du code explicitée dans CAPACITES.md.
- [x] Bilans, notes et favoris utilisables sans compte.
- [x] Cinq paliers de reconstruction, diagnostic et explication, chacun en deux variantes.
- [x] Chronologie, aides, relecture humaine distincte et export/import de preuves.
- [x] Protocole de terrain et synthèse des observations consenties.
- [ ] Pilote avec de vrais débutants, correction des blocages puis second groupe et essai de rétention. Aucun résultat humain n’est revendiqué à ce stade.

## Après le modèle : construire le harness

- [x] 32 leçons originales, huit modules, laboratoires inspectables, exercices Python, quiz et cas nouveaux.
- [x] Projet autonome : 22 fonctions élève, référence séparée, huit TP, dix scénarios de régression, CLI et guides.
- [x] Outils limités, confirmation de création, budgets, contexte, mémoire, traces et reprise sans rejeu automatique d’un effet incertain.
- [x] Adaptateurs du checkpoint NumPy et de l’API du premier atelier ; sondes et ajustement masqué avec validation réservée.
- [x] Procédures documentaires, délégation synchrone, file locale explicite et passerelle HTTP authentifiée sur boucle locale.
- [x] Suivi indépendant du modèle, notes, code, versions de contrôles, explications et export/import.
- [ ] Connecteurs de messagerie, backends distants, isolation système et exploitation de production : extensions à construire et éprouver.
- [ ] Observer un débutant reconstruire, diagnostiquer et expliquer son propre harness ; aucune capacité humaine ni autonomie neuronale n’est déduite des fixtures.
