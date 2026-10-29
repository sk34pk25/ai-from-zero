/** Accès JSON à un Storage, isolé pour les tests. */

export function readJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const THEME_KEY = "afz-theme";

export function resolveTheme(stored, prefersLight) {
  if (stored === "light" || stored === "dark") return stored;
  return prefersLight ? "light" : "dark";
}

export function toggleTheme(theme) {
  return theme === "light" ? "dark" : "light";
}
