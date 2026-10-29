# Huit pannes à diagnostiquer

Pour chaque panne : écris une hypothèse, un test qui la distingue d’une autre cause, puis le résultat après correction. Les cartes de la page Atelier donnent des indices et une solution repliée. Refais ensuite le diagnostic avec d’autres nombres.

1. **Recopie des entrées.** x=[4,4,9] et y=[4,4,9] donnent une loss qui baisse très vite. La tâche attendue utilise y=[4,9,4]. Vérifie les indices avant de modifier la taille du réseau.
2. **Softmax instable.** exp([1000,1000]) déborde. Soustrais le maximum, puis vérifie [0,5 ; 0,5] ET un cas non uniforme. Une sortie finie n’est pas une preuve de bonne distribution.
3. **Échelle absente.** Pour d_k=4, les scores [0,4] deviennent [0,2]. Les deux versions sont causales. Une valeur attendue distingue leurs poids ; un gradient-check seul ne le fait pas.
4. **Futur visible.** Modifie uniquement le dernier token ou la dernière valeur. Les sorties précédentes doivent rester identiques. Une loss très basse peut signaler une fuite des cibles plutôt qu’un meilleur modèle.
5. **Gradient perdu.** Le graphe (x+x)+(x+x) donne dx=2 au lieu de 4. Vérifie les accumulations et les objets partagés. Une même valeur numérique n’est pas forcément une même identité dans le graphe.
6. **Têtes mélangées.** Une sortie conserve (B,T,D), mais reshape et permutation inverses sont incorrects. Numérote les composantes et reconstruis chaque tête indépendamment.
7. **Pas effectif multiplié.** Après quatre micro-batches, la mise à jour est quatre fois trop grande. Divise par le nombre de micro-batches de même taille ; pondère par le nombre de cibles si les tailles diffèrent. Ne fais le pas de l’optimiseur qu’après leur accumulation.
8. **Question notée en SFT.** Le masque d’une paire devrait couvrir seulement les cibles de réponse. Vérifie les IDs de part et d’autre du marqueur, le décalage cible et la première cible notée. Une fusion BPE ne doit pas traverser la frontière question/réponse.

Les tests de mutation du dépôt vérifient que plusieurs de ces erreurs volontaires sont bien refusées. Ils ne remplacent pas ton diagnostic ni un essai sur des données nouvelles.
