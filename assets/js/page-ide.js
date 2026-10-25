/** IDE statique. Le visiteur lit un fichier. Le propriétaire édite, exécute et entraîne. */

import { upsertRow } from "./auth.js";
import { h } from "./dom.js";
import { request, stopWorker } from "./pybridge.js";
import { zipStore } from "./zipstore.js";

const SNIPPET_KEY = "afz-ide-snippet";

export async function paintIde(main, ctx) {
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Laboratoire" }),
    h("h1", { text: "IDE" }),
    h("p", { text: "Chargement des fichiers du modèle…" }),
  );
  let manifest = { files: [] };
  const files = new Map();
  try {
    const response = await fetch(new URL("model/manifest.json", document.baseURI));
    if (response.ok) manifest = await response.json();
    const first = manifest.files.slice(0, ctx.owner ? manifest.files.length : 1);
    await Promise.all(first.map(async (path) => {
      const file = await fetch(new URL(path, document.baseURI));
      files.set(path, file.ok ? await file.text() : "");
    }));
  } catch {
    files.set("model/__init__.py", "");
  }
  if (ctx.owner) await hydrate(files);
  paintShell(main, ctx, manifest.files, files);
}

async function hydrate(files) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve) => {
    const tx = db.transaction("files", "readonly");
    const store = tx.objectStore("files");
    const request = store.getAllKeys();
    request.onsuccess = () => {
      const keys = request.result || [];
      if (!keys.length) {
        resolve();
        return;
      }
      let left = keys.length;
      for (const key of keys) {
        const read = store.get(key);
        read.onsuccess = () => {
          if (typeof read.result === "string") files.set(key, read.result);
          left -= 1;
          if (left === 0) resolve();
        };
      }
    };
    request.onerror = () => resolve();
  });
  db.close();
}

function paintShell(main, ctx, paths, files) {
  const output = h("pre", { id: "ide-output", class: "ide-output" });
  output.textContent = ctx.owner ? "Prêt." : "Réservé au propriétaire.";
  const openPath = paths[0] || "model/__init__.py";
  let current = openPath;
  const lossValues = [];
  const chart = h("div", { id: "ide-chart", class: "ide-chart" });
  const lossText = h("p", { id: "ide-loss", class: "visual-readout", text: "Pas encore d'entraînement dans cette page." });
  const sample = h("p", { id: "ide-sample", class: "run-sample", text: "" });
  const progress = h("progress", { id: "ide-progress", max: "8", value: "0", "aria-label": "Avancement de l'entraînement" });
  let view = null;
  let stopped = false;

  const editorHost = h("div", { id: "ide-editor", class: "ide-editor" });
  const tree = h("div", { id: "ide-tree", class: "ide-tree", role: "tree" });
  const tabs = h("div", { id: "ide-tabs", class: "ide-tabs" });

  function readDoc() {
    if (view) return view.state.doc.toString();
    const area = editorHost.querySelector("textarea");
    return area ? area.value : files.get(current) || "";
  }

  function remember() {
    files.set(current, readDoc());
  }

  function showFile(path) {
    remember();
    current = path;
    const text = files.get(path) || "";
    tabs.replaceChildren(h("span", { class: "ide-tab", text: path }));
    if (!ctx.owner) {
      const pre = h("pre", { id: "ide-readonly" });
      pre.append(h("code", { text }));
      editorHost.replaceChildren(pre);
      return;
    }
    mountEditor(text);
  }

  async function mountEditor(text) {
    editorHost.replaceChildren(h("p", { text: "Ouverture de l'éditeur…" }));
    try {
      const { EditorView, EditorState, basicSetup, python } = await import("../vendor/editor.js");
      editorHost.replaceChildren();
      view = new EditorView({
        state: EditorState.create({
          doc: text,
          extensions: [basicSetup, python(), EditorView.lineWrapping],
        }),
        parent: editorHost,
      });
    } catch {
      view = null;
      const area = h("textarea", { id: "ide-fallback", class: "ide-fallback" });
      area.value = text;
      editorHost.replaceChildren(area);
    }
  }

  function paintTree() {
    tree.replaceChildren(...paths.map((path) => h("button", {
      type: "button",
      class: path === current ? "ide-file is-on" : "ide-file",
      role: "treeitem",
      onClick: () => showFile(path),
    }, path.replace("model/", ""))));
  }

  async function runCode() {
    if (!ctx.owner) return;
    remember();
    stopped = false;
    output.textContent = "Démarrage de Python…\n";
    const payload = [...files.entries()].map(([path, content]) => ({ path, content }));
    const result = await request({ type: "run", code: readDoc(), files: payload }, (event) => {
      if (event.type === "stdout") output.textContent += `${event.text}\n`;
    });
    if (result.type === "error") output.textContent += `${result.text}\n`;
    else output.textContent += result.text ? `${result.text}\n` : "";
  }

  async function train() {
    if (!ctx.owner) return;
    stopped = false;
    lossValues.length = 0;
    chart.replaceChildren();
    sample.textContent = "";
    const payload = [...files.entries()].map(([path, content]) => ({ path, content }));
    output.textContent = "Préparation d'un petit entraînement…\n";
    const ready = await request({ type: "train-init", files: payload, steps: 8, text: "le chat dort dans le bois. " });
    if (ready.type === "error") {
      output.textContent += `${ready.text}\n`;
      return;
    }
    for (let step = 0; step < 8; step += 1) {
      if (stopped) break;
      const event = await request({ type: "train-step" });
      if (event.type === "error") {
        output.textContent += `${event.text}\n`;
        break;
      }
      const payloadStep = event.payload || {};
      lossValues.push(Number(payloadStep.loss));
      progress.value = String(payloadStep.step || step + 1);
      lossText.textContent = `Pas ${payloadStep.step} / ${payloadStep.total}, perte ${Number(payloadStep.loss).toFixed(3)}.`;
      paintChart(chart, lossValues);
      if (payloadStep.done) break;
    }
    if (!stopped) {
      const drawn = await request({ type: "train-sample" });
      sample.textContent = drawn.text || "";
    } else {
      lossText.textContent = "Entraînement arrêté. Le worker a été coupé, le pas en cours ne continue pas.";
    }
  }

  async function saveFile() {
    if (!ctx.owner) return;
    remember();
    const content = files.get(current) || "";
    try {
      const db = await openDb();
      if (db) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction("files", "readwrite");
          tx.objectStore("files").put(content, current);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      }
      await upsertRow("ide_files", { path: current, content, updated_at: new Date().toISOString() }, "path");
      output.textContent = "Fichier enregistré.";
    } catch {
      output.textContent = "L'enregistrement distant a été refusé.";
    }
  }

  function exportZip() {
    if (!ctx.owner) return;
    remember();
    const blob = zipStore([...files.entries()].map(([name, data]) => ({ name, data })));
    const link = h("a", { href: URL.createObjectURL(blob), download: "ide-ai-from-zero.zip" });
    link.click();
  }

  const run = h("button", { type: "button", class: "button button-primary", id: "ide-run", disabled: !ctx.owner, onClick: () => runCode() }, "Exécuter");
  const stop = h("button", {
    type: "button",
    class: "button button-secondary",
    id: "ide-stop",
    disabled: !ctx.owner,
    onClick: () => {
      stopped = true;
      stopWorker();
      output.textContent += "Arrêt demandé.\n";
    },
  }, "Arrêter");
  const trainButton = h("button", { type: "button", class: "button button-primary", id: "ide-train", disabled: !ctx.owner, onClick: () => train() }, "Entraîner");
  const trainStop = h("button", {
    type: "button",
    class: "button button-secondary",
    id: "ide-train-stop",
    disabled: !ctx.owner,
    onClick: () => {
      stopped = true;
      stopWorker();
    },
  }, "Arrêter l'entraînement");
  const save = h("button", { type: "button", class: "button button-secondary", id: "ide-save", disabled: !ctx.owner, onClick: () => saveFile() }, "Sauvegarder");
  const reset = h("button", {
    type: "button",
    class: "button button-secondary",
    id: "ide-reset",
    disabled: !ctx.owner,
    onClick: async () => {
      if (!ctx.owner) return;
      const file = await fetch(new URL(current, document.baseURI));
      const text = file.ok ? await file.text() : "";
      files.set(current, text);
      showFile(current);
      output.textContent = "Fichier rétabli depuis le dépôt.";
    },
  }, "Rétablir");
  const zip = h("button", { type: "button", class: "button button-secondary", id: "ide-export", disabled: !ctx.owner, onClick: exportZip }, "Exporter le zip");

  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Laboratoire" }),
    h("h1", { text: "IDE" }),
    h("p", { class: "lead", id: "ide-lock", text: ctx.owner
      ? "Python tourne dans un worker Pyodide. Arrêter coupe le worker : le pas en cours ne reprend pas, la page reste utilisable."
      : "Réservé au propriétaire. Le code est affiché, il ne s'exécute pas et rien n'est enregistré dans ce navigateur." }),
    h("div", { class: ctx.owner ? "ide-layout" : "ide-layout is-locked" }, [
      tree,
      h("div", { class: "ide-main" }, [tabs, editorHost, h("div", { class: "hero-actions" }, [run, stop, save, reset, zip]), output]),
    ]),
    h("section", { class: "sheet", "aria-labelledby": "train-title" }, [
      h("h2", { id: "train-title", text: "Entraînement dans la page" }),
      h("p", { text: "Huit pas, modèle minuscule, pour voir la perte bouger. Ce n'est pas le run publié." }),
      progress,
      h("div", { class: "hero-actions" }, [trainButton, trainStop]),
      lossText,
      chart,
      sample,
    ]),
  );
  const snippet = ctx.owner ? window.sessionStorage.getItem(SNIPPET_KEY) : "";
  if (snippet) {
    files.set("brouillon.py", snippet);
    paths = paths.concat("brouillon.py");
    current = "brouillon.py";
  }
  paintTree();
  showFile(current);
}

function paintChart(host, values) {
  host.replaceChildren();
  if (values.length < 1) return;
  const max = Math.max(...values, 0.001);
  values.forEach((value) => {
    const bar = h("span", { class: "loss-bar" });
    bar.style.height = `${Math.max(8, (value / max) * 100)}%`;
    bar.title = value.toFixed(3);
    host.append(bar);
  });
}

function openDb() {
  return new Promise((resolve) => {
    if (!("indexedDB" in window)) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open("afz-ide", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export function stashSnippet(code) {
  window.sessionStorage.setItem(SNIPPET_KEY, code);
}
