# Les bases à reconstruire avant ton GPT

Ces activités complètent les niveaux 0 et 1. Écris une explication et un exemple différent avant de consulter la référence. Une fonction qui passe les contrôles ne suffit pas à montrer que tu la comprends.

## 1. Objets, références et méthodes

Une classe décrit des objets. `x=Valeur(3)` crée une identité avec une donnée ; `x.grad` stockera une autre donnée ; `x.backward()` appellera une méthode. `y=x` crée un deuxième nom pour le même objet. `y=Valeur(x.data)` crée un nouvel objet.

Écris une classe avec data, une méthode qui ajoute un nombre et une méthode qui renvoie un NOUVEL objet. Prédis ce que devient x quand tu modifies y dans les deux situations. Vérifie avec `is`. Recommence sans regarder ton premier fichier.

## 2. Tableaux, axes et copies

Dessine un tableau (2,3,4) : deux exemples, trois positions, quatre composantes. Numérote ses éléments de 0 à 23. Compare `reshape(2,4,3)` et `transpose(0,2,1)`. Ils ont la même forme, mais pas les mêmes valeurs aux mêmes positions.

Teste une vue `b=a[:, :2]`, puis une copie `c=b.copy()`. Modifie b et explique pourquoi a peut changer alors que c reste identique. Conserver une référence au tableau ne suffit pas pour archiver des poids avant un pas d’optimisation.

## 3. Le produit matriciel et son gradient

Pour Y=X@W, X=(B,D), W=(D,V), et un gradient reçu G=(B,V), les règles sont dX=G@W.T et dW=X.T@G. Chaque entrée de Y est une somme : c’est la règle de chaîne appliquée à cette somme.

Avec X=[[1,2],[3,4]], W=[[2],[5]], G=[[1],[1]], retrouve dW=[[4],[6]] et dX=[[2,5],[2,5]]. Puis remplace G par [[2],[-1]]. Calcule les valeurs avant d’écrire NumPy. Choisis une coordonnée de W et vérifie-la par différence finie de L=sum((X@W)*G).

## 4. Réutilisation et broadcasting

Pour y=(x+x)+(x+x), le gradient de x vaut 4. Dessine les deux sous-branches distinctes. Dans le backward, écrire `grad = contribution` peut effacer un chemin déjà traité : il faut accumuler.

Pour un biais (D,) ajouté à un tableau (B,T,D), chaque composante est utilisée B*T fois. Le gradient du biais somme les axes B et T. Si tous les gradients de sortie valent 1, B=2 et T=4 donnent [8,...,8].

Pour un embedding lu avec les IDs [0,0,1], la ligne 0 reçoit deux contributions et la ligne 1 une seule. Une affectation avancée NumPy avec des indices répétés peut perdre un cumul : vérifie ce cas explicitement, par exemple avec `np.add.at`.

## 5. Softmax, loss et stabilité

Les logits [0,ln(3)] donnent les probabilités [0,25 ; 0,75]. Pour la cible 1, la cross-entropy vaut -ln(0,75), environ 0,28768. Pour la cible 0, elle vaut -ln(0,25), environ 1,38629. Une constante log(V) ne peut pas représenter les deux.

Pour une moyenne sur N cibles, le gradient des logits vaut (p-one_hot(cible))/N. Vérifie ses signes : retirer de la loss doit augmenter le score du bon token relativement aux autres. Ajouter la même constante à tous les logits ne change pas les probabilités ni la loss.

## 6. Gradient-check : ce qu’il prouve

Comparer backward aux différences finies prouve une cohérence locale avec la fonction calculée. Si cette fonction oublie l’échelle de l’attention, les deux gradients peuvent quand même coïncider. Combine donc valeur attendue indépendante, formes, invariants, causalité et gradient.

Tu peux commencer le graphe scalaire dès le niveau 1 : `python verifier.py --tp 5`. Les contrôles `--jusqua N` restent cumulatifs. Les TP 1–3 demandent les niveaux 2–3 ; les TP 7–10 demandent le niveau 4.

## Remise courte

Explique une dérivée, un cumul et un reshape sur des nombres nouveaux. Montre un exemple où une implémentation a la bonne forme mais la mauvaise valeur. Fais relire cette explication séparément de controles.json.
