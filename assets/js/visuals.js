/** Schémas et manipulations. Un seul visuel est monté : celui de la leçon ouverte. */

const NS = "http://www.w3.org/2000/svg";

function svgEl(name, attrs) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function svgCanvas(label, width, height) {
  const svg = svgEl("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": label });
  svg.classList.add("visual-svg");
  return svg;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function control(labelText, input) {
  const label = document.createElement("label");
  label.append(document.createTextNode(labelText), input);
  return label;
}

function range(attrs) {
  const input = document.createElement("input");
  input.type = "range";
  for (const [key, value] of Object.entries(attrs)) input.setAttribute(key, String(value));
  return input;
}

function button(text, onClick) {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "visual-button";
  node.textContent = text;
  node.addEventListener("click", onClick);
  return node;
}

function readout(text) {
  const node = document.createElement("p");
  node.className = "visual-readout";
  node.textContent = text;
  return node;
}

function mountTokenize(host) {
  const input = document.createElement("input");
  input.type = "text";
  input.value = "chat";
  input.setAttribute("data-visual-input", "true");
  input.setAttribute("aria-label", "Texte à découper");
  const board = document.createElement("div");
  board.className = "token-board";
  const note = readout("");
  const paint = () => {
    const text = input.value;
    const chars = [...new Set([...text])].sort();
    const stoi = Object.fromEntries(chars.map((char, index) => [char, index]));
    board.replaceChildren();
    for (const char of text) {
      const chip = document.createElement("span");
      chip.className = "token-chip";
      chip.textContent = `${char} · ${stoi[char]}`;
      board.append(chip);
    }
    note.textContent = text
      ? `${[...text].length} caractères, vocabulaire ${chars.length}. L'espace compte, s'il y en a un.`
      : "Le texte est vide : le tokenizer du laboratoire refuserait un corpus vide.";
  };
  input.addEventListener("input", paint);
  host.append(control("Texte", input), board, note);
  paint();
}

function softmaxRows(logits, temperature) {
  const scaled = logits.map((value) => value / temperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((value) => Math.exp(value - max));
  const sum = exps.reduce((total, value) => total + value, 0);
  return exps.map((value) => value / sum);
}

function mountSoftmax(host) {
  const logits = [1.2, 0.2, -0.4, 0.7];
  const temperature = range({ min: "0.2", max: "3", step: "0.1", value: "1", "data-temperature": "true", "aria-label": "Température" });
  const bars = document.createElement("div");
  bars.className = "visual-bars";
  const note = readout("");
  const paint = () => {
    const temp = Number(temperature.value);
    const probs = softmaxRows(logits, temp);
    bars.replaceChildren();
    probs.forEach((prob, index) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      const name = document.createElement("span");
      name.textContent = `t${index}`;
      const track = document.createElement("span");
      track.className = "bar-track";
      const fill = document.createElement("span");
      fill.className = "bar-fill";
      fill.style.transform = `scaleX(${prob})`;
      track.append(fill);
      const value = document.createElement("span");
      value.textContent = prob.toFixed(2);
      row.append(name, track, value);
      bars.append(row);
    });
    note.textContent = `Température ${temp.toFixed(1)}. La somme vaut ${probs.reduce((a, b) => a + b, 0).toFixed(2)}.`;
  };
  temperature.addEventListener("input", paint);
  host.append(control("Température", temperature), bars, note);
  paint();
}

function mountDescent(host) {
  const rate = range({ min: "0.05", max: "1.1", step: "0.05", value: "0.15", "aria-label": "Pas d'apprentissage" });
  const canvas = svgCanvas("Descente sur une parabole", 320, 160);
  const note = readout("");
  let x = 2.2;
  const paint = () => {
    canvas.replaceChildren();
    const curve = [];
    for (let i = 0; i <= 32; i += 1) {
      const px = -2.4 + (4.8 * i) / 32;
      const py = px * px;
      curve.push(`${20 + ((px + 2.4) / 4.8) * 280},${140 - py * 22}`);
    }
    canvas.append(svgEl("polyline", { points: curve.join(" "), fill: "none", stroke: "currentColor", "stroke-width": "2" }));
    const dotX = 20 + ((x + 2.4) / 4.8) * 280;
    const dotY = 140 - x * x * 22;
    canvas.append(svgEl("circle", { cx: dotX, cy: dotY, r: "6", fill: "var(--accent)" }));
    note.textContent = `x = ${x.toFixed(2)}, pente = ${(2 * x).toFixed(2)}, pas = ${Number(rate.value).toFixed(2)}.`;
  };
  host.append(
    control("Pas", rate),
    button("Un pas", () => {
      const lr = Number(rate.value);
      x -= lr * 2 * x;
      paint();
    }),
    button("Replacer en haut", () => {
      x = 2.2;
      paint();
    }),
    canvas,
    note,
  );
  rate.addEventListener("input", paint);
  paint();
}

function mountLoss(host) {
  const canvas = svgCanvas("Courbe de perte", 320, 150);
  const note = readout("");
  let losses = [1.4];
  const paint = () => {
    canvas.replaceChildren();
    const max = Math.max(...losses, 0.2);
    const points = losses.map((value, index) => {
      const px = 16 + (index / Math.max(losses.length - 1, 1)) * 288;
      const py = 130 - (value / max) * 110;
      return `${px},${py}`;
    });
    canvas.append(svgEl("polyline", { points: points.join(" "), fill: "none", stroke: "var(--accent)", "stroke-width": "2.5" }));
    note.textContent = `Pas ${losses.length - 1}, perte ${losses[losses.length - 1].toFixed(3)}. Cette courbe est une illustration ; l'entraînement réel est dans model/tiny_lm.py.`;
  };
  host.append(
    button("Un pas d'entraînement", () => {
      const last = losses[losses.length - 1];
      losses = [...losses, last * 0.82 + 0.02];
      paint();
    }),
    canvas,
    note,
  );
  paint();
}

function mountAttention(host) {
  const tokens = ["le", "chat", "dort", "ici"];
  let query = 2;
  const row = document.createElement("div");
  row.className = "token-board";
  const grid = document.createElement("div");
  grid.className = "heat-grid";
  const note = readout("");
  const weights = (q) => tokens.map((_, key) => (key <= q ? 1 : 0));
  const paint = () => {
    row.replaceChildren();
    tokens.forEach((token, index) => {
      const chip = button(token, () => {
        query = index;
        paint();
      });
      if (index === query) chip.classList.add("is-on");
      chip.setAttribute("aria-pressed", index === query ? "true" : "false");
      row.append(chip);
    });
    const raw = weights(query);
    const sum = raw.reduce((total, value) => total + value, 0);
    grid.replaceChildren();
    raw.forEach((value, index) => {
      const cell = document.createElement("span");
      const share = value / sum;
      cell.textContent = `${tokens[index]} ${share.toFixed(2)}`;
      cell.className = value === 0 ? "is-off" : "is-on";
      grid.append(cell);
    });
    note.textContent = `La position « ${tokens[query]} » répartit sa masse sur ${sum} token${sum > 1 ? "s" : ""} passé${sum > 1 ? "s" : ""}, elle comprise. Le futur est à zéro.`;
  };
  host.append(row, grid, note);
  paint();
}

function mountTransformer(host) {
  const stages = [
    ["Tokens", "des identifiants"],
    ["Embedding", "des vecteurs de largeur D"],
    ["Attention", "un mélange du passé"],
    ["Résidu", "l'entrée plus le mélange"],
    ["FFN", "une transformation par position"],
    ["Logits", "un score par token du vocabulaire"],
  ];
  let step = 0;
  const list = document.createElement("ol");
  list.className = "flow-list";
  const note = readout("");
  const paint = () => {
    list.replaceChildren();
    stages.forEach(([name, detail], index) => {
      const item = document.createElement("li");
      item.textContent = `${name} — ${detail}`;
      if (index === step) item.className = "is-on";
      if (index > step) item.className = "is-dim";
      list.append(item);
    });
    const [name, detail] = stages[step];
    note.textContent = `Étape ${step + 1} / ${stages.length} : ${name}, ${detail}.`;
  };
  host.append(
    button("Étape suivante", () => {
      step = (step + 1) % stages.length;
      paint();
    }),
    list,
    note,
  );
  paint();
}

function mountMoe(host) {
  const tokens = [
    [2.2, 0.2, -1],
    [0.1, 1.8, 0.2],
    [-0.4, 0.3, 2.1],
  ];
  const experts = ["E0", "E1", "E2"];
  const board = document.createElement("div");
  board.className = "token-board";
  const note = readout("");
  tokens.forEach((scores, index) => {
    const best = scores.indexOf(Math.max(...scores));
    board.append(button(`token ${index} → ${experts[best]}`, () => {
      note.textContent = `Le token ${index} a pour scores ${scores.map((value) => value.toFixed(1)).join(", ")}. Top-1 choisit ${experts[best]}. Les autres experts ne calculent pas ce token.`;
    }));
  });
  host.append(board, note);
  note.textContent = "Clique un token pour voir quel expert reçoit le calcul.";
}

function mountScan(host) {
  const forget = range({ min: "0", max: "1", step: "0.05", value: "0.35", "aria-label": "Force d'oubli" });
  const bars = document.createElement("div");
  bars.className = "visual-bars";
  const note = readout("");
  const signal = [1, 0, 0, 0, 0];
  const paint = () => {
    const keep = 1 - Number(forget.value);
    let state = 0;
    const values = signal.map((value) => {
      state = keep * state + value;
      return state;
    });
    bars.replaceChildren();
    values.forEach((value, index) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      const name = document.createElement("span");
      name.textContent = `t${index}`;
      const track = document.createElement("span");
      track.className = "bar-track";
      const fill = document.createElement("span");
      fill.className = "bar-fill";
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, value))})`;
      track.append(fill);
      const label = document.createElement("span");
      label.textContent = value.toFixed(2);
      row.append(name, track, label);
      bars.append(row);
    });
    note.textContent = `Oubli ${Number(forget.value).toFixed(2)}. L'impulsion du début vaut encore ${values[4].toFixed(2)} au dernier pas.`;
  };
  forget.addEventListener("input", paint);
  host.append(control("Oubli", forget), bars, note);
  paint();
}

function mountEmbed(host) {
  const words = {
    chat: [0.9, 0.2],
    chien: [0.7, 0.35],
    code: [-0.6, 0.8],
    loss: [-0.4, -0.7],
  };
  const names = Object.keys(words);
  let left = "chat";
  let right = "chien";
  const board = document.createElement("div");
  board.className = "token-board";
  const note = readout("");
  const paint = () => {
    board.replaceChildren();
    for (const name of names) {
      const chip = button(name, () => {
        if (left === name) return;
        right = left;
        left = name;
        paint();
      });
      if (name === left || name === right) chip.classList.add("is-on");
      board.append(chip);
    }
    const a = words[left];
    const b = words[right];
    const dot = a[0] * b[0] + a[1] * b[1];
    const na = Math.hypot(...a);
    const nb = Math.hypot(...b);
    note.textContent = `${left} · ${right} = ${(dot / (na * nb)).toFixed(2)} (cosinus). Ce plan est un dessin, pas l'embedding entraîné.`;
  };
  host.append(board, note);
  paint();
}

function mountBigram(host) {
  const rows = {
    a: [0.1, 0.8, 0.1],
    b: [0.7, 0.1, 0.2],
    c: [0.2, 0.2, 0.6],
  };
  const labels = ["a", "b", "c"];
  let current = "a";
  const board = document.createElement("div");
  board.className = "token-board";
  const bars = document.createElement("div");
  bars.className = "visual-bars";
  const note = readout("");
  const paint = () => {
    board.replaceChildren();
    for (const label of labels) {
      const chip = button(label, () => {
        current = label;
        paint();
      });
      chip.setAttribute("aria-pressed", label === current ? "true" : "false");
      if (label === current) chip.classList.add("is-on");
      board.append(chip);
    }
    bars.replaceChildren();
    rows[current].forEach((prob, index) => {
      const row = document.createElement("div");
      row.className = "bar-row";
      const name = document.createElement("span");
      name.textContent = labels[index];
      const track = document.createElement("span");
      track.className = "bar-track";
      const fill = document.createElement("span");
      fill.className = "bar-fill";
      fill.style.transform = `scaleX(${prob})`;
      track.append(fill);
      const value = document.createElement("span");
      value.textContent = prob.toFixed(2);
      row.append(name, track, value);
      bars.append(row);
    });
    note.textContent = `Après « ${current} », la ligne somme à 1. Le bigramme ne regarde pas plus loin.`;
  };
  host.append(board, bars, note);
  paint();
}

function mountPatches(host) {
  const note = readout("Les cases marquées forment le carré en haut à gauche.");
  const grid = document.createElement("div");
  grid.className = "patch-grid";
  const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  values.forEach((value, index) => {
    const cell = document.createElement("span");
    cell.textContent = String(value);
    const row = Math.floor(index / 4);
    const col = index % 4;
    if (row < 2 && col < 2) cell.className = "is-patch";
    grid.append(cell);
  });
  host.append(
    grid,
    button("Rappeler l'ordre", () => {
      note.textContent = "Le premier patch 2×2 vaut 0, 1, 4, 5. La première ligne entière serait 0, 1, 2, 3, et ce n'est pas un patch.";
    }),
    note,
  );
}

function mountRelu(host) {
  const input = range({ min: "-3", max: "3", step: "0.1", value: "-1", "aria-label": "Entrée de ReLU" });
  const note = readout("");
  const paint = () => {
    const value = Number(input.value);
    const out = Math.max(0, value);
    note.textContent = `ReLU(${value.toFixed(1)}) = ${out.toFixed(1)}. ${value < 0 ? "Le négatif est coupé, le gradient local est nul." : "La valeur passe, le gradient local vaut 1."}`;
  };
  input.addEventListener("input", paint);
  host.append(control("Entrée", input), note);
  paint();
}

function mountRetrieve(host) {
  const docs = [
    "le gradient indique la pente de la loss",
    "le tokenizer decoupe le texte",
    "la mémoire externe se retire",
  ];
  const input = document.createElement("input");
  input.type = "search";
  input.value = "pente";
  input.setAttribute("aria-label", "Question à comparer aux documents");
  const list = document.createElement("ol");
  list.className = "flow-list";
  const paint = () => {
    const query = new Set(input.value.toLowerCase().split(/\s+/).filter(Boolean));
    const scored = docs.map((doc, index) => {
      const words = new Set(doc.split(/\s+/));
      const score = [...query].filter((word) => words.has(word)).length;
      return { doc, index, score };
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    list.replaceChildren();
    for (const row of scored) {
      const item = document.createElement("li");
      item.textContent = `${row.score} mot${row.score > 1 ? "s" : ""} — ${row.doc}`;
      if (row === scored[0] && row.score > 0) item.className = "is-on";
      list.append(item);
    }
  };
  input.addEventListener("input", paint);
  host.append(control("Question", input), list);
  paint();
}

function staticFigure(host, lines) {
  const list = document.createElement("ol");
  list.className = "flow-list";
  for (const line of lines) {
    const item = document.createElement("li");
    item.textContent = line;
    list.append(item);
  }
  host.append(list);
}

function mountBpe(host) {
  const note = readout("");
  let tokens = ["a", "b", "a", "b"];
  const board = document.createElement("div");
  board.className = "token-board";
  const paint = () => {
    board.replaceChildren();
    for (const token of tokens) {
      const chip = document.createElement("span");
      chip.className = "token-chip";
      chip.textContent = token;
      board.append(chip);
    }
    note.textContent = `Morceaux : ${tokens.join(" ")}. La paire ab est la plus fréquente.`;
  };
  const merge = button("Fusionner", () => {
    const next = [];
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index] === "a" && tokens[index + 1] === "b") {
        next.push("ab");
        index += 1;
      } else next.push(tokens[index]);
    }
    tokens = next;
    paint();
  });
  host.append(board, merge, note);
  paint();
}

function mountLora(host) {
  const input = range({ min: "1", max: "8", value: "2", "aria-label": "Rang LoRA" });
  const note = readout("");
  const paint = () => {
    const rank = Number(input.value);
    const base = 64 * 64;
    note.textContent = `Rang ${rank}. Une matrice ${64}×${64} gelée, ${64 * rank + rank * 64} valeurs entraînées au lieu de ${base}.`;
  };
  input.addEventListener("input", paint);
  host.append(control("Rang", input), note);
  paint();
}

const MOUNTS = {
  tokenize: mountTokenize,
  softmax: mountSoftmax,
  descent: mountDescent,
  loss: mountLoss,
  attention: mountAttention,
  transformer: mountTransformer,
  moe: mountMoe,
  scan: mountScan,
  embed: mountEmbed,
  bigram: mountBigram,
  patches: mountPatches,
  relu: mountRelu,
  retrieve: mountRetrieve,
  bpe: mountBpe,
  lora: mountLora,
  machine: (host) => staticFigure(host, ["CPU — calcule", "RAM — garde les tableaux vivants", "Disque — garde le texte et les poids"]),
  flow: (host) => staticFigure(host, ["Entrée", "Transformation", "Sortie — note la forme avant et après"]),
  bars: (host) => staticFigure(host, ["Qualité — une métrique nommée", "Temps — des secondes, pas des FLOPs", "Mémoire — des octets estimés"]),
  stack: (host) => staticFigure(host, ["Embedding", "Mélangeur, attention ou scan", "Résidu", "Sortie de même forme"]),
  compare: (host) => staticFigure(host, ["Mesuré ici — un test du dépôt", "Lu ailleurs — un article, sans le chiffre", "La fiche ne mélange pas les deux"]),
};

function lossLine(values, steps, className, min, max, totalSteps) {
  const span = Math.max(max - min, 1e-6);
  const denom = Math.max(totalSteps - 1, 1);
  const points = values.map((value, index) => {
    const step = steps ? steps[index] : index;
    const x = 16 + (step / denom) * 288;
    const y = 128 - ((value - min) / span) * 104;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const node = svgEl("polyline", { points, fill: "none", "stroke-width": "2.5" });
  node.setAttribute("class", className);
  return node;
}

export function mountTrainingRun(host, run) {
  host.replaceChildren();
  if (!run || !Array.isArray(run.batch_losses) || run.batch_losses.length < 2) {
    host.append(readout("Le compte-rendu data/gpt_run.json n'est pas disponible."));
    return;
  }
  const train = run.batch_losses.map(Number);
  const val = (run.val_losses || []).map(Number);
  const all = val.length ? train.concat(val) : train;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const canvas = svgCanvas(
    `Courbe réelle. Train de ${Number(run.train_loss_start).toFixed(2)} à ${Number(run.train_loss_end).toFixed(2)}. Validation de ${Number(run.val_loss_start).toFixed(2)} à ${Number(run.val_loss_end).toFixed(2)}.`,
    320,
    150,
  );
  canvas.append(lossLine(train, null, "is-train", min, max, train.length));
  if (val.length) canvas.append(lossLine(val, run.val_steps || null, "is-val", min, max, train.length));
  const summary = readout(
    `${run.steps} pas en ${run.seconds} s. ${run.parameter_count} paramètres, vocabulaire ${run.vocab_size}, ${run.dataset_chars} caractères. Train ${Number(run.train_loss_start).toFixed(3)} à ${Number(run.train_loss_end).toFixed(3)}. Validation ${Number(run.val_loss_start).toFixed(3)} à ${Number(run.val_loss_end).toFixed(3)}. La ligne cuivrée est le lot, la verte est la validation.`,
  );
  host.append(canvas, summary);
  for (const sample of run.samples || []) {
    const caption = readout(`Température ${sample.temperature}, top-k ${sample.top_k}. Texte tiré du checkpoint de cet entraînement.`);
    const body = document.createElement("p");
    body.className = "run-sample";
    body.textContent = sample.text;
    host.append(caption, body);
  }
  const attention = run.attention;
  if (attention && Array.isArray(attention.tokens) && Array.isArray(attention.last_row)) {
    const board = document.createElement("div");
    board.className = "token-board";
    attention.tokens.forEach((token, index) => {
      const chip = document.createElement("span");
      chip.className = "token-chip";
      const shown = token === " " ? "espace" : token;
      const weight = Number(attention.last_row[index] || 0);
      chip.textContent = `${shown} ${weight.toFixed(2)}`;
      board.append(chip);
    });
    host.append(
      readout(`Poids réels, couche ${attention.layer} tête ${attention.head}, dernière position de « ${attention.prompt} ». Ce n'est pas le masque uniforme de la leçon.`),
      board,
    );
  }
}

function formatLoss(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(3) : "—";
}

export function mountChatRun(host, run) {
  host.replaceChildren();
  if (!run || !Array.isArray(run.samples)) {
    host.append(readout("Le compte-rendu data/finetune_run.json n'est pas disponible."));
    return;
  }
  const full = run.full || {};
  const lora = run.lora || {};
  host.append(readout(
    `Ajustement masqué sur les paires du cours. Complet, perte moyenne ${formatLoss(full.eval_loss_start)} à ${formatLoss(full.eval_loss_end)} (${formatLoss(full.loss_start)} à ${formatLoss(full.loss_end)} sur le premier et le dernier lot). LoRA, perte moyenne ${formatLoss(lora.eval_loss_start)} à ${formatLoss(lora.eval_loss_end)} (${formatLoss(lora.loss_start)} à ${formatLoss(lora.loss_end)} sur les lots). Export : ${run.chosen_attempt || "planned"} / ${run.chosen || ""}.`,
  ));
  for (const sample of run.samples) {
    const caption = readout(`Température ${sample.temperature}, top-k ${sample.top_k}. Question fixée avant le tirage.`);
    const body = document.createElement("p");
    body.className = "run-sample";
    body.textContent = sample.text || sample.error || "";
    host.append(caption, body);
  }
  if (run.held_out && run.held_out.text) {
    host.append(readout(run.held_out_note || "Question absente du jeu."));
    const body = document.createElement("p");
    body.className = "run-sample";
    body.textContent = run.held_out.text;
    host.append(body);
  }
}

export function mountVisual(host, lesson) {
  host.replaceChildren();
  const kind = lesson.visual in MOUNTS ? lesson.visual : "flow";
  MOUNTS[kind](host, lesson);
  if (!reducedMotion()) host.classList.add("visual-live");
}
