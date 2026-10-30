/** Mode apprenant local : la progression d'un visiteur reste dans CE navigateur.
 *
 * Rien n'est écrit tant que le visiteur ne l'a pas demandé, et rien n'est
 * envoyé au serveur. La sauvegarde exportée a le format de Mon espace : le
 * propriétaire peut l'importer telle quelle dans son compte.
 */
import { h } from "./dom.js";
import { stepsLabel } from "./progress.js";
import { validateBackup } from "./workspace.js";

export { LOCAL_FLAG_KEY, LOCAL_PROGRESS_KEY, LOCAL_REVIEW_KEY,
  localLearnerEnabled, enableLocalLearner, forgetLocalLearner,
  readLocalProgress, writeLocalProgress } from "./local-records.js";
import { browserStorage, readLocalProgress, readLocalDrafts, readLocalStudyRecords } from "./local-records.js";
const STEP_ID = /^\d+\.\d+$/;

export function localBackup(progress, now = new Date(), drafts = {}, study = {}) {
  return {
    format: "ai-from-zero",
    version: 1,
    createdAt: now.toISOString(),
    records: {
      ...study,
      ...Object.fromEntries(Object.entries(drafts)
        .filter(([id, code]) => STEP_ID.test(id) && typeof code === "string" && code.length <= 100000)
        .map(([id, code]) => ["lesson/" + id, { ...study["lesson/" + id], exerciseCode: code }])),
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

export function draftsFromBackup(backup, knownIds) {
  const known = new Set(knownIds);
  return Object.fromEntries(Object.entries(backup.records || {})
    .filter(([key, row]) => key.startsWith("lesson/") && known.has(key.slice(7)) && typeof row?.exerciseCode === "string" && row.exerciseCode.length <= 100000)
    .map(([key, row]) => [key.slice(7), row.exerciseCode]));
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
          text: "Par défaut, le site n'écrit rien chez toi. Si tu le demandes, tes étapes cochées, quiz, résultats, brouillons, notes, favoris et preuves de construction restent dans ce navigateur, sans rien envoyer. Tu pourras les exporter ou les effacer à tout moment.",
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
        ctx.importProgress(progressFromBackup(backup, ctx.orderedIds), draftsFromBackup(backup, ctx.orderedIds), backup.records);
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
                localBackup(readLocalProgress(browserStorage()), new Date(), readLocalDrafts(browserStorage()), readLocalStudyRecords(browserStorage())),
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
