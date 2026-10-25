import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { compareStepIds, indexCurriculum, neighbors } from "../../assets/js/curriculum.js";
import { completionStats, normalizeProgress, stepsLabel } from "../../assets/js/progress.js";
import { gradeQuiz } from "../../assets/js/quiz.js";
import { hrefFor, parseHash } from "../../assets/js/router.js";
import { moveActiveIndex, searchLessons } from "../../assets/js/search.js";
import { resolveTheme, toggleTheme } from "../../assets/js/storage.js";
import { escapeHtml, modifierLabel, normalize } from "../../assets/js/text.js";

test("les routes hash couvrent l'accueil, un niveau, une leçon et le modèle", () => {
  assert.deepEqual(parseHash(""), { name: "home" });
  assert.deepEqual(parseHash("#/"), { name: "home" });
  assert.deepEqual(parseHash("#/parcours"), { name: "home", focus: "roadmap" });
  assert.deepEqual(parseHash("#/niveau/8"), { name: "level", id: 8 });
  assert.deepEqual(parseHash("#/lecon/0.10"), { name: "lesson", id: "0.10" });
  assert.deepEqual(parseHash("#/modele"), { name: "model" });
  assert.equal(parseHash("#/ailleurs").name, "notfound");
  assert.equal(hrefFor({ name: "lesson", id: "4.5" }), "#/lecon/4.5");
  assert.equal(hrefFor({ name: "home", focus: "roadmap" }), "#/parcours");
});

test("0.10 se trie après 0.9", () => {
  assert.ok(compareStepIds("0.9", "0.10") < 0);
  assert.deepEqual(["0.10", "0.2", "0.9"].sort(compareStepIds), ["0.2", "0.9", "0.10"]);
  const indexed = indexCurriculum({
    meta: {},
    levels: [{ id: 0, title: "N", summary: "", project: "", steps: [{ id: "0.10" }, { id: "0.9" }, { id: "0.2" }] }],
  });
  assert.deepEqual(indexed.orderedIds, ["0.2", "0.9", "0.10"]);
  assert.deepEqual(neighbors(indexed.orderedIds, "0.9"), { prev: "0.2", next: "0.10", index: 1 });
});

test("la recherche ignore les accents et la casse", () => {
  const entries = [
    { lesson: { id: "8.6", title: "La sélectivité", tag: "SSM" }, text: "scan sélectif et état" },
    { lesson: { id: "2.5", title: "Tokenizer", tag: "Texte" }, text: "caractères" },
  ];
  const hits = searchLessons(entries, "SELECTIVITE", 10);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].entry.lesson.id, "8.6");
  assert.equal(normalize("Étape"), "etape");
});

test("le quiz et la progression", () => {
  assert.equal(gradeQuiz(2, null).status, "unanswered");
  assert.equal(gradeQuiz(2, 2).correct, true);
  assert.equal(gradeQuiz(2, 0).status, "incorrect");
  assert.deepEqual(normalizeProgress({ done: ["1.2", "1.2", 3, "0.1"] }).done, ["1.2", "0.1"]);
  const stats = completionStats(["0.1", "0.2", "0.9"], ["0.1"]);
  assert.equal(stats.percent, 33);
  assert.equal(stats.nextId, "0.2");
  assert.equal(stepsLabel(0), "Aucune étape terminée");
  assert.equal(stepsLabel(1), "1 étape terminée");
  assert.equal(stepsLabel(2), "2 étapes terminées");
});

test("le thème, le raccourci et l'échappement", () => {
  assert.equal(resolveTheme("dark", true), "dark");
  assert.equal(resolveTheme(null, true), "light");
  assert.equal(resolveTheme("nope", false), "dark");
  assert.equal(toggleTheme("light"), "dark");
  assert.equal(modifierLabel("Mozilla/5.0 (Macintosh)"), "⌘");
  assert.equal(modifierLabel("Mozilla/5.0 (X11; Linux)"), "Ctrl");
  assert.equal(escapeHtml(`<img alt="&">'`), "&lt;img alt=&quot;&amp;&quot;&gt;&#39;");
});

test("la navigation clavier de la recherche boucle", () => {
  assert.equal(moveActiveIndex(0, 1, 3), 1);
  assert.equal(moveActiveIndex(0, -1, 3), 2);
  assert.equal(moveActiveIndex(2, 1, 3), 0);
  assert.equal(moveActiveIndex(0, 1, 0), -1);
});

test("le curriculum commité a 149 leçons et des réponses réparties", () => {
  const data = JSON.parse(readFileSync(new URL("../../data/curriculum.json", import.meta.url), "utf8"));
  const steps = data.levels.flatMap((level) => level.steps);
  assert.equal(steps.length, 149);
  assert.deepEqual(data.levels.map((level) => level.steps.length), [20, 17, 11, 11, 14, 9, 12, 9, 9, 9, 8, 8, 12]);
  const counts = [0, 0, 0, 0];
  for (const step of steps) {
    assert.equal(step.quiz.choices.length, 4);
    assert.equal(new Set(step.quiz.choices).size, 4);
    counts[step.quiz.answer] += 1;
    assert.ok(step.build.length >= 80);
    assert.equal(JSON.stringify(step).includes("Planifié"), false);
  }
  assert.deepEqual(counts, [37, 38, 37, 37]);
});
