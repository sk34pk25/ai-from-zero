/** Index du parcours. Les identifiants sont numériques : 0.10 suit 0.9. */

export function compareStepIds(a, b) {
  const [am, an] = String(a).split(".").map(Number);
  const [bm, bn] = String(b).split(".").map(Number);
  return am - bm || an - bn;
}

export function indexCurriculum(data, path = "core") {
  const lessons = [];
  const levels = data.levels.map((level) => {
    const steps = [...level.steps].sort((a, b) => compareStepIds(a.id, b.id));
    for (const step of steps) lessons.push({ lesson: step, level });
    return { ...level, steps };
  });
  lessons.sort((a, b) => compareStepIds(a.lesson.id, b.lesson.id));
  const byId = new Map(lessons.map((item) => [item.lesson.id, item]));
  const index = {
    meta: data.meta,
    architecture: data.architecture ?? [],
    track: data.track ?? [],
    levels,
    allLevels: levels,
    learningPath: data.learningPath ?? {},
    lessons,
    byId,
    numericIds: lessons.map((item) => item.lesson.id),
  };
  return applyLearningPath(index, path);
}

export function applyLearningPath(index, path) {
  index.path = path === "all" ? "all" : "core";
  const core = index.learningPath.coreLevels ?? [];
  const after = index.learningPath.afterCoreLevels ?? [];
  const order = [...new Set([...core, ...after, ...index.allLevels.map((l) => l.id)])];
  index.levels = index.path === "core" && core.length
    ? [...index.allLevels].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    : [...index.allLevels];
  index.orderedIds = index.levels.flatMap((l) => l.steps.map((s) => s.id));
  index.coreIds = index.allLevels.filter((l) => core.includes(l.id)).flatMap((l) => l.steps.map((s) => s.id));
  return index;
}

export function preferredLearningPath() {
  try { return localStorage.getItem("afz-learning-path") === "all" ? "all" : "core"; }
  catch { return "core"; }
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
