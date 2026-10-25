/** Catalogue public des jeux. Le plan d'entraînement n'est enregistré que par le propriétaire. */

import { upsertRow } from "./auth.js";
import { h } from "./dom.js";

const STAGES = [
  [1, "Jouet"],
  [2, "Petit corpus"],
  [3, "Grand corpus"],
  [4, "Instructions"],
  [5, "Dialogue"],
  [6, "Évaluation"],
];

export function compatibilityWarning(row, config) {
  const notes = [];
  const compat = row.compatibility || {};
  if (config.tokenizer === "char" && !compat.char) {
    notes.push("Ce jeu n'est pas prévu pour le tokenizer caractère : il faut le BPE.");
  }
  if (config.tokenizer === "bpe" && !compat.bpe) {
    notes.push("Ce jeu n'est pas prévu pour le BPE.");
  }
  if (config.runtime === "browser" && (!compat.pyodide || Number(row.sizeMb) > 2)) {
    notes.push("Trop gros, ou inadapté, pour l'entraînement dans le navigateur.");
  }
  if (config.runtime === "cpu" && (!compat.numpyCpu || Number(row.sizeMb) > 800)) {
    notes.push("Trop gros pour le CPU NumPy de ce dépôt, ou le format n'est pas décodé ici.");
  }
  if (config.runtime === "gpu" && compat.needsGpu) {
    notes.push("Ce jeu est marqué comme demandant un GPU ou un outil hors de ce CPU.");
  }
  if (row.gated) notes.push("Accès manuel : le téléchargement automatique est refusé.");
  return notes;
}

function licenceBucket(row) {
  const text = `${row.licence} ${row.licenceUrl}`.toLowerCase();
  if (row.gated) return "gated";
  if (text.includes("apache")) return "apache";
  if (text.includes("mit")) return "mit";
  if (text.includes("domaine public") || text.includes("gutenberg") || text.includes("cc0") || text.includes("cdla")) return "public";
  if (text.includes("by-sa") || text.includes("share") || text.includes("odc") || text.includes("gfdl")) return "share";
  return "autre";
}

function sizeBucket(row) {
  if (row.sizeMb < 1) return "petit";
  if (row.sizeMb < 100) return "moyen";
  return "gros";
}

function runtimeOk(row, runtime) {
  if (runtime === "tous") return true;
  if (runtime === "browser") return row.compatibility.pyodide && row.sizeMb <= 2;
  if (runtime === "cpu") return row.compatibility.numpyCpu && row.sizeMb <= 800;
  if (runtime === "gpu") return row.compatibility.needsGpu;
  return true;
}

function formatSize(row) {
  if (row.sizeMb >= 1000) return `${(row.sizeMb / 1024).toFixed(1)} Go`;
  if (row.sizeMb >= 10) return `${Math.round(row.sizeMb)} Mo`;
  return `${row.sizeMb} Mo`;
}

export async function paintDonnees(main, ctx) {
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Entraînement" }),
    h("h1", { text: "Catalogue des jeux" }),
    h("p", { class: "lead", text: "Chargement de data/datasets.json…" }),
  );
  try {
    const response = await fetch(new URL("data/datasets.json", document.baseURI));
    if (!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    paintCatalog(main, data, ctx);
  } catch {
    main.replaceChildren(
      h("h1", { text: "Catalogue indisponible" }),
      h("p", { text: "data/datasets.json n'a pas pu être lu. Ouvre le site avec un serveur local." }),
    );
  }
}

function paintCatalog(main, data, ctx) {
  const rows = [...data.datasets].sort((a, b) => a.order - b.order);
  const selected = new Set();
  const filters = { stage: "tous", language: "tous", licence: "tous", size: "tous", runtime: "tous" };
  const config = { tokenizer: "bpe", runtime: "cpu" };

  const board = h("div", { class: "dataset-board", id: "dataset-board" });
  const planList = h("ol", { id: "plan-list", class: "plan-list" });
  const status = h("p", { id: "plan-status", class: "quiz-feedback", role: "status", text: "" });

  const stageSelect = selectOf("stage-filter", "Étape", [["tous", "Toutes les étapes"], ...STAGES.map(([id, label]) => [String(id), `${id} · ${label}`])], (value) => {
    filters.stage = value;
    paintCards();
  });
  const languageSelect = selectOf("language-filter", "Langue", [["tous", "Toutes"], ["fr", "Français"], ["en", "Anglais"], ["multi", "Multilingue"]], (value) => {
    filters.language = value;
    paintCards();
  });
  const licenceSelect = selectOf("licence-filter", "Licence", [
    ["tous", "Toutes"],
    ["mit", "MIT"],
    ["public", "Domaine public ou proche"],
    ["share", "Partage à l'identique"],
    ["apache", "Apache"],
    ["gated", "Accès manuel"],
    ["autre", "Autre"],
  ], (value) => {
    filters.licence = value;
    paintCards();
  });
  const sizeSelect = selectOf("size-filter", "Taille", [["tous", "Toutes"], ["petit", "Moins de 1 Mo"], ["moyen", "1 à 100 Mo"], ["gros", "Plus de 100 Mo"]], (value) => {
    filters.size = value;
    paintCards();
  });
  const placeSelect = selectOf("place-filter", "Compatible avec", [["tous", "Tous les lieux"], ["browser", "Navigateur"], ["cpu", "CPU NumPy"], ["gpu", "GPU"]], (value) => {
    filters.runtime = value;
    paintCards();
  });
  const tokenizerSelect = selectOf("config-tokenizer", "Tokenizer", [["bpe", "BPE"], ["char", "Caractères"]], (value) => {
    config.tokenizer = value;
    paintCards();
  });
  const runtimeSelect = selectOf("config-runtime", "Où entraîner", [["cpu", "CPU NumPy"], ["browser", "Navigateur"], ["gpu", "GPU"]], (value) => {
    config.runtime = value;
    paintCards();
  });

  const save = h("button", {
    type: "button",
    class: "button button-primary",
    id: "save-plan",
    disabled: !ctx.owner,
    onClick: () => savePlan(),
  }, ctx.owner ? "Choisir / ajouter au plan d'entraînement" : "Réservé au propriétaire");

  function chosenRows() {
    return rows.filter((row) => selected.has(row.id)).sort((a, b) => a.order - b.order);
  }

  function paintPlan() {
    const chosen = chosenRows();
    planList.replaceChildren(...chosen.map((row) => h("li", { text: `${row.order}. ${row.name}` })));
    if (!chosen.length) planList.replaceChildren(h("li", { text: "Aucun jeu choisi." }));
  }

  async function savePlan() {
    if (!ctx.owner) return;
    const ids = chosenRows().map((row) => row.id);
    status.textContent = "Enregistrement…";
    try {
      await upsertRow("training_plans", { id: 1, dataset_ids: ids }, "id");
      status.textContent = ids.length
        ? `Plan enregistré, ${ids.length} jeu${ids.length > 1 ? "x" : ""}, dans l'ordre recommandé.`
        : "Plan vide enregistré.";
    } catch {
      status.textContent = "L'enregistrement distant a été refusé.";
    }
  }

  function paintCards() {
    const visible = rows.filter((row) => {
      if (filters.stage !== "tous" && String(row.stage) !== filters.stage) return false;
      if (filters.language !== "tous" && row.language !== filters.language) return false;
      if (filters.licence !== "tous" && licenceBucket(row) !== filters.licence) return false;
      if (filters.size !== "tous" && sizeBucket(row) !== filters.size) return false;
      if (!runtimeOk(row, filters.runtime)) return false;
      return true;
    });
    board.replaceChildren(...visible.map((row) => card(row)));
    paintPlan();
  }

  function card(row) {
    const warnings = compatibilityWarning(row, config);
    const box = h("input", { type: "checkbox", id: `pick-${row.id}`, "data-dataset-id": row.id });
    box.checked = selected.has(row.id);
    box.disabled = !ctx.owner;
    box.addEventListener("change", () => {
      if (box.checked) selected.add(row.id);
      else selected.delete(row.id);
      paintPlan();
    });
    const warn = h("p", {
      class: "compat-warning",
      "data-compat-warning": row.id,
      hidden: warnings.length === 0,
      text: warnings.join(" "),
    });
    return h("article", { class: "dataset-card", "data-dataset-id": row.id }, [
      h("div", { class: "dataset-kicker" }, [
        h("span", { class: "badge", text: `Étape ${row.stage}` }),
        h("span", { class: "badge", text: row.language }),
        h("span", { class: "badge", text: formatSize(row) }),
        row.gated ? h("span", { class: "badge badge-warn", text: "Accès manuel" }) : null,
        row.compatibility.pyodide ? h("span", { class: "badge", text: "Navigateur" }) : null,
        row.compatibility.numpyCpu ? h("span", { class: "badge", text: "CPU" }) : null,
        row.compatibility.needsGpu ? h("span", { class: "badge badge-warn", text: "GPU" }) : null,
      ]),
      h("h3", { text: row.name }),
      h("p", { text: row.teaches }),
      h("p", { class: "muted", text: row.licence }),
      h("p", {}, [
        h("a", { href: row.url, text: "Source" }),
        " · ",
        h("a", { href: row.licenceUrl, text: "Licence" }),
        ` · vérifié le ${row.checkedOn}`,
      ]),
      h("p", { class: "muted", text: `Format ${row.format}. Ordre ${row.order}. ${row.compatibility.minutes} min estimées, ${row.compatibility.ramMb} Mo de RAM.` }),
      warnings.length ? warn : h("p", { class: "compat-ok", "data-compat-warning": row.id, text: "Compatible avec la configuration choisie." }),
      h("label", { class: "pick-label" }, [box, ctx.owner ? " Ajouter au plan" : " Lecture seule"]),
    ]);
  }

  const timeline = h("ol", { class: "stage-timeline" }, STAGES.map(([id, label]) => h("li", {}, [
    h("span", { class: "stage-index", text: String(id) }),
    h("span", { text: label }),
  ])));

  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Entraînement" }),
    h("h1", { text: "Catalogue des jeux" }),
    h("p", { class: "lead", text: "L'ordre recommandé va du jouet au dialogue, puis à l'évaluation. Les URL et les licences ont été vérifiées. Le catalogue est public. Seul le propriétaire enregistre un plan." }),
    h("section", { class: "sheet", "aria-labelledby": "timeline-title" }, [
      h("h2", { id: "timeline-title", text: "Ordre des étapes" }),
      timeline,
    ]),
    h("section", { class: "sheet", "aria-labelledby": "filter-title" }, [
      h("h2", { id: "filter-title", text: "Filtres" }),
      h("div", { class: "filter-row" }, [stageSelect, languageSelect, licenceSelect, sizeSelect, placeSelect]),
    ]),
    h("section", { class: "sheet", "aria-labelledby": "config-title" }, [
      h("h2", { id: "config-title", text: "Compatible avec ma configuration" }),
      h("p", { text: "Le contrôle relit le tokenizer et le lieu d'entraînement. Il prévient si le jeu est trop gros pour le navigateur ou le CPU, ou s'il attend un autre tokenizer." }),
      h("div", { class: "filter-row" }, [tokenizerSelect, runtimeSelect]),
    ]),
    board,
    h("section", { class: "sheet", "aria-labelledby": "plan-title" }, [
      h("h2", { id: "plan-title", text: "Plan d'entraînement" }),
      h("p", { text: ctx.owner ? "Les jeux cochés sont rangés dans l'ordre du catalogue, pré-entraînement d'abord." : "Réservé au propriétaire. Un visiteur peut lire les fiches, pas enregistrer de plan." }),
      planList,
      save,
      status,
    ]),
  );
  paintCards();
}

function selectOf(id, label, options, onChange) {
  const select = h("select", { id });
  for (const [value, text] of options) {
    const option = h("option", { value, text });
    select.append(option);
  }
  select.addEventListener("change", () => onChange(select.value));
  return h("label", { class: "filter-field" }, [label, select]);
}
