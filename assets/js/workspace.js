/** Brouillons privés, révisions serveur et conflits explicites. Aucun jeton exporté. */
import { isOwner, selectRows, saveLearningRecord } from "./auth.js";
const KEY = "afz-workspace-v1";
let records = {};
let status = "local";
let queue = Promise.resolve();
let hydrated = false;
let epoch = 0;
const events = new EventTarget();
const clone = (value) =>
  value == null ? value : JSON.parse(JSON.stringify(value));
function read() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}
function emit() {
  events.dispatchEvent(new Event("change"));
}
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    status = "storage-error";
  }
  emit();
}
export function subscribe(fn) {
  events.addEventListener("change", fn);
  return () => events.removeEventListener("change", fn);
}
export function syncStatus() {
  return {
    status,
    pending: Object.values(records).filter((r) => r.dirty).length,
    conflicts: Object.entries(records)
      .filter(([, r]) => r.conflict)
      .map(([key]) => key),
  };
}
export function getRecord(key, fallback = null) {
  return isOwner() ? clone(records[key]?.payload ?? fallback) : clone(fallback);
}
export function allRecords() {
  return isOwner() ? clone(records) : {};
}
export function setRecord(key, payload, { sync = true } = {}) {
  if (!isOwner()) return;
  const row = records[key] || { revision: 0 };
  records[key] = { ...row, payload: clone(payload), dirty: true };
  persist();
  if (sync) void syncWorkspace();
}
export function reconcile(local, remote) {
  if (!local?.dirty) return { ...remote, dirty: false };
  if (local.revision === remote.revision) return local;
  if (JSON.stringify(local.payload) === JSON.stringify(remote.payload))
    return { ...remote, dirty: false };
  return { ...local, conflict: remote };
}
export async function openWorkspace() {
  epoch += 1;
  hydrated = false;
  records = isOwner() ? read() : {};
  emit();
  if (isOwner()) await syncWorkspace();
}
export function closeWorkspace() {
  epoch += 1;
  hydrated = false;
  records = {};
  status = "local";
  emit();
}
export function syncWorkspace() {
  queue = queue
    .catch(() => {})
    .then(async () => {
      if (!isOwner()) return;
      const run = epoch;
      status = "syncing";
      emit();
      try {
        const rows = await selectRows("learning_records");
        if (run !== epoch || !isOwner()) return;
        for (const remote of rows) {
          if (
            typeof remote.key !== "string" ||
            !Number.isInteger(remote.revision)
          )
            continue;
          records[remote.key] = reconcile(records[remote.key], remote);
        }
        hydrated = true;
        for (const [key, row] of Object.entries(records)) {
          if (!row.dirty || row.conflict) continue;
          const payload = clone(row.payload);
          try {
            const saved = await saveLearningRecord(
              key,
              payload,
              row.revision || 0,
            );
            if (run !== epoch || !isOwner()) return;
            // Une saisie pendant le réseau reste un brouillon à envoyer au tour suivant.
            const newer = records[key];
            records[key] =
              JSON.stringify(newer.payload) === JSON.stringify(payload)
                ? { ...saved, dirty: false }
                : { ...newer, revision: saved.revision };
          } catch (error) {
            if (error.code === "40001") {
              const latest = (await selectRows("learning_records")).find(
                (r) => r.key === key,
              );
              if (latest) records[key] = reconcile(records[key], latest);
            } else throw error;
          }
        }
        status = "synced";
      } catch {
        status = "offline";
      }
      persist();
    });
  return queue;
}
export function resolveConflict(key, side) {
  const row = records[key];
  if (!isOwner() || !row?.conflict) return;
  if (side === "remote") {
    records[`archive/${Date.now()}/${key}`] = {
      payload: row.payload,
      revision: 0,
      dirty: true,
    };
    records[key] = { ...row.conflict, dirty: row.conflict.revision === 0 };
  } else {
    records[`archive/${Date.now()}/${key}`] = {
      payload: row.conflict.payload,
      revision: 0,
      dirty: true,
    };
    records[key] = {
      ...row,
      revision: row.conflict.revision,
      conflict: undefined,
      dirty: true,
    };
  }
  persist();
  void syncWorkspace();
}
export function workspaceReady() {
  return hydrated;
}
export function exportBackup() {
  if (!isOwner()) throw new Error("Réservé au propriétaire");
  return {
    format: "ai-from-zero",
    version: 1,
    createdAt: new Date().toISOString(),
    records: Object.fromEntries(
      Object.entries(records).map(([k, v]) => [k, clone(v.payload)]),
    ),
  };
}
export function validateBackup(raw) {
  if (
    !raw ||
    raw.format !== "ai-from-zero" ||
    raw.version !== 1 ||
    !raw.records ||
    Array.isArray(raw.records) ||
    typeof raw.records !== "object"
  )
    throw new Error("Sauvegarde non reconnue");
  const entries = Object.entries(raw.records);
  if (entries.length > 3000) throw new Error("Trop de données");
  for (const [key, value] of entries) {
    if (
      !/^(progress|reading|preferences|experiments|lesson\/\d+\.\d+|level\/\d+|ide\/[a-zA-Z0-9_./-]+|archive\/.+)$/.test(
        key,
      ) ||
      key.length > 180 ||
      key.includes("..") ||
      JSON.stringify(value).length > 2_000_000
    )
      throw new Error("Donnée invalide");
    if (
      key === "progress" &&
      (!value ||
        !Array.isArray(value.done) ||
        value.done.some(
          (id) => typeof id !== "string" || !/^\d+\.\d+$/.test(id),
        ))
    )
      throw new Error("Progression invalide");
    if (
      key === "experiments" &&
      (!Array.isArray(value) ||
        value.length > 30 ||
        value.some(
          (r) =>
            typeof r.text !== "string" ||
            typeof r.prompt !== "string" ||
            !Number.isFinite(r.seconds) ||
            !Number.isFinite(r.tokens),
        ))
    )
      throw new Error("Expériences invalides");
    if (
      key.startsWith("lesson/") &&
      (!value ||
        (value.note != null && typeof value.note !== "string") ||
        (value.attempts != null && !Array.isArray(value.attempts)) ||
        (value.exerciseCode != null && typeof value.exerciseCode !== "string"))
    )
      throw new Error("Carnet invalide");
    if (key.startsWith("ide/") && typeof value?.content !== "string")
      throw new Error("Fichier invalide");
  }
  return clone(raw);
}
export function importBackup(raw) {
  const backup = validateBackup(raw);
  for (const [key, value] of Object.entries(backup.records))
    setRecord(key, value);
}
export async function forgetLocalWorkspace() {
  if (!isOwner()) return;
  for (const key of [KEY, "afz-progress", "afz-review", "afz-ide-snippet"]) {
    try {
      localStorage.removeItem(key);
    } catch {
      /* stockage indisponible */
    }
  }
  records = {};
  hydrated = false;
  emit();
  if ("indexedDB" in window)
    await new Promise((resolve) => {
      const r = indexedDB.deleteDatabase("afz-ide");
      r.onsuccess = resolve;
      r.onerror = resolve;
      r.onblocked = resolve;
    });
}
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (isOwner()) void syncWorkspace();
  });
  window.addEventListener("focus", () => {
    if (isOwner()) void syncWorkspace();
  });
}

export function seedFile(path, local, cloud) {
  const key = `ide/${path}`;
  if (!isOwner() || records[key]) return;
  if (typeof local !== "string" && typeof cloud !== "string") return;
  records[key] = {
    revision: 0,
    payload: { content: typeof local === "string" ? local : cloud },
    dirty: true,
  };
  if (typeof local === "string" && typeof cloud === "string" && local !== cloud)
    records[key].conflict = { revision: 0, key, payload: { content: cloud } };
  persist();
}

/** Complète une sauvegarde avec les données historiques, sans les modifier. */
export async function completeBackup() {
  const backup = exportBackup();
  try {
    for (const row of await selectRows("ide_files"))
      if (
        typeof row.path === "string" &&
        typeof row.content === "string" &&
        !backup.records[`ide/${row.path}`]
      )
        backup.records[`ide/${row.path}`] = { content: row.content };
  } catch {
    /* la copie connue reste exportable */
  }
  if (typeof indexedDB !== "undefined")
    await new Promise((resolve) => {
      const r = indexedDB.open("afz-ide", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onerror = resolve;
      r.onsuccess = () => {
        const db = r.result;
        const tx = db.transaction("files", "readonly");
        const cursor = tx.objectStore("files").openCursor();
        cursor.onsuccess = () => {
          const item = cursor.result;
          if (item) {
            if (typeof item.value === "string") {
              const key = `ide/${item.key}`;
              if (!backup.records[key])
                backup.records[key] = { content: item.value };
              else if (backup.records[key].content !== item.value)
                backup.records[`archive/legacy/${item.key}`] = {
                  content: item.value,
                };
            }
            item.continue();
          }
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
    });
  return backup;
}
