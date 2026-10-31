# Relier le modèle du cours au harness

Un modèle entraîné à prédire du texte ne sait pas automatiquement choisir des outils ni former du JSON. La bonne première mesure est la sonde, sans effet sur des fichiers. Les fixtures et les sorties neuronales sont toujours identifiées séparément.

## 1. Ton checkpoint du dépôt

Installer les dépendances NumPy dans ton environnement, puis, depuis `mon-agent`, donner la racine du dépôt et le fichier réellement entraîné :

```sh
python -m pip install -r harness/requirements.txt
python -m harness.sonder --repo /chemin/ai-from-zero --checkpoint /chemin/mon-checkpoint.npz --out ma-sonde.json
python -m harness.cli --module eleve --repo /chemin/ai-from-zero --checkpoint /chemin/mon-checkpoint.npz --task "Calcule 19+6 avec calculer."
```

`/chemin/...` est à remplacer par tes chemins, entre guillemets s’ils contiennent des espaces. L’adaptateur charge `model.gpt_train.load_checkpoint`, le tokenizer et la configuration sauvegardés. Les logits sont ceux du `TinyGPT.forward` du cours. L’empreinte du checkpoint est conservée.

L’alphabet doit couvrir les instructions et le protocole. La fenêtre doit contenir le prompt. Un vieux checkpoint à 32 tokens peut ne pas convenir : le refus est explicite. `--allow-clipped` sert uniquement à une expérience de troncature documentée ; ce drapeau n’est pas un gain de capacité.

## 2. Le modèle de ton atelier autonome

Dans le dossier `mon-llm`, le projet du premier parcours fournit déjà un serveur de génération local :

```sh
python generer.py --module eleve --checkpoint runs/mon-essai/modele.npz --serve --port 8765
```

Conserver ce terminal ouvert. Dans un autre terminal, depuis `mon-agent` :

```sh
python -m harness.sonder --endpoint http://127.0.0.1:8765/generer --out sonde-atelier.json
python -m harness.cli --module eleve --endpoint http://127.0.0.1:8765/generer --task "Calcule 19+6 avec calculer."
```

Le serveur renvoie texte, contexte, caractères inconnus et provenance. L’adaptateur refuse un alphabet incompatible ou une troncature par défaut. Le code du premier projet et celui du harness restent deux constructions distinctes à remettre.

## 3. Un serveur de chat local comme comparaison

Un endpoint local qui expose `/v1/chat/completions` peut être utilisé en mode `chat`. Ce client demande du JSON textuel ; il n’utilise pas un format de tool-calling natif du fournisseur.

```sh
python -m harness.sonder --endpoint http://127.0.0.1:8080/v1/chat/completions --api-mode chat --model mon-modele-local
```

Le serveur doit être installé séparément. Les adresses du client sont limitées à une IP de boucle locale. Aucun abonnement ni service externe n’est nécessaire pour les TP. Si ton serveur demande un jeton, la CLI accepte `--token-env NOM_VARIABLE` ; garder sa valeur hors des commandes enregistrées et des rapports.

## 4. Apprendre le protocole exact du harness

Le corpus original fourni comporte deux décisions par famille d’addition : demander l’outil, puis conclure après son observation. Les familles sont séparées avant formulation. Le masque porte seulement sur les cibles de réponse, avec le même `format_prompt` que l’inférence.

```sh
python -m harness.preparer_donnees --out donnees-outils.json
python -m harness.entrainer_controleur --repo /chemin/ai-from-zero --data donnees-outils.json --out controleur.npz --steps 20 --block 1024
python -m harness.sonder --repo /chemin/ai-from-zero --checkpoint controleur.npz --out sonde-controleur.json
```

Avec `--initial /chemin/checkpoint.npz`, le script ajuste les poids de ton modèle compatible, en conservant son tokenizer et sa configuration. Sans cette option, il initialise un contrôleur neuf. Le script refuse les exemples incomplets dans la fenêtre et un alphabet incompatible ; il n’étend pas silencieusement une table de positions.

Le rapport conserve graine, configuration, empreintes, perte de validation et paramètres modifiés. Deux pas servent au test technique du pipeline. Vingt pas sont un point de départ d’expérience, sans promesse de JSON correct ni d’autonomie. Le corpus est étroit : généralisation au-delà de ces additions non démontrée. Comparer ensuite des variantes à budget fixé et réserver d’autres tâches pour le test final.

## 5. Mesurer les trois niveaux

1. `verifier` et `evaluer` : code et infrastructure, avec fixtures identifiées.
2. `sonder` : JSON et bonnes actions du modèle réel, sans outil exécuté.
3. Tâches bout en bout : sorties réellement vérifiées, coût, aides, erreurs, refus et reprises.

Aucun succès d’un niveau ne remplit automatiquement le suivant. Garder les échecs et expliquer une tâche nouvelle avec ses propres traces.
