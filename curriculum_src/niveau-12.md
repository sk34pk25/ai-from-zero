@ID
12.1
@TITLE
Formuler une hypothèse
@TAG
Architecture
@MINUTES
30
@WHY
Une hypothèse annonce ce qui pourrait se produire et ce qui la contredirait. « Plus large sera mieux » est trop vague. « À budget de tokens égal, la largeur 24 réduira la perte de validation moyenne face à 16 » donne une mesure à vérifier. Cette étape produit un élément vérifiable de ton dossier de modèle.
@OBJECTIVES
- Formuler une affirmation réfutable sur la largeur du GPT
- Fixer une mesure et une règle de comparaison avant les essais
- Conserver les mêmes données et graines pour les deux configurations
@PREREQ
Un premier GPT entraîné et rechargeable, étape 4.14.
@INTUITION
Une hypothèse annonce ce qui pourrait se produire et ce qui la contredirait. « Plus large sera mieux » est trop vague. « À budget de tokens égal, la largeur 24 réduira la perte de validation moyenne face à 16 » donne une mesure à vérifier.
@VOCAB
Hypothèse : affirmation mise à l’épreuve. Réfutation : observation incompatible avec l’affirmation. Variable : réglage étudié. Budget de tokens : nombre de cibles utilisées pendant l’entraînement.
@EXPLAIN
Fixe deux largeurs compatibles avec le nombre de têtes, par exemple 16 et 24 avec deux têtes. Garde tokenizer, contexte, batch, pas, données et graines identiques. Écris le critère de sélection avant de lancer les calculs. Si le gain varie de signe entre graines ou coûte trop de mémoire pour ta machine, conserve cette observation. Le résultat concerne cette recette et ce corpus ; il ne prouve pas que tous les modèles plus larges sont meilleurs.
@LANG
python
@CODE
:::
hypothese = {"variable": "largeur", "valeurs": [16, 24],
             "graines": [0, 1, 2], "selection": "validation",
             "resultats": None}
assert all(d % 2 == 0 for d in hypothese["valeurs"])
assert hypothese["resultats"] is None  # à mesurer, pas à inventer
print(hypothese)
:::
@EXPERIMENT
Écris le résultat qui réfuterait ton hypothèse. Puis remplace « meilleur » par une métrique, son unité et un budget. Fais relire cette phrase sans montrer de courbe.
@EXERCISE
Écris une hypothèse sur la largeur de ton GPT, puis le résultat qui te ferait la rejeter. Fixe les textes, les graines et le budget avant de lancer les deux configurations.
@BUILD
Ajoute cette hypothèse datée au DOSSIER_MODELE.md avant tes entraînements. Conserve les réglages des deux variantes et le critère qui déterminera ton choix.
@QUESTION
Quel protocole permet de mettre ton hypothèse à l’épreuve ?
@CORRECT
Comparer deux largeurs entraînées sur les mêmes données, graines et budget, puis examiner validation et coût
@WRONG
- Choisir la variante après avoir cherché son meilleur score sur test
- Annoncer une capacité sans entraîner les poids
- Changer les données et la largeur dans le même essai
@EXPLANATION
Comparer deux largeurs entraînées sur les mêmes données, graines et budget, puis examiner validation et coût. Écris le résultat qui réfuterait ton hypothèse.

@@@
@ID
12.2
@TITLE
La baseline
@TAG
Architecture
@MINUTES
30
@WHY
Une note de 2 ne dit rien sans son échelle. Pour une perte, la référence uniforme donne un point de départ sans apprentissage. Le bigramme montre ce que suffit à apprendre le token précédent ; ton GPT initial apporte le contexte plus long. Cette étape produit un élément vérifiable de ton dossier de modèle.
@OBJECTIVES
- Calculer la perte d’une distribution uniforme
- Distinguer uniforme, bigramme et GPT initial entraîné
- Évaluer les références sur les mêmes cibles que la variante
@PREREQ
Méthode du projet personnel, étape 12.1.
@INTUITION
Une note de 2 ne dit rien sans son échelle. Pour une perte, la référence uniforme donne un point de départ sans apprentissage. Le bigramme montre ce que suffit à apprendre le token précédent ; ton GPT initial apporte le contexte plus long.
@VOCAB
Baseline : référence de comparaison. Uniforme : même probabilité pour chaque token. Bigramme : prédiction conditionnée par le token précédent. Cible : token dont on évalue la probabilité.
@EXPLAIN
Avec V tokens possibles, l’uniforme attribue 1/V à la cible : sa perte vaut log(V) nats par token. Le bigramme et le GPT sont appris sur train, puis évalués sur les mêmes fenêtres de validation, avec le même tokenizer et la même réduction. Une perte train ne remplace pas une perte validation. Le code ci-dessous calcule des distributions miniatures pour comprendre la métrique ; il ne représente pas le résultat entraîné de ton projet.
@LANG
python
@CODE
:::
import math
vocab = 4
perte_uniforme = math.log(vocab)
# Distributions inventées uniquement pour vérifier la formule.
p_cibles = [0.5, 0.25]
perte_exemple = -sum(math.log(p) for p in p_cibles) / len(p_cibles)
assert math.isclose(perte_uniforme, -math.log(1 / vocab))
print(perte_uniforme, perte_exemple)
:::
@EXPERIMENT
Dans l’exemple, double la taille du vocabulaire. Prédis la variation de la perte uniforme avant de relancer. Puis vérifie qu’une cible jugée moins probable augmente la perte.
@EXERCISE
Nomme les trois références de ton projet : uniforme, bigramme et GPT initial. Explique pourquoi elles doivent être évaluées sur les mêmes cibles et avec le même tokenizer.
@BUILD
Dans ton tableau de résultats, réserve trois lignes : uniforme, bigramme et GPT initial. Renseigne tokenizer, nombre de cibles et perte de validation pour chacune.
@QUESTION
À quoi comparer la perte de ton GPT personnel ?
@CORRECT
À des baselines évaluées sur les mêmes cibles avec le même tokenizer et la même réduction
@WRONG
- À une perplexité publiée avec un autre tokenizer sans conversion
- Au meilleur échantillon choisi après vingt générations
- À la perte train de données déjà mémorisées
@EXPLANATION
À des baselines évaluées sur les mêmes cibles avec le même tokenizer et la même réduction. Dans l’exemple, double la taille du vocabulaire.

@@@
@ID
12.3
@TITLE
L’ablation
@TAG
Architecture
@MINUTES
30
@WHY
Si tu changes à la fois la largeur et les textes, tu ne sais plus à quoi attribuer un gain. Deux recettes qui ne diffèrent que par la largeur rendent l’explication plus précise ; elles peuvent cependant demander des coûts différents. Cette étape produit un élément vérifiable de ton dossier de modèle.
@OBJECTIVES
- Isoler le réglage qui diffère entre deux expériences
- Apparier les graines et le budget de tokens
- Distinguer budget identique et coût de calcul identique
@PREREQ
Méthode du projet personnel, étape 12.2.
@INTUITION
Si tu changes à la fois la largeur et les textes, tu ne sais plus à quoi attribuer un gain. Deux recettes qui ne diffèrent que par la largeur rendent l’explication plus précise ; elles peuvent cependant demander des coûts différents.
@VOCAB
Ablation : retrait contrôlé d’un composant. Comparaison contrôlée : modification d’une variable annoncée. Graines appariées : même liste de graines entre recettes. Facteur confondant : autre différence pouvant expliquer le résultat.
@EXPLAIN
Une ablation retire un composant pour estimer son apport. Une variation de largeur est une comparaison contrôlée proche de ce raisonnement, sans retrait de composant. Fixe les mêmes graines pour apparier les essais, puis calcule les différences de validation pour chaque paire. Un même nombre de tokens vus ne signifie ni mêmes paramètres, ni mêmes FLOPs, ni même durée. Note ces différences dans le rapport au lieu de qualifier les budgets de parfaitement équivalents.
@LANG
python
@CODE
:::
base = {"largeur": 16, "contexte": 16, "batch": 4, "pas": 240}
variante = {**base, "largeur": 24}
differences = {k for k in base if base[k] != variante[k]}
assert differences == {"largeur"}
assert base["contexte"] * base["batch"] * base["pas"] == 15360
print(differences)
:::
@EXPERIMENT
Ajoute volontairement un changement de contexte à la variante : le contrôle doit échouer. Explique quelles comparaisons de coût restent nécessaires même après avoir rétabli le contexte.
@EXERCISE
Construis deux lignes d’expérience qui diffèrent seulement par la largeur. Indique ce qui reste fixe et pourquoi paramètres, temps et mémoire peuvent tout de même changer.
@BUILD
Archive les deux configurations complètes, les graines et les tokens vus. Une ligne de tableau par run permet de retrouver aussi un essai qui contredit ton attente.
@QUESTION
Quelle comparaison permet d’attribuer un effet à la largeur ?
@CORRECT
Garder données, tokenizer et budget fixes, modifier la largeur et documenter les différences de coût
@WRONG
- Modifier simultanément les données et la profondeur
- Supprimer les essais qui donnent de mauvais résultats
- Comparer un entraînement complet à un simple forward initialisé
@EXPLANATION
Garder données, tokenizer et budget fixes, modifier la largeur et documenter les différences de coût. Ajoute volontairement un changement de contexte à la variante : le contrôle doit échouer.

@@@
@ID
12.4
@TITLE
Les métriques
@TAG
Architecture
@MINUTES
30
@WHY
Mesurer une distance en pas ne suffit pas si les deux personnes n’ont pas la même foulée. Une perte par token dépend elle aussi de la découpe. Le même texte peut demander quatre tokens dans un modèle et dix dans un autre. Cette étape produit un élément vérifiable de ton dossier de modèle.
@OBJECTIVES
- Calculer cross-entropy et perplexité sans confondre leurs unités
- Vérifier le dénominateur et le nombre de cibles
- Expliquer pourquoi deux tokenizers empêchent une comparaison directe par token
@PREREQ
Méthode du projet personnel, étape 12.3.
@INTUITION
Mesurer une distance en pas ne suffit pas si les deux personnes n’ont pas la même foulée. Une perte par token dépend elle aussi de la découpe. Le même texte peut demander quatre tokens dans un modèle et dix dans un autre.
@VOCAB
Cross-entropy : surprise moyenne des cibles. Nat : unité issue du logarithme naturel. Perplexité : exponentielle de cette moyenne. Réduction : règle qui transforme les pertes individuelles en une valeur.
@EXPLAIN
La cross-entropy moyenne est la somme des log-probabilités négatives divisée par le nombre de cibles évaluées. Avec le logarithme naturel, son unité est le nat par token. La perplexité est exp(perte) : une perte plus faible donne une perplexité plus faible. Pour des tokenizers différents, une unité commune comme les nats par caractère exige de conserver la log-probabilité totale et un dénominateur commun sur le même texte, en précisant les cibles, la normalisation et les caractères inconnus. La perplexité ne mesure pas directement la vérité des phrases.
@LANG
python
@CODE
:::
import math
# Deux cibles fictives : contrôle de la formule, pas score entraîné.
nll = [-math.log(0.5), -math.log(0.25)]
loss = sum(nll) / len(nll)
perplexite = math.exp(loss)
assert math.isclose(perplexite, math.sqrt(8))
print({"nats_par_token": loss, "perplexite": perplexite, "cibles": len(nll)})
:::
@EXPERIMENT
Remplace la probabilité 0.25 par 0.125. Prédis le sens du changement de perplexité, puis vérifie. Explique pourquoi comparer ce score à une loss train serait trompeur.
@EXERCISE
Classe deux pertes de validation obtenues sur les mêmes cibles, puis explique pourquoi cette comparaison serait insuffisante avec deux tokenizers différents. Conserve les unités dans ton tableau.
@BUILD
Dans le dossier, ajoute l’unité, le split et le nombre de cibles à chaque score. Si tu compares des tokenizers, décris explicitement la conversion et la couverture du texte.
@QUESTION
Quand peut-on comparer directement deux pertes par token ?
@CORRECT
Quand tokenizer, données évaluées, cibles et réduction sont les mêmes
@WRONG
- Dès que le second modèle a plus de paramètres
- Quand les deux nombres sont affichés avec trois décimales
- Toujours, même avec une tokenisation différente
@EXPLANATION
Quand tokenizer, données évaluées, cibles et réduction sont les mêmes. Remplace la probabilité 0.25 par 0.125.

@@@
@ID
12.5
@TITLE
Un banc d’essai
@TAG
Architecture
@MINUTES
30
@WHY
Changer le nom d’un fichier ne change pas son contenu. Deux copies du même texte dans train et test permettraient au modèle d’être évalué sur des phrases déjà vues ; cela déforme la question que l’on voulait lui poser. Cette étape produit un élément vérifiable de ton dossier de modèle.
@OBJECTIVES
- Réserver les documents avant l’entraînement
- Repérer des doublons après normalisation Unicode
- Conserver provenance, groupes et empreintes dans un manifeste
@PREREQ
Méthode du projet personnel, étape 12.4.
@INTUITION
Changer le nom d’un fichier ne change pas son contenu. Deux copies du même texte dans train et test permettraient au modèle d’être évalué sur des phrases déjà vues ; cela déforme la question que l’on voulait lui poser.
@VOCAB
Manifeste : inventaire des sources et des splits. Empreinte : condensat du contenu. Groupe documentaire : textes à garder dans le même split. Fuite : information réservée utilisée pour apprendre ou choisir.
@EXPLAIN
Découpe les données par documents ou groupes documentaires avant d’entraîner tokenizer et poids. Normalise de façon annoncée, déduplique, puis conserve sources, droits d’usage et empreintes. Le script preparer.py réserve train, validation et test et enregistre le manifeste. Une empreinte identique révèle une copie exacte normalisée ; une empreinte différente ne garantit pas l’absence de paraphrases ou d’extraits communs. Vérifie aussi ces recouvrements et décide à l’avance ce que ta mesure prétend généraliser.
@LANG
python
@CODE
:::
import hashlib, unicodedata
def empreinte(texte):
    normalise = unicodedata.normalize("NFC", texte.replace("\r\n", "\n"))
    return hashlib.sha256(normalise.encode("utf-8")).hexdigest()
assert empreinte("café\n") == empreinte("cafe\u0301\r\n")
assert empreinte("chat") != empreinte("chien")
print(empreinte("chat"))
:::
@EXPERIMENT
Crée deux fichiers avec le même texte mais des noms différents et une fin de ligne différente. Vérifie les empreintes, puis explique pourquoi des extraits partagés demandent encore une relecture.
@EXERCISE
Prépare un manifeste train, validation et test avec sources, empreintes et groupes documentaires. Explique pourquoi deux fichiers de noms différents peuvent encore contenir la même information.
@BUILD
Prépare le corpus avec preparer.py dans un nouveau dossier. Joins son manifeste au projet et garde le test réservé jusqu’à la recette finale.
@QUESTION
Comment préparer les documents du banc personnel ?
@CORRECT
Réserver les groupes documentaires avant entraînement, contrôler les doublons et conserver leur provenance
@WRONG
- Tirer une nouvelle validation jusqu’à obtenir le score voulu
- Mettre le même livre dans train et test en changeant son nom
- Ajuster le tokenizer sur tout le corpus réservé
@EXPLANATION
Réserver les groupes documentaires avant entraînement, contrôler les doublons et conserver leur provenance. Crée deux fichiers avec le même texte mais des noms différents et une fin de ligne différente.

@@@
@ID
12.6
@TITLE
Qualité, latence, mémoire, énergie
@TAG
Architecture
@MINUTES
35
@WHY
Un modèle peut produire un meilleur score tout en dépassant la mémoire de ta machine. Il faut donc plusieurs colonnes pour décrire le compromis. Chacune répond à une question et porte une unité différente. Cette étape produit un élément vérifiable de ton dossier de modèle.
@OBJECTIVES
- Mesurer une durée avec une horloge adaptée
- Séparer perte, latence, débit, mémoire et énergie
- Indiquer une mesure absente sans lui donner une valeur fictive
@PREREQ
Méthode du projet personnel, étape 12.5.
@INTUITION
Un modèle peut produire un meilleur score tout en dépassant la mémoire de ta machine. Il faut donc plusieurs colonnes pour décrire le compromis. Chacune répond à une question et porte une unité différente.
@VOCAB
Latence : attente avant un résultat. Débit : quantité produite par unité de temps. Pic mémoire : maximum observé pendant le calcul. Énergie : intégrale d’une puissance sur une durée, en joules.
@EXPLAIN
Note la perte de validation, la durée d’entraînement en secondes et les paramètres. Pour la génération, distingue latence avant le premier token et débit des suivants. La mémoire des poids n’est pas la mémoire maximale du processus : gradients, états d’optimiseur et activations s’ajoutent. Les FLOPs décrivent un compte d’opérations, pas une mesure de joules. Mesurer l’énergie demande une puissance observée au cours du temps et un périmètre annoncé. Le mini-calcul ci-dessous mesure uniquement sa durée locale ; il ne donne pas la performance du GPT.
@LANG
python
@CODE
:::
from time import perf_counter
debut = perf_counter()
controle = sum(i * i for i in range(1000))
secondes = perf_counter() - debut
rapport = {"duree_s": secondes, "energie_J": None, "controle": controle}
assert secondes >= 0 and rapport["energie_J"] is None
print(rapport)
:::
@EXPERIMENT
Répète ce mini-calcul plusieurs fois. Observe les variations de durée et distingue cet effet du résultat arithmétique. Écris les mesures nécessaires avant de convertir une puissance en énergie.
@EXERCISE
Écris une ligne de rapport avec perte, durée et mémoire, chacune avec son unité. Si tu ne disposes pas d’une mesure d’énergie, marque-la Non mesurée plutôt que de la déduire des FLOPs.
@BUILD
Dans chaque run, conserve matériel, version Python, durée et paramètres. Marque « Non mesurée » pour une mémoire ou une énergie que tu n’as pas réellement observée.
@QUESTION
Que mettre dans une colonne d’énergie non mesurée ?
@CORRECT
Non mesurée, avec la méthode nécessaire pour la mesurer expliquée
@WRONG
- Le nombre de FLOPs comme s’il s’agissait de joules
- Zéro pour donner une valeur à toutes les cases
- Le temps de génération utilisé comme une puissance électrique
@EXPLANATION
Non mesurée, avec la méthode nécessaire pour la mesurer expliquée. Répète ce mini-calcul plusieurs fois.

@@@
@ID 12.7
@TITLE La modularité
@TAG Architecture
@MINUTES 25
@WHY
Tu ne peux ablater une pièce que si elle se décroche. Le Backbone est modulaire au sens étroit : un argument kind change le mélangeur sans changer la forme attendue par l'appelant.
@OBJECTIVES
- Voir kind comme un paramètre
- Vérifier que l'appelant ne change pas
- Repérer ce qui n'est pas modulaire
@PREREQ Tableau de compromis.
@INTUITION
Une pièce standard se remplace sans refaire la voiture. Si le remplacement demande de ressouder la carrosserie, ce n'est pas un module, c'est une autre voiture.
@VOCAB
Module : une pièce à contrat stable. Contrat de Backbone : forward(idx) renvoie (B,T,D). Le dos hybride n'a pas de backward complet. Le GPT standard possède, lui, un chemin d'entraînement séparé dans gpt_train.py ; partager une forme de sortie ne suffit pas à partager des poids.
@EXPLAIN
Les trois kinds partagent embed, la boucle de couches et le résidu. Seul le mode de couche change. L'appelant — le test — ne contient pas un if par kind, à part la construction. C'est la modularité utile pour l'étape suivante. Elle a une limite : les poids ne sont pas compatibles d'un kind à l'autre, et hybrid n'est pas « transformer plus un bouton ». Charger des poids transformer dans un ssm n'a pas de sens dans ce code, et aucune fonction ne le propose. Le tokenizer reste à part, dans son module, ce qui est une autre modularité : tu peux changer le découpage du texte sans toucher au scan. Ne survends pas : il n'y a pas de registre de plugins.
@LANG python
@CODE
:::
from model.backbone import Backbone
for kind in ("transformer", "ssm", "hybrid"):
    modele = Backbone(kind, vocab_size=8, d_model=8, n_layers=2, block_size=6, seed=3)
    print(kind, modele.layers[0]["mode"])
:::
@EXPERIMENT
transformer commence par attn, ssm par ssm, hybrid par attn. L'appel forward, lui, reste le même.
@EXERCISE
Pourquoi ne pas échanger les poids entre kinds ? Parce que les clés utiles diffèrent selon le mode, et que rien ne garantit un sens commun.
@BUILD
Le fil rouge exploite cette modularité étroite. L'architecture candidate est un choix de kind, pas un framework.
@QUESTION
Quel est le contrat qui rend les trois dos interchangeables ?
@CORRECT
forward renvoie (B, T, D) et reste causal, pour les mêmes tailles
@WRONG
- Ils partagent les mêmes poids
- Ils ont la même perplexité
- Ils incluent le tokenizer
@EXPLANATION
L'appelant dépend de la forme et de la causalité. Les valeurs et les poids restent propres à chaque kind.
@@@
@ID 12.8
@TITLE L'architecture candidate
@TAG Architecture
@MINUTES 35
@WHY
La candidate du parcours est volontairement petite : un dos dont on choisit le mélangeur, justifié par des tests de forme et de causalité, et par un coût d'attention qui n'existe que sur les couches attn. C'est une architecture, pas un produit.
@OBJECTIVES
- Nommer la candidate sans la survendre
- Relier hybrid à l'alternance des couches
- Allumer la brique du site
@PREREQ Modularité.
@INTUITION
Tu rends une maquette avec la liste des pièces et les essais qu'elle a passés. Tu ne la vends pas comme le pont. La maquette s'appelle hybrid seulement si tu assumes ce qu'elle n'a pas fait : apprendre le français.
@VOCAB
Candidate : Backbone kind hybrid, ou un autre kind si ton hypothèse change. Justification : les tests et les formules, pas un adjectif. Brique du site : « Architecture candidate », liée à cette étape.
@EXPLAIN
Deux projets distincts sont possibles. Le projet obligatoire assemble ton GPT standard, entraîne ses poids depuis zéro et mesure sa perte sur des documents réservés. Tu peux modifier une largeur ou une profondeur, à données et budget documentés. Le projet avancé construit un dos hybride alternant attention et scan ; son interface (B,T,D) et sa causalité sont testées, mais il n'a pas de backward complet ici. Le TinyGPT standard, lui, dispose bien de cet entraînement dans gpt_train.py. L'architecture candidate du projet final doit donc être une modification entraînable ou une expérience explicitement limitée au forward. La justification nomme toujours ce qui change, le test, les données et ce qui n'est pas mesuré.
@LANG python
@CODE
:::
import numpy as np
from model.backbone import Backbone
modele = Backbone("hybrid", vocab_size=8, d_model=8, n_layers=2, block_size=6, seed=3)
idx = np.array([[1, 2, 3, 4]])
y = modele.forward(idx)
change = idx.copy()
change[0, -1] = 7
print(y.shape, modele.forward(change)[0, 0].shape)
:::
@EXPERIMENT
La forme est (1, 4, 8). La position 0 a la forme (8,) dans les deux cas ; le test officiel exige qu'elle soit égale.
@EXERCISE
Choisis une variation entraînable du GPT standard : largeur ou profondeur. Avant le run, écris baseline, changement, budget de tokens et métrique. Si tu explores plutôt le dos hybride, annonce qu'aucun gain linguistique après entraînement ne sera mesuré.
@BUILD
Prépare le projet final de l'atelier : un GPT personnel entraîné et une variation contrôlée. Le dos hybride devient une extension de recherche ; il ne remplace pas le modèle entraîné obligatoire.
@QUESTION
Que revendique la candidate hybrid de ce dépôt ?
@CORRECT
Une alternance attention et scan, de forme stable et causale, sans qualité de langage mesurée
@WRONG
- Un état de l'art en français
- Un Mamba officiel plus un ViT
- Un agent outillé
@EXPLANATION
L'alternance est dans l'initialisation, la forme et la causalité sont testées. Le reste n'est pas revendiqué.
@CODEFILE
model/gpt_train.py
@SYMBOL
train_gpt

@@@
@ID 12.9
@TITLE Entraîner ce que tu sais entraîner
@TAG Architecture
@MINUTES 30
@WHY
Le mot entraînement couvre des choses très différentes dans ce dépôt : une régression, un classifieur convexe, un comptage de bigrammes. Il ne couvre pas un apprentissage complet du dos hybrid. Tu entraînes ce qui a un test de baisse de loss, et tu le dis.
@OBJECTIVES
- Citer les entraînements réellement testés
- Ne pas étendre le verbe au dos
- Garder une loss qui descend pour une raison lisible
@PREREQ Architecture candidate.
@INTUITION
Tu sais faire cuire une crêpe. Tu ne dis pas que tu sais tenir un restaurant. Les deux mots « cuisiner » ne désignent pas le même geste.
@VOCAB
Régression : train_linear_regression dans model/mlp.py. Classifieur : train_linear_classifier dans model/train.py, entropie croisée sur une tête linéaire. Bigramme : observe, qui compte. Dos : non entraîné de bout en bout.
@EXPLAIN
Le laboratoire sait entraîner le GPT standard et un petit réseau, estimer le bigramme par comptage et ajuster le GPT par SFT ou LoRA. Il entraîne aussi les variantes modernes avec ce backward : RMSNorm, RoPE, SwiGLU, GQA et poids partagés. Seul le dos hybride reste un forward exploratoire. Pour le projet final, tes fonctions decoder et adamw doivent entraîner un GPT à positions absolues, LayerNorm et GELU ; les variantes sont des prolongements à comparer ensuite, une à la fois. Vérifie d'abord que tu peux surapprendre un minuscule lot : c'est un test de débogage, pas le résultat final. Sépare ensuite les documents, fixe le tokenizer sur train et choisis tes réglages sur validation. Le test final reste réservé. Une loss qui baisse sur train et monte sur validation est une observation à expliquer. Les critères publics de l'atelier ne valident pas un assistant général : ils contrôlent un apprentissage et sa mesure.
@LANG python
@CODE
:::
from model.gpt_train import assert_trainable
from model.transformer import GPTConfig
config = GPTConfig(vocab_size=16, d_model=8, n_heads=2, n_layers=1)
assert_trainable(config)
print("Le decoder standard peut être entraîné de bout en bout")
:::
@EXPERIMENT
Les clés incluent les deux perplexités et les tailles de découpage. Aucune clé ne dit que le dos hybrid a vu un gradient.
@EXERCISE
Lance ton entraînement avec des sorties dans runs/. Compare ses poids initiaux et finaux, vérifie le masque causal et recharge le checkpoint. Explique la différence entre le minuscule lot de débogage et les documents réservés à la validation.
@BUILD
Le rapport final doit contenir les hashes des données, la configuration, les courbes train/validation et le contrôle de rechargement. Utilise atelier/entrainer.py après avoir terminé atelier/eleve.py.
@QUESTION
Quel entraînement le dépôt ne fait-il pas ?
@CORRECT
La mise à jour des poids du dos hybrid par rétropropagation
@WRONG
- Le comptage du bigramme
- La descente sur une tête linéaire convexe
- Le calcul du gradient d'entropie croisée
@EXPLANATION
Ces trois derniers ont des tests. Le dos, lui, est un forward initialisé.
@CODEFILE
model/gpt_train.py
@SYMBOL
train_gpt

@@@
@ID
12.10
@TITLE
Analyser un échec
@TAG
Architecture
@MINUTES
30
@WHY
Une bonne note obtenue en voyant la réponse n’est pas une preuve d’apprentissage. Un masque causal incorrect peut produire cette illusion : la loss baisse parce que le calcul a accès à une information qui devrait rester cachée. Cette étape produit un élément vérifiable de ton dossier de modèle.
@OBJECTIVES
- Séparer une erreur du programme d’une faiblesse du modèle
- Tester la causalité sur deux contextes au même préfixe
- Refaire les mesures invalidées après correction d’un bug
@PREREQ
Un protocole et des métriques fixés, étapes 12.3 et 12.6.
@INTUITION
Une bonne note obtenue en voyant la réponse n’est pas une preuve d’apprentissage. Un masque causal incorrect peut produire cette illusion : la loss baisse parce que le calcul a accès à une information qui devrait rester cachée.
@VOCAB
Diagnostic : test d’une cause possible. Invariant : propriété attendue malgré une modification précise. Causalité : absence de dépendance au futur. Symptôme : observation à expliquer avant de modifier la recette.
@EXPLAIN
Avant de commenter un gain, vérifie les indices des cibles, la causalité, les gradients et le rechargement. Pour la causalité, construis deux séquences identiques jusqu’à une position et différentes ensuite. Les logits de leur préfixe doivent rester égaux à poids et mode déterministes. Le court exemple ci-dessous illustre une dépendance limitée au préfixe ; applique ensuite ce principe au vrai decoder avec les contrôles du TP 8. Si le code fuit le futur, corrige puis refais les runs concernés : une ancienne courbe ne reste pas valide après la correction.
@LANG
python
@CODE
:::
def prefixe_causal(tokens, position):
    return sum(tokens[:position + 1])
a, b = [1, 2, 3], [1, 2, 99]
assert prefixe_causal(a, 1) == prefixe_causal(b, 1)
# Le vrai TP vérifie les logits, pas cette simple somme.
assert sum(a) != sum(b)
print("Le suffixe change ; le préfixe causal reste identique.")
:::
@EXPERIMENT
Remplace tokens[:position + 1] par tokens dans l’exemple : le test doit détecter la fuite. Retrouve ensuite le contrôle de masque dans verifier.py et explique ce qu’il compare.
@EXERCISE
Ton GPT bat la baseline mais le test de causalité échoue. Explique l’ordre des contrôles avant toute conclusion et indique ce qu’il faut refaire après correction du bug.
@BUILD
Ajoute un échec réel au dossier : symptôme, hypothèse, test discriminant et correction. Identifie les rapports devenus invalides et refais les mesures qui dépendaient du bug.
@QUESTION
Que faire si une bonne perte accompagne une fuite du futur ?
@CORRECT
Corriger le masque ou les indices, vérifier la causalité puis refaire les mesures avec le protocole fixé
@WRONG
- Conserver uniquement la bonne perte dans le rapport
- Présenter le bug comme une nouvelle capacité de raisonnement
- Supprimer le contrôle de causalité pour terminer le projet
@EXPLANATION
Corriger le masque ou les indices, vérifier la causalité puis refaire les mesures avec le protocole fixé. Remplace tokens[:position + 1] par tokens dans l’exemple : le test doit détecter la fuite.

@@@
@ID
12.11
@TITLE
Itérer une fois
@TAG
Architecture
@MINUTES
25
@WHY
La validation est une répétition où tu peux encore choisir ta recette. Le test est le bilan de la recette fixée. Le consulter à chaque essai finit par le transformer en un deuxième jeu de validation. Cette étape produit un élément vérifiable de ton dossier de modèle.
@OBJECTIVES
- Choisir une modification à partir du diagnostic de validation
- Conserver les essais écartés et les règles de sélection
- Réserver le test à la mesure finale de la recette choisie
@PREREQ
Méthode du projet personnel, étape 12.10.
@INTUITION
La validation est une répétition où tu peux encore choisir ta recette. Le test est le bilan de la recette fixée. Le consulter à chaque essai finit par le transformer en un deuxième jeu de validation.
@VOCAB
Itération : nouvelle expérience issue d’un résultat. Sélection : choix d’une recette sur validation. Test final : mesure après fixation de la recette. Suradaptation : ajustement excessif aux données utilisées pour choisir.
@EXPLAIN
Après le premier résultat, propose une modification justifiée : largeur, taux d’apprentissage ou qualité des données, une variable à la fois. Applique le même protocole aux recettes comparées et conserve tous les runs. Une validation utilisée très souvent peut aussi être suradaptée : documente le nombre d’essais. Sélectionne la recette, fige code et configurations, puis déclenche la mesure finale sur le test réservé. Si ce bilan inspire une nouvelle modification, considère-la comme une nouvelle expérience et réserve de nouvelles données pour une future conclusion indépendante.
@LANG
python
@CODE
:::
candidats = [
    {"nom": "initial", "validation": 2.4},
    {"nom": "variante", "validation": 2.3},
]  # Nombres fictifs pour montrer la sélection.
choix = min(candidats, key=lambda run: run["validation"])
bilan = {"recette": choix["nom"], "test": None}
assert bilan["recette"] == "variante" and bilan["test"] is None
print(bilan)
:::
@EXPERIMENT
Ajoute une variante moins bonne à la liste : elle doit rester visible sans devenir le choix retenu. Explique pourquoi un score test favorable ne doit pas servir à la sélectionner.
@EXERCISE
Décris une seule modification après ton premier résultat de validation. Explique quel contrôle tu relances et pourquoi consulter le test ne doit pas servir à choisir la nouvelle recette.
@BUILD
Écris la modification retenue et son motif dans le dossier. Date le choix de la recette avant le test final et garde les configurations des essais abandonnés.
@QUESTION
Sur quoi choisir la nouvelle configuration avant le test final ?
@CORRECT
Sur la validation et le protocole fixé, en conservant le test réservé pour la mesure finale
@WRONG
- Sur le test réservé à chaque nouvel essai
- Sur la phrase la plus jolie parmi de nombreux tirages
- Sur un gain annoncé sans code ni entraînement
@EXPLANATION
Sur la validation et le protocole fixé, en conservant le test réservé pour la mesure finale. Ajoute une variante moins bonne à la liste : elle doit rester visible sans devenir le choix retenu.

@@@
@ID
12.12
@TITLE
Documenter la candidate
@TAG
Architecture
@MINUTES
30
@WHY
Un dossier utile permet à une autre personne de refaire ton expérience et de comprendre ce que tu as appris. Une jolie génération isolée ne donne ni la recette, ni la provenance du texte, ni l’explication de ton programme. Cette étape produit un élément vérifiable de ton dossier de modèle.
@OBJECTIVES
- Assembler un dossier reproductible avec ses limites
- Distinguer contrôles publics, aide consultée et autonomie
- Reconstruire et expliquer une brique sur un exemple nouveau
@PREREQ
Méthode du projet personnel, étape 12.11.
@INTUITION
Un dossier utile permet à une autre personne de refaire ton expérience et de comprendre ce que tu as appris. Une jolie génération isolée ne donne ni la recette, ni la provenance du texte, ni l’explication de ton programme.
@VOCAB
Reproductibilité : possibilité de refaire la recette documentée. Provenance : origine des données et du code. Limite : conclusion non justifiée par l’expérience. Autonomie : capacité observée à refaire et expliquer sur un cas nouveau.
@EXPLAIN
Complète DOSSIER_MODELE.md avec le code personnel, les données autorisées et réservées, le tokenizer, les configurations, les contrôles et les métriques. Joins un checkpoint rechargeable, une commande de reproduction et un échec analysé. Annonce les aides utilisées : exécuter correction.py vérifie la référence mais ne montre pas que tu as conçu eleve.py. La grille /20 distingue ces preuves. Termine par une explication du flux des tenseurs et la reconstruction d’une petite brique sur des valeurs nouvelles, sans regarder la solution. Les limites d’un petit corpus et des contrôles publics font partie du résultat.
@LANG
python
@CODE
:::
requises = {"donnees", "config", "baselines", "rechargement", "limites"}
fiche = {"config": {"largeur": 16}, "limites": ["petit corpus"]}
manquantes = sorted(requises - set(fiche))
assert manquantes == ["baselines", "donnees", "rechargement"]
print(manquantes)  # Présence des rubriques, pas validation de leurs preuves.
:::
@EXPERIMENT
Donne seulement le dossier et les commandes à une autre personne. Note ce qui lui manque pour reproduire. Puis explique une multiplication matricielle et un gradient avec de nouveaux nombres.
@EXERCISE
Complète DOSSIER_MODELE.md avec ton code personnel, tes données réservées, les baselines, une variation contrôlée et les limites. Prépare une explication et une reconstruction sur un cas nouveau sans ouvrir le corrigé.
@BUILD
Remets ton dossier, le code, le checkpoint et les rapports. Utilise la grille du projet final avec une relecture réelle ; conserve à part déclarations, contrôles et autonomie observée.
@QUESTION
Quelle remise permet d’examiner le modèle et ton autonomie ?
@CORRECT
Code, provenance, protocole, contrôles, checkpoint, résultats et explication sur un cas nouveau
@WRONG
- Un compteur de leçons cochées sans code personnel
- Une capture du meilleur texte sans la recette
- Le corrigé exécuté présenté comme une construction sans aide
@EXPLANATION
Code, provenance, protocole, contrôles, checkpoint, résultats et explication sur un cas nouveau. Donne seulement le dossier et les commandes à une autre personne.
@CODEFILE
model/gpt_train.py
@SYMBOL
save_checkpoint
