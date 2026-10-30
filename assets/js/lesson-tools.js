import { getRecord, setRecord } from "./workspace.js";
import { onLeave } from "./lifecycle.js";
import { isOwner } from "./auth.js";
import { browserStorage, localToken, readLocalDraft, writeLocalDraft } from "./local-records.js";
/** Figures, exercice et pas à pas ajoutés après le rendu de la leçon. */

import { h } from "./dom.js";
import { request, stopWorker } from "./pybridge.js";
import { mountManipulator } from "./manipulators.js";

let exercises = null;
let debugs = null;

export async function attachLessonTools(main, lessonId, owner) {
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
  const exercise = await exerciseFor(lessonId);
  if (!article.isConnected) return;
  if (exercise) column.append(exercisePanel(exercise, owner));
  const debug = await debugFor(lessonId);
  if (!article.isConnected) return;
  if (debug) column.append(debugPanel(debug, owner));
}

async function exerciseFor(lessonId) {
  if (!exercises) {
    const response = await fetch(
      new URL("data/exercises.json", document.baseURI),
    );
    exercises = response.ok ? await response.json() : [];
  }
  return exercises.find((item) => item.lessonId === lessonId) || null;
}

async function debugFor(lessonId) {
  if (!debugs) {
    const response = await fetch(new URL("data/debug.json", document.baseURI));
    debugs = response.ok ? await response.json() : [];
  }
  return debugs.find((item) => item.lessonId === lessonId) || null;
}

function exercisePanel(exercise, owner) {
  const status = h("p", {
    class: "quiz-feedback",
    role: "status",
    text: owner ? "" : "Active le suivi sur cet appareil dans le quiz pour lancer le contrôle sans compte.",
  });
  const pre = h("pre");
  pre.append(h("code", { text: exercise.starter }));
  const area = h("textarea", {
    class: "ide-fallback",
    "aria-label": "Code de l'exercice",
  });
  const token = localToken(browserStorage());
  const ownerWorkspace = isOwner();
  area.value = (ownerWorkspace
    ? getRecord(`lesson/${exercise.lessonId}`, {}).exerciseCode
    : readLocalDraft(browserStorage(), exercise.lessonId)) ?? exercise.starter;
  let lastSaved = area.value;
  const save = () => {
    if (ownerWorkspace && isOwner()) setRecord(`lesson/${exercise.lessonId}`, {
      ...getRecord(`lesson/${exercise.lessonId}`, {}), exerciseCode: area.value,
    });
    else if (!ownerWorkspace && owner && area.value !== lastSaved) {
      if (writeLocalDraft(browserStorage(), exercise.lessonId, area.value, token)) lastSaved = area.value;
      else status.textContent = "Brouillon non enregistré : le suivi a été effacé, le stockage est refusé ou le code dépasse 100 000 caractères. Copie ton code avant de fermer.";
    }
  };
  area.addEventListener("change", save);
  let timer;
  area.addEventListener("input", () => {
    clearTimeout(timer);
    if (!ownerWorkspace && owner) timer = setTimeout(save, 250);
  });
  window.addEventListener("beforeunload", save);
  onLeave(() => { clearTimeout(timer); save(); window.removeEventListener("beforeunload", save); });
  const run = h(
    "button",
    {
      type: "button",
      class: "button button-primary",
      disabled: !owner,
      onClick: async () => {
        save();
        status.textContent = "Exécution…";
        const code = `${area.value}\n${exercise.check}`;
        const result = await request({ type: "run", code, files: [] });
        window.dispatchEvent(
          new CustomEvent("afz-exercise", {
            detail: { id: exercise.lessonId, ok: result.type !== "error", scope: ownerWorkspace ? "owner" : "local", localToken: token },
          }),
        );
        status.textContent =
          result.type === "error"
            ? `Le contrôle n'est pas passé. ${result.text || "Vérifie la valeur retournée et les cas limites."}`
            : "Contrôle passé.";
      },
    },
    owner ? "Lancer le contrôle" : "Activer le suivi local pour tester",
  );
  return h(
    "section",
    { class: "callout", "data-exercise": exercise.lessonId },
    [
      h("h2", { text: "Exercice exécutable" }),
      h("p", { text: exercise.prompt }),
      owner ? area : pre,
      run,
      h(
        "button",
        { type: "button", disabled: !owner, onClick: () => stopWorker() },
        "Arrêter le contrôle",
      ),
      exercise.solution && owner
        ? h("details", {}, [
            h("summary", { text: "Corrigé Python de cet exercice" }),
            h("pre", {}, h("code", { text: exercise.solution })),
          ])
        : null,
      status,
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
