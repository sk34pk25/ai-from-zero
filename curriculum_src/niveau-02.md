@@@
@ID 2.1
@TITLE Texte et Unicode
@TAG Données
@MINUTES 25
@WHY
Un modèle ne voit pas des lettres. Il voit des nombres produits à partir d'un texte déjà codé. Unicode est cette couche, avant tout tokenizer.
@OBJECTIVES
- Distinguer caractère et point de code
- Lire ord et chr
- Voir qu'un emoji est un caractère Unicode, pas une image
@PREREQ Listes et chaînes, niveau 0.
@INTUITION
Le texte que tu lis est une suite de caractères. Chaque caractère a un numéro dans un grand catalogue, Unicode. Le fichier sur le disque n'enregistre pas le dessin de la lettre : il enregistre ce numéro, selon un encodage.
@VOCAB
Caractère : une unité perçue, comme « é » ou « 🤖 ». Point de code : son numéro Unicode, obtenu par ord. chr : l'opération inverse. Encodage : la traduction du numéro en octets, vue à l'étape suivante.
@EXPLAIN
ord("A") vaut 65, ord("é") vaut 233, ord("🤖") vaut 129302. Ces numéros ne sont pas encore des tokens de modèle : un tokenizer peut regrouper plusieurs caractères, ou au contraire travailler sur les octets. Mais sans cette couche, on croit que la longueur d'une chaîne est toujours son nombre d'octets. C'est faux. len("é") vaut 1 en Python, alors que son UTF-8 occupe 2 octets. Les corpus du laboratoire sont lus en UTF-8, explicitement, dans load_numbers et dans le corpus texte.
@LANG python
@CODE
:::
texte = "IA é"
print([ord(caractere) for caractere in texte])
print(chr(65))
:::
@EXPERIMENT
Compare len("a"), len("é") et len("🤖"). Puis compare les longueurs de leurs .encode("utf-8"). Note les deux chiffres pour chaque caractère.
@EXERCISE
Donne le point de code de trois caractères de ton choix, dont une lettre accentuée. Écris une phrase : le point de code n'est pas un identifiant de token.
@BUILD
Le corpus model/data/corpus.txt est de l'UTF-8. CharTokenizer ne le décode pas : il reçoit déjà une str Python. Le décodage du fichier a eu lieu avant, à la lecture.
@QUESTION
Unicode sert d'abord à quoi, dans ce cours ?
@CORRECT
Attribuer des points de code aux caractères, avant l’encodage en octets
@WRONG
- Compresser les caractères en tokens BPE
- Imposer un octet par caractère
- Donner un embedding à chaque mot
@EXPLANATION
Unicode catalogue les caractères. L'encodage, le tokenizer et l'entraînement sont des couches suivantes.
@@@
@ID 2.2
@TITLE Construire un corpus
@TAG Données
@MINUTES 25
@WHY
Le corpus est la seule matière dans laquelle le modèle peut trouver des régularités. Un corpus minuscule et propre apprend moins de choses, mais il permet de vérifier que le code est juste.
@OBJECTIVES
- Charger un texte en UTF-8
- Compter caractères et lignes
- Dire ce qu'un petit corpus ne peut pas prouver
@PREREQ Unicode, étape 2.1.
@INTUITION
Tu n'apprends pas le français dans une phrase. Un modèle non plus. Mais pour vérifier qu'un bigramme compte bien les paires, une phrase répétée est plus utile qu'un livre illisible.
@VOCAB
Corpus : l'ensemble de textes d'entraînement. Document : un élément de ce corpus. Caractère de contrôle : un retour ligne ou une tabulation, qui compte dans la longueur. Biais de corpus : ce que le texte répète, le modèle le reprend.
@EXPLAIN
open(path, encoding="utf-8").read() charge tout. Oublier l'encodage peut casser les accents selon la machine. len(texte) compte les caractères, pas les octets. Un corpus de démonstration comme model/data/corpus.txt répète « le modele apprend » pour que le bigramme ait une statistique visible. Il ne faut pas en conclure que le modèle « sait le français ». Il a vu quelques dizaines de caractères. La qualité d'un résultat de génération se juge d'abord par la taille et la nature de ce texte.
@LANG python
@CODE
:::
from pathlib import Path
texte = Path("model/data/corpus.txt").read_text(encoding="utf-8")
print(len(texte), texte.count("modele"))
:::
@EXPERIMENT
Compte les lignes et les caractères du corpus du dépôt. Ajoute une phrase dans une copie et vérifie que la longueur augmente d'autant.
@EXERCISE
Écris trois phrases qui répètent volontairement la même suite de mots. Dis quelle régularité un bigramme pourra voir, et laquelle il ne pourra pas voir.
@BUILD
Le fichier model/data/corpus.txt est le corpus du fil rouge. python -m model le charge, le tokenise et entraîne le bigramme dessus. Le test de perplexité, lui, fabrique une séquence encore plus répétitive pour un critère net.
@QUESTION
Un corpus, dans ce parcours, désigne quoi ?
@CORRECT
Les textes réunis pour l’apprentissage
@WRONG
- La table des identifiants de tokens
- Le fichier contenant les poids appris
- La seule partie réservée à la validation
@EXPLANATION
Le corpus est la donnée. Les poids et l'optimiseur viennent après, pour en extraire un modèle.
@@@
@ID 2.3
@TITLE Caractères et octets
@TAG Encodage
@MINUTES 30
@WHY
Les fichiers sont des octets. Les chaînes Python sont des caractères. Un tokenizer « byte-level » travaille entre les deux. Il faut voir la différence sur un exemple.
@OBJECTIVES
- Encoder une chaîne en UTF-8
- Comparer le nombre d'octets de a, é et un emoji
- Expliquer l'intérêt d'un vocabulaire d'octets
@PREREQ Corpus et Unicode.
@INTUITION
UTF-8 est un compromis : les caractères fréquents en anglais tiennent sur un octet, les autres en prennent plusieurs. Un vocabulaire de 256 octets peut représenter n'importe quel fichier sans caractère inconnu.
@VOCAB
Octet : un entier entre 0 et 255. UTF-8 : l'encodage qui transforme un caractère en 1 à 4 octets. Byte-level : un tokenizer dont les unités de base sont ces octets. Caractère inconnu : impossible au niveau octet, possible au niveau caractère si le vocabulaire est incomplet.
@EXPLAIN
"a".encode("utf-8") vaut b'a', un octet. "é".encode("utf-8") vaut deux octets. L'emoji en prend quatre. Un tokenizer caractère construit sur le mot « bonjour » lève KeyError pour « z », comme CharTokenizer. Un vocabulaire des 256 octets n'a pas ce trou : tout fichier UTF-8 se décompose. Le prix est que « é » devient plusieurs tokens de base, avant d'éventuelles fusions BPE. Le laboratoire reste au niveau caractère pour que encode et decode se lisent sur une page.
@LANG python
@CODE
:::
for caractere in ["a", "é", "🤖"]:
    octets = caractere.encode("utf-8")
    print(caractere, len(caractere), len(octets), octets)
:::
@EXPERIMENT
Affiche la liste des octets de « café ». Compte-les à la main : c, a, f tiennent sur 1, é sur 2, soit 5 octets pour 4 caractères.
@EXERCISE
Explique pourquoi un tokenizer limité aux caractères vus dans « bonjour » échoue sur « z », alors qu'un vocabulaire de 256 octets n'échoue pas.
@BUILD
CharTokenizer documente ce choix : KeyError sur un caractère absent. Le test test_tokenizer_roundtrip_and_bpe provoque cette erreur avec « z ». C'est un comportement voulu, pas un oubli.
@QUESTION
UTF-8 produit quoi à partir d'un texte ?
@CORRECT
Des octets qui représentent le texte
@WRONG
- Une suite d’embeddings entraînés
- Une liste de mots séparés par espaces
- Une distribution sur le vocabulaire
@EXPLANATION
L'encodage traduit le texte en octets. Il ne calcule ni loss ni paramètre.
@@@
@ID 2.4
@TITLE Vocabulaire
@TAG Tokenizer
@MINUTES 25
@WHY
Le modèle ne peut attribuer un vecteur qu'à une unité connue. Le vocabulaire est la liste fermée de ces unités, chacune avec un identifiant entier.
@OBJECTIVES
- Construire l'ensemble des caractères d'un texte
- Dire ce qu'est la taille du vocabulaire
- Prévoir l'effet d'un caractère nouveau
@PREREQ Caractères, étape 2.3.
@INTUITION
Le vocabulaire est l'alphabet du modèle. Si une lettre n'y est pas, il n'a pas de case pour elle. Agrandir l'alphabet après coup déplace les identifiants si on n'a pas figé la table.
@VOCAB
Vocabulaire : l'ensemble des unités. Taille : le nombre d'unités, souvent notée V. Identifiant : l'entier associé à une unité. Table figée : la même correspondance à l'entraînement et à la génération.
@EXPLAIN
sorted(set("bonjour")) donne les caractères uniques, dans un ordre stable. L'ordre compte : si tu construis la table une fois par ordre d'apparition et une fois par ordre trié, les identifiants changent et un modèle entraîné avec la première ne lit plus la seconde. CharTokenizer trie, donc le résultat ne dépend pas de l'ordre des phrases, seulement de l'ensemble des caractères. La taille V fixe la largeur de la dernière couche : un logit par unité.
@LANG python
@CODE
:::
texte = "bonjour"
caracteres = sorted(set(texte))
print(caracteres, len(caracteres))
:::
@EXPERIMENT
Ajoute un espace et un point au texte. La taille du vocabulaire doit augmenter de 2, pas de 1 : ce sont deux caractères nouveaux.
@EXERCISE
Construis le vocabulaire de « abba ». Combien d'unités ? Quels identifiants si on numérote dans l'ordre trié, en partant de 0 ?
@BUILD
CharTokenizer.vocab_size est cette longueur. Le bigramme alloue une matrice V par V. Changer le vocabulaire sans réentraîner rend la matrice illisible.
@QUESTION
Le vocabulaire associe des unités à…
@CORRECT
Des entiers fixes qui servent à retrouver ces mêmes unités
@WRONG
- Des fréquences recalculées à chaque appel
- Des vecteurs différents à chaque lecture
- Des probabilités de prochain token
@EXPLANATION
Chaque unité reçoit un entier. Cet entier indexera une ligne d'embedding et une case de logit.
@@@
@ID 2.5
@TITLE Tokenizer caractère
@TAG Tokenizer
@MINUTES 40
@WHY
C'est la première frontière réelle entre le texte et le calcul. Un aller-retour encode puis decode qui ne rend pas le texte de départ est un bug, pas une « créativité ».
@OBJECTIVES
- Construire stoi et itos
- Encoder une chaîne et la décoder
- Refuser un caractère inconnu
@PREREQ Vocabulaire, étape 2.4.
@INTUITION
stoi est le dictionnaire « caractère vers numéro ». itos est l'inverse. Encoder, c'est remplacer chaque caractère par son numéro. Décoder, c'est le chemin retour. Si les deux tables ne sont pas inverses, le texte revient abîmé.
@VOCAB
stoi : string to index. itos : index to string. Aller-retour : decode(encode(texte)) == texte. Caractère inconnu : une clé absente, ici une erreur explicite.
@EXPLAIN
Pour "ab", trié, a vaut 0 et b vaut 1. "abba" devient [0, 1, 1, 0]. Le décodage recolle "abba". Le laboratoire implémente exactement cela dans CharTokenizer. visualize affiche b|1 a|0… pour voir les couples. Un caractère absent lève KeyError plutôt que d'être remplacé en silence par un identifiant fourre-tout : au début, un échec visible vaut mieux qu'un texte corrompu. Les fusions BPE viendront élargir les unités, pas changer ce contrat d'aller-retour.
@LANG python
@CODE
:::
texte = "bonjour ia"
caracteres = sorted(set(texte))
stoi = {ch: i for i, ch in enumerate(caracteres)}
itos = {i: ch for ch, i in stoi.items()}
ids = [stoi[ch] for ch in texte]
print(ids)
print("".join(itos[i] for i in ids))
:::
@EXPERIMENT
Ajoute un « ! » au texte d'initialisation et regarde le vocabulaire grossir. Puis encode une chaîne qui contient « ! » sans l'avoir mis dans le corpus : tu dois obtenir une erreur.
@EXERCISE
Encode puis décode « abba » avec un vocabulaire construit sur cette seule chaîne. Le texte reconstruit doit être identique, espaces compris s'il y en a.
@BUILD
La brique est model/tokenizer.py. Le test vérifie l'aller-retour sur « bonjour bonjour » et le KeyError sur « z ». Lance pytest tests/test_lab.py -q -k tokenizer.
@QUESTION
Pourquoi ce tokenizer renvoie-t-il des entiers ?
@CORRECT
Les entiers indexent les unités du vocabulaire
@WRONG
- Chaque entier encode directement le sens du token
- Les indices sont déjà les probabilités prédites
- La taille des entiers remplace les positions
@EXPLANATION
Les entiers indexeront des vecteurs. Le texte humain s'arrête à cette frontière.
@@@
@ID 2.6
@TITLE BPE, l'intuition
@TAG Tokenizer
@MINUTES 30
@WHY
Le caractère seul produit de longues séquences. Le mot entier explose le vocabulaire et bute sur les mots rares. BPE construit un milieu : il fusionne les paires fréquentes.
@OBJECTIVES
- Compter les paires adjacentes
- Choisir la paire la plus fréquente
- Dire ce qu'une fusion change à la longueur
@PREREQ Tokenizer caractère, étape 2.5.
@INTUITION
Dans « banana », la suite « an » revient souvent. Si on décide que « an » devient une seule pièce, le mot raccourcit. On répète l'opération sur les pièces. Les morceaux fréquents deviennent des tokens, les morceaux rares restent découpés.
@VOCAB
Paire : deux unités voisines. Fusion : les remplacer par une nouvelle unité. BPE : byte pair encoding, cet algorithme de fusions successives. Longueur tokenisée : le nombre d'unités après fusion, plus petit ou égal au nombre de caractères.
@EXPLAIN
"banana" en caractères : b a n a n a. Paires : ba, an, na, an, na. « an » et « na » apparaissent deux fois. Il faut un départage stable : le laboratoire choisit la paire au compte maximal, puis l'ordre des identifiants. Sans cette règle, deux machines ne construisent pas le même tokenizer. Une fusion réduit la longueur d'au moins 1 à chaque endroit où la paire était présente. Elle n'efface pas l'information : le nouveau token se décode encore en la paire d'origine.
@LANG python
@CODE
:::
tokens = list("banana")
paires = list(zip(tokens, tokens[1:]))
print(paires)
print(paires.count(("a", "n")))
:::
@EXPERIMENT
Compte les paires de « bandana ». Compare à « banana ». Quelle paire gagne si on additionne les deux comptes ?
@EXERCISE
Applique à la main une fusion de « an » dans « banana ». Écris la nouvelle liste de pièces. Elle doit être plus courte que 6.
@BUILD
pair_counts et merge_pair dans model/tokenizer.py sont cette étape, séparée de la boucle d'apprentissage des fusions. Les tests de BPE s'en servent via MiniBPE.
@QUESTION
BPE fusionne surtout quel genre de paires ?
@CORRECT
Les unités fréquentes et adjacentes
@WRONG
- Les caractères les plus éloignés du texte
- Les mots les plus longs, quelle que soit leur fréquence
- Les unités dont les embeddings sont les plus proches
@EXPLANATION
L'algorithme ne regarde que les suites dans le corpus. Il ne connaît ni les poids ni les dossiers.
@@@
@ID 2.7
@TITLE Construire un mini-BPE
@TAG Tokenizer
@MINUTES 40
@WHY
Quelques fusions écrites par toi montrent le mécanisme que les tokenizers de production répètent des dizaines de milliers de fois, avec la même logique.
@OBJECTIVES
- Appliquer une fusion à toute la séquence
- Répéter l'opération un nombre fixé de fois
- Décoder en défaisant les fusions à l'envers
@PREREQ Intuition BPE, étape 2.6.
@INTUITION
Chaque nouveau token est un nom pour une paire. Pour décoder, on remplace ce nom par la paire, en commençant par la fusion la plus récente, jusqu'à retomber sur des caractères.
@VOCAB
Merge : le couple (paire, nouvel identifiant). Vocabulaire étendu : caractères de base plus fusions. Décodage inverse : remplacer les identifiants créés, du dernier au premier.
@EXPLAIN
MiniBPE part de CharTokenizer, compte les paires, choisit la gagnante, remplace, et recommence. L'identifiant neuf est l'entier suivant. decode défait les fusions en ordre inverse puis appelle le décodeur caractère. Le test entraîne 8 fusions sur « banana bandana » et vérifie que « banana » revient intact, et plus court. Si le décodage est dans le mauvais ordre, le texte revient avec des identifiants ou des lettres permutées. C'est le bug à guetter.
@LANG python
@CODE
:::
from model.tokenizer import MiniBPE
bpe = MiniBPE("banana bandana", num_merges=8)
ids = bpe.encode("banana")
print(ids, bpe.decode(ids), len(ids), len("banana"))
:::
@EXPERIMENT
Relance avec num_merges=0. L'encodage doit avoir la longueur du texte. Puis avec 8 fusions, il doit être strictement plus court sur « banana ».
@EXERCISE
Écris une fusion sur la liste [1, 2, 1, 2] en remplaçant la paire (1, 2) par 9. Donne la liste résultante et son décodage si 9 signifie (1, 2).
@BUILD
La classe MiniBPE est le fil rouge de cette étape. Elle ne dépend d'aucune bibliothèque de tokenizers. Le test test_tokenizer_roundtrip_and_bpe la verrouille.
@QUESTION
Une fusion BPE modifie quoi dans le vocabulaire ?
@CORRECT
Une segmentation différente et réversible
@WRONG
- L’ordre des caractères dans le texte
- Le sens sémantique des embeddings
- La normalisation des probabilités de sortie
@EXPLANATION
La fusion change la suite d'identifiants. Elle reste décodable. Elle ne touche ni au matériel ni à la loss.
@@@
@ID 2.8
@TITLE Identifiants de tokens
@TAG Tokenizer
@MINUTES 25
@WHY
À partir d'ici, le modèle ne reçoit plus que des entiers. Confondre l'entier 2 et le caractère « 2 » est un bug classique au moment de brancher le réseau.
@OBJECTIVES
- Lire une liste d'identifiants
- Dire que l'entier est un index, pas une grandeur
- Vérifier un aller-retour sur un cas court
@PREREQ Tokenizer, étapes 2.5 et 2.7.
@INTUITION
L'identifiant 7 ne veut pas dire « sept fois plus » que l'identifiant 1. C'est un numéro de casier. Le casier contient le vecteur du token. L'arithmétique sur les numéros n'a pas de sens linguistique.
@VOCAB
Token id : l'entier. Séquence : la liste d'entiers d'un texte. Index : l'usage de cet entier pour lire une ligne de matrice. Hors vocabulaire : un entier négatif ou supérieur à V-1.
@EXPLAIN
stoi = {"a": 0, "b": 1} encode "abba" en [0, 1, 1, 0]. Additionner ces identifiants ne produit pas un token. Les comparer avec < ne dit rien sur l'alphabet, seulement sur le hasard du numérotage. En revanche, ils doivent rester dans [0, V). Le bigramme lève IndexError sinon. Cette discipline évite qu'une matrice de comptes soit écrite « à côté ».
@LANG python
@CODE
:::
stoi = {"a": 0, "b": 1}
ids = [stoi[c] for c in "abba"]
print(ids)
:::
@EXPERIMENT
Décode [0, 1, 1, 0] avec la table inverse. Tu dois retrouver "abba". Puis tente l'identifiant 5 et constate l'échec.
@EXERCISE
Explique en une phrase pourquoi on ne normalise pas les identifiants comme on normaliserait des mesures de taille. Propose le bon objet à normaliser plus tard : le vecteur d'embedding, pas l'entier.
@BUILD
encode et decode sont le contrat public du tokenizer. Les modèles du dépôt, BigramModel comme TinyGPT, ne reçoivent que le résultat de encode.
@QUESTION
Un identifiant de token est…
@CORRECT
Un index entier du vocabulaire fixé
@WRONG
- Une mesure numérique de similarité
- Le nombre d’occurrences dans le corpus
- Une position absolue dans le document
@EXPLANATION
L'identifiant indexe le vocabulaire. La probabilité et le gradient sont d'autres nombres, produits plus tard par le modèle.
@@@
@ID 2.9
@TITLE Embeddings
@TAG Représentation
@MINUTES 35
@WHY
Un entier n'a pas de géométrie. L'embedding lui associe un vecteur appris, pour que deux tokens puissent se ressembler autrement que par leur numéro.
@OBJECTIVES
- Décrire une table V par D
- Lire la forme d'un batch d'embeddings
- Expliquer que la table est un paramètre
@PREREQ Identifiants et vecteurs.
@INTUITION
Imagine une étagère : une ligne par token, D nombres sur la ligne. Prendre le token 4, c'est prendre la ligne 4. Au début, les lignes sont aléatoires. L'entraînement les déplace pour que la loss baisse.
@VOCAB
Embedding : le vecteur d'un token. Table : la matrice (V, D). D, ou d_model : la dimension du modèle. Lookup : lire une ligne par un indice, sans multiplication.
@EXPLAIN
Si V = 10 et D = 4, la table a 40 paramètres. Un lot d'identifiants de forme (2, 5) devient un tenseur (2, 5, 4) : pour chaque position, une ligne. Ce n'est pas un produit matriciel, c'est une lecture. Dans TinyGPT, params["tok"] est cette table. Avec tie_weights, la même table sert à la sortie : les logits sont le produit du vecteur caché par la transposée des embeddings. On verra pourquoi au niveau 5. Pour l'instant, retiens la forme.
@LANG python
@CODE
:::
import numpy as np
table = np.zeros((10, 4))
table[1] = [0.2, 0, 0, 0]
ids = np.array([[1, 2]])
print(table[ids].shape)
:::
@EXPERIMENT
Vérifie que table[ids][0, 0] est bien la ligne du token 1. Changer table[1, 0] doit changer cette sortie, sans toucher aux identifiants.
@EXERCISE
Combien de paramètres contient une table V=1000, D=64 ? Donne aussi la forme de la sortie pour une séquence de 8 tokens et un batch de 2.
@BUILD
La table tok est créée dans TinyGPT.__init__. Le test des options modernes vérifie que, quand les poids sont liés, il n'y a pas une seconde matrice head.
@QUESTION
Un embedding transforme un identifiant en…
@CORRECT
Une ligne de la table d’embeddings, de dimension fixée
@WRONG
- Une probabilité scalaire entre 0 et 1
- Un vecteur de longueur égale au texte
- Une liste de caractères de même longueur
@EXPLANATION
La lecture de table remplace l'entier par D nombres. La probabilité n'apparaît qu'après les logits et softmax.
@@@
@ID 2.10
@TITLE Position
@TAG Séquence
@MINUTES 30
@WHY
Une table d'embeddings ne sait pas si un token est le premier ou le dixième. Deux phrases aux mêmes mots dans un ordre différent auraient la même somme de vecteurs. Il faut une information de position.
@OBJECTIVES
- Montrer que l'ordre change le sens
- Distinguer position absolue et absence de position
- Annoncer RoPE sans le détailler encore
@PREREQ Embeddings, étape 2.9.
@INTUITION
« le chat mange » et « mange le chat » n'ont pas le même sens. Si le modèle ne reçoit qu'un sac de vecteurs, il ne voit pas la différence. On lui donne donc, en plus du token, un repère sur la place.
@VOCAB
Position absolue : un vecteur appris pour la place 0, un autre pour la place 1, etc. Addition : le choix simple, embedding de token plus embedding de position. RoPE : une rotation du vecteur selon la place, vue au niveau 5.
@EXPLAIN
Le mini-GPT par défaut ajoute params["pos"][t] au vecteur du token t. La table a une ligne par place jusqu'à block_size. Au-delà, on refuse la séquence : on n'a pas de vecteur pour la place 40 si on n'en a appris que 32. C'est la limite concrète des positions absolues. RoPE, plus tard, n'ajoute pas une table : il tourne les requêtes et les clés selon leur place, ce qui se généralise un peu mieux. Les deux servent le même besoin : que la place 0 et la place 3 ne soient pas interchangeables.
@LANG python
@CODE
:::
positions = list(range(5))
print(positions)
print(["mange", "le", "chat"])
print(["le", "chat", "mange"])
:::
@EXPERIMENT
Écris deux séquences d'identifiants qui utilisent les mêmes nombres dans un ordre différent. Explique pourquoi une somme des embeddings, sans position, serait identique.
@EXERCISE
Pour un block_size de 8, quelle erreur conceptuelle fait-on en demandant la position 8 ? Rappelle que les index vont de 0 à 7.
@BUILD
GPTConfig.pos vaut "absolute" ou "rope". Le forward ajoute la table seulement dans le premier cas. Le test test_modern_options_keep_contract vérifie que les deux options produisent des logits de même forme.
@QUESTION
L'information de position sert à…
@CORRECT
La place des tokens dans une séquence
@WRONG
- Classer les tokens par fréquence
- Garantir la causalité sans masque
- Identifier le document d’origine de chaque token
@EXPLANATION
Sans position, l'ordre n'est pas représenté. La loss et le disque sont d'autres sujets.
@@@
@ID 2.11
@TITLE Batches et séquences
@TAG Données
@MINUTES 30
@WHY
On n'entraîne pas un token isolé, ni toute une vie d'un coup. On groupe des fenêtres de longueur fixe. Lire leur forme évite les bugs les plus coûteux du projet.
@OBJECTIVES
- Lire une forme (B, T)
- Distinguer batch et temps
- Construire une fenêtre next-token
@PREREQ Positions et identifiants.
@INTUITION
B est le nombre d'exemples traités ensemble. T est la longueur de chaque exemple. Mélanger ces deux axes, c'est apprendre le token d'à côté à la place du token suivant.
@VOCAB
Batch : l'axe B. Séquence : l'axe T. Fenêtre : un extrait de longueur block_size. Cible décalée : la même fenêtre, avancée d'un cran.
@EXPLAIN
x = [[1, 2, 3], [4, 5, 6]] a la forme (2, 3) : deux séquences de trois tokens. Pour prédire le suivant, si la fenêtre d'entrée est ids[i : i+T], la cible est ids[i+1 : i+1+T]. Le dernier token de l'entrée prédit le token juste après la fenêtre. Oublier le décalage d'un cran apprend à recopier l'entrée. Le mini-GPT attend des entiers de forme (B, T) et renvoie (B, T, V). Le test utilise (1, 5) et attend (1, 5, 12) pour un vocabulaire de 12.
@LANG python
@CODE
:::
import numpy as np
ids = [1, 2, 3, 4, 5, 6]
T = 3
x = np.array(ids[0:T])
y = np.array(ids[1:T + 1])
print(x, y)
:::
@EXPERIMENT
Avec la liste 1..6 et T=3, écris x et y avant d'exécuter. y doit valoir [2, 3, 4] si x vaut [1, 2, 3].
@EXERCISE
Donne la forme de x pour 4 séquences de 16 tokens, puis la forme des logits si V = 50. Écris ce que voudrait dire, par erreur, une sortie (16, 4, 50).
@BUILD
Tous les forwards du dépôt refusent un idx qui n'est pas de rang 2. C'est une garde volontaire : une liste plate ne doit pas être interprétée en silence comme un batch.
@QUESTION
Dans un tableau d'identifiants de forme (2, 3), que vaut la première dimension ?
@CORRECT
2 séquences dans le batch
@WRONG
- 3 séquences dans le batch
- 6 séquences dans le batch
- 2 tokens dans chaque séquence
@EXPLANATION
La convention du laboratoire est (batch, temps). Le 2 est le batch, le 3 est la longueur.
