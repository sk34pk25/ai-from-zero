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
  return { v: 1, done };
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
