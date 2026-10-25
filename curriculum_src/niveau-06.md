@@@
@ID 6.1
@TITLE Coût des paramètres
@TAG Mesure
@MINUTES 25
@WHY
« Un million de paramètres » ne dit pas si ça tient en mémoire. Il faut convertir le compte en octets, et ne pas oublier l'optimiseur. On convertit le compte dans cette étape.
@OBJECTIVES
- Compter les paramètres d'un modèle
- Convertir en octets selon le dtype
- Ajouter le coût d'Adam
@PREREQ Initialisation et tenseurs.
@INTUITION
Chaque paramètre est un nombre stocké. En float32 il pèse 4 octets, en float16 il en pèse 2. Adam garde en plus deux moyennes, souvent en float32, soit 8 octets de plus.
@VOCAB
dtype : le format du nombre. fp32, fp16, bf16, int8, int4 : 4, 2, 2, 1 et 0,5 octet. Adam : optimiseur à deux états par paramètre. Poids seuls : la mémoire sans optimiseur, celle de l'inférence.
@EXPLAIN
parameter_bytes(1_000_000, "fp16", "adam") vaut 2 Mo de poids plus 8 Mo d'états, soit 10 Mo. L'inférence fp16 sans Adam ne paie que les 2 Mo, plus les activations et le cache, qui ne sont pas dans ce chiffre. parameter_count de TinyGPT compte les tableaux réellement alloués, donc le tying et GQA diminuent le total. On ne compte pas « D * D * couches » de mémoire quand GQA a rétréci wk. Le test du laboratoire vérifie la formule sur un million de paramètres.
@LANG python
@CODE
:::
from model.bench import parameter_bytes
print(parameter_bytes(1_000_000, "fp32", "none"))
print(parameter_bytes(1_000_000, "fp16", "adam"))
:::
@EXPERIMENT
Compare SGD et Adam en fp32 pour 10 millions de paramètres. L'écart doit être 80 Mo, les états Adam.
@EXERCISE
Un modèle de 7 milliards de paramètres en fp16, à l'inférence, pèse environ combien de gigaoctets de poids seuls ? 14 Go, avant cache et activations. Dis ce que ce chiffre ne comprend pas.
@BUILD
model/bench.py est la brique « mesures » du fil rouge. Elle ne prétend pas profiler un GPU : elle rend les ordres de grandeur explicites et testés.
@QUESTION
Les états Adam ajoutent typiquement, par paramètre…
@CORRECT
Environ 8 octets si les moyennes sont en float32
@WRONG
- Zéro, parce que l'optimiseur est gratuit
- La taille du corpus
- Un token de vocabulaire
@EXPLANATION
m et v sont deux flottants 32 bits. Ils dominent souvent la mémoire d'entraînement, plus que les poids fp16 eux-mêmes.
@@@
@ID 6.2
@TITLE RAM et VRAM
@TAG Mesure
@MINUTES 25
@WHY
Le disque peut contenir les poids alors que la carte graphique ne peut pas les charger. L'erreur « out of memory » vise la mémoire de travail, pas le SSD.
@OBJECTIVES
- Distinguer RAM, VRAM et stockage
- Citer trois postes : poids, optimiseur, activations
- Lire une erreur mémoire sans réinstaller au hasard
@PREREQ Coût des paramètres, et l'étape 0.1.
@INTUITION
Le stockage est l'étagère. La VRAM est le plan de travail du GPU. Un poids qui dort sur le disque ne calcule pas. Il doit monter sur le plan de travail, et le plan est petit.
@VOCAB
RAM : mémoire du CPU. VRAM : mémoire du GPU. Activation : un intermédiaire du forward, oublié après, mais présent pendant. OOM : out of memory, plus de place de travail.
@EXPLAIN
Les poids et les états d'Adam occupent la VRAM pendant l'entraînement GPU. Les activations aussi : plus le batch et la fenêtre sont grands, plus elles pèsent. Le cache KV s'y ajoute en génération. Le fichier .npz sur le disque peut être plus petit que la VRAM nécessaire, ou l'inverse si on a quantifié. Devant un OOM, on baisse le batch, la fenêtre, ou on passe en gradient checkpointing, pas on achète du disque. Le niveau 0 avait posé l'image. Ici on la relie aux postes concrets.
@LANG python
@CODE
:::
poids = 2_000_000_000 * 2  # 2 milliards, fp16
adam = 2_000_000_000 * 8
print((poids + adam) / 1024**3, "Go environ")
:::
@EXPERIMENT
Calcule le total pour un modèle de 100 millions de paramètres en fp32 avec Adam. Compare à une machine de 8 Go de RAM : est-ce que les poids seuls tiendraient, et avec Adam ?
@EXERCISE
Une erreur annonce un manque de VRAM, le SSD est à moitié vide. Quel composant est saturé ? Que changeras-tu en premier : le batch, ou un disque plus gros ?
@BUILD
Le fil rouge ne lance pas de gros GPU. Il documente le calcul pour qu'un essai plus tard échoue de façon compréhensible. Les postes sont ceux de parameter_bytes, plus les activations que la formule ne couvre pas encore.
@QUESTION
Un modèle qui « ne rentre pas en VRAM » manque de…
@CORRECT
Mémoire de travail du GPU, pas forcément de stockage
@WRONG
- Place disque, uniquement
- Tokens dans le vocabulaire
- Lignes dans le README
@EXPLANATION
La VRAM est le plan de travail. Le disque peut rester libre pendant que le GPU refuse le chargement.
@@@
@ID 6.3
@TITLE FLOPs
@TAG Mesure
@MINUTES 35
@WHY
Le temps ne se devine pas au nombre de paramètres. Une attention longue est dominée par T², un FFN large par T × D × d_ff. Les FLOPs rendent cette différence chiffrée.
@OBJECTIVES
- Lire la formule d'attention du laboratoire
- Lire celle du FFN
- Comparer l'effet d'allonger T et d'élargir D
@PREREQ Matrices et le bloc Transformer.
@INTUITION
Un FLOP est une opération élémentaire. On compte ici une multiplication-addition comme deux opérations. Ce n'est pas une horloge : c'est un volume de travail, utile pour comparer deux architectures avant de les lancer.
@VOCAB
FLOP : floating point operation. Terme quadratique : T² de l'attention. Terme linéaire : le FFN et les projections. Gated : SwiGLU compte trois matrices au lieu de deux.
@EXPLAIN
attention_flops = n_layers * (8 * T * D * D + 4 * T * T * D). Le 8 T D² couvre Q, K, V et la sortie. Le 4 T² D couvre QKᵀ et AV. ffn_flops compte 2 matrices, ou 3 si la porte SwiGLU est là. Le test vérifie ces formules sur de petits entiers, pour qu'une régression de constante soit visible. Ce compte ignore le masque, le softmax et les normes : ce sont des termes plus petits quand T et D grandissent. On le dit, pour ne pas vendre une précision fausse.
@LANG python
@CODE
:::
from model.bench import attention_flops, ffn_flops
print(attention_flops(128, 64, 2))
print(ffn_flops(128, 64, 256, 2, gated=False))
:::
@EXPERIMENT
Double T et observe le rapport. Puis double D en laissant T fixe. Les deux rapports ne se ressemblent pas : l'un fait grossir le terme carré, l'autre les projections.
@EXERCISE
Pour T=1, que reste-t-il de dominant, le terme T² ou les projections ? À un seul token, T² est petit. En génération du premier token d'un long contexte, T est le passé entier, et le terme carré a déjà été payé lors du préremplissage.
@BUILD
Ces deux fonctions sont le cœur chiffré du niveau 6. Elles alimenteront le tableau qualité / vitesse / RAM.
@QUESTION
Le terme en T² de l'attention vient surtout de…
@CORRECT
Les produits entre requêtes et clés, puis entre poids et valeurs
@WRONG
- La table d'embedding seule
- Le tokenizer caractère
- Le nombre de commits
@EXPLANATION
QKᵀ et AV parcourent toutes les paires de positions. L'embedding, lui, est linéaire en T.
@@@
@ID 6.4
@TITLE Profiler
@TAG Mesure
@MINUTES 25
@WHY
Une formule dit le volume théorique. Un profiler dit où le temps passe vraiment. Les deux se corrigent l'un l'autre. On les fait dialoguer ici.
@OBJECTIVES
- Distinguer temps mural et FLOPs
- Mesurer un petit forward plusieurs fois
- Ne pas conclure sur une seule mesure
@PREREQ FLOPs, étape 6.3.
@INTUITION
La formule ne voit pas un disque lent, un batch trop petit pour remplir le GPU, ni un Python qui passe son temps dans une boucle. L'horloge le voit. L'horloge, seule, ne dit pas si l'algorithme est quadratique.
@VOCAB
Temps mural : l'heure qui passe, pas les FLOPs. Itérations de chauffe : des tours non comptés, pour éviter le premier appel plus lent. Écart-type : la dispersion de plusieurs mesures.
@EXPLAIN
On lance le forward quelques fois sans chronométrer, puis on mesure plusieurs fois et on garde la médiane. Une seule mesure est un anecdote. Sur ce dépôt, les modèles sont minuscules et le temps est dominé par l'interpréteur : les FLOPs restent le bon outil de comparaison, le chronomètre sert à vérifier qu'un cache ne ralentit pas par erreur. Un profiler GPU, plus tard, attribuera le temps aux kernels. On n'en a pas besoin pour lire une formule fausse.
@LANG python
@CODE
:::
import time
import numpy as np
x = np.random.default_rng(0).normal(size=(256, 256))
for _ in range(3):
    x @ x
t0 = time.perf_counter()
for _ in range(10):
    x @ x
print((time.perf_counter() - t0) / 10)
:::
@EXPERIMENT
Relance le chronomètre trois fois. Les durées doivent être du même ordre, pas identiques. Note la médiane, pas le minimum flatteur.
@EXERCISE
Explique un cas où les FLOPs baissent mais le temps monte : un algorithme théoriquement léger, mais qui oblige le GPU à attendre de toutes petites opérations.
@BUILD
Le fil rouge ne ajoute pas de dépendance de profiling. La discipline — plusieurs mesures, médiane, formule à côté — est la brique. Le tableau de l'étape 6.12 accueillera ces chiffres.
@QUESTION
Une seule mesure de temps suffit-elle à classer deux modèles ?
@CORRECT
Non : on garde plusieurs mesures et on se méfie du premier appel
@WRONG
- Oui, si le chiffre a trois décimales
- Oui, parce que les FLOPs sont aléatoires
- Non, parce que le temps n'a aucun rapport avec le code
@EXPLANATION
Le temps bruit. La médiane de plusieurs essais, après chauffe, est le minimum honnête. Les FLOPs restent le complément, pas un ennemi.
@@@
@ID 6.5
@TITLE Batch
@TAG Mesure
@MINUTES 25
@WHY
Augmenter le batch stabilise le gradient et occupe mieux le matériel, mais il grossit les activations et peut forcer à baisser la fenêtre. On mesure ce compromis.
@OBJECTIVES
- Relier batch et mémoire d'activation
- Dire l'effet sur le gradient
- Choisir un batch qui tient
@PREREQ RAM et boucle d'entraînement.
@INTUITION
Traiter 32 exemples d'un coup donne une pente moyenne plus calme qu'un exemple isolé. Ces 32 exemples doivent tous être sur le plan de travail en même temps.
@VOCAB
Batch : le nombre d'exemples du pas. Gradient bruité : celui d'un tout petit batch. Activation : proportionnelle au batch et à T, en première approximation.
@EXPLAIN
La mémoire des poids ne dépend pas du batch. Celle des activations, si. Doubler le batch double ce poste, pas le nombre de paramètres. Un batch de 1 apprend encore, avec un gradient plus agité. Un batch qui déclenche un OOM n'apprend pas du tout. On baisse alors le batch avant de baisser la largeur du modèle, si la qualité voulue tient à la largeur. Le laboratoire teste des batches petits, souvent 1 ou 2, parce que les invariants de forme et de masque n'ont pas besoin de 128.
@LANG python
@CODE
:::
B, T, D = 8, 128, 64
activations_approximatives = B * T * D
print(activations_approximatives)
:::
@EXPERIMENT
Passe B de 8 à 32. Le produit quadruple. Les paramètres, eux, n'ont pas bougé : répète-le dans une phrase.
@EXERCISE
Tu as un OOM en génération, batch déjà à 1. Quel levier reste : la longueur du contexte, pas le batch. Explique.
@BUILD
Les forwards du dépôt acceptent B dans la forme (B, T). Rien n'est codé en dur pour un batch de 1, même si les tests l'utilisent.
@QUESTION
Doubler le batch, à architecture fixe, augmente surtout…
@CORRECT
La mémoire des activations et le coût du pas, pas le nombre de paramètres
@WRONG
- Le nombre de paramètres, qui double aussi
- La taille du vocabulaire
- Uniquement le disque de sauvegarde
@EXPLANATION
Les poids ne dépendent pas du batch. Les activations et le temps du pas, si.
@@@
@ID 6.6
@TITLE Précision mixte
@TAG Mesure
@MINUTES 30
@WHY
Calculer en 16 bits accélère et allège, mais tous les nombres ne supportent pas d'y vivre. La précision mixte garde certains calculs en 32 bits.
@OBJECTIVES
- Distinguer fp32, fp16 et bf16
- Dire où le 16 bits est risqué
- Relier la précision aux octets
@PREREQ Octets des paramètres.
@INTUITION
fp16 a une petite plage : un nombre un peu grand devient infini. bf16 a la plage de fp32 mais moins de précision. On calcule souvent les gros produits en 16 bits et on accumule la loss en 32.
@VOCAB
fp16 : 16 bits, plage limitée. bf16 : 16 bits, exposant de fp32, mantisse courte. Mixed precision : mélanger les formats dans un même pas. Underflow / overflow : nombre trop petit devenu 0, ou trop grand devenu infini.
@EXPLAIN
Les poids fp16 pèsent 2 octets. Un logit trop grand en fp16 sature softmax. On soustrait déjà le max en float64 dans le laboratoire, qui reste en précision confortable pour les tests. En entraînement réel, on garde souvent une copie maîtresse des poids en fp32 et on calcule le forward en fp16 ou bf16. Le dépôt ne simule pas ce ballet : parameter_bytes sait compter les deux formats, et les leçons refusent de traiter « 16 bits » comme un bouton magique sans overflow.
@LANG python
@CODE
:::
from model.bench import parameter_bytes
print(parameter_bytes(1_000_000, "fp32"))
print(parameter_bytes(1_000_000, "bf16"))
:::
@EXPERIMENT
Le second chiffre doit être la moitié du premier. Ajoute Adam : les 8 octets d'états dominent, et l'économie relative du 16 bits diminue.
@EXERCISE
Explique pourquoi une loss en fp16 peut valoir inf alors que la même loss en fp32 est un nombre modéré. Propose quel scalaire garder en 32 bits.
@BUILD
Le laboratoire calcule en float64 pour que les tests soient stables. Le tableau de coûts, lui, parle fp16 et bf16. Les deux choix sont écrits, pas contradictoires : l'un est pédagogique, l'autre est un ordre de grandeur matériel.
@QUESTION
bf16, comparé à fp16, est surtout apprécié parce que…
@CORRECT
Sa plage d'exposant est large, proche de fp32, ce qui déborde moins
@WRONG
- Il occupe 4 octets
- Il supprime le besoin d'un optimiseur
- Il remplace le tokenizer
@EXPLANATION
bf16 sacrifie de la précision fine mais garde de grandes magnitudes. fp16 est plus précis localement et déborde plus vite.
@@@
@ID 6.7
@TITLE Accumulation de gradient
@TAG Mesure
@MINUTES 25
@WHY
On peut simuler un gros batch en additionnant les gradients de plusieurs petits pas, puis en mettant à jour une seule fois. La mémoire ressemble au petit batch, le gradient au gros.
@OBJECTIVES
- Écrire l'accumulation sur plusieurs micro-batches
- Diviser le gradient par le nombre de pas
- Ne pas mettre à jour trop tôt
@PREREQ Batch et backward.
@INTUITION
Tu n'as de place que pour quatre exemples, mais tu veux la pente de seize. Tu calcules quatre pentes de quatre, tu les additionnes, tu divises par quatre, et tu fais un seul pas.
@VOCAB
Micro-batch : le paquet qui tient en mémoire. Accumulation : somme des gradients. Pas effectif : la mise à jour, une fois la somme complète. Échelle : diviser par le nombre de micro-batches pour retrouver la moyenne.
@EXPLAIN
Pendant l'accumulation, on ne remet pas les gradients à zéro entre les micro-batches, et on n'appelle pas l'optimiseur. On zero_grad seulement au début du gros pas, et step à la fin. Oublier la division multiplie le pas effectif par le nombre de micro-batches : c'est comme exploser le learning rate. Le laboratoire n'empile pas ce mécanisme dans TinyGPT, parce que les tests tiennent en un batch. La règle, elle, est assez simple pour être écrite et retenue avant le premier OOM réel.
@LANG python
@CODE
:::
grads = [0.4, 0.2, 0.6, 0.0]
moyen = sum(grads) / len(grads)
lr = 0.1
w = 1.0 - lr * moyen
print(round(moyen, 3), round(w, 3))
:::
@EXPERIMENT
Compare ce pas à quatre pas SGD séparés de lr 0.1 sur les mêmes gradients successifs. Les trajectoires diffèrent : l'accumulation fait un seul pas avec la moyenne, pas quatre petits pas.
@EXERCISE
Tu accumules 8 micro-batches et tu oublies de diviser par 8. Par quel facteur le pas est-il trop grand ?
@BUILD
La boucle de model/train.py met à jour à chaque appel, sans accumulation. Si tu l'étends, le test de baisse de loss devra utiliser le gradient moyen, pas la somme brute.
@QUESTION
L'accumulation de gradient sert à…
@CORRECT
Simuler un plus gros batch sans garder tous les exemples en mémoire
@WRONG
- Augmenter le nombre de paramètres
- Supprimer la loss
- Remplacer le masque causal
@EXPLANATION
On additionne des pentes de petits paquets. Les poids ne deviennent pas plus nombreux.
@@@
@ID 6.8
@TITLE Checkpointing des activations
@TAG Mesure
@MINUTES 25
@WHY
Garder toutes les activations pour le backward coûte cher. En jeter certaines et les recalculer au retour échange de la mémoire contre du temps.
@OBJECTIVES
- Dire ce qu'on jette et ce qu'on recalcule
- Relier le gain mémoire au coût en FLOPs
- Ne pas confondre avec le checkpoint des poids
@PREREQ Backprop et RAM.
@INTUITION
Tu effaces le brouillon d'un calcul, mais tu gardes la donnée de départ. Quand on te demande la pente, tu refais le brouillon. Tu as occupé moins de table, tu as travaillé deux fois.
@VOCAB
Activation checkpointing : ne pas stocker tous les intermédiaires. Recomputation : les refaire pendant le backward. Checkpoint de poids : un fichier .npz ou .pt, tout autre chose.
@EXPLAIN
Le backward a besoin des valeurs du forward. Si on les a jetées, on relance le forward du bloc. La mémoire des activations baisse, le temps augmente, souvent d'une fraction du forward, pas d'un ordre de grandeur. Ce n'est pas le fichier de sauvegarde des poids : les deux portent le même mot anglais et ne se remplacent pas. Le laboratoire garde tout, parce que les tenseurs tiennent dans un test. Le compromis se note dans le tableau : une ligne « avec recomputation » a plus de secondes et moins de RAM.
@LANG python
@CODE
:::
def bloc(x):
    return x * 2

x = 3
y = bloc(x)  # on pourrait oublier y et rappeler bloc(x) plus tard
print(y, bloc(x))
:::
@EXPERIMENT
Les deux valeurs coïncident. Ajoute un compteur dans bloc : le second appel incrémente. C'est le coût que tu paies en échange de ne pas avoir gardé y.
@EXERCISE
Explique la différence, en deux phrases, entre un checkpoint d'activations et un fichier de poids qu'on recharge le lendemain.
@BUILD
Aucune recomputation n'est cachée dans TinyGPT. La leçon sert à lire un article ou un réglage « gradient checkpointing » sans le confondre avec savez.
@QUESTION
Le checkpointing d'activations échange…
@CORRECT
De la mémoire contre du calcul refait pendant le backward
@WRONG
- De la qualité contre un vocabulaire plus petit
- Des poids contre des tokens
- Le test contre le train
@EXPLANATION
On jette des intermédiaires et on les recalcule. Le vocabulaire n'est pas en cause.
@@@
@ID 6.9
@TITLE Quantification
@TAG Mesure
@MINUTES 30
@WHY
Après l'entraînement, on peut stocker les poids en 8 ou 4 bits. La mémoire d'inférence baisse beaucoup. La qualité baisse un peu, et parfois beaucoup si on quantifie n'importe comment.
@OBJECTIVES
- Convertir un nombre de paramètres en int8 et int4
- Dire que l'entraînement n'est pas l'inférence
- Annoncer qu'une mesure avant/après est obligatoire
@PREREQ Octets et perplexité.
@INTUITION
Au lieu de garder beaucoup de décimales, on arrondit les poids sur une échelle grossière. Le modèle tient sur une plus petite machine. Il faut vérifier qu'il n'a pas perdu le fil.
@VOCAB
Quantification : représenter les poids avec moins de bits. int8 : 1 octet. int4 : un demi-octet dans le compte du laboratoire. Échelle : le facteur qui ramène des entiers vers les vrais poids.
@EXPLAIN
parameter_bytes(..., "int8") compte 1 octet par paramètre, "int4" compte 0,5. Ce compte n'inclut pas l'échelle ni les couches qu'on laisse en 16 bits, souvent la norme ou la tête. La quantification après entraînement ne remplace pas l'entraînement : les gradients en 4 bits sont une autre histoire, plus fragile. On compare la perplexité avant et après sur le même test. Un gain mémoire avec une perplexité qui double n'est pas une victoire automatique. Le dépôt ne quantifie pas TinyGPT : il sait compter, et le tableau accueille la ligne.
@LANG python
@CODE
:::
from model.bench import parameter_bytes
n = 7_000_000_000
print(parameter_bytes(n, "fp16") / 1024**3)
print(parameter_bytes(n, "int4") / 1024**3)
:::
@EXPERIMENT
Le rapport entre les deux tailles doit être proche de 4. 14 Go contre 3,5 Go, pour les poids seuls de ce modèle fictif de 7 milliards.
@EXERCISE
Une quantification fait passer la perplexité de 12 à 12,4 et divise la mémoire par 4. Une autre la fait passer à 30. Laquelle gardes-tu, et pourquoi la mémoire seule ne suffit pas ?
@BUILD
BYTES dans model/bench.py inclut int8 et int4. C'est le crochet du fil rouge : la mesure existe, l'algorithme de quantification complet non, et on ne le prétend pas.
@QUESTION
La quantification en int4 vise d'abord…
@CORRECT
À réduire la mémoire des poids à l'inférence, au prix d'une perte de précision à mesurer
@WRONG
- À augmenter la fenêtre sans aucun coût
- À remplacer l'optimiseur Adam pendant l'entraînement, gratuitement
- À supprimer le besoin d'un test
@EXPLANATION
On compresse les poids. La qualité se mesure après. Ce n'est ni une fenêtre magique ni un test optionnel.
@@@
@ID 6.10
@TITLE Distillation
@TAG Mesure
@MINUTES 25
@WHY
Un grand modèle peut servir de professeur à un petit. Le petit n'apprend plus seulement le token cible : il apprend la distribution du grand. On y gagne de la vitesse si la qualité suit.
@OBJECTIVES
- Distinguer la cible one-hot et la cible molle
- Dire ce qu'on espère gagner
- Exiger la même évaluation que pour le professeur
@PREREQ Cross-entropy et coût.
@INTUITION
Au lieu de dire « la réponse est le token 4 », le professeur dit « je mettais 0,6 sur 4, 0,3 sur 8, 0,1 ailleurs ». L'élève imite cette hésitation, pas seulement le bon numéro.
@VOCAB
Distillation : entraîner un élève sur les sorties d'un professeur. Soft targets : la distribution du professeur. Hard target : l'identifiant exact. Élève : le modèle plus petit qu'on veut garder.
@EXPLAIN
La loss peut mélanger la cross-entropy sur le token vrai et une cross-entropy entre la distribution de l'élève et celle du professeur. L'élève a moins de paramètres, donc moins de mémoire et souvent moins de FLOPs. Rien ne garantit qu'il garde la perplexité. On le mesure sur le même test que le professeur, jamais sur le train du professeur seul. Le laboratoire n'entraîne pas cette paire : le comparateur run_ablation du niveau 11 est l'endroit où une ligne « élève » et une ligne « professeur » devront figurer, avec la même métrique.
@LANG python
@CODE
:::
prof = [0.7, 0.2, 0.1]
eleve = [0.6, 0.3, 0.1]
print(sum(prof), sum(eleve))
:::
@EXPERIMENT
Les deux sommes valent 1 : ce sont déjà des distributions. Une cible dure serait [1, 0, 0]. Écris laquelle est plus informative sur le second choix.
@EXERCISE
Cite deux coûts qui doivent baisser chez l'élève pour que la distillation soit utile en pratique, et la métrique qui ne doit pas s'effondrer.
@BUILD
Pas de second modèle distillé dans model/. Le fil rouge note l'idée et prépare la comparaison honnête, plutôt qu'un élève fictif non mesuré.
@QUESTION
En distillation, l'élève apprend notamment…
@CORRECT
La distribution produite par un modèle professeur
@WRONG
- Les poids exacts, copiés case par case, sans entraînement
- Uniquement le nom du professeur
- La taille du disque du professeur
@EXPLANATION
L'élève imite des sorties, pas le nom du fichier. Copier les poids est impossible si les formes diffèrent.
@@@
@ID 6.11
@TITLE CPU et GPU
@TAG Mesure
@MINUTES 25
@WHY
Le GPU accélère les gros produits de matrices. Il n'accélère pas un Python qui décide token après token avec de minuscules tenseurs. Il faut savoir lequel est occupé.
@OBJECTIVES
- Dire ce que le GPU parallélise bien
- Dire ce que le CPU continue de faire
- Éviter de « mettre sur GPU » un calcul trop petit
@PREREQ FLOPs et matériel.
@INTUITION
Le GPU est une salle pleine de calculateurs qui font la même opération sur beaucoup de nombres. S'il n'y a que trois nombres, les faire asseoir prend plus de temps que le calcul.
@VOCAB
CPU : peu de cœurs, bon pour le contrôle et les petits branchements. GPU : beaucoup d'unités pour les produits réguliers. Transfert : copier des données entre RAM et VRAM, ce qui a un coût. Kernel : une opération lancée sur le GPU.
@EXPLAIN
Un produit (4096, 4096) est à l'aise sur GPU. Le tokenizer, la lecture du disque, la boucle Python qui tire un token et décide, restent côté CPU. Transférer un scalaire vers le GPU à chaque pas peut dominer le temps. Le laboratoire tourne en NumPy sur CPU, exprès : les tests vérifient des mathématiques, pas un pilote. Les formules de FLOPs servent ensuite à décider si un GPU vaudrait le déplacement. Un OOM VRAM n'arrive pas sur ce CPU : c'est la RAM qui compte ici.
@LANG python
@CODE
:::
import numpy as np
a = np.ones((512, 512))
b = a @ a
print(b.shape)
:::
@EXPERIMENT
Chronomètre ce produit, puis un produit (8, 8). Le second n'est pas 4096 fois plus rapide que le premier le laisserait croire : le coût fixe du lancement existe, même en NumPy.
@EXERCISE
Pour générer un token à la fois avec un tout petit modèle, explique pourquoi le GPU peut ne rien changer. Cite le transfert et la taille du calcul.
@BUILD
Aucun tensor.cuda() dans le dépôt. Le fil rouge reste exécutable sur une machine de cours. Les mesures de l'étape suivante incluent une colonne « où ça tourne » que tu remplis toi-même : CPU, dans ce projet.
@QUESTION
Le GPU est particulièrement utile pour…
@CORRECT
De gros produits de matrices réguliers
@WRONG
- Décider du prochain if Python token par token, uniquement
- Remplacer le disque
- Garantir une meilleure perplexité
@EXPLANATION
Il parallélise le calcul dense. Il ne rend pas une loss meilleure par sa seule présence, et il n'enlève pas le coût des toutes petites étapes.
@@@
@ID 6.12
@TITLE Inférence locale et tableau
@TAG Mesure
@MINUTES 35
@WHY
Le projet du niveau est un tableau : qualité, temps, mémoire, pour plusieurs réglages. Sans ce tableau, « plus moderne » n'est qu'un adjectif.
@OBJECTIVES
- Remplir des lignes comparables
- Trier par qualité puis par temps
- Refuser une comparaison qui change deux choses à la fois
@PREREQ Toutes les mesures du niveau 6.
@INTUITION
Tu alignes des configurations. Une seule colonne change à la fois quand tu veux conclure. Le tableau trie, il ne décide pas à ta place : une qualité un peu moindre peut valoir beaucoup moins de RAM.
@VOCAB
Inférence : générer ou scorer sans mettre à jour les poids. Ligne : une configuration mesurée. quality_table : le tri du laboratoire, qualité décroissante, puis temps, puis RAM.
@EXPLAIN
Une ligne a un nom, une qualité (par exemple l'inverse de la perplexité, ou une accuracy), un temps et une RAM. quality_table trie d'abord par qualité décroissante. Deux lignes dont la qualité vient de métriques différentes ne se comparent pas. Deux lignes dont l'une a un contexte deux fois plus long non plus, sauf si la question est justement cet allongement. Le test trie « bon » avant « petit » parce que sa qualité est plus haute. L'inférence locale, c'est ce tableau sur ta machine, pas un slogan : le modèle tient, ou non, dans la RAM que tu as mesurée au niveau 0.
@LANG python
@CODE
:::
from model.bench import quality_table
lignes = [
    {"name": "bigramme", "quality": 1.0, "seconds": 0.01, "ram_bytes": 10_000},
    {"name": "mini-gpt", "quality": 1.4, "seconds": 0.2, "ram_bytes": 2_000_000},
]
for ligne in quality_table(lignes):
    print(ligne["name"], ligne["quality"])
:::
@EXPERIMENT
Ajoute une troisième ligne de meilleure qualité mais de RAM énorme. Le tri la met en premier. Écris si tu la choisirais quand même sur une machine de 8 Go.
@EXERCISE
Propose trois lignes honnêtes pour le fil rouge : bigramme, TinyGPT absolu, TinyGPT RoPE. Quelle unique colonne changer entre les deux TinyGPT pour que la comparaison parle de RoPE ?
@BUILD
quality_table ferme le niveau 6. Le composant « mesures » du site pointe ici. Les niveaux suivants, MoE et SSM, devront ajouter une ligne, pas remplacer le tableau.
@QUESTION
Pour attribuer un gain à RoPE, il faut…
@CORRECT
Ne changer que le mode de position entre les deux lignes comparées
@WRONG
- Changer en même temps la profondeur, le vocabulaire et la graine
- Trier uniquement par le nom
- Mesurer la qualité sur deux corpus différents
@EXPLANATION
Une comparaison utile isole un facteur. Le tri n'enlève pas cette obligation.
