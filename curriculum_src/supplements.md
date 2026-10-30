@@@
@ID 0.21
@TITLE Classes et objets
@TAG Python
@MINUTES 40
@WHY
Tout le laboratoire est écrit avec des classes : Tensor, TinyGPT, AdamW, le tokenizer. Sans savoir ce qu'est un objet, self ou une méthode, la rétropropagation du niveau 1 se lit comme une formule magique au lieu d'un mécanisme que tu peux suivre ligne par ligne.
@OBJECTIVES
- Écrire une classe avec __init__, des attributs et une méthode
- Expliquer le rôle de self lors d'un appel de méthode
- Distinguer deux noms pour un même objet et deux objets distincts
@PREREQ Fonctions (0.9), listes et dictionnaires (0.10). L'encadré « Une première classe » de l'étape 0.10 est une avant-première ; cette étape va jusqu'au bout.
@INTUITION
Une classe est un moule à gaufres, un objet est une gaufre. Le moule dit quelle forme aura chaque gaufre et ce qu'on peut faire avec ; chaque gaufre sortie du moule a ses propres valeurs. Deux étiquettes collées sur la même gaufre ne font pas deux gaufres : croquer via l'une se voit via l'autre.
@VOCAB
Classe : la définition, écrite avec class. Objet (ou instance) : une valeur créée à partir de la classe, par exemple Compteur(). Attribut : une donnée rangée dans l'objet, comme self.valeur. Méthode : une fonction définie dans la classe, appelée par objet.methode(). self : l'objet sur lequel la méthode travaille. __init__ : la méthode appelée automatiquement à la création.
@EXPLAIN
On lit l'exemple pas à pas. class Compteur: ouvre la définition. def __init__(self, depart=0): dit quoi faire à la naissance d'un objet ; self.valeur = depart range le nombre dans CET objet. def ajouter(self, pas): est une méthode : quand tu écris a.ajouter(2), Python appelle Compteur.ajouter(a, 2), donc self vaut a. Après a = Compteur(5), a.valeur vaut 5. Après a.ajouter(2), a.valeur vaut 7. Écrire b = a ne copie rien : b et a désignent le même objet, b.ajouter(1) fait passer a.valeur à 8. En revanche c = Compteur(a.valeur) fabrique un nouvel objet qui commence à 8 puis vit sa vie. L'opérateur is répond à la question « est-ce le même objet ? », alors que == compare des valeurs. Ce détail compte au niveau 1 : quand un même poids w sert deux fois, c'est le même objet qui doit recevoir deux contributions de gradient, et une méthode spéciale comme __mul__ permet d'écrire w * w au lieu de w.mul(w).
@LANG python
@CODE
:::
class Compteur:
    def __init__(self, depart=0):
        self.valeur = depart

    def ajouter(self, pas):
        self.valeur = self.valeur + pas
        return self.valeur

a = Compteur(5)
a.ajouter(2)
b = a              # un second nom pour le même objet
b.ajouter(1)
c = Compteur(a.valeur)  # un nouvel objet, copie de la valeur
c.ajouter(10)
assert a.valeur == 8 and b.valeur == 8 and c.valeur == 18
assert a is b and a is not c
print(a.valeur, b.valeur, c.valeur)
:::
@EXPERIMENT
Avant de lancer, écris sur papier les trois nombres que print va afficher. Lance, compare. Ajoute ensuite une méthode remettre_a_zero et vérifie qu'elle change a et b mais pas c.
@EXERCISE
Écris une classe Point avec deux attributs x et y, et une méthode distance_origine qui renvoie la racine de x² + y². Point(3, 4).distance_origine() doit valoir 5.0. Crée deux points égaux et montre avec is qu'ils restent deux objets distincts.
@BUILD
Ouvre model/autograd.py et repère class Tensor : __init__ range data, grad et requires_grad dans self ; __add__ et __mul__ sont des méthodes spéciales qui fabriquent un nouvel objet résultat. Tu n'as pas à tout comprendre : identifie seulement les attributs et trois méthodes.
@QUESTION
Après a = Compteur(5) puis b = a et b.ajouter(1), que vaut a.valeur ?
@CORRECT
6, car les noms partagent le même objet
@WRONG
- 5, car l’affectation crée une copie de l’objet
- 1, car ajouter remplace la valeur de départ
- Une erreur, car deux noms ne peuvent viser le même objet
@EXPLANATION
L'affectation b = a colle une seconde étiquette sur le même objet. La méthode modifie self.valeur de cet objet, visible par les deux noms. Pour une copie, il faut construire un nouvel objet.
@@@
@ID 0.22
@TITLE Vérifier son code avec assert et pytest
@TAG Méthode
@MINUTES 30
@WHY
Chaque brique du laboratoire est verrouillée par un test, et l'atelier se contrôle avec verifier.py. Savoir écrire une vérification, la lancer et lire son échec transforme « je crois que ça marche » en une preuve reproductible que tu peux relancer après chaque modification.
@OBJECTIVES
- Écrire une assertion avec un résultat attendu calculé à la main
- Placer des tests dans une fonction test_ et les lancer avec pytest
- Lire un échec : valeur attendue, valeur obtenue, ligne
@PREREQ Fonctions (0.9), erreurs et débogage (0.12), modules (0.11).
@INTUITION
Un test, c'est la balance de la cuisine. Tu ne goûtes pas la pâte en te demandant si « ça a l'air bien » : tu pèses 250 g et tu compares au chiffre de la recette. Si la balance affiche 300, tu sais quoi corriger, et tu peux repeser après chaque geste.
@VOCAB
assert condition : ne fait rien si la condition est vraie, lève AssertionError sinon. Valeur attendue : calculée à la main AVANT d'exécuter. Fonction de test : fonction dont le nom commence par test_, sans argument. pytest : programme qui trouve ces fonctions dans les fichiers test_*.py et les exécute toutes. Cas limite : entrée au bord du domaine, comme une liste vide.
@EXPLAIN
Exemple pas à pas. On veut une fonction moyenne(valeurs). À la main : la moyenne de [2, 4, 9] vaut (2 + 4 + 9) / 3 = 15 / 3 = 5. On écrit donc assert moyenne([2, 4, 9]) == 5. Si la fonction divise par 2 au lieu de len(valeurs), l'assertion échoue et pytest affiche quelque chose comme assert 7.5 == 5 : à gauche ce que ton code a produit, à droite ce que tu attendais. Pour les nombres à virgule, 0.1 + 0.2 vaut 0.30000000000000004 ; on compare donc avec une tolérance, abs(x - 0.3) < 1e-9, ou pytest.approx(0.3). Un bon test contient au moins un cas ordinaire, un cas limite (liste vide : on décide qu'elle lève ValueError) et une valeur calculée indépendamment du code testé. On met ces tests dans test_moyenne.py, dans des fonctions test_..., puis on lance python -m pytest depuis la racine. Un test qui échoue n'est jamais « réparé » en modifiant la valeur attendue pour coller au résultat : on relit d'abord le calcul à la main.
@LANG python
@CODE
:::
def moyenne(valeurs):
    if len(valeurs) == 0:
        raise ValueError("liste vide")
    return sum(valeurs) / len(valeurs)

def test_cas_ordinaire():
    assert moyenne([2, 4, 9]) == 5          # (2+4+9)/3 = 15/3 calculé à la main

def test_virgule_flottante():
    assert abs(moyenne([0.1, 0.2]) - 0.15) < 1e-12

def test_liste_vide():
    try:
        moyenne([])
    except ValueError:
        return
    raise AssertionError("une liste vide doit lever ValueError")

for test in (test_cas_ordinaire, test_virgule_flottante, test_liste_vide):
    test()
print("3 tests réussis")
:::
@EXPERIMENT
Copie les fonctions dans test_moyenne.py (sans la boucle finale) et lance python -m pytest test_moyenne.py. Remplace ensuite len(valeurs) par 2, relance et lis la ligne assert 7.5 == 5. Remets le code correct.
@EXERCISE
Écris une fonction maximum(valeurs) sans utiliser max, et trois tests : [3, 9, 2] donne 9, [-5, -1] donne -1, une liste vide lève ValueError. Pour chaque test, écris en commentaire la valeur attendue calculée à la main.
@BUILD
Lance python -m pytest tests/test_lab.py -q depuis la racine du dépôt. Ouvre ce fichier, choisis un test et retrouve la valeur attendue écrite à la main. Dans l'atelier, python verifier.py --tp 1 joue le même rôle pour ton propre code.
@QUESTION
pytest affiche « assert 7.5 == 5 » pour assert moyenne([2, 4, 9]) == 5. Que faut-il faire ?
@CORRECT
Vérifier la fonction : le résultat attendu est 5
@WRONG
- Remplacer l’attendu par 7.5 pour faire passer le test
- Arrondir 7.5 en entier avant l’assertion
- Retirer 9 de la liste sans vérifier la spécification
@EXPLANATION
La valeur de droite a été calculée à la main, indépendamment du code. Le test signale que le code s'en écarte ; modifier l'attente effacerait justement la preuve. Un calcul déterministe redonnera 7.5 à chaque relance.
@@@
@ID 0.23
@TITLE Mini-projet : un carnet de mesures
@TAG Projet
@MINUTES 60
@WHY
Avant d'attaquer l'apprentissage automatique, tu dois pouvoir assembler seul les briques du niveau 0 : fichier, boucle, dictionnaire, fonction, classe et test. Ce mini-projet est le point de contrôle : si tu le termines sans corrigé, la suite du parcours repose sur des bases solides.
@OBJECTIVES
- Lire un fichier texte de nombres et ignorer proprement les lignes vides
- Regrouper des fonctions dans une classe qui garde ses données
- Écrire un rapport JSON et le vérifier par des tests calculés à la main
@PREREQ Toutes les étapes 0.2 à 0.15, plus 0.21 et 0.22.
@INTUITION
Pense à un carnet de bord de vélo. Chaque ligne est une distance. Le carnet sait ajouter une sortie, donner le total, la moyenne et la plus longue, puis recopier un résumé propre sur une fiche que quelqu'un d'autre pourra relire sans ouvrir le carnet.
@VOCAB
Parsing : transformer du texte en valeurs utilisables. strip() : enlever espaces et retours à la ligne aux bords. json.dumps : transformer un dictionnaire en texte JSON. Rapport : fichier de sortie destiné à être relu. Reproductible : la même entrée redonne exactement le même rapport.
@EXPLAIN
On découpe le projet en trois briques, chacune testée avant la suivante. Brique 1, lire : pour le texte "12\n\n7.5\n20\n", on découpe en lignes, on enlève les blancs, on saute les lignes vides et on convertit avec float ; on attend [12.0, 7.5, 20.0]. Brique 2, la classe Carnet garde self.distances et propose total(), moyenne() et record(). À la main : total = 12 + 7.5 + 20 = 39.5, moyenne = 39.5 / 3 ≈ 13.1667, record = 20. Brique 3, le rapport : une méthode resume() renvoie un dictionnaire {"sorties": 3, "total": 39.5, ...} que json.dumps transforme en texte trié et lisible. On arrondit la moyenne à 4 décimales pour que le rapport soit stable. Chaque brique a ses assertions, écrites avant le code. C'est exactement la démarche de model/stats.py, que tu pourras comparer à ta version une fois la tienne terminée.
@LANG python
@CODE
:::
import json

def lire_distances(texte):
    return [float(ligne) for ligne in texte.splitlines() if ligne.strip()]

class Carnet:
    def __init__(self, distances):
        self.distances = list(distances)

    def total(self):
        return sum(self.distances)

    def moyenne(self):
        if not self.distances:
            raise ValueError("carnet vide")
        return self.total() / len(self.distances)

    def record(self):
        return max(self.distances)

    def resume(self):
        return {"sorties": len(self.distances), "total": self.total(),
                "moyenne": round(self.moyenne(), 4), "record": self.record()}

carnet = Carnet(lire_distances("12\n\n7.5\n20\n"))
assert carnet.distances == [12.0, 7.5, 20.0]
assert carnet.total() == 39.5 and carnet.record() == 20.0
assert carnet.resume()["moyenne"] == 13.1667
print(json.dumps(carnet.resume(), sort_keys=True))
:::
@EXPERIMENT
Crée sorties.txt avec cinq distances de ton choix, dont une ligne vide. Calcule à la main total, moyenne et record, puis fais lire le fichier par ton programme avec open(...).read() et compare. Écris le rapport dans rapport.json.
@EXERCISE
Ajoute au Carnet une méthode au_dessus(seuil) qui renvoie la liste des distances strictement supérieures au seuil, et un test : pour [12, 7.5, 20] et le seuil 10, on attend [12, 20]. Ajoute aussi un test qui vérifie qu'un carnet vide lève ValueError pour moyenne.
@BUILD
Compare ta solution à model/stats.py : load_numbers joue le rôle de lire_distances, summarize celui de resume, build_report celui de l'écriture du rapport. Note dans tes notes une différence de conception et la raison qui pourrait la justifier.
@QUESTION
Pourquoi arrondir la moyenne à 4 décimales dans le rapport ?
@CORRECT
Stabiliser la représentation du rapport
@WRONG
- Rendre la moyenne mathématiquement plus précise
- Modifier les données avant leur moyenne
- Garantir que tous les rapports ont la même moyenne
@EXPLANATION
L'arrondi ne rend pas le calcul plus juste : il fixe la forme du résultat écrit, pour qu'il se relise et se compare facilement. Le test, lui, garde une valeur attendue calculée à la main.
@@@
@ID 5.10
@TITLE Entraîner une variante moderne et la comparer
@TAG Expérience
@MINUTES 45
@WHY
Lire qu'une pièce moderne « marche mieux » ne suffit pas. Le laboratoire sait maintenant entraîner RoPE, RMSNorm, SwiGLU, GQA et le partage de poids : tu peux mesurer toi-même ce qu'une variante change, à budget égal, au lieu de recopier une affirmation.
@OBJECTIVES
- Entraîner la baseline et une variante avec les mêmes données, graine et nombre de pas
- Comparer loss de validation et nombre de paramètres
- Rédiger une conclusion prudente, limitée à ce qui a été mesuré
@PREREQ Les étapes 5.1 à 5.8 et l'entraînement du GPT (4.14).
@INTUITION
Pour savoir si un nouveau pneu rend le vélo plus rapide, tu refais le même parcours, avec le même cycliste, le même vent si possible, et tu ne changes que le pneu. Sinon tu mesures la météo, pas le pneu.
@VOCAB
Baseline : la configuration de référence (positions absolues, LayerNorm, GELU). Variante : une seule modification par rapport à elle. Ablation : retirer ou remplacer une pièce pour mesurer son effet. Graine : nombre qui fixe le hasard. Écart entre graines : la variation due au seul hasard, à comparer à l'effet mesuré.
@EXPLAIN
Exemple pas à pas. On entraîne deux modèles sur le même texte, 120 pas, même graine, même largeur. La baseline utilise pos="absolute" ; la variante utilise pos="rope", sans table de positions. On lit ensuite val_loss_end pour chacun et le nombre de paramètres : la variante en a block_size × d_model de moins, puisque la table pos disparaît. Une graine ne suffit pas. Pour chaque graine appariée, calcule delta = loss_variante - loss_baseline, puis examine la moyenne et la dispersion de ces différences. Les fluctuations communes aux deux modèles peuvent s'annuler : la dispersion de la baseline seule ne suffit pas. Le texte répété de l'exemple est un diagnostic d'outillage, pas une validation indépendante. Le second banc décrit dans atelier/BANC_FR.md réserve des livres et des auteurs principaux, avec trois graines appariées et un test après sélection sur validation. Le gradient de chaque variante est vérifié dans tests/test_modern_training.py par différences finies et, en CI, contre PyTorch : une loss qui baisse n'est donc pas un accident du backward. Depuis le terminal, la même expérience se lance avec python -m model.gpt_train --pos rope, --ffn swiglu, --norm rms, --kv-heads 2 ou --tie-weights. Une seule option à la fois, sinon tu ne sauras pas laquelle a compté.
@LANG python
@CODE
:::
from model.gpt_train import train_gpt

texte = "le chat dort sur le tapis. le chien court dans le jardin.\n" * 30
commun = dict(steps=60, d_model=16, n_heads=4, n_layers=1, block=16,
              batch=4, seed=0, sample=False, eval_windows=8)
mesures = {}
for nom, variante in [("baseline", {}), ("rope", {"pos": "rope"})]:
    modele, _, resultat = train_gpt(texte, **commun, **variante)
    mesures[nom] = (round(resultat.val_loss_end, 3), modele.parameter_count())
assert mesures["rope"][1] == mesures["baseline"][1] - 16 * 16
print(mesures)
:::
@EXPERIMENT
Relance la comparaison avec seed=1 et seed=2. Note les six losses puis les trois différences RoPE−baseline. Examine leur moyenne et dispersion. Reprends ensuite l'expérience avec de vrais documents réservés.
@EXERCISE
Choisis une autre variante (ffn="swiglu" ou n_kv_heads=2 avec n_heads=4) et refais la comparaison sur trois graines. Rédige trois phrases : ce qui a été mesuré, le résultat, et ce que tu ne peux pas conclure.
@BUILD
Ajoute la meilleure variante à ton plan d'expérience du niveau 12. Dans le rapport, garde la configuration exacte, les graines, les deux loss de validation et le nombre de paramètres. tests/test_modern_training.py montre comment le dépôt vérifie chaque gradient.
@QUESTION
La variante gagne 0,01 nat sur une graine, mais deux graines de la baseline diffèrent déjà de 0,03 nat. Que conclure ?
@CORRECT
Mesurer des écarts appariés sur plusieurs graines
@WRONG
- Conclure au gain : 0,01 est strictement positif
- Conclure à l’égalité : 0,03 dépasse 0,01
- Choisir la meilleure graine de chaque configuration
@EXPLANATION
Il faut étudier les différences appariées : une petite différence peut être stable si les fluctuations des deux modèles sont communes. Avec une seule paire, la variabilité de cette différence reste inconnue. Choisir la graine favorable sélectionnerait le résultat voulu au lieu de le mesurer.
