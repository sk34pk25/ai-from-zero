/** Traces de petits programmes et protocoles expérimentaux, sans exécution arbitraire. */
import { h } from './dom.js';
import { action, cards, chart, lab, matrix, note, slider } from './visual-ui.js';

const PROGRAMS = {
  '0.1': { title: 'Du disque au calcul, puis au résultat', lines: ['texte = disque.lire("corpus.txt")  # schéma conceptuel', 'tokens = tokenizer.encode(texte)', 'resultat = processeur.calculer(tokens)', 'disque.ecrire("poids.npz", resultat)'], states: [
    [['Disque', 'corpus.txt persiste'], ['RAM', 'texte chargé'], ['CPU', 'en attente']],
    [['Disque', 'corpus.txt'], ['RAM', 'texte + IDs [2,0,1]'], ['CPU', 'conversion en IDs']],
    [['RAM', 'poids + activations'], ['CPU', 'produits et sommes'], ['Résultat', 'nouveaux poids en RAM']],
    [['Disque', 'poids.npz persiste'], ['RAM', 'peut être libérée'], ['CPU', 'travail terminé']],
  ] },
  '0.6': { title: 'Une affectation change une valeur', lines: ['mesure = 3', 'copie = mesure', 'mesure = mesure + 1'], states: [[['mesure (int)', 3]], [['mesure (int)', 3], ['copie (int)', 3]], [['mesure (int)', 4], ['copie (int)', 3]]] },
  '0.7': { title: 'La condition choisit une branche', lines: ['loss = 0.4; seuil = 0.5', 'condition = loss < seuil', 'if condition: message = "acceptable"', '# else non exécuté : message = "à améliorer"'], states: [[['loss', .4], ['seuil', .5]], [['0.4 < 0.5', 'True']], [['Branche exécutée', 'acceptable']], [['Branche ignorée', 'à améliorer']]] },
  '0.8': { title: 'La boucle visite une case à la fois', lines: ['total = 0', 'total += valeurs[0]  # +2', 'total += valeurs[1]  # +4', 'total += valeurs[2]  # +1'], states: [[['Index', 'avant la boucle'], ['total', 0]], [['Index', 0], ['valeur', 2], ['total', 2]], [['Index', 1], ['valeur', 4], ['total', 6]], [['Index', 2], ['valeur', 1], ['total', 7]]] },
  '0.9': { title: 'Appeler, calculer, retourner', lines: ['def double(x): return 2 * x', 'entree = 3', 'sortie = double(entree)', '# retour vers la ligne appelante'], states: [[['Fonction', 'double(x)']], [['Appelant : entree', 3]], [['Fonction : x', 3], ['Fonction : 2*x', 6]], [['Appelant : sortie', 6]]] },
  '0.10': { title: 'Deux noms peuvent désigner la même liste', lines: ['a = [1, 2]', 'b = a', 'b.append(3)', 'c = a.copy(); c.append(4)'], states: [[['a → liste #1', '[1,2]']], [['a → liste #1', '[1,2]'], ['b → liste #1', 'même objet']], [['a et b → liste #1', '[1,2,3]']], [['a et b → liste #1', '[1,2,3]'], ['c → liste #2', '[1,2,3,4]']]] },
  '0.12': { title: 'Une erreur interrompt le programme', lines: ['valeurs = [2, 4]', 'x = valeurs[0]  # valide', 'x = valeurs[2]  # IndexError', '# correction : valeurs[1] retourne 4'], states: [[['Liste', 'indices 0 et 1']], [['Indice 0', 2]], [['Indice 2 absent', 'arrêt : IndexError']], [['Indice 1 corrigé', 4]]] },
  '0.21': { title: 'Une classe fabrique des objets distincts', lines: ['class Mesure:\n    def __init__(self, valeur): self.valeur = valeur', 'a = Mesure(2)', 'b = Mesure(5)', 'a.valeur += 1'], states: [[['Classe', 'plan Mesure(valeur)']], [['Objet a', 'valeur = 2']], [['Objet a', 'valeur = 2'], ['Objet b', 'valeur = 5']], [['Objet a', 'valeur = 3'], ['Objet b', 'valeur = 5']]] },
  '0.22': { title: 'Un test rend une attente explicite', lines: ['def double(x): return x + 2  # bug', 'assert double(2) == 4  # passe', 'assert double(3) == 6  # échoue : 5 != 6', 'def double(x): return 2 * x  # correction'], states: [[['Implémentation erronée', 'x+2']], [['Cas 2', '4 == 4, passe']], [['Cas 3', '5 != 6, échec']], [['Correction', 'cas 2 et 3 passent']]] },
  '0.23': { title: 'Un carnet accumule puis résume les mesures', lines: ['mesures = []', 'mesures.append(2); mesures.append(4)', 'moyenne = sum(mesures) / len(mesures)', 'assert moyenne == 3'], states: [[['Carnet', '[]']], [['Carnet', '[2,4]']], [['Somme / effectif', '6 / 2 = 3']], [['Contrôle', '3 == 3, passe']]] },
  '1.16': { title: 'Une boucle d’apprentissage respecte l’ordre', lines: ['optimizer.zero_grad()', 'loss = modele.loss(x, y)', 'loss.backward()', 'optimizer.step()'], states: [[['Gradients', 'remis à zéro']], [['Forward', 'prédiction puis perte']], [['Backward', 'accumuler les gradients']], [['Paramètres', 'mise à jour ; recommencer']]] },
  '3.11': { title: 'Sauver l’état nécessaire pour recharger', lines: ['payload = {"config": config, "weights": poids}', 'sauver(payload, tokenizer, "checkpoint")  # pseudocode', 'restaure = charger("checkpoint")', 'assert logits_avant == logits_apres  # comparer numériquement'], states: [[['Poids', 'tableaux + formes'], ['Config', 'architecture']], [['Disque', 'poids + config + tokenizer']], [['RAM', 'mêmes poids et mêmes IDs']], [['Vérification', 'mêmes logits ; pas seulement un fichier présent']]] },
};
export const foundationIds = new Set(Object.keys(PROGRAMS));
export function mountFoundation(host, lesson) {
  const spec = PROGRAMS[lesson.id]; if (!spec) return false;
  lab(host, { kind: 'program', title: spec.title, source: lesson.id === '1.16' ? 'model/gpt_train.py' : lesson.id === '3.11' ? 'model/artifacts.py' : 'atelier/README.md',
    steps: spec.lines.map((code, i) => ({ title: `État ${i + 1}`, code })), render(stage, step) {
      stage.append(cards(spec.states[step].map(([label, value], i) => ({ label, value, active: i === spec.states[step].length-1 }))), note('Trace pédagogique fixée : les boîtes représentent les valeurs et objets à cette ligne. Le code affiché n’est pas exécuté dans le navigateur.'));
    } });
  return true;
}

export function mountExperiment(host, lesson) {
  const mismatch = h('input', { type: 'checkbox', 'aria-label': 'Changer aussi le jeu de validation' }), stage = h('div'), status = note('');
  const baseline = [2.8, 2.4, 2.2], candidate = [2.8, 2.35, 2.12];
  const paint = () => {
    const changed = mismatch.checked;
    stage.replaceChildren(chart('Exemple fictif de comparaison ; aucune mesure du projet', [
      { name: 'Baseline · val A', values: baseline.map((v, i) => [i*100, v]) },
      { name: `Candidate · val ${changed ? 'B différente' : 'A identique'}`, values: candidate.map((v, i) => [i*100, v - (changed ? .5 : 0)]) },
    ]), cards([{ label: 'Variable étudiée', value: lesson.id === '5.10' ? 'normalisation' : 'une seule brique' }, { label: 'Données / tokenizer / budget', value: changed ? 'validation différente : comparaison biaisée' : 'fixes entre les deux essais', active: true }, { label: 'Répétitions', value: 'plusieurs graines requises', detail: 'une courbe ne prouve pas un progrès général' }]));
    status.textContent = `${changed ? 'Conclusion refusée : les pertes portent sur deux validations différentes. La meilleure courbe ne permet pas d’attribuer le gain à la brique.' : 'Protocole comparable pour cet exemple : même validation, tokenizer, budget et métrique. Il faut encore les répétitions, la latence et les limites.'} Courbes fictives pour apprendre à lire un protocole, sans prétendre reproduire un papier. Les résultats réels sont dans Expériences.`;
  };
  host.dataset.lab = 'experiment'; host.append(h('h2', { class: 'lab-title', text: `${lesson.id.startsWith('11.') ? 'Lire une preuve expérimentale' : 'Comparer une candidate à sa baseline'}` }), h('label', {}, [mismatch, 'Changer aussi la validation (contre-exemple)']), stage, status, h('a', { href: '#/experiences', text: 'Consulter les expériences et leurs preuves réelles' })); mismatch.addEventListener('change', paint); paint();
}

export function mountHybrid(host) {
  const mixer = h('select', { 'aria-label': 'Mélangeur de la candidate' }, ['attention', 'scan', 'hybride'].map(x => h('option', { value: x, text: x })));
  const stage = h('div'), status = note('');
  const paint = () => {
    const x = mixer.value;
    stage.replaceChildren(cards([{ label: 'Entrée', value: '[B,T,D]' }, { label: x === 'hybride' ? 'Attention puis scan' : x, value: '[B,T,D] → [B,T,D]', active: true, detail: 'interface identique ; mécanisme différent' }, { label: 'Résidu + FFN', value: '[B,T,D]' }, { label: 'Tête de sortie', value: '[B,T,V]' }]));
    status.textContent = `Candidate ${x}. Les formes sont compatibles ; cela ne prouve ni son entraînabilité, ni sa qualité. Tester les gradients, entraîner sous le même budget, puis faire une ablation. Aucune performance inventée pour ce choix.`;
  };
  host.dataset.lab = 'hybrid'; host.append(h('h2', { class: 'lab-title', text: 'Remplacer une brique en conservant son contrat' }), h('label', {}, ['Mélangeur', mixer]), stage, status); mixer.addEventListener('change', paint); paint();
}

export function mountSplit(host) {
  const leak = h('input', { type: 'checkbox', 'aria-label': 'Copier un exemple train dans la validation' }), stage = h('div'), status = note('');
  const paint = () => {
    stage.replaceChildren(cards([{ label: 'Train', value: 'livre A, livre B', detail: 'mise à jour des poids' }, { label: 'Validation', value: leak.checked ? 'livre A recopié' : 'livre C réservé', active: true, detail: 'choix des hyperparamètres' }, { label: 'Test', value: 'livre D intact', detail: 'estimation finale, une fois' }]));
    status.textContent = leak.checked ? 'Fuite de données : une validation vue à l’entraînement récompense la mémorisation. Séparer par source et dédupliquer avant le split.' : 'Exemple de séparation par livre : les sources sont distinctes. Éviter aussi les doublons et entraîner le tokenizer uniquement sur le train. Ce dessin décrit le protocole souhaité ; il ne modifie pas les runs archivés.';
  };
  host.dataset.lab = 'split'; host.append(h('h2', { class: 'lab-title', text: 'Séparer les données avant de comparer' }), h('label', {}, [leak, 'Introduire une fuite (contre-exemple)']), stage, status); leak.addEventListener('change', paint); paint();
}

export function mountOverfit(host) {
  const steps = slider('Étape illustrée', 0, 4, 2), stage = h('div'), status = note('');
  const train = [2.5, 1.6, .9, .4, .15], val = [2.6, 1.8, 1.5, 1.7, 2.1];
  const paint = () => {
    const end = Number(steps.input.value)+1;
    stage.replaceChildren(chart('Surapprentissage, courbes fictives', [{ name: 'Train (illustration)', values: train.slice(0,end).map((v,i)=>[i,v]) }, { name: 'Validation (illustration)', values: val.slice(0,end).map((v,i)=>[i,v]) }]));
    status.textContent = `Étape ${end-1} : train=${train[end-1]}, validation=${val[end-1]}. Le meilleur point de validation de cet exemple est l’étape 2. Poursuivre réduit le train mais détériore la validation. Ces valeurs ne proviennent pas d’un run.`;
  };
  host.dataset.lab = 'overfit'; host.append(h('h2', { class: 'lab-title', text: 'Reconnaître quand le train cesse de raconter toute l’histoire' }), steps.field, stage, status); steps.input.addEventListener('input', paint); paint();
}
