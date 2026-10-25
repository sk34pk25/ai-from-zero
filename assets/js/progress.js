/** Progression locale. Le schéma est versionné pour pouvoir migrer plus tard. */

export const PROGRESS_KEY = "afz-progress";

export function emptyProgress() {
  return { v: 1, done: [] };
}

export function normalizeProgress(raw) {
  const source = Array.isArray(raw?.done) ? raw.done : [];
  const done = [];
  const seen = new Set();
  for (const id of source) {
    if (typeof id !== "string" || seen.has(id)) continue;
    seen.add(id);
    done.push(id);
  }
  const quizzes = {};
  if (raw?.quizzes && typeof raw.quizzes === "object" && !Array.isArray(raw.quizzes)) {
    for (const [id, row] of Object.entries(raw.quizzes)) {
      if (typeof id !== "string" || !row || typeof row.correct !== "boolean") continue;
      quizzes[id] = { correct: row.correct };
    }
  }
  const exercises = {};
  if (raw?.exercises && typeof raw.exercises === "object" && !Array.isArray(raw.exercises)) {
    for (const [id, row] of Object.entries(raw.exercises)) {
      if (typeof id !== "string" || !row || typeof row.ok !== "boolean") continue;
      exercises[id] = { ok: row.ok };
    }
  }
  return { v: 1, done, quizzes, exercises };
}

export function reviewQueue(orderedIds, progress) {
  const known = new Set(orderedIds);
  const quizzes = progress?.quizzes || {};
  const exercises = progress?.exercises || {};
  const failed = orderedIds.filter((id) => quizzes[id]?.correct === false || exercises[id]?.ok === false);
  const failedSet = new Set(failed);
  const stamps = progress?.stamps || {};
  const rest = (progress?.done || []).filter((id) => known.has(id) && !failedSet.has(id));
  rest.sort((a, b) => (Number(stamps[a]) || 0) - (Number(stamps[b]) || 0));
  return [...failed, ...rest];
}

export function completionStats(orderedIds, doneIds) {
  const done = new Set(doneIds);
  const total = orderedIds.length;
  const count = orderedIds.filter((id) => done.has(id)).length;
  const percent = total === 0 ? 0 : Math.round((count / total) * 100);
  const nextId = orderedIds.find((id) => !done.has(id)) ?? null;
  return { total, count, percent, nextId };
}

export function stepsLabel(count) {
  if (count === 0) return "Aucune étape terminée";
  if (count === 1) return "1 étape terminée";
  return `${count} étapes terminées`;
}
