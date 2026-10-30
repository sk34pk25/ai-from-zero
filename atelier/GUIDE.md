# Construire ton petit GPT : 12 TP progressifs

Lis d'abord INSTALLATION.md. Ouvre `eleve.py` : les interfaces sont présentes, leurs corps sont à écrire. `correction.py` est une référence séparée ; essaie d'abord les contrôles et rédige ton explication avant de la consulter. Si tu consultes le corrigé, refais ensuite la brique dans un fichier vierge avec des exemples différents.

Le projet est autonome après téléchargement : il ne dépend pas du dossier `model/`. `moteur.py` fournit des primitives de tableaux différentiables, pas un modèle de langage. Tu écris le tokenizer, le graphe scalaire d'initiation, l'attention, les blocs, le decoder et le pas AdamW. `commun.py` initialise les tableaux et lit/écrit les fichiers ; `entrainer.py` appelle TES fonctions. Tu peux remplacer ensuite le moteur de tableaux en conservant ses tests.

Le tronc commun suit les niveaux **0 à 4, la leçon 13.3 sur les données, puis 12.1 à 12.6 et 12.10 à 12.12 pour mesurer et livrer ton modèle**. Les niveaux 5 et 6 étudient variantes et contraintes ; MoE, SSM et multimodalité sont des extensions. Les durées des pages sont des estimations de lecture/activité, pas une garantie de maîtrise. Prévois du temps pour les essais et le projet final.

Pour chaque TP : écris d'abord les formes et un exemple à la main, complète le code, lance `python verifier.py --tp N`, explique un cas limite. Les tests sont publics ; leur réussite ne certifie ni indépendance du code ni compréhension.

Tu peux commencer certains TP avant les autres : `python verifier.py --tp 5` contrôle uniquement l’autograd scalaire au niveau 1. Les TP 1–3 utilisent les niveaux 2–3 ; `--jusqua N` reste cumulatif. Lis FONDATIONS.md avant l’autograd sur tableaux et PANNES.md pour diagnostiquer un échec. Mon espace accepte controles.json et distingue contrôles publics, explications déclarées et leçons lues.

## TP 1 — Tokenizer réversible (2.1, 2.3, 2.5)

Écris `vocabulaire`, `encoder`, `decoder`. Le vocabulaire est un dictionnaire de caractères distincts triés vers des entiers contigus à partir de zéro. Le décodage inverse la table et concatène, sans supprimer les espaces ni accents. Pour « abba », attends [0,1,1,0] puis le texte d'origine. Un caractère absent doit lever KeyError ; ne reconstruis pas un vocabulaire pendant encode.

Contrôle : `python verifier.py --tp 1`. Essaie aussi une chaîne vide et un accent. Explique pourquoi modifier l'ordre des identifiants après entraînement change le sens des sorties.

## TP 2 — Entrée et cible (2.11, 3.1, 3.3)

Écris `fenetres(ids,taille)` qui renvoie deux tableaux entiers (N,T). Pour [4,4,9,4] et T=2, x vaut [[4,4],[4,9]], y vaut [[4,9],[9,4]]. N = len(ids)-T : il faut une cible après la dernière entrée. Refuse T<1 et un texte trop court. Le lanceur échantillonnera ensuite des fenêtres au lieu de toutes les stocker.

Contrôle : `--tp 2`. Dessine le décalage et explique pourquoi x=y créerait une tâche de recopie.

## TP 3 — Softmax et entropie croisée (3.5, 3.6)

Écris `softmax` sur le dernier axe. Soustrais le maximum de chaque ligne, exponentie puis divise par la somme de cette ligne. Préserve les axes avec keepdims. Écris `entropie(z,y)` sur des logits (N,V) et cibles (N,) : moyenne de log(sum(exp(z_stable))) moins le score stable de la cible. Ne prends pas le log de probabilités déjà arrondies.

**Exemple chiffré, à refaire à la main.** Logits z = [1, 2, 3], cible 2.
1. On soustrait le maximum 3 : [-2, -1, 0]. Les probabilités ne changent pas, mais exp ne déborde plus.
2. exp donne [0,1353 ; 0,3679 ; 1] ; leur somme vaut 1,5032.
3. softmax = [0,0900 ; 0,2447 ; 0,6652] ; la somme fait bien 1.
4. Entropie croisée = log(somme des exp) − score décalé de la cible = log(1,5032) − 0 = 0,4076, c'est-à-dire −log(0,6652).

Contrôle : `--tp 3`. Deux logits 1000 donnent [.5,.5], l'uniforme sur V=5 donne log(5). Explique pourquoi une loss est en nats et n'est comparable entre tokenizers qu'après passage à une unité commune, comme les nats par caractère.

## TP 4 — Différences finies (0.20, 1.10, 1.11)

Écris `derivee(f,x,eps)` = [f(x+eps)-f(x-eps)]/(2eps). Pour (3x+1)² en x=1, attends 24. Pour x² en -2, attends -4. Compare quelques epsilon : trop grand modifie la pente locale, trop petit amplifie les erreurs numériques.

Contrôle : `--tp 4`. Cette méthode est un juge ponctuel, pas l'algorithme d'apprentissage de millions de poids.

## TP 5 — Construire un autograd scalaire (1.12, 1.15)

Une classe groupe des données et des méthodes. `w=Valeur(3)` crée un objet ; `w.data` est sa valeur ; `w.grad` accumule sa sensibilité. Implémente `__init__`, `__add__`, `__mul__`, `backward`.

Chaque opération crée un résultat et retient ses parents. L'addition distribue le gradient de sortie aux deux parents. Le produit distribue ce gradient multiplié par la valeur de l'autre parent. Utilise `+=` car un même objet peut apparaître deux fois. backward parcourt les parents avant les enfants pour établir un ordre topologique, pose 1 sur le résultat scalaire puis exécute les règles locales en ordre inverse. Un ensemble d'identités évite de visiter deux fois le même nœud ; il ne doit pas effacer les deux contributions d'une opération.

Exemple de contrôle à lancer après avoir complété la classe :

```python
from eleve import Valeur
w = Valeur(3)
z = w * w + w
z.backward()
assert z.data == 12
assert w.grad == 7
```

Contrôle : `--tp 5`. Pour w*w+w en w=3, attends 7. Pour u=x*x puis u+u en x=-2, attends -8. Recrée le graphe à chaque nouvel exemple. Dessine ces deux graphes sans lire le code.

## TP 6 — Passer aux tableaux (0.15, 1.15)

Écris `reduire_gradient(g,shape)` : somme d'abord les axes ajoutés à gauche ; pour chaque dimension de taille 1 du paramètre, somme l'axe correspondant en le gardant. Termine par reshape(shape). Pour g=(2,4,3) rempli de uns et un paramètre (1,3), attends [[8,8,8]].

Lis ensuite `moteur.py` : matmul propage dX=dY@Wᵀ et dW=Xᵀ@dY, en réduisant le broadcasting ; embedding utilise np.add.at pour les tokens répétés ; LayerNorm réduit les statistiques du dernier axe et calcule son backward analytique. Relie leurs variables à une différence finie sur une seule coordonnée. Le moteur complet est fourni comme ensemble de primitives ; son code est lisible et testé, pas une brique LLM préfabriquée.

**Exemple pas à pas.** g a la forme (2, 4, 3) et ne contient que des 1 ; le paramètre a la forme (1, 3).
1. g a un axe de plus que le paramètre : on somme l'axe 0, il reste (4, 3) rempli de 2.
2. La première dimension du paramètre vaut 1 mais celle de g vaut 4 : on somme cet axe en le gardant, on obtient (1, 3) rempli de 8.
3. Chaque coefficient du paramètre a été réutilisé 2 × 4 = 8 fois par le broadcasting : il reçoit donc 8 contributions.

Contrôle : `--tp 6`. Explique où le gradient de deux lectures du même token s'additionne.

## API des tableaux utilisée dans les TP suivants

`Tensor(array)` suit le gradient. `.data` donne un tableau NumPy, `.grad` son gradient. Utilise `a+b`, `a*b`, `a.matmul(b)`, `.reshape(...)`, `.permute(axes)`, `.gelu()`, `.softmax(axis=-1)`. `embedding(table,ids)`, `layernorm(x,gain,biais)` et `cross_entropy(logits,cibles)` sont disponibles dans moteur.py. Pour que le backward reste relié, garde les opérations sur Tensor ; calculer un résultat sur `.data` puis le réemballer perd les parents. `.data.shape` peut servir à lire une dimension. Ne réutilise pas un ancien graphe après une mise à jour des poids.

## TP 7 — Attention causale entraînable (4.2 à 4.6)

Écris `attention(q,k,v)` avec q,k,v de forme (B,H,T,Dh). Scores = QKᵀ/sqrt(Dh), de forme (B,H,T,T). Transpose les deux derniers axes de K. Ajoute une matrice triangulaire supérieure à -1e9, zéro ailleurs, AVANT softmax. La sortie vaut softmax(scores)@V et retrouve (B,H,T,Dh). Le masque est constant : il ne reçoit pas de gradient.

**Exemple chiffré.** Une tête, T = 2, Dh = 1, avec q = [1, 1], k = [0, 2], v = [10, 20].
- Position 0 : elle ne voit que k₀, son poids vaut 1, la sortie vaut v₀ = 10.
- Position 1 : scores = [1×0, 1×2] / √1 = [0, 2] ; softmax ≈ [0,119 ; 0,881] ; sortie ≈ 0,119×10 + 0,881×20 = 18,81.
- Le masque ajouté vaut [[0, −1e9], [0, 0]] : seule la case « position 0 regarde la position 1 » est bloquée.

Contrôle : `--tp 7`. La position zéro doit rendre V à la position zéro. Modifier la dernière valeur ne doit pas changer les sorties précédentes. Le correcteur compare aussi dL/dQ à une différence finie : réussir une shape seule ne suffit pas.

## TP 8 — Multi-têtes (4.7)

Écris `multi_tetes(x,p,prefix,heads)`. x=(B,T,D) ; les poids p[prefix+'wq'], wk, wv, wo sont (D,D). Projette Q,K,V, reshape en (B,T,H,D/H), permute en (B,H,T,D/H), appelle TON attention, puis fais l'inverse des permutations et projette par Wo. D doit être divisible par H.

**Suivre les formes.** B = 1, T = 3, D = 4, H = 2 donc D/H = 2 :
x (1, 3, 4) → @Wq → (1, 3, 4) → reshape (1, 3, 2, 2) → permute (0, 2, 1, 3) → (1, 2, 3, 2) → attention → (1, 2, 3, 2) → permute (0, 2, 1, 3) → (1, 3, 2, 2) → reshape (1, 3, 4) → @Wo → (1, 3, 4).
Écris cette chaîne dans un commentaire au-dessus de ton code avant de le taper.

Contrôle : `--tp 8`. Un mauvais reshape peut conserver la shape tout en mélangeant les valeurs ; vérifie une petite grille numérotée à la main. Les gradients doivent traverser les projections.

## TP 9 — Bloc pré-norme (4.8 à 4.11)

Écris `bloc(x,p,prefix,heads)` : h=x+multi_tetes(LayerNorm(x)), puis y=h+GELU(LayerNorm(h)@W1)@W2. Les gains g1/g2 et biais b1/b2 sont (D,), W1=(D,4D), W2=(4D,D). Les deux résidus additionnent des valeurs, ils ne concatènent pas des listes.

Contrôle : `--tp 9`. Si Wo et W2 valent zéro, le bloc doit être exactement l'identité. Explique pourquoi les normes sont AVANT les sous-blocs.

## TP 10 — Decoder et loss (4.12 à 4.14)

Écris `logits(ids,p,config)` et `perte(z,y)`. IDs=(B,T). Additionne embedding tok et embedding pos (indices de 0 à T-1). Exécute les couches i avec le préfixe f'{i}.'. Applique LayerNorm finale, puis la tête (D,V) : la sortie est (B,T,V). Refuse T supérieur à config['block']. perte aplatit logits et cibles pour cross_entropy. La boucle lui donne des cibles déjà décalées ; ne décale pas une seconde fois.

**Suivre les formes.** B = 2, T = 5, D = 16, V = 30 : embedding des tokens (2, 5, 16) + embedding des positions (5, 16), qui se répète sur le batch → (2, 5, 16) → couches → LayerNorm → @tête (16, 30) → logits (2, 5, 30). Pour la loss : logits aplatis (10, 30) et cibles aplaties (10,).

Contrôle : `--tp 10`. Vérifie toutes les positions du passé après modification du futur. Le correcteur exige des gradients non nuls dans embeddings, attention, FFN et tête, et une coordonnée d'attention conforme à la différence finie.

## TP 11 — AdamW (1.14, 1.16)

Écris `adamw(params,state,lr,weight_decay)`. params contient des Tensor. Incrémente un compteur t une seule fois par pas. Pour chaque paramètre, m=.9m+.1g et v=.95v+.05g² ; corrige les biais m/(1-.9**t), v/(1-.95**t), retire lr*m_hat/(sqrt(v_hat)+1e-8). Applique séparément la décroissance aux tableaux de rang au moins deux ; le laboratoire laisse les gains et biais sans décroissance.

**Un pas d'AdamW à la main.** Un coefficient de matrice w = 2, gradient g = 0,5, lr = 0,01, weight_decay = 0,1, premier pas (t = 1).
1. m = 0,1 × 0,5 = 0,05 et v = 0,05 × 0,25 = 0,0125.
2. Corrections : m̂ = 0,05 / (1 − 0,9) = 0,5 et v̂ = 0,0125 / (1 − 0,95) = 0,25.
3. Décroissance : w devient 2 × (1 − 0,01 × 0,1) = 1,998.
4. Mise à jour : m̂ / (√v̂ + 1e-8) ≈ 0,5 / 0,5 = 1, donc w devient 1,998 − 0,01 = 1,988.
Remarque : au premier pas, le déplacement vaut environ lr quelle que soit la taille du gradient. C'est pour cela que le compteur t compte.

Contrôle : `--tp 11`. Un test sur deux pas empêche d'oublier le compteur. La boucle remet les gradients à zéro et recrée le forward avant chaque backward. Les checkpoints de l'atelier conservent les poids pour l'inférence ; ils ne promettent pas une reprise exacte AdamW. Pour ce mécanisme supplémentaire, lis les tests de reprise du laboratoire principal.

## TP 12 — Génération et premier entraînement (3.7, 3.9, 3.11, 4.14)

Écris `prochain(z,rng,temperature,top_k)`. À température zéro, argmax sans division. Sinon, limite aux k plus grands logits, divise par température puis tire avec le générateur fourni. Le lanceur conserve uniquement les block derniers IDs à chaque pas, puis décode. Une graine identique doit reproduire le tirage.

**Exemple chiffré de température.** Logits [2, 1, 0] avec top_k = 2 : on garde [2, 1].
- Température 0,5 : [4, 2] → probabilités ≈ [0,881 ; 0,119]. Le premier token domine.
- Température 2 : [1 ; 0,5] → probabilités ≈ [0,622 ; 0,378]. Le tirage devient plus varié.
- Température 0 : on prend directement l'indice 0, sans diviser par zéro.

```bash
python verifier.py --rapport controles.json
python entrainer.py --out runs/baseline
python entrainer.py --d 24 --out runs/largeur24
```

Ces commandes utilisent TES fonctions, pas correction.py. `--module correction` sert uniquement à valider l'installation/référence ; un succès de ce mode ne démontre pas ton autonomie. Les démos répètent des phrases très proches et sont étiquetées comme telles : leur validation sert au débogage, pas à prétendre transférer entre des livres.

Le rapport contient configuration, budget de tokens, hashes du code et des textes, loss sur les mêmes fenêtres, uniforme et bigramme, poids modifiés et égalité après rechargement. Une hausse de loss sur un lot isolé est possible. Si train baisse et validation monte durablement, étudie le surapprentissage. Si les deux restent plates, surapprends d'abord un minuscule lot, vérifie masques/gradients et ne modifie qu'un réglage à la fois.

## TP données puis épreuve finale (13.3, 12.12)

Collecte au moins trois documents distincts avec provenance et conditions d'utilisation. Mets un document par .txt dans documents/. Ajoute volontairement une copie pour voir le diagnostic, puis inspecte les quasi-doublons manuellement.

```bash
python preparer.py documents corpus --seed 0
python entrainer.py --train corpus/train.txt --validation corpus/validation.txt --out runs/personnel
```

preparer.py normalise NFC et les retours ligne, retire les doublons exacts avant la séparation, puis réserve des documents. Le tokenizer n'apprend que sur train. Le rapport compte les caractères inconnus de validation, remplacés par �. Une couverture dégradée peut changer la difficulté de l'évaluation ; ne l'ignore pas. Pour un tokenizer byte-level universel, commence par `list(texte.encode('utf-8'))`, teste le décodage d'accents et d'emoji, puis des fusions ; des suites d'octets générées peuvent être invalides en UTF-8 et demandent une politique documentée.

Quand tu as choisi sur validation, lance une seule mesure finale :

```bash
python evaluer.py --checkpoint runs/personnel/modele.npz --test corpus/test.txt --out runs/personnel/test-final.json
```

Suis ensuite PROJET_FINAL.md. Une variante perdante documentée est recevable. Un test de formes seul ne prouve pas la qualité du langage.

Les nouveaux checkpoints gardent les empreintes normalisées des données, les documents connus et le code. Un fichier train renommé ne devient pas un test. L’évaluateur refuse le recouvrement connu et un code différent ; pour les anciens checkpoints, l’indépendance reste non vérifiable. Les rapports doivent être des fichiers .json neufs : ils ne remplacent ni source ni checkpoint.

Pour aller plus loin : BANC_FR.md décrit le banc à documents réservés et ses questions ; EXTENSIONS.md donne les commandes BPE octets, parité PyTorch et génération/API locale. Le port PyTorch est facultatif, après ton premier GPT NumPy.

## Lectures accompagnées

- [microgpt, Karpathy](https://karpathy.github.io/2026/02/12/microgpt/) : repère données, tokenizer, autograd, blocs, Adam, apprentissage, inférence. Associe chaque partie à ta fonction. La tâche sur des noms est un petit modèle de langage, pas un assistant général.
- [Stanford CS336](https://cs336.stanford.edu/) : relève les livrables de l'assignment Basics et les prérequis universitaires. Compare le protocole données/évaluation à ton projet ; ses besoins de calcul ne sont pas ceux de ton premier GPT CPU.
- [SiLU dans PyTorch](https://docs.pytorch.org/docs/stable/generated/torch.nn.SiLU.html) : écris la formule, puis donne une valeur négative et une valeur supérieure à un. Explique la différence avec la sigmoïde.

Pour chaque lecture, remplis question, baseline, données, budget, résultat annoncé et résultat réellement reproduit chez toi. N'attribue pas au scan réduit ou aux patches les performances d'un modèle publié.
