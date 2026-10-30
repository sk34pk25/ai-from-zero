/** Petits calculs déterministes des laboratoires visuels. Aucune mesure d'entraînement simulée. */
export const sum = values => values.reduce((a, b) => a + b, 0);
export function softmax(values, temperature = 1) {
  if (!(temperature > 0) || !values.length) throw new RangeError('Température et scores requis');
  const max = Math.max(...values);
  const exp = values.map(x => Math.exp((x - max) / temperature));
  const total = sum(exp);
  return exp.map(x => x / total);
}
export const transpose = a => a[0].map((_, j) => a.map(row => row[j]));
export function matmul(a, b) {
  if (!a.length || !b.length || a.some(row => row.length !== b.length) || b.some(row => row.length !== b[0].length))
    throw new RangeError('Les dimensions internes doivent correspondre');
  return a.map(row => b[0].map((_, j) => sum(row.map((x, k) => x * b[k][j]))));
}
export const ATTENTION_X = [[1, 0], [0, 1], [1, 1]];
export function attentionTrace(x = ATTENTION_X, causal = true) {
  const q = x.map(row => [...row]), k = x.map(row => [...row]), v = x.map(row => row.map(n => n * 2));
  const scores = matmul(q, transpose(k)).map(row => row.map(n => n / Math.sqrt(q[0].length)));
  const masked = scores.map((row, i) => row.map((n, j) => causal && j > i ? -Infinity : n));
  const weights = masked.map(row => softmax(row));
  return { x, q, k, v, scores, masked, weights, output: matmul(weights, v) };
}
export function graphTrace(w = 2, x = 3, b = 1, target = 4) {
  const product = w * x, z = product + b, y = Math.max(0, z), loss = (y - target) ** 2;
  const dy = 2 * (y - target), dz = z > 0 ? dy : 0;
  return { w, x, b, target, product, z, y, loss, dy, dz, dw: dz * x, dx: dz * w, db: dz };
}
export function normalize(values, rms = false, eps = 1e-5) {
  const mean = rms ? 0 : sum(values) / values.length;
  const scale = Math.sqrt(sum(values.map(x => (x - mean) ** 2)) / values.length + eps);
  return values.map(x => (x - mean) / scale);
}
export function rotate([x, y], angle) {
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}
export const silu = x => x / (1 + Math.exp(-x));
export const gelu = x => .5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + .044715 * x ** 3)));
export const MOE_SCORES = [[2.2, .2, -1], [2, 1.8, .2], [1.9, .3, 2.1]];
export function routeExperts(scores = MOE_SCORES, topK = 1, factor = 1.25) {
  const n = scores.length, e = scores[0].length;
  if (!Number.isInteger(topK) || topK < 1 || topK > e || !(factor > 0)) throw new RangeError('1 ≤ k ≤ E ; capacité positive');
  const capacity = Math.max(1, Math.ceil(factor * n / e)), used = Array(e).fill(0);
  const choices = scores.map(row => row.map((_, i) => i).sort((a, b) => row[b] - row[a] || a - b).slice(0, topK));
  let dropped = 0;
  const routes = choices.map((experts, i) => {
    const gates = softmax(experts.map(j => scores[i][j]));
    return experts.map((j, slot) => {
      const accepted = used[j] < capacity;
      if (accepted) used[j]++; else dropped++;
      return { expert: j, gate: gates[slot], accepted };
    });
  });
  const probs = scores.map(row => softmax(row));
  const fractions = used.map((_, j) => choices.filter(row => row[0] === j).length / n);
  const meanProbs = used.map((_, j) => sum(probs.map(row => row[j])) / n);
  return { choices, routes, capacity, used, dropped, aux: e * sum(fractions.map((f, j) => f * meanProbs[j])) };
}
export function scanTrace(signal = [1, 0, 2, 0], keep = .7, selective = false) {
  let state = 0;
  return signal.map((x, t) => {
    const previous = state;
    // Récurrence affine pédagogique ; pas le forward complet de Mamba.
    const a = selective && x !== 0 ? keep / 2 : keep;
    state = a * state + x;
    return { t, x, a, previous, state };
  });
}
export function loraTrace(rank = 1) {
  const base = Array.from({ length: 4 }, (_, i) => Array.from({ length: 4 }, (_, j) => +(i === j))), a = Array.from({ length: 4 }, (_, i) => Array.from({ length: rank }, (_, r) => (i + r + 1) / 10));
  const b = Array.from({ length: rank }, (_, r) => [r + 1, 1 - r, .5, -.5]);
  const delta = matmul(a, b), weight = base.map((row, i) => row.map((n, j) => n + delta[i][j]));
  return { base, a, b, delta, weight };
}
export function descentStep(x, rate) { return x - rate * 2 * x; }
export function quantize(values, bits = 4) {
  const bound = 2 ** (bits - 1) - 1, scale = Math.max(...values.map(Math.abs)) / bound || 1;
  const integers = values.map(x => Math.max(-bound, Math.min(bound, Math.round(x / scale))));
  return { scale, integers, restored: integers.map(q => q * scale) };
}
