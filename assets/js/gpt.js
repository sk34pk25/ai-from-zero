/** Forward TinyGPT (positions absolues, LayerNorm, GELU) en JavaScript pur.
 *
 * Les formules suivent model/transformer.py et model/mathutil.py.
 * Les poids arrivent en float32 ; les calculs sont en nombre JS (float64).
 */

import { encodeWithMerges } from "./bpe.js";

const EPS = 1e-5;

export function decodeF32(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Float32Array(bytes.buffer);
}

export function nested(flat, shape) {
  if (shape.length === 1) return Array.from(flat);
  const [head, ...rest] = shape;
  const stride = rest.reduce((product, value) => product * value, 1);
  const rows = [];
  for (let index = 0; index < head; index += 1) {
    rows.push(nested(flat.subarray(index * stride, (index + 1) * stride), rest));
  }
  return rows;
}

export function loadModel(payload) {
  const tensors = {};
  for (const [name, spec] of Object.entries(payload.tensors)) {
    tensors[name] = nested(decodeF32(spec.b64), spec.shape);
  }
  return { config: payload.config, tokenizer: payload.tokenizer, tensors };
}

export function encodePrompt(tokenizer, text) {
  if (tokenizer.kind === "char") {
    const ids = [];
    for (const char of text) {
      if (!(char in tokenizer.stoi)) throw new Error(`caractère absent : ${char}`);
      ids.push(tokenizer.stoi[char]);
    }
    return ids;
  }
  const unknown = [...new Set([...text].filter((char) => !(char in tokenizer.vocab)))];
  if (unknown.length) throw new Error(`caractères absents : ${unknown.join("")}`);
  const merges = tokenizer.merges.map((pair) => [pair[0], pair[1]]);
  const tokens = encodeWithMerges(text, merges);
  return tokens.map((token) => tokenizer.vocab[token]);
}

export function decodeIds(tokenizer, ids) {
  if (tokenizer.kind === "char") {
    const itos = Object.fromEntries(Object.entries(tokenizer.stoi).map(([char, index]) => [index, char]));
    return ids.map((index) => itos[index]).join("");
  }
  const itos = Object.fromEntries(Object.entries(tokenizer.vocab).map(([token, index]) => [index, token]));
  return ids.map((index) => itos[index]).join("");
}

function mm(left, right) {
  const rows = left.length;
  const cols = right[0].length;
  const shared = right.length;
  const out = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let row = 0; row < rows; row += 1) {
    const source = left[row];
    const dest = out[row];
    for (let mid = 0; mid < shared; mid += 1) {
      const factor = source[mid];
      const line = right[mid];
      for (let col = 0; col < cols; col += 1) dest[col] += factor * line[col];
    }
  }
  return out;
}

function transpose2(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const out = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) out[col][row] = matrix[row][col];
  }
  return out;
}

function addRows(left, right) {
  return left.map((row, index) => row.map((value, column) => value + right[index][column]));
}

function layernorm(rows, gain, bias) {
  return rows.map((row) => {
    const mean = row.reduce((sum, value) => sum + value, 0) / row.length;
    const variance = row.reduce((sum, value) => sum + (value - mean) ** 2, 0) / row.length;
    const scale = Math.sqrt(variance + EPS);
    return row.map((value, index) => gain[index] * ((value - mean) / scale) + bias[index]);
  });
}

function gelu(rows) {
  const scale = Math.sqrt(2 / Math.PI);
  return rows.map((row) => row.map((value) => {
    const inner = scale * (value + 0.044715 * value ** 3);
    return 0.5 * value * (1 + Math.tanh(inner));
  }));
}

function softmaxRows(rows) {
  return rows.map((row) => {
    const max = Math.max(...row);
    const exps = row.map((value) => Math.exp(value - max));
    const sum = exps.reduce((total, value) => total + value, 0);
    return exps.map((value) => value / sum);
  });
}

function attention(hidden, tensors, layer, config) {
  const heads = config.n_heads;
  const headDim = config.d_model / heads;
  const prefix = `l${layer}`;
  const query = mm(hidden, tensors[`${prefix}.wq`]);
  const key = mm(hidden, tensors[`${prefix}.wk`]);
  const value = mm(hidden, tensors[`${prefix}.wv`]);
  const time = hidden.length;
  const scale = 1 / Math.sqrt(headDim);
  const contexts = Array.from({ length: time }, () => new Array(config.d_model).fill(0));
  let headWeights = null;
  for (let head = 0; head < heads; head += 1) {
    const q = query.map((row) => row.slice(head * headDim, (head + 1) * headDim));
    const k = key.map((row) => row.slice(head * headDim, (head + 1) * headDim));
    const v = value.map((row) => row.slice(head * headDim, (head + 1) * headDim));
    const scores = mm(q, transpose2(k)).map((row, rowIndex) => row.map((value, column) => (
      column <= rowIndex ? value * scale : -1e9
    )));
    const weights = softmaxRows(scores);
    if (head === 0) headWeights = weights;
    const mixed = mm(weights, v);
    for (let row = 0; row < time; row += 1) {
      for (let dim = 0; dim < headDim; dim += 1) contexts[row][head * headDim + dim] = mixed[row][dim];
    }
  }
  return { out: mm(contexts, tensors[`${prefix}.wo`]), weights: headWeights };
}

export function forward(model, ids) {
  const { config, tensors } = model;
  if (config.pos !== "absolute" || config.norm !== "layer" || config.ffn !== "gelu") {
    throw new Error("le playground couvre le decoder entraîné : positions absolues, LayerNorm, GELU");
  }
  const time = ids.length;
  if (time > config.block_size) throw new Error("séquence trop longue");
  let hidden = ids.map((token, position) => tensors.tok[token].map((value, index) => value + tensors.pos[position][index]));
  let attentionWeights = null;
  for (let layer = 0; layer < config.n_layers; layer += 1) {
    const attended = attention(layernorm(hidden, tensors[`l${layer}.n1g`], tensors[`l${layer}.n1b`]), tensors, layer, config);
    hidden = addRows(hidden, attended.out);
    attentionWeights = attended.weights;
    const mid = gelu(mm(layernorm(hidden, tensors[`l${layer}.n2g`], tensors[`l${layer}.n2b`]), tensors[`l${layer}.w1`]));
    hidden = addRows(hidden, mm(mid, tensors[`l${layer}.w2`]));
  }
  hidden = layernorm(hidden, tensors.nfg, tensors.nfb);
  return { logits: mm(hidden, tensors.head), attention: attentionWeights };
}

export function softmax1(logits, temperature = 1) {
  const scaled = temperature === 0 ? logits : logits.map((value) => value / temperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / sum);
}

export function topIndices(values, k) {
  return values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => b.value - a.value)
    .slice(0, k);
}

export function sampleIndex(logits, temperature, topK, random = Math.random) {
  if (temperature === 0) {
    let best = 0;
    for (let index = 1; index < logits.length; index += 1) if (logits[index] > logits[best]) best = index;
    return best;
  }
  const scores = logits.map((value) => value / temperature);
  if (topK && topK < scores.length) {
    const limit = topIndices(scores, topK).at(-1).value;
    for (let index = 0; index < scores.length; index += 1) if (scores[index] < limit) scores[index] = -1e9;
  }
  const probs = softmax1(scores, 1);
  let cursor = random();
  for (let index = 0; index < probs.length; index += 1) {
    cursor -= probs[index];
    if (cursor <= 0) return index;
  }
  return probs.length - 1;
}
