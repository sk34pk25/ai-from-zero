/** Schémas et manipulations. Un seul visuel est monté : celui de la leçon ouverte. */

import { mountVisualLab } from "./visual-labs.js";
import { chart, slider, matrix } from "./visual-ui.js";

export { hasVisualLab } from "./visual-labs.js";

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

/** Schéma propre à l'étape : ses trois gestes, numérotés et reliés. Sans résumé visuel, la liste générique. */
function stepsFigure(host, lesson, fallback) {
  const steps = lesson?.glance?.steps;
  if (!Array.isArray(steps) || steps.length === 0) {
    staticFigure(host, fallback);
    return;
  }
  const list = document.createElement("ol");
  list.className = "glance-steps is-large";
  steps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "glance-step";
    item.style.setProperty("--i", String(index));
    const num = document.createElement("span");
    num.className = "glance-step-num";
    num.setAttribute("aria-hidden", "true");
    num.textContent = String(index + 1);
    const title = document.createElement("strong");
    title.textContent = step.title;
    const text = document.createElement("span");
    text.textContent = step.text;
    item.append(num, title, text);
    list.append(item);
  });
  host.append(list);
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

const MOUNTS = {
  softmax: mountSoftmax,
  bigram: mountBigram,
  retrieve: mountRetrieve,
  machine: (host, lesson) => stepsFigure(host, lesson, ["CPU — calcule", "RAM — garde les tableaux vivants", "Disque — garde le texte et les poids"]),
  flow: (host, lesson) => stepsFigure(host, lesson, ["Entrée", "Transformation", "Sortie — note la forme avant et après"]),
  bars: (host, lesson) => stepsFigure(host, lesson, ["Qualité — une métrique nommée", "Temps — des secondes, pas des FLOPs", "Mémoire — des octets estimés"]),
  stack: (host, lesson) => stepsFigure(host, lesson, ["Embedding", "Mélangeur, attention ou scan", "Résidu", "Sortie de même forme"]),
  compare: (host, lesson) => stepsFigure(host, lesson, ["Mesuré ici — un test du dépôt", "Lu ailleurs — un article, sans le chiffre", "La fiche ne mélange pas les deux"]),
};

export function mountTrainingRun(host, run) {
  host.replaceChildren();
  if (!run || !Array.isArray(run.batch_losses) || run.batch_losses.length < 2) {
    host.append(readout("Le compte-rendu data/gpt_run.json n'est pas disponible."));
    return;
  }
  const train = run.batch_losses.map(Number);
  const val = (run.val_losses || []).map(Number);
  const valSteps = run.val_steps || val.map((_, i) => i);
  const series = [{ name: "Train, bleu, trait continu", values: train.map((value, index) => [index, value]) }];
  if (val.length) series.push({ name: "Validation, vert, tirets", values: val.map((value, i) => [valSteps[i], value]) });
  const canvas = chart("Courbes réelles du compte-rendu publié", series, { xLabel: "Pas d’entraînement (indice dès 0)" });
  const cursor = slider("Pas réel à inspecter", 0, train.length - 1, train.length - 1);
  const exact = readout("");
  const inspect = () => {
    const step = Number(cursor.input.value), at = valSteps.indexOf(step);
    exact.textContent = `Pas ${step} : train = ${train[step]} nats/token ; validation = ${at >= 0 ? val[at] + " nats/token" : "non mesurée à ce pas"}.`;
  };
  cursor.input.addEventListener("input", inspect); inspect();
  const summary = readout(
    `${run.steps} pas en ${run.seconds} s. ${run.parameter_count} paramètres, vocabulaire ${run.vocab_size}, ${run.dataset_chars} caractères. Train moyen (évaluation) ${Number(run.train_loss_start).toFixed(3)} à ${Number(run.train_loss_end).toFixed(3)}. Validation ${Number(run.val_loss_start).toFixed(3)} à ${Number(run.val_loss_end).toFixed(3)}. La courbe bleue montre le lot courant, qui diffère de cette évaluation moyenne du train ; la validation est mesurée sur des fenêtres réservées. Ces mesures restent celles du run archivé, avec son protocole de découpage.`,
  );
  const table = document.createElement("details");
  const title = document.createElement("summary"); title.textContent = "Valeurs de validation, sans dépendre de la courbe";
  table.append(title, matrix("Validation réelle · colonnes pas, perte (nats/token)", val.map((value, i) => [valSteps[i], value]), { colNames: ["Pas", "Nats/token"] }));
  host.append(canvas, cursor.field, exact, table, summary);
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
  if (!mountVisualLab(host, lesson)) MOUNTS[kind](host, lesson);
  if (!reducedMotion()) host.classList.add("visual-live");
}
