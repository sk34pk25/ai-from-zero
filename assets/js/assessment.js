/** Dossier déclaratif : les contrôles ne certifient ni identité ni autonomie. */
export const ASSISTANCE = ["cours", "indice", "corrigé", "personne", "outil externe"];
const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const object = value => value && typeof value === "object" && !Array.isArray(value);
export function activeMilliseconds(events, now = Date.now()) {
  let start = null, duration = 0;
  for (const event of events) {
    if (["start", "resume"].includes(event.type) && start === null) start = event.at;
    if (["pause", "finish", "abandon"].includes(event.type) && start !== null) {
      duration += Math.max(0, event.at - start); start = null;
    }
  }
  return duration + (start === null ? 0 : Math.max(0, now - start));
}
export function validateAssessmentFile(raw, tasks, { imported = true } = {}) {
  if (!object(raw) || raw.format !== "afz-comprehension-v1" || !Array.isArray(raw.attempts) || raw.attempts.length > 100) throw new Error("Dossier de compréhension non reconnu");
  const ids = new Set();
  const attempts = raw.attempts.map(row => {
    if (!object(row) || typeof row.id !== "string" || !/^[a-zA-Z0-9-]{1,100}$/.test(row.id) || ids.has(row.id) || !tasks.some(task => task.id === row.taskId)) throw new Error("Tentative inconnue ou dupliquée");
    ids.add(row.id);
    const result = { id: row.id, taskId: row.taskId, origin: imported || row.origin === "imported" ? "imported" : "local" };
    for (const field of ["code", "diagnosis", "explanation", "alias", "device", "siteVersion", "taskVersion"]) {
      if (typeof row[field] !== "string" || row[field].length > (field === "code" ? 100000 : 20000)) throw new Error("Texte de tentative invalide");
      result[field] = row[field];
    }
    if (!Array.isArray(row.events) || row.events.length > 500 || !row.events.length || row.events[0].type !== "start") throw new Error("Chronologie absente");
    let previous = 0, live = false, ended = false;
    result.events = row.events.map(event => {
      if (!object(event) || !["start", "pause", "resume", "finish", "abandon"].includes(event.type) || !Number.isFinite(event.at) || event.at <= 0 || event.at < previous || ended) throw new Error("Chronologie invalide");
      if ((event.type === "start" && previous !== 0) || (["start", "resume"].includes(event.type) && live) || (event.type === "pause" && !live)) throw new Error("Transitions de chronologie invalides");
      live = ["start", "resume"].includes(event.type);
      ended = ["finish", "abandon"].includes(event.type); previous = event.at;
      return { type: event.type, at: event.at };
    });
    if (!Array.isArray(row.assistance) || row.assistance.some(value => !ASSISTANCE.includes(value))) throw new Error("Aides invalides");
    result.assistance = [...new Set(row.assistance)];
    result.revealed = Array.isArray(row.revealed) ? [...new Set(row.revealed.filter(value => ["indice", "corrigé"].includes(value)))] : [];
    result.assistance = [...new Set([...result.assistance, ...result.revealed])];
    if (!Array.isArray(row.checks) || row.checks.length > 100) throw new Error("Historique invalide");
    result.checks = row.checks.map(check => {
      if (!object(check) || typeof check.ok !== "boolean" || !hash(check.codeHash) || !hash(check.validatorVersion) || !Number.isFinite(check.checkedAt) || check.checkedAt <= 0) throw new Error("Résultat invalide");
      return { ok: check.ok, codeHash: check.codeHash, validatorVersion: check.validatorVersion, checkedAt: check.checkedAt, assistance: Array.isArray(check.assistance) ? check.assistance.filter(value => ASSISTANCE.includes(value)) : [] };
    });
    if (row.review != null) {
      const review = row.review;
      if (!object(review) || !["self", "observer"].includes(review.type) || typeof review.by !== "string" || review.by.length > 100 || (review.type === "observer" && !review.by.trim()) || typeof review.evidence !== "string" || !review.evidence.trim() || review.evidence.length > 20000 || !Array.isArray(review.scores) || review.scores.length !== 3 || review.scores.some(score => ![0, 1, 2].includes(score)) || !hash(review.contentHash)) throw new Error("Relecture invalide");
      result.review = { type: review.type, by: review.by, evidence: review.evidence, scores: review.scores, contentHash: review.contentHash };
    }
    return result;
  });
  return { format: "afz-comprehension-v1", attempts };
}
