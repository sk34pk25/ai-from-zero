@@@
@ID 1.1
@TITLE Qu'est-ce qu'apprendre ?
@TAG Apprentissage
@MINUTES 25
@WHY
Avant d'écrire un réseau, il faut séparer un programme dont les règles sont écrites à la main et un programme dont certains nombres sont ajustés pour réduire une erreur mesurée.
@OBJECTIVES
- Définir un exemple, une prédiction et une erreur
- Distinguer règle écrite et paramètre ajusté
- Décrire le cycle données, prédiction, erreur, mise à jour
@PREREQ Le niveau 0, en particulier fonctions et dérivée intuitive.
@INTUITION
Pour trier des pommes, tu peux écrire « si elle est plus lourde que 150 g, elle est à tarte ». Tu peux aussi proposer une bascule dont le seuil est un nombre, montrer des pommes déjà triées, et laisser le seuil bouger jusqu'à ce que les erreurs diminuent. Le second geste est l'apprentissage.
@VOCAB
Exemple : une observation. Prédiction : la sortie du modèle. Erreur : l'écart entre prédiction et cible. Apprentissage supervisé : la cible est fournie. Paramètre : nombre ajusté par l'entraînement.
@EXPLAIN
Dans y = 2x + 1, le 2 et le 1 sont écrits par toi : rien n'apprend. Dans y = w x + b, w et b peuvent bouger. Le cycle est stable du petit modèle au Transformer : on montre des exemples, le modèle prédit, une loss résume l'erreur, un algorithme modifie les paramètres, on recommence. Apprendre n'est pas « mémoriser le fichier » ni « télécharger un modèle ». C'est réduire une mesure, sur des données, en changeant des nombres. Si la mesure est mal choisie, le modèle apprend fidèlement la mauvaise chose.
@LANG python
@CODE
:::
def predire(x, w, b):
    return w * x + b

exemples = [(1, 3), (2, 5), (3, 7)]
for x, cible in exemples:
    print(x, predire(x, 2, 1), cible)
:::
@EXPERIMENT
Change w de 2 à 0 et regarde les prédictions s'éloigner des cibles. Remets 2. L'apprentissage cherchera tout seul un w proche de 2.
@EXERCISE
Pour les exemples (1, 2), (2, 4), (3, 6), propose à la main un w et un b qui annulent l'erreur. Explique ce qui est programmé (la forme w*x+b) et ce qui est appris (les valeurs).
@BUILD
model/mlp.py entraîne justement y ≈ w x + b. Le test test_neuron_and_regression vérifie que w se rapproche de 3 et b de -1 sur une droite connue.
@QUESTION
Que modifie principalement un entraînement supervisé ?
@CORRECT
Les valeurs des paramètres internes du modèle
@WRONG
- Les cibles de validation pour réduire l’erreur
- Le découpage du jeu de test à chaque pas
- Les instructions du programme à chaque exemple
@EXPLANATION
L'entraînement ajuste des nombres internes. Le code qui décrit la forme du modèle reste le tien, et le matériel ne change pas.
@@@
@ID 1.2
@TITLE Données, features et labels
@TAG Données
@MINUTES 25
@WHY
Un modèle n'apprend pas « les données » en général. Il apprend une relation entre ce qu'on lui donne et ce qu'on lui demande de retrouver. Si tu mélanges les deux, il triche sans que tu le voies.
@OBJECTIVES
- Nommer un exemple, une feature et un label
- Construire un tableau X et un vecteur y
- Repérer une fuite d'information évidente
@PREREQ L'étape 1.1.
@INTUITION
La feature est l'indice. Le label est la réponse, présente seulement pendant l'entraînement supervisé. Donner la réponse dans les indices, c'est comme laisser l'élève copier le corrigé : la note sera parfaite et ne vaudra rien.
@VOCAB
Feature : une information d'entrée. Label, ou cible : la réponse attendue. X : le tableau des entrées, une ligne par exemple. y : les cibles alignées sur ces lignes.
@EXPLAIN
Pour prédire un prix, la surface et le nombre de pièces sont des features, le prix est le label. Dans un tableau, chaque ligne de X est un exemple et y[i] est la cible de cette ligne. L'ordre doit coïncider : permuter y sans permuter X apprend un mensonge. Pour le langage, plus tard, la feature sera le contexte de tokens et le label sera le token suivant. Ce n'est pas une autre théorie, c'est le même couple X, y.
@LANG python
@CODE
:::
X = [[1.0], [2.0], [3.0]]
y = [2.0, 4.0, 6.0]
for features, cible in zip(X, y):
    print(features, cible)
:::
@EXPERIMENT
Ajoute l'exemple X = [4.0] avec la cible cohérente 8.0. Puis échange deux cibles et explique pourquoi le jeu de données devient contradictoire.
@EXERCISE
Pour un classificateur de messages « spam / pas spam », propose deux features légitimes et une feature interdite parce qu'elle contient déjà la réponse.
@BUILD
Les fonctions d'entraînement du laboratoire attendent des tableaux alignés : train_linear_regression(x, y) et train_linear_classifier(features, targets). Une shape incompatible lève ValueError avant le premier pas.
@QUESTION
Dans une prédiction de prix, le prix observé est en général…
@CORRECT
Le label : la réponse connue pendant l’apprentissage
@WRONG
- Une feature disponible à la prédiction
- Le poids ajusté par l’optimiseur
- L’identifiant de la ligne de données
@EXPLANATION
Le prix est ce qu'on demande au modèle de retrouver. Le mettre aussi dans les entrées fuite la réponse.
@@@
@ID 1.3
@TITLE Train, validation et test
@TAG Méthode
@MINUTES 30
@WHY
Un modèle peut réciter ses exemples. Le découpage des données sert à ne pas confondre cette récitation avec une capacité à prédire du nouveau.
@OBJECTIVES
- Attribuer un rôle à train, validation et test
- Découper une suite sans mélanger les rôles
- Expliquer pourquoi le test ne sert pas à choisir le modèle
@PREREQ Features et labels, étape 1.2.
@INTUITION
Tu révises sur des exercices, tu t'entraînes sur des examens blancs, et le vrai examen n'est ouvert qu'une fois. Si tu choisis tes révisions en regardant le vrai examen, la note ne mesure plus rien.
@VOCAB
Train : données utilisées pour modifier les paramètres. Validation : données pour choisir un réglage, comme le pas d'apprentissage. Test : données gardées pour une mesure finale. Fuite : une information du test qui a influencé un choix.
@EXPLAIN
Un découpage simple d'une liste déjà mélangée : 80 % train, 10 % validation, 10 % test. Sur une séquence de tokens, on coupe dans le temps plutôt que de mélanger les tokens voisins au hasard, sinon la même phrase se retrouve des deux côtés. La validation peut être consultée plusieurs fois pour décider d'arrêter l'entraînement. Le test, idéalement, une fois. model/experiment.py coupe une séquence avec split_sequence et compare le bigramme à une baseline uniforme sur la partie test.
@LANG python
@CODE
:::
data = list(range(100))
train, val, test = data[:80], data[80:90], data[90:]
print(len(train), len(val), len(test))
:::
@EXPERIMENT
Change les bornes pour un 70/15/15 et vérifie que la somme des longueurs reste 100. Aucun indice ne doit apparaître dans deux ensembles.
@EXERCISE
Explique en trois phrases le rôle de chaque ensemble. Ajoute un exemple de triche : choisir le modèle qui a le mieux réussi sur le test, puis rapporter ce même chiffre comme résultat final.
@BUILD
bigram_versus_uniform, dans model/experiment.py, apprend les comptes sur le début de la séquence et mesure la perplexité sur la fin. Le test vérifie que cette perplexité bat celle d'un modèle uniforme.
@QUESTION
Quel ensemble sert à la mesure finale, une fois les choix faits ?
@CORRECT
Le test, réservé à la mesure finale
@WRONG
- Le train utilisé à chaque pas
- La validation utilisée pour régler le modèle
- Le corpus complet utilisé sans découpage
@EXPLANATION
Le test reste de côté jusqu'à la fin. La validation guide les choix. Le train modifie les paramètres.
@@@
@ID 1.4
@TITLE Paramètres et hyperparamètres
@TAG Cœur
@MINUTES 25
@WHY
Dire « ce modèle a 7 milliards de paramètres » ne veut rien dire tant qu'on ne sait pas ce qu'est un paramètre, et ce qui n'en est pas. On le définit dans cette étape.
@OBJECTIVES
- Reconnaître un paramètre dans y = w x + b
- Citer deux hyperparamètres
- Voir qu'un paramètre change la fonction réalisée
@PREREQ L'étape 1.1.
@INTUITION
Les paramètres sont les boutons que l'algorithme tourne. Les hyperparamètres sont les boutons que tu tournes toi-même : le nombre de tours, la taille des pas, la largeur du réseau.
@VOCAB
Paramètre : w, b, puis plus tard les matrices de poids. Hyperparamètre : learning rate, nombre de couches, taille de batch. Capacité : à quel point la famille de fonctions peut se plier.
@EXPLAIN
Dans y = w x + b, changer w change la droite. L'entraînement cherche des valeurs utiles. Le learning rate n'est pas dans cette droite : il dit de combien on a le droit de bouger w à chaque pas. Le nombre d'étapes non plus. Confondre les deux mène à « apprendre le learning rate » par erreur, ou à l'oublier dans le compte des paramètres. Un million de paramètres en float32, c'est environ 4 Mo de poids, avant la mémoire de l'optimiseur. On l'a déjà estimé au niveau 0.
@LANG python
@CODE
:::
x = 3
w, b = 2, 1
y = w * x + b
print(y)
w = 0
print(w * x + b)
:::
@EXPERIMENT
Fais varier w de 0 à 3, avec x fixé à 3 et b fixé à 1. Note y. Le learning rate n'apparaît pas : il n'existe pas encore.
@EXERCISE
Pour obtenir y = 7 quand x = 3 dans y = w x + b, propose une paire w, b. Propose-en une autre. Conclus : plusieurs paramètres peuvent réaliser la même valeur sur un seul exemple.
@BUILD
GPTConfig mélange les deux : vocab_size et d_model décrivent la forme, seed fixe l'aléa, et les tableaux dans self.params sont les paramètres. parameter_count() ne compte que ces tableaux.
@QUESTION
Lequel de ces choix est en général appris, et non fixé par toi ?
@CORRECT
La valeur numérique du poids w
@WRONG
- La formule w*x+b
- Le nombre de pas décidé avant l’essai
- Le choix de la fonction de perte
@EXPLANATION
w est un paramètre. Le pas, le nombre de tours et les noms de fichiers sont des choix humains, des hyperparamètres ou de simples réglages.
@@@
@ID 1.5
@TITLE Le neurone artificiel
@TAG Réseau
@MINUTES 35
@WHY
Un réseau large est une répétition de cette opération. La voir une fois, avec des nombres, enlève plus de mystère qu'un schéma de cent boîtes.
@OBJECTIVES
- Calculer z = x·w + b
- Identifier entrées, poids et biais
- Prédire le sens d'un changement de poids
@PREREQ Vecteurs et paramètres, étapes 0.17 et 1.4.
@INTUITION
Chaque entrée a un bouton de volume, son poids. Le neurone fait la somme des entrées réglées, ajoute un biais, et cette somme est son excitation, souvent notée z. L'activation viendra ensuite.
@VOCAB
Poids : coefficient multiplicatif. Biais : décalage ajouté, noté b. Produit scalaire : la somme pondérée. Pré-activation : z, avant la fonction non linéaire.
@EXPLAIN
Avec x = [2, 3], w = [0.5, -0.2] et b = 0.1, z = 2*0.5 + 3*(-0.2) + 0.1 = 0.5. Le biais permet une sortie non nulle même si toutes les entrées sont nulles. Sans lui, la frontière de décision passerait par l'origine. Rien n'est encore appris : on vérifie seulement l'arithmétique. model/mlp.py expose neuron(inputs, weights, bias), et le test attend exactement 0.5 sur cet exemple.
@LANG python
@CODE
:::
x1, x2 = 2.0, 3.0
w1, w2 = 0.5, -0.2
b = 0.1
z = x1 * w1 + x2 * w2 + b
print(z)
:::
@EXPERIMENT
Passe w2 de -0.2 à 0.2. Le signe de la contribution de x2 s'inverse. Calcule le nouveau z avant d'exécuter.
@EXERCISE
Ajoute une troisième entrée x3 = 1 avec w3 = 0.4. Calcule z à la main, puis avec la fonction neuron. Les deux résultats doivent coïncider.
@BUILD
Cette somme pondérée est la ligne d'une multiplication matricielle. L'étape 1.7 empilera plusieurs neurones. La fonction est déjà dans model/mlp.py pour que le test puisse la figer.
@QUESTION
Dans cet exemple, qu'est-ce qui pourra être appris plus tard ?
@CORRECT
Les poids et le biais du neurone, pendant l’entraînement
@WRONG
- Les valeurs des entrées du lot
- Le nombre de colonnes du fichier
- La formule de la fonction d’activation
@EXPLANATION
x est une donnée. w et b sont les paramètres. print ne fait qu'afficher le calcul.
@@@
@ID 1.6
@TITLE Fonctions d'activation
@TAG Réseau
@MINUTES 30
@WHY
Sans fonction non linéaire, empiler des couches linéaires reste une seule couche linéaire. L'activation est ce qui donne de la pliure. On la voit ici avec ReLU.
@OBJECTIVES
- Calculer ReLU sur quelques valeurs
- Expliquer pourquoi une composition linéaire reste linéaire
- Citer SiLU comme l'activation des blocs SwiGLU
@PREREQ Le neurone, étape 1.5.
@INTUITION
Une couche linéaire incline et déplace. En mettre deux de suite, c'est encore incliner et déplacer. ReLU casse la droite : en dessous de zéro, la sortie est plate, au-dessus elle passe. Cette cassure, répétée, permet des formes que aucune droite unique ne fait.
@VOCAB
ReLU : max(0, z). Linéaire : f(ax+by) = a f(x) + b f(y), et on passe par l'origine si on oublie le biais ; ici on parle surtout de « affine ». SiLU : z * sigmoid(z), utilisée plus tard dans SwiGLU.
@EXPLAIN
ReLU(-3) = 0, ReLU(0) = 0, ReLU(2) = 2. Elle est simple, parfois brutale : un neurone négatif ne transmet plus rien, et son gradient local est nul. Ce n'est pas toujours grave, c'est un compromis. Deux matrices de suite, W2 @ (W1 @ x), se réécrivent (W2 @ W1) @ x : une seule matrice. L'activation entre les deux empêche cette fusion. Le laboratoire utilise ReLU dans le MLP et dans les experts, et SiLU dans le FFN SwiGLU. GELU est une cousine lisse, approchée dans model/mathutil.py.
@LANG python
@CODE
:::
def relu(x):
    return max(0, x)

print(relu(-2), relu(0), relu(3))
:::
@EXPERIMENT
Trace mentalement ReLU pour -2, -1, 0, 1, 2, puis affiche-les. Remplace max par la valeur brute et observe que le négatif passe.
@EXERCISE
Montre par un petit calcul que deux fonctions « multiplier par 2 » de suite équivalent à « multiplier par 4 ». Ajoute une ReLU au milieu et montre que ce n'est plus la même chose pour une entrée négative.
@BUILD
relu est testée dans test_neuron_and_regression. silu et gelu vivent dans model/mathutil.py et servent au Transformer moderne, pas avant qu'on ait vu le FFN.
@QUESTION
Que vaut ReLU(-3) sur un nombre réel ?
@CORRECT
0, la partie négative est annulée
@WRONG
- -3, l’entrée est conservée
- 3, la valeur absolue est prise
- 1, la sortie est une probabilité
@EXPLANATION
ReLU met à zéro tout ce qui est négatif et laisse passer le reste. Ce n'est ni une valeur absolue ni une probabilité.
@@@
@ID 1.7
@TITLE Un petit réseau
@TAG Réseau
@MINUTES 35
@WHY
Le réseau est une composition : une couche, une activation, une autre couche. Le voir sur deux transformations prépare le bloc Transformer, qui sera la même idée avec d'autres pièces.
@OBJECTIVES
- Enchaîner deux couches
- Suivre un nombre à travers le calcul
- Lire la forme de la sortie
@PREREQ Activation et matrices, étapes 1.6 et 0.18.
@INTUITION
Chaque couche change de représentation. La première mélange les entrées. ReLU ferme certaines portes. La seconde mélange ce qui reste. La sortie est encore un vecteur de nombres, pas une décision magique.
@VOCAB
Couche cachée : une représentation intermédiaire, ni l'entrée ni la cible. Largeur : le nombre de neurones de cette couche. Composition : appliquer une fonction au résultat d'une autre.
@EXPLAIN
mlp_forward calcule relu(x @ W1 + b1) puis multiplie par W2 et ajoute b2. Si x a la forme (1, 2), W1 la forme (2, 2) et W2 la forme (2, 1), la sortie a la forme (1, 1). Le test du laboratoire fixe des poids identité et vérifie une valeur à la main : l'entrée [1, -1] devient [1, 0] après ReLU, puis 2 après la seconde couche. Quand ce nombre ne sort pas, ce n'est pas « l'IA qui se trompe », c'est une arithmétique à relire.
@LANG python
@CODE
:::
import numpy as np
from model.mlp import mlp_forward

x = np.array([[1.0, -1.0]])
w1 = np.array([[1.0, 0.0], [0.0, 1.0]])
b1 = np.array([0.0, 0.0])
w2 = np.array([[2.0], [4.0]])
b2 = np.array([0.0])
print(mlp_forward(x, w1, b1, w2, b2))
:::
@EXPERIMENT
Change le premier poids de W2 de 2 à 5. Prédis la nouvelle sortie avant d'exécuter. Elle doit passer de 2 à 5.
@EXERCISE
Ajoute un biais b2 égal à 0.5 et recalcule. Écris la shape de chaque étape : entrée, cachée, sortie.
@BUILD
Ce réseau est la brique « réseau » du fil rouge, débloquée à cette étape. Il reste minuscule exprès : on doit pouvoir le recalculer sur un papier.
@QUESTION
Empiler deux couches linéaires sans activation au milieu équivaut surtout à…
@CORRECT
Une seule transformation linéaire
@WRONG
- Une transformation forcément non linéaire
- Deux fois plus de classes séparables
- Une normalisation automatique des entrées
@EXPLANATION
Le produit de deux matrices est une matrice. L'activation est ce qui empêche de tout fusionner.
@@@
@ID 1.8
@TITLE Forward pass
@TAG Calcul
@MINUTES 30
@WHY
Avant de corriger un modèle, il doit produire une sortie. Ce trajet, de l'entrée vers la sortie, s'appelle le forward. Aucun poids ne change pendant ce trajet seul.
@OBJECTIVES
- Définir le forward
- Séparer prédiction et cible
- Suivre un exemple numérique jusqu'à la sortie
@PREREQ Le petit réseau, étape 1.7.
@INTUITION
Le forward est la lecture à voix haute du calcul. On part des données, on traverse les couches, on obtient une prédiction. On ne dit pas encore si elle est bonne.
@VOCAB
Forward : le calcul de la sortie. Prédiction : cette sortie. Cible : ce qu'on aurait voulu. Inférence : un forward utilisé pour répondre, sans mise à jour.
@EXPLAIN
def model(x, w, b): return w * x + b est un forward. Pour un Transformer, le forward part d'identifiants, ajoute des représentations, traverse des blocs, et produit des logits. La forme de la sortie fait partie du contrat : (batch, temps, vocabulaire) pour le mini-GPT. Le test test_transformer_shapes_cache_and_causality commence par là. Un forward peut être faux tout en « tournant » : une shape correcte ne prouve pas la bonne fonction, mais une shape fausse prouve que la suite est absurde.
@LANG python
@CODE
:::
def model(x, w, b):
    return w * x + b

prediction = model(4, 2, -1)
print(prediction)
:::
@EXPERIMENT
Calcule à la main model(4, 2, -1). Tu dois trouver 7. Change uniquement w et observe que x et b n'ont pas bougé.
@EXERCISE
Écris le forward de deux neurones sans l'entraîner. Donne un x, des poids, et la sortie numérique. Entoure la prédiction et la cible si tu en as choisi une : elles ne sont pas le même nombre.
@BUILD
TinyGPT.forward renvoie les logits et un cache. À cette étape, retiens seulement le trajet : des entiers en entrée, un tableau de scores en sortie, et aucun pas d'optimisation dans cette méthode.
@QUESTION
Le forward sert d'abord à…
@CORRECT
Calculer une sortie avec les poids actuels
@WRONG
- Calculer les gradients depuis la loss
- Modifier les paramètres avec un optimiseur
- Choisir le meilleur checkpoint sur le test
@EXPLANATION
Le forward calcule. La mise à jour des poids est un autre temps, après la mesure de l'erreur.
@@@
@ID 1.9
@TITLE Loss
@TAG Apprentissage
@MINUTES 30
@WHY
Sans un nombre qui dit « c'est mieux » ou « c'est pire », aucun algorithme ne sait dans quel sens modifier un poids. Cette leçon nomme ce nombre : la loss.
@OBJECTIVES
- Calculer une erreur quadratique
- Dire pourquoi on met l'erreur au carré
- Comparer deux prédictions avec la même cible
@PREREQ Forward, étape 1.8.
@INTUITION
La loss transforme un écart en un coût à diminuer. Elle ne dit pas que le modèle est « intelligent ». Elle dit qu'il est plus ou moins proche de la cible qu'on a choisie, selon la règle qu'on a choisie.
@VOCAB
Loss, ou fonction de coût : le nombre à minimiser. MSE : moyenne des carrés des écarts. Résidu : prédiction moins cible. Réduction : la façon de passer de plusieurs écarts à un seul nombre, ici la moyenne.
@EXPLAIN
Si la prédiction vaut 5 et la cible 7, l'écart vaut -2 et le carré vaut 4. Le carré empêche un écart de +3 et un écart de -3 de s'annuler. Il punit aussi plus fort les gros écarts. Ce n'est pas la seule loss honnête : l'erreur absolue existe, et la cross-entropy sera la loss du langage. Choisir la loss, c'est choisir ce que « mieux » veut dire. Une loss qui baisse sur le train peut monter sur la validation : on mesurera les deux.
@LANG python
@CODE
:::
prediction, cible = 5.0, 7.0
loss = (prediction - cible) ** 2
print(loss)
:::
@EXPERIMENT
Essaie les prédictions 6, 7 et 9 avec la cible 7. Classe-les de la meilleure à la pire selon cette loss.
@EXERCISE
Calcule la loss quadratique pour une prédiction de 10 et une cible de 6. Puis pour deux exemples, 10 contre 6 et 0 contre 0, et donne la moyenne.
@BUILD
train_linear_regression minimise exactement cette moyenne de carrés. Son historique losses doit descendre : c'est le contrat du test, pas une impression.
@QUESTION
Pourquoi mettre l'écart au carré dans cette loss ?
@CORRECT
Éviter l’annulation et amplifier les grands écarts
@WRONG
- Conserver le signe pour savoir quel poids modifier
- Rendre chaque erreur indépendante de son amplitude
- Garantir une loss plus petite que l’erreur absolue
@EXPLANATION
Le carré est positif. Deux erreurs de signes opposés ne se compensent plus, et une grande erreur pèse plus que deux petites.
@@@
@ID 1.10
@TITLE Gradient
@TAG Apprentissage
@MINUTES 35
@WHY
La dérivée disait comment une sortie bouge quand une entrée bouge. Le gradient dit comment la loss bouge quand chaque paramètre bouge. C'est la boussole de l'entraînement.
@OBJECTIVES
- Lire le signe d'une composante de gradient
- Relier gradient et dérivées partielles
- Écrire une mise à jour qui soustrait le gradient
@PREREQ Dérivée intuitive et loss, étapes 0.20 et 1.9.
@INTUITION
S'il y a trois boutons, le gradient a trois flèches : pour chaque bouton, est-ce que la loss monte quand on le tourne vers la droite ? On n'a pas besoin de la colline entière. On a besoin de la pente ici.
@VOCAB
Dérivée partielle : la dérivée selon un paramètre, les autres étant fixes. Gradient : le vecteur de ces dérivées. Descente : soustraire une fraction du gradient. Pas, ou learning rate : cette fraction.
@EXPLAIN
Pour la loss (w - 3)², la dérivée en w vaut 2(w - 3). En w = 1, elle vaut -4 : la loss descendrait si on augmentait w, ce qui est cohérent parce que 1 est à gauche de 3. La mise à jour w = w - lr * gradient ajoute donc quelque chose quand le gradient est négatif. Le test numérique du laboratoire compare un gradient écrit à la main à numerical_derivative. On fera la même chose pour la cross-entropy : le gradient analytique doit coller à la pente mesurée.
@LANG python
@CODE
:::
w = 1.0
gradient = 2 * (w - 3)
lr = 0.1
w = w - lr * gradient
print(w)
:::
@EXPERIMENT
Part de w = 5, gradient positif. Vérifie que la mise à jour diminue w. Part de w = 0, gradient négatif, et vérifie qu'elle l'augmente.
@EXERCISE
Calcule la mise à jour pour w = 3, gradient = -4, lr = 0.1. Le nouveau w doit valoir 3.4. Dis si on s'éloigne ou on se rapproche d'une cible située en 3 : ici on s'en éloigne, parce que le gradient donné n'est pas celui de (w-3)².
@BUILD
cross_entropy_grad dans model/mathutil.py est le gradient des logits. Le test test_softmax_and_cross_entropy_gradient le compare à une différence finie. C'est le même réflexe que cette leçon, sur une loss de langage.
@QUESTION
Si le gradient d'un poids est positif, la descente de gradient…
@CORRECT
Diminue ce poids si le pas est positif
@WRONG
- Augmente ce poids si le pas est positif
- Remplace ce poids par le gradient
- Laisse ce poids fixe jusqu’au prochain epoch
@EXPLANATION
La règle est w := w - lr * gradient. Un gradient positif fait donc diminuer w, ce qui est le sens où la loss locale redescend.
@@@
@ID 1.11
@TITLE Règle de chaîne
@TAG Apprentissage
@MINUTES 35
@WHY
La loss ne dépend presque jamais directement du premier poids. Elle dépend d'une sortie, qui dépend d'une couche, qui dépend du poids. La règle de chaîne assemble ces sensibilités.
@OBJECTIVES
- Décomposer une fonction composée
- Multiplier les dérivées le long du chemin
- Relier cette règle au backward
@PREREQ Gradient, étape 1.10.
@INTUITION
Si un robinet influence un seau, et le seau influence une fuite, l'effet du robinet sur la fuite est le produit des deux effets. Rater un maillon, c'est inventer une pente.
@VOCAB
Composition : f(g(x)). Règle de chaîne : la dérivée d'une composition est le produit des dérivées. Graphe de calcul : les opérations dessinées comme des nœuds. Feuille : une entrée ou un paramètre.
@EXPLAIN
Soit u = 2x et y = u². Alors dy/dx = dy/du * du/dx = 2u * 2. En x = 3, u = 6 et la dérivée vaut 24. On peut le vérifier : y = (2x)² = 4 x², dont la dérivée est 8x, et 8*3 = 24. Le backward d'un réseau n'est que cette multiplication, appliquée à chaque opération du forward, en sens inverse. Pas de nouvelle théorie à chaque couche : une règle locale, et le graphe.
@LANG python
@CODE
:::
x = 3.0
u = 2 * x
y = u * u
dy_du = 2 * u
du_dx = 2
dy_dx = dy_du * du_dx
print(u, y, dy_dx)
:::
@EXPERIMENT
Remplace x par 1 et refais le produit des dérivées. Compare à la dérivée de 4 x², qui vaut 8x.
@EXERCISE
Décompose y = (3x + 1)² en u = 3x + 1 puis y = u². Donne dy/dx en x = 1. Tu dois trouver 24, car u = 4, dy/du = 8, du/dx = 3, produit 24.
@BUILD
Le graphe de TinyGPT est trop long pour être dérivé au tableau dans cette leçon. On le prépare : chaque opération de model/mathutil.py a une dérivée locale, et le test de gradient vérifie la chaîne sur la loss finale.
@QUESTION
La règle de chaîne sert à dériver…
@CORRECT
Une composée, via les dérivées des étapes
@WRONG
- Une somme, via le produit de ses termes
- Un produit, via la somme de ses facteurs
- Une constante, via la dérivée de sa valeur
@EXPLANATION
Dès qu'une sortie dépend d'une suite d'opérations, la sensibilité totale est le produit des sensibilités locales.
@@@
@ID 1.12
@TITLE Backpropagation
@TAG Apprentissage
@MINUTES 40
@WHY
Recalculer une différence finie pour chaque paramètre d'un Transformer est hors de prix. La backpropagation réutilise les intermédiaires du forward pour obtenir tous les gradients en une passe arrière.
@OBJECTIVES
- Opposer forward et backward
- Dire ce qui est réutilisé du forward
- Vérifier un petit gradient à la main
@PREREQ Règle de chaîne, étape 1.11.
@INTUITION
Le forward a déjà calculé u, z, la loss. Le backward repart de la loss et demande, opération par opération : si ma sortie avait été un peu plus grande, qui en amont devrait bouger ? On ne refait pas le graphe, on le remonte.
@VOCAB
Backward : la passe arrière. Gradient local : la dérivée d'une opération. Accumulation : sommer les gradients si un paramètre sert à plusieurs endroits. Autograd : un programme qui fait ce backward tout seul.
@EXPLAIN
Pour L = (w*x+b-y)², dL/dw = 2(w*x+b-y)*x. La backpropagation réutilise cette règle locale en parcourant le graphe du résultat vers les entrées. Si un même paramètre est utilisé deux fois, il reçoit la SOMME des contributions : pour y=w*w, il existe deux chemins vers w. Dans model/autograd.py, Tensor garde data, grad, ses parents et une fonction _backward. backward construit un ordre topologique puis visite cet ordre à l'envers. Une classe regroupe ici ces données et méthodes : Tensor(3.) crée un objet, w.data lit sa valeur, w.backward() appelle sa méthode. Dans le TP 5, tu écriras d'abord ce mécanisme sur des scalaires, avant de lire les opérations sur tableaux. Le forward doit être reconstruit à chaque lot ; remettre seulement les poids à zéro n'efface pas des gradients intermédiaires d'un ancien graphe.
@LANG python
@CODE
:::
from model.autograd import Tensor
w = Tensor(3.0)
y = w * w + w
y.backward()
print(float(y.data), float(w.grad))
assert float(w.grad) == 7.0
:::
@EXPERIMENT
Dessine les trois contributions de w dans w*w+w : w, w et 1. Vérifie que le résultat est 7 en w=3, puis change w=2 dans un nouveau graphe et prédis le gradient avant d'exécuter.
@EXERCISE
Dessine trois boîtes : x et w entrent dans « produit », le produit entre dans « carré de l'écart », la loss sort. Ajoute des flèches backward. Écris sous chaque flèche quelle quantité est multipliée.
@BUILD
Ouvre Tensor.backward et Tensor.__mul__ dans model/autograd.py. Complète ensuite le TP 5 : une valeur scalaire, des parents, des gradients qui s'ajoutent et un parcours inverse. La même règle entraîne les tableaux du GPT.
@QUESTION
Le backward calcule surtout…
@CORRECT
Les gradients de la loss vers les paramètres
@WRONG
- Les prochaines cibles à partir des logits
- Les nouveaux poids sans utiliser d’optimiseur
- Les probabilités à partir des scores bruts
@EXPLANATION
La passe arrière ne crée pas de données. Elle attribue à chaque paramètre sa part de responsabilité dans la loss.
@CODEFILE
model/autograd.py
@SYMBOL
Tensor.backward

@@@
@ID 1.13
@TITLE Descente de gradient
@TAG Optimisation
@MINUTES 30
@WHY
Avoir le gradient ne bouge encore aucun poids. La descente est la règle qui transforme ce vecteur en un pas. Sans cette règle, le gradient reste un diagnostic.
@OBJECTIVES
- Écrire w := w - lr * gradient
- Voir l'effet d'un pas trop grand
- Relier plusieurs pas à une trajectoire
@PREREQ Gradient, étape 1.10.
@INTUITION
Tu es dans le brouillard sur une colline. Le gradient te dit où ça monte. Tu fais un petit pas dans l'autre sens. Trop petit, tu n'avances pas. Trop grand, tu passes de l'autre côté et tu remontes.
@VOCAB
Learning rate : taille du pas. Itération : un pas. Trajectoire : la suite des valeurs du paramètre. Divergence : la loss explose parce que le pas est trop grand.
@EXPLAIN
Sur loss = (w - 3)², le gradient 2(w-3) pointe vers la montée. En partant de 0 avec un pas de 0.1, w se rapproche de 3. Avec un pas de 1, la mise à jour w := w - 1 * 2(w-3) = 6 - w : on saute de l'autre côté de 3 et on oscille. Avec un pas de 1.1, on s'éloigne. Le pas n'est pas un détail d'implémentation. C'est le réglage qui décide si la théorie « la pente indique la descente » se traduit par une loss qui baisse vraiment.
@LANG python
@CODE
:::
w = 0.0
lr = 0.1
for step in range(6):
    gradient = 2 * (w - 3)
    w = w - lr * gradient
    print(step, round(w, 3))
:::
@EXPERIMENT
Relance avec lr = 0.9 puis lr = 1.1. Note si w se rapproche de 3, oscille, ou s'enfuit.
@EXERCISE
Fais à la main deux pas depuis w = 0 avec lr = 0.5. Gradient initial : 2(0-3) = -6. Premier w : 3. Que vaut le gradient ensuite ? Il est nul : tu as atterri sur le minimum en un pas. Explique pourquoi ce coup de chance ne se généralise pas à un réseau.
@BUILD
train_linear_regression utilise cette règle sur w et b. Le test choisit un lr qui converge. Tu peux, dans une copie, mettre lr = 5 et observer l'échec : c'est l'expérience, pas un bug du test.
@QUESTION
Le learning rate contrôle…
@CORRECT
L’amplitude des mises à jour appliquées aux paramètres
@WRONG
- Le nombre de paramètres du réseau
- La taille du vocabulaire après tokenisation
- La proportion de validation dans le corpus
@EXPLANATION
Le pas multiplie le gradient. Il ne change ni le vocabulaire ni le sens mathématique de la loss.
@@@
@ID 1.14
@TITLE Optimiseurs
@TAG Optimisation
@MINUTES 30
@WHY
La descente simple utilise le gradient nu. Un optimiseur peut le lisser, le mettre à l'échelle, ou garder une moyenne des pas précédents. Il faut savoir ce qu'on compare.
@OBJECTIVES
- Reconnaître SGD
- Décrire l'idée d'Adam sans confondre les termes
- Dire ce que l'optimiseur ne décide pas
@PREREQ Descente de gradient, étape 1.13.
@INTUITION
SGD regarde la pente du pas actuel. Un optimiseur à mémoire regarde aussi les pas d'avant : si la pente dit toujours la même chose, il prend de l'assurance. S'il dit n'importe quoi, il se méfie.
@VOCAB
SGD : soustraire lr fois le gradient. Momentum : une moyenne des gradients passés. Adam : une moyenne du gradient et une moyenne de son carré, pour adapter le pas par paramètre. État d'optimiseur : ces moyennes, qui occupent de la mémoire.
@EXPLAIN
SGD retire lr fois le gradient. Adam conserve deux moyennes exponentielles : m du gradient et v de son carré. Au pas t, corrige leur démarrage à zéro : m_hat=m/(1-beta1**t), v_hat=v/(1-beta2**t), puis retire lr*m_hat/(sqrt(v_hat)+eps). AdamW ajoute une décroissance des poids découplée du gradient ; le laboratoire l'applique aux matrices, pas aux gains et biais. Dans model/gpt_train.py, AdamW met réellement à jour tout le GPT standard. Deux états float32 représentent huit octets par paramètre ; notre NumPy float64 utilise davantage. L'atelier te fait coder le pas AdamW et comparer plusieurs pas à un calcul connu. Un optimiseur ne choisit ni les données ni la loss : il transforme les gradients en déplacements.
@LANG python
@CODE
:::
import numpy as np
from model.autograd import Tensor
from model.gpt_train import AdamW
w = Tensor(np.array([1.0]))
w.grad[:] = 0.5
optim = AdamW({"w": w}, lr=0.1, weight_decay=0.0)
optim.step(clip=0)
assert np.allclose(w.data, [0.9])
print(w.data)
:::
@EXPERIMENT
Applique deux fois SGD avec le même gradient 0.5 et lr 0.1, en partant de 1. Compare à un pas unique de lr 0.2. Sur un gradient constant, deux petits pas et un grand pas ne tombent pas au même endroit si tu recalcules le gradient, mais ici il est fixé : calcule les deux résultats.
@EXERCISE
Explique en deux phrases pourquoi Adam peut prendre plus de RAM que SGD pour le même nombre de paramètres. Le chiffre du laboratoire est 8 octets supplémentaires par paramètre.
@BUILD
Le TP 11 implémente moments, correction de biais et AdamW. model/gpt_train.py est la référence à comparer après ton essai. Les moments et le compteur font partie d'un checkpoint de reprise exacte.
@QUESTION
Un optimiseur décide comment…
@CORRECT
Convertir les gradients en mises à jour
@WRONG
- Convertir les logits en probabilités
- Remplacer la loss par une exactitude
- Choisir les cibles du prochain lot
@EXPLANATION
L'optimiseur reçoit des gradients. La loss les a produits, le tokenizer n'a rien à voir avec ce choix.
@CODEFILE
model/gpt_train.py
@SYMBOL
AdamW.step

@@@
@ID 1.15
@TITLE Tenseurs et autograd
@TAG PyTorch
@MINUTES 35
@WHY
PyTorch automatise les tableaux et le backward que tu viens d'écrire à la main. Le voir après le calcul manuel évite de le prendre pour une boîte noire. Le laboratoire reste en NumPy pour être léger et explicite.
@OBJECTIVES
- Reconnaître un tenseur et requires_grad
- Lire le trio backward, grad, zero_grad
- Savoir ce que le dépôt implémente à la place
@PREREQ Backpropagation, étape 1.12.
@INTUITION
Un tenseur est un tableau qui peut se souvenir des opérations subies. Si tu le déclares « je veux les dérivées », PyTorch enregistre le graphe pendant le forward et peut le remonter au backward.
@VOCAB
Tenseur : tableau à N dimensions. requires_grad : demande le suivi des dérivées. .grad : le gradient accumulé. zero_grad : remet ces cases à zéro. Autograd : le moteur du backward automatique.
@EXPLAIN
Un tenseur est un tableau dont on suit certaines dépendances. Le laboratoire construit son propre Tensor dans model/autograd.py ; aucune installation de PyTorch n'est nécessaire. requires_grad dit de suivre le gradient pour cette valeur. Le forward crée de nouveaux objets qui gardent leurs parents ; loss.backward() remplit les grad en sens inverse. L'addition utilise le broadcasting NumPy et son backward réduit les axes diffusés : un biais partagé par deux lignes reçoit la somme de leurs gradients. L'embedding doit aussi additionner deux lectures du même token avec np.add.at. PyTorch applique les mêmes principes à plus de dispositifs ; sa gestion de graphes ne doit pas être confondue avec ce moteur minimal. À chaque pas du laboratoire, zéro des gradients des paramètres, nouveau forward, backward puis optimisation.
@LANG python
@CODE
:::
import numpy as np
from model.autograd import Tensor
x = Tensor(np.ones((2, 3)))
biais = Tensor(np.zeros(3))
(x + biais).sum().backward()
assert np.array_equal(biais.grad, [2., 2., 2.])
print(biais.grad)
:::
@EXPERIMENT
Calcule 2*(w-3) pour w = 1 et w = 4. Les signes doivent être opposés. Si tu as PyTorch, compare à w.grad. Sinon, la valeur -4 suffit comme contrôle.
@EXERCISE
Deux lignes de trois valeurs utilisent le même biais. La loss est la somme de toutes les sorties : quelle shape et quelles valeurs a le gradient du biais ? Vérifie, pour chacune des trois composantes du biais, les deux contributions, puis explique pourquoi on somme au lieu de garder (2,3).
@BUILD
Après le moteur scalaire, lis _unbroadcast, Tensor.matmul et embedding dans model/autograd.py. Le TP 6 contrôle la réduction du gradient de broadcasting. Le complément numérique ci-dessous vérifie les lectures répétées d’un embedding ; les TP 7 et 10 vérifient aussi des dérivées par différences finies.
@QUESTION
requires_grad=True indique surtout que…
@CORRECT
Le suivi du gradient des opérations du tenseur
@WRONG
- Mettre les gradients à zéro immédiatement
- Appliquer automatiquement un pas SGD
- Forcer les données du tenseur à être positives
@EXPLANATION
Ce drapeau active le suivi du graphe. Il ne choisit pas le matériel et ne sauvegarde rien tout seul.
@CODEFILE
model/autograd.py
@SYMBOL
_unbroadcast

@@@
@ID 1.16
@TITLE Boucle d'entraînement
@TAG Entraînement
@MINUTES 35
@WHY
Les pièces sont là : forward, loss, backward, pas. La boucle les remet dans un ordre strict. Un ordre faux donne un modèle qui n'apprend pas, sans erreur de syntaxe.
@OBJECTIVES
- Citer l'ordre des opérations d'un pas
- Dire pourquoi on remet les gradients à zéro
- Lire une loss qui descend sur un problème simple
@PREREQ Optimiseur et autograd, étapes 1.14 et 1.15.
@INTUITION
Chaque tour est une répétition honnête : je prédis avec les poids actuels, je mesure, je calcule les pentes, je fais un pas, et j'oublie les pentes pour ne pas les additionner au tour suivant.
@VOCAB
Époque : un passage sur les données prévues. Pas, ou step : une mise à jour. Batch : le paquet d'exemples du pas. Historique : la suite des losses, pour voir si ça descend.
@EXPLAIN
L'ordre minimal : prédiction = modèle(x) ; loss = coût(prédiction, y) ; gradients à zéro ; backward ; pas de l'optimiseur. Oublier la remise à zéro accumule. Faire le pas avant le backward utilise les anciens gradients. En NumPy, train_linear_classifier enchaîne logits, cross-entropy, gradient, mise à jour, et garde la liste des losses. Le test exige que la dernière vaille moins de 70 % de la première sur un problème linéairement séparable. C'est un critère net, pas une courbe regardée de loin.
@LANG python
@CODE
:::
import numpy as np
from model.autograd import Tensor
from model.gpt_train import AdamW
w = Tensor(np.array([0.0]))
optim = AdamW({"w": w}, lr=0.1, weight_decay=0.0)
for _ in range(5):
    w.zero_grad()
    loss = ((w - 3) * (w - 3)).mean()
    loss.backward()
    optim.step()
print(float(loss.data), w.data)
:::
@EXPERIMENT
Dans un script à toi, appelle train_linear_regression sur y = 3x - 1 et affiche les cinq premières et les cinq dernières losses. Elles doivent descendre.
@EXERCISE
Écris les cinq opérations dans l'ordre, en français, sans code. Ajoute la phrase qui dit ce qui casse si on saute la remise à zéro des gradients.
@BUILD
Retrouve ces cinq gestes dans la boucle train_gpt : remise à zéro, forward, loss, backward, pas. Le TP 12 branchera tes logits et ta loss dans cette même boucle, avec une validation séparée.
@QUESTION
Pourquoi remettre les gradients à zéro avant chaque backward ?
@CORRECT
Sans remise à zéro, chaque backward ajoute aux gradients existants
@WRONG
- Le backward réutiliserait les anciennes données
- L’optimiseur remettrait sinon les poids à zéro
- La loss serait recalculée sur la validation
@EXPLANATION
L'accumulation est utile seulement quand on la demande, par exemple pour simuler un plus gros batch. Par défaut, un pas doit voir uniquement son propre gradient.
@CODEFILE
model/gpt_train.py
@SYMBOL
train_gpt

@@@
@ID 1.17
@TITLE Surapprentissage
@TAG Évaluation
@MINUTES 30
@WHY
Une loss d'entraînement minuscule peut accompagner un modèle inutile sur des données nouvelles. Il faut reconnaître ce décalage avant de célébrer une courbe.
@OBJECTIVES
- Définir le surapprentissage
- Comparer loss train et loss de validation
- Citer deux remèdes qui ne trichent pas avec le test
@PREREQ Boucle d'entraînement et découpage des données.
@INTUITION
Un élève qui récite les exercices corrigés échoue à l'examen si les questions changent. Le modèle peut faire pareil : coller au train, rater la validation.
@VOCAB
Overfitting : train bon, validation mauvaise. Underfitting : même le train reste mauvais, le modèle est trop pauvre ou trop peu entraîné. Régularisation : une contrainte qui limite la liberté du modèle, comme un poids trop grand pénalisé. Early stopping : s'arrêter quand la validation cesse de s'améliorer.
@EXPLAIN
train_loss = 0.01 et val_loss = 0.8 est un signal classique : le modèle a utilisé sa capacité pour le train. Les remèdes honnêtes sont plus de données, un modèle moins souple, une régularisation, ou un arrêt plus tôt guidé par la validation. Regarder le test pour décider d'arrêter, c'est transformer le test en validation. Le bigramme du laboratoire illustre une version simple : s'il est évalué sur les mêmes tokens que ceux qu'il a comptés, sa perplexité est optimiste. bigram_versus_uniform coupe donc la séquence.
@LANG python
@CODE
:::
train_loss = 0.01
val_loss = 0.8
if val_loss > 10 * train_loss:
    print("écart suspect : regarder le surapprentissage")
:::
@EXPERIMENT
Inventez deux paires (train, val) : une où les deux baissent ensemble, une où le train baisse et la val monte. Dis laquelle doit déclencher un arrêt.
@EXERCISE
Explique pourquoi baisser la loss de train n'est pas, à elle seule, une preuve que le modèle est devenu meilleur pour de nouvelles données.
@BUILD
Le fil rouge évalue le bigramme sur une fin de séquence non utilisée pour les comptes. Au niveau 12, la même discipline vaudra pour comparer deux architectures : même découpage, même métrique, pas de test consulté pendant les essais.
@QUESTION
Le surapprentissage apparaît typiquement quand…
@CORRECT
Train devient bon, validation reste mauvaise
@WRONG
- Train et validation baissent ensemble
- Train et validation restent élevés ensemble
- Les paramètres restent identiques après le backward
@EXPLANATION
L'écart train/validation est le symptôme. Une baisse conjointe est plutôt le signe que le modèle apprend encore quelque chose de transférable.
