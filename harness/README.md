# Mon harness d’agent

La suite du modèle construit dans AI From Zero. Python 3.12 ou plus récent. Le cœur utilise la bibliothèque standard ; NumPy est nécessaire pour ton checkpoint et son entraînement. Aucun framework d’agent n’est requis.

Le projet est fourni avec **eleve.py à compléter** et **correction.py de référence**. Les scénarios scriptés contrôlent le moteur ; ils ne prouvent pas l’autonomie d’un modèle neuronal. Le cours contient huit modules et 32 leçons à l’adresse https://sk34pk25.github.io/ai-from-zero/#/harness.

## Décompresser et commencer

Ouvrir un terminal dans `mon-agent`, le dossier qui contient le sous-dossier `harness`. Sur Windows, `py` peut remplacer `python` ; sur Linux/macOS, utiliser `python3` si nécessaire.

```sh
python --version
python -m harness.verifier --tp 1
```

Le premier contrôle doit échouer tant que les fonctions du TP ne sont pas écrites. Lire GUIDE.md. Pour comparer la référence :

```sh
python -m harness.verifier --module correction
python -m harness.evaluer --module correction
python -m harness.cli --module correction --demo calcul
```

Le banc déterministe comporte dix scénarios : calculs nouveaux, JSON invalide, refus de chemin, refus de commande, écriture sans accord, rejeu, identifiant contradictoire, injection documentaire et budget. Le rapport indique `autonomy_measured: false`.

Après les huit TP, exécuter ton module :

```sh
python -m harness.verifier --module eleve --out mes-controles.json
python -m harness.evaluer --module eleve --out mon-banc.json
python -m harness.cli --module eleve --demo calcul --out ma-trace.json
```

Les sorties créent de nouveaux fichiers ; choisir un autre nom si le fichier existe déjà. Importer `mes-controles.json` dans la page du parcours pour le conserver avec le dossier. Un rapport importé reste une déclaration.

## Répertoires

- `workspace/` : seuls fichiers accessibles aux outils. Choisir un dossier dédié, sans secrets.
- `donnees/sessions.sqlite` : état et journal, hors du workspace.
- `harness/competences/` : procédures documentaires versionnées.

La création est désactivée dans la CLI par défaut. Pour une proposition avec confirmation par action :

```sh
python -m harness.cli --module correction --demo ecriture --allow-write --session essai-ecriture
python -m harness.cli --module correction --demo ecriture --allow-write --session essai-ecriture --resume
```

Ne jamais présenter une fixture comme une décision d’un LLM. Brancher ton modèle avec MODELE.md ; lire PERMISSIONS.md avant d’étendre les outils. PROJET_FINAL.md donne les livrables et la grille de relecture.

Code original sous licence MIT (LICENSE). Documentation pédagogique du parcours sous CC BY-SA 4.0, comme le site. Hermes Agent sert de référence d’architecture ; ce projet n’utilise ni son code ni ses marques comme promesse d’équivalence de production.
