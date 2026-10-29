import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexCurriculum, applyLearningPath, neighbors } from "../../assets/js/curriculum.js";
import { completionStats } from "../../assets/js/progress.js";
import { validateChecks, normalizeReports } from "../../assets/js/evidence.js";

test("le parcours actif règle la reprise et les voisins sans perdre des leçons", () => {
  const data = JSON.parse(readFileSync(new URL("../../data/curriculum.json", import.meta.url)));
  const index = indexCurriculum(data);
  const done = index.lessons.filter(({ level }) => level.id <= 4).map(({ lesson }) => lesson.id);
  assert.equal(completionStats(index.orderedIds, done).nextId, "13.1");
  assert.equal(neighbors(index.orderedIds, "4.14").next, "13.1");
  assert.equal(index.orderedIds.length, 161);
  assert.equal(index.coreIds.length, 84);
  applyLearningPath(index, "all");
  assert.equal(neighbors(index.orderedIds, "4.14").next, "5.1");
  assert.equal(completionStats(index.orderedIds, done).count, done.length);
});

test("un contrôle importé doit avoir des identifiants uniques et des compteurs cohérents", () => {
  const x = { format: "afz-atelier-checks-v1", module: "eleve", source_sha256: "a".repeat(64), controles: [{ tp: 5, ok: true }], total: 1, reussis: 1 };
  assert.equal(validateChecks(x).controles[0].tp, 5);
  assert.throws(() => validateChecks({ ...x, reussis: 12 }));
  assert.throws(() => validateChecks({ ...x, controles: [x.controles[0], x.controles[0]], total: 2, reussis: 2 }));
  assert.throws(() => validateChecks({ ...x, source_sha256: "faux" }));
  assert.throws(() => validateChecks({ ...x, controles: [{ tp: 1, ok: "oui" }] }));
});

test("les rapports distinguent train, validation et test et refusent les valeurs trompeuses", () => {
  const plan = { format: "afz-training-plan-v1", items: [{ mode: "sft", loss_end: 7, train_evaluation: { loss: 3.1 }, validation_loss_end: 4.2 }] };
  assert.equal(normalizeReports(plan, "plan")[0].train_loss_end, 3.1);
  assert.throws(() => normalizeReports({ ...plan, items: [{ mode: "sft", train_loss_end: "0" }] }, "faux"));
  assert.throws(() => normalizeReports({ train_loss_end: Infinity }, "faux"));
  assert.throws(() => normalizeReports({ format: "inconnu", train_loss_end: 0 }, "faux"));
  const x = { format: "afz-benchmark-v1", selected_width: 16, runs: [{ width: 16, seed: 0, train_loss_end: 2 }, { width: 24, seed: 0, train_loss_end: 1.9 }], test_final: [{ seed: 0, test_loss: 2.7 }] };
  const rows = normalizeReports(x, "banc");
  assert.equal(rows[0].test_final.test_loss, 2.7);
  assert.equal(rows[1].test_final, undefined);
});
