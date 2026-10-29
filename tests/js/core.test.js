import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { compareStepIds, indexCurriculum, neighbors } from "../../assets/js/curriculum.js";
import { completionStats, normalizeProgress, reviewQueue, stepsLabel } from "../../assets/js/progress.js";
import { gradeQuiz } from "../../assets/js/quiz.js";
import { hrefFor, parseHash, routeFromHref } from "../../assets/js/router.js";
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
  assert.deepEqual(parseHash("#/construire"), { name: "track" });
  assert.equal(parseHash("#/ailleurs").name, "notfound");
  assert.equal(hrefFor({ name: "lesson", id: "4.5" }), "#/lecon/4.5");
  assert.equal(hrefFor({ name: "home", focus: "roadmap" }), "#/parcours");
  assert.equal(hrefFor({ name: "track" }), "#/construire");
  assert.deepEqual(parseHash("#/donnees"), { name: "donnees" });
  assert.deepEqual(parseHash("#/playground"), { name: "playground" });
  assert.deepEqual(parseHash("#/ide"), { name: "ide" });
  assert.equal(hrefFor({ name: "about" }), "#/a-propos");
  assert.equal(hrefFor({ name: "connexion" }), "#/connexion");
  assert.deepEqual(parseHash("#/changer-mot-de-passe"), { name: "password" });
  assert.equal(hrefFor({ name: "password" }), "#/changer-mot-de-passe");
  assert.deepEqual(parseHash("#/nouveau-mot-de-passe"), { name: "recovery" });
  assert.equal(hrefFor({ name: "recovery" }), "#/nouveau-mot-de-passe");
  const recovery = parseHash("#access_token=secret-token&refresh_token=secret-refresh&type=recovery");
  assert.deepEqual(recovery, { name: "recovery" });
  assert.equal(JSON.stringify(recovery).includes("secret"), false);
  assert.deepEqual(parseHash("#error=access_denied&error_code=otp_expired&error_description=expired"), { name: "recovery" });
  assert.equal(parseHash("#/lecon/0.10").name, "lesson");
  assert.deepEqual(
    routeFromHref("https://sk34pk25.github.io/ai-from-zero/?code=abc#/connexion"),
    { name: "recovery" },
  );
  assert.deepEqual(
    routeFromHref("https://sk34pk25.github.io/ai-from-zero/?error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"),
    { name: "recovery" },
  );
  const doubled = routeFromHref(
    "https://sk34pk25.github.io/ai-from-zero/#/nouveau-mot-de-passe#access_token=secret-token&expires_in=3600&refresh_token=secret-refresh&token_type=bearer&type=recovery",
  );
  assert.deepEqual(doubled, { name: "recovery" });
  assert.equal(JSON.stringify(doubled).includes("secret"), false);
  assert.deepEqual(
    routeFromHref("https://sk34pk25.github.io/ai-from-zero/?token_hash=secret-hash&type=recovery"),
    { name: "recovery" },
  );
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
  assert.deepEqual(
    normalizeProgress({ done: [], quizzes: { "1.6": { correct: true, choice: 2 } } }).quizzes,
    { "1.6": { correct: true, choice: 2 } },
  );
  const stats = completionStats(["0.1", "0.2", "0.9"], ["0.1"]);
  assert.equal(stats.percent, 33);
  assert.equal(stats.nextId, "0.2");
  assert.equal(stepsLabel(0), "Aucune étape terminée");
  assert.equal(stepsLabel(1), "1 étape terminée");
  assert.equal(stepsLabel(2), "2 étapes terminées");
  assert.deepEqual(reviewQueue(["0.1", "0.2", "0.3"], {
    done: ["0.2", "0.3"],
    quizzes: { "0.1": { correct: false } },
    exercises: {},
    stamps: { "0.3": 1, "0.2": 5 },
  }), ["0.1", "0.3", "0.2"]);
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

test("le curriculum commité a 161 leçons et des réponses réparties", () => {
  const data = JSON.parse(readFileSync(new URL("../../data/curriculum.json", import.meta.url), "utf8"));
  const steps = data.levels.flatMap((level) => level.steps);
  assert.equal(steps.length, 161);
  assert.deepEqual(data.levels.map((level) => level.steps.length), [23, 17, 11, 11, 14, 10, 12, 9, 9, 9, 8, 8, 12, 8]);
  const counts = [0, 0, 0, 0];
  for (const step of steps) {
    assert.equal(step.quiz.choices.length, 4);
    assert.equal(new Set(step.quiz.choices).size, 4);
    counts[step.quiz.answer] += 1;
    assert.ok(step.build.length >= 80);
    assert.equal(JSON.stringify(step).includes("Planifié"), false);
    assert.equal(typeof step.visual, "string");
    assert.equal(step.visual.length > 0, true);
    assert.equal(typeof step.interactive, "boolean");
    assert.equal(step.takeaways.length, 3);
    assert.ok(step.pitfalls.length >= 1);
    assert.ok(step.hints.length >= 2);
    assert.equal(new Set(step.hints).size, step.hints.length);
    assert.ok(step.solution.length > 40);
    assert.ok(step.codeFile.startsWith("model/"));
    assert.ok(step.review.includes(step.title));
    assert.equal(step.glance.steps.length, 3);
    assert.ok(step.glance.phrase.length <= 120 && step.glance.key.length <= 60);
  }
  assert.deepEqual(counts, [41, 40, 40, 40]);
  assert.equal(data.track.length, 20);
  assert.equal(data.track.some((stage) => stage.file === "model/tiny_lm.py"), true);
  assert.equal(data.track.some((stage) => stage.file === "model/gpt_sample.py"), true);
  assert.equal(data.track.find((stage) => stage.id === "lora").file, "model/lora.py");
  assert.equal(data.track.at(-1).file, "atelier/PROJET_FINAL.md");
  assert.equal(parseHash("#/atelier").name, "atelier");
  assert.equal(data.track.some((stage) => stage.file === "model/gpt_train.py"), true);
});
