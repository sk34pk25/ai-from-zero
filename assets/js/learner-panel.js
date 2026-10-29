/** Interface du mode apprenant local : activer, exporter, importer, effacer. */
import { h } from "./dom.js";
import { localBackup, progressFromBackup } from "./learner.js";
import { stepsLabel } from "./progress.js";
import { validateBackup } from "./workspace.js";

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
