@@@
@ID 5.1
@TITLE Limites des positions absolues
@TAG Moderne
@MINUTES 25
@WHY
Une table de positions apprises s'arrête à block_size. Demander une place de plus n'a pas de vecteur. C'est la première limite que les modèles récents contournent.
@OBJECTIVES
- Relier block_size à la table de positions
- Expliquer l'échec hors table
- Annoncer une position relative plutôt qu'une case apprise
@PREREQ Le mini-GPT du niveau 4.
@INTUITION
Si tu as appris 32 chaises numérotées, la 33e n'existe pas. Une position qui dit « deux places avant » se généralise mieux qu'une chaise nommée 17.
@VOCAB
Position absolue : un vecteur par indice, appris. Extrapolation : utiliser une longueur non vue à l'entraînement. Position relative : une relation entre deux places, pas une case fixe.
@EXPLAIN
Dans le mini-GPT, params["pos"] a une ligne par indice de 0 à block_size-1. Le forward lève ValueError au-delà, plutôt que de relire la dernière ligne en silence. Cette erreur est honnête. Les modèles récents évitent la table : RoPE fait tourner les paires de composantes selon la position, et le score entre deux tokens ne dépend alors que de leur écart. On ne gagne pas une longueur infinie gratuite — la qualité se dégrade quand même — mais on n'a plus une coupure sèche à l'indice 32.
@LANG python
@CODE
:::
block_size = 8
position = 8
print("valide" if position < block_size else "hors table")
:::
@EXPERIMENT
Construis un TinyGPT avec block_size=4 et tente un forward de longueur 5. Tu dois obtenir ValueError. Ce n'est pas un bug à « corriger » en allongeant la table sans le dire.
@EXERCISE
Explique la différence entre « je n'ai pas de vecteur pour la place 40 » et « je sais comparer une place à celle qui est trois crans avant ».
@BUILD
GPTConfig.pos accepte "absolute" ou "rope". Le niveau 5 commence en rendant ce choix visible, pas en jetant le modèle du niveau 4.
@QUESTION
Une table de positions absolues échoue surtout quand…
@CORRECT
La séquence dépasse le nombre de places apprises
@WRONG
- Le vocabulaire contient une lettre
- La loss est positive
- On utilise un masque causal
@EXPLANATION
Le masque et la loss n'ont pas besoin de cette table. C'est la place, au-delà de block_size, qui n'a pas de ligne.
@@@
@ID 5.2
@TITLE RoPE
@TAG Moderne
@MINUTES 40
@WHY
RoPE encode la position en faisant tourner les requêtes et les clés. Le produit scalaire devient sensible à l'écart entre deux positions, sans table d'addition.
@OBJECTIVES
- Appliquer une rotation à une paire de composantes
- Vérifier que la norme du vecteur est conservée
- Dire où RoPE s'insère : sur Q et K, pas sur V
@PREREQ Positions absolues, étape 5.1.
@INTUITION
Tourner un vecteur ne change pas sa longueur. Tourner la requête d'un angle et la clé d'un autre fait dépendre leur alignement de la différence d'angles, donc de la différence de positions.
@VOCAB
RoPE : rotary position embedding. Paire : deux composantes tournées ensemble. Angle : position fois une fréquence, plus lente pour les paires suivantes. Base : souvent 10000, qui règle ces fréquences.
@EXPLAIN
Pour une tête de dimension paire, on groupe (x0, x1), (x2, x3), etc. La paire i est tournée d'un angle θ_i * position, avec θ_i = base^(-2i/d). apply_rope fait cette rotation. Le test vérifie que la norme de chaque vecteur est inchangée : une rotation le doit. On l'applique à Q et à K seulement. V n'est pas tourné : il porte le contenu à mélanger, pas le score. Dans le forward, quand pos vaut "rope", la table absolue n'est pas ajoutée.
@LANG python
@CODE
:::
import numpy as np
from model.attention import apply_rope, rope_cos_sin
etats = np.ones((1, 1, 2, 4))
cos, sin = rope_cos_sin(np.array([0, 1]), 4)
tourne = apply_rope(etats, cos, sin)
print(np.linalg.norm(tourne, axis=-1).round(3))
:::
@EXPERIMENT
La norme de chaque vecteur de uns, au départ sqrt(4)=2, doit rester 2 après rotation. Si elle change, la rotation est fausse.
@EXERCISE
Pour une position 0, l'angle est nul : la rotation doit laisser le vecteur identique. Vérifie-le sur la première position du tableau ci-dessus.
@BUILD
RoPE est une option de TinyGPT, testée dans test_modern_options_keep_contract. Le contrat de forme des logits ne change pas.
@QUESTION
RoPE modifie la norme des vecteurs tournés.
@CORRECT
Non : une rotation conserve la norme
@WRONG
- Oui, elle la multiplie par la position
- Oui, elle la remplace par la loss
- Non, parce que RoPE supprime les vecteurs
@EXPLANATION
Le test d'égalité des normes est exactement cette propriété. Si elle casse, l'implémentation n'est pas RoPE.
@@@
@ID 5.3
@TITLE RMSNorm
@TAG Moderne
@MINUTES 30
@WHY
LayerNorm centre et réduit. RMSNorm ne fait que remettre l'échelle, avec moins d'opérations. Les modèles récents l'utilisent souvent à la place.
@OBJECTIVES
- Calculer la racine de la moyenne des carrés
- Comparer à LayerNorm
- Voir le gain appris
@PREREQ Normalisation du niveau 4.
@INTUITION
Au lieu de demander « à quelle distance de la moyenne suis-je », RMSNorm demande « quelle est mon énergie » et divise par elle. On ne recentre pas. Un gain par composante réapprend l'échelle utile.
@VOCAB
RMS : root mean square, racine de la moyenne des carrés. Gain : le vecteur γ, appris, souvent initialisé à 1. eps : un petit terme pour ne pas diviser par zéro.
@EXPLAIN
rmsnorm(x) = x / sqrt(mean(x²) + eps) * gain. Il n'y a pas de β. Pour un vecteur constant [2, 2], la RMS vaut 2, donc on obtient [1, 1] avant le gain. LayerNorm, elle, verrait une variance nulle et rendrait zéro après centrage. Les deux ne sont pas interchangeables numériquement. Elles le sont architecturalement : même place, avant les sous-blocs. Le laboratoire choisit l'une ou l'autre via GPTConfig.norm. Les tests ne comparent pas les valeurs entre les deux modes, seulement la forme finale et le fait que le modèle se construit.
@LANG python
@CODE
:::
import numpy as np
from model.mathutil import rmsnorm
x = np.array([[2.0, 2.0]])
print(rmsnorm(x, np.ones(2)).round(3))
:::
@EXPERIMENT
Essaie [[3, 0]]. La RMS vaut sqrt(4.5). Vérifie à la main le premier composant après division, avant de regarder le print.
@EXERCISE
Cite les deux choses que LayerNorm fait et que RMSNorm ne fait pas : soustraire la moyenne, ajouter un biais β.
@BUILD
Quand norm="rms", TinyGPT n'alloue pas les biais n1b, n2b, nfb. parameter_count doit donc différer du modèle LayerNorm. Le test des options modernes le vérifie indirectement en comparant deux comptes.
@QUESTION
RMSNorm, comparée à LayerNorm, …
@CORRECT
Remet l'échelle par la RMS et n'ôte pas la moyenne
@WRONG
- Supprime le gain appris
- Normalise le batch entier
- Remplace le masque causal
@EXPLANATION
Le centrage disparaît, le gain reste. Le masque et le batch ne sont pas le sujet de cette couche.
@@@
@ID 5.4
@TITLE GELU et SwiGLU
@TAG Moderne
@MINUTES 35
@WHY
Le FFN GELU à deux matrices est la version 2017. SwiGLU ajoute une porte et se retrouve dans beaucoup de modèles récents. Il faut voir le calcul, pas seulement le nom.
@OBJECTIVES
- Reconnaître GELU comme activation lisse
- Écrire la porte SwiGLU
- Dire pourquoi on réduit souvent la largeur cachée
@PREREQ FFN du niveau 4.
@INTUITION
GELU laisse passer un signal en le lissant autour de zéro, au lieu de le couper net comme ReLU. SwiGLU multiplie ce passage par une seconde branche, la porte : le bloc peut choisir d'éteindre une composante.
@VOCAB
GELU : une activation lisse, approchée par une tanh dans le laboratoire. SwiGLU : silu(x W_gate) * (x W_up), puis W_down. Porte : la branche qui multiplie, entre 0 et 1 après SiLU selon le signe.
@EXPLAIN
Le FFN GELU a deux matrices, largeur souvent 4D. SwiGLU en a trois : gate, up, down. À largeur égale, il coûte plus cher. On prend donc souvent une largeur autour de 8D/3 pour retrouver le budget du 4D. Le mini-GPT, pour rester lisible, utilise 2D comme largeur SwiGLU et le documente : ce n'est pas le réglage de production, c'est un choix de clarté. silu(x) = x * sigmoid(x). La multiplication élément par élément est la porte. Le résidu autour du FFN ne change pas.
@LANG python
@CODE
:::
import numpy as np
from model.mathutil import silu
x = np.array([-1.0, 0.0, 1.0])
print(silu(x).round(3))
:::
@EXPERIMENT
SiLU(-1) doit être proche de -0,27, SiLU(0) vaut 0, SiLU(1) est proche de 0,73. Le négatif n'est pas coupé net, contrairement à ReLU.
@EXERCISE
Compte les matrices d'un FFN GELU et d'un SwiGLU. Explique en une phrase pourquoi on baisse d_ff quand on passe à SwiGLU.
@BUILD
GPTConfig.ffn vaut "gelu" ou "swiglu". _ffn branche les deux. Le test moderne construit un modèle SwiGLU et vérifie la forme des logits.
@QUESTION
SwiGLU ajoute surtout quoi au FFN ?
@CORRECT
Une troisième matrice qui sert de porte multipliée au signal
@WRONG
- Un masque causal supplémentaire
- Une table de positions
- Une perte d'équilibrage d'experts
@EXPLANATION
La porte est la nouveauté. Le masque, les positions et les experts sont d'autres briques.
@@@
@ID 5.5
@TITLE MHA, MQA et GQA
@TAG Moderne
@MINUTES 35
@WHY
Le cache des clés et des valeurs pèse autant que le nombre de têtes. GQA garde plusieurs têtes de requête mais moins de têtes KV, pour alléger la génération.
@OBJECTIVES
- Distinguer MHA, MQA et GQA
- Répéter les têtes KV pour les aligner sur les requêtes
- Imposer que le nombre de têtes divise bien
@PREREQ Multi-têtes, niveau 4.
@INTUITION
Plusieurs personnes posent des questions différentes, mais partagent quelques fiches de réponse. On duplique les fiches au moment de lire, on ne les stocke pas en autant d'exemplaires que de questions.
@VOCAB
MHA : autant de têtes KV que de têtes Q. MQA : une seule tête KV pour toutes les requêtes. GQA : des groupes, n_kv_heads divise n_heads. repeat : dupliquer chaque tête KV pour le calcul, pas pour le stockage.
@EXPLAIN
Le cache stocke K et V par tête KV. En MHA, n_kv = n_heads. En GQA, par exemple 4 têtes de requête et 2 têtes KV : chaque tête KV sert deux requêtes. repeat_kv duplique l'axe des têtes juste avant le produit. Les poids appris de K et V, eux, restent plus petits : wk a la forme (D, n_kv * d_k) et non (D, D). GPTConfig refuse un nombre de têtes non divisible. Le test moderne utilise n_kv_heads=2 avec 4 têtes de requête.
@LANG python
@CODE
:::
n_heads, n_kv = 4, 2
assert n_heads % n_kv == 0
print("répétitions", n_heads // n_kv)
:::
@EXPERIMENT
Avec n_heads=4 et n_kv=3, la condition doit échouer. Ce n'est pas un réglage exotique valide : les groupes seraient de tailles inégales.
@EXERCISE
Pour n_heads=8 et n_kv_heads=2, combien de têtes de requête partagent la même tête KV ? 4. Que devient la largeur de wk par rapport au MHA ?
@BUILD
repeat_kv est dans model/attention.py et le forward de TinyGPT l'appelle. Le cache, lui, conserve les têtes KV avant duplication : c'est tout l'intérêt.
@QUESTION
GQA réduit surtout quelle quantité de clés ?
@CORRECT
Le nombre de têtes de clés et de valeurs, pas forcément le nombre de requêtes
@WRONG
- La taille du vocabulaire
- Le nombre de blocs, automatiquement
- La précision des labels
@EXPLANATION
Les requêtes restent nombreuses. K et V sont partagés par groupes, ce qui allège le cache.
@@@
@ID 5.6
@TITLE Cache KV
@TAG Moderne
@MINUTES 35
@WHY
Regénérer toute la phrase à chaque nouveau token refait les mêmes clés. Le cache les garde. Il est juste seulement s'il donne le même logit que le forward complet.
@OBJECTIVES
- Décrire ce qu'on stocke par couche
- Avancer d'un token en réutilisant le cache
- Exiger l'égalité avec le forward sans cache
@PREREQ GQA et génération, étapes 5.5 et 3.9.
@INTUITION
Tu as déjà annoté les pages lues. Quand une page s'ajoute, tu annotes la nouvelle et tu gardes les anciennes annotations. Tu ne relis pas le livre entier avec un crayon neuf.
@VOCAB
Cache : par couche, les tenseurs K et V du passé. Position de départ : la longueur déjà en cache, pour RoPE ou la table absolue. Cohérence : égalité numérique avec un forward d'un seul coup.
@EXPLAIN
forward(idx, cache) ne reçoit que les tokens neufs. Il concatène leurs K et V à ceux du cache, et les requêtes nouvelles peuvent voir tout le passé grâce au masque. Les positions commencent à past, pas à zéro : sinon RoPE et les positions absolues se trompent de place. Le test découpe une séquence de 5 tokens en 3 + 2 et compare au forward unique. Un cache qui « accélère » mais change les logits est un bug, pas une optimisation. On le jette.
@LANG python
@CODE
:::
import numpy as np
from model.transformer import GPTConfig, TinyGPT
modele = TinyGPT(GPTConfig(vocab_size=12, d_model=16, n_heads=4, n_layers=2, block_size=8, seed=2))
idx = np.array([[1, 2, 3, 4, 5]])
complet, _ = modele.forward(idx)
_, cache = modele.forward(idx[:, :3])
suite, _ = modele.forward(idx[:, 3:], cache=cache)
print(np.allclose(suite[0, -1], complet[0, -1]))
:::
@EXPERIMENT
Le print doit valoir True. Change la graine ou la découpe et l'égalité doit tenir. Si tu modifies le masque pour tricher, elle cassera.
@EXERCISE
Pour un passé de 4 tokens et un nouveau token, quelles positions RoPE doivent être utilisées pour la requête nouvelle ? Uniquement la position 4, pas la position 0.
@BUILD
Le cache est déjà dans TinyGPT.forward. Cette étape le lit et le teste. C'est une brique de génération, pas un changement de loss.
@QUESTION
Un cache correct, comparé au forward complet, doit…
@CORRECT
Produire les mêmes logits sur les tokens nouvellement calculés
@WRONG
- Produire des logits différents, sinon il ne sert à rien
- Effacer le masque
- Réentraîner les poids à chaque token
@EXPLANATION
Le cache est une accélération exacte. Un écart numérique est un bug de positions ou de masque.
@@@
@ID 5.7
@TITLE Weight tying
@TAG Moderne
@MINUTES 25
@WHY
La table d'embedding et la tête de sortie font des travaux miroirs : passer d'un identifiant à un vecteur, et d'un vecteur à des scores d'identifiants. Partager leurs poids économise V fois D paramètres.
@OBJECTIVES
- Expliquer le partage embedding / tête
- Compter les paramètres économisés
- Vérifier que la forme des logits ne change pas
@PREREQ Embeddings et tête de sortie.
@INTUITION
Le même dictionnaire sert à lire un mot et à le proposer en sortie. On n'imprime pas deux dictionnaires pour une seule langue.
@VOCAB
Weight tying : une seule matrice pour l'embedding et la tête. Transposée : les logits valent h @ Eᵀ si E est (V, D). Économie : V*D paramètres en moins.
@EXPLAIN
Sans partage, head a la forme (D, V) et tok la forme (V, D) : deux tables. Avec tie_weights, on n'alloue pas head, et les logits sont hidden @ tok.T. Le test vérifie que "head" n'est pas dans les paramètres et que la forme reste (B, T, V). Le partage suppose que l'espace des embeddings et celui de la sortie coïncident. Ce n'est pas obligatoire, c'est un choix qui marche souvent bien pour les modèles de langue et qui allège les petits vocabulaires comme les grands.
@LANG python
@CODE
:::
V, D = 1000, 64
separes = 2 * V * D
partages = V * D
print(separes - partages)
:::
@EXPERIMENT
Pour le vocabulaire du corpus réel, estime V en lançant CharTokenizer, puis calcule l'économie V*D pour D=32. Le chiffre doit être modeste : le corpus est petit.
@EXERCISE
Si V=32000 et D=256, combien de paramètres float32 économise le tying, et combien d'octets ? 32000*256 paramètres, fois 4 octets.
@BUILD
GPTConfig.tie_weights est le drapeau. Le test moderne l'active et refuse la présence d'une seconde matrice.
@QUESTION
Le weight tying partage quels poids du modèle ?
@CORRECT
La table d'embedding et la matrice de la tête de sortie
@WRONG
- Les masques de toutes les couches
- Le corpus et les labels de test
- Les têtes KV entre deux modèles différents
@EXPLANATION
Ce sont les deux matrices qui parlent le vocabulaire. Le masque et le corpus ne sont pas des poids de ce type.
@@@
@ID 5.8
@TITLE Initialisation
@TAG Moderne
@MINUTES 30
@WHY
Les mêmes équations, mal initialisées, divergent ou n'apprennent pas. L'initialisation fixe l'échelle des poids au départ, avant le premier pas.
@OBJECTIVES
- Utiliser une gaussienne de petit écart-type
- Dire pourquoi deux graines doivent coïncider
- Relier l'échelle au résidu
@PREREQ Blocs et résidus.
@INTUITION
Des poids énormes saturent les activations dès le premier forward. Des poids nuls n'apprennent rien, sauf à travers le résidu qui, lui, laisse passer l'entrée. On vise petit, mais pas identiquement nul, et reproductible.
@VOCAB
Écart-type : ici 0.02 pour les matrices gaussiennes. Graine : seed du générateur, pour refaire les mêmes tirages. Divergences : des activations ou une loss qui explosent.
@EXPLAIN
TinyGPT tire les matrices avec une normale d'écart 0.02, et met les gains de norme à 1, les biais à 0. Deux modèles de même config et même graine doivent produire les mêmes logits : le test le vérifie. Changer la graine change les poids et donc les logits. Ce n'est pas du « bruit sans importance » quand on compare deux architectures : il faut plusieurs graines, ou la même, sinon on compare le hasard. Les résidus autorisent cette petite init : même si le sous-bloc sort petit, l'entrée traverse. Une init plus savante existe, par exemple réduire les résidus selon la profondeur. On la cite, on ne l'impose pas au mini-modèle.
@LANG python
@CODE
:::
import numpy as np
rng = np.random.default_rng(0)
W = rng.normal(0.0, 0.02, size=(4, 4))
print(W.std().round(4))
:::
@EXPERIMENT
Relance avec la graine 0 : le même tableau. Relance avec la graine 1 : un autre. C'est le comportement que le test de TinyGPT exige.
@EXERCISE
Explique pourquoi comparer un RoPE et une position absolue avec deux graines différentes ne permet pas de conclure. Propose le protocole minimal : même graine, ou une moyenne sur les mêmes graines.
@BUILD
seed est un champ de GPTConfig. Tous les tests du dépôt fixent une graine. Un résultat non reproductible n'entre pas dans le fil rouge.
@QUESTION
Deux TinyGPT de même configuration et de même graine doivent…
@CORRECT
Produire les mêmes logits sur la même entrée
@WRONG
- Produire des textes opposés pour prouver l'aléa
- Ignorer la graine dès qu'il y a un résidu
- Avoir des shapes différentes
@EXPLANATION
La graine fixe l'initialisation. À code égal, les logits coïncident. Le test same == logits est cette exigence.
@@@
@ID 5.9
@TITLE Contexte long
@TAG Moderne
@MINUTES 30
@WHY
Allonger la fenêtre ne se décrète pas. L'attention coûte le carré de la longueur, et une position entraînée sur 512 tokens n'est pas automatiquement bonne à 8000.
@OBJECTIVES
- Relier le coût au carré de T
- Citer le cache comme mémoire de génération
- Rester prudent sur l'extrapolation
@PREREQ RoPE, cache et FLOPs annoncés.
@INTUITION
Une conversation deux fois plus longue n'est pas deux fois plus chère en attention : elle est quatre fois plus chère dans le terme T². Le cache, lui, grandit linéairement, mais il grandit quand même.
@VOCAB
Contexte long : une fenêtre de plusieurs milliers de tokens. Terme quadratique : les produits QKᵀ et AV. Extrapolation : tester plus long que l'entraînement. Cache : la mémoire des K et V, proportionnelle à T.
@EXPLAIN
attention_flops contient un terme 4 * n_layers * T * T * d_model. Passer de 1024 à 4096 multiplie ce terme par 16, pas par 4. Le FFN, lui, reste linéaire en T. Le cache KV grandit comme n_layers * T * n_kv * d_k, fois les octets du dtype. RoPE aide à ne pas avoir de table figée, mais ne supprime pas le coût quadratique, ni la chute de qualité si on dépasse de beaucoup la longueur d'entraînement. Des méthodes d'échelle d'angles existent ; on ne les code pas ici. On mesure, avec les fonctions du niveau 6, avant de croire qu'un contexte « long » tient sur la machine.
@LANG python
@CODE
:::
from model.bench import attention_flops
court = attention_flops(1024, 64, 2)
long = attention_flops(4096, 64, 2)
print(long / court)
:::
@EXPERIMENT
Le rapport doit valoir 16 pour la partie qui domine quand T est grand... En fait la formule mélange un terme en T et un terme en T². Calcule les deux longueurs et le rapport réel imprimé. Il sera un peu inférieur à 16 si le terme linéaire n'est pas négligeable. Commente le chiffre.
@EXERCISE
Pour une génération token par token, dis ce qui grandit à chaque pas : le cache, linéairement, et le coût du pas qui voit tout le passé, qui grandit avec T. Le pas n'est donc pas constant.
@BUILD
Le mini-GPT garde un block_size modeste. Le fil rouge du contexte long est la mesure, pas un modèle de 100 000 tokens. model/bench.py est l'outil.
@QUESTION
Doubler la longueur T multiplie le terme d'attention en T² par…
@CORRECT
4, parce que (2T) au carré vaut quatre fois T au carré
@WRONG
- 2
- 8
- 1, parce que le cache annule le coût
@EXPLANATION
(2T)² = 4 T². Le cache n'efface pas ce produit, il évite seulement de le refaire depuis zéro sur le passé déjà connu, et encore : le nouveau token doit quand même regarder tout le passé.
