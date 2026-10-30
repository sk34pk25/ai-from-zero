# Atelier LLM personnel

Commence par [INSTALLATION.md](INSTALLATION.md), puis [GUIDE.md](GUIDE.md).

- `eleve.py` : tes composants à écrire ; les contrôles échouent tant qu'ils manquent.
- `correction.py` : référence séparée ; son exécution vérifie l'outillage, pas ton autonomie.
- `moteur.py` : primitives de tableaux NumPy et leurs gradients, lisibles et réutilisables ; aucun forward GPT fourni ici.
- `commun.py` : initialisation des paramètres, sérialisation et provenance.
- `verifier.py` : douze groupes de contrôles publics cumulables avec `--jusqua N`.
- `entrainer.py` : entraînement qui appelle ton module, validation, baselines et rechargement.
- `preparer.py` : séparation documentaire après normalisation et dédoublonnage exact.
- `evaluer.py` : mesure finale sur le test réservé après choix.
- `demo/` : phrases synthétiques répétées pour le débogage, pas preuve de généralisation à des livres.
- [PROJET_FINAL.md](PROJET_FINAL.md) : remise et grille de relecture /20.
- [DOSSIER_MODELE.md](DOSSIER_MODELE.md) : dossier à remplir sur un nouveau corpus avec preuves et test réservé.

Le code et les textes synthétiques de cet atelier sont sous la licence MIT incluse. Le contenu pédagogique du cours hors atelier reste sous sa licence annoncée dans le dépôt. Les fichiers de cet atelier fonctionnent seuls avec NumPy ; ils ne chargent ni poids préentraînés ni API.
