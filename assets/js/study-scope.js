/** Même interface de notes/projet ; les visiteurs n'utilisent jamais la synchronisation. */
import { isOwner } from "./auth.js";
import { getRecord, setRecord, subscribe } from "./workspace.js";
import { browserStorage, localToken, readLocalStudyRecords, writeLocalStudyRecord } from "./local-records.js";
const memory = new Map();
export function studyScope() {
  const owner = isOwner(), storage = browserStorage(), token = localToken(storage);
  return {
    owner,
    get(key, fallback = {}) {
      if (owner) return isOwner() ? getRecord(key, fallback) : fallback;
      if (token) return token === localToken(storage) ? readLocalStudyRecords(storage)[key] ?? fallback : fallback;
      return memory.get(key) ?? fallback;
    },
    set(key, value, options) {
      if (owner) { if (!isOwner()) return false; setRecord(key, value, options); return true; }
      if (token) return writeLocalStudyRecord(storage, key, value, token);
      memory.set(key, value); return true;
    },
    subscribe(callback) { return owner ? subscribe(callback) : () => {}; },
    message: owner ? "Enregistrement local et synchronisation du propriétaire." : token ? "Enregistré sur cet appareil, sans envoi." : "Conservé pendant cette session. Active le suivi local pour le garder après fermeture, ou exporte ton dossier.",
  };
}
export function forgetStudyMemory() { memory.clear(); }
export function persistStudyMemory(storage, token) {
  for (const [key, value] of memory) {
    if (writeLocalStudyRecord(storage, key, value, token)) memory.delete(key);
  }
}
