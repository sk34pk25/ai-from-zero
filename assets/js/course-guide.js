/** Repères publics : le tronc commun et les explorations restent indépendants. */
import { h } from "./dom.js";
import { completionStats } from "./progress.js";
import { lessonTiming } from "./curriculum.js";

export const PHASES = [
  { levels: [0], title: "Préparer et coder", result: "Un environnement utilisable et un programme Python vérifié.", check: "Modifier une fonction, lancer ses tests et expliquer les tableaux.", prerequisite: "Aucun prérequis informatique." },
  { levels: [1], title: "Comprendre l’apprentissage", result: "Un petit réseau et des gradients contrôlés.", check: "Comparer une dérivée numérique au gradient calculé par ton moteur.", prerequisite: "Les fonctions, classes et tableaux du niveau 0." },
  { levels: [2, 3], title: "Texte, données et baseline", result: "Un tokenizer réversible, des batches et un modèle bigramme mesuré.", check: "Séparer les données et comparer la perte à une référence uniforme.", prerequisite: "Les probabilités et gradients du niveau 1." },
  { levels: [4], title: "Construire le decoder", result: "Un petit GPT entraînable et rechargeable.", check: "Contrôler le masque causal, entraîner puis retrouver les mêmes logits après rechargement.", prerequisite: "Le tokenizer, les fenêtres et la perte des niveaux 2 et 3." },
  { levels: [13, 12], title: "Évaluer et livrer", result: "Un modèle personnel, une comparaison contrôlée et son dossier de résultats.", check: "Fixer une hypothèse, choisir sur validation, mesurer sur le test réservé et expliquer les limites. Le BPE approfondi, le SFT et LoRA restent des extensions.", prerequisite: "Le premier GPT du niveau 4 ; les TP et le projet final se réalisent sur ordinateur." },
];

export function pathProgress(index, done) {
  return {
    core: completionStats(index.coreIds, [...done]),
    exploration: completionStats(index.explorationIds, [...done]),
  };
}

export function courseProgress(index, done) {
  const groups = pathProgress(index, done);
  return h("section", { class: "sheet course-progress", "aria-label": "Progression par parcours" }, [
    h("h2", { text: "Mes repères de progression" }),
    h("div", { class: "path-progress-grid" }, [
      ["Mon premier GPT", groups.core], ["Explorations", groups.exploration],
    ].map(([label, stats]) => h("div", {}, [
      h("h3", { text: label }),
      h("p", { text: `${stats.count} / ${stats.total} leçons cochées` }),
      h("progress", { max: stats.total || 1, value: stats.count, "aria-label": label }),
    ]))),
    h("p", { class: "muted", text: "Une leçon cochée, un exercice contrôlé et un projet construit sont trois repères différents. Les explorations ne sont pas nécessaires pour finir ton premier GPT." }),
    groups.core.count === groups.core.total && groups.core.total > 0
      ? h("a", { href: "#/atelier", class: "button button-primary", text: "Tronc commun parcouru : préparer le bilan du projet" }) : null,
  ]);
}

export function phaseGuide(index) {
  return h("section", { class: "sheet phase-guide" }, [
    h("h2", { text: "Le chemin vers mon premier GPT" }),
    h("p", { text: `${PHASES.length} phases, ${index.coreIds.length} leçons, un modèle personnel à livrer. Les ${index.explorationIds.length} autres leçons sont des extensions au choix.` }),
    ...PHASES.map((phase, i) => {
      const levels = phase.levels.map(id => index.allLevels.find(level => level.id === id)).filter(Boolean);
      const lessons = index.coreIds.map(id => index.byId.get(id)).filter(item => phase.levels.includes(item.level.id)).map(item => item.lesson);
      const minutes = lessons.reduce((n, lesson) => n + lessonTiming(lesson).reading, 0);
      const activity = lessons.reduce((n, lesson) => n + lessonTiming(lesson).activity, 0);
      return h("details", { class: "phase-card" }, [
        h("summary", { text: `${i + 1}. ${phase.title}` }),
        h("p", {}, [h("strong", { text: "Résultat : " }), phase.result]),
        h("p", {}, [h("strong", { text: "Prérequis : " }), phase.prerequisite]),
        h("p", { text: `Texte à lire : environ ${minutes} min. Activités : budget indicatif de ${Math.floor(activity / 60)} h ${String(activity % 60).padStart(2, "0")}, lecture comprise, hors attente des calculs. Ces repères ne mesurent pas le temps nécessaire pour comprendre.` }),
        h("p", {}, [h("strong", { text: "Critère de fin : " }), phase.check]),
        h("p", {}, h("a", { href: `#/lecon/${lessons[0]?.id}`, text: `Ouvrir : ${lessons[0]?.title}` })),
        ...levels.map(level => h("p", {}, h("a", { href: `#/niveau/${level.id}`, text: `Repères du niveau ${level.id} · ${level.title}` }))),
      ]);
    }),
    h("p", {}, h("a", { href: "#/atelier", text: "Installation, TP et projet final" })),
  ]);
}

/** Ne saute aucune nouvelle leçon pour remplir le créneau. */
export function planSession(index, done, minutes) {
  let remaining = minutes;
  const finished = new Set(done);
  const plan = [];
  for (const id of index.activeIds) {
    if (finished.has(id)) continue;
    const lesson = index.byId.get(id).lesson;
    const duration = Math.min(lesson.minutes, remaining);
    plan.push({ id, title: lesson.title, minutes: duration, partial: duration < lesson.minutes });
    remaining -= duration;
    if (remaining <= 0) break;
  }
  return plan;
}

export function sessionPlanner(index, done) {
  const select = h("select", { "aria-label": "Durée de la séance" }, [15, 30, 60, 120].map(minutes => h("option", { value: minutes, text: `${minutes} minutes` })));
  const list = h("ol", { "aria-live": "polite" });
  const paint = () => {
    const plan = planSession(index, done(), Number(select.value));
    list.replaceChildren(...plan.map(item => h("li", {}, [
      h("a", { href: `#/lecon/${item.id}`, text: `${item.id} · ${item.title}` }),
      ` · ${item.minutes} min${item.partial ? " pour commencer ; conserver ton point de reprise" : " d’activité indicative"}`,
      h("p", { class: "muted", text: `Résultat visé : ${index.byId.get(item.id)?.lesson.objectives?.[0] || "expliquer l’idée et vérifier un exemple"}.` }),
    ])));
    if (!plan.length) list.append(h("li", {}, h("a", { href: "#/atelier", text: "Préparer le projet final et vérifier les preuves de construction" })));
  };
  select.onchange = paint;
  paint();
  return h("section", { class: "sheet session-planner" }, [
    h("h2", { text: "Ma prochaine séance" }),
    h("p", { text: "Choisis un créneau pour comprendre et pratiquer dans l’ordre. Les durées sont indicatives et excluent l’attente des calculs. Le suivi local conserve tes leçons parcourues ; une activité longue peut demander plusieurs séances." }),
    h("label", {}, ["Temps disponible ", select]), list,
  ]);
}
