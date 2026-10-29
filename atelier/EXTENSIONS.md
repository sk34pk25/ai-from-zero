# Après le premier GPT : des prolongements exécutables

Ces extensions viennent après tes 12 TP et ton projet personnel. Aucun composant LLM tout fait n’est utilisé. NumPy suffit au projet principal ; PyTorch est une dépendance facultative pour le port.

## BPE octets et frontières

Lis octet_bpe.py, puis reconstruis son encodage dans un fichier vierge. Les IDs 0–255 représentent les octets, 256/257/258 représentent BOS/EOS/PAD et les fusions commencent à 259. Le choix des égalités est déterministe. Les documents fournis séparément à train ne sont pas fusionnés entre eux.

Teste `decode(encode("café 🤖 日本語"))`, un accent décomposé, une chaîne vide et la chaîne littérale `<eos>`. Celle-ci doit rester du texte. `decode([255])` échoue en mode strict ; `errors="replace"` affiche le remplacement Unicode pour une sortie invalide. Ne modifie jamais le tokenizer au moment du test.

Depuis la RACINE DU DÉPÔT, le laboratoire peut réellement l’utiliser :

```bash
python -m model.gpt_train --byte-bpe 64 --steps 100 --checkpoint runs/octets/modele.npz --report runs/octets/rapport.json
python -m model.gpt_sample --checkpoint runs/octets/modele.npz --prompt "Le " --steps 60
```

Chaque split de texte est ici une séquence avec BOS et EOS. Pour entraîner sur des documents multiples avec une frontière à chacun, conserve leur liste et encode chaque document avec ces marqueurs avant de concaténer les IDs. PAD sert de réservation ; aucun padding n’est nécessaire aux fenêtres de taille fixe de ce lanceur. La génération bloque BOS/PAD et s’arrête à EOS ; les octets générés invalides sont décodés avec remplacement. L’export du playground historique reste limité aux tokenizers caractère/BPE caractère ; ce tokenizer s’utilise en CLI.

## NumPy puis PyTorch, avec parité

Depuis le DOSSIER DE L’ATELIER :

```bash
python -m pip install -r requirements-torch.txt
python port_torch.py --module eleve --steps 20 --rapport runs/parite.json
```

Pour vérifier l’installation de la référence, remplace eleve par correction. Le port utilise les mêmes poids float64, LayerNorm, GELU avec approximation tanh, masque et cibles. Il compare logits, loss et chacun des gradients avant une petite boucle AdamW sur un seul lot. Il n’utilise ni Transformer préfabriqué ni modèle préentraîné.

Commence sur CPU. Une option `--device cuda` est disponible si TON installation PyTorch expose un accélérateur CUDA/HIP compatible ; aucune configuration GPU n’est faite automatiquement. MPS n’est pas pris en charge par ce contrôle float64. Une future comparaison de vitesse doit garder formes, dtype, budget et synchronisation identiques, et mesurer mémoire et temps. Les durées de deux appareils différents ne se déduisent pas d’un seul run CPU.

Sources primaires : [GELU](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.gelu.html), [LayerNorm](https://docs.pytorch.org/docs/stable/generated/torch.nn.functional.layer_norm.html), [précision numérique](https://docs.pytorch.org/docs/stable/notes/numerical_accuracy.html).

## Utiliser son checkpoint personnel

Depuis le dossier de l’atelier, après entraînement de TON module :

```bash
python generer.py --checkpoint runs/personnel/modele.npz --prompt "le " --tokens 60 --seed 0
python generer.py --checkpoint runs/personnel/modele.npz --serve
```

La CLI renvoie texte, nombre de tokens produits, durée, vitesse et critère d’arrêt. Elle garde seulement la fenêtre de contexte et signale les caractères d’invite remplacés. Les checkpoints récents sont liés au code et au moteur qui les ont produits. Modifier ce code demande une nouvelle expérience.

Le serveur facultatif écoute uniquement sur 127.0.0.1, sans journaliser les invites. Exemple PowerShell dans un AUTRE terminal :

```powershell
$corps = @{prompt="le ";tokens=40;seed=0} | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8765/generer -Method Post -ContentType application/json -Body $corps
```

Il sert le checkpoint de l’atelier configuré au lancement ; le client ne choisit ni module Python ni chemin de fichier. Une API ne rend pas les réponses plus fiables. N’utilise pas ce petit modèle comme source de faits sans vérification.

## Prochaine architecture moderne

Le tronc commun standard est entraînable. RMSNorm est désormais entraînable dans le laboratoire avec `python -m model.gpt_train --norm rms` ; ses valeurs et gradients sont contrôlés. RoPE, SwiGLU et GQA restent des démonstrations de forward. Pour un prolongement personnel, choisis UNE option, écris sa dérivée ou son graphe autograd, vérifie sa parité, entraîne et compare à budget déclaré. MoE, SSM et multimodalité sont encore des projets optionnels plus étendus.
