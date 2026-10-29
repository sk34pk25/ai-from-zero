/** Mode apprenant local : la progression d'un visiteur reste dans CE navigateur.
 *
 * Rien n'est écrit tant que le visiteur ne l'a pas demandé, et rien n'est
 * envoyé au serveur. La sauvegarde exportée a le format de Mon espace : le
 * propriétaire peut l'importer telle quelle dans son compte.
 */
import { h } from "./dom.js";
import { stepsLabel } from "./progress.js";
import { readJson, writeJson } from "./storage.js";
import { validateBackup } from "./workspace.js";

export const LOCAL_FLAG_KEY = "afz-local-learner";
export const LOCAL_PROGRESS_KEY = "afz-local-progress-v1";
export const LOCAL_REVIEW_KEY = "afz-local-review-v1";
const LOCAL_KEYS = [LOCAL_FLAG_KEY, LOCAL_PROGRESS_KEY, LOCAL_REVIEW_KEY];
const STEP_ID = /^\d+\.\d+$/;

export function localLearnerEnabled(storage) {
  try {
    return storage.getItem(LOCAL_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableLocalLearner(storage) {
  try {
    storage.setItem(LOCAL_FLAG_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Efface toutes les clés du mode local, et seulement elles. */
export function forgetLocalLearner(storage) {
  for (const key of LOCAL_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      /* stockage indisponible */
    }
  }
}

export function readLocalProgress(storage) {
  return readJson(storage, LOCAL_PROGRESS_KEY, null);
}

export function writeLocalProgress(storage, progress) {
  return writeJson(storage, LOCAL_PROGRESS_KEY, progress);
}

export function localBackup(progress, now = new Date()) {
  return {
    format: "ai-from-zero",
    version: 1,
    createdAt: now.toISOString(),
    records: {
      progress: {
        v: 1,
        done: [...(progress?.done || [])].filter((id) => STEP_ID.test(id)),
        quizzes: { ...(progress?.quizzes || {}) },
        exercises: { ...(progress?.exercises || {}) },
      },
    },
  };
}

/** Lit la progression d'une sauvegarde déjà validée, en ne gardant que les étapes connues. */
export function progressFromBackup(backup, knownIds) {
  const raw = backup?.records?.progress;
  if (!raw || !Array.isArray(raw.done)) throw new Error("La sauvegarde ne contient pas de progression");
  const known = new Set(knownIds);
  const keep = (map) =>
    Object.fromEntries(
      Object.entries(map && typeof map === "object" && !Array.isArray(map) ? map : {}).filter(([id]) =>
        known.has(id),
      ),
    );
  return {
    v: 1,
    done: raw.done.filter((id) => typeof id === "string" && known.has(id)),
    quizzes: keep(raw.quizzes),
    exercises: keep(raw.exercises),
  };
}

// Interface du mode local : activer, exporter, importer, effacer.

export function localOptInButton(enable) {
  return h(
    "button",
    {
      type: "button",
      class: "button button-secondary",
      "data-local-optin": "true",
      onClick: enable,
    },
    "Suivre ma progression sur cet appareil",
  );
}

export function downloadJson(name, payload) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
  );
  const link = h("a", { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Panneau de l'accueil pour un visiteur. `ctx` fournit l'état et les actions de l'application :
 * owner, local, done, quizzes, exercises, orderedIds, numericIds, enable, importProgress, erase.
 */
export function localPanel(ctx) {
  if (ctx.owner) return null;
  if (!ctx.local)
    return h(
      "section",
      { class: "panel local-panel", "aria-labelledby": "local-title" },
      [
        h("p", { class: "eyebrow", text: "Sans compte" }),
        h("h2", { id: "local-title", text: "Garder ta progression" }),
        h("p", {
          text: "Par défaut, le site n'écrit rien chez toi. Si tu le demandes, tes étapes cochées, tes quiz et tes exercices restent dans ce navigateur, sans rien envoyer. Tu pourras les exporter ou les effacer à tout moment.",
        }),
        localOptInButton(ctx.enable),
      ],
    );
  const importInput = h("input", {
    type: "file",
    accept: "application/json,.json",
    class: "visually-hidden",
    "aria-label": "Importer une sauvegarde de progression",
    onChange: async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const backup = validateBackup(JSON.parse(await file.text()));
        ctx.importProgress(progressFromBackup(backup, ctx.orderedIds));
      } catch {
        ctx.importProgress(null);
      }
    },
  });
  return h(
    "section",
    { class: "panel local-panel", "aria-labelledby": "local-title" },
    [
      h("p", { class: "eyebrow", text: "Sans compte" }),
      h("h2", { id: "local-title", text: "Progression gardée dans ce navigateur" }),
      h("p", {
        text: `${stepsLabel(ctx.done.size)}. Rien n'est envoyé au serveur. Vider les données du site efface aussi cette progression : exporte-la de temps en temps.`,
      }),
      h("div", { class: "aid-actions" }, [
        h(
          "button",
          {
            type: "button",
            "data-local-export": "true",
            onClick: () =>
              downloadJson(
                `ai-from-zero-progression-${new Date().toISOString().slice(0, 10)}.json`,
                localBackup({
                  done: ctx.numericIds.filter((id) => ctx.done.has(id)),
                  quizzes: ctx.quizzes,
                  exercises: ctx.exercises,
                }),
              ),
          },
          "Exporter",
        ),
        h(
          "button",
          { type: "button", onClick: () => importInput.click() },
          "Importer",
        ),
        h("button", { type: "button", onClick: ctx.erase }, "Effacer"),
        importInput,
      ]),
    ],
  );
}
