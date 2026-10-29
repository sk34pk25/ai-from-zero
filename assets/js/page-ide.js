import {
  getRecord,
  setRecord,
  subscribe,
  seedFile,
  syncWorkspace,
  syncStatus,
} from "./workspace.js";
import { onLeave } from "./lifecycle.js";
/** IDE statique. Le visiteur lit un fichier. Le propriétaire édite, exécute et entraîne. */

import { insertRow, selectRows, upsertRow } from "./auth.js";
import { h } from "./dom.js";
import { request, stopWorker } from "./pybridge.js";
import { zipStore } from "./zipstore.js";

const SNIPPET_KEY = "afz-ide-snippet";

export async function paintIde(main, ctx) {
  const stamp = main.dataset.paint;
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Laboratoire" }),
    h("h1", { text: "IDE" }),
    h("p", { text: "Chargement des fichiers du modèle…" }),
  );
  let manifest = { files: [] };
  const files = new Map();
  try {
    const response = await fetch(
      new URL("model/manifest.json", document.baseURI),
    );
    if (!response.ok) throw new Error("manifest");
    manifest = await response.json();
    const first = manifest.files.slice(
      0,
      ctx.owner ? manifest.files.length : 1,
    );
    await Promise.all(
      first.map(async (path) => {
        const file = await fetch(new URL(path, document.baseURI));
        if (file.ok) files.set(path, await file.text());
      }),
    );
  } catch {
    files.set("model/__init__.py", "");
  }
  if (main.dataset.paint !== stamp) return;
  if (ctx.owner) await hydrate(files);
  if (main.dataset.paint !== stamp) return;
  paintShell(main, ctx, manifest.files, files);
}

async function hydrate(files) {
  const legacy = new Map();
  const db = await openDb();
  if (db) {
    await new Promise((resolve) => {
      const tx = db.transaction("files", "readonly");
      const store = tx.objectStore("files");
      const read = store.openCursor();
      read.onsuccess = () => {
        const cursor = read.result;
        if (cursor) {
          if (typeof cursor.value === "string")
            legacy.set(cursor.key, cursor.value);
          cursor.continue();
        }
      };
      tx.oncomplete = resolve;
      tx.onerror = resolve;
    });
    db.close();
  }
  let remote = [];
  try {
    remote = await selectRows("ide_files");
  } catch {
    /* brouillons conservés */
  }
  for (const path of new Set([
    ...files.keys(),
    ...legacy.keys(),
    ...remote.map((r) => r.path),
  ])) {
    const cloud = remote.find((r) => r.path === path);
    seedFile(path, legacy.get(path), cloud?.content);
    const row = getRecord(`ide/${path}`);
    if (row?.content != null) files.set(path, row.content);
  }
  void syncWorkspace();
}

function paintShell(main, ctx, paths, files) {
  const output = h("pre", { id: "ide-output", class: "ide-output" });
  output.textContent = ctx.owner ? "Prêt." : "Réservé au propriétaire.";
  const openPath = paths[0] || "model/__init__.py";
  let current = openPath;
  const lossValues = [];
  const chart = h("div", { id: "ide-chart", class: "ide-chart" });
  const lossText = h("p", {
    id: "ide-loss",
    class: "visual-readout",
    text: "Pas encore d'entraînement dans cette page.",
  });
  const sample = h("p", { id: "ide-sample", class: "run-sample", text: "" });
  const progress = h("progress", {
    id: "ide-progress",
    max: "8",
    value: "0",
    "aria-label": "Avancement de l'entraînement",
  });
  let view = null;
  let stopped = false;
  let busy = false;
  let editorPaint = 0;
  let lastText = "";
  let dirty = false;
  let draftTimer;
  let receiving = false;

  const editorHost = h("div", { id: "ide-editor", class: "ide-editor" });
  const tree = h("div", {
    id: "ide-tree",
    class: "ide-tree",
    role: "tree",
    "aria-label": "Fichiers du modèle",
  });
  tree.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = [...tree.querySelectorAll("button")];
    const i = items.indexOf(document.activeElement);
    const target =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : Math.max(
              0,
              Math.min(
                items.length - 1,
                i + (event.key === "ArrowDown" ? 1 : -1),
              ),
            );
    items[target]?.focus();
  });
  const tabs = h("div", { id: "ide-tabs", class: "ide-tabs" });
  const draftStatus = h("p", { role: "status", id: "ide-draft-status" });
  const draft = () => {
    clearTimeout(draftTimer);
    if (!ctx.owner || !view) return;
    const text = readDoc();
    if (text === lastText) return;
    lastText = text;
    files.set(current, text);
    dirty = true;
    setRecord(`ide/${current}`, { content: text }, { sync: false });
    draftStatus.textContent =
      "Brouillon conservé sur cet appareil. Voir Mon espace pour la synchronisation.";
  };
  const unload = (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", unload);
  const refreshFile = () => {
    const row = getRecord(`ide/${current}`);
    if (!view || !row) return;
    const state = syncStatus();
    if (state.conflicts.includes(`ide/${current}`)) {
      draftStatus.textContent =
        "Conflit de versions : ouvre Mon espace pour choisir.";
      return;
    }
    if (!dirty && row.content !== readDoc()) {
      receiving = true;
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: row.content },
      });
      receiving = false;
      lastText = row.content;
      files.set(current, row.content);
    }
    if (!state.pending) {
      dirty = false;
      draftStatus.textContent = "Fichier synchronisé.";
    }
  };
  const unsub = subscribe(refreshFile);
  onLeave(unsub);
  onLeave(() => {
    draft();
    if (ctx.owner) void syncWorkspace();
    stopWorker();
    view?.destroy();
    clearTimeout(draftTimer);
    window.removeEventListener("beforeunload", unload);
  });

  function readDoc() {
    if (view) return view.state.doc.toString();
    const area = editorHost.querySelector("textarea");
    return area ? area.value : files.get(current) || "";
  }

  function remember() {
    draft();
    files.set(current, readDoc());
  }

  function showFile(path, savePrevious = true) {
    if (savePrevious) remember();
    current = path;
    if (!files.has(path)) {
      editorHost.replaceChildren(h("p", { text: "Chargement…" }));
      fetch(new URL(path, document.baseURI))
        .then(async (r) => {
          if (!r.ok) throw new Error("fetch");
          files.set(path, await r.text());
          if (current === path && editorHost.isConnected) showFile(path, false);
        })
        .catch(() => {
          if (current === path && editorHost.isConnected)
            editorHost.replaceChildren(
              h("p", {
                text: "Fichier indisponible. Vérifie la connexion puis rouvre-le.",
              }),
            );
        });
      return;
    }
    const text = files.get(path) || "";
    tabs.replaceChildren(h("span", { class: "ide-tab", text: path }));
    if (!ctx.owner) {
      const pre = h("pre", { id: "ide-readonly" });
      pre.append(h("code", { text }));
      editorHost.replaceChildren(pre);
      return;
    }
    mountEditor(text);
    paintTree();
  }

  async function mountEditor(text) {
    const paint = ++editorPaint;
    lastText = text;
    view?.destroy();
    view = null;
    editorHost.replaceChildren(h("p", { text: "Ouverture de l'éditeur…" }));
    try {
      const { EditorView, EditorState, basicSetup, python } = await import(
        "../vendor/editor.js"
      );
      if (paint !== editorPaint || !editorHost.isConnected) return;
      editorHost.replaceChildren();
      view = new EditorView({
        state: EditorState.create({
          doc: text,
          extensions: [
            basicSetup,
            python(),
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
              if (update.docChanged && !receiving) {
                dirty = true;
                draft();
                clearTimeout(draftTimer);
                draftTimer = setTimeout(() => syncWorkspace(), 600);
              }
            }),
          ],
        }),
        parent: editorHost,
      });
    } catch {
      if (paint !== editorPaint || !editorHost.isConnected) return;
      view = null;
      const area = h("textarea", { id: "ide-fallback", class: "ide-fallback" });
      area.value = text;
      area.oninput = () => {
        files.set(current, area.value);
        setRecord(`ide/${current}`, { content: area.value });
        dirty = true;
      };
      editorHost.replaceChildren(area);
    }
  }

  function paintTree() {
    tree.replaceChildren(
      ...paths.map((path) =>
        h(
          "button",
          {
            type: "button",
            class: path === current ? "ide-file is-on" : "ide-file",
            role: "treeitem",
            "aria-selected": path === current ? "true" : "false",
            onClick: () => showFile(path),
          },
          path.replace("model/", ""),
        ),
      ),
    );
  }

  async function runCode() {
    if (!ctx.owner) return;
    remember();
    stopped = false;
    output.textContent = "Démarrage de Python…\n";
    const payload = [...files.entries()].map(([path, content]) => ({
      path,
      content,
    }));
    const result = await request(
      { type: "run", code: readDoc(), files: payload },
      (event) => {
        if (event.type === "stdout") output.textContent += `${event.text}\n`;
      },
    );
    if (result.type === "error") output.textContent += `${result.text}\n`;
    else output.textContent += result.text ? `${result.text}\n` : "";
  }

  async function train() {
    if (!ctx.owner) return;
    remember();
    stopped = false;
    lossValues.length = 0;
    chart.replaceChildren();
    sample.textContent = "";
    const payload = [...files.entries()].map(([path, content]) => ({
      path,
      content,
    }));
    output.textContent = "Préparation d'un petit entraînement…\n";
    const ready = await request({
      type: "train-init",
      files: payload,
      steps: 8,
      text: "le chat dort dans le bois. ",
    });
    if (ready.type === "error") {
      output.textContent += `${ready.text}\n`;
      return;
    }
    for (let step = 0; step < 8; step += 1) {
      if (stopped) break;
      const event = await request({ type: "train-step" });
      if (event.type === "error") {
        output.textContent += `${event.text}\n`;
        return;
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
      if (lossValues.length) {
        try {
          await insertRow("training_runs", {
            label: "ide-navigateur",
            loss: lossValues,
            sample: sample.textContent || "",
          });
        } catch {
          output.textContent +=
            "La courbe n'a pas été enregistrée à distance.\n";
        }
      }
    } else {
      lossText.textContent =
        "Entraînement arrêté. Le worker a été coupé, le pas en cours ne continue pas.";
    }
  }

  async function saveFile() {
    if (!ctx.owner) return;
    remember();
    const content = files.get(current) || "";
    setRecord(`ide/${current}`, { content });
    await syncWorkspace();
    const state = syncStatus();
    dirty = state.pending > 0;
    output.textContent = state.conflicts.includes(`ide/${current}`)
      ? "Deux versions existent. Choisis celle à conserver dans Mon espace."
      : dirty
        ? "Brouillon local conservé. La sauvegarde distante attend une connexion."
        : "Fichier enregistré.";
  }

  function exportZip() {
    if (!ctx.owner) return;
    remember();
    const blob = zipStore(
      [...files.entries()].map(([name, data]) => ({ name, data })),
    );
    const link = h("a", {
      href: URL.createObjectURL(blob),
      download: "ide-ai-from-zero.zip",
    });
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function compute(action) {
    if (busy) return;
    busy = true;
    run.disabled = trainButton.disabled = true;
    try {
      await action();
    } catch {
      output.textContent += "Le calcul a échoué. Réessaie après un arrêt.\n";
    } finally {
      busy = false;
      run.disabled = trainButton.disabled = !ctx.owner;
    }
  }

  const run = h(
    "button",
    {
      type: "button",
      class: "button button-primary",
      id: "ide-run",
      disabled: !ctx.owner,
      onClick: () => compute(runCode),
    },
    "Exécuter",
  );
  const stop = h(
    "button",
    {
      type: "button",
      class: "button button-secondary",
      id: "ide-stop",
      disabled: !ctx.owner,
      onClick: () => {
        stopped = true;
        stopWorker();
        output.textContent += "Arrêt demandé.\n";
      },
    },
    "Arrêter",
  );
  const trainButton = h(
    "button",
    {
      type: "button",
      class: "button button-primary",
      id: "ide-train",
      disabled: !ctx.owner,
      onClick: () => compute(train),
    },
    "Entraîner",
  );
  const trainStop = h(
    "button",
    {
      type: "button",
      class: "button button-secondary",
      id: "ide-train-stop",
      disabled: !ctx.owner,
      onClick: () => {
        stopped = true;
        stopWorker();
      },
    },
    "Arrêter l'entraînement",
  );
  const save = h(
    "button",
    {
      type: "button",
      class: "button button-secondary",
      id: "ide-save",
      disabled: !ctx.owner,
      onClick: () => saveFile(),
    },
    "Sauvegarder",
  );
  const reset = h(
    "button",
    {
      type: "button",
      class: "button button-secondary",
      id: "ide-reset",
      disabled: !ctx.owner,
      onClick: async () => {
        if (!ctx.owner) return;
        const path = current;
        try {
          const file = await fetch(new URL(path, document.baseURI));
          if (!file.ok) throw new Error("fetch");
          const text = await file.text();
          files.set(path, text);
          if (current === path) showFile(path, false);
          output.textContent =
            "Fichier rétabli depuis le dépôt. Sauvegarde pour conserver cette version.";
        } catch {
          output.textContent =
            "Le fichier d'origine est indisponible. Ton code est conservé.";
        }
      },
    },
    "Rétablir",
  );
  const zip = h(
    "button",
    {
      type: "button",
      class: "button button-secondary",
      id: "ide-export",
      disabled: !ctx.owner,
      onClick: exportZip,
    },
    "Exporter le zip",
  );

  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Laboratoire" }),
    h("h1", { text: "IDE" }),
    h("p", {
      class: "lead",
      id: "ide-lock",
      text: ctx.owner
        ? "Python tourne dans un worker Pyodide. Arrêter coupe le worker : le pas en cours ne reprend pas, la page reste utilisable."
        : "Réservé au propriétaire. Le code est affiché, il ne s'exécute pas et rien n'est enregistré dans ce navigateur.",
    }),
    h("div", { class: ctx.owner ? "ide-layout" : "ide-layout is-locked" }, [
      tree,
      h("div", { class: "ide-main" }, [
        tabs,
        editorHost,
        draftStatus,
        h("div", { class: "hero-actions" }, [run, stop, save, reset, zip]),
        output,
      ]),
    ]),
    h("section", { class: "sheet", "aria-labelledby": "train-title" }, [
      h("h2", { id: "train-title", text: "Entraînement dans la page" }),
      h("p", {
        text: "Huit pas, modèle minuscule, pour voir la perte bouger. Ce n'est pas le run publié.",
      }),
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
    bar.style.height = `${Math.max(12, Math.round((value / max) * 72))}px`;
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
