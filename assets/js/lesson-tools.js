import { getRecord, setRecord } from "./workspace.js";
import { onLeave } from "./lifecycle.js";
import { isOwner } from "./auth.js";
import { browserStorage, localToken, readLocalDraft, writeLocalDraft } from "./local-records.js";
/** Figures, exercice et pas à pas ajoutés après le rendu de la leçon. */

import { h } from "./dom.js";
import { request, stopWorker } from "./pybridge.js";
import { mountManipulator } from "./manipulators.js";
import { publicAssetUrl } from "./public-url.js";
import { studyScope } from "./study-scope.js";
import { codeFingerprint, exerciseState, EXERCISE_LABELS } from "./exercise-result.js";

let exercises = null;
let debugs = null;

export async function attachLessonTools(main, lessonId, owner, receipt = null) {
  const article = main.querySelector(`[data-lesson-id="${lessonId}"]`);
  if (!article || article.querySelector("[data-tools]")) return;
  const marker = h("div", { "data-tools": "true" });
  const visual = article.querySelector("figure[data-visual]");
  const manipHost = h("div", {
    class: "manip-host",
    "data-manip-host": "true",
  });
  if (!visual?.querySelector("[data-lab]") && mountManipulator(manipHost, lessonId) && visual) {
    const figure = h(
      "figure",
      { class: "manipulator", "data-manipulator": lessonId },
      [
        h("figcaption", {
          text: "Figure manipulable de l'étape. Le curseur ou les jetons se règlent au clavier.",
        }),
        manipHost,
      ],
    );
    visual.insertAdjacentElement("afterend", figure);
  }
  const column = article.querySelector("[data-practice-tools]");
  if (!column) return;
  column.append(marker);
  try {
  const [exercise, debug] = await Promise.all([exerciseFor(lessonId), debugFor(lessonId)]);
  if (!article.isConnected) return;
  if (exercise) column.append(exercisePanel(exercise, receipt));
  if (debug) column.append(debugPanel(debug, owner));
  } catch {
    if (!article.isConnected) return;
    const retry = h("section", { class: "callout", role: "status" }, [
      h("p", { text: "Les activités n’ont pas pu être chargées. Le cours et ton brouillon restent disponibles." }),
      h("button", { type: "button", class: "button button-secondary", onClick: () => {
        retry.remove(); marker.remove(); void attachLessonTools(main, lessonId, owner, receipt);
      } }, "Réessayer les activités"),
    ]);
    column.append(retry);
  }
}

async function exerciseFor(lessonId) {
  if (!exercises) {
    const response = await fetch(
      publicAssetUrl("data/exercises.json"),
    );
    if (!response.ok) throw new Error("Exercices indisponibles");
    const data = await response.json();
    if (!Array.isArray(data) || data.some(row => typeof row.lessonId !== "string" || typeof row.starter !== "string" || typeof row.check !== "string")) throw new Error("Catalogue invalide");
    exercises = data;
  }
  return exercises.find((item) => item.lessonId === lessonId) || null;
}

async function debugFor(lessonId) {
  if (!debugs) {
    const response = await fetch(publicAssetUrl("data/debug.json"));
    if (!response.ok) throw new Error("Traces indisponibles");
    const data = await response.json();
    if (!Array.isArray(data) || data.some(row => typeof row.lessonId !== "string" || typeof row.code !== "string")) throw new Error("Traces invalides");
    debugs = data;
  }
  return debugs.find((item) => item.lessonId === lessonId) || null;
}

function exercisePanel(exercise, initialReceipt) {
  const status = h("p", {
    class: "quiz-feedback",
    role: "status",
    text: "Contrôle disponible sans compte. Le suivi local est facultatif pour garder ton brouillon.",
  });
  const area = h("textarea", {
    class: "ide-fallback",
    "aria-label": "Code de l'exercice",
  });
  const token = localToken(browserStorage());
  const ownerWorkspace = isOwner();
  const scope = studyScope();
  let receipt = initialReceipt, stateTicket = 0, active = true;
  const detail = () => ({ id: exercise.lessonId, scope: ownerWorkspace ? "owner" : "local", localToken: token });
  const history = h("details", { class: "exercise-history" }, [h("summary", { text: "Mes dernières tentatives" })]);
  const historyList = h("ol"); history.append(historyList);
  const paintHistory = () => {
    const attempts = scope.get(`lesson/${exercise.lessonId}`).exerciseAttempts;
    historyList.replaceChildren(...(Array.isArray(attempts) ? attempts : []).filter(row => row && /^[a-f0-9]{64}$/.test(row.codeHash) && Number.isFinite(row.checkedAt)).slice(-5).reverse().map(row => h("li", { text: `${new Date(row.checkedAt).toLocaleString("fr")} · ${row.ok ? "contrôle passé" : "à corriger"} · code ${row.codeHash.slice(0, 8)}` })));
    history.hidden = historyList.children.length === 0;
  };
  const refreshValidity = async () => {
    const ticket = ++stateTicket;
    const hash = await codeFingerprint(area.value);
    if (!active || ticket !== stateTicket) return;
    const value = exerciseState(receipt, hash, exercise.validatorVersion);
    window.dispatchEvent(new CustomEvent("afz-exercise-state", { detail: { ...detail(), state: value } }));
    if (receipt) status.textContent = value === "passed" ? "Contrôle passé pour ce code." : value === "failed" ? "Le contrôle de ce code est à corriger." : `${EXERCISE_LABELS[value]}. La tentative précédente reste dans l’historique.`;
  };
  area.value = (ownerWorkspace
    ? getRecord(`lesson/${exercise.lessonId}`, {}).exerciseCode
    : readLocalDraft(browserStorage(), exercise.lessonId) ?? scope.get(`lesson/${exercise.lessonId}`).exerciseCode) ?? exercise.starter;
  let lastSaved = area.value;
  const save = () => {
    if (ownerWorkspace && isOwner()) setRecord(`lesson/${exercise.lessonId}`, {
      ...getRecord(`lesson/${exercise.lessonId}`, {}), exerciseCode: area.value,
    });
    else if (!ownerWorkspace && token && area.value !== lastSaved) {
      if (writeLocalDraft(browserStorage(), exercise.lessonId, area.value, token)) lastSaved = area.value;
      else status.textContent = "Brouillon non enregistré : le suivi a été effacé, le stockage est refusé ou le code dépasse 100 000 caractères. Copie ton code avant de fermer.";
    }
    else if (!ownerWorkspace && !token && !localToken(browserStorage())) scope.set(`lesson/${exercise.lessonId}`, { ...scope.get(`lesson/${exercise.lessonId}`), exerciseCode: area.value });
  };
  area.addEventListener("change", save);
  let timer;
  area.addEventListener("input", () => {
    stateTicket++;
    window.dispatchEvent(new CustomEvent("afz-exercise-state", { detail: { ...detail(), state: receipt ? "modified" : "untried" } }));
    if (receipt) status.textContent = "Code modifié : contrôle à relancer. La tentative précédente reste dans l’historique.";
    void refreshValidity();
    clearTimeout(timer);
    if (!ownerWorkspace && token) timer = setTimeout(save, 250);
  });
  window.addEventListener("beforeunload", save);
  let generation = 0, dependencies = null, running = false;
  const cancel = () => {
    generation++;
    dependencies?.abort(); dependencies = null;
    if (running) stopWorker();
    running = false;
    run.disabled = false;
    status.textContent = "Contrôle arrêté. Ton code est conservé.";
  };
  onLeave(() => { active = false; stateTicket++; cancel(); clearTimeout(timer); save(); window.removeEventListener("beforeunload", save); });
  const run = h(
    "button",
    {
      type: "button",
      class: "button button-primary",
      onClick: async () => {
        const current = ++generation;
        const source = area.value;
        dependencies = new AbortController();
        run.disabled = true;
        save();
        status.textContent = "Chargement de Python puis contrôle… Tu peux arrêter le chargement ou le calcul.";
        try {
        const files = [];
        for (const path of exercise.files || []) {
          if (!/^model\/[a-zA-Z0-9_./-]+\.py$/.test(path) || path.includes("..")) throw new Error("Dépendance invalide");
          const response = await fetch(publicAssetUrl(path), { signal: dependencies.signal });
          if (!response.ok) throw new Error("Dépendance indisponible : " + path);
          files.push({ path, content: await response.text() });
        }
        if (current !== generation) return;
        const codeHash = await codeFingerprint(source);
        if (current !== generation) return;
        const code = `${source}\n${exercise.check}`;
        running = true;
        const result = await request({ type: "exercise", code, files });
        if (current !== generation) return;
        if (result.cancelled || result.busy) {
          status.textContent = result.busy ? "Python est déjà occupé. Relance le contrôle quand le calcul est terminé." : "Contrôle arrêté. Ton code est conservé.";
          return;
        }
        if (["loading", "dependencies"].includes(result.phase)) {
          status.textContent = `Le moteur Python n’est pas prêt. ${result.text || "Vérifie la connexion."} Ton code est conservé ; relance le contrôle. Aucune nouvelle tentative de code n’a été évaluée.`;
          return;
        }
        if (!result.cancelled && !result.busy) {
        receipt = { ok: result.type !== "error", codeHash, validatorVersion: exercise.validatorVersion, checkedAt: Date.now() };
        if (codeHash) {
          const key = `lesson/${exercise.lessonId}`, row = scope.get(key);
          scope.set(key, { ...row, exerciseAttempts: [...(row.exerciseAttempts || []), receipt].slice(-20) });
          paintHistory();
        }
        window.dispatchEvent(
          new CustomEvent("afz-exercise", {
            detail: { ...detail(), ...receipt },
          }),
        );
        }
        status.textContent =
          result.type === "error"
            ? `Le contrôle n'est pas passé. ${result.text || "Vérifie la valeur retournée et les cas limites."}`
            : "Contrôle passé.";
        if (area.value !== source) await refreshValidity();
        else if (active) window.dispatchEvent(new CustomEvent("afz-exercise-state", { detail: { ...detail(), state: codeHash ? receipt?.ok ? "passed" : "failed" : "legacy" } }));
        } catch (error) { if (current === generation) status.textContent = `${error.message}. Ton code est conservé ; relance le contrôle quand la connexion revient.`; }
        finally { if (current === generation) { run.disabled = false; running = false; dependencies = null; } }
      },
    },
    "Lancer le contrôle",
  );
  paintHistory(); void refreshValidity();
  return h(
    "section",
    { class: "callout", "data-exercise": exercise.lessonId },
    [
      h("h2", { text: "Exercice exécutable" }),
      h("p", { text: exercise.prompt }),
      area,
      run,
      h(
        "button",
        { type: "button", class: "button button-secondary", onClick: cancel },
        "Arrêter le contrôle",
      ),
      exercise.solution
        ? h("details", {}, [
            h("summary", { text: "Corrigé Python de cet exercice" }),
            h("pre", {}, h("code", { text: exercise.solution })),
          ])
        : null,
      status,
      history,
    ],
  );
}

function debugPanel(spec, owner) {
  const status = h("p", {
    class: "quiz-feedback",
    role: "status",
    text: owner
      ? "Le pas à pas rejoue une trace enregistrée. Il ne met pas la page en pause pendant l'exécution."
      : "Active le suivi sur cet appareil dans le quiz pour utiliser le pas à pas sans compte.",
  });
  const line = h("p", { class: "manip-readout", text: "" });
  const locals = h("div", { class: "debug-locals" });
  const code = h("pre");
  code.className = "debug-code";
  const codeLines = spec.code.split("\n").map((text, i) => h("code", { text: `${i+1}  ${text}\n`, "data-debug-line": i+1 }));
  code.append(...codeLines);
  let playback = null;
  const pause = () => { window.clearInterval(playback); playback = null; };
  onLeave(pause);
  let snaps = [];
  let index = 0;
  function show() {
    const snap = snaps[index];
    if (!snap) {
      line.textContent = "Aucune ligne enregistrée.";
      return;
    }
    line.textContent = `Ligne ${snap.line}, pas ${index + 1} / ${snaps.length}.`;
    for (const el of codeLines) {
      const active = Number(el.dataset.debugLine) === Number(snap.line);
      el.classList.toggle("is-active", active);
      if (active) el.setAttribute("aria-current", "step"); else el.removeAttribute("aria-current");
    }
    locals.replaceChildren();
    for (const [name, value] of Object.entries(snap.locals || {})) {
      locals.append(localView(name, value));
    }
  }
  const start = h(
    "button",
    {
      type: "button",
      class: "button button-primary",
      disabled: !owner,
      onClick: async () => {
        pause();
        status.textContent = "Trace…";
        const result = await request({
          type: "debug",
          code: spec.code,
          files: [],
        });
        if (result.type === "error") {
          status.textContent = "La trace n'a pas pu être lue.";
          return;
        }
        snaps = result.snapshots || [];
        index = 0;
        show();
        status.textContent = `${snaps.length} pas enregistrés.`;
      },
    },
    owner ? "Pas à pas" : "Activer le suivi local pour manipuler",
  );
  const next = h(
    "button",
    {
      type: "button",
      class: "button button-secondary",
      disabled: !owner,
      onClick: () => {
        pause();
        if (index < snaps.length - 1) {
          index += 1;
          show();
        }
      },
    },
    "Pas suivant",
  );
  const speed = h("select", { "aria-label": "Vitesse du pas à pas" }, [800, 400, 200].map(ms => h("option", { value: ms, text: `${ms} ms par étape` })));
  const previous = h("button", { type: "button", disabled: !owner, onClick: () => { pause(); index = Math.max(0, index - 1); show(); } }, "Pas précédent");
  const play = h("button", { type: "button", disabled: !owner, onClick: () => {
    pause();
    playback = window.setInterval(() => {
      if (index >= snaps.length - 1) pause();
      else { index++; show(); }
    }, Number(speed.value));
  } }, "Continuer");
  const pauseButton = h("button", { type: "button", disabled: !owner, onClick: pause }, "Pause");
  const reset = h(
    "button",
    {
      type: "button",
      class: "button button-secondary",
      disabled: !owner,
      onClick: () => {
        pause();
        index = 0;
        show();
        stopWorker();
      },
    },
    "Revenir au début",
  );
  return h("section", { class: "callout", "data-debug": spec.lessonId }, [
    h("h2", { text: "Pas à pas" }),
    h("p", { text: spec.caption }),
    code,
    h("div", { class: "hero-actions" }, [start, previous, next, play, pauseButton, reset, speed]),
    line,
    locals,
    status,
  ]);
}

function localView(name, value) {
  const block = h("div", { class: "debug-var" }, [h("p", { text: name })]);
  if (value.kind === "array") {
    block.append(
      h("p", { class: "muted", text: `forme ${value.shape.join(" × ")}` }),
    );
    const columns = Math.max(1, Math.min(value.shape.at(-1) || 1, 8));
    const grid = h("div", { class: "heat-grid", style: `grid-template-columns:repeat(${columns},minmax(3rem,1fr));overflow:auto;max-width:100%` });
    for (const item of value.preview || []) {
      const cell = h("span", {
        class: "heat-cell",
        text: Number(item).toFixed(2),
      });
      grid.append(cell);
    }
    block.append(grid);
  } else {
    block.append(h("p", { text: value.text || "" }));
  }
  return block;
}
