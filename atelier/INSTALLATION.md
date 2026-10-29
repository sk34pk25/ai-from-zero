# Installer ton atelier

Le cours se lit sur mobile et tablette. Pour écrire les fichiers et mener un projet complet, utilise un ordinateur avec un terminal, Python 3.12 et un éditeur de texte. Aucun modèle préentraîné, compte cloud ni GPU n'est requis pour les TP NumPy. L'exécution Python intégrée au site requiert une connexion au premier chargement ; elle ne remplace pas ce projet local.

1. Télécharge l'atelier depuis le site et décompresse-le dans un dossier personnel, par exemple `mon-llm`. Ouvre un terminal DANS ce dossier. Le corrigé est séparé dans `correction.py` ; commence avec `eleve.py`.
2. Installe Python 3.12 depuis [python.org/downloads](https://www.python.org/downloads/). Sous Windows, utilise l'installateur officiel, ajoute Python au PATH si proposé, puis ouvre un nouveau PowerShell. Sous macOS, utilise l'installateur et ouvre Terminal. Sous Linux, utilise le gestionnaire de paquets de ta distribution pour Python et son module venv.
3. Vérifie l'interpréteur, crée son environnement puis installe NumPy.

Windows, dans PowerShell :

```powershell
py -3 --version
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -c "import sys,numpy; print(sys.executable,numpy.__version__)"
.\.venv\Scripts\python.exe verifier.py --jusqua 1
```

macOS et Linux :

```bash
python3 --version
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -c "import sys,numpy; print(sys.executable,numpy.__version__)"
.venv/bin/python verifier.py --jusqua 1
```

Les commandes suivantes du guide utilisent `python`. Remplace-le par le chemin de cet interpréteur, ou active l'environnement : `source .venv/bin/activate` sur macOS/Linux, `.\.venv\Scripts\Activate.ps1` sous PowerShell. Si l'activation est bloquée, garde le chemin complet ; tu n'as pas besoin de changer la politique de sécurité du système.

Le premier contrôle échoue avec `NotImplementedError` tant que tu n'as pas complété les fonctions du TP 1 : c'est attendu. NumPy introuvable signifie souvent que pip et python ne viennent pas du même environnement : utilise toujours `python -m pip`. Sous Linux, un échec de création de venv peut demander le paquet venv de la version installée. Si `py` ou `python3` est introuvable, relance le terminal et vérifie l'installation/PATH avant de modifier le code.

Les fichiers temporaires vont dans `runs/`, jamais dans les poids de référence du dépôt. N'ajoute pas `.venv/` à Git. Utilise un nouveau sous-dossier pour chaque expérience : le lanceur refuse un dossier de run déjà rempli.
