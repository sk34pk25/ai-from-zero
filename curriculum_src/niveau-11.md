@@@
@ID 11.1
@TITLE Lire un papier
@TAG Recherche
@MINUTES 30
@WHY
Un article n'est pas une vérité à recopier. C'est une hypothèse, un montage, des mesures, et des limites. Ce niveau t'apprend à en extraire une expérience que tu pourrais refaire, puis à dire ce que tu n'as pas refait.
@OBJECTIVES
- Repérer la question et la baseline
- Séparer le résultat des commentaires
- Noter ce que le dépôt ne contient pas
@PREREQ Tout le laboratoire jusqu'au niveau 10.
@INTUITION
Tu lis une recette. Tu notes les ingrédients que tu as, ceux que tu n'as pas, et le plat que l'auteur prétend avoir obtenu. Tu ne sers pas son plat si tu n'as fait que lire la recette.
@VOCAB
Papier : un article qui pose une question. Baseline : le système simple auquel on se compare. Résultat : un nombre obtenu dans un montage décrit. Limite : ce que le montage ne montre pas.
@EXPLAIN
Pour chaque papier que tu cites dans ce parcours, tu dois pouvoir remplir quatre lignes : la question, la baseline, la mesure, et ce que tu n'as pas reproduit. Le laboratoire a déjà ce format dans model/experiment.py : run_ablation prend des configurations nommées et une fonction, et renvoie une ligne par nom. Il ne télécharge pas d'article, il ne lance pas un entraînement de recherche. Les leçons suivantes appliquent ce filtre à quatre idées à la mode : raisonner sur des concepts plutôt que sur des tokens, itérer dans un temps interne, calculer dans un espace continu, remplacer l'attention, mélanger les modalités dès l'entrée. Aucune de ces leçons ne recopie un tableau de scores. Si un chiffre n'a pas été produit par pytest dans ce dépôt, il n'entre pas dans ton README.
@LANG python
@CODE
:::
from model.experiment import run_ablation
lignes = run_ablation(
    [{"name": "baseline", "lr": 0.1}, {"name": "variante", "lr": 0.2}],
    lambda config: {"loss": 1.0 / config["lr"]},
)
print([ligne["name"] for ligne in lignes])
:::
@EXPERIMENT
Les noms sortent dans l'ordre donné : baseline, puis variante. test_ablation_keeps_names vérifie aussi que la loss de la variante est plus petite dans cet exemple jouet.
@EXERCISE
Prends un article que tu as déjà ouvert. Écris sa question en une phrase, sans reprendre son titre comme si c'était une preuve.
@BUILD
Le fil rouge du niveau est le comparateur baseline / variante. La lecture d'articles alimente les noms des configurations, pas des scores inventés.
@QUESTION
Que dois-tu écrire avant de citer un résultat de papier dans ton portfolio ?
@CORRECT
Ce que tu as réellement reproduit, et ce que tu n'as pas reproduit
@WRONG
- Le titre, qui tient lieu de preuve
- Un score lu dans l'abstrait, sans montage
- Le nombre de paramètres du Backbone
@EXPLANATION
Un chiffre d'article n'est pas un chiffre du dépôt. Le portfolio ne garde que les seconds, et nomme les premiers comme non reproduits.
@@@
@ID 11.2
@TITLE Reproduire une expérience
@TAG Recherche
@MINUTES 35
@WHY
Reproduire, ce n'est pas relancer un script trouvé. C'est fixer les données, le découpage, la métrique et la baseline, puis obtenir un nombre que quelqu'un d'autre peut recalculer.
@OBJECTIVES
- Découper une suite sans fuite
- Comparer bigramme et uniforme
- Lire bigram_versus_uniform
@PREREQ Lire un papier, et le bigramme du niveau 3.
@INTUITION
Tu caches la fin de la phrase, tu apprends sur le début, tu mesures sur la fin. Si tu apprends sur la fin, le contrôle est truqué : le modèle a déjà vu la question.
@VOCAB
Découpage : split_sequence, par défaut 80 % au début. Fuite : une information du test présente dans l'entraînement. Perplexité uniforme : égale au vocabulaire, pour un modèle qui ne préfère rien. Perplexité bigramme : celle mesurée sur la queue.
@EXPLAIN
split_sequence refuse un ratio hors de (0, 1) et une suite trop courte. La coupe garde au moins deux tokens de chaque côté. bigram_versus_uniform apprend le bigramme seulement sur la tête, puis calcule la perplexité sur la queue. La baseline uniforme vaut vocab_size, parce qu'une distribution uniforme sur V a une perplexité V. Le test test_uniform_cross_entropy_is_log_vocab vérifie le cas logit nul : l'entropie croisée vaut log(V), ce qui est cohérent avec une perplexité V. Ce montage est la reproduction minimale du cours. Elle ne demande pas de GPU, elle se relance, et elle échoue bruyamment si tu observes le test avant de mesurer. C'est le standard auquel les idées suivantes seront comparées : une idée sans découpage ni baseline reste une lecture.
@LANG python
@CODE
:::
from model.experiment import bigram_versus_uniform
ids = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
print(bigram_versus_uniform(ids, vocab_size=2))
:::
@EXPERIMENT
Le dictionnaire a quatre clés : bigram_perplexity, uniform_perplexity, train_tokens, test_tokens. L'uniforme vaut 2. Le bigramme, sur cette alternance, doit faire mieux ou aussi bien, pas pire qu'un hasard mal mesuré.
@EXERCISE
Pourquoi la coupe est-elle au début et à la fin, plutôt qu'un mélange aléatoire ? Parce qu'une suite a un ordre, et qu'un mélange casserait la dépendance locale que le bigramme utilise.
@BUILD
La brique « Expériences » du site s'allume ici. Elle désigne ce comparateur, pas un classements de papiers.
@QUESTION
Que vaut la perplexité de la baseline uniforme ?
@CORRECT
La taille du vocabulaire
@WRONG
- Toujours 1
- Le nombre de couches
- La loss MoE
@EXPLANATION
Une loi uniforme sur V tokens a une perplexité V. Le code la renvoie dans uniform_perplexity.
@@@
@ID 11.3
@TITLE Concepts plutôt que tokens
@TAG Recherche
@MINUTES 30
@WHY
Une idée récente consiste à prédire des unités plus larges que le token : une phrase, un « concept ». Elle promet des suites plus courtes. Elle déplace la difficulté dans la définition du concept et dans le décodeur qui revient aux mots.
@OBJECTIVES
- Formuler l'hypothèse en une phrase
- Voir ce qu'un concept doit préciser
- Dire que le dépôt ne l'implémente pas
@PREREQ Reproduire une expérience.
@INTUITION
Au lieu de deviner la lettre suivante, tu devines la prochaine idée, puis un autre module écrit les lettres. Tu as moins d'étapes, et un nouveau problème : qu'est-ce qu'une idée, et comment reviens-tu au texte.
@VOCAB
Token : l'unité du tokenizer actuel, ici souvent un caractère. Concept : une unité plus large, à définir. Décodeur vers le texte : la fonction qui réécrit le concept en caractères. LCM : le nom de famille de ces travaux, cité comme lecture, pas comme code.
@EXPLAIN
Le tokenizer du dépôt est un tokenizer caractère, plus un mini-BPE. Il n'y a pas de segmentation en phrases ni de vecteur de concept. L'hypothèse, formulée proprement, est : à budget de calcul égal, prédire des unités plus longues peut réduire le nombre de pas, si le décodeur qui revient aux caractères coûte moins que les pas économisés. Cette hypothèse n'est pas testée ici. Pour la tester, il faudrait un découpage en concepts reproductible, une baseline au niveau caractère sur le même texte, et une métrique commune, par exemple la perplexité caractère après décodage. Sans ces trois pièces, citer un gain lu dans un article serait exactement ce que l'étape 11.1 interdit. Tu peux ranger l'idée dans les variantes possibles du niveau 12, avec le statut « non mesurée ».
@LANG python
@CODE
:::
from model.tokenizer import CharTokenizer
texte = "une idee. une autre."
ids = CharTokenizer(texte).encode(texte)
print(len(ids), "caracteres, pas des concepts")
:::
@EXPERIMENT
La longueur égale celle du texte, espaces compris. Rien n'a regroupé les deux phrases en deux unités.
@EXERCISE
Quelle baseline choisirais-tu pour tester des concepts ? Le même texte prédit au niveau caractère, avec la même métrique après retour aux caractères.
@BUILD
Aucune fonction concept n'entre dans le fil rouge. Le comparateur est prêt à recevoir une variante le jour où elle existe.
@QUESTION
Pourquoi ce cours ne cite-t-il pas un gain chiffré pour les modèles à concepts ?
@CORRECT
Parce que le dépôt ne les implémente pas et ne les mesure pas
@WRONG
- Parce que l'idée est forcément fausse
- Parce que le BPE est un concept
- Parce que la perplexité uniforme vaut 1
@EXPLANATION
Une idée lue n'est pas un résultat du laboratoire. Le tokenizer reste au caractère et au BPE.
@@@
@ID 11.4
@TITLE Un temps de calcul interne
@TAG Recherche
@MINUTES 30
@WHY
Une autre idée donne au modèle un temps interne : plusieurs mises à jour d'un état latent avant d'émettre un token. On l'appelle parfois calcul temporel, ou pensée continue. Elle ressemble à la profondeur adaptative, avec un horloge qui n'est pas celle des tokens.
@OBJECTIVES
- Séparer temps des tokens et temps interne
- Relier l'idée à une boucle bornée
- Refuser un score non mesuré
@PREREQ Concepts et profondeur adaptative.
@INTUITION
Avant de parler, tu tournes la réponse dans ta tête. Ce tour n'est pas un mot dit. Un modèle à temps interne ferait des mises à jour silencieuses, puis écrirait un token.
@VOCAB
Temps interne : des pas qui ne consomment pas un token d'entrée. État latent : le vecteur mis à jour pendant ces pas. CTM : un nom de travaux sur ce temps interne, ici une lecture. Budget : le nombre maximal de pas silencieux.
@EXPLAIN
selective_scan avance d'un pas par token d'entrée. Un temps interne avancerait plusieurs fois sans nouveau token, ou s'arrêterait selon un critère. Backbone ne le fait pas : un forward, une passe sur T. L'hypothèse testable serait : sur des questions qui demandent deux opérations, K pas internes améliorent l'exactitude assez pour payer K fois plus de calcul. Il faudrait un petit jeu de questions dont tu connais la réponse, une baseline à K=1, et un plafond sur K, sinon la boucle n'a pas de coût. Le dépôt n'a ni le jeu de questions ni la boucle. Tu ne rapportes donc pas de gain. Tu rapportes l'analogie avec l'étape 10.6, et la différence : là-bas la profondeur est un nombre de couches fixes, ici le temps interne serait une boucle autour d'un état.
@LANG python
@CODE
:::
def pas_internes(etat, k):
    for _ in range(k):
        etat = etat * 0.5 + 1.0
    return etat
print(pas_internes(0.0, 1), pas_internes(0.0, 4))
:::
@EXPERIMENT
K=1 et K=4 ne donnent pas le même état. Ce jouet n'est pas un modèle de langage et n'a pas de test de justesse.
@EXERCISE
Quel plafond poserais-tu, et pourquoi ? Un K maximum écrit à l'avance, pour que le coût reste borné et comparable.
@BUILD
Le fil rouge ne gagne pas de temps interne. L'idée reste une variante non branchée dans run_ablation.
@QUESTION
En quoi un temps interne diffère-t-il du scan SSM du dépôt ?
@CORRECT
Le scan avance avec les tokens ; le temps interne ferait des pas sans nouveau token, et il n'est pas codé
@WRONG
- C'est le même code, sous un autre nom
- Il supprime le besoin d'une baseline
- Il est testé dans test_ssm_matches_scan_and_is_causal
@EXPLANATION
Le test du scan vérifie une récurrence sur la séquence d'entrée. Aucun pas silencieux n'existe dans Backbone.
@@@
@ID 11.5
@TITLE Raisonner dans un espace continu
@TAG Recherche
@MINUTES 30
@WHY
Le raisonnement latent propose de calculer dans des vecteurs, sans passer par des mots à chaque étape. C'est proche du temps interne, mais l'objet manipulé n'est pas un token. Le gain n'existe ici que comme hypothèse.
@OBJECTIVES
- Distinguer token émis et vecteur interne
- Voir la difficulté de lire un vecteur
- Exiger une métrique externe
@PREREQ Temps interne.
@INTUITION
Tu peux compter sur tes doigts sans prononcer les nombres. Personne ne voit le calcul, seulement le résultat. Pour juger, il faut une question dont la réponse est connue, pas une inspection du vecteur.
@VOCAB
Latent : un vecteur non affiché. Raisonnement latent : une suite de vecteurs avant la sortie. Lisibilité : le fait de pouvoir expliquer les étapes. Métrique externe : exactitude sur des réponses connues, pas une norme de vecteur.
@EXPLAIN
Les états de selective_scan sont déjà latents : le test ne les interprète pas, il vérifie des propriétés. Interpréter un état comme une « pensée » serait un récit en plus. Une expérience honnête comparerait une baseline qui écrit des étapes en tokens, et une variante qui met à jour un vecteur puis répond en un seul coup, sur le même jeu de questions, avec la même exactitude. La lisibilité se mesure à part : peux-tu expliquer une erreur ? Le dépôt n'a pas ce jeu. Il a, comme substitut modeste, des états dont on teste la causalité et l'égalité de deux algorithmes. Ce substitut ne démontre pas qu'un raisonnement a eu lieu. Il démontre qu'une récurrence fait ce qu'elle prétend. Garde les deux phrases distinctes dans le portfolio.
@LANG python
@CODE
:::
import numpy as np
from model.ssm import selective_scan
x = np.array([[1.0], [0.0], [0.0]])
y = selective_scan(x, np.array([-0.5]), np.ones_like(x), np.ones_like(x), np.ones_like(x))
print(np.round(y[:, 0], 3))
:::
@EXPERIMENT
Tu vois des nombres qui décroissent. Rien ne te dit qu'ils « signifient » une addition. La propriété testée ailleurs est la causalité, pas le sens.
@EXERCISE
Pourquoi une norme de vecteur n'est-elle pas une métrique de raisonnement ? Parce qu'elle ne dit pas si la réponse à la question est juste.
@BUILD
Le fil rouge continue de tester des propriétés de calcul, pas des histoires sur les états. Aucune variante latente n'est ajoutée.
@QUESTION
Comment juger un calcul latent sans le raconter ?
@CORRECT
Par une exactitude sur des questions dont la réponse est connue, contre une baseline
@WRONG
- En lisant la norme du vecteur
- En copiant le score d'un article
- En allongeant le README
@EXPLANATION
Le vecteur n'est pas une explication. Seule une mesure externe, sur un découpage fixé, dit si la variante aide.
@@@
@ID 11.6
@TITLE Alternatives à l'attention
@TAG Recherche
@MINUTES 30
@WHY
L'attention n'est pas une loi. Le niveau 8 a déjà une alternative dans le dépôt : le scan. D'autres articles en proposent encore. Tu compares celles que tu peux exécuter, et tu cites les autres comme lectures.
@OBJECTIVES
- Nommer l'alternative réellement codée
- Rappeler le contrat de forme
- Laisser les autres au statut de lecture
@PREREQ SSM, attention, expériences.
@INTUITION
Tu as deux moteurs qui tournent sur le même banc, et des dessins de moteurs dans des revues. Seuls les deux premiers ont un régime mesuré chez toi : la forme et la causalité.
@VOCAB
Alternative codée : kind="ssm" ou l'alternance hybrid. Alternative lue : toute proposition sans fonction dans model/. Contrat : sortie (B, T, D), causalité. Qualité de langage : non mesurée pour ces dos, faute de corpus et d'entraînement complet.
@EXPLAIN
test_backbone_kinds_share_shape_and_are_causal est la reproduction locale de « on peut remplacer le mélangeur ». Elle ne dit pas qu'un SSM bat un Transformer en perplexité. Elle dit que les trois kinds s'appellent de la même façon et n'utilisent pas le futur. Une alternative lue — une attention linéarisée, un autre SSM, un mélange différent — entre dans le portfolio seulement avec le statut de l'étape 11.1. Si tu l'implémentes, elle doit passer le même test de forme et de causalité avant toute discussion de vitesse. La vitesse, elle, se compare avec les formules du niveau 6 ou avec un chronomètre sur la même machine, pas avec un chiffre d'article.
@LANG python
@CODE
:::
import numpy as np
from model.backbone import Backbone
idx = np.array([[1, 2, 3, 4]])
for kind in ("transformer", "ssm", "hybrid"):
    y = Backbone(kind, 8, d_model=8, n_layers=2, block_size=6, seed=3).forward(idx)
    print(kind, y.shape)
:::
@EXPERIMENT
Trois lignes (1, 4, 8). Les valeurs diffèrent. Le test officiel vérifie en plus que changer le dernier token ne change pas la position 0.
@EXERCISE
Quelle phrase t'interdis-tu après ce test ? « Le SSM est meilleur en français. » Tu n'as pas mesuré le français.
@BUILD
L'alternative présente dans le fil rouge est le dos SSM. Les autres restent des noms de papiers, hors tableau de résultats.
@QUESTION
Qu'a réellement montré le test des trois dos ?
@CORRECT
Même forme et causalité, pas une victoire de qualité de langage
@WRONG
- Que le SSM a une perplexité plus basse
- Que l'attention est obsolète
- Que hybrid copie les poids du Transformer
@EXPLANATION
Le test fixe un contrat d'interface. La qualité sur un corpus n'est pas dans les asserts.
@@@
@ID 11.7
@TITLE Multimodal natif
@TAG Recherche
@MINUTES 25
@WHY
Un modèle multimodal natif mélange les modalités dès les premières couches, au lieu de coller un encodeur d'image devant un modèle de texte. L'idée est claire. Le dépôt n'a que le premier geste : les patches.
@OBJECTIVES
- Distinguer natif et collage
- Revenir à ce que patchify fait
- Éviter d'annoncer un modèle vision-langage
@PREREQ Alternatives et niveau 9.
@INTUITION
Coller un traducteur devant un livre, ce n'est pas écrire le livre dans les deux langues. Le natif entraînerait les deux ensembles. Le collage met une projection devant un dos déjà défini.
@VOCAB
Natif : modalités présentes dans le même entraînement, tôt dans le réseau. Collage : une projection ajoutée devant un modèle de texte. Patch : le seul geste image testé. Absent : données appariées image et texte.
@EXPLAIN
project_patches est un collage de forme : des pixels deviennent des vecteurs de largeur D. Pour être natif, il faudrait des paires image et légende, une perte, et un entraînement qui modifie les poids des deux côtés. Le dépôt n'a pas ces paires. Annoncer un modèle vision-langage parce que patchify existe serait le même glissement que d'annoncer Mamba parce que le scan existe. La phrase juste : le cours montre comment une image devient une séquence, et il laisse l'entraînement multimodal au statut non reproduit. Si tu ajoutes des paires plus tard, la baseline est le texte seul, sur les mêmes légendes, pour voir ce que l'image apporte vraiment.
@LANG python
@CODE
:::
import numpy as np
from model.multimodal import patchify
print(patchify(np.arange(16.0).reshape(4, 4), 2).shape)
:::
@EXPERIMENT
(4, 4) est une séquence de patches. Il n'y a pas de légende associée, donc pas d'entraînement commun.
@EXERCISE
Quelle donnée manque pour un entraînement natif ? Des paires image et texte, plus une loss qui les relie.
@BUILD
Le fil rouge multimodal reste le découpage testé. Le mot « natif » ne s'ajoute pas au README comme une fonctionnalité.
@QUESTION
Pourquoi patchify ne fait-il pas de ce dépôt un modèle multimodal natif ?
@CORRECT
Il change une forme, sans données appariées ni entraînement commun
@WRONG
- Parce que les patches sont en couleur
- Parce que le test échoue
- Parce que le SSM l'interdit
@EXPLANATION
Le test vérifie un réordonnancement de pixels. Il ne vérifie pas qu'un mot et une image ont été appris ensemble.
@@@
@ID 11.8
@TITLE Ce qui n'a pas été reproduit
@TAG Recherche
@MINUTES 30
@WHY
La dernière étape du niveau est une liste négative, et c'est une livraison. Un portfolio crédible dit ce qu'il n'a pas fait, avec autant de précision que ce qu'il a mesuré.
@OBJECTIVES
- Lister les idées laissées en lecture
- Lister les mesures réellement vertes
- Préparer l'hypothèse du niveau 12
@PREREQ Les quatre idées précédentes.
@INTUITION
La vitrine montre la maquette, et une étiquette « pas le pont ». L'étiquette fait partie de la vitrine. Sans elle, le visiteur croit que la maquette porte des trains.
@VOCAB
Reproduit : un assert pytest dans ce dépôt. Non reproduit : une idée d'article sans cet assert. Maquette : scan, patches, mémoire par sac de mots, comparateur d'ablation. Pont : un entraînement à l'échelle d'un article.
@EXPLAIN
Reproduit ici : le bigramme bat ou égale une mesure contre l'uniforme sur un découpage sans fuite ; les trois dos ont la même forme et sont causaux ; les patches suivent l'ordre du test ; la mémoire retrouve le bon document et s'éteint ; run_ablation conserve les noms. Non reproduit : un modèle à concepts, un temps interne, un raisonnement latent interprété, une alternative d'attention autre que le scan du dépôt, un multimodal natif, et tout score copié d'un abstrait. Cette liste n'est pas une excuse. C'est le contrat de l'étape 11.1 appliqué au parcours. Le niveau 12 partira d'une hypothèse que tu peux mesurer avec ces briques, pas d'une hypothèse qui demanderait le pont.
@LANG python
@CODE
:::
reproduit = [
    "bigramme contre uniforme",
    "forme et causalite des trois dos",
    "patches et retrieval",
]
print(len(reproduit), "familles de tests, pas des scores d'articles")
:::
@EXPERIMENT
La liste tient dans les tests du dépôt. Ajouter un titre de papier dans cette liste, sans test, la rendrait fausse.
@EXERCISE
Écris trois lignes « non reproduit » que tu mettras dans le README. Elles doivent nommer l'idée et l'absence de mesure, pas un jugement de mode.
@BUILD
Le projet du niveau est ce partage net entre le comparateur réel et les lectures. L'architecture du niveau 12 devra rester du bon côté de la ligne.
@QUESTION
Laquelle de ces phrases a le droit d'être dans le README comme un résultat ?
@CORRECT
Le bigramme est mesuré contre une perplexité uniforme sur une queue non vue
@WRONG
- Le modèle à concepts dépasse le Transformer
- Le temps interne améliore le raisonnement de 20 %
- Le multimodal natif est entraîné dans model/
@EXPLANATION
Seule la première phrase a une fonction et un test. Les autres sont des lectures, ou des chiffres qui ne sortent pas du dépôt.
