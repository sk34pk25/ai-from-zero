@@@
@ID 7.1
@TITLE Qu'est-ce qu'un expert
@TAG MoE
@MINUTES 25
@WHY
Dans ce parcours, un expert n'est pas une personne ni un modèle entier. C'est un FFN parmi d'autres, interchangeable, que le routeur peut choisir.
@OBJECTIVES
- Définir un expert comme un FFN
- Le distinguer d'un modèle séparé
- Voir qu'il transforme un vecteur, pas une phrase seule
@PREREQ Le FFN du niveau 4.
@INTUITION
Au lieu d'un seul atelier pour toutes les positions, on en construit plusieurs. Chacun a ses propres poids. Une position n'entre que dans quelques ateliers, pas dans tous.
@VOCAB
Expert : un FFN avec ses matrices. Spécialisation : ce que l'entraînement fera peut-être apparaître, pas ce qu'on programme. Sortie d'expert : un vecteur de la même dimension que l'entrée.
@EXPLAIN
Dans model/moe.py, un expert a w1, b1, w2, b2 et applique ReLU. Il ne voit pas le texte entier : il voit le vecteur de la position qu'on lui envoie. Rien dans le code ne dit « cet expert est le verbe » ou « cet expert est le code ». Si une spécialisation apparaît, c'est une observation après entraînement, à vérifier, pas une étiquette posée au départ. Confondre expert et « modèle de 7 milliards » rend les articles illisibles.
@LANG python
@CODE
:::
import numpy as np
from model.moe import expert_forward
expert = {
    "w1": np.eye(2),
    "b1": np.zeros(2),
    "w2": np.eye(2),
    "b2": np.zeros(2),
}
print(expert_forward(np.array([1.0, -2.0]), expert))
:::
@EXPERIMENT
ReLU met le -2 à 0, l'identité le laisse. La sortie doit être [1, 0]. Change w2 et observe que l'expert n'est que ces poids.
@EXERCISE
Explique pourquoi deux experts de mêmes formes peuvent quand même calculer des fonctions différentes. Où est la différence : dans les valeurs des poids.
@BUILD
expert_forward est la plus petite brique du MoE. Le routeur n'existe pas encore dans cette leçon : un expert seul est un FFN.
@QUESTION
Dans ce laboratoire, un expert est…
@CORRECT
Un réseau FFN distinct possédant ses propres paramètres
@WRONG
- Une copie du tokenizer du corpus
- Une tête d’attention sans paramètres
- Un document choisi par le retrieval
@EXPLANATION
L'expert est une fonction vectorielle. Le tokenizer et le masque restent partagés, en dehors de lui.
@@@
@ID 7.2
@TITLE Dense et sparse
@TAG MoE
@MINUTES 25
@WHY
Un modèle dense utilise tous ses poids à chaque token. Un modèle sparse n'en active qu'une partie. Le nombre de paramètres et le coût par token se découplent.
@OBJECTIVES
- Opposer dense et sparse
- Relier sparsity et FLOPs par token
- Ne pas confondre paramètres stockés et paramètres utilisés
@PREREQ Expert et FLOPs.
@INTUITION
Une bibliothèque dense te ferait lire tous les livres pour chaque question. Une bibliothèque sparse te fait lire deux livres choisis. Elle peut contenir plus de livres sans allonger chaque visite.
@VOCAB
Dense : tous les poids participent, comme le FFN unique. Sparse : une fraction des experts participe. Paramètres stockés : tous les experts en mémoire. Paramètres actifs : ceux du top-k, ceux qui coûtent du calcul.
@EXPLAIN
Huit experts stockés et un seul actif : la mémoire des poids est celle de huit FFN, le calcul par token est proche d'un seul, plus le petit coût du routeur. C'est le compromis que le tableau du niveau 6 doit rendre visible. Le sparse n'est pas « gratuit » : les poids inactifs occupent quand même la RAM, sauf à les déplacer. Le test du laboratoire construit deux experts et un top-1, et vérifie qui est choisi. Il ne prétend pas qu'un expert inactif disparaît de la mémoire.
@LANG python
@CODE
:::
n_experts, k = 8, 1
print("stockés", n_experts, "actifs par token", k)
:::
@EXPERIMENT
Si chaque expert a 1 million de paramètres, combien sont stockés, combien sont actifs par token en top-1 ? 8 millions stockés, 1 million actif, plus le routeur.
@EXERCISE
Explique pourquoi un MoE peut avoir plus de paramètres qu'un dense et pourtant un coût de calcul proche. Quelle colonne du tableau augmente quand même ?
@BUILD
Le fil rouge remplace le FFN dense par moe_ffn. L'attention, elle, reste dense : le MoE de ce cours est dans le FFN, comme dans les architectures courantes.
@QUESTION
Dans un MoE top-1 à 8 experts, le calcul du FFN par token ressemble surtout à…
@CORRECT
Le calcul d’un expert
@WRONG
- Le calcul des huit experts
- Le calcul d’un huitième d’expert
- Aucun calcul FFN, puisque le routeur le remplace
@EXPLANATION
Top-1 n'active qu'un FFN pour le calcul. Les sept autres restent en mémoire mais ne transforment pas ce token.
@@@
@ID 7.3
@TITLE Le routeur
@TAG MoE
@MINUTES 30
@WHY
Quelqu'un doit choisir l'expert. Le routeur est une petite couche linéaire, suivie d'un softmax, qui donne une probabilité à chaque expert. On l'écrit dans cette étape.
@OBJECTIVES
- Calculer les logits de routage
- Les lire comme une distribution
- Voir que le routeur est un paramètre
@PREREQ Softmax et expert.
@INTUITION
Le routeur regarde le vecteur de la position et dit « plutôt l'atelier 2 ». Il n'est pas une règle écrite à la main. Il s'apprend, et il peut mal s'apprendre en envoyant tout le monde au même endroit.
@VOCAB
Routeur : matrice (D, E). Logit d'expert : le score avant softmax. Probabilité de routage : le softmax de ces scores. E : le nombre d'experts.
@EXPLAIN
logits = x @ router, puis softmax sur les experts. Une ligne uniforme veut dire « je ne sais pas ». Une ligne piquée veut dire « je suis sûr ». Le laboratoire teste les deux : une perte d'équilibrage vaut environ 1 si le routeur est uniforme et les choix sont répartis, et vaut E s'il s'effondre sur un expert avec probabilité 1. Le routeur n'est pas l'expert : il ne transforme pas le contenu, il choisit.
@LANG python
@CODE
:::
import numpy as np
from model.mathutil import softmax
x = np.array([[1.0, 0.0]])
routeur = np.array([[2.0, 0.0], [2.0, 0.0]])
print(softmax(x @ routeur).round(3))
:::
@EXPERIMENT
La masse doit pencher vers le premier expert. Remplace la première colonne par des zéros et observe une distribution plus plate.
@EXERCISE
Pour E=4 et un vecteur de logits [0, 0, 0, 0], quelles sont les quatre probabilités ? 0,25 chacune.
@BUILD
moe_ffn multiplie par le routeur avant de choisir le top-k. La brique « Mixture of Experts » du site s'appuie sur cette fonction.
@QUESTION
Le routeur produit quoi pour chaque expert ?
@CORRECT
Des scores puis des probabilités
@WRONG
- Un identifiant de token suivant
- Les poids complets de chaque FFN
- Un masque causal sur les positions
@EXPLANATION
Sa sortie est une distribution sur E experts. Elle ne décode pas le texte.
@@@
@ID 7.4
@TITLE Top-k
@TAG MoE
@MINUTES 30
@WHY
On ne mélange pas tous les experts : ce serait redevenir dense. Top-k garde les k meilleurs scores et renormalise seulement sur eux. On code ce choix top-k.
@OBJECTIVES
- Choisir les k meilleurs experts
- Renormaliser leurs portes
- Voir le cas k=1
@PREREQ Routeur, étape 7.3.
@INTUITION
Tu consultes les deux meilleurs avis, pas les vingt. Leurs poids relatifs sont recalculés pour sommer à 1 entre eux, sinon une partie de la masse resterait sur les experts ignorés.
@VOCAB
Top-k : les k indices de plus forts logits. Porte : le poids, après softmax restreint. k=1 : un seul expert, la porte vaut 1.
@EXPLAIN
moe_ffn prend les k plus grands logits, applique softmax sur ce sous-ensemble, et somme les sorties d'experts pondérées. Pour k=1, la sortie d'un token est celle de l'expert choisi, s'il n'a pas été refusé pour capacité. Le test avec un routeur très penché vérifie que tous les tokens choisissent l'expert 0. Prendre k=E reviendrait à un mélange dense, plus cher. k est un hyperparamètre : 1 ou 2 sont les valeurs usuelles, pas une loi.
@LANG python
@CODE
:::
import numpy as np
logits = np.array([0.1, 2.0, 1.5, -3.0])
k = 2
choix = np.argsort(-logits)[:k]
print(choix)
:::
@EXPERIMENT
Les indices 1 et 2 doivent sortir, dans cet ordre. Ajoute un logit égal à 2.0 et décide d'un départage stable : le laboratoire trie après argpartition.
@EXERCISE
Si k=1 et que l'expert 3 est choisi, quelle est sa porte après renormalisation ? 1. La sortie du token est exactement la sortie de cet expert, capacité allowing.
@BUILD
Le composant MoE du fil rouge se débloque à cette étape, parce que top-k est le geste qui rend le FFN sparse. La fonction est moe_ffn.
@QUESTION
Après le top-k, les portes des experts retenus…
@CORRECT
Somment à 1 après renormalisation
@WRONG
- Conservent toujours leur somme avant sélection
- Deviennent toutes exactement égales
- Sont remplacées par les nombres de tokens reçus
@EXPLANATION
On refait un softmax sur le sous-ensemble. Les experts écartés ne gardent pas de probabilité résiduelle dans ce mélange.
@@@
@ID 7.5
@TITLE Capacité
@TAG MoE
@MINUTES 30
@WHY
Si tous les tokens choisissent le même expert, cet expert doit les traiter tous et le gain sparse disparaît. La capacité limite le nombre de tokens par expert.
@OBJECTIVES
- Calculer une capacité
- Compter les tokens refusés
- Dire ce que devient un token refusé
@PREREQ Top-k, étape 7.4.
@INTUITION
L'atelier n'a que quatre places. Le cinquième client, même s'il voulait cet atelier, est renvoyé. Mieux vaut un calcul borné qu'un expert qui reçoit toute la file.
@VOCAB
Capacité : nombre maximal de tokens acceptés par un expert. capacity_factor : multiplicateur, souvent un peu au-dessus de 1. Token dropped : un token refusé, dont la contribution d'expert reste nulle dans notre code.
@EXPLAIN
capacité = ceil(capacity_factor * T / E), au moins 1. Avec T=4, E=2 et un facteur 0,1, la capacité tombe à 1. Si tout le monde veut l'expert 0, un token passe et les autres sont comptés dans dropped. Le test tight["dropped"] > 0 vérifie ce refus. Un token refusé ne passe pas en secret par tous les experts : sa sortie d'expert reste 0 dans cette implémentation. D'autres systèmes le renvoient vers un expert résiduel. On documente le choix du laboratoire plutôt que de le cacher.
@LANG python
@CODE
:::
import math
T, E, factor = 4, 2, 0.1
print(max(1, math.ceil(factor * T / E)))
:::
@EXPERIMENT
La capacité affichée vaut 1. Avec factor=4, elle doit dépasser T/E et les drops du test routé doivent tomber à 0.
@EXERCISE
Pour 128 tokens et 8 experts, facteur 1,25, quelle capacité par expert ? ceil(1,25 * 16) = 20. Combien de tokens au maximum sont traités si tous visent le même expert ? 20, pas 128.
@BUILD
Le champ dropped de moe_ffn est la mesure. Une capacité qui droppe la moitié des tokens est un réglage à corriger, pas une performance.
@QUESTION
La capacité limite quoi, pour un expert ?
@CORRECT
Le nombre de tokens qu’il peut recevoir dans un lot
@WRONG
- Le nombre de paramètres de son FFN
- La longueur du vocabulaire partagé
- Le nombre de couches dans le routeur
@EXPLANATION
C'est un quota par expert. Le vocabulaire n'entre pas dans cette formule.
@@@
@ID 7.6
@TITLE Équilibrage de charge
@TAG MoE
@MINUTES 25
@WHY
Un routeur qui envoie tout au même expert gaspille les autres. L'équilibrage se mesure avant de se corriger. Sinon on ne sait pas ce que la loss répare.
@OBJECTIVES
- Calculer la fraction de tokens par expert
- La distinguer de la probabilité moyenne du routeur
- Reconnaître un effondrement
@PREREQ Capacité, étape 7.5.
@INTUITION
Tu comptes combien de clients entrent vraiment dans chaque atelier, et tu regardes aussi ce que le routeur disait vouloir. Les deux peuvent diverger si la capacité refuse du monde.
@VOCAB
Fraction f_i : part des tokens dont le premier choix est i. Probabilité moyenne P_i : moyenne des softmax du routeur pour i. Effondrement : un expert reçoit presque tout.
@EXPLAIN
f vient des décisions, P vient des probabilités. Si le routeur est sûr et toujours d'accord sur l'expert 0, f et P valent environ [1, 0, …]. Si le routeur est uniforme mais que les choix se répartissent, les deux sont plats. La capacité peut faire que f réel, après refus, diffère du premier choix. Le laboratoire calcule la perte sur le premier choix avant drop, pour juger le routeur lui-même. Un histogramme des choix sur un batch est la mesure la plus lisible : une barre à 100 % est un échec d'équilibre.
@LANG python
@CODE
:::
import numpy as np
choix = np.array([0, 0, 1, 0])
print(np.bincount(choix, minlength=2) / len(choix))
:::
@EXPERIMENT
La fraction doit valoir [0.75, 0.25]. Remplace les choix par [0, 0, 0, 0] et conclus à l'effondrement.
@EXERCISE
Donne un exemple où P est uniforme mais où, à cause d'un argmax qui départage toujours vers 0, f n'est pas uniforme. Pourquoi un départage stable ne suffit pas à équilibrer ?
@BUILD
load_balance_loss utilise f et P. L'étape suivante en fait une loss. Ici, on apprend à les lire.
@QUESTION
La fraction f_i compte quoi, exactement ?
@CORRECT
La part des tokens envoyés à i
@WRONG
- La probabilité moyenne attribuée à i
- Le nombre de poids de l’expert i
- La loss de langage moyenne de l’expert i
@EXPLANATION
C'est une statistique de routage, la part des tokens envoyés à un expert, pas une taille de matrice.
@@@
@ID 7.7
@TITLE Perte auxiliaire
@TAG MoE
@MINUTES 30
@WHY
Mesurer l'effondrement ne le corrige pas. Une loss auxiliaire, ajoutée à la loss de langage, pousse le routeur à utiliser les experts. On l'ajoute comme terme séparé.
@OBJECTIVES
- Écrire L = E * somme(f_i P_i)
- Connaître sa valeur quand tout va bien et quand tout s'effondre
- Ne pas la confondre avec la cross-entropy
@PREREQ Équilibrage, étape 7.6.
@INTUITION
Si le routeur est sûr et monotone, le produit f_i P_i est grand. Si les tokens et les probabilités se répartissent, le produit reste petit. On ajoute ce nombre à la loss pour que l'entraînement le diminue.
@VOCAB
Perte auxiliaire : un terme en plus de la loss principale. Switch : la formule E * somme(f P), qui vaut 1 lorsque f et P sont uniformes ; c'est une référence, pas un minimum universel. Coefficient : le poids de ce terme, pour ne pas écraser la loss de langage.
@EXPLAIN
Quand f = P = 1/E, la somme des produits vaut 1/E et multiplier par E donne 1. Quand tout est sur un expert et que le routeur en est sûr, la loss vaut E. Le test vérifie 2 pour E=2 effondré, et 1 pour un cas uniforme. Attention : f vient des choix discrets, P des probabilités moyennes. Leur produit peut donner moins de 1. Avec les lignes (0.51, 0.49), (0.51, 0.49), (0.01, 0.99), l'argmax choisit les experts 0, 0, 1 et la loss vaut environ 0.8956. La référence uniforme n'est donc pas une borne inférieure générale.

Cette loss ne remplace pas la cross-entropy : un routeur parfaitement équilibré qui prédit mal les tokens est inutile. On pondère le terme auxiliaire par un petit coefficient. Le laboratoire renvoie aux dans le dictionnaire de moe_ffn, sans l'ajouter tout seul à une loss de langue : l'appelant décide du coefficient.
@LANG python
@CODE
:::
import numpy as np
from model.moe import load_balance_loss
uniforme = np.full((4, 2), 0.5)
print(load_balance_loss(uniforme, np.array([0, 1, 0, 1])))
probas = np.array([[0.51, 0.49], [0.51, 0.49], [0.01, 0.99]])
aux = load_balance_loss(probas, probas.argmax(axis=1))
print(round(aux, 4))
assert 0 < aux < 1  # 1 n'est pas une borne inférieure générale.
:::
@EXPERIMENT
Les résultats sont 1 pour le cas uniforme et environ 0.8956 pour le contre-exemple. Calcule f et P de ce dernier à la main. Construis ensuite un cas effondré sur 2 experts et vérifie que tu obtiens 2.
@EXERCISE
Pourquoi un coefficient trop grand sur cette loss peut-il dégrader la perplexité même si les experts sont bien remplis ?
@BUILD
aux est la brique testée. Le fil rouge ne cache pas un coefficient magique : il est absent tant que tu ne l'écris pas dans la loss totale.
@QUESTION
Lorsque f et P sont uniformes, la perte auxiliaire du laboratoire vaut…
@CORRECT
1, une valeur de référence
@WRONG
- 0, car les experts sont équilibrés
- Le nombre d’experts, sans normalisation
- La capacité maximale d’un expert
@EXPLANATION
E * somme((1/E)*(1/E)) = 1. L'effondrement certain donne E, mais d'autres probabilités valides peuvent donner moins de 1, comme le montre le contre-exemple.
@@@
@ID 7.8
@TITLE Parallélisme des experts
@TAG MoE
@MINUTES 25
@WHY
Les experts peuvent vivre sur des machines différentes. Ce gain n'existe que si le routage n'oblige pas chacun à attendre le même expert. On le dit sans le simuler sur plusieurs machines.
@OBJECTIVES
- Dire ce qu'on peut placer sur deux GPU
- Relier capacité et équilibre à ce placement
- Ne pas confondre parallélisme et top-k
@PREREQ Capacité et coût mémoire.
@INTUITION
Deux ateliers dans deux pièces travaillent en même temps si les clients se répartissent. Si tout le monde entre dans la pièce A, la pièce B attend et tu as payé deux loyers pour un seul travail.
@VOCAB
Parallélisme d'experts : répartir les experts sur plusieurs accélérateurs. Communication : envoyer les tokens vers la machine qui tient l'expert choisi. Déséquilibre : une machine surchargée, l'autre idle.
@EXPLAIN
Placer un expert par GPU permet de stocker plus de poids que sur une seule carte. Le token doit alors voyager vers la carte de son expert, et le résultat revenir. Ce transfert coûte. Il est amorti si chaque carte reçoit du travail. Un routage effondré annule le bénéfice : une carte calcule, les autres gardent des poids froids. Le laboratoire tourne sur un seul processus NumPy : il n'ouvre pas de communication réseau. Il rend visible, via dropped et la fraction f, le déséquilibre qui rendrait un parallélisme inutile.
@LANG python
@CODE
:::
tokens_par_expert = [100, 2]
print("déséquilibre", max(tokens_par_expert) / sum(tokens_par_expert))
:::
@EXPERIMENT
Le ratio est proche de 1 : presque tout le travail est sur le premier expert. Un deuxième GPU pour le second expert ne calculerait presque rien.
@EXERCISE
Propose une répartition de 128 tokens sur 4 experts qui occuperait également 4 GPU. Quelle fraction f_i idéale ?
@BUILD
Pas de librairie multi-GPU dans le dépôt. La leçon empêche de vendre le MoE comme un accélérateur automatique.
@QUESTION
Le parallélisme d'experts est utile si…
@CORRECT
Les tokens chargent réellement plusieurs machines porteuses d’experts
@WRONG
- Tous les tokens vont toujours au même expert
- Les experts partagent une seule machine saturée
- Le nombre d’experts remplace le masque causal
@EXPLANATION
Sans répartition, les machines supplémentaires stockent des poids inactifs. Le routeur reste indispensable.
@@@
@ID 7.9
@TITLE Mémoire et calcul
@TAG MoE
@MINUTES 30
@WHY
Le projet du niveau est de remplacer le FFN par un MoE et de dire, en une ligne de tableau, ce qu'on a gagné et ce qu'on a payé. On écrit cette ligne de tableau.
@OBJECTIVES
- Comparer paramètres stockés et FLOPs actifs
- Inclure les drops dans le jugement
- Ajouter une ligne au tableau du niveau 6
@PREREQ Tout le niveau 7.
@INTUITION
Tu as échangé un atelier contre plusieurs, dont un ou deux travaillent. La note de qualité n'a le droit de monter que si la loss de langage suit. La note de mémoire, elle, a probablement monté.
@VOCAB
Compromis : plus de paramètres stockés, un calcul par token proche du dense de départ, un risque de déséquilibre. Ligne de tableau : qualité, temps, RAM, plus la colonne dropped.
@EXPLAIN
Un FFN dense 4D et un MoE de 4 experts top-1 de même largeur : le calcul du FFN par token reste du même ordre, la mémoire des poids est multipliée par environ 4, plus le routeur. Si la perplexité ne baisse pas, tu as surtout alourdi le modèle. Si elle baisse et que dropped reste faible, le compromis est intéressant. quality_table peut recevoir ces lignes, à condition que la qualité soit la même métrique. Le test de moe_ffn vérifie la forme, le choix d'expert et les drops. Il ne prétend pas qu'un MoE non entraîné est plus intelligent qu'un FFN.
@LANG python
@CODE
:::
dense_params = 4
moe_params = 4 * 4  # quatre experts de même taille, ordre de grandeur
flops_par_token = 1  # top-1 : un expert actif
print(dense_params, moe_params, flops_par_token)
:::
@EXPERIMENT
Ajoute le routeur, négligeable si E est petit devant D. Écris la phrase : la RAM suit moe_params, les FLOPs suivent flops_par_token.
@EXERCISE
Deux lignes : dense perplexité 20 RAM 1, MoE perplexité 20 RAM 4. Lequel choisis-tu pour une machine juste, et lequel si la perplexité du MoE passait à 15 ?
@BUILD
moe_ffn remplace le FFN dans le fil rouge conceptuel. L'attention n'est pas remplacée. Le tableau du niveau 6 gagne une ligne, pas un nouveau mythe.
@QUESTION
Remplacer le FFN par un MoE top-1 de plusieurs experts de même taille…
@CORRECT
Accroît surtout les poids stockés
@WRONG
- Multiplie le FFN par tous les experts à chaque token
- Divise tous les poids stockés par le nombre d’experts
- Garantit une amélioration de la loss sans entraînement
@EXPLANATION
On stocke tous les experts et on en calcule un. La perplexité n'est pas un cadeau automatique, et la RAM monte.
