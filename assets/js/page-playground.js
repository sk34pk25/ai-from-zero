import { onLeave } from "./lifecycle.js";
import { isOwner } from "./auth.js";
import { getRecord, setRecord } from "./workspace.js";
/** Playground public : le forward JavaScript, sans écriture dans le stockage. */

import { ASSET_VERSION } from "./version.js";
import { h } from "./dom.js";
import {
  decodeIds,
  encodePrompt,
  loadModel,
  sampleIndex,
  softmax1,
  topIndices,
} from "./gpt.js";

export async function paintPlayground(main) {
  paintReady(main, {});
}

async function loadExport(path) {
  const response = await fetch(new URL(path, document.baseURI));
  if (!response.ok) throw new Error(path);
  return loadModel(await response.json());
}

function paintReady(main, models) {
  const prompt = h("textarea", { id: "play-prompt", rows: "3" });
  prompt.value = "Le ";
  const temperature = h("input", {
    id: "play-temperature",
    type: "range",
    min: "0",
    max: "1.2",
    step: "0.1",
    value: "0.8",
  });
  const topk = h("input", {
    id: "play-topk",
    type: "range",
    min: "1",
    max: "20",
    step: "1",
    value: "8",
  });
  const readout = h("p", {
    class: "visual-readout",
    id: "play-readout",
    text: "Température 0,8, top-k 8.",
  });
  const output = h("p", { class: "run-sample", id: "play-output", text: "" });
  const tokens = h("div", { class: "token-board", id: "play-tokens" });
  const bars = h("div", { class: "prob-bars", id: "play-bars" });
  const heat = h("div", {
    class: "heat-grid",
    id: "play-heat",
    role: "img",
    "aria-label": "Carte d'attention du dernier pas",
  });
  const status = h("p", { class: "quiz-feedback", role: "status", text: "" });
  let mode = "suite";
  let stop = false;
  let inference = null;
  let cancelStep = null;
  const length = h("input", {
    id: "play-length",
    type: "number",
    min: 1,
    max: 128,
    value: 12,
  });
  const seed = h("input", {
    id: "play-seed",
    type: "number",
    min: 0,
    max: 4294967295,
    value: 42,
  });
  const metrics = h("p", { id: "play-metrics", role: "status" });
  const inputTokens = h("div", {
    id: "play-input-tokens",
    class: "token-board",
  });
  const comparison = h("p", { id: "play-comparison", class: "run-sample" });
  const history = h("div", { id: "play-history" });
  const paintHistory = () =>
    history.replaceChildren(
      ...getRecord("experiments", [])
        .slice(-5)
        .reverse()
        .map((r) =>
          h("details", {}, [
            h("summary", {
              text: `${r.mode} · ${r.tokens} tokens · ${r.seconds.toFixed(2)} s`,
            }),
            h("p", { text: r.prompt }),
            h("p", { text: r.text }),
          ]),
        ),
    );
  paintHistory();
  onLeave(() => {
    stop = true;
    inference?.terminate();
    cancelStep?.(null);
  });
  async function ensureMode(next) {
    if (!models[next])
      models[next] = await loadExport(
        next === "dialogue"
          ? "data/chat_browser.json"
          : "data/gpt_browser.json",
      );
    return models[next];
  }
  const sync = () => {
    readout.textContent = `Température ${temperature.value.replace(".", ",")}, top-k ${topk.value}.`;
  };
  temperature.addEventListener("input", sync);
  topk.addEventListener("input", sync);
  const generate = h(
    "button",
    {
      type: "button",
      class: "button button-primary",
      id: "play-generate",
      disabled: false,
      onClick: () => run(),
    },
    "Générer",
  );
  const halt = h(
    "button",
    {
      type: "button",
      class: "button button-secondary",
      id: "play-stop",
      onClick: () => {
        stop = true;
        inference?.terminate();
        cancelStep?.(null);
      },
    },
    "Arrêter",
  );
  const switcher = h("div", { class: "filter-row" });
  switcher.append(
    h(
      "button",
      {
        type: "button",
        class: "button button-secondary",
        onClick: () => {
          mode = "suite";
          prompt.value = "Le ";
        },
      },
      "Suite de texte",
    ),
  );
  switcher.append(
    h(
      "button",
      {
        type: "button",
        class: "button button-secondary",
        onClick: () => {
          mode = "dialogue";
          prompt.value = "Question : qu'est-ce qu'un token\nRéponse :";
        },
      },
      "Dialogue",
    ),
  );

  async function run() {
    let model;
    if (generate.disabled) return;
    generate.disabled = true;
    const activeMode = mode;
    for (const control of [
      prompt,
      temperature,
      topk,
      length,
      seed,
      ...switcher.querySelectorAll("button"),
    ])
      control.disabled = true;
    stop = false;
    try {
      status.textContent = "Chargement du modèle…";
      model = await ensureMode(activeMode);
      if (stop || !output.isConnected) return;
      tokens.replaceChildren();
      bars.replaceChildren();
      heat.replaceChildren();
      output.textContent = "";
      status.textContent = "Génération…";
      let ids;
      try {
        ids = encodePrompt(model.tokenizer, prompt.value);
        if (!ids.length)
          throw new Error("Écris une invite avant de générer du texte.");
      } catch (error) {
        status.textContent = String(error.message || error);
        return;
      }
      inputTokens.replaceChildren(
        ...ids.map((id) =>
          h("span", {
            class: "token-chip",
            text: `${decodeIds(model.tokenizer, [id])} · ${id}`,
          }),
        ),
      );
      const random = seededRandom(Number(seed.value) || 0);
      const started = performance.now();
      let produced = 0;
      let generated = "";
      inference = new Worker(
        new URL(
          `./inference-worker.js?v=${encodeURIComponent(ASSET_VERSION)}`,
          import.meta.url,
        ),
        { type: "module" },
      );
      const calculate = (ids, first) =>
        new Promise((resolve, reject) => {
          cancelStep = resolve;
          inference.onmessage = ({ data }) =>
            data.error ? reject(new Error(data.error)) : resolve(data);
          inference.onerror = () => reject(new Error("worker"));
          inference.onmessageerror = () => reject(new Error("message"));
          inference.postMessage(first ? { model, ids } : { ids });
        });
      const limit = Math.max(1, Math.min(128, Number(length.value) || 12));
      for (let step = 0; step < limit; step += 1) {
        if (stop || !main.isConnected || !output.isConnected) break;
        const windowIds = ids.slice(-model.config.block_size);
        const result = await calculate(windowIds, step === 0);
        if (!result || stop || !output.isConnected) break;
        const logits = result.logits;
        const temperatureValue = Number(temperature.value);
        const k = Number(topk.value);
        const next = sampleIndex(logits, temperatureValue, k, random);
        ids.push(next);
        produced += 1;
        generated += decodeIds(model.tokenizer, [next]);
        const chip = h("span", {
          class: "token-chip",
          text: decodeIds(model.tokenizer, [next]) || "·",
        });
        tokens.append(chip);
        paintBars(bars, model, logits);
        paintHeat(heat, result.attention);
        output.textContent = decodeIds(model.tokenizer, ids);
        const seconds = (performance.now() - started) / 1000;
        metrics.textContent = `${produced} token(s) · ${seconds.toFixed(2)} s · ${(produced / Math.max(seconds, 0.001)).toFixed(1)} tokens/s sur cet appareil`;
        if (activeMode === "dialogue" && generated.includes("\n")) break;
        await new Promise((resolve) => window.setTimeout(resolve, 20));
      }
      if (produced && isOwner())
        setRecord(
          "experiments",
          [
            ...getRecord("experiments", []),
            {
              mode,
              prompt: prompt.value,
              text: output.textContent,
              tokens: produced,
              seconds: (performance.now() - started) / 1000,
              seed: Number(seed.value),
              temperature: Number(temperature.value),
              topk: Number(topk.value),
              at: Date.now(),
            },
          ].slice(-30),
        );
      paintHistory();
      status.textContent = stop
        ? "Génération arrêtée."
        : "Génération terminée. Aucune donnée n'est enregistrée.";
    } catch {
      status.textContent =
        "La génération a échoué. Essaie une invite plus courte.";
    } finally {
      inference?.terminate();
      inference = null;
      cancelStep = null;
      generate.disabled = false;
      for (const control of [
        prompt,
        temperature,
        topk,
        length,
        seed,
        ...switcher.querySelectorAll("button"),
      ])
        control.disabled = false;
    }
  }

  const note =
    "Les poids se chargent au premier calcul. Le calcul reste sur cet appareil ; les expériences sont conservées seulement pour le propriétaire.";
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Modèle" }),
    h("h1", { text: "Playground" }),
    h("p", { class: "lead", text: note }),
    switcher,
    h("label", { for: "play-prompt" }, ["Invite", prompt]),
    h("label", { for: "play-length" }, ["Tokens maximum (1 à 128)", length]),
    h("label", { for: "play-seed" }, ["Graine reproductible", seed]),
    h("label", { for: "play-temperature" }, ["Température", temperature]),
    h("label", { for: "play-topk" }, ["Top-k", topk]),
    readout,
    h("div", { class: "hero-actions" }, [generate, halt]),
    metrics,
    h("h2", { text: "Tokens de l’invite" }),
    inputTokens,
    output,
    tokens,
    h(
      "button",
      {
        type: "button",
        id: "play-compare",
        onClick: async () => {
          if (generate.disabled) return;
          const original = mode;
          const sharedPrompt = prompt.value;
          await run();
          const first = output.textContent;
          mode = original === "suite" ? "dialogue" : "suite";
          prompt.value = sharedPrompt;
          await run();
          comparison.textContent = `${original} : ${first}\n\n${mode} : ${output.textContent}`;
          mode = original;
        },
      },
      "Comparer avant et après ajustement",
    ),
    comparison,
    h("h2", { text: "Mes dernières expériences" }),
    history,
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
  host.replaceChildren(
    ...top.map((item) => {
      const label =
        decodeIds(model.tokenizer, [item.index]) || String(item.index);
      const row = h("div", { class: "prob-row" });
      const fill = h("span", { class: "prob-fill" });
      fill.style.transform = `scaleX(${Math.max(item.value, 0.02)})`;
      row.append(
        h("span", { class: "prob-label", text: label }),
        fill,
        h("span", { text: item.value.toFixed(2) }),
      );
      return row;
    }),
  );
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

/** PRNG déterministe pour comparer les mêmes réglages, sans prétention cryptographique. */
export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
