import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexCurriculum, applyLearningPath } from "../../assets/js/curriculum.js";
import { pathProgress, planSession, PHASES } from "../../assets/js/course-guide.js";
import { parseHash, hrefFor } from "../../assets/js/router.js";
import { enableLocalLearner, forgetLocalLearner, localToken, readLocalReading, writeLocalReading } from "../../assets/js/local-records.js";
const data = JSON.parse(readFileSync(new URL("../../data/curriculum-index.json", import.meta.url)));

test("finir le premier GPT ne demande aucune exploration et mène au bilan", () => {
  const index = indexCurriculum(data);
  assert.equal(index.activeIds.length, 86);
  const result = pathProgress(index, index.coreIds);
  assert.equal(result.core.percent, 100);
  assert.equal(result.core.nextId, null);
  assert.equal(result.exploration.count, 0);
  assert.equal(result.exploration.total, 75);
  assert.deepEqual(planSession(index, index.coreIds, 60), []);
  applyLearningPath(index, "all");
  assert.equal(index.activeIds.length, 161);
  assert.equal(planSession(index, index.coreIds, 60)[0].id, "5.1");
});

test("les explorations ne gonflent pas la progression du premier GPT", () => {
  const index = indexCurriculum(data);
  const result = pathProgress(index, [...index.explorationIds, "0.1", "inconnu"]);
  assert.equal(result.core.count, 1);
  assert.equal(result.exploration.count, 75);
  assert.deepEqual(PHASES.flatMap(phase => phase.levels), data.learningPath.coreLevels);
});

test("une courte séance commence la prochaine leçon sans sauter ses prérequis", () => {
  const index = indexCurriculum(data);
  const plan = planSession(index, [], 5);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].id, "0.1");
  assert.equal(plan[0].minutes, 5);
  assert.equal(plan[0].partial, true);
  const long = planSession(index, [], 120);
  assert.equal(long.reduce((n, item) => n + item.minutes, 0), 120);
  assert.deepEqual(long.map(item => item.id), index.activeIds.slice(0, long.length));
});

test("les liens profonds de TP acceptent uniquement les douze TP et se reconstruisent", () => {
  for (let tp = 1; tp <= 12; tp++) {
    assert.deepEqual(parseHash(`#/atelier/tp/${tp}`), { name: "atelier", tp });
    assert.equal(hrefFor({ name: "atelier", tp }), `#/atelier/tp/${tp}`);
  }
  for (const id of [0, 13, "../1", "1?x=2"]) assert.equal(parseHash(`#/atelier/tp/${id}`).name, "notfound");
});

test("le point d’arrêt exige le suivi local et un ancien onglet ne le ressuscite pas", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key), key: i => [...values.keys()][i], get length() { return values.size; } };
  const row = { id: "4.5", y: 600, at: 1 };
  assert.equal(writeLocalReading(storage, row, null), false);
  assert.deepEqual(readLocalReading(storage), {});
  enableLocalLearner(storage);
  const old = localToken(storage);
  assert.equal(writeLocalReading(storage, row, old), true);
  assert.deepEqual(readLocalReading(storage), row);
  forgetLocalLearner(storage);
  enableLocalLearner(storage);
  assert.equal(writeLocalReading(storage, row, old), false);
  assert.deepEqual(readLocalReading(storage), {});
});
