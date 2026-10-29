@@@
@ID 3.1
@TITLE Prédire le token suivant
@TAG Langage
@MINUTES 30
@WHY
Tout le modèle de langage du parcours tient dans une tâche : étant donné le passé, donner une distribution sur le token d'après. Le reste est une façon plus riche de lire ce passé.
@OBJECTIVES
- Formuler la tâche next-token
- Relier contexte, modèle et logits
- Voir qu'une cible est un identifiant, pas une phrase
@PREREQ Batches, étape 2.11.
@INTUITION
On cache le mot suivant et on demande au modèle de le deviner, encore et encore, à chaque position. Il n'a pas à « comprendre » au sens scolaire. Il doit mettre de la probabilité au bon endroit.
@VOCAB
Autoregressif : le modèle produit la suite élément par élément, en réutilisant ce qu'il vient de produire. Contexte : les tokens déjà connus. Cible : l'identifiant du token suivant.
@EXPLAIN
À la position t, l'entrée autorisée est tout ce qui est avant t, ou jusqu'à t si le token courant sert de condition bigramme. La sortie est un vecteur de scores, un par unité du vocabulaire. La cible est un entier. On ne compare pas deux phrases avec une distance vague : on mesure la probabilité que le modèle donnait au bon entier. Cette tâche unique suffit à entraîner un bigramme comme un Transformer. Ce qui change, c'est la quantité de passé utilisée.
@LANG python
@CODE
:::
contexte = [1, 4, 7]
# Le modèle rendra un score par token possible.
# La cible est l'entier du token qui suit vraiment.
cible = 2
print(contexte, cible)
:::
@EXPERIMENT
Dans le corpus du dépôt, choisis une position au milieu d'une phrase et écris à la main trois continuations plausibles. Tu viens de faire, sans chiffre, le travail que la distribution fera.
@EXERCISE
Pour la séquence [5, 5, 8, 5], liste les trois couples (contexte immédiat, cible) d'un bigramme. Le premier couple est (5, 5).
@BUILD
L'interface du fil rouge est forward(tokens) -> logits. TinyGPT.forward la réalise avec la forme (B, T, V). Le bigramme est le cas où V scores ne dépendent que du dernier token.
@QUESTION
La cible d'un pas next-token est…
@CORRECT
L'identifiant du token qui suit le contexte
@WRONG
- Une phrase déjà traduite en français
- Le learning rate
- La norme du vecteur d'embedding
@EXPLANATION
On supervise un entier du vocabulaire. La phrase lisible n'existe qu'après décodage.
@@@
@ID 3.2
@TITLE Le bigramme
@TAG Langage
@MINUTES 40
@WHY
Le bigramme est la baseline. Il est faible, mais il est juste : on peut le calculer, le tester, et tout modèle plus cher devra le battre pour justifier son coût.
@OBJECTIVES
- Remplir une table de comptes
- Lire une ligne comme une distribution
- Comparer sa perplexité à celle du hasard
@PREREQ Next-token, étape 3.1.
@INTUITION
Le bigramme dit : pour deviner la suite, je ne regarde que le token courant. Si après « le » j'ai souvent vu « chat », la ligne de « le » donne beaucoup de masse à « chat ». Tout le reste du passé est ignoré.
@VOCAB
Bigramme : une paire de tokens successifs. Table de comptes : matrice V par V. Lissage : ajouter alpha à chaque case pour éviter les zéros. Baseline : le modèle simple contre lequel on se compare.
@EXPLAIN
BigramModel commence avec alpha dans chaque case, par défaut 1. Chaque paire observée incrémente une case. La probabilité de b après a est la case (a, b) divisée par la somme de la ligne a. Sur la séquence 0,1,0,1,… la probabilité de 1 après 0 dépasse 0,8, et la perplexité descend sous celle du hasard, qui vaut V. Le test test_bigram_beats_uniform_and_samples vérifie ces deux faits. Un Transformer qui ne bat pas ce chiffre sur les mêmes données n'a pas gagné le droit d'être plus compliqué.
@LANG python
@CODE
:::
from model.bigram import BigramModel
ids = [0, 1, 0, 1, 0, 1]
modele = BigramModel(2)
modele.observe(ids)
print(modele.probabilities().round(3))
:::
@EXPERIMENT
Observe la séquence ci-dessus et lis la ligne 0. Elle doit favoriser 1. Ajoute beaucoup de paires (0, 0) et regarde la ligne basculer.
@EXERCISE
Avec V=3 et la séquence [0, 2, 0, 2], calcule à la main la probabilité lissée (alpha=1) de 2 après 0. Les comptes bruts de la ligne 0 sont une visite vers 2, deux fois, plus 1 partout : case (0,2) = 3, somme de ligne = 1+1+3 = 5, probabilité 3/5.
@BUILD
model/bigram.py est cette brique, débloquée ici. python -m model l'entraîne sur le corpus et imprime une courte génération.
@QUESTION
Un bigramme prédit le token suivant à partir de…
@CORRECT
Uniquement le token courant
@WRONG
- Toute la phrase, comme l'attention
- La loss de validation seule
- Le nom du fichier
@EXPLANATION
La ligne de la matrice ne dépend que de l'identifiant présent. C'est sa force (simplicité) et sa limite (pas de contexte long).
@@@
@ID 3.3
@TITLE Contexte
@TAG Langage
@MINUTES 30
@WHY
Le bigramme échoue dès que le bon token dépend de plus loin que le voisin. Le contexte est la quantité de passé qu'on accepte de regarder. On le borne ici.
@OBJECTIVES
- Définir block_size
- Construire une fenêtre et sa cible décalée
- Donner un exemple où un seul token ne suffit pas
@PREREQ Bigramme, étape 3.2.
@INTUITION
« banque » après « je dépose à la » n'a pas le même sens qu'après « assis sur la ». Le dernier mot est le même. Il faut le passé.
@VOCAB
Contexte : les tokens fournis au modèle. block_size : la longueur maximale de ce contexte. Fenêtre glissante : un extrait qui avance d'un cran. Horizon : jusqu'où le modèle a le droit de regarder.
@EXPLAIN
Une fenêtre x = ids[i:i+T] et une cible y = ids[i+1:i+1+T] apprennent, à chaque place, à prédire la suivante à partir de ce qui est à gauche. T est un compromis : trop court, on reste myope ; trop long, l'attention coûte le carré de T. Le bigramme est le cas T utile = 1. Le Transformer du laboratoire refuse T plus grand que block_size, parce que les positions absolues n'existent pas au-delà. Ce n'est pas une limite de la langue, c'est une limite du modèle qu'on a alloué.
@LANG python
@CODE
:::
ids = [10, 11, 12, 13, 14]
T = 3
x = ids[0:T]
y = ids[1:T + 1]
print(x, y)
:::
@EXPERIMENT
Trouve dans une phrase française un mot dont le sens change selon un mot situé trois places plus tôt. Écris pourquoi un bigramme rate ce cas.
@EXERCISE
Pour ids = [4, 4, 9, 4] et T = 2, écris toutes les fenêtres x et y possibles sans sortir de la liste.
@BUILD
GPTConfig.block_size est ce plafond. Le forward lève ValueError au-delà. Le test de cache utilise une séquence de longueur 5, sous le plafond de 8.
@QUESTION
block_size désigne quelle limite de contexte ?
@CORRECT
La longueur maximale de contexte que le modèle accepte
@WRONG
- La taille du disque
- Le nombre de commits
- La valeur de la loss
@EXPLANATION
C'est un hyperparamètre de longueur. Il borne la fenêtre, il ne mesure pas l'erreur.
@@@
@ID 3.4
@TITLE Logits
@TAG Langage
@MINUTES 25
@WHY
La sortie brute du modèle n'est pas une probabilité. Ce sont des logits : des scores libres, positifs ou négatifs. Les traiter comme des probabilités fausse la génération et la loss.
@OBJECTIVES
- Définir un logit
- Lire la forme (B, T, V)
- Expliquer pourquoi un logit peut être négatif
@PREREQ Contexte, étape 3.3.
@INTUITION
Un logit est une note avant la conversion en pourcentages. Une note négative ne veut pas dire « impossible ». Elle veut dire « moins que les autres », tant qu'on n'a pas normalisé.
@VOCAB
Logit : score brut, non normalisé. Axe V : l'axe du vocabulaire. Stabilité : soustraire le max avant exp, pour ne pas déborder.
@EXPLAIN
Pour un batch de 1, un temps de 4 et un vocabulaire de 12, les logits ont la forme (1, 4, 12). La case [0, 2, 7] est le score du token 7 à la position 2. Rien n'oblige ce score à être entre 0 et 1. Softmax s'en chargera. Numériquement, exp(1000) explose : on soustrait le maximum des logits avant l'exponentielle. Le classement ne change pas, parce qu'on a soustrait la même constante à toute la ligne. model/mathutil.py fait cette soustraction dans softmax.
@LANG python
@CODE
:::
import numpy as np
logits = np.array([1.2, -0.3, 2.1])
print(logits.shape, logits.min())
:::
@EXPERIMENT
Ajoute 10 à tous les logits et vérifie que leur ordre ne change pas. Softmax devra donner les mêmes probabilités : tu le vérifieras à l'étape suivante.
@EXERCISE
Pour des logits de forme (2, 5, 20), dis combien de scores il y a au total, et ce que représente le 20.
@BUILD
TinyGPT.forward renvoie ces logits. Le test d'égalité entre deux modèles de même graine compare ce tableau, pas du texte généré.
@QUESTION
Un logit, avant le softmax, désigne quoi ?
@CORRECT
Un score brut, avant conversion en probabilité
@WRONG
- Une probabilité déjà entre 0 et 1
- Un identifiant de token
- Un octet UTF-8
@EXPLANATION
Le logit est libre de signe et d'échelle. La probabilité viendra de softmax.
@@@
@ID 3.5
@TITLE Softmax
@TAG Langage
@MINUTES 30
@WHY
Softmax est le pont entre les scores et une distribution. Sans lui, on ne peut ni échantillonner ni définir la cross-entropy proprement. On l'écrit dans cette étape.
@OBJECTIVES
- Calculer un softmax stable
- Vérifier que le résultat somme à 1
- Voir l'effet d'ajouter une constante
@PREREQ Logits et probabilités, étapes 3.4 et 0.19.
@INTUITION
On passe les scores à l'exponentielle pour les rendre positifs, puis on divise par la somme pour que le total fasse 1. Le plus grand score devient la plus grande probabilité, sans écraser systématiquement les autres.
@VOCAB
Softmax : exp(z_i) / somme exp(z_j). Stabilité numérique : soustraire max(z) avant exp. Température : un diviseur des logits, qui viendra à l'étape 3.7.
@EXPLAIN
softmax([1, 2, 3]) donne trois nombres positifs qui somment à 1, le dernier étant le plus grand. softmax([1, 2, 3] + 10) donne la même chose. C'est pour cela que les logits n'ont pas d'origine absolue : seul leur écart compte. Si un score dépasse les autres de beaucoup, sa probabilité approche 1. Si tous les scores sont égaux, la distribution est uniforme, et la cross-entropy vaut log(V). Le test test_uniform_cross_entropy_is_log_vocab utilise des logits nuls pour ce cas.
@LANG python
@CODE
:::
import numpy as np
from model.mathutil import softmax
p = softmax(np.array([1.0, 2.0, 3.0]))
print(p.round(3), p.sum())
:::
@EXPERIMENT
Compare softmax de [1, 2, 3] et de [11, 12, 13]. Les probabilités doivent coïncider à l'arrondi près. Puis essaie [5, 0, 0] et observe la masse sur la première case.
@EXERCISE
Pour deux logits égaux, donne les deux probabilités sans calculatrice. Elles valent 0,5 et 0,5. Vérifie avec la fonction.
@BUILD
softmax est dans model/mathutil.py et sert au bigramme échantillonné, à la loss, au routeur MoE. Un seul code, plusieurs usages : c'est voulu.
@QUESTION
Après softmax, la somme des sorties sur l'axe du vocabulaire vaut…
@CORRECT
1, aux erreurs d'arrondi près
@WRONG
- 0
- Le plus grand logit
- La taille du batch
@EXPLANATION
La division par la somme des exponentielles fabrique une distribution. La somme vaut donc 1.
@@@
@ID 3.6
@TITLE Cross-entropy
@TAG Langage
@MINUTES 35
@WHY
C'est la loss du langage. Elle dit : tu as mis telle probabilité sur le bon token, je te coûte moins le logarithme de cette probabilité. On la détaille ici.
@OBJECTIVES
- Calculer -log(p_cible)
- Relier une probabilité faible à une loss forte
- Reconnaître le gradient softmax - one_hot
@PREREQ Softmax, étape 3.5.
@INTUITION
Si le modèle donne probabilité 1 au bon token, la loss vaut 0. S'il lui donne 0,1, la loss vaut environ 2,3 en logarithme naturel. Plus il est sûr et faux, plus la note est sévère.
@VOCAB
Cross-entropy : -log(p_cible) pour une cible one-hot. One-hot : un vecteur nul sauf un 1 à l'indice cible. NLL : negative log-likelihood, le même nombre. Gradient : (softmax(logits) - one_hot) / N pour la moyenne.
@EXPLAIN
On ne calcule pas la loss en passant par la probabilité affichée, à cause des arrondis. On calcule log(p) directement depuis les logits : z_cible - log(somme exp(z)). C'est ce que fait cross_entropy. Pour des logits tous nuls et V=5, chaque probabilité vaut 0,2 et la loss vaut log(5). Le gradient par rapport aux logits est la probabilité prédite, moins 1 sur la bonne case, le tout divisé par le nombre d'exemples. Le test compare ce gradient à une dérivée numérique. S'il diverge, on ne touche pas à l'optimiseur : la loss est fausse.
@LANG python
@CODE
:::
import numpy as np
from model.mathutil import cross_entropy
logits = np.zeros((1, 5))
print(cross_entropy(logits, np.array([2])))
:::
@EXPERIMENT
Construis des logits qui mettent 10 sur la bonne case et 0 ailleurs. La loss doit être proche de 0. Inverse : mets -10 sur la bonne case, la loss doit être grande.
@EXERCISE
Si p_cible = 0,5, que vaut -log(0,5) en logarithme naturel ? Tu dois trouver environ 0,693. Dis si c'est mieux ou pire qu'une probabilité de 0,9.
@BUILD
La tête linéaire de model/train.py est entraînée avec ce gradient. Le test test_classifier_loss_decreases exige une vraie baisse, pas un print encourageant.
@QUESTION
La cross-entropy augmente quand…
@CORRECT
Le modèle donne peu de probabilité au token cible
@WRONG
- Le modèle est certain et juste
- Le vocabulaire est affiché
- Le batch est un carré
@EXPLANATION
-log(p) est grand quand p est petit. Une cible bien prédite rapproche la loss de zéro.
@@@
@ID 3.7
@TITLE Température et top-k
@TAG Génération
@MINUTES 30
@WHY
Générer, c'est tirer un token dans la distribution. Température et top-k ne rendent pas le modèle plus savant : ils changent la forme du tirage.
@OBJECTIVES
- Diviser les logits par une température
- Dire ce que fait une température nulle
- Couper la queue avec top-k
@PREREQ Softmax, étape 3.5.
@INTUITION
Température basse : on écoute surtout le token favori. Température haute : on laisse de la place aux autres. Top-k : on jette les scores trop faibles avant de tirer, pour éviter un token absurde tiré une fois sur mille.
@VOCAB
Température : diviseur des logits avant softmax. Glouton : température 0, on prend l'argmax. Top-k : on ne garde que les k meilleurs scores. Échantillonnage : tirage aléatoire selon les probabilités.
@EXPLAIN
Diviser les logits par 0,5 augmente les écarts, donc la distribution devient plus piquée. Diviser par 2 les aplatit. La température 0 n'est pas une division : le code prend argmax, sinon on diviserait par zéro. Top-k met les logits hors du top à un très petit nombre avant softmax. Le laboratoire fait les deux dans sample_logits. Un test de génération avec température 0 vérifie la forme et le premier token, pas la beauté du texte : le hasard n'a pas à entrer dans un test déterministe.
@LANG python
@CODE
:::
import numpy as np
from model.mathutil import softmax
logits = np.array([1.0, 2.0, 3.0])
print(softmax(logits / 0.5).round(3))
print(softmax(logits / 2).round(3))
:::
@EXPERIMENT
Compare les deux lignes. La première doit être plus concentrée sur le dernier token. Note le max des deux distributions.
@EXERCISE
Avec les scores [1, 3, 2, 0] et top-k = 2, quels indices restent en course ? Tu dois garder 1 et 2, les scores 3 et 2.
@BUILD
BigramModel.generate et generate du Transformer passent par sample_logits. La température par défaut de la démo est 0,8 ; les tests utilisent 0 pour rester reproductibles.
@QUESTION
Une température qui tend vers 0 rend la génération…
@CORRECT
De plus en plus proche du choix glouton, le token au score maximal
@WRONG
- Uniforme sur tout le vocabulaire
- Indépendante des logits
- Impossible, parce que softmax interdit l'argmax
@EXPLANATION
Les écarts de logits sont amplifiés. À la limite, seule la case maximale garde de la masse. Le code traite 0 comme l'argmax exact.
@@@
@ID 3.8
@TITLE Entraîner le modèle de langage
@TAG Entraînement
@MINUTES 35
@WHY
La boucle du niveau 1 s'applique enfin à des tokens. Le forward change, la loss change, l'ordre des opérations non. On reprend cet ordre sur des tokens.
@OBJECTIVES
- Brancher contexte, logits et cross-entropy
- Citer l'ordre forward, loss, backward, pas
- Voir une loss baisser sur une tête linéaire
@PREREQ Boucle d'entraînement et cross-entropy.
@INTUITION
On montre une fenêtre, le modèle donne des scores, la loss punit le score du bon token suivant, le gradient dit comment bouger les poids, on fait un pas. On recommence.
@VOCAB
Pas d'entraînement : une mise à jour. Tête linéaire : la dernière matrice, des vecteurs vers les logits. Features gelées : des vecteurs qu'on ne modifie pas pendant ce pas.
@EXPLAIN
Le bigramme observe des transitions ; son apprentissage est un comptage. train_tiny_lm entraîne ensuite un réseau miniature par notre autograd NumPy. Le GPT complet de model/gpt_train.py emploie le même principe : embeddings, plusieurs blocs d'attention multi-têtes et FFN, loss next-token, backward, AdamW. Les poids de l'attention et des embeddings changent réellement ; ce n'est pas seulement une tête linéaire entraînée. RMSNorm dispose aussi d’un backward entraînable dans le laboratoire. RoPE, SwiGLU, GQA et le dos hybride restent des forwards exploratoires. Dans un premier TP, entraîne un tout petit problème pour vérifier le gradient et la baisse de loss ; dans une deuxième expérience, réserve des documents avant de construire le tokenizer. Une baisse sur le petit lot de débogage ne démontre pas une généralisation.
@LANG python
@CODE
:::
from model.gpt_train import train_gpt
texte = "le chat dort. le chien court.\n" * 30
modele, tok, rapport = train_gpt(texte, steps=20, batch=2, block=8,
    d_model=8, n_heads=2, n_layers=1, sample=False, eval_windows=2)
print(rapport.train_loss_start, rapport.train_loss_end)
assert rapport.train_loss_end < rapport.train_loss_start
:::
@EXPERIMENT
Lance le test test_classifier_loss_decreases. Il doit passer. Lis dans model/train.py la ligne qui soustrait le gradient.
@EXERCISE
Écris les quatre temps du pas en une phrase chacun. Souligne celui qui est différent entre un bigramme (comptage) et une tête linéaire (gradient).
@BUILD
Entraîne d'abord le petit modèle de model/tiny_lm.py, puis ouvre train_gpt pour voir le même ordre autour de plusieurs blocs. Dans l'atelier, la boucle n'utilisera que les fonctions que tu auras complétées.
@QUESTION
Entre un bigramme par comptage et une tête linéaire, qu'est-ce qui change dans l'entraînement ?
@CORRECT
La façon d'ajuster le modèle : comptes d'un côté, gradient de l'autre
@WRONG
- La définition de la cible, qui ne serait plus le token suivant
- L'obligation d'utiliser un GPU
- Le sens de lecture, de droite à gauche
@EXPLANATION
La tâche reste next-token. Seul l'estimateur change. Le bigramme compte, la tête suit un gradient.
@CODEFILE
model/tiny_lm.py
@SYMBOL
train_tiny_lm

@@@
@ID 3.9
@TITLE Génération autoregressive
@TAG Génération
@MINUTES 35
@WHY
Une fois le modèle entraîné, produire du texte c'est répéter : prédire, choisir un token, le coller au contexte, recommencer. On écrit cette boucle de génération.
@OBJECTIVES
- Décrire la boucle de génération
- Respecter block_size en ne gardant que la fin
- Décoder les identifiants en texte
@PREREQ Échantillonnage, étape 3.7.
@INTUITION
Le modèle ne écrit pas la phrase d'un bloc. Il écrit un jeton, le regarde comme s'il avait toujours été là, et écrit le suivant. Une erreur tôt se retrouve dans le contexte des pas d'après.
@VOCAB
Autoregressif : chaque sortie rejoint l'entrée. Fenêtre glissante : on ne garde que les block_size derniers tokens. Graine : le premier token, ou le prompt, d'où part la génération.
@EXPLAIN
generate du dépôt part d'un tableau (B, T), calcule les logits de la dernière position seulement, tire un identifiant, et le concatène. Si la séquence dépasse block_size, on ne donne au forward que la fin : les positions absolues n'existent pas plus loin. Le bigramme, lui, n'a besoin que du dernier identifiant. Dans les deux cas, decode du tokenizer transforme la liste en chaîne. Le texte peut être médiocre : avec un corpus de quelques lignes, c'est attendu. Le test vérifie la longueur et le préfixe, pas le style.
@LANG python
@CODE
:::
ids = [1]
for _ in range(3):
    # dernier = ids[-1]
    # suivant = choisir(modele, dernier)
    # ids.append(suivant)
    pass
print("on allonge la liste d'un identifiant par tour")
:::
@EXPERIMENT
Avec le bigramme entraîné sur [0,1,0,1,...] et température 0, génère 6 tokens depuis 0. Tu dois alterner, parce que 0 est presque toujours suivi de 1 et inversement.
@EXERCISE
Part de la graine [4] et d'un block_size de 3. Après avoir produit 4, 7, 1, 9, quelle fenêtre de 3 entre dans le forward au pas suivant ?
@BUILD
model/bigram.py et model/transformer.py exposent tous deux une génération. python -m model montre la version bigramme sur le corpus, puis la forme des logits du mini-GPT.
@QUESTION
Après avoir choisi un token, la génération…
@CORRECT
Le réinjecte dans le contexte pour prédire le suivant
@WRONG
- Efface le contexte et recommence au hasard
- Modifie les poids du modèle
- Écrit directement des octets sans identifiants
@EXPLANATION
Le token choisi devient une entrée. Les poids ne bougent pas pendant la génération : ce n'est pas un pas d'entraînement.
@@@
@ID 3.10
@TITLE Perplexité
@TAG Évaluation
@MINUTES 30
@WHY
La loss moyenne est juste mais peu lisible. La perplexité la réécrit comme un effectif : à quel vocabulaire uniforme le modèle équivaut-il. On la calcule dans cette étape.
@OBJECTIVES
- Calculer exp(loss moyenne)
- Comparer à la perplexité du hasard, égale à V
- Dire ce que la perplexité ne mesure pas
@PREREQ Cross-entropy, étape 3.6.
@INTUITION
Une perplexité de 10 veut dire, grossièrement : le modèle est aussi incertain que s'il hésitait uniformément entre 10 tokens. Plus c'est bas, plus il est concentré sur les bons tokens. Ce n'est pas une note de rédaction.
@VOCAB
Perplexité : exp de la cross-entropy moyenne naturelle. Baseline uniforme : perplexité égale à V. Optimiste : une perplexité calculée sur les données déjà vues.
@EXPLAIN
Si la loss moyenne vaut log(V), la perplexité vaut V : le modèle ne fait pas mieux que le hasard. Le bigramme du test, sur une alternance parfaite, descend sous 2 pour un vocabulaire de 2. On compare toujours à cette baseline, pas à un chiffre absolu copié d'un article. La perplexité ne dit pas si le texte est vrai, ni s'il est utile. Elle dit si les tokens cibles étaient probables. bigram_versus_uniform la calcule sur la fin de la séquence, pas sur les comptes d'entraînement.
@LANG python
@CODE
:::
import math
loss = math.log(10)
print(math.exp(loss))  # 10 : le hasard sur 10 tokens
:::
@EXPERIMENT
Calcule la perplexité du bigramme sur [0,1,0,1,0,1] après observe. Elle doit être inférieure à 2. Fais la même chose sur une séquence aléatoire longue : l'écart avec 2 doit se réduire.
@EXERCISE
Un modèle a une loss moyenne de 2 nats. Quelle est sa perplexité ? environ 7,4. Si V = 100, bat-il le hasard ? Oui, largement, parce que 7,4 < 100.
@BUILD
BigramModel.perplexity est la métrique du fil rouge à cette étape. Le tableau du niveau 6 pourra y ajouter le temps et la RAM, mais le chiffre de qualité commence ici.
@QUESTION
La perplexité d'un modèle uniforme sur V tokens vaut…
@CORRECT
V, la taille du vocabulaire
@WRONG
- 0
- 1
- V au carré
@EXPLANATION
La loss uniforme vaut log(V), et exp(log(V)) = V. C'est la baseline à battre.
@@@
@ID 3.11
@TITLE Sauvegarder et recharger
@TAG Entraînement
@MINUTES 25
@WHY
Un entraînement qui n'est pas rechargeable n'est pas une expérience. Il faut pouvoir retrouver les poids et le vocabulaire qui vont ensemble.
@OBJECTIVES
- Distinguer poids et code
- Dire ce qu'il faut sauver en plus des nombres
- Recharger un état et vérifier un aller-retour
@PREREQ Génération et perplexité.
@INTUITION
Le code est la recette. Les poids sont les réglages trouvés. Sauver la recette sans les réglages, ou les réglages sans dire à quel vocabulaire ils correspondent, rend l'expérience impossible à rejouer.
@VOCAB
Checkpoint : un fichier d'état. state dict : les tableaux nommés. Config : les hyperparamètres qui fixent les formes. Vocabulaire : la table qu'il faut sauver avec les poids.
@EXPLAIN
Un checkpoint réunit configuration, poids et tokenizer avec l'ordre exact de ses identifiants. Le code de la version et la provenance des données complètent cette archive. Pour reprendre exactement un entraînement, ajoute moments AdamW, compteur, générateur aléatoire et calendrier total. Le laboratoire les sauvegarde dans les nouveaux fichiers. Une graine identique ne prouve pas que la sauvegarde fonctionne : elle ne fait que reproduire une initialisation. Le vrai contrôle calcule des logits avant écriture, recharge le fichier et compare ces mêmes logits. Utilise runs/ pour tes sorties afin de préserver les checkpoints fournis. Le test de reprise va plus loin : il compare tous les poids entre un run continu et un run interrompu puis rechargé.
@LANG python
@CODE
:::
from pathlib import Path
from tempfile import TemporaryDirectory
import numpy as np
from model.gpt_train import save_checkpoint, load_checkpoint
from model.transformer import TinyGPT, GPTConfig
from model.tokenizer import CharTokenizer
tok = CharTokenizer("ab ")
m = TinyGPT(GPTConfig(vocab_size=3, d_model=8, n_heads=2, n_layers=1, block_size=4))
x = np.array([[0, 1]])
avant, _ = m.forward(x)
with TemporaryDirectory() as dossier:
    path = Path(dossier) / "modele.npz"
    save_checkpoint(path, m, tok, {})
    relu, _, _ = load_checkpoint(path)
    apres, _ = relu.forward(x)
assert np.array_equal(avant, apres)
print("Logits identiques après rechargement")
:::
@EXPERIMENT
Construis deux CharTokenizer sur le même texte et vérifie que leurs stoi sont identiques. Change un caractère du corpus du second et montre que les identifiants divergent.
@EXERCISE
Liste les trois objets à archiver pour regénérer un texte : le code de la version, la config, les poids, plus la table du tokenizer. Dis lequel manque si le texte décodé est du charabia alors que la loss semblait bonne.
@BUILD
Le fil rouge de fin de niveau 3 est reproductible sans fichier de poids : graine fixe, tests verts, démo python -m model. C'est le checkpoint le plus simple : celui qu'on peut relire.
@QUESTION
Pourquoi sauver le vocabulaire avec les poids ?
@CORRECT
Parce que les identifiants n'ont de sens que pour la table qui les a créés
@WRONG
- Parce que le vocabulaire remplace la config
- Parce que Git ne peut pas versionner de code
- Parce que la perplexité est un fichier
@EXPLANATION
Un entier 4 désigne des caractères différents selon la table. Les poids appris pour une table sont illisibles avec une autre.
@CODEFILE
model/gpt_train.py
@SYMBOL
save_checkpoint
