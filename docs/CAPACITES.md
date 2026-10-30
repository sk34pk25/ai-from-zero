# Capacités réelles du dépôt

Référence de portée : une forme correcte, un gradient testé et une mesure linguistique sont des preuves distinctes. Les tests cités sont exécutés en CI ; leur présence ne démontre pas une efficacité universelle.

| Brique | Statut | Code et tests | Limite |
| --- | --- | --- | --- |
| GPT NumPy standard | Entraînable de bout en bout | [model/gpt_train.py](../model/gpt_train.py), [tests/test_pedagogy.py](../tests/test_pedagogy.py) | Petit modèle pédagogique ; aucun résultat à grande échelle revendiqué. |
| RoPE, RMSNorm, SwiGLU, GQA et poids partagés | Entraînables dans le GPT NumPy | [model/transformer.py](../model/transformer.py), [tests/test_modern_training.py](../tests/test_modern_training.py), [tests/test_rms_training.py](../tests/test_rms_training.py), [tests/test_modern_benchmark.py](../tests/test_modern_benchmark.py) | Gradients et petite comparaison contrôlée ; le gain dépend du corpus, des graines et du budget. |
| Dos SSM, MoE et hybride | Forwards exploratoires | [model/backbone.py](../model/backbone.py), [tests/test_lab.py](../tests/test_lab.py) | Formes et causalité testées ; pas de backward du dos hybride ni de qualité linguistique entraînée. |
| Patches et projection d’image | Entrée image implémentée | [model/multimodal.py](../model/multimodal.py), [tests/test_lab.py](../tests/test_lab.py) | Pas d’encodeur visuel complet, de reconstruction d’image ni d’entraînement multimodal commun. |
| Spectrogramme et encodeur audio | Idées décrites dans le cours | [curriculum_src/niveau-09.md](../curriculum_src/niveau-09.md) | Les illustrations ne sont pas un encodeur audio entraîné et testé. |
| Recherche de documents | Recherche lexicale implémentée | [model/memory.py](../model/memory.py), [tests/test_lab.py](../tests/test_lab.py) | Sacs de mots et cosinus ; pas d’agent autonome ni de recherche sémantique entraînée. |
