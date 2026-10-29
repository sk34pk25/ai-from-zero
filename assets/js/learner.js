/** Mode apprenant local : la progression d'un visiteur reste dans CE navigateur.
 *
 * Rien n'est écrit tant que le visiteur ne l'a pas demandé, et rien n'est
 * envoyé au serveur. La sauvegarde exportée a le format de Mon espace : le
 * propriétaire peut l'importer telle quelle dans son compte.
 */
import { readJson, writeJson } from "./storage.js";

export const LOCAL_FLAG_KEY = "afz-local-learner";
export const LOCAL_PROGRESS_KEY = "afz-local-progress-v1";
export const LOCAL_REVIEW_KEY = "afz-local-review-v1";
const LOCAL_KEYS = [LOCAL_FLAG_KEY, LOCAL_PROGRESS_KEY, LOCAL_REVIEW_KEY];
const STEP_ID = /^\d+\.\d+$/;

export function localLearnerEnabled(storage) {
  try {
    return storage.getItem(LOCAL_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableLocalLearner(storage) {
  try {
    storage.setItem(LOCAL_FLAG_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

/** Efface toutes les clés du mode local, et seulement elles. */
export function forgetLocalLearner(storage) {
  for (const key of LOCAL_KEYS) {
    try {
      storage.removeItem(key);
    } catch {
      /* stockage indisponible */
    }
  }
}

export function readLocalProgress(storage) {
  return readJson(storage, LOCAL_PROGRESS_KEY, null);
}

export function writeLocalProgress(storage, progress) {
  return writeJson(storage, LOCAL_PROGRESS_KEY, progress);
}

export function localBackup(progress, now = new Date()) {
  return {
    format: "ai-from-zero",
    version: 1,
    createdAt: now.toISOString(),
    records: {
      progress: {
        v: 1,
        done: [...(progress?.done || [])].filter((id) => STEP_ID.test(id)),
        quizzes: { ...(progress?.quizzes || {}) },
        exercises: { ...(progress?.exercises || {}) },
      },
    },
  };
}

/** Lit la progression d'une sauvegarde déjà validée, en ne gardant que les étapes connues. */
export function progressFromBackup(backup, knownIds) {
  const raw = backup?.records?.progress;
  if (!raw || !Array.isArray(raw.done)) throw new Error("La sauvegarde ne contient pas de progression");
  const known = new Set(knownIds);
  const keep = (map) =>
    Object.fromEntries(
      Object.entries(map && typeof map === "object" && !Array.isArray(map) ? map : {}).filter(([id]) =>
        known.has(id),
      ),
    );
  return {
    v: 1,
    done: raw.done.filter((id) => typeof id === "string" && known.has(id)),
    quizzes: keep(raw.quizzes),
    exercises: keep(raw.exercises),
  };
}
