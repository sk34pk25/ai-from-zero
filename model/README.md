# Laboratoire `model/`

Le même petit laboratoire avance avec le parcours. Il est en NumPy, sans PyTorch, pour que les tests restent légers. Les leçons montrent l'équivalent en idées (et, au niveau 1, le vocabulaire PyTorch) ; les nombres de référence sont ceux de ce paquet.

Lancer la démo, depuis la racine du dépôt :

```bash
python3 -m model
```

Lancer les tests :

```bash
python3 -m pytest
```

## Carte des modules

| Module | Rôle | Étapes |
| --- | --- | --- |
| `mathutil.py` | softmax, entropie croisée et sa dérivée, SiLU, GELU, normes | 0–1, 5 |
| `autograd.py` | tenseur, opérations, rétropropagation réelle | 1 |
| `tiny_lm.py` | petit modèle entraîné, attention optionnelle, échantillon | 1, 3, 4 |
| `stats.py` | lire une colonne, résumer, écrire un rapport | 0 |
| `mlp.py`, `train.py` | neurone, régression, tête linéaire entraînée par descente | 1 |
| `tokenizer.py` | tokenizer caractère, mini-BPE, visualiseur | 2 |
| `bigram.py` | bigramme lissé, perplexité, échantillonnage | 3 |
| `attention.py` | attention causale, RoPE | 4–5 |
| `transformer.py` | TinyGPT : pré-norme, résidus, options modernes, cache KV | 4–5 |
| `bench.py` | octets, FLOPs, tableau qualité / temps / RAM | 6 |
| `moe.py` | experts, routeur top-k, capacité, perte d'équilibre | 7 |
| `ssm.py` | scan sélectif et scan affine parallèle | 8 |
| `backbone.py` | dos interchangeable : transformer, ssm, hybrid | 8 et 12 |
| `multimodal.py` | patches et projection linéaire | 9 |
| `memory.py` | sac de mots, retrieval, contexte désactivable | 10 |
| `experiment.py` | ablation, découpage, bigramme contre l'uniforme | 11–12 |

## Ce que le laboratoire ne prétend pas faire

- L'attention entraînable est celle de `tiny_lm.py` (une tête, masque causal, rétropropagation réelle). TinyGPT dans `transformer.py` reste un forward de référence : il n'est pas entraîné de bout en bout.
- Le dos `ssm` est un scan sélectif réduit, pas un bloc Mamba (pas de convolution courte, pas de kernel CUDA).
- L'image s'arrête au découpage en patches. Il n'y a pas d'encodeur audio, ni de décodeur d'image.
- La mémoire est un sac de mots, pas un embedding entraîné.
- Aucun score d'article n'est recopié ici.
