import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { knownSteps, PASS_MISSES, PLACEMENT, scorePlacement } from "../../assets/js/placement.js";

const curriculum = JSON.parse(readFileSync(new URL("../../data/curriculum.json", import.meta.url), "utf8"));
const levelZero = curriculum.levels[0].steps.map((step) => step.id);
const perfect = Object.fromEntries(PLACEMENT.map((q) => [q.id, q.answer]));

test("chaque question renvoie à des étapes réelles du niveau 0 et a quatre choix distincts", () => {
  assert.equal(new Set(PLACEMENT.map((q) => q.id)).size, PLACEMENT.length);
  for (const q of PLACEMENT) {
    assert.equal(q.choices.length, 4, q.id);
    assert.equal(new Set(q.choices).size, 4, q.id);
    assert.ok(q.answer >= 0 && q.answer < 4, q.id);
    assert.ok(q.steps.length > 0 && q.steps.every((id) => levelZero.includes(id)), q.id);
  }
  // La bonne réponse ne doit pas être toujours à la même place.
  assert.ok(new Set(PLACEMENT.map((q) => q.answer)).size >= 3);
});

test("un sans-faute propose de survoler tout le niveau 0", () => {
  const result = scorePlacement(perfect);
  assert.deepEqual(result, { score: PLACEMENT.length, total: PLACEMENT.length, unanswered: 0, review: [], passed: true });
  assert.deepEqual(knownSteps(levelZero, result), levelZero);
});

test("les étapes liées aux erreurs restent à faire, même quand le test est réussi", () => {
  const answers = { ...perfect, objets: (perfect.objets + 1) % 4, tests: (perfect.tests + 1) % 4 };
  const result = scorePlacement(answers);
  assert.equal(result.passed, true);
  assert.deepEqual(result.review, ["0.12", "0.21", "0.22"]);
  const known = knownSteps(levelZero, result);
  assert.ok(!known.includes("0.21") && !known.includes("0.12") && known.includes("0.1"));
});

test("trop d'erreurs ou une réponse manquante ne valident pas le niveau 0", () => {
  const wrong = Object.fromEntries(
    PLACEMENT.slice(0, PASS_MISSES + 1).map((q) => [q.id, (q.answer + 1) % 4]),
  );
  assert.equal(scorePlacement({ ...perfect, ...wrong }).passed, false);
  const missing = { ...perfect };
  delete missing.derivee;
  const result = scorePlacement(missing);
  assert.equal(result.passed, false);
  assert.equal(result.unanswered, 1);
});
