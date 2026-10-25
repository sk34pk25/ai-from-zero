/** Playground public : le forward JavaScript, sans écriture dans le stockage. */

import { h } from "./dom.js";
import { decodeIds, encodePrompt, forward, loadModel, sampleIndex, softmax1, topIndices } from "./gpt.js";

export async function paintPlayground(main) {
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Modèle" }),
    h("h1", { text: "Playground" }),
    h("p", { class: "lead", text: "Chargement des poids exportés…" }),
  );
  const models = {};
  try {
    models.suite = await loadExport("data/gpt_browser.json");
  } catch {
    models.suite = null;
  }
  try {
    models.dialogue = await loadExport("data/chat_browser.json");
  } catch {
    models.dialogue = null;
  }
  paintReady(main, models);
}

async function loadExport(path) {
  const response = await fetch(new URL(path, document.baseURI));
  if (!response.ok) throw new Error(path);
  return loadModel(await response.json());
}

function paintReady(main, models) {
  const prompt = h("textarea", { id: "play-prompt", rows: "3" });
  prompt.value = models.suite ? "Le " : "Question : qu'est-ce qu'un token\nRéponse :";
  const temperature = h("input", { id: "play-temperature", type: "range", min: "0", max: "1.2", step: "0.1", value: "0.8" });
  const topk = h("input", { id: "play-topk", type: "range", min: "1", max: "20", step: "1", value: "8" });
  const readout = h("p", { class: "visual-readout", id: "play-readout", text: "Température 0,8, top-k 8." });
  const output = h("p", { class: "run-sample", id: "play-output", text: "" });
  const tokens = h("div", { class: "token-board", id: "play-tokens" });
  const bars = h("div", { class: "prob-bars", id: "play-bars" });
  const heat = h("div", { class: "heat-grid", id: "play-heat", role: "img", "aria-label": "Carte d'attention du dernier pas" });
  const status = h("p", { class: "quiz-feedback", role: "status", text: "" });
  let mode = models.suite ? "suite" : "dialogue";
  let stop = false;
  const sync = () => {
    readout.textContent = `Température ${temperature.value.replace(".", ",")}, top-k ${topk.value}.`;
  };
  temperature.addEventListener("input", sync);
  topk.addEventListener("input", sync);
  const generate = h("button", {
    type: "button",
    class: "button button-primary",
    id: "play-generate",
    disabled: !models.suite && !models.dialogue,
    onClick: () => run(),
  }, "Générer");
  const halt = h("button", { type: "button", class: "button button-secondary", id: "play-stop", onClick: () => { stop = true; } }, "Arrêter");
  const switcher = h("div", { class: "filter-row" });
  if (models.suite) switcher.append(h("button", { type: "button", class: "button button-secondary", onClick: () => { mode = "suite"; prompt.value = "Le "; } }, "Suite de texte"));
  if (models.dialogue) switcher.append(h("button", { type: "button", class: "button button-secondary", onClick: () => { mode = "dialogue"; prompt.value = "Question : qu'est-ce qu'un token\nRéponse :"; } }, "Dialogue"));

  async function run() {
    const model = models[mode] || models.suite || models.dialogue;
    if (!model) return;
    stop = false;
    tokens.replaceChildren();
    bars.replaceChildren();
    heat.replaceChildren();
    output.textContent = "";
    status.textContent = "Génération…";
    let ids;
    try {
      ids = encodePrompt(model.tokenizer, prompt.value);
    } catch (error) {
      status.textContent = String(error.message || error);
      return;
    }
    const limit = Math.min(12, model.config.block_size - 1);
    for (let step = 0; step < limit; step += 1) {
      if (stop) break;
      const windowIds = ids.slice(-model.config.block_size);
      const result = forward(model, windowIds);
      const logits = result.logits[result.logits.length - 1];
      const temperatureValue = Number(temperature.value);
      const k = Number(topk.value);
      const next = sampleIndex(logits, temperatureValue, k, Math.random);
      ids.push(next);
      const chip = h("span", { class: "token-chip", text: decodeIds(model.tokenizer, [next]) || "·" });
      tokens.append(chip);
      paintBars(bars, model, logits);
      paintHeat(heat, result.attention);
      output.textContent = decodeIds(model.tokenizer, ids);
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    }
    status.textContent = stop ? "Génération arrêtée." : "Génération terminée. Aucune donnée n'est enregistrée.";
  }

  const note = models.suite || models.dialogue
    ? "Les poids viennent de l'export du dépôt. Le calcul tourne dans la page. Rien n'est écrit dans le stockage."
    : "L'export data/gpt_browser.json n'est pas encore dans le dépôt. Relance l'entraînement puis model/export_js.py.";
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Modèle" }),
    h("h1", { text: "Playground" }),
    h("p", { class: "lead", text: note }),
    switcher,
    h("label", { for: "play-prompt" }, ["Invite", prompt]),
    h("label", { for: "play-temperature" }, ["Température", temperature]),
    h("label", { for: "play-topk" }, ["Top-k", topk]),
    readout,
    h("div", { class: "hero-actions" }, [generate, halt]),
    output,
    tokens,
    h("h2", { text: "Prochains tokens" }),
    bars,
    h("h2", { text: "Attention du dernier pas" }),
    heat,
    status,
  );
}

function paintBars(host, model, logits) {
  const probs = softmax1(logits, 1);
  const top = topIndices(probs, 6);
  host.replaceChildren(...top.map((item) => {
    const label = decodeIds(model.tokenizer, [item.index]) || String(item.index);
    const row = h("div", { class: "prob-row" });
    const fill = h("span", { class: "prob-fill" });
    fill.style.transform = `scaleX(${Math.max(item.value, 0.02)})`;
    row.append(h("span", { class: "prob-label", text: label }), fill, h("span", { text: item.value.toFixed(2) }));
    return row;
  }));
}

function paintHeat(host, weights) {
  host.replaceChildren();
  if (!weights || !weights.length) return;
  const last = weights[weights.length - 1];
  last.forEach((value) => {
    const cell = h("span", { class: "heat-cell", text: value.toFixed(2) });
    const shade = Math.round(40 + Math.min(1, Math.max(0, value)) * 180);
    cell.style.background = `rgb(${shade}, ${Math.round(shade * 0.7)}, 80)`;
    host.append(cell);
  });
}
