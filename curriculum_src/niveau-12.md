@@@
@ID 12.1
@TITLE Formuler une hypothèse
@TAG Architecture
@MINUTES 30
@WHY
Une architecture personnelle commence par une phrase falsifiable. « Mon modèle est meilleur » ne l'est pas. « Remplacer une couche d'attention sur deux par un scan baisse le coût et garde la causalité » l'est, parce que le dépôt peut le mesurer.
@OBJECTIVES
- Écrire une hypothèse avec une baseline
- Choisir une mesure déjà dans le labo
- Écarter les hypothèses du niveau 11 non outillées
@PREREQ Le partage reproduit / non reproduit.
@INTUITION
Tu paries sur un changement précis, et tu dis à l'avance quel nombre te donnerait tort. Sans ce nombre, tu pourras toujours raconter que la maquette est prometteuse.
@VOCAB
Hypothèse : un changement et un effet attendu. Falsifiable : un résultat possible la contredit. Baseline : la configuration sans le changement. Effet : une différence sur une métrique nommée.
@EXPLAIN
Le changement que le fil rouge sait faire est le kind du Backbone : transformer, ssm, hybrid. Une hypothèse recevable est : à tailles égales, les trois kinds ont la même forme de sortie et restent causaux, et le coût d'appariement de l'attention est le seul à porter un terme en T au carré. Une hypothèse non recevable aujourd'hui : le hybrid parle mieux français. Rien ne mesure le français. run_ablation est prêt à ranger les configurations, à condition que ta fonction renvoie des métriques que tu as vraiment calculées. Le test jouet utilise loss = 1/lr seulement pour vérifier que les noms et les nombres traversent la fonction. Tu ne présenteras pas 1/lr comme une qualité de modèle.
@LANG python
@CODE
:::
hypothese = {
    "changement": "kind hybrid au lieu de transformer",
    "baseline": "transformer",
    "mesure": "forme, causalite, FLOPs d'attention",
}
print(hypothese["mesure"])
:::
@EXPERIMENT
La mesure tient en trois propriétés déjà testées ou calculables. Ajoute « perplexité française » et la phrase devient fausse dans ce dépôt.
@EXERCISE
Réécris « le SSM est plus intelligent » en une hypothèse falsifiable avec une métrique du dépôt. Par exemple : même forme, causalité conservée, coût linéaire en T.
@BUILD
Le fil rouge du niveau part de cette phrase. Les étapes suivantes la découpent en baseline, ablation, métriques et tableau.
@QUESTION
Laquelle de ces phrases est une hypothèse recevable ici ?
@CORRECT
À tailles égales, hybrid reste causal et de forme (B, T, D)
@WRONG
- Hybrid comprend mieux les textes longs
- Le SSM a gagné un benchmark public
- La mémoire externe raisonne
@EXPLANATION
La première phrase est un assert du dépôt. Les autres demandent des mesures qui n'existent pas.
@@@
@ID 12.2
@TITLE La baseline
@TAG Architecture
@MINUTES 30
@WHY
Sans baseline, une variante n'a pas de sens. La baseline du langage, depuis le niveau 3, est le bigramme, et derrière lui la loi uniforme. La baseline du dos est le kind transformer, pas une absence de modèle.
@OBJECTIVES
- Choisir la baseline la plus simple qui marche
- Garder le même découpage
- Lire bigram_versus_uniform comme modèle du geste
@PREREQ Hypothèse.
@INTUITION
Tu chronomètres un nouveau trajet contre le bus, pas contre « rester chez toi », si la question est de te déplacer. La baseline doit faire la même tâche.
@VOCAB
Baseline : la configuration de référence, nommée. Uniforme : la baseline du bigramme, perplexité V. Transformer : la baseline des autres kinds, parce qu'il est le dos déjà construit au niveau 4. Même découpage : la condition qui empêche de changer les données en même temps que le modèle.
@EXPLAIN
bigram_versus_uniform fixe le découpage avant d'entraîner, observe seulement le train, et compare à vocab_size. C'est le patron. Pour les dos, la baseline est Backbone(kind="transformer") avec les mêmes vocab_size, d_model, n_layers, block_size et seed. Changer la graine en même temps que le kind mélangerait deux causes. Le test utilise seed=3 pour les trois, justement pour ne pas offrir cette excuse. La baseline n'est pas « le meilleur papier de l'année ». Tu ne l'as pas exécutée. Elle est le système le plus simple du dépôt qui fait déjà la tâche.
@LANG python
@CODE
:::
from model.experiment import bigram_versus_uniform
print(bigram_versus_uniform([0, 1, 0, 1, 0, 1, 0, 1], 2)["uniform_perplexity"])
:::
@EXPERIMENT
La valeur est 2, la taille du vocabulaire. C'est la baseline, pas un score à battre à tout prix sur d'autres tâches.
@EXERCISE
Pourquoi ne pas prendre hybrid comme baseline du transformer ? Parce que la baseline doit préexister au changement. Le transformer est construit avant le scan dans le parcours.
@BUILD
Chaque ligne de run_ablation aura un name. L'une d'elles s'appellera baseline, et elle ne bougera pas pendant que tu changes la variante.
@QUESTION
Quelle est la baseline de perplexité du bigramme dans ce dépôt ?
@CORRECT
La loi uniforme, dont la perplexité vaut la taille du vocabulaire
@WRONG
- Un grand modèle téléchargé
- La loss du routeur MoE
- Zéro, si le texte est français
@EXPLANATION
uniform_perplexity renvoie vocab_size. Aucun modèle externe n'est téléchargé.
@@@
@ID 12.3
@TITLE L'ablation
@TAG Architecture
@MINUTES 30
@WHY
Une ablation retire ou remplace une seule pièce. Si tu changes le dos, la graine et la taille en même temps, tu ne sais plus laquelle a fait bouger le nombre.
@OBJECTIVES
- Changer un seul facteur
- Nommer chaque configuration
- Lire run_ablation
@PREREQ Baseline.
@INTUITION
Tu remplaces un ingrédient, tu goûtes, tu remets l'ancien avant d'en changer un autre. Goûter trois changements d'un coup ne t'apprend pas la recette.
@VOCAB
Ablation : un écart d'un seul facteur par rapport à la baseline. Facteur : kind, d_model, n_layers, ou un autre argument explicite. Configuration : le dictionnaire passé à run_ablation, avec un name.
@EXPLAIN
run_ablation exige un name et copie la configuration avant d'appeler la fonction, pour que la fonction ne puisse pas réécrire la liste d'origine par effet de bord. Le test envoie baseline à lr 0,1 et variante à lr 0,2, et vérifie l'ordre des noms ainsi que la baisse de la loss jouet. Dans le fil rouge réel, le facteur intéressant est kind. Une ablation propre lance transformer, puis ssm, puis hybrid, en figeant le reste. Ajouter en même temps un changement de n_layers demande une quatrième ligne, pas un mélange dans la troisième. Les métriques renvoyées doivent être calculées, pas choisies pour que l'histoire tienne.
@LANG python
@CODE
:::
from model.experiment import run_ablation
lignes = run_ablation(
    [{"name": "baseline", "kind": "transformer"}, {"name": "variante", "kind": "ssm"}],
    lambda config: {"kind": config["kind"], "couches": 2},
)
print(lignes[1]["name"], lignes[1]["kind"])
:::
@EXPERIMENT
La deuxième ligne s'appelle variante et porte kind ssm. La fonction n'a pas entraîné de modèle : elle montre seulement que le facteur traverse.
@EXERCISE
Tu veux aussi tester n_layers=4. Combien de lignes minimum pour ne pas confondre les causes ? Trois : baseline, kind seul, profondeur seule. Une quatrième si tu veux le croisement.
@BUILD
Le fil rouge enregistre les ablations par run_ablation. Le tableau du niveau 6 pourra trier les lignes une fois qu'elles auront qualité, secondes et RAM.
@QUESTION
Pourquoi run_ablation copie-t-il chaque configuration avant l'appel ?
@CORRECT
Pour qu'une fonction ne modifie pas la liste des expériences par effet de bord
@WRONG
- Pour entraîner le réseau
- Pour mélanger les graines
- Pour supprimer la baseline
@EXPLANATION
dict(config) isole la ligne. Le test, lui, vérifie que les noms ressortent dans l'ordre.
@@@
@ID 12.4
@TITLE Les métriques
@TAG Architecture
@MINUTES 30
@WHY
Une métrique sans unité est un slogan. Le dépôt en a quelques-unes, précises : perplexité, forme, causalité, octets, FLOPs, score de retrieval. Les mélanger dans une note unique les détruit.
@OBJECTIVES
- Associer une unité à chaque nombre
- Refuser une note unique
- Choisir la métrique qui répond à l'hypothèse
@PREREQ Ablation.
@INTUITION
Des centimètres et des degrés ne se moyennent pas. Une perplexité et un temps non plus. Tu les poses côte à côte, avec leur nom.
@VOCAB
Perplexité : l'effectif du hasard équivalent, sans unité de « qualité morale ». Forme : un tuple d'entiers. Causalité : un booléen de test. Octet : l'unité de parameter_bytes. FLOP : l'opération comptée par attention_flops, une multiplication-addition vaut 2.
@EXPLAIN
L'hypothèse de l'étape 12.1 ne se mesure pas en perplexité française. Elle se mesure par un succès de forme, un succès de causalité, et un entier de FLOPs. La perplexité reste la métrique du bigramme, sur une queue. Le score de retrieve est un cosinus, pas une note de raisonnement. quality_table exige trois colonnes déjà calculées — quality, seconds, ram_bytes — et trie par qualité décroissante puis temps puis RAM. Il ne calcule pas ces colonnes. Si tu y mets des perplexités, documente que « quality » est alors l'opposé de la perplexité, parce que le tri prend la plus grande quality comme meilleure. Oublier ce signe classerait le pire modèle en premier.
@LANG python
@CODE
:::
from model.bench import quality_table
lignes = quality_table([
    {"name": "a", "quality": 1.0, "seconds": 2.0, "ram_bytes": 100},
    {"name": "b", "quality": 1.0, "seconds": 1.0, "ram_bytes": 100},
])
print([ligne["name"] for ligne in lignes])
:::
@EXPERIMENT
À qualité égale, b passe devant a parce qu'il est plus court. Le test du dépôt couvre ce tri.
@EXERCISE
Tu veux classer des perplexités, où plus petit est meilleur. Que mets-tu dans quality ? L'opposé de la perplexité, et tu l'écris à côté du tableau.
@BUILD
Le fil rouge n'invente pas de métrique composite. Chaque étape du parcours a déjà la sienne, et le tableau ne fait que les ranger.
@QUESTION
Que fait quality_table des nombres qu'on lui donne ?
@CORRECT
Il les trie, il ne les mesure pas
@WRONG
- Il entraîne un Transformer
- Il convertit la perplexité en français
- Il prouve la causalité
@EXPLANATION
La fonction exige des colonnes déjà remplies. Le sens de quality — plus grand, meilleur — doit être documenté par toi.
@@@
@ID 12.5
@TITLE Un banc d'essai
@TAG Architecture
@MINUTES 30
@WHY
Un benchmark est un banc fixe : mêmes entrées, mêmes métriques, plusieurs systèmes. Changer le banc en même temps que le système annule la comparaison. Le tien doit tenir sur une machine modeste, puisque c'est le sujet du niveau 6.
@OBJECTIVES
- Fixer les entrées avant les modèles
- Réutiliser les tests comme banc minimal
- Éviter un classement public non rejoué
@PREREQ Métriques.
@INTUITION
La même piste, les mêmes chronomètres, plusieurs coureurs. Changer la piste pour le deuxième coureur ne donne pas un record.
@VOCAB
Banc : le couple entrées + métriques. Entrée fixe : le idx du test, ou le corpus du bigramme. Classement public : un jeu externe, non exécuté ici. Machine modeste : le CPU qui lance pytest, sans GPU requis.
@EXPLAIN
Le banc minimal du dos est celui du test : un batch d'identifiants [[1, 2, 3, 4]], vocabulaire 8, d_model 8, deux couches, block_size 6, graine 3, puis une copie où le dernier token devient 7. La métrique est la forme et l'égalité de la position 0. Le banc du bigramme est une liste d'identifiants, un vocabulaire, et deux perplexités. Le banc du retrieval est trois phrases et une requête. Aucun de ces bancs n'est un classement international. Les citer comme tels serait faux. Les citer comme bancs locaux, rejouables par pytest, est exact. Si tu ajoutes un texte plus long, tu crées un nouveau banc et tu relances toutes les lignes, y compris la baseline.
@LANG python
@CODE
:::
import numpy as np
idx = np.array([[1, 2, 3, 4]])
change = idx.copy()
change[0, -1] = 7
print(idx.tolist(), change.tolist())
:::
@EXPERIMENT
Les deux suites ne diffèrent qu'au dernier token. C'est l'entrée du test de causalité, pas un corpus de français.
@EXERCISE
Tu changes d_model pour un essai. Que dois-tu relancer ? Toutes les configurations, baseline comprise, sur ce nouveau banc.
@BUILD
Le fil rouge publie ses bancs comme des tests, pas comme un tableau de leaders. Le README doit donner la commande pytest, pas un rang.
@QUESTION
Qu'est-ce qui rend ces bancs défendables dans un portfolio ?
@CORRECT
Ils sont petits, fixés, et rejoués par les tests du dépôt
@WRONG
- Ils viennent d'un classement public
- Ils mesurent la compréhension du français
- Ils nécessitent un GPU
@EXPLANATION
pytest relance les mêmes entrées. Aucun téléchargement de benchmark n'est nécessaire.
@@@
@ID 12.6
@TITLE Qualité, latence, mémoire, énergie
@TAG Architecture
@MINUTES 35
@WHY
Un modèle qui gagne sur une colonne peut perdre sur les autres. Le niveau 6 a préparé le tableau. Ici tu l'utilises pour l'architecture, et tu n'inventes pas une colonne énergie que tu ne mesures pas.
@OBJECTIVES
- Remplir quality, seconds, ram_bytes sans tricher
- Distinguer une estimation d'octets et une mesure de temps
- Laisser l'énergie vide si elle n'est pas mesurée
@PREREQ Banc d'essai et bench.py.
@INTUITION
Une voiture plus rapide qui consomme le réservoir en dix minutes n'a pas « gagné » tant que tu n'as pas dit le critère. Tu montres les colonnes et tu laisses le critère explicite.
@VOCAB
Qualité : la colonne que tu as définie, plus grand veut dire meilleur dans le tri. Latence : seconds, un temps mesuré, pas un FLOP. RAM : ram_bytes, souvent une estimation via parameter_bytes. Énergie : absente, faute de capteur dans le dépôt.
@EXPLAIN
parameter_bytes(n, dtype, optimizer) estime des octets, y compris les états Adam si tu passes optimizer="adam". Ce n'est pas une lecture de la RAM du processus. attention_flops estime un volume, pas une durée : la durée dépend de la machine. Si tu mets des FLOPs dans seconds, le nom de colonne ment. Le tri de quality_table départage d'abord par qualité, puis par temps, puis par RAM. L'énergie n'a pas de fonction. Un joule imaginaire n'entre pas dans le tableau. Tu peux écrire « énergie non mesurée » dans le README. Pour les trois kinds, une comparaison honnête sur ce dépôt est : même nombre de couches, qualité de langage non mesurée, causalité oui, et un terme quadratique présent seulement quand la couche est une attention. Le hybrid a donc moins de couches d'attention que le transformer à n_layers égal, pas « moins d'énergie ».
@LANG python
@CODE
:::
from model.bench import parameter_bytes, attention_flops
print(parameter_bytes(1000, "fp32", "adam"))
print(attention_flops(32, 8, 2))
:::
@EXPERIMENT
Adam ajoute 8 octets par paramètre aux 4 octets du fp32, donc 12 000 octets pour 1 000 paramètres. Les FLOPs sont un entier, pas des secondes.
@EXERCISE
Pourquoi ne pas remplir seconds avec attention_flops ? Parce que l'unité n'est pas le temps. Le nom de la colonne deviendrait faux.
@BUILD
Le tableau du fil rouge ne contient que des colonnes que bench.py sait trier, avec des unités écrites à côté. L'énergie reste hors tableau.
@QUESTION
Quelle colonne n'as-tu pas le droit de remplir avec un nombre inventé ?
@CORRECT
L'énergie, parce que le dépôt ne la mesure pas
@WRONG
- La forme de sortie, parce qu'elle est testée
- Le nombre d'octets estimé par parameter_bytes
- Le nom de la configuration
@EXPLANATION
Une estimation d'octets est étiquetée comme estimation. Un joule sans capteur n'est pas une estimation, c'est une invention.
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
Module : une pièce à contrat stable. Contrat du dos : forward(idx) renvoie (B, T, D). Non modulaire ici : le tokenizer, qui n'est pas branché dans Backbone, et l'entraînement complet, qui n'existe pas pour ces dos.
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
hybrid alterne attn et ssm selon la parité de l'index de couche. Avec deux couches, tu as une attention puis un scan, plus les résidus. La sortie a la forme du transformer de mêmes tailles. La causalité tient parce que l'attention du dos est causale et parce que le scan ne lit pas le futur. La justification s'arrête là. Il n'y a pas de courbe d'apprentissage de cette candidate : TinyGPT, lui, a une loss et un entraînement de tête dans d'autres modules, mais pas un entraînement complet du dos hybrid. Présenter hybrid comme « mon architecture » est juste si la phrase suivante dit ce qui est vert : forme, causalité, coût qualitatif des couches. La brique du site s'allume à cette étape, quand cette phrase est possible.
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
Écris la phrase de justification en trois lignes : pièces, tests verts, ce qui n'est pas mesuré. Elle doit tenir sans adjectif de mode.
@BUILD
La brique « Architecture candidate » désigne ce choix de dos. Elle ne désigne pas un modèle hébergé ni un poids à télécharger.
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
test_classifier_loss_decreases vérifie qu'une tête linéaire convexe voit sa loss baisser. C'est un entraînement réel, petit, et compréhensible : le gradient de l'entropie croisée est testé à part contre une différence finie. Le bigramme n'utilise pas de gradient, il compte, et il est comparé à l'uniforme. Le dos hybrid a des poids tirés d'une graine, utilisés en forward, jamais mis à jour par une boucle de ce dépôt. Écrire « j'ai entraîné mon architecture » serait faux. Écrire « j'ai entraîné une tête linéaire et un bigramme, et j'ai laissé le dos à l'initialisation parce que sa rétropropagation complète n'est pas écrite » est exact. La leçon 4.14, plus tôt, a déjà séparé le forward du Transformer et un gradient complet d'attention. Cette étape ne revient pas en arrière.
@LANG python
@CODE
:::
from model.experiment import bigram_versus_uniform
mesure = bigram_versus_uniform([0, 1, 0, 1, 0, 1, 0, 1, 0], 2)
print(sorted(mesure))
:::
@EXPERIMENT
Les clés incluent les deux perplexités et les tailles de découpage. Aucune clé ne dit que le dos hybrid a vu un gradient.
@EXERCISE
Quelle phrase remplace « le modèle est entraîné » dans ton README ? « Le bigramme est estimé par comptage ; la tête linéaire est entraînée par descente ; le dos hybrid est initialisé et seulement exécuté. »
@BUILD
Le fil rouge marque cette limite dans la documentation de la candidate. Un entraînement futur devra ajouter un test de baisse sur une loss définie, pas seulement un forward.
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
@@@
@ID 12.10
@TITLE Analyser un échec
@TAG Architecture
@MINUTES 30
@WHY
Un test rouge, ou une métrique pire que la baseline, est un résultat. Le cacher casse le portfolio plus sûrement qu'un modèle moyen. Analyser, c'est relier l'échec à une cause que tu peux nommer.
@OBJECTIVES
- Traiter une baisse comme une donnée
- Séparer bug et hypothèse fausse
- Relire la causalité avant la qualité
@PREREQ Entraînement limité.
@INTUITION
Le gâteau est plat. Avant de changer de four, tu vérifies que tu as mis la levure. Le bug d'abord, l'hypothèse ensuite, le récit jamais en premier.
@VOCAB
Échec : une métrique pire, ou un assert faux. Bug : le code ne fait pas ce que le commentaire dit. Hypothèse fausse : le code fait ce qui est écrit, et l'effet attendu n'arrive pas. Cause nommable : un facteur de l'ablation.
@EXPLAIN
Si la position 0 change quand tu modifies le dernier token, c'est un bug de masque ou de scan, pas « une architecture créative ». Le test est là pour l'attraper. Si la forme est bonne, la causalité aussi, et qu'un jour une perplexité de hybrid est pire que celle du transformer sur un banc que tu auras ajouté, c'est peut-être l'hypothèse qui tombe : l'alternance ne suffit pas. Tu le notes dans la ligne, tu ne retires pas la ligne. quality_table mettra la meilleure quality en haut, et la baseline restera visible. Un échec d'outillage — énergie vide, français non mesuré — se documente comme limite, pas comme un zéro inventé qui ferait chuter la ligne.
@LANG python
@CODE
:::
from model.bench import quality_table
lignes = quality_table([
    {"name": "baseline", "quality": 0.8, "seconds": 1.0, "ram_bytes": 10},
    {"name": "variante", "quality": 0.5, "seconds": 1.0, "ram_bytes": 10},
])
print(lignes[0]["name"], lignes[1]["name"])
:::
@EXPERIMENT
La baseline reste devant. Effacer la variante parce qu'elle est moins bonne fausserait le tableau : le tri suffit à la placer seconde.
@EXERCISE
La causalité échoue. Que fais-tu avant de conclure que « le SSM oublie trop » ? Tu corriges le bug de fuite du futur, puis tu remesures.
@BUILD
Le fil rouge garde les lignes perdantes. L'analyse tient dans le nom du facteur, pas dans un adjectif.
@QUESTION
Un assert de causalité qui échoue indique d'abord…
@CORRECT
Un bug de fuite du futur, pas une hypothèse de qualité
@WRONG
- Que la variante est plus intelligente
- Que la perplexité uniforme vaut 1
- Qu'il faut supprimer le test
@EXPLANATION
La causalité est un contrat du code. La qualité vient après, sur un banc, quand le contrat tient.
@@@
@ID 12.11
@TITLE Itérer une fois
@TAG Architecture
@MINUTES 25
@WHY
Itérer, c'est changer un facteur après avoir lu une ligne, pas empiler des idées. Une itération tient dans une nouvelle configuration et une nouvelle mesure sur le même banc.
@OBJECTIVES
- Choisir le prochain facteur d'après une colonne
- Garder le banc fixe
- S'arrêter quand la colonne visée ne bouge plus assez
@PREREQ Analyse des échecs.
@INTUITION
Tu changes la quantité de levure, pas la recette, le four et la farine. Tu notes le nouveau gâteau à côté de l'ancien. Puis tu décides si une troisième fournée vaut le temps.
@VOCAB
Itération : une nouvelle ligne, un seul facteur modifié. Banc fixe : les mêmes entrées que la ligne précédente. Gain : la différence sur la colonne que l'hypothèse visait. Arrêt : quand le gain est nul ou que tu sors de ce que le dépôt sait mesurer.
@EXPLAIN
Suppose que transformer et hybrid ont la même forme et la même causalité. La colonne qui peut encore bouger, dans ce dépôt, est le coût d'attention : hybrid exécute moins de couches attn. Une itération recevable est de passer n_layers de 2 à 4 en le figeant pour les deux kinds, et de recalculer les FLOPs d'attention, pas d'ajouter un agent. Une itération non recevable est d'annoncer un gain de français. Le critère d'arrêt est simple : si la seule colonne mesurable ne distingue plus tes choix, tu documentes l'égalité et tu t'arrêtes. Continuer à empiler des kinds ne crée pas une information que le banc ne voit pas.
@LANG python
@CODE
:::
from model.bench import attention_flops
print("2 couches attn", attention_flops(32, 8, 2))
print("1 couche attn", attention_flops(32, 8, 1))
:::
@EXPERIMENT
Passer d'un transformer à deux couches à un hybrid qui n'en garde qu'une divise ce terme par deux, à T et D égaux. C'est un gain de coût, pas de qualité.
@EXERCISE
Quelle itération refuses-tu même si elle sonne bien ? Ajouter un temps interne non codé pour « améliorer le raisonnement ».
@BUILD
Le fil rouge s'autorise une itération seulement quand elle ajoute une ligne sur le même banc. Le README comptera ces lignes, pas les idées écartées.
@QUESTION
Quand t'arrêtes-tu d'itérer sur les kinds ?
@CORRECT
Quand le banc ne distingue plus les choix sur les colonnes que tu sais mesurer
@WRONG
- Quand le README est assez long
- Quand un article annonce mieux
- Après exactement dix modèles
@EXPLANATION
Une itération sans nouvelle mesure sur le banc fixe ne change pas ce que tu sais. L'arrêt fait partie du résultat.
@@@
@ID 12.12
@TITLE Documenter la candidate
@TAG Architecture
@MINUTES 30
@WHY
La dernière étape du parcours est un texte que quelqu'un d'autre peut vérifier. Il dit l'hypothèse, la baseline, les tests verts, les colonnes, et les limites. Il ne dit pas qu'un article a été reproduit.
@OBJECTIVES
- Écrire la fiche de la candidate
- Pointer vers pytest et les modules
- Fermer le parcours sur des faits
@PREREQ Itération.
@INTUITION
Tu laisses sur la maquette une fiche : à quoi elle sert, comment la refaire, ce qu'elle ne porte pas. Un visiteur pressé lit la fiche avant d'admirer les pièces.
@VOCAB
Fiche : un court texte de README ou de modèle. Commande : pytest, qui rejoue les bancs. Limite : entraînement du dos absent, énergie absente, scores d'articles absents. Candidate : le dos interchangeable.
@EXPLAIN
La fiche minimale tient en cinq lignes. Hypothèse : un kind change le mélangeur sans changer la forme. Baseline : transformer, et, pour le langage, le bigramme contre l'uniforme. Preuve : pytest, en particulier les tests de dos, de scan, de patches, de mémoire et d'ablation. Coût : parameter_bytes et attention_flops, avec leurs unités. Limites : pas de rétropropagation complète du dos, pas d'énergie, pas de multimodal natif, pas de chiffres recopiés. Le parcours est réussi, au sens du contrat, si tu peux montrer ces cinq lignes et ouvrir le fichier qui les rend vraies. La brique du site n'ajoute rien à la fiche : elle marque que tu es arrivé à l'étape où la fiche est possible.
@LANG python
@CODE
:::
fiche = [
    "hypothese : kind interchangeable",
    "baseline : transformer et uniforme",
    "preuve : pytest",
    "cout : octets et FLOPs",
    "limites : dos non entraine, energie non mesuree",
]
print(len(fiche))
:::
@EXPERIMENT
Cinq lignes, aucune ne cite un score d'article. Si tu en ajoutes une sixième, elle doit pointer vers un test ou rester dans les limites.
@EXERCISE
Relis ta fiche et barre chaque adjectif qui n'est pas une métrique. Le texte qui reste est celui du README.
@BUILD
Le projet final est cette fiche, branchée sur Backbone et sur les tests. Le parcours s'arrête quand la fiche et le code disent la même chose.
@QUESTION
Que doit contenir la fiche pour que le parcours soit réussi ?
@CORRECT
L'hypothèse, la baseline, les tests, les unités de coût, et les limites non mesurées
@WRONG
- Un classement public
- La promesse d'un modèle entraîné de bout en bout
- Une énergie en joules
@EXPLANATION
Le contrat de sortie demande d'expliquer, de retrouver dans model/, de lancer le test, de dire le coût, et de comparer à une baseline. La fiche est ce contrat en cinq lignes.
