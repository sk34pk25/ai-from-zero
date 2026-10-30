# Qualité et vérifications du projet

État du 30 octobre 2026. Le cours comporte 161 leçons, 14 niveaux, 66 exercices exécutables et 12 TP autonomes. Les résultats d’exécution font foi dans la CI du commit examiné ; aucun compteur du site ne certifie la maîtrise d’un apprenant.

## Corrections de l’audit à 18,5/20

| Constat | Changement | Contrôle de non-régression |
| --- | --- | --- |
| Perte auxiliaire MoE présentée avec un minimum universel 1 | 1 devient une référence uniforme ; le contre-exemple 0,8956 est expliqué dans la leçon 7.7, son code et son quiz. | Calcul numérique avec probabilités valides et routage argmax. |
| Première navigation lente sans annonce du titre | L’intention de focus est conservée pendant le chargement, sans interrompre une nouvelle saisie. | Réponses retardées, navigation clavier et recherche active. |
| Panne du résumé bloquant tout le cours | Curriculum et résumés se chargent indépendamment, avec reprise séparée et délai maximal. | Résumé absent, lent ou mal formé ; nouvelle tentative du curriculum. |
| Explications fondamentales présentées comme facultatives | Cours guidé ouvert par défaut avant code/quiz ; révision visuelle choisie explicitement. | Les 161 routes, ordre des blocs, préférence et brouillon conservés. |
| Code défilant inaccessible au clavier sur mobile | Zone de code nommée et focalisable. | Analyse axe à 360 pixels, y compris sans résumé. |
| Ancien cache après publication | Données du cours, catalogue et fichiers de l’atelier portent la version des scripts. | Sous-chemin GitHub Pages et invalidation d’une ancienne version. |
| Remise finale difficile à organiser | DOSSIER_MODELE.md dans l’interface, les guides et le ZIP autonome. | Ouverture, contenu et inventaire de l’archive. |
| Privilèges SQL superflus | CRUD explicite sous RLS ; aucun grant visiteur ; défauts du créateur fermés pour les futures tables. | PostgreSQL jetable : installation, anciens grants, idempotence, propriétaire, autre identité, anonyme et conflits RPC. |

La reprise d’un résumé ne recrée ni les réponses au quiz, ni le code en cours, ni un schéma interactif manipulé. Le mode de lecture fonctionne aussi lorsque le navigateur refuse le stockage ; sa préférence n’est écrite qu’après un choix explicite.

## Laboratoire et atelier

Les tests Python couvrent les exemples, les solutions, l’autograd, les variantes entraînables, les splits, la provenance, les sorties atomiques et l’atelier isolé. La suite comporte 176 tests exécutables sans PyTorch et quatre comparaisons supplémentaires dans le job PyTorch dédié. La suite JavaScript comporte 55 contrôles.

L’atelier permet de reconstruire un petit GPT, puis de produire contrôles, entraînement, validation, baselines et checkpoint. Le dossier final demande un nouveau corpus documenté, une variation contrôlée, une sélection sur validation et un test réservé. La réussite de correction.py ne démontre pas l’autonomie d’un élève.

Le commentaire de gpt_train.py décrit désormais correctement RoPE, RMSNorm, SwiGLU, GQA et les poids partagés comme entraînables. Les rapports historiques et leurs archives restent rattachés aux sources hashées de leur exécution ; ils ne sont pas réécrits après un changement documentaire.

## Navigation, appareils et performance

La CI exécute le parcours Chromium complet et un ensemble ciblé sous Firefox et WebKit, comprenant les nouvelles régressions de chargement. Une suite distincte charge le vrai Pyodide/NumPy sur les trois navigateurs : reprise réseau, calcul, erreur, entraînement, génération, arrêt et redémarrage. Aucun résultat du moteur n’est simulé dans cette suite dédiée.

Lighthouse garde son seuil bloquant de 95 sur accueil, playground, IDE, atelier et positionnement, en profils bureau et mobile. La mesure précédente du commit 0955e61 donnait 100 partout au bureau et 98 à 100 en performance mobile ; consulter la CI du nouveau commit pour ses propres mesures.

Les scénarios responsives couvrent 320, 390, 768, 1024, 1280 et 1920 pixels, ainsi que le paysage. WebKit automatisé ne constitue pas un essai sur iPhone ou iPad physique. DEVICE_CHECKLIST.md et atelier/RELECTURE.md gardent les résultats de terrain à remplir après de vrais essais.

## Sécurité et limites connues

Le script supabase/hardening.sql répare un projet installé sans remplacer les politiques, les données ou l’UUID propriétaire. Les droits backend sont préservés. Les défauts corrigés appartiennent au créateur courant, postgres dans le SQL Editor ; ceux du rôle interne supabase_admin ne sont pas modifiés. La recette SQL de CI est réservée à une base jetable.

L’organisation Supabase liée utilise Free. La protection intégrée contre les mots de passe compromis demande Pro ou plus ; elle reste documentée dans SUPABASE_SETUP.md sans changement d’abonnement. Les contrôles techniques ne garantissent ni l’absence de toute vulnérabilité ni la compatibilité de tous les appareils.

L’objectif est un petit modèle personnel entraînable. Un assistant général fiable demanderait des données, du calcul et une évaluation supplémentaires. Une relecture avec un débutant doit examiner le raisonnement et la reconstruction sur un cas nouveau avant d’attribuer une note de maîtrise.
