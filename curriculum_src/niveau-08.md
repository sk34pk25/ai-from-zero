@@@
@ID 8.1
@TITLE La récurrence
@TAG SSM
@MINUTES 25
@WHY
L'attention relie chaque position à toutes les précédentes. Une récurrence fait autre chose : elle résume le passé dans un état, puis le met à jour avec le token courant. C'est le geste du niveau 8, et le coût en temps redevient linéaire.
@OBJECTIVES
- Écrire une mise à jour h_t à partir de h_{t-1}
- Distinguer coût linéaire et coût quadratique
- Voir qu'un état résume, donc oublie
@PREREQ Attention causale et bigramme.
@INTUITION
Tu marches avec un carnet d'une page. À chaque pas tu corriges cette page, tu ne relis pas tout le voyage. Le carnet est petit, la marche est longue : c'est le compromis d'une récurrence.
@VOCAB
Récurrence : h_t dépend de h_{t-1} et de l'entrée x_t. État : le vecteur qui porte le passé. Coût linéaire : un travail proportionnel à T, pas à T au carré.
@EXPLAIN
Le bigramme était déjà une forme extrême de récurrence : le « passé » se réduisait au dernier token. Un état plus riche garde plusieurs nombres. Dans model/ssm.py, selective_scan part d'un état nul et, pour chaque temps, le multiplie par un facteur d'oubli puis lui ajoute une contribution de l'entrée. La sortie y_t se lit sur l'état, elle ne relit pas x_0. Changer le dernier token ne change donc pas la sortie du premier temps : le test test_ssm_matches_scan_and_is_causal le vérifie. Le prix de cette économie est l'oubli. Un état de taille S ne peut pas stocker fidèlement une liste de longueur T si T dépasse S.
@LANG python
@CODE
:::
etat = 0.0
for x in (1.0, 0.0, 0.5):
    etat = 0.5 * etat + x
    print(round(etat, 3))
:::
@EXPERIMENT
Le facteur 0,5 fait décroître le passé. Remplace-le par 1 : l'état devient la somme des x, rien n'est oublié, mais rien n'est non plus comprimé.
@EXERCISE
Avec un état scalaire et un oubli de 0, quelle information de x_0 survit à l'étape suivante ? Aucune : multiplier par 0 efface le passé.
@BUILD
La brique de départ du fil rouge est cette boucle. selective_scan la généralise à un état de taille S, avec un oubli par dimension.
@QUESTION
Pourquoi une récurrence coûte moins que l'attention quand T grandit ?
@CORRECT
Elle met à jour un état de taille fixe, sans comparer toutes les paires
@WRONG
- Elle relit toute la séquence à chaque pas
- Elle supprime le masque causal
- Elle stocke une matrice T par T
@EXPLANATION
Le travail par pas est proportionnel à la taille de l'état, pas au nombre de paires. La mémoire du passé est cet état, pas une matrice d'attention.
@@@
@ID 8.2
@TITLE L'état caché
@TAG SSM
@MINUTES 25
@WHY
L'état n'est pas la sortie. C'est une mémoire interne. Confondre les deux empêche de lire à la fois un RNN, un SSM et le cache KV, qui sont trois mémoires différentes.
@OBJECTIVES
- Séparer h_t et y_t
- Lire la forme (T, S) du scan
- Voir le rôle du signe de a
@PREREQ La récurrence de l'étape 8.1.
@INTUITION
L'état est le contenu du tiroir. La sortie est ce que tu acceptes de montrer. Deux positions peuvent partager un tiroir et produire des lectures différentes si la porte de sortie change.
@VOCAB
h_t : état au temps t, forme (S,). y_t : sortie, ici c_t multiplié par h_t. a : vecteur (S,) de l'oubli, négatif si l'état doit décroître. S : taille de l'état.
@EXPLAIN
selective_scan impose que x, b, c et delta partagent la forme (T, S), et que a ait la forme (S,). L'état commence à zéro. À chaque temps, h = exp(delta * a) * h + delta * b * x, puis y = c * h. Le docstring le dit : a doit être négatif pour oublier, parce que exp(delta * a) vaut alors moins de 1 quand delta est positif. Dans Backbone, a est initialisé par -exp(...), donc il naît négatif. Un a positif ferait grandir l'état sans borne : ce n'est pas une mémoire, c'est une explosion. La sortie peut être plus petite que l'état, ou le masquer dimension par dimension via c. Le test ne vérifie pas une valeur magique de h, il vérifie la causalité et l'égalité scan parallèle / boucle.
@LANG python
@CODE
:::
import numpy as np
from model.ssm import selective_scan
x = np.array([[1.0, 0.0], [0.0, 1.0], [0.5, -0.5]])
y = selective_scan(x, np.array([-0.2, -0.4]), np.ones_like(x), np.ones_like(x), np.full_like(x, 0.5))
print(y.shape)
:::
@EXPERIMENT
La forme doit être (3, 2) : un vecteur de sortie par temps, de la taille de l'état. Change le dernier x et vérifie que y[0] ne bouge pas.
@EXERCISE
Si a vaut 0 et delta vaut 1, que devient le facteur exp(delta * a) ? Il vaut 1 : l'état précédent est recopié, puis on ajoute b * x.
@BUILD
Le dos SSM du fil rouge appelle ce scan dans _ssm. L'état n'est pas renvoyé par forward : seule la sortie résiduelle, de forme (B, T, D), sort du module.
@QUESTION
Dans selective_scan, que doit valoir a pour qu'un état oubli un peu le passé ?
@CORRECT
Des composantes négatives, afin que exp(delta * a) soit inférieur à 1
@WRONG
- Des composantes positives pour amplifier le passé
- La même matrice que l'attention
- Un entier de vocabulaire
@EXPLANATION
delta est positif. Multiplié par un a négatif, l'exposant est négatif et le facteur d'oubli est dans (0, 1).
@@@
@ID 8.3
@TITLE Intuition d'un modèle d'état
@TAG SSM
@MINUTES 30
@WHY
Un state space model décrit un système par un état qui évolue et une observation qu'on lit. C'est le vocabulaire des articles Mamba, et il est plus vieux que les transformers : il vient du signal.
@OBJECTIVES
- Nommer état, entrée et sortie
- Relier le scan du labo à cette image
- Ne pas confondre SSM et « modèle de langage » entier
@PREREQ État caché.
@INTUITION
Pense à un réservoir. L'eau qui entre est x. Le niveau est h. Le robinet de sortie est c. Le trou au fond, qui vide un peu, est le facteur exp(delta * a). Le SSM du cours est ce réservoir, en plusieurs dimensions indépendantes.
@VOCAB
SSM : modèle d'état, état plus observation. Diagonale : chaque dimension de h évolue seule, sans mélanger les autres dans la récurrence. Discrétisation : passer d'un temps continu à un pas delta. Le laboratoire saute la forme continue et écrit directement le pas discret.
@EXPLAIN
Les articles partent souvent d'une équation continue h' = A h + B x, puis d'une discrétisation qui fait apparaître un pas delta. model/ssm.py n'implémente pas cette dérivation : il code le résultat discret h = exp(delta * a) * h + delta * b * x. C'est assumé. a est un vecteur, pas une matrice pleine, donc les dimensions ne se parlent pas pendant le scan. Le mélange entre dimensions, s'il existe, est dans les projections qui fabriquent x, b et c avant le scan, comme dans Backbone._ssm. Appeler ce bloc « le modèle » serait excessif : le tokenizer, l'embedding et le résidu restent autour. Le SSM remplace ici le mélange de l'attention, pas tout le réseau.
@LANG python
@CODE
:::
import numpy as np
from model.ssm import selective_scan
x = np.ones((4, 1))
y = selective_scan(x, np.array([-1.0]), np.ones_like(x), np.ones_like(x), np.full_like(x, 0.3))
print(np.round(y[:, 0], 3))
:::
@EXPERIMENT
Les sorties montent puis se stabilisent : le réservoir se remplit et la fuite compense l'entrée. Avec a = 0 la suite continue de croître.
@EXERCISE
Explique en une phrase pourquoi un SSM diagonal ne mélange pas les canaux pendant la récurrence. Parce que chaque coordonnée de h n'est multipliée que par son propre facteur.
@BUILD
La brique « SSM » du site s'allume à l'étape 8.7, quand ce scan est devenu sélectif et branché dans le dos. Cette leçon pose seulement l'image du réservoir.
@QUESTION
Que représente h dans le SSM de ce cours ?
@CORRECT
La mémoire interne mise à jour à chaque pas, pas la prédiction du prochain token
@WRONG
- Le vocabulaire du tokenizer
- La matrice d'attention T par T
- La loss d'entraînement
@EXPLANATION
La prédiction, plus tard, se lit sur une tête. h est l'état du scan, une mémoire comprimée du passé.
@@@
@ID 8.4
@TITLE Convolution ou récurrence
@TAG SSM
@MINUTES 30
@WHY
Un système linéaire dont les coefficients ne dépendent pas de l'entrée peut s'écrire de deux façons : une boucle, ou un produit par un noyau fixe. Cette équivalence explique pourquoi les anciens SSM s'entraînaient comme une convolution, et pourquoi la sélectivité la casse.
@OBJECTIVES
- Relier boucle et noyau fixe
- Voir que les coefficients doivent être constants
- Préparer la sélectivité, qui brise le noyau
@PREREQ Intuition SSM.
@INTUITION
Si le trou du réservoir a toujours la même taille, tu peux calculer à l'avance comment une goutte versée au temps 0 sera encore là au temps 10. C'est un noyau. Si la taille du trou dépend de ce qui entre, le calcul à l'avance ne tient plus.
@VOCAB
LTI : linear time-invariant, coefficients constants. Noyau : la suite des contributions d'une impulsion. Convolution : somme des entrées passées pondérées par ce noyau. Récurrence : la même chose, calculée pas à pas.
@EXPLAIN
Pour h_t = a * h_{t-1} + x_t avec a constant, h_3 = x_3 + a x_2 + a^2 x_1 + a^3 x_0. Les puissances de a sont le noyau. On peut donc remplacer la boucle par une convolution, pratique sur GPU quand le noyau est le même pour tout le lot. Dès que a, b ou delta dépendent de x_t, les puissances ne sont plus connues d'avance : le noyau changerait à chaque exemple. Mamba part de ce constat et revient à une récurrence, mais à une récurrence qu'on peut encore paralléliser par un scan. Le laboratoire montre les deux mondes : sequential_affine et parallel_affine supposent un a et un b déjà choisis, donc une récurrence affine ; selective_scan, lui, accepte un b et un delta différents à chaque temps.
@LANG python
@CODE
:::
a = 0.5
xs = [1.0, 0.0, 0.0, 0.0]
h = 0.0
for x in xs:
    h = a * h + x
    print(round(h, 4))
:::
@EXPERIMENT
Tu dois voir 1, puis 0,5, puis 0,25, puis 0,125 : le noyau est 1, a, a^2, a^3. Si a changeait à chaque pas, cette liste ne serait plus un noyau réutilisable.
@EXERCISE
Écris h_2 pour h_t = 0,5 h_{t-1} + x_t, en partant de h avant le premier pas égal à 0. h_2 = x_2 + 0,5 x_1 + 0,25 x_0.
@BUILD
Le fil rouge garde la forme récurrente, pas une convolution CUDA. parallel_affine montre seulement que la boucle affine a un équivalent associatif.
@QUESTION
Quand un SSM peut-il être remplacé par une convolution à noyau fixe ?
@CORRECT
Quand ses coefficients ne dépendent pas de l'entrée
@WRONG
- Quand le masque causal est retiré
- Quand on ajoute un routeur MoE
- Quand le vocabulaire dépasse 50 000
@EXPLANATION
Le noyau est la liste des puissances des coefficients. S'ils varient avec x, il n'y a plus un seul noyau à précalculer.
@@@
@ID 8.5
@TITLE Le scan parallèle
@TAG SSM
@MINUTES 35
@WHY
Une boucle Python sur T est correcte et lente. Le scan parallèle calcule la même récurrence en associant les pas, pour qu'un matériel parallèle ne soit pas condamné à attendre le temps t-1.
@OBJECTIVES
- Composer deux pas affines
- Lire Hillis-Steele dans parallel_affine
- Vérifier l'égalité avec la boucle
@PREREQ Convolution ou récurrence.
@INTUITION
« multiplier par 2 puis ajouter 3 » est une fonction. Enchaîner deux fonctions de ce genre donne encore une fonction du même genre. On peut donc regrouper des bouts de la séquence sans changer le résultat.
@VOCAB
Pas affine : h → a h + b. Composition : appliquer un pas puis un autre. Scan associatif : préfixe de compositions. Hillis-Steele : l'algorithme du laboratoire, qui double le décalage à chaque tour.
@EXPLAIN
compose_affine((a1, b1), (a2, b2)) renvoie (a2*a1, a2*b1 + b2) : d'abord le premier pas, ensuite le second. sequential_affine applique les pas dans l'ordre, en partant de h0. parallel_affine fait la même chose par doubles décalages : à l'étape offset, chaque position compose son pas avec celui situé offset plus tôt. À la fin, scales * h0 + shifts égale la boucle. Le test tire 17 pas aléatoires, h0 = 0,3, et exige pytest.approx entre les deux fonctions. Ce scan n'est pas le kernel CUDA de Mamba : c'est la preuve, en NumPy, que la récurrence affine est associative. selective_scan, lui, reste une boucle, parce que ses coefficients changent et que le cours veut le geste lisible avant le geste rapide.
@LANG python
@CODE
:::
import numpy as np
from model.ssm import parallel_affine, sequential_affine
a = np.array([0.5, 0.25, 0.8])
b = np.array([1.0, -1.0, 0.5])
print(parallel_affine(a, b, h0=0.3))
print(sequential_affine(a, b, h0=0.3))
:::
@EXPERIMENT
Les deux lignes doivent coïncider. C'est le contrat de test_ssm_matches_scan_and_is_causal, sur une série plus longue.
@EXERCISE
Compose (a, b) = (2, 3) puis (4, 5). Quel (a, b) équivalent obtiens-tu ? (8, 17), car 4*(2h+3)+5 = 8h+17.
@BUILD
Le fil rouge expose parallel_affine pour que tu puisses remplacer une boucle par un scan sans changer les nombres. Le dos n'appelle pas encore ce scan : il appelle selective_scan, plus simple à tracer.
@QUESTION
Que garantit l'égalité parallel_affine et sequential_affine ?
@CORRECT
Que le regroupement des pas affines ne change pas l'état calculé
@WRONG
- Que l'attention est inutile dans tous les cas
- Que le modèle est entraîné
- Que a doit être une matrice T par T
@EXPLANATION
Les deux fonctions calculent h_t = a_t h_{t-1} + b_t. Le test fixe cette égalité, pas une qualité de langage.
@@@
@ID 8.6
@TITLE La sélectivité
@TAG SSM
@MINUTES 30
@WHY
Un réservoir aux trous fixes traite une virgule comme un nombre. La sélectivité rend l'oubli, l'écriture et la lecture dépendants du contenu : le modèle peut garder un nom et laisser passer un mot outil.
@OBJECTIVES
- Faire dépendre b, c et delta de l'entrée
- Lire selective_params
- Voir pourquoi le noyau fixe disparaît
@PREREQ Scan parallèle et SSM diagonal.
@INTUITION
Devant un mot rare tu ouvres le carnet et tu écris. Devant un « le » tu tournes la page sans rien noter. La décision dépend du mot, pas d'un calendrier fixé à l'avance.
@VOCAB
Sélectif : les coefficients du pas dépendent de l'entrée. delta : le pas de temps, ici forcé positif. softplus : log(1+exp(z)), utilisé pour que delta ne soit pas négatif. Porte : b ou c, qui dose l'écriture et la lecture.
@EXPLAIN
selective_params projette un signal (T, D) en quatre séries : x, b, c, et delta = softplus(projection) + 1e-4. Le 1e-4 évite un pas nul. Comme b, c et delta changent avec le contenu, deux séquences de même longueur n'ont pas le même noyau : l'équivalence convolution de l'étape 8.4 ne s'applique plus. Dans Backbone._ssm le même geste est simplifié : delta = 0,05 + sigmoid(hidden * delta_vector), et b, c passent par une tanh après une projection. a reste un paramètre par dimension, négatif, pas une fonction de l'entrée. Ce n'est pas la paramétrisation complète d'un article, c'est le minimum qui rend le scan sélectif et stable. Le test de causalité s'applique encore : le futur ne réécrit pas le passé, même si les portes dépendent du présent.
@LANG python
@CODE
:::
import numpy as np
from model.ssm import selective_params
hidden = np.array([[0.2, -0.4], [1.0, 0.0]])
zeros = np.zeros((2, 2))
params = selective_params(hidden, {"in": zeros, "b": zeros, "c": zeros, "delta": zeros})
print([p.shape for p in params])
:::
@EXPERIMENT
Chaque tenseur sort en (2, 2). delta vaut softplus(0)+1e-4, donc un peu plus que log(2). Aucune valeur n'est négative.
@EXERCISE
Pourquoi ajouter 1e-4 après softplus ? Pour qu'un delta nul, qui figerait l'écriture, ne soit pas atteint par accident numérique.
@BUILD
Le dos hybride et le dos SSM utilisent cette sélectivité dans _ssm. La brique du site, à l'étape suivante, nomme cette version réduite sans la faire passer pour un Mamba complet.
@QUESTION
Qu'est-ce qui rend le scan du laboratoire sélectif ?
@CORRECT
b, c et delta dépendent du contenu, donc le pas change avec l'entrée
@WRONG
- a est une matrice d'attention
- Le vocabulaire est recalculé à chaque token
- Le masque causal est retiré
@EXPLANATION
La sélectivité est la dépendance des coefficients à l'entrée. Le scan reste causal : on ne lit pas le futur.
@@@
@ID 8.7
@TITLE Mamba, version réduite
@TAG SSM
@MINUTES 35
@WHY
Mamba est le nom d'une architecture, pas d'une ligne de code. Le fil rouge en garde l'idée — un scan sélectif à la place de l'attention — et laisse de côté le reste, pour ne pas prétendre reproduire un article.
@OBJECTIVES
- Dire ce que le labo reprend de Mamba
- Dire ce qu'il ne reprend pas
- Brancher le scan dans Backbone
@PREREQ Sélectivité.
@INTUITION
Tu construis une maquette de pont, pas le pont. La maquette montre où passe la charge. Elle ne supporte pas un train. Le scan sélectif est la charge ; la convolution courte, le kernel matériel et l'échelle d'un vrai Mamba restent hors de la maquette.
@VOCAB
Mamba : SSM sélectif proposé comme bloc de séquence, avec un scan pensé pour le GPU. Maquette : selective_scan plus un résidu dans Backbone. Hors maquette : convolution locale, paramétrisation continue complète, scan fusionné en CUDA.
@EXPLAIN
Un bloc Mamba publié combine en gros une projection élargie, une convolution courte sur le temps, un SSM sélectif, et une porte de sortie. model/backbone.py ne code pas cette liste. _ssm projette l'entrée, fabrique un delta positif, applique selective_scan avec a négatif et des portes tanh, puis le résidu ajoute ce résultat à hidden. forward renvoie (B, T, D), pas des logits. Le test test_backbone_kinds_share_shape_and_are_causal construit un Backbone(kind="ssm") et vérifie la forme (1, 4, 8) ainsi que la causalité : changer le dernier token ne change pas la position 0. Appeler ce module « Mamba » dans un README serait faux. L'appeler « scan sélectif dans un dos » est exact, et c'est ce que la brique SSM du site résume.
@LANG python
@CODE
:::
import numpy as np
from model.backbone import Backbone
modele = Backbone("ssm", vocab_size=8, d_model=8, n_layers=2, block_size=6, seed=3)
y = modele.forward(np.array([[1, 2, 3, 4]]))
print(y.shape, modele.layers[0]["mode"])
:::
@EXPERIMENT
La forme est (1, 4, 8) et le mode de couche est "ssm". Les deux couches SSM sont des scans, pas des attentions.
@EXERCISE
Cite deux pièces d'un bloc Mamba publié absentes de _ssm. La convolution courte sur le temps, et un scan fusionné pour GPU.
@BUILD
La brique « SSM » du parcours s'allume ici, à l'étape 8.7. Elle désigne ce dos, pas une dépendance installée depuis un dépôt de recherche.
@QUESTION
Que contient exactement le dos kind="ssm" de ce dépôt ?
@CORRECT
Un scan sélectif résiduel, sans convolution courte ni kernel CUDA
@WRONG
- Un Transformer complet avec RoPE
- Le code officiel de Mamba, poids compris
- Un routeur MoE à la place de l'état
@EXPLANATION
C'est une maquette pédagogique. La forme et la causalité sont testées, pas la parité avec un article.
@@@
@ID 8.8
@TITLE Attention contre SSM
@TAG SSM
@MINUTES 30
@WHY
Choisir un dos, c'est choisir ce que le modèle peut rappeler. L'attention relit le passé exact dans la fenêtre. Le SSM le comprime. Aucun des deux ne gagne sur tous les textes.
@OBJECTIVES
- Comparer mémoire exacte et mémoire comprimée
- Relier les coûts à bench.py
- Refuser un vainqueur universel
@PREREQ Mamba réduit et FLOPs d'attention.
@INTUITION
L'attention est un index : tu peux revenir à la phrase précise. Le SSM est un résumé oral : il est court, il déforme, il suffit souvent, il échoue quand le détail comptait.
@VOCAB
Fenêtre : les T tokens que l'attention voit encore. État : les S nombres du SSM. Rappel exact : recopier un token lointain. Oubli structurel : perte due à la taille de l'état, pas à un mauvais entraînement.
@EXPLAIN
attention_flops compte un terme en T*T*d. Un scan diagonal est linéaire en T pour un état de taille D. Sur une longue séquence, le SSM coûte moins de calcul d'appariement. En échange, il ne peut pas garantir de citer le token 12 si l'état a été écrasé depuis. L'attention dans la fenêtre le peut, tant que ce token n'a pas été tronqué par block_size. Le laboratoire ne tranche pas par un score de langage : il impose aux deux la même forme de sortie et la même causalité, dans test_backbone_kinds_share_shape_and_are_causal. Le choix se discute avec le tableau du niveau 6 : qualité, secondes, RAM. Un SSM qui oublie un nom propre peut être plus rapide et moins bon. Le dire fait partie du résultat.
@LANG python
@CODE
:::
from model.bench import attention_flops
print("attention", attention_flops(tokens=1024, d_model=64, n_layers=2))
print("ordre scan", 1024 * 64 * 2)
:::
@EXPERIMENT
Le nombre d'attention est dominé par les paires. L'ordre du scan reste en T*D*couches. Ce n'est pas un benchmark de qualité, seulement de volume de calcul.
@EXERCISE
Donne un exemple où l'attention dans la fenêtre est le bon outil, et un où le SSM suffit. Copier un identifiant distant ; résumer un journal régulier.
@BUILD
Le fil rouge ne supprime pas l'attention. Il la laisse disponible comme kind="transformer", pour que la comparaison soit un changement de chaîne, pas une réécriture.
@QUESTION
Quel rappel l'attention dans la fenêtre fait-elle qu'un état de taille fixe ne garantit pas ?
@CORRECT
Relire une position précise encore présente dans la fenêtre
@WRONG
- Prédire sans aucun paramètre
- Ignorer le masque causal
- Réduire la RAM des poids à zéro
@EXPLANATION
L'état comprime. L'attention, dans sa fenêtre, conserve l'accès aux vecteurs passés. Hors fenêtre, elle aussi oublie.
@@@
@ID 8.9
@TITLE Un dos hybride
@TAG SSM
@MINUTES 30
@WHY
Rien n'oblige à choisir un seul mélangeur. Un dos hybride alterne attention et scan. Le fil rouge le fait pour que l'architecture du niveau 12 soit un paramètre, pas un autre programme.
@OBJECTIVES
- Lire l'alternance des couches
- Vérifier que la forme reste (B, T, D)
- Préparer l'architecture candidate
@PREREQ Attention contre SSM.
@INTUITION
Une couche relit le texte avec précision, la suivante comprime. Tu gardes un index et un résumé, au lieu de parier sur un seul carnet.
@VOCAB
Hybride : kind="hybrid". Alternance : couche paire en attention, couche impaire en SSM, décidée par index % 2. Contrat de forme : forward renvoie (batch, temps, d_model) pour les trois kinds.
@EXPLAIN
Dans Backbone.__init__, transformer met toutes les couches en "attn", ssm toutes en "ssm", hybrid choisit "attn" si index est pair et "ssm" sinon. forward ajoute le bloc au résidu, dans les deux cas. Le test construit les trois kinds avec les mêmes tailles et la même graine, et exige la même forme (1, 4, 8) plus la causalité sur la position 0. Il ne demande pas que les trois sorties soient égales : les poids et les mélanges diffèrent, les graines identiques ne suffisent pas à les rendre interchangeables nombre pour nombre. Ce qui est interchangeable, c'est le branchement. C'est le contrat que le niveau 12 appellera architecture candidate : changer kind ne change pas la forme que le reste du programme attend.
@LANG python
@CODE
:::
from model.backbone import Backbone
hybride = Backbone("hybrid", vocab_size=8, d_model=8, n_layers=2, block_size=6, seed=3)
print([couche["mode"] for couche in hybride.layers])
:::
@EXPERIMENT
Tu dois lire ["attn", "ssm"]. Avec n_layers=3, la troisième couche redevient "attn".
@EXERCISE
Pourquoi le test n'exige-t-il pas que les trois kinds produisent les mêmes nombres ? Parce que le contrat est la forme et la causalité, pas l'égalité des fonctions.
@BUILD
Le projet du niveau est ce dos interchangeable. L'étape 12.8 s'appuiera dessus sans réécrire le scan ni l'attention.
@QUESTION
Dans ce dépôt, que partagent transformer, ssm et hybrid ?
@CORRECT
La forme de sortie (B, T, D) et la causalité, pas les valeurs
@WRONG
- Les mêmes poids et les mêmes sorties
- Un routeur top-k commun
- L'absence de résidu
@EXPLANATION
Le test fixe la forme et l'absence d'effet du futur sur la position 0. Les fonctions restent différentes.
