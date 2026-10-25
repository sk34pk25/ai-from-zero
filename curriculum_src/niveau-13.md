@@@
@ID 13.1
@TITLE Fusionner les paires
@TAG BPE
@MINUTES 35
@VISUAL bpe
@WHY
Le tokenizer caractère donne un identifiant par lettre. C'est clair, et c'est trop long : un mot courant devient une suite de pas. Le BPE recolle les paires fréquentes pour que le modèle voie des morceaux de mots, sans ouvrir une bibliothèque.
@OBJECTIVES
- Compter les paires voisines
- Choisir la paire gagnante sans ambiguïté
- Relire le texte après une fusion
@PREREQ Le tokenizer caractère du niveau 2.
@INTUITION
Tu vois « le » partout. Au lieu de payer deux jetons, l et e, tu colles la paire et tu lui donnes un seul numéro. Tu recommences avec la nouvelle paire la plus fréquente.
@VOCAB
Paire : deux morceaux voisins. Fusion : ces deux morceaux deviennent un seul token. Fréquence : le nombre de fois où la paire apparaît. Égalité : deux paires aussi fréquentes, départagées par l'ordre des caractères.
@EXPLAIN
model/bpe.py commence par les caractères triés. À chaque tour il compte les paires, puis prend le minimum de la clé (moins la fréquence, morceau gauche, morceau droit). La fréquence la plus haute gagne. Si deux paires sont à égalité, la plus petite dans l'ordre du dictionnaire gagne. La fusion avance de gauche à droite et ne réutilise pas un morceau déjà collé dans le même tour. Deux entraînements sur le même texte et le même nombre de fusions produisent le même vocabulaire. C'est le point que le test vérifie.
@LANG python
@CODE
:::
from model.bpe import BPETokenizer
tok = BPETokenizer.train("le chat le chat", 8)
print(tok.decode(tok.encode("le chat")))
:::
@EXPERIMENT
Change le nombre de fusions. Avec zéro, tu retrouves le tokenizer caractère. Avec trop, tu colles des phrases entières qui ne serviront plus sur un texte nouveau.
@EXERCISE
Sur le texte abab, une seule fusion doit coller ab, pas ba, parce que les deux paires n'ont pas la même place dans le départage. Vérifie-le avec train.
@BUILD
Le fil rouge de ce niveau remplace, quand c'est utile, le vocabulaire caractère par ce BPE. Le playground et l'ajustement réutilisent le même encode et le même decode.
@QUESTION
Comment le BPE du laboratoire départage-t-il deux paires de même fréquence ?
@CORRECT
Il garde la paire la plus petite dans l'ordre des morceaux
@WRONG
- Il tire au hasard une des deux paires
- Il garde toujours la paire la plus à droite
- Il refuse d'entraîner tant que les fréquences diffèrent
@EXPLANATION
La clé est la fréquence décroissante, puis le morceau gauche, puis le morceau droit. Rien n'est tiré au sort.
@@@
@ID 13.2
@TITLE Garder le vocabulaire
@TAG BPE
@MINUTES 25
@VISUAL bpe
@WHY
Un vocabulaire qui change entre l'entraînement et l'échantillonnage produit des identifiants faux. Il faut écrire les fusions, les relire, et refuser un caractère jamais vu.
@OBJECTIVES
- Sauver le vocabulaire et les fusions
- Recharger le même encode
- Lire l'erreur sur un caractère inconnu
@PREREQ Une fusion déjà entraînée.
@INTUITION
Le carnet des collages doit voyager avec le modèle. Sans lui, le numéro 40 ne veut plus dire la même chose. Tu le ranges à côté des poids, pas dans ta tête.
@VOCAB
Vocabulaire : le dictionnaire morceau vers identifiant. Fusions : la liste ordonnée des paires apprises. itos : l'identifiant vers le morceau, pour décoder. Caractère inconnu : un signe absent du vocabulaire de départ.
@EXPLAIN
save écrit un JSON avec vocab et merges. load et from_dict reconstruisent le tokenizer sans réapprendre. encode applique les fusions dans l'ordre enregistré, pas dans un ordre recalculé. Si le texte contient un caractère absent, encode lève KeyError au lieu d'inventer un identifiant. decode recolle les morceaux. Le checkpoint du GPT range ce dictionnaire à côté des poids, pour que gpt_sample et le playground parlent du même vocabulaire.
@LANG python
@CODE
:::
from model.bpe import BPETokenizer
tok = BPETokenizer.train("bonjour bonjour", 4)
tok.save("model/data/bpe.json")
autre = BPETokenizer.load("model/data/bpe.json")
print(autre.encode("bonjour") == tok.encode("bonjour"))
:::
@EXPERIMENT
Ajoute un caractère absent, par exemple un emoji, et regarde l'erreur. Le laboratoire ne le remplace pas tout seul pendant l'entraînement.
@EXERCISE
Entraîne, sauve, recharge, et compare encode sur une phrase du corpus. Les deux listes doivent être égales.
@BUILD
Le run publié écrit model/data/bpe.json quand le BPE est retenu. Le rapport data/gpt_run.json dit si le choix final est bpe ou char.
@QUESTION
Que fait encode si un caractère n'a jamais été vu à l'entraînement du BPE ?
@CORRECT
Il lève KeyError au lieu d'inventer un identifiant
@WRONG
- Il remplace le caractère par zéro
- Il réentraîne une fusion supplémentaire
- Il ignore le caractère et continue
@EXPLANATION
Un identifiant inventé décalerait tous les poids. L'erreur explicite est le comportement voulu.
@@@
@ID 13.3
@TITLE Choisir le texte
@TAG Données
@MINUTES 30
@VISUAL bars
@WHY
Le modèle n'apprend que le texte qu'on lui donne. Un catalogue vérifié évite de mélanger un jouet, un livre du domaine public et un dump qu'on n'a pas le droit de redistribuer.
@OBJECTIVES
- Lire l'ordre recommandé des jeux
- Repérer une licence et une réserve
- Préparer un extrait sans le versionner
@PREREQ Le BPE sait s'enregistrer.
@INTUITION
Tu ne verses pas la bibliothèque entière dans la casserole. Tu suis une recette : d'abord une goutte, puis un livre, puis, seulement si la machine suit, un plus grand texte.
@VOCAB
Catalogue : data/datasets.json, la liste tenue à jour. Étape : 1 jouet, 2 petit corpus, 3 grand corpus, 4 instructions, 5 dialogue, 6 évaluation. Gated : un jeu qu'il faut accepter à la main. Préparer : nettoyer, couper train et val, écrire la licence à côté.
@EXPLAIN
Chaque fiche a une URL https, une licence lue à la source, une langue, une taille, un format et une compatibilité. La compatibilité dit si le tokenizer caractère ou le BPE est le bon, et si le jeu tient dans le navigateur, sur le CPU NumPy, ou s'il demande un GPU. python -m model.datasets list affiche l'ordre. prepare télécharge, vérifie le sha256 quand il est connu, retire l'en-tête Gutenberg, et écrit train.txt, val.txt et ATTRIBUTION.md. Les gros fichiers restent hors du dépôt. --max-mb prélève un échantillon. Un jeu gated ou un parquet n'est pas téléchargé en silence.
@LANG python
@CODE
:::
from model.datasets import load_catalog, validate_catalog
erreurs = validate_catalog(load_catalog())
print(erreurs)
:::
@EXPERIMENT
Ouvre #/donnees. Change le tokenizer et le lieu d'entraînement. Une fiche trop grosse pour le navigateur doit le dire avant que tu lances quoi que ce soit.
@EXERCISE
Repère un jeu français de l'étape 2 et un jeu marqué gated. Dis lequel le laboratoire accepte de préparer tout seul.
@BUILD
gpt_train.py --dataset lit un jeu déjà préparé. --plan enchaîne le pré-entraînement puis l'ajustement, dans l'ordre du fichier JSON.
@QUESTION
Où est la liste des jeux que ce dépôt accepte de citer ?
@CORRECT
Dans data/datasets.json, vérifiée par des URL https
@WRONG
- Dans un dossier de fichiers téléchargés et commités
- Sur une page sans licence
- Dans le cache du navigateur du visiteur
@EXPLANATION
Le JSON est la source. Les fichiers lourds sont reconstruits localement et ne sont pas versionnés.
@@@
@ID 13.4
@TITLE Le playground
@TAG Playground
@MINUTES 30
@VISUAL loss
@WHY
Lire une courbe dans un JSON ne montre pas le prochain token. Le playground rejoue le forward dans le navigateur, avec la température, le top-k et les poids d'attention du dernier pas.
@OBJECTIVES
- Charger les poids exportés
- Lire la barre du token suivant
- Relier la température au tirage
@PREREQ Un checkpoint déjà entraîné.
@INTUITION
Le modèle pose ses jetons sur la table, un par un. Tu vois lequel il préfère, et tu peux le forcer à choisir plus largement.
@VOCAB
Export : data/gpt_browser.json, poids en float32 et logits de référence. Température : un diviseur des scores, avant le softmax. Top-k : on ne tire que parmi les k scores les plus hauts. Attention : la ligne du dernier pas, tête 0 de la dernière couche.
@EXPLAIN
model/export_js.py arrondit les poids en float32, reconstruit le TinyGPT, et calcule les logits du prompt sur cette copie. Le JavaScript refait le même calcul : embedding, positions absolues, LayerNorm, attention causale, GELU, tête. Le test compare ces logits, pas une capture dessinée. La température 0 prend l'argmax. Une température plus haute étale la masse. Le playground est public et ne écrit rien dans le stockage du visiteur.
@LANG python
@CODE
:::
from model.export_js import export_browser
from model.gpt_train import load_checkpoint
modele, tok, _ = load_checkpoint("model/data/gpt_checkpoint.npz")
export_browser(modele, tok, "data/gpt_browser.json", "Le ")
:::
@EXPERIMENT
Dans #/playground, lance un prompt court. Compare le premier token à température 0 et à température 1. Le premier doit être stable.
@EXERCISE
Explique pourquoi les logits de référence sont recalculés après l'arrondi float32, et pas sur les float64 d'origine.
@BUILD
Le même export existe pour le checkpoint de dialogue, data/chat_browser.json, quand l'ajustement a pu être exporté.
@QUESTION
Pourquoi le playground recalcule-t-il les logits après l'arrondi float32 ?
@CORRECT
Pour comparer le JavaScript au même point de départ que les poids servis
@WRONG
- Pour augmenter la taille du vocabulaire
- Pour entraîner un pas de plus dans le navigateur
- Pour cacher la température
@EXPLANATION
Le navigateur lit les poids arrondis. La référence doit partir de ces poids-là.
@@@
@ID 13.5
@TITLE Des questions et des réponses
@TAG Ajustement
@MINUTES 25
@VISUAL flow
@WHY
Continuer un roman n'apprend pas à répondre. Il faut des paires question réponse, courtes, dont on connaît la provenance, avant d'ouvrir un grand jeu d'instructions.
@OBJECTIVES
- Lire le format Question / Réponse
- Distinguer le jouet du cours et un jeu externe
- Voir ce qu'une consigne apprend
@PREREQ Le playground sait tirer une suite.
@INTUITION
Tu montres la question, puis seulement la réponse compte comme devoir. Le modèle voit le contexte, il n'est pas noté sur la copie de la question.
@VOCAB
Instruction : une consigne et une réponse attendue. SFT : l'ajustement supervisé après le pré-entraînement. Jouet : model/data/instructions_fr.json, écrit pour le cours. Jeu externe : une fiche du catalogue, avec sa licence.
@EXPLAIN
Le format du laboratoire est « Question : … » puis « Réponse : … ». Le fichier instructions_fr.json est un petit jeu original, sous la même licence MIT que le code, et il n'est pas présenté comme un corpus public externe. Les jeux d'instructions du catalogue, Dolly, Alpaca, Aya, OpenAssistant, ont chacun une licence vérifiée et des réserves : partage à l'identique, usage non commercial, ou fichier trop gros pour ce CPU. On ne les mélange pas avec le jouet sans relire la fiche.
@LANG python
@CODE
:::
from model.finetune import load_instructions
rows = load_instructions("model/data/instructions_fr.json")
print(rows[0]["question"])
print(rows[0]["answer"])
:::
@EXPERIMENT
Lis trois paires. Si la réponse est une définition du cours, le modèle pourra la recopier. Il ne devient pas pour autant un assistant général.
@EXERCISE
Écris une paire nouvelle sur le même format, puis dis si elle a sa place dans le jouet MIT ou s'il faudrait une fiche de catalogue.
@BUILD
L'étape suivante masque la perte sur la question. Le plan d'entraînement peut enchaîner un livre puis ce fichier.
@QUESTION
Quelle est la place de instructions_fr.json dans ce dépôt ?
@CORRECT
Un petit jeu original pour le cours, pas un corpus externe
@WRONG
- Une copie d'Alpaca redistribuée
- Le dump de Wikipédia en français
- Un jeu gated à télécharger à la main
@EXPLANATION
Le fichier est écrit pour les leçons. Les jeux externes restent dans le catalogue, avec leur licence.
@@@
@ID 13.6
@TITLE Masquer la question
@TAG Ajustement
@MINUTES 35
@VISUAL loss
@WHY
Si la perte compte toute la ligne, le modèle est récompensé pour réciter la question. On veut qu'il apprenne la réponse, tout en voyant la question.
@OBJECTIVES
- Couper la cible au début de la réponse
- Comprendre le masque quand le BPE recolle par-dessus la frontière
- Lire une perte qui descend sur les réponses
@PREREQ Le format Question / Réponse.
@INTUITION
L'énoncé reste au tableau. Seule la phrase de l'élève est corrigée. On ne retire pas l'énoncé : sans lui, la réponse n'a pas de sens.
@VOCAB
Masque : 1 sur les tokens de la réponse, 0 sur ceux de la question. Cible décalée : le token suivant, comme dans le pré-entraînement. Frontière : le caractère où « Réponse : » commence. Perte masquée : la moyenne ne compte que les positions à 1.
@EXPLAIN
example_ids repère la frontière en caractères, puis marque un token seulement si son début est après cette frontière. Un collage BPE qui chevauche la frontière ne fait pas entrer la question dans la cible. masked_cross_entropy suit la même forme que la perte du pré-entraînement, avec ce masque. finetune peut mettre à jour tous les poids, ou seulement les facteurs LoRA. Le test du cours vérifie que le masque change la perte, et que les deux réglages font descendre la perte sur un exemple répété.
@LANG python
@CODE
:::
from model.finetune import format_pair
print(format_pair("salut", "bonjour")[0])
:::
@EXPERIMENT
Sur une paire très répétée, la perte de fin doit être plus basse que la perte de départ. Sur trente paires vues vingt pas, attends une baisse modeste, pas une conversation.
@EXERCISE
Dis pourquoi un masque qui vaudrait 1 partout réapprendrait surtout à recopier « Question : ».
@BUILD
gpt_train.py --plan lit d'abord les étapes pretrain, puis une étape sft qui pointe vers le fichier d'instructions.
@QUESTION
Quels tokens entrent dans la perte pendant l'ajustement ?
@CORRECT
Ceux dont le début est dans la réponse, pas dans la question
@WRONG
- Tous les tokens de la ligne
- Seulement le premier token de la question
- Aucun : l'ajustement ne calcule pas de perte
@EXPLANATION
La question est le contexte. La cible commence à la réponse, même si une fusion BPE touche la frontière.
@@@
@ID 13.7
@TITLE Ajuster sans tout bouger
@TAG LoRA
@MINUTES 35
@VISUAL lora
@WHY
Réécrire toutes les matrices sur un petit jeu d'instructions écrase vite le texte déjà appris. LoRA ajoute une correction de petit rang, et on compare les deux sur le même exemple.
@OBJECTIVES
- Voir la forme de A et de B
- Compter les poids vraiment entraînés
- Comparer LoRA et l'ajustement complet
@PREREQ Une perte déjà masquée.
@INTUITION
Tu laisses le meuble en place et tu ajoutes un tiroir. Le tiroir est petit. Au début il est vide, donc le meuble ne change pas.
@VOCAB
LoRA : une correction BA, de rang r, ajoutée à une matrice gelée. A : le facteur qui reçoit du hasard. B : le facteur qui commence à zéro. Rang : la largeur du tiroir. Gel : les poids de base ne reçoivent pas de gradient.
@EXPLAIN
model/lora.py vise les matrices wq, wk, wv, wo, w1 et w2. A est tirée petite, B est nulle, donc le produit vaut zéro au premier pas : la sortie ne change pas avant l'apprentissage. Le rang r décide du nombre de valeurs entraînées. finetune avec lora_rank gèle la base, entraîne A et B, puis écrit la matrice fusionnée dans le modèle. compare_finetunes lance les deux recettes. Le rapport data/finetune_run.json donne les deux pertes et le nombre de poids. Moins de poids ne veut pas dire une meilleure réponse : on lit les deux nombres.
@LANG python
@CODE
:::
import numpy as np
from model.lora import init_lora, trainable_count
facteurs = init_lora({"l0.wq": np.zeros((2, 2))}, rank=1, seed=0)
print(trainable_count(facteurs))
:::
@EXPERIMENT
Au rang 1, B reste nul tant que personne ne l'entraîne. La correction ajoutée au poids de base est donc nulle. Le test du dépôt le vérifie.
@EXERCISE
Sur un modèle jouet, compare le nombre de poids entraînés en ajustement complet et en LoRA. Le second doit être plus petit.
@BUILD
Le run publié choisit, pour le checkpoint de dialogue, la recette dont la perte de fin est la plus basse, et il écrit l'échantillon à côté.
@QUESTION
Pourquoi la correction LoRA vaut-elle zéro au premier pas ?
@CORRECT
Parce que B commence à zéro, donc le produit BA est nul
@WRONG
- Parce que A est une matrice identité
- Parce que le rang est toujours égal à la largeur
- Parce que la base est détruite
@EXPLANATION
A est aléatoire, B est nulle. Tant que B n'a pas bougé, ajouter BA ne change pas la matrice.
@@@
@ID 13.8
@TITLE Continuer le dialogue
@TAG Dialogue
@MINUTES 25
@VISUAL transformer
@WHY
Une perte qui descend ne fait pas un assistant. Il faut lire la suite générée, dire ce qu'elle recolle du jeu d'instructions, et ce qu'elle ne sait pas faire.
@OBJECTIVES
- Tirer une réponse à température nulle
- Lire le rapport d'ajustement
- Dire la limite du petit jeu
@PREREQ LoRA et l'ajustement complet ont été comparés.
@INTUITION
Tu poses une question du cours et tu écoutes. Si la réponse répète une fiche, le masque a fait son travail. Si elle part dans le roman, le pré-entraînement parle plus fort.
@VOCAB
Température nulle : le token le plus probable, sans tirage. Échantillon : le texte écrit dans finetune_run.json. Rapport : pertes de départ et de fin, nombre de poids, recette retenue. Limite : le modèle n'a vu que le corpus préparé et les paires du cours.
@EXPLAIN
Après compare_finetunes, le script garde la recette à la perte la plus basse et tire une suite depuis « Question : … Réponse : ». Le playground peut charger ce second export en mode dialogue. Ce n'est pas une évaluation PIAF : PIAF est dans le catalogue pour mesurer la compréhension, et son parquet n'est pas décodé par prepare. Un visiteur peut lire le playground. Lancer un entraînement dans l'IDE, répondre aux quiz, ou enregistrer un plan de données reste réservé au propriétaire, et les tables Supabase refusent les autres comptes.
@LANG python
@CODE
:::
from model.gpt_train import sample_text
invite = "Question : qu'est-ce qu'un token\nRéponse :"
print(invite)
:::
@EXPERIMENT
Compare une réponse à température 0 et une réponse à température 0,8. La première doit être stable d'un lancement à l'autre, avec la même graine.
@EXERCISE
Écris, en une phrase, ce que cet échantillon prouve, et une chose qu'il ne prouve pas. Par exemple : il recolle une définition vue, il ne prouve pas un assistant général.
@BUILD
La piste s'arrête sur cette comparaison. Les gros jeux restent des fiches : on sait d'où ils viennent, et on ne prétend pas les avoir tous entraînés ici.
@QUESTION
Que prouve un échantillon de dialogue sur ce petit jeu ?
@CORRECT
Qu'on peut relire une suite tirée du checkpoint ajusté, pas qu'un assistant général existe
@WRONG
- Que le modèle a lu tout Wikipédia
- Que LoRA bat toujours l'ajustement complet
- Que la licence des jeux externes n'a plus d'importance
@EXPLANATION
L'échantillon est une lecture du checkpoint. Le catalogue et les pertes restent les pièces à citer à côté.
@@@
