# Apprendre par les calculs visibles

Les laboratoires des leçons montrent des exemples miniatures calculés en JavaScript. Ils ne téléchargent aucun modèle supplémentaire et ne nécessitent pas de compte. L’explication complète et les exercices Python restent la référence pour construire ton propre LLM.

## Une lecture en quatre gestes

1. Regarde les formes et les valeurs du schéma.
2. Avance avec **Étape suivante**, recule ou rejoue. La ligne NumPy active suit l’étape. Les curseurs recalculent les valeurs affichées.
3. Ouvre **À toi de prédire** lorsqu’une question est proposée. Une réponse erronée explique l’opération à revoir.
4. Retrouve la fonction du dépôt avec **Code de référence**, puis réalise l’exercice Python du cours.

Sur mobile et tablette, **Calcul et schéma** et **Code de l’étape** partagent le même état. Sur grand écran, ces deux vues apparaissent côte à côte. Les tableaux peuvent défiler individuellement ; leurs valeurs et leurs intitulés restent disponibles sans distinguer les couleurs. Aucune lecture automatique n’est imposée.

## Ce qui a changé

| Sujet | Inspection proposée | Étapes utiles |
| --- | --- | --- |
| Premiers programmes | Boîtes de valeurs, alias de listes, branches, index de boucle, appel et retour | 0.6–0.10, 0.12, 0.21–0.23 |
| Vecteurs, matrices, tenseurs | Plan 2D, ligne × colonne, produits et somme, sélection au clavier, tranche de batch | 0.15, 0.17–0.18, 2.9–2.11 |
| Forward et backward | Graphe numérique, dérivées locales, remontée du gradient | 1.5, 1.7–1.8, 1.10–1.12 |
| Fiabilité des calculs | Convention ReLU en zéro, divergence visible, axes ajustés | 1.6, 1.13–1.14 |
| Texte et BPE | Unicode, octets, vocabulaire fixe, fréquences, rangs et reconstruction | 2.1, 2.3–2.8, 13.1–13.2 |
| Probabilités et génération | Cross-entropy, perplexité, température, top-k et intervalles de tirage | 1.9, 3.6–3.10 |
| Attention | Q/K/V, scores, masque, probabilités et mélange des valeurs | 4.1–4.7 |
| Bloc Transformer | Résidu, normalisation, FFN et trajet de formes | 4.8–4.14 |
| Variantes modernes | RoPE, RMSNorm, portes, têtes groupées, cache KV, poids partagés, initialisation | 5.1–5.10 |
| Ressources | Octets des poids et états, coût en T², accumulation, recalcul, quantification | 6.1–6.3, 6.5–6.9 |
| MoE et SSM | Routage, top-k, capacité, rejet, auxiliaire, mémoire et composition affine | 7.1–7.9, 8.1–8.9 |
| Multimodal | Patch extrait, projection, représentation temps/fréquence, fusion | 9.1–9.9 |
| Mémoire et conception | Similarité cosinus, contexte injecté, profondeur, contrat de forme, contre-exemples de comparaison | 10.1–12.12 |
| Ajustement | Cibles du masque SFT, dénominateur de la perte, matrices LoRA gelées et entraînées | 13.5–13.7 |

140 des 161 leçons utilisent ces laboratoires. Ce nombre inclut le réemploi d’un même mécanisme pertinent entre plusieurs leçons ; il ne signifie pas 140 simulations distinctes. Les autres leçons gardent les résumés en trois gestes ou les widgets déjà présents. Les idées de recherche restent des pistes documentées, pas des résultats reproduits.

## Distinguer illustration et mesure

- Les coordonnées des embeddings de démonstration, les scores miniatures et les protocoles fictifs sont indiqués comme tels.
- Les courbes publiées sur **Construire ton LLM** lisent toujours le rapport archivé. Les axes indiquent les pas et les nats/token. Le bleu continu représente le train ; le vert en tirets représente la validation. Un curseur et un tableau permettent de lire les valeurs sans estimer un point sur le dessin.
- Le trajet de **Mon modèle** est une miniature simplifiée : il n’exécute pas le TinyGPT complet et ne transforme pas une étape cochée en preuve d’entraînement.
- Une récurrence scalaire n’est pas Mamba complet ; une DFT miniature n’est pas un encodeur audio entraîné ; un sac de mots n’est pas une recherche sémantique moderne.

## Vérification

`tests/js/visual-math.test.js` lance `tests/visual_reference.py` et compare les résultats à l’attention, à l’autograd, aux normalisations, à RoPE, au MoE, aux scans et à LoRA du dépôt. Un contrôle par différences finies vérifie aussi le gradient hors du coude ReLU.

`tests/e2e/visual-learning.spec.js` contrôle les calculs affichés, les réponses de prédiction, la sélection au clavier, les fusions successives, le routage et ses rejets, les modalités, les axes et les formats 320, 390, 768 et 1440 pixels, dans les thèmes clair et sombre. Cette suite est incluse dans la CI Chromium, Firefox et WebKit. L’ouverture des 161 leçons et les scénarios de chargement résilient restent contrôlés.

Les tests automatisés ne remplacent pas une observation de débutants ni un essai sur chaque appareil physique. Pour juger la pédagogie, faire réaliser trois tâches sans assistance — une cellule matricielle, un masque causal et un gradient — puis vérifier que l’apprenant peut réécrire et expliquer le code correspondant. Le projet ne s’attribue pas un 20/20 sur la seule base des tests.
