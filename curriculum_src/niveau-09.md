@@@
@ID 9.1
@TITLE Les modalités
@TAG Multimodal
@MINUTES 25
@WHY
Jusqu'ici le modèle ne mange que des identifiants de texte. Une modalité est une autre façon de mesurer le monde : image, son, vidéo. Le niveau 9 n'ajoute pas une magie, il ajoute une conversion vers des vecteurs de la même largeur.
@OBJECTIVES
- Nommer texte, image, audio, vidéo
- Voir qu'un modèle ne voit que des tableaux
- Refuser l'idée qu'une modalité « comprend » toute seule
@PREREQ Embeddings et forme (B, T, D).
@INTUITION
Le texte arrive déjà découpé en tokens. Une image arrive en pixels. Un son arrive en échantillons. Tant que ces mesures ne sont pas devenues une suite de vecteurs de largeur D, le dos du niveau 8 ne sait pas les lire.
@VOCAB
Modalité : un type de mesure. Échantillon : une valeur dans le temps, pour le son. Pixel : une valeur dans l'espace, pour l'image. Espace commun : la dimension D partagée avec le texte.
@EXPLAIN
Le laboratoire n'a ni micro ni caméra. model/multimodal.py ne sait faire qu'une chose : découper un tableau image et le projeter. Les leçons suivantes décrivent l'audio et la vidéo avec le même vocabulaire, sans inventer un encodeur qui n'est pas dans le dépôt. Un modèle multimodal n'est pas un modèle qui « voit ». C'est un modèle dont une entrée a été convertie en la même sorte d'objets que les autres : des vecteurs, puis souvent des tokens. Si la conversion est mauvaise, le dos a beau être causal et testé, il mélange des nombres sans rapport avec l'image. La première question du niveau est donc toujours : quelle est la forme avant, quelle est la forme après.
@LANG python
@CODE
:::
import numpy as np
image = np.zeros((8, 8))
son = np.zeros(16000)
print("image", image.shape, "son", son.shape)
:::
@EXPERIMENT
Les deux tableaux n'ont pas la même forme ni le même sens d'axe. Aucun des deux n'est encore (T, D).
@EXERCISE
Cite la modalité déjà traitée depuis le niveau 2, et celle que patchify sait découper. Le texte via le tokenizer ; l'image via les patches.
@BUILD
Le fil rouge de ce niveau tient dans deux fonctions, patchify et project_patches. Le reste du niveau dit ce qu'il faudrait ajouter, et ce qui n'a pas été ajouté.
@QUESTION
Avant d'entrer dans le dos, que doivent devenir des pixels ou des échantillons ?
@CORRECT
Une suite de vecteurs de largeur compatible avec le modèle
@WRONG
- Une loss
- Un masque causal
- Un fichier README
@EXPLANATION
Le dos consomme des vecteurs. La modalité d'origine doit être convertie, pas branchée comme un fichier brut.
@@@
@ID 9.2
@TITLE Pixels et patches
@TAG Multimodal
@MINUTES 30
@WHY
Un pixel seul est pauvre, et une image entière est trop grosse pour un token. Le geste utile est le patch : un carré de pixels aplati, traité comme un token visuel.
@OBJECTIVES
- Découper une image sans recouvrement
- Lire l'ordre de patchify
- Vérifier le premier patch sur l'exemple du test
@PREREQ Modalités.
@INTUITION
Tu quadrilles une photo en timbres. Chaque timbre devient une ligne de nombres. L'ordre de lecture est celui des lignes du quadrillage, de gauche à droite puis de haut en bas.
@VOCAB
Patch : bloc p par p, non recouvrant. Grille : (H/p) par (W/p) patches. Aplatissement : une ligne de longueur p*p*C. C : nombre de canaux, 1 si l'image est (H, W).
@EXPLAIN
patchify accepte (H, W) ou (H, W, C). Une image à deux axes reçoit un canal fictif. H et W doivent être divisibles par p, sinon ValueError : le cours refuse un reste silencieux. Le test construit np.arange(16).reshape(4, 4) et un patch de 2. Le premier bloc, en haut à gauche, contient les valeurs 0, 1 sur la première ligne et 4, 5 sur la deuxième, donc [0, 1, 4, 5] après aplatissement. La forme est (4, 4) : quatre patches, quatre nombres chacun. L'ordre n'est pas un parcours ligne par ligne de toute l'image. 0, 1, 2, 3 serait faux, parce que 2 et 3 sont le patch voisin, pas la suite du premier carré.
@LANG python
@CODE
:::
import numpy as np
from model.multimodal import patchify
image = np.arange(16, dtype=np.float64).reshape(4, 4)
patches = patchify(image, 2)
print(patches.shape, patches[0].tolist())
:::
@EXPERIMENT
Tu dois obtenir (4, 4) et [0, 1, 4, 5]. Essaie un patch de 3 sur cette image : H n'est pas divisible par 3, la fonction doit lever une erreur.
@EXERCISE
Pour une image 8 par 8 à 3 canaux et un patch de 4, combien de patches, et quelle longueur de vecteur ? 4 patches, longueur 4*4*3 = 48.
@BUILD
La brique « Patches » du site s'allume à cette étape. Elle désigne patchify, pas un ViT préentraîné.
@QUESTION
Dans le test, pourquoi le premier patch vaut [0, 1, 4, 5] et non [0, 1, 2, 3] ?
@CORRECT
Parce qu'il prend le carré 2 par 2 en haut à gauche, pas la première ligne
@WRONG
- Parce que le modèle est déjà entraîné
- Parce que les canaux sont en couleur
- Parce que le scan SSM a réordonné les pixels
@EXPLANATION
arange remplit la ligne 0 avec 0,1,2,3 et la ligne 1 avec 4,5,6,7. Le carré gauche garde 0, 1, 4, 5.
@@@
@ID 9.3
@TITLE Un encodeur visuel, en idée
@TAG Multimodal
@MINUTES 30
@WHY
Découper ne suffit pas. Un encodeur visuel transforme les patches en vecteurs de largeur D, puis peut les mélanger entre eux. Le dépôt ne code que la projection linéaire, et le dit.
@OBJECTIVES
- Enchaîner patch et projection
- Distinguer projection et Transformer visuel
- Lire la forme (nombre de patches, D)
@PREREQ Patches.
@INTUITION
Chaque timbre est encore une liste de pixels. Une matrice le traduit dans la langue de largeur D du texte. Un vrai encodeur ajouterait ensuite des couches pour que les timbres se parlent. Cette deuxième étape n'est pas dans model/multimodal.py.
@VOCAB
Projection : patches @ poids + biais. Encodeur : la pile qui produit les vecteurs visuels. ViT : l'idée d'un Transformer sur des patches, citée comme référence, pas comme code. D : d_model, la largeur commune.
@EXPLAIN
project_patches multiplie un tableau (N, P) par un poids (P, D) et ajoute un biais (D,). Le test prend les quatre patches de longueur 4, un poids de uns (4, 2) et un biais nul : la sortie a la forme (4, 2). Chaque coordonnée est la somme des quatre pixels du patch, puisque tous les poids valent 1. Un encodeur publié empile ensuite attention et FFN sur cette séquence de patches, avec une position pour savoir où était le timbre. Le laboratoire s'arrête avant cet empilement. Tu peux brancher la sortie sur le dos du niveau 8 seulement après avoir choisi comment représenter la position des patches. Ne dis pas que le dépôt « contient un ViT » : il contient le découpage et une couche linéaire.
@LANG python
@CODE
:::
import numpy as np
from model.multimodal import patchify, project_patches
patches = patchify(np.arange(16.0).reshape(4, 4), 2)
vecteurs = project_patches(patches, np.ones((4, 2)), np.zeros(2))
print(vecteurs.shape, vecteurs[0].tolist())
:::
@EXPERIMENT
La forme est (4, 2). Le premier vecteur vaut [0+1+4+5, 0+1+4+5] = [10, 10].
@EXERCISE
Quelle forme de poids faut-il pour projeter des patches de longueur 48 vers D=16 ? (48, 16), plus un biais (16,).
@BUILD
Le fil rouge s'arrête à project_patches. Les leçons d'audio et de vidéo décrivent le même schéma sans ajouter de fichier.
@QUESTION
Que fait project_patches, et que ne fait-il pas ?
@CORRECT
Une couche linéaire vers D, pas un Transformer visuel complet
@WRONG
- Un tokenizer BPE sur les pixels
- Un scan sélectif
- La loss de l'étape 1
@EXPLANATION
La fonction est un produit matriciel et un biais. L'attention entre patches n'est pas dans ce module.
@@@
@ID 9.4
@TITLE Spectrogramme et audio
@TAG Multimodal
@MINUTES 25
@WHY
Un son brut est une longue suite d'échantillons. Les modèles le résument souvent en spectrogramme : pour de courtes fenêtres, l'énergie par fréquence. Cette leçon fixe le vocabulaire, sans prétendre coder l'audio.
@OBJECTIVES
- Passer des échantillons à des fenêtres
- Lire un spectrogramme comme une image temps-fréquence
- Constater l'absence de code audio dans le dépôt
@PREREQ Patches et modalités.
@INTUITION
Une seconde de voix à 16 000 échantillons est trop fine. Tu la découpes en tranches de quelques millisecondes et tu notes, pour chaque tranche, quelles graves et quelles aiguës sont présentes. Le tableau ressemble à une image.
@VOCAB
Échantillon : amplitude à un instant. Fréquence d'échantillonnage : nombre d'échantillons par seconde. Spectrogramme : énergie par temps et par bande de fréquence. Fenêtre : la tranche sur laquelle on mesure.
@EXPLAIN
Ce dépôt n'importe pas de bibliothèque audio et n'a pas de fonction spectrogramme. Le décrire quand même est utile, parce que la suite du niveau réutilise le geste des patches : un spectrogramme est un tableau à deux axes, qu'on peut découper ou projeter. Une fenêtre trop longue mélange deux syllabes. Une fenêtre trop courte ne voit pas la hauteur. Ce compromis ressemble au choix de p dans patchify : trop petit, la séquence explose ; trop grand, le détail interne disparaît. Aucun test ne couvre l'audio. Si tu ajoutes un jour un spectrogramme, il faudra un test de forme, comme pour les patches, avant tout discours sur la qualité.
@LANG python
@CODE
:::
echantillons = 16000
fenetre = 400
saut = 160
cadres = 1 + (echantillons - fenetre) // saut
print("cadres", cadres)
:::
@EXPERIMENT
Tu obtiens 98 cadres pour une seconde à 16 kHz, fenêtre 400, saut 160. Ce n'est pas une fonction du dépôt, seulement un décompte.
@EXERCISE
Pourquoi un spectrogramme se traite-t-il ensuite comme une image ? Parce qu'il est déjà un tableau à deux axes, temps et fréquence.
@BUILD
Le fil rouge ne gagne pas de fichier audio. Le contrat du niveau reste patchify, testé, et le reste est nommé comme idée.
@QUESTION
Où est calculé le spectrogramme dans ce dépôt ?
@CORRECT
Nulle part : la leçon décrit l'idée, le code ne l'implémente pas
@WRONG
- Dans model/multimodal.py, fonction spectrogram
- Dans le tokenizer caractère
- Dans selective_scan
@EXPLANATION
multimodal.py expose patchify et project_patches. Aucun test audio n'existe, et c'est assumé.
@@@
@ID 9.5
@TITLE Encodeur audio, en idée
@TAG Multimodal
@MINUTES 25
@WHY
Comme pour l'image, un encodeur audio projette des cadres vers D. Les articles parlent de tokenizer audio ou d'encodeur de parole. Ici tu apprends à lire ces mots sans confondre avec le code du dépôt.
@OBJECTIVES
- Réutiliser le schéma projection vers D
- Distinguer codec neuronal et simple spectrogramme
- Garder la frontière entre idée et implémentation
@PREREQ Spectrogramme.
@INTUITION
Un codec neuronal apprend un petit alphabet de sons, comme le BPE apprend un alphabet de bouts de mots. Un spectrogramme, lui, ne décide pas d'un alphabet : il mesure. Les deux peuvent précéder un même dos.
@VOCAB
Cadre : une colonne du spectrogramme. Encodeur audio : la fonction qui sort des vecteurs ou des codes. Codec : un alphabet appris de sons. Aucune de ces fonctions n'est dans model/.
@EXPLAIN
Le parallèle avec le niveau 2 est le bon réflexe. Le tokenizer texte est réel, testé, réversible pour les caractères. Un tokenizer audio publié n'est pas dans le dépôt, donc tu ne dois pas citer un taux de compression ni un score de reconnaissance. Ce que tu peux dire : si un jour des cadres de taille F sont projetés par une matrice (F, D), la suite a la forme (nombre de cadres, D), analogue à (nombre de patches, D). Le dos hybride pourrait alors les lire, à condition de fixer un masque causal si la tâche est de prédire la suite, ou un autre masque si la tâche est de décrire un son déjà entier. Le choix du masque dépend de la tâche, pas de la modalité.
@LANG python
@CODE
:::
import numpy as np
cadres = np.zeros((98, 40))
poids = np.zeros((40, 16))
print((cadres @ poids).shape)
:::
@EXPERIMENT
La forme (98, 16) est celle d'une projection, pas d'un encodeur entraîné. Les zéros rappellent que rien n'a été appris.
@EXERCISE
Quelle différence fais-tu entre ce produit matriciel et un codec publié ? Le produit est une forme ; le codec est un modèle entraîné, absent d'ici.
@BUILD
Rien ne s'ajoute au fil rouge. La leçon sert à ne pas sur-vendre model/multimodal.py dans le README.
@QUESTION
Un encodeur audio de ce cours, aujourd'hui, c'est…
@CORRECT
Un schéma de projection décrit, sans module ni test
@WRONG
- Une fonction testée de model/multimodal.py
- Le bigramme appliqué aux lettres
- Le routeur MoE
@EXPLANATION
Le seul code multimodal testé est le découpage d'image et sa projection. L'audio reste une analogie de forme.
@@@
@ID 9.6
@TITLE La vidéo, espace et temps
@TAG Multimodal
@MINUTES 25
@WHY
Une vidéo est une pile d'images. On peut la découper dans l'espace comme une photo, et dans le temps comme un son. Le coût explose si tu traites chaque pixel de chaque image comme un token.
@OBJECTIVES
- Compter les tokens d'une vidéo naïve
- Introduire un tube espace-temps
- Relier ce volume au niveau 6
@PREREQ Patches.
@INTUITION
Vingt images de 64 par 64, en patches de 16, font déjà beaucoup de timbres. Si tu regardes en plus le temps, chaque timbre devient un petit cube. Le cube est le patch vidéo.
@VOCAB
Frame : une image de la vidéo. Tube : un patch qui s'étend sur plusieurs frames. T_visuel : le nombre de tubes, qui joue le rôle de T. Coût : le terme en T au carré de l'attention si tu mélanges tous les tubes.
@EXPLAIN
Le dépôt ne lit pas de vidéo. Le calcul, lui, est faisable à la main et il justifie le niveau 6. Une frame 64×64 en patches 16×16 donne 16 patches. Vingt frames donnent 320 patches si tu ne regroupes pas le temps. Une attention dessus coûte le terme 4*T*T*d du niveau 6, avec T=320, pour chaque couche. Un tube de 4 frames réduit T d'un facteur 4, et perd le détail temporel à l'intérieur du tube, comme un patch perd le détail à l'intérieur du carré. C'est le même compromis que p dans patchify. Sans fichier vidéo, le fil rouge ne teste pas ce calcul. Tu dois quand même savoir le poser avant d'annoncer un modèle vidéo.
@LANG python
@CODE
:::
frames, cote, patch, temps_par_tube = 20, 64, 16, 4
patches_par_frame = (cote // patch) ** 2
tubes = frames // temps_par_tube * patches_par_frame
print(patches_par_frame, tubes)
:::
@EXPERIMENT
16 patches par frame, 80 tubes si tu regroupes 4 frames. Sans regroupement, T serait 320.
@EXERCISE
Que perds-tu en passant de 320 patches à 80 tubes ? La capacité de distinguer deux instants à l'intérieur d'un tube.
@BUILD
Aucun module vidéo n'entre dans le fil rouge. L'étape sert à dimensionner avant de coder, avec attention_flops.
@QUESTION
Pourquoi ne pas créer un token par pixel et par frame ?
@CORRECT
Parce que T explose et le coût d'attention quadratique avec lui
@WRONG
- Parce que les pixels ne sont pas des nombres
- Parce que le masque causal l'interdit
- Parce que NumPy ne sait pas multiplier
@EXPLANATION
Le patch et le tube existent pour réduire T. Le niveau 6 a déjà montré que le terme T*T devient le coût dominant.
@@@
@ID 9.7
@TITLE Projeter vers un espace commun
@TAG Multimodal
@MINUTES 30
@WHY
Deux modalités ne se parlent que si leurs vecteurs ont la même largeur et un sens comparable. La projection commune est ce contrat. Sans elle, concaténer un patch et un token est une erreur de forme, ou pire une erreur de sens.
@OBJECTIVES
- Aligner les largeurs sur D
- Voir que la même largeur n'est pas le même sens
- Utiliser project_patches comme cas réel
@PREREQ Encodeur visuel en idée.
@INTUITION
Traduire deux langues dans une troisième demande un dictionnaire par langue. Avoir le même nombre de lettres ne suffit pas. D est le nombre de lettres ; l'entraînement du dictionnaire est autre chose, et il n'est pas fait ici.
@VOCAB
Espace commun : R^D. Projection modale : la matrice propre au texte, à l'image ou au son. Alignement : le fait que des vecteurs proches veuillent dire des choses liées. Non entraîné : le cas du test, où les poids sont des uns.
@EXPLAIN
Les embeddings de tokens du Backbone ont déjà la forme (vocab, D). project_patches produit (N, D) si le poids a D colonnes. Les deux peuvent être concaténés sur l'axe du temps seulement si D coïncide. Le test choisit D=2 pour les patches et ne les envoie pas dans un Backbone : il vérifie la forme, pas un alignement sémantique. Des poids de uns somment les pixels, ils ne rapprochent pas l'image du mot « chat ». Un espace commun digne de ce nom demande une perte d'entraînement, par exemple prédire le texte qui commente l'image, ou une perte de contraste. Le dépôt n'en a pas. Tu peux donc affirmer la compatibilité de forme, et tu dois refuser d'affirmer qu'un patch et un mot se ressemblent.
@LANG python
@CODE
:::
import numpy as np
from model.multimodal import patchify, project_patches
patches = patchify(np.arange(16.0).reshape(4, 4), 2)
poids = np.zeros((4, 8))
biais = np.zeros(8)
print(project_patches(patches, poids, biais).shape)
:::
@EXPERIMENT
La forme (4, 8) a la largeur d'un petit d_model. Les vecteurs sont nuls : la largeur est bonne, le sens est vide.
@EXERCISE
Peut-on concaténer ces 4 vecteurs avec des embeddings de largeur 16 ? Non, D diffère. Il faudrait une projection vers 16.
@BUILD
Le fil rouge montre la compatibilité de forme via project_patches. L'alignement sémantique est nommé comme travail futur, pas comme résultat.
@QUESTION
Deux suites de vecteurs de même largeur D sont-elles pour autant alignées ?
@CORRECT
Non : la largeur permet de les concaténer, le sens demande un entraînement que le dépôt ne fait pas
@WRONG
- Oui, dès que les formes matchent
- Oui, grâce au bigramme
- Non, parce que NumPy interdit la concaténation
@EXPLANATION
La concaténation sur le temps exige le même D. La proximité de sens exige une perte et des données, absentes ici.
@@@
@ID 9.8
@TITLE Fusionner les modalités
@TAG Multimodal
@MINUTES 30
@WHY
Une fois les vecteurs dans le même D, encore faut-il décider comment ils se mélangent : concaténation, attention croisée, ou addition. Le choix change ce que le modèle peut ignorer.
@OBJECTIVES
- Comparer trois fusions simples
- Relier la fusion au masque
- Rester honnête sur ce qui est codé
@PREREQ Espace commun.
@INTUITION
Poser le texte puis l'image dans la même file, c'est une concaténation. Laisser le texte interroger l'image sans se mélanger à elle, c'est une attention croisée. Additionner deux vecteurs de même place, c'est supposer qu'ils décrivent le même instant.
@VOCAB
Concaténation : empiler sur l'axe T. Attention croisée : Q d'une modalité, K et V de l'autre. Fusion tardive : deux têtes séparées, combinées à la fin. Aucune de ces trois n'est une fonction de model/multimodal.py.
@EXPLAIN
Le dépôt s'arrête avant la fusion. Tu peux quand même raisonner avec les briques déjà testées. Une concaténation de tokens texte et de patches donne une seule séquence, et l'attention causale du dos ne laisse chaque position regarder que le passé : l'ordre texte-puis-image ou image-puis-texte change qui voit qui. Une attention croisée n'est pas dans Backbone ; scaled_dot_product_attention sait calculer des scores, mais le dos ne l'appelle qu'en causal sur une seule suite. Additionner patch et token n'a de sens que si tu as déjà apparié un patch à un token, ce qui n'est pas le cas général. Le bon réflexe de portfolio est d'écrire la forme avant et après la fusion, puis de dire quelle brique existe. Ici, avant : (N, D) et (T, D). Après concaténation : (N+T, D). Le code de cette concaténation n'est pas fourni, et ce n'est pas un oubli caché.
@LANG python
@CODE
:::
import numpy as np
texte = np.zeros((5, 8))
image = np.zeros((4, 8))
fusion = np.concatenate([texte, image], axis=0)
print(fusion.shape)
:::
@EXPERIMENT
La forme (9, 8) est une concaténation. Elle ne crée pas d'attention croisée et ne teste rien du dépôt.
@EXERCISE
Si le texte est placé après l'image dans une attention causale, une position texte peut-elle lire les patches ? Oui, parce qu'ils sont dans son passé. L'inverse est faux.
@BUILD
Le fil rouge ne gagne pas de fonction fuse. La leçon empêche de confondre un concatenate de démonstration avec un modèle multimodal entraîné.
@QUESTION
Dans une concaténation causale image puis texte, qui peut lire l'autre ?
@CORRECT
Le texte peut lire l'image passée ; l'image ne peut pas lire le texte futur
@WRONG
- Les deux se lisent dans les deux sens
- Personne ne lit personne
- Seul le routeur MoE décide
@EXPLANATION
Le masque causal suit l'ordre de la suite. Placer une modalité avant l'autre lui donne le rôle de contexte.
@@@
@ID 9.9
@TITLE Des sorties multimodales
@TAG Multimodal
@MINUTES 25
@WHY
Entrer une image pour prédire du texte est une tâche. Sortir une image, ou du son, en est une autre : il faut un décodeur, et une loss sur cette modalité. Le dépôt n'a ni l'un ni l'autre.
@OBJECTIVES
- Distinguer entrée multiple et sortie multiple
- Nommer une tête de sortie par modalité
- Fermer le niveau sur ce qui est réellement testé
@PREREQ Fusion.
@INTUITION
Lire une légende sous une photo, c'est sortir du texte. Peindre la photo à partir de la légende, c'est sortir des pixels. Le second problème demande de revenir de D vers des patches, puis vers une image.
@VOCAB
Tête : la couche finale vers un vocabulaire ou vers des pixels. Décodeur visuel : l'inverse approximatif de la projection. Loss multimodale : une perte par sortie, additionnées ou alternées. Absente : toute tête autre que les logits texte déjà vus dans TinyGPT.
@EXPLAIN
TinyGPT produit des logits sur un vocabulaire de tokens. project_patches va des pixels vers D, pas l'inverse. Un décodeur naïf serait une matrice (D, longueur de patch) qui reconstruit le carré, puis un réassemblage. Il n'est pas écrit, et aucune loss d'image n'est testée. Tu peux le proposer comme extension, à condition de dire ce que tu mesurerais : erreur sur les pixels, pas perplexité texte. Mélanger les deux nombres dans une seule colonne « qualité » sans unité rendrait le tableau du niveau 6 illisible. La sortie du niveau 9, pour le portfolio, est plus étroite et plus solide : une image 4×4 devient quatre patches, le premier vaut [0, 1, 4, 5], la projection a la forme annoncée, et le test test_patches_and_retrieval le verrouille.
@LANG python
@CODE
:::
import numpy as np
from model.multimodal import patchify
image = np.arange(16.0).reshape(4, 4)
print(patchify(image, 2)[0].tolist())
:::
@EXPERIMENT
[0, 1, 4, 5] est le résultat de référence. Si tu changes l'ordre des transpose dans une copie de la fonction, ce test doit échouer.
@EXERCISE
Quelle métrique utiliserais-tu pour une sortie image, et pourquoi pas la perplexité ? Une erreur sur les pixels ou les patches, parce que la perplexité suppose un vocabulaire discret de tokens.
@BUILD
Le projet du niveau est livré : découpage et projection, testés. Les sorties image, audio et vidéo restent des prolongements décrits, pas des modules.
@QUESTION
Quelle sortie multimodale est réellement implémentée et testée ?
@CORRECT
Aucune : le module couvre l'entrée image jusqu'à la projection, pas une image reconstruite
@WRONG
- Un décodeur audio testé par pytest
- Une vidéo générée dans model/__main__.py
- Une tête qui peint des pixels dans TinyGPT
@EXPLANATION
Le test fixe patchify et project_patches. Revenir vers des pixels n'est pas dans le dépôt.
