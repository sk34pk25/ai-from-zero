# Vérification sur appareils réels

La CI couvre Chromium, Firefox et WebKit avec plusieurs fenêtres. WebKit automatisé n’est pas un iPhone/iPad physique. Cette recette reste à réaliser sur les appareils effectivement utilisés ; aucune case ci-dessous n’est déclarée réussie automatiquement.

| Appareil / navigateur / version | Date | Résultat | Problème observé |
| --- | --- | --- | --- |
| PC Windows / navigateur actuel | À renseigner | À tester | |
| Mac / Safari actuel | À renseigner | À tester | |
| Android / Chrome actuel | À renseigner | À tester | |
| iPhone / Safari actuel | À renseigner | À tester | |
| iPad / Safari actuel | À renseigner | À tester | |

1. Ouvrir accueil, une leçon, Atelier, Expériences et Mon espace en portrait/paysage. Vérifier texte agrandi et zoom 200 %, menu, recherche et absence de débordement de la page.
2. Parcourir au clavier lorsque disponible : sélecteur du parcours, blocs de code défilants, indices repliés, boutons et champs. Vérifier le focus visible et son maintien après un changement de parcours.
3. Télécharger puis ouvrir mon-llm.zip dans le gestionnaire de fichiers. Les documents sont lisibles sur mobile ; les TP locaux demandent Python/NumPy sur un environnement approprié.
4. Connecter le compte propriétaire, écrire une note, utiliser le clavier logiciel, tourner l’appareil et recharger. Importer controles.json dans Mon espace puis exporter une sauvegarde : les explications et l’historique du playground doivent rester distincts.
5. En ligne, télécharger volontairement les ressources depuis Mon espace. Couper le réseau et relire des cours. Ne pas attendre l’exécution Python avant le chargement réseau de Pyodide/NumPy. Revenir en ligne et vérifier l’état de synchronisation.
6. Tester une invite courte du playground, l’arrêt du calcul et un changement de modèle. Conserver les performances propres à l’appareil ; ne pas les comparer à un run serveur comme s’il s’agissait de la même mesure.

Conserver la version du site et du navigateur avec chaque retour. Un appareil ancien sans les fonctions nécessaires peut rester limité ; vérifier sa version plutôt que promettre une compatibilité universelle.

## Compléments après la présentation visuelle

- Au premier chargement lent, le titre de la leçon reçoit le focus, sauf si une autre interaction a commencé.
- Le mode guidé ouvre les explications avant le code et le quiz. Révision visuelle/rechargement/retour au mode guidé conservent un brouillon.
- Les blocs de code défilants se parcourent au clavier.
- Bloquer uniquement glance.json laisse le cours lisible ; la reprise conserve les réponses et la saisie.
- Vérifier DOSSIER_MODELE.md dans le ZIP et l’interface Atelier.
