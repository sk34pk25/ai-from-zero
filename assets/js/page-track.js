/** Construire mon LLM : la piste du dossier vide au GPT entraîné, avec les vrais comptes-rendus. */
import { appendChildren, crumb, h } from "./dom.js";
import { mountChatRun, mountTrainingRun } from "./visuals.js";

export function paintTrack(main, { track, done, reports, loadReports, isCurrent }) {
  const stages = track ?? [];
  const doneCount = stages.filter((stage) => done.has(stage.step)).length;
  const list = h("ol", { class: "track-list" });
  stages.forEach((stage, index) => {
    const done = done.has(stage.step);
    const item = h("li", { class: done ? "track-step is-done" : "track-step" });
    appendChildren(item, [
      h("p", {
        class: "eyebrow",
        text: done ? `Étape ${index + 1} · cochée` : `Étape ${index + 1}`,
      }),
      h("h2", { text: stage.title }),
      h("p", { text: stage.summary }),
      h("p", {}, [
        "Fichier ",
        h("code", { text: stage.file }),
        " · leçon ",
        h("a", { href: `#/lecon/${stage.step}`, text: stage.step }),
        ".",
      ]),
    ]);
    list.append(item);
  });
  const sample = [
    "python3 -m model.gpt_train --steps 400",
    'python3 -m model.gpt_sample --prompt "le chat "',
  ].join("\n");
  const pre = h("pre");
  pre.append(h("code", { text: sample }));
  const runHost = h("div", { class: "visual-host", "data-run-host": "true" });
  const chatHost = h("div", { class: "visual-host", "data-chat-host": "true" });
  const reportsReady = Boolean(reports.gptRun && reports.finetuneRun);
  if (!reportsReady) {
    runHost.append(
      h("p", { class: "visual-readout", text: "Chargement du compte-rendu…" }),
    );
    chatHost.append(
      h("p", { class: "visual-readout", text: "Chargement du compte-rendu…" }),
    );
  }
  main.replaceChildren(
    crumb([{ href: "#/", label: "Accueil" }, { label: "Construire" }]),
    h("p", { class: "eyebrow", text: "Fil rouge" }),
    h("h1", { text: "Construire ton LLM" }),
    h("section", { class: "callout" }, [
      h("h2", { text: "Construire avec tes fonctions" }),
      h("p", {
        text: "Tronc commun : niveaux 0, 1, 2, 3, 4 puis 13. Les cases de cette piste indiquent les leçons cochées ; la preuve de maîtrise est le projet final entraîné sur tes données, avec validation, baselines et rechargement.",
      }),
      h("a", {
        class: "button button-primary",
        href: "#/atelier",
        text: "Ouvrir les 12 TP et le projet final",
      }),
    ]),
    h("p", {
      class: "lead",
      text: `${stages.length} étapes, d'un dossier vide jusqu'à un petit GPT entraîné par rétropropagation. Tu lis la leçon, tu ouvres le fichier cité, tu lances le code. Les cases cochées du cours allument la piste.`,
    }),
    h(
      "section",
      { class: "callout callout-build", "aria-labelledby": "run-title" },
      [
        h("h2", { id: "run-title", text: "Entraînement réel" }),
        h("p", {
          text:
            reports.gptRun?.label ||
            "Un entraînement CPU déjà fait dans ce dépôt. Les nombres et les phrases viennent de ce run, pas d'un dessin.",
        }),
        runHost,
      ],
    ),
    h(
      "section",
      { class: "callout callout-build", "aria-labelledby": "chat-title" },
      [
        h("h2", { id: "chat-title", text: "Dialogue ajusté" }),
        h("p", {
          text:
            reports.finetuneRun?.label ||
            "L'ajustement question-réponse est dans data/finetune_run.json.",
        }),
        chatHost,
      ],
    ),
    h("p", {
      class: "track-progress",
      text: `${doneCount} / ${stages.length} étapes de la piste déjà cochées.`,
    }),
    list,
    h("section", { class: "callout callout-build" }, [
      h("h2", { text: "Lancer l'entraînement" }),
      h("p", {
        text: "Depuis la racine du dépôt. gpt_train.py entraîne TinyGPT avec l'autograd NumPy et AdamW. --dataset lit un jeu préparé, --plan enchaîne les étapes. gpt_sample.py tire une suite.",
      }),
      h("p", {}, [
        h("a", { href: "#/donnees", text: "Ouvrir le catalogue des jeux." }),
      ]),
      pre,
    ]),
    h("section", { class: "callout" }, [
      h("h2", { text: "Ce que cette piste n'entraîne pas" }),
      h("p", {
        text: "RoPE, RMSNorm, SwiGLU, GQA et les poids partagés s'entraînent dans le laboratoire Python ; le playground ne lit que la forme standard. Le dos interchangeable n'est pas entraîné de bout en bout. Le scan sélectif n'est pas un bloc Mamba complet.",
      }),
    ]),
  );
  if (reportsReady) {
    mountTrainingRun(runHost, reports.gptRun);
    mountChatRun(chatHost, reports.finetuneRun);
    return;
  }
  loadReports().then((loaded) => {
    if (!isCurrent()) return;
    mountTrainingRun(runHost, loaded.gptRun);
    mountChatRun(chatHost, loaded.finetuneRun);
  });
}
