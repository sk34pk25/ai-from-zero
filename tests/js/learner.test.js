import assert from "node:assert/strict";
import test from "node:test";

import {
  enableLocalLearner,
  forgetLocalLearner,
  localBackup,
  localLearnerEnabled,
  progressFromBackup,
  readLocalProgress,
  writeLocalProgress,
} from "../../assets/js/learner.js";
import { validateBackup } from "../../assets/js/workspace.js";

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    keys: () => [...data.keys()].sort(),
  };
}

test("rien n'est écrit avant la demande explicite du visiteur", () => {
  const storage = memoryStorage({ "afz-theme": "light" });
  assert.equal(localLearnerEnabled(storage), false);
  assert.equal(readLocalProgress(storage), null);
  assert.deepEqual(storage.keys(), ["afz-theme"]);
  assert.equal(enableLocalLearner(storage), true);
  assert.equal(localLearnerEnabled(storage), true);
});

test("l'effacement retire les clés locales et laisse le thème", () => {
  const storage = memoryStorage({ "afz-theme": "dark", "afz-workspace-v1": "{}" });
  enableLocalLearner(storage);
  writeLocalProgress(storage, { v: 1, done: ["0.1"], quizzes: {}, exercises: {} });
  storage.setItem("afz-local-review-v1", "{}");
  forgetLocalLearner(storage);
  assert.deepEqual(storage.keys(), ["afz-theme", "afz-workspace-v1"]);
});

test("un stockage qui refuse l'écriture ne casse pas la page", () => {
  const broken = {
    getItem() {
      throw new Error("bloqué");
    },
    setItem() {
      throw new Error("bloqué");
    },
    removeItem() {
      throw new Error("bloqué");
    },
  };
  assert.equal(localLearnerEnabled(broken), false);
  assert.equal(enableLocalLearner(broken), false);
  assert.equal(writeLocalProgress(broken, { done: [] }), false);
  assert.doesNotThrow(() => forgetLocalLearner(broken));
});

test("l'export local est une sauvegarde valide de Mon espace, et se réimporte", () => {
  const backup = localBackup(
    { done: ["0.1", "1.6", "../x"], quizzes: { "1.6": { choice: 2, correct: true } }, exercises: {} },
    new Date("2026-10-29T12:00:00Z"),
  );
  assert.equal(backup.createdAt, "2026-10-29T12:00:00.000Z");
  assert.deepEqual(backup.records.progress.done, ["0.1", "1.6"]);
  const valid = validateBackup(JSON.parse(JSON.stringify(backup)));
  const restored = progressFromBackup(valid, ["0.1", "1.6", "2.1"]);
  assert.deepEqual(restored.done, ["0.1", "1.6"]);
  assert.deepEqual(restored.quizzes, { "1.6": { choice: 2, correct: true } });
});

test("l'import ignore les étapes inconnues et refuse une sauvegarde sans progression", () => {
  const restored = progressFromBackup(
    { records: { progress: { done: ["0.1", "99.9"], quizzes: { "99.9": {} }, exercises: [] } } },
    ["0.1"],
  );
  assert.deepEqual(restored, { v: 1, done: ["0.1"], quizzes: {}, exercises: {} });
  assert.throws(() => progressFromBackup({ records: {} }, ["0.1"]));
});
