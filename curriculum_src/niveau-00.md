@@@
@ID 0.1
@TITLE Ordinateur, matériel, CPU, RAM et stockage
@TAG Départ
@MINUTES 15
@WHY
Tout le laboratoire s'exécute sur une machine réelle. Sans distinguer qui calcule, qui garde le travail en cours et qui conserve les fichiers, les pannes futures — mémoire saturée, disque plein, entraînement lent — restent illisibles.
@OBJECTIVES
- Distinguer CPU, RAM, stockage et le rôle futur du GPU
- Situer où un programme s'exécute
- Relier ces limites à la taille d'un modèle
@PREREQ Aucun. C'est le départ du parcours.
@INTUITION
Imagine un atelier. Le plan de travail est la RAM : tout ce qui est en cours y est posé, et il se vide quand la machine s'éteint. Les étagères sont le stockage : code, données et poids y restent. Le CPU est l'artisan qui exécute les instructions. Un GPU, plus tard, sera une équipe qui répète le même calcul numérique des milliers de fois en parallèle.
@VOCAB
CPU : processeur général. RAM : mémoire vive, rapide et volatile. Stockage : SSD ou disque, persistant et plus lent. VRAM : mémoire du GPU. Programme : instructions chargées en mémoire puis exécutées.
@EXPLAIN
Au lancement d'un entraînement, le système lit le code et les données depuis le stockage, les copie en RAM ou en VRAM, puis le CPU ou le GPU calcule. Un modèle peut donc refuser de démarrer alors que le disque est presque vide : c'est la mémoire de travail qui est trop petite. L'inverse existe aussi. Un gros corpus occupe le stockage même si personne ne l'a chargé. Retenir trois ordres de grandeur suffit pour l'instant : un octet, un million d'octets (un mégaoctet, Mo) et un milliard (un gigaoctet, Go). Les systèmes comptent souvent en puissances de 2 : un Mio vaut 1024 × 1024 = 1 048 576 octets, un Gio vaut 1024 Mio. L'écart est d'environ 7 % pour les Gio : 16 Gio de RAM font environ 17,2 Go. Le code ci-dessous compte en Mio et Gio, comme le gestionnaire de tâches. Un paramètre en float32 pèse 4 octets.
@LANG python
@CODE
:::
octet = 1
mio = 1024 * 1024
gio = 1024 * mio
ram = 16 * gio
poids = 1_000_000 * 4  # un million de paramètres float32
print(poids / ram)
:::
@EXPERIMENT
Ouvre les informations système et note trois nombres dans un fichier notes/machine.txt : quantité de RAM, nom du processeur, espace libre. Tu n'interprètes pas le reste.
@EXERCISE
En une phrase chacun, dis le rôle du stockage, de la RAM et du CPU pendant l'exécution d'un programme. Précise lequel est vidé à l'extinction.
@BUILD
Crée le dossier de travail du fil rouge. Dans ce dépôt, le laboratoire vit déjà dans model/. Lis model/stats.py sans chercher à tout comprendre : c'est la première brique, encore simple, qui lira des nombres plus tard.
@QUESTION
L'entraînement s'arrête parce que le modèle « ne tient pas en mémoire », alors que le disque a encore de la place. Quel composant est saturé ?
@CORRECT
La RAM ou la VRAM, mémoire de travail du calcul
@WRONG
- Le clavier, qui ne transmet plus les caractères
- Uniquement le stockage, parce que les poids sont des fichiers
- Le câble réseau, parce qu'un modèle exige Internet en permanence
@EXPLANATION
Les poids utilisés pour calculer et les résultats intermédiaires doivent être dans la mémoire de travail. Le stockage conserve les fichiers, il ne remplace pas la RAM au moment du calcul.
@@@
@ID 0.2
@TITLE Système, fichiers et chemins
@TAG Départ
@MINUTES 15
@WHY
La plupart des erreurs de débutant ne sont pas des erreurs d'IA. Ce sont des fichiers introuvables, parce que le programme regarde dans un autre dossier que celui que tu imagines.
@OBJECTIVES
- Distinguer fichier, dossier et chemin
- Lire un chemin relatif et un chemin absolu
- Prévoir où Python cherchera un fichier
@PREREQ L'étape 0.1.
@INTUITION
Le disque est un arbre. La racine du projet contient des dossiers, qui contiennent des fichiers. Un chemin est l'adresse d'un nœud dans cet arbre. Si tu te trompes d'adresse, le fichier a beau exister : pour le programme, il n'est pas là.
@VOCAB
Chemin absolu : adresse complète depuis la racine du système. Chemin relatif : adresse depuis le dossier courant. Extension : la fin du nom, comme .py ou .txt, qui indique souvent le type.
@EXPLAIN
Depuis le dossier ai-lab, le chemin relatif notes/machine.txt désigne le fichier machine.txt dans le sous-dossier notes. Le chemin absolu, lui, commence par / sur Linux et macOS, ou par un lecteur comme C:\ sur Windows. Python n'utilise pas « le dossier que tu as ouvert dans l'éditeur » par magie : il utilise le dossier de travail du processus, souvent celui depuis lequel tu as lancé la commande. Deux programmes peuvent donc voir deux fichiers différents sous le même nom relatif.
@LANG text
@CODE
:::
ai-lab/
├── README.md
├── notes/
│   └── machine.txt
└── model/
    └── stats.py
:::
@EXPERIMENT
Crée ai-lab/notes/machine.txt. Depuis ai-lab, vérifie que le chemin relatif notes/machine.txt ouvre bien ce fichier, puis recommence depuis le dossier parent et observe l'échec.
@EXERCISE
Écris le chemin relatif de model/stats.py et celui de notes/machine.txt quand ton dossier courant est ai-lab. Dis lequel casse si tu lances le programme depuis un autre dossier.
@BUILD
La structure du dépôt suit déjà cette idée : model/data/mesures.txt est le fichier de nombres, model/stats.py est le programme qui le lira. Repère ces deux chemins dans l'arborescence.
@QUESTION
Depuis le dossier ai-lab, quel chemin relatif désigne le fichier notes/machine.txt ?
@CORRECT
notes/machine.txt
@WRONG
- /notes/machine.txt, qui part de la racine du système
- machine.txt, qui désigne un fichier directement dans ai-lab
- RAM/machine.txt, qui mélange matériel et fichiers
@EXPLANATION
Un chemin relatif se lit depuis le dossier courant. notes/machine.txt descend dans notes puis nomme le fichier. Le slash initial en ferait un chemin absolu.
@@@
@ID 0.3
@TITLE Terminal et commandes
@TAG Outil
@MINUTES 20
@WHY
Installer Python, lancer un script, entraîner un modèle et versionner le projet passent par le terminal. On n'apprend ici que les commandes qui empêchent de se perdre.
@OBJECTIVES
- Afficher le dossier courant
- Lister son contenu et changer de dossier
- Lancer une commande en sachant où elle s'exécute
@PREREQ L'étape 0.2.
@INTUITION
Le terminal n'est pas un second langage de programmation. C'est une porte textuelle : tu écris une commande, le système l'exécute, il affiche un résultat ou une erreur. Le dossier courant est le « ici » de toutes les commandes qui suivent.
@VOCAB
pwd : affiche le dossier courant. ls : liste le contenu. cd : change de dossier. Argument : le complément donné à une commande, par exemple le nom du dossier après cd.
@EXPLAIN
pwd, ls et cd suffisent pour ce parcours, et PowerShell les accepte aussi. cd .. remonte d'un niveau. cd notes entre dans notes, à condition que ce dossier existe dans le dossier courant. Une commande lancée au mauvais endroit est la cause classique d'un fichier « introuvable » alors qu'il est simplement ailleurs. Avant chaque commande importante du laboratoire, tu vérifies pwd.
@LANG bash
@CODE
:::
pwd
ls
cd ai-lab
pwd
ls
# pwd dit où tu es, ls montre le contenu, cd change le dossier
:::
@EXPERIMENT
Entre dans ai-lab, liste les fichiers, remonte d'un cran avec cd .., puis redescends. Le but est de pouvoir refaire ce trajet sans réfléchir.
@EXERCISE
Place-toi dans ai-lab et vérifie que notes apparaît dans la liste. Écris la suite exacte des commandes que tu as tapées.
@BUILD
Toutes les commandes du dépôt, y compris pytest, se lancent depuis la racine du projet, là où se trouvent requirements.txt et le dossier model/. Note cette convention dans ton README.
@QUESTION
Quelle commande change le dossier courant ?
@CORRECT
cd, qui change le dossier courant
@WRONG
- ls, qui affiche le contenu sans se déplacer
- pwd, qui affiche seulement où tu es
- print, qui n'est pas une commande du terminal
@EXPLANATION
cd signifie change directory. ls regarde, pwd situe, cd déplace le « ici » des commandes suivantes.
@@@
@ID 0.4
@TITLE Installer et vérifier Python
@TAG Python
@MINUTES 20
@WHY
Python est le langage du laboratoire. Avant d'écrire du code, on vérifie que le terminal trouve bien un interpréteur, et lequel. Supposer que « Python est installé » est une source de bugs silencieux.
@OBJECTIVES
- Expliquer le rôle de l'interpréteur
- Afficher la version réellement utilisée
- Ouvrir puis quitter le mode interactif
@PREREQ L'étape 0.3.
@INTUITION
Un fichier .py est du texte. L'interpréteur est le programme qui lit ce texte et exécute les instructions. Si le terminal ne trouve pas l'interpréteur, le fichier a beau être correct : rien ne se lance.
@VOCAB
Interpréteur : le programme python ou python3. Version : le numéro affiché par --version. REPL : la boucle interactive où tu tapes une instruction et vois le résultat tout de suite.
@EXPLAIN
Installe Python 3.12 depuis python.org/downloads. Sous Windows, lance l'installateur officiel et active l'ajout de Python au PATH si cette option est proposée ; ouvre ensuite un NOUVEAU PowerShell. Essaie py -3 --version, puis py -3 -c "print(2 + 2)". Sous macOS, utilise l'installateur officiel et python3 --version dans Terminal. Sous Linux, installe python3 et le paquet venv par le gestionnaire de ta distribution. La sortie doit annoncer Python 3.12 et le calcul doit afficher 4. Si la commande est introuvable, vérifie le PATH et relance le terminal ; si le venv échoue, vérifie que le module venv de cette version est installé. Note la version et la commande qui fonctionnent. N'installe pas NumPy avant d'avoir vérifié cet interpréteur. Les commandes du cours supposent ensuite la racine du dépôt ; sous Windows, py -3 remplace python3 pour créer l'environnement. Le guide Installation de l'atelier détaille les trois systèmes.
@LANG bash
@CODE
:::
python3 --version
python3 -c "print(2 + 2)"
:::
@EXPERIMENT
Lance la commande de version, puis le calcul 2 + 2. Si python3 échoue, essaie python. Note celle qui fonctionne : ce sera ta commande pour tout le parcours.
@EXERCISE
Écris dans le README la version exacte affichée, et la commande qui l'a produite. Ajoute une phrase : un fichier .py n'est pas exécuté tout seul, il est lu par l'interpréteur.
@BUILD
Note l'interpréteur qui fonctionne sur ta machine. Le fichier atelier/INSTALLATION.md donne les commandes Windows, macOS et Linux, les erreurs fréquentes et la vérification finale de NumPy. La lecture mobile reste possible ; le projet complet se réalise avec fichiers et terminal.
@QUESTION
À quoi sert l'interpréteur Python ?
@CORRECT
À lire et exécuter les instructions écrites en Python
@WRONG
- À augmenter la quantité de RAM disponible
- À créer un modèle déjà entraîné
- À remplacer le dossier du projet
@EXPLANATION
L'interpréteur est le programme qui exécute le texte Python. Il ne devine pas un modèle et ne modifie pas le matériel.
@CODEFILE
model/stats.py
@SYMBOL
build_report

@@@
@ID 0.5
@TITLE Premier programme
@TAG Python
@MINUTES 15
@WHY
Tout le futur modèle sera du code. Le geste qui compte, ici et jusqu'à la dernière architecture, est toujours le même : écrire, exécuter, observer, corriger une seule chose.
@OBJECTIVES
- Écrire une instruction print
- Exécuter un fichier depuis le terminal
- Lire une erreur de syntaxe simple
@PREREQ Savoir lancer Python, étape 0.4.
@INTUITION
Un programme est une recette que la machine suit à la lettre. Python ne devine pas ce que tu voulais dire. Cette rigidité est un avantage : quand le résultat est faux, le texte du programme est la seule source de vérité.
@VOCAB
Instruction : un ordre exécutable. print : fonction qui affiche une valeur. Chaîne : du texte entre guillemets. Syntaxe : les règles d'écriture, avant même l'exécution.
@EXPLAIN
print("Bonjour") affiche Bonjour puis passe à la ligne. Les guillemets délimitent le texte. Les parenthèses entourent ce qu'on donne à la fonction. Si tu oublies le guillemet fermant, Python s'arrête avant de lancer quoi que ce soit et signale une SyntaxError. Ce n'est pas encore un bug de modèle : c'est une phrase mal formée. On corrige le texte, on relance, on compare l'affichage à ce qu'on avait prévu.
@LANG python
@CODE
:::
print("Bonjour, IA")
print(42)
# une chaîne, puis un entier : deux types affichés
:::
@EXPERIMENT
Enregistre ces deux lignes dans bonjour.py, lance python3 bonjour.py, puis retire volontairement le dernier guillemet. Lis le message, remets le guillemet, relance.
@EXERCISE
Crée message avec le texte « construire un petit modèle » et nombre avec l'entier 42. Affiche ces deux variables. Explique ce que changeraient des guillemets autour de 42 ; les fonctions avec return arriveront en 0.9.
@BUILD
Ce cycle écrire-exécuter est celui de pytest à la fin du dépôt : chaque brique de model/ a un test qui joue le rôle de l'affichage attendu. Tu viens de faire la version manuelle de ce geste.
@QUESTION
Que fait print en Python ?
@CORRECT
Il affiche une valeur puis passe à la ligne
@WRONG
- Il entraîne un réseau de neurones
- Il enregistre automatiquement un fichier
- Il réserve de la VRAM
@EXPLANATION
print n'apprend rien et n'écrit pas un fichier. Il envoie une représentation de la valeur vers la sortie du terminal.
@CODEFILE
model/stats.py
@SYMBOL
summarize

@@@
@ID 0.6
@TITLE Variables et types
@TAG Python
@MINUTES 25
@WHY
Les poids, les pertes, les tokens et les hyperparamètres seront tous des valeurs nommées. Confondre un texte et un nombre produit des bugs qui n'ont rien à voir avec l'apprentissage.
@OBJECTIVES
- Nommer une valeur avec une variable
- Distinguer str, int et float
- Observer un type avec type()
@PREREQ Avoir exécuté un programme, étape 0.5.
@INTUITION
Une variable est une étiquette posée sur une valeur. Le nom est pour toi. La valeur, et son type, sont pour Python. Changer l'étiquette ne change pas le type. Écrire un nombre entre guillemets, si, parce que tu as alors créé du texte.
@VOCAB
Variable : nom lié à une valeur. str : texte. int : entier. float : nombre à virgule. Affectation : le symbole =, qui lie le nom de gauche à la valeur de droite.
@EXPLAIN
nom = "ada" crée un str. couches = 4 crée un int. learning_rate = 0.001 crée un float. Le = n'est pas une équation à résoudre : il remplace ce que le nom désignait. type(couches) affiche <class 'int'>. Additionner un str et un int lève TypeError. Cette erreur reviendra quand un identifiant de token (int) sera concaténé par mégarde à du texte. On la lit, on ne la contourne pas en transformant tout en texte.
@LANG python
@CODE
:::
nom = "ada"
couches = 4
learning_rate = 0.001
print(nom, couches, learning_rate)
print(type(nom), type(couches), type(learning_rate))
:::
@EXPERIMENT
Ajoute print(couches + learning_rate) et prédis le type du résultat avant de lancer. Puis tente nom + couches et lis le TypeError.
@EXERCISE
Crée model_name (str), n_layers (int) et temperature (float). Affiche les trois types. La température d'échantillonnage, plus tard, sera bien un float, pas un texte.
@BUILD
Les configurations du laboratoire sont des nombres et des chaînes explicites, jamais des valeurs devinées. Quand tu liras GPTConfig dans model/transformer.py, chaque champ aura un type précis.
@QUESTION
Dans n_layers = 4, que représente n_layers ?
@CORRECT
Le nom d'une variable qui désigne l'entier 4
@WRONG
- Une fonction qui crée quatre couches
- Une erreur de syntaxe obligatoire
- Le nom d'un fichier
@EXPLANATION
Le nom est à gauche du =, la valeur à droite. n_layers désigne donc l'entier 4 tant qu'on ne le réaffecte pas.
@@@
@ID 0.7
@TITLE Conditions
@TAG Python
@MINUTES 20
@WHY
Le code du laboratoire devra décider : arrêter une boucle, refuser une forme de tenseur, choisir un dos Transformer ou SSM. Ces décisions sont des conditions.
@OBJECTIVES
- Écrire if, elif et else
- Comparer des nombres avec <, == et !=
- Prévoir quelle branche s'exécute
@PREREQ Variables et types, étape 0.6.
@INTUITION
Une condition est un aiguillage. Python évalue une affirmation vraie ou fausse, puis n'exécute que le bloc correspondant. Il ne fait pas « un peu » des deux.
@VOCAB
Booléen : True ou False. Bloc : les lignes indentées sous les deux-points. elif : une condition testée seulement si les précédentes sont fausses. Comparaison : un opérateur qui produit un booléen.
@EXPLAIN
L'indentation n'est pas décorative : elle dit quelles lignes appartiennent au if. Quatre espaces sont la convention du projet. loss < 1.0 est vrai ou faux. Si c'est vrai, le premier bloc tourne et le else est ignoré. Attention à la frontière : loss < 1.0 est faux quand loss vaut exactement 1.0. Pour inclure l'égalité on écrit <=. == compare, = affecte. Les mélanger est une erreur de syntaxe dans une condition, et c'est tant mieux.
@LANG python
@CODE
:::
loss = 0.8
if loss < 0.5:
    print("très bas")
elif loss < 1.0:
    print("sous le seuil")
else:
    print("au-dessus")
:::
@EXPERIMENT
Essaie loss = 0.4, puis 0.8, puis 1.0. Avant chaque lancement, écris le message que tu attends. Compare.
@EXERCISE
Écris une condition qui affiche « modèle léger » si n_params est strictement inférieur à 1_000_000, « moyen » jusqu'à 10_000_000 inclus, et « lourd » au-delà.
@BUILD
model/transformer.py lève ValueError quand une configuration est impossible, par exemple un d_model non divisible par le nombre de têtes. C'est une condition de garde : mieux vaut échouer tôt qu'un calcul silencieusement faux.
@QUESTION
Avec loss = 1.0, que vaut l'expression loss < 1.0 ?
@CORRECT
False, car 1.0 n'est pas strictement inférieur à 1.0
@WRONG
- True, parce que 1.0 est le seuil
- 1.0, parce qu'une comparaison renvoie le nombre
- Une erreur, parce qu'on ne peut pas comparer un float
@EXPLANATION
L'opérateur < est strict. 1.0 n'est pas inférieur à 1.0, donc l'expression vaut False et le bloc if est sauté.
@@@
@ID 0.8
@TITLE Boucles
@TAG Python
@MINUTES 20
@WHY
Entraîner, c'est répéter un calcul. La boucle est la première forme de cette répétition, bien avant les optimiseurs et les epochs. Elle revient dans chaque entraînement.
@OBJECTIVES
- Écrire une boucle for avec range
- Suivre la valeur de la variable de boucle
- Accumuler un total dans une variable
@PREREQ Conditions, étape 0.7.
@INTUITION
Une boucle dit : fais ce bloc pour chaque élément, ou un certain nombre de fois. Le corps de la boucle ne s'écrit qu'une fois. C'est le compteur qui change.
@VOCAB
for : boucle sur une suite. range(n) : les entiers 0, 1, …, n-1. Itération : un tour de boucle. Accumulateur : une variable mise à jour à chaque tour, par exemple une somme.
@EXPLAIN
range(4) produit 0, 1, 2 et 3. Il s'arrête avant 4. C'est le même choix que l'indexation des listes, qui commence à 0. Oublier cette borne exclusive fait écrire une epoch de trop ou lire un token passé la fin. Dans la boucle, on peut accumuler : total = total + valeur. L'ordre des tours est garanti pour un range. On s'en servira pour les pas d'entraînement, qui doivent être reproductibles.
@LANG python
@CODE
:::
total = 0
for step in range(4):
    total = total + step
    print("pas", step, "total", total)
:::
@EXPERIMENT
Prédis les quatre lignes avant d'exécuter. Change range(4) en range(1, 4) et explique quel tour a disparu.
@EXERCISE
Écris une boucle de 5 tours qui affiche le carré du compteur. Le dernier carré affiché doit être 16. Si tu obtiens 25, ta borne est inclusive par erreur.
@BUILD
Les boucles d'entraînement de model/mlp.py et model/train.py répètent exactement ce schéma : un compteur, un calcul, une mise à jour. Rien de plus magique n'apparaîtra plus tard, seulement des calculs plus riches à l'intérieur du tour.
@QUESTION
Combien de tours exécute range(4) ?
@CORRECT
4 tours, pour les valeurs 0, 1, 2 et 3
@WRONG
- 3 tours, parce qu'on commence à 1
- 5 tours, parce que la borne est incluse
- Un nombre aléatoire de tours
@EXPLANATION
range(4) s'arrête avant 4. Les valeurs sont 0, 1, 2 et 3, donc quatre tours.
@@@
@ID 0.9
@TITLE Fonctions
@TAG Python
@MINUTES 25
@WHY
Un modèle lisible est découpé en fonctions : une pour la loss, une pour un pas, une pour générer. Sans ce découpage, on ne peut ni tester ni remplacer une brique.
@OBJECTIVES
- Définir une fonction avec def
- Passer des arguments et renvoyer une valeur
- Distinguer afficher et renvoyer
@PREREQ Boucles, étape 0.8.
@INTUITION
Une fonction est une petite machine nommée. Elle reçoit des entrées, fait un travail, et peut rendre une sortie à celui qui l'a appelée. Tant que personne ne l'appelle, définir une fonction n'exécute pas son corps.
@VOCAB
Paramètre : le nom utilisé dans la définition. Argument : la valeur fournie à l'appel. return : renvoie une valeur et quitte la fonction. Effet de bord : une action visible comme print, qui n'est pas la valeur renvoyée.
@EXPLAIN
def carre(x): puis return x * x. L'appel y = carre(6) lie 36 à y. print(carre(6)) affiche 36 mais si tu n'as pas de return, l'appel vaut None : il a peut-être affiché quelque chose, il n'a rien rendu. Cette distinction casse les débutants au moment des tests. Un test pytest regarde la valeur renvoyée, pas ce qui a été imprimé. On retourne donc les résultats, et on n'imprime que pour regarder soi-même.
@LANG python
@CODE
:::
def carre(x):
    return x * x

resultat = carre(-3)
print(resultat)
:::
@EXPERIMENT
Retire le return et remplace-le par print(x * x). Regarde ce que vaut resultat. Remets le return.
@EXERCISE
Écris ajoute(a, b) qui renvoie la somme, sans l'afficher. Vérifie ajoute(2, 5) == 7 et ajoute(-1, 1) == 0.
@BUILD
Chaque fichier de model/ expose des fonctions ou des méthodes appelables par les tests. Ouvre model/mathutil.py : softmax et cross_entropy sont des fonctions pures, elles renvoient un résultat au lieu d'imprimer.
@QUESTION
À quoi sert return dans une fonction Python ?
@CORRECT
À renvoyer une valeur à l'appelant et quitter la fonction
@WRONG
- À répéter la fonction indéfiniment
- À afficher obligatoirement du texte
- À enregistrer un fichier sur le disque
@EXPLANATION
return transmet une valeur. L'affichage est un autre geste, print, qui ne remplace pas la valeur renvoyée.
@@@
@ID 0.10
@TITLE Listes et dictionnaires
@TAG Python
@MINUTES 30
@WHY
Un corpus, une configuration et un historique de loss sont des collections. Le modèle ne manipule presque jamais un nombre isolé : il manipule des suites et des tables.
@OBJECTIVES
- Créer une liste et lire un élément par son index
- Ajouter un élément
- Retrouver une valeur dans un dictionnaire grâce à sa clé
@PREREQ Fonctions, étape 0.9.
@INTUITION
Une liste garde un ordre. On compte à partir de zéro. Un dictionnaire ne sert pas à compter : il associe une clé à une valeur, comme un mot à sa définition. L'ordre d'un dictionnaire n'est pas l'information principale.
@VOCAB
Index : la position dans une liste, à partir de 0. len : le nombre d'éléments. Clé : l'étiquette dans un dictionnaire. append : ajoute à la fin d'une liste.
@EXPLAIN
tokens = ["le", "chat"] puis tokens[0] vaut "le". tokens[2] lève IndexError parce que les index valides sont 0 et 1. config = {"layers": 4, "dim": 128} puis config["dim"] vaut 128. Une clé absente lève KeyError. On utilisera exactement cette erreur dans le tokenizer : un caractère inconnu n'a pas de clé dans stoi. Choisir une liste ou un dictionnaire dépend de la question. « Quel est le troisième token ? » appelle une liste. « Quelle est la dimension ? » appelle une clé nommée.
@LANG python
@CODE
:::
tokens = ["le", "chat", "dort"]
config = {"layers": 4, "dim": 128}
print(tokens[0], config["dim"])
tokens.append("ici")
config["vocab"] = 32
print(len(tokens), config["vocab"])
:::
@EXPERIMENT
Affiche tokens[-1], le dernier élément. Puis lis un index égal à len(tokens) et identifie l'IndexError.
@EXERCISE
Crée une configuration avec learning_rate, batch_size et epochs. Écris une fonction get_dim(config) qui renvoie config["dim"] et teste-la.
@BUILD
CharTokenizer, dans model/tokenizer.py, est un dictionnaire caractère vers identifiant et le dictionnaire inverse. La liste des identifiants est le résultat de encode.
@QUESTION
Quel est l'index du premier élément d'une liste Python ?
@CORRECT
0, le premier index d'une liste Python
@WRONG
- 1, comme dans le comptage quotidien
- -1, qui désigne en réalité le dernier élément
- La longueur de la liste
@EXPLANATION
Les index commencent à 0. -1 est autorisé, mais il pointe vers le dernier élément, pas vers le premier.
@@@
@ID 0.11
@TITLE Modules
@TAG Python
@MINUTES 20
@WHY
Le laboratoire ne tient pas dans un seul fichier. Tokenizer, loss, entraînement et mesures doivent pouvoir changer séparément. Le module est cette frontière.
@OBJECTIVES
- Importer une fonction depuis un autre fichier
- Comprendre où Python cherche un module
- Lancer un fichier comme programme avec __main__
@PREREQ Fonctions et fichiers, étapes 0.9 et 0.2.
@INTUITION
Un module est un fichier .py que un autre fichier peut importer. Importer, c'est rendre des noms disponibles, pas relancer tout le projet au hasard.
@VOCAB
import : charge un module. from x import y : ne prend qu'un nom. Package : un dossier de modules, souvent avec __init__.py. __main__ : le nom spécial du fichier que tu lances directement.
@EXPLAIN
Si mathutil.py définit softmax, un autre fichier peut écrire from model.mathutil import softmax, à condition d'être lancé depuis la racine du projet, là où le dossier model est visible. Python ne fouille pas tout le disque. Il regarde le dossier courant et les chemins d'installation. Le bloc if __name__ == "__main__": ne s'exécute que quand on lance ce fichier, pas quand on l'importe. C'est ainsi que model/__main__.py peut faire une démonstration sans gêner pytest.
@LANG python
@CODE
:::
def double(x):
    return x * 2

if __name__ == "__main__":
    print(double(4))
:::
@EXPERIMENT
Place double dans outils.py et l'appel dans principal.py avec from outils import double. Lance principal.py depuis le dossier qui contient les deux fichiers.
@EXERCISE
Déplace carre dans outils.py. Vérifie que principal.py obtient toujours 9 pour carre(-3). Si tu obtiens ModuleNotFoundError, c'est le chemin d'import, pas la fonction.
@BUILD
Le dépôt est déjà découpé : model/tokenizer.py, model/bigram.py, model/transformer.py. Les tests importent ces modules. Ouvre tests/test_lab.py et repère un import.
@QUESTION
Un module Python est principalement…
@CORRECT
Un fichier de code que l'on peut importer
@WRONG
- Une barrette de RAM
- Un modèle déjà entraîné
- Une commande du terminal comme cd
@EXPLANATION
Le module est l'unité de code réutilisable. L'import le charge pour utiliser ses fonctions sans les recopier.
@@@
@ID 0.12
@TITLE Erreurs et débogage
@TAG Méthode
@MINUTES 25
@WHY
Construire un modèle, c'est lire des erreurs tous les jours. Le réflexe utile n'est pas d'en changer dix choses : c'est de nommer l'erreur, l'endroit, et une seule hypothèse.
@OBJECTIVES
- Lire le type et le message en bas d'une traceback
- Distinguer SyntaxError et erreur d'exécution
- Changer une seule chose puis relancer
@PREREQ Avoir vu au moins une erreur, étape 0.5.
@INTUITION
Une traceback est un récit lu de bas en haut. La dernière ligne dit le type et le message. Au-dessus, elle montre la ligne fautive, puis qui l'a appelée. Ce n'est pas du bruit : c'est la carte.
@VOCAB
Traceback : la pile d'appels affichée. SyntaxError : phrase illégale, rien n'a commencé. Exception : erreur pendant l'exécution, comme IndexError, KeyError, TypeError, ValueError. Hypothèse : ce que tu crois être la cause, testable par une modification.
@EXPLAIN
numbers = [10, 20] puis numbers[2] lève IndexError parce que les index valides sont 0 et 1. Un nom inconnu lève NameError. Une clé absente lève KeyError. Une ValueError, dans notre laboratoire, signale souvent une forme ou un réglage impossible. On copie le type dans le journal, on formule une cause en une phrase, on modifie une seule ligne, on relance. Si le message change, on a appris quelque chose. Si on a modifié cinq lignes, on ne sait plus laquelle a compté.
@LANG python
@CODE
:::
numbers = [10, 20]
print(numbers[1])
print(numbers[2])
:::
@EXPERIMENT
Lance le fichier, note le type de l'erreur et le numéro de ligne. Corrige uniquement l'index. Puis provoque un NameError avec un nom qui n'existe pas.
@EXERCISE
Écris trois lignes dans un journal : le type d'une erreur que tu as provoquée, la ligne, la cause en une phrase. Ajoute la correction.
@BUILD
Les tests du dépôt sont le journal automatisé. Quand pytest échoue, la dernière assertion dit ce qui était attendu et ce qui est arrivé. On corrige la brique, on ne commente pas le test pour le faire taire.
@QUESTION
Quel réflexe est le plus utile devant une traceback ?
@CORRECT
Lire le type, le message et la ligne, puis tester une seule hypothèse
@WRONG
- Modifier dix lignes au hasard avant de relire
- Réinstaller le système d'exploitation
- Ignorer la dernière ligne et ne lire que la première
@EXPLANATION
La dernière ligne porte le type utile. Une seule modification à la fois garde la cause identifiable.
@@@
@ID 0.13
@TITLE Git et GitHub
@TAG Outil
@MINUTES 30
@WHY
Tu vas changer l'architecture des dizaines de fois. Sans historique, une régression ne se compare à rien. Git photographie des états cohérents. GitHub publie cet historique.
@OBJECTIVES
- Lire git status
- Créer un commit avec un message clair
- Distinguer le dépôt local et GitHub
@PREREQ Terminal et fichiers, étape 0.3.
@INTUITION
Un commit n'est pas une sauvegarde automatique de chaque frappe. C'est toi qui décides qu'un ensemble de changements forme un tout compréhensible : « ajoute le tokenizer », pas « wip ».
@VOCAB
Dépôt : le projet suivi par Git. Staging : la zone de ce qui partira dans le prochain commit, remplie par git add. Commit : un état enregistré avec un message. Remote : la copie distante, ici GitHub.
@EXPLAIN
git status montre les fichiers suivis modifiés et les fichiers non suivis ; les fichiers ignorés restent masqués sauf avec --ignored. git add prépare un changement et git commit enregistre un état local. GitHub reçoit ensuite cet historique avec git push. Pour un nouveau projet, commence par git init, puis configure ton nom et ton e-mail de commit si Git les demande. Pour reprendre ce dépôt, utilise git clone avec son URL, puis cd ai-from-zero. Vérifie git diff avant de committer. .venv, caches et gros fichiers d'entraînement restent ignorés. Les poids et rapports de TP vont dans runs/ ; archive les résultats utiles séparément avec leur version de code. Un message de commit dit ce que le changement apporte.
@LANG bash
@CODE
:::
git status
git add model/tokenizer.py
git commit -m "Ajoute le tokenizer caractère"
git status
:::
@EXPERIMENT
Modifie une ligne du README, lance git status, observe le fichier listé, puis annule la modification ou commite-la si elle est voulue.
@EXERCISE
Rédige trois messages de commit possibles pour trois changements distincts du laboratoire : stats, tokenizer, test. Aucun message ne doit être « update » tout seul.
@BUILD
Le .gitignore du dépôt exclut .venv, __pycache__, node_modules et les rapports de tests. Vérifie qu'un environnement virtuel n'apparaît pas dans git status.
@QUESTION
À quoi sert principalement un commit ?
@CORRECT
À enregistrer un état cohérent du projet avec un message
@WRONG
- À exécuter Python
- À augmenter la VRAM
- À publier le site sans historique
@EXPLANATION
Le commit fige un ensemble de fichiers. L'exécution et la publication sont d'autres commandes, lancées plus tard, parfois à partir de cet état.
@@@
@ID 0.14
@TITLE Environnement virtuel
@TAG Python
@MINUTES 25
@WHY
NumPy et pytest ont des versions. Un environnement virtuel donne au projet son propre ensemble de paquets, pour qu'une installation ne casse pas un autre cours.
@OBJECTIVES
- Créer un venv
- L'activer et vérifier que pip pointe dedans
- Ne pas versionner cet environnement
@PREREQ Terminal et Python, étapes 0.3 et 0.4.
@INTUITION
Le système a un Python global. Le projet a le sien, dans un dossier .venv. Activer l'environnement, c'est décider que les commandes python et pip de ce terminal sont celles du projet.
@VOCAB
venv : environnement virtuel créé par python -m venv. Activation : la commande qui modifie le PATH du terminal. Dépendance : une bibliothèque listée dans requirements.txt. pip : l'installateur de paquets.
@EXPLAIN
python3 -m venv .venv crée le dossier. L'activation diffère : source .venv/bin/activate sur Linux et macOS, .venv\Scripts\Activate.ps1 sur PowerShell. Ensuite python -m pip install -r requirements.txt installe NumPy et pytest dans cet environnement, pas forcément pour tout le système. which python ou Get-Command python doit pointer vers .venv. On désactive avec deactivate. Le dossier .venv se reconstruit : il ne se commit pas.
@LANG bash
@CODE
:::
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pytest
:::
@EXPERIMENT
Compare le chemin de python avant et après activation. S'il ne change pas, l'activation n'a pas eu lieu dans ce terminal.
@EXERCISE
Écris dans le README les trois commandes : créer le venv, l'activer, installer les dépendances. Ajoute la phrase qui dit de ne pas committer .venv.
@BUILD
requirements.txt fixe le contrat du laboratoire : numpy et pytest. Les tests de ce dépôt sont lancés dans cet environnement, pas avec un mélange de paquets globaux.
@QUESTION
Pourquoi isoler les dépendances dans un environnement virtuel ?
@CORRECT
Pour que les versions du projet ne cassent pas les autres projets
@WRONG
- Pour accélérer la connexion Internet
- Pour entraîner un modèle sans données
- Pour remplacer Git
@EXPLANATION
L'environnement virtuel sépare les paquets. Il n'augmente pas la carte réseau et ne versionne pas le code : c'est le rôle de Git.
@@@
@ID 0.15
@TITLE NumPy et les tableaux
@TAG NumPy
@MINUTES 35
@WHY
Un réseau ne boucle presque jamais sur chaque nombre en Python pur. Il applique une opération à un tableau entier. NumPy est cet outil, et tout le laboratoire model/ est écrit avec lui.
@OBJECTIVES
- Créer un tableau et lire sa shape
- Appliquer une opération à tous les éléments
- Savoir installer numpy dans le venv
@PREREQ Listes, fonctions, et l'environnement virtuel.
@INTUITION
Une liste Python peut contenir n'importe quoi. Un tableau NumPy contient des nombres de même type, rangés dans une forme. Cette contrainte rend les calculs rapides et les erreurs de forme visibles.
@VOCAB
ndarray : le tableau NumPy. shape : le tuple des dimensions. dtype : le type des nombres, souvent float64 ici. Vectorisation : une opération appliquée au tableau, sans boucle Python explicite.
@EXPLAIN
Un tableau NumPy possède une shape : (3,) est un axe de longueur trois, (2,3) a deux lignes de trois valeurs. x * 2 multiplie chaque composante ; A @ B fait un produit matriciel. x[1:] sélectionne depuis l'index 1, x[:,0] toutes les lignes de la colonne zéro. reshape change la disposition sans ajouter de valeurs : six valeurs peuvent devenir (2,3), pas (2,4). Pour le broadcasting, compare les dimensions depuis la droite : elles doivent être égales ou l'une doit valoir 1 ; un axe absent se comporte comme 1. Ainsi (2,3)+(3,) ajoute le même biais aux deux lignes, mais (2,3)+(2,) échoue. Affiche les shapes avant et après chaque opération. Le backward doit sommer les contributions des axes diffusés pour retrouver la shape du paramètre : ce sera un TP d'autograd.
@LANG python
@CODE
:::
import numpy as np
x = np.arange(6.0).reshape(2, 3)
biais = np.array([10., 20., 30.])
print(x[:, 0], (x + biais).shape)
assert (x + biais).shape == (2, 3)
:::
@EXPERIMENT
Crée un tableau de shape (2, 3) et un autre de shape (3,). Multiplie-les et observe le résultat diffusé, puis essaie une shape incompatible et lis l'erreur.
@EXERCISE
Charge les nombres de model/data/mesures.txt avec load_numbers et passe-les à summarize. Vérifie que n vaut 7 et que la moyenne est cohérente avec un calcul à la main.
@BUILD
model/stats.py est exactement cette étape du fil rouge : lire une colonne, la convertir en tableau, calculer n, moyenne, écart-type, min et max, puis écrire un JSON. Le test test_summary_and_report verrouille ce contrat.
@QUESTION
Que décrit l'attribut shape d'un tableau NumPy ?
@CORRECT
Les dimensions du tableau, par exemple (2, 3)
@WRONG
- Le nom de la variable
- La couleur d'un pixel
- Le message de la dernière erreur
@EXPLANATION
shape est un tuple d'entiers. Il dit comment les nombres sont rangés, pas comment la variable s'appelle.
@CODEFILE
model/stats.py
@SYMBOL
summarize

@@@
@ID 0.16
@TITLE Nombres et fonctions utiles
@TAG Maths
@MINUTES 30
@WHY
Quelques fonctions reviendront sans cesse : carré, exponentielle, logarithme. On les voit ici nues, avant qu'elles ne se cachent dans une loss.
@OBJECTIVES
- Calculer une puissance et une racine
- Relier exp et log
- Lire une fonction comme une transformation entrée vers sortie
@PREREQ Fonctions Python, étape 0.9.
@INTUITION
Une fonction mathématique prend un nombre et en rend un autre. Un modèle sera une fonction énorme, avec des boutons réglables. Avant cela, exp et log sont deux machines simples, presque inverses l'une de l'autre.
@VOCAB
Puissance : x**2 est x fois x. exp(x) : e puissance x, toujours positif. log : le logarithme naturel, inverse de exp. e : la base, environ 2,718, notée math.e.
@EXPLAIN
Le carré sert à punir une erreur sans regarder son signe : (-2)**2 et 2**2 valent 4. exp sert à rendre des nombres positifs avant d'en faire des probabilités : c'est le cœur de softmax. log sert à mesurer une probabilité faible sans manipuler des produits minuscules : la cross-entropy est un log. math.exp(0) vaut 1. math.log(math.e) vaut 1. Donc log et exp s'annulent : log(exp(x)) revient à x, tant qu'on reste dans des valeurs raisonnables. On ne mélange pas log des probabilités et division au hasard.
@LANG python
@CODE
:::
import math

print(3 ** 2)
print(math.exp(0))
print(math.log(math.exp(2)))
:::
@EXPERIMENT
Calcule x**2 pour x dans -2, -1, 0, 1, 2. Note la symétrie. Puis compare math.exp(1) et math.e.
@EXERCISE
Écris carre(x) avec return et vérifie carre(-3) == 9. Écris une phrase : pourquoi la loss quadratique utilise un carré plutôt que l'erreur brute.
@BUILD
model/mathutil.py contient déjà softmax, qui est un exp normalisé, et cross_entropy, qui est un log. Tu les ouvriras vraiment aux niveaux 3 et 4. Pour l'instant, repère juste les noms.
@QUESTION
Quelle affirmation décrit le mieux exp et log ?
@CORRECT
Ce sont presque des fonctions inverses : log(exp(x)) revient à x
@WRONG
- exp transforme toujours un nombre en probabilité déjà normalisée
- log n'est défini que pour les entiers négatifs
- Les deux servent uniquement à tracer des dossiers
@EXPLANATION
exp et log s'annulent l'un l'autre sur leur domaine. exp seul ne somme pas à 1 : il faut encore diviser, c'est le travail de softmax.
@@@
@ID 0.17
@TITLE Vecteurs
@TAG Maths
@MINUTES 35
@WHY
Un embedding est un vecteur. L'attention compare des vecteurs. Tant que « vecteur » reste un mot vague, le Transformer reste un dessin. On le calcule dans cette étape.
@OBJECTIVES
- Lire un vecteur et sa dimension
- Calculer un produit scalaire
- Dire quand deux vecteurs pointent dans des sens proches
@PREREQ NumPy et les nombres, étapes 0.15 et 0.16.
@INTUITION
Un vecteur est une liste ordonnée de nombres, traitée comme un seul objet. En deux dimensions, on peut le dessiner comme une flèche. En 128 dimensions, on ne le dessine plus, mais l'arithmétique ne change pas.
@VOCAB
Dimension : le nombre de composantes. Produit scalaire : somme des produits composante par composante. Norme : la longueur, racine du produit scalaire du vecteur avec lui-même.
@EXPLAIN
[1, 2, 3] a trois dimensions. Le produit scalaire de [1, 2, 3] et [4, 5, 6] vaut 1*4 + 2*5 + 3*6 = 32. En NumPy, l'opérateur @ fait ce produit pour deux vecteurs de même taille. Un produit scalaire grand et positif indique des vecteurs plutôt alignés. Proche de zéro, ils sont plutôt orthogonaux. C'est exactement le score brut de l'attention : une requête et une clé se comparent par un produit scalaire. La division par la racine de la dimension viendra plus tard, pour que ce score ne gonfle pas tout seul.
@LANG python
@CODE
:::
import numpy as np

a = np.array([1.0, 2.0, 3.0])
b = np.array([4.0, 5.0, 6.0])
print(a @ b)
print(np.array([1.0, 0.0, 0.0]) @ a)
:::
@EXPERIMENT
Remplace b par [1, 0, 0]. Le produit doit sélectionner la première composante de a. Vérifie-le à la main avant d'exécuter.
@EXERCISE
Calcule à la main le produit scalaire de [2, 1] et [3, 4], puis confirme avec NumPy. La réponse attendue est 10.
@BUILD
model/attention.py calcule query @ key.T. Ce n'est que ce produit, appliqué à plusieurs vecteurs d'un coup. Le test test_attention_is_causal vérifie le masque, pas encore la géométrie : la géométrie, c'est cette étape.
@QUESTION
Combien de composantes a le vecteur [4, 7, 2] ?
@CORRECT
3, le nombre de composantes du vecteur
@WRONG
- 2, parce qu'on ignore le dernier nombre
- 13, la somme des composantes
- 4, parce qu'on compte à partir de 1 et qu'on ajoute une case
@EXPLANATION
La dimension est le nombre de composantes, ici trois. La somme est une autre quantité, pas la dimension.
@@@
@ID 0.18
@TITLE Matrices
@TAG Maths
@MINUTES 40
@WHY
Les poids d'une couche sont une matrice. Sans la règle des formes, on ne peut ni écrire un neurone vectoriel ni lire une erreur de multiplication.
@OBJECTIVES
- Lire lignes et colonnes
- Vérifier que les formes d'un produit matriciel s'emboîtent
- Relier une matrice à plusieurs produits scalaires
@PREREQ Vecteurs, étape 0.17.
@INTUITION
Une matrice est un tableau rectangulaire. Chaque ligne peut servir de vecteur de poids. Multiplier la matrice par un vecteur, c'est faire un produit scalaire par ligne, et empiler les résultats.
@VOCAB
Forme (n, m) : n lignes, m colonnes. Produit matriciel : (n, k) fois (k, m) donne (n, m). Identité : la matrice qui laisse un vecteur inchangé. Transposée : lignes et colonnes échangées.
@EXPLAIN
W de forme (2, 2) multipliée par x de forme (2,) donne un vecteur de forme (2,). Le k du milieu doit coïncider : (2, 3) fois (3, 4) donne (2, 4). (2, 3) fois (4, 3) est illégal, sauf si on transpose la seconde. Cette règle unique évite la majorité des bugs de couches. L'identité [[1, 0], [0, 1]] laisse [4, 5] intact. Une matrice diagonale [[2, 0], [0, 3]] multiplie chaque composante par un facteur différent. Dans un réseau, W est apprise : on ne la remplit pas à la main, mais on doit toujours pouvoir dire sa forme.
@LANG python
@CODE
:::
import numpy as np

W = np.array([[1.0, 2.0], [3.0, 4.0]])
x = np.array([5.0, 6.0])
print(W.shape, (W @ x).shape)
print(W @ x)
:::
@EXPERIMENT
Remplace W par l'identité et vérifie que le résultat est égal à x. Puis essaie une matrice (2, 3) avec ce même x et lis l'erreur de forme.
@EXERCISE
Calcule à la main [[2, 0], [0, 3]] @ [4, 5]. Le résultat attendu est [8, 15]. Confirme avec NumPy.
@BUILD
Dans TinyGPT, les projections wq, wk et wv sont des matrices de formes explicites, construites dans model/transformer.py. Le test de forme logits.shape == (1, 5, 12) est la version automatisée de cette discipline.
@QUESTION
Quelle est la shape de la matrice [[1, 2, 3], [4, 5, 6]] ?
@CORRECT
(2, 3) : deux lignes et trois colonnes
@WRONG
- (3, 2) : trois lignes et deux colonnes
- (6,) : six nombres sur un seul axe
- (2, 2), parce qu'une matrice est toujours carrée
@EXPLANATION
On compte d'abord les lignes, puis les colonnes. Il y a deux listes internes de trois nombres, donc (2, 3).
@@@
@ID 0.19
@TITLE Probabilités
@TAG Maths
@MINUTES 35
@WHY
Un modèle de langage ne choisit pas un mot au sens quotidien. Il propose une distribution sur les tokens suivants. Si cette idée est floue, softmax et la perplexité ne veulent rien dire.
@OBJECTIVES
- Lire une probabilité entre 0 et 1
- Vérifier qu'une distribution discrète somme à 1
- Distinguer un score brut et une probabilité
@PREREQ Nombres et listes.
@INTUITION
Une probabilité mesure une incertitude entre 0 et 1. Une distribution répartit cette certitude sur plusieurs issues. Si tu donnes 70 % à un token, il reste 30 % à répartir : la somme doit faire 1.
@VOCAB
Issue : un résultat possible, ici un token. Distribution discrète : une probabilité par issue. Événement impossible : probabilité 0. Score, ou logit : un nombre encore libre, pas encore converti en probabilité.
@EXPLAIN
p = [0.1, 0.7, 0.2] est une distribution : tout est positif et la somme vaut 1. [0.1, 0.7, 0.3] somme à 1.1, ce n'est plus une distribution. Un logit peut être négatif ou plus grand que 1 : ce n'est pas une probabilité. La conversion sera softmax, au niveau 3. On peut déjà vérifier une somme avec une tolérance, parce que les flottants ne tombent pas toujours sur 1 exact. 0.1 + 0.2 n'est pas toujours 0.3 en binaire. Pour un cours, on compare avec une petite marge, comme pytest.approx dans les tests.
@LANG python
@CODE
:::
def est_distribution(p):
    return all(v >= 0 for v in p) and abs(sum(p) - 1) < 1e-6

print(est_distribution([0.1, 0.7, 0.2]))
print(est_distribution([0.1, 0.7, 0.3]))
:::
@EXPERIMENT
Construis une distribution à quatre issues qui donne la moitié de la masse à la première. Affiche la somme. Puis rends une valeur négative et observe le refus.
@EXERCISE
Propose trois probabilités pour les tokens « chat », « chien » et « dort » qui somment à 1. Écris laquelle est la plus probable et laquelle est impossible si sa probabilité vaut 0.
@BUILD
BigramModel.probabilities divise chaque ligne de comptes par sa somme, précisément pour obtenir une distribution. Le lissage alpha évite les zéros absolus. Tu le verras dans model/bigram.py.
@QUESTION
Une distribution de probabilités discrète valide, c'est…
@CORRECT
Des nombres positifs ou nuls qui somment à 1
@WRONG
- N'importe quels scores, y compris négatifs
- Une seule valeur toujours égale à 100
- La shape d'une matrice
@EXPLANATION
Chaque issue reçoit une masse entre 0 et 1, et la masse totale vaut 1. Les logits ne respectent pas encore cette contrainte.
@@@
@ID 0.20
@TITLE Dérivée intuitive
@TAG Maths
@MINUTES 40
@WHY
Le gradient est une famille de dérivées. Avant le mot « gradient », il faut l'image : si j'augmente un peu ce poids, la loss monte-t-elle ou descend-elle ?
@OBJECTIVES
- Lire une dérivée comme une pente locale
- Approcher une dérivée par une petite variation
- Relier le signe de la pente au sens de la correction
@PREREQ Fonctions et puissances, étape 0.16.
@INTUITION
Sur une colline, la pente te dit de quel côté le sol monte. La dérivée est cette pente pour une fonction. Si la pente de la loss par rapport à un poids est positive, augmenter le poids augmente la loss : pour la faire baisser, on diminue le poids.
@VOCAB
Dérivée : sensibilité locale de la sortie quand l'entrée bouge un peu. Différence centrée : (f(x+eps) - f(x-eps)) / (2 eps). Signe : positif si la fonction monte, négatif si elle descend. Gradient : le vecteur des dérivées quand il y a plusieurs paramètres.
@EXPLAIN
Pour f(x) = x², la dérivée théorique est 2x. En x = 3, elle vaut 6. On peut la retrouver sans formule : choisir eps = 0.001 et calculer la différence centrée. Le laboratoire fait exactement cela dans numerical_derivative. Ce n'est pas la méthode d'entraînement — elle est trop coûteuse pour chaque poids — mais c'est le juge. Quand on écrira le gradient de la cross-entropy à la main, on le comparera à cette pente numérique. Si les deux divergent, la formule analytique est fausse, pas le modèle.
@LANG python
@CODE
:::
def f(x):
    return x * x

x = 3.0
eps = 0.001
pente = (f(x + eps) - f(x - eps)) / (2 * eps)
print(pente)
:::
@EXPERIMENT
Calcule la pente en x = 1 et en x = -2. Le signe doit changer. Relie ce signe à la phrase : « de quel côté la fonction monte ».
@EXERCISE
Approche la dérivée de f(x) = x² en x = 4. Tu dois trouver une valeur proche de 8. Écris ensuite : si cette pente était celle d'une loss, dans quel sens déplacer x pour la faire diminuer.
@BUILD
model/mathutil.py fournit numerical_derivative. Le test test_derivative_matches_square vérifie que la pente de x² en 3 est proche de 6. C'est le point de contrôle du niveau 0 : tu sais mesurer une variation avant de la faire calculer automatiquement.
@QUESTION
Une dérivée positive de la loss par rapport à un poids indique surtout que…
@CORRECT
Augmenter un peu ce poids augmente la loss
@WRONG
- Le poids doit forcément être mis à zéro
- Le disque est plein
- La dérivée est une probabilité
@EXPLANATION
Le signe positif veut dire « ça monte ». La descente de gradient ira donc dans l'autre sens. La dérivée n'est pas bornée entre 0 et 1.
