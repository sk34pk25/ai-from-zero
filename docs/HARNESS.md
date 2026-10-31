# Construire son harness d’agent de A à Z

Suite du parcours de modèle : 32 leçons, huit TP cumulatifs, un projet local inspectable. Les contrôles d’infrastructure, de modèle et de pédagogie restent distincts.

## Module 1 — Du modèle au contrat

Un protocole d’action validé avant toute exécution.

TP 1 : Messages et décisions. Fonctions : message, parse_action.

- h1.1 — Ce qui décide, ce qui exécute : Après le checkpoint, il manque un programme qui fasse agir le modèle. La réponse « je vais calculer » ne réalise aucun calcul. Cette étape pose les trois acteurs que tu vas coder.
- h1.2 — Messages, rôles et confiance : Un fichier peut contenir « ignore les règles ». Le lire ne doit pas donner à ce texte le pouvoir de modifier les permissions de l’agent.
- h1.3 — Un protocole JSON strict : Le moteur ne doit pas chercher approximativement un nom d’outil dans une phrase. Un contrat strict rend les erreurs visibles et testables.
- h1.4 — Brancher une interface de modèle : La boucle ne doit pas être réécrite pour chaque modèle. Elle doit recevoir une interface stable et savoir d’où viennent les sorties.

## Module 2 — Outils et permissions

Un registre limité, avec calcul, lecture et propositions de création.

TP 2 : Construire les outils. Fonctions : validate_args, calculate, safe_path.

- h2.1 — Le registre des outils : Un nom inventé par le modèle ne doit pas devenir une fonction Python. Le registre fixe ce que ton agent sait réellement faire.
- h2.2 — Calculer sans exécuter du code libre : Une calculatrice ne doit pas devenir un interpréteur Python général. Le texte d’un modèle reste une entrée à contrôler.
- h2.3 — Lire dans un espace de travail choisi : Un assistant qui lit des fichiers doit savoir lesquels il est autorisé à ouvrir. Le nom proposé par le modèle ne fixe pas cette frontière.
- h2.4 — Proposer puis autoriser un effet : Une intention d’écriture doit pouvoir être examinée avant d’agir. L’autorisation d’un outil ne remplace pas l’accord sur une action précise.

## Module 3 — Une boucle qui sait s’arrêter

Une exécution bornée, avec observations, erreurs et reprise d’accord.

TP 3 : Assembler la boucle. Fonctions : stop_reason, tool_observation, call_key.

- h3.1 — Tours, appels et conditions d’arrêt : Une boucle while True n’est pas une autonomie fiable. Un modèle qui répète la même demande doit rencontrer une limite lisible.
- h3.2 — Relier chaque observation à son appel : Deux outils peuvent répondre « 5 ». Sans identifiant, le moteur ne sait pas quelle question chaque résultat résout.
- h3.3 — Erreurs et nouvelles tentatives bornées : Un réseau coupé, une division par zéro et un JSON invalide demandent des diagnostics différents. Les confondre pousse à modifier le mauvais composant.
- h3.4 — Reprendre sans doubler un effet : Rejouer automatiquement une création après une panne peut produire un doublon. La reprise doit connaître ce qui a été demandé et ce qui est confirmé.

## Module 4 — Contexte et mémoire

Une demande conservée, des échanges compacts et des souvenirs sourcés.

TP 4 : Gérer contexte et mémoire. Fonctions : context_window, merge_memory.

- h4.1 — Mesurer le contexte disponible : Un contexte long dans le harness ne donne pas une fenêtre plus grande au modèle. Les deux limites doivent être visibles.
- h4.2 — Réduire sans casser les échanges : Couper une liste de messages par sa moitié peut garder un résultat d’outil sans l’action qui l’explique. La réduction doit respecter les relations.
- h4.3 — Une mémoire sourcée et corrigeable : Une mémoire qui accumule des phrases sans origine devient difficile à corriger. Elle peut aussi conserver une instruction malveillante comme un fait.
- h4.4 — Persister et rappeler avec SQLite : Un redémarrage doit pouvoir retrouver l’état de travail. La persistance ne doit pas exposer la base au propre outil de lecture de l’agent.

## Module 5 — Fiabilité et diagnostic

Un journal vérifiable et un banc de régressions qui conserve les échecs.

TP 5 : Vérifier les traces. Fonctions : event_hash, recover_pending, evaluate_case.

- h5.1 — Journaliser des événements utiles : Un message final ne raconte pas forcément ce qui s’est passé. Le journal doit permettre de reconstruire les décisions du moteur.
- h5.2 — Tester une panne au mauvais moment : Les pannes intéressantes surviennent entre le début d’un effet et son enregistrement final. C’est précisément là qu’un rejeu naïf devient dangereux.
- h5.3 — Construire des contre-exemples : Le chemin heureux ne teste pas les frontières. Un bon banc essaie aussi de faire échouer le moteur de façon contrôlée.
- h5.4 — Lire un rapport sans se raconter d’histoires : Un rapport « dix succès » ne veut rien dire sans savoir quels essais, quel modèle et quels critères ont été utilisés.

## Module 6 — Ton modèle devient un contrôleur

Un adaptateur réel, une sonde et un entraînement au protocole mesurable.

TP 6 : Brancher et mesurer le modèle. Fonctions : format_prompt, probe_summary, paired_delta.

- h6.1 — Sonder avant d’autoriser des outils : Le modèle du cours prédit du texte. Avant d’en faire un contrôleur, il faut mesurer s’il sait produire une décision exploitable.
- h6.2 — Retrouver les poids et le tokenizer du cours : Changer le tokenizer ou oublier une partie de l’instruction modifie le problème. Le lien avec ton modèle doit être vérifiable jusque dans les logits.
- h6.3 — Apprendre le protocole avec une perte masquée : La capacité à émettre du JSON ne vient pas du harness. Cette étape fournit une expérience d’apprentissage explicite sur ton moteur NumPy.
- h6.4 — Comparer des capacités sur des cas réservés : Un joli exemple après entraînement ne suffit pas à choisir un contrôleur. Les comparaisons doivent conserver leurs cas et leurs limites.

## Module 7 — Compétences et tâches longues

Des procédures versionnées, un enfant borné et une file locale explicite.

TP 7 : Étendre sans élargir les droits. Fonctions : select_skills, delegation_budget, due_jobs.

- h7.1 — Une compétence est une procédure : Répéter les mêmes étapes dans chaque prompt gaspille du contexte. Une procédure peut être chargée à la demande et corrigée séparément.
- h7.2 — Choisir et améliorer une procédure : Charger toutes les procédures en permanence remplit la fenêtre. Un catalogue et un sélecteur donnent une première méthode inspectable.
- h7.3 — Déléguer avec un budget partagé : Déléguer ne doit pas créer des ressources ou des permissions infinies. Une sous-tâche garde un coût et une frontière explicite.
- h7.4 — Planifier une file sans rejeu automatique : Une tâche longue doit garder son état quand le processus s’arrête. L’échéance ne doit pas suffire à rejouer un effet déjà commencé.

## Module 8 — Utiliser, exposer et livrer

Un agent local utilisable, une passerelle limitée et un dossier reproductible.

TP 8 : Livrer et expliquer son harness. Fonctions : validate_request, export_trace, success_metrics.

- h8.1 — Une CLI qui montre ce qu’elle fait : Le projet devient un outil lorsque tu peux le lancer, comprendre son statut, arrêter et reprendre son travail sans modifier son code à chaque fois.
- h8.2 — Une passerelle locale authentifiée : Un autre programme peut vouloir soumettre une tâche à ton agent. Il faut définir cette interface aussi précisément que celle des outils.
- h8.3 — Installer, arrêter et sauvegarder : Un programme qui fonctionne une fois dans ton terminal doit encore pouvoir être reproduit et repris sur ta machine.
- h8.4 — Livrer et expliquer son agent : La dernière étape consiste à montrer ce que ton agent fait réellement et comment tu l’as construit, avec ses limites documentées.

## Références

- [Hermes Agent : architecture officielle](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture)
- [Hermes Agent : référence de source examinée](https://github.com/NousResearch/hermes-agent/tree/6bb377a51d5c8e279a7a5e34d717d653d421d064)
- [Python : subprocess et considérations de sécurité](https://docs.python.org/3/library/subprocess.html#security-considerations)
