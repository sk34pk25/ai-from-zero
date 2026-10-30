@@@
@ID 4.1
@TITLE La limite du contexte naïf
@TAG Attention
@MINUTES 30
@WHY
Moyenner tout le passé, ou ne garder que le dernier token, rate des liens précis : un mot au début peut être celui qui compte. L'attention existe pour choisir où regarder.
@OBJECTIVES
- Donner un exemple où la moyenne échoue
- Donner un exemple où le bigramme échoue
- Formuler le besoin : une somme pondérée du passé
@PREREQ Contexte et vecteurs, niveaux 2 et 3.
@INTUITION
Tu lis une phrase et certains mots « rappellent » des mots plus anciens. Tu ne relis pas tout avec la même force, et tu n'oublies pas tout sauf le dernier mot. L'attention est cette relecture pondérée.
@VOCAB
Sac de vecteurs : une somme ou une moyenne, sans choix. Bigramme : uniquement le voisin. Poids d'attention : des coefficients positifs qui somment à 1, un par position du passé.
@EXPLAIN
La moyenne de tous les embeddings mélange le mot utile et le bruit. Le bigramme jette tout sauf le voisin. On voudrait, à chaque position, des coefficients qui dépendent du contenu : beaucoup sur le token qui s'accorde, presque rien sur les autres. Ces coefficients doivent être positifs et sommer à 1 pour rester une moyenne. Ils ne sont pas appris comme une table fixe : ils sont calculés à partir des vecteurs présents. C'est la différence avec une position absolue, qui ne regarde pas le contenu.
@LANG python
@CODE
:::
import numpy as np
passe = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
moyenne = passe.mean(axis=0)
print(moyenne)
:::
@EXPERIMENT
La moyenne ci-dessus traite les trois positions également. Invente des poids [0.05, 0.05, 0.9] et calcule la somme pondérée. Elle doit ressembler à la troisième ligne.
@EXERCISE
Dans « la clef est dans la porte et elle rouille », quel mot « elle » doit surtout regarder ? Explique pourquoi une moyenne de toute la phrase dilue ce lien.
@BUILD
Le fil rouge quitte le bigramme comme modèle principal, sans le jeter : il reste la baseline. La nouvelle brique commence dans model/attention.py.
@QUESTION
L'attention est introduite pour…
@CORRECT
Pondérer le passé selon le contenu
@WRONG
- Moyenner uniformément toutes les positions
- Ne conserver que le dernier token
- Remplacer le vocabulaire par des mots entiers
@EXPLANATION
Elle choisit quelles positions du contexte mélangent leurs vecteurs. Le tokenizer et la loss restent en place.
@@@
@ID 4.2
@TITLE Requête, clé et valeur
@TAG Attention
@MINUTES 30
@WHY
Trois rôles évitent de comparer un vecteur à lui-même sans intention. La requête cherche, la clé s'annonce, la valeur est ce qu'on emporte si la comparaison réussit.
@OBJECTIVES
- Nommer Q, K et V
- Dire que ce sont trois projections du même vecteur
- Lire les formes (T, D)
@PREREQ Limite du contexte naïf, étape 4.1.
@INTUITION
Dans une bibliothèque, ta question est la requête, le titre sur le dos du livre est la clé, le chapitre que tu photocopies est la valeur. Tu compares la question aux titres, pas aux chapitres entiers.
@VOCAB
Requête Q : ce que la position cherche. Clé K : ce que la position propose comme index. Valeur V : le contenu mélangé si la clé est retenue. Projection : une matrice qui transforme le vecteur d'entrée en Q, en K ou en V.
@EXPLAIN
On ne compare pas les embeddings bruts. On calcule Q = X Wq, K = X Wk, V = X Wv. Les trois matrices sont des paramètres. Deux positions peuvent donc être proches comme clés et lointaines comme valeurs. Dans le mini-GPT, Wq a la forme (D, D) quand toutes les têtes sont regroupées. Pour une seule tête pédagogique, Q, K et V ont la forme (T, D). Le test d'attention utilise des matrices identité implicites : query, key et value sont le même petit tableau, pour voir le masque sans bruit.
@LANG python
@CODE
:::
import numpy as np
X = np.array([[1.0, 0.0], [0.0, 1.0]])
Wq = np.eye(2)
Q = X @ Wq
print(Q.shape)
:::
@EXPERIMENT
Remplace Wq par une matrice qui échange les deux axes, [[0, 1], [1, 0]]. Q doit être X avec les colonnes inversées. K et V peuvent rester X.
@EXERCISE
Pour T=3 et D=4, donne la forme de Q, de K et de V avant le produit scalaire. Donne la forme du score Q Kᵀ.
@BUILD
TinyGPT stocke wq, wk, wv, wo par couche. Ce sont les premières matrices vraiment « attention » du fil rouge, dans model/transformer.py.
@QUESTION
La valeur V, dans l'attention, est…
@CORRECT
Le vecteur de contenu à combiner selon les poids d’attention
@WRONG
- La question utilisée pour comparer les positions
- Le score normalisé entre deux tokens
- Le masque qui interdit le futur
@EXPLANATION
Q et K servent à décider les poids. V est ce qui est ensuite sommé. Le learning rate n'entre pas dans ce calcul.
@@@
@ID 4.3
@TITLE Produit scalaire des scores
@TAG Attention
@MINUTES 25
@WHY
Le score entre deux positions est un produit scalaire. C'est le même calcul qu'au niveau 0, appliqué à une requête et à une clé. On le réutilise comme score.
@OBJECTIVES
- Calculer un score requête · clé
- Lire une matrice de scores (T, T)
- Voir qu'un score n'est pas encore un poids
@PREREQ QKV et vecteurs.
@INTUITION
Deux vecteurs alignés donnent un grand score. Deux vecteurs orthogonaux donnent un score proche de zéro. La matrice des scores dit, pour chaque couple de positions, à quel point elles se regardent.
@VOCAB
Score : le produit scalaire, avant softmax. Matrice (T, T) : une ligne par requête, une colonne par clé. Alignement : un grand produit positif.
@EXPLAIN
Si Q et K ont la forme (T, D), alors Q @ K.T a la forme (T, T). La case (i, j) compare la position i comme requête et la position j comme clé. Ce nombre peut être négatif. Il ne somme pas à 1. Softmax le long de la ligne le transformera en poids. Pour D grand, la variance de la somme de D produits indépendants grandit : les scores deviennent énormes et softmax trop piqué. C'est pour cela qu'on divisera par sqrt(D) à l'étape 4.6, pas par goût de la formule.
@LANG python
@CODE
:::
import numpy as np
Q = np.array([[1.0, 0.0], [1.0, 1.0]])
K = np.array([[1.0, 0.0], [0.0, 1.0]])
print(Q @ K.T)
:::
@EXPERIMENT
La case (0, 0) doit valoir 1 et la case (0, 1) doit valoir 0. Vérifie la seconde ligne à la main : [1, 1] contre les deux clés donne [1, 1].
@EXERCISE
Pour D=1, Q = [[2], [0]] et K = [[3], [4]], calcule la matrice 2×2 des scores.
@BUILD
scaled_dot_product_attention commence par ce produit. Le facteur d'échelle est déjà dans la fonction : on l'expliquera juste après, mais le code ne sépare pas un produit « naïf » faux.
@QUESTION
La case (i, j) des scores compare…
@CORRECT
Q de i avec K de j
@WRONG
- V de i avec V de j
- K de i avec Q de j
- Le token cible de i avec le logit de j
@EXPLANATION
L'axe des lignes est celui des requêtes, l'axe des colonnes celui des clés. La valeur n'entre pas encore.
@@@
@ID 4.4
@TITLE Self-attention
@TAG Attention
@MINUTES 35
@WHY
Self-attention veut dire : les requêtes, les clés et les valeurs viennent de la même séquence. Chaque position relit les autres positions du même texte.
@OBJECTIVES
- Distinguer self-attention et attention vers une autre séquence
- Appliquer softmax sur les scores
- Vérifier que chaque ligne de poids somme à 1
@PREREQ Scores, étape 4.3.
@INTUITION
La phrase se relit elle-même. Ce n'est pas encore un modèle qui regarde une image et un texte. C'est un texte qui cherche, en lui, ce qui éclaire chaque position.
@VOCAB
Self-attention : Q, K et V issus du même X. Poids : softmax des scores, une distribution par ligne. Sortie : poids @ V, une moyenne des valeurs.
@EXPLAIN
Pour chaque position, la ligne de poids est une distribution sur les positions. La sortie est la somme des valeurs, pondérée par cette ligne. Si les poids de la ligne 2 valent [0, 0, 1], la sortie de la position 2 est exactement la valeur de la position 2. Le test du laboratoire vérifie que les poids somment à 1 et, avec le masque, que le futur est à 0. Sans masque, une position pourrait lire la réponse écrite plus loin dans la phrase : ce serait de la triche à l'entraînement next-token. Le masque arrive à l'étape suivante, mais l'idée de la somme pondérée est déjà complète.
@LANG python
@CODE
:::
import numpy as np
from model.attention import scaled_dot_product_attention
X = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0]])
sortie, poids = scaled_dot_product_attention(X, X, X, causal=False)
print(poids.sum(axis=-1))
:::
@EXPERIMENT
Relance avec causal=True et observe que la première ligne n'a de masse que sur la première colonne. La somme de la ligne doit rester 1.
@EXERCISE
Si les poids d'une ligne sont [0.2, 0.8] et les valeurs [[1, 0], [0, 1]], quelle est la sortie ? [0.2, 0.8].
@BUILD
La fonction scaled_dot_product_attention est la brique débloquée ici. Le Transformer l'utilise à l'intérieur de chaque tête, avec le masque causal activé.
@QUESTION
Dans la self-attention, Q, K et V viennent…
@CORRECT
D’une séquence, par trois projections
@WRONG
- De trois textes indépendants obligatoirement
- D’une même matrice sans projection
- Du softmax, appliqué avant les scores
@EXPLANATION
« Self » veut dire même séquence. Les trois projections restent des matrices différentes.
@@@
@ID 4.5
@TITLE Masque causal
@TAG Attention
@MINUTES 30
@WHY
Sans masque, la position 2 peut lire le token 5, celui qu'elle est censée prédire. Le masque ferme le futur. C'est la condition d'une génération honnête.
@OBJECTIVES
- Lire un masque triangulaire
- Mettre le futur à un score très négatif
- Vérifier qu'un token futur ne change pas le passé
@PREREQ Self-attention, étape 4.4.
@INTUITION
Quand tu écris un mot, tu ne vois pas encore les mots que tu n'as pas écrits. Le masque impose cette contrainte au calcul, sinon l'entraînement est une fuite d'information.
@VOCAB
Causal : le présent ne dépend pas du futur. Masque triangulaire inférieur : les cases j ≤ i restent ouvertes. -1e9 : un score assez petit pour que softmax le traite comme nul.
@EXPLAIN
causal_mask autorise une clé dont la position est inférieure ou égale à celle de la requête. Les autres scores sont remplacés par -1e9 avant softmax, donc leur probabilité tombe à zéro, et la ligne est renormalisée sur le passé autorisé. Le test change le dernier token d'une séquence et vérifie que les logits des positions précédentes ne bougent pas. Si ils bougent, le masque est percé. C'est le test le plus important du mini-GPT, plus que la qualité du texte généré.
@LANG python
@CODE
:::
import numpy as np
T = 4
masque = np.tril(np.ones((T, T), dtype=bool))
print(masque.astype(int))
:::
@EXPERIMENT
Pour T=3, écris les cases autorisées de la ligne du milieu. Elle peut voir les positions 0 et 1, pas 2.
@EXERCISE
Explique pourquoi mettre le futur à zéro après softmax serait faux si on ne renormalise pas, et pourquoi mettre un score très négatif avant softmax règle les deux problèmes d'un coup.
@BUILD
Le forward de TinyGPT construit allowed = positions des clés <= positions des requêtes, y compris quand un cache a déjà allongé le passé. Le test de causalité et le test de cache doivent passer ensemble.
@QUESTION
Le masque causal empêche une position de…
@CORRECT
Accéder aux tokens futurs
@WRONG
- Accéder au token courant
- Lire les tokens les plus anciens
- Utiliser plusieurs têtes d’attention
@EXPLANATION
Le présent et le passé restent visibles. Le futur est fermé, sinon la cible fuite dans l'entrée.
@@@
@ID 4.6
@TITLE Attention à l'échelle
@TAG Attention
@MINUTES 25
@WHY
Sans diviser par la racine de la dimension, les produits scalaires grandissent avec D et softmax devient un argmax accidentel. L'échelle rend l'entraînement stable.
@OBJECTIVES
- Expliquer la division par sqrt(d)
- Voir l'effet sur un softmax
- Relier l'échelle à la variance d'une somme
@PREREQ Masque et softmax.
@INTUITION
Additionner beaucoup de petits hasards donne un grand hasard. Le produit scalaire en dimension D additionne D termes. On divise par sqrt(D) pour que le score typique ne gonfle pas avec la largeur du modèle.
@VOCAB
Échelle : 1/sqrt(d_k), où d_k est la dimension d'une tête. Saturation de softmax : une exponentielle écrase les autres quand un score domine de beaucoup. d_k : dimension d'une tête, pas forcément D du modèle.
@EXPLAIN
Si les composantes de Q et K sont d'ordre 1, le produit a une variance qui croît comme d_k. Diviser par sqrt(d_k) ramène cette variance près de 1. Le classement des positions ne change pas si on divise tous les scores d'une ligne par la même constante positive, mais la dureté du softmax, elle, change. C'est voulu : on ne veut pas un softmax trop dur dès l'initialisation, avant même que les poids aient appris quelque chose. Le code du laboratoire divise dans scaled_dot_product_attention et dans TinyGPT.
@LANG python
@CODE
:::
import numpy as np
from model.mathutil import softmax
scores = np.array([6.0, 0.0, 0.0])
d = 16
print(softmax(scores).round(3))
print(softmax(scores / np.sqrt(d)).round(3))
:::
@EXPERIMENT
La première ligne doit être plus piquée que la seconde. Note la probabilité de la première case dans les deux cas.
@EXERCISE
Pour d_k = 64, quel est le diviseur ? 8. Pour d_k = 1, quel est-il ? 1, donc l'échelle ne change rien.
@BUILD
La division est dans model/attention.py. On ne propose pas de l'enlever pour « simplifier » : le test de forme resterait vert, mais l'initialisation deviendrait hostile dès que d_model grandit.
@QUESTION
On divise les scores par sqrt(d_k) pour…
@CORRECT
Éviter que la dimension des clés rende le softmax trop piqué
@WRONG
- Forcer les scores à sommer à un
- Remplacer le masque causal triangulaire
- Rendre les clés indépendantes des requêtes
@EXPLANATION
L'échelle ne change pas le nombre de poids et ne fabrique pas à elle seule une distribution. Elle calme les scores avant softmax.
@@@
@ID 4.7
@TITLE Multi-têtes
@TAG Attention
@MINUTES 30
@WHY
Une seule comparaison mélange tous les critères. Plusieurs têtes laissent coexister plusieurs façons de regarder la même phrase : accord, proximité, nom cité plus haut.
@OBJECTIVES
- Découper D en têtes de dimension d_k
- Concaténer les sorties et les reprojeter
- Vérifier que le nombre de têtes divise D
@PREREQ Attention à l'échelle, étape 4.6.
@INTUITION
Plusieurs lecteurs annotent la même phrase avec des crayons de couleurs différentes. À la fin, on rassemble leurs notes dans un seul vecteur, de la dimension du modèle.
@VOCAB
Tête : un bloc d'attention de dimension d_k. d_k = d_model / n_heads. Concaténation : remettre les têtes côte à côte. W_o : la matrice qui mélange les têtes après coup.
@EXPLAIN
Avec d_model = 16 et 4 têtes, chaque tête a d_k = 4. Q est découpé en (B, T, 4, 4), puis transposé pour que l'attention travaille sur l'axe du temps. Les sorties des têtes sont concaténées en (B, T, 16) et multipliées par W_o. Si 16 n'est pas divisible par le nombre de têtes, la config est refusée : on ne coupe pas une dimension en morceaux inégaux silencieux. Les têtes ne sont pas « spécialisées » à l'initialisation. Elles le deviennent seulement si la loss y trouve un intérêt. On n'a pas à nommer leur rôle à la main.
@LANG python
@CODE
:::
d_model, n_heads = 16, 4
assert d_model % n_heads == 0
print(d_model // n_heads)
:::
@EXPERIMENT
Essaie n_heads = 3 avec d_model = 16. La condition doit échouer. C'est la même garde que GPTConfig.
@EXERCISE
Pour d_model = 32 et 8 têtes, donne d_k et la forme de Q pour B=2, T=5, avant le produit des scores.
@BUILD
TinyGPT découpe exactement ainsi. Le test de causalité utilise 4 têtes et d_model 16. Une tête unique serait un cas particulier, pas un autre algorithme.
@QUESTION
d_k, la dimension d'une tête, vaut…
@CORRECT
d_model / nombre de têtes
@WRONG
- d_model × nombre de têtes
- T / nombre de têtes
- La taille du vocabulaire divisée par T
@EXPLANATION
Les têtes se partagent la dimension du modèle. d_k est ce quotient, et il doit tomber juste.
@@@
@ID 4.8
@TITLE Connexions résiduelles
@TAG Bloc
@MINUTES 25
@WHY
Ajouter le résultat d'un sous-bloc à son entrée laisse passer le signal même si le sous-bloc est mal initialisé. Sans résidu, un réseau profond perd facilement son entrée.
@OBJECTIVES
- Écrire x + sous_bloc(x)
- Dire ce que devient la sortie si le sous-bloc vaut zéro
- Relier le résidu à la profondeur
@PREREQ Multi-têtes, étape 4.7.
@INTUITION
Le sous-bloc propose une correction. L'entrée continue tout droit. Si la correction est nulle, la phrase n'est pas détruite : elle ressort telle quelle.
@VOCAB
Résidu : l'ajout x + f(x). Sous-bloc : attention ou FFN. Chemin direct : la branche qui ne passe pas par f. Profondeur : le nombre de blocs empilés.
@EXPLAIN
Au début de l'entraînement, f peut être proche de zéro si les dernières matrices sont petites. Grâce au résidu, la sortie reste proche de x et le gradient a un chemin direct vers les couches du dessous. Le mini-GPT fait deux résidus par bloc : un autour de l'attention, un autour du FFN. L'ordre exact avec la normalisation est le pre-norm : on normalise, on calcule le sous-bloc, on ajoute à l'entrée non normalisée. C'est plus stable pour un petit modèle que le post-norm historique, où l'on normalisait après l'addition.
@LANG python
@CODE
:::
import numpy as np
def avec_residu(x, correction):
    return x + correction
x = np.array([1.0, 2.0])
y = avec_residu(x, np.array([0.0, 0.0]))
np.testing.assert_array_equal(y, x)
assert y.shape == x.shape
print(y)
:::
@EXPERIMENT
Passe une correction [0.1, -0.1]. La sortie doit être [1.1, 1.9]. Si tu oublies l'addition, tu perds x.
@EXERCISE
Écris la sortie de deux résidus successifs quand les deux corrections sont nulles. Elle doit rester x. Conclus : la profondeur n'efface pas l'entrée tant que les corrections sont nulles.
@BUILD
Dans TinyGPT.forward, les deux lignes hidden = hidden + attended et hidden = hidden + ffn sont ces résidus. On ne les « optimise » pas en les retirant.
@QUESTION
Si le sous-bloc renvoie zéro, la sortie résiduelle vaut…
@CORRECT
L’entrée, car le résidu lui ajoute la sortie nulle du sous-bloc
@WRONG
- Un vecteur nul
- L’entrée normalisée
- Le double de l’entrée
@EXPLANATION
x + 0 = x. Le chemin direct laisse passer l'entrée quand la correction est nulle : c'est l'intérêt du résidu.
@CODEFILE
model/transformer.py
@SYMBOL
TinyGPT.forward

@@@
@ID 4.9
@TITLE Normalisation
@TAG Bloc
@MINUTES 30
@WHY
Les activations qui grossissent ou s'effondrent rendent le pas d'apprentissage intenable. Normaliser remet l'échelle du vecteur sous contrôle, couche après couche.
@OBJECTIVES
- Calculer une LayerNorm simple
- Dire ce que la moyenne et la variance corrigent
- Annoncer RMSNorm comme variante sans centrage
@PREREQ Résidus, étape 4.8.
@INTUITION
Avant de mélanger un vecteur, on le remet à une échelle connue : centré, de variance 1, puis réétiré par un gain appris. Le contenu relatif des composantes reste, l'échelle brute non.
@VOCAB
LayerNorm : normaliser sur la dernière dimension, par vecteur. Gain et biais : paramètres γ et β qui rééchelonnent après coup. Pre-norm : normaliser à l'entrée du sous-bloc. RMSNorm : diviser par la racine de la moyenne des carrés, sans soustraire la moyenne.
@EXPLAIN
Pour un vecteur, on soustrait sa moyenne, on divise par l'écart-type, on multiplie par γ et on ajoute β. Chaque token a sa propre moyenne : on ne mélange pas les statistiques du batch, contrairement à BatchNorm, malcommode en génération. Le laboratoire utilise LayerNorm par défaut et RMSNorm en option. RMSNorm enlève le centrage et le biais, et garde un gain. Les deux ont le même rôle : éviter qu'un bloc profond reçoive des nombres d'un ordre de grandeur imprévisible. eps, ici 1e-5, évite la division par zéro.
@LANG python
@CODE
:::
import numpy as np
from model.mathutil import layernorm
x = np.array([[1.0, 3.0]])
gain = np.ones(2)
biais = np.zeros(2)
print(layernorm(x, gain, biais).round(3))
:::
@EXPERIMENT
La moyenne de [1, 3] est 2. Après centrage, on doit voir des valeurs opposées. Vérifie que leur moyenne est proche de 0.
@EXERCISE
Explique pourquoi BatchNorm, qui dépend des autres exemples du batch, est gênant quand on génère un seul token à la fois.
@BUILD
_norm dans TinyGPT applique LayerNorm ou RMSNorm selon la config, avant chaque sous-bloc. C'est le pre-norm du fil rouge.
@QUESTION
LayerNorm normalise surtout…
@CORRECT
Le dernier axe de chaque token séparément
@WRONG
- Chaque feature sur tout le batch
- Tous les tokens d’une séquence ensemble
- Toutes les valeurs du batch d’un seul coup
@EXPLANATION
La moyenne et la variance sont celles du vecteur courant. Le batch n'entre pas dans ce calcul.
@@@
@ID 4.10
@TITLE Le réseau feed-forward
@TAG Bloc
@MINUTES 30
@WHY
L'attention mélange les positions. Elle ne transforme pas beaucoup, à elle seule, le contenu d'une position. Le FFN est la transformation position par position, la même pour toutes.
@OBJECTIVES
- Écrire un FFN à deux matrices
- Voir qu'il n'échange pas d'information entre positions
- Donner la largeur habituelle 4D
@PREREQ Normalisation, étape 4.9.
@INTUITION
Après avoir regardé autour, chaque position rentre dans le même petit atelier et en ressort transformée. L'atelier ne voit qu'un vecteur à la fois.
@VOCAB
FFN : feed-forward network, deux couches linéaires avec une activation au milieu. d_ff : la largeur cachée, souvent 4 fois d_model. Position-wise : la même fonction, appliquée séparément à chaque position.
@EXPLAIN
La forme classique est gelu(x @ W1) @ W2, avec W1 de forme (D, 4D) et W2 de forme (4D, D). Aucune de ces matrices ne regarde le temps : si tu permutes les positions en entrée, les sorties se permutent de la même façon. C'est le complément de l'attention, qui, elle, mélange le temps. Le laboratoire propose aussi SwiGLU, avec une troisième matrice de porte, au niveau 5. Pour l'instant le défaut est GELU, l'approximation tanh de model/mathutil.py. Le résidu autour du FFN est le second résidu du bloc.
@LANG python
@CODE
:::
import numpy as np
from model.mathutil import gelu
x = np.array([[0.5, -0.5]])
W1 = np.eye(2, 4)
W2 = np.eye(4, 2)
y = gelu(x @ W1) @ W2
print(y.shape)
:::
@EXPERIMENT
Duplique la ligne de x pour faire deux positions identiques. Les deux sorties doivent être identiques : le FFN ne dialogue pas entre elles.
@EXERCISE
Pour D=32, combien de colonnes a W1 dans la version 4D ? 128. Combien de paramètres, en ignorant les biais, pour W1 et W2 ? 32*128 + 128*32 = 8192.
@BUILD
_ffn dans TinyGPT implémente ce calcul, avec hidden = 4 * d_model pour GELU. Les FLOPs correspondants sont dans ffn_flops, au niveau 6.
@QUESTION
Le FFN d'un Transformer mélange-t-il les positions entre elles ?
@CORRECT
Non, il agit position par position
@WRONG
- Oui, par une moyenne des positions voisines
- Oui, par un masque triangulaire interne
- Non, car il ne possède aucun poids appris
@EXPLANATION
Le mélange temporel est le travail de l'attention. Le FFN est une fonction identique appliquée à chaque vecteur.
@@@
@ID 4.11
@TITLE Un bloc Transformer
@TAG Bloc
@MINUTES 35
@WHY
Le bloc est l'unité qu'on empile. Le nommer correctement — attention résiduelle, puis FFN résiduel, avec pre-norm — évite les architectures « presque » justes.
@OBJECTIVES
- Écrire l'ordre pre-norm du bloc
- Compter deux résidus
- Relier chaque pièce aux étapes précédentes
@PREREQ FFN, étape 4.10.
@INTUITION
Un bloc est un tour complet : relire le contexte, ajouter cette relecture, transformer chaque position, ajouter cette transformation. On peut le répéter sans réinventer les pièces.
@VOCAB
Bloc : attention + FFN, avec normes et résidus. Pre-norm : norme avant le sous-bloc. Sortie du bloc : un tenseur de même forme que l'entrée, (B, T, D).
@EXPLAIN
L'ordre du laboratoire est : h = x + Attention(Norm(x)) puis y = h + FFN(Norm(h)). La forme ne change pas. C'est indispensable pour empiler. Le post-norm historique faisait x = Norm(x + Attention(x)). On le cite pour le reconnaître dans un article de 2017, mais on n'empile pas celui-là ici : le pre-norm supporte mieux quelques blocs avec une initialisation simple. Un bloc n'inclut pas le tokenizer ni la tête de sortie. Ce sont l'entrée et la sortie du modèle, pas du bloc.
@LANG python
@CODE
:::
def bloc(x, attention, ffn, norm):
    h = x + attention(norm(x))
    y = h + ffn(norm(h))
    return y
:::
@EXPERIMENT
Si attention et ffn renvoient 0, bloc doit renvoyer x. Vérifie-le avec des fonctions lambda sur un vecteur NumPy.
@EXERCISE
Nomme les quatre matrices de l’attention : Wq, Wk, Wv, Wo. Ajoute les deux matrices du FFN : W1 et W2. Pour chaque groupe, indique les formes attendues et son rôle dans le bloc.
@BUILD
La boucle for layer in range(n_layers) de TinyGPT est ce bloc, répété. Tu es au point du fil rouge où « un Transformer » devient un objet concret.
@QUESTION
Dans le pre-norm du laboratoire, la normalisation est appliquée…
@CORRECT
Avant chaque sous-bloc, résidu sur l’entrée
@WRONG
- Après chaque addition résiduelle
- Uniquement après le dernier bloc
- Sur l’entrée résiduelle au lieu du sous-bloc
@EXPLANATION
Chaque sous-bloc voit une entrée normalisée, et le chemin résiduel garde la version précédente.
@@@
@ID 4.12
@TITLE Empiler les blocs
@TAG Modèle
@MINUTES 25
@WHY
Un bloc extrait peu. Plusieurs blocs composent des relectures. La profondeur est un hyperparamètre, pas une preuve de qualité. On empile sans confondre profondeur et qualité.
@OBJECTIVES
- Répéter un bloc sans changer la forme
- Dire ce que n_layers change au coût
- Refuser une profondeur comme argument d'autorité
@PREREQ Un bloc, étape 4.11.
@INTUITION
Relire une fois trouve les liens simples. Relire encore permet à un lien de s'appuyer sur un lien déjà formé. Chaque relecture coûte un bloc de plus, en paramètres et en temps.
@VOCAB
Profondeur : n_layers. Composition : la sortie du bloc i est l'entrée du bloc i+1. Coût linéaire en profondeur : doubler les couches double à peu près ce coût, à taille de fenêtre fixe.
@EXPLAIN
Le laboratoire construit n_layers blocs de mêmes formes, avec des poids différents. Deux couches ne font pas « deux fois la même chose » : elles n'ont pas les mêmes matrices. En revanche, doubler n_layers double les paramètres des blocs et les FLOPs, pour un T et un D fixes. Ce n'est pas le carré, contrairement à l'allongement de la fenêtre. On choisira la profondeur en la mesurant, au niveau 6, pas en supposant que plus profond est toujours meilleur. Le test utilise 2 couches pour le modèle de base et 1 couche pour les variantes, afin que les tests restent immédiats.
@LANG python
@CODE
:::
def empiler(x, blocs):
    for bloc in blocs:
        x = bloc(x)
    return x
:::
@EXPERIMENT
Si chaque bloc est l'identité, empiler 5 blocs renvoie x. Ajoute un bloc qui ajoute 1 : après 3 blocs, la sortie a augmenté de 3. La profondeur se voit.
@EXERCISE
D et T fixés, que devient approximativement le nombre de paramètres des blocs si on passe de 2 à 6 couches ? Il est multiplié par 3. La fenêtre, elle, n'a pas changé.
@BUILD
n_layers est un champ de GPTConfig. parameter_count() grandit quand on l'augmente. Tu peux le vérifier en construisant deux TinyGPT dans un script de trois lignes.
@QUESTION
Empiler les blocs sans changer D ni T multiplie surtout le coût par…
@CORRECT
Le nombre de blocs
@WRONG
- Le carré du nombre de blocs
- La racine du nombre de blocs
- La taille du vocabulaire au carré
@EXPLANATION
Chaque bloc ajoute ses matrices. L'attention reste quadratique en T à l'intérieur de chaque bloc, mais la profondeur elle-même entre linéairement.
@@@
@ID 4.13
@TITLE Modèle decoder-only
@TAG Modèle
@MINUTES 35
@WHY
Le modèle qu'on construit est un décodeur seul : il lit le passé et prédit la suite. Il n'a pas un encodeur séparé qui aurait vu toute la phrase source.
@OBJECTIVES
- Décrire le trajet embedding, blocs, tête
- Expliquer l'absence d'encodeur
- Vérifier la forme des logits
@PREREQ Empilement, étape 4.12.
@INTUITION
Un décodeur écrit la suite. Un encodeur, dans la traduction ancienne, lisait toute la phrase source d'un coup. Pour un modèle de langue qui continue un texte, la source et la cible sont le même flux : le décodeur suffit.
@VOCAB
Decoder-only : uniquement des blocs causaux. Tête de sortie : la matrice qui passe de D à V. Encodeur : un stack non causal, absent ici. GPT : le surnom usuel de cette famille.
@EXPLAIN
Le trajet du mini-GPT est : identifiants, embedding de token, plus position si elle est absolue, n blocs causaux, norme finale, produit par la tête vers V logits. Il n'y a pas de second stack. Le masque est causal partout. C'est le modèle qu'on peut entraîner avec la tâche next-token du niveau 3. Un encodeur-décodeur servirait si l'entrée et la sortie étaient deux séquences différentes, comme une traduction. On ne le construit pas : il ajouterait des pièces sans servir le fil rouge. La forme testée est (1, 5, 12) pour cinq tokens et un vocabulaire de 12.
@LANG python
@CODE
:::
import numpy as np
from model.transformer import GPTConfig, TinyGPT
modele = TinyGPT(GPTConfig(vocab_size=12, d_model=16, n_heads=4, n_layers=2, block_size=8, seed=2))
logits, _ = modele.forward(np.array([[1, 2, 3, 4, 5]]))
print(logits.shape)
:::
@EXPERIMENT
La forme doit être (1, 5, 12). Change le vocabulaire à 7, reconstruis le modèle, et vérifie que le dernier axe suit.
@EXERCISE
Liste dans l'ordre les étapes du trajet, de l'identifiant au logit. Barre « encodeur » : il n'y en a pas.
@BUILD
TinyGPT est le modèle decoder-only du fil rouge. Le composant « Transformer » de la page modèle se débloque à cette étape.
@QUESTION
Un modèle decoder-only pour le langage…
@CORRECT
Prédit la suite par des blocs causaux
@WRONG
- Lit tout le texte futur avant de prédire
- Exige un encodeur séparé pour chaque prompt
- Prédit seulement une classe pour le document entier
@EXPLANATION
Le décodeur causal suffit pour continuer une séquence. L'encodeur n'est pas dans ce schéma.
@@@
@ID 4.14
@TITLE Entraîner et générer
@TAG Modèle
@MINUTES 40
@WHY
Le dessin du Transformer ne vaut que s'il se comporte : causalité, cache cohérent avec le forward complet, génération qui allonge la séquence d'un token.
@OBJECTIVES
- Relier la loss next-token aux logits
- Vérifier le cache KV sur un pas
- Générer en mode glouton
@PREREQ Decoder-only, étape 4.13, et la boucle du niveau 3.
@INTUITION
Entraîner, c'est la même boucle qu'au bigramme neuronal : logits, cross-entropy, gradient, pas. Générer, c'est avancer d'un token. Le cache évite de recalculer les clés et valeurs déjà figées.
@VOCAB
Cache KV : les clés et valeurs des tokens passés, réutilisées. Pas glouton : température 0, on prend l'argmax. Cohérence : le forward par morceaux égale le forward d'un coup.
@EXPLAIN
Le decoder standard est entièrement entraînable dans model/gpt_train.py : positions absolues, LayerNorm, attention multi-têtes, FFN GELU, résidus et tête de langage. logits_tensor reconstitue le forward avec des Tensor ; sequence_loss décale entrée et cible ; backward calcule tous les gradients et AdamW modifie les paramètres. Le test compare aussi le forward autograd au forward NumPy et vérifie un gradient d'attention par différence finie. En génération, les poids restent fixes et un token est ajouté au contexte. Le cache doit retrouver les logits du calcul complet, sans lire le futur. Lance le TP 12 : entraîne depuis une graine, mesure train et validation, recharge le checkpoint, puis compare le GPT au bigramme et à l'uniforme. Un résultat insuffisant doit être expliqué, pas caché. Le laboratoire entraîne aussi RMSNorm, RoPE, SwiGLU, GQA et les poids partagés (niveau 5) ; seul le dos hybride reste un forward exploratoire.
@LANG python
@CODE
:::
from model.gpt_train import train_gpt, sample_text
texte = "le chat dort. le chien court.\n" * 40
m, tok, r = train_gpt(texte, steps=40, batch=2, block=8,
    d_model=8, n_heads=2, n_layers=1, sample=False, eval_windows=2)
assert r.train_loss_end < r.train_loss_start
print("train", r.train_loss_end, "validation", r.val_loss_end)
print(sample_text(m, tok, "le ", 12, temperature=0, top_k=1, seed=0))
:::
@EXPERIMENT
Lance le test test_transformer_shapes_cache_and_causality. Il doit passer. Lis le message si tu le modifies : la causalité est le premier invariant à ne pas casser.
@EXERCISE
Dans ton atelier, termine decoder, loss et le pas AdamW. Lance verifier.py puis entrainer.py sur le corpus jouet. Joins les pertes train/validation, les baselines, une génération et le contrôle de rechargement. Indique ce que cette tâche simple ne prouve pas.
@BUILD
La sortie de ce niveau est un GPT standard réellement entraîné. atelier/GUIDE.md décrit le TP 12 et l'épreuve finale. Le fichier model/gpt_train.py est la référence ; garde tes propres poids et rapports dans runs/, pas dans les fichiers publiés.
@QUESTION
Quelles briques l'entraînement du GPT standard met-il à jour ?
@CORRECT
Embeddings, attention, FFN, normes et tête de sortie
@WRONG
- Seulement la matrice de sortie
- Seulement les embeddings d’entrée
- Seulement les poids de l’attention
@EXPLANATION
Le graphe de logits_tensor traverse tous ces paramètres. Le backward et AdamW les mettent à jour. La génération seule, elle, ne change pas les poids.
@CODEFILE
model/gpt_train.py
@SYMBOL
sequence_loss
