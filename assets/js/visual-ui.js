/** Éléments communs : valeurs lisibles sans couleur, clavier natif et lecture manuelle. */
import { h } from './dom.js';
export const fmt = n => n === -Infinity ? '−∞' : Number.isInteger(n) ? String(n) : Number(n).toFixed(3);
export const note = text => h('p', { class: 'visual-readout', text });
export const action = (text, onClick, attrs = {}) => h('button', { type: 'button', class: 'visual-button', onClick, ...attrs }, text);
export function slider(label, min, max, value, step = 1) {
  const input = h('input', { type: 'range', min, max, value, step, 'aria-label': label });
  return { input, field: h('label', {}, [label, input]) };
}
export function svg(name, attrs = {}, children = []) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  for (const child of children) node.append(child);
  return node;
}
export function matrix(label, values, { selected = () => false, onCell, rowNames, colNames } = {}) {
  const table = h('table', { class: 'lab-matrix' }, [h('caption', { text: `${label} · [${values.length}, ${values[0].length}]` })]);
  const head = h('tr', {}, [h('th', { scope: 'col', text: 'r / c' }), ...values[0].map((_, j) => h('th', { scope: 'col', text: colNames?.[j] ?? j }))]);
  table.append(h('thead', {}, head));
  const body = h('tbody');
  values.forEach((row, i) => body.append(h('tr', {}, [
    h('th', { scope: 'row', text: rowNames?.[i] ?? i }), ...row.map((n, j) => {
      const attrs = { class: selected(i, j) ? 'is-selected' : '', 'data-cell': `${i},${j}` };
      return h('td', attrs, onCell ? action(fmt(n), () => onCell(i, j), {
        'aria-label': `${label}, ligne ${i}, colonne ${j} : ${fmt(n)}`, 'aria-pressed': String(selected(i, j)),
      }) : fmt(n));
    }),
  ])));
  table.append(body);
  return h('div', { class: 'lab-table-scroll', tabindex: '0', role: 'group', 'aria-label': `Tableau ${label}` }, table);
}
export function cards(items) {
  return h('ol', { class: 'lab-nodes' }, items.map(({ label, value, active = false, detail = '' }) =>
    h('li', { class: active ? 'is-selected' : '' }, [h('strong', { text: label }), h('span', { text: String(value) }), detail ? h('small', { text: detail }) : null])));
}
export function prediction(host, { question, answer, explanation, tolerance = .015 }) {
  const input = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': question, autocomplete: 'off' });
  const status = h('p', { role: 'status', class: 'lab-feedback' });
  const check = () => {
    const value = Number(input.value.trim().replace(',', '.'));
    const correct = input.value.trim() !== '' && Number.isFinite(value) && Math.abs(value - Number(typeof answer === 'function' ? answer() : answer)) <= tolerance;
    status.textContent = `${correct ? 'Correct.' : 'À revoir.'} ${typeof explanation === 'function' ? explanation() : explanation}`;
    status.dataset.correct = String(correct);
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
  host.append(h('details', { class: 'lab-predict' }, [h('summary', { text: 'À toi de prédire' }), h('label', {}, [question, input]), action('Vérifier la prédiction', check), status]));
}
export function lab(host, { kind, title, source, steps, render, initial = 0 }) {
  host.dataset.lab = kind;
  const stage = h('div', { class: 'lab-stage' });
  const code = h('pre', { class: 'lab-code', tabindex: '0', 'aria-label': 'Code NumPy équivalent à l’étape' });
  const count = note('');
  count.setAttribute('role', 'status');
  let index = initial;
  const prev = action('Étape précédente', () => { index--; paint(); });
  const next = action('Étape suivante', () => { index++; paint(); });
  const tabs = h('div', { class: 'lab-tabs', role: 'group', 'aria-label': 'Vue du laboratoire' });
  for (const [view, label] of [['calculation', 'Calcul et schéma'], ['code', 'Code de l’étape']]) tabs.append(action(label, () => {
    host.dataset.view = view;
    for (const b of tabs.children) b.setAttribute('aria-pressed', String(b.dataset.view === view));
  }, { 'data-view': view, 'aria-pressed': String(view === 'calculation') }));
  const paint = () => {
    index = Math.max(0, Math.min(steps.length - 1, index));
    prev.disabled = index === 0; next.disabled = index === steps.length - 1;
    const step = steps[index];
    stage.replaceChildren();
    render(stage, index);
    count.textContent = `${index + 1} / ${steps.length} · ${step.title}`;
    code.replaceChildren(...steps.map((s, i) => h('code', { class: i === index ? 'is-active' : '', 'aria-current': i === index ? 'step' : null, text: `${i + 1}  ${s.code}\n` })));
    host.dataset.step = String(index);
  };
  host.append(h('h2', { class: 'lab-title', text: title }), h('p', { class: 'lab-caption', text: 'Exemple miniature calculé ici. Avance à ton rythme ; les valeurs arrondies servent à lire le calcul.' }),
    tabs, h('div', { class: 'lab-layout' }, [stage, code]),
    h('div', { class: 'lab-controls' }, [prev, next, action('Rejouer', () => { index = 0; paint(); })]), count,
    h('p', { class: 'lab-source' }, ['NumPy équivalent, sans lancer Python. ', h('a', { href: `https://github.com/sk34pk25/ai-from-zero/blob/main/${source}`, text: `Code de référence : ${source}` })]));
  paint();
  return { repaint: paint, get step() { return index; } };
}
/** Courbe avec marges, axes, unités, styles et lecture exacte au clavier/toucher. */
export function chart(label, series, { xLabel = 'Pas', yLabel = 'Perte (nats / token)', point } = {}) {
  const all = series.flatMap(s => s.values), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
  const minX = Math.min(0, ...xs), maxX = Math.max(1, ...xs);
  const minY = Math.min(0, ...ys), maxY = Math.max(1, ...ys) * 1.12;
  const px = x => 56 + (x - minX) / (maxX - minX) * 370;
  const py = y => 208 - (y - minY) / (maxY - minY) * 168;
  const canvas = svg('svg', { viewBox: '0 0 450 258', role: 'img', 'aria-label': label, class: 'visual-svg lab-chart' });
  canvas.append(svg('path', { d: 'M56 28V208H432', fill: 'none', stroke: 'currentColor' }));
  const text = (x, y, t, attrs = {}) => { const n = svg('text', { x, y, fill: 'currentColor', ...attrs }); n.textContent = t; return n; };
  for (let i = 0; i <= 4; i++) {
    const x = minX + (maxX - minX) * i / 4, y = minY + (maxY - minY) * i / 4;
    canvas.append(text(px(x), 226, fmt(x), { 'text-anchor': 'middle' }), text(49, py(y) + 4, fmt(y), { 'text-anchor': 'end' }));
  }
  canvas.append(text(242, 249, xLabel, { 'text-anchor': 'middle' }), text(8, 16, yLabel));
  series.forEach((s, i) => canvas.append(svg('polyline', {
    points: s.values.map(([x, y]) => `${px(x)},${py(y)}`).join(' '), class: i ? 'is-val' : 'is-train', fill: 'none', 'stroke-width': 2.5, 'stroke-dasharray': i ? '6 4' : 'none',
  })));
  if (point) canvas.append(svg('circle', { cx: px(point[0]), cy: py(point[1]), r: 5, 'data-chart-point': 'true' }));
  return h('div', { class: 'lab-chart-wrap' }, [canvas, h('p', { class: 'lab-legend' }, series.map((s, i) => h('span', { class: i ? 'is-val' : 'is-train', text: `${i ? '┄' : '━'} ${s.name}` })))]);
}
