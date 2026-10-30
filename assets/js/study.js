import { offlinePanel } from "./offline.js";
import { h } from "./dom.js";
import {
  getRecord,
  setRecord,
  allRecords,
  syncStatus,
  subscribe,
  syncWorkspace,
  resolveConflict,
  exportBackup,
  completeBackup,
  validateBackup,
  importBackup,
  forgetLocalWorkspace,
} from "./workspace.js";
import { isOwner } from "./auth.js";
import { onLeave } from "./lifecycle.js";
export function recordAttempt(id, type, ok) {
  if (!isOwner()) return;
  const row = getRecord(`lesson/${id}`, {});
  const interval = ok ? Math.min((row.review?.interval || 0) + 1, 5) : 0;
  const days = [0, 1, 3, 7, 14, 30][interval];
  setRecord(`lesson/${id}`, {
    ...row,
    attempts: [...(row.attempts || []), { type, ok, at: Date.now() }].slice(
      -100,
    ),
    review: { interval, due: Date.now() + (ok ? days * 86400000 : 600000) },
  });
}
export function dueLessons(index) {
  return index.orderedIds.filter((id) => {
    const r = getRecord(`lesson/${id}`, {});
    return r.review && r.review.due <= Date.now();
  });
}
export function lessonNotebook(id) {
  const data = getRecord(`lesson/${id}`, {});
  const host = h("section", { class: "sheet notebook" });
  const favorite = h(
    "button",
    {
      type: "button",
      "aria-pressed": data.favorite ? "true" : "false",
      disabled: !isOwner(),
    },
    data.favorite ? "Retirer des favoris" : "Ajouter aux favoris",
  );
  favorite.onclick = () => {
    const row = getRecord(`lesson/${id}`, {});
    row.favorite = !row.favorite;
    setRecord(`lesson/${id}`, row);
    favorite.textContent = row.favorite
      ? "Retirer des favoris"
      : "Ajouter aux favoris";
    favorite.setAttribute("aria-pressed", String(row.favorite));
  };
  const note = h("textarea", {
    rows: 5,
    "aria-label": "Mes notes pour cette leçon",
    disabled: !isOwner(),
  });
  note.value = data.note || "";
  const feedback = h("p", {
    role: "status",
    text: isOwner()
      ? "Brouillon enregistré automatiquement sur cet appareil."
      : "Connecte-toi pour écrire des notes.",
  });
  let timer;
  let editing = false;
  const receive = () => {
    const row = getRecord(`lesson/${id}`, {});
    if (!editing) note.value = row.note || "";
    else if (row.note === note.value && syncStatus().status === "synced")
      editing = false;
  };
  const unsubscribe = subscribe(receive);
  onLeave(unsubscribe);
  const save = () => {
    clearTimeout(timer);
    if (isOwner() && editing) void syncWorkspace();
    if (
      isOwner() &&
      editing &&
      note.value !== (getRecord(`lesson/${id}`, {}).note || "")
    ) {
      setRecord(`lesson/${id}`, {
        ...getRecord(`lesson/${id}`, {}),
        note: note.value,
      });
      feedback.textContent =
        "Notes conservées sur cet appareil ; synchronisation en cours.";
    }
  };
  note.oninput = () => {
    editing = true;
    clearTimeout(timer);
    if (isOwner())
      setRecord(
        `lesson/${id}`,
        { ...getRecord(`lesson/${id}`, {}), note: note.value },
        { sync: false },
      );
    timer = setTimeout(() => syncWorkspace(), 700);
  };
  note.addEventListener("change", save);
  window.addEventListener("pagehide", save);
  onLeave(() => window.removeEventListener("pagehide", save));
  onLeave(save);
  host.append(
    h("h2", { text: "Mon carnet" }),
    favorite,
    h("label", {}, ["Notes personnelles", note]),
    feedback,
  );
  return host;
}
export function prerequisiteLinks(text) {
  const host = h("p");
  let cursor = 0;
  const rx = /\b\d+\.\d+\b/g;
  for (const m of text.matchAll(rx)) {
    host.append(
      document.createTextNode(text.slice(cursor, m.index)),
      h("a", { href: `#/lecon/${m[0]}`, text: m[0] }),
    );
    cursor = m.index + m[0].length;
  }
  host.append(document.createTextNode(text.slice(cursor)));
  return host;
}
export function learningToolbar() {
  const pref = getRecord("preferences", {});
  const host = h("section", {
    class: "learning-toolbar",
    "aria-label": "Lecture",
  });
  const mode = h("button", { type: "button", "aria-pressed": "false" }, "Lecture sans distraction");
  mode.onclick = () => {
    const active = document.body.classList.toggle("reading-mode");
    mode.setAttribute("aria-pressed", String(active));
  };
  const size = h("select", { "aria-label": "Taille du texte" });
  for (const [v, label] of [
    ["1", "Normale"],
    ["1.15", "Grande"],
    ["1.3", "Très grande"],
  ])
    size.append(h("option", { value: v, text: label }));
  size.value = String(pref.scale || 1);
  const apply = () =>
    document.documentElement.style.setProperty("--reading-scale", size.value);
  size.onchange = () => {
    apply();
    if (isOwner())
      setRecord("preferences", {
        ...getRecord("preferences", {}),
        scale: Number(size.value),
      });
  };
  apply();
  host.append(
    mode,
    h("label", {}, ["Texte", size]),
    h("button", { type: "button", onClick: () => window.print() }, "Imprimer"),
    h("a", { href: "#/espace", text: "Mon espace" }),
    h("a", { href: "#/glossaire", text: "Glossaire" }),
    h("a", { href: "#/experiences", text: "Mes expériences" }),
  );
  return host;
}
export function resumePanel(index) {
  if (!isOwner()) return null;
  const row = getRecord("reading", {});
  const item = index.byId.get(row.id);
  return h("section", { class: "sheet" }, [
    h("h2", { text: "Mon espace d’apprentissage" }),
    h("p", { text: `${dueLessons(index).length} révision(s) à faire.` }),
    item
      ? h("a", {
          class: "button",
          href: `#/lecon/${row.id}`,
          text: `Reprendre ${item.lesson.title}`,
        })
      : null,
    h("a", {
      class: "button",
      href: "#/espace",
      text: "Notes, séances et sauvegardes",
    }),
  ]);
}
function download(name, value) {
  const a = h("a", {
    download: name,
    href: URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    ),
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export async function backupDownload() {
  download(
    `ai-from-zero-${new Date().toISOString().slice(0, 10)}.json`,
    await completeBackup(),
  );
}
export function paintStudy(main, index) {
  const extras = h("div");
  let current = true;
  onLeave(() => { current = false; });
  Promise.all([import("./path-choice.js"), import("./project-evidence.js")]).then(([path, project]) => {
    if (current) extras.replaceChildren(path.pathChoice(index), project.projectEvidence(index));
  }).catch(() => {
    if (current) extras.append(h("p", { role: "status", text: "Les outils du projet n'ont pas pu être chargés. Recharge la page lorsque le réseau revient." }));
  });
  main.replaceChildren(
    h("h1", { text: "Mon espace d’apprentissage" }),
    extras,
    offlinePanel(),
  );
  if (!isOwner()) {
    main.append(
      h("p", {
        text: "Connecte-toi au compte propriétaire pour retrouver tes notes, fichiers et révisions.",
      }),
      h("a", { href: "#/connexion", text: "Se connecter" }),
    );
    return;
  }
  const status = h("p", { role: "status" });
  const conflicts = h("div");
  const refresh = () => {
    const s = syncStatus();
    status.textContent =
      s.status === "storage-error"
        ? "Le stockage est indisponible : exporte tes données avant de fermer."
        : `${{ syncing: "Synchronisation…", synced: "Synchronisé", offline: "Hors connexion — les brouillons restent sur cet appareil", local: "Données locales" }[s.status]}. ${s.pending} modification(s) en attente.`;
    conflicts.replaceChildren(
      ...s.conflicts.map((key) =>
        h("section", { class: "sheet" }, [
          h("h2", { text: "Deux versions à départager" }),
          h("p", { text: key }),
          h("details", {}, [
            h("summary", { text: "Voir ma copie" }),
            h(
              "pre",
              {},
              h("code", {
                text: JSON.stringify(allRecords()[key]?.payload, null, 2),
              }),
            ),
          ]),
          h("details", {}, [
            h("summary", { text: "Voir la version distante" }),
            h(
              "pre",
              {},
              h("code", {
                text: JSON.stringify(
                  allRecords()[key]?.conflict?.payload,
                  null,
                  2,
                ),
              }),
            ),
          ]),
          h("p", {
            text: "Exporte une sauvegarde avant de choisir. Garder ta copie archive aussi la version distante.",
          }),
          h(
            "button",
            { type: "button", onClick: () => resolveConflict(key, "local") },
            "Garder ma copie",
          ),
          h(
            "button",
            { type: "button", onClick: () => resolveConflict(key, "remote") },
            "Utiliser la version distante",
          ),
        ]),
      ),
    );
  };
  const unsub = subscribe(refresh);
  onLeave(unsub);
  refresh();
  main.append(
    status,
    h(
      "button",
      { type: "button", onClick: () => syncWorkspace() },
      "Synchroniser maintenant",
    ),
    conflicts,
  );
  const select = h("select", { "aria-label": "Durée de la séance" });
  for (const n of [15, 30, 60])
    select.append(h("option", { value: n, text: `${n} minutes` }));
  const session = h("ol");
  const plan = () => {
    let left = Number(select.value);
    const done = new Set(getRecord("progress", {}).done || []);
    const due = dueLessons(index);
    const ids = [
      ...due,
      ...index.orderedIds.filter((id) => !done.has(id) && !due.includes(id)),
    ];
    const chosen = [];
    for (const id of ids) {
      const lesson = index.byId.get(id).lesson;
      const duration = due.includes(id)
        ? Math.min(10, lesson.minutes)
        : lesson.minutes;
      if (duration <= left) {
        chosen.push(
          h("li", {}, [
            h("a", { href: `#/lecon/${id}`, text: lesson.title }),
            ` · ${duration} min${due.includes(id) ? " de révision" : ""}`,
          ]),
        );
        left -= duration;
      } else if (!due.includes(id)) {
        // Ne saute jamais une nouvelle leçon pour remplir artificiellement le créneau.
        break;
      }
    }
    session.replaceChildren(...chosen);
    if (!chosen.length)
      session.append(
        h("li", {
          text: "Commence la prochaine leçon pendant ce créneau ; conserve ta position pour la terminer plus tard.",
        }),
      );
  };
  select.onchange = plan;
  plan();
  main.append(
    h("section", { class: "sheet" }, [
      h("h2", { text: "Ma prochaine séance" }),
      select,
      session,
    ]),
  );
  const collections = h("div");
  main.append(collections);
  const paintCollections = () => {
    collections.replaceChildren();
    const lessons = index.orderedIds.map((id) => ({
      id,
      row: getRecord(`lesson/${id}`, {}),
      lesson: index.byId.get(id).lesson,
    }));
    for (const [title, items] of [
      ["À réviser", lessons.filter((x) => x.row.review?.due <= Date.now())],
      ["Mes favoris", lessons.filter((x) => x.row.favorite)],
      ["Mes notes", lessons.filter((x) => x.row.note)],
    ]) {
      collections.append(
        h("section", { class: "sheet" }, [
          h("h2", { text: title }),
          ...items.map((x) =>
            h("article", {}, [
              h("a", {
                href: `#/lecon/${x.id}`,
                text: `${x.id} · ${x.lesson.title}`,
              }),
              x.row.note ? h("p", { text: x.row.note }) : null,
            ]),
          ),
          items.length
            ? null
            : h("p", { text: "Aucun élément pour le moment." }),
        ]),
      );
    }
  };
  paintCollections();
  const stopCollections = subscribe(() => {
    paintCollections();
    plan();
  });
  onLeave(stopCollections);
  const result = h("p", { role: "status" });
  let candidate = null;
  const input = h("input", {
    type: "file",
    accept: ".json,application/json",
    "aria-label": "Sauvegarde à importer",
  });
  const apply = h(
    "button",
    {
      type: "button",
      disabled: true,
      onClick: async () => {
        if (!candidate) return;
        await backupDownload();
        importBackup(candidate);
        result.textContent =
          "Import effectué. Une sauvegarde de l’état précédent a été téléchargée.";
        apply.disabled = true;
      },
    },
    "Confirmer la restauration",
  );
  input.onchange = async () => {
    candidate = null;
    apply.disabled = true;
    try {
      const file = input.files[0];
      if (!file || file.size > 20_000_000) throw new Error("Fichier trop gros");
      candidate = validateBackup(JSON.parse(await file.text()));
      result.textContent = `${Object.keys(candidate.records).length} éléments vérifiés. La restauration remplace les éléments de même nom ; les autres sont conservés.`;
      apply.disabled = false;
    } catch (e) {
      result.textContent = e.message;
    }
  };
  main.append(
    h("section", { class: "sheet" }, [
      h("h2", { text: "Sauvegardes et restauration" }),
      h(
        "button",
        { type: "button", onClick: backupDownload },
        "Exporter mes données",
      ),
      input,
      result,
      apply,
    ]),
  );
  main.append(
    h("section", { class: "sheet" }, [
      h("h2", { text: "Réinitialiser la progression" }),
      h("p", {
        text: "Les fichiers, notes et favoris sont conservés. Exporte une sauvegarde avant toute réinitialisation.",
      }),
      h(
        "button",
        {
          type: "button",
          onClick: async () => {
            if (
              confirm(
                "Retirer la copie locale et recharger la version distante ? Les brouillons non synchronisés seront perdus.",
              )
            ) {
              await backupDownload();
              await forgetLocalWorkspace();
              location.reload();
            }
          },
        },
        "Recharger cet appareil depuis le cloud",
      ),
      h(
        "button",
        {
          type: "button",
          onClick: async () => {
            if (
              confirm(
                "Réinitialiser les étapes, quiz et exercices sur tous tes appareils ?",
              )
            ) {
              await backupDownload();
              setRecord("progress", {
                v: 1,
                done: [],
                quizzes: {},
                exercises: {},
              });
              for (const [key, r] of Object.entries(allRecords()))
                if (key.startsWith("lesson/"))
                  setRecord(key, {
                    note: r.payload.note || "",
                    favorite: !!r.payload.favorite,
                    exerciseCode: r.payload.exerciseCode || "",
                  });
              result.textContent =
                "Réinitialisation enregistrée ; synchronisation en cours.";
            }
          },
        },
        "Réinitialiser la progression partout",
      ),
    ]),
  );
}
export function paintGlossary(main, index) {
  main.replaceChildren(h("h1", { text: "Glossaire du laboratoire" }));
  const input = h("input", {
    type: "search",
    "aria-label": "Rechercher un terme",
    placeholder: "Gradient, token, attention…",
  });
  const list = h("div");
  const entries = [];
  for (const id of index.orderedIds) {
    const lesson = index.byId.get(id).lesson;
    const text = lesson.sections.find((s) => s.kind === "vocab")?.text || "";
    for (const part of text.split(/\.\s+(?=[A-ZÀÉÈÎÔ])/)) {
      const at = part.indexOf(":");
      if (at > 0 && at < 65)
        entries.push({
          term: part.slice(0, at).trim(),
          definition: part.slice(at + 1).trim(),
          id,
        });
    }
  }
  const paint = () => {
    const q = input.value.toLocaleLowerCase("fr");
    list.replaceChildren(
      ...entries
        .filter((e) =>
          (e.term + " " + e.definition).toLocaleLowerCase("fr").includes(q),
        )
        .sort((a, b) => a.term.localeCompare(b.term, "fr"))
        .map((e) =>
          h("article", { class: "sheet" }, [
            h("h2", { text: e.term }),
            h("p", { text: e.definition }),
            h("a", { href: `#/lecon/${e.id}`, text: `Voir la leçon ${e.id}` }),
          ]),
        ),
    );
  };
  input.oninput = paint;
  main.append(input, list);
  paint();
}

export function levelCheckpoint(level) {
  const key = `level/${level.id}`,
    saved = getRecord(key, {});
  const host = h("section", { class: "sheet" });
  host.append(
    h("h2", { text: "Bilan pratique du niveau" }),
    h("p", { text: level.project }),
    h("p", {
      text: "Réalise ce projet puis vérifie les critères ci-dessous. Ce bilan est une autoévaluation, pas une certification automatique.",
    }),
  );
  const criteria = level.assessment?.criteria || [
    "Je peux expliquer la brique sans relire le cours.",
    "Je peux exécuter son exemple et vérifier un résultat attendu.",
    "Je peux nommer une limite et un cas d’échec.",
  ];
  criteria.forEach((text, i) => {
    const box = h("input", { type: "checkbox", disabled: !isOwner() });
    box.checked = saved.assessmentVersion === 2 && !!saved.criteria?.[i];
    box.onchange = () => {
      const row = getRecord(key, {});
      setRecord(key, {
        ...row,
        assessmentVersion: 2,
        previousCriteria:
          row.previousCriteria ||
          (row.assessmentVersion !== 2 ? row.criteria : undefined),
        criteria: {
          ...(row.assessmentVersion === 2 ? row.criteria : {}),
          [i]: box.checked,
        },
      });
    };
    host.append(h("label", { class: "checkpoint-criterion" }, [box, text]));
  });
  if (level.assessment)
    host.append(
      h("p", { text: `Livrable : ${level.assessment.deliverable}` }),
      h("a", {
        href: "#/atelier",
        text: "Ouvrir les TP et les critères du projet final",
      }),
    );
  const note = h("textarea", {
    rows: 4,
    "aria-label": "Compte-rendu du projet",
    disabled: !isOwner(),
  });
  note.value = saved.note || "";
  note.onchange = () =>
    setRecord(key, { ...getRecord(key, {}), note: note.value });
  host.append(
    h("label", {}, [
      "Résultat observé, commande utilisée et limite rencontrée",
      note,
    ]),
  );
  onLeave(() => {
    if (isOwner() && note.value !== (getRecord(key, {}).note || ""))
      setRecord(key, { ...getRecord(key, {}), note: note.value });
  });
  return host;
}
