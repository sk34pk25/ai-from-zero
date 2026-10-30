/** Même interface de notes/projet ; les visiteurs n'utilisent jamais la synchronisation. */
import { isOwner } from "./auth.js";
import { getRecord, setRecord, subscribe } from "./workspace.js";
import { browserStorage, localToken, localChangeKey, readLocalStudyRecords, writeLocalStudyRecord } from "./local-records.js";
const memory = new Map();
const listeners = new Set();
let memoryGeneration = 0;
function announce() { for (const callback of listeners) callback(); }
export function studyScope() {
  const owner = isOwner(), storage = browserStorage(), token = localToken(storage);
  const generation = memoryGeneration;
  return {
    owner,
    get(key, fallback = {}) {
      if (owner) return isOwner() ? getRecord(key, fallback) : fallback;
      if (token) return token === localToken(storage) ? readLocalStudyRecords(storage)[key] ?? fallback : fallback;
      return generation === memoryGeneration && !isOwner() && !localToken(storage) ? memory.get(key) ?? fallback : fallback;
    },
    set(key, value, options) {
      if (owner) { if (!isOwner()) return false; setRecord(key, value, options); return true; }
      if (isOwner()) return false;
      if (token) { const ok = writeLocalStudyRecord(storage, key, value, token); if (ok) announce(); return ok; }
      if (generation !== memoryGeneration || localToken(storage)) return false;
      memory.set(key, value); announce(); return true;
    },
    subscribe(callback) {
      if (owner) return subscribe(callback);
      const changed = event => { if (localChangeKey(event.key)) callback(); };
      listeners.add(callback); globalThis.window?.addEventListener("storage", changed);
      return () => { listeners.delete(callback); globalThis.window?.removeEventListener("storage", changed); };
    },
    message: owner ? "Enregistrement local et synchronisation du propriétaire." : token ? "Enregistré sur cet appareil, sans envoi." : "Conservé pendant cette session. Active le suivi local pour le garder après fermeture, ou exporte ton dossier.",
  };
}
export function forgetStudyMemory() { memory.clear(); memoryGeneration++; announce(); }
export function persistStudyMemory(storage, token) {
  for (const [key, value] of memory) {
    if (writeLocalStudyRecord(storage, key, value, token)) memory.delete(key);
  }
}
