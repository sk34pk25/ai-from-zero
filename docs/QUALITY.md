# Vérifications de la nouvelle version pédagogique

Date : 29 octobre 2026. Les commits et runs CI du dépôt identifient précisément les versions contrôlées. Ce document décrit des preuves techniques, sans attribuer automatiquement une note à l’apprenant.

## Les cinq constats de l’audit

| Constat | Réalisation | Preuve de non-régression |
| --- | --- | --- |
| Mathématiques erronées acceptées | Valeurs indépendantes de loss, attention et têtes, gradients et branches partagées. | Sept mutations refusées, référence acceptée. |
| Train accepté comme test final | Empreintes normalisées, provenance des documents, code et moteur liés au checkpoint. | Copie renommée/normalisée refusée ; documents réservés acceptés. Les fichiers sans provenance documentaire ne sont pas certifiés indépendants. |
| Fichiers écrasés | Rapports JSON neufs, collisions refusées et écritures atomiques. | Sources, checkpoint et rapport existant conservés après les commandes invalides. |
| Tronc commun seulement informatif | Choix du parcours, reprise, voisins et séances alignés, liens conservés. | 4.14 → 13.1 par défaut ; 4.14 → 5.1 en ordre numérique ; 157 étapes conservées. |
| Test contaminé entre phases SFT | Groupes canoniques avec normalisation NFC, historique réservé dans les checkpoints et contrôle entre phases. | Réordonnancement stable ; recouvrement connu refusé avant mise à jour ; sauvegarde/reprise conserve l’historique. |

## Contenu et pratique

Les 157 étapes et 63 exercices restent disponibles. Les contrôles exécutent maintenant 156 exemples Python. Quatre exemples supplémentaires couvrent objets partagés, dérivées matricielles, embeddings répétés et accumulation de gradients. Dix lectures primaires accompagnées relient les équations aux fonctions et aux limites du laboratoire.

L’atelier fournit fondations Python/mathématiques, huit pannes avec indices, TP individuels ou cumulatifs, projet final et prolongements exécutables : BPE octets avec tokens spéciaux, port PyTorch, RMSNorm entraînable dans le laboratoire, génération et API locale du modèle personnel. Les primitives BPE et fichiers ont une source canonique et des copies autonomes générées ; la conformité des opérations autograd communes est testée.

Mon espace conserve les contrôles déclarés dans preferences.project, séparément de la lecture et de l’historique des générations. L’import est validé ; un fichier importé reste une déclaration, pas une attestation d’exécution ou de compréhension. Les tests couvrent rechargement, export et conservation des données existantes. Le schéma JSONB et les protections existantes de learning_records ont été vérifiés par métadonnées en lecture seule, sans nouvelle migration ni accès aux notes.

## Expérience française publiée

Douze textes originaux MIT, huit train/deux validation/deux test ; deux largeurs et trois graines ; 240 pas, fenêtre 32, batch 4. Le choix se fait sur validation et les tests ne sont mesurés que pour la largeur retenue.

| Mesure | Résultat |
| --- | ---: |
| Largeur retenue | 16 |
| Paramètres du modèle retenu | 5 376 |
| Loss validation moyenne, largeur 16 | 2,4152 |
| Loss validation moyenne, largeur 24 | 2,4342 |
| Loss test moyenne du modèle retenu | 2,3921 |
| Écart-type test sur trois graines | 0,0082 |
| Loss test bigramme | 2,4514 |
| Loss test uniforme | 3,9703 |

Les losses sont en nats par caractère, avec le même tokenizer et les mêmes cibles par comparaison. Le corpus et le nombre de graines sont petits ; ce résultat ne démontre pas un assistant fiable. Le rapport conserve les six runs et leurs échantillons, la sélection, les empreintes et les mesures. Les anciens poids du playground restent historiques.

Le diagnostic de questions par familles distingue loss masquée, exact-match lexical, répétitions et saut de ligne. Les sorties et abstentions demandent une relecture ; l’absence de recouvrement lexical connu ne prouve pas l’absence de contamination du pré-entraînement.

## Vérification locale et CI

La validation locale a couvert 141 tests Python, dont la parité PyTorch de tous les gradients ; 32 tests JavaScript ; validation HTML ; parcours Atelier, responsive, notes et sauvegardes. La matrice CI ajoute les scénarios du dépôt sous Chromium et les scénarios ciblés sous Firefox et WebKit, avec un job PyTorch distinct.

Lighthouse local, sur accueil/Atelier/playground/IDE : bureau 100 dans les quatre catégories ; mobile performance 96/96/96/95, accessibilité/bonnes pratiques/SEO 100. Un double rendu au démarrage a été supprimé et les nouvelles dépendances partagées sont préchargées. Le seuil CI de 95 reste inchangé. Ces mesures dépendent du navigateur et de la machine ; elles ne remplacent pas un essai sur matériel réel.

Le workflow manuel de publication archive données, sources et checkpoints avec SHA256SUMS dans une Release, sans ajouter les futurs poids à l’historique Git. Son empaquetage a été exécuté localement ; le lancement du workflow reste une action manuelle.

## Ce qui demande encore une observation humaine

Réaliser les essais de docs/DEVICE_CHECKLIST.md sur de vrais appareils. Faire suivre le parcours à un débutant et relire son code, son raisonnement et son projet final avec la grille /20. Aucun compteur ni succès de tests publics ne peut remplacer ces observations.

## Version suivante (audit du 29 octobre 2026, après-midi)

| Constat | Réalisation | Preuve |
| --- | --- | --- |
| Rampe Python trop courte, classes jamais enseignées | Étapes 0.21 (classes), 0.22 (assert, pytest), 0.23 (mini-projet), chacune avec exercice exécutable et corrigé. | Exemples et corrigés exécutés par pytest ; réponses des 157 quiz existants inchangées. |
| Variantes modernes seulement en forward | RoPE, SwiGLU, GQA/MQA et poids partagés entraînables ; options CLI et plans. | Forward autograd = forward NumPy, chaque gradient = différence finie, et parité PyTorch en CI. |
| Backward récursif | Parcours topologique itératif dans model/ et atelier/. | Graphe trois fois plus profond que la limite de récursion ; rapport de l'atelier identique au bit près. |
| Rien n'est gardé pour un visiteur | Mode local sur demande explicite, export/import au format de Mon espace, effacement ciblé. | Tests unitaires du stockage ; e2e : aucune clé avant l'accord, aucune requête Supabase. |
| « J'ai déjà les bases » marquait tout sans vérifier | Test de positionnement à douze questions ; les étapes liées aux erreurs restent à faire. | Tests unitaires du score ; e2e avec une erreur volontaire. |
| Pas de CSP | Content-Security-Policy générée avec les empreintes des scripts inline. | Test : la politique publiée égale la politique recalculée. |

Total : 161 étapes, 66 exercices exécutables, 161 exemples Python vérifiés. L'observation d'un vrai débutant reste à faire.
