import { normalizeExerciseResult } from "./exercise-result.js";
const object = value => value && typeof value === "object" && !Array.isArray(value);
export function readHarnessState(scope) {
  const state = scope.get("preferences").harness;
  return object(state) ? { ...state, lessons: object(state.lessons) ? state.lessons : {} } : { lessons: {} };
}
export function saveHarnessState(scope, state) {
  const ok = scope.set("preferences", { ...scope.get("preferences"), harness: state });
  if (ok) window.dispatchEvent(new CustomEvent("afz-harness-progress"));
  return ok;
}
export function validateHarnessChecks(raw) {
  if (!object(raw) || raw.format !== "afz-harness-checks-v1" || !["eleve", "correction"].includes(raw.module) || !/^[a-f0-9]{64}$/.test(raw.source_sha256 || "") || !Array.isArray(raw.checks) || !raw.checks.length || raw.checks.length > 8) throw new Error("Rapport de contrôles harness non reconnu");
  const ids = new Set();
  for (const row of raw.checks) {
    if (!object(row) || !Number.isInteger(row.tp) || row.tp < 1 || row.tp > 8 || typeof row.ok !== "boolean" || ids.has(row.tp)) throw new Error("Contrôles invalides ou dupliqués");
    ids.add(row.tp);
  }
  if (raw.total !== raw.checks.length || raw.passed !== raw.checks.filter(row => row.ok).length) throw new Error("Compteurs de contrôles incohérents");
  return { format: raw.format, module: raw.module, source_sha256: raw.source_sha256, total: raw.total, passed: raw.passed, checks: raw.checks.map(({tp,ok}) => ({tp,ok})) };
}
export function validateHarnessStudy(raw, knownIds) {
  if (!object(raw) || raw.format !== "afz-harness-study-v1" || !object(raw.state) || !object(raw.state.lessons)) throw new Error("Sauvegarde de parcours non reconnue");
  const lessons = {};
  for (const [id, row] of Object.entries(raw.state.lessons)) {
    if (!knownIds.includes(id)) continue;
    if (!object(row)) throw new Error("Leçon sauvegardée invalide");
    for (const key of ["code", "note", "explanation"]) if (row[key] != null && (typeof row[key] !== "string" || row[key].length > (key === "code" ? 100000 : 20000))) throw new Error("Texte sauvegardé invalide");
    const quiz = object(row.quiz) && Number.isInteger(row.quiz.choice) && row.quiz.choice >= 0 && row.quiz.choice < 4 && typeof row.quiz.correct === "boolean" && typeof row.quiz.version === "string" ? row.quiz : undefined;
    const attempts = Array.isArray(row.attempts) ? row.attempts.slice(-20).map(normalizeExerciseResult).filter(Boolean) : [];
    lessons[id] = { studied: row.studied === true, code: row.code, note: row.note, explanation: row.explanation, quiz, receipt: normalizeExerciseResult(row.receipt), attempts, imported: true };
  }
  return { lessons, ...(raw.state.checks ? { checks: validateHarnessChecks(raw.state.checks) } : {}) };
}
