/** Index du parcours. Les identifiants sont numériques : 0.10 suit 0.9. */

export function compareStepIds(a, b) {
  const [am, an] = String(a).split(".").map(Number);
  const [bm, bn] = String(b).split(".").map(Number);
  return am - bm || an - bn;
}

export function indexCurriculum(data) {
  const lessons = [];
  const levels = data.levels.map((level) => {
    const steps = [...level.steps].sort((a, b) => compareStepIds(a.id, b.id));
    for (const step of steps) lessons.push({ lesson: step, level });
    return { ...level, steps };
  });
  lessons.sort((a, b) => compareStepIds(a.lesson.id, b.lesson.id));
  const byId = new Map(lessons.map((item) => [item.lesson.id, item]));
  return {
    meta: data.meta,
    architecture: data.architecture ?? [],
    levels,
    lessons,
    byId,
    orderedIds: lessons.map((item) => item.lesson.id),
  };
}

export function neighbors(orderedIds, id) {
  const index = orderedIds.indexOf(id);
  if (index < 0) return { prev: null, next: null, index: -1 };
  return {
    prev: index > 0 ? orderedIds[index - 1] : null,
    next: index < orderedIds.length - 1 ? orderedIds[index + 1] : null,
    index,
  };
}

export function levelProgress(level, doneIds) {
  const done = new Set(doneIds);
  const count = level.steps.filter((step) => done.has(step.id)).length;
  return { count, total: level.steps.length };
}
