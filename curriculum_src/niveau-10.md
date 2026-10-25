@@@
@ID 10.1
@TITLE Contexte et mémoire
@TAG Mémoire
@MINUTES 25
@WHY
La fenêtre du modèle est une mémoire chère : chaque token y occupe une place et, avec l'attention, un coût quadratique. Une mémoire externe est un placard qu'on n'ouvre que si la question le demande.
@OBJECTIVES
- Distinguer fenêtre et archive
- Voir le coût de tout garder dans le contexte
- Introduire une mémoire qu'on peut éteindre
@PREREQ Fenêtre, attention, patches.
@INTUITION
Le contexte, c'est la page ouverte. La mémoire externe, c'est l'étagère. Tu n'imprimes pas l'étagère sur la page : tu en descends un extrait.
@VOCAB
Contexte : les tokens réellement donnés au modèle. Mémoire externe : des documents hors de la fenêtre, retrouvés à la demande. Retrieval : le geste d'aller chercher. k : le nombre d'extraits gardés.
@EXPLAIN
block_size limite la suite que Backbone accepte. Allonger cette limite rappelle plus de choses et augmente le terme T*T. Une autre stratégie consiste à laisser les documents dehors et à n'en coller que k dans le prompt. model/memory.py fait cette deuxième stratégie, en version minuscule : des sacs de mots, un produit scalaire, les k meilleurs textes. Ce n'est pas un index vectoriel de production, ni un réseau entraîné. C'est un interrupteur mesurable. Si tu vides la liste de documents, build_context n'a plus rien à citer. La leçon 10.4 en fera le critère : une mémoire qui ne peut pas être retirée n'est pas une mémoire, c'est une constante cachée.
@LANG python
@CODE
:::
from model.memory import build_context
print(build_context("tokenizer", ["le tokenizer decoupe le texte"], k=1))
:::
@EXPERIMENT
La chaîne contient « Question » et l'extrait. Avec une liste de documents vide, la section Extraits reste vide : la mémoire est éteinte.
@EXERCISE
Pourquoi ne pas coller les trois documents du test dans chaque prompt ? Parce que le contexte grandit même quand la question n'a besoin que d'un extrait.
@BUILD
Le fil rouge de ce niveau est model/memory.py. Les fonctions sont pures : mêmes textes, même résultat, sans modèle entraîné.
@QUESTION
Quelle différence fais-tu entre la fenêtre et une mémoire externe ?
@CORRECT
La fenêtre est lue par le modèle ; la mémoire externe ne contribue que par les extraits choisis
@WRONG
- La fenêtre est sur disque et la mémoire est le GPU
- Il n'y a aucune différence
- La mémoire externe remplace le tokenizer
@EXPLANATION
Seuls les tokens du contexte entrent dans le réseau. Le reste de l'archive n'existe pour lui que si tu l'as copié.
@@@
@ID 10.2
@TITLE Des vecteurs pour chercher
@TAG Mémoire
@MINUTES 30
@WHY
Chercher un document demande une représentation comparable à la question. Le laboratoire utilise un sac de mots normalisé, pas un embedding entraîné, pour que le score soit un produit scalaire lisible.
@OBJECTIVES
- Construire un vocabulaire
- Compter puis normaliser
- Lire un score comme un cosinus
@PREREQ Contexte et mémoire.
@INTUITION
Tu comptes les mots, tu ignores la casse et la ponctuation, tu ramènes le vecteur à la longueur 1. Deux textes qui emploient les mêmes mots pointent dans la même direction, même si l'un est plus long.
@VOCAB
Sac de mots : un compte par type, sans ordre. Vocabulaire : la liste triée des types vus. Normalisation L2 : division par la norme. Cosinus : le produit de deux vecteurs déjà normés.
@EXPLAIN
tokenize_words garde les lettres, chiffres et accents, en minuscules. bow_vector ignore les mots absents du vocabulaire. Si le texte ne partage rien, le vecteur reste nul et n'est pas divisé par zéro. retrieve construit le vocabulaire sur la question et les documents réunis, puis le score est le produit scalaire des sacs normés, donc un cosinus. L'ordre des mots ne compte pas : « pente de la loss » et « loss de la pente » donnent le même vecteur. C'est une limite assumée, utile pour un test stable, insuffisante pour une recherche réelle. Un embedding entraîné pourrait rapprocher « pente » et « gradient » sans mot commun. Celui du dépôt ne le fait pas, et le test ne le demande pas : il demande que « pente de la loss » retrouve le document qui contient ces mots.
@LANG python
@CODE
:::
import numpy as np
from model.memory import bow_vector
vocab = ["pente", "loss", "tokenizer"]
print(np.round(bow_vector("pente de la loss", vocab), 3))
:::
@EXPERIMENT
« de » et « la » sont hors vocabulaire. « pente » et « loss » valent chacun 1/sqrt(2) après normalisation, « tokenizer » vaut 0.
@EXERCISE
Que renvoie bow_vector si aucun mot n'est dans le vocabulaire ? Un vecteur de zéros, sans division.
@BUILD
Ces vecteurs alimentent retrieve. Ils ne remplacent pas les embeddings du Backbone : ce sont deux représentations, pour deux usages.
@QUESTION
Après normalisation, que vaut le produit scalaire de deux sacs de mots ?
@CORRECT
Leur cosinus, qui vaut 1 s'ils ont les mêmes proportions de mots
@WRONG
- La perplexité du bigramme
- Le nombre de tokens BPE
- La loss MoE
@EXPLANATION
Diviser par la norme enlève l'effet de la longueur. Le produit restant est le cosinus.
@@@
@ID 10.3
@TITLE Retrieval
@TAG Mémoire
@MINUTES 30
@WHY
Le retrieval classe des documents et n'en garde que k. Le détail qui compte est le départage : à score égal, l'indice le plus petit gagne, pour que le résultat ne dépende pas d'un ordre instable.
@OBJECTIVES
- Lire le tri de retrieve
- Comprendre k
- Relier le test au document 0
@PREREQ Vecteurs de recherche.
@INTUITION
Tu poses une question, tu notes chaque fiche, tu gardes les deux meilleures. Si deux fiches sont à égalité, tu prends celle qui était rangée la première, toujours, pour pouvoir rejouer le test.
@VOCAB
Score : le cosinus. k : le nombre de fiches renvoyées. Départage : (-score, index), donc le meilleur score puis le plus petit index. Hit : un dictionnaire avec score, index et text.
@EXPLAIN
retrieve refuse k < 1. Le vocabulaire est reconstruit à chaque appel, donc il dépend des documents présents : ajouter une fiche peut créer des colonnes, mais les mots hors fiche restent à zéro et le cosinus des autres ne change que si la norme change. Le test donne trois documents et la requête « pente de la loss ». Seul le premier contient ces mots, donc il gagne, et hits[0]["index"] vaut 0. Le tri secondaire par index évite qu'un futur changement de version de Python ne mélange des égalités. Ce retrieval ne fait pas de recherche approchée, pas de segmentation, pas de score BM25. Il est exact sur de toutes petites listes, et c'est tout ce que le cours prétend.
@LANG python
@CODE
:::
from model.memory import retrieve
docs = [
    "le gradient indique la pente de la loss",
    "le tokenizer decoupe le texte",
    "la vram stocke les activations du gpu",
]
print(retrieve("pente de la loss", docs, k=1)[0]["index"])
:::
@EXPERIMENT
L'indice affiché est 0. Avec k=2 tu obtiens une seconde fiche, de score plus faible, sans changer la première.
@EXERCISE
Deux documents ont le même score. Lequel est devant ? Celui dont l'index est le plus petit.
@BUILD
retrieve est la pièce que build_context appelle. Le fil rouge ne stocke pas d'index sur disque : la liste de chaînes est la base.
@QUESTION
Dans le test, pourquoi la requête « pente de la loss » renvoie-t-elle l'index 0 ?
@CORRECT
Parce que ce document est le seul à partager ces mots, donc le seul cosinus élevé
@WRONG
- Parce que l'index 0 gagne toujours, même à score nul
- Parce qu'un embedding entraîné rapproche gradient et pente
- Parce que le routeur MoE choisit le premier expert
@EXPLANATION
Le score est un sac de mots. Le document 0 contient « pente » et « loss ». Les autres non. L'index ne départage qu'en cas d'égalité.
@@@
@ID 10.4
@TITLE Une mémoire externe
@TAG Mémoire
@MINUTES 30
@WHY
La mémoire devient utile quand on peut la montrer, la citer, et l'éteindre. build_context fabrique un texte qui sépare la question des extraits numérotés, pour que tu voies ce qui a été injecté.
@OBJECTIVES
- Lire le format de build_context
- Éteindre la mémoire en retirant les documents
- Citer l'index plutôt qu'un passage inventé
@PREREQ Retrieval.
@INTUITION
Le prompt final dit d'où vient chaque phrase. Si le modèle répond, tu peux vérifier que la phrase était dans l'extrait, au lieu de croire une paraphrase sortie de nulle part.
@VOCAB
Contexte construit : la chaîne renvoyée par build_context. Extrait : une ligne [index] texte. Mémoire éteinte : aucun document, donc aucun extrait. Injection : le fait de coller l'extrait dans le prompt, pas dans les poids.
@EXPLAIN
build_context appelle retrieve puis écrit « Question : … » et « Extraits : » suivis des lignes. Le test test_patches_and_retrieval vérifie que le mot « Question » est présent pour la requête « tokenizer ». L'index entre crochets est celui de la liste d'origine, pas un nouveau numéro. Tu peux donc relire la source. Rien n'est écrit dans les poids du modèle : retirer le document retire la connaissance, ce qui est le critère d'une mémoire externe. Un fait appris dans les poids, lui, survivrait à une liste vide. Le laboratoire ne branche pas ce contexte sur TinyGPT. Il s'arrête au texte, parce que la suite — faire prédire un modèle dessus — demanderait un entraînement et une mesure d'usage des extraits, qui n'existent pas encore.
@LANG python
@CODE
:::
from model.memory import build_context
docs = ["le tokenizer decoupe le texte", "la vram stocke les activations"]
print(build_context("tokenizer", docs, k=1))
:::
@EXPERIMENT
Tu vois la question, puis [0] et le document du tokenizer. Passe docs=[] : plus aucun extrait, la question reste.
@EXERCISE
Pourquoi numéroter par l'index d'origine ? Pour pouvoir retrouver la source même si k filtre la liste.
@BUILD
La brique « Mémoire externe » du site s'allume ici. Elle désigne build_context, désactivable, pas un serveur de recherche.
@QUESTION
Comment éteins-tu la mémoire de ce laboratoire ?
@CORRECT
En lui passant une liste de documents vide, ce qui enlève les extraits
@WRONG
- En mettant k à -1
- En supprimant le tokenizer
- En entraînant le bigramme plus longtemps
@EXPLANATION
Sans documents, retrieve n'a rien à classer. Le prompt garde la question et perd les extraits. k négatif est refusé avant cela.
@@@
@ID 10.5
@TITLE Une récurrence de raisonnement
@TAG Mémoire
@MINUTES 30
@WHY
Certains problèmes se résolvent en plusieurs passes : écrire un brouillon, le relire, corriger. C'est une récurrence sur des pensées, pas sur les tokens du texte source. Le dépôt ne la code pas ; il donne le vocabulaire pour ne pas la confondre avec le scan.
@OBJECTIVES
- Distinguer pas de token et pas de réflexion
- Voir le coût de plusieurs passes
- Refuser d'inventer une boucle cachée
@PREREQ Mémoire externe et état SSM.
@INTUITION
Relire ta copie est un deuxième temps de calcul, même si la question n'a pas changé. Le modèle qui ne fait qu'une passe n'a pas ce deuxième temps, sauf si tu le relances toi-même avec son brouillon dans le contexte.
@VOCAB
Passe : un forward complet. Brouillon : des tokens produits puis réinjectés. Récurrence de raisonnement : enchaîner des passes. Scan : la récurrence interne du SSM, qui n'est pas une relecture consciente.
@EXPLAIN
Le SSM met à jour un état à chaque token, à l'intérieur d'un seul forward. Une boucle de raisonnement relance le modèle, ou un module, avec une nouvelle entrée construite à partir de la sortie précédente. build_context peut servir de première moitié : tu ajoutes un extrait, tu obtiens une réponse, tu pourrais la reposer comme question. Le code s'arrête avant cette boucle, parce qu'une boucle non bornée n'a pas de coût lisible. Si tu en ajoutes une, fixe un nombre de passes, mesure la qualité et le temps, et prévois l'arrêt. Ne dis pas que Backbone « réfléchit en plusieurs étapes » : son forward est une passe, testée comme telle.
@LANG python
@CODE
:::
question = "que vaut 2+2 ?"
brouillon = "calcul : 2+2 = 4"
passe_2 = question + "\n" + brouillon
print("passes", 2, "caracteres", len(passe_2))
:::
@EXPERIMENT
La deuxième passe voit un contexte plus long. Ce script ne appelle aucun modèle : il montre seulement que le brouillon réintègre le texte.
@EXERCISE
En quoi cette boucle diffère-t-elle de selective_scan ? Le scan avance d'un token dans un seul forward ; la boucle relance une lecture entière.
@BUILD
Le fil rouge ne gagne pas de boucle de raisonnement. La leçon fixe la frontière pour le jour où tu en mesureras une.
@QUESTION
Une récurrence de raisonnement, dans ce cours, désigne…
@CORRECT
Plusieurs passes dont l'entrée suivante contient un brouillon, pas le scan interne du SSM
@WRONG
- Le produit QK dans une couche
- Le lissage du bigramme
- La découpe en patches
@EXPLANATION
Le scan est intérieur à un forward. La boucle de raisonnement empile des forwards, et elle n'est pas implémentée.
@@@
@ID 10.6
@TITLE La profondeur adaptative
@TAG Mémoire
@MINUTES 25
@WHY
Toutes les questions ne méritent pas le même nombre de couches. La profondeur adaptative s'arrête tôt quand la réponse est facile, et continue quand elle ne l'est pas. C'est un levier de coût, à ne pas confondre avec un résultat déjà mesuré.
@OBJECTIVES
- Relier profondeur et FLOPs
- Imaginer un critère d'arrêt
- Constater que Backbone a une profondeur fixe
@PREREQ Récurrence de raisonnement et FLOPs.
@INTUITION
Tu ne relis pas dix fois une addition. Tu relis dix fois une preuve. Un modèle à profondeur fixe fait le même travail dans les deux cas.
@VOCAB
Profondeur : n_layers. Adaptatif : le nombre de couches dépend de l'entrée. Critère d'arrêt : une règle qui décide de sortir plus tôt. Budget : le coût maximal accepté.
@EXPLAIN
Backbone.__init__ fixe n_layers et forward les parcourt toutes. Il n'y a pas de sortie anticipée, et le test utilise 2 couches pour les trois kinds. Une profondeur adaptative publierait un score de confiance par couche et un seuil. Sans ce score, s'arrêter plus tôt est une coupe arbitraire : tu économises des FLOPs et tu ne sais pas si la qualité tombe. Le niveau 12 te demandera de mesurer avant de garder une telle coupe. En attendant, tu peux calculer le coût d'une couche d'attention avec attention_flops et le multiplier par le nombre de couches réellement exécutées. Le dire dans un tableau vaut mieux que d'annoncer un modèle « qui réfléchit à la bonne profondeur » sans colonne de qualité.
@LANG python
@CODE
:::
from model.bench import attention_flops
une = attention_flops(128, 64, n_layers=1)
print(une, une * 2)
:::
@EXPERIMENT
Deux couches coûtent le double, dans cette formule qui ignore le FFN. C'est un ordre de grandeur, pas une facture.
@EXERCISE
Pourquoi le laboratoire ne s'arrête-t-il pas au milieu de forward ? Parce qu'aucun critère d'arrêt n'est défini ni testé.
@BUILD
Le fil rouge garde une profondeur fixe. L'adaptatif reste une hypothèse pour l'étape 12.1, pas une option de Backbone.
@QUESTION
Que fait Backbone quand une entrée est « facile » ?
@CORRECT
Il exécute quand même les n_layers couches prévues
@WRONG
- Il saute le SSM
- Il réduit tout seul n_layers
- Il vide la mémoire externe
@EXPLANATION
n_layers est un argument de construction. Rien dans forward ne regarde une confiance.
@@@
@ID 10.7
@TITLE Outils et agents
@TAG Mémoire
@MINUTES 30
@WHY
Un outil est une fonction que le modèle n'exécute pas dans ses poids : une calculatrice, une recherche, un test. Un agent est une boucle qui décide d'appeler ces fonctions. Sans trace des appels, tu ne peux pas juger la réponse.
@OBJECTIVES
- Séparer le modèle et l'outil
- Exiger une trace
- Relier l'outil retrieval à retrieve
@PREREQ Mémoire externe.
@INTUITION
Demander l'heure à quelqu'un qui n'a pas de montre le pousse à inventer. Lui passer la montre, et noter qu'il l'a regardée, change la question. L'outil est la montre. La trace est le fait d'avoir regardé.
@VOCAB
Outil : une fonction hors des poids, avec des entrées et des sorties. Agent : la boucle qui choisit un outil. Trace : l'historique des appels. Hallucination d'outil : prétendre un résultat qui n'est pas dans la sortie de la fonction.
@EXPLAIN
retrieve est déjà un outil : une question et des documents entrent, des extraits sortent, le résultat est déterministe et testé. Un agent autour serait une boucle qui décide d'appeler retrieve ou de répondre directement. Cette boucle n'est pas écrite. Si tu la décris dans le portfolio, montre la trace : quel appel, quels arguments, quel retour. Une phrase finale sans cette trace ne prouve pas que la mémoire a servi. Le même standard vaut pour une calculatrice. Le modèle peut écrire « 2+2 = 5 » ; l'outil, lui, renvoie 4. La réponse honnête cite l'outil. Le cours n'évalue pas un agent, parce qu'il n'y en a pas. Il évalue ta capacité à ne pas en inventer un dans le README.
@LANG python
@CODE
:::
from model.memory import retrieve
trace = []
docs = ["le tokenizer decoupe le texte"]
trace.append(retrieve("tokenizer", docs, k=1))
print(trace[0][0]["index"])
:::
@EXPERIMENT
La trace contient le hit d'index 0. Sans cette liste, tu n'aurais que ta mémoire de ce que la fonction « a dû » répondre.
@EXERCISE
Quelle est la différence entre un outil et une couche du réseau ? L'outil s'exécute hors des poids et peut être relu ; la couche est un produit de matrices.
@BUILD
Le seul outil du fil rouge est la recherche de model/memory.py. Pas de boucle d'agent, pas d'appel réseau.
@QUESTION
Que manque-t-il au dépôt pour parler d'un agent ?
@CORRECT
Une boucle qui choisit des outils et une trace d'appels testée
@WRONG
- Un tokenizer
- Un patch de 2 pixels
- Une licence MIT
@EXPLANATION
retrieve est un outil isolé. L'agent serait la politique qui l'appelle, et elle n'existe pas ici.
@@@
@ID 10.8
@TITLE Évaluer le raisonnement
@TAG Mémoire
@MINUTES 30
@WHY
Une réponse juste ne prouve pas un raisonnement. Elle peut être copiée du contexte, mémorisée dans les poids, ou tombée juste par chance. Évaluer, c'est séparer ces cas.
@OBJECTIVES
- Distinguer exactitude et usage des extraits
- Proposer un contrôle mémoire éteinte
- Préparer les métriques du niveau 12
@PREREQ Outils, mémoire, passes.
@INTUITION
Si la réponse reste juste quand tu retires l'extrait, l'extrait n'était pas la source. Si elle tombe quand tu le retires, tu as un indice qu'elle s'en servait. Un seul exemple ne suffit pas, mais zéro contrôle ne dit rien.
@VOCAB
Exactitude : la réponse coincide avec la référence. Contrôle d'ablation : même question sans l'extrait. Usage : la différence entre les deux. Hasard : une bonne réponse isolée, sans série.
@EXPLAIN
Le laboratoire te donne le moyen du contrôle : build_context avec et sans documents. Il ne te donne pas un corpus de questions ni un modèle qui répond. Tu ne publies donc pas un score de raisonnement. Tu publies un protocole. Par exemple : vingt questions dont la réponse est dans un seul document, mesure du taux de citation de l'index, puis la même mesure mémoire éteinte. Si les deux taux sont égaux, la mémoire n'a rien apporté. Si le taux chute, elle servait peut-être. « Peut-être », parce qu'un modèle peut aussi s'effondrer dès que le prompt change de forme. Le niveau 12 transformera ce doute en colonnes : qualité, temps, RAM, et la condition exacte de l'expérience. Jusque-là, la phrase interdite est « le modèle raisonne », sans protocole.
@LANG python
@CODE
:::
from model.memory import build_context
docs = ["la capitale citée ici est Dakar"]
avec = build_context("capitale", docs, k=1)
sans = build_context("capitale", [], k=1)
print("extrait" in avec.lower(), "Extrait" in sans)
:::
@EXPERIMENT
Le premier prompt contient le document, le second n'a pas de ligne d'extrait. C'est le contrôle, pas encore une mesure de réponse.
@EXERCISE
Pourquoi une seule question réussie ne suffit-elle pas ? Parce que tu ne sépares pas la chance, la mémorisation et l'usage de l'extrait.
@BUILD
Le projet du niveau est cette mémoire mesurable et éteignable. L'évaluation chiffrée du raisonnement reste à faire, avec le protocole du niveau 12.
@QUESTION
Quel contrôle montre qu'une mémoire externe a pu servir ?
@CORRECT
La même question avec extraits, puis sans extraits, et une différence de résultats
@WRONG
- Une seule bonne réponse
- Un forward plus profond
- Un thème sombre dans l'interface
@EXPLANATION
Sans la condition « mémoire éteinte », tu ne sais pas si l'extrait était nécessaire. Une réussite isolée ne sépare pas les causes.
