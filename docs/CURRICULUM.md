# AI From Zero — parcours maître

## Contrat pédagogique
Point de départ : aucune connaissance informatique supposée. Une notion n'est autorisée que lorsque ses prérequis ont été expliqués et pratiqués. Chaque chapitre suit : **intuition → vocabulaire → schéma → théorie → code → expérience → exercice → quiz → checkpoint**.

## 0 — Fondations numériques
0.1 Ordinateur, matériel, CPU, RAM, stockage · 0.2 OS, applications et fichiers · 0.3 terminal et commandes · 0.4 installer Python · 0.5 premier programme · 0.6 variables et types · 0.7 conditions · 0.8 boucles · 0.9 fonctions · 0.10 listes/dictionnaires · 0.11 modules · 0.12 erreurs et débogage · 0.13 Git/GitHub · 0.14 environnement virtuel · 0.15 NumPy · 0.16 nombres et fonctions · 0.17 vecteurs · 0.18 matrices · 0.19 probabilités · 0.20 dérivée intuitive.

**Projet :** mini-programme Python qui lit des données, calcule des statistiques et sauvegarde un résultat.

## 1 — Machine Learning depuis zéro
1.1 Qu'est-ce qu'apprendre ? · 1.2 données/labels/features · 1.3 train/validation/test · 1.4 paramètre · 1.5 neurone · 1.6 activation · 1.7 réseau · 1.8 forward pass · 1.9 loss · 1.10 gradient · 1.11 règle de chaîne · 1.12 backpropagation · 1.13 gradient descent · 1.14 optimiseur · 1.15 PyTorch tenseurs/autograd · 1.16 boucle d'entraînement · 1.17 overfitting.

**Projet :** réseau de neurones écrit avec les briques PyTorch de base.

## 2 — Transformer du langage en nombres
2.1 texte/Unicode · 2.2 corpus · 2.3 caractères et octets · 2.4 vocabulaire · 2.5 tokenizer caractère · 2.6 BPE intuition · 2.7 construire un mini-BPE · 2.8 IDs de tokens · 2.9 embeddings · 2.10 position · 2.11 batches et séquences.

**Projet :** tokenizer personnel + visualiseur de tokens.

## 3 — Premier modèle de langage
3.1 prédire le prochain élément · 3.2 bigramme · 3.3 contexte · 3.4 logits · 3.5 softmax · 3.6 cross-entropy · 3.7 sampling/température/top-k · 3.8 entraînement · 3.9 génération · 3.10 évaluation/perplexité · 3.11 sauvegarder/recharger.

**Projet :** premier modèle génératif entraînable de bout en bout.

## 4 — Transformer construit à la main
4.1 limite du contexte naïf · 4.2 requête/clé/valeur · 4.3 produit scalaire · 4.4 self-attention · 4.5 masque causal · 4.6 scaled attention · 4.7 multi-head · 4.8 résiduels · 4.9 normalisation · 4.10 FFN · 4.11 bloc Transformer · 4.12 empiler les blocs · 4.13 modèle decoder-only · 4.14 entraînement et génération.

**Projet :** mini-GPT sans module Transformer préfabriqué.

## 5 — Transformer moderne
5.1 limites positions absolues · 5.2 RoPE · 5.3 RMSNorm · 5.4 GELU vs SwiGLU · 5.5 MHA/MQA/GQA · 5.6 KV cache · 5.7 weight tying · 5.8 initialisation · 5.9 contexte long.

**Projet :** moderniser le mini-GPT composant par composant et mesurer chaque changement.

## 6 — Efficacité et machines modestes
6.1 coût paramètres · 6.2 RAM/VRAM · 6.3 FLOPs · 6.4 profiler · 6.5 batching · 6.6 mixed precision · 6.7 gradient accumulation · 6.8 checkpointing · 6.9 quantification · 6.10 distillation · 6.11 CPU/GPU · 6.12 inférence locale.

**Projet :** tableau qualité/vitesse/RAM de plusieurs configurations.

## 7 — Mixture of Experts
7.1 expert · 7.2 dense vs sparse · 7.3 router · 7.4 top-k · 7.5 capacité · 7.6 load balancing · 7.7 auxiliary loss · 7.8 expert parallelism · 7.9 compromis mémoire/calcul.

**Projet :** remplacer le FFN par un mini-MoE configurable.

## 8 — State Space Models et Mamba
8.1 récurrence · 8.2 état caché · 8.3 SSM intuition · 8.4 convolution/récurrence · 8.5 scan · 8.6 sélectivité · 8.7 Mamba · 8.8 attention vs SSM · 8.9 architecture hybride.

**Projet :** backbone interchangeable Transformer / SSM / hybride.

## 9 — Multimodal
9.1 modalités · 9.2 pixels/patches · 9.3 encodeur vision · 9.4 spectrogramme/audio · 9.5 encodeur audio · 9.6 vidéo = espace+temps · 9.7 projection vers espace commun · 9.8 fusion · 9.9 sorties multimodales.

**Projet :** ajouter une seconde modalité au laboratoire.

## 10 — Mémoire, retrieval et calcul adaptatif
10.1 contexte vs mémoire · 10.2 embeddings de recherche · 10.3 retrieval · 10.4 mémoire externe · 10.5 récurrence de raisonnement · 10.6 profondeur adaptative · 10.7 outils/agents · 10.8 évaluer le raisonnement.

**Projet :** mémoire externe mesurable et désactivable.

## 11 — Frontière de la recherche
11.1 lire un papier · 11.2 reproduire une expérience · 11.3 LCM/concepts · 11.4 CTM/calcul temporel · 11.5 latent reasoning · 11.6 alternatives à l'attention · 11.7 multimodal natif · 11.8 limites et résultats non reproduits.

**Projet :** reproduction simplifiée d'une idée de recherche avec baseline.

## 12 — Concevoir ton architecture
12.1 formuler une hypothèse · 12.2 baseline · 12.3 ablation · 12.4 métriques · 12.5 benchmark · 12.6 qualité/latence/RAM/énergie · 12.7 modularité · 12.8 architecture candidate · 12.9 entraînement · 12.10 analyse des échecs · 12.11 itération · 12.12 documentation.

**Projet final :** architecture personnelle justifiée par des expériences reproductibles.

## Critères de sortie
Le parcours est réussi seulement si l'apprenant peut expliquer une brique sans jargon, l'implémenter, écrire un test, l'entraîner si nécessaire, mesurer son coût, la remplacer, comparer le résultat à une baseline et expliquer le compromis obtenu.
