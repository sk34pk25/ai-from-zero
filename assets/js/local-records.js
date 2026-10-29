/** Une clé par champ et leçon ; la dernière écriture d'un même champ gagne.
 * Les générations empêchent un onglet ancien de ressusciter les données effacées. */
import { normalizeProgress } from "./progress.js";
import { readJson, writeJson } from "./storage.js";
export const LOCAL_FLAG_KEY = "afz-local-learner";
export const LOCAL_PROGRESS_KEY = "afz-local-progress-v1";
export const LOCAL_REVIEW_KEY = "afz-local-review-v1";
export const LOCAL_PREFIX = "afz-local-v2/";
const STEP = /^\d+\.\d+$/;
export function browserStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}
export function localToken(storage) {
  try {
    const token = storage?.getItem(LOCAL_FLAG_KEY);
    return token === "1" || /^v2:[a-zA-Z0-9-]+$/.test(token || "") ? token : null;
  } catch { return null; }
}
export function localLearnerEnabled(storage) { return Boolean(localToken(storage)); }
export function enableLocalLearner(storage) {
  if (localToken(storage)) return true;
  try {
    const id = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    storage.setItem(LOCAL_FLAG_KEY, "v2:" + id);
    return true;
  } catch { return false; }
}
function keys(storage) {
  const result = [];
  try { for (let i = 0; i < storage.length; i++) result.push(storage.key(i)); } catch { /* stockage refusé */ }
  return result.filter((k) => typeof k === "string");
}
export function localChangeKey(key) {
  return key == null || [LOCAL_FLAG_KEY, LOCAL_PROGRESS_KEY, LOCAL_REVIEW_KEY].includes(key) || key.startsWith(LOCAL_PREFIX);
}
export function forgetLocalLearner(storage) {
  for (const key of [LOCAL_FLAG_KEY, LOCAL_PROGRESS_KEY, LOCAL_REVIEW_KEY, ...keys(storage).filter((k) => k.startsWith(LOCAL_PREFIX))]) {
    try { storage.removeItem(key); } catch { /* stockage refusé */ }
  }
}
function rows(storage, field, token = localToken(storage)) {
  const prefix = LOCAL_PREFIX + token + "/" + field + "/";
  return keys(storage).filter((k) => k.startsWith(prefix) && STEP.test(k.slice(prefix.length)))
    .map((key) => [key.slice(prefix.length), readJson(storage, key, { value: null }).value]);
}
function put(storage, field, id, value, token) {
  if (!token || token !== localToken(storage) || !STEP.test(id)) return false;
  const key = LOCAL_PREFIX + token + "/" + field + "/" + id;
  const ok = writeJson(storage, key, { value });
  if (token !== localToken(storage)) {
    try { storage.removeItem(key); } catch { /* génération inactive */ }
    return false;
  }
  return ok;
}
export function readLocalProgress(storage) {
  const token = localToken(storage);
  if (!token) return null;
  const base = normalizeProgress(token === "1" ? readJson(storage, LOCAL_PROGRESS_KEY, {}) : {});
  const done = new Set(base.done);
  for (const [id, value] of rows(storage, "done", token)) {
    if (value === true) done.add(id); else if (value === false) done.delete(id);
  }
  for (const field of ["quizzes", "exercises"]) for (const [id, value] of rows(storage, field, token)) {
    if (value == null) delete base[field][id]; else base[field][id] = value;
  }
  return normalizeProgress({ ...base, done: [...done] });
}
export function writeLocalProgress(storage, progress, previous = readLocalProgress(storage), token = localToken(storage)) {
  if (!token || token !== localToken(storage)) return false;
  const before = normalizeProgress(previous), after = normalizeProgress(progress);
  const a = new Set(after.done), b = new Set(before.done);
  let ok = true;
  for (const id of new Set([...a, ...b])) if (a.has(id) !== b.has(id)) ok = put(storage, "done", id, a.has(id), token) && ok;
  for (const field of ["quizzes", "exercises"]) for (const id of new Set([...Object.keys(before[field]), ...Object.keys(after[field])])) {
    if (JSON.stringify(before[field][id]) !== JSON.stringify(after[field][id])) ok = put(storage, field, id, after[field][id] ?? null, token) && ok;
  }
  return ok;
}
export function readLocalReview(storage) {
  const token = localToken(storage);
  const base = token === "1" ? readJson(storage, LOCAL_REVIEW_KEY, {}) : {};
  const result = base && typeof base === "object" && !Array.isArray(base) ? { ...base } : {};
  if (!token) return {};
  for (const [id, value] of rows(storage, "review", token)) {
    if (Number.isFinite(value) && value > 0) result[id] = value; else delete result[id];
  }
  return result;
}
export function writeLocalReview(storage, id, present, token) {
  return put(storage, "review", id, present ? Date.now() : null, token);
}
export function readLocalDrafts(storage) {
  if (!localToken(storage)) return {};
  return Object.fromEntries(rows(storage, "draft").filter(([, code]) => typeof code === "string" && code.length <= 100000));
}
export function readLocalDraft(storage, id) { return readLocalDrafts(storage)[id]; }
export function writeLocalDraft(storage, id, code, token) {
  return typeof code === "string" && code.length <= 100000 && put(storage, "draft", id, code, token);
}
