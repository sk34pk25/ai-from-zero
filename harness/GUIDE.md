# Guide des huit TP de harness

Compléter harness/eleve.py. Les fonctions sont testables séparément ; la boucle appelle ton module. Les fonctions de correction.py servent à comparer après ton essai, avec l’origine de la référence conservée.

## TP 1 — Messages et décisions

Un protocole d’action validé avant toute exécution.

Fonctions : `message`, `parse_action`.

Leçons : h1.1, h1.2, h1.3, h1.4.

- Je distingue modèle, harness et outil sur une trace.
- Je rejette un JSON ambigu et une action inconnue.
- Je décris ce que mon modèle doit encore apprendre.

```sh
python -m harness.verifier --tp 1
python -m harness.verifier --module correction --tp 1
```

Méthode : écrire un exemple à la main, compléter la fonction, lancer le contrôle, puis changer les valeurs et expliquer l’échec d’une version fautive. Les contrôles du TP sont lisibles dans verifier.py.

## TP 2 — Construire les outils

Un registre limité, avec calcul, lecture et propositions de création.

Fonctions : `validate_args`, `calculate`, `safe_path`.

Leçons : h2.1, h2.2, h2.3, h2.4.

- Je rejette un argument inconnu avant l’exécution.
- Je teste calcul, traversée de dossier et lien symbolique.
- Une écriture nécessite une proposition exacte et un accord.

```sh
python -m harness.verifier --tp 2
python -m harness.verifier --module correction --tp 2
```

Méthode : écrire un exemple à la main, compléter la fonction, lancer le contrôle, puis changer les valeurs et expliquer l’échec d’une version fautive. Les contrôles du TP sont lisibles dans verifier.py.

## TP 3 — Assembler la boucle

Une exécution bornée, avec observations, erreurs et reprise d’accord.

Fonctions : `stop_reason`, `tool_observation`, `call_key`.

Leçons : h3.1, h3.2, h3.3, h3.4.

- Je distingue nombre de tours et nombre d’outils exécutés.
- Chaque résultat garde son identifiant et sa provenance.
- Je démontre un arrêt et un rejeu sans double effet.

```sh
python -m harness.verifier --tp 3
python -m harness.verifier --module correction --tp 3
```

Méthode : écrire un exemple à la main, compléter la fonction, lancer le contrôle, puis changer les valeurs et expliquer l’échec d’une version fautive. Les contrôles du TP sont lisibles dans verifier.py.

## TP 4 — Gérer contexte et mémoire

Une demande conservée, des échanges compacts et des souvenirs sourcés.

Fonctions : `context_window`, `merge_memory`.

Leçons : h4.1, h4.2, h4.3, h4.4.

- Je distingue caractères, tokens et fenêtre du modèle.
- Je garde ensemble appel et observation en réduisant le contexte.
- Je corrige un souvenir sans perdre sa provenance.

```sh
python -m harness.verifier --tp 4
python -m harness.verifier --module correction --tp 4
```

Méthode : écrire un exemple à la main, compléter la fonction, lancer le contrôle, puis changer les valeurs et expliquer l’échec d’une version fautive. Les contrôles du TP sont lisibles dans verifier.py.

## TP 5 — Vérifier les traces

Un journal vérifiable et un banc de régressions qui conserve les échecs.

Fonctions : `event_hash`, `recover_pending`, `evaluate_case`.

Leçons : h5.1, h5.2, h5.3, h5.4.

- Je détecte un journal modifié ou une reprise incompatible.
- Je teste un effet interrompu sans le rejouer.
- Je sépare succès du banc et capacité d’un modèle.

```sh
python -m harness.verifier --tp 5
python -m harness.verifier --module correction --tp 5
```

Méthode : écrire un exemple à la main, compléter la fonction, lancer le contrôle, puis changer les valeurs et expliquer l’échec d’une version fautive. Les contrôles du TP sont lisibles dans verifier.py.

## TP 6 — Brancher et mesurer le modèle

Un adaptateur réel, une sonde et un entraînement au protocole mesurable.

Fonctions : `format_prompt`, `probe_summary`, `paired_delta`.

Leçons : h6.1, h6.2, h6.3, h6.4.

- Je compare la sortie de mon checkpoint à une fixture sans les confondre.
- Je mesure la couverture du vocabulaire et la fenêtre du modèle.
- Je réserve des familles de tâches avant entraînement et comparaison.

```sh
python -m harness.verifier --tp 6
python -m harness.verifier --module correction --tp 6
```

Méthode : écrire un exemple à la main, compléter la fonction, lancer le contrôle, puis changer les valeurs et expliquer l’échec d’une version fautive. Les contrôles du TP sont lisibles dans verifier.py.

## TP 7 — Étendre sans élargir les droits

Des procédures versionnées, un enfant borné et une file locale explicite.

Fonctions : `select_skills`, `delegation_budget`, `due_jobs`.

Leçons : h7.1, h7.2, h7.3, h7.4.

- Je charge une procédure comme un document sans lui donner de nouveaux droits.
- Je borne le budget et les outils d’un agent enfant.
- Je conserve les tâches interrompues sans les rejouer automatiquement.

```sh
python -m harness.verifier --tp 7
python -m harness.verifier --module correction --tp 7
```

Méthode : écrire un exemple à la main, compléter la fonction, lancer le contrôle, puis changer les valeurs et expliquer l’échec d’une version fautive. Les contrôles du TP sont lisibles dans verifier.py.

## TP 8 — Livrer et expliquer son harness

Un agent local utilisable, une passerelle limitée et un dossier reproductible.

Fonctions : `validate_request`, `export_trace`, `success_metrics`.

Leçons : h8.1, h8.2, h8.3, h8.4.

- Je sais utiliser mon module élève depuis la CLI.
- La passerelle locale authentifie et borne chaque requête.
- Mon dossier distingue code, modèle, mesures et observation humaine.

```sh
python -m harness.verifier --tp 8
python -m harness.verifier --module correction --tp 8
```

Méthode : écrire un exemple à la main, compléter la fonction, lancer le contrôle, puis changer les valeurs et expliquer l’échec d’une version fautive. Les contrôles du TP sont lisibles dans verifier.py.

## Du code élève au moteur

Les TP 1 à 5 interviennent dans les messages, le registre, les outils, la compaction et le journal du Runner. Les TP 6 à 8 s’emploient dans les sondes, extensions, requêtes et rapports. Certaines infrastructures (HTTP, SQLite, adaptateurs) sont fournies pour rester inspectables sans reconstruire une bibliothèque système. Étudier puis modifier leurs fonctions fait partie des leçons.

La CLI utilise eleve par défaut. Si un TP n’est pas terminé, NotImplementedError explique la brique manquante. Une correction copiée doit être déclarée comme une aide ; sa présence n’atteste pas une reconstruction autonome.
