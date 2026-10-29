# Épreuve finale : mon modèle, mes preuves

Le but est de construire et entraîner un petit GPT, puis d'expliquer ses résultats. Le projet est réalisable en NumPy sur CPU. Ni MoE, ni modèle multimodal, ni assistant général ne sont exigés pour ce premier objectif.

## Livrables

1. **Code personnel** : eleve.py complété et versionné, moteur et dépendances. Écris ce que tu as fait seul et les aides consultées. Le mode correction ne valide pas cette partie.
2. **Données** : sources et conditions d'utilisation, documents train/validation/test, normalisation, doublons et couverture de l'alphabet. Le tokenizer est appris seulement sur train. Relis les quasi-doublons ; des hashes différents ne garantissent pas des exemples indépendants.
3. **Contrôles** : rapport des 12 TP, formes, causalité, gradient vérifié numériquement et rechargement. Explique à voix haute le décalage des cibles, le masque et le chemin d'un gradient sans ouvrir la correction.
4. **Débogage** : surapprentissage volontaire d'un minuscule lot ; dis pourquoi ce n'est pas une mesure de généralisation. Montre au moins une erreur rencontrée et sa résolution.
5. **Baseline entraînée** : configuration, graine, nombre de tokens vus, machine et durée. Donne les courbes train/validation, les baselines uniforme et bigramme sur les mêmes fenêtres et le même tokenizer. Si le GPT ne les bat pas, conserve les résultats et analyse l'échec.
6. **Checkpoint** : mêmes logits après rechargement, tokenizer archivé, génération à invite et graine fixées avant tirage. Les poids doivent avoir changé dans embeddings, attention et FFN.
7. **Variation** : change seulement largeur OU profondeur ; mêmes textes, split, fenêtre, batch et pas. Documente le nombre de paramètres et le coût. Compare plusieurs graines appariées si tu veux discuter la variabilité. Choisis sur validation, puis consulte le test réservé pour le modèle retenu ; si tu l'utilises pour choisir à nouveau, il faut un nouveau test.
8. **Fiche d'expérience** : hypothèse, méthode, résultats, limites, prochaine question. Une perte par token ne se compare pas directement à une autre tokenisation. Un petit GPT qui génère des motifs n'est pas une preuve de réponse fiable.

## Grille de relecture /20

- Fondations et explications : /4 — formes, chaîne, signes, accumulation des gradients.
- Modèle construit : /4 — fonctions personnelles et decoder complet entraînable.
- Exactitude : /4 — contrôles numériques, causalité et sauvegarde, cas limites expliqués.
- Autonomie et expérimentation : /4 — reconstruction d'une brique sans correction, diagnostic et variation contrôlée.
- Évaluation et reproductibilité : /4 — données réservées, baselines, provenance et limites.

Chaque axe : 0 absent, 1 incomplet, 2 exécuté avec aide mais peu expliqué, 3 expliqué et contrôlé, 4 reconstruit/expliqué sur un cas nouveau. Fais relire le projet avec cette grille. Aucun compteur automatique du site n'attribue 20/20 ; la relecture doit examiner le code, les données et les explications.

## Ajustement et prolongements

Le laboratoire principal propose le BPE, SFT et LoRA après ce premier projet. Sa loss porte sur la réponse et le format est mono-tour, terminé au saut de ligne. Pour le SFT, joins les tailles/hashes des splits, les exemples rejetés ou tronqués, puis des questions réservées, reformulations et demandes sans réponse dans les données. Le plan sépare automatiquement par groupes ou accepte des fichiers explicites ; un diagnostic sur train doit être déclaré tel quel. Le test final se demande séparément.

Pour prolonger le projet, octet_bpe.py fournit un BPE octets, port_torch.py contrôle les logits et gradients du même decoder, et generer.py utilise ton checkpoint en CLI/API locale. Lis EXTENSIONS.md et BANC_FR.md pour les commandes, le banc documentaire et les questions réservées. Le laboratoire entraîne aussi RMSNorm. Un chronométrage CPU/GPU sur le même calcul reste à réaliser sur le matériel compatible dont tu disposes. Ce sont des extensions, avec leurs mesures propres. La mémoire lexicale, le scan SSM et les patches du cours gardent leurs limites actuelles : ils ne constituent pas un agent, un Mamba complet ou un modèle multimodal entraîné.
