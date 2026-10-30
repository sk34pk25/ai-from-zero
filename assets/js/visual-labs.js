/** Laboratoires conceptuels : mêmes nombres dans le dessin, la formule et la ligne NumPy. */
import { h } from './dom.js';
import { bestPair, mergePair } from './bpe.js';
import { ATTENTION_X, attentionTrace, matmul, graphTrace, normalize, rotate, silu, gelu, routeExperts, MOE_SCORES, scanTrace, loraTrace, descentStep, quantize, softmax, sum } from './visual-math.js';
import { action, cards, chart, fmt, lab, matrix, note, prediction, slider, svg } from './visual-ui.js';

function mountMatrix(host, lesson) {
  let row = 0, col = 0;
  const a = [[1, 2], [3, 4]], b = [[2, 0], [1, 3]];
  const edit = h('input', { type: 'number', min: '-9', max: '9', value: '1', 'aria-label': 'Valeur A ligne 0 colonne 0' });
  const scale = slider('Batch à inspecter', 0, 1, 0);
  const isTensor = ['0.15', '1.15', '2.11', '6.5'].includes(lesson.id);
  host.append(isTensor ? scale.field : h('label', {}, ['Modifier A[0, 0]', edit]));
  const view = lab(host, { kind: isTensor ? 'tensor' : 'matrix', title: isTensor ? 'Une tranche du tenseur [B, T, D]' : 'Ligne × colonne : fabriquer une cellule', source: 'model/attention.py', steps: [
    { title: 'Repérer les formes', code: 'A.shape, B.shape  # (2, 2), (2, 2)' },
    { title: 'Multiplier les éléments alignés', code: 'products = A[i, :] * B[:, j]' },
    { title: 'Additionner dans C[i, j]', code: 'C = A @ B  # (2, 2)' },
  ], render(stage, step) {
    const batch = Number(scale.input.value), aa = isTensor ? a.map(r => r.map(n => n + batch * 4)) : a;
    const c = matmul(aa, b), products = aa[row].map((n, k) => n * b[k][col]);
    stage.append(note(isTensor ? `Tenseur [2, 2, 2] : B = batch, T = position, D = coordonnée. Tranche B=${batch} affichée ; W est partagée entre les batches.` : 'Choisis une cellule de C. Les repères « ligne » et « colonne » accompagnent la couleur.'),
      h('div', { class: 'lab-matrices' }, [matrix(isTensor ? `X[${batch}] · ligne ${row}` : `A · ligne ${row}`, aa, { selected: i => i === row }),
        matrix(`B · colonne ${col}`, b, { selected: (_, j) => j === col }),
        matrix('C = A @ B', c, { selected: (i, j) => i === row && j === col, onCell: (i, j) => { row = i; col = j; view.repaint(); host.querySelector('.lab-matrices > :last-child button[aria-pressed="true"]')?.focus({ preventScroll: true }); } })]),
      note(`${step === 0 ? 'Cellule choisie' : 'Calcul actif'} C[${row}, ${col}] = ${aa[row].map((n, k) => `${n} × ${b[k][col]}`).join(' + ')} = ${products.join(' + ')} = ${fmt(c[row][col])}.`));
  } });
  edit.addEventListener('input', () => { const n = Number(edit.value); if (edit.value !== '' && Number.isFinite(n)) { a[0][0] = Math.max(-9, Math.min(9, n)); view.repaint(); } });
  scale.input.addEventListener('input', view.repaint);
  prediction(host, { question: 'Avec A et B affichées, combien vaut C[0, 0] ?', answer: () => matmul(isTensor ? a.map(r => r.map(n => n + Number(scale.input.value) * 4)) : a, b)[0][0], explanation: () => `Prends la ligne 0 de A et la colonne 0 de B, puis additionne leurs produits.` });
}

function neuronDiagram(t, step) {
  const canvas = svg('svg', { viewBox: '0 0 320 266', class: 'visual-svg lab-graph', role: 'img', 'aria-label': `Graphe : produit ${fmt(t.product)}, somme ${fmt(t.z)}, ReLU ${fmt(t.y)}, perte ${fmt(t.loss)}. Les gradients remontent les flèches en pointillés.` });
  const nodes = [
    [12, 36, 'w × x', `${fmt(t.w)} × 3 = ${fmt(t.product)}`, 0],
    [178, 36, '+ biais', `${fmt(t.product)} + 1 = ${fmt(t.z)}`, 1],
    [178, 168, 'ReLU', `y = ${fmt(t.y)}`, 2],
    [12, 168, '(y − cible)²', `L = ${fmt(t.loss)}`, 3],
  ];
  canvas.append(svg('path', { d: 'M142 71H171M164 66L171 71L164 76M243 110V162M238 155L243 162L248 155M178 203H149M156 198L149 203L156 208', fill: 'none', stroke: 'currentColor', 'stroke-width': 2 }));
  if (step >= 4) canvas.append(svg('path', { d: 'M78 158V129H162V22H243M236 17L243 22L236 27', fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
  for (const [x,y,label,value,index] of nodes) {
    canvas.append(svg('rect', { x, y, width: 130, height: 72, rx: 10, fill: step === index ? 'var(--accent-soft)' : 'var(--bg)', stroke: step === index ? 'var(--accent)' : 'var(--line-strong)', 'stroke-width': step === index ? 3 : 1 }));
    for (const [txt,dy] of [[label,25],[value,50]]) { const text = svg('text', { x:x+65, y:y+dy, 'text-anchor':'middle', fill:'currentColor' }); text.textContent=txt; canvas.append(text); }
  }
  const legend=svg('text',{x:12,y:256,fill:'currentColor'}); legend.textContent=step>=4 ? `Retour : ∂L/∂y=${fmt(t.dy)} ; ∂L/∂w=${fmt(t.dw)}` : '→ valeurs du forward · pointillés : retour'; canvas.append(legend);
  return canvas;
}

function mountGraph(host, lesson) {
  const weight = slider('Poids w du neurone', -2, 3, 2, .1);
  host.append(weight.field);
  const names = ['Produit', 'Somme', 'Activation', 'Perte', 'Gradient de sortie', 'Retour vers w'];
  const codes = ['p = w * x', 'z = p + b', 'y = np.maximum(0, z)', 'loss = (y - target) ** 2', 'dy = 2 * (y - target)', 'dw = dy * (z > 0) * x'];
  const backward = ['1.10', '1.11', '1.12', '1.15'].includes(lesson.id);
  const view = lab(host, { kind: 'backprop', title: backward ? 'Le gradient remonte le graphe' : 'Un neurone, du poids à la perte', source: 'model/autograd.py', steps: names.map((title, i) => ({ title, code: codes[i] })), render(stage, step) {
    const t = graphTrace(Number(weight.input.value));
    stage.append(neuronDiagram(t, step), cards([
      { label: '∂L/∂y', value: fmt(t.dy), active: step === 4, detail: '2 × (y − cible)' },
      { label: '∂L/∂w', value: `${fmt(t.dy)} × ${t.z > 0 ? 1 : 0} × 3 = ${fmt(t.dw)}`, active: step === 5, detail: 'gradient amont × dérivée locale × entrée' },
    ]), note(`Forward : x=3, b=1, cible=4. Backward : ∂L/∂b=${fmt(t.db)}, ∂L/∂x=${fmt(t.dx)}. À z=0, le code choisit une dérivée ReLU nulle.`));
  } });
  weight.input.addEventListener('input', view.repaint);
  prediction(host, { question: 'Pour le poids affiché, quel est ∂L/∂w ?', answer: () => graphTrace(Number(weight.input.value)).dw, explanation: () => `Multiplie 2(y−4), le masque (z>0), puis x=3 : ${fmt(graphTrace(Number(weight.input.value)).dw)}.` });
}

function mountAttentionLab(host, lesson) {
  const t = attentionTrace();
  let query = 1;
  const tokens = ['le', 'chat', 'dort'];
  const select = h('div', { class: 'token-board', role: 'group', 'aria-label': 'Position requête' });
  let view;
  tokens.forEach((token, i) => select.append(action(token, () => {
    query = i; for (const [j, b] of [...select.children].entries()) b.setAttribute('aria-pressed', String(j === i)); view.repaint();
  }, { 'aria-pressed': String(i === query) })));
  host.append(select);
  const steps = [
    ['Entrée et projections', 'Q = X @ I; K = X @ I; V = X @ (2 * I)'],
    ['Scores des requêtes et clés', 'scores = (Q @ K.T) / np.sqrt(2)'],
    ['Interdire le futur', 'scores = np.where(causal_mask, scores, -np.inf)'],
    ['Transformer en probabilités', 'P = softmax(scores, axis=-1)'],
    ['Mélanger les valeurs', 'output = P @ V'],
  ].map(([title, code]) => ({ title, code }));
  const starts = { '4.2': 0, '4.3': 1, '4.4': 4, '4.5': 2, '4.6': 1, '4.7': 4 };
  view = lab(host, { kind: 'attention', title: `Attention causale · ${lesson.id === '4.7' ? 'une tête inspectée' : 'trois tokens, deux coordonnées'}`, source: 'model/attention.py', steps, initial: starts[lesson.id] ?? 0, render(stage, step) {
    const active = i => i === query;
    if (step === 0) stage.append(h('div', { class: 'lab-matrices' }, [matrix('Q = K = X', t.q, { selected: active, rowNames: tokens }), matrix('V = 2X', t.v, { rowNames: tokens })]));
    else if (step < 4) {
      const values = step === 1 ? t.scores : step === 2 ? t.masked : t.weights;
      stage.append(matrix(step === 1 ? 'Scores / √2' : step === 2 ? 'Scores masqués' : 'P · probabilités', values, { selected: active, rowNames: tokens, colNames: tokens }));
    } else stage.append(h('div', { class: 'lab-matrices' }, [matrix('P', t.weights, { selected: active, rowNames: tokens, colNames: tokens }), matrix('V', t.v, { rowNames: tokens }), matrix('P @ V', t.output, { selected: active, rowNames: tokens })]));
    const p = t.weights[query];
    stage.append(note(`Requête « ${tokens[query]} » : scores [${t.scores[query].map(fmt).join(', ')}] ; probabilités [${p.map(fmt).join(', ')}], somme=${fmt(sum(p))}. Sortie=[${t.output[query].map(fmt).join(', ')}]. Les cases du futur valent exactement 0 après softmax.`));
    if (lesson.id === '4.7') stage.append(note('Multi-têtes : ce calcul se fait séparément dans chaque tête ; concaténer leurs sorties puis projeter avec Wₒ conserve [B,T,D]. Voir GQA en 5.5 pour inspecter le partage de K et V.'));
  } });
  prediction(host, { question: 'Pour « chat », quel poids reçoit le futur « dort » ?', answer: 0, tolerance: 1e-9, explanation: 'Le score futur est −∞ ; exp(−∞)=0. Masquer après softmax sans renormaliser ferait perdre la somme 1.' });
}

function mountResidual(host) {
  const x = ATTENTION_X.slice(0, 2), branch = attentionTrace().output.slice(0, 2);
  lab(host, { kind: 'residual', title: 'Le résidu ajoute deux tableaux de même forme', source: 'model/transformer.py', steps: [
    { title: 'Conserver l’entrée', code: 'residual = hidden' }, { title: 'Calculer la branche', code: 'branch = attention(norm(hidden))' }, { title: 'Additionner cellule par cellule', code: 'hidden = residual + branch' },
  ], render(stage, step) {
    stage.append(h('div', { class: 'lab-matrices' }, [matrix('X', x), matrix('Branche · exemple', branch), matrix('X + branche', x.map((r, i) => r.map((n, j) => n + branch[i][j])))]), note(`Étape ${step + 1}. [T,D] + [T,D] → [T,D]. Le résidu conserve une route directe pour la valeur et pour le gradient ; ce n’est pas une concaténation.`));
  } });
}

function mountNorm(host, lesson) {
  const shift = slider('Décalage de la ligne', -3, 3, 0, .5), rms = lesson.id === '5.3';
  host.append(shift.field);
  const view = lab(host, { kind: rms ? 'rmsnorm' : 'layernorm', title: rms ? 'RMSNorm : mettre à l’échelle sans centrer' : 'LayerNorm : centrer puis mettre à l’échelle', source: 'model/mathutil.py', steps: [
    { title: 'Lire une position', code: 'x = np.array([1., 2., 3., 4.]) + offset' },
    { title: rms ? 'Moyenne des carrés' : 'Moyenne et variance', code: rms ? 'scale = np.sqrt(np.mean(x*x) + 1e-5)' : 'mean = x.mean(); scale = np.sqrt(x.var() + 1e-5)' },
    { title: 'Normaliser (gain=1, biais=0)', code: rms ? 'y = x / scale' : 'y = (x - mean) / scale' },
  ], render(stage) {
    const x = [1, 2, 3, 4].map(n => n + Number(shift.input.value)), y = normalize(x, rms);
    stage.append(matrix('Entrée', [x]), matrix('Sortie', [y]), note(`Moyenne entrée=${fmt(sum(x) / 4)}, sortie=${fmt(sum(y) / 4)}. RMS sortie=${fmt(Math.sqrt(sum(y.map(n => n*n)) / 4))}. ε=10⁻⁵ évite la division par zéro. ${rms ? 'La moyenne de sortie n’est pas forcée à zéro.' : 'Le gain et le biais appris viennent ensuite.'}`));
  } });
  shift.input.addEventListener('input', view.repaint);
}

function mountDescentLab(host) {
  const rate = slider('Pas d’apprentissage', .05, 1.1, .15, .05), plot = h('div'), status = note('');
  let history = [2.2];
  const paint = () => {
    const x = history.at(-1);
    plot.replaceChildren(chart('Descente sur f(x)=x² ; axes ajustés à l’historique', [{ name: 'f(x)=x²', values: Array.from({ length: 65 }, (_, i) => { const bound = Math.max(2.5, ...history.map(Math.abs)) * 1.15; const a = -bound + 2 * bound * i / 64; return [a, a*a]; }) }], { xLabel: 'Paramètre x', yLabel: 'f(x) = x²', point: [x, x*x] }));
    status.textContent = `Pas ${history.length - 1} : x=${fmt(x)}, gradient=${fmt(2*x)}, perte=${fmt(x*x)}, taux=${fmt(Number(rate.input.value))}. ${Number(rate.input.value) > 1 ? 'Divergence : les sauts s’éloignent de zéro ; les axes s’adaptent.' : Number(rate.input.value) === 1 ? 'Oscillation : x change de signe sans réduire la perte.' : 'x suivant = x − taux × 2x.'}`;
    host.dataset.x = String(x);
  };
  host.dataset.lab = 'descent';
  host.append(h('h2', { class: 'lab-title', text: 'Voir les pas, y compris la divergence' }), rate.field, h('div', { class: 'lab-controls' }, [action('Un pas', () => { const next = descentStep(history.at(-1), Number(rate.input.value)); if (Number.isFinite(next) && Math.abs(next) < 1e6) { history.push(next); paint(); } else status.textContent = 'Arrêt de l’exemple : amplitude supérieure à un million. Rejoue avec un pas plus petit.'; }), action('Calcul précédent', () => { if (history.length > 1) history.pop(); paint(); }), action('Rejouer', () => { history = [2.2]; paint(); })]), plot, status);
  rate.input.addEventListener('input', paint); paint();
}

function mountReluLab(host) {
  const input = slider('Entrée de ReLU', -3, 3, -1, .1), plot = h('div'), status = note('');
  host.dataset.lab = 'relu';
  const paint = () => {
    const x = Number(input.input.value), y = Math.max(0, x), gradient = x > 0 ? 1 : 0;
    plot.replaceChildren(chart('ReLU et sa dérivée locale ; convention dérivée zéro en zéro', [
      { name: 'ReLU(x)', values: Array.from({ length: 61 }, (_, i) => { const a = -3 + i / 10; return [a, Math.max(0, a)]; }) },
      { name: 'Gradient local (0 en zéro)', values: [[-3, 0], [0, 0], [.001, 1], [3, 1]] },
    ], { xLabel: 'Entrée x', yLabel: 'Valeur / gradient', point: [x, y] }));
    status.textContent = `ReLU(${fmt(x)}) = ${fmt(y)} ; gradient local = ${gradient}. ${x === 0 ? 'Non dérivable en zéro : l’autograd du cours choisit 0 via (x > 0).' : x < 0 ? 'La branche négative est bloquée.' : 'La branche positive transmet le gradient.'}`;
    host.dataset.gradient = String(gradient);
  };
  host.append(h('h2', { class: 'lab-title', text: 'ReLU : une valeur et un gradient' }), input.field, plot, status);
  input.input.addEventListener('input', paint); paint();
}

function mountTokenizerLab(host, lesson) {
  const corpus = 'le chat dort ici', vocab = [...new Set([...corpus])].sort();
  const input = h('input', { type: 'text', value: ['2.1', '2.3'].includes(lesson.id) ? 'é🙂' : 'chat', maxlength: '60', 'aria-label': 'Texte à découper', 'data-visual-input': 'true' });
  const board = h('div'), status = note('');
  host.dataset.lab = 'tokenizer';
  const paint = () => {
    const chars = [...input.value], bytes = [...new TextEncoder().encode(input.value)];
    board.replaceChildren(cards(chars.map(char => ({ label: char === ' ' ? 'espace' : char, value: `U+${char.codePointAt(0).toString(16).toUpperCase()}`, detail: vocab.includes(char) ? `ID fixe ${vocab.indexOf(char)}` : 'hors vocabulaire caractère' }))), matrix('Octets UTF-8 (0…255)', bytes.length ? [bytes] : [[]]));
    const unknown = [...new Set(chars.filter(c => !vocab.includes(c)))];
    status.textContent = `${chars.length} points de code Unicode ; ${bytes.length} octets UTF-8. ${unknown.length ? `Caractères absents : ${unknown.join(' ')}. Ce vocabulaire caractère refuserait cet encodage ; un tokenizer octet garde les 256 octets de base.` : `IDs : [${chars.map(c => vocab.indexOf(c)).join(', ')}]. Décodage : « ${chars.join('')} ».`} Le vocabulaire reste fixe quand tu modifies le texte.`;
  };
  host.append(h('h2', { class: 'lab-title', text: 'Texte → caractères → identifiants stables' }), h('label', {}, ['Texte (60 caractères maximum)', input]),
    h('details', {}, [h('summary', { text: 'Vocabulaire appris sur « le chat dort ici »' }), note(vocab.map((c, i) => `${c === ' ' ? 'espace' : c}=${i}`).join(' · '))]), board, status);
  input.addEventListener('input', paint); paint();
}

function mountBpeLab(host) {
  const corpus = 'abab ababab';
  let tokens = [...corpus], merges = [], history = [];
  const stage = h('div'), status = note(''), merge = action('Fusionner', () => {
    const found = bestPair(tokens); if (!found) return;
    history.push(tokens.slice()); merges.push(found.pair); tokens = mergePair(tokens, found.pair); paint();
  });
  const paint = () => {
    const found = bestPair(tokens), counts = new Map(), vocab = [...new Set([...corpus])].sort();
    for (const pair of merges) vocab.push(pair.join(''));
    for (let i = 0; i < tokens.length - 1; i++) { const key = JSON.stringify([tokens[i], tokens[i+1]]); counts.set(key, (counts.get(key) || 0) + 1); }
    const pairs = [...counts].map(([key, count]) => ({ pair: JSON.parse(key), count })).sort((a, b) => b.count - a.count || (JSON.stringify(a.pair) < JSON.stringify(b.pair) ? -1 : 1));
    stage.replaceChildren(h('div', { class: 'token-board' }, tokens.map((token, i) => h('span', { class: 'token-chip', 'data-token': token }, `${token === ' ' ? 'espace' : token} · ID ${vocab.indexOf(token)}${found && token === found.pair[0] && tokens[i+1] === found.pair[1] ? ' → paire à fusionner' : ''}`))),
      cards(pairs.slice(0, 8).map(({ pair, count }) => ({ label: pair.map(p => p === ' ' ? 'espace' : p).join(' + '), value: `${count} occurrence(s)`, active: JSON.stringify(pair) === JSON.stringify(found?.pair) }))),
      h('ol', { class: 'lab-merge-ranks' }, merges.map((pair, i) => h('li', { text: `Rang ${i} : ${pair.join(' + ')} → ${pair.join('')} · ID ${vocab.indexOf(pair.join(''))}` }))));
    merge.disabled = !found;
    status.textContent = `${merges.length} fusion(s), ${tokens.length} token(s). ${found ? `Prochaine paire : ${found.pair.join(' + ')} (${found.count} occurrences). Fréquence maximale, puis ordre lexicographique.` : 'Plus de paire à fusionner.'} Reconstruction exacte : « ${tokens.join('')} ». Les rangs et IDs déjà appris sont conservés.`;
    host.dataset.tokens = String(tokens.length);
  };
  host.dataset.lab = 'bpe';
  host.append(h('h2', { class: 'lab-title', text: 'BPE : compter, fusionner, conserver le rang' }), note('Mini-corpus fixe : « abab ababab ». Les occurrences se comptent avant les fusions, qui ne se chevauchent pas.'), stage,
    h('div', { class: 'lab-controls' }, [merge, action('Calcul précédent', () => { if (history.length) { tokens = history.pop(); merges.pop(); paint(); } }), action('Rejouer', () => { tokens = [...corpus]; merges = []; history = []; paint(); })]), status);
  prediction(host, { question: 'Au départ, combien de fois la paire a + b apparaît-elle ?', answer: 5, tolerance: 0, explanation: 'Deux fois dans « abab », trois fois dans « ababab » : 5 occurrences.' });
  paint();
}

function mountVectors(host, lesson) {
  const points = { chat: [.9, .2], chien: [.7, .35], code: [-.6, .8], loss: [-.4, -.7] };
  let selected = 'chat';
  const board = h('div', { class: 'token-board' }), plot = h('div'), status = note('');
  const paint = () => {
    const canvas = svg('svg', { viewBox: '0 0 320 260', class: 'visual-svg', role: 'img', 'aria-label': 'Vecteurs dans un plan 2D, x horizontal et y vertical' });
    const origin = [160, 125];
    canvas.append(svg('path', { d: 'M25 125H300M160 20V235', fill: 'none', stroke: 'currentColor' }));
    for (const [name, [x, y]] of Object.entries(points)) {
      const end = [160 + 110*x, 125 - 110*y];
      canvas.append(svg('path', { d: `M${origin.join(' ')}L${end.join(' ')}`, stroke: 'var(--accent)', 'stroke-width': name === selected ? 4 : 1, 'stroke-dasharray': name === selected ? 'none' : '4 3' }), svg('circle', { cx: end[0], cy: end[1], r: name === selected ? 5 : 3 }));
      const text = svg('text', { x: end[0] + 4, y: end[1] - 8, fill: 'currentColor' }); text.textContent = name; canvas.append(text);
    }
    for (const [label, x, y] of [['x', 300, 145], ['y', 170, 24], ['0', 145, 143], ['1', 270, 143], ['−1', 39, 143]]) { const text = svg('text', { x, y, fill: 'currentColor' }); text.textContent = label; canvas.append(text); }
    plot.replaceChildren(canvas);
    const a = points[selected], b = points.chien, dot = sum(a.map((n, i) => n * b[i]));
    status.textContent = `${selected}=[${a.join(', ')}] ; norme=${fmt(Math.hypot(...a))}. Produit avec chien=${fmt(dot)}, cosinus=${fmt(dot / (Math.hypot(...a)*Math.hypot(...b)))}. Coordonnées inventées pour expliquer le calcul ; pas des embeddings entraînés. ${lesson.id === '2.10' ? 'Une position sera ajoutée au vecteur, ou utilisée pour tourner Q et K avec RoPE (5.2).' : ''}`;
    for (const b of board.children) b.setAttribute('aria-pressed', String(b.textContent === selected));
  };
  Object.keys(points).forEach(name => board.append(action(name, () => { selected = name; paint(); })));
  host.dataset.lab = 'vectors';
  host.append(h('h2', { class: 'lab-title', text: 'Voir la direction d’un vecteur' }), board, plot, status); paint();
}

function mountRope(host) {
  const position = slider('Position RoPE', 0, 6, 1, 1), plot = h('div'), status = note('');
  const paint = () => {
    const angle = Number(position.input.value), out = rotate([1, 0], angle), canvas = svg('svg', { viewBox: '0 0 300 260', class: 'visual-svg', role: 'img', 'aria-label': `Rotation de ${angle} radians, vecteur de norme 1` });
    canvas.append(svg('circle', { cx: 150, cy: 130, r: 95, fill: 'none', style: 'fill:none;stroke:var(--line-strong)' }), svg('path', { d: `M45 130H255M150 25V235M150 130H245M150 130L${150 + 95*out[0]} ${130 - 95*out[1]}`, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 2 }));
    const label = svg('text', { x: 12, y: 252, fill: 'currentColor' }); label.textContent = `x=${fmt(out[0])} ; y=${fmt(out[1])}`; canvas.append(label); plot.replaceChildren(canvas);
    status.textContent = `Position p=${angle}, fréquence de cette paire=1 radian/position, angle=${angle} rad. [1,0] → [${out.map(fmt).join(', ')}], norme=${fmt(Math.hypot(...out))}. Les autres paires utilisent d’autres fréquences ; Q et K tournent, V ne tourne pas.`;
  };
  host.dataset.lab = 'rope';
  host.append(h('h2', { class: 'lab-title', text: 'RoPE : une paire de coordonnées tourne' }), position.field, plot, status, note('NumPy : [x*cos(p) − y*sin(p), x*sin(p) + y*cos(p)]. La forme du tenseur est conservée.')); position.input.addEventListener('input', paint); paint();
}

function mountGate(host) {
  const input = slider('Entrée de la porte', -4, 4, 1, .1), stage = h('div'), status = note('');
  const paint = () => {
    const x = Number(input.input.value), s = silu(x), g = gelu(x);
    stage.replaceChildren(chart('GELU et SiLU', [
      { name: 'GELU (approximation tanh)', values: Array.from({ length: 81 }, (_, i) => { const n = i / 10 - 4; return [n, gelu(n)]; }) },
      { name: 'SiLU(x)', values: Array.from({ length: 81 }, (_, i) => { const n = i / 10 - 4; return [n, silu(n)]; }) },
    ], { xLabel: 'Entrée x', yLabel: 'Activation', point: [x, s] }), cards([{ label: 'Porte SiLU(x)', value: fmt(s) }, { label: 'Branche u', value: 2 }, { label: 'Produit SwiGLU', value: fmt(s*2) }]));
    status.textContent = `x=${fmt(x)} ; GELU(x)=${fmt(g)} ; SiLU(x)=${fmt(s)} ; porte × u = ${fmt(s*2)}. Dans TinyGPT : (silu(X @ Wg) * (X @ Wu)) @ Wd ; la porte dépend du contenu.`;
  };
  host.dataset.lab = 'gate'; host.append(h('h2', { class: 'lab-title', text: 'Une porte règle la branche à transmettre' }), input.field, stage, status); input.input.addEventListener('input', paint); paint();
}

function mountGqa(host) {
  const kv = h('select', { 'aria-label': 'Nombre de têtes KV' }, [4, 2, 1].map(n => h('option', { value: n, text: n })));
  const stage = h('div'), status = note('');
  const paint = () => {
    const n = Number(kv.value), groups = 4/n;
    stage.replaceChildren(cards(Array.from({ length: 4 }, (_, q) => ({ label: `Q${q}`, value: `→ K${Math.floor(q/groups)}, V${Math.floor(q/groups)}`, detail: `groupe ${Math.floor(q/groups)}` }))));
    status.textContent = `${n === 4 ? 'MHA' : n === 1 ? 'MQA' : 'GQA'} : 4 têtes Q, ${n} tête(s) KV ; chaque paire KV sert ${groups} requête(s). Cache K+V pour B=1,T=8,dh=2,float32 : ${2*n*8*2*4} octets. Nombre de têtes Q inchangé.`;
  };
  host.dataset.lab = 'gqa'; host.append(h('h2', { class: 'lab-title', text: 'Partager K et V entre plusieurs requêtes' }), h('label', {}, ['Têtes KV', kv]), stage, status); kv.addEventListener('change', paint); paint();
}

function mountCache(host) {
  let length = 1;
  const stage = h('div'), status = note('');
  const paint = () => {
    stage.replaceChildren(cards(Array.from({ length }, (_, t) => ({ label: `position ${t}`, value: t === length-1 ? 'K,V nouveaux' : 'K,V conservés', active: t === length-1 }))));
    status.textContent = `T=${length} ; cache [B,Hkv,T,dh]=[1,2,${length},2]. K+V float32 : ${2*1*2*length*2*4} octets. À ce pas, Q ne contient que la nouvelle position ; elle consulte toutes les clés du cache. À partir d’un préfixe, les anciens K,V ne sont plus reprojetés.`;
    next.disabled = length >= 6;
  };
  const next = action('Ajouter un token', () => { length++; paint(); });
  host.dataset.lab = 'cache'; host.append(h('h2', { class: 'lab-title', text: 'Le cache grandit sans recalculer le passé' }), stage, h('div', { class: 'lab-controls' }, [next, action('Rejouer', () => { length=1; paint(); })]), status); paint();
}

function mountTying(host) {
  const weight = slider('Poids partagé w', -2, 3, 1, .1), stage = h('div'), status = note('');
  const paint = () => {
    const w = Number(weight.input.value);
    stage.replaceChildren(cards([{ label: 'Même w, branche embedding', value: `a=2w=${fmt(2*w)}`, detail: 'contribution au gradient : 2' }, { label: 'Même w, branche sortie', value: `b=3w=${fmt(3*w)}`, detail: 'contribution au gradient : 3' }, { label: 'Les chemins s’additionnent', value: '∂(a+b)/∂w = 2+3 = 5', active: true }]));
    status.textContent = `Exemple scalaire de poids partagé : L=2w+3w=${fmt(5*w)}. Une seule valeur stockée, deux chemins de gradient. Dans TinyGPT, la table tok[V,D] sert à l’embedding puis tok.T[D,V] à la sortie ; elle reçoit les deux contributions.`;
  };
  host.dataset.lab = 'tying'; host.append(h('h2', { class: 'lab-title', text: 'Un poids, deux usages, un gradient accumulé' }), weight.field, stage, status); weight.input.addEventListener('input', paint); paint();
  prediction(host, { question: 'Quel gradient total reçoit w dans L=2w+3w ?', answer: 5, tolerance: 0, explanation: 'Les deux chemins se rejoignent sur le même paramètre : 2+3=5.' });
}

function mountMoeLab(host, lesson) {
  const k = slider('Experts actifs par token (top-k)', 1, 3, lesson.id === '7.2' ? 3 : 1), capacity = slider('Facteur de capacité', .5, 3, 1.25, .25);
  const bias = slider('Biais du routeur vers E0', -2, 2, 0, .1);
  const stage = h('div'), status = note('');
  const paint = () => {
    const scores = MOE_SCORES.map(row => row.map((n, j) => n + (j === 0 ? Number(bias.input.value) : 0)));
    const result = routeExperts(scores, Number(k.input.value), Number(capacity.input.value));
    stage.replaceChildren(matrix('Scores du routeur', scores, { colNames: ['E0', 'E1', 'E2'] }),
      h('ol', { class: 'lab-routes' }, result.routes.map((routes, t) => h('li', {}, [h('strong', { text: `Token ${t}` }), ...routes.map(r => h('span', { class: r.accepted ? 'route-ok' : 'route-drop', text: ` → E${r.expert} · poids ${fmt(r.gate)} · ${r.accepted ? 'calculé' : 'rejeté : capacité'}` }))]))),
      cards(result.used.map((n, e) => ({ label: `Expert E${e}`, value: `${n} / ${result.capacity} places`, detail: 'poids en mémoire, même si inactif' }))));
    status.textContent = `Top-k=${k.input.value} : ${k.input.value} expert(s) sélectionné(s) pour chaque token ; ${sum(result.used)} route(s) calculée(s), ${result.dropped} rejetée(s). Capacité=ceil(${capacity.input.value}×3/3)=${result.capacity} par expert, comme model/moe.py (elle ne croît pas avec k). Les gates sont normalisées avant les rejets, sans renormalisation après rejet. Auxiliaire E·Σ(f·P)=${fmt(result.aux)} : 1 est une référence uniforme, pas une borne inférieure.`;
    host.dataset.topK = k.input.value; host.dataset.dropped = String(result.dropped);
  };
  host.dataset.lab = 'moe'; host.append(h('h2', { class: 'lab-title', text: 'Routeur → experts → capacité réellement disponible' }), k.field, capacity.field, bias.field, stage, status); k.input.addEventListener('input', paint); capacity.input.addEventListener('input', paint); bias.input.addEventListener('input', paint); paint();
  prediction(host, { question: 'Avec E=3 et k=2, combien de routes sont sélectionnées pour 3 tokens, avant capacité ?', answer: 6, tolerance: 0, explanation: 'Chaque token choisit 2 experts, soit 3×2=6 routes ; certaines peuvent ensuite être rejetées.' });
}

function mountScanLab(host, lesson) {
  const keep = slider('Mémoire conservée a', 0, 1, .7, .05), selective = h('input', { type: 'checkbox', 'aria-label': 'Sélectivité selon le signal' });
  selective.checked = ['8.6', '8.7'].includes(lesson.id);
  const stage = h('div'), status = note('');
  const paint = () => {
    const trace = scanTrace([1, 0, 2, 0], Number(keep.input.value), selective.checked);
    stage.replaceChildren(cards(trace.map(t => ({ label: `t=${t.t} · x=${t.x}`, value: `h=${fmt(t.state)}`, detail: `${fmt(t.a)} × ${fmt(t.previous)} + ${t.x}` }))));
    status.textContent = `hₜ=aₜhₜ₋₁+xₜ, h₋₁=0. ${selective.checked ? 'Exemple sélectif : a est divisé par deux quand x≠0 ; le contenu modifie la mémoire.' : 'a est fixe : une entrée plus ancienne est multipliée par a à chaque pas.'} Dernier état=${fmt(trace.at(-1).state)}. C’est une récurrence affine miniature, pas le modèle Mamba complet.`;
    if (lesson.id === '8.5') {
      const a = trace[0].a, b = trace[1].a;
      stage.append(matrix('Composition des deux premiers pas', [[a, 1], [b, 0], [b*a, b*1+0]]), note('(a₂,b₂)∘(a₁,b₁)=(a₂a₁, a₂b₁+b₂). Cette composition est associative : regrouper les paires permet un scan parallèle, sans changer les états obtenus.'));
    }
  };
  host.dataset.lab = 'scan'; host.append(h('h2', { class: 'lab-title', text: 'Suivre le signal dans l’état caché' }), keep.field, h('label', {}, [selective, 'Activer la sélectivité pédagogique']), stage, status); keep.input.addEventListener('input', paint); selective.addEventListener('change', paint); paint();
}

function mountPatchesLab(host) {
  const choice = slider('Patch à extraire', 0, 3, 0), stage = h('div'), status = note('');
  const image = Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => r*4+c));
  const paint = () => {
    const p = Number(choice.input.value), r = Math.floor(p/2)*2, c = p%2*2;
    const flat = [image[r][c], image[r][c+1], image[r+1][c], image[r+1][c+1]], projection = [[1,0],[0,1],[1,0],[0,1]], token = matmul([flat], projection);
    stage.replaceChildren(matrix('Image · pixels', image, { selected: (i, j) => i>=r && i<r+2 && j>=c && j<c+2 }), matrix('Patch aplati', [flat]), matrix('Projection W', projection), matrix('Token visuel = patch @ W', token));
    status.textContent = `Patch ${p} : lignes ${r}–${r+1}, colonnes ${c}–${c+1} → [${flat.join(', ')}] → token [${token[0].join(', ')}]. Quatre patches donnent [4,2]. W est identique pour chaque patch ; les positions sont ajoutées ensuite. Projection inventée pour montrer l’opération.`;
  };
  host.dataset.lab = 'patches'; host.append(h('h2', { class: 'lab-title', text: 'Pixels → patch → vecteur → token' }), choice.field, stage, status); choice.input.addEventListener('input', paint); paint();
  prediction(host, { question: 'Quelle est la troisième valeur du premier patch 2×2 ?', answer: 4, tolerance: 0, explanation: 'Le premier patch contient [0,1,4,5] : on lit ses deux lignes, pas toute la première ligne de l’image.' });
}

function mountSft(host) {
  const include = h('input', { type: 'checkbox', 'aria-label': 'Inclure le prompt dans la perte' }), stage = h('div'), status = note('');
  const tokens = ['Q', ':', 'salut', 'R', ':', 'bonjour', '!'];
  const paint = () => {
    const mask = tokens.map((_, i) => i > 0 && (include.checked || i >= 5) ? 1 : 0), losses = [0, .4, .8, .3, .2, .6, .4], active = sum(mask);
    stage.replaceChildren(cards(tokens.map((token, i) => ({ label: `t${i} : ${token}`, value: `masque ${mask[i]}`, active: mask[i] === 1, detail: i === 0 ? 'aucun prédécesseur dans cet exemple' : `prédit depuis t${i-1} ; NLL=${losses[i]}` }))));
    status.textContent = `${active} cible(s) comptée(s) ; perte moyenne masquée=Σ(masque×NLL)/Σ(masque)=${fmt(sum(mask.map((m, i) => m*losses[i])) / active)} nats/token. ${include.checked ? 'Le prompt contribue maintenant : observe le changement du dénominateur.' : 'Le prompt reste visible pour prédire ; seules les cibles « bonjour » et « ! » contribuent.'} Les NLL sont des valeurs d’exemple fixées, pas un run entraîné. Le premier mot de réponse est prédit depuis la dernière position du prompt.`;
  };
  host.dataset.lab = 'sft'; host.append(h('h2', { class: 'lab-title', text: 'SFT : voir quelles cibles paient la perte' }), h('label', {}, [include, 'Compter aussi le prompt (comparaison)']), stage, status); include.addEventListener('change', paint); paint();
}

function mountLoraLab(host) {
  const rank = slider('Rang LoRA', 1, 4, 1), stage = h('div'), status = note('');
  const paint = () => {
    const r = Number(rank.input.value), t = loraTrace(r);
    stage.replaceChildren(h('div', { class: 'lab-matrices' }, [matrix('W₀ · gelée', t.base), matrix('A · entraînée', t.a), matrix('B · entraînée', t.b), matrix('ΔW = A @ B', t.delta)]));
    status.textContent = `W₀[4,4] + A[4,${r}] @ B[${r},4]. ${8*r} paramètres entraînables, contre 16 pour W₀ : ${8*r < 16 ? 'économie de paramètres' : 'ce rang ne fait plus économiser de paramètres dans ce tout petit exemple'}. ΔW[0,0]=${fmt(t.delta[0][0])}, W[0,0]=${fmt(t.weight[0][0])}. Convention du dépôt : A puis B ; échelle α/r=1 ici. La matrice de base reste inchangée.`;
  };
  host.dataset.lab = 'lora'; host.append(h('h2', { class: 'lab-title', text: 'Geler W₀ et apprendre une mise à jour de petit rang' }), rank.field, stage, status); rank.input.addEventListener('input', paint); paint();
}

function mountLossLab(host, lesson) {
  const temperature = slider('Température des logits', .2, 3, 1, .1), stage = h('div'), status = note('');
  const logits = [1.2, .2, -.4, .7];
  const paint = () => {
    const p = softmax(logits, Number(temperature.input.value)), loss = -Math.log(p[1]);
    stage.replaceChildren(matrix('Logits', [logits]), matrix('P = softmax(logits / température)', [p]), cards([{ label: 'Cible correcte : t1', value: `p=${fmt(p[1])}`, active: true }, { label: 'Cross-entropy', value: `−ln(p)=${fmt(loss)}`, detail: 'nats par token' }, { label: 'Perplexité de cette cible', value: fmt(Math.exp(loss)), detail: 'exp(perte)' }]));
    status.textContent = `Température=${temperature.input.value}, somme P=${fmt(sum(p))}. ${lesson.id === '3.7' ? 'La température redistribue la masse ; top-k sélectionne les k meilleurs scores, puis renormalise. Ce curseur ne réentraîne pas le modèle.' : 'Réduire la température ne réduit pas forcément la perte : ici la cible t1 n’est pas le plus grand logit.'} Valeurs pédagogiques, aucun entraînement exécuté.`;
  };
  host.dataset.lab = 'cross-entropy'; host.append(h('h2', { class: 'lab-title', text: 'D’un score à une probabilité, puis à la perte' }), temperature.field, stage, status); temperature.input.addEventListener('input', paint); paint();
  prediction(host, { question: 'Si la probabilité correcte vaut 1, quelle est −ln(1) ?', answer: 0, tolerance: 0, explanation: 'La perte vaut 0 ; une cible certaine ne surprend plus le modèle.' });
}

function mountMse(host) {
  const predictionValue = slider('Prédiction du premier exemple', -2, 12, 5), target = slider('Cible du premier exemple', -2, 12, 7);
  const average = h('input', { type: 'checkbox', 'aria-label': 'Ajouter un second exemple exact et calculer la moyenne' });
  const stage = h('div'), status = note('');
  const paint = () => {
    const p = Number(predictionValue.input.value), y = Number(target.input.value), error = p-y, square = error*error, count = average.checked ? 2 : 1;
    stage.replaceChildren(cards([{label:'Prédiction − cible',value:`${p} − ${y} = ${error}`},{label:'Écart au carré',value:square},{label:count===2?'Moyenne sur deux exemples':'Perte de cet exemple',value:square/count,active:true}]));
    status.textContent = `MSE = somme des écarts au carré / nombre d’exemples = ${square} / ${count} = ${fmt(square/count)}. ${average.checked?'Le second exemple a une prédiction et une cible égales à 0, donc un écart nul.':'Un seul exemple est compté.'} La perte est en unités de la cible au carré ; ce n’est pas une probabilité.`;
    host.dataset.loss = String(square/count);
  };
  host.dataset.lab='mse';host.append(h('h2',{class:'lab-title',text:'Perte quadratique : comparer, mettre au carré, moyenner'}),predictionValue.field,target.field,h('label',{},[average,'Ajouter un second exemple exact']),stage,status);
  for(const input of [predictionValue.input,target.input,average])input.addEventListener('input',paint);
  average.addEventListener('change',paint);paint();
  prediction(host,{question:'Pour prédiction 10 et cible 6, combien vaut le carré de l’écart ?',answer:16,tolerance:0,explanation:'10−6=4, puis 4²=16. Avec un second exemple exact, la moyenne vaudrait 8.'});
}

export function mountArchitectureLab(host) {
  const trace = attentionTrace(), x = ATTENTION_X, residual = x.map((r, i) => r.map((n, j) => n + trace.output[i][j])), norm = residual.map(r => normalize(r));
  const projection = [[1, 0, -1], [0, 1, 1]], logits = matmul(norm, projection);
  lab(host, { kind: 'architecture', title: 'Le trajet d’un exemple miniature', source: 'model/transformer.py', steps: [
    { title: 'Embedding', code: 'X = embedding[token_ids]  # [T,D]' },
    { title: 'Une tête causale', code: 'context = softmax(mask(Q @ K.T / sqrt(D))) @ V' },
    { title: 'Résidu', code: 'hidden = X + context' },
    { title: 'Normalisation', code: 'hidden = layernorm(hidden)' },
    { title: 'Projection vers le vocabulaire', code: 'logits = hidden @ Wout  # [T,V]' },
    { title: 'Distribution de la dernière position', code: 'P_next = softmax(logits[-1])' },
  ], render(stage, step) {
    const values = [x, trace.output, residual, norm, logits, [softmax(logits.at(-1))]][step];
    stage.append(matrix(['X', 'Contexte', 'Résidu', 'LayerNorm', 'Logits', 'Prochain token'][step], values), note(`T=3, D=2, V=3. Étape ${step+1} : les nombres sont recalculés, pas appris. Ce trajet simplifié omet le FFN, les positions, les couches répétées et la projection Wₒ du TinyGPT complet ; il sert à inspecter les formes. Le cours et le code de référence détaillent ces briques.`));
  } });
}

function mountCost(host, lesson) {
  const time = slider('Longueur du contexte T', 2, 32, 8, 2), stage = h('div'), status = note('');
  const paint = () => {
    const t = Number(time.input.value), d = 16, hkv = 2, dh = 4;
    stage.replaceChildren(cards([{ label: 'Matrice des scores / tête', value: `${t}×${t} = ${t*t}`, detail: 'éléments, pas des FLOPs' }, { label: 'Cache K+V', value: `${2*hkv*t*dh*4} octets`, detail: 'B=1, 2 têtes KV, dh=4, float32' }, { label: 'QKᵀ, multiplications', value: t*t*d, detail: `une tête de largeur ${d} ; additions non comptées` }]));
    status.textContent = `T=${t}. Doubler T multiplie les scores par 4 et le cache par 2. Estimations analytiques : elles ne mesurent ni la latence, ni l’énergie, ni ta RAM libre. ${lesson.id === '6.3' ? 'Une multiplication et une addition valent souvent 2 FLOPs ; ce tableau ne compte ici que les multiplications de QKᵀ.' : 'Les paramètres ne dépendent pas directement de T dans cet exemple.'}`;
  };
  host.dataset.lab = 'cost'; host.append(h('h2', { class: 'lab-title', text: 'Changer T et observer ce qui croît' }), time.field, stage, status); time.input.addEventListener('input', paint); paint();
}

function mountQuantization(host) {
  const bits = slider('Bits signés', 2, 8, 4), stage = h('div'), status = note('');
  const x = [-1, -.4, .1, .8];
  const paint = () => {
    const t = quantize(x, Number(bits.input.value)), error = t.restored.map((n, i) => n-x[i]);
    stage.replaceChildren(matrix('Poids float', [x]), matrix('Entiers quantifiés', [t.integers]), matrix('Valeurs reconstruites', [t.restored]), matrix('Erreur de reconstruction', [error]));
    status.textContent = `${bits.input.value} bits, échelle=${fmt(t.scale)}. Erreur max=${fmt(Math.max(...error.map(Math.abs)))}. Quantification symétrique miniature, sans point zéro ; l’échelle occupe aussi de la mémoire et la baisse de bits ne garantit pas une inférence plus rapide.`;
  };
  host.dataset.lab = 'quantization'; host.append(h('h2', { class: 'lab-title', text: 'Moins de bits : voir l’arrondi perdu' }), bits.field, stage, status); bits.input.addEventListener('input', paint); paint();
}

function mountInitialization(host) {
  const scale = slider('Écart-type des poids σ', .01, 1, .02, .01), stage = h('div'), status = note('');
  const z = [-1.5, -.8, -.4, 0, .2, .5, .9, 1.4];
  const paint = () => {
    const sigma = Number(scale.input.value), values = z.map(n => n*sigma), logits = [sum(values.slice(0, 4)), sum(values.slice(4))], p = softmax(logits);
    stage.replaceChildren(matrix('Poids = σ × échantillon fixé', [values]), matrix('Logits de deux sorties (somme)', [logits]), matrix('Probabilités', [p]));
    status.textContent = `σ=${fmt(sigma)} ; mêmes nombres de départ, échelle modifiée. Plus grande amplitude des logits → softmax plus concentré ici. Cet échantillon fixé n’est pas un histogramme statistique ni une règle d’initialisation universelle. TinyGPT utilise une normale d’écart-type 0,02 ; la profondeur et la normalisation comptent aussi.`;
  };
  host.dataset.lab = 'initialization'; host.append(h('h2', { class: 'lab-title', text: 'Changer l’échelle des poids avant d’apprendre' }), scale.field, stage, status); scale.input.addEventListener('input', paint); paint();
}

function mountFfn(host) {
  const x = [[1, -1]], w1 = [[1, 0, -1, 2], [0, 1, 1, -1]], expanded = matmul(x, w1), activated = expanded.map(row => row.map(gelu)), w2 = [[1,0],[0,1],[1,0],[0,1]];
  lab(host, { kind: 'ffn', title: 'FFN : élargir, activer, revenir à D', source: 'model/transformer.py', steps: [
    { title: 'Projection montante', code: 'expanded = X @ W1  # [T,D] @ [D,H]' }, { title: 'Activation non linéaire', code: 'activated = gelu(expanded)' }, { title: 'Projection descendante', code: 'output = activated @ W2  # [T,H] @ [H,D]' },
  ], render(stage, step) {
    stage.append(matrix('X', x), matrix(step === 0 ? 'X @ W1' : step === 1 ? 'GELU(X @ W1)' : 'GELU(X @ W1) @ W2', [expanded, activated, matmul(activated, w2)][step]), note('Miniature D=2,H=4 : la non-linéarité empêche de réduire les deux matrices à une seule. Chaque position reçoit le même FFN ; les positions ne se mélangent pas dans cette brique.'));
  } });
}

function mountAccumulation(host) {
  const steps = [
    { title: 'Remettre le gradient à zéro', code: 'grad = 0.' },
    { title: 'Premier micro-lot, pondéré', code: 'grad += (2 / 4) * grad_microbatch_1' },
    { title: 'Deuxième micro-lot, pondéré', code: 'grad += (2 / 4) * grad_microbatch_2' },
    { title: 'Une seule mise à jour', code: 'w -= learning_rate * grad' },
  ];
  lab(host, { kind: 'accumulation', title: 'Accumuler les gradients avant de modifier le poids', source: 'model/gpt_train.py', steps, render(stage, step) {
    stage.append(cards([{label:'Micro-lot 1 : 2 exemples',value:'gradient moyen = 2',detail:'contribution pondérée : 1'},{label:'Micro-lot 2 : 2 exemples',value:'gradient moyen = 6',detail:'contribution pondérée : 3'},{label:'Gradient accumulé',value:[0,1,4,4][step],active:true},{label:'Poids w, taux=0.1',value:step===3?'1 − 0.1×4 = 0.6':'1, inchangé avant step()'}]),note('Chaque backward s’ajoute au gradient. Pondérer par le nombre de cibles de chaque micro-lot quand les tailles diffèrent ; diviser seulement par le nombre de micro-lots convient aux tailles égales. Un seul optimizer.step() après l’accumulation.'));
  } });
}
function mountCheckpointing(host) {
  const store = h('input', {type:'checkbox','aria-label':'Activer le checkpointing des activations'}), stage=h('div'), status=note('');
  const paint=()=>{
    stage.replaceChildren(cards([{label:'Entrée du bloc',value:'conservée'},{label:'Intermédiaire A',value:store.checked?'recalculé au backward':'conservé en mémoire'},{label:'Intermédiaire B',value:store.checked?'recalculé au backward':'conservé en mémoire'},{label:'Sortie du bloc',value:'conservée'}]));
    status.textContent=store.checked?'Économie d’activations stockées, calcul supplémentaire au backward. Les poids et le résultat mathématique ne changent pas. Le forward rejoué doit conserver le même hasard (dropout) pour retrouver les gradients. Schéma conceptuel, sans benchmark de temps.':'Sans checkpointing : garder les activations nécessaires au backward. Ce mécanisme est différent d’une sauvegarde des poids sur disque.';
  };
  host.dataset.lab='checkpointing';host.append(h('h2',{class:'lab-title',text:'Échanger de la mémoire contre du recalcul'}),h('label',{},[store,'Recalculer les intermédiaires au retour']),stage,status);store.addEventListener('change',paint);paint();
}

import { mountSampling, mountRetrieval, mountAdaptive, mountModalities, mountPrecision } from './visual-systems.js';
import { foundationIds, mountFoundation, mountExperiment, mountHybrid, mountSplit, mountOverfit } from './visual-foundations.js';
const SPECIAL = {
  '1.9': mountMse,
  '0.15': mountMatrix, '0.18': mountMatrix, '1.15': mountGraph, '2.11': mountMatrix,
  '1.5': mountGraph, '1.7': mountGraph, '1.8': mountGraph, '1.10': mountGraph, '1.11': mountGraph, '1.12': mountGraph,
  '1.3': mountSplit, '1.17': mountOverfit, '2.2': mountSplit, '13.3': mountSplit,
  '2.1': mountTokenizerLab, '2.3': mountTokenizerLab, '2.6': mountBpeLab, '2.7': mountBpeLab,
  '3.7': mountSampling, '3.9': mountSampling,
  '4.8': mountResidual, '4.9': mountNorm, '4.10': mountFfn,
  '5.1': mountRope, '5.2': mountRope, '5.3': mountNorm, '5.4': mountGate, '5.5': mountGqa, '5.6': mountCache, '5.7': mountTying, '5.8': mountInitialization, '5.9': mountCost, '5.10': mountExperiment,
  '6.1': mountPrecision, '6.2': mountPrecision, '6.6': mountPrecision, '6.3': mountCost, '6.5': mountMatrix, '6.9': mountQuantization, '6.7': mountAccumulation, '6.8': mountCheckpointing,
  '9.1': mountModalities, '9.4': mountModalities, '9.5': mountModalities, '9.8': mountModalities, '9.9': mountModalities,
  '10.5': mountAdaptive, '10.6': mountAdaptive, '10.7': mountAdaptive, '10.8': mountAdaptive,
  '8.9': mountHybrid, '12.7': mountHybrid, '12.8': mountHybrid,
  '13.5': mountSft, '13.6': mountSft,
};
const FAMILIES = { retrieve: mountRetrieval, embed: mountVectors, tokenize: mountTokenizerLab, bpe: mountBpeLab, descent: mountDescentLab, relu: mountReluLab, loss: mountLossLab, attention: mountAttentionLab, transformer: mountArchitectureLab, moe: mountMoeLab, scan: mountScanLab, patches: mountPatchesLab, lora: mountLoraLab };
export function hasVisualLab(lesson) {
  return foundationIds.has(lesson.id) || Boolean(SPECIAL[lesson.id] || FAMILIES[lesson.visual]) || lesson.id.startsWith('11.') || lesson.id.startsWith('12.');
}
export function mountVisualLab(host, lesson) {
  if (mountFoundation(host, lesson)) return true;
  const build = SPECIAL[lesson.id] || ((lesson.id.startsWith('11.') || lesson.id.startsWith('12.')) ? mountExperiment : FAMILIES[lesson.visual]);
  if (!build) return false;
  build(host, lesson); return true;
}
