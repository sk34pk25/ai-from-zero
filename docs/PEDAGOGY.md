# Réalisation de l’audit pédagogique

L’objectif est un petit GPT que l’élève construit et entraîne. Les 161 leçons conservent leurs identifiants (les quatre ajoutées, 0.21 à 0.23 et 5.10, prennent des numéros libres) ; le tronc commun recommandé suit les niveaux 0, 1, 2, 3, 4, 13. Les cases de lecture et les contrôles publics ne valent pas certification de maîtrise.

| Point de l’audit | Réalisation | Vérification |
| --- | --- | --- |
| Cours et backward incohérents | Leçons 1, 3, 4, 12 et 13 réconciliées avec le decoder standard entraînable ; variantes modernes/hybride explicitement limitées. | Exemples exécutés et gradients du laboratoire. |
| Résidu faux | Addition de tableaux, assertion de valeur et shape. | Exemple 4.8 et TP identité du bloc. |
| Export cassé et fichiers écrasés | API accepte str/Path, exemple temporaire ; sorties ordinaires dans runs/. | Exemple 13.4, rechargement et tests du projet isolé. |
| Exercices fragmentaires | 66 exercices ; dérivée, batches, attention complète, multi-têtes, normalisation et boucle réalignés. | Solutions exécutées dans pytest. |
| Absence de projet autonome | Atelier téléchargé avec eleve.py, corrigé séparé et 12 TP cumulatifs. | Exécution depuis un dossier temporaire sans import du laboratoire. |
| Projet final insuffisant | GPT entraîné, documents réservés, baselines, checkpoint et variation ; grille de relecture /20. | Contrôles techniques, rapport d’exemple et critères de remise ; explications à relire humainement. |
| Validation SFT inégale | Plans et comparateur réservent les groupes ; fichiers explicites contrôlés ; --test-final séparé. | Tests de splits, refus de recouvrement et parcours CLI complet. |
| Formulations erronées | SiLU/sigmoïde, fluctuations de loss, scan variable, formes batch et preuve de sauvegarde corrigés. | Contre-exemples numériques et assertions des exemples. |
| Mauvais liens de code | Fichier et fonction explicités pour les 161 étapes. | Résolution AST de chaque fonction/classe référencée. |
| Données, installation, progression | Guides Windows/macOS/Linux, NFC/dédoublonnage documentaire, couverture et bilans spécifiques. | Déduplication avant split, manifeste complet, critères des 14 niveaux. |

## Essai reproductible de l’atelier

La référence de `atelier/correction.py` est exécutée avec le moteur de tableaux fourni, sans modèle préfabriqué ni poids téléchargé. Sur les phrases synthétiques répétées de `atelier/demo/`, 120 pas, largeur 16, une couche, deux têtes, bloc 16 et batch 4 : 4 032 paramètres ; validation environ 2,9424 → 0,4337, contre environ 0,9640 pour le bigramme et 2,9444 pour l’uniforme sur les mêmes fenêtres. Les paramètres des différentes briques changent et les logits sont identiques après rechargement.

Le rapport complet, les empreintes et la durée de cet environnement sont dans `data/atelier_reference_run.json`. Ces phrases synthétiques servent au débogage : ce résultat ne démontre pas un transfert entre livres ni un assistant général. L’exécution de la correction valide la référence, pas l’autonomie d’un élève. Les poids et rapports historiques publiés ne sont pas réécrits.

## Contrôles

- pytest : laboratoire, 66 solutions d’exercices, 161 exemples Python du cours, fichiers/fonctions référencés et atelier isolé. L’IndexError de 0.12 est le seul échec intentionnel attendu.
- Vérificateur autonome : 12 TP, dérivées numériques, causalité, multi-têtes, résidus, gradients du decoder et AdamW sur plusieurs pas.
- Playwright Chromium : parcours complet ; Firefox et WebKit : responsive, espace personnel et nouvel atelier. Téléchargement de l’archive, guides, liens et accessibilité sont couverts.
- Lighthouse : seuil 95 ; HTML et tests JavaScript ; génération du cours, inventaire de l’atelier et version des assets cohérents.

La CI de la pull request fournit les résultats de la version exacte. Les essais sur appareils physiques, les explications sans aide et la qualité sur un corpus personnel restent des validations de terrain. La grille du projet final sert à noter ces preuves ; le site n’attribue pas automatiquement 20/20.
