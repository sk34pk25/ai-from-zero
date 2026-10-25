/** Même algorithme que model/bpe.py : fréquence, puis paire plus petite. */

export function mergePair(tokens, pair) {
  const [left, right] = pair;
  const piece = left + right;
  const merged = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (index < tokens.length - 1 && tokens[index] === left && tokens[index + 1] === right) {
      merged.push(piece);
      index += 1;
    } else {
      merged.push(tokens[index]);
    }
  }
  return merged;
}

export function bestPair(tokens) {
  const counts = new Map();
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const key = `${tokens[index]}\u0000${tokens[index + 1]}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  if (counts.size === 0) return null;
  let best = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    const pair = key.split("\u0000");
    const betterCount = count > bestCount;
    const tie = count === bestCount && best && (pair[0] < best[0] || (pair[0] === best[0] && pair[1] < best[1]));
    if (betterCount || tie || best === null) {
      if (betterCount || tie || best === null) {
        best = pair;
        bestCount = count;
      }
    }
  }
  return { pair: best, count: bestCount };
}

export function trainSteps(text, limit) {
  let tokens = [...text];
  const steps = [];
  for (let index = 0; index < limit; index += 1) {
    const found = bestPair(tokens);
    if (!found) break;
    tokens = mergePair(tokens, found.pair);
    steps.push({ pair: found.pair, count: found.count, tokens: tokens.slice() });
  }
  return steps;
}

export function encodeWithMerges(text, merges) {
  let tokens = [...text];
  for (const pair of merges) tokens = mergePair(tokens, pair);
  return tokens;
}
